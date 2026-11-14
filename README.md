# Öppen lönekartläggning

Ett fritt verktyg för den årliga **lönekartläggningen** enligt diskrimineringslagen, med stöd för delar av
lönetransparensdirektivet. Hela verktyget är **en enda HTML-fil** som körs i webbläsaren på din dator: ingen server,
inga nätverksanrop och ingen lagring. **Lönedata lämnar aldrig datorn.**

## Status: ett proof of concept

- **All kod, alla tester och all dokumentation är skrivna med AI-verktyg**, styrda och granskade av en person.
- **Verktyget är ett proof of concept, inte en färdig produkt.** Statistiken är inte granskad av en statistiker, och
  texterna om lag och dataskydd är inte granskade av jurist eller dataskyddsombud. Verktyget är ännu inte prövat med
  verklig lönedata hos en arbetsgivare; checklistan för skarp data finns för den som gör det först.

## Vad det gör

Lika och likvärdigt arbete, regression och oförklarad löneskillnad, direktivets rapportmått, löneläget och
handlingsplan, med ett redigerbart Word-utkast av dokumentationen, Excel och PDF. Bara de fält analysen behöver läses
in (fyra obligatoriska, tre valfria), och små grupper skyddas i det som lämnar verktyget. Verktyget är byggt för
arbetsgivare som kodar befattningarna med **AID** och **BAS-intervall** och jämför sig med **SKR:s**
personalstatistik, i praktiken kommuner och regioner. Det organisationsspecifika läses in ur ett organisationspaket;
ingenting om en viss organisation är inbyggt.

## Prova

Öppna verktyget och klicka **Prova med demodata**: allt fungerar med påhittad data, utan installation.

## Kom igång

1. **Ladda ner** `oppen-lonekartlaggning.html` under [Releases](https://github.com/janssonfelix/oppen-lonekartlaggning/releases)
   och **verifiera signaturen** innan du läser in verklig lönedata ([`SECURITY.md`](SECURITY.md), *Kontrollera att
   filen är äkta*). Öppna filen i Chrome, Edge, Firefox eller Safari på en dator.
2. **Läs in organisationens paket**, eller öppna **organisationsfilen** där paketet är inbakat
   ([`organisationspaket.md`](docs/anvandare/organisationspaket.md)).
3. **Läs in lönefilen** och följ [`korguide.md`](docs/anvandare/korguide.md) och
   [`datauttag.md`](docs/anvandare/datauttag.md). Dokumenten för den som inför verktyget: [`docs/README.md`](docs/README.md).

## Ansvar och roller

Verktyget tillhandahålls fritt, utan avgift, support eller drift, av en privatperson utanför kommersiell verksamhet.

- **Användarens ansvar.** Verktyget är ett stöd för arbetsgivarens egen lönekartläggning. Användaren ansvarar för hur
  verktyget används, för tolkningen av resultaten och för den juridiska bedömningen. Verktyget är inte juridiskt
  granskat. Verktyget ger underlag; bedömningen av sakliga skäl görs av arbetsgivaren i samverkan med facklig part.
- **Arbetsgivaren är ensam personuppgiftsansvarig.** Ingen uppgift når upphovspersonen eller någon annan, och inget
  personuppgiftsbiträde finns ([`sakerhetsbeskrivning.md`](docs/anvandare/sakerhetsbeskrivning.md)).
- **EU:s cyberresiliensakt och produktansvarsdirektiv** undantar fri programvara som tillhandahålls utanför
  kommersiell verksamhet. Den som säljer verktyget, drift eller support bär tillverkarens skyldigheter för sin
  produkt ([`overta-verktyget.md`](docs/anvandare/overta-verktyget.md)).
- **Verktyget är inte ett AI-system** i AI-förordningens mening: beräkningarna är fasta, dokumenterade formler, inget
  lärs in och inga beslut om enskilda fattas. Att verktyget är skrivet med AI-verktyg ändrar inte det.
- **Lagrumshänvisningarna** i [`lagrum.md`](docs/utveckling/lagrum.md) har status *Förslag* tills jurist och
  dataskyddsombud har stämt av dem; där står också artiklarna bakom punkterna ovan.

## Repot

| Mapp | Innehåll |
|---|---|
| `src/` | Källan: sidan, stilmallen, appens moduler (`app/`, se [`src/app/README.md`](src/app/README.md)) och de rena beräkningsmodulerna (`lib/`) |
| `dist/` | Det byggda verktyget, genererat ur `src/` och incheckat; redigeras aldrig för hand |
| `vendor/` | Tredjepartsbiblioteken, låsta med kontrollsummor ([`TREDJEPARTSLICENSER.md`](TREDJEPARTSLICENSER.md)) |
| `tests/` | Testsviten (Vitest) |
| `tools/` | Bygge, röktest i webbläsare, release och testdata |
| `types/`, `site/` | Deklarationerna för typkontrollen; demosidan |
| `docs/` | Dokumentationen, efter läsare: [`docs/README.md`](docs/README.md) |
| `.github/` | CI, release, ärendemallar, bidragsregler och styrning |

## För dig som utvecklar

Kräver Node 22.12 eller senare. `npm ci` installerar, `npm run kontroll` kör hela kedjan i CI:s ordning och
`npm run bundle` bygger verktyget. När en ändring är klar står i *Definition of Done* i
[`CONTRIBUTING.md`](.github/CONTRIBUTING.md). Övriga kommandon, testerna, CI och hur en version släpps står i
[`bygge-och-test.md`](docs/utveckling/bygge-och-test.md).

## Licens och bidrag

Öppen källkod under **MIT-licensen** (`LICENSE`). Upphovsperson: Felix Jansson. Tredjepartsbibliotekens licenser
står i [`TREDJEPARTSLICENSER.md`](TREDJEPARTSLICENSER.md) och följer med i den byggda filen. Bidrag enligt
[`CONTRIBUTING.md`](.github/CONTRIBUTING.md) och [`CODE_OF_CONDUCT.md`](.github/CODE_OF_CONDUCT.md), säkerhetsbrister
enligt [`SECURITY.md`](SECURITY.md); styrningen står i [`GOVERNANCE.md`](.github/GOVERNANCE.md).
