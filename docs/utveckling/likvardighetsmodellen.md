# Likvärdighetsmodellen — referens

Likvärdighetsanalysen jämför organisationens kvinnodominerade yrken med yrken som inte är kvinnodominerade och har lika
eller lägre krav, och pekar ut par där jämförelseyrket har högre lön. Bredvid kandidatparen står listan *Lägre krav,
högre lön*. Det här dokumentet bär den **gällande lydelsen** för analysen: definitionen av kvinnodominerat och var den
används, de tre stegen, måtten på kraven, konfidensintervallen och åldersjusteringen, listan över lägre krav,
inställningarna och vakterna. Koden är sanningen; där dokumentet och koden skiljer sig är det dokumentet som ska
rättas.

Dokumentet är inte beslutsloggen och inte en tolkning av lagen. Varför det är så här, vad som övervägdes och när det
beslutades står i besluten i [`arkitekturbeslut.md`](arkitekturbeslut.md): ADR-25, 60, 61 och 72, och för reserven för
kvinnoandel ADR-34. Lagrummen står i [`lagrum.md`](lagrum.md). Minsta gruppstorlek, undantaget för fliken och regeln
för paren utanför fliken står i [`k-troskeln.md`](k-troskeln.md) (§4 och §2) och upprepas inte här. Hur BAS kodas i
regressionerna står i [`regressionsmodellen.md`](regressionsmodellen.md) §3.

| Del | Fil |
|---|---|
| Modellen: definitionen, de tre stegen, bootstrappen, åldersjusteringen, poängläget, *Lägre krav*, BAS-rangen | `src/lib/likvardighet.js` |
| Adaptern som läser appens tillstånd, fliken, diagrammen och flikens CSV- och Excel-export | `src/app/34-likvardigt-arbete.js` |
| Inställningarna och deras standardvärden | `state.likvardighet` i `src/app/12-tillstand.js` |
| Definitionen i appen (`kvDomNu`, `konsklassNu`, `aidbasDefinition`, `lvJamforelse`) | `src/app/45-aid-bas-tabeller.js` |
| Reserven för kvinnoandel (`nationellAidKlass`) och regeln för paren utanför fliken (`_parForRedovisning`) | `src/app/06-kvinnoandel-referens.js` (`nationellAidKlass`), `src/app/06-k-troskel.js` (`_parForRedovisning`), `src/lib/skrreferens.js` |
| Poängen ur lönefilen (`_deriveArbetsvarderingFromData`) | `src/app/32-filinlasning.js` |
| Vakterna | avsnitt 9 |

## 1. Vad modellen gör och var den bor

Modellen bor i `src/lib/likvardighet.js` och speglas in i bygget som övriga kärnmoduler (ADR-8).
`src/app/34-likvardigt-arbete.js` innehåller bara tillståndsadaptern och gränssnittet: rendering, diagram och export.
Att adaptern verkligen delegerar vaktas av `tests/drift.test.js`.

**Orkestratorn** `computeLikvardighetPairs({ data, statistik, nationellKlass, opts })` i lib kör stegen i ordning:
`aggregeraOrgKvDom` (steg 1, och organisationens jämförelseyrken), `klassificeraStatistik` (jämförelsestatistikens
jämförelseyrken), filtret för jämförelsemängden (avsnitt 4), `byggPar` eller `byggParPoäng` (steg 3) och
`byggParLagreKrav` (avsnitt 6). Den returnerar `orgKvDom`, `orgIckeKv`, `statIckeKv`, `pairs`, `parAntal`,
`lagreKrav`, `diagnostik` och `opts`.

**Adaptern** `computeLikvardighetPairs()` i appen läser `state.likvardighet`, `state.data`, `state.statistik` och
`state.arbetsvardering`, anropar spegeln (`_lvComputePairs`) med `nationellAidKlass` som reserv för kvinnoandel och
`kInstalld()` som `k`, och fyller på med diagnostik som bara gränssnittet behöver (exempelrader, om statistiken har
egen könsfördelning). Kastar spegeln returneras ändå ett strukturerat resultat, med tomma listor och felet i
`diagnostik.fel`, så att fliken kan visa vad som gick fel. `likvardighetResultat()` sparar resultatet i
`state.likvardighet.result`; allt som bara läser paren går via den, och varje ändring av data eller inställningar
nollställer resultatet.

## 2. En definition av kvinnodominerat

**Definitionen.** `arKvinnodominerad(pct, definition, grans)` och `konsklass(pct, definition, grans)` i
`src/lib/likvardighet.js` är den enda definitionen i verktyget (ADR-60). `pct` är andelen kvinnor i procent.

- *Mer än X %* (nyckeln `'do'`): kvinnodominerat när andelen är **mer än** gränsen.
- *X % eller mer* (nyckeln `'scb'`): kvinnodominerat när andelen är gränsen **eller mer**.
- **Mansdominerat** speglas: samma prövning på andelen män (100 − `pct`). Vid gränsen 60 är en grupp med *Mer än*
  mansdominerad under 40 % kvinnor, med *eller mer* vid 40 % eller mindre.

Valen heter efter lydelsen, inte efter en avsändare (ADR-72): namnen och texterna står i `KV_DEFINITIONER` i
`src/lib/aidbas.js` (`kvDefinitionNamn`, `kvDefinitionText`), och källan för båda lydelserna står i `lagrum.md`. Nycklarna
`'do'` och `'scb'` är historiska och står kvar, så att sparade konfigurationsfiler fortsätter att läsas.
- **Övriga** är blandade. `konsklass` ger `'kvinnodominerad'`, `'mansdominerad'`, `'blandad'`, eller `''` när
  andelen är okänd; `arKvinnodominerad` ger `false` för en okänd andel.

**Gränsen** är kvinnotröskeln, standard 60 % (`KVINNO_TROSKEL_DEFAULT`; beslut 2026-10-19, källan i `lagrum.md`). Konstanterna `ICKE_KV_TAK` (40) och `KV_DOM_STAT` (60) står kvar i modulen; `ICKE_KV_TAK` är klassens
gräns för män med *Mer än* och standardgränsen, inte ett urval, och `KV_DOM_STAT` är bara standardvärdet i
`klassificeraStatistik` när den anropas utan gräns.

**Valet** görs i Likvärdigt arbetes inställningar och gäller hela verktyget: kvinnotröskeln
(`state.likvardighet.kvinnoTrosholdPct`) och definitionen (`state.likvardighet.kvDomDefinition`, standard `'do'`).
I appen läses de genom `aidbasDefinition()` och `aidbasGrans()`, och `kvDomNu(pct)` och `konsklassNu(pct)` i
`45-aid-bas-tabeller.js` anropar definitionen med dem. Texterna säger gränsen med valets lydelse, *mer än 60 %
kvinnor* eller *60 % kvinnor eller mer*: i appen `kvDomGransText()` och i rapportunderlaget `avsnittBlock`, båda med
`kvDefinitionText`.

**Jämn könsfördelning är något annat.** Lönestrukturs tabell över könsfördelningen per BAS-intervall, rutan *Ojämn
könsfördelning* på Översikt och måttet på statistisk styrka räknar en grupp som jämn när båda könen är minst 40 %.
Den gränsen är fast och följer varken kvinnotröskeln eller valet; en grupp med exakt 60 % kvinnor är jämn där, men
kvinnodominerad med *X % eller mer* vid gränsen 60. Ordlistan (*Jämn könsfördelning*) säger det.

**Var definitionen används:**

- I modellen: `aggregeraOrgKvDom` och `klassificeraStatistik`, som följer kvinnotröskeln (orkestratorn skickar
  den som gräns) i stället för fasta 60 %.
- `dominans` i `src/lib/aidbas.js` (tabellerna per AID-kod och BAS-intervall, ADR-57, och Lika arbetes kolumn
  Dominans genom spegeln `_aidbasDominans`), med `arJamforelseKlass` för jämförelsemängden (avsnitt 4).
- `forecastOutcome` i `src/lib/loneoversyn.js`: Löneöversynens *Varav till kvinnodominerade grupper*.
- I appen genom `kvDomNu`/`konsklassNu`: Löneöversynens massregel (`36-loneoversyn.js`), diagrammet Krav mot lön
  (`34-likvardigt-arbete.js`), Lönepolitikens diagram (`75-lonepolitik.js`) och uppslaget i den nationella statistiken
  (`nationellAidKlass`, avsnitt 4; likvärdighetsanalysen läser bara andelen därifrån).
- Prioriteringen klassar inga grupper efter könsdominans (dess jämställdhetsmått bygger på gapet) och berörs inte.

## 3. Steg 1: de kvinnodominerade grupperna

`aggregeraOrgKvDom(data, kvinnoThr, K, definition)` grupperar organisationens rader per AID × BAS (nyckeln
`aid|bas`). Rader utan AID, utan BAS eller utan lön över 0 räknas inte. Varje grupp får antal, antal kvinnor
(`kon` som innehåller `kvinna`), andel kvinnor, klass, medianlön, lönerna och åldrarna (parallellt med lönerna, `null`
när åldern saknas; de används av åldersjusteringen i avsnitt 5). Namnet är `yrkeLabel`, annars `yrke`, annars AID.

Grupper med klassen `'kvinnodominerad'` blir **`orgKvDom`**, analysens subjekt; **alla övriga** blir `orgIckeKv`,
organisationens jämförelseyrken (avsnitt 4). Båda sorteras efter antal, störst först.

**Minsta gruppstorlek tillämpas inte i steget:** också små kvinnodominerade grupper ingår, eftersom lagen kräver att
även de prövas. `K` (adaptern skickar `kInstalld()`) används bara för att räkna dem i diagnostiken
(`kvDomMedNLessThanK`), som fliken visar. Undantaget och vad det innebär för fliken och dess export står i
`k-troskeln.md` §4.

## 4. Steg 2: jämförelseyrkena

**Jämförelsemängden** är alla grupper som **inte är kvinnodominerade** enligt vald definition (ADR-60):
mansdominerade och blandade. Med *Mer än* och gränsen 60 betyder det högst 60 % kvinnor, med *eller mer* under 60 %. Klassen och
könsandelen står på varje par (`maKlass`, `maKvinnoPct`; `maKvAndel` bär samma andel), för interna och externa
jämförelseyrken. Tolkningen att jämförelsemängden är alla som inte är kvinnodominerade är ett förslag, inte prövat av
jurist; lagens regler om kvinnodominerat arbete beskrivs i `lagrum.md`.

**Filtret** `jamforelse: 'alla' | 'mansdominerade'` (`state.likvardighet.jamforelse`, standard `'alla'`, rutan
*Jämför bara med mansdominerade yrken* i Inställningar) begränsar mängden till de mansdominerade
(`state.likvardighet.jamforelse = 'mansdominerade'`). Det tillämpas i orkestratorn **innan** paren byggs, på
organisationens yrken, på statistikens yrken och per BAS-intervall i statistiken (ett intervall utan mansdominerade
rader tas bort), så att reserven till jämförelsestatistiken per BAS fungerar som utan filter. Med filtret på återskapas
urvalet före ADR-60.

**Samma mängd** används i kandidatparen, *Lägre krav, högre lön*, *Hierarkisk jämförelse* och sammanfattningen per
BAS-intervall i tabellerna per AID-kod och BAS-intervall (`arJamforelseKlass` i `src/lib/aidbas.js`).

**Organisationens jämförelseyrken** är `orgIckeKv` ur steg 1, grupperade per BAS av `orgIckeKvByBas`.

**Jämförelsestatistikens jämförelseyrken.** `klassificeraStatistik(statistik, nationellKlass, { definition, grans })`
tar rader med AID, BAS och median över 0; en rad vars AID inte bara är siffror är en rubrik för en yrkesfamilj och
hoppas över. Andelen kvinnor tas i första hand ur statistikens egen könsfördelning (`andelKv` mellan 0 och 100,
källan `'lokal'`), annars ur reserven `nationellKlass` (källan `'nationell'`); ger ingen av dem en andel räknas raden som
oklassificerad. Kvinnodominerade rader hoppas över; övriga blir kandidater med klass och källa, grupperade per BAS
(`statByBas`) och sorterade efter andel kvinnor. Diagnostiken räknar `klass.kvDom`, `klass.ickeKv`, `klass.blandat`
(hur många av kandidaterna som är blandade) och `klass.oklassificerad`, och `klassKalla` hur många andelar som kom
ur statistiken respektive reserven (`lokal` och `nationell`). Paret bär källan i
`maKlassKort`: `'intern'`, `'lokal'` eller `'nationell'`. Namnen säger källan, inte en avsändare: reserven är SKR:s
personalstatistik, inte SCB, och syns för användaren som *nationell statistik (SKR)*.

**Reserven för kvinnoandel** är den nationella personalstatistiken (ADR-34). Adaptern skickar `nationellAidKlass`:
en sexsiffrig AID-kod slås upp med `skrKvinnoandel` i `src/lib/skrreferens.js` — etiketten och sedan prefixet (tre
första siffrorna) i den del som organisationstypen väljer (kommuner, regioner eller båda, `_skrDel()`), och sist
etiketten och prefixet i båda delarna — och en kod med tre siffror som prefix. Andelen avrundas till en decimal.

**BAS-läget** (standard, när lönefilen saknar poäng): `byggPar` jämför **inom samma BAS-intervall**. För varje
kvinnodominerat yrke används i första hand organisationens **egna** jämförelseyrken i intervallet (`jamforKalla`
`'intern'`). Saknas sådana i intervallet används **jämförelsestatistiken** som reserv (`'extern'`), och diagnostiken
räknar det i `basMedExternFallback`. Saknas båda bildas inga par för yrket.

**Poängläget.** Har lönefilen kolumnen Poäng bygger `_deriveArbetsvarderingFromData` en tabell `aid|bas` → poäng
(det första värdet per grupp) i `state.arbetsvardering.byKey`, och `byggParPoäng` ersätter `byggPar`. Ett
jämförelseyrke kvalificerar när dess poäng är högst det kvinnodominerade yrkets poäng × (1 + band / 100) — lika eller
lägre krav — **även över BAS-gränserna**. Bandet är standard 5 % (`state.likvardighet.poangBandPct`, fältet *Räkna som
lika krav inom ± … %* i avsnittet *Arbetsvärdering med poäng*, 0–50). Organisationens egna jämförelseyrken används i
första hand; finns inget som kvalificerar används statistikens rader som har poäng i samma tabell. Ett kvinnodominerat
yrke utan poäng får inga par och räknas i `kvUtanPoang`, som fliken visar. Diagnostikens `kravProxy` är `'poäng'`
eller `'bas'`.

## 5. Steg 3: paren

**Ett par** bildas när jämförelseyrkets median är **högre** än det kvinnodominerade yrkets och skillnaden i procent av
det kvinnodominerade yrkets median, `gapPct` = (median jämf. − median kv) / median kv · 100, är minst minsta skillnaden.
Par där jämförelseyrket ligger lika eller lägre räknas i diagnostiken (`statLägreEllerLika`) men visas inte. Varje par
får skillnaden i kronor (`gapKr`) och procent, och `allvarsindex` = |`gapKr`| · antalet i det kvinnodominerade yrket
(kolumnen *Summa för gruppen (kr/mån)*). Paren sorteras efter `gapPct`, störst först.

**Minsta skillnad och antal par** (ADR-61):

| Värde | I verktyget (`state.likvardighet`) | Fältet i fliken | Modulens eget standardvärde |
|---|---|---|---|
| `minGapPct` | **0 %**: alla par där jämförelseyrket har högre lön | *Visa bara par med minst … % skillnad (0 = alla)*, 0–50 | 0 |
| `topN` | **20 par** | *Visa max: … par*, 10–500 | 100 |

Med `state.likvardighet.minGapPct` 0 visas alla par där jämförelseyrket har högre lön, och 5 % är ett valbart filter i
fältet för minsta skillnad. Tabellen visar de `topN` största; finns fler står raden *Tabellen visar de N största
skillnaderna av M par* och knappen *Visa alla M par*, som sätter `topN` till antalet par (minst 10). Modulens egna
standardvärden, 0 % och 100 par, gäller bara när den anropas utan inställningar, som i enhetstesterna; adaptern faller
också tillbaka på 100 om `topN` saknas i tillståndet. Allt som läser paren utanför fliken läser samma urval (`pairs`).

**Före urvalet räknas** i `byggPar` och `byggParPoäng` (`parAntal`, `_parAntal` i lib): `totalt` (alla par som klarat
minsta skillnaden), `overDirektiv` (par där det kvinnodominerade yrkets median i procent av jämförelseyrkets får
direktivmarkeringen, `direktivMarkering` ur `src/lib/status.js`, det vill säga en ojusterad löneskillnad på minst 5 %)
och `sakra` (par vars hela konfidensintervall ligger över 0). Nyckeltalet *Par att titta närmare på* visar `totalt` med
*varav M med ojusterad löneskillnad ≥ 5 %, S med säker skillnad*, så att direktivnivån syns utan att paren under den
döljs. Rutan *Största skillnaden* visar det kvinnodominerade yrkets median i procent av jämförelseyrkets.

**Konfidensintervallet** är ett bootstrap-intervall på medianskillnaden i kronor, 1 000 omdragningar, percentilerna
2,5 och 97,5 (95 %).

- Interna par (`bootstrapMedianDiffKr`): båda gruppernas löner dras om. Kräver minst 3 löner på varje sida, annars
  `null`.
- Externa par (`bootstrapMedianVsConstantKr`): det kvinnodominerade yrkets löner dras om mot statistikens median som
  konstant, eftersom statistiken saknar individdata. Kräver minst 3 löner och en median över 0.
- **Reproducerbart:** utan en injicerad slumpgenerator seedas bootstrappen per par ur parets egna löner (`rngFor` ur
  `src/lib/rng.js`; för externa par lönerna och statistikens median). Två körningar på samma underlag ger samma
  intervall, så att ett exporterat underlag går att återskapa. Orkestratorn skickar `opts.rng` vidare orört; bara
  testerna injicerar en egen.
- Fliken visar intervallet med märket *säker skillnad* (hela intervallet över 0) eller *inom slumpfel*, och ett streck
  när intervallet saknas.

**Huvudmåttet** är den råa medianskillnaden: lagen prövar lönenivån som sådan.

**Den åldersjusterade skillnaden** (`aldersjusteradSkillnad`) räknas bara för interna par. I jämförelseyrket skattas
log(lön) = a + b · ålder med OLS. Kraven är minst 10 personer med ålder (`ALDERS_GOLV_DEFAULT`, opts `aldersGolv`) och
minst 5 års åldersspridning (`ALDERS_SPRIDNING_MIN`), och att det kvinnodominerade yrket har någon med ålder; annars
`null`. Lönen prediceras vid varje person i det kvinnodominerade yrket med dennes ålder, och medianen av prediktionerna
är den åldersjusterade jämförelsemedianen (`medianJusterad`). Skillnaden räknas i kronor och procent mot det
kvinnodominerade yrkets **råa** median, så att den är jämförbar med parets råa skillnad. Den visar hur mycket av
skillnaden som kan bero på åldersstruktur. Paret bär också medelåldern per sida (`kvMedelAlder`, `maMedelAlder`;
`maMedelAlder` bara för interna par). Externa par får `null`: jämförelsestatistiken saknar individdata. Ett par utan
justerad skillnad finns kvar.

Den justerade skillnaden står i flikens kolumn *Justerad för ålder* (verktygstipset säger varför den saknas),
bevis-popupen (med medelålder per sida), flikens CSV- och Excel-export (med en metodrad) och rapportunderlagets
parblock. Utanför fliken lyder den samma regel som paret (`k-troskeln.md` §2). Kraven 10 och 5 speglas i adaptern
(`ALDERS_GOLV`, `ALDERS_SPRIDNING`) för texterna.

## 6. Lägre krav, högre lön

Med BAS som mått på kraven bildas kandidatparen bara inom samma BAS-intervall. Listan *Lägre krav, högre lön*
(`byggParLagreKrav`, ADR-25) tar med de par där ett kvinnodominerat yrke har **lägre medianlön** än ett av
**organisationens egna** jämförelseyrken (samma mängd som kandidatparen, avsnitt 4) i ett **strikt lägre**
BAS-intervall.

- **Bara organisationens egna yrken**, ingen reserv ur jämförelsestatistiken.
- **Alla lägre BAS-intervall** ingår; varje par bär antalet BAS-steg (`basSteg`, rangskillnaden).
- Samma `minGapPct` och `topN` som kandidatparen, och samma bootstrapintervall för interna par, seedat per par.
  Intervallen räknas bara för de par som behålls; sorteringen beror inte på dem, så resultatet blir detsamma.
- Sortering: störst skillnad i procent först, vid lika fler BAS-steg först.
- Paren bär kandidatparens fält för yrkena, medianerna, klassen, könsandelen och skillnaden, men inga åldersfält, och
  `jamforKalla` är `'intern'`.
- **Poängläget räknar inte listan** (`lagreKrav` är tom): där jämför kandidatparen redan över BAS-gränserna, och
  fliken säger det.

**BAS-rangen.** `basRangFn(allaBas)` ger bokstavens plats i alfabetet: A = 1, B = 2 och så vidare genom hela
alfabetet, så att alla BAS-intervall ingår (ADR-21). Ett BAS-värde som inte är en enda bokstav läggs efter bokstäverna,
i alfabetisk ordning sinsemellan. Ordningen är fast och går inte att ändra i verktyget: ingen panel, inget tillstånd och
inget fält i konfigurationsfilen; ett `basRang` i anropet ignoreras.

**Antagandet** bakom rangen är att varje bokstav motsvarar ett lika brett poängintervall i arbetsvärderingen, så att
ett BAS-steg alltid är ett intervall: B → D är två steg även när C saknas i underlaget. Listan vilar helt på att
BAS-ordningen speglar kraven, och fliken och rapportunderlaget säger att BAS är ett grovt mått som bör prövas mot
befattningsbeskrivningarna. Regressionerna räknar inte BAS som ett tal; var rangen i övrigt används står i
`regressionsmodellen.md` §3.

## 7. Var resultatet visas och vad som följer med ut

**Fliken Likvärdigt arbete** visar överst nyckeltalen (kvinnodominerade yrken, jämförelseyrken, par att titta närmare
på, största skillnaden) och diagrammet *Krav mot lön* (en punkt per yrkesgrupp som når `kTroskel()`, krav mot medianlön,
form och färg efter `konsklassNu`; med poäng placeras en grupp utan poäng efter sitt BAS-intervall). Avsnittet *Par att
titta närmare på* har kandidatparen som bild (de 14 paren med störst `allvarsindex`), partabellen (jämförelseyrkets
andel kvinnor och klass i kolumnen *Könsandel*) med bevis-popup och listan *Lägre krav, högre lön*. Avsnittet *Yrkena
bakom jämförelsen* visar Steg 1, Steg 2a (organisationens jämförelseyrken) och Steg 2b (statistikens), med klass och den
nationella andelen kvinnor som referensvärde. Därtill inställningarna (avsnitt 8), metoden och diagnostiken.

**Flikens export** är CSV och Excel med metodblad (`exportLikvardighetCSV`, `exportLikvardighet`), med bland annat
kolumnerna *Jämf. % kvinnor* och *Jämf. klass*, den justerade skillnaden och inställningarna i metadata. Fliken och
dess export är undantagna från tröskeln och märks med undantaget (`k-troskeln.md` §4).

**Utanför fliken** redovisas ett par bara när båda grupperna når tröskeln, med antalet utelämnade angivet
(`_parForRedovisning`; listan över utdata står i `k-troskeln.md` §2). Det gäller också *Lägre krav*.

- **Rapportunderlaget** har blocket *Likvärdigt arbete* (med definitionen, jämförelsemängden och könsandelen i
  jämförelseyrket; metodtexten säger att yrkena jämförs med yrken på samma nivå som inte är kvinnodominerade och att
  könsandelen står i tabellen), ett block per kandidatpar (faktastycke, tabell, den justerade skillnaden och frågor till
  verksamheten) och blocket *Lägre krav, högre lön* efter Likvärdigt arbete, med BAS-steg och frågorna.
- **Rapporten** (Word-utkastet och PDF-rapporten) tar paren med könsandelen i jämförelseyrket, och JPA-protokollet
  med andel och klass (*Jämf. klass*).
- **Att göra** tar upp till 20 par, med jämförelseyrkets andel kvinnor och klass i titeln; processöversiktens steg 4
  följer dem (ADR-29).
- Översikten, Lönestruktur, handlingsplanen, gruppdossiern, BAS-dossiern (också *Lägre krav*), Löneöversyn, årsbokslutet
  och robusthetspanelen i Exportera (`robusthetLikvardighet`, som kör om analysen med kvinnotrösklarna 55, 60 och 65 och
  återställer tillståndet) läser samma par.

## 8. Inställningar och vad som sparas

**`state.likvardighet`** (`12-tillstand.js`):

| Fält | Standard | Vad |
|---|---|---|
| `kvinnoTrosholdPct` | 60 | Kvinnotröskeln i procent; fältet *Kvinnotröskel*, 50–70 i steg om 5 |
| `kvDomDefinition` | `'do'` | Definitionen av kvinnodominerat, `'do'` (*Mer än X %*) eller `'scb'` (*X % eller mer*); gäller hela verktyget (avsnitt 2) |
| `jamforelse` | `'alla'` | Jämförelsemängden, `'alla'` eller `'mansdominerade'` (avsnitt 4) |
| `minGapPct` | 0 | Minsta skillnad i procent (avsnitt 5) |
| `topN` | 20 | Högst så många par i resultatet (avsnitt 5) |
| `poangBandPct` | 5 | Bandet i poängläget (avsnitt 4) |
| `source` | `'organisation'` | Bärs och valideras i konfigurationsfilen; analysen läser det inte |
| `result` | `null` | Det senaste resultatet; nollställs när data eller inställningar ändras och av *Rensa all data* |

Avsnittet *Inställningar* i fliken säger *Standardvärden* eller *Anpassade värden* efter kvinnotröskeln, minsta
skillnaden, antalet par, definitionen och jämförelsemängden.

**Konfigurationsfilen** bär `likvardighet` med `source`, `kvinnoTrosholdPct`, `kvDomDefinition`, `jamforelse`,
`minGapPct` och `topN`. Vid inläsning prövas att talen är tal (inte att de ligger inom fältens gränser), att
`likvardighet.kvDomDefinition` är `do` eller `scb`, att `likvardighet.jamforelse` är `alla` eller `mansdominerade` och
att `source` är `organisation` eller `statistik`; ett ogiltigt värde avvisar filen. Värdena läggs över tillståndet och
resultatet nollställs. Bandet för poäng bärs inte.

**Organisationspaketet** bär bara jämförelsemängden (`installningar.jamforelse`, prövad som i konfigurationsfilen). Det
bär inte minsta skillnaden (ADR-61), antalet par, kvinnotröskeln eller definitionen.

## 9. Vakter

| Fil | Prövar |
|---|---|
| `tests/likvardighet.test.js` | Modulen direkt: klassningen i steg 1 och 2 med båda definitionerna vid gränsen, reserven för kvinnoandel, parbygget (intern före extern, reserven per BAS, minsta skillnad, sortering och `topN`, `parAntal` före urvalet, `allvarsindex`, intervallen), orkestratorn, bootstrappen, poängläget, *Lägre krav* (BAS-ordningen fast, sorteringen, tom i poängläget, intervallen bara för paren som behålls), `basRangFn`, åldersjusteringen, den enda definitionen (också `dominans`) och jämförelsemängden med filtret |
| `tests/drift.test.js` | Att adaptern delegerar till spegeln och översätter tillståndet till anropet, att den ger ett strukturerat resultat när spegeln kastar, och att spegeln ger reproducerbara konfidensintervall |
| `tests/aidbas.test.js`, `tests/smoke-aidbas.test.js` | Definitionen och jämförelsemängden i tabellerna per AID-kod och BAS-intervall; definitionen och jämförelsemängden i konfigurationsfilen; att definitionernas namn säger lydelsen och inte en avsändare (ADR-72) |
| `tests/smoke-vyer.test.js` | Demot: ett par där båda grupperna når tröskeln, Systemutvecklare (blandad) som jämförelseyrke i BAS C, standardvärdet 0 % och filtret 5 %, filtret *bara mansdominerade*, nyckeltalet och *Visa alla*, rapportunderlagets parblock |
| `tests/granssnitt-vyer.test.js` | Partabellens intervall och märke, kolumnerna, att ett par under 5 % syns utan att något ändrats och fältets text, och att Översiktens tal är flikens |
| `tests/smoke-organisation.test.js` | Organisationspaketets jämförelsemängd, poängläget i fliken och att resultatet nollställs |
| `tests/organisationspaket.test.js` | Fältet `installningar.jamforelse` i paketet |
| `tests/smoke-innehall.test.js` | Att BAS-ordningen inte har panel, tillstånd eller fält i konfigurationsfilen, och att robusthetspanelen prövar Likvärdigt arbete |
| `tests/rapportunderlag.test.js`, `tests/kanonymitet.test.js` | Blocket *Lägre krav* och tröskeln för paren och listan utanför fliken (`k-troskeln.md` §9) |
| `tests/skrreferens.test.js` | Uppslaget i den nationella statistiken |
