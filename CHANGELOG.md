# Changelog — Öppen lönekartläggning

Datumformat: `ÅÅÅÅ.MM.DD` (CalVer). Varje version är ett bygge av en enda HTML-fil,
`dist/oppen-lonekartlaggning.html`, gjort med `npm run bundle`. Byggets SHA-256 står i
`dist/RELEASE.txt`. Varje versions avsnitt skrivs när versionen släpps, ur incheckningarna.

Från och med nästa version har varje version en rad per ändring som en användare märker. Detaljerna står i
referensen för området (`docs/README.md` listar dem) och i pull requesten.

## 2026.11.25

Lästa rad för rad före versionen: alla nio områden, i den djupa granskningen av hela repot.

- **Antalen i regressionskortet böjs.** Meningen under yrkesgruppssteget skrev «1 enkönade grupper bidrar inte»
  och kunde skriva «1 grupper»; orsaken när modellen faller tillbaka skrev «1 BAS-intervall är helt enkönade». Nu
  «1 enkönad grupp bidrar inte», «1 grupp» och «1 BAS-intervall har bara ett kön».

- **En liten grupp delar inte längre ett diagram i delbilder.** Ett liggande diagram med fler än femton kategorier
  delas i delbilder om femton. En kategori med bara grupper under minsta gruppstorleken räknades med i delningen, så
  att den exporterade bilden kunde få en tom sista del («16–16») som visade att en grupp till fanns. Nu räknas bara
  det som ritas.
- **Regnmolnets median och kvartiler räknas ur alla.** Med fler än 8 000 personer i ett lager ritas bara ett urval
  av punkterna; molnets kurva, median och kvartiler räknades då också ur urvalet. Nu räknas de ur alla, som i
  verktygstipset.
- **Mönstret `linjer` på staplar är vågrätt.** Det ritades i samma sneda vinkel som ränderna som markerar en liten
  grupp; nu går det inte att förväxla med dem.
- **Robusthetspanelen prövar kvinnotrösklar runt den inställda.** Panelen räknade alltid om vid 55, 60 och 65 %;
  med tröskeln 50 eller 70 prövades aldrig den egna inställningen. Nu prövas den inställda och 5 procentenheter på
  var sida.
- **Färdigchecken och sökningen böjer antalen.** «1 personer … i 1 grupper» och «1 slutsatser prövade» i
  Exportera, och «1 personer» under en träff i sökfältet, står nu i singular.
- **Bubbeldiagrammet följer kvinnotröskeln.** Strecken för könsdominans i Tabeller och egna vyer stod fast på 40 och
  60 %; nu följer de tröskeln som Likvärdigt arbete använder.
- **Årsjämförelsen skriver procentenheter.** Förändringen av en andel stod som «%-enheter» i panelen, rapporten och
  rapportunderlaget; nu står «procentenheter».
- **Löneläget utan ställningstagande kallar det inte referenspunkt.** Med bara jämförelsestatistik inläst hade
  överblickens bild en tom serie för ställningstagandet, och rubriken och beskrivningen talade om det som
  referenspunkt. Nu visar bilden statistiken och organisationen och säger det.
- **Personer att granska och tabellerna per AID och BAS böjer antalen.** Noten under avvikelsetabellen löd på
  skärmen «minst 1 kvinnor och 1 män»; nu står «både kvinnor och män». Noten om små grupper skrev «1 män»; nu «1 man».
- **Regressionskortet säger bara det modellen räknar bort.** Utan ålder i modellen stod det att skillnaden «kan
  inte motiveras med arbetar i andra BAS-intervall»; nu står «att kvinnor arbetar i andra BAS-intervall». Kortets
  inledning, analysen per BAS-intervall och BAS-effekterna i den tekniska specifikationen nämnde ålder också när
  modellen eller lönefilen saknar ålder; nu följer de modellen.
- **Symbolförklaringen i regressionskortet stämmer med tabellen.** Den sa att en säkerställd skillnad under 3 %
  saknar märke, men den får ögat; nu står också vad varningstriangeln betyder.
- **Livscykelns modelljämförelse namnger huvudmodellen som den är vald.** Kolumnen hette alltid «BAS-indikatorer,
  linjär ålder», också när ålder var vald bort.
- **Jämförelseexporten lovar inga färger.** Metadatabladet sa att positiva skillnader är gröna och negativa röda,
  men Excel-filen färgar inga celler.
- **Ålder & karriär säger rätt mått.** Diagrammets beskrivning sa att en lön som sjunker med åldern «ökar med −300
  kr per år»; nu står att den minskar. Åldersstrukturens rad om ett äldre eller yngre intervall talade om medelåldern
  och organisationssnittet, men talet är skillnaden mellan medianåldrar; nu säger texten det.
- **Gruppdossiern säger läget mot referensen med Prioriteringens ord.** Dossiern och dess textkopia skrev statusens
  kod («akut», «bevaka», «ok»); nu står samma namn som i Prioritering («Börja här», «Nära referens, under»).
- **Kopiera i dossiererna säger när inget kopierades.** En grupp eller ett intervall under tröskeln gav ingen
  synlig reaktion, och när webbläsaren nekade urklipp sades ändå att dossiern var kopierad. Nu sägs varför inget
  kopieras, och ett nekat urklipp går samma reservväg som tabellernas Kopiera.
- **Kostnaderna säger beräkningsperioden.** Kostnaden att nå referensen räknas för beräkningsperioden under
  Inställningar, men Prioriteringens diagram, åtgärdslistan, gruppdossiern, handlingsplanen och Word-utkastet kallade
  den en kostnad per år också när perioden var till exempel sex månader. Nu står perioden («kr/6 mån»); med tolv
  månader står det som förut.
- **Motiveringsförslagen i Prioritering hänvisar till Handlingsplan.** De bad användaren dokumentera i ett
  kommentarsfält som fliken inte har; bedömningen fylls i under Handlingsplan.
- **En kopierad tabell håller ihop också när ett namn har en radbrytning.** En AID-etikett med radbrytning eller tabb
  ur lönefilen delade tidigare raden när tabellen klistrades in, så att talen hamnade under fel rubrik; nu blir den
  mellanslag i urklippet, och formelskyddet gäller hela cellen.
- **Rensa all data tömmer också dossiererna och beräkningsbeviset.** Gruppdossiern, BAS-dossiern, beräkningsbeviset
  och dialogen för sakliga skäl behöll sina tal efter rensningen, och en öppen dossier stod kvar på skärmen efter
  rensningen vid inaktivitet. Nu stängs och töms de.
- **Den utskrivna handlingsplanen följer minsta gruppstorlek.** *Skriv ut mallen* kopierade fliken som den stod på
  skärmen, där inget maskeras, så att en förifylld rad för en grupp under tröskeln kom med på utskriften. Nu ritas
  utskriften i exportläget, som de andra exporterna.
- **ZIP-filen och konfigurationsfilen ligger inte kvar i minnet efter nedladdningen.** Länken till filen släpptes
  aldrig, så att innehållet fanns kvar i webbläsarens minne tills fliken stängdes, också efter Rensa all data. Nu
  går varje nedladdning samma väg och släpper länken efter en sekund.
- **En konfigurationsfil som inte går att läsa ändrar ingenting.** Tidigare kunde Prioriteringens trösklar, vikter
  och kostnadsinställningar ha bytts innan felet om rapportens tabeller visades.
- **Text i diagrammen syns bättre på mellantoner.** En siffra eller ett namn på en fyllning väljs nu vit eller mörk
  efter kontrasten, och där ingen av dem räcker, som på trädkartans lila ytor, får texten en kant. Ett långt namn i
  diagrammens förklaring kortas vid ett ordslut, så att skärmläsare och röststyrning hittar knappen på det som står.
- **Konfidensintervall och p-värden räknas med t-fördelningen också i stora underlag.** Tidigare användes
  normalfördelningen från 100 frihetsgrader, vilket gav en aning för smala intervall; nu blir de en aning bredare och
  p-värdena en aning större nära gränsen 0,05 (ADR-105).
- **Personer att granska säger hur många som saknar ålder.** Har lönefilen ålder prövas den som saknar ålder inte,
  och en not under listan säger nu hur många det gäller.
- **Kvantilregressionen säger till när en skattning inte stabiliserats.** Står könsskillnaden vid P10, medianen eller
  P90 fortfarande och rör sig efter 60 varv, säger kortet det under tabellen.
- **En grupp exakt på kvinnotröskeln klassas rätt.** Med lydelsen *Mer än 55 %* blev till exempel 11 kvinnor av 20
  kvinnodominerad, eftersom andelen räknades till en aning över 55 %; robusthetspanelen prövar alltid 55 %.
- **En tom ålder räknas inte som 0 år i likvärdigt arbete.** Den åldersjusterade skillnaden och medelåldern per par
  räknas nu bara på dem som har en ålder, som resten av verktyget.
- **Ett oväntat fel när lönefilen läses in låser inte längre skärmen.** Laddningsrutan försvinner, det tidigare
  underlaget står kvar och bannern för interna fel säger att något avbröts.
- **Systemförvaltaren har en egen flik, *För systemförvaltaren*, sist i menyn.** Där tas organisationsfilen fram i
  tre steg, och *Flytta till en ny version* flyttar paketet ur den gamla organisationsfilen till en ny version utan
  separat paketfil. Avser paketet ett tidigare år, säger filrutan det (för förra årets paket från och med 1 mars).
  Dokumenten beskriver hur IT kontrollerar en organisationsfil mot `RELEASE.txt` (ADR-49).
- **En höjd minsta gruppstorlek hindrar inte analysen på skärmen.** Golvet för skattningar (regression per
  BAS-intervall, Personer att granska, bootstrap-intervallen, livscykelmodellen med flera) är 10 på skärmen och följer
  en högre tröskel bara i det som lämnar verktyget. Där en grupp är för liten för att prövas säger texten var lönerna
  syns och att bedömningen dokumenteras under Sakliga skäl (ADR-103).
- **Minsta gruppstorlek är lägst 3.** Med tröskeln 2 kan två personer i en grupp räkna fram varandras lön. En
  konfigurationsfil med tröskeln 2 avvisas, och i ett organisationspaket används värdet inte (tröskeln eller golvet)
  och ger en varning (ADR-102).
- **Kolumnerna i lönefilen känns igen säkrare.** En rubrik som är exakt *Kön* eller *BAS-intervall* går före en som
  bara innehåller ordet, som *Kontor* eller *Basenhet*, och annars väljs den kortaste rubriken: *Ålder (år)* före
  *Anställningsålder* och *Grundlön* före *Lönetillägg*. Yrkets kolumner prövas i samma ordning som förut.
- **Ett par i likvärdigt arbete vars skillnad ligger exakt på den lägsta skillnaden räknas**, till exempel 29,0 % mot
  gränsen 29 %. Förut kunde avrundningen i datorn lägga det en aning under gränsen.
- **En Excelfil med en ensam cell långt ut i bladet låser inte längre verktyget.** Inläsningen läser bladet fram till
  den sista cellen med ett värde, inte hela det område som filen anger.
- **Rensningen vid inaktivitet räknar tiden på klockan, också medan datorn sover.** Förut stod tiden ofta still under
  sömnen, och en dator som öppnades efter flera timmar visade underlaget tills resten av tiden gått. Nu rensas den
  inom 15 sekunder, eller direkt när någon rör musen.

## 2026.11.22

- **Protokollet för gemensam lönebedömning redovisar alla grupper i lika arbete** i det nya bladet *2a. Lika arbete,
  alla grupper*: antal per kön och medianerna för varje grupp, samma blad som *Lika arbete AID x BAS* i Excel (ADR-93).
- **Stora lönefiler kraschar inte.** Inläsningen och Ålder & karriär slog i webbläsarens gräns vid omkring 125 000
  personer.
- **En åldersgräns och en regel för rimlig BAS och lön.** Förhandskontrollen och Underlagets kvalitet prövar samma
  gränser: ålder 16–75 år, varje bokstav som BAS-värde och lön från 15 000 till 250 000 kr. Varningen om ålder anger
  radnumren. Rimlighetspanelen i Underlagets kvalitet är borttagen; dess kontroller fanns redan i förhandskontrollen.
- **Ålder & karriär påstår inget som inte går att räkna.** När ett kön har en enda ålder i urvalet visas ingen lutning
  och ingen mening om hur fort lönen stiger. Livscykelns nyckeltal står i en rad, och tabellen per BAS-intervall och
  modelljämförelsen är hopfällda.
- **Rensningen vid inaktivitet** räknar sista minuten mot klockan, också i en flik som inte syns, och tidsväljaren
  fungerar hur dialogen än öppnas.
- **Datum i filnamn** tas i lokal tid, så att en export strax efter midnatt får rätt datum.
- **Lägsta lönekvintilen i Prioriteringen** räknas med verktygets percentil; gränsen blir lika eller något lägre.
- **Tabeller och diagram:** tabellhuvudena i Prioritering och Lika arbete bryts inte mitt i en rubrik, etiketter går
  fria från referenslinjerna, och nyckeltalen i Lika och Likvärdigt arbete heter som värdet de visar.
- **Tillgänglighet:** tillgängliga namn börjar med den synliga texten, och referensöverblickens tabeller går att rulla
  med tangentbordet.
- **Det stora demot:** var fjärde yrke har ett påslag kring noll i den påhittade statistiken.

## 2026.11.21

Den första posten i den nya formen: vad verktyget gör i den här versionen. Syfte, avgränsning och funktionsmål står
i `docs/utveckling/mal.md`, och besluten i `docs/utveckling/arkitekturbeslut.md`.

### Gränssnitt

- **En HTML-fil för datorn.** 16 flikar i grupperna Underlag, Kartläggning, Åtgärder, Rapport, Arbetet och Hjälp,
  med flikmallen (ADR-41), sidindex, sök och två lägen, vägledande och kompakt. Översikt börjar med *Kom igång*.
  Verktyget är byggt för datorskärm (ADR-82).
- **Lönefilen läses in med fyra obligatoriska och tre valfria fält** (ADR-64), med förhandskontroll,
  importprofiler och en bedömning av underlagets kvalitet där det svagaste kriteriet avgör (ADR-19).
- **Organisationspaketet** bär benämningar, grundinställningar, ställningstagande och jämförelsestatistik i en fil;
  verktyget har ingen inbyggd organisation (ADR-28, ADR-47). Två demon har påhittad data, det stora med 5 000
  personer i 100 yrken.

### Analys

- **Lika arbete.** En grupp är AID-koden i BAS-intervallet (ADR-89). Medianjämförelse inom gruppen och regression
  per BAS-intervall med valbar förklaringsmodell (ADR-56), Blinder-Oaxaca (ADR-53) och kvantilregression (ADR-63).
- **Status på statistisk signal.** En skillnad färgas på om den är säkerställd och på storleksgränsen tillsammans,
  aldrig på storleken ensam (ADR-59, ADR-71).
- **Likvärdigt arbete.** Kvinnodominerade AID-etiketter jämförs med alla som inte är kvinnodominerade (ADR-60,
  ADR-72), med arbetsvärderingspoäng bara mot organisationens egna (ADR-76) och *Lägre krav, högre lön* (ADR-25).
- **Lönestruktur och löneläget.** *Var uppstår löneskillnaden?* delar skillnaden i medellön (ADR-65, ADR-87),
  löneläget jämförs med ställningstagandet och jämförelsestatistiken (ADR-55) och med förra året (ADR-54).
- **Prioritering och löneöversyn.** Prioriteringen säger vad, löneöversynen hur (ADR-50). Prioriteringen mäter
  läget mot referensen med kostnaden att nå den (ADR-62).

### Exporter

- **Fyra exporter ur en rapportmodell** (ADR-40): Word-utkastet som riktig .docx (ADR-37), Excel-underlaget,
  PDF-rapporten och ZIP-filen med allt. Därtill EU-lönerapporten, protokollet för gemensam lönebedömning och
  handlingsplanen.
- **Diagramkärnan** ritar alla diagram och exporterar dem som PNG, SVG och diagramdata (ADR-39). Egna tabeller går in
  i rapporten som recept (ADR-52).

### Dataskydd

- **Inga nätverksanrop, ingen lagring, en fil utan server** (skydden S1–S3). Byggets CSP stänger all
  utgående trafik (ADR-9, ADR-30).
- **Minsta gruppstorlek i allt som lämnar verktyget**, standard 10, prövad för en fil i taget (ADR-51, ADR-70,
  ADR-92), med kompletterande undertryckning i tabellerna per BAS-intervall (ADR-83). Formler i CSV och urklipp
  neutraliseras (ADR-15).

### Utveckling

- **Beräkningskärnan i `src/lib/`** är rena funktioner med låsta tal, handräknade referensfall och statistiken prövad
  mot etablerade implementationer. `npm run kontroll` kör CI:s steg; releasen signeras med Sigstore och har en
  programvaruförteckning.
