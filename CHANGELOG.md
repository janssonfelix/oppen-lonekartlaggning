# Changelog — Öppen lönekartläggning

Datumformat: `ÅÅÅÅ.MM.DD` (CalVer). Varje version är ett bygge av en enda HTML-fil,
`dist/oppen-lonekartlaggning.html`, gjort med `npm run bundle`. Byggets SHA-256 står i
`dist/RELEASE.txt`.

## 2026.10.19

### Analys

- **Lagrum:** verktyget, exporterna och dokumenten hänvisar nu övergripande ("enligt diskrimineringslagens
  regler om lönekartläggning", "direktivets regler om gemensam lönebedömning") i stället för med paragraf- och
  artikelnummer; de exakta lagrummen står på ett ställe, `docs/utveckling/lagrum.md` (ADR-16). Rapportens avsnitt heter *Åtgärder och tidsplan* och *Samverkan med
  arbetstagarna*. Kvinnodominerat arbete är nu **mer än** 60 % kvinnor (tidigare minst 60 %), och
  icke-kvinnodominerat under 40 %. Hänvisningarna till dataskyddsförordningen är rättade: rensningen är
  lagringsminimering, inte rätt till radering; k-anonymiteten motiveras med uppgiftsminimering och inbyggt
  dataskydd, inte med pseudonymisering.

- **Trattdiagrammet med färre än tio yrkesgrupper** har ett förbehåll under diagrammet, i Word och PDF, och en rad
  i metodbilagan: med så få grupper säger trattens form lite.
- **Regressionen använder BAS som indikatorvariabler (ADR-44):** varje BAS-intervall får sin egen nivå i stället
  för ett lika stort steg per bokstav, så att skillnader mellan intervallen inte blir kvar i det oförklarade
  gapet. Kortet visar nivån per BAS mot referensintervallet.
- **Konfidensintervallen räknas med t-fördelningen (ADR-45):** huvudregressionen, regressionerna per BAS och
  livscykelmodellen använder t-kvantilen i stället för 1,96, så att intervallen i små grupper inte blir för smala.
- **Nytt steg *+ Yrkesgrupp* i dekomponeringen (ADR-46):** könsgapet med fasta effekter för yrkesgrupp inom BAS,
  bredvid huvudtalet (kön + ålder + BAS).
- **Kvantilregressionen** visar ett bootstrap-intervall för könskoefficienten (upp till 5 000 personer), och
  metodtexten säger att skattningen är en approximation.
- **Statistiken är prövad mot statsmodels och scipy:** regressionen, intervallen, p-värdena och
  kvantilregressionen jämförs med referensvärden på en fast fixtur (`tests/stat-referens.test.js`).
- **Minsta påvisbara skillnad per grupp** räknas på spridningen inom grupperna, inte över hela urvalet, och
  blir därmed inte många gånger för stor.
- **Likvärdigt arbete:** kandidatparen får kolumnen *Justerad för ålder* bredvid den råa skillnaden
  (jämförelseyrkets lön omräknad till det kvinnodominerade yrkets åldersfördelning); den följer med i flikens CSV
  och Excel och i rapportunderlaget.
- **Ålder & karriär och livscykelkurvorna** har ett förbehåll om att de bygger på ett tvärsnitt, inte på hur en
  persons lön utvecklas; förbehållet står också i metodbilagan.
- **Struktur:** meningen om vertikal könssegregering hade etiketterna omkastade; den avser nu en högre
  kvinnoandel i det lägst värderade BAS-intervallet än i det högsta.

### Dataskydd

- **Extremvärdeslistan skrivs inte ut:** listan på Översikt visar enskilda löner med radnummer och döljs nu,
  som Personer att granska, när fliken skrivs ut. Tidigare följde den med i utskriften.
- **Webbläsarröktestet prövar fler skydd:** inga nätverksförfrågningar från någon sida under hela körningen,
  att en arbetstråd ur en `blob:`-adress och injicerat skript, `onclick` och `<img onerror>` stoppas av CSP:n,
  och att extremvärdeslistan inte skrivs ut. Ett nytt test kräver att bara de vitlistade fälten hålls i minnet.
- **Minsta gruppstorlek (beslut 2026-10-16):** demografidelens trendlinje och lutning i Ålder & karriär,
  Löneöversyns tröskelmål, lönerevisionssimulatorn och robusthetspanelen följer tröskeln; riktade rader i
  konfigurationsfilen bär uppgiften om de föreslogs ur kandidatparen, så att förslag rensas när tröskeln höjs;
  Prioriteringens varning "underlaget är litet" och processöversiktens steg 4 följer tröskeln.
- **Organisationspaketet kan låsa tre skydd (ADR-47):** ett golv för minsta gruppstorlek, en låst tid för
  rensning vid inaktivitet och att små grupper aldrig tas med i Utforskas export.
- **Innehållspolicyn förbjuder stilattribut** (`style-src-attr 'none'`): sidan har inga `style="…"` kvar, så en
  injicerad stil blockeras på samma sätt som ett injicerat `<style>`.
- **Indata saneras i fler filer:** AID och BAS i jämförelsestatistiken och organisationspaketets textfält rensas
  från HTML-tecken vid inläsningen.
- **PII-kontrollen känner igen rubriken *Förnamn*** (och andra rubriker med å, ä och ö); tidigare bara *Fornamn*.
- **`autocomplete="off"` på alla fält,** också de som skapas medan du arbetar.
- **Diagram som inte lämnar verktyget** är märkta på ett ställe med ett uppräknat skäl, som syns i ett
  verktygstips.

### Exporter

- **Gruppdossiern och rapportunderlaget** har ett räkneexempel: vad skillnaden i medianlön motsvarar per år för
  gruppens kvinnor, med prioriteringens beräkningsperiod och PO-påslag — bara när båda könen når minsta
  gruppstorlek och kvinnornas median ligger minst 100 kr lägre.
- **Skillnaden i kronor per månad** står bredvid procenttalet i verktygstipsen för kvoten per BAS, trattdiagrammet,
  lönegapet per åldersgrupp och percentilerna, och som kolumnen *Skillnad (kr/mån)* i deras diagramdata; i
  yrkesgruppstabellen i kvotcellens verktygstips.
- **Excel (alla flikar):** nytt blad *Lönepolitik* när ett ställningstagande är inläst, med samma regler för
  minsta gruppstorlek som fliken.
- **Excel (alla flikar):** cellerna har den typ och det värde som vyn visar — procent som procent, antal
  "kvinnor/män" som text i stället för datum, kvoten där rubriken säger kvot.
- **EU-lönerapporten och rapportens avsnitt om lönetransparens** redovisar lönegapet med direktivets tecken
  (art. 9): (män − kvinnor) / män, positivt tal = kvinnor lägre.
- **Diagramdata från spridningsdiagrammen** säger på rad 2 att filen innehåller en rad per person och ska
  hanteras som personuppgifter.
- **Bilder med en punkt per person** följer med i ZIP-filen och i *Komplett rapport* (beslut 2026-10-16,
  ADR-48), som förut.

### Gränssnitt

- **Organisationsfil:** systemägaren kan baka in organisationspaketet i verktygsfilen och sprida en enda
  fil (knappen *Skapa organisationsfil* i panelen Organisationspaket; ADR-49). Handläggaren öppnar filen och
  paketet är på plats; filrutan visar *Inbakat i den här filen* med *Visa paketet* och *Ladda ner paketet*.
  Inget skript ändras och ingen lönedata ingår.

- **Organisationspaketet:** formuläret har fält för ställningstagandets namn och kortform (förifyllda med
  det som gäller), så att paketet inte bär den uppladdade filens namn vidare till rubriker som *Lönerna mot …*
  i Lönepolitik. Namnet går också att byta i fältet *Namn på referensen* på Översikt när referensen kommer
  ur ett paket.

- **Små multiplar:** Utforskas hanteldiagram och jämförelseflikens figurer delas i paneler om femton grupper när de
  har fler, med samma lönaxel i alla; i exporterade bilder står upp till tre paneler bredvid varandra.
- **Kvantilpunkter:** lönefördelningen i Ålder & karriär kan visas som tjugo prickar per grupp (reglaget *Form*, *Var
  tjugonde person*), och Utforska har diagramtypen *Kvantilpunkter*. Varje prick är en tjugondel av gruppen;
  täthetskurvan är kvar som standard.
- **Nya könsfärger:** plommon för kvinnor och olivgrönt för män i alla diagram, i stället för rosa och blått. Paret
  knyter inte an till stereotyper, har minst 4,5:1 mot vitt och skiljer sig mer än det tidigare vid nedsatt
  färgseende.
- **Utskriftsfönstret** för Bestämmelser & praxis och handlingsplanens mall var ostilat under innehållspolicyn;
  det får nu stilmallens regler.
- **Om verktyget och ordlistan** säger att direktivet skulle vara infört 7 juni 2026 och att svensk lag och
  ikraftträdande dateras när de är kända.

### Utveckling

- **Licens:** verktyget är nu licensierat under MIT-licensen i stället för EUPL 1.2 (beslut 2026-10-19).
  `LICENSE`, `NOTICE`, licenstexten i bygget och SPDX-raderna i varje källfil är bytta.

- **Release-grind och signerade releaser:** `npm run release:kontroll` stoppar en release när versionen inte står
  lika överallt eller riskanalysen inte är granskad mot koden; release-arbetsflödet signerar artefakten med
  Sigstore cosign och publicerar den som GitHub Release. Dependabot uppdaterar beroendena och arbetsflödenas steg.
- **Stilmallen** har ett namngivet hjälpklassbibliotek i stället för 428 genererade klasser; beräknade stilar är
  oförändrade.
- **Regressionsmodellerna, prioriteringsindexet och livscykelmodellen** ligger i `src/lib/`.
- **Röktestet** prövar utskriftsfönstret och har körts i Chromium, Firefox och WebKit.

## 2026.10.13

Första versionen.

- **Hela lagkedjan:** bestämmelser och praxis, lika arbete med regression och oförklarat gap,
  likvärdigt arbete, EU-direktivets rapportmått, prioritering med kostnadsberäkning och
  handlingsplan.
- **Fyra exporter ur en rapportmodell:** Word-utkast (.docx), PDF, Excel-underlag och ZIP,
  samt rapportunderlag via urklipp och protokoll för gemensam lönebedömning.
- **Organisationspaket:** benämningar, grundinställningar, ställningstagande och
  jämförelsestatistik i en fil som systemägaren tar fram i verktyget. Ingen organisation är
  inbyggd.
- **Dataskydd:** fem obligatoriska och två valfria fält läses in, filer med personnummer, namn
  eller e-post avvisas, grupper under minsta gruppstorlek utelämnas och namnges, inga
  nätverksanrop och ingen lagring (CSP med kontrollsummor).
- **Diagramkärna på D3** med eget figurformat, markering som följer med mellan vyer, och
  export till PNG och SVG.
- **Demoläge** med påhittad data (`?demo=1`) och demosida (`npm run site`).
