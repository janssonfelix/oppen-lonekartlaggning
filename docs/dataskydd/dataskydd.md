# Dataskyddsbeskrivning — Öppen lönekartläggning

**För:** dataskyddsombud och IT-säkerhet som ska bedöma verktyget inför användning.
**Omfattning:** en sammanfattning på två sidor. Den fullständiga, kodverifierade analysen —
dataflöde, tekniska skydd, riskregister och verifieringslogg — finns i
[`riskanalys.md`](riskanalys.md), som också är underlaget till arbetsgivarens
konsekvensbedömning (DPIA). Lagrumshänvisningarna samlas i
[`lagrum.md`](../utveckling/lagrum.md).

**Granskad mot koden:** 2026-10-20.

---

## 1. Behandlingen i korthet

| Fråga | Svar |
|---|---|
| Ändamål | Arbetsgivarens lagstadgade lönekartläggning (diskrimineringslagen 3 kap.) och utvalda moment i EU:s lönetransparensdirektiv |
| Personuppgiftsansvarig | Arbetsgivaren som genomför kartläggningen |
| Personuppgiftsbiträde | Inget. Verktyget körs på arbetsgivarens egen dator; ingen uppgift når verktygets leverantör eller någon annan |
| Rättslig grund | Rättslig förpliktelse (dataskyddsförordningen art. 6.1 c med 6.3): diskrimineringslagens regler om lönekartläggning och dokumentation, se lagrum.md |
| Uppgifter som läses in | Fem fält per anställd: månadslön, kön, ålder, yrkesgrupp (AID) och BAS-intervall — plus valfri arbetsvärderingspoäng per befattning, valfri ansvarskod enligt AID (grupperas i tre ansvarsgrupper; används för att pröva ansvar som sakligt skäl) och radens nummer i källfilen. Alla andra kolumner läses inte in |
| Uppgifter som avvisas | Lönefilen avvisas helt om en kolumnrubrik anger personnummer, namn eller e-post, eller om någon kolumn i filens 50 första rader innehåller sådana värden (minst tre personnummer eller e-postadresser, eller minst fem för- och efternamn). Rubrikkontrollen bortser från stora/små bokstäver och svenska tecken, så *Förnamn* och *Fornamn* avvisas båda. Filen avvisas också om en rubrik antyder en särskild kategori av personuppgifter (fackmedlemskap, hälsa, etnicitet, religion med mera); där prövas bara rubriken |
| Organisationens referensdata | Ställningstagande och jämförelsestatistik — som egna filer eller i ett organisationspaket (JSON). Bara aggregat; ett paket med något som liknar personnummer eller e-post avvisas. Ingen organisation eller referens är inbyggd |
| Särskilda kategorier | Inga (bestämmelserna om särskilda kategorier är inte tillämpliga). Lön är däremot integritetskänslig, och i små grupper kan kombinationen kön, ålder, yrke och BAS peka ut enskilda |
| Lagring | Ingen. Uppgifterna finns bara i webbläsarens arbetsminne och försvinner när fliken stängs eller användaren väljer *Rensa all data* |
| Överföring | Ingen, inte heller till tredje land. Webbläsaren spärrar all nätverkstrafik |

## 2. Tekniska skydd

- **Ingen nätverkstrafik:** innehållssäkerhetspolicyn (CSP) stoppar anrop från skript
  (`connect-src 'none'`), externa bilder, skriptfiler och formulär. Verktyget har inga
  externa resurser och inga länkar ut, och fungerar med nätverket avstängt. En CSP hindrar
  inte att en sida navigerar till en annan adress; verktyget har ingen sådan kod, och kod
  som förs in via en fil kan inte köras (se *Skydd mot skadlig indata*).
- **Ingen autofyll-historik:** alla fält har `autocomplete="off"`, också de som skapas medan du
  arbetar (anteckningarna i Regler & praxis, Löneöversyns riktade rader), så att organisationsnamn och
  anteckningar inte sparas i webbläsarens autofyll-historik.
- **Ingen lagring på disken:** varken verktyget eller de inbyggda biblioteken skriver till
  localStorage, sessionStorage, IndexedDB, cookies eller cache; det kontrolleras vid varje
  granskning och i webbläsartestet. Som reserv finns en spärr i koden som avbryter med ett
  fel om något ändå anropar lagringens skrivfunktion (`setItem`) eller sätter en cookie.
  Spärren har inga undantag och fångar också direkt tilldelning. Det är ändå frånvaron av
  lagringskod som är skyddet — spärren fångar misstag (riskanalysen §6.2).
- **Uppgiftsminimering vid inläsningen:** filen läses in i webbläsarens minne och gås
  igenom rad för rad; bara de vitlistade fälten sparas, och filens övriga innehåll släpps
  när inläsningen är klar. Namn som hamnat i yrkesfältet maskeras.
- **Skydd mot skadlig indata:** bara verktygets egna skript får köras (hash-baserad CSP),
  all text från filen kodas innan den visas, och formler i CSV och urklipp neutraliseras så
  att Excel inte kör dem (ADR-15).
- **Rensning:** *Rensa all data* och den automatiska rensningen vid inaktivitet tömmer
  allt — tabeller, diagram, utskriftsrapport och minne. Rensningen vid inaktivitet är på som
  standard (90 minuter) och kan ändras under *Vad lagras?* — om inte organisationspaketet har
  låst tiden (ADR-47); då står rullistan på paketets värde och säger varför.
- **Skarp användning sker i en nedladdad fil:** verklig lönedata läses bara in i en fil som
  laddats ner och vars signatur verifierats (`SECURITY.md`) — inte i en kopia som visas från en
  webbplats (demosidan är till för påhittad data). Den som driver en webbplats styr vilken
  fil som visas. En organisationsfil har en egen kontrollsumma och sprids bara via en
  behörighetsstyrd intern yta.
- **Spårbart och signerat bygge:** varje version signeras av release-arbetsflödet med Sigstore och
  har en kontrollsumma (SHA-256) i `RELEASE.txt`; bygget är reproducerbart. Signaturen styrker
  äktheten, kontrollsumman bara att filen inte skadats.

## 3. Små grupper (k-anonymitet)

**Regeln gäller det som lämnar verktyget (ADR-51, beslut 2026-10-29).** På skärmen visas alla
grupper: den som arbetar i verktyget har redan lönefilen. Allt som lämnar verktyget — Excel, Word-utkastet,
PDF-rapporten, ZIP-filen, CSV, urklipp, diagrambilder, rapportunderlaget, gruppdossierns textkopia och allt
under *Dokumentera & exportera* — ritas och räknas i ett exportläge där minsta gruppstorlek tillämpas.
Lönemått för grupper med färre än 10 personer redovisas då inte; gruppen namnges i en not så att det syns
vad som saknas. Där det i det här avsnittet står att ett mått *visas*, *redovisas* eller *ritas* bara när en
grupp eller ett kön når tröskeln gäller det exportläget — det som lämnar verktyget; på skärmen visas måttet.
Med knappen *Som export* i sidhuvudet kan användaren se flikarna i exportläget (en banner och en ram visar det);
exporterna byter då inte läge.
Är gruppen stor nog
men ett av könen för litet visas gruppens samlade median utan könsjämförelse. Samma regel
gäller de beskrivande könsuppdelade måtten — ett köns median eller percentil, det råa
lönegapet, regressionens ojusterade steg ("Endast kön") med den förklarade andelen och en
kostnad som räknats ur ett gap redovisas bara när varje kön har minst 10 personer, också när
måttet gäller hela organisationen. Den justerade löneskillnaden ur huvudregressionen i Lika
arbete följer inte regeln: den visas från regressionens eget fasta golv, 5 personer av varje
kön (ADR-38), också på skärmen. I Ålder & karriärs bilder och diagramdata följer lönegapen (ojusterat och
åldersjusterat), lutningen per kön, trendlinjerna med konfidensband och lådorna per kön regeln: där ett
kön är under tröskeln står ett streck, och en not under diagrammet säger vad som utelämnats. I
spridningsdiagrammens bilder och diagramdata finns en persons punkt bara när personens grupp (yrke inom BAS)
och personens kön i gruppen når tröskeln; en not säger hur många som inte är med. Avsnittet mot ställningstagandet i Jämförelse har en
mellannivå i exporten: för grupper med 5 personer eller fler men under tröskeln anges antal, inga
lönemått; bladet *Lönepolitik* i Excelfilen med alla flikar följer den trappan och samma regel
per kön. Överblicken i Jämförelse och bladet *Referenser* redovisar organisationens lönemått bara för yrkesgrupper
som når tröskeln; referensernas egna tal och tabellen statistiken mot ställningstagandet bär inga
organisationsvärden och maskeras inte. Ett diagram som inte får lämna verktyget alls — Personer att granskas diagram, och
Översiktens kopior av Strukturs diagram — är märkt så i koden med ett uppräknat skäl som står i
behållarens verktygstips, och ingen exportväg (meny, bild, diagramdata, ZIP, utskrift) tar med det.

**Vad testerna prövar.** Automatiska tester ritar varje flik i exportläget och bygger Word-utkastet,
PDF-rapporten i dess tre urval (hela dokumentationen, ledningsbrief och facklig dialog), rapportunderlaget, Excelfilerna (utom likvärdighetsexporten),
ZIP-filens Excelfil, Att göra-listans CSV, tabellernas CSV, gruppdossiern och diagramdatan
för de diagram som inte visar enskilda personer — vid tröskeln 10 och vid 25 — och kräver att
ingen lön för en grupp under tröskeln, för ett kön under tröskeln eller för en enskild person
finns i dem. Vid 5 prövas flikarna i exportläget, och att skärmen visar grupperna prövas för sig. Egna tester prövar regressionens ojusterade steg (med 7 män
i underlaget) och Ålder & karriär (med 3 män i hela urvalet och med ett valt BAS med en man).
Testerna prövar inte undantagen nedan eller bilder av diagram.

Standardvärdet är 10. Användaren kan ändra det under *Inställningar* i sidhuvudet (*Minsta gruppstorlek för redovisning*),
till lägst 2. Ett högre värde skärper skyddet. Ett lägre värde gör att mindre grupper redovisas, och
då gäller tre saker: användaren måste bekräfta sänkningen (också när värdet kommer ur en
konfigurationsfil eller ett organisationspaket), en varning som inte går att stänga visas överst på
alla flikar, och värdet anges i metodbilagan (som följer med varje Excelfil, Word-utkastet och PDF-rapporten),
i exporterad diagramdata och i tabell-CSV. Under 10 står dessutom meningen
"Tröskeln är sänkt från standardvärdet 10." på det som kan spridas för sig: diagrambilder, tabeller i urklipp, Word-utkastets sidfot, PDF-rapportens rubrik och den utskrivna handlingsplanen, rapportunderlagets block och den kopierade gruppdossiern.
Konfigurationsfilen och organisationspaketet bär värdet som ett fält, inte meningen. En
konfigurationsfil eller ett paket som saknar fältet ändrar inte det värde som gäller.
Exporter som hör till undantag 1 och 2 nedan anger det i filen ("Den här filen kan även
innehålla grupper under tröskeln").
Inställningen lagras inte: nästa gång verktyget öppnas gäller 10, om inte en konfigurationsfil eller ett
organisationspaket anger annat. En organisation kan sätta sin egen standard i organisationspaketet.
Organisationspaketet kan dessutom sätta ett **golv** (ADR-47): en lägsta tillåten minsta gruppstorlek som
varken fältet, en konfigurationsfil eller ett senare paket kan gå under — fältet visar gränsen och avvisar
lägre värden som ogiltiga, en lägre tröskel höjs till golvet när paketet läses in, och ett nytt paket med
lägre eller inget golv kräver bekräftelse. Golvet följer paketet: *Rensa all data* tar bort det, och
konfigurationsfilen bär det inte.
Vissa skattningar (till exempel regression per BAS) följer `statGolv()` och sänks inte med tröskeln; verktyget har också andra, fasta golv som inte gör det (teknisk-plan, ADR-38), så texten ska inte läsas som att alla golv är minst 10.

Fyra medvetna undantag:

1. **Likvärdigt arbete:** lagen kräver att även små kvinnodominerade yrken prövas, så
   fliken och dess egen export (Excel och CSV) redovisar kandidatpar även när en grupp har
   färre än 10 personer. Undantaget gäller bara dit. Överallt annars — Rapportunderlaget,
   Word-utkastet, PDF-rapporten, protokollet för gemensam lönebedömning, Att göra och dess
   CSV, handlingsplanens förifyllda rader (på skärmen, i Excel och på utskrift),
   gruppdossiern och robusthetspanelen i Dokumentera & exportera — tas bara par med där båda
   grupperna har minst 10 personer, och utdata anger hur många par som utelämnats.
2. **Utforska (ADR-14):** fliken visar alla grupper på skärmen, som de andra flikarna, och dess
   export (tabellens CSV och urklipp, diagrammets bild och diagramdata) utelämnar grupper under tröskeln
   och lönemått för ett kön under tröskeln — om inte användaren kryssar i rutan *Ta med grupper under
   tröskeln i exporten*. Rutan är undantaget: med den ikryssad lämnar små grupper verktyget.
   Organisationspaketet kan stänga av möjligheten (ADR-47): rutan är då dold, exporten
   utelämnar alltid små grupper, och en rad i fliken säger att paketet inte tillåter det.
3. **Personer att granska (ADR-23):** Lika arbete listar enskilda personer som ligger klart
   under sina kollegor, med radnummer. Listan visas bara i verktyget — den kan inte
   exporteras, kopieras eller skrivas ut. Extremvärdeslistan i *Underlagets kvalitet* visar
   på samma sätt enskilda löner med radnummer, på skärmen.
4. **Diagram med en punkt per person:** spridningsdiagrammen lön mot ålder och låddiagrammet
   per kön (Ålder & karriär) och individpunkterna i Utforska visar varje persons lön.
   I bilder och diagramdata ritar låddiagrammet bara en låda för ett kön som når tröskeln, och i
   spridningsdiagrammen finns en persons punkt bara när personens grupp (yrke inom BAS) och personens kön
   i gruppen når tröskeln — övriga personer finns varken i bilden eller i diagramdatan;
   trendlinjen bygger på alla. Demografidelens trendlinje och lutning för hela urvalet exporteras bara när
   urvalet (alla BAS eller det valda) når tröskeln; annars säger en not under diagrammet det. Lådornas
   avvikare i låddiagrammet per kön är enskilda löner, utan yrke. De får exporteras som bild och som
   diagramdata (en rad per person, utan identifierare), och diagramdatan säger på rad 2 att filen
   innehåller en rad per person och ska hanteras som personuppgifter.
   **Word-utkastet och rapportens avsnitt innehåller inga sådana diagram** (båda ritas ur samma
   rapportmodell, som bara bär diagram över grupper). **Utskriften av hela dokumentationen (mallen *Komplett
   rapport*) har bilagor med bilder av Ålder & karriärs spridningsdiagram, låddiagram och täthetsdiagram**, och
   **ZIP-exporten innehåller bilder av alla ritade diagram från alla flikar**, också dessa. Det är ett beslut
   (produktägaren 2026-10-16, ADR-48): bilderna bär inga namn eller identifierare, och filerna hanteras som
   personuppgifter (§4).

**Vyerna per BAS-intervall, trattdiagrammet och fördelningarna per kön.** Översikten per BAS-intervall i Lika arbete har
i Word-utkastet, PDF-rapporten och flikens export bara rader för BAS-intervall där både kvinnor och män når tröskeln
(på skärmen alla intervall). I det som exporteras visar trattdiagrammet en punkt per yrkesgrupp, och bara yrkesgrupper där båda könen når tröskeln; lådorna över
lönespridning per BAS-intervall och kön ritas bara för ett kön som når tröskeln i intervallet, och utan enskilda
avvikande löner. Lönegapet per åldersgrupp visar bara åldersgrupper där båda könen når tröskeln, och de övriga
namnges under diagrammet. Fördelningen i lönespannets tredjedelar per kön redovisas bara när båda könen når
tröskeln; en andel som gäller färre än fem personer sägs i verktygstipset. Tabellen över avvikelse från
förväntad lön per kön och BAS-intervall märker andelar som gäller färre än fem personer med en asterisk.
Beräkningarna bakom översikten och trattdiagrammet hålls i minnet medan underlaget är inläst och släpps av
*Rensa all data*.

**Egna riktade rader i Löneöversyn är tillåtna även för grupper under tröskeln**.
Löneöversyn är användarens egen simulering: en riktad rad som användaren själv
lägger till för en grupp under tröskeln visar sitt belopp på raden, och beloppet ingår i
summorna på skärmen och i Löneöversyns Excel-export (raderna *Använt*, *Riktat* och — när gruppen
är kvinnodominerad — *Varav till kvinnodominerade grupper*). Är påslaget i procent och gruppen
en enda person är beloppet den personens lön gånger procentsatsen. Det är användarens egen
inmatning och filtreras inte; verktyget visar en not under raden ("Raden berör 1 person, färre än 10
personer — beloppet bygger på enskildas löner …") så att användaren vet vad en export då visar.
I exportens blad *Fördelning* maskeras medianer och kostnad per grupp under tröskeln; utfallstabellen på
skärmen visar dem.

**Riktade potter med kön och lönegräns följer regeln för egna rader.** En riktad rad i Löneöversyn kan
begränsas till ett kön och till löner under en gräns (det som tidigare var Lönerevisionssimulatorn).
Berör raden färre personer än minsta gruppstorlek är det er egen simulering: beloppet visas på raden
med noten att det bygger på enskildas löner. Kvinnors medianlön i procent av mäns före och efter
visas bara när varje kön når tröskeln.

**Löneöversyns tröskelmål följer regeln.** Lyftet i procent till kvinnor och dess kostnad visas bara
när varje kön i urvalet når tröskeln; annars står ett streck och meningen om utelämnat könsuppdelat
mått. En riktad rad som verktyget självt föreslog ur kandidatparen tas bort när tröskeln höjs över
gruppens storlek — också när raden kommer ur en konfigurationsfil, som bär uppgiften om vilka rader
som var förslag. Varningen "underlaget är litet" i Prioriteringens motiveringsförslag går vid färre än
tröskeln av något kön, och processöversiktens steg 4 blir inte klart när alla kandidatpar har en grupp
under tröskeln: steget säger hur många par som bara redovisas i fliken Likvärdigt arbete och leder dit.

**Organisationsfilen.** Systemägaren kan baka in organisationspaketet i verktygsfilen och sprida en fil.
Den innehåller bara det paketet bär (benämningar, inställningar, aggregat och rapportens tabellrecept — inga
tal), aldrig lönedata; inget
skript ändras, så skydden ovan gäller oförändrade (riskanalysen §6.9).

## 4. Det som kan lämna verktyget

Allt som lämnar verktyget gör det på användarens initiativ, som en fil på den egna datorn
eller via urklipp — aldrig över nätverket:

| Utdata | Innehåll | Hantering |
|---|---|---|
| Excel- och CSV-exporter | Aggregat per grupp. Bladet *Referenser* bär organisationens lönemått per yrkesgrupp som når tröskeln, och referensernas egna tal. Kandidatpar med små grupper ingår bara i likvärdighetsexporten (§3, undantag 1); övriga exporter utelämnar dem och anger antalet. Likvärdighetsexporten, och Utforskas export när rutan för små grupper är ikryssad, anger i filen att den kan innehålla grupper under tröskeln | Som personuppgifter |
| Diagramdata från diagram med enskilda personer | En rad per person: lön, kön och ålder eller grupp — utan identifierare | Som personuppgifter |
| Word-utkast, PDF och utskrift | Verktygets fynd och HR:s egna bedömningar. Tabeller, text och diagrambilder redovisar grupper över tröskeln; kandidatpar med en grupp under tröskeln utelämnas. PDF-rapporten är en låst kopia av Word-utkastet med samma innehåll. Rapportens avsnitt har inga diagram med enskilda personers löner; utskriften av hela dokumentationen (*Komplett rapport*) har bilagor med bilder av Ålder & karriärs spridnings-, låd- och täthetsdiagram (§3, undantag 4) | Som personuppgifter |
| ZIP-export | Word-utkastet, Excelfilen med alla flikar (aggregat) och bilder av alla ritade diagram från alla flikar. ZIP-filen är alltså inte enbart aggregat: spridningsdiagrammen i Ålder & karriär har en punkt per anställd (bara personer vars grupp och kön i gruppen når tröskeln), och låddiagrammet visar enskilda avvikande löner | Som personuppgifter |
| Rapportunderlag via urklipp | Aggregat för grupper som når minsta gruppstorlek (standard 10); kandidatpar med en grupp under tröskeln utelämnas | Som rapportmaterial |
| Konfigurationsfil | Inställningar, organisationens namn och jämförelsestatistikens namn (användarens egna namn; text som liknar personnummer eller e-post avvisas), HR:s anteckningar och avbockningarna i Att göra, och ett årsbokslut (nyckeltal, en rad per yrkesgrupp där båda könen når minsta gruppstorlek, Att göra-punkternas läge; ADR-54) — aldrig individrader; noterar vilket organisationspaket som användes | Som övriga exportfiler |
| Organisationspaket (systemägaren) | Organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik — bara aggregat | Kan spridas internt; innehåller inga personuppgifter |

Det som kopieras till urklipp (tabeller, diagramdata och rapportunderlag) kan synkas till
molnet eller andra enheter av operativsystemet eller en urklippshanterare (Windows molnurklipp,
Apples universella urklipp). Organisationen bör stänga av sådan synkning på de datorer som
används för lönekartläggningen (riskanalysen §8).

HR skriver själv bedömningar i verktyget (Regler & praxis m.m.). Riktlinjen är att skriva
på gruppnivå — inga namn eller personnummer; texten kontrolleras inte av verktyget.

## 5. Riktlinjer för användaren

1. Ta ut lönefilen utan personnummer, namn och e-post, och spara den på en
   behörighetsstyrd yta — inte i mappen Hämtade filer.
2. Använd en arbetsdator som organisationen förvaltar, med så få webbläsartillägg som
   möjligt. Tillägg för översättning eller stavning kan läsa sidans innehåll; ett privat
   fönster utan tillägg är ett enkelt skydd.
3. Hantera alla exporterade filer som personuppgifter: behörighetsstyrd lagring, ingen
   okrypterad e-post, radering när de inte längre behövs.
4. Var försiktig vid skärmdelning och i öppna kontorsmiljöer.
5. Stäng fliken eller välj *Rensa all data* när arbetet är klart, och radera källfilen
   enligt organisationens rutiner.

## 6. Kvarstående risker

De tekniska riskerna är låga. Det som återstår är organisatoriskt och ligger hos
arbetsgivaren: hanteringen av exporterade filer, datorns och webbläsarens skick (ett skadligt
tillägg eller en komprometterad dator ligger utanför verktygets kontroll) och att
operativsystemet kan skriva arbetsminne till disk (växlingsfil, viloläge, kraschdumpar).
Riskregistret och verifieringen finns i [`riskanalys.md`](riskanalys.md) §7–11.

Behovet av en formell konsekvensbedömning (art. 35) avser lönekartläggnings**processen**
som helhet — datauttaget och hanteringen av rapporten — och avgörs av arbetsgivarens
dataskyddsombud. Verktyget är en lågriskkomponent i den processen.
