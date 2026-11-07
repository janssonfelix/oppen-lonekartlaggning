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

1. Välj ett demo i välkomstraden på Översikt, "prova med demodata, **litet demo** eller **stort demo**" (samma
   två val, med samma ord, finns i lönefilskortet i **Filer och kvalitet**):
   - **litet demo**: 260 påhittade personer i fem BAS-intervall, snabbt att bläddra i.
     Det är samma underlag som självdiagnostiken bygger på.
   - **stort demo (7 000 personer)**: en påhittad organisation i storlek med en mindre kommun
     eller en stor verksamhet, med BAS-intervall A–K och 30 yrkesgrupper. Här syns verktyget i verklig
     storlek: inlagda löneskillnader i några yrken, ett par för likvärdigt arbete, och små grupper
     som maskeras i exporterna. Inläsningen tar några sekunder.

   Adressen kan också starta demot direkt: `?demo=1` för det lilla och `?demo=stor` för det stora.
2. Bläddra igenom flikarna och exporterna med syntetisk exempeldata — ingen verklig
   lönedata behövs för att utvärdera. Allt märks tydligt **DEMODATA**, och bannern överst säger
   när det är det stora demot.
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

1. Öppna fliken **Filer och kvalitet** (menyns första grupp, *1 · Underlag*; raden *läs in filerna* på Översikt
   leder dit). Läs in **organisationspaketet** om er organisation har ett — det är **steg 1**, rutan överst
   i fliken. Det innehåller organisationens ställningstagande,
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
   ändras. Knappen **Som i exporten** i sidhuvudet visar flikarna som i det som lämnar verktyget — grupper under
   minsta gruppstorlek redovisas inte — med en banner och en streckad ram runt innehållet tills du klickar
   *Visa skärmen igen*. Värdet sparas inte mellan gånger men följer med i konfigurationsfilen; en
   konfigurationsfil utan värdet ändrar det inte. *Återställ till 10* sätter tillbaka
   standardvärdet. Medianlön per kön, det råa lönegapet och regressionens ojusterade steg
   ("Endast kön", med den förklarade andelen) visas bara när både kvinnor och män är minst så
   många som tröskeln; annars står ett streck eller en förklaring. Den justerade löneskillnaden
   (regressionen i Lönestruktur och talet i Lika arbetes nyckeltal) visas från regressionens eget fasta golv,
   5 av varje kön. I Ålder & karriär
   gäller samma regel för lönegapen, lutningen, trendlinjerna och lådorna per kön; punkterna per
   person i spridningsdiagrammen visas alltid.
2. Känns en kolumn inte igen automatiskt? Använd **kolumnmappnings-guiden** och peka
   ut rätt kolumn. När filen är inläst visar rutan filnamnet; där kan ni **namnge
   organisationen** (namnet syns i diagram, tabeller och exporter) och byta fil. Ge också
   jämförelsestatistiken ett namn i dess ruta.
3. Läs avsnittet **Underlagets kvalitet** i samma flik. Fem kriterier — jämförbarhet, statistisk
   styrka, fullständighet, rimlighet och modell — får OK, Varning eller Kritisk, och
   underlaget får samma status som det svagaste. Under kriterierna står detaljerna:
   hur många rader som uteslöts och varför. Sist i panelen listas **extremvärden**
   (enskilda löner som avviker kraftigt inom sitt BAS-intervall) — ofta registerfel. Ser
   något fel ut, rätta i källfilen och ladda om.
4. *(Om ni inte har ett paket)* Läs in ert **lönepolitiska ställningstagande**
   (P10/median/P90 per BAS) och ge det ett namn — Prioritering, Löneläget och statusrutan
   i Att göra jämför mot det; utan ställningstagande visar de vad som behöver läsas in.
   Läs även in **jämförelsestatistik** om ni har den. Fliken **Löneläget** går att öppna när underlaget och minst
   en referens är inlästa (se avsnitt 4), och visar överblicken mot båda, avsnittet mot ställningstagandet och avsnittet mot
   statistiken, där organisationens P10, median och P90 står bredvid statistikens för varje yrke och två
   diagram visar var ni ligger i marknadens spann och vilka yrken som avviker mest. Arbetsvärderingspoäng laddas **inte** upp separat — lägg till kolumnen **Poäng** i strukturfilen (se avsnitt 2).
5. Gå igenom kortet **Att göra** på Översikt. Överst står status mot de fyra lagkraven,
   därunder **Börja här** med de tre viktigaste punkterna och sist alla punkter per
   kategori. Bocka av en punkt när du hanterat den; listan kan exporteras som CSV och
   bockarna följer med i konfigurationsfilen. Raden överst på Översikt säger vad som är inläst, och knappen
   **Filer och kvalitet** i den leder tillbaka till filrutorna.

## 4. Genomför kartläggningen — flik för flik

Menyn följer rapportens ordning, och processkartan på Översikt har samma faser:

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
hela förklaringen), sedan urvalet och **nyckeltalen** i en rad, därefter flikens huvudresultat. Under rubriken
**Fördjupning** ligger resten i avsnitt som fälls ut vid behov; varje avsnitt säger sitt viktigaste tal i rubrikraden
också när det är hopfällt.

- **Inställningar** (sidhuvudet) har minsta gruppstorlek, kommun eller region, **lönemånaden** (skrivs ovanför
  tabellerna per AID-kod och BAS-intervall; tom skrivs ut som *inte angiven*), PO-påslag och beräkningsperiod,
  **Prioriteringens trösklar och viktning** (se punkt 7 nedan), och valet mellan **vägledande läge**
  (förklaringarna syns) och **kompakt läge** (förklaringarna är undanfällda — för den som kan verktyget).
- Flikarna från Regler & praxis till Rapporttext avslutas med en **"Klar här? Nästa steg"-rad** som följer menyn:
  Regler & praxis → Löneläget → Lika arbete → Likvärdigt arbete → Lönestruktur → Ålder & karriär → Prioritering →
  Löneöversyn → Handlingsplan → Rapporttext → Exportera. Löneläget och Ålder & karriär hoppas över när de är låsta,
  och utan lönefil står raden bara i Regler & praxis och Handlingsplan; leder den då till en låst flik öppnas Filer
  och kvalitet med lönefilskortet. Använd **"Visa beräkningen"**-knapparna vid resultaten för att se hur en siffra
  räknats fram.
- **Tabeller med grafik i raden:** där ett tal jämförs mot lika lön (100 %) är talet också ritat i raden — en punkt
  mot en linje, med ett streck för osäkerheten. Når strecket fram till linjen kan skillnaden bero på slumpen.

### Hitta rätt: sök och sidindex

- **Sök** (fältet i sidhuvudet, snedstreck eller Ctrl+K) hittar ett yrke eller BAS-intervall och markerar det i alla
  diagram och tabeller. Ett klick på en grupp i ett diagram eller en tabellrad gör samma sak; Escape tar bort markeringen.
  Sökningen hittar också funktioner, också innan lönefilen är inläst: flikarnas avsnitt (*ögonblicksbild*, *förra
  året*, *regression*), exporterna och fälten i Inställningar (*PO-påslag*, *minsta gruppstorlek*). Det vanliga
  ordet räcker, också när avsnittet heter något annat: *regression* hittar *Vad blir kvar av lönegapet?* i
  Lönestruktur. Träfflistan har grupperna först och funktionerna under rubriken *Funktioner*, med fliken de står i.
  Ett val fäller ut avsnittet och flyttar fokus dit, eller öppnar Inställningar med fokus i fältet. Ett avsnitt i en
  flik som kräver lönefilen säger *kräver lönefil* och leder till Filer och kvalitet.
- **På den här sidan** är flikens sidindex: en lista över flikens avsnitt och kort som syns just nu. I ett brett
  fönster (från 1920 punkter) står listan i marginalen till höger om innehållet; i ett smalare fönster är den en rad
  överst, *På den här sidan: …*, som följer med när sidan rullas, säger vilket avsnitt du är i och fälls ut med ett
  klick. Ett klick på ett avsnitt i listan fäller ut det, rullar fram det och flyttar fokus dit. Dolda avsnitt står
  inte i listan, en flik med färre än tre avsnitt har ingen, och listan byggs om när fliken ritas om, till exempel
  efter att lönefilen lästs in.

### Dossierer: en yrkesgrupp eller ett BAS-intervall på en sida

- **Gruppdossiern** samlar allt verktyget vet om en yrkesgrupp i ett BAS-intervall. Den öppnas från tabellraderna,
  från en grupp i Egna vyer och från raden om markeringen (*Öppna gruppdossier*).
- **BAS-dossiern** samlar ett BAS-intervall i rapportens ordning, så att avsnittet om intervallet kan skrivas utan att
  hämta det ur fem flikar: nyckeltalen (antal, kvinnor och män, median, P10–P90) och läget mot ställningstagandets
  rad för intervallet; yrkesgrupperna i intervallet med antal, medianer per kön, kvinnors median i procent av mäns
  och samma status som i Lika arbete (statusen gäller hela yrket; finns yrket också i andra intervall säger en not
  det), med en knapp till varje grupps dossier; kandidatparen i Likvärdigt arbete där
  det kvinnodominerade yrket ligger i intervallet, och paren *Lägre krav, högre lön*; medianlönen per åldersgrupp
  (–34, 35–49, 50–) och kön, med en länk till Ålder & karriär med intervallet valt; och intervallets rad ur förra
  årets bokslut när en konfigurationsfil från förra året är inläst. Den öppnas med knappen *BAS-dossier* i
  Löneöversiktens BAS-rader (Tabeller och egna vyer), ikonen bredvid intervallets namn i Lönestrukturs tabell per
  BAS-intervall, *Hela BAS …* i gruppdossiern, *Öppna BAS-dossiern* i raden om markeringen, och i sökrutan: en
  BAS-träff har raden *Öppna BAS-dossiern för BAS …* under sig (pilarna och Retur når den), och sökordet
  *BAS-dossier* (eller *intervall*, *per intervall*) öppnar dialogen för det första intervallet. Väljaren överst byter
  intervall. **Kopiera som text** ger dossiern i rapportens form (rubriken *BAS-intervall …* och ett stycke per
  punkt), byggd som exporterna: grupper under minsta gruppstorlek står bara med namn, utan lönemått.
- Ingen av dossiererna dokumenterar sakliga skäl; de samlar underlaget för den bedömningen.

1. **Regler & praxis** *(§ 8 — lagrummet står i flikens tooltip)* — gå igenom de sex granskningsområdena. Sätt
   **status** (Ingen risk / Möjlig risk — utreds / Åtgärd krävs / Ej tillämplig) och
   skriv en **anteckning** per område — *på gruppnivå: inga namn eller
   personnummer i fritext.* Värdena följer automatiskt med in i Word-utkastet
   och utskriften.
2. **Löneläget** *(fördjupning, inget lagkrav)* — fliken går att öppna när lönefilen och minst en referens
   (ställningstagandet eller jämförelsestatistiken) är inlästa; med en lönefil men utan referens döljs den i menyn. Den har tre avsnitt.
   *Överblick* visar per yrkesgrupp var löneläget och statistiken ligger mot
   ställningstagandet, som är referenspunkten: skillnaden percentil för percentil, läget i spannet (0 = referensens
   P10, 100 = dess P90), mönstret i ord, ett förslag på vilken referens som säger något om gruppen, en bild med
   de tre spannen och tabellen statistiken mot ställningstagandet. Ligger både löneläget och statistiken över
   ställningstagandet har det halkat efter marknaden; ligger bara löneläget över har organisationen gått före.
   Förslaget är ett förslag, ingen regel. *Mot ställningstagandet* är bandkartan, könens läge i spannet och hur stor
   andel av kvinnorna respektive männen som ligger i spannets nedre, mellersta och övre tredjedel. *Mot
   jämförelsestatistiken* är tabellen och diagrammen mot statistiken, med filter på BAS och sektor; tabellen visar
   medianens kolumner, P10 och P90 ligger bakom *Fler kolumner* (Kopiera, CSV, Excel och utskriften tar med alla).
3. **Lika arbete (§ 9)** — fliken öppnar med **yrkesgrupperna**: kvinnors och mäns medianlön i samma yrkesgrupp,
   där grupper med avvikelse > 5 % flaggas och behöver förklaras med sakliga skäl eller åtgärdas. Diagrammet
   **Yrkesgrupperna mot slumpens gränser** under tabellen visar varje yrkesgrupp mot gruppens storlek: en liten
   grupp kan ha en stor skillnad av ren slump, en stor grupp kan det inte, och grupperna utanför det skuggade
   fältet är de där skillnaden är svår att förklara med slumpen. Nyckeltalen överst tar med hur stor skillnaden är
   när ålder och nivå räknats bort (regressionen, som står i Lönestruktur). Under Fördjupning kommer Personer att
   granska och avsnitten **Lika arbete AID x BAS** och **Analys på individnivå**, som har tabellerna i den form
   en skriven lönekartläggning brukar ha: en rad per yrkesgrupp och BAS-intervall med kvinnors median i procent av
   mäns mot slumpens gränser och en bedömning, och en arbetslista över grupperna där något kön är för litet för
   lönemått, att fylla i efter den individuella granskningen. Båda finns som blad i Excel-filen.
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
   med skillnaden bland dem som inte leder. I regressionen (Lönestruktur) står på en egen rad hur mycket
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
4. **Likvärdigt arbete** — fliken öppnar med diagrammet **Krav mot lön**, där varje yrkesgrupp är en
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
   Avsnitten **Likvärdigt arbete** per BAS-intervall och **Hierarkisk jämförelse** klassar varje yrkesgrupp i varje
   intervall som kvinnodominerad, könsblandad eller mansdominerad, med en sammanfattning per intervall, och listar
   par där ett arbete i lägre BAS som inte är kvinnodominerat har högre medianlön än ett kvinnodominerat arbete i
   högre BAS. Definitionen av kvinnodominerat väljs i flikens inställningar: **DO** (mer än tröskeln, standard)
   eller **SCB** (tröskeln eller mer); valet står i Excel-bladen och i metodbladet.
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
5. **Lönestruktur** — varför gapet sitter där det sitter. Fliken öppnar med slutsatserna; under
   Fördjupning är bara representationen utfälld, resten fälls ut vid behov. **Representation per BAS-nivå** visar
   segregeringen (sjunker andelen kvinnor mot högre nivåer?), **Organisationen som karta** varje yrkesgrupp som en
   yta efter antal personer och andel kvinnor, **Var i lönefördelningen sitter gapet?** lönen vid
   olika percentiler för kvinnor och män (om skillnaden är störst bland de lägst eller högst betalda), och
   **EU 2023/970 — lönerapportmått** måtten en större arbetsgivare ska kunna redovisa. Avsnittet **Per sektor**
   visar läget sektor för sektor — AID:s 13 huvudområden, t.ex. vård och omsorg, skola och
   teknik: antal, andel kvinnor, medianer, kvinnors lön i procent av mäns (rå och justerad
   för ålder och BAS) och antal punkter i Att göra. Under tabellen står hur mycket av
   skillnaden i hela organisationen som beror på att kvinnor och män arbetar i olika
   sektorer. Pilen vid en sektor öppnar dess yrken i Tabeller och egna vyer. Lika arbete, likvärdigt arbete
   och övriga analyser gäller alltid hela organisationen.
   **Var uppstår löneskillnaden?** delar skillnaden i medellön i
   tre delar som tillsammans blir hela skillnaden — diagrammet visar dem som en trappa som landar i hela skillnaden: **BAS-fördelning** (kvinnor och män i
   olika BAS — en fråga om karriärvägar och rekrytering), **AID inom BAS** (olika yrken på
   samma nivå — pröva likvärdigt arbete) och **inom AID och BAS** (olika lön i samma
   arbete — pröva lika arbete). Under varje del står de grupper som bidrar mest i kronor.
   Listan kan skilja sig från de flaggade yrkena i Lika arbete, som sorteras efter hur stor
   skillnaden är i gruppen.
   **Lönegap per BAS-intervall** är en tabell per intervall med antal kvinnor och män, de två medianlönerna,
   skillnaden i kronor och kvinnors lön i procent av mäns med konfidensintervall och status, och lönespridningen
   per kön; **Könsfördelning per BAS-intervall** visar var ett kön är under 40 %. Sist kommer
   **Vad blir kvar av lönegapet?**, det **oförklarade** lönegapet: regressionen, där ni i panelen
   *Förklaringsmodell* kan välja om ålder, nivå och yrkesgrupp ska räknas bort och se vad varje variabel tillför,
   trappan som visar vad varje vald variabel förklarar, och Blinder-Oaxaca. En bortvald variabel redovisas som
   kontrollerad, med ert skäl, också i rapporten.
6. **Ålder & karriär** *(fördjupning, inget lagkrav)* — lön mot ålder, lönegapet per åldersgrupp (var i karriären
   skillnaden finns), lönespridning över ålder, lönefördelningen för kvinnor och män, åldersstruktur och livscykel.
7. **Prioritering · Löneöversyn · Handlingsplan** — tre flikar med var sin fråga.
   **Prioritering** svarar på *vad* som bör åtgärdas och vad det kostar: matrisen visar varje grupps
   avvikelse mot referensen och dess storlek, åtgärdslistan rangordnar grupperna, och kostnadsdiagrammet
   visar de grupper som kostar mest att lyfta (med den kumulativa andelen av totalkostnaden).
   **Löneöversyn** svarar på *hur* potten fördelas: lägg in en budget, ett generellt påslag och riktade
   potter per grupp, och se nya löner, vad som gått åt och lönegapet före och efter. En riktad rad kan
   begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå ("höj till") — det som
   tidigare hette Lönerevisionssimulatorn. PO-påslag och beräkningsperiod, som all kostnad räknas med,
   ställs in under **Inställningar** i sidhuvudet, liksom Prioriteringens trösklar (granskningsgräns, *Börja
   här*-tröskel, uppföljnings- och över referens-gräns) och viktningen av prioriteringsindexet, under rubriken
   *Prioritering*. Raden *Trösklar och viktning* i fliken Prioritering säger om värdena är ändrade, och *Ändra*
   öppnar Inställningar där. **Handlingsplanen** förifylls ur de två; egna åtgärder läggs
   till med *Lägg till rad* och följer med i exporterna som de förifyllda. Kortet **Samverkan & uppföljning** i
   Handlingsplan har momenten att bocka av och knapparna för **protokollet för gemensam lönebedömning** och
   **handlingsplanen** som Excel.
   Könsgapet i en grupp visas i Prioritering bara när både
   kvinnorna och männen i gruppen är tillräckligt många för att redovisas; annars räknas
   gruppens prioritet utan könsgapet. I **Löneöversyn** får ni lägga en egen riktad rad på
   vilken grupp som helst, också en grupp under tröskeln — det är er egen simulering. Radens
   belopp visas då på raden och ingår i summorna, även i Löneöversyns Excel-export (*Använt*,
   *Riktat* och, för en kvinnodominerad grupp, *Varav till kvinnodominerade grupper*). För en
   grupp med en enda person bygger beloppet alltså på den personens lön; verktyget säger det i
   en not under raden. Tänk på det innan ni delar exporten. Sparade scenarier (A/B) visar
   rågapet bara när båda könen når den tröskel som gäller just då.
8. **Tabeller och egna vyer** (under 4 · Rapport) har två avsnitt: **Löneöversikt — alla BAS-intervall** (den fasta
   tabellen: hela löneläget per BAS, kön och yrkesgrupp) och **Egna vyer**. I
   Egna vyer bygger du det som en fråga kräver när flikarna ovan inte besvarar den: välj rader och ev. kolumner, mått
   och diagramtyp (väljaren har de vanliga typerna överst och resten, bland dem värmekartan och regnmolnet, under
   *Fler diagramtyper*), om du vill se helheten eller
   uppdelat per kön, och begränsa urvalet med
   villkor under **Urval**: på personer (t.ex. "lön minst 30 000 kr", "BAS är inte
   A", alla eller något av villkoren) och på grupper (t.ex. "gap mindre än 95 %").
   Hanteldiagrammet visar gapet per grupp, bubbeldiagrammet om
   kvinnodominerade grupper har lägre lön. Grupper med färre än 10 personer visas
   som alla andra på skärmen men följer inte med i exporten om du inte kryssar i det. Klicka på en grupp
   för att öppna dess gruppdossier. Rader och kolumner kan också vara **Sektor** eller
   **AID-mellannivå** (de fyra första siffrorna, t.ex. "AID 2070xx" för undersköterskor och
   vårdbiträden). När raderna är yrkesgrupper kan små grupper **slås ihop till nästa
   AID-nivå** ("Övriga i AID 2070xx (2 yrken)") — bara i Tabeller och egna vyer, aldrig i Lika arbete, där
   en hopslagen grupp inte längre är lika arbete.

Varje diagram har en **Exportera**-knapp i övre högra hörnet: PNG i två storlekar,
SVG (skarp i Word) och diagramdatan som tabell.

**Egna tabeller i rapporten.** Ovanför tabellen i Tabeller och egna vyer finns **Lägg till i rapporten**: ge vyn
ett namn och lägg till den, så står den som en egen tabell i avsnittet *Egna tabeller* i
Word-utkastet och PDF-rapporten, i bladet *Egna tabeller* i Excel-filen och som block under *Egna
tabeller från Tabeller och egna vyer* i rapportunderlaget (fliken Rapporttext). Kryssa i **En tabell
per BAS-intervall** för att få samma tabell upprepad för varje intervall. Systemägaren kan lägga
tabellerna i organisationspaketet, så att alla handläggare får samma. Det är vyns recept som
sparas (rader, kolumner, mått och urval), inte talen: tabellen räknas om med minsta gruppstorlek
när rapporten byggs, och recepten följer med i konfigurationsfilen. Under *Exportera* → *Rapportens innehåll* kan
ni ordna om och ta bort tabellerna.

## 5. Producera dokumentationen

1. Öppna fliken **Exportera** under *4 · Rapport*. Gå först igenom **färdigchecken**
   och robusthetspanelen direkt under den — de visar om något har missats.
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
   Samma tabeller finns i Excel-filens blad **Per BAS**. Excel-filen har också de fyra bladen **Lika arbete AID x
   BAS**, **Likvärdigt arbete**, **Hierarkisk jämförelse** och **Analys på individnivå**, med rapportens kolumnnamn
   och lönemånaden från Inställningar på raden ovanför tabellen. Avsnittet följer ett **recept** som ni kan
   ändra under *Rapportens innehåll*: upprepa per BAS-intervall eller per sektor, vilka rader och
   mått tabellerna ska ha, åldersgränserna, och om summeringstabellerna ska med. *Återställ
   standard* ger utkastets form tillbaka.
3. **Skriver ni rapporten i en egen mall?** Öppna fliken **Rapporttext**. Avsnittet **Auto-rapportutkast** har
   fynden i klarspråk att redigera och kopiera (*Återskapa* skriver över med ett färskt utkast). Väljaren **Omfång**
   ovanför textrutan avgör om utkastet bara har helheten (*Hela organisationen*) eller också ett stycke per
   BAS-intervall (*Hela organisationen + per BAS-intervall*, standard): varje intervall med minst k personer får samma
   text som BAS-dossiern, med förra året när ett bokslut är inläst, och slutar med raden *[HR fyller i] Bedömning*.
   Valet sparas inte i konfigurationsfilen; *Återskapa* följer det, och ett redigerat utkast skrivs inte över när
   du byter. Samma stycken står i Word-utkastets och PDF-rapportens avsnitt **Lönekartläggning per BAS-intervall**
   (med intervallets yrkesgruppstabell; avsnittet väljs bort under *Rapportens innehåll*) och i rapportunderlagets
   grupp **Per BAS-intervall**. Avsnittet
   **Rapportunderlag** har de färdiga avsnitten att klistra in. Överst i rapportunderlaget finns en förteckning över blocken och knappen **Kopiera alla avsnitt**, som
   lägger alla avsnitt i en enda kopiering. Varje avsnitt, varje yrkesgrupp med skillnad över 5 % och varje kandidatpar (där båda grupperna är stora nog att redovisas) har en
   knapp **Kopiera**: faktastycket och tabellen hamnar på urklipp och tar mallens format när
   du klistrar in. Diagrammen kopieras som bild med **Kopiera diagram**. Under varje grupp
   finns **frågor till verksamheten** — skicka dem till ansvarig chef inför bedömningen av
   om skillnaden är saklig.
   Blocket **Var uppstår löneskillnaden?** kommer direkt efter Sammanfattning.
   Efter Likvärdigt arbete kommer blocket **Lägre krav, högre lön**.
4. Komplettera vid behov:
   - **PDF-rapport** via "Generera PDF": en låst kopia av Word-utkastet, att verifiera mot. Fältet **Organisation**
     intill knappen är namnet på rapportens försättsblad; det hämtas från organisationspaketet när ett är inläst. Under
     *Rapportens innehåll* väljer du vilka avsnitt som följer med i båda (hela dokumentationen,
     ledningsbrief, facklig dialog eller ett eget urval). Sist i listan står **Bilaga: gruppdossierer**, som är
     förvald av eftersom den kan bli lång: kryssa i den så får rapporten en gruppdossier per yrkesgrupp där både
     kvinnor och män når minsta gruppstorlek, med samma text som dossierns knapp *Kopiera*. BAS-intervallens
     dossierer står redan i avsnittet *Lönekartläggning per BAS-intervall*.
   - **Protokollet för gemensam lönebedömning** som underlag för **facklig samverkan**
     (i Exportera, och som knapp i kortet *Samverkan & uppföljning* i Handlingsplan).
   - **Excel (alla flikar)** för bilagor och egen vidarebearbetning.
   - **ZIP** när ni vill ha allt på en gång: Word-utkastet, Excel-filen och diagrammen från alla flikar som bilder.
   - Raden under exporterna länkar till flikarna med egna underlag: **Likvärdigt arbete** (kandidatparen),
     **Lönestruktur** (EU-rapportmåtten), **Prioritering** (åtgärdslistan) och **Löneöversyn** (prognosen). Deras
     exporter finns i respektive flik.
5. **Samverka** med arbetstagarorganisationerna och dokumentera datum, parter och
   synpunkter (fältet finns i Word-utkastet).

## 6. Avsluta och arkivera

- **"Spara konfiguration"** (fliken **Spara och jämför år** under *Arbetet*, avsnittet *Spara/ladda konfiguration*)
  om du vill återuppta inställningarna senare (datafilen laddas om — själva lönedatan sparas aldrig). Filen bär också **årets bokslut**: nyckeltal, en rad per yrkesgrupp
  där båda könen når minsta gruppstorlek, en rad per BAS-intervall med minst så många personer (antal, P10, median
  och P90) och Att göra-punkternas läge. Läs in filen nästa år, så visar
  **Jämförelse med förra året** (samma flik) vad som ändrats: nyckeltalen sida vid sida, **löneutvecklingen per
  BAS-intervall** (P10, median och P90 förra året och i år, förändringen i kronor och procent, och medianen som en
  hantel), **lönespridningen** per BAS-intervall och per flaggad yrkesgrupp ((P90 − P10) / median, i procent av
  medianen; streck när förra årets fil saknar måttet), vilka yrkesgrupper som
  är flaggade båda åren, nya och inte längre flaggade, och vilka av förra årets öppna punkter som är klara. En fil
  sparad med en äldre version saknar raderna per BAS-intervall; panelen säger det, och resten av jämförelsen fungerar.
  Sparades förra årets fil med en lägre minsta gruppstorlek än årets läses båda åren med den högre gränsen. En
  yrkesgrupp som var flaggad förra året men då hade ett kön under den högre gränsen räknas därför som **ny** i år (inte
  som flaggad båda åren) om den är flaggad nu, och förra årets gap för den visas inte. Det är avsiktligt: ett mått
  för en grupp under årets gräns lämnar aldrig verktyget. Panelen säger det i sin not.
  Samma jämförelse följer med som ett avsnitt i Word-utkastet och PDF-rapporten, som ett block i rapportunderlaget
  och som ett diagram där varje yrkesgrupp visas som ett streck (förra året) och en punkt (i år). Tabellen och hanteln
  per BAS-intervall följer med på samma sätt: tabellen i rapportens avsnitt och i rapportunderlagets block, hanteln
  som bild i Word-utkastet, PDF-rapporten och ZIP-filen.
- **"Rensa all data"** (under **Inställningar**, rubriken *Rensa*) när du är klar — eller stäng bara fliken; inget ligger kvar.
- Arkivera de färdiga dokumenten (Word/PDF/Excel) enligt era informationshanterings-
  rutiner. Glöm inte att planera in nästa års lönekartläggning.

---

> Detta är en operativ guide. Metoderna och formlerna beskrivs i verktygets flik
> **Om verktyget**; dataskyddet i `riskanalys.md`.
