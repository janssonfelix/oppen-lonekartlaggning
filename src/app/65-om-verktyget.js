// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Om verktyget-flik: render-funktion ----
// APP_VERSION och APP_BUILD_DATE kommer från src/app/08-version.js, som
// genereras ur VERSION-filen (tools/gen-version.mjs). Hårdkoda dem inte här.

const INFO_SECTIONS = {
    overview: () => `
        <h3>Vad är detta verktyg?</h3>
        <p class="om-ansvar"><strong>Ansvar.</strong> ${ANSVARSFORBEHALL}</p>
        <p>
            Öppen lönekartläggning är ett fritt verktyg för den årliga <strong>lönekartläggningen enligt diskrimineringslagen</strong> (3 kap., aktiva åtgärder om lönefrågor). Det tar emot en lönefil, räknar fram löneskillnaderna mellan kvinnor och män för lika och likvärdigt arbete, visar vad som bör prioriteras och vad det kostar, och skriver ett utkast till dokumentationen. Bedömningen av sakliga skäl och den slutliga dokumentationen gör arbetsgivaren i samverkan med facklig part.
        </p>
        <p>
            Verktyget är byggt för arbetsgivare som kodar sina befattningar med <strong>AID</strong> och <strong>BAS-intervall</strong> och kan jämföra sig med SKR:s personalstatistik, i praktiken kommuner och regioner. Varje organisation läser in sitt eget ställningstagande, sin statistik och sina benämningar i ett organisationspaket, så att ingenting om en viss organisation är inbyggt.
        </p>
        <p>
            Verktyget stödjer också delar av <strong>EU:s lönetransparensdirektiv 2023/970</strong>: rapportmåtten i Lönestruktur, gränsen 5 procent i direktivets regler om gemensam lönebedömning och protokollet för gemensam lönebedömning. Direktivet skulle vara infört senast den 7 juni 2026 men är ännu inte infört i Sverige; vissa delar kan ha direkt verkan mot kommuner och regioner. Den anställdes rätt till information och den rapportering som direktivet beskriver ligger utanför verktyget.
        </p>
        <p>
            Hela verktyget är <strong>en enda fil som körs i webbläsaren på din dator</strong>. Ingen data lämnar datorn: inga servrar, inga molntjänster, inga nätverksanrop. Det är inte bara ett löfte utan en spärr i filen själv, som hindrar webbläsaren från att skicka något ut.
        </p>

        <h3>För vem är det avsett?</h3>
        <ul>
            <li><strong>HR</strong>, som genomför kartläggningen och skriver dokumentationen</li>
            <li><strong>Ledningen</strong>, som beslutar om åtgärder och budget utifrån prioriteringen</li>
            <li><strong>Fackliga företrädare</strong>, i samverkan och vid en gemensam lönebedömning</li>
            <li><strong>Dataskyddsombud</strong>, som bedömer hur uppgifterna behandlas</li>
        </ul>

        <h3>Vad verktyget gör, och vad du gör själv</h3>
        <p><strong>Verktyget gör:</strong></p>
        <ul>
            <li>Räknar fram löneskillnaden mellan kvinnor och män i samma yrkesgrupp och mellan kvinnodominerade yrken och jämförelseyrken i samma BAS-intervall, och visar hur mycket som finns kvar när ålder och BAS-intervall räknats bort</li>
            <li>Jämför löneläget mot organisationens lönepolitiska ställningstagande och mot jämförelsestatistiken</li>
            <li>Ordnar yrkesgrupperna efter var en åtgärd gör störst nytta och räknar vad det kostar; låter dig pröva hur en lönepott kan fördelas</li>
            <li>Ger en checklista för att granska regler och praxis, där du skriver in bedömningen och resonemanget</li>
            <li>Låter dig dokumentera sakliga skäl per grupp i Handlingsplan, med kategori och belopp, räknar ihop hur stor del av löneskillnaden de förklarar och tar med skälen i rapporten, i Excel och i årsbokslutet</li>
            <li>Skriver ett redigerbart Word-utkast av dokumentationen med verktygets fynd ifyllda och dina bedömningar markerade som fält att fylla i, samt Excel, PDF, protokoll för gemensam lönebedömning och underlag till handlingsplanen</li>
            <li>Skyddar små grupper: lönemått för grupper under minsta gruppstorlek lämnar aldrig verktyget</li>
        </ul>
        <p><strong>Du gör själv:</strong></p>
        <ul>
            <li>Bedömer om en skillnad har sakliga skäl. Verktyget visar var skillnaderna finns och hur stora de är, men en oförklarad skillnad är inte detsamma som en osaklig</li>
            <li>Färdigställer dokumentationen i Word-utkastet och beslutar om åtgärderna i handlingsplanen</li>
            <li>Samverkar med facket och lämnar den information som lagen kräver</li>
            <li>Ansvarar för arbetsvärderingen: BAS-intervallen, eller organisationens egna poäng, är verktygets mått på arbetets krav</li>
        </ul>
        <p>Verktyget använder ingen artificiell intelligens. All statistik är klassiska metoder med formler som går att följa, och varje tal går att spåra med knappen <em>Visa beräkningen</em>. Ingenting sparas mellan sessioner: stäng fliken och allt är borta.</p>

        <h3>Så går en kartläggning till</h3>
        <ol>
            <li>Läs in <strong>organisationspaketet</strong> i <strong>Filer och kvalitet</strong>, om organisationen har ett, och sedan <strong>lönefilen</strong> (BAS-intervall, AID, lön, ålder och kön; ansvarskod och arbetsvärderingspoäng är valfria)</li>
            <li>Titta på <strong>Underlagets kvalitet</strong> i samma flik och på <strong>Att göra</strong> på Översikt: går underlaget att lita på, och var ska du börja?</li>
            <li>Gå igenom <strong>Regler &amp; praxis</strong> och skriv in bedömningen per område</li>
            <li>Gå igenom <strong>Lika arbete</strong>, <strong>Likvärdigt arbete</strong> och <strong>Lönestruktur</strong> under Kartläggning: där står skillnaderna och vad som förklarar dem. <strong>Löneläget</strong> och <strong>Ålder &amp; karriär</strong> är fördjupning, inget lagkrav</li>
            <li>Bestäm i <strong>Prioritering</strong> och <strong>Handlingsplan</strong> vad som ska göras, av vem och när; pröva fördelningen av potten i <strong>Löneöversyn</strong></li>
            <li>Ta texten till rapporten ur <strong>Rapporttext</strong>, kör färdigchecken i <strong>Exportera</strong>, hämta Word-utkastet och färdigställ dokumentationen. Spara konfigurationen i <strong>Spara och jämför år</strong>, så kan du jämföra med förra året nästa gång</li>
        </ol>
        <p>Vill du prova först? Det finns två demon i <strong>Kom igång</strong> på Översikt och i lönefilskortet i Filer och kvalitet. Demot <em>litet</em> har 260 påhittade personer, och demot <em>stort</em> har 7 000 påhittade personer i BAS A–K. Allt i demona är påhittat och märks som demodata.</p>
        <p>Raden <em>Klar här? Nästa steg</em> sist i flikarna leder vidare i den här ordningen. Sökrutan i sidhuvudet hittar yrken, BAS-intervall och funktioner, och listan <em>På den här sidan</em> leder till flikens avsnitt. Körguiden som följer med verktyget beskriver varje steg närmare. Den står under Källor.</p>
    `,

    gdpr: () => `
        <h3>Inbyggt dataskydd enligt dataskyddsförordningen</h3>
        <p>Verktyget är utformat så att dataskydd är en arkitekturell egenskap, inte en process. Tre lager skyddar personuppgifter:</p>

        <h4>Lager 1 — Filen läses in en rad i taget</h4>
        <p>Filen läses in i webbläsarens minne och avkodas. Under inläsningen finns alltså hela filens text där. Sedan läses en CSV-fil rad för rad (med biblioteket PapaParse, <code>step:</code>). De 50 första raderna hålls kvar för kontrollen mot personnummer, namn och e-post. Därefter minimeras varje rad direkt: bara fälten som analysen behöver behålls, och den råa raden släpps. Excel-filer (.xlsx) läses som ett helt blad och kontrolleras och minimeras på samma sätt. När inläsningen är klar finns bara de minimerade posterna kvar.</p>

        <h4>Lager 2 — Bara det analysen behöver släpps in</h4>
        <ul>
            <li><code>detectSensitiveColumns()</code> avvisar lönefiler med personnummer, namn eller e-post: kolumnrubrikerna prövas, och värdena i filens 50 första rader. Rubriker som antyder en särskild kategori av personuppgifter (fackmedlemskap, hälsa med mera) avvisas också. Från filerna med lönepolitik och jämförelsestatistik läses bara godkända kolumner med gruppvärden in.</li>
            <li><code>extractMinimalRecord()</code> accepterar <strong>endast 5 fält</strong>: BAS, yrke, lön, ålder, kön — plus valfri arbetsvärderingspoäng per befattning och valfri ansvarskod enligt AID. Radens nummer i filen sparas också.</li>
            <li><code>_cleanYrkeField()</code> trunkerar yrkesfält till AID-kod + 40-tecken etikett, maskerar namn-mönster</li>
        </ul>

        <h4>Lager 3 — Allt ligger i arbetsminnet</h4>
        <p>Endast minimerade poster lagras i <code>state.data</code>. Inget skrivs till disk: varken verktygets kod eller de inbyggda biblioteken skriver till webbläsarens lagring. En spärr i koden avbryter dessutom anrop till lagringens skrivfunktion och cookies — den är en reserv mot misstag och inte heltäckande (se <code>riskanalys.md</code>). Skrivningar i verktygets kod:</p>
        <table>
            <tr><th>API</th><th>Skrivningar i applikationskod</th></tr>
            <tr><td><code>localStorage</code></td><td>0</td></tr>
            <tr><td><code>sessionStorage</code></td><td>0</td></tr>
            <tr><td><code>IndexedDB</code></td><td>0</td></tr>
            <tr><td><code>document.cookie</code></td><td>0</td></tr>
            <tr><td>Cache API</td><td>0</td></tr>
            <tr><td>Service Worker</td><td>0</td></tr>
        </table>

        <h3>Radering och insyn</h3>
        <ul>
            <li><strong>Rensa all data:</strong> knappen under Inställningar tömmer minnet omedelbart utan att vänta på att fliken stängs: lagringsminimering och dataskydd som standard. De registrerades rätt till radering utövas mot källsystemet, inte i verktyget.</li>
            <li><strong>Vad lagras?</strong> — panelen visar live schema, antal rader, ungefärlig minnesfootprint och en maskerad exempel-post.</li>
            <li><strong>Lagringsminimering:</strong> Datan försvinner automatiskt när webbläsarfliken stängs. Ingen retention-policy behövs.</li>
        </ul>

        <h3>Kryptering av lagrade uppgifter: inte tillämpligt, inget lagras</h3>
        <p>
            Verktyget krypterar inte data i vila. Detta är ett medvetet arkitekturval. Den motsvarande kontrollen är <strong>RAM-only architecture med automatisk radering</strong>. Eftersom datan aldrig skrivs till disk finns ingen "rest" att kryptera. Detta är en starkare position än krypterad lagring eftersom det inte finns någon nyckel att läcka och ingen tidslucka mellan användning och radering.
        </p>

        <h3>k-anonymitet</h3>
        <p><strong>På skärmen visas allt.</strong> Den som arbetar i verktyget har redan lönefilen, så vyerna maskerar inga grupper: varje yrkesgrupp, varje BAS-intervall och varje könsuppdelat mått visas oavsett storlek (beslut 2026-10-29).</p>
        <p><strong>Det som lämnar verktyget följer minsta gruppstorlek.</strong> Tröskeln gäller:</p>
        <ul>
            <li>Excel, Word-utkastet, PDF-rapporten och ZIP-filen</li>
            <li>CSV, urklipp och diagrambilder</li>
            <li>rapportunderlaget och allt i Rapporttext, Exportera och Spara och jämför år</li>
        </ul>
        <p>Där redovisas inte grupper med färre än ${kInstalld()} personer. De räknas i stället upp med namn i en not, så att det syns vad som saknas. Personerna ingår ändå i underlaget och i totalsummorna. Gällande värde är ${kInstalld()} och standardvärdet är ${K_STANDARD}. Du ändrar det under Inställningar i sidhuvudet (&quot;Minsta gruppstorlek för redovisning&quot;).</p>
        <p>Ibland är bara <em>könsuppdelningen</em> för liten, medan gruppen som helhet når tröskeln. Då redovisar exporterna gruppens <strong>samlade median</strong> i stället, utan könsjämförelse. Samma regel gäller könsuppdelade mått för hela organisationen: varje kön ska nå tröskeln.</p>
        <p><strong>Undantag och särskilda fall:</strong></p>
        <ul>
            <li><strong>Löneöversyn.</strong> Du får lägga en egen riktad rad på en grupp under ${kInstalld()} personer. Beloppet visas på raden och ingår i summorna, även i Excel-exporten. Raden bygger då på enskildas löner, och det står på raden.</li>
            <li><strong>Tabeller och egna vyer.</strong> Exporten av tabellen och diagrammen utelämnar grupper under ${kInstalld()} personer. Vill du ta med dem kryssar du i rutan <em>Ta med grupper under ${kInstalld()} i exporten</em>. Organisationspaketet kan stänga av rutan.</li>
            <li><strong>Likvärdigt arbete.</strong> Lagen kräver att även små kvinnodominerade yrken prövas. Fliken och dess egen export visar därför kandidatpar även när en grupp är under tröskeln, och exporten anger det i filen. Alla andra utdata tar bara med par där båda grupperna når tröskeln, och anger hur många par som utelämnats. Det gäller Rapportunderlaget, Word-utkastet, PDF-rapporten, protokollet för gemensam lönebedömning, Att göra och dess CSV, handlingsplanens förifyllda rader och gruppdossiern.</li>
            <li><strong>Enskilda personer i verktyget.</strong> Personer att granska (Lika arbete) och extremvärdena i Underlagets kvalitet visar enskilda löner med filens radnummer. Personer att granska kan inte exporteras eller skrivas ut.</li>
            <li><strong>Diagramdata.</strong> Alla diagram kan exporteras som bild eller som diagramdata (CSV eller urklipp). Vissa diagram visar enskilda personer, till exempel lön mot ålder och individpunkter. Då har diagramdatan en rad per person, utan namn eller identifierare. Hantera sådana filer som personuppgifter. PDF-rapportens mall <em>Komplett rapport</em> och ZIP-exporten innehåller bilder av sådana diagram. I CSV och urklipp får celler som börjar med = + - @ ett inledande apostrof-tecken, så att Excel inte kör dem som formler.</li>
        </ul>

        <h3>Skydd i flera lager</h3>
        <ul>
            <li><strong>Content Security Policy:</strong> <code>connect-src 'none'</code> blockerar all utgående trafik på webbläsarnivå. Även om en bug skulle försöka göra <code>fetch()</code>, blockeras det.</li>
            <li><strong>Inga tredjeparts-CDN:</strong> Alla bibliotek (PapaParse, SheetJS, D3, JSZip) inlinade i HTML-filen.</li>
            <li><strong><code>autocomplete="off"</code></strong> på alla fält — sidans fasta fält, bland dem namnfälten, och de som skapas medan du arbetar (t.ex. anteckningarna i Regler &amp; praxis) — så att organisationsnamn, anteckningar etc. inte sparas i webbläsarens autofyll-historik.</li>
            <li><strong>Inga <code>console.log</code></strong> — verifierat 0 träffar i applikationskod.</li>
            <li><strong>Inga hardcoded secrets</strong> — verifierat 0 träffar.</li>
        </ul>

        <blockquote>
            För fullständig analys, se <code>riskanalys.md</code>; en kort beskrivning finns i <code>dataskydd.md</code>.
        </blockquote>
    `,

    metodik: () => `
        <h3>Multivariat regression (kärnmodellen)</h3>
        <p>Modell: <code>log(lön) ~ kön + ålder (centrerad) + BAS-intervall (indikatorvariabler)</code> — i linje med Medlingsinstitutets standardvägning. Går modellen inte att skatta faller verktyget tillbaka på kön + ålder.</p>
        <ul>
            <li><strong>OLS-estimering</strong> (vanliga minsta kvadrater) med <strong>HC3-robusta standardfel</strong> (Long & Ervin 2000). Robusta standardfel håller även när spridningen skiljer sig mellan grupper, och HC3 rekommenderas som standard för små och medelstora urval</li>
            <li><strong>Sekventiell dekomponering</strong> (stegvis uppdelning): tre steg visar hur stor del av den råa löneskillnaden som förklaras av strukturella variabler. Stegen är Endast kön, sedan +BAS och sedan +Ålder. Därefter kommer ett steg +Yrkesgrupp: löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och ålder. Steget har fasta effekter för yrkesgrupp inom BAS (AID×BAS), alltså en egen lönenivå för varje grupp. Det skattas med inomtransformation: gruppmedelvärdet dras av från log-lön, kön och ålder, och sedan körs OLS utan intercept, alltså utan den gemensamma startnivå som regressionen annars skattar. Steget visas i kortet och förklaringsbudgeten men ingår inte i huvudtalet. Har lönefilen ansvarskod tillkommer ett steg +Ansvar</li>
            <li><strong>Förklaringsmodellen kan väljas (ADR-56):</strong> i panelen <em>Förklaringsmodell</em> i Lönestruktur kan du ta bort BAS-intervall eller ålder, eller lägga till yrkesgrupp inom BAS. Fullmodellen är utgångsläge. Tabellen i panelen visar vad varje variabel tillför i förklaringsgrad (R²) när den läggs till sist i fullmodellen. Den visar också skillnaden utan och med variabeln. Tillför variabeln under 0,5 procentenheter föreslår verktyget att den lämnas utanför. Det är ett pedagogiskt råd, inte ett statistiskt test. Valet styr huvudtalet överallt, trappan, förklaringsbudgeten och Blinder-Oaxaca. En bortvald variabel redovisas som kontrollerad, med ett eventuellt skäl, i panelen och i rapporten. Valet följer med i konfigurationsfilen</li>
            <li><strong>BAS som indikatorvariabler:</strong> varje BAS-intervall får en egen indikator, en variabel som är 1 eller 0. Det alfabetiskt första intervallet är referens. Varje intervall får då sin egen lönenivå, utan antagandet att varje bokstavssteg är värt lika mycket. Bokstavsordningen (A lägst) är fast och kan inte ändras</li>
            <li>Konvertering till kr-procent: <code>gapPct = (exp(β) − 1) · 100</code></li>
            <li><strong>Konfidensintervall:</strong> 95 % KI = β ± t<sub>0,975; n−k</sub> × SE. Vid färre än 100 frihetsgrader (antal observationer minus antal skattade parametrar) används t-fördelningens kvantil, därefter 1,96. Det gäller huvudregressionen, regressionerna per BAS-intervall och livscykelmodellen</li>
        </ul>

        <h3>Ålder &amp; karriär och livscykelmodellen: ett tvärsnitt, inte en karriär</h3>
        <p>Lön mot ålder i Ålder &amp; karriär och livscykelmodellens kurvor bygger på ett tvärsnitt av lönerna vid kartläggningens tidpunkt. De visar skillnader mellan åldersgrupper i dag, inte hur en persons lön utvecklas över karriären. Åldersgrupperna skiljer sig också i utbildning, yrkesval och anställningstid (kohorteffekter, alltså skillnader mellan generationer). En skillnad mellan 30- och 60-åringar är därför inte en förväntad löneutveckling. Hur lönen faktiskt utvecklas kräver flera års kartläggningar av samma personer.</p>

        <h3>Kvantilregression (glastak och klibbigt golv)</h3>
        <p>Kvantilregressionen visar hur löneskillnaden ser ut i olika delar av lönefördelningen: glastak i höga deciler, klibbigt golv i låga. Den skattas vid τ ∈ {0,10; 0,50; 0,90}, alltså vid 10:e, 50:e och 90:e percentilen, med samma variabler som huvudregressionen enligt den valda förklaringsmodellen (kön, ålder och BAS-intervall som indikatorer) men utan yrkesgrupp inom BAS. Verktyget använder IRLS (Iteratively Reweighted Least Squares, omviktade minsta kvadrater). IRLS är en <em>approximation</em> av kvantillösningen. Den minimerar inte check-förlusten (kvantilregressionens felmått) exakt, som linjärprogrammering gör, utan närmar sig den stegvis. I verktygets referenstest avviker könskoefficienten några tiondels procentenheter från den exakta lösningen. Könskoefficienten vid varje τ visas med ett 95 % percentil-bootstrap-konfidensintervall. Bootstrap betyder att raderna dras om slumpvis och att måttet räknas om varje gång, här 200 gånger. Dragningen utgår från ett startvärde ur datat, så intervallet blir detsamma varje gång. Samma bootstrap ger ett intervall för skillnaden mellan P90 och P10. Verktyget säger att glastaket eller det klibbiga golvet väger tyngre bara när det intervallet utesluter noll; annars står det att det inte finns någon säkerställd skillnad mellan delarna av lönefördelningen. Vid fler än 2 000 personer räknas inget intervall, eftersom det tar för lång tid, och det står i tabellen.</p>

        <h3>Bootstrap-konfidensintervall</h3>
        <p>B = 2000 percentil-bootstrap på mediankvoten kvinnor/män. 95 % KI visas direkt vid den råa löneskillnaden, så att du ser osäkerheten och inte bara ett punktvärde. (Efron & Tibshirani 1993)</p>

        <h3>Statistisk styrka</h3>
        <p>Minsta detekterbara effekt (MDE) är den minsta löneskillnad som analysen med rimlig säkerhet kan upptäcka. Den räknas vid 80 % statistisk styrka och α = 0,05, tvåsidigt, alltså en risk på 5 procent att en skillnad som bara är slump räknas som verklig. α är risken att se en skillnad som bara beror på slumpen, här 5 %:</p>
        <p class="kursiv pad-8 ta-mitt"><code>MDE = (exp(2,802 × SE) − 1) × 100 %</code></p>
        <p>där SE är könskoefficientens robusta standardfel i huvudregressionen (log-skala). MDE räknas om varje gång du läser in en lönefil. Kriteriet <em>Statistisk styrka</em> i Underlagets kvalitet (Filer och kvalitet) är OK upp till 2 %, varning upp till 5 % och kritiskt däröver. Kritiskt betyder låg styrka: dra inga säkra slutsatser om enskilda mindre grupper.</p>
        <p>Prioriteringens detektionströskel och varningarna per grupp använder en enklare uppskattning utan regression: <code>MDE = (exp(2,802 × σ_log × √(1/n_kv + 1/n_ma)) − 1) × 100 %</code>. Där är n_kv och n_ma antalet kvinnor och män i gruppen, och σ_log är spridningen i log(lön) <em>inom</em> grupp. Spridningen är den poolade standardavvikelsen av residualerna log(lön) − log(gruppens median per kön), alltså hur långt varje lön ligger från medianen för sitt kön i gruppen. Den räknas över alla yrkesgrupper inom BAS med minst ${statGolv()} av varje kön. Det är samma spridningsmått som trattdiagrammet i Lika arbete använder. Spridningen över hela urvalet rymmer skillnaderna mellan BAS-intervallen och skulle överskatta spridningen inom en grupp. Den används bara som reserv, när ingen grupp når golvet eller residualerna är färre än 20. En grupp märks under 3 % som god styrka, under 7 % som måttlig och däröver som låg.</p>

        <h3>Andra metoder</h3>
        <ul>
            <li><strong>Underlagets kvalitet:</strong> fem kriterier — jämförbarhet, statistisk styrka, fullständighet, rimlighet och modell — som var och ett får OK, Varning eller Kritisk. Underlaget får samma status som det svagaste kriteriet.</li>
            <li><strong>Extremvärden:</strong> Z-score per BAS-intervall på log-lön, alltså hur många standardavvikelser lönen ligger från medelvärdet. Löner med |Z| ≥ 3 flaggas för manuell granskning. De visas med lön och filens radnummer, bara i verktyget</li>
            <li><strong>Löneöversyn (prognos):</strong> budgeten först. Du lägger in en pott (kr eller %) och fördelar den generellt och riktat per BAS och AID. En rad kan begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå. Du ser de nya lönerna, hur mycket av budgeten som används och löneskillnaden före och efter. Verktyget föreslår också hur potten kan riktas mot skillnaderna i likvärdigt arbete. Kostnaden räknas med PO-påslag och beräkningsperiod från Inställningar</li>
            <li><strong>Oförklarad skillnad per BAS-intervall:</strong> separat regression inom varje BAS-intervall, som visar var i organisationen den oförklarade skillnaden finns</li>
            <li><strong>Förslag på förklaringar att pröva:</strong> åtta fasta regler, utan artificiell intelligens. De ger förklaringar att pröva för varje rad i Prioritering, till exempel åldersskillnad, glastaksmönster, bristyrke och MDE-tröskeln.</li>
        </ul>

        <section id="om-aid">
        <h3>AID och sektorer</h3>
        <p>${esc(AID_METODTEXT)}</p>
        <p>Verktyget känner till AID:s 13 huvudområden — till exempel vård och omsorg, skola och förskola
        och teknik — och använder dem som <strong>sektorer</strong> i sektorsöversikten i Lönestruktur
        och som gruppering i Tabeller och egna vyer. Koder som inte finns i etikettlistan ingår i analyserna men får ingen sektor.</p>
        <p>AID:s <strong>ansvarskod</strong> är valfri. Finns den i lönefilen grupperas den i tre ansvarsgrupper:
        <strong>Ledningsansvar</strong> (A, B, C, L), <strong>Särskilt uppdrag</strong> (F, M, 1001, 1002) och
        <strong>Inget särskilt ansvar</strong>. Ansvaret redovisas bredvid huvudresultaten, aldrig inbakat i dem —
        om det är ett sakligt skäl avgör du.</p>
        <p class="gd-note">Etikettlista: ${esc((() => { const i = _aidEtikettlistaInfo(); return `${i.kalla} (${i.antal} etiketter)`; })())}.</p>
        </section>

        <h3>Vad verktyget INTE gör</h3>
        <ul>
            <li>Använder inte AI/maskininlärning — all statistik är klassiska metoder med transparenta formler</li>
            <li>Föreslår inte sakliga skäl automatiskt — det är HR:s arbete och kräver mänsklig bedömning</li>
            <li>Justerar inte för förmåner, bonus eller tillägg, och förutsätter att lönen i filen är omräknad till heltid</li>
            <li>Avgör inte om en grupp är "likvärdig" — använder BAS-intervall, eller arbetsvärderingens poäng om de finns, som approximation; den slutliga kravvärderingen görs av arbetsgivaren</li>
        </ul>
    `,

    features: () => `
        <h3>Flikar i verktyget</h3>
        <table>
            <tr><th>Fas</th><th>Flik</th><th>Syfte</th></tr>
            <tr><td>1 · Underlag</td><td>Översikt</td><td>Nyckeltal, status mot lagkraven, Att göra (Börja här och alla punkter) och processkartan. Kräver ingen data.</td></tr>
            <tr><td>1 · Underlag</td><td>Filer och kvalitet</td><td>Filuppladdning: organisationspaket, lönefil, ställningstagande och jämförelsestatistik; underlagets kvalitet med extremvärden och inläsningsrapporten. Kräver ingen data.</td></tr>
            <tr><td>1 · Underlag</td><td>Regler &amp; praxis</td><td>Kvalitativ granskning av regler och praxis för löner och villkor: status och anteckning per område. Kräver ingen data; följer med i Word-utkastet.</td></tr>
            <tr><td>2 · Kartläggning</td><td>Löneläget</td><td>Fördjupning, inget lagkrav. Löneläget och jämförelsestatistiken mot ställningstagandet per yrkesgrupp, avsnittet mot ställningstagandet (bandkarta, könsposition i bandet, täckningsgrad) och avsnittet mot statistiken. Går att öppna när en referens är inläst.</td></tr>
            <tr><td>2 · Kartläggning</td><td>Lika arbete</td><td>Kvinnor och män i samma yrkesgrupp med trattdiagrammet, personer att granska, Lika arbete AID x BAS och analys på individnivå</td></tr>
            <tr><td>2 · Kartläggning</td><td>Likvärdigt arbete</td><td>Kvinnodominerade yrken mot likvärdiga icke-kvinnodominerade yrken, bootstrap-KI per par</td></tr>
            <tr><td>2 · Kartläggning</td><td>Lönestruktur</td><td>Organisationen som karta, representation per BAS-intervall, skillnaden i lönefördelningen, per sektor, Var uppstår löneskillnaden?, direktivets mått, löneskillnad och könsfördelning per BAS-intervall, och vad som blir kvar av löneskillnaden: förklaringsmodell, multivariat regression, vattenfallsdiagram och Blinder-Oaxaca</td></tr>
            <tr><td>2 · Kartläggning</td><td>Ålder &amp; karriär</td><td>Fördjupning, inget lagkrav. Lön mot ålder per kön, demografi (åldersfördelning, pensionsavgångar) och livscykel: växer eller krymper skillnaden över karriären</td></tr>
            <tr><td>3 · Åtgärder</td><td>Prioritering</td><td>Bubbeldiagram och sorterad lista med kostnad och förslag på möjliga förklaringar att pröva. Trösklarna och viktningen ställs in under Inställningar</td></tr>
            <tr><td>3 · Åtgärder</td><td>Löneöversyn</td><td>Pröva hur en lönepott kan fördelas och vad det gör med löneskillnaden</td></tr>
            <tr><td>3 · Åtgärder</td><td>Handlingsplan</td><td>Mall för åtgärder, kostnad, ansvarig och tidsplan (senast inom tre år) samt dokumentationskrav, sakliga skäl per grupp med kategori och belopp, och samverkan och uppföljning med protokollet för gemensam lönebedömning. Utskrivbar; kräver ingen data.</td></tr>
            <tr><td>4 · Rapport</td><td>Rapporttext</td><td>Utkastet till rapporttext, för hela organisationen och per BAS-intervall, och rapportunderlaget: färdiga avsnitt att kopiera in i organisationens rapportmall</td></tr>
            <tr><td>4 · Rapport</td><td>Exportera</td><td>Färdigcheck och robusthet, rapportens innehåll och all export (Word-utkast som .docx, PDF, Excel, ZIP, protokoll för gemensam lönebedömning, handlingsplan). Länkar till flikarna med egna underlag (kandidatparen, EU-rapportmåtten, åtgärdslistan, prognosen)</td></tr>
            <tr><td>4 · Rapport</td><td>Tabeller och egna vyer</td><td>Två avsnitt: Löneöversikten (hela löneläget per BAS, kön och yrkesgrupp) och Egna vyer: rader och kolumner, mått, helhet eller per kön, urval med villkor, tolv diagramtyper (de vanliga först, resten under Fler diagramtyper), klick till gruppdossier</td></tr>
            <tr><td>Arbetet</td><td>Spara och jämför år</td><td>Spara och ladda konfigurationen, jämför med en ögonblicksbild eller med förra året, och kör självdiagnostiken. Kräver ingen data.</td></tr>
            <tr><td>Hjälp</td><td>Om verktyget</td><td>Du är här</td></tr>
        </table>

        <h3>Genvägar och funktioner</h3>
        <ul>
            <li><strong>Spara/ladda konfiguration:</strong> JSON-export av prio-trösklar, vikter, kostnadsinställningar, bristyrkes-AID:n, löneöversynens inställningar och dina anteckningar i Regler & praxis. Innehåller inga individrader, men hantera den som övriga exportfiler.</li>
            <li><strong>Jämför scenarier (A/B):</strong> jämför två analyser (t.ex. före/efter filtrering, eller scenario A mot B)</li>
            <li><strong>Excel med alla flikar:</strong> alla resultat-tabeller i en xlsx</li>
            <li><strong>ZIP-export:</strong> alla diagram (PNG) + Excel i en zip</li>
            <li><strong>PDF-rapport:</strong> en låst kopia av Word-utkastet med samma urval av avsnitt (hela dokumentationen, ledningsbrief eller facklig dialog)</li>
            <li><strong>Organisationspaket:</strong> en fil med organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik läses in i Filer och kvalitet.</li>
            <li><strong>Förhandskontroll av lönefilen:</strong> direkt efter inläsningen visar Filer och kvalitet hur filen tolkades. Du ser de tio första raderna med filens värde och verktygets tolkning, till exempel födelseår som räknats om till ålder. Du ser också hur många rader som används och varför andra faller bort, och värdena per kolumn. Varningar visas när lönen ser ut som årslön eller timlön, när åldern ligger utanför 16–75 år eller när BAS eller kön har okända värden. Varningarna står också i Att göra. Med inställningen <em>Stoppa och visa förhandskontrollen innan inläsning</em> läses filen in först när du väljer <em>Läs in</em>. Raderna visas bara på skärmen.</li>
            <li><strong>Importprofiler:</strong> en kolumnmappning som du gör för hand sparas. Den känns igen nästa gång samma uttag läses in (<em>Känd uppsättning</em>). Profilen innehåller bara rubrikernas namn. Den följer med i konfigurationsfilen och kan läggas i organisationspaketet. Listan, <em>Ta bort</em> och <em>Exportera JSON</em> står i Inställningar.</li>
            <li><strong>Sök:</strong> fältet i sidhuvudet (snedstreck eller Ctrl+K) hittar yrken och BAS-intervall och markerar dem i alla diagram och tabeller. Det hittar också flikarnas avsnitt, exporterna och fälten i Inställningar, även utan lönefil. Ett avsnitt i en låst flik säger <em>kräver lönefil</em></li>
            <li><strong>Dossierer:</strong> gruppdossiern samlar en yrkesgrupp på en sida. BAS-dossiern samlar ett BAS-intervall i rapportens ordning: nyckeltal och läget mot ställningstagandet, yrkesgrupperna, likvärdigt arbete, ålder och förra året. Den kopieras som text utan lönemått för grupper under tröskeln. BAS-dossiern öppnas från Löneöversikten, Lönestrukturs tabell per BAS-intervall, gruppdossiern, markeringen och sökrutan</li>
            <li><strong>På den här sidan:</strong> flikens synliga avsnitt i en lista som följer med när sidan rullas; ett klick fäller ut avsnittet och flyttar fokus dit</li>
            <li><strong>Självdiagnostik:</strong> ladda 200 syntetiska poster med kända egenskaper och kör sju kontroller</li>
            <li><strong>Tangentbordsnavigation:</strong> Tab/Shift+Tab mellan kontroller, piltangenter och Home/End i menyn och i flikraderna, Esc stänger modaler och menyer</li>
        </ul>

        <h3>Tillgänglighet (WCAG 2.1 AA)</h3>
        <ul>
            <li>Skip-link, focus trap i modaler, aria-live-regioner för dynamiska statusmeddelanden</li>
            <li>Klickytor: knappar minst 32 px höga; informationsknapparna är 22×22 px</li>
            <li>Förstärkt kontrast (≥ 4.5:1 för text, ≥ 3:1 för UI-komponenter)</li>
            <li>Respekterar <code>prefers-reduced-motion</code> och <code>forced-colors</code></li>
            <li>Varje diagram har en textbeskrivning som skärmläsare läser upp</li>
            <li>Könen har plommon (kvinnor) och olivgrönt (män) i stället för rosa och blått: färgerna knyter inte an till stereotyper, går att skilja åt vid nedsatt färgseende och står alltid med ord i legenden</li>
        </ul>
    `,

    releases: () => {
        // Build-info kommer från VERSION via src/app/08-version.js; bundlern
        // stämplar samma version i HTML-kommentaren och i RELEASE.txt.
        const ver = APP_VERSION;
        const date = APP_BUILD_DATE;
        return `
        <h3>Aktuell version</h3>
        <div class="info-build-card">
Version:    ${ver}<br>
Build-datum: ${date}<br>
Output:     oppen-lonekartlaggning.html<br>
Storlek:    se RELEASE.txt (skrivs av bundlern vid varje bygge)<br>
SHA-256:    Se <code>RELEASE.txt</code> i utvecklingsmappen för verifiering
        </div>

        ${state.paketInbakat ? `<h3>Organisationsfil</h3>
        <p>Den här filen är en organisationsfil: organisationspaketet från <strong>${esc(state.paketInbakat.organisation)}</strong> är inbakat (skapad ${esc(state.paketInbakat.skapad || '–')}) och läses in vid varje start. Filen bygger på verktyget version ${esc(state.paketInbakat.verktygsversion || 'okänd')}${state.paketInbakat.verktygssha ? ` (verktygsfilens SHA-256: <code>${esc(state.paketInbakat.verktygssha)}</code>)` : ''}. Paketet går att granska och ladda ner under <em>Organisationspaket</em> i Filer och kvalitet. Ingen lönedata ingår i filen.</p>` : ''}
        <h3>Verifiera integriteten</h3>
        <p>Kontrollera att din kopia av <code>oppen-lonekartlaggning.html</code> matchar SHA-256-hashen i <code>RELEASE.txt</code>:</p>
        <h4>Windows (PowerShell):</h4>
        <p><code>(Get-FileHash -Algorithm SHA256 oppen-lonekartlaggning.html).Hash</code></p>
        <h4>Linux/macOS:</h4>
        <p><code>sha256sum oppen-lonekartlaggning.html</code></p>

        <h3>Bygg- och utvecklarverktyg</h3>
        <ul>
            <li><strong><code>npm run bundle</code></strong> — bygger single-file-HTML:en: inlinerar CSS/JS, minifierar, hårdar CSP med per-script-hashar och beräknar SHA-256</li>
            <li><strong><code>npm test</code></strong> — Vitest: de rena kärnorna i <code>src/lib/</code> (bl.a. statistik, prognos, struktur, likvärdigt arbete, egna vyer, urval), CSV-parsning, boot-/render-röktest i jsdom, a11y (axe-core), golden-lås på Excel-/Word-/PDF-utdata och drift-vakt mot <code>src/lib/</code></li>
            <li><strong><code>npm run test:browser</code></strong> — röktest av den byggda single-file-filen i riktig Chromium (Playwright): att biblioteken laddas under den hårdade CSP:n, att diagrammen faktiskt ritas, att modalen fungerar och att inget skrivs till localStorage</li>
            <li><strong><code>npm run lint</code></strong> — ESLint (flat config)</li>
        </ul>
        `;
    },

    references: () => `
        <h3>Lagstiftning och standarder</h3>
        <ul>
            <li><strong>Diskrimineringslagen</strong> (SFS 2008:567), 3 kap. — aktiva åtgärder om lönefrågor. De enskilda lagrummen står i <code>docs/utveckling/lagrum.md</code>.</li>
            <li><strong>EU lönetransparensdirektivet 2023/970</strong> — skulle vara infört i nationell rätt 7 juni 2026; svensk lag och ikraftträdande dateras när de är kända; lönerapporteringen införs stegvis för arbetsgivare med minst 100 anställda</li>
            <li><strong>Dataskyddsförordningen</strong> (EU 2016/679), särskilt art. 5.1 c och e (uppgifts- och lagringsminimering), 6.1 c (rättslig förpliktelse), 25 (inbyggt dataskydd) och 32 (säkerhet)</li>
            <li><strong>DOS-lagen</strong> (SFS 2018:1937) — tillämpar EU:s tillgänglighetsdirektiv 2016/2102</li>
            <li><strong>WCAG 2.1 nivå AA</strong> — W3C standard</li>
        </ul>

        <h3>Statistisk metodik (referenser)</h3>
        <ul>
            <li>Long, J. S., &amp; Ervin, L. H. (2000). <em>Using Heteroscedasticity Consistent Standard Errors in the Linear Regression Model.</em> The American Statistician, 54(3), 217–224. <small>(HC3-robusta standardfel)</small></li>
            <li>Koenker, R. (2005). <em>Quantile Regression.</em> Cambridge University Press. <small>(IRLS-implementation)</small></li>
            <li>Efron, B., &amp; Tibshirani, R. (1993). <em>An Introduction to the Bootstrap.</em> Chapman &amp; Hall. <small>(Percentil-bootstrap-CI)</small></li>
            <li>Cohen, J. (1988). <em>Statistical Power Analysis for the Behavioral Sciences</em> (2nd ed.). Routledge. <small>(MDE-formel)</small></li>
            <li>Medlingsinstitutet (årlig). <em>Vad säger den officiella lönestatistiken om löneskillnaden mellan kvinnor och män?</em></li>
        </ul>

        <h3>Externa datakällor</h3>
        <ul>
            <li><strong>SKR</strong> är Sveriges Kommuner och Regioner, arbetsgivarorganisationen för kommuner och regioner. Verktyget använder tre saker därifrån:</li>
            <li>AID — yrkesindelningen (Arbetsidentifikation kommuner och regioner), som yrkeskoderna i lönefilen följer</li>
            <li>${esc(_skrReferensInfo().kalla)} — andel kvinnor per AID-kod i kommuner och regioner. I verktyget kallad <em>Kvinnor nationellt</em>: ett referensvärde bredvid organisationens egen könsfördelning, och reserv i Likvärdigt arbete</li>
            <li>SKR:s cirkulär 2025 — PO-påslaget 39,15 % som standardvärde i kostnadsberäkningen (andra arbetsgivare sätter sitt eget)</li>
            <li>SCB, Arbetskraftsundersökningen (AKU) — åldersfördelningen som referens i Ålder &amp; karriär</li>
        </ul>

        <h3>Licens</h3>
        <p>Öppen lönekartläggning är öppen källkod under <strong>MIT-licensen</strong> — fritt att använda, ändra och sprida, också kommersiellt, så länge upphovsrätts- och licensnotisen följer med. Upphovsperson: Felix Jansson. Licenstexten finns sist under <em>Licenstexter</em> nedan.</p>

        <h3>Tredjepartsbibliotek</h3>
        <table>
            <tr><th>Bibliotek</th><th>Version</th><th>Licens</th><th>Användning</th></tr>
            <tr><td>PapaParse</td><td>5.7.0</td><td>MIT</td><td>CSV-parsning</td></tr>
            <tr><td>SheetJS Community (mini)</td><td>0.20.3</td><td>Apache 2.0</td><td>Excel read/write</td></tr>
            <tr><td>D3</td><td>7.9.0</td><td>ISC</td><td>Diagram</td></tr>
            <tr><td>JSZip</td><td>3.10.2</td><td>MIT</td><td>ZIP-export och Word-utkastet (.docx)</td></tr>
        </table>
        <p class="text-dampad-sm">Alla licenser är godkända för kommersiell användning. Inga royalties krävs.</p>
        <details class="bakgrund-panel"><summary>Licenstexter</summary><pre id="om-licenstexter" class="fs-xs max-hojd-420 rulla bevara-radbrytning"></pre></details>

        <h3>Övrig dokumentation</h3>
        <ul>
            <li><code>korguide.md</code> — steg för steg från datauttag till färdig dokumentation</li>
            <li><code>datauttag.md</code> — hur lönefilen tas ut ur lönesystemet, med lönedefinitionen</li>
            <li><code>riskanalys.md</code> — risk- och sårbarhetsanalys, underlag till organisationens konsekvensbedömning (DPIA)</li>
            <li><code>dataskydd.md</code> — kort dataskyddsbeskrivning för dataskyddsombud och IT</li>
            <li><code>RELEASE.txt</code> — version och kontrollsumma (SHA-256) för att kontrollera att filen är oförändrad</li>
        </ul>
    `
};

function renderInfoTab(section = 'overview') {
    const wrap = document.getElementById('info-tab-content');
    if (!wrap) return;
    const renderer = INFO_SECTIONS[section] || INFO_SECTIONS.overview;
    wrap.innerHTML = renderer();
    // Markera aktiv knapp
    document.querySelectorAll('.info-section-btn').forEach(btn => {
        const isActive = /** @type {HTMLElement} */ (btn).dataset.section === section;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // Licenstexterna ligger i den byggda filens mall med id licenstexter (tools/bundle.mjs).
    const lic = document.getElementById('om-licenstexter');
    if (lic) {
        const mall = document.getElementById('licenstexter');
        lic.textContent = mall ? /** @type {HTMLTemplateElement} */ (mall).content.textContent.trim()
            : 'Licenstexterna byggs in i den färdiga filen (src/licenser.txt).';
    }
    // Tillämpa profil-substitutioner i nyrenderat innehåll
    applyProfileLabels();
}

document.querySelectorAll('.info-section-btn').forEach(btn => {
    btn.addEventListener('click', () => renderInfoTab(/** @type {HTMLElement} */ (btn).dataset.section));
});
_wireTablistKeys(/** @type {HTMLElement[]} */ ([...document.querySelectorAll('.info-section-btn')]));
