# Bygge och test — referens

Hur verktyget byggs, testas, typkontrolleras och släpps i dag: körtiden, bygget och dess skyddsnät, versioneringen,
stilmallen, testsviten och testmiljön, typkontrollen, linten, `npm run kontroll`, CI, releasen och demosidan, och
termerna. Det här dokumentet är referensen för den som ändrar bygget, testmiljön, CI eller releasen. Koden och konfigurationen är
sanningen; där dokumentet och filerna skiljer sig är det dokumentet som ska rättas.

Dokumentet är inte Definition of Done — vad som krävs innan en ändring är klar står i *Definition of Done* i
[`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md), punkt 3 — och inte beslutsloggen: varför bygget och testerna är
som de är står i [`arkitekturbeslut.md`](arkitekturbeslut.md), främst ADR-1, 2, 6, 7, 8, 9, 13, 30 och 31.
Kommandona står i `package.json` (`scripts`) och beskrivs i avsnitten nedan. Det som har en egen källa — mapparna, dokumenten,
CI:s steg och vad release-grinden prövar — skrivs inte av här utan hänvisas dit (princip 4 i
[`principer.md`](principer.md)).

| Del | Fil |
|---|---|
| Skripten och Node-kravet | `package.json` (`scripts`, `engines`) |
| Bygget | `tools/build-app.mjs`, `tools/bundle.mjs`, `tools/gen-version.mjs`, `tools/lib/minify-css.mjs`, `tools/lib/minify-html.mjs` |
| Testsviten och testmiljön | `vitest.config.js`, `tools/test.mjs`, `tests/helpers/app-harness.js`, `tests/helpers/paastaende.js` (varje test måste ha ett påstående) |
| Webbläsarröktestet och prestandamätningen | `tools/browser-smoke.mjs`, `tools/browser-smoke/`, `tools/perf-smoke.mjs` |
| Typkontrollen och linten | `tsconfig.json`, `tsconfig.app.json`, `types/globals.d.ts`, `eslint.config.js` |
| Kedjan lokalt | `tools/kontroll.mjs` |
| CI, release och demosidan | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/pages.yml`, `tools/release.mjs`, `tools/site.mjs` |
| Sårbarhetsbevakningen av `vendor/` | `.github/workflows/sarbarheter.yml`, `tools/sarbarheter-hamta.mjs`, `tools/sarbarheter.mjs` |
| Beroendeuppdateringar | `.github/dependabot.yml` |
| Termerna | `src/lib/termer.js`, `src/app/09-termer.js`, `tests/termer.test.js` |

## 1. Körtid och mappar

**Node ≥ 22.12** (`engines` i `package.json`). jsdom-kedjan gör `require()` av en ES-modul, vilket kastar
`ERR_REQUIRE_ESM` på Node 20 — smoke-, a11y- och golden-sviterna faller då tyst. `require(esm)` är påslaget från
22.12.

**Mapparna** står i `README.md` (*Repot*), och appens moduler i `src/app/README.md`.

**Namngivning.** Filnamn skrivs med gemener och bindestreck, utan å, ä och ö. Levande dokument har inget datum eller
versionsnummer i filnamnet; versionen står i dokumentet. Modulerna i `src/app/` har ett tvåsiffrigt prefix som styr
ordningen för deras uppstart (`src/app/index.js`).

**Källfilerna** är `src/index.html`, `src/style.css`, `src/app/NN-*.js` och `src/lib/*.js`. `dist/app.js` är
**genererad** ur `src/app/` och redigeras aldrig direkt (ADR-6, ADR-98).

**`src/index.html` går inte att köra direkt i en webbläsare.** Den pekar på biblioteken i `vendor/` och på
`dist/app.js` (relativa sökvägar från `src/`), men dess CSP (`default-src 'none'; script-src 'unsafe-inline'`)
blockerar stilmallen och alla skriptfilerna (fem: fyra bibliotek och verktygets eget skript; prövat i Chromium). Den
är indata till bygget och till jsdom-testerna; en ändring ses i `dist/oppen-lonekartlaggning.html` efter
`npm run bundle`.

## 2. Bygget

**`npm run build:app`** (`tools/build-app.mjs`) regenererar `src/app/08-version.js` ur `VERSION`
(`tools/gen-version.mjs`, ADR-13) och bygger sedan `dist/app.js` med esbuild ur ES-modulerna, med `src/app/index.js`
som ingång (ADR-98): `src/app/NN-*.js` och de `src/lib/`-moduler de importerar blir en platt fil utan `import` och
`export` (format `esm`, ingen tree shaking, ingen minifiering), som körs som ett klassiskt skript. Appens
toppnivånamn blir globala, som sidan, testerna och röktestet läser dem. Bygget fäller om utfilen har `import` eller
`export` kvar, om ett av appens namn (deklarerat i en del eller importerat ur lib under lib-namnet) deklareras i mer än
en modul eller inte står oförändrat i utfilen (esbuild döper om vid en krock), om en del har en sats på
toppnivån som inte är en deklaration (en initierare får köra kod; det som körs vid laddning står i delens
uppstartsfunktion, som `index.js` anropar i sifferordning), och
om ett toppnivånamn i utfilen heter som en egenskap på `window` eller dess prototyper: listan tas ur jsdom vid
byggtiden, med en kort fast lista över det Chromium har men jsdom saknar (`chrome`, `scheduler`, `navigation` med
flera) och de inbäddade bibliotekens namn (`d3`, `Papa`, `XLSX`, `JSZip`), som en del annars skulle skugga
(`krockarMedWindow`, prövad i `tests/build-app.test.js`).
Lib-modulernas privata namn får döpas om. Bygget är deterministiskt, och artefaktgrinden (§8 och §9) vaktar att de
genererade filerna motsvarar källan.

**`npm run bundle`** (`tools/bundle.mjs`) gör samma regenerering och bygger sedan
`dist/oppen-lonekartlaggning.html` (omkring 3 MB; en enda fil) och `dist/RELEASE.txt`:

- Biblioteken och `dist/app.js` läggs in som skript i sidan, och CSP:ns `script-src` och `style-src-elem` får
  kontrollsummor i stället för `'unsafe-inline'` (ADR-9, ADR-30).
- CSS och HTML minifieras; **JS minifieras inte** (template literals bevaras; ADR-2). Förminskningen av stilmallen
  ligger i `tools/lib/minify-css.mjs` med tester i `tests/byggminify.test.js`: strängar och `url()` rörs inte,
  blanksteg runt `+` och `-` i värden står kvar, och blanksteget före en pseudoklass i en väljare står kvar.
  Förminskningen av sidan ligger i `tools/lib/minify-html.mjs`, med tester i samma fil: blanksteg mellan två
  textelement (`</span> <em>`) är ett ordmellanrum och blir ett mellanslag, övrigt blanksteg mellan taggar tas bort.
- Licenstexterna ur `src/licenser.txt` läggs i en inaktiv `<template>` efter sista skriptet, så att CSP:ns
  kontrollsummor inte påverkas.
- SHA-256 loggas i `dist/RELEASE.txt` tillsammans med version, storlek, källorna och kommandona för att kontrollera
  summan. Filen är deterministisk: `Build:`-raden härleds ur `VERSION`, inte ur systemklockan, så en ombyggnad av
  oförändrad källa smutsar inte ner arbetskatalogen. Bygget är byte-reproducerbart, och det är vad artefaktgrinden
  i CI prövar (avsnitt 9).

**Reproducerbart bygge** (ADR-101). Samma commit ger samma `dist/oppen-lonekartlaggning.html` bit för bit, oavsett
katalog, tidszon, språk och datum: bygget läser inte klockan (`Build:` och `APP_BYGGDATUM` härleds ur `VERSION`;
datumet läses bara för påminnelsen om att `VERSION` inte är dagens), inga sökvägar hamnar i filen (esbuild skriver
relativa sökvägar i sina kommentarer), filerna läses i en fast ordning (skripten i en lista, modulerna i
importordning), och esbuilds version är låst i `package.json`. Radsluten är LF i varje utcheckning genom
`.gitattributes`: med `core.autocrlf` på Windows blev källan CRLF och filen en annan. `tests/build-app.test.js`
prövar att två byggen av `dist/app.js` i samma process, med klockan på olika år, ger samma bytes; CI bygger om i en
annan katalog (avsnitt 9) och release-arbetsflödet ur taggen (avsnitt 10).

**Byggets skyddsnät.** Bundlern avbryter bygget vid U+FFFD (mojibake) i egna källfiler (`src/index.html`,
`src/style.css`, `dist/app.js` och `src/licenser.txt`, inte de minifierade biblioteken), och kör `node --check` på
`dist/app.js`: ett syntaxfel avbryter bygget. Den avbryter också om CSP-metan i `src/index.html` saknar de
`'unsafe-inline'` som kontrollsummorna ersätter.

## 3. Versionering

CalVer (`ÅÅÅÅ.MM.DD`). `VERSION` är källan, och `package.json` sätts samtidigt (npm kräver fältet). `APP_VERSION` och
`APP_BYGGDATUM` genereras ur den (ADR-13). `tests/version.test.js` prövar att `VERSION` är CalVer och att
`package.json` följer den; att `src/app/08-version.js` följer den prövar artefaktgrinden. Bygget för in den i
`src/app/08-version.js`, `dist/` och programvaruförteckningen; `CHANGELOG.md` och riskanalysen anger den och prövas av
release-grinden. Hur en version släpps står i §10.

## 4. Stilmallen

`src/style.css` har komponentregler per flik, variabler i `:root` (färger, `--fs-*`-skalan) och sist ett namngivet
bibliotek av hjälpklasser som ersatte alla `style`-attribut (ADR-30).

- **Biblioteket** ligger i blocket «Hjälpklasser som ersätter style-attributen» (börjar vid `.dold`), med förklaring
  av namnen överst i blocket: sammansatta klasser för det som ofta hänger ihop (`rad-bryt-mitt`, `rad-mellan`,
  `text-dampad-sm`, `versal`, `notis-varning`), annars en klass per värde efter mönstret `egenskap-värde`
  (`marg-t-8`, `pad-10-14`, `gap-12`, `fs-sm`, `farg-dampad`, `ram-1-kant`, `rund-6`).
- **Företrädet.** Väljaren dubblerar klassnamnet (`.x.x.x`) för att få samma företräde som ett style-attribut hade,
  utan `!important`; färg- och statusklasserna (`fg-`, `bg-`, `bricka-` …) och de äldre hjälpklasserna (`t-hoger`,
  `mb-14` …) är `!important` och ligger efter biblioteket.
- **En ny kombination** skrivs med klasserna som finns; saknas ett värde läggs en rad till i rätt grupp.
- **Utskriftsfönstret** för checklistorna (`skrivUtMallflik`) läser `:root` och allt från `.dold` till
  stilmallens slut ur den körande stilmallen och lägger in det som byggt stilark (`adoptedStyleSheets`): ett
  `<style>`-element som skriptet skapar blockeras av den ärvda CSP:n (`style-src-elem`), så fönstret var tidigare
  helt ostilat.

## 5. Testerna

### 5.1 Sviten

Vitest. De genererade filerna (`dist/` och `src/app/08-version.js`) prövas av artefaktgrinden, inte av sviten, så `npm test` efter en ändring i `src/lib/` kräver
`npm run build:app` först; `npm run kontroll` gör det själv.

- rena `src/lib/`-moduler och CSV-parsningen, en fil per modul eller område (`tests/<område>.test.js`);
- jsdom-röktest av appen (ADR-7), en fil per funktion (`tests/<område>-app.test.js`, till exempel `inlasning-app` och
  `rapport-app`). Tal, maskering, status och urval prövas i Node mot vymodellen eller lib-funktionen; jsdom prövar att
  vyn ritar den, händelser, exportflöden och tillgänglighet, och k-invarianten (I4);
- det som går tvärs över funktionerna: k-tröskeln i `tests/ktroskel*.test.js` med riggen i
  `tests/helpers/ktroskel-rigg.js`; gränssnittet i `tests/granssnitt*.test.js` (riggen `tests/helpers/granssnitt-rigg.js`);
  diagrammen i `tests/diagram*.test.js` (riggen `tests/helpers/diagramvyer-rigg.js`); visningsminnet i
  `tests/visningsminne*.test.js` (riggen `tests/helpers/visningsminne-rigg.js`);
- axe-a11y (ADR-10, `tests/a11y.test.js`);
- vakterna `drift`, `exports.golden`, `version`, `release` och `kanonymitet`;
- escaping-vakten `tests/escaping.test.js` (motorn i `tests/helpers/htmlmallar.js`) läser `src/app/` utan att ladda
  appen och kräver att varje värde i appens HTML (mallsträngar med HTML, `innerHTML`, `insertAdjacentHTML`,
  konkatenering och beräkningsbevisens HTML-fält) går genom `esc()` eller bevisas säkert; vad den inte täcker och
  undantagen med skäl står i filen;
- de rena modulerna bakom Tabeller och egna vyer och exportmenyn (`utforska`, `urval`, `falt`);
- `tests/figur.test.js` prövar figurformatet och `tests/diagramritare.test.js` diagramkärnan (ADR-39). Den ritar med
  **äkta D3** i jsdom, så SVG:n som prövas är den riktiga, och två differentialtester vaktar att små grupper inte
  lämnar spår på skärmen eller i exporten.

**Ett nytt test prövar en sak på ett ställe.** En regel (en beräkning, en tolkning, en gräns) prövas i en enhetsfil
mot modulen i `src/lib/`: den körs på millisekunder och pekar ut felet. Ett apptest i jsdom skrivs för det som bara
syns när verktyget är ihopkopplat: vad en flik visar, vad som lämnar verktyget och att ett val når rätt väg. Har
regeln redan ett enhetstest prövar apptestet att regeln används, inte alla fall en gång till. Ett befintligt test
som inte följer det flyttas till regelns enhetsfil.

**Ett dokumenttest låser inte ordalydelsen.** Dokumenttesterna prövar att det dokumenten pekar på finns (filer,
skript, ADR-nummer), att tal ur koden står rätt och att avförda ord och påståenden inte står kvar. En formulering
låses bara när den bär ett skydd: vad dataskyddsdokumenten säger om skyddet, förbehållen och lagrummen.

Vilka tester som vaktar skydden står i [`skydd.md`](skydd.md), och vilka som vaktar principerna i
[`principer.md`](principer.md).

**Fokus i jsdom kräver en synlig vy.** Som i en webbläsare får ett element inte fokus när det eller en förälder har
`display: none`, och de stängda flikarnas paneler har det. Ett test som prövar fokus öppnar därför fliken som
användaren gör, med ett klick på `.nav-item[data-tab="…"]`; `__ritaFlik` ritar bara innehållet och lämnar
panelen dold.

**Flikbytet är synkront i jsdom och uppskjutet i webbläsaren** (ADR-80). Ett klick från koden (`el.click()`) är inte
användarens eget och ritar fliken direkt, så jsdom-testerna läser fliken genast efter klicket. I webbläsarröktestet är
`page.click` ett äkta klick: fliken visas först och räknas sedan, och testet klickar i menyn med `oppnaFlik`
(`tools/browser-smoke/rigg.mjs`), som väntar tills fliken är färdigritad. Ett äkta klick visar också en färdigritad
flik igen utan omritning när ingenting har ändrats (ADR-81); ett test som ändrar något med `page.evaluate` och sedan
klickar sig tillbaka till en ritad flik får därför den ritade fliken, om inte ändringen går genom en händelse eller
en väg som ökar visningsversionen (`k-troskeln.md` §3).

### 5.2 De två projekten

Sviten är delad i två Vitest-projekt i `vitest.config.js`: `enhet` (moduler, vakter och källtext, utan att verktyget
laddas) och `app` (filerna som ritar verktyget i jsdom). Klassningen görs när konfigurationen laddas, så en ny
testfil hamnar rätt utan att listas: en fil hör till `app` om källan nämner `app-harness`, en `-rigg.js` eller
`createAppWindow`, eller kör skript i jsdom (`runScripts`). En fil som bara använder jsdom som tolk, som
`docx.test.js` för XML, hör till `enhet`.

- `npm test` är den snabba körningen, bara `enhet` (sekunder).
- `npm run test:full` kör båda projekten (minuter) och är den som körs i CI och i `npm run kontroll`.
- `npm run test:app` kör bara `app`; `npm run test:watch` startar Vitest direkt i bevakningsläge.

`npm test`, `npm run test:full` och `npm run test:app` går genom `tools/test.mjs`, som kör sviten och sedan kör om de filer vars arbetare dog i Node
(SIGSEGV i V8:s skräpsamlare, sällsynt; orsaken ligger i Node, punkt 6 i [`oppna-punkter.md`](oppna-punkter.md)), högst två gånger. Ett test
som faller körs aldrig om, och utgångskoden är 0 först när alla filer har rapporterat och inget test har fallit.

### 5.3 Testmiljön

`tests/helpers/app-harness.js` kompilerar d3 och app.js en gång per arbetare och stänger och tömmer fönster som inte
behövs, så att varje arbetares minne håller sig under Nodes tak (den tyngsta filen under 1,2 GB). Ett fönster är
billigt efter det första (som bär kompileringen); det dyra är ritningen av alla flikar (omkring 2 s på demodatan), så
tiden styrs av hur många flikritningar en fil gör.

Vitest kör en fil per arbetare. **Körtiden styrs av den sammanlagda tiden delad på antalet arbetare** (2026-11-22:
omkring 2 050 s på tolv arbetare gav 198 s), och den längsta filen (omkring 100 s) är bara ett golv. Att dela en fil
gör därför sviten snabbare först när filen är längre än den sammanlagda tiden per arbetare. Apptesterna är delade
per funktion (`tests/*-app.test.js`), och k-tröskeltestet, gränssnittstestet och diagramvyerna per område
(`tests/ktroskel*.test.js`, `tests/granssnitt*.test.js`, `tests/diagramvyer*.test.js`) med gemensamma riggar i
`tests/helpers/`. Den längsta förberedelsen, invarianten över flikar och exporter (I4), är delad per
tröskel (`tests/ktroskel-invarianter.test.js` och `tests/ktroskel-invarianter-25.test.js`, sviten i
`tests/helpers/ktroskel-invariant.js`). Under full last tar varje fil omkring dubbelt så lång tid som ensam, och de
tyngsta ett par minuter.

`vitest.config.js` sätter en gemensam tidsgräns och **antalet arbetare: tre fjärdedelar av antalet trådar,
begränsat av maskinens totala minne med 1,2 GB per arbetare och 2 GB åt resten**. Skälet: de tunga filerna är
processorbundna, så med en arbetare per tråd trängs de om kärnorna, och med en per kärna köar de. På en maskin med
få kärnor eller lite minne blir sviten långsammare, inte ofullständig.

### 5.4 Delade fönster

Ett fönster och en inläsning av demodatan kostar omkring 0,6 s, så läsande tester kan dela fönster med
`delatFonster(forbered, skapa)` i `tests/helpers/app-harness.js`. Gruppen börjar med vakten `utgangslage(w)`
(tröskel, öppna dialoger, aktiv flik), och efter varje test jämförs `tillstandsavtryck(w)` (hela `state` utom
cachar, urvalet i Tabeller och egna vyer, markeringen och dialogerna): det test som lämnar något ändrat fälls.
Avtrycket ser inte allt, till exempel stubbar på fönstret och värden i fält, så ett test som ändrar något sådant
behåller ett eget fönster.

**En fil delar bara om den blir minst 20 % snabbare.** Under gränsen är vinsten mindre än variationen mellan
körningar, och i de flesta sådana filer ändrar testerna något. Apptesterna med ett fönster i `beforeAll`,
`kanonymitet` och `diagramritare` delade redan eller har sin tid i ritningen.

### 5.5 Webbläsarröktestet

`npm run test:browser` (`tools/browser-smoke.mjs`) är det andra lagret i ADR-7: Playwright-röktest av den
**byggda** artefakten i riktig webbläsare — under CSP:n från `file://`, som jsdom inte tillämpar. Provet kräver att
varje diagram har ritats av diagramkärnan, och ritar därtill ett eget diagram och exporterar det genom exportmenyn
(PNG i båda storlekarna, SVG som öppnas som eget dokument, diagramdata) — PNG via canvas finns inte i jsdom. Det
prövar också adressen `?demo=1`, räknar CSP-överträdelser och interna fel (ADR-31), och prövar att inget sparas och
att ingen trafik lämnar sidan.

**Röktestet prövar det som bara syns i en riktig webbläsare.** Det är den byggda filen under CSP:n från `file://`,
lagring och nät, geometri och utskrift, PNG och SVG, nedladdningar och urklipp, äkta klick och tangentbord (ADR-80,
ADR-81), och att varje flöde går utan konsolfel och interna fel. Vad en flik eller export innehåller prövas i jsdom.
Ett flöde får läsa ett värde för att veta att det kom fram, men upprepar inte jsdom-testets fall.

- **Kontrollerna** ligger per område i `tools/browser-smoke/` med en gemensam rigg (`tools/browser-smoke/rigg.mjs`:
  webbläsaren, sidan, `ok()` och hjälparna); `tools/browser-smoke.mjs` kör dem i en fast ordning och skriver
  sammanfattningen. Med `--bilder=<katalog>` sparas diagramkärnans exporterade PNG och SVG för granskning med ögat.
- **Färskhetsspärren** (ADR-7): riggen avbryter innan något prövas om någon fil som bygget läser är nyare än bygget:
  sökvägarna i `KODVAGAR` i `tools/release.mjs` (`src/`, `vendor/` och byggskripten) och `VERSION`, utom dokumenten
  (`.md`). Prestandasvepet har samma spärr (`nyareAnBygget`). Kör `npm run bundle` först.
- **Tre webbläsare:** Chromium, Firefox och WebKit (`--browser=…`, `npm run test:browser:firefox`/`:webkit`;
  `npm run test:browser:webkit:behallare` kör WebKit i en behållare med podman). När CI kör vilken motor står i
  jobbet `browser` i `.github/workflows/ci.yml` (avsnitt 9).

### 5.6 Prestandamätningen

`npm run perf` (`tools/perf-smoke.mjs`) laddar ett syntetiskt 55 000-radersdataset med kvinnodominerade, blandade
och mansdominerade yrken (`byggTestCsv` i `tools/lib/testdata.mjs` med valet `mansdominerade`; `--rader=` ger ett
annat antal)
genom den riktiga filuppladdningen i Chromium, mäter tiden tills gränssnittet är klart och tills bakgrundsanalyserna
är klara, tar tid på varje fliks rendering och mäter därefter navigeringen (sidindexet, första sökningen,
BAS-dossiern och gruppdossiern). Vakten är en snäv budget på tiden till klart gränssnitt (5 s), snäv för att en
kvadratisk loop ska synas, 5 s för varje flik i menyn (en flik som kastar fäller också), 1 s för förhandsbeskedet
efter ett ändrat kryss under *Rapportens innehåll*, och att alla rader lästes in. Budgeten
är maskinberoende, så skriptet körs inför en release på en utvecklarmaskin, inte i CI. Mätvärdena står i punkt 5 i
[`oppna-punkter.md`](oppna-punkter.md). Översiktens bootstrap och trattdiagrammets omkastning räknas en gång per underlag.

## 6. Typkontrollen

`npm run typecheck` kör TypeScript (`tsc`, ur utvecklingsberoendet `typescript`) i `checkJs`-läge på
JavaScript-källan med JSDoc som typspråk — inget skrivs om till TypeScript och inget emitteras.

- **Två projekt:** `tsconfig.json` (`npm run typecheck:lib`) tar `src/lib/**` och `tools/**` som ES-moduler;
  `tsconfig.app.json` (`npm run typecheck:app`) tar ES-modulerna från `src/app/index.js` och följer importerna, också
  till `src/lib/`. Röktestet och prestandasvepet kör sina callbacks i webbläsarens realm (`page.evaluate`) och
  är uteslutna, som i `eslint.config.js`.
- **Inställningarna:** `strictNullChecks` är på, `noImplicitAny` av (koden är dynamiskt typad där JSDoc saknas),
  `useUnknownInCatchVariables` av.
- **Globalerna:** biblioteken (`d3`, `XLSX`, `Papa`, `JSZip`) och appens egna fält på DOM-element (`tr._markering`
  m.fl.) deklareras i `types/globals.d.ts`; Node-API:t typas av `@types/node` (`"types": ["node"]` i
  `tsconfig.json`).
- **Nolläget:** båda projekten har noll fel (CI stoppar på första felet), och inga `@ts-ignore`/`@ts-expect-error`
  används. DOM-typerna (`Element`/`EventTarget`/`HTMLElement`, null ur `getElementById`) löses med riktade
  typomvandlingar vid anropet (`/** @type {HTMLInputElement} */ (e.target).value`), otypade `let x = null`/`[]` och
  `state`-fälten med `@type`-annoteringar på deklarationen.
- **Ingen standardtröskel.** Funktioner i `src/lib` som tar `k` (`likaArbeteGrupper`, `prioritera` …) har inget
  standardobjekt `= {}`: en utelämnad `k` hade tyst stängt av maskeringen, och varje anropare skickar den.

## 7. Lint

`npm run lint` kör ESLint på `src` (appen och lib, som ES-moduler), `tests` och `tools`; `dist/`, biblioteken i
`vendor/` och `types/` lintas inte. Ett namn som en del använder utan att importera fälls av `no-undef`.
`npm run lint:fix` rättar det som går. Röktestet och prestandasvepet lintas med webbläsarens och appens
globaler, eftersom deras callbacks körs i sidan.

Linten förbjuder nät-API och lagring utanför lagringsspärren i appens kod och i lib-modulerna (skydden S1 och S2 i
[`skydd.md`](skydd.md)): `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`,
`indexedDB`, `caches` och arbetstrådar. Den ser bara direkta anrop med de namnen; spärren i
`src/app/00-sakerhet-och-uppstart.js` rör `localStorage`, `sessionStorage` och `document.cookie` avsiktligt, och de
förbjuds därför inte.

## 8. `npm run kontroll`

`npm run kontroll` (`tools/kontroll.mjs`) kör kedjan i *Definition of Done* i
[`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md), punkt 3: `build:app`, `lint`, `typecheck`, `test:full`,
`bundle` och `test:browser`, i den ordningen, och stannar på första fel med stegets slutkod. Efter `bundle` prövas
**artefaktgrinden** (bygget ändrade ingen genererad
fil: ingen spårad fil under `dist/`, alltså inte heller `RELEASE.txt`, och inte `src/app/08-version.js`; kedjan jämför filerna som de låg när den började, CI jämför med det incheckade. En
ändring betyder att de inte motsvarade källan, och de ombyggda filerna ska checkas in). Teckenkodningen prövar bygget
självt (*Byggets skyddsnät* ovan). Sist skrivs
stegens tider. `npm run kontroll -- --snabb` är körningen under arbetet: `test` i stället för `test:full`, och inget
röktest i webbläsaren. `node tools/kontroll.mjs --artefakt` kör bara `bundle` och artefaktgrinden; det är
artefaktgrinden i CI och i releasen, så att regeln för vilka filer som jämförs står på ett ställe.
`tests/dokumentation-struktur.test.js` kräver att kedjan har varje steg som CI-jobben `grindar` och `tester` kör, och
att båda arbetsflödena kör artefaktgrinden genom `tools/kontroll.mjs`.

## 9. CI

CI är `.github/workflows/ci.yml`, och dess kommentarer är källan till stegen, när de körs och varför. I korthet har
arbetsflödet fyra jobb: **`grindar`** kör lint, typkontroll och artefaktgrinden (teckenkodningen prövar bygget självt, `tools/bundle.mjs`), **`tester`**
kör hela testsviten (`npm run test:full`) delad på fyra parallella jobb med Vitests `--shard`, så att varje testfil
körs i exakt ett av dem, **`quality`** är grön först när `grindar`, alla delar av `tester` och `browser` i alla motorer
är gröna (det är den kontroll som regeln för `main` kräver), och **`browser`** kör röktestet i Chromium, Firefox och WebKit mot en artefakt som
byggs i jobbet. **Artefaktgrinden** (`node tools/kontroll.mjs --artefakt`, §8) bygger om och kräver att hela
`dist/`, också `RELEASE.txt`, och den genererade `src/app/08-version.js` blir byte-identiska med det incheckade. Den är den enda
kontrollen av de genererade filerna. Efter den bygger `grindar` samma commit en gång till i en ny katalog
(`git worktree`), med annan tidszon och annat språk, och kräver samma kontrollsumma (ADR-101).

**Sårbarhetsbevakningen** är ett eget arbetsflöde, `.github/workflows/sarbarheter.yml`, vars kommentarer är källan
till stegen. Det bygger programvaruförteckningen (`tools/sbom.mjs`), frågar den öppna sårbarhetsdatabasen OSV direkt
om vart och ett av de fyra biblioteken i `vendor/` (`tools/sarbarheter-hamta.mjs`, med bara paketets namn, ekosystem
och version) och bedömer svaret med `tools/sarbarheter.mjs`. Hämtningen faller om databasen inte kunde frågas
(nätfel, felstatus, ett svar som inte är JSON), med ett besked som skiljer det från ett fynd; bedömningen, som inte
gör några nätverksanrop, faller om ett bibliotek inte prövades eller om något har en känd sårbarhet. Arbetsflödet
använder bara GitHubs egna actions, eftersom repot inte tillåter andra; frågan görs därför av ett eget skript i
stället för en färdig skanner. Det körs varje måndag, när `vendor/`, `tools/sbom.mjs`, `tools/sarbarheter-hamta.mjs`,
`tools/sarbarheter.mjs` eller `TREDJEPARTSLICENSER.md` ändras (pull request och `main`) och för hand. Det är skilt
från `ci.yml`, så att ett nytt fynd i databasen syns som en egen fallen körning utan att CI-kontrollen för `main` blir
röd; jobbet har bara läsbehörighet och inga hemligheter. Bara CI hämtar något från nätet: verktyget självt gör
fortfarande inga nätverksanrop (S1).

Bevakningen täcker de sårbarheter som finns i OSV under npm-paketens namn (`d3`, `papaparse`, `jszip`, `xlsx`), där
också rådgivningarna från GitHub ligger. SheetJS ges i nyare versioner ut utanför npm-registret men identifieras i
databasen som `xlsx`; rådgivningarna för SheetJS saknar därför åtgärdad version och träffar varje version, också den
i `vendor/`. De som enligt rådgivningens text är åtgärdade i vår version står med skäl i `ÅTGÄRDADE` i
`tools/sarbarheter.mjs` och räknas bort bara från den åtgärdade versionen. Bevakningen täcker inte brister som bara
publiceras hos projekten själva utan att föras in i OSV, och inte de nedladdade filernas äkthet (det gör
kontrollsummorna i `vendor/SHA256SUMS`). Utvecklingsberoendena bevakas av Dependabot (avsnitt 11).

## 10. Release och demosidan

**Släppa en version.** Hur en mottagare verifierar filen står i `SECURITY.md` (*Kontrollera att filen är äkta*).

1. Granska `docs/dataskydd/riskanalys.md` och `docs/dataskydd/dataskydd.md` mot koden och sätt
   granskningsdatumet (punkt 17b i [`oppna-punkter.md`](oppna-punkter.md)).
2. Läs nästa område i tur och ordning rad för rad, och rätta det som glidit isär: en uppgift på två ställen, en
   kommentar eller ett test som inte längre stämmer, död kod. En diff visar inte originalet till en kopia, så det
   syns bara när helheten läses. Områdena: (1) indata och förtroendegränser, (2) minsta gruppstorlek och
   undertryckning, (3) exporterna, (4) statistiken, (5) löneöversyn, kostnad, prioritering och lönepolitik,
   (6) rensning, inaktivitet och tillstånd, (7) övriga vyer och diagramritaren, (8) bygget, CI och verktygen,
   (9) testsviten. Vilket område som lästs står i CHANGELOG under versionen.
3. Sätt versionen i `VERSION` och `package.json`, och byt rubriken *Oförlöst* i `CHANGELOG.md` mot versionen.
4. `npm run build:app && npm run bundle`; för in byggets kontrollsumma och version på rad 3 i riskanalysen.
5. Har funktionalitet tillkommit eller ändrats sedan förra versionen: uppdatera och bygg om bildspelet
   `site/genomgang.html` (Definition of Done i `.github/CONTRIBUTING.md`).
6. Kör `npm run test:full`, checka in och kör `npm run release:kontroll`. Grinden skriver ut taggkommandot.
7. Pusha taggen `v<VERSION>`. Arbetsflödet `.github/workflows/release.yml` kör grinden igen, bygger om, signerar och
   publicerar en GitHub Release. Samma tagg publicerar demosidan (`.github/workflows/pages.yml`; går också att köra
   för hand).

**Release-grinden** `npm run release:kontroll` (`tools/release.mjs`, prövad på fixturer i `tests/release.test.js`)
prövar bara det som gäller vid en release; vad, står i huvudet i `tools/release.mjs`. Det som ska gälla i varje
commit prövar den inte, utan testsviten och artefaktgrinden (princip 4 i [`principer.md`](principer.md)).

**Arbetsflödet** `.github/workflows/release.yml` körs på en tagg `v*`: det kör grinden igen, bygger om med artefaktgrinden (§8), tar fram
programvaruförteckningen (`npm run sbom`, `tools/sbom.mjs`: `dist/sbom.cdx.json` i CycloneDX), bygger
valideringsrapporten, bygger om verktyget ur taggen i en ren katalog och kräver att det blir filen som signeras,
signerar med Sigstore cosign utan nyckel, låter GitHub attestera ursprunget (`actions/attest-build-provenance`, SLSA
build provenance, ADR-101) och publicerar en GitHub Release. Det som kör npm och testsviten ligger i ett jobb som bara
får läsa repot (`contents: read`); signeringen och publiceringen ligger i ett eget jobb, som får filerna som en artefakt och inte kör npm.
Stegen, deras ordning och behörigheterna står i arbetsflödet och dess kommentarer; `tests/sakerhet.test.js` prövar
ordningen, den fullständiga klonen, att signeringen är utan nyckel, att varje fil attesteras, ombygget och
behörigheterna i de två jobben.

**Valideringsrapporten** `npm run valideringsrapport` (`tools/valideringsrapport.mjs`, prövad i
`tests/valideringsrapport.test.js`, ADR-100) kör hela sviten med Vitests JSON-rapport och skriver
`dist/valideringsrapport.md` och `dist/valideringsrapport.json`: byggets version och SHA-256 (ur `dist/RELEASE.txt`,
prövad mot filen), commit, datum, Node, Vitest och jsdom, och en rad per ID i [`sparbarhet.md`](sparbarhet.md) med
testerna vars namn bär ID:t och utfallet. Den fäller när ett ID saknar godkänt test eller något test faller. Testsviten
körs bara här i release-arbetsflödet, inte i CI:s vanliga körning, som redan kör den delad på fyra jobb. Med en färdig
JSON-rapport som argument (`node tools/valideringsrapport.mjs <fil>`) körs inga tester. Filerna i `dist/` är
ignorerade, som programvaruförteckningen.

**Demosidan.** `npm run site` (`tools/site.mjs`, efter `npm run bundle`) bygger `site/dist/` (startsidan ur
`site/index.html`, bygget, `RELEASE.txt` och bildspelet `site/genomgang.html`) för valfri statisk webbplats. Sidan har inga skript och länkar till
verktyget med `?demo=stor`, som startar det stora demot (bara parametern `demo` läses). Finns en översiktsbild eller en
kort slinga i `dist/marknad/` tas den med på sidan. Arbetsflödet `.github/workflows/pages.yml` (på tagg `v*` eller
för hand) kör `node tools/site.mjs` med guidelänkar till `docs/anvandare/` i repot och publicerar på GitHub Pages
(`upload-pages-artifact`, `deploy-pages`); jobbet som publicerar har bara `pages: write` och `id-token: write`.

## 11. Ärenden och beroendeuppdateringar

**Ärenden:** mallar för fel och förslag på svenska i `.github/ISSUE_TEMPLATE/`, med kryssrutan att ärendet inte
innehåller verklig lönedata; tomma ärenden är avstängda, och säkerhetsbrister rapporteras privat (`SECURITY.md`).

**Beroendeuppdateringar** (`.github/dependabot.yml`): npm veckovis med utvecklingsberoendena i en grupp, och
arbetsflödenas steg veckovis. Varje `uses:` i arbetsflödena ska peka på en fullständig commit-SHA med versionen som
kommentar (`tests/sakerhet.test.js`), och Dependabot uppdaterar båda tillsammans. Verktyget har inga
körtidsberoenden från npm: biblioteken ligger låsta i `vendor/`, och Dependabot ser dem inte; dem bevakar
sårbarhetsbevakningen (avsnitt 9).

## 12. Dokumentationen

Förteckningen över dokumenten i `docs/`, efter läsare, står i [`docs/README.md`](../README.md), och mapparna i
`README.md` (*Repot*). Hur filer namnges står i §1. Metoderna beskrivs för användaren i appens flik *Om verktyget*.

## 13. Termerna

Orden för AID:s begrepp (AID-etikett, jämförelseetikett, AID-kod, etikettnamn, huvudområde och BAS-intervall) står bara
i `STANDARDTERMER` i `src/lib/termer.js` (ADR-74), med de fyra ordformerna och genus per begrepp, så att artikel,
adjektiv och genitiv böjs rätt. I appen är `T` den gällande uppsättningen (`src/app/09-termer.js`).

- **En text i koden** byggs med `T` och hjälparna i `src/lib/termer.js` (`termFras`, `artikel`, `adjektiv`, `genitiv`, `stor`,
  `ordForAntal`), aldrig med orden själva. Kommentaren överst i `src/app/09-termer.js` har exemplen.
- **Fast text** (ordlistan, `src/index.html`) är en mall, `{Enhet.bfl} i samma {niva.en}`, som `termText` fyller. I
  `index.html` bär elementet mallen i `data-term-template`, och standardtexten står kvar i elementet.
- **Kort form** (`kort`, mallen `{enhet.kort}`) är valfri per begrepp och används i en kolumnrubrik där hela termen
  inte ryms, på skärmen och i rapporten (ADR-75): *AID* för AID-etikett. Saknas den står obestämd form. Exporternas
  etiketter (`data-export-label`) behåller hela termen, och vakten prövar inte den korta formen.
- **Vakten** `tests/termer.test.js` kräver att de avförda orden (listan `AVFORDA`) och termernas ordformer inte står i
  synlig text utanför `termer.js`, och att de avförda orden inte står i löptexten i `docs/anvandare/` och
  `docs/dataskydd/`. Undantagen (lönefilens kolumnnamn, vardagliga ord) står i testet med skäl.
- **Byta uppsättning** är att ändra `STANDARDTERMER`, eller att ge `skapaTermer` en egen uppsättning i
  `src/app/09-termer.js` (den avvisar tomma och för långa former), och sedan köra `npm run build:app`. Dokumenten kan inte
  läsa variablerna och är skrivna med standardorden.
