# Assety Pisuar Chooser

Wszystkie obecne pliki to **placeholdery** (proste SVG pisane skryptem `apps/game/scripts/generate-assets.mjs` oraz ciche pliki WAV). Docelowa grafika i dźwięki mają je podmienić. Jedynym źródłem ścieżek jest `apps/game/src/assets.ts` (`ASSET_MANIFEST`); rozmiary rasteryzacji SVG są w `IMAGE_SIZES` w tym samym pliku. Pliki leżą w `apps/game/public/`.

## Styl (obowiązuje wszystkie obrazy)
- Kreskówka, spójna kolorowa paleta, **płaskie wypełnienia + gruby ciemny kontur** (placeholdery: `#0b0d12`, grubość 6 px w skali pliku, zaokrąglone końce i łączenia).
- Pozorna głębia: jaśniejsza górna krawędź (światło) i miękki cień pod obiektem (elipsa, ok. 28% czerni).
- Paleta placeholderów: drewno drzwi `#8a5a2b`/`#b97d42`, skóra `#f1c27d`, porcelana `#eef2f5`/`#b9c5d0`, podłoga czysta `#9fb3c8`, mokra `#3d8fd6`, żółta kałuża `#e3c21b`, osoba `#6b4fa0`, śmierdziel `#4f8a2b`, bohater `#d35400` ze spodniami `#2c3e50`, ściana `#2c3550`.
- Tło przezroczyste we wszystkich sprite'ach (poza `bg_wall` i `bg_floor`, które wypełniają całe pole).

## Obrazy

| Klucz | Plik | Rozmiar / format | Co przedstawia | Użycie w grze i uwagi dla grafika |
|---|---|---|---|---|
| `door` | `assets/door.svg` | 700×1100, SVG | Zamknięte drewnowe drzwi z dwoma płycinami i klamką | Ekran „drzwi zamknięte” nad planszą; skalowane do 800×1240 i „otwierane” skalowaniem w osi X (zawias po lewej, więc lewa krawędź musi być na krawędzi pliku). Placeholder. |
| `hand` | `assets/hand.svg` | 220×220, SVG | Dłoń z palcami do góry (podpowiedź „tapnij”) | Wyświetlana ok. 260×260 na drzwiach, po prawej stronie, na środku wysokości. Przezroczyste tło. Placeholder. |
| `urinal` | `assets/urinal.svg` | 160×280, SVG | Pisuar z przodu (miska z połyskiem) | Jeden na slot; skalowany proporcjonalnie do dolnych 65% pola slotu, wyrównany do dołu. Zostaw ok. 10 px marginesu na cień. Placeholder. |
| `floor_wet` | `assets/floor_wet.svg` | 200×60, SVG | Pas mokrej podłogi (niebieski) pod pisuarem | Rozciągany do paska pod pisuarem; wskazuje mokrą podłogę (gorsza jakość pisuaru). Placeholder. |
| `floor_pee` | `assets/floor_pee.svg` | 200×60, SVG | Pas podłogi z żółtą kałużą | Jak wyżej; żółty = wyraźnie brudna podłoga. Czysta podłoga nie ma osobnego assetu (rysowana prostokątem). Placeholder. |
| `person` | `assets/person.svg` | 160×420, SVG | Stojący człowiek (fioletowa koszulka) zasłaniający pisuar | Slot zajęty; skalowany proporcjonalnie do 80% szerokości i 75% wysokości slotu, wyrównany do dołu. Czytelny także przy szerokości ~35 px (18 pisuarów) — unikaj drobnych detali. Placeholder. |
| `person_smelly` | `assets/person_smelly.svg` | 160×420, SVG | Człowiek zielony ze smugami zapachu | Zajęty slot „śmierdziela” (dodatkowo obniża atrakcyjność sąsiednich pisuarów). Musi się wyraźnie różnić od `person` samą sylwetką i kolorem. Placeholder. |
| `bg_wall` | `assets/bg_wall.svg` | 1920×1080, SVG | Ściana toalety z kafelkami | Tło całego ekranu gry (rozciągane do 1920×1080). Niski kontrast, aby nie przeszkadzać planszy; bez przezroczystości. Placeholder. |
| `bg_floor` | `assets/bg_floor.svg` | 1920×380, SVG | Podłoga z perspektywą (linie fug) | Dolne 380 px ekranu, pod rzędem pisuarów. Górna krawędź to listwa przypodłogowa. Placeholder. |
| `hero` | `assets/hero.svg` | 220×420, SVG | Bohater w suchych spodniach | Ekran podsumowania („Zsikałeś się!”), skala 1,5, wyrównany do dołu (spód na y=960). Ten sam kadr i pozycja co `hero_wet`. Placeholder. |
| `hero_wet` | `assets/hero_wet.svg` | 220×420, SVG | Ten sam bohater z mokrymi (niebieskimi) spodniami | Płynnie pojawia się na `hero` (600 ms) w animacji zsikania. Musi dokładnie pokrywać się z `hero`. Placeholder. |

## Dźwięki

Wszystkie obecne pliki: WAV 16-bit PCM mono 22050 Hz, 0,2 s **ciszy** (placeholdery). Docelowo krótkie efekty (nie muzyka), głośność wyrównana.

| Klucz | Plik | Zdarzenie | Pożądany charakter / długość |
|---|---|---|---|
| `door_open` | `audio/door_open.wav` | Otwarcie drzwi (tap na zamknięte drzwi) | Skrzypnięcie/„whoosh”, ok. 0,25–0,4 s |
| `pick_good` | `audio/pick_good.wav` | Wybór najlepszego pisuaru | Radosny „ding”, 0,3–0,6 s |
| `pick_bad` | `audio/pick_bad.wav` | Wybór gorszego pisuaru | Smutny/komiczny „bzzt”, 0,3–0,6 s |
| `pick_occupied` | `audio/pick_occupied.wav` | Tap w zajęty pisuar (kara czasowa) | Zaskoczone „ups”/głuchy łomot, ok. 0,3 s |
| `timeout` | `audio/timeout.wav` | Koniec czasu — bohater się zsikał | Komiczne chlupnięcie/opadający dźwięk, 0,6–1,2 s |
| `perk` | `audio/perk.wav` | Zakup perka (pominięcie / kontynuacja) | Monety „kasa”, ok. 0,3–0,5 s |
| `tick` | `audio/tick.wav` | Tykanie zegara (na razie nieużywane w grze) | Bardzo krótki „tik”, ok. 0,05–0,1 s |

Dźwięki odtwarza `playSound` (`apps/game/src/audio.ts`); błędy są ignorowane, a flaga `muted` domyślnie wynosi `false` (brak UI ustawień).

## Jak podmienić asset
1. Zachowaj **klucz** i **nazwę pliku** (np. `apps/game/public/assets/urinal.svg`), proporcje i rozmiar bazowy z tabeli — kod dopasowuje obraz do pola, ale proporcje sprite'ów (`urinal`, `person*`, `hero*`) są zachowywane.
2. Plik PNG jest dozwolony: zmień wtedy ścieżkę (i rozszerzenie) w `ASSET_MANIFEST` w `apps/game/src/assets.ts` oraz — jeśli to konieczne — ładowanie w `PreloadScene` (`load.svg` → `load.image`). Dla PNG dostarcz plik w 2× rozmiaru bazowego.
3. Dźwięki: WAV, OGG lub MP3 (zmień ścieżkę w manifeście przy innym rozszerzeniu).
4. Skrypt `generate-assets.mjs` nadpisuje placeholdery — po wprowadzeniu własnych plików nie uruchamiaj go ponownie (lub usuń z niego podmienione assety).
5. Uruchom `npm test` — test sprawdza, że pliki z manifestu istnieją, SVG jest poprawny, WAV ma nagłówek, a każdy klucz jest opisany w tym dokumencie.
