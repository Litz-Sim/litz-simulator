# Litz Breadboard

Litz Breadboard is a browser-based breadboard editor built on the Litz simulation engine. The editing flow follows Wokwi, wires are strictly orthogonal like Fritzing, and the canvas layout takes cues from LCEDA (EasyEDA). You place boards and parts on a virtual breadboard, wire them up, and the editor derives the `diagram.json` that Litz consumes.

Everything runs client-side. Simulation uses [`@litz-sim/litz`](https://www.npmjs.com/package/@litz-sim/litz) 0.3 compiled to WebAssembly: pressing Run boots one chip per board on the canvas, all chips share the same circuit, and serial output, LEDs, buttons, and seven-segment displays update live. The `main.c` in the code panel is editable source only; the browser does not compile it.

## Quick start

You need Node 22 (pinned in `.node-version`) and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open <http://localhost:5173/editor>. The root path redirects there.

| Command        | What it does                                                |
| -------------- | ----------------------------------------------------------- |
| `pnpm dev`     | Start the Vite dev server.                                  |
| `pnpm check`   | Run `svelte-check` over the project.                        |
| `pnpm test`    | Run unit and component tests; browser tests use local Edge. |
| `pnpm lint`    | Check formatting with Prettier and lint with ESLint.        |
| `pnpm build`   | Build the static site into `dist/`.                         |
| `pnpm preview` | Serve the production build locally.                         |

## Editor

### Breadboards and parts

The canvas supports full-size (830-hole) and half-size (400-hole) breadboards. Holes, power rails, column numbers, and row letters are drawn to scale.

The part library has about 175 entries: development boards, lights and displays, passives, switches and inputs, sensors, motors and drivers, logic ICs, communication and storage, and power. Part names, pins, and attributes are kept aligned with the Litz catalog.

Supported boards include ESP32-C3/C6, ESP32-P4, ESP32-S31, Arduino Uno/Nano/Pro Mini, Raspberry Pi Pico, and the Litz RV32 reference board.

### Placing and moving

Click a part in the library or drag it onto the canvas. Parts snap to nearby holes, and a part pressed into a breadboard becomes part of that net.

You can marquee-select, Shift-click to add to the selection, and drag a whole selection at once. The usual editing actions are available: undo and redo, copy and paste, duplicate in place, arrow-key nudging, and 90° rotation. Tabs let several circuits live side by side.

### Wiring

The wire tool draws horizontal and vertical segments only. Wires run between part pins and breadboard holes, and the nine-color palette keeps a busy board readable.

Dragging a wire segment moves its middle channel, which is stored as the `bend` value in the document. Wires that cross boards connect the boards into one shared net.

### Code panel

The bottom Code tab embeds CodeMirror. A file browser on the left lists each development board's storage next to the project's own files. `main.c` is editable and kept per tab. `diagram.json` is read-only and regenerated from the canvas on every change, so you can inspect exactly what the simulator receives.

A board running MicroPython or CircuitPython shows its files as Python, with the entry file marked. Files can be added and deleted; they are stored in the document, not in the browser. Completion covers C, common ESP-IDF APIs (GPIO, FreeRTOS, macros, and snippets), Python (`time`, `machine`, `board`, `microcontroller`), and identifiers already present in the document. The top edge of the bottom panel can be dragged to resize it.

### Touch and narrow screens

On a tablet, one finger selects and drags parts. Dragging empty canvas pans, and two fingers pinch to zoom while panning. Hit targets and control sizes are enlarged for touch.

Below the `xl` breakpoint, the parts library and inspector collapse into drawers. On touch screens with limited height, the bottom panel also starts shorter so the canvas stays usable in portrait.

### Language

The interface ships in English and Chinese. Switch with the Language menu; strings live in `messages/en.json` and `messages/zh.json` and are compiled by Paraglide.

## Saving and exporting

| Output              | Where                                      | Contents                                                                   |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Workspace           | Automatic, browser `localStorage`          | Every tab with code, layout, wires, and view state.                        |
| Project file        | File → Export project                      | `.litzproject.json` with every tab, ready to import elsewhere.             |
| Single-tab document | File → Export JSON                         | `.litzboard.json` for the active tab, with layout and wire bends, no view. |
| Litz diagram        | Code tab → `diagram.json`                  | Read-only JSON generated for the simulator.                                |
| Image               | File → Export PNG                          | PNG of the current canvas.                                                 |
| Waveform trace      | Simulation → Export VCD, or Analysis panel | VCD of net transitions during the session.                                 |

The workspace is written to `localStorage` under `litz-board.workspace.v1` after every edit. The status bar shows whether the workspace is saved, has unsaved changes, or failed to save. <kbd>⌘S</kbd> / <kbd>Ctrl+S</kbd> or File → Save project writes immediately.

Browser storage is local to one browser and one origin. It does not sync between devices, and clearing site data removes it. The workspace stays under 5 MB; uploaded firmware lives separately in IndexedDB, keyed by content hash. Export a project file to back up or move a workspace, and keep the original image files to restore their references elsewhere.

File → Import project replaces the entire workspace with the file's tabs. If the file is not a valid Litz project, the status bar reports the error and the current workspace is left untouched. File → Import JSON replaces the active tab's diagram with a `.litzboard.json` document and fits it to the viewport.

## File formats

### Project files

A `.litzproject.json` file is a thin wrapper around tabs. Each tab stores its code and a complete `litz-board` document, including the editor-only `view` field:

```json
{
	"format": "litz-project",
	"version": 1,
	"name": "Blink",
	"active": 0,
	"tabs": [
		{
			"id": "t1",
			"name": "Blink",
			"code": "// main.c\n",
			"sketch": {
				"format": "litz-board",
				"version": 1,
				"grid": 20,
				"boards": [],
				"parts": [],
				"wires": [],
				"view": { "panX": 3, "panY": 4, "zoom": 2 }
			}
		}
	]
}
```

`active` is the index of the open tab. Import restores the tab order, active tab, code, layout, wire bends, and view, so the project opens exactly where it was left.

### Board documents

The editor uses its own `litz-board` format because Litz's `diagram.json` has nowhere to store wire shapes, part rotation, or canvas positions:

```json
{
	"format": "litz-board",
	"version": 1,
	"grid": 20,
	"boards": [{ "id": "bb1", "type": "breadboard-full", "x": 0, "y": 0, "rotate": 0 }],
	"parts": [
		{ "id": "p1", "type": "litz-led", "x": 410, "y": 98, "rotate": 0, "attrs": { "color": "red" } }
	],
	"wires": [
		{
			"id": "w1",
			"from": { "kind": "pin", "part": "p1", "pin": "A" },
			"to": { "kind": "hole", "board": "bb1", "col": 18, "row": 7 },
			"color": "#c8352c",
			"bend": [{ "u": 0.5, "v": -26 }],
			"style": "ortho"
		}
	],
	"programs": {
		"p2": {
			"runtime": "micropython",
			"firmware": null,
			"rom": null,
			"boot": null,
			"ptable": null,
			"files": [{ "name": "main.py", "text": "print('hello')\n" }]
		}
	}
}
```

`programs` is keyed by part id and exists only for development boards that have been configured. An uploaded image appears as `{ "name": "custom.bin", "key": "…" }`; the bytes stay in IndexedDB, so importing a project on another browser asks for the file again.

Coordinates are canvas units where 20 units equal 0.1 inch, one breadboard pitch. Wires have only horizontal and vertical runs; `bend[].u` positions the middle channel along the chord, and `v` is retained for older files.

When the editor builds `diagram.json`, `src/lib/sketch/export.ts` flattens the visual document. Holes in the same column, holes on the same power rail, pins pressed into holes, and explicit wires are merged into nets first. Junctions are then emitted as pairwise connections, so a three-way node becomes three `connections` entries. The result is what the simulator receives.

## Simulation

### Running a session

Run starts a WebAssembly session and boots every board on the canvas. Each board runs its own chip, and all boards share the circuit formed by the wires. The Run button lives in the header; the Simulation menu adds pause, continue, stepping, restart, analog solve, speed from 0.25× to 4× or as fast as possible, and VCD export.

### Board programs

Every development board picks its own program in the inspector's Program section. The choice is per board, so one canvas can mix a C firmware and two Python boards.

| Runtime       | Boots from                                          | Built-in images                                                            |
| ------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Native        | The image you upload or the packaged blinky fixture | ESP32-C3 `blinky.bin`, ATmega328P `uno-blink.hex`, RP2040 `pico-blink.bin` |
| MicroPython   | `main.py` on the board's storage                    | ESP32-C3 `micropython-esp32c3.bin`, RP2040 `micropython-rp2040.bin`        |
| CircuitPython | `code.py` on the board's storage                    | ESP32-C3 `circuitpython-esp32c3.bin`                                       |

A board with no matching built-in image needs an uploaded one. Uploads accept `.bin`, `.hex`, `.elf`, or `.uf2` and are cached in IndexedDB under a content hash; the document keeps only the file name and hash, so exporting a project does not embed megabytes of firmware. Files larger than the browser's storage quota fall back to the in-memory copy for the current tab. ESP32 boards that run a merged Python image also need a Mask ROM ELF; the packaged images pair one automatically.

The classic ESP32 line runs its own bootloader first. Upload a bootloader and partition table together with the Mask ROM; that combination only applies when the diagram has one board, because the engine carries one bootloader per session.

Program files belong to the board, like files on a real device. Files are written to the simulated storage when the session starts: the editor waits for the interpreter's prompt, writes every file over the raw REPL, then resets the interpreter so its normal boot sequence runs `main.py` or `code.py`. On the RP2040 the entry file is executed from the raw REPL instead, because the engine has no second core for MicroPython's soft reset to synchronize with. Staging output is hidden from the Serial panel, which shows only what the program prints. A board with no entry file reports it instead of running.

### Multiple boards

A session can hold any number of boards. Each board has its own UART, GPIO state, display buffer, firmware, and storage, so one board's serial output does not appear on another's console.

Each board boots its own image; a board that has no uploaded or built-in image stops the run with an error rather than borrowing another board's firmware. The display panel draws the first board's framebuffer.

### Bottom panels

| Panel     | Purpose                                                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code      | Edit `main.c`; inspect the generated `diagram.json`.                                                                                                                                    |
| Serial    | Live console for one board at a time, with tabs to switch boards when the session has several. ANSI colors, auto-scroll, and text sent to the shown board. The badge shows 115200 baud. |
| Plot      | Plot up to four numeric channels parsed from the selected board's serial output.                                                                                                        |
| Analysis  | Chip, clock, flash, heap, stop reason, fault, electrical conflicts, GPIO levels, probes, waveforms, protocol decoders, and VCD export.                                                  |
| Debug     | RISC-V instruction stepping, registers, disassembly, breakpoints, and memory.                                                                                                           |
| Manifests | Edit custom TOML part and board descriptions; saved in browser storage and passed to the engine on restart.                                                                             |
| Log       | Timestamped engine events, including errors.                                                                                                                                            |

The Analysis panel reads GPIO levels through hidden probes, so it works for every board. Clicking a pin attaches a named probe. Each probe reports frequency, duty cycle, voltage range, and a digital waveform. Adding a UART, I²C, or SPI decoder shows decoded frames alongside the waveform. User probes and decoders are reattached automatically after a restart.

### Debugger

The Debug panel works on RISC-V boards (ESP32-C3/C6/P4/S31). Pick a board when the canvas has more than one, then step a single instruction or continue until a breakpoint or step budget is reached. The panel shows `x0`–`x31` and `pc`, a disassembly listing, and hexadecimal memory.

Click any disassembly line to toggle a breakpoint at its address; addresses can also be entered manually. Hitting a breakpoint while running pauses the session automatically. This debugger reads and writes machine state directly inside the browser and does not use the GDB protocol.

### Interactive devices

Canvas devices drive the running session directly. Push buttons can be pressed, switches flipped or tilted, potentiometers dragged, and OLEDs tapped.

The inspector exposes device-specific controls and live state: distance for an HC-SR04, temperature and humidity for an NTC or DHT22, light level for a photoresistor module, voltage and current limit for a bench supply, shaft position for an encoder, axes for a joystick, and keys for a membrane keypad.

## Keyboard shortcuts

| Key             | Action                                      |
| --------------- | ------------------------------------------- |
| `V` / `W`       | Select tool / wire tool                     |
| `A`             | Open the add-part dialog                    |
| `R`             | Rotate selection 90°                        |
| `Delete`        | Delete selection                            |
| `⌘D` / `Ctrl+D` | Duplicate in place                          |
| `⌘C` / `⌘V`     | Copy / paste                                |
| `⌘Z` / `⇧⌘Z`    | Undo / redo                                 |
| `⌘A` / `Ctrl+A` | Select all                                  |
| `⌘S` / `Ctrl+S` | Save the workspace now                      |
| Arrow keys      | Move 20 units; hold Shift to move 100 units |
| Space + drag    | Pan the canvas                              |
| Mouse wheel     | Zoom around the pointer                     |
| `F`             | Fit the diagram to the viewport             |

## Limitations

- Built-in native firmware exists only for ESP32-C3, ATmega328P, and RP2040. C6/P4/S31 boards need a matching `.bin`, and the Litz RV32 board needs a WebAssembly MCU component.
- MicroPython on the RP2040 runs the entry file from the raw REPL rather than through a soft reset, so a program that returns leaves the interpreter in raw mode instead of at the friendly prompt.
- Classic ESP32 and ESP32-S3 are Xtensa. The current WebAssembly build does not include those cores, so the part library omits both boards.
- Only RISC-V targets support register-level debugging. AVR and RP2040 boards have no debugger.
- `main.c` is not compiled in the browser. Building firmware requires an external toolchain or build service.
- There is no project sharing, cloud storage, account system, or CI pipeline.
- Uploaded firmware is cached per browser. Opening a project on another browser or after clearing site data requires uploading the image again.
- The display panel shows the first board's screen.
- Flash size and MAC address are available from the engine API but are not exposed in the UI.

## Deployment

The site is a static SPA and deploys to Cloudflare Pages without a Workers runtime:

| Setting                | Value                        |
| ---------------------- | ---------------------------- |
| Build command          | `pnpm build`                 |
| Build output directory | `dist`                       |
| Node version           | 22 (`.node-version` pins it) |

`adapter-static` emits `index.html` as the SPA fallback. `static/_redirects` sends unknown paths to the client router, and `static/_headers` caches hashed assets under `_app/immutable/` for a year. Cloudflare Pages serves the WASM binary with `application/wasm`; firmware images in `static/firmware/` are published with the rest of the site.

To upload a build without Git integration:

```sh
pnpm build
npx wrangler pages deploy dist
```

## Project layout

```
src/lib/sketch/              document types, edit operations, geometry, wires, export
src/lib/parts/               part definitions and Canvas drawing
src/lib/canvas/              Canvas 2D engine, viewport, input state
src/lib/components/editor/   menus, toolbar, tabs, parts library, canvas, inspector, bottom panel
src/lib/sim/                 Litz WASM backend, run controller, firmware cache, Python staging
static/firmware/             built-in native images and Python interpreters
```

The editor draws everything on a single Canvas 2D layer. Parts and wires are rendered directly by `src/lib/canvas/engine.ts`; there are no DOM nodes per component, so zooming and panning are redraws rather than CSS transforms.
