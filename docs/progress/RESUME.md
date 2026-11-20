# Pisuar Chooser – stan prac

## Zrobione
- Etap 1, Task 1: szkielet workspace (`@pisuar/core`, TS strict, Vitest, test dymny).
- Etap 2 (rdzeń `packages/core`) gotowy i zrecenzowany:
  - Task 2: typy planszy, funkcja kosztu z przykładami akceptacyjnymi.
  - Task 3: seedowany RNG, parametry poziomów, generator plansz, poziomy startowe trudności.
  - Task 4: punktacja, kary czasowe, ceny perków.
  - Task 5: maszyna stanów gry (`createGame({seed,balance,records})`, fazy START/DOOR_CLOSED/PLAYING/LEVEL_RESULT/SUMMARY, perki, rekord per trudność, timer 100 ms).
- Task 6: symulacja (`npm run sim -w @pisuar/core`) i strojenie `LEVELS`; wnioski w `docs/progress/balance-notes.md`.
- Task 7: szkielet `apps/game` (Phaser 3, Vite, 1080x1920 FIT), `storage.ts` (odporny zapis/odczyt), `ports.ts` (`noopPlatform`); `npm run build -w @pisuar/game` działa.
- Task 8: scena gry (`apps/game/src/scene/`): drzwi z ręką → animacja otwarcia (250 ms, liczy się już do czasu poziomu — świadomie), plansza z `urinalRects` (3..18 pisuarów), licznik 0,1 s, HUD (`poziom | punkty`, „Pomiń poziom (cena)” wyszarzony bez środków), zdarzenia (Dobrze!/Źle!/kara czasowa z potrząśnięciem), wynik ~1 s → `nextLevel`. Czyste, testowane `layout.ts` (`urinalRects`, `hitIndex`, `contains`) i `format.ts`. `GAME_WIDTH/HEIGHT` w `constants.ts`. Tymczasowo: stała trudność `easy`, po przegranej napis „Koniec — tap” → nowa gra; schowanie aplikacji (`visibilitychange`) = nowy przebieg (saldo zostaje w pamięci, bez zapisu).
  - Sprawdzone w przeglądarce (podgląd Vite): drzwi, otwarcie, plansza, kara za zajęty, dobry/zły wybór, następny poziom, pomiń, przegrana i restart, reset po `visibilitychange` (symulowany), plansza 18 pisuarów. Panel przeglądarki był ukryty (rAF ~2 fps), więc większość przejść sterowana ręcznie `game.step()`; płynność animacji w 60 fps i dotyk na telefonie NIE były sprawdzone.
- Stan: 96 testów przechodzi (core 61, game 35), `npm run typecheck` czysty, `npm run build -w @pisuar/game` działa. Gałąź `feat/pisuar-chooser` (zob. `git log`).

## Następny krok
- Task 9 (ekran startowy z wyborem trudności, okno podsumowania z Kontynuuj/OK, zapis salda i rekordów, podpięcie `PlatformServices`), potem Task 10–11 wg `docs/superpowers/plans/2026-11-20-pisuar-chooser-stages-1-6.md`. Etap 7 (leaderboard + zakupy) to osobny, jeszcze nienapisany plan.

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
- UI: w fazie START pola stanu poza `balance` i `record` są nieaktualne; `game.state` zwraca świeżą kopię przy każdym odczycie.
- UI (Task 8): przy 18 pisuarach są wąskie (~43 px z 1080) — strefa tapnięcia obejmuje odstępy i ±220 px w pionie; docelowa grafika może chcieć wyższych pisuarów. `PickedWorse.lost` pokazuje karę nominalną, nawet gdy saldo było 0.

## Otwarte decyzje
- Brak. Identyfikator aplikacji `com.pisuar.chooser` do potwierdzenia przed Task 11.
