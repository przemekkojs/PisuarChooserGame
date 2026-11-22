# Pisuar Chooser – mechanika v2 – plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Więcej postaci niż efektów na planszach, lokatorzy i podłoga współistniejące na slocie, 7 nowych rodzajów lokatorów i 3 zdarzenia dynamiczne ze zapowiedzią, pauza z „zakończ turę”, tryb poziomy 1920×1080.

**Architecture:** `Slot = { floor, occupant }`; parametry lokatorów w jednej tabeli `OCCUPANTS` (`config.ts`); koszt pisuaru sumuje wpływ lokatora i „zapachu podłogi” zajętych slotów; zdarzenia dynamiczne to czysty planer + aplikator (`events.ts`) wpięty w `tick` maszyny stanów; pauza to flaga w stanie. Cała logika w `packages/core` (seedowana, bez Phasera), scena tylko renderuje.

**Tech Stack:** TypeScript strict, Vitest, Phaser 3, Vite, Capacitor 6 (Android).

**Spec:** `docs/superpowers/specs/2026-11-22-mechanics-v2-design.md` (czytać razem z planem; rozdz. 10 i 11 zawierają decyzje).

## Global Constraints
- Kod i identyfikatory po angielsku, teksty UI i dokumenty po polsku. Commity: `feat(core): …` / `feat(game): …`, stopka `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gałąź robocza: `feat/mechanics-v2` utworzona z `feat/pisuar-chooser` przed zadaniem 1.
- TDD: najpierw czerwony test, potem kod; liczba testów nie maleje; `npm test` i `npm run typecheck` zielone po każdym zadaniu (zadanie 1 obejmuje też minimalną migrację aplikacji właśnie po to, by typecheck pozostał zielony).
- Rdzeń deterministyczny: losowość tylko z `Rng` przekazanego do `createGame` (`createRng(seed)`), nigdy `Math.random`.
- Wartości z tabeli `OCCUPANTS` i stałych `LEVELS`/`LEVELS.dynamic` są początkowe; ostateczne stroi zadanie 12 symulacją.
- Zachowane niezmienniki balansu (`balance.test.ts`): P(poz. 1) ≥ 0,4; P(poz. 30) ≤ 0,2; trudność niemalejąca z tolerancją 2% na poziom.
- Tapnięcie w slot z lokatorem = „zajęty” (kara czasowa); ocena wyboru zawsze względem planszy z chwili tapnięcia.
- Czas rdzenia zawsze wielokrotność 100 ms; zapowiedź zdarzenia dynamicznego `TELEGRAPH_MS = 1500`.
- Uruchamianie testów: `npm test -w @pisuar/core -- <fragment nazwy pliku>` i `npm test -w @pisuar/game -- <fragment>`; całość: `npm test`; typy: `npm run typecheck`.

## Review Focus
1. Zdarzenie dynamiczne w trakcie pauzy (czas i zapowiedzi stoją; po wznowieniu ciągną dalej) → test w zad. 3 i 9.
2. Tapnięcie w `gap`, w slot zapowiedzianej (jeszcze niewykonanej) zmiany i w slot po wykonaniu zmiany → testy w zad. 7 i 9/10.
3. Plansze o 18 pisuarach z parą i wszystkimi odblokowanymi rodzajami, poziomy 1–60, seedy 1–300, zawsze poprawne (≥2 wolne, koszty nierówne) → test w zad. 6/7.
4. `endRun` z różnych faz (START, SUMMARY → bez efektu), „Kontynuuj” po `endRun` odrzucone, `acknowledgeSummary` zeruje stan → zad. 3.
5. Zdarzenie, które po wykonaniu unieważniłoby planszę (np. `arrive` zjadający przedostatni wolny slot) → `Cancelled`, plansza bez zmian → zad. 10; dodatkowo `levelParams` dla poziomów > 40 i `NaN` nie rzuca → zad. 2.

---

## Etap 1 – model slotu, koszt, generator

### Task 1: Slot z lokatorem i podłogą, koszt, kary (rdzeń + minimalna migracja aplikacji)

**Files:**
- Modify: `packages/core/src/types.ts`, `config.ts`, `cost.ts`, `scoring.ts`, `generator.ts`, `game.ts`, `index.ts`
- Modify: `packages/core/test/helpers.ts`, `cost.test.ts`, `scoring.test.ts`, `generator.test.ts`, `game.test.ts` (migracja do nowego `Slot`)
- Modify: `apps/game/src/scene/GameScene.ts`, `placeholders.ts` (tylko dostosowanie do `occupant`/`floor`; wygląd bez zmian)

**Interfaces:**
- Produces (`types.ts`):
```ts
export type Floor = 'clean' | 'wet' | 'pee';
export type OccupantKind = 'plain'|'smelly'|'parent'|'child'|'gap'|'shy'|'splasher'|'outOfOrder';
export interface Occupant { kind: OccupantKind }
export interface Slot { floor: Floor; occupant: Occupant | null }
export type Board = Slot[];
export interface OccupantSpec { weight: number; decayBase: number; penaltyPct: number; isPerson: boolean }
export interface CostWeights { floor: Record<Floor, number>; occupants: Record<OccupantKind, OccupantSpec>; floorScentDecay: number }
```
- Produces (`config.ts`): `OCCUPANTS: Record<OccupantKind, OccupantSpec>` z wartościami z tabeli w spec rozdz. 4 (`isPerson` true dla plain/smelly/parent/child/shy/splasher; false dla gap/outOfOrder; dla gap i outOfOrder `weight: 0`, `decayBase: 0.5`); `DEFAULT_WEIGHTS = { floor: {clean:0,wet:1,pee:3}, occupants: OCCUPANTS, floorScentDecay: 0.5 }`.
- Produces (`scoring.ts`): `timePenaltyMs(fullTimeMs: number, penaltyPct: number): number` (zmiana: drugi parametr to procent, nie `smelly`); `occupiedPenaltyMs(board, index, fullTimeMs)` bierze `penaltyPct` z `OCCUPANTS[occupant.kind]`.
- Produces (`helpers.ts`): `parseBoard(s)` — tokeny `<occ>[:<floor>]`; wolny slot: `_` (clean), `M` (wet), `S` (pee); lokator: `X` plain, `Z` smelly, `C` child, `P` parent, `G` gap, `Y` shy, `H` splasher, `O` outOfOrder; sufiks `:M` / `:S` ustawia podłogę pod lokatorem (np. `X:M`, `Z:S`).
- Usuwane: `SCORING.occupiedPct`, `SCORING.smellyPct`, `smellyMultiplier`, `CostWeights.decayBase` (zastąpione tabelą).

- [ ] **Step 1: Write failing tests** (`cost.test.ts`), z wagami domyślnymi, `urinalCost(parseBoard(...), i)`:
  - `'X _'` idx 1 → `1`; `'X:M _'` idx 1 → `2`; `'Z:S _ _'` idx 1 → `6`, idx 2 → `3`;
  - `'C _'` idx 1 → `2`; `'P _'` idx 1 → `1`; `'Y _ _'` idx 1 → `1`, idx 2 → `0.8` (toBeCloseTo);
  - `'O _'` idx 1 → `0`; `urinalCost(board, indexOfOccupied)` → `Infinity` dla dowolnego lokatora (także `O`, `G`);
  - wolny slot nie wpływa na sąsiada poza własną podłogą: `'M _'` idx 1 → `0`.
  W `scoring.test.ts`: `timePenaltyMs(10000, 0.2) === 2000`, `timePenaltyMs(10000, 0.1) === 1000`, `occupiedPenaltyMs(parseBoard('G _ _'), 0, 10000) === 2000`, `occupiedPenaltyMs(parseBoard('Z _'),0,10000) === 2000`, wolny slot → `0`.
- [ ] **Step 2:** `npm test -w @pisuar/core -- cost` → FAIL (typy/tokeny).
- [ ] **Step 3: Implement.** `urinalCost`: koszt = `w.floor[slot.floor]` + suma po slotach `j ≠ i`: jeśli `occupant`: `spec.weight · spec.decayBase^(|j−i|−1)` oraz `w.floor[floor_j] · w.floorScentDecay^(|j−i|−1)`; wolny `j` nie wnosi nic. `bestIndices`/`evaluatePick`/`isValid` działają na „wolny = `occupant === null`”. `generator.ts`: na tym etapie generuje te same plansze co dotąd, tylko w nowym kształcie (plain/smelly rozmieszczone jak teraz; podłoga tylko na wolnych slotach); `fallbackBoard` analogicznie. `game.ts`: `pick` używa `slot.occupant`.
- [ ] **Step 4:** Migrować pozostałe testy rdzenia i helper `parseBoard`; migrować `GameScene.ts`/`placeholders.ts` (renderowanie: wolny slot — pasek podłogi; `occupant.kind === 'smelly'` ma kolor smelly, pozostałe lokatory kolor `person`; podłoga pod lokatorem rysowana tak samo jak pod wolnym). `npm test` i `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(core): slot with occupant and floor, floor scent in cost`.

### Task 2: Generator v2 – więcej postaci, mniej efektów, współwystępowanie

**Files:**
- Modify: `packages/core/src/difficulty.ts`, `config.ts` (`LEVELS`), `generator.ts`
- Modify: `packages/core/scripts/stats.ts`, `simulate.ts` (nowy kształt `LevelParams`)
- Test: `packages/core/test/difficulty.test.ts`, `generator.test.ts`, `balance.test.ts`

**Interfaces:**
- Consumes: `Slot`, `Board`, `OccupantKind`, `OCCUPANTS`, `Rng`.
- Produces (`difficulty.ts`):
```ts
export type DynamicKind = 'mop' | 'arrive' | 'leave';
export interface LevelParams {
  urinals: number; timeMs: number;
  people: number;            // wszystkie osoby łącznie (włącznie z dzieckiem i rodzicem)
  smelly: number; shy: number; splasher: number; // podzbiory `people`
  pairs: 0 | 1;              // 1 = para dziecko+rodzic (+gap), liczy się jako 2 osoby
  outOfOrder: number;        // dodatkowe, poza `people`
  wet: number; pee: number;  // łączny budżet efektów (w tym wet od splasherów)
  dynamic: DynamicKind[];    // odblokowane zdarzenia (puste do zad. 9)
  dynamicMax: 1 | 2;
}
export function levelParams(difficultyLevel: number): LevelParams;
```
  W tym zadaniu `shy = splasher = pairs = outOfOrder = 0`, `dynamic = []`, `dynamicMax = 1`; wypełniają je zad. 6, 7, 9.
- Produces (`generator.ts`): `generateBoard(params, rng, w = DEFAULT_WEIGHTS): Board` — bez zmiany sygnatury.
- Produces (`config.ts`): `LEVELS.peopleShare = 0.35`, `LEVELS.effectShareOfPeople = 0.5`, `LEVELS.effectUnderOccupantP = 0.5`; `wetStart: 4`, `peeStart: 10` (reszta jak dotąd, do strojenia w zad. 12).

- [ ] **Step 1: Write failing tests.**
  - `levelParams(1)` → `urinals 3`, `people 1`, `wet 0`, `pee 0`; dla każdego poziomu 1..60: `people === clamp(round(urinals·0.35), 1, urinals−2)`, `wet + pee ≤ floor(people/2)`, `smelly ≤ people`, żadna wartość nie jest NaN; `levelParams(NaN)` i `levelParams(-5)` zwracają to samo co poziom 1 (nie rzucają).
  - Generator, seedy 1..200 × poziomy 1..60: `board.length === urinals`; ≥2 wolne sloty i koszty nie wszystkie równe; liczba lokatorów = `people`; liczba slotów z `floor !== 'clean'` ≤ `wet + pee`.
  - Współwystępowanie, poziom 20, seedy 1..200: łącznie slotów z efektem pod lokatorem / wszystkich slotów z efektem ∈ [0.3, 0.7].
  - Mieszanka: poziom 12, seedy 1..200: w każdej planszy z `people ≥ 2` jest ≥1 `plain`.
- [ ] **Step 2:** `npm test -w @pisuar/core -- difficulty generator` → FAIL.
- [ ] **Step 3: Implement.** `levelParams`: budżet jak w spec rozdz. 6 (`people`, `effects = min(floor(people/2), growth wet+pee)` rozdzielone między `wet`/`pee` wg `wetStart`/`peeStart`); smelly rośnie jak dotąd, ograniczony `people−1` gdy `people ≥ 2`. `randomBoard`: rozstaw lokatorów i wolnych losowo; każdy efekt trafia pod losowego lokatora z p = `effectUnderOccupantP`, w przeciwnym razie na losowy wolny slot z `clean` (jeśli brak miejsca na danej stronie, na drugą). Ścieżka zapasowa jak dotąd (bez efektów).
- [ ] **Step 4:** Zaktualizować `stats.ts`/`simulate.ts` pod nowe pola; `npm run sim -w @pisuar/core` działa; `balance.test.ts` zielony (jeśli niezmienniki padają, delikatnie dostroić `LEVELS`, nie osłabiać testu). `npm test` PASS.
- [ ] **Step 5: Commit** `feat(core): generator v2 with more people and coexisting floor effects`.

---

## Etap 2 – pauza i tryb poziomy (niezależny od etapu 1)

### Task 3: Pauza i `endRun` w maszynie stanów

**Files:**
- Modify: `packages/core/src/game.ts`, `index.ts`; `apps/game/src/session.ts` (obsługa `RunEnded`)
- Test: `packages/core/test/game.test.ts`, `apps/game/test/session.test.ts`

**Interfaces:**
- Produces: `Command` += `{ type: 'pause' } | { type: 'resume' } | { type: 'endRun' }`; `GameEvent` += `{ type: 'Paused' } | { type: 'Resumed' } | { type: 'RunEnded' }`; `GameState` += `paused: boolean`, `endedByPlayer: boolean` (oba początkowo `false`).

- [ ] **Step 1: Write failing tests** (`game.test.ts`, gra z seedem, faza `PLAYING`):
  - `pause` → `[{type:'Paused'}]`, `state.paused === true`; powtórne `pause` → `[]`;
  - w pauzie: `tick(5000)`, `pickUrinal(0)`, `skipLevel`, `openDoor` zwracają `[]`, a `timeLeftMs` bez zmian;
  - `resume` → `[{type:'Resumed'}]`; potem `tick(100)` zmniejsza `timeLeftMs` o 100; `resume` bez pauzy → `[]`;
  - `pause` w `DOOR_CLOSED` działa, `openDoor` w pauzie → `[]`, po `resume` `openDoor` działa;
  - `endRun` z `PLAYING` → `[{type:'RunEnded'}]`, `phase === 'SUMMARY'`, `paused === false`, `endedByPlayer === true`; to samo z pauzy, z `DOOR_CLOSED` i z `LEVEL_RESULT`;
  - `endRun` w `START` i `SUMMARY` → `[]`;
  - po `endRun`: `buyPerk continue` → `[]` (saldo bez zmian); `acknowledgeSummary` → `phase START`, `endedByPlayer false`;
  - rekord: po rozwiązaniu 2 poziomów (`playerLevel 2`) i `endRun` rekord dla trudności = 2 (`NewRecord` padło już przy wyborze), `endRun` nie emituje drugiego `NewRecord`;
  - `playerLevel` po `endRun` w trakcie nierozwiązanego poziomu = liczba rozwiązanych (bieżący odrzucony);
  - nowy `startGame` zeruje `paused`/`endedByPlayer`.
  - `session.test.ts`: `onEvents` z `RunEnded` nie zmienia i nie zapisuje salda i nie rzuca.
- [ ] **Step 2:** `npm test -w @pisuar/core -- game` → FAIL.
- [ ] **Step 3: Implement** w `dispatch`: ignorowanie komend w pauzie wg listy z testów (poza `resume`, `endRun`); `endRun` jak w spec rozdz. 7.
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(core): pause, resume and endRun`.

### Task 4: Tryb poziomy 1920×1080 (stałe, układ, manifest Androida, rozmieszczenie ekranów)

**Files:**
- Modify: `apps/game/src/constants.ts` (`GAME_WIDTH = 1920`, `GAME_HEIGHT = 1080`), `scene/layout.ts`, `scene/GameScene.ts`, `StartScene.ts`, `SummaryOverlay.ts`, `PreloadScene.ts`, `assets.ts` (`IMAGE_SIZES` dla `bg_wall` 1920×1080, `bg_floor` 1920×380 i proporcje `door`), `scripts/generate-assets.mjs`, `public/assets/*` (wygenerowane), `assets/ASSETS.md`
- Modify: `apps/game/android/app/src/main/AndroidManifest.xml` (`screenOrientation="landscape"`), `docs/progress/android-build.md` (wzmianka o orientacji)
- Test: `apps/game/test/layout.test.ts`, `assets.test.ts`

**Interfaces:**
- Produces: `urinalRects(count, width, height): Rect[]`, `hitIndex(...)` — te same sygnatury; zmienione stałe wewnątrz tak, by spełnić testy.

- [ ] **Step 1: Write failing tests** (`layout.test.ts`, `urinalRects(n, GAME_WIDTH, GAME_HEIGHT)`):
  - dla `n` = 3..18: `rects.length === n`; każdy `x ≥ 0` i `x + w ≤ 1920`; każdy `y ≥ 0` i `y + h ≤ 1080`; rzędy równoodległe (stały odstęp), układ symetryczny (`left` ≈ `1920 − (ostatni.x + w)`);
  - `n = 18` → każdy `w ≥ 90`; `n = 3` → `w ≤ 0.22 · 1920`;
  - `hitIndex(rects, środekX_i, środekY, 220)` → `i` dla każdego `i` (n = 3..18); klik poza rzędem (`y` powyżej `first.y − pad`) → `-1`.
  - `assets.test.ts`: rozmiary w `IMAGE_SIZES` zgodne z viewBox wygenerowanych SVG (istniejąca zasada) i `bg_wall` ma `1920×1080`.
- [ ] **Step 2:** `npm test -w @pisuar/game -- layout assets` → FAIL.
- [ ] **Step 3: Implement.** Stałe w `layout.ts` przeliczone na szeroki układ (stałe `MARGIN_FRAC`, `GAP_FRAC`, `MAX_W_FRAC`, `ASPECT`, `MAX_H_FRAC` dostrojone testem). Sceny: pozycje HUD/przycisków/drzwi/tytułów liczone z `GAME_WIDTH/HEIGHT` zamiast liczb na sztywno (drzwi wyśrodkowane, HUD u góry rozciągnięty, „Pomiń poziom” w prawym dolnym rogu), `SummaryOverlay` panel szerszy. Generator zasobów zregenerowany (`node apps/game/scripts/generate-assets.mjs`).
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build -w @pisuar/game` PASS. Podgląd przeglądarkowy (Vite, okno 1920×1080 lub `resize_window`): start, drzwi, plansza 3 i 18 pisuarów, podsumowanie — nic nie wychodzi poza ekran, tekst się mieści. Wynik zapisać w opisie commita.
- [ ] **Step 5: Commit** `feat(game): landscape 1920x1080 layout`.

### Task 5: Menu pauzy w aplikacji

**Files:**
- Create: `apps/game/src/scene/pauseInfo.ts`, `apps/game/src/scene/PauseOverlay.ts`, `apps/game/src/backAction.ts`
- Modify: `apps/game/src/scene/GameScene.ts` (przycisk pauzy w HUD, wpięcie overlay, zasłonięcie planszy, obsługa `Paused/Resumed/RunEnded`), `apps/game/src/lifecycle.ts` (`onBackButton`), `StartScene.ts`/`SummaryOverlay.ts` (Wstecz)
- Test: `apps/game/test/pauseInfo.test.ts`, `backAction.test.ts`, `lifecycle.test.ts`

**Interfaces:**
- Consumes: `GameState.paused`, `endedByPlayer`, komendy `pause/resume/endRun` (zad. 3), `Difficulty`.
- Produces:
```ts
export function pauseLines(s: Readonly<GameState>): string[]; // pauseInfo.ts
export type BackAction = 'pause' | 'resume' | 'summaryOk' | 'exit';
export function backAction(screen: 'start' | 'play' | 'summary', paused: boolean): BackAction; // backAction.ts
export function onBackButton(handler: () => void): () => void; // lifecycle.ts, zwraca unsubscribe
```
- Etykiety przycisków: „Wznów”, „Zakończ turę”.

- [ ] **Step 1: Write failing tests.**
  - `pauseLines(state)` (state z `createGame` po kilku ruchach) zawiera wiersze z: trudnością po polsku (`Łatwy`/`Średni`/`Trudny`), `Poziom: ${playerLevel+1}`, `Punkty: ${balance}`, `Rekord: ${record}`, pozostałym czasem w sekundach z jednym miejscem po przecinku (użyć `format.ts`), użyciem perków (`skip`, `continue`).
  - `backAction('play', false) === 'pause'`, `('play', true) === 'resume'`, `('summary', false) === 'summaryOk'`, `('start', false) === 'exit'`.
  - `lifecycle.test.ts`: `onBackButton` na platformie webowej bez `App` zwraca działającą funkcję unsubscribe i nie rzuca; na wstrzykniętym fałszywym `App` handler wywołany po zdarzeniu `backButton`, po unsubscribe już nie.
- [ ] **Step 2:** `npm test -w @pisuar/game -- pauseInfo backAction lifecycle` → FAIL.
- [ ] **Step 3: Implement.** `PauseOverlay` (tło zasłaniające planszę, panel z `pauseLines`, dwa przyciski, blokada tapnięć 300 ms jak w `SummaryOverlay`); przycisk „II” w HUD (tylko w `PLAYING`/`DOOR_CLOSED`); `GameScene` wysyła `pause`/`resume`/`endRun`; po `RunEnded` pokazuje `SummaryOverlay` bez przycisku „Kontynuuj” (`endedByPlayer`); Wstecz → `backAction`; schowanie aplikacji nadal porzuca przebieg (bez zmian, przycisk pauzy nie ma znaczenia).
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build -w @pisuar/game` PASS. Podgląd Vite: pauza, wznów (czas nie ucieka), zakończ turę → podsumowanie bez „Kontynuuj”, rekord zapisany. Opisać wynik w commicie.
- [ ] **Step 5: Commit** `feat(game): pause menu and end run`.

---

## Etap 3 – postaci statyczne (po etapie 1; kolejność wobec etapu 2 dowolna)

### Task 6: Nieśmiały, chlapacz, nieczynny pisuar w kosztach i generatorze

**Files:**
- Modify: `packages/core/src/config.ts` (`LEVELS.unlock = { smelly: 6, outOfOrder: 9, pair: 8, shy: 12, splasher: 16 }`, szanse pojawiania), `difficulty.ts`, `generator.ts`
- Test: `cost.test.ts` (przykłady już z zad. 1), `difficulty.test.ts`, `generator.test.ts`

**Interfaces:**
- Consumes: `LevelParams.shy/splasher/outOfOrder` (pola z zad. 2).
- Produces: `levelParams` wypełnia `shy`, `splasher`, `outOfOrder` po progach `LEVELS.unlock` (≥0, zawsze `shy + splasher + smelly ≤ people − 1` gdy `people ≥ 2`, `plain ≥ 1`).

- [ ] **Step 1: Write failing tests.**
  - `levelParams(l).shy === 0` dla `l < 12`, `splasher === 0` dla `l < 16`, `outOfOrder === 0` dla `l < 9`; przy `l = 30` każde z nich ≥ 1 (lub `people`-ograniczone) i suma nie łamie reguły `plain ≥ 1`.
  - Generator, poziom 20, seedy 1..200: plansze zawierają `shy`, `splasher`, `outOfOrder` w liczbach z `params`; **splasher**: każdy sąsiad (`i±1` istniejący) splashera ma `floor !== 'clean'` (wet lub gorszy); wet od splasherów liczy się do `wet + pee` (łączna liczba slotów z efektem ≤ `wet + pee`).
  - **Review Focus 3**: poziomy 1..60 × seedy 1..300: każda plansza poprawna (≥2 wolne, nierówne koszty), długość = `urinals`.
  - `evaluatePick`: tap w `outOfOrder` → `kind 'occupied'`, `delta 0`; `bestIndices` nigdy nie zawiera slotu z lokatorem.
- [ ] **Step 2:** `npm test -w @pisuar/core -- difficulty generator scoring` → FAIL.
- [ ] **Step 3: Implement.** Splasher umieszczany pierwszy; jego sąsiedzi dostają `wet` z budżetu efektów, reszta budżetu losowana jak w zad. 2. `outOfOrder` zajmuje wolny slot (`occupant: {kind:'outOfOrder'}`), nie liczy się do `people`, całość zajętych ≤ `urinals − 2`.
- [ ] **Step 4:** `npm test` PASS, `npm run sim -w @pisuar/core` bez błędów.
- [ ] **Step 5: Commit** `feat(core): shy, splasher and out-of-order occupants`.

### Task 7: Para dziecko + rodzic z pułapką `gap`

**Files:**
- Modify: `packages/core/src/difficulty.ts` (`pairs`), `generator.ts`
- Test: `generator.test.ts`, `game.test.ts`, `scoring.test.ts`

**Interfaces:**
- Consumes: `LevelParams.pairs`, `LEVELS.unlock.pair = 8`.
- Produces: generator wstawia trójkę slotów `child, gap, parent` lub `parent, gap, child` (strona losowa), kolejne sloty obok siebie, `gap.floor` dowolny, `occupant.kind === 'gap'` w środku; para zajmuje 3 sloty, liczy się jako 2 do `people`.

- [ ] **Step 1: Write failing tests.**
  - `levelParams(7).pairs === 0`, `levelParams(8).pairs` ∈ {0, 1} zgodnie z budżetem (`urinals ≥ 5`, po parze zostają ≥2 wolne); gdy budżet za mały, `pairs === 0` i para zastępowana zwykłą osobą.
  - Generator, poziom 20, seedy 1..200: dla `pairs = 1` w planszy jest dokładnie jedna trójka `[child, gap, parent]` lub `[parent, gap, child]` w kolejnych indeksach; w trójce środek to `gap`; strona losowa (w obu wariantach pojawia się ≥1 raz na 200 seedach).
  - **Review Focus 2**: gra z planszą zawierającą `gap` (przez seed lub `createGame` z wstrzykniętą planszą): `pickUrinal(gapIndex)` w `PLAYING` → `[{type:'PickedOccupied', index, penaltyMs: 20% czasu zaokrąglone do 100 ms}]`; tap w `child`/`parent` → 10%.
  - Koszt: wolny pisuar obok `child` o `+1` droższy od tego samego obok `parent` (wzorem `'C _'` = 2 vs `'P _'` = 1) — test w generatorowej planszy kontrolnej.
- [ ] **Step 2:** `npm test -w @pisuar/core -- generator game scoring` → FAIL.
- [ ] **Step 3: Implement** w `randomBoard`: najpierw rezerwacja trójki, potem reszta; walidacja jak dotąd (po wylosowaniu para jest częścią planszy; przy porażce `maxGenerateAttempts` → `fallbackBoard` bez par).
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(core): child-parent pair with trap gap`.

### Task 8: Modele i renderowanie postaci statycznych

**Files:**
- Modify: `apps/game/scripts/generate-assets.mjs`, `src/assets.ts` (`IMAGE_SIZES` + `ASSET_MANIFEST`), `assets/ASSETS.md`, `scene/placeholders.ts`, `scene/GameScene.ts`, `public/assets/*`
- Test: `apps/game/test/assets.test.ts`

**Interfaces:**
- Produces nowe klucze obrazów: `person_child`, `person_parent`, `person_shy`, `person_splasher`, `urinal_oos`, każdy z wpisem w `IMAGE_SIZES`, manifeście i `ASSETS.md`.
- Produces w `placeholders.ts`: `occupantLabel(kind: OccupantKind): string` (znacznik tekstowy fallbacku, np. `'X'`, `'X~'`, `'D'` dziecko, `'R'` rodzic, `'S?'`…) i `occupantColor(kind): number`.

- [ ] **Step 1: Write failing tests** (`assets.test.ts`): każdy z 5 kluczy występuje w manifeście, plik SVG istnieje i jest poprawnym SVG o viewBox zgodnym z `IMAGE_SIZES`, klucz jest opisany w `ASSETS.md`; `occupantLabel`/`occupantColor` zwracają niepuste/różne wartości dla każdego `OccupantKind`.
- [ ] **Step 2:** `npm test -w @pisuar/game -- assets` → FAIL.
- [ ] **Step 3: Implement.** Proste, rozróżnialne kształty (dziecko mniejsze od rodzica i inny kolor niż zwykli; `urinal_oos` to pisuar z tabliczką), generowane skryptem; scena dobiera obraz po `occupant.kind` z fallbackiem do kształtów, `gap` rysowany jako wolny pisuar z ikoną „zakaz” w kolorze pułapki (bez osobnego SVG, kształt w `placeholders.ts`).
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build -w @pisuar/game` PASS; podgląd Vite poziom ≥ 20 pokazuje wszystkie rodzaje czytelnie.
- [ ] **Step 5: Commit** `feat(game): placeholder models for static characters`.

---

## Etap 4 – postaci dynamiczne ze zapowiedzią

### Task 9: Planer i aplikator zdarzeń + sprzątacz (`mop`)

**Files:**
- Create: `packages/core/src/events.ts`
- Modify: `packages/core/src/config.ts` (`LEVELS.dynamic`), `difficulty.ts` (`dynamic`, `dynamicMax`), `game.ts`, `index.ts`
- Test: `packages/core/test/events.test.ts` (nowy), `game.test.ts`, `difficulty.test.ts`

**Interfaces:**
- Consumes: `Board`, `Rng`, `DynamicKind`, `LevelParams.dynamic/dynamicMax`.
- Produces (`events.ts`):
```ts
export interface ScheduledEvent {
  id: number; kind: DynamicKind; index: number;
  telegraphAtMs: number; applyAtMs: number; telegraphed: boolean;
}
export const TELEGRAPH_MS = 1500;
export function planEvents(board: Board, params: LevelParams, levelTimeMs: number, rng: Rng, nextId: () => number): ScheduledEvent[];
/** Zwraca nową planszę, albo null gdy zmiana jest niemożliwa/unieważniłaby planszę (→ Cancelled). */
export function applyEvent(board: Board, ev: ScheduledEvent, rng: Rng): Board | null;
```
- Produces (`game.ts`): `GameState.pending: ScheduledEvent[]`; `GameEvent` += `{type:'Telegraphed'; id:number; kind:DynamicKind; index:number}`, `{type:'Applied'; id:number; kind:DynamicKind; index:number; board:Board}`, `{type:'Cancelled'; id:number}`.
- Produces (`config.ts`): `LEVELS.dynamic = { chance: 0.5, secondEventLevel: 30, unlock: { mop: 14, leave: 20, arrive: 24 }, windows: { mop: [0.4,0.6], arrive: [0.35,0.65], leave: [0.4,0.7] }, arriveSmellyLevel: 24, arriveSmellyChance: 0.25 }`.

- [ ] **Step 1: Write failing tests.**
  - `levelParams`: `dynamic` puste dla `l < 14`; `[ 'mop' ]` dla 14..19; zawiera `mop`,`leave` od 20, i `arrive` od 24; `dynamicMax` = 1 do 29, 2 od 30.
  - `planEvents` (plansza z kilkoma wolnymi `clean`, `params` z `dynamic:['mop']`): ta sama plansza+seed → ten sam wynik; dla wielu seedów zdarza się zarówno pusta lista (~50%), jak i jedno zdarzenie; `ev.kind === 'mop'`, `board[ev.index]` jest wolny i `floor === 'clean'`; `applyAtMs` w `[0.4,0.6]·levelTimeMs` zaokrąglone do 100 ms i `≥ TELEGRAPH_MS`; `telegraphAtMs === applyAtMs − TELEGRAPH_MS`; `telegraphed === false`; długość listy ≤ `dynamicMax`; przy `dynamicMax 2` odstęp między zapowiedziami ≥ `TELEGRAPH_MS`; brak wolnego `clean` slotu → pusta lista.
  - `applyEvent(mop)` zmienia `floor` na `wet` tylko wskazanego slotu; zwraca `null`, gdy slot nie jest już wolny `clean` lub gdy wynik byłby niepoprawny (<2 wolne, koszty równe).
  - Maszyna stanów (`game.test.ts`, seed i poziom, przy którym `planEvents` daje `mop`; ewentualnie wstrzyknięcie przez `startGame` z poziomem ≥14 po `difficulty hard`): po `openDoor` `state.pending.length === 1`; `tick` do `telegraphAtMs` → dokładnie jedno `Telegraphed` (potem nie powtarza); `tick` do `applyAtMs` → `Applied`, `state.board[index].floor === 'wet'`, `pending` puste; tap wolnego slotu w oknie zapowiedzi jest oceniany względem planszy sprzed zmiany (**Review Focus 2**); wybór wolnego pisuaru, `skipLevel`, `endRun`, timeout, `nextLevel` czyszczą `pending` bez `Cancelled`; `pickUrinal` zajętego slotu (kara czasowa) przesuwa czas i może wywołać zdarzenia (przetworzone tym samym mechanizmem co w `tick`).
  - **Review Focus 1**: w pauzie `tick` nie uruchamia zapowiedzi ani wykonania; po `resume` dalej; `Telegraphed` nie powtarza się po wznowieniu.
- [ ] **Step 2:** `npm test -w @pisuar/core -- events game difficulty` → FAIL.
- [ ] **Step 3: Implement.** `planEvents`: z p = `LEVELS.dynamic.chance` na poziom wybiera jeden rodzaj spośród `params.dynamic` (przy `dynamicMax 2` możliwe dwa różne, drugie dalej o ≥`TELEGRAPH_MS`); w tym zadaniu aktywny rodzaj `mop`, pozostałe zwracają pustą listę do zad. 10. `game.ts`: `openDoor` planuje (po otwarciu drzwi, `elapsed = levelTimeMs − timeLeftMs`); wspólna funkcja `advanceEvents()` wołana po `tick` i po karze za zajęty (jeśli gra dalej trwa): dla każdego oczekującego w kolejności `applyAtMs` — `Telegraphed` gdy `elapsed ≥ telegraphAtMs && !telegraphed`; przy `elapsed ≥ applyAtMs` — `applyEvent`, `Applied` (z kopią planszy) albo `Cancelled`, usunięcie z `pending`.
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(core): scheduled telegraphed events and the cleaner`.

### Task 10: Spóźniony (`arrive`) i wychodzący (`leave`)

**Files:**
- Modify: `packages/core/src/events.ts`
- Test: `packages/core/test/events.test.ts`, `game.test.ts`

**Interfaces:**
- Consumes: `planEvents`/`applyEvent` z zad. 9.

- [ ] **Step 1: Write failing tests.**
  - `planEvents` z `dynamic:['arrive']`: `ev.index` to wolny slot (`occupant === null`), okno `[0.35, 0.65]`; z `['leave']`: `ev.index` to slot `plain` lub `smelly`, który nie należy do trójki pary i nie jest `outOfOrder`, okno `[0.4, 0.7]`; brak kandydata → pusta lista.
  - `applyEvent(arrive)`: wolny slot dostaje `plain` (przy poziomie < `arriveSmellyLevel` zawsze `plain`; test statystyczny dla poziomu ≥ 24 na 400 seedach: `smelly` w ~25% ±10 pp); `applyEvent(leave)`: slot staje się wolny z `floor: 'wet'`, a plansza nadal poprawna.
  - **Review Focus 5**: plansza z dokładnie dwoma wolnymi slotami, `arrive` na jednym z nich → `applyEvent` zwraca `null` → w grze `Cancelled`, plansza bez zmian; `leave` zostawia poprawną planszę, gdy wynik byłby z równymi kosztami → `null`.
  - Maszyna stanów: sekwencja `Telegraphed → Applied` dla `arrive`/`leave`; po `Applied(arrive)` tap w ten slot → `PickedOccupied`; po `Applied(leave)` slot jest wybieralny i oceniany z `wet` pod nim.
- [ ] **Step 2:** `npm test -w @pisuar/core -- events game` → FAIL.
- [ ] **Step 3: Implement** w `events.ts` (wybór kandydatów seedowanym RNG; po zmianie walidacja jak `isValid` z generatora — wyeksportować wspólną funkcję `isValidBoard(board, w)` z `generator.ts`).
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(core): late arrival and leaving characters`.

### Task 11: Zapowiedzi i modele dynamiczne w scenie

**Files:**
- Modify: `apps/game/scripts/generate-assets.mjs`, `src/assets.ts`, `assets/ASSETS.md`, `scene/GameScene.ts`, `scene/placeholders.ts`, `public/assets/*`
- Test: `apps/game/test/assets.test.ts`, `apps/game/test/eventView.test.ts` (nowy)

**Interfaces:**
- Consumes: `GameEvent` `Telegraphed/Applied/Cancelled`, `GameState.pending`, `paused`.
- Produces nowe klucze obrazów: `shadow` (znacznik zapowiedzi), `cleaner` (sprzątacz z wiadrem), `person_late` (dowolny wariant koloru; może współdzielić kształt z `person`); `eventView.ts`: `shadowFor(kind: DynamicKind): { glyph: string; tint: number }` (czysta).

- [ ] **Step 1: Write failing tests.** `assets.test.ts`: nowe klucze w manifeście/plikach/`ASSETS.md`/rozmiarach. `eventView.test.ts`: `shadowFor` zwraca różne `glyph`/`tint` dla `mop`, `arrive`, `leave`.
- [ ] **Step 2:** `npm test -w @pisuar/game -- assets eventView` → FAIL.
- [ ] **Step 3: Implement.** `Telegraphed` → pulsujący znacznik na slocie (`shadow` + glif z `shadowFor`); `Applied` → usunięcie znacznika, `buildBoard` ponownie, krótki błysk (dla `mop` mignięcie sprzątacza na slocie); `Cancelled` → znacznik znika; pauza i zasłonięta plansza ukrywają znaczniki, `syncFromState` odtwarza znaczniki z `state.pending` (`telegraphed === true`) po wznowieniu i po schowaniu/powrocie.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build -w @pisuar/game` PASS; podgląd Vite z wymuszonym poziomem ≥ 24 (np. trudność `hard` + `skip`): widać zapowiedź i zmianę dla każdego rodzaju (opisać w commicie, co faktycznie sprawdzone).
- [ ] **Step 5: Commit** `feat(game): telegraph markers and dynamic character models`.

### Task 12: Strojenie, dokumentacja, weryfikacja końcowa

**Files:**
- Modify: `packages/core/src/config.ts` (strojenie `LEVELS`, `OCCUPANTS`), `packages/core/scripts/stats.ts`, `docs/progress/balance-notes.md`, `docs/progress/RESUME.md`, `README`-owe opisy jeśli istnieją
- Test: `packages/core/test/balance.test.ts`

- [ ] **Step 1:** Rozszerzyć `balance.test.ts`: dodać asercje poziomów 1–60 (brak NaN, trudność niemalejąca z tolerancją 2%) i zachować dotychczasowe; dodać asercję, że na poziomach 10–40 `people ≥ wet + pee + 1` (więcej osób niż efektów). Uruchomić — jeśli czerwone, strojenie w kroku 2.
- [ ] **Step 2:** `npm run sim -w @pisuar/core`; skorygować wartości początkowe (tylko stałe w `config.ts`) tak, by: P(poz. 1) ≥ 0,4, P(poz. 30) ≤ 0,2, trudność niemalejąca, a odsetek plansz z ≥1 efektem pod lokatorem na poziomach 10–40 ≥ 30%. Nie osłabiać testów.
- [ ] **Step 3:** Zaktualizować `balance-notes.md` (nowa tabela z `sim`, zmienione stałe, uwaga: symulacja nie modeluje zdarzeń dynamicznych) i `RESUME.md` (zadania 1–12 gotowe, lista „NIE sprawdzone”: urządzenie/emulator — orientacja pozioma w APK, dotyk, płynność 60 fps, pauza przy `appStateChange`, Wstecz).
- [ ] **Step 4: Weryfikacja:** `npm test`, `npm run typecheck`, `npm run build:android -w @pisuar/game` — wszystkie PASS; podać liczby testów.
- [ ] **Step 5: Commit** `docs: balance notes and resume for mechanics v2`.

---

## Self-review (pokrycie spec)
- Rozdz. 2 cele → zad. 2 (więcej postaci), 5 (pauza), 4 (poziomo), 6–11 (postaci); anty-cele: zapowiedzi → zad. 9–11, poprawność planszy → zad. 2/6/7/10, brak darmowej analizy → plansza zasłonięta w zad. 5, regres balansu → zad. 12.
- Rozdz. 4 (model, koszt, kara, walidacja) → zad. 1, 2.
- Rozdz. 5.2–5.3 → zad. 6, 7; 5.4 → zad. 9, 10; modele (10a) → zad. 8, 11.
- Rozdz. 6 → zad. 2, 6, 7, 9 (progi odblokowań) i strojenie w zad. 12.
- Rozdz. 7 → zad. 3, 5; Wstecz → zad. 5; rozdz. 8 → zad. 4; rozdz. 9 (TDD/SDD, etapy) → struktura planu; rozdz. 11 → testy w zad. 3, 7, 9, 10.
- Zależności: zad. 3–5 (etap 2) nie zależą od 1–2 i mogą iść równolegle; 6–8 wymagają 1–2; 9–11 wymagają 3 (pauza) i 6–7 (para w `leave`), 12 na końcu.
