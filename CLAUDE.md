# CLAUDE.md, Acil nöbet planlayıcı (program-app)

Single-page, client-only web app that plans a 28-day emergency medicine intern rotation (4 to 8 interns, 8 day + 8 night shifts each) with live rule checking, a seeded auto-solver, TR/EN interface, and PNG / Excel / print / JSON / link exports.

Read these before writing any code, in this order:

1. `SPEC.md`: the contract. Data model, every rule as a formal definition, solver algorithm, codec formats, i18n dictionary, acceptance criteria, test plan.
2. `DESIGN.md`: screens, tokens, component states, motion, responsive and export layouts.
3. `PLAN.md`: ordered implementation tasks, each with its test and its done check.
4. `memory.md`: constraints, verified arithmetic, decisions log, edge cases, library caveats.

If two documents disagree, `SPEC.md` wins. Record the conflict and the resolution in `memory.md`.

## Commands

```bash
npm install
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run test         # vitest run
npm run check        # lint + test + build, in that order
```

`npm run check` must be green before any task in `PLAN.md` is marked done. Add these scripts to `package.json` in task 1.

## Stack

Versions are what npm resolved on 2026-09-03. Install what resolves on the day you start and commit `package-lock.json`.

| Package | Version | Role |
|---|---|---|
| react, react-dom | 19 | UI |
| vite, @vitejs/plugin-react | 8 / 6 | build |
| typescript | 7 (5.9 also fine) | strict mode, see below |
| tailwindcss, @tailwindcss/vite | 4 | styling; Tailwind 4 is configured in CSS with `@theme`, there is no `tailwind.config.js` |
| @dnd-kit/core, @dnd-kit/utilities | 6 / 3 | drag and drop with keyboard and touch sensors |
| react-day-picker | 10 (9 API is the same) | the start-date calendar |
| date-fns | 4 | date arithmetic and `tr` / `enUS` locales |
| html-to-image | 1.11 | PNG export |
| xlsx (SheetJS) | 0.18.5 on npm | Excel export. Writing three plain sheets works on the npm build. If you want the maintained build: `npm i https://cdn.sheetjs.com/xlsx-latest/package/xlsx.tgz` |
| lucide-react | 1.x | icons, one family only |
| @fontsource-variable/inter | 5 | self-hosted fallback font |
| vitest, @testing-library/react | 5 / 16 | tests |

No other runtime dependency without a one-line justification in `memory.md`. No CDN links, no Google Fonts import, no analytics. Everything ships in the bundle so the site works offline once loaded and so `html-to-image` can embed the fonts.

## TypeScript

`tsconfig` must have `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. In `src/engine/` there is no `any`, no non-null assertion, no `as` cast used to silence an error. Index reads under `noUncheckedIndexedAccess` go through `at()` from `engine/util.ts` (throws on a hole, which is a bug) or an explicit `?? 0` / `?? false` default. In components, `as const` and discriminated unions are fine.

## Architecture rules

1. `src/engine/` is pure. No React, no DOM, no `Date.now()`, no `Math.random()`, no `localStorage`. Every function takes inputs and returns outputs. Randomness enters only as a numeric seed through `engine/random.ts`.
2. Rules live in exactly one place, `src/engine/rules.ts`. Components never re-derive a rule; they read `Violation` objects produced by `validate()` and `wouldViolate()`.
3. The solver, `src/engine/solver.ts`, never throws and never touches a locked assignment. When locks are contradictory it still returns a schedule and lets `validate()` report the problem. The UI calls it through the Web Worker in `src/engine/solver.worker.ts`; tests call it directly.
4. `src/state/reducer.ts` is the only code that changes the schedule. Components dispatch actions. The reducer keeps every invariant listed in `SPEC.md` §2.
5. Every user-visible string goes through `t()`. `src/i18n/tr.ts` and `src/i18n/en.ts` export the same typed key set; a test enforces parity. Date and weekday names come from date-fns locales, never hand-typed.
6. Colours, sizes, radii, durations come from tokens (`src/styles/tokens.css`, exposed to Tailwind through `@theme`). No raw hex in a component file.
7. Non-blocking UI. No user action is refused because it breaks a rule. The only refused drop is structural: the same intern is already in that slot.
8. Dates are indices internally (`dayIndex` 0..27). Convert to calendar dates through `engine/dates.ts` at render and export time only. Never mutate a `Date`.
9. Files stay small. A component over about 200 lines gets split. `engine/` modules have one job each.
10. Wrap `history.replaceState` / `pushState` and `navigator.clipboard` calls in try/catch. Both throw in some contexts (file:// origin, iframes, insecure origins) and one uncaught throw locks the page.

## Turkish text rules

- Never call `toLowerCase()` / `toUpperCase()` on Turkish text without a locale. Use `toLocaleUpperCase('tr-TR')` / `toLocaleLowerCase('tr-TR')`. Locale-blind casing turns `İ` into `i̇` and `I` into `i`.
- Weekday and month names come from the date-fns `tr` locale.
- Interface strings: sentence case, no all-caps headings, no emoji in headings, no invented acronyms. The letter codes `G` (gündüz) and `N` (gece) are the only abbreviations, and the legend always spells them out.

## Definition of done for every task

- The tests named in the task pass and `npm run check` is green.
- For UI tasks: run the app, take screenshots at 1280 px and 375 px width, light and dark, and look at them. Compare with `DESIGN.md`.
- No console errors or warnings in the browser.
- If a decision was made that the documents did not cover, or a deviation was necessary, add a dated line to `memory.md` § Decisions.

## Process notes

- Work in `PLAN.md` order: engine and tests first, then state, then UI, then exports. The engine must be complete and tested before any component is written.
- Verify every string replacement or generated edit by reading the result back. Silent no-op replacements are a known failure mode.
- Commit after each task with the task number in the message.
