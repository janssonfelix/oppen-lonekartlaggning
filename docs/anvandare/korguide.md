# Körguide: genomför en lönekartläggning med verktyget

En praktisk steg-för-steg-guide för HR-handläggaren — från datauttag till färdig
dokumentation. Verktyget gör **analysen och planeringen**; de kvalitativa
bedömningarna och besluten gör och äger arbetsgivaren.

> **Tidsåtgång:** en första körning tar typiskt en halv till en dag, inklusive de
> kvalitativa § 8-bedömningarna och facklig samverkan. Själva analysen är klar på
> minuter när filen är inläst.

---

## 0. Förutsättningar

- En dator med en modern webbläsare: **Chrome/Edge, Firefox eller Safari 16.4+**.
  Verktyget är byggt för datorskärm; surfplatta och mobil stöds inte.
- Filen `oppen-lonekartlaggning.html` — eller er **organisationsfil**, där systemägaren bakat in
  organisationspaketet (`organisationspaket.md` avsnitt 3b) — öppnad **lokalt** (dubbelklick/`file://`
  eller från en intern, behörighetsstyrd filyta). Ingen installation, ingen internetanslutning behövs.
- **Verifiera filens äkthet** innan verklig lönedata läses in. Den som laddar ner en version
  (ofta IT eller systemägaren) verifierar **signaturen** med cosign mot Sigstore-paketet
  (`oppen-lonekartlaggning.html.sigstore.json`) som ligger bredvid filen på versionens
  releasesida — samma kommando i Windows (PowerShell, `cosign.exe`) och Linux/Mac:
  `cosign verify-blob oppen-lonekartlaggning.html --bundle oppen-lonekartlaggning.html.sigstore.json --certificate-identity-regexp "^https://github\.com/janssonfelix/oppen-lonekartlaggning/\.github/workflows/release\.yml@refs/tags/v" --certificate-oidc-issuer https://token.actions.githubusercontent.com`
  (se `SECURITY.md`). Svaret ska vara `Verified OK`.
  Den som sedan får filen internt jämför dess **SHA-256** med värdet i `RELEASE.txt`. Windows
  (PowerShell): `(Get-FileHash -Algorithm SHA256 oppen-lonekartlaggning.html).Hash` · Linux:
  `sha256sum oppen-lonekartlaggning.html` · Mac (Terminal): `shasum -a 256 oppen-lonekartlaggning.html`.
  Kontrollsumman visar bara att filen inte skadats; att den är äkta visar signaturen.
- **Dataskydd:** all bearbetning sker i webbläsarens minne — inget skickas, inget
  sparas på disk. Det enda som lämnar verktyget är **de filer du själv exporterar**.
  Förvara dem på behörighetsstyrd disk och skicka dem aldrig via okrypterad e-post.

## 1. (Valfritt men rekommenderat) Lär dig verktyget med demodata

1. Klicka **prova med demodata** i välkomstraden på Översikt.
2. Bläddra igenom flikarna och exporterna med syntetisk exempeldata — ingen verklig
   lönedata behövs för att utvärdera. Allt märks tydligt **DEMODATA**.
3. Klicka **"Avsluta demo / rensa"** innan du laddar in er skarpa data.
   (Med en egen lönefil inläst finns **"Rensa all data"** under **Inställningar**, rubriken *Rensa*.)

## 2. Exportera och förbered data ur lönesystemet

Exportera en personalfil (CSV eller XLSX) med dessa kolumner:

| Fält | Obligatoriskt | Kommentar |
|---|---|---|
| BAS-intervall | Ja | Kravnivå/svårighetsgrupp |
| AID / yrkesgrupp | Ja | Yrkeskod/-namn |
| Månadslön | Ja | **Heltidsomräknad** fast månadslön — se *Lönedefinition* nedan |
| Ålder *(eller födelseår)* | Ja | Födelseår tolkas automatiskt till ålder |
| Kön | Ja | K/M, Kvinna/Man m.fl. tolkas automatiskt |
| Poäng *(arbetsvärdering)* | Nej | Valfri kolumn för likvärdigt arbete över BAS-gränser |
| Ansvarskod *(AID)* | Nej | Valfri kolumn: A, B, C, L (ledningsansvar), F, M, 1001, 1002 (särskilt uppdrag). Kolumnen *Ansvar* (ofta ett kostnadsställe) läses aldrig |

- **Lönedefinition:** använd samma lönebegrepp för alla — den fasta månadslönen
  omräknad till heltid. En deltidsanställds faktiska lön jämförd med en heltidsanställds
  ger ett falskt lönegap. Rörliga delar (tillägg, OB, bonus, förmåner) analyseras inte
  av verktyget och ska inte läggas in i lönen; de prövas i genomgången av bestämmelser
  och praxis. Verktyget varnar om många löner ligger under en rimlig heltidsnivå.
- **Teckenkodning** (UTF-8 / Windows-1252 / UTF-16) och avgränsare hanteras
  automatiskt — å/ä/ö blir rätt.
- **All personal ingår.** Alla BAS-intervall analyseras, även chefsnivåerna (K och
  uppåt). Små intervall skyddas av minsta gruppstorlek vid export.
- **Ta INTE med personnummer, namn eller e-post.** Verktyget avvisar filer som
  innehåller sådana kolumner (uppgiftsminimering enligt dataskyddsförordningen).
- **Systemspecifika uttagssteg** (Personec P, Heroma, Visma m.fl.) samt fullständiga
  format- och felsökningsdetaljer: se `datauttag.md`.

## 3. Ladda upp och kvalitetssäkra underlaget

1. Läs in **organisationspaketet** om er organisation har ett — det är **steg 1**, rutan överst
   i filsektionen på Översikt. Det innehåller organisationens ställningstagande,
   jämförelsestatistik och benämningar (se `organisationspaket.md`), så rutorna *Referens* och
   *Jämförelsestatistik* fylls i av sig själva. Dra sedan in eller välj lönefilen i den
   **obligatoriska** rutan (steg 2).
   **Minsta gruppstorlek för redovisning:** fältet ligger under **Inställningar** i sidhuvudet (värdet
   *Minsta gruppstorlek* i flikarnas översta rad är en länk dit). På skärmen visas alla grupper; gränsen gäller
   det som lämnar verktyget (Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder, rapportunderlaget). Standardvärdet är 10: lönemått för grupper med färre personer än så redovisas
   inte där. Ni kan ändra värdet till ett heltal från 2 (högre skärper skyddet). Ett värde under 10
   kräver att ni bekräftar och visas som en varning överst på alla flikar. Värdet står i
   metodbilagan och i exporterad data; under 10 står dessutom meningen *Tröskeln är sänkt från
   standardvärdet 10.* på det som kan spridas för sig, till exempel diagrambilder, kopierade tabeller
   och rapporter. Alla flikar räknas om när värdet
   ändras. Värdet sparas inte mellan gånger men följer med i konfigurationsfilen; en
   konfigurationsfil utan värdet ändrar det inte. *Återställ till 10* sätter tillbaka
   standardvärdet. Medianlön per kön, det råa lönegapet och regressionens ojusterade steg
   ("Endast kön", med den förklarade andelen) visas bara när både kvinnor och män är minst så
   många som tröskeln; annars står ett streck eller en förklaring. Den justerade löneskillnaden
   i Lika arbete visas från regressionens eget fasta golv, 5 av varje kön. I Ålder & karriär
   gäller samma regel för lönegapen, lutningen, trendlinjerna och lådorna per kön; punkterna per
   person i spridningsdiagrammen visas alltid.
2. Känns en kolumn inte igen automatiskt? Använd **kolumnmappnings-guiden** och peka
   ut rätt kolumn. När filen är inläst visar rutan filnamnet; där kan ni **namnge
   organisationen** (namnet syns i diagram, tabeller och exporter) och byta fil. Ge också
   jämförelsestatistiken ett namn i dess ruta.
3. Läs panelen **Underlagets kvalitet**. Fem kriterier — jämförbarhet, statistisk
   styrka, fullständighet, rimlighet och modell — får OK, Varning eller Kritisk, och
   underlaget får samma status som det svagaste. Under kriterierna står detaljerna:
   hur många rader som uteslöts och varför. Sist i panelen listas **extremvärden**
   (enskilda löner som avviker kraftigt inom sitt BAS-intervall) — ofta registerfel. Ser
   något fel ut, rätta i källfilen och ladda om.
4. *(Om ni inte har ett paket)* Läs in ert **lönepolitiska ställningstagande**
   (P10/median/P90 per BAS) och ge det ett namn — Prioritering, Lönepolitik och statusrutan
   i Att göra jämför mot det; utan ställningstagande visar de vad som behöver läsas in.
   Läs även in **jämförelsestatistik** om ni har den — då visas fliken Jämförelsestatistik. Där står
   organisationens P10, median och P90 bredvid jämförelsens för varje yrke, och två diagram visar
   var ni ligger i marknadens spann och vilka yrken som avviker mest. Arbetsvärderingspoäng laddas **inte** upp separat — lägg till kolumnen **Poäng** i strukturfilen (se avsnitt 2).
5. Gå igenom kortet **Att göra** på Översikt. Överst står status mot de fyra lagkraven,
   därunder **Börja här** med de tre viktigaste punkterna och sist alla punkter per
   kategori. Bocka av en punkt när du hanterat den; listan kan exporteras som CSV och
   bockarna följer med i konfigurationsfilen.
6. Läs avsnittet **Var uppstår löneskillnaden?** på Översikt (under Fördjupning). Skillnaden i medellön delas i
   tre delar som tillsammans blir hela skillnaden — diagrammet visar dem som en trappa som landar i hela skillnaden: **BAS-fördelning** (kvinnor och män i
   olika BAS — en fråga om karriärvägar och rekrytering), **AID inom BAS** (olika yrken på
   samma nivå — pröva likvärdigt arbete) och **inom AID och BAS** (olika lön i samma
   arbete — pröva lika arbete). Under varje del står de grupper som bidrar mest i kronor.
   Listan kan skilja sig från de flaggade yrkena i Lika arbete, som sorteras efter hur stor
   skillnaden är i gruppen.

## 4. Genomför kartläggningen — flik för flik

Menyn är numrerad efter processens faser — samma faser som processkartan på Översikt.

**Alla flikar är uppbyggda på samma sätt.** Överst står en rad som säger vad fliken svarar på (*Visa mer* fäller ut
hela förklaringen), sedan urvalet och **nyckeltalen** i en rad, därefter flikens huvudresultat. Under rubriken
**Fördjupning** ligger resten i avsnitt som fälls ut vid behov; varje avsnitt säger sitt viktigaste tal i rubrikraden
också när det är hopfällt.

- **Sök** (fältet i sidhuvudet, snedstreck eller Ctrl+K) hittar ett yrke eller BAS-intervall och markerar det i alla
  diagram och tabeller. Ett klick på en grupp i ett diagram eller en tabellrad gör samma sak; Escape tar bort markeringen.
- **Inställningar** (sidhuvudet) har minsta gruppstorlek, kommun eller region, och valet mellan **vägledande läge**
  (förklaringarna syns) och **kompakt läge** (förklaringarna är undanfällda — för den som kan verktyget).
- Flikarna i huvudflödet (Regler & praxis → Handlingsplan → Dokumentera & exportera) avslutas med en
  **"Klar här? Nästa steg"-rad**. Använd **"Visa beräkningen"**-knapparna vid resultaten för att se hur en siffra
  räknats fram.
- **Tabeller med grafik i raden:** där ett tal jämförs mot lika lön (100 %) är talet också ritat i raden — en punkt
  mot en linje, med ett streck för osäkerheten. Når strecket fram till linjen kan skillnaden bero på slumpen.

1. **Regler & praxis** *(§ 8 — lagrummet står i flikens tooltip)* — gå igenom de sex granskningsområdena. Sätt
   **status** (Ingen risk / Möjlig risk — utreds / Åtgärd krävs / Ej tillämplig) och
   skriv en **anteckning** per område — *på gruppnivå: inga namn eller
   personnummer i fritext.* Värdena följer automatiskt med in i Word-utkastet
   och utskriften.
2. **Lika arbete (§ 9)** — fliken öppnar med en **översikt per BAS-intervall**: antal kvinnor och män, de två
   medianlönerna, skillnaden i kronor och kvinnors lön i procent av mäns med konfidensintervall och status.
   Första avsnittet är **yrkesgrupperna**: kvinnors och mäns medianlön i samma yrkesgrupp, där grupper med
   avvikelse > 5 % flaggas och behöver förklaras med sakliga skäl eller åtgärdas. Diagrammet
   **Yrkesgrupperna mot slumpens gränser** ovanför tabellen visar varje yrkesgrupp mot gruppens storlek: en liten
   grupp kan ha en stor skillnad av ren slump, en stor grupp kan det inte, och grupperna utanför det skuggade
   fältet är de där skillnaden är svår att förklara med slumpen. Därefter kommer Personer att granska, sedan
   skillnaden per BAS-intervall (i procent, i kronor och som lönespridning per kön) och sist det **oförklarade**
   lönegapet (regressionen, trappan som visar vad ålder och nivå förklarar, och Blinder-Oaxaca).
   Kolumnen **Kvinnor nationellt** visar andelen kvinnor i samma yrke i landets kommuner och
   regioner, ur SKR:s personalstatistik (SKR är Sveriges Kommuner och Regioner; perioden står i Om
   verktyget) — ett referensvärde att jämföra er egen könsfördelning mot. Välj under
   **Inställningar** i sidhuvudet om organisationen är en kommun eller en region, så jämförs ni med rätt
   del av statistiken. Samma statistik är reserv för könsfördelningen i Likvärdigt arbete, och
   SKR:s PO-påslag är standardvärde i kostnadsberäkningen; ordlistan förklarar begreppet SKR.
   Yrkesgrupperna är AID-grupper. AID är inte ett arbetsvärderingssystem — grupperna är en
   **utgångspunkt** för lika arbete som ni bekräftar (se bakgrundspanelen i fliken).
   Har lönefilen AID:s **ansvarskod** visas under yrket en rad per ansvarsgrupp
   (ledningsansvar, särskilt uppdrag, inget särskilt ansvar) och raden **Utan ledningsansvar**
   med skillnaden bland dem som inte leder. I regressionen står på en egen rad hur mycket
   ansvaret förklarar; huvudtalet räknar inte bort det — om ansvaret är ett sakligt skäl
   avgör ni.
   Grupper över 5 % märks **skör** om skillnaden kan hamna på 5 % eller under när en
   eller två personer tas bort, annars **stabil**. Flaggan gäller i båda fallen, men i en
   skör grupp avgör enskilda löner — titta särskilt på dem.
   Under yrkesgrupperna finns **Personer att granska**: personer som ligger minst 10 % (du kan
   ändra gränsen) under vad kollegor i samma AID och BAS i samma ålder tjänar. Listan är
   ett stöd för den individuella granskningen, inte ett besked om att lönen är osaklig.
   Slå upp personen med **radnumret** i lönefilen. Listan kan inte exporteras eller
   skrivas ut.
3. **Likvärdigt arbete** — fliken öppnar med diagrammet **Krav mot lön**, där varje yrkesgrupp är en
   punkt (kravnivå vågrätt, medianlön lodrätt): kvinnodominerade grupper under linjen är de som är värda att titta
   närmare på. Granska sedan kandidatparen (kvinnodominerade yrken vs jämförelseyrken); diagrammet
   **Kandidatparen i kronor** visar båda yrkenas medianlön per par. Kraven mäts med **BAS-intervall**, eller med
   **arbetsvärderingspoäng** om lönefilen har kolumnen Poäng — då väljs det
   automatiskt och paren jämförs även över BAS-gränserna. Jämförelseyrkena hämtas i första hand
   ur er egen organisation; jämförelsestatistiken används bara där ett eget
   jämförelseyrke saknas. Den slutliga kravvärderingen gör du utifrån befattningsbeskrivning.
   Fliken visar som standard högst 20 par med en skillnad på minst 5 %; båda gränserna kan
   ändras i fliken (*Min gap* och antal par). Fliken och dess egen export visar par även
   när en grupp är liten — hantera dem därefter.
   Bredvid skillnaden står kolumnen **Justerad för ålder**: jämförelseyrkets lön omräknad till
   det kvinnodominerade yrkets åldersfördelning. Den råa skillnaden är den lagen prövar —
   lönenivån som sådan; den justerade visar hur mycket av skillnaden som kan bero på att
   yrkena har olika åldersstruktur (ett ungt kvinnodominerat yrke mot ett äldre jämförelseyrke
   ger en rå skillnad som krymper när åldern räknats bort). Den räknas bara för par där
   jämförelseyrket finns i er egen organisation med minst 10 personer och minst 5 års
   åldersspridning; annars står ett streck, och verktygstipset säger varför. Bevis-knappen
   visar medelåldern på båda sidor.
   Under kandidatparen finns **Lägre krav, högre lön**: kvinnodominerade yrken som har
   lägre medianlön än ett av organisationens yrken i *lägre* BAS. Det är ofta den tydligaste
   signalen om undervärdering, men BAS är ett grovt mått på krav — pröva paren mot
   befattningsbeskrivningarna.
4. **Struktur & rapportmått** — representation/segregering per nivå (glastak), lönen vid olika percentiler
   för kvinnor och män (om skillnaden är störst bland de lägst eller högst betalda) och EU 2023/970-måtten. Kortet **Per sektor (AID-huvudområde)**
   visar läget sektor för sektor — AID:s 13 huvudområden, t.ex. vård och omsorg, skola och
   teknik: antal, andel kvinnor, medianer, kvinnors lön i procent av mäns (rå och justerad
   för ålder och BAS) och antal punkter i Att göra. Under tabellen står hur mycket av
   skillnaden i hela organisationen som beror på att kvinnor och män arbetar i olika
   sektorer. Pilen vid en sektor öppnar dess yrken i Utforska. Lika arbete, likvärdigt arbete
   och övriga analyser gäller alltid hela organisationen.
5. **Prioritering · Löneöversyn · Handlingsplan** — tre flikar med var sin fråga.
   **Prioritering** svarar på *vad* som bör åtgärdas och vad det kostar: matrisen visar varje grupps
   avvikelse mot referensen och dess storlek, åtgärdslistan rangordnar grupperna, och kostnadsdiagrammet
   visar de grupper som kostar mest att lyfta (med den kumulativa andelen av totalkostnaden).
   **Löneöversyn** svarar på *hur* potten fördelas: lägg in en budget, ett generellt påslag och riktade
   potter per grupp, och se nya löner, vad som gått åt och lönegapet före och efter. En riktad rad kan
   begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå ("höj till") — det som
   tidigare hette Lönerevisionssimulatorn. PO-påslag och beräkningsperiod, som all kostnad räknas med,
   ställs in under **Inställningar** i sidhuvudet. **Handlingsplanen** förifylls ur de två.
   Könsgapet i en grupp visas i Prioritering bara när både
   kvinnorna och männen i gruppen är tillräckligt många för att redovisas; annars räknas
   gruppens prioritet utan könsgapet. I **Löneöversyn** får ni lägga en egen riktad rad på
   vilken grupp som helst, också en grupp under tröskeln — det är er egen simulering. Radens
   belopp visas då på raden och ingår i summorna, även i Löneöversyns Excel-export (*Använt*,
   *Riktat* och, för en kvinnodominerad grupp, *Varav till kvinnodominerade grupper*). För en
   grupp med en enda person bygger beloppet alltså på den personens lön; verktyget säger det i
   en not under raden. Tänk på det innan ni delar exporten. Sparade scenarier (A/B) visar
   rågapet bara när båda könen når den tröskel som gäller just då.
6. **Fördjupa (ej lagkrav)** — **Ålder & karriär** (lön mot ålder, lönegapet per åldersgrupp — var i karriären
   skillnaden finns —, lönespridning över ålder, åldersstruktur och livscykel), **Lönepolitik** (lönerna mot
   referensen: bandkartan, könens läge i spannet och hur stor andel av kvinnorna respektive männen som ligger i
   spannets nedre, mellersta och övre tredjedel) och **Utforska**, som börjar med tabellen **Löneöversikt**
   (hela löneläget per BAS, kön och yrkesgrupp).
7. **Utforska** — bygg egna vyer när en fråga inte besvaras av flikarna
   ovan: välj rader och ev. kolumner, mått och diagramtyp, om du vill se helheten eller
   uppdelat per kön, och begränsa urvalet med
   villkor under **Urval**: på personer (t.ex. "lön minst 30 000 kr", "BAS är inte
   A", alla eller något av villkoren) och på grupper (t.ex. "gap mindre än 95 %").
   Hanteldiagrammet visar gapet per grupp, bubbeldiagrammet om
   kvinnodominerade grupper har lägre lön. Grupper med färre än 10 personer visas
   tonade — mönstrade staplar, streckad kant på punkter — och följer inte med i exporten om
   du inte kryssar i det. Klicka på en grupp
   för att öppna dess gruppdossier. Rader och kolumner kan också vara **Sektor** eller
   **AID-mellannivå** (de fyra första siffrorna, t.ex. "AID 2070xx" för undersköterskor och
   vårdbiträden). När raderna är yrkesgrupper kan små grupper **slås ihop till nästa
   AID-nivå** ("Övriga i AID 2070xx (2 yrken)") — bara i Utforska, aldrig i Lika arbete, där
   en hopslagen grupp inte längre är lika arbete.

Varje diagram har en **Exportera**-knapp i övre högra hörnet: PNG i två storlekar,
SVG (skarp i Word) och diagramdatan som tabell.

## 5. Producera dokumentationen

1. Öppna fliken **Dokumentera & exportera** (fas 4). Gå först igenom **färdigchecken**
   och robusthetspanelen överst — de visar om något har missats.
   De fyra exporterna har var sin uppgift: **Word-utkastet är rapporten**, **Excel-filen är underlaget**,
   **PDF-rapporten är en låst kopia** av Word-utkastet att verifiera mot, och **ZIP-filen är allt** (Word, Excel och
   diagrammen som bilder). Vid varje knapp står vad filen innehåller och vad den utelämnar.
2. Klicka **Word-utkast (dokumentation)** → ett **redigerbart Word-utkast (.docx)** med lönekartläggningens dokumentation laddas ner.
   Verktygets fynd och dina § 8-bedömningar är ifyllda; fyll i de **gula
   `[HR fyller i …]`-fälten** (sakliga skäl, kravvärdering, beslut, samverkan).
   **Spara som `.docx`** när dokumentet är klart — detta blir er dokumentation.
   Utkastet och PDF-rapporten tar bara med grupper som är stora nog att redovisas: BAS
   och kandidatpar under gränsen utelämnas, och det står hur många det gäller.
   Avsnittet **Lönestruktur per BAS-intervall** har tabellerna i den form en skriven
   lönekartläggning brukar ha: en tabell per BAS-intervall (referensen, organisationen, varje
   yrkesgrupp med jämförelsestatistikens nivå under, kvinnor och män — P10, median, P90 och antal)
   med ett fält för er bedömning av intervallet, och sist två tabeller per BAS: löneskillnader inom
   likvärdigt arbete (medellön per kön, andel kvinnor, medelålder) och löneskillnader i åldersgrupper.
   Samma tabeller finns i Excel-filens blad **Per BAS**.
3. **Skriver ni rapporten i en egen mall?** Använd **Rapportunderlag** längre ner i samma
   flik. Överst finns en förteckning över blocken och knappen **Kopiera alla avsnitt**, som
   lägger alla avsnitt i en enda kopiering. Varje avsnitt, varje yrkesgrupp med skillnad över 5 % och varje kandidatpar (där båda grupperna är stora nog att redovisas) har en
   knapp **Kopiera**: faktastycket och tabellen hamnar på urklipp och tar mallens format när
   du klistrar in. Diagrammen kopieras som bild med **Kopiera diagram**. Under varje grupp
   finns **frågor till verksamheten** — skicka dem till ansvarig chef inför bedömningen av
   om skillnaden är saklig.
   Blocket **Var uppstår löneskillnaden?** kommer direkt efter Sammanfattning.
   Efter Likvärdigt arbete kommer blocket **Lägre krav, högre lön**.
4. Komplettera vid behov:
   - **PDF-rapport** via "Generera PDF": en låst kopia av Word-utkastet, att verifiera mot. Under
     *Rapportens innehåll* väljer du vilka avsnitt som följer med i båda (hela dokumentationen,
     ledningsbrief, facklig dialog eller ett eget urval).
   - **Protokollet för gemensam lönebedömning** som underlag för **facklig samverkan**
     (finns i samma flik, under Samverkan och uppföljning).
   - **Excel (alla flikar)** för bilagor och egen vidarebearbetning.
   - **ZIP** när ni vill ha allt på en gång: Word-utkastet, Excel-filen och diagrammen från alla flikar som bilder.
5. **Samverka** med arbetstagarorganisationerna och dokumentera datum, parter och
   synpunkter (fältet finns i Word-utkastet).

## 6. Avsluta och arkivera

- **"Spara konfiguration"** (Dokumentera → *Spara och läsa in arbetet*) om du vill återuppta inställningarna senare (datafilen
  laddas om — själva lönedatan sparas aldrig).
- **"Rensa all data"** (under **Inställningar**, rubriken *Rensa*) när du är klar — eller stäng bara fliken; inget ligger kvar.
- Arkivera de färdiga dokumenten (Word/PDF/Excel) enligt era informationshanterings-
  rutiner. Glöm inte att planera in nästa års lönekartläggning.

---

> Detta är en operativ guide. Metoderna och formlerna beskrivs i verktygets flik
> **Om verktyget**; dataskyddet i `riskanalys.md`.
