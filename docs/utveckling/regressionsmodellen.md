# Regressionsmodellen — referens

Regressionen ger huvudtalet *oförklarad löneskillnad*: skillnaden mellan kvinnors och mäns lön när det som
förklaringsmodellen räknar bort är borträknat. Runt den finns den stegvisa uppdelningen, Blinder-Oaxaca,
kvantilregressionen och regressionerna per BAS-intervall, och bredvid den uppdelningen *Var uppstår
löneskillnaden?*. Det här dokumentet bär den **gällande lydelsen** för dem: vad som skattas, hur BAS kodas, vad som
redovisas, hur konfidensintervall och p-värden räknas, vad som händer utan ålder och vilka referensvärden som vaktar
siffrorna. Koden är sanningen; där dokumentet och koden skiljer sig är det dokumentet som ska rättas.

Dokumentet är inte beslutsloggen och inte en metodlära. Varför det är så här, vad som övervägdes och när det
beslutades står i besluten i [`arkitekturbeslut.md`](arkitekturbeslut.md): ADR-22, 44, 45, 46, 53, 56, 63, 64 och 65.
Att regressionen aldrig cachas står i ADR-17. Minsta gruppstorlek och golven står i [`k-troskeln.md`](k-troskeln.md)
och upprepas inte här (avsnitt 9).

| Del | Fil |
|---|---|
| Modellerna: förklaringsmodellen, stegen, yrkesgrupp inom BAS, Blinder-Oaxaca, kvantilregressionen, gap per BAS | `src/lib/regression.js` |
| OLS med HC3, t-fördelningen och normalfördelningen | `src/lib/stat.js` |
| Adaptern som läser appens tillstånd (`getData()`, `statGolv()`, förklaringsmodellen, `harAlder()`) | `src/app/50-regressionsmodeller.js` |
| Huvudregressionen, modellpanelen, regressionskortet, kvantilregressionens intervall, BH-korrigeringen | `src/app/51-lika-arbete-regressionskort.js` |
| Noteringen om en bortvald variabel | `src/lib/rapportunderlag.js` (`bortvaltNotering`) |
| Var uppstår löneskillnaden? | `src/lib/gapuppdelning.js`, `src/app/68-var-uppstar-gapet.js` |
| Vakterna | avsnitt 11 |

## 1. Huvudmodellen och huvudtalet

**Raderna.** `runOLSRegression` (`51-lika-arbete-regressionskort.js`) räknar på `getData()` och tar med rader med lön
över 0, kön kvinna eller man och, när lönefilen har ålder, en ålder över 0. Med färre än 30 sådana rader skattas
ingen modell (`low_n`), och med färre än 5 av något kön inte heller (`imbalance`).

**Modellen** är OLS på log-lön: ln(lön) = β0 + β1 · kvinna + [β2 · (ålder − medelålder)] + [en indikator per
BAS-intervall utom referensen], där hakparenteserna är med enligt förklaringsmodellen (avsnitt 2) och BAS kodas som i
avsnitt 3. Kolumnordningen är fast, [1, kön, (ålder), (BAS-indikatorer)], så att ålder alltid står på plats 2 när den
är med. Är yrkesgrupp inom BAS vald skattas modellen med inomtransformation i stället (avsnitt 4).

**Huvudtalet** är könskoefficienten som procent, `konPct` = (exp(β1) − 1) · 100. Tecknet är kvinnor mot män: negativt
när kvinnor ligger lägre. `konKvot` = 100 + `konPct` är samma skattning som kvinnors lön i procent av mäns, måttet i
flikarnas nyckeltalsrader. Med standardmodellen är huvudtalet steget *+ Ålder* (kön, ålder och BAS); med yrkesgrupp
vald är det steget *+ Yrkesgrupp*. Huvudtalet är detsamma i regressionskortet, Word-utkastet, PDF-rapporten och
överallt där det används (avsnitt 2).

**Standardfel** är HC3-robusta (`vcovHC3` ur `fitOLS`, Long & Ervin 2000). Kortet redovisar också intervallet med
klassiska standardfel (`konPctLowClassical`, `konPctHighClassical`). p-värdet och konfidensintervallet räknas som i
avsnitt 7. Ålderns effekt redovisas som procent per år (`ageEffect`, `ageP`) när ålder är med. `hHoga` är antalet
observationer med hävstång över 0,99; de bidrar inte till HC3 och antalet står i kortets tekniska specifikation.

**Den råa skillnaden** bredvid (`rawGapPct`) är mediankvoten, (median kvinnor / median män − 1) · 100, inte en
regression. **Den förklarade andelen** (`explainedShare`) är (|första steget| − |sista steget|) / |första steget| · 100
över stegen till och med modellens sista (avsnitt 4), när minst två steg kunde skattas och det första är större än
0,1 i absolutbelopp.

**Reservstegen.** Kan den valda modellen inte skattas — för få rader (färre än kolumnerna + 5) eller singulär design
(`fitOLS` ger null) — prövas nästa steg: först utan yrkesgrupp, sedan utan BAS. Inget bortvalt läggs tillbaka, så med
standardmodellen är reserven kön + ålder och med bara BAS vald är den endast kön. `modellVald` är den valda modellen,
`modell` den som skattades. När reserven används (`fellBackFromFull`) säger panelen och kortet det, med orsakerna ur
`diagnoseCollinearity`: helt enkönade BAS-intervall (med minst 3 personer), färre än två BAS-intervall och under 50
personer. Kan inget steg skattas blir resultatet felet `all_failed`.

**Ingen cache.** Regressionen räknas om vid varje anrop och får aldrig cachas (ADR-17, regel R9 i `regler.md`).

## 2. Förklaringsmodellen

**Värdet** är `{ bas, alder, yrkesgrupp, skal }`. Standard är `FORKLARINGSMODELL_STANDARD`: BAS-intervall och ålder,
utan yrkesgrupp, inget skäl. I tillståndet står valet i `state.forklaringsmodell`, där null är standard.
`normaliseraForklaringsmodell(v, { harYrke, harAlder })` gör ett värde giltigt: ett värde som inte är ett objekt ger
standard med en varning; yrkesgrupp kan bara väljas när lönefilen har AID eller yrke; yrkesgrupp förutsätter BAS, som
då väljs; ålder kan inte väljas utan ålder i lönefilen (avsnitt 8); skälet kortas till 300 tecken. Varje ändring ger
en varning, aldrig ett fel. I appen ger `forklaringsmodell()` valet normaliserat mot det inlästa underlaget.

**Variablerna som kan väljas** är BAS-intervall, ålder och yrkesgrupp inom BAS, utöver kön. Fullmodellen, BAS och
ålder utan yrkesgrupp, är utgångsläget, och standardhuvudtalet är dess.

**Panelen** (`renderForklaringsmodellPanel`, före huvudtalet) har kryssrutorna *Kön +* BAS-intervall, Ålder och
Yrkesgrupp inom BAS. Att kryssa i yrkesgrupp kryssar i BAS och låser den rutan; att kryssa ur BAS kryssar ur
yrkesgrupp. Utan ålder i lönefilen är rutan för ålder avstängd med tipset *Kräver ålder i lönefilen*; utan AID och
yrke finns ingen ruta för yrkesgrupp, bara en mening om varför. Under rutorna står tabellen över vad varje variabel
tillför, förslaget, fältet *Skäl utanför siffrorna* och noteringen om det bortvalda.

**Vad varje variabel tillför** (`computeVariabelTillfor` i `src/lib/regression.js`) räknas alltid mot fullmodellen
kön + BAS + ålder, oberoende av valet, så att tabellen står still när man kryssar. Utan ålder i lönefilen är
fullmodellen kön + BAS och ålder får ingen rad. För BAS och ålder är tillskottet ΔR² = R²(full) − R²(full utan
variabeln), i procentenheter, och kolumnen *Flyttar skillnaden* visar gapet utan variabeln och med den. Yrkesgrupp mäts
ovanpå fullmodellen (steget *+ Yrkesgrupp*, avsnitt 4) och får en rad bara när lönefilen har AID eller yrke. En rad
som inte kunde skattas visar *Gick inte att pröva*.

**Gränsen** är `TILLFOR_GRANS_PP` = **0,5 procentenheter** i förklaringsgrad (`tillforGransPp()` i appen): under den
räknas en variabel som *tillför lite* (`tillforLite`). Bedömningen i tabellen är *Behövs* eller *Tillför lite*, för
yrkesgrupp med tillägget *(ingår inte i standard)*. Förslaget (`forslag.tabort`) är att lämna de variabler utanför som
tillför lite; bara BAS och ålder föreslås bort, aldrig yrkesgrupp, som är en tilläggsvariabel. Panelen visar förslaget
för de variabler som fortfarande är valda, med knapparna *Ta bort …* och *Behåll*. **Förslaget är ett pedagogiskt råd
om vad som är värt att visa, inte ett statistiskt test**, och panelen säger det.

**Det bortvalda.** En bortvald variabel (BAS eller ålder) redovisas med en mening i stället för siffror,
`bortvaltNotering` i `src/lib/rapportunderlag.js`: "Ålder har kontrollerats och tillför 0,3 procentenheter i
förklaringsgrad; den ingår inte i siffrorna. Skäl: …" (eller *gick inte att pröva*). Underlaget är `bortvalt` i
regressionens resultat, med tillskottet, gapet utan och med, och skälet. Meningen står i panelen, i Blinder-Oaxaca-kortet,
i rapportunderlaget och i rapportens sammanfattning och bilaga.

**Skälet** är valfri fritext, högst 300 tecken, med samma personuppgiftsvakt som handlingsplanens fritext
(`_opLiknarPersonuppgift`): ett skäl som ser ut att innehålla ett personnummer eller en e-postadress sparas inte, och
panelen säger varför. Ett ändrat skäl ändrar inga tal.

**Frasen.** Texterna som förut sade en fast modell byggs ur valet. `modellFras(m)` ger frasen i löptext, "när …
räknats bort": "ålder och BAS-intervall" (standard), "BAS-intervall", "ålder", "BAS-intervall och yrkesgrupp", "ålder,
BAS-intervall och yrkesgrupp", och tom sträng för endast kön, då texterna säger "utan att något räknats bort".
`modellBeskrivning(m)` ger modellen i ord, "kön + ålder + BAS-intervall (indikatorer) + yrkesgrupp inom BAS (fasta
effekter)" med de delar som är valda; den är regressionens `modelDesc` och står i rapportens bilaga. Metodbilagan
(bladet *Metod & parametrar*, `_methodAppendixData` i `22-exporthjalpare.js`) bygger raden *Modell — oförklarad
skillnad* ur `modellBeskrivning(forklaringsmodell())`: med ålder i lönefilen och BAS som indikatorer står BAS som
"BAS-intervall (indikatorvariabler, första BAS som referens)", och med yrkesgrupp vald tillkommer "skattat med
inomtransformation". Standardmodellen ger samma rad som före valet.

**Var valet slår igenom.** `runOLSRegression` läser förklaringsmodellen, så Översikt, Att göra, Lönestruktur, Lika
arbetes nyckeltal, rapporten och rapportunderlaget visar samma huvudtal. Trappan, förklaringsbudgeten (avsnitt 4),
Blinder-Oaxaca (avsnitt 5) och kvantilregressionen (avsnitt 6, utan yrkesgrupp) räknar på samma modell. Valet slår inte
igenom i:

- **sektorsöversikten** i Lönestruktur (`src/lib/sektor.js`), som har en egen modell: kön + ålder + BAS-rang per sektor
  med minst 30 personer, med fast faktor 1,96 för intervallet;
- **regressionerna per BAS-intervall** (`computePerBasGap`), som skattar kön och, när lönefilen har ålder, ålder inom
  varje BAS-intervall;
- **livscykelmodellen** (`src/lib/livscykel.js`), som har sin egen modell i Ålder & karriär;
- **Var uppstår löneskillnaden?**, som har ett eget val av variabler (avsnitt 10).

**Lagras och nollställs.** `sattForklaringsmodell(v)` lagrar valet (standard som null) och ritar om allt på samma väg
som när tröskeln ändras. Det som lagras prövas inte mot åldern: en lönefil utan ålder ändrar inte valet för nästa fil.
Konfigurationsfilen bär valet och skälet (`forklaringsmodell`, null = standard); ett ogiltigt värde ger standard med
varning, aldrig fel, och en fil utan fältet ger standard. Läses filen in före lönefilen prövas yrkesgrupp mot datat
först när det finns. *Rensa all data* nollställer valet. Organisationspaketet bär det inte: valet är handläggarens.

**Spärren för *Endast kön*.** Endast kön (varken BAS eller ålder) är det ojusterade gapet och får inte vara huvudtalet
när ett kön har färre personer än den inställda tröskeln. Då räknar `runOLSRegression` på kön + BAS-intervall (+ ålder
när lönefilen har ålder), `modellVarning` säger varför, och panelen visar och lagrar den modell som gäller, så att
konfigurationsfilen inte bär ett val som inte kan användas. Varför spärren följer `kInstalld()` oavsett läge står i
`k-troskeln.md` §1.

## 3. Kodningen av BAS-intervall

**Indikatorer.** `basIndikatorer(basList)` ger en indikator per BAS-intervall utom det första i `basList`, som är
referens. `basList` är BAS-intervallen i modellens rader, sorterade i bokstavsordning, så **referensintervallet är det
alfabetiskt första i urvalet**. Varje intervall får sin egen lönenivå, utan antagandet att varje bokstavssteg är värt
lika mycket; bokstavsordningen avgör bara vilket intervall som är referens. Samma kodning används i huvudregressionen,
i stegen (`_sekvensRigg`), i tabellen över vad varje variabel tillför och i kvantilregressionen (`kvantilDesign`,
avsnitt 6). Blinder-Oaxaca kodar BAS på samma sätt men med en egen regel för referensen (avsnitt 5).

**Vad modellen redovisar.** `basEffekter` har en rad per indikator: lönenivån i procent mot referensintervallet,
(exp(β) − 1) · 100, med konfidensintervall (HC3, t-kvantil; avsnitt 7) och p-värde. `basRef` är referensintervallet och
`basList` hela listan. `basEffekter` är null när BAS inte är med i den skattade modellen (bortvald eller borttagen av
reservsteget) och när yrkesgrupp inom BAS är vald, eftersom BAS då ingår i gruppnivåerna. `basRef` är null när BAS inte
är med. Kortet visar referensintervallet och en rad per indikator, och rapportens bilaga nivåerna mot referensen.
`basN` är antalet personer per intervall i modellen. I det som lämnar verktyget redovisas bara effekterna för intervall
som når tröskeln; de övriga namnges i en not, och är referensintervallet under tröskeln redovisas ingen effekt
(`_basEffekterForRedovisning`, ADR-70; `k-troskeln.md` §2). Modellen skattas med alla intervall.

**Regressionerna per BAS-intervall** har BAS i urvalet, inte i modellen: en regression per intervall (avsnitt 7).

**BAS som rang.** Ingen modell i `src/lib/regression.js` räknar BAS som ett tal. BAS-rangen, bokstavens plats
(`basRangFn` i `src/lib/likvardighet.js`), används av *Lägre krav, högre lön* (`likvardighetsmodellen.md` §6), som
ordning i tabellerna per AID-kod och BAS-intervall (`src/lib/aidbas.js`) och som förklaringsvariabel i
sektorsöversiktens egen modell (`src/lib/sektor.js`, avsnitt 2).

## 4. Den stegvisa uppdelningen och steget *+ Yrkesgrupp*

**Stegen.** `computeSequentialGap(rows, ageMean, basList, { golv, modell })` i `src/lib/regression.js` (i appen genom
adaptern `_computeSequentialGap`) skattar könsgapet steg för steg. Raderna filtreras i `_sekvensRigg` som i avsnitt 1.
Stegen är:

1. *Endast kön*;
2. ett steg per vald variabel i ordningen BAS, ålder (*+ BAS-intervall*, *+ Ålder*), var och en ovanpå de föregående;
3. *+ Yrkesgrupp*, alltid när BAS är med i modellen, också när yrkesgrupp inte är vald;
4. *+ Ansvar*, när lönefilen har ansvarskod: en indikator per ansvarsgrupp (ledningsansvar, särskilt uppdrag) med minst
   `statGolv()` personer, ovanpå den valda modellen. Ansvaret redovisas på en egen rad och ingår aldrig i huvudtalet
   (ADR-33).

Varje OLS-steg ger gapet (exp(β1) − 1) · 100, R² och antalet kolumner; ett steg med färre rader än kolumnerna + 5 är
*för få*, och ett med singulär design *singulärt*. `runOLSRegression` kör stegen på den skattade modellen. Huvudtalet,
den förklarade andelen och förklaringsbudgeten räknas till och med modellens sista steg; *+ Yrkesgrupp* ingår bara när
yrkesgrupp är vald.

**Trappan och förklaringsbudgeten** visar stegen. Budgeten har en del per steg efter det första, |gap före| − |gap
efter|; ett steg som gör gapet större flaggas i stället för att ritas som en stapel, och en mening säger att det som
tillskrivs varje steg beror på ordningen. Hur det ojusterade steget redovisas när ett kön är under tröskeln står i
avsnitt 9.

**Steget *+ Yrkesgrupp*** (`computeYrkesgruppGap`) är könsgapet efter fasta effekter för yrkesgrupp inom BAS, utöver
ålder när ålder är vald. Gruppen är AID-koden, eller yrket när AID saknas, inom BAS-intervallet — samma nyckel som
likvärdighetsmotorn. Steget skattas med inomtransformation (`inomYrkesgrupp`): gruppmedelvärdet dras av från log-lön och
från kön och ålder inom varje grupp, och OLS körs utan intercept på de transformerade variablerna. Det ger samma
könskoefficient som en indikator per grupp (Frisch–Waugh–Lovell) utan en designmatris med hundratals kolumner. R²
räknas mot den otransformerade lönens totala variation, så att den är jämförbar med stegen före. Antalet parametrar är
lutningarna plus en nivå per grupp; med färre rader än grupperna + lutningarna + 5, eller utan någon grupp med båda
könen, är steget *för få*. Utan AID och yrke i lönefilen skattas det inte.

**Vilka grupper som bidrar.** Grupper med färre än `statGolv()` av något kön ingår i skattningen — gruppmedelvärdet är
ett mellanled, inte ett redovisat värde — men bara grupper med båda könen bidrar till könskoefficienten. Steget
redovisar hur många grupper och personer det bygger på (`nGrupper`, `nGrupperBada`, `nPersoner`) och hur många grupper
som är enkönade (`nEnkonade`).

**Vad som redovisas.** När yrkesgrupp inte är vald står steget i regressionskortet som en rad efter huvudtalet, med
meningen (`_yrkesStegText`) att det är löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall och,
när modellen har ålder, ålder, vad den bygger på och att huvudtalet inte räknar bort yrkesgruppen. I förklaringsbudgeten
är steget delen *Förklaras av yrkesgrupp inom BAS*, och i trappan ett ljusare steg som inte ingår i huvudtalet. I
rapportens bilaga är steget en rad i dekomponeringstabellen med samma mening efter tabellen, och metodbilagan har raden
*Steg + Yrkesgrupp (dekomponeringen)*: utöver ålder eller utan ålder efter modellen, och att steget visas som sista steg
och inte ingår i huvudtalet. Är BAS bortvalt räknas steget inte, och raden säger det.

**Yrkesgrupp vald in i huvudtalet.** Då skattas huvudregressionen med samma inomtransformation (`_regInomYrkesgrupp`)
på de transformerade kolumnerna [kön, (ålder)]. Kovarianserna, klassisk och HC3, skalas med (n − p) / (n − p − G), där p
är antalet lutningar och G antalet grupper, för gruppnivåernas frihetsgrader, och antalet parametrar k = p + G räknar
dem, så att t-kvantilen och p-värdet använder df = n − p − G. Resultatet får samma form som en vanlig skattning (kön på
plats 1, ålder på plats 2), R² räknas mot lönens totala variation och `hHoga` på den transformerade designen. Steget
*+ Yrkesgrupp* är då huvudtalet och står bland stegen; meningen under steget och metodbilagans rad säger att steget är
huvudtalet. Kan modellen inte skattas tar reservstegen bort yrkesgruppen först (avsnitt 1).

## 5. Blinder-Oaxaca

**Modellen.** `blinderOaxaca(rows, { golv, modell })` i `src/lib/regression.js` (i appen `runBlinderOaxaca()`, med
`statGolv()` och förklaringsmodellen) skattar två OLS, en för kvinnor och en för män, på [1, (ålder − medelålder),
indikatorer], med medelåldern räknad över båda könen. Variablerna är förklaringsmodellens: ålder när den är vald, en
indikator per BAS-intervall när BAS är vald, och med yrkesgrupp vald en indikator per yrkesgrupp inom BAS (samma
nyckel som i avsnitt 4) i stället för BAS-indikatorerna. Med endast kön finns inget att dela upp: funktionen ger null och
kortet visas inte. Uppdelningen kräver minst 50 personer i modellens rader och `statGolv()` av varje kön; annars säger
kortet att det är för få.

**Referensen** är det alfabetiskt första BAS-intervallet (eller den första yrkesgruppen inom BAS) som **finns hos båda
könen**, så att båda ekvationerna har ett intervall där alla indikatorer är noll. Huvudmodellen tar i stället det första
i urvalet (avsnitt 3). Kortet säger vilket intervall som är referens.

**Ett intervall som bara finns hos ett kön** får en indikator bara i det könets ekvation; den lämnas utanför det andra
könets skattning och får där β = 0. Dess bidrag hamnar därmed i samspelet, som räknas som oförklarat. Det är en
redovisningsregel, inte en skattning av vad intervallet "borde" betala det kön som saknas.

**Komponenterna.** Per kolumn är Q = (X̄_män − X̄_kvinnor) · β_kvinnor (skillnad i egenskaper, värderad med kvinnornas
lönesättning), U = X̄_kvinnor · (β_män − β_kvinnor) (skillnad i hur samma egenskaper betalas) och I = (X̄_män −
X̄_kvinnor) · (β_män − β_kvinnor) (samspel). Förklarat = Q, oförklarat = U + I, och Q + U + I är rågapet i log-lön.
Komponenterna redovisas per variabel som konstant, ålder och BAS, där BAS är summan över indikatorerna; med yrkesgrupp
vald heter raden *Yrkesgrupp inom BAS* och är summan över gruppindikatorerna. Resultatet bär `basRef` och
`basIndikatorer` med BAS-indikatorer, `gruppRef` och `gruppIndikatorer` med yrkesgrupp.

**Tecknet.** Funktionen räknar män mot kvinnor i log-rummet. Kortet visar talen kvinnor mot män, som resten av verktyget:
varje komponent c blir (exp(−c) − 1) · 100, och den förklarade och oförklarade andelen visas som positiva andelar av
gapet. En bortvald variabel nämns med noteringen ur avsnitt 2.

## 6. Kvantilregressionen

**Designen.** `kvantilDesign(rows, modell, { ageMean?, basList? })` i `src/lib/regression.js` bygger designen med
samma hjälpare som stegen (`_sekvensRigg`): intercept, kön, [ålder centrerad på radernas medel] och [en indikator per
BAS-intervall utom det första] enligt förklaringsmodellen, aldrig yrkesgrupp inom BAS. Raderna filtreras där: lön över
0, kön kvinna eller man, och ålder över 0 bara när ålder är med i modellen. `basList` och medelåldern räknas ur raderna
om de inte ges. Punktskattningen och bootstrappen räknar på exakt samma byggare.

**Skattningen.** `quantileRegressionAtAllTau(rows, { modell, ageMean?, basList? })` skattar vid **τ = 0,1, 0,5 och
0,9** (P10, medianen, P90) och ger `konPct` = (exp(β1) − 1) · 100 per τ och `diffP90P10` = `konPct`(0,9) − `konPct`(0,1)
i procentenheter; negativt betyder att skillnaden till kvinnornas nackdel är större i toppen än i botten. Med färre än
50 rader ger den null. `quantileRegression` är IRLS: start i OLS-lösningen (eller i ett givet startvärde, `start`),
högst 60 varv, tolerans 1e-5 och residualgolvet 1e-6; den ger null när n < k + 5 eller vägningsmatrisen är singulär.
Kärnan hoppar över nollor i designen, vilket ger samma summor men går snabbare med indikatorer. IRLS är en
approximation av kvantillösningen, inte den exakta minimeringen, och kortet säger det.

**Intervallen.** `_regKvantilBerakna` och `_regKvantilBootstrap` (`51-lika-arbete-regressionskort.js`) ger ett
percentil-bootstrap-intervall för `konPct` vid varje τ och för skillnaden P90 − P10: **B = 200** omsamplingar
(`REG_KVANTIL_KI_B`) av raderna med återläggning, seedade ur datat så att intervallet blir detsamma varje gång. Varje
omsampling bygger designen på nytt ur de dragna raderna, så att referensintervallet är det första som finns i
omsamplingen och ett intervall som inte kom med inte ger en nollkolumn; åldern centreras på hela urvalets medel, och
IRLS startar i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare. Gränserna är 2,5- och
97,5-percentilen av de lyckade omsamplingarna; lyckas färre än hälften ges inget intervall.

**Gränsen.** Med fler än **2 000 personer** (`REG_KVANTIL_KI_MAX_N`) räknas inget intervall, på grund av tiden, och
kortet säger det.

**I bakgrunden.** Intervallet räknas efter att kortet ritats (`setTimeout`): kortet står med punktskattningarna och
*räknas i bakgrunden…* och ritas om när intervallet finns, om det fortfarande visar samma underlag och inte är mitt i en
export. Det gäller också i exportläget, så en bild eller utskrift som görs innan intervallet är klart bär kortet utan
det. Intervallet minns per underlag (`_regKvantilMinne`, med en nyckel ur datat, kolumnerna och punktskattningarna);
punktskattningarna räknas om varje gång.

**Tolkningen** är villkorad på intervallet för P90 − P10:

| Intervallet för P90 − P10 | Kortet säger |
|---|---|
| Helt under noll | *Glastaket väger tyngre än det klibbiga golvet* |
| Helt över noll | *Det klibbiga golvet väger tyngre än glastaket* |
| Omsluter noll | *Ingen säkerställd skillnad mellan delarna av lönefördelningen.* |
| Räknas inte (över 2 000 personer) | Att det utan konfidensintervall inte går att säga om skillnaden skiljer sig mellan delarna |
| Räknas fortfarande | Ingen tolkning |

Skattningarna färgas inte efter storlek. Tabellen har en rad per τ och raden *P90 − P10*; diagrammet visar
skattningarna som avstånd från nollinjen med intervallet. Kortet visas när minst två kvantiler kunde skattas.

## 7. Konfidensintervall och p-värden

**t-kvantilen.** Konfidensintervallen i huvudregressionen (huvudtalet och `basEffekter`), regressionerna per
BAS-intervall och livscykelmodellen är exp(β ± t(0,975; n − k) · SE) − 1, i procent, med `tQuantile(p, df)` i
`src/lib/stat.js`. Funktionen inverterar `tDistCdf` med bisektion. Vid **df ≥ 100** används normalfördelningen (1,96),
samma gräns som `pValue2Sided`; vid färre frihetsgrader är intervallet bredare (df 5: 2,571; df 10: 2,228; df 26:
2,056; df 60: 2,000).

**p-värdet.** `pValue2Sided(stat, n, k)` är det tvåsidiga p-värdet med df = n − k: t-fördelningen vid df under 100,
normalfördelningen därifrån. Signifikansnivån är 0,05.

**t-fördelningen** (`tDistCdf`) är exakt, via den regulariserade ofullständiga betafunktionen: P(|T| > t) = I_x(df/2,
1/2) med x = df / (df + t²), räknad med kedjebråk och ln Γ enligt Lanczos. Över df 1 000 000 används
normalfördelningen. Normalfördelningens fördelningsfunktion (`normalCdf`) är approximationen Abramowitz & Stegun
26.2.17.

**Utanför t-kvantilen** ligger bootstrap-intervallen (percentilmetoden; mediankvoten med B = 2 000 i
`computeBootstrapCI`, de övriga med 1 000–2 000, kvantilregressionen med 200, avsnitt 6), sektorsmodulen
(`src/lib/sektor.js`, fast 1,96) och jämförelsens osäkerhetsband i Lika arbete (`41-lika-arbete.js`, fast 1,96).

**Regressionerna per BAS-intervall** (`computePerBasGap`) skattar kön och, när lönefilen har ålder, ålder (centrerad
inom intervallet) inom varje BAS-intervall med minst `statGolv()` av varje kön, med HC3 och t-kvantil. Intervall under
golvet redovisas som *för få*, med antalen.

**BH-korrigeringen.** Testerna per BAS-intervall korrigeras för att många prövas samtidigt (Benjamini–Hochberg).
Räkningen står på ett ställe, `bhJustera` i `src/lib/stat.js` (i appen `_bhJustera`): q-värdena i samma ordning som
p-värdena, q = min(1, p · m / rang) med p-värdena sorterade stigande, gjort monotont bakifrån; ett enda test ger q = p.
m är antalet intervall som kunde skattas (status ok och ändligt p-värde). Regressionskortet (`renderRegressionCard`),
Att göra och protokollet för gemensam lönebedömning anropar den över samma tester, så att samma intervall får samma q.
Kortet och Att göra korrigerar bara när m > 1; med ett enda test saknas q där och visas som —. En skillnad är säkerställd
efter korrigering när p < 0,05 och q < 0,05 (eller p < 0,05 när bara ett test körs), vilket är detsamma som q < 0,05
eftersom q aldrig är mindre än p. Signalen per intervall
(`perBasSignal` i `src/lib/status.js`, ADR-59) är *Titta närmare* när den är säkerställd efter korrigering och minst
3 %, *Dokumentera* när den är säkerställd efter korrigering men under 3 %, *Osäkert utslag* när bara det råa p-värdet
är under 0,05 (varningstriangeln), annars *Inget utslag*. Texten om korrigeringen räknas ur antalet tester
(`_bhTextFor`). Protokollet för gemensam lönebedömning tar med de BAS-intervall som har signalen *Titta närmare*, med
q < 0,05 som säkerställt efter korrigering; bladet har kolumnen *q-värde (BH-justerat)* efter p-värdet, och
kolumnen *Säkerställd efter korrigering* gäller q (ADR-59, teknisk-plan §9 punkt 9e).

## 8. Utan ålder

**Hur det avgörs.** Ålderskolumnen är valfri; saknas den läser inläsningen ålder 0 på varje rad, och 0 betyder
*saknas*. `harAlderIRader(rows)` i `src/lib/regression.js` är sant när minst en rad har en ålder över 0; i appen ger
`harAlder()` (`50-regressionsmodeller.js`) svaret för det inlästa underlaget. Det finns inget eget fält i tillståndet.

**Vad varje modell gör då:**

- **Förklaringsmodellen** tvingar `alder: false` med varningen "Ålder kan inte räknas bort: lönefilen saknar ålder.";
  det lagrade valet ändras inte (avsnitt 2).
- **Huvudregressionen** tar med alla rader, utan krav på ålder, och räknar kön + BAS (och yrkesgrupp när den är vald).
- **Stegen** saknar *+ Ålder*, och steget *+ Yrkesgrupp* räknas utan ålder.
- **Vad varje variabel tillför** räknar fullmodellen kön + BAS, och ålder får ingen rad.
- **Regressionerna per BAS-intervall** skattar kön ensamt inom varje intervall.
- **Blinder-Oaxaca** räknar på kön och BAS (eller yrkesgrupp), utan ålderskomponent.
- **Kvantilregressionen** räknar på kön och BAS.
- **Livscykelmodellen** svarar `no_age`.
- **Var uppstår löneskillnaden?** kan inte förklara med åldersgrupp (avsnitt 10).

**Var det sägs.** Metodmeningen om ålder, *Att ålder räknas bort är ett metodval …; det avgör ni.*
(`ALDER_METODVAL_TEXT`), står alltid, med eller utan ålder: i nyckeltalets verktygstips i Lika arbete, i
regressionskortets *Så fungerar regressionen* och i rapportens metodtext. Utan ålder står efter den, i regressionskortet och i rapportens
metodtext, "Lönefilen saknar ålder: analysen körs utan åldersjustering, och Ålder & karriär visas inte."
(`ALDER_SAKNAS_TEXT`), och rutan för ålder i panelen är avstängd. Bladet *Metod & parametrar* (`_methodAppendixData` i `22-exporthjalpare.js`)
säger i raderna *Modell — oförklarad skillnad* och *Steg + Yrkesgrupp* modellen utan ålder
(`modellBeskrivning(forklaringsmodell())`, avsnitt 2) och att lönefilen saknar ålder. Vad inläsningen, flikarna och exporterna gör utan ålder står i ADR-64.

## 9. Golven och vad som redovisas

Golven och redovisningen står i `k-troskeln.md` och upprepas inte här. Regressionens egna tal:

- **Huvudregressionens fasta golv** är 5 av varje kön (och minst 30 rader, avsnitt 1); det justerade gapet med
  konfidensintervall visas därifrån (`k-troskeln.md` §5).
- **`statGolv()`** gäller regressionerna per BAS-intervall, Blinder-Oaxaca, ansvarssteget och bootstrap-intervallen
  (`k-troskeln.md` §5).
- **Det ojusterade steget** *Endast kön* och den förklarade andelen redovisas bara när varje kön når tröskeln
  (`_regStegForRedovisning`); annars ritas ingen trappa och ingen förklaringsbudget, och en mening står i stället (regel
  R1 i `k-troskeln.md` §8). Hur det könsuppdelade redovisas står i `k-troskeln.md` §2.
- **Spärren för *Endast kön*** som huvudtal står i avsnitt 2 och i `k-troskeln.md` §1.

## 10. Var uppstår löneskillnaden?

**Vad som delas.** Avsnittet i Lönestruktur och blocket i rapportunderlaget (efter Sammanfattning) delar skillnaden i
**medellön**, kvinnor minus män i kronor per månad (negativ när kvinnor ligger lägre), i delar som summerar exakt
(`gapUppdelning` i `src/lib/gapuppdelning.js`, kortet i `68-var-uppstar-gapet.js`). Raderna är de med lön över 0 och
kön kvinna eller man. Bara medelvärden ger delar som summerar; kvinnors medianlön i procent av mäns visas bredvid.
Avsnittet och rapportunderlaget visar samma poster.

**De tre standarddelarna.** Med standardvalet BAS och AID (`GAP_VARIABLER_STANDARD`) är delarna:

- **A. BAS-fördelning** (struktur): Σ_b Δs_b · (W̄_b − W̄);
- **B. AID inom BAS** (likvärdigt arbete): Σ_b s̄_b · Σ_a Δs_a|b · (W̄_ab − W̄_b);
- **C. lön inom samma AID och BAS** (lika arbete): Σ_b s̄_b · Σ_a s̄_a|b · ΔW_ab.

Här är s ett köns andel i den överordnade cellen och W en medellön, Δx = x_kvinnor − x_män och x̄ = (x_kvinnor +
x_män) / 2. Varje steg delas alltså symmetriskt med kvinnors och mäns genomsnitt som vikt, så inget kön är referens.
Grupposterna mäts mot snittet (− W̄, − W̄_b); det ändrar inga summor, eftersom Σ Δs = 0, men gör varje post tolkbar. AID
är AID-koden, eller yrket när AID saknas.

**Valbara variabler.** Kortet *Förklara med:* låter handläggaren välja en till fyra variabler bland BAS, sektor,
AID-mellannivå, AID och åldersgrupp (`GAP_VARIABLER`), och ordna dem med knappar. Sektor och AID-mellannivå kan väljas
när lönefilen har AID-koder, åldersgrupp (`ageBucket`: under 20, femårsgrupper från 20–24 till 60–64, 65+) när den har
ålder. Uppdelningen nästlas i den valda ordningen: varje cell c på nivå i−1 har vikten ω_c, produkten av s̄ längs
vägen från hela urvalet (ω = 1). Del i är Σ_c ω_c · Σ_barn Δs_barn|c · (W̄_barn − W̄_c), och den sista delen (*Inom …*)
är Σ_löv ω_löv · ΔW_löv. Delarna summerar exakt till hela skillnaden, eftersom ΔW_c = Σ Δs · W̄ + Σ s̄ · ΔW på varje
nivå. **Ordningen spelar roll**, och kortet säger det: den första variabeln får det den förklarar ensam, nästa det den
förklarar utöver den första, och så vidare.

**AID-nivåernas ordning.** Sektor, AID-mellannivå och AID ordnas alltid grovt till fint på de platser de har i valet,
eftersom en finare nivå före en grövre ger en tom del. En flytt som skulle bryta det är avstängd.

**En cell där ett kön saknas** får det andra könets medellön. Cellen bidrar då bara till sin fördelningsdel, och
inget under den räknas (ΔW = 0).

**Namnen.** Delarna heter efter variablerna (`gapDelar`, `gapDelarIText`, `gapVariablerIText`), till exempel
*BAS-fördelning*, *Åldersgrupp inom BAS* och sist *Inom …* de valda, med id A–E. En post heter efter sina celler,
finast först ("AID, BAS X"). Delarnas namn, kortets texter, trappans beskrivning och rapportunderlagets meningar byggs
ur variablerna; standardvalet ger samma texter som före ADR-65, och samma tal bit för bit (posterna läggs i samma
ordning och räknas med samma operationer). Ett annat val än standard nämns i rapportunderlaget och som raden *Var
uppstår löneskillnaden (variabler)* i metodbilagan (`_methodAppendixData`).

**Rangordningen.** Grupperna i varje del rangordnas efter bidrag i kronor till hela skillnaden — medvetet annorlunda
än Lika arbetes sortering efter skillnadens storlek, och avsnittet säger det. Varje del visar sitt belopp, sin andel av
skillnaden och de grupper som bidrar mest. När skillnaden är under 1 % av männens medellön (`litetGap`) visas inga
andelar, och en not säger att delarna då kan peka åt olika håll och vara större än själva skillnaden.

**Skyddsregeln.** Tröskeln är `kTroskel()`, så skärmen och exporten följer `k-troskeln.md` §1.

1. Har ett kön färre än k personer i hela urvalet delas skillnaden inte upp (`gapUppdelning` ger null), och kortet
   säger varför.
2. En cell är **synlig** bara om den själv och alla celler den ligger i har 0 eller minst k av varje kön. En AID-post
   namnges alltså bara om dess BAS klarar samma krav, eftersom BAS:ens medellön ingår i posten.
3. Dolda poster redovisas bara med antal: "N grupper med färre än k personer ingår i summan". Deras summa redovisas
   aldrig.
4. Poster som avrundas till 0 kr (|belopp| under 0,5 kr) visas inte; de ingår i delen.
5. **Topplistan** i varje del är de synliga posterna med |belopp| minst 0,5 kr, fallande efter |belopp| (lika belopp
   efter namn), högst tre. Den kortas sedan efter regeln: det som inte visas är delens summa minus de visade posterna,
   och för varje dold post h med |h| minst 0,5 kr ska summan av |belopp| för **de andra** posterna som inte visas (dolda
   och synliga) vara minst hälften av |h|. Håller det inte tas den minsta visade posten bort, en i taget, tills regeln
   håller.
6. Håller regeln inte ens med tom lista i någon del redovisas **inga delar**, bara hela skillnaden: delarna summerar
   till hela skillnaden, så en enskild del kan inte döljas medan de andra visas. Kortet säger då att en grupp under
   tröskeln står för så stor del av en av delarna att dess bidrag annars skulle kunna räknas fram.

Regeln gäller per del, för varje val av variabler. Trappan visar bara delsummorna och hela skillnaden, aldrig en enskild
grupps bidrag, och ritas bara när delarna redovisas.

**Hur valet sparas.** Valet lagras som `state.gapUppdelning = { variabler }`, null för standardvalet, och normaliseras
av `normaliseraGapVariabler`: okända och dubbla variabler tas bort; fler än fyra blir de fyra första, med en varning;
åldersgrupp utan ålder i lönefilen tas bort, med en varning; ett tomt eller ogiltigt val ger standard med en varning.
Det som lagras prövas inte mot åldern när det lagras, som förklaringsmodellen. Konfigurationsfilen bär valet
(`gapUppdelning`); ett ogiltigt värde ger standard med varning, och en fil utan fältet ger standard. *Rensa all data*
nollställer valet, och organisationspaketet bär det inte.

## 11. Referensvärden och vakter

**Fixturerna** ligger i `tests/fixtures/`:

| Fil | Vad | Hur den togs fram |
|---|---|---|
| `stat-referens.json` | 100 rader med heteroskedastiskt brus, och designkolumnerna; ett BAS-intervall (F) finns bara hos männen, så regeln i avsnitt 5 prövas | `gen-stat-referens.mjs`, seedad mulberry32 (seed 20261016) |
| `stat-referens-varden.json` | OLS-koefficienter, klassisk kovarians och HC3; t-fördelningens CDF; kvantilregressionen på den äldre rangdesignen; den stegvisa uppdelningen, där bara steget *Endast kön* används (stegen med BAS gäller den äldre rangen, och stegen med indikatorer prövas mot `fitOLS`, som är prövad mot statsmodels); Blinder-Oaxaca med BAS som indikatorer och på modellerna bara BAS, bara ålder och ålder + yrkesgrupp | `ref-stat-referens.py`, körd med `python3 -I` i en tillfällig miljö: statsmodels (OLS, HC3 ≡ R `sandwich::vcovHC` type HC3), scipy (`stats.t.cdf`; kvantilregressionen som exakt LP med HiGHS ≡ R `quantreg::rq`). Kördes 2026-10-16, Blinder-Oaxaca om 2026-10-29 (indikatorer) och 2026-11-05 (de valbara modellerna). CI behöver inte Python. |
| `stat-referens-kvantil.json` | Den exakta LP-lösningen för indikatormodellen (`standard`) och för bara BAS (`baraBas`) vid τ = 0,1, 0,5 och 0,9 | En tabellsimplex med Blands regel i ett engångsskript i Node som inte är incheckat, med kontrollerna i filhuvudet till `tests/stat-referens.test.js` |

Filhuvudet i `tests/stat-referens.test.js` beskriver framtagningen och den uppmätta avvikelsen, och toleranserna i
testerna speglar den.

**Den frusna kopian.** `tests/helpers/gapuppdelning-fore-adr65.js` är `src/lib/gapuppdelning.js` före ADR-65,
oförändrad. Standardvalet BAS och AID prövas mot den på demot, det stora demot och testfallen: talen ska vara bitlika.
Filen ändras aldrig.

**Testfilerna:**

| Fil | Prövar |
|---|---|
| `tests/stat.test.js` | OLS, HC3, `tDistCdf`, `tQuantile` mot t-tabellen, `pValue2Sided` och matrisalgebran: egenskaper; `bhJustera` mot handräknade fall |
| `tests/stat-referens.test.js` | Siffrorna mot fixturerna: OLS och HC3, t-fördelningen, kvantilregressionen (rang- och indikatordesignen), den stegvisa uppdelningen och Blinder-Oaxaca, också på vald modell; `bhJustera` mot statsmodels `multipletests(method='fdr_bh')` |
| `tests/regression.test.js` | `src/lib/regression.js` direkt: förklaringsmodellen som värde, stegen på vald modell, vad varje variabel tillför, `kvantilDesign` och `quantileRegressionAtAllTau`, modellerna utan ålder och radfiltret |
| `tests/smoke-innehall.test.js` | Appen: steget *+ Yrkesgrupp* (likheten med en indikator per grupp, kortet och budgeten), BAS-indikatorerna i kortet, kvantilregressionens intervall, gräns och tolkning, förklaringsmodellen i tillstånd, konfigurationsfil, huvudtal, panel och avsnitt |
| `tests/rapportunderlag.test.js` | Frasen och noteringen om det bortvalda; uppdelningens block, med standardvalets text ordagrant |
| `tests/gapuppdelning.test.js` | Var uppstår löneskillnaden: summorna, tecknet, skyddsregeln, topplistan, de valbara variablerna och den frusna kopian |
| `tests/smoke-granssnitt.test.js` | Kortet *Förklara med:*: valet, tangentbordet och texterna |
| `tests/ktroskel-invarianter.test.js` | I7: uppdelningen med andra val av variabler, vid 10 och 25 (`k-troskeln.md` §10) |
| `tests/ktroskel-regression.test.js` | Regel R1 och BH-texten i regressionskortet |
| `tests/ktroskel-utdata.test.js` | Protokollets blad per BAS-intervall: ett intervall som bara är säkerställt på rått p utelämnas, ett som är säkerställt efter korrigering står med sitt q-värde |
| `tests/ktroskel-utan-alder.test.js`, `tests/exports.golden.test.js` | Utan ålder: varje utdataväg, och facit *lönefil utan ålder* |
| `tests/diagramritare.test.js` | Att ingen text i en ritad figur är ett tal med decimalpunkt (kvantildiagrammet, ADR-63) |
| `tests/forhandsvisning.test.js` | Att regressionen inte cachas (regel R9) |
| `tools/browser-smoke/gapuppdelning.mjs` | Kortet *Förklara med:* i riktiga webbläsare |

Golden-facit och docx-facit (`tests/exports.golden.test.js`) är oförändrade i standardläget, vilket är kontrollen att
standardmodellen räknar som före ADR-56.

**Det som inte prövas för sig:** frihetsgradsskalningen när yrkesgrupp är vald in i huvudtalet (avsnitt 4) har inget
eget test av talen.
