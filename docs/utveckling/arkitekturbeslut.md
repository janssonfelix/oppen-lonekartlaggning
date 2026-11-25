# arkitekturbeslut.md — Öppen lönekartläggning: Arkitekturbeslut (ADR)

> Loggen över arkitekturbesluten: vad som valdes och varför, så att ett beslut inte återupptas utan ny kontext. Besluten
> binder inte i sig. Det som binder är skydden och principerna: skydden går före, se [`skydd.md`](skydd.md), och
> principerna står i [`principer.md`](principer.md). Hur något fungerar i dag står i referensen för området, som
> beslutet pekar på under *Gäller i dag*; där ingen referens finns står lydelsen kvar i beslutet. Syfte, avgränsning och
> funktionsmål står i [`mal.md`](mal.md), de öppna punkterna i [`oppna-punkter.md`](oppna-punkter.md).

**Numren** byts aldrig och tas aldrig bort, eftersom koden, testerna och dokumenten pekar på dem; ett nummer som saknas
används inte, och 66 och 67 är reserverade för beslut under arbete. **Status:** *Gällande*; *Ändrad av ADR-x* (det
senare beslutet gäller där de skiljer sig); *Sammanförd i* eller *Flyttad till (dokument)* (lydelsen står där);
*Upphävd*.

## Index

| Nr | Beslut | Status | Datum |
|---|---|---|---|
| ADR-1 | Web Worker avvisad | Gällande | – |
| ADR-2 | JS-minifiering avvisad | Gällande | – |
| ADR-4 | Byggskyddsnät | Flyttad till `bygge-och-test.md` | – |
| ADR-5 | Kodhygien | Flyttad till `CONTRIBUTING.md` | – |
| ADR-6 | `app.js` genereras från `src/app/`-moduler | Ändrad av ADR-98 | – |
| ADR-7 | Två lager röktest: jsdom och den byggda filen i riktiga webbläsare | Gällande | – |
| ADR-8 | lib-speglarna genereras från `src/lib/` | Upphävd | – |
| ADR-9 | Hash-baserad CSP `script-src` | Gällande | – |
| ADR-10 | Sidopanelen är navigation, inte ARIA-tabs | Gällande | – |
| ADR-12 | Redovisningsformen för minsta gruppstorlek: utelämna och namnge | Ändrad av ADR-51 | – |
| ADR-13 | `VERSION` är enda källa för versionsstämpeln | Gällande | – |
| ADR-14 | Tabeller och egna vyer visar små grupper; exporten utelämnar dem | Sammanförd i `k-troskeln.md` | – |
| ADR-15 | Formler i CSV- och urklippsexport neutraliseras | Gällande | – |
| ADR-16 | Inga paragrafhänvisningar i gränssnittet, och sedan 2026-10-19 inte heller i hjälptexter eller exporter | Gällande | 2026-10-19 |
| ADR-17 | `runOLSRegression` får aldrig cachas | Ändrad av ADR-81 | – |
| ADR-19 | Underlagets kvalitet: svagaste länken avgör | Gällande | – |
| ADR-20 | Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget | Gällande | – |
| ADR-21 | Alla BAS-intervall ingår (upphävd begränsning) | Sammanförd i `mal.md` | – |
| ADR-22 | Var uppstår löneskillnaden? Uppdelning på medellön | Ändrad av ADR-65 | – |
| ADR-23 | Personer att granska: individlista i verktyget, aldrig i utdata | Ändrad av ADR-103 | – |
| ADR-24 | Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering | Ändrad av ADR-59 | – |
| ADR-25 | Lägre krav, högre lön: jämförelse över BAS-gränserna | Gällande | – |
| ADR-28 | Organisationspaket; ingen inbyggd organisation | Gällande | – |
| ADR-29 | Ett steg är klart när dess punkter är hanterade | Ändrad av ADR-59 | – |
| ADR-30 | Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden | Gällande | – |
| ADR-31 | Interna fel rapporteras i stället för att sväljas | Gällande | – |
| ADR-33 | AID-hierarki, översikt per huvudområde, ansvarskod och kodkvalitet | Gällande | – |
| ADR-34 | SKR:s personalstatistik som referens för kvinnoandel | Gällande | – |
| ADR-35 | Jämförelsestatistik: alla percentiler i en tabell och två diagram | Ändrad av ADR-55 | – |
| ADR-36 | Filrutorna syns alltid; namn på organisationen och jämförelsestatistiken | Gällande | – |
| ADR-37 | Word-utkastet som riktig .docx | Gällande | – |
| ADR-38 | K-tröskeln är en inställning | Ändrad av ADR-51, ADR-69 och ADR-102 | – |
| ADR-39 | Diagramkärna på D3 med eget figurformat | Gällande | – |
| ADR-40 | Fyra exporter med var sin uppgift, ritade ur en rapportmodell | Gällande | – |
| ADR-41 | Flikmallen: resultatet först | Ändrad av ADR-82 | – |
| ADR-42 | Diagrammens form och färg väljs efter uppgiften; tabell med grafik i raden där ett diagram visar för lite | Gällande | – |
| ADR-43 | Färgerna har en källa | Gällande | – |
| ADR-44 | BAS som indikatorvariabler i huvudregressionen | Ändrad av ADR-53 och ADR-63 | – |
| ADR-45 | t-kvantiler för konfidensintervallen; exakt t-fördelning | Gällande | – |
| ADR-46 | Steget *+ AID-etikett inom BAS*: könsgapet med fasta effekter för AID-etikett inom BAS | Ändrad av ADR-56 | – |
| ADR-47 | Organisationspaketet kan låsa tre skydd | Gällande | – |
| ADR-48 | Bilder med en punkt per person följer med i ZIP och Komplett rapport | Ändrad av ADR-85 | 2026-10-16 |
| ADR-49 | Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida | Gällande | – |
| ADR-50 | Prioritering är vad, Löneöversyn är hur | Gällande | 2026-10-29 |
| ADR-51 | Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen | Gällande | 2026-10-29 |
| ADR-52 | Egna tabeller i rapporten som recept, inte tal | Gällande | 2026-10-29 |
| ADR-53 | Blinder-Oaxaca med BAS som indikatorer | Gällande | 2026-10-29 |
| ADR-54 | Jämförelse mellan år genom ett årsbokslut i konfigurationsfilen | Gällande | 2026-10-30 |
| ADR-55 | Löneläget mot båda referenserna, Lönepolitik som avsnitt | Gällande | 2026-10-30 |
| ADR-56 | Valbar förklaringsmodell | Gällande | 2026-11-05 |
| ADR-57 | Tabellerna per AID-kod och BAS-intervall | Ändrad av ADR-90 | 2026-11-05 |
| ADR-58 | BAS-dossiern: ett BAS-intervall på en sida | Gällande | 2026-11-06 |
| ADR-59 | Uppmärksamhetstrappan på statistisk signal, direktivmarkeringen åtskild | Ändrad av ADR-71 | 2026-11-08 |
| ADR-60 | Jämförelseetiketterna i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av kvinnodominerat | Ändrad av ADR-72 | 2026-11-08 |
| ADR-61 | Minsta skillnad 0 % som standard i likvärdigt arbete | Gällande | 2026-11-08 |
| ADR-62 | Prioriteringens egna ord för läget mot referensen | Gällande | 2026-11-08 |
| ADR-63 | Kvantilregressionen på huvudmodellens design, villkorad tolkning | Gällande | 2026-11-08 |
| ADR-64 | Ålder är valfri i lönefilen | Gällande | 2026-11-08 |
| ADR-65 | Var uppstår löneskillnaden: valbara förklaringsvariabler | Ändrad av ADR-87 | 2026-11-10 |
| ADR-68 | Arkitekturbeslutens form: beslut i mall, gällande lydelse i referenserna | Ändrad av ADR-73 | 2026-11-13 |
| ADR-69 | Löneöversyns förslag följer den inställda tröskeln | Gällande | 2026-11-13 |
| ADR-70 | Skyddet gäller lönemått; antal och andelar är handläggarens ansvar | Gällande | 2026-11-14 |
| ADR-71 | Trappan i livscykeln, protokollet och Prioriteringen; ingen färg på storleken ensam | Gällande | 2026-11-14 |
| ADR-72 | Definitionerna av kvinnodominerat heter efter lydelsen | Gällande | 2026-11-14 |
| ADR-73 | Skydden och principerna binder; besluten är en logg | Gällande | 2026-11-14 |
| ADR-74 | AID:s egna ord, och termerna på ett ställe | Gällande | 2026-11-14 |
| ADR-75 | Kort ordform i kolumnrubriker, och Word-utkastets täta läge | Gällande | 2026-11-15 |
| ADR-76 | Poängläget jämför bara med organisationens egna jämförelseetiketter | Gällande | 2026-11-15 |
| ADR-77 | HC3 med AID-etikett inom BAS räknas med den fulla designens hävstång | Gällande | 2026-11-15 |
| ADR-78 | Översikten per huvudområde räknar med huvudregressionens kodning | Gällande | 2026-11-15 |
| ADR-79 | Protokollet redovisar median och medelvärde, och har fält för löneökning efter ledighet, utvärdering och arbetsvärdering | Gällande | 2026-11-15 |
| ADR-80 | Flikbytet ritar först och räknar sedan | Gällande | 2026-11-16 |
| ADR-81 | En färdigritad flik visas igen när ingenting har ändrats | Gällande | 2026-11-16 |
| ADR-82 | Bara dator: verktyget anpassas inte för surfplatta eller telefon | Gällande | 2026-11-16 |
| ADR-83 | Kompletterande undertryckning i tabellerna per BAS-intervall | Gällande | 2026-11-19 |
| ADR-84 | PO-påslagets standardvärde är 40 %, ett antagande utan källhänvisning | Gällande | 2026-11-19 |
| ADR-85 | Fältet för AID-etikett maskeras inte; inläsningen varnar för personnamn | Gällande | 2026-11-20 |
| ADR-86 | Slumpintervallen är en funktion av lönerna, inte av radordningen, och percentilindexen är symmetriska | Gällande | 2026-11-19 |
| ADR-87 | Sammanslagning av små grupper i uppdelningen av löneskillnaden och huvudområdenas andel | Gällande | 2026-11-20 |
| ADR-88 | Differensprovet är en del av invarianten för minsta gruppstorlek | Gällande | 2026-11-19 |
| ADR-89 | En grupp är AID-koden i BAS-intervallet, i hela verktyget | Gällande | 2026-11-20 |
| ADR-90 | Lika arbete AID x BAS visar Lika arbetes status, utan egen bedömning | Gällande | 2026-11-20 |
| ADR-91 | Kompletterande undertryckning i JPA-protokollets blad för lika arbete mot intervallens medelvärden | Ändrad av ADR-92 | 2026-11-20 |
| ADR-92 | S4 gäller en fil i taget | Gällande | 2026-11-20 |
| ADR-93 | JPA-protokollet redovisar alla grupper i lika arbete | Gällande | 2026-11-22 |
| ADR-94 | Diagrammens filter står alltid utfällda | Gällande | 2026-11-22 |
| ADR-95 | Beräkningsregistret blir spårbarhetsmatrisen | Gällande | 2026-11-23 |
| ADR-96 | Konfigurationsfilens fält har svenska namn; äldre filer läses | Gällande | 2026-11-23 |
| ADR-97 | Funktionerna i `src/lib/` har svenska namn | Ändrad av ADR-104 | 2026-11-23 |
| ADR-98 | Appen byggs från ES-moduler med esbuild | Gällande | 2026-11-23 |
| ADR-99 | En vymodell per flik i `src/lib/` | Gällande | 2026-11-23 |
| ADR-100 | Varje release har en signerad valideringsrapport | Gällande | 2026-11-23 |
| ADR-101 | Releasen attesteras och bygget prövas reproducerbart | Gällande | 2026-11-23 |
| ADR-102 | Minsta gruppstorlek är lägst 3 | Gällande | 2026-11-23 |
| ADR-103 | Golvet för skattningar följer tröskeln bara i exportläget | Gällande | 2026-11-23 |
| ADR-104 | Funktionerna i `src/app/` har svenska namn; tillståndets fält och DOM:ens id:n står kvar | Gällande | 2026-11-23 |
| ADR-105 | Konfidensintervall och p-värden använder t-fördelningen vid alla frihetsgrader | Gällande | 2026-11-24 |
| ADR-106 | Ingen juristgranskning före lansering; ett ansvarsförbehåll med samma lydelse överallt | Gällande | 2026-11-08 |
| ADR-107 | EU-rapportmåtten bär en reservation om lönebegreppet | Gällande | 2026-11-08 |

## Besluten

**ADR-1 — Web Worker avvisad.** Verktyget använder ingen arbetstråd; vid ett faktiskt prestandabehov används
uppgifter i följd på huvudtråden (`setTimeout`, ADR-80) och nedsampling i diagramkärnan. *Avvisat:* en worker: CSP:n saknar
`worker-src`, en worker når IndexedDB utanför lagringsspärren, `file://` och blob-workers är opålitliga, och
diagramritningen arbetar ändå mot DOM. *Gäller i dag:* `skydd.md` S1.

**ADR-2 — JS-minifiering avvisad.** Bygget minifierar CSS och HTML, vars grammatik är enklare, men inte JS. *Avvisat:*
regex-minifiering, som inte är AST-medveten och kan korrumpera strängliteraler, och ett beroende av terser eller esbuild
för omkring 14 % mindre fil. *Gäller i dag:* `bygge-och-test.md` §2.

**ADR-4 — Byggskyddsnät.** Var en beskrivning av bundlerns skyddsnät, inte ett eget beslut. *Gäller i dag:*
`bygge-och-test.md` §2.

**ADR-5 — Kodhygien.** Var två regler, inte ett eget beslut: oanvänd kod tas bort, och säkerhetsgranskningen hålls
samlad i `docs/dataskydd/riskanalys.md`. *Gäller i dag:* `.github/CONTRIBUTING.md` punkt 2 och princip 4 i
`principer.md`.

**ADR-6 — `app.js` genereras från `src/app/`-moduler.** *Ändrad av ADR-98.* Appens kod ligger i numrerade källmoduler som slås ihop byte för
byte till `dist/app.js`, för navigerbarhet utan ES-moduler i bygget (`file://`-kravet). En modul som växer delas vid en
sektionsgräns som ren byteskiva, så att `dist/app.js` blir bit för bit oförändrad. *Gäller i dag:* `bygge-och-test.md`
§1–§2 och `src/app/README.md`.

**ADR-7 — Två lager röktest: jsdom och den byggda filen i riktiga webbläsare.** jsdom-lagret ritar varje flik men ser
inte CSP:n, `file://` eller bildexporten via canvas; webbläsarlagret kör den byggda filen i Chromium, Firefox och
WebKit, med en färskhetsspärr mot ett gammalt bygge. *Avvisat:* ett av lagren ensamt. *Gäller i dag:*
`bygge-och-test.md` §5.5 och §9.

**ADR-8 — lib-speglarna genereras från `src/lib/`.** *Upphävd: ersatt av ADR-98.* `gen-mirrors.mjs` inlinar varje `src/lib/`-modul ordagrant i
en IIFE i `09-lib-speglar.js`, så att `src/lib/` är enda källan och appens moduler bara är adaptrar. Lib-moduler
får importera varandra; aliaset injiceras inuti den importerande modulens IIFE, så att inga nya globala namn uppstår.
*Gäller i dag:* `bygge-och-test.md` §2.

**ADR-9 — Hash-baserad CSP `script-src`.** Den byggda filens `script-src` tillåter bara skript med kontrollsumma, inte
`'unsafe-inline'`, så att webbläsaren avvisar både injicerade `<script>` och injicerade händelseattribut, ett lager
djupare än `esc()`. Appen använder därför delegerade lyssnare (`data-goto-tab`, `data-dismiss-parent`). *Gäller i dag:*
`skydd.md` S1, `docs/dataskydd/riskanalys.md` §6.1 och `bygge-och-test.md` §2.

**ADR-10 — Sidopanelen är navigation, inte ARIA-tabs.** Sidomenyn är navigation, med `aria-current="page"` på den
aktiva knappen och alla knappar i Tab-ordningen; pil-, Home- och End-tangenterna är ett tillägg, och bara de äkta
flikraderna har tablist-mönstret. En meny som byter sidans huvudinnehåll är navigation. *Avvisat:* tablist-mönstret för
menyn, som bara tillåter `role="tab"`-barn (menyn hade då en hopfällbar grupp). *Gäller i dag:* `granssnittet.md` §1.

**ADR-12 — Redovisningsformen för minsta gruppstorlek: utelämna och namnge.** En grupp under tröskeln utelämnas i det som lämnar
verktyget och namnges i en not; är bara könsuppdelningen för liten redovisas gruppens samlade median. *Avvisat:* en rad
med `< 10` i varje mätvärde (värdelös, långa tabeller), och att utelämna grupper där bara ena könet är litet (i
EU-matrisen har grupperna ofta 14–17 personer men 2–3 av ena könet). *Gäller i dag:* `k-troskeln.md` §2 och §4.

**ADR-13 — `VERSION` är enda källa för versionsstämpeln.** Stämpeln gör ett resultat spårbart till en beräkningsversion.
Byggdatumet härleds ur versionen, inte ur systemklockan, som skulle ge ny SHA-256 vid varje bygge. *Gäller i dag:*
`bygge-och-test.md` §3.

**ADR-14 — Tabeller och egna vyer visar små grupper; exporten utelämnar dem.** Exporten ur fliken bär små grupper bara
när användaren kryssar i rutan, ett beslutat undantag; den som använder verktyget har redan rådatan. *Avvisat:*
differensskydd mot att räkna fram en liten grupp ur två filtrerade urval. *Gäller i dag:* `k-troskeln.md` §2 och §4.

**ADR-15 — Formler i CSV- och urklippsexport neutraliseras.** En textcell som kan bli en formel får ett inledande
`'`, så att en fientlig lönefil inte kan lägga en formel i en export; tal lämnas orörda. *Gäller i dag:*
`exporterna.md` §2 och `docs/dataskydd/riskanalys.md` §6.6.

**ADR-16 — Inga paragrafhänvisningar i gränssnittet, och sedan 2026-10-19 inte heller i hjälptexter eller exporter.**
Verktyget hänvisar övergripande, aldrig med paragraf- eller artikelnummer, och lagrummen står bara i `lagrum.md`: 3 kap.
numreras sannolikt om när direktivet genomförs, och genomgången 2026-10-19 fann sju hänvisningsformer och flera
felaktiga paragrafer i koden. *Gäller i dag:* `lagrum.md` och princip 1 i `principer.md`.

**ADR-17 — `runOLSRegression` får aldrig cachas.** Regressionen räknas alltid om; ett resultat får bara skickas vidare
som argument inom samma varv. Ett inaktuellt resultat i en juridisk analys är ett allvarligt fel, 250 ms per rendering
är det inte. Förhandsbeskedets minne i `58-rapportmodell.js` är ingen sådan cache: det bär inga resultat, och ingen fil
ritas ur det. *Avvisat:* cache eller memoisering. *Gäller i dag:* `regressionsmodellen.md` §1.

**ADR-19 — Underlagets kvalitet: svagaste länken avgör.** Fem kriterier med status OK, Varning eller Kritisk, och
helheten är det sämsta (`src/lib/datakvalitet.js`). Kompliansöversikten och åtgärdslistan räknar bara jämförbara
BAS-intervall, så att en röd ruta aldrig står bredvid en tom åtgärdslista. *Avvisat:* en viktad summa, där en allvarlig
brist späds ut. *Gäller i dag:* `docs/anvandare/korguide.md` §3.

**ADR-20 — Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget.** Rapportunderlaget
(`src/lib/rapportunderlag.js`) ger kopierbara block som formaterad text utan typsnitt och färger, så att organisationens
egen Word-mall tar över formatet. Bedömningen av sakliga skäl kräver kunskap som bara verksamheten har och skrivs
utanför verktyget. *Gäller i dag:* `mal.md` (avgränsningen) och `k-troskeln.md` §2 och §7.

**ADR-21 — Alla BAS-intervall ingår (upphävd begränsning).** Till och med 2026.10.19 analyserades bara BAS A–J;
begränsningen hävdes efter användartest. *Gäller i dag:* `mal.md` (avgränsningen).

**ADR-22 — Var uppstår löneskillnaden? Uppdelning på medellön.** Skillnaden i medellön delas i delar som summerar exakt,
symmetriskt utan referenskön, och grupperna rangordnas efter bidrag i kronor; Blinder-Oaxaca säger hur mycket som är
förklarat, men inte var. *Avvisat:* uppdelning på median, där delarna inte summerar. *Gäller i dag:*
`regressionsmodellen.md` §10.

**ADR-23 — Personer att granska: individlista i verktyget, aldrig i utdata.** Panelen i Lika arbete listar personer
vars lön ligger en inställbar andel under en förväntad lön ur kollegorna i samma grupp, så att enskilda avvikelser går
att granska, och listan lämnar aldrig verktyget. Personen identifieras med filens radnummer, så att ingen ny
identifierare samlas in. *Gäller i dag:* `granssnittet.md` §5 och `k-troskeln.md` §4.

**ADR-24 — Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering.** En flaggad grupp märks *skör* om
skillnaden kan hamna under storleksgränsen när en eller två personer tas bort, annars *stabil*, och flaggan ligger kvar.
Det räcker att pröva ytterlägena och positionerna inom 2 från medianen, verifierat mot uttömmande prövning
(`likaArbeteGrupper` i `src/lib/rapportunderlag.js`). *Gäller i dag:* `docs/anvandare/korguide.md` §4.

**ADR-25 — Lägre krav, högre lön: jämförelse över BAS-gränserna.** En egen lista jämför kvinnodominerade AID-etiketter
med organisationens egna jämförelseetiketter i strikt lägre BAS, så att kandidatparen inte beror på antagandet att BAS-ordningen
speglar kraven. *Avvisat:* en reserv ur jämförelsestatistiken (dubbelt osäker). *Gäller i dag:*
`likvardighetsmodellen.md` §6–§7.

**ADR-28 — Organisationspaket; ingen inbyggd organisation.** Verktyget har ingen inbyggd organisation eller referens;
utan ställningstagande visas ett tomläge. Benämningar, grundinställningar, ställningstagande, jämförelsestatistik och
importprofiler kommer ur ett organisationspaket som handläggaren läser in i ett steg. *Gäller i dag:* `skydd.md` S5,
`docs/anvandare/organisationspaket.md` och `.github/CONTRIBUTING.md` (importprofiler).

**ADR-29 — Ett steg är klart när dess punkter är hanterade.** Processöversikten markerar ett analyssteg som klart när
arbetet är gjort, med stegets punkter i Att göra avbockade, inte när analysen har körts. *Börja här* sorterar efter
prioritet och inom samma prioritet underlaget först, sedan fynden om skillnader mellan kvinnor och män. *Gäller i dag:* `granssnittet.md` §2.

**ADR-30 — Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden.** Alla `style="…"` är ersatta
av klasser, och CSP:n har `style-src-elem` med kontrollsummor och `style-src-attr 'none'`; beroendena är låsta
(`vendor/SHA256SUMS`, CI-stegen på commit-SHA). *Gäller i dag:* `bygge-och-test.md` §4, `skydd.md` S1 och
`docs/dataskydd/riskanalys.md` §6.1.

**ADR-31 — Interna fel rapporteras i stället för att sväljas.** En analysdel som ska tåla fel hoppar över sin del,
men felet visas i en banner och i konsolen, där siffrorna är maskerade: ett tyst ofullständigt resultat är värre än ett
synligt fel, och konsolen ska aldrig bära lönedata. *Gäller i dag:* `granssnittet.md` §6.

**ADR-33 — AID-hierarki, översikt per huvudområde, ansvarskod och kodkvalitet.** Huvudområdet i AID är en översikt
och en dimension, inte ett globalt filter, som skulle ändra alla flikars resultat och minsta gruppstorlek samtidigt.
Ansvarskoden är valfri och redovisas bredvid huvudresultaten; huvudtalet räknar inte bort den, eftersom om ansvaret är
ett sakligt skäl är arbetsgivarens bedömning. *Gäller i dag:* `granssnittet.md` §3, `docs/anvandare/datauttag.md` och
`docs/dataskydd/riskanalys.md` §6.4.

**ADR-34 — SKR:s personalstatistik som referens för kvinnoandel.** Kvinnoandelen per AID-etikett kommer ur SKR:s
personalstatistik, en källa med dokumenterat ursprung som täcker etikettlistan; den är reserven i Likvärdigt arbete och
ett referensvärde bredvid organisationens egen könsfördelning, och påverkar inga k-regler. *Gäller i dag:*
`likvardighetsmodellen.md` §4.

**ADR-35 — Jämförelsestatistik: alla percentiler i en tabell och två diagram.** Tabellen, diagrammen och Excel-filen
läser samma rader med P10, median och P90 (`src/lib/jamforelse.js`), så att de inte kan säga olika saker. *Avvisat:* en
egen gräns på 20 personer för P10 och P90: värdet pekar inte ut vem, och medianen har samma egenskap vid udda antal.
*Gäller i dag:* `granssnittet.md` §4.

**ADR-36 — Filrutorna syns alltid; namn på organisationen och jämförelsestatistiken.** Filrutorna syns alltid, så att
ställningstagandet och statistiken aldrig döljs bakom en hopfälld rad. `orgNamn` och `jmfNamn` (`src/app/07-standardinstallningar.js`) är
enda källan för etiketterna, och namnfälten avvisar text som liknar personnummer eller e-post. *Gäller i dag:*
`skydd.md` S5.

**ADR-37 — Word-utkastet som riktig .docx.** Utkastet skrivs som Office Open XML (`src/lib/docx.js`), eftersom HTML
med ändelsen `.doc` får Word att varna och öppna filen i skyddad vy. *Avvisat:* inbäddad HTML (altChunk), som Word på
webben, LibreOffice och Google Dokument inte hanterar. *Gäller i dag:* `exporterna.md` §3.

**ADR-38 — K-tröskeln är en inställning.** Minsta gruppstorlek är en inställning, standard 10, tillåtet 2–1000, så att
en arbetsgivare med egna riktlinjer kan följa dem; en sänkning under 10 kräver bekräftelse och ger en varning som inte
går att stänga. *Avvisat:* "bara höja", "golv vid 5" och "styrt av organisationspaketet"; upphovspersonen valde "fritt,
med varning". *Gäller i dag:* `k-troskeln.md` §1, §3 och §5–§10.

**ADR-39 — Diagramkärna på D3 med eget figurformat.** Vyerna bygger en figur (ren data), och `ritaFigur` gör SVG av den
med D3, så att varje datapunkt bär gruppnyckel och `liten`-flagga och skyddet för små grupper ligger på ett ställe.
*Gäller i dag:* `diagramkarnan.md` §1–§8 och §10, och `k-troskeln.md` §4.

**ADR-40 — Fyra exporter med var sin uppgift, ritade ur en rapportmodell.** Word-utkastet är rapporten, Excel-filen
underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt; Word och PDF ritas ur samma rapportmodell,
så att de inte kan glida isär. *Avvisat:* eget innehåll i PDF-rapporten (två sanningar), och särskilda sammanställningar
för ledningsbriefen. *Gäller i dag:* `mal.md` (*Exportera*), `exporterna.md` §1 och `k-troskeln.md` §3.

**ADR-41 — Flikmallen: resultatet först.** Varje flik har en rad om vad den svarar på, urvalet, nyckeltalen i en rad,
huvudresultatet och under *Fördjupning* hopfällbara avsnitt, så att huvudresultatet inte ligger flera skärmar ned.
Verktyget anpassas för datorskärm, surfplatta och delat fönster, aldrig för telefon (användarens beslut). *Avvisat:* ett
kort per nyckeltal: texten fyller 3–31 % av kortens yta. *Gäller i dag:* `mal.md` (*Gränssnittets form*).

**ADR-42 — Diagrammens form och färg väljs efter uppgiften; tabell med grafik i raden där ett diagram visar för lite.**
Ett nytt diagram ses med många grupper innan det är klart. *Avvisat:* kumulativ fördelningskurva per kön (varje steg är
en person), Lorenzkurva (mäter ojämlikhet inom en grupp), flöden och tidsserier (årsbokslutet bär två år).
*Gäller i dag:* `diagramkarnan.md` §10.

**ADR-43 — Färgerna har en källa.** Färger som måste vara värden (Word, urklipp, arbetsboken, diagrammens attribut) står
i `FARG` i `src/app/01-farger.js`, speglad i stilmallens `:root`, och flikarnas mallar väljer en klass per status.
Statusfärgerna har minst 4,5:1 mot vitt och mot sin botten, och i diagrammen minst 3:1. *Gäller i dag:*
`bygge-och-test.md` §4, `diagramkarnan.md` §10 och princip 4 i `principer.md` (`tests/farger.test.js`).

**ADR-44 — BAS som indikatorvariabler i huvudregressionen.** BAS kodas som en indikator per intervall i stället för ett
linjärt tal, som lämnade BAS-nivåskillnader kvar i det oförklarade gapet. *Gäller i dag:* `regressionsmodellen.md` §1,
§3 och §4.

**ADR-45 — t-kvantiler för konfidensintervallen; exakt t-fördelning.** Intervallen räknas med t(0,975; n−k) i stället
för 1,96, och `tDistCdf` är exakt i stället för Hills approximation, eftersom per-BAS-regressionerna ofta har df kring
20–40. *Gäller i dag:* `regressionsmodellen.md` §7.

**ADR-46 — Steget *+ AID-etikett inom BAS*: könsgapet med fasta effekter för AID-etikett inom BAS.** Den stegvisa
uppdelningen får ett sista steg med fasta effekter för AID-etikett i BAS-intervall (inomtransformation), eftersom
huvudmodellen lämnar löneskillnader mellan AID-etiketter i samma BAS i det oförklarade gapet. Steget blev inte huvudtalet; sedan ADR-56 kan det väljas in. *Gäller i dag:*
`regressionsmodellen.md` §4.

**ADR-47 — Organisationspaketet kan låsa tre skydd.** Paketet kan låsa ett golv för tröskeln, rensningstiden och om små
grupper får följa med i exporten, eftersom systemägaren annars inte kunde tvinga något av dem. *Avvisat:* att golvet
gäller alla senare paket utan fråga (en organisation måste kunna byta paket). *Gäller i dag:* `k-troskeln.md` §6 och
`docs/anvandare/organisationspaket.md` §5.

**ADR-48 — Bilder med en punkt per person följer med i ZIP och Komplett rapport.** Bilderna bär inga namn eller
identifierare, en punkt ritas bara när personens grupp och kön når tröskeln, och filerna hanteras som personuppgifter.
*Avvisat:* att utelämna bilderna eller ersätta dem med aggregat. *Gäller i dag:* `k-troskeln.md` §4 och
`docs/dataskydd/dataskydd.md` §3–§4. *Not:* ADR-85 ändrade en förutsättning. Texten i fältet för AID-etikett maskeras inte
längre, så punktdiagrammet färgat efter AID-etikett bär filens text som serienamn, i förklaringen och i diagrammets data.

**ADR-49 — Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida.** Paketet bakas in som ett inaktivt
block efter sista skriptet, så att CSP:ns kontrollsummor är orörda; filen verifieras inte mot den publicerade versionen
(beslut 2026-10-19). *Avvisat:* automatisk inläsning av en paketfil i samma mapp, som `connect-src 'none'` och
webbläsaren gör omöjlig. *Gäller i dag:* `organisationsfil.md`. *Not (2026-11-24):* systemförvaltaren har en egen
flik, *För systemförvaltaren*, sist i menyn och aldrig låst, med paketet, verktygsfilen och nedladdningen i tre steg;
formuläret flyttade dit från Filer och kvalitet. Rutan *Flytta till en ny version* flyttar paketet ur den gamla
organisationsfilen till en ny releasefil utan separat paketfil, och filrutan visar en rad när paketet avser ett
tidigare år (för förra årets paket från och med 1 mars). Verktyget verifierar fortfarande inte filen; IT kan göra
det för hand, eftersom filen utan blocket är releasefilen (`organisationspaket.md` avsnitt 3b). Formatet och
skydden är oförändrade.

**ADR-50 — Prioritering är vad, Löneöversyn är hur.** Prioritering svarar på vad som bör åtgärdas och vad det kostar;
Löneöversyn på hur potten fördelas, och lönerevisionssimulatorn i Prioritering är borttagen. *Gäller i dag:*
`prioriteringsmodellen.md` och `loneoversynsmodellen.md` §4.

**ADR-51 — Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen.** Tröskeln är 1 i skärmläget och den
inställda i exportläget, som allt som lämnar verktyget körs i; den som arbetar i verktyget har redan lönefilen.
*Gäller i dag:* `k-troskeln.md` §1 och §3.

**ADR-52 — Egna tabeller i rapporten som recept, inte tal.** En vy i Tabeller och egna vyer läggs i rapporten som ett
recept (`src/lib/tabellrecept.js`) som ritas om i exportläget med flikens exportregler, och avsnittet per BAS-intervall
följer också ett recept (`src/lib/perbas.js`). Recepten bärs av konfigurationsfilen och kan bäras av
organisationspaketet. *Gäller i dag:* `docs/anvandare/organisationspaket.md`.

**ADR-53 — Blinder-Oaxaca med BAS som indikatorer.** Uppdelningen räknar på samma variabler som huvudtalet, så att
kortets förklarade och oförklarade del vilar på samma grund. *Avvisat:* den linjära rangen (undantaget i ADR-44).
*Gäller i dag:* `regressionsmodellen.md` §5.

**ADR-54 — Jämförelse mellan år genom ett årsbokslut i konfigurationsfilen.** Bokslutet (`src/lib/arsbokslut.js`) bär
aggregat, aldrig individer, och jämförelsen läser båda åren med den högre av årens trösklar. *Avvisat:* en egen
bokslutsfil, eftersom konfigurationsfilen redan är den som sparas när arbetet är klart. *Gäller i dag:*
`docs/dataskydd/riskanalys.md` §6.8 och `k-troskeln.md` §9.

**ADR-55 — Löneläget mot båda referenserna, Lönepolitik som avsnitt.** Fliken Löneläget samlar lönerna mot
ställningstagandet och mot statistiken. Ställningstagandet är referenspunkten, och *Förslaget på referens* är ett
förslag: inget dolt tröskelvärde avgör något. *Gäller i dag:* `mal.md` (*Löneläget*).

**ADR-56 — Valbar förklaringsmodell.** Handläggaren väljer vilka variabler som räknas bort i huvudtalet, med
fullmodellen som utgångsläge, eftersom ålder i varje tabell är pedagogiskt onödigt när den förklarar en bråkdel.
*Gäller i dag:* `regressionsmodellen.md` §2, §4–§5 och `k-troskeln.md` §1.

**ADR-57 — Tabellerna per AID-kod och BAS-intervall.** Fyra tabeller på den nivå lika arbete gäller
(`src/lib/aidbas.js`), med ett avsiktligt avsteg för små grupper, eftersom lagen kräver att också de analyseras;
lönemånaden anges i Inställningar och gissas inte. *Gäller i dag:* `k-troskeln.md` §4–§5 och `likvardighetsmodellen.md`
§2.

**ADR-58 — BAS-dossiern: ett BAS-intervall på en sida.** En dialog (`81-basdossier.js`), inte en flik, samlar ett
intervall ur fem flikar, utan ny statistik. *Gäller i dag:* `docs/anvandare/korguide.md` §4 och `k-troskeln.md` §9.

**ADR-59 — Uppmärksamhetstrappan på statistisk signal, direktivmarkeringen åtskild.** Statusen sätts på statistisk
signal och storleksgränsen 3 % (`src/lib/status.js`), och 5 % är en direktivmarkering, ingen status; förut kunde en
grupp med 18 kvinnor och 2 män bli *Värt att granska* på storleken ensam. *Gäller i dag:* princip 3 i `principer.md`,
`docs/anvandare/korguide.md` §4 och `regressionsmodellen.md` §7.

**ADR-60 — Jämförelseetiketterna i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av
kvinnodominerat.** Förut föll blandade AID-etiketter (40–60 % kvinnor) bort; ett filter återskapar det tidigare urvalet.
*Gäller i dag:* `likvardighetsmodellen.md` §2, §4 och §8.

**ADR-61 — Minsta skillnad 0 % som standard i likvärdigt arbete.** Alla par visas och 5 % är ett valbart filter,
eftersom ett par med 2 % skillnad annars aldrig syntes. *Gäller i dag:* `likvardighetsmodellen.md` §5 och §8.

**ADR-62 — Prioriteringens egna ord för läget mot referensen.** Prioriteringens statusar hette som trappan för
skillnaden mellan kvinnor och män, fast de mäter löneläget mot referensen; de har nu egna ord, med oförändrade gränser.
*Gäller i dag:* `prioriteringsmodellen.md` §3.

**ADR-63 — Kvantilregressionen på huvudmodellens design, villkorad tolkning.** Kvantilregressionen räknar på samma
design som huvudtalet, och glastak eller klibbigt golv sägs bara när intervallet för P90 − P10 utesluter noll.
*Gäller i dag:* `regressionsmodellen.md` §3 och §6.

**ADR-64 — Ålder är valfri i lönefilen.** En lönekartläggning förutsätter ingen ålderskolumn, och uppgiftsminimeringen
talar för att den ska kunna lämnas utanför. *Gäller i dag:* `regressionsmodellen.md` §8.

**ADR-65 — Var uppstår löneskillnaden: valbara förklaringsvariabler.** Handläggaren väljer och ordnar en till fyra
variabler; standardvalet ger samma tal som före beslutet. *Gäller i dag:* `regressionsmodellen.md` §10.

**ADR-68 — Arkitekturbeslutens form: beslut i mall, gällande lydelse i referenserna.** Hur något fungerar i dag står i
referensen för området, och loggen behåller motiven och numren. *Avvisat:* ett beslut per fil (löser inte kedjorna); att
ersätta loggen med områdesdokument (motiven och numren tappas); en sammanfattning av nuläget (en plats till att hålla i
synk). *Gäller i dag:* inledningen ovan och `.github/GOVERNANCE.md`.

**ADR-69 — Löneöversyns förslag följer den inställda tröskeln.** Förslagen tar aldrig ett par där en grupp är under den
inställda tröskeln, oavsett läge, och tar ett par per kvinnodominerad AID-etikett, eftersom beloppet räknas ur en grupps
median. *Avvisat:* att stoppa förslagen bara i exporten (summorna skulle skilja sig); ett avsteg; parets identitet som
nytt fält i konfigurationsfilen. *Gäller i dag:* `k-troskeln.md` §1–§2, §8 och §9.

**ADR-70 — Skyddet gäller lönemått; antal och andelar är handläggarens ansvar.** Regressionens BAS-effekter, livscykelns
lönekurva och Löneöversyns kostnader per grupp är lönemått och följer tröskeln; antal och andelar gör det inte utöver de
beslutade golven. *Avvisat:* en generell regel om antal och andelar (prövad 2026-11-13: den rörde nästan varje tabell);
för Löneöversyns summor att stryka kostnadskolumnen eller låta differensen stå. *Gäller i dag:* `k-troskeln.md` §2, §9
och §11.

**ADR-71 — Trappan i livscykeln, protokollet och Prioriteringen; ingen färg på storleken ensam.** Livscykelns nyckeltal
och protokollets BAS-intervall följer trappan, och en skillnad mellan kvinnors och mäns lön färgas inte på storleken
ensam. *Avvisat:* en fast gräns för tabellcellernas färg; att pröva *Skillnad kön* i Prioriteringen (två utslag för
samma fråga); att välja på det råa p-värdet. *Gäller i dag:* `regressionsmodellen.md` §7 och punkt 9e i `oppna-punkter.md`.

**ADR-72 — Definitionerna av kvinnodominerat heter efter lydelsen.** Valen heter *Mer än X %* och *X % eller mer*;
nycklarna `'do'` och `'scb'` står kvar för sparade filer. Etiketten SCB hade inget stöd. *Avvisat:* att döpa valen efter
propositionens två ställen; att byta nycklarna. *Gäller i dag:* `likvardighetsmodellen.md` §2 och §8, och `lagrum.md`.

**ADR-73 — Skydden och principerna binder; besluten är en logg.** Det som binder är skydden S1–S5 och de sex
principerna. Besluten är loggen över vad som valdes och varför, i en till tre meningar, och ett designval ändras genom
att referensen och koden ändras i samma ändring. Regelmatrisen, kvalitetskraven K1–K10 och den tekniska planen är
borttagna; mål och öppna punkter har var sitt korta dokument. *Avvisat:* att låta varje beslut binda med full lydelse,
som gjorde att en liten ändring krävde rättelser på många ställen. *Gäller i dag:* `skydd.md`, `principer.md` och
`.github/GOVERNANCE.md`.

**ADR-74 — AID:s egna ord, och termerna på ett ställe.** Verktyget säger AID-etikett, AID-kod, etikettnamn och
huvudområde, som handboken för kodning, i stället för *yrke* och *yrkesgrupp*, och analysenheten är AID-etikett i
BAS-intervall. Orden står som variabler med ordformer och genus i `src/lib/termer.js`, så att en annan uppsättning byts
på ett ställe, och vakten i `tests/termer.test.js` håller dem borta från resten av gränssnittet. *Avvisat:* påhittade
ord (grupp, AID-grupp), som inte blev tydligare; att behålla *yrke*, som handboken inte använder om
etiketterna. *Gäller i dag:* `src/lib/termer.js` och `bygge-och-test.md` §13.

**ADR-75 — Kort ordform i kolumnrubriker, och Word-utkastets täta läge.** En kolumnrubrik där hela termen inte ryms
får begreppets korta form (*AID* för AID-etikett), på skärmen och i rapporten, medan exporternas etiketter behåller hela
termen; en tabell i Word-utkastet som inte ryms skrivs tätare. *Avvisat:* rubriken «Jämförelseetikettens median högre
med», som inte rymdes. *Gäller i dag:* `bygge-och-test.md` §13 och `exporterna.md` §3.

**ADR-76 — Poängläget jämför bara med organisationens egna jämförelseetiketter.** Med arbetsvärderingspoäng i
lönefilen används jämförelsestatistiken inte längre som reserv. Statistikens rader har inga egna poäng; en rad fick
poäng bara när organisationen själv hade samma AID-kod och BAS-intervall, och jämförde då oftast den kvinnodominerade
AID-etiketten med sig själv i statistiken, inte med ett likvärdigt arbete. I mätningen på demona med den nationella
andelen kvinnor användes reserven aldrig. *Avvisat:* att behålla reserven; att ge statistikens rader poäng efter
AID-kod ensam, som jämför samma arbete i olika BAS-intervall. En extern jämförelse i poängläget kräver en egen
poängtabell för statistiken. *Gäller i dag:* `likvardighetsmodellen.md` §4.

**ADR-77 — HC3 med AID-etikett inom BAS räknas med den fulla designens hävstång.** Med AID-etikett inom BAS vald in i
huvudtalet räknas HC3 med den fulla designens hävstång och utan skalning, så att standardfelen blir de som statsmodels
och R ger med en indikator per grupp (principen 2). Med hävstången på de transformerade kolumnerna ensam var
standardfelet för kön 1,0–1,6 % för litet i det lilla demot och upp till 9 % i urval med små grupper, utan att någon
status i trappan ändrades. *Avvisat:* att behålla beräkningen och stänga punkten som mätt; att behålla skalningen
ovanpå den fulla hävstången. *Gäller i dag:* `regressionsmodellen.md` §4.

**ADR-78 — Översikten per huvudområde räknar med huvudregressionens kodning.** Den justerade skillnaden per huvudområde
räknas som huvudregressionens standardmodell, med BAS-intervallen som indikatorer, och ger inget tal när BAS inte går
att justera för. Med BAS som rang lades en del av BAS-skillnaden på kön (upp till 2,1 procentenheter i det lilla
demot), och utan ålder i lönefilen gav översikten inget tal alls. *Avvisat:* att behålla BAS som rang och kravet på
ålder; att också följa förklaringsmodellen, som skulle ändra översikten när någon väljer variabler i en annan flik;
huvudregressionens reservsteg utan BAS, som i det läget visar den råa skillnaden (eller den bara åldersjusterade)
under en rubrik som säger BAS. *Gäller i dag:* `regressionsmodellen.md` §3.

**ADR-79 — Protokollet redovisar median och medelvärde, och har fält för löneökning efter ledighet, utvärdering och
arbetsvärdering.** Protokollet för gemensam lönebedömning redovisar median och medelvärde per kön, så att direktivets
genomsnittliga lönenivåer täcks, medan urvalet och statusen följer medianen och regressionen som förut. Försättssidan
har fält för de led som underlaget inte kan räkna. *Gäller i dag:* `exporterna.md` §4 och `lagrum.md`, avsnittet om
protokollet för gemensam lönebedömning.

**ADR-80 — Flikbytet ritar först och räknar sedan.** När användaren själv byter flik blir fliken synlig och sidan
målas innan fliken räknas, och tunga block som inte syns överst ritas efteråt, vart och ett i en egen uppgift; inget
resultat sparas mellan uppgifterna (ADR-17). *Avvisat:* en arbetstråd (ADR-1); att återanvända regressionen mellan
flikarna, som kräver en ändrad ADR-17; att visa flikens gamla innehåll medan den räknas. *Gäller i dag:*
`k-troskeln.md` §3.

**ADR-81 — En färdigritad flik visas igen när ingenting har ändrats.** En flik som användaren byter tillbaka till
visas som den är, utan omritning, när ingenting som kan ändra den har hänt sedan den ritades, avgjort med en
visningsversion som ökar grovt hellre än fint. Det som återanvänds är flikens ritade innehåll; regressionen och andra
resultat cachas aldrig (ADR-17). *Avvisat:* att spara regressionen eller andra resultat mellan flikarna; att avgöra per
flik vad som påverkar den, som är finare men lättare att få fel än att rita om allt efter varje ändring. *Gäller i dag:*
`k-troskeln.md` §3.

**ADR-82 — Bara dator: verktyget anpassas inte för surfplatta eller telefon.** Ändrar ADR-41, som också nämnde
surfplatta. Verktyget utformas för datorskärm (användarens beslut). Ett smalt eller delat fönster på datorn ska fungera:
menyn fälls ihop bakom en knapp och sidan går inte utanför fönstret. Tabeller och diagram utformas däremot inte för en
liten skärm, och brister som bara syns på surfplatta eller telefon prioriteras inte. Användardokumenten sade redan att
surfplatta och mobil inte stöds; ADR-41 var det enda som sade annat. *Avvisat:* att anpassa för surfplatta, som skulle
kräva en egen form för tabellerna och diagrammen för en användning som inte efterfrågats. *Gäller i dag:* `mal.md`
(*Avgränsning*).

**ADR-83 — Kompletterande undertryckning i tabellerna per BAS-intervall.** Beslutat av underhållaren 2026-11-19.
Tabellerna per BAS-intervall undertrycker också medelvärdena för de minsta visade delarna när de utelämnade delarna
tillsammans är färre än tröskeln, och raden *Alla* står kvar räknad på hela underlaget. Förut gav totalen minus de
visade raderna en utelämnad grupps medellön (S4). *Avvisat:* att räkna raden *Alla* bara på de visade grupperna, som
ändrar vad raden betyder; att utelämna raden *Alla*. *Gäller i dag:* `k-troskeln.md` avsnitt 2.

**ADR-84 — PO-påslagets standardvärde är 40 %, ett antagande utan källhänvisning.** Beslutat av underhållaren
2026-11-19. Kostnadsberäkningen räknar med PO-påslaget 40 % tills organisationen sätter sitt eget, i fältet under
Inställningar eller i organisationspaketet. Förut räknade verktyget med 39,15 % och en hänvisning till ett cirkulär för
kommuner och regioner, utan cirkulärets nummer. Påslaget skiljer sig mellan arbetsgivare och år, så standardvärdet är
ett avrundat antagande och gränssnittet säger det, utan att namnge någon källa. Organisationspaketets egen not om
påslaget (`poNot`) finns kvar; verktygets standard har ingen not. *Avvisat:* att behålla 39,15 % med hänvisningen, som
saknar exakt källa och gäller bara en del av arbetsgivarna (S5). *Gäller i dag:* `COST_DEFAULTS` i
`src/lib/kostnad.js`.

**ADR-85 — Fältet för AID-etikett maskeras inte; inläsningen varnar för personnamn.** Beslutat av underhållaren 2026-11-20.
Ingenting i texten i fältet för AID-etikett maskeras, och inläsningen varnar i stället när fältet ser ut att innehålla
personnamn; det ändrar ADR-48, eftersom bilderna med en punkt per person kan bära filens text. Den gamla maskeringen
förstörde riktiga etiketter ("Sjuksköterska Natt" blev "***") och skyddade inte ("Sjuksköterska Anna Andersson" blev
"*** Andersson"), och användaren ska hellre få veta att namn finns än tro att de är maskerade. *Avvisat:* att maskera
alla versalinledda ord, som förstör riktiga etiketter; att behålla den gamla maskeringen; att ersätta filens text med
etikettlistans namn, som tar bort organisationens lokala benämningar. *Gäller i dag:* `docs/dataskydd/riskanalys.md`
§6.4.

**ADR-86 — Slumpintervallen är en funktion av lönerna, inte av radordningen, och percentilindexen är symmetriska.**
Beslutat av underhållaren 2026-11-19. Bootstrapen, omkastningen och kvantilbootstrapen drar ur listor sorterade på en
fast nyckel, och percentilintervallet har lika många dragningar på var sida. Samma löner i en annan ordning gav förut
andra gränser (bootstrapintervallet i 200 fall av 200), så en grupp nära gränsen kunde få
olika status beroende på hur filen var sorterad, och den gamla indexregeln lade 25 dragningar under den nedre gränsen
men 24 över den övre. *Avvisat:* att bara seeda ur den sorterade listan och fortsätta dra ur filens ordning, som inte
tar bort beroendet; att lämna indexen, vars fel är litet men alltid drar åt samma håll. *Gäller i dag:*
`regressionsmodellen.md` avsnitt 6–7, `likvardighetsmodellen.md` avsnitt 5, `src/lib/rng.js`.

**ADR-87 — Sammanslagning av små grupper i uppdelningen av löneskillnaden och huvudområdenas andel.** Beslutat av
underhållaren 2026-11-20. Ändrar skyddsregeln i ADR-65 (och ADR-22): i exportläget räknas grupper där ett kön har 1
till k − 1 personer samman med andra innan delarna räknas, efter principen i ADR-83. Delarna och posterna bildade med
medellönerna och antalen ett ekvationssystem, så att en liten grupps medellön gick att räkna fram (med två
huvudområden gav beloppet direkt det lilla könets medellön), och att korta topplistan räckte inte. *Avvisat:* att
undertrycka delar och poster, som oftast skulle ta bort hela uppdelningen ur exporten, eftersom en dold del går att
räkna fram ur de andra; att pröva numeriskt vad som går att lösa ut ur varje utskrift, som är svårare att granska;
att bara dölja fler poster, som inte stänger vägen genom delarna.
*Gäller i dag:* `regressionsmodellen.md` §10 och `k-troskeln.md` avsnitt 2.

**ADR-88 — Differensprovet är en del av invarianten för minsta gruppstorlek.** Beslutat av underhållaren 2026-11-19.
Ändrar vakten för S4, inte dess lydelse: invarianten prövar också att ingen total minus de visade delarna lämnar en
grupp under tröskeln, och varje tabell med medel, summa eller kostnad ska vara deklarerad i riggen. Förut vaktades
sådana differenser av prov som skrevs för hand, så en ny utdata fick inget prov om ingen skrev ett; nu ärver den
provet. *Avvisat:* att känna igen kolumnerna ur rubriktexterna, som tyst kan sluta fungera när en rubrik ändras; att
pröva varje delmängd av rader utan riggens kunskap om underlaget, som ger falsklarm när ett antal råkar gå jämnt upp;
att lösa ett ekvationssystem över hela exporten, som är svårare att granska. *Gäller i dag:* `skydd.md` S4 och
`k-troskeln.md` avsnitt 9 och 11.

**ADR-89 — En grupp är AID-koden i BAS-intervallet, i hela verktyget.** Beslutat av underhållaren 2026-11-20. Allt som
räknar på samma arbete grupperar på AID-koden i BAS-intervallet, också Lika arbetes tabell, och gruppens namn är
texten som står på flest av gruppens rader. Sedan texten inte maskeras (ADR-85) kan en kod ha flera texter, och samma
personer blev då en grupp i en vy och två grupper under tröskeln i en annan. *Avvisat:* att fortsätta gruppera på
texten och bara varna; att ersätta texten med etikettlistans namn (avvisat i ADR-85); att låta Lika arbetes tabell
räkna koden över alla intervall, som ger en status för personer på olika nivåer; att para ett äldre boksluts rad för
koden med årets största grupp, som jämför olika grupper; att höja bokslutets formatversion, som inte behövs när
fältet är valfritt; att låta gruppens namn vara texten på dess första rad, som beror på radordningen. *Gäller i dag:* `prioriteringsmodellen.md` §1,
`likvardighetsmodellen.md` §3, `k-troskeln.md` avsnitt 2, `sparbarhet.md` (grupperna och §8).

**ADR-90 — Lika arbete AID x BAS visar Lika arbetes status, utan egen bedömning.** Beslutat av underhållaren
2026-11-20. Ändrar ADR-57 för tabellen *Lika arbete AID x BAS*: den räknar ingenting eget, utan visar Lika arbetes
grupper med samma k-regel och samma status. Med en egen bedömning mot gränserna och ett eget golv på fem personer
kunde samma grupp få olika svar i de två tabellerna och stå i den ena fast den andra utelämnade den under tröskeln.
*Avvisat:* att ta bort tabellen, som är den form en skriven lönekartläggning brukar ha; att behålla bedömningen mot
gränserna bredvid statusen, som ger två svar på samma fråga; att behålla golvet fem för tabellen. *Gäller i dag:*
`k-troskeln.md` avsnitt 4 och 9, `docs/dataskydd/riskanalys.md`, `sparbarhet.md` och
`docs/anvandare/korguide.md` §4.

**ADR-91 — Kompletterande undertryckning i JPA-protokollets blad för lika arbete mot intervallens medelvärden.**
Beslutat av underhållaren 2026-11-20. Tillämpar regeln i ADR-83 mellan tabeller: lämnar ett intervalls medelvärde
minus de visade AID-etiketterna i protokollets blad för lika arbete färre än tröskeln, döljs medelvärdena för den
minsta visade etiketten; beslutet prövade också mot tabellerna per BAS-intervall och mot organisationens medelvärden,
vilket ADR-92 tog tillbaka. Intervallets antal och medelvärde minus de visade etiketterna gav medelvärdet för
intervallets övriga personer också när de var färre än tröskeln, och differensprovet prövade bara inom en tabell.
*Avvisat:* att räkna intervallets rad bara på de visade etiketterna, som ändrar vad raden betyder; att dölja
intervallets medelvärden, som tar bort det mått tabellerna finns för; att låta differensprovet pröva varje par av
tabeller, som ger falsklarm när två tabeller har olika underlag. *Gäller i dag:* `k-troskeln.md` avsnitt 2, 9 och 11,
`skydd.md` S4, `docs/dataskydd/riskanalys.md` §6.5.

**ADR-92 — S4 gäller en fil i taget.** Beslutat av underhållaren 2026-11-20. Ändrar ADR-91: skyddet för minsta
gruppstorlek gäller varje fil som lämnar verktyget för sig, och det som går att räkna fram genom att kombinera flera
filer ur samma underlag skyddas inte. *Skäl:* användaren har redan hela underlaget, och skydden finns mot omedvetna
dataläckor; att stänga vägen mellan filer skulle låta en grupp på 150 personer tappa sin kostnad för en enda persons
skull och dölja en flaggad grupps medelvärde i protokollet. *Avvisat:* att stänga två vägar som prövades och visade
sig verkliga: protokollets blad för lika arbete mot tabellerna per BAS-intervall, och Löneöversyns kostnad per grupp
mot intervallets medellön. Båda kräver två filer och att den som räknar vet hur de hänger ihop. *Gäller i dag:*
`skydd.md` S4, `k-troskeln.md` avsnitt 2, 9 och 11, `docs/dataskydd/riskanalys.md` §6.5,
`docs/dataskydd/dataskydd.md` *Vad skydden gör och inte gör*, `loneoversynsmodellen.md` §12.

**ADR-93 — JPA-protokollet redovisar alla grupper i lika arbete.** Beslutat av underhållaren 2026-11-22. Protokollet
för gemensam lönebedömning får bladet *2a. Lika arbete, alla grupper*: samma blad som *Lika arbete AID x BAS* i Excel
(alla flikar), byggt av samma funktion, så att art. 10.2 a och c täcks för alla grupper och inte bara för de
flaggade. Bladet har antal och medianer men inga medelvärden, så det ger ingen ny skillnad mot blad 3:s medelvärden
(medianer går inte att dela upp). *Avvisat:* en ny tabell för protokollet, som kunde säga något annat än Lika arbete
om samma grupp; att lägga till medelvärdet per grupp, som öppnar nya skillnader mot blad 3. *Gäller i dag:*
`exporterna.md` §4, `lagrum.md`, avsnittet om protokollet för gemensam lönebedömning, och `k-troskeln.md` avsnitt 2.

**ADR-94 — Diagrammens filter står alltid utfällda.** Beslutat av underhållaren 2026-11-22. Filterraderna ovanför ett
diagram står i en inramad ruta med rubriken *Filter* och antalet aktiva filter; rutan fälls inte ihop, och med ett
aktivt filter får den accentfärgen. Hopfällda bakom en rad *Filter: …* missades filtren. *Avvisat:* att behålla den
hopfällda raden men fälla ut den från början, som fortfarande låter filtren gömmas och kräver ett minne per diagram.
*Gäller i dag:* `diagramkarnan.md`, *Rutan Filter*.

**ADR-95 — Beräkningsregistret blir spårbarhetsmatrisen.** Beslutat av underhållaren 2026-11-23. Beräkningsregistret
blir projektets enda spårbarhetsmatris, `sparbarhet.md`, med upplägget för en kravspårningsmatris (jfr ISO/IEC/IEEE
29148 och IEC 62304): varje beräkning, varje test för minsta gruppstorlek och varje skydd har ett unikt och stabilt
ID, testerna bär ID:t i sitt namn, och vakten `tests/sparbarhet.test.js` prövar att matrisen och testsviten pekar på
varandra åt båda hållen. Testtabellen i `k-troskeln.md` avsnitt 10 flyttar dit; regeltexten stannar i `k-troskeln.md`
och `skydd.md`. Skälen är extern granskning, där en granskare ska kunna gå från ett påstående till regel, kod och test
och tillbaka utan att lita på att dokumentet stämmer, och att en uppgift ska stå på ett ställe. *Avvisat:* att
behålla registret med testfiler i stället för tester, som inte går att pröva; ett eget dokument för spårbarheten
bredvid registret och k-tröskelns tabell, som ger tre ställen för samma uppgift; att märka testerna i kommentarer,
som inte syns i testkörningens utdata. *Gäller i dag:* `sparbarhet.md`, `k-troskeln.md` avsnitt 10.

**ADR-96 — Konfigurationsfilens fält har svenska namn; äldre filer läses.** Beslutat av underhållaren 2026-11-23.
Konfigurationsfilen skrivs i version 3 med svenska fältnamn (`prioTrosklar`, `loneoversyn`, `kvinnoTroskelPct` och så
vidare) i stället för de engelska och blandade i version 2. Filer i version 2 läses fortfarande: de gamla namnen byts mot
de nya före valideringen, och tabellen över bytena står på ett ställe, `src/lib/konfiguration.js`, prövad i Node.
Organisationspaketet (ADR-28, ADR-47) och importprofilernas fil hade redan svenska namn och är oförändrade. *Skäl:* en
extern granskare ska känna igen samma ord i dokumenten, spårbarhetsmatrisen och filen som användaren sparar. *Avvisat:*
att bara läsa version 3, som gör sparade filer oläsbara; att byta också värdena (`'pct'`, `'lowest'`, `'do'` och andra),
som står kvar som nycklarna i ADR-72; att byta tillståndets fält i appen i samma ändring, som inte syns i filen.
*Gäller i dag:* `docs/dataskydd/riskanalys.md` §6.8, `likvardighetsmodellen.md` §8.

**ADR-97 — Funktionerna i `src/lib/` har svenska namn.** Beslutat av underhållaren 2026-11-23. Koden skrivs på
domänens språk: de engelska och blandade namnen på funktioner, konstanter och parametrar i `src/lib/` har bytts mot
svenska, liksom spegelns alias i `gen-mirrors.mjs` (appens prefix, som `_fc` och `_st`, står kvar). Etablerade
förkortningar (OLS, CSV, BAS, AID, KI, HC3, CDF) och ord som redan är svenska (median, regression, bootstrap) står
kvar. Fälten i returvärdena och i tillståndets inställningsobjekt är oförändrade, eftersom de läses på många ställen i
appen eller översätts till konfigurationsfilen (ADR-96). Bytet gjordes utan beteendeändring, en modul i taget. *Skäl:* en extern granskare ska känna igen samma ord i dokumenten, spårbarhetsmatrisen och koden (ADR-95).
*Avvisat:* att låta lib behålla de engelska namnen och bara översätta i dokumenten, som ger två namn på samma sak.
De äldre besluten och CHANGELOG nämner de gamla namnen; tabellen visar vad de heter nu:

| Modul | Gammalt namn | Nytt namn |
|---|---|---|
| `stat.js` | `quantile`, `linearRegression`, `tDistCdf`, `tQuantile`, `pValue2Sided` | `kvantil`, `linjarRegression`, `tFordelningCdf`, `tKvantil`, `pVardeTvasidigt` |
| `stat.js` | `matMul`, `transpose`, `invert`, `fitOLS`, `_regIncBeta` | `matrisprodukt`, `transponera`, `invertera`, `anpassaOLS`, `_regOfullstandigBeta` |
| `rng.js` | `hashSeed`, `seedFromNumbers`, `rngFor` | `froAvText`, `froAvTal`, `slumpFor` |
| `struktur.js` | `representationByBas`, `quartileDistribution`, `distributionalGap` | `representationPerBas`, `kvartilfordelning`, `fordelningsgap` |
| `falt.js` | `groupKey`, `konOf`, `ageBucket`, `AGE_ORDER` | `gruppnyckel`, `konAv`, `aldersgrupp`, `ALDERSORDNING` |
| `urval.js`, `utforska.js`, `figur.js` | `personFilter`, `computePivot`, `_filterNorm` | `iUrvalet`, `pivottabell`, `_normaliseratFilter` |
| `demodata.js` | `generateTestData`, `generateDemoData`, `generateStortDemo`, `generateStortDemoStatistik` | `genereraTestdata`, `genereraDemodata`, `genereraStortDemo`, `genereraStortDemoStatistik` |
| `lonepolitik.js` | `bandPosition`, `groupBandStats`, `complianceCounts`, `genderBandGap`, `costToFloor`, `policyCoverage` | `bandlage`, `gruppMotBand`, `antalMotBand`, `konsskillnadIBand`, `kostnadTillGolv`, `tackningsgrad` |
| `loneoversyn.js` | `totalLonSum`, `computePott`, `rawGenderGap`, `targetRows`, `allocate`, `suggestTargets`, `closureTargets` | `lonesumma`, `beraknaPott`, `raLonegap`, `riktadeRader`, `fordela`, `foreslaRiktning`, `stangningsriktning` |
| `loneoversyn.js` | `stagedPlan`, `summarizeGroups`, `detectLeapfrog`, `forecastOutcome`, `bandStats`, `individualRemediation`, `marketTargets`, `sensitivityCurve` | `stegvisPlan`, `sammanstallGrupper`, `hittaOmkorningar`, `prognosutfall`, `lonespannPerBas`, `individlyft`, `marknadsriktning`, `kanslighetskurva` |
| `likvardighet.js` | `computeLikvardighetPairs`, `basRangFn`, `bootstrapMedianDiffKr`, `bootstrapMedianVsConstantKr`, `orgIckeKvByBas` | `likvardighetspar`, `basRangordning`, `bootstrapMedianskillnadKr`, `bootstrapMedianMotKonstantKr`, `orgIckeKvPerBas` |
| `likvardighet.js` | `byggParPoäng`, `KVINNO_TROSKEL_DEFAULT`, `ALDERS_GOLV_DEFAULT` | `byggParPoang`, `KVINNO_TROSKEL_STANDARD`, `ALDERS_GOLV_STANDARD` |
| `regression.js` | `computeSequentialGap`, `computePerBasGap`, `computeVariabelTillfor`, `computeYrkesgruppGap` | `stegvisGap`, `gapPerBas`, `variabelTillfor`, `yrkesgruppGap` |
| `regression.js` | `diagnoseCollinearity`, `quantileRegression`, `quantileRegressionAtAllTau` | `kollinearitetsdiagnos`, `kvantilregression`, `kvantilregressionAllaTau` |
| `inlasning.js` | `parseNumber`, `parseNumberStrict`, `detectSensitiveColumns`, `autoDetectColumnMap`, `ALLOWED_FIELDS` | `tolkaTal`, `tolkaTalStrikt`, `hittaKansligaKolumner`, `gissaKolumnmappning`, `TILLATNA_FALT` |
| `inlasning.js` | `_normalizeNumberString`, `_cleanYrkeField`, `_stripHtmlMeta`, `_normalizeBas`, `_normalizePolicyAid`, `_normalizeKon` | `_normaliseraTaltext`, `_stadaYrkesfalt`, `_utanHtmlTecken`, `_normaliseraBas`, `_normaliseraPolicyAid`, `_normaliseraKon` |
| `inlasning.js` | `_sniffTabularFormat`, `_decodeCsvBuffer`, `_detectDelimiter`, `_findCsvHeader` | `_gissaTabellformat`, `_avkodaCsv`, `_gissaAvgransare`, `_hittaCsvRubrik` |

Spegelns alias följer samma ord: `_fitOLS` heter `_anpassaOLS`, `_rngFor` `_slumpFor`, `_fcComputePott` `_fcBeraknaPott`,
`_lvComputePairs` `_lvLikvardighetspar`, `_toCsv` `_tillCsv` och så vidare. *Gäller i dag:* `sparbarhet.md`
(kolumnen Funktion och fil).

**ADR-98 — Appen byggs från ES-moduler med esbuild.** Beslutat av underhållaren 2026-11-23. Delarna i `src/app/` är
ES-moduler med explicita `import` och `export`, och de importerar `src/lib/` under lib-namnen. `tools/build-app.mjs`
bygger `dist/app.js` med esbuild (utvecklingsberoende; ingen esbuild-kod hamnar i filen) från `src/app/index.js`, utan
tree shaking och utan minifiering (ADR-2 står kvar). Spegeln (`gen-mirrors.mjs`, `09-lib-speglar.js`) och
dess alias (`_stKonsMedianer` m.fl.) är borta. *Skäl:* en extern granskare kan följa varje beroende i källan, från en
flik till lib-funktionen som räknar och dess test, och lib-funktionen heter detsamma i appen som i Node (ADR-95, ADR-97);
spegeln var en andra väg till samma kod. *Utfilen är platt:* format `esm` utan import och export kvar, som körs som ett
klassiskt skript (S3: fortfarande en fil som fungerar från `file://`). Appens toppnivånamn är därmed globala, som sidan,
testerna (`w.eval`) och röktestet (`page.evaluate`) läser dem. Ett namn som två moduler deklarerar skulle esbuild döpa
om, så bygget fäller om ett av appens namn inte står oförändrat i utfilen; därför heter lib-funktionerna som krockade
med appens adaptrar `statGolvVid`, `likvardighetsparUr` och så vidare, och K_STANDARD, K_MIN och K_MAX finns bara i
`src/lib/ktroskel.js`. ES-moduler körs i importgrafens ordning, inte i sifferordning: delarna deklarerar bara, och det
som körs vid laddning står i en uppstartsfunktion per del som `index.js` anropar i sifferordning (bygget fäller en del
med annan kod på toppnivån; `00-sakerhet-och-uppstart.js`, som importerar inget och körs först, är undantaget). esbuild
gör toppnivåns `const` och `let` till `var` i utfilen. *Avvisat:* att behålla hopslagningen och spegeln; en IIFE eller
ES-modul som utfil, som döljer namnen för testerna eller kräver en server; att ersätta testernas globala namn med
exporter i samma ändring. Ersätter ADR-8 och ändrar ADR-6 (delarna slås inte längre ihop byte för byte). *Gäller i dag:*
`bygge-och-test.md` §2, `src/app/README.md`.

**ADR-99 — En vymodell per flik i `src/lib/`.** Beslutat av underhållaren 2026-11-23. Det en flik visar räknas av en
vymodell: en funktion i `src/lib/` (`vymodellLikaArbete(rader, { k, golv, … })`) som tar underlaget, tröskeln och de
inställningar som behövs som argument och ger rena data: tal, rader, maskeringar, statusar och de texter som är
beräknade (statusens förklaring, anteckningen i en exportbild). Vymodellen rör ingen DOM, läser inga globala och inget
tillstånd, har svenska namn och innehåller ingen HTML, färg eller ikon. Appens ritfunktion (`ritaLikaArbete(vm)`) ritar
bara det den får; en tunn adapter i samma del (`laVymodell()`) läser tillståndet och skickar det vidare, med appens
minne för de dyra delarna (bootstrap, omkastning) som valfria argument. Vymodellen för en flik ligger i
`src/lib/vymodell-<flik>.js`, platt bland de andra modulerna, så att vakterna för `src/lib/` (`tests/lib-beroenden.test.js`,
modultabellen i `arkitektur.md`) gäller utan ändring. Varje vymodell prövas i Node med ID-märkta tester i
spårbarhetsmatrisen, och k-invarianten prövas på vymodellen vid 10 och 25 (I9). Först ute var Lika arbete och
Lönestrukturs avsnitt per BAS-intervall (`vymodell-lonestruktur.js`); vilka flikar och delar som har en vymodell står i
modultabellen i `arkitektur.md`.
Diagrammens figurer byggs kvar i appen ur vymodellens data. *Skäl:* en extern granskare ska kunna läsa och pröva varje
regel som styr vad en flik visar utan DOM och tillstånd (ADR-95, ADR-98). *Avvisat:* en mapp `src/lib/vymodeller/`,
som vakterna för `src/lib/` inte läser och som skulle kräva att de skrivs om; att låta ritfunktionen läsa tillståndet
själv, som döljer vad vyn bygger på; HTML i vymodellen, som binder den till webbläsaren. *Gäller i dag:*
`arkitektur.md`, `src/app/README.md`.

**ADR-100 — Varje release har en signerad valideringsrapport.** Beslutat av underhållaren 2026-11-23.
Release-arbetsflödet kör hela testsviten med Vitests JSON-rapport, och `tools/valideringsrapport.mjs` bygger ur den och
spårbarhetsmatrisen en rapport (`valideringsrapport.md` och `.json`) med byggets version och SHA-256, commit, datum,
Node, Vitest och jsdom, och en rad per ID: påståendet, funktion och fil, testerna vars namn bär ID:t och utfallet
(godkänd, underkänd, saknas). Steget fäller när ett ID saknar godkänt test eller något test faller, och rapporten
signeras med cosign och läggs på releasen som de andra filerna. Matrisen läses av samma funktion i rapporten och i
vakten `tests/sparbarhet.test.js`. *Skäl:* en extern granskare (dataskyddsombud, IT-säkerhet, revision) ska kunna se,
för en viss fil och dess kontrollsumma, att varje krav prövades och gick igenom, som ett valideringspaket i GAMP 5- och
IEC 62304-anda; vakten visar bara att matris och tester pekar på varandra, inte att testerna gick igenom för det som
släpptes. *Avvisat:* att bygga rapporten i varje CI-körning, som kostar en extra testkörning eller en sammanslagning av
CI:s fyra delar; att hämta CI:s körning av taggen till release-arbetsflödet, som kräver ett steg mellan arbetsflödena;
en tredjepartsaction för testrapporter (repot tillåter bara GitHubs egna och cosign-installeraren); att checka in
rapporten, som har ett datum och skulle ändras i varje körning. *Gäller i dag:* `bygge-och-test.md` §10, `SECURITY.md`,
`sparbarhet.md`.

**ADR-101 — Releasen attesteras och bygget prövas reproducerbart.** Beslutat av underhållaren 2026-11-23.
Release-arbetsflödet låter GitHub attestera ursprunget (SLSA build provenance) för verktyget, `RELEASE.txt`,
programvaruförteckningen och valideringsrapporten med GitHubs egen action `actions/attest-build-provenance`, låst på
commit; jobbet får `attestations: write` utöver `contents: write` och `id-token: write`. Bygget ska vara reproducerbart:
CI bygger varje commit en gång till i en ny katalog med annan tidszon och annat språk och kräver samma kontrollsumma,
och release-arbetsflödet bygger om ur taggen i en ren katalog och släpper ingenting om det inte blir den fil som
signeras. Radsluten är LF i varje utcheckning (`.gitattributes`), eftersom en utcheckning med CRLF gav en annan fil.
*Skäl:* en extern granskare ska kunna belägga, inte bara läsa, att filen byggdes ur just den källan i just det
arbetsflödet (`gh attestation verify`), och kunna bygga samma fil själv och jämföra kontrollsumman. Signaturen med cosign
står kvar: den kräver inget GitHub-konto och styrker samma sak på ett oberoende sätt. *Avvisat:* att ersätta cosign med
attesteringen, som binder verifieringen till GitHub; `SOURCE_DATE_EPOCH` eller commitens tid i bygget, som inte behövs
eftersom bygget inte läser klockan; att normalisera radsluten i bundlern, som inte når källan esbuild läser;
tredjepartsactions för att jämföra byggen (repot tillåter bara GitHubs egna och cosign-installeraren). *Gäller i dag:*
`bygge-och-test.md` §2, §9 och §10, `SECURITY.md`.

**ADR-102 — Minsta gruppstorlek är lägst 3.** Beslutat av underhållaren 2026-11-23. Ändrar ADR-38: det tillåtna
intervallet för minsta gruppstorlek är 3–1000 i stället för 2–1000 (`K_MIN` i `src/lib/ktroskel.js`), också för
organisationspaketets `kTroskel` och golvet `kTroskelLagst`, och ett årsbokslut sparat med en lägre tröskel läses med
3. Ett värde 2 behandlas som andra ogiltiga värden: en konfigurationsfil med det avvisas, och i ett organisationspaket
används det inte och ger en varning. *Skäl:* med tröskeln 2 kan två personer i en grupp räkna fram varandras lön ur
gruppens medelvärde eller summa, vilket är det röjande som tröskeln finns för att stoppa. Rådet för den officiella
statistiken, [*Handbok i statistisk röjandekontroll*](https://scb.se/contentassets/0cd92207266d40eb8829244d51d90b94/handbok-i-statistisk-rojandekontroll.pdf)
(2015, uppdaterad 2018), avsnitt 5.1, s. 40: tröskelvärdet måste
vara minst 3. Standardvärdet 10 och friheten att sänka det med bekräftelse (ADR-38) står kvar. *Gäller i dag:*
`k-troskeln.md` §6.

**ADR-103 — Golvet för skattningar följer tröskeln bara i exportläget.** Beslutat av underhållaren 2026-11-23. Ändrar
ADR-23 och regeln för `statGolv()`: på skärmen är golvet för skattningar (regression per BAS-intervall, ansvarssteget,
Blinder-Oaxaca, bootstrap-KI, styrkan, livscykelmodellen, extremvärdena, statusen *Går ej att bedöma* och Personer att
granska) alltid `K_STANDARD`, 10; i exportläget är det som förut den inställda tröskeln när den är högre
(`statGolvVid(kTroskel())`). En höjd tröskel hindrar alltså inte analysen på skärmen. Skattningar som sparas har
golvet i nyckeln, så att det som räknats på skärmen aldrig följer med ut (`bootstrapCIGallande`, `styrkaGallande`,
`laLikaGrupper`); regressionen cachas fortfarande inte (ADR-17). Där en grupp på skärmen är för liten för att prövas
säger texten att lönerna syns under Tabeller och egna vyer och att bedömningen dokumenteras under Sakliga skäl.
*Skäl:* golvet är ett kvalitetsgolv, inte ett skydd mot röjande. Rådet för den officiella statistiken,
[*Handbok i statistisk röjandekontroll*](https://scb.se/contentassets/0cd92207266d40eb8829244d51d90b94/handbok-i-statistisk-rojandekontroll.pdf)
(2015), s. 41: kvalitetsskäl kan motivera ett eget tröskelvärde. Skyddet mot röjande är tröskeln i exportläget
(ADR-51), och den som arbetar i verktyget har redan lönefilen. *Avvisat:* att golvet följer den inställda tröskeln
också på skärmen (som förut): en höjd tröskel tog bort skattningar för grupper som är stora nog att pröva. *Gäller i
dag:* `k-troskeln.md` §1 och §5.

**ADR-104 — Funktionerna i `src/app/` har svenska namn; tillståndets fält och DOM:ens id:n står kvar.** Beslutat av
underhållaren 2026-11-23. Utvidgar ADR-97 till appen. Toppnivånamnen i `src/app/` (funktioner, konstanter och `let`)
som hade en engelsk del är bytta mot svenska, en grupp moduler i taget och utan beteendeändring: först S4 och exporten,
sedan tillståndet och starten, flikarna och sist diagramritaren och verktygstipsen. Verben följer en ordlista (render
blir rita, compute räkna, build bygg, apply tillämpa, show visa och så vidare) och substantiven verktygets egna ord
(diagram, tabell, prognos, kostnad, inställningar). Prefixen (`_fc`, `_st`, `_rf` …) och etablerade förkortningar (CSV,
PNG, SVG, OLS, ZIP, JPA, KI) står kvar, liksom namn som redan är svenska (`kStampelFor`, `medExportLage`). Testernas
alias i `tests/helpers/app-harness.js` (`__namn`) följer det nya namnet. *Byts inte:* tillståndets fält (`state.data`,
`state.forecast` …) och `state` självt, av samma skäl som returvärdenas fält i ADR-97: de läses på många ställen i
appen och testerna, och flera översätts till konfigurationsfilen (ADR-96); de tas upp igen när en flik ändå skrivs om.
DOM:ens id:n och klasser, eftersom de är ett kontrakt med stilmallen, röktesterna, riggen och exportgrinden, som läser
tabellerna med sitt id; en granskare läser dem inte. *Skäl:* den som följer en regel från vymodellen (ADR-99) till
skärmen och exporten ska känna igen samma ord i koden, dokumenten och spårbarhetsmatrisen (ADR-95). Bygget fäller ett
namn som krockar med ett annat eller med `window` (`bygge-och-test.md` §2). *Avvisat:* att byta tillståndets fält och
id:n i samma ändring, som rör varje fil utan att en granskare vinner något. De äldre besluten och CHANGELOG nämner
några av appens gamla namn; tabellen visar vad de heter nu:

| Modul | Gammalt namn | Nytt namn |
|---|---|---|
| `13-oversikt.js` | `bootstrapCIGallande` | `bootstrapKIGallande` |
| `31-navigering.js` | `renderTabContent` | `ritaFlik` |
| `51-lika-arbete-regressionskort.js` | `runOLSRegression` | `korOLSRegression` |

Namnen i S4 och exporten (`06-k-troskel.js`, `06-maskeringsnoter.js`, `11-diagramexport.js`, `19-konfiguration.js`,
`22-exporthjalpare.js`, `23-exportgrind.js`, `24-excelexport.js`) nämns inte där, och inte heller de övriga i
tillståndet och starten. *Gäller i dag:* `src/app/README.md`.

**ADR-105 — Konfidensintervall och p-värden använder t-fördelningen vid alla frihetsgrader.** Beslutat av
underhållaren 2026-11-24. `tKvantil` och `pVardeTvasidigt` (`src/lib/stat.js`) gick tidigare över till
normalfördelningen vid df ≥ 100; nu används t-fördelningen med df = n − k vid alla frihetsgrader, och
`tFordelningCdf` går själv över i normalfördelningen först över df 1 000 000. Det gäller huvudregressionen,
regressionerna per BAS-intervall, översikten per huvudområde och livscykelmodellen, och därmed protokollets blad 3, som
väljs på p-värdet efter korrigeringen för många tester. *Skäl:* bytet gav något för smala intervall och något för små
p-värden (df 100: kvantilen 1,96 i stället för 1,984, intervallet omkring 1 % för smalt; t = 1,97 gav p 0,049 i
stället för 0,052), alltså en liten men systematisk överskattning av säkerheten i den riktning en granskare invänder
mot. Den exakta fördelningen fanns redan och kostar omkring 0,04 ms per anrop, och samma fördelning vid alla df gör
talen jämförbara med statsmodels och R (`qt`, `pt`). *Följd:* på demodatan (df omkring 240) blir huvudtalets intervall
några hundradelar av en procentenhet bredare och p-värdena större; ingen status ändras. Golden-facit ändras bara i
metodbilagans mening om p-värden, eftersom dess underlag har färre än 100 frihetsgrader. *Gäller i dag:*
`regressionsmodellen.md` §7.

**ADR-106 — Ingen juristgranskning före lansering; ett ansvarsförbehåll med samma lydelse överallt.** Beslutat av
underhållaren 2026-11-08 (fört in i loggen 2026-11-25; koden kallade det tidigare *beslut 8c*). Verktyget lanseras
utan juristgranskning. I stället skrivs det juridiska övergripande: lagen och direktivet nämns, men verktyget påstår
inte vad de kräver i detalj, inga paragrafer eller artiklar (ADR-16), och orden *utredningskrav*, *lagstadgat* och
*direktivet kräver* är avförda. Ansvarsförbehållet säger att verktyget är ett stöd för arbetsgivarens egen
lönekartläggning och att användaren ansvarar för användningen, tolkningen och den juridiska bedömningen. Lydelsen står
en gång, som `ANSVARSFORBEHALL` i `src/app/03-hjalpfunktioner.js`, och samma text står på åtta ställen: Om verktyget,
rapportunderlaget, Word/PDF (raden *Ansvar* under *Rättslig ram*), metodbladet i varje Excel-export, README, HR-
sammanfattningen och körguiden. Bredvid står förbehållet att verktyget ännu inte är prövat med verklig lönedata.
*Skäl:* en juristgranskning före lansering skulle binda verktyget vid en tolkning som underhållaren inte kan stå för,
och en övergripande text med ett tydligt förbehåll håller ansvaret hos arbetsgivaren, som gör den juridiska
bedömningen. *Vakt:* `tests/juridiksprak.test.js` (lydelsen på alla åtta ställen) och de avförda orden i
`tests/dokumentation-sprak.test.js`. *Gäller i dag:* `lagrum.md`.

**ADR-107 — EU-rapportmåtten bär en reservation om lönebegreppet.** Beslutat av underhållaren 2026-11-08 (fört in i
loggen 2026-11-25; koden kallade det tidigare *beslut 7a*). Verktyget räknar på fast heltidsmånadslön, medan
direktivets lönebegrepp omfattar total ersättning med rörliga delar och förmåner. Vid måtten för EU-rapporteringen står
därför meningen *Måtten är räknade på fast heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning,
inklusive rörliga delar och förmåner); komplettera ur lönesystemet om ni rapporterar.* Den står i fliken Lönestruktur,
som rad 2 i EU-lönerapportens sammanfattning, under tabellen i bladet EU-lönekartläggning, i rapportens avsnitt om
lönetransparens (Rapporttext, Word, PDF), i rapportunderlaget, Om verktyget, körguiden och datauttagets §1b. Meningen
finns en gång, `lonebegreppReservation()` i `src/lib/struktur.js`, utan artikelnummer (ADR-16). *Skäl:* måtten får
inte läsas som färdiga tal för rapporteringen när lönefilen bara har den fasta lönen. *Avvisat:* att läsa in rörliga
delar, som lönefilen inte har och som verktyget inte ska kräva. *Vakt:* `tests/exports.golden.test.js`. *Gäller i
dag:* `src/lib/struktur.js`.
