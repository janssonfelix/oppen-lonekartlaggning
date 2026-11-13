# teknisk-plan.md — Öppen lönekartläggning: Mål, syfte och plan

> Detta dokument är den kanoniska beskrivningen av *vad* verktyget ska vara och varför
> (öppna punkter i §9). Arkitekturbesluten (ADR) står i [`arkitekturbeslut.md`](arkitekturbeslut.md).
> Lagrumshänvisningarna samlas i [`lagrum.md`](lagrum.md); diagramkärnan beskrivs i [`diagramkarnan.md`](diagramkarnan.md).

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

**Omfång.** Verktyget är allmänt för arbetsgivare som kodar befattningar med AID och BAS-intervall och
jämför sig med SKR:s personalstatistik; det är i praktiken kommuner och regioner. Allt som är en viss
organisations — ställningstagande, statistik, benämningar, inställningar, rapportens recept — kommer ur
organisationspaketet (ADR-28), aldrig ur koden eller dokumenten. Andra arbetsvärderingssystem står som öppen
punkt i §9.

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
- **Sparar inte** vyer eller urval. Uppställningarna i Tabeller och egna vyer (rader, kolumner, mått,
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
   Cache API. Skyddet där är att ingen kod använder dem, vilket kodgranskningen prövar; CSP:n begränsar inte
   lagring, bara att det lagrade skickas ut (`connect-src 'none'`).
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
   - **Undantag 2 (ADR-14):** fliken Tabeller och egna vyer visar grupper under tröskeln, som alla
     flikar (ADR-51). Skyddet gäller det som lämnar verktyget: tabellens CSV/urklipp och
     diagrammets exportmeny utelämnar grupperna om inte användaren kryssar i "Ta med grupper
     under tröskeln i exporten" — rutan är undantaget. K-invarianten vaktar exporten.
   - **Vakt:** invarianten I4 (`tests/helpers/ktroskel-invariant.js`) är en *invariant*, inte stickprov —
     den ritar samtliga flikar i exportläget och bygger varje export mot ett dataset där varje liten grupps
     mätvärden är unika sentinelvärden och hävdar att inget av dem syns.

---

## 4. Funktionsmål (vad verktyget ska kunna)

| Område | Lagrum | Funktion |
|---|---|---|
| Kartläggning lika arbete | lika arbete (lagrum.md) | EU-Lönekartläggning: median-jämförelse kön inom yrkesgrupp + per-BAS-regression (oförklarat gap, ålderskontroll, HC3-SE, BH-FDR) |
| Lönegap & könsfördelning | lönekartläggningen (lagrum.md) | Lika arbete-fliken: yrkesgrupperna först; trattdiagrammet ställer varje yrkesgrupps kvot mot gruppens storlek och bedömer den med omkastning av könen inom gruppen. Lönestruktur-fliken: översikten per BAS-intervall (*Lönegap per BAS-intervall*) som tabell med grafik i raden (antal, medianer, skillnad i kronor, kvot med bootstrap-intervall, status), samma kvot som diagram bara i exporten, lönespridning per BAS och kön, könsfördelning (*Könsfördelning per BAS-intervall*), 5 %-tröskel (EU Art. 9-analogt) |
| **Likvärdigt arbete** | **likvärdigt arbete (lagrum.md)** | **Likvärdigt arbete-fliken: organisationens kvinnodominerade AID×BAS mot yrken som inte är kvinnodominerade (ADR-60) med lika krav — i första hand organisationens egna i samma BAS, annars jämförelsestatistiken; med arbetsvärderingspoäng över BAS-gränserna. Därtill *Lägre krav, högre lön* (ADR-25)** |
| Hierarkisk översikt | lönekartläggningen (lagrum.md) | Löneöversikten (i Tabeller och egna vyer): median/P10/P90/spridning per yrke+BAS, referenslinjer |
| Prioritering | — | Löneläget mot er referens med kostnad att nå den (ADR-62): prioritetsindex (avvikelse × volym × jämställdhet), kostnadssimulering. Könsgapet i gruppen visas och räknas in i indexet bara när båda könen har minst k personer (ADR-12; annars räknas jämställdhetsdelen som 0). Jämför mot organisationens lönepolitiska ställningstagande (ur ett organisationspaket eller en egen namngiven fil; ingen inbyggd referens, ADR-28) eller mot jämförelsestatistiken |
| Fördjupning | — | Två flikar i Kartläggning som inte är lagkrav och säger det i verktygstipset och inledningen: Ålder & karriär (lön mot ålder med trend, lönegap per åldersgrupp, percentilband över ålder, lönefördelning per kön, livscykel ålder×kön×BAS och åldersstruktur) och Löneläget (raden Löneläget nedan). Nästa steg hoppar över dem när de är låsta |
| EU-direktivets rapportmått | EU 2023/970 art. 9 | Lönestruktur: kvartilfördelning, representation per BAS, distributionellt gap, medel- och mediangap, med EU-lönerapporten som Excel. **Tecknet:** verktyget räknar lönegapet som (kvinnor − män) / män och visar det i alla flikar och blad som kvinnors lön i procent av mäns (under 100 % = kvinnor lägre). EU-lönerapportens blad och rapportens avsnitt *Struktur och lönetransparens* (Word/PDF) redovisar i stället direktivets mått, (män − kvinnor) / män i procent, enligt art. 9: positivt tal = kvinnor lägre; kolumnrubriken och en metodrad säger det. Tecknet vänds på ett ställe, `tillDirektivtecken` i `src/lib/struktur.js`; beloppet är detsamma |
| Löneläget | — | Fliken `benchmark`, först i Kartläggning. Avsnitten i ordning: Överblick (`avsnitt-jmf-bandkartor`: bandkartan mot ställningstagandet och läget i statistikens spann, fylld punkt för AID + BAS och ofylld för endast AID), avsnittet mot ställningstagandet, avsnittet mot jämförelsestatistiken (ADR-35) och Yrkesgrupp för yrkesgrupp (`avsnitt-jmf-overblick`: löneläget och statistiken mot ställningstagandet per yrkesgrupp, ADR-55). Avsnittet mot ställningstagandet: könens läge i spannet och fördelningen i spannets tredjedelar per kön, efterlevnad, täckningsgrad; tomläge utan ställningstagande. Talen följer med som bladet *Lönepolitik* i Excel (alla flikar) — yrkesgrupperna mot sitt spann, läget per kön och BAS-intervall, tredjedelarna och efterlevnaden, med flikens regler för minsta gruppstorlek (`_lpExcelBlad`) — bara när ett ställningstagande är inläst |
| Organisationspaket | — | En fil med organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik; systemägaren skapar det i verktyget, handläggaren läser in det i ett steg i fliken Filer och kvalitet (ADR-28) |
| Tabeller och egna vyer | — | Fliken `utforska`, sist i Rapport: Löneöversikten och underflikarna Egna vyer och Alla diagram (`74-alla-diagram.js`: diagrammen från de andra flikarna samlade, en grupp per flik, som kopior med egna filter och meny; ingen ny export). Egna vyer: rader × ev. kolumner (BAS, AID, yrkesgrupp inom BAS, sektor, AID-mellannivå, ålder, kön, lönespann; rader även hela urvalet), tio mått, visning som helhet eller per kön, urval med villkor (alla/något, "inte", lön och ålder) och gruppvillkor på uträknat mått, tolv diagramtyper i två grupper i väljaren (Vanliga: staplar, liggande, låda, grupperade; Fler diagramtyper: hantel, bubbla, individpunkter, punktsvärm, regnmoln, kvantilpunkter, värmekarta, staplade). Små grupper visas som andra på skärmen och utelämnas ur exporten om inte rutan är ikryssad (ADR-14, ADR-51). Klick på en grupp öppnar gruppdossiern |
| Export | — | Exportmeny på varje diagram: PNG (1920 × 1080 / 1600 × 900), SVG och diagramdata (urklipp/CSV) |
| Rapporttext | — | Fliken `rapporttext` (låst utan lönefil): auto-rapportutkastet i klarspråk (`renderStrukturUtkast` i `37-struktur.js`) och rapportunderlaget att klistra in i egen mall (ADR-20) |
| Exportera | — | Fliken `dokumentera` (panelerna `view-kvalitet` och `view-dokumentera`), sista steget i Nästa steg: färdigcheck, robusthetspanel, rapportens innehåll och all export. De fyra samlade exporterna har var sin uppgift: **Word-utkastet är rapporten, Excel-filen underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt**. Word och PDF ritas ur samma rapportmodell (`58-rapportmodell.js`), i ett valt urval av avsnitt (hela dokumentationen, ledningsbrief, facklig dialog eller eget); varje export har ett förhandsbesked om vad den innehåller och utelämnar, och exportgrinden ser till att inget läses ur en flik ritad med en äldre tröskel. Därtill JPA-protokoll och handlingsplansunderlag, vars knappar också står i Handlingsplans kort *Samverkan & uppföljning* |
| Spara och jämför år | — | Fliken `arbetet` under Arbetet (öppen utan lönefil): spara och ladda konfigurationen, ögonblicksbilden, jämförelse med förra året (ADR-54) och självdiagnostiken. Rapporttext, Exportera och Spara och jämför år ritas i exportläget (ADR-51) |
| Gränssnittets form | — | Menyn har 16 flikar i grupperna 1 · Underlag (Översikt, Filer och kvalitet, Regler & praxis), 2 · Kartläggning (Löneläget, Lika arbete, Likvärdigt arbete, Lönestruktur, Ålder & karriär), 3 · Åtgärder (Prioritering, Löneöversyn, Handlingsplan), 4 · Rapport (Rapporttext, Exportera, Tabeller och egna vyer), Arbetet (Spara och jämför år) och Hjälp (Om verktyget); flikgrupperna och aliasen står i `PANEL_GROUPS` och `TAB_ALIAS` i `31-navigering.js`, och en låst flik leder till lönefilskortet i Filer och kvalitet. Alla flikar följer en mall: en rad om vad fliken svarar på (*Visa mer*), urval, nyckeltal i en rad, huvudresultat, och fördjupning i hopfällbara avsnitt som säger sitt nyckeltal i rubrikraden. Sidindexet *På den här sidan* (`89-sidindex.js`) listar flikens synliga avsnitt och följer med när sidan rullas. Sök i sidhuvudet markerar en grupp i alla diagram och tabeller (länkade vyer) och hittar flikarnas avsnitt, dialogerna och fälten i Inställningar (`SOK_FUNKTIONER` i `86-sok-register.js`), också utan lönefil. Panelen Inställningar samlar det som gäller alla flikar, med Prioriteringens trösklar och viktning. Två lägen: vägledande och kompakt. Byggt för datorskärm; surfplatta och delat fönster fungerar, telefon är inte ett användningsfall (ADR-41) |
| Diagram | — | Ritas av diagramkärnan (D3, ADR-39) ur ett figurformat; formen väljs efter uppgiften och färgen efter vad den ska säga — reglerna står i `diagramkarnan.md` §10. Där ett diagram skulle visa för lite står en tabell med grafik i raden |
| Underlagets kvalitet | — | I fliken Filer och kvalitet, med extremvärdena och inläsningsrapporten: fem kriterier med OK/Varning/Kritisk; svagaste kriteriet avgör (ADR-19) |
| Var uppstår löneskillnaden? | — | Lönestrukturs avsnitt och rapportunderlagets block: skillnaden i medellön delad på BAS-fördelning, AID inom BAS och inom AID och BAS (eller de förklaringsvariabler som valts, ADR-65), visad som en trappa och med de grupper som bidrar mest (ADR-22) |
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
   - **Jämförelsemängden (ADR-60):** alla yrken som **inte är kvinnodominerade** enligt vald
     definition (DO: högst kvinnotröskeln, SCB: under den) — mansdominerade och blandade, med
     klassen och könsandelen synliga i paret (`maKlass`, `maKvinnoPct`). Filtret
     `state.likvardighet.jamforelse = 'mansdominerade'` begränsar till de mansdominerade.
   - **BAS-läget (standard):** i första hand organisationens **egna** jämförelseyrken i samma
     BAS-intervall. Saknas ett sådant i
     BAS-intervallet används **jämförelsestatistiken** som reserv (dess egen
     könsfördelning i första hand, SKR:s personalstatistik när den saknas, ADR-34).
   - **Poängläget:** har lönefilen kolumnen Poäng jämförs med yrken som har lika eller
     lägre arbetsvärderingspoäng (poäng ≤ det kvinnodominerade yrkets × (1 + band),
     standardband 5 %) — även över BAS-gränserna.
3. **Steg 3:** Flagga par där jämförelseyrkets median är högre än minsta skillnaden
   `minGapPct`, med bootstrap-KI på medianskillnaden, och visa högst `topN` par. I verktyget
   är standardvärdena **0 %** och **20 par** (`state.likvardighet` i `12-tillstand.js`;
   användaren kan ändra dem i fliken, 0–50 % och 10–500 par). 0 % visar alla par där
   jämförelseyrket har högre lön; 5 % är ett valbart filter, och knappen *Visa alla* visar
   paren utöver de 20 (ADR-61). Modulens egna standardvärden,
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
   BAS-ordningen är fast: bokstavsordning A–J. Den går inte att ändra i verktyget. Verktyget
   antar att varje bokstav motsvarar ett lika brett poängintervall i arbetsvärderingen, så rangen är bokstavens
   plats (A=1, B=2 …) där BAS räknas som ett tal — *Lägre krav* använder funktionen
   (`basRangFn` i `src/lib/likvardighet.js`) — och B → D är två BAS-steg även när C saknas i
   underlaget. Huvudregressionen, den sekventiella dekomponeringen, Blinder-Oaxaca (ADR-53) och
   kvantilregressionen (ADR-63) räknar inte BAS som ett tal utan som indikatorvariabler, en per
   intervall med det alfabetiskt första som referens (ADR-44); bokstavsordningen avgör där bara
   referensen. Kvantilregressionen (`kvantilDesign` och `quantileRegressionAtAllTau` i
   `src/lib/regression.js`) skattas vid P10, medianen och P90 på huvudmodellens variabler enligt
   förklaringsmodellen, utan yrkesgrupp inom BAS, och tolkas som glastak eller klibbigt golv bara
   när bootstrap-intervallet för skillnaden P90 − P10 utesluter noll.

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
    `vendor/xlsx.mini.min.js`, `vendor/papaparse.min.js`, `vendor/jszip.min.js`), se `TREDJEPARTSLICENSER.md`.
  - `dist/` — genererat och incheckat: `dist/app.js`, `dist/oppen-lonekartlaggning.html`
    och `dist/RELEASE.txt`.
  - `docs/` — `docs/anvandare/` (medföljer verktyget), `docs/dataskydd/`,
    och `docs/utveckling/` (denna plan och arkitekturbesluten); `docs/README.md` listar dokumenten.
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
- **Tester:** Vitest — omkring 3300 tester i omkring 100 filer: rena `src/lib/`-moduler, CSV-parsning, jsdom-röktest
  av varje vy (ADR-7; `tests/smoke.test.js` med det delade fönstret och sju `tests/smoke-*.test.js` per
  område), k-tröskeln i tio `tests/ktroskel*.test.js` med riggen i `tests/helpers/ktroskel-rigg.js`,
  gränssnittet i `tests/granssnitt*.test.js` (riggen `tests/helpers/granssnitt-rigg.js`) och diagramvyerna i
  `tests/diagramvyer*.test.js` (riggen `tests/helpers/diagramvyer-rigg.js`),
  axe-a11y (ADR-10) samt vakterna `appsource`, `drift`, `exports.golden`,
  `version`, `release` och `kanonymitet`, samt de rena modulerna bakom Tabeller och egna vyer och exportmenyn
  (`utforska`, `urval`, `falt`). `tests/figur.test.js` prövar figurformatet och
  `tests/diagramritare.test.js` diagramkärnan (ADR-39) — den ritar med **äkta D3** i jsdom, så SVG:n som prövas är
  den riktiga, och två differentialtester vaktar att små grupper inte lämnar spår på skärmen eller i exporten.
  Därutöver `npm run test:browser`: Playwright-röktest av den
  **byggda** artefakten i riktig Chromium — under CSP:n från `file://`, som jsdom inte tillämpar. Provet kräver att
  varje diagram har ritats av diagramkärnan, och ritar därtill ett eget diagram och exporterar det genom
  exportmenyn (PNG i båda storlekarna, SVG som öppnas som eget dokument, diagramdata) — PNG via canvas finns inte i jsdom. Den prövar också adressen `?demo=1`, räknar CSP-överträdelser
  och interna fel (ADR-31), och körs i Chromium, Firefox och WebKit (`--browser=…`,
  `npm run test:browser:firefox`/`:webkit`; i CI alla tre vid pull requests och på main, bara Chromium vid en
  vanlig push till en gren).
  *Testmiljön:* `tests/helpers/app-harness.js` kompilerar d3 och app.js en gång per arbetare och stänger och
  tömmer fönster som inte behövs, så att varje arbetares minne håller sig under Nodes tak (den tyngsta filen
  under 1,2 GB). Ett fönster kostar omkring 0,15 s efter det första (som bär kompileringen); det dyra är
  ritningen av alla flikar (omkring 2 s på demodatan), så tiden styrs av hur många flikritningar en fil gör.
  Vitest kör en fil per arbetare, så den längsta filen sätter golvet för hela körningen: därför är röktestet,
  k-tröskeltestet, gränssnittstestet och diagramvyerna delade i filer per område (`tests/smoke*.test.js`,
  `tests/ktroskel*.test.js`, `tests/granssnitt*.test.js`, `tests/diagramvyer*.test.js`) med gemensamma riggar i
  `tests/helpers/`; de tyngsta filerna tar ett par minuter under full last, och den längsta förberedelsen,
  invarianten över flikar och exporter (I4), är därför delad per tröskel (`tests/ktroskel-invarianter.test.js` och
  `tests/ktroskel-invarianter-25.test.js`, sviten i `tests/helpers/ktroskel-invariant.js`). `vitest.config.js` sätter en
  gemensam tidsgräns och antalet arbetare: tre fjärdedelar av antalet trådar (på åtta kärnor med SMT mättes
  åtta arbetare till 168 s, femton till 150–168 s och tolv till 130 s: de tunga filerna är processorbundna, så
  med en arbetare per tråd trängs de om kärnorna, och med en per kärna köar de), begränsat av maskinens totala
  minne med 1,2 GB per arbetare och 2 GB åt resten.
  *Testkörningen:* sviten är delad i två Vitest-projekt i `vitest.config.js`: `enhet` (moduler, vakter och källtext,
  utan att verktyget laddas) och `app` (filerna som ritar verktyget i jsdom). Klassningen görs när konfigurationen
  laddas: en fil hör till `app` om källan nämner `app-harness`, en `-rigg.js` eller `createAppWindow`, eller
  importerar jsdom. `npm test` är den snabba körningen, bara `enhet` (sekunder); `npm run test:full` kör båda
  projekten (minuter) och ska köras före en pull request — det är den som körs i CI. Båda går genom `tools/test.mjs`,
  som kör sviten och sedan kör om de filer vars arbetare dog i
  Node (SIGSEGV i V8:s skräpsamlare, sällsynt; orsaken ligger i Node, §9). Ett test som faller körs aldrig om, och
  utgångskoden är 0 först när alla filer har rapporterat. Hela sviten tar omkring 130 s på 8 kärnor/16 trådar
  (var tidigare 250–275 s, då `smoke.test.js` och `ktroskel.test.js` var för sig tog hela tiden); under full
  last tar varje fil omkring dubbelt så lång tid som ensam, och de tyngsta ett par minuter.
  *Byggets förminskning av stilmallen* ligger i `tools/lib/minify-css.mjs` med tester i `tests/byggminify.test.js`: strängar och `url()` rörs inte, blanksteg runt `+` och `-` i värden står kvar, och blanksteget före en pseudoklass i en väljare står kvar.
- **Delade fönster i testerna:** ett fönster och en inläsning av demodatan kostar omkring 0,6 s, så läsande tester kan
  dela fönster med `delatFonster(forbered, skapa)` i `tests/helpers/app-harness.js`. Gruppen börjar med vakten
  `utgangslage(w)` (tröskel, öppna dialoger, aktiv flik), och efter varje test jämförs `tillstandsavtryck(w)` (hela
  `state` utom cachar, urvalet i Tabeller och egna vyer, markeringen och dialogerna): det test som lämnar något ändrat fälls. Avtrycket
  ser inte allt, till exempel stubbar på fönstret och värden i fält, så ett test som ändrar något sådant behåller ett
  eget fönster. `tests/granssnitt.test.js` (23,0 → 18,3 s ensam), `tests/diagramvyer.test.js` (22,7 → 18,1 s) och
  `tests/diagramvyer-marken.test.js` (29,0 → 21,7 s) delar. En fil delar bara om den blir minst 20 % snabbare; under
  gränsen stannade `smoke-vyer`, `smoke-granssnitt`, `granssnitt-vyer`, `smoke-ansvar`, `smoke-jamforelse`,
  `smoke-innehall`, `smoke-docx`, `ktroskel-utdata`, `ktroskel-regression`, `ktroskel-exporter` och `ktroskel-kon`,
  där de flesta tester ändrar något. `smoke`, `kanonymitet` och `diagramritare` delade redan eller har sin tid i
  ritningen. Hela sviten: 176 och 164 s före mot 168 och 142 s efter, körda växelvis på samma maskin (sexton trådar);
  variationen mellan körningar är större än vinsten i varje enskild fil.
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
  DOM-element (`tr._markering` m.fl.) deklareras i `types/globals.d.ts`; Node-API:t typas av `@types/node`
  (utvecklingsberoende sedan 2026-10-30, `"types": ["node"]` i `tsconfig.json`; den egna minimala typfilen är
  borta). Röktestet och prestandasvepet
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
- **CI** (`.github/workflows/ci.yml`, på push till `main` och taggar `v*`, på pull requests och för hand), två jobb;
  en ny push på en pull request avbryter den pågående körningen:
  - `quality` — lint, typkontroll, mojibake-grind och en **artefaktgrind**: bygget är byte-reproducerbart, så CI
    bygger om och kräver oförändrad SHA-256. `appsource`-testet vaktar `dist/app.js` mot `src/app/`; artefaktgrinden
    vaktar den skeppade HTML-filen. Hela testsviten körs sist, så att de billiga grindarna ger besked först.
  - `browser` — en matris över Chromium, Firefox och WebKit (vid push av en tagg bara Chromium):
    installerar motorn, bygger artefakten och kör röktestet mot den.
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
    K-invarianten står i `tests/helpers/ktroskel-invariant.js` och körs från `tests/ktroskel-invarianter.test.js` (flikar i
    exportläget och exporter; vad som inte prövas står i testfilerna och i `riskanalys.md` §6.5) och i
    lagringsspärrens test i `tests/sakerhet.test.js`.
    Varje ny utdata som lämnar verktyget (text, tabell, bild, fil) läggs i k-invariantsviten (`tests/helpers/ktroskel-rigg.js`) och i riskanalysens tabell över utdata innan den checkas in.

---

## 8. Arkitekturbeslut (ADR)

Arkitekturbesluten, med motiv, avvisade alternativ och status, står i
[`arkitekturbeslut.md`](arkitekturbeslut.md). Numren (ADR-1, ADR-2 …) är desamma som koden, testerna och
dokumenten pekar på.

## 9. Öppna punkter

Kända brister och obesvarade frågor, så att de inte lever bara i en konversationstråd. Numren byts inte, eftersom
kod, tester och dokument pekar på dem; ett nummer som saknas är en avslutad punkt. En avslutad punkt som något
pekar på står kvar med en rad om hur den avslutades.

**Användning och prövning:**
1. **Ingen användare har provat gränssnittet och diagrammen med verklig data**; de är sedda med demodatan och ett
   påhittat större underlag (42 yrken). Checklistan för skarp data (`pilotchecklista.md`) har punkter för det
   som inte går att pröva utan verklig data.
3. **Punkter som täcker varandra i bandkartan** när många yrkesgrupper i samma BAS-intervall har nästan samma
   median. *Krav mot lön* flyttar isär sådana grupper i sidled, och prioriteringsmatrisens etiketter flyttas isär
   uppåt; bandkartan är inte prövad med många yrken. Bör bedömas med verklig data.
4. **Trattdiagrammets ritade fält är en normalapproximation** (med korrektion för små grupper); bedömningen av
   varje grupp görs med omkastning, utom för grupper över 300 personer.

**Prestanda:**
5. **Ändrad minsta gruppstorlek tar 4,1 s på 55 000 rader** (10 → 11): bootstrap-KI och styrkan räknas om i
   bakgrunden efteråt när `statGolv()` ändras (`_skattningarIBakgrunden`, som vid inläsning: nyckeltalen står utan
   intervall tills det är klart), och Att göra och processöversikten (som läser samma lista, byggd en gång, med regressionen körd en gång
   och skickad vidare) och den öppna fliken räknas om. Det som återstår är regressionen i processöversikten och
   underlagets kvalitet, som inte får cachas (ADR-17). Översikt
   ritas inte två gånger — när Översikt är den öppna fliken är den redan ritad av stegen (`_omritningssteg`).
   Kvantilregressionens bootstrap-intervall räknas i bakgrunden efter att kortet ritats, också i exportläget
   (`_regKvantilBerakna`): en bild eller utskrift som görs innan intervallet är klart bär kortet utan det.

   Mätvärden (Chromium, syntetiska rader): `npm run perf` på 55 000 rader (2026-10-29) ger uppladdning till klart
   gränssnitt ~2,8 s och till klara bakgrundsanalyser ~7,7 s; Likvärdigt arbete 2,6 s, Lika arbete 2,0 s, Ålder &
   karriär 1,8 s, övriga flikar under 0,6 s utom de som ritas i exportläget; hela svepet 19 s. Navigeringen
   (2026-11-07, 20 000 / 55 000 rader): sidindexet under 3 ms per flik, första sökningen 8 / 19 ms, BAS-dossiern
   20 / 56 ms, gruppdossiern 0,1 / 0,27 s, rapportmodellen med bilagan med gruppdossierer 0,48 / 1,4 s,
   förhandsbeskedet i Exportera ~1,0 / ~2,5 s och ett ändrat kryss under *Rapportens innehåll* 0,27 s vid 55 000 rader
   (gräns 1 s i `npm run perf`). Inget steg är nära 2 s, och ADR-1:s chunking behövs inte.

**Kod och bygge:**
6. **Krasch i Node under testkörning** (V8:s skräpsamlare): orsaken är okänd; `npm test` och `npm run test:full` kör om berörda filer.
8. **Ett gemensamt globalt scope** på omkring 20 000 rader. Logik flyttas till `src/lib/` när en del ändå ändras.

**Gränssnitt och analys (översynen 2026-10-29):**
9b. **Ett tecken i hela verktyget:** löneskillnader anges kvinnor mot män, negativt när kvinnor ligger lägre
    (huvudtalet, livscykeln, Blinder-Oaxaca-kortets rågap, *Var uppstår löneskillnaden?*); kvoten *kvinnors lön i
    procent av mäns* används där den är standard (Översikt, Ålder & karriär, direktivets tabeller). Enda
    undantaget är EU-lönerapportens blad med direktivets tecken (art. 9), utskrivet i rubriken.
9c. **Ålder & karriär ordnad efter tre frågor** (vid samma ålder; över karriären; åldersstruktur), med ett
    spridningsdiagram där hela urvalets trend är ett valbart lager. Täthetskurvorna per BAS är borta ur fliken
    (lönespridningen per BAS och kön finns som lådor i Lönestruktur, och utskriften använder den bilden).
9d. **Dekomponeringen visas som en bild:** trappan med yrkesgruppssteget efter huvudtalet, förklaringsbudgeten
    under den, steglistan som skärmläsaralternativ. Livscykelns nivåer per BAS kommer ur modellens
    BAS-koefficienter (`basFaktor`). Blinder-Oaxaca kodar BAS som indikatorer sedan ADR-53.
9e. **Kvar efter uppmärksamhetstrappan och Prioriteringens egna ord (ADR-59, ADR-62, till spår C):** livscykelns
    färger (`52-livscykel.js`) följer fortfarande 5 %. Utforska och kolumnen *Skillnad kön* i Prioriteringens åtgärdslista visar storlek utan prövning
    (högst *Följ upp*). Protokollets blad per BAS-intervall för gemensam lönebedömning väljer på rått p-värde utan
    BH-korrigering. På skärmen (k = 1) står många små grupper som *Går ej att bedöma*, eftersom prövningen kräver
    `statGolv()` per kön. Handlingsplanens kostnadskolumn blandar kostnad att nå referensen (rader ur Prioritering) och
    kostnaden att lyfta ett kvinnodominerat yrke till jämförelseyrket (kandidatpar); vägledningsbladet, rapporten och
    rapportunderlaget säger vilken som är vilken.

**Export:**
22. *(Löst 2026-11-08: en definition av kvinnodominerat i hela verktyget, `arKvinnodominerad`/`konsklass` i
    `src/lib/likvardighet.js`, ADR-60.)*
10. *(Löst 2026-11-10: jämförelseexporten och CSV-exporternas tolkning (`_CSV_TALLIKT`) prövas i
    `tests/talformat.test.js`; P10 och P90 i jämförelseexporten fick kronformat, och talinläsningen läser `−` som
    minus.)*

**Dokumentation och lansering:**
17b. **Före varje release: riskanalysen granskas mot koden.** `riskanalys.md` och `dataskydd.md` läses påstående
    för påstående mot den kod som släpps, granskningsdatumet sätts och avvikelser förs hit. Senast gjort
    2026-11-06. `npm run release:kontroll` (`tools/release.mjs`) stoppar en release när något av datumen är äldre
    än senaste commit som rör `src/`, `tools/bundle.mjs` eller `vendor/`, eller när riskanalysens kontrollsumma inte
    är byggets; release-arbetsflödet kör samma kontroll.
18. **Uttagsstegen för Heroma, Personec P och Visma i `datauttag.md` är inte verifierade mot systemen**; de
    bygger på det gemensamma statistikuttaget och har rader som varje organisations systemförvaltare fyller i
    och bekräftar för sin installation.
19. **README i roten har ingen bild:** skärmbilder checkas inte in, så en bild där kräver ett
    beslut om att lägga en bildfil i källkoden.
21. **Inför användning hos fler arbetsgivare:** licens- eller användaravtal, prismodell och support; en beskriven
    väg in för andra arbetsvärderingssystem än BAS; för offentlig sektor offentlighetsprincipen och
    arkivering av utdata, mall för konsekvensbedömning; en jurist-granskad metodbeskrivning och en handledning
    för facklig samverkan. (Textförslaget till information till de anställda, tillgänglighetsredogörelsen och
    säkerhetsbeskrivningen på en sida finns i `docs/anvandare/`; textförslaget är inte juridiskt granskat.)

**Juridiska frågor.** Hänvisningarna gicks igenom 2026-10-19 (status *Förslag* i [`lagrum.md`](lagrum.md): inte
juridiskt granskade). Beslut som följde: verktyget hänvisar övergripande
och lagrummen står bara i [`lagrum.md`](lagrum.md) (ADR-16); kvinnodominerat arbete är mer än 60 % kvinnor;
direktivet beskrivs som inte infört i Sverige, med möjlig direkt verkan mot kommun och region. Kvar att
pröva: att 5 %-gränsen bara används för gemensam lönebedömning och aldrig för att flagga lika eller likvärdigt
arbete (metodändring); flikens namn *Handlingsplan*; en spärr mot fält som
fackmedlemskap eller hälsa; och protokollets täckning av art. 10.2 a–g. Ingen juridisk granskning har gjorts;
varje arbetsgivare stämmer av mot sin egen rådgivning.