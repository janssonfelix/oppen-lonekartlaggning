# Öppna punkter

Kända brister och obesvarade frågor, så att de inte lever bara i en konversationstråd. Numren byts inte, eftersom kod,
tester och dokument pekar på dem; ett nummer som saknas är en avslutad punkt. En avslutad punkt som något pekar på står
kvar med en rad om hur den avslutades. Syfte och avgränsning står i [`mal.md`](mal.md).

**Användning och prövning:**
1. **Ingen användare har provat gränssnittet och diagrammen med verklig data**; de är sedda med demodatan och ett
   påhittat större underlag (42 yrken). Checklistan för skarp data (`pilotchecklista.md`) har punkter för det
   som inte går att pröva utan verklig data.
3. **Punkter som täcker varandra i bandkartan** när många yrkesgrupper i samma BAS-intervall har nästan samma
   median. *Krav mot lön* flyttar isär sådana grupper i sidled, och prioriteringsmatrisens etiketter flyttas isär
   uppåt; bandkartan är inte prövad med många yrken. Bör bedömas med verklig data.
4. **Trattdiagrammets ritade fält är en normalapproximation** (med korrektion för små grupper); bedömningen av
   varje grupp görs med omkastning, utom för grupper över 300 personer.

**Prestanda:**
5. **Ändrad minsta gruppstorlek tar 4,1 s på 55 000 rader** (10 → 11): bootstrap-KI och styrkan räknas om i
   bakgrunden efteråt (`_skattningarIBakgrunden`), och Att göra, processöversikten och den öppna fliken räknas om. Det
   som återstår är regressionen i processöversikten och underlagets kvalitet, som inte får cachas (ADR-17).
   Kvantilregressionens bootstrap-intervall räknas i bakgrunden efter att kortet ritats, också i exportläget
   (`_regKvantilBerakna`): en bild eller utskrift som görs innan intervallet är klart bär kortet utan det.
   Mätvärden (`npm run perf`, Chromium, 55 000 syntetiska rader, 2026-10-29): uppladdning till klart gränssnitt
   ~2,8 s och till klara bakgrundsanalyser ~7,7 s; tyngst är Likvärdigt arbete (2,6 s) och Lika arbete (2,0 s).

**Kod och bygge:**
6. **Krasch i Node under testkörning** (V8:s skräpsamlare): orsaken är okänd; `npm test` och `npm run test:full` kör om berörda filer.
8. **Ett gemensamt globalt scope** på omkring 20 000 rader. Logik flyttas till `src/lib/` när en del ändå ändras.

**Gränssnitt och analys (översynen 2026-10-29):**
9b. **Ett tecken i hela verktyget:** löneskillnader anges kvinnor mot män, negativt när kvinnor ligger lägre
    (huvudtalet, livscykeln, Blinder-Oaxaca-kortets rågap, *Var uppstår löneskillnaden?*); kvoten *kvinnors lön i
    procent av mäns* används där den är standard (Översikt, Ålder & karriär, direktivets tabeller). Enda
    undantaget är EU-lönerapportens blad med direktivets tecken (art. 9), utskrivet i rubriken.
9c. **Ålder & karriär ordnad efter tre frågor** (vid samma ålder; över karriären; åldersstruktur), med ett
    spridningsdiagram där hela urvalets trend är ett valbart lager. Täthetskurvorna per BAS är borta ur fliken
    (lönespridningen per BAS och kön finns som lådor i Lönestruktur, och utskriften använder den bilden).
9d. **Dekomponeringen visas som en bild:** trappan med yrkesgruppssteget efter huvudtalet, förklaringsbudgeten
    under den, steglistan som skärmläsaralternativ. Livscykelns nivåer per BAS kommer ur modellens
    BAS-koefficienter (`basFaktor`). Blinder-Oaxaca kodar BAS som indikatorer sedan ADR-53.
9e. **Storlek utan prövning, som beslut (ADR-59, ADR-62, ADR-71):** Utforska och kolumnen *Skillnad kön* i Prioriteringens
    åtgärdslista visar storleken utan att pröva den mot slumpen och når därför högst *Följ upp*. Det är ett beslut,
    inte en rest: Utforskas celler är fria urval, där en prövning per cell vore många tester utan korrigering, och
    Prioriteringens grupper prövas i Lika arbete, dit brickans verktygstips hänvisar. På skärmen (k = 1) står många
    små grupper som *Går ej att bedöma*, eftersom prövningen kräver `statGolv()` per kön (ADR-38). Övriga rester
    efter trappan är lösta (2026-11-14, ADR-71): livscykelns nyckeltal följer trappan med modellens konfidensintervall och
    förändringen 25–65 år färgas på prövningen av samspelet mellan kön och ålder, protokollet för gemensam
    lönebedömning väljer BAS-intervall efter BH-korrigeringen, och handlingsplanen säger i kolumnen *Kostnaden
    avser* vilken kostnad raden har.

**Dokumentation och lansering:**
17b. **Före varje release: riskanalysen granskas mot koden.** `riskanalys.md` och `dataskydd.md` läses påstående
    för påstående mot den kod som släpps, granskningsdatumen i dokumenten sätts och avvikelser förs hit.
    Release-grinden (`tools/release.mjs`) stoppar en release när granskningen är äldre än koden eller gäller ett
    annat bygge.
18. **Uttagsstegen per lönesystem i `datauttag.md` är inte verifierade mot systemen**; de
    bygger på det gemensamma statistikuttaget och har rader som varje organisations systemförvaltare fyller i
    och bekräftar för sin installation.
19. **README i roten har ingen bild:** skärmbilder checkas inte in, så en bild där kräver ett
    beslut om att lägga en bildfil i källkoden.
21. **Inför användning hos fler arbetsgivare:** licens- eller användaravtal, prismodell och support; en beskriven
    väg in för andra arbetsvärderingssystem än BAS; för offentlig sektor offentlighetsprincipen och
    arkivering av utdata, mall för konsekvensbedömning; en jurist-granskad metodbeskrivning och en handledning
    för facklig samverkan. (Textförslaget till information till de anställda, tillgänglighetsredogörelsen och
    säkerhetsbeskrivningen på en sida finns i `docs/anvandare/`; textförslaget är inte juridiskt granskat.)

**Juridiska frågor.** Hänvisningarna gicks igenom 2026-10-19 (status *Förslag* i [`lagrum.md`](lagrum.md): inte
juridiskt granskade). Beslut som följde: verktyget hänvisar övergripande
och lagrummen står bara i [`lagrum.md`](lagrum.md) (ADR-16); kvinnodominerat arbete är mer än 60 % kvinnor;
direktivet beskrivs som inte infört i Sverige, med möjlig direkt verkan mot kommun och region. Kvar att
pröva: att 5 %-gränsen bara används för gemensam lönebedömning och aldrig för att flagga lika eller likvärdigt
arbete (metodändring); flikens namn *Handlingsplan*; en spärr mot fält som
fackmedlemskap eller hälsa; och protokollets täckning av art. 10.2 a–g. Ingen juridisk granskning har gjorts;
varje arbetsgivare stämmer av mot sin egen rådgivning.
