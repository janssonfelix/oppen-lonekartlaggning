# Löneöversynsmodellen — referens

Löneöversynen simulerar en lönerevision: en pott fördelas som ett generellt påslag till alla och som riktade rader till
valda grupper, och verktyget visar de nya lönerna, vad det kostar och hur skillnaden mellan kvinnors och mäns lön
ändras. Det här dokumentet bär den **gällande lydelsen** för modellen. Koden är sanningen; där dokumentet och koden
skiljer sig är det dokumentet som ska rättas.

**Simuleringen är verktygets egen.** Fördelningssätten, förslagen, avrundningen, tröskelmålet och de fasta talen är
verktygets egna val, inte hämtade från någon extern källa. Simuleringen visar vad ett val ger, inte vilket val
organisationen ska göra.

Varför Prioriteringen och Löneöversynen är två flikar står i ADR-50 och varför förslagen följer den inställda
tröskeln i ADR-69 ([`arkitekturbeslut.md`](arkitekturbeslut.md)). Minsta gruppstorlek står i
[`k-troskeln.md`](k-troskeln.md). Varje beräkning har sin rad i spårbarhetsmatrisen, [`sparbarhet.md`](sparbarhet.md).

| Del | Fil |
|---|---|
| Modellen: potten, fördelningen, utfallet, förslagen, planen, tröskelmålet | `src/lib/loneoversyn.js` |
| Kostnadsformeln | `src/lib/kostnad.js` (`periodkostnad`) |
| Adaptern: kontrollerna, utfallet med k-regeln, huvudregressionen före och efter, kandidatparen, exporten | `src/app/36-loneoversyn.js` |
| Kandidatparen | `src/lib/likvardighet.js` (`byggPar`); appens urval i `_parForRedovisning` |

## 1. Flödet

1. Potten räknas ur budgeten (avsnitt 2).
2. Det generella påslaget och de riktade raderna fördelas på varje person, på de **ursprungliga** lönerna (avsnitt 3
   och 4). Påslagen läggs ihop per person.
3. Den nya lönen avrundas, om ett lönesteg är valt (avsnitt 5).
4. Utfallet jämförs med potten och med lönerna före (avsnitt 6).

Alla belopp är kronor per månad tills kostnaden räknas över perioden (avsnitt 10).

## 2. Potten

    pott = max(0, belopp)                         när budgeten är i kronor
    pott = max(0, lönesumman × procent / 100)     när budgeten är i procent

Lönesumman är summan av alla löner över 0 (`totalLonSum`). En budget som saknas eller inte är ett tal (ett tomt fält)
är **ingen angiven pott** (`pottArAngiven` falskt): potten räknas då som 0, men utfallet jämförs inte med den
(avsnitt 6). En angiven pott på 0 kr är en pott. Potten styr ingenting i fördelningen; den är måttstocken som utfallet
jämförs med.

## 3. Generellt påslag

Varje person med lön över 0 får `lön × procent / 100`, eller samma belopp i kronor. Ett värde som saknas räknas
som 0.

## 4. Riktade rader

**Urvalet** (`targetRows`). En rad gäller ett BAS-intervall och en AID-kod, eller hela BAS-intervallet när koden är
`*`. Den kan snävas in till ett kön (kvinnor eller män) och till löner under en gräns (strikt under).

**Tre sätt att ange beloppet:**

| Sätt | Betyder |
|---|---|
| `kr` | en pott i kronor för raden |
| `pct` | en pott på procent av urvalets lönesumma |
| `till` | varje person i urvalet med lön under beloppet lyfts upp till beloppet; ingen pott fördelas |

En pott som är 0 eller mindre fördelar ingenting.

**Tre fördelningar av en pott:**

| Fördelning (nyckel) | Ord i fliken | Betyder |
|---|---|---|
| `flat` | Lika % till alla | potten fördelas i proportion till lönen: alla i urvalet med lön över 0 får samma procent |
| `lowest` | Lyft lägst betalda först | algoritmen *lägst först* nedan, utan tak |
| `target` | Lyft mot målnivå | algoritmen *lägst först* nedan, med taket vid urvalets median (eller P25) |

Taket räknas på **urvalet**, alltså efter att kön och lönegräns har snävat in det.

**Lägst först** (`_waterLevelDeltas`) hittar en gemensam nivå L och lyfter alla under L upp till L, så långt potten
räcker. För hand:

1. Sortera lönerna stigande. Låt L vara den lägsta lönen och *använt* vara 0.
2. Ligger taket på eller under den lägsta lönen får ingen något.
3. För i = 1, 2, … n: nästa nivå är det lägsta av nästa lön i ordningen (efter den sista: obegränsat) och taket.
   Att lyfta de i lägsta från L till nästa nivå kostar i × (nästa nivå − L).
4. Räcker inte det som är kvar av potten till det steget: dela det som är kvar lika på de i, L ökar med kvar / i, och
   fördelningen är klar.
5. Annars: lägg kostnaden till *använt* och sätt L till nästa nivå. Har L nått taket stannar fördelningen.
6. Varje person under L får L − lönen; övriga får 0.

Pengar som inte får plats under taket används inte. Referensfallen visar båda: `05-loneoversyn-lagst-forst.json`
fördelar 6 000 kr på fem löner (25 000, 26 000, 28 000, 31 000, 35 000) utan tak och når L = 28 333,33;
`06-loneoversyn-tak-vid-medianen.json` gör samma sak med taket vid medianen 28 000, fördelar 5 000 kr och lämnar
1 000 kr oanvända.

**Flera rader.** Varje rad räknas för sig på de ursprungliga lönerna, och påslagen läggs ihop per person. En person
som står i två rader får båda påslagen.

## 5. Avrundningen

Med ett lönesteg (till exempel 100 kr) avrundas den nya lönen till närmaste steg, och påslaget blir det som återstår:

    ny lön  = avrundning((lön + påslag) / steg) × steg     (,5 avrundas uppåt)
    påslag  = max(0, ny lön − lön)

Bara den som får ett påslag avrundas. Det har två följder:

- **Ett litet påslag kan bli 0.** Ett påslag under ett halvt steg avrundas bort.
- **Summan kan gå över potten.** Avrundningen uppåt lägger till pengar som potten inte räknat med. Utfallet flaggas
  då (avsnitt 6). `07-loneoversyn-generellt-avrundning.json` visar det: 2,5 % på fem löner är 3 603 kr före
  avrundning och 3 680 kr efter avrundning till 100 kr.

Det generella och det riktade påslaget redovisas före avrundning (`generellCost`, `riktadCost`); det använda
(`totalRaise`) är summan efter avrundning.

## 6. Utfallet

`forecastOutcome` ger:

| Tal | Hur |
|---|---|
| Använt | summan av påslagen efter avrundning |
| Angiven pott | `pottAngiven`: budgeten har ett tal (avsnitt 2) |
| Kvar | potten − använt; null utan angiven pott |
| Över potten | använt > potten + 0,000001 när en pott är angiven, annars falskt; fliken säger *Fördelningen överskrider potten* |
| Lönesumman före och efter | före + använt |
| Den råa skillnaden före och efter | kvinnornas median i procent av männens, minus 100 (`rawGenderGap`) |
| Varav till kvinnodominerade grupper | kostnaden i grupper (BAS och AID) som är kvinnodominerade enligt inställningen i Likvärdigt arbete; skickas ingen gräns gäller `KVINNO_TROSKEL_DEFAULT` (60 %) |
| Grupper som går om varandra | en grupp vars median låg under en annans och efter påslaget ligger över den (`detectLeapfrog`) |
| Total kostnad | se avsnitt 10 |

**Utan angiven pott** visar fliken påslagen som vanligt, men *Pott* och *Kvar att fördela* står som ett streck med
*ingen pott angiven*, och ingen varning om överskriden pott. Excel-exporten skriver *ingen pott angiven* på raden
*Pott* och ett streck på raden *Kvar att fördela*, och ett sparat scenario heter *ingen pott angiven* i stället för
*0 kr*. Utan pott och utan påslag visas inget utfall (fliken säger att en pott behövs).

**Den oförklarade skillnaden före och efter** räknas i appen (`_forecastOlsGap`): huvudregressionen körs en gång på
lönerna före och en gång på de nya lönerna, med samma förklaringsmodell ([`regressionsmodellen.md`](regressionsmodellen.md)).

**Lönespannet per BAS-intervall** (`bandStats`) ger P25, median och P75. Gruppens läge är den nya medianen delad med
BAS-intervallets median; över 1,10 märks *över* och under 0,90 *under*.

**Kontrollerna** varnar för en negativ budget eller ett negativt generellt påslag, en budget över 50 % av lönesumman,
ett generellt påslag över 25 %, en riktad rad utan belopp och en riktad rad som inte träffar någon.

## 7. Förslagen

Förslagen bygger riktade rader; användaren kan ändra eller ta bort dem.

**Kandidatparen** kommer ur Likvärdigt arbete ([`likvardighetsmodellen.md`](likvardighetsmodellen.md) §5): en
kvinnodominerad grupp (BAS och AID) med en skillnad i kronor mot en jämförelsegrupp (`gapKr`, jämförelsegruppens
median minus den kvinnodominerade gruppens). Paren väljs med den inställda tröskeln, också på skärmen (ADR-69). Har en
grupp flera par tas det med störst skillnad (`ettParPerYrke`). Bara par med skillnad över 0 och minst *minsta antal
personer i gruppen* (standard 10) tas med.

| Förslag | Funktion | Belopp per grupp |
|---|---|---|
| Förslag ur potten | `suggestTargets` | potten efter det generella påslaget, fördelad i proportion till gapKr × n, men aldrig mer än gapKr × n; avrundat till hela kronor |
| Minska skillnaderna med en andel | `closureTargets` | andelen × gapKr × n, avrundat |
| Lyft mot marknaden | `marketTargets` | (marknadens median × faktorn − gruppens median) × n, för grupper under; faktorn är standard 95 % |
| Grupper som uppfyller ett villkor | i appen (`_forecastAddByCriteria`) | samma belopp och fördelning för alla grupper som är kvinnodominerade, under BAS-medianen, under BAS-intervallets P25 eller alla |

Förslagen ur paren, ur potten och mot marknaden fördelas *lägst först* inom gruppen; villkorsraderna får den
fördelning användaren väljer.

**Känsligheten** (`sensitivityCurve`) räknar *minska skillnaderna* för andelarna 0, 10, … 100 % och visar kostnaden
och den råa skillnaden för varje andel.

**Individuell rättelse** (`individualRemediation`) jämför varje kvinna med männens median i samma BAS och AID, eller i
BAS-intervallet när gruppen har för få män. Hon räknas när hennes lön ligger mer än en gräns (standard 5 %) under
jämförelsevärdet; kostnaden är jämförelsevärdet minus lönen.

## 8. Den stegvisa planen

`stagedPlan` sprider fördelningen över 1–5 år. År k av N ger varje person påslaget × k / N. För varje år redovisas
det samlade påslaget, kostnaden över perioden och den råa skillnaden. Påslagen per år avrundas inte på nytt.

## 9. Tröskelmålet

`likalonslyftForMal` söker det minsta lika procentlyftet till **alla kvinnor** som gör att den oförklarade skillnaden
(huvudregressionen) når målet:

- antingen att skillnaden är minst −mål (standard 5 %; målet 0 % betyder att skillnaden är minst 0),
- eller, när användaren väljer det, att skillnaden inte är signifikant: p över 0,05 eller inget p.

Sökningen är en halvering i intervallet 0–40 % i 22 varv; svaret är intervallets övre gräns, där målet är nått.
Är målet redan nått, går regressionen inte att skatta eller räcker inte 40 %, sägs det i stället.
Fältet för målet läses i `_forecastThreshold` (`_forecastLasMal`): 0 är ett mål, ett tomt fält eller något som inte är
ett tal ger standardmålet, och ett tal utanför fältets gränser (0–20 %) avvisas med *Ange ett mål mellan 0 och 20 %*.
I läget *inte signifikant* spelar fältet ingen roll. Kostnaden per månad
är kvinnornas lönesumma gånger lyftet, utan PO. Lyftet visas bara när båda könen når tröskeln.

| Konstant | Värde |
|---|---|
| `TROSKELMAL_STANDARD_PCT` | 5 % |
| `TROSKELMAL_MAX_LYFT_PCT` | 40 % |
| `TROSKELMAL_VARV` | 22 |
| `TROSKELMAL_SIGNIFIKANS_P` | 0,05 |

## 10. Kostnaden

    kostnad över perioden = belopp per månad × månader × (1 + PO / 100)

`periodkostnad` i `kostnad.js`, med beräkningsperioden och PO-påslaget ur kostnadsinställningarna (standard 12
månader och 40 %, ADR-84). Månader som saknas eller är 0 blir 12; PO som saknas blir 0 %. Utfallet, planen,
känsligheten, tröskelmålet och den individuella rättelsen räknar med samma formel.

## 11. Inställningar och fasta tal

| Vad | Standard | Var det ändras |
|---|---|---|
| Budget (kronor eller procent) | ingen | fliken |
| Generellt påslag (kronor eller procent) | inget | fliken |
| Riktade rader | inga | fliken, förslagen |
| Minsta antal personer i gruppen för förslag | 10 | fliken |
| Lönesteg för avrundning | 0 (ingen) | fliken |
| Antal år i planen | 1 | fliken (1–5) |
| Andel att minska skillnaderna med, marknadsfaktor, gräns för individuell rättelse, tröskelmål | –, 95 %, 5 %, 5 % | fliken |
| Kvinnodominerat | *Mer än 60 %* | Likvärdigt arbete |
| Beräkningsperiod, PO-påslag | 12 månader, 40 % | Inställningar, konfigurationsfilen, organisationspaketet |

Fasta: tröskelmålets konstanter (avsnitt 9), varningsgränserna 50 % och 25 % (avsnitt 6), kvoterna 1,10 och 0,90
(avsnitt 6) och den stegvisa planens högst 5 år.

## 12. Minsta gruppstorlek

Hur k gäller utfallet, förslagen och exporten står i [`k-troskeln.md`](k-troskeln.md). I korthet: en grupp under k har
sin rad, men medianerna och kostnaden står inte per grupp; deras kostnad står samlad på en rad, och räcker den inte till
k personer viks de minsta visade grupperna in tills den gör det (`_fcUtfallsrader`). Regeln gäller filen för sig: att
kostnaden per grupp med ett påslag i procent, tillsammans med intervallets medellön i rapporten, ger mer än filen visar
skyddas inte (ADR-92). Lönespannet för ett BAS-intervall
under k utelämnas. Den individuella rättelsen kräver k män bakom jämförelsevärdet och visar en grupp först när k
kvinnor berörs. Tröskelmålet och den råa skillnaden i känsligheten visas bara när båda könen når k.

## 13. Kända luckor

- **Riktade rader räknas på de ursprungliga lönerna.** Det generella påslaget påverkar inte vem som är lägst eller var
  taket ligger, och två rader som träffar samma person lägger ihop sina påslag utan hänsyn till varandra.
- **Avrundningen kan gå över potten** (avsnitt 5). Det flaggas men korrigeras inte.
- **Den stegvisa planen avrundar inte per år.** Ett lönesteg gäller slutläget; åren däremellan kan ge löner som inte
  ligger på steget.
- **Tröskelmålet förutsätter att skillnaden ändras åt ett håll när lyftet ökar.** Halveringen hittar en gräns, inte
  nödvändigtvis den minsta, om skattningen inte gör det. Lyftet går till alla kvinnor, inte till grupperna med
  skillnad.

## 14. Vakter och referensfall

| Fil | Prövar |
|---|---|
| `tests/loneoversyn.test.js` | Potten, generellt påslag, urvalet med kön, lönegräns och `till`, fördelningarna `flat`, `lowest` och `target`, avrundningen, den råa skillnaden, förslagen, `*` för hela BAS-intervallet, grupper som går om varandra, kostnaden för kvinnodominerade grupper, lönespannet, individuell rättelse, marknaden, känsligheten och planen |
| `tests/loneoversyn-troskelmal.test.js` | Tröskelmålet: lägena, halveringen och kostnaden |
| `tests/loneoversyn-forslag-troskel.test.js` | Att förslagen följer den inställda tröskeln (ADR-69) |
| `tests/ktroskel-loneoversyn-summor.test.js`, `tests/ktroskel-loneoversyn-scenarier.test.js` | k-regeln i utfallet: maskerade grupper, den samlade raden, invikningen och att summorna inte röjer en liten grupp |
| `tests/kostnad.test.js` | Kostnadsformeln, också 0 månader och 0 % PO |
| `tests/referensfall.test.js` | Referensfallen nedan |

Referensfallen i `tests/fixtures/referensfall/`, med härledning steg för steg:

- `05-loneoversyn-lagst-forst.json`: lägst först utan tak.
- `06-loneoversyn-tak-vid-medianen.json`: lägst först med taket vid medianen, och pengar som blir över.
- `07-loneoversyn-generellt-avrundning.json`: generellt påslag 2,5 % och avrundning till 100 kr.
- `08-kostnad-per-ar.json` och `09-kostnad-per-ar-noll-manader.json`: kostnadsformeln.

Förslagen, planen, tröskelmålet och den individuella rättelsen har inget referensfall.
