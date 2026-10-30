# Pilotchecklista — verifiering med skarp data

Innan bred driftsättning: kör en **pilot** med en verklig lönefil i er egen
webbläsarmiljö och bekräfta att verktyget fungerar hela vägen — inläsning, analys,
utdata och dataskydd. Den automatiska testsviten (över två tusen tester, och ett röktest av det byggda verktyget i tre webbläsare)
täcker logiken; den här
checklistan täcker det bara en körning med **er data** på **er hårdvara** kan visa.

> **Pilotansvarig:** ______________________  **Datum:** __________  **Bygge/SHA:**
> ______________________ (jfr. `RELEASE.txt`)

---

## A. Miljö & integritet
- [ ] Filen öppnas **lokalt utan internet**; inga konsolfel vid uppstart (öppna
      utvecklarverktygens konsol och kontrollera). *Förväntat och ofarligt:* Chrome och
      Edge loggar att direktivet `frame-ancestors` ignoreras i en meta-tagg.
- [ ] **Signaturen är verifierad** med `cosign verify-blob` mot versionens `.sigstore.json`-paket
      (kommandot i `SECURITY.md`); svaret är `Verified OK`.
- [ ] Filens **SHA-256 matchar `RELEASE.txt`** (kontrollerar att den kopia ni använder är den verifierade).
      En organisationsfil har en egen kontrollsumma. *Visa paketet* anger kontrollsumman för den verktygsfil den
      byggdes av, och den ska matcha `RELEASE.txt`; uppgiften står i filen och styrker inte äktheten, så hämta
      organisationsfilen bara från er behörighetsstyrda interna yta.
- [ ] **Nätverksfliken** i utvecklarverktygen visar **noll utgående anrop** under hela
      sessionen (ladda upp, analysera, exportera).

## B. Inläsning med skarp data
- [ ] **Organisationspaketet** (om ni har ett) läses in; organisation, datum och innehåll
      stämmer, och Prioritering och Jämförelse använder ert ställningstagande.
- [ ] **Organisationsfilen** (om systemägaren tagit fram en, `organisationspaket.md` avsnitt 3b) startar
      med paketet inläst: filrutan säger *Inbakat i den här filen*, *Visa paketet* visar rätt innehåll,
      och *Om verktyget* anger versionen filen bygger på.
- [ ] **Paketets låsningar** (om paketet har dem, `organisationspaket.md` §5) gäller: *Inställningar*
      avvisar en minsta gruppstorlek under golvet, rullistan under *Vad lagras?* står på den låsta
      tiden och går inte att ändra, och rutan för små grupper i Utforska är dold. *Rensa all data*
      tar bort låsningarna med paketet.
- [ ] Strukturfilen läses in; **antal rader** stämmer med förväntat.
- [ ] Kolumnerna mappas rätt automatiskt — eller via **kolumnmappnings-guiden**.
- [ ] **å/ä/ö** visas korrekt (testa gärna både en UTF-8- och en Windows-1252-fil).
- [ ] **Underlagets kvalitet** och inläsningsrapporten visar rimliga uteslutningar med
      begripliga skäl.
- [ ] **Lönerna är heltidsomräknade:** ingen varning om löner under heltidsnivå, eller
      en förklaring till den.
- [ ] En fil som (medvetet) innehåller **personnummer/namn/e-post avvisas** med tydligt
      meddelande.
- [ ] Både **CSV och XLSX** fungerar för struktur- och statistikfilerna.

## C. Analys

*Punkterna om många yrkesgrupper, trattdiagrammet och bandkartan, och Word-utkastet i Word (avsnitt D),
är det som bara verklig data kan visa (teknisk-plan §9 punkt 1–3): verktyget är prövat med demodata och ett
påhittat underlag med 42 yrken, och Word-utkastet bara i LibreOffice.*
- [ ] **§ 9-regressionen** körs; ojusterat och **oförklarat** gap samt per-BAS ser
      rimliga ut. (Vid tunt underlag visas "Tolka resultatet med försiktighet".)
- [ ] **Kandidatpar i likvärdigt arbete** genereras i både **BAS-läge** och **poäng-läge** (om
      strukturfilen har kolumnen Poäng).
- [ ] **Struktur/EU-mått, prioritering, löneöversyn och handlingsplan** renderar utan
      fel.
- [ ] **Diagrammen** renderar. Vid mycket stort underlag (tiotusentals rader): notisen
      *"representativt urval … alla beräkningar använder fullständig data"* visas och
      **KPI:erna räknas på hela underlaget**.
- [ ] **§ 8:** status + anteckning kan fyllas i för alla sex granskningsområden.
- [ ] **Många yrkesgrupper:** yrkesgruppstabellen i Lika arbete ryms utan att rulla i sidled, yrkesnamnen går att
      läsa, och grafiken i raderna (punkten mot linjen för lika lön) stämmer med talet bredvid. *Verktyget är
      utvecklat mot ett litet exempelunderlag och ett påhittat större — er fil är det första riktiga provet.*
- [ ] **Trattdiagrammet** (Lika arbete) och **bandkartan** (Jämförelse, avsnittet mot ställningstagandet) går att läsa med era grupper: punkterna
      ligger inte på varandra så att de inte går att skilja åt, och namnen krockar inte. Bandkartan är inte prövad
      med många yrken i samma BAS-intervall — notera i avsnitt G om grupper med nästan samma median täcker
      varandra.
- [ ] **Sök** (sidhuvudet) hittar ett yrke och markerar det i diagram och tabeller; Escape tar bort markeringen.

## D. Utdata
- [ ] **Word-utkastet** laddas ner och **öppnas i Word**; bedömningarna av regler och praxis och
      verktygets fynd är med, och de gula `[HR fyller i]`-fälten syns och går att
      redigera. *Utkastet är under utvecklingen bara prövat i LibreOffice — kontrollera särskilt i Word att*
      *tabellerna (bland dem översikten per BAS-intervall med åtta kolumner) ryms på sidan och att*
      *diagrambilderna syns och har sina bildtexter.*
- [ ] **ZIP-filen** innehåller Word-utkastet, Excel-filen och diagrammen som bilder, och bilderna går att öppna.
- [ ] **PDF-rapporten** (testa de tre urvalen: hela dokumentationen, ledningsbrief och facklig dialog) skrivs ut korrekt med **svensk
      talformatering**.
- [ ] **Protokollet för gemensam lönebedömning** och **Excel (alla flikar)** laddas ner och
      öppnas felfritt.
- [ ] Vid test i demoläge: alla exporter märks **DEMODATA** (i innehållet eller med
      `DEMO_` i filnamnet).
- [ ] **Exportmenyn** på ett diagram ger PNG, SVG och diagramdata som går att öppna.
- [ ] **Utforska:** med rutan "Ta med grupper under 10 i exporten" *urkryssad* saknas
      grupper under 10 i tabellens CSV och i diagramdatan.

## E. Webbläsare & tillgänglighet (på riktig hårdvara — det automatiken inte når)
- [ ] **Firefox** och **Safari** (Mac): uppstart, alla flikar, diagrammen och minst en
      export fungerar. I Safari: prova även *Kopiera diagram* i rapportunderlaget.
- [ ] **Färgkontrast** (axe DevTools eller Lighthouse) — inga allvarliga fel.
- [ ] **Tangentbord:** Tab når sidopanelens knappar, **fokusmarkering syns**, och
      pil-/Home/End-tangenter byter flik.
- [ ] **Läsbarhet på er skärm:** nyckeltalen överst i flikarna, tabellernas text och diagrammens etiketter går att
      läsa utan att zooma. Prova både **vägledande** och **kompakt läge** (Inställningar).

## F. Robusthet & återställning
- [ ] *(Om relevant)* En **mycket stor fil** laddas inom rimlig tid; bakgrundsnotis
      ("förbereder analyser …") visas och försvinner.
- [ ] **"Rensa all data"** tömmer allt (tabeller, diagram, § 8-anteckningar) — även i
      Utforska, Struktur och Löneöversyn.
- [ ] **"Spara konfiguration"** + **"Ladda konfiguration"** återställer inställningar
      (datafilen laddas om).

## G. Sammanfattning & sign-off
- [ ] Inga **blockerande** fel påträffade.
- [ ] Avvikelser/iakttagelser att åtgärda före bredare drift:

  | # | Iakttagelse | Allvar (låg/medel/hög) | Åtgärd |
  |---|---|---|---|
  | 1 |  |  |  |
  | 2 |  |  |  |

- [ ] **Godkänd för bredare driftsättning** — Pilotansvarig: ______________  Datum:
      __________

---

> För användarens arbetsflöde, se `korguide.md`; för dataskyddet `riskanalys.md`; för IT
> `sakerhetsbeskrivning.md` och `tillganglighetsredogorelse.md`; för information till de anställda
> `information-till-anstallda.md` (förslag att stämma av med dataskyddsombudet).
