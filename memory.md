# memory.md, state log

Facts that are true about this project and are not derivable from the code. Append, date, never rewrite history. The coding model adds a line under § Decisions whenever it decides something the documents did not cover.

## Clinical constraints (final, 2026-09-03)

- Rotation: 28 days, Monday 08:00 to Monday 08:00 four weeks later. Start date is always a Monday; end date is derived, never edited.
- Two shifts per calendar day: DAY 08:00-20:00, NIGHT 20:00-08:00. 56 slots per rotation.
- Interns: 4 to 8. Each does exactly 8 DAY and 8 NIGHT, 16 total, whatever N is. Nobody ever gets a 17th shift.
- Rest rules: no DAY the morning after a NIGHT; two nights of the same intern at least 3 day-indices apart (two full calendar days off); no DAY and NIGHT on the same date. DAY on d then NIGHT on d+1 is legal (24 h rest). Consecutive DAY shifts are legal without limit. A NIGHT on day 27 has no post-night check (next rotation not modelled).
- Staffing: a user-set "minimum per shift" (1..4, default `max(1, floor(16N/56))`), revisable at any time; slots below it are warnings, empty slots are warnings with a different message, 4 or more interns in a slot is information. Nothing is ever blocked.
- Not modelled, on purpose: unavailable dates, weekend fairness, public holidays, several rotations at once, carry-over from the previous rotation.

## Arithmetic (verified by computation, 2026-09-03)

| N | assignments | average per slot | default min | note |
|---|---|---|---|---|
| 4 | 64 | 1.14 | 1 | most slots single-covered, 8 slots double |
| 5 | 80 | 1.43 | 1 | |
| 6 | 96 | 1.71 | 1 | a target of 2 leaves at least 16 slots short |
| 7 | 112 | 2.00 | 2 | exactly 2 everywhere is the ideal |
| 8 | 128 | 2.29 | 2 | about 16 slots will hold 3 |

- Valid 8-night patterns for one intern in 28 days with gap ≥ 3: C(14, 8) = 3 003.
- After 8 nights an intern has 12 legal DAY dates (13 when a night falls on day 27); 8 are needed, so the day step never fails without locks.
- "No empty slot" is achievable at N = 4 under all the rest rules. A witnessed night cover: interns' night sets `{0,3,6,9,12,15,23,27}`, `{4,7,10,13,17,20,23,26}`, `{1,4,7,11,16,19,22,25}`, `{2,5,8,11,14,18,21,24}` cover all 28 nights, and every DAY slot then has at least one intern with that date legal. So the solver's `UNDER_STAFFED` penalty is a real target, not a hope.
- A "minimum 2 per shift" rule fixed regardless of N would fire on most of the board for N ≤ 6. This is why the target is user-set and why the setup card prints the average.
- Solver prototype (Python, same algorithm as SPEC §5, 2026-09-03): plain hill-climbing left 8 short slots at N = 7 / target 2 and one empty slot at N = 4. Simulated annealing with plateau acceptance, 4 restarts × 300 000 moves, cooling 3 → 0.05, 30 % guided moves reached the arithmetic optimum on every seed for N = 4, 5, 6, 8 and all-slots-at-2 on 8/8 seeds for N = 7. Cooling length mattered more than restarts (2 × 60 000 was worse than 4 × 30 000; 4 × 300 000 was perfect). Lock handling verified: 20 % pins kept with the rest still valid; two pinned nights one day apart kept and reported; nine pinned nights → nothing added.

## Decisions

- 2026-09-03 Stack: Vite + React 19 + TypeScript strict + Tailwind 4, `@dnd-kit`, `react-day-picker` + `date-fns`, `html-to-image`, SheetJS `xlsx`, Vitest. Next.js rejected (no server-side need, complicates `html-to-image`).
- 2026-09-03 Solver: per-intern construction (randomised DFS for nights, random pick for days) then simulated annealing on a soft cost (staffing target, evenness, density cap, weekly spread) with plateau moves and guided moves. Hard rules hold by construction, staffing is soft. Plain hill-climbing rejected after the prototype showed it stalls; slot-first greedy rejected (dead-ends); constraint-solver library rejected (overkill). Deterministic under a seed; runs in a Web Worker.
- 2026-09-03 Board layout: continuous 4 × 7 week grid, Monday to Sunday, because the rotation is Monday-anchored there are no padding days. The month-block wall-calendar layout was considered and rejected as clutter. The date picker is where dimmed non-rotation days appear.
- 2026-09-03 Locks: any placement can be pinned; randomize fills around pins and treats them as fixed; reset offers "keep locked".
- 2026-09-03 Views: calendar (editable) and matrix (read-only); both export to PNG; Excel carries both plus a summary.
- 2026-09-03 Persistence: localStorage autosave, JSON file in and out, share link with the whole schedule in the URL hash (fixed-width `0/1/2` grid, no compression library). Static hosting (Netlify) like the Sivas map.
- 2026-09-03 Intern palette: 8 fixed hues, red excluded so nothing on a printed board reads as an error. Contrast verified ≥ 4.6:1 for chip text on chip tint in both themes.
- 2026-09-03 Language: interface TR/EN with a runtime switch, default TR. All documents and code comments in English.
- 2026-09-03 Undo/redo covers assignment-level actions only; name edits, target and date changes are not in the history.
- 2026-09-03 Quota-incomplete is shown as progress (info group, chip counts), not as red errors, because it is the normal state while a board is being filled.
- 2026-09-03 Weekday names come from the date-fns `tr` locale, with one correction: date-fns abbreviates Cumartesi as `Cts`, TDK writes `Cmt`, so `formatDay` rewrites that token for Turkish. No other locale output is hand-edited.

- 2026-09-03 TypeScript pinned to 5.9 rather than 7.0: `typescript-eslint` 8.69 declares `typescript >=4.8.4 <6.1.0`, so the toolchain would have no linter on TS 7. Revisit when typescript-eslint supports it.
- 2026-09-03 Solver default `moves` raised from 300 000 to 400 000. At 300 000 the N = 7 / target 2 case reached a perfect board on only 13 of 20 seeds in JavaScript (the Python prototype's RNG differs). Measured sweep: 400 000 x 4 restarts is perfect on 20 of 20 seeds and *faster* on average (265 ms vs 370 ms) because an ideal board stops the restart loop early. 600 000 was worse than 400 000; lowering t0 to 2 collapsed quality to 1 of 20.
- 2026-09-03 `decodeHash` returns assignments in the canonical order `solve()` emits (day, then DAY before NIGHT, then intern index) instead of grouped by intern, so the SPEC section 7.2 round-trip property holds against solver output.
- 2026-09-03 `xlsx` and `html-to-image` are dynamic imports. SheetJS alone is 424 kB; loading it only when someone exports keeps the first paint at 403 kB (124 kB gzipped).
- 2026-09-03 `buildWorkbook(XLSX, schedule, lang)` takes the SheetJS module as an argument so it stays pure and synchronous while the module itself loads on demand.
- 2026-09-03 Tooltip is a hook (`useTooltip`) rather than a wrapper component. `cloneElement` with a `ref` is rejected by eslint-plugin-react-hooks 7 and would have clobbered the dnd-kit refs on chips and zones; the hook returns handlers the consumer spreads, and the anchor comes from the event.
- 2026-09-03 Popovers take a ref object (`anchorRef`), not `anchor={ref.current}`. Reading a ref during render is a React Compiler-era lint error and is genuinely unsound.
- 2026-09-03 Boot lives in `state/boot.ts` and is read through `useState(() => readBoot())`, not in an effect. Calling setState synchronously inside an effect is a lint error, and SPEC section 8's boot order belongs in one place anyway.
- 2026-09-03 An empty slot gets a neutral dashed hairline outline, not the amber dashed outline DESIGN section 3 specifies. On a fresh board every one of the 56 slots is empty and 56 amber boxes is exactly the alarm that rule exists to avoid. Amber is kept for a slot that has people in it but is still below target, which is the case the colour is actually about.
- 2026-09-03 `document.documentElement.lang` follows the interface language. The 11 px micro labels use CSS `text-transform: uppercase`, which is locale-aware: with `lang="tr"` the English word "optional" would have uppercased to "OPTİONAL".
- 2026-09-03 The print scale is measured, not assumed. A fixed `scale(277mm / 1600px)` fits 6 interns (180 mm tall) but an 8-intern board is 1205 px tall and would have needed 197 mm, spilling onto a second page. `printSchedule` measures the mounted frame and sets `--print-scale` so it fits 277 x 190 mm in both directions.
- 2026-09-03 Export frame settling no longer waits on `requestAnimationFrame` alone; rAF never fires in a hidden tab, so an export started just before the user switched away hung forever and leaked the off-screen container. Both waits now race a timer.
- 2026-09-03 The matrix and the export frame head their columns with the three-letter weekday (`EEE`), not the one-letter form: in Turkish Pazartesi, Perşembe and Pazar all narrow to "P".
- 2026-09-03 The day-picker's own two-letter weekday names bypass the `Cts` to `Cmt` correction, so `PeriodCard` supplies `formatWeekdayName` from `weekdayLabels()`.
- 2026-09-03 18 interface keys were added beyond SPEC section 9 (Excel sheet and column names, the manual-copy dialog, the overflow menu, three aria labels). They are marked as such in both dictionaries.

## Edge cases the code must handle

- Changing the start date after assignments exist: assignments are index-based, they stay; only labels change.
- Shrinking the intern count when the removed interns hold assignments: confirm, then drop those assignments (undoable).
- Contradictory locks (for example two locked nights one day apart): solver still returns a full schedule; `validate()` reports `NIGHT_GAP`.
- Locks that make the quota impossible (nine locked nights): solver keeps them, adds nothing for that type, `QUOTA_OVER` appears.
- Same intern dropped twice into one slot: refused structurally with a shake, not a violation.
- Hash and stored draft both present on boot: confirm before replacing a non-empty draft; silent load otherwise.
- Corrupted hash or file: toast, page keeps working, hash left untouched.
- Clipboard unavailable (http origin, iframe): dialog with a selectable text field.
- `history.replaceState` throws in null-origin contexts: try/catch, otherwise the first click locks the page.
- DST: a rotation spanning the last Sunday of October or March; `dateOf` uses date-fns `addDays` on local dates, never adds milliseconds.
- Names with Turkish characters in the hash: base64url over UTF-8, never `btoa` on the raw string.
- Turkish casing: never locale-blind `toUpperCase` / `toLowerCase`.

## Library caveats

- `html-to-image` on Safari can return a blank PNG on the first call; call twice and keep the second. Fonts must be self-hosted (Google Fonts CSS is cross-origin and gets skipped).
- SheetJS on npm is 0.18.5 and unmaintained there; sufficient for writing three plain sheets. The maintained tarball is at cdn.sheetjs.com if needed.
- `react-day-picker` 10 API matches 9: `mode="single"`, `disabled={{ dayOfWeek: [0,2,3,4,5,6] }}`, `modifiers={{ range }}`, `weekStartsOn={1}`, `locale={tr}`. Check the installed version's docs before relying on prop names.
- Tailwind 4 has no `tailwind.config.js`; tokens go through `@theme` in CSS and dark mode through a `data-theme` variant (`@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`).
- `@dnd-kit` `PointerSensor` needs an activation distance or every click on a chip starts a drag and swallows the popover click.
- date-fns 4.1 `tr` locale: `EEE` gives `Paz Pzt Sal Çar Per Cum Cts` (verified from the package source, 2026-09-03); month abbreviations `Oca Şub Mar Nis May Haz Tem Ağu Eyl Eki Kas Ara` match TDK.

## QA, 2026-09-03

`npm run check` green: eslint 0 problems, 81 tests in 19 files, production build 403 kB main chunk (124 kB gzipped) plus a 424 kB SheetJS chunk that only loads on an Excel export.

Verified by hand in a real browser (Playwright, Chromium) against SPEC section 12:

| Criterion | Result |
|---|---|
| 1-3 setup cards, gating, editable from the settings sheet | pass |
| 4 board renders 4 x 7 with both zones labelled | pass, 28 + 28 zones |
| 5 non-blocking drops, violations within a frame | pass, palette to slot, slot to slot, slot to palette all verified with synthetic pointer events; the illegal drop showed the error ring and was still accepted |
| 6 diagnostics name intern, date and reason, click scrolls and pulses | pass |
| 7 palette counts and complete state | pass |
| 8 randomize with no locks | pass, 6 and 8 interns both reach 8/8 + 8/8 with "Sorun yok"; 8 interns produce the expected 3-deep slots |
| 9 randomize keeps locks | covered by solver tests, 20 seeds |
| 10 shuffle changes only names | covered by reducer and shuffle tests |
| 11 reset confirmation with keep-locked | pass |
| 12 undo and redo | pass, including after randomize |
| 13 PNG 4800 x 3120 with real fonts, Excel three sheets, print one A4 landscape page | PNG and Excel pass. Print was **wrong when first ticked**: the frame was scaled with `transform`, which leaves the layout box at full size, so Chrome paginated at the unscaled height and produced two pages. Measuring the painted size, as this row originally did, cannot see that. Fixed with `zoom` and re-verified the honest way: the real mounted frame printed through headless Chrome `--print-to-pdf` gives **1 page**, A4 landscape 841.92 x 594.96 pt, with the whole board and no application chrome on it |
| 14 share link reopens the same board on a clean profile | pass, 96 chips, locks preserved; corrupted link toasts and leaves the app working |
| 15 reload restores the draft, language and theme apply instantly | pass |
| 16 375 px usable, no horizontal scroll | pass, `scrollWidth === innerWidth` at 375 and 390 |
| 17 keyboard-only assign, lock, remove, undo | pass |
| 18 prefers-reduced-motion | rule present in app.css, stagger and pulse collapse to a 120 ms fade |

## Review round, 2026-09-03

An eight-lens adversarial review (engine, state, design, accessibility, Turkish, React, robustness, clinical) with an independent verifier per lens confirmed 41 findings and rejected 9. What it caught that testing had not:

- **Blocker.** `useFocusTrap` listed `onClose` in its dependency array. Every overlay passes an inline arrow, so any state change while the settings sheet was open tore the trap down and rebuilt it, moving focus to the sheet's close button. A name could be typed one character per click. Fixed by holding `onClose` in a ref and depending only on `[ref, open]`.
- **A name with a space could not be typed at all.** The reducer trimmed on every keystroke of a controlled input, so the space in "Ayşe Yılmaz" was swallowed the moment it was typed. The trim now happens on blur; SPEC section 8 was corrected to say so.
- **The solver's 5 000-node search budget was too small when locked day shifts constrain the night search.** Measured: 396 failures in 20 000 seeds of the worst lock shape, producing a seven-night set and an incomplete quota. Raised to 20 000 (0 failures, peak 9 941 nodes) and SPEC section 5.1 updated. There is now a regression test for that lock shape.
- **Redo could resurrect a stale schedule.** The three non-undoable writes did not clear `future`, so undo, rename, redo lost the rename. Non-undoable edits are now applied to the current schedule *and* every history snapshot, so undo and redo can no longer move them.
- **Below 768 px there was no way to export, print, share a link, reset or shuffle.** The compact toolbar dropped them and the overflow menu never had them. The phone header now carries the export menu and the overflow holds shuffle and reset.
- **The focus ring flattened round controls.** An unlayered `:focus-visible` with `box-shadow` and `border-radius` outranks Tailwind's layered utilities, so a focused 44 px round stepper became a 6 px rectangle and lost its shadow. It is now an `outline` with a 2 px offset, which follows the element's own radius.
- **Escape closed every stacked overlay at once.** A module-level stack now gives it to the topmost only.
- Plus: randomize could keep assignments for interns removed while the worker ran (the draft was then rejected on the next boot and lost), a chosen staffing target was overwritten by the count stepper, a plain Cmd+P printed a blank page, diagnostics rows were dead in matrix view, chips carried dnd-kit's English screen-reader text instead of their own violation, `t()` substituted sequentially so a name shaped like a placeholder could be re-substituted, and a failed solve reported "Dosya okunamadı".

Nine claims were rejected on verification, among them "undo reverts names" (the history model SPEC section 8 mandates), the neutral outline on empty slots (a recorded decision), and the English singular/plural in `dialog.internCount.body` (verbatim from the normative dictionary; changing it needs a SPEC amendment first).

Measured contrast after the round, both themes, every sampled pair at or above 4.5:1:

| Pair | Light | Dark |
|---|---|---|
| page title | 16.1 | 15.6 |
| date range, zone hour label, checks title | 4.9 to 5.1 | 6.6 |
| chip label, worst of 96 chips | 5.1 | 4.7 |
| legend and week label | 4.7 | 7.1 |

## Second review round, 2026-09-03

Six agents re-checked every fix from the first round and hunted for regressions. 55 fixes confirmed correct, 17 new findings, three of them major and two of those caused by the fixes themselves:

- **The print fix did not work.** `transform: scale()` shrinks what is painted, not the layout box, so Chrome still broke the page at the frame's unscaled height and printed two sheets with the first one a third empty. The earlier acceptance tick measured painted size, which cannot see this. `zoom` scales layout and gives one page at every intern count. Lesson: a print claim has to be verified by counting pages in a real print-to-PDF, not by arithmetic on the painted box.
- **Splitting the animation token was half done.** Making the fill token permanent stopped the unwanted remount but left the stagger flag on forever, so any chip placed later inherited a delay of up to 660 ms and sat invisible until it fired. The remount key and the stagger flag are now two separate values.
- **Moving the name trim to blur opened a hole.** Escape closes the settings sheet by unmounting the focused input, which fires no blur, so a whitespace-only name survived; `internLabel` then treated it as a real name and every chip, export and share link carried a blank label. Names are now trimmed in `internLabel` and by `withTrimmedNames` at the three places a schedule leaves the app: `localStorage`, the JSON file and the hash.
- **A rename could erase a shuffled name from the history.** Shuffle is undoable and moves names between interns, so rewriting every snapshot by id destroyed the pre-shuffle value. A rename now follows into a snapshot only where that snapshot still holds the name being replaced.

Also fixed: the 4 px chip gap was exactly as tall as the new hit padding so neighbours fought over it (gap now 6 px), the phone overflow menu showed an enabled Sıfırla on an empty board and was missing the language switch DESIGN section 2.4 lists, the view control's radiogroup was named with its own first option, focus restoration targeted a possibly-removed trigger, the roving tabindex made untabbable radios into focus-trap boundaries, `SET_MIN_PER_SHIFT` could leave a stale target in a snapshot, and the switch knob had been given a popover-sized shadow that is invisible at 27 px.

## Third review round, 2026-09-03

Four lenses (the newest changes, the engine mathematics re-derived independently, a first-use walkthrough on a phone, and a completeness critic over both documents and the test suite). The engine lens re-derived section 1 arithmetic, the section 4.1 rules table and the solver cost from the documents and checked them against about 200 000 random operations plus an exhaustive enumeration of all 3 003 legal night patterns: no defect in `src/engine`. Three majors, all in the shell:

- **The drag ghost lied on every legal move.** `wouldViolate` has add-semantics, but a drag that starts in a slot is a move. Judging it against a board that still contained the shift being dragged reported the cell the move was about to vacate, and an over-quota the move does not create: on a solved six-intern board, 226 of 226 legal moves painted the red rule-break ring. The ghost now evaluates the board the move will produce.
- **Dragging did not work on a phone at all.** dnd-kit's `PointerSensor` answers every `pointerdown`, touch included, so the `TouchSensor` long press never instantiated, and with no `touch-action` on the draggables the browser cancelled the drag as soon as it read the gesture as a scroll. In the mobile list days stack vertically, so moving a shift is a vertical drag in the same direction as the scroll. `MouseSensor` now takes the mouse and touch falls through to the `TouchSensor`.
- **Importing a JSON file replaced the board with no confirmation** and cleared the history, while the same replacement from a share link asked first. Import now asks the same question.

Smaller: dnd-kit's English screen-reader instructions and id-based announcements are now translated, the chip popover names the chip (on a phone the chip shows only a first name), the empty-slot label finally uses `slot.empty`, diagnostics rows carry their own severity glyph, an unavailable menu item is `aria-disabled` rather than removed from the keyboard order, the zone gap went to 8 px so two facing 4 px hit pads abut instead of overlapping, the unreachable warning arm of the drag ghost is gone, the palette hint tells a phone to tap rather than to press Enter, and a failed export no longer says a file could not be read.

Both majors were then re-verified in a real browser rather than on paper: a mouse drag of a chip between two day slots now shows the accent ring instead of the false red one, lands, and leaves the board at "Sorun yok"; a synthetic touch long press activates after 150 ms, announces in Turkish and moves the chip. A new exhaustive test walks every possible single move on a solved six-intern board and asserts the ghost calls every legal one clean and every illegal one a break.

The critic also named three tests that would have passed while their subject was broken: the language test asserted only dictionary strings and no date, `weekdayOf` was checked against its own formula rather than the calendar, and the Excel test never looked at the Matrix or Summary sheets. All three now assert the real thing.

## Round four, requested changes, 2026-09-03

Alper reviewed the working app and asked for six things. All are in.

- **The eight intern colours were too close.** He named the pairs himself: interns 1, 2 and 6 (blue, teal, indigo) and 4 and 5 (yellow, orange). Measured, his eye was right: the worst pair of light tints was ΔE(OKLab) 2.0, barely a noticeable difference over a large area. The palette is now the result of a search rather than a choice: eight hues and eight tint lightnesses optimised to maximise the smallest distance across the light tints, the dark tints, the chip text and the dots at once, with 4.6:1 text contrast held in both themes. Worst pair is now 5.6, and excluding red costs nothing (the optimiser reached the same number with and without it). Colours are handed out blue, orange, green, purple, yellow, indigo, teal, pink, so four interns get four hues a quarter-turn apart.
- **A pencil on each palette row** turns it into a name field in place. The row keeps the same height, so nothing jumps. The grip glyph went away: it was decoration next to a real control, and it was eating the width the names needed.
- **A name pool.** A card below staffing holds a list of names, one per line. A name typed on an intern is that intern's and is never moved; the pool fills only the blanks. `İsimleri dağıt` draws just the names, without touching the board.
- **Randomize is two-stage.** The dialog now asks whether the shifts already on the board should stay. Keeping them is the lock rule applied to everything placed: the solver treats those cells as fixed and fills around them, and the real lock flags are restored afterwards so nothing silently becomes locked. When the pool has names, the fill hands them to the interns still without one, in the same action.
- **`İsimleri karıştır` is gone**, along with `engine/shuffle.ts`, the `SHUFFLE_NAMES` action and the `toolbar.shuffle` key. The pool covers what it was for, and it removed the one action that fought the rule that names live outside the history.
- **Identity.** The app is EMED Nöbet Planlayıcı, with the Koç mark beside the name. The loading screen reveals that mark with a conic sweep from three o'clock, which is exactly the order the spiral is drawn in, smallest wedge to largest. A credit line and an info popover sit bottom right, and an error boundary plus a pre-script failure state in `index.html` cover the two ways the page can fail.
- **The setup header no longer reflows** when the language changes: the name has its own row in both languages.

## Round four review, 2026-09-03

Five lenses over the requested round. One blocker, three majors, thirty-two smaller findings.

- **Blocker: the splash stylesheet broke the theme.** `index.html` gave `body` an opaque background keyed to `prefers-color-scheme`, and the application stylesheet only paints `html`, so an explicit theme choice that disagreed with the operating system left the page ground in the other theme. Measured: choosing light on a dark machine rendered the title at 1.09:1, invisible. Only `html` carries a background now, and the same case measures 16.7:1. The error page also forces a `data-theme` of its own, because a crash before the theme provider ran would have hit the same wall.
- **A pool draw was one-shot.** `distributePool` filled blanks, and after the first draw there were none, so the button greyed out for good and the draw could not be undone. That is not what he asked for: he wants to be able to redistribute. Names now carry `pinned`: typing a name pins it and it is never moved, while a drawn name is not pinned and a second draw reshuffles it. A name arriving from a link or a JSON file counts as typed, so opening someone else's board and pressing the button cannot scramble the names they sent.
- **The pencil started a drag instead of renaming.** Its guard stopped `pointerdown`, but the sensors were changed to Mouse, Touch and Keyboard in round three, none of which listens to that event. A press with any drift dragged the intern, and the keyboard could not reach the editor at all because the keyboard sensor called `preventDefault` before the click. It now stops `mousedown`, `touchstart` and `keydown`.
- **The pool cap counted lines, not names**, so a blank line ate the allowance and a full pool silently dropped a name on every Enter.
- The colour hand-out order was re-derived by exhausting all 8! permutations: the worst pair is now 10.5 at four interns, 5.9 at five, 5.7 at six, 5.6 at seven and 5.19 at eight, and interns 1 and 6 are no longer the closest pair. The claim in DESIGN.md was corrected from 5.6 to the measured 5.19.
- Also fixed: a typed but undistributed pool was not treated as draft content, so a share link or a JSON import could silently destroy it; the chip's hover filter dimmed tint and text together and pushed five light chips under 4.6:1; `theme-color` followed the operating system rather than the chosen theme; the credit line's phone clearance ignored the safe area and was not aligned to the content column; the splash was torn down a third of the way through its sweep on a cached load, and had no fallback where `@property` is unsupported, where the mask would simply have hidden the mark; the error page hard-coded copy that already existed in both dictionaries; and the shuffle survived in five places in the normative documents after being deleted from the code.

## Name pool, second pass, 2026-09-03

Alper asked for two changes after using it. The text area was a guess about what people would do; both changes replace it with something that cannot be misread.

- **A button in the İntörnler panel header on the board** opens the pool as a sheet. Before, the pool lived only in the setup flow and in settings, which is two clicks away from where the names actually matter.
- **Names are committed, not typed.** One field, and Enter or the add button puts the name in the list as a removable chip. A name with a space in it is one name, a repeat is refused with a line under the field, and a multi-line paste is committed as several names. His worry was exactly right: with a free text area nobody can tell whether what they typed counted, and a blank line or a trailing space silently changed the answer.

## Two small fixes, 2026-09-03

- **A tooltip could hang over the page.** Closing a dialog restores focus to the control that opened it, and the tooltip treated that like a keyboard focus, so after opening and closing settings the word "Ayarlar" sat on the board until the next click. Tooltips now follow input modality: a module-level flag records whether the last thing the user did was press a key, and a focus only raises a tooltip when it did. A click on the control also dismisses its own tooltip. Two regression tests cover both halves.
- **The credit moved beside the application name**, and the handle is now a link to https://github.com/Alperhtml, with the same link spelled out inside the info popover. On the board it rides on the date line: putting it on the title line made the name truncate to "EMED Nöb..." at 1100 px.

## Open questions

None as of 2026-09-03. Everything above was decided with the owner.
