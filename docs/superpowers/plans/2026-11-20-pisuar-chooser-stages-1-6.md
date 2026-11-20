# Pisuar Chooser — plan implementacji (etapy 1–6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działająca offline gra "Pisuar Chooser" na Androida: czysty rdzeń TypeScript + prezentacja Phaser 3 w Capacitorze, z grafikami zastępczymi i listą assetów.

**Architecture:** `packages/core` to deterministyczna maszyna stanów (komendy w, zdarzenia i stan out; czas przez `tick`, losowość przez ziarno), bez zależności. `apps/game` (Vite + Phaser 3) tylko rysuje i wysyła komendy; zapis i usługi platformy za interfejsami (`Storage`, `PlatformServices`). Capacitor pakuje całość na Androida.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Vite, Phaser 3, Capacitor (Android).

**Spec:** `docs/superpowers/specs/2026-11-20-pisuar-chooser-design.md`. Etap 7 (leaderboard + zakupy) to **osobny plan** po zakończeniu tego (wymaga konta Play Console i decyzji o cenach).

## Global Constraints

- Rdzeń: zero zależności runtime, zero dostępu do DOM, `Date`, `Math.random`; czas tylko przez `tick(dtMs)`, losowość tylko przez `Rng` z ziarnem.
- Timer i kary czasowe w rozdzielczości 0,1 s (100 ms); kara = `floor(0.10 × pełny czas poziomu)` (zajęty) lub `0.20 ×` (śmierdzący), zaokrąglona w dół do pełnych 100 ms.
- Wybór dowolnego wolnego pisuara kończy poziom; wybór zajętego tylko odejmuje czas i poziom trwa.
- Dwa liczniki: `playerLevel` (rozwiązane wyborem; start 0, wyświetlany = +1) i `difficultyLevel` (+1 przy każdej nowej planszy). Start trudności: Łatwy 1, Średni 8, Trudny 15.
- Rekord = najwyższy `playerLevel` rozwiązany w jednym przebiegu, per poziom startowy; skip i continue go nie podnoszą; punkty nie trafiają do rankingu.
- Perki: cena = `base × 2^uses`, osobny licznik na perk, zerowany przy nowej grze. Saldo ≥ 0, przetrwa restart; przegrana nie zabiera salda.
- Generator: zawsze ≥ 2 wolne pisuary o różnym koszcie (min. rozmiar rzędu 3).
- Brak pauzy; po wyjściu z aplikacji przebieg jest porzucany (świeża gra).
- Android only w tym planie; minSdk wg domyślnej wersji Capacitora.
- Dźwięki: tylko pliki-placeholdery. Grafiki: proste wygenerowane + `assets/ASSETS.md`.
- Po każdym etapie aktualizacja `docs/progress/RESUME.md`.

## Review Focus

1. Duży skok `dt` (powrót z tła, lag) w `tick`: rdzeń przyjmuje dowolny `dtMs ≥ 0` bez błędu; prezentacja przy zdarzeniu pauzy aplikacji porzuca przebieg zamiast przekazywać wielki `dt`.
2. Komendy w złej fazie lub z indeksem spoza zakresu (`pickUrinal(-1)`, `pickUrinal(99)`, podwójny tap) są ignorowane bez zmiany stanu i bez wyjątku.
3. `buyPerk` przy zbyt małym saldzie: odrzucone zdarzeniem `PerkRejected`, saldo i liczniki bez zmian.
4. Kara czasowa ≥ pozostały czas: czas = 0, `TimedOut`, a nie liczba ujemna.
5. Uszkodzony lub pusty zapis (`Storage` zwraca `null`/śmieci): saldo 0, rekord 0, aplikacja startuje.

---

### Task 1: Szkielet workspace (etap 1)

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/test/smoke.test.ts`, `.gitignore`, `docs/progress/RESUME.md`

**Interfaces:**
- Produces: workspace `@pisuar/core` (nazwa pakietu), komenda `npm test -w @pisuar/core`.

- [ ] **Step 1: Napisz test dymny** `packages/core/test/smoke.test.ts`: `import { VERSION } from '../src'; it('exports VERSION', () => expect(VERSION).toBe('0.1.0'))`.
- [ ] **Step 2: Uruchom** `npm test -w @pisuar/core` → FAIL (brak pakietu/eksportu).
- [ ] **Step 3: Skonfiguruj** npm workspaces (`packages/*`, `apps/*`), TS strict (ES2022, moduleResolution bundler), Vitest; `export const VERSION = '0.1.0'` w `src/index.ts`. `.gitignore`: `node_modules`, `dist`, `android/app/build`.
- [ ] **Step 4: Uruchom** `npm test -w @pisuar/core` → PASS.
- [ ] **Step 5: Utwórz `docs/progress/RESUME.md`** z sekcjami: Zrobione / Następny krok / Jak uruchomić / Otwarte decyzje.
- [ ] **Step 6: Commit** `chore: workspace scaffold with core package`.

### Task 2: Typy i funkcja kosztu (etap 2)

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/config.ts`, `packages/core/src/cost.ts`, `packages/core/test/helpers.ts`, `packages/core/test/cost.test.ts`
- Modify: `packages/core/src/index.ts` (re-eksport)

**Interfaces:**
- Produces:
  - `type Floor = 'clean' | 'wet' | 'pee'`
  - `type Slot = { kind: 'free'; floor: Floor } | { kind: 'person'; smelly: boolean }`; `type Board = Slot[]`
  - `interface CostWeights { floor: Record<Floor, number>; smellyMultiplier: number; decayBase: number }`; domyślne w `config.ts`: `DEFAULT_WEIGHTS = { floor: { clean: 0, wet: 1, pee: 3 }, smellyMultiplier: 3, decayBase: 0.5 }`; wpływ człowieka w odległości d = `decayBase^(d-1)`, razy `smellyMultiplier` dla śmierdzącego.
  - `urinalCost(board: Board, index: number, w?: CostWeights): number` (dla zajętego `Infinity`)
  - `bestIndices(board: Board, w?: CostWeights): number[]` (indeksy rosnąco, porównanie z tolerancją 1e-9)
  - `test/helpers.ts`: `parseBoard(s: string): Board` — tokeny rozdzielone spacjami: `X` człowiek, `Z` śmierdzący, `_` czysty, `M` mokry, `S` osikany.

- [ ] **Step 1: Napisz testy akceptacyjne** (`cost.test.ts`), każdy jako osobny `it`: `bestIndices(parseBoard('X _ _ _ _'))` = `[4]`; `'X _ _ _ X'` = `[2]`; `'_ X _ X _'` = `[0, 4]`; dla `'X M X Z _'` `urinalCost(b,4) < urinalCost(b,1)`; dla `'X _ X X _ X X'` `urinalCost(b,1) < urinalCost(b,4)`; `urinalCost` zajętego = `Infinity`; mokry czysty-obok-nikogo > czysty obok nikogo.
- [ ] **Step 2: Uruchom** → FAIL (brak modułów).
- [ ] **Step 3: Zaimplementuj** typy, `DEFAULT_WEIGHTS`, `urinalCost`, `bestIndices` jak w Interfaces. Wagi strojone wyłącznie tak, by testy z Step 1 przechodziły (nie zmieniaj testów).
- [ ] **Step 4: Uruchom** `npm test -w @pisuar/core` → PASS.
- [ ] **Step 5: Commit** `feat(core): cost function with acceptance examples`.

### Task 3: RNG, parametry trudności, generator

**Files:**
- Create: `packages/core/src/rng.ts`, `packages/core/src/difficulty.ts`, `packages/core/src/generator.ts`, `packages/core/test/difficulty.test.ts`, `packages/core/test/generator.test.ts`

**Interfaces:**
- Consumes: `Board`, `CostWeights`, `urinalCost`.
- Produces:
  - `interface Rng { next(): number /* [0,1) */; int(min: number, maxInclusive: number): number }`; `createRng(seed: number): Rng` (mulberry32).
  - `type Difficulty = 'easy' | 'medium' | 'hard'`; `startDifficultyLevel(d: Difficulty): number` → 1 / 8 / 15.
  - `interface LevelParams { urinals: number; persons: number; smellyPersons: number; wet: number; pee: number; timeMs: number }`
  - `levelParams(difficultyLevel: number): LevelParams`: liniowo; start (poziom 1): 4 pisuary, 1 człowiek, 0 reszty, `timeMs` 15000; `timeMs = max(3000, 15000 − 400×(level−1))` zaokrąglone do 100; limity: 12 pisuarów, `persons ≤ urinals − 2`; reszta parametrów rośnie co kilka poziomów (konkretne tempo do strojenia w Task 6). Wartości stałe w `config.ts`.
  - `generateBoard(params: LevelParams, rng: Rng, w?: CostWeights): Board` — rozmieszcza przeszkody losowo i **powtarza losowanie**, aż spełnione: ≥ 2 wolne pisuary o różnym koszcie.

- [ ] **Step 1: Testy** — `createRng(1)` daje tę samą sekwencję dwa razy, a różne ziarna różne; `levelParams(1).timeMs === 15000`; `levelParams(1000).timeMs === 3000`; `levelParams(1000).urinals <= 12`; `levelParams` monotoniczne: `timeMs` nie rośnie, `urinals` nie maleje dla poziomów 1..200; `startDifficultyLevel('hard') === 15`; właściwość: dla poziomów 1..300 i 50 ziaren generowana plansza ma `urinals` slotów, ≥ 2 wolne o różnym koszcie, i liczbę ludzi równą `params.persons`.
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Zaimplementuj** jak w Interfaces; generator z limitem prób (np. 100) i deterministycznym fallbackiem składającym poprawną planszę, gdy limit przekroczony.
- [ ] **Step 4: Uruchom** → PASS.
- [ ] **Step 5: Commit** `feat(core): rng, level params and board generator`.

### Task 4: Punkty, kary czasowe, ceny perków

**Files:**
- Create: `packages/core/src/scoring.ts`, `packages/core/src/perks.ts`, `packages/core/test/scoring.test.ts`, `packages/core/test/perks.test.ts`
- Modify: `packages/core/src/config.ts` (dodaj `SCORING`)

**Interfaces:**
- Consumes: `Board`, `urinalCost`, `bestIndices`.
- Produces:
  - `SCORING = { rewardBest: 10, penaltyPerCost: 3, maxPenalty: 15, occupiedPct: 0.10, smellyPct: 0.20 }`, `PERK_BASE = { skip: 10, continue: 15 }`.
  - `type PickKind = 'best' | 'worse' | 'occupied'`
  - `evaluatePick(board: Board, index: number, w?: CostWeights): { kind: PickKind; delta: number; best: number[] }` — `best`: `+rewardBest`; `worse`: `−min(maxPenalty, round(penaltyPerCost × (koszt − koszt najlepszego)))`, min. −1; `occupied`: `delta` 0.
  - `timePenaltyMs(fullTimeMs: number, smelly: boolean): number` — `floor(fullTimeMs × pct / 100) × 100`.
  - `type PerkType = 'skip' | 'continue'`; `perkPrice(type: PerkType, uses: number): number` = `PERK_BASE[type] × 2^uses`.

- [ ] **Step 1: Testy** — `evaluatePick` na `'X _ _ _ _'`: indeks 4 → `best`, `+10`; indeks 1 → `worse`, `delta < 0`; indeks 0 → `occupied`, `delta 0`; `'X _ X _ X'`: obie wolne `_` to `best` (remis, `delta +10`); `timePenaltyMs(15000, false) === 1500`; `timePenaltyMs(9400, false) === 900` (floor do 100 ms); `timePenaltyMs(15000, true) === 3000`; `perkPrice('skip', 0..3)` = 10, 20, 40, 80; kara `worse` nigdy poniżej `−maxPenalty`.
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Zaimplementuj** jak w Interfaces.
- [ ] **Step 4: Uruchom** → PASS.
- [ ] **Step 5: Commit** `feat(core): scoring, time penalties, perk prices`.

### Task 5: Maszyna stanów gry

**Files:**
- Create: `packages/core/src/game.ts`, `packages/core/test/game.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: wszystko z Task 2–4.
- Produces:
  - `type Phase = 'START' | 'DOOR_CLOSED' | 'PLAYING' | 'LEVEL_RESULT' | 'SUMMARY'`
  - `type Command = { type: 'startGame'; difficulty: Difficulty } | { type: 'openDoor' } | { type: 'pickUrinal'; index: number } | { type: 'tick'; dtMs: number } | { type: 'skipLevel' } | { type: 'nextLevel' } | { type: 'buyPerk'; perk: PerkType } | { type: 'acknowledgeSummary' }`
  - `type GameEvent` (unia z `type`): `DoorOpening`, `LevelStarted{board,timeMs}`, `PickedBest{best}`, `PickedWorse{best,lost}`, `PickedOccupied{index,penaltyMs}`, `TimedOut`, `PerkBought{perk,price}`, `PerkRejected{perk}`, `NewRecord{difficulty,level}`.
  - `interface GameState { phase: Phase; difficulty: Difficulty; playerLevel: number; difficultyLevel: number; balance: number; board: Board; timeLeftMs: number; levelTimeMs: number; perkUses: Record<PerkType, number>; record: number }`
  - `interface Game { readonly state: Readonly<GameState>; dispatch(cmd: Command): GameEvent[] }`
  - `createGame(opts: { seed: number; balance: number; record: number }): Game` — `balance`/`record` wstrzykiwane (zapis poza rdzeniem), `state.balance` aktualizowane po każdej zmianie.
  - Przejścia wg spec 5.7: `startGame` (START) → DOOR_CLOSED z planszą trudności startowej; `openDoor` → PLAYING (od tej chwili `tick` odlicza); `pickUrinal` wolny → `playerLevel+1`, `difficultyLevel+1`, `balance = max(0, balance+delta)`, LEVEL_RESULT; `pickUrinal` zajęty → odejmuje `timePenaltyMs` (clamp 0 → TimedOut); `nextLevel` (LEVEL_RESULT) → DOOR_CLOSED z nową planszą; `skipLevel` (PLAYING lub DOOR_CLOSED, koszt `perkPrice('skip', uses)`, `uses++`, `difficultyLevel+1`, `playerLevel` bez zmian) → DOOR_CLOSED z nową planszą; `tick` do 0 → SUMMARY + `TimedOut`; `buyPerk('continue')` (SUMMARY) → DOOR_CLOSED, nowa plansza trudności +1; `acknowledgeSummary` → START i `NewRecord` (jeśli `playerLevel > record`, w tym samym `startGame`-difficulty), przy czym rekord liczony per `difficulty`.
  - Wszystko inne (zła faza, indeks poza zakresem) → `[]` bez zmiany stanu.

- [ ] **Step 1: Testy** (każdy jako osobny `it`): pełny przebieg łatwy (start → open → wybór najlepszego → LEVEL_RESULT, `playerLevel 1`, `balance +10`); wybór gorszego zmniejsza saldo, ale nie poniżej 0; zajęty odejmuje czas, poziom trwa; kara ≥ czasu → `TimedOut` i faza SUMMARY, `timeLeftMs` = 0; `tick` w DOOR_CLOSED nie odlicza; skip: `playerLevel` bez zmian, `difficultyLevel+1`, cena 10 potem 20; continue: cena 15, 30, `playerLevel` bez zmian, trudność +1, saldo nie rośnie po przegranej; `buyPerk` ze zbyt małym saldem → `PerkRejected`; `perkUses` zerowane przez nową grę; rekord: przegrana na poziomie 10 (9 rozwiązanych) → `NewRecord` z 9, a skip/continue go nie podnoszą; komendy w złej fazie i `pickUrinal(-1)`/`(99)` zwracają `[]` i nie zmieniają stanu; ten sam `seed` → ta sama sekwencja plansz; `tick` z `dtMs = 1e9` kończy się `TimedOut` bez wyjątku; `startGame('hard')` zaczyna od `difficultyLevel 15`.
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Zaimplementuj** `createGame` jak w Interfaces; stan trzymaj w jednym obiekcie, zdarzenia zwracaj z `dispatch`.
- [ ] **Step 4: Uruchom** `npm test -w @pisuar/core` → PASS.
- [ ] **Step 5: Zaktualizuj `RESUME.md`** (etap 2 gotowy) i commit `feat(core): game state machine`.

### Task 6: Symulacja i balans (etap 3)

**Files:**
- Create: `packages/core/scripts/simulate.ts`, `docs/progress/balance-notes.md`
- Modify: `packages/core/src/config.ts` (stroić wartości), `packages/core/package.json` (skrypt `sim`)

**Interfaces:**
- Consumes: `createGame`, `levelParams`, `evaluatePick`, `bestIndices`.
- Produces: `npm run sim -w @pisuar/core` drukuje tabelę per poziom trudności: czas, liczba pisuarów, % szansy trafienia najlepszego przy losowym wyborze wolnego, oczekiwany przyrost salda na poziom.

- [ ] **Step 1: Napisz skrypt** — dla poziomów 1..40 i 200 ziaren liczy statystyki powyżej na bazie generatora i `evaluatePick` (bez Game).
- [ ] **Step 2: Uruchom** i sprawdź, że trudność rośnie monotonicznie, a przy poziomie 1 losowy wybór trafia najlepszy z prawdopodobieństwem ≥ 40%, przy 30 ≤ 20%.
- [ ] **Step 3: Dostrój** parametry w `config.ts` (tempo przeszkód, `PERK_BASE`, nagrody) tak, by pierwszy "Pomiń" kosztował mniej więcej jeden dobrze rozegrany poziom (spec 5.4); zapisz wnioski w `balance-notes.md`. Testy z Task 2–5 mają nadal przechodzić (`npm test`).
- [ ] **Step 4: Commit** `feat(core): balance simulation and tuned config`.

### Task 7: Aplikacja Phaser — szkielet i porty (etap 4a)

**Files:**
- Create: `apps/game/package.json`, `apps/game/vite.config.ts`, `apps/game/index.html`, `apps/game/src/main.ts`, `apps/game/src/ports.ts`, `apps/game/src/storage.ts`, `apps/game/test/storage.test.ts`

**Interfaces:**
- Consumes: `@pisuar/core` (`createGame`, `Game`, `Difficulty`).
- Produces:
  - `interface Storage { load(): Promise<Saved>; save(s: Saved): Promise<void> }`, `interface Saved { balance: number; records: Record<Difficulty, number> }`
  - `createStorage(backend: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> }): Storage` — odporny na `null`/uszkodzony JSON/ujemne wartości (zwraca `{ balance: 0, records: {easy:0, medium:0, hard:0} }`).
  - `interface PlatformServices { submitHighestLevel(d: Difficulty, level: number): Promise<void> }` z atrapą `noopPlatform`.
  - Phaser 3 gra 1080×1920 (portret), skalowanie `Phaser.Scale.FIT`, `main.ts` uruchamia scenę `GameScene` (pusta, tło).

- [ ] **Step 1: Testy** `storage.test.ts`: zapis i odczyt round-trip; `null` → domyślne; `'{broken'` → domyślne; `balance: -5` w JSON → 0.
- [ ] **Step 2: Uruchom** `npm test -w apps/game` → FAIL.
- [ ] **Step 3: Zaimplementuj** `createStorage` i resztę jak w Interfaces; backend dev = `localStorage`, produkcyjny = `@capacitor/preferences` (podmiana w Task 11).
- [ ] **Step 4: Uruchom** testy → PASS; `npm run dev -w apps/game` pokazuje pustą scenę (sprawdź ręcznie w przeglądarce).
- [ ] **Step 5: Commit** `feat(game): phaser shell, storage and platform ports`.

### Task 8: Scena gry — drzwi, plansza, HUD (etap 4b)

**Files:**
- Create: `apps/game/src/scene/GameScene.ts`, `apps/game/src/scene/layout.ts`, `apps/game/src/scene/placeholders.ts`, `apps/game/test/layout.test.ts`

**Interfaces:**
- Consumes: `Game`, `GameEvent`, `Board`, `GameState`.
- Produces:
  - `urinalRects(count: number, width: number, height: number): Rect[]` (czysta funkcja układu, równe odstępy, mieszczą się w ekranie dla count 3..12) z `interface Rect { x: number; y: number; w: number; h: number }`.
  - `GameScene` renderuje wg `game.state.phase`: DOOR_CLOSED — drzwi z ręką, tap → `openDoor`; PLAYING — plansza + licznik czasu (0,1 s) + HUD (prawy górny: `poziom | punkty`, lewy górny: przycisk "Pomiń poziom" z aktualną ceną); tap w pisuar → `pickUrinal(i)`; zdarzenia (`PickedBest`, `PickedWorse`, `PickedOccupied`) → animacje/napisy; `LEVEL_RESULT` → pokazanie poprawnych pisuarów, po chwili `nextLevel`.
  - `tick`: `game.dispatch({type:'tick', dtMs: min(delta, 100)})` z Phaser `update`. (Wielkie dt nie jest przekazywane; zob. Review Focus 1.)
  - Zdarzenie `pause` aplikacji (`document.visibilitychange` ukryte lub Capacitor `appStateChange` nieaktywne) → nowy `createGame` i powrót do START.
  - Grafiki zastępcze: kolorowe prostokąty/kształty z konturem generowane programowo w `placeholders.ts` (kolory z jednej palety zdefiniowanej tam).

- [ ] **Step 1: Test** `layout.test.ts`: dla count 3..12 wszystkie prostokąty mieszczą się w `[0,width]×[0,height]`, nie nakładają się, są posortowane od lewej i ich liczba = count.
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Zaimplementuj** `urinalRects` i `GameScene` jak w Interfaces.
- [ ] **Step 4: Uruchom** testy → PASS; ręcznie w przeglądarce (`npm run dev -w apps/game`) przejdź: tap drzwi → plansza → wybór → kolejny poziom; kliknięcie zajętego pisuara zmniejsza czas.
- [ ] **Step 5: Commit** `feat(game): game scene with door, board and HUD`.

### Task 9: Start, podsumowanie, perki, zapis (etap 4c)

**Files:**
- Create: `apps/game/src/scene/StartScene.ts`, `apps/game/src/scene/SummaryOverlay.ts`, `apps/game/src/session.ts`, `apps/game/test/session.test.ts`
- Modify: `apps/game/src/scene/GameScene.ts`, `apps/game/src/main.ts`

**Interfaces:**
- Consumes: `Storage`, `PlatformServices`, `createGame`, `GameEvent`.
- Produces:
  - `createSession(deps: { storage: Storage; platform: PlatformServices; seed: () => number }): Session`
  - `interface Session { init(): Promise<void>; newGame(d: Difficulty): Game; onEvents(d: Difficulty, state: GameState, events: GameEvent[]): Promise<void> }` — `init` ładuje zapis; `newGame` tworzy `createGame` z wczytanym saldem i rekordem; `onEvents` zapisuje saldo po każdej zmianie, na `NewRecord` zapisuje rekord i woła `platform.submitHighestLevel`.
  - `StartScene`: wybór trudności (3 przyciski Łatwy/Średni/Trudny) i wyświetlenie rekordu per trudność; potem przejście do `GameScene`.
  - `SummaryOverlay`: po `TimedOut` animacja zsikania się, okno z liczbą rozwiązanych poziomów, przyciskiem "Kontynuuj" (cena aktualna, nieaktywny przy zbyt małym saldzie) i "OK".

- [ ] **Step 1: Testy** `session.test.ts` (z fałszywym `Storage`/`PlatformServices`): `init` wczytuje saldo i rekord do `newGame`; po `NewRecord` zapisany i wysłany jest poziom, a przy równym lub niższym nie; saldo zapisywane po zdarzeniu `PickedBest`; błąd `submitHighestLevel` (reject) nie przerywa gry i nie gubi lokalnego zapisu.
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Zaimplementuj** `Session`, `StartScene`, `SummaryOverlay` i podłącz do `main.ts`.
- [ ] **Step 4: Uruchom** testy → PASS; ręcznie: pełny przebieg do przegranej, "Kontynuuj" (cena rośnie), "OK" wraca do StartScene, rekord widoczny po restarcie strony.
- [ ] **Step 5: Zaktualizuj `RESUME.md`** (etap 4 gotowy) i commit `feat(game): start screen, summary, perks and persistence`.

### Task 10: Assety i dźwięki (etap 5)

**Files:**
- Create: `assets/ASSETS.md`, `apps/game/public/assets/**` (wygenerowane grafiki PNG/SVG), `apps/game/public/audio/*.wav` (placeholdery), `apps/game/src/assets.ts`, `apps/game/test/assets.test.ts`
- Modify: `apps/game/src/scene/*.ts` (używanie `assets.ts` zamiast kształtów, tam gdzie grafika już istnieje)

**Interfaces:**
- Produces: `ASSET_MANIFEST: { images: Record<string, string>; sounds: Record<string, string> }` — jedyne źródło ścieżek; scena ładuje wyłącznie przez nie.
  - Obrazy (klucze): `door`, `hand`, `urinal`, `floor_wet`, `floor_pee`, `person`, `person_smelly`, `bg_wall`, `bg_floor`, `hero`, `hero_wet`. Dźwięki: `door_open`, `pick_good`, `pick_bad`, `pick_occupied`, `timeout`, `perk`, `tick`.

- [ ] **Step 1: Test** `assets.test.ts`: każdy plik z `ASSET_MANIFEST` istnieje na dysku, a każdy wpis jest opisany w `assets/ASSETS.md` (test czyta plik i szuka klucza).
- [ ] **Step 2: Uruchom** → FAIL.
- [ ] **Step 3: Wygeneruj** proste grafiki (SVG z konturami, jedna paleta) i pliki WAV z ciszą 0,2 s jako placeholdery; w `ASSETS.md` opisz każdy asset (klucz, plik, rozmiar, co przedstawia, uwagi do kontur/paleta/głębia) tak, by dało się je podmienić.
- [ ] **Step 4: Uruchom** testy → PASS; ręcznie sprawdź, że scena używa grafik zamiast prostokątów.
- [ ] **Step 5: Zaktualizuj `RESUME.md`** i commit `feat(game): placeholder art, audio and ASSETS.md`.

### Task 11: Capacitor Android (etap 6)

**Files:**
- Create: `apps/game/capacitor.config.ts`, `apps/game/android/**` (generowane), `docs/progress/android-build.md`
- Modify: `apps/game/package.json`, `apps/game/src/storage.ts` (backend produkcyjny)

**Interfaces:**
- Consumes: `createStorage`.
- Produces: skrypty `npm run build:android -w apps/game` (vite build + `cap sync android`) i `npm run apk -w apps/game` (Gradle `assembleDebug`); `appId` `com.pisuar.chooser` (**do potwierdzenia**: zmiana później wymaga nowej aplikacji w Play), orientacja portret, pełny ekran, `capacitorBackend` oparty na `@capacitor/preferences`.

- [ ] **Step 1: Dodaj** zależności Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/preferences`, `@capacitor/app`) i `cap add android`.
- [ ] **Step 2: Podmień backend** w `main.ts` na Preferences, gdy `Capacitor.isNativePlatform()`, w przeciwnym razie `localStorage`; podłącz `App.addListener('appStateChange')` do porzucenia przebiegu (Task 8).
- [ ] **Step 3: Uruchom** `npm test` (workspaces) → PASS i `npm run build:android -w apps/game` → bez błędów.
- [ ] **Step 4: Zbuduj debug APK** (`npm run apk -w apps/game`) i uruchom na emulatorze/urządzeniu: tap drzwi → plansza → wybór; zamknięcie i ponowne otwarcie = świeża gra, rekord i saldo zachowane; zapisz kroki i wersje narzędzi w `android-build.md`.
- [ ] **Step 5: Zaktualizuj `RESUME.md`** (etapy 1–6 gotowe, następny: plan etapu 7) i commit `feat(game): capacitor android build`.

---

## Self-review (wykonane)

- **Pokrycie spec:** koszt i przykłady (T2), generator z gwarancją 2 opcji (T3), czas/kary/ceny perków (T4), dwa liczniki/skip/continue/rekord/saldo (T5), balans (T6), UI i zachowania (T8–9), assety i ASSETS.md (T10), Android (T11), pliki wznowienia (T1, 5, 9, 10, 11). Leaderboard/zakupy: świadomie osobny plan (etap 7), porty gotowe w T7.
- **Spójność typów:** `Difficulty`, `PerkType`, `Board`, `GameEvent`, `Session` używane identycznie w T3–T9.
- **Uwaga do spec:** spec 5.2 mówi "dalej 0" dla odległości > 2; plan używa wygaszania geometrycznego (`0.5^(d-1)`), bo tylko ono spełnia przykład `X _ _ _ _` → pisuar 5. To doprecyzowanie wag, nie zmiana zasad.
