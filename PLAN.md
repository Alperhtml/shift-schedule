# Acil nöbet planlayıcı, implementation plan

> **This is the build history, not a live document.** It records how the application
> was first built and is kept for that record. Where it disagrees with the code, the
> code is right and `SPEC.md` is the contract. Known to be superseded: the intern
> colour palette in task 1 (replaced, see `DESIGN.md` §1.3), the name shuffle in
> tasks 6 and 15 (replaced by the name pool, `SPEC.md` §6), the solver's move budget
> and DFS budget (both raised), and the application name.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single-page emergency medicine intern shift planner described in `SPEC.md` and `DESIGN.md`: a 28-day, 4 to 8 intern board with live rule checking, a seeded annealing solver, TR/EN interface, and PNG / Excel / print / JSON / link exports.

**Architecture:** A pure TypeScript engine (`src/engine/`) holds the data model, rules, solver, shuffle and codecs and is fully unit-tested before any UI exists. A single reducer (`src/state/`) is the only writer of the schedule; React components dispatch actions and read derived violations. Exports render a dedicated off-screen frame. Nothing talks to a server.

**Tech Stack:** Vite 8, React 19, TypeScript strict, Tailwind 4 (`@tailwindcss/vite`), `@dnd-kit/core`, `react-day-picker` 10, `date-fns` 4, `html-to-image`, SheetJS `xlsx`, `lucide-react`, `@fontsource-variable/inter`, Vitest 5, Testing Library.

## Global constraints

Copied from `SPEC.md` and `CLAUDE.md`; every task implicitly includes them.

- `DAYS = 28`, `dayIndex` 0..27, `startDate` is always a Monday (ISO `YYYY-MM-DD`).
- `ShiftType` is `'DAY' | 'NIGHT'`; DAY 08:00-20:00, NIGHT 20:00-08:00.
- `N` in [4, 8]; quota exactly 8 DAY + 8 NIGHT per intern; `NIGHT_GAP_MIN = 3`; `minPerShift` in [1, 4], default `max(1, floor(16N/56))`; `HIGH_DENSITY_AT = 4`.
- Legal and never flagged: DAY on `d` then NIGHT on `d+1`; consecutive DAY shifts; NIGHT on `d` then DAY on `d+2`; NIGHT on day 27.
- `src/engine/` has no React, DOM, `Date.now()`, `Math.random()`, `localStorage`; randomness enters only through `createRng(seed)`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. In `engine/` no `any`, no `!`, no `as` to silence errors; index reads use `at()` or `?? default`.
- Every user-visible string goes through `t()`; `tr.ts` and `en.ts` share one key set (§SPEC 9 is the dictionary, copy it verbatim).
- Colours, sizes, radii, durations come from `src/styles/tokens.css` (values in `DESIGN.md` §1); no raw hex in components; no CDN, no Google Fonts import, no new runtime dependency without a line in `memory.md`.
- Non-blocking: no drop is refused because of a rule; only a structural duplicate is refused.
- Turkish text: never locale-blind `toUpperCase` / `toLowerCase`; weekday and month names from date-fns locales.
- `history.replaceState` and `navigator.clipboard` calls are wrapped in try/catch.
- Done means: task tests pass, `npm run check` green, UI tasks screenshotted at 1280 and 375 px in light and dark and compared with `DESIGN.md`, no console errors, `memory.md` updated with any new decision.

## File structure

```
program-app/
  index.html
  package.json  tsconfig.json  tsconfig.app.json  tsconfig.node.json  vite.config.ts  eslint.config.js  vitest.config.ts
  public/favicon.svg
  src/
    main.tsx                      mounts <App/> inside providers
    App.tsx                       picks SetupScreen or BoardScreen, hosts dialogs and toasts, handles the hash on boot
    styles/tokens.css             design tokens (DESIGN §1), light + dark
    styles/app.css                @import "tailwindcss"; @theme mapping tokens; base styles; reduced-motion
    styles/print.css              @media print rules for the export frame
    engine/types.ts               domain types and constants
    engine/util.ts                at(), get(), inc()
    engine/random.ts              createRng (mulberry32)
    engine/dates.ts               date-fns wrappers, locales
    engine/schedule.ts            slot keys, indexes, counts, makeInterns, createSchedule
    engine/rules.ts               validate, wouldViolate, internPatternValid
    engine/solver.ts              solve (annealing)
    engine/solver.worker.ts       worker wrapper around solve
    engine/shuffle.ts             shuffleNames
    engine/codec.ts               encodeHash, decodeHash, isSchedule, base64url helpers
    engine/__tests__/*.test.ts    one file per module
    i18n/tr.ts  i18n/en.ts        dictionaries (SPEC §9)
    i18n/index.ts                 Key type, t(), LangProvider, useT()
    state/reducer.ts              AppState, Action, reducer, initialState
    state/persistence.ts          load/save localStorage
    state/store.tsx               StoreProvider, useStore, autosave effect
    state/useViolations.ts        memoised validate() + byCell / byInternSlot indexes
    state/solverClient.ts         runSolver(schedule, seed): Promise<SolveResult> via the worker
    state/__tests__/reducer.test.ts
    components/ui/                Button, IconButton, Segmented, Stepper, Popover, Dialog, Sheet, Tooltip, Toast, Menu, ThemeProvider
    components/setup/             SetupScreen, PeriodCard, InternsCard, StaffingCard
    components/board/             BoardScreen, TopBar, Toolbar, CalendarGrid, DayCell, SlotZone, InternChip, ViolationBadge, AssignPopover, ChipPopover, DndProvider, MobileList
    components/palette/           Palette, PaletteRow
    components/diagnostics/       Diagnostics
    components/matrix/            MatrixView
    components/settings/          SettingsSheet
    components/export/            ExportFrame, ExportMenu, exportPng.ts, exportXlsx.ts, exportJson.ts, shareLink.ts, printSchedule.ts
```

Task order is engine → state → UI → exports → polish. Tasks 2 to 7 must be green before task 8 starts.

---

### Task 1: Scaffold, tooling, tokens

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/app.css`, `src/styles/print.css`, `public/favicon.svg`, `src/engine/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: the `npm run dev|build|lint|test|check` commands; the CSS custom properties named in `DESIGN.md` §1 available on `:root` and `[data-theme="dark"]`; Tailwind utilities `bg-surface`, `text-text-2`, `border-hairline`, `rounded-card`, etc. mapped through `@theme`.

- [ ] **Step 1: Create the project**

```bash
cd emed/program-app
npm create vite@latest . -- --template react-ts
npm i react-day-picker date-fns @dnd-kit/core @dnd-kit/utilities html-to-image xlsx lucide-react @fontsource-variable/inter
npm i -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

If `npm create vite` refuses a non-empty directory, run it in a temp folder and move the generated files in; the existing `*.md` files must stay.

- [ ] **Step 2: package.json scripts**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "test": "vitest run",
  "check": "npm run lint && npm run test && npm run build",
  "preview": "vite preview"
}
```

- [ ] **Step 3: tsconfig.app.json compiler options** (keep what Vite generated, add these)

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"verbatimModuleSyntax": true,
"types": ["vite/client", "vitest/globals"]
```

- [ ] **Step 4: vite.config.ts and vitest.config.ts**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], testTimeout: 20_000 },
});
```

```ts
// src/test-setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: tokens.css** (copy every value from `DESIGN.md` §1.1, §1.2, §1.3, §1.5)

```css
:root {
  color-scheme: light;
  --ground: #F5F5F7; --surface: #FFFFFF; --surface-2: #F2F2F4;
  --surface-glass: rgba(250,250,250,.72);
  --hairline: rgba(0,0,0,.08);
  --text: #1D1D1F; --text-2: #6E6E73; --text-3: #AEAEB2;
  --accent: #0A6BFF; --accent-text: #0A5FE0; --accent-tint: rgba(10,107,255,.10);
  --error: #C81E1E; --warn: #9A5B00; --warn-stroke: #F0A500; --ok: #1B7F3B; --info: #6E6E73;
  --scrim: rgba(0,0,0,.45);
  --shadow-float: 0 8px 30px rgba(0,0,0,.10);
  --ease: cubic-bezier(.32,.72,0,1); --dur-fast: 180ms; --dur: 240ms;
  --radius-control: 6px; --radius-card: 12px; --radius-sheet: 20px;
  --chip-blue-bg: #E1EEFD; --chip-blue-fg: #1F64AD; --dot-blue: #197CE6;
  --chip-teal-bg: #E1F9FD; --chip-teal-fg: #187886; --dot-teal: #19CAE6;
  --chip-green-bg: #E1FDEA; --chip-green-fg: #167E39; --dot-green: #19E65E;
  --chip-yellow-bg: #FDF6E1; --chip-yellow-fg: #866B18; --dot-yellow: #E6B319;
  --chip-orange-bg: #FDEEE1; --chip-orange-fg: #A05A1C; --dot-orange: #E67919;
  --chip-indigo-bg: #E4E1FD; --chip-indigo-fg: #2A1FAD; --dot-indigo: #2A19E6;
  --chip-purple-bg: #F3E1FD; --chip-purple-fg: #791FAD; --dot-purple: #9B19E6;
  --chip-pink-bg: #FDE1ED; --chip-pink-fg: #AD1F5A; --dot-pink: #E6196E;
}
[data-theme="dark"] {
  color-scheme: dark;
  --ground: #151517; --surface: #1C1C1E; --surface-2: #26262A;
  --surface-glass: rgba(28,28,30,.72);
  --hairline: rgba(255,255,255,.10);
  --text: #F5F5F7; --text-2: #A1A1A6; --text-3: #636366;
  --accent: #0A6BFF; --accent-text: #4D9BFF; --accent-tint: rgba(77,155,255,.16);
  --error: #FF6B6B; --warn: #FFB340; --warn-stroke: #FFB340; --ok: #4CD07A; --info: #A1A1A6;
  --scrim: rgba(0,0,0,.60);
  --shadow-float: 0 8px 30px rgba(0,0,0,.35);
  --chip-blue-bg: #1F344C; --chip-blue-fg: #79B1EC;
  --chip-teal-bg: #1F444C; --chip-teal-fg: #79DDEC;
  --chip-green-bg: #1F4A2F; --chip-green-fg: #79EC9F;
  --chip-yellow-bg: #4A3F21; --chip-yellow-fg: #ECCF79;
  --chip-orange-bg: #4A3321; --chip-orange-fg: #ECAF79;
  --chip-indigo-bg: #231F4C; --chip-indigo-fg: #8B82ED;
  --chip-purple-bg: #3A1F4C; --chip-purple-fg: #C279EC;
  --chip-pink-bg: #4A1F33; --chip-pink-fg: #EC79A9;
}
```

- [ ] **Step 6: app.css**

```css
@import "tailwindcss";
@import "@fontsource-variable/inter";
@import "./tokens.css";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
@theme {
  --color-ground: var(--ground); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-hairline: var(--hairline); --color-text: var(--text); --color-text-2: var(--text-2); --color-text-3: var(--text-3);
  --color-accent: var(--accent); --color-accent-text: var(--accent-text); --color-accent-tint: var(--accent-tint);
  --color-error: var(--error); --color-warn: var(--warn); --color-ok: var(--ok); --color-scrim: var(--scrim);
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", "Helvetica Neue", system-ui, sans-serif;
  --text-micro: 11px; --text-body: 13px; --text-control: 15px; --text-title: 22px;
  --radius-control: 6px; --radius-card: 12px; --radius-sheet: 20px;
  --ease-apple: cubic-bezier(.32,.72,0,1);
}
html { background: var(--ground); color: var(--text); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
body { margin: 0; font-size: 13px; line-height: 1.45; }
* { box-sizing: border-box; }
:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(10,107,255,.35); }
.tabular { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 120ms !important; animation: none !important; transform: none !important; } }
```

- [ ] **Step 7: Smoke test**

```ts
// src/engine/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';
describe('toolchain', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 8: Run `npm run check`**

Expected: lint clean, 1 test passed, `dist/` built.

- [ ] **Step 9: Commit**

```bash
git init 2>/dev/null; git add -A && git commit -m "task 1: scaffold, tooling, tokens"
```

---

### Task 2: Engine types, util, random

**Files:**
- Create: `src/engine/types.ts`, `src/engine/util.ts`, `src/engine/random.ts`
- Test: `src/engine/__tests__/random.test.ts`

**Interfaces:**
- Produces: every type in SPEC §2 plus constants `DAYS`, `QUOTA`, `NIGHT_GAP_MIN`, `HIGH_DENSITY_AT`, `MIN_INTERNS`, `MAX_INTERNS`, `SHIFT_TYPES`, `COLOR_KEYS`, type `Lang`; `at<T>(arr, i): T`, `get(arr, i): number`, `inc(arr, i, delta)`; `createRng(seed): Rng` with `next()`, `int(n)`, `pick(arr)`, `shuffle(arr)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/random.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../random';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it('next is in [0,1) and int(n) in [0,n)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) { const x = r.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); const k = r.int(5); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThan(5); }
  });
  it('shuffle keeps the multiset and pick returns a member', () => {
    const r = createRng(3);
    const arr = r.shuffle([1, 2, 3, 4, 5]);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
  });
  it('accepts non-integer and huge seeds', () => {
    expect(() => createRng(Date.now() + 0.5)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it, expect failure** (`npx vitest run src/engine/__tests__/random.test.ts`, "Cannot find module '../random'")

- [ ] **Step 3: Implement**

```ts
// src/engine/types.ts
export type ShiftType = 'DAY' | 'NIGHT';
export type InternId = string;
export type Lang = 'tr' | 'en';
export type ColorKey = 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'indigo' | 'purple' | 'pink';
export const COLOR_KEYS: readonly ColorKey[] = ['blue', 'teal', 'green', 'yellow', 'orange', 'indigo', 'purple', 'pink'];
export const SHIFT_TYPES: readonly ShiftType[] = ['DAY', 'NIGHT'];
export const DAYS = 28;
export const QUOTA = 8;
export const NIGHT_GAP_MIN = 3;
export const HIGH_DENSITY_AT = 4;
export const MIN_INTERNS = 4;
export const MAX_INTERNS = 8;
export const MIN_PER_SHIFT_MIN = 1;
export const MIN_PER_SHIFT_MAX = 4;
export const NAME_MAX = 40;

export interface Intern { id: InternId; index: number; realName: string; colorKey: ColorKey }
export interface Assignment { internId: InternId; dayIndex: number; type: ShiftType; locked: boolean }
export interface Schedule { version: 1; startDate: string; interns: Intern[]; minPerShift: number; assignments: Assignment[] }
export type SlotKey = `${number}-${ShiftType}`;
export interface Cell { dayIndex: number; type: ShiftType }
```

```ts
// src/engine/util.ts
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of range (length ${arr.length})`);
  return v;
}
export function get(arr: readonly number[], i: number): number { return arr[i] ?? 0; }
export function inc(arr: number[], i: number, delta: number): void { arr[i] = (arr[i] ?? 0) + delta; }
```

```ts
// src/engine/random.ts
export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
}
/** mulberry32: small, fast, deterministic. Seed is reduced to uint32. */
export function createRng(seed: number): Rng {
  let a = Math.floor(Math.abs(seed)) >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  const pick = <T,>(arr: readonly T[]): T => {
    const v = arr[int(arr.length)];
    if (v === undefined) throw new Error('pick from empty array');
    return v;
  };
  const shuffle = <T,>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const x = arr[i], y = arr[j];
      if (x === undefined || y === undefined) continue;
      arr[i] = y; arr[j] = x;
    }
    return arr;
  };
  return { next, int, pick, shuffle };
}
```

- [ ] **Step 4: Run the test, expect pass**
- [ ] **Step 5: Commit** `git add -A && git commit -m "task 2: engine types, util, rng"`

---

### Task 3: Dates and schedule helpers

**Files:**
- Create: `src/engine/dates.ts`, `src/engine/schedule.ts`
- Test: `src/engine/__tests__/dates.test.ts`, `src/engine/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `LOCALES`, `toIso(date)`, `isMonday(iso)`, `nextMonday(from: Date): string`, `dateOf(startDate, dayIndex): Date`, `weekOf`, `weekdayOf`, `formatDay(startDate, dayIndex, lang, pattern)`, `rangeParts(startDate, lang): { start, end }`, `weekdayLabels(lang): string[]`; `slotKey`, `parseSlotKey`, `bySlot`, `byIntern`, `counts`, `hasAssignment`, `averagePerSlot`, `defaultMinPerShift`, `colorFor(index)`, `makeInterns(n, existing?)`, `createSchedule(startDate, n)`.

- [ ] **Step 1: Failing tests**

```ts
// src/engine/__tests__/dates.test.ts
import { describe, it, expect } from 'vitest';
import { dateOf, isMonday, nextMonday, rangeParts, weekdayOf, weekOf, formatDay, weekdayLabels, toIso } from '../dates';

describe('dates', () => {
  it('isMonday', () => {
    expect(isMonday('2026-09-07')).toBe(true);   // Monday
    expect(isMonday('2026-09-08')).toBe(false);
    expect(isMonday('nonsense')).toBe(false);
  });
  it('nextMonday includes today when today is Monday', () => {
    expect(nextMonday(new Date(2026, 8, 7, 15))).toBe('2026-09-07');
    expect(nextMonday(new Date(2026, 8, 9))).toBe('2026-09-14');
    expect(nextMonday(new Date(2026, 8, 13))).toBe('2026-09-14');
  });
  it('dateOf across the October DST change keeps calendar days', () => {
    const start = '2026-10-19';                       // Monday. Türkiye has no DST since 2016; this guards the machine's own zone (CI may run in Europe/Berlin, where 2026-10-25 is the change)
    expect(toIso(dateOf(start, 6))).toBe('2026-10-25');
    expect(toIso(dateOf(start, 7))).toBe('2026-10-26');
    expect(toIso(dateOf(start, 27))).toBe('2026-11-15');
  });
  it('week and weekday arithmetic', () => {
    expect(weekOf(0)).toBe(0); expect(weekOf(6)).toBe(0); expect(weekOf(7)).toBe(1); expect(weekOf(27)).toBe(3);
    expect(weekdayOf(0)).toBe(0); expect(weekdayOf(6)).toBe(6); expect(weekdayOf(8)).toBe(1);
  });
  it('formats in both locales', () => {
    expect(formatDay('2026-09-07', 0, 'tr', 'd MMM')).toBe('7 Eyl');
    expect(formatDay('2026-09-07', 0, 'en', 'd MMM')).toBe('7 Sep');
    expect(rangeParts('2026-09-07', 'tr')).toEqual({ start: '7 Eylül 2026', end: '4 Ekim 2026' });
    expect(weekdayLabels('tr')).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);   // date-fns emits 'Cts'; formatDay normalises it to TDK's 'Cmt'
    expect(formatDay('2026-09-07', 5, 'tr', 'd MMM EEE')).toBe('12 Eyl Cmt');
    expect(weekdayLabels('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
```

```ts
// src/engine/__tests__/schedule.test.ts
import { describe, it, expect } from 'vitest';
import { averagePerSlot, bySlot, byIntern, counts, createSchedule, defaultMinPerShift, hasAssignment, makeInterns, parseSlotKey, slotKey } from '../schedule';

describe('schedule helpers', () => {
  it('slot keys round-trip', () => {
    expect(slotKey(3, 'NIGHT')).toBe('3-NIGHT');
    expect(parseSlotKey('3-NIGHT')).toEqual({ dayIndex: 3, type: 'NIGHT' });
    expect(() => parseSlotKey('x-NIGHT' as never)).toThrow();
  });
  it('averages and defaults', () => {
    expect(averagePerSlot(7)).toBe(2);
    expect(defaultMinPerShift(4)).toBe(1); expect(defaultMinPerShift(6)).toBe(1); expect(defaultMinPerShift(7)).toBe(2); expect(defaultMinPerShift(8)).toBe(2);
  });
  it('makeInterns keeps names on grow and shrink, clamps 4..8', () => {
    const a = makeInterns(5).map((i, k) => ({ ...i, realName: `n${k}` }));
    expect(makeInterns(6, a).map(i => i.realName)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', '']);
    expect(makeInterns(4, a).map(i => i.realName)).toEqual(['n0', 'n1', 'n2', 'n3']);
    expect(makeInterns(2)).toHaveLength(4); expect(makeInterns(9)).toHaveLength(8);
    expect(makeInterns(8).map(i => i.colorKey)).toEqual(['blue', 'teal', 'green', 'yellow', 'orange', 'indigo', 'purple', 'pink']);
    expect(makeInterns(4).map(i => i.id)).toEqual(['intern-1', 'intern-2', 'intern-3', 'intern-4']);
  });
  it('indexes and counts', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments.push({ internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false }, { internId: 'intern-2', dayIndex: 0, type: 'DAY', locked: true }, { internId: 'intern-1', dayIndex: 3, type: 'NIGHT', locked: false });
    expect(bySlot(s).get('0-DAY')?.map(a => a.internId)).toEqual(['intern-1', 'intern-2']);
    expect(byIntern(s).get('intern-1')).toHaveLength(2);
    expect(counts(s, 'intern-1')).toEqual({ day: 1, night: 1 });
    expect(hasAssignment(s, 'intern-2', 0, 'DAY')).toBe(true);
    expect(hasAssignment(s, 'intern-2', 0, 'NIGHT')).toBe(false);
    expect(s.minPerShift).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
// src/engine/dates.ts
import { addDays, format, getDay, isValid, parseISO, startOfDay } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { Lang } from './types';
import { DAYS } from './types';

export const LOCALES: Record<Lang, Locale> = { tr, en: enUS };
const KNOWN_MONDAY = '2026-09-07';

export function toIso(date: Date): string { return format(date, 'yyyy-MM-dd'); }
export function isMonday(iso: string): boolean { const d = parseISO(iso); return isValid(d) && getDay(d) === 1; }
export function nextMonday(from: Date): string {
  const d = startOfDay(from);
  const offset = (8 - getDay(d)) % 7;          // Monday → 0, Tuesday → 6, Sunday → 1
  return toIso(addDays(d, offset));
}
export function dateOf(startDate: string, dayIndex: number): Date { return addDays(parseISO(startDate), dayIndex); }
export function weekOf(dayIndex: number): number { return Math.floor(dayIndex / 7); }
export function weekdayOf(dayIndex: number): number { return dayIndex % 7; }
/** date-fns' Turkish locale abbreviates Cumartesi as "Cts"; TDK writes "Cmt". This is the only hand-made correction to locale output. */
const TR_FIXES: [RegExp, string][] = [[/\bCts\b/g, 'Cmt']];
export function formatDay(startDate: string, dayIndex: number, lang: Lang, pattern: string): string {
  const out = format(dateOf(startDate, dayIndex), pattern, { locale: LOCALES[lang] });
  return lang === 'tr' ? TR_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), out) : out;
}
export function rangeParts(startDate: string, lang: Lang): { start: string; end: string } {
  return { start: formatDay(startDate, 0, lang, 'd MMMM yyyy'), end: formatDay(startDate, DAYS - 1, lang, 'd MMMM yyyy') };
}
export function weekdayLabels(lang: Lang): string[] {
  return Array.from({ length: 7 }, (_, k) => formatDay(KNOWN_MONDAY, k, lang, 'EEE'));
}
```

date-fns 4.1 renders `EEE` for Turkish as `Paz Pzt Sal Çar Per Cum Cts`; the `TR_FIXES` table turns `Cts` into TDK's `Cmt` and nothing else. If a future date-fns changes another abbreviation, extend the table rather than hand-typing weekday names.

```ts
// src/engine/schedule.ts
import type { Assignment, ColorKey, Intern, InternId, Schedule, ShiftType, SlotKey } from './types';
import { COLOR_KEYS, MAX_INTERNS, MIN_INTERNS } from './types';
import { at } from './util';

export function slotKey(dayIndex: number, type: ShiftType): SlotKey { return `${dayIndex}-${type}`; }
export function parseSlotKey(key: SlotKey): { dayIndex: number; type: ShiftType } {
  const [d, t] = key.split('-');
  const dayIndex = Number(d);
  if (!Number.isInteger(dayIndex) || (t !== 'DAY' && t !== 'NIGHT')) throw new Error(`bad slot key ${key}`);
  return { dayIndex, type: t };
}
export function bySlot(s: Schedule): Map<SlotKey, Assignment[]> {
  const m = new Map<SlotKey, Assignment[]>();
  for (const a of s.assignments) { const k = slotKey(a.dayIndex, a.type); const list = m.get(k); if (list) list.push(a); else m.set(k, [a]); }
  return m;
}
export function byIntern(s: Schedule): Map<InternId, Assignment[]> {
  const m = new Map<InternId, Assignment[]>();
  for (const a of s.assignments) { const list = m.get(a.internId); if (list) list.push(a); else m.set(a.internId, [a]); }
  return m;
}
export function counts(s: Schedule, internId: InternId): { day: number; night: number } {
  let day = 0, night = 0;
  for (const a of s.assignments) if (a.internId === internId) { if (a.type === 'DAY') day += 1; else night += 1; }
  return { day, night };
}
export function hasAssignment(s: Schedule, internId: InternId, dayIndex: number, type: ShiftType): boolean {
  return s.assignments.some(a => a.internId === internId && a.dayIndex === dayIndex && a.type === type);
}
export function averagePerSlot(n: number): number { return (16 * n) / 56; }
export function defaultMinPerShift(n: number): number { return Math.max(1, Math.floor((16 * n) / 56)); }
export function colorFor(index: number): ColorKey { return at(COLOR_KEYS, index - 1); }
export function makeInterns(n: number, existing: readonly Intern[] = []): Intern[] {
  const count = Math.min(MAX_INTERNS, Math.max(MIN_INTERNS, n));
  return Array.from({ length: count }, (_, k) => {
    const index = k + 1;
    const prev = existing.find(i => i.index === index);
    return { id: `intern-${index}`, index, realName: prev?.realName ?? '', colorKey: colorFor(index) };
  });
}
export function createSchedule(startDate: string, n: number): Schedule {
  return { version: 1, startDate, interns: makeInterns(n), minPerShift: defaultMinPerShift(n), assignments: [] };
}
```

- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 3: dates and schedule helpers"`

---

### Task 4: Rules engine

**Files:**
- Create: `src/engine/rules.ts`
- Test: `src/engine/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: Task 2 and 3.
- Produces: `ViolationCode`, `Severity`, `Violation`, `validate(schedule): Violation[]`, `wouldViolate(schedule, candidate: Omit<Assignment,'locked'>): Violation[]`, `internPatternValid(nights: readonly number[], days: readonly number[]): boolean`, `touchesCell(v, cell): boolean`.

- [ ] **Step 1: Failing tests** (one per row of SPEC §4.1's example table plus ordering and `wouldViolate`)

```ts
// src/engine/__tests__/rules.test.ts
import { describe, it, expect } from 'vitest';
import { createSchedule } from '../schedule';
import { internPatternValid, validate, wouldViolate } from '../rules';
import type { Assignment, Schedule, ShiftType } from '../types';
import { createRng } from '../random';

function sched(items: [string, number, ShiftType][], n = 4, min = 1): Schedule {
  const s = createSchedule('2026-09-07', n);
  s.minPerShift = min;
  s.assignments = items.map(([internId, dayIndex, type]): Assignment => ({ internId, dayIndex, type, locked: false }));
  return s;
}
const hard = (s: Schedule) => validate(s).filter(v => v.severity === 'error');

describe('rules R1-R3', () => {
  it('Mon night + Tue day → POST_NIGHT_DAY on (1, DAY)', () => {
    const v = hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 1, 'DAY']]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ code: 'POST_NIGHT_DAY', internId: 'intern-1', dayIndex: 1, type: 'DAY', related: [{ dayIndex: 0, type: 'NIGHT' }] });
  });
  it('Mon night + Wed day → none', () => { expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 2, 'DAY']]))).toHaveLength(0); });
  it('Mon night + Tue night → NIGHT_GAP gap 1', () => {
    const v = hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 1, 'NIGHT']]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ code: 'NIGHT_GAP', dayIndex: 1, type: 'NIGHT', params: { gap: 1 }, related: [{ dayIndex: 0, type: 'NIGHT' }] });
  });
  it('Mon night + Wed night → NIGHT_GAP gap 2', () => {
    expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 2, 'NIGHT']]))[0]).toMatchObject({ code: 'NIGHT_GAP', params: { gap: 2 } });
  });
  it('Mon night + Thu night → none', () => { expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 3, 'NIGHT']]))).toHaveLength(0); });
  it('nights on 3,4,5 → exactly two NIGHT_GAP', () => {
    expect(hard(sched([['intern-1', 3, 'NIGHT'], ['intern-1', 4, 'NIGHT'], ['intern-1', 5, 'NIGHT']])).filter(v => v.code === 'NIGHT_GAP')).toHaveLength(2);
  });
  it('Mon day + Tue day → none; Mon day + Tue night → none', () => {
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 1, 'DAY']]))).toHaveLength(0);
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 1, 'NIGHT']]))).toHaveLength(0);
  });
  it('Mon day + Mon night → DOUBLE_SHIFT on (0, NIGHT)', () => {
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 0, 'NIGHT']]))[0]).toMatchObject({ code: 'DOUBLE_SHIFT', dayIndex: 0, type: 'NIGHT', related: [{ dayIndex: 0, type: 'DAY' }] });
  });
  it('night on day 27 has no post-night check', () => { expect(hard(sched([['intern-1', 27, 'NIGHT']]))).toHaveLength(0); });
});

describe('quota and staffing', () => {
  it('9 day shifts → one QUOTA_OVER with count 9 on the last day', () => {
    const items: [string, number, ShiftType][] = Array.from({ length: 9 }, (_, d) => ['intern-1', d, 'DAY']);
    const v = validate(sched(items)).filter(x => x.code === 'QUOTA_OVER');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ severity: 'error', dayIndex: 8, type: 'DAY', params: { count: 9 } });
    expect(v[0]?.related).toHaveLength(9);
  });
  it('QUOTA_INCOMPLETE is info with dayIndex -1, one per intern and type', () => {
    const v = validate(sched([])).filter(x => x.code === 'QUOTA_INCOMPLETE');
    expect(v).toHaveLength(8);
    expect(v[0]).toMatchObject({ severity: 'info', dayIndex: -1, params: { count: 0, missing: 8 } });
  });
  it('empty slot with min 2 → UNDER_STAFFED count 0 min 2, on all 56 slots', () => {
    const v = validate(sched([], 4, 2)).filter(x => x.code === 'UNDER_STAFFED');
    expect(v).toHaveLength(56);
    expect(v[0]).toMatchObject({ severity: 'warning', params: { count: 0, min: 2 } });
    expect(v[0]?.internId).toBeUndefined();
  });
  it('4 interns in a slot → HIGH_DENSITY', () => {
    const v = validate(sched([['intern-1', 0, 'DAY'], ['intern-2', 0, 'DAY'], ['intern-3', 0, 'DAY'], ['intern-4', 0, 'DAY']])).filter(x => x.code === 'HIGH_DENSITY');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ severity: 'info', dayIndex: 0, type: 'DAY', params: { count: 4 } });
  });
  it('is sorted errors, warnings, info then dayIndex', () => {
    const v = validate(sched([['intern-2', 5, 'NIGHT'], ['intern-2', 6, 'DAY'], ['intern-1', 0, 'DAY']], 4, 2));
    const sev = v.map(x => x.severity);
    expect(sev.indexOf('warning')).toBeGreaterThan(sev.lastIndexOf('error'));
    expect(sev.indexOf('info')).toBeGreaterThan(sev.lastIndexOf('warning'));
  });
});

describe('wouldViolate', () => {
  it('reports the candidate violation only', () => {
    const s = sched([['intern-1', 0, 'NIGHT'], ['intern-2', 10, 'NIGHT'], ['intern-2', 11, 'NIGHT']], 4, 2);
    const v = wouldViolate(s, { internId: 'intern-1', dayIndex: 1, type: 'DAY' });
    expect(v.map(x => x.code)).toEqual(['POST_NIGHT_DAY']);
  });
  it('never reports UNDER_STAFFED or QUOTA_INCOMPLETE and returns [] for an existing assignment', () => {
    const s = sched([['intern-1', 0, 'DAY']], 4, 2);
    expect(wouldViolate(s, { internId: 'intern-2', dayIndex: 0, type: 'DAY' })).toEqual([]);
    expect(wouldViolate(s, { internId: 'intern-1', dayIndex: 0, type: 'DAY' })).toEqual([]);
  });
  it('reports HIGH_DENSITY when the candidate makes 4', () => {
    const s = sched([['intern-1', 0, 'DAY'], ['intern-2', 0, 'DAY'], ['intern-3', 0, 'DAY']]);
    expect(wouldViolate(s, { internId: 'intern-4', dayIndex: 0, type: 'DAY' }).map(x => x.code)).toEqual(['HIGH_DENSITY']);
  });
});

describe('internPatternValid agrees with validate', () => {
  it('on 1000 random patterns', () => {
    const rng = createRng(11);
    for (let k = 0; k < 1000; k++) {
      const nights = Array.from({ length: rng.int(9) }, () => rng.int(28));
      const days = Array.from({ length: rng.int(9) }, () => rng.int(28));
      const uniq = (a: number[]) => [...new Set(a)];
      const n = uniq(nights), d = uniq(days);
      const s = sched([...n.map((x): [string, number, ShiftType] => ['intern-1', x, 'NIGHT']), ...d.map((x): [string, number, ShiftType] => ['intern-1', x, 'DAY'])]);
      const errors = hard(s).filter(v => v.code !== 'QUOTA_OVER');
      expect(internPatternValid(n, d)).toBe(errors.length === 0);
    }
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
// src/engine/rules.ts
import type { Assignment, Cell, InternId, Schedule, ShiftType } from './types';
import { DAYS, HIGH_DENSITY_AT, NIGHT_GAP_MIN, QUOTA, SHIFT_TYPES } from './types';
import { byIntern, bySlot, hasAssignment, slotKey } from './schedule';
import { at } from './util';

export type ViolationCode = 'POST_NIGHT_DAY' | 'NIGHT_GAP' | 'DOUBLE_SHIFT' | 'QUOTA_OVER' | 'QUOTA_INCOMPLETE' | 'UNDER_STAFFED' | 'HIGH_DENSITY';
export type Severity = 'error' | 'warning' | 'info';
export interface Violation {
  code: ViolationCode;
  severity: Severity;
  internId?: InternId;
  dayIndex: number;
  type?: ShiftType;
  related: Cell[];
  params: Record<string, string | number>;
}
const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function validate(schedule: Schedule): Violation[] {
  const out: Violation[] = [];
  const perIntern = byIntern(schedule);
  for (const intern of schedule.interns) {
    const list = perIntern.get(intern.id) ?? [];
    const nights = list.filter(a => a.type === 'NIGHT').map(a => a.dayIndex).sort((a, b) => a - b);
    const days = list.filter(a => a.type === 'DAY').map(a => a.dayIndex).sort((a, b) => a - b);
    const daySet = new Set(days);
    for (const n of nights) {
      if (daySet.has(n)) out.push({ code: 'DOUBLE_SHIFT', severity: 'error', internId: intern.id, dayIndex: n, type: 'NIGHT', related: [{ dayIndex: n, type: 'DAY' }], params: {} });
      if (daySet.has(n + 1)) out.push({ code: 'POST_NIGHT_DAY', severity: 'error', internId: intern.id, dayIndex: n + 1, type: 'DAY', related: [{ dayIndex: n, type: 'NIGHT' }], params: {} });
    }
    for (let k = 1; k < nights.length; k++) {
      const d1 = at(nights, k - 1), d2 = at(nights, k);
      if (d2 - d1 < NIGHT_GAP_MIN) out.push({ code: 'NIGHT_GAP', severity: 'error', internId: intern.id, dayIndex: d2, type: 'NIGHT', related: [{ dayIndex: d1, type: 'NIGHT' }], params: { gap: d2 - d1 } });
    }
    const quota: [ShiftType, number[]][] = [['DAY', days], ['NIGHT', nights]];
    for (const [type, arr] of quota) {
      if (arr.length > QUOTA) out.push({ code: 'QUOTA_OVER', severity: 'error', internId: intern.id, dayIndex: at(arr, arr.length - 1), type, related: arr.map(d => ({ dayIndex: d, type })), params: { count: arr.length } });
      else if (arr.length < QUOTA) out.push({ code: 'QUOTA_INCOMPLETE', severity: 'info', internId: intern.id, dayIndex: -1, type, related: [], params: { count: arr.length, missing: QUOTA - arr.length } });
    }
  }
  const slots = bySlot(schedule);
  for (let d = 0; d < DAYS; d++) {
    for (const type of SHIFT_TYPES) {
      const c = slots.get(slotKey(d, type))?.length ?? 0;
      if (c < schedule.minPerShift) out.push({ code: 'UNDER_STAFFED', severity: 'warning', dayIndex: d, type, related: [], params: { count: c, min: schedule.minPerShift } });
      if (c >= HIGH_DENSITY_AT) out.push({ code: 'HIGH_DENSITY', severity: 'info', dayIndex: d, type, related: [], params: { count: c } });
    }
  }
  const indexOf = new Map(schedule.interns.map(i => [i.id, i.index] as const));
  const idx = (v: Violation): number => (v.internId === undefined ? 0 : (indexOf.get(v.internId) ?? 0));
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.dayIndex - b.dayIndex || idx(a) - idx(b));
}

export function touchesCell(v: Violation, cell: Cell): boolean {
  return (v.dayIndex === cell.dayIndex && v.type === cell.type) || v.related.some(r => r.dayIndex === cell.dayIndex && r.type === cell.type);
}

const keyOf = (v: Violation): string => JSON.stringify([v.code, v.internId ?? '', v.dayIndex, v.type ?? '', v.params]);

export function wouldViolate(schedule: Schedule, candidate: Omit<Assignment, 'locked'>): Violation[] {
  if (hasAssignment(schedule, candidate.internId, candidate.dayIndex, candidate.type)) return [];
  const before = new Set(validate(schedule).map(keyOf));
  const after = validate({ ...schedule, assignments: [...schedule.assignments, { ...candidate, locked: false }] });
  const cell: Cell = { dayIndex: candidate.dayIndex, type: candidate.type };
  return after.filter(v =>
    !before.has(keyOf(v)) &&
    v.code !== 'UNDER_STAFFED' && v.code !== 'QUOTA_INCOMPLETE' &&
    ((v.internId === candidate.internId && touchesCell(v, cell)) || (v.internId === undefined && touchesCell(v, cell))),
  );
}

export function internPatternValid(nights: readonly number[], days: readonly number[]): boolean {
  const sorted = [...nights].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) if (at(sorted, k) - at(sorted, k - 1) < NIGHT_GAP_MIN) return false;
  const nightSet = new Set(sorted);
  for (const d of days) if (nightSet.has(d) || nightSet.has(d - 1)) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, expect pass** (all rows of the SPEC table)
- [ ] **Step 5: Commit** `git commit -am "task 4: rules engine"`

---

### Task 5: Solver and worker

**Files:**
- Create: `src/engine/solver.ts`, `src/engine/solver.worker.ts`
- Test: `src/engine/__tests__/solver.test.ts`

**Interfaces:**
- Consumes: Task 2, 3, 4 (`internPatternValid` is used only in tests; the solver keeps its own masks).
- Produces: `SolveOptions`, `SolveResult`, `solve(schedule, options): SolveResult`; worker message protocol `{ schedule, options } → SolveResult`.

- [ ] **Step 1: Failing tests**

```ts
// src/engine/__tests__/solver.test.ts
import { describe, it, expect } from 'vitest';
import { createSchedule, counts } from '../schedule';
import { validate } from '../rules';
import { solve } from '../solver';
import { createRng } from '../random';
import type { Schedule } from '../types';

const FAST = { moves: 20_000, restarts: 2 };
const errorsOf = (s: Schedule) => validate(s).filter(v => v.severity === 'error');
const withAssignments = (s: Schedule, assignments: Schedule['assignments']): Schedule => ({ ...s, assignments });

describe('solve: hard rules', () => {
  for (let n = 4; n <= 8; n++) {
    it(`N=${n}: 50 seeds, zero errors, full quota, nothing locked`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const s = createSchedule('2026-09-07', n);
        const r = solve(s, { seed, ...FAST });
        const out = withAssignments(s, r.assignments);
        expect(errorsOf(out)).toEqual([]);
        for (const i of s.interns) expect(counts(out, i.id)).toEqual({ day: 8, night: 8 });
        expect(r.assignments.some(a => a.locked)).toBe(false);
        expect(r.assignments).toHaveLength(16 * n);
      }
    });
  }
  it('is deterministic per seed and varies across seeds', () => {
    const s = createSchedule('2026-09-07', 6);
    expect(solve(s, { seed: 5, ...FAST })).toEqual(solve(s, { seed: 5, ...FAST }));
    expect(solve(s, { seed: 5, ...FAST }).assignments).not.toEqual(solve(s, { seed: 6, ...FAST }).assignments);
  });
  it('preserves 20% locked cells of a valid solution and stays valid, 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const base = createSchedule('2026-09-07', 5 + (seed % 4));
      const first = solve(base, { seed, ...FAST });
      const rng = createRng(seed * 31);
      const locked = first.assignments.map(a => ({ ...a, locked: rng.next() < 0.2 }));
      const pinned = locked.filter(a => a.locked);
      const second = solve(withAssignments(base, locked), { seed: seed + 100, ...FAST });
      const out = withAssignments(base, second.assignments);
      for (const p of pinned) expect(second.assignments).toContainEqual(p);
      expect(errorsOf(out)).toEqual([]);
      for (const i of base.interns) expect(counts(out, i.id)).toEqual({ day: 8, night: 8 });
    }
  });
  it('keeps contradictory locks and lets validate report them', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = [{ internId: 'intern-1', dayIndex: 5, type: 'NIGHT', locked: true }, { internId: 'intern-1', dayIndex: 6, type: 'NIGHT', locked: true }];
    const r = solve(s, { seed: 3, ...FAST });
    const out = withAssignments(s, r.assignments);
    expect(r.assignments.filter(a => a.locked)).toHaveLength(2);
    expect(counts(out, 'intern-1')).toEqual({ day: 8, night: 8 });
    expect(validate(out).some(v => v.code === 'NIGHT_GAP' && v.internId === 'intern-1')).toBe(true);
  });
  it('adds nothing for a type that is already over quota by locks', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = Array.from({ length: 9 }, (_, k) => ({ internId: 'intern-1', dayIndex: k * 3, type: 'NIGHT' as const, locked: true }));
    const r = solve(s, { seed: 3, ...FAST });
    expect(r.assignments.filter(a => a.internId === 'intern-1' && a.type === 'NIGHT')).toHaveLength(9);
    expect(r.assignments.filter(a => a.internId === 'intern-1' && a.type === 'DAY')).toHaveLength(8);
  });
});

describe('solve: staffing quality at defaults', () => {
  it('N=4 target 1 → no short slot', () => {
    for (let seed = 1; seed <= 5; seed++) { const s = createSchedule('2026-09-07', 4); expect(solve(s, { seed }).shortSlots).toBe(0); }
  });
  it('N=8 target 2 → no short slot', () => {
    for (let seed = 1; seed <= 5; seed++) { const s = createSchedule('2026-09-07', 8); expect(solve(s, { seed }).shortSlots).toBe(0); }
  });
  it('N=7 target 2 → every seed ≤ 2 short, at least 7 of 10 perfect', () => {
    let perfect = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = createSchedule('2026-09-07', 7);
      const r = solve(s, { seed });
      expect(r.shortSlots).toBeLessThanOrEqual(2);
      if (r.shortSlots === 0) perfect += 1;
    }
    expect(perfect).toBeGreaterThanOrEqual(7);
  });
  it('N=8 at defaults finishes under 2 s', () => {
    const s = createSchedule('2026-09-07', 8);
    const t = performance.now(); solve(s, { seed: 1 });
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
// src/engine/solver.ts
import type { Assignment, Schedule } from './types';
import { DAYS, NIGHT_GAP_MIN, QUOTA } from './types';
import { createRng, type Rng } from './random';
import { at, get, inc } from './util';

export interface SolveOptions { seed: number; restarts?: number; moves?: number; t0?: number; t1?: number; guided?: number }
export interface SolveResult { assignments: Assignment[]; cost: number; restartsUsed: number; shortSlots: number }

interface InternState {
  nights: number[]; days: number[];
  nightMask: boolean[]; dayMask: boolean[];
  lockedNights: ReadonlySet<number>; lockedDays: ReadonlySet<number>;
}
interface Params { n: number; min: number; avg: number; moves: number; t0: number; t1: number; guided: number }

const W_UNDER = 10, W_HIGH = 3, W_WEEK = 0.5, DENSITY_CAP = 3;

function slotCost(count: number, min: number, avg: number): number {
  const under = Math.max(0, min - count), high = Math.max(0, count - DENSITY_CAP);
  return W_UNDER * under * under + (count - avg) * (count - avg) + W_HIGH * high * high;
}
function weekCost(w: number): number { return W_WEEK * (w - 4) * (w - 4); }
function mask(list: readonly number[]): boolean[] { const m = new Array<boolean>(DAYS).fill(false); for (const d of list) m[d] = true; return m; }
function has(m: readonly boolean[], d: number): boolean { return m[d] ?? false; }

function nightOkList(d: number, nights: readonly number[], lockedDays: ReadonlySet<number>): boolean {
  if (lockedDays.has(d) || lockedDays.has(d + 1)) return false;
  for (const x of nights) if (Math.abs(d - x) < NIGHT_GAP_MIN) return false;
  return true;
}

/** Step 1: 8 nights ⊇ locked, gap ≥ 3, avoiding locked days. Randomised DFS with a node budget. */
function buildNights(rng: Rng, locked: readonly number[], lockedDays: ReadonlySet<number>): number[] {
  if (locked.length >= QUOTA) return [...locked];
  const order = rng.shuffle(Array.from({ length: DAYS }, (_, i) => i));
  const cur = [...locked];
  let best = [...cur];
  let budget = 5000;
  const rec = (start: number): boolean => {
    if (cur.length > best.length) best = [...cur];
    if (cur.length === QUOTA) return true;
    for (let i = start; i < DAYS; i++) {
      budget -= 1;
      if (budget <= 0) return false;
      const d = at(order, i);
      if (cur.includes(d) || !nightOkList(d, cur, lockedDays)) continue;
      cur.push(d);
      if (rec(i + 1)) return true;
      cur.pop();
    }
    return false;
  };
  rec(0);
  return best;
}

/** Step 2: 8 days ⊇ locked from the dates the nights leave legal. */
function buildDays(rng: Rng, nights: readonly number[], locked: readonly number[]): number[] {
  const nm = mask(nights);
  const avail: number[] = [];
  for (let d = 0; d < DAYS; d++) if (!has(nm, d) && !has(nm, d - 1) && !locked.includes(d)) avail.push(d);
  rng.shuffle(avail);
  return [...locked, ...avail.slice(0, Math.max(0, QUOTA - locked.length))];
}

function nightLegal(d2: number, s: InternState, ignore: number): boolean {
  if (has(s.dayMask, d2) || has(s.dayMask, d2 + 1)) return false;
  for (let x = d2 - NIGHT_GAP_MIN + 1; x <= d2 + NIGHT_GAP_MIN - 1; x++) if (x !== ignore && has(s.nightMask, x)) return false;
  return true;
}
function dayLegal(d2: number, s: InternState): boolean { return !has(s.nightMask, d2) && !has(s.nightMask, d2 - 1); }

function cloneState(state: readonly InternState[]): InternState[] {
  return state.map(s => ({ nights: [...s.nights], days: [...s.days], nightMask: [...s.nightMask], dayMask: [...s.dayMask], lockedNights: s.lockedNights, lockedDays: s.lockedDays }));
}
function slotCounts(state: readonly InternState[]): number[] {
  const cnt = new Array<number>(DAYS * 2).fill(0);
  for (const s of state) { for (const d of s.days) inc(cnt, d * 2, 1); for (const d of s.nights) inc(cnt, d * 2 + 1, 1); }
  return cnt;
}
function totalCost(state: readonly InternState[], p: Params): number {
  const cnt = slotCounts(state);
  let c = 0;
  for (let k = 0; k < DAYS * 2; k++) c += slotCost(get(cnt, k), p.min, p.avg);
  for (const s of state) { const w = [0, 0, 0, 0]; for (const d of s.days) inc(w, Math.floor(d / 7), 1); for (const d of s.nights) inc(w, Math.floor(d / 7), 1); for (const x of w) c += weekCost(x); }
  return c;
}

/** Step 3: simulated annealing with plateau acceptance and guided moves. Mutates `state`, returns the best copy. */
function anneal(state: InternState[], rng: Rng, p: Params): { cost: number; state: InternState[] } {
  const cnt = slotCounts(state);
  const wk = new Array<number>(p.n * 4).fill(0);
  state.forEach((s, i) => { for (const d of s.days) inc(wk, i * 4 + Math.floor(d / 7), 1); for (const d of s.nights) inc(wk, i * 4 + Math.floor(d / 7), 1); });
  let cost = totalCost(state, p);
  let bestCost = cost;
  let bestState = cloneState(state);
  for (let m = 0; m < p.moves; m++) {
    const temp = p.t0 * Math.pow(p.t1 / p.t0, m / p.moves);
    let i = rng.int(p.n);
    let t: 0 | 1 = rng.next() < 0.5 ? 0 : 1;
    let d2 = rng.int(DAYS);
    if (rng.next() < p.guided) {
      const short: number[] = [];
      for (let k = 0; k < DAYS * 2; k++) if (get(cnt, k) < p.min) short.push(k);
      if (short.length > 0) { const k = rng.pick(short); d2 = Math.floor(k / 2); t = k % 2 === 1 ? 1 : 0; i = rng.int(p.n); }
    }
    const s = at(state, i);
    const list = t === 1 ? s.nights : s.days;
    const own = t === 1 ? s.nightMask : s.dayMask;
    if (has(own, d2)) continue;
    const lockedSet = t === 1 ? s.lockedNights : s.lockedDays;
    const movable = list.filter(d => !lockedSet.has(d));
    if (movable.length === 0) continue;
    const d1 = rng.pick(movable);
    if (!(t === 1 ? nightLegal(d2, s, d1) : dayLegal(d2, s))) continue;
    const c1 = get(cnt, d1 * 2 + t), c2 = get(cnt, d2 * 2 + t);
    let delta = slotCost(c1 - 1, p.min, p.avg) - slotCost(c1, p.min, p.avg) + slotCost(c2 + 1, p.min, p.avg) - slotCost(c2, p.min, p.avg);
    const w1 = Math.floor(d1 / 7), w2 = Math.floor(d2 / 7);
    if (w1 !== w2) { const a = get(wk, i * 4 + w1), b = get(wk, i * 4 + w2); delta += weekCost(a - 1) - weekCost(a) + weekCost(b + 1) - weekCost(b); }
    if (delta <= 0 || rng.next() < Math.exp(-delta / temp)) {
      list[list.indexOf(d1)] = d2;
      own[d1] = false; own[d2] = true;
      inc(cnt, d1 * 2 + t, -1); inc(cnt, d2 * 2 + t, 1);
      if (w1 !== w2) { inc(wk, i * 4 + w1, -1); inc(wk, i * 4 + w2, 1); }
      cost += delta;
      if (cost < bestCost - 1e-9) { bestCost = cost; bestState = cloneState(state); }
    }
  }
  return { cost: totalCost(bestState, p), state: bestState };
}

function isIdeal(state: readonly InternState[], min: number, ceilAvg: number): boolean {
  const cnt = slotCounts(state);
  for (let k = 0; k < DAYS * 2; k++) { const c = get(cnt, k); if (c < min || c > ceilAvg) return false; }
  return true;
}
function countShort(state: readonly InternState[], min: number): number {
  const cnt = slotCounts(state); let n = 0;
  for (let k = 0; k < DAYS * 2; k++) if (get(cnt, k) < min) n += 1;
  return n;
}

export function solve(schedule: Schedule, options: SolveOptions): SolveResult {
  const n = schedule.interns.length;
  const p: Params = { n, min: schedule.minPerShift, avg: (16 * n) / 56, moves: options.moves ?? 300_000, t0: options.t0 ?? 3, t1: options.t1 ?? 0.05, guided: options.guided ?? 0.3 };
  const restarts = Math.max(1, options.restarts ?? 4);
  const ceilAvg = Math.ceil(p.avg);
  const locked = schedule.assignments.filter(a => a.locked);
  const run = (r: number): { cost: number; state: InternState[] } => {
    const rng = createRng(options.seed + r * 7919);
    const state: InternState[] = schedule.interns.map(intern => {
      const ln = locked.filter(a => a.internId === intern.id && a.type === 'NIGHT').map(a => a.dayIndex);
      const ld = locked.filter(a => a.internId === intern.id && a.type === 'DAY').map(a => a.dayIndex);
      const nights = buildNights(rng, ln, new Set(ld));
      const days = buildDays(rng, nights, ld);
      return { nights, days, nightMask: mask(nights), dayMask: mask(days), lockedNights: new Set(ln), lockedDays: new Set(ld) };
    });
    return anneal(state, rng, p);
  };
  let best = run(0);
  let restartsUsed = 1;
  for (let r = 1; r < restarts && !isIdeal(best.state, p.min, ceilAvg); r++) {
    restartsUsed = r + 1;
    const cand = run(r);
    if (cand.cost < best.cost) best = cand;
  }
  const assignments: Assignment[] = [];
  schedule.interns.forEach((intern, k) => {
    const s = at(best.state, k);
    for (const d of s.days) assignments.push({ internId: intern.id, dayIndex: d, type: 'DAY', locked: s.lockedDays.has(d) });
    for (const d of s.nights) assignments.push({ internId: intern.id, dayIndex: d, type: 'NIGHT', locked: s.lockedNights.has(d) });
  });
  const order = new Map(schedule.interns.map(i => [i.id, i.index] as const));
  assignments.sort((a, b) => a.dayIndex - b.dayIndex || (a.type === b.type ? 0 : a.type === 'DAY' ? -1 : 1) || (order.get(a.internId) ?? 0) - (order.get(b.internId) ?? 0));
  return { assignments, cost: best.cost, restartsUsed, shortSlots: countShort(best.state, p.min) };
}
```

```ts
// src/engine/solver.worker.ts
import { solve, type SolveOptions } from './solver';
import type { Schedule } from './types';
self.onmessage = (e: MessageEvent<{ schedule: Schedule; options: SolveOptions }>) => {
  self.postMessage(solve(e.data.schedule, e.data.options));
};
```

- [ ] **Step 4: Run tests, expect pass.** If the N = 7 quality test fails, raise `moves` (try 400 000) and record the change in `memory.md`; do not lower the assertion. If the 2 s budget fails, profile `anneal` (the `filter` in `movable` and `cloneState` frequency are the usual suspects) before touching parameters.
- [ ] **Step 5: Commit** `git commit -am "task 5: annealing solver and worker"`

---

### Task 6: Shuffle and codec

**Files:**
- Create: `src/engine/shuffle.ts`, `src/engine/codec.ts`
- Test: `src/engine/__tests__/shuffle.test.ts`, `src/engine/__tests__/codec.test.ts`

**Interfaces:**
- Produces: `shuffleNames(interns, rng): Intern[]`; `encodeHash(schedule): string` (without the `#`), `decodeHash(hash): Schedule | null`, `isSchedule(x: unknown): Schedule | null`, `toBase64Url(s)`, `fromBase64Url(s)`.

- [ ] **Step 1: Failing tests**

```ts
// src/engine/__tests__/shuffle.test.ts
import { describe, it, expect } from 'vitest';
import { makeInterns } from '../schedule';
import { shuffleNames } from '../shuffle';
import { createRng } from '../random';

describe('shuffleNames', () => {
  it('permutes names, keeps ids and colours, changes at least one', () => {
    const interns = makeInterns(5).map((i, k) => ({ ...i, realName: ['Ali', 'Ayşe', 'Can', '', 'Zeynep'][k] ?? '' }));
    const out = shuffleNames(interns, createRng(1));
    expect(out.map(i => i.id)).toEqual(interns.map(i => i.id));
    expect(out.map(i => i.colorKey)).toEqual(interns.map(i => i.colorKey));
    expect([...out.map(i => i.realName)].sort()).toEqual([...interns.map(i => i.realName)].sort());
    expect(out.some((i, k) => i.realName !== interns[k]?.realName)).toBe(true);
  });
  it('is identity when all names are blank or identical', () => {
    expect(shuffleNames(makeInterns(4), createRng(1)).map(i => i.realName)).toEqual(['', '', '', '']);
    const same = makeInterns(4).map(i => ({ ...i, realName: 'X' }));
    expect(shuffleNames(same, createRng(1)).map(i => i.realName)).toEqual(['X', 'X', 'X', 'X']);
  });
});
```

```ts
// src/engine/__tests__/codec.test.ts
import { describe, it, expect } from 'vitest';
import { createSchedule } from '../schedule';
import { decodeHash, encodeHash, isSchedule } from '../codec';
import { solve } from '../solver';
import { createRng } from '../random';
import type { Schedule } from '../types';

function randomSchedule(seed: number): Schedule {
  const rng = createRng(seed);
  const n = 4 + rng.int(5);
  const s = createSchedule('2026-09-07', n);
  s.minPerShift = 1 + rng.int(4);
  s.interns = s.interns.map((i, k) => ({ ...i, realName: k % 2 === 0 ? `Dr. Şükrü ${k} İğne` : '' }));
  s.assignments = solve(s, { seed, moves: 2000, restarts: 1 }).assignments.map(a => ({ ...a, locked: rng.next() < 0.3 }));
  return s;
}

describe('hash codec', () => {
  it('round-trips 200 random schedules', () => {
    for (let seed = 1; seed <= 200; seed++) { const s = randomSchedule(seed); expect(decodeHash(encodeHash(s))).toEqual(s); }
  });
  it('encodes blank names as an empty field and is short', () => {
    const s = createSchedule('2026-09-07', 4);
    const h = encodeHash(s);
    expect(h).toBe(`v1.20260907.4.1..${'0'.repeat(224)}`);
    expect(h.length).toBeLessThan(600);
  });
  it('rejects malformed input', () => {
    const good = encodeHash(randomSchedule(3));
    expect(decodeHash('#' + good)).not.toBeNull();
    expect(decodeHash(good.replace('v1.', 'v2.'))).toBeNull();
    expect(decodeHash(good.replace('20260907', '20260908'))).toBeNull();     // Tuesday
    expect(decodeHash(good.slice(0, -1))).toBeNull();                        // grid too short
    expect(decodeHash(good.slice(0, -1) + '3')).toBeNull();                  // bad char
    expect(decodeHash(good.replace(/\.(\d)\.(\d)\./, '.9.$2.'))).toBeNull(); // N out of range
    expect(decodeHash(good.replace(/\.(\d)\.(\d)\./, '.$1.7.'))).toBeNull(); // min out of range
    expect(decodeHash('')).toBeNull();
    expect(decodeHash('v1.20260907.4.1.!!!.' + '0'.repeat(224))).toBeNull(); // bad base64
  });
});

describe('isSchedule', () => {
  it('accepts a valid schedule and rejects each broken invariant', () => {
    const s = randomSchedule(9);
    expect(isSchedule(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(isSchedule({ ...s, version: 2 })).toBeNull();
    expect(isSchedule({ ...s, startDate: '2026-09-08' })).toBeNull();
    expect(isSchedule({ ...s, interns: s.interns.slice(0, 3) })).toBeNull();
    expect(isSchedule({ ...s, minPerShift: 0 })).toBeNull();
    expect(isSchedule({ ...s, assignments: [...s.assignments, { internId: 'intern-9', dayIndex: 0, type: 'DAY', locked: false }] })).toBeNull();
    expect(isSchedule({ ...s, assignments: [...s.assignments, { ...s.assignments[0] }] })).toBeNull();   // duplicate
    expect(isSchedule({ ...s, assignments: [{ internId: 'intern-1', dayIndex: 28, type: 'DAY', locked: false }] })).toBeNull();
    expect(isSchedule('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
// src/engine/shuffle.ts
import type { Intern } from './types';
import type { Rng } from './random';
import { at } from './util';

export function shuffleNames(interns: readonly Intern[], rng: Rng): Intern[] {
  const names = interns.map(i => i.realName);
  if (new Set(names).size < 2) return interns.map(i => ({ ...i }));
  for (let attempt = 0; attempt < 10; attempt++) {
    const perm = rng.shuffle([...names]);
    if (perm.some((name, k) => name !== names[k])) return interns.map((i, k) => ({ ...i, realName: at(perm, k) }));
  }
  return interns.map(i => ({ ...i }));
}
```

```ts
// src/engine/codec.ts
import type { Assignment, Intern, Schedule, ShiftType } from './types';
import { DAYS, MAX_INTERNS, MIN_INTERNS, MIN_PER_SHIFT_MAX, MIN_PER_SHIFT_MIN, NAME_MAX } from './types';
import { isMonday } from './dates';
import { makeInterns } from './schedule';

const VERSION = 'v1';

export function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64Url(s: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}

export function encodeHash(s: Schedule): string {
  const date = s.startDate.replace(/-/g, '');
  const names = s.interns.map(i => i.realName);
  const namesField = names.every(x => x === '') ? '' : toBase64Url(JSON.stringify(names));
  const grid = s.interns.map(intern => {
    const row = new Array<string>(DAYS * 2).fill('0');
    for (const a of s.assignments) if (a.internId === intern.id) row[a.dayIndex * 2 + (a.type === 'NIGHT' ? 1 : 0)] = a.locked ? '2' : '1';
    return row.join('');
  }).join('');
  return `${VERSION}.${date}.${s.interns.length}.${s.minPerShift}.${namesField}.${grid}`;
}

export function decodeHash(raw: string): Schedule | null {
  const hash = raw.startsWith('#') ? raw.slice(1) : raw;
  const parts = hash.split('.');
  if (parts.length !== 6) return null;
  const [v, date, nStr, minStr, namesField, grid] = parts;
  if (v !== VERSION || date === undefined || nStr === undefined || minStr === undefined || namesField === undefined || grid === undefined) return null;
  if (!/^\d{8}$/.test(date)) return null;
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (!isMonday(iso)) return null;
  const n = Number(nStr), min = Number(minStr);
  if (!Number.isInteger(n) || n < MIN_INTERNS || n > MAX_INTERNS) return null;
  if (!Number.isInteger(min) || min < MIN_PER_SHIFT_MIN || min > MIN_PER_SHIFT_MAX) return null;
  let names: string[] = [];
  if (namesField !== '') {
    try {
      const parsed: unknown = JSON.parse(fromBase64Url(namesField));
      if (!Array.isArray(parsed) || !parsed.every((x): x is string => typeof x === 'string')) return null;
      names = parsed;
    } catch { return null; }
  }
  if (grid.length !== DAYS * 2 * n || !/^[012]*$/.test(grid)) return null;
  const interns: Intern[] = makeInterns(n).map((i, k) => ({ ...i, realName: (names[k] ?? '').trim().slice(0, NAME_MAX) }));
  const assignments: Assignment[] = [];
  interns.forEach((intern, k) => {
    for (let p = 0; p < DAYS * 2; p++) {
      const ch = grid[k * DAYS * 2 + p];
      if (ch === undefined || ch === '0') continue;
      const type: ShiftType = p % 2 === 1 ? 'NIGHT' : 'DAY';
      assignments.push({ internId: intern.id, dayIndex: Math.floor(p / 2), type, locked: ch === '2' });
    }
  });
  return { version: 1, startDate: iso, interns, minPerShift: min, assignments };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

export function isSchedule(x: unknown): Schedule | null {
  if (!isRecord(x) || x['version'] !== 1) return null;
  const { startDate, interns, minPerShift, assignments } = x;
  if (typeof startDate !== 'string' || !isMonday(startDate)) return null;
  if (!Array.isArray(interns) || interns.length < MIN_INTERNS || interns.length > MAX_INTERNS) return null;
  const cleanInterns = makeInterns(interns.length);
  for (let k = 0; k < interns.length; k++) {
    const raw: unknown = interns[k];
    const expected = cleanInterns[k];
    if (!isRecord(raw) || expected === undefined || raw['id'] !== expected.id || raw['index'] !== expected.index) return null;
    const name = raw['realName'];
    if (typeof name !== 'string') return null;
    expected.realName = name.trim().slice(0, NAME_MAX);
  }
  if (typeof minPerShift !== 'number' || !Number.isInteger(minPerShift) || minPerShift < MIN_PER_SHIFT_MIN || minPerShift > MIN_PER_SHIFT_MAX) return null;
  if (!Array.isArray(assignments)) return null;
  const ids = new Set(cleanInterns.map(i => i.id));
  const seen = new Set<string>();
  const cleanAssignments: Assignment[] = [];
  for (const raw of assignments as unknown[]) {
    if (!isRecord(raw)) return null;
    const { internId, dayIndex, type, locked } = raw;
    if (typeof internId !== 'string' || !ids.has(internId)) return null;
    if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= DAYS) return null;
    if (type !== 'DAY' && type !== 'NIGHT') return null;
    if (typeof locked !== 'boolean') return null;
    const key = `${internId}|${dayIndex}|${type}`;
    if (seen.has(key)) return null;
    seen.add(key);
    cleanAssignments.push({ internId, dayIndex, type, locked });
  }
  return { version: 1, startDate, interns: cleanInterns, minPerShift, assignments: cleanAssignments };
}
```

- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 6: shuffle and codec"`

---

### Task 7: i18n

**Files:**
- Create: `src/i18n/tr.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`
- Test: `src/i18n/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `type Key`, `t(lang, key, params?)`, `LangProvider`, `useLang(): { lang, setLang }`, `useT(): (key, params?) => string`, `internLabel(intern, lang)`, `violationMessage(v, schedule, lang)`, `formatNumber(x, lang)`.

- [ ] **Step 1: Failing test**

```ts
// src/i18n/__tests__/i18n.test.ts
import { describe, it, expect } from 'vitest';
import { tr } from '../tr';
import { en } from '../en';
import { t } from '../index';

describe('dictionaries', () => {
  it('have identical key sets', () => { expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort()); });
  it('have identical placeholders per key', () => {
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      const p = (s: string) => (s.match(/\{[a-z0-9]+\}/gi) ?? []).sort();
      expect(p(en[key])).toEqual(p(tr[key]));
    }
  });
  it('t replaces params', () => {
    expect(t('tr', 'intern.placeholder', { n: 3 })).toBe('İntörn 3');
    expect(t('en', 'chip.counts', { day: 1, night: 2 })).toBe('D 1/8 · N 2/8');
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement.** Copy every row of SPEC §9 into `tr.ts` and `en.ts` exactly; do not paraphrase.

```ts
// src/i18n/tr.ts
export const tr = {
  'app.title': 'Acil nöbet planlayıcı',
  'setup.period.title': 'Dönem',
  // ... every key from SPEC §9, in order ...
  'a11y.slot': '{date} {shift} nöbeti',
} as const;
export type Key = keyof typeof tr;
```

```ts
// src/i18n/en.ts
import type { Key } from './tr';
export const en: Record<Key, string> = {
  'app.title': 'Emergency shift planner',
  // ... every key ...
  'a11y.slot': '{date} {shift} shift',
};
```

```ts
// src/i18n/index.ts
import { createContext, useContext, type ReactNode } from 'react';
import { tr, type Key } from './tr';
import { en } from './en';
import type { Intern, Lang, Schedule } from '../engine/types';
import type { Violation } from '../engine/rules';
import { formatDay } from '../engine/dates';

const DICT: Record<Lang, Record<Key, string>> = { tr, en };
export type Params = Record<string, string | number>;

export function t(lang: Lang, key: Key, params?: Params): string {
  let s: string = DICT[lang][key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
export function formatNumber(x: number, lang: Lang, digits = 1): string {
  return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: digits }).format(x);
}
export function internLabel(intern: Intern, lang: Lang): string {
  return intern.realName !== '' ? intern.realName : t(lang, 'intern.placeholder', { n: intern.index });
}
export function violationMessage(v: Violation, schedule: Schedule, lang: Lang): string {
  const intern = schedule.interns.find(i => i.id === v.internId);
  const shiftWord = (type: 'DAY' | 'NIGHT' | undefined): string => (type === 'NIGHT' ? t(lang, 'shift.night') : t(lang, 'shift.day')).toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');
  const date = (d: number) => formatDay(schedule.startDate, d, lang, 'd MMM EEE');
  const base: Params = { ...v.params, intern: intern ? internLabel(intern, lang) : '', shift: shiftWord(v.type), date: v.dayIndex >= 0 ? date(v.dayIndex) : '' };
  switch (v.code) {
    case 'POST_NIGHT_DAY': return t(lang, 'v.POST_NIGHT_DAY', { ...base, date: date(v.related[0]?.dayIndex ?? v.dayIndex - 1) });
    case 'NIGHT_GAP': return t(lang, 'v.NIGHT_GAP', { ...base, date1: date(v.related[0]?.dayIndex ?? v.dayIndex), date2: date(v.dayIndex) });
    case 'UNDER_STAFFED': return t(lang, v.params['count'] === 0 ? 'v.UNDER_STAFFED.empty' : 'v.UNDER_STAFFED', base);
    default: return t(lang, `v.${v.code}` as Key, base);
  }
}

interface LangCtx { lang: Lang; setLang: (l: Lang) => void }
const LangContext = createContext<LangCtx>({ lang: 'tr', setLang: () => undefined });
export function LangProvider({ lang, setLang, children }: LangCtx & { children: ReactNode }) {
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}
export function useLang(): LangCtx { return useContext(LangContext); }
export function useT(): (key: Key, params?: Params) => string { const { lang } = useLang(); return (key, params) => t(lang, key, params); }
```

(`index.tsx` if JSX is used; keep the import paths above.)

- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 7: i18n dictionaries"`

---

### Task 8: State: reducer, persistence, store, violations hook, solver client

**Files:**
- Create: `src/state/reducer.ts`, `src/state/persistence.ts`, `src/state/store.tsx`, `src/state/useViolations.ts`, `src/state/solverClient.ts`
- Test: `src/state/__tests__/reducer.test.ts`

**Interfaces:**
- Consumes: engine.
- Produces: `AppState`, `UiState`, `Action`, `reducer`, `initialState(): AppState`, `HISTORY_CAP = 100`; `loadPersisted(): Persisted | null`, `savePersisted(state)`, `STORAGE_KEY = 'emed-nobet.v1'`; `StoreProvider`, `useStore(): { state, dispatch }`; `useViolations(): { list, byCell: Map<SlotKey, Violation[]>, byInternSlot: Map<string, Violation[]>, severityOfCell(key), severityOfChip(internId, key) }`; `runSolver(schedule, seed): Promise<SolveResult>`.

- [ ] **Step 1: Failing test**

```ts
// src/state/__tests__/reducer.test.ts
import { describe, it, expect } from 'vitest';
import { initialState, reducer, type AppState } from '../reducer';
import { createSchedule } from '../../engine/schedule';

const base = (): AppState => ({ ...initialState(), schedule: createSchedule('2026-09-07', 4) });
const assign = (s: AppState, internId: string, dayIndex: number, shift: 'DAY' | 'NIGHT') => reducer(s, { type: 'ASSIGN', internId, dayIndex, shift });

describe('reducer', () => {
  it('ASSIGN adds once and is undoable', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = assign(s, 'intern-1', 0, 'DAY');
    expect(s.schedule.assignments).toHaveLength(1);
    expect(s.past).toHaveLength(1);
    s = reducer(s, { type: 'UNDO' });
    expect(s.schedule.assignments).toHaveLength(0);
    expect(s.future).toHaveLength(1);
    s = reducer(s, { type: 'REDO' });
    expect(s.schedule.assignments).toHaveLength(1);
  });
  it('MOVE carries locked and refuses a duplicate target', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'TOGGLE_LOCK', internId: 'intern-1', dayIndex: 0, shift: 'DAY' });
    s = reducer(s, { type: 'MOVE', internId: 'intern-1', from: { dayIndex: 0, shift: 'DAY' }, to: { dayIndex: 2, shift: 'NIGHT' } });
    expect(s.schedule.assignments).toEqual([{ internId: 'intern-1', dayIndex: 2, type: 'NIGHT', locked: true }]);
    s = assign(s, 'intern-1', 5, 'DAY');
    const before = s;
    s = reducer(s, { type: 'MOVE', internId: 'intern-1', from: { dayIndex: 5, shift: 'DAY' }, to: { dayIndex: 2, shift: 'NIGHT' } });
    expect(s).toBe(before);
  });
  it('SET_INTERN_COUNT shrink drops assignments of removed interns, grow keeps names', () => {
    let s = reducer(base(), { type: 'SET_INTERN_COUNT', n: 6 });
    s = reducer(s, { type: 'SET_INTERN_NAME', id: 'intern-6', name: '  Ayşe  ' });
    s = assign(s, 'intern-6', 3, 'NIGHT');
    expect(s.schedule.interns[5]?.realName).toBe('Ayşe');
    s = reducer(s, { type: 'SET_INTERN_COUNT', n: 5 });
    expect(s.schedule.interns).toHaveLength(5);
    expect(s.schedule.assignments).toHaveLength(0);
    expect(s.schedule.minPerShift).toBe(1);
  });
  it('SET_START_DATE ignores non-Mondays; SET_MIN_PER_SHIFT clamps; neither is undoable', () => {
    let s = reducer(base(), { type: 'SET_START_DATE', isoDate: '2026-09-08' });
    expect(s.schedule.startDate).toBe('2026-09-07');
    s = reducer(s, { type: 'SET_START_DATE', isoDate: '2026-09-14' });
    expect(s.schedule.startDate).toBe('2026-09-14');
    s = reducer(s, { type: 'SET_MIN_PER_SHIFT', n: 9 });
    expect(s.schedule.minPerShift).toBe(4);
    expect(s.past).toHaveLength(0);
  });
  it('RESET honours keepLocked; RANDOMIZE replaces; LOAD clears history; cap 100', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'TOGGLE_LOCK', internId: 'intern-1', dayIndex: 0, shift: 'DAY' });
    s = assign(s, 'intern-2', 1, 'DAY');
    s = reducer(s, { type: 'RESET', keepLocked: true });
    expect(s.schedule.assignments).toHaveLength(1);
    s = reducer(s, { type: 'RANDOMIZE', assignments: [{ internId: 'intern-3', dayIndex: 4, type: 'NIGHT', locked: false }] });
    expect(s.schedule.assignments).toHaveLength(1);
    s = reducer(s, { type: 'LOAD_SCHEDULE', schedule: createSchedule('2026-09-21', 5) });
    expect(s.past).toHaveLength(0); expect(s.future).toHaveLength(0);
    for (let k = 0; k < 120; k++) s = assign(s, `intern-${1 + (k % 5)}`, k % 28, k % 2 === 0 ? 'DAY' : 'NIGHT');
    expect(s.past.length).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
// src/state/reducer.ts
import type { Assignment, InternId, Lang, Schedule, ShiftType } from '../engine/types';
import { MIN_PER_SHIFT_MAX, MIN_PER_SHIFT_MIN, NAME_MAX } from '../engine/types';
import { createSchedule, defaultMinPerShift, hasAssignment, makeInterns } from '../engine/schedule';
import { isMonday, nextMonday } from '../engine/dates';
import { shuffleNames } from '../engine/shuffle';
import { createRng } from '../engine/random';

export interface UiState { step: 'setup' | 'board'; view: 'calendar' | 'matrix'; lang: Lang; theme: 'system' | 'light' | 'dark'; settingsOpen: boolean }
export interface AppState { schedule: Schedule; past: Schedule[]; future: Schedule[]; ui: UiState }
interface CellRef { dayIndex: number; shift: ShiftType }
export type Action =
  | { type: 'SET_START_DATE'; isoDate: string }
  | { type: 'SET_INTERN_COUNT'; n: number }
  | { type: 'SET_INTERN_NAME'; id: InternId; name: string }
  | { type: 'SET_MIN_PER_SHIFT'; n: number }
  | { type: 'ASSIGN'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'UNASSIGN'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'MOVE'; internId: InternId; from: CellRef; to: CellRef }
  | { type: 'TOGGLE_LOCK'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'RANDOMIZE'; assignments: Assignment[] }
  | { type: 'SHUFFLE_NAMES'; seed: number }
  | { type: 'RESET'; keepLocked: boolean }
  | { type: 'LOAD_SCHEDULE'; schedule: Schedule }
  | { type: 'UNDO' } | { type: 'REDO' }
  | { type: 'SET_VIEW'; view: UiState['view'] } | { type: 'SET_LANG'; lang: Lang } | { type: 'SET_THEME'; theme: UiState['theme'] }
  | { type: 'SET_STEP'; step: UiState['step'] } | { type: 'SET_SETTINGS_OPEN'; open: boolean };

export const HISTORY_CAP = 100;

export function initialState(now: Date = new Date()): AppState {
  return { schedule: createSchedule(nextMonday(now), 6), past: [], future: [], ui: { step: 'setup', view: 'calendar', lang: 'tr', theme: 'system', settingsOpen: false } };
}

function withHistory(state: AppState, schedule: Schedule): AppState {
  if (schedule === state.schedule) return state;
  return { ...state, schedule, past: [...state.past, state.schedule].slice(-HISTORY_CAP), future: [] };
}
const same = (a: Assignment, internId: InternId, dayIndex: number, type: ShiftType) => a.internId === internId && a.dayIndex === dayIndex && a.type === type;

export function reducer(state: AppState, action: Action): AppState {
  const s = state.schedule;
  switch (action.type) {
    case 'SET_START_DATE':
      return isMonday(action.isoDate) ? { ...state, schedule: { ...s, startDate: action.isoDate } } : state;
    case 'SET_INTERN_COUNT': {
      const interns = makeInterns(action.n, s.interns);
      if (interns.length === s.interns.length) return state;
      const ids = new Set(interns.map(i => i.id));
      return withHistory(state, { ...s, interns, assignments: s.assignments.filter(a => ids.has(a.internId)), minPerShift: defaultMinPerShift(interns.length) });
    }
    case 'SET_INTERN_NAME':
      return { ...state, schedule: { ...s, interns: s.interns.map(i => (i.id === action.id ? { ...i, realName: action.name.trim().slice(0, NAME_MAX) } : i)) } };
    case 'SET_MIN_PER_SHIFT':
      return { ...state, schedule: { ...s, minPerShift: Math.min(MIN_PER_SHIFT_MAX, Math.max(MIN_PER_SHIFT_MIN, Math.round(action.n))) } };
    case 'ASSIGN':
      if (hasAssignment(s, action.internId, action.dayIndex, action.shift) || !s.interns.some(i => i.id === action.internId)) return state;
      return withHistory(state, { ...s, assignments: [...s.assignments, { internId: action.internId, dayIndex: action.dayIndex, type: action.shift, locked: false }] });
    case 'UNASSIGN':
      return withHistory(state, { ...s, assignments: s.assignments.filter(a => !same(a, action.internId, action.dayIndex, action.shift)) });
    case 'MOVE': {
      const src = s.assignments.find(a => same(a, action.internId, action.from.dayIndex, action.from.shift));
      if (!src || hasAssignment(s, action.internId, action.to.dayIndex, action.to.shift)) return state;
      return withHistory(state, { ...s, assignments: s.assignments.map(a => (a === src ? { ...a, dayIndex: action.to.dayIndex, type: action.to.shift } : a)) });
    }
    case 'TOGGLE_LOCK':
      return withHistory(state, { ...s, assignments: s.assignments.map(a => (same(a, action.internId, action.dayIndex, action.shift) ? { ...a, locked: !a.locked } : a)) });
    case 'RANDOMIZE':
      return withHistory(state, { ...s, assignments: action.assignments });
    case 'SHUFFLE_NAMES':
      return withHistory(state, { ...s, interns: shuffleNames(s.interns, createRng(action.seed)) });
    case 'RESET':
      return withHistory(state, { ...s, assignments: action.keepLocked ? s.assignments.filter(a => a.locked) : [] });
    case 'LOAD_SCHEDULE':
      return { ...state, schedule: action.schedule, past: [], future: [] };
    case 'UNDO': {
      const prev = state.past[state.past.length - 1];
      return prev ? { ...state, schedule: prev, past: state.past.slice(0, -1), future: [s, ...state.future] } : state;
    }
    case 'REDO': {
      const next = state.future[0];
      return next ? { ...state, schedule: next, past: [...state.past, s], future: state.future.slice(1) } : state;
    }
    case 'SET_VIEW': return { ...state, ui: { ...state.ui, view: action.view } };
    case 'SET_LANG': return { ...state, ui: { ...state.ui, lang: action.lang } };
    case 'SET_THEME': return { ...state, ui: { ...state.ui, theme: action.theme } };
    case 'SET_STEP': return { ...state, ui: { ...state.ui, step: action.step } };
    case 'SET_SETTINGS_OPEN': return { ...state, ui: { ...state.ui, settingsOpen: action.open } };
  }
}
```

```ts
// src/state/persistence.ts
import type { AppState, UiState } from './reducer';
import { isSchedule } from '../engine/codec';
import type { Schedule } from '../engine/types';
export const STORAGE_KEY = 'emed-nobet.v1';
export interface Persisted { schedule: Schedule; ui: Pick<UiState, 'lang' | 'theme' | 'step' | 'view'> }
export function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    const schedule = isSchedule(rec['schedule']);
    if (!schedule) return null;
    const ui = rec['ui'] as Partial<Persisted['ui']> | undefined;
    return { schedule, ui: { lang: ui?.lang === 'en' ? 'en' : 'tr', theme: ui?.theme === 'light' || ui?.theme === 'dark' ? ui.theme : 'system', step: ui?.step === 'board' ? 'board' : 'setup', view: ui?.view === 'matrix' ? 'matrix' : 'calendar' } };
  } catch { return null; }
}
export function savePersisted(state: AppState): void {
  try {
    const { lang, theme, step, view } = state.ui;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule: state.schedule, ui: { lang, theme, step, view } }));
  } catch { /* quota or privacy mode: ignore */ }
}
```

```tsx
// src/state/store.tsx
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode, type Dispatch } from 'react';
import { initialState, reducer, type Action, type AppState } from './reducer';
import { loadPersisted, savePersisted } from './persistence';

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);
function boot(): AppState {
  const base = initialState();
  const saved = loadPersisted();
  return saved ? { ...base, schedule: saved.schedule, ui: { ...base.ui, ...saved.ui } } : base;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, boot);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => savePersisted(state), 300);
    return () => window.clearTimeout(timer.current);
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
export function useStore() { const v = useContext(Ctx); if (!v) throw new Error('StoreProvider missing'); return v; }
```

```ts
// src/state/useViolations.ts
import { useMemo } from 'react';
import { useStore } from './store';
import { validate, type Severity, type Violation } from '../engine/rules';
import { slotKey } from '../engine/schedule';
import type { SlotKey } from '../engine/types';

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const worst = (list: Violation[] | undefined): Severity | null => list && list.length > 0 ? list.reduce<Severity>((acc, v) => (RANK[v.severity] < RANK[acc] ? v.severity : acc), 'info') : null;

export function useViolations() {
  const { state } = useStore();
  return useMemo(() => {
    const list = validate(state.schedule);
    const byCell = new Map<SlotKey, Violation[]>();
    const byInternSlot = new Map<string, Violation[]>();
    const push = <K,>(m: Map<K, Violation[]>, k: K, v: Violation) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
    for (const v of list) {
      if (v.dayIndex < 0 || !v.type) continue;
      const cells = [{ dayIndex: v.dayIndex, type: v.type }, ...v.related];
      for (const c of cells) {
        const k = slotKey(c.dayIndex, c.type);
        push(byCell, k, v);
        if (v.internId) push(byInternSlot, `${v.internId}@${k}`, v);
      }
    }
    return {
      list, byCell, byInternSlot,
      severityOfCell: (key: SlotKey) => worst(byCell.get(key)?.filter(v => v.internId === undefined)),
      severityOfChip: (internId: string, key: SlotKey) => worst(byInternSlot.get(`${internId}@${key}`)),
    };
  }, [state.schedule]);
}
```

```ts
// src/state/solverClient.ts
import type { Schedule } from '../engine/types';
import type { SolveResult } from '../engine/solver';
export function runSolver(schedule: Schedule, seed: number): Promise<SolveResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../engine/solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SolveResult>) => { resolve(e.data); worker.terminate(); };
    worker.onerror = (err) => { reject(err); worker.terminate(); };
    worker.postMessage({ schedule, options: { seed } });
  });
}
```

- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 8: state, persistence, store, violations, solver client"`

---

### Task 9: UI primitives and theme

**Files:**
- Create: `src/components/ui/Button.tsx`, `IconButton.tsx`, `Segmented.tsx`, `Stepper.tsx`, `Popover.tsx`, `Dialog.tsx`, `Sheet.tsx`, `Tooltip.tsx`, `Toast.tsx`, `Menu.tsx`, `ThemeProvider.tsx`
- Test: `src/components/ui/__tests__/primitives.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant: 'primary' | 'quiet' | 'destructive', size?: 'md', busy?: boolean, ...buttonProps })`
  - `IconButton({ label: string, icon: LucideIcon, ...buttonProps })` always renders a tooltip and `aria-label`
  - `Segmented<T extends string>({ value, options: { value: T; label: string }[], onChange, ariaLabel })` as `role="radiogroup"`
  - `Stepper({ value, min, max, onChange, label, format?: (n) => string })` with 44 px `−`/`+` buttons, disabled at bounds
  - `Popover({ open, onClose, anchor: HTMLElement | null, children })` glass, focus trap, `Esc` closes, positioned with `getBoundingClientRect` and flipped when near the viewport edge
  - `Dialog({ open, title, children, actions, onClose })` with scrim, `role="dialog"`, `aria-modal`, focus trap, scale 0.96 → 1 enter
  - `Sheet({ open, side: 'right' | 'bottom', onClose, children })`
  - `Tooltip({ content, children })` hover 300 ms / focus / long-press 450 ms
  - `ToastProvider`, `useToast(): (text: string) => void` (3 s, `aria-live="polite"`)
  - `Menu({ label, icon?, items: { label, onSelect, destructive?, separatorBefore? }[] })`
  - `ThemeProvider` sets `data-theme` on `<html>` from `ui.theme` and `matchMedia('(prefers-color-scheme: dark)')`

Tailwind classes use the tokens only, e.g. `bg-surface text-text border border-hairline rounded-[var(--radius-card)]`. Hover on quiet buttons: `hover:bg-accent-tint`; primary: `bg-accent text-white`; destructive: quiet with `text-error`. Transitions: `transition-[background-color,transform,opacity] duration-[var(--dur-fast)] ease-[var(--ease)]`. Press: `active:scale-[.98]`.

- [ ] **Step 1: Failing tests**

```tsx
// src/components/ui/__tests__/primitives.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper } from '../Stepper';
import { Segmented } from '../Segmented';
import { Dialog } from '../Dialog';

describe('Stepper', () => {
  it('clamps at bounds and disables the buttons', () => {
    const onChange = vi.fn();
    render(<Stepper value={4} min={4} max={8} onChange={onChange} label="İntörn sayısı" />);
    const minus = screen.getByRole('button', { name: /azalt|decrease/i });
    expect(minus).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /artır|increase/i }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
describe('Segmented', () => {
  it('is a radiogroup and changes value', () => {
    const onChange = vi.fn();
    render(<Segmented value="tr" options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]} onChange={onChange} ariaLabel="Dil" />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'EN' }));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
describe('Dialog', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog open title="T" onClose={onClose} actions={null}>body</Dialog>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement the eleven files** following `DESIGN.md` §1.5 (radii, motion, focus ring), §2.5 (popover, dialog, sheet, toast), §6 (roles and labels). The Stepper's button labels are the i18n keys `stepper.decrease` (`Azalt` / `Decrease`) and `stepper.increase` (`Artır` / `Increase`) from SPEC §9; task 7 already carries them.
- [ ] **Step 4: Run tests, expect pass. Render a scratch page with every primitive in both themes and screenshot it.**
- [ ] **Step 5: Commit** `git commit -am "task 9: ui primitives and theme"`

---

### Task 10: Setup screen

**Files:**
- Create: `src/components/setup/SetupScreen.tsx`, `PeriodCard.tsx`, `InternsCard.tsx`, `StaffingCard.tsx`
- Modify: `src/App.tsx` (render `SetupScreen` when `ui.step === 'setup'`, wrap in `StoreProvider`, `LangProvider`, `ThemeProvider`, `ToastProvider`)
- Test: `src/components/setup/__tests__/setup.test.tsx`

**Interfaces:**
- Consumes: `useStore`, `useT`, `Stepper`, `Segmented`, `react-day-picker`, `rangeParts`, `averagePerSlot`, `formatNumber`.
- Produces: `SetupScreen()`; the three cards accept no props (they read the store) so `SettingsSheet` (task 15) can reuse them verbatim.

Behaviour (DESIGN §2.1): `PeriodCard` renders `DayPicker` with `mode="single"`, `weekStartsOn={1}`, `locale={LOCALES[lang]}`, `disabled={{ dayOfWeek: [0, 2, 3, 4, 5, 6] }}`, `selected={dateOf(startDate, 0)}`, `modifiers={{ range: { from: dateOf(startDate, 0), to: dateOf(startDate, 27) } }}`, `modifiersClassNames={{ range: 'rdp-range' }}`, `onSelect={(d) => d && dispatch({ type: 'SET_START_DATE', isoDate: toIso(d) })}`; below it `t('setup.period.range', rangeParts(...))`. Reveal order: `InternsCard` mounts once a date exists (always true after boot, so it mounts on the second frame with the enter motion), `StaffingCard` mounts once the count stepper has been touched or when `ui.step` was already `'board'`. Keep a local `revealed` counter in `SetupScreen`; simple `useState`. `StaffingCard` shows `t('setup.staffing.math', { n, total: 16n, avg: formatNumber(avg) })` and the warn line when `minPerShift > avg`. The `Panoya geç` button dispatches `SET_STEP 'board'`.

- [ ] **Step 1: Failing test**

```tsx
// src/components/setup/__tests__/setup.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

describe('setup', () => {
  it('shows the period card first, then interns, then staffing with the arithmetic line', () => {
    render(<App />);
    expect(screen.getByText('Dönem')).toBeInTheDocument();
    expect(screen.getByText('İntörnler')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
    expect(screen.getByText('Kadro')).toBeInTheDocument();
    expect(screen.getByText(/7 intörn × 16 nöbet = 112 atama/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    expect(screen.getByRole('radio', { name: 'Takvim' })).toBeInTheDocument();
  });
});
```

(This test needs `BoardScreen` to at least render the view switch; stub `BoardScreen` with the top bar in this task and fill it in task 11.)

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**, then screenshots at 1280 / 375, light / dark.
- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 10: setup screen"`

---

### Task 11: Board: grid, cells, chips, click-to-assign

**Files:**
- Create: `src/components/board/BoardScreen.tsx`, `TopBar.tsx`, `Toolbar.tsx`, `CalendarGrid.tsx`, `DayCell.tsx`, `SlotZone.tsx`, `InternChip.tsx`, `ViolationBadge.tsx`, `AssignPopover.tsx`, `ChipPopover.tsx`
- Test: `src/components/board/__tests__/board.test.tsx`

**Interfaces:**
- Consumes: store, violations hook, i18n, primitives.
- Produces: `SlotZone({ dayIndex, type })` reads the store itself; `InternChip({ assignment, compact?: boolean })`; `AssignPopover({ dayIndex, type, anchor, onClose })`; `ChipPopover({ assignment, anchor, onClose })`; `chipClass(colorKey)` returns the Tailwind classes `bg-[var(--chip-<key>-bg)] text-[var(--chip-<key>-fg)]`.

Behaviour (DESIGN §2.2, §3): the grid is `grid grid-cols-7 gap-2`, 4 rows, weekday header from `weekdayLabels(lang)`, week label per row. `DayCell` shows `formatDay(start, d, lang, dayIndex === 0 || dateOf(...).getDate() === 1 ? 'd MMM' : 'd')` (always `d MMM` is also acceptable; pick `d MMM` everywhere for simplicity). Two `SlotZone`s. A zone lists `bySlot.get(key)` chips; clicking empty space opens `AssignPopover`; clicking a chip opens `ChipPopover`. `AssignPopover` lists every intern with `chip.counts` and, per intern, `wouldViolate()`'s worst severity (label `popover.assign.conflict`) or `popover.assign.already`. Selecting dispatches `ASSIGN`. `ChipPopover` has lock/unlock and remove. `ViolationBadge({ severity })` is the 14 px corner badge with the `!` glyph (Lucide `alert-circle` for error, `alert-triangle` for warning). Zone ring: `shadow-[inset_0_0_0_1.5px_var(--error)]` / warn; empty-slot warning: `outline-dashed outline-1 outline-[var(--warn-stroke)]`. Tooltip content = `violationMessage()` lines. Keyboard: zones and chips are `tabIndex=0`, `Enter` opens the popover, `Delete` on a chip dispatches `UNASSIGN`.

- [ ] **Step 1: Failing test**

```tsx
// src/components/board/__tests__/board.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../../App';

function toBoard() { render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' })); }

describe('board', () => {
  it('renders 56 slot zones with hour labels', () => {
    toBoard();
    expect(screen.getAllByLabelText(/gündüz nöbeti$/i)).toHaveLength(28);
    expect(screen.getAllByLabelText(/gece nöbeti$/i)).toHaveLength(28);
    expect(screen.getAllByText('08-20')).toHaveLength(28);
  });
  it('assigns through the popover and shows a violation badge for a post-night day', () => {
    toBoard();
    const night0 = screen.getAllByLabelText(/gece nöbeti$/i)[0];
    fireEvent.click(within(night0 as HTMLElement).getByRole('button', { name: /İntörn ekle|ekle/i }));
    fireEvent.click(screen.getByRole('option', { name: /İntörn 1/ }));
    const day1 = screen.getAllByLabelText(/gündüz nöbeti$/i)[1];
    fireEvent.click(within(day1 as HTMLElement).getByRole('button', { name: /ekle/i }));
    expect(screen.getByRole('option', { name: /İntörn 1/ })).toHaveTextContent('Kural ihlali oluşturur');
    fireEvent.click(screen.getByRole('option', { name: /İntörn 1/ }));
    expect(within(day1 as HTMLElement).getByLabelText(/kural ihlali|violation/i)).toBeInTheDocument();
  });
});
```

Adjust the accessible names to what you implement, but keep the assertions: 56 zones, popover assign works, `wouldViolate` label shows, badge appears.

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**, screenshots at 1280 (light, dark).
- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 11: board grid, chips, click-to-assign"`

---

### Task 12: Drag and drop

**Files:**
- Create: `src/components/board/DndProvider.tsx`
- Modify: `SlotZone.tsx` (useDroppable + ghost ring), `InternChip.tsx` (useDraggable), `Palette.tsx` is created in task 13, so in this task make the palette droppable target a placeholder `div` with `id: 'palette'` inside `BoardScreen`.

**Interfaces:**
- Produces: `DndProvider({ children })` wrapping `DndContext` with `PointerSensor` (`activationConstraint: { distance: 6 }`), `TouchSensor` (`{ delay: 150, tolerance: 8 }`), `KeyboardSensor`; drag data types `{ source: 'palette'; internId } | { source: 'slot'; internId; dayIndex; type }`; `DragOverlay` rendering an `InternChip` at scale 1.04 with `--shadow-float`.

Behaviour (SPEC §11): `onDragOver` sets a context value `{ over: SlotKey | 'palette' | null, severity }` where severity comes from `wouldViolate()` for the dragged intern into the hovered slot; `SlotZone` reads it and shows the accent / warn / error ring. `onDragEnd`: over a slot → `ASSIGN` (palette source) or `MOVE` (slot source); over `'palette'` with a slot source → `UNASSIGN`; duplicate target → no dispatch and the zone gets a 180 ms `animate-shake` class (define the keyframes in `app.css`: translateX ±3 px).

- [ ] **Step 1: Test** (dnd-kit does not drive well under jsdom; keep a reducer-level test of the drop handler instead)

```ts
// src/components/board/__tests__/dropHandler.test.ts
import { describe, it, expect } from 'vitest';
import { actionForDrop } from '../DndProvider';

describe('actionForDrop', () => {
  it('maps palette → slot to ASSIGN, slot → slot to MOVE, slot → palette to UNASSIGN, nothing otherwise', () => {
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, '3-DAY')).toEqual({ type: 'ASSIGN', internId: 'intern-1', dayIndex: 3, shift: 'DAY' });
    expect(actionForDrop({ source: 'slot', internId: 'intern-1', dayIndex: 0, type: 'NIGHT' }, '3-DAY')).toEqual({ type: 'MOVE', internId: 'intern-1', from: { dayIndex: 0, shift: 'NIGHT' }, to: { dayIndex: 3, shift: 'DAY' } });
    expect(actionForDrop({ source: 'slot', internId: 'intern-1', dayIndex: 0, type: 'NIGHT' }, 'palette')).toEqual({ type: 'UNASSIGN', internId: 'intern-1', dayIndex: 0, shift: 'NIGHT' });
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, 'palette')).toBeNull();
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement** `actionForDrop(data, overId): Action | null` as a pure export in `DndProvider.tsx`, then the provider. Verify by hand in the browser: drag from the palette placeholder, between slots, out to the palette; on a phone-sized viewport with touch emulation.
- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 12: drag and drop"`

---

### Task 13: Palette and diagnostics

**Files:**
- Create: `src/components/palette/Palette.tsx`, `PaletteRow.tsx`, `src/components/diagnostics/Diagnostics.tsx`
- Modify: `BoardScreen.tsx` (replace the placeholder with `Palette` + `Diagnostics` in the right column)
- Test: `src/components/palette/__tests__/palette.test.tsx`

**Interfaces:**
- Produces: `Palette()` (droppable id `'palette'`, rows draggable with `{ source: 'palette', internId }`), `PaletteRow({ intern })` showing `chip.counts` with the complete / over states (DESIGN §2.2); `Diagnostics()` with the three groups (`diag.group.*`), counts, collapsible, click → `document.getElementById(cellId(dayIndex, type))?.scrollIntoView({ block: 'center' })` then add the `pulse` class for 480 ms; `cellId(dayIndex, type)` exported from `SlotZone.tsx` and used as the zone's DOM id.

- [ ] **Step 1: Failing test**

```tsx
// src/components/palette/__tests__/palette.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

describe('palette and diagnostics', () => {
  it('shows G 0/8 · N 0/8 for every intern and "Eksik kotalar" group with 6 entries', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    expect(screen.getAllByText('G 0/8 · N 0/8')).toHaveLength(6);
    expect(screen.getByText(/Eksik kotalar/)).toHaveTextContent('12');   // 6 interns × 2 types
    expect(screen.getByText(/Kadro/)).toHaveTextContent('56');
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**, screenshots.
- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 13: palette and diagnostics"`

---

### Task 14: Matrix view

**Files:**
- Create: `src/components/matrix/MatrixView.tsx`, `src/components/matrix/matrixModel.ts`
- Modify: `BoardScreen.tsx` (render by `ui.view`)
- Test: `src/components/matrix/__tests__/matrixModel.test.ts`

**Interfaces:**
- Produces: `buildMatrix(schedule): { rows: { intern: Intern; cells: ('' | 'DAY' | 'NIGHT' | 'BOTH')[]; day: number; night: number }[] }` (pure, reused by the Excel export); `MatrixView()`.

- [ ] **Step 1: Failing test**

```ts
// src/components/matrix/__tests__/matrixModel.test.ts
import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../../engine/schedule';
import { buildMatrix } from '../matrixModel';

describe('buildMatrix', () => {
  it('marks cells and totals', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = [{ internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false }, { internId: 'intern-1', dayIndex: 0, type: 'NIGHT', locked: false }, { internId: 'intern-2', dayIndex: 5, type: 'NIGHT', locked: false }];
    const m = buildMatrix(s);
    expect(m.rows[0]?.cells[0]).toBe('BOTH');
    expect(m.rows[1]?.cells[5]).toBe('NIGHT');
    expect(m.rows[1]?.cells[4]).toBe('');
    expect(m.rows[0]).toMatchObject({ day: 1, night: 1 });
    expect(m.rows[0]?.cells).toHaveLength(28);
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement** per DESIGN §2.3 (sticky first column, `overflow-x-auto` container, legend `matrix.legend`, letters from `matrix.code.*`, `BOTH` shows `G/N` with an error badge).
- [ ] **Step 4: Run tests, expect pass; screenshots.**
- [ ] **Step 5: Commit** `git commit -am "task 14: matrix view"`

---

### Task 15: Toolbar actions, settings sheet, undo/redo, keyboard

**Files:**
- Create: `src/components/settings/SettingsSheet.tsx`, `src/components/board/useKeyboardShortcuts.ts`
- Modify: `Toolbar.tsx`, `TopBar.tsx`, `BoardScreen.tsx`

**Interfaces:**
- Consumes: `runSolver`, `useToast`, `Dialog`, `Sheet`, setup cards.
- Produces: the five toolbar actions and the settings sheet.

Behaviour:
- Randomize: if any unlocked assignment exists, open `dialog.randomize.*` with `{ n: unlockedCount }`; on confirm set `busy`, `await runSolver(schedule, Date.now())`, dispatch `RANDOMIZE`, toast `toast.randomized` or `toast.randomized.short` with `{ n: shortSlots }`. Keep the button busy at least 240 ms. New chips get the `enter` animation with `animationDelay = dayIndex * 12ms` (DESIGN §4); locked chips do not animate; reduced motion removes the delay.
- Shuffle: dispatch `SHUFFLE_NAMES { seed: Date.now() }`; labels cross-fade (`key` on the label span forces a remount with a 180 ms fade).
- Reset: `dialog.reset.*` with the `keepLocked` checkbox (a switch per DESIGN, default off) → `RESET`.
- Undo / redo icon buttons; `useKeyboardShortcuts` binds `⌘Z`/`Ctrl+Z`, `⇧⌘Z`/`Ctrl+Y`, and ignores events from inputs.
- Settings: `Sheet side="right"` (bottom on < 768) with `PeriodCard`, `InternsCard`, `StaffingCard`; shrinking the count with affected assignments opens `dialog.internCount.*` first (compute `{ n: removed, a: affectedAssignments }`).
- Language and theme controls live in `TopBar` (`Segmented`) and dispatch `SET_LANG` / `SET_THEME`.

- [ ] **Step 1: Test** the pure helper `unlockedCount(schedule)` and `affectedByShrink(schedule, n): { interns: number; assignments: number }` in `src/state/__tests__/helpers.test.ts` (put both in `src/state/helpers.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../engine/schedule';
import { affectedByShrink, unlockedCount } from '../helpers';
describe('helpers', () => {
  it('counts', () => {
    const s = createSchedule('2026-09-07', 6);
    s.assignments = [{ internId: 'intern-6', dayIndex: 1, type: 'DAY', locked: true }, { internId: 'intern-5', dayIndex: 1, type: 'DAY', locked: false }];
    expect(unlockedCount(s)).toBe(1);
    expect(affectedByShrink(s, 4)).toEqual({ interns: 2, assignments: 2 });
    expect(affectedByShrink(s, 6)).toEqual({ interns: 0, assignments: 0 });
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**, verify by hand: randomize fills every chip with zero errors in the diagnostics; undo restores; settings changes apply live.
- [ ] **Step 4: Run tests, expect pass**
- [ ] **Step 5: Commit** `git commit -am "task 15: toolbar actions, settings, shortcuts"`

---

### Task 16: Exports and share link

**Files:**
- Create: `src/components/export/ExportFrame.tsx`, `ExportMenu.tsx`, `exportPng.ts`, `exportXlsx.ts`, `exportJson.ts`, `shareLink.ts`, `printSchedule.ts`, `download.ts`
- Modify: `App.tsx` (hash handling on boot with the `dialog.link.*` confirm), `styles/print.css`
- Test: `src/components/export/__tests__/exportXlsx.test.ts`, `src/components/export/__tests__/shareLink.test.ts`

**Interfaces:**
- Produces: `buildWorkbook(schedule, lang): XLSX.WorkBook` (pure; sheets `Takvim`, `Matris`, `Özet` per SPEC §10, headers through `t()`); `exportXlsx(schedule, lang)`; `exportPng(schedule, view, lang)` (mounts `ExportFrame` into a fixed off-screen container, calls `toPng` twice with `{ pixelRatio: 3, cacheBust: true, backgroundColor: '#FFFFFF' }`, downloads `nobet-<startDate>-takvim|matris.png`, unmounts); `exportJson(schedule)` / `importJson(file): Promise<Schedule | null>` via `isSchedule`; `linkFor(schedule): string` = `location.origin + location.pathname + '#' + encodeHash(schedule)`; `copyLink(schedule): Promise<'copied' | 'manual'>`; `printSchedule()`; `download(blob, filename)`.

- [ ] **Step 1: Failing tests**

```ts
// src/components/export/__tests__/exportXlsx.test.ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { createSchedule } from '../../../engine/schedule';
import { solve } from '../../../engine/solver';
import { buildWorkbook } from '../exportXlsx';

describe('buildWorkbook', () => {
  it('has three sheets with the expected shape', () => {
    const s = createSchedule('2026-09-07', 5);
    s.assignments = solve(s, { seed: 1, moves: 2000, restarts: 1 }).assignments;
    const wb = buildWorkbook(s, 'tr');
    expect(wb.SheetNames).toEqual(['Takvim', 'Matris', 'Özet']);
    const takvim = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Takvim'] as XLSX.WorkSheet);
    expect(takvim).toHaveLength(28);
    expect(Object.keys(takvim[0] ?? {})).toEqual(['Tarih', 'Gün', 'Gündüz 08-20', 'Gece 20-08']);
    const matris = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Matris'] as XLSX.WorkSheet);
    expect(matris).toHaveLength(5);
  });
});
```

```ts
// src/components/export/__tests__/shareLink.test.ts
import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../../engine/schedule';
import { decodeHash } from '../../../engine/codec';
import { linkFor } from '../shareLink';

describe('linkFor', () => {
  it('builds a same-page URL whose hash decodes', () => {
    const s = createSchedule('2026-09-07', 4);
    const url = new URL(linkFor(s));
    expect(url.pathname).toBe(location.pathname);
    expect(decodeHash(url.hash)).toEqual(s);
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement.** `ExportFrame` per DESIGN §5 (light tokens forced via `data-theme="light"` on its root, width 1600, no badges, full names). Print: `print.css` hides `#app-root` and shows `#print-root` with the calendar frame scaled by `transform: scale(calc(277mm / 1600px))`. Hash on boot in `App.tsx`:

```ts
useEffect(() => {
  const decoded = location.hash.length > 1 ? decodeHash(location.hash) : null;
  if (location.hash.length > 1 && !decoded) { toast(t('toast.badLink')); return; }
  if (!decoded) return;
  const draftHasContent = state.schedule.assignments.length > 0 || state.schedule.interns.some(i => i.realName !== '');
  if (draftHasContent) setPendingLink(decoded);            // opens dialog.link.*
  else { dispatch({ type: 'LOAD_SCHEDULE', schedule: decoded }); dispatch({ type: 'SET_STEP', step: 'board' }); toast(t('toast.loadedFromLink')); }
}, []);
```

`copyLink`: `try { history.replaceState(null, '', '#' + encodeHash(s)); } catch {}` then `try { await navigator.clipboard.writeText(linkFor(s)); return 'copied'; } catch { return 'manual'; }`; `'manual'` opens a dialog with a read-only selected text field.

- [ ] **Step 4: Run tests, expect pass.** By hand: PNG opens at 4800 px wide with real fonts; Excel opens in Numbers/Excel with three sheets; print preview is one landscape page; JSON round-trips through import; the copied link opens the same board in a private window.
- [ ] **Step 5: Commit** `git commit -am "task 16: exports and share link"`

---

### Task 17: Mobile layout and bottom sheet

**Files:**
- Create: `src/components/board/MobileList.tsx`, `src/components/board/MobileSheet.tsx`, `src/hooks/useMediaQuery.ts`
- Modify: `BoardScreen.tsx`, `TopBar.tsx`, `Toolbar.tsx`

Behaviour (DESIGN §2.4): below 768 px render `MobileList` (week headers, one row per day with date column and the two zones side by side, chips show the first name only), the palette and diagnostics inside `MobileSheet` (bottom sheet with a two-segment switch) above a bottom toolbar holding `Rastgele doldur` and the overflow menu. `useMediaQuery('(max-width: 767px)')`. Verify at 375 × 812 with touch emulation: tap-to-assign, drag from the sheet, no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`).

- [ ] **Step 1: Test** `useMediaQuery` with a mocked `matchMedia` (returns the mocked value and updates on change).
- [ ] **Step 2: Implement, screenshot 375 light/dark, both views, sheet open and closed.**
- [ ] **Step 3: Commit** `git commit -am "task 17: mobile layout"`

---

### Task 18: Accessibility, motion, final QA, deploy

**Files:**
- Modify: whatever the audit touches; create `netlify.toml`, `README.md`

- [ ] **Step 1: Walk SPEC §12 acceptance criteria 1 to 18 by hand; tick each in `memory.md` § QA with the date.**
- [ ] **Step 2: Keyboard-only pass:** assign, lock, remove, undo, open every menu and dialog, switch views and language, all without a mouse.
- [ ] **Step 3: `prefers-reduced-motion` pass** in DevTools rendering panel: no stagger, no pulse, everything still works.
- [ ] **Step 4: Contrast pass** with the DevTools accessibility panel on both themes: every text pair ≥ 4.5:1.
- [ ] **Step 5: `npm run check`, then `npm run build` and open `dist/index.html` through `vite preview`.**
- [ ] **Step 6: Deploy.** `netlify.toml`:

```toml
[build]
  publish = "dist"
  command = "npm run build"
```

No redirects are needed (no client-side routing; the hash carries the state). Push the repo and connect it on Netlify the same way as the Sivas map; record the URL in `memory.md`.

- [ ] **Step 7: Commit** `git commit -am "task 18: accessibility, QA, deploy config"`

---

## Plan self-review

Spec coverage: §1 constants → task 2; §2 model and invariants → tasks 2, 6 (`isSchedule`), 8 (reducer); §3 helpers → task 3; §4 rules → task 4; §5 solver and worker → tasks 5 and 8; §6 shuffle → task 6; §7 codec → task 6 and 16; §8 state and persistence and boot order → tasks 8 and 16; §9 i18n → task 7 (plus two stepper keys added in task 9); §10 exports → task 16; §11 drag and drop and keyboard → tasks 12 and 15; §12 acceptance → task 18; §13 tests → every task. DESIGN §2.1 → task 10, §2.2 and §3 → tasks 11 to 13, §2.3 → 14, §2.4 → 17, §2.5 → 9, §4 → 15, §5 → 16, §6 and §7 → 18.

Type consistency: actions use `shift: ShiftType` and `type` as the discriminant everywhere (tasks 8, 11, 12, 15); `SlotKey` is `${dayIndex}-${type}` everywhere; `Violation.related` is `Cell[]`; `runSolver` returns `SolveResult` whose `assignments` feed `RANDOMIZE`.
