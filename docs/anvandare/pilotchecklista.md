# Checklista för skarp data — verifiering innan verktyget används på riktigt

Innan verktyget används för organisationens lönekartläggning: kör en **provkörning** med en verklig lönefil i din egen
webbläsarmiljö. Bekräfta att verktyget fungerar hela vägen: inläsning, analys, utdata och dataskydd. Den automatiska
testsviten täcker logiken, med över två tusen tester och ett röktest av det byggda verktyget i tre webbläsare. Den här
checklistan täcker det som bara en körning med **din data** på **din hårdvara** kan visa.

> **Ansvarig:** ______________________  **Datum:** __________  **Bygge/SHA:**
> ______________________ (jfr. `RELEASE.txt`)

---

## A. Miljö & integritet
- [ ] Filen öppnas **lokalt utan internet**; inga konsolfel vid uppstart (öppna
      utvecklarverktygens konsol och kontrollera). *Förväntat och ofarligt:* Chrome och
      Edge loggar att direktivet `frame-ancestors` ignoreras i en meta-tagg.
- [ ] **Signaturen är verifierad** med `cosign verify-blob` mot versionens `.sigstore.json`-paket
      (kommandot i `SECURITY.md`); svaret är `Verified OK`.
- [ ] Filens **SHA-256 matchar `RELEASE.txt`** (kontrollerar att den kopia du använder är den verifierade).
      En organisationsfil har en egen kontrollsumma. *Visa paketet* anger kontrollsumman för den verktygsfil den
      byggdes av, och den ska matcha `RELEASE.txt`. Uppgiften står i filen och styrker inte äktheten. Hämta därför
      organisationsfilen bara från din behörighetsstyrda interna yta.
- [ ] **Nätverksfliken** i utvecklarverktygen visar **noll utgående anrop** under hela
      sessionen (ladda upp, analysera, exportera).

## B. Inläsning med skarp data
- [ ] **Organisationspaketet** (om du har ett) läses in i Filer och kvalitet; organisation, datum och innehåll
      stämmer, och Prioritering och Löneläget använder ditt ställningstagande.
- [ ] **Organisationsfilen** (om systemägaren tagit fram en, `organisationspaket.md` avsnitt 3b) startar
      med paketet inläst. Filrutan säger *Inbakat i den här filen* och *Visa paketet* visar rätt innehåll.
      *Om verktyget* anger versionen filen bygger på.
- [ ] **Paketets låsningar** (om paketet har dem, `organisationspaket.md` §5) gäller. *Inställningar*
      avvisar en minsta gruppstorlek under golvet. Rullistan under *Vad lagras?* står på den låsta
      tiden och går inte att ändra. Rutan för små grupper i Tabeller och egna vyer är dold. *Rensa all data*
      tar bort låsningarna med paketet.
- [ ] Lönefilen läses in; **antal rader** stämmer med förväntat.
- [ ] Kolumnerna mappas rätt automatiskt — eller via **kolumnmappnings-guiden**.
- [ ] **å/ä/ö** visas korrekt (testa gärna både en UTF-8- och en Windows-1252-fil).
- [ ] **Underlagets kvalitet** och inläsningsrapporten (Filer och kvalitet) visar rimliga uteslutningar med
      begripliga skäl.
- [ ] **Lönerna är heltidsomräknade:** ingen varning om löner under heltidsnivå, eller
      en förklaring till den.
- [ ] En fil som (medvetet) innehåller **personnummer/namn/e-post avvisas** med tydligt
      meddelande.
- [ ] Både **CSV och XLSX** fungerar för struktur- och statistikfilerna.

## C. Analys

*Några punkter kan bara verklig data visa (teknisk-plan §9 punkt 1–3): många yrkesgrupper, trattdiagrammet
och bandkartan, och Word-utkastet i Word (avsnitt D). Verktyget är prövat med demodata och ett påhittat
underlag med 42 yrken, och Word-utkastet bara i LibreOffice.*
- [ ] **Regressionen** (Lönestruktur, *Vad blir kvar av löneskillnaden?*) körs; ojusterad och **oförklarad** skillnad
      samt per-BAS ser rimliga ut. (Vid tunt underlag visas "Tolka resultatet med försiktighet".)
- [ ] **Kandidatpar i likvärdigt arbete** genereras i både **BAS-läge** och **poäng-läge** (om
      lönefilen har kolumnen Poäng).
- [ ] **Lönestruktur med EU-måtten, prioritering, löneöversyn och handlingsplan** renderar utan
      fel.
- [ ] **Diagrammen** renderar. Vid mycket stort underlag (tiotusentals rader): notisen
      *"representativt urval … alla beräkningar använder fullständig data"* visas och
      **KPI:erna räknas på hela underlaget**.
- [ ] **Regler & praxis:** status och anteckning kan fyllas i för alla sex granskningsområden.
- [ ] **Många yrkesgrupper:** yrkesgruppstabellen i Lika arbete ryms utan att rulla i sidled, och yrkesnamnen går att
      läsa. Grafiken i raderna (punkten mot linjen för lika lön) stämmer med talet bredvid. *Verktyget är
      utvecklat mot ett litet exempelunderlag och ett påhittat större — din fil är det första riktiga provet.*
- [ ] **Trattdiagrammet** (Lika arbete) och **bandkartan** och diagrammet över **statistikens spann** (Löneläget, avsnittet Överblick) går att läsa med dina grupper.
      Punkterna går att skilja åt, och namnen krockar inte. Bandkartan är inte prövad
      med många yrken i samma BAS-intervall — notera i avsnitt G om grupper med nästan samma median täcker
      varandra.
- [ ] **Sök** (sidhuvudet) hittar ett yrke och markerar det i diagram och tabeller; Escape tar bort markeringen.
      Ett avsnitt går också att söka fram (prova *regression* eller *förra året*), och sidindexet *På den här sidan*
      leder till flikens avsnitt.

## D. Utdata
- [ ] **Word-utkastet** laddas ner och **öppnas i Word**. Bedömningarna av regler och praxis och
      verktygets fynd är med. De gula `[HR fyller i]`-fälten syns och går att
      redigera. *Utkastet är under utvecklingen bara prövat i LibreOffice. Kontrollera särskilt i Word att*
      *tabellerna ryms på sidan, bland dem översikten per BAS-intervall med åtta kolumner. Kontrollera också*
      *att diagrambilderna syns och har sina bildtexter.*
- [ ] **ZIP-filen** innehåller Word-utkastet, Excel-filen och diagrammen som bilder, och bilderna går att öppna.
- [ ] **PDF-rapporten** (testa de tre urvalen: hela dokumentationen, ledningsbrief och facklig dialog) skrivs ut korrekt med **svensk
      talformatering**.
- [ ] **Protokollet för gemensam lönebedömning** och **Excel (alla flikar)** laddas ner och
      öppnas felfritt.
- [ ] Vid test i demoläge: alla exporter märks **DEMODATA** (i innehållet eller med
      `DEMO_` i filnamnet).
- [ ] **Exportmenyn** på ett diagram ger PNG, SVG och diagramdata som går att öppna.
- [ ] **Tabeller och egna vyer:** med rutan "Ta med grupper under 10 i exporten" *urkryssad* saknas
      grupper under 10 i tabellens CSV och i diagramdatan.

## E. Webbläsare & tillgänglighet (på riktig hårdvara — det automatiken inte når)
- [ ] **Firefox** och **Safari** (Mac): uppstart, alla flikar, diagrammen och minst en
      export fungerar. I Safari: prova även *Kopiera diagram* i rapportunderlaget.
- [ ] **Färgkontrast** (axe DevTools eller Lighthouse) — inga allvarliga fel.
- [ ] **Tangentbord:** Tab når sidopanelens knappar, **fokusmarkering syns**, och
      pil-/Home/End-tangenter byter flik.
- [ ] **Läsbarhet på din skärm:** nyckeltalen överst i flikarna, tabellernas text och diagrammens etiketter går att
      läsa utan att zooma. Prova både **vägledande** och **kompakt läge** (Inställningar).

## F. Robusthet & återställning
- [ ] *(Om relevant)* En **mycket stor fil** laddas inom rimlig tid; bakgrundsnotis
      ("förbereder analyser …") visas och försvinner.
- [ ] **"Rensa all data"** tömmer allt (tabeller, diagram, anteckningarna i Regler & praxis) — även i
      Tabeller och egna vyer, Lönestruktur och Löneöversyn.
- [ ] **"Spara konfiguration"** + **"Ladda konfiguration"** (Spara och jämför år) återställer inställningar
      (datafilen laddas om).

## G. Sammanfattning & sign-off
- [ ] Inga **blockerande** fel påträffade.
- [ ] Avvikelser/iakttagelser att åtgärda före bredare drift:

  | # | Iakttagelse | Allvar (låg/medel/hög) | Åtgärd |
  |---|---|---|---|
  | 1 |  |  |  |
  | 2 |  |  |  |

- [ ] **Godkänd för användning** — Ansvarig: ______________  Datum:
      __________

---

> För användarens arbetsflöde, se `korguide.md`; för dataskyddet `riskanalys.md`; för IT
> `sakerhetsbeskrivning.md` och `tillganglighetsredogorelse.md`; för information till de anställda
> `information-till-anstallda.md` (förslag att stämma av med dataskyddsombudet).
