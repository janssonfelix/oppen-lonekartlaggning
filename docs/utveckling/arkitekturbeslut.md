# arkitekturbeslut.md — Öppen lönekartläggning: Arkitekturbeslut (ADR)

> Loggen över arkitekturbesluten: vad som valdes och varför, så att ett beslut inte återupptas utan ny kontext. Besluten
> binder inte i sig. Det som binder är skydden i [`skydd.md`](skydd.md), som går före, och principerna i
> [`principer.md`](principer.md). Hur något fungerar i dag står i referensen för området, som beslutet pekar på under
> *Gäller i dag*; där ingen referens finns står lydelsen kvar i beslutet. Syfte, avgränsning och funktionsmål står i
> [`mal.md`](mal.md), de öppna punkterna i [`oppna-punkter.md`](oppna-punkter.md).

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
| ADR-6 | `app.js` genereras från `src/app/`-moduler | Gällande | – |
| ADR-7 | Två lager röktest: jsdom och den byggda filen i riktiga webbläsare | Gällande | – |
| ADR-8 | lib-speglarna genereras från `src/lib/` | Gällande | – |
| ADR-9 | Hash-baserad CSP `script-src` | Gällande | – |
| ADR-10 | Sidopanelen är navigation, inte ARIA-tabs | Gällande | – |
| ADR-12 | K-anonymitetens redovisningsform: utelämna och namnge | Ändrad av ADR-51 | – |
| ADR-13 | `VERSION` är enda källa för versionsstämpeln | Gällande | – |
| ADR-14 | Tabeller och egna vyer visar små grupper; exporten utelämnar dem | Sammanförd i `k-troskeln.md` | – |
| ADR-15 | Formler i CSV- och urklippsexport neutraliseras | Gällande | – |
| ADR-16 | Inga paragrafhänvisningar i gränssnittet, och sedan 2026-10-19 inte heller i hjälptexter eller exporter | Gällande | 2026-10-19 |
| ADR-17 | `runOLSRegression` får aldrig cachas | Gällande | – |
| ADR-19 | Underlagets kvalitet: svagaste länken avgör | Gällande | – |
| ADR-20 | Rapportunderlag via urklipp; bedömningen skrivs utanför verktyget | Gällande | – |
| ADR-21 | Alla BAS-intervall ingår (upphävd begränsning) | Sammanförd i `mal.md` | – |
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
| ADR-38 | K-tröskeln är en inställning | Ändrad av ADR-51 och ADR-69 | – |
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
| ADR-59 | Uppmärksamhetstrappan på statistisk signal, direktivmarkeringen åtskild | Ändrad av ADR-71 | 2026-11-08 |
| ADR-60 | Jämförelseyrkena i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av kvinnodominerat | Ändrad av ADR-72 | 2026-11-08 |
| ADR-61 | Minsta skillnad 0 % som standard i likvärdigt arbete | Gällande | 2026-11-08 |
| ADR-62 | Prioriteringens egna ord för läget mot referensen | Gällande | 2026-11-08 |
| ADR-63 | Kvantilregressionen på huvudmodellens design, villkorad tolkning | Gällande | 2026-11-08 |
| ADR-64 | Ålder är valfri i lönefilen | Gällande | 2026-11-08 |
| ADR-65 | Var uppstår löneskillnaden: valbara förklaringsvariabler | Gällande | 2026-11-10 |
| ADR-68 | Arkitekturbeslutens form: beslut i mall, gällande lydelse i referenserna | Ändrad av ADR-73 | 2026-11-13 |
| ADR-69 | Löneöversyns förslag följer den inställda tröskeln | Gällande | 2026-11-13 |
| ADR-70 | Skyddet gäller lönemått; antal och andelar är handläggarens ansvar | Gällande | 2026-11-14 |
| ADR-71 | Trappan i livscykeln, protokollet och Prioriteringen; ingen färg på storleken ensam | Gällande | 2026-11-14 |
| ADR-72 | Definitionerna av kvinnodominerat heter efter lydelsen | Gällande | 2026-11-14 |
| ADR-73 | Skydden och principerna binder; besluten är en logg | Gällande | 2026-11-14 |

## Besluten

**ADR-1 — Web Worker avvisad.** Verktyget använder ingen arbetstråd; vid ett faktiskt prestandabehov används
main-tråds-chunking (`requestIdleCallback`) och nedsampling i diagramkärnan. *Avvisat:* en worker: CSP:n saknar
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

**ADR-6 — `app.js` genereras från `src/app/`-moduler.** Appens kod ligger i numrerade källmoduler som slås ihop byte för
byte till `dist/app.js`, för navigerbarhet utan ES-moduler i bygget (`file://`-kravet). En modul som växer delas vid en
sektionsgräns som ren byteskiva, så att `dist/app.js` blir bit för bit oförändrad. *Gäller i dag:* `bygge-och-test.md`
§1–§2 och `src/app/README.md`.

**ADR-7 — Två lager röktest: jsdom och den byggda filen i riktiga webbläsare.** jsdom-lagret ritar varje flik men ser
inte CSP:n, `file://` eller bildexporten via canvas; webbläsarlagret kör den byggda filen i Chromium, Firefox och
WebKit, med en färskhetsspärr mot ett gammalt bygge. *Avvisat:* ett av lagren ensamt. *Gäller i dag:*
`bygge-och-test.md` §5.5 och §9.

**ADR-8 — lib-speglarna genereras från `src/lib/`.** `tools/gen-mirrors.mjs` inlinar varje `src/lib/`-modul ordagrant i
en IIFE i `src/app/09-lib-speglar.js`, så att `src/lib/` är enda källan och appens moduler bara är adaptrar. Lib-moduler
får importera varandra; aliaset injiceras inuti den importerande modulens IIFE, så att inga nya globala namn uppstår.
*Gäller i dag:* `bygge-och-test.md` §2.

**ADR-9 — Hash-baserad CSP `script-src`.** Den byggda filens `script-src` tillåter bara skript med kontrollsumma, inte
`'unsafe-inline'`, så att webbläsaren avvisar både injicerade `<script>` och injicerade händelseattribut, ett lager
djupare än `esc()`. Appen använder därför delegerade lyssnare (`data-goto-tab`, `data-dismiss-parent`). *Gäller i dag:*
`skydd.md` S1, `docs/dataskydd/riskanalys.md` §6.1 och `bygge-och-test.md` §2.

**ADR-10 — Sidopanelen är navigation, inte ARIA-tabs.** Sidopanelen är `<nav aria-label>` med knappar utan tab-roll och
`aria-current="page"` på den aktiva; pil-, Home- och End-navigering är ett tillägg, och alla knappar ligger i naturlig
Tab-ordning. En persistent sidopanel som byter huvudinnehåll är navigation; de två äkta tablistarna (`info-tab-nav`,
`benchmark-metric-bar`) har bara `role="tab"`-barn. `tests/a11y.test.js` (axe-core, ett dev-beroende som aldrig ingår i
bygget) kräver noll överträdelser. *Avvisat:* tablist-mönstret, som bara tillåter `role="tab"`-barn, medan sidopanelen
har en disclosure-knapp.

**ADR-12 — K-anonymitetens redovisningsform: utelämna och namnge.** En grupp under tröskeln utelämnas i det som lämnar
verktyget och namnges i en not; är bara könsuppdelningen för liten redovisas gruppens samlade median. *Avvisat:* en rad
med `< 10` i varje mätvärde (värdelös, långa tabeller), och att utelämna grupper där bara ena könet är litet (i
EU-matrisen har grupperna ofta 14–17 personer men 2–3 av ena könet). *Gäller i dag:* `k-troskeln.md` §2 och §4.

**ADR-13 — `VERSION` är enda källa för versionsstämpeln.** Stämpeln gör ett resultat spårbart till en beräkningsversion.
Byggdatumet härleds ur versionen, inte ur systemklockan, som skulle ge ny SHA-256 vid varje bygge. *Gäller i dag:*
`bygge-och-test.md` §3.

**ADR-14 — Tabeller och egna vyer visar små grupper; exporten utelämnar dem.** Exporten ur fliken bär små grupper bara
när användaren kryssar i rutan, ett beslutat undantag; den som använder verktyget har redan rådatan. *Avvisat:*
differensskydd mot att räkna fram en liten grupp ur två filtrerade urval. *Gäller i dag:* `k-troskeln.md` §2 och §4.

**ADR-15 — Formler i CSV- och urklippsexport neutraliseras.** En textcell som börjar med `=`, `+`, `-` eller `@` (eller
tabb eller CR) får ett inledande `'`, så att en fientlig lönefil inte kan lägga en formel i en export. Tal lämnas
orörda, och ett tal som börjar med `−` (U+2212) skrivs med `-`, eftersom Excel annars läser det som text. Regeln bor i
`_neutraliseraCell` (`22-exporthjalpare.js`). *Gäller i dag:* `docs/dataskydd/riskanalys.md` §6.6.

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

**ADR-23 — Personer att granska: individlista i verktyget, aldrig i utdata.** Panelen i Lika arbete listar personer vars
lön ligger minst X % (standard 10, inställbar 5–30) under en förväntad lön ur kollegorna i samma AID och BAS, utan
personen själv: `ln(lön) = a + b · ålder` när kollegornas åldrar skiljer sig minst 5 år, annars deras median. Bara
grupper med minst 10 personer prövas, och båda könen flaggas (`src/lib/individflaggor.js`). Personen identifieras med
filens radnummer, så att ingen ny identifierare samlas in; ett citerat fält med radbrytning förskjuter numreringen, en
accepterad begränsning. *Gäller i dag:* `k-troskeln.md` §4.

**ADR-24 — Stabilitet för flaggor i Lika arbete: märkning, inte nedgradering.** En flaggad grupp märks *skör* om
skillnaden kan hamna under storleksgränsen när en eller två personer tas bort, annars *stabil*, och flaggan ligger kvar.
Det räcker att pröva ytterlägena och positionerna inom 2 från medianen, verifierat mot uttömmande prövning
(`likaArbeteGrupper` i `src/lib/rapportunderlag.js`). *Gäller i dag:* `docs/anvandare/korguide.md` §4.

**ADR-25 — Lägre krav, högre lön: jämförelse över BAS-gränserna.** En egen lista jämför kvinnodominerade yrken med
organisationens egna jämförelseyrken i strikt lägre BAS, så att kandidatparen inte beror på antagandet att BAS-ordningen
speglar kraven. *Avvisat:* en reserv ur jämförelsestatistiken (dubbelt osäker). *Gäller i dag:*
`likvardighetsmodellen.md` §6–§7.

**ADR-28 — Organisationspaket; ingen inbyggd organisation.** Verktyget har ingen inbyggd organisation eller referens;
utan ställningstagande visas ett tomläge. Benämningar, grundinställningar, ställningstagande, jämförelsestatistik och
importprofiler kommer ur ett organisationspaket som handläggaren läser in i ett steg. *Gäller i dag:* `skydd.md` S5,
`docs/anvandare/organisationspaket.md` och `.github/CONTRIBUTING.md` (importprofiler).

**ADR-29 — Ett steg är klart när dess punkter är hanterade.** Processöversikten markerar ett steg som klart när arbetet
är gjort, inte när analysen har körts: Lika arbete när alla punkter i Att göra i *Lika arbete* och *Lika arbete,
fördjupning* är avbockade, Likvärdigt arbete när inga kandidatpar finns eller alla är avbockade. Finns bara par med en
grupp under tröskeln är tillståndet *inget att hantera*. *Börja här* sorterar underlaget först, sedan de könsrelaterade
fynden och sist läget mot referenserna (`src/lib/attgora.js`).

**ADR-30 — Stilelement kräver kontrollsumma, stilattribut är förbjudna; låsta beroenden.** Alla `style="…"` är ersatta
av klasser, och CSP:n har `style-src-elem` med kontrollsummor och `style-src-attr 'none'`; beroendena är låsta
(`vendor/SHA256SUMS`, CI-stegen på commit-SHA). *Gäller i dag:* `bygge-och-test.md` §4, `skydd.md` S1 och
`docs/dataskydd/riskanalys.md` §6.1.

**ADR-31 — Interna fel rapporteras i stället för att sväljas.** Analysdelar som ska tåla fel hoppar över sin del om
något kastar, men anropar `rapporteraFel(plats, e)` (`03-hjalpfunktioner.js`): en banner säger att resultatet kan vara
ofullständigt, och konsolen får en varning där siffrorna är maskerade, eftersom konsolen aldrig ska bära lönedata.
Avsiktliga `catch`, som nekad urklippsbehörighet, rapporterar inte. Vakten är `tests/smoke-ansvar.test.js`.

**ADR-33 — AID-hierarki, sektorsöversikt, ansvarskod och kodkvalitet.** Sektor (AID-huvudområdet) är en översikt och en
dimension i Tabeller och egna vyer, inte ett globalt filter, som skulle ändra alla flikars resultat och k-skydd
samtidigt. Ansvarskoden är valfri, läses bara om minst 95 % av värdena är giltiga och redovisas bredvid huvudresultaten;
huvudtalet räknar inte bort den, eftersom om ansvaret är ett sakligt skäl är arbetsgivarens bedömning. *Gäller i dag:*
`docs/anvandare/datauttag.md` och `docs/dataskydd/riskanalys.md` §6.4.

**ADR-34 — SKR:s personalstatistik som referens för kvinnoandel.** Kvinnoandelen per AID-etikett kommer ur SKR:s
personalstatistik, en källa med dokumenterat ursprung som täcker etikettlistan; den är reserven i Likvärdigt arbete och
ett referensvärde bredvid organisationens egen könsfördelning, och påverkar inga k-regler. *Gäller i dag:*
`likvardighetsmodellen.md` §4.

**ADR-35 — Jämförelsestatistik: alla percentiler i en tabell och två diagram.** `src/lib/jamforelse.js` räknar raderna
(P10, median och P90 för organisationen och jämförelsen) som tabellen, diagrammen och Excel läser, så att de inte kan
säga olika saker. En källa som inte är inläst är `aria-disabled` (inte `disabled`), så att flikraden fungerar med
piltangenterna. *Avvisat:* en egen gräns på 20 personer för P10 och P90: värdet pekar inte ut vem, och medianen har
samma egenskap vid udda antal.

**ADR-36 — Filrutorna syns alltid; namn på organisationen och jämförelsestatistiken.** Filrutorna syns alltid, så att
ställningstagandet och statistiken aldrig döljs bakom en hopfälld rad. `orgNamn` och `jmfNamn` (`src/lib/namn.js`) är
enda källan för etiketterna, och namnfälten avvisar text som liknar personnummer eller e-post. *Gäller i dag:*
`skydd.md` S5.

**ADR-37 — Word-utkastet som riktig .docx.** Utkastet skrivs som Office Open XML (`src/lib/docx.js`) med
Word-standardens rubrikstilar och metadata utan namn, eftersom HTML med ändelsen `.doc` får Word att varna och öppna
filen i skyddad vy. *Avvisat:* inbäddad HTML (altChunk), som Word på webben, LibreOffice och Google Dokument inte
hanterar.

**ADR-38 — K-tröskeln är en inställning.** Minsta gruppstorlek är en inställning, standard 10, tillåtet 2–1000, så att
en arbetsgivare med egna riktlinjer kan följa dem; en sänkning under 10 kräver bekräftelse och ger en varning som inte
går att stänga. *Avvisat:* "bara höja", "golv vid 5" och "styrt av organisationspaketet"; upphovspersonen valde "fritt,
med varning". *Gäller i dag:* `k-troskeln.md` §1, §3 och §5–§10.

**ADR-39 — Diagramkärna på D3 med eget figurformat.** Vyerna bygger en figur (ren data), och `ritaFigur` gör SVG av den
med D3, så att varje datapunkt bär gruppnyckel och `liten`-flagga och skyddet ligger på ett ställe. Etiketter lutas
aldrig. Täthetskurvor skattas med normalkärna och Silvermans bandbredd mellan morrhårens ändar; ett histogram kön mot
kön visas bara när båda könen når tröskeln och ingen klass rymmer färre (ändklasserna slås ihop inåt); trädkartan slår
ihop yrkesgrupper under tröskeln till en grå yta per BAS-intervall; och en värmekartas färgskala räknas bara ur värden
som får redovisas. *Gäller i dag:* `diagramkarnan.md` §1–§8 och `k-troskeln.md` §4.

**ADR-40 — Fyra exporter med var sin uppgift, ritade ur en rapportmodell.** Word-utkastet är rapporten, Excel-filen
underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt; Word och PDF ritas ur samma rapportmodell,
så att de inte kan glida isär. *Avvisat:* eget innehåll i PDF-rapporten (två sanningar), och särskilda sammanställningar
för ledningsbriefen. *Gäller i dag:* `mal.md` (*Exportera*) och `k-troskeln.md` §3.

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

**ADR-46 — Steget *+ Yrkesgrupp*: könsgapet med fasta effekter för yrkesgrupp inom BAS.** Den stegvisa uppdelningen får
ett sista steg med fasta effekter för AID×BAS (inomtransformation), eftersom huvudmodellen lämnar löneskillnader mellan
yrken i samma BAS i det oförklarade gapet. Steget blev inte huvudtalet; sedan ADR-56 kan det väljas in. *Gäller i dag:*
`regressionsmodellen.md` §4.

**ADR-47 — Organisationspaketet kan låsa tre skydd.** Paketet kan låsa ett golv för tröskeln, rensningstiden och om små
grupper får följa med i exporten, eftersom systemägaren annars inte kunde tvinga något av dem. *Avvisat:* att golvet
gäller alla senare paket utan fråga (en organisation måste kunna byta paket). *Gäller i dag:* `k-troskeln.md` §6 och
`docs/anvandare/organisationspaket.md` §5.

**ADR-48 — Bilder med en punkt per person följer med i ZIP och Komplett rapport.** Bilderna bär inga namn eller
identifierare, en punkt ritas bara när personens grupp och kön når tröskeln, och filerna hanteras som personuppgifter.
*Avvisat:* att utelämna bilderna eller ersätta dem med aggregat. *Gäller i dag:* `k-troskeln.md` §4 och
`docs/dataskydd/dataskydd.md` §3–§4.

**ADR-49 — Organisationsfil: paketet inbakat i verktygsfilen, en fil att sprida.** Paketet bakas in som ett inaktivt
block efter sista skriptet, så att CSP:ns kontrollsummor är orörda; filen verifieras inte mot den publicerade versionen
(beslut 2026-10-19). *Avvisat:* automatisk inläsning av en paketfil i samma mapp, som `connect-src 'none'` och
webbläsaren gör omöjlig. *Gäller i dag:* `organisationsfil.md`.

**ADR-50 — Prioritering är vad, Löneöversyn är hur.** Prioritering svarar på vad som bör åtgärdas och vad det kostar;
Löneöversyn på hur potten fördelas. Lönerevisionssimulatorn i Prioritering är borttagen: en riktad rad i Löneöversyn kan
i stället begränsas till ett kön och till löner under en gräns och lyfta till en nivå (`targetRows` i
`src/lib/loneoversyn.js`). PO-påslag och beräkningsperiod står under Inställningar.

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

**ADR-60 — Jämförelseyrkena i likvärdigt arbete är alla som inte är kvinnodominerade; en definition av
kvinnodominerat.** Förut föll blandade yrken (40–60 % kvinnor) bort; ett filter återskapar det tidigare urvalet.
*Gäller i dag:* `likvardighetsmodellen.md` §2, §4 och §8.

**ADR-61 — Minsta skillnad 0 % som standard i likvärdigt arbete.** Alla par visas och 5 % är ett valbart filter,
eftersom ett par med 2 % skillnad annars aldrig syntes. *Gäller i dag:* `likvardighetsmodellen.md` §5 och §8.

**ADR-62 — Prioriteringens egna ord för läget mot referensen.** Prioriteringens statusar hette som trappan för
skillnaden mellan kvinnor och män, fast de mäter löneläget mot referensen. Orden är nu *Börja här*, *Under referens*,
*Nära referens, under*, *Nära referens* och *Över referens* (`PRIO_STATUS_INFO`), med oförändrade gränser, och
nyckeltalet heter *Kostnad att nå referensen*. *Gäller i dag:* `docs/anvandare/korguide.md` §4.

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
inställda tröskeln, oavsett läge, och tar ett par per kvinnodominerat yrke, eftersom beloppet räknas ur en grupps
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
samma fråga); att välja på det råa p-värdet. *Gäller i dag:* `regressionsmodellen.md` §7 och punkt 9e i
`oppna-punkter.md`.

**ADR-72 — Definitionerna av kvinnodominerat heter efter lydelsen.** Valen heter *Mer än X %* och *X % eller mer*;
nycklarna `'do'` och `'scb'` står kvar för sparade filer. Etiketten SCB hade inget stöd. *Avvisat:* att döpa valen efter
propositionens två ställen; att byta nycklarna. *Gäller i dag:* `likvardighetsmodellen.md` §2 och §8, och `lagrum.md`.

**ADR-73 — Skydden och principerna binder; besluten är en logg.** Det som binder är skydden S1–S5 och de sex
principerna. Besluten är loggen över vad som valdes och varför, i en till tre meningar, och ett designval ändras genom
att referensen och koden ändras i samma ändring. Regelmatrisen, kvalitetskraven K1–K10 och den tekniska planen är
borttagna; mål och öppna punkter har var sitt korta dokument. *Avvisat:* att låta varje beslut binda med full lydelse,
som gjorde att en liten ändring krävde rättelser på många ställen. *Gäller i dag:* `skydd.md`, `principer.md` och
`.github/GOVERNANCE.md`.
