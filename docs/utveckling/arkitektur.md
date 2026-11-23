# Arkitekturen på en sida

Hur verktyget är uppbyggt, från filen till exporten, på en sida. Den som vill förstå helheten börjar här; detaljerna
står i de dokument som hänvisas till. Skydden går före, se [`skydd.md`](skydd.md), och principerna i
[`principer.md`](principer.md) binder hur lagren får användas.

Dokumentet beskriver den byggda koden. Där det skiljer sig från koden är det dokumentet som ska rättas.

## Lagren

| Lager | Var det bor | Ansvar |
|---|---|---|
| Sidan | `src/index.html`, `src/style.css` | Skalet, stilmallen och innehållspolicyn (CSP) som bygget gör till en fil. Sidan kör inget från nätet (S1). |
| Beräkningskärnan | `src/lib/` (50 moduler) | Rena ES-moduler utan DOM och utan tillstånd: statistik, modeller, regler och formatet för figurer. Kan köras i Node. |
| Appen | `src/app/NN-*.js` (85 delar) och `src/app/index.js` | ES-moduler som importerar det de använder, ur andra delar och ur lib under lib-namnen: tillstånd, inläsning, vyer, exporter. Det är här som lib anropas; bygget gör dem till ett klassiskt skript. Förteckningen står i [`src/app/README.md`](../../src/app/README.md). |
| Biblioteken | `vendor/` | D3, JSZip, PapaParse och SheetJS, låsta med kontrollsummor i `SHA256SUMS`. Licenserna står i `TREDJEPARTSLICENSER.md`. |
| Bygget | `tools/` | `build-app.mjs` bygger appen med esbuild, `bundle.mjs` bygger filen och `RELEASE.txt`, `kontroll.mjs` kör hela kedjan. Se [`bygge-och-test.md`](bygge-och-test.md). |
| Testerna | `tests/` | Vitest: enhetstester av `src/lib/`, appen per funktion i jsdom (`<område>-app.test.js`), invarianter för exporterna och vakter för dokument och skydd. Webbläsarröktestet ligger i `tools/browser-smoke/`. |
| Leveransen | `dist/`, `.github/workflows/` | `dist/` är det byggda verktyget, genererat och incheckat. CI kräver att ett nytt bygge blir byte-identiskt med det incheckade. |

Appen och kärnan är separerade i två steg: appen läser och visar, kärnan räknar. Mellan dem finns bara de tunna
adaptrarna, som hämtar tillståndet, anropar en funktion i lib och ger tillbaka resultatet.

## Dataflödet från fil till export

1. Filen läses i `src/app/32-filinlasning.js`: CSV eller XLSX, med kolumnmappningen och importprofilerna.
2. Varje rad går genom `extractMinimalRecord` i `src/app/06-uppgiftsminimering.js`, en tunn adapter till
   `minimeraRad` i `src/lib/inlasning.js`. Bara de godkända fälten (`TILLATNA_FALT`, också i `inlasning.js`) förs
   vidare; övriga kolumner tas inte med.
3. `tolkaLonerad` i `src/lib/inlasning.js` tolkar talen, könet och BAS-intervallet.
4. Raderna läggs i `state.data` (`src/app/12-tillstand.js`). Vyerna läser dem med `getData()`.
5. Vyerna räknar genom tunna adaptrar till lib. Två exempel:
   - `runOLSRegression` (`src/app/51-lika-arbete-regressionskort.js`) skickar tillståndet till `huvudregression` i
     `src/lib/regression.js`.
   - `computePrioritization` (`src/app/55-prioritering.js`) skickar tillståndet till `prioritera` i
     `src/lib/prioritering.js`.
6. Allt som lämnar verktyget går genom exportgrinden (`src/app/23-exportgrind.js`, med regeln `skaRitasForeExport` i
   `src/lib/exportgrind.js`). Grinden ser till att ingen export läser en flik som ritats med en annan tröskel än den
   som gäller nu. Exportläget räknar med den inställda minsta gruppstorleken (`kTroskel()`,
   `src/app/06-k-troskel.js`), och ett diagram lämnar bara om `exportTillaten` (`src/app/11-diagramexport.js`, med
   regeln `exportSkal` i `src/lib/figur.js`) säger ja. All export av tabeller och diagram går genom två funktioner,
   `_cloneAndCleanTableForExport` och `_chartExportUnderlag`, som frågar grinden först.

## Beräkningskärnans moduler

Tabellen är framtagen maskinellt ur de direkta importerna mellan filerna i `src/lib/`. Modulerna importerar inget
annat än varandra. `tests/lib-beroenden.test.js` vaktar att grafen är fri från cykler och att tabellen stämmer med
importerna: varje modul står i tabellen med just de moduler den importerar.

| Område | Modul | Importerar från `src/lib/` |
|---|---|---|
| Statistik | `stat` | – |
|  | `rng` | – |
|  | `osakerhet` | `aid`, `kon`, `likvardighet`, `regression`, `rng`, `stat`, `status`, `struktur` |
|  | `status` | `rng`, `stat`, `struktur` |
| Regression | `regression` | `kon`, `namn`, `stat`, `struktur`, `termer` |
|  | `gapuppdelning` | `falt`, `namn`, `termer`, `undertryckning` |
|  | `livscykel` | `kon`, `stat`, `status`, `termer` |
| Lika och likvärdigt arbete | `likvardighet` | `aid`, `kon`, `rng`, `stat`, `status` |
|  | `aidbas` | `aid`, `kon`, `likvardighet`, `stat` |
|  | `perbas` | `aid`, `jamforelse`, `kon`, `stat`, `termer`, `undertryckning` |
|  | `individflaggor` | `aid`, `falt` |
| Struktur och rapportmått | `struktur` | `kon`, `ktroskel`, `stat` |
|  | `sektor` | `aid`, `falt`, `namn`, `regression`, `skrreferens`, `stat`, `struktur`, `termer`, `undertryckning` |
| Referenser och jämförelse | `referens` | – |
|  | `referenser` | `lonepolitik` |
|  | `lonepolitik` | `aid`, `kon`, `stat` |
|  | `jamforelse` | `aid`, `kon`, `stat`, `termer` |
|  | `skrreferens` | `aid`, `skr-personal` |
|  | `skr-personal` | – |
| Simulering och prioritering | `prioritering` | `aid`, `kon`, `kostnad`, `stat`, `talformat` |
|  | `kostnad` | – |
|  | `loneoversyn` | `kon`, `kostnad`, `likvardighet`, `stat`, `struktur` |
| Klassificering | `aid` | `aid-etiketter`, `termer` |
|  | `aid-etiketter` | – |
|  | `aidkontroll` | `aid`, `stat`, `termer` |
|  | `ansvar` | `stat`, `struktur` |
| Indata och format | `inlasning` | `ansvar`, `importprofiler` |
|  | `falt` | `aid`, `kon`, `termer` |
|  | `kon` | – |
|  | `importprofiler` | – |
|  | `csv` | – |
|  | `talformat` | `stat` |
|  | `forhandskontroll` | `termer` |
|  | `datakvalitet` | `falt`, `forhandskontroll`, `kon`, `namn`, `stat`, `termer` |
|  | `organisationsfil` | – |
|  | `organisationspaket` | `importprofiler`, `installningsgranser`, `perbas`, `tabellrecept`, `termer` |
|  | `installningsgranser` | – |
|  | `konfiguration` | – |
| Skydd för små grupper | `undertryckning` | – |
|  | `exportgrind` | – |
|  | `ktroskel` | `aid`, `kon`, `namn` |
| Språk | `termer` | – |
|  | `namn` | `termer` |
|  | `htmltext` | – |
| Diagram, rapport och utforskning | `figur` | `kon`, `stat`, `talformat` |
|  | `docx` | `htmltext` |
|  | `rapportunderlag` | `aid`, `aidbas`, `gapuppdelning`, `jamforelse`, `kon`, `likvardighet`, `namn`, `sektor`, `skrreferens`, `stat`, `status`, `struktur`, `talformat`, `termer` |
|  | `arsbokslut` | `aid`, `kon`, `sakligaskal`, `stat`, `termer` |
|  | `tabellrecept` | `namn`, `termer`, `utforska` |
|  | `utforska` | `aid`, `falt`, `stat`, `termer`, `urval` |
|  | `urval` | `falt`, `termer` |
|  | `sakligaskal` | – |
|  | `attgora` | `namn`, `termer` |
| Demoläget | `demodata` | `ansvar`, `inlasning`, `kon`, `likvardighet`, `stat`, `struktur`, `talformat` |
| Vymodeller (ADR-99) | `vymodell-lika-arbete` | `aid`, `aidbas`, `ansvar`, `namn`, `osakerhet`, `rapportunderlag`, `skrreferens`, `struktur` |
|  | `vymodell-likvardigt-arbete` | `likvardighet`, `stat`, `talformat` |
|  | `vymodell-alder-karriar` | `aid`, `jamforelse`, `kon`, `ktroskel`, `osakerhet`, `stat`, `struktur`, `talformat`, `termer` |
|  | `vymodell-basdossier` | `aid`, `arsbokslut`, `kon`, `ktroskel`, `perbas`, `rapportunderlag`, `stat`, `struktur`, `vymodell-gruppdossier` |
|  | `vymodell-gruppdossier` | `aid`, `figur`, `jamforelse`, `kon`, `ktroskel`, `lonepolitik`, `osakerhet`, `prioritering`, `skrreferens`, `stat`, `struktur` |
|  | `vymodell-loneoversikt` | `aid`, `jamforelse`, `kon`, `stat` |
|  | `vymodell-lonestruktur` | `figur`, `kon`, `osakerhet`, `stat`, `status`, `struktur` |
|  | `vymodell-oversikt` | `aid`, `datakvalitet`, `jamforelse`, `kon`, `stat`, `struktur`, `vymodell-lonestruktur` |
|  | `vymodell-rapport` | `kon`, `ktroskel`, `rapportunderlag`, `status`, `struktur`, `tabellrecept`, `vymodell-basdossier`, `vymodell-lonestruktur` |
|  | `vymodell-rapportunderlag` | `aid`, `figur`, `gapuppdelning`, `kon`, `ktroskel`, `osakerhet`, `prioritering`, `rapportunderlag`, `sektor`, `struktur`, `tabellrecept` |
|  | `vymodell-var-uppstar-gapet` | `gapuppdelning`, `struktur` |
|  | `vymodell-regressionskort` | `kon`, `ktroskel`, `regression`, `stat`, `status` |
|  | `vymodell-livscykel` | `livscykel` |
|  | `vymodell-loneoversyn` | `aid`, `kon`, `ktroskel`, `likvardighet`, `loneoversyn`, `osakerhet`, `regression`, `stat` |
|  | `vymodell-lonepolitik` | `kon`, `ktroskel`, `lonepolitik` |

Tröskeln för små grupper bor i appen (`src/app/06-k-troskel.js`), och modulerna tar emot den som en parameter. Reglerna
för vad som får redovisas vid k (könen, § 3:10-paren, regressionens steg och BAS-effekter, punkterna per person,
stämpeln och noterna) står i `ktroskel`; adaptrarna i `06-k-troskel.js` behåller appens namn och skickar tröskeln.
Övriga moduler:
`prioritera` (`kTroskel`), `motiveringsgrunder` (`kInstalld`, `kTroskel`), `huvudregression` (`kInstalld`, `golv`), `gapPerBas` och `stegvisGap` (`golv`), `flaggaIndivider` (`minGrupp`), `avvikelsePerKonOchBas` (`k`, `minGrupp`), `konskvotPerGrupp` (`k`), `lonepolitikModell` och `maskeringsniva` (`k`) och `loneoversyn` (den gällande tröskeln). Lägena och
vad som räknas med vilken tröskel står i [`k-troskeln.md`](k-troskeln.md). Modulen `undertryckning` har de två
reglerna för vad som döljs eller räknas samman utöver de små grupperna själva: kompletterande undertryckning (ADR-83) och
sammanslagning av delar där ett kön är för litet (ADR-87).

Termerna ligger i `termer`; `namn` formar namnen på organisationen och ordformerna, och `htmltext` gör HTML till vanlig
text. Språket i det användaren läser prövas av de vakter som nämns i [`principer.md`](principer.md) (princip 6).

## Tre regler som håller ihop arkitekturen

1. **Lib rör varken DOM eller tillstånd.** Modulerna i `src/lib/` läser inte `document`, `window`, lagring eller appens
   tillstånd, och de får inte importera något utanför `src/lib/`. Vakt: `tests/lib-beroenden.test.js`. Det gör att
   samma funktion kan köras i Node och i appen, som importerar den (ADR-98).
2. **`dist/` är genererad och redigeras aldrig för hand.** Ändra `src/lib/` eller `src/app/` och kör
   `npm run build:app`. Vakt: artefaktgrinden, som kräver att ett nytt bygge ger byte-identiska `dist/` och
   `src/app/08-version.js` (`tools/kontroll.mjs` och `.github/workflows/ci.yml`).
3. **Allt som lämnar verktyget prövas mot minsta gruppstorlek.** Det gäller text, tabeller, bilder och filer. Regeln
   och undantagen står i [`k-troskeln.md`](k-troskeln.md), skyddet i [`skydd.md`](skydd.md) (S4). Vakten är
   invarianten I4 i `tests/helpers/ktroskel-invariant.js`, som ritar flikarna i exportläget och bygger exporterna
   vid tröskeln 10 och 25 (`tests/ktroskel-invarianter.test.js`, `tests/ktroskel-invarianter-25.test.js`).

## Var det beskrivs i detalj

- Appens delar, en rad per fil: [`src/app/README.md`](../../src/app/README.md).
- Bygget, testsviten, typkontrollen, linten, CI och releasen: [`bygge-och-test.md`](bygge-och-test.md).
- Varför det är så här: [`arkitekturbeslut.md`](arkitekturbeslut.md). Det är där de numrerade besluten (ADR) står.
- Beräkningarnas formler: [`regressionsmodellen.md`](regressionsmodellen.md),
  [`likvardighetsmodellen.md`](likvardighetsmodellen.md) och [`k-troskeln.md`](k-troskeln.md).
- Hur man kommer igång som utvecklare eller granskare: [`kom-igang.md`](kom-igang.md).
