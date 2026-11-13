# teknisk-plan.md — Öppen lönekartläggning: Mål, syfte och plan

> Detta dokument är den kanoniska beskrivningen av *vad* verktyget ska vara och varför
> (öppna punkter i §9). Skydden står i [`skydd.md`](skydd.md) och arkitekturbesluten (ADR) i
> [`arkitekturbeslut.md`](arkitekturbeslut.md). Den gällande lydelsen per område står i referenserna:
> [`k-troskeln.md`](k-troskeln.md), [`regressionsmodellen.md`](regressionsmodellen.md),
> [`likvardighetsmodellen.md`](likvardighetsmodellen.md), [`diagramkarnan.md`](diagramkarnan.md) och
> [`bygge-och-test.md`](bygge-och-test.md). Lagrumshänvisningarna samlas i [`lagrum.md`](lagrum.md).

---

## 1. Syfte (varför verktyget finns)

Öppen lönekartläggning är ett **klientsidigt analysverktyg** som stödjer
arbetsgivarens **årliga lönekartläggning** enligt **diskrimineringslagen
3 kap.** (aktiva åtgärder om lönefrågor; paragraferna i [`lagrum.md`](lagrum.md)) och
utvalda delar av **EU:s lönetransparensdirektiv 2023/970**. Direktivet skulle vara infört i
svensk rätt 7 juni 2026 (svensk lag och ikraftträdande dateras när de är kända); lönerapporteringen (art. 9) införs stegvis från 2027,
först för arbetsgivare med minst 250 arbetstagare.

Verktyget besvarar frågan **"vilka grupper ska vi arbeta vidare med?"** —
det identifierar, kvantifierar och prioriterar löneskillnader som kan kräva
utredning. Det är ett *underlag*, inte ett slutdokument.

Primär målgrupp: HR-handläggare, ledning, fackliga
representanter (JPA-samråd) och dataskyddsombud.

---

## 2. Avgränsning (vad verktyget medvetet INTE gör — "Mål 1")

**Omfång.** Verktyget är allmänt för arbetsgivare som kodar befattningar med AID och BAS-intervall och
jämför sig med SKR:s personalstatistik; det är i praktiken kommuner och regioner. Allt som är en viss
organisations — ställningstagande, statistik, benämningar, inställningar, rapportens recept — kommer ur
organisationspaketet (ADR-28), aldrig ur koden eller dokumenten. Andra arbetsvärderingssystem står som öppen
punkt i §9.

**Alla BAS-intervall ingår** (ADR-21): lönekartläggningen ska omfatta hela organisationen, och chefsnivåerna är ofta
de grupper där könsskillnaden är störst. Rimlighetskontrollen kräver bara att BAS är en bokstav; små intervall skyddas
av minsta gruppstorlek vid export.

Detta är en bärande designprincip, inte en begränsning av misstag:

- **Producerar inte** det färdiga, beslutade slutdokumentet. Verktyget genererar
  ett *utkast* till lönekartläggningens dokumentation (redigerbar .docx, ADR-37) där de kvalitativa
  bedömningarna står som `[HR fyller i]`-fält. Arbetsgivaren färdigställer
  dokumentet i sin egen mall. Verktyget hjälper med *vilka grupper*, inte med
  *hur bedömningen formuleras*.
- **Dokumenterar inte** sakliga skäl per grupp internt — den
  bedömningen görs och dokumenteras i HR:s ordinarie verktyg.
- **Hanterar inte** anställds informationsrätt (EU 2023/970 Art. 7) — sköts
  i separat process hos arbetsgivaren. *Får inte återinföras i verktyget.*
- **Hanterar inte** könsneutral lönesättningspolicy (Art. 5) eller statlig
  myndighetsrapportering (Art. 9) — dessa är input/separat process.
- **Använder inte** AI/LLM. All statistik är klassiska metoder med
  spårbara, dokumenterade formler.
- **Sparar inte** data mellan sessioner.
- **Läser inga** historiska lönefiler: verktyget stödjer en kartläggning; historiska filer skulle lägga fler
  personuppgifter i minnet och förutsätter stabila BAS-strukturer. Jämförelsen mellan år görs genom
  årsbokslutet i konfigurationsfilen (ADR-54), som bara bär aggregat — aldrig individer eller lönedata.
  *Att läsa historiska lönefiler får inte införas utan nytt beslut.*
- Kolumnen Ansvar läses inte in och inget enhetsmått beräknas.
- **Analyserar inte** rörliga eller kompletterande lönedelar (tillägg, bonus, förmåner).
  Verktyget har en lönedefinition — heltidsomräknad månadslön — och EU-rapportens mått
  redovisas för den. *Rörlig lön är inte aktuellt i verktyget.*
- **Sparar inte** vyer eller urval som egna filer eller lägen. En uppställning i Tabeller och egna vyer
  kan läggas i rapporten som ett recept (rader, kolumner, mått, urval; ADR-52), som följer med i
  konfigurationsfilen och ritas om ur underlaget; i övrigt exporteras det som ska bevaras via diagrammens
  exportmeny.
- **Stödjer inte** mobil- eller surfplattebredd. Verktyget är ett skrivbordsverktyg för
  HR; vid smala fönster (under ungefär 768 px) fälls sidomenyn inte ihop. *En mobilvy är inte aktuell.*

**Designmotiv:** genom att avgränsa till analys + datastrukturering kan
verktyget leverera värde över flera år utan att behöva uppdateras varje
gång rapporteringsformat ändras hos DO, Medlingsinstitutet eller EU.

---

## 3. Dataskydd — Privacy by Design (GDPR Art. 25)

Icke förhandlingsbara arkitektoniska garantier. Alla fyra står som skydd i [`skydd.md`](skydd.md), med regel, vakt
och det som inte vaktas.

1. **En fil, körs lokalt:** skyddet S3 i [`skydd.md`](skydd.md).
2. **Inga nätverksanrop** (CSP `connect-src 'none'`): skyddet S1 i [`skydd.md`](skydd.md).
3. **Ingen persistent lagring:** skyddet S2 i [`skydd.md`](skydd.md); lagringsspärren i detalj i
   `docs/dataskydd/riskanalys.md` §6.2.
4. **Minsta gruppstorlek** (`K_STANDARD = 10`; användaren kan ändra värdet): grupper med för få individer redovisas
   inte i det som lämnar verktyget. Skyddet S4 i [`skydd.md`](skydd.md); den gällande lydelsen, med
   redovisningsformen, undantagen, golven och vakterna, står i [`k-troskeln.md`](k-troskeln.md).

---

## 4. Funktionsmål (vad verktyget ska kunna)

| Område | Lagrum | Funktion |
|---|---|---|
| Kartläggning lika arbete | lika arbete (lagrum.md) | EU-Lönekartläggning: median-jämförelse kön inom yrkesgrupp + per-BAS-regression (oförklarat gap, ålderskontroll, HC3-SE, BH-FDR) |
| Lönegap & könsfördelning | lönekartläggningen (lagrum.md) | Lika arbete-fliken: yrkesgrupperna först; trattdiagrammet ställer varje yrkesgrupps kvot mot gruppens storlek och bedömer den med omkastning av könen inom gruppen. Lönestruktur-fliken: översikten per BAS-intervall (*Lönegap per BAS-intervall*) som tabell med grafik i raden (antal, medianer, skillnad i kronor, kvot med bootstrap-intervall, status), samma kvot som diagram bara i exporten, lönespridning per BAS och kön, könsfördelning (*Könsfördelning per BAS-intervall*); statusen sätts på statistisk signal och verktygets storleksgräns 3 %, och 5 % (EU Art. 9-analogt) är en direktivmarkering vid den ojusterade skillnaden, ingen status (ADR-59) |
| **Likvärdigt arbete** | **likvärdigt arbete (lagrum.md)** | **Likvärdigt arbete-fliken: organisationens kvinnodominerade AID×BAS mot yrken som inte är kvinnodominerade (ADR-60) med lika krav — i första hand organisationens egna i samma BAS, annars jämförelsestatistiken; med arbetsvärderingspoäng över BAS-gränserna. Därtill *Lägre krav, högre lön* (ADR-25)** |
| Hierarkisk översikt | lönekartläggningen (lagrum.md) | Löneöversikten (i Tabeller och egna vyer): median/P10/P90/spridning per yrke+BAS, referenslinjer |
| Prioritering | — | Löneläget mot er referens med kostnad att nå den (ADR-62): prioritetsindex (avvikelse × volym × jämställdhet), kostnadssimulering. Könsgapet i gruppen visas och räknas in i indexet bara när båda könen har minst k personer (ADR-12; annars räknas jämställdhetsdelen som 0). Jämför mot organisationens lönepolitiska ställningstagande (ur ett organisationspaket eller en egen namngiven fil; ingen inbyggd referens, ADR-28) eller mot jämförelsestatistiken |
| Fördjupning | — | Två flikar i Kartläggning som inte är lagkrav och säger det i verktygstipset och inledningen: Ålder & karriär (lön mot ålder med trend, lönegap per åldersgrupp, percentilband över ålder, lönefördelning per kön, livscykel ålder×kön×BAS och åldersstruktur) och Löneläget (raden Löneläget nedan). Nästa steg hoppar över dem när de är låsta |
| EU-direktivets rapportmått | EU 2023/970 art. 9 | Lönestruktur: kvartilfördelning, representation per BAS, distributionellt gap, medel- och mediangap, med EU-lönerapporten som Excel. **Tecknet:** verktyget räknar lönegapet som (kvinnor − män) / män och visar det i alla flikar och blad som kvinnors lön i procent av mäns (under 100 % = kvinnor lägre). EU-lönerapportens blad och rapportens avsnitt *Struktur och lönetransparens* (Word/PDF) redovisar i stället direktivets mått, (män − kvinnor) / män i procent, enligt art. 9: positivt tal = kvinnor lägre; kolumnrubriken och en metodrad säger det. Tecknet vänds på ett ställe, `tillDirektivtecken` i `src/lib/struktur.js`; beloppet är detsamma |
| Löneläget | — | Fliken `benchmark`, först i Kartläggning. Avsnitten i ordning: Överblick (`avsnitt-jmf-bandkartor`: bandkartan mot ställningstagandet och läget i statistikens spann, fylld punkt för AID + BAS och ofylld för endast AID), avsnittet mot ställningstagandet, avsnittet mot jämförelsestatistiken (ADR-35) och Yrkesgrupp för yrkesgrupp (`avsnitt-jmf-overblick`: löneläget och statistiken mot ställningstagandet per yrkesgrupp, ADR-55). Avsnittet mot ställningstagandet: könens läge i spannet och fördelningen i spannets tredjedelar per kön, efterlevnad, täckningsgrad; tomläge utan ställningstagande. Talen följer med som bladet *Lönepolitik* i Excel (alla flikar) — yrkesgrupperna mot sitt spann, läget per kön och BAS-intervall, tredjedelarna och efterlevnaden, med flikens regler för minsta gruppstorlek (`_lpExcelBlad`) — bara när ett ställningstagande är inläst |
| Organisationspaket | — | En fil med organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik; systemägaren skapar det i verktyget, handläggaren läser in det i ett steg i fliken Filer och kvalitet (ADR-28) |
| Tabeller och egna vyer | — | Fliken `utforska`, sist i Rapport: Löneöversikten och underflikarna Egna vyer och Alla diagram (`74-alla-diagram.js`: diagrammen från de andra flikarna samlade, en grupp per flik, som kopior med egna filter och meny; ingen ny export). Egna vyer: rader × ev. kolumner (BAS, AID, yrkesgrupp inom BAS, sektor, AID-mellannivå, ålder, kön, lönespann; rader även hela urvalet), tio mått, visning som helhet eller per kön, urval med villkor (alla/något, "inte", lön och ålder) och gruppvillkor på uträknat mått, tolv diagramtyper i två grupper i väljaren (Vanliga: staplar, liggande, låda, grupperade; Fler diagramtyper: hantel, bubbla, individpunkter, punktsvärm, regnmoln, kvantilpunkter, värmekarta, staplade). Små grupper visas som andra på skärmen och utelämnas ur exporten om inte rutan är ikryssad (ADR-14, ADR-51). Klick på en grupp öppnar gruppdossiern |
| Export | — | Exportmeny på varje diagram: PNG (1920 × 1080 / 1600 × 900), SVG och diagramdata (urklipp/CSV) |
| Rapporttext | — | Fliken `rapporttext` (låst utan lönefil): auto-rapportutkastet i klarspråk (`renderStrukturUtkast` i `37-struktur.js`) och rapportunderlaget att klistra in i egen mall (ADR-20) |
| Exportera | — | Fliken `dokumentera` (panelerna `view-kvalitet` och `view-dokumentera`), sista steget i Nästa steg: färdigcheck, robusthetspanel, rapportens innehåll och all export. De fyra samlade exporterna har var sin uppgift: **Word-utkastet är rapporten, Excel-filen underlaget, PDF-rapporten en låst kopia av Word-utkastet och ZIP-filen allt**. Word och PDF ritas ur samma rapportmodell (`58-rapportmodell.js`), i ett valt urval av avsnitt (hela dokumentationen, ledningsbrief, facklig dialog eller eget); varje export har ett förhandsbesked om vad den innehåller och utelämnar, och exportgrinden ser till att inget läses ur en flik ritad med en äldre tröskel. Därtill JPA-protokoll och handlingsplansunderlag, vars knappar också står i Handlingsplans kort *Samverkan & uppföljning* |
| Spara och jämför år | — | Fliken `arbetet` under Arbetet (öppen utan lönefil): spara och ladda konfigurationen, ögonblicksbilden, jämförelse med förra året (ADR-54) och självdiagnostiken. Rapporttext, Exportera och Spara och jämför år ritas i exportläget (ADR-51) |
| Gränssnittets form | — | Menyn har 16 flikar i grupperna 1 · Underlag (Översikt, Filer och kvalitet, Regler & praxis), 2 · Kartläggning (Löneläget, Lika arbete, Likvärdigt arbete, Lönestruktur, Ålder & karriär), 3 · Åtgärder (Prioritering, Löneöversyn, Handlingsplan), 4 · Rapport (Rapporttext, Exportera, Tabeller och egna vyer), Arbetet (Spara och jämför år) och Hjälp (Om verktyget); flikgrupperna och aliasen står i `PANEL_GROUPS` och `TAB_ALIAS` i `31-navigering.js`, och en låst flik leder till lönefilskortet i Filer och kvalitet. Alla flikar följer en mall: en rad om vad fliken svarar på (*Visa mer*), urval, nyckeltal i en rad, huvudresultat, och fördjupning i hopfällbara avsnitt som säger sitt nyckeltal i rubrikraden. Sidindexet *På den här sidan* (`89-sidindex.js`) listar flikens synliga avsnitt och följer med när sidan rullas. Sök i sidhuvudet markerar en grupp i alla diagram och tabeller (länkade vyer) och hittar flikarnas avsnitt, dialogerna och fälten i Inställningar (`SOK_FUNKTIONER` i `86-sok-register.js`), också utan lönefil. Panelen Inställningar samlar det som gäller alla flikar, med Prioriteringens trösklar och viktning. Två lägen: vägledande och kompakt. Byggt för datorskärm; surfplatta och delat fönster fungerar, telefon är inte ett användningsfall (ADR-41) |
| Diagram | — | Ritas av diagramkärnan (D3, ADR-39) ur ett figurformat; formen väljs efter uppgiften och färgen efter vad den ska säga — reglerna står i `diagramkarnan.md` §10. Där ett diagram skulle visa för lite står en tabell med grafik i raden |
| Underlagets kvalitet | — | I fliken Filer och kvalitet, med extremvärdena och inläsningsrapporten: fem kriterier med OK/Varning/Kritisk; svagaste kriteriet avgör (ADR-19) |
| Var uppstår löneskillnaden? | — | Lönestrukturs avsnitt och rapportunderlagets block: skillnaden i medellön delad på BAS-fördelning, AID inom BAS och inom AID och BAS (eller de förklaringsvariabler som valts, ADR-65), visad som en trappa och med de grupper som bidrar mest (ADR-22) |
| Personer att granska | — | Lika arbete: personer minst X % (standard 10) under förväntad lön bland kollegor i samma AID och BAS, med filens radnummer; lämnar aldrig verktyget (ADR-23) |
| Stabilitet för flaggor | — | Lika arbete och rapportunderlaget: varje yrkesgrupp över 5 % märks skör (≤ 5 % om 1 eller 2 personer tas bort) eller stabil; flaggan ligger kvar (ADR-24) |
| Lägre krav, högre lön | — | Likvärdigt arbete och rapportunderlaget: kvinnodominerade yrken med lägre medianlön än ett av organisationens yrken i lägre BAS, med antal BAS-steg (ADR-25) |
| Processkarta | — | Översiktens åtta lagsteg grupperade under menyns faser — en karta över resan |
| Samverkan | EU Art. 10 | JPA-protokoll-export (flerflikars Excel) för facklig samverkan |
| Transparens | — | Bevis-popup på varje fynd: visar *uträkningen*, inte tabelldata |

**Statistisk metodik:** regressionen och dess standardfel, den stegvisa uppdelningen, Blinder-Oaxaca,
kvantilregressionen, konfidensintervallen och p-värdena med korrigeringen för många tester, och uppdelningen *Var
uppstår löneskillnaden?* står i [`regressionsmodellen.md`](regressionsmodellen.md).

---

## 5. Likvärdighetsmodellen

Analysen av likvärdigt arbete — definitionen av kvinnodominerat, jämförelseyrkena, paren med konfidensintervall och
åldersjustering, *Lägre krav, högre lön* och BAS-rangen, inställningarna och vakterna — står i
[`likvardighetsmodellen.md`](likvardighetsmodellen.md). Hur BAS kodas i regressionerna står i
[`regressionsmodellen.md`](regressionsmodellen.md) §3.

---

## 6. Teknisk plan & leveransform

Hur verktyget byggs, testas, typkontrolleras och släpps — körtiden och mapparna, bygget och dess skyddsnät,
versioneringen, stilmallen, testsviten och testmiljön, typkontrollen, linten, `npm run kontroll`, CI, releasen,
demosidan, ärendena och beroendeuppdateringarna och förteckningen över dokumenten — står i
[`bygge-och-test.md`](bygge-och-test.md).

---

## 7. Kvalitetskrav (vad "klart och korrekt" betyder)

K1. Alla statistiska formler ska vara spårbara och dokumenterade.
K2. Inga nätverksanrop och ingen persistent lagring: skydden S1 och S2 i [`skydd.md`](skydd.md).
K3. Kärnalgoritmer ska ha enhetstester som speglar den *gällande* modellen.
K4. Dokumentationen ska beskriva den *byggda* versionen (ingen drift). Vakt:
    `tests/dokumentation-struktur.test.js` (filer, skript, tröskeltal och nummer stämmer med koden).
K5. *(Struket 2026-11-13: gick inte att pröva.)*
K6. En fil som går att öppna från `file://` och fungerar utan internet: skyddet S3 i [`skydd.md`](skydd.md).
K7. Skydd som är juridiskt bindande vaktas av invarianter över hela utdatan: skyddet S4 och inledningen i
    [`skydd.md`](skydd.md).
    Vad en ny utdata kräver (k-invariantsviten och riskanalysens tabell) står i *Definition of Done* i
    [`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md), punkt 3.
K8. Tillgänglighet enligt WCAG 2.1 AA. Vakt: `tests/a11y.test.js` (axe-core över alla flikar) och statusfärgernas
    kontrast i `tests/sakerhet.test.js`; övrig färgkontrast prövas för hand enligt pilotchecklistan
    (`docs/anvandare/pilotchecklista.md`).
K9. Bygget är reproducerbart. Vakt: artefaktgrinden i `.github/workflows/ci.yml` kräver att en färsk byggd fil är
    byte-identisk med den incheckade.
K10. Klarspråk och ordval i det användaren läser. Vakt: `tests/dokumentation-sprak.test.js` (bland annat avförda
    ord och lagrum i användartexten) och `tests/juridiksprak.test.js` (juridiska formuleringar hålls övergripande).

---

## 8. Arkitekturbeslut (ADR)

Arkitekturbesluten, med motiv, avvisade alternativ och status, står i
[`arkitekturbeslut.md`](arkitekturbeslut.md). Numren (ADR-1, ADR-2 …) är desamma som koden, testerna och
dokumenten pekar på.

## 9. Öppna punkter

Kända brister och obesvarade frågor, så att de inte lever bara i en konversationstråd. Numren byts inte, eftersom
kod, tester och dokument pekar på dem; ett nummer som saknas är en avslutad punkt. En avslutad punkt som något
pekar på står kvar med en rad om hur den avslutades.

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
   bakgrunden efteråt när `statGolv()` ändras (`_skattningarIBakgrunden`, som vid inläsning: nyckeltalen står utan
   intervall tills det är klart), och Att göra och processöversikten (som läser samma lista, byggd en gång, med regressionen körd en gång
   och skickad vidare) och den öppna fliken räknas om. Det som återstår är regressionen i processöversikten och
   underlagets kvalitet, som inte får cachas (ADR-17). Översikt
   ritas inte två gånger — när Översikt är den öppna fliken är den redan ritad av stegen (`_omritningssteg`).
   Kvantilregressionens bootstrap-intervall räknas i bakgrunden efter att kortet ritats, också i exportläget
   (`_regKvantilBerakna`): en bild eller utskrift som görs innan intervallet är klart bär kortet utan det.

   Mätvärden (Chromium, syntetiska rader): `npm run perf` på 55 000 rader (2026-10-29) ger uppladdning till klart
   gränssnitt ~2,8 s och till klara bakgrundsanalyser ~7,7 s; Likvärdigt arbete 2,6 s, Lika arbete 2,0 s, Ålder &
   karriär 1,8 s, övriga flikar under 0,6 s utom de som ritas i exportläget; hela svepet 19 s. Navigeringen
   (2026-11-07, 20 000 / 55 000 rader): sidindexet under 3 ms per flik, första sökningen 8 / 19 ms, BAS-dossiern
   20 / 56 ms, gruppdossiern 0,1 / 0,27 s, rapportmodellen med bilagan med gruppdossierer 0,48 / 1,4 s,
   förhandsbeskedet i Exportera ~1,0 / ~2,5 s och ett ändrat kryss under *Rapportens innehåll* 0,27 s vid 55 000 rader
   (gräns 1 s i `npm run perf`). Inget steg är nära 2 s, och ADR-1:s chunking behövs inte.

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
9e. **Kvar efter uppmärksamhetstrappan och Prioriteringens egna ord (ADR-59, ADR-62, till spår C):** livscykelns
    färger (`52-livscykel.js`) följer fortfarande 5 %. Utforska och kolumnen *Skillnad kön* i Prioriteringens åtgärdslista visar storlek utan prövning
    (högst *Följ upp*). Protokollets blad per BAS-intervall för gemensam lönebedömning väljer på rått p-värde utan
    BH-korrigering. På skärmen (k = 1) står många små grupper som *Går ej att bedöma*, eftersom prövningen kräver
    `statGolv()` per kön. Handlingsplanens kostnadskolumn blandar kostnad att nå referensen (rader ur Prioritering) och
    kostnaden att lyfta ett kvinnodominerat yrke till jämförelseyrket (kandidatpar); vägledningsbladet, rapporten och
    rapportunderlaget säger vilken som är vilken.

**Export:**
22. *(Löst 2026-11-08: en definition av kvinnodominerat i hela verktyget, `arKvinnodominerad`/`konsklass` i
    `src/lib/likvardighet.js`, ADR-60.)*
10. *(Löst 2026-11-10: jämförelseexporten och CSV-exporternas tolkning (`_CSV_TALLIKT`) prövas i
    `tests/talformat.test.js`; P10 och P90 i jämförelseexporten fick kronformat, och talinläsningen läser `−` som
    minus.)*

**Dokumentation och lansering:**
17b. **Före varje release: riskanalysen granskas mot koden.** `riskanalys.md` och `dataskydd.md` läses påstående
    för påstående mot den kod som släpps, granskningsdatumet sätts och avvikelser förs hit. Senast gjort
    2026-11-06. `npm run release:kontroll` (`tools/release.mjs`) stoppar en release när något av datumen är äldre
    än senaste commit som rör `src/`, `tools/bundle.mjs` eller `vendor/`, eller när riskanalysens kontrollsumma inte
    är byggets; release-arbetsflödet kör samma kontroll.
18. **Uttagsstegen för Heroma, Personec P och Visma i `datauttag.md` är inte verifierade mot systemen**; de
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