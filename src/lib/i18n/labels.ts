import { m } from '#lib/paraglide/messages.js';
import type { BoardType } from '#lib/sketch/types';

/** Localised label for a part category from the registry. */
export function categoryLabel(category: string): string {
	switch (category) {
		case 'Boards':
			return m.category_boards();
		case 'Lights':
			return m.category_lights();
		case 'Displays':
			return m.category_displays();
		case 'Passives':
			return m.category_passives();
		case 'Sensors':
			return m.category_sensors();
		case 'Switches':
			return m.category_switches();
		case 'Audio':
			return m.category_sound();
		case 'Actuators':
			return m.category_actuators();
		case 'Power':
			return m.category_power();
		case 'Logic':
			return m.category_logic();
		case 'Storage':
			return m.category_storage();
		case 'Radio':
			return m.category_radio();
		case 'Modules':
			return m.category_modules();
		case 'Custom':
			return m.category_custom();
		default:
			return category;
	}
}

/** Localised name for a palette colour, used as its accessible label. */
export function colorLabel(name: string): string {
	switch (name) {
		case 'red':
			return m.color_red();
		case 'orange':
			return m.color_orange();
		case 'yellow':
			return m.color_yellow();
		case 'green':
			return m.color_green();
		case 'blue':
			return m.color_blue();
		case 'purple':
			return m.color_purple();
		case 'grey':
			return m.color_grey();
		case 'black':
			return m.color_black();
		case 'white':
			return m.color_white();
		default:
			return name;
	}
}

/** Localised name for a breadboard size. */
export function boardName(type: BoardType): string {
	return type === 'breadboard-full' ? m.breadboard_full_name() : m.breadboard_half_name();
}
