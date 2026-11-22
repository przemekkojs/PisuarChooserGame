# Notatki o balansie (Task 6)

Symulacja: `npm run sim -w @pisuar/core` (200 ziaren na poziom, poziomy 1..40, losowy wybór wśród wolnych pisuarów).
Wskaźnik trudności = `(1 / P(trafienia)) * (czas_poz1 / czas)`.

## Wybrane poziomy (po strojeniu)

| lvl | pisuary | osoby | śmierdzące | mokre | siki | czas ms | P(best) | E[delta] | trudność |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 1 | 0 | 0 | 0 | 15000 | 0.500 | +4.00 | 2.00 |
| 5 | 5 | 1 | 0 | 1 | 0 | 13800 | 0.282 | +1.01 | 3.85 |
| 10 | 7 | 1 | 1 | 2 | 1 | 12300 | 0.178 | -3.43 | 6.84 |
| 15 | 10 | 2 | 2 | 3 | 1 | 10800 | 0.138 | -4.81 | 10.06 |
| 20 | 12 | 2 | 2 | 4 | 2 | 9300 | 0.107 | -5.60 | 15.07 |
| 30 | 17 | 3 | 3 | 6 | 3 | 6300 | 0.072 | -6.58 | 33.17 |
| 40 | 18 | 4 | 4 | 8 | 4 | 3300 | 0.071 | -7.38 | 63.64 |

Przed strojeniem (stare stałe): poziom 1 miał P=0.333 (za mało), poziom 30 P=0.50 (osoby rosły szybciej niż liczba pisuarów, więc wolnych ubywało i losowy strzał trafiał coraz częściej), a po poziomie 31 czas stał w miejscu (3000 ms).

## Zmienione stałe `LEVELS`
- `baseUrinals` 4 -> 3: poziom 1 to 2 wolne pisuary, P = 0.5 (cel >= 40%).
- `maxUrinals` 12 -> 18: liczba wolnych pisuarów rośnie przez cały zakres 1..40, więc szansa losowego trafienia maleje (cel poziom 30 <= 20%: jest 7.2%).
- `personEvery` 3 -> 12: osoby rosną wolniej niż pisuary (nie zjadają wolnych miejsc).
- `wetStart` 4 -> 5, `wetEvery` 4 -> 5; `peeEvery` 6 -> 8: przeszkody w tempie, które mieści się w liczbie wolnych pisuarów (bez przycinania).
- `timeStepMs` 400 -> 300: czas dochodzi do minimum 3000 ms dopiero ok. poziomu 40, więc trudność rośnie do końca zakresu.

## Ekonomia (spec 5.4)
`PERK_BASE.skip = 10 = SCORING.rewardBest` — pierwszy "Pomiń" kosztuje dokładnie jeden dobrze rozegrany poziom; zasada podwajania bez zmian. `PERK_BASE.continue = 15` bez zmian.

## Uwagi
- Trudność jest niemalejąca na 1..40 z jednym deterministycznym wyjątkiem: poziom 12 (8.50 -> 8.47, -0.35%). Ziarna są stałe, więc to cecha konfiguracji, nie szum losowania; test `balance.test.ts` dopuszcza tolerancję 2% na poziom. Próbkowanie siatki personEvery/wetEvery/peeEvery nie dało konfiguracji bez żadnego spadku, a ta ma najmniejszy.
- Poziomy 36 i 37 mają identyczny wskaźnik (50.00): remis (zmienia się tylko czas/układ bez zmiany P), niemalejąco.
- P(best) nie jest monotoniczne lokalnie (np. L12-L14 i L36-L37 wahają się o setne części) - liczy się wskaźnik trudności łączący P i czas.
- Poziomy 1-2 mają ten sam wskaźnik P (różni je tylko czas).
- Testy: `difficulty.test.ts` miał zakodowane stare wartości (4 pisuary na poz. 1, max 12) - zaktualizowane do nowych. Nowy `balance.test.ts` pilnuje niezmienników.

## Poprawka mieszanki osób (po końcowym review)
Problem: `smellyPersons = min(persons, growth(6, 5))` rosło co 5 poziomów, osoby co 12, więc od poziomu 6 KAŻDA osoba była śmierdząca (zwykli lokatorzy, kara 10%, nigdy się nie pojawiali).
Zmiana: przy `persons >= 2` co najmniej jedna osoba zostaje zwykła (`smellyPersons <= persons - 1`); przy `persons == 1` bez zmian (jedna osoba, śmierdząca od poz. 6). Dodatkowo `smellyEvery` 5 -> 20, żeby zwykłych było >= 1/3 także wysoko (poz. 30: 1 z 3, poz. 40: 2 z 4). Cele balansu bez zmian (P(poz. 1) = 0.500, P(poz. 30) = 0.072, test monotoniczności zielony).

| lvl | osoby | śmierdzące (przed -> po) | P(best) przed | P(best) po | trudność po |
|---|---|---|---|---|---|
| 1 | 1 | 0 | 0.500 | 0.500 | 2.00 |
| 5 | 1 | 0 | 0.282 | 0.282 | 3.85 |
| 10 | 1 | 1 | 0.178 | 0.178 | 6.84 |
| 15 | 2 | 2 -> 1 | 0.138 | 0.125 | 11.11 |
| 20 | 2 | 2 -> 1 | 0.107 | 0.100 | 16.13 |
| 30 | 3 | 3 -> 2 | 0.072 | 0.072 | 33.17 |
| 40 | 4 | 4 -> 2 | 0.071 | 0.071 | 63.64 |

Tabela „Wybrane poziomy” wyżej pokazuje stare liczby śmierdzących dla poz. 15-40 (stan z czasu strojenia).


## Mechanika v2 (Task 12)
Symulacja (`npm run sim -w @pisuar/core`) NIE modeluje zdarzeń dynamicznych (sprzątacz, wychodzący, spóźniony) — mierzy tylko planszę startową poziomu, losowy wybór wśród wolnych pisuarów, 200 ziaren. Nowa kolumna `underOcc` = odsetek plansz z ≥1 efektem podłogi pod lokatorem.

| lvl | pisuary | osoby | śmierdzące | mokre | siki | czas ms | P(best) | E[delta] | trudność | underOcc |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 1 | 0 | 0 | 0 | 15000 | 0.500 | +4.00 | 2.00 | 0.00 |
| 5 | 5 | 2 | 1 | 0 | 0 | 13800 | 0.333 | +0.28 | 3.26 | 0.00 |
| 10 | 7 | 2 | 1 | 0 | 1 | 12300 | 0.250 | -2.73 | 4.88 | 0.47 |
| 13 | 9 | 3 | 1 | 0 | 1 | 11400 | 0.256 | -2.43 | 5.13 | 0.56 |
| 15 | 10 | 4 | 1 | 1 | 1 | 10800 | 0.250 | -2.67 | 5.56 | 0.71 |
| 20 | 12 | 4 | 1 | 0 | 2 | 9300 | 0.167 | -4.57 | 9.68 | 0.78 |
| 30 | 17 | 6 | 2 | 0 | 3 | 6300 | 0.111 | -6.13 | 21.43 | 0.80 |
| 40 | 18 | 6 | 2 | 0 | 3 | 3300 | 0.101 | -6.29 | 45.23 | 0.88 |

Cele: P(poz. 1) = 0.500 (≥ 0.4), P(poz. 30) = 0.111 (≤ 0.2), trudność niemalejąca na 1..60 (tolerancja 2%), `underOcc` ≥ 0.45 na poziomach 10–40 (cel ≥ 0.30), `people ≥ wet + pee + 1` na 10–40 — wszystko w `balance.test.ts` (rozszerzonym o poziomy 1..60, brak NaN, efekty pod lokatorem).

### Zmieniona stała
- `outOfOrderEvery` 20 -> 52. Przy 18 pisuarach każdy kolejny zepsuty pisuar zmniejsza liczbę wolnych (P(trafienia) rośnie 0.111 -> 0.125), więc przeszkoda ułatwiała grę, a trudność spadała o ~10% na poziomie 49 (test 1..60 czerwony). Teraz zepsuty pisuar jest jeden (od poz. 9) do poz. 60; wartości pośrednie (26) psuły monotoniczność już na poz. 35.
- Reszta stałych bez zmian (spełniają cele).

### Efekty a limit (poziom 10)
Na poz. 10 `effectCap = floor(2 osoby * 0.5) = 1` i cały limit zajmuje siki (mokra podłoga = 0; wet wraca na poz. 15–17 przy limicie 2, potem znika, bo siki zajmują cały limit: 2 na poz. 18–26, 3 od 27). Uznane za akceptowalne: siki to mocniejszy efekt (koszt 3 vs 1) i spec zakłada pee od poz. 10; mokre podłogi nadal pojawiają się przez chlapaczy (poz. 16+) i w poz. 6–9/15–17. Próba `effectShareOfPeople` 0.6 przywróciłaby wet wyżej, ale łamie testy budżetu (limit ≤ ludzie/2, spec rozdz. 6) — odrzucona. Jeśli granie pokaże, że brakuje mokrych podłóg wysoko, trzeba zmienić regułę limitu (nie stałą).

### Para wcześniej niż poz. 13?
Nie. Pierwszą parę blokuje reguła budżetu w `difficulty.ts` (`people ≥ 3` i ≥4 wolne po jej ustawieniu), a nie stała `unlock.pair`; zejście poniżej poz. 13 wymaga zmiany reguły (łagodniejsze progi łamały monotoniczność przy poz. 9/11 — zob. dziennik Task 7). Zgodne z specem (rozdz. 11).
