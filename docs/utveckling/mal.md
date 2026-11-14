# Mål — syfte, avgränsning och funktioner

> *Vad* verktyget ska vara och varför. Det som binder står i [`skydd.md`](skydd.md) och [`principer.md`](principer.md),
> hur det fungerar i dag i referenserna (`docs/README.md` listar dem), varför i [`arkitekturbeslut.md`](arkitekturbeslut.md)
> och det som är öppet i [`oppna-punkter.md`](oppna-punkter.md).

## Syfte

Öppen lönekartläggning är ett **klientsidigt analysverktyg** för arbetsgivarens **årliga lönekartläggning** enligt
**diskrimineringslagen 3 kap.** (aktiva åtgärder om lönefrågor; paragraferna i [`lagrum.md`](lagrum.md)) och utvalda
delar av **EU:s lönetransparensdirektiv 2023/970**. Direktivet skulle vara infört i svensk rätt 7 juni 2026 (svensk lag
och ikraftträdande dateras när de är kända); lönerapporteringen (art. 9) införs stegvis från 2027, först för
arbetsgivare med minst 250 arbetstagare. Verktyget besvarar frågan **"vilka grupper ska vi arbeta vidare med?"** — det
identifierar, kvantifierar och prioriterar löneskillnader som kan kräva utredning. Det är ett *underlag*, inte ett
slutdokument. Primär målgrupp: HR-handläggare, ledning, fackliga representanter (JPA-samråd) och dataskyddsombud.

## Avgränsning

**Omfång.** Verktyget är allmänt för arbetsgivare som kodar befattningar med AID och BAS-intervall och jämför sig med
SKR:s personalstatistik; det är i praktiken kommuner och regioner. Allt som är en viss organisations kommer ur
organisationspaketet (ADR-28), aldrig ur koden eller dokumenten. Andra arbetsvärderingssystem är en öppen punkt.
**Alla BAS-intervall ingår** (ADR-21): kartläggningen ska omfatta hela organisationen, och chefsnivåerna är ofta de
grupper där könsskillnaden är störst. Rimlighetskontrollen kräver bara att BAS är en bokstav; små intervall skyddas av
minsta gruppstorlek vid export.

Avgränsningen är en bärande designprincip, inte en begränsning av misstag. Genom att avgränsa till analys och
datastrukturering kan verktyget leverera värde över flera år utan att uppdateras varje gång rapporteringsformat ändras.

- **Producerar inte** det beslutade slutdokumentet, utan ett redigerbart *utkast* (.docx, ADR-37) där de kvalitativa
  bedömningarna står som `[HR fyller i]`-fält; arbetsgivaren färdigställer det i sin egen mall.
- **Dokumenterar inte** sakliga skäl per grupp internt — den bedömningen görs i HR:s ordinarie verktyg.
- **Hanterar inte** anställds informationsrätt (art. 7), könsneutral lönesättningspolicy (art. 5) eller
  myndighetsrapportering (art. 9) — separata processer hos arbetsgivaren. *Informationsrätten får inte återinföras.*
- **Använder inte** AI/LLM i beräkningarna. All statistik är klassiska metoder med spårbara, dokumenterade formler.
  Verktyget är däremot *skrivet* med AI-verktyg, styrda och granskade av en person.
- **Sparar inte** data mellan sessioner, och inte vyer eller urval som egna filer; en uppställning i Tabeller och egna
  vyer kan läggas i rapporten som ett recept (ADR-52).
- **Läser inga** historiska lönefiler: de skulle lägga fler personuppgifter i minnet och förutsätter stabila
  BAS-strukturer. Jämförelsen mellan år görs genom årsbokslutet i konfigurationsfilen (ADR-54), som bara bär aggregat.
  *Att läsa historiska lönefiler får inte införas utan nytt beslut.*
- Kolumnen Ansvar läses inte in och inget enhetsmått beräknas.
- **Analyserar inte** rörliga eller kompletterande lönedelar. Verktyget har en lönedefinition — heltidsomräknad
  månadslön — och EU-rapportens mått redovisas för den.
- **Stödjer inte** mobilbredd: verktyget är ett skrivbordsverktyg, och vid smala fönster (under ungefär 768 px) fälls
  sidomenyn inte ihop. *En mobilvy är inte aktuell* (ADR-41).

## Funktionsmål

| Område | Funktion |
|---|---|
| Lika arbete | Medianjämförelse kön inom yrkesgrupp och regression per BAS (oförklarat gap, ålderskontroll, HC3-SE, BH-FDR); yrkesgrupperna först, trattdiagrammet bedömer varje grupps kvot med omkastning av könen; Personer att granska (ADR-23) och stabilitet för flaggor (ADR-24) |
| Lönestruktur | Översikten per BAS-intervall som tabell med grafik i raden, lönespridning per BAS och kön, könsfördelning per BAS-intervall; statusen sätts på statistisk signal och storleksgränsen 3 %, och 5 % är en direktivmarkering vid den ojusterade skillnaden (ADR-59) |
| Likvärdigt arbete | Kvinnodominerade AID×BAS mot yrken som inte är kvinnodominerade (ADR-60) med lika krav — i första hand organisationens egna i samma BAS, annars jämförelsestatistiken; arbetsvärderingspoäng över BAS-gränserna; *Lägre krav, högre lön* (ADR-25) |
| EU-direktivets rapportmått | Kvartilfördelning, representation per BAS, distributionellt gap, medel- och mediangap, med EU-lönerapporten som Excel. **Tecknet:** verktyget räknar (kvinnor − män) / män och visar kvinnors lön i procent av mäns; EU-lönerapportens blad och rapportens avsnitt *Struktur och lönetransparens* redovisar direktivets mått, (män − kvinnor) / män, med kolumnrubrik och metodrad som säger det. Tecknet vänds på ett ställe, `tillDirektivtecken` i `src/lib/struktur.js` |
| Löneläget | Först i Kartläggning: bandkartan, avsnittet mot ställningstagandet (läge i spannet, tredjedelar per kön, efterlevnad, täckningsgrad), avsnittet mot jämförelsestatistiken (ADR-35) och yrkesgrupp för yrkesgrupp (ADR-55); bladet *Lönepolitik* i Excel när ett ställningstagande är inläst |
| Prioritering | Löneläget mot er referens med kostnad att nå den (ADR-62): prioritetsindex (avvikelse × volym × jämställdhet) och kostnadssimulering; könsgapet räknas in bara när båda könen har minst k personer; referensen ur ett organisationspaket, en egen fil eller jämförelsestatistiken (ADR-28) |
| Fördjupning | Ålder & karriär och Löneläget, som inte är lagkrav och säger det; Nästa steg hoppar över dem när de är låsta |
| Var uppstår löneskillnaden? | Skillnaden i medellön delad på BAS-fördelning, AID inom BAS och inom AID och BAS, eller valda förklaringsvariabler, som en trappa (ADR-22, ADR-65) |
| Organisationspaket | Benämningar, grundinställningar, ställningstagande och jämförelsestatistik i en fil, inläst i ett steg (ADR-28) |
| Tabeller och egna vyer | Löneöversikten, Egna vyer (rader × kolumner, tio mått, urval med villkor, tolv diagramtyper) och Alla diagram; små grupper utelämnas ur exporten om inte rutan är ikryssad (ADR-14, ADR-51) |
| Rapporttext | Auto-rapportutkastet i klarspråk och rapportunderlaget att klistra in i egen mall (ADR-20) |
| Exportera | Färdigcheck, robusthetspanel, rapportens innehåll och all export: **Word-utkastet är rapporten, Excel-filen underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt** (ADR-40), med förhandsbesked; därtill JPA-protokoll (art. 10) och handlingsplansunderlag |
| Spara och jämför år | Konfigurationen, ögonblicksbilden, jämförelse med förra året (ADR-54) och självdiagnostiken |
| Gränssnittets form | 16 flikar i grupperna 1 · Underlag, 2 · Kartläggning, 3 · Åtgärder, 4 · Rapport, Arbetet och Hjälp (`PANEL_GROUPS` i `31-navigering.js`); Översiktens processkarta med de åtta lagstegen; flikmallen (ADR-41), sidindexet, sök i sidhuvudet (länkade vyer), panelen Inställningar och två lägen, vägledande och kompakt |
| Diagram och export | Diagramkärnan (ADR-39), formen och färgen efter uppgiften (ADR-42); exportmeny på varje diagram: PNG, SVG och diagramdata |
| Underlagets kvalitet | Fem kriterier med OK/Varning/Kritisk; svagaste kriteriet avgör (ADR-19) |
| Transparens | Bevis-popup på varje fynd: visar *uträkningen*, inte tabelldata |

Statistiken står i [`regressionsmodellen.md`](regressionsmodellen.md) och
[`likvardighetsmodellen.md`](likvardighetsmodellen.md).
