# Prioriteringsmodellen — referens

Prioriteringen rangordnar grupperna efter hur långt deras medianlön ligger från en referens: ställningstagandet eller
jämförelsestatistiken. Varje grupp får en avvikelse, ett läge (status), tre delpoäng, ett sammanvägt index och en
kostnad att nå referensen. Det här dokumentet bär den **gällande lydelsen** för modellen. Koden är sanningen; där
dokumentet och koden skiljer sig är det dokumentet som ska rättas.

**Modellen är verktygets egen.** Trösklarna, taken, vikterna, riktningsvikten, bristmultiplikatorn och villkoret för
snabb vinst är verktygets egna val, inte hämtade från någon extern källa. Modellen säger var en genomgång kan börja,
inte vad som är rätt lön eller vad organisationen måste göra.

Varför Prioriteringen och Löneöversynen är två flikar står i ADR-50, orden för lägena i ADR-62, och att
könsskillnaden här inte prövas mot uppmärksamhetstrappan i ADR-71 ([`arkitekturbeslut.md`](arkitekturbeslut.md)). Minsta gruppstorlek står i [`k-troskeln.md`](k-troskeln.md).
Varje beräkning har sin rad i spårbarhetsmatrisen, [`sparbarhet.md`](sparbarhet.md).

| Del | Fil |
|---|---|
| Modellen: grupperna, avvikelsen, status, delpoäng, index, snabb vinst, kostnad; konstanterna | `src/lib/prioritering.js` (`prioritera`, `prioIndex`, `prioKonstanter`, `arsbeloppMening`) |
| Kostnadsformeln | `src/lib/kostnad.js` (`kostnadPerAr`) |
| Adaptern: väljer referensen och läser inställningarna | `src/app/55-prioritering.js` (`computePrioritization`) |
| Orden för lägena | `src/app/55-prioritering.js` (`PRIO_STATUS_INFO`) |
| Standardvärdena för trösklar, vikter och kostnad | `src/lib/prioritering.js` (`PRIO_CONFIG_DEFAULTS`, `PRIO_WEIGHTS_DEFAULTS`), `src/lib/kostnad.js` (`COST_DEFAULTS`) |
| Inställningarnas gränser | `src/lib/installningsgranser.js` (`PRIO_TROSKEL_GRANS`, `PRIO_VIKT_GRANS`) |

## 1. Grupperna

En grupp är alla rader med samma AID-kod och samma BAS-intervall (nyckeln `aid|bas`), som i jämförelsestatistiken
(`jamforelseRader`), gruppdossiern och resten av verktyget (ADR-89). AID-koden tas ur de inledande siffrorna i fältet för AID-etikett (`aidAvYrke`);
saknas siffror används hela texten. Två texter med samma kod ("207011 Handläggare" och "207011 Handläggare, natt") är
alltså en grupp. Gruppens namn (`yrke`) är texten som står på flest av gruppens rader; står två texter på lika många
rader gäller den som kommer först i lönefilen (`namnrader` i `src/lib/aid.js`, ADR-89). Samma regel ger namnet i alla
analyser, så samma grupp heter samma sak i prioriteringen, Lika arbete, jämförelsen och resten av verktyget. De andra
texterna syns inte i prioriteringen. Radernas fält `yrke`, `aid` och `bas` behåller sin betydelse (texten i fältet,
koden och intervallet), och vyer som visar texterna som de står i filen, Löneöversikten, sökningen och
punktdiagrammets färger per AID-etikett, grupperar inte på koden. En grupp med färre än k
personer tas inte med. Könens medianer räknas bara för ett kön med minst k personer; annars är könsmedianen och
könsskillnaden null och gruppen finns kvar med sin samlade median.

Referensen hämtas per AID-kod och BAS-intervall:

- **Ställningstagandet:** medianen i den rad som `policyFor(aid, bas)` ger.
- **Jämförelsestatistiken:** medianen i den rad som `statistikFor` ger: samma AID och BAS, annars samma AID utan BAS.

En grupp utan referens, eller med referensmedianen 0, tas inte med.

## 2. Avvikelsen mot referensen

    diffKr  = gruppens median − referensens median
    diffPct = diffKr × 100 / referensens median

Könsskillnaden skrivs på samma sätt:

    gapPct = (kvinnornas median − männens median) × 100 / männens median

**Varför formeln skrivs så.** Den vanliga formen (median / referens − 1) × 100 avrundar två gånger: först kvoten,
sedan subtraktionen. 38 000 mot 40 000 ger då −5,000000000000004, alltså en aning under −5, och gruppen skulle hamna
under en gräns på −5 fast avvikelsen är exakt −5 %. Med löner i hela kronor (en median kan bli en halv krona) är
kronskillnaden gånger 100 exakt, så divisionen är den enda avrundningen. En avvikelse som är exakt en procentsats blir
då exakt den, och en grupp exakt på en gräns hamnar aldrig på fel sida om den. Därför behövs ingen tolerans mot
trösklarna i avsnitt 3.

## 3. Lägena

Lägena prövas i tur och ordning, med **stränga** olikheter:

| Läge (nyckel) | Ord i fliken | Villkor |
|---|---|---|
| `akut` | Börja här | diffPct < åtgärdsgränsen och gruppen har minst `akutMinN` personer |
| `atgard` | Under referens, liten grupp | diffPct < åtgärdsgränsen |
| `bevaka` | Nära referens, under | diffPct < bevakningsgränsen |
| `analysera` | Över referens | diffPct > analysgränsen |
| `ok` | Nära referens | annars |

Med standardvärdena (åtgärd −5 %, bevaka −2 %, analysera +5 %, `akutMinN` 10) är exakt −5 % alltså *Nära referens,
under*, exakt −2 % *Nära referens* och exakt +5 % *Nära referens*.

## 4. Delpoängen och indexet

Tre delpoäng på skalan 0–100, var och en med ett tak:

    avvikelse    = min(30, |diffPct|) / 30 × 100          (AVVIKELSE_TAK)
    volym        = min(50, n) / 50 × 100                  (VOLYM_TAK)
    jämställdhet = min(15, |gapPct|) / 15 × 100           (GAP_TAK; 0 när gapPct är null)

**Riktningsvikten** är 1,0 när gruppen ligger under referensen (diffPct < 0) och 0,5 annars (`RIKTNING_UNDER`,
`RIKTNING_OVER`). En grupp exakt på referensen får alltså 0,5.

**Bristmultiplikatorn** är 1,2 för en AID-kod som användaren markerat som bristyrke, annars 1,0
(`BRIST_MULTIPLIKATOR`).

**Indexet** (`prioIndex`):

    vikt_summa = max(1, w_avvikelse + w_volym + w_jämställdhet)
    index = brist × riktning × (avvikelse × w_avvikelse + volym × w_volym + jämställdhet × w_jämställdhet) / vikt_summa

Vikterna normaliseras alltså till summan 1. Indexet ligger mellan 0 och 100 före bristmultiplikatorn, och listan
sorteras på indexet, störst först.

## 5. Snabb vinst och kostnaden att nå referensen

**Kostnad per person** är |diffKr| kronor per månad när gruppen ligger under referensen, annars 0. Det är vad det
kostar att lyfta gruppens median till referensen, räknat som om varje person lyftes lika mycket.

**Kostnaden att nå referensen** är `kostnadPerAr(diffKr, n)`:

    |diffKr| × månader × (1 + PO / 100) × n

för en grupp under referensen, och samma formel som *överlönekostnad* för en grupp över. Månader och PO kommer ur
kostnadsinställningarna (standard 12 månader och 40 %, ADR-84). Med en annan beräkningsperiod än 12 månader gäller
beloppet perioden, inte ett år.

**Snabb vinst** markeras när alla fyra villkoren gäller, som i koden:

    kostnad per person > 0  och  kostnad per person < 1 500 kr  och  |diffPct| > 3  och  n ≥ 5

Antalet har bara en nedre gräns (`SNABB_VINST_MIN_N`); en stor grupp kan vara en snabb vinst.

**Kostnadskurvan** (`kostnadskurva`) tar grupperna med en kostnad över 0, störst först, och räknar den kumulativa
andelen av den sammanlagda kostnaden för de 40 första. Fliken säger hur många grupper som tillsammans når 50 % och
80 %; når de 40 första inte dit är svaret alla grupper. Diagrammet ritar de 15 första, och en mening under det säger
vad resten står för. Nyckeltalen överst (`prioNyckeltal`) räknar grupperna per läge och den sammanlagda kostnaden.

## 6. Räkneexemplet per år

`arsbeloppMening` skriver en mening för en grupp där kvinnornas median ligger lägre än männens. Skillnaden avrundas
till hundratal; under 100 kr ges ingen mening. Beloppet är `kostnadPerAr(skillnad, antal kvinnor)` avrundat till
tusental. Meningen säger att det är ett räkneexempel och inte en kostnadsbedömning. Den används i rapportunderlaget
och i gruppdossiern, och anroparen skickar bara medianer som får redovisas.

## 7. Inställningar och fasta tal

| Vad | Standard | Var det ändras | Gränser |
|---|---|---|---|
| Åtgärdsgränsen | −5 % | Inställningar, konfigurationsfilen | −50 till 0 |
| Minsta antal för *Börja här* (`akutMinN`) | 10 | Inställningar, konfigurationsfilen | 1 till 500 |
| Bevakningsgränsen | −2 % | Inställningar, konfigurationsfilen | −50 till 0 |
| Analysgränsen | +5 % | Inställningar, konfigurationsfilen | 0 till 50 |
| Vikterna avvikelse, volym, jämställdhet | 50, 30, 20 | Inställningar, konfigurationsfilen | 0 till 100 var |
| Beräkningsperiod | 12 månader | Inställningar, konfigurationsfilen, organisationspaketet | fältet 3, 6, 9, 12; filen 1–60 |
| PO-påslag | 40 % | Inställningar, konfigurationsfilen, organisationspaketet | 0 till 100 |
| Bristyrken | inga | kryssrutan per grupp i fliken | – |

Fasta, i koden (`prioKonstanter()` ger dem till appens bevisruta):

| Konstant | Värde |
|---|---|
| `AVVIKELSE_TAK` | 30 % |
| `VOLYM_TAK` | 50 personer |
| `GAP_TAK` | 15 % |
| `RIKTNING_UNDER`, `RIKTNING_OVER` | 1,0 och 0,5 |
| `BRIST_MULTIPLIKATOR` | 1,2 |
| `SNABB_VINST_KR`, `SNABB_VINST_AVVIKELSE`, `SNABB_VINST_MIN_N` | 1 500 kr, 3 %, 5 personer |

Trösklarna och vikterna står inte i organisationspaketet.

## 8. Minsta gruppstorlek

`computePrioritization` skickar `kTroskel()`: 1 på skärmen och den inställda tröskeln när något lämnar verktyget
([`k-troskeln.md`](k-troskeln.md) §1). Samma tröskel gäller gruppen och vartdera könet. Lägena och indexet bygger på
gruppens samlade median, som redovisas när gruppen når tröskeln.

## 9. Kända luckor

- **Exakt på referensen räknas som över.** Riktningsvikten 1,0 kräver diffPct < 0, så 0 % får 0,5.
- **En dold könsskillnad ger noll i jämställdhetspoäng.** När ett kön har färre än k personer är gapPct null och
  delpoängen 0; gruppen rangordnas då som om könen hade samma median.
- **Trösklarnas ordning prövas inte.** Varje tröskel har sina gränser, men ingenting kräver att åtgärdsgränsen ligger
  under bevakningsgränsen. Står den över blir *Nära referens, under* aldrig utfallet.
- **Kostnaden gäller beräkningsperioden.** `kostnadPerAr` multiplicerar med periodens månader, så namnet och ordet
  *per år* stämmer bara när perioden är 12 månader.

## 10. Vakter och referensfall

| Fil | Prövar |
|---|---|
| `tests/prioritering.test.js` | Indexet med normaliserade vikter och viktsumman 0; grupperna (en AID-kod med två texter är en grupp, samma grupper som `jamforelseRader`), k-regeln och grupper utan referens; avvikelsen, kostnaden och lägena, också exakt på varje gräns och med en referens från 20 000 till 80 000 i steg om 100; könsmedianerna; snabb vinst, bristyrke och sorteringen |
| `tests/kostnad.test.js` | Kostnadsformeln |
| `tests/referensfall.test.js` | Referensfallen nedan |

Referensfallen i `tests/fixtures/referensfall/`, med härledning steg för steg:

- `10-prioritering-en-grupp.json`: en grupp med 12 personer mot referensen 30 000. Avvikelsen −5,8333 %, kostnaden
  352 800 kr, delpoängen 19,4444, 24 och 45,5840, indexet 26,039 och läget *Under referens, liten grupp*, eftersom
  `akutMinN` är 20 i fallet.
- `11-prioindex-vikter.json`: indexet med vikterna 2, 1 och 1, riktningsvikten 0,5 och bristmultiplikatorn 1,2 ger 36.
