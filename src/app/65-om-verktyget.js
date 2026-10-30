// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Om verktyget-flik: render-funktion ----
// APP_VERSION och APP_BUILD_DATE kommer från src/app/08-version.js, som
// genereras ur VERSION-filen (tools/gen-version.mjs). Hårdkoda dem inte här.

const INFO_SECTIONS = {
    overview: () => `
        <h3>Vad är detta verktyg?</h3>
        <p>
            Öppen lönekartläggning är ett <strong>klientsidigt analysverktyg</strong> som stödjer den årliga lönekartläggningen enligt <strong>diskrimineringslagen</strong> (3 kap., aktiva åtgärder om lönefrågor). Det hjälper HR identifiera vilka grupper som ska arbetas vidare med, men dokumentationen av sakliga skäl och produktion av lönekartläggningsrapporten görs separat i Word eller motsvarande dokumentmall hos arbetsgivaren.
        </p>
        <p>
            Verktyget stödjer också utvalda delar av <strong>EU:s lönetransparensdirektiv 2023/970</strong> — direktivet skulle vara infört senast den 7 juni 2026, men Sverige har inte infört det, och vissa delar kan ha direkt verkan mot kommuner och regioner (se SKR). Lönerapporteringen gäller stegvis arbetsgivare med 100 anställda eller fler. Verktyget stöder särskilt gemensam lönebedömning (Joint Pay Assessment). Anställds informationsrätt enligt Art. 7 hanteras i en separat process hos arbetsgivaren och ingår inte i verktyget. Den statliga rapporteringen enligt Art. 9.1+9.5 omfattas inte av detta verktyg och hanteras separat när Sverige transponerar direktivet.
        </p>
        <p>
            Verktyget är byggt som en single-file HTML-applikation som körs lokalt i webbläsaren. <strong>Ingen data lämnar enheten.</strong> Inga servrar, inga molntjänster, inga nätverksanrop. Detta är en arkitekturell garanti — inte ett löfte — eftersom Content Security Policy blockerar all utgående trafik på webbläsarnivå.
        </p>

        <h3>För vem är det avsett?</h3>
        <ul>
            <li><strong>HR-handläggare</strong> som behöver analys och datastrukturering inför den årliga lönekartläggningen</li>
            <li><strong>Ledningen</strong> som ska fatta åtgärdsbeslut baserat på prioritetsanalys</li>
            <li><strong>Fackliga representanter</strong> i samverkan kring gemensam lönebedömning (art. 10)</li>
            <li><strong>Dataskyddsombud</strong> som ska bedöma GDPR-efterlevnad</li>
        </ul>

        <h3>Vad verktyget gör — och inte gör</h3>
        <p><strong>Gör:</strong></p>
        <ul>
            <li>Identifierar och prioriterar yrkesgrupper/BAS-intervall där lönegap bör utredas</li>
            <li>Beräknar oförklarat gap via multivariat regression med statistisk osäkerhet</li>
            <li>Jämför mot lönepolitiskt ställningstagande och extern statistik</li>
            <li>Tar fram en protokollmall för gemensam lönebedömning (art. 10) i facklig samverkan</li>
        </ul>
        <p><strong>Gör inte:</strong></p>
        <ul>
            <li>Producerar inte den färdiga lönekartläggningsrapporten — det görs separat i Word/motsvarande utifrån arbetsgivarens egen mall. Verktyget hjälper till med <em>vilka grupper</em> som ska arbetas med, inte med <em>hur dokumentet skrivs</em>.</li>
            <li>Dokumenterar inte sakliga skäl per grupp internt — den bedömningen och dokumentationen görs i HR:s ordinarie verktyg.</li>
            <li>Hanterar inte könsneutrala lönestrukturer och lönekriterier (direktivets art. 4 och 6) — detta omfattas av BAS-värderingsarbetet och lönepolitiskt ställningstagande, vilka är input till verktyget snarare än output från det.</li>
            <li>Skickar inte rapporter till tillsynsmyndighet — du exporterar och lämnar in själv.</li>
            <li>Använder inte AI/LLM. All statistik är klassiska metoder med spårbara formler.</li>
            <li>Sparar inte data mellan sessioner. Stäng fliken och allt är borta.</li>
        </ul>

        <h3>Designprincip: stabil över tid</h3>
        <p>
            Verktyget är medvetet avgränsat till analys + datastrukturering. Rapportering och dokumentation görs i separat Word-mall hos arbetsgivaren. Detta för att verktyget ska kunna leverera värde över flera år utan att behöva uppdateras varje gång rapporteringsformat eller mallstrukturer ändras hos DO, Medlingsinstitutet eller EU.
        </p>

        <h3>Snabbstart</h3>
        <ol>
            <li>Ladda upp <code>struktur.csv</code> från ert lönesystem (kolumner: BAS-intervall, AID, lön, ålder, kön)</li>
            <li>Granska <strong>Underlagets kvalitet</strong> på Översikt (bl.a. statistisk styrka)</li>
            <li>Gå till <strong>Prioritering</strong> för att se vilka grupper som behöver utredas</li>
            <li>Använd <strong>Lika arbete</strong> för multivariat regression med BH-FDR-justerade p-värden</li>
            <li>Exportera underlag (Excel/PDF/ZIP) som bilagor till er egen lönekartläggningsrapport</li>
            <li>Dokumentera sakliga skäl och slutsatser i ert ordinarie HR-verktyg (Word eller motsvarande)</li>
        </ol>
    `,

    gdpr: () => `
        <h3>Inbyggt dataskydd (dataskyddsförordningen art. 25)</h3>
        <p>Verktyget är utformat så att dataskydd är en arkitekturell egenskap, inte en process. Tre lager skyddar personuppgifter:</p>

        <h4>Lager 1 — Untrusted ingress (CSV-rad i taget)</h4>
        <p>Filen läses in i webbläsarens minne och avkodas; under inläsningen finns alltså hela filens text där. CSV tolkas sedan med PapaParse rad för rad (<code>step:</code>): de 50 första raderna hålls kvar för kontrollen mot personnummer, namn och e-post, därefter minimeras varje rad direkt och den råa raden släpps. Excel-filer (.xlsx) läses som ett helt blad, kontrolleras och minimeras på samma sätt. När inläsningen är klar finns bara de minimerade posterna kvar.</p>

        <h4>Lager 2 — Sanitization gate</h4>
        <ul>
            <li><code>detectSensitiveColumns()</code> avvisar strukturfiler med personnummer, namn eller e-post: kolumnrubrikerna prövas, och värdena i filens 50 första rader. Från filerna med lönepolitik och jämförelsestatistik läses bara vitlistade aggregatkolumner in.</li>
            <li><code>extractMinimalRecord()</code> accepterar <strong>endast 5 fält</strong>: BAS, yrke, lön, ålder, kön — plus valfri arbetsvärderingspoäng per befattning och valfri ansvarskod enligt AID. Radens nummer i filen sparas också.</li>
            <li><code>_cleanYrkeField()</code> trunkerar yrkesfält till AID-kod + 40-tecken etikett, maskerar namn-mönster</li>
        </ul>

        <h4>Lager 3 — Application state (RAM-only)</h4>
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
            <li><strong>Rensa all data:</strong> knappen under Inställningar tömmer minnet omedelbart utan att vänta på att fliken stängs — lagringsminimering (art. 5.1 e) och dataskydd som standard (art. 25.2). De registrerades rätt till radering utövas mot källsystemet, inte i verktyget.</li>
            <li><strong>Vad lagras?</strong> — panelen visar live schema, antal rader, ungefärlig minnesfootprint och en maskerad exempel-post.</li>
            <li><strong>Lagringsminimering (art. 5.1 e):</strong> Datan försvinner automatiskt när webbläsarfliken stängs. Ingen retention-policy behövs.</li>
        </ul>

        <h3>Encryption at rest — inte tillämpligt by design</h3>
        <p>
            Verktyget krypterar inte data i vila. Detta är ett medvetet arkitekturval. Den motsvarande kontrollen är <strong>RAM-only architecture med automatisk radering</strong>. Eftersom datan aldrig skrivs till disk finns ingen "rest" att kryptera. Detta är en starkare position än krypterad lagring eftersom det inte finns någon nyckel att läcka och ingen tidslucka mellan användning och radering.
        </p>

        <h3>k-anonymitet</h3>
        <p><strong>På skärmen visas allt.</strong> Den som arbetar i verktyget har redan lönefilen, så vyerna maskerar inga grupper: varje yrkesgrupp, varje BAS-intervall och varje könsuppdelat mått visas oavsett storlek (beslut 2026-10-29).</p>
        <p><strong>Det som lämnar verktyget följer minsta gruppstorlek.</strong> Excel, Word-utkastet, PDF-rapporten, ZIP-filen, CSV, urklipp, diagrambilder, rapportunderlaget och allt under Dokumentera &amp; exportera ritas och räknas med den inställda tröskeln: grupper med n &lt; ${kInstalld()} redovisas inte, utan räknas upp med namn i en not så att det syns vad som saknas. Gällande värde är ${kInstalld()}; standardvärdet är ${K_STANDARD} och det ändras under Inställningar i sidhuvudet (&quot;Minsta gruppstorlek för redovisning&quot;). Personerna ingår fortfarande i underlaget och i totalsummorna.</p>
        <p>Där bara <em>könsuppdelningen</em> är för liten, men gruppen som helhet når tröskeln, redovisar exporterna gruppens <strong>samlade median</strong> i stället; könsjämförelsen utgår. Samma regel gäller könsuppdelade mått för hela organisationen: varje kön ska nå tröskeln.</p>
        <p><strong>Inte tröskelstyrt:</strong> i Löneöversyn får du lägga en egen riktad rad på en grupp under ${kInstalld()} personer: beloppet visas på raden och ingår i summorna, även i Excel-exporten, och bygger då på enskildas löner — raden säger det.</p>
        <p><strong>Utforska.</strong> Tabellens och diagrammens export utelämnar grupper under ${kInstalld()} personer om du inte kryssar i rutan <em>Ta med grupper under ${kInstalld()} i exporten</em>; organisationspaketet kan stänga av rutan.</p>
        <p><strong>Undantag: Likvärdigt arbete.</strong> Lagen kräver att även små kvinnodominerade yrken prövas. Fliken och dess egen export visar därför kandidatpar även när en grupp är under tröskeln; exporten anger det i filen. Alla andra utdata — Rapportunderlaget, Word-utkastet, PDF-rapporten, protokollet för gemensam lönebedömning, Att göra och dess CSV, handlingsplanens förifyllda rader och gruppdossiern — tar bara med par där båda grupperna når tröskeln och anger hur många som utelämnats.</p>
        <p><strong>Undantag: enskilda personer i verktyget.</strong> Personer att granska (Lika arbete) och extremvärdena i Underlagets kvalitet visar enskilda löner med filens radnummer. Personer att granska kan inte exporteras eller skrivas ut.</p>
        <p><strong>Diagramdata.</strong> Alla diagram kan exporteras som bild eller som diagramdata (CSV/urklipp). För diagram som visar enskilda personer — lön mot ålder, individpunkter — innehåller diagramdatan en rad per person (utan namn eller identifierare). Hantera sådana filer som personuppgifter. PDF-rapportens mall <em>Komplett rapport</em> och ZIP-exporten innehåller bilder av sådana diagram. I CSV och urklipp får celler som börjar med = + - @ ett inledande apostrof-tecken, så att Excel inte kör dem som formler.</p>

        <h3>Defense in depth</h3>
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
            <li><strong>OLS-estimering</strong> med <strong>HC3-robusta standardfel</strong> (Long & Ervin 2000) — rekommenderad default för små/medelstora urval</li>
            <li><strong>Sekventiell dekomponering:</strong> tre steg (Endast kön, sedan +BAS, sedan +Ålder) som visar hur stor del av råa lönegapet som förklaras av strukturella variabler; därefter ett steg +Yrkesgrupp: könsgapet med fasta effekter för yrkesgrupp inom BAS (AID×BAS), skattat med inomtransformation (gruppmedelvärdet dras av från log-lön, kön och ålder, sedan OLS utan intercept) — löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och ålder. Steget visas i kortet och förklaringsbudgeten men ingår inte i huvudtalet; har lönefilen ansvarskod tillkommer ett steg +Ansvar</li>
            <li><strong>BAS som indikatorvariabler:</strong> en indikator per BAS-intervall, det alfabetiskt första intervallet är referens; varje intervall får sin egen lönenivå utan antagandet att varje bokstavssteg är värt lika mycket. Bokstavsordningen (A lägst) är fast och kan inte ändras</li>
            <li>Konvertering till kr-procent: <code>gapPct = (exp(β) − 1) · 100</code></li>
            <li><strong>Konfidensintervall:</strong> 95 % KI = β ± t<sub>0,975; n−k</sub> × SE, med t-fördelningens kvantil vid färre än 100 frihetsgrader (1,96 först därefter); gäller huvudregressionen, per-BAS-regressionerna och livscykelmodellen</li>
        </ul>

        <h3>Ålder &amp; karriär och livscykelmodellen: ett tvärsnitt, inte en karriär</h3>
        <p>Lön mot ålder i Ålder &amp; karriär och livscykelmodellens kurvor bygger på ett tvärsnitt av lönerna vid kartläggningens tidpunkt. De visar skillnader mellan åldersgrupper i dag, inte hur en persons lön utvecklas över karriären: åldersgrupperna skiljer sig också i utbildning, yrkesval och anställningstid (kohorteffekter), och en skillnad mellan 30- och 60-åringar är därför inte en förväntad löneutveckling. Hur lönen faktiskt utvecklas kräver flera års kartläggningar av samma personer.</p>

        <h3>Quantile regression (glasstak/klistergolv)</h3>
        <p>IRLS-implementation (Iteratively Reweighted Least Squares) körs vid τ ∈ {0,10; 0,50; 0,90}. Visar hur lönegapet beter sig i olika delar av lönefördelningen — glasstak i höga decilier, klistergolv i låga. IRLS är en <em>approximation</em> av kvantillösningen: den minimerar inte check-förlusten exakt (som linjärprogrammering gör) utan närmar sig den med omviktade minsta kvadrater; i verktygets referenstest avviker könskoefficienten några tiondels procentenheter från den exakta lösningen. Könskoefficienten vid varje τ visas med ett 95 % percentil-bootstrap-konfidensintervall: raderna omsamplas 200 gånger, seedat ur datat så att intervallet blir detsamma varje gång. Vid fler än 2 000 personer räknas inget intervall (tiden), och det står i tabellen.</p>

        <h3>Bootstrap-konfidensintervall</h3>
        <p>B = 2000 percentil-bootstrap på mediankvoten kvinnor/män. 95% KI visas inline på det "råa lönegapet" så användaren ser osäkerhetsintervallet, inte ett falskt-precist punktestimat. (Efron & Tibshirani 1993)</p>

        <h3>Power-analys</h3>
        <p>Minsta detekterbara effekt (MDE) vid 80% statistisk styrka, α=0.05 tvåsidig:</p>
        <p class="kursiv pad-8 ta-mitt"><code>MDE = (exp(2,802 × SE) − 1) × 100 %</code></p>
        <p>där SE är könskoefficientens robusta standardfel i huvudregressionen (log-skala). Räknas om vid varje datauppladdning. Kriteriet <em>Statistisk styrka</em> i Underlagets kvalitet på Översikt är OK upp till 2 %, varning upp till 5 % och kritiskt däröver (låg styrka — undvik definitiva slutsatser om enskilda mindre grupper).</p>
        <p>Prioriteringens detektionströskel och varningarna per grupp använder en enklare uppskattning utan regression: <code>MDE = (exp(2,802 × σ_log × √(1/n_kv + 1/n_ma)) − 1) × 100 %</code>, där n är gruppens antal kvinnor och män och σ_log är spridningen i log(lön) <em>inom</em> grupp: den poolade standardavvikelsen av residualerna log(lön) − log(gruppens median per kön) över alla yrkesgrupper inom BAS med minst ${statGolv()} av varje kön (samma spridningsmått som trattdiagrammet i Lika arbete). Spridningen över hela urvalet rymmer skillnaderna mellan BAS-intervallen och skulle överskatta spridningen inom en grupp; den används bara som reserv när ingen grupp når golvet eller residualerna är färre än 20. En grupp märks under 3 % som god styrka, under 7 % som måttlig och däröver som låg.</p>

        <h3>Andra metoder</h3>
        <ul>
            <li><strong>Underlagets kvalitet:</strong> fem kriterier — jämförbarhet, statistisk styrka, fullständighet, rimlighet och modell — som var och ett får OK, Varning eller Kritisk. Underlaget får samma status som det svagaste kriteriet.</li>
            <li><strong>Outliers-detektor:</strong> Z-score per BAS-grupp på log-lön. |Z| ≥ 3 flaggas för manuell granskning och visas med lön och filens radnummer (bara i verktyget)</li>
            <li><strong>Löneöversyn (prognos):</strong> budget-först — lägg in en pott (kr eller %), fördela generellt + riktat per BAS och AID (en rad kan begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå), se nya löner, budgetutnyttjande och lönegap före/efter; förslag som riktar potten mot osakliga gap. Kostnaden räknas med PO-påslag och beräkningsperiod från Inställningar</li>
            <li><strong>Per-BAS conditional gap:</strong> separat regression inom varje BAS-intervall — visar var i organisationen oförklarat gap ligger</li>
            <li><strong>Motivation-suggestion-engine:</strong> 8 deterministiska regler (ingen LLM) som ger HR testbara hypoteser per prio-rad — åldersskillnad, glasstak-mönster, bristyrke, MDE-tröskel m.fl.</li>
        </ul>

        <section id="om-aid">
        <h3>AID och sektorer</h3>
        <p>${esc(AID_METODTEXT)}</p>
        <p>Verktyget känner till AID:s 13 huvudområden — till exempel vård och omsorg, skola och förskola
        och teknik — och använder dem som <strong>sektorer</strong> i sektorsöversikten under Struktur &amp; rapportmått
        och som gruppering i Utforska. Koder som inte finns i etikettlistan ingår i analyserna men får ingen sektor.</p>
        <p>AID:s <strong>ansvarskod</strong> är valfri. Finns den i lönefilen grupperas den i tre ansvarsgrupper:
        <strong>Ledningsansvar</strong> (A, B, C, L), <strong>Särskilt uppdrag</strong> (F, M, 1001, 1002) och
        <strong>Inget särskilt ansvar</strong>. Ansvaret redovisas bredvid huvudresultaten, aldrig inbakat i dem —
        om det är ett sakligt skäl avgör ni.</p>
        <p class="gd-note">Etikettlista: ${esc((() => { const i = _aidEtikettlistaInfo(); return `${i.kalla} (${i.antal} etiketter)`; })())}.</p>
        </section>

        <h3>Vad verktyget INTE gör</h3>
        <ul>
            <li>Använder inte AI/maskininlärning — all statistik är klassiska metoder med transparenta formler</li>
            <li>Föreslår inte sakliga skäl automatiskt — det är HR:s arbete och kräver mänsklig bedömning</li>
            <li>Justerar inte för förmåner, bonus, tjänstetillägg — kräver att lönen är FTE-justerad i CSV-input</li>
            <li>Avgör inte om en grupp är "likvärdig" — använder BAS-intervall, eller arbetsvärderingens poäng om de finns, som approximation; den slutliga kravvärderingen görs av arbetsgivaren</li>
        </ul>
    `,

    features: () => `
        <h3>Flikar i verktyget</h3>
        <table>
            <tr><th>Fas</th><th>Flik</th><th>Syfte</th></tr>
            <tr><td>1 · Underlag</td><td>Översikt &amp; Data</td><td>Filuppladdning och organisationspaket, nyckeltal, processkartan, underlagets kvalitet med extremvärden, Att göra (status mot lagkraven, Börja här och alla punkter) och Var uppstår löneskillnaden?</td></tr>
            <tr><td>2 · Kartlägg &amp; analysera</td><td>Regler &amp; praxis</td><td>Kvalitativ granskning av regler och praxis för löner och villkor: status och anteckning per område. Kräver ingen data; följer med i Word-utkastet.</td></tr>
            <tr><td>2 · Kartlägg &amp; analysera</td><td>Lika arbete</td><td>Ojusterat lönegap och könsfördelning per BAS, multivariat regression, vattenfallsdiagram och Blinder-Oaxaca</td></tr>
            <tr><td>2 · Kartlägg &amp; analysera</td><td>Likvärdigt arbete</td><td>Kvinnodominerade yrken mot likvärdiga icke-kvinnodominerade yrken, bootstrap-KI per par</td></tr>
            <tr><td>2 · Kartlägg &amp; analysera</td><td>Struktur &amp; rapportmått</td><td>Representation per nivå, fördelningsgap och måtten enligt EU 2023/970 art. 9</td></tr>
            <tr><td>3 · Åtgärda</td><td>Prioritering</td><td>Bubbeldiagram och sorterad lista med kostnad och förslag på möjliga förklaringar att pröva</td></tr>
            <tr><td>3 · Åtgärda</td><td>Löneöversyn</td><td>Simulera hur en lönepott kan fördelas och vad det gör med lönegapet</td></tr>
            <tr><td>3 · Åtgärda</td><td>Handlingsplan</td><td>Mall för åtgärder, kostnad, ansvarig och tidsplan (senast inom tre år) samt dokumentationskrav. Utskrivbar.</td></tr>
            <tr><td>4 · Fördjupa (ej lagkrav)</td><td>Ålder &amp; karriär</td><td>Lön mot ålder per kön, demografi (åldersfördelning, successionsrisk) och livscykel: växer eller krymper gapet över karriären</td></tr>
            <tr><td>4 · Fördjupa (ej lagkrav)</td><td>Jämförelse</td><td>Löneläget och jämförelsestatistiken mot ställningstagandet per yrkesgrupp, avsnittet mot ställningstagandet (bandkarta, könsposition i bandet, täckningsgrad) och avsnittet mot statistiken. Syns när en referens är inläst.</td></tr>
            <tr><td>4 · Fördjupa (ej lagkrav)</td><td>Utforska</td><td>Löneöversikten (hela löneläget per BAS, kön och yrkesgrupp) och egna vyer: rader och kolumner, mått, helhet eller per kön, urval med villkor, elva diagramtyper, klick till gruppdossier</td></tr>
            <tr><td>5 · Dokumentera</td><td>Dokumentera &amp; exportera</td><td>Färdigcheck och robusthet, all export (Word-utkast som .docx, PDF, Excel, protokoll för gemensam lönebedömning, handlingsplan), samverkan samt Spara och läsa in arbetet (konfiguration, ögonblicksbild, självdiagnostik)</td></tr>
            <tr><td>Hjälp</td><td>Om verktyget</td><td>Du är här</td></tr>
        </table>

        <h3>Genvägar och funktioner</h3>
        <ul>
            <li><strong>Spara/ladda konfiguration:</strong> JSON-export av prio-trösklar, vikter, kostnadsinställningar, bristyrkes-AID:n, löneöversynens inställningar och era § 8-anteckningar. Innehåller inga individrader, men hantera den som övriga exportfiler.</li>
            <li><strong>A/B-snapshot:</strong> jämför två analyser (t.ex. före/efter filtrering, eller scenario A mot B)</li>
            <li><strong>Multi-flik Excel-export:</strong> alla resultat-tabeller i en xlsx</li>
            <li><strong>ZIP-export:</strong> alla diagram (PNG) + Excel i en zip</li>
            <li><strong>PDF-rapport:</strong> en låst kopia av Word-utkastet med samma urval av avsnitt (hela dokumentationen, ledningsbrief eller facklig dialog)</li>
            <li><strong>Organisationspaket:</strong> en fil med organisationens benämningar, grundinställningar, ställningstagande och jämförelsestatistik läses in på Översikt.</li>
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
        <p>Den här filen är en organisationsfil: organisationspaketet från <strong>${esc(state.paketInbakat.organisation)}</strong> är inbakat (skapad ${esc(state.paketInbakat.skapad || '–')}) och läses in vid varje start. Filen bygger på verktyget version ${esc(state.paketInbakat.verktygsversion || 'okänd')}${state.paketInbakat.verktygssha ? ` (verktygsfilens SHA-256: <code>${esc(state.paketInbakat.verktygssha)}</code>)` : ''}. Paketet går att granska och ladda ner under <em>Organisationspaket</em> på Översikt. Ingen lönedata ingår i filen.</p>` : ''}
        <h3>Verifiera integriteten</h3>
        <p>Kontrollera att din kopia av <code>oppen-lonekartlaggning.html</code> matchar SHA-256-hashen i <code>RELEASE.txt</code>:</p>
        <h4>Windows (PowerShell):</h4>
        <p><code>(Get-FileHash -Algorithm SHA256 oppen-lonekartlaggning.html).Hash</code></p>
        <h4>Linux/macOS:</h4>
        <p><code>sha256sum oppen-lonekartlaggning.html</code></p>

        <h3>Bygg- och utvecklarverktyg</h3>
        <ul>
            <li><strong><code>npm run bundle</code></strong> — bygger single-file-HTML:en: inlinerar CSS/JS, minifierar, hårdar CSP med per-script-hashar och beräknar SHA-256</li>
            <li><strong><code>npm test</code></strong> — Vitest: de rena kärnorna i <code>src/lib/</code> (bl.a. statistik, prognos, struktur, likvärdigt arbete, Utforska, urval), CSV-parsning, boot-/render-röktest i jsdom, a11y (axe-core), golden-lås på Excel-/Word-/PDF-utdata och drift-vakt mot <code>src/lib/</code></li>
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
            <li><code>riskanalys.md</code> — risk- och sårbarhetsanalys, underlag till er konsekvensbedömning (DPIA)</li>
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
