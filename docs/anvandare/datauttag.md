# Datauttag: från lönesystem till giltig fil

En praktisk guide för att få ut rätt personalfil ur lönesystemet och läsa in den i
Öppen lönekartläggning. Verktyget är byggt för att vara **förlåtande** vid inläsning —
teckenkodning, avgränsare och talformat hanteras automatiskt — men filen måste
innehålla rätt **fält** och får **aldrig** innehålla identifierande personuppgifter.

> Stegen per lönesystem (avsnitt 4) är **inte verifierade mot systemen**; er
> systemförvaltare fyller i och bekräftar dem. Fält- och formatkraven är däremot verifierade
> mot verktygets kod och gäller som de står.

---

## 1. Fältkraven

Exportera en personallista (en rad per anställd) med dessa kolumner:

| Fält | Obligatoriskt | Vanliga källkolumnnamn (auto-matchas) |
|---|---|---|
| BAS-intervall | Ja | `BAS`, `BAS-intervall` |
| AID / yrke | Ja | `AID`, `Yrke`, `Yrkesgrupp`, `Befattning`, `AID-etikett` |
| Månadslön | Ja | `Månadslön`, `Lön` — heltidsomräknad fast månadslön (se avsnitt 1b) |
| Ålder *(eller födelseår)* | Ja | `Ålder`, `Alder` — innehåller cellerna födelseår räknas de om automatiskt |
| Kön | Ja | `Kön`, `Kon` (K/M, Kvinna/Man m.fl. tolkas automatiskt) |
| Poäng *(arbetsvärdering)* | Nej | `Poäng`, `Arbetsvärdering` — valfri krav-proxy för likvärdigt arbete |
| Ansvarskod *(AID)* | Nej | `Ansvarskod`, `AID-ansvar`, `Ansvarsnivå` — A, B, C, L, F, M, 1001 eller 1002, med valfri lokal sista position (t.ex. `C1`); flera koder per person skiljs med mellanslag |

- **Ansvarskoden** gör det möjligt att skilja chefer, funktionsansvariga och förstelärare
  från kollegerna med samma AID-etikett. Verktyget grupperar koderna i tre ansvarsgrupper
  (ledningsansvar, särskilt uppdrag, inget särskilt ansvar). Kolumnen läses bara om minst
  95 % av de ifyllda värdena är giltiga koder. **En kolumn som bara heter `Ansvar` läses
  aldrig** — i de flesta lönesystem är den ett kostnadsställe, inte AID:s ansvarskod.

- Verktyget **auto-matchar** vanliga kolumnnamn (versaler/gemener och å/ä/ö spelar ingen
  roll). Känns en kolumn inte igen finns en **kolumnmappnings-guide** i verktyget där du
  pekar ut rätt kolumn manuellt.
- **Ålder vs födelseår:** namnge kolumnen så den innehåller "ålder"/"alder". Om cellerna
  innehåller **födelseår** (ett tal 1900–[innevarande år − 15], t.ex. `1985`) räknar
  verktyget automatiskt om dem till ålder och noterar det i inläsningsrapporten
  ("ålder tolkad från födelseår").

## 1b. Lönedefinition

Alla ska ha samma lönebegrepp, annars jämför verktyget olika saker:

- **Fast månadslön omräknad till heltid.** En deltidsanställd på 75 % med 24 000 kr
  ska stå med 32 000 kr. Faktisk utbetald lön för deltidsanställda ger ett falskt
  lönegap, eftersom deltid är ojämnt fördelad mellan kvinnor och män.
- **Inga rörliga delar.** Tillägg, OB, jour, bonus och förmåner analyseras inte av
  verktyget och ska inte läggas in i lönen. De prövas i genomgången av bestämmelser och
  praxis (fliken Regler & praxis).
- Verktyget varnar vid inläsningen om många löner ligger under en rimlig heltidsnivå —
  det tyder oftast på att deltidslöner inte har räknats om.

## 2. Formatkrav (det verktyget faktiskt tål)

Verktyget läser in **`.csv`** och **`.xlsx`** (första bladet). Följande hanteras
**automatiskt** vid inläsning — du behöver alltså inte städa filen i förväg:

- **Teckenkodning:** UTF-8, UTF-8 med BOM, **Windows-1252** (svensk Excel-CSV sparar ofta
  så) och **UTF-16 LE/BE** (Excels "Unicode-text") detekteras automatiskt — å/ä/ö blir rätt.
- **Avgränsare:** semikolon `;`, komma `,`, **tabb** och lodstreck `|` detekteras automatiskt.
- **Försättsrader:** rader före rubrikraden ("Rapport uttagen …;;;;") tolereras — verktyget
  letar rubrikraden bland de första raderna och hoppar över preamblen.
- **Svenska talformat:** `32 500`, `32 500,50`, `32.500,50` och valutasuffix (`32 500 kr`)
  tolkas korrekt. Mellanslag, hårt mellanslag och apostrof som tusentalsavgränsare stryks.

**BAS-spann:** alla BAS-intervall ingår i analysen, även K och uppåt. Filen ska alltså
innehålla all tillsvidareanställd personal och behöver inte filtreras i förväg.

Detta **stöds inte** och ger tydligt besked:

- **Äldre `.xls`** (Excel 97–2003): avvisas med *"Filen är i äldre Excel-format (.xls).
  Spara om som .xlsx eller .csv och försök igen."* Öppna i Excel och spara om som `.xlsx`
  eller `.csv`.

## 3. Ta ALDRIG med (uppgiftsminimering enligt dataskyddsförordningen)

Ta **inte** med personnummer, namn eller e-post i uttaget. Verktyget läser bara in de
vitlistade fälten ovan, och det **avvisar hela filen** om det upptäcker en identifierande
kolumn — antingen på rubriken (t.ex. `Personnummer`, `PNR`, `Namn`, `Efternamn`,
`E-post`) eller på innehållet (i filens första 50 rader: minst tre celler i personnummer-
eller e-postformat, eller minst fem som ser ut som för- och efternamn).
Ta bort sådana kolumner redan i uttaget ur lönesystemet.

> Detta är ett medvetet dataminimeringsskydd (Privacy by Design). Se
> `riskanalys.md` för hela dataskyddsmodellen.

## 4. Per system — så här tar ni fram de fem fälten

> **Inte verifierat mot systemen.** Stegen nedan bygger på hur lönesystemen i kommuner och
> regioner brukar vara uppbyggda, inte på provkörningar. Rapportnamn, menyvägar och fältnamn
> skiljer sig mellan installationer, versioner och hur systemet är inställt hos er. Er
> systemförvaltare fyller i raderna markerade **[fylls i lokalt]**. Rättelser och steg för fler system
> är välkomna som bidrag (`CONTRIBUTING.md`).

### Gemensamt för alla system

De flesta kommuner och regioner lämnar varje år en personal- och lönestatistik till SKR. Det
uttaget har redan de flesta fält verktyget behöver — **AID-kod, heltidslön och ansvarskod** — per
anställning, och är därför den bästa utgångspunkten. Utgå från samma urval (månadsavlönade,
den mätmånad ni väljer) och gör så här:

| Fält i verktyget | Ta fram så här |
|---|---|
| **BAS-intervall** | Ofta ett lokalt fält på befattningen eller anställningen (arbetsvärderingens resultat). Finns det inte i lönesystemet: koppla på det i Excel från arbetsvärderingens lista per befattning, med AID-koden eller befattningskoden som nyckel. |
| **AID / yrke** | AID-koden (sex tecken) med etiketten, t.ex. `402010 Förskollärare`. Använd samma kod som i statistikuttaget. |
| **Månadslön** | **Heltidslön** (fast månadslön omräknad till heltid), inte utbetald lön. Finns bara faktisk lön och sysselsättningsgrad: räkna lön / sysselsättningsgrad i Excel (avsnitt 1b). |
| **Ålder** | Ta ut **födelseår** — inte personnummer. Verktyget räknar om födelseår till ålder. Går det bara att få personnumret: räkna fram födelseåret i Excel och **ta bort personnummerkolumnen innan filen sparas**. |
| **Kön** | Könsfältet (K/M eller Kvinna/Man). Juridiskt kön ur folkbokföringen är det vanliga. |
| **Ansvarskod** *(valfri)* | AID:s ansvarskod, samma som i statistikuttaget. Inte kolumnen *Ansvar* (kostnadsställe). |

Ta inte med namn, personnummer, anställningsnummer eller e-post. Har en person flera
anställningar: ta med huvudanställningen, så att varje person står på en rad.

### Heroma
- Uttag: utgå från rapporten eller uttaget som används för SKR:s personalstatistik, eller
  bygg en personallista i systemets rapportverktyg med fälten ovan. **[fylls i lokalt:
  rapportens namn och var den finns]**
- Heltidslön: **[fylls i lokalt: fältets namn]**
- Export: välj `.xlsx` eller `.csv`. **[fylls i lokalt: exportvalet]**

### Personec P
- Uttag: utgå från uttaget till SKR:s personalstatistik, eller en lista i systemets
  rapport- eller frågeverktyg med fälten ovan. **[fylls i lokalt: rapportens namn och var
  den finns]**
- Heltidslön: **[fylls i lokalt: fältets namn]**
- Export: välj `.xlsx` eller `.csv`. **[fylls i lokalt: exportvalet]**

### Visma
- Uttag: en personallista ur löne- eller HR-delen med fälten ovan; i en mindre organisation
  kan statistikuttaget saknas, och då behövs heltidslönen räknas fram (tabellen ovan).
  **[fylls i lokalt: produkt, rapportens namn och var den finns]**
- Export: välj `.xlsx` eller `.csv`. **[fylls i lokalt: exportvalet]**

### Annat system
Vilket lönesystem som helst fungerar: exportera valfri tabell/rapport som innehåller
fälten i avsnitt 1, som `.csv` eller `.xlsx`. Vet du inte kolumnformatet — **ladda ner
CSV-mallen i verktyget** (se avsnitt 6) och fyll den från er rapport.

### Kontrollera uttaget innan det läses in
- [ ] En rad per person, rubrikrad överst.
- [ ] Inga kolumner med namn, personnummer, anställningsnummer eller e-post.
- [ ] Lönen är heltidslön: en deltidsanställd har samma lönenivå som en heltidsanställd i
      samma befattning.
- [ ] BAS-intervall finns på alla rader som ska analyseras.
- [ ] Filen sparas på en behörighetsstyrd yta, inte i Hämtade filer.

## 5. Vanliga fel & verktygets besked

| Symptom | Vad det betyder | Så åtgärdar du |
|---|---|---|
| å/ä/ö blir konstiga tecken | Ovanlig teckenkodning | Alla vanliga kodningar hanteras automatiskt — kontrollera inläsningsrapporten; kvarstår felet, spara om filen som UTF-8 CSV |
| "0 rader inlästa" / tomt resultat | Rubrikraden eller kolumnnamnen känns inte igen | Öppna **kolumnmappnings-guiden** och peka ut rätt kolumn, eller döp om rubrikerna enligt avsnitt 1 |
| Filen avvisas direkt | En kolumn med personnummer, namn eller e-post upptäcktes | Ta bort den identifierande kolumnen ur uttaget och läs in igen (avsnitt 3) |
| Åldern ser fel ut | Kolumnen innehöll födelseår | Verktyget räknar om födelseår till ålder automatiskt — verifiera antalet i inläsnings-/audit-panelen |
| Många rader uteslutna | Saknad BAS, lön = 0, eller tomt/okänt värde i könskolumnen | Läs inläsningsrapporten under Underlagets kvalitet — den visar hur många rader som föll bort och varför; rätta i källfilen och läs om |

Inläsningsrapporten visar alltid vilken **teckenkodning** och **avgränsare** som
upptäcktes samt om försättsrader hoppades över — använd den för att bekräfta att filen
lästes som du förväntade dig.

## 6. CSV-mallen

I verktyget, på Översikt-fliken i uppladdningsområdet, finns knappen
**"📥 Ladda ner CSV-mall"**. Den laddar ner `strukturdata_mall.csv` med rätt
kolumnrubriker (`BAS-intervall;AID;Manadslon;Alder;Kon;Poang`) och tre
exempelrader. Öppna den i Excel, ersätt exempelraderna med er data och spara — så vet du
att kolumnformatet stämmer.

---

> Se även `korguide.md` (hela arbetsflödet från datauttag till dokumentation) och
> `riskanalys.md` (dataskydd). Distribueras tillsammans med
> `oppen-lonekartlaggning.html`.
