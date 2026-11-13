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

## Var uppgifterna står

Varje uppgift som flera filer behöver skrivs på **ett** ställe, källan. Andra filer hänvisar till källan eller
härleds ur den av ett verktyg; de skriver inte av den. Varje sak prövas av **en** kontroll:

- det som ska gälla i varje commit prövas av testsviten eller av en grind i CI (`.github/workflows/ci.yml`), aldrig
  av båda;
- det som bara gäller vid en release prövas av release-grinden (`npm run release:kontroll`, `tools/release.mjs`);
- genererade filer vaktas genom att de byggs om och jämförs med den incheckade filen; innehållet i dem prövas inte
  en gång till.

| Uppgift | Källa (uppdateras här) | Hänvisar eller härleds | Kontroll |
|---|---|---|---|
| Version | `VERSION` | `package.json` (sätts samtidigt, npm kräver fältet); `src/app/08-version.js` (`npm run build:app`); `dist/` och programvaruförteckningen (bygget) | `tests/version.test.js` |
| Ändringslogg | `CHANGELOG.md`, rubriken *Oförlöst* överst | releasens text | ordningen: `tests/dokumentation.test.js`; versionen överst vid release: release-grinden |
| Artefakten och dess kontrollsumma | `dist/oppen-lonekartlaggning.html` och `dist/RELEASE.txt` (`npm run bundle`) | demosidan, SBOM | artefaktgrinden i CI: en färsk build ska ge samma `dist/` |
| Det granskade bygget och granskningsdatumen | rad 3–4 i `docs/dataskydd/riskanalys.md`; *Granskad mot koden* i `docs/dataskydd/dataskydd.md` | förs in vid release (README, *Släppa en version*); teknisk-plan §9 punkt 17b hänvisar | release-grinden |
| Kommandona för kontrollsumman | `VERIFIERING` i `tools/release.mjs` | `RELEASE.txt` (bygget), `SECURITY.md`, körguiden §0 | `tests/release.test.js` |
| k-tröskelns standardvärde | `K_STANDARD` i `src/app/06-k-anonymitet-och-dataminimering.js` | dokumenten skriver talet | `tests/dokumentation.test.js` |
| Bibliotekens versioner och kontrollsummor | filerna i `vendor/` och `vendor/SHA256SUMS` | `src/licenser.txt`, *Om verktyget*, `TREDJEPARTSLICENSER.md`, SBOM | `tests/sakerhet.test.js` |
| Arkitekturbesluten | `docs/utveckling/arkitekturbeslut.md` (besluten och indextabellen) | kod, tester och dokument anger numret | `tests/dokumentation.test.js` |
| Lagrummen | `docs/utveckling/lagrum.md` | övriga dokument anger kapitel | `tests/dokumentation.test.js` |
| Öppna punkter | `docs/utveckling/teknisk-plan.md` §9 | anges med nummer | — |
| Repots mappar | `README.md` | teknisk-plan §6 hänvisar | — |
| Appens moduler | `src/app/README.md` | | `tests/dokumentation.test.js` |
| Dokumenten | `docs/README.md` | teknisk-plan §6 hänvisar | — |
| CI-jobben och stegen | `.github/workflows/ci.yml` (kommentarerna) | teknisk-plan §6 sammanfattar och hänvisar | — |
| Hur en version släpps | `README.md`, *Släppa en version* | | — |
| Vad release-grinden prövar | huvudet i `tools/release.mjs` | README, teknisk-plan och `release.yml` hänvisar | `tests/release.test.js` |
| Regeln för ny utdata | punkt 3 i *Ändringsförslag i koden* ovan | teknisk-plan K7 hänvisar | — |

En ny uppgift som flera filer behöver läggs in i tabellen med sin källa och sin kontroll.

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
