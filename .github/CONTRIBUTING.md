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

1. Läs `README.md` (för dig som utvecklar), `docs/utveckling/teknisk-plan.md` och
   arkitekturbesluten (ADR) i `docs/utveckling/arkitekturbeslut.md` — flera av dem är medvetna begränsningar som inte ska ändras
   utan ett nytt beslut.
2. Gör ändringen i `src/` (aldrig direkt i `dist/`), med test.
3. Kör `npm run build:app`, `npm run test:full`, `npm run lint`, `npm run bundle` och
   `npm run test:browser`. Allt ska vara grönt. Under arbetet räcker `npm test`, den snabba körningen (moduler och
   vakter, sekunder); `npm run test:full` är hela sviten med jsdom-testerna (minuter) och den som körs i CI. En
   testkörning räknas som grön först när alla testfiler har rapporterat (båda kör själva om en fil vars arbetare
   kraschat). Rör ändringen utseendet eller ett diagram:
   titta på resultatet i webbläsaren, också med ett underlag med många yrkesgrupper — demodatan har bara åtta.
   Varje ny utdata som lämnar verktyget (text, tabell, bild, fil) läggs i k-invariantsviten (`tests/helpers/ktroskel-rigg.js`) och i riskanalysens tabell över utdata innan den checkas in.
4. Beskriv ändringen och varför den behövs.

Verktyget är **neutralt**: det är skrivet för alla arbetsgivare och är inte kopplat till någon särskild
organisation. Skriv inga namn på organisationer, arbetsgivare eller lönesystem i kod, tester, exempel eller
dokument; skriv "organisationen" eller "arbetsgivaren", och använd påhittade, uppenbart syntetiska data. Det som är
organisationsspecifikt (benämningar, referenser, statistik) kommer från användarens egna filer, aldrig från repot.

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
  organisationsneutralt (ADR-28); ett test vakar över det.
- **Nätverksanrop, lagring i webbläsaren eller externa resurser** — verktyget ska fungera
  utan nätverk och spara ingenting (dataskyddet i den tekniska planen, §3, och arkitekturbesluten).

## Licens

Öppen lönekartläggning är licensierat under **MIT-licensen** (se `LICENSE`). Genom att lämna ett
bidrag godkänner du att det licensieras under samma villkor.
