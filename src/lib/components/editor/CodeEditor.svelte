<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		autocompletion,
		completeAnyWord,
		completeFromList,
		ifNotIn,
		snippetCompletion
	} from '@codemirror/autocomplete';
	import { indentWithTab } from '@codemirror/commands';
	import { cpp } from '@codemirror/lang-cpp';
	import { python } from '@codemirror/lang-python';
	import { EditorState } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { basicSetup } from 'codemirror';

	const IDF = [
		['gpio_reset_pin', 'gpio.h'],
		['gpio_set_direction', 'gpio.h'],
		['gpio_set_level', 'gpio.h'],
		['gpio_get_level', 'gpio.h'],
		['gpio_config', 'gpio.h'],
		['gpio_config_t', 'gpio.h'],
		['gpio_num_t', 'gpio.h'],
		['gpio_mode_t', 'gpio.h'],
		['GPIO_MODE_OUTPUT', 'gpio.h'],
		['GPIO_MODE_INPUT', 'gpio.h'],
		['GPIO_MODE_INPUT_OUTPUT', 'gpio.h'],
		['GPIO_PULLUP_ONLY', 'gpio.h'],
		['GPIO_PULLDOWN_ONLY', 'gpio.h'],
		['GPIO_NUM_0', 'gpio.h'],
		['GPIO_NUM_1', 'gpio.h'],
		['GPIO_NUM_2', 'gpio.h'],
		['GPIO_NUM_3', 'gpio.h'],
		['GPIO_NUM_4', 'gpio.h'],
		['GPIO_NUM_5', 'gpio.h'],
		['GPIO_NUM_6', 'gpio.h'],
		['GPIO_NUM_7', 'gpio.h'],
		['GPIO_NUM_8', 'gpio.h'],
		['GPIO_NUM_9', 'gpio.h'],
		['GPIO_NUM_10', 'gpio.h'],
		['GPIO_NUM_18', 'gpio.h'],
		['GPIO_NUM_19', 'gpio.h'],
		['GPIO_NUM_20', 'gpio.h'],
		['GPIO_NUM_21', 'gpio.h'],
		['vTaskDelay', 'FreeRTOS'],
		['pdMS_TO_TICKS', 'FreeRTOS'],
		['xTaskCreate', 'FreeRTOS'],
		['vTaskDelete', 'FreeRTOS'],
		['TaskHandle_t', 'FreeRTOS'],
		['portTICK_PERIOD_MS', 'FreeRTOS'],
		['printf', 'stdio.h'],
		['snprintf', 'stdio.h'],
		['sprintf', 'stdio.h'],
		['uint8_t', 'stdint.h'],
		['uint16_t', 'stdint.h'],
		['uint32_t', 'stdint.h'],
		['int32_t', 'stdint.h'],
		['bool', 'stdbool.h'],
		['true', 'stdbool.h'],
		['false', 'stdbool.h'],
		['NULL', 'stddef.h'],
		['app_main', 'ESP-IDF entry']
	] as const;

	const chipSources = completeFromList([
		...IDF.map(([label, detail]) => ({ label, detail, type: 'constant' })),
		snippetCompletion('gpio_set_direction(${pin}, GPIO_MODE_OUTPUT);', {
			label: 'gpio_set_direction()',
			detail: 'gpio.h',
			type: 'function'
		}),
		snippetCompletion('gpio_set_level(${pin}, ${1});', {
			label: 'gpio_set_level()',
			detail: 'gpio.h',
			type: 'function'
		}),
		snippetCompletion('vTaskDelay(pdMS_TO_TICKS(${ms}));', {
			label: 'vTaskDelay()',
			detail: 'FreeRTOS',
			type: 'function'
		}),
		snippetCompletion('while (1) {\n\t${}\n}', {
			label: 'while (1)',
			detail: 'main loop',
			type: 'keyword'
		}),
		snippetCompletion('void app_main(void) {\n\t${}\n}', {
			label: 'app_main',
			detail: 'entry point',
			type: 'function'
		})
	]);

	const PYTHON = [
		['print', 'built-in'],
		['time.sleep', 'time'],
		['machine.Pin', 'machine'],
		['machine.reset', 'machine'],
		['microcontroller.reset', 'microcontroller'],
		['board.GPIO', 'board']
	] as const;

	const pythonSources = completeFromList([
		...PYTHON.map(([label, detail]) => ({ label, detail, type: 'function' })),
		snippetCompletion('import time\n\nwhile True:\n    ${}\n    time.sleep(1)', {
			label: 'while True',
			detail: 'main loop',
			type: 'keyword'
		})
	]);

	let {
		value,
		readonly = false,
		language = 'c',
		onchange
	}: {
		value: string;
		readonly?: boolean;
		language?: 'c' | 'python';
		onchange?: (text: string) => void;
	} = $props();

	let host: HTMLDivElement;
	let view: EditorView | null = null;

	onMount(() => {
		const syntax = language === 'python' ? python() : cpp();
		const completion =
			language === 'python'
				? autocompletion({ override: [pythonSources, completeAnyWord] })
				: autocompletion({
						override: [
							chipSources,
							ifNotIn(
								IDF.map(([label]) => label),
								completeAnyWord
							)
						]
					});
		const extensions = [basicSetup, syntax, completion, EditorView.lineWrapping];
		if (readonly) {
			extensions.push(EditorState.readOnly.of(true));
		} else {
			extensions.push(
				keymap.of([indentWithTab]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) onchange?.(update.state.doc.toString());
				})
			);
		}
		view = new EditorView({
			parent: host,
			state: EditorState.create({ doc: value, extensions })
		});
	});

	$effect(() => {
		const text = value;
		if (view && view.state.doc.toString() !== text) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
		}
	});

	onDestroy(() => {
		view?.destroy();
		view = null;
	});
</script>

<div bind:this={host} class="h-full min-h-0 overflow-hidden text-[12px]"></div>

<style>
	:global(.cm-editor) {
		height: 100%;
	}
	:global(.cm-editor.cm-focused) {
		outline: none;
	}
	:global(.cm-scroller) {
		overflow: auto;
	}
</style>
