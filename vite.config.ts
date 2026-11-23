import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { page_data } from '@mdsvex/plugin-page-data';
import { citations } from '@mdsvex/plugin-citations';
import { external_links } from '@mdsvex/plugin-external-links';
import { toc } from '@mdsvex/plugin-toc';
import { anchors } from '@mdsvex/plugin-anchors';
import { figures } from '@mdsvex/plugin-figures';
import { diagram } from '@mdsvex/plugin-diagram';
import { code_blocks } from '@mdsvex/plugin-code-blocks';
import { tabs } from '@mdsvex/plugin-tabs';
import { steps } from '@mdsvex/plugin-steps';
import { elements } from '@mdsvex/plugin-elements';
import { callouts } from '@mdsvex/plugin-callouts';
import { mdsvex } from 'mdsvex';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		mdsvex({
			heading_ids: true,
			unwrap_images: true,
			plugins: [
				callouts(),
				elements(),
				steps(),
				tabs(),
				code_blocks(),
				diagram(),
				figures(),
				anchors(),
				toc(),
				external_links(),
				citations(),
				page_data()
			]
		}),

		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Cloudflare Pages serves the built SPA: one fallback page, no server.
			adapter: adapter({ pages: 'dist', fallback: 'index.html', strict: false })
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						// Use the locally installed Edge; never download a browser.
						provider: playwright({ launchOptions: { channel: 'msedge' } }),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
