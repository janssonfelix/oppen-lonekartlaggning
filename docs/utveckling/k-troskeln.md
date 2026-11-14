# K-tröskeln — referens

Minsta gruppstorlek för redovisning, k-tröskeln, är skyddet S4 i [`skydd.md`](skydd.md): inget som lämnar verktyget
redovisar ett lönemått för en grupp, eller ett könsuppdelat lönemått för ett kön, med färre personer än den inställda
tröskeln. Det här dokumentet bär den **gällande lydelsen**: hur tröskeln läses, hur det som utelämnas redovisas, vägen
ut, undantagen, golven, inställningen och vakterna. Koden är sanningen; där dokumentet och koden skiljer sig är det
dokumentet som ska rättas.

Dokumentet är inte beslutsloggen. Varför det är så här, vad som övervägdes och när det beslutades står i besluten i
[`arkitekturbeslut.md`](arkitekturbeslut.md): ADR-12, 14, 23, 38, 47, 48, 51, 57, 69 och 70. Diagrammens del — figurens
`liten`-flagga, vyns skyldigheter och kraven på varje vy — står i [`diagramkarnan.md`](diagramkarnan.md) §1 och §7–8
och upprepas inte här. Hur skyddet och undantagen beskrivs för dataskyddsombudet står i `docs/dataskydd/dataskydd.md`
§3 och i riskanalysen (`docs/dataskydd/riskanalys.md` §6.5).

Den som lägger till något som lämnar verktyget läser avsnitt 1, 2 och 9 först.

| Del | Fil |
|---|---|
| Tröskeln, golven, noterna, stämplarna, inställningen och omritningen | `src/app/06-k-anonymitet-och-dataminimering.js` |
| Exportläget, exportgrinden och förhandsvisningen | `src/app/23-exportgrind.js` |
| Könsuppdelade mått i strukturen | `src/lib/struktur.js` |
| Organisationspaketets låsningar | `src/lib/organisationspaket.js` (`_lasningar`), `src/app/29-organisationspaket.js` |
| Vakterna | `tests/ktroskel*.test.js`, `tests/kanonymitet.test.js`, `tests/troskelbeslut.test.js`, `tests/loneoversyn-forslag-troskel.test.js`, riggen `tests/helpers/ktroskel-rigg.js` och invarianten `tests/helpers/ktroskel-invariant.js` |

## 1. Två lägen

Verktyget har två lägen (`state.kLage`). På skärmen maskeras inga grupper: den som arbetar i verktyget har redan
lönefilen. Allt som lämnar verktyget ritas och räknas i exportläget (avsnitt 3).

| Funktion | Värde | Används till |
|---|---|---|
| `kTroskel()` | `K_SKARM` = 1 i skärmläget, den inställda tröskeln i exportläget | Det som ska tillämpas just nu, på det som ritas. Enda vägen att läsa det. `isKMasked(n)` är `n < kTroskel()`. |
| `kInstalld()` | Den inställda tröskeln (`state.kTroskel`), oavsett läge | Inställningen, stämpeln, metodbilagan och texterna om regeln; det som ska vara samma tal i båda lägena. |
| `statGolv()` | `max(kInstalld(), K_STANDARD)`, oavsett läge | Skattningarnas tillförlitlighet (avsnitt 5). Skattningarna, och deras cacher, är desamma på skärmen och i exporten. |

**Vilken man läser.** Det som bara *ritas* — rader, celler, staplar och punkter — följer `kTroskel()`: på skärmen syns
allt, i exportläget utelämnas det som är under tröskeln. Det som ska vara *samma tal på skärmen och i exporten*, och
det som enligt beslut ska vara fritt från små grupper också på skärmen, räknas med `kInstalld()`. En ny vy som läser
`kTroskel()` där talet ska vara detsamma i båda lägena visar ett annat tal på skärmen än i exporten.

Exempel ur koden i dag:

- **Huvudtalets spärr (ADR-56).** *Endast kön* är det ojusterade gapet och får inte vara huvudtalet när ett kön ligger
  under den inställda tröskeln. Spärren följer `kInstalld()` oavsett läge, så att huvudtalet är detsamma på skärmen och
  i exporten, och panelen säger varför (`51-lika-arbete-regressionskort.js`).
- **Det Översikt säger om exporterna.** Hur många BAS-intervall exporterna kan jämföra (`_dqJamforbaraBas`) och
  underlagets kvalitet räknas med `kInstalld()` (`13-oversikt.js`), eftersom de gäller det som lämnar verktyget.
- **Handlingsplanens belopp.** En förifylld rad där den minsta gruppen bakom skillnaden är under den inställda
  tröskeln står i exporterna och bokslutet bara med kategorierna (`_hpUtanBelopp` i `56-handlingsplan.js`).
- **Löneöversyns förslag (ADR-69).** *Föreslå riktade potter*, mål-läget och känslighetskurvan tar bara kandidatpar
  där båda grupperna når den inställda tröskeln, också på skärmen (`_fcKandidater` anropar
  `_parForRedovisning(pairs, kInstalld())` i `36-loneoversyn.js`), och meningen om utelämnade par vid förslagen
  nämner den inställda tröskeln. Bland dem tar förslagen ett par per yrke, det med störst skillnad (`ettParPerYrke`).
  Ett förslag bär ett belopp räknat ur jämförelseyrkets median, och raden står i summorna på skärmen, i
  Excel-exporten och i konfigurationsfilen; talet ska vara detsamma överallt. En föreslagen rad som inte säkert når
  tröskeln tas bort (`_fcRensaParMal`, regel R2 i avsnitt 8).
- **Varningar och noter om tröskeln.** Noten under en egen riktad rad i Löneöversyn (`36-loneoversyn.js`), varningen
  *Underlaget är litet* i Prioriteringens motiveringsförslag (`55-prioritering.js`, den gäller skattningens säkerhet,
  inte läget) och antalet små grupper i likvärdighetsanalysens diagnostik (`34-likvardigt-arbete.js`) läser
  `kInstalld()`.
- **Texterna.** Stämpeln (`kStampel`), metodbilagan (`_methodAppendixData` i `22-exporthjalpare.js`), sidfoten
  (`_kSidfot`), exportbeskeden och appens texter (`_kText`, `_fyllKTexter`) nämner den inställda tröskeln.
- **Det som ritas.** Noterna (`kMaskNote`, `kSamladNote`), `_konFarRedovisas`, `_parForRedovisning` (utan andra
  argument), `individLitenFor` och vyernas `liten`-flaggor läser `kTroskel()`.

## 2. Redovisningsformen

Redovisningsformen (ADR-12) gäller det som lämnar verktyget, alltså exportläget. Den är tvådelad:

1. **Hela gruppen under tröskeln** → raden utelämnas, och gruppen räknas upp **med namn** i en not vid tabellen
   (`kMaskNote()`). Handläggaren ser exakt vad som saknas och varför. Personerna ingår fortfarande i underlaget och i
   totalsummorna.
2. **Bara könsuppdelningen för liten**, medan gruppen som helhet ligger över tröskeln → gruppens **samlade median**
   redovisas (`kSamladNote()`). Den bygger på n ≥ `kTroskel()` och röjer ingen enskild, men ger ändå ett lönemått att
   förhålla sig till. Könsjämförelsen utgår, med förklaring.

Tabellerna per AID-kod och BAS-intervall och könsfördelningen per BAS-intervall har ett avsiktligt avsteg i antal
(avsnitt 4).

**Noterna innehåller avsiktligt ingen inline-markup.** SheetJS trimmar varje elements text för sig och slår ihop dem
utan avskiljare, vilket ger `4 yrkesgruppervisas` i Excel-exporten. Noten är ändå visuellt avskild (`.k-mask-note`).

**Könsuppdelade mått.** De beskrivande könsuppdelade lönemåtten — ett köns median eller percentil, det råa lönegapet,
regressionens ojusterade steg *Endast kön* med den förklarade andelen, en kostnad som räknats ur ett gap — redovisas per
grupp och för hela organisationen bara när varje kön når tröskeln (`_konFarRedovisas`; för en radmängd
`_konFarRedovisasFor`). Där ett sådant mått för hela urvalet utelämnats står ett streck och `_konUtelamnatNot()`.
Samma regel gäller `representationByBas`, `medianGapPct`, `distributionalGap` och `quartileDistribution` i
`src/lib/struktur.js`, som tar `{ k }` och visar streck och en not i fliken Struktur, Word-utkastet, PDF-rapporten och
EU-lönerapporten. Regressionens justerade gap visas från regressionens eget fasta golv, 5 per kön; övriga skattningar
har fasta eller statistiska golv (avsnitt 5). Fem regler till står i avsnitt 8.

**Vad skyddet omfattar (ADR-70).** Skyddet gäller lönemått: medianer, medelvärden, percentiler, lönespann,
lönesummor, kostnader räknade ur löner, löneskillnader och regressionens effekter. Antal och andelar, också per kön,
för en grupp eller ett kön under tröskeln omfattas inte, utöver de beslutade golven: tabellerna per AID-kod och
BAS-intervall och könsfördelningen per BAS-intervall (från fem personer, avsnitt 4) och Lönelägets mellannivå
(avsnitt 5). Ett antal kan alltså stå på en rad vars lönemått är maskerade, eller i en not; handläggaren bevakar vad
som lämnas ut. I Tabeller och egna vyer följer antal (n, och n per kön) med i exporten även när ett kön har färre än
`kTroskel()` personer (ADR-14).

**Regressionens BAS-effekter.** Effekten för ett BAS-intervall är dess lönenivå mot referensintervallet och ligger
för ett intervall med få personer nära deras genomsnittliga lönenivå. I det som lämnar verktyget (rapportens bilaga
om den justerade löneskillnaden i Word-utkastet, PDF-rapporten och utskriften, och regressionskortets tekniska
specifikation i exportläget) skrivs effekten inte ut för ett intervall med färre än `kTroskel()` personer i modellen
(`basN`); intervallen namnges i en not utan värden (`_kMaskNoteText`). Har referensintervallet självt färre skrivs
ingen effekt ut, eftersom varje effekt då beskriver dess nivå baklänges, och noten säger varför. Modellen och dess
referens (ADR-44) ändras inte. Allt går genom `_basEffekterForRedovisning` (`06-k-anonymitet-och-dataminimering.js`).

**Livscykelns lönekurva.** Kurvan i Ålder & karriär är livscykelmodellens lönenivå per kön i det valda BAS-intervallet
(rullistan; som standard det mest folkrika). Översiktstabellen per intervall utelämnar ett intervall med färre än
`kTroskel()` personer, och för ett valt intervall under tröskeln ritas heller ingen figur (`_lifecycleKurvaUtelamnad`
i `52-livscykel.js`, samma antal som tabellens rader): diagramdatan, bilden, ZIP-filen och kopian i Alla diagram
saknar den. En not i stället för kurvan säger vilket intervall som är valt och varför, utan värden. Valet byts inte,
så att exporten inte tyst visar ett annat intervall än skärmen. Beräkningsbeviset för ett annat intervall skriver då
ingen nivåfaktor mot det valda, eftersom raden delad med faktorn är det valda intervallets nivå. Tröskeln är
`kTroskel()` (avsnitt 1): kurvan är något som ritas, och skärmen visar den. Modellen skattas med alla intervall, och
dess golv är `statGolv()` (avsnitt 5). Rapporten och utskriften tar inte med kurvan.

**Löneöversyns summor.** I Löneöversyns blad *Fördelning* och i utfallstabellen i exportläget har en grupp under
tröskeln sin rad med BAS-intervall, yrke, antal och andel kvinnor; medianerna och kostnaden maskeras. Kostnaden för
de maskerade raderna står samlad på raden *Kostnad för grupper under tröskeln*, så att bladets kostnader summerar till
*Använt* i *Sammanfattning* och ingen summa minus de visade raderna ger en liten grupps kostnad (med ett påslag i
procent dess lönesumma). Den samlade kostnaden står bara när den omfattar minst `kTroskel()` personer. Annars viks den
minsta visade gruppens kostnad in, en grupp i taget (färst personer, vid lika antal först efter BAS och sedan AID):
gruppens rad står kvar med antal och andel kvinnor, men kostnaden och medianerna maskeras, eftersom antalet gånger
skillnaden mellan medianerna ligger nära gruppens kostnad. Når inte ens alla grupper tillsammans tröskeln står ingen
kostnad per grupp, bara summorna. De maskerade raderna står efter de visade, i BAS- och AID-ordning, så att platsen
inte säger något om kostnaden; spillover-listan tar inte med en invikt grupp. Noten under raderna säger vilka grupper
det gäller och varför (`_fcUtfallsrader`, `_fcUtfallsNot` i `36-loneoversyn.js`). *Varav till kvinnodominerade
grupper* står bara när de maskerade kvinnodominerade grupperna och de övriga maskerade grupperna var för sig är tomma
eller omfattar minst `kTroskel()` personer, eller när en av dem är tom; annars ett streck (`_fcVaravKvDom`). En egen
riktad rad (regel R2) har sitt belopp i *Sammanfattning* som förut. Scenariojämförelsen A/B följer samma regel: ett
sparat scenario bär sina grupper med påslag, och dess *Till kv-dom* prövas med `_fcVaravKvDom` mot den tröskel som
gäller när jämförelsen visas, annars ett streck (`_renderScenarioCompare`). Scenarierna lämnar inte verktyget; de
finns bara i minnet och i fliken.

**En punkt per person.** Utanför Tabeller och egna vyer ritas och exporteras en persons punkt i ett spridningsdiagram
bara när personens grupp (yrke inom BAS) och personens kön i gruppen når tröskeln (`individLitenFor`). Antalen räknas på
hela underlaget, inte på det urval diagrammet visar. I Ålder & karriär följer lönegapen, lutningen, trendlinjerna och
lådorna per kön regeln för könsuppdelade mått (regel R3 i avsnitt 8).

**Kandidatparen utanför fliken.** Kandidatpar ur Likvärdigt arbete redovisas utanför fliken och dess egen CSV- och
Excel-export bara när båda grupperna når tröskeln, med antalet utelämnade angivet (`_parForRedovisning`): Word-utkastet,
PDF-rapporten, JPA-protokollet, Att göra och dess CSV, handlingsplanens förifyllda rader, gruppdossiern, Löneöversyns
förslag, mål-läge och känslighetskurva samt robusthetspanelen i Exportera (`robusthetLikvardighet` i
`85-robusthet-fardigcheck.js`: par med en grupp under tröskeln namnges inte i någon körning, och panelen anger antalet
sådana par; beslut). Löneöversyns förslag prövas mot den inställda tröskeln också på skärmen (ADR-69, avsnitt 1); de
övriga ritas på skärmen med alla par och i exportläget utan de små. I fliken gäller undantaget i avsnitt 4.

## 3. Vägen ut

**Exportläget (ADR-51).** Allt som lämnar verktyget — Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder,
rapportunderlaget, gruppdossierns textkopia, Att göra-CSV, konfigurationsfilens ögonblicksbild — körs i
`medExportLage()` (`23-exportgrind.js`): generationen ökar så att grinden ritar om varje flik som läses, och efteråt
ritas skärmen tillbaka. Nästlade anrop byter inte läge. De två funktioner all export av tabeller och diagram går genom,
`_cloneAndCleanTableForExport` och `_chartExportUnderlag`, går själva in i läget, så ingen väg kan läsa skärmens tal.
Flikarna Rapporttext, Exportera och Spara och jämför år ritas alltid i exportläget. Alla diagram har en gemensam
exportmeny (`11-diagramexport.js`) som diagramkärnan kopplar in, så att nya diagram får den automatiskt; vägen från
diagram till bild står i `diagramkarnan.md` §6 och §8.

**Exportgrinden** (`23-exportgrind.js`, ADR-40) ritar om en flik innan något exporteras ur den, så att ingen export kan
bära tal från en tröskel eller ett läge som inte gäller. Två saker tillsammans: när tröskeln ändras töms varje flik som
inte syns (`tomFlikarUtom`), och varje flik minns vid vilken generation den senast ritades, så att en flik som ritades
före ändringen ritas om innan något läses ur den (`exportSakra`, `exportElement`; ZIP-exporten `exportSakraAlla`). Går
det inte att rita om fliken exporteras ingenting ur den — hellre en utebliven export än en med fel tröskel.

**Förhandsvisningen.** Knappen *Som i exporten* i sidhuvudet (`sattForhandsvisning`) sätter skärmen i exportläget —
banner, streckad ram och omritning av det som syns — tills den stängs av. Exporterna byter då inte läge, och ett byte
medan en export pågår avvisas.

**När tröskeln ändras** töms cacherna och flikarna som inte syns, och det som syns ritas om: den öppna fliken och de
delar av Översikt som inläsningen ritar men flikbytet inte gör — nyckeltalen, kompliansöversikten, underlagets kvalitet,
Att göra (vars CSV-knapp bär listan den ritades med), processöversikten, inläsningsrapporten, extremvärdeslistan, en
visad A/B-jämförelse och en öppen gruppdossier (`_renderaOmAllaFlikar`). Från fältet ritas allt om ett steg i taget, med
en ruta som visar förloppet och tar emot alla klick och tangenter tills omritningen är klar. Inläsning av
konfigurationsfil och organisationspaket sätter värdet med `rita: false` och gör omritningen själva, sist, så att allt
ritas en gång. Ett tröskelbyte räknar om skattningarna (`invalidateStatCaches`) bara när `statGolv()` ändras.

**Efter en export** ritas bara det tillbaka som exporten ritade (`_ritaOmEfterExport`). Lika arbetes minne har ett rum
per tröskel, så att ett lägesbyte inte räknar om något. Det som räknas på knapptryck i Löneöversyn räknas om när fliken
ritas om, om det visas (`_fcRitaOmKnappresultat`). Att göras lista byggs en gång för Att göra och processöversikten
(`renderProcessTracker({ punkter })`) — ingen cache, bara ett värde som skickas vidare.

## 4. Undantagen och avstegen

Undantagen är uppräknade och beslutade. De beskrivs för dataskyddsombudet i `docs/dataskydd/dataskydd.md` §3 (de fyra
numrerade undantagen och styckena om egna riktade rader och vyerna per BAS-intervall) och i riskanalysen §6.5; listan
här ska stämma med dem.

| Undantag | Beslut | Vad som gäller i stället | Hur utdatan märks |
|---|---|---|---|
| **Likvärdigt arbete i sin flik** | Uttryckligt beslut av användaren (`dataskydd.md` §3, undantag 1) | Likvärdighetsanalysen tillämpar inte tröskeln: resultatet är aggregerat per yrkesgrupp, och lagen kräver att även små kvinnodominerade yrken prövas. Fliken och dess egen export (Excel och CSV) redovisar kandidatpar även när en grupp är under tröskeln. Antalet små grupper som ändå ingår redovisas i analysens diagnostik. Utanför fliken gäller `_parForRedovisning` (avsnitt 2). | Allt i fliken (`#view-likvardighet`) bär "(undantag: Likvärdigt arbete)", vad exporten än bär. |
| **Tabeller och egna vyer med rutan** | ADR-14, ADR-47 | Fliken visar alla grupper, som alla flikar. Exporten — tabellens CSV och urklipp, diagrammets bild och diagramdata — utelämnar grupper under tröskeln, och könsvärden och gap där ena könet är under den, om inte användaren kryssar i *Ta med grupper under k i exporten* (k är tröskelns värde). Rutan är undantaget. `explorerSmaIExport()` är enda vägen att läsa den; organisationspaketet kan stänga av den (avsnitt 6). I exportläget får små celler klassen `explore-liten`, och figuren märker varje datapunkt under tröskeln `liten` (`71-utforska-figur.js`; `exportMedSma` i `70-utforska.js`); markeringen bor i `src/lib/utforska.js` (`liten`, `konLiten`). Diagram med enskilda personers löner (individpunkter) är tillåtna här, även i export, och följer rutan. Differensskydd (att räkna fram en liten grupp ur två filtrerade urval) byggs inte. | "(undantag: valt i Tabeller och egna vyer)" bara när exporten faktiskt bär små grupper. |
| **Personer att granska** | ADR-23 | Individlistan lämnar aldrig verktyget: tabellen har inga exportverktyg, listan ingår inte i rapportunderlag, Word-utkast, PDF, Excel, JPA eller ZIP och döljs vid utskrift. Panelens diagram är märkt `markeraUtanExport` med skälet `individer` och går inte att exportera (`diagramkarnan.md`, ADR-39). Extremvärdeslistan i *Underlagets kvalitet* visar på samma sätt enskilda löner, på skärmen. | Ingen: inget lämnar verktyget. Skälet står i behållarens verktygstips. |
| **Bilder med en punkt per person i ZIP och Komplett rapport** | ADR-48 | ZIP-exporten bär bilder av alla ritade diagram, och utskriftens mall *Komplett rapport* bär i sina bilagor bilder av Ålder & karriärs spridningsdiagram, låddiagram och täthetsdiagram. Word-utkastet och rapportens avsnitt (`RM_DIAGRAM`) och de kortare utskriftsurvalen har inga sådana diagram. En persons punkt ritas bara när personens grupp och kön i gruppen når tröskeln (avsnitt 2). Lådornas avvikare i låddiagrammet per kön är enskilda löner, utan yrke, och får exporteras som bild och diagramdata. | Exportnotisen säger att filen innehåller lönedata och ska hanteras som personuppgifter. Diagramdata från ett diagram med en punkt per person bär raden `kIndividRad()`. |
| **Tabellerna per AID-kod och BAS-intervall** | ADR-57 | En egen rad kräver minst fem personer i exportläget (`LITET_UNDERLAG`), inte `kTroskel()`; mindre grupper räknas upp i en not med namn och antal men utan löner. Lönemått följer `statGolv()` i båda lägena: ett köns median, kvoten och gränserna kräver `statGolv()` personer av varje kön, alltså minst tio, (gruppen står annars som *Analyseras på individnivå*, och i arbetslistan utan löner), gruppens median och lönespridning `statGolv()` personer. På skärmen visas alla grupper. | Noten under tabellen. |
| **Könsfördelningen per BAS-intervall** | ADR-57 (tillägg 2026-11-13) | Lönestrukturs tabell *Könsfördelning per BAS-intervall* (`#skevhet-table`) och diagrammet över andel kvinnor ovanför den (`chart-skevhet-andel`) ger ett intervall en rad med antal och andel per kön från `LITET_UNDERLAG` (fem) personer totalt, i båda lägena och oavsett tröskeln och antalet per kön (`generateSkevhet` i `41-lika-arbete.js`). Raden bär inga lönemått. Ett mindre intervall får varken rad eller stapel; det namnges i en not under tabellen (`_skevhetNot`, högst tolv namn och sedan "och N till"), som anger hur många intervall som utelämnats och golvet men inga antal eller andelar per intervall. Det som följer av tabellen och diagrammet har samma rader: Excel-bladet *Könsskevhet* (med noten), utskriften och PDF:en, som klonar tabellen, diagrammets diagramdata och diagrambilden i Word och ZIP. Beräkningsbeviset säger regeln och räknar de utelämnade intervallen. | Noten under tabellen. |
| **Egna riktade rader i Löneöversyn** | ADR-38, regel R2 | En rad som användaren själv lägger på en grupp under tröskeln är användarens egen simulering: beloppet står på raden och ingår i summorna på skärmen och i Excel-exporten (avsnitt 8). | En not under raden om att gruppen är under tröskeln. |

**Stämplarna.** `_kUndantagFor(el, medSma)` säger vilket undantag en tabell eller ett diagram hör till: allt i fliken
Likvärdigt arbete först (också en kopia i Alla diagram vars källa står där), annars ett diagram från diagramkärnan bara
när exporten bär små grupper, och tabellen och diagrammet i Tabeller och egna vyer när rutan är ikryssad.
`kStampelFor(undantag)` lägger tillägget "Den här filen kan även innehålla grupper under tröskeln (undantag: …)."
(`_kUndantagNot`) till stämpeln (`kStampel()`). Utan tillägget läses stämpeln som ett löfte om att filen saknar sådana
grupper. Diagrammens stämpel står i `diagramkarnan.md` §6 och §7 punkt 6.

## 5. Golven

Tröskeln är redovisningens gräns. Skattningar och några tabeller har egna golv:

| Var | Värde | Varför |
|---|---|---|
| `statGolv()`: regression per BAS, Blinder-Oaxaca, bootstrap-KI, livscykelmodellen, extremvärdesdetektorn, det justerade gapet inom yrke, ansvarsindikatorn och Personer att granska; därtill statusen *Går ej att bedöma* i uppmärksamhetstrappan (ADR-59) och lönemåtten i tabellerna per AID-kod och BAS-intervall (ADR-57) | `max(kInstalld(), K_STANDARD)`, i båda lägena | Gränsen gäller skattningens tillförlitlighet, inte redovisningen, och följer därför inte med nedåt. Den följer med uppåt, så att ett skärpt skydd också gäller skattade gruppvärden. |
| Huvudregressionen (Lönestruktur; `runOLSRegression`) | 5 av varje kön | Fast golv (beslut, ADR-38). Det justerade gapet med konfidensintervall visas därifrån, också när det ojusterade steget utelämnas (regel R1). |
| Motiveringsregeln om medelålder per kön (`55-prioritering.js`) | 3 av varje kön | Fast golv (beslut, ADR-38). |
| Löneöversiktens yrkesrader (`39-loneoversikt.js`) | 5 | Fast golv (beslut, ADR-38). |
| `LITET_UNDERLAG` (`litetUnderlag()`) | 5 | Ingen maskeringsgräns. I ett diagram ritas en stapel eller ett segment som gäller färre än fem personer med mönster, som en varning (ADR-39, `diagramkarnan.md`). I tabellerna per AID-kod och BAS-intervall är det gränsen för en egen rad i exportläget, och i könsfördelningen per BAS-intervall gränsen för en egen rad i båda lägena (avsnitt 4). |
| Lönepolitikens mellannivå (`LP_COUNT_TIER_MIN` i `75-lonepolitik.js`) | Från 5 upp till tröskeln | Grupper mellan 5 och k redovisas med antal (bandplacering i antal), inga lönemått; under 5 maskeras raden men räknas in i BAS-totalen. Mellannivån försvinner när tröskeln är 5 eller lägre. |

## 6. Inställningen

**Värdet.** Minsta gruppstorlek är en inställning: standard `K_STANDARD = 10`, tillåtet intervall `K_MIN = 2` till
`K_MAX = 1000`, bara hela tal. `sattKTroskel(v, { fraga, rita, stegvis })` är enda vägen att ändra det; `kTroskel()`
och `kInstalld()` läser det (avsnitt 1). Fältet ligger i panelen Inställningar (ADR-41), med en återställningsknapp.
Appens texter fylls i ur värdet (`data-k-troskel`, `data-k-tooltip` med `{k}` och `{golv}`, `_kText`); dokumenten anger
standardvärdet.

**Sänkt under 10.** Verktyget utlovar ingen lägsta nivå. I stället kräver en sänkning till ett värde under 10
bekräftelse (från fältet, en konfigurationsfil eller ett organisationspaket; nekas den behålls värdet och resten av
filen läses in), en varning som inte går att stänga står överst på alla flikar, och utdata anger värdet (avsnitt 7).
Varningsraden finns inte i utskriften (all utskrift går genom `#print-report`); i stället bär utskriftsrapporten och den
utskrivna handlingsplanen meningen om sänkt tröskel direkt under rubriken. Inget lagras: nästa session börjar på 10, om
inte en konfigurationsfil eller ett organisationspaket anger annat.

**Konfigurationsfilen** bär värdet (`kTroskel`). En fil utan fältet lämnar gällande värde orört, så att en fil aldrig
tyst sänker ett strängare värde; ett ogiltigt värde avvisar filen.

**Organisationspaketet** bär värdet i `installningar.kTroskel` (valfritt). Ett paket utan fältet lämnar värdet, och ett
ogiltigt värde ignoreras med en varning. Paketformuläret fylls i med gällande värde; fältet får tömmas, och då anger
paketet ingen tröskel. Ett ogiltigt värde i formuläret stoppar sparandet med samma felmeddelande som fältet.

**Låsningarna ur organisationspaketet (ADR-47).** Paketets `installningar` har tre valfria fält som låser det
handläggaren annars ställer in själv: `kTroskelLagst` (heltal 2–1000), `inaktivitetMin` (0 eller 5–120) med
`inaktivitetLast` (boolean) och `smaGrupperIExport` (boolean, standard tillåtet). Alla tre normaliseras i
`src/lib/organisationspaket.js` (`_lasningar`): ett ogiltigt värde utelämnas med en varning, läget av (0) kan inte
låsas, och paketets egen `kTroskel` under golvet höjs till golvet. Låsningarna bor i `state.paketLas`
(`{ kTroskelLagst, inaktivitetMin, smaGrupperIExport }`), sätts bara av `lasInPaket()` och återställs av *Rensa all data*
tillsammans med paketet; konfigurationsfilen bär dem inte, så en fil kan varken sätta eller häva en låsning.

- **Golvet** (`installningar.kTroskelLagst`). `sattKTroskel()` avvisar ett värde under `kTroskelLagst()` med felet
  "Lägst N enligt organisationspaketet", oavsett om det kommer från fältet, en konfigurationsfil (`applyConfigSnapshot` returnerar det
  som varning och visar felet vid fältet; resten av filen läses in) eller ett annat paket. Fältets hjälptext och `min`
  visar gränsen, återställningsknappen går till `max(10, golvet)`, och en gällande tröskel under golvet höjs när paketet
  läses in (en höjning frågar inte). Ett nytt paket med lägre eller inget golv kräver bekräftelse (samma `confirm` som
  vid sänkt tröskel); nekas den står det gamla golvet kvar och resten av paketet läses in.
- **Rensningstiden.** `setInactivityTimeout()` tar inte emot något annat än det låsta värdet; rullistan i *Vad lagras?*
  är låst (`disabled`) på värdet, som alltid finns bland alternativen, och en rad säger att organisationspaketet har låst
  tiden. Ett `inaktivitetMin` utan `inaktivitetLast` är en förinställning som handläggaren får ändra.
- **Exporten.** `explorerSmaIExport()` är enda vägen att läsa rutan för små grupper i Tabeller och egna vyer (tabellen,
  figurens `exportMedSma` och exportgrindens undantagstext). När paketet inte tillåter små grupper är rutan dold och
  avkryssad, svaret alltid nej, och `#explore-sma-last` säger varför.

Paketformuläret har de tre fälten (ett ogiltigt värde stoppar sparandet, som för tröskeln), och faktarutan listar
låsningarna. För systemägaren: `docs/anvandare/organisationspaket.md` §5; för dataskyddsombudet: `dataskydd.md` §3 och
riskanalysen B2b.

## 7. Värdet i utdata

Stämpeln är raden *Minsta gruppstorlek för redovisning: N.* (`kStampel()`); under 10 följer meningen "Tröskeln är sänkt
från standardvärdet 10." (`_kSanktNot()`).

| Utdata | När |
|---|---|
| Metodbilagans rad *Minsta gruppstorlek för redovisning* | Alltid |
| Diagramdatans första rad | Alltid |
| Tabell-CSV:ens sista rad (`_csvMedStampel`) | Alltid |
| Rapportunderlagets sammanfattning | Alltid |
| Diagrambilder: PNG, SVG, ZIP, rapportunderlagets diagramkopia (en rad i bildens nederkant) | Under 10 |
| Tabell till urklipp (`_tsvMedStampel`) | Under 10, och när exporten hör till ett undantag |
| Sidfötter (`_kSidfot`) | Under 10 |
| Varje block i rapportunderlaget | Under 10 |
| Gruppdossierns textkopia | Under 10 |
| Utskriftsrapporten och den utskrivna handlingsplanen, direkt under rubriken (`_kSanktStycke`) | Under 10 |
| Konfigurationsfilen och organisationspaketet | Alltid, som fält (`kTroskel`), inte som mening |

Exporter som hör till ett undantag anger det (`_kUndantagFor`, `kStampelFor`; avsnitt 4), och exportnotisen säger att
filen innehåller lönedata och ska hanteras som personuppgifter.

## 8. Reglerna R1–R5

Fem regler för könsuppdelade mått utöver avsnitt 2 (ADR-38). Beteckningarna R1–R5 hör till de här reglerna och ska
inte förväxlas med regelmatrisens R-nummer i [`regler.md`](regler.md), som är en annan nummerserie. Testernas egna
R-märkning följer inte heller den här numreringen rakt av (avsnitt 10).

- **R1. Regressionens ojusterade steg döljs när ett kön är under tröskeln.** Första steget i den stegvisa uppdelningen
  (*Endast kön*) är samma slags mått som det råa gapet. `_regStegForRedovisning(reg)` lämnar ut stegen utan det första,
  och ingen förklarad andel, när `_konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed)` är falskt; regressionskortet
  visar då ingen förklaringsbudget, och en mening står i stället för det utelämnade. Beräkningen är densamma, och det
  justerade gapet med konfidensintervall visas från regressionens fasta golv, 5 per kön. Det råa gapet som text:
  `_raGapText`.
- **R2. Egna riktade rader i Löneöversyn på grupper under tröskeln är tillåtna** (användarens egen simulering):
  beloppet står på raden och ingår i summorna på skärmen och i Excel-exporten, och raden får en not om att gruppen är
  under tröskeln. Beskrivet i `dataskydd.md` §3, riskanalysen §6.5 och körguiden. Rader som verktyget självt föreslår
  ur kandidatpar i likvärdigt arbete omfattas inte (ADR-69): verktyget föreslår ingen rad ur ett par där det
  kvinnodominerade yrket eller jämförelseyrket har färre personer än den inställda tröskeln, i något läge
  (`_fcKandidater`, avsnitt 1), och tar ett par per kvinnodominerat yrke, det med störst skillnad bland dem som når
  tröskeln (`ettParPerYrke` i `src/lib/loneoversyn.js`, som `suggestTargets` och `closureTargets`, och därmed
  känslighetskurvan, går genom). En föreslagen rad bär `kalla: 'par'` men inte paret. `_fcRensaParMal` prövar den när
  den inställda tröskeln ändras (`sattKTroskel`), när en konfigurationsfil läses in och när lönefilen läses in, också på
  skärmen. En rad som föreslogs i sessionen avgörs säkert: storleken på grupperna i paret den räknades ur finns i
  minnet (`_fcParUrsprung`, en `WeakMap` per rad som inte sparas), och raden står kvar när båda når tröskeln. En rad
  utan den uppgiften — ur en konfigurationsfil, också en äldre fil med en rad per jämförelseyrke — står kvar bara när
  parlistan är fullständig, yrket har par och alla når tröskeln; annars tas den bort, på den försiktiga sidan.
  Parlistan är fullständig när den inte är kapad vid *Visa max* (`topN`): `parAntal.totalt`, som räknas före urvalet
  (ADR-61), är lika med antalet par i listan. *Lägre krav, högre lön* är en egen lista och räknas inte. Meningen vid förslagen
  (`#forecast-par-not`) säger hur många rader som togs bort och varför, tills ett nytt förslag görs. Inget som räknades
  med en borttagen rad står kvar: när en rad tas bort räknas prognosens utfall om ur raderna som står kvar, också när
  Löneöversyn inte är den öppna fliken; exporten och scenarierna A/B räknar alltid utfallet ur raderna som de står
  (`_fcBeraknaUtfall`), inte ur ett sparat utfall; och ett sparat scenario som räknades med en rad som inte står sig
  tas bort, med en mening om det. Konfigurationsfilen bär fältet `kalla` (valfritt, version oförändrad); egna rader
  står kvar med noten.
- **R3. Ålder & karriär följer regeln.** Ojusterat och åldersjusterat gap kräver tröskeln för båda könen; lutning,
  trendlinje med konfidensband och låda kräver den för det könet (`40-alder-karriar.js`, `_setDiagramKNot` för noten
  under diagrammet). Demografidelens trendlinje och lutning för hela urvalet (alla BAS eller det valda) kräver att
  urvalet når tröskeln (beslut 2026-10-16); annars utelämnas de och noten under diagrammet säger det. Punkterna per
  person följer sin egen regel (avsnitt 2).
- **R4. Lönerevisionssimulatorn är borttagen** (2026-10, ADR-50). Det den kunde — begränsa till ett kön och en
  lönegräns, "höj till" — gör en riktad rad i Löneöversyn, som följer R2: en rad som berör färre personer än tröskeln är
  användarens egen simulering, beloppet visas på raden med noten om enskildas löner. Lönegapet före och efter kräver
  tröskeln för varje kön (`_konFarRedovisasFor`). Vaktas av C3 och röktest.
- **R5. Löneöversyns tröskelmål följer tröskeln** (`_forecastThreshold`; beslut 2026-10-16): lyftet i procent till
  kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när varje kön i urvalet når tröskeln
  (`_konFarRedovisasFor`), annars ett streck med `_konUtelamnatNot()`. Vaktas av `tests/troskelbeslut.test.js`.

## 9. Utdata och vakter

Raderna är vägarna som riggens `samlaUtdata` (`tests/helpers/ktroskel-rigg.js`) samlar in och som invarianten I4
söker igenom, och de riktade testerna för det I4 inte ser. Den fullständiga förteckningen för granskaren, med varje
utdata och dess skydd, står i riskanalysen (`docs/dataskydd/riskanalys.md` §6.5 och §6.6, och verifieringstabellen i
§11) och i `docs/dataskydd/dataskydd.md` §4.

| Utdata | Regel | Vakt |
|---|---|---|
| Skärmen, alla flikar | Visar alla grupper (ADR-51) | I4 (positivt); `tests/kanonymitet.test.js` (skärmen maskerar inget) |
| Varje flik i menyn, ritad i exportläget (det *Som i exporten* visar och exporterna läser) | Avsnitt 1–2 | I4; *I4: listan över flikar är menyns flikar* i `tests/ktroskel-exporter.test.js`; läsning vid 10, 25 och 5 i `tests/ktroskel.test.js` och `tests/ktroskel-hojning.test.js` |
| Översiktens delar: Att göra, processöversikten, inläsningsrapporten | Avsnitt 1–2 | I4 |
| Att göra-punkterna och Att göra-CSV | Avsnitt 2, kandidatparen | I4; `tests/ktroskel-utdata.test.js` (par utanför fliken) |
| Word-utkastet, rapportens avsnitt per BAS-intervall och bilagan med gruppdossierer | Avsnitt 2 | I4; `tests/ktroskel-utdata.test.js` (par i Word-utkastet och utskriften) |
| Utskriften: komplett, ledning, facklig, med gruppdossierer | Avsnitt 2 och 7 | I4 (texten; bilderna tas bort före sökningen); I3 |
| Rapportunderlagets block (HTML och text) och Rapporttextens utkast | Avsnitt 2 och 7 | I4; `tests/kanonymitet.test.js` (parblocket) |
| Excel: alla flikar, JPA-protokollet, EU-lönerapporten, handlingsplanen, jämförelseexporten, Löneöversyn, Löneöversikten, prioriteringslistan | Avsnitt 2, 5 och 8 | I4; C5 (bladet Lönepolitik); I1 (Löneöversyn) |
| ZIP-filens Excel-fil | Avsnitt 2 och 7 | I4; I3 |
| ZIP-filens bilder | Avsnitt 2 och 4 (ADR-48) | Bildernas innehåll prövas inte (avsnitt 11); `tests/ktroskel-bilder.test.js` prövar meningen under 10 |
| Tabell-CSV för varje tabell med CSV-knapp | Avsnitt 2 och 7 | I4 |
| Diagramdata för varje ritat diagram, och kopiorna i Alla diagram | `diagramkarnan.md` §1 och §7 | I4 (kopiorna ska vara källans, rad för rad); differentialtesterna i `tests/diagramritare.test.js` |
| Tabeller och egna vyer: tabellens CSV och urklipp, diagrammets bild och diagramdata | Avsnitt 4 (ADR-14) | I4 med rutan urkryssad; `tests/kanonymitet.test.js` (Utforskas export; rutan låst av paketet); `tests/utforska.test.js` |
| Gruppdossierns textkopia, för varje valbar grupp | Avsnitt 2 och 7 | I4; `tests/ktroskel-utdata.test.js` (par) |
| BAS-dossierns textkopia, för varje valbart intervall | Avsnitt 2 | I4; `tests/basdossier.test.js` |
| Robusthetspanelen i Exportera | Avsnitt 2, kandidatparen | I4; `tests/ktroskel-utdata.test.js` |
| Löneläget: statistikens matchning och överblickens diagram | Grupper som når tröskeln | I4 |
| Konfigurationsfilen (hela, årsbokslutet, importprofilerna) och importprofilerna som JSON | Bara aggregat och rubriknamn; bokslutet i exportläget (ADR-54) | I4; I5 (sakliga skäl); `tests/ktroskel-utdata.test.js` (konfigurationsfilen) |
| Förra årets bokslut: rapportunderlagets block, rapportens avsnitt och BAS-hantelns diagramdata | Den högre av årens trösklar (ADR-54) | I4 |
| Förhandskontrollens råvärden | Bara på skärmen | I4 |
| Var uppstår löneskillnaden med andra val av variabler | Skyddsregeln i ADR-22 och ADR-65 | I7 |
| Underlaget (`figur.underlag`, *Räkna för*) | Avsnitt 1 | I6 |
| Löneöversyn: kostnad per grupp, knappresultat, egna rader, tröskelmål | Regel R2, R4 och R5 | I1, I1b; R3 i `tests/ktroskel-regression.test.js`; `tests/troskelbeslut.test.js` |
| Löneöversyns summor: bladen *Fördelning* och *Sammanfattning*, utfallstabellen i exportläget | Avsnitt 2 (Löneöversyns summor, ADR-70) | `tests/ktroskel-loneoversyn-summor.test.js` (en ensam person, två små grupper under tröskeln tillsammans, små grupper som når den, alla grupper under den, lika antal; *Varav*; egna riktade rader; skärmen) |
| Regressionens BAS-effekter: rapportens bilaga (Word-utkastet, PDF-rapporten, utskriften) och regressionskortet i exportläget | Avsnitt 2 (BAS-effekterna, ADR-70) | `tests/ktroskel-bas-effekter.test.js` (ett intervall och ett referensintervall med 4 personer, i invariantens utdatavägar) |
| Livscykelns lönekurva: diagramdatan, bilden, ZIP-filen, kopian i Alla diagram, fliken i exportläget och beräkningsbeviset | Avsnitt 2 (livscykelns lönekurva, ADR-70) | `tests/ktroskel-livscykel.test.js` (ett valt intervall med 4 personer: kurvans egna vägar och invariantens utdatavägar; ett valt intervall över tröskeln; skärmen) |
| Löneöversyns scenariojämförelse A/B i exportläget | Avsnitt 2 (Löneöversyns summor, ADR-70) | `tests/ktroskel-loneoversyn-scenarier.test.js` (*Varav* som streck: differensen mot utfallet; scenariot sparat på skärmen och i exportläget; *Varav* som står; övriga kolumner; att scenarierna inte följer med i konfigurationsfilen) |
| Löneöversyns förslag ur kandidatparen (*Föreslå riktade potter*, mål-läget, känslighetskurvan), deras rader i Excel-exporten och konfigurationsfilen | Avsnitt 1 och regel R2 (ADR-69): den inställda tröskeln, också på skärmen | `tests/loneoversyn-forslag-troskel.test.js` (jämförelseyrket eller det kvinnodominerade yrket under tröskeln, höjd tröskel på skärmen, inläst konfigurationsfil; ett yrke med två jämförelseyrken: en rad, och förslag ur det lilla paret, äldre filer med en rad per jämförelseyrke och en ensam rad ur det lilla paret tas bort); `tests/loneoversyn.test.js` (ett par per yrke); I1 i `tests/ktroskel-invarianter.test.js`; `tests/ktroskel-utdata.test.js`; `tests/troskelbeslut.test.js`. Inte I4: riggens underlag har inga kandidatpar (avsnitt 11) |
| Regressionskortet (ojusterat steg, förklarad andel) | Regel R1 | R1 i `tests/ktroskel-regression.test.js` (samma vägar som I4, med 7 män i underlaget) |
| Ålder & karriär | Regel R3 | R4 i `tests/ktroskel-regression.test.js`; `tests/troskelbeslut.test.js` (trendlinjen för hela urvalet) |
| Könsuppdelade mått för hela organisationen och per BAS | Avsnitt 2 | C2, C3, C4, C6 |
| Stämplarna för undantagen | Avsnitt 4 och 7 | I2 |
| Omritning efter konfigurationsfil och organisationspaket | Avsnitt 3 | I5 i `tests/ktroskel-exporter.test.js` |
| Låsningarna ur organisationspaketet | Avsnitt 6 (ADR-47) | `tests/organisationspaket.test.js`, `tests/ktroskel-regression.test.js`, `tests/smoke-organisation.test.js`, `tests/kanonymitet.test.js` |
| Personer att granska och extremvärdeslistan | Avsnitt 4 (ADR-23) | Undantagna i I4; `tests/smoke-granssnitt.test.js` (listan lämnar inte verktyget); `tests/smoke.test.js` (`markeraUtanExport`) |
| Likvärdigt arbete i fliken och dess egen export | Avsnitt 4 | Undantagna i I4; I2 (stämpeln) |
| Tabellerna per AID-kod och BAS-intervall | Avsnitt 4 (ADR-57) | `tests/aidbas.test.js`, `tests/smoke-aidbas.test.js`; I4 i exportläget |
| Könsfördelningen per BAS-intervall: tabellen, diagrammet och dess diagramdata, Excel-bladet *Könsskevhet* och utskriften | Avsnitt 4 (ADR-57) | `tests/diagramvyer-marken.test.js` (i exportläget vid tröskeln 10 får ett intervall med 7 personer en rad och ett med 4 bara sitt namn i noten, utan andelar, i tabellen, diagrammets data och bild, diagramdatan, Excel-bladet och utskriften; ett annat test kräver att diagrammet har tabellens intervall och andelar) |

## 10. Testernas märkning

Testerna för tröskeln heter efter märkningar i sina `describe`-rubriker. Tre serier hör hit:

| Märkning | Vad den prövar | Fil |
|---|---|---|
| I1 | Löneöversyn visar ingen kostnad för grupper under tröskeln | `tests/ktroskel-invarianter.test.js` |
| I1b | Löneöversyns knappresultat följer läget och tröskeln | `tests/ktroskel-invarianter.test.js` |
| I2 | Exporter som hör till ett undantag säger det, och notisen utlovar ingen aggregering | `tests/ktroskel-exporter.test.js` |
| I3 | Tröskeln står i ZIP-filens Excel-fil och i utskriftens korta urval | `tests/ktroskel-exporter.test.js` |
| I4 | Invarianten över flikar och exporter (nedan); dessutom att riggens lista över flikar är menyns | `tests/helpers/ktroskel-invariant.js`, körd vid 10 i `tests/ktroskel-invarianter.test.js` och vid 25 i `tests/ktroskel-invarianter-25.test.js`; listan i `tests/ktroskel-exporter.test.js` |
| I5 | Två tester bär märkningen: konfigurationsfil och organisationspaket ritar om det som syns en gång när tröskeln ändras och tömmer resten; och sakliga skäl på en rad under tröskeln lämnar inte verktyget | `tests/ktroskel-exporter.test.js` respektive `tests/ktroskel-invarianter-25.test.js` |
| I6 | Underlaget i exportläget, precis under och precis över skyddsregeln | `tests/ktroskel-invarianter.test.js` |
| I7 | Var uppstår löneskillnaden med andra val av förklaringsvariabler, vid 10 och 25 | `tests/ktroskel-invarianter.test.js` |
| C2 | Struktur per BAS visar inget könsgap när ett kön är under tröskeln | `tests/ktroskel-kon.test.js` |
| C3 | Könsuppdelade mått för hela organisationen kräver tröskeln för varje kön | `tests/ktroskel-kon.test.js` |
| C4 | Allt som visar gruppmått följer tröskeln när den ändras (den öppna fliken direkt, övriga när de öppnas) | `tests/ktroskel-kon.test.js` |
| C5 | Bladet Lönepolitik i Excel (alla flikar) följer tröskeln som fliken | `tests/ktroskel-kon.test.js` |
| C6 | Räkneexemplet i kronor per år bara när båda könen når tröskeln | `tests/ktroskel-kon.test.js` |
| R1 | Regressionens ojusterade steg kräver tröskeln för varje kön (regel R1) | `tests/ktroskel-regression.test.js` |
| R2 | Löneöversynens scenariojämförelse maskerar ett rågap som sparats vid en lägre tröskel (lönegapet före och efter, regel R4) | `tests/ktroskel-regression.test.js` |
| R3 | En egen riktad rad på en grupp under tröskeln är tillåten och får en upplysning (regel R2) | `tests/ktroskel-regression.test.js` |
| R4 | Ålder & karriär följer regeln för könsuppdelade mått (regel R3) | `tests/ktroskel-regression.test.js` |

Det finns ingen C1. Testernas R1–R4 följer alltså inte reglernas numrering i avsnitt 8 utom för R1. Regel R5
(tröskelmålet) vaktas av `tests/troskelbeslut.test.js` utan märkning, och regel R4 av C3 och röktest. Två andra serier
med samma bokstäver hör inte hit: ritarens regler R1–R11 i `tests/diagramritare.test.js` och I2, I4 och I5 i
`tests/smoke-vyer.test.js`. De övriga testerna i `tests/ktroskel*.test.js`, `tests/kanonymitet.test.js` och
`tests/troskelbeslut.test.js` heter efter det de prövar. `tests/ktroskel-utan-alder.test.js` hör till regeln om ålder
(ADR-64), inte till tröskeln.

**Fixturerna.** Alla bygger på grupper där alla har samma "omöjliga" lön, ett sentinelvärde, så att varje gruppaggregat
är lika med det värdet och ett värde i utdata bara kan komma ur den gruppen.

- `fonster(k)` (`byggDataset`): sex stora BAS-intervall med 150 personer (`STORA`), ett toppyrke med 150 (`TOPP`), fyra
  mellangrupper med 20 (`MELLAN`, `SENT_MELLAN`: syns vid 10, saknas vid 25) och två små med 6 (`SMA`, `SENT_SMA`: syns
  först vid 5).
- `fonsterLitet(k)` (`byggLitetDataset`): samma form i 116 rader, för tester som bara prövar en stämpel eller en mening.
- `fonsterKon(k)` (`byggKonDataset`): därtill ett kön under tröskeln inuti en grupp över den — Y1–Y3 med 30 kvinnor och
  1, 2 respektive 3 män (`KON_MA`), en grupp med 2 kvinnor och 2 män, en ensam person och ett par i stora BAS, med
  jämförelsestatistik för varje AID och ställningstagande för varje BAS. Det som aldrig får synas står i `KON_DOLDA`.
- `fonsterMan(k, manLoner)`: 60 kvinnor i två BAS och ett valfritt antal män (`SJU_MAN`), för regressionen och
  Löneöversyn.
- `iExport(w)` sätter ett fönster i exportläget; testerna prövar vyerna där och skärmen positivt.

`tests/kanonymitet.test.js` har en egen fixtur av samma slag (en stor säker befolkning och tolv små grupper med sex
personer var), och `tests/troskelbeslut.test.js` använder grupper i tre storlekar (150, 20 och 6).

**Vad I4 prövar.** I4 är en invariant, inte ett stickprov: den gäller hela utdatan, så att en ny vy ärver skyddet
utan att någon kommer ihåg att testa den. `samlaUtdata` ritar varje flik i menyn, också i exportläget, och bygger
varje export i avsnitt 9 mot `fonsterKon` vid 10 och vid 25. Invarianten kräver att utdata finns för varje väg (en tom
väg fäller testet), att skärmen visar grupperna och könen under tröskeln, och att ingen enskild lön, ingen lön för en
grupp under tröskeln, ingen lön för ett kön under tröskeln, inget könsgap för en grupp där ett kön är under tröskeln
och inget av förhandskontrollens råvärden finns i det som lämnar verktyget. Undantagna vyer (`EXPORTLAGE_UNDANTAG`,
`UNDANTAGNA_VYER`) och låddiagrammet per kön (`INDIVIDDIAGRAM`) söks inte igenom. Vad invarianten prövar och inte
prövar står i huvudet i `tests/helpers/ktroskel-invariant.js` och i riskanalysen §6.5.

Därtill prövar sviten tur och retur 10 → 25 → 10 mot kvarlevande cacher, flikar och Excel efter en höjning,
gränssnittet, utdata genom de verkliga vägarna, varje exportväg mot exportgrinden, och konfigurationsfil och
organisationspaket. `tests/dokumentation-struktur.test.js` vaktar vad dataskyddsdokumenten och guiderna säger om
inställningen (standardvärdet).

## 11. Kända luckor

- **Invarianten letar efter lönevärden.** Den söker sentinelvärdena, männens löner i Y1–Y3, kostnader och könsgap. Antal,
  andelar och namn för en grupp under tröskeln vaktas inte av den; de omfattas inte av skyddet (avsnitt 2, ADR-70).
  Golven i antal (avsnitt 4, ADR-57) vaktas av egna tester, `tests/aidbas.test.js`, `tests/smoke-aidbas.test.js` och
  `tests/diagramvyer-marken.test.js`, inte av I4.
- **Differenser.** I4 söker tal som står i utdatan, inte tal som går att räkna fram ur andra. Löneöversyns summor,
  scenariojämförelsen A/B och regressionens BAS-effekter prövas därför för sig (avsnitt 9). Differenser mellan olika
  exporter prövas inte: den invikta gruppens median före påslaget kan stå i en annan tabell (gruppen når tröskeln), och
  med påslagets procentsats ger antal gånger median en uppskattning av dess kostnad.
- **Innehållet i bilder prövas inte.** ZIP-filens bilder, utskriftens bilder och Word-utkastets bilder går inte att
  läsa i testet; riggen tar bort bilderna ur utskriften före sökningen. `tests/ktroskel-bilder.test.js` prövar bara
  meningen om sänkt tröskel.
- **Undantagen ligger utanför.** Likvärdigt arbete i fliken, Tabeller och egna vyer med rutan, Personer att granska,
  extremvärdeslistan och låddiagrammet per kön söks inte igenom (avsnitt 4).
- **Exportvägarna i riggen listas för hand.** `samlaUtdata` räknar upp varje export; ett test kräver bara att riggens
  flikar är menyns. En ny export som inte läggs till i riggen prövas inte. Definition of Done kräver att den läggs till
  (`.github/CONTRIBUTING.md` punkt 3, regel R1 i `regler.md`).
- **Riktade rader på små grupper.** Riggen lägger inga egna riktade rader i Löneöversyn; regel R2 prövas för sig.
  Riggens underlag har heller inga kandidatpar i likvärdigt arbete, så Löneöversyns förslag (ADR-69) prövas inte av
  I4 utan av `tests/loneoversyn-forslag-troskel.test.js`. Ett par med en grupp under tröskeln i riggen skulle ändra
  underlaget för alla vägar som I4 söker igenom.
- **Livscykelns kurva i riggen.** Kurvan ritas på skärmen i nästa bildruta, och riggens `samlaUtdata` läser
  diagrammen innan den hunnit ritas; varken diagramdatan för `#lifecycle-chart` eller kopian i Alla diagram kommer
  med i I4. Kurvans vägar prövas i `tests/ktroskel-livscykel.test.js`.
