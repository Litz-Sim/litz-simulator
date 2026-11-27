/**
 * Where the projects live: the folder a `litz serve` link opened, or a bucket
 * the browser signs for itself.
 *
 * Local storage stays the offline mirror every edit already writes, so neither
 * provider is load-bearing for the editor to keep working.
 */
import { m } from '#lib/paraglide/messages.js';
import { link } from '#lib/sim/editorLink.svelte';
import { doc } from '#lib/sketch/doc.svelte';
import {
	configured,
	EMPTY_SETTINGS,
	objectKey,
	plainName,
	projectName,
	S3Store,
	type S3Settings,
	type StoredProject
} from './s3';

const SETTINGS_KEY = 'litz.storage.v1';
const PROVIDER_KEY = 'litz.storage.provider.v1';
const ATTACHED_KEY = 'litz.storage.attached.v1';

/** The link's own folder is the default; a bucket is opt-in. */
export type StorageProvider = 'link' | 's3';

function restoredProvider(): StorageProvider {
	if (typeof localStorage === 'undefined') return 'link';
	return localStorage.getItem(PROVIDER_KEY) === 's3' ? 's3' : 'link';
}

/**
 * The project this browser was last attached to, if it belongs to the store in
 * use. A key from one store names nothing in the other, so it is not carried
 * across a switch.
 */
function restoredAttachment(provider: StorageProvider): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const text = localStorage.getItem(ATTACHED_KEY);
		if (!text) return null;
		const parsed = JSON.parse(text) as { provider?: string; key?: string };
		return parsed.provider === provider && typeof parsed.key === 'string' ? parsed.key : null;
	} catch {
		return null;
	}
}

function restored(): S3Settings {
	if (typeof localStorage === 'undefined') return { ...EMPTY_SETTINGS };
	try {
		const text = localStorage.getItem(SETTINGS_KEY);
		if (!text) return { ...EMPTY_SETTINGS };
		const parsed = JSON.parse(text) as Partial<S3Settings>;
		return { ...EMPTY_SETTINGS, ...parsed };
	} catch {
		return { ...EMPTY_SETTINGS };
	}
}

class Projects {
	settings = $state<S3Settings>(restored());
	provider = $state<StorageProvider>(restoredProvider());
	/** Projects in the chosen store, newest first. */
	items = $state<StoredProject[]>([]);
	/** Key of the project this document is attached to, or null. */
	key = $state<string | null>(restoredAttachment(this.provider));
	listing = $state(false);
	saving = $state(false);
	error = $state<string | null>(null);
	sync = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	#timer: ReturnType<typeof setTimeout> | undefined;

	get ready(): boolean {
		return this.provider === 'link' ? link.status === 'online' : configured(this.settings);
	}

	/** A key as the dialog shows it: a library stem or a key without its prefix. */
	nameOf(key: string): string {
		return this.provider === 'link' ? key : projectName(key, this.settings.prefix);
	}

	/** Switching stores detaches the document: a key means nothing in the other one. */
	setProvider(next: StorageProvider): void {
		if (this.provider === next) return;
		this.provider = next;
		this.#setKey(null);
		this.items = [];
		this.sync = 'idle';
		this.error = null;
		try {
			localStorage.setItem(PROVIDER_KEY, next);
		} catch {
			// A full quota only costs the choice; the session keeps the provider.
		}
	}

	#store(): S3Store {
		return new S3Store(this.settings);
	}

	#text(key: string): Promise<string> {
		return this.provider === 'link' ? link.readProject(key) : this.#store().text(key);
	}

	#put(key: string, body: string): Promise<void> {
		return this.provider === 'link' ? link.writeProject(key, body) : this.#store().put(key, body);
	}

	#remove(key: string): Promise<void> {
		return this.provider === 'link' ? link.removeProject(key) : this.#store().remove(key);
	}

	#fail(failure: unknown): void {
		this.sync = 'error';
		this.error = failure instanceof Error ? failure.message : String(failure);
	}

	/** Persist the connection settings for this browser. */
	saveSettings(next: S3Settings): void {
		this.settings = { ...next };
		this.error = null;
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
		} catch {
			// A full quota only costs the settings; the editor keeps working.
		}
	}

	/** List the bucket once, to report whether the settings work. */
	async test(): Promise<boolean> {
		this.error = null;
		try {
			if (this.provider === 'link') await link.projects();
			else await this.#store().list();
			return true;
		} catch (failure) {
			this.#fail(failure);
			return false;
		}
	}

	async refresh(): Promise<void> {
		if (!this.ready) return;
		this.listing = true;
		this.error = null;
		try {
			this.items = this.provider === 'link' ? await link.projects() : await this.#store().list();
		} catch (failure) {
			this.#fail(failure);
		} finally {
			this.listing = false;
		}
	}

	/** Replace the workspace with the project in the bucket. */
	async open(item: StoredProject): Promise<boolean> {
		this.error = null;
		try {
			const text = await this.#text(item.key);
			if (!doc.loadProject(text)) {
				this.error = m.projects_invalid();
				return false;
			}
			this.#setKey(item.key);
			this.sync = 'saved';
			return true;
		} catch (failure) {
			this.#fail(failure);
			return false;
		}
	}

	/**
	 * Upload the workspace. Without a name the attached key is reused, so the
	 * debounced save after an edit never forks the project into a second
	 * object; a document that is not attached stays local.
	 */
	async save(name?: string): Promise<boolean> {
		const named = name?.trim();
		const target = named
			? this.provider === 'link'
				? plainName(named)
				: objectKey(named, this.settings.prefix)
			: this.key;
		if (!target) return false;
		this.saving = true;
		this.sync = 'saving';
		this.error = null;
		try {
			// The object name is the document's name, so a save under a new
			// name renames the tab as well and the file and its title agree
			// when it is opened again.
			if (named) doc.renameTab(this.nameOf(target));
			await this.#put(target, doc.projectJSON());
			this.#setKey(target);
			this.sync = 'saved';
			await this.refresh();
			return true;
		} catch (failure) {
			this.#fail(failure);
			return false;
		} finally {
			this.saving = false;
		}
	}

	async remove(item: StoredProject): Promise<void> {
		// A save queued by the last edit would recreate the object under the
		// document's current name once the key is gone.
		clearTimeout(this.#timer);
		this.error = null;
		try {
			await this.#remove(item.key);
			if (this.key === item.key) {
				this.#setKey(null);
				this.sync = 'idle';
			}
			await this.refresh();
		} catch (failure) {
			this.#fail(failure);
		}
	}

	/** Upload the attached project now; a document with no key stays local. */
	async flush(): Promise<void> {
		if (!this.ready || !this.key) return;
		clearTimeout(this.#timer);
		await this.save();
	}

	/** Debounced upload after an edit; the page calls this on every change. */
	queue(): void {
		if (!this.ready || !this.key) return;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.save(), 2000);
	}

	attach(key: string | null): void {
		this.#setKey(key);
		this.sync = key ? 'saved' : 'idle';
	}

	/**
	 * The attachment survives a reload, so a public editor reopening on a
	 * server link goes on saving to the same project without a trip through
	 * the dialog. The store it belongs to is recorded with it.
	 */
	#setKey(key: string | null): void {
		this.key = key;
		try {
			if (key) {
				localStorage.setItem(ATTACHED_KEY, JSON.stringify({ provider: this.provider, key }));
			} else {
				localStorage.removeItem(ATTACHED_KEY);
			}
		} catch {
			// A full quota only costs the memory; the session stays attached.
		}
	}
}

export const projects = new Projects();
