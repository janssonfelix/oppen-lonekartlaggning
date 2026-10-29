// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// Metodtexten om AID (ADR-33) — samma text i Om verktyget, Lika arbete och Word-utkastet.
const AID_METODTEXT = 'AID är SKR:s och de fackliga organisationernas gemensamma indelning av arbetsuppgifter i ”rimligt homogena” grupper för lönestatistik. AID är inte ett arbetsvärderingssystem och är inte avsett att avgöra vilka arbeten som är lika eller likvärdiga. Verktygets AID-grupper är därför en utgångspunkt för lika arbete, som ni bekräftar; för likvärdigt arbete kompletterar BAS-intervallen eller en egen arbetsvärdering. Källa: SKR, Arbetsidentifikation (AID) — Handbok för kodning (2020).';

// ---- Ordlista (Glossary) ----
const GLOSSARY = [
    // Statistik
    { cat:'Statistik', term:'Median (P50)', short:'Mittersta värdet av sorterad lista', long:'Den lön där exakt hälften av gruppen tjänar mer och hälften tjänar mindre. Mer rättvis än medelvärde eftersom enstaka mycket höga eller låga löner inte påverkar medianen.' },
    { cat:'Statistik', term:'P10 (10:e percentilen)', short:'Värdet där 10% av gruppen tjänar mindre', long:'Speglar lönenivån för de lägst betalda i gruppen. Används som "lägsta önskad nivå" i lönepolitiska ställningstaganden.' },
    { cat:'Statistik', term:'P90 (90:e percentilen)', short:'Värdet där 90% av gruppen tjänar mindre', long:'Speglar lönenivån för de högst betalda. Används som "toppnivå" i lönepolitiska ställningstaganden.' },
    { cat:'Statistik', term:'Lönespridning', short:'P90 / P10 — bredd i lönenivåer inom en grupp', long:'1.0 = alla tjänar lika. 1.3 = de högst betalda tjänar 30% mer än de lägst betalda. Värden över ~1.5 kan signalera stora interna löneskillnader som bör granskas.' },
    { cat:'Statistik', term:'OLS-regression', short:'Standardmetoden för att räkna ut hur lönen hänger ihop med kön, ålder m.m. (eng. OLS)', long:'Estimerar samband mellan en förklarad variabel (t.ex. lön) och flera förklarande variabler (kön, ålder, BAS) genom att minimera summan av kvadrerade residualer. Standardverktyg inom svensk lönekartläggning (Medlingsinstitutet).' },
    { cat:'Statistik', term:'HC3 robust standardfel', short:'Felmarginal som tål att höga löner varierar mer än låga — ger mer pålitlig osäkerhet', long:'Standardfel som korrigeras för heteroskedasticitet och leverage. Lönedata uppvisar typiskt heteroskedasticitet (variansen växer med lönenivån), och klassiska SE underskattar då osäkerheten. HC3 är rekommenderad default för små/medelstora urval.' },
    { cat:'Statistik', term:'Heteroskedasticitet', short:'Spridningen är olika stor i olika delar av datat (höga löner varierar mer än låga)', long:'I lönedata växer typiskt variansen med lönenivån — höga löner har bredare spridning än låga. Bryter mot OLS-antagandet om homoskedasticitet, vilket motiverar robusta standardfel.' },
    { cat:'Statistik', term:'Multikollinearitet', short:'Två faktorer (t.ex. yrke och BAS) följs så tätt åt att modellen inte kan skilja dem', long:'När t.ex. yrke och BAS är (nästan) perfekt korrelerade kan modellen inte separera deras effekter och estimeringen blir instabil eller omöjlig. Verktyget faller tillbaka till en enklare modell när det upptäcks.' },
    { cat:'Statistik', term:'p-värde', short:'Hur troligt att skillnaden bara är slump. Lågt p (< 0,05) = troligen en verklig skillnad.', long:'Sannolikheten att få en minst så stor skillnad som den observerade om det i verkligheten inte fanns någon skillnad. p < 0,05 räknas som statistiskt signifikant, p < 0,01 som mycket och p < 0,001 som extremt signifikant. Ett lågt p-värde säger inte hur stor eller viktig skillnaden är.' },
    { cat:'Statistik', term:'Konfidensintervall (95% KI)', short:'Felmarginal: spannet som det sanna värdet rimligen ligger inom. Smalare = säkrare.', long:'Om man upprepade undersökningen många gånger skulle 95 % av de beräknade intervallen innehålla det sanna värdet. Bredare KI = osäkrare skattning. Verktyget redovisar både HC3-robust och klassiskt KI för transparens.' },
    { cat:'Statistik', term:'R² (förklaringsgrad)', short:'Andel av variationen som förklaras av modellen', long:'R² = 0,6 betyder att 60 % av lönevariationen kan förklaras av variablerna i modellen. Resterande 40 % förklaras inte av modellen. Justerad R² straffar för fler parametrar och är ofta mer rättvist att rapportera.' },
    { cat:'Statistik', term:'Sekventiell dekomponering', short:'Visar hur lönegapet krymper när kontroller läggs till', long:'Modellen körs i flera steg (Endast kön, sedan +BAS-intervall, sedan +Ålder) för att visa hur stor del av råa lönegapet som förklaras av strukturella variabler och vad som kvarstår oförklarat.' },
    { cat:'Statistik', term:'Uppdelning av löneskillnaden', short:'Skillnaden i medellön delad i BAS-fördelning, AID inom BAS och lön inom samma AID och BAS', long:'Översiktens kort "Var uppstår löneskillnaden?" delar skillnaden mellan mäns och kvinnors medellön i tre delar som tillsammans blir hela skillnaden. Varje del mäts symmetriskt, utan att något kön är referens. Grupperna rangordnas efter bidrag i kronor till hela skillnaden, inte efter skillnadens storlek i gruppen.' },
    { cat:'Verktyget', term:'Personer att granska', short:'Personer vars lön ligger minst X % under vad kollegor i samma AID och BAS i samma ålder tjänar', long:'Panelen sist i Lika arbete räknar för varje person en förväntad lön från kollegorna i samma AID och BAS — personen själv räknas inte med — justerad för ålder när kollegornas åldrar skiljer sig minst 5 år, annars deras medianlön. Bara grupper med minst {golv} personer prövas. Personen visas med filens radnummer. Listan kan inte exporteras eller skrivas ut.' },
    { cat:'Verktyget', term:'Skör flagga', short:'En flaggad yrkesgrupp där skillnaden kan hamna på 5 % eller under om en eller två personer tas bort', long:'Lika arbete prövar varje yrkesgrupp med en skillnad över 5 %: kan skillnaden bli 5 % eller mindre om en eller två personer tas bort ur gruppen? I så fall märks gruppen som skör, annars som stabil. Flaggan ligger kvar i båda fallen — märkningen visar var enskilda löner avgör utfallet. Borttagningar som skulle lämna ett kön med färre än {golv} personer prövas inte.' },
    { cat:'Verktyget', term:'Lägre krav, högre lön', short:'Kvinnodominerat yrke med lägre medianlön än ett av organisationens yrken i lägre BAS', long:'Avsnittet i Likvärdigt arbete jämför kvinnodominerade yrken med organisationens icke-kvinnodominerade yrken i lägre BAS-intervall. Har ett yrke med lägre krav ändå högre medianlön är det en tydlig signal om att det kvinnodominerade yrket kan vara undervärderat. BAS är ett grovt mått på krav och bör prövas mot befattningsbeskrivningarna. Med arbetsvärderingspoäng görs jämförelsen redan i kandidatparen.' },

    // Lönekartläggning
    { cat:'Lönekartläggning', term:'Lika arbete', short:'Personer i samma yrkesgrupp/AID-kod', long:'Diskrimineringslagen jämställer "lika arbete" med samma arbete — t.ex. förskollärare jämförs med andra förskollärare. EU:s lönetransparensdirektiv (2023/970) använder samma definition.' },
    { cat:'Lönekartläggning', term:'Likvärdigt arbete', short:'Olika arbete med samma värde för arbetsgivaren', long:'Diskrimineringslagen kräver också jämförelse av olika arbeten som har lika värde utifrån de krav arbetet ställer (kunskap och färdigheter, ansvar, ansträngning) och dess natur. I detta verktyg approximeras likvärdigt arbete med BAS-intervallet — yrken inom samma BAS antas ha jämförbara krav — eller, om strukturfilen har kolumnen Poäng, med arbetsvärderingens poäng. Den slutliga bedömningen görs av arbetsgivaren.' },
    { cat:'Lönekartläggning', term:'Sakliga skäl', short:'Motiverbara förklaringar till löneskillnad', long:'Faktorer som dokumenterad erfarenhet, prestation, marknadslöneläge, tjänstetillägg, kompetens. En löneskillnad som kan motiveras med sakliga skäl är inte diskriminering. Analysen ska dokumenteras skriftligt.' },
    { cat:'Lönekartläggning', term:'Osaklig löneskillnad', short:'Löneskillnad inom lika/likvärdigt arbete som ej kan motiveras könsneutralt', long:'Diskrimineringslagens begrepp: en löneskillnad mellan kvinnor och män som utför lika eller likvärdigt arbete och som inte kan motiveras med könsneutrala kriterier. En osaklig skillnad kan — men måste inte — utgöra diskriminering i rättslig mening. Bedömningen görs alltid hos den enskilda arbetsgivaren. Ska INTE blandas ihop med statistiskt oförklarat gap.' },
    { cat:'Statistik', term:'Standardvägning', short:'Metod som jämför löner med hänsyn till mätbara faktorer', long:'En statistisk metod (t.ex. regression) som jämför kvinnors och mäns löner med hänsyn till de lönepåverkande faktorer man har data om. Att en skillnad återstår efter standardvägning betyder att statistiken inte kan säga mer om vad den beror på — andra, omätta faktorer kan förklara den.' },
    { cat:'Statistik', term:'Könslönegap (aggregerat)', short:'Skillnad i kvinnors/mäns genomsnittslöner på samhällsnivå', long:'Skillnaden mellan kvinnors och mäns genomsnittslöner på övergripande nivå (samhälle/bransch). En stor del förklaras av att arbetsmarknaden är könsuppdelad — kvinnor och män arbetar i olika yrken och sektorer med olika lönenivåer. Det aggregerade gapet säger inget om huruvida kvinnor och män som gör samma arbete på en viss arbetsplats har olika lön — det är vad lönekartläggningen undersöker.' },
    { cat:'Lönekartläggning', term:'Gemensam lönebedömning', short:'Joint Pay Assessment enligt lönetransparensdirektivet', long:'Gemensam lönebedömning enligt direktiv (EU) 2023/970 (art. 10). Krävs hos arbetsgivare som lönerapporterar när rapporten visar en skillnad på 5 % eller mer i någon grupp av arbetstagare som utför lika eller likvärdigt arbete, som inte motiveras av objektiva, könsneutrala kriterier och som inte åtgärdats inom sex månader. Genomförs tillsammans med arbetstagarrepresentanter. Direktivet skulle vara infört i svensk rätt 7 juni 2026; svensk lag och ikraftträdande dateras när de är kända.' },
    { cat:'Lönekartläggning', term:'Lönegap (kön)', short:'Procentuell skillnad i lön mellan kön', long:'Beräknas som median(kvinnor) / median(män) × 100. 100% = lika lön. 95% = kvinnor tjänar i median 5% mindre än män. EU-direktivets utredningströskel är 5%.' },
    { cat:'Lönekartläggning', term:'Ojusterat lönegap', short:'Lönegap utan kontroll för andra variabler', long:'Ren skillnad i median mellan män och kvinnor. Påverkas av strukturella faktorer som åldersstruktur, BAS-fördelning, yrkesval. Vanligaste media-mått men säger lite om diskriminering i sig.' },
    { cat:'Lönekartläggning', term:'Åldersjusterat lönegap', short:'Lönegap vid samma genomsnittsålder', long:'Beräknas via separata trendlinjer per kön och utvärderas vid genomsnittsålder. Rensar bort effekten av att ett kön är äldre i snitt. Mer rättvisande än ojusterat.' },
    { cat:'Lönekartläggning', term:'Oförklarat lönegap', short:'Skillnad efter kontroll för strukturella variabler', long:'Genom multivariat regression (kön + ålder + BAS) extraheras kön-koefficienten. Den kvarvarande effekten motsvarar Medlingsinstitutets standardvägda löneskillnad. VIKTIGT: "oförklarat" betyder att skillnaden inte fångas av variablerna — inte att den beror på kön eller är osaklig. Det är en signal om var man bör titta närmare, inte ett bevis, och ska inte blandas ihop med "osaklig löneskillnad".' },
    { cat:'Lönekartläggning', term:'Jämn könsfördelning', short:'Båda könen utgör minst 40 % av gruppen', long:'En grupp anses ha jämn könsfördelning när minst 40 % är kvinnor och minst 40 % är män. Skillnader 60/40 räknas alltså som jämnt; från 61/39 och uppåt blir gruppen ojämn (könsdominerad). Definitionen är konsekvent med Diskrimineringsombudsmannens och Medlingsinstitutets praxis.' },
    { cat:'Lönekartläggning', term:'Könsskevhet', short:'Ojämn könsfördelning i en grupp', long:'När ett kön utgör mindre än 40 % av en grupp betraktas könsfördelningen som ojämn (könsdominerad). I sådana grupper kan lönejämförelser bli statistiskt svårtolkade. Identifiering är central i lönekartläggningen.' },
    { cat:'Lönekartläggning', term:'Lönepolitiskt ställningstagande', short:'Organisationens egen ambitionsnivå per BAS', long:'Anger önskade lönenivåer (P10, Median, P90) per BAS-intervall. Används för att jämföra faktiskt löneläge mot egen policy.' },
    { cat:'Lönekartläggning', term:'Diskrimineringslagen 3 kap.', short:'Aktiva åtgärder och lönekartläggning', long:'Reglerar arbetsgivares skyldighet att varje år kartlägga och analysera bestämmelser, praxis och löneskillnader mellan kvinnor och män i lika och likvärdigt arbete, att genomföra åtgärder så snart som möjligt och senast inom tre år, att samverka med arbetstagarna och att dokumentera arbetet skriftligt (vid tio anställda eller fler). De enskilda lagrummen står i verktygets dokumentation (lagrum.md).' },
    { cat:'Lönekartläggning', term:'Lönetransparensdirektivet 2023/970', short:'EU-direktiv om lönetransparens', long:'Kräver redovisning av lönegap, förbjuder lönesekretess i vissa fall och kräver gemensam lönebedömning (Joint Pay Assessment) vid en omotiverad skillnad på minst 5 %. Skulle vara infört i svensk rätt 7 juni 2026 (svensk lag och ikraftträdande dateras när de är kända); lönerapporteringen införs stegvis för arbetsgivare med minst 100 arbetstagare, först för de största.' },

    // Struktur
    { cat:'Struktur', term:'BAS-intervall', short:'Lönenivå-grad enligt arbetsvärdering', long:'Bokstavskod som speglar arbetets svårighetsgrad och värdering enligt arbetsvärderingen. Varje bokstav motsvarar ett lika brett poängintervall: A är lägst (t.ex. 0–99 poäng), B nästa (100–199) osv. Verktyget analyserar A–J och rangordnar efter bokstaven (A=1, B=2, …); ordningen är en del av BAS-systemet och kan inte ändras.' },
    { cat:'Struktur', term:'AID-kod', short:'Arbetsidentifikationskod (yrkeskod)', long:'Sifferkod som identifierar yrket enligt SKR/SKL:s lönestatistiksystem. Används för att matcha organisationens yrkesgrupper mot jämförelsestatistiken. Format: vanligen 6 siffror följda av yrkesbenämning, t.ex. "402010 Förskollärare".' },
    { cat:'Struktur', term:'SKR', short:'Sveriges Kommuner och Regioner', long:'Arbetsgivarorganisationen för kommuner och regioner. Verktyget använder tre saker från SKR: yrkesindelningen AID, personalstatistiken (nationell andel kvinnor per yrke, visad som "Kvinnor nationellt" och som reserv i Likvärdigt arbete) och PO-påslaget 39,15 % som standardvärde i kostnadsberäkningen. Perioden för statistiken står i Om verktyget.' },
    { cat:'Struktur', term:'Yrkesgrupp', short:'Personer med samma AID-kod', long:'Den minsta jämförelsegruppen inom "lika arbete". Yrken med samma AID-kod jämförs direkt mellan kön i EU-matrisen.' },
    { cat:'Struktur', term:'Heltidsekvivalent (FTE) lön', short:'Lön omräknad till 100% tjänstgöring', long:'Den lön personen skulle ha haft vid heltidstjänst. Används för att rättvist jämföra deltids- och heltidsanställda. Verktyget förutsätter att månadslönerna i CSV-filen redan är FTE-justerade.' },

    // Verktyget
    { cat:'Verktyget', term:'Underlagets kvalitet', short:'Hur väl underlaget räcker för analysen — svagaste kriteriet avgör', long:'Fem kriterier: jämförbarhet (andel av personalen i BAS-intervall där båda könen har minst {k} personer), statistisk styrka (minsta könsskillnad analysen kan upptäcka), fullständighet (rader som föll bort vid inläsningen), rimlighet (orimliga löner, åldrar eller BAS) och modell (om regressionen kunde ta hänsyn till både ålder och BAS). Varje kriterium får OK, Varning eller Kritisk, och underlaget får samma status som det svagaste. Könsfördelningen i organisationen är ett fynd, inte ett kvalitetsmått.' },
    { cat:'Verktyget', term:'Prioriteringsindex', short:'Rangordningsmått 0-100 i Prioriteringen', long:'Kombinerar avvikelsens storlek (50%), gruppens volym (30%) och jämställdhetsläget (20%). Negativ avvikelse väger 2× tyngre än positiv, och bristyrken får en bonus på 1,2×. Används för att rangordna åtgärder i Prioriteringen.' },
    { cat:'Verktyget', term:'Successionszon', short:'Åldersgrupper 60+ år', long:'Personer i denna ålder kommer att gå i pension inom 0–7 år (riktåldersintervallet 60–67). Aktiv kompetensöverföringsplanering rekommenderas. Verktyget flaggar BAS-grupper med >25% i successionszon som hög successionsrisk, >15% bör bevakas.' },
    { cat:'Verktyget', term:'Brist på återväxt', short:'Låg andel anställda under 40 år', long:'När mindre än 15% av gruppen är under 40 år. Indikerar begränsad tillströmning av yngre kompetens — strukturellt problem i rekryteringspipelinen.' },
    { cat:'Verktyget', term:'Uppmärksamhetstrappa', short:'Coachande skala — var börjar jag titta?', long:'Verktyget rangordnar yrkesgrupper efter hur mycket de är värda att titta på — det är ett stöd för din bedömning, inte en dom. Skalan är: Börja här · Värt att granska · Följ upp · Över referens · Balanserat. Samma skala används i alla flikar. En grupp som lyfts kan mycket väl ha sakliga skäl bakom skillnaden — det är det du väger.' },
    { cat:'Verktyget', term:'Börja här', short:'Tydlig avvikelse i en större grupp', long:'Gruppen ligger mer än [konfigurerbart, default 5 %] under referensvärdet och har minst [default 10] personer. Ett bra ställe att börja granskningen — många berörda och tydlig budgetpåverkan. Tröskeln kan anpassas i Prioriteringens konfigurationspanel.' },
    { cat:'Verktyget', term:'Värt att granska', short:'Tydlig avvikelse, mindre grupp', long:'Avvikelsen överstiger granskningsgränsen men gruppen är mindre. Lämpar sig för en riktad titt på enskilda individer och deras sakliga skäl.' },
    { cat:'Verktyget', term:'Följ upp', short:'Måttlig avvikelse', long:'Ligger mellan följ-upp- och granskningströskeln. Värt att hålla under uppsikt över tid för att se hur det utvecklas.' },
    { cat:'Verktyget', term:'Över referens', short:'Gruppen ligger över referensvärdet', long:'Gruppen tjänar mer än referensvärdet. Kan vara väl motiverat (specialistkompetens, marknadsläge) — värt att förstå varför.' },
    { cat:'Verktyget', term:'Sekventiell dekomponering', short:'Visar hur gapet krymper när kontroller läggs till', long:'I fliken Lika arbete visas tre regressionsmodeller (Endast kön, sedan +BAS, sedan +Ålder) för att illustrera hur stor del av råa lönegapet som förklaras av strukturella variabler.' },
    { cat:'Verktyget', term:'Per-BAS conditional gap', short:'Separata regressioner inom varje BAS', long:'För varje BAS-intervall med minst {golv} personer av varje kön körs en separat regression: log(lön) ~ kön + ålder. Visar var inom organisationen den oförklarade löneskillnaden är som störst.' },

    // GDPR
    { cat:'GDPR', term:'K-anonymitet', short:'Skydd mot återidentifiering vid små grupper', long:'Verktygets eget skydd mot återidentifiering, som uttryck för uppgiftsminimering och inbyggt dataskydd i dataskyddsförordningen (art. 5.1 c och 25). Verktyget redovisar inte lönemått för grupper med färre än {k} personer (standard 10; värdet kan ändras på Översikt) eftersom enskilda löner då kan deduceras via t.ex. känd åldersstruktur. I Utforska visas de tonade, men de följer bara med i exporten om du kryssar i det. Likvärdigt arbete visar kandidatpar även när en grupp är mindre, eftersom lagen kräver att små kvinnodominerade yrken prövas; Word-utkastet, PDF-rapporten och rapportunderlaget tar inte med sådana par.' },
    { cat:'GDPR', term:'Uppgiftsminimering', short:'Behandla endast nödvändiga uppgifter (dataskyddsförordningen art. 5.1 c)', long:'Personuppgifter ska vara adekvata, relevanta och begränsade till vad som är nödvändigt. Verktyget läser endast in vitlistade fält (BAS, yrke, lön, ålder, kön samt två valfria: arbetsvärderingspoäng och AID:s kod för ledning och särskilda uppdrag) — anställningsnummer, namn, e-post och personnummer plockas inte upp ens om de finns i filen.' },
    { cat:'GDPR', term:'Pseudonymisering', short:'Ersätt direkta identifierare med koder', long:'Direkta personidentifierare ersätts med löpnummer eller koder. Återmappning hålls separat. Möjliggör analys utan direkt återidentifiering. Rekommenderas före CSV-uppladdning.' },
    { cat:'GDPR', term:'Privacy by Design', short:'Inbyggt dataskydd (dataskyddsförordningen art. 25)', long:'Tekniska och organisatoriska åtgärder som standard. Detta verktyg implementerar Privacy by Design genom: lokal-only-arkitektur (data lämnar aldrig enheten), CSP-spärrar mot nätverksanrop, k-anonymitet, vitlistad fältparsning, automatisk avvisning av filer som innehåller personidentifierare.' },
    { cat:'GDPR', term:'Content Security Policy (CSP)', short:'Webbläsar-policy som blockerar nätverksanrop', long:'En meta-tagg i HTML-filen som instruerar webbläsaren att förbjuda alla utgående nätverksanslutningar (connect-src \'none\'). Hård teknisk barriär mot exfiltrering — även om en framtida bug skulle försöka göra fetch/XHR/WebSocket blockeras anropet.' },
    { cat:'GDPR', term:'Datafunnel', short:'Spårbarhet från CSV till analys', long:'I flera analysflikar finns en "Beräkning & urval"-panel som redovisar exakt hur många rader som ingår, vilka som exkluderats och varför. Möjliggör kvalitetssäkring och svar på frågan "Stämmer denna siffra?".' }
];

function _normalizeTerm(s) { return s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, ''); }

const STATISTIK_101 = `
<details class="bak-accent-yta ram-1-accent-kant rund-8 marg-0-0-14 pad-14-16" open>
    <summary class="farg-accent-mork pekare fs-md fw-700 pad-4-0 ej-markerbar">Statistik 101 — kort introduktion för icke-statistiker</summary>
    <div class="fs-md lh-1_7 marg-t-10">
        <h4 class="farg-accent-mork marg-10-0-4">Vad är medianvärde?</h4>
        <p>Sortera alla löner från lägst till högst. Mittersta värdet är medianen. Hälften tjänar mer, hälften mindre. Mer rättvist än medelvärde — en enstaka mycket hög lön drar inte upp siffran.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är ett lönegap?</h4>
        <p>Procentuell skillnad mellan kvinnors och mäns medianlöner. <strong>100 % = lika lön.</strong> 95 % = kvinnor tjänar i median 5 % mindre än män. EU-direktivet säger att gap över 5 % bör utredas.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Tre sorters lönegap (samma tre ord används i hela verktyget)</h4>
        <ol class="marg-6-0-0-18 pad-0">
            <li><strong>Ojusterat lönegap</strong> (kallas ibland "rågap") — ren skillnad i median mellan könen. Påverkas av att kvinnor och män ofta har olika ålder, BAS och yrke. Visar inte diskriminering i sig.</li>
            <li><strong>Åldersjusterat lönegap</strong> — samma jämförelse men vid <em>samma genomsnittsålder</em>. Rensar bort att det ena könet är äldre i snitt.</li>
            <li><strong>Oförklarat lönegap</strong> — det som blir kvar efter att vi räknat bort effekten av <em>både ålder och BAS-placering</em>. Det som <em>inte</em> kan förklaras av strukturella skillnader. Detta är vad EU-direktivet kallar <em>unexplained gender pay gap</em> och det viktigaste måttet vid diskrimineringsbedömning.</li>
        </ol>
        <p class="marg-6-0-0"><strong>Tumregel:</strong> krymper gapet mycket från (1) till (3) förklaras det mesta av struktur; står det kvar stort i (3) finns ett oförklarat gap som är värt att granska närmare.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är en regression?</h4>
        <p>Föreställ dig att du frågar datan: "Hur mycket av lönen förklaras av varje faktor — kön, ålder, BAS — om vi håller de andra konstanta?" Det är vad regression gör. Den isolerar köneffekten från åldersstrukturen och BAS-fördelningen.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad betyder p-värdet?</h4>
        <p>Sannolikheten att resultatet beror på <em>slumpmässig variation</em> snarare än verklig skillnad. <strong>p &lt; 0,05</strong> = mindre än 5 % slumpsannolikhet, alltså "statistiskt signifikant". <strong>p &lt; 0,001</strong> = mindre än 0,1 %, mycket starkt bevis.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är ett konfidensintervall (95 % KI)?</h4>
        <p>Det "verkliga" värdet ligger med 95 % sannolikhet inom det angivna intervallet. <strong>Smalt intervall</strong> = säker estimering. <strong>Brett intervall</strong> = osäker (vanligen små grupper).</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad innebär statistisk och praktisk signifikans?</h4>
        <p>Vid stora urval kan även mycket små skillnader bli "statistiskt signifikanta". Ett gap på 0,3 % kan ha p &lt; 0,001 utan att vara åtgärdsvärt i praktiken. Bedöm <strong>båda</strong>: är skillnaden statistiskt säkerställd <em>och</em> praktiskt betydande (vanligen ≥ 5 % enligt EU-direktivet)?</p>

        <h4 class="farg-accent-mork marg-14-0-4">Typiska siffror att jämföra mot</h4>
        <ul class="marg-6-0-0-18">
            <li><strong>Nationellt ojusterat lönegap:</strong> ~9,8 % (Medlingsinstitutet 2024)</li>
            <li><strong>Nationellt oförklarat gap:</strong> ~4,5 % efter standardkontroller</li>
            <li><strong>R² i lönemodeller:</strong> 50–70 % är vanligt</li>
            <li><strong>Ålderseffekt:</strong> 0,5–1,5 % löneökning per år är typiskt</li>
            <li><strong>BAS-effekt per steg:</strong> 8–15 % per BAS-steg är vanligt</li>
            <li><strong>Lönespridning (P90/P10):</strong> 1,3–1,5 är normalt; över 1,7 = bred</li>
        </ul>
    </div>
</details>
`;

function renderGlossary(filterText = '') {
    const wrap = document.getElementById('glossary-content');
    if (!wrap) return;
    const filter = _normalizeTerm(filterText.trim());
    const lista = GLOSSARY.map(g => ({ ...g, short: _kText(g.short), long: _kText(g.long) }));
    const matches = filter
        ? lista.filter(g => _normalizeTerm(g.term + ' ' + g.short + ' ' + g.long).includes(filter))
        : lista;
    if (!matches.length) {
        wrap.innerHTML = `<div class="glossary-empty">Inga termer matchar "${esc(filterText)}".</div>`;
        return;
    }
    const grouped = {};
    matches.forEach(g => { if (!grouped[g.cat]) grouped[g.cat] = []; grouped[g.cat].push(g); });
    const order = ['Lönekartläggning', 'Statistik', 'Struktur', 'Verktyget', 'GDPR'];
    // Visa Statistik 101-sektionen om ingen sökning är aktiv
    let html = filter ? '' : STATISTIK_101;
    order.forEach(cat => {
        if (!grouped[cat]) return;
        html += `<div class="glossary-cat-header">${esc(cat)}</div>`;
        grouped[cat].forEach(g => {
            html += `<div class="glossary-entry">
                <div class="glossary-term">${esc(g.term)}</div>
                <div class="glossary-short">${esc(g.short)}</div>
                <div class="glossary-long">${esc(g.long)}</div>
            </div>`;
        });
    });
    wrap.innerHTML = html;
}

function openGlossary() {
    const m = document.getElementById('glossary-modal');
    if (!m) return;
    m.style.display = 'flex';
    renderGlossary('');
    trapFocus(m);
}
function closeGlossary() {
    const m = document.getElementById('glossary-modal');
    if (m) {
        releaseFocus(m);
        m.style.display = 'none';
    }
}

document.getElementById('btn-open-glossary')?.addEventListener('click', openGlossary);
document.getElementById('glossary-close')?.addEventListener('click', closeGlossary);
document.querySelector('#glossary-modal .glossary-backdrop')?.addEventListener('click', closeGlossary);
document.getElementById('glossary-search')?.addEventListener('input', e => renderGlossary(/** @type {HTMLInputElement} */ (e.target).value));
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && /** @type {HTMLElement} */ (document.getElementById('glossary-modal')).style.display === 'flex') closeGlossary();
});

// Symbol/färgförklaring-modal
document.getElementById('btn-open-symbols')?.addEventListener('click', () => {
    const m = document.getElementById('symbols-modal');
    if (m) { m.style.display = 'flex'; trapFocus(m); }
});
document.getElementById('symbols-close')?.addEventListener('click', () => {
    const m = document.getElementById('symbols-modal');
    if (m) { releaseFocus(m); m.style.display = 'none'; }
});
document.querySelector('#symbols-modal .glossary-backdrop')?.addEventListener('click', () => {
    const m = document.getElementById('symbols-modal');
    if (m) { releaseFocus(m); m.style.display = 'none'; }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('symbols-modal')?.style.display === 'flex') {
        /** @type {HTMLElement} */ (document.getElementById('symbols-modal')).style.display = 'none';
    }
});
