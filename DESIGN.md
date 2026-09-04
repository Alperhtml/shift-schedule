# DESIGN.md, visual and interaction spec

The brief in one line: a quiet, precise tool that a group of interns opens on a phone or laptop, fills in two minutes, and posts on a wall. Deference first (the board is the content, the chrome is neutral), clarity second (one primary action per screen), depth third (translucent layers, hairlines, no drop shadows on cards).

## 1. Tokens (`src/styles/tokens.css`, exposed through Tailwind `@theme`)

All values below are the only ones components may use. Semantic colours are used at full strength on small elements only (badges, rings, icons), never as large fills.

### 1.1 Colour, light

| Token | Value | Use |
|---|---|---|
| `--ground` | `#F5F5F7` | page background |
| `--surface` | `#FFFFFF` | cards, board cells, popovers |
| `--surface-2` | `#F2F2F4` | night zone fill, inset areas |
| `--surface-glass` | `#FAFAFA`, opaque | top bar, bottom sheet, popovers, dialogs, tooltips, toasts |
| `--hairline` | `rgba(0,0,0,.08)` | separators and cell edges, 1 device pixel |
| `--text` | `#1D1D1F` | primary text (16.1:1 on ground) |
| `--text-2` | `#6E6E73` | secondary text (4.9:1) |
| `--text-3` | `#AEAEB2` | disabled and micro labels on surface only |
| `--accent` | `#0A6BFF` | fills: primary button, selected segment, focus ring; white on it is 4.6:1 |
| `--accent-text` | `#0A5FE0` | accent used as text or icon on ground (5.4:1) |
| `--accent-tint` | `rgba(10,107,255,.10)` | hover on quiet buttons, selected calendar range |
| `--error` | `#C81E1E` | error badge, error ring, destructive button text (5.5:1) |
| `--warn` | `#9A5B00` | warning badge and ring text (5.2:1); ring stroke may use `#F0A500` |
| `--ok` | `#1B7F3B` | quota complete state |
| `--info` | `#6E6E73` | info badges use secondary text colour, no third accent |
| `--scrim` | `rgba(0,0,0,.45)` | behind dialogs and sheets |

### 1.2 Colour, dark (a separate design: backgrounds near-black, surfaces get lighter as they come forward, separators brighter, accent desaturated)

| Token | Value |
|---|---|
| `--ground` | `#151517` |
| `--surface` | `#1C1C1E` |
| `--surface-2` | `#26262A` |
| `--surface-glass` | `#1C1C1E`, opaque |
| `--hairline` | `rgba(255,255,255,.10)` |
| `--text` | `#F5F5F7` (15.6:1) |
| `--text-2` | `#A1A1A6` (6.6:1) |
| `--text-3` | `#636366` |
| `--accent` | `#4D9BFF` (6.0:1 on surface as text; primary button uses `#0A6BFF` fill with white) |
| `--accent-text` | `#4D9BFF` |
| `--accent-tint` | `rgba(77,155,255,.16)` |
| `--error` | `#FF6B6B` (6.1:1) |
| `--warn` | `#FFB340` (9.5:1) |
| `--ok` | `#4CD07A` |
| `--scrim` | `rgba(0,0,0,.60)` |

Theme switching: `data-theme="light" | "dark"` on `<html>`, set from the `system` preference through `matchMedia` unless the user picked one. Tokens are redefined under `[data-theme="dark"]`; nothing else changes per theme.

### 1.3 Intern colours

Identity colours only. They never carry meaning about rules. Contrast ratios were computed on 2026-09-03 (all ≥ 4.6:1 text on tint).

Chosen by search, not by eye: eight hues and eight tint lightnesses were optimised to maximise the *smallest* perceptual distance between any two colours, over the light tints, the dark tints, the chip text and the dots at once, subject to 4.6:1 text contrast in both themes. The result is a worst pair of ΔE(OKLab) 5.19 over all eight, against 2.0 for the first palette, whose indigo and purple tints were nearly the same colour.

| Key | Hue | Light chip bg | Light chip text | Dark chip bg | Dark chip text | Dot (palette, legend) |
|---|---|---|---|---|---|---|
| pink | 2 | `#FFD9E2` | `#B12F62` | `#5A2536` | `#FFC0D0` | `#DF407D` |
| orange | 52 | `#FFCAAB` | `#914500` | `#552805` | `#FFC6A4` | `#CE6500` |
| yellow | 96 | `#FAE282` | `#756200` | `#443801` | `#EFD45D` | `#9D8500` |
| green | 140 | `#BBFAAD` | `#217700` | `#214419` | `#A2EB91` | `#30A100` |
| teal | 189 | `#73FBF1` | `#00706A` | `#01423F` | `#3BF1E7` | `#009A93` |
| blue | 239 | `#C5E8FF` | `#006A9C` | `#013D5C` | `#A8DCFF` | `#0090D0` |
| indigo | 282 | `#CFD2FE` | `#5349B9` | `#302F5E` | `#CDD0FF` | `#786EF9` |
| purple | 323 | `#F7BFFE` | `#883194` | `#49264E` | `#F8BBFF` | `#BC52CB` |

Colours are handed out in the order orange, green, blue, purple, teal, yellow, pink, indigo. That order was found by exhausting all 8! permutations to maximise the smallest distance among the first n for every roster size: the worst pair is 10.5 at four interns, 5.9 at five, 5.7 at six, 5.6 at seven and 5.19 at eight.

Pure red is deliberately absent so that no intern reads as "error" on a printed board; excluding it costs nothing, since the optimiser reached the same worst-pair distance with and without it.

### 1.4 Type

Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", "Helvetica Neue", system-ui, sans-serif`. Inter is bundled from `@fontsource-variable/inter` as the fallback on Windows and Android and is what `html-to-image` embeds.

Four sizes, nothing else: 11 (micro labels, zone hours, chip counts), 13 (body, chips, list rows), 15 (controls, card titles, dialog text), 22 (page title, export title). Weights 400 body, 500 emphasis and chips, 600 titles. `letter-spacing: -0.02em` at 22 px, `+0.04em` on 11 px uppercase micro labels (the only place uppercase appears). Line height 1.45 body, 1.2 titles. Tabular numerals (`font-variant-numeric: tabular-nums`) on every count.

### 1.5 Space, radius, elevation, motion

- Spacing unit 4 px; scale 4, 8, 12, 16, 24, 32, 48. Outer padding generous (24 to 32), inner grouping tight (4 to 8).
- Radius: 6 controls and chips, 12 cards and popovers, 20 sheets and dialogs. One card never mixes three radii.
- Elevation: none on cards. Popovers and sheets float with `0 8px 30px rgba(0,0,0,.10)` (dark: `.35`) and a hairline border. Nothing else has a shadow.
- No translucency. These panels were once 72 percent with a 24 px backdrop blur. The blur does not run everywhere, most visibly with macOS Reduce transparency, and without it the page showed through sharply. Depth now comes from the shadow and the hairline alone, which renders the same on every machine.
- Motion: `--ease: cubic-bezier(.32,.72,0,1)`, `--dur-fast: 180ms`, `--dur: 240ms`. Enter: fade + 8 px translate from the edge the thing belongs to. Exit at 70 % of the enter duration. `prefers-reduced-motion: reduce` drops every transform and stagger and keeps a 120 ms opacity fade.
- Focus ring: `0 0 0 3px rgba(10,107,255,.35)` with 2 px offset, on every interactive element, visible only for `:focus-visible`.
- Hit targets: 44 × 44 px minimum on touch; on pointer devices chips may be 24 px tall but their hit area is padded to 32.

## 2. Screens

### 2.1 Setup (`step = 'setup'`)

Centered column, max width 560 px, page title at top ("Acil nöbet planlayıcı"), TR / EN segmented control top right, theme control next to it. Three cards, each a `--surface` panel with radius 12 and a hairline, revealed in order with the enter motion. A card that is not yet revealed does not exist in the DOM.

```
┌─ Dönem ─────────────────────────────────────┐
│ Stajlar pazartesi 08:00'de başlar ...        │
│ ┌ calendar (react-day-picker) ┐              │
│ │ month grid, week starts Mon │              │
│ │ non-Mondays: --text-3, not  │              │
│ │ selectable; selected range  │              │
│ │ 28 days in --accent-tint,   │              │
│ │ start day filled --accent   │              │
│ └─────────────────────────────┘              │
│ 7 Eylül 2026 ile 4 Ekim 2026 arası, 4 hafta  │
└──────────────────────────────────────────────┘
┌─ İntörnler ─────────────────────────────────┐
│ İntörn sayısı        [ − ]  6  [ + ]         │
│ ● İntörn 1   [ İsim (isteğe bağlı)      ]    │
│ ● İntörn 2   [                          ]    │
│ ...                                          │
└──────────────────────────────────────────────┘
┌─ Kadro ─────────────────────────────────────┐
│ Bir nöbette en az    [ − ]  2 kişi  [ + ]    │
│ 6 intörn × 16 nöbet = 96 atama, 56 nöbet,    │
│ ortalama 1,7 kişi                            │
│ ⚠ Hedef ortalamanın üstünde; bazı nöbetler   │
│   hedefin altında kalacak.        (when >avg)│
└──────────────────────────────────────────────┘
                     [ Panoya geç ]  ← accent fill, the only accent fill on the page
```

Calendar details: `weekStartsOn = 1`, locale from the current language, non-Mondays disabled, the month navigates with quiet chevron buttons, today gets a 1 px accent ring. The picker is pre-selected with the next Monday on first run. Picking a Monday animates the range in (`--dur`).

Steppers: 44 px round quiet buttons with `−` and `+` glyphs (Lucide `minus`, `plus`), value in 15/500 tabular. Disabled at the bounds (opacity .4, no pointer). The count stepper shows a confirm dialog on shrink when interns being removed hold assignments.

Names: standard text fields, 44 px tall, label visible ("İsim (isteğe bağlı)" as the field label of the column, placeholder inside the field is the intern placeholder text), a colour dot before the label. Inline, no validation needed.

The same three cards are reused verbatim inside the settings sheet on the board.

### 2.2 Board (`step = 'board'`), desktop ≥ 1024 px

```
┌ top bar (glass, sticky) ───────────────────────────────────────────────────────┐
│ Acil nöbet planlayıcı   7 Eyl - 4 Eki 2026     [Takvim|Matris]   ↶ ↷   ⚙  TR|EN │
│                                                     [İsimleri karıştır] [Sıfırla] [Dışa aktar ▾] [Rastgele doldur] │
└────────────────────────────────────────────────────────────────────────────────┘
┌ legend row: Gündüz 08:00-20:00 · Gece 20:00-08:00                               ┐
┌ grid 7 cols ─────────────────────────────────────┐ ┌ palette 288 px ──────────┐
│ Pzt      Sal      Çar      Per      Cum  Cmt  Paz │ │ İntörnler                │
│ ┌ 7 Eyl ─────────┐                                │ │ ● Ali      G 3/8 · N 2/8 │
│ │ 08-20  [Ali][Ayşe]        ← day zone           │ │ ● Ayşe     G 8/8 · N 8/8 ✓│
│ │ 20-08  [Can]              ← night zone         │ │ ...                      │
│ └────────────────┘  ...                           │ ├ Denetim ─────────────────┤
│ (4 rows)                                          │ │ Kural ihlalleri (2)      │
│                                                   │ │  ! Ali: 8 Eyl Sal gece.. │
│                                                   │ │ Kadro (5)                │
│                                                   │ │ Eksik kotalar (3)        │
└───────────────────────────────────────────────────┘ └──────────────────────────┘
```

Top bar: two rows on desktop when the width is under 1280, one row above. Title 22/600, range 13 `--text-2`. View switch is a segmented control. Undo and redo are icon buttons with tooltips and are disabled (opacity .4) when the stack is empty. Settings is an icon button that opens the sheet. Language is a two-segment control. "Rastgele doldur" is the one accent-filled button; "Dışa aktar" is a quiet button with a chevron opening a menu; the rest are quiet buttons.

Grid: 7 equal columns, weekday header row (`EEE` from date-fns, 11 px uppercase micro label, `--text-2`). Each day cell is a `--surface` panel, radius 12, hairline border, min height 148 px, padding 8, gap 8 between cells. Inside: date line (13/500, e.g. "7 Eyl"; on the first of a month the month name is included, e.g. "1 Eki") with a small week label at the left of each row ("1. hafta"), then the day zone and the night zone stacked.

Zones: each is a droppable area, min height 52 px, radius 8. Day zone on `--surface` with a hairline top; night zone on `--surface-2`. A micro label sits at the top-left of every zone: `08-20` with Lucide `sun` (12 px), `20-08` with Lucide `moon`. Chips wrap inside the zone in a 4 px gap flow. Empty zone shows nothing but the label; on hover it shows a faint `+` at the right (`--text-3`) as the click-to-assign affordance.

Chips: 24 px pill, radius 6, intern tint background and intern text colour, 13/500, padding 0 8, label = real name or placeholder, truncated with an ellipsis at 120 px with the full name in a tooltip. A locked chip shows Lucide `lock` 12 px after the label. Hover lifts the chip 1 px and darkens the tint 4 %; active presses it back; dragging renders a `DragOverlay` copy at 1.04 scale with the floating shadow, and the source chip drops to opacity .35.

Palette: a `--surface` panel, radius 12, sticky under the top bar. Rows 44 px: colour dot 8 px, name 13/500, counts right-aligned 11 px tabular `--text-2`. Count states: complete (both 8/8) → counts in `--ok` and a `check` icon; over (any > 8) → counts in `--error`; otherwise neutral. The whole row is draggable; a `grip-vertical` icon appears on hover at the left edge. Dropping a chip onto the palette removes it (the panel shows a subtle inset `--accent-tint` while a chip hovers over it).

Diagnostics ("Denetim"): under the palette in the same column, three collapsible groups with counts; an empty state "Sorun yok" with a `check-circle` icon in `--ok`. Rows: icon (`alert-circle` error, `alert-triangle` warning, `info` info) + text 13; hover tint; click scrolls the cell into view and pulses it (two 240 ms opacity pulses of a 2 px accent ring). Groups: errors expanded by default, others collapsed when they exceed 6 items.

### 2.3 Matrix view

Same top bar. A table: first column intern (dot + name, sticky), 28 columns headed by weekday letter and date (`Pzt 7`), each cell 32 × 32 with a letter `G` (day-zone tint: `--surface`) or `N` (`--surface-2` with the moon tint) or blank; a cell holding both shows `G/N` with an error badge. Three totals columns at the end (G, N, Toplam). Row hover highlights the row. Read-only; the legend under the table spells out G and N. Horizontal scroll inside the table container on narrow widths, never on the page.

### 2.4 Mobile (< 768 px)

- Top bar collapses to title + range on their own row, with the view control, an export menu and an overflow `more-horizontal` menu holding undo, redo, reset, language and settings on the second. It is not sticky on a phone: two rows of sticky chrome cost too much of the screen, and the bottom bar already keeps the primary action in reach. "Rastgele doldur" stays visible as the primary action in the bottom toolbar.
- The calendar becomes a vertical list: a week header row ("1. hafta"), then one row per day: date column 56 px, day zone and night zone side by side, each ≥ 56 px tall. Chips show the first name only (split on space) and the full name in the popover.
- Palette and diagnostics move into a bottom sheet (radius 20, glass) above the toolbar with two segments (İntörnler / Denetim). Drag from the sheet works through `TouchSensor`; tap-to-assign is the expected path.
- Tablet 768 to 1023: grid stays 7 columns with 120 px min cells; palette moves below the grid as two side-by-side panels.

### 2.5 Popovers, dialogs, sheets, toasts

- Assign popover (from a zone): anchored to the zone, glass material, radius 12, list of interns as 40 px rows with dot, name, counts; a row that is already in the slot is dimmed with the label "Bu nöbette"; a row that `wouldViolate` shows a small badge and the label "Kural ihlali oluşturur" in `--warn` or `--error` text, still selectable.
- Chip popover: two rows, Kilitle / Kilidi aç and Kaldır (Kaldır in `--error` text).
- Dialogs: centred, radius 20, max width 400, title 15/600, body 13, buttons right-aligned, the destructive one uses `--error` text on a quiet button; the primary confirm is accent filled only when not destructive. Enter from 0.96 scale + fade over `--dur`.
- Settings sheet: slides in from the right on desktop (420 px), from the bottom on mobile, and reuses the three setup cards.
- Export menu: quiet button opens a menu with six items and a hairline separating downloads from "Bağlantıyı kopyala".
- Toasts: bottom centre, glass pill, 13 px, 3 s auto-dismiss, `aria-live="polite"`, never steal focus.
- Mode switch: a segmented control at the top of the setup screen, `Takım programı` / `Kendi programım`, with one line of explanation under it. Solo hides the staffing and name-pool cards and the intern stepper; the interns card becomes a single field titled `Siz`.
- Resets sit next to what they clear: `Tabloyu sıfırla` in the board toolbar, `Listeyi sıfırla` in the bottom right of the intern panel, `En baştan başla` at the foot of settings under a hairline, in the destructive variant with a one-line explanation. The list reset is disabled while there is nothing to clear.
- Intern panel corners: the title top left, `İsim havuzu` top right, the one-word drag hint bottom left, `Listeyi sıfırla` bottom right. All three controls in the header made that row wider than the card, which pushed the reset outside it. The visible hint is one word; the full sentence with the Enter instruction stays as the screen-reader text, where it is needed.
- Export menu: the JSON item is tinted `--accent-tint` with a 1 px inset `--accent-ring` and an 11 px second line, because it is the one export the merge needs. It is the only highlighted item in any menu; a second one would cancel the first.
- Merge review: a 560 px dialog. One row per file with the person it contributes, their day and night counts, and a remove button; a rule; then the roster line, the period, and the problem list. Problem lines carry a small `--warn-stroke` dot so they scan as problems rather than prose. Empty shifts are listed as dates, at most eight then `ve n tane daha`. The primary action is disabled while a file needs a decision.

### 2.6 Identity, loading and failure

- The application is **EMED Nöbet Planlayıcı**. The Koç mark sits to the left of the name on both screens, 30 x 25 px on setup and 24 x 20 px on the board.
- The setup header puts the name on its own row and the language and appearance controls on the next one, in both languages. Letting them share a row made the whole page reflow when the language changed, because the Turkish and English names are different widths.
- A loading screen lives in `index.html` as plain HTML and CSS, so it paints before any script. The Koç mark is revealed by a conic mask swept from three o'clock: the mark is a spiral whose wedges grow clockwise from there, so the sweep reveals it smallest piece first and the largest last, and the soft trailing edge makes each wedge fade in rather than snap. An inline script wired *before* the application script turns the same screen into a readable failure with a retry button if the bundle never loads.
- `ErrorBoundary` catches anything the application throws and shows the same kind of page, in both languages, with a refresh button. Its copy is not translated through `t()`, because the failure can be the translation layer itself.
- A quiet credit sits beside the application name: the author's handle, which links to the repository, and an info glyph that opens one sentence about what the tool is and where feedback goes, with the same link spelled out. On the board it rides on the date line rather than the title line, so it can never squeeze the application name at a narrow width.

- The name pool is reachable from two places: the setup flow and settings, and a button in the board's İntörnler panel header, which opens it as a sheet. Names are committed one at a time with Enter or an add button and appear as removable chips, so there is no doubt about whether what was typed counted. A repeat is refused with a line under the field rather than silently swallowed.

## 3. Rule feedback (non-blocking)

Each violation is marked in exactly one place on the board so nothing is double-marked: intern-level violations (`POST_NIGHT_DAY`, `NIGHT_GAP`, `DOUBLE_SHIFT`, `QUOTA_OVER`) badge the chip, slot-level ones (`UNDER_STAFFED`) ring the zone, and the drag ghost ring reflects only the candidate being dragged. Feedback always pairs colour with a glyph:

1. Chip badge: 14 px circle at the chip's top-right corner, offset −4 px, 2 px `--surface` keyline. Error: `--error` fill with a white `!`. Warning: `--warn` fill with a white `!`. Info never badges a chip.
2. Zone ring: `box-shadow: inset 0 0 0 1.5px` in `--error` or `--warn`; empty-slot warnings use a dashed 1 px outline in `--warn` instead of a solid ring so the board does not look alarming while it is being filled.
3. Tooltip: hover or long-press (450 ms) on a badged chip or ringed zone shows the violation sentences (§SPEC 9) in a glass tooltip, one line per violation, maximum 4 lines then "+n".

Drag ghost: while an intern hovers over a zone, the zone shows the accent ring if the drop is clean, the warn ring if `wouldViolate` returns warnings only, the error ring if it returns an error. The chip is still droppable in every case.

Palette count colours and the diagnostics groups are the fourth and fifth signals; they read from the same `validate()` result so they never disagree.

## 4. Solver moment

Pressing "Rastgele doldur": the button shows a 16 px spinner for at least 240 ms (the solve itself is faster; the minimum makes the action legible), then chips appear in `dayIndex` order with a 12 ms stagger per slot (about 0.7 s for the whole board), each with the enter motion. Locked chips do not animate. Reduced motion: everything appears at once. "İsimleri karıştır": labels cross-fade in place over `--dur-fast`; nothing moves.

## 5. Export frame

Light palette only, 1600 px wide, 48 px padding, white background.

Calendar: title row (22/600 "Acil tıp intörn nöbet listesi", right-aligned range 15 `--text-2`), legend line, the 7-column grid with 4 rows, cell min height 168, zone labels, chips at 15/500 with full names (wrapping, no ellipsis), no badges and no rings. Footer 11 px `--text-2`: "Oluşturulma: 3 Eyl 2026". Locked state is not shown on exports.

Matrix: same header, table at 15 px with 40 px cells, G cells white with a hairline, N cells `--surface-2`, totals bold-free (600 weight only on the header row).

Print: the calendar frame scaled to fit A4 landscape width by a CSS transform, page margins 10 mm.

## 6. Accessibility checklist for the coding model

- Every zone is a `button`-like focusable region with `aria-label` "{date} {shift} nöbeti"; chips are focusable with `aria-describedby` pointing at their violation text.
- Segmented controls are `role="radiogroup"`; menus and popovers trap focus and close on `Esc`; dialogs are `role="dialog"` with `aria-modal`.
- Colour never carries meaning alone: badges have glyphs, counts have icons, matrix cells have letters.
- Body text is never below 13 px on desktop; on mobile inputs are 16 px to avoid iOS zoom.
- Everything works with `prefers-reduced-motion`, at 200 % zoom, and with keyboard only (§SPEC 11).

## 7. Anti-patterns to refuse

Pure `#000` / `#fff` surfaces; borders on everything; a second accent; uppercase headings; emoji anywhere in the UI; gradients; shadows on cards; icon-only buttons without tooltips; a hero or marketing section (the setup card is the first screen, nothing sits above it); any animation over 400 ms; blocking a drop because of a rule.
