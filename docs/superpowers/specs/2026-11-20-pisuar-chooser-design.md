# Pisuar Chooser — dokument projektowy

Data: 2026-11-20. Status: do akceptacji.
Oznaczenia: **[Twoje]** = ustalone z autorem; **[Moje]** = decyzja projektanta do skorygowania.

## 1. Intencja

Absurdalna, "głupawa" gra mobilna 2D: gracz wchodzi do toalety męskiej i ma jak najszybciej wybrać najlepszy pisuar, mając do dyspozycji przerysowane przeszkody. Ma być banalna w obsłudze (same kliknięcia), jednoekranowa, offline, z rysunkową, kolorową grafiką. Cel: lekka gra, do której wraca się na krótkie sesje i bije własny rekord.

## 2. Cele, nie-cele, anty-cele

**Cele**
- Działająca gra na Androidzie, w pełni offline (poza opcjonalnym leaderboardem i zakupami).
- Logika gry jako czysta biblioteka niezależna od prezentacji (mobile, web, cokolwiek).
- Przygotowanie pod leaderboard i mikropłatności (architektura i punkty zaczepienia; pełna integracja w ostatnim etapie).

**Nie-cele**
- iOS w pierwszej wersji (port ma być tani, ale nie jest dostarczany).
- Pauza, zapis stanu rozgrywki, konta, multiplayer, jakiekolwiek wymagane połączenie z siecią.
- Zapamiętywanie czegokolwiek poza rekordem (i lokalnym saldem punktów, patrz 5.4).

**Anty-cele**
- Pay-to-win: zakupy za prawdziwe pieniądze **nie mogą** wpływać na ranking. Rekord = najwyższy osiągnięty poziom, a punkty (waluta zakupowa) w rankingu nie występują. **[Twoje]**
- Silnik/narzędzia typu Unity dla tak prostej gry.

## 3. Ograniczenia i decyzje technologiczne **[Moje, zaakceptowane kierunkowo]**

| Warstwa | Wybór |
|---|---|
| Rdzeń logiki | czysty TypeScript, zero zależności i zero dostępu do DOM/czasu systemowego; testy Vitest |
| Prezentacja | Phaser 3 (cienka warstwa: rysuje i wysyła komendy) |
| Pakowanie | Capacitor → Android |
| Leaderboard / zakupy | wtyczki natywne za interfejsem `PlatformServices` (Google Play Games, Play Billing); na iOS podmiana na Game Center / StoreKit |
| Rekord, saldo | Capacitor Preferences za interfejsem `Storage` |

Podejścia odrzucone: Godot 4 (trudniej wydzielić i testować rdzeń poza silnikiem, słabsze wtyczki), Flutter+Flame (mniejszy ekosystem gier 2D, nic nie wygrywa z wybraną opcją).

Struktura repo (workspace npm): `packages/core` (logika), `apps/game` (Phaser + Capacitor), `docs/`, `assets/`.

## 4. Architektura

Rdzeń jest deterministyczną maszyną stanów. Nie używa zegara ani losowości globalnej: czas dostaje jako `tick(dtMs)`, losowość przez wstrzykiwany generator z ziarnem (reprodukowalne poziomy i testy).

- **Komendy** (wejście): `startGame(difficulty)`, `openDoor()`, `pickUrinal(index)`, `tick(dtMs)`, `buyPerk(type)`, `acknowledgeSummary()`.
- **Stan**: faza (`DOOR_CLOSED` → `PLAYING` → `LEVEL_RESULT` → `DOOR_CLOSED` … lub `TIMED_OUT` → `START`), poziom, punkty, plansza, pozostały czas, liczniki użyć perków w bieżącym przebiegu.
- **Zdarzenia** (wyjście dla prezentacji): `DoorOpening`, `LevelStarted`, `PickedBest`, `PickedWorse{lost}`, `PickedOccupied{timePenalty}`, `TimedOut`, `PerkBought`, `NewRecord` itd. Prezentacja animuje zdarzenia i niczego sama nie rozstrzyga.
- **Porty** (interfejsy poza rdzeniem): `Storage` (rekord, saldo), `PlatformServices` (submitScore, zakup), `Audio`/`Renderer` po stronie aplikacji.

## 5. Zasady gry

### 5.0 Dwa liczniki **[Twoje]**
- **Poziom gracza** (`playerLevel`): liczba poziomów faktycznie **rozwiązanych wyborem pisuara**. Wyświetlany numer to poziom, który gracz teraz próbuje przejść (rozwiązane + 1). Rośnie tylko po wyborze wolnego pisuara. "Pomiń" i "Kontynuuj" go **nie** zmieniają.
- **Poziom trudności** (`difficultyLevel`): rośnie o 1 przy każdej nowej planszy, czyli po wyborze pisuara, po "Pomiń" i po "Kontynuuj". Od niego zależą parametry planszy i czas. Start zależy od wybranego poziomu początkowego (5.5).
- Przykład: gracz na poziomie 10, raz pomija, trzy razy kontynuuje → nadal poziom 10, ale trudność planszy jest o 4 wyższa.

### 5.1 Plansza
Rząd *n* pisuarów, numerowanych od lewej. Każdy jest w jednym ze stanów: **wolny czysty**, **wolny mokry**, **wolny osikany**, **zajęty zwykłym człowiekiem**, **zajęty śmierdzącym człowiekiem**. Generator gwarantuje **co najmniej dwa pisuary wolne o różnym koszcie** (jeden lepszy, drugi gorszy), żeby wybór nigdy nie był oczywisty. **[Twoje]** (Remisy wśród najlepszych nadal są dozwolone, o ile istnieje przynajmniej jeden ściśle gorszy wolny pisuar.)

### 5.2 Funkcja kosztu (im niżej, tym lepiej) **[kierunek Twój, liczby Moje i strojone]**
Koszt wolnego pisuara = koszt podłogi + suma wpływu wszystkich ludzi w rzędzie, malejącego z odległością.
- Podłoga: czysta 0, mokra 1, osikana 3.
- Zwykły człowiek w odległości 1 = 1, w odległości 2 = 0,5, dalej 0 (do ewentualnego strojenia).
- Śmierdzący człowiek: odległość 1 = 3, odległość 2 = 1, dalej 0.
- Pisuar z najniższym kosztem jest "najlepszy"; remisy dozwolone, wszystkie najlepsze są równie dobre.

Wagi są konfiguracją, nie stałymi w kodzie. **Kryterium poprawności: wszystkie przykłady z Twojego opisu muszą wychodzić zgodnie z oczekiwaniem** (m.in. `[X][ ][ ][ ][ ]` → 5; `[X][ ][ ][ ][X]` → 3; `[ ][X][ ][X][ ]` → 1 i 5 remis; `[X][M][X][Z][ ]` → 5 lepszy niż 2; `[X][ ][X][X][ ][X][X]` → 2 lepszy niż 5) i stanowią testy akceptacyjne. Jeśli wagi nie spełniają przykładów, strojone są wagi, nie testy.

### 5.3 Wybór pisuara
Wybór **dowolnego wolnego pisuara kończy poziom**; różni się tylko wynik punktowy. **[Twoje]** Poziom gracza rośnie w obu przypadkach **[Moje: złe, ale wolne wybranie nadal "przechodzi" poziom, tylko z karą]**.
- **Wolny, najlepszy** (także przy remisie): +punkty.
- **Wolny, gorszy**: **−punkty** proporcjonalnie do (koszt wybranego − koszt najlepszego), z górnym limitem kary. **[Twoje: im gorzej, tym więcej; limit Mój]** Pokazywany jest pisuar poprawny.
- **Zajęty zwykłym człowiekiem**: kara czasowa **10%** czasu poziomu, zaokrąglona w dół do 0,1 s; poziom trwa dalej, gracz musi wybrać inny. **[Twoje]**
- **Zajęty śmierdzącym człowiekiem**: kara czasowa **20%**, zasady jak wyżej. **[Twoje]**
- Kary czasowe nie zabierają punktów. **[Moje]**
- Procent liczony od **pełnego czasu danego poziomu**, nie od pozostałego. **[Moje]**
- Timer ma rozdzielczość 0,1 s. Spadek czasu do 0 = natychmiastowa przegrana (zsikanie się). **[Twoje]**
- Kara większa niż pozostały czas ustawia czas na 0 i kończy się przegraną (`TimedOut`). **[Moje]**
- Pisuar kliknięty jako zajęty można kliknąć ponownie (kolejna kara). **[Moje]**

### 5.4 Punkty i perki
- Punkty to **lokalne saldo gracza**, nie wynik; nie trafiają do rankingu **[Twoje]**. W przyszłości będą kupowalne za prawdziwe pieniądze.
- Perki: **Pomiń poziom** (przycisk w lewym górnym rogu) i **Kontynuuj** (w oknie podsumowania po przegranej). Cena każdego zaczyna się od niewielkiej wartości bazowej i **podwaja się z każdym użyciem w ramach jednego przebiegu**; liczniki każdego perku osobne, zerowane przy nowej grze. **[Twoje]**
- **Kontynuuj** (po przegranej): numer poziomu gracza zostaje, ale generowana jest **nowa plansza o trudności o 1 wyższej** z pełnym czasem odpowiadającym tej trudności; cena rośnie z każdym użyciem, można używać wielokrotnie. **[Twoje]**
- **Pomiń**: poziom gracza zostaje, plansza zmienia się na nową o trudności +1; bez punktów. **[Twoje]**
- Przegrana nie zabiera salda. **[Twoje]** Saldo nie schodzi poniżej zera (kary punktowe); zakup sprawdza saldo. **[Moje]**
- Ekonomia: perki są okazjonalne. Cena bazowa ≈ nagroda za jeden dobrze rozegrany poziom, ceny rosną szybko przez podwajanie, saldo narasta przez wiele sesji. **[Twoje: opcja A]**
- Saldo przetrwa restart aplikacji (jest walutą zakupową). Poza rekordem i saldem nic się nie zapisuje; wyjście z poziomu = świeża gra. **[Twoje + Moje: saldo jako wyjątek]**

### 5.5 Poziomy i trudność
- Poziom efektywny rośnie liniowo z każdym zaliczonym poziomem; mapuje się na parametry: liczba pisuarów, liczba i rodzaje przeszkód, czas na poziom (malejący liniowo, z dolnym ograniczeniem). **[Twoje: liniowość]**
- Start: Łatwy = poziom efektywny 1, Średni ≈ 8, Trudny ≈ 15 (poziom 15 łatwego ≈ poziom 1 trudnego). **[Twoje kierunek, liczby Moje]**
- Czas liczy się dopiero po otwarciu drzwi; przy zamkniętych drzwiach stoi. Brak pauzy. **[Twoje]**
- Przegrana: animacja, okno podsumowania z opcją "Kontynuuj" (za punkty) i "OK" → ekran startowy (zamknięte drzwi).

### 5.6 Rekord
Rekord to **najwyższa liczba poziomów rozwiązanych wyborem pisuara w jednym przebiegu** (`playerLevel` z 5.0): przegrany poziom się nie liczy (przegrana na poziomie 10 = rekord 9), a "Pomiń" i "Kontynuuj" rekordu nie podnoszą. Dzięki temu punkty kupione za prawdziwe pieniądze nie podnoszą rekordu. **[Twoje]** Zapis lokalny; do leaderboardu wysyłany ten sam wynik. Rekord i ranking **per poziom trudności startowej**, bo start Trudnego od poziomu 15 nie powinien porównywać się z Łatwym; w Play Games trzy osobne leaderboardy. **[Moje]**

### 5.7 Fazy i komendy rdzenia **[Moje]**
`START` → (`startGame`) → `DOOR_CLOSED` → (`openDoor`) → `PLAYING` → (`pickUrinal` wolny) → `LEVEL_RESULT` → (`nextLevel`) → `DOOR_CLOSED`. Z `PLAYING` też `skipLevel` → `DOOR_CLOSED` (nowa plansza). Przy zerze czasu → `SUMMARY`, skąd `buyPerk('continue')` → `DOOR_CLOSED` (nowa plansza, trudność +1) albo `acknowledgeSummary` ("OK") → `START`.

### 5.8 Limity trudności **[Twoje + Moje]**
Gra jest nieskończona; liczba pisuarów, gęstość przeszkód i dolna granica czasu mają górne limity, po których trudność przestaje rosnąć. Zawsze obowiązuje gwarancja z 5.1 (min. dwa wolne pisuary o różnym koszcie).

## 6. UI (jeden ekran) **[Twoje]**
- Prawy górny róg: poziom | punkty. Lewy górny: perk "Pomiń poziom".
- Środek: przy zamkniętych drzwiach grafika drzwi z ręką; tapnięcie → animacja otwarcia → plansza z pisuarami. Po wyborze informacja, pokazanie poprawnej odpowiedzi, kolejny poziom (znowu zamknięte drzwi).
- Wybór trudności: sposób wyboru (3 przyciski na ekranie startowym) **[Moje]**.
- Styl: rysunkowy, wyraźne kontury, spójna kolorowa paleta, pozorna głębia (warstwy/parallax).

## 7. Leaderboard i mikropłatności
- `PlatformServices.submitHighestLevel(difficulty, level)` wywoływane przy nowym rekordzie; błąd sieci cicho ignorowany (gra offline-first).
- Zakupy: konsumowalne paczki punktów (Play Billing), zasilają wyłącznie saldo; nie wpływają na rankingi. Ustawienie sklepu i weryfikacja zakupów to osobny etap.
- Do czasu integracji używane są atrapy (no-op) portów.

## 8. Podejścia rozważone
A. **TS + Phaser + Capacitor** (wybrane) — najlepsza separacja logiki, szybkie testy, lekkie narzędzia.
B. Godot 4 — słabsza separacja i testowalność rdzenia.
C. Flutter+Flame — mniejszy ekosystem 2D, brak przewagi.

## 9. Podział pracy (SDD: ten dokument jest specyfikacją, testy rdzenia z przykładów są kryterium akceptacji)
Po każdym etapie aktualizowany plik wznowienia `docs/progress/RESUME.md` (co zrobione, co dalej, jak uruchomić, otwarte decyzje).
1. **Szkielet**: workspace, TS, Vitest, struktura, pierwszy `RESUME.md`.
2. **Rdzeń**: funkcja kosztu + testy z przykładów, generator poziomów, punkty, kary czasowe, maszyna stanów, perki, krzywe trudności (wszystko pokryte testami).
3. **Symulacja/balans**: skrypt do strojenia wag, czasów i cen perków; wersja webowa jako szybki prototyp.
4. **Prezentacja**: Phaser, ekran gry z grafikami zastępczymi, wszystkie fazy, zdarzenia→animacje.
5. **Assety**: proste wygenerowane grafiki + `assets/ASSETS.md` (lista co jest czym, rozmiary, nazwy plików do podmiany) + placeholdery dźwięków.
6. **Android**: Capacitor, build APK/AAB, test na urządzeniu/emulatorze.
7. **Leaderboard + zakupy**: realne implementacje portów.

## 10. Pozostawione wykonawcy
Dokładne liczby (wagi kosztu, ceny bazowe perków, formuły czasu i liczby pisuarów, punkty za poziom i mnożnik kary), format zdarzeń, układ plików, wybór bibliotek pomocniczych, nazwy plików assetów, szczegóły animacji.
