# Bygge och test — referens

Hur verktyget byggs, testas, typkontrolleras och släpps i dag: körtiden, bygget och dess skyddsnät, versioneringen,
stilmallen, testsviten och testmiljön, typkontrollen, linten, `npm run kontroll`, CI, releasen och demosidan. Det
här dokumentet är referensen för den som ändrar bygget, testmiljön, CI eller releasen. Koden och konfigurationen är
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
| Bygget | `tools/build-app.mjs`, `tools/bundle.mjs`, `tools/gen-mirrors.mjs`, `tools/gen-version.mjs`, `tools/lib/minify-css.mjs` |
| Testsviten och testmiljön | `vitest.config.js`, `tools/test.mjs`, `tests/helpers/app-harness.js` |
| Webbläsarröktestet och prestandamätningen | `tools/browser-smoke.mjs`, `tools/browser-smoke/`, `tools/perf-smoke.mjs` |
| Typkontrollen och linten | `tsconfig.json`, `tsconfig.app.json`, `types/globals.d.ts`, `eslint.config.js` |
| Kedjan lokalt | `tools/kontroll.mjs` |
| CI, release och demosidan | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/pages.yml`, `tools/release.mjs`, `tools/site.mjs` |
| Beroendeuppdateringar | `.github/dependabot.yml` |

## 1. Körtid och mappar

**Node ≥ 22.12** (`engines` i `package.json`). jsdom-kedjan gör `require()` av en ES-modul, vilket kastar
`ERR_REQUIRE_ESM` på Node 20 — smoke-, a11y- och golden-sviterna faller då tyst. `require(esm)` är påslaget från
22.12.

**Mapparna** står i `README.md` (*Repot*), och appens moduler i `src/app/README.md`.

**Namngivning.** Filnamn skrivs med gemener och bindestreck, utan å, ä och ö. Levande dokument har inget datum eller
versionsnummer i filnamnet; versionen står i dokumentet. Modulerna i `src/app/` har ett tvåsiffrigt prefix som styr
ordningen när de slås ihop.

**Källfilerna** är `src/index.html`, `src/style.css`, `src/app/NN-*.js` och `src/lib/*.js`. `dist/app.js` är ett
**genererat** hopslag av `src/app/` och redigeras aldrig direkt (ADR-6, ADR-8).

**`src/index.html` går inte att köra direkt i en webbläsare.** Den pekar på biblioteken i `vendor/` och på
`dist/app.js` (relativa sökvägar från `src/`), men dess CSP (`default-src 'none'; script-src 'unsafe-inline'`)
blockerar stilmallen och alla skriptfilerna (fem: fyra bibliotek och verktygets eget skript; prövat i Chromium). Den
är indata till bygget och till jsdom-testerna; en ändring ses i `dist/oppen-lonekartlaggning.html` efter
`npm run bundle`.

## 2. Bygget

**`npm run build:app`** (`tools/build-app.mjs`) regenererar `src/app/08-version.js` ur `VERSION`
(`tools/gen-version.mjs`, ADR-13) och `src/app/09-lib-speglar.js` ur `src/lib/` (`tools/gen-mirrors.mjs`, ADR-8),
och slår sedan ihop `src/app/NN-*.js` byte för byte (BOM och CRLF bevaras) till `dist/app.js` (ADR-6).
`tests/appsource.test.js` vaktar att `dist/app.js` och `src/app/` inte glider isär, och `tests/drift.test.js` att
speglarna är i synk med `src/lib/`.

**`npm run bundle`** (`tools/bundle.mjs`) gör samma regenerering och bygger sedan
`dist/oppen-lonekartlaggning.html` (omkring 3,4 MB; en enda fil) och `dist/RELEASE.txt`:

- Biblioteken och `dist/app.js` läggs in som skript i sidan, och CSP:ns `script-src` och `style-src-elem` får
  kontrollsummor i stället för `'unsafe-inline'` (ADR-9, ADR-30).
- CSS och HTML minifieras; **JS minifieras inte** (template literals bevaras; ADR-2). Förminskningen av stilmallen
  ligger i `tools/lib/minify-css.mjs` med tester i `tests/byggminify.test.js`: strängar och `url()` rörs inte,
  blanksteg runt `+` och `-` i värden står kvar, och blanksteget före en pseudoklass i en väljare står kvar.
- Licenstexterna ur `src/licenser.txt` läggs i en inaktiv `<template>` efter sista skriptet, så att CSP:ns
  kontrollsummor inte påverkas.
- SHA-256 loggas i `dist/RELEASE.txt` tillsammans med version, storlek, källorna och kommandona för att kontrollera
  summan. Filen är deterministisk: `Build:`-raden härleds ur `VERSION`, inte ur systemklockan, så en ombyggnad av
  oförändrad källa smutsar inte ner arbetskatalogen. Bygget är byte-reproducerbart, och det är vad artefaktgrinden
  i CI prövar (avsnitt 9).

**Byggets skyddsnät.** Bundlern avbryter bygget vid U+FFFD (mojibake) i egna källfiler (`src/index.html`,
`src/style.css`, `dist/app.js` och `src/licenser.txt`, inte de minifierade biblioteken), och kör `node --check` på
`dist/app.js`: ett syntaxfel avbryter bygget. Den avbryter också om CSP-metan i `src/index.html` saknar de
`'unsafe-inline'` som kontrollsummorna ersätter.

## 3. Versionering

CalVer (`ÅÅÅÅ.MM.DD`). `VERSION` är källan, och `package.json` sätts samtidigt (npm kräver fältet). `APP_VERSION` och
`APP_BUILD_DATE` genereras ur den (ADR-13). `tests/version.test.js` prövar att `VERSION` är CalVer och att stämpeln
och `package.json` följer den. Bygget för in den i `src/app/08-version.js`, `dist/` och programvaruförteckningen;
`CHANGELOG.md` och riskanalysen anger den och prövas av release-grinden. Hur en version släpps står i §10.

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
- **Utskriftsfönstret** för checklistorna (`printScaffoldView`) läser `:root` och allt från `.dold` till
  stilmallens slut ur den körande stilmallen och lägger in det som byggt stilark (`adoptedStyleSheets`): ett
  `<style>`-element som skriptet skapar blockeras av den ärvda CSP:n (`style-src-elem`), så fönstret var tidigare
  helt ostilat.

## 5. Testerna

### 5.1 Sviten

Vitest, med omkring 3 400 tester i drygt 100 filer:

- rena `src/lib/`-moduler och CSV-parsningen;
- jsdom-röktest av varje vy (ADR-7): `tests/smoke.test.js` med det delade fönstret och ett dussintal
  `tests/smoke-*.test.js` per område;
- k-tröskeln i fjorton `tests/ktroskel*.test.js` med riggen i `tests/helpers/ktroskel-rigg.js`; gränssnittet i
  `tests/granssnitt*.test.js` (riggen `tests/helpers/granssnitt-rigg.js`) och diagramvyerna i
  `tests/diagramvyer*.test.js` (riggen `tests/helpers/diagramvyer-rigg.js`);
- axe-a11y (ADR-10, `tests/a11y.test.js`);
- vakterna `appsource`, `drift`, `exports.golden`, `version`, `release` och `kanonymitet`;
- de rena modulerna bakom Tabeller och egna vyer och exportmenyn (`utforska`, `urval`, `falt`);
- `tests/figur.test.js` prövar figurformatet och `tests/diagramritare.test.js` diagramkärnan (ADR-39). Den ritar med
  **äkta D3** i jsdom, så SVG:n som prövas är den riktiga, och två differentialtester vaktar att små grupper inte
  lämnar spår på skärmen eller i exporten.

Vilka tester som vaktar skydden står i [`skydd.md`](skydd.md), och vilka som vaktar principerna i
[`principer.md`](principer.md).

**Fokus i jsdom kräver en synlig vy.** Som i en webbläsare får ett element inte fokus när det eller en förälder har
`display: none`, och de stängda flikarnas paneler har det. Ett test som prövar fokus öppnar därför fliken som
användaren gör, med ett klick på `.nav-item[data-tab="…"]`; `__renderTabContent` ritar bara innehållet och lämnar
panelen dold.

### 5.2 De två projekten

Sviten är delad i två Vitest-projekt i `vitest.config.js`: `enhet` (moduler, vakter och källtext, utan att verktyget
laddas) och `app` (filerna som ritar verktyget i jsdom). Klassningen görs när konfigurationen laddas, så en ny
testfil hamnar rätt utan att listas: en fil hör till `app` om källan nämner `app-harness`, en `-rigg.js` eller
`createAppWindow`, eller importerar jsdom.

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

Vitest kör en fil per arbetare, så **den längsta filen sätter golvet för hela körningen**. Därför är röktestet,
k-tröskeltestet, gränssnittstestet och diagramvyerna delade i filer per område (`tests/smoke*.test.js`,
`tests/ktroskel*.test.js`, `tests/granssnitt*.test.js`, `tests/diagramvyer*.test.js`) med gemensamma riggar i
`tests/helpers/`. Den längsta förberedelsen, invarianten över flikar och exporter (I4), är av samma skäl delad per
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
körningar, och i de flesta sådana filer ändrar testerna något. `smoke`, `kanonymitet` och `diagramritare` delade
redan eller har sin tid i ritningen.

### 5.5 Webbläsarröktestet

`npm run test:browser` (`tools/browser-smoke.mjs`) är det andra lagret i ADR-7: Playwright-röktest av den
**byggda** artefakten i riktig webbläsare — under CSP:n från `file://`, som jsdom inte tillämpar. Provet kräver att
varje diagram har ritats av diagramkärnan, och ritar därtill ett eget diagram och exporterar det genom exportmenyn
(PNG i båda storlekarna, SVG som öppnas som eget dokument, diagramdata) — PNG via canvas finns inte i jsdom. Det
prövar också adressen `?demo=1`, räknar CSP-överträdelser och interna fel (ADR-31), och prövar att inget sparas och
att ingen trafik lämnar sidan.

- **Kontrollerna** ligger per område i `tools/browser-smoke/` med en gemensam rigg (`tools/browser-smoke/rigg.mjs`:
  webbläsaren, sidan, `ok()` och hjälparna); `tools/browser-smoke.mjs` kör dem i en fast ordning och skriver
  sammanfattningen. Med `--bilder=<katalog>` sparas diagramkärnans exporterade PNG och SVG för granskning med ögat.
- **Färskhetsspärren** (ADR-7): riggen avbryter innan något prövas om `src/index.html`, `src/style.css`,
  `dist/app.js` eller någon fil i `src/app/` är nyare än bygget. Kör `npm run bundle` först.
- **Tre webbläsare:** Chromium, Firefox och WebKit (`--browser=…`, `npm run test:browser:firefox`/`:webkit`;
  `npm run test:browser:webkit:behallare` kör WebKit i en behållare med podman). När CI kör vilken motor står i
  jobbet `browser` i `.github/workflows/ci.yml` (avsnitt 9).

### 5.6 Prestandamätningen

`npm run perf` (`tools/perf-smoke.mjs`) laddar ett syntetiskt 55 000-radersdataset (`--rader=` ger ett annat antal)
genom den riktiga filuppladdningen i Chromium, mäter tiden tills gränssnittet är klart och tills bakgrundsanalyserna
är klara, tar tid på varje fliks rendering och mäter därefter navigeringen (sidindexet, första sökningen,
BAS-dossiern och gruppdossiern). Vakten är en snäv budget på tiden till klart gränssnitt (5 s), snäv för att en
kvadratisk loop ska synas, och 1 s för förhandsbeskedet efter ett ändrat kryss under *Rapportens innehåll*. Budgeten
är maskinberoende, så skriptet körs inför en release på en utvecklarmaskin, inte i CI. Mätvärdena står i punkt 5 i
[`oppna-punkter.md`](oppna-punkter.md). Översiktens bootstrap och trattdiagrammets omkastning räknas en gång per underlag.

## 6. Typkontrollen

`npm run typecheck` kör TypeScript (`tsc`, ur utvecklingsberoendet `typescript`) i `checkJs`-läge på
JavaScript-källan med JSDoc som typspråk — inget skrivs om till TypeScript och inget emitteras.

- **Två projekt:** `tsconfig.json` (`npm run typecheck:lib`) tar `src/lib/**` och `tools/**` som ES-moduler;
  `tsconfig.app.json` (`npm run typecheck:app`) tar `src/app/*.js` som skript i ett gemensamt globalt scope, precis
  som i `dist/app.js`. Röktestet och prestandasvepet kör sina callbacks i webbläsarens realm (`page.evaluate`) och
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

`npm run lint` kör ESLint på `dist/app.js`, `src/lib`, `tests` och `tools` (`npm run lint:fix` rättar det som går);
biblioteken i `vendor/` och `types/` lintas inte. Röktestet och prestandasvepet lintas med webbläsarens och appens
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
samma två grindar som CI-jobbet `grindar` kör utöver npm-skripten: **artefaktgrinden** (bygget ändrade ingen spårad
fil under `dist/`, alltså inte heller `RELEASE.txt`; kedjan jämför `dist/` som den låg när den började, CI jämför med
det incheckade. En ändring betyder att `dist/` inte motsvarade källan, och de ombyggda filerna ska checkas in)
och **teckenkodningsgrinden** (ingen U+FFFD i `dist/app.js`, `src/index.html` och `src/style.css`). Sist skrivs
stegens tider. `npm run kontroll -- --snabb` är körningen under arbetet: `test` i stället för `test:full`, och inget
röktest i webbläsaren. `tests/dokumentation-struktur.test.js` kräver att kedjan har varje steg som CI-jobben
`grindar` och `tester` kör.

## 9. CI

CI är `.github/workflows/ci.yml`, och dess kommentarer är källan till stegen, när de körs och varför. I korthet har
arbetsflödet fyra jobb: **`grindar`** kör lint, typkontroll, teckenkodningsgrinden och artefaktgrinden, **`tester`**
kör hela testsviten (`npm run test:full`) delad på fyra parallella jobb med Vitests `--shard`, så att varje testfil
körs i exakt ett av dem, **`quality`** är grön först när `grindar` och alla delar av `tester` är gröna (det är den
kontroll som regeln för `main` kräver), och **`browser`** kör röktestet i Chromium, Firefox och WebKit mot en artefakt som
byggs i jobbet. **Artefaktgrinden** bygger om och kräver att hela `dist/`, också `RELEASE.txt`, blir byte-identisk
med det incheckade. Den är den enda kontrollen av artefakten och `RELEASE.txt`; `dist/app.js` vaktas också av
`appsource`-testet.

## 10. Release och demosidan

**Släppa en version.** Hur en mottagare verifierar filen står i `SECURITY.md` (*Kontrollera att filen är äkta*).

1. Granska `docs/dataskydd/riskanalys.md` och `docs/dataskydd/dataskydd.md` mot koden och sätt
   granskningsdatumet (punkt 17b i [`oppna-punkter.md`](oppna-punkter.md)).
2. Sätt versionen i `VERSION` och `package.json`, och byt rubriken *Oförlöst* i `CHANGELOG.md` mot versionen.
3. `npm run build:app && npm run bundle`; för in byggets kontrollsumma och version på rad 3 i riskanalysen.
4. Kör `npm run test:full`, checka in och kör `npm run release:kontroll`. Grinden skriver ut taggkommandot.
5. Pusha taggen `v<VERSION>`. Arbetsflödet `.github/workflows/release.yml` kör grinden igen, bygger om, signerar och
   publicerar en GitHub Release. Samma tagg publicerar demosidan (`.github/workflows/pages.yml`; går också att köra
   för hand).

**Release-grinden** `npm run release:kontroll` (`tools/release.mjs`, prövad på fixturer i `tests/release.test.js`)
prövar bara det som gäller vid en release; vad, står i huvudet i `tools/release.mjs`. Det som ska gälla i varje
commit prövar den inte, utan testsviten och artefaktgrinden (princip 4 i [`principer.md`](principer.md)).

**Arbetsflödet** `.github/workflows/release.yml` körs på en tagg `v*`: det kör grinden igen, bygger om, tar fram
programvaruförteckningen (`npm run sbom`, `tools/sbom.mjs`: `dist/sbom.cdx.json` i CycloneDX), signerar med Sigstore
cosign utan nyckel och publicerar en GitHub Release. Stegen, deras ordning och behörigheterna står i arbetsflödet och
dess kommentarer; `tests/sakerhet.test.js` prövar ordningen, den fullständiga klonen, att signeringen är utan nyckel
och att jobbet har minsta behörighet.

**Demosidan.** `npm run site` (`tools/site.mjs`, efter `npm run bundle`) bygger `site/dist/` (startsidan ur
`site/index.html`, bygget och `RELEASE.txt`) för valfri statisk webbplats. Sidan har inga skript och länkar till
verktyget med `?demo=1`, som startar demoläget (ingen annan adressparameter läses). Finns en översiktsbild eller en
kort slinga i `dist/marknad/` tas den med på sidan. Arbetsflödet `.github/workflows/pages.yml` (på tagg `v*` eller
för hand) kör `node tools/site.mjs` med guidelänkar till `docs/anvandare/` i repot och publicerar på GitHub Pages
(`upload-pages-artifact`, `deploy-pages`); jobbet som publicerar har bara `pages: write` och `id-token: write`.

## 11. Ärenden och beroendeuppdateringar

**Ärenden:** mallar för fel och förslag på svenska i `.github/ISSUE_TEMPLATE/`, med kryssrutan att ärendet inte
innehåller verklig lönedata; tomma ärenden är avstängda, och säkerhetsbrister rapporteras privat (`SECURITY.md`).

**Beroendeuppdateringar** (`.github/dependabot.yml`): npm veckovis med utvecklingsberoendena i en grupp, och
arbetsflödenas steg veckovis. Varje `uses:` i arbetsflödena ska peka på en fullständig commit-SHA med versionen som
kommentar (`tests/sakerhet.test.js`), och Dependabot uppdaterar båda tillsammans. Verktyget har inga
körtidsberoenden från npm: biblioteken ligger låsta i `vendor/`.

## 12. Dokumentationen

Förteckningen över dokumenten i `docs/`, efter läsare, står i [`docs/README.md`](../README.md), och mapparna i
`README.md` (*Repot*). Hur filer namnges står i §1. Metoderna beskrivs för användaren i appens flik *Om verktyget*.
