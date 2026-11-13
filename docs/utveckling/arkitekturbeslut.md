# arkitekturbeslut.md — Öppen lönekartläggning: Arkitekturbeslut (ADR)

> Här står de arkitekturbeslut som gäller, med motiv och avvisade alternativ, så att en granskare inte
> återupptar dem utan ny kontext. Besluten är numrerade för att koden, testerna och dokumenten ska kunna peka på
> dem, och numren byts aldrig. Ett nummer som saknas i listan används inte. Syfte, avgränsning, dataskydd,
> teknisk plan och öppna punkter står i [`teknisk-plan.md`](teknisk-plan.md); en hänvisning som *teknisk-plan §5*
> pekar dit.

**Status:** *Gällande* betyder att beslutet gäller som det står. *Ändrad av ADR-x* betyder att ett senare beslut
ändrar en del av det; texten i det senare beslutet gäller där de skiljer sig. Datum står där beslutet har ett.

## Index

| Nr | Beslut | Status | Datum |
|---|---|---|---|
| ADR-1 | Web Worker avvisad | Gällande | – |
| ADR-2 | JS-minifiering avvisad | Gällande | – |
| ADR-4 | Byggskyddsnät | Gällande | – |
| ADR-5 | Kodhygien | Gällande | – |
| ADR-6 | `app.js` genereras från `src/app/`-moduler | Gällande | – |
| ADR-7 | Två lager röktest: jsdom och den byggda filen i riktiga webbläsare | Gällande | – |
| ADR-8 | lib-speglarna genereras från `src/lib/` | Gällande | – |
| ADR-9 | Hash-baserad CSP `script-src` | Gällande | – |
| ADR-10 | Sidopanelen är navigation, inte ARIA-tabs | Gällande | – |
| ADR-12 | K-anonymitetens redovisningsform: utelämna och namnge | Ändrad av ADR-51 | – |
| ADR-13 | `VERSION` är enda källa för versionsstämpeln | Gällande | – |
| ADR-14 | Tabeller och egna vyer visar små grupper; exporten utelämnar dem | Ändrad av ADR-51 | – |
| ADR-15 | Formler i CSV- och urklippsexport neutraliseras | Gällande | – |
| ADR-16 | Inga paragrafhänvisningar i gränssnittet, och sedan 2026-10-19 inte heller i hjälptexter eller exporter | Gällande | 2026-10-19 |
| ADR-17 | `runOLSRegression` får aldrig cachas | Gällande | – |
| ADR-19 | Underlagets kvalitet: svagaste länken avgör | Gällande | – |
| ADR-20 | Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget | Gällande | – |
| ADR-21 | Alla BAS-intervall ingår (upphävd begränsning) | Gällande | – |
| ADR-22 | Var uppstår löneskillnaden? Uppdelning på medellön | Ändrad av ADR-65 | – |
| ADR-23 | Personer att granska: individlista i verktyget, aldrig i utdata | Gällande | – |
| ADR-24 | Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering | Ändrad av ADR-59 | – |
| ADR-25 | Lägre krav, högre lön: jämförelse över BAS-gränserna | Gällande | – |
| ADR-28 | Organisationspaket; ingen inbyggd organisation | Gällande | – |
| ADR-29 | Ett steg är klart när dess punkter är hanterade | Ändrad av ADR-59 | – |
| ADR-30 | Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden | Gällande | – |
| ADR-31 | Interna fel rapporteras i stället för att sväljas | Gällande | – |
| ADR-33 | AID-hierarki, sektorsöversikt, ansvarskod och kodkvalitet | Gällande | – |
| ADR-34 | SKR:s personalstatistik som referens för kvinnoandel | Gällande | – |
| ADR-35 | Jämförelsestatistik: alla percentiler i en tabell och två diagram | Ändrad av ADR-55 | – |
| ADR-36 | Filrutorna syns alltid; namn på organisationen och jämförelsestatistiken | Gällande | – |
| ADR-37 | Word-utkastet som riktig .docx | Gällande | – |
| ADR-38 | K-tröskeln är en inställning | Ändrad av ADR-51 | – |
| ADR-39 | Diagramkärna på D3 med eget figurformat | Gällande | – |
| ADR-40 | Fyra exporter med var sin uppgift, ritade ur en rapportmodell | Gällande | – |
| ADR-41 | Flikmallen: resultatet först | Gällande | – |
| ADR-42 | Diagrammens form och färg väljs efter uppgiften; tabell med grafik i raden där ett diagram visar för lite | Gällande | – |
| ADR-43 | Färgerna har en källa | Gällande | – |
| ADR-44 | BAS som indikatorvariabler i huvudregressionen | Ändrad av ADR-53 och ADR-63 | – |
| ADR-45 | t-kvantiler för konfidensintervallen; exakt t-fördelning | Gällande | – |
| ADR-46 | Steget *+ Yrkesgrupp*: könsgapet med fasta effekter för yrkesgrupp inom BAS | Ändrad av ADR-56 | – |
| ADR-47 | Organisationspaketet kan låsa tre skydd | Gällande | – |
| ADR-48 | Bilder med en punkt per person följer med i ZIP och Komplett rapport | Gällande | 2026-10-16 |
| ADR-49 | Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida | Gällande | – |
| ADR-50 | Prioritering är vad, Löneöversyn är hur | Gällande | 2026-10-29 |
| ADR-51 | Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen | Gällande | 2026-10-29 |
| ADR-52 | Egna tabeller i rapporten som recept, inte tal | Gällande | 2026-10-29 |
| ADR-53 | Blinder-Oaxaca med BAS som indikatorer | Gällande | 2026-10-29 |
| ADR-54 | Jämförelse mellan år genom ett årsbokslut i konfigurationsfilen | Gällande | 2026-10-30 |
| ADR-55 | Löneläget mot båda referenserna, Lönepolitik som avsnitt | Gällande | 2026-10-30 |
| ADR-56 | Valbar förklaringsmodell | Gällande | 2026-11-05 |
| ADR-57 | Tabellerna per AID-kod och BAS-intervall | Gällande | 2026-11-05 |
| ADR-58 | BAS-dossiern: ett BAS-intervall på en sida | Gällande | 2026-11-06 |
| ADR-59 | Uppmärksamhetstrappan på statistisk signal, direktivmarkeringen åtskild | Gällande | 2026-11-08 |
| ADR-60 | Jämförelseyrkena i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av kvinnodominerat | Gällande | 2026-11-08 |
| ADR-61 | Minsta skillnad 0 % som standard i likvärdigt arbete | Gällande | 2026-11-08 |
| ADR-62 | Prioriteringens egna ord för läget mot referensen | Gällande | 2026-11-08 |
| ADR-63 | Kvantilregressionen på huvudmodellens design, villkorad tolkning | Gällande | 2026-11-08 |
| ADR-64 | Ålder är valfri i lönefilen | Gällande | 2026-11-08 |
| ADR-65 | Var uppstår löneskillnaden: valbara förklaringsvariabler | Gällande | 2026-11-10 |

## Besluten

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
smalt och verkligt. Båda körs i CI. Webbläsartestets kontroller ligger per område i `tools/browser-smoke/` med en
gemensam rigg (`rigg.mjs`); `tools/browser-smoke.mjs` kör dem i en fast ordning och skriver sammanfattningen.

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
har `'unsafe-inline'` och går inte att köra direkt (teknisk-plan §6); kör alltid det byggda verktyget.
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
i EU-matrisen kan en liten organisation få en tabell som nästan bara består av maskerade celler. Redovisningsformen
gäller det som lämnar verktyget; skärmen maskerar inga grupper (ADR-51). Därför gäller:

1. **Hela gruppen under tröskeln** → raden utelämnas, och gruppen räknas upp **med namn** i en not vid tabellen
   (`kMaskNote()`). Handläggaren ser exakt vad som saknas och varför. Personerna ingår fortfarande i underlaget
   och i totalsummorna.
2. **Bara könsuppdelningen för liten**, medan gruppen som helhet ligger över tröskeln → gruppens **samlade
   median** redovisas (`kSamladNote()`). Den bygger på n ≥ `kTroskel()` och röjer ingen enskild, men ger ändå
   ett lönemått att förhålla sig till. Könsjämförelsen utgår, med förklaring.

Punkt 2 är inte en uppmjukning av skyddet utan ett erkännande av att `anyMasked` och `isKMasked(gruppen)` är
olika saker. I EU-matrisen har grupperna ofta 14–17 personer men bara 2–3 av ena könet; att utelämna dem skulle
tömma hela tabellen. Tabellerna per AID-kod och BAS-intervall har ett avsiktligt avsteg: där kräver en egen rad
minst fem personer i exportläget, inte tröskeln (ADR-57).

Noterna innehåller avsiktligt **ingen inline-markup**: SheetJS trimmar varje elements text för sig och slår ihop
dem utan avskiljare, vilket ger `4 yrkesgruppervisas` i Excel-exporten. Skyddet vaktas av invarianten I4
(`tests/helpers/ktroskel-invariant.js`).

**ADR-13 — `VERSION` är enda källa för versionsstämpeln.** Versionsstämpeln (`APP_VERSION`, `APP_BUILD_DATE`)
syns i rapportens sidfot och i Excel- och Word-metadata — det som gör ett resultat spårbart till en
beräkningsversion i arbetsgivarens lönekartläggning. `src/app/08-version.js` genereras ur `VERSION` av
`tools/gen-version.mjs`, som både `build-app.mjs` och `bundle.mjs` kör. Build-datumet **härleds ur versionen**
(CalVer = byggdatum), inte ur systemklockan: ett `new Date()` skulle ge ny SHA-256 vid varje bygge och slå
sönder artefaktgrinden i CI.

Golden-testerna normaliserar versionen till `<VERSION>` för att slippa snapshot-churn och kan därför inte fånga
drift här. En egen vakt, `tests/version.test.js`, hävdar att stämpeln följer `VERSION` och att ingen annan
`src/app`-modul hårdkodar en versionssträng.

**ADR-14 — Tabeller och egna vyer visar små grupper; exporten utelämnar dem.** Den som använder verktyget har redan rådatan.
K-skyddet finns mot *läckage*, alltså det som lämnar verktyget. I Tabeller och egna vyer (fliken `utforska`) gäller därför:

1. Alla grupper visas. (Markeringen av grupper under tröskeln på skärmen — ränder, streckad kant, kursiv —
   utgick med ADR-51: skärmens tröskel är 1, så ingen grupp är liten där. I exportläget får små celler
   klassen `explore-liten`, som exporten läser.)
2. Exporten — tabellens CSV/urklipp och diagrammets exportmeny — utelämnar dem, och könsvärden och gap där ena
   könet är under tröskeln, om inte användaren kryssar i "Ta med grupper under k i exporten" (k är tröskelns värde). Regeln bor
   i `src/lib/utforska.js` (markeringen `liten`/`konLiten`) och i `71-utforska-figur.js` (`_explorerVisible`).
3. Diagram med enskilda personers löner (individpunkter) är tillåtna i Tabeller och egna vyer, även i export, och följer
   rutan för små grupper. Utanför Tabeller och egna vyer ritas och exporteras en persons punkt i ett spridningsdiagram bara
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
som `-3,2 %` eller `-1 250 kr` — lämnas orörda, så att de fortfarande blir tal i Excel. Ett tal som börjar
med minustecknet `−` (U+2212), som tabellerna skriver, skrivs med `-` i CSV och urklipp, eftersom Excel annars läser
cellen som text; text med `−` som inte är ett tal står kvar. Regeln bor i
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
memoisering inuti modulen. Det som är tillåtet är att en funktion som kört regressionen skickar resultatet vidare
som ett argument till det den själv anropar i samma varv (`bedomningUnderlag({ reg })`, Att göras lista): ett
värde, ingen lagring, inget att invalidera. Förhandsbeskedets minne i `58-rapportmodell.js` är inte en sådan cache: det
bär bara avsnittens id, rubriker, delarnas typ och de utelämnade texterna (aggregerade antal; inga personrader och
inga resultat), används bara när ett kryss i urvalet ändras och ingen fil ritas ur det.

**ADR-19 — Underlagets kvalitet: svagaste länken avgör.** Underlaget bedöms med fem kriterier med status
OK/Varning/Kritisk: jämförbarhet (andel av personalen i BAS-intervall där båda könen har minst k), statistisk
styrka (minsta upptäckbara könsskillnad ur regressionens robusta standardfel), fullständighet (bortfall vid
inläsning), rimlighet och modell. Helheten är det sämsta kriteriet, så att en allvarlig brist inte späds ut
(som den skulle i en viktad summa). Könsfördelningen i organisationen är ett fynd, inte ett kvalitetsmått.
Logiken bor i `src/lib/datakvalitet.js` och vaktas av `tests/datakvalitet.test.js`. Kompliansöversikten och
åtgärdslistan räknar bara jämförbara BAS-intervall (samma regel), så att en röd ruta aldrig står bredvid en tom
åtgärdslista. I Filer och kvalitet är panelen sammanfattad på en rad och fälls ut när något kriterium är Varning eller
Kritisk (ADR-36).

**ADR-20 — Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget.** Rapporten skrivs i
organisationens egen Word-mall, och det som tar tid är att föra över siffror och tabeller. Panelen
Rapportunderlag i fliken Rapporttext ger kopierbara block: avsnitten sammanfattning, lika arbete, likvärdigt arbete,
struktur och handlingsplan, *Var uppstår löneskillnaden?* (ADR-22), *Lägre krav, högre lön* (ADR-25) och
sektorsavsnittet (ADR-33), ett block per yrkesgrupp med skillnad över 5 % och ett per kandidatpar — med
faktastycke, ren tabell, vad som redan är prövat (ålder och BAS inom yrket) och frågor till verksamheten — samt
diagram som bild. Kopiering sker via urklipp som formaterad text utan typsnitt och färger, så att mallens format
tar över; reserven är markering respektive PNG-nedladdning. Rapportunderlaget är block att klistra in; det
samlade Word-utkastet är en egen export (ADR-37, ADR-40). Bedömningen av sakliga skäl kräver kunskap som bara
verksamheten har (uppdrag, prestation) och skrivs utanför verktyget (teknisk-plan §2). Gruppurvalet bor i
`src/lib/rapportunderlag.js` och används också av Lika arbetes EU-tabell. Underlaget följer k-regeln strikt:
kandidatpar med en grupp under tröskeln får inget block, fast fliken Likvärdigt arbete är undantagen.

**ADR-21 — Alla BAS-intervall ingår (upphävd begränsning).** Till och med 2026.10.19 analyserades bara BAS A–J;
personer i K och högre räknades men uteslöts. Efter användartest ingår all personal: lönekartläggningen ska
omfatta hela organisationen, och chefsnivåerna är ofta de grupper där könsskillnaden är störst. Rimlighetskontrollen
kräver bara att BAS är en bokstav; små intervall skyddas av minsta gruppstorlek vid export.

**ADR-22 — Var uppstår löneskillnaden? Uppdelning på medellön.** Blinder-Oaxaca säger hur stor del av gapet som
är "förklarat", men inte var det uppstår. Ett avsnitt i Lönestruktur och ett block i rapportunderlaget (efter
Sammanfattning) delar därför skillnaden i medellön, kvinnor minus män (negativ när kvinnor ligger lägre, som
överallt i verktyget), i tre delar som summerar exakt:
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
redovisas inga delar, bara hela skillnaden. Avsnittet och rapportunderlaget visar samma poster. Logiken i
`src/lib/gapuppdelning.js`.

**ADR-23 — Personer att granska: individlista i verktyget, aldrig i utdata.** Den tredje delen i ADR-22
(lön inom samma AID och BAS) säger hur mycket av gapet som ligger inom samma AID och BAS, men inte hos vilka. Panelen Personer att granska i Lika arbete listar personer vars
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
(`markeraUtanExport` med skälet `individer`, ADR-39). k-invarianten undantar panelen på samma sätt som Tabeller och egna vyer; ett eget test kräver att en
flaggad persons lön inte finns i utdata. Logiken i `src/lib/individflaggor.js`.

**ADR-24 — Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering.** I små yrkesgrupper kan en enda
persons lön avgöra om skillnaden i medianlön hamnar över eller under verktygets storleksgräns 3 % (ADR-59). Varje
flaggad grupp prövas därför: kan skillnaden hamna under 3 % om en respektive två personer tas bort? Gruppen märks
*skör* (1 eller 2 personer) eller *stabil* i tabellen och i rapportunderlagets gruppblock. **Flaggan ligger kvar**
— märkningen ändrar inte gruppens status och verktyget släpper inte grupper; den visar var enskilda löner avgör
utfallet. Direktivmarkeringen vid 5 % är något annat och prövas inte här (ADR-59). **Exakt
värsta fall:** en median beror bara på hur många värden som ligger på vardera sida, så det räcker att pröva
ytterlägena och positionerna inom 2 från medianen i de sorterade lönelistorna (att ta bort själva medianvärdet
kan ge det läge som kommer närmast lika lön). Metoden är verifierad mot uttömmande prövning av alla 1- och
2-borttagningar på 200 slumpade grupper. Borttagningar som skulle lämna ett kön med färre än k personer prövas
inte; ett kön med exakt k anges ("prövat bara på män/kvinnor"). Kunde bara en borttagning prövas (ett kön har
exakt k, det andra k + 1) säger märkningen det i stället för att påstå att två prövats. Kontrollen prövar datan;
robusthetspanelen i Exportera prövar inställningarna. Logiken i `likaArbeteGrupper`
(`src/lib/rapportunderlag.js`).

**ADR-25 — Lägre krav, högre lön: jämförelse över BAS-gränserna.** Med BAS som krav-proxy bildas kandidatparen
bara inom samma BAS, så lagens "likvärdiga **eller lägre** krav" fångas inte av dem. Likvärdigt arbete har
därför en **egen lista**, *Lägre krav, högre lön*: kvinnodominerade yrken med lägre medianlön än ett av
**organisationens egna** yrken som inte är kvinnodominerade (ADR-60) i strikt lägre BAS. Ingen reserv ur jämförelsestatistiken:
en jämförelse över BAS-gränsen mot extern statistik blir dubbelt osäker. Alla lägre BAS ingår, med antalet
BAS-steg utskrivet; BAS-rangen är bokstavsordningen (teknisk-plan §5). Samma `minGapPct` och bootstrap-KI som kandidatparen.
Listan är egen för att kandidatparen och allt som bygger på dem — handlingsplan, JPA, exporten, värmekartan —
inte ska bero på den, och för att den vilar helt på att BAS-ordningen speglar kraven. Poängläget beräknar inte
listan: där jämför kandidatparen redan över BAS-gränserna. Rapportunderlaget har ett eget block efter
Likvärdigt arbete (par där båda grupperna har minst k personer, med frågorna till verksamheten). Logiken i
`byggParLagreKrav` (`src/lib/likvardighet.js`).

**ADR-28 — Organisationspaket; ingen inbyggd organisation.** Verktyget ska kunna användas av vilken arbetsgivare
som helst och har därför ingen inbyggd organisation och ingen inbyggd referens. Utan ställningstagande visar
Prioritering, avsnittet *Mot ställningstagandet* i Löneläget (ADR-55) och statusrutan ett tomläge; profilen är neutral ("Er organisation",
"jämförelsestatistiken"); inga interna namn bär ett organisationsprefix. Demoläget har en påhittad
*Exempelkommunen* med påhittat ställningstagande.

En systemägare samlar organisationens benämningar, grundinställningar (PO-påslag, period, minsta
gruppstorlek), ställningstagande och jämförelsestatistik i ett **organisationspaket** — en JSON-fil
(`.lonepaket.json`, version 1) som skapas och läses i verktyget (panelen *Organisationspaket* i Filer och kvalitet), så
att handläggaren läser in allt i ett steg. Bara vitlistade fält läses; paketet avvisas om det innehåller något
som liknar personnummer eller e-post; det innehåller bara aggregat och lagras aldrig. Exporter och Word-utkast
anger referensens och statistikens källa (egen fil, organisationspaket med organisation och datum, eller
demoläge). Reserven för kvinnoandel är SKR:s personalstatistik (ADR-34).

Verktyget är neutralt: ingen namngiven organisation eller arbetsgivare står i repot (`.github/CONTRIBUTING.md`,
`CLAUDE.md`); allt organisationsspecifikt kommer från användarens egna filer. Logiken i `src/lib/organisationspaket.js`,
gränssnittet i `src/app/29-organisationspaket.js`; systemägarens guide `docs/anvandare/organisationspaket.md`.

Paketet har det valfria fältet `importprofiler` (2026-11-07): sparade kolumnmappningar som bara bär rubriknamn
(`src/lib/importprofiler.js`; högst 80 tecken per text, inget som liknar personnummer eller e-post, högst 20
rubriker per fält och högst 50 profiler). Profilerna prövas vid inläsning av lönefilen i ordningen
organisationspaketet, konfigurationsfilen, de inbyggda och sist delsträngarna i `ALLOWED_FIELDS`. Verktyget har inga
inbyggda profiler för namngivna lönesystem, bara för sina egna format (CSV-mallen, testdatan, demodatans fältnamn);
profiler för lönesystemen kommer från organisationerna, via paketet eller som prövade bidrag.

**ADR-29 — Ett steg är klart när dess punkter är hanterade.** Processöversikten markerar ett steg som klart när
arbetet med det är gjort, inte när analysen har körts — annars står steget som klart precis när arbetet börjar.
Steg 3 (Lika arbete) är klart när regressionen gått att köra och alla punkter i Att göra i kategorierna *Lika
arbete* och *Lika arbete, fördjupning* (ADR-59) är avbockade; steg 4 (Likvärdigt arbete) är klart när analysen inte hittar några
kandidatpar eller när alla kandidatpar i Att göra är avbockade. Har analysen bara par med en grupp under
tröskeln (de redovisas bara i fliken Likvärdigt arbete) är steget inte klart utan har tillståndet *inget att
hantera* med antalet par och en hänvisning till fliken (beslut 2026-10-16). Att göra tar med
kandidatparen även utan jämförelsestatistik (paren kommer i första hand ur organisationens egna yrken). *Börja här* sorterar inom samma
prioritet: underlaget först, sedan de könsrelaterade fynden, sist läget mot referenserna (*Löneläge mot referens*) och övriga
iakttagelser. Reglerna bor i `src/lib/attgora.js`. **Vakter:** `tests/attgora.test.js` och `tests/smoke-innehall.test.js`.

**ADR-30 — Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden.** Verktyget hade omkring
780 `style="…"` i sidans skal och i flikarnas mallar, och fick därför ha inline-CSS i attribut tillåten. De är nu
flyttade till klasser i stilmallen (layout, avstånd och text till ett namngivet hjälpklassbibliotek, teknisk-plan §6; färgerna till klasser per status, ADR-43; uträknade mått till `data-stil-*`
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
fyra första. Sektorerna är en **översikt** (avsnittet *Per sektor* i Lönestruktur, Excel-blad,
rapportunderlag) och en dimension och ett urvalsvillkor i Tabeller och egna vyer — inte ett globalt filter, eftersom ett
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
Tabeller och egna vyer**, aldrig i Lika arbete, där yrket är jämförelseenheten. **Kodkvaliteten** prövas i Underlagets
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
**Var den står:** sedan ADR-55 är jämförelsen mot statistiken avsnittet *Mot jämförelsestatistiken* i fliken
Löneläget, låst till statistiken, och jämförelsen mot ställningstagandet är ett eget avsnitt i samma flik (*Mot
ställningstagandet*).
**Vakter:** `tests/jamforelse.test.js`, röktesterna för fliken och diagrammen, k-testerna för export, tabell och
diagramdata, golden för den samlade exporten och webbläsartestet.

**ADR-36 — Filrutorna syns alltid; namn på organisationen och jämförelsestatistiken.** De tre
filrutorna syns alltid, så att ställningstagandet och jämförelsestatistiken aldrig döljs bakom en hopfälld rad.
Efter inläsning är de kompakta (filnamn, namnfält, *Byt fil*, för lönefilen även *Kolumnmappning*), och
släppytan och hjälptexten visas bara innan en fil är inläst. Demots ställningstagande markerar sin ruta.
Organisationspaketet ligger som en ihopfälld rad som visar organisationstypen. Filrutorna, Underlagets kvalitet och
extremvärdena står i fliken Filer och kvalitet; Översikt visar efter inläsning en rad om vad som är inläst (med
knappen till Filer och kvalitet), nyckeltalen, Att göra och processen. *Var uppstår löneskillnaden?* står i Lönestruktur.
**Underlagets kvalitet** är sammanfattad på en rad ("n av m kriterier OK" och avvikelserna) med detaljerna —
kriterierna, rimligheten, inläsningen, extremvärdena och konsistensrutan — i en `<details>` som är utfälld när
något kriterium är Varning eller Kritisk. Välkomstrutan är en rad, och *Prova med demodata* finns bara där.
**Namnen:** organisationens namn lagras i `profile.name` och jämförelsestatistikens i `profile.benchmarkLabel`
(genitiv och kortform räknas fram, `src/lib/namn.js`). `orgNamn(standard)` och `jmfNamn(standard)` är enda
källan för etiketterna — diagramserier, tabell- och Excelrubriker, beräkningsbevis — medan löptext står kvar.
Utan namn används standardetiketterna. Fältet i lönefilens ruta och fältet *Organisation* i Exportera är samma namn, och
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
(beslut): huvudregressionen (Lönestruktur) med 5 av varje kön, motiveringsregeln om medelålder
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
förslag, mål-läge och känslighetskurva samt robusthetspanelen i Exportera (`robusthetLikvardighet`
i `85-robusthet-fardigcheck.js`: par med en grupp under tröskeln namnges inte i någon körning, och panelen anger
antalet sådana par; beslut). Fyra regler till:

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
  (alla BAS eller det valda) kräver att urvalet når tröskeln (beslut 2026-10-16); annars
  utelämnas de och noten under diagrammet säger det. Punkterna per person följer sin egen regel (ADR-14).
- (R4) *Lönerevisionssimulatorn är borttagen (2026-10, ADR-50).* Det den kunde — begränsa till ett kön och en
  lönegräns, "höj till" — gör en riktad rad i Löneöversyn, som följer R2: en rad som berör färre personer än
  tröskeln är användarens egen simulering, beloppet visas på raden med noten om enskildas löner. Lönegapet
  före och efter kräver tröskeln för varje kön (`_konFarRedovisasFor`). Vaktas av C3 och röktest.
- (R5) *Löneöversyns tröskelmål följer tröskeln* (`_forecastThreshold`; beslut 2026-10-16):
  lyftet i procent till kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när
  varje kön i urvalet når tröskeln (`_konFarRedovisasFor`), annars ett streck med `_konUtelamnatNot()`.
  Vaktas av `tests/troskelbeslut.test.js`.

**Vakter:** `tests/ktroskel*.test.js` (flera filer med gemensam rigg i `tests/helpers/ktroskel-rigg.js`) kör alla flikar vid 10, 25 och 5 med grupper om 20 och 6 personer vars
löner är sentinelvärden, prövar tur och retur 10 → 25 → 10 mot kvarlevande cacher, kontrollerar flikar och Excel
efter en höjning, gränssnittet, utdata genom de verkliga vägarna, varje exportväg mot exportgrinden samt
konfigurationsfil och organisationspaket, och har en invariant vid 10 och 25 över flikar och exporter mot ett
underlag där ett kön är under tröskeln inuti en större grupp (vad den prövar och inte prövar står i
`riskanalys.md` §6.5 och i testfilens kommentar). Den ritar menyns flikar i exportläget, och `tests/ktroskel-exporter.test.js`
kräver att riggens lista över flikar är menyns; `tests/dokumentation.test.js` vaktar att dokumenten nämner ADR-38.

**ADR-39 — Diagramkärna på D3 med eget figurformat.** Alla diagram ritas av en egen kärna: vyerna bygger en
*figur* (ren data: axlar, lager av märken, referenser — `src/lib/figur.js`), och `ritaFigur` gör SVG av den med
D3 7.9.2. Kärnan består av tre moduler — mått och layout i `src/app/10-diagramlayout.js`, märkena, färgskalan
och referenserna i `src/app/10-diagrammarken.js`, och ritaren med sidans API, registret och exporten i
`src/app/10-diagramritare.js` — med palett och typografi i `src/app/10-diagramtema.js` och exportmenyn i
`src/app/11-diagramexport.js`. Det egna formatet valdes framför D3 direkt i varje vy eftersom varje datapunkt då
kan bära gruppnyckel och `liten`-flagga, så att skyddet ligger på ett ställe. Kärnan som den är byggd —
formatet, `ritaFigur`, exporten, rensningen, vyernas skyldigheter och kända luckor — beskrivs i
`docs/utveckling/diagramkarnan.md`.

**Skyddet för små grupper är en egenskap hos kärnan:** `ritaFigur` ritar inte datapunkter märkta `liten` om inte
vyn begär det (bara Tabeller och egna vyer, ADR-14), och då med ränder och streckad kant, så att markeringen inte bara bärs av
färg (WCAG 1.4.1). Exporterade bilder ritas utan små grupper och diagramdata filtreras med `utanSmaGrupper`, om
inte vyn uttryckligen begär annat (`exportMedSma`, kryssrutan i Tabeller och egna vyer). Skyddet vaktas av två
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
där `skal` måste vara en nyckel i `EXPORT_SKAL` (i dag bara `individer`: Personer att granska, ADR-23), och skälet står i behållarens verktygstips ("Lämnar inte
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
  BAS-intervall är markerat — "Visa yrkesgrupperna", som öppnar Tabeller och egna vyer med urvalet satt till intervallet.
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
  "(undantag: valt i Tabeller och egna vyer)" bara när exporten faktiskt bär små grupper.
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
Urvalet av avsnitt (hela dokumentationen, ledningsbrief, facklig dialog eller eget) gäller båda. Ett avsnitt kan
vara förvalt av (`RM_FORVALT_AV`): *Bilaga: gruppdossierer* (`rmDossierAvsnitt`, en gruppdossier per yrkesgrupp där
båda könen når k, i exportläget) står i listan men följer med först när det kryssas i, och hela dokumentationen
räknas som hel utan det (`rmArHelaDokumentationen`). Lönegapet
skrivs i exporterna som på skärmen: kvinnors lön i procent av mäns — utom i EU-lönerapporten och rapportens
avsnitt om lönetransparens, som har direktivets tecken (teknisk-plan §4, *EU-direktivets rapportmått*). Varje export har ett förhandsbesked om vad
den innehåller och utelämnar (`59-exportbesked.js`). Exporterna läser aldrig en flik som är ritad med en annan
tröskel än den som gäller (exportgrinden, `23-exportgrind.js`), så att en ändrad tröskel bara behöver rita om
det som syns. Word-utkastet och PDF-rapporten bär rapportmodellens diagram över grupper (`RM_DIAGRAM`) som
bilder; övriga diagram följer med i utskriftens bilagor, ZIP-filen och diagrammens egen export. *Avvisat:* att låta PDF-rapporten ha eget innehåll (två sanningar), och särskilda
sammanställningar för ledningsbriefen.

**ADR-41 — Flikmallen: resultatet först.** Alla flikar följer en mall — en rad om vad fliken svarar på (resten
bakom *Visa mer*), urvalet, **nyckeltalen i en sammanhållen rad**, flikens huvudresultat, och under rubriken
*Fördjupning* resten i hopfällbara avsnitt som säger sitt viktigaste tal i rubrikraden. Motiv: huvudresultatet
ska inte ligga flera skärmar ned. Det som gäller alla flikar (minsta gruppstorlek, kommun eller region, läge, PO-påslag och
beräkningsperiod) ligger i panelen Inställningar, liksom Prioriteringens trösklar och viktning, som styr
åtgärdslistan, kostnaden, handlingsplanen och rapporterna; det som bara används i en flik stannar där. Två lägen: vägledande och kompakt (samma avsnitt öppna, förklaringarna
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
tidsserier (verktyget har inga tidsserier: årsbokslutet bär två år, förra årets och årets, ADR-54).

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
effekt "per BAS-steg". Reservsteget kön + ålder finns kvar när fullmodellen är singulär. **Orört (till ADR-53):** Blinder-Oaxaca
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
och *Om verktyget*) säger detsamma. **Tillägg 2026-11-05 (ADR-56):** det gäller som standard; handläggaren kan
välja in yrkesgrupp i förklaringsmodellen, och då är steget huvudtalet.

**ADR-47 — Organisationspaketet kan låsa tre skydd.** Minsta gruppstorlek (ADR-38), rensningen vid inaktivitet
och rutan *Ta med grupper under tröskeln i exporten* i Tabeller och egna vyer (ADR-14) kan handläggaren annars ställa in
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
(tabellen i Tabeller och egna vyer, figurens `exportMedSma` och exportgrindens undantagstext); när paketet inte tillåter små
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

**ADR-49 — Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida.** Systemägaren kan i
panelen Organisationspaket peka ut verktygsfilen, välja filnamn och ladda ner en *organisationsfil* där
organisationspaketet ligger som en inaktiv datablock (`<template id="inbakat-organisationspaket">`) sist i
filen, efter sista skriptet — samma mönster som licenstexterna, så att CSP:ns per-script-hashar är orörda.
Vid start läses blocket in på samma väg som en paketfil (`lasInPaket`, `kalla: 'inbakat'`); *Rensa all
data* tar det inbakade tillbaka eftersom det är en del av filen; demoläget (`?demo=1`) går före; en inläst
paketfil ersätter det inbakade för sessionen. Handläggaren kan granska (*Visa paketet*) och ladda ner det.
Filen anger verktygets version och verktygsfilens SHA-256 men verifieras inte mot den publicerade
versionen (beslut 2026-10-19: att den kommer från systemägaren internt räcker). Filväljaren
behövs eftersom en sida från disk inte kan läsa sig själv, och automatisk inläsning av en fil i samma mapp
är omöjlig (webbläsaren och `connect-src 'none'`). Ren kärna i `src/lib/organisationsfil.js` (`bakaIn`,
`lasUt`), vaktad av `tests/organisationsfil.test.js` (inget skript rörs), röktester i
`tests/smoke-organisation.test.js` och webbläsarröktestet. Lönedata bakas aldrig in: `skapaPaket()` läser
aldrig `state.data`. Formatet: [`organisationsfil.md`](organisationsfil.md).

**ADR-50 — Prioritering är vad, Löneöversyn är hur.** Beslut 2026-10-29. Motiv: de två flikarna gick in i
varandra. Prioritering svarar på vad som bör åtgärdas och vad det kostar (matris, åtgärdslista, kostnad);
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
Rapporttext, Exportera och Spara och jämför år ritas alltid i det. Inställningen, stämpeln, metodbilagan och texterna om regeln talar om den
inställda tröskeln; det statistiska golvet `statGolv()` är oförändrat. Testerna prövar vyerna i exportläget
(`iExport` i riggen) och skärmen positivt. Knappen *Som i exporten* i sidhuvudet (`sattForhandsvisning`) sätter skärmen i
exportläget — banner, streckad ram och omritning av det som syns — tills den stängs av; exporterna byter då inte
läge, och ett byte medan en export pågår avvisas. Det som räknas på knapptryck i Löneöversyn räknas om när fliken
ritas om, om det visas (`_fcRitaOmKnappresultat`). Efter en export ritas bara det tillbaka som exporten ritade
(`_ritaOmEfterExport`), Lika arbetes minne har ett rum per tröskel, och ett tröskelbyte räknar om skattningarna
(`invalidateStatCaches`) bara när `statGolv()` ändras; Att göras lista byggs en gång för Att göra och
processöversikten (`renderProcessTracker({ punkter })`) — ingen cache, bara ett värde som skickas vidare.

**ADR-52 — Egna tabeller i rapporten som recept, inte tal.** Beslut 2026-10-29. En vy i Tabeller och egna vyer sparas med *Lägg
till i rapporten* som ett recept — rader, kolumner, mått, urval, gruppvillkor och valfri upprepning per BAS-intervall
(`src/lib/tabellrecept.js`, `state.rapportTabeller`). Recepten ritas om i exportläget (ADR-51) med samma pivot som
fliken (`computePivot`) och exportreglerna i Tabeller och egna vyer för minsta gruppstorlek, i avsnittet *Egna tabeller* efter
avsnittet per BAS-intervall (följer med när det gör det), i Excel-bladet *Egna tabeller* och som block i
rapportunderlaget (`egen:i:j`, `egenTabellBlock` i `src/lib/rapportunderlag.js`). Organisationspaketet kan bära
recepten (`rapport: { tabeller, perBasRecept }`, `_rapport` i `src/lib/organisationspaket.js`): giltiga recept följer
med, standardreceptet per BAS utelämnas, ett paket med `rapport` ersätter handläggarens egna tabeller och ett utan
rör dem inte; formuläret har rutan *Ta med rapportens egna tabeller*. Avsnittet per
BAS-intervall följer ett recept (`state.perBasRecept`, `valideraPerBasRecept` i `src/lib/perbas.js`): dimension (BAS
eller sektor), rader, mått, åldersgränser och summeringstabeller; standardreceptet är arbetsgivarnas utkast och sparas
som null. Båda bärs av konfigurationsfilen och nollställs av *Rensa all data*.

**ADR-53 — Blinder-Oaxaca med BAS som indikatorer.** Beslut 2026-10-29, upphäver undantaget i ADR-44. Uppdelningen
(`blinderOaxaca` i `src/lib/regression.js`) kodar BAS som en indikator per intervall, som huvudregressionen, så att
kortets förklarade och oförklarade del vilar på samma variabler som huvudtalet; skillnaden mellan dem är då bara att
uppdelningen skattar kvinnors och mäns lönesättning var för sig. Referensintervallet är det alfabetiskt första som
finns hos båda könen (huvudmodellen tar det första i urvalet; här måste båda ekvationerna ha ett intervall med alla
indikatorer noll). Ett intervall som bara finns hos ett kön får en indikator bara i det könets ekvation och β = 0 i
det andra könets; dess bidrag hamnar därmed i samspelet, som räknas som oförklarat — det är en redovisningsregel,
inte en skattning av vad intervallet "borde" betala det kön som saknas. Komponenterna redovisas per variabel som
konstant, ålder och BAS, där BAS är summan över indikatorerna (det som ADR-44 befarade skulle bli otydligt: ett
dussin rader). Referensvärdena i `tests/fixtures/stat-referens-varden.json` är omräknade med statsmodels
(`tests/fixtures/ref-stat-referens.py`); fixturen har ett intervall som bara finns hos männen, så regeln prövas.
Kvantilregressionen kodar BAS på samma sätt (ADR-63). Sedan 2026-11-05 styr valet (ADR-56) båda:
uppdelningen räknar på samma variabler som huvudtalet, också när ålder eller BAS valts bort eller yrkesgrupp valts in.

**ADR-54 — Jämförelse mellan år genom ett årsbokslut i konfigurationsfilen.** Beslut 2026-10-30. Konfigurationsfilen
bär ett *årsbokslut* (`src/lib/arsbokslut.js`, `cfg.arsbokslut`): nyckeltal för hela organisationen (antal, medianer
per kön, kvoten, det oförklarade gapet, antal flaggade yrkesgrupper och kandidatpar), en rad per yrkesgrupp i Lika
arbete där båda könen når minsta gruppstorlek (antal per kön, medianer, gap, flaggad, lönespridningen) och Att göra-punkternas id,
titel och läge. Lönespridningen är (P90 − P10) / median (`lonespridning`), räknad där gruppen har minst k löner; den
står också på raderna per BAS-intervall, och `jamforArsbokslut` ger den förra året och i år. En äldre fil utan fältet
ger null, som panelen och rapporten skriver som streck. Aldrig individer, aldrig lönedata; bokslutet byggs i exportläget (ADR-51) med den inställda tröskeln,
och `valideraArsbokslut` stryker vid inläsning varje grupp där ett kön är under bokslutets k och nollar könsuppdelade
nyckeltal när ett kön är det. Läses en fil med bokslut in ligger det i `state.forraArsbokslut`, och panelen
*Jämförelse med förra året* i Spara och jämför år (`73-arsbokslut.js`, `jamforArsbokslut`) visar nyckeltal rad för
rad, flaggade yrkesgrupper som kvar, nya och borta, och vilka av förra årets öppna punkter som är klara i år. Filen
bär bara ett bokslut: det som sparas i år; utan underlag bär den det inlästa vidare. *Rensa all data* tar bort det.
Alternativet, en egen bokslutsfil, valdes bort: konfigurationsfilen är redan den fil som sparas när arbetet är klart
och läses in när det återupptas. Jämförelsen följer också med i rapporten: avsnittet *Jämförelse med förra året*
(`rmArsjamforelseAvsnitt`) står efter *Åtgärder och tidsplan* och följer med när det gör det (som *Egna tabeller*
följer *per BAS-intervall*; det finns bara när ett bokslut är inläst och ändrar inte avsnittsräkningen), med
nyckeltalen sida vid sida, de flaggade yrkesgrupperna, hanteln och Att göra; blocket *Jämförelse med förra året*
i rapportunderlaget (`arsjamforelseBlock`); och hanteln (`hantelRader`, `foreEfterFigur`): kvinnors medianlön i
procent av mäns per yrkesgrupp, förra året som streck och i år som punkt, grön när kvoten närmat sig lika lön,
orange när den fjärmat sig, grå när den är oförändrad — en riktning, inte en bedömning. Diagramplanens pilspets
på strecket är inte gjord: strecket och punkten säger redan vilket år som är vilket. Sedan 2026-11-06 bär bokslutet
också `basIntervall`: en rad per BAS-intervall med minst k personer (`bas, n, nKv, nMa, p10, med, p90, medKv, medMa`),
där kvinnors och mäns median bara står när båda könen når k; ett intervall under k har ingen rad. Fältet är valfritt:
ett äldre bokslut får `basIntervall: null` (inte en tom lista, som betyder att inget intervall nådde k), och panelen
säger då att löneutvecklingen per BAS-intervall saknas i filen. `jamforArsbokslut` ger per intervall varje mått
förra året, i år och förändringen i kronor och procent; panelen visar tabellen *Löneutveckling per BAS-intervall*
och en hantel för medianen (`basHantelRader`, en färg: en högre median är en förändring, ingen bedömning), och
rapportmodellen samma tabell under *Jämförelse med förra året* (`rmBasUtvecklingDelar`, en kolumn per mått så att
den ryms på en stående sida). Förra årets fil kan ha sparats med en lägre tröskel än årets: `valideraArsbokslut`
höjer ett k under 2 till 2, och `jamforArsbokslut` läser båda åren med den högre av årens trösklar (`kGrans`,
`bokslutMedGrans`): rader per BAS-intervall och yrkesgrupper under den faller bort och könsmedianer nollas, så att
inget som lämnar verktyget bygger på färre personer än årets tröskel. Vaktas av `tests/arsbokslut.test.js` och `tests/smoke-arsbokslut.test.js`.
Sedan 2026-11-07 är bokslutet **version 2**: fältet `bedomningar` bär handlingsplanens sakliga skäl per grupp
(`{ nyckel, grupp, n, nMin, skillnadKr, skal: [{ kategori, belopp }] }`; nyckeln är handlingsplanens, kommentarerna
sparas aldrig). Bara de förifyllda raderna följer med: en egen rad har inget antal att pröva mot k. En grupp med
färre än k personer faller bort. När den minsta gruppen bakom skillnaden (`nMin`) är under k stryks skillnaden och
beloppen, och posten bär bara kategorierna (`skal: [{ kategori }]`); jämförelsen visar dem med namn men räknar dem inte
i summorna per kategori. Samma regel gäller med den högre av årens trösklar i `bokslutMedGrans`, och en nyckel som står
två gånger läses en gång (den första gäller). I exporterna gäller samma sak (`_hpUtanBelopp`): för en rad där ett kön
är under k står bara kategorin, med noten *belopp och kommentar utelämnade: ett kön har färre personer än minsta gruppstorlek*. Ett bokslut från version 1 läses som förut och får
`bedomningar: null`. `jamforBedomningar` ger summan och andelen per kategori båda åren, skälen per grupp som hade skäl
båda åren och de grupper som saknar bedömning i år; panelen visar tabellen *Sakliga skäl per kategori*. Vaktas av
`tests/arsbokslut.test.js` och `tests/arsbokslut-skal.test.js`.

**ADR-55 — Löneläget mot båda referenserna, Lönepolitik som avsnitt.** Beslut 2026-10-30. Fliken
Löneläget (id `benchmark`) samlar organisationens löner mot det de jämförs med, i tre avsnitt: överblicken (`src/lib/referenser.js`,
`44-referensoverblick.js`), *Mot ställningstagandet* (dagens Lönepolitik, oförändrad i sak; `buildLonepolitikModel`
behåller sin form) och *Mot jämförelsestatistiken* (den förra fliken Jämförelse, låst till statistiken: växeln *Jämför mot*
är borttagen). Fliken syns när underlaget och minst en referens är inlästa; `lonepolitik` är ett flikalias
(`TAB_ALIAS`), så att länkar och äldre konfigurationsfiler hamnar rätt, och ett sparat källval ignoreras.
Menyn följer rapportens ordning (1 · Underlag, 2 · Kartläggning, 3 · Åtgärder, 4 · Rapport, Arbetet, Hjälp; omlagd
2026-11-06): Löneläget står först i Kartläggning, och *Klar här?*-raderna följer menyn till Exportera och hoppar
över Löneläget och Ålder & karriär när de är låsta.

**Ställningstagandet är referenspunkten.** Löneläget och statistiken mäts mot det och ligger över eller under det,
aldrig tvärtom; statistikens skillnad är (S − P) / P. Per yrke inom BAS, som i avsnittet mot statistiken: *läge i spannet* är
medianens plats i referensens P10–P90 (`bandPosition`; 0 = P10, 100 = P90), med orden nedanför, i nedre delen, mitt i,
i övre delen och ovanför. *Mönstret* ställer löneläget mot ställningstagandet (nedanför, inom, ovanför) bredvid
statistikens median mot samma spann (under, inom, över), eftersom kombinationen bär samtalet: ligger båda över har
ställningstagandet halkat efter marknaden och organisationen följer den; ligger bara löneläget över har organisationen
gått före både politik och marknad. *Förslaget på referens* är den referens gruppen ligger inom, ställningstagandet
om gruppen ligger inom båda, annars den vars spann ligger närmast. Det är ett förslag: inget dolt tröskelvärde avgör
något, verktyget tillämpar det ingen annanstans. En grupp utan rad i en referens får streck där och ingår inte i
referensens tal; statistik med bara median ger inget läge och ritas som ett ensamt streck.

Organisationens P10, median och P90 per yrkesgrupp är gruppvärden och följer `kTroskel()` i det som lämnar verktyget
(ADR-51); referensernas egna tal och tabellen statistiken mot ställningstagandet bär inga organisationsvärden och
maskeras inte. Vaktas av `tests/referenser.test.js` och `tests/smoke-referenser.test.js`.

**ADR-56 — Valbar förklaringsmodell.** Beslut 2026-11-05. Avsnittet *Vad blir kvar av lönegapet?* räknade alltid på
kön + ålder + BAS-indikatorer. Det är pedagogiskt onödigt när ålder förklarar en bråkdel: varje tabell och steg bär då en
variabel som inte säger något. Handläggaren (en HR-person som ska ledas fram till ett svar) kan nu välja vilka
variabler som räknas bort: BAS-intervall, ålder eller båda, och lägga till yrkesgrupp inom BAS. Fullmodellen (BAS och
ålder, utan yrkesgrupp) är utgångsläge, så standardhuvudtalet är detsamma som förut (ADR-44, ADR-46, ADR-53).

*Panelen* (`renderForklaringsmodellPanel` i `51-lika-arbete-regressionskort.js`, före huvudtalet) visar kryssrutorna,
en tabell över vad varje variabel tillför, ett förslag, ett fält för skäl utanför siffrorna och noteringen om det
bortvalda. Tabellen (`computeVariabelTillfor` i `src/lib/regression.js`) räknas alltid mot fullmodellen, oberoende av
valet, så att den står still när man kryssar: ΔR² = R²(full) − R²(full utan variabeln) och gapet utan → med; yrkesgrupp
mäts ovanpå fullmodellen. Under **0,5 procentenheter** i förklaringsgrad räknas en variabel som *tillför lite*, och
verktyget föreslår att lämna den utanför (bara BAS och ålder föreslås bort; yrkesgrupp är en tilläggsvariabel).
Förslaget är ett pedagogiskt råd om vad som är värt att visa, inte ett statistiskt test. En bortvald variabel blir en
mening i stället för siffror, "Ålder har kontrollerats och tillför 0,3 procentenheter i förklaringsgrad; den ingår inte i
siffrorna. Skäl: …" (`bortvaltNotering` i `src/lib/rapportunderlag.js`), i panelen, i Oaxaca-kortet, i rapportunderlaget
och i rapportens sammanfattning och bilaga.

*Valet slår igenom överallt där huvudtalet används* (beslut på frågan 2026-11-05): `runOLSRegression` läser
`state.forklaringsmodell` (null = standard; `normaliseraForklaringsmodell`, `modellFras`, `modellBeskrivning` i
`src/lib/regression.js`), så Översikt, Att göra, Lönestruktur, Lika arbetes nyckeltal, rapporten och rapportunderlaget
visar samma tal, och frasen "ålder och nivå" byts överallt mot modellens fras ("nivå", "ålder", "ålder, nivå och
yrkesgrupp", tom för endast kön: "utan att något räknats bort"). Trappan, förklaringsbudgeten och Blinder-Oaxaca
räknar på samma modell (ADR-53 består). Sektorsöversikten i Struktur (`src/lib/sektor.js`) har en egen modell och
följer inte valet. Yrkesgrupp förutsätter BAS; valt in i huvudtalet skattas det med inomtransformation som steget
(FWL), och kovarianserna (klassisk och HC3) skalas med (n − p)/(n − p − G) för gruppnivåernas frihetsgrader, med k som
räknar dem (`_regInomYrkesgrupp`); i Oaxaca kodas då en indikator per AID×BAS-grupp i stället för BAS-indikatorerna,
med ADR-53:s referensregel, och raden heter *Yrkesgrupp inom BAS*. Reservsteget tar bort variabler i ordningen
yrkesgrupp, BAS, och lägger aldrig tillbaka något bortvalt. *Endast kön* är det ojusterade gapet och får inte vara
huvudtalet när ett kön ligger under den inställda tröskeln (ADR-12); spärren följer `kInstalld()` oavsett läge, så
att huvudtalet är detsamma på skärmen och i exporten, och panelen säger varför.

Valet och skälet (högst 300 tecken, samma personuppgiftsvakt som handlingsplanens fritext) bärs av
konfigurationsfilen (`forklaringsmodell`, null = standard; ett ogiltigt värde ger standard med varning, aldrig fel)
och nollställs av *Rensa all data*. Organisationspaketet bär det inte: valet är handläggarens. Referensvärdena för
Oaxaca på modellerna bara BAS, bara ålder och ålder + yrkesgrupp är räknade med statsmodels
(`tests/fixtures/ref-stat-referens.py`); golden-facit och docx-facit är oförändrade i standardläget, vilket är
kontrollen att standardmodellen räknar som förut. Vaktas av `tests/regression.test.js`,
`tests/stat-referens.test.js`, `tests/smoke-innehall.test.js` och `tests/rapportunderlag.test.js`.

**ADR-57 — Tabellerna per AID-kod och BAS-intervall.** Beslut 2026-11-05. Lika arbete är samma yrkesgrupp (AID-kod) på
samma nivå (BAS-intervall), och en skriven lönekartläggning behöver tabeller på den nivån. `src/lib/aidbas.js`
(`45-aid-bas-tabeller.js`) bygger fyra tabeller ur varje persons egen rad — *Lika arbete AID x BAS*, *Likvärdigt
arbete* med sammanfattning per BAS-intervall, *Hierarkisk jämförelse* och *Analys på individnivå* — som avsnitt i Lika
arbete och Likvärdigt arbete och som fyra Excel-blad med exakt rapportens kolumnnamn och lönemånaden ovanför. Gränserna
för slumpen är trattdiagrammets (omkastning av könen inom gruppen), räknade per AID-kod och BAS-intervall; samtidigt
rättades trattens underlag, som grupperade per yrkesgrupp och tog BAS-intervallet från första raden.

*Små grupper, ett avsteg från ADR-12:* en egen rad kräver minst fem personer i exportläget (`LITET_UNDERLAG`), inte
`kTroskel()`; mindre grupper räknas upp i en not med namn och antal men utan löner. Avsteget är avsiktligt: tabellerna
är arbetsgivarens kartläggning av alla grupper, och lagen kräver att också små grupper analyseras, så gruppen och dess
antal behöver stå i underlaget. Lönemått följer däremot `statGolv()` i båda lägena: ett köns median, kvoten och
gränserna kräver minst tio personer av varje kön (gruppen står annars som *Analyseras på individnivå*, och i
arbetslistan utan löner), gruppens median och lönespridning minst tio personer. På skärmen visas alla grupper (ADR-51).

*Kvinnodominerat enligt DO eller SCB:* definitionen väljs i Likvärdigt arbetes inställningar
(`state.likvardighet.kvDomDefinition`, standard `do`): DO är mer än kvinnotröskeln, SCB kvinnotröskeln eller mer.
Mansdominerat speglas; övriga könsblandade. *Brukar anses kvinnodominerad* bygger på andelen kvinnor nationellt (SKR:s
personalstatistik, organisationstypen i Inställningar) med samma definition. *Lönemånaden* (`state.lonemanad`) anges i
Inställningar, följer med i konfigurationsfilen och skrivs ut som *inte angiven* när den saknas: lönefilen bär ingen
sådan uppgift och verktyget gissar inte. Vaktas av `tests/aidbas.test.js` och `tests/smoke-aidbas.test.js`.

**ADR-58 — BAS-dossiern: ett BAS-intervall på en sida.** Beslut 2026-11-06. En skriven lönekartläggning disponeras
ofta per BAS-intervall, och handläggaren behövde hämta varje intervall ur fem flikar. `81-basdossier.js`
(`#basdossier-modal`) är en dialog som gruppdossiern, inte en flik: den nås från flera ställen (Löneöversiktens
BAS-rader, Lönestrukturs tabell per BAS-intervall, gruppdossiern, markeringsraden och sökrutan, där en BAS-träff
får ett eget alternativ under sig så att listboxens pilar och Retur når det) och har ingen post i menyn. Innehållet
står i rapportens ordning: nyckeltal och läget mot ställningstagandets rad för intervallet (`policyFor(null, bas)`),
yrkesgrupperna ur `likaArbeteGrupper` med antal och medianer räknade på intervallets rader och statusen ur Lika
arbetes grupp för hela yrket (Lika arbete grupperar per yrke över alla BAS-intervall; ett yrke som också finns i
andra intervall får noten *Status gäller hela yrket (N personer), som i Lika arbete; yrket finns också i BAS …*), paren ur
`likvardighetResultat()` där det kvinnodominerade yrket ligger i intervallet (`_parForRedovisning`), medianlön per
åldersgrupp (–34, 35–49, 50–, samma gränser som rapportens åldersgruppstabell) och kön, och intervallets rad ur
förra årets bokslut (ADR-54, `jamforBasIntervall`). Ingen ny statistik. Skärmen följer läget som övriga flikar
(ADR-51); könsuppdelade mått bara där båda könen når k, i åldersgrupperna per grupp. Textversionen
(`basdossierText`) lämnar verktyget och byggs därför i exportläget: yrkesgrupper under k står bara med namn, och ett
intervall under k ger ingen text. Förra årets rad läses med den högre av filens och den inställda tröskeln
(`bokslutMedGrans`, se ADR-54). Vaktas av `tests/basdossier.test.js` och av k-invarianten i
`tests/ktroskel-invarianter.test.js`, som prövar texten för varje valbart intervall vid 10 och 25.

**ADR-59 — Uppmärksamhetstrappan på statistisk signal, direktivmarkeringen åtskild.** Beslut 2026-11-08. Texterna
sade redan att 5 % bara är villkoret för gemensam lönebedömning, men statusen för en skillnad mellan kvinnors och mäns
lön sattes fortfarande på |skillnad| över 5 % ensam, så att en grupp med 18 kvinnor och 2 män kunde bli *Värt att
granska* på storleken utan att skillnaden gick att skilja från slumpen. `src/lib/status.js` sätter nu statusen på
statistisk signal och verktygets egen storleksgräns 3 %: *Värt att granska* när skillnaden är säkerställd (utanför
slumpens gränser för gruppen — trattdiagrammets omkastning, över 300 personer normalapproximationen — eller ett
konfidensintervall som utesluter lika lön) och minst 3 %; *Följ upp* när den är minst 3 % men inte säkerställd eller
säkerställd men under 3 %; *Balanserat* under 3 % och inte säkerställd; *Går ej att bedöma* när ett kön är under
`statGolv()`. 5 % är ingen status utan en **direktivmarkering** (kolumnen *Ojusterad löneskillnad ≥ 5 %*, brickan
*≥ 5 %*) som bara står vid ojusterade medianskillnader, med verktygstipset att direktivets regler om gemensam
lönebedömning utgår från en skillnad på minst 5 % och att markeringen inte är en bedömning. Regressionens justerade tal
bär ingen markering; per-BAS-signalen heter *Titta närmare* (säkerställd efter BH-korrigering och minst 3 %) och
*Dokumentera* (säkerställd under 3 %). Skör/stabil mäts mot 3 %. Yrkesgruppernas status räknas en gång per underlag
(`laLikaGrupper`) och delas av fliken, rapportmodellen, rapportunderlaget, årsbokslutet, dossiererna och protokollet
för gemensam lönebedömning. Att göra grupperar efter källa (*Lika arbete*, *Lika arbete, fördjupning*, *Likvärdigt
arbete*, *Löneläge mot referens*, *Underlagets kvalitet*), Översiktens ruta heter *Säkerställd löneskillnad*, och
protokollet för gemensam lönebedömning väljer yrkesgrupper som är värda att granska med markeringen som egen kolumn.
Utforska prövar ingen skillnad och visar därför högst *Följ upp*. Vaktas av `tests/status-trappa.test.js`.

**ADR-60 — Jämförelseyrkena i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av
kvinnodominerat.** Beslut 2026-11-08. Tidigare fick bara grupper med under 40 % kvinnor vara jämförelseyrken, så
blandade yrken (40–60 %) föll bort ur både kandidatparen och jämförelsestatistiken — i demot jämfördes Barnskötare
och Undersköterska inte med Systemutvecklare (23 kvinnor av 45) i samma BAS-intervall. Nu är jämförelseyrkena
**alla grupper som inte är kvinnodominerade** enligt vald definition: `aggregeraOrgKvDom` lägger varje sådan grupp i
`orgIckeKv` med klassen `'mansdominerad'` eller `'blandad'`, `klassificeraStatistik` gör rader som inte är
kvinnodominerade till kandidater (`klass.blandat` räknas fortfarande för diagnostiken), och paren får `maKlass` och
`maKvinnoPct` för både interna och externa jämförelseyrken. Filtret `jamforelse: 'alla' | 'mansdominerade'`
(`state.likvardighet.jamforelse`, standard `'alla'`, rutan *Jämför bara med mansdominerade yrken* i
Inställningar) begränsar mängden *innan* paren byggs, så att reserven till jämförelsestatistiken per BAS fungerar som
förut; med filtret på återskapas det tidigare urvalet. Samma mängd används i kandidatparen, *Lägre krav, högre
lön*, *Hierarkisk jämförelse* och sammanfattningen per BAS-intervall (`arJamforelseKlass` i `src/lib/aidbas.js`).
Könsandelen och klassen står i partabellen (kolumnen *Könsandel*), Steg 2a/2b, CSV- och Excel-exporterna (*Jämf.
klass*), rapportunderlaget och rapporten; metodtexten säger att yrkena jämförs med yrken på samma nivå som inte är
kvinnodominerade och att könsandelen står i tabellen. Fältet följer med och valideras i konfigurationsfilen
(`likvardighet.jamforelse`) och organisationspaketet (`installningar.jamforelse`).

*En definition (teknisk-plan §9 punkt 22):* `arKvinnodominerad(pct, definition, grans)` och `konsklass(pct, definition, grans)` i
`src/lib/likvardighet.js` är den enda definitionen: DO (i gränssnittet *Förarbetena*) mer än gränsen, SCB gränsen eller mer, mansdominerat speglat
för män, övriga blandade. Den används av `aggregeraOrgKvDom` och `klassificeraStatistik` (som nu också följer
kvinnotröskeln i stället för fasta 60 %), `dominans` i `aidbas.js` (tabellerna per AID och BAS), `forecastOutcome` i
`loneoversyn.js` (Löneöversynens *Varav till kvinnodominerade grupper*) och i appen via `kvDomNu`/`konsklassNu`
(`45-aid-bas-tabeller.js`): Lika arbetes kolumn Dominans, diagrammet Krav mot lön, Löneöversynens massregel,
Lönepolitikens diagram och SKR-uppslaget. Prioriteringen klassar inga grupper efter könsdominans (dess
jämställdhetsmått bygger på gapet) och berörs inte. Texterna säger *mer än* (DO) eller *minst* (SCB) efter valet.
Lönekartläggningens regler om kvinnodominerat arbete beskrivs i `lagrum.md`; tolkningen att jämförelsemängden är
alla som inte är kvinnodominerade är ett förslag, inte prövat av jurist. Vaktas av `tests/likvardighet.test.js`,
`tests/aidbas.test.js`, `tests/smoke-vyer.test.js` (demot i BAS C) och `tests/smoke-aidbas.test.js`.

**ADR-61 — Minsta skillnad 0 % som standard i likvärdigt arbete.** Beslut 2026-11-08. Kandidatparen visades tidigare
bara när jämförelseyrket låg minst 5 % högre, så ett par med 2 % skillnad syntes aldrig utan att användaren ändrat
fältet; i demot föll Undersköterska–Systemutvecklare i BAS C bort. Nu är `state.likvardighet.minGapPct` 0: alla par
där jämförelseyrket har högre lön visas, och 5 % är ett valbart filter i fältet *Visa bara par med minst … % skillnad
(0 = alla)*. Tabellen visar som förut de `topN` (20) största; finns fler står knappen *Visa alla*. `byggPar` och
`byggParPoäng` räknar paren före urvalet (`parAntal`: totalt, hur många som har en ojusterad löneskillnad på minst
5 % enligt `direktivMarkering` ur `src/lib/status.js`, och hur många som har en säker skillnad), och nyckeltalet *Par
att titta närmare på* säger *N, varav M med ojusterad löneskillnad ≥ 5 %*, så att direktivnivån syns utan att paren
under den döljs. *Lägre krav, högre lön* använder samma `minGapPct`. Organisationspaketet bär inte värdet;
konfigurationsfilen gör det som förut. Vaktas av `tests/likvardighet.test.js`, `tests/smoke-vyer.test.js` och
`tests/granssnitt-vyer.test.js`.

**ADR-62 — Prioriteringens egna ord för läget mot referensen.** Beslut 2026-11-08 (beslut 4a inför lanseringen).
Prioriteringen mäter löneläget mot er referens (ställningstagandet eller jämförelsestatistiken), men dess statusar
hette som uppmärksamhetstrappan för skillnaden mellan kvinnor och män, och nyckeltalet *Total åtgärdskostnad* kunde
läsas som kostnaden för lönekartläggningens könsskillnader. Statusvärdena i `src/lib/prioritering.js`
(`akut/atgard/bevaka/ok/analysera`) och gränserna är oförändrade; orden i `PRIO_STATUS_INFO` (`55-prioritering.js`)
är *Börja här*, *Under referens*, *Nära referens, under*, *Nära referens* och *Över referens* — Nära referens har två
färger, under och över uppföljningsgränsen. Samma ord står i matrisens zoner, åtgärdslistan och dess Excel-blad,
beräkningsbeviset, inställningarnas förklaringar, symbolförklaringen och ordlistan; ordlistans poster för trappan
nämner inte längre Prioritering. Att göra kallar punkterna ur Prioritering *Löneläge mot referens*. Nyckeltalet
heter *Kostnad att nå referensen*, med raden att det är löneläget mot referensen och inte könsskillnaderna (dem visar
Lika arbete och Löneöversyn), och PO-raden säger att 39,15 % är SKR:s standardvärde för kommuner (ett eget värde
får bara *ändras under Inställningar*). Förslaget om en liten avvikelse säger *Gruppens median ligger inom ±N % av
referensen* (N = uppföljningsgränsen; förslaget gäller nu inom den gränsen i stället för fasta 1,5 %) i stället för
"normal variation", och förslaget över referensen *Ligger N % över referensen. Dokumentera gärna varför.*
Handlingsplanens vägledning, rapportens avsnitt Åtgärder och tidsplan och rapportunderlaget säger hur stor del av
kostnaden som är kostnad att nå referensen. Vaktas av `tests/smoke.test.js`, `tests/granssnitt.test.js`,
`tests/diagramvyer.test.js` och `tests/smoke-innehall.test.js`.

**ADR-63 — Kvantilregressionen på huvudmodellens design, villkorad tolkning.** Beslut 2026-11-08 (beslut 6a inför
lanseringen). Kvantilregressionen räknade BAS som ett tal (BAS-rangen, `basRangFn`) med ålder alltid med, medan
huvudtalet räknar BAS som indikatorer och följer förklaringsmodellen (ADR-44, ADR-56); kortet sade ändå *samma
modellspecifikation som huvudregressionen*. Tolkningen *väger tyngre än* sades när beloppen vid P10 och P90 skilde mer
än en procentenhet, utan prövning. Nu bygger `kvantilDesign(rows, modell, { ageMean?, basList? })` i
`src/lib/regression.js` designen med samma hjälpare som stegen i dekomponeringen (`_sekvensRigg`): intercept, kön,
[ålder centrerad], [en indikator per BAS-intervall utom det första] enligt förklaringsmodellen, utan yrkesgrupp inom
BAS; raderna filtreras där (ålder krävs bara när ålder är med). `quantileRegressionAtAllTau(rows, { modell, ageMean?,
basList? })` tar ingen rangfunktion längre och returnerar `konPct` per τ och `diffP90P10` (procentenheter). I appen
använder punktskattningen och bootstrappen (`_regKvantilBerakna`, `_regKvantilBootstrap` i
`51-lika-arbete-regressionskort.js`) samma byggare; varje omsampling bygger designen på nytt ur de dragna raderna, så
att ett intervall som inte kom med inte ger en nollkolumn. Bootstrappen sparar `konPct[τ]` och `diff = konPct[0,9] −
konPct[0,1]` per omsampling och ger percentilintervall för båda. Tabellen har raden *P90 − P10*. *Glastaket väger
tyngre än det klibbiga golvet* (diff-KI under noll) eller tvärtom (över noll) sägs bara när diff-KI:t utesluter noll,
annars *Ingen säkerställd skillnad mellan delarna av lönefördelningen.*; utan intervall (över 2 000 personer) sägs att
det inte går att avgöra. Skattningarna färgas inte längre efter 5 % och 2 % (ADR-59: storlek ensam är ingen status).
Diagrammets punktlager saknade `riktning: 'liggande'`, så intervallets gränser lästes som kategorier på bandaxeln och
skrevs ut som råa tal (U4); det är rättat, och ett test kräver att ingen text i någon ritad figur är ett tal med
decimalpunkt. IRLS-kärnan hoppar över nollor i designen (samma summor, snabbare med indikatorer), och bootstrappen
startar varje omsampling i hela urvalets lösning (`start` i `quantileRegression`; samma lösning inom toleransen, färre varv). Referensen är en ny
exakt LP-lösning för indikatormodellen (`tests/fixtures/stat-referens-kvantil.json`, framtagen och kontrollerad som
filhuvudet i `tests/stat-referens.test.js` beskriver). `basRangFn` finns kvar för *Lägre krav*. Vaktas av
`tests/regression.test.js`, `tests/stat-referens.test.js`, `tests/diagramritare.test.js` och
`tests/smoke-innehall.test.js`.

**ADR-64 — Ålder är valfri i lönefilen.** Beslut 2026-11-08. En lönekartläggning förutsätter ingen ålderskolumn, och
uppgiftsminimeringen talar för att den som inte behöver åldersjusteringen ska kunna lämna
åldern utanför uttaget. Kolumnmappningen har ålder som valfri (`required: false`); en saknad kolumn ger ålder 0 på
varje rad, och 0 betyder *saknas*. Om lönefilen har ålder härleds ur datan (`harAlderIRader` i
`src/lib/regression.js`, i appen `harAlder()` i `50-regressionsmodeller.js`), inget nytt fält i tillståndet. Utan
ålder utesluts inga rader; inläsningskontrollen och förhandskontrollen säger *Ålder saknas: analysen körs utan
åldersjustering; Ålder & karriär visas inte.* Modellerna tar bort ålderstermen: förklaringsmodellen tvingar
`alder: false` med en varning, regressionen, per-BAS-regressionen, Oaxaca–Blinder och kvantilregressionen körs med
kön och BAS (och yrkesgrupp när den är vald), livscykelmodellen svarar `no_age`, Personer att granska prövar alla mot
kollegornas median, datakvaliteten hoppar över rimligheten för ålder och tabellerna per BAS-intervall utelämnar
medelålder och åldersgrupper med en mening om varför. Fliken Ålder & karriär låses som övriga låsta flikar med tipset
*Kräver ålder i lönefilen*; Översiktens medelålder visas som –; Word, PDF, Excel, rapportunderlaget och dossiererna
hoppar över åldersavsnitten. Metodmeningen *Att ålder räknas bort är ett metodval …; det avgör ni.* står alltid, med
eller utan ålder: i nyckeltalets verktygstips i Lika arbete, i regressionskortets *Så fungerar regressionen* och i
rapportens metodtext. Bladet *Metod & parametrar* (`_methodAppendixData` i `22-exporthjalpare.js`) säger i raderna
*Modell — oförklarad skillnad* och *Steg + Yrkesgrupp* modellen utan ålder (`modellBeskrivning(forklaringsmodell())`).
Importprofilernas kännetecken räknas som förut, så att sparade profiler känns igen. Vaktas av
`tests/regression.test.js`, `tests/ktroskel-utan-alder.test.js` och facit *lönefil utan ålder* i
`tests/exports.golden.test.js`.

**ADR-65 — Var uppstår löneskillnaden: valbara förklaringsvariabler.** Beslut 2026-11-10. ADR-22 delar skillnaden i
medellön på BAS och AID i den ordningen. Kortet *Förklara med:* låter handläggaren välja en till fyra variabler bland
BAS, sektor, AID-mellannivå, AID och åldersgrupp (`ageBucket`, bara när lönefilen har ålder, ADR-64), och ordna dem.
Uppdelningen nästlas i den ordningen: varje cell c på nivå i−1 har vikten ω_c, produkten av s̄ längs vägen från hela
urvalet. Del i är Σ_c ω_c · Σ_barn Δs_barn|c · (W̄_barn − W̄_c), och den sista delen (*Inom …*) är Σ_löv ω_löv · ΔW_löv.
Delarna summerar exakt till hela skillnaden, eftersom ΔW_c = Σ Δs · W̄ + Σ s̄ · ΔW på varje nivå. En cell där ett kön
saknas bidrar bara till sin fördelningsdel, som förut. **Ordningen spelar roll**, och kortet säger det: den första
variabeln får det den förklarar ensam. AID-nivåerna (sektor, mellannivå, AID) ordnas alltid grovt till fint på sina
platser, eftersom en finare nivå före en grövre ger en tom del; en flytt som skulle bryta det är avstängd.
**Skyddet** är ADR-22:s, per del: en cell är synlig bara om den själv och alla dess överceller har 0 eller minst k av
varje kön, topplistan kortas efter samma regel, och kan en del inte redovisas visas ingen del. **Standardvalet** BAS,
AID ger bitlika tal (posterna läggs i samma ordning och räknas med samma operationer) och samma texter; det prövas mot
en frusen kopia av den tidigare implementationen på demot, det stora demot och testfallen
(`tests/helpers/gapuppdelning-fore-adr65.js`). Delarnas namn, kortets texter, trappans beskrivning och
rapportunderlagets meningar byggs ur variablerna (`gapDelar`, `gapDelarIText` i `src/lib/gapuppdelning.js`); ett
annat val än standard nämns i rapportunderlaget och som en rad i metodbilagan (`_methodAppendixData`). Valet lagras som
`state.gapUppdelning = { variabler }` (null = standard), sparas i konfigurationsfilen (`gapUppdelning`; ogiltigt ger
standard med varning, en fil utan fältet ger standard), nollställs av *Rensa all data* och prövas inte mot åldern när
det lagras (som förklaringsmodellen, ADR-56). Organisationspaketet bär det inte. Vaktas av
`tests/gapuppdelning.test.js`, `tests/rapportunderlag.test.js`, `tests/smoke-granssnitt.test.js`, I7 i
`tests/ktroskel-invarianter.test.js` och webbläsarröktestet (`tools/browser-smoke/gapuppdelning.mjs`).
