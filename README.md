# Öppen lönekartläggning

Ett fritt verktyg för den årliga **lönekartläggningen** enligt diskrimineringslagen och EU:s
lönetransparensdirektiv (2023/970) — byggt för HR i kommuner, regioner och andra
arbetsgivare. Hela verktyget är **en enda HTML-fil** som körs i webbläsaren på din dator:
ingen server, inga nätverksanrop och ingen lagring. **Lönedata lämnar aldrig datorn.**

- **Hela lagkedjan:** genomgång av bestämmelser och praxis, lika arbete (med regression och
  oförklarat gap), likvärdigt arbete, EU-direktivets rapportmått, prioritering med
  kostnadsberäkning och handlingsplan.
- **Färdiga underlag:** ett redigerbart Word-utkast av dokumentationen (rapporten), en Excel-fil med
  underlaget, en PDF som låst kopia, en ZIP-fil med allt, protokoll för gemensam lönebedömning och
  rapportunderlag att klistra in i er egen mall.
- **Dataskydd inbyggt:** bara de fält analysen behöver läses in (fem obligatoriska, två
  valfria), filer med personnummer, namn eller e-post avvisas, små grupper skyddas, och en risk- och sårbarhetsanalys ingår som underlag till er konsekvensbedömning.

## Prova

Öppna verktyget och klicka **Prova med demodata** — allt fungerar med påhittad data, utan
verkliga löner och utan installation.

## Kom igång

1. **Ladda ner** `oppen-lonekartlaggning.html` från den senaste versionen under
   [Releases](https://github.com/janssonfelix/oppen-lonekartlaggning/releases) och **verifiera
   signaturen** innan verklig lönedata läses in — kommandot står i [`SECURITY.md`](SECURITY.md),
   avsnittet *Kontrollera att filen är äkta*. Öppna filen i webbläsaren (Chrome, Edge, Firefox
   eller Safari) på en dator.
2. **Läs in er organisations paket** — ställningstagande, jämförelsestatistik och benämningar i
   en fil som er systemägare tar fram i verktyget — eller öppna **organisationsfilen**, där
   systemägaren bakat in paketet så att en fil räcker:
   [`organisationspaket.md`](docs/anvandare/organisationspaket.md).
3. **Läs in lönefilen** och följ körguiden:
   [`korguide.md`](docs/anvandare/korguide.md) och [`datauttag.md`](docs/anvandare/datauttag.md).

Mer: [sammanfattning för HR-chefer](docs/anvandare/sammanfattning-hr-chefer.md) ·
[pilotchecklista](docs/anvandare/pilotchecklista.md) ·
[dataskyddsbeskrivning](docs/dataskydd/dataskydd.md) ·
[risk- och sårbarhetsanalys](docs/dataskydd/riskanalys.md) ·
[lagrumshänvisningar](docs/utveckling/lagrum.md)

Verktyget ger **underlag**, inte juridiska bedömningar: bedömningen av sakliga skäl och den
slutliga dokumentationen görs av arbetsgivaren i samverkan med facklig part.

## Licens och bidrag

Öppen lönekartläggning är öppen källkod under **MIT-licensen** (se `LICENSE`). Upphovsperson:
Felix Jansson. Tredjepartsbibliotekens licenser står i [`LICENSES.md`](LICENSES.md) och
följer med i den byggda filen.

Vill du bidra, läs [`CONTRIBUTING.md`](CONTRIBUTING.md). Säkerhetsbrister rapporteras enligt
[`SECURITY.md`](SECURITY.md).

## Mappstruktur

| Mapp | Innehåll |
|---|---|
| `src/` | Källan: `index.html`, `style.css`, `app/` (appens moduler i byggordning) och `lib/` (rena, testade moduler som speglas in i appen) |
| `vendor/` | Tredjepartsbibliotek: D3, SheetJS, PapaParse, JSZip (licenser i [`LICENSES.md`](LICENSES.md); de fullständiga texterna i `src/licenser.txt` byggs in i HTML-filen) |
| `dist/` | Genererat och incheckat: `app.js`, `oppen-lonekartlaggning.html`, `RELEASE.txt`. Redigeras aldrig för hand |
| `docs/anvandare/` | Dokument som följer med verktyget |
| `docs/dataskydd/` | Dataskyddsbeskrivning och risk- och sårbarhetsanalys |
| `docs/utveckling/` | [`teknisk-plan.md`](docs/utveckling/teknisk-plan.md): syfte, avgränsning, arkitekturbeslut (ADR) och öppna punkter; [`lagrum.md`](docs/utveckling/lagrum.md): lagrumshänvisningarna; [`diagramkarnan.md`](docs/utveckling/diagramkarnan.md): diagramkärnan; [`organisationsfil-design.md`](docs/utveckling/organisationsfil-design.md): organisationsfilen |
| `tests/` | Vitest-sviten (enhetstester, röktester i jsdom, golden-facit, k-anonymitet, tillgänglighet) |
| `tools/` | Bygge, speglingsgenerator, röktest i webbläsare, prestandamätning och testdatageneratorer. `tools/data/` håller lokala indata och är inte incheckad |

Källmodulerna i `src/app/` beskrivs i [`src/app/README.md`](src/app/README.md).

## För dig som utvecklar

Kräver Node 22.12 eller senare.

```bash
npm ci                 # installera utvecklingsberoenden
npm run build:app      # slå ihop src/app/ till dist/app.js (och spegla src/lib/)
npm test               # hela Vitest-sviten (tools/test.mjs kör om en fil vars arbetare kraschat i Node)
npm run lint           # eslint
npm run typecheck      # JSDoc-typkontroll med tsc (checkJs): typecheck:lib för src/lib och tools, typecheck:app för src/app
npm run bundle         # bygg dist/oppen-lonekartlaggning.html och dist/RELEASE.txt
npm run test:browser   # röktest av det byggda verktyget i Chromium (kör bundle först)
npm run test:browser:firefox   # samma röktest i Firefox (WebKit: test:browser:webkit, eller
                               # test:browser:webkit:behallare som kör det i en behållare med podman)
npm run perf           # prestandamätning på 55 000 rader (kör bundle först)
npm run site           # demosidan i site/dist/ (kör bundle först)
```

`src/index.html` är källan till bygget och går inte att köra direkt i webbläsaren: dess
innehållssäkerhetspolicy (CSP) tillåter inga externa filer, så stilmallen, biblioteken i
`vendor/` och `dist/app.js` blockeras. Kör `npm run bundle` och öppna
`dist/oppen-lonekartlaggning.html` för att se en ändring.

Versionen står i `VERSION` (CalVer, `ÅÅÅÅ.MM.DD`) och ändringar dokumenteras i
[`CHANGELOG.md`](CHANGELOG.md).

### Släppa en version

1. Granska `docs/dataskydd/riskanalys.md` och `docs/dataskydd/dataskydd.md` mot koden och sätt
   granskningsdatumet (teknisk-plan.md §9 punkt 17b).
2. Sätt versionen i `VERSION` och `package.json`, och byt rubriken *Oförlöst* i `CHANGELOG.md` mot versionen.
3. `npm run build:app && npm run bundle`; för in byggets kontrollsumma och version på rad 3 i riskanalysen.
4. Checka in och kör `npm run release:kontroll` (`tools/release.mjs`). Grinden kontrollerar att versionen
   står lika överallt, att riskanalysen är granskad efter senaste kodändringen och att arbetskatalogen är ren,
   och skriver ut taggkommandot.
5. Pusha taggen `v<VERSION>`. Arbetsflödet `.github/workflows/release.yml` kör grinden igen, bygger om,
   signerar med Sigstore cosign och publicerar en GitHub Release (verifieringen står i `SECURITY.md`).
   Samma tagg publicerar demosidan på GitHub Pages (`.github/workflows/pages.yml`; går också att köra för hand).

Ärenden skrivs med mallarna i `.github/ISSUE_TEMPLATE/` (fel och förslag) och får aldrig innehålla verklig
lönedata.

## Namngivning

- Filnamn skrivs med gemener och bindestreck, utan å, ä och ö.
- Levande dokument har inget datum eller versionsnummer i filnamnet; versionen står i
  dokumentet.
- Modulerna i `src/app/` har ett tvåsiffrigt prefix som styr ordningen när de slås ihop.
