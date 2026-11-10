# Risk- och sårbarhetsanalys (dataskydd och informationssäkerhet) — Öppen lönekartläggning

**Bygge:** `2026.11.05` · **Artefakt-SHA-256:** `fb5cfb275648e00047e47f7674a6b22a979d61552d8c1e6aa69c5df04c708f8f` (se `dist/RELEASE.txt`).
**Granskningsdatum:** 2026-11-07.
**Granskningsmetod:** kodläsning påstående för påstående + statisk sökning i källkod och bygge +
körning av det byggda verktyget i jsdom och i Chromium (utan nätverk) med syntetiska testfiler.
Varje teknisk kontroll nedan är **verifierad mot koden och i webbläsaren**, inte antagen. Vad
verifieringen omfattar, och vad den inte prövar, står i §11.

`dataskydd.md` är den stående policyn; detta dokument är den kodverifierade riskanalysen.

---

## 0. Sammanfattande omdöme

**Verktyget är en lågrisk-komponent ur dataskyddssynpunkt.** All bearbetning sker
lokalt i HR-handläggarens webbläsare. Ingen data lämnar enheten, och inget sparas
persistent. Indata minimeras till fem obligatoriska fält. Till dem kommer valfri arbetsvärderingspoäng per
befattning, valfri ansvarskod enligt AID och radens nummer i källfilen. Jämfört med molnbaserade verktyg
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
| **Ändamål** | Fullgöra arbetsgivarens skyldighet att kartlägga, analysera och åtgärda osakliga löneskillnader mellan kvinnor och män (diskrimineringslagens regler om lönekartläggning, lagrum.md) samt stödja EU 2023/970-relaterade moment. |
| **Art** | Statistisk analys av aggregerad och individuell lönedata i syfte att upptäcka könsrelaterade löneskillnader. Ingen profilering med rättsverkan för enskild; verktyget fattar inga beslut om enskilda. |
| **Omfattning** | En arbetsgivares anställda — typiskt tiotals till tusentals individer per fil. En körning per år. |
| **Kontext** | Körs lokalt på den personuppgiftsansvariges egen enhet. Ingen molntjänst, ingen extern part, ingen delning utanför enheten under själva bearbetningen. |

## 2. Personuppgifter som behandlas

Verktyget minimerar indata till **fyra obligatoriska fält per anställd** plus en
**valfri ålder** (rekommenderad, ADR-64), en **valfri arbetsvärderingspoäng** och en **valfri ansvarskod** (vitlista `ALLOWED_FIELDS`, verifierad i koden).
Poängen är en egenskap hos **befattningen** (arbetsvärderingens resultat), inte
hos individen, och tillför därmed ingen ny integritetsrisk:

| Fält | Roll | Integritetskänslighet |
|---|---|---|
| Månadslön | Subjekt för analysen | Hög (lön är integritetskänsligt) |
| Kön | Grunddimension (kvinna/man) | Diskrimineringsgrund — ingen särskild kategori av personuppgifter |
| Ålder (valfri, rekommenderad) | Kontrollvariabel; utan ålder körs analysen utan åldersjustering och Ålder & karriär visas inte (ADR-64) | Medel |
| AID / yrkesgrupp | Gruppering | Låg–medel |
| BAS-intervall | Kravnivå-proxy | Låg |
| Poäng (valfri) | Arbetsvärderingens krav-poäng per befattning (krav-proxy för likvärdigt arbete) | Ingen — befattningsattribut, ej individbundet |
| Ansvarskod enligt AID (valfri) | Grupperas i tre ansvarsgrupper (ledningsansvar, särskilt uppdrag, inget); prövar ansvar som tänkbart sakligt skäl. Läses bara om minst 95 % av värdena är giltiga; kolumnen *Ansvar* (ofta kostnadsställe) läses aldrig | Låg–medel — chefsansvar kan i små grupper peka ut en person; samma k-regel som övriga grupper (§6.5) |
| Radnummer (`radnr`) | Radens nummer i källfilen; låter HR slå upp en person i *Personer att granska* och extremvärdesdetektorn (ADR-23) | Låg — ingen ny identifierare, men kopplar raden till källfilen |

AID-kod och yrkesetikett (`aid`, `yrkeLabel`) härleds ur yrkesfältet och är inga nya
uppgifter.

**Klassificering:** Detta är **ordinära personuppgifter**, inte särskild kategori.
Dataskyddsförordningens särskilda kategorier är inte tillämpliga, eftersom underlaget inte innehåller några
sådana uppgifter. Inläsningen avvisar namn, personnummer och e-post, och kolumner vars rubrik antyder en
särskild kategori (se §6.4). *Men* — lön är integritetskänsligt, och uppgifterna är
könsuppdelade och kan i **små grupper vara identifierande** (re-identifieringsrisk,
se §7.B1). Namn, personnummer och e-post samlas medvetet **inte** in och avvisas
aktivt vid uppladdning (se §6.4).

**Användarförfattad text:** HR kan skriva egna bedömningar i verktyget:

- status och anteckning per granskningsområde i Regler & praxis
- handlingsplanens fält per rad: sakligt skäl prövat, ansvarig, tidsplan och status. En egen rad som lagts
  till på fliken har också åtgärd och berörd grupp.
- redigerat struktur-narrativ
- skälet till en vald förklaringsmodell (högst 300 tecken). En text som liknar personnummer eller e-post sparas
  inte från panelen (ADR-56).
- lönemånaden som skrivs ovanför tabellerna per AID-kod och BAS-intervall (högst 40 tecken, ADR-57).

Texten lever endast i minnet: handlingsplanens fält i `state.handlingsplan`, förklaringsmodellen i
`state.forklaringsmodell` och lönemånaden i `state.lonemanad`, alla nollade av *Rensa all data*. Texten
saneras inte, eftersom det är användarens egna ord. Den lämnar verktyget enbart via användarinitierade utdata:
Word-utkast, utskrift och konfigurationsfil. Handlingsplanens fält följer också med i handlingsplanens Excel-fil,
och lönemånaden i Excel-filens fyra blad per AID-kod och BAS-intervall (se §6.6/6.8).
Den är avsedd att vara **gruppnivå-bedömningar** och därmed inte personuppgifter.
Om HR ändå skriver in uppgifter om enskilda blir innehållet personuppgifter. Det
omfattas då av samma hanteringskrav som exportfilerna (§8, punkt 1). Verktygets
riktlinje i gränssnitt och körguide: *skriv på gruppnivå — inga namn eller
personnummer*.

## 3. Roller och laglig grund

- **Personuppgiftsansvarig:** arbetsgivaren (organisationen) som genomför
  lönekartläggningen.
- **Personuppgiftsbiträde:** *inget.* All bearbetning sker lokalt på den ansvariges egen enhet.
  Ingen data överförs till verktygets upphovsperson eller någon tredje part, så ingen
  biträdesbehandling sker. Inget biträdesavtal
  (Art. 28) behövs för själva verktyget.
- **Laglig grund:** **rättslig förpliktelse** (art. 6.1 c med 6.3). Diskrimineringslagens regler om
  lönekartläggning och dokumentation (lagrum.md) ålägger arbetsgivaren att genomföra lönekartläggningen.
- **Tredjelandsöverföring:** ingen (ingen utgående trafik alls).

## 4. Dataflöde

```
Personalsystem ──(HR exporterar CSV/XLSX)──▶ HR:s enhet (disk)
                                              │
                                   (användaren väljer fil i verktyget)
                                              ▼
                            Webbläsarens minne (state.data) ── analys/render
                                              ▲
HR:s egna bedömningar ─(praxisanteckningar,──┘
(skrivs i verktyget)      handlingsplanens fält,
                          struktur-narrativ)
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

**Ej avsett / utanför avgränsningen (hanteras separat av arbetsgivaren):** statlig
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
  verkan här.** Webbläsare ignorerar direktivet när CSP levereras via en meta-tagg
  (Chromium loggar det vid laddning). Skydd mot inbäddning i
  ram kräver ett HTTP-huvud, vilket en lokalt öppnad fil inte har. Risken är låg:
  filen öppnas från disk och publiceras inte på en webbplats som kan ramas in.
- **Navigering täcks inte av CSP.** Policyn stoppar anrop från skript, externa resurser
  och formulär. Men ingen CSP i en meta-tagg hindrar att sidan navigerar till en annan
  adress (en länk, eller `location` satt av ett skript). Verktyget har inga länkar ut och
  ingen kod som navigerar (kodläsning), och injicerad kod kan inte köras (nästa
  punkt). Skyddet mot den vägen är alltså skriptspärren, inte `connect-src`.
- **Hash-baserad `script-src` (ADR-9):** `script-src` listar de exakta SHA-256-hasharna för de fem
  inlinade skripten i stället för `'unsafe-inline'`. Skripten är PapaParse, SheetJS, D3, JSZip och
  verktygets eget skript.
  Det innebär att webbläsaren avvisar **både** injicerade inline-`<script>` och
  injicerade inline event-handlers (`onclick=…`). Hela klassen "fientligt
  CSV-innehåll körs som kod" är därmed tekniskt omöjlig, inte bara bortsanerad.
  `tools/bundle.mjs` beräknar hasharna per bygge; appens egna knappar använder delegerade
  lyssnare (inga inline-handlers).
- **Stilar (ADR-30):** `<style>`-element kräver en känd kontrollsumma
  (`style-src-elem`), och stilattribut i markeringen är förbjudna (`style-src-attr 'none'`).
  Verktyget har inga `style="…"` kvar, bara klasser, och uträknade mått sätts via CSSOM,
  som CSP:n inte rör. En injicerad `<style>` (den farligaste formen av CSS-injektion)
  och ett injicerat `style="…"` blockeras alltså. Det är verifierat i Chromium, och
  webbläsarröktestet kräver noll CSP-överträdelser under hela körningen.
- **Tredjepartsbiblioteken** är låsta med kontrollsummor (`vendor/SHA256SUMS`, vaktas av
  `tests/sakerhet.test.js`), och CI-stegen är låsta på commit-SHA.
- **Statisk sökning:** **noll** verkliga `fetch`/`XMLHttpRequest`/`WebSocket`/
  `sendBeacon`/`Worker`/`importScripts` i app.js (de enda träffarna är förklarande
  dokumentationstext).
- **Inga externa resurser:** alla bibliotek (D3, XLSX, PapaParse, JSZip)
  buntas lokalt i HTML-filen — ingen CDN, inga externa URL:er. **Web Workers**
  blockeras också. CSP saknar `worker-src`, så `script-src` (bara de fem hasharna)
  gäller, och en worker från en `blob:`-URL avvisas (vaktas av webbläsarröktestet). Det är ett
  medvetet arkitekturbeslut (ADR-1).
- **Verifierat i webbläsare:** webbläsarröktestet (`tools/browser-smoke.mjs`) registrerar varje förfrågan från
  varje sida det öppnar. Det läser in demodata och egna testfiler, ritar alla flikar, bygger utskriften och kör
  samtliga exporter. Det kräver **noll** förfrågningar utanför den lokala filen och `data:`/`blob:`-adresser. Att
  kontrollen fångar trafik är prövat: en sida som navigerar till en http-adress registreras. Röktestet prövar
  också att en arbetstråd ur en `blob:`-adress och ett injicerat skript, en `onclick` och en `<img onerror>`
  stoppas av CSP:n.

- **D3 7.9.0 (ISC)** ritar diagrammen (ADR-39) och är ett av de inlinade skripten, med egen hash.
  Sökning i `vendor/d3.min.js`: inget `localStorage`, `sessionStorage`, `setItem`,
  `document.cookie`, `eval(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` eller `Worker`. Filen innehåller **ett
  `new Function(`** (d3-dsv, radtolkaren i `d3.csvParse` m.fl.) och **fyra `fetch(`** (d3-fetch: `d3.json`,
  `d3.csv`, `d3.text` …) samt ett `new Image` (`d3.image`). Inget av dem körs när biblioteket laddas.
  Verktygets kod anropar ingen av de funktionerna (diagramkärnan använder skalor, former och DOM-val). Skulle
  de anropas stoppas de av CSP:n: `new Function` av `script-src` utan `'unsafe-eval'` och `fetch` av
  `connect-src 'none'`. Webbläsarröktestet kräver noll CSP-överträdelser.
- **Diagramkärnans export (ADR-39):** PNG görs genom att den exporterade SVG:n läses som bild från en
  `data:`-adress och ritas på en canvas. Det sker inom `img-src data: blob:`, utan nätverk och utan ändring av CSP:n.
  SVG:n bär inga skript, händelseattribut, `id` eller yttre referenser (vaktas av test).

### 6.2 Ingen persistent lagring ✔ (med en notering)
- **Ingen kod skriver till lagringen.** Verktygets kod innehåller inga skrivningar. De fyra
  biblioteksfilerna (D3, SheetJS, PapaParse, JSZip) innehåller inget anrop till `setItem` och ingen
  `document.cookie` (sökning i biblioteksfilerna). Det är det
  egentliga skyddet, och webbläsarröktestet kräver att localStorage, sessionStorage och cookies är tomma efter
  en full körning.
- **Storage-tripwire som reserv** (`installStorageTripwire`): den första koden i verktygets
  eget skript, som körs efter att de fyra biblioteken laddats. Den kastar när
  `Storage.prototype.setItem` anropas (localStorage och sessionStorage) eller
  `document.cookie` sätts. `removeItem`/`clear` spärras inte — de kan inte lagra något.
  **Spärren har inga undantag**, varken för nycklar eller för anropare. Den fångar också
  egenskapstilldelning (`localStorage.x = '…'`, `sessionStorage['x'] = '…'`). Fönstrets två lagringsobjekt är
  utbytta mot ombud som kastar vid varje tilldelning och egenskapsdefinition. Läsning, `removeItem` och
  `clear` går vidare. Cookie-spärren har inga undantag. Utanför spärren står IndexedDB och Cache API, som ingen
  kod använder (kodgranskning och CSP).
- **Verifierat i webbläsare:** skrivförsök med `setItem` till localStorage och
  sessionStorage samt till cookie kastar. Efter demodata och alla flikar är
  localStorage, sessionStorage och cookies tomma.
- **IndexedDB / Cache Storage:** används inte av verktyget.
- **Webbläsarens autofyll-historik:** alla fält har `autocomplete="off"`, både sidans fasta fält vid start och
  varje fält som skapas medan användaren arbetar. Det gäller till exempel anteckningarna i Regler & praxis,
  handlingsplanens fält, Löneöversyns riktade rader och Tabeller och egna vyer. En observatör sätter attributet på
  fält som läggs till i dokumentet (`stangAutofyll`, `01-html-och-tillganglighet.js`). Då sparas inte
  organisationsnamn och anteckningar i autofyll-historiken, som kan synkas till leverantörens moln. Vaktas av `tests/troskelbeslut.test.js`,
  som ritar alla flikar och kräver attributet på varje fält.
- **Notering (utanför verktygets kontroll):** operativsystemets minnesväxling
  (swap) eller webbläsarens egen sidcache kan teoretiskt skriva minnessidor till
  disk. Mitigeras organisatoriskt (betrodd enhet; stäng fliken efter användning).

### 6.3 Inaktivitets- och rensningsskydd ✔
- "Rensa all data"-knapp (med bekräftelsefråga) tömmer `state` omedelbart. Den släpper referenserna i
  Tabeller och egna vyer till raderna och river ned renderade tabeller och diagram, extremvärdesdetektorns
  tabell, utskriftsrapporten och panelen Personer att granska. Diagrammen ritas av diagramkärnan (ADR-39) och
  rensas genom ritarens register `_rfRensaAlla`: figuren på behållaren, lyssnare och verktygstipsets text. Det
  sker oavsett id, och också när behållaren lämnat dokumentet.
- Inaktivitetstimern rensar sessionen automatiskt efter 90 minuter (standard;
  30, 60, 120 minuter eller av under *Vad lagras?*), via **samma** rensningsväg
  (`_rensaAllData`) men utan bekräftelsefråga. Varning och möjlighet att förlänga visas en
  minut innan. Organisationspaketet kan låsa tiden (5–120 minuter; läget av kan inte låsas,
  ADR-47). Rullistan står då på värdet, och `setInactivityTimeout()` tar inte emot något annat.
  *Rensa all data* häver låsningen tillsammans med paketet.
- **Vaktas av en invariant** (`tests/smoke-vyer.test.js`): alla flikar, extremvärdesdetektorn
  och utskriftsrapporten ritas med löner i ett unikt intervall (inklusive ett
  extremvärde). Sedan körs rensningen. Testet kräver att inget lönevärde finns kvar
  någonstans i dokumentet (även dolda flikar och attribut), både för knappen och för den
  automatiska rensningen. Verifierat även i webbläsare med alla flikar och
  utskriften: 0 lönevärden kvar för båda vägarna. Ny inläsning ritar upp allt igen.
- Vid fliksstängning försvinner allt minne (ingen persistens).

### 6.4 Uppgiftsminimering & avvisning av känsliga fält ✔
- **Fältvitlista** (`ALLOWED_FIELDS`): endast BAS, AID/yrke, lön och kön, samt valfri ålder
  (ADR-64; saknas kolumnen blir åldern 0 på varje rad och betyder *saknas*), valfri arbetsvärderingspoäng (befattningsattribut) och valfri ansvarskod enligt AID
  (ADR-33) läses in. Kolumnen *Ansvar* (ofta kostnadsställe) läses inte in (se §2 i
  teknisk-plan.md).
  **Under inläsningen ligger hela filen i minnet** — som byte, som avkodad text och (för
  CSV) uppdelad i rader; Excel-filer som ett helt blad. Fälten plockas ut rad för rad, och
  filens övriga innehåll släpps när inläsningen är klar. (Gränsen på högst 50 råa
  rader i minnet gäller de tolkade radobjekten — samplet för PII-kontrollen — inte filens text.)
  Övriga kolumner i filen ignoreras. Därtill sparas radens nummer i källfilen
  (`radnr`), som hålls som en `Symbol` på råraden och därför varken syns för
  PII-detektorn eller läses som kolumn (ADR-23). Verifierat: fälten i
  minnet är exakt `aid, alder, ansvarsgrupp, ansvarskoder, bas, kon, lon, poang, radnr, yrke,
  yrkeLabel` (`ansvarskoder` och `ansvarsgrupp` är tomma när kolumnen saknas).
- **Alla BAS-intervall ingår (ADR-21, upphävd 2026-10):** även chefsnivåerna K och uppåt läses in
  och analyseras. Små intervall skyddas som alla andra grupper av minsta gruppstorlek vid export.
- **PII-detektor** (`detectSensitiveColumns`): känner igen och **avvisar** lönefiler vars kolumner
  innehåller personnummer-, e-post- eller namnmönster, i både CSV- och Excel-vägen. Lönefilen är den enda
  filen med en rad per person. Kontrollen ser på kolumnrubrikerna och på värdena i **50 rader spridda jämnt
  över filen** (var ⌈n/50⌉:e rad, `_pnrSampelSteg`; den strömmande CSV-vägen samlar raderna under läsningen
  och kontrollerar när filen är läst). En kolumn avvisas på minst tre värden i personnummer- eller
  e-postformat, eller minst fem som ser ut som för- och efternamn. Namnmönstret tar två till fyra ord med
  samma skrivsätt (*Anna Andersson*, *ANNA ANDERSSON*, *anna andersson*) och efternamnet först med komma
  (*ANDERSSON, ANNA*); befattningar med stor bokstav bara först (*Lärare grundskola*) räknas inte. Identifierande
  värden i bara några få rader kan ändå gå förbi samplet. Kolumnen läses då ändå inte in, eftersom bara
  godkända kolumner läses. Rubrikkontrollen normaliserar rubriken (gemener, å/ä/ö → a/a/o). Därför känns
  *Förnamn*, *Fornamn*, *Namn*, *Efternamn*, *Personnummer*, *PNR* och *E-post* igen
  (rubrik- och värdeprov i `tests/parsing.test.js`, filprov i `tests/smoke-ansvar.test.js`, bland dem en fil
  med personnummer först från rad 200 i CSV och Excel).
  Rubrikkontrollen avvisar också kolumner vars rubrik antyder en **särskild kategori av personuppgifter**:
  fackmedlemskap, hälsa, sjukfrånvaro, diagnos, etnicitet, religion, politisk tillhörighet, sexuell läggning,
  funktionsnedsättning, genetik, biometri. Värdena i sådana kolumner har inget igenkännbart format, så bara
  rubriken prövas.
  Verifierat i webbläsare: en fil med kolumnen Personnummer avvisades och inga
  rader lästes in. **Filerna med lönepolitiskt ställningstagande och
  jämförelsestatistik kontrolleras inte av detektorn.** Från dem läses bara godkända
  kolumner med gruppvärden in (BAS, AID, percentiler, median, antal, andel kvinnor), och övriga kolumner lämnas.
  BAS- och AID-värdena saneras på samma sätt som lönefilens (tecknen `< > " ' &` tas bort,
  `_stripHtmlMeta`), och talen läses som tal.
  Det finns **ingen inbyggd referens** (ADR-28). Ställningstagandet och statistiken läses
  in som egna filer eller ur ett **organisationspaket** (JSON). Paketet valideras mot en lista över godkända fält:
  organisation, utgivare, datum, benämningar, PO-påslag, period, minsta gruppstorlek, de tre låsningarna i
  ADR-47 och aggregatrader. Valideringen tar bort tecknen `< > " ' &` ur textfälten och kortar dem till 200
  tecken. Den avvisar filer över 5 MB, och hela paketet om ett textfält liknar personnummer eller e-post. Ett ogiltigt värde i en låsning
  utelämnas med en varning (`_lasningar` i `src/lib/organisationspaket.js`). Referensens och statistikens
  namn och källa följer med i exporterna. Paketet lagras aldrig i verktyget, och demoläget har
  en påhittad referens.
- **Yrkesfält saneras** (`_cleanYrkeField`): trunkeras och maskerar namn-mönster
  (t.ex. "Förnamn Efternamn" → `***`; verifierat: "101 Anna Andersson" lästes in
  som "101 ***"); tecknen `< > " ' &` tas bort. `_normalizeBas` tar bort samma tecken ur BAS-värdet.
- **Utdatakodning:** `esc()` escapear `& < > " '` och är därmed säker även i attributkontext
  (regressionstester i `tests/parsing.test.js`).
- **Förhandskontrollen av lönefilen visar de tio första raderna bara på skärmen.** Varje rad har fem till sju
  fält: BAS, yrke, lön, ålder och kön, och poäng och ansvarskod när de finns. Yrket är som det sparats efter
  saneringen ovan; yrkets råvärde sparas inte. Filens råvärde är kortat till 24 tecken och ligger i
  `state.forhandskontroll` för sessionen. Raderna ingår inte i någon export, i Att göra-punkterna, i
  rapportunderlaget eller i konfigurationsfilen (k-invariantsviten, `tests/ktroskel-invarianter.test.js`).
  Rensa all data tömmer dem. En fil som väntar på *Läs in* (inställningen *Stoppa och visa förhandskontrollen
  innan inläsning*) räknas som data i minnet. Rensa all data släpper den även när inget underlag är inläst, och
  rensningen vid inaktivitet är igång under väntan. *Vad lagras i minnet* säger att en fil väntar.

### 6.5 k-anonymitet ✔
- **Regeln gäller det som lämnar verktyget (ADR-51, 2026-10-29).** På skärmen visas alla grupper (`kTroskel()` är 1 i
  skärmläget). Allt som lämnar verktyget ritas och räknas i exportläget (`medExportLage` i `23-exportgrind.js`), där
  `kTroskel()` är den inställda tröskeln `kInstalld()`. All export av tabeller och diagram går genom två funktioner,
  och de går själva in i exportläget. Rapporttext, Exportera och Spara och jämför år ritas alltid i det.
  Ibland står det i punkterna nedan att ett mått visas, redovisas eller ritas bara när en grupp eller ett kön når
  tröskeln. Det gäller då exportläget; på skärmen visas måttet. Efter en export ritas bara det tillbaka som
  exporten ritade i exportläget (`_ritaOmEfterExport`). Lika arbetes minne har ett rum per tröskel, så att ett
  lägesbyte inte räknar om något. Knappen *Som i exporten* (`sattForhandsvisning`) sätter skärmen i exportläget
  tills den stängs av. En export medan den är på lämnar läget som det är, och ett lägesbyte medan en export
  pågår avvisas (`tests/forhandsvisning.test.js`).
- Standardvärdet är 10 (`K_STANDARD`); användaren kan ändra det (ADR-38). Vid 10 redovisas i det som
  lämnar verktyget inga gruppvärden när en grupp har färre än 10 personer. Gruppen utelämnas och namnges i en not vid tabellen.
  Är bara könsuppdelningen för liten (gruppen som helhet n ≥ 10) visas gruppens
  samlade median utan könsjämförelse.
- **Könsuppdelade mått kräver tröskeln för varje kön** (`_konFarRedovisas` i
  `06-k-anonymitet-och-dataminimering.js`). Det gäller ett köns median eller percentil, en löneskillnad och en
  kostnad som räknats ur en löneskillnad. De redovisas bara när både kvinnor och män är minst så många som
  tröskeln, per grupp och för hela organisationen. Det gäller nyckeltalet på Översikt, Word-utkastet,
  PDF-rapporten, Lönestruktur, EU-lönerapporten, A/B-jämförelsen och Löneöversyns råa löneskillnad.
  Kvartilfördelningen visar då antal per kvartil men inte könsfördelningen.
  Huvudregressionen (i Lönestruktur, med talet i Lika arbetes nyckeltal) har kvar sitt fasta golv (5 per
  kön, se nedan). Dess justerade löneskillnad med konfidensintervall visas från det golvet. Flera mått följer
  tröskeln för varje kön (`_regStegForRedovisning`): den råa medianskillnaden, kronexemplet i regressionskortet
  (som utgår från männens medianlön), regressionens ojusterade steg ("Endast kön") med den förklarade andelen,
  och förklaringsbudgeten. I regressionskortet, Word-utkastet och PDF-rapporten står då en mening i stället.
  Det gäller de urval som har avsnittet om den justerade löneskillnaden: hela dokumentationen och facklig
  dialog. De kvarvarande staplarnas bredd räknas bara mot de steg som visas. Blinder-Oaxaca-uppdelningen körs först när varje kön når
  `statGolv()` (max av tröskeln och 10) och visas därför aldrig med ett kön under tröskeln.
- **Ålder & karriär följer regeln:** ojusterad och åldersjusterad löneskillnad
  visas bara när båda könen i urvalet (alla BAS eller ett valt BAS) når tröskeln. Lutningen per
  kön, trendlinjen med konfidensband och lådan i låddiagrammet visas bara för ett kön som når
  den. Samma regel gäller kvantilpunkterna, alltså lönefördelningen som tjugo prickar per grupp, också i
  Tabeller och egna vyer. De ritas bara för en grupp och ett kön som når tröskeln. En prick står aldrig för
  färre än två personer, eftersom antalet prickar är högst halva gruppen. Diagramdatan är kvantilerna, aldrig
  enskilda löner. En not under diagrammet säger vad som utelämnats, och bilder och diagramdata bär det som
  ritats. I spridningsdiagrammen ritas och exporteras en persons punkt bara när personens grupp (yrke inom BAS)
  och personens kön i gruppen når tröskeln. En not under diagrammet säger hur många personer som inte visas.
  Demografidelens mått är inte könsuppdelade lönemått: åldersfördelning per kön, och trend och
  lönespridning för hela urvalet. Spridningen kräver tröskeln i varje åldersfönster. Trendlinjen
  och lutningen för hela urvalet (alla BAS eller det valda) ritas bara när urvalet når tröskeln.
  Annars utelämnas de, nyckeltalet visar ett streck och noten under diagrammet säger det
  (beslut 2026-10-16). Livscykelanalysen har sitt eget golv
  (`statGolv()`).
- Skyddet vaktas av en invariant (I4, `tests/helpers/ktroskel-invariant.js`, körd från
  `tests/ktroskel-invarianter.test.js`) mot ett dataset där varje liten grupps mått är ett unikt sentinelvärde.
  Testet kräver att inget av dem syns. `tests/ktroskel.test.js` och `tests/ktroskel-hojning.test.js` prövar
  flikarna vid 10, 25 och 5 med grupper om 20 och 6 personer. Vid **10 och 25** prövar invarianten både flikarna
  och utdata mot ett särskilt underlag. I underlaget:
  - har en grupp över tröskeln 1–3 män med en egen lön
  - har ett BAS två av varje kön
  - är en person ensam i sitt yrke
  - har varje yrke en rad i jämförelsestatistiken.

  Utdata som prövas:
  - varje flik ritad i exportläget (det som *Som i exporten* visar och exporterna läser)
  - Översiktens delar, Word-utkastet och utskriften i sina tre urval (hela dokumentationen, ledningsbrief,
    facklig dialog)
  - rapportunderlagets block
  - Excelfilerna: alla flikar, protokollet, EU-lönerapporten, handlingsplanen, jämförelseexporten,
    Löneöversyn, Löneöversikten, prioriteringslistan och ZIP-filens Excelfil
  - Att göra-listans CSV och varje tabell med CSV-knapp
  - diagramdata för varje ritat diagram utom dem med en punkt per person
  - gruppdossiern, BAS-dossierns text och Rapporttextens utkast (med ett stycke per BAS-intervall)
  - rapportens avsnitt Lönekartläggning per BAS-intervall och rapportunderlagets block per BAS-intervall
  - med förra årets bokslut inläst: blocket och avsnittet om förra året med tabellen per BAS-intervall och
    BAS-hantelns diagramdata
  - årsbokslutet i konfigurationsfilen (med lönespridningen per yrkesgrupp och BAS-intervall)
  - rapportens bilaga med gruppdossierer (Word-utkastet och utskriften med bilagan vald)
  - importprofilerna (*Exportera JSON* och konfigurationsfilens fält, prövade som utdata utan lönemått)
  - statistikens matchning i Löneläget (sammanfattningen och *Beräkning & urval* i exportläget; kolumnen
    *Matchning* i tabellernas CSV, Excelfilerna, jämförelseexporten och rapportunderlagets block *Lönerna mot
    referenserna*)
  - diagrammet över statistikens spann i Löneläget (*Överblick*, `chart-jmf-statlage`): diagramdatan ska ha en rad per
    grupp som når tröskeln, med matchningen i serienamnet
  - Att göra-punkterna.

  PDF-rapporten ritas ur samma rapportmodell som Word-utkastet. **Inte prövat av invarianten:**
  fliken Likvärdigt arbete och dess export, Tabeller och egna vyer på skärmen, Personer att granska och
  extremvärdeslistan (undantagen nedan). Inte heller diagrambilder, eftersom innehållet i en bild inte går att
  läsa i testet, eller Ålder & karriär med ett enskilt BAS valt. Vid 5 prövas
  flikarna, inte exporterna. Utanför invarianten har `tests/ktroskel-regression.test.js` egna tester för
  regressionens ojusterade steg (60 kvinnor och 7 män). De prövar kortet, utskriftens tre urval,
  Word-utkastet, rapportunderlaget, Excelfilerna och invariantens övriga utdatavägar. Egna tester finns också
  för Ålder & karriär (3 män i hela urvalet, och ett valt BAS med en man), för Löneöversyns
  scenariojämförelse och för noten vid egna riktade rader.
- **Värdet kan ändras av användaren (ADR-38).** Fältet *Minsta gruppstorlek för redovisning* under
  **Inställningar** i sidhuvudet tar heltal från 2 (högst 1 000). Klicka på värdet i flikarnas översta rad för att komma dit.
  Standardvärdet är 10, och inget lagras mellan sessioner.
  Ett högre värde skärper skyddet. Ett lägre värde gör att mindre grupper redovisas, och då gäller
  tre åtgärder:
  1. Sänkningen måste bekräftas, också när värdet kommer ur en konfigurationsfil eller ett organisationspaket.
  2. En varning som inte går att stänga visas överst på alla flikar. I utskrift står i stället en mening under
     rapportens rubrik.
  3. Värdet anges i metodbilagan, i exporterad diagramdata och i tabell-CSV. Metodbilagan följer med varje
     Excelfil, Word-utkastet och PDF-rapporten. Under 10 står meningen "Tröskeln är sänkt från standardvärdet 10."
     dessutom på det som kan spridas för sig. Det gäller diagrambilder, tabeller i urklipp, Word-utkastets sidfot,
     PDF-rapportens rubrik, den utskrivna handlingsplanen, rapportunderlagets block och den kopierade gruppdossiern.

  Konfigurationsfilen och organisationspaketet bär värdet som ett fält, inte meningen. Flera skattningar läser
  `statGolv()` = `max(kTroskel(), 10)` och följer inte tröskeln nedåt: regression per BAS, Blinder-Oaxaca,
  bootstrap-KI, livscykelmodellen, extremvärdesdetektorn, justerad löneskillnad inom yrke och Personer att granska.
  Verktyget har också andra, fasta golv (ADR-38; de står kvar enligt beslut). Detta betyder alltså inte att alla
  golv är minst 10. En konfigurationsfil eller ett organisationspaket utan fältet ändrar inte gällande värde. En organisation kan sätta sin egen standard i
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
  - *Med tröskelkontroll enligt beslutet:* här utelämnas par med en grupp under tröskeln, och antalet anges.
    Det gäller protokollet för gemensam lönebedömning (bladet för likvärdigt arbete och försättsbladets
    antal), Att göra och dess CSV och handlingsplanens förifyllda rader (skärm, Excel och utskrift). Det
    gäller också gruppdossiern med textkopia och löneöversynens förslag (förslag, mål-läge, känslighetskurva
    och Excel; meningen står vid förslagen). Dessutom gäller det strukturtexten och robusthetspanelen i
    Exportera (yrkesetikett och antal körningar paret träffas i, inget lönemått). Robusthetspanelen vaktas av
    `tests/ktroskel-invarianter.test.js` (invarianten och parfixturen) och `tests/smoke-docx.test.js`.
- **Medvetet undantag 2 — Tabeller och egna vyer (ADR-14):** fliken visar alla grupper på skärmen, som
  de andra flikarna (ADR-51). Skyddet ligger på exporten. Tabellens CSV/urklipp och diagrammets
  export utelämnar små grupper, och lönemått för ett kön under 10, **om inte användaren aktivt
  kryssar i** att ta med dem. Rutan är undantaget: med den ikryssad lämnar små grupper
  verktyget. Utan ikryssad ruta går en liten cell inte att skilja från en tom
  eller dold. Rader och kolumner som bara har små celler utelämnas helt, eftersom etiketten
  annars röjer att gruppen finns. **Antal** (n, även per kön) följer alltid med.
  Differensskydd (att räkna fram en liten grupp ur två urval) byggs inte. Beslutet är
  dokumenterat i ADR-14. Organisationspaketet kan stänga av möjligheten (ADR-47). Rutan är
  då dold och avkryssad, och exporten utelämnar alltid små grupper (`explorerSmaIExport()`).
  Vaktas av exporttester i `tests/kanonymitet.test.js` (hela små grupper, kön under 10 i en
  större grupp, gruppvillkor, två dimensioner, rutan låst av paketet).

- **Kvartilfördelningen (EU-måtten)** redovisar bara gränserna mellan kvartilerna. En gräns är
  mittpunkten mellan den lägre kvartilens högsta och den högre kvartilens lägsta lön. Kvartilernas
  yttre löner redovisas aldrig, eftersom de för Q1 och Q4 är organisationens lägsta och högsta
  enskilda lön. Gäller fliken Lönestruktur och EU-lönerapporten; vaktas av
  enhetstest och röktest.
- **Medvetet undantag 3 — Personer att granska (ADR-23):** panelen i Lika arbete visar enskilda personer som
  ligger minst en vald procentsats under kollegor i samma AID och BAS. För varje person står kön, ålder, AID,
  BAS, lön, förväntad lön och filens radnummer. Som i Tabeller och egna vyer har den som använder verktyget
  redan rådatan. Men här finns **inget exportval**: listan har inga exportverktyg, ingår inte
  i någon export eller i rapportunderlaget och döljs vid utskrift. Panelens diagram är märkt
  utan export (`markeraUtanExport`, skälet `individer` i `11-diagramexport.js`). Därför tar varken
  exportmenyn, ZIP-filen, rapportunderlaget eller utskriften med det. DOM-invarianten
  undantar panelen. Ett eget test kräver att en flaggad persons lön inte finns i rapportunderlag eller
  Word-utkast, och därmed inte i PDF-rapporten, som ritas ur samma modell.
  Verifierat i webbläsare: en flaggad persons unika lön fanns inte i någon av Excel-exporterna (alla
  flikar, gemensam lönebedömning, handlingsplan, EU-rapport, likvärdighet). Den fanns inte heller i
  Word-utkastet, zip-filen, konfigurationsfilen, utskriften eller rapportunderlagets urklipp, och panelen döljs
  vid utskrift. Radnumret (`radnr`) är ingen ny identifierare men kopplar raden till
  källfilen. **Extremvärdeslistan** i Filer och kvalitet (*Underlagets kvalitet*) visar på samma sätt enskilda
  löner med radnummer. Den har inga exportverktyg, ingår inte i någon export eller bilaga och döljs vid
  utskrift av fliken (webbläsarröktestet kräver det).

- **Löneläget, överblicken (ADR-55):** organisationens P10, median och P90 per yrkesgrupp är gruppvärden och följer
  tröskeln i exportläget. Listan, bilden, talen, bladet *Referenser*, rapportavsnittet *Lönerna mot
  referenserna* och blocket i rapportunderlaget bygger alltså bara på grupper som når den. Referensernas egna tal och tabellen
  statistiken mot ställningstagandet bär inga organisationsvärden och maskeras inte. Könsuppdelade mått förekommer
  inte. Vaktas av `tests/smoke-referenser.test.js`.
- **Löneläget, statistikens matchning:** kolumnen *Matchning* (AID + BAS, Endast AID, –) i tabellen mot
  jämförelsestatistiken, i detaljlistan, i Excelfilerna (alla flikar, bladet *Referenser* och den samlade
  jämförelseexporten), i rapportens tabell, i rapportunderlagets block *Lönerna mot referenserna* och i utskriften,
  och sammanfattningen ovanför tabellen med antalet yrkesgrupper per matchningsnivå (också i *Beräkning & urval*).
  Utdatan säger bara hur statistiken matchades och hur många grupper som matchades; den bär inga lönemått. Den
  gäller samma rader som tabellen, så grupper under tröskeln syns inte och räknas inte. Vaktas av
  `tests/ktroskel-invarianter.test.js`, `tests/smoke-jamforelse.test.js` och `tests/smoke-referenser.test.js`.
- **Löneläget, överblickens diagram över statistikens spann** (`chart-jmf-statlage`): en punkt per yrkesgrupp
  AID×BAS med läget för organisationens median i statistikens spann (0 = P10, 100 = P90), med tips (yrke, BAS,
  läget, organisationens median, statistikens P10, median och P90, matchning, andel kvinnor, antal), bild och
  diagramdata. Diagrammet läser samma rader som tabellen mot jämförelsestatistiken (`jamforelseUnderlag`), som
  utesluter grupper under tröskeln, och visar inget som inte står i tabellen och bandkartan: läget räknas ur
  tabellens median, P10 och P90, och andelen kvinnor visas på samma sätt i bandkartans tips. Filtren på BAS och
  sektor gäller inte diagrammet. Vaktas av `tests/ktroskel-invarianter.test.js` (diagramdatan i exportläget vid 10
  och 25) och `tests/smoke-jamforelse.test.js` (bara grupper som når tröskeln, fylld och ofylld punkt).
- **Löneläget, avsnittet mot ställningstagandet:** i exportläget har avsnittet en mellannivå. För en yrkesgrupp
  med minst 5 men färre än tröskeln anges bara antal. Under 5 maskeras gruppen helt och namnges i en not.
  Lönemått och läget per kön kräver tröskeln. Bladet *Lönepolitik* i Excelfilen med alla flikar (och i ZIP-filens
  Excelfil) följer samma trappa och samma regel per kön. Vid tröskeln 5 eller lägre finns ingen
  mellannivå. Vaktas av `tests/ktroskel-kon.test.js` (bladet) och `tests/ktroskel-invarianter.test.js`.
- **Lönestruktur per BAS-intervall och Prioritering:** *Lönestruktur per BAS-intervall* i Word-utkastet och PDF-rapporten utelämnar
  BAS under tröskeln och namnger dem i en not. Prioritering visar skillnaden mellan könen i en grupp
  bara när båda könen når tröskeln. Annars räknas prioritetsindexet utan könsdel, så att
  poängen inte röjer den dolda skillnaden. Prioriteringens förslag om lägsta
  lönekvintilen kräver tröskeln för båda könen. Vaktas av `tests/ktroskel-utdata.test.js`, som läser
  flikarna, Word-utkastet och utskriften.
- **Löneskillnad per BAS, hela organisationen och Löneöversyn:** *Lönestruktur per BAS-intervall* visar skillnaden bara när
  båda könen når tröskeln, annars ett streck och en not. Könsuppdelade mått för hela
  organisationen följer samma regel. Löneöversyn maskerar kostnaden där medianerna maskeras och
  jämför bara mot mäns median när männen når tröskeln. Den ger en grupp egen rad på individnivån
  först när tröskeln i antal berörs, och tar bort förslag ur kandidatpar som inte längre når
  en höjd tröskel. Vaktas av `tests/ktroskel-invarianter.test.js` och `tests/ktroskel-regression.test.js` (egna tester och invarianten ovan).
- **Fasta golv (ADR-38; står kvar enligt beslut):**
  huvudregressionen i Lönestruktur körs när underlaget har 5 kvinnor och 5 män. Ett av
  Prioriteringens förslag skriver ut skillnaden i medelålder mellan könen vid 3 av varje kön
  (en ålder, inget lönemått). Löneöversiktens yrkesrader visas från 5 personer.
- **Egna riktade rader i Löneöversyn — tillåtna enligt beslut:** en
  riktad rad som användaren själv lägger till för en grupp under tröskeln visar sitt belopp på
  raden. Beloppet ingår i summorna på skärmen och i Löneöversyns Excel-export (*Använt*,
  *Riktat* och, när gruppen är kvinnodominerad, *Varav till kvinnodominerade grupper*). För en
  grupp med en enda person och ett påslag i procent är beloppet personens lön gånger
  procentsatsen. Det är användarens egen inmatning i en egen simulering och filtreras inte.
  Under raden står en not om att gruppen är under tröskeln och att beloppet bygger på enskildas
  löner. Kostnaden per grupp under tröskeln maskeras i exportens blad *Fördelning* (på skärmen visas
  den). Risken bärs av användaren, som redan har underlaget; filen ska hanteras som
  personuppgifter (§8).
- **Löneöversyns scenariojämförelse (A/B)** prövar den råa löneskillnaden mot den tröskel som gäller när
  jämförelsen visas (scenariot bär antalet kvinnor och män). Ett scenario sparat vid en lägre
  tröskel visar ett streck och en not när tröskeln har höjts.
- **Lönerevisionssimulatorn är borttagen (ADR-50, 2026-10-29):** det den kunde gör en riktad rad i
  Löneöversyn (kön, lönegräns, höj till). Raden följer regeln för egna rader ovan: en rad som berör
  färre personer än tröskeln visar beloppet med noten om enskildas löner. Löneskillnaden före och efter
  (organisationens råa löneskillnad) kräver tröskeln för varje kön. Vaktas av `tests/ktroskel-kon.test.js` (C3)
  och `tests/smoke-docx.test.js`.
- **Bilder med en punkt per person följer med (beslut 2026-10-16, ADR-48):** ZIP-exporten
  och utskriftens mall *Komplett rapport* bär bilder av Ålder & karriärs diagram med en punkt per person
  (§6.6). Ålder & karriär visar punkterna på skärmen. Bilderna bär inga namn eller identifierare, och filerna
  hanteras som personuppgifter (§8, punkt 1). Innehållet i en bild går inte att läsa i testet, så bilderna
  prövas inte av invarianten.
- **Löneöversyns tröskelmål följer tröskeln (beslut 2026-10-16, ADR-38 R5):** lyftet i
  procent till kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när varje kön i
  urvalet når tröskeln. Annars står ett streck med meningen om utelämnat könsuppdelat mått. Vaktas av
  `tests/troskelbeslut.test.js`.
- **Riktade rader ur en konfigurationsfil (beslut 2026-10-16):** filen bär på varje riktad
  rad uppgiften om raden föreslogs av verktyget ur kandidatpar i likvärdigt arbete (`kalla`). Då behandlas en
  inläst rad som den rad den var. Förslag prövas mot gällande tröskel vid inläsningen och rensas när tröskeln
  höjs. Egna rader står kvar med noten om att gruppen är under tröskeln. Vaktas av `tests/troskelbeslut.test.js`.
- **Varningen "underlaget är litet" i Prioriteringens motiveringsförslag** går vid färre än tröskeln av
  något kön (tidigare ett fast 5) och nämner tröskeln (beslut 2026-10-16).
- **Processöversiktens steg 4** blir inte klart när alla kandidatpar har en grupp under tröskeln: steget
  säger att inget finns att hantera i Att göra. Det säger också hur många par som bara redovisas i fliken
  Likvärdigt arbete, och leder dit (beslut 2026-10-16, ADR-29).
- **Tabellerna per AID-kod och BAS-intervall (ADR-57, 2026-11-05):** det gäller avsnitten *Lika arbete AID x BAS*
  och *Analys på individnivå* i Lika arbete, *Likvärdigt arbete* per BAS-intervall och *Hierarkisk jämförelse* i
  Likvärdigt arbete. Det gäller också de fyra Excel-bladen med samma namn. De bygger en rad per AID-kod och
  BAS-intervall ur varje persons egen rad (`src/lib/aidbas.js`). I exportläget får en grupp en egen rad från
  5 personer (`LITET_UNDERLAG`), med antal per kön men utan lönemått. Mindre grupper räknas upp i en not under
  tabellen med namn och antal, som i Lönelägets mellannivå ovan. Ett köns median, kvoten och slumpens gränser
  kräver tröskeln för varje kön. Gruppens median och lönespridning kräver tröskeln för gruppen (`statGolv()`).
  Annars står *Analyseras på individnivå*. Arbetslistan *Analys på individnivå* tar upp grupperna där något kön
  är under tröskeln, med antal men utan löner. Golvet 5 är ett avsiktligt avsteg i antal, inte i lönemått.
  Tabellerna är arbetsgivarens kartläggning av alla grupper, och lagen kräver att också små grupper analyseras.
  Därför står gruppen och dess antal i underlaget. På skärmen
  visas alla grupper (ADR-51). Vaktas av `tests/aidbas.test.js` och `tests/smoke-aidbas.test.js`; den allmänna
  invarianten (§11) prövar inte de fyra bladen.
- **Förklaringsmodellen (ADR-56, 2026-11-05):** valet av variabler i regressionen ändrar inte vilka grupper som
  syns. Men *Endast kön* (den ojusterade skillnaden) får inte vara huvudtalet när ett kön i underlaget ligger under
  den inställda tröskeln. Spärren följer `kInstalld()` oavsett läge, så att huvudtalet är detsamma på skärmen och i
  exporten. Panelen säger varför. Vaktas av `tests/smoke-innehall.test.js`.

- **Aggregerade analyser i Lönestruktur och Lika arbete (ADR-22, ADR-24, ADR-25):** *Var uppstår löneskillnaden?* (Lönestruktur)
  namnger en grupp bara när varje kön i gruppen och dess BAS når tröskeln. Dolda grupper redovisas
  bara med antal. Topplistan kortas tills summan av |belopp| för de andra poster som inte visas
  är minst hälften av varje dold posts belopp. Då kan en dold grupps bidrag inte räknas fram ur
  summorna. Går det inte redovisas inga delar, bara hela skillnaden. Kortet och rapportunderlaget
  visar samma poster. Stabilitetsmärkningen av flaggor bygger bara på grupper där båda könen når
  tröskeln. *Lägre krav, högre lön* tar i rapportunderlaget bara med par där båda grupperna når
  den. Analyserna har inga egna fält och inga egna exportvägar.

- **Ansvarsgrupper (ansvarskod enligt AID, ADR-33):** underraderna per
  ansvarsgrupp i Lika arbete följer samma k-regel som yrkesraden — under k visas inga
  lönemått, ett kön under k ger samlad median. Gruppdossiern visar bara antal per
  ansvarsgrupp och kön, aldrig lön. Sektorsöversiktens andel med ledningsansvar visas
  bara för kön med minst k personer. Vaktas av `tests/kanonymitet.test.js`.

### 6.6 Lokala exporter & utskrift ✔
- Excel/CSV/JSON-export via `Blob` + `<a download>` — lokal nedladdning, ingen
  uppladdning. PDF-rapporten skrivs ut ur sidan själv (`window.print()` på en dold utskriftsyta, `#print-report`,
  som töms av *Rensa all data*). Handlingsplanens mall och checklistan skrivs ut via lokalt
  `window.open`/`document.write` (about:blank, inga skript, inga nätverksanrop). Handlingsplanens Excel-fil,
  utskriften av mallen och Word-utkastets åtgärdstabell bär det som fyllts i på fliken (användarförfattad text, §2).
- **De fyra samlade exporterna har var sin uppgift:** Word-utkastet är rapporten och Excel-filen
  underlaget. PDF-rapporten är en låst kopia av Word-utkastet, ritad ur samma rapportmodell så att de två inte kan
  säga olika saker. ZIP-filen är allt: Word-utkastet, Excel-filen och bilder av diagrammen. Vid varje knapp
  står ett **förhandsbesked** om vad filen innehåller och vad den utelämnar (till exempel grupper under tröskeln).
- **Bladet *Referenser*** i Excelfilen (och i ZIP-filens Excelfil) byggs i exportläget ur samma rader som
  överblicken i Löneläget. Grupper under tröskeln får ingen rad (§6.5).
- **De fyra bladen per AID-kod och BAS-intervall** (*Lika arbete AID x BAS*, *Likvärdigt arbete*, *Hierarkisk
  jämförelse* och *Analys på individnivå*) finns i Excelfilen med alla flikar och i ZIP-filens Excelfil. De byggs
  i exportläget enligt §6.5. Lönemånaden från Inställningar (användarens fritext, §2) står på raden ovanför tabellen, och vald
  definition av kvinnodominerat (DO eller SCB) i bladet *Metodik*. Samma tabeller har Kopiera och CSV i flikarna
  (ADR-57).
- **Exportgrinden:** ingen export läser en tabell eller ett diagram ur en flik som är ritad
  med en äldre tröskel. När tröskeln ändras ritas bara den flik som syns om; övriga töms och ritas på nytt när de
  öppnas eller när en export behöver dem.
- **Word-utkastet**: redigerbar `.docx` (Office Open XML, packad med JSZip och
  nedladdad som lokal `Blob`; ADR-37). Den innehåller verktygets fynd **och användarens
  bedömningar i Regler & praxis**. Den innehåller också rapportmodellens diagram över grupper som bilder
  (`RM_DIAGRAM`, nedan). Filens metadata anger titel och "Öppen lönekartläggning" som
  skapare, inga namn. Demodata märks DEMODATA i både innehåll och filnamn.
- **Demomärkning av övriga exporter:** Excel-exporterna får en DEMODATA-rad i
  metodbladet; diagrambilder, diagramdata och tabellernas CSV får prefixet `DEMO_`
  i filnamnet.
- **Exportmeny på alla diagram**: PNG/SVG (bild) och diagramdata (CSV/urklipp). Undantaget är en behållare
  som är märkt utan export, med ett uppräknat skäl i `EXPORT_SKAL` (`11-diagramexport.js`): Personer att
  granskas diagram (ADR-23).
  Ingen exportväg — meny, bild, diagramdata, ZIP, rapportunderlag, utskrift — tar med ett märkt diagram.
  Vissa diagram har en punkt per person: spridningsdiagrammen lön mot ålder i Ålder & karriär, märkta
  `individer` i figuren. För dem är diagramdatan **en rad per person** (lön, kön, ålder eller grupp; inga namn
  eller identifierare). Filen säger det på rad 2: "Filen innehåller en rad per person (lön, kön, ålder
  eller grupp; inga namn eller identifierare) och ska hanteras som personuppgifter." (beslut
  2026-10-16). Lådorna i Tabeller och egna vyer (individpunkter, punktsvärm, regnmoln) exporteras som
  statistik per grupp, aldrig som individer. Sådana filer ska hanteras som personuppgifter (§8, punkt 1).
- **Diagrammens urval** (filterraderna ovanför diagrammen: knappar per BAS-intervall och andra kategorier, fälten
  Minst och Högst för ett tal som antal personer i gruppen) skapar ingen ny utdata: det döljer bara märken på
  skärmen och räknar inte om något tal. Diagrammets egen exportmeny (PNG/SVG) kan visa samma urval och säger det
  då i fotraden ("Urval i diagrammet: utan BAS A"); diagramdatan har alla rader och samma rad. Rapporten, Word, PDF, utskriften, ZIP-filen och rapportunderlaget är alltid fullständiga, och urvalet
  sparas inte i konfigurationsfilen.
- **Alla diagram** (underfliken i Tabeller och egna vyer, `74-alla-diagram.js`) skapar ingen ny utdata, men är en ny
  väg till diagrammens exportmeny. Varje diagram där är en kopia av ett diagram i en annan flik, ritad ur källans figur
  (`ut-diagram-<källans id>`), med egna filter och egen meny. Urvalet är detsamma som ZIP-filens (`diagramUrval`): bara
  diagram som är ritade, har något att visa och får lämna verktyget, och inte de som fliken döljer. En export ur
  kopians meny går genom exportgrinden till källan: källans flik ritas i exportläget och kopian får källans figur innan
  något läses, så att filen är densamma som ur källan, med källans stämpel om ett undantag (Likvärdigt arbete).
  Kopiorna följer inte med i ZIP-filen, och rapporten, utskriften och rapportunderlaget hämtar sina diagram med namn.
  k-invariantsviten prövar varje kopias diagramdata och kräver att den är källans, rad för rad.
- **Rapportunderlag via urklipp (ADR-20):** aggregerade faktastycken, tabeller och diagram kopieras
  för att klistras in i organisationens egen rapportmall. Blocken följer samma k-regel som Lika
  arbete, och kandidatpar med en grupp under tröskeln redovisas inte. *Kopiera alla avsnitt*
  kopierar samma k-skyddade block som de enskilda kopieringsknapparna. Det som kopieras
  ligger i operativsystemets urklipp. Urklippet kan synkas utanför datorn av operativsystemet
  eller av en urklippshanterare (Windows molnurklipp, Apples universella urklipp). Organisationen
  bör stänga av sådan synkning på de datorer som används (§8, punkt 7).
- **Formelskydd (ADR-15)**: i CSV-filer och urklipp får textceller som börjar med
  `=`, `+`, `-` eller `@` ett inledande `'`. Då kan en fientligt utformad lönefil
  inte få Excel att köra en formel. Tal lämnas orörda; `.xlsx`-exporten skriver
  text som textceller och berörs inte.
- **Export-känslighetsnotis**: vid filsparande visas en påminnelse om
  förvaringsdisciplin (behörighetsstyrd disk, ej okrypterad e-post). Notisen säger att filen innehåller
  lönedata och ska hanteras som personuppgifter; den lovar inte att filen bara innehåller aggregat.
- **Exporter som hör till ett undantag säger det:** de bär tillägget "Den här filen kan även innehålla
  grupper under tröskeln (undantag: …)". Det gäller likvärdighetsexportens CSV och metodblad och diagramdata
  från fliken Likvärdigt arbete. Det gäller också tabell-CSV:n, urklipp och diagramdata från Tabeller och egna
  vyer när rutan för små grupper är ikryssad. Diagramdata från diagram med en
  punkt per person bär raden om minsta gruppstorlek och raden om att filen innehåller en rad per
  person (ovan).
- **Bilder med enskilda personers löner i sammansatta utdata:** **ZIP-exporten** innehåller bilder av alla
  ritade diagram från alla flikar. Bland dem finns spridningsdiagrammen lön mot ålder (en punkt per anställd),
  de små multiplarna per BAS-intervall och låddiagrammet per kön. Lådan ritas bara för ett kön som når
  tröskeln (§6.5). ZIP-filen är alltså inte enbart aggregat. Spridningsdiagrammens bilder innehåller inga
  punkter för personer i grupper under tröskeln, eller vars kön är under tröskeln i gruppen. Låddiagrammets
  avvikare är kvar som enskilda löner utan yrke. **Word-utkastet och rapportens avsnitt innehåller inga diagram
  med en punkt per person.** Båda ritas ur rapportmodellen, vars diagram (`RM_DIAGRAM`) alla visar grupper.
  Det är kvoten per BAS-intervall, könsfördelning, lönekvartiler, oförklarad löneskillnad per BAS,
  kandidatparen, trattdiagrammet över yrkesgrupper, löneskillnaden per åldersgrupp och fördelningen i
  lönespannet per kön. **Utskriftens mall *Komplett rapport*** (hela dokumentationen) lägger till bilagor med
  flikarnas tabeller. Där finns också bilder av Ålder & karriärs spridningsdiagram, låddiagram och
  täthetsdiagram. De kortare urvalen (ledningsbrief, facklig dialog) gör det
  inte. **Beslut 2026-10-16 (ADR-48):** bilderna följer med i ZIP-exporten och i Komplett
  rapport. De bär inga namn eller identifierare, punkterna följer tröskeln som ovan, och filerna hanteras som
  personuppgifter (§8, punkt 1).
- **Vyerna per BAS-intervall, trattdiagrammet och fördelningarna per kön** följer tröskeln för varje kön:
  - Översikten per BAS-intervall (skärm, Word, PDF) har bara rader där båda könen når den.
  - Trattdiagrammet har bara yrkesgrupper där båda könen når den.
  - Lådorna över lönespridning per BAS-intervall och kön ritas bara för ett kön som når den, och utan enskilda
    avvikare (`avvikare: false`).
  - Löneskillnaden per åldersgrupp och fördelningen i spannets tredjedelar redovisas bara när båda könen når den.

  Testerna i `tests/diagramvyer*.test.js` prövar det för var och en, med ett kön eller en
  grupp under tröskeln som inte får finnas i figuren. Dessa vyer ingår i den allmänna invarianten på samma sätt
  som övriga flikar (de ritas när fliken ritas). Beräkningarna bakom översikten och trattdiagrammet hålls i
  minnet per underlag och tröskel (`_laMinne`) och släpps av *Rensa all data* och när statistiken
  ogiltigförklaras. Ett test kräver det.

### 6.7 Bundle-integritet ✔
- Reproducerbart bygge; SHA-256 i `RELEASE.txt`. Byggskydd avbryter vid mojibake
  och kör `node --check`. Verifiera SHA före driftsättning.

### 6.8 Konfigurationsfilen ("Spara/Läs in konfiguration") — innehåll
Konfig-JSON:en (**version 2**) innehåller tre slags uppgifter.

**Inställningar:**
- trösklar, vikter, kostnadsinställningar och bristyrken
- löneöversynens inställningar, där en riktad rad bär uppgiften om den föreslogs ur kandidatpar i likvärdigt arbete
- förklaringsmodellen (`forklaringsmodell`): vilka variabler regressionen räknar bort och skälet som fritext, kortad
  till 300 tecken. Ett ogiltigt värde ger standard med varning, aldrig fel (ADR-56).
- definitionen av kvinnodominerat (`likvardighet.kvDomDefinition`, DO eller SCB)
- vilka yrken som jämförs i likvärdigt arbete (`likvardighet.jamforelse`, `alla` eller `mansdominerade`, ADR-60)
- lönemånaden (`lonemanad`), fritext kortad till 40 tecken (ADR-57)
- om inläsningen ska stoppa vid förhandskontrollen (`forhandskontrollStopp`, sant eller falskt). Förhandskontrollens
  rader ingår inte.

**HR:s manuella arbete:**
- bedömningarna i Regler & praxis (status och anteckning per granskningsområde)
- handlingsplanens fält per rad (`handlingsplan`). Radens nyckel är källa, AID och BAS, eller `egen|` och ett slumpat
  id för en rad som lagts till på fliken. Till nyckeln hör sakligt skäl, ansvarig, tidsplan och status. En egen rad
  bär också sin åtgärd och berörda grupp som fritext. Rullistornas okända värden läses som tomma, och fritexten
  kortas till 500 tecken. En rad kan också bära sina **sakliga skäl** (`skal`): högst 8 skäl med kategori ur en
  fast lista, belopp i kronor per månad och en kommentar på högst 200 tecken. Kommentaren är fritext. Den prövas som övriga
  fritexter mot personnummer och e-post (`_hpLiknarPersonuppgift`), och dialogen varnar om den liknar en
  personuppgift. Ogiltiga skäl hoppas över vid inläsning med en varning. För en rad där ett kön är under minsta
  gruppstorlek står i exporterna (rapporten, Rapporttext, Word, PDF och Excel) och i årsbokslutet bara kategorierna:
  belopp, andel och kommentar utelämnas, med noten *belopp och kommentar utelämnade: ett kön har färre personer än minsta
  gruppstorlek*. Annars skulle beloppen avslöja hur stor en skillnad är som verktyget inte redovisar. Demots skäl tas bort när en riktig
  lönefil läses in.
- avbockningarna i Att göra (punkternas id, som innehåller AID-kod och BAS)
- organisationsnamnet och ett redigerat struktur-narrativ.

**Årsbokslutet** (ADR-54) och **importprofilerna:**
- nyckeltal för hela organisationen
- en rad per yrkesgrupp där båda könen når minsta gruppstorlek: antal per kön, medianer, löneskillnad och
  lönespridningen (P90 − P10) / median
- en rad per BAS-intervall med minst så många personer: antal, P10, median, P90 och lönespridningen.
  Könsmedianerna står bara med när båda könen når gränsen.
- Att göra-punkternas id, titel och läge.
- handlingsplanens sakliga skäl per grupp (version 2, `bedomningar`): nyckeln, gruppen, antalet, skillnaden och
  skälens kategori och belopp. Kommentarerna sparas inte i bokslutet. En grupp under minsta gruppstorlek faller
  bort. När den minsta gruppen bakom skillnaden är under gränsen stryks skillnaden och beloppen, och bara
  kategorierna står kvar. En nyckel som står två gånger läses en gång.

  Bokslutet byggs i exportläget med den inställda tröskeln. Vid inläsning stryks varje grupp där ett kön är under
  bokslutets k (`valideraArsbokslut`; vaktas av `tests/arsbokslut.test.js` och `tests/smoke-arsbokslut.test.js`).
- sessionens egna **importprofiler** (`importprofiler`, utelämnat när de saknas): profilens namn, rubriknamnen per
  fält och kännetecknen. Det är bara rubriknamn, inga värden ur filen. Id:t härleds ur namnet och kännetecknen och
  läses aldrig ur filen. Vid inläsning prövas varje text mot längden (80 tecken) och mot personnummer och e-post
  (`valideraImportprofil` i `src/lib/importprofiler.js`). En fil utan profiler tar inte bort sessionens.

`state.data` (individrader) ingår **aldrig**. Det är verifierat mot `buildConfigSnapshot()` i koden (ingen
`state.data`-referens). Organisationens namn och jämförelsestatistikens namn ingår. Det är användarens egna namn,
och text som liknar personnummer eller e-post avvisas. Organisationstypen (kommun, region eller båda) ingår som
inställning. Ansvarskoderna och ansvarskolumnens namn ingår inte heller (vaktas av röktest). Inte heller lönedata
eller anteckningar per år ingår (se §2 i teknisk-plan.md). Organisationspaketet ingår inte. Filen noterar bara
paketets organisation och datum. Paketets låsningar (ADR-47) ingår inte heller, så en konfigurationsfil kan varken
sätta eller häva en låsning. BAS-ordningen är fast och ingår inte i filen (se §5 i teknisk-plan.md).

Filen kan alltså innehålla inställningar och **användarförfattad text**. Den ska hanteras med samma disciplin som
övriga exportfiler (§8, punkt 1). Anteckningsfältens platshållartext påminner om att skriva på gruppnivå utan namn
eller personnummer. Handlingsplanens fritextfält varnar (utan att blockera) när texten liknar ett personnummer eller
en e-postadress. Skälet i förklaringsmodellen sparas inte från panelen när det liknar en sådan. Men vid inläsning av
en fil prövas det bara mot längden, som handlingsplanens fält. Import är transaktionell (tvåfas-validering) och
läser bara **version 2**. En korrupt fil eller en fil av annan version lämnar verktygets tillstånd orört (kastar
före någon mutation).

---

### 6.9 Organisationsfilen — verktyget med paketet inbakat
Systemägaren kan baka in organisationspaketet i verktygsfilen och sprida **en** fil
(`docs/utveckling/organisationsfil-design.md`). Paketet ligger som en inaktiv datablock
(`<template id="inbakat-organisationspaket">`) sist i filen, efter sista skriptet. Blocket tolkas inte och
exekveras inte. Inget skript ändras, och CSP:ns per-script-hashar är oförändrade (vaktas av
`tests/organisationsfil.test.js`: varje skriptblock är byte-identiskt före och efter). Vid start läses
blocket med samma validering som en inläst paketfil: godkända fält, textgränser och avvisning av text som liknar
personnummer eller e-post. Paketets låsningar (ADR-47) gäller. **Innehållet är exakt paketets:**
benämningar, inställningar, ställningstagande och jämförelsestatistik, aldrig rader ur en lönefil
(`skapaPaket()` läser aldrig `state.data`; röktestet kräver att organisationsfilen saknar lönefält). Filen
anger vilken version av verktyget den bygger på och verktygsfilens kontrollsumma. Någon verifiering av
organisationsfilen mot den publicerade versionen görs inte (beslut, ADR-49: filen kommer från
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
| B1b | Användaren skriver personuppgifter i fritextfält (anteckningar i Regler & praxis, handlingsplanens fält inklusive egna raders åtgärd och grupp, m.m.) | Låg–medel | Medel | Riktlinje i gränssnitt + körguide: "gruppnivå — inga namn/personnummer"; handlingsplanens fält varnar när texten liknar ett personnummer eller en e-postadress; texten lämnar verktyget endast via användarinitierade utdata | **Låg–medel** (organisatorisk, §8) |
| B2 | Re-identifiering i små grupper | Medel | Medel | k-anon (standard 10, kan ändras — ADR-38; sänkning kräver bekräftelse, ger stående varning och står i metodbilagan, i exporterad data och — under 10 — på varje del som kan spridas för sig) i deskriptiva vyer; undantaget för likvärdigt arbete dokumenterat; Tabeller och egna vyer visar små grupper men utelämnar dem ur export som standard (ADR-14); kvartilerna redovisar inga enskilda löner | **Medel** |
| B2b | Användaren sänker minsta gruppstorlek och sprider en export där små grupper redovisas | Låg–medel | Medel | Standard 10 gäller vid varje start (inget lagras); sänkning kräver bekräftelse, också ur konfigurationsfil och organisationspaket; varning som inte går att stänga på alla flikar, och en mening under rubriken i utskrift; värdet och meningen om sänkning står i exporterna (metodbilaga, diagramdata, tabell-CSV, rapportunderlag; under 10 även diagrambilder, urklipp och sidfötter), så att mottagaren ser det; en konfigurationsfil utan fältet sänker inte ett strängare värde; organisationen kan sätta egen standard i organisationspaketet och ett golv som fältet, konfigurationsfilen och ett senare paket inte kan gå under utan bekräftelse (ADR-47); paketet kan också stänga av att små grupper tas med i exporten från Tabeller och egna vyer | Kvarstår utan golv i paketet: verktyget kan inte hindra en behörig användare som bekräftar. Med golv kan tröskeln inte sänkas under det utan att ett nytt paket läses in och sänkningen bekräftas. Risken bärs av organisationens egna riktlinjer |
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
   restriktiv med att exportera resultat för mycket små grupper. I Tabeller och egna vyer
   betyder det att bara kryssa i "Ta med grupper under 10 i exporten" när det
   behövs. Var lika restriktiv med diagramdata från diagram som visar enskilda personer.
5. **Säkerställ HR-kompetens vid tolkning (B3, B4).** Verktyget identifierar
   *kandidater*; den juridiska bedömningen av sakliga skäl görs av människa och
   dokumenteras i rapporten.
6. **Var försiktig vid skärmdelning (B7).**
7. **Stäng av urklippssynkning (B1).** Tabeller, diagramdata och rapportunderlag som
   kopieras hamnar i operativsystemets urklipp. Urklippet kan synkas till molnet eller andra
   enheter (Windows molnurklipp, Apples universella urklipp, urklippshanterare). Stäng av
   sådan synkning på de datorer som används för lönekartläggningen.

## 9. Behövs en formell konsekvensbedömning (DPIA, art. 35)?

Lönekartläggning kan utgöra en *storskalig* behandling av personuppgifter och en
*systematisk bedömning* av personliga aspekter (lön). Det kan tala för att
arbetsgivaren bör göra en formell DPIA för **lönekartläggningsprocessen som
helhet**, inte minst för datauttaget ur personalsystemet och hanteringen av
slutrapporten.

**Detta verktyg är dock en lågrisk-komponent i den processen:** lokal bearbetning,
ingen lagring, ingen överföring, minimerad indata. Verktyget *minskar* den
tekniska risken jämfört med alternativ. Denna analys utgör underlag till
arbetsgivarens egen DPIA-bedömning men ersätter den inte. **Slutlig bedömning av
om en formell DPIA krävs görs av arbetsgivarens dataskyddsombud.**

## 10. De registrerades rättigheter

Verktyget lagrar och överför inga uppgifter. Därför hanteras de registrerades
rättigheter (tillgång, rättelse, radering m.m.) i **källsystemet** (personalsystemet)
och i arbetsgivarens dokumentation, inte i verktyget. I verktyget finns ingen
persistent kopia att begära ut eller radera. "Rensa all data" och fliksstängning
tar bort allt minne omedelbart. Verktyget gör inga utskick till de registrerade.

## 11. Verifiering

Varje påstående i detta dokument är prövat mot koden, med provkörning i jsdom och i Chromium.
Skyddet bevakas av drift-, golden-, röktest-, k-anonymitets-, dokumentations-, statistik- och
a11y-sviterna. Det bevakas också av ett röktest av det byggda verktyget i en riktig webbläsare
(`tools/browser-smoke.mjs`). Röktestet körs lokalt och i CI-arbetsflödet i
Chromium, Firefox och WebKit. Verifieringen visar också var skyddet är svagare än det kan se ut:
- lagringsspärren är en reserv med kända luckor (§6.2)
- PII-kontrollens värdekontroll läser ett sampel om 50 rader, spridda över filen (§6.4)
- hela filen ligger i minnet under inläsningen (§6.4)
- invarianterna prövar inte undantagen och diagrambilderna (§6.5).

**Granskningen 2026-10-19** prövade hela dokumentet — §0–§11 — mot `src/`, `tools/bundle.mjs`, det byggda
verktyget och testerna. Varje namngiven funktion, konstant, test och gräns söktes upp i koden:
- CSP-raden i bygget (ordagrant som §6.1, fem skript och fem hashar)
- listan över godkända fält, PII-kontrollens 50 rader och gränserna 3 och 5, och ansvarskodens 95 %
- BAS över J, paketets 200 tecken och 5 MB, rensningstidens 30 minuter och låsningens 5–120
- `K_STANDARD`, `statGolv()`, formelskyddet, exportmärkningen och konfigurationsfilens version 2
- att `buildConfigSnapshot()` och `skapaPaket()` inte läser `state.data`
- biblioteksfilernas kontrollsummor, och sökningen i dem och i `dist/app.js` efter nätverks- och lagringsanrop.

Tre påståenden som tidigare var engångskontroller är nu automatiska och prövade med en avsiktlig förändring.
Det första är att inga nätverksförfrågningar görs. Det andra är att injicerad kod och arbetstrådar stoppas
(röktestet; prövat mot en sida som navigerar ut och mot en kopia utan CSP). Det tredje är att bara de godkända
fälten hålls i minnet (`tests/smoke-ansvar.test.js`; prövat med en läckt kolumn). Granskningen fann att
extremvärdeslistan skrevs ut med Översikt, trots att dokumenten sade att den bara visas i verktyget. Den döljs nu
vid utskrift (§6.5). Verktygets egen text om Ålder & karriär sade att
punkterna per person alltid visas; den är rättad. A6 och §8 punkt 3 hänvisar nu till signaturen.
Röktestet kördes i Chromium, Firefox och WebKit.

**Granskningen 2026-11-02** prövade dokumentet mot koden som ändrats sedan föregående granskning (2026-10-21 till
2026-11-01: ADR-50–55 och gränssnittsgenomgången). Kontrollerat på nytt:
- CSP-raden i bygget (ordagrant som §6.1, fem skript och fem hashar)
- sökningen i `dist/app.js` och biblioteksfilerna efter nätverks- och lagringsanrop (träffarna är lagringsspärren
  och verktygets egen text; 0 `setItem` i biblioteken)
- att `buildConfigSnapshot()` inte läser `state.data` och att *Rensa all data* nollar `state.handlingsplan`
- testsviten med röktestet i Chromium.

Ett påstående ändrades: handlingsplanen kan nu få egna rader på fliken. Deras åtgärd och berörda grupp är
fritext som följer med i konfigurationsfilen (nyckel `egen|…`, kortad till 500 tecken, prövad vid inläsning).
Fritexten följer också med i handlingsplanens Excel-fil, Word-utkastets åtgärdstabell och rapportunderlaget,
på samma villkor som övriga fält. Varningen för text som liknar personnummer eller e-post gäller alla
fritextfält på fliken, och raderna bygger på det användaren skriver, inte på individdata (§2, §6.8, B1b).
Testsviten är 75 filer.

**Granskningen 2026-11-05** prövade dokumentet mot koden som ändrats sedan föregående granskning (2026-11-02 till
2026-11-05: ADR-56 valbar förklaringsmodell, ADR-57 tabellerna per AID-kod och BAS-intervall, och ikonerna utan
inbäddade bilder). Kontrollerat på nytt:
- CSP-raden i bygget (ordagrant som §6.1)
- att stilmallen inte längre har någon `url(`. Hänglåsen och sorteringspilarna var masker ur `data:`-adresser,
  som webbläsarens nätverkspanel visade som hämtningar fast inget lämnade datorn. Röktestet kräver nu att
  stilmallen saknar `url(`.
- att `buildConfigSnapshot()` inte läser `state.data`
- att *Rensa all data* nollar `state.forklaringsmodell` och `state.lonemanad` och tömmer de fyra tabellerna
- testsviten med röktestet i Chromium.

Tre påståenden tillkom:
- Konfigurationsfilen bär förklaringsmodellen med skälet som fritext, definitionen av kvinnodominerat och
  lönemånaden (§2, §6.8).
- Excel-filen har fyra blad per AID-kod och BAS-intervall. De ger en grupp en egen rad från 5 personer med antal
  men utan lönemått. Mindre grupper räknas upp i en not med namn och antal (§6.5, §6.6).
- Regressionens *Endast kön* spärras när ett kön ligger under tröskeln (§6.5).

Testsviten är 77 filer.

**Granskningen 2026-11-06** prövade dokumentet mot koden som ändrats sedan föregående granskning: spärren mot
särskilda kategorier av personuppgifter i `detectSensitiveColumns` (§2, §6.4). Mönstret i koden lästes mot texten.
Det fångar fackmedlemskap (fack följt av medlem, lig, förbund eller förening, och medlemskap som egen rubrik),
hälsa och hälsotillstånd, sjukfrånvaro, sjukskrivning och sjukdom, och diagnos. Det fångar också etnisk och
etnicitet, religion som eget ord och trosuppfattning, politisk, sexuell, funktionsnedsättning, genetisk och
biometri. Mönstret är avgränsat så att Sjukhus, Lönepolitik, Religionskunskap och Fackområde går fria. Bara
rubriken prövas, eftersom värdena saknar igenkännbart format. Rubrikkontrollen sker före värdekontrollen och
gäller lönefilen, som de andra rubrikmönstren. Prövat av
`tests/parsing.test.js` med 21 rubriker. Dataskyddsbeskrivningen (raden *Uppgifter som avvisas*) och datauttagsguiden
säger detsamma. Releasen bär dessutom en programvaruförteckning (`sbom.cdx.json`, CycloneDX) som signeras som de
andra filerna. Den innehåller biblioteksversioner och kontrollsummor, inga uppgifter om användare. Testsviten är
79 filer.

| Kontroll | Metod | Resultat |
|---|---|---|
| Ingen utgående trafik | Statisk sökning (fetch/XHR/WS/beacon/Worker/IndexedDB/Cache) + CSP-läsning + webbläsarröktestet, som registrerar varje förfrågan från alla sidor under en körning med alla flikar, utskriften och samtliga exporter | ✔ 0 verkliga anrop, 0 nätverksförfrågningar |
| CSP i bygget | Läsning av meta-taggen i bygget + körning i Chromium | ✔ ordagrant som §6.1; 5 skript, 5 hashar (`tools/bundle.mjs` skriver antalet vid varje bygge); `frame-ancestors` ignoreras i meta (dokumenterat) |
| Inga externa resurser | Sökning efter `<script src>` och http(s)-URL:er i bygget | ✔ 0 `<script src>`; träffarna är XML-namnrymder och kommentarer |
| Ingen lagring | Tripwire-kod + körning i Chromium: skrivförsök och läsning efter full körning | ✔ `setItem` och cookie kastar; allt tomt efter körning |
| Lagringsspärren | Automatiskt test i jsdom och röktest i Chromium och Firefox: `setItem` med olika nycklar, direkt tilldelning och `defineProperty`, i localStorage och sessionStorage; cookie; sökning efter `setItem` i biblioteksfilerna | ✔ varje skrivning kastar, inga undantag, inget lagras; ✔ 0 `setItem` i de fyra biblioteken (§6.2) |
| Web Workers | Webbläsarröktestet skapar en worker från `blob:` | ✔ avvisas av CSP (`script-src` som reserv för `worker-src`) |
| Rensning (lagringsminimering, art. 5.1 e och 25.2) | Invariant för båda rensningsvägarna (inkl. extremvärden och utskrift) + körning i Chromium (alla flikar, utskrift, rensa, ladda om) | ✔ inget lönevärde kvar i dokumentet eller minnet; allt ritas igen efter ny inläsning |
| Dataminimering | `ALLOWED_FIELDS` + `extractMinimalRecord` + test som läser in en fil med extra kolumner och kräver exakt de godkända fälten i minnet (`tests/smoke-ansvar.test.js`) | ✔ 5 obligatoriska fält + valfri poäng + valfri ansvarskod + radnummer (härledda `aid`/`yrkeLabel`/`ansvarsgrupp`); kolumnen *Ansvar* läses inte in |
| PII-avvisning | `detectSensitiveColumns` + körning i Chromium med PII-testfil; rubrikprov i jsdom | ✔ lönefilen avvisas (0 rader inlästa); policy-/statistikfil kontrolleras inte (dokumenterat, §6.4); ✔ rubrikerna *Förnamn* och *Fornamn* avvisas (§6.4); ✔ rubriker som antyder en särskild kategori (fackmedlemskap, hälsa, sjukfrånvaro, diagnos, etnicitet, religion, politisk tillhörighet, sexuell läggning, funktionsnedsättning, genetik, biometri) avvisas, prövat med 21 rubriker i `tests/parsing.test.js` (§6.4) |
| Namnmaskering | `_cleanYrkeField` + körning i Chromium | ✔ "101 Anna Andersson" → "101 ***" |
| k-anonymitet | `kTroskel()` + render-läsning vid 10, 25 och 5 (`tests/ktroskel.test.js` och `tests/ktroskel-hojning.test.js`) | ✔ standard 10, inställbart (ADR-38; undantag likvärdigt arbete dokumenterat) |
| k-anonymitet i exporten från Tabeller och egna vyer (ADR-14) | Exporttester i `tests/kanonymitet.test.js` + genomsökning i Chromium av alla kombinationer rad × kolumn × diagramtyp × helhet/per kön × mått med rutan urkryssad | ✔ inga grupper eller kön under 10 i tabell- eller diagramexport |
| Personer att granska och extremvärdeslistan stannar i verktyget (ADR-23) | Test i `tests/smoke-granssnitt.test.js` (en flaggad persons lön finns inte i rapportunderlag eller Word-utkast) + webbläsarröktestet (extremvärdeslistan med rader syns inte i utskrift) + kodläsning (inga exportverktyg; bilagorna hämtar bara namngivna tabeller) | ✔ lönen och radnumret finns inte i någon utdata; båda döljs vid utskrift |
| k-invarianten över flikar och exporter | `tests/ktroskel-invarianter.test.js`: underlag med ett kön under tröskeln i en större grupp, en ensam person och ett 2-mot-2-BAS; flikar, Word, utskrift ×3, rapportunderlag (med blocken per BAS-intervall), Excel ×9, CSV, diagramdata, gruppdossier, BAS-dossierns text (`basdossierText`), Rapporttextens utkast med delen per BAS-intervall, rapportens avsnitt Lönekartläggning per BAS-intervall och, med förra årets bokslut inläst, blocket och avsnittet om förra året (tabellen per BAS-intervall) och BAS-hantelns diagramdata, årsbokslutet i konfigurationsfilen med lönespridningen, rapportens bilaga med gruppdossierer och utskriften med bilagan vald, importprofilerna (JSON-exporten och konfigurationsfilen: inga lönemått) och diagramdatan ur kopiorna i Alla diagram (samma som källans, rad för rad) vid 10 och 25; handlingsplanens sakliga skäl vid 10 (I5: en rad under tröskeln för varken kommentarens tal eller beloppet ut i någon utdata utom skärmen och hela konfigurationsfilen, och en rad där ett kön är under tröskeln bara kategorin, också i konfigurationsfilens årsbokslut) | ✔ inget dolt värde i någon prövad utdata; undantagen och diagrambilder prövas inte; lönerevisionssimulatorn prövas med ett urval under och ett över tröskeln (simulatorn togs bort 2026-10-29, ADR-50; samma urval prövas nu som riktade rader i Löneöversyn, C3); Ålder & karriär per BAS och regressionens ojusterade steg prövas av egna tester i `tests/ktroskel-regression.test.js` (§6.5) |
| Importprofiler bär bara rubriknamn | `valideraImportprofil` i `src/lib/importprofiler.js` (godkända fält; varje text högst 80 tecken och inget som liknar personnummer eller e-post; högst 20 rubriker per fält, högst 50 profiler) vid inläsning ur konfigurationsfil och organisationspaket; `profilFranMappning` tar bara rubriker som finns i filen; tester i `tests/importprofiler.test.js` och `tests/importprofiler-app.test.js`, k-invariantsviten och webbläsarröktestet | ✔ ingen ny utdata lämnar verktyget utöver profilens JSON (exporten och konfigurationsfilens och paketets fält), och den bär inga värden ur filen |
| Kvartiler utan enskilda löner | Enhetstest, röktest, golden-facit + EU-exporten genomsökt i Chromium | ✔ varken lägsta eller högsta lön i fliken eller exporten |
| Formelskydd i CSV/urklipp (ADR-15) | Regressionstest (`tests/smoke.test.js`) + kodläsning av alla CSV-skrivare | ✔ `= + - @`-celler neutraliseras; tal orörda; mallfilen innehåller ingen användardata |
| Lokala exporter | Blob/`<a download>`/print-läsning | ✔ inga uppladdningar |
| Hash-baserad CSP (ADR-9) | Hash-jämförelse + webbläsarröktestet: injicerat `<script>`, inline-`onclick` och `<img onerror>`; skadlig text i lönefil och paket i jsdom (`tests/smoke-ansvar.test.js`) | ✔ ingen av dem exekverades; appen fullt funktionell |
| XSS-utdatakodning | `esc()` escapear `& < > " '` + regressionstester (`tests/parsing.test.js`) | ✔ säker även i attributkontext |
| Konfigfilens innehåll | Kodläsning av `buildConfigSnapshot()` och importen | ✔ ingen `state.data`-referens; inställningar (med förklaringsmodellen, definitionen av kvinnodominerat och lönemånaden) + användartext + avbockningar i Att göra (§6.8) + egna importprofiler (bara rubriknamn, validerade vid inläsning); import läser version 2 och avvisar andra versioner |
| Word-utkast lokalt | Kodläsning + live-test: Blob fångad, innehåll inspekterat; zip-filen läses tillbaka i röktesterna (ADR-37) | ✔ lokal `Blob` (`.docx`), DEMODATA-märkning fungerar |
| Tillgänglighet (markup) | axe-core i automatiska sviten (`tests/a11y.test.js`) | ✔ 0 överträdelser |
| Automatiska tester | `npm run test:full` (hela Vitest-sviten; kör om en fil vars arbetare kraschat i Node) + `npm run test:browser` (bygget i Chromium; samma röktest finns för Firefox och WebKit) | ✔ alla gröna |
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
Varje svar har täckning i avsnitt 1–11 ovan.

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
(ADR-9). Det är verifierat i körning: en injicerad inline-händelsehanterare kördes inte.
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
Beslutet ligger hos organisationens dataskyddsombud; denna analys är underlaget (§9).

**Vad är det känsligaste som kan lämna verktyget?**
Användarinitierade filer:
- Excel-underlag med gruppaggregat. Likvärdighetsexporten tar också med kandidatpar med små grupper (§6.5).
- Word-utkastet med HR:s egna bedömningar.
- Diagramdata från diagram som visar enskilda personer: en rad per person med lön, kön och ålder eller grupp,
  utan identifierare (§6.6).
- Konfigurationsfilen: inställningar och HR:s anteckningar, aldrig råa individrader (§6.8).

Samtliga
ska förvaras på behörighetsstyrd yta och inte skickas okrypterat (§8, punkt 1).

**Hur utvärderar vi utan att använda riktig lönedata?**
Använd demoläget ("Prova med demodata") — syntetisk exempeldata, tydligt märkt
DEMODATA i gränssnitt och alla exporter (§5). För provkörning med skarp data finns
`pilotchecklista.md` (checklistan för skarp data); för användarflödet `korguide.md`.
