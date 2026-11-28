import { m } from '#lib/paraglide/messages.js';
import { blinkySketch } from './examples';
import {
	buttonLedSketch,
	oledSketch,
	plotSketch,
	potSketch,
	trafficLightSketch
} from './examples-extra';
import { logicAnalyzerSketch, supplySketch } from './examples-more';
import type { Sketch } from './types';

export interface Example {
	id: string;
	/** Read when asked, so the label follows the current locale. */
	name: () => string;
	build: (name: string) => Sketch;
	/** The circuit only means anything with the analog solve on. */
	analog?: boolean;
}

/** What the Examples dialog offers, in the order it lists them. */
export const EXAMPLES: Example[] = [
	{ id: 'blinky', name: m.example_blinky_name, build: blinkySketch },
	{ id: 'pot', name: m.example_pot_name, build: potSketch },
	{ id: 'plot', name: m.example_plot_name, build: plotSketch },
	{ id: 'button', name: m.example_button_name, build: buttonLedSketch },
	{ id: 'oled', name: m.example_oled_name, build: oledSketch },
	{ id: 'traffic', name: m.example_traffic_name, build: trafficLightSketch },
	{ id: 'analyzer', name: m.example_analyzer_name, build: logicAnalyzerSketch },
	{ id: 'supply', name: m.example_supply_name, build: supplySketch, analog: true }
];
