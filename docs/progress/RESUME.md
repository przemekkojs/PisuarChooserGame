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
- Task 9 (etap 4 gotowy): `session.ts` (bez Phasera, testowany: wczytanie salda i rekordów, zapis salda po PickedBest/PickedWorse/PerkBought, rekord tylko gdy wyższy → zapis + `submitHighestLevel`, odrzucenie submit nie psuje gry, zapisy w kolejce bez wyścigów), `StartScene` (tytuł, punkty, Łatwy/Średni/Trudny z „Rekord: N”), `SummaryOverlay` („Zsikałeś się!” z animacją plamy, rozwiązane poziomy, rekord, „Kontynuuj (cena)” wyszarzony bez środków, „OK” → ekran startowy; blokada tapnięć 600 ms), czyste `perkInfo.ts` (`skipInfo`, `continueInfo`) z testami. Start aplikacji i schowanie aplikacji (`visibilitychange`) zawsze → ekran startowy; saldo i rekordy z sesji. Drobne poprawki z przeglądu Task 8 (kolor przycisku Pomiń cache'owany, jeden odczyt `run.state` na klatkę, `say()` kasuje poprzedni tween).
  - Sprawdzone w przeglądarce (podgląd Vite, panel ukryty → klatki sterowane ręcznie tymczasowym hakiem, nie zacommitowanym): start → Łatwy, kilka poziomów, przegrana, okno podsumowania (zrzut ekranu), blokada tapnięcia, Kontynuuj (cena 15 → 30), wyszarzony Kontynuuj bez dispatchu, OK (prawdziwe kliknięcie) → start z „Rekord: 4”, rekord i saldo po przeładowaniu strony, Średni/Trudny startują od poziomu 8/15, symulowany `visibilitychange` → start z aktualnym saldem. NIE sprawdzone: płynność animacji w 60 fps, dotyk na telefonie.
- Task 10 (etap 5 gotowy): placeholderowe SVG (`apps/game/public/assets/`, generowane deterministycznie przez `apps/game/scripts/generate-assets.mjs`) i ciche WAV 0,2 s (`public/audio/`), `src/assets.ts` (`ASSET_MANIFEST` — jedyne źródło ścieżek, `IMAGE_SIZES`), `PreloadScene` (ładowanie przez manifest), `audio.ts` (`playSound`, flaga `muted`), sceny używają sprite'ów z fallbackiem do kształtów (`textures.exists`). Opis każdego assetu i instrukcja podmiany: `assets/ASSETS.md`. Test `assets.test.ts` (pliki, poprawność SVG/WAV, klucze w ASSETS.md). Wygląd grafiki to tymczasowe placeholdery; płynność w 60 fps i dźwięk (pliki ciche) NIE sprawdzone.
- Task 11 (etap 6, kod gotowy, APK zablokowany): Capacitor 6.2.3 (`@capacitor/core`, `cli`, `android`, `preferences`, `app`), `capacitor.config.ts` (`appId` `com.pisuar.chooser` — placeholder do potwierdzenia przed Play), projekt `apps/game/android` (portret, pełny ekran przez motyw), `src/nativeStorage.ts` (`capacitorBackend` na Preferences, `defaultBackend()` wybiera Preferences na urządzeniu, `localStorage` w przeglądarce), `src/lifecycle.ts` (`onAppHidden`: `visibilitychange` + `appStateChange` → jeden handler w `GameScene`, listener usuwany przy zamknięciu sceny). Skrypty `build:android` (działa) i `apk`. Szczegóły i obejście Avasta: `docs/progress/android-build.md`.
  - **Blokada:** debug APK nie zbudowany — brak `platforms;android-34` i `build-tools;34.0.0` w SDK (AGP 8.2.1 nie obsługuje zainstalowanej `android-37.0`). Do doinstalowania przez użytkownika (`sdkmanager`), potem `npm run apk -w @pisuar/game`.
  - NIE sprawdzone na urządzeniu/emulatorze: uruchomienie APK, tap drzwi → plansza → wybór, wygląd pełnego ekranu i orientacja, zapis przez Preferences (saldo/rekord po ponownym uruchomieniu), porzucenie przebiegu po schowaniu aplikacji (`appStateChange`), przycisk Wstecz (zamyka aplikację), płynność 60 fps i dotyk.
- Stan: 136 testów przechodzi (core 61, game 75), `npm run typecheck` czysty, `npm run build:android -w @pisuar/game` działa. Gałąź `feat/pisuar-chooser` (zob. `git log`).

## Następny krok
- Doinstalować komponenty SDK, zbudować APK (`npm run apk -w @pisuar/game`), zainstalować ręcznie (`adb install -r …`) i przejść listę „NIE sprawdzone” z Task 11. Etapy 1–6 są wtedy gotowe.
- Potem: osobny, jeszcze nienapisany plan etapu 7 (leaderboard + zakupy w aplikacji; porty w `ports.ts` gotowe). Przed publikacją w Play: potwierdzić `appId`, podnieść `targetSdk`.

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
- Identyfikator aplikacji `com.pisuar.chooser` — placeholder, do potwierdzenia przed pierwszym wysłaniem do Google Play (później niezmienny).
