# Pisuar Chooser – stan prac

## Zrobione
- Etap 1, Task 1: szkielet workspace (`@pisuar/core`, TS strict, Vitest, test dymny).
- Etap 2 (rdzeń `packages/core`) gotowy i zrecenzowany:
  - Task 2: typy planszy, funkcja kosztu z przykładami akceptacyjnymi.
  - Task 3: seedowany RNG, parametry poziomów, generator plansz, poziomy startowe trudności.
  - Task 4: punktacja, kary czasowe, ceny perków.
  - Task 5: maszyna stanów gry (`createGame({seed,balance,records})`, fazy START/DOOR_CLOSED/PLAYING/LEVEL_RESULT/SUMMARY, perki, rekord per trudność, timer 100 ms).
- Task 6: symulacja (`npm run sim -w @pisuar/core`) i strojenie `LEVELS`; wnioski w `docs/progress/balance-notes.md`.
- Stan: 60 testów przechodzi, `npm run typecheck` czysty. Gałąź `feat/pisuar-chooser`, HEAD = ostatni commit Task 6 (zob. `git log`).

## Następny krok
- Task 7, potem Task 8–11 wg `docs/superpowers/plans/2026-11-20-pisuar-chooser-stages-1-6.md`. Etap 7 (leaderboard + zakupy) to osobny, jeszcze nienapisany plan.

## Jak wznowić
- Plan i specyfikacja: `docs/superpowers/plans/…stages-1-6.md`, `docs/superpowers/specs/…-design.md`.
- Metoda: superpowers:subagent-driven-development (osobny implementer + recenzent na zadanie). Dziennik postępu (git-ignored, lokalny): `.superpowers/sdd/2026-11-20-pisuar-chooser-stages-1-6/progress.md` (zawiera rozstrzygnięcia i listę drobnych uwag odroczonych). Gdyby go zabrakło, odtwórz stan z `git log` (zadania 1–5 gotowe).
- Rozstrzygnięcia obowiązujące dalej: `createGame` przyjmuje `records` per trudność; `NewRecord` emitowany od razu przy podniesieniu rekordu; Capacitor przypiąć do 6.x (JDK 17); stopka commitów `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Jak uruchomić
1. `npm install`
2. `npm test`
3. `npm run typecheck`

## Odroczone uwagi (drobne, do przeglądu w końcowym review)
- Testy: `fallbackBoard` bezpośrednio; wzrost przeszkód w `levelParams`; `levelParams(NaN)`; brzegi RNG; `bestIndices` (pusta/1-slot/własne wagi); reset timera po skip z PLAYING; kopiowanie `records`.
- UI (Task 8): w fazie START pola stanu poza `balance` i `record` są nieaktualne; `game.state` zwraca świeżą kopię przy każdym odczycie.

## Otwarte decyzje
- Brak. Identyfikator aplikacji `com.pisuar.chooser` do potwierdzenia przed Task 11.
