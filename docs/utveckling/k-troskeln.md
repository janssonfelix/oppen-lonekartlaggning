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
| Tröskeln, inställningen och omritningen | `src/app/06-k-troskel.js` |
| Reglerna vid k: golven, stämplarna, noterna om utelämnade kön och par, BAS-effekterna, punkterna per person (tröskeln som argument; appens namn är adaptrar i `06-k-troskel.js`) | `src/lib/ktroskel.js` |
| Maskeringsnoterna (`kMaskNote`, `kSamladNote`) | `src/app/06-maskeringsnoter.js` |
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
  nämner den inställda tröskeln. Bland dem tar förslagen ett par per AID-etikett, det med störst skillnad (`ettParPerYrke`).
  Ett förslag bär ett belopp räknat ur jämförelseetikettens median, och raden står i summorna på skärmen, i
  Excel-exporten och i konfigurationsfilen; talet ska vara detsamma överallt. En föreslagen rad som inte säkert når
  tröskeln tas bort (`_fcRensaParMal`, regel R2 i avsnitt 8).
- **Varningar och noter om tröskeln.** Noten under en egen riktad rad i Löneöversyn (`36-loneoversyn.js`), varningen
  *Underlaget är litet* i Prioriteringens motiveringsförslag (`55-prioritering.js`, som står när något kön i
  gruppen har färre än tröskeln och gäller skattningens säkerhet, inte läget) och antalet små grupper i
  likvärdighetsanalysens diagnostik (`34-likvardigt-arbete.js`) läser
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

**En fil i taget** (ADR-92). Redovisningsformen och reglerna nedan gäller varje fil som lämnar verktyget för sig: en
grupp under tröskeln får inte stå i filen och inte gå att räkna fram genom att dra ifrån inom samma fil (en total minus
de visade delarna, i samma tabell eller mellan blad och avsnitt i filen). Det som går att räkna fram genom att
kombinera flera filer ur samma underlag skyddas inte. Den som gör det har redan hela underlaget, och skydden finns för
att undvika omedvetna dataläckor, inte för att stänga ute användaren. ZIP-exporten räknas som sina delar: varje fil i
den prövas för sig, och delarna prövas inte mot varandra.

Tabellerna per AID-kod och BAS-intervall och könsfördelningen per BAS-intervall har ett avsiktligt avsteg i antal
(avsnitt 4).

**Noterna innehåller avsiktligt ingen inline-markup.** SheetJS trimmar varje elements text för sig och slår ihop dem
utan avskiljare, vilket ger `4 AID-etikettervisas` i Excel-exporten. Noten är ändå visuellt avskild (`.k-mask-note`).

**Könsuppdelade mått.** De beskrivande könsuppdelade lönemåtten — ett köns median eller percentil, det råa lönegapet,
regressionens ojusterade steg *Endast kön* med den förklarade andelen, en kostnad som räknats ur ett gap — redovisas per
grupp och för hela organisationen bara när varje kön når tröskeln (`_konFarRedovisas`; för en radmängd
`_konFarRedovisasFor`). Där ett sådant mått för hela urvalet utelämnats står ett streck och `_konUtelamnatNot()`.
Det gäller också nyckeltalet på Översikt (`13-oversikt.js`), Löneöversyns råa gap före och efter och scenariojämförelsen A/B (regel R4).
Samma regel gäller `representationPerBas`, `medianGapPct`, `fordelningsgap` och `kvartilfordelning` i
`src/lib/struktur.js`, som tar `{ k }` och visar streck och en not i fliken Struktur, Word-utkastet, PDF-rapporten och
EU-lönerapporten. Kvartilfördelningen visar då antalet per kvartil men inte könsfördelningen i kvartilerna (`konDolt` i
`kvartilfordelning`). Regressionens justerade gap visas från regressionens eget fasta golv, 5 per kön; övriga
skattningar
har fasta eller statistiska golv (avsnitt 5). Fem regler till står i avsnitt 8.

**Prioritering.** En grupp under tröskeln får ingen rad, och könsjämförelsen i en grupp står bara när båda könen når
tröskeln (`prioritera` i `src/lib/prioritering.js`). Annars räknas prioritetsindexet utan könsdelen (`gapScore` är 0),
så att poängen inte röjer den dolda skillnaden. Motiveringsförslaget om kvinnor i den lägsta lönekvintilen kräver
tröskeln för båda könen (`motiveringsgrunder` i `src/lib/prioritering.js`).

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
referens (ADR-44) ändras inte. Allt går genom `_basEffekterForRedovisning` (`06-k-troskel.js`, regeln i `src/lib/ktroskel.js`).

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
tröskeln sin rad med BAS-intervall, AID-etikett, antal och andel kvinnor; medianerna och kostnaden maskeras. Kostnaden för
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
finns bara i minnet och i fliken. Ett scenario sparar det råa gapet bara när varje kön når tröskeln och bär antalet
kvinnor och män, så att gapet prövas mot den tröskel som gäller när jämförelsen visas; ett scenario sparat vid en lägre
tröskel visar ett streck och en not när tröskeln har höjts.

**Kostnaden på individnivå** i Löneöversyn (`_forecastRemediation`, `individlyft` i `src/lib/loneoversyn.js`)
jämför varje kvinna med männens median i hennes grupp när minst `kTroskel()` män finns där, annars med männens median i
BAS-intervallet (också minst `kTroskel()` män); mot en enda mans lön vore kostnaden hans lön minus hennes. En grupp får
egen rad, och kan bli en riktad rad, först när minst `kTroskel()` kvinnor i den berörs, och den samlade kostnaden står
bara när minst `kTroskel()` personer berörs.

**Tabellerna per BAS-intervall** (rapportens avsnitt *Lönestruktur per BAS-intervall* eller *per huvudområde* i
Word-utkastet, PDF-rapporten och Excel-bladet *Per BAS*; ADR-83). Raden *Alla* i tabellerna *Löneskillnader inom
likvärdigt arbete* och *Löneskillnader i åldersgrupper*, och organisationens rad i intervallets tabell, räknas på hela
underlaget, också de utelämnade grupperna. Så att totalen minus de visade raderna inte ger en utelämnad grupps medel
gäller samma kompletterande undertryckning som i Löneöversyns blad *Fördelning*: omfattar de utelämnade
intervallen tillsammans färre än tröskeln undertrycks också det minsta visade intervallets medelvärden (färst
personer, vid lika antal först efter namn), ett i taget tills de undertryckta tillsammans når tröskeln. Räcker inte
alla står inget medel per intervall, bara på raden *Alla*. Ett undertryckt intervall förlorar sina medelvärden i alla
tabellerna, eftersom vart och ett ger intervallets medellön tillbaka: medellön, medellön per kön, kvoten, medelålder
och medelålder per kön i de två tabellerna, medellönen per åldersgrupp, och i intervallets tabell medellönen på
organisationens rad, yrkesgruppernas och könsradernas. Antal och andel kvinnor står kvar (ADR-70), och medianer och
percentiler berörs inte, eftersom de inte går att dela upp i delar. Regeln gäller bara när raden *Alla* står, alltså
när en av de två tabellerna är med i receptet.

Samma regel gäller per kön, eftersom raden *Alla* har medellön och medelålder för kvinnor och för män: de könsceller
vars medel inte står (intervall där ett kön har färre än tröskeln, utelämnade och undertryckta intervall) ska för
varje kön tillsammans omfatta minst tröskeln personer av det könet. Annars döljs medellön och medelålder per kön, och
kvoten, också i det intervall som har minst antal av det könet, och så vidare. Båda könens medel döljs tillsammans:
ett intervall som visar medellön för alla och för det ena könet ger det andra. Könsraderna i intervallets tabell står
kvar med median och percentiler men utan medellön.

Inom ett intervall gäller regeln också för yrkesgrupperna när receptet har måttet *Medellön*: omfattar de utelämnade
AID-etiketterna tillsammans färre än tröskeln undertrycks medellönen för den minsta visade, och så vidare.
Noterna under tabellerna namnger det som undertryckts av det här skälet. Regeln bor i `src/lib/undertryckning.js`
(`kompletterandeUndertryckning`, allmän för delar med antal) och `src/lib/perbas.js` (`perBasTabeller`); exporterna
skriver bara ut det resultatet ger, med noterna ur `rmPerBasUndertryckNoter` (`58-rapportmodell.js`). Vakten är
differensprovet i `tests/ktroskel-differens.test.js`, differensprovet i invarianten I4 på de tabeller som faktiskt lämnar
verktyget (avsnitt 9), och enhetstesterna i `tests/undertryckning.test.js` och
`tests/perbas.test.js`. Det som inte omfattas: medellönen
per åldersgrupp mot raden *Alla*, där antalet per åldersgrupp inte skrivs ut, och vägar som kräver uppgifter
utanför exporten, till exempel könsfördelningen inom en AID-etikett.

**Var uppstår löneskillnaden och huvudområdenas andel** (avsnittet i Lönestruktur, rapportunderlagets block och
meningen under översikten per huvudområde, i exportläget; ADR-87). Delarna och posterna är vägda medellöner per kön,
och med medellönerna för hela urvalet och antalen bildar de ett ekvationssystem: en liten grupps medellön kunde räknas
fram fast posten inte stod, och för vissa val av variabler räckte delarna. Därför räknas grupper där ett kön har 1
till k − 1 personer samman med andra grupper inom samma övergrupp innan delarna räknas (`sammanslagning` i
`src/lib/undertryckning.js`; för varje kön tas den grupp med som har färst av det könet, samma val som i den
kompletterande undertryckningen), så att varje grupp som delarna bygger på har inga eller minst k av varje kön. Den
sammanslagna gruppen och allt under den namnges inte; varje del säger hur många grupper som inte namnges, och en not
säger varför. Delarna summerar till hela skillnaden som förut, men kan skilja sig från skärmens, där tröskeln är 1 och
inget räknas samman (ADR-51). Huvudområdenas andel (`sektorernasAndel` i `src/lib/sektor.js`) är del A med
huvudområde som enda variabel och följer samma regel: huvudområden som räknas samman namnges i en not
(`sektorAndelNot`), och räknas alla samman står inget belopp. Allt som skrivs ut är då linjärt i medellöner för grupper
med inga eller minst k av varje kön, så det mesta som går att räkna fram är ett medel för minst k kvinnor eller k män.
Regeln bor i `src/lib/gapuppdelning.js` och `src/lib/sektor.js`; kortet, översikten och rapportunderlaget skriver bara
ut resultatet. Vakten är differensprovet i `tests/ktroskel-differens.test.js`, som med en allmän lösare försöker räkna
fram varje liten grupps medellön per kön ur det som skrivs ut, och enhetstesterna i `tests/gapuppdelning.test.js`,
`tests/sektor.test.js` och `tests/undertryckning.test.js`. Formlerna och reglerna i detalj står i
`regressionsmodellen.md` §10.

**En punkt per person.** Utanför Tabeller och egna vyer ritas och exporteras en persons punkt i ett spridningsdiagram
bara när personens grupp (AID-koden inom BAS-intervallet, som i hela verktyget, ADR-89) och personens kön i gruppen når tröskeln (`individLitenFor`),
och en not under diagrammet säger hur många personer som inte visas (`_individNot` i `40-alder-karriar.js`). Antalen
räknas på
hela underlaget, inte på det urval diagrammet visar. I Ålder & karriär följer lönegapen, lutningen, trendlinjerna och
lådorna per kön regeln för könsuppdelade mått (regel R3 i avsnitt 8).

**Kvantilpunkterna.** Lönefördelningen som tjugo prickar per grupp (lådmärket med `form: 'kvantiler'`; i dag i Tabeller
och egna vyer, `_figFordelning` i `71-utforska-figur.js`) är ett aggregat som lådan: en grupp eller ett kön under
tröskeln är `liten` och ritas inte i exportläget, om inte rutan i avsnitt 4 är ikryssad. Antalet prickar är högst halva gruppen, så en
prick står aldrig för färre än två personer, och diagramdatan är kvantilerna, aldrig enskilda löner (`kvantilpunkter` i `src/lib/figur.js`).

**Kandidatparen utanför fliken.** Kandidatpar ur Likvärdigt arbete redovisas utanför fliken och dess egen CSV- och
Excel-export bara när båda grupperna når tröskeln, med antalet utelämnade angivet (`_parForRedovisning`): Word-utkastet,
PDF-rapporten, JPA-protokollet (bladet för likvärdigt arbete och försättsbladets antal), Rapporttextens utkast
(`_buildNarrative`), BAS-dossiern, årsbokslutet, Att göra och dess CSV, handlingsplanens förifyllda rader,
gruppdossiern, Löneöversyns
förslag, mål-läge och känslighetskurva samt robusthetspanelen i Exportera (`robusthetLikvardighet` i
`85-robusthet-fardigcheck.js`: par med en grupp under tröskeln namnges inte i någon körning, och panelen anger antalet
sådana par; beslut). Löneöversyns förslag prövas mot den inställda tröskeln också på skärmen (ADR-69, avsnitt 1); de
övriga ritas på skärmen med alla par och i exportläget utan de små. I fliken gäller undantaget i avsnitt 4. Listan
*Lägre krav, högre lön* följer samma regel i rapportunderlaget och BAS-dossiern (`_parOverTroskel`). Har alla
kandidatpar en grupp under tröskeln blir processöversiktens steg 4 inte klart: steget säger att inget finns att hantera
i Att göra och hur många par som bara redovisas i fliken Likvärdigt arbete, och leder dit (`_agStegLikvardigt` i
`src/lib/attgora.js`, ADR-29).

**Lönenivåerna i JPA-protokollet.** Median och medelvärde per kön (ADR-79) står bara för AID-etiketter och
BAS-intervall som protokollet redan redovisar: AID-etiketter där båda könen når tröskeln och BAS-intervall där båda
könen når `statGolv()`, som aldrig är under den inställda tröskeln. Cellerna prövar tröskeln också själva
(`_jpaNivaCeller`). Testet står i `tests/ktroskel-utdata.test.js` (vid 10 och 25). Bladet för BAS-intervall räknar
intervallets medelvärden på alla i intervallet, så lämnar intervallet minus de AID-etiketter i intervallet som bladet
för lika arbete visar 1 till k − 1 personer av ett kön, undertrycks medelvärdena för den minsta visade etiketten i
intervallet, en i taget, med samma regel som tabellerna per BAS-intervall (ADR-83, ADR-91; inom protokollet och inte mot organisationens medelvärden, ADR-92). Regeln
är `kompletterandeUndertryckningPerNyckel` i `src/lib/undertryckning.js`, anropad från `src/app/24-excelexport.js`.
En etikett vars medelvärden döljs förlorar båda könens och differenserna, och räknas som dold för båda könen när
nästa mått prövas. Intervallets rad och medianerna står kvar, och en not i bladet för lika arbete namnger etiketterna. Blad 2a, alla
grupper i lika arbete (ADR-93), är bladet *Lika arbete AID x BAS* med dess regler (avsnitt 4): antal och medianer,
inget medelvärde. Det ger ingen ny väg till ett lönemått för färre än tröskeln, eftersom medianer inte går att dela
upp (avsnitt 11) och bladet inte har något medelvärde att dra ifrån blad 3:s.

**Lika arbetes grupper.** En grupp i Lika arbete är AID-koden i BAS-intervallet (ADR-89), så en kod som finns i flera
intervall blir flera mindre grupper, och varje grupp prövas mot tröskeln för sig. Ingen rad för koden över alla
intervall redovisas, så en grupp under tröskeln går inte att räkna fram som skillnaden mellan en sådan rad och
kodens rader i de andra intervallen. Det gäller tabellen, rapportunderlaget, Word-utkastet, PDF-rapporten,
Excel-bladen, JPA-protokollet, BAS-dossiern och årsbokslutet, som läser samma grupper. Stabilitetsmärkningen av en
skillnad (`_stabilitet` i `src/lib/rapportunderlag.js`) räknas bara för grupper där båda könen når tröskeln, och prövar
bara att ta bort personer så länge varje kön har kvar minst tröskeln.

**Ansvarsgrupperna** (ansvarskod enligt AID). Underraderna per ansvarsgrupp i Lika arbete följer samma regel som raden
för AID-etiketten: under tröskeln inga lönemått, ett kön under tröskeln ger den samlade medianen; raden *Utan
ledningsansvar* visar kvoten bara när båda könen där når tröskeln (`ansvarFor` i `src/lib/vymodell-lika-arbete.js`). Gruppdossiern visar bara antal
per ansvarsgrupp och kön, aldrig lön (`80-gruppdossier.js`), och översiktens andel med ledningsansvar per huvudområde
står bara för ett kön som når tröskeln (`ledningKv`, `ledningMa` i `src/lib/sektor.js`).

**Löneläget** (ADR-55). Organisationens P10, median och P90 per AID-etikett är gruppvärden. Tabellen mot
jämförelsestatistiken, överblicken med lista, bild och tal, Excel-bladet *Referenser*, rapportens avsnitt och
rapportunderlagets block *Lönerna mot referenserna* läser samma rader (`jamforelseUnderlag`, `jamforelseRader` i
`src/lib/jamforelse.js`), och en grupp under tröskeln står inte där och räknas inte. Referensernas egna tal och tabellen
mot ställningstagandet bär inga organisationsvärden och maskeras inte, och könsuppdelade mått förekommer inte. Kolumnen
*Matchning* och sammanfattningen av antalet AID-etiketter per matchningsnivå säger bara hur statistiken matchades och bär
inga lönemått. Diagrammet över statistikens spann (`chart-jmf-statlage`) läser samma rader och visar inget som inte
står i tabellen och bandkartan; filtren på BAS-intervall och huvudområde gäller inte diagrammet.

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

**Flikbytet** (`31-navigering.js`, ADR-80). När användaren själv byter flik (ett klick i menyn, pilarna i menyn,
sökfältet, en länk till en flik) visas fliken och sidan målas innan fliken räknas (`flikbyte`): panelen får
`aria-busy` och en rad om att fliken räknas, och det som stod i den sedan förra gången döljs. Ett nytt flikbyte under
väntan går före (`_flikVal`). De block som tar över en halv sekund och inte syns överst ritas efter flikens övre del,
vart och ett i en egen uppgift med en platshållare (`_ritaTungtBlock`): förhandsbeskedet i Exportera och
rapportunderlaget i Rapporttext (båda i exportläget), regressionskorten i Lönestruktur och löneskillnaden per
åldersgrupp i Ålder & karriär. Ett block räknas i sin uppgift ur det som gäller då och ritar ingenting om fliken har
ritats om eller lämnats, eller om underlaget, tröskeln, förhandsvisningen eller ett val har ändrats sedan fliken
ritades; står platshållaren kvar ritas fliken då om från början. Medan block väntar räknas fliken som inte ritad,
så att exportgrinden ritar om den innan något läses ur den. Allt annat ritar synkront som förut: `renderTabContent`
anropad direkt (exportgrinden, exporterna, omritningen efter ändrad tröskel, testerna) och ett klick från koden
(`el.click()`); ett test som vill pröva det uppskjutna flikbytet anropar `klickaFlik(nav, { uppskjut: true })`
(`tests/flikbyte.test.js`).

**Visningsminnet** (`31-navigering.js`, ADR-81). En flik som användaren byter tillbaka till visas som den är, utan
omritning, när den är färdigritad (inga block väntar) och ingenting har hänt sedan dess som kan ändra det den visar
(`_visasSomRitad`). Det avgörs med en räknare, visningsversionen (`visningNy`, `23-exportgrind.js`), som ökar grovt
hellre än fint: vid varje `click`, `change`, `input`, `keydown`, `drop`, `paste` och `pointerup` i sidan, också i
sidhuvudet och i dialogerna och också de som koden skickar, utom ren navigering (menyns knappar och pilar, knappen och
skuggan för menyn, sidindexet, sökfältet när ett val bara byter flik, och tangenter som bara flyttar fokus eller rullar
sidan); vid varje ny generation (`ritGenerationNy`: tröskeln, förhandsvisningen, modellvalen, underlaget) utom en exports
tur och retur (`medExportLage`); när en flik töms (`tomFlikarUtom`), vid omritningen efter ändrad tröskel, när en fil är
läst (lönefilen, referenserna), vid demot, ett organisationspaket, en konfigurationsfil, rensningen (också den efter en
tid utan aktivitet), en ändrad markering och när en bakgrundsberäkning är klar (skattningarna efter ett tröskelbyte,
kvantilregressionens intervall, inläsningens efterarbete, robusthetsanalysen). Därtill måste fliken vara ritad i samma
läge (skärm eller export, förhandsvisningen) och samma dag, och inte ha ritats om sedan dess. Det som görs efter en
ritning och inte är räkning görs ändå: navigeringen längst ned, sidindexet, sidtiteln, rullningen överst, markeringen
i tabellerna och `efter`-anropen. Inget resultat återanvänds: det som visas igen är flikens innehåll i sidan, och allt
räknas om när fliken ritas (ADR-17). Bara användarens flikbyte visar en flik igen; `renderTabContent` anropad direkt,
exportläget, exportgrinden och klick från koden ritar alltid. Exportgrinden ser fliken som förut: den räknas som
aktuell bara när den ritats i den generation som gäller, så en flik som visas igen efter en exports tur och retur ritas
om innan något exporteras ur den. Vakten är `tests/visningsminne*.test.js`: för varje sorts ändring öppnas varje flik
igen och jämförs med samma flik ritad från början, och ett test visar att en saknad ökning fälls.

**Förhandsvisningen.** Knappen *Som i exporten* i sidhuvudet (`sattForhandsvisning`) sätter skärmen i exportläget —
banner, streckad ram och omritning av det som syns — tills den stängs av. Exporterna byter då inte läge, och ett byte
medan en export pågår avvisas.

**När tröskeln ändras** töms cacherna och flikarna som inte syns, och det som syns ritas om: den öppna fliken och de
delar av Översikt som inläsningen ritar men flikbytet inte gör — nyckeltalen, kompliansöversikten, underlagets kvalitet,
Att göra (vars CSV-knapp bär listan den ritades med), processöversikten, inläsningsrapporten, extremvärdeslistan, en
visad A/B-jämförelse och en öppen gruppdossier (`_renderaOmAllaFlikar`). Från fältet ritas allt om ett steg i taget, med
en ruta som visar förloppet och tar emot alla klick och tangenter tills omritningen är klar. Inläsning av
konfigurationsfil och organisationspaket sätter värdet med `rita: false` och gör omritningen själva, sist, så att allt
ritas en gång. Ett tröskelbyte räknar om skattningarna (`invalidateStatCaches`) bara när `statGolv()` ändras. Paren i
Likvärdigt arbete läser ingen tröskel och räknas inte om; antalet små grupper i deras diagnostik räknas när resultatet
läses (`likvardighetsmodellen.md` §1).

**Efter en export** ritas bara det tillbaka som exporten ritade (`_ritaOmEfterExport`). Lika arbetes minne har ett rum
per tröskel, så att ett lägesbyte inte räknar om något. Det som räknas på knapptryck i Löneöversyn räknas om när fliken
ritas om, om det visas (`_fcRitaOmKnappresultat`), också när fliken öppnas efter att ha tömts; en ruta utan resultat
förblir tom, och *Rensa all data*, en ny lönefil och *Nollställ* glömmer resultaten (`_fcGlomKnappresultat`). Att göras lista byggs en gång för Att göra och
processöversikten
(`renderProcessTracker({ punkter })`), och regressionen körs en gång i omritningen för underlagets kvalitet, Att göra
och processöversikten (`{ reg }`) — ingen cache, bara värden som skickas vidare (ADR-17), och bara så länge underlaget,
k och förklaringsmodellen är desamma som när de räknades. Rutan under omritningen i steg stoppar också `dragover` och
`drop`, så att ingen fil kan släppas in mitt i den.

## 4. Undantagen och avstegen

Undantagen är uppräknade och beslutade. De beskrivs för dataskyddsombudet i `docs/dataskydd/dataskydd.md` §3 (de fyra
numrerade undantagen och styckena om egna riktade rader och vyerna per BAS-intervall) och i riskanalysen §6.5; listan
här ska stämma med dem.

| Undantag | Beslut | Vad som gäller i stället | Hur utdatan märks |
|---|---|---|---|
| **Likvärdigt arbete i sin flik** | Uttryckligt beslut av användaren (`dataskydd.md` §3, undantag 1) | Likvärdighetsanalysen tillämpar inte tröskeln: resultatet är aggregerat per AID-etikett, och lagen kräver att kvinnodominerat arbete prövas också när gruppen är liten. Fliken och dess egen export (Excel och CSV) redovisar kandidatpar även när en grupp är under tröskeln. Antalet små grupper som ändå ingår redovisas i analysens diagnostik. Utanför fliken gäller `_parForRedovisning` (avsnitt 2). | Allt i fliken (`#view-likvardighet`) bär "(undantag: Likvärdigt arbete)", vad exporten än bär. |
| **Tabeller och egna vyer med rutan** | ADR-14, ADR-47 | Fliken visar alla grupper, som alla flikar. Exporten — tabellens CSV och urklipp, diagrammets bild och diagramdata — utelämnar grupper under tröskeln, och könsvärden och gap där ena könet är under den, om inte användaren kryssar i *Ta med grupper under k i exporten* (k är tröskelns värde). Rutan är undantaget. Utan rutan går en utelämnad cell inte att skilja från en tom eller dold, och rader och kolumner som bara har celler under tröskeln utelämnas helt, eftersom etiketten annars röjer att gruppen finns (`70-utforska.js`). `explorerSmaIExport()` är enda vägen att läsa den; organisationspaketet kan stänga av den (avsnitt 6). I exportläget får små celler klassen `explore-liten`, och figuren märker varje datapunkt under tröskeln `liten` (`71-utforska-figur.js`; `exportMedSma` i `70-utforska.js`); markeringen bor i `src/lib/utforska.js` (`liten`, `konLiten`). Diagram med enskilda personers löner (individpunkter) är tillåtna här, även i export, och följer rutan. Differensskydd (att räkna fram en liten grupp ur två filtrerade urval) byggs inte. | "(undantag: valt i Tabeller och egna vyer)" bara när exporten faktiskt bär små grupper. |
| **Personer att granska** | ADR-23 | Individlistan lämnar aldrig verktyget: tabellen har inga exportverktyg, listan ingår inte i rapportunderlag, Word-utkast, PDF, Excel, JPA eller ZIP och döljs vid utskrift. Panelens diagram är märkt `markeraUtanExport` med skälet `individer` och går inte att exportera (`diagramkarnan.md`, ADR-39). Extremvärdeslistan i *Underlagets kvalitet* visar på samma sätt enskilda löner med radnummer, på skärmen, och döljs vid utskrift (stilmallen; webbläsarröktestet `tools/browser-smoke/sakerhet.mjs`). | Ingen: inget lämnar verktyget. Skälet står i behållarens verktygstips. |
| **Bilder med en punkt per person i ZIP och Komplett rapport** | ADR-48 | ZIP-exporten bär bilder av alla ritade diagram, och utskriftens mall *Komplett rapport* bär i sina bilagor bilder av Ålder & karriärs spridningsdiagram, låddiagram och täthetsdiagram. Word-utkastet och rapportens avsnitt (`RM_DIAGRAM`) och de kortare utskriftsurvalen har inga sådana diagram. En persons punkt ritas bara när personens grupp och kön i gruppen når tröskeln (avsnitt 2). Lådornas avvikare i låddiagrammet per kön är enskilda löner, utan AID-etikett, och får exporteras som bild och diagramdata. | Exportnotisen säger att filen innehåller lönedata och ska hanteras som personuppgifter. Diagramdata från ett diagram med en punkt per person bär raden `kIndividRad()`. |
| **Tabellerna per AID-kod och BAS-intervall** | ADR-57, ADR-90 | *Lika arbete AID x BAS* (också blad 2a i JPA-protokollet, ADR-93) är inget undantag: den har Lika arbetes grupper och regler (`likaArbeteGrupper`, avsnitt 2), så att en grupp under tröskeln varken står där eller i tabellen per AID-etikett, bara med namnet i noten, och statusen är densamma i båda (ADR-90). En grupp där ett kön är under tröskeln står utan könsuppdelade mått (*Könsuppdelningen är för liten*), och noten säger också hur många grupper som har färre än två av något kön. I de andra tre tabellerna kräver en egen rad minst fem personer i exportläget (`LITET_UNDERLAG`), inte `kTroskel()`; mindre grupper räknas upp i en not med namn och antal men utan löner. Lönemått följer där `statGolv()` i båda lägena: ett köns jämförelse kräver `statGolv()` personer av varje kön, alltså minst tio (gruppen står annars i arbetslistan *Analys på individnivå*, utan löner), gruppens median och lönespridning `statGolv()` personer. På skärmen visas alla grupper. | Noten under tabellen. |
| **Könsfördelningen per BAS-intervall** | ADR-57 (tillägg 2026-11-13) | Lönestrukturs tabell *Könsfördelning per BAS-intervall* (`#skevhet-table`) och diagrammet över andel kvinnor ovanför den (`chart-skevhet-andel`) ger ett intervall en rad med antal och andel per kön från `LITET_UNDERLAG` (fem) personer totalt, i båda lägena och oavsett tröskeln och antalet per kön (`vymodellLonestruktur` i `src/lib/vymodell-lonestruktur.js`, ritad av `ritaLoneskillnadPerBas` i `41-lika-arbete.js`). Raden bär inga lönemått. Ett mindre intervall får varken rad eller stapel; det namnges i en not under tabellen (`_skevhetNot`, högst tolv namn och sedan "och N till"), som anger hur många intervall som utelämnats och golvet men inga antal eller andelar per intervall. Det som följer av tabellen och diagrammet har samma rader: Excel-bladet *Könsskevhet* (med noten), utskriften och PDF:en, som klonar tabellen, diagrammets diagramdata och diagrambilden i Word och ZIP. Beräkningsbeviset säger regeln och räknar de utelämnade intervallen. | Noten under tabellen. |
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
| `statGolv()`: regression per BAS, Blinder-Oaxaca, bootstrap-KI, livscykelmodellen, extremvärdesdetektorn, det justerade gapet inom AID-etikett, ansvarsindikatorn och Personer att granska; därtill statusen *Går ej att bedöma* i uppmärksamhetstrappan (ADR-59) och lönemåtten i tabellerna per AID-kod och BAS-intervall (ADR-57) | `max(kInstalld(), K_STANDARD)`, i båda lägena | Gränsen gäller skattningens tillförlitlighet, inte redovisningen, och följer därför inte med nedåt. Den följer med uppåt, så att ett skärpt skydd också gäller skattade gruppvärden. |
| Huvudregressionen (Lönestruktur; `runOLSRegression`) | 5 av varje kön | Fast golv (beslut, ADR-38). Det justerade gapet med konfidensintervall visas därifrån, också när det ojusterade steget utelämnas (regel R1). |
| Motiveringsregeln om medelålder per kön (`55-prioritering.js`) | 3 av varje kön | Fast golv (beslut, ADR-38). |
| Löneöversiktens rader per AID-etikett (`39-loneoversikt.js`) | 5 | Fast golv (beslut, ADR-38). |
| `LITET_UNDERLAG` (`litetUnderlag()`) | 5 | Ingen maskeringsgräns. I ett diagram ritas en stapel eller ett segment som gäller färre än fem personer med mönster, som en varning (ADR-39, `diagramkarnan.md`). I tabellerna per AID-kod och BAS-intervall är det gränsen för en egen rad i exportläget, och i könsfördelningen per BAS-intervall gränsen för en egen rad i båda lägena (avsnitt 4). |
| Lönepolitikens mellannivå (`ANTAL_MIN` och `maskeringsniva` i `src/lib/lonepolitik.js`) | Från 5 upp till tröskeln | Grupper mellan 5 och k redovisas med antal (bandplacering i antal), inga lönemått; under 5 maskeras raden, namnges i en not och räknas in i BAS-totalen. Mellannivån försvinner när tröskeln är 5 eller lägre. |

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
| Metodbilagans rad *Minsta gruppstorlek för redovisning* (metodbladet i varje Excelfil, `_appendMethodSheet`; metodavsnittet i Word-utkastet och PDF-rapporten) | Alltid |
| Diagramdatans första rad | Alltid |
| Tabell-CSV:ens sista rad (`_csvMedStampel`) | Alltid |
| Rapportunderlagets sammanfattning | Alltid |
| Diagrambilder: PNG, SVG, ZIP, rapportunderlagets diagramkopia (en rad i bildens nederkant) | Under 10 |
| Tabell till urklipp (`_tsvMedStampel`) | Under 10, och när exporten hör till ett undantag |
| Sidfötter (`_kSidfot`) | Under 10 |
| Varje block i rapportunderlaget | Under 10 |
| Gruppdossierns textkopia | Under 10 |
| Utskriftsrapporten (PDF-rapporten) och den utskrivna handlingsplanen, direkt under rubriken (`_kSanktStycke`) | Under 10 |
| Konfigurationsfilen och organisationspaketet | Alltid, som fält (`kTroskel`), inte som mening |

Exporter som hör till ett undantag anger det (`_kUndantagFor`, `kStampelFor`; avsnitt 4), och exportnotisen säger att
filen innehåller lönedata och ska hanteras som personuppgifter.

## 8. Reglerna R1–R5

Fem regler för könsuppdelade mått utöver avsnitt 2 (ADR-38).

- **R1. Regressionens ojusterade steg döljs när ett kön är under tröskeln.** Första steget i den stegvisa uppdelningen
  (*Endast kön*) är samma slags mått som det råa gapet. `_regStegForRedovisning(reg)` lämnar ut stegen utan det första,
  och ingen förklarad andel, när `_konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed)` är falskt; regressionskortet
  visar då ingen förklaringsbudget, och en mening står i stället för det utelämnade, i kortet och i rapportens bilaga om
  den justerade löneskillnaden (Word-utkastet, PDF-rapporten och utskriften, i urvalen hela dokumentationen och facklig
  dialog). Staplarna för stegen som står kvar räknar sin bredd bara mot de visade stegen, så att det utelämnade steget
  inte går att läsa ut ur bredden, och kronexemplet i kortet, som utgår från männens medianlön, står bara när båda könen
  når tröskeln (C6; `51-lika-arbete-regressionskort.js`). Beräkningen är densamma, och det
  justerade gapet med konfidensintervall visas från regressionens fasta golv, 5 per kön. Det råa gapet som text:
  `_raGapText`.
- **R2. Egna riktade rader i Löneöversyn på grupper under tröskeln är tillåtna** (användarens egen simulering):
  beloppet står på raden och ingår i summorna på skärmen och i Excel-exporten, och raden får en not om att gruppen är
  under tröskeln. Beskrivet i `dataskydd.md` §3, riskanalysen §6.5 och körguiden. Rader som verktyget självt föreslår
  ur kandidatpar i likvärdigt arbete omfattas inte (ADR-69): verktyget föreslår ingen rad ur ett par där den
  kvinnodominerade AID-etiketten eller jämförelseetiketten har färre personer än den inställda tröskeln, i något läge
  (`_fcKandidater`, avsnitt 1), och tar ett par per kvinnodominerad AID-etikett, det med störst skillnad bland dem som når
  tröskeln (`ettParPerYrke` i `src/lib/loneoversyn.js`, som `foreslaRiktning` och `stangningsriktning`, och därmed
  känslighetskurvan, går genom). En föreslagen rad bär `kalla: 'par'` men inte paret. `_fcRensaParMal` prövar den när
  den inställda tröskeln ändras (`sattKTroskel`), när en konfigurationsfil läses in och när lönefilen läses in, också på
  skärmen. En rad som föreslogs i sessionen avgörs säkert: storleken på grupperna i paret den räknades ur finns i
  minnet (`_fcParUrsprung`, en `WeakMap` per rad som inte sparas), och raden står kvar när båda når tröskeln. En rad
  utan den uppgiften — ur en konfigurationsfil, också en äldre fil med en rad per jämförelseetikett — står kvar bara när
  parlistan är fullständig, AID-etiketten har par och alla når tröskeln; annars tas den bort, på den försiktiga sidan.
  Parlistan är fullständig när den inte är kapad vid *Visa max* (`topN`): `parAntal.totalt`, som räknas före urvalet
  (ADR-61), är lika med antalet par i listan. *Lägre krav, högre lön* är en egen lista och räknas inte. Meningen vid förslagen
  (`#forecast-par-not`) säger hur många rader som togs bort och varför, tills ett nytt förslag görs. Inget som räknades
  med en borttagen rad står kvar: när en rad tas bort räknas prognosens utfall om ur raderna som står kvar, också när
  Löneöversyn inte är den öppna fliken; exporten och scenarierna A/B räknar alltid utfallet ur raderna som de står
  (`_fcBeraknaUtfall`), inte ur ett sparat utfall; och ett sparat scenario som räknades med en rad som inte står sig
  tas bort, med en mening om det. Konfigurationsfilen bär fältet `kalla` (valfritt, version oförändrad); egna rader
  står kvar med noten.
- **R3. Ålder & karriär följer regeln.** Ojusterat och åldersjusterat gap kräver tröskeln för båda könen; lutning,
  trendlinje med konfidensband och låda kräver den för det könet (`vymodellAlderOchLon` i `src/lib/vymodell-alder-karriar.js`,
  `_setDiagramKNot` för noten under diagrammet). Demografidelens trendlinje och lutning för hela urvalet (alla BAS eller det valda) kräver att
  urvalet når tröskeln (beslut 2026-10-16); annars utelämnas de och noten under diagrammet säger det. Punkterna per
  person följer sin egen regel (avsnitt 2). Åldersfördelningen per kön är antal, inte lönemått, och lönespridningen över
  ålder ritar bara de femårsgrupper som når tröskeln (`alderBandRader` i `src/lib/vymodell-alder-karriar.js`).
- **R4. Lönerevisionssimulatorn är borttagen** (2026-10, ADR-50). Det den kunde — begränsa till ett kön och en
  lönegräns, "höj till" — gör en riktad rad i Löneöversyn, som följer R2: en rad som berör färre personer än tröskeln är
  användarens egen simulering, beloppet visas på raden med noten om enskildas löner. Lönegapet före och efter kräver
  tröskeln för varje kön (`_konFarRedovisasFor`). Vaktas av R4, C3 och röktest.
- **R5. Löneöversyns tröskelmål följer tröskeln** (`_forecastThreshold`; beslut 2026-10-16): lyftet i procent till
  kvinnor och dess kostnad (kvinnornas lönesumma gånger procentsatsen) visas bara när varje kön i urvalet når tröskeln
  (`_konFarRedovisasFor`), annars ett streck med `_konUtelamnatNot()`. Vaktas av R5 i `tests/troskelbeslut.test.js`.

## 9. Utdata och vakter

Raderna är vägarna som riggens `samlaUtdata` (`tests/helpers/ktroskel-rigg.js`) samlar in och som invarianten I4
söker igenom, och de riktade testerna för det I4 inte ser. Tabellen är förteckningen över utdata och vakter; riskanalysen
(`docs/dataskydd/riskanalys.md` §6.5) sammanfattar skyddet för dataskyddsombudet och hänvisar hit.

| Utdata | Regel | Vakt |
|---|---|---|
| Skärmen, alla flikar | Visar alla grupper (ADR-51) | I4 (positivt); `tests/kanonymitet.test.js` (skärmen maskerar inget) |
| Varje flik i menyn, ritad i exportläget (det *Som i exporten* visar och exporterna läser) | Avsnitt 1–2 | I4; *[I4] listan över flikar är menyns flikar* i `tests/ktroskel-exporter.test.js`; läsning vid 10, 25 och 5 i `tests/ktroskel.test.js` och `tests/ktroskel-hojning.test.js` |
| Översiktens delar: Att göra, processöversikten, inläsningsrapporten | Avsnitt 1–2 | I4 |
| Att göra-punkterna och Att göra-CSV | Avsnitt 2, kandidatparen | I4; `tests/ktroskel-utdata.test.js` (par utanför fliken) |
| Word-utkastet, rapportens avsnitt per BAS-intervall och bilagan med gruppdossierer | Avsnitt 2 | I4; `tests/ktroskel-utdata.test.js` (par i Word-utkastet och utskriften) |
| Utskriften: komplett, ledning, facklig, med gruppdossierer | Avsnitt 2 och 7 | I4 (texten; bilderna tas bort före sökningen); I3 |
| Rapportunderlagets block (HTML och text) och Rapporttextens utkast | Avsnitt 2 och 7 | I4; `tests/kanonymitet.test.js` (parblocket) |
| Excel: alla flikar, JPA-protokollet, EU-lönerapporten, handlingsplanen, jämförelseexporten, Löneöversyn, Löneöversikten, prioriteringslistan | Avsnitt 2, 5 och 8 | I4; C5 (bladet Lönepolitik); I1 (Löneöversyn) |
| ZIP-filens Excel-fil | Avsnitt 2 och 7 | I4; I3 |
| ZIP-filens bilder | Avsnitt 2 och 4 (ADR-48) | Bildernas innehåll prövas inte (avsnitt 11); `tests/ktroskel-bilder.test.js` prövar meningen under 10 |
| Tabell-CSV för varje tabell med CSV-knapp | Avsnitt 2 och 7 | I4 |
| Diagramdata för varje diagram som diagramkärnan har ritat, och kopiorna i Alla diagram | `diagramkarnan.md` §1 och §7 | I4 (diagrammen ur kärnans register, och ett test kräver att varje ritat diagram har en väg; kopiorna ska vara källans, rad för rad); differentialtesterna i `tests/diagramritare.test.js` |
| Tabeller och egna vyer: tabellens CSV och urklipp, diagrammets bild och diagramdata | Avsnitt 4 (ADR-14) | I4 med rutan urkryssad; `tests/kanonymitet.test.js` (Utforskas export; rutan låst av paketet); `tests/utforska.test.js` |
| Gruppdossierns textkopia, för varje valbar grupp | Avsnitt 2 och 7 | I4; `tests/ktroskel-utdata.test.js` (par) |
| BAS-dossierns textkopia, för varje valbart intervall | Avsnitt 2 | I4; `tests/basdossier.test.js` |
| Robusthetspanelen i Exportera | Avsnitt 2, kandidatparen | I4; `tests/ktroskel-utdata.test.js`; `tests/gruppdossier-app.test.js` |
| Löneläget: tabellen, överblicken, bladet *Referenser*, statistikens matchning och överblickens diagram | Avsnitt 2 (Löneläget, ADR-55) | I4; `tests/lonelaget-app.test.js`; `tests/jamforelsestatistik-app.test.js` |
| Konfigurationsfilen (hela, årsbokslutet, importprofilerna) och importprofilerna som JSON | Bara aggregat och rubriknamn; bokslutet i exportläget (ADR-54) | I4; I8 (sakliga skäl); `tests/ktroskel-utdata.test.js` (konfigurationsfilen) |
| Förra årets bokslut: rapportunderlagets block, rapportens avsnitt och BAS-hantelns diagramdata | Den högre av årens trösklar (ADR-54) | I4 |
| Förhandskontrollens råvärden | Bara på skärmen | I4 |
| Varje tabell ovan med en kolumn med medel, summa eller kostnad: totalen minus de visade delarna | Avsnitt 2 (S4: inget lönemått får gå att räkna fram genom att dra ifrån inom samma fil; ADR-88, ADR-92) | Differensprovet i I4 (`differensprov` i `tests/helpers/differens.js`): varje sådan rubrikrad är deklarerad i riggen (`DIFFERENS_DEKLARATIONER`), med kolumner och totalrad eller som inget att dela upp med skäl, och en odeklarerad fäller invarianten; för de deklarerade måtten lämnar ingen total minus de visade delarna 1 till k − 1 personer, och ingen rad i en tabell utan totalrad lämnar en av riggens små grupper. Prövas i dag: tabellerna per BAS-intervall (Word-utkastet, utskriften, Excel), Löneöversyns fördelning och utfallstabell, JPA-protokollets tabeller; självtestet i `tests/ktroskel-differens.test.js` |
| JPA-protokollet: bladet för BAS-intervall minus bladet för lika arbete, per intervall och kön | Avsnitt 2 (lönenivåerna i JPA-protokollet, ADR-91) | Differensprovet i I4, med en deklaration över två blad (`korsblad` i `DIFFERENS_DEKLARATIONER`), vid 10 och 25; I4 kräver att riggens intervall *J* har rader i båda bladen, att etikettens medelvärden döljs med en not och att medianerna och intervallets rad står kvar; `tests/undertryckning.test.js` (regeln) |
| Var uppstår löneskillnaden (kortet, rapportunderlagets block, trappans diagramdata), med standardvalet och andra val av variabler, och huvudområdenas andel (översikten per huvudområde och rapportunderlaget) | Avsnitt 2 (Var uppstår löneskillnaden, ADR-87) | `tests/ktroskel-differens.test.js` (två, tre och fyra huvudområden med ett eller flera små; standardvalet; huvudområde, AID-mellannivå och åldersgrupp som variabler; flera små grupper; 60, 300 och 2 000 personer); `tests/gapuppdelning.test.js`, `tests/sektor.test.js` och `tests/undertryckning.test.js` (regeln); I7 |
| Underlaget (`figur.underlag`, *Räkna för*) | Avsnitt 1 | I6 |
| Löneöversyn: kostnad per grupp, knappresultat, egna rader, tröskelmål | Regel R2, R4 och R5 | I1, I1b; R2 och R4 i `tests/ktroskel-regression.test.js`; R5 i `tests/troskelbeslut.test.js` |
| Löneöversyns summor: bladen *Fördelning* och *Sammanfattning*, utfallstabellen i exportläget | Avsnitt 2 (Löneöversyns summor, ADR-70) | `tests/ktroskel-loneoversyn-summor.test.js` (en ensam person, två små grupper under tröskeln tillsammans, små grupper som når den, alla grupper under den, lika antal; *Varav*; egna riktade rader; skärmen) |
| Regressionens BAS-effekter: rapportens bilaga (Word-utkastet, PDF-rapporten, utskriften) och regressionskortet i exportläget | Avsnitt 2 (BAS-effekterna, ADR-70) | `tests/ktroskel-bas-effekter.test.js` (ett intervall och ett referensintervall med 4 personer, i invariantens utdatavägar) |
| Livscykelns lönekurva: diagramdatan, bilden, ZIP-filen, kopian i Alla diagram, fliken i exportläget och beräkningsbeviset | Avsnitt 2 (livscykelns lönekurva, ADR-70) | `tests/ktroskel-livscykel.test.js` (ett valt intervall med 4 personer: kurvans egna vägar och invariantens utdatavägar; ett valt intervall över tröskeln; skärmen) |
| Tabellerna per BAS-intervall: raden *Alla* och organisationens rad mot de visade raderna (Word-utkastet, PDF-rapporten, Excel-bladet *Per BAS*) | Avsnitt 2 (tabellerna per BAS-intervall, ADR-83) | `tests/ktroskel-differens.test.js` (ett utelämnat intervall eller huvudområde, kvinnorna i ett intervall, direkt och via männen, medelåldern, organisationens rader och könsraderna med måttet *Medellön*, en utelämnad AID-etikett, åldersgrupperna); `tests/undertryckning.test.js` (regeln); `tests/perbas.test.js` (tabellerna); `tests/egna-tabeller-app.test.js` (rapporten och Excel vid 25); differensprovet i I4 (Word-utkastet, utskriften och Excel vid 10 och 25) |
| Löneöversyns scenariojämförelse A/B i exportläget | Avsnitt 2 (Löneöversyns summor, ADR-70) | `tests/ktroskel-loneoversyn-scenarier.test.js` (*Varav* som streck: differensen mot utfallet; scenariot sparat på skärmen och i exportläget; *Varav* som står; övriga kolumner; att scenarierna inte följer med i konfigurationsfilen) |
| Löneöversyns förslag ur kandidatparen (*Föreslå riktade potter*, mål-läget, känslighetskurvan), deras rader i Excel-exporten och konfigurationsfilen | Avsnitt 1 och regel R2 (ADR-69): den inställda tröskeln, också på skärmen | `tests/loneoversyn-forslag-troskel.test.js` (jämförelseetiketten eller den kvinnodominerade AID-etiketten under tröskeln, höjd tröskel på skärmen, inläst konfigurationsfil; en AID-etikett med två jämförelseetiketter: en rad, och förslag ur det lilla paret, äldre filer med en rad per jämförelseetikett och en ensam rad ur det lilla paret tas bort); `tests/loneoversyn.test.js` (ett par per AID-etikett); I1 i `tests/ktroskel-invarianter.test.js`; `tests/ktroskel-utdata.test.js`; `tests/troskelbeslut.test.js`. Inte I4: riggens underlag har inga kandidatpar (avsnitt 11) |
| Regressionskortet (ojusterat steg, förklarad andel) | Regel R1 | R1 i `tests/ktroskel-regression.test.js` (samma vägar som I4, med 7 män i underlaget) |
| Ålder & karriär | Regel R3 | R3 i `tests/ktroskel-regression.test.js`; `tests/troskelbeslut.test.js` (trendlinjen för hela urvalet) |
| Könsuppdelade mått för hela organisationen och per BAS | Avsnitt 2 | C2, C3, C4, C6 |
| Prioritering: könsjämförelsen, prioritetsindexet, motiveringen om lägsta lönekvintilen | Avsnitt 2 (Prioritering) | `tests/ktroskel-utdata.test.js` (fliken i exportläget: ingen könsskillnad för en grupp med 2 män); `tests/prioritering.test.js` (grupper och könsmedianer under tröskeln, och motiveringen om lägsta lönekvintilen, B7.12); I4 (prioriteringslistan) |
| Ansvarsgrupperna i Lika arbete | Avsnitt 2 (Ansvarsgrupperna) | `tests/kanonymitet.test.js` |
| Huvudtalets spärr (*Endast kön*) | Avsnitt 1 (ADR-56) | `tests/regression-app.test.js` |
| Stämplarna för undantagen | Avsnitt 4 och 7 | I2 |
| Omritning efter konfigurationsfil och organisationspaket | Avsnitt 3 | I5 i `tests/ktroskel-exporter.test.js` |
| Låsningarna ur organisationspaketet | Avsnitt 6 (ADR-47) | `tests/organisationspaket.test.js`, `tests/ktroskel-regression.test.js`, `tests/organisationspaket-app.test.js`, `tests/kanonymitet.test.js` |
| Personer att granska och extremvärdeslistan | Avsnitt 4 (ADR-23) | Undantagna i I4; `tests/personer-att-granska-app.test.js` (listan lämnar inte verktyget); `tests/alla-diagram.test.js` (`markeraUtanExport`) |
| Likvärdigt arbete i fliken och dess egen export | Avsnitt 4 | Undantagna i I4; I2 (stämpeln) |
| Tabellerna per AID-kod och BAS-intervall | Avsnitt 4 (ADR-57, ADR-90) | `tests/aidbas.test.js`, `tests/aidbas-app.test.js`; I4 i exportläget; `tests/ktroskel-utdata.test.js` (vid 10 och 25 har *Lika arbete AID x BAS* exakt tabellens grupper per AID-etikett, och grupperna under tröskeln bara sina namn i noten) |
| Könsfördelningen per BAS-intervall: tabellen, diagrammet och dess diagramdata, Excel-bladet *Könsskevhet* och utskriften | Avsnitt 4 (ADR-57) | `tests/diagramvyer-marken.test.js` (i exportläget vid tröskeln 10 får ett intervall med 7 personer en rad och ett med 4 bara sitt namn i noten, utan andelar, i tabellen, diagrammets data och bild, diagramdatan, Excel-bladet och utskriften; ett annat test kräver att diagrammet har tabellens intervall och andelar) |

## 10. Testernas märkning

Testerna för tröskeln bär sitt ID först i namnet på en `describe`, inom hakparentes (`[I4] …`). Serierna I1–I8,
C2–C6 och R1–R5, med vad de prövar, regeln, koden och testfilen, står i spårbarhetsmatrisen
([`sparbarhet.md`](sparbarhet.md) avsnitt 11); R-märkningen är reglernas i avsnitt 8. De övriga testerna i
`tests/ktroskel*.test.js`, `tests/kanonymitet.test.js` och `tests/troskelbeslut.test.js` heter efter det de prövar.
`tests/ktroskel-utan-alder.test.js` hör till regeln om ålder (ADR-64), inte till tröskeln.

**Fixturerna.** Alla bygger på grupper där alla har samma "omöjliga" lön, ett sentinelvärde, så att varje gruppaggregat
är lika med det värdet och ett värde i utdata bara kan komma ur den gruppen.

- `fonster(k)` (`byggDataset`): sex stora BAS-intervall med 150 personer (`STORA`), en stor AID-etikett med 150 (`TOPP`), fyra
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
och inget av förhandskontrollens råvärden finns i det som lämnar verktyget. Diagrammen tas ur diagramkärnans eget
register (`_rfBehallare`, `diagramkarnan.md` §3), inte ur en lista eller en väljare: riggen väntar in det som ritas
senare (kvantilregressionens intervall i bakgrunden, `_regKvantilKlar`, och livscykelns kurva i nästa bildruta), läser
registret efter ritningen på skärmen, i Alla diagram, i exportläget och med förra årets bokslut, och läser varje diagram i
ett och samma exportläge sedan flikarna har ritats om i det (`exportSakraAlla`, som ZIP-filen). Ett test kräver att varje
diagram i registret har en väg med diagramdata, eller en väg som säger att det inte har något att exportera (det ritas inte
i exportläget, eller allt i det hör till grupper under tröskeln), utom de namngivna undantagen nedan och diagram märkta
`markeraUtanExport`. Riggen sparar en ögonblicksbild i *Spara och jämför år*, så att jämförelsens diagram ritas; övriga
diagram ritas i sitt standardläge. Undantagna vyer (`EXPORTLAGE_UNDANTAG`,
`UNDANTAGNA_VYER`) och låddiagrammet per kön (`INDIVIDDIAGRAM`) söks inte igenom. Vad invarianten prövar och inte
prövar står i huvudet i `tests/helpers/ktroskel-invariant.js` och i avsnitt 11.

Därtill prövar sviten tur och retur 10 → 25 → 10 mot kvarlevande cacher, flikar och Excel efter en höjning,
gränssnittet, utdata genom de verkliga vägarna, varje exportväg mot exportgrinden, och konfigurationsfil och
organisationspaket. `tests/dokumentation-struktur.test.js` vaktar vad dataskyddsdokumenten och guiderna säger om
inställningen (standardvärdet).

## 11. Kända luckor

- **Invarianten letar efter lönevärden.** Den söker sentinelvärdena, männens löner i Y1–Y3, kostnader och könsgap. Antal,
  andelar och namn för en grupp under tröskeln vaktas inte av den; de omfattas inte av skyddet (avsnitt 2, ADR-70).
  Golven i antal (avsnitt 4, ADR-57) vaktas av egna tester, `tests/aidbas.test.js`, `tests/aidbas-app.test.js` och
  `tests/diagramvyer-marken.test.js`, inte av I4.
- **Differenser.** I4:s sökning ser tal som står i utdatan, inte tal som går att räkna fram ur andra. Differensprovet
  i invarianten (avsnitt 9) ser en total minus de visade delarna i samma tabell, men bara i tabeller vars rubriker
  nämner medel, summa eller kostnad, bara för de mått som deklarerats (aldrig medianer och percentiler, som inte går
  att dela upp), och bara så långt riggens underlag ger rader; en tabell utan totalrad prövas bara mot riggens små
  grupper. Differenser mellan två tabeller prövas bara där en deklaration över två blad finns (JPA-protokollets blad
  för BAS-intervall mot bladet för lika arbete, ADR-91), inte till exempel Löneöversyns blad *Fördelning* mot
  *Sammanfattning*, och inte härledningar som kräver uppgifter utanför exporten.
  Löneöversyns summor, scenariojämförelsen A/B och regressionens BAS-effekter prövas därför för sig (avsnitt 9), och
  ekvationssystemen i uppdelningen av löneskillnaden med lösaren i `tests/ktroskel-differens.test.js`. Differenser
  mellan olika filer omfattas inte av skyddet (avsnitt 2, ADR-92) och prövas inte. Exempel: Löneöversyns kostnad per
  grupp, som med ett påslag i procent är gruppens lönesumma, mot intervallets medellön i tabellerna per BAS-intervall;
  protokollets blad för lika arbete mot samma tabeller; den invikta gruppens median före påslaget, som kan stå i en
  annan fil (gruppen når tröskeln) och med påslagets procentsats ger en uppskattning av dess kostnad. Differenser mellan olika
  uppdelningar i samma export prövas heller inte: uppdelningen av löneskillnaden räknar samman andra grupper än
  tabellerna per BAS-intervall utelämnar, och provet gäller varje utdata för sig.
- **Ålder & karriär med ett valt BAS-intervall och tröskeln 5.** Riggen ritar Ålder & karriär med alla BAS-intervall;
  ett valt intervall prövas av R3 i `tests/ktroskel-regression.test.js`, inte av I4. Vid tröskeln 5 läses flikarna
  (`tests/ktroskel.test.js`, `tests/ktroskel-hojning.test.js`), men exporterna prövas av I4 bara vid 10 och 25.
- **Innehållet i bilder prövas inte.** ZIP-filens bilder, utskriftens bilder och Word-utkastets bilder går inte att
  läsa i testet; riggen tar bort bilderna ur utskriften före sökningen. `tests/ktroskel-bilder.test.js` prövar bara
  meningen om sänkt tröskel.
- **Undantagen ligger utanför.** Likvärdigt arbete i fliken, Tabeller och egna vyer med rutan, Personer att granska,
  extremvärdeslistan och låddiagrammet per kön söks inte igenom (avsnitt 4).
- **Exportvägarna i riggen listas för hand.** `samlaUtdata` räknar upp varje export utom diagrammen, som tas ur
  diagramkärnans register; ett test kräver bara att riggens flikar är menyns och att varje ritat diagram har en väg. En ny
  export som inte läggs till i riggen prövas inte. Definition of Done kräver att den läggs till
  (`.github/CONTRIBUTING.md` punkt 3).
- **Riktade rader på små grupper.** Riggen lägger inga egna riktade rader i Löneöversyn; regel R2 prövas för sig.
  Riggens underlag har heller inga kandidatpar i likvärdigt arbete, så Löneöversyns förslag (ADR-69) prövas inte av
  I4 utan av `tests/loneoversyn-forslag-troskel.test.js`. Ett par med en grupp under tröskeln i riggen skulle ändra
  underlaget för alla vägar som I4 söker igenom.
- **Modelltal känns inte igen.** I4 söker sentinelvärden, och livscykelns kurva är modellens tal för det valda
  intervallet, inte gruppens löner. Med felet från lagningen av kurvan återinfört och ett intervall med 6 personer valt
  står kurvan i invariantens väg för `lifecycle-chart`, men I4 faller inte. Riggen ritar kurvan för det förvalda
  intervallet (det största); kurvan för ett litet intervall prövas i `tests/ktroskel-livscykel.test.js`, som söker efter
  kurvans egna tal. Detsamma gäller regressionens BAS-effekter och dess ojusterade steg: med båda omaskade i
  exportläget (läckprov 2026-11-14) står effekterna för riggens små intervall i fliken, Word-utkastet och utskriften,
  men I4 faller inte; `tests/ktroskel-bas-effekter.test.js` och R1 i `tests/ktroskel-regression.test.js` faller.
- **Diagram som riggens underlag inte ritar.** Testet om att varje ritat diagram har en väg ser bara det som står i
  registret. Hanteln per AID-etikett med förra årets bokslut (`chart-arsjamforelse`) ritas inte, eftersom riggens bokslut
  inte ger den några rader. Lönehistogrammet per kön ritas på skärmen men inte i exportläget med riggens underlag, och
  dess väg säger att det inte finns något att exportera; histogrammets diagramdata prövas alltså inte med innehåll. Var
  uppstår löneskillnaden ritas i exportläget sedan små grupper räknas samman (ADR-87), och dess diagramdata söks
  igenom vid 10 och 25.
- **Andra slag av utdata.** Tabellerna med CSV-knapp räknas upp ur knapparna i sidan (`[data-csv-table]`), inte ur ett
  register. Varje tabell läses genom exportgrinden med sitt id, så en omritning gör inte att den hoppas över, men en
  tabell vars knapp inte står i sidan när riggen läser (bara efter ett val eller i en dialog) kommer inte med, och inget
  test kräver att uppräkningen är fullständig. Gruppdossierns och BAS-dossierns textkopior byggs för varje valbar grupp
  och intervall med samma funktioner som kopieringsknappen, inte ur den öppnade dialogen; dialogerna ritar inga diagram.
  Beräkningsbevisen visas bara på skärmen och har ingen exportväg. Av knappresultaten körs robusthetspanelen och
  Löneöversyns åtgärder och känslighet; Löneöversyns förslag ur kandidatparen och Var uppstår löneskillnaden med andra
  val av variabler prövas för sig (avsnitt 9). Tabellernas urklipp är samma rader som deras CSV.
