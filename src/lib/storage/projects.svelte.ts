/**
 * Projects kept in the user's own S3 bucket.
 *
 * The bucket is the storage; localStorage stays the offline mirror every edit
 * already writes. Credentials live in this browser only, because there is no
 * server here to hold them: the page signs its own requests.
 */
import { m } from '#lib/paraglide/messages.js';
import { doc } from '#lib/sketch/doc.svelte';
import {
	configured,
	EMPTY_SETTINGS,
	objectKey,
	projectName,
	S3Store,
	type S3Settings,
	type StoredProject
} from './s3';

const SETTINGS_KEY = 'litz.storage.v1';

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
	/** Objects under the prefix, newest first. */
	items = $state<StoredProject[]>([]);
	/** Object key of the project this document is attached to, or null. */
	key = $state<string | null>(null);
	listing = $state(false);
	saving = $state(false);
	error = $state<string | null>(null);
	sync = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	#timer: ReturnType<typeof setTimeout> | undefined;

	get ready(): boolean {
		return configured(this.settings);
	}

	#store(): S3Store {
		return new S3Store(this.settings);
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
			await this.#store().list();
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
			this.items = await this.#store().list();
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
			const text = await this.#store().text(item.key);
			if (!doc.loadProject(text)) {
				this.error = m.projects_invalid();
				return false;
			}
			this.key = item.key;
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
		const target = name?.trim() ? objectKey(name, this.settings.prefix) : this.key;
		if (!target) return false;
		this.saving = true;
		this.sync = 'saving';
		this.error = null;
		try {
			// The object name is the document's name, so a save under a new
			// name renames the tab as well and the file and its title agree
			// when it is opened again.
			if (name?.trim()) doc.renameTab(projectName(target, this.settings.prefix));
			await this.#store().put(target, doc.projectJSON());
			this.key = target;
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
			await this.#store().remove(item.key);
			if (this.key === item.key) {
				this.key = null;
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
		this.key = key;
		this.sync = key ? 'saved' : 'idle';
	}
}

export const projects = new Projects();
