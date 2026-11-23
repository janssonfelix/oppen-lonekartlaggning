# Spårbarhetsmatrisen

Matrisen är ingången för den som granskar verktyget. Varje påstående om vad verktyget räknar eller skyddar har en rad
med ett ID, och raden pekar åt två håll: bakåt till regeln (referensen, beslutet eller skyddet som påståendet bygger
på) och framåt till koden och de tester som prövar det. Testerna pekar tillbaka med samma ID i sitt namn. Matrisen
följer upplägget för en kravspårningsmatris (jfr ISO/IEC/IEEE 29148 och IEC 62304): unika och stabila ID, spårbara åt
båda hållen och prövade automatiskt. Formlerna och regeltexten står inte här utan i referenserna, som matrisen pekar
på; matrisen säger bara var de står. Avsnitt 10 har modellparametrarna: talen som styr en beräkning, med värde och vem
som kan ändra dem.

Koden är sanningen. Där matrisen och koden skiljer sig är det matrisen som ska rättas.

**ID:n.** Beräkningarna heter `B<avsnitt>.<rad>` (B1.1, B1.2 …) efter avsnitt 1–9 nedan. Testerna för minsta
gruppstorlek heter efter sina serier, I1–I8 (och I1b), C2–C6 och R1–R5 (avsnitt 11), och skydden S1–S5 (avsnitt 12).
Ett ID är stabilt: det byts aldrig och återanvänds aldrig. En rad som stryks lämnar en lucka i numreringen, och en ny
rad får nästa lediga nummer i sitt avsnitt.

**Testerna bär ID:t** först i namnet på en `describe` eller ett `it`, inom hakparentes: `describe('[B2.3] …')`. Ett
test som prövar flera rader bär alla deras ID (`[B9.2] [B9.3] …`). Andra märkningar i testsviten står utan
hakparentes och får inte se ut som ett ID här.

**Vakten** `tests/sparbarhet.test.js` läser matrisen och prövar att varje ID står en gång, att varje testfil i
kolumnen *Tester* har ett test vars namn bär radens ID, att varje ID i ett testnamn finns i matrisen och att filerna
och funktionerna i kolumnen *Funktion och fil* finns. Den prövar inte att testet prövar det raden säger; det granskas.

**Kolumnen *Bygger på*** pekar på en referens (dokument och avsnitt), ett beslut i
[`arkitekturbeslut.md`](arkitekturbeslut.md) eller skriver *verktygets eget val, ingen extern källa*. Lagrummen står
samlade i [`lagrum.md`](lagrum.md); matrisen bedömer inte om en beräkning följer lag eller avtal.

**Funktionerna** ligger i `src/lib/` om inget annat sägs. Appen får dem genom spegeln (ADR-8). En adapter i
`src/app/` nämns bara när den gör mer än att skicka vidare.

**Referensfallen** ligger i `tests/fixtures/referensfall/` och prövas av `tests/referensfall.test.js`. Varje fall
har indata, utfall och en härledning steg för steg som går att följa med papper och penna. Fixturerna mot externa
program (statsmodels, scipy) ligger i `tests/fixtures/` och beskrivs i [`regressionsmodellen.md`](regressionsmodellen.md)
avsnitt 11.

**Minsta gruppstorlek** (k) står i [`k-troskeln.md`](k-troskeln.md) och upprepas inte här; dess tester står i
avsnitt 11.

## 1. Grundstatistik

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B1.1 | Median; 0 för en tom lista | `median`, `stat.js` | tal | – | `tests/stat.test.js` | `stat-referens-varden.json` (indirekt) |
| B1.2 | Kvantil med linjär interpolation (typ 7, samma som R:s standard och som PERCENTIL.INK i kalkylprogram) | `quantile`, `stat.js` | tal, andel 0–1 | Hyndman och Fan typ 7 | `tests/stat.test.js` | saknas |
| B1.3 | OLS med klassisk kovarians och HC3; null när n < antal parametrar + 2 | `fitOLS`, `stat.js` | designmatris, lön | `regressionsmodellen.md` §1, §7; ADR-77 | `tests/stat.test.js`, `tests/stat-referens.test.js` | `stat-referens-varden.json` |
| B1.4 | t-fördelningens CDF och kvantil, tvåsidigt p | `tDistCdf`, `tQuantile`, `pValue2Sided`, `stat.js` | t, frihetsgrader | `regressionsmodellen.md` §7; ADR-45 | `tests/stat.test.js`, `tests/stat-referens.test.js` | `stat-referens-varden.json` |
| B1.5 | Normalfördelningens CDF | `normalCdf`, `stat.js` | z | Abramowitz och Stegun 26.2.17 (kommentaren i koden) | `tests/stat.test.js` | saknas |
| B1.6 | Benjamini–Hochberg (q-värden) | `bhJustera`, `stat.js` | p-värden | `regressionsmodellen.md` §7 | `tests/stat.test.js`, `tests/stat-referens.test.js` | `bh-justera-referens.json` |
| B1.7 | Percentilintervall ur bootstrapdragningar: index ⌊n·0,025⌋ och n − 1 − ⌊n·0,025⌋ | `percentilintervall`, `stat.js` | sorterade dragningar | ADR-86 | `tests/osakerhet.test.js`, `tests/slumpintervall-ordning.test.js` | saknas |

## 2. Löneskillnaden och lönestrukturen

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B2.1 | Kvinnors och mäns medianlön, kvinnors median i procent av mäns och mediangapet (kvoten minus 100); bara lön över 0, null när ett kön har färre än k; appen räknar måttet bara med den | `konsMedianer` (och `medianGapPct`, som ger gapet), `struktur.js` | lön, kön | `regressionsmodellen.md` §1 *Tecknet*; `k-troskeln.md` §2 | `tests/struktur.test.js` | `01-mediangap-verktygets-tecken.json`, `03-mediangap-under-k.json` |
| B2.2 | Direktivets tecken: samma belopp, omvänt tecken; 0 förblir 0 | `tillDirektivtecken`, `struktur.js` | gapet | lydelsen i `lagrum.md`; tecknet är verktygets eget val | `tests/struktur.test.js` | `02-mediangap-direktivets-tecken.json` |
| B2.3 | Representation per BAS-intervall: andel kvinnor, medianer, gap | `representationByBas`, `struktur.js` | lön, kön, BAS | verktygets eget val, ingen extern källa | `tests/struktur.test.js` | saknas |
| B2.4 | Kvartilfördelningen: rad i i sorterad ordning hamnar i kvartil min(3, ⌊4i/n⌋); gränsen är mittpunkten mellan kvartilerna | `quartileDistribution`, `struktur.js` | lön, kön | lydelsen i `lagrum.md`; indelningen är verktygets eget val | `tests/struktur.test.js` | `12-kvartiler-n5.json`, `13-kvartiler-n7.json` |
| B2.5 | Gapet längs fördelningen (P10, P25, P50, P75, P90); minst max(2, k) av varje kön | `distributionalGap`, `struktur.js` | lön, kön | verktygets eget val, ingen extern källa | `tests/struktur.test.js` | saknas |

## 3. Regressionen och uppdelningarna

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B3.1 | Huvudtalet: oförklarad löneskillnad med förklaringsmodellen, golven 30 och 5 | `huvudregression`, `regression.js`; adaptern `runOLSRegression` i `src/app/51-lika-arbete-regressionskort.js` | lön, kön, ålder, BAS, AID | `regressionsmodellen.md` §1–§3, §8–§9; ADR-44, 53, 56, 63, 64 | `tests/huvudregression.test.js`, `tests/huvudregression-adapter.test.js`, `tests/berakningar-las.test.js` | `stat-referens-varden.json` (endast kön) |
| B3.2 | Den stegvisa uppdelningen och steget *+ AID-etikett inom BAS* | `computeSequentialGap`, `inomYrkesgrupp`, `regression.js` | som ovan | `regressionsmodellen.md` §4; ADR-46, 77 | `tests/regression.test.js`, `tests/stat-referens.test.js` | `stat-referens-varden.json` |
| B3.3 | Gapet per BAS-intervall | `computePerBasGap`, `regression.js` | som ovan | `regressionsmodellen.md` §9 | `tests/regression.test.js` | saknas |
| B3.4 | Blinder-Oaxaca | `blinderOaxaca`, `regression.js` | som ovan | `regressionsmodellen.md` §5; ADR-53 | `tests/stat-referens.test.js` | `stat-referens-varden.json` |
| B3.5 | Kvantilregressionen | `quantileRegression`, `quantileRegressionAtAllTau`, `kvantilDesign`, `regression.js` | som ovan | `regressionsmodellen.md` §6; ADR-63 | `tests/regression.test.js`, `tests/stat-referens.test.js` | `stat-referens-kvantil.json` |
| B3.6 | Vad varje variabel tillför | `computeVariabelTillfor`, `regression.js` | som ovan | `regressionsmodellen.md` §2 | `tests/regression.test.js` | saknas |
| B3.7 | Var uppstår löneskillnaden: gapet i medellön (kvinnor − män) i delar som summerar exakt, med sammanslagning av små delar | `gapUppdelning`, `gapuppdelning.js` | lön, kön, valda variabler | `regressionsmodellen.md` §10; ADR-22, 65, 87 | `tests/gapuppdelning.test.js` | `04-gapuppdelning-2bas-2aid.json` |
| B3.8 | Översikten per huvudområde: medianer, kvot och justerad skillnad (≥ 30 personer) | `sektorsTabell`, `sektor.js` (justerat via `justeradSkillnad`, `regression.js`) | lön, kön, ålder, BAS, AID | ADR-33, 78 | `tests/sektor.test.js` | saknas |
| B3.9 | Huvudområdenas andel av gapet i medellön (kvinnor − män) | `sektorernasAndel`, `sektor.js` | lön, kön, AID | samma formel och tecken som del A i `gapuppdelning.js`; `regressionsmodellen.md` §10; ADR-87 | `tests/sektor.test.js` | saknas |
| B3.10 | Livscykelmodellen: log(lön) med kön, ålder, ålder², samspelen och BAS | `livscykelRegression`, `livscykel.js` | lön, kön, ålder, BAS | verktygets eget val, ingen extern källa; ADR-71 | `tests/livscykel.test.js`, `tests/ktroskel-livscykel.test.js` | saknas |

## 4. Osäkerheten och uppmärksamhetstrappan

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B4.1 | Bootstrapintervall (95 %) för mediankvoten: hela organisationen, per grupp, per dossier | `organisationensKvotKI`, `medianKvotKI`, `medianKvotKIGiltiga`, `osakerhet.js`; dragningarna i `bootstrapMedianer`, `likvardighet.js` | lön, kön | `regressionsmodellen.md` §7; ADR-86 | `tests/osakerhet.test.js`, `tests/bootstrapkvot.test.js`, `tests/osakerhet-adapter.test.js` | saknas |
| B4.2 | Kvinnors median i procent av mäns per grupp (BAS-intervall, åldersgrupp, löneöversynens grupper före och efter), bara där båda könen når k, med intervallet per grupp | `konskvotPerGrupp`, `osakerhet.js` | lön, kön | `k-troskeln.md`; intervallet ADR-86 | `tests/osakerhet.test.js` | saknas |
| B4.3 | Generatorn: seed ur lönerna (sorterade), FNV-1a och mulberry32 | `seedFromNumbers`, `rngFor`, `rng.js` | lönerna | ADR-86 | `tests/rng.test.js`, `tests/slumpintervall-ordning.test.js` | saknas |
| B4.4 | Konfidensband kring en regressionslinje | `regressionslinjensBand`, `osakerhet.js` | x, y | verktygets eget val, ingen extern källa | `tests/osakerhet.test.js` | saknas |
| B4.5 | Minsta upptäckbara skillnad vid 80 % styrka och α = 0,05 | `mdeProcent`, `styrkeanalys`, `gruppMde`, `osakerhet.js` | σ, antal per kön | verktygets eget val, ingen extern källa | `tests/osakerhet.test.js` | saknas |
| B4.6 | Extremvärden: z på log-lön per BAS-intervall, \|z\| ≥ 3 | `extremvarden`, `osakerhet.js` | lön, BAS | verktygets eget val, ingen extern källa | `tests/osakerhet.test.js` | saknas |
| B4.7 | Trattdiagrammets fält | `trattUnderlag`, `osakerhet.js` | lön, kön, AID, BAS | verktygets eget val, ingen extern källa; grupperna ADR-89 | `tests/osakerhet.test.js`, `tests/grupp-aid-kod.test.js` | saknas |
| B4.8 | Kvantilregressionens intervall | `kvantilBootstrap`, `osakerhet.js` | som kvantilregressionen | ADR-63, 86 | `tests/osakerhet.test.js` | saknas |
| B4.9 | Slumpens gränser: omkastning (1 000 dragningar), över 300 personer normalformeln | `slumpensGranser`, `omkastningsGranser`, `status.js` | lön, kön | ADR-59, 86 | `tests/status-trappa.test.js`, `tests/slumpintervall-ordning.test.js` | saknas |
| B4.10 | Trappan (Värt att granska, Följ upp, Balanserat, Går ej att bedöma) och direktivmarkeringen | `statusNiva`, `bedomSkillnad`, `direktivMarkering`, `perBasSignal`, `status.js` | skillnaden, gränser eller KI | ADR-59, 71 | `tests/status-trappa.test.js` | saknas |

## 5. Lika och likvärdigt arbete

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B5.1 | Grupperna: AID-koden (de inledande siffrorna i fältet, annars hela texten) i BAS-intervallet, med namnet från texten på flest av gruppens rader (vid lika många den första i lönefilen); också Lika arbetes tabell, med en rad per kod och intervall | `aidAvRad` och `namnrader`, `aid.js`; `gruppnycklar`, `falt.js`; `likaArbeteGrupper`, `rapportunderlag.js` | AID, BAS | ADR-89 | `tests/grupp-aid-kod.test.js`, `tests/grupp-aid-kod-app.test.js` | saknas |
| B5.2 | Kvinnodominerat: *Mer än* (`'do'`) eller *Minst* (`'scb'`) gränsen, standard 60 % | `arKvinnodominerad`, `konsklass`, `likvardighet.js` | andel kvinnor | `likvardighetsmodellen.md` §2; ADR-60, 72 | `tests/likvardighet.test.js` | saknas |
| B5.3 | Paren i likvärdigt arbete och lägre krav, högre lön | `byggPar`, `byggParLagreKrav`, `computeLikvardighetPairs`, `likvardighet.js` | lön, kön, AID, BAS | `likvardighetsmodellen.md` §3–§6; ADR-25, 61 | `tests/likvardighet.test.js` | saknas |
| B5.4 | Åldersjusterad skillnad i ett par | `aldersjusteradSkillnad`, `likvardighet.js` | lön, ålder | `likvardighetsmodellen.md` §5 | `tests/likvardighet.test.js` | saknas |
| B5.5 | Tabellerna per AID-kod och BAS-intervall, hierarkiska par; Lika arbete AID x BAS är Lika arbetes grupper och status (`likaArbeteGrupper`) i BAS-ordning, utan egen bedömning, och samma blad (`_aidbasLikaBlad`) är blad 2a i JPA-protokollet; gränserna i tabellen är de statusen prövades mot (`bedomSkillnad`, `status.js`) | `likaArbeteTabell`, `likvardigtTabell`, `hierarkiskaPar`, `individnivaTabell`, `aidbas.js` | lön, kön, AID, BAS | ADR-57, 90, 93 | `tests/aidbas.test.js`, `tests/aidbas-app.test.js`, `tests/ktroskel-utdata.test.js` | saknas |
| B5.6 | Personer att granska: förväntad lön ur kollegorna (log-lön mot ålder när spridningen är minst 5 år, annars medianen), flagga vid minst `grans` % under | `flaggaIndivider`, `individflaggor.js` | lön, ålder, AID, BAS | ADR-23, 89 | `tests/individflaggor.test.js`, `tests/grupp-aid-kod.test.js` | `14-granska-median.json`, `15-granska-alder.json` |
| B5.7 | Personer att granska per BAS-intervall och kön: andelen prövade minst `grans` % under och över förväntad lön, bara där båda könen når k | `avvikelsePerKonOchBas`, `individflaggor.js` | lön, ålder, kön, AID, BAS | ADR-23 | `tests/individflaggor.test.js` | saknas |

## 6. Löneläget mot referenserna

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B6.1 | Organisationens band, läget i bandet (lön − P10)/(P90 − P10), median mot ställningstagandet, avstånd till golvet | `organisationsBand`, `bandPosition`, `groupBandStats`, `complianceCounts`, `costToFloor`, `policyCoverage`, `lonepolitik.js` | lön, ställningstagandet | verktygets eget val, ingen extern källa | `tests/lonepolitik.test.js` | saknas |
| B6.2 | Modellen per BAS-intervall med AID-grupperna under sig; maskeringstrappan (full analys från k, antal från 5, maskerad under); andelen per kön under spannet, i spannets tredjedelar och över | `lonepolitikModell`, `maskeringsniva`, `lagesklass`, `konLagen`, `lonepolitik.js` | lön, kön, AID, BAS, ställningstagandet | verktygets eget val, ingen extern källa | `tests/lonepolitik.test.js` | saknas |
| B6.3 | Könsgap i bandet; minst 10 av varje kön | `genderBandGap`, `lonepolitik.js` | lön, kön, ställningstagandet | verktygets eget val, ingen extern källa | `tests/lonepolitik.test.js` | saknas |
| B6.4 | Jämförelsestatistikens matchning: samma AID och BAS, annars samma AID utan BAS | `statistikFor`, `jamforelse.js` | statistiken | ADR-35, 55 | `tests/jamforelse.test.js` | saknas |
| B6.5 | Jämförelseraderna: P10, median, P90 per AID-kod och BAS, skillnad (org/ref − 1)·100 | `jamforelseRader`, `avvikelseRangordning`, `statistikMarknad`, `jamforelse.js` | lön, AID, BAS, referenserna | ADR-35, 55 | `tests/jamforelse.test.js`, `tests/jamforelsestatistik-app.test.js` | saknas |
| B6.6 | Läget i spannet (0–100, ord med gränserna 33 och 67), mönstret och förslaget på referens | `lageISpann`, `monster`, `forslag`, `lageOchForslag`, `referensOverblick`, `referenser.js` | jämförelseraderna | ADR-55 | `tests/referenser.test.js`, `tests/lonelaget-app.test.js` | saknas |
| B6.7 | Tabellerna per BAS-intervall med kompletterande undertryckning | `perBasTabeller`, `perbas.js`; regeln i `kompletterandeUndertryckning`, `undertryckning.js` | lön, kön, ålder, AID, BAS | ADR-52, 83; `k-troskeln.md` §2 | `tests/perbas.test.js`, `tests/undertryckning.test.js` | saknas |
| B6.8 | Kompletterande undertryckning mellan JPA-protokollets blad för BAS-intervall och för lika arbete | `kompletterandeUndertryckningPerNyckel`, `undertryckning.js`; anropet i `src/app/24-excelexport.js` | antal per kön och intervall | ADR-91, 92; `k-troskeln.md` §2 | `tests/undertryckning.test.js` | saknas |
| B6.9 | Sammanslagning av delar där ett kön har 1 till k − 1 personer | `sammanslagning`, `undertryckning.js` | antal per kön och del | ADR-87; `k-troskeln.md` §2 | `tests/undertryckning.test.js`, `tests/gapuppdelning.test.js`, `tests/sektor.test.js` | saknas |

## 7. Löneöversynen, prioriteringen och kostnaden

Modellerna beskrivs i [`loneoversynsmodellen.md`](loneoversynsmodellen.md) och
[`prioriteringsmodellen.md`](prioriteringsmodellen.md).

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B7.1 | Kostnaden: belopp × månader × (1 + PO/100), gånger antal | `periodkostnad`, `kostnadPerAr`, `kostnadsfaktor`, `kostnad.js` | belopp, månader, PO, antal | ADR-84 | `tests/kostnad.test.js` | `08-kostnad-per-ar.json`, `09-kostnad-per-ar-noll-manader.json` |
| B7.2 | Potten: kronor, eller procent av lönesumman | `computePott`, `totalLonSum`, `loneoversyn.js` | lön, potten | `loneoversynsmodellen.md` §2 | `tests/loneoversyn.test.js` | saknas |
| B7.3 | Fördelningen: generellt påslag, riktade rader, lägst först, avrundning | `allocate`, `targetRows`, `loneoversyn.js` | lön, kön, AID, BAS, raderna | `loneoversynsmodellen.md` §3–§5 | `tests/loneoversyn.test.js`, `tests/ktroskel-loneoversyn-summor.test.js` | `05-loneoversyn-lagst-forst.json`, `06-loneoversyn-tak-vid-medianen.json`, `07-loneoversyn-generellt-avrundning.json` |
| B7.4 | Utfallet: angiven pott eller inte, över potten, kvar, råa gapet före och efter, kostnad för kvinnodominerade grupper | `forecastOutcome`, `pottArAngiven`, `rawGenderGap`, `summarizeGroups`, `bandStats`, `detectLeapfrog`, `loneoversyn.js` | fördelningen | `loneoversynsmodellen.md` §6 | `tests/loneoversyn.test.js`, `tests/ktroskel-loneoversyn-scenarier.test.js` | saknas |
| B7.5 | Det oförklarade gapet före och efter, genom att byta data och köra huvudregressionen | `_forecastOlsGap`, `src/app/36-loneoversyn.js` | före och efter | `loneoversynsmodellen.md` §6 | `tests/ktroskel-loneoversyn-scenarier.test.js` | saknas |
| B7.6 | Förslag ur kandidatparen, stängning med en andel, marknadsmål, känslighet | `suggestTargets`, `closureTargets`, `marketTargets`, `sensitivityCurve`, `ettParPerYrke`, `loneoversyn.js` | paren, potten | `loneoversynsmodellen.md` §7; ADR-69 | `tests/loneoversyn.test.js`, `tests/loneoversyn-forslag-troskel.test.js` | saknas |
| B7.7 | Den stegvisa planen | `stagedPlan`, `loneoversyn.js` | fördelningen, antal år | `loneoversynsmodellen.md` §8 | `tests/loneoversyn.test.js` | saknas |
| B7.8 | Individuell rättelse mot männens median | `individualRemediation`, `loneoversyn.js` | lön, kön, AID, BAS | `loneoversynsmodellen.md` §7 | `tests/loneoversyn.test.js` | saknas |
| B7.9 | Tröskelmålet: minsta lika procentlyft för kvinnorna som når målet (bisektion) | `likalonslyftForMal`, `loneoversyn.js` | rader, mål, skattningen | `loneoversynsmodellen.md` §9 | `tests/loneoversyn-troskelmal.test.js` | saknas |
| B7.10 | Prioriteringen: grupper per AID-kod och BAS-intervall, avvikelse mot referensen, status, delpoäng, index, snabb vinst | `prioritera`, `prioIndex`, `prioritering.js`; adaptern `computePrioritization` i `src/app/55-prioritering.js` väljer referensen | lön, kön, AID, BAS, referensen | `prioriteringsmodellen.md`; ADR-50, 62 | `tests/prioritering.test.js`, `tests/handlingsplan-app.test.js` | `10-prioritering-en-grupp.json`, `11-prioindex-vikter.json` |
| B7.11 | Räkneexemplet om årsbeloppet för en grupp | `arsbeloppMening`, `prioritering.js` | medianer, antal | `prioriteringsmodellen.md` §6 | `tests/kostnad.test.js` | saknas |
| B7.12 | Motiveringsförslagen till en grupp: litet underlag, under detektionströskeln, åldersskillnad, lägsta lönekvintilen, bristyrke, snabb vinst, över och nära referensen | `motiveringsgrunder`, `prioritering.js`; texterna i `generateMotivationSuggestions` i `src/app/55-prioritering.js` | lön, kön, ålder, gruppens avvikelse, tröskeln | verktygets eget val, ingen extern källa; ADR-12 för kvintilen | `tests/prioritering.test.js` | saknas |

## 8. Årsbokslutet och de sakliga skälen

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B8.1 | Lönespridningen (P90 − P10)/median, fyra decimaler | `lonespridning`, `arsbokslut.js` | lön | verktygets eget val, ingen extern källa | `tests/arsbokslut.test.js` | saknas |
| B8.2 | Bokslutet och jämförelsen mellan år | `byggArsbokslut`, `jamforArsbokslut`, `jamforBasIntervall`, `jamforBedomningar`, `bokslutMedGrans`, `arsbokslut.js` | årets aggregat, förra årets bokslut | ADR-54 | `tests/arsbokslut.test.js`, `tests/arsbokslut-app.test.js` | saknas |
| B8.3 | De sakliga skälen: andel av skillnaden, vad som återstår, om summan överstiger skillnaden | `skalSammanstallning`, `skalPerKategori`, `valideraSkal`, `sakligaskal.js` | belopp per kategori, skillnaden | verktygets eget val, ingen extern källa | `tests/sakligaskal.test.js`, `tests/handlingsplan-skal.test.js` | saknas |

**Bokslutets grupper** (ADR-89). En grupp i bokslutet är AID-koden i BAS-intervallet, och intervallet står i ett
valfritt fält `bas`, utan ny formatversion. Grupperna paras med förra årets på koden ur gruppens namn och intervallet;
har ett äldre bokslut flera grupper med samma kod används den med årets namn, annars den största. Ett bokslut sparat
innan grupperna delades per intervall (grupper utan `bas`) har en rad per kod över alla intervall: dess grupper jämförs
inte rad för rad med årets, eftersom en median över alla intervall inte går att dela upp, och skillnaden i antalet
flaggade grupper visas inte. Nyckeltalen, intervallen och Att göra jämförs som vanligt (`jamforArsbokslut`).

## 9. Inläsningen

| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |
|---|---|---|---|---|---|---|
| B9.1 | Talformat: mellanslag, hårt mellanslag och apostrof som tusentalsavgränsare; tecknen + − och U+2212; kr, SEK, kronor, `:-`, `,-`, % och år. Med två olika avgränsare är den sista decimaltecknet och den andra måste stå i grupper om tre; en ensam avgränsare följd av exakt tre siffror (och en heltalsdel som inte är 0) är tusental. Avvisas: bokstäver, `1.2.3`, `12,34.56`, `3.25E+04`. Tal från kalkylprogrammet tas som de är | `_normalizeNumberString`, `parseNumber`, `parseNumberStrict`, `inlasning.js` | cellen | verktygets eget val, ingen extern källa | `tests/talformat.test.js`, `tests/inlasning.test.js` | saknas |
| B9.2 | Kön: k, kv, kvinna, kvinnor, f, female, w, woman blir kvinna; m, ma, man, män, male blir man; siffror tolkas inte | `_normalizeKon`, `inlasning.js`; villkoren `arKvinna`, `arMan` i `kon.js` | cellen | verktygets eget val, ingen extern källa | `tests/inlasning.test.js` | saknas |
| B9.3 | BAS: prefixet BAS tas bort, versaler | `_normalizeBas`, `inlasning.js` | cellen | verktygets eget val, ingen extern källa | `tests/inlasning.test.js` | saknas |
| B9.4 | Födelseår i ålderskolumnen: ett värde från 1900 till referensåret − 15 blir referensåret − värdet (status `birthyear`) | `tolkaLonerad`, `inlasning.js` | ålderscellen, referensåret | verktygets eget val, ingen extern källa; ADR-64 | `tests/inlasning.test.js` | saknas |
| B9.5 | AID-etiketten: koden och högst 40 tecken etikett, utan `< > " ' &`; ingenting maskeras. Varning för namnmönster på högst två rader | `_cleanYrkeField`, `yrkeNamnNyckel`, `sallsyntaNamnrader`, `inlasning.js` | cellen | ADR-85 | `tests/namn-i-yrkesfaltet.test.js`, `tests/inlasning.test.js` | saknas |

## 10. Modellparametrarna

Talen som styr en beräkning. *Inställning* betyder att användaren ändrar värdet i fliken Inställningar eller i
konfigurationsfilen, *Organisationspaket* att paketet kan sätta det, *Fast* att det bara ändras i koden. Gränserna för
inställningarna står i `src/lib/installningsgranser.js`. Konstanter som bara styr kontroller av indata, text eller
filformat (till exempel i `forhandskontroll.js`, `datakvalitet.js` och `aidkontroll.js`) står inte här, eftersom de inte
ändrar något tal i resultatet.

| Namn | Värde | Fil | Vad det styr | Vem ändrar |
|---|---|---|---|---|
| `K_STANDARD` | 10 | `src/app/06-k-troskel.js` (samma värde i `src/lib/ktroskel.js`) | minsta gruppstorlek i det som lämnar verktyget, och golvet `statGolv()` | Inställning (2–1000) och Organisationspaket |
| `K_MIN`, `K_MAX` | 2, 1000 | `src/app/06-k-troskel.js` (samma värden i `src/lib/ktroskel.js`) | tröskelns gränser | Fast |
| `K_SKARM` | 1 | `src/app/06-k-troskel.js` | tröskeln på skärmen | Fast |
| `LITET_UNDERLAG` | 5 | `src/app/06-k-troskel.js` | en stapel för färre personer ritas med mönster; golvet för en egen rad i könsfördelningen i Lika arbete | Fast |
| `KI_NEDRE` | 0,025 | `src/lib/stat.js` | percentilintervallens nedre andel | Fast |
| `HUVUDREGRESSION_MIN_N`, `HUVUDREGRESSION_MIN_PER_KON` | 30, 5 | `src/lib/regression.js` | huvudregressionens golv | Fast |
| `TILLFOR_GRANS_PP` | 0,5 | `src/lib/regression.js` | under så många procentenheter i R² tillför en variabel lite | Fast |
| `FORKLARINGSMODELL_STANDARD` | BAS och ålder | `src/lib/regression.js` | förklaringsmodellen som standard | Inställning |
| `GAP_VARIABLER_STANDARD` | BAS, AID | `src/lib/gapuppdelning.js` | uppdelningens variabler som standard | Inställning |
| `MIN_REGRESSION` | 30 | `src/lib/sektor.js` | minsta antal för justerad skillnad per huvudområde | Fast |
| `SAMSPEL_GRANS` | 0,10 | `src/lib/livscykel.js` | samspelet kön × ålder är säkerställt när p är under gränsen | Fast |
| `STORLEKSGRANS` | 3 % | `src/lib/status.js` | trappans storleksgräns | Fast |
| `DIREKTIVNIVA` | 5 % | `src/lib/status.js` | direktivmarkeringen | Fast |
| `OMKASTNINGAR`, `STOR_GRUPP` | 1000, 300 | `src/lib/status.js` | omkastningens dragningar; gränsen för normalformeln | Fast |
| `B_ORGANISATION`, `B_PER_GRUPP`, `B_DOSSIER` | 2000, 1000, 2000 | `src/lib/osakerhet.js` | bootstrapdragningar | Fast |
| `KVOT_MIN_N`, `DOSSIER_MIN_GILTIGA` | 3, 20 | `src/lib/osakerhet.js` | minsta antal av varje kön för ett intervall per grupp; minsta antal giltiga dragningar i dossiern | Fast |
| `Z_95` | 1,96 | `src/lib/osakerhet.js` | 95 % i normalformlerna | Fast |
| `BAND_MIN_N`, `BAND_STEG` | 3, 30 | `src/lib/osakerhet.js` | regressionsbandet: minsta antal punkter, punkter längs linjen | Fast |
| `Z_STYRKA` | 2,802 | `src/lib/osakerhet.js` | z för α = 0,05 tvåsidigt plus 80 % styrka | Fast |
| `BALANSGRANS`, `STYRKA_MIN_N` | 0,4, 10 | `src/lib/osakerhet.js` | styrkeanalysen: jämn könsfördelning, minsta antal | Fast |
| `MDE_SIGMA_MIN_RESIDUALER`, `MDE_GOD`, `MDE_GODTAGBAR`, `MDE_FOR_LITEN` | 20, 3 %, 7 %, 5 | `src/lib/osakerhet.js` | minsta upptäckbara skillnad: σ inom grupp, orden god och godtagbar, för liten grupp | Fast |
| `EXTREMVARDE_Z` | 3 | `src/lib/osakerhet.js` | extremvärden | Fast |
| `MAD_TILL_SIGMA`, `MEDIAN_SE_FAKTOR` | 1,4826, 1,2533 | `src/lib/osakerhet.js` | MAD till σ vid normalfördelning; medianens standardfel √(π/2)·σ/√n | Fast |
| `SMA_GRUPPER_RATTNING` | 0,6 | `src/lib/osakerhet.js` | trattens breddning för små grupper | Fast |
| `KVANTIL_KI_B`, `KVANTIL_KI_MAX_N` | 200, 2000 | `src/lib/osakerhet.js` | kvantilregressionens intervall | Fast |
| `KVINNO_TROSKEL_DEFAULT`, `KV_DOM_STAT`, `KV_GRANS_STANDARD` | 60 % | `src/lib/likvardighet.js`, `src/lib/aidbas.js` | gränsen för kvinnodominerat, också i `forecastOutcome` när ingen gräns skickas | Inställning (gränsen och definitionen) |
| `ALDERS_GOLV_DEFAULT`, `ALDERS_SPRIDNING_MIN` | 10, 5 år | `src/lib/likvardighet.js` | åldersjusteringen i paren | Fast |
| `ARSBOKSLUT_K_MIN` | 2 | `src/lib/arsbokslut.js` | lägsta tröskel ett bokslut bär; ett lägre k i filen höjs hit | Fast |
| `SKAL_GRANSER` | 200 000 kr, 200 tecken, 8 skäl | `src/lib/sakligaskal.js` | gränserna för de sakliga skälen | Fast |
| `PRIO_CONFIG_DEFAULTS` | åtgärd −5 %, akut minst 10, bevaka −2 %, analysera 5 % | `src/app/07-standardinstallningar.js` | prioriteringens statusar | Inställning |
| `PRIO_WEIGHTS_DEFAULTS` | avvikelse 50, volym 30, jämställdhet 20 | `src/app/07-standardinstallningar.js` | prioriteringens vikter | Inställning |
| `AVVIKELSE_TAK`, `VOLYM_TAK`, `GAP_TAK` | 30 %, 50 personer, 15 % | `src/lib/prioritering.js` | delpoängens tak | Fast |
| `RIKTNING_UNDER`, `RIKTNING_OVER` | 1,0, 0,5 | `src/lib/prioritering.js` | riktningsvikten | Fast |
| `BRIST_MULTIPLIKATOR` | 1,2 | `src/lib/prioritering.js` | bristyrken | Fast |
| `SNABB_VINST_KR`, `SNABB_VINST_AVVIKELSE`, `SNABB_VINST_MIN_N` | 1 500 kr, 3 %, 5 | `src/lib/prioritering.js` | snabb vinst | Fast |
| `COST_DEFAULTS` | 12 månader, PO 40 % | `src/app/07-standardinstallningar.js` | kostnaden | Inställning och Organisationspaket (ADR-84) |
| `TROSKELMAL_STANDARD_PCT`, `TROSKELMAL_MAX_LYFT_PCT`, `TROSKELMAL_VARV`, `TROSKELMAL_SIGNIFIKANS_P` | 5 %, 40 %, 22, 0,05 | `src/lib/loneoversyn.js` | tröskelmålet; målet går att ändra i fliken | Fast (målet: värde i fliken) |

Värden som står direkt i koden i stället för som namngivna konstanter, och som därför inte går att hitta på namn:
gapgränsen 5 % i `individualRemediation` (`loneoversyn.js`),
kvoterna 1,10 och 0,90 för över och under BAS-medianen i `src/app/36-loneoversyn.js`, minst 10 av varje kön i
`genderBandGap` (`lonepolitik.js`), åldersspridningen 5 år i `flaggaIndivider` (`individflaggor.js`), gränsen för
personer att granska (standard 10 %, 5–30) i `src/app/43-personer-att-granska.js` och talen 1,96, 1,2533 och 1,4826 i
`slumpensGranser` (`status.js`), som inte kan importera `osakerhet.js` utan att importgrafen får en cykel.

## 11. Minsta gruppstorlek

Testerna för tröskeln (skyddet S4) i tre serier. Regeltexten står i [`k-troskeln.md`](k-troskeln.md), vars avsnitt 9
förtecknar varje väg ut med sin vakt och avsnitt 10 beskriver fixturerna; R-serien är reglerna i dess avsnitt 8. Det
finns ingen C1.

| ID | Påstående | Regel | Funktion och fil | Tester |
|---|---|---|---|---|
| I1 | Löneöversyn visar ingen kostnad för grupper under tröskeln | `k-troskeln.md` §2 (Löneöversyns summor) | `src/app/36-loneoversyn.js` | `tests/ktroskel-invarianter.test.js` |
| I1b | Löneöversyns knappresultat följer läget och tröskeln | `k-troskeln.md` §1 och §3 | `src/app/36-loneoversyn.js` | `tests/ktroskel-invarianter.test.js` |
| I2 | Exporter som hör till ett undantag säger det, och notisen utlovar ingen aggregering | `k-troskeln.md` §4 och §7 | `_kUndantagFor`, `kStampelFor`, `src/app/06-k-troskel.js` | `tests/ktroskel-exporter.test.js` |
| I3 | Tröskeln står i ZIP-filens Excel-fil och i utskriftens korta urval | `k-troskeln.md` §7 | `kStampel`, `_kSanktNot`, `src/app/06-k-troskel.js`; `_appendMethodSheet`, `src/app/22-exporthjalpare.js` | `tests/ktroskel-exporter.test.js` |
| I4 | Invarianten över flikar och exporter: inget som lämnar verktyget redovisar ett lönemått för en grupp eller ett kön under tröskeln, vid 10 och 25, med differensprovet; riggens lista över flikar är menyns | `k-troskeln.md` §1, §2 och §9; ADR-88 | `ktroskel.js`; `exportSakraAlla`, `src/app/23-exportgrind.js` | `tests/helpers/ktroskel-invariant.js` (körd av `ktroskel-invarianter.test.js` och `ktroskel-invarianter-25.test.js`), `tests/ktroskel-exporter.test.js` |
| I5 | Konfigurationsfil och organisationspaket ritar om det som syns en gång när tröskeln ändras och tömmer resten | `k-troskeln.md` §3 och §6 | `sattKTroskel`, `src/app/06-k-troskel.js`; `src/app/29-organisationspaket.js` | `tests/ktroskel-exporter.test.js` |
| I6 | Underlaget i exportläget, precis under och precis över skyddsregeln | `k-troskeln.md` §1; `diagramkarnan.md` §1 | `src/app/23-exportgrind.js` | `tests/ktroskel-invarianter.test.js` |
| I7 | Var uppstår löneskillnaden med andra val av förklaringsvariabler, vid 10 och 25 | `k-troskeln.md` §2 (Var uppstår löneskillnaden); ADR-87 | `gapUppdelning`, `gapuppdelning.js` | `tests/ktroskel-invarianter.test.js` |
| I8 | Sakliga skäl på en rad under tröskeln lämnar inte verktyget | `k-troskeln.md` §2 och §9 | `src/app/57-sakliga-skal.js` | `tests/ktroskel-invarianter-25.test.js` |
| C2 | Struktur per BAS visar inget könsgap när ett kön är under tröskeln | `k-troskeln.md` §2 | `representationByBas`, `struktur.js` | `tests/ktroskel-kon.test.js` |
| C3 | Könsuppdelade mått för hela organisationen kräver tröskeln för varje kön | `k-troskeln.md` §2 | `konsMedianer`, `struktur.js`; `_konFarRedovisasFor`, `src/app/06-k-troskel.js` | `tests/ktroskel-kon.test.js` |
| C4 | Allt som visar gruppmått följer tröskeln när den ändras (den öppna fliken direkt, övriga när de öppnas) | `k-troskeln.md` §3 | `sattKTroskel`, `src/app/06-k-troskel.js` | `tests/ktroskel-kon.test.js` |
| C5 | Bladet Lönepolitik i Excel (alla flikar) följer tröskeln som fliken | `k-troskeln.md` §2 | `lonepolitikModell`, `lonepolitik.js`; `src/app/24-excelexport.js` | `tests/ktroskel-kon.test.js` |
| C6 | Räkneexemplet i kronor per år bara när båda könen når tröskeln | `k-troskeln.md` §8 (R1) | `src/app/51-lika-arbete-regressionskort.js` | `tests/ktroskel-kon.test.js` |
| R1 | Regressionens ojusterade steg kräver tröskeln för varje kön | `k-troskeln.md` §8 | `_regStegForRedovisning`, `_konFarRedovisas`, `src/app/06-k-troskel.js` | `tests/ktroskel-regression.test.js` |
| R2 | En egen riktad rad på en grupp under tröskeln är tillåten och får en upplysning; verktygets egna förslag följer tröskeln | `k-troskeln.md` §8; ADR-69 | `_fcKandidater`, `_fcRensaParMal`, `src/app/36-loneoversyn.js`; `ettParPerYrke`, `loneoversyn.js` | `tests/ktroskel-regression.test.js` |
| R3 | Ålder & karriär följer regeln för könsuppdelade mått | `k-troskeln.md` §8 | `_setDiagramKNot`, `src/app/06-k-troskel.js`; `_demoBandFigur`, `src/app/40-alder-karriar.js` | `tests/ktroskel-regression.test.js` |
| R4 | Löneöversynens scenariojämförelse maskerar ett rågap som sparats vid en lägre tröskel (lönegapet före och efter) | `k-troskeln.md` §8 | `_konFarRedovisasFor`, `src/app/06-k-troskel.js` | `tests/ktroskel-regression.test.js` |
| R5 | Löneöversyns tröskelmål (lyft i procent och kostnad) kräver tröskeln för varje kön | `k-troskeln.md` §8 | `_forecastThreshold`, `src/app/36-loneoversyn.js`; `_konFarRedovisasFor`, `src/app/06-k-troskel.js` | `tests/troskelbeslut.test.js` |

Regel R4 vaktas också av C3 och röktestet. De övriga testerna i `tests/ktroskel*.test.js`, `tests/kanonymitet.test.js`
och `tests/troskelbeslut.test.js` heter efter det de prövar och står i `k-troskeln.md` §9.

## 12. Skydden

De fem skydden. Regeln, varför, besluten och vad som inte vaktas står i [`skydd.md`](skydd.md); där står också
vakterna utanför testsviten (röktestet i webbläsaren, linten och CI-grindarna), som inte bär något ID.

| ID | Påstående | Regel | Funktion och fil | Tester |
|---|---|---|---|---|
| S1 | Verktyget gör inga nätverksanrop: byggets CSP stänger all utgående trafik | `skydd.md` S1; ADR-9 | `src/index.html` (CSP:n) | `tests/sakerhet.test.js` |
| S2 | Ingenting sparas mellan sessioner: lagringsspärren kastar vid varje skrivning | `skydd.md` S2; ADR-1 | `src/app/00-sakerhet-och-uppstart.js` | `tests/sakerhet.test.js` |
| S3 | En HTML-fil som fungerar från `file://` utan nät, utan något som hämtas utifrån | `skydd.md` S3; ADR-6, 8 | `tools/bundle.mjs` | `tests/sakerhet.test.js` |
| S4 | Inget som lämnar verktyget redovisar ett lönemått för en grupp eller ett kön med färre personer än tröskeln | `skydd.md` S4; `k-troskeln.md` | `ktroskel.js`; `src/app/06-k-troskel.js`; `src/app/23-exportgrind.js` | `tests/helpers/ktroskel-invariant.js` (I4); serierna i avsnitt 11 |
| S5 | Ingen inbyggd organisation: etiketterna och referenserna kommer ur användarens filer | `skydd.md` S5; ADR-28 | `orgNamn`, `jmfNamn`, `src/app/07-standardinstallningar.js` | `tests/sakerhet.test.js`, `tests/start-och-meny-app.test.js` |
