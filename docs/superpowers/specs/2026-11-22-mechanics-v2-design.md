# Pisuar Chooser – mechanika v2 (projekt)

Data: 2026-11-22. Rozszerza `2026-11-20-pisuar-chooser-design.md`. Zakres: **tylko mechanika** (grafika/dźwięk poza zakresem; placeholdery zostają).

## 1. Cel i powód
Gra jest za łatwa i jednostajna: plansze zawierają głównie efekty podłogi (mokra, osikana), mało jest postaci, a postaci i efekty się wykluczają. Gracz chce: więcej postaci przy mniejszej liczbie efektów, współwystępowanie efektów z postaciami, więcej dynamiki dzięki nowym postaciom, menu pauzy z możliwością zakończenia tury i tryb poziomy (więcej miejsca na pisuary).

## 2. Cele / nie-cele / anty-cele
**Cele**
- Większość plansz to „postacie + pisuary”; efekty to przyprawa, nie danie główne.
- Efekt podłogi może leżeć pod postacią i wpływa na sąsiadów („zapach podłogi”).
- 8 rodzajów lokatorów i 3 zdarzenia dynamiczne (rozdz. 5–6), każde zapowiadane przed wykonaniem.
- Pauza: wznów / zakończ turę, z podsumowaniem tury.
- Tryb poziomy 1920×1080.
- Cała logika w `packages/core`, deterministyczna dla seeda, testowana TDD bez Phasera.

**Nie-cele**: docelowa grafika (są tylko proste modele nowych postaci, rozdz. 10a), dźwięk, leaderboard i zakupy (etap 7 z poprzedniego planu), nowe perki, nowe poziomy trudności.

**Anty-cele (porażka nawet jeśli „działa”)**
- Zmiana planszy w trakcie poziomu bez zapowiedzi (gracz czuje się oszukany).
- Plansza bez jednoznacznie najlepszego pisuaru lub z <2 wolnymi pisuarami.
- Pauza jako sposób na darmowe analizowanie planszy bez presji czasu.
- Regres balansu: zachowane niezmienniki z `balance.test.ts` (P(poz.1) ≥ 0,4; P(poz.30) ≤ 0,2; trudność niemalejąca z tolerancją 2%).

## 3. Podejścia (rozważone)
- **A. Slot z podłogą i lokatorem + tabela parametrów lokatorów + kolejka zdarzeń w stanie gry — WYBRANE** (wybór gracza).
- B. Zostawić `Slot`, dodać równoległe tablice `floors[]`/`extras[]` — odrzucone: dwa źródła prawdy.
- C. Ogólne „modyfikatory” slotu bez rozróżnienia postaci/efektów — odrzucone: przerost abstrakcji dla ~8 rodzajów, trudniejsze testy akceptacyjne.

## 4. Model danych (rdzeń)
```ts
type Floor = 'clean' | 'wet' | 'pee';
type OccupantKind =
  | 'plain' | 'smelly'          // dotychczasowe
  | 'parent' | 'child'          // para (rozdz. 5.2)
  | 'gap'                       // pułapka między dzieckiem i rodzicem
  | 'shy' | 'splasher'          // rozdz. 5.3
  | 'outOfOrder';               // nieczynny pisuar (obiekt)
interface Occupant { kind: OccupantKind }
interface Slot { floor: Floor; occupant: Occupant | null }
type Board = Slot[];
```
- Slot **wolny** = `occupant === null`. Tylko wolne można wybrać. Wybranie slotu z lokatorem = „zajęty” (kara czasowa), jak dziś.
- Podłoga jest własnością każdego slotu (także zajętego).

### Tabela parametrów lokatorów (`config.ts`, jedno źródło prawdy)
| rodzaj | siła `weight` (odległość 1) | `decayBase` | `penaltyPct` (kara czasu za tap) |
|---|---|---|---|
| plain | 1 | 0,5 | 0,10 |
| smelly | 3 | 0,5 | 0,20 |
| parent | 1 | 0,5 | 0,10 |
| child | 2 | 0,5 | 0,10 |
| gap | 0 | – | 0,20 (pułapka) |
| shy | 1 | 0,8 | 0,10 |
| splasher | 1 | 0,5 | 0,10 |
| outOfOrder | 0 | – | 0,10 |

Wartości początkowe; stroi je symulacja (`npm run sim`), nie ręczne zgadywanie.

### Koszt pisuaru `i` (wolnego)
`cost(i) = floorWeight[slot_i.floor] + Σ_{j≠i} influence(j → i)` gdzie dla slotu `j`:
- wkład lokatora: `weight · decayBase^(|j−i|−1)`
- **wkład podłogi pod zajętym `j`** („zapach podłogi”): `floorWeight[floor_j] · 0,5^(|j−i|−1)` (stały zanik 0,5, niezależnie od lokatora)
- wolny `j` nie wpływa na `i` poza własną podłogą (jak dziś).
`floorWeight`: clean 0, wet 1, pee 3 (bez zmian).

Przykłady akceptacyjne (do testów, wartości obliczone na wagach domyślnych):
- `[plain][wolny clean]` → koszt wolnego = 1.
- `[plain+wet][wolny clean]` → 1 + 1 = 2.
- `[smelly+pee][wolny][wolny clean]` → slot 1: 3 + 3 = 6; slot 2: 3·0,5 + 3·0,5 = 3.
- `[child][wolny]`: 2; `[parent][wolny]`: 1.
- `[shy][wolny][wolny]`: slot 1: 1; slot 2: 0,8.

### Kara za zajęty
`penaltyMs = floor(levelTimeMs · penaltyPct / 100) · 100` (dziś `timePenaltyMs`); `penaltyPct` z tabeli.

### Walidacja planszy
Plansza jest poprawna, gdy ma ≥2 wolne sloty i ich koszty nie są wszystkie równe (jak dziś). Generator losuje do `maxGenerateAttempts` razy, potem plansza zapasowa (osoby po lewej, wolne czyste po prawej, bez par/efektów).

## 5. Postaci

### 5.1 Istniejące
- **plain** („zwykły człowiek”), **smelly** („śmierdzący”): bez zmian zasad, ale mogą leżeć na dowolnej podłodze.

### 5.2 Dziecko + rodzic (byt złożony)
- Generowane **razem**: `child` na slocie `k`, `parent` na `k±2`, `gap` na slocie pomiędzy. Strona (dziecko po lewej/prawej) losowa. Zajmuje 3 sloty; wymaga ≥3 slotów + miejsca na ≥2 wolne.
- Tap w `gap` = zajęty, kara 20% czasu (pułapka). Tap w child/parent = zajęty, kara 10%.
- `child` odstrasza ×2, `parent` ×1 (jak zwykły). Para ma odmienne kolory niż zwykli (placeholder: osobny kolor w scenie; poza zakresem grafiki, ale scena musi je rozróżniać).

### 5.3 Nowe postaci statyczne
- **Nieśmiały (`shy`)**: waga 1, `decayBase` 0,8 → odstrasza także pisuary 2–4 slotów dalej (potrzebuje przestrzeni).
- **Chlapacz (`splasher`)**: przy generowaniu **ustawia `wet` na slotach po obu stronach** (jeśli istnieją i nie są inną postacią/podłogą gorszą niż wet). Efekt jest skorelowany z postacią; sam nie odstrasza bardziej niż zwykły.
- **Nieczynny pisuar (`outOfOrder`)**: obiekt, nie osoba; waga 0 (nikogo nie odstrasza), ale tap = zajęty (kara 10%). Wypełniacz wymuszający czytanie planszy.

### 5.4 Postaci dynamiczne (zmiany w trakcie poziomu, zawsze zapowiedziane)
Mechanizm wspólny (rdzeń): stan gry ma `pending: ScheduledEvent[]` — `{ id, kind, index, telegraphAtMs, applyAtMs }`, liczone od otwarcia drzwi (`elapsed = levelTimeMs − timeLeftMs`). Planowane przy otwarciu drzwi seedowanym RNG. Zdarzenia rdzenia: `Telegraphed{id,kind,index}` (zapowiedź, UI pokazuje „cień”) → `Applied{id,kind,index}` albo `Cancelled{id}`. Zapowiedź poprzedza wykonanie o **1500 ms** (stała `TELEGRAPH_MS`). Przy wykonaniu plansza jest sprawdzana: jeśli po zmianie byłaby niepoprawna (<2 wolne lub wszystkie koszty równe) lub cel już się zmienił, zdarzenie jest `Cancelled`. Wybór gracza oceniany jest względem planszy **w chwili tapnięcia** (po zastosowanych zmianach, zapowiedziana-ale-niewykonana zmiana jeszcze się nie liczy).
- **Sprzątacz (`mop`)**: wykonuje się po ~50% czasu poziomu (zakres 40–60%), o ile gracz jeszcze nie wybrał. Cel: losowy wolny slot z `clean` → `wet`. Brak celu → zdarzenie nie jest planowane.
- **Spóźniony (`arrive`)**: po ~35–65% czasu poziomu zajmuje losowy wolny slot (`plain`, 25% szans `smelly` od poziomu 24). Tap w ten slot po wejściu = zajęty.
- **Wychodzący (`leave`)**: istniejący `plain`/`smelly` (nie z pary) po ~40–70% czasu wychodzi; slot staje się wolny z `wet`.
- Na planszy jest naraz najwyżej jedno zdarzenie dynamiczne na poziom do poziomu 30, potem do dwóch (z zachowaniem 1500 ms odstępu między zapowiedziami).

## 6. Generowanie poziomów (rdzeń, `levelParams` + `generator`)
Zamiast „liczba osób rośnie co 12 poziomów” parametry opisują **budżet lokatorów i efektów**:
- Liczba **lokatorów** (osoby + elementy pary + nieczynne) ≈ `round(urinals · 0,35)`, min 1, max `urinals − 2`. Poziom 1 (3 pisuary): 1.
- **Efekty podłogi** (wet/pee) łącznie ≤ `floor(lokatorzy / 2)` (≥ 0 do poziomu 4; wet od poziomu 4, pee od 10 — stałe w `LEVELS`). Czyli osób jest wyraźnie więcej niż efektów.
- **Współwystępowanie**: każdy efekt trafia pod losowego lokatora z p = 0,5, w przeciwnym razie na wolny slot.
- **Odblokowania rodzajów** (poziom trudności, stałe w `LEVELS`, początkowe): smelly 6, outOfOrder 9, para dziecko+rodzic 8, shy 12, splasher 16, sprzątacz 14, wychodzący 20, spóźniony 24. Faktycznie obowiązujące poziomy: para dziecko+rodzic pojawia się dopiero od poziomu 13 (reguła budżetu, zob. rozdz. 11), `outOfOrder` rośnie bardzo wolno (+1 co 52 poziomy; wyższe liczby przeszkód zwiększały P(trafienia) przy 18 pisuarach i łamały monotoniczność trudności). Przed odblokowaniem rodzaj nie jest losowany; po odblokowaniu pojawia się z rosnącą szansą (kolejne rodzaje nie wypierają zwykłych — zawsze ≥1 `plain`, jak dziś).
- Poziom nigdy nie zawiera dwóch tych samych par/dynamik ponad budżet lokatorów.
- Czas poziomu: bez zmian (`baseTimeMs`, `timeStepMs`).
Dokładne liczby stroi symulacja; test balansu pilnuje niezmienników z rozdz. 2.

## 7. Pauza i koniec tury
- Nowe komendy: `pause`, `resume`, `endRun`. Stan: `paused: boolean`.
- `pause`: dozwolone w `PLAYING` (i `DOOR_CLOSED`); gdy `paused`, `tick`, `pickUrinal`, `skipLevel`, `openDoor` są ignorowane (zwracają `[]`); zdarzenia dynamiczne stoją.
- `resume`: wraca do gry bez utraty czasu.
- `endRun`: z `DOOR_CLOSED`/`PLAYING`/`LEVEL_RESULT`/pauzy → `SUMMARY`; zdarzenie `RunEnded` (nie `TimedOut`). Rekord liczy się normalnie (`NewRecord`, zapis). **Perk „Kontynuuj” nie jest oferowany po dobrowolnym zakończeniu** (decyzja budowniczego, patrz rozdz. 10).
- Menu pauzy pokazuje: trudność, poziom gracza (`playerLevel + 1`), punkty, rekord dla trudności, pozostały czas poziomu, użycie perków. Przyciski: „Wznów”, „Zakończ turę”. Podczas pauzy plansza jest **zasłonięta** (nie wolno jej analizować przy zatrzymanym czasie).
- Schowanie aplikacji (`visibilitychange`/`appStateChange`) nadal porzuca przebieg (bez zmian).
- Przycisk pauzy w HUD (tap) i systemowy „Wstecz” = pauza (wyjście z aplikacji tylko z ekranu startowego).

## 8. Tryb poziomy
- `GAME_WIDTH = 1920`, `GAME_HEIGHT = 1080` (FIT). Android: `screenOrientation="landscape"` w manifeście, `capacitor.config.ts` bez zmian poza tym.
- `urinalRects`/`hitIndex` przeliczone na szeroki układ: przy 18 pisuarach ≥ ~90 px szerokości; ASPECT i `MAX_H_FRAC` dostrojone do 1080 px wysokości.
- Ekrany start/podsumowanie/HUD/menu pauzy rozmieszczone na nowym płótnie; funkcje układu pozostają czyste i testowane.

## 9. Metoda: SDD + TDD
- **SDD**: ten dokument → plan (`superpowers:writing-plans`) → wykonanie przez `superpowers:subagent-driven-development` (osobny implementer + recenzent na zadanie), jak w etapach 1–6.
- **TDD**: dla każdego zachowania najpierw czerwony test w `packages/core/test` (lub `apps/game/test` dla układu/pauzy w sesji), potem kod. Testy obejmują: przykłady akceptacyjne kosztu (rozdz. 4), nowe kary, własności generatora na wielu seedach (poprawność, proporcja lokatorów do efektów, odsetek współwystępowania, rozmieszczenie par z `gap`), harmonogram zdarzeń z fałszywym czasem (zapowiedź → wykonanie → anulowanie), pauza/koniec tury jako maszyna stanów, `urinalRects` dla 3..18 w poziomie, niezmienniki balansu.
- Kolejne etapy dostarczania (każdy zielony zanim ruszy następny): **(1)** model slotu + koszt + generator; **(2)** pauza + tryb poziomy (niezależny od 1, może iść równolegle); **(3)** postaci statyczne; **(4)** postaci dynamiczne ze zapowiedziami.
- Migracja: zmiana `Slot` aktualizuje istniejące testy/ helpery (`helpers.ts`) i scenę; liczba testów nie maleje.

## 10. Decyzje budowniczego (do sprawdzenia przez gracza)
- „Zapach podłogi” z zanikiem 0,5 niezależnie od lokatora.
- Pułapka `gap` ma karę 20% (podwójna).
- Brak „Kontynuuj” po `endRun`.
- Plansza zasłonięta na pauzie.
- Zapowiedź 1500 ms i okna czasowe zdarzeń (rozdz. 5.4).
- Wszystkie liczby progów i proporcji (rozdz. 4, 6) są wartościami początkowymi do strojenia symulacją.

## 10a. Proste modele nowych postaci (dodane na życzenie gracza)
Wyjątek od „grafika poza zakresem”: każda nowa postać dostaje **prosty placeholderowy model** w tym samym trybie co obecne (SVG generowane deterministycznie przez `apps/game/scripts/generate-assets.mjs`, wpis w `ASSET_MANIFEST` w `src/assets.ts`, opis i instrukcja podmiany w `assets/ASSETS.md`, sprawdzane przez `assets.test.ts`).
- Modele: dziecko, rodzic (inny kolor niż zwykli; dziecko mniejsze), tabliczka „nieczynny” (pisuar), nieśmiały, chlapacz, sprzątacz (z wiadrem), spóźniony (może współdzielić model zwykłego, inny kolor), oraz znacznik „cienia” zapowiedzi (półprzezroczysta sylwetka/ikona wiadra lub strzałki).
- Wygląd to tylko rozróżnialne kształty i kolory, a nie docelowa grafika. Dopracowanie pozostaje na osobny raz.
- Scena używa modeli z fallbackiem do kształtów (`textures.exists`), jak dziś. Dostarczane w etapie 3 (postaci statyczne) i 4 (sprzątacz, spóźniony, cień).

## 11. Doprecyzowania po recenzji (decyzje budowniczego)
- **Cykl życia zdarzeń**: `pending` jest czyszczone przy wyborze wolnego pisuaru, `skipLevel`, `endRun`, timeout i nowej planszy (bez zdarzeń `Cancelled` — to nie zmiana planszy, tylko koniec poziomu). Tap podczas okna zapowiedzi jest normalny i oceniany względem planszy z chwili tapnięcia (zapowiedziana zmiana jeszcze nie obowiązuje). To zamierzone: cień daje szansę uniknąć zmiany, nie gwarantuje oceny według przyszłej planszy. „Najlepsze” liczone na żądanie przy każdym tapnięciu, bez cache.
- **Budżet lokatorów**: `gap` i `outOfOrder` NIE wliczają się do budżetu 35% (liczą się osoby: plain, smelly, child, parent, shy, splasher). Para to jedna „jednostka” zajmująca 3 sloty. Całość ograniczona do `urinals − 2` slotów zajętych. Para wymaga `people ≥ 3` i ≥4 wolnych slotów po jej ustawieniu (pierwsza para: poziom 13; zob. doprecyzowanie poniżej). Gdy skład nie mieści się w limicie, para jest zastępowana zwykłą osobą.
- **Splasher**: wet ustawione przez niego liczy się do budżetu efektów; splashery są umieszczane najpierw, reszta budżetu efektów losowana potem.
- **Zdarzenia dynamiczne**: dla każdego poziomu losowany jest co najwyżej jeden rodzaj spośród odblokowanych, z p = 0,5 że w ogóle wystąpi; od poziomu 30 do dwóch, a odstęp ≥1500 ms dotyczy zapowiedzi. Inwarianty (≥2 wolne, nierówne koszty) sprawdzane przy wykonaniu; „≥1 plain” tylko przy generowaniu. `Cancelled` = cień znika, bez dodatkowej animacji. `leave` nie dotyka pary ani nieczynnego.
- **`endRun`**: punkty (saldo) są już rozliczone po każdym wyborze; bieżący, nierozwiązany poziom jest odrzucany; `playerLevel` = liczba rozwiązanych poziomów, więc rekord liczy się tylko z nich.
- **Przycisk Wstecz**: na podsumowaniu = „OK” (do ekranu startowego); na starcie = wyjście z aplikacji; w grze = pauza; na pauzie = wznów.
- **Para dziecko+rodzic — doprecyzowanie po implementacji**: próg odblokowania (poziom 8) jest „najwcześniejszym” poziomem; para jest losowana tylko, gdy `people ≥ 3` i po jej ustawieniu zostają ≥4 wolne sloty. Łagodniejsza reguła (≥2 wolne) łamała niezmiennik monotoniczności trudności, który obowiązuje na równi z tabelą odblokowań. W efekcie pierwsza para pojawia się na poziomie 13. Do ewentualnej zmiany przy strojeniu (zad. 12), jeśli balans pozwoli na wcześniejsze pojawienie się.
- **Plansza zapasowa**: zachowuje mokrą podłogę obok chlapaczy (inwariant chlapacza), poza tym bez efektów i bez par.
- **Układ**: pojedynczy rząd, 3..18 pisuarów, ~106 px na pisuar przy 18 (≥90 px wymagane). Zapisane rekordy bez zmian.
