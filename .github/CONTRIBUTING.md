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

1. Läs `README.md` (för dig som utvecklar), skydden i `docs/utveckling/skydd.md` och principerna i
   `docs/utveckling/principer.md`, och referensen för det område du ändrar (`docs/README.md` listar dem). Skydden
   går före allt annat och ändras bara genom ett eget beslut (`GOVERNANCE.md`).
2. Gör ändringen i `src/` (aldrig direkt i `dist/`), med test. Oanvänd kod tas bort, inte utkommenteras.
3. **Definition of Done.** En ändring är klar när:
   - `npm run kontroll` är grönt: bygget, linten, typkontrollen, hela testsviten, artefakten och röktestet i
     webbläsaren, i CI:s ordning. Under arbetet räcker `npm run kontroll -- --snabb` (`npm test` i stället för hela
     sviten, inget röktest). En testkörning är grön först när alla testfiler har rapporterat.
   - Varje ny utdata som lämnar verktyget (text, tabell, bild, fil) ligger i k-riggen
     (`tests/helpers/ktroskel-rigg.js`) och i riskanalysens tabell över utdata.
   - Det som syns är sett i webbläsaren, och ett diagram också med ett underlag med många yrkesgrupper —
     demodatan har bara åtta.
4. Beskriv ändringen och varför den behövs.

Varje uppgift som flera filer behöver står på ett ställe; andra filer hänvisar dit eller härleds ur det och skriver
inte av det (princip 4 i `docs/utveckling/principer.md`).

Verktyget är **neutralt**: det är skrivet för alla arbetsgivare och är inte kopplat till någon särskild
organisation. Skriv inga namn på organisationer, arbetsgivare eller lönesystem i kod, tester, exempel eller
dokument; skriv "organisationen" eller "arbetsgivaren", och använd påhittade, uppenbart syntetiska data. Det som är
organisationsspecifikt (benämningar, referenser, statistik) kommer från användarens egna filer, aldrig från repot.
Tre undantag:

- **Lönesystem** får namnges i uttagsguiden (`docs/anvandare/datauttag.md`) och där den citeras, som system —
  aldrig som någons kund eller arbetsgivare.
- **Källan till jämförelsestatistiken** får namnges som källa.
- **Demodatan** har en påhittad organisation.

## Bidra med en importprofil

Verktyget har inga inbyggda profiler för namngivna lönesystem: en profil som inte prövats mot ett riktigt uttag
skulle ge fel kolumner. Exportera er profil (*Inställningar › Importprofiler › Exportera JSON*; filen bär bara
rubriknamn) och skicka den i ett ärende med **vilket system, vilken version och vilket uttag** den gäller, utan
organisationens namn och utan något ur själva uttaget. Den läggs in när den är prövad mot samma system och version,
och heter efter uttaget, inte efter organisationen.

## Det här checkas aldrig in

- **Verkliga löner eller personuppgifter** — inte heller "anonymiserade" utdrag. Använd
  demoläget eller `npm run gen:testdata`, som skapar påhittad data.
- **Organisationers referensdata och namn** — ställningstagande och statistik hör hemma i
  organisationens eget organisationspaket, inte i koden (skyddet S5, ADR-28).
- **Nätverksanrop, lagring i webbläsaren eller externa resurser** — verktyget ska fungera
  utan nätverk och spara ingenting (skydden S1–S3 i `docs/utveckling/skydd.md`).

## Licens

Öppen lönekartläggning är licensierat under **MIT-licensen** (se `LICENSE`). Genom att lämna ett
bidrag godkänner du att det licensieras under samma villkor. Varje källfil bär licensraden
(`SPDX-License-Identifier: MIT`).
