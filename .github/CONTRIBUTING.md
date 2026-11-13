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

1. Läs `README.md` (för dig som utvecklar), skydden i `docs/utveckling/skydd.md`, `docs/utveckling/teknisk-plan.md`
   och arkitekturbesluten (ADR) i `docs/utveckling/arkitekturbeslut.md`. Skydden och flera av besluten är medvetna
   begränsningar som inte ska ändras utan ett nytt beslut.
2. Gör ändringen i `src/` (aldrig direkt i `dist/`), med test.
3. **Definition of Done.** En ändring är klar när:
   - `npm run kontroll` är grönt. Den kör i ordning `build:app`, `lint`, `typecheck`, `test:full` (hela sviten med
     jsdom-testerna, minuter, den som körs i CI), `bundle` och `test:browser`, prövar efter bygget att artefakten
     motsvarar källan och att teckenkodningen är ren, och stannar på första fel. Under arbetet räcker
     `npm run kontroll -- --snabb`, som kör `npm test` (moduler och vakter, sekunder) i stället för hela sviten och
     hoppar över röktestet i webbläsaren. En testkörning räknas som grön först när alla testfiler har rapporterat
     (`npm test` och `npm run test:full` kör själva om en fil vars arbetare kraschat).
   - Rör ändringen utseendet eller ett diagram: resultatet är sett i webbläsaren, också med ett underlag med många
     yrkesgrupper — demodatan har bara åtta.
   - Varje ny utdata som lämnar verktyget (text, tabell, bild, fil) läggs i k-invariantsviten
     (`tests/helpers/ktroskel-rigg.js`) och i riskanalysens tabell över utdata innan den checkas in.
   - Dokumenten, besluten (ADR) och regelmatrisen (`docs/utveckling/regler.md`) är uppdaterade när ändringen rör
     dem.
   - `CHANGELOG.md` har en rad om ändringen under *Oförlöst*.
   - Oanvänd kod är borttagen, inte utkommenterad.
   - Varje källfil bär licensraden (`SPDX-License-Identifier: MIT`).
4. Beskriv ändringen och varför den behövs.

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

Verktyget har inga inbyggda importprofiler för namngivna lönesystem: en profil som inte prövats mot ett
riktigt uttag skulle ge fel kolumner. Har er organisation en profil som fungerar mot ett lönesystems
uttag kan den bidras:

1. Exportera profilen (*Inställningar › Importprofiler › Exportera JSON*). Filen bär bara rubriknamn.
2. Öppna ett ärende eller ett ändringsförslag med filen och **vilket system och vilken version** uttaget
   kommer ur, och vilken rapport eller vilket uttag i systemet som ger filen. Skriv inte organisationens
   namn, och ta inte med någon del av själva uttaget.
3. Ge profilen ett namn efter uttaget, inte efter organisationen (t.ex. "Personallista ur lönesystemets
   statistikuttag").

En bidragen profil läggs in först när den är prövad mot ett uttag ur samma system och version, och märks med
varifrån den kommer (system och version, inte organisation).

## Det här checkas aldrig in

- **Verkliga löner eller personuppgifter** — inte heller "anonymiserade" utdrag. Använd
  demoläget eller `npm run gen:testdata`, som skapar påhittad data.
- **Organisationers referensdata och namn** — ställningstagande och statistik hör hemma i
  organisationens eget organisationspaket, inte i koden. Verktyget ska förbli
  organisationsneutralt (ADR-28). Ett test vakar över gränssnittets etiketter: `tests/sakerhet.test.js`
  (*inga hårdkodade etiketter*) prövar att etiketterna för organisationen och jämförelsestatistiken läser namnen
  ur användarens filer (`orgNamn`, `jmfNamn`) i stället för fasta texter. Att inga namn står i repot vaktas inte
  av något test; det granskas.
- **Nätverksanrop, lagring i webbläsaren eller externa resurser** — verktyget ska fungera
  utan nätverk och spara ingenting (skydden S1–S3 i `docs/utveckling/skydd.md`).

## Licens

Öppen lönekartläggning är licensierat under **MIT-licensen** (se `LICENSE`). Genom att lämna ett
bidrag godkänner du att det licensieras under samma villkor.
