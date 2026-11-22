# Körguide: genomför en lönekartläggning med verktyget

En praktisk guide steg för steg för dig som genomför kartläggningen, från datauttag till färdig
dokumentation. Verktyget gör **analysen och planeringen**. De kvalitativa bedömningarna och
besluten gör och äger arbetsgivaren.

> **Tidsåtgång:** en första körning tar typiskt en halv till en dag, inklusive de
> kvalitativa bedömningarna i Regler & praxis och facklig samverkan. Själva analysen är klar på
> minuter när filen är inläst.

---

## 0. Förutsättningar

- **Ansvar:** Verktyget är ett stöd för arbetsgivarens egen lönekartläggning. Användaren ansvarar för hur verktyget används, för tolkningen av resultaten och för den juridiska bedömningen. Verktyget är inte juridiskt granskat.
- En dator med en modern webbläsare: **Chrome/Edge, Firefox eller Safari 16.4+**.
  Verktyget är byggt för datorskärm; surfplatta och mobil stöds inte.
- Filen `oppen-lonekartlaggning.html` — eller din **organisationsfil**, där systemägaren bakat in
  organisationspaketet (`organisationspaket.md` avsnitt 3b) — öppnad **lokalt** (dubbelklick/`file://`
  eller från en intern, behörighetsstyrd filyta). Ingen installation, ingen internetanslutning behövs.
- **Verifiera filens äkthet** innan du läser in verklig lönedata. Den som laddar ner en version
  (ofta IT eller systemägaren) verifierar **signaturen** med cosign. Signaturen prövas mot
  Sigstore-paketet (`oppen-lonekartlaggning.html.sigstore.json`) som ligger bredvid filen på
  versionens releasesida. Kommandot är detsamma i Windows (PowerShell, `cosign.exe`) och Linux/Mac:
  `cosign verify-blob oppen-lonekartlaggning.html --bundle oppen-lonekartlaggning.html.sigstore.json --certificate-identity-regexp "^https://github\.com/janssonfelix/oppen-lonekartlaggning/\.github/workflows/release\.yml@refs/tags/v" --certificate-oidc-issuer https://token.actions.githubusercontent.com`
  (se `SECURITY.md`). Svaret ska vara `Verified OK`.
  **Kan ni inte köra cosign: kontrollsumman i RELEASE.txt skyddar mot en skadad eller förväxlad fil.**
  Den som får filen internt jämför också dess **SHA-256** med värdet i `RELEASE.txt`. Windows
  (PowerShell): `Get-FileHash .\oppen-lonekartlaggning.html -Algorithm SHA256` · Linux/Mac:
  `sha256sum oppen-lonekartlaggning.html` (på en Mac utan `sha256sum`: `shasum -a 256 oppen-lonekartlaggning.html`).
  Kontrollsumman visar bara att filen inte skadats eller förväxlats; att den är äkta visar signaturen.
- **Dataskydd:** all bearbetning sker i webbläsarens minne — inget skickas, inget
  sparas på disk. Det enda som lämnar verktyget är **de filer du själv exporterar**.
  Förvara dem på behörighetsstyrd disk och skicka dem aldrig via okrypterad e-post.

## 1. (Valfritt men rekommenderat) Lär dig verktyget med demodata

1. Välj ett demo i startytan **Kom igång** på Översikt, under *Ingen fil till hands?*: "prova med demodata,
   **stort demo** eller **litet demo**".
   Samma två val, med samma ord, finns i lönefilskortet i **Filer och kvalitet**:
   - **stort demo (5 000 personer)**: en påhittad stor organisation med 100 AID-etiketter och BAS-intervall A–K,
     med påhittad jämförelsestatistik och ett lönepolitiskt ställningstagande räknat ur demots löner. Här syns
     verktyget i verklig storlek: inlagda löneskillnader i några AID-etiketter, ett par för likvärdigt arbete, och små
     grupper som maskeras i exporterna. Inläsningen tar några sekunder.
   - **litet demo**: 260 påhittade personer i fem BAS-intervall, snabbt att bläddra i.
     Det är samma underlag som självdiagnostiken bygger på.

   Adressen kan också starta demot direkt: `?demo=stor` för det stora och `?demo=1` för det lilla.
2. Bläddra igenom flikarna och exporterna med syntetisk exempeldata — ingen verklig
   lönedata behövs för att utvärdera. Allt märks tydligt **DEMODATA**, och bannern överst säger
   när det är det stora demot.
3. Klicka **"Avsluta demo / rensa"** innan du laddar in din skarpa data.
   (Med en egen lönefil inläst finns **"Rensa all data"** under **Inställningar**, rubriken *Rensa*.)

## 2. Exportera och förbered data ur lönesystemet

Exportera en lönefil (CSV eller XLSX) med dessa kolumner:

| Fält | Obligatoriskt | Kommentar |
|---|---|---|
| BAS-intervall | Ja | Kravnivå/svårighetsgrupp |
| AID-etikett | Ja | AID-kod och etikettnamn. Kolumnen heter i lönefilen ofta *Yrke* eller *Befattning* |
| Månadslön | Ja | **Heltidsomräknad** fast månadslön — se *Lönedefinition* nedan |
| Ålder *(eller födelseår)* | Nej, rekommenderad | Födelseår tolkas automatiskt till ålder. Utan ålder körs analysen utan åldersjustering och Ålder & karriär visas inte |
| Kön | Ja | K/M, Kvinna/Man m.fl. tolkas automatiskt |
| Poäng *(arbetsvärdering)* | Nej | Valfri kolumn för likvärdigt arbete över BAS-gränser |
| Ansvarskod *(AID)* | Nej | Valfri kolumn: A, B, C, L (ledningsansvar), F, M, 1001, 1002 (särskilt uppdrag). Kolumnen *Ansvar* (ofta ett kostnadsställe) läses aldrig |

- **Lönedefinition:** använd samma lönebegrepp för alla — den fasta månadslönen
  omräknad till heltid. En deltidsanställds faktiska lön jämförd med en heltidsanställds
  ger en falsk löneskillnad. Rörliga delar (tillägg, OB, bonus, förmåner) analyseras inte
  av verktyget och ska inte läggas in i lönen; de prövas i genomgången av bestämmelser
  och praxis. Verktyget varnar om många löner ligger under en rimlig heltidsnivå.
- **Teckenkodning** (UTF-8 / Windows-1252 / UTF-16) och avgränsare hanteras
  automatiskt — å/ä/ö blir rätt.
- **All personal ingår.** Alla BAS-intervall analyseras, även chefsnivåerna (K och
  uppåt). Små intervall skyddas av minsta gruppstorlek vid export.
- **Ta INTE med personnummer, namn eller e-post.** Verktyget avvisar filer som
  innehåller sådana kolumner (uppgiftsminimering enligt dataskyddsförordningen).
  Fältet för AID-etikett ska bara bära kod och etikett: verktyget maskerar inte namn som står där, utan varnar
  (se [`dataskydd.md`](../dataskydd/dataskydd.md#vad-skydden-gör-och-inte-gör)).
- **Systemspecifika uttagssteg** (Personec P, Heroma, Visma m.fl.) samt fullständiga
  format- och felsökningsdetaljer: se `datauttag.md`.

## 3. Läs in och kvalitetssäkra underlaget

1. Öppna fliken **Filer och kvalitet** (menyns första grupp, *1 · Underlag*; raden om organisationspaketet i
   startytan *Kom igång* på Översikt leder dit). Läs in **organisationspaketet** om organisationen har ett — det är
   **steg 1**, överst i fliken; *Vad är ett organisationspaket?* under knappen förklarar det. Paketet innehåller
   organisationens ställningstagande,
   jämförelsestatistik och benämningar (se `organisationspaket.md`), så rutorna *Referens* och
   *Jämförelsestatistik* fylls i av sig själva. Dra sedan in eller välj lönefilen i den
   **obligatoriska** rutan (steg 2), det första och bredaste kortet. Har organisationen inget paket kan du läsa in
   lönefilen direkt i startytan på Översikt: ytan *Läs in lönefilen* där använder samma inläsning som kortet, och
   lästes filen inte in visas kortet med beskedet.
   **Minsta gruppstorlek för redovisning:** fältet ligger under **Inställningar** i sidhuvudet (värdet
   *Minsta gruppstorlek* i flikarnas översta rad är en länk dit). På skärmen visas alla grupper. Gränsen gäller
   det som lämnar verktyget (Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder, rapportunderlaget). Standardvärdet är 10: lönemått för grupper med färre personer än så redovisas
   inte där. Antal och andelar, också per kön, kan däremot stå i exporterna för små grupper, till exempel antalet
   kvinnor och män i en AID-etikett med få personer; bedöm själv vad som kan spridas. Du kan ändra värdet till ett heltal från 2 (högre skärper skyddet). Ett värde under 10
   kräver att du bekräftar och visas som en varning överst på alla flikar. Värdet står i
   metodbilagan och i exporterad data. Under 10 står dessutom meningen *Tröskeln är sänkt från
   standardvärdet 10.* på det som kan spridas för sig, till exempel diagrambilder, kopierade tabeller
   och rapporter. Alla flikar räknas om när värdet ändras.
   Knappen **Som i exporten** i sidhuvudet visar flikarna som i det som lämnar verktyget, alltså utan lönemått
   för grupper under minsta gruppstorlek. En banner och en streckad ram runt innehållet visas tills du klickar
   *Visa skärmen igen*. Värdet sparas inte mellan gånger men följer med i konfigurationsfilen. En
   konfigurationsfil utan värdet ändrar det inte. *Återställ till 10* sätter tillbaka
   standardvärdet.
   Tröskeln styr också några tal på skärmen: medianlön per kön, den råa löneskillnaden och regressionens
   ojusterade steg ("Endast kön", med den förklarade andelen). De visas bara när både kvinnor och män är minst så många som tröskeln. Annars står ett
   streck eller en förklaring. Den justerade löneskillnaden (regressionen i Lönestruktur och talet i Lika
   arbetes nyckeltal) visas från regressionens eget fasta golv, 5 av varje kön. I Ålder & karriär
   gäller samma regel för löneskillnaderna, lutningen, trendlinjerna och lådorna per kön. Punkterna per
   person i spridningsdiagrammen visas alltid.
2. Känns en kolumn inte igen automatiskt? Använd **kolumnmappnings-guiden** och peka
   ut rätt kolumn. När filen är inläst visar rutan filnamnet; där kan du **namnge
   organisationen** (namnet syns i diagram, tabeller och exporter) och byta fil. Ge också
   jämförelsestatistiken ett namn i dess ruta.
   Läs sedan **Förhandskontroll av lönefilen**, avsnittet direkt under filrutorna. Det visar hur verktyget tolkade
   de tio första raderna, med filens värde och tolkningen i samma cell (till exempel *1978 tolkat som 48 år*). Det
   visar också hur många rader som används och varför andra föll bort, värdena per kolumn och vilken importprofil
   som kände igen filen. Avsnittet är utfällt när något bör kontrolleras: en medianlön som ser ut som årslön eller
   timlön, åldrar utanför 16–75 år, okända BAS- eller kön-värden, eller ett fält för AID-etikett som ser ut att
   innehålla personnamn (rensa då fältet i uttaget och läs in filen igen). Varningarna står också i Att göra.
   Vill du granska tolkningen innan filen används kryssar du i **Stoppa och visa förhandskontrollen innan
   inläsning** i Inställningar. Då väntar filen på *Läs in*, och *Avbryt* lämnar det tidigare underlaget orört.
   Kolumnmappningen visas när filen är inläst. Avsnittet namnger filen det beskriver, också en fil där ingen rad
   gick att använda. Raderna visas bara på skärmen.
3. Läs avsnittet **Underlagets kvalitet** i samma flik. Fem kriterier — jämförbarhet, statistisk
   styrka, fullständighet, rimlighet och modell — får OK, Varning eller Kritisk, och
   underlaget får samma status som det svagaste. Under kriterierna står detaljerna:
   hur många rader som uteslöts och varför. Sist i panelen listas **extremvärden**
   (enskilda löner som avviker kraftigt inom sitt BAS-intervall) — ofta registerfel. Ser
   något fel ut, rätta i källfilen och ladda om.
4. *(Om du inte har ett paket)* Läs in ditt **lönepolitiska ställningstagande**
   (P10/median/P90 per BAS) och ge det ett namn. Prioritering, Löneläget och statusrutan
   i Att göra jämför mot det. Utan ställningstagande visar de vad som behöver läsas in.
   Läs även in **jämförelsestatistik** om du har den. Fliken **Löneläget** går att öppna när underlaget och minst
   en referens är inlästa (se avsnitt 4). Den visar överblicken mot båda, avsnittet mot ställningstagandet och
   avsnittet mot statistiken. I avsnittet mot statistiken står organisationens P10, median och P90 bredvid
   statistikens för varje AID-etikett. Två diagram visar var du ligger i marknadens spann och vilka AID-etiketter som avviker
   mest. Arbetsvärderingspoäng laddas **inte** upp separat. Lägg till kolumnen **Poäng** i lönefilen (se avsnitt 2).
5. Gå igenom kortet **Att göra** på Översikt. Överst står status mot de fyra lagkraven,
   därunder **Börja här** med de tre viktigaste punkterna och sist alla punkter per
   kategori. Bocka av en punkt när du hanterat den; listan kan exporteras som CSV och
   bockarna följer med i konfigurationsfilen. Raden överst på Översikt säger vad som är inläst, och knappen
   **Filer och kvalitet** i den leder tillbaka till filrutorna.

## 4. Genomför kartläggningen — flik för flik

Menyn följer rapportens ordning, och stegen på Översikt (*Kartläggningens steg* under *Fördjupning*) har samma
faser. Listan har nio steg; verktyget kan se fem av dem och säger hur många som är klara (*Klara: 1 av 5 steg som
verktyget kan se*). De övriga fyra är manuella steg.

| Grupp | Flikar |
|---|---|
| **1 · Underlag** | Översikt, Filer och kvalitet, Regler & praxis |
| **2 · Kartläggning** | Löneläget, Lika arbete, Likvärdigt arbete, Lönestruktur, Ålder & karriär |
| **3 · Åtgärder** | Prioritering, Löneöversyn, Handlingsplan |
| **4 · Rapport** | Rapporttext, Exportera, Tabeller och egna vyer |
| **Arbetet** | Spara och jämför år |
| **Hjälp** | Om verktyget |

Löneläget och Ålder & karriär är fördjupning, inget lagkrav; det står i flikens verktygstips och inledning. Utan
lönefil går Översikt, Filer och kvalitet, Regler & praxis, Handlingsplan, Exportera, Spara och jämför år och Om
verktyget att öppna. De andra flikarna är låsta; ett klick på en låst flik öppnar Filer och kvalitet med
lönefilskortet framme.

**Alla flikar är uppbyggda på samma sätt.** Överst står en rad som säger vad fliken svarar på (*Visa mer* fäller ut
hela förklaringen). Sedan kommer urvalet och **nyckeltalen** i en rad, och därefter flikens huvudresultat. Under
rubriken **Fördjupning** ligger resten i avsnitt som fälls ut vid behov. Varje avsnitt säger sitt viktigaste tal i
rubrikraden, också när det är hopfällt.

- **Inställningar** (sidhuvudet) har minsta gruppstorlek, kommun eller region, **lönemånaden**, PO-påslag och
  beräkningsperiod och **Prioriteringens trösklar och viktning** (se punkt 7 nedan). PO-påslaget är 40 % som
  standardantagande; ange organisationens eget där eller i organisationspaketet. Lönemånaden skrivs ovanför
  tabellerna per AID-kod och BAS-intervall, och ett tomt fält skrivs ut som *inte angiven*. Där väljer du också
  mellan **vägledande läge** (förklaringarna syns) och **kompakt läge** (förklaringarna är undanfällda, för den
  som kan verktyget).
- Flikarna från Regler & praxis till Rapporttext avslutas med en **"Klar här? Nästa steg"-rad** som följer menyn:
  Regler & praxis, Löneläget, Lika arbete, Likvärdigt arbete, Lönestruktur, Ålder & karriär, Prioritering,
  Löneöversyn, Handlingsplan, Rapporttext och Exportera. Löneläget och Ålder & karriär hoppas över när de är låsta.
  Utan lönefil står raden bara i Regler & praxis och Handlingsplan. Leder den då till en låst flik öppnas Filer
  och kvalitet med lönefilskortet. Använd **"Visa beräkningen"**-knapparna vid resultaten för att se hur en siffra
  räknats fram.
- **Tabeller med grafik i raden:** där ett tal jämförs mot lika lön (100 %) är talet också ritat i raden. Det
  ritas som en punkt mot en linje, med ett streck för osäkerheten. Når strecket fram till linjen kan skillnaden
  bero på slumpen.

### Hitta rätt: sök och sidindex

- **Sök** (fältet i sidhuvudet, snedstreck eller Ctrl+K) hittar en AID-etikett eller ett BAS-intervall och markerar det i alla
  diagram och tabeller. Ett klick på en grupp i ett diagram eller en tabellrad gör samma sak; Escape tar bort markeringen.
  Sökningen hittar också funktioner, också innan lönefilen är inläst: flikarnas avsnitt (*ögonblicksbild*, *förra
  året*, *regression*), exporterna och fälten i Inställningar (*PO-påslag*, *minsta gruppstorlek*). Det vanliga
  ordet räcker, också när avsnittet heter något annat: *regression* hittar *Vad blir kvar av löneskillnaden?* i
  Lönestruktur. Träfflistan har grupperna först och funktionerna under rubriken *Funktioner*, med fliken de står i.
  Ett val fäller ut avsnittet och flyttar fokus dit, eller öppnar Inställningar med fokus i fältet. Ett avsnitt i en
  flik som kräver lönefilen säger *kräver lönefil* och leder till Filer och kvalitet.
- **På den här sidan** är flikens sidindex: en lista över flikens avsnitt och kort som syns just nu. I ett brett
  fönster (från 1920 punkter) står listan i marginalen till höger om innehållet. I ett smalare fönster är den en
  rad överst, *På den här sidan: …*. Raden följer med när sidan rullas, säger vilket avsnitt du är i och fälls ut
  med ett klick. Ett klick på ett avsnitt i listan fäller ut det, rullar fram det och flyttar fokus dit. Dolda
  avsnitt står inte i listan, och en flik med färre än tre avsnitt har ingen. Listan byggs om när fliken ritas
  om, till exempel efter att lönefilen lästs in.

### Dossierer: en AID-etikett eller ett BAS-intervall på en sida

- **Gruppdossiern** samlar allt verktyget vet om en AID-etikett i ett BAS-intervall. Den öppnas från tabellraderna
  (i Prioritering under *Mer*), från en grupp i Egna vyer och från raden om markeringen (*Öppna gruppdossier*).
- **BAS-dossiern** samlar ett BAS-intervall i rapportens ordning. Då kan du skriva avsnittet om intervallet utan
  att hämta det ur fem flikar. Dossiern har:
  - nyckeltalen (antal, kvinnor och män, median, P10–P90) och läget mot ställningstagandets rad för intervallet
  - AID-etiketterna i intervallet, med en knapp till varje grupps dossier. För varje grupp står antal, medianer
    per kön, kvinnors median i procent av mäns och samma status som på gruppens rad i Lika arbete, för AID-etiketten
    i intervallet. Finns AID-etiketten också i andra intervall säger en not det; där är den en egen grupp med egen status.
  - kandidatparen i Likvärdigt arbete där den kvinnodominerade AID-etiketten ligger i intervallet, och paren *Lägre krav,
    högre lön*
  - medianlönen per åldersgrupp (–34, 35–49, 50–) och kön, med en länk till Ålder & karriär med intervallet valt
  - intervallets rad ur förra årets bokslut, när en konfigurationsfil från förra året är inläst.

  Du öppnar BAS-dossiern på flera ställen:
  - knappen *BAS-dossier* i Löneöversiktens BAS-rader (Tabeller och egna vyer)
  - ikonen bredvid intervallets namn i Lönestrukturs tabell per BAS-intervall
  - *Hela BAS …* i gruppdossiern och *Öppna BAS-dossiern* i raden om markeringen
  - sökrutan: en BAS-träff har raden *Öppna BAS-dossiern för BAS …* under sig (pilarna och Retur når den).
    Sökordet *BAS-dossier* (eller *intervall*, *per intervall*) öppnar dialogen för det första intervallet.

  Väljaren överst byter intervall. **Kopiera som text** ger dossiern i rapportens form: rubriken
  *BAS-intervall …* och ett stycke per punkt. Texten byggs som exporterna, så grupper under minsta
  gruppstorlek står bara med namn, utan lönemått.
- Ingen av dossiererna dokumenterar sakliga skäl; de samlar underlaget för den bedömningen. Skälen dokumenterar du i
  Handlingsplan.

1. **Regler & praxis** — gå igenom de sex granskningsområdena. Sätt
   **status** (Ingen risk / Möjlig risk — utreds / Åtgärd krävs / Ej tillämplig) och
   skriv en **anteckning** per område. *Skriv på gruppnivå: inga namn eller
   personnummer i fritext.* Värdena följer automatiskt med in i Word-utkastet
   och utskriften.
2. **Löneläget** *(fördjupning, inget lagkrav)* — fliken går att öppna när lönefilen och minst en referens
   (ställningstagandet eller jämförelsestatistiken) är inlästa. Med en lönefil men utan referens döljs den i menyn.
   Den har fyra avsnitt.
   *Överblick* står överst och är öppen. Den visar alla AID-etiketter i två diagram. Bandkartan visar var varje
   AID-etiketts medianlön ligger i ställningstagandets spann, och diagrammet *Var ligger AID-etiketterna i statistikens
   spann?* visar var den ligger i jämförelsestatistikens spann (0 = statistikens P10, 100 = dess P90). Punkten är
   fylld när statistiken matchades på AID och BAS, och ofylld när den matchades på endast AID. Diagrammet visar hela
   underlaget; filtren under *Mot jämförelsestatistiken* gäller inte där. Saknar statistiken P10 och P90 står ett
   meddelande i stället för diagrammet. Utan ställningstagande visas bara statistikens diagram, och utan statistik
   bara bandkartan.
   *Mot ställningstagandet* är tabellen per AID-etikett och könens läge i spannet. Där står också hur stor andel av
   kvinnorna respektive männen som ligger i spannets nedre, mellersta och övre tredjedel, efterlevnaden och
   täckningen. *Mot jämförelsestatistiken* är tabellen och diagrammen mot statistiken, med filter på BAS-intervall och huvudområde.
   Tabellen visar medianens kolumner, och P10 och P90 ligger bakom *Fler kolumner* (Kopiera, CSV, Excel och
   utskriften tar med alla).
   *AID-etikett för AID-etikett* står sist och är stängd från början. Den visar per AID-etikett var löneläget och
   statistiken ligger mot ställningstagandet, som är referenspunkten. Där står skillnaden percentil för percentil
   och läget i spannet (0 = referensens P10, 100 = dess P90). Där står också mönstret i ord och ett förslag på
   vilken referens som säger något om gruppen. En bild visar de tre spannen, och en tabell visar statistiken mot
   ställningstagandet. Ligger både löneläget och statistiken över ställningstagandet har det halkat efter
   marknaden. Ligger bara löneläget över har organisationen gått före. Förslaget är ett förslag, ingen regel.
3. **Lika arbete** — fliken öppnar med **Kvinnor och män med samma AID-etikett**: kvinnors och mäns medianlön per
   AID-etikett i varje BAS-intervall. En AID-etikett som finns i två BAS-intervall är två grupper, på två rader intill
   varandra, och kolumnen BAS-intervall säger vilken som är vilken.
   Varje grupp får en status som bygger på statistisk signal: **Värt att granska** när skillnaden är
   statistiskt säkerställd (utanför slumpens gränser för gruppen) och minst 3 % (verktygets egen storleksgräns),
   **Följ upp** när den är minst 3 % men inte säkerställd, eller säkerställd men under 3 %, **Balanserat** när den
   är under 3 % och inte säkerställd, och **Går ej att bedöma** när ett kön har för få personer för att pröva
   skillnaden. Börja med grupperna som är värda att granska. Lagen kräver att du prövar varje skillnad, också de
   mindre. Kolumnen **≥ 5 %** är ingen status utan en markering på den ojusterade skillnaden: direktivets regler
   om gemensam lönebedömning utgår från en skillnad på minst 5 %, och markeringen visar var den nivån nås. Den är
   inte en bedömning och står aldrig vid regressionens justerade tal.
   Diagrammet **AID-etiketterna mot slumpens gränser** ovanför tabellen visar varje AID-etikett mot gruppens storlek.
   En liten grupp kan ha en stor skillnad av ren slump, men en stor grupp kan det inte. Grupperna utanför det
   skuggade fältet är de där skillnaden är svår att förklara med slumpen. Nyckeltalen överst tar med hur stor
   skillnaden är när ålder och BAS-intervall räknats bort (regressionen, som står i Lönestruktur).
   Under Fördjupning kommer Personer att granska och avsnitten **Lika arbete AID × BAS** och **Analys på
   individnivå**. De har tabellerna i den form en skriven lönekartläggning brukar ha. Den första har samma grupper
   och samma status som tabellen ovan, ordnade efter BAS-intervall, med AID-koden, kolumnen *Status* och slumpens
   gränser i egna kolumner. Den ger ingen egen bedömning, så de två tabellerna säger alltid samma sak om en grupp, och
   nyckeltalet är detsamma. Diagrammet och Excel-bladet *Slumpens gränser* visar gränserna men ingen status:
   diagrammets not hänvisar till tabellernas status, verktygstipset säger *Mot slumpens gränser* och bladets kolumn
   *Mot gränserna*. Den andra är en arbetslista över grupperna där något kön är för litet för lönemått, att fylla i efter den
   individuella granskningen. Båda finns som blad i Excel-filen.
   Kolumnen **Kvinnor nationellt** visar andelen kvinnor med samma AID-etikett i landets kommuner och
   regioner. Talen kommer ur SKR:s personalstatistik (SKR är Sveriges Kommuner och Regioner; perioden står i Om
   verktyget). Det är ett referensvärde att jämföra din egen könsfördelning mot. Välj under
   **Inställningar** i sidhuvudet om organisationen är en kommun eller en region, så jämförs du med rätt
   del av statistiken. Samma statistik är reserv för könsfördelningen i Likvärdigt arbete; ordlistan förklarar
   begreppet SKR.
   AID grupperar arbetsuppgifter och är inte ett arbetsvärderingssystem — AID-etiketterna är en
   **utgångspunkt** för lika arbete som du bekräftar (se bakgrundspanelen i fliken).
   Har lönefilen AID:s **ansvarskod** fäller pilen framför AID-etiketten ut en rad per ansvarsgrupp
   (ledningsansvar, särskilt uppdrag, inget särskilt ansvar). Sist står raden **Utan ledningsansvar**, som visar
   skillnaden bland dem som inte leder. Excel-filen har alla raderna. I regressionen (Lönestruktur) står på en
   egen rad hur mycket ansvaret förklarar. Huvudtalet räknar inte bort det: om ansvaret är ett sakligt skäl
   avgör du.
   Grupper som är värda att granska märks **skör** om skillnaden kan hamna under 3 % när en
   eller två personer tas bort, annars **stabil**. Statusen gäller i båda fallen, men i en
   skör grupp avgör enskilda löner — titta särskilt på dem.
   Under AID-etiketterna finns **Personer att granska**. Det är personer som ligger minst 10 % under vad
   kollegor med samma AID-etikett i samma BAS-intervall och ålder tjänar, och du kan ändra gränsen. Listan är
   ett stöd för den individuella granskningen, inte ett besked om att lönen är osaklig.
   Slå upp personen med **radnumret** i lönefilen. Listan kan inte exporteras eller
   skrivas ut.
4. **Likvärdigt arbete** — fliken öppnar med diagrammet **Krav mot lön**, där varje AID-etikett är en
   punkt (kravnivå vågrätt, medianlön lodrätt). Kvinnodominerade grupper under linjen är de som är värda att titta
   närmare på. Granska sedan kandidatparen (kvinnodominerade AID-etiketter mot jämförelseetiketter). Diagrammet
   **Kandidatparen i kronor** visar båda AID-etiketternas medianlön per par. Kraven mäts med **BAS-intervall**, eller med
   **arbetsvärderingspoäng** om lönefilen har kolumnen Poäng — då väljs det
   automatiskt och paren jämförs även över BAS-gränserna. Jämförelseetiketterna är **alla AID-etiketter som inte
   är kvinnodominerade**, både mansdominerade och könsblandade, och könsandelen i jämförelseetiketten står i
   partabellen (kolumnen *Könsandel*, med klassen mansdominerad eller blandad). Vill ni bara jämföra med
   mansdominerade AID-etiketter kryssar ni i *Jämför bara med mansdominerade AID-etiketter* i flikens inställningar
   (av som standard); valet följer med i konfigurationsfilen och organisationspaketet. Med BAS-intervall hämtas
   jämförelseetiketterna i första hand ur den egna organisationen, och jämförelsestatistiken används bara där en egen
   jämförelseetikett saknas. Med poäng jämförs bara organisationens egna AID-etiketter. Den slutliga kravvärderingen gör du utifrån befattningsbeskrivning.
   Fliken visar som standard alla par där jämförelseetiketten har högre lön, de 20 största i tabellen (knappen
   *Visa alla* visar resten). Nyckeltalet *Par att titta närmare på* säger hur många par det är och hur många av dem
   som har en ojusterad löneskillnad på minst 5 %. Vill ni bara se par med minst en viss skillnad, till exempel 5 %,
   anger ni den i fältet *Visa bara par med minst … % skillnad* (0 = alla); antalet par ändras också i fliken.
   Fliken och dess egen export visar par även
   när en grupp är liten — hantera dem därefter.
   Avsnitten **Likvärdigt arbete** per BAS-intervall och **Hierarkisk jämförelse** klassar varje AID-etikett i varje
   intervall som kvinnodominerad, könsblandad eller mansdominerad, med en sammanfattning per intervall. De listar
   också par där ett arbete i lägre BAS som inte är kvinnodominerat har högre medianlön än ett kvinnodominerat
   arbete i högre BAS. Definitionen av kvinnodominerat väljs i flikens inställningar: **Mer än 60 %** (mer än tröskeln,
   standard) eller **60 % eller mer** (tröskeln eller mer), med den inställda kvinnotröskeln i stället för 60; mansdominerat är samma gräns för män och övriga är könsblandade. Samma
   definition och samma jämförelseetiketter gäller i hela verktyget: kandidatparen, *Lägre krav, högre lön*,
   tabellerna per BAS-intervall, Lika arbetes kolumn Dominans, Löneöversynens *Varav till kvinnodominerade
   grupper* och Lönepolitikens diagram. Valet står i Excel-bladen och i metodbladet.
   Bredvid skillnaden står kolumnen **Justerad för ålder**: jämförelseetikettens lön omräknad till
   den kvinnodominerade AID-etikettens åldersfördelning. Den råa skillnaden är den lagen prövar:
   lönenivån som sådan. Den justerade visar hur mycket av skillnaden som kan bero på att
   AID-etiketterna har olika åldersstruktur. En ung kvinnodominerad AID-etikett mot en äldre jämförelseetikett
   ger en rå skillnad som krymper när åldern räknats bort. Den justerade räknas bara för par där
   jämförelseetiketten finns i den egna organisationen med minst 10 personer och minst 5 års
   åldersspridning. Annars står ett streck, och verktygstipset säger varför. Bevis-knappen
   visar medelåldern på båda sidor.
   Under kandidatparen finns **Lägre krav, högre lön**: kvinnodominerade AID-etiketter som har
   lägre medianlön än en av organisationens AID-etiketter i *lägre* BAS. Det är ofta den tydligaste
   signalen om undervärdering, men BAS är ett grovt mått på krav — pröva paren mot
   befattningsbeskrivningarna.
5. **Lönestruktur** — varför skillnaden finns där den finns. Fliken öppnar med slutsatserna. Under
   Fördjupning står **Var uppstår löneskillnaden?** först och är det enda utfällda avsnittet (se nedan); resten
   fälls ut vid behov.
   - **Representation per BAS-intervall** visar segregeringen: sjunker andelen kvinnor mot högre BAS-intervall?
   - **Organisationen som karta** visar varje AID-etikett som en yta efter antal personer och andel kvinnor.
   - **Var i lönefördelningen är skillnaden störst?** visar lönen vid olika percentiler för kvinnor och män. Då
     syns om skillnaden är störst bland de lägst eller högst betalda.
   - **Lönetransparensdirektivets mått** visar de mått som en större arbetsgivare ska rapportera när direktivet gäller.
     Måtten är räknade på fast heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning, inklusive
     rörliga delar och förmåner); komplettera ur lönesystemet om ni rapporterar.

   Avsnittet **Per huvudområde** visar läget i AID:s 13 huvudområden, ett i taget, till exempel vård och omsorg,
   skola och teknik. Där står antal, andel kvinnor, medianer, kvinnors lön i procent av mäns (rå och justerad
   för ålder, när lönefilen har ålder, och BAS) och antal punkter i Att göra. Har varje BAS-intervall i ett
   huvudområde bara ett kön går kön och BAS inte att skilja åt, och där står *Kan inte justeras för BAS*. Under tabellen står hur mycket av
   skillnaden i hela organisationen som beror på att kvinnor och män arbetar i olika
   huvudområden. Pilen vid ett huvudområde öppnar dess AID-etiketter i Tabeller och egna vyer. Lika arbete, likvärdigt arbete
   och övriga analyser gäller alltid hela organisationen.
   **Var uppstår löneskillnaden?** delar skillnaden i medellön i delar som tillsammans blir hela
   skillnaden. Diagrammet är en trappa: hela skillnaden längst till vänster, sedan delarna en i taget från hela
   skillnaden mot noll, med beloppet och andelen av skillnaden vid varje stapel. Färgen säger vad delen är: blått
   för det som förklaras av var kvinnor och män arbetar, orange för lönen inom samma grupp och grått för hela
   skillnaden. En del som går åt andra hållet än hela skillnaden får bara sitt belopp; verktygstipset säger varför.
   Standard är tre delar:
   - **BAS-fördelning:** kvinnor och män i olika BAS. Det är en fråga om karriärvägar och rekrytering.
   - **AID inom BAS:** olika AID-etiketter i samma BAS-intervall. Pröva likvärdigt arbete.
   - **oförklarat, lön inom samma AID och BAS:** olika lön i samma arbete, det som fördelningen inte förklarar. En grupp med bara kvinnor eller bara män kan inte jämföras och räknas till delarna ovan. Pröva lika arbete.

   Under diagrammet fäller **Ändra uppdelning** ut rutan **Förklara med:**, där du väljer andra variabler: BAS, huvudområde, AID-mellannivå, AID och åldersgrupp
   (åldersgrupp bara när lönefilen har ålder). Välj en till fyra och ordna dem med pilknapparna. Ordningen spelar
   roll: den första variabeln får det den förklarar ensam, nästa det den förklarar utöver den första, och så vidare.
   AID-nivåerna står alltid från grov till fin. Med BAS och åldersgrupp blir delarna *BAS-fördelning*, *Åldersgrupp
   inom BAS* och *Inom åldersgrupp och BAS*. Varje vald variabel ger en del, och den sista delen är skillnaden inom
   samma grupp. Valet sparas i konfigurationsfilen och följer med i rapportunderlaget.

   Under varje del står de grupper som bidrar mest i kronor.
   Listan kan skilja sig från de flaggade AID-etiketterna i Lika arbete, som sorteras efter hur stor
   skillnaden är i gruppen.
   **Löneskillnad per BAS-intervall** är en tabell per intervall med antal kvinnor och män och de två medianlönerna.
   Den visar också skillnaden i kronor, kvinnors lön i procent av mäns med konfidensintervall och status, och
   lönespridningen per kön. **Könsfördelning per BAS-intervall** visar var ett kön är under 40 %. Sist kommer
   **Vad blir kvar av löneskillnaden?**, den **oförklarade** löneskillnaden. Där finns regressionen, där du i panelen
   *Förklaringsmodell* kan välja om ålder, BAS-intervall och AID-etikett inom BAS ska räknas bort och se vad varje
   variabel tillför.
   Där finns också trappan som visar vad varje vald variabel förklarar, och Blinder-Oaxaca. En bortvald variabel redovisas som
   kontrollerad, med ditt skäl, också i rapporten.
6. **Ålder & karriär** *(fördjupning, inget lagkrav)* — lön mot ålder och löneskillnaden per åldersgrupp, alltså var
   i karriären skillnaden finns. Där finns också lönespridning över ålder, lönefördelningen för kvinnor och män,
   åldersstruktur och livscykel.
7. **Prioritering · Löneöversyn · Handlingsplan** — tre flikar med var sin fråga.
   **Prioritering** visar löneläget mot er referens med kostnad att nå den. Matrisen visar varje grupps
   avvikelse mot referensen och dess storlek, och åtgärdslistan rangordnar grupperna. Varje rad i listan har
   förstoringsglaset *Visa beräkningen* och menyn *Mer*: Löneöversikten, motiveringsförslag och gruppdossiern.
   Kostnadsdiagrammet
   visar de grupper som kostar mest att lyfta, med den kumulativa andelen av totalkostnaden. Läget har egna
   ord — *Börja här*, *Under referens, liten grupp*, *Nära referens* (under och över uppföljningsgränsen, i två
   färger) och *Över referens* — eftersom det är något annat än skillnaden mellan kvinnor och män, som Lika arbete
   bedömer med *Värt att granska*, *Följ upp* och *Balanserat*. *Börja här* och *Under referens, liten grupp* är
   samma läge, mer än granskningsgränsen under referensen, i en större och en mindre grupp. Nyckeltalen överst heter
   som statusarna och räknar samma rader som tabellens kolumn *Status*; under varje nyckeltal står vad statusen
   betyder, med gränserna ur Inställningar (till exempel *mer än 5 % under, färre än 10 personer*). Matrisens zoner
   heter *Mer än 5 % under*, *Nära referens, under*, *Nära referens* och *Mer än 5 % över*, med gränserna ur
   Inställningar; i den första zonen visar färgen om gruppen är *Börja här* eller *Under referens, liten grupp*.
   Färdigcheck i Exportera säger hur många grupper som ligger under referensen alls och hur många av dem som
   ligger mer än granskningsgränsen under. Nyckeltalet *Kostnad att nå referensen* är vad
   det kostar att lyfta grupperna under referensen till dess median, inte lönekartläggningens könsskillnader;
   dem visar Lika arbete och Löneöversyn.
   **Löneöversyn** svarar på *hur* potten fördelas. Lägg in en budget, ett generellt påslag och riktade
   potter per grupp. Då ser du nya löner, vad som gått åt och löneskillnaden före och efter. En riktad rad kan
   begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå ("höj till"). Det är det som
   tidigare hette Lönerevisionssimulatorn.
   PO-påslag och beräkningsperiod, som all kostnad räknas med, ställs in under **Inställningar** i sidhuvudet.
   Där, under rubriken *Prioritering*, ställs också Prioriteringens trösklar och viktningen av
   prioriteringsindexet in. Trösklarna är granskningsgränsen, *Börja här*-tröskeln och gränserna för uppföljning
   och över referensen. Raden *Trösklar och viktning* i fliken Prioritering säger om värdena är ändrade, och *Ändra*
   öppnar Inställningar där. **Handlingsplanen** förifylls ur de två; egna åtgärder läggs
   till med *Lägg till rad* och följer med i exporterna som de förifyllda. På skärmen står grupp, antal berörda och
   underlag under åtgärden i första kolumnen, så att fälten man fyller i ryms utan att man rullar i sidled; utskriften
   och exporterna har dem som egna kolumner. Kolumnen *Kostnaden avser*, direkt
   efter kostnaden, säger vilken kostnad raden har: *Nå referensens median* för rader ur Prioritering och *Nå
   jämförelseetikettens median* för kandidatpar i likvärdigt arbete. En egen rad har ingen beräknad kostnad, och cellen
   är tom. Kolumnen står också i Excel-underlaget, utskriften, Word-utkastet, PDF-rapporten och Rapporttext, där
   summan delas på de två slagen. Kortet **Samverkan & uppföljning** i
   Handlingsplan har momenten, med kolumnen *Genomfört (datum / parter)* att fylla i för hand på den utskrivna mallen,
   och knapparna för **protokollet för gemensam lönebedömning** och **handlingsplanen** som Excel.
   Knappen **Sakliga skäl** på varje rad öppnar en dialog där du dokumenterar skälen till gruppens löneskillnad: en
   kategori (Marknad, Utbildning, Erfarenhet, Prestation och resultat, Övergång eller Annat sakligt skäl), ett belopp
   i kronor per månad och en kort kommentar per skäl, högst 8 skäl per grupp. Lagen räknar inte upp några skäl;
   kategorierna är verktygets indelning. Dialogen räknar ihop hur stor del av skillnaden skälen förklarar och hur
   mycket som återstår. Skriv inga namn eller personnummer i kommentaren. Ett skäl sparas först när beloppet är ett
   heltal mellan 0 och 200 000 kr, och dialogen säger till när det inte är det.
   - När beloppen täcker hela skillnaden föreslår dialogen att du väljer *Ja, sakligt skäl finns*. Organisationen
     bedömer om skälen är sakliga; verktyget väljer aldrig själv.
   - När skälen tillsammans är större än skillnaden varnar dialogen med beloppen, och inget förslag visas. Ett belopp
     kan vara för högt, eller så räknar två skäl samma sak. Rapporten har samma varning.
   - En grupp som är för liten för att redovisas (färre än minsta gruppstorlek) får inga andelar, och raden och
     skälen följer inte med i exporterna.
   - När ett kön i gruppen är under gränsen visar dialogen beloppen för dig, men i rapporten, Excel och årsbokslutet
     står bara kategorierna. Belopp, andel och kommentar utelämnas där med noten *belopp och kommentar utelämnade: ett
     kön har färre personer än minsta gruppstorlek*, och dialogen varnar om det.
   - En egen rad har ingen medianskillnad: skälen redovisas med belopp, och de följer inte med i årsbokslutet och
     jämförs inte med förra året.

   Skälen sparas i konfigurationsfilen med kommentarerna. De följer med i Rapporttext, Word och PDF (tabellerna
   *Sakliga skäl per grupp* och *Sammanställning per kategori*), i Excel (bladet *Sakliga skäl* och två kolumner i
   handlingsplansunderlaget) och i årsbokslutet. Bokslutet sparar kategori och belopp (för en grupp där ett kön är under gränsen bara
   kategorin), men aldrig kommentarerna.
   Gruppdossiern och BAS-dossiern visar bedömningen med en länk till raden. Kategorierna och beloppen är
   organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden.
   Skillnaden mellan könen i en grupp visas i Prioritering bara när både
   kvinnorna och männen i gruppen är tillräckligt många för att redovisas. Annars räknas
   gruppens prioritet utan skillnaden mellan könen. I **Löneöversyn** får du lägga en egen riktad rad på
   vilken grupp som helst, också en grupp under tröskeln. Det är din egen simulering. Radens
   belopp visas då på raden och ingår i summorna, även i Löneöversyns Excel-export (*Använt*,
   *Riktat* och, för en kvinnodominerad grupp, *Varav till kvinnodominerade grupper* när den visas). För en
   grupp med en enda person bygger beloppet alltså på den personens lön; verktyget säger det i
   en not under raden. Tänk på det innan du delar exporten. I exportens blad *Fördelning* har en grupp under
   tröskeln sin rad med antal och andel kvinnor men utan medianer och kostnad; kostnaden för de grupperna står
   samlad på raden *Kostnad för grupper under tröskeln*. Når de inte tröskeln tillsammans står också den minsta av
   de övriga gruppernas kostnad där, och noten under bladet säger vilken; så går en liten grupps kostnad inte att
   räkna fram ur summorna. Verktygets egna förslag (*Föreslå fördelning mot
   skillnaderna i likvärdigt arbete*, målet för skillnaden och känslighetskurvan) riktar däremot bara mot par där
   båda grupperna når tröskeln, också på skärmen, med en rad per AID-etikett mot jämförelseetiketten med störst skillnad. Ett
   förslag som inte längre säkert når tröskeln (efter en höjd tröskel eller ur en konfigurationsfil) tas bort, och det
   står vid förslagen; klicka på *Föreslå* igen för ett nytt. Sparade scenarier (A/B) visar
   den råa löneskillnaden bara när båda könen når den tröskel som gäller just då.
8. **Tabeller och egna vyer** (under 4 · Rapport) har två avsnitt: **Löneöversikt — alla BAS-intervall** (den fasta
   tabellen: hela löneläget per BAS-intervall, kön och AID-etikett) och **Egna vyer**. I
   Egna vyer bygger du det som en fråga kräver när flikarna ovan inte besvarar den. Välj rader och ev. kolumner,
   mått och diagramtyp. Väljaren har de vanliga typerna överst och resten under *Fler diagramtyper*, bland dem
   värmekartan och regnmolnet. Välj också om du vill se helheten eller uppdelat per kön. Begränsa urvalet med
   villkor under **Urval**: på personer (t.ex. "lön minst 30 000 kr", "BAS är inte
   A", alla eller något av villkoren) och på grupper (till exempel "skillnad mindre än 95 %").
   Hanteldiagrammet visar skillnaden per grupp, bubbeldiagrammet om
   kvinnodominerade grupper har lägre lön. Grupper med färre än 10 personer visas
   som alla andra på skärmen men följer inte med i exporten om du inte kryssar i det. Klicka på en grupp
   för att öppna dess gruppdossier. Rader och kolumner kan också vara **Huvudområde** eller
   **AID-mellannivå** (de fyra första siffrorna, t.ex. "AID 2070xx" för undersköterskor och
   vårdbiträden). När raderna är AID-etiketter kan små grupper **slås ihop till nästa
   AID-nivå** ("Övriga i AID 2070xx (2 AID-etiketter)"). Det går bara i Tabeller och egna vyer, aldrig i Lika arbete,
   där en hopslagen grupp inte längre är lika arbete.

   Under Löneöversikten står två underflikar: **Egna vyer** och **Alla diagram**. Under Alla diagram finns diagrammen
   från de andra flikarna samlade, en grupp per flik i menyns ordning. Öppna en grupp för att se flikens diagram;
   fliken ritas då om det behövs, men du stannar där du är. Varje diagram har sin rubrik, en länk *Från fliken …* till
   diagrammet i fliken, egna filter och en egen exportmeny. Filtren i samlingen och i fliken påverkar inte varandra,
   och diagrammet i samlingen visar alltid det som diagrammet i fliken visar. Ett diagram som fliken inte visar med
   ditt underlag (till exempel det mot jämförelsestatistiken utan statistik) står inte heller i samlingen. Samlingen
   är ingen egen export: ZIP-filen och rapporten tar diagrammen från flikarna, en gång var.

Varje diagram har en **Exportera**-knapp i övre högra hörnet: PNG i två storlekar,
SVG (skarp i Word) och diagramdatan som tabell.

**Välj vad ett diagram visar.** I diagrammen där BAS-intervallet är en dimension (bland annat
bandkartan och statistikens spann i Löneläget, översikten, könsfördelningen, lådorna och trattdiagrammet i Lika
arbete, Krav mot lön i Likvärdigt arbete, Prioriteringens två diagram och hanteln per BAS-intervall i Spara och
jämför år) står en knapp per intervall ovanför diagrammet. Filtren står i rutan **Filter**, som säger hur många som
är aktiva (*Filter: inga*, *Filter: 1 aktivt*, *Filter: 2 aktiva*); med ett aktivt filter blir rutan blå. Klicka på ett intervall för att dölja det, till exempel BAS A, B, C och N
inför en presentation. Det sista synliga intervallet kan inte döljas.

Diagram där varje punkt är en AID-etikett har fler filter, en rad per filter:

- **Antal personer i gruppen** med fälten **Minst** och **Högst**: skriv till exempel 10 i Minst för att dölja de
  minsta grupperna. Fälten gäller när du lämnar dem eller trycker Enter; ett tomt fält är ingen gräns, och gränserna
  ingår. Platshållarna visar diagrammets minsta och största tal. Är Minst större än Högst markeras fältet, och
  ingenting döljs förrän du rättat det. Prioriteringsmatrisen, Prioriteringens kostnadsdiagram, trattdiagrammet i
  Lika arbete, Krav mot lön i Likvärdigt arbete, bandkartan, statistikens spann och de två diagrammen mot
  jämförelsestatistiken i Löneläget har filtret.
- **Avvikelse (%)** med Minst och Högst, i Prioriteringsmatrisen: till exempel Högst −5 för att bara se grupperna
  som ligger minst fem procent under referensen. Decimaler skrivs med komma.
- **Könsdominans** (Kvinnodominerad, Mansdominerad, Blandad) som knappar, i bandkartan och statistikens spann.
- **Matchning** (AID + BAS, Endast AID) som knappar, i statistikens spann och de två diagrammen mot
  jämförelsestatistiken. En grupp utan statistik påverkas inte av det filtret.
- **AID-etikett** och **Huvudområde** som hopfällda listor med kryssrutor och ett sökfält, i Prioriteringens två diagram,
  trattdiagrammet i Lika arbete, statistikens spann, de två diagrammen mot jämförelsestatistiken och överblickens bild i
  Löneläget. Bandkartan har AID-etikett och Krav mot lön i Likvärdigt arbete Huvudområde. Klicka på summeringen
  (till exempel "AID-etikett: alla 40") för att öppna listan. **Avmarkera alla** och sedan en kryssruta visar bara den gruppen.

Fler diagram har filter:

- **Lön mot ålder** i Ålder & karriär: BAS-intervall (när hela urvalet visas), AID-etikett, ålder och lön (Minst och
  Högst). Med ett filter räknas trendlinjerna per kön, deras konfidensband och trenden för hela urvalet om ur de
  punkter som syns, och noten säger det. Har ett kön färre synliga punkter än minsta gruppstorlek ritas inte dess
  trendlinje, och noten säger varför. *Lön mot ålder per BAS-intervall* har samma filter; där döljer filtren punkter,
  och trendlinjen i varje panel gäller fortfarande alla i intervallet.
- **Löneskillnaden per åldersgrupp**: åldersgrupp (knappar) och antalet av det minst företrädda könet i åldersgruppen.
- **Åldersfördelningen som kurva** och **lönespridningen över ålder**: ålder (Minst och Högst). En femårsgrupp visas
  när dess första år ligger inom gränserna.
- **Trädkartan** i Lönestruktur: BAS-intervall, huvudområde och antal personer i gruppen. Kartan läggs om så att de grupper
  som syns fyller den; bara ytornas läge och storlek ändras, inga tal. BAS-intervallets antal är hela intervallets.
  Ytan för små grupper samlar flera AID-etiketter och påverkas inte av filtret på huvudområde.
- **Huvudområdena** i Lönestruktur: huvudområde och antal personer i huvudområdet.
- **Kandidatparen** i Likvärdigt arbete: den kvinnodominerade AID-etikettens BAS-intervall, löneskillnaden och antalet
  i den kvinnodominerade AID-etiketten. Ett filter döljer hela par.
- **Före och efter** i Löneöversyn: BAS-intervall eller AID-etikett, efter vald nivå, och antal.
- **Förändringen per AID-etikett** i Spara och jämför år: BAS-intervall, AID-etikett och antal. Varje rad är en
  AID-etikett i ett BAS-intervall.

Filtren verkar tillsammans. Döljer de alla punkter står "Inga grupper i urvalet" i diagrammet; ändra eller töm ett
fält för att få tillbaka dem. **Visa alla** nollställer alla filter i diagrammet. Under diagrammet står vad som är
dolt, till exempel "utan BAS A, BAS N; 10–50 personer i gruppen". Urvalet döljer bara märken: inget tal räknas om
(utom trendlinjerna i Lön mot ålder och trädkartans ytor, se ovan),
och texten, tabellerna, rapporten, Word, PDF, utskriften och ZIP-filen visar alltid hela underlaget. Diagrammets egen
export (PNG och SVG) visar urvalet och säger i fotraden vad som är dolt. Valet gäller diagrammet tills du läser in en
ny lönefil, läser in demot eller rensar all data. Det sparas inte i konfigurationsfilen. Diagram där en punkt eller
stapel samlar flera BAS-intervall, till exempel lägena per kön i Lönepolitik, har inga sådana knappar.

**Räkna ett diagram för en del av underlaget.** Några diagram som sammanfattar många personer kan räknas om för en
del av dem: lådorna och histogrammet för kvinnors och mäns lön i Ålder & karriär (för ett huvudområde eller en åldersgrupp),
löneskillnaden per åldersgrupp (för ett huvudområde eller en AID-etikett) och percentilerna och kvartilerna i
Lönestruktur (för ett huvudområde eller ett BAS-intervall). Raden **Räkna för** står först i raden **Filter** ovanför
diagrammet, och ett val räknas där som ett aktivt filter. Välj till
exempel ett huvudområde, så räknas diagrammet om för personerna där, och under diagrammet står "Diagrammet är räknat
för: huvudområde Teknikarbete (60 personer)". **Räkna för alla** går tillbaka till hela underlaget. Diagrammet räknas för en sak i taget: väljer du en
åldersgrupp tas valet av huvudområde bort.

Det finns en skyddsregel. Både det du väljer och resten av underlaget måste ha antingen inga eller minst så många
kvinnor och män som minsta gruppstorlek. Annars skulle två bilder, en för alla och en för valet, kunna avslöja en liten
grupp. Ett huvudområde eller en åldersgrupp som själv är för liten går inte att välja; raden säger hur många sådana det finns.
Ett val som bryter regeln görs inte, och under diagrammet står varför. Vid exporten gäller den inställda minsta
gruppstorleken, så ett val som går att göra på skärmen kan släppas där. Diagrammets egen export (PNG, SVG och
diagramdata) visar valet och säger det i fotraden. Texten, tabellerna, rapporten, utskriften, ZIP-filen och
rapportunderlaget visar alltid hela underlaget.

**Egna tabeller i rapporten.** Ovanför tabellen i Tabeller och egna vyer finns **Lägg till i rapporten**. Ge vyn
ett namn och lägg till den. Då står den som en egen tabell i avsnittet *Egna tabeller* i
Word-utkastet och PDF-rapporten och i bladet *Egna tabeller* i Excel-filen. Den står också som block under
*Egna tabeller från Tabeller och egna vyer* i rapportunderlaget (fliken Rapporttext). Kryssa i **En tabell
per BAS-intervall** för att få samma tabell upprepad för varje intervall. Systemägaren kan lägga
tabellerna i organisationspaketet, så att alla handläggare får samma. Det är vyns recept som
sparas (rader, kolumner, mått och urval), inte talen. Tabellen räknas om med minsta gruppstorlek
när rapporten byggs, och recepten följer med i konfigurationsfilen. Under *Exportera*, i *Rapportens innehåll*, kan
du ordna om och ta bort tabellerna.

## 5. Producera dokumentationen

1. Öppna fliken **Exportera** under *4 · Rapport*. Gå först igenom **färdigchecken**
   och robusthetspanelen direkt under den — de visar om något har missats.
   De fyra exporterna har var sin uppgift:
   - **Word-utkastet är rapporten.**
   - **Excel-filen är underlaget.**
   - **PDF-rapporten är en låst kopia** av Word-utkastet att verifiera mot.
   - **ZIP-filen är allt:** Word, Excel och diagrammen som bilder.

   Vid varje knapp står vad filen innehåller och vad den utelämnar.
2. Klicka **Word-utkast (dokumentation)**. Ett **redigerbart Word-utkast (.docx)** med lönekartläggningens dokumentation laddas ner.
   Verktygets fynd och dina bedömningar i Regler & praxis är ifyllda; fyll i de **gula
   `[HR fyller i …]`-fälten** (sakliga skäl, kravvärdering, beslut, samverkan).
   **Spara som `.docx`** när dokumentet är klart — detta blir din dokumentation.
   Utkastet och PDF-rapporten tar bara med grupper som är stora nog att redovisas: BAS
   och kandidatpar under gränsen utelämnas, och det står hur många det gäller.
   Avsnittet **Lönestruktur per BAS-intervall** har tabellerna i den form en skriven
   lönekartläggning brukar ha. Det är en tabell per BAS-intervall med ett fält för din bedömning av
   intervallet. Tabellen har referensen, organisationen och varje AID-etikett med jämförelsestatistikens
   nivå under, för kvinnor och män: P10, median, P90 och antal. Sist kommer två tabeller per BAS:
   löneskillnader inom likvärdigt arbete (medellön per kön, andel kvinnor, medelålder) och
   löneskillnader i åldersgrupper.
   Samma tabeller finns i Excel-filens blad **Per BAS**. Excel-filen har också de fyra bladen **Lika arbete AID x
   BAS**, **Likvärdigt arbete**, **Hierarkisk jämförelse** och **Analys på individnivå**. De har rapportens
   kolumnnamn och lönemånaden från Inställningar på raden ovanför tabellen. Avsnittet följer ett **recept** som du kan
   ändra under *Rapportens innehåll*. Där väljer du om tabellerna upprepas per BAS-intervall eller per huvudområde,
   vilka rader och mått de ska ha, åldersgränserna och om summeringstabellerna ska med. *Återställ
   standard* ger utkastets form tillbaka.
3. **Skriver du rapporten i en egen mall?** Öppna fliken **Rapporttext**. Avsnittet **Utkast till rapporttext** har
   fynden i klarspråk att redigera och kopiera (*Återskapa* skriver över med ett färskt utkast och frågar först om du har redigerat).
   Väljaren **Omfång** ovanför textrutan avgör om utkastet bara har helheten (*Hela organisationen*). Standard är
   att det också har ett stycke per BAS-intervall (*Hela organisationen + per BAS-intervall*). Varje intervall med
   minst k personer får då samma text som BAS-dossiern, med förra året när ett bokslut är inläst. Stycket slutar
   med raden *[HR fyller i] Bedömning*.
   Valet sparas inte i konfigurationsfilen. *Återskapa* följer det, och ett redigerat utkast skrivs inte över när
   du byter. Samma stycken står i Word-utkastets och PDF-rapportens avsnitt **Lönekartläggning per BAS-intervall**,
   med intervallets tabell över AID-etiketterna. Avsnittet väljs bort under *Rapportens innehåll*. Styckena står också i
   rapportunderlagets grupp **Per BAS-intervall**.
   Avsnittet **Rapportunderlag** har de färdiga avsnitten att klistra in. Överst i rapportunderlaget finns en
   förteckning över blocken och knappen **Kopiera alla avsnitt**, som lägger alla avsnitt i en enda kopiering.
   Varje avsnitt har en knapp **Kopiera**. Det har också varje AID-etikett med statusen *Värt att granska*
   (statistiskt säkerställd skillnad på minst 3 %) och varje kandidatpar där båda grupperna är stora nog att redovisas. Faktastycket och tabellen hamnar på urklipp och tar mallens format när
   du klistrar in. Diagrammen kopieras som bild med **Kopiera diagram**. Under varje grupp
   finns **frågor till verksamheten** — skicka dem till ansvarig chef inför bedömningen av
   om skillnaden är saklig.
   Blocket **Var uppstår löneskillnaden?** kommer direkt efter Sammanfattning.
   Efter Likvärdigt arbete kommer blocket **Lägre krav, högre lön**.
4. Komplettera vid behov:
   - **PDF-rapport** via "Generera PDF": en låst kopia av Word-utkastet, att verifiera mot. Fältet **Organisation**
     intill knappen är namnet på rapportens försättsblad; det hämtas från organisationspaketet när ett är inläst. Under
     *Rapportens innehåll* väljer du vilka avsnitt som följer med i båda (hela dokumentationen,
     ledningsbrief, facklig dialog eller ett eget urval). Sist i listan står **Bilaga: gruppdossierer**. Den är
     förvald av, eftersom den kan bli lång. Kryssa i den så får rapporten en gruppdossier per AID-etikett där både
     kvinnor och män når minsta gruppstorlek, med samma text som dossierns knapp *Kopiera*. BAS-intervallens
     dossierer står redan i avsnittet *Lönekartläggning per BAS-intervall*.
   - **Protokollet för gemensam lönebedömning** som underlag för **facklig samverkan**
     (i Exportera, och som knapp i kortet *Samverkan & uppföljning* i Handlingsplan).
   - **Excel (alla flikar)** för bilagor och egen vidarebearbetning.
   - **ZIP** när du vill ha allt på en gång: Word-utkastet, Excel-filen och diagrammen från alla flikar som bilder.
   - Raden under exporterna länkar till flikarna med egna underlag: **Likvärdigt arbete** (kandidatparen),
     **Lönestruktur** (EU-rapportmåtten), **Prioritering** (åtgärdslistan) och **Löneöversyn** (prognosen). Deras
     exporter finns i respektive flik.
5. **Samverka** med arbetstagarorganisationerna och dokumentera datum, parter och
   synpunkter (fältet finns i Word-utkastet).

## 6. Avsluta och arkivera

- **"Spara konfiguration"** (fliken **Spara och jämför år** under *Arbetet*, avsnittet *Spara/ladda konfiguration*)
  om du vill återuppta inställningarna senare. Datafilen laddas om, och själva lönedatan sparas aldrig.
  Filen innehåller också **årets bokslut**: nyckeltal och en rad per AID-etikett och BAS-intervall där båda könen
  når minsta gruppstorlek. Där finns också en rad per BAS-intervall med minst så många personer (antal, P10, median och P90)
  och Att göra-punkternas läge.
  Läs in filen nästa år, så visar **Jämförelse med förra året** (samma flik) vad som ändrats:
  - nyckeltalen sida vid sida
  - **löneutvecklingen per BAS-intervall**: P10, median och P90 förra året och i år, förändringen i kronor och
    procent, och medianen som en hantel
  - **lönespridningen** per BAS-intervall och per flaggad AID-etikett: (P90 − P10) / median, i procent av
    medianen. Ett streck står när förra årets fil saknar måttet.
  - vilka AID-etiketter som är flaggade båda åren, nya och inte längre flaggade
  - vilka av förra årets öppna punkter som är klara
  - **Sakliga skäl per kategori**: summan och andelen förra året och i år, och per grupp hur skälen och skillnaden
    ändrats. Bokslutet sparar kategori och belopp (för en grupp där ett kön är under gränsen bara kategorin), inte
    kommentarerna. Egna rader följer inte med.

  En fil sparad med en äldre version saknar raderna per BAS-intervall och de sakliga skälen. Panelen säger det, och
  resten av jämförelsen fungerar.
  Sparades förra årets fil med en lägre minsta gruppstorlek än årets läses båda åren med den högre gränsen.
  Ta en AID-etikett som var flaggad förra året men då hade ett kön under den högre gränsen. Om den är flaggad nu
  räknas den som **ny** i år, inte som flaggad båda åren, och förra årets löneskillnad för den visas inte.
  Det är avsiktligt: ett mått för en grupp under årets gräns lämnar aldrig verktyget. Panelen säger det i sin not.
  Samma jämförelse följer med som ett avsnitt i Word-utkastet och PDF-rapporten och som ett block i
  rapportunderlaget. Den följer också med som ett diagram där varje AID-etikett visas som ett streck (förra året)
  och en punkt (i år). Tabellen och hanteln per BAS-intervall följer med på samma sätt. Tabellen står i
  rapportens avsnitt och i rapportunderlagets block, och hanteln som bild i Word-utkastet, PDF-rapporten och ZIP-filen.
- **"Rensa all data"** (under **Inställningar**, rubriken *Rensa*) när du är klar — eller stäng bara fliken; inget ligger kvar.
- Arkivera de färdiga dokumenten (Word/PDF/Excel) enligt dina informationshanterings-
  rutiner. Glöm inte att planera in nästa års lönekartläggning.

---

> Detta är en operativ guide. Metoderna och formlerna beskrivs i verktygets flik
> **Om verktyget**; dataskyddet i `riskanalys.md`.
