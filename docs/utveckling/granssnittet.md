# Gränssnittet — referens

Gränssnittet är det handläggaren använder i verktyget: menyn och tangentbordet, processöversikten och *Börja här*,
huvudområdet och ansvarskoden, jämförelsestatistikens tabell och diagram, panelen *Personer att granska* och
rapporteringen av interna fel. Det här dokumentet bär den **gällande lydelsen** för de delarna. Koden är sanningen; där
dokumentet och koden skiljer sig är det dokumentet som ska rättas.

Varför det är så här står i besluten i [`arkitekturbeslut.md`](arkitekturbeslut.md): ADR-10 (menyn), 23 (Personer att
granska), 29 (processöversikten), 31 (interna fel), 33 (huvudområdet och ansvarskoden) och 35 (jämförelsestatistiken).
Gränssnittets form, flikarna och flikmallen står i [`mal.md`](mal.md) (*Gränssnittets form*, ADR-41 och 82). Flikbytet
och visningsminnet (ADR-80 och 81) står i [`k-troskeln.md`](k-troskeln.md) §3, diagrammens filter (ADR-94) i
[`diagramkarnan.md`](diagramkarnan.md) (*Rutan Filter*), och minsta gruppstorlek i [`k-troskeln.md`](k-troskeln.md).
Exporterna står i [`exporterna.md`](exporterna.md).

| Del | Fil |
|---|---|
| Menyn: knapparna, de låsta flikarna, flikbytet, menyn i ett smalt fönster | `src/index.html` (`nav.nav-menu`), `src/app/31-navigering.js` (`uppstartNavigering`, `klickaFlik`, `sattMeny`, `PANELGRUPPER`) |
| Tangentbordet i menyn och i flikraderna | `src/app/63-tangentbordsnavigering.js` (`kopplaFlikarnasTillganglighet`, `_kopplaFlikradensTangenter`) |
| Reglerna för *Börja här* och processöversiktens steg | `src/lib/attgora.js` (`borjaHar`, `attGoraRang`, `hanterade`, `stegLikaArbete`, `stegLikvardigt`) |
| Att göra och processöversikten | `src/app/18-atgardslista.js` (`byggAtgardslista`, `ritaAtgardslista`), `src/app/13-oversikt.js` (`ritaKartlaggningensSteg`) |
| Ansvarskoden | `src/lib/ansvar.js` (`ansvarsUnderrader`); underraderna i Lika arbete i `src/lib/vymodell-lika-arbete.js` (`ansvarFor`) och `src/app/41-lika-arbete.js`, ansvarssteget i `src/lib/regression.js`, ansvarsraden i `src/app/51-lika-arbete-regressionskort.js` |
| Översikten per huvudområde | `src/lib/sektor.js` (`sektorsTabell`) |
| Jämförelsestatistiken | `src/lib/jamforelse.js` (`jamforelseRader`, `statistikFor`, `avvikelseRangordning`), `src/app/42-jamforelse.js` (`byggJamforelse`), `src/app/64-jamforelse-export.js` |
| Personer att granska | `src/lib/individflaggor.js` (`flaggaIndivider`, `avvikelsePerKonOchBas`), `src/app/43-personer-att-granska.js` (`ritaPersonerAttGranska`) |
| Interna fel | `src/app/03-hjalpfunktioner.js` (`rapporteraFel`, `visaInterntFel`) |
| Vakterna | `tests/a11y.test.js`, `tests/start-och-meny-app.test.js`, `tests/individflaggor.test.js` |

## 1. Menyn och tangentbordet

**Menyn är navigation, inte en flikrad.** Sidomenyn är `<nav class="nav-menu" aria-label="Huvudmeny">` med vanliga
knappar (`.nav-item`) utan roll, och den aktiva bär `aria-current="page"`. Gruppernas rubriker (*1 · Underlag* och de
andra) är `role="presentation"` och `aria-hidden`. Varje knapp har `aria-controls` mot flikens paneler
(`PANELGRUPPER`), och panelerna får `tabindex="-1"`, så att de kan få fokus vid flikbytet men inte står i Tab-ordningen.

**Menyns sista post** är *För systemförvaltaren* (`forvaltare`) under *Hjälp*, efter *Om verktyget*. Den syns alltid
och är aldrig låst, eftersom den inte behöver någon lönefil. Fliken bär formuläret för organisationspaketet och
organisationsfilen i tre steg: paketet, verktygsfilen och nedladdningen (`docs/utveckling/organisationsfil.md`).
Knapparna i steg 1 öppnar samma filval som Filer och kvalitet (`data-byt-fil`), så att samma hanterare och besked
används. I Filer och kvalitet pekar en rad sist i steg 1 dit, och *Om verktyget* länkar dit. Fliken är, som *Om
verktyget*, ingen analysflik: den ritar inga diagram och har ingen grupp i *Alla diagram*.

**Tangentbordet.** Alla knappar i menyn står i den naturliga Tab-ordningen. Pilarna, Home och End flyttar därtill fokus
mellan de knappar som varken är låsta eller dolda och byter flik; från en låst knapp går pilen till närmaste upplåsta
åt det hållet. Ett byte med pilarna är användarens flikbyte (`k-troskeln.md` §3).

**En låst flik** är `aria-disabled="true"`, inte `disabled`: knappen går att nå och klicka på, och klicket leder till
lönefilskortet i Filer och kvalitet (eller till kravet på ålder för en flik som kräver ålder) i stället för att ingenting
händer. Egenskapen `disabled` på knappen läser och sätter `aria-disabled`, så att resten av koden låser och låser upp
som vanligt.

**De äkta flikraderna** är två: avsnitten i Om verktyget (`.info-tab-nav`) och underflikarna *Egna vyer* och *Alla
diagram* i Tabeller och egna vyer (`.ut-underflikar`). De är `role="tablist"` med bara `role="tab"`-barn, och bara den
aktiva fliken står i Tab-ordningen; pilarna, Home och End byter flik (`_kopplaFlikradensTangenter`).

**Smalt fönster** (ADR-82). Under 640 punkter ligger menyn utanför bild och öppnas över innehållet med knappen *Meny*
i sidhuvudet (`aria-expanded`). Den stängs av ett val i menyn, av Escape och av ett klick utanför; fokus går till menyn
när den öppnas och tillbaka till knappen när den stängs. När fönstret passerar brytpunkten stängs menyn utan glidning.

**Vakten** är `tests/a11y.test.js`: axe-core (ett utvecklingsberoende som aldrig ingår i bygget) körs i jsdom mot varje
ritad flik med demodata och kräver noll överträdelser av nivåerna *serious*, *critical* och *moderate*. Färgkontrasten
kräver en layoutmotor och prövas inte där.

## 2. Processöversikten och *Börja här*

**Ett steg är klart när arbetet är gjort**, inte när analysen har körts. Processöversikten på Översikt
(`ritaKartlaggningensSteg`) har åtta steg; stegen 3 och 4 läser Att göras punkter och vilka som är avbockade:

- **3. Lika arbete** är klart när huvudregressionen gått att köra och alla punkter i kategorierna *Lika arbete* och
  *Lika arbete, fördjupning* är avbockade (`stegLikaArbete`); annars delvis.
- **4. Likvärdigt arbete** är klart när analysen inte hittar några kandidatpar, eller när det finns punkter och alla i
  kategorin *Likvärdigt arbete* är avbockade (`stegLikvardigt`). Finns bara par där en grupp är under tröskeln, som bara
  redovisas i fliken, är tillståndet *inget att hantera* i Att göra, och steget pekar till fliken.
- **2. Regler & praxis** räknar de bedömda granskningsområdena, och **5. Handlingsplan** handlingsplanens rader och
  deras status. Steg 1 är klart när lönefilen är inläst; stegen 6–8 (samverkan, rapporttexten, dokumentationen) är
  manuella och markeras inte.

Ett steg vars härledning kastar visar sin reservrad och rapporteras (avsnitt 6).

**Börja här** överst i Att göra visar de tre första punkterna som inte är avbockade (`borjaHar`), ordnade efter
prioritet (hög, medel, låg), inom samma prioritet efter rang (`attGoraRang`: underlaget först, sedan de fynd som gäller
skillnader mellan kvinnor och män, `KONSRELATERADE`, sist övriga, som läget mot referenserna) och sist i listans ordning.
Är alla avbockade står *Alla punkter är hanterade*.

## 3. Huvudområdet och ansvarskoden

**Huvudområdet** i AID är en översikt och en dimension, inte ett filter över hela verktyget: alla flikar räknar på hela
underlaget (`hamtaData`), så att ett val i en flik aldrig ändrar en annan fliks resultat eller dess minsta
gruppstorlek. Huvudområdet finns som översikten per huvudområde i Lönestruktur (`sektorsTabell`; hur den justerade
skillnaden räknas står i [`regressionsmodellen.md`](regressionsmodellen.md) §3), som dimension i Tabeller och egna vyer
(`sektor` i `src/lib/utforska.js`), som filter i Lönelägets jämförelse (avsnitt 4) och i diagrammens filter och raden
*Räkna för* (`diagramkarnan.md`).

**Ansvarskoden** är valfri. Vilka koder som läses, de tre ansvarsgrupperna och regeln att kolumnen läses bara när minst
95 % av de ifyllda värdena är giltiga står i [`docs/anvandare/datauttag.md`](../anvandare/datauttag.md); vad som
sparas i minnet står i riskanalysen (`docs/dataskydd/riskanalys.md` §6.4). I gränssnittet redovisas ansvaret bredvid
huvudresultaten, aldrig i dem:

- I regressionskortet i Lika arbete står ansvaret på en egen rad under förklaringsbudgeten: hur mycket av den
  oförklarade skillnaden ledningsansvar och särskilt uppdrag förklarar, med skillnaden före och efter
  (`_ansvarRadText`). Huvudtalet räknar inte bort ansvaret, eftersom om ansvaret är ett sakligt skäl är arbetsgivarens
  bedömning. Ansvarssteget tar med en ansvarsgrupp bara när den har minst `statGolv()` personer (`k-troskeln.md` §5).
- I tabellen per AID-etikett i Lika arbete får en AID-etikett med minst två ansvarsgrupper hopfällda underrader per
  ansvarsgrupp, och raden *Utan ledningsansvar* när AID-etiketten har ledningsansvar och båda könen bland de övriga når
  tröskeln (`ansvarFor` i `src/lib/vymodell-lika-arbete.js`, med raderna ur `ansvarsUnderrader`). Underraderna följer
  samma regler för minsta gruppstorlek som AID-etikettens rad.
- Personer att granska visar personens ansvarsgrupp i en egen kolumn (avsnitt 5).

## 4. Jämförelsestatistiken

Avsnittet *Mot jämförelsestatistiken* i Löneläget har en tabell och två diagram, och knappen *Exportera samlad Excel*.
Alla fyra läser raderna ur `jamforelseRader(rader, { statistik, policyFor, k })`, så att de inte kan säga olika saker:

- **En rad per AID-kod i BAS-intervall** (gruppens namn är texten på flest av dess rader, ADR-89), med P10, median och
  P90 för organisationen, jämförelsestatistiken och ställningstagandet, och skillnaderna i kronor och procent. En grupp
  med färre än k personer får ingen rad och räknas upp bland de utelämnade. P10 och P90 utelämnas inte under någon egen
  gräns: de följer samma tröskel som medianen.
- **Statistikens rad** för en grupp (`statistikFor`) är raden med samma AID och samma BAS-intervall, annars raden med
  samma AID som saknar BAS; en rad för ett annat BAS-intervall används aldrig. Tabellens kolumn *Matchning* säger
  vilket (*AID + BAS* eller *Endast AID*).
- **Tabellen** (`#benchmark-table`) jämför organisationen med jämförelsestatistiken; kolumnerna för P10 och P90 är dolda
  tills användaren visar fler kolumner (`flerKolumner`). Filtren *BAS-intervall* och *Huvudområde* gäller tabellen och
  diagrammen.
- **Spanndiagrammet** (`chart-jamforelse-spann`) ritar organisationens spann P10–P90 med medianen ovanpå statistikens
  spann; **avvikelsediagrammet** (`chart-jamforelse-avvikelse`) rangordnar grupperna efter skillnaden i median mot
  statistiken (`avvikelseRangordning`), mest negativ först. Med fler än 25 grupper visar spanndiagrammet de 25 största
  och avvikelsediagrammet de 25 med störst avvikelse åt något håll, och noten under diagrammet säger att tabellen har
  alla. Ett klick i avvikelsediagrammet markerar gruppens rad i tabellen.
- **Den samlade Excel-filen** (`exportJamforelseExcel`) har alla grupper oavsett filter, med organisationen,
  statistiken och ställningstagandet, och ett blad *Metadata* med antalet utelämnade grupper. Den körs i exportläget
  (`k-troskeln.md` §3).

## 5. Personer att granska

Panelen sist i Lika arbete listar personer vars lön ligger minst X % under en förväntad lön ur kollegorna
(`flaggaIndivider`):

- **Kollegorna** är de andra i samma grupp, AID-koden i BAS-intervallet, utan personen själv. Bara grupper med minst
  `statGolv()` personer prövas (`k-troskeln.md` §5); antalet personer i mindre grupper står i en not.
- **Den förväntade lönen** är `exp(a + b · ålder)` ur kollegornas `ln(lön) = a + b · ålder` när kollegornas åldrar
  skiljer sig minst 5 år, annars kollegornas medianlön. Utan ålder i lönefilen prövas alla mot kollegornas median.
  Har lönefilen ålder prövas inte den som saknar ålder, och hen räknas inte som kollega; antalet står i en not
  (`utanAlder`).
- **Gränsen X** är standard 10 och går att ställa in mellan 5 och 30 (fältet `pag-grans`; ett värde utanför sätts till
  närmaste gräns). Både kvinnor och män prövas och flaggas.
- **Personen identifieras med filens radnummer**, så att ingen ny identifierare samlas in. Ett citerat fält med
  radbrytning i en CSV-fil förskjuter numreringen, en accepterad begränsning (`32-filinlasning.js`).
- **Listan** visar de första 200 raderna och resten på begäran. Bredvid den står andelen prövade under och över
  gränsen per BAS-intervall och kön, bara där båda könen når tröskeln (`avvikelsePerKonOchBas`).

Listan och panelens diagram lämnar aldrig verktyget och döljs vid utskrift; hur står i `k-troskeln.md` §4
(*Personer att granska*).

## 6. Interna fel

En analysdel som ska tåla fel hoppar över sin del om något kastar, men anropar `rapporteraFel(plats, e)`:

- **Bannern** `#internt-fel-banner` visas och säger att ett internt fel gjorde att en del av analysen hoppades över,
  med platserna, att resultatet kan vara ofullständigt och vad användaren kan göra (`visaInterntFel`). Varje plats står
  en gång.
- **Konsolen** får en varning med platsen, feltypen och högst 120 tecken av meddelandet, där varje siffra är ersatt med
  `#`, eftersom konsolen aldrig ska bära lönedata.
- **Rensa all data** tömmer listan och döljer bannern (`26-rensning.js`).

Ett avsiktligt `catch`, som en nekad behörighet till urklippet, rapporterar inte. Vakten är
`tests/start-och-meny-app.test.js` (*interna fel syns i stället för att sväljas*): ett fel i en del av Att göra visas i
bannern och konsolen utan siffror, och demot med alla flikar ritade ger inga interna fel.
