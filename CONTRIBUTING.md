# Bidra till Öppen lönekartläggning

Tack för att du vill bidra! Öppen lönekartläggning är ett verktyg för offentliga och privata
arbetsgivares lönekartläggning. Det viktigaste med verktyget är att **lönedata aldrig lämnar
datorn** — det styr hur vi tar emot bidrag.

## Ärenden och förslag

- **Fel och förbättringsförslag:** öppna ett ärende. Beskriv vad du gjorde, vad du förväntade
  dig och vad som hände. Ange version (står i `RELEASE.txt` och i fliken Om verktyget) och
  webbläsare.
- **Säkerhetsbrister** (t.ex. att lönedata kan lämna datorn eller att en fil kan köra kod):
  rapportera dem **inte** som öppna ärenden — se `SECURITY.md`.
- **Frågor om lagstiftningen** besvaras inte av projektet; verktyget ger underlag, inte
  juridisk rådgivning.

## Ändringsförslag i koden

1. Läs `README.md` (för dig som utvecklar) och `docs/utveckling/teknisk-plan.md`, särskilt
   arkitekturbesluten (ADR) — flera av dem är medvetna begränsningar som inte ska ändras
   utan ett nytt beslut.
2. Gör ändringen i `src/` (aldrig direkt i `dist/`), med test.
3. Kör `npm run build:app`, `npm test`, `npm run lint`, `npm run bundle` och
   `npm run test:browser`. Allt ska vara grönt. En testkörning räknas som grön först när alla testfiler har
   rapporterat (`npm test` kör själv om en fil vars arbetare kraschat). Rör ändringen utseendet eller ett diagram:
   titta på resultatet i webbläsaren, också med ett underlag med många yrkesgrupper — demodatan har bara åtta.
4. Beskriv ändringen och varför den behövs.

## Det här checkas aldrig in

- **Verkliga löner eller personuppgifter** — inte heller "anonymiserade" utdrag. Använd
  demoläget eller `npm run gen:testdata`, som skapar påhittad data.
- **Organisationers referensdata och namn** — ställningstagande och statistik hör hemma i
  organisationens eget organisationspaket, inte i koden. Verktyget ska förbli
  organisationsneutralt (ADR-28); ett test vakar över det.
- **Nätverksanrop, lagring i webbläsaren eller externa resurser** — verktyget ska fungera
  utan nätverk och spara ingenting (ADR om dataskydd i den tekniska planen).

## Licens

Öppen lönekartläggning är licensierat under **MIT-licensen** (se `LICENSE`). Genom att lämna ett
bidrag godkänner du att det licensieras under samma villkor.
