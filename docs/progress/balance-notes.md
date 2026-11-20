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
