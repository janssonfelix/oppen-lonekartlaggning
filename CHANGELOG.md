# Changelog — Öppen lönekartläggning

Datumformat: `ÅÅÅÅ.MM.DD` (CalVer). Varje version är ett bygge av en enda HTML-fil,
`dist/oppen-lonekartlaggning.html`, gjort med `npm run bundle`. Byggets SHA-256 står i
`dist/RELEASE.txt`.

## Oförlöst

### Gränssnitt

- **Diagramfilter med flera dimensioner, och fälten Minst och Högst.** Ett diagram kan ha flera filter, ett per
  dimension, i varsin rad ovanför diagrammet: knappar för en kategori (som BAS-intervallen i dag) och fälten *Minst*
  och *Högst* för ett tal, till exempel antal personer i gruppen. Fälten läser tal som verktyget gör annars ("1,5",
  "1 500"), verkställs när du lämnar fältet eller trycker Retur, och ett tomt fält är ingen gräns. Ett tal som inte
  går att läsa, eller Minst större än Högst, markeras och ändrar inget. Döljer filtret allt står *Inga grupper i
  urvalet* i diagrammet. *Visa alla* nollställer alla filter. Noten under diagrammet och fotraden i diagrammets egen
  export räknar upp alla aktiva filter med samma text, till exempel "utan BAS A, BAS N; 10–50 personer i gruppen";
  raden i diagramdatan heter nu *Urval i diagrammet*. Filtren döljer fortfarande bara märken och minns per diagram
  och dimension under sessionen. Det här är kärnan; diagrammen får sina nya filter i nästa steg.

- **Fler filter i diagrammen där punkterna är yrkesgrupper.** *Antal personer i gruppen* (Minst och Högst) finns
  i Prioriteringsmatrisen, Prioriteringens kostnadsdiagram, trattdiagrammet i Lika arbete, Krav mot lön i
  Likvärdigt arbete, bandkartan, statistikens spann, spannet och skillnaden mot statistiken och överblickens bild i
  Löneläget. Prioriteringsmatrisen har också *Avvikelse (%)* (Minst och Högst). Bandkartan och statistikens spann
  har knappar för *Könsdominans* (Kvinnodominerad, Mansdominerad, Blandad), och statistikens spann och de två
  diagrammen mot statistiken har knappar för *Matchning* (AID + BAS, Endast AID; en grupp utan statistik påverkas
  inte). Filtren läser samma tal och ord som diagrammets verktygstips eller tabellen; inget nytt visas. Diagram vars
  punkter är BAS-intervall, personer eller åldersklasser har bara BAS-knapparna.

- **Alla diagram samlade i Tabeller och egna vyer.** Fliken har två underflikar överst: *Egna vyer* (som förut,
  förvald) och *Alla diagram*. Pilarna flyttar mellan dem, och valet står kvar så länge sidan är öppen. *Alla diagram*
  har en grupp per upplåst flik med diagram, i menyns ordning och stängd från början. När en grupp öppnas ritas
  fliken om det behövs, utan att du flyttas dit, och varje diagram i den som visas där och får exporteras står i
  gruppen: med sin rubrik, raden *Från fliken …* med en länk till diagrammet i fliken, egna filter och en egen
  exportmeny. Filtren i samlingen och i fliken påverkar inte varandra. Diagrammet visar alltid det som diagrammet i
  fliken visar och ritas om varje gång gruppen öppnas eller samlingen visas. Samlingen är ingen ny export: ZIP-filen,
  rapporten, utskriften och rapportunderlaget tar diagrammen från flikarna som förut, en gång var, och en export ur
  samlingens egen meny ger samma fil som en export ur fliken. Sökningen hittar *Alla diagram*.

- **Välj vilka BAS-intervall ett diagram visar.** Diagrammen där BAS-intervallet är en dimension har en knapp per
  intervall ovanför diagrammet, och *Visa alla*: bandkartan, statistikens spann, spannet och avvikelsen mot
  statistiken, efterlevnaden (båda vyerna), läget i spannet per kön och hanteln mot referenserna i Löneläget;
  översikten, lönespridningen per BAS och kön, könsfördelningen, trattdiagrammet och den oförklarade skillnaden per
  BAS-intervall i Lika arbete; Krav mot lön i Likvärdigt arbete; kostnaden och matrisen i Prioritering; lön mot ålder
  per BAS-intervall i Ålder & karriär och hanteln per BAS-intervall i Spara och jämför år. Ett klick döljer
  intervallet, till exempel BAS A, B, C och N inför en presentation. Det sista synliga intervallet kan inte döljas.
  En not under diagrammet säger vad som är dolt. Urvalet döljer bara märken och räknar aldrig om något tal: texten,
  tabellerna, rapporten, Word, PDF, utskriften, ZIP-filen och rapportunderlaget är alltid fullständiga. Diagrammets
  egen export (PNG och SVG) visar urvalet och säger i fotraden vad som är dolt; diagramdatan har alla rader.
  Valet gäller per diagram under sessionen och glöms när en lönefil eller demot läses in och vid Rensa all data.
  Diagram där ett märke samlar flera BAS-intervall (kandidatparen i Likvärdigt arbete, lägena per kön) har inget
  urval.

- **Statistikens matchning syns per yrkesgrupp.** Tabellen *Mot jämförelsestatistiken* i Löneläget har kolumnen
  *Matchning* efter BAS: *AID + BAS* när statistiken har en rad med samma AID och samma BAS, *Endast AID* när en rad
  med samma AID utan BAS används, och – när statistik saknas. Rubrikens hjälptext förklarar regeln, och kolumnen
  går att sortera. Samma kolumn finns i detaljlistan (när statistik finns), i Excel (alla flikar), bladet
  *Referenser*, den samlade jämförelseexporten, rapportens tabell, rapportunderlagets block *Lönerna mot
  referenserna* (när statistik finns) och utskriften. Ovanför tabellen står hur många
  yrkesgrupper i urvalet som matchades på AID och BAS, på endast AID och utan statistik; antalen står också i
  *Beräkning & urval*. Alla uppslag mot statistiken går nu genom ett gemensamt uppslag (`statistikFor` i
  `src/lib/jamforelse.js`). Rättelser: Löneöversyns *marknadspositionering* kunde ge en grupp medianen för ett annat
  BAS-intervall när AID saknade rad för gruppens BAS, och *Ålder & karriär* tog i hela urvalet första raden per AID
  oavsett BAS. Nu används aldrig en rad för ett annat BAS-intervall; Ålder & karriär slår upp varje AID×BAS-grupp
  och tar medianen av de matchade medianerna.

- **Löneläget börjar med en överblick.** Fliken har nu fyra avsnitt i ordningen *Överblick*, *Mot
  ställningstagandet*, *Mot jämförelsestatistiken* och *Yrkesgrupp för yrkesgrupp*. Överblicken är öppen och har
  bandkartan (flyttad hit från avsnittet mot ställningstagandet) och ett nytt diagram, *Var ligger yrkesgrupperna i
  statistikens spann?*: en punkt per yrkesgrupp med P10 och P90 i statistiken, läget i procent av statistikens
  spann (0 = P10, 100 = P90) per BAS-intervall, med bandkartans färger för könsdominans. Fylld punkt betyder att
  statistiken matchades på AID och BAS, ofylld att den matchades på endast AID. Diagrammet visar hela underlaget,
  oberoende av filtren i avsnittet mot statistiken, och bara grupper som når minsta gruppstorlek. Utan P10 och P90
  står ett meddelande i stället. Det förra avsnittet *Överblick* heter nu *Yrkesgrupp för yrkesgrupp* och är stängt
  från början. Diagramkärnan har fått punkter utan fyllning (`ofylld` på ett punktlager).

- **Lika arbete visar överblicksdiagrammet först.** I avsnittet *Kvinnor och män i samma yrkesgrupp* står diagrammet
  *Yrkesgrupperna mot slumpens gränser* nu direkt efter förklaringstexten och före tabellen, så att avsnittet börjar
  med bilden av alla yrkesgrupper. Innehållet och exporterna är oförändrade.

- **Ålder är valfri i lönefilen (ADR-64).** Det räcker med BAS-intervall, AID, månadslön och kön. Utan ålder körs
  analysen utan åldersjustering: inläsningskontrollen och förhandskontrollen säger det, fliken Ålder & karriär är låst
  med tipset *Kräver ålder i lönefilen*, Översiktens medelålder visas som – och Word, PDF, Excel och dossiererna hoppar
  över åldersavsnitten. Regressionen, kvantilregressionen och dekomponeringen körs med kön och BAS-intervall. Rapportens
  metodtext, regressionskortet och nyckeltalets verktygstips i Lika arbete säger alltid att det är ett metodval att
  räkna bort ålder, inte ett ställningstagande om att ålder är ett sakligt skäl.

- **Status på statistisk signal (ADR-59).** *Värt att granska* kräver en statistiskt säkerställd skillnad på minst 3 %;
  *Följ upp*, *Balanserat* och *Går ej att bedöma* (för få av ett kön) ersätter gränsen 5 %. 5 % är en markering på den
  ojusterade medianskillnaden (kolumnen *Ojusterad löneskillnad ≥ 5 %*), ingen bedömning, och står aldrig vid
  regressionens justerade tal.
- **Likvärdigt arbete: jämförelseyrkena är alla som inte är kvinnodominerade (ADR-60).** Blandade yrken jämförs nu
  också, i kandidatparen, *Lägre krav, högre lön*, *Hierarkisk jämförelse*, tabellerna per BAS-intervall och
  jämförelsestatistiken, med könsandel och klass (mansdominerad eller blandad) i tabeller och exporter (kolumnen
  *Könsandel i jämförelseyrket*, *Jämf. klass*). Rutan *Jämför bara med mansdominerade yrken* ger det tidigare urvalet
  och följer med i konfigurationsfilen och organisationspaketet. En enda definition av kvinnodominerat (förarbetena
  eller SCB) gäller i hela verktyget, också i Lika arbetes kolumn Dominans, Löneöversynen, Lönepolitiken och
  SKR-uppslaget; texterna säger *mer än* eller *minst* efter valet.
- **Likvärdigt arbete: minsta skillnad 0 % som standard (ADR-61).** Alla par där jämförelseyrket har högre lön visas
  utan att något ändrats; 5 % är ett valbart filter (*Visa bara par med minst … % skillnad*). Nyckeltalet säger hur
  många par det är och hur många som har en ojusterad löneskillnad på minst 5 %, och knappen *Visa alla* visar paren
  utöver de 20.
- **Prioritering: egna ord och rätt rubrik (ADR-62).** Läget mot referensen heter *Börja här*, *Under referens*,
  *Nära referens, under*, *Nära referens* och *Över referens* i fliken, matrisens zoner, Excel-bladet, inställningarna,
  symbolförklaringen och ordlistan, så att orden inte delas med Lika arbetes *Värt att granska*, *Följ upp* och
  *Balanserat*; Att göra kallar punkterna *Löneläge mot referens*. Nyckeltalet heter *Kostnad att nå referensen*, med
  en rad om att det är löneläget mot referensen och inte könsskillnaderna, och PO-raden säger att 39,15 % är SKR:s
  standardvärde för kommuner. Förslagen säger hur nära referensen gruppen ligger i stället för "normal variation", och
  förslaget över referensen är kortare. Handlingsplansunderlaget, rapporten och rapportunderlaget säger hur stor del av
  kostnaden som är kostnad att nå referensen.
- **Prioritering: Skillnad kön med uppmärksamhetstrappans bricka.** Kolumnen *Skillnad kön* i åtgärdslistan har
  samma bricka som Lika arbete. Prioriteringen prövar inte skillnaden mot slumpen, så brickan sätts efter storleken
  (högst *Följ upp*, som i Utforska), och *Går ej att bedöma* när ett kön är för litet. Exporten bär talet.
- **EU-rapportmåtten: reservation om lönebegreppet.** Vid måtten i Lönestruktur, överst i EU-lönerapportens Excel, under
  tabellen i bladet *EU-lönekartläggning*, i rapportens avsnitt *Struktur och lönetransparens* (Rapporttext, Word och
  PDF), i rapportunderlaget, i Om verktyget, i körguiden och i datauttaget står: *Måtten är räknade på fast
  heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning, inklusive rörliga delar och förmåner);
  komplettera ur lönesystemet om ni rapporterar.* Excelbladen har diakriter: *EU-lönekartläggning*, *Löneskillnad*,
  *Löneskillnad per ålder*, *Könsskevhet*, *Slumpens gränser*, *Jämförelsestatistik*, *Sakliga skäl* och
  *Jämförelse_alla_percentiler*.
- **Småfel i text och räknare.** Översikten säger *N intervall redovisas inte i exporten (ett kön under k)* i stället
  för *N maskeras*, och *Under P10 i {referens}* i stället för genitiven efter kolon. Nyckeltalet för Lika arbete AID x
  BAS och trattdiagrammets not räknar samma sak: *N av M bedömda grupper utanför gränserna*. Regressionskortets text om
  korrigeringen för många samtidiga tester säger hur många tester som körs och, från fem tester, hur många falskt
  positiva som väntas; under fem är den en mening. Förklaringsbudgeten säger att det som tillskrivs varje steg beror på
  ordningen, och att kortet *Vad varje variabel tillför* mäter varje variabel ovanpå alla andra. Lika arbetes
  nyckeltal efter ålder och BAS-intervall varnar i verktygstipset när ett kön har färre än 10 i modellen.
- **Kontrollsumma i PowerShell och distributionsansvar.** `SECURITY.md` och körguiden §0 har efter cosign-kommandot
  stycket *Kan ni inte köra cosign: kontrollsumman i RELEASE.txt skyddar mot en skadad eller förväxlad fil*, med
  `Get-FileHash .\oppen-lonekartlaggning.html -Algorithm SHA256` (Windows) och `sha256sum
  oppen-lonekartlaggning.html` (Linux/mac). `RELEASE.txt` skriver samma PowerShell-rad bredvid Linux/mac-raden, och
  release-grinden kräver båda. Säkerhetsbeskrivningen säger att distributionen i organisationen är
  organisationens att avgöra och tar emot beskrivningar av fungerande distributionsvägar som bidrag.
- **Sakliga skäl som strukturerad post.** Varje rad i Handlingsplan har knappen *Sakliga skäl*. Dialogen tar emot
  högst 8 skäl per grupp med kategori (Marknad, Utbildning, Erfarenhet, Prestation och resultat, Övergång, Annat
  sakligt skäl), belopp i kronor per månad och en kort kommentar. Den räknar ihop förklarat och återstående belopp och
  andel av gruppens löneskillnad. När beloppen täcker skillnaden föreslår den att du väljer *Ja, sakligt skäl finns*;
  bedömningen är organisationens. Kommentaren prövas mot personuppgifter som övriga fritexter. Gruppdossiern och
  BAS-dossiern visar bedömningen med en länk till raden, och Att göra har punkten *n grupper i handlingsplanen är inte
  bedömda än*. Rapporten (Rapporttext, Word och PDF) får tabellerna *Sakliga skäl per grupp* och *Sammanställning per
  kategori*, Excel (alla flikar) bladet *Sakliga skäl* och handlingsplansunderlaget två kolumner. Det lilla och det
  stora demot har skäl på tre rader. Årsbokslutet är version 2 och bär skälen (utan kommentarer), och *Jämförelse med
  förra året* visar *Sakliga skäl per kategori* båda åren och de grupper som hade skäl förra året men inte i år.
  Skälen följer med i konfigurationsfilen; en äldre fil läses som förut. För en grupp där ett kön är under minsta
  gruppstorlek står i exporterna och i bokslutet bara kategorierna, utan belopp och kommentar. En not under
  *Sammanställning per kategori* säger vad Totalt och andelen räknas av. Demots skäl tas bort när en riktig lönefil
  läses in; skäl ur en konfigurationsfil rörs inte.

- **Klarspråksputs.** Långa meningar är delade i verktyget och i användar- och dataskyddsdokumenten.
  Termer förklaras första gången de används, och engelska och tekniska ord är utbytta: *Successionszon*
  heter nu *Nära pension*. Diagramtyperna i Tabeller och egna vyer har förklarande hjälptext.
- **Språklig genomgång av hela verktyget.** Samma ord överallt: *löneskillnad* i stället för lönegap och gap,
  *anställda*, *BAS-intervall*, *likvärdigt arbete* och *lönefil* i stället för strukturdata och strukturfil.
  Gränssnittet säger *du* och *organisationen*. Lagen nämns med kapitel: första gången i en vy
  *Diskrimineringslagen kräver att du … (3 kap.)*, sedan *lagen*; inga paragraf- eller artikelnummer i gränssnitt
  och exporter (Källor och raden *Rättslig ram* i metodbilagan undantas). Sakfel rättas mot `lagrum.md`: ingen
  anmälningsplikt; gränsen 5 procent gäller bara villkoret för en gemensam lönebedömning, och lagen kräver analys av
  varje skillnad; Handlingsplanens rader om samverkan och dokumentation pekar inte längre på fel paragraf;
  exportens etikett för underrepresenterat kön säger *under 40 %*; p-värdet och konfidensintervallet förklaras
  rätt i ordlistan, symbolförklaringen och regressionskortet; Medlingsinstitutets tal är desamma i Lönestruktur och
  ordlistan. Excelbladen *Lonegap* och *Lonegap per alder* heter *Loneskillnad* och *Loneskillnad per alder*;
  bladet *Distributionellt gap* heter *Skillnad i lönefördelningen*. CSV-mallen heter `lonefil_mall.csv`. Ordlistan
  har ett eget sökfält, så att de gamla orden fortfarande hittar rätt post, och fyra nya poster (kvinnodominerat
  arbete, kandidatpar, klibbigt golv, glastak). Kvoten heter *Kvinnors lön i procent av mäns* och den råa
  skillnaden *Rå (ojusterad) löneskillnad*; modellen säger *ålder och BAS-intervall*; kandidatparen beskrivs som
  yrken med likvärdiga eller lägre krav; gemensam lönebedömning gäller arbetsgivare som rapporterar
  löneskillnader (100 anställda eller fler); Utforskas gruppvillkor kallar måttet *kvinnors median i % av mäns*.
  Bladet *Likvärdighet §3-10* heter *Likvärdigt arbete* och *3b. § 3-10 Likvärdighet* heter *3b. Likvärdigt
  arbete (krav)*.

- **Förhandskontroll av lönefilen.** Direkt efter inläsningen står avsnittet *Förhandskontroll av lönefilen* överst i
  Filer och kvalitet, under filrutorna: tolkningen av de tio första raderna (BAS, yrke, lön, ålder, kön, och poäng och
  ansvarskod när de finns) med filens värde och verktygets tolkning i samma cell när de skiljer sig (*1978 tolkat som
  48 år*, *K tolkat som kvinna*), och en markerad cell när värdet inte gick att tolka; sammandraget (rader i filen,
  rader som används, rader som faller bort och varför, ålder ur födelseår); värdefördelningen (BAS-värden och de som
  inte är en bokstav A–N, kön-värdena och hur vart och ett tolkas, lönens lägsta, median och högsta, åldern och
  BAS-intervallen under minsta gruppstorlek); kolumnerna som används och inte används, och vilken importprofil som
  kände igen filen. Varningar ges när medianlönen ser ut som årslön (över 150 000 kr) eller timlön (under 5 000 kr),
  när den högsta lönen är över tio gånger medianen, när åldern ligger utanför 16–75 år eller räknats ur födelseår,
  och när BAS eller kön har okända värden eller rader faller bort. Avsnittet är utfällt när det finns något att
  anmärka och hopfällt annars; nyckeltalet säger *inget att anmärka* eller antalet varningar. Varningarna står också
  som punkter i Att göra (Underlagets kvalitet) tills filen läses om utan dem, och inläsningsrapporten länkar till
  avsnittet. Inställningen *Stoppa och visa förhandskontrollen innan inläsning* (standard av, följer med i
  konfigurationsfilen) låter filen vänta på *Läs in*; *Avbryt* släpper filen och lämnar det tidigare underlaget orört.
  Under väntan visas inte förra filens kolumnmappning, och en väntande fil släpps av *Rensa all data* och av
  rensningen vid inaktivitet. Avsnittet namnger filen det beskriver; en fil där ingen rad gick att använda får en
  egen förhandskontroll med raden *Filen lästes inte in*, och det tidigare underlaget står kvar. Varje punkt i Att
  göra har en egen titel, och en varning som redan står som punkt under Datakvalitet eller Fullständighet läggs
  inte till igen.
  Demodata och organisationspaket läses in som förut. Raderna finns bara på skärmen: de ingår inte i någon export
  eller i konfigurationsfilen, vilket k-invariantsviten prövar. Ingen tolkning av värden har ändrats.
- **Importprofiler: kolumnmappningen görs en gång.** En gjord kolumnmappning kan sparas som en importprofil: när
  filen lästs in med kolumnerna utpekade för hand har kolumnmappningen rutan *Spara mappningen* (namn, förslaget *Vår
  personallista*). Profilen bär bara rubrikernas namn per fält och de rubriker som måste finnas (kännetecken), inga
  värden ur filen; den följer med i konfigurationsfilen (fältet `importprofiler`, prövat vid inläsning). När en fil
  läses in prövas organisationspaketets profiler först, sedan konfigurationsfilens, sedan de inbyggda och sist de
  vanliga kolumnnamnen; den första profil vars kännetecken alla finns gäller, och roller den inte täcker känns igen
  som förut. Rubrikraden hittas också efter försättsrader när bara en profil känner igen den. Lönefilens ruta och
  kolumnmappningen säger *Känd uppsättning: … (källa)*. Med ett organisationspaket inläst laddar *Lägg till i
  organisationspaketet* ner ett nytt paket med profilen, byggt ur det inlästa paketets egna delar; paketet har det valfria fältet `importprofiler` (äldre paket
  utan det fungerar som förut). *Inställningar › Importprofiler* listar profilerna med namn, källa och rubriker per
  fält, med *Ta bort* och *Exportera JSON*; sökrutan hittar avsnittet. De inbyggda profilerna gäller bara verktygets
  egna format (CSV-mallen, testdatans fil och demodatans fältnamn) — inga profiler för namngivna lönesystem. *Rensa
  all data* tar bort profilerna; en organisationsfils inbakade paket tar med sina tillbaka. En profil avvisas om en
  text är längre än 80 tecken eller liknar ett personnummer eller en e-postadress, om ett fält har fler än 20
  rubriker eller om de är fler än 50.
- **Rapportutkastet per BAS-intervall.** Auto-rapportutkastet i Rapporttext har efter helheten delen *PER
  BAS-INTERVALL*: ett stycke per intervall med minst k personer, i samma text som BAS-dossierns kopia (antal och
  könsfördelning, läget mot ställningstagandet, yrkesgrupperna med Lika arbetes status, kandidatpar och *Lägre krav,
  högre lön*, åldersgrupperna och förra året när ett bokslut är inläst), och raden *[HR fyller i] Bedömning: …* sist.
  Väljaren *Omfång* ovanför textrutan byter mellan *Hela organisationen* och *Hela organisationen + per
  BAS-intervall* (standard); valet ligger i minnet, inte i konfigurationsfilen, och *Återskapa* följer det. Word-utkastet
  och PDF-rapporten har avsnittet *Lönekartläggning per BAS-intervall* efter likvärdigt arbete: en underrubrik per
  intervall, samma stycken och intervallets yrkesgruppstabell (AID, yrke, kvinnor / män, median per kön, kvinnors
  median i procent av mäns, status), bara med yrken där båda könen når k. Avsnittet är valbart under *Rapportens
  innehåll* och förvalt; det ingår i *Facklig dialog*, inte i *Ledningsbrief*. Ett färdigt urval sparas nu med sitt
  id (`fast` i konfigurationsfilens `rapportUrval`) och följer urvalets gällande lista, så att ett nytt avsnitt kommer
  med; en ändring i listan gör det till ett eget urval. En äldre fil med exakt de tidigare listorna för *Facklig
  dialog* eller alla tolv avsnitt läses som det färdiga urvalet, med det nya avsnittet. Ett sparat eget urval från
  före avsnittet får det på sin plats, utan kryss. Rapportunderlaget har gruppen *Per BAS-intervall* med ett kopierbart
  block per intervall. Allt byggs i exportläget: intervall och yrkesgrupper under minsta gruppstorlek står bara med
  namn. Dossierns text är oförändrad; den, utkastet, rapporten och rapportunderlaget har en gemensam textbyggare.
- **BAS-dossier.** En dialog som samlar ett BAS-intervall på en sida, i rapportens ordning: nyckeltal (antal, kvinnor
  och män, median, P10–P90) och läget mot ställningstagandets rad för intervallet; yrkesgrupperna med antal,
  medianer per kön, kvinnors median i procent av mäns och Lika arbetes status för hela yrket (med en not när yrket
  också finns i andra intervall), med knapp till gruppdossiern;
  kandidatparen och paren *Lägre krav, högre lön* där det kvinnodominerade yrket ligger i intervallet; medianlön per
  åldersgrupp (–34, 35–49, 50–) och kön med länk till Ålder & karriär; och intervallets rad ur förra årets bokslut.
  *Kopiera som text* ger dossiern i rapportens form, byggd i exportläget så att grupper under minsta gruppstorlek
  står utan lönemått. Dossiern öppnas från Löneöversiktens BAS-rader, Lönestrukturs tabell per BAS-intervall,
  gruppdossiern (*Hela BAS …*), raden om markeringen och sökrutan (en BAS-träff har raden *Öppna BAS-dossiern* under
  sig; sökordet *BAS-dossier* öppnar den för första intervallet). Könsuppdelade mått bara där båda könen når k.
- **Löneutveckling per BAS-intervall mot förra året.** Årsbokslutet i konfigurationsfilen har en rad per BAS-intervall
  med minst k personer: antal (kvinnor, män), P10, median och P90, och kvinnors och mäns median när båda könen når k.
  *Jämförelse med förra året* i Spara och jämför år visar tabellen *Löneutveckling per BAS-intervall* (antal, P10,
  median och P90 förra året och i år, förändringen i kronor och procent) och en hantel för medianen per intervall.
  Samma tabell står i rapportens avsnitt *Jämförelse med förra året* (Word och PDF), med hanteln som bild under
  tabellen, och i rapportunderlagets block *Jämförelse med förra året* (samma kolumner som panelen); hanteln följer
  också med i ZIP-filen, också när fliken inte har öppnats. Ett bokslut från en äldre
  version saknar raderna; panelen säger det, och resten av jämförelsen är som förut. Har förra årets fil sparats med
  lägre minsta gruppstorlek än årets läses den med årets: intervall, yrkesgrupper och kön under gränsen visas inte.
- **Antal i grupptabellerna.** Varje tabell som visar ett lönemått för en grupp visar nu också gruppens antal, och
  exporterna har samma kolumn: *Könsfördelning per BAS-intervall* (Antal kvinnor, Antal män; också i Excel och
  PDF-bilagan), kandidatparen i Likvärdigt arbete (*Antal (kvinnodom. / jämf.)*, också i Word-utkastet, PDF-rapporten
  och rapportunderlaget, där också *Lägre krav, högre lön* fått kolumnen), *Lönegap per BAS-intervall före och efter*
  i Löneöversyn (*Antal (Kv/Mä)*), handlingsplanen (*Antal berörda*: gruppens antal, för ett kandidatpar det
  kvinnodominerade yrkets, tomt för en egen rad; på skärmen, i Excel-underlaget, i Word-utkastets *Åtgärder och
  tidsplan* och i rapportunderlaget) och de flaggade yrkesgrupperna i *Jämförelse med förra året* (*Kvinnor / män*).
  Tabeller där alla rader bygger på samma urval bär antalet i rubrikraden: percentiltabellen i *Var i
  lönefördelningen sitter gapet?* (EU-rapportens blad *Distributionellt gap* får kolumnerna Antal kvinnor och
  Antal män), kvantiltabellen, *Vad varje variabel tillför*, Oaxaca-tabellen och modelljämförelsen i Ålder &
  karriär ("n = 260; 138 kvinnor, 122 män"). Inga tal har ändrats.
- **Småsaker efter omläggningen.** *Organisationen som karta* i Lönestruktur är ett eget avsnitt, hopfällt från
  början och med antalet yrkesgrupper i rubriken, så att fliken öppnar med slutsatserna och representationen.
  Processkartan på Översikt har nio steg: *Samverkan med facket* står under Åtgärder och leder till kortet
  *Samverkan & uppföljning* i Handlingsplan, och *Rapporttext* är ett eget steg under Rapport. Kom igång säger
  "prova med demodata, litet eller stort (7 000 personer)". I Inställningar är knappen till extremvärdenas tröskel
  låst tills en lönefil är inläst. Funktionssökningens träfflista grupperar Grupper och Funktioner som ARIA-grupper
  med egen rubrik, och sidindexet behåller det avsnitt man klickat på markerat tills man själv rullar. Lönestrukturens
  mått räknas på ett ställe för fliken, rapportutkastet och EU-exporten (inga tal har ändrats), och auto-utkastet i
  Rapporttext har id:t `avsnitt-rt-utkast`.
- **Stort demo: 7 000 personer.** Bredvid *prova med demodata* (260 personer) i Kom igång på Översikt och i
  lönefilskortet i Filer och kvalitet finns *stort demo (7 000 personer)*: en påhittad organisation i storlek med en
  mindre kommun, med BAS-intervall A–K, 30 yrkesgrupper med koder ur etikettlistan, ett inlagt
  oförklarat gap på 2,5–4 % i fyra yrken, ett par för likvärdigt arbete i BAS C och små grupper som maskeras i
  exporterna. Adressen `?demo=stor` startar det direkt. Demobannern och filraden säger att det är det stora demot.
  Självdiagnostiken körs bara på det lilla demot, som är oförändrat. Demots ställningstagande har en rad för BAS K
  i det stora demot.
- **Fliken Filer och kvalitet.** Filrutorna (organisationspaket, lönefil, ställningstagande och jämförelsestatistik),
  Underlagets kvalitet, extremvärdena och inläsningsrapporten flyttar från Översikt till en egen flik i *1 ·
  Underlag*. Översikt behåller Kom igång, nyckeltalen, Att göra och processen, och raden överst har knappen dit.
  Kvartildiagrammet på Översikt är borttaget; Lönestruktur ritar samma bild. En låst flik och kolumnmappningen leder
  till lönefilskortet i Filer och kvalitet.
- **Lönestruktur: varför gapet sitter där det sitter.** Struktur & rapportmått heter Lönestruktur och tar över
  *Lönegap per BAS-intervall*, *Könsfördelning per BAS-intervall* och *Vad blir kvar av lönegapet?* (förklaringsmodellen,
  regressionen och Blinder-Oaxaca) från Lika arbete, och *Var uppstår löneskillnaden?* från Översikt. Lika arbete
  behåller yrkesgrupperna med trattdiagrammet, Personer att granska, *Lika arbete AID x BAS* och *Analys på
  individnivå*; nyckeltalen överst har kvar regressionens tal. I Lönestruktur är bara representationen utfälld när
  fliken öppnas. Metodbilagans ordning i Excel och utskrift är densamma som förut.
- **Rapporten i tre flikar.** Dokumentera & exportera delas i **Rapporttext** (auto-rapportutkastet och
  rapportunderlaget; låst utan lönefil), **Exportera** (färdigchecken, robustheten direkt efter den, rapportens
  innehåll och all export) och **Spara och jämför år** (konfigurationen, ögonblicksbilden, jämförelsen med förra året
  och självdiagnostiken; öppen utan lönefil). Avsnittet Samverkan och uppföljning är borttaget: dess två knappar,
  protokollet för gemensam lönebedömning och handlingsplanen i Excel, står i Handlingsplans kort *Samverkan &
  uppföljning*. Alla tre flikarna ritas i exportläget.
- **Prioriteringens trösklar och viktning står i Inställningar.** Granskningsgränsen, *Börja här*-tröskeln,
  uppföljnings- och över referens-gränsen och viktningen av prioriteringsindexet flyttar ur Prioritering till en egen
  rubrik i Inställningar, mellan *Gäller alla flikar* och *Läge*. Fliken har raden *Trösklar och viktning*, som säger
  om värdena är ändrade, med länken *Ändra*. En konfigurationsfil sätter värdena som förut.
- **Menyn i rapportens ordning.** Grupperna heter *1 · Underlag*, *2 · Kartläggning*, *3 · Åtgärder*, *4 · Rapport*,
  *Arbetet* och *Hjälp*; *Fördjupa (ej lagkrav)* finns inte längre. Jämförelse heter **Löneläget** och står först i
  Kartläggning, Ålder & karriär sist; båda säger i verktygstipset och inledningen att de är fördjupning och inget
  lagkrav. Utforska heter **Tabeller och egna vyer** och står efter Exportera. *Nästa steg* följer menyn (Regler &
  praxis → Löneläget → … → Handlingsplan → Rapporttext → Exportera) och hoppar över Löneläget och Ålder & karriär
  när de är låsta; leder raden till en låst flik öppnas lönefilskortet, som menyn gör. Processkartans faser heter
  som menyn, och fliknamnen i gränssnittet och exporttexterna är bytta.
- **Sidindex: På den här sidan.** Varje flik med minst tre synliga avsnitt har en lista över dem som följer med när
  sidan rullas. Från 1920 punkters bredd står den i marginalen till höger; smalare än så är den en rad överst,
  *På den här sidan: …*, som säger vilket avsnitt läsaren är i och fälls ut med ett klick. Ett klick på ett avsnitt
  fäller ut det, rullar fram det och ger det fokus. Dolda avsnitt står inte i listan, och den byggs om när fliken
  ritas om.
- **Sökrutan hittar funktioner.** Fältet i sidhuvudet hittar också flikarnas avsnitt, exporterna, dialogerna och
  fälten i Inställningar, med synonymer (*regression* hittar *Vad blir kvar av lönegapet?*), och syns utan lönefil.
  Träfflistan har grupperna först och funktionerna under rubriken *Funktioner*. En funktion i en låst flik säger
  *kräver lönefil* och leder till lönefilskortet i Filer och kvalitet.
- **Småsaker ur granskningarna.** Tabellen *BAS-effekter* i regressionens tekniska specifikation och Word-utkastets
  och PDF-rapportens *Sekventiell dekomponering* bär antalet i rubrikraden (*n = …; … kvinnor, … män*), som de andra
  modelltabellerna. Årsjämförelsens kolumn heter *Kvinnor / män {år}*; en grupp som inte finns i år visar förra årets
  antal med förra årets årtal. Sökrutan hittar avsnitten som flikarna bygger när de ritas (*Att göra: alla punkter*,
  Likvärdigt arbetes fyra avsnitt och Lönelägets fyra mot ställningstagandet). Escape i gruppdossiern och BAS-dossiern
  stänger bara dialogen; diagrammarkeringen står kvar. Årsjämförelsens not säger att en grupp som förra året hade ett
  kön under den högre av årens gränser räknas som ny i år. Kom igång och lönefilskortet säger båda *litet demo* och
  *stort demo (7 000 personer)*.

- **Bilaga: gruppdossierer i Word-utkastet och PDF-rapporten.** Under *Rapportens innehåll* finns sist avsnittet
  *Bilaga: gruppdossierer*, förvalt av: kryssat i får rapporten en gruppdossier per yrkesgrupp där både kvinnor och
  män når minsta gruppstorlek, med samma text som dossierns kopia och byggd med minsta gruppstorlek. Grupper där ett
  kön är under gränsen räknas i förhandsbeskedet men namnges inte. BAS-dossiererna står redan i avsnittet per
  BAS-intervall och upprepas inte. Texten är vanlig svenska med å, ä och ö ("Gruppdossier: …", "män", "sakliga
  skäl"), också i kopian till urklipp. Meningen om sänkt minsta gruppstorlek står en gång överst i bilagan.
  Förhandsbeskedet bygger inga dossiertexter, och bilagan kostar ett par tiondels sekunder även på stora underlag.

- **Småsaker efter förhandskontrollen.** Ett färdigt urval under *Rapportens innehåll* med bilagan ikryssad heter
  urvalet med tillägget *+ bilaga* (*Ledningsbrief + bilaga*), och alla avsnitt med heter *Alla avsnitt*, i stället
  för *Eget urval (14 av 14 avsnitt)*. Ett kryss i listan ritar om förhandsbeskedet utan att räkna om avsnitten: 0,27 s
  mot 3,0 s vid 55 000 rader (`npm run perf` vaktar med gränsen 1 s). Motiveringsförslaget om åldersskillnad i Prioritering säger *Vi
  rekommenderar att ni stämmer av*. *Lägg till i organisationspaketet* prövar inte längre formuläret *Skapa
  paket*, som inte påverkar det paketet (*Spara paketet* gör det som förut). Pekar kolumnmappningen ut en annan kolumn än
  importprofilen som kände igen filen säger lönefilens ruta *Känd uppsättning, ändrad: …*. Den inbyggda profilen för
  verktygets egna fältnamn heter *Verktygets grundfält* (förut *Demodatans fält*), så att en verklig fil med de
  rubrikerna inte kallas demo. Kom igång på Översikt säger *Ingen fil till hands? Prova med demodata, litet demo
  eller stort demo*, samma mening som lönefilskortet, i stället för *eller … eller*.

- **"1 person", inte "1 personer".** Texter där minsta gruppstorlek står före *personer* (*minst … personer*,
  *färre än … personer*) böjs efter talet, på skärmen och i exporterna. Stora demot sätter tröskeln till 1, och då
  stod det till exempel *bara BAS med minst 1 personer* under bandkartan.

- **Kostnadsdiagrammet i Prioritering skriver *BAS C*.** Gruppens etikett slutade på *· C*; nu står *· BAS C*, som på
  knappen för BAS-intervallet ovanför diagrammet.

### Exporter

- **Word-utkastets tabeller inför Word-testet.** Två tabeller i följd skiljs av ett tomt stycke (Word slår annars
  ihop dem till en tabell), tabellbredden står i samma enhet som kolumnerna och cellerna, och varje tabell har
  `w:tblLook` som Word själv skriver.
- **Word-utkastet är prövat i Microsoft Word.** Utkastet är öppnat i Word 365 och 2019 med litet och stort demo, och
  förbehållet om att det bara är prövat i LibreOffice är struket ur README och sammanfattningen för HR-chefer.

### Analys

- **Robusthet i små saker.** Den sekventiella dekomponeringen och *Vad varje variabel tillför* filtrerar själva bort
  rader utan positiv lön, med okänt kön (räknades annars som män) eller utan ålder när lönefilen har ålder, som
  regressionen per BAS-intervall redan gjorde. PII-kontrollen prövar värdena i 50 rader spridda jämnt över filen i
  stället för de 50 första, i både CSV- och Excel-vägen, och känner igen namn med versaler, gemener och efternamnet
  först med komma (*ANDERSSON, ANNA*). Regressionskortets tekniska specifikation visar antalet observationer med
  hävstång > 0,99, som inte bidrar till de robusta standardfelen (HC3).
- **Kvantilregressionen på huvudmodellens variabler (ADR-63).** Löneskillnaden vid P10, medianen och P90 skattas med
  samma variabler som huvudtalet enligt förklaringsmodellen (BAS-intervall som indikatorer, ålder när den är vald),
  utan yrkesgrupp inom BAS, i stället för BAS som ett tal. Tabellen har raden *P90 − P10* med bootstrap-intervall, och
  *glastaket* eller *det klibbiga golvet väger tyngre* sägs bara när intervallet för skillnaden utesluter noll — annars
  *Ingen säkerställd skillnad mellan delarna av lönefördelningen*. Skattningarna färgas inte längre efter 5 %.
  Diagrammet visar inte längre intervallets gränser som råa tal på kategoriaxeln.

- **Lönespridning i årsbokslutet.** Bokslutets rader per yrkesgrupp och per BAS-intervall bär lönespridningen,
  (P90 − P10) / median, räknad där gruppen har minst k personer (bara totalt, inte per kön). Panelen *Jämförelse med
  förra året* har kolumnen *Lönespridning* förra året och i år i tabellen per BAS-intervall och i de flaggade
  yrkesgruppernas tabeller, och Word-utkastets och PDF-rapportens tabell per BAS-intervall har kolumnen. En fil från en
  äldre version saknar måttet och visar streck.

- **Spärr mot särskilda kategorier av personuppgifter.** Lönefilen avvisas när en kolumnrubrik antyder fackmedlemskap,
  hälsa, sjukfrånvaro, diagnos, etnicitet, religion, politisk tillhörighet, sexuell läggning, funktionsnedsättning,
  genetik eller biometri — som identifierare avvisades redan. Bara rubriken prövas (lagrum.md, C23b).

### Dokumentation

- **Ansvarsförbehåll och övergripande juridikspråk (beslut 8c).** Samma förbehåll — verktyget är ett stöd för
  arbetsgivarens egen lönekartläggning, användaren ansvarar för användning, tolkning och juridisk bedömning, och
  verktyget är inte juridiskt granskat — står i Om verktyget, rapportunderlaget, Word/PDF:s sammanfattning (raden
  *Ansvar* under *Rättslig ram*), metodbladet i varje Excel-export, README, HR-sammanfattningen och körguiden.
  README och HR-sammanfattningen säger att verktyget inte prövats med verklig lönedata och att Word-utkastet bara
  prövats i LibreOffice. De sista resterna av "lagstadgat" och "direktivet kräver" är omskrivna. Medlingsinstitutets
  tal i ordlistan och Lika arbete har löneår och rapport (löneåret 2025: 9,9 och 4,4 procent), och BAS-posten säger
  att verktyget *antar* lika breda poängintervall. Nytt vakttest `tests/juridiksprak.test.js`; `lagrum.md` säger att
  ingen jurist granskar före lansering.
- **Språklig genomgång av dokumenten.** Körguiden, pilotchecklistan, sammanfattningen för HR-chefer, datauttaget,
  README och guiden för att ta över verktyget säger *du*; orden följer gränssnittet; § 8 och § 9 som namn på flikar
  är borta; informationen till anställda hänvisar inte längre till direktivets artikel 13. `lagrum.md` har en rubrik
  om tillgänglighet (DOS-lagen) och säger *löneskillnadens definition*.

- **Importprofiler.** `docs/anvandare/datauttag.md` har avsnittet *Importprofiler: spara mappningen en gång* och en rad
  per system om att ett uttag med sparad profil känns igen automatiskt; `organisationspaket.md` beskriver fältet
  `importprofiler`; `CONTRIBUTING.md` säger hur en verifierad profil bidras (JSON och vilket system och version, utan
  organisationens namn).
- **Dokumentationen följer den nya menyn.** Körguiden, pilotchecklistan, sammanfattningen för HR-chefer,
  organisationspaketets guide, datauttaget, tillgänglighetsredogörelsen, dataskyddsbeskrivningen, riskanalysen, den tekniska
  planen, diagramkärnans referens, `src/app/README.md` och fliken Om verktyget (flikarna och arbetsgången) beskriver flikarna som de heter
  och ligger nu. Körguiden har ett avsnitt *Hitta rätt: sök och sidindex*.
- **Ansvar och roller, styrning och övertagande.** README har ett avsnitt *Ansvar och roller* (personuppgiftsansvar,
  cyberresiliensakten och produktansvarsdirektivet, AI-förordningen, lagrummens status *Förslag*), med artiklarna i ett
  nytt avsnitt *Produkt- och säkerhetsregler* i `docs/utveckling/lagrum.md`. `GOVERNANCE.md` säger vem som beslutar, hur
  en version släpps och vad som gäller om projektet slutar underhållas; `CODE_OF_CONDUCT.md` är en svensk bearbetning
  av Contributor Covenant 2.1. `docs/anvandare/overta-verktyget.md` beskriver hur en organisation bygger, ändrar,
  signerar och sprider sin egen version. Raden om svensk lag om lönetransparens i `lagrum.md` är uppdaterad till
  läget i oktober 2026.

### Utveckling

- **Vakttest för ordvalen** i `tests/dokumentation.test.js`: index.html, strängarna i appen och användar- och
  dataskyddsdokumenten prövas mot de avförda orden, paragraftecken och artikelnummer, med undantag för kommentarer,
  identifierare, sökregistrets synonymer, ordlistans sökfält och Källor. p-värdevakten fångar fler felaktiga
  formuleringar och också konfidensintervallets. Vakten skannar hela `src/lib` och prövar etikettvärden och
  användarlästa attribut också när de är ett ord.

- **Importprofilerna i `src/lib/importprofiler.js`** (validering, matchning, profil ur en mappning, de inbyggda),
  speglade i 09. Tester i `tests/importprofiler.test.js` och `tests/importprofiler-app.test.js`; profilexporten ligger
  i k-invariantsviten som en utdata utan lönemått; webbläsarröktestet har delen `tools/browser-smoke/importprofiler.mjs`
  (okänd fil, mappning, spara, samma fil igen utan mappning).
- **Webbläsarröktestet delat per område.** Kontrollerna ligger i `tools/browser-smoke/` (laddning, flikar och diagram,
  diagramkärnan, exporter, layout, dialoger, säkerhet, demo) med en gemensam rigg; `tools/browser-smoke.mjs` kör dem i
  samma ordning som förut. Samma kontroller och samma sammanfattning.
- **Regel för ny utdata.** Varje ny utdata som lämnar verktyget läggs i k-invariantsviten och i riskanalysens tabell
  över utdata innan den checkas in (teknisk-plan K7 och CONTRIBUTING).
- **Prestandasvepet mäter navigeringen.** `npm run perf` mäter också sidindexet per flik, den första sökningen och
  tiden att öppna BAS-dossiern och gruppdossiern.
- **minimatch 11 under ESLint.** Dependabot larmade om minimatch under 11.0.1 (överbelastning via mönster) men kunde inte
  uppdatera, eftersom ESLint låser 10.x; `overrides` i package.json tvingar fram 11, som ESLint fungerar med. Bara ett
  utvecklingsberoende; verktyget bär inte minimatch.
- **Programvaruförteckning (SBOM) på releasen.** `npm run sbom` (`tools/sbom.mjs`) skriver `dist/sbom.cdx.json` i
  CycloneDX med de fyra inbyggda biblioteken (version, licens, kontrollsumma) och artefaktens kontrollsumma;
  release-arbetsflödet signerar den som de andra filerna. Deterministisk, utan beroenden.
- **Snabb och full testkörning.** Sviten är delad i två Vitest-projekt: `enhet` (moduler, vakter och källtext) och
  `app` (filerna som ritar verktyget i jsdom), klassade automatiskt efter testfilens källa. `npm test` kör bara
  `enhet` och tar sekunder; `npm run test:full` kör hela sviten, ska köras före en pull request och körs i CI
  (`npm run test:app` kör bara jsdom-filerna). Testantalet i `teknisk-plan.md` jämförs inte längre med sviten, så ett
  nytt test kräver ingen dokumentändring. K-tröskelns invariant över flikar och exporter körs i två filer, en per
  tröskel, så att de två förberedelserna går parallellt, och förberedelsens tidsgräns är höjd från 120 till 300 s.
- **Neutralitetsregeln i stället för ordvakten.** Vakttestet som sökte igenom hela repot efter en lista med
  kontrollsummor (namngivna organisationer och spår av tidigare versioner) är borttaget; regeln att verktyget är
  neutralt och inte kopplat till någon organisation står i `CONTRIBUTING.md` och `CLAUDE.md`. Testerna för
  produktnamnet och för ordet "förvaltning" står kvar.
- **Webbläsartestet i CI:** en vanlig push till en gren kör bara Chromium; pull requests, main och manuella
  körningar kör Chromium, Firefox och WebKit.
- **K-tröskeltesterna slagna samman med invarianten I4.** I4 söker nu också igenom varje flik ritad i exportläget
  (det som *Som i exporten* visar och exporterna läser) och EU-lönerapportens rader, där könsgapet står med en decimal
  utan tecken. Tester som prövade samma vägar för sig är borttagna, vart och ett efter ett mutationsprov: en läcka
  infördes i koden som testet vaktade, och både testet och I4 (eller R1:s helkörning) föll. Borttagna: flikarna i
  exportläget, rapportunderlaget och Excel-exporterna i `kanonymitet.test.js`; Word-utkastet, utskriften och Excel
  vid 10 i R1; C2:s Word-utkast, utskrift och EU-lönerapport; exportlägestesterna i `ktroskel.test.js`. R1:s
  helkörning prövar också den förklarade andelen och att bilagan med stegen finns. 31 tester färre i k-tröskelfilerna
  och `kanonymitet.test.js` (277 till 246); filerna tar omkring en tredjedel kortare tid.
  Tester som bara prövar en stämpel eller mening om tröskeln (utskriften, Word-utkastets sidfot, ZIP-filens bilder
  och Excel-fil, rapportens not om utelämnade BAS-intervall) kör på en liten fixtur, `fonsterLitet` i riggen (116
  rader i stället för ~1 150), och fäller fortfarande när stämpeln tas bort eller hamnar där den inte ska vara.

## 2026.11.05

### Gränssnitt

- **Inga bilder i stilmallen.** Sorteringspilarna i tabellhuvuden och hänglåsen på låsta menyflikar och före noten om
  dolda grupper ritades som masker ur inbäddade `data:`-adresser; webbläsarens nätverkspanel visade dem som hämtningar
  fast inget lämnade datorn. Pilarna ritas nu med kanter i CSS, menyns hänglås är en inline-SVG i knappen och notens
  hänglås två pseudo-element, och röktestet kräver att stilmallen inte har någon `url(`.
- **Samma ord, färger och mått i alla flikar.** En skillnad mot 3- och 5-procentsgränserna heter *Balanserat*,
  *Följ upp* eller *Värt att granska* i alla flikar, diagram och exporter, med samma färg och symbol (lila för *Värt
  att granska*, också i Lika arbetes BAS-översikt och Utforska); *Börja här* och *Över referens* finns bara i
  Prioritering, och Förklaringen listar orden en gång med färg och märke bundna till ordet. Nyckeltalsraderna visar
  ett mått, kvinnors lön i % av mäns: regressionens oförklarade skillnad i Lika arbete och livscykelmodellens tal vid
  25 och 65 år räknas om, och kortet längre ned säger hur dess skillnad hänger ihop med nyckeltalet; rågapet på
  Översikt har neutral färg, det är en utgångspunkt, inget fynd. Etiketterna säger vad de betyder: *Som i exporten* i
  stället för *Som export*, *Kvinnodominerad*, *Mansdominerad* och *Könsblandad* i Lika arbetes kolumn Dominans,
  *Summa för gruppen (kr/mån)* med verktygstips i Likvärdigt arbete, Excel-bladen och beviset, och Nästa steg-knappen
  till Prioritering heter som menyn. Utforskas rubriker skriver BAS och AID med versaler, Heatmap heter Värmekarta,
  och "Hur används denna flik vid..." heter *Så används fliken i arbetet*.
- **Resultatet först, och breda tabeller utan rullist.** Lika arbete öppnar med tabellen *Kvinnor och män i samma
  yrkesgrupp* och trattdiagrammet under den; tabellen per BAS-intervall och *Lönegap per BAS-intervall* är ett avsnitt
  i Fördjupning, efter Personer att granska, beviset för en rad står vid intervallets namn, diagrammen med samma kvot
  och samma kronor som tabellen visas inte längre (kvotbilden följer med i rapporten) och länkarna i Att göra fäller
  ut avsnittet de leder till. Översikt har Att göra direkt under nyckeltalen, kartan över organisationen står bara i
  Struktur & rapportmått och lönekvartilerna står efter Att göra i hela bredden. Utforska har två öppna avsnitt,
  *Löneöversikt — alla BAS-intervall* och *Egna vyer*, och diagramtypsväljaren grupperna *Vanliga* (Automatisk,
  Staplar, Liggande staplar, Låddiagram, Grupperade staplar) och *Fler diagramtyper*. Dokumentera & exportera är
  menyns sista steg, efter Fördjupa, och *Klar här?*-raderna går genom fördjupningen dit; fliken har bara exporter
  som rader, de fyra raderna med *Öppna fliken* är en rad med länkar till Likvärdigt arbete, Struktur & rapportmått,
  Prioritering och Löneöversyn, och fältet *Organisation* står intill *Generera PDF* med en mening om att namnet
  skrivs på rapportens försättsblad och hämtas från organisationspaketet. I Löneöversyn står *Föreslå fördelning mot
  osakliga gap* också i rutan Budget (pott), aktiv när en pott är angiven; knappen fäller ut Riktade potter och rullar
  dit, och lönesumman säger "från …" bara när den ändrats. Prioriteringslistan, yrkesgruppstabellen i Lika arbete och
  kandidatparen i Likvärdigt arbete visar det viktigaste först: statusen står direkt efter namnet (i Likvärdigt
  intervallet med *säker skillnad*, efter Gap (%)), och sekundära kolumner ligger bakom knappen *Fler kolumner* bredvid
  Kopiera och CSV, så att tabellerna ryms vid 1280 px med menyn utfälld. Valet gäller tabellen under sessionen och
  lagras inte; Kopiera, CSV, Excel och utskriften tar alltid med alla kolumner, och de gömda talen står i beviset
  (förstoringsglaset) på raden.
- **Handlingsplanen fylls i på skärmen.** Sakligt skäl prövat? och Status är rullistor, Ansvarig och Tidsplan
  fritext. Det som fylls i ligger i minnet, följer med i konfigurationsfilen, Excel-filen, utskriften och Word-utkastets
  åtgärdstabell, och nollas av Rensa all data; fritext som liknar ett personnummer eller en e-postadress ger en
  varning. Alla rader har samma form: yrkesnamnet ("403010 Barnskötare · BAS C") och i Underlag var raden kommer
  ifrån, *Prioritering (under referensen)* eller *Likvärdigt arbete (kandidatpar)*. Word-utkastets tabell under
  Åtgärder och tidsplan är handlingsplanen, med kandidatparen, och ingressen säger "från likvärdighetsanalysen".
- **Jämförelse är en flik med tre avsnitt.** Överblick, mot ställningstagandet (dagens Lönepolitik) och mot
  jämförelsestatistiken; växeln *Jämför mot* är borttagen, fliken syns så snart underlaget och en referens är inlästa,
  och länkar till Lönepolitik leder till Jämförelse. Fliken har en inledning som övriga flikar. Mönster och Förslag på
  referens är en kolumn, *Läge och förslag*, där förslaget bara nämns när det är statistiken; skärmen, Excel-bladet
  Referenser och rapporten säger samma sak. Läget i spannet har skalan i rubriken (0 = P10, 100 = P90) och ett
  verktygstips, och hanteldiagrammet har en rad per yrkesgrupp, med ställningstagandet, statistiken och organisationen
  i var sin färg och en förklaring.
- **Vardagsspråk i inledningar, nyckeltal och hjälptexter.** Prioriteringens inledning och listtext säger vad
  prioriteten väger ihop utan "sammansatt prioriteringsindex", "yrkesgrupp × BAS-intervall" och "1,2× bonus"; filtret
  heter *Visa bara små höjningar med stor effekt*, kostnaden anges med PO-påslag utskrivet och *Så räknas det* beskriver
  statusarna med dagens ord. Struktur och Utforska har sin fråga i fetstil. Om verktyget säger vad verktyget gör och
  vad ni gör själva, med Word-utkastet, Regler & praxis och organisationspaketet på plats; snabbstarten följer
  kartläggningens steg och engelska rubriker i dataskydds- och metodavsnitten är svenska. Ålder & karriär säger
  "inte säkerställd" i stället för "ns", modelljämförelsen markerar med stjärnor som tabellens not förklarar (* p <
  0,05 … *** p < 0,001), modellformeln, standardfelen och referensintervallet står i flikens nya *Så räknas det* →
  *Beräkning & urval*, löptexten säger i en mening vad modellen tar hänsyn till, och *Jämför alla BAS-intervall* visar
  alla intervall oavsett urvalet ovan; histogrammet och ålderskurvan markerar inte längre successionszonen 60+ med
  ett rött fält, nyckeltalet *Andel 60+* och riskrutan bär den läsningen. I Regler & praxis hämtar raden Stöd i verktyget talet från fliken och slutar med
  *Gå dit*: Likvärdigt arbetes par att titta närmare på, Lika arbetes yrkesgrupper att granska och, under befordran,
  andelen kvinnor i högsta och lägsta lönekvartilen; utan underlag står den fasta texten. Krav mot lön i Likvärdigt
  arbete sade "minst 1 personer" på skärmen, och exportkortens *Utelämnar* räknade samma sak två gånger när två
  avsnitt utelämnade det.
- **Efter genomgången: sju öppna beslut.** Regressionens per-BAS-diagram ritar *Säkerställt, över 5 %* i statusens lila,
  inte rött; tratten behåller rött för *Utanför slumpens gränser*, som är en annan skala. Lika arbetes avsnittsnyckeltal
  säger "95,7 % efter ålder och nivå" i stället för "−4,3 % oförklarat", och undertexter över 5 % (Lika arbete, Ålder
  & karriär) är lila som statusen, inte röda. Trädkartan följer med i Word-utkastet och PDF-rapporten under Struktur.
  Excel-bladen *Per BAS* och *Lonegap* behålls båda; *Metod & parametrar* säger vad som skiljer dem. Handlingsplanen
  har knappen *Lägg till rad*: en egen åtgärd med fritext för åtgärd och grupp, som tas bort med *Ta bort* och följer
  med i konfigurationsfilen, Excel-filen, utskriften och Word-utkastet; kortet *5. Handlingsplan* på Översikt räknar
  raderna efter statusen som fyllts i (genomförda, planerade eller pågår, skjuts upp, utan ifyllt) i stället för
  åtgärdslistans bockar. Jämförelsetabellen har *Fler kolumner*: grundvyn visar yrke, BAS, antal och medianens tre
  kolumner, P10 och P90 ligger bakom knappen. Menyn och rubriken säger *Översikt*, inte *Översikt & Data*; sidhuvudets
  ikonknappar gäller upp till 900 punkter; sökfältets ledtext är *Sök yrke eller BAS* med kortkommandot i
  verktygstipset; länkraden i Dokumentera har verktygets länkstil.
- **Menyn, sidhuvudet och flikbytet.** En ny flik börjar överst: flikbytet rullade inte, så den som stod långt ned i
  en flik hamnade långt ned i nästa. Sidomenyns ikonläge (641–1100 px) döljer etiketterna med genomskinlighet i
  stället för `visibility: hidden`, så att knapparna behåller sina namn för skärmläsare. Under 641 punkter är
  Förklaring, Som i exporten, Inställningar och Ordlista ikonknappar på samma rad som sökfältet, med texten kvar i
  knappen för skärmläsare; sidhuvudet vid 375 punkter är 133 punkter högt i stället för 214, och byts fönstret från
  brett till smalt börjar den smala vyn med menyn stängd, utan att spalten glider ut över innehållet.
- **Som export — förhandsvisning av exporten.** Knappen i sidhuvudet visar flikarna som i det som lämnar
  verktyget: grupper under minsta gruppstorlek redovisas inte, en banner och en streckad ram visar att
  förhandsvisningen är på, och *Visa skärmen igen* ritar tillbaka. Efter användartest: skärmen visar alla grupper,
  och den som ska skicka en fil vill se vad som faller bort.
- **Prioritering är vad, Löneöversyn är hur (ADR-50).** Prioritering svarar på vad som bör åtgärdas och vad det
  kostar; Löneöversyn på hur potten fördelas. Lönerevisionssimulatorn i Prioritering är borttagen: en riktad pott i
  Löneöversyn kan i stället begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå
  (*höj till*). PO-påslag och beräkningsperiod står under Inställningar i sidhuvudet (*Gäller alla flikar*) i
  stället för i Prioritering, och Löneöversyns Excel-export beskriver varje riktad rad. Efter användartest: flikarna
  gick in i varandra.
- **Hänvisningarna till SKR är förklarade.** Kolumnerna och märkena som bara sade "SKR" heter nu *Kvinnor nationellt*
  respektive *nationell*, och verktygstipsen säger vad statistiken är (andel kvinnor per yrke i kommuner och regioner),
  varifrån den kommer (SKR:s personalstatistik, med period) och vad valet kommun eller region gör. PO-påslagets
  standardvärde förklaras som SKR:s värde för kommuner och regioner; bristyrkestipset hänvisar inte längre till
  SKR-listor. Ordlistan har fått posten *SKR*, metodbilagan en rad om den nationella referensen, och *Om verktyget*
  förklarar de tre sakerna verktyget hämtar från SKR. Efter användartest: "SKR-statistik" var oklart.
- **Hjälptexterna *Så används fliken*** i Lika arbete, Prioritering och Utforska är omskrivna efter dagens
  avsnitt, knappar och ord (inte längre "waterfall-uppdelningen", "Quantile regression", "röda romber",
  "konfig-panelen"); menyn har ett verktygstips för Prioritering, och ordlistan säger att kvoten (85,2 %) och
  skillnaden (−14,8 %) är samma tal.
- **Rensning vid inaktivitet: 90 minuter som standard** (tidigare 30). Valen är av, 30, 60, 90 och 120 minuter;
  organisationspaketet kan fortfarande låsa tiden. Efter användartest: 30 minuter avbröt ett normalt arbetspass.

### Exporter

- **Fyra blad per AID-kod och BAS-intervall (ADR-57).** Excel-filen har bladen *Lika arbete AID x BAS*, *Likvärdigt
  arbete*, *Hierarkisk jämförelse* och *Analys på individnivå*, med kolumnnamn som går att klistra in i rapporten utan
  att ändras och lönemånaden på raden ovanför tabellen. Lika arbete är samma yrkesgrupp på samma nivå: en rad per
  AID-kod och BAS-intervall ur varje persons egen rad, med kvinnors median i procent av mäns mot slumpens gränser
  (trattdiagrammets omkastning, räknad per grupp) och bedömningen *Inom gränserna*, *Utanför gränserna* eller
  *Analyseras på individnivå* när något kön har färre än tio personer. Likvärdigt arbete klassar varje grupp som
  kvinnodominerad, könsblandad eller mansdominerad, säger om yrket *brukar anses* kvinnodominerat efter andelen kvinnor
  nationellt, ger median och lönespridning ((P90 − P10) / median) för grupper med minst tio personer och en
  sammanfattning per BAS-intervall. Den hierarkiska jämförelsen listar par där ett arbete i lägre BAS som inte är
  kvinnodominerat har högre median än ett kvinnodominerat arbete i högre BAS, eller säger att inga sådana fall finns.
  Arbetslistan för individnivå har grupperna där något kön är under tio, utan löner och med kolumnerna *Analys
  genomförd* och *Resultat* att fylla i. Grupper med färre än fem personer får ingen egen rad utan räknas upp i en not.
  Tal skrivs som tal med svenskt talformat i cellen; procent med en decimal. Bladet Metodik beskriver grupperingen,
  små grupper, gränserna för slumpen och vald definition. Samma tabeller står som avsnitt i Lika arbete och Likvärdigt
  arbete, med Kopiera och CSV.
- **Rättat: fliken Slumpens gränser räknar per AID-kod och BAS-intervall.** Trattdiagrammets underlag grupperade per
  yrkesgrupp över alla BAS-intervall och satte gruppens intervall från dess första rad, så en yrkesgrupp i flera
  intervall redovisades i ett godtyckligt av dem med alla sina personer. Nu är gruppen yrkesgrupp och intervall, i
  diagrammet, i bladet och i tabellen *Lika arbete AID x BAS*, som delar gränserna med fliken.
- **Lönerna mot referenserna.** Nytt blad *Referenser* i Excel-filen, nytt avsnitt *Lönerna mot referenserna* i
  Word-utkastet och PDF-rapporten, block i rapportunderlaget och listan i utskriften. Yrkesgrupper under minsta
  gruppstorlek redovisas inte.

- **Egna tabeller i rapporten (ADR-52).** Ovanför tabellen i Utforska finns *Lägg till i rapporten*: vyn sparas som ett
  recept (rader, kolumner, mått och urval, valfritt en tabell per BAS-intervall) och ritas om med minsta gruppstorlek i
  avsnittet *Egna tabeller* i Word-utkastet och PDF-rapporten, i bladet *Egna tabeller* i Excel-filen och som block
  i rapportunderlaget. Tabellerna
  ordnas och tas bort under *Rapportens innehåll* och följer med i konfigurationsfilen; organisationspaketet kan
  bära dem och receptet per BAS, så att alla handläggare får samma tabeller. Avsnittet per BAS-intervall
  följer ett redigerbart recept: upprepa per BAS eller per sektor, rader, mått, åldersgränser och summeringstabeller.
- **Tabellerna per BAS-intervall, som i en skriven lönekartläggning.** Word-utkastet har ett nytt avsnitt,
  *Lönestruktur per BAS-intervall*, och Excel-filen ett nytt blad, *Per BAS*, byggda efter arbetsgivarnas egna
  utkast: en tabell per BAS-intervall (referensen, organisationen, varje yrkesgrupp med jämförelsestatistikens nivå
  under, kvinnor och män — P10, median, P90 och antal) med ett fält för bedömningen av intervallet, och sist två
  tabeller per BAS: löneskillnader inom likvärdigt arbete (medellön per kön, kvinnors medellön i procent av mäns,
  andel kvinnor, medelålder) och löneskillnader i åldersgrupper (–34, 35–49, 50–). Minsta gruppstorlek gäller:
  yrkesgrupper, intervall och åldersgrupper under gränsen får ingen rad, könsuppdelade mått bara där båda könen når
  den, och avsnittet säger vad det utelämnar. Beräkningen ligger i `src/lib/perbas.js`.

### Analys

- **Valbar förklaringsmodell (ADR-56).** Avsnittet *Vad blir kvar av lönegapet?* i Lika arbete öppnar med panelen
  *Förklaringsmodell*: ta bort BAS-intervall eller ålder, eller lägg till yrkesgrupp inom BAS; fullmodellen är
  utgångsläge och räknar som förut. Tabellen visar vad varje variabel tillför i förklaringsgrad och hur gapet
  flyttar sig, alltid mot fullmodellen, och verktyget föreslår att lämna en variabel utanför när den tillför under
  0,5 procentenheter. Valet styr huvudtalet överallt (Översikt, Att göra, Struktur, rapporten), trappan,
  förklaringsbudgeten och Blinder-Oaxaca; en bortvald variabel blir en mening, "har kontrollerats och tillför …", med
  ett skäl utanför siffrorna som ni kan skriva in, också i rapportens sammanfattning och bilaga. Valet och skälet
  följer med i konfigurationsfilen. Endast kön kan inte väljas när ett kön ligger under minsta gruppstorlek.
- **Kvinnodominerat enligt DO eller SCB.** I Likvärdigt arbetes inställningar väljs definitionen för tabellerna per
  AID-kod och BAS-intervall: DO, mer än kvinnotröskeln (standard), eller SCB, kvinnotröskeln eller mer. En grupp med
  exakt 60 % kvinnor är könsblandad enligt DO och kvinnodominerad enligt SCB. Valet står i bladen och i Metodik och
  följer med i konfigurationsfilen. Kandidatparen i Likvärdigt arbete använder tills vidare sin egen gräns
  (öppen punkt 22 i den tekniska planen).
- **Lönemånad.** Inställningar har fältet *Lönemånad* (fritext, t.ex. 2026-10) som skrivs ovanför tabellerna per
  AID-kod och BAS-intervall; tomt skrivs ut som *inte angiven*, eftersom lönefilen inte säger vilken månad den gäller.
  Följer med i konfigurationsfilen och nollas av Rensa all data.
- **Jämförelse mot båda referenserna (ADR-55).** Fliken Jämförelse visar per yrkesgrupp var löneläget och
  jämförelsestatistiken ligger mot ställningstagandet, som är referenspunkten: skillnaden percentil för percentil,
  läget i spannet, mönstret i ord, ett förslag på referens, en bild med de tre spannen och tabellen statistiken mot
  ställningstagandet. Vyn använder den referens som finns och säger vilken som saknas.
- **Jämförelse med förra året (ADR-54).** Konfigurationsfilen bär ett årsbokslut: nyckeltal, en rad per yrkesgrupp
  där båda könen når minsta gruppstorlek, och Att göra-punkternas läge — inga individer. Spara konfigurationen när
  årets kartläggning är klar och läs in den nästa år, så visar *Jämförelse med förra året* under *Spara och läsa in
  arbetet* nyckeltalen sida vid sida, vilka yrkesgrupper som är flaggade båda åren, nya och inte längre flaggade, och
  vilka av förra årets öppna punkter som är klara. Samma jämförelse står som avsnittet *Jämförelse med förra året*
  i Word-utkastet och PDF-rapporten (efter *Åtgärder och tidsplan*, bara när ett bokslut är inläst), som block i
  rapportunderlaget och som en hantel per yrkesgrupp: förra årets kvot som streck, årets som punkt, grön när den
  närmat sig lika lön och orange när den fjärmat sig.
- **All personal ingår, även BAS K och uppåt.** Begränsningen till BAS A–J är borttagen (ADR-21 upphävd):
  chefsnivåerna läses in och analyseras som alla andra intervall, i stället för att bara räknas. Rimlighetskontrollen
  kräver bara att BAS är en bokstav. Efter användartest: lönekartläggningen ska omfatta hela organisationen.
- **Regressionskortet förklarar sig:** ett avsnitt *Så fungerar regressionen — i tre steg* under inledningen säger
  i vardagsspråk vad modellen gör, vad den räknar bort och inte, och vilket tal i kortet som används till vad.
  Slutsatsen säger vad som blir kvar både med och utan yrkesgruppssteget (tidigare stod två olika "kvarstår" i
  samma block). Internt språk är borta ur kortet ("hero-rutan", "Realistiskt intervall", "Quantile regression",
  "Joint Pay Assessment", "p.e."). Blinder-Oaxaca-kortet säger att det räknar män mot kvinnor och hur talet
  förhåller sig till huvudtalet, och kallar inte längre den oförklarade delen diskrimineringsindikerande.
- **Ålder & karriär:** *Lönegap per åldersgrupp* står direkt under spridningsdiagrammet. Raden under nyckeltalen
  säger i klartext om lönen stiger lika mycket per levnadsår för båda könen och hur mycket åldersfördelningen
  förklarar, i stället för "lutningen skiljer sig med 6 %" och R². Nyckeltalet *Vid samma ålder* säger vad det
  räknar bort och inte. Livscykelavsnittet är lättare: R²-rutorna är borta (talen står i modelljämförelsen),
  tolkningen formulerar hypoteser att pröva i stället för orsaker, tabellens kolumner heter inte *Median* när de är
  modellvärden, och könsskillnaden i modelljämförelsen räknas åt samma håll som huvudmodellen. Hjälptexten *Så
  används fliken* är omskriven efter dagens namn på nyckeltal och paneler, och menyn har ett verktygstips för fliken.
- **Ordlistan** förklarar p-värdet rätt (hur ofta slumpen skulle ge en så stor skillnad om ingen fanns) och har en
  post *Sekventiell dekomponering* med alla stegen i stället för två som sade "tre steg".
- **Ålder & karriär ordnad efter tre frågor.** Överst: finns skillnaden kvar vid samma ålder (nyckeltal, spridning,
  gap per åldersgrupp). Fördjupningen börjar med *Växer gapet med åldern?* (livscykeln, öppen), därefter
  lönespridning över ålder, lönefördelning, åldersstruktur och jämförelsen av alla BAS-intervall. Det andra
  spridningsdiagrammet (*Lön mot ålder, närmare*) är borta; hela urvalets trendlinje är i stället ett valbart lager i
  det övre diagrammet, med samma tröskelregel som förut (visas bara när urvalet når minsta gruppstorlek).
  Nyckeltalet *Ålderskoncentration* ("18 år") heter *Mittersta hälften är* och visar spannet ("35–48 år"), och
  åldersstrukturens risktexter säger att de hör till personalplaneringen, inte till kartläggningen.
- **En bild av dekomponeringen.** Trappan i regressionskortet har fått yrkesgruppssteget, ljusare och efter
  huvudtalet, så att den visar samma sak som förklaringsbudgeten; steglistan med pilar finns kvar för skärmläsare
  och textkopior men visas inte. Den gula metodnoten om median mot geometriskt medelvärde står nu kort i *Så
  fungerar regressionen* (*Två råa gap*). Per-BAS-tabellens rad "För få" säger vad som krävs ("kräver minst 10 av
  varje kön").
- **Ett tecken i hela verktyget: kvinnor mot män, negativt när kvinnor ligger lägre.** Tre ställen räknade åt
  andra hållet och går nu ihop med huvudtalet i Lika arbete: livscykelmodellens skillnad vid 25 och 65 år
  (`gapPerAge` i `src/lib/livscykel.js` är nu log(kvinna) − log(man); nyckeltalen heter *Kvinnors lön mot mäns* och
  en negativ förändring betyder att kvinnorna halkar efter, i texterna, tabellen per BAS och åtgärdslistan),
  Blinder-Oaxaca-kortet (rågap, förklarat och oförklarat visas kvinnor mot män; metoden räknar internt män mot
  kvinnor och kortet säger det) och *Var uppstår löneskillnaden?* på Översikt och i rapportunderlaget
  (`src/lib/gapuppdelning.js` räknar kvinnor − män; negativa belopp betyder att kvinnornas medellön är lägre).
  Undantaget är EU-lönerapportens blad, som har direktivets tecken (art. 9) med tecknet utskrivet, som förut.
- **Blinder-Oaxaca med BAS som indikatorer (ADR-53).** Uppdelningen kodar BAS som en indikator per intervall, som
  huvudregressionen, i stället för som rang; kortets förklarade och oförklarade del vilar därmed på samma variabler
  som huvudtalet, och skillnaden mellan dem är bara att uppdelningen skattar kvinnors och mäns lönesättning var för
  sig. Referensintervallet är det alfabetiskt första som finns hos båda könen; ett intervall som bara finns hos ett
  kön hamnar i samspelet. Raden *BAS-intervall* i tabellen per variabel är summan över indikatorerna.
  Referensvärdena mot statsmodels är omräknade.
- **Täthetskurvorna per BAS är borta ur Ålder & karriär.** De handlade inte om ålder; lönespridningen per BAS och
  kön finns som lådor i Lika arbete, och utskriften använder nu den bilden (*Lönespridning per BAS-intervall och
  kön*). Avsnittet *Jämför alla BAS-intervall* har kvar lön mot ålder i varje intervall.
- **Tre småsaker i texterna.** Kronexemplet i regressionskortet säger också hur stor summan är som andel av
  kvinnornas samlade årslön. Blinder-Oaxaca-kortets förklarade och oförklarade del står i procentenheter av
  rågapet ("10,7 procentenheter") i stället för som negativa procenttal. Inledningen till *Var uppstår
  löneskillnaden?* är en mening utan parentes.
- **Livscykelavsnittet utan dubbletter.** Inledningens tre punkter om växande, krympande och konstant gap är
  borta (tolkningen under kurvan säger det som gäller), liksom metodraden med N och R². Modelljämförelsen har fyra
  rader färre: antal parametrar, R² och ojusterat R² är borta, kvar är antal personer, förklarad del av
  lönespridningen, löneskillnaden och p-värdena.
- **Livscykelns tabell per BAS-intervall** räknar nivåerna ur modellens egna BAS-koefficienter
  (exp(β_BAS − β_visat), ny `basFaktor` i `src/lib/livscykel.js`) i stället för att skala kurvan med kvoten mellan
  intervallens medianlöner; bevisrutan visar faktorn.

### Dataskydd

- **Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen (ADR-51).** Vyerna visar alla grupper och alla
  könsuppdelade mått oavsett storlek; allt som lämnar verktyget — Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder,
  rapportunderlaget, gruppdossierns textkopia och allt under Dokumentera & exportera — ritas och räknas i ett
  exportläge med den inställda tröskeln, som förut. Inställningen, stämpeln och metodbilagan är oförändrade; Utforskas
  ruta gäller fortfarande exporten. Efter användartest: den som arbetar i verktyget har redan lönefilen.

### Prestanda

- **Kvantilregressionens konfidensintervall räknas i bakgrunden.** Intervallet (200 omsamplingar × tre
  kvantiler, ett par sekunder vid tusen personer) höll Lika arbete-fliken tills det var klart; nu ritas kortet
  med punktskattningarna och intervallet fylls i strax efteråt, som bootstrap-KI:t vid inläsning. En bild eller
  utskrift som görs innan det är klart bär kortet utan intervall. Testsviten, som ritar fliken i hundratals
  färska fönster, går omkring en tiondel snabbare (170 → 154 s på sexton trådar).
- **Dokumentera & exportera ritas snabbare på stora underlag.** Förhandsbeskedet byggde rapportmodellen tre gånger
  och Excel-bladlistan två; nu en gång var (`rapportModellBada`). Efter en export ritas bara det tillbaka som
  exporten ritade i exportläget, och Lika arbetes minne har ett rum per tröskel, så att ett lägesbyte inte räknar
  om något. På 55 000 rader gick fliken från 12 s till omkring 3 s. Ett byte av minsta gruppstorlek ritar inte
  Översikt två gånger, bygger Att göras lista en gång för Att göra och processöversikten, och räknar om
  bootstrap-KI och styrkan bara när det statistiska golvet ändras — och då i bakgrunden efter omritningen, som vid
  inläsning. Att göra kör regressionen en gång i stället för
  fyra och skickar resultatet vidare till underlagsbedömningen (ingen cache, ADR-17 står kvar).

### Utveckling

- **Testsviten hittar inte andra sessioners arbetskopior.** Vitest utesluter nu `.claude/`, där verktyget lägger
  arbetskopior av hela repot; annars kördes deras testfiler också och sviten blev tre gånger så lång.
- **Dokumenten är allmänna.** README och den tekniska planens §2 säger vilket omfång verktyget har i dag (AID,
  BAS och SKR:s statistik; allt organisationsspecifikt kommer ur paketet). Intern beslutsjargong ("beslut av
  produktägaren") är ersatt av beslut med datum och ADR; checklistan för skarp data, datauttagsguiden,
  lagrumshänvisningarna och planens öppna punkter förutsätter ingen viss pilot, jurist eller
  dataskyddsombud; organisationsfilens designdokument är en formatspecifikation, och dess beslutshistorik
  ligger utanför repot.
- **Läsande tester delar fönster:** `delatFonster()` i testriggen, med en vakt som fäller det test som lämnar fönstret
  ändrat. Tre filer delar (20–25 % snabbare var för sig), elva prövades utan tillräcklig vinst och lämnades; hela
  sviten gick från 176 och 164 s till 168 och 142 s körda växelvis (teknisk plan §6).
- **Riktig Node-typning:** `@types/node` som utvecklingsberoende i stället för den egna minimala typfilen; ett
  typfel i byggskriptet som typfilen dolde är rättat.
- **Stilmallens svans:** 26 klasser utan användning är borttagna och fem komponentklasser med samma deklaration som
  en hjälpklass är utbytta; beräknade stilar jämfördes före och efter i Chromium utan skillnad.
- **Testwrappern räknar rätt vid omkörning:** när en arbetare kraschar efter att filen rapporterat klart och filen
  körs om, dubblas inte dess tester i kontrollen mot teknisk plan (`tools/test.mjs` prövar båda summorna).
- **Testriggen schemalägger inget under nedmonteringen** av ett fönster (`requestAnimationFrame` och `setTimeout`
  stubbas före stängning), så att en uppskjuten omritning inte skriver "d3 is not defined" i CI-loggen.

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
