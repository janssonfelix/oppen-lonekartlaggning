# Risk- och sårbarhetsanalys (dataskydd och informationssäkerhet) — Öppen lönekartläggning

**Bygge:** `2026.10.19` · **Artefakt-SHA-256:** `0872bd0fae90aae9176662aa71634a5573b8a0c1c0f5ed88507668281a9b8f5d` (se `dist/RELEASE.txt`).
**Granskningsdatum:** 2026-10-20.
**Granskningsmetod:** kodläsning påstående för påstående + statisk sökning i källkod och bygge +
körning av det byggda verktyget i jsdom och i Chromium (utan nätverk) med syntetiska testfiler.
Varje teknisk kontroll nedan är **verifierad mot koden och i webbläsaren**, inte antagen. Vad
verifieringen omfattar, och vad den inte prövar, står i §11.

`dataskydd.md` är den stående policyn; detta dokument är den kodverifierade riskanalysen.

---

## 0. Sammanfattande omdöme

**Verktyget är en lågrisk-komponent ur dataskyddssynpunkt.** All bearbetning sker
lokalt i HR-handläggarens webbläsare. Ingen data lämnar enheten, inget sparas
persistent, och indata minimeras till fem obligatoriska fält (plus valfri arbetsvärderingspoäng per befattning, valfri ansvarskod enligt AID och radens nummer i källfilen). Jämfört med molnbaserade verktyg
eller manuell Excel-hantering **minskar** verktyget snarare än ökar de tekniska
dataskyddsriskerna.

**Den största kvarvarande risken är inte teknisk utan organisatorisk:** så snart
användaren **exporterar** ett resultat (Excel/CSV/PDF/utskrift) lämnar uppgifterna
verktygets skyddade miljö. Hanteringen av dessa filer är arbetsgivarens ansvar.

Inga blockerande tekniska fynd. Restriskerna är **låga till medelhöga** och
hanteras med de organisatoriska åtgärderna i §8.

---

## 1. Behandlingens art, omfattning, ändamål och kontext (DPIA del 1)

| Fråga | Svar |
|---|---|
| **Ändamål** | Fullgöra arbetsgivarens lagstadgade skyldighet att kartlägga, analysera och åtgärda osakliga löneskillnader mellan kvinnor och män (diskrimineringslagens regler om lönekartläggning, lagrum.md) samt stödja EU 2023/970-relaterade moment. |
| **Art** | Statistisk analys av aggregerad och individuell lönedata i syfte att upptäcka könsrelaterade löneskillnader. Ingen profilering med rättsverkan för enskild; verktyget fattar inga beslut om enskilda. |
| **Omfattning** | En arbetsgivares anställda — typiskt tiotals till tusentals individer per fil. En körning per år. |
| **Kontext** | Körs lokalt på den personuppgiftsansvariges egen enhet. Ingen molntjänst, ingen extern part, ingen delning utanför enheten under själva bearbetningen. |

## 2. Personuppgifter som behandlas

Verktyget minimerar indata till **fem obligatoriska fält per anställd** plus en
**valfri arbetsvärderingspoäng** och en **valfri ansvarskod** (vitlista `ALLOWED_FIELDS`, verifierad i koden).
Poängen är en egenskap hos **befattningen** (arbetsvärderingens resultat), inte
hos individen, och tillför därmed ingen ny integritetsrisk:

| Fält | Roll | Integritetskänslighet |
|---|---|---|
| Månadslön | Subjekt för analysen | Hög (lön är integritetskänsligt) |
| Kön | Grunddimension (kvinna/man) | Diskrimineringsgrund — ingen särskild kategori av personuppgifter |
| Ålder | Kontrollvariabel | Medel |
| AID / yrkesgrupp | Gruppering | Låg–medel |
| BAS-intervall | Kravnivå-proxy | Låg |
| Poäng (valfri) | Arbetsvärderingens krav-poäng per befattning (krav-proxy för likvärdigt arbete) | Ingen — befattningsattribut, ej individbundet |
| Ansvarskod enligt AID (valfri) | Grupperas i tre ansvarsgrupper (ledningsansvar, särskilt uppdrag, inget); prövar ansvar som tänkbart sakligt skäl. Läses bara om minst 95 % av värdena är giltiga; kolumnen *Ansvar* (ofta kostnadsställe) läses aldrig | Låg–medel — chefsansvar kan i små grupper peka ut en person; samma k-regel som övriga grupper (§6.5) |
| Radnummer (`radnr`) | Radens nummer i källfilen; låter HR slå upp en person i *Personer att granska* och extremvärdesdetektorn (ADR-23) | Låg — ingen ny identifierare, men kopplar raden till källfilen |

AID-kod och yrkesetikett (`aid`, `yrkeLabel`) härleds ur yrkesfältet och är inga nya
uppgifter.

**Klassificering:** Detta är **ordinära personuppgifter**, inte särskild kategori
(dataskyddsförordningens särskilda kategorier är inte tillämpliga: underlaget innehåller inga sådana uppgifter, och inläsningen avvisar namn, personnummer och e-post). *Men* — lön är integritetskänsligt, och uppgifterna är
könsuppdelade och kan i **små grupper vara identifierande** (re-identifieringsrisk,
se §7.B1). Namn, personnummer och e-post samlas medvetet **inte** in och avvisas
aktivt vid uppladdning (se §6.4).

**Användarförfattad text:** HR kan skriva egna
bedömningar i verktyget — § 8-status + anteckning per granskningsområde och
redigerat struktur-narrativ. Texten lever endast i minnet,
saneras inte (det är användarens egna ord) och lämnar verktyget enbart via
användarinitierade utdata (Word-utkast, utskrift, konfigurationsfil — se §6.6/6.8).
Den är avsedd att vara **gruppnivå-bedömningar** och därmed inte personuppgifter;
om HR ändå skriver in uppgifter om enskilda blir innehållet personuppgifter och
omfattas av samma hanteringskrav som exportfilerna (§8, punkt 1). Verktygets
riktlinje i gränssnitt och körguide: *skriv på gruppnivå — inga namn eller
personnummer*.

## 3. Roller och laglig grund

- **Personuppgiftsansvarig:** arbetsgivaren (organisationen) som genomför
  lönekartläggningen.
- **Personuppgiftsbiträde:** *inget.* Eftersom all bearbetning sker lokalt på den
  ansvariges egen enhet och ingen data överförs till verktygets upphovsperson
  eller någon tredje part, sker ingen biträdesbehandling. Inget biträdesavtal
  (Art. 28) behövs för själva verktyget.
- **Laglig grund:** **rättslig förpliktelse** (art. 6.1 c med 6.3) — diskrimineringslagens regler om lönekartläggning och dokumentation (lagrum.md) ålägger
  arbetsgivaren att genomföra lönekartläggningen.
- **Tredjelandsöverföring:** ingen (ingen utgående trafik alls).

## 4. Dataflöde

```
Personalsystem ──(HR exporterar CSV/XLSX)──▶ HR:s enhet (disk)
                                              │
                                   (användaren väljer fil i verktyget)
                                              ▼
                            Webbläsarens minne (state.data) ── analys/render
                                              ▲
HR:s egna bedömningar ───(§ 8-anteckningar,──┘
(skrivs i verktyget)      struktur-narrativ)
                                              │
                         (användaren klickar "Exportera"/"Skriv ut"/"Spara konfiguration")
                                              ▼
                            Lokal nedladdning (Excel/CSV/Word/PDF/konfig-JSON) ── disk
```

Hela kedjan är **lokal**. Det finns inget steg där data lämnar enheten via nätverk.
Indatafilen läses, minimeras och hålls i JS-minne tills sidan stängs eller
användaren rensar; detsamma gäller HR:s egna bedömningstexter. Utdatasteget
producerar lokala filer på användarens initiativ (se §6.6/6.8 och riskregistret).

## 5. Avsett bruk vs. ej avsett bruk

**Avsett:** stöd för HR-specialisten att identifiera *kandidater* för bedömning
(verktyget dömer inte), beräkna kostnader, planera löneöversyn och producera
underlag till den Word-skrivna rapporten.

**Demoläge (dataskyddspositivt):** verktyget kan utforskas med **syntetisk
exempeldata** ("Prova med demodata") — utbildning och demonstration kräver alltså
ingen verklig lönedata alls. Demoläget märks med en tydlig banner och alla
exporter märks DEMODATA så att syntetisk data aldrig förväxlas med verklig analys.

**Ej avsett / utanför scope (hanteras separat av arbetsgivaren):** statlig
rapportering (direktivets lönerapportering), könsneutrala lönestrukturer (direktivets art. 4 och 6),
individuella lönebeslut, samt rörliga lönedelar och andra fält än de fem minimerade.
Lönen ska läsas in heltidsomräknad; omräkningen görs i lönesystemet, inte i verktyget.

---

## 6. Tekniska skyddsåtgärder (verifierade mot kod och i webbläsare)

### 6.1 Ingen utgående trafik — exfiltreringsskydd ✔
- **CSP (meta-tagg):** `default-src 'none'; script-src <per-script SHA-256-hashar>;
  style-src 'unsafe-inline'; style-src-elem <SHA-256-hashar>; style-src-attr 'none';
  img-src data: blob:; font-src data:;
  connect-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none';`
  → webbläsaren blockerar all utgående anslutning (`connect-src 'none'`) och
  formulärpostning (`form-action 'none'`). **`frame-ancestors 'none'` har ingen
  verkan här:** webbläsare ignorerar direktivet när CSP levereras via en meta-tagg
  (Chromium loggar det vid laddning). Skydd mot inbäddning i
  ram kräver ett HTTP-huvud, vilket en lokalt öppnad fil inte har. Risken är låg:
  filen öppnas från disk och publiceras inte på en webbplats som kan ramas in.
- **Navigering täcks inte av CSP.** Policyn stoppar anrop från skript, externa resurser
  och formulär, men ingen CSP i en meta-tagg hindrar att sidan navigerar till en annan
  adress (en länk, eller `location` satt av ett skript). Verktyget har inga länkar ut och
  ingen kod som navigerar (kodläsning), och injicerad kod kan inte köras (nästa
  punkt) — skyddet mot den vägen är alltså skriptspärren, inte `connect-src`.
- **Hash-baserad `script-src` (ADR-9):** `script-src` listar de
  exakta SHA-256-hasharna för de fem inlinade skripten (PapaParse, SheetJS, D3, JSZip och verktygets
  eget skript) i stället för `'unsafe-inline'`.
  Det innebär att webbläsaren avvisar **både** injicerade inline-`<script>` och
  injicerade inline event-handlers (`onclick=…`) — hela klassen "fientligt
  CSV-innehåll körs som kod" är därmed teknisk omöjlig, inte bara osanitärad bort.
  `tools/bundle.mjs` beräknar hasharna per bygge; appens egna knappar använder delegerade
  lyssnare (inga inline-handlers).
- **Stilar (ADR-30):** `<style>`-element kräver en känd kontrollsumma
  (`style-src-elem`) och stilattribut i markeringen är förbjudna (`style-src-attr 'none'`;
  verktyget har inga `style="…"` kvar, bara klasser, och uträknade mått sätts via CSSOM,
  som CSP:n inte rör). En injicerad `<style>` — den farligaste formen av CSS-injektion —
  och ett injicerat `style="…"` blockeras alltså; verifierat i Chromium, och
  webbläsarröktestet kräver noll CSP-överträdelser under hela körningen.
- **Tredjepartsbiblioteken** är låsta med kontrollsummor (`vendor/SHA256SUMS`, vaktas av
  `tests/sakerhet.test.js`), och CI-stegen är låsta på commit-SHA.
- **Statisk sökning:** **noll** verkliga `fetch`/`XMLHttpRequest`/`WebSocket`/
  `sendBeacon`/`Worker`/`importScripts` i app.js (de enda träffarna är förklarande
  dokumentationstext).
- **Inga externa resurser:** alla bibliotek (D3, XLSX, PapaParse, JSZip)
  buntas lokalt i HTML-filen — ingen CDN, inga externa URL:er. **Web Workers**
  blockeras också: CSP saknar `worker-src`, så `script-src` (bara de fem hasharna)
  gäller, och en worker från en `blob:`-URL avvisas (vaktas av webbläsarröktestet) — ett
  medvetet arkitekturbeslut (ADR-1).
- **Verifierat i webbläsare:** webbläsarröktestet (`tools/browser-smoke.mjs`) registrerar varje förfrågan från
  varje sida det öppnar — demodata och egna testfiler inlästa, alla flikar ritade, utskriften byggd och samtliga
  exporter körda — och kräver **noll** förfrågningar utanför den lokala filen och `data:`/`blob:`-adresser. Att
  kontrollen fångar trafik är prövat: en sida som navigerar till en http-adress registreras. Röktestet prövar
  också att en arbetstråd ur en `blob:`-adress och ett injicerat skript, en `onclick` och en `<img onerror>`
  stoppas av CSP:n.

- **D3 7.9.0 (ISC)** ritar diagrammen (ADR-39) och är ett av de inlinade skripten, med egen hash.
  Sökning i `vendor/d3.min.js`: inget `localStorage`, `sessionStorage`, `setItem`,
  `document.cookie`, `eval(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` eller `Worker`. Filen innehåller **ett
  `new Function(`** (d3-dsv, radtolkaren i `d3.csvParse` m.fl.) och **fyra `fetch(`** (d3-fetch: `d3.json`,
  `d3.csv`, `d3.text` …) samt ett `new Image` (`d3.image`). Inget av dem körs när biblioteket laddas, och
  verktygets kod anropar ingen av de funktionerna (diagramkärnan använder skalor, former och DOM-val). Skulle
  de anropas stoppas de av CSP:n: `new Function` av `script-src` utan `'unsafe-eval'` och `fetch` av
  `connect-src 'none'`. Webbläsarröktestet kräver noll CSP-överträdelser.
- **Diagramkärnans export (ADR-39):** PNG görs genom att den exporterade SVG:n läses som bild från en
  `data:`-adress och ritas på en canvas — inom `img-src data: blob:`, utan nätverk och utan ändring av CSP:n.
  SVG:n bär inga skript, händelseattribut, `id` eller yttre referenser (vaktas av test).

### 6.2 Ingen persistent lagring ✔ (med en notering)
- **Ingen kod skriver till lagringen.** Verktygets kod innehåller inga skrivningar, och
  de fyra biblioteksfilerna (D3, SheetJS, PapaParse, JSZip) innehåller inget anrop till `setItem` och ingen
  `document.cookie` (sökning i biblioteksfilerna). Det är det
  egentliga skyddet, och webbläsarröktestet kräver att localStorage, sessionStorage och cookies är tomma efter
  en full körning.
- **Storage-tripwire som reserv** (`installStorageTripwire`, den första koden i verktygets
  eget skript — den körs efter att de fyra biblioteken laddats): kastar när
  `Storage.prototype.setItem` anropas (localStorage och sessionStorage) eller
  `document.cookie` sätts. `removeItem`/`clear` spärras inte — de kan inte lagra något.
  **Spärren har inga undantag**, varken för nycklar eller för anropare. Den fångar också
  egenskapstilldelning (`localStorage.x = '…'`, `sessionStorage['x'] = '…'`): fönstrets två lagringsobjekt är
  utbytta mot ombud som kastar vid varje tilldelning och egenskapsdefinition, medan läsning, `removeItem` och
  `clear` går vidare. Cookie-spärren har inga undantag. Utanför spärren står IndexedDB och Cache API, som ingen
  kod använder (kodgranskning och CSP).
- **Verifierat i webbläsare:** skrivförsök med `setItem` till localStorage och
  sessionStorage samt till cookie kastar; efter demodata och alla flikar är
  localStorage, sessionStorage och cookies tomma.
- **IndexedDB / Cache Storage:** används inte av verktyget.
- **Webbläsarens autofyll-historik:** alla fält har `autocomplete="off"` — sidans fasta fält vid start, och
  varje fält som skapas medan användaren arbetar (anteckningarna i Regler & praxis, Löneöversyns riktade
  rader, Utforska) genom en observatör som sätter attributet på fält som läggs till i dokumentet
  (`stangAutofyll`, `01-html-och-tillganglighet.js`), så att organisationsnamn och anteckningar inte sparas i
  autofyll-historiken (som kan synkas till leverantörens moln). Vaktas av `tests/troskelbeslut.test.js`,
  som ritar alla flikar och kräver attributet på varje fält.
- **Notering (utanför verktygets kontroll):** operativsystemets minnesväxling
  (swap) eller webbläsarens egen sidcache kan teoretiskt skriva minnessidor till
  disk. Mitigeras organisatoriskt (betrodd enhet; stäng fliken efter användning).

### 6.3 Inaktivitets- och rensningsskydd ✔
- "Rensa all data"-knapp (med bekräftelsefråga) tömmer `state`, släpper Utforskas
  egna referenser till raderna och river ned renderade tabeller och diagram (diagrammen, som ritas av
  diagramkärnan, ADR-39, rensas genom ritarens register `_rfRensaAlla` —
  figuren på behållaren, lyssnare och verktygstipsets text — oavsett id och också när behållaren lämnat dokumentet), extremvärdesdetektorns tabell, utskriftsrapporten och panelen
  Personer att granska omedelbart.
- Inaktivitetstimern rensar sessionen automatiskt efter 90 minuter (standard;
  30, 60, 120 minuter eller av under *Vad lagras?*), via **samma** rensningsväg
  (`_rensaAllData`) men utan bekräftelsefråga. Varning och möjlighet att förlänga visas en
  minut innan. Organisationspaketet kan låsa tiden (5–120 minuter; läget av kan inte låsas,
  ADR-47): rullistan står då på värdet och `setInactivityTimeout()` tar inte emot något annat;
  *Rensa all data* häver låsningen tillsammans med paketet.
- **Vaktas av en invariant** (`tests/smoke-vyer.test.js`): alla flikar, extremvärdesdetektorn
  och utskriftsrapporten ritas med löner i ett unikt intervall (inklusive ett
  extremvärde), rensningen körs, och testet kräver att inget lönevärde finns kvar
  någonstans i dokumentet (även dolda flikar och attribut) — för både knappen och den
  automatiska rensningen. Verifierat även i webbläsare med alla flikar och
  utskriften: 0 lönevärden kvar för båda vägarna; ny inläsning ritar upp allt igen.
- Vid fliksstängning försvinner allt minne (ingen persistens).

### 6.4 Uppgiftsminimering & avvisning av känsliga fält ✔
- **Fältvitlista** (`ALLOWED_FIELDS`): endast BAS, AID/yrke, lön, ålder, kön,
  samt valfri arbetsvärderingspoäng (befattningsattribut) och valfri ansvarskod enligt AID
  (ADR-33) läses in. Kolumnen *Ansvar* (ofta kostnadsställe) läses inte in (se §2 i
  teknisk-plan.md).
  **Under inläsningen ligger hela filen i minnet** — som byte, som avkodad text och (för
  CSV) uppdelad i rader; Excel-filer som ett helt blad. Fälten plockas ut rad för rad, och
  filens övriga innehåll släpps när inläsningen är klar. (Gränsen på högst 50 råa
  rader i minnet gäller de tolkade radobjekten, inte filens text.)
  Övriga kolumner i filen ignoreras. Därtill sparas radens nummer i källfilen
  (`radnr`), som hålls som en `Symbol` på råraden och därför varken syns för
  PII-detektorn eller läses som kolumn (ADR-23). Verifierat: fälten i
  minnet är exakt `aid, alder, ansvarsgrupp, ansvarskoder, bas, kon, lon, poang, radnr, yrke,
  yrkeLabel` (`ansvarskoder` och `ansvarsgrupp` är tomma när kolumnen saknas).
- **Alla BAS-intervall ingår (ADR-21, upphävd 2026-10):** även chefsnivåerna K och uppåt läses in
  och analyseras. Små intervall skyddas som alla andra grupper av minsta gruppstorlek vid export.
- **PII-detektor** (`detectSensitiveColumns`): känner igen och **avvisar**
  strukturfiler (den enda filen med en rad per person) vars kolumner innehåller
  personnummer-, e-post- eller namnmönster, i både CSV- och Excel-vägen. Kontrollen
  ser på kolumnrubrikerna och på värdena i filens **50 första rader**: en kolumn avvisas
  på minst tre värden i personnummer- eller e-postformat eller minst fem som ser ut som
  för- och efternamn. Identifierande värden som först förekommer längre ned upptäcks inte
  av värdekontrollen — men kolumnen läses då ändå inte in, eftersom bara vitlistade
  kolumner läses. Rubrikkontrollen normaliserar rubriken (gemener, å/ä/ö → a/a/o), så
  *Förnamn*, *Fornamn*, *Namn*, *Efternamn*, *Personnummer*, *PNR* och *E-post* känns igen
  (rubrikprov i `tests/parsing.test.js`, filprov i `tests/smoke-ansvar.test.js`).
  Verifierat i webbläsare: en fil med kolumnen Personnummer avvisades och inga
  rader lästes in. **Filerna med lönepolitiskt ställningstagande och
  jämförelsestatistik kontrolleras inte av detektorn**; från dem läses bara
  vitlistade aggregatkolumner (BAS, AID, percentiler, median, antal, andel
  kvinnor) in, och övriga kolumner lämnas. BAS- och AID-värdena saneras på samma sätt som
  lönefilens (tecknen `< > " ' &` tas bort, `_stripHtmlMeta`), och talen läses som tal.
  Det finns **ingen inbyggd referens** (ADR-28); ställningstagandet och statistiken läses
  in som egna filer eller ur ett **organisationspaket** (JSON). Paketet valideras mot en
  vitlista (organisation, utgivare, datum, benämningar, PO-påslag, period, minsta
  gruppstorlek, de tre låsningarna i ADR-47 och aggregatrader), tar bort tecknen `< > " ' &`
  ur textfälten och kortar dem till 200 tecken, avvisar filer över 5 MB och avvisar hela
  paketet om ett textfält liknar personnummer eller e-post. Ett ogiltigt värde i en låsning
  utelämnas med en varning (`_lasningar` i `src/lib/organisationspaket.js`). Referensens och statistikens
  namn och källa följer med i exporterna. Paketet lagras aldrig i verktyget, och demoläget har
  en påhittad referens.
- **Yrkesfält saneras** (`_cleanYrkeField`): trunkeras och maskerar namn-mönster
  (t.ex. "Förnamn Efternamn" → `***`; verifierat: "101 Anna Andersson" lästes in
  som "101 ***"); tecknen `< > " ' &` tas bort. `_normalizeBas` tar bort samma tecken ur BAS-värdet.
- **Utdatakodning:** `esc()` escapear `& < > " '` och är därmed säker även i attributkontext
  (regressionstester i `tests/parsing.test.js`).

### 6.5 k-anonymitet ✔
- **Regeln gäller det som lämnar verktyget (ADR-51, 2026-10-29).** På skärmen visas alla grupper (`kTroskel()` är 1 i
  skärmläget); allt som lämnar verktyget ritas och räknas i exportläget (`medExportLage` i `23-exportgrind.js`), där
  `kTroskel()` är den inställda tröskeln `kInstalld()`. De två funktioner all export av tabeller och diagram går genom
  går själva in i exportläget, och Dokumentera & exportera ritas alltid i det. Där det i punkterna nedan står att
  ett mått visas, redovisas eller ritas bara när en grupp eller ett kön når tröskeln gäller det exportläget; på
  skärmen visas måttet. Efter en export ritas bara det tillbaka som exporten ritade i exportläget (`_ritaOmEfterExport`),
  och Lika arbetes minne har ett rum per tröskel, så att ett lägesbyte inte räknar om något. Knappen *Som export*
  (`sattForhandsvisning`) sätter skärmen i exportläget tills den stängs av: en export medan den är på lämnar läget
  som det är, och ett lägesbyte medan en export pågår avvisas (`tests/forhandsvisning.test.js`).
- Standardvärdet är 10 (`K_STANDARD`); användaren kan ändra det (ADR-38). Vid 10 redovisas i det som
  lämnar verktyget inga gruppvärden när en grupp har färre än 10 personer. Gruppen utelämnas och namnges i en not vid tabellen.
  Är bara könsuppdelningen för liten (gruppen som helhet n ≥ 10) visas gruppens
  samlade median utan könsjämförelse.
- **Könsuppdelade mått kräver tröskeln för varje kön** (`_konFarRedovisas` i
  `06-k-anonymitet-och-dataminimering.js`): ett köns median
  eller percentil, ett lönegap och en kostnad som räknats ur ett gap redovisas bara när både
  kvinnor och män är minst så många som tröskeln — per grupp och för hela organisationen
  (nyckeltalet på Översikt, Word-utkastet, PDF-rapporten, Struktur, EU-lönerapporten,
  A/B-jämförelsen, Löneöversyns råa gap). Kvartilfördelningen visar då antal per kvartil men
  inte könsfördelningen. Huvudregressionen i Lika arbete har kvar sitt fasta golv (5 per
  kön, se nedan): dess justerade gap med konfidensintervall visas från det golvet. Det råa
  mediangapet, kronexemplet i regressionskortet (som utgår från männens medianlön) och
  regressionens ojusterade steg ("Endast kön") med den förklarade andelen
  och förklaringsbudgeten följer tröskeln för varje kön (`_regStegForRedovisning`): i
  regressionskortet, Word-utkastet och PDF-rapporten (i de urval som har avsnittet om det justerade lönegapet:
  hela dokumentationen och facklig dialog) står då en mening i stället, och de kvarvarande staplarnas bredd räknas
  bara mot de steg som visas. Blinder-Oaxaca-uppdelningen körs först när varje kön når
  `statGolv()` (max av tröskeln och 10) och visas därför aldrig med ett kön under tröskeln.
- **Ålder & karriär följer regeln:** ojusterat och åldersjusterat lönegap
  visas bara när båda könen i urvalet (alla BAS eller ett valt BAS) når tröskeln; lutningen per
  kön, trendlinjen med konfidensband och lådan i låddiagrammet visas bara för ett kön som når
  den. Samma regel gäller kvantilpunkterna (lönefördelningen som tjugo prickar per grupp, också i Utforska):
  de ritas bara för en grupp och ett kön som når tröskeln, och en prick står aldrig för färre än två
  personer (antalet prickar är högst halva gruppen); diagramdatan är kvantilerna, aldrig enskilda löner. En not under diagrammet säger vad som utelämnats, och bilder och diagramdata bär det som
  ritats. I spridningsdiagrammen en persons punkt ritas och exporteras bara när personens grupp (yrke inom BAS) och personens kön i gruppen når tröskeln; en not under diagrammet säger hur många personer som inte visas.
  Demografidelens mått är inte könsuppdelade lönemått: åldersfördelning per kön, och trend och
  lönespridning för hela urvalet. Spridningen kräver tröskeln i varje åldersfönster; trendlinjen
  och lutningen för hela urvalet (alla BAS eller det valda) ritas bara när urvalet når tröskeln
  — annars utelämnas de, nyckeltalet visar ett streck och noten under diagrammet säger det
  (beslut av produktägaren 2026-10-16). Livscykelanalysen har sitt eget golv
  (`statGolv()`).
- Skyddet vaktas av två invarianter. `tests/kanonymitet.test.js` ritar samtliga flikar i exportläget vid
  10 mot ett dataset där varje liten grupps mått är ett unikt sentinelvärde, och kräver att
  inget av dem syns. `tests/ktroskel.test.js`, `tests/ktroskel-hojning.test.js` och `tests/ktroskel-invarianter.test.js`
  prövar flikarna vid 10, 25 och 5 med grupper om 20 och 6 personer, och vid **10 och 25** både flikarna och utdata mot ett underlag där en grupp
  över tröskeln har 1–3 män med en egen lön, ett BAS har två av varje kön, en person är ensam
  i sitt yrke och varje yrke har en rad i jämförelsestatistiken: Översiktens delar, Word-utkastet,
  utskriften i sina tre urval (hela dokumentationen, ledningsbrief, facklig dialog), rapportunderlagets block, Excelfilerna
  (alla flikar, protokollet, EU-lönerapporten, handlingsplanen, jämförelseexporten, Löneöversyn,
  Löneöversikten, prioriteringslistan och ZIP-filens Excelfil), Att göra-listans CSV,
  varje tabell med CSV-knapp, diagramdata för varje ritat diagram utom dem med en punkt per
  person, gruppdossiern och Att göra-punkterna. (PDF-rapporten ritas ur samma rapportmodell som Word-utkastet.) **Inte prövat av invarianten:**
  fliken Likvärdigt arbete och dess export, Utforska på skärmen, Personer att granska och
  extremvärdeslistan (undantagen nedan), diagrambilder (innehållet i en bild går inte att läsa
  i testet) och Ålder & karriär med ett enskilt BAS valt. Vid 5 prövas
  flikarna, inte exporterna. Utanför invarianten har `tests/ktroskel-regression.test.js` egna tester för
  regressionens ojusterade steg (60 kvinnor och 7 män: kortet, utskriftens
  tre urval, Word-utkastet, rapportunderlaget, Excelfilerna och invariantens övriga utdatavägar),
  för Ålder & karriär (3 män i hela urvalet, och ett valt BAS med en man), för Löneöversyns
  scenariojämförelse och för noten vid egna riktade rader.
- **Värdet kan ändras av användaren (ADR-38).** Fältet *Minsta gruppstorlek för redovisning* under
  **Inställningar** i sidhuvudet (värdet i flikarnas översta rad är en länk dit) tar heltal från 2 (högst 1 000); standardvärdet är 10 och inget lagras mellan sessioner.
  Ett högre värde skärper skyddet. Ett lägre värde gör att mindre grupper redovisas, och då gäller
  tre åtgärder: (1) sänkningen måste bekräftas, också när värdet kommer ur en konfigurationsfil eller
  ett organisationspaket; (2) en varning som inte går att stänga visas överst på alla flikar (i
  utskrift står i stället en mening under rapportens rubrik); (3) värdet anges i metodbilagan
  (som följer med varje Excelfil, Word-utkastet och PDF-rapporten), i exporterad diagramdata och i
  tabell-CSV, och under 10 står meningen "Tröskeln är sänkt från standardvärdet 10." dessutom på det som
  kan spridas för sig: diagrambilder, tabeller i urklipp, Word-utkastets sidfot, PDF-rapportens rubrik och den utskrivna handlingsplanen, rapportunderlagets block och den kopierade gruppdossiern. Konfigurationsfilen och organisationspaketet bär värdet som
  ett fält, inte meningen. Skattningarna regression per BAS, Blinder-Oaxaca, bootstrap-KI,
  livscykelmodellen, extremvärdesdetektorn, justerat gap inom yrke och Personer att granska läser
  `statGolv()` = `max(kTroskel(), 10)` och följer inte tröskeln nedåt; verktyget har också andra, fasta
  golv (ADR-38; de står kvar enligt produktägarens beslut), så detta betyder inte att alla golv är minst 10. En konfigurationsfil eller ett organisationspaket utan fältet ändrar inte gällande värde. En organisation kan sätta sin egen standard i
  organisationspaketet.
- **Medvetet undantag:** likvärdighetsanalysen tillämpar inte k-anon på
  yrkesgruppsnivå (juridiskt nödvändigt för att kunna identifiera kandidatpar;
  aggregerat per yrkesgrupp — uttryckligt designbeslut). Resultaten ska hanteras
  konfidentiellt (se §8). **Var paren hamnar (kodläsning):**
  - *Med tröskelkontroll* (par med en grupp under tröskeln utelämnas, antalet anges):
    rapportunderlaget, Word-utkastet och PDF-rapporten.
  - *Utan tröskelkontroll, enligt beslutet:* fliken Likvärdigt arbete med diagrammet över kandidatparen och
    flikens egen export (Excel och CSV) — antal, andel kvinnor, medianlön och skillnad
    för båda grupperna.
  - *Med tröskelkontroll enligt beslutet:* protokollet för gemensam
    lönebedömning (bladet för likvärdigt arbete och försättsbladets antal), Att göra och
    dess CSV, handlingsplanens förifyllda rader (skärm, Excel och utskrift), gruppdossiern
    med textkopia, löneöversynens förslag (förslag, mål-läge, känslighetskurva och Excel;
    meningen står vid förslagen), strukturtexten samt robusthetspanelen i Dokumentera &
    exportera (yrkesetikett och antal körningar paret träffas i, inget lönemått) — par med en
    grupp under tröskeln utelämnas och antalet anges. Robusthetspanelen vaktas av
    `tests/ktroskel-invarianter.test.js` (invarianten och parfixturen) och `tests/smoke-docx.test.js`.
- **Medvetet undantag 2 — Utforska (ADR-14):** fliken visar alla grupper på skärmen, som
  de andra flikarna (ADR-51). Skyddet ligger på exporten: tabellens CSV/urklipp och diagrammets
  export utelämnar små grupper, och lönemått för ett kön under 10, **om inte användaren aktivt
  kryssar i** att ta med dem — rutan är undantaget, och med den ikryssad lämnar små grupper
  verktyget. Utan ikryssad ruta går en liten cell inte att skilja från en tom
  eller dold, och rader/kolumner som bara har små celler utelämnas helt (etiketten
  röjer annars att gruppen finns). **Antal** (n, även per kön) följer alltid med.
  Differensskydd (att räkna fram en liten grupp ur två urval) byggs inte — beslut
  dokumenterat i ADR-14. Organisationspaketet kan stänga av möjligheten (ADR-47): rutan är
  då dold och avkryssad, och exporten utelämnar alltid små grupper (`explorerSmaIExport()`).
  Vaktas av exporttester i `tests/kanonymitet.test.js` (hela små grupper, kön under 10 i en
  större grupp, gruppvillkor, två dimensioner, rutan låst av paketet).

- **Kvartilfördelningen (EU-måtten)** redovisar bara gränserna mellan
  kvartilerna — mittpunkten mellan den lägre kvartilens högsta och den högre kvartilens
  lägsta lön — aldrig kvartilernas yttre löner, som för Q1 och Q4 är organisationens
  lägsta och högsta enskilda lön. Gäller fliken Struktur och EU-lönerapporten; vaktas av
  enhetstest och röktest.
- **Medvetet undantag 3 — Personer att granska (ADR-23):** panelen i Lika arbete visar enskilda personer (kön, ålder, AID, BAS,
  lön, förväntad lön och filens radnummer) som ligger minst en vald procentsats under
  kollegor i samma AID och BAS. Som i Utforska har den som använder verktyget redan
  rådatan, men här finns **inget exportval**: listan har inga exportverktyg, ingår inte
  i någon export eller i rapportunderlaget och döljs vid utskrift. Panelens diagram är märkt
  utan export (`markeraUtanExport`, skälet `individer` i `11-diagramexport.js`), så varken
  exportmenyn, ZIP-filen, rapportunderlaget eller utskriften tar med det. DOM-invarianten
  undantar panelen; ett eget test kräver att en flaggad persons lön inte finns i
  rapportunderlag eller Word-utkast (och därmed inte i PDF-rapporten, som ritas ur samma modell). Verifierat i webbläsare:
  en flaggad persons unika lön fanns inte i någon av Excel-exporterna (alla
  flikar, gemensam lönebedömning, handlingsplan, EU-rapport, likvärdighet), Word-utkastet, zip-filen,
  konfigurationsfilen, utskriften eller rapportunderlagets urklipp, och panelen döljs
  vid utskrift. Radnumret (`radnr`) är ingen ny identifierare men kopplar raden till
  källfilen. **Extremvärdeslistan** på Översikt (*Underlagets kvalitet*) visar på samma sätt enskilda löner
  med radnummer: den har inga exportverktyg, ingår inte i någon export eller bilaga och döljs vid utskrift
  av fliken (webbläsarröktestet kräver det).

- **Lönepolitik:** i exportläget har fliken en mellannivå — för en yrkesgrupp med minst 5 men färre än
  tröskeln anges bara antal, under 5 maskeras gruppen helt och namnges i en not; lönemått och
  läget per kön kräver tröskeln. Bladet *Lönepolitik* i Excelfilen med alla flikar (och i ZIP-filens
  Excelfil) följer samma trappa och samma regel per kön; vid tröskeln 5 eller lägre finns ingen
  mellannivå. Vaktas av `tests/ktroskel-kon.test.js` (bladet) och `tests/ktroskel-invarianter.test.js`.
- **Struktur per BAS och Prioritering:** *Struktur per BAS* i Word-utkastet och PDF-rapporten utelämnar
  BAS under tröskeln och namnger dem i en not; Prioritering visar könsgapet i en grupp
  bara när båda könen når tröskeln, och prioritetsindexet räknas då utan könsdel så att
  poängen inte röjer det dolda gapet. Prioriteringens förslag om lägsta
  lönekvintilen kräver tröskeln för båda könen. Vaktas av `tests/ktroskel-utdata.test.js`, som läser
  flikarna, Word-utkastet och utskriften.
- **Lönegap per BAS, hela organisationen och Löneöversyn:** *Struktur per BAS* visar gapet bara när
  båda könen når tröskeln, annars ett streck och en not; könsuppdelade mått för hela
  organisationen följer samma regel; Löneöversyn maskerar kostnaden där medianerna maskeras,
  jämför bara mot mäns median när männen når tröskeln, ger en grupp egen rad på individnivån
  först när tröskeln i antal berörs, och tar bort förslag ur kandidatpar som inte längre når
  en höjd tröskel. Vaktas av `tests/ktroskel-invarianter.test.js` och `tests/ktroskel-regression.test.js` (egna tester och invarianten ovan).
- **Fasta golv (ADR-38; står kvar enligt produktägarens beslut):**
  huvudregressionen i Lika arbete körs när underlaget har 5 kvinnor och 5 män, ett av
  Prioriteringens förslag skriver ut skillnaden i medelålder mellan könen vid 3 av varje kön
  (en ålder, inget lönemått), och Löneöversiktens yrkesrader visas från 5 personer.
- **Egna riktade rader i Löneöversyn — tillåtna enligt produktägarens beslut:** en
  riktad rad som användaren själv lägger till för en grupp under tröskeln visar sitt belopp på
  raden, och beloppet ingår i summorna på skärmen och i Löneöversyns Excel-export (*Använt*,
  *Riktat* och, när gruppen är kvinnodominerad, *Varav till kvinnodominerade grupper*). För en
  grupp med en enda person och ett påslag i procent är beloppet personens lön gånger
  procentsatsen. Det är användarens egen inmatning i en egen simulering och filtreras inte;
  under raden står en not om att gruppen är under tröskeln och att beloppet bygger på enskildas
  löner. Kostnaden per grupp under tröskeln maskeras i exportens blad *Fördelning* (på skärmen visas
  den). Risken bärs av användaren, som redan har underlaget; filen ska hanteras som
  personuppgifter (§8).
- **Löneöversyns scenariojämförelse (A/B)** prövar rågapet mot den tröskel som gäller när
  jämförelsen visas (scenariot bär antalet kvinnor och män): ett scenario sparat vid en lägre
  tröskel visar ett streck och en not när tröskeln har höjts.
- **Lönerevisionssimulatorn är borttagen (ADR-50, 2026-10-29):** det den kunde gör en riktad rad i
  Löneöversyn (kön, lönegräns, höj till), som följer regeln för egna rader ovan: en rad som berör
  färre personer än tröskeln visar beloppet med noten om enskildas löner. Lönegapet före och efter
  (organisationens råa gap) kräver tröskeln för varje kön. Vaktas av `tests/ktroskel-kon.test.js` (C3)
  och `tests/smoke-docx.test.js`.
- **Bilder med en punkt per person följer med (beslut av produktägaren 2026-10-16, ADR-48):** ZIP-exporten
  och utskriftens mall *Komplett rapport* bär bilder av Ålder & karriärs diagram med en punkt per person
  (§6.6); Ålder & karriär visar punkterna på skärmen. Bilderna bär inga namn eller identifierare, och filerna
  hanteras som personuppgifter (§8, punkt 1). Innehållet i en bild går inte att läsa i testet, så bilderna
  prövas inte av invarianten.
- **Löneöversyns tröskelmål följer tröskeln (beslut av produktägaren 2026-10-16, ADR-38 R5):** lyftet i
  procent till kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när varje kön i
  urvalet når tröskeln; annars ett streck med meningen om utelämnat könsuppdelat mått. Vaktas av
  `tests/troskelbeslut.test.js`.
- **Riktade rader ur en konfigurationsfil (beslut av produktägaren 2026-10-16):** filen bär på varje riktad
  rad uppgiften om raden föreslogs av verktyget ur kandidatpar i likvärdigt arbete (`kalla`), så att en inläst rad behandlas som
  den rad den var: förslag prövas mot gällande tröskel vid inläsningen och rensas när tröskeln höjs, egna
  rader står kvar med noten om att gruppen är under tröskeln. Vaktas av `tests/troskelbeslut.test.js`.
- **Varningen "underlaget är litet" i Prioriteringens motiveringsförslag** går vid färre än tröskeln av
  något kön (tidigare ett fast 5) och nämner tröskeln (beslut av produktägaren 2026-10-16).
- **Processöversiktens steg 4** blir inte klart när alla kandidatpar har en grupp under tröskeln: steget
  säger att inget finns att hantera i Att göra, hur många par som bara redovisas i fliken Likvärdigt arbete,
  och leder dit (beslut av produktägaren 2026-10-16, ADR-29).

- **Aggregerade analyser i Lika arbete (ADR-22, ADR-24, ADR-25):** *Var uppstår löneskillnaden?*
  namnger en grupp bara när varje kön i gruppen och dess BAS når tröskeln. Dolda grupper redovisas
  bara med antal, och topplistan kortas tills summan av |belopp| för de andra poster som inte visas
  är minst hälften av varje dold posts belopp, så att en dold grupps bidrag inte kan räknas fram ur
  summorna; går det inte redovisas inga delar, bara hela skillnaden. Kortet och rapportunderlaget
  visar samma poster. Stabilitetsmärkningen av flaggor bygger bara på grupper där båda könen når
  tröskeln, och *Lägre krav, högre lön* tar i rapportunderlaget bara med par där båda grupperna når
  den. Analyserna har inga egna fält och inga egna exportvägar.

- **Ansvarsgrupper (ansvarskod enligt AID, ADR-33):** underraderna per
  ansvarsgrupp i Lika arbete följer samma k-regel som yrkesraden — under k visas inga
  lönemått, ett kön under k ger samlad median. Gruppdossiern visar bara antal per
  ansvarsgrupp och kön, aldrig lön. Sektorsöversiktens andel med ledningsansvar visas
  bara för kön med minst k personer. Vaktas av `tests/kanonymitet.test.js`.

### 6.6 Lokala exporter & utskrift ✔
- Excel/CSV/JSON-export via `Blob` + `<a download>` — lokal nedladdning, ingen
  uppladdning. PDF-rapporten skrivs ut ur sidan själv (`window.print()` på en dold utskriftsyta, `#print-report`,
  som töms av *Rensa all data*); handlingsplanens mall och checklistan skrivs ut via lokalt
  `window.open`/`document.write` (about:blank, inga skript, inga nätverksanrop).
- **De fyra samlade exporterna har var sin uppgift:** Word-utkastet är rapporten, Excel-filen
  underlaget, PDF-rapporten en låst kopia av Word-utkastet (ritad ur samma rapportmodell, så att de två inte kan
  säga olika saker) och ZIP-filen allt — Word-utkastet, Excel-filen och bilder av diagrammen. Vid varje knapp
  står ett **förhandsbesked** om vad filen innehåller och vad den utelämnar (till exempel grupper under tröskeln).
- **Exportgrinden:** ingen export läser en tabell eller ett diagram ur en flik som är ritad
  med en äldre tröskel. När tröskeln ändras ritas bara den flik som syns om; övriga töms och ritas på nytt när de
  öppnas eller när en export behöver dem.
- **Word-utkastet**: redigerbar `.docx` (Office Open XML, packad med JSZip och
  nedladdad som lokal `Blob`; ADR-37) — innehåller verktygets fynd **och användarens
  § 8-bedömningar**, och rapportmodellens diagram över grupper som bilder (`RM_DIAGRAM`, nedan). Filens metadata anger titel och "Öppen lönekartläggning" som
  skapare, inga namn. Demodata märks DEMODATA i både innehåll och filnamn.
- **Demomärkning av övriga exporter:** Excel-exporterna får en DEMODATA-rad i
  metodbladet; diagrambilder, diagramdata och tabellernas CSV får prefixet `DEMO_`
  i filnamnet.
- **Exportmeny på alla diagram**: PNG/SVG (bild) och diagramdata (CSV/urklipp) — utom i två behållare
  som är märkta utan export, med ett uppräknat skäl i `EXPORT_SKAL` (`11-diagramexport.js`): Personer att
  granskas diagram (ADR-23) och Översiktens kopior av Strukturs diagram (som exporteras från sin egen flik).
  Ingen exportväg — meny, bild, diagramdata, ZIP, rapportunderlag, utskrift — tar med ett märkt diagram.
  För diagram med en punkt per person — spridningsdiagrammen lön mot ålder i Ålder & karriär, märkta
  `individer` i figuren — är diagramdatan **en rad per person** (lön, kön, ålder eller grupp; inga namn
  eller identifierare), och filen säger det på rad 2: "Filen innehåller en rad per person (lön, kön, ålder
  eller grupp; inga namn eller identifierare) och ska hanteras som personuppgifter." (beslut av
  produktägaren 2026-10-16). Utforskas lådor (individpunkter, punktsvärm, regnmoln) exporteras som
  statistik per grupp, aldrig som individer. Sådana filer ska hanteras som personuppgifter (§8, punkt 1).
- **Rapportunderlag via urklipp (ADR-20):** aggregerade faktastycken, tabeller och diagram kopieras
  för att klistras in i organisationens egen rapportmall. Blocken följer samma k-regel som Lika
  arbete, och kandidatpar med en grupp under tröskeln redovisas inte. *Kopiera alla avsnitt*
  kopierar samma k-skyddade block som de enskilda kopieringsknapparna. Det som kopieras
  ligger i operativsystemets urklipp, och urklippet kan synkas utanför datorn av operativsystemet
  eller av en urklippshanterare (Windows molnurklipp, Apples universella urklipp); organisationen
  bör stänga av sådan synkning på de datorer som används (§8, punkt 7).
- **Formelskydd (ADR-15)**: i CSV-filer och urklipp får textceller som börjar med
  `=`, `+`, `-` eller `@` ett inledande `'`, så att en fientligt utformad lönefil
  inte kan få Excel att köra en formel. Tal lämnas orörda; `.xlsx`-exporten skriver
  text som textceller och berörs inte.
- **Export-känslighetsnotis**: vid filsparande visas en påminnelse om
  förvaringsdisciplin (behörighetsstyrd disk, ej okrypterad e-post). Notisen säger att filen innehåller
  lönedata och ska hanteras som personuppgifter; den lovar inte att filen bara innehåller aggregat.
- **Exporter som hör till ett undantag säger det:** likvärdighetsexportens
  CSV och metodblad, diagramdata från fliken Likvärdigt arbete, och Utforskas tabell-CSV,
  urklipp och diagramdata när rutan för små grupper är ikryssad, bär tillägget "Den här filen
  kan även innehålla grupper under tröskeln (undantag: …)". Diagramdata från diagram med en
  punkt per person bär raden om minsta gruppstorlek och raden om att filen innehåller en rad per
  person (ovan).
- **Bilder med enskilda personers löner i sammansatta utdata:** **ZIP-exporten** innehåller bilder av alla
  ritade diagram från alla flikar, däribland spridningsdiagrammen lön mot ålder (en punkt per anställd), de små
  multiplarna per BAS-intervall och låddiagrammet per kön (lådan ritas bara för ett kön som når tröskeln, §6.5).
  ZIP-filen är alltså inte enbart aggregat. Spridningsdiagrammens bilder innehåller inga punkter
  för personer i grupper under tröskeln (eller vars kön är under tröskeln i gruppen); låddiagrammets avvikare är
  kvar som enskilda löner utan yrke. **Word-utkastet och rapportens avsnitt innehåller inga diagram med en punkt
  per person**: båda ritas ur rapportmodellen, vars diagram (`RM_DIAGRAM`) alla visar grupper — kvoten
  per BAS-intervall, könsfördelning, lönekvartiler, oförklarat gap per BAS, kandidatparen, trattdiagrammet över
  yrkesgrupper, lönegapet per åldersgrupp och fördelningen i lönespannet per kön. **Utskriftens mall *Komplett
  rapport*** (hela dokumentationen) lägger till bilagor med flikarnas tabeller och bilder av Ålder & karriärs
  spridningsdiagram, låddiagram och täthetsdiagram; de kortare urvalen (ledningsbrief, facklig dialog) gör det
  inte. **Beslut av produktägaren 2026-10-16 (ADR-48):** bilderna följer med i ZIP-exporten och i Komplett
  rapport. De bär inga namn eller identifierare, punkterna följer tröskeln som ovan, och filerna hanteras som
  personuppgifter (§8, punkt 1).
- **Vyerna per BAS-intervall, trattdiagrammet och fördelningarna per kön** följer tröskeln för varje kön: översikten per BAS-intervall (skärm, Word,
  PDF) har bara rader där båda könen når den; trattdiagrammet har bara yrkesgrupper där båda könen når den;
  lådorna över lönespridning per BAS-intervall och kön ritas bara för ett kön som når den, och utan enskilda
  avvikare (`avvikare: false`); lönegapet per åldersgrupp och fördelningen i spannets tredjedelar redovisas bara
  när båda könen når den. Testerna i `tests/diagramvyer*.test.js` prövar det för var och en, med ett kön eller en
  grupp under tröskeln som inte får finnas i figuren. Dessa vyer ingår i den allmänna invarianten på samma sätt
  som övriga flikar (de ritas när fliken ritas). Beräkningarna bakom översikten och trattdiagrammet hålls i
  minnet per underlag och tröskel (`_laMinne`) och släpps av *Rensa all data* och när statistiken
  ogiltigförklaras — ett test kräver det.

### 6.7 Bundle-integritet ✔
- Reproducerbart bygge; SHA-256 i `RELEASE.txt`. Byggskydd avbryter vid mojibake
  och kör `node --check`. Verifiera SHA före driftsättning.

### 6.8 Konfigurationsfilen ("Spara/Läs in konfiguration") — innehåll
Konfig-JSON:en (**version 2**) innehåller: inställningar
(trösklar, vikter, kostnadsinställningar, bristyrken,
löneöversynens inställningar, där en riktad rad bär uppgiften om den föreslogs ur kandidatpar i likvärdigt arbete) samt **HR:s manuella arbete**: § 8-bedömningarna (status + anteckning per granskningsområde),
avbockningarna i Att göra (punkternas id, som innehåller AID-kod och BAS),
organisationsnamnet och ett redigerat struktur-narrativ. `state.data` (individrader) ingår **aldrig** — verifierat mot
`buildConfigSnapshot()` i koden (ingen `state.data`-referens). Organisationens namn och jämförelsestatistikens namn (användarens
egna namn; text som liknar personnummer eller e-post avvisas) ingår. Organisationstypen (kommun,
region eller båda) ingår som inställning. Ansvarskoderna och
ansvarskolumnens namn ingår inte heller (vaktas av röktest), och inte heller lönedata eller
anteckningar per år (se §2 i teknisk-plan.md). Organisationspaketet ingår inte; filen noterar
bara paketets organisation och datum, och paketets låsningar (ADR-47) ingår inte heller — en
konfigurationsfil kan varken sätta eller häva en låsning. BAS-ordningen är fast och ingår inte i filen (se §5 i
teknisk-plan.md). Filen kan alltså innehålla
inställningar och **användarförfattad text** och ska
hanteras med samma disciplin som övriga exportfiler (§8, punkt 1);
anteckningsfältens placeholder påminner om att skriva på gruppnivå utan namn/
personnummer. Import är transaktionell (tvåfas-validering) och läser bara **version 2**
— en korrupt fil eller en fil av annan version lämnar verktygets tillstånd orört (kastar
före någon mutation).

---

### 6.9 Organisationsfilen — verktyget med paketet inbakat
Systemägaren kan baka in organisationspaketet i verktygsfilen och sprida **en** fil
(`docs/utveckling/organisationsfil-design.md`). Paketet ligger som en inaktiv datablock
(`<template id="inbakat-organisationspaket">`) sist i filen, efter sista skriptet; blocket tolkas inte och
exekveras inte, inget skript ändras, och CSP:ns per-script-hashar är oförändrade (vaktas av
`tests/organisationsfil.test.js`: varje skriptblock är byte-identiskt före och efter). Vid start läses
blocket med samma validering som en inläst paketfil (vitlista, textgränser, avvisning av text som liknar
personnummer eller e-post), och paketets låsningar (ADR-47) gäller. **Innehållet är exakt paketets:**
benämningar, inställningar, ställningstagande och jämförelsestatistik — aldrig rader ur en lönefil
(`skapaPaket()` läser aldrig `state.data`; röktestet kräver att organisationsfilen saknar lönefält). Filen
anger vilken version av verktyget den bygger på och verktygsfilens kontrollsumma; någon verifiering av
organisationsfilen mot den publicerade versionen görs inte (produktägarens beslut: filen kommer från
systemägaren internt). Handläggaren kan granska och ladda ner det inbakade paketet; demoläget går före.
Webbläsarröktestet öppnar en organisationsfil under CSP:n från `file://` och kräver noll överträdelser.

## 7. Hotbild & riskregister

Skala: Sannolikhet/Konsekvens = Låg / Medel / Hög. Restrisk = efter åtgärd.

### A. Datasäkerhet (tekniskt)

| # | Risk | Sanno. | Konsek. | Åtgärd (i verktyget) | Restrisk |
|---|---|---|---|---|---|
| A1 | Exfiltrering av data via nätverk | Låg | Hög | CSP `connect-src 'none'` + 0 nätverksanrop + 0 externa resurser | **Låg** |
| A2 | Spår kvar på disk (lagring) | Låg | Medel | Ingen kod eller inbyggt bibliotek skriver till lagringen (webbläsartestet kräver tom lagring); storage-tripwire som reserv, med kända luckor (§6.2); ingen IndexedDB/cache; rensningsknapp | **Låg** (OS-swap utanför kontroll; spärren hindrar inte en framtida kodändring som skriver utan `setItem`) |
| A3 | XSS via fientligt CSV-innehåll | Låg | Medel | Fyra lager: hash-baserad `script-src` (ADR-9) avvisar injicerade inline-`<script>` OCH inline-handlers — själva exekveringen blockeras; `esc()` (escapear `& < > " '`, säker i attributkontext); ingångssanering (`_cleanYrkeField` + `_normalizeBas`); `connect-src 'none'` hindrar all exfiltrering. Regressionstester i `parsing`; live-verifierat (injicerad handler kördes ej) | **Mycket låg** |
| A4 | Sårbarhet i tredjepartsbibliotek | Medel | Medel | Lokalt buntade, fastställda versioner, SHA i bygget; CSP hindrar exfiltrering även vid kompromiss | **Låg–medel** |
| A5 | Skadligt webbläsartillägg / komprometterad enhet läser DOM | Medel | Hög | Utanför verktygets kontroll | **Medel** (organisatorisk åtgärd, §8) |
| A6 | Manipulerad/utbytt HTML-fil distribueras | Låg | Hög | Sigstore-signatur från release-arbetsflödet, verifieras med `cosign verify-blob` (`SECURITY.md`); SHA-256 i `RELEASE.txt` skyddar bara mot en skadad fil. En organisationsfil (§6.9) har en annan kontrollsumma än den publicerade versionen och kan inte verifieras mot den: systemägaren verifierar den nedladdade versionen och sprider organisationsfilen via en behörighetsstyrd intern yta; *Visa paketet* anger kontrollsumman för den verktygsfil den byggdes av, som en uppgift i filen, inte ett äkthetsbevis | **Låg** (kräver att signaturen verifieras och att organisationsfilen sprids internt) |
| A7 | Formel i CSV-export körs i Excel (CSV-injektion via yrkesnamn i lönefilen) | Låg | Medel | Textceller som börjar med `= + - @` neutraliseras i CSV och urklipp (ADR-15); regressionstest i `tests/smoke.test.js` | **Mycket låg** |

### B. Användning (organisatoriskt / tolkning)

| # | Risk | Sanno. | Konsek. | Åtgärd (i verktyget) | Restrisk |
|---|---|---|---|---|---|
| B1 | **Exportfiler lämnar skyddad miljö** (e-post, delning, osäker disk) | Hög | Hög | Endast aggregat i merparten av exporter; varningstexter/känslighetsnotis. Gäller även Word-utkastet och konfigfilen, som därtill kan innehålla **användarförfattade bedömningar** (§2/§6.8), och **diagramdata från individdiagram**, som innehåller en rad per person (§6.6). Det som kopieras till urklipp (tabeller, diagramdata, rapportunderlag) kan synkas till molnet eller andra enheter av operativsystemet eller en urklippshanterare (Windows molnurklipp, Apples universella urklipp); organisationen bör stänga av sådan synkning på de datorer som används | **Medel–hög** → kräver organisatorisk hantering (§8) |
| B1b | Användaren skriver personuppgifter i fritextfält (§ 8-anteckningar m.m.) | Låg–medel | Medel | Riktlinje i gränssnitt + körguide: "gruppnivå — inga namn/personnummer"; texten lämnar verktyget endast via användarinitierade utdata | **Låg–medel** (organisatorisk, §8) |
| B2 | Re-identifiering i små grupper | Medel | Medel | k-anon (standard 10, kan ändras — ADR-38; sänkning kräver bekräftelse, ger stående varning och står i metodbilagan, i exporterad data och — under 10 — på varje del som kan spridas för sig) i deskriptiva vyer; undantaget för likvärdigt arbete dokumenterat; Utforska visar små grupper men utelämnar dem ur export som standard (ADR-14); kvartilerna redovisar inga enskilda löner | **Medel** |
| B2b | Användaren sänker minsta gruppstorlek och sprider en export där små grupper redovisas | Låg–medel | Medel | Standard 10 gäller vid varje start (inget lagras); sänkning kräver bekräftelse, också ur konfigurationsfil och organisationspaket; varning som inte går att stänga på alla flikar, och en mening under rubriken i utskrift; värdet och meningen om sänkning står i exporterna (metodbilaga, diagramdata, tabell-CSV, rapportunderlag; under 10 även diagrambilder, urklipp och sidfötter), så att mottagaren ser det; en konfigurationsfil utan fältet sänker inte ett strängare värde; organisationen kan sätta egen standard i organisationspaketet och ett golv som fältet, konfigurationsfilen och ett senare paket inte kan gå under utan bekräftelse (ADR-47); paketet kan också stänga av att små grupper tas med i Utforskas export | Kvarstår utan golv i paketet: verktyget kan inte hindra en behörig användare som bekräftar. Med golv kan tröskeln inte sänkas under det utan att ett nytt paket läses in och sänkningen bekräftas. Risken bärs av organisationens egna riktlinjer |
| B3 | Avvikelse feltolkas som "diskriminering" utan saklig prövning | Medel | Medel | Coachande språk, bevis-popups, disclaimers ("verktyget dömer inte") | **Låg–medel** |
| B4 | Beslut på tunt statistiskt underlag (litet n) | Medel | Medel | Tillförlitlighetsflaggor, k-anon, varningar vid n<30/50 | **Låg–medel** |
| B5 | Individuell analys (lika arbete) pekar ut enskilda | Medel | Medel | Diagram med enskilda personer saknar namn och identifierare; *Personer att granska* (ADR-23) visar enskilda med radnummer men bara i verktyget — ingen export, dold vid utskrift; bedömning ska dokumenteras manuellt | **Medel** (hantera som personuppgift, även diagramdata-exporter) |
| B6 | Felaktig indata (fel kön/lön) → fel slutsats | Medel | Medel | Datakvalitetsrapport, reality-check, parsningsspårning | **Låg–medel** |
| B7 | Exponering via skärmdelning/skärmdump under möte | Medel | Medel | — | **Medel** (organisatorisk åtgärd) |

---

## 8. Restrisker & organisatoriska rekommendationer

Verktyget hanterar de **tekniska** riskerna väl. De kvarstående riskerna är
huvudsakligen organisatoriska och åligger arbetsgivaren:

1. **Hantera exportfiler som personuppgifter (B1, viktigast).** Spara dem endast
   på behörig, åtkomstskyddad yta. Dela bara med behöriga (HR, vid behov facklig
   part under sekretess). Radera när de inte längre behövs. Undvik e-post utan
   kryptering.
2. **Kör på betrodd enhet (A5, A2).** En hanterad arbetsdator med minimala
   webbläsartillägg; undvik delade/publika datorer. Stäng fliken efter användning.
3. **Verifiera artefaktens signatur (A6)** med cosign enligt `SECURITY.md` innan filen
   distribueras och används; jämför därefter SHA-256 mot `RELEASE.txt` för internt spridda kopior.
   En organisationsfil sprids bara via en behörighetsstyrd intern yta.
4. **Behandla småtals- och likvärdighetsresultat konfidentiellt (B2, B5).** Var
   restriktiv med att exportera resultat för mycket små grupper — i Utforska
   betyder det att bara kryssa i "Ta med grupper under 10 i exporten" när det
   behövs — och med diagramdata från diagram som visar enskilda personer.
5. **Säkerställ HR-kompetens vid tolkning (B3, B4).** Verktyget identifierar
   *kandidater*; den juridiska bedömningen av sakliga skäl görs av människa och
   dokumenteras i rapporten.
6. **Var försiktig vid skärmdelning (B7).**
7. **Stäng av urklippssynkning (B1).** Tabeller, diagramdata och rapportunderlag som
   kopieras hamnar i operativsystemets urklipp, som kan synkas till molnet eller andra
   enheter (Windows molnurklipp, Apples universella urklipp, urklippshanterare). Stäng av
   sådan synkning på de datorer som används för lönekartläggningen.

## 9. Behövs en formell konsekvensbedömning (DPIA, art. 35)?

Lönekartläggning kan utgöra en *storskalig* behandling av personuppgifter och en
*systematisk bedömning* av personliga aspekter (lön), vilket kan tala för att
arbetsgivaren bör göra en formell DPIA för **lönekartläggningsprocessen som
helhet** (inte minst datauttaget ur personalsystemet och hanteringen av
slutrapporten).

**Detta verktyg är dock en lågrisk-komponent i den processen:** lokal bearbetning,
ingen lagring, ingen överföring, minimerad indata. Verktyget *minskar* den
tekniska risken jämfört med alternativ. Denna analys utgör underlag till
arbetsgivarens egen DPIA-bedömning men ersätter den inte. **Slutlig bedömning av
om en formell DPIA krävs görs av arbetsgivarens dataskyddsombud.**

## 10. De registrerades rättigheter

Eftersom verktyget inte lagrar eller överför uppgifter hanteras de registrerades
rättigheter (tillgång, rättelse, radering m.m.) i **källsystemet** (personalsystemet)
och i arbetsgivarens dokumentation — inte i verktyget. I verktyget finns ingen
persistent kopia att begära ut eller radera; "Rensa all data" och fliksstängning
tar bort allt minne omedelbart. Verktyget gör inga utskick till de registrerade.

## 11. Verifiering

Varje påstående i detta dokument är prövat mot koden, med provkörning i jsdom och i Chromium.
Skyddet bevakas av drift-, golden-, röktest-, k-anonymitets-, dokumentations-, statistik- och
a11y-sviterna (65 testfiler) och av ett röktest av det byggda verktyget i en riktig webbläsare
(`tools/browser-smoke.mjs`). Röktestet körs lokalt och i CI-arbetsflödet i
Chromium, Firefox och WebKit. Verifieringen visar också var skyddet är svagare än det kan se ut: lagringsspärren är en
reserv med kända luckor (§6.2); PII-kontrollens värdekontroll läser filens 50 första rader (§6.4);
hela filen ligger i minnet under inläsningen (§6.4); invarianterna
prövar inte undantagen och diagrambilderna (§6.5).

**Granskningen 2026-10-19** prövade hela dokumentet — §0–§11 — mot `src/`, `tools/bundle.mjs`, det byggda
verktyget och testerna. Varje namngiven funktion, konstant, test och gräns söktes upp i koden: CSP-raden i
bygget (ordagrant som §6.1, fem skript och fem hashar), fältvitlistan, PII-kontrollens 50 rader och gränserna 3
och 5, ansvarskodens 95 %, BAS över J, paketets 200 tecken och 5 MB, rensningstidens 30 minuter och låsningens
5–120, `K_STANDARD`, `statGolv()`, formelskyddet, exportmärkningen, konfigurationsfilens version 2 och att
`buildConfigSnapshot()` och `skapaPaket()` inte läser `state.data`, biblioteksfilernas kontrollsummor och
sökningen i dem och i `dist/app.js` efter nätverks- och lagringsanrop. Tre påståenden som tidigare var
engångskontroller är nu automatiska och prövade med en avsiktlig förändring: att inga nätverksförfrågningar
görs och att injicerad kod och arbetstrådar stoppas (röktestet; prövat mot en sida som navigerar ut och mot en
kopia utan CSP), och att bara de vitlistade fälten hålls i minnet (`tests/smoke-ansvar.test.js`; prövat med en
läckt kolumn). Granskningen fann att extremvärdeslistan skrevs ut med Översikt trots att dokumenten sade att
den bara visas i verktyget; den döljs nu vid utskrift (§6.5). Verktygets egen text om Ålder & karriär sade att
punkterna per person alltid visas; den är rättad. A6 och §8 punkt 3 hänvisar nu till signaturen.
Röktestet kördes i Chromium, Firefox och WebKit.

| Kontroll | Metod | Resultat |
|---|---|---|
| Ingen utgående trafik | Statisk sökning (fetch/XHR/WS/beacon/Worker/IndexedDB/Cache) + CSP-läsning + webbläsarröktestet, som registrerar varje förfrågan från alla sidor under en körning med alla flikar, utskriften och samtliga exporter | ✔ 0 verkliga anrop, 0 nätverksförfrågningar |
| CSP i bygget | Läsning av meta-taggen i bygget + körning i Chromium | ✔ ordagrant som §6.1; 5 skript, 5 hashar (`tools/bundle.mjs` skriver antalet vid varje bygge); `frame-ancestors` ignoreras i meta (dokumenterat) |
| Inga externa resurser | Sökning efter `<script src>` och http(s)-URL:er i bygget | ✔ 0 `<script src>`; träffarna är XML-namnrymder och kommentarer |
| Ingen lagring | Tripwire-kod + körning i Chromium: skrivförsök och läsning efter full körning | ✔ `setItem` och cookie kastar; allt tomt efter körning |
| Lagringsspärren | Automatiskt test i jsdom och röktest i Chromium och Firefox: `setItem` med olika nycklar, direkt tilldelning och `defineProperty`, i localStorage och sessionStorage; cookie; sökning efter `setItem` i biblioteksfilerna | ✔ varje skrivning kastar, inga undantag, inget lagras; ✔ 0 `setItem` i de fyra biblioteken (§6.2) |
| Web Workers | Webbläsarröktestet skapar en worker från `blob:` | ✔ avvisas av CSP (`script-src` som reserv för `worker-src`) |
| Rensning (lagringsminimering, art. 5.1 e och 25.2) | Invariant för båda rensningsvägarna (inkl. extremvärden och utskrift) + körning i Chromium (alla flikar, utskrift, rensa, ladda om) | ✔ inget lönevärde kvar i dokumentet eller minnet; allt ritas igen efter ny inläsning |
| Dataminimering | `ALLOWED_FIELDS` + `extractMinimalRecord` + test som läser in en fil med extra kolumner och kräver exakt de vitlistade fälten i minnet (`tests/smoke-ansvar.test.js`) | ✔ 5 obligatoriska fält + valfri poäng + valfri ansvarskod + radnummer (härledda `aid`/`yrkeLabel`/`ansvarsgrupp`); kolumnen *Ansvar* läses inte in |
| PII-avvisning | `detectSensitiveColumns` + körning i Chromium med PII-testfil; rubrikprov i jsdom | ✔ strukturfilen avvisas (0 rader inlästa); policy-/statistikfil kontrolleras inte (dokumenterat, §6.4); ✔ rubrikerna *Förnamn* och *Fornamn* avvisas (§6.4) |
| Namnmaskering | `_cleanYrkeField` + körning i Chromium | ✔ "101 Anna Andersson" → "101 ***" |
| k-anonymitet | `kTroskel()` + render-läsning vid 10, 25 och 5 (`tests/ktroskel.test.js` och `tests/ktroskel-hojning.test.js`) | ✔ standard 10, inställbart (ADR-38; undantag likvärdigt arbete dokumenterat) |
| k-anonymitet i Utforska-export (ADR-14) | Exporttester i `tests/kanonymitet.test.js` + genomsökning i Chromium av alla kombinationer rad × kolumn × diagramtyp × helhet/per kön × mått med rutan urkryssad | ✔ inga grupper eller kön under 10 i tabell- eller diagramexport |
| Personer att granska och extremvärdeslistan stannar i verktyget (ADR-23) | Test i `tests/smoke-granssnitt.test.js` (en flaggad persons lön finns inte i rapportunderlag eller Word-utkast) + webbläsarröktestet (extremvärdeslistan med rader syns inte i utskrift) + kodläsning (inga exportverktyg; bilagorna hämtar bara namngivna tabeller) | ✔ lönen och radnumret finns inte i någon utdata; båda döljs vid utskrift |
| k-invarianten över flikar och exporter | `tests/ktroskel-invarianter.test.js`: underlag med ett kön under tröskeln i en större grupp, en ensam person och ett 2-mot-2-BAS; flikar, Word, utskrift ×3, rapportunderlag, Excel ×9, CSV, diagramdata och gruppdossier vid 10 och 25 | ✔ inget dolt värde i någon prövad utdata; undantagen och diagrambilder prövas inte; lönerevisionssimulatorn prövas med ett urval under och ett över tröskeln; Ålder & karriär per BAS och regressionens ojusterade steg prövas av egna tester i `tests/ktroskel-regression.test.js` (§6.5) |
| Kvartiler utan enskilda löner | Enhetstest, röktest, golden-facit + EU-exporten genomsökt i Chromium | ✔ varken lägsta eller högsta lön i fliken eller exporten |
| Formelskydd i CSV/urklipp (ADR-15) | Regressionstest (`tests/smoke.test.js`) + kodläsning av alla CSV-skrivare | ✔ `= + - @`-celler neutraliseras; tal orörda; mallfilen innehåller ingen användardata |
| Lokala exporter | Blob/`<a download>`/print-läsning | ✔ inga uppladdningar |
| Hash-baserad CSP (ADR-9) | Hash-jämförelse + webbläsarröktestet: injicerat `<script>`, inline-`onclick` och `<img onerror>`; skadlig text i lönefil och paket i jsdom (`tests/smoke-ansvar.test.js`) | ✔ ingen av dem exekverades; appen fullt funktionell |
| XSS-utdatakodning | `esc()` escapear `& < > " '` + regressionstester (`tests/parsing.test.js`) | ✔ säker även i attributkontext |
| Konfigfilens innehåll | Kodläsning av `buildConfigSnapshot()` och importen | ✔ ingen `state.data`-referens; inställningar + användartext + avbockningar i Att göra (§6.8); import läser version 2 och avvisar andra versioner |
| Word-utkast lokalt | Kodläsning + live-test: Blob fångad, innehåll inspekterat; zip-filen läses tillbaka i röktesterna (ADR-37) | ✔ lokal `Blob` (`.docx`), DEMODATA-märkning fungerar |
| Tillgänglighet (markup) | axe-core i automatiska sviten (`tests/a11y.test.js`) | ✔ 0 överträdelser |
| Automatiska tester | `npm test` (Vitest, 65 testfiler; kör om en fil vars arbetare kraschat i Node) + `npm run test:browser` (bygget i Chromium; samma röktest finns för Firefox och WebKit) | ✔ alla gröna |
| Bundle-integritet | Reproducerbart bygge + SHA-256 i RELEASE.txt; byggskydd mot mojibake och `node --check` (kodläsning av `tools/bundle.mjs`) | ✔ |

## 12. Slutsats

**Verktyget uppfyller sin modell för inbyggt dataskydd (GDPR art. 25)** och är
driftsklart ur dataskydds- och informationssäkerhetssynpunkt. Inga blockerande tekniska fynd.
De viktigaste återstående riskerna är organisatoriska — framför allt hanteringen
av exportfiler — och hanteras med åtgärderna i §8. Arbetsgivarens dataskyddsombud
ansvarar för den slutliga bedömningen av om en formell DPIA krävs för
lönekartläggningsprocessen som helhet.

## 13. Vanliga frågor vid införande (IT-avdelning / dataskyddsombud)

Kortfattade, kodverifierade svar för den som granskar verktyget inför lansering.
Varje svar har täckning i §§ 1–11 ovan.

**Behöver vi teckna personuppgiftsbiträdesavtal?**
Nej. Ingen data lämnar arbetsgivarens enhet; ingen extern part behandlar
uppgifterna. Det finns inget biträde (§3).

**Skickar verktyget något över nätverket?**
Nej. Noll nätverksanrop i koden och CSP `connect-src 'none'` blockerar även
hypotetiska framtida försök på webbläsarnivå. Verktyget fungerar fullt ut med
nätverket avstängt (§6.1).

**Lagrar verktyget något på datorn?**
Nej. Allt lever i webbläsarens arbetsminne och försvinner vid fliksstängning.
Varken verktyget eller de inbyggda biblioteken har kod som skriver till lagringen. En
spärr i koden avbryter dessutom de vanligaste skrivvägarna (`setItem`, cookies); den är
en reserv mot misstag och har kända luckor (§6.2). Det enda som hamnar på disk är **filer användaren
själv väljer att ladda ner** — de ska hanteras som personuppgifter (§8).

**Kan skadlig indata (manipulerad CSV) ta över verktyget?**
Exekvering av injicerad kod blockeras tekniskt av den hash-baserade CSP:n
(ADR-9) — verifierat live: en injicerad inline-händelsehanterare kördes inte.
Därtill utdata-kodning och ingångssanering i djupled (§6.1, riskregister A3).

**Behöver IT installera eller drifta något?**
Nej. Verktyget är en enda HTML-fil som öppnas lokalt i en modern webbläsare på en
dator (Chrome/Edge, Firefox, Safari 16.4+; surfplatta och mobil stöds inte). Ingen
serverdrift, inga beroenden, ingen administratörsbehörighet.

**Hur vet vi att filen vi fått är äkta?**
Jämför filens SHA-256 mot `RELEASE.txt` (kommandon står i filen). Bygget är
reproducerbart (§6.7, risk A6).

**Används AI eller molntjänster i analysen?**
Nej. All beräkning är deterministisk, lokal statistik (OLS-regression,
bootstrap, medianer) i öppen JavaScript-kod som kan granskas rad för rad. Modellkoden ligger
i `src/lib/` och prövas mot referensvärden från statsmodels och scipy
(`tests/stat-referens.test.js`).

**Krävs en formell DPIA?**
Verktyget är en lågriskkomponent (lokal, minimerad, icke-lagrande) — men
lönekartläggnings**processen** (datauttag, rapporthantering) kan kräva DPIA.
Beslutet ligger hos ert dataskyddsombud; denna analys är underlaget (§9).

**Vad är det känsligaste som kan lämna verktyget?**
Användarinitierade filer: Excel-underlag med gruppaggregat — där likvärdighetsexporten
också tar med kandidatpar med små grupper (§6.5) — Word-utkastet med HR:s egna bedömningar, diagramdata från diagram som visar enskilda personer (en
rad per person med lön, kön och ålder eller grupp — utan identifierare, §6.6),
samt konfigurationsfilen (inställningar + HR:s anteckningar — aldrig råa
individrader, §6.8). Samtliga
ska förvaras på behörighetsstyrd yta och inte skickas okrypterat (§8, punkt 1).

**Hur utvärderar vi utan att använda riktig lönedata?**
Använd demoläget ("Prova med demodata") — syntetisk exempeldata, tydligt märkt
DEMODATA i gränssnitt och alla exporter (§5). För pilot med skarp data finns
`pilotchecklista.md`; för användarflödet `korguide.md`.
