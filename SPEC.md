# SPEC.md, technical contract

Acil nöbet planlayıcı. Everything in this document is normative. Section numbers are referenced from `PLAN.md` and from test names.

## 0. Scope

In scope: one rotation at a time, planned in the browser, saved in `localStorage`, shared as a link or file, exported as PNG / Excel / print / JSON. Turkish and English interface, switchable at runtime. Light and dark themes.

Out of scope (decided 2026-09-03, do not add): per-intern unavailable dates, weekend balancing, public holidays, storing several rotations, carry-over from the previous rotation, accounts, any server.

## 1. Domain constants

| Constant | Value | Meaning |
|---|---|---|
| `DAYS` | 28 | rotation length, `dayIndex` 0..27 |
| `startDate` | ISO `YYYY-MM-DD`, always a Monday | rotation starts Monday 08:00, ends 28 days later Monday 08:00 |
| `ShiftType` | `'DAY'` 08:00-20:00, `'NIGHT'` 20:00-08:00 next day | two slots per calendar day, 56 slots |
| `N` | integer in [4, 8] for a team schedule, exactly 1 for a solo one (§14) | intern count |
| `QUOTA` | 8 DAY and 8 NIGHT per intern | fixed, independent of N |
| `NIGHT_GAP_MIN` | 3 | two nights of the same intern need `dayIndex` difference ≥ 3 (two full calendar days off between them) |
| `minPerShift` | integer in [1, 4], default `max(1, floor(16·N / 56))` | user-set staffing target per slot |
| `HIGH_DENSITY_AT` | 4 | slot count at or above this is flagged as info |

Derived arithmetic the UI must show in the staffing card: `16·N` total assignments over 56 slots, average `16·N / 56` per slot. Values: N=4 → 1.14, N=5 → 1.43, N=6 → 1.71, N=7 → 2.00, N=8 → 2.29. Default `minPerShift` is therefore 1 for N ≤ 6 and 2 for N ≥ 7.

## 2. Data model

```ts
export type ShiftType = 'DAY' | 'NIGHT';
export type InternId = string;            // 'intern-1' .. 'intern-8'
export type ColorKey = 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'indigo' | 'purple' | 'pink';

export interface Intern {
  id: InternId;
  index: number;        // 1..8, contiguous, order of creation
  realName: string;     // '' means no name; the UI then shows the placeholder "İntörn n" / "Intern n"
  colorKey: ColorKey;   // fixed by index, in the COLOR_KEYS order (DESIGN §1.3)
  pinned: boolean;      // true when the user typed the name; a drawn name is not pinned
}

export interface Assignment {
  internId: InternId;
  dayIndex: number;     // 0..27
  type: ShiftType;
  locked: boolean;
}

export interface Schedule {
  version: 1;
  startDate: string;    // ISO date, Monday
  interns: Intern[];    // length N
  minPerShift: number;
  assignments: Assignment[];
  namePool: string[];   // names waiting for the interns that have none, max 24
}

export type SlotKey = `${number}-${ShiftType}`;   // e.g. '3-NIGHT'
export interface Cell { dayIndex: number; type: ShiftType }   // a slot address without an intern
```

Invariants, enforced by the reducer and asserted by `isSchedule()` on import:

1. At most one `Assignment` per `(internId, dayIndex, type)`.
2. `interns.length` in [4, 8]; `index` values are exactly 1..N; ids are `intern-${index}`.
3. Every `assignment.internId` exists in `interns`.
4. `dayIndex` in [0, 27]; `minPerShift` in [1, 4]; `startDate` parses and is a Monday.

Names are user data: max 40 characters, any Unicode, trimmed on blur and at every serialisation boundary. A name the user types is `pinned`; a name handed out by the pool is not, which is what lets a second draw reshuffle the drawn names without touching a typed one. A name arriving from a link or a file is treated as typed.

## 3. Derived helpers (`engine/schedule.ts`, `engine/dates.ts`)

```ts
slotKey(dayIndex, type): SlotKey
parseSlotKey(key): { dayIndex, type }
bySlot(schedule): Map<SlotKey, Assignment[]>            // insertion order = assignment order
byIntern(schedule): Map<InternId, Assignment[]>
counts(schedule, internId): { day: number; night: number }
averagePerSlot(n): number                                // 16n/56
defaultMinPerShift(n): number                            // max(1, floor(16n/56))
dateOf(startDate, dayIndex): Date                        // date-fns addDays, local time, no mutation
weekOf(dayIndex): number                                 // floor(dayIndex / 7), 0..3
weekdayOf(dayIndex): number                              // 0 = Monday .. 6 = Sunday (dayIndex % 7)
isMonday(isoDate): boolean
toIso(date): string                                      // 'yyyy-MM-dd'
nextMonday(from: Date): string                           // the coming Monday, today included when today is Monday
formatDay(startDate, dayIndex, lang, pattern): string    // date-fns format with the tr / enUS locale; for tr the token 'Cts' is rewritten to TDK's 'Cmt', nothing else is hand-made
rangeParts(startDate, lang): { start, end }              // 'd MMMM yyyy' of day 0 and day 27, fed into setup.period.range
weekdayLabels(lang): string[]                            // Monday..Sunday 'EEE' labels
```

`weekdayOf` is arithmetic, not a `Date` call, because `startDate` is always a Monday. Assert this in a test.

## 4. Rules engine (`engine/rules.ts`)

```ts
export type ViolationCode =
  | 'POST_NIGHT_DAY' | 'NIGHT_GAP' | 'DOUBLE_SHIFT' | 'QUOTA_OVER'
  | 'QUOTA_INCOMPLETE' | 'UNDER_STAFFED' | 'HIGH_DENSITY';
export type Severity = 'error' | 'warning' | 'info';

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  internId?: InternId;
  dayIndex: number;              // -1 when the violation has no cell (QUOTA_*)
  type?: ShiftType;
  related: { dayIndex: number; type: ShiftType }[];   // other cells involved, for highlighting
  params: Record<string, string | number>;             // fed into the i18n message
}

export function validate(schedule: Schedule): Violation[];
export function wouldViolate(schedule: Schedule, candidate: Omit<Assignment, 'locked'>): Violation[];
export function internPatternValid(nights: number[], days: number[]): boolean;
```

Messages are not stored in the violation. The UI maps `code` + `params` to a string through `t()` (§9).

### 4.1 Rules

Let `A` be the assignment set, `N(i)` the sorted night day-indices of intern `i`, `D(i)` the day day-indices, `c(s)` the count of interns in slot `s`.

| Code | Severity | Fires when | Reported on | `related` | `params` |
|---|---|---|---|---|---|
| `POST_NIGHT_DAY` | error | `d ∈ N(i)` and `d+1 ∈ D(i)` | `(i, d+1, DAY)` | `[(d, NIGHT)]` | `{}` |
| `NIGHT_GAP` | error | consecutive sorted nights `d1 < d2` of `i` with `d2 − d1 < 3` | `(i, d2, NIGHT)` | `[(d1, NIGHT)]` | `{ gap: d2−d1 }` |
| `DOUBLE_SHIFT` | error | `d ∈ N(i)` and `d ∈ D(i)` | `(i, d, NIGHT)` | `[(d, DAY)]` | `{}` |
| `QUOTA_OVER` | error | `|D(i)| > 8` or `|N(i)| > 8`, one per (i, type) | `(i, last dayIndex of that type, type)` | all cells of that type | `{ count }` |
| `QUOTA_INCOMPLETE` | info | `|D(i)| < 8` or `|N(i)| < 8`, one per (i, type) | `dayIndex = -1`, `type` set | `[]` | `{ count, missing: 8−count }` |
| `UNDER_STAFFED` | warning | `c(s) < minPerShift`, one per slot, and only when `N > 1` (§14.1) | `(dayIndex, type)`, no intern | `[]` | `{ count, min }` |
| `HIGH_DENSITY` | info | `c(s) ≥ 4`, one per slot | `(dayIndex, type)`, no intern | `[]` | `{ count }` |

Explicitly legal, never flagged: DAY on `d` followed by NIGHT on `d+1` (24 h rest); any number of consecutive DAY shifts; NIGHT on `d` followed by DAY on `d+2`; a NIGHT on day 27 (there is no day 28 to check, the next rotation is not modelled); locked or unlocked makes no difference to any rule.

`NIGHT_GAP` is evaluated between consecutive nights in sorted order only, so nights on days 3, 4, 5 produce two violations (4 vs 3 and 5 vs 4), not three.

Worked examples, which are also the test fixtures (`startDate` Monday, day 0 = Monday):

| Placement | Result |
|---|---|
| Mon night (0) + Tue day (1) | `POST_NIGHT_DAY` on (1, DAY) |
| Mon night (0) + Wed day (2) | none |
| Mon night (0) + Tue night (1) | `NIGHT_GAP` on (1, NIGHT), gap 1 |
| Mon night (0) + Wed night (2) | `NIGHT_GAP` on (2, NIGHT), gap 2 |
| Mon night (0) + Thu night (3) | none |
| Mon day (0) + Tue day (1) | none |
| Mon day (0) + Tue night (1) | none |
| Mon day (0) + Mon night (0) | `DOUBLE_SHIFT` on (0, NIGHT) |
| 9 day shifts for one intern | one `QUOTA_OVER`, count 9 |
| a slot with 0 interns, `minPerShift` 2 | `UNDER_STAFFED`, count 0, min 2 |
| a slot with 4 interns | `HIGH_DENSITY`, count 4 |

### 4.2 Ordering and lookup

`validate()` returns violations sorted by severity (error, warning, info), then `dayIndex`, then intern `index`. It is O(A log A) with A ≤ 128 and is recomputed on every state change; no memoisation is needed beyond `useMemo` on the schedule reference.

The UI derives two indexes from the list: `byCell: Map<SlotKey, Violation[]>` keyed by the reported cell and by every `related` cell, and `byInternSlot: Map<`${InternId}@${SlotKey}`, Violation[]>` for chip badges. Severity of a cell or chip is the maximum severity in its list.

### 4.3 `wouldViolate`

Let `after = validate(schedule ∪ {candidate})` and `before = validate(schedule)`. The result is every violation in `after` that (a) is not in `before` (compared on `code`, `internId`, `dayIndex`, `type` and `params`), (b) is not `UNDER_STAFFED` or `QUOTA_INCOMPLETE`, since adding an intern can only improve those, and (c) touches the candidate: same `internId` and the candidate's cell is the reported cell or appears in `related`, or a slot-level violation (`HIGH_DENSITY`) on the candidate's slot. If the candidate already exists in the schedule the result is `[]`. Used for the drag ghost and the assign popover's eligibility marks.

### 4.4 `internPatternValid`

`true` iff nights are pairwise ≥ 3 apart, no day equals a night, and no day equals a night + 1. It is the reference form of the per-intern rules: the solver does not call it, because a relocation needs the incremental "ignoring the shift being moved" variant, and keeps its own O(1) `nightLegal` / `dayLegal`. A property test holds `internPatternValid` to `validate()` on random patterns, which is what pins the two forms together.

## 5. Solver (`engine/solver.ts`, `engine/solver.worker.ts`)

```ts
export interface SolveOptions {
  seed: number;
  restarts?: number;   // default 4
  moves?: number;      // default 400_000 per restart
  t0?: number;         // default 3, start temperature
  t1?: number;         // default 0.05, end temperature
  guided?: number;     // default 0.3, share of moves aimed at a short slot
}
export interface SolveResult { assignments: Assignment[]; cost: number; restartsUsed: number; shortSlots: number }
export function solve(schedule: Schedule, options: SolveOptions): SolveResult;
```

Guarantees: never throws; every locked assignment of the input is present unchanged in the output; every unlocked assignment of the input is discarded; identical input and seed give identical output; when the locks are consistent the output has zero `error` violations and zero `QUOTA_INCOMPLETE`. The UI runs it in a Web Worker (`solver.worker.ts` receives `{ schedule, options }` and posts back a `SolveResult`) so the main thread never blocks; tests call `solve()` directly.

Randomness: `engine/random.ts` exports `createRng(seed)` returning `{ next(): number in [0,1), int(n), pick(array), shuffle(array) }` implemented as mulberry32. Nothing else in the engine produces randomness.

### 5.1 Algorithm

Restart `r` (0-based) uses `createRng(seed + r · 7919)`.

Step 1, nights per intern. `LN` = locked nights, `LD` = locked days of the intern. If `|LN| ≥ 8` the night set is `LN` and nothing is added. Otherwise find `S ⊇ LN`, `|S| = 8`, such that every added night `d` satisfies `|d − x| ≥ 3` for every `x` already in the set, `d ∉ LD` and `d+1 ∉ LD`. Randomised depth-first search over the days in a random order with the gap prune and a budget of 20 000 nodes (5 000 exhausts when locked day shifts constrain the search, which returns a short night set and breaks the guarantee below); locked nights are taken as given even when they break the gap among themselves. If no completion is found, keep the largest set reached.

Step 2, days per intern. `avail = { d : d ∉ S, d−1 ∉ S } \ LD`; shuffle and take `max(0, 8 − |LD|)` of them. Locked days are kept even when they conflict with a night.

Step 3, simulated annealing on the soft cost. With slot counts `c(s)` over the 56 slots and weekly counts `w(i, k)` (shifts of intern `i` in week `k`):

```
slotCost(c) = 10·max(0, min − c)² + (c − avg)² + 3·max(0, c − 3)²
weekCost(w) = 0.5·(w − 4)²
cost = Σ_s slotCost(c(s)) + Σ_i Σ_k weekCost(w(i,k))
```

For `m` in `0 .. moves−1`, temperature `T = t0 · (t1 / t0)^(m / moves)`:

1. Pick a target. With probability `guided`, and only if some slot is below `min`, choose a random short slot `(d2, t)` and a random intern `i`; otherwise choose a random intern, shift type and day `d2`.
2. Pick a random unlocked shift `(d1, t)` of intern `i`. Skip the move if the intern has no unlocked shift of that type, or already holds `(d2, t)`.
3. Legality of `(d1 → d2)` for the intern alone, locked shifts included in the pattern: for `t = NIGHT`, no other night within 2 days of `d2` (ignoring `d1` itself), `d2` and `d2+1` not among the intern's days; for `t = DAY`, `d2` and `d2−1` not among the intern's nights. Skip if illegal.
4. `delta = slotCost(c(d1,t) − 1) − slotCost(c(d1,t)) + slotCost(c(d2,t) + 1) − slotCost(c(d2,t))`, plus the two `weekCost` differences when `d1` and `d2` fall in different weeks. O(1); never recompute the whole cost inside the loop.
5. Accept if `delta ≤ 0` (plateau moves are essential) or with probability `exp(−delta / T)`. On accept update the lists, the per-intern day/night masks, the slot counts, the weekly counts and the running cost; when the running cost beats the best seen, deep-copy the state as the best.

Step 4, restarts. Keep the restart with the lowest best cost (first on ties). Stop early after a restart whose best state has no slot below `min` and no slot above `ceil(avg)`. Recompute the returned cost from the best state (the running sum drifts).

Output: locked assignments plus the new ones with `locked: false`, sorted by `dayIndex`, then `DAY` before `NIGHT`, then intern `index`. `shortSlots` is the number of slots below `min` in the result.

### 5.2 Why these numbers

Measured in JavaScript (2026-09-03): at 300 000 moves the N = 7 / target 2 case reached a perfect board on 13 of 20 seeds; at 400 000 it is perfect on 20 of 20 and faster on average (265 ms against 370 ms), because an ideal board stops the restart loop early. 600 000 was worse than 400 000. Earlier prototype (Python, same algorithm): plain hill-climbing without annealing left 8 short slots at N = 7 with target 2 and one empty slot at N = 4. With the parameters above every seed reached the arithmetic optimum for N = 4, 5, 6 and 8 (N = 4: 48 slots at 1 and 8 at 2; N = 6: 16 at 1 and 40 at 2; N = 8: 40 at 2 and 16 at 3) and 8 of 8 seeds reached all 56 slots at exactly 2 for N = 7. Shorter schedules (30 000 moves) left 1 to 2 short slots at N = 7. The cooling length matters more than the number of restarts. Move evaluation is O(1), so 1.2 million evaluations are expected to take well under a second in JavaScript; the test budget is 2 s and the UI shows a spinner while the worker runs.

Step 1 is tiny: the number of valid 8-night patterns in 28 days is C(14, 8) = 3 003. After 8 nights an intern has 12 legal day dates (13 if a night is on day 27), so Step 2 never fails without locks. The only cross-intern coupling is the cost, which is why hard rules can be guaranteed per intern and staffing treated as soft. When `minPerShift · 56 > 16·N` some `UNDER_STAFFED` warnings are unavoidable by arithmetic; the solver minimises them and the setup card explains why. Do not display a predicted count of unavoidable warnings anywhere; only the average.

## 6. Name pool (`engine/pool.ts`)

A name typed on an intern is that intern's name and is never moved. The pool is a separate list of names that the interns with no name draw from.

`distributePool(interns, pool, rng): Intern[]` returns the same interns, same ids, indexes and colours, with each blank `realName` filled from a Fisher-Yates shuffle of the pool. A pool entry equal to a name an intern already carries is not handed out (compared with `toLocaleLowerCase('tr-TR')`). Fewer usable names than blanks simply leaves blanks. `poolFit(interns, pool): { blanks, available }` reports the same counts without performing the draw, for the interface.

`cleanPool(names)` in `engine/schedule.ts` trims, drops empties, removes duplicates case-insensitively and caps at `POOL_MAX = 24`. A name enters the pool only when it is committed, with Enter or the add button, so a name typed and abandoned is never counted and a name with spaces in it is one name. A paste of several lines is committed as several names. The stored pool is the committed list.

There is no name shuffle. A draw is undone by drawing again.

## 7. Codec (`engine/codec.ts`)

### 7.1 JSON file

The `Schedule` object, `JSON.stringify(schedule, null, 2)`, file name `nobet-<startDate>.json`. Import: `JSON.parse`, then `isSchedule(x)` which checks §2 invariants and rejects anything else. The roster may hold 1 to 8 interns here, not 4 to 8: a solo file (§14) carries one person, and the same widening applies to `<N>` in the share link. Unknown extra keys are dropped. No migration logic beyond `version === 1`.

### 7.2 Share link

Encoded in the URL hash so the static host never sees it:

```
#v1.<YYYYMMDD>.<N>.<min>.<names>.<grid>[.<pool>]
```

- fields separated by `.`, six or seven;
- `YYYYMMDD` start date, must be a Monday;
- `N` 4..8, `min` 1..4;
- `names`: `base64url(utf8(JSON.stringify(string[])))`, or the empty string when every name is blank (`v1.20260907.6.2..<grid>`); decoder pads or truncates the array to N;
- `grid`: `56·N` characters, intern order by index, position `p = dayIndex·2 + (type === 'NIGHT' ? 1 : 0)`, characters `0` empty, `1` assigned, `2` assigned and locked.

- `pool`: `base64url(utf8(JSON.stringify(string[])))`, left off entirely when the pool is empty, so a link written before the pool existed still decodes.

Typical length is about 520 characters; no compression library. `encodeHash(schedule): string` returns the part after `#`; `decodeHash(hash): Schedule | null` accepts the string with or without the leading `#`; `linkFor(schedule)` in the export layer is `origin + pathname + '#' + encodeHash(schedule)`. Any deviation (field count, range, length, character set, non-Monday) returns `null`; the UI then shows `toast.badLink` and leaves the hash alone. Round-trip property test: `decodeHash(encodeHash(s))` deep-equals `s` for random valid schedules.

`history.replaceState` is only called from `copyLink()` and is wrapped in try/catch.

## 8. State (`state/reducer.ts`, `state/store.tsx`, `state/persistence.ts`)

```ts
export interface UiState {
  step: 'setup' | 'board';
  view: 'calendar' | 'matrix';
  lang: 'tr' | 'en';
  theme: 'system' | 'light' | 'dark';
  settingsOpen: boolean;
}
export interface AppState { schedule: Schedule; past: Schedule[]; future: Schedule[]; ui: UiState }
```

Actions and their semantics:

| Action | Effect | Undoable |
|---|---|---|
| `SET_START_DATE { isoDate }` | ignored unless Monday; assignments are index-based and stay; applied to every history snapshot too | no |
| `SET_INTERN_COUNT { n }` | grow: append interns with blank names; shrink: remove interns with index > n and their assignments (UI confirms first if any of them has assignments). `minPerShift` follows the new default only while it still equals the default for the old count; a target the user chose is kept | yes |
| `SET_INTERN_NAME { id, name }` | cap 40 characters; applied to the current schedule *and* to every history snapshot, so an undo cannot revive an old name. Trimming happens on blur and at every serialisation boundary, never per keystroke: trimming a controlled input on each change makes a space untypable | no |
| `SET_MIN_PER_SHIFT { n }` | clamp 1..4; applied to every history snapshot too | no |
| `ASSIGN { internId, dayIndex, shift }` | no-op if already present (`shift` is the `ShiftType`; the action's own discriminant is `type`) | yes |
| `UNASSIGN { internId, dayIndex, shift }` | | yes |
| `MOVE { internId, from: {dayIndex,shift}, to: {dayIndex,shift} }` | no-op if target already holds the intern; `locked` travels with the assignment | yes |
| `TOGGLE_LOCK { internId, dayIndex, shift }` | | yes |
| `RANDOMIZE { assignments }` | replaces the whole assignment list with a `SolveResult.assignments` (the caller ran `solve()` in the worker with a seed of its choice), filtered to interns that still exist, since the roster can shrink while the worker runs | yes |
| `SET_NAME_POOL { names }` | the pool as typed, capped at 24 entries; applied to every history snapshot | no |
| `DISTRIBUTE_POOL { seed }` | hands pool names to the interns with none; applied to every history snapshot, so a draw is undone by drawing again, not by undo | no |
| `RESET { keepLocked }` | removes all, or all unlocked, assignments | yes |
| `LOAD_SCHEDULE { schedule }` | from file or link; clears history | no (history cleared) |
| `UNDO` / `REDO` | | |
| `SET_VIEW`, `SET_LANG`, `SET_THEME`, `SET_STEP`, `SET_SETTINGS_OPEN` | ui only | no |

Undoable actions push the previous `schedule` onto `past` (cap 100, drop oldest) and clear `future`. History is in memory only.

Fresh state (nothing stored, no hash): `startDate` = the coming Monday (today if today is a Monday), 6 interns with blank names, `minPerShift` = 1, `step: 'setup'`, `view: 'calendar'`, `lang: 'tr'`, `theme: 'system'`.

Persistence: key `emed-nobet.v1`, value `{ schedule, ui: { lang, theme, step, view } }`, written 300 ms debounced after any change, read once on boot. Boot order: read storage → if `location.hash` decodes to a schedule: when the stored schedule has any assignment or any name, ask (`dialog.link.*`); otherwise load it silently and show `toast.loadedFromLink`. If the hash is present and invalid, show `toast.badLink`. Language default when nothing is stored: `tr`. Theme default: `system`.

## 9. i18n (`i18n/tr.ts`, `i18n/en.ts`, `i18n/index.ts`)

`t(key, params?)` replaces `{name}` placeholders. Keys are a string-literal union; both files are `Record<Key, string>`; a test asserts identical key sets. Dates use date-fns `format` with the `tr` / `enUS` locale; patterns `d MMM` for cells, `d MMMM yyyy` for headers, `EEE` for weekday abbreviations. Numbers with decimals use `,` in TR and `.` in EN (`Intl.NumberFormat`).

| Key | tr | en |
|---|---|---|
| `app.title` | EMED Nöbet Planlayıcı | EMED Shift Planner |
| `setup.period.title` | Dönem | Rotation |
| `setup.period.hint` | Stajlar pazartesi 08:00'de başlar ve 28 gün sürer. Başlangıç pazartesisini seçin. | Rotations start on a Monday at 08:00 and last 28 days. Pick the starting Monday. |
| `setup.period.range` | {start} ile {end} arası, 4 hafta | {start} to {end}, 4 weeks |
| `setup.interns.title` | İntörnler | Interns |
| `setup.interns.count` | İntörn sayısı | Number of interns |
| `setup.interns.name` | İsim (isteğe bağlı) | Name (optional) |
| `intern.placeholder` | İntörn {n} | Intern {n} |
| `setup.staffing.title` | Kadro | Staffing |
| `setup.staffing.min` | Bir nöbette en az | Minimum per shift |
| `setup.staffing.people` | {n} kişi | {n} interns |
| `setup.staffing.math` | {n} intörn × 16 nöbet = {total} atama, 56 nöbet, ortalama {avg} kişi | {n} interns × 16 shifts = {total} assignments over 56 slots, average {avg} per shift |
| `setup.staffing.warn` | Hedef ortalamanın üstünde; bazı nöbetler hedefin altında kalacak. | The target is above the average; some shifts will fall short. |
| `setup.continue` | Panoya geç | Go to board |
| `board.tab.calendar` | Takvim | Calendar |
| `board.tab.matrix` | Matris | Matrix |
| `shift.day` | Gündüz | Day |
| `shift.night` | Gece | Night |
| `shift.day.hours` | 08-20 | 08-20 |
| `shift.night.hours` | 20-08 | 20-08 |
| `shift.legend` | Gündüz 08:00-20:00 · Gece 20:00-08:00 | Day 08:00-20:00 · Night 20:00-08:00 |
| `matrix.legend` | G: gündüz 08:00-20:00 · N: gece 20:00-08:00 | D: day 08:00-20:00 · N: night 20:00-08:00 |
| `matrix.code.day` | G | D |
| `matrix.code.night` | N | N |
| `matrix.total` | Toplam | Total |
| `chip.counts` | G {day}/8 · N {night}/8 | D {day}/8 · N {night}/8 |
| `chip.complete` | Kota tamam | Quota complete |
| `chip.lock` | Kilitle | Lock |
| `chip.unlock` | Kilidi aç | Unlock |
| `chip.remove` | Kaldır | Remove |
| `chip.locked` | Kilitli | Locked |
| `slot.empty` | Boş | Empty |
| `popover.assign.title` | İntörn ekle | Add intern |
| `popover.assign.conflict` | Kural ihlali oluşturur | Would break a rule |
| `popover.assign.already` | Bu nöbette | Already here |
| `toolbar.randomize` | Rastgele doldur | Randomize |
| `toolbar.reset` | Sıfırla | Reset |
| `toolbar.export` | Dışa aktar | Export |
| `toolbar.settings` | Ayarlar | Settings |
| `toolbar.undo` | Geri al | Undo |
| `toolbar.redo` | Yinele | Redo |
| `export.png.calendar` | PNG, takvim | PNG, calendar |
| `export.png.matrix` | PNG, matris | PNG, matrix |
| `export.xlsx` | Excel | Excel |
| `export.print` | Yazdır / PDF | Print / PDF |
| `export.json` | JSON dosyası | JSON file |
| `export.import` | JSON içe aktar | Import JSON |
| `export.link` | Bağlantıyı kopyala | Copy link |
| `export.header` | Acil tıp intörn nöbet listesi | Emergency medicine intern shift list |
| `export.generated` | Oluşturulma: {date} | Generated: {date} |
| `toast.linkCopied` | Bağlantı kopyalandı | Link copied |
| `toast.loadedFromLink` | Program bağlantıdan yüklendi | Schedule loaded from the link |
| `toast.badLink` | Bağlantı okunamadı | Could not read the link |
| `toast.imported` | JSON içe aktarıldı | JSON imported |
| `toast.badFile` | Dosya okunamadı | Could not read the file |
| `toast.exported` | {name} indirildi | {name} downloaded |
| `toast.randomized` | Program dolduruldu | Schedule filled |
| `toast.randomized.short` | Program dolduruldu, {n} nöbet hedefin altında | Schedule filled, {n} shifts below target |
| `dialog.cancel` | Vazgeç | Cancel |
| `dialog.reset.title` | Programı sıfırla | Reset the schedule |
| `dialog.reset.body` | Tüm atamalar silinecek. | All assignments will be removed. |
| `dialog.reset.keepLocked` | Kilitli atamaları koru | Keep locked assignments |
| `dialog.reset.confirm` | Sıfırla | Reset |
| `dialog.randomize.title` | Rastgele doldur | Randomize |
| `dialog.randomize.body` | Kilitli olmayan {n} atama değişecek. | {n} unlocked assignments will change. |
| `dialog.randomize.confirm` | Doldur | Fill |
| `dialog.link.title` | Bağlantıdan yükle | Load from link |
| `dialog.link.body` | Mevcut taslağın yerine bağlantıdaki program açılsın mı? | Replace the current draft with the schedule in this link? |
| `dialog.link.confirm` | Yükle | Load |
| `dialog.internCount.title` | İntörn sayısını azalt | Reduce intern count |
| `dialog.internCount.body` | {n} intörn ve {a} atama silinecek. | {n} interns and {a} assignments will be removed. |
| `dialog.internCount.confirm` | Azalt | Reduce |
| `diag.title` | Denetim | Checks |
| `diag.group.errors` | Kural ihlalleri | Rule violations |
| `diag.group.staffing` | Kadro | Staffing |
| `diag.group.quota` | Eksik kotalar | Incomplete quotas |
| `diag.empty` | Sorun yok | No issues |
| `v.POST_NIGHT_DAY` | {intern}: {date} gece nöbetinden sonra ertesi gün gündüz nöbeti olamaz | {intern}: cannot work the day shift right after the night shift of {date} |
| `v.NIGHT_GAP` | {intern}: {date1} ve {date2} gece nöbetleri arasında en az 2 tam gün olmalı | {intern}: night shifts on {date1} and {date2} need at least 2 full days between them |
| `v.DOUBLE_SHIFT` | {intern}: {date} hem gündüz hem gece | {intern}: both day and night on {date} |
| `v.QUOTA_OVER` | {intern}: {count}/8 {shift} nöbeti, kota aşıldı | {intern}: {count}/8 {shift} shifts, over quota |
| `v.QUOTA_INCOMPLETE` | {intern}: {shift} {count}/8 | {intern}: {shift} {count}/8 |
| `v.UNDER_STAFFED` | {date} {shift}: {count}/{min} kişi | {date} {shift}: {count}/{min} interns |
| `v.UNDER_STAFFED.empty` | {date} {shift}: boş | {date} {shift}: empty |
| `v.HIGH_DENSITY` | {date} {shift}: {count} kişi, yüksek yoğunluk | {date} {shift}: {count} interns, high density |
| `settings.title` | Ayarlar | Settings |
| `settings.language` | Dil | Language |
| `settings.theme` | Görünüm | Appearance |
| `theme.system` | Sistem | System |
| `theme.light` | Açık | Light |
| `theme.dark` | Koyu | Dark |
| `week.label` | {n}. hafta | Week {n} |
| `a11y.dragHint` | Sürükleyin veya seçmek için Enter'a basın | Drag, or press Enter to pick |
| `a11y.slot` | {date} {shift} nöbeti | {date} {shift} shift |
| `stepper.decrease` | Azalt | Decrease |
| `stepper.increase` | Artır | Increase |

`{shift}` in violation messages is filled with `shift.day` / `shift.night` in lower case as written in the table (`gündüz`, `gece`, `day`, `night`); `{intern}` with the real name or placeholder; `{date}` with `d MMM EEE` in the current locale.

## 10. Exports (`export/`)

All image and print exports render `ExportFrame`, a component that receives the schedule and a view and renders in the light palette regardless of the app theme, fixed width 1600 px, mounted off-screen (`position: fixed; left: -10000px`, never `display: none`) only while an export runs.

- PNG: `toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: '#FFFFFF' })` from `html-to-image`; file `nobet-<startDate>-takvim.png` or `-matris.png`. Safari sometimes returns a blank image on the first call; call `toPng` twice and keep the second result (known workaround, keep it).
- Excel (`xlsx`): workbook with three sheets. `Takvim`: columns Tarih (`d MMM yyyy`), Gün (weekday), Gündüz 08-20, Gece 20-08; names joined with `, `; 28 rows. `Matris`: first column intern label, then 28 columns headed `EEE d`, cells `G` / `N` / blank (`G/N` if both, which is a violation but must still export), then Gündüz, Gece, Toplam totals. `Özet`: intern, gündüz, gece, toplam, plus a final row with slot statistics (empty slots, slots below target). Sheet names and headers follow the current language. File `nobet-<startDate>.xlsx`.
- Print / PDF: `window.print()`; `styles/print.css` shows the `ExportFrame` calendar view on one A4 landscape page (`@page { size: A4 landscape; margin: 10mm }`). No PDF library. Three details are load-bearing: the app is hidden only while the frame is mounted (`body:has(#print-root > *)`), so a plain Cmd+P still prints something readable; portals outside `#root` (toasts, dialogs, tooltips) are hidden; and the frame is scaled with `zoom`, not `transform`, because a transform leaves the layout box at full size and the page then breaks at the unscaled height. `printSchedule()` measures the mounted frame and sets `--print-scale` to `min(277mm / 1600px, 190mm / height)` so the board fits in both directions at any intern count.
- JSON: §7.1, via a Blob download; import through a hidden `<input type="file" accept=".json">`.
- Link: `encodeHash()`, write to `location.hash`, copy `location.href` with `navigator.clipboard.writeText`; fall back to a read-only text field in a dialog when the clipboard API is unavailable.

Downloads use an `<a download>` element created and revoked per export.

## 11. Drag and drop and keyboard (`components/board/`)

- `DndContext` with `MouseSensor` (activation distance 6 px), `TouchSensor` (delay 150 ms, tolerance 8 px) and `KeyboardSensor`. Not `PointerSensor`: it answers every `pointerdown`, touch included, so `TouchSensor` never instantiates and the browser cancels the drag the moment it decides the gesture is a scroll. Screen-reader instructions and announcements are supplied through `accessibility`, since dnd-kit's defaults are English and name raw ids.
- Draggables: palette rows (data `{ source: 'palette', internId }`) and placed chips (data `{ source: 'slot', internId, dayIndex, type }`).
- Droppables: every slot zone (`{ dayIndex, type }`) and the palette panel (`'palette'`, drop here to remove).
- On drag over a slot: compute `wouldViolate()` for the candidate and show the ghost outline (§DESIGN 5.4). For a drag that starts in a slot the candidate is a *move*, so the source assignment is removed from the schedule first; judging it as a pure addition reports the cell the move is about to vacate and marks every legal move on a full board as a rule break. On drop: `ASSIGN` or `MOVE`; a structural duplicate is a no-op with a 180 ms shake on the target.
- Click-to-assign: clicking empty space in a slot zone opens the assign popover listing every intern with counts and a status mark (`already`, `conflict`, or none). Selecting dispatches `ASSIGN`. Clicking a chip opens the chip popover (lock / unlock, remove).
- Keyboard: slots and chips are focusable; `Enter` opens the relevant popover; `Delete` on a focused chip removes it; `⌘Z` / `Ctrl+Z` undo, `⇧⌘Z` / `Ctrl+Y` redo; `Esc` closes popovers and dialogs.

## 12. Acceptance criteria

1. Setup shows three cards in order; the second appears after a Monday is chosen, the third after the count is set; all three stay editable and reopen from the board's settings sheet.
2. Only Mondays are selectable in the calendar; picking one highlights exactly 28 days and the range label updates in the current language.
3. Changing the intern count or the target never crashes and never orphans an assignment.
4. The board renders 4 rows × 7 columns, each cell with a date, a day zone labelled 08-20 and a night zone labelled 20-08.
5. Dropping an intern anywhere is accepted except as a duplicate in the same slot; violations appear within one frame as chip badges, zone rings, tooltips and diagnostics entries, and disappear when the cause is removed.
6. Every message in the diagnostics panel names the intern, the date and the reason, and clicking it scrolls to and pulses the cell.
7. Intern chips in the palette show `G x/8 · N y/8`, turn to the complete state at exactly 8/8 for both, and to the error state above 8.
8. Randomize with no locks yields a board with zero errors and every intern at 8/8 + 8/8, for every N in 4..8, on 50 seeds each (test) and visibly in the app; with 7 interns and target 2 it reaches every slot at exactly 2 on most seeds.
9. Randomize with locks keeps every locked chip in place.
10. The name pool names only the interns the user has not named; a typed name is never moved, and drawing again reshuffles just the drawn ones.
11. Reset asks for confirmation and honours "keep locked".
12. Undo and redo work for every undoable action, including after a randomize.
13. PNG export at 3× shows the whole board with real names, dates, legend and title, no app chrome, in the light palette; Excel has the three sheets; print preview is one A4 landscape page.
14. The share link reopens the same board on another device, including locks and names; a corrupted link shows a toast and does not break the page.
15. Reload restores the draft. Language and theme switches apply instantly to every string and surface, including dates.
16. At 375 px width the board is usable with tap-to-assign; nothing scrolls horizontally.
17. Keyboard-only users can assign, lock, remove and undo.
18. `prefers-reduced-motion` removes the staggered fill and pulses; functionality is unchanged.

## 13. Test plan (Vitest)

Unit tests live in `src/**/__tests__/` or beside the module as `*.test.ts`.

- `rules.test.ts`: one test per row of the examples table in §4.1; sorting; `wouldViolate` excludes pre-existing violations; `internPatternValid` agrees with `validate` on 1 000 random patterns.
- `solver.test.ts`: hard-rule properties with `moves: 20_000` to keep CI fast: seeds 1..50 × N 4..8, no locks → zero errors, zero incomplete, no locked output; determinism (same seed, same output; different seed, different output for at least one N); locks preserved on 20 seeds with 20 % of a valid solution locked; contradictory locks (two nights one day apart) still return a result and `validate()` contains `NIGHT_GAP`; nine locked nights → exactly those nine, nothing added. Staffing quality at full defaults: N = 4, target 1, seeds 1..5 → `shortSlots === 0`; N = 8, target 2, seeds 1..5 → `shortSlots === 0`; N = 7, target 2, seeds 1..10 → `shortSlots ≤ 2` for every seed and `=== 0` for at least 7 of them (raise `moves` if this fails, do not lower the bar); runtime under 2 s per call at defaults for N = 8.
- `pool.test.ts`: a typed (pinned) name is never moved or overwritten, only open interns draw, no name reaches two interns, Turkish casing is handled, a second draw reshuffles the drawn names and leaves the typed ones, a shrinking pool clears what it can no longer supply, deterministic per seed.
- `codec.test.ts`: hash round trip on 200 random schedules; every malformed variant returns `null`; JSON `isSchedule` rejects each broken invariant.
- `reducer.test.ts`: every action's semantics from §8, undo/redo stacks, cap 100, `SET_INTERN_COUNT` shrink removes assignments, `MOVE` carries `locked`.
- `i18n.test.ts`: key parity, every `{param}` in tr exists in en and vice versa, `t()` replacement.
- `dates.test.ts`: `weekdayOf`, `dateOf` across a DST change (a rotation containing the last Sunday of October), `isMonday`.
- `export.test.ts` (node, no DOM): the Excel workbook builder produces three sheets with the expected headers and 28 / N rows.
- Component smoke tests with Testing Library: setup renders and gates cards; board renders 56 zones; assign popover dispatches `ASSIGN`.

## 14. Solo schedules and merging

Everyone plans their own month alone and exports it; one person then loads every
file at once and the combined board shows where the choices collide. The merge is
a negotiation report, not a finished plan: the union of freely chosen shifts is
almost never a legal schedule, and saying so is the point of the feature.

### 14.1 Modes

The first screen offers two modes. The mode is not stored anywhere. A schedule
with a single intern is solo, anything else is a team schedule; `modeOf()` in
`state/reducer.ts` is the only definition.

| | Team | Solo |
|---|---|---|
| Roster | 4 to 8 interns | exactly 1 |
| Setup cards | period, interns, staffing, name pool | period, your name |
| `UNDER_STAFFED` | reported | not reported: one person cannot staff 56 slots, so every slot they skipped would be a warning |
| Name pool | available | hidden, there is nobody to hand a name to |
| Everything else | identical | identical |

`SET_INTERN_COUNT` clamps to [4, 8]; only `SET_MODE` produces a roster of one.
`makeInterns` has a floor of 1 so a solo roster can be built, and `isSchedule`
and `decodeHash` accept 1 to 8 so a solo file and a solo link both round-trip.

### 14.2 The merge (`engine/merge.ts`)

`mergeSchedules(inputs)` is pure and takes `{ file, schedule }[]`. It is the only
code that combines schedules. Per file, in the order given:

1. Interns with no assignment contribute nothing. A file where nobody has a shift
   is excluded as `noPeople`.
2. A contributing intern with an empty name excludes the file as `unnamed`. Files
   are combined by name, so an anonymous one cannot be placed.
3. The first usable file fixes the period. A file with a different `startDate` is
   excluded as `dateMismatch`.
4. A name an earlier file already holds excludes the file as `duplicate`, and the
   report names the file it collides with.
5. A file that would push the roster past `MAX_INTERNS` is excluded as `tooMany`.

`duplicate` and `tooMany` set `blocked`, because they need a decision from the
user rather than a silent drop; the other three are reported and skipped. The
board is built from the accepted people sorted by `localeCompare(_, 'tr')`, so
the same files always give the same board and the same colours whatever order
they were picked in. Ids and colours are reassigned by that order, locked shifts
survive, and `minPerShift` is `defaultMinPerShift(people.length)`.

The report carries slots with nobody (`empty`), slots above the target (`over`),
people not on exactly 8 and 8 (`incomplete`), and the number of severity `error`
violations from `validate()` on the combined board (`ruleErrors`).

### 14.3 The import menu

Import is its own control beside export, holding `JSON dosyası` and
`Programları birleştir`. Loading one file over a board that has content asks
first, exactly as a share link does. The merge writes nothing until the user
presses `Panoya aktar`, and applying dispatches `LOAD_SCHEDULE`, which clears the
history.
