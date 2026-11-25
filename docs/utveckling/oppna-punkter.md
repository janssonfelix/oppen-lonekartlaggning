# Öppna punkter

Kända brister och obesvarade frågor, så att de inte lever bara i en konversationstråd. Numren byts inte, eftersom kod,
tester och dokument pekar på dem; ett nummer som saknas är en avslutad punkt. En avslutad punkt stryks, och det som
beslutades står i referensen för området eller i beslutsloggen. Syfte och avgränsning står i [`mal.md`](mal.md).

**Användning och prövning:**
1. **Ingen användare har provat gränssnittet och diagrammen med verklig data**; de är sedda med demodatan och ett
   påhittat större underlag (42 AID-etiketter). Checklistan för skarp data (`pilotchecklista.md`) har punkter för det
   som inte går att pröva utan verklig data.
3. **Punkter som täcker varandra i bandkartan** när många AID-etiketter i samma BAS-intervall har nästan samma
   median. *Krav mot lön* flyttar isär sådana grupper i sidled, och prioriteringsmatrisens etiketter flyttas isär
   uppåt; bandkartan är inte prövad med många AID-etiketter. Bör bedömas med verklig data.

**Prestanda:**
5. **Regressionen räknas om vid varje omritning** och får inte sparas mellan flikarna (ADR-17), omkring 0,3 s per
   körning och en eller två gånger per flik: inom ett varv räknas den en gång och skickas vidare (Lika arbete; i
   Lönestruktur regressionskortet och livscykeln), men ett block som ritas efter fliken är ett eget varv. Det märks vid första besöket på en flik och efter en ändring; ett andra
   besök utan ändring visar den färdigritade fliken (ADR-81). Senaste mätningen (`npm run perf`, Chromium, 55 000
   syntetiska rader, 2026-11-15): uppladdning till klart gränssnitt ~3,7 s (budget 5 s) och till klara
   bakgrundsanalyser ~7,5 s; en ändrad minsta gruppstorlek tar 1,9 s. Äldre mätningar står i git-historiken.

**Kod och bygge:**
6. **En arbetare i testkörningen kraschar ibland i Node** (SIGSEGV, V8:s skräpsamlare). Punkten avslutades
   2026-11-23, efter 80 framkallningsförsök på Node 22 och 24, 25 CI-körningar och åtta hela kontroller lokalt utan
   krasch, och öppnades igen 2026-11-24: i en hel kontroll lokalt (Node 22.22.2) dog arbetaren med
   `tests/start-och-meny-app.test.js`, och omkörningen i `tools/test.mjs` gick igenom. Samma dag kördes hela sviten
   20 varv i följd (Node 22.22.2, `node tools/test.mjs`): i två varv dog en arbetare med SIGSEGV, med
   `tests/ktroskel-utdata.test.js` och `tests/struktur-flikar.test.js`, och omkörningen gick igenom båda gångerna.
   Kraschen följer alltså ingen fil; alla tre filerna ritar verktyget i jsdom. Med skräpsamlaren i en tråd
   (`--single-threaded-gc` i arbetarna) gav 20 varv ingen krasch och samma tid; 0 mot 2 av 20 skiljer sig inte säkert
   (p ≈ 0,5), så inställningen är inte ändrad. Omkörningen står kvar som skydd;
   orsaken är inte funnen.
28. **Testsviten tar omkring tre minuter lokalt och två till fyra per jobb i CI** (delad på fyra jobb, mätt
    2026-11-22: omkring 2 050 s sammanlagt på tolv arbetare). Väntetiden för en pull request sätts av röktestet i
    webbläsarna (4,5–5,5 min), inte av sviten. Filerna som ritar verktyget i jsdom står för nästan hela tiden, och
    k-tröskelns filer för en fjärdedel. Delade fönster provades 2026-11-22 och kastades: i de fem filer som skapade
    flest fönster gick bara 39 av 330 att dela, eftersom de flesta apptester ändrar fönstret. Tas upp igen om sviten
    blir det som sätter väntetiden i CI.
    *Framtida utveckling (mätt 2026-11-23):* när flikarnas regler flyttade till vymodeller (ADR-99) och 31 dubbletter
    i jsdom ersattes av tester i Node gick sviten från 201 till 199 s, omkring 1 %. Tiden går till tre filer som ritar
    och exporterar: k-invarianten (100 s), start och meny (79 s) och diagramritaren (68 s). De har inga dubbletter
    att ta bort.
    *Invarianten i Node prövad och kastad (mätt 2026-11-24):* av `tests/ktroskel-invarianter.test.js` 112 s går
    omkring 60 s till att bygga och söka igenom exporterna (I4), 30 s till I6, 14 s till I1–I1b och 6 s till I7.
    Exporterna (Word, Excel, ZIP, utskrift) når inte vymodellerna, så I4 kan inte flyttas till Node utan att S4 vaktas
    sämre. I1–I1b och I6 har redan sina regler i Node (`vymodeller.test.js`, `figur.test.js`), och jsdom prövar
    kopplingen; att pröva I6 för ett diagram i stället för fem sparar omkring 24 s processortid, omkring 1 % av sviten.

**Efter bytet till AID:s ord (ADR-74, 2026-11-15):**
26. **Utseendet med de nya orden är prövat i webbläsare och LibreOffice, inte i Word och Excel.** Mot bygget före
    bytet, med demodatan och det stora demot, hamnar ingen diagramtext utanför eller ovanpå annan text, och ingen flik
    får vågrät rullning. Kolumnrubrikerna bryts bara mellan ord och beloppen står på en rad med «kr» vid 1 100–1 440
    punkter (vakt i `tools/browser-smoke/layout.mjs`). PDF-rapportens tabeller ryms på sidan med och utan webbläsarens
    avstavning (vakt i `tools/browser-smoke/exporter.mjs`). Breda tabeller får rulla i sidled inne i sin ruta, men
    inget klipps i cellerna (vakt i `layout.mjs`); diagrammens namn och värden täcker inte varandra, punkterna eller
    andra namn (tester i `tests/diagramritare.test.js` och `tests/diagramvyer.test.js`). Word-utkastet och
    Excel-filen är renderade i LibreOffice.
    Bredder under 1 100 punkter är prövade i Chromium 2026-11-22 med det stora demot vid 1 024 och 900 punkter: ingen
    flik blir bredare än fönstret och ingen punktetikett går utanför sitt diagram (vakt vid 900 punkter i `layout.mjs`).
    Inte prövat: exporterna öppnade i Word och Excel, och skärmen i Firefox och Safari för hand.

**Dokumentation och lansering:**
17b. **Före varje release: riskanalysen granskas mot koden.** `riskanalys.md` och `dataskydd.md` läses påstående
    för påstående mot den kod som släpps, granskningsdatumen i dokumenten sätts och avvikelser förs hit.
    Release-grinden (`tools/release.mjs`) stoppar en release när granskningen är äldre än koden eller gäller ett
    annat bygge.
18. **Uttagsstegen per lönesystem i `datauttag.md` är inte verifierade mot systemen**; de
    bygger på det gemensamma statistikuttaget och har rader som varje organisations systemförvaltare fyller i
    och bekräftar för sin installation.
21. **Inför användning hos fler arbetsgivare:** licens- eller användaravtal, prismodell och support; en beskriven
    väg in för andra arbetsvärderingssystem än BAS; för offentlig sektor offentlighetsprincipen och
    arkivering av utdata, mall för konsekvensbedömning; en handledning för facklig
    samverkan. (Textförslaget till information till de anställda, tillgänglighetsredogörelsen och
    säkerhetsbeskrivningen på en sida finns i `docs/anvandare/`.)
