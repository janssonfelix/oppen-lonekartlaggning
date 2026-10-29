# teknisk-plan.md — Öppen lönekartläggning: Mål, syfte och plan

> Detta dokument är den kanoniska beskrivningen av *vad* verktyget ska vara och varför
> (arkitekturbeslut i §8, öppna punkter i §9). Lagrumshänvisningarna samlas i
> [`lagrum.md`](lagrum.md); diagramkärnan beskrivs i [`diagramkarnan.md`](diagramkarnan.md).

---

## 1. Syfte (varför verktyget finns)

Öppen lönekartläggning är ett **klientsidigt analysverktyg** som stödjer
arbetsgivarens **årliga lönekartläggning** enligt **diskrimineringslagen
3 kap.** (aktiva åtgärder om lönefrågor; paragraferna i [`lagrum.md`](lagrum.md)) och
utvalda delar av **EU:s lönetransparensdirektiv 2023/970**. Direktivet skulle vara infört i
svensk rätt 7 juni 2026 (svensk lag och ikraftträdande dateras när de är kända); lönerapporteringen (art. 9) införs stegvis från 2027,
först för arbetsgivare med minst 250 arbetstagare.

Verktyget besvarar frågan **"vilka grupper ska vi arbeta vidare med?"** —
det identifierar, kvantifierar och prioriterar löneskillnader som kan kräva
utredning. Det är ett *underlag*, inte ett slutdokument.

Primär målgrupp: HR-handläggare, ledning, fackliga
representanter (JPA-samråd) och dataskyddsombud.

---

## 2. Avgränsning (vad verktyget medvetet INTE gör — "Mål 1")

Detta är en bärande designprincip, inte en begränsning av misstag:

- **Producerar inte** det färdiga, beslutade slutdokumentet. Verktyget genererar
  ett *utkast* till lönekartläggningens dokumentation (redigerbar .docx, ADR-37) där de kvalitativa
  bedömningarna står som `[HR fyller i]`-fält. Arbetsgivaren färdigställer
  dokumentet i sin egen mall. Verktyget hjälper med *vilka grupper*, inte med
  *hur bedömningen formuleras*.
- **Dokumenterar inte** sakliga skäl per grupp internt — den
  bedömningen görs och dokumenteras i HR:s ordinarie verktyg.
- **Hanterar inte** anställds informationsrätt (EU 2023/970 Art. 7) — sköts
  i separat process hos arbetsgivaren. *Får inte återinföras i verktyget.*
- **Hanterar inte** könsneutral lönesättningspolicy (Art. 5) eller statlig
  myndighetsrapportering (Art. 9) — dessa är input/separat process.
- **Använder inte** AI/LLM. All statistik är klassiska metoder med
  spårbara, dokumenterade formler.
- **Sparar inte** data mellan sessioner.
- Ingen flerårsuppföljning: verktyget stödjer en kartläggning; historiska filer skulle lägga fler
  personuppgifter i minnet och förutsätter stabila BAS-strukturer. Flerårsjämförelser görs i
  arbetsgivarens egna system. *Får inte införas utan nytt beslut.*
- Kolumnen Ansvar läses inte in och inget enhetsmått beräknas.
- **Analyserar inte** rörliga eller kompletterande lönedelar (tillägg, bonus, förmåner).
  Verktyget har en lönedefinition — heltidsomräknad månadslön — och EU-rapportens mått
  redovisas för den. *Rörlig lön är inte aktuellt i verktyget.*
- **Sparar inte** vyer eller urval. Utforskas uppställningar (rader, kolumner, mått,
  diagramtyp, urval) sparas inte som recept och kan inte läggas in i
  utskriftsrapporten; det som ska bevaras exporteras via diagrammens exportmeny.
  *Kommer inte att byggas.*
- **Stödjer inte** mobil- eller surfplattebredd. Verktyget är ett skrivbordsverktyg för
  HR; vid smala fönster (under ungefär 768 px) fälls sidomenyn inte ihop. *En mobilvy är inte aktuell.*

**Designmotiv:** genom att avgränsa till analys + datastrukturering kan
verktyget leverera värde över flera år utan att behöva uppdateras varje
gång rapporteringsformat ändras hos DO, Medlingsinstitutet eller EU.

---

## 3. Dataskydd — Privacy by Design (GDPR Art. 25)

Icke förhandlingsbara arkitektoniska garantier:

1. **Single-file HTML, körs lokalt.** Ingen server, ingen molntjänst.
2. **CSP `connect-src 'none'`** — webbläsaren blockerar all utgående
   trafik. Hård teknisk barriär mot exfiltrering, inte ett löfte.
3. **Ingen persistent lagring.** Varken verktygets kod eller de inbyggda biblioteken
   skriver till lagringen. Som reserv kastar en *storage-tripwire* fel när
   `localStorage.setItem` eller `sessionStorage.setItem` anropas eller `document.cookie`
   sätts. Spärren har inga undantag: varje `setItem` kastar, oavsett nyckel och anropare. Den är ändå en
   snubbeltråd mot misstag. Också direkt egenskapstilldelning fångas (`localStorage.x = …`): fönstrets två
   lagringsobjekt är utbytta mot ombud som kastar vid varje tilldelning. Kvar utanför spärren är IndexedDB och
   Cache API, som ingen kod använder och som CSP och kodgranskning täcker.
4. **k-anonymitet** (K_STANDARD = 10; användaren kan ändra värdet, ADR-38): grupper med för få
   individer redovisas inte i det som lämnar verktyget, för att förhindra återidentifiering; på skärmen
   visas alla grupper (ADR-51), och det som står nedan om vad som visas gäller exportläget. Ett värde under 10 kräver
   bekräftelse, visas med stående varning och står i metodbilagan, i exporterad data och — under 10 — på varje
   del som kan spridas för sig (diagrambilder, tabeller i urklipp, sidfötter, utskrift, rapportunderlag).
   Redovisningsformen är tvådelad (ADR-12):
   - **Hela gruppen under tröskeln** → raden utelämnas och gruppen räknas upp
     *med namn* i en not vid tabellen.
   - **Bara könsuppdelningen för liten**, medan gruppen som helhet ligger över
     tröskeln → gruppens *samlade* median redovisas, utan könsjämförelse. Regeln gäller
     de beskrivande könsuppdelade lönemåtten (ett köns median eller percentil, det råa
     lönegapet, regressionens ojusterade steg "Endast kön" med den förklarade andelen, en
     kostnad som räknats ur ett gap), per grupp och för hela organisationen: de redovisas bara
     när varje kön når tröskeln (`_konFarRedovisas`).
     Regressionens justerade gap visas från regressionens eget fasta golv, 5 per kön (ADR-38);
     övriga skattningar har fasta eller statistiska golv (ADR-38). I Ålder & karriär följer
     lönegapen, lutningen, trendlinjerna och lådorna per kön regeln; en persons punkt ritas bara
     när personens grupp och kön i gruppen når tröskeln (ADR-14).
   - **Undantag:** likvärdighetsanalysen tillämpar *inte* k-anonymitet (resultatet
     är aggregerat per yrkesgrupp; uttryckligt beslut från användaren).
     Antalet små grupper som ändå ingår redovisas i analysens diagnostik.
   - **Undantag 2 (ADR-14):** Utforska-fliken visar grupper under tröskeln, som alla
     flikar (ADR-51). Skyddet gäller det som lämnar verktyget: tabellens CSV/urklipp och
     diagrammets exportmeny utelämnar grupperna om inte användaren kryssar i "Ta med grupper
     under tröskeln i exporten" — rutan är undantaget. K-invarianten vaktar exporten.
   - **Vakt:** `tests/kanonymitet.test.js` är en *invariant*, inte stickprov —
     den renderar samtliga flikar mot ett dataset där varje liten grupps
     mätvärden är unika sentinelvärden och hävdar att inget av dem syns.

---

## 4. Funktionsmål (vad verktyget ska kunna)

| Område | Lagrum | Funktion |
|---|---|---|
| Kartläggning lika arbete | lika arbete (lagrum.md) | EU-Lönekartläggning: median-jämförelse kön inom yrkesgrupp + per-BAS-regression (oförklarat gap, ålderskontroll, HC3-SE, BH-FDR) |
| Lönegap & könsfördelning | lönekartläggningen (lagrum.md) | Lika arbete-fliken: översikten per BAS-intervall som tabell med grafik i raden (antal, medianer, skillnad i kronor, kvot med bootstrap-intervall, status), samma kvot som diagram, medianerna i kronor, lönespridning per BAS och kön, könsfördelning, 5 %-tröskel (EU Art. 9-analogt). Trattdiagrammet ställer varje yrkesgrupps kvot mot gruppens storlek och bedömer den med omkastning av könen inom gruppen |
| **Likvärdigt arbete** | **likvärdigt arbete (lagrum.md)** | **Likvärdigt arbete-fliken: organisationens kvinnodominerade AID×BAS mot icke-kvinnodominerade yrken med lika krav — i första hand organisationens egna i samma BAS, annars jämförelsestatistiken; med arbetsvärderingspoäng över BAS-gränserna. Därtill *Lägre krav, högre lön* (ADR-25)** |
| Hierarkisk översikt | lönekartläggningen (lagrum.md) | Löneöversikten (i Utforska): median/P10/P90/spridning per yrke+BAS, referenslinjer |
| Prioritering | — | Prioritetsindex (avvikelse × volym × jämställdhet), kostnadssimulering. Könsgapet i gruppen visas och räknas in i indexet bara när båda könen har minst k personer (ADR-12; annars räknas jämställdhetsdelen som 0). Jämför mot organisationens lönepolitiska ställningstagande (ur ett organisationspaket eller en egen namngiven fil; ingen inbyggd referens, ADR-28) eller mot jämförelsestatistiken |
| Fördjupning | — | Ålder & karriär (lön mot ålder med trend, lönegap per åldersgrupp, percentilband över ålder, lönefördelning per kön, livscykel ålder×kön×BAS och åldersstruktur), benchmark mot jämförelsestatistik (fliken syns när filen är uppladdad; spannet per yrke och avvikelsen i P10, median och P90) |
| EU-direktivets rapportmått | EU 2023/970 art. 9 | Struktur & rapportmått: kvartilfördelning, representation per BAS, distributionellt gap, medel- och mediangap, med EU-lönerapporten som Excel. **Tecknet:** verktyget räknar lönegapet som (kvinnor − män) / män och visar det i alla flikar och blad som kvinnors lön i procent av mäns (under 100 % = kvinnor lägre). EU-lönerapportens blad och rapportens avsnitt *Struktur och lönetransparens* (Word/PDF) redovisar i stället direktivets mått, (män − kvinnor) / män i procent, enligt art. 9: positivt tal = kvinnor lägre; kolumnrubriken och en metodrad säger det. Tecknet vänds på ett ställe, `tillDirektivtecken` i `src/lib/struktur.js`; beloppet är detsamma |
| Lönepolitik | — | Analys mot organisationens ställningstagande: bandkarta, könens läge i spannet och fördelningen i spannets tredjedelar per kön, efterlevnad, täckningsgrad; tomläge utan ställningstagande. Talen följer med som bladet *Lönepolitik* i Excel (alla flikar) — yrkesgrupperna mot sitt spann, läget per kön och BAS-intervall, tredjedelarna och efterlevnaden, med flikens regler för minsta gruppstorlek (`_lpExcelBlad`) — bara när ett ställningstagande är inläst |
| Organisationspaket | — | En fil med organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik; systemägaren skapar det i verktyget, handläggaren läser in det i ett steg (ADR-28) |
| Utforska | — | Egna vyer: rader × ev. kolumner (BAS, AID, yrkesgrupp inom BAS, sektor, AID-mellannivå, ålder, kön, lönespann; rader även hela urvalet), tio mått, visning som helhet eller per kön, urval med villkor (alla/något, "inte", lön och ålder) och gruppvillkor på uträknat mått, elva diagramtyper (staplar, liggande, hantel, bubbla, låda, individpunkter, punktsvärm, regnmoln, heatmap, grupperade, staplade). Små grupper visas som andra på skärmen och utelämnas ur exporten om inte rutan är ikryssad (ADR-14, ADR-51). Klick på en grupp öppnar gruppdossiern |
| Export | — | Exportmeny på varje diagram: PNG (1920 × 1080 / 1600 × 900), SVG och diagramdata (urklipp/CSV) |
| Dokumentera & exportera | — | Fas 4: färdigcheck och robusthetspanel, all export, rapportunderlag att klistra in i egen mall (ADR-20), samverkan och Spara och läsa in arbetet (konfiguration, ögonblicksbild, självdiagnostik). De fyra samlade exporterna har var sin uppgift: **Word-utkastet är rapporten, Excel-filen underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt**. Word och PDF ritas ur samma rapportmodell (`58-rapportmodell.js`), i ett valt urval av avsnitt (hela dokumentationen, ledningsbrief, facklig dialog eller eget); varje export har ett förhandsbesked om vad den innehåller och utelämnar, och exportgrinden ser till att inget läses ur en flik ritad med en äldre tröskel. Därtill JPA-protokoll och handlingsplansunderlag |
| Gränssnittets form | — | Alla flikar följer en mall: en rad om vad fliken svarar på (*Visa mer*), urval, nyckeltal i en rad, huvudresultat, och fördjupning i hopfällbara avsnitt som säger sitt nyckeltal i rubrikraden. Sök i sidhuvudet markerar en grupp i alla diagram och tabeller (länkade vyer). Panelen Inställningar samlar det som gäller alla flikar. Två lägen: vägledande och kompakt. Byggt för datorskärm; surfplatta och delat fönster fungerar, telefon är inte ett användningsfall (ADR-41) |
| Diagram | — | Ritas av diagramkärnan (D3, ADR-39) ur ett figurformat; formen väljs efter uppgiften och färgen efter vad den ska säga — reglerna står i `diagramkarnan.md` §10. Där ett diagram skulle visa för lite står en tabell med grafik i raden |
| Underlagets kvalitet | — | Fem kriterier med OK/Varning/Kritisk; svagaste kriteriet avgör (ADR-19) |
| Var uppstår löneskillnaden? | — | Översiktens avsnitt och rapportunderlagets block: skillnaden i medellön delad på BAS-fördelning, AID inom BAS och inom AID och BAS, visad som en trappa och med de grupper som bidrar mest (ADR-22) |
| Personer att granska | — | Lika arbete: personer minst X % (standard 10) under förväntad lön bland kollegor i samma AID och BAS, med filens radnummer; lämnar aldrig verktyget (ADR-23) |
| Stabilitet för flaggor | — | Lika arbete och rapportunderlaget: varje yrkesgrupp över 5 % märks skör (≤ 5 % om 1 eller 2 personer tas bort) eller stabil; flaggan ligger kvar (ADR-24) |
| Lägre krav, högre lön | — | Likvärdigt arbete och rapportunderlaget: kvinnodominerade yrken med lägre medianlön än ett av organisationens yrken i lägre BAS, med antal BAS-steg (ADR-25) |
| Processkarta | — | Översiktens åtta lagsteg grupperade under menyns faser — en karta över resan |
| Samverkan | EU Art. 10 | JPA-protokoll-export (flerflikars Excel) för facklig samverkan |
| Transparens | — | Bevis-popup på varje fynd: visar *uträkningen*, inte tabelldata |

**Statistisk metodik (kvalitetskrav):**
- Percentil-bootstrap för konfidensintervall (B = 1000–2000).
- HC3-robusta standardfel; t-fördelning för p-värden vid små n.
- BH-FDR-korrektion vid multipla per-BAS-tester.
- Blinder–Oaxaca-dekomposition för förklarad/oförklarad andel.

---

## 5. Likvärdighetsmodellen

Modellen bor i `src/lib/likvardighet.js` och speglas in i bygget som övriga kärnmoduler
(ADR-8). `src/app/34-likvardigt-arbete.js` innehåller bara state-adaptern och UI:t — att
adaptern verkligen delegerar vaktas av `tests/drift.test.js`:

1. **Steg 1:** Identifiera organisationens kvinnodominerade AID×BAS-grupper
   (mer än kvinnotröskeln, standard 60 %; beslut 2026-10-19, lagrum.md). k-anonymiteten tillämpas inte — lagen kräver att
   även små grupper prövas (rapportunderlaget redovisar bara par där båda grupperna har
   minst 10 personer).
2. **Steg 2 — jämförelseyrken med lika krav:**
   - **BAS-läget (standard):** i första hand organisationens **egna** icke-kvinnodominerade
     yrken (under 100 − kvinnotröskel % kvinnor) i samma BAS-intervall. Saknas ett sådant i
     BAS-intervallet används **jämförelsestatistiken** som reserv (dess egen
     könsfördelning i första hand, SKR:s personalstatistik när den saknas, ADR-34).
   - **Poängläget:** har lönefilen kolumnen Poäng jämförs med yrken som har lika eller
     lägre arbetsvärderingspoäng (poäng ≤ det kvinnodominerade yrkets × (1 + band),
     standardband 5 %) — även över BAS-gränserna.
3. **Steg 3:** Flagga par där jämförelseyrkets median är högre än minsta skillnaden
   `minGapPct`, med bootstrap-KI på medianskillnaden, och visa högst `topN` par. I verktyget
   är standardvärdena **5 %** och **20 par** (`state.likvardighet` i `12-tillstand.js`;
   användaren kan ändra dem i fliken, 0–50 % och 10–500 par). Modulens egna standardvärden,
   0 % och 100 par, gäller bara när den anropas utan inställningar, som i enhetstesterna.
   Den råa medianskillnaden är huvudmåttet — lagen prövar lönenivån som sådan. Interna par
   får därtill en **åldersjusterad skillnad** (`aldersjusteradSkillnad`): i jämförelseyrket
   skattas log(lön) = a + b·ålder (OLS; minst 10 personer med ålder och minst 5 års
   åldersspridning, annars `null`), lönen prediceras vid varje person i den kvinnodominerade
   gruppen med dennes ålder, och medianen av prediktionerna är den åldersjusterade
   jämförelsemedianen; skillnaden räknas mot gruppens råa median. Den visar hur mycket av
   skillnaden som kan bero på åldersstruktur och fälls ut i fliken (kolumnen *Justerad för
   ålder*), bevis-popupen (med medelålder per sida, `kvMedelAlder`/`maMedelAlder`), flikens
   CSV- och Excel-export och rapportunderlagets parblock. Externa par får `null` —
   jämförelsestatistiken saknar individdata. Utanför fliken lyder den samma k-regel som
   paret (`_parForRedovisning`).
4. **Lägre krav, högre lön (ADR-25, BAS-läget):** kvinnodominerade yrken med lägre
   medianlön än ett av organisationens egna yrken i *lägre* BAS, med antal BAS-steg.
   BAS-ordningen är fast: bokstavsordning A–J. Den går inte att ändra i verktyget. Varje
   bokstav motsvarar ett lika brett poängintervall i arbetsvärderingen, så rangen är bokstavens
   plats (A=1, B=2 …) där BAS räknas som ett tal — Blinder-Oaxaca, kvantilregressionen och
   *Lägre krav* använder samma funktion (`basRangFn` i `src/lib/likvardighet.js`) — och B → D
   är två BAS-steg även när C saknas i underlaget. Huvudregressionen och den sekventiella
   dekomponeringen räknar inte BAS som ett tal utan som indikatorvariabler, en per intervall med
   det alfabetiskt första som referens (ADR-44); bokstavsordningen avgör där bara referensen.

---

## 6. Teknisk plan & leveransform

- **Körtid för utveckling:** Node **≥ 22.12** (`engines` i `package.json`). jsdom-kedjan
  gör `require()` av en ES-modul, vilket kastar `ERR_REQUIRE_ESM` på Node 20 — smoke-,
  a11y- och golden-sviterna faller då tyst. `require(esm)` är påslaget från 22.12.
- **Mappstruktur:**
  - `src/` — källan: `src/index.html`, `src/style.css`, `src/app/NN-*.js` (appens moduler,
    namngivna efter flik eller funktion; tabellen står i `src/app/README.md`)
    och `src/lib/*.js` (rena moduler som testas direkt och speglas in i appen).
  - `vendor/` — tredjepartsbiblioteken (`vendor/d3.min.js` (diagram, ADR-39),
    `vendor/xlsx.mini.min.js`, `vendor/papaparse.min.js`, `vendor/jszip.min.js`), se `LICENSES.md`.
  - `dist/` — genererat och incheckat: `dist/app.js`, `dist/oppen-lonekartlaggning.html`
    och `dist/RELEASE.txt`.
  - `docs/` — `docs/anvandare/` (medföljer verktyget), `docs/dataskydd/`,
    och `docs/utveckling/` (denna plan).
  - `tests/`, `tools/` (bygge, generatorer; `tools/data/` för lokala indata, inget incheckat).
- **Källfiler:** `src/index.html`, `src/style.css`, `src/app/NN-*.js`, `src/lib/*.js`.
  `dist/app.js` är ett **genererat** hopslag av `src/app/` och redigeras aldrig direkt (ADR-6/ADR-8).
  `src/index.html` pekar på biblioteken i `vendor/` och på `dist/app.js` (relativa sökvägar
  från `src/`) men **går inte att köra direkt i en webbläsare**: dess CSP (`default-src
  'none'; script-src 'unsafe-inline'`) blockerar stilmallen och alla skriptfilerna (fem: fyra bibliotek och verktygets eget skript;
  prövat i Chromium). Den är indata till bygget och till jsdom-testerna; en
  ändring ses i `dist/oppen-lonekartlaggning.html` efter `npm run bundle`.
- **Bygge:** `npm run bundle` (`tools/bundle.mjs`) → `dist/oppen-lonekartlaggning.html` (~2,5 MB;
  single-file). CSS/HTML minifieras; **JS minifieras inte** (template
  literals bevaras). SHA-256 loggas i `dist/RELEASE.txt`, som är deterministisk —
  `Build:`-raden härleds ur `VERSION`, inte ur systemklockan, så en ombyggnad
  av oförändrad källa inte smutsar ner arbetskatalogen.
- **Versionering:** CalVer (`ÅÅÅÅ.MM.DD`). `VERSION` är enda källa; `APP_VERSION`
  och `APP_BUILD_DATE` genereras ur den och vaktas av `tests/version.test.js`.
- **Stilmallen (`src/style.css`):** komponentregler per flik, variabler i `:root` (färger, `--fs-*`-skalan) och sist ett
  namngivet bibliotek av hjälpklasser som ersatte alla `style`-attribut (ADR-30). Biblioteket ligger i blocket «Hjälpklasser
  som ersätter style-attributen» (börjar vid `.dold`), med förklaring av namnen överst i blocket: sammansatta klasser för det som
  ofta hänger ihop (`rad-bryt-mitt`, `rad-mellan`, `text-dampad-sm`, `versal`, `notis-varning`), annars en klass per värde
  efter mönstret `egenskap-värde` (`marg-t-8`, `pad-10-14`, `gap-12`, `fs-sm`, `farg-dampad`, `ram-1-kant`, `rund-6`).
  Väljaren dubblerar klassnamnet (`.x.x.x`) för att få samma företräde som ett style-attribut hade, utan `!important`;
  färg- och statusklasserna (`fg-`, `bg-`, `bricka-` …) och de äldre hjälpklasserna (`t-hoger`, `mb-14` …) är `!important`
  och ligger efter biblioteket. En ny kombination skrivs med klasserna som finns; saknas ett värde läggs en rad till i
  rätt grupp. Utskriftsfönstret för checklistorna (`printScaffoldView`) läser `:root` och allt från `.dold` till
  stilmallens slut ur den körande stilmallen och lägger in det som byggt stilark (`adoptedStyleSheets`): ett `<style>`-element
  som skriptet skapar blockeras av den ärvda CSP:n (`style-src-elem`), så fönstret var tidigare helt ostilat.
- **Tester:** Vitest — 2444 tester i 69 filer: rena `src/lib/`-moduler, CSV-parsning, jsdom-röktest
  av varje vy (ADR-7; `tests/smoke.test.js` med det delade fönstret och sju `tests/smoke-*.test.js` per
  område), k-tröskeln i åtta `tests/ktroskel*.test.js` med riggen i `tests/helpers/ktroskel-rigg.js`,
  gränssnittet i `tests/granssnitt*.test.js` (riggen `tests/helpers/granssnitt-rigg.js`) och diagramvyerna i
  `tests/diagramvyer*.test.js` (riggen `tests/helpers/diagramvyer-rigg.js`),
  axe-a11y (ADR-10) samt vakterna `appsource`, `drift`, `exports.golden`,
  `version`, `release` och `kanonymitet`, samt de rena modulerna bakom Utforska och exportmenyn
  (`utforska`, `urval`, `falt`). `tests/figur.test.js` prövar figurformatet och
  `tests/diagramritare.test.js` diagramkärnan (ADR-39) — den ritar med **äkta D3** i jsdom, så SVG:n som prövas är
  den riktiga, och två differentialtester vaktar att små grupper inte lämnar spår på skärmen eller i exporten.
  Därutöver `npm run test:browser`: Playwright-röktest av den
  **byggda** artefakten i riktig Chromium — under CSP:n från `file://`, som jsdom inte tillämpar. Provet kräver att
  varje diagram har ritats av diagramkärnan, och ritar därtill ett eget diagram och exporterar det genom
  exportmenyn (PNG i båda storlekarna, SVG som öppnas som eget dokument, diagramdata) — PNG via canvas finns inte i jsdom. Den prövar också adressen `?demo=1`, räknar CSP-överträdelser
  och interna fel (ADR-31), och körs i Chromium, Firefox och WebKit (`--browser=…`,
  `npm run test:browser:firefox`/`:webkit`; i CI alla tre).
  *Testmiljön:* `tests/helpers/app-harness.js` kompilerar d3 och app.js en gång per arbetare och stänger och
  tömmer fönster som inte behövs, så att varje arbetares minne håller sig under Nodes tak (den tyngsta filen
  under 1,2 GB). Ett fönster kostar omkring 0,15 s efter det första (som bär kompileringen); det dyra är
  ritningen av alla flikar (omkring 2 s på demodatan), så tiden styrs av hur många flikritningar en fil gör.
  Vitest kör en fil per arbetare, så den längsta filen sätter golvet för hela körningen: därför är röktestet,
  k-tröskeltestet, gränssnittstestet och diagramvyerna delade i filer per område (`tests/smoke*.test.js`,
  `tests/ktroskel*.test.js`, `tests/granssnitt*.test.js`, `tests/diagramvyer*.test.js`) med gemensamma riggar i
  `tests/helpers/`; ingen fil tar mer än omkring 90 s ens under full last. `vitest.config.js` sätter en
  gemensam tidsgräns och antalet arbetare: tre fjärdedelar av antalet trådar (på åtta kärnor med SMT mättes
  åtta arbetare till 168 s, femton till 150–168 s och tolv till 130 s: de tunga filerna är processorbundna, så
  med en arbetare per tråd trängs de om kärnorna, och med en per kärna köar de), begränsat av maskinens totala
  minne med 1,2 GB per arbetare och 2 GB åt resten.
  *Testkörningen:* `npm test` kör `tools/test.mjs`, som kör sviten och sedan kör om de filer vars arbetare dog i
  Node (SIGSEGV i V8:s skräpsamlare, sällsynt; orsaken ligger i Node, §9). Ett test som faller körs aldrig om, och
  utgångskoden är 0 först när alla filer har rapporterat. Hela sviten tar omkring 130 s på 8 kärnor/16 trådar
  (var tidigare 250–275 s, då `smoke.test.js` och `ktroskel.test.js` var för sig tog hela tiden); under full
  last tar varje fil omkring dubbelt så lång tid som ensam, och den längsta omkring 90 s.
  *Byggets förminskning av stilmallen* ligger i `tools/lib/minify-css.mjs` med tester i `tests/byggminify.test.js`: strängar och `url()` rörs inte, blanksteg runt `+` och `-` i värden står kvar, och blanksteget före en pseudoklass i en väljare står kvar.
- **Demosida:** `npm run site` bygger `site/dist/` (startsidan
  `site/index.html` + bygget + `RELEASE.txt`) för valfri statisk webbplats; sidan har inga
  skript och länkar till verktyget med `?demo=1`, som startar demoläget (ingen annan
  adressparameter läses). Finns en översiktsbild eller en kort slinga i `dist/marknad/` tas den
  med på sidan.
- **Prestanda:** `npm run perf` (`tools/perf-smoke.mjs`) laddar ett syntetiskt
  55 000-radersdataset genom den riktiga filuppladdningen i Chromium, mäter tiden
  tills gränssnittet är klart och tills bakgrundsanalyserna är klara, och tar tid
  på varje fliks rendering. Vakten är en snäv budget på tiden till klart
  gränssnitt (5 s; uppmätt ~2 s). Budgeten är maskinberoende, så skriptet körs
  inför en release på en utvecklarmaskin, inte i CI. Mätvärdena står i § 9. Översiktens bootstrap och
  trattdiagrammets omkastning räknas en gång per underlag.
- **Typkontroll:** `npm run typecheck` kör TypeScript (`tsc`, enda tillägget i utvecklingsberoendena) i
  `checkJs`-läge på JavaScript-källan med JSDoc som typspråk — inget skrivs om till TypeScript och inget
  emitteras. Två projekt: `tsconfig.json` (`typecheck:lib`) tar `src/lib/**` och `tools/**` som ES-moduler;
  `tsconfig.app.json` (`typecheck:app`) tar `src/app/*.js` som skript i ett gemensamt globalt scope, precis som
  i `dist/app.js`. `strictNullChecks` är på, `noImplicitAny` av (koden är dynamiskt typad där JSDoc saknas);
  `useUnknownInCatchVariables` av. Biblioteken (`d3`, `XLSX`, `Papa`, `JSZip`) och appens egna fält på
  DOM-element (`tr._markering` m.fl.) deklareras i `types/globals.d.ts`, Node-modulerna som kortform-ambienta
  moduler i `types/node-minimal.d.ts` (inget `@types/node`). Röktestet och prestandasvepet
  kör sina callbacks i webbläsarens realm (`page.evaluate`) och är uteslutna, som i `eslint.config.js`.
  Båda projekten är i **nolläge** (CI stoppar på första felet); inga `@ts-ignore`/`@ts-expect-error` används.
  Felen vid införandet, sorterade:

  | Projekt | Fel vid start | (i) verkliga buggar | (ii) fel i JSDoc | (iii) brus ur det dynamiska scopet |
  |---|---|---|---|---|
  | `src/lib` + `tools` | 558 (varav 427 i sidorealm-skripten) | 0 | ≈70 | ≈61 (+ 427 uteslutna) |
  | `src/app` | 1769 (varav 130 speglade från `src/lib`) | 1 | ≈330 | ≈1 310 |

  (i) `18-atgardslista.js` läste `state._lifecycleFixBas`, som aldrig sätts — livscykelpunkten i Att göra
  räknades alltid på standardintervallet i stället för kortets val (test: `tests/attgora-livscykel.test.js`).
  (ii) Ofullständiga `@returns`/`@param` (fält som saknades i typen, `{object}` som döljer fält, `function():`-syntax,
  returtyper med `null`), rättade i JSDoc. (iii) DOM-typerna (`Element`/`EventTarget`/`HTMLElement`, null ur
  `getElementById`) löstes med riktade typomvandlingar vid anropet (`/** @type {HTMLInputElement} */ (e.target).value`),
  otypade `let x = null`/`[]` och `state`-fälten med `@type`-annoteringar på deklarationen. Standardobjektet
  `= {}` på `k`-bärande funktioner i `src/lib` (`likaArbeteGrupper`, `prioritera` …) togs bort: utelämnad `k` hade
  tyst stängt av maskeringen, och varje anropare skickar den.
- **CI** (`.github/workflows/ci.yml`), två jobb:
  - `quality` — lint, typkontroll, hela testsviten, mojibake-grind och en **artefaktgrind**: bygget är
    byte-reproducerbart, så CI bygger om och kräver oförändrad SHA-256. `appsource`-testet
    vaktar `dist/app.js` mot `src/app/`; artefaktgrinden vaktar den skeppade HTML-filen.
  - `browser` — en matris över Chromium, Firefox och WebKit: installerar motorn, bygger artefakten och kör
    röktestet mot den.
  Båda kör Node 22. Jobbet bygger *inuti* körningen eftersom `git checkout` ger alla filer
  samma mtime, vilket annars skulle utlösa röktestets färskhetsspärr.
- **Release** (`.github/workflows/release.yml`, på tagg `v*`): `npm ci`, kontroll att taggen är `v<VERSION>`,
  **release-grinden** `npm run release:kontroll` (`tools/release.mjs`: VERSION, `package.json`, CHANGELOG:s översta
  versionsrubrik utan *Oförlöst* och `RELEASE.txt` anger samma version; bygget har RELEASE.txt:s SHA-256 och
  riskanalysen samma bygge och kontrollsumma; riskanalysens och `dataskydd.md`:s granskningsdatum är inte äldre än
  senaste commit som rör `src/`, `tools/bundle.mjs` eller `vendor/`; arbetskatalogen är ren — prövad på fixturer i
  `tests/release.test.js`), ombyggnad med byte-identisk-kontroll, signering av artefakten och `RELEASE.txt` med
  Sigstore cosign utan nyckel (certifikat för arbetsflödet genom GitHub Actions OIDC) och verifiering med samma
  kommando som `SECURITY.md` anger, sist en GitHub Release med filerna och deras `.sigstore.json`-paket. Klonen är
  fullständig (`fetch-depth: 0`) så att grinden kan läsa när koden senast ändrades. Jobbet har bara
  `contents: write` och `id-token: write`.
- **Demosidan** (`.github/workflows/pages.yml`, på tagg `v*` eller för hand): `node tools/site.mjs` med
  guidelänkar till `docs/anvandare/` i repot, publicerad på GitHub Pages (`upload-pages-artifact`, `deploy-pages`;
  jobbet som publicerar har bara `pages: write` och `id-token: write`).
- **Ärenden:** mallar för fel och förslag på svenska i `.github/ISSUE_TEMPLATE/`, med kryssrutan att ärendet inte
  innehåller verklig lönedata; tomma ärenden är avstängda, och säkerhetsbrister rapporteras privat (`SECURITY.md`).
- **Beroendeuppdateringar** (`.github/dependabot.yml`): npm veckovis med utvecklingsberoendena i en grupp, och
  arbetsflödenas steg veckovis. Varje `uses:` i arbetsflödena ska peka på en fullständig commit-SHA med versionen som
  kommentar (`tests/sakerhet.test.js`), och Dependabot uppdaterar båda tillsammans.
- **Dokumentation:** `README.md` (översikt); `docs/anvandare/` — `korguide.md`,
  `datauttag.md` (med uttagssteg för Heroma, Personec P och Visma, ej verifierade mot systemen),
  `organisationspaket.md` (med ett påhittat exempelpaket och systemägarens checklista), `pilotchecklista.md`,
  `sammanfattning-hr-chefer.md`, `sakerhetsbeskrivning.md` och `tillganglighetsredogorelse.md` (för IT och
  dataskyddsombud) och `information-till-anstallda.md` (textförslag, ska stämmas av med dataskyddsombudet);
  `docs/dataskydd/` — `riskanalys.md` (underlag till DPIA, det fullständiga dokumentet)
  och `dataskydd.md` (kort beskrivning för dataskyddsombud och IT);
  `docs/utveckling/lagrum.md` (lagrumshänvisningarna); `CHANGELOG.md` (per release).
  Metoderna beskrivs för användaren i appens flik *Om verktyget*.
  Filnamn skrivs med gemener och bindestreck; levande dokument har inget datum eller
  versionsnummer i namnet.

---

## 7. Kvalitetskrav (vad "klart och korrekt" betyder)

K1. Alla statistiska formler ska vara spårbara och dokumenterade.
K2. Inga nätverksanrop, ingen persistent lagring (verifierbart i bygget).
K3. Kärnalgoritmer ska ha enhetstester som speglar den *gällande* modellen.
K4. Dokumentationen ska beskriva den *byggda* versionen (ingen drift).
K5. UI ska inte upprepa information på ett sätt som skymmer analysflödet.
K6. Bygget ska gå att öppna från `file://` och fungera utan internet.
K7. Skydd som är juridiskt bindande (k-anonymitet, ingen lagring) ska vaktas av
    *invarianter* som gäller hela utdatan — inte av stickprov på enskilda vyer.
    En ny vy ska ärva skyddet utan att någon kommer ihåg att testa den.
    Invarianterna står i `tests/kanonymitet.test.js` och `tests/ktroskel-invarianter.test.js` (flikar och
    exporter; vad som inte prövas står i testfilerna och i `riskanalys.md` §6.5) och i
    lagringsspärrens test i `tests/sakerhet.test.js`.

---

## 8. Arkitekturbeslut (ADR)

Här står de arkitekturbeslut som gäller, med motiv och avvisade alternativ, så att en granskare inte
återupptar dem utan ny kontext. Besluten är numrerade för att koden, testerna och dokumenten ska kunna peka på
dem. Ett nummer som saknas i listan används inte.

**ADR-1 — Web Worker avvisad.** En worker strider mot integritetsmodellen: (a) CSP:n saknar `worker-src`, så
`default-src 'none'` blockerar workers; (b) lagringsspärren gäller bara huvudtrådens `window` — en worker är en
separat scope utan spärren men med IndexedDB-åtkomst, vilket utökar granskningsytan; (c) `file://` och
blob-workers är opålitliga mellan webbläsare; (d) diagramritningen, som arbetar mot DOM, kan ändå inte flyttas.
**Vid faktiskt prestandabehov:** main-tråds-chunking (`requestIdleCallback`) och nedsampling i diagramkärnan.

**ADR-2 — JS-minifiering avvisad.** Regex-minifiering är inte AST-medveten och kan korrumpera strängliteraler
(dokumenterat i bundlern). Vinsten (~14 % på en lokalt öppnad fil) motiverar inte ett beroende av terser eller
esbuild. CSS och HTML minifieras (grammatiken är enklare).

**ADR-4 — Byggskyddsnät.** Bundlern (`tools/bundle.mjs`) avbryter bygget vid U+FFFD (mojibake) i egna
källfiler och kör `node --check` på `app.js` när Node finns.

**ADR-5 — Kodhygien.** Oanvänd kod tas bort, inte kommenteras ut. Säkerhetsgranskningen hålls samlad i
`docs/dataskydd/riskanalys.md`.

**ADR-6 — `app.js` genereras från `src/app/`-moduler.** Appens kod ligger i numrerade källmoduler
(`src/app/NN-*.js`) som `tools/build-app.mjs` slår ihop byte-identiskt (BOM + CRLF bevaras). Motiv:
navigerbarhet utan ES-moduler i bygget (`file://`-kravet, jfr ADR-1 och ADR-8). Bundlern regenererar
automatiskt; `tests/appsource.test.js` vaktar synk. Redigera aldrig `app.js` direkt.

En modul som växer delas vid en sektionsgräns. Delningen görs som ren byte-skiva, så att `app.js` blir bit för
bit oförändrad och uppdelningen är bevisbart beteendebevarande. Modulöversikten står i `src/app/README.md`.

Två delar **genereras** och redigeras aldrig för hand: `08-version.js` ur `VERSION` (`tools/gen-version.mjs`)
och `09-lib-speglar.js` ur `src/lib/` (`tools/gen-mirrors.mjs`).

**ADR-7 — Två lager röktest: jsdom och den byggda filen i riktiga webbläsare.** `tests/smoke.test.js` startar
appen i jsdom och ritar varje flik. Diagramkärnan ritar där med äkta D3, så SVG:n som prövas är den riktiga.
Lagret är brett och snabbt men prövar inte det jsdom saknar: CSP:n (som jsdom inte tillämpar), `file://`-bygget
och bildexporten via canvas. Därför kör `tools/browser-smoke.mjs` den **byggda** artefakten i Chromium, Firefox
och WebKit via Playwright. Lagren ersätter inte varandra — jsdom-testet är brett och snabbt, webbläsartestet
smalt och verkligt. Båda körs i CI.

Röktestet mot artefakten har en **färskhetsspärr**: är bygget äldre än källan avbryts det. Utan den blir allt
grönt medan en gammal artefakt testas, vilket är lätt att gå på.

**ADR-8 — lib-speglarna genereras från `src/lib/`.** `tools/gen-mirrors.mjs` inlinar varje `src/lib/`-modul
VERBATIM i en IIFE (endast `export` strippas — funktionskropparna rörs aldrig) och exponerar de namn `app.js`
anropar (`_fitOLS`, `_fcComputePott`, `_stMedianGapPct` …) som `const`-alias. Resultatet skrivs till
`src/app/09-lib-speglar.js`, som `tools/build-app.mjs` regenererar före varje hopslagning (och som bundlern
därmed också täcker). Motiv: `src/lib/` är enda källa — spegel och lib kan inte glida isär, och varje formel
ändras på ett ställe. Regressionsmodellerna (`src/lib/regression.js`: kollinearitet, gap per BAS, sekventiell
dekomponering, kvantilregression, Blinder-Oaxaca) speglas på samma sätt; `src/app/50-regressionsmodeller.js` är
bara adaptern som skickar in `getData()`, `statGolv()` och BAS-rangen. Prioriteringsindexet (`src/lib/prioritering.js`:
`prioritera()` och `prioIndex()`, med referensen som funktion `referensFor`) och livscykelmodellen (`src/lib/livscykel.js`,
`livscykelRegression()`) speglas på samma sätt, under prefixen `_pr` och `_lc`; `55-prioritering.js` och `52-livscykel.js`
är bara adaptrarna. `file://`-kravet gäller: ingen ES-modulbundling i bygget; speglarna är vanliga
`const`/IIFE i ett klassiskt skript.

Lib-moduler får importera varandra (`likvardighet.js` använder `stat.median` och `rng.rngFor`). Generatorn
tolkar importerna; den importerade modulen måste ligga tidigare i `MODULES` och exponera namnet, och aliaset
injiceras **inuti** den importerande modulens IIFE, så att inga nya globala namn uppstår. likvärdighetsmodellen har
därför bara en adapter i appen (`34-likvardigt-arbete.js`).

**Vakter:** `tests/drift.test.js` kontrollerar att den incheckade `09-lib-speglar.js` är i synk med `src/lib/`
(kör generatorn), att varje alias pekar på rätt lib-funktion, att likvärdighetsadaptern delegerar och att
konfidensintervallen i likvärdigt arbete är reproducerbara (seedningen per par får inte slås ut av `Math.random`);
`tests/exports.golden.test.js` vaktar att exporterna inte ändras av en omflyttning.

**ADR-9 — Hash-baserad CSP `script-src`.** I den byggda filen tillåter `script-src` bara skript med
kontrollsumma (`'sha256-…'`), inte `'unsafe-inline'`. Motiv: utan `'unsafe-inline'` avvisar webbläsaren **både**
injicerade inline-`<script>` och injicerade händelseattribut (`onclick=…`) — hela XSS-klassen "fientligt
CSV-innehåll exekveras" blir tekniskt omöjlig, ett lager djupare än `esc()`/sanering. `tools/bundle.mjs`
beräknar SHA-256 (base64) av varje inlinat skripts exakta textinnehåll och skriver in dem i CSP-metan vid
bygget (avbryter om `'unsafe-inline'` inte hittas). Appen har därför inga inline-händelseattribut: knapparna
använder delegerade lyssnare (`data-goto-tab` / `data-dismiss-parent` i `03-hjalpfunktioner.js`).
`<style>`-element kräver också kontrollsumma, och stilattribut i markeringen är förbjudna (`style-src-attr 'none'`, ADR-30). Källfilen `src/index.html`
har `'unsafe-inline'` och går inte att köra direkt (§6); kör alltid det byggda verktyget.
**Vakter:** `tests/sakerhet.test.js` och webbläsarröktestets räknare för `securitypolicyviolation`.

**ADR-10 — Sidopanelen är navigation, inte ARIA-tabs.** Sidopanelen är `<nav aria-label>` (ett
navigation-landmärke) med knappar utan tab-roll och `aria-current="page"` på den aktiva. Motiv: tablist-mönstret
tillåter bara `role="tab"`-barn, men sidopanelen innehåller den hopfällbara sekundärgruppens disclosure-knapp
(→ `aria-required-children`, kritisk i axe), och en persistent sidopanel som byter huvudinnehåll ÄR navigation,
inte ett in-page-tab-widget. Pil-/Home/End-navigering finns som tillägg, och alla knappar ligger i naturlig
Tab-ordning (ingen roving tabindex). De **två äkta in-page-tablistarna** (`info-tab-nav`,
`benchmark-metric-bar`) har bara `role="tab"`-barn och uppfyller mönstret. Vaktas av `tests/a11y.test.js`
(axe-core i jsdom): 0 överträdelser. `color-contrast` kräver layout-motor och kan inte köras i jsdom — verifieras
manuellt i webbläsare (`pilotchecklista.md`, avsnitt E). axe-core är ett **dev-beroende** och ingår aldrig i
bygget.

**ADR-12 — K-anonymitetens redovisningsform: utelämna och namnge.** En rad där varje mätvärde står som `< 10`
är tekniskt korrekt men praktiskt värdelös: den ger inget att analysera och gör tabellerna långa och svårlästa —
i EU-matrisen kan en liten organisation få en tabell som nästan bara består av maskerade celler. Därför gäller:

1. **Hela gruppen under tröskeln** → raden utelämnas, och gruppen räknas upp **med namn** i en not vid tabellen
   (`kMaskNote()`). Handläggaren ser exakt vad som saknas och varför. Personerna ingår fortfarande i underlaget
   och i totalsummorna.
2. **Bara könsuppdelningen för liten**, medan gruppen som helhet ligger över tröskeln → gruppens **samlade
   median** redovisas (`kSamladNote()`). Den bygger på n ≥ `kTroskel()` och röjer ingen enskild, men ger ändå
   ett lönemått att förhålla sig till. Könsjämförelsen utgår, med förklaring.

Punkt 2 är inte en uppmjukning av skyddet utan ett erkännande av att `anyMasked` och `isKMasked(gruppen)` är
olika saker. I EU-matrisen har grupperna ofta 14–17 personer men bara 2–3 av ena könet; att utelämna dem skulle
tömma hela tabellen.

Noterna innehåller avsiktligt **ingen inline-markup**: SheetJS trimmar varje elements text för sig och slår ihop
dem utan avskiljare, vilket ger `4 yrkesgruppervisas` i Excel-exporten. Skyddet vaktas av invarianten i
`tests/kanonymitet.test.js`.

**ADR-13 — `VERSION` är enda källa för versionsstämpeln.** Versionsstämpeln (`APP_VERSION`, `APP_BUILD_DATE`)
syns i rapportens sidfot och i Excel- och Word-metadata — det som gör ett resultat spårbart till en
beräkningsversion i en lagstadgad process. `src/app/08-version.js` genereras ur `VERSION` av
`tools/gen-version.mjs`, som både `build-app.mjs` och `bundle.mjs` kör. Build-datumet **härleds ur versionen**
(CalVer = byggdatum), inte ur systemklockan: ett `new Date()` skulle ge ny SHA-256 vid varje bygge och slå
sönder artefaktgrinden i CI.

Golden-testerna normaliserar versionen till `<VERSION>` för att slippa snapshot-churn och kan därför inte fånga
drift här. En egen vakt, `tests/version.test.js`, hävdar att stämpeln följer `VERSION` och att ingen annan
`src/app`-modul hårdkodar en versionssträng.

**ADR-14 — Utforska visar små grupper; exporten utelämnar dem.** Den som använder verktyget har redan rådatan.
K-skyddet finns mot *läckage*, alltså det som lämnar verktyget. I Utforska gäller därför:

1. Alla grupper visas. (Markeringen av grupper under tröskeln på skärmen — ränder, streckad kant, kursiv —
   utgick med ADR-51: skärmens tröskel är 1, så ingen grupp är liten där. I exportläget får små celler
   klassen `explore-liten`, som exporten läser.)
2. Exporten — tabellens CSV/urklipp och diagrammets exportmeny — utelämnar dem, och könsvärden och gap där ena
   könet är under tröskeln, om inte användaren kryssar i "Ta med grupper under k i exporten" (k är tröskelns värde). Regeln bor
   i `src/lib/utforska.js` (markeringen `liten`/`konLiten`) och i `71-utforska-figur.js` (`_explorerVisible`).
3. Diagram med enskilda personers löner (individpunkter) är tillåtna i Utforska, även i export, och följer
   rutan för små grupper. Utanför Utforska ritas och exporteras en persons punkt i ett spridningsdiagram bara
   när personens grupp (yrke inom BAS) och personens kön i gruppen når tröskeln (`individLitenFor` i
   `06-k-anonymitet-och-dataminimering.js`).
4. Differensskydd (att räkna fram en liten grupp ur två filtrerade urval) byggs inte.
5. **Antal** (n, och n per kön) följer med i exporten även när ett kön har färre än `kTroskel()` personer.
   Antal är inte ett lönemått. Ska inte döljas.

Alla diagram har en gemensam exportmeny (`11-diagramexport.js`), som diagramkärnan kopplar in, så att nya
diagram får den automatiskt.

**Vakter:** `tests/utforska.test.js` och exporttestet i `tests/kanonymitet.test.js`.

**ADR-15 — Formler i CSV- och urklippsexport neutraliseras.** En textcell som börjar med `=`, `+`, `-` eller
`@` (eller tabb/CR) blir en formel när en CSV-fil öppnas eller en tabell klistras in i Excel. Yrkesnamn och
andra textfält kommer ur lönefilen, så en fientlig fil skulle kunna lägga en formel i HR:s export
(CSV-injektion, OWASP). Sådana celler får ett inledande `'`, som Excel visar som text. Tal — även formaterade
som `-3,2 %` eller `-1 250 kr` — lämnas orörda, så att de fortfarande blir tal i Excel. Regeln bor i
`_neutraliseraCell` (`22-exporthjalpare.js`) och gäller `_toCsv` och urklippets `_tillTsv`. Excel-exporten
(SheetJS) skriver strängar som textceller och berörs inte. Vaktas av `tests/smoke.test.js` ("export: formler i
celler neutraliseras").

**ADR-16 — Inga paragrafhänvisningar i gränssnittet, och sedan 2026-10-19 inte heller i hjälptexter eller
exporter.** Menyer, rubriker, löptext, knappar, verktygstips, ordlistan, Om verktyget och exporterna (Word,
PDF, protokoll, Excel) hänvisar **övergripande** — "enligt diskrimineringslagens regler om lönekartläggning",
"likvärdigt arbete", "direktivets regler om gemensam lönebedömning", "uppgiftsminimering enligt
dataskyddsförordningen" — aldrig med paragraf- eller artikelnummer ("§ 9", "DiskrL 3:8", "3 kap. 10 §",
"art. 9.3"). Flikarna heter det de gör. De exakta lagrummen står på **ett** ställe, `docs/utveckling/lagrum.md`,
som metodbilagans rad *Rättslig ram* pekar på. Skälet: 3 kap. numreras sannolikt om när direktivet genomförs,
och genomgången 2026-10-19 visade att sju olika hänvisningsformer och flera felaktiga
paragrafer hade spritts i koden utan att någon märkt det. Verktyget ger underlag, inte juridiska bedömningar;
den som behöver lagrummet hittar det i tabellen. Tre texter delas mellan gränssnitt och export
(rubriken "Lika arbete — multivariat regression" och två insikter) och saknar därför paragraf även i exporten.
Vaktas av `tests/smoke-vyer.test.js` ("gränssnittet har inga paragrafhänvisningar utanför hjälptexten"), som ritar
alla flikar och söker igenom den synliga texten.

**ADR-17 — `runOLSRegression` får aldrig cachas.** Fliken Lika arbete kör regressionen tre gånger per
rendering (~250 ms). En cache skulle spara den tiden men kräva en invalideringsregel som är bevisbart rätt för
varje ändring av data, urval och inställningar; ett inaktuellt resultat i en juridisk analys är ett allvarligt
fel, 250 ms är det inte. Regressionen räknas därför alltid om. *Får inte implementeras*, inte heller som
memoisering inuti modulen.

**ADR-19 — Underlagets kvalitet: svagaste länken avgör.** Underlaget bedöms med fem kriterier med status
OK/Varning/Kritisk: jämförbarhet (andel av personalen i BAS-intervall där båda könen har minst k), statistisk
styrka (minsta upptäckbara könsskillnad ur regressionens robusta standardfel), fullständighet (bortfall vid
inläsning), rimlighet och modell. Helheten är det sämsta kriteriet, så att en allvarlig brist inte späds ut
(som den skulle i en viktad summa). Könsfördelningen i organisationen är ett fynd, inte ett kvalitetsmått.
Logiken bor i `src/lib/datakvalitet.js` och vaktas av `tests/datakvalitet.test.js`. Kompliansöversikten och
åtgärdslistan räknar bara jämförbara BAS-intervall (samma regel), så att en röd ruta aldrig står bredvid en tom
åtgärdslista. På Översikt är panelen sammanfattad på en rad och fälls ut när något kriterium är Varning eller
Kritisk (ADR-36).

**ADR-20 — Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget.** Rapporten skrivs i
organisationens egen Word-mall, och det som tar tid är att föra över siffror och tabeller. Panelen
Rapportunderlag i Dokumentera ger kopierbara block: avsnitten sammanfattning, lika arbete, likvärdigt arbete,
struktur och handlingsplan, *Var uppstår löneskillnaden?* (ADR-22), *Lägre krav, högre lön* (ADR-25) och
sektorsavsnittet (ADR-33), ett block per yrkesgrupp med skillnad över 5 % och ett per kandidatpar — med
faktastycke, ren tabell, vad som redan är prövat (ålder och BAS inom yrket) och frågor till verksamheten — samt
diagram som bild. Kopiering sker via urklipp som formaterad text utan typsnitt och färger, så att mallens format
tar över; reserven är markering respektive PNG-nedladdning. Rapportunderlaget är block att klistra in; det
samlade Word-utkastet är en egen export (ADR-37, ADR-40). Bedömningen av sakliga skäl kräver kunskap som bara
verksamheten har (uppdrag, prestation) och skrivs utanför verktyget (§2). Gruppurvalet bor i
`src/lib/rapportunderlag.js` och används också av Lika arbetes EU-tabell. Underlaget följer k-regeln strikt:
kandidatpar med en grupp under tröskeln får inget block, fast fliken Likvärdigt arbete är undantagen.

**ADR-21 — Alla BAS-intervall ingår (upphävd begränsning).** Till och med 2026.10.19 analyserades bara BAS A–J;
personer i K och högre räknades men uteslöts. Efter användartest ingår all personal: lönekartläggningen ska
omfatta hela organisationen, och chefsnivåerna är ofta de grupper där könsskillnaden är störst. Rimlighetskontrollen
kräver bara att BAS är en bokstav; små intervall skyddas av minsta gruppstorlek vid export.

**ADR-22 — Var uppstår löneskillnaden? Uppdelning på medellön.** Blinder-Oaxaca säger hur stor del av gapet som
är "förklarat", men inte var det uppstår. Översiktens avsnitt och ett block i rapportunderlaget (efter
Sammanfattning) delar därför skillnaden i medellön, män minus kvinnor, i tre delar som summerar exakt:
**BAS-fördelning** (struktur), **AID inom BAS** (likvärdigt arbete) och **lön inom samma AID och BAS** (lika
arbete), visade som en trappa. Varje steg delas symmetriskt med kvinnors och mäns genomsnitt som vikt, så inget
kön är referens; saknas ett kön i en grupp får det andra könets medellön och gruppen bidrar bara till
fördelningsdelen. Grupposterna mäts mot snittet (centrering), vilket inte ändrar summorna men gör varje post
tolkbar. **Medellön, inte median:** bara medelvärden ger delar som summerar; mediankvoten visas bredvid.
**Rangordning efter bidrag i kronor** till hela skillnaden — medvetet annorlunda än Lika arbetes sortering efter
skillnadens storlek, och avsnittet säger det.

**Skyddet:** en grupp namnges bara om varje kön som finns i den har minst k personer, och en AID-post dessutom
bara om dess BAS klarar samma krav (BAS:ens medellön ingår i posten). Dolda grupper redovisas bara med antal,
och poster som avrundas till 0 kr visas inte. Topplistan kortas efter en skyddsregel, så att ingen dold grupps
bidrag går att räkna fram som delens summa minus de visade posterna: för varje dold post ska summan av |belopp|
för de andra posterna som inte visas vara minst hälften av postens belopp. Går det inte ens med tom lista
redovisas inga delar, bara hela skillnaden. Översikten och rapportunderlaget visar samma poster. Logiken i
`src/lib/gapuppdelning.js`.

**ADR-23 — Personer att granska: individlista i verktyget, aldrig i utdata.** Den tredje delen i ADR-22
(lön inom samma AID och BAS) säger hur mycket av gapet som ligger inom samma AID och BAS, men inte hos vilka. Panelen sist i Lika arbete listar personer vars
lön ligger minst X % (standard 10, inställbar 5–30) under en förväntad lön räknad från **kollegorna** i samma
AID och BAS — personen själv räknas inte med, annars drar den egna lönen förväntningen mot sig. Förväntan är
`ln(lön) = a + b · ålder` när kollegornas åldrar skiljer sig minst 5 år, annars deras medianlön. Bara grupper
med minst 10 personer prövas. Listan visar de 200 största avvikelserna och resten på begäran ("Visa alla"), så
att fliken inte blir seg med tusentals rader. Båda könen flaggas och kön visas; sammanfattningen jämför kvinnors
andel bland de prövade och de flaggade.
**Identifiering med filens radnummer:** inläsningen sparar `radnr` (Excel-numrering) på varje rad via en
`Symbol` på råraden, så att PII-detektorn och fältvitlistan inte ser den som en kolumn; ingen ny identifierare
samlas in. Ett citerat CSV-fält med radbrytning förskjuter numreringen efter sig — accepterad begränsning.
Extremvärdesdetektorn visar samma radnummer. **Utdata:** samma princip som ADR-14 (den som använder verktyget
har redan rådatan), men utan exportval — tabellen har inga exportverktyg, listan ingår inte i rapportunderlag,
Word-utkast, PDF, Excel, JPA eller zip och döljs vid utskrift. Panelens diagram går inte heller att exportera
(`markeraUtanExport` med skälet `individer`, ADR-39). k-invarianten undantar panelen på samma sätt som Utforska; ett eget test kräver att en
flaggad persons lön inte finns i utdata. Logiken i `src/lib/individflaggor.js`.

**ADR-24 — Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering.** I små yrkesgrupper kan en enda
persons lön avgöra om skillnaden i medianlön hamnar över eller under 5 %. Varje flaggad grupp prövas därför:
kan skillnaden bli 5 % eller mindre om en respektive två personer tas bort? Gruppen märks *skör* (1 eller 2
personer) eller *stabil* i tabellen och i rapportunderlagets gruppblock. **Flaggan ligger kvar** — 5 %-gränsen
är direktivets och verktyget släpper inte grupper; märkningen visar var enskilda löner avgör utfallet. **Exakt
värsta fall:** en median beror bara på hur många värden som ligger på vardera sida, så det räcker att pröva
ytterlägena och positionerna inom 2 från medianen i de sorterade lönelistorna (att ta bort själva medianvärdet
kan ge det läge som kommer närmast lika lön). Metoden är verifierad mot uttömmande prövning av alla 1- och
2-borttagningar på 200 slumpade grupper. Borttagningar som skulle lämna ett kön med färre än k personer prövas
inte; ett kön med exakt k anges ("prövat bara på män/kvinnor"). Kunde bara en borttagning prövas (ett kön har
exakt k, det andra k + 1) säger märkningen det i stället för att påstå att två prövats. Kontrollen prövar datan;
robusthetspanelen i Dokumentera prövar inställningarna. Logiken i `likaArbeteGrupper`
(`src/lib/rapportunderlag.js`).

**ADR-25 — Lägre krav, högre lön: jämförelse över BAS-gränserna.** Med BAS som krav-proxy bildas kandidatparen
bara inom samma BAS, så lagens "likvärdiga **eller lägre** krav" fångas inte av dem. Likvärdigt arbete har
därför en **egen lista**, *Lägre krav, högre lön*: kvinnodominerade yrken med lägre medianlön än ett av
**organisationens egna** icke-kvinnodominerade yrken i strikt lägre BAS. Ingen reserv ur jämförelsestatistiken:
en jämförelse över BAS-gränsen mot extern statistik blir dubbelt osäker. Alla lägre BAS ingår, med antalet
BAS-steg utskrivet; BAS-rangen är bokstavsordningen (§5). Samma `minGapPct` och bootstrap-KI som kandidatparen.
Listan är egen för att kandidatparen och allt som bygger på dem — handlingsplan, JPA, exporten, värmekartan —
inte ska bero på den, och för att den vilar helt på att BAS-ordningen speglar kraven. Poängläget beräknar inte
listan: där jämför kandidatparen redan över BAS-gränserna. Rapportunderlaget har ett eget block efter
Likvärdigt arbete (par där båda grupperna har minst k personer, med frågorna till verksamheten). Logiken i
`byggParLagreKrav` (`src/lib/likvardighet.js`).

**ADR-28 — Organisationspaket; ingen inbyggd organisation.** Verktyget ska kunna användas av vilken arbetsgivare
som helst och har därför ingen inbyggd organisation och ingen inbyggd referens. Utan ställningstagande visar
Prioritering, Lönepolitik och statusrutan ett tomläge; profilen är neutral ("Er organisation",
"jämförelsestatistiken"); inga interna namn bär ett organisationsprefix. Demoläget har en påhittad
*Exempelkommunen* med påhittat ställningstagande.

En systemägare samlar organisationens benämningar, grundinställningar (PO-påslag, period, minsta
gruppstorlek), ställningstagande och jämförelsestatistik i ett **organisationspaket** — en JSON-fil
(`.lonepaket.json`, version 1) som skapas och läses i verktyget (panelen *Organisationspaket* på Översikt), så
att handläggaren läser in allt i ett steg. Bara vitlistade fält läses; paketet avvisas om det innehåller något
som liknar personnummer eller e-post; det innehåller bara aggregat och lagras aldrig. Exporter och Word-utkast
anger referensens och statistikens källa (egen fil, organisationspaket med organisation och datum, eller
demoläge). Reserven för kvinnoandel är SKR:s personalstatistik (ADR-34).

Vakten `vakt: inga spår av tidigare versioner eller namngivna organisationer` i `tests/dokumentation.test.js`
kräver att ingen namngiven organisation står någonstans i repot. Logiken i `src/lib/organisationspaket.js`,
gränssnittet i `src/app/29-organisationspaket.js`; systemägarens guide `docs/anvandare/organisationspaket.md`.

**ADR-29 — Ett steg är klart när dess punkter är hanterade.** Processöversikten markerar ett steg som klart när
arbetet med det är gjort, inte när analysen har körts — annars står steget som klart precis när arbetet börjar.
Steg 3 (Lika arbete) är klart när regressionen gått att köra och alla punkter i Att göra i kategorierna *Lika
arbete* och *EU 2023/970* är avbockade; steg 4 (Likvärdigt arbete) är klart när analysen inte hittar några
kandidatpar eller när alla kandidatpar i Att göra är avbockade. Har analysen bara par med en grupp under
tröskeln (de redovisas bara i fliken Likvärdigt arbete) är steget inte klart utan har tillståndet *inget att
hantera* med antalet par och en hänvisning till fliken (beslut av produktägaren 2026-10-16). Att göra tar med
kandidatparen även utan jämförelsestatistik (paren kommer i första hand ur organisationens egna yrken). *Börja här* sorterar inom samma
prioritet: underlaget först, sedan de könsrelaterade fynden, sist avvikelser mot lönepolitiken och övriga
iakttagelser. Reglerna bor i `src/lib/attgora.js`. **Vakter:** `tests/attgora.test.js` och `tests/smoke-innehall.test.js`.

**ADR-30 — Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden.** Verktyget hade omkring
780 `style="…"` i sidans skal och i flikarnas mallar, och fick därför ha inline-CSS i attribut tillåten. De är nu
flyttade till klasser i stilmallen (layout, avstånd och text till ett namngivet hjälpklassbibliotek, §6; färgerna till klasser per status, ADR-43; uträknade mått till `data-stil-*`
som `tillampaDataStil()` i `03-hjalpfunktioner.js` sätter via CSSOM), och CSP-direktivet är uppdelat så här:
`style-src-elem` listar SHA-256 för den byggda filens statiska `<style>`-block, `style-src-attr 'none'` förbjuder
attributen (direktivet måste skrivas ut: utan det gäller `style-src`), och `style-src 'unsafe-inline'` står som
reserv för webbläsare utan stöd för de två direktiven. CSSOM-ändringar (`el.style.display = …`) täcks inte av
CSP:n och används kvar för synlighet och uträknade mått. Ett bibliotek som skapar en egen `<style>`, och en
injicerad markering med `style="…"`, blockeras. Inte heller exportmallarna har några: Word-vägen tolkas med
`DOMParser`, som ärver CSP:n, och PDF-rapporten (`#print-report`) ligger i dokumentet; båda använder klasser.
Utskriftsfönstret, som ärver verktygets CSP, får sina stilar via CSSOM och en egen CSP-meta, och rubriken
escapas. Beroendena är låsta: `vendor/SHA256SUMS` låser tredjepartsbiblioteken, CI-stegen är låsta på
commit-SHA, och `esc()` finns i en enda kopia, i `01-html-och-tillganglighet.js`. **Vakter:**
`tests/sakerhet.test.js` (CSP:n kräver `style-src-attr 'none'`; en statisk vakt mot ` style="` i `index.html` och mallarna) och webbläsarröktestets räknare för `securitypolicyviolation`.

**ADR-31 — Interna fel rapporteras i stället för att sväljas.** Analysdelar som ska tåla fel — Att göra,
färdigchecken, handlingsplanens förifyllnad, gruppdossiern, iakttagelserna, processöversikten, omritningen
efter byte av referens och omritningen efter ändrad tröskel — hoppar över sin del om något kastar, men anropar
`rapporteraFel(plats, e)` (`03-hjalpfunktioner.js`). Platsen sparas i `state._interntFel`, en banner säger att
resultatet kan vara ofullständigt, och konsolen får en varning med plats och feltyp där siffrorna i meddelandet
är maskerade (konsolen ska aldrig bära lönedata). Rensningen nollställer listan. Avsiktliga `catch` — nekad
urklippsbehörighet, teckenkodningsreserven — rapporterar inte. **Vakter:** `tests/smoke-ansvar.test.js` (ett
framtvingat fel syns; demot med alla flikar ger inga interna fel), `tests/attgora.test.js` och
webbläsarröktestet.

**ADR-33 — AID-hierarki, sektorsöversikt, ansvarskod och kodkvalitet.** Verktyget känner AID enligt SKR:s
handbok (2020) och etikettlista. **Sektor = AID-huvudområde** (13 st, första två siffrorna); mellannivån är de
fyra första. Sektorerna är en **översikt** (kortet *Per sektor* i Struktur & rapportmått, Excel-blad,
rapportunderlag) och en dimension och ett urvalsvillkor i Utforska — inte ett globalt filter, eftersom ett
filter skulle ändra alla flikars resultat och k-skydd samtidigt. Sektorsöversikten visar även hur stor del av
organisationens skillnad i medellön som beror på att kvinnor och män arbetar i olika sektorer.
**Etikettlistan** (version 2026-09-23: kod, etikettnamn, möjliga ansvarskoder — inga beskrivningar) genereras av
`tools/gen-aid-etiketter.mjs` till `src/lib/aid-etiketter.js`; Excelfilen checkas inte in. Demo och testdata
använder riktiga koder. **Ansvarskoden** är valfri, läses bara om minst 95 % av värdena är giltiga, och en
kolumn som bara heter *Ansvar* läses aldrig (ofta ett kostnadsställe). Koderna grupperas i tre
**ansvarsgrupper** (ledningsansvar A/B/C/L, särskilt uppdrag F/M/1001/1002, inget). Ansvaret redovisas
**bredvid** huvudresultaten: underrader i Lika arbete med samma k-regel som yrkesraden, en egen rad under
förklaringsbudgeten i regressionen — **huvudtalet räknar inte bort ansvaret**, eftersom om ansvaret är ett
sakligt skäl är arbetsgivarens bedömning. Små yrkesgrupper kan slås ihop till nästa AID-nivå **bara i
Utforska**, aldrig i Lika arbete, där yrket är jämförelseenheten. **Kodkvaliteten** prövas i Underlagets
kvalitet (`src/lib/aidkontroll.js`): okända koder, andel restkoder (…090), lönespridning inom AID och ansvarskod
mot etikettlistan. Metodtexten ("AID är inte ett arbetsvärderingssystem …") står i Om verktyget, Lika arbete och
Word-utkastet. **Vakter:** `tests/aid.test.js`, `tests/sektor.test.js`, `tests/ansvar.test.js`,
`tests/aidkontroll.test.js`, AID-avsnitten i `tests/smoke-ansvar.test.js` och `tests/kanonymitet.test.js` (sektorer
och ansvarsunderrader).

**ADR-34 — SKR:s personalstatistik som referens för kvinnoandel.** Kvinnoandelen per AID-etikett kommer ur
SKR:s personalstatistik för november 2025 (Tabell 4 KP och Tabell 5 RP: antal anställningar och andel kvinnor
per AID-etikett i kommuner respektive regioner) — en källa med dokumenterat ursprung som täcker etikettlistan.
`tools/gen-skr-personal.mjs` genererar `src/lib/skr-personal.js` (Excelfilerna checkas inte in; `npm run gen:skr`
när SKR publicerar nya siffror), och `src/lib/skrreferens.js` slår upp andelen för en AID-etikett — kommuner och
regioner tillsammans, vägda med antal anställningar; där SKR döljer andelen (små tal) räknas den del som
redovisas, annars prefixet — samt för ett prefix och en sektor. **Två användningar:** (1) reserven i Likvärdigt
arbete när jämförelsestatistiken saknar kvinnoandel, per etikett (`nationellAidKlass`); (2) ett
**referensvärde** bredvid organisationens egen könsfördelning: kolumnen *Kvinnor, SKR* i Lika arbete och
sektorsöversikten (med Excel och rapportunderlag), *% kvinnor, SKR* i Likvärdigt arbetes yrkeslistor och paren,
gruppdossiern och Om verktyget. Referensen är nationell statistik och påverkar inga k-regler.
**Organisationstyp:** valet *Organisationen är* (en kommun, en region, eller båda) styr vilken del av
statistiken som är referens — både referensvärdena och reserven i Likvärdigt arbete. Värdet bor i profilen
(`orgTyp`), följer med organisationspaketet (`profil.organisationstyp`) och konfigurationsfilen (`ui.orgTyp`), är
*båda* som standard och efter rensning, och *kommun* i demot. Finns ett yrke inte alls i den valda delen (t.ex.
barnmorskor i kommunerna) används båda delarna, och texten säger vilken del som använts.
**Vakter:** `tests/skrreferens.test.js`, `tests/aid.test.js` och röktesterna för referensvärdena.

**ADR-35 — Jämförelsestatistik: alla percentiler i en tabell och två diagram.** Tabellen visar **P10, median och
P90 i tre block** — organisationens värde, jämförelsens värde och skillnaden i procent — och ett reglage väljer
*källa* (jämförelsestatistiken eller ställningstagandet). Filter för BAS-intervall och sektor
(AID-huvudområde) avgränsar tabell och diagram. Två diagram: *Var ligger vi i marknadens spann?*
(organisationens P10–P90 ovanpå källans, med medianerna) och *Vilka yrken avviker mest?* (skillnaden i median
rangordnad, med skillnaden i P10 och P90 som trianglar; klick markerar raden i tabellen). Diagrammen visar högst
25 yrken med en not; tabellen har alla. **En beräkning:** `src/lib/jamforelse.js` räknar raderna (AID + BAS)
som tabellen, diagrammen och den samlade Excelexporten läser, så att de inte kan säga olika saker. **Bredden**
(P90/P10) finns bara i exporten. **k-gränsen:** organisationens P10, median och P90 visas från tröskeln
(standard 10 personer) i yrke och BAS. En gräns på 20 personer för P10 och P90 övervägdes: med 10–19 personer
ligger P10 och P90 nära den näst lägsta respektive näst högsta enskilda lönen och är statistiskt osäkra. Värdet
pekar inte ut vem, och medianen har samma egenskap vid udda antal — användaren valde tröskeln.
**Tillgänglighet:** en källa som inte är inläst är `aria-disabled` (inte `disabled`), så att flikraden fungerar
med piltangenterna, och tabellhuvudet är statiskt, så att sorteringen håller när innehållet byts. Valen sparas
i konfigurationsfilen (`ui.jamforelse`). Excelrubrikerna för jämförelsekolumnerna namnger den valda källan.
**Fliken kräver jämförelsestatistik:** med bara ett ställningstagande är den dold, och jämförelsen mot
ställningstagandet görs i fliken Lönepolitik. Inom fliken kan man välja ställningstagandet som källa.
**Vakter:** `tests/jamforelse.test.js`, röktesterna för fliken och diagrammen, k-testerna för export, tabell och
diagramdata, golden för den samlade exporten och webbläsartestet.

**ADR-36 — Översikt: filrutorna syns alltid; namn på organisationen och jämförelsestatistiken.** De tre
filrutorna syns alltid, så att ställningstagandet och jämförelsestatistiken aldrig döljs bakom en hopfälld rad.
Efter inläsning är de kompakta (filnamn, namnfält, *Byt fil*, för lönefilen även *Kolumnmappning*), och
släppytan och hjälptexten visas bara innan en fil är inläst. Demots ställningstagande markerar sin ruta.
Organisationspaketet ligger som en ihopfälld rad som visar organisationstypen. Ordningen efter inläsning:
nyckeltal (kvinnor och män), Att göra, processen, Underlagets kvalitet och Var uppstår löneskillnaden?
**Underlagets kvalitet** är sammanfattad på en rad ("n av m kriterier OK" och avvikelserna) med detaljerna —
kriterierna, rimligheten, inläsningen, extremvärdena och konsistensrutan — i en `<details>` som är utfälld när
något kriterium är Varning eller Kritisk. Välkomstrutan är en rad, och *Prova med demodata* finns bara där.
**Namnen:** organisationens namn lagras i `profile.name` och jämförelsestatistikens i `profile.benchmarkLabel`
(genitiv och kortform räknas fram, `src/lib/namn.js`). `orgNamn(standard)` och `jmfNamn(standard)` är enda
källan för etiketterna — diagramserier, tabell- och Excelrubriker, beräkningsbevis — medan löptext står kvar.
Utan namn används standardetiketterna. Fältet på Översikt och fältet i Dokumentera är samma namn, och
Word-utkastet och utskriften läser det. Alla tre namnfälten (även ställningstagandets) avvisar text som liknar
personnummer eller e-post (`liknarPersonuppgift`, samma mönster som organisationspaketet). Namnen följer med
konfigurationsfilen och paketet. **Vakter:** `tests/namn.test.js`, röktesterna för Översikt och namnen, vakten
mot hårdkodade etiketter i `tests/sakerhet.test.js` och webbläsartestet.

**ADR-37 — Word-utkastet som riktig .docx.** Utkastet skrivs som Office Open XML, eftersom HTML med ändelsen
`.doc` får Word att varna och öppna filen i skyddad vy, och Word på webben, LibreOffice och Google Dokument
hanterar det sämre. `_utkastTillBlock` gör om utkastets HTML (ritad ur rapportmodellen, ADR-40) till block
(rubriker, stycken, tabeller); `src/lib/docx.js` skriver XML-filerna (Word-standardens rubrikstilar
`Heading1`–`Heading3`, `Dampad`, `FyllIn`, `Utkastruta`, tabeller med upprepad rubrikrad som inte delas mellan
sidor, A4, sidfot med "UTKAST" eller "DEMODATA, UTKAST" och "Sida X av Y", metadata med titel och skaparen
"Öppen lönekartläggning" men inga namn), och JSZip packar filen. "[HR fyller i]" är gula stycken, inte
innehållskontroller. *Avvisat:* inbäddad HTML (altChunk), eftersom Word på webben, LibreOffice och Google
Dokument inte hanterar den. Kontrollerat med LibreOffice (headless konvertering till PDF). **Vakter:**
`tests/docx.test.js`, röktesterna (zip:en läses tillbaka), golden för `word/document.xml`, webbläsartestet i
Chromium och Firefox.

**ADR-38 — K-tröskeln är en inställning.** Minsta gruppstorlek för redovisning är en inställning, så att en
arbetsgivare med egna riktlinjer kan följa dem. All kod läser värdet genom `kTroskel()` (läser
`state.kTroskel`, standard `K_STANDARD = 10`, tillåtet intervall `K_MIN = 2` till `K_MAX = 1000`), och
`sattKTroskel(v, { fraga, rita })` är enda vägen att ändra det. Fältet ligger i panelen Inställningar (ADR-41),
med en återställningsknapp. Värdet bärs av konfigurationsfilen (`kTroskel`; en fil utan fältet lämnar gällande
värde orört, så att en fil aldrig tyst sänker ett strängare värde; ett ogiltigt värde avvisar filen) och av
organisationspaketets `installningar.kTroskel` (valfritt; ett paket utan fältet lämnar värdet, ett ogiltigt
värde ignoreras med en varning; paketformuläret fylls i med gällande värde, fältet får tömmas — då anger paketet
ingen tröskel — och ett ogiltigt värde i formuläret stoppar sparandet med samma felmeddelande som fältet).
*Övervägt:* "bara höja", "golv vid 5", "styrt av organisationspaketet" och "fritt, med varning"; det sista valdes
av upphovspersonen. **Följd:** verktyget utlovar ingen lägsta nivå. I stället gäller att en sänkning till ett
värde under 10 kräver bekräftelse (från fältet, en konfigurationsfil eller ett organisationspaket; nekas den
behålls värdet och resten av filen läses in), att en varning som inte går att stänga står överst på alla
flikar, och att utdata anger värdet. Varningsraden finns inte i utskriften (all utskrift går genom
`#print-report`); i stället bär utskriftsrapporten och den utskrivna handlingsplanen meningen om sänkt tröskel
direkt under rubriken. Inget lagras: nästa session börjar på 10. Organisationspaketet kan sätta ett golv som
värdet inte får gå under (`installningar.kTroskelLagst`, ADR-47); `sattKTroskel()` avvisar då lägre värden
som ogiltiga, oavsett varifrån de kommer.

**Omritningen:** när värdet ändras töms cacherna och flikarna som inte syns, och det som syns ritas om: den öppna
fliken och de delar av Översikt som inläsningen ritar men flikbytet inte gör — nyckeltalen,
kompliansöversikten, underlagets kvalitet, Att göra (vars CSV-knapp bär listan den ritades med),
processöversikten, inläsningsrapporten, extremvärdeslistan och en visad A/B-jämförelse
(`_renderaOmAllaFlikar`). Exportgrinden (`23-exportgrind.js`) ritar om en flik innan något exporteras ur den, så
att ingen export kan bära tal från en tröskel som inte gäller (ADR-40). Från fältet ritas allt om ett steg i
taget, med en ruta som visar förloppet och tar emot alla klick och tangenter tills omritningen är klar.
Inläsning av konfigurationsfil och organisationspaket sätter värdet med `rita: false` och gör omritningen
själva, sist, så att allt ritas en gång.

**Värdet i utdata:** metodbilagans rad *Minsta gruppstorlek för redovisning* (alltid), diagramdatans första rad
(alltid), tabell-CSV:ens sista rad (alltid), rapportunderlagets sammanfattning (alltid); under 10 därtill
meningen "Tröskeln är sänkt från standardvärdet 10." i diagrambilder (PNG, SVG, ZIP, rapportunderlagets
diagramkopia; en rad i bildens nederkant), tabell till urklipp, sidfötter, varje block i rapportunderlaget och
gruppdossierns textkopia. Konfigurationsfilen och organisationspaketet bär värdet som fält. Exporter som hör
till ett undantag anger det (`_kUndantagFor`, `kStampelFor`), och exportnotisen säger att filen innehåller
lönedata och ska hanteras som personuppgifter.

**Statistiska golv följer inte med nedåt:** regression per BAS, Blinder-Oaxaca, bootstrap-KI,
livscykelmodellen, extremvärdesdetektorn, det justerade gapet inom yrke, ansvarsindikatorn och Personer att
granska läser `statGolv()` = `max(kTroskel(), 10)`, eftersom gränsen där gäller skattningens tillförlitlighet.
De följer med uppåt, så att ett skärpt skydd också gäller skattade gruppvärden. Tre fasta golv står som de är
(produktägarens beslut): huvudregressionen i Lika arbete med 5 av varje kön, motiveringsregeln om medelålder
per kön med 3 av varje (`55-prioritering.js`) och Löneöversiktens yrkesrader med 5 (`39-loneoversikt.js`).
Lönepolitikens mellannivå (antal för grupper mellan 5 och k) försvinner när tröskeln är 5 eller lägre. Appens
texter fylls i ur värdet (`data-k-troskel`, `data-k-tooltip` med `{k}` och `{golv}`, `_kText`); dokumenten anger
standardvärdet.

**Könsuppdelade mått:** de beskrivande könsuppdelade lönemåtten — ett köns median eller percentil, det råa
lönegapet, en kostnad som räknats ur ett gap — redovisas per grupp och för hela organisationen bara när varje kön
når tröskeln (`_konFarRedovisas`). Det gäller också `representationByBas`, `medianGapPct`, `distributionalGap`
och `quartileDistribution` i `src/lib/struktur.js`, som tar `{ k }` och visar streck och en not i fliken
Struktur, Word-utkastet, PDF-rapporten och EU-lönerapporten. Kandidatpar ur Likvärdigt arbete redovisas utanför
fliken och dess egen CSV- och Excel-export bara när båda grupperna når tröskeln, med antalet utelämnade angivet
(`_parForRedovisning` i `06-k-anonymitet-och-dataminimering.js`): Word-utkastet, PDF-rapporten,
JPA-protokollet, Att göra och dess CSV, handlingsplanens förifyllda rader, gruppdossiern, Löneöversyns
förslag, mål-läge och känslighetskurva samt robusthetspanelen i Dokumentera & exportera (`robusthetLikvardighet`
i `85-robusthet-fardigcheck.js`: par med en grupp under tröskeln namnges inte i någon körning, och panelen anger
antalet sådana par; beslut av produktägaren). Fyra regler till:

- (R1) *Regressionens ojusterade steg döljs när ett kön är under tröskeln.* Första steget i den stegvisa
  uppdelningen ("Endast kön") är samma slags mått som det råa gapet. `_regStegForRedovisning(reg)` lämnar ut
  stegen utan det första, och ingen förklarad andel, när `_konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed)`
  är falskt; regressionskortet visar då ingen förklaringsbudget, och en mening står i stället för det
  utelämnade. Beräkningen är densamma, och det justerade gapet med konfidensintervall visas från regressionens
  fasta golv, 5 per kön.
- (R2) *Egna riktade rader i Löneöversyn på grupper under tröskeln är tillåtna* (användarens egen simulering):
  beloppet står på raden och ingår i summorna på skärmen och i Excel-exporten, och raden får en not om att
  gruppen är under tröskeln. Beskrivet i `dataskydd.md` §3, `riskanalys.md` §6.5 och körguiden. En rad som
  verktyget självt föreslog ur kandidatpar i likvärdigt arbete bär `kalla: 'par'` och rensas när tröskeln höjs (`_fcRensaParMal`);
  konfigurationsfilen bär fältet (valfritt, version oförändrad), så att en inläst rad behandlas som den rad den
  var: förslag prövas mot gällande tröskel vid inläsningen, egna rader står kvar med noten.
- (R3) *Ålder & karriär följer regeln:* ojusterat och åldersjusterat gap kräver tröskeln för båda könen;
  lutning, trendlinje med konfidensband och låda kräver den för det könet (`40-alder-karriar.js`,
  `_setDiagramKNot` för noten under diagrammet). Demografidelens trendlinje och lutning för hela urvalet
  (alla BAS eller det valda) kräver att urvalet når tröskeln (beslut av produktägaren 2026-10-16); annars
  utelämnas de och noten under diagrammet säger det. Punkterna per person följer sin egen regel (ADR-14).
- (R4) *Lönerevisionssimulatorn är borttagen (2026-10, ADR-50).* Det den kunde — begränsa till ett kön och en
  lönegräns, "höj till" — gör en riktad rad i Löneöversyn, som följer R2: en rad som berör färre personer än
  tröskeln är användarens egen simulering, beloppet visas på raden med noten om enskildas löner. Lönegapet
  före och efter kräver tröskeln för varje kön (`_konFarRedovisasFor`). Vaktas av C3 och röktest.
- (R5) *Löneöversyns tröskelmål följer tröskeln* (`_forecastThreshold`; beslut av produktägaren 2026-10-16):
  lyftet i procent till kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när
  varje kön i urvalet når tröskeln (`_konFarRedovisasFor`), annars ett streck med `_konUtelamnatNot()`.
  Vaktas av `tests/troskelbeslut.test.js`.

**Vakter:** `tests/ktroskel*.test.js` (fem filer med gemensam rigg i `tests/helpers/ktroskel-rigg.js`) kör alla flikar vid 10, 25 och 5 med grupper om 20 och 6 personer vars
löner är sentinelvärden, prövar tur och retur 10 → 25 → 10 mot kvarlevande cacher, kontrollerar flikar och Excel
efter en höjning, gränssnittet, utdata genom de verkliga vägarna, varje exportväg mot exportgrinden samt
konfigurationsfil och organisationspaket, och har en invariant vid 10 och 25 över flikar och exporter mot ett
underlag där ett kön är under tröskeln inuti en större grupp (vad den prövar och inte prövar står i
`riskanalys.md` §6.5 och i testfilens kommentar). Både den och `tests/kanonymitet.test.js` kräver att listan över
prövade flikar är menyns flikar; `tests/dokumentation.test.js` vaktar att dokumenten nämner ADR-38.

**ADR-39 — Diagramkärna på D3 med eget figurformat.** Alla diagram ritas av en egen kärna: vyerna bygger en
*figur* (ren data: axlar, lager av märken, referenser — `src/lib/figur.js`), och `ritaFigur` gör SVG av den med
D3 7.9.0. Kärnan består av tre moduler — mått och layout i `src/app/10-diagramlayout.js`, märkena, färgskalan
och referenserna i `src/app/10-diagrammarken.js`, och ritaren med sidans API, registret och exporten i
`src/app/10-diagramritare.js` — med palett och typografi i `src/app/10-diagramtema.js` och exportmenyn i
`src/app/11-diagramexport.js`. Det egna formatet valdes framför D3 direkt i varje vy eftersom varje datapunkt då
kan bära gruppnyckel och `liten`-flagga, så att skyddet ligger på ett ställe. Kärnan som den är byggd —
formatet, `ritaFigur`, exporten, rensningen, vyernas skyldigheter och kända luckor — beskrivs i
`docs/utveckling/diagramkarnan.md`.

**Skyddet för små grupper är en egenskap hos kärnan:** `ritaFigur` ritar inte datapunkter märkta `liten` om inte
vyn begär det (bara Utforska, ADR-14), och då med ränder och streckad kant, så att markeringen inte bara bärs av
färg (WCAG 1.4.1). Exporterade bilder ritas utan små grupper och diagramdata filtreras med `utanSmaGrupper`, om
inte vyn uttryckligen begär annat (`exportMedSma`, Utforskas kryssruta). Skyddet vaktas av två
differentialtester över samma figurlista (`tests/helpers/ritfigurer.js`): bilden på skärmen, och det som
exporteras (SVG-text och diagramdata), ska vara tecken för tecken det man får av samma figur där de små punkterna
tagits bort. Ett test kräver att inget diagram ritas förbi kärnan.

**Tre regler bär ritaren:** den mäter aldrig text i DOM (samma figur ger samma SVG, även i jsdom och i ett
fristående element); SVG:n bär bara presentationsattribut (inga `<style>`, ingen `foreignObject`, inga `id`,
`defs`, `clipPath` eller `pattern` — klippning och ränder görs med inre `<svg>`); och etiketter lutas aldrig.
SVG:ns rot har `role="group"` och ritytan är en inre `g[role="img"]` med figurens `beskrivning`: förklaringens
knappar ligger utanför bilden, så att hjälpmedel når dem. Lådornas kvartiler räknas med `quantile` ur
`src/lib/stat.js`, så att lådan visar samma percentiler som tabellerna.

**Export:** `figurTillSvg` ritar figuren på nytt utanför sidan i en logisk bredd på 800 och skalar med `viewBox`
till begärd storlek, med vit bakgrund, rubrik och fotrad (datum, urval, en anteckning som vyn räknat ur värden
som får visas), meningen om sänkt tröskel (ADR-38) och — när ritaren nedsamplat — meningen "Visar ett urval (a
av b punkter)." Den fristående SVG:n bär inga index (`data-l`/`data-i`: en lucka i dem skulle visa att en punkt
saknas), inga träffytor och inga knappattribut. `figurTillBild` gör PNG genom att läsa SVG:n som bild från en
`data:`-adress och rita den på en canvas (CSP:n tillåter `img-src data:`). En låda exporteras som statistik per
kategori, aldrig som individer, och ett lager på höger axel (`y2`) får tillägget "(höger axel: …)" i
serienamnet. Underlaget för en export bestäms en gång (ett anrop av vyns `exportMedSma`) och gäller bild,
diagramdata och stämpel; rensas diagrammet medan bilden görs laddas ingenting ner. Finns inget att exportera —
behållaren saknar figur, eller alla punkter hör till små grupper — lämnar ingenting verktyget, och menyn säger
det. Alla vägar som gör bilder av diagram (exportmenyn, ZIP-exporten, rapportunderlagets "Kopiera diagram",
utskriften) går genom samma väg (`diagramTillBild` i `11-diagramexport.js`). **När ett diagram inte får lämna
verktyget** står på ett ställe, `11-diagramexport.js`: vyn märker behållaren med `markeraUtanExport(el, skal)`,
där `skal` måste vara en nyckel i `EXPORT_SKAL` (`individer`: Personer att granska, ADR-23; `kopia`: Översiktens
kopior av Struktur & rapportmåtts diagram), och skälet står i behållarens verktygstips ("Lämnar inte
verktyget: …"). Varje väg frågar `exportTillaten(behållare)`: ingen meny, ingen bild (`diagramTillBild`), ingen
diagramdata, inte med i ZIP-filen eller utskriften. Ett test räknar upp varje märkt behållare i det ritade
dokumentet och kräver ett registrerat skäl.

**Rensning:** `ritaFigur` för ett register över sina behållare; "Rensa all data" och inaktivitetsrensningen
(`_rensaAllData`) rensar dem alla genom `_rfRensaAlla` — oavsett id, också i tomt läge och sedan de lämnat
dokumentet — och tömmer verktygstipset. Ett dolt verktygstips töms alltid (`_hideChartTip`).

**Interaktion:** allt nedan är utseende på redan ritade märken. Det ritar inget nytt, följer inte med i någon
export och sparas inte.
- *Länkade vyer:* ett klick på ett märke som hör till ett BAS-intervall eller en yrkesgrupp markerar gruppen, och
  varje diagram och tabell i verktyget som visar något för gruppen framhäver det, också i andra flikar
  (`11-markering.js`, fältet `markering` i figuren). Med Ctrl, Cmd eller Skift läggs en grupp till eller tas
  bort. En rad nere till höger säger vad som är markerat, erbjuder gruppdossiern och — när exakt ett
  BAS-intervall är markerat — "Visa yrkesgrupperna", som öppnar Utforska med urvalet satt till intervallet.
  Markeringen försvinner med "Rensa all data".
- *Pensling och zoom:* i ett diagram med punkter på två talaxlar kan användaren dra en ruta; en rad under
  diagrammet säger antal och median per serie, räknat bara på ritade punkter. "Zooma hit" ritar om diagrammet
  med områdets omfång som domäner, och exporten säger att den visar ett utsnitt.
- *Tangentbord och pekare:* ritytan tar fokus, piltangenterna går mellan ritade märken, Enter gör det ett klick
  gör, och tipset för märket med fokus visas och läses upp. Tipset och klicket går till närmaste ritade punkt
  (`d3.Delaunay`); på pekskärm visar ett tryck tipset.
- *Övergångar:* märkena flyttar sig mellan två ritningar av samma diagram bara när webbläsaren uttryckligen säger
  att rörelse går bra. Övergången slutar alltid på ritarens egna attribut, så testerna som jämför SVG tecken för
  tecken gäller.

**Vyernas skyldigheter** (kärnan känner inte tröskeln och litar på vyns flaggor):
- *Rita efter att vyn visats.* Ett diagram som ritas medan dess flik är dold har bredden 0 och ritas i
  reservbredden 640; det ritas om vid nästa storleksändring av behållaren.
- *`liten` sätts per cell.* En låda över mycket få individer är de individernas löner. Vyn sätter `liten` på
  varje individ vars cell — lager × kategori (× panel) — har färre individer än tröskeln, och på varje märke som
  aggregerar.
- *`nyckel` på en individ är en gruppnyckel*, aldrig något som pekar ut en person.
- *Figurens `beskrivning`, axeltitlar och `exportBeskrivning` skrivs av vyn* och följer med i exporten som de
  är: de får inte namnge en liten grupp.
- *Domäner räknas bara ur punkter som får visas.* Axelns `doman`, `fargskala.doman`, `referens` och `ordning`
  ritas som de står; en domän eller referenslinje som bygger på en liten grupps värde syns i bild och export.
- *Sätt alltid `farg` på lagren*, så att ett lager som inte ritas inte lämnar en lucka i färgföljden.
- *Stämpeln:* allt i fliken Likvärdigt arbete bär "(undantag: Likvärdigt arbete)"; utanför den bär ett diagram
  "(undantag: valt i Utforska)" bara när exporten faktiskt bär små grupper.
- *Ett vakttest per vy* visar att ingen cell under tröskeln når SVG:n, verktygstipset eller diagramdatan.

**Regler för diagram som visar fördelningar:**
- En stapel eller ett segment som gäller färre än fem personer (`litetUnderlag()`) ritas med prickmönster, och
  tipset och en not säger att underlaget är litet. Det är en varning, inte en maskering: gruppen som stapeln
  räknas i når redan minsta gruppstorlek.
- Täthetskurvor och regnmoln är former av lådmärket (`form: 'fiol'`, `form: 'regnmoln'`) och ärver lådans regler:
  aggregat i träff och tips, median och kvartiler i diagramdatan, små individer borta före alla beräkningar.
  Tätheten skattas med normalkärna och Silvermans bandbredd ur värdena mellan morrhårens ändar; avvikare ingår
  inte och ritas inte.
- Ett histogram med kön mot kön visas bara när båda könen når tröskeln, och ingen klass rymmer färre än
  tröskeln: ändklasserna slås ihop inåt och klassbredden fördubblas tills det håller.
- Trädkartan bär bara antal och könsfördelning, inga löner; yrkesgrupper under tröskeln slås ihop till en grå
  yta per BAS-intervall, utan namn och utan könsfördelning.
- Färgskalan i en värmekarta räknas bara ur värden som får redovisas, eftersom skalans ändar skrivs ut i bilden.

**ADR-40 — Fyra exporter med var sin uppgift, ritade ur en rapportmodell.** **Word-utkastet är rapporten,
Excel-filen är underlaget, PDF-rapporten är en låst kopia av Word-utkastet och ZIP-filen är allt** (Word, Excel
och diagrammen som bilder) — användarens beslut, så att exporterna aldrig säger olika saker om samma underlag.
Rapportens innehåll byggs som data i en rapportmodell (`58-rapportmodell.js`: avsnitt med stycken, typade
tabeller, diagram och fält att fylla i), och både Word och PDF ritas ur den — de kan därför inte glida isär.
Urvalet av avsnitt (hela dokumentationen, ledningsbrief, facklig dialog eller eget) gäller båda. Lönegapet
skrivs i exporterna som på skärmen: kvinnors lön i procent av mäns — utom i EU-lönerapporten och rapportens
avsnitt om lönetransparens, som har direktivets tecken (§ 4, *EU-direktivets rapportmått*). Varje export har ett förhandsbesked om vad
den innehåller och utelämnar (`59-exportbesked.js`). Exporterna läser aldrig en flik som är ritad med en annan
tröskel än den som gäller (exportgrinden, `23-exportgrind.js`), så att en ändrad tröskel bara behöver rita om
det som syns. Word-utkastet och PDF-rapporten bär rapportmodellens diagram över grupper (`RM_DIAGRAM`) som
bilder; övriga diagram följer med i utskriftens bilagor, ZIP-filen och diagrammens egen export. *Avvisat:* att låta PDF-rapporten ha eget innehåll (två sanningar), och särskilda
sammanställningar för ledningsbriefen.

**ADR-41 — Flikmallen: resultatet först.** Alla flikar följer en mall — en rad om vad fliken svarar på (resten
bakom *Visa mer*), urvalet, **nyckeltalen i en sammanhållen rad**, flikens huvudresultat, och under rubriken
*Fördjupning* resten i hopfällbara avsnitt som säger sitt viktigaste tal i rubrikraden. Motiv: huvudresultatet
ska inte ligga flera skärmar ned. Det som gäller alla flikar (minsta gruppstorlek, kommun eller region, läge)
ligger i panelen Inställningar; det som bara används i en flik stannar där (PO-påslag och beräkningsperiod i
Prioritering — användarens beslut). Två lägen: vägledande och kompakt (samma avsnitt öppna, förklaringarna
undanfällda). Sök i sidhuvudet markerar en grupp i alla vyer. *Avgränsning (användarens beslut):* verktyget
anpassas för datorskärm, surfplatta och delat fönster — **aldrig för telefon**. *Skäl till nyckeltalsraden:* med
ett kort per tal fyller texten 3–31 % av kortens yta, och alla kort i en rad blir lika höga som det högsta.

**ADR-42 — Diagrammens form och färg väljs efter uppgiften; tabell med grafik i raden där ett diagram visar för
lite.** Formen väljs efter vad bilden ska säga och färgen efter vad den ska betyda — reglerna står i
`diagramkarnan.md` §10 och gäller varje nytt diagram. En kvot mot 100 % ritas som punkt mot en linje, inte som
stapel från en avkortad axel; en fördelning med få celler är ingen värmekarta. Där kategorierna är få, måtten
flera och enheterna blandade är en **tabell med grafik i raden** rätt form (Lika arbetes översikt,
yrkesgruppstabellen, avvikelsen i Personer att granska). Ett nytt diagram ska ses med många grupper (det
påhittade större underlaget har 42 yrkesgrupper) innan det är klart, eftersom former som fungerar med demodatan
kan gå sönder med fler grupper. Trattdiagrammets gränser är prövade mot simulering; för små grupper bedöms
varje grupp med omkastning av könen i stället för normalformeln. *Avvisat:* kumulativ fördelningskurva per kön
(varje steg är en person), Lorenzkurva (mäter ojämlikhet inom en grupp, inte skillnaden mellan könen), flöden och
tidsserier (verktyget har inga uppgifter över tid, §2).

**ADR-43 — Färgerna har en källa.** Färger som måste vara värden — i Word-filen, urklipp, arbetsboken och diagrammens
attribut — kan inte vara stilmallens variabler, som inte följer med dit. Färgerna står därför i en tabell, `FARG`
i `src/app/01-farger.js`, speglad som variabler i stilmallens `:root` (`--status-kritisk`, `--status-varning`,
`--status-ok` och övriga). Dessa skriver `${FARG.kritisk}`, paletten (`PALETTE.semantic`, `PALETTE.prio`)
pekar dit, och stilmallen och sidans skal använder variablerna. Flikarnas egna mallar skriver ingen färg alls i
markeringen (CSP:n tillåter inga style-attribut, ADR-30): de väljer en klass per status (`fg-ok`, `bg-varning`,
`bl4-kritisk`, `bricka-granska` …, i stilmallens block för ersatta style-attribut), och klassen pekar på variabeln. Tabellen har 33 värden: för varje status
(kritisk, varning, ok, granska, info) text, brickans botten och en ljusare yta, samt de neutrala färgerna (text i
tre styrkor, kanter, ytor), den blå accenten och kanten runt en färgad ruta. Statusfärgerna har minst 4,5:1 mot
vitt och mot sin botten, så att de duger som textfärg (WCAG 1.4.3); i diagrammen har kritisk, varning och ok
minst 3:1 mot vit bakgrund (WCAG 1.4.11), med varningen tydligt ljusare och ok blågrön, så att rött och grönt
inte behöver skiljas åt på färgtonen. `tests/farger.test.js` faller om en färg ur tabellen skrivs ut som hexkod
någon annanstans, om tabellen och stilmallen går isär eller om statustexten har för låg kontrast. Undantag: två
tabellhuvuden i sidans skal som kopieras till urklipp har hexkoden. Diagrammens egna färger (kön, serier,
färgskalor) står i paletten i `10-diagramtema.js`, som är deras källa.

*Stilregler direkt på element:* de vanligaste (högerjustering, dämpad text, små avstånd) är namngivna
hjälpklasser sist i stilmallen, med `!important`, så att de slår som en regel på elementet. Exporternas mallar
(rapportmodellen, Word-utkastet, utskriften, Excel) har stilen i markeringen, eftersom den måste följa med till
Word och urklipp; regler med uträknade värden och regler som bara förekommer någon enstaka gång står också på
elementet, där en klass per regel inte gör något lättare att ändra. Utskriftsfönstret för en enskild flik har
ingen stilmall och får klasserna genom `HJALPKLASSER_CSS` i `60-utskrift.js`.

**ADR-44 — BAS som indikatorvariabler i huvudregressionen.** Huvudregressionen (`runOLSRegression` i
`51-lika-arbete-regressionskort.js`) och den sekventiella dekomponeringens steg *+ BAS-intervall*, *+ Ålder* och
*+ Ansvar* (`_computeSequentialGap` i `50-regressionsmodeller.js`) kodar BAS som en indikator per intervall, med
det alfabetiskt första intervallet i urvalet som referens. Tidigare var BAS ett linjärt tal (bokstavens plats),
vilket antog att varje bokstavssteg är värt lika många procent i lön; det stämmer sällan, och ett felaktigt
linjärt antagande lämnar BAS-nivåskillnader kvar i det "oförklarade" gapet. Med indikatorer får varje intervall
sin egen nivå, och modellen rapporterar nivån per BAS mot referensen (`basEffekter`, `basRef`) i stället för en
effekt "per BAS-steg". Reservsteget kön + ålder finns kvar när fullmodellen är singulär. **Orört:** Blinder-Oaxaca
behåller den linjära rangen, eftersom uppdelningen per komponent (endowment/coefficient/interaction) blir otydlig
spridd över ett dussin indikatorer; kvantilregressionen och per-BAS-regressionerna (som har BAS i urvalet, inte i
modellen) berörs inte. Livscykelmodellen använde redan indikatorer. Talen i golden-facit ändrades av bytet.

**ADR-45 — t-kvantiler för konfidensintervallen; exakt t-fördelning.** Konfidensintervallen i huvudregressionen,
per-BAS-regressionerna och livscykelmodellen räknas som β ± t(0,975; n−k) × SE, med `tQuantile(p, df)` i
`src/lib/stat.js`, i stället för den fasta faktorn 1,96. Vid df ≥ 100 ger funktionen normalfördelningens kvantil
(1,96), samma gräns som `pValue2Sided`; vid färre frihetsgrader är intervallet bredare (df 5: 2,571; df 26: 2,056).
Per-BAS-regressionerna med k personer av varje kön har ofta df kring 20–40, där 1,96 gav för smala intervall.
Kvantilen inverterar `tDistCdf` med bisektion, och för att den ska träffa tabellvärdena byttes `tDistCdf` från
Hills approximation (som gav 2,62 vid df 5) till den exakta formen via den regulariserade ofullständiga
betafunktionen; p-värdena vid små df flyttar sig därför på tredje decimalen. Bootstrap-intervallen, sektorsmodulen
(`src/lib/sektor.js`) och jämförelsens osäkerhetsband i Lika arbete är orörda.

**ADR-46 — Steget *+ Yrkesgrupp*: könsgapet med fasta effekter för yrkesgrupp inom BAS.** Huvudmodellen
kontrollerar för BAS men inte för yrkesgrupp (AID), så det "oförklarade" gapet innehåller löneskillnader mellan
yrken i samma BAS-intervall — som att kvinnorna finns i det lägre betalda av två yrken i BAS C. Den sekventiella
dekomponeringen får därför ett sista steg, *+ Yrkesgrupp* (`computeYrkesgruppGap` i `src/lib/regression.js`):
könsgapet efter fasta effekter för AID×BAS (AID-koden, eller yrket när AID saknas, inom BAS — samma nyckel som
likvärdighetsmotorn) utöver ålder. Steget skattas med inomtransformation: gruppmedelvärdet dras av från log-lön, kön och
ålder inom varje grupp, sedan OLS utan intercept på de transformerade variablerna. Det ger samma könskoefficient
som en indikator per grupp (Frisch–Waugh–Lovell; `tests/smoke-innehall.test.js` prövar likheten) men går på 55 000 rader
utan en designmatris med hundratals kolumner. R² räknas mot lönens totala variation så att den är jämförbar med
stegen före. Grupper med färre än `statGolv()` av något kön ingår i skattningen — gruppmedelvärdet är ett
mellanled, inte ett redovisat värde — men bara grupper med båda könen bidrar; steget redovisar hur många grupper
och personer det bygger på och hur många grupper som är enkönade. Steget visas i regressionskortet som en rad
efter huvudtalet, med meningen att det är löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och
ålder, och i förklaringsbudgeten som delen *Förklaras av yrkesgrupp inom BAS*; i rapportmodellen står det som
en rad i dekomponeringstabellen med samma mening. **Huvudtalet "oförklarad löneskillnad"** i kortet, Word-utkastet
och PDF-rapporten är fortfarande steget *+ Ålder* (kön + ålder + BAS); den förklarade andelen, trappan och
ansvarsraden räknas som förut till och med det steget. Beslut 2026-10-16: steget blir inte huvudtalet;
huvudtalet förblir modellen med kön, ålder och BAS-indikatorer. Metodtexterna (regressionskortet, metodbilagan
och *Om verktyget*) säger detsamma.

**ADR-47 — Organisationspaketet kan låsa tre skydd.** Minsta gruppstorlek (ADR-38), rensningen vid inaktivitet
och rutan *Ta med grupper under tröskeln i exporten* i Utforska (ADR-14) kan handläggaren annars ställa in
själv; en säkerhetsgranskning fann att systemägaren inte kunde tvinga något av dem. Paketets `installningar`
får därför tre valfria fält: `kTroskelLagst` (heltal 2–1000), `inaktivitetMin` (0 eller 5–120) med
`inaktivitetLast` (boolean) och `smaGrupperIExport` (boolean, standard tillåtet). Alla tre normaliseras i
`src/lib/organisationspaket.js` (`_lasningar`): ett ogiltigt värde utelämnas med en varning, läget av (0) kan
inte låsas, och paketets egen `kTroskel` under golvet höjs till golvet. Låsningarna bor i `state.paketLas`
(`{ kTroskelLagst, inaktivitetMin, smaGrupperIExport }`), sätts bara av `lasInPaket()` och återställs av *Rensa
all data* tillsammans med paketet; konfigurationsfilen bär dem inte, så en fil kan varken sätta eller häva en
låsning. **Golvet:** `sattKTroskel()` avvisar ett värde under `kTroskelLagst()` med felet "Lägst N enligt
organisationspaketet", oavsett om det kommer från fältet, en konfigurationsfil (`applyConfigSnapshot` returnerar
det som varning och visar felet vid fältet; resten av filen läses in) eller ett annat paket; fältets hjälptext
och `min` visar gränsen, återställningsknappen går till `max(10, golvet)`, och en gällande tröskel under golvet
höjs när paketet läses in (en höjning frågar inte). Ett nytt paket med lägre eller inget golv kräver bekräftelse
(samma `confirm` som vid sänkt tröskel); nekas den står det gamla golvet kvar och resten av paketet läses in.
*Övervägt:* att låta golvet gälla alla senare paket utan fråga — förkastat, eftersom en organisation måste kunna
byta paket utan att rensa allt. **Rensningstiden:** `setInactivityTimeout()` tar inte emot något annat än det
låsta värdet; rullistan i *Vad lagras?* är låst (`disabled`) på värdet, som alltid finns bland alternativen, och
en rad säger att organisationspaketet har låst tiden. Ett `inaktivitetMin` utan `inaktivitetLast` är en
förinställning som handläggaren får ändra. **Exporten:** `explorerSmaIExport()` är enda vägen att läsa rutan
(Utforskas tabell, figurens `exportMedSma` och exportgrindens undantagstext); när paketet inte tillåter små
grupper är rutan dold och avkryssad, svaret alltid nej, och `#explore-sma-last` säger varför. Paketformuläret
har de tre fälten (ett ogiltigt värde stoppar sparandet, som för tröskeln), faktarutan listar låsningarna.
Vaktas av `tests/organisationspaket.test.js` (normaliseringen), `tests/ktroskel-regression.test.js` (golvet från fältet,
konfigurationsfilen och ett nytt paket), `tests/smoke-organisation.test.js` (rullistan) och `tests/kanonymitet.test.js`
(rutan dold och exporten utan små grupper). Dokumenterat i `docs/anvandare/organisationspaket.md` §5,
`docs/dataskydd/dataskydd.md` §3 och riskanalysen B2b.

**ADR-48 — Bilder med en punkt per person följer med i ZIP och Komplett rapport.** Beslut 2026-10-16. ZIP-exporten
(`66-zip-export.js`) bär bilder av alla ritade diagram, och utskriftens mall *Komplett rapport* (hela
dokumentationen, `60-utskrift.js`) bär i sina bilagor bilder av Ålder & karriärs spridningsdiagram, låddiagram
och täthetsdiagram — diagram med en punkt (eller en avvikare) per person. Word-utkastet och rapportens avsnitt
ritas ur rapportmodellen (`RM_DIAGRAM`) och har inga sådana diagram; de kortare utskriftsurvalen (ledningsbrief,
facklig dialog) inte heller. *Övervägt:* att utelämna bilderna ur ZIP och Komplett rapport, eller ersätta dem med
aggregerade diagram. *Beslut:* behåll som i dag. *Motivering:* bilderna bär inga namn eller identifierare — en
punkt är lön, ålder och kön — och en persons punkt ritas bara när personens grupp och kön i gruppen når
tröskeln (ADR-14); filerna hanteras som personuppgifter (riskanalysen §8, punkt 1), och exportnotisen säger det.
Dokumenterat i `dataskydd.md` §3 (undantag 4) och §4 samt riskanalysen §6.6; inte prövat av k-invarianten,
eftersom innehållet i en bild inte går att läsa i testet (riskanalysen §6.5).

---

**ADR-49 — Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida.** Systemägaren kan i
panelen Organisationspaket peka ut verktygsfilen, välja filnamn och ladda ner en *organisationsfil* där
organisationspaketet ligger som en inaktiv datablock (`<template id="inbakat-organisationspaket">`) sist i
filen, efter sista skriptet — samma mönster som licenstexterna, så att CSP:ns per-script-hashar är orörda.
Vid start läses blocket in på samma väg som en paketfil (`lasInPaket`, `kalla: 'inbakat'`); *Rensa all
data* tar det inbakade tillbaka eftersom det är en del av filen; demoläget (`?demo=1`) går före; en inläst
paketfil ersätter det inbakade för sessionen. Handläggaren kan granska (*Visa paketet*) och ladda ner det.
Filen anger verktygets version och verktygsfilens SHA-256 men verifieras inte mot den publicerade
versionen (produktägarens beslut 2026-10-19: att den kommer från systemägaren internt räcker). Filväljaren
behövs eftersom en sida från disk inte kan läsa sig själv, och automatisk inläsning av en fil i samma mapp
är omöjlig (webbläsaren och `connect-src 'none'`). Ren kärna i `src/lib/organisationsfil.js` (`bakaIn`,
`lasUt`), vaktad av `tests/organisationsfil.test.js` (inget skript rörs), röktester i
`tests/smoke-organisation.test.js` och webbläsarröktestet. Lönedata bakas aldrig in: `skapaPaket()` läser
aldrig `state.data`. Design: [`organisationsfil-design.md`](organisationsfil-design.md).

**ADR-50 — Prioritering är vad, Löneöversyn är hur.** Beslut 2026-10-29 efter användartest: de två flikarna gick
in i varandra. Prioritering svarar på vad som bör åtgärdas och vad det kostar (matris, åtgärdslista, kostnad);
Löneöversyn på hur potten fördelas (budget, generellt påslag, riktade potter, utfall, scenarier). Lönerevisions-
simulatorn i Prioritering är borttagen (`14-lonesimulator.js`); en riktad rad i Löneöversyn kan i stället begränsas
till ett kön (`kon`) och till löner under en gräns (`lonCap`), och lyfta till en nivå (`mode: 'till'`) —
`targetRows` i `src/lib/loneoversyn.js` är radens urval. PO-påslag och beräkningsperiod, som all kostnad räknas
med, står under Inställningar i sidhuvudet (*Gäller alla flikar*) i stället för i Prioritering.

**ADR-51 — Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen.** Beslut 2026-10-29 efter
användartest: den som arbetar i verktyget har redan lönefilen, så vyerna maskerar inga grupper. `kTroskel()` är 1 i
skärmläget och den inställda tröskeln `kInstalld()` i exportläget (`state.kLage`). Allt som lämnar verktyget —
Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder, rapportunderlaget, gruppdossierns textkopia, Att göra-CSV,
konfigurationsfilens ögonblicksbild — körs i `medExportLage()` (`23-exportgrind.js`): generationen ökar så att
grinden ritar om varje flik som läses, och efteråt ritas skärmen tillbaka. De två funktioner all export av tabeller
och diagram går genom (`_cloneAndCleanTableForExport`, `_chartExportUnderlag`) går själva in i läget, och
Dokumentera & exportera ritas alltid i det. Inställningen, stämpeln, metodbilagan och texterna om regeln talar om den
inställda tröskeln; det statistiska golvet `statGolv()` är oförändrat. Testerna prövar vyerna i exportläget
(`iExport` i riggen) och skärmen positivt. Knappen *Som export* i sidhuvudet (`sattForhandsvisning`) sätter skärmen i
exportläget — banner, streckad ram och omritning av det som syns — tills den stängs av; exporterna byter då inte
läge, och ett byte medan en export pågår avvisas. Efter en export ritas bara det tillbaka som exporten ritade
(`_ritaOmEfterExport`), Lika arbetes minne har ett rum per tröskel, och ett tröskelbyte räknar om skattningarna
(`invalidateStatCaches`) bara när `statGolv()` ändras; Att göras lista byggs en gång för Att göra och
processöversikten (`renderProcessTracker({ punkter })`) — ingen cache, bara ett värde som skickas vidare.

**ADR-52 — Egna tabeller i rapporten som recept, inte tal.** Beslut 2026-10-29. En vy i Utforska sparas med *Lägg
till i rapporten* som ett recept — rader, kolumner, mått, urval, gruppvillkor och valfri upprepning per BAS-intervall
(`src/lib/tabellrecept.js`, `state.rapportTabeller`). Recepten ritas om i exportläget (ADR-51) med samma pivot som
fliken (`computePivot`) och Utforskas exportregler för minsta gruppstorlek, i avsnittet *Egna tabeller* efter
avsnittet per BAS-intervall (följer med när det gör det), i Excel-bladet *Egna tabeller* och som block i
rapportunderlaget (`egen:i:j`, `egenTabellBlock` i `src/lib/rapportunderlag.js`). Avsnittet per
BAS-intervall följer ett recept (`state.perBasRecept`, `valideraPerBasRecept` i `src/lib/perbas.js`): dimension (BAS
eller sektor), rader, mått, åldersgränser och summeringstabeller; standardreceptet är arbetsgivarnas utkast och sparas
som null. Båda bärs av konfigurationsfilen och nollställs av *Rensa all data*.

## 9. Öppna punkter

Kända brister och obesvarade frågor, så att de inte lever bara i en konversationstråd.

**Användning och prövning:**
1. **Ingen användare har provat gränssnittet och diagrammen med verklig data**; de är sedda med demodatan och ett
   påhittat större underlag (42 yrken). Pilotchecklistan har punkter för det som inte går att pröva utan verklig
   data.
2. **Word-utkastet är inte öppnat i Word**, bara i LibreOffice.
3. **Punkter som täcker varandra i bandkartan** när många yrkesgrupper i samma BAS-intervall har nästan samma
   median. *Krav mot lön* flyttar isär sådana grupper i sidled, och prioriteringsmatrisens etiketter flyttas isär
   uppåt; bandkartan är inte prövad med många yrken. Bör bedömas med verklig data.
4. **Trattdiagrammets ritade fält är en normalapproximation** (med korrektion för små grupper); bedömningen av
   varje grupp görs med omkastning, utom för grupper över 300 personer.

**Prestanda:**
5. **Ändrad minsta gruppstorlek tar 6,6 s på 55 000 rader** (10 → 11): bootstrap-KI (2,7 s, bara när `statGolv()`
   ändras), Att göra och processöversikten (som läser samma lista, byggd en gång) och den öppna fliken räknas om.
   Det som återstår är regressionen, som körs flera gånger per rendering och inte får cachas (ADR-17). Översikt
   ritas inte två gånger — när Översikt är den öppna fliken är den redan ritad av stegen (`_omritningssteg`).

   Mätvärden med `npm run perf` på 55 000 syntetiska rader (2026-10-29, efter ADR-51): uppladdning till klart
   gränssnitt ~2,8 s, till klara bakgrundsanalyser ~7,7 s; Likvärdigt arbete 2,6 s, Lika arbete 2,0 s, Ålder &
   karriär 1,8 s, Dokumentera & exportera 3,7 s, övriga flikar under 0,6 s styck; hela svepet 19 s. Dokumentera
   & exportera ritas i exportläget och tog 12 s innan förhandsbeskedet byggde rapportmodellen en gång i stället
   för tre (`rapportModellBada`), Excel-bladlistan en gång i stället för två, Lika arbetes minne fick ett rum per
   tröskel och omritningen efteråt begränsades till det exporten ritade (`_ritaOmEfterExport`). Det som kostar i
   Lika arbete är statistik — bootstrap-KI, kvantilregression över alla τ och OLS — utan någon enskild patologisk
   punkt. Att `runOLSRegression` körs tre gånger per rendering
   (~250 ms) är ett beslut, inte en brist (ADR-17). ADR-1:s chunking behövs inte.

**Kod och bygge:**
6. **Krasch i Node under testkörning** (V8:s skräpsamlare): orsaken är okänd; `npm test` kör om berörda filer.
7. **Stilen var spridd — åtgärdad.** De omkring 780 stilattributen i `index.html` och flikarnas mallar är flyttade till
   klasser, så att `style-src-attr` är stängt (`'none'`, ADR-30), och de genererade hashklasserna (428 `u-…`) är ersatta av
   ett namngivet bibliotek av hjälpklasser i stilmallen (§6, «Stilmallen»); inga hashnamn återstår och `tests/farger.test.js`
   faller om ett nytt skulle dyka upp. Mobilreglerna som tidigare träffade `[style*="flex"]` osv. väljer biblioteksklasserna
   efter innehåll (flex, grid-template-columns, min-width). Teckenstorlekarna följer en skala i sex steg (`--fs-xs` …
   `--fs-nyckeltal`) i stilmallen; värden inom 0,05 rem från ett steg har tagit steget vid flytten. Utanför skalan står de
   minsta versala etiketterna (0,65–0,72 rem), de stora talen (1,2 rem och uppåt) och utskriftens punktstorlekar;
   `tests/granssnitt-vyer.test.js` håller taket. Kvar: bibliotekets långa svans (omkring 200 klasser som används en eller två
   gånger) kan krympa när en flik ändå ändras och en rad får samma avstånd som sina grannar.
8. **Ett gemensamt globalt scope** på omkring 20 000 rader. Logik flyttas till `src/lib/` när en del ändå ändras.
9. *(Löst: `.github/dependabot.yml` uppdaterar npm och arbetsflödenas steg, §6.)*

**Export:**
10. **Svenskt talformat:** jämförelseexporten (`64-jamforelse-export.js`) och CSV-exporternas tolkning (`_CSV_TALLIKT`) är inte
    prövade.

**Dokumentation och lansering:**
17b. **Före varje release: riskanalysen granskas mot koden.** `riskanalys.md` och `dataskydd.md` läses påstående
    för påstående mot den kod som släpps, granskningsdatumet sätts och avvikelser förs hit. Senast gjort
    2026-10-17. `npm run release:kontroll` (`tools/release.mjs`) stoppar en release när något av datumen är äldre
    än senaste commit som rör `src/`, `tools/bundle.mjs` eller `vendor/`, eller när riskanalysens kontrollsumma inte
    är byggets; release-arbetsflödet kör samma kontroll.
18. **Uttagsstegen för Heroma, Personec P och Visma i `datauttag.md` är inte verifierade mot systemen**; de
    bygger på det gemensamma statistikuttaget och har rader som systemförvaltaren fyller i. Pilotorganisationen
    ombeds bekräfta dem.
19. **README i roten har ingen bild:** skärmbilder checkas inte in, så en bild där kräver ett
    beslut om att lägga en bildfil i källkoden.
20. **Publicering:** plattformen för att publicera källkoden är inte vald.
21. **Inför användning hos fler arbetsgivare:** licens- eller användaravtal, prismodell och support; en beskriven
    väg in för andra arbetsvärderingssystem än BAS A–J; för offentlig sektor offentlighetsprincipen och
    arkivering av utdata, mall för konsekvensbedömning; en jurist-granskad metodbeskrivning och en handledning
    för facklig samverkan. (Textförslaget till information till de anställda, tillgänglighetsredogörelsen och
    säkerhetsbeskrivningen på en sida finns i `docs/anvandare/`; textförslaget väntar på dataskyddsombudet.)

**Juridiska frågor.** Hänvisningarna gicks igenom 2026-10-19 (status *Förslag* i [`lagrum.md`](lagrum.md) tills
jurist och dataskyddsombud godkänt). Beslut som följde: verktyget hänvisar övergripande
och lagrummen står bara i [`lagrum.md`](lagrum.md) (ADR-16); kvinnodominerat arbete är mer än 60 % kvinnor;
direktivet beskrivs som inte infört i Sverige, med möjlig direkt verkan mot kommun och region. Kvar att
pröva: att 5 %-gränsen bara används för gemensam lönebedömning och aldrig för att flagga lika eller likvärdigt
arbete (metodändring); flikens namn *Handlingsplan*; en spärr mot fält som
fackmedlemskap eller hälsa; och protokollets täckning av art. 10.2 a–g. Jurist och
dataskyddsombud är ännu inte utsedda.