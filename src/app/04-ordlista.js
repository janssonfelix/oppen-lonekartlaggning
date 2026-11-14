// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// Metodtexten om AID (ADR-33) — samma text i Om verktyget, Lika arbete och Word-utkastet.
const AID_METODTEXT = 'AID är SKR:s och de fackliga organisationernas gemensamma indelning av arbetsuppgifter i ”rimligt homogena” grupper för lönestatistik. AID är inte ett arbetsvärderingssystem och är inte avsett att avgöra vilka arbeten som är lika eller likvärdiga. Verktygets AID-grupper är därför en utgångspunkt för lika arbete, som du bekräftar; för likvärdigt arbete kompletterar BAS-intervallen eller en egen arbetsvärdering. Källa: SKR, Arbetsidentifikation (AID) — Handbok för kodning (2020).';

// ---- Ordlista (Glossary) ----
const GLOSSARY = [
    // Statistik
    { cat:'Statistik', term:'Median (P50)', short:'Mittersta värdet av sorterad lista', long:'Den lön där exakt hälften av gruppen tjänar mer och hälften tjänar mindre. Påverkas mindre än medelvärdet av enstaka mycket höga eller låga löner.' },
    { cat:'Statistik', term:'P10 (10:e percentilen)', short:'Värdet där 10 % av gruppen tjänar mindre', long:'Speglar lönenivån för de lägst betalda i gruppen. Används som "lägsta önskad nivå" i lönepolitiska ställningstaganden.' },
    { cat:'Statistik', term:'P90 (90:e percentilen)', short:'Värdet där 90 % av gruppen tjänar mindre', long:'Speglar lönenivån för de högst betalda. Används som "toppnivå" i lönepolitiska ställningstaganden.' },
    { cat:'Statistik', term:'Lönespridning', short:'P90 / P10 — bredd i lönenivåer inom en grupp', long:'1,0 = alla tjänar lika. 1,3 = de högst betalda tjänar 30 % mer än de lägst betalda. Värden över ungefär 1,5 kan tyda på stora löneskillnader inom gruppen som bör granskas.' },
    { cat:'Statistik', term:'OLS-regression', short:'Standardmetoden för att räkna ut hur lönen hänger ihop med kön, ålder m.m. (eng. OLS)', long:'Estimerar samband mellan en förklarad variabel (t.ex. lön) och flera förklarande variabler (kön, ålder, BAS) genom att minimera summan av kvadrerade residualer. Vanlig metod i lönekartläggning.' },
    { cat:'Statistik', term:'HC3 robust standardfel', short:'Felmarginal som tål att höga löner varierar mer än låga — ger mer pålitlig osäkerhet', long:'Standardfel som korrigeras för heteroskedasticitet och inflytelserika punkter. Lönedata uppvisar typiskt heteroskedasticitet (variansen växer med lönenivån), och klassiska SE underskattar då osäkerheten. HC3 är det vanliga valet för små och medelstora urval.' },
    { cat:'Statistik', term:'Heteroskedasticitet', short:'Spridningen är olika stor i olika delar av datat (höga löner varierar mer än låga)', long:'I lönedata växer typiskt variansen med lönenivån — höga löner har bredare spridning än låga. Bryter mot OLS-antagandet om homoskedasticitet, vilket motiverar robusta standardfel.' },
    { cat:'Statistik', term:'Multikollinearitet', short:'Två faktorer (t.ex. yrke och BAS) följs så tätt åt att modellen inte kan skilja dem', long:'När t.ex. yrke och BAS är (nästan) perfekt korrelerade kan modellen inte separera deras effekter och estimeringen blir instabil eller omöjlig. Verktyget faller tillbaka till en enklare modell när det upptäcks.' },
    { cat:'Statistik', term:'p-värde', short:'Hur ofta slumpen ensam skulle ge en så stor skillnad. Under 0,05: skillnaden är svår att förklara med slump.', long:'Sannolikheten att få en minst så stor skillnad som den observerade om det i verkligheten inte fanns någon skillnad. p < 0,05 räknas som statistiskt signifikant, p < 0,01 som mycket och p < 0,001 som extremt signifikant. Ett lågt p-värde säger inte hur stor eller viktig skillnaden är.' },
    { cat:'Statistik', term:'Konfidensintervall (95% KI)', short:'Felmarginal: spannet som det sanna värdet rimligen ligger inom. Smalare = säkrare.', long:'Om man upprepade undersökningen många gånger skulle 95 % av de beräknade intervallen innehålla det sanna värdet. Bredare KI = osäkrare skattning. Verktyget redovisar både HC3-robust och klassiskt KI för transparens.' },
    { cat:'Statistik', term:'R² (förklaringsgrad)', short:'Andel av variationen som förklaras av modellen', long:'R² = 0,6 betyder att 60 % av lönevariationen kan förklaras av variablerna i modellen. Resterande 40 % förklaras inte av modellen. Justerad R² straffar för fler parametrar och är ofta mer rättvist att rapportera.' },
    { cat:'Statistik', term:'Sekventiell dekomponering', short:'Visar hur löneskillnaden krymper när kontroller läggs till', long:'Modellen körs i flera steg — endast kön, sedan + BAS-intervall, sedan + Ålder (huvudtalet), därefter + Yrkesgrupp inom BAS och, när lönefilen har ansvarskod, + Ansvar — för att visa hur stor del av den råa löneskillnaden som förklaras av varje faktor och vad som kvarstår oförklarat. Visas som trappa och steg för steg i Lönestruktur.' },
    { cat:'Statistik', term:'Uppdelning av löneskillnaden', short:'Skillnaden i medellön delad i BAS-fördelning, AID inom BAS och lön inom samma AID och BAS', long:'Kortet "Var uppstår löneskillnaden?" i Lönestruktur delar skillnaden mellan mäns och kvinnors medellön i tre delar som tillsammans blir hela skillnaden. Varje del mäts symmetriskt, utan att något kön är referens. Variablerna går att välja (BAS, sektor, AID-mellannivå, AID och åldersgrupp, en till fyra) och ordningen påverkar delarna; standard är BAS och AID. Grupperna rangordnas efter bidrag i kronor till hela skillnaden, inte efter skillnadens storlek i gruppen.' },
    { cat:'Verktyget', term:'Personer att granska', short:'Personer vars lön ligger minst X % under vad kollegor i samma AID och BAS i samma ålder tjänar', long:'Panelen sist i Lika arbete räknar för varje person en förväntad lön från kollegorna i samma AID och BAS — personen själv räknas inte med — justerad för ålder när kollegornas åldrar skiljer sig minst 5 år, annars deras medianlön. Bara grupper med minst {golv} personer prövas. Personen visas med filens radnummer. Listan kan inte exporteras eller skrivas ut.' },
    { cat:'Verktyget', term:'Skör flagga', short:'En yrkesgrupp värd att granska där skillnaden kan hamna under 3 % om en eller två personer tas bort', long:'Lika arbete prövar varje yrkesgrupp med statusen Värt att granska: kan skillnaden hamna under 3 % (statusens storleksgräns) om en eller två personer tas bort ur gruppen? I så fall märks gruppen som skör, annars som stabil. Statusen ligger kvar i båda fallen — märkningen visar var enskilda löner avgör utfallet. Borttagningar som skulle lämna ett kön med färre än {golv} personer prövas inte.' },
    { cat:'Verktyget', term:'Lägre krav, högre lön', short:'Kvinnodominerat yrke med lägre medianlön än ett av organisationens yrken i lägre BAS', long:'Avsnittet i Likvärdigt arbete jämför kvinnodominerade yrken med organisationens icke-kvinnodominerade yrken i lägre BAS-intervall. Har ett yrke med lägre krav ändå högre medianlön är det en tydlig signal om att det kvinnodominerade yrket kan vara undervärderat. BAS är ett grovt mått på krav och bör prövas mot befattningsbeskrivningarna. Med arbetsvärderingspoäng görs jämförelsen redan i kandidatparen.' },

    // Lönekartläggning
    { cat:'Lönekartläggning', term:'Lika arbete', short:'Personer i samma yrkesgrupp/AID-kod', long:'Arbete som är lika eller nästan lika, till exempel förskollärare jämförda med andra förskollärare. Verktyget utgår från samma AID-kod, som du bekräftar.' },
    { cat:'Lönekartläggning', term:'Likvärdigt arbete', short:'Olika arbeten som är lika mycket värda', long:'Diskrimineringslagen kräver också att olika arbeten jämförs när de är lika mycket värda utifrån kraven i arbetet: kunskap och färdigheter, ansvar, ansträngning och arbetsförhållanden. Verktyget mäter kraven med BAS-intervallet (yrken i samma BAS-intervall antas ha jämförbara krav) eller, om lönefilen har kolumnen Poäng, med arbetsvärderingens poäng. Den slutliga bedömningen gör organisationen.' },
    { cat:'Lönekartläggning', term:'Sakliga skäl', short:'Skäl till en löneskillnad som inte har samband med kön', long:'Skäl till en löneskillnad som inte har samband med kön, till exempel ansvar eller erfarenhet. Lagen kräver att du prövar varje skillnad och dokumenterar bedömningen. I Handlingsplan dokumenterar du skälen per grupp med knappen Sakliga skäl: en kategori, ett belopp i kronor per månad och en kort kommentar per skäl. Kategorierna är Marknad, Utbildning, Erfarenhet, Prestation och resultat, Övergång och Annat sakligt skäl. Lagen räknar inte upp några skäl; indelningen är verktygets. Verktyget räknar ihop hur stor del av gruppens löneskillnad skälen förklarar; bedömningen är din.' },
    { cat:'Lönekartläggning', term:'Osaklig löneskillnad', short:'Löneskillnad inom lika/likvärdigt arbete som ej kan motiveras könsneutralt', long:'Diskrimineringslagens begrepp: en löneskillnad mellan kvinnor och män som utför lika eller likvärdigt arbete och som inte kan motiveras med könsneutrala kriterier. En osaklig skillnad kan — men måste inte — utgöra diskriminering i rättslig mening. Bedömningen görs alltid av den enskilda organisationen. Är inte samma sak som en oförklarad löneskillnad.' },
    { cat:'Statistik', term:'Standardvägning', short:'Metod som jämför löner med hänsyn till mätbara faktorer', long:'En statistisk metod (t.ex. regression) som jämför kvinnors och mäns löner med hänsyn till de lönepåverkande faktorer man har data om. Att en skillnad återstår efter standardvägning betyder att statistiken inte kan säga mer om vad den beror på — andra, omätta faktorer kan förklara den.' },
    { cat:'Statistik', term:'Löneskillnad på samhällsnivå', sok:'könslönegap lönegap', short:'Skillnad i kvinnors och mäns genomsnittslöner i hela samhället', long:'Skillnaden mellan kvinnors och mäns genomsnittslöner på övergripande nivå (samhälle/bransch). En stor del förklaras av att arbetsmarknaden är könsuppdelad — kvinnor och män arbetar i olika yrken och sektorer med olika lönenivåer. Den säger inget om kvinnor och män som gör samma arbete i en viss organisation har olika lön. Det är vad lönekartläggningen undersöker.' },
    { cat:'Lönekartläggning', term:'Gemensam lönebedömning', short:'Bedömning tillsammans med arbetstagarnas företrädare när en skillnad är 5 procent eller mer', long:'Gemensam lönebedömning enligt lönetransparensdirektivet. Krävs hos arbetsgivare som lönerapporterar när rapporten visar en skillnad på 5 % eller mer i någon grupp av arbetstagare som utför lika eller likvärdigt arbete, som inte motiveras av objektiva, könsneutrala kriterier och som inte åtgärdats inom sex månader. Görs tillsammans med arbetstagarnas företrädare. Direktivet skulle vara infört i svensk rätt 7 juni 2026; svensk lag och ikraftträdande dateras när de är kända.' },
    { cat:'Lönekartläggning', term:'Kvinnors lön i procent av mäns', sok:'lönegap löneskillnad kön', short:'Kvinnors medianlön som andel av mäns', long:'Beräknas som median(kvinnor) / median(män) × 100. 100 % = lika lön. 95 % = kvinnor tjänar i median 5 % mindre än män. Statusen (Värt att granska, Följ upp, Balanserat) bygger på om skillnaden är statistiskt säkerställd och minst 3 %; direktivmarkeringen ≥ 5 % står bredvid den ojusterade skillnaden. Samma tal skrivs ibland som skillnad: 85,2 % av mäns lön är detsamma som −14,8 %; verktyget använder kvoten på Översikt och i Ålder & karriär och skillnaden i Lika arbete, där den jämförs med modellens tal.' },
    { cat:'Lönekartläggning', term:'Rå (ojusterad) löneskillnad', sok:'lönegap rågap ojusterad löneskillnad', short:'Löneskillnad utan kontroll för andra variabler', long:'Ren skillnad i median mellan män och kvinnor. Påverkas av strukturella faktorer som åldersstruktur, BAS-fördelning och yrkesval. Det vanligaste måttet i medierna, men det säger lite om diskriminering i sig.' },
    { cat:'Lönekartläggning', term:'Åldersjusterad löneskillnad', short:'Löneskillnad vid samma genomsnittsålder', long:'Beräknas med en trendlinje per kön som läses av vid genomsnittsåldern. Räknar bort att ett kön i snitt är äldre. Mer rättvisande än den ojusterade.' },
    { cat:'Lönekartläggning', term:'Oförklarad löneskillnad', sok:'lönegap', short:'Skillnad efter kontroll för strukturella variabler', long:'En regression med kön, ålder och BAS-intervall ger könskoefficienten. Viktigt: "oförklarat" betyder att skillnaden inte fångas av variablerna — inte att den beror på kön eller är osaklig. Det är en signal om var man bör titta närmare, inte ett bevis, och ska inte blandas ihop med "osaklig löneskillnad".' },
    { cat:'Lönekartläggning', term:'Kvinnodominerat arbete', short:'Ett arbete där klart fler än hälften är kvinnor', long:'Verktyget räknar ett yrke som kvinnodominerat när andelen kvinnor är mer än gränsen, eller gränsen eller mer, efter valet i Likvärdigt arbetes inställningar (standard mer än 60 procent). Lagen anger ingen siffra. Likvärdigt arbete jämför kvinnodominerade yrken med yrken som inte är kvinnodominerade.' },
    { cat:'Lönekartläggning', term:'Kandidatpar', short:'Ett kvinnodominerat yrke och ett jämförelseyrke med likvärdiga eller lägre krav', long:'Ett par i Likvärdigt arbete där det kvinnodominerade yrket har lägre lön än ett yrke med jämförbara eller lägre krav. Paret är en kandidat att granska, inget konstaterande: om arbetena verkligen är likvärdiga avgör du.' },
    { cat:'Struktur', term:'Klibbigt golv', short:'Löneskillnaden är störst bland de lägst betalda', long:'När skillnaden mellan kvinnors och mäns lön är större vid P10 än vid P90 talar man om ett klibbigt golv: kvinnor blir kvar i de lägsta lönelägena. Granska ingångslöner och lägstanivåer.' },
    { cat:'Struktur', term:'Glastak', short:'Löneskillnaden är störst bland de högst betalda', long:'När skillnaden mellan kvinnors och mäns lön är större vid P90 än vid P10, eller andelen kvinnor sjunker mot högre BAS-intervall, talar man om ett glastak. Granska befordran och lönesättningen i toppen.' },
    { cat:'Lönekartläggning', term:'Jämn könsfördelning', short:'Båda könen utgör minst 40 % av gruppen', long:'En grupp anses ha jämn könsfördelning när minst 40 % är kvinnor och minst 40 % är män. En fördelning på 60/40 räknas alltså som jämn; från 61/39 och uppåt blir gruppen ojämn (könsdominerad). Gränsen 40/60 är verktygets; lagen anger ingen siffra.' },
    { cat:'Lönekartläggning', term:'Könsskevhet', short:'Ojämn könsfördelning i en grupp', long:'När ett kön utgör mindre än 40 % av en grupp betraktas könsfördelningen som ojämn (könsdominerad). I sådana grupper kan lönejämförelser bli statistiskt svårtolkade.' },
    { cat:'Lönekartläggning', term:'Lönepolitiskt ställningstagande', short:'Organisationens egen ambitionsnivå per BAS-intervall', long:'Anger önskade lönenivåer (P10, Median, P90) per BAS-intervall. Används för att jämföra faktiskt löneläge mot egen policy.' },
    { cat:'Lönekartläggning', term:'Diskrimineringslagen 3 kap.', short:'Aktiva åtgärder och lönekartläggning', long:'Reglerar arbetsgivares skyldighet att varje år kartlägga och analysera bestämmelser, praxis och löneskillnader mellan kvinnor och män i lika och likvärdigt arbete, att genomföra åtgärder så snart som möjligt och senast inom tre år, att samverka med arbetstagarna och att dokumentera arbetet skriftligt (fullständigt med 25 anställda eller fler, i förenklad form med 10–24). De enskilda lagrummen står i verktygets dokumentation (lagrum.md).' },
    { cat:'Lönekartläggning', term:'Lönetransparensdirektivet 2023/970', short:'EU-direktiv om lönetransparens', long:'Kräver att större arbetsgivare rapporterar löneskillnaden mellan kvinnor och män, och kräver gemensam lönebedömning när en rapporterande arbetsgivare har en skillnad på 5 procent eller mer som inte är motiverad och inte rättad inom sex månader. Skulle vara infört i svensk rätt 7 juni 2026 (svensk lag och ikraftträdande dateras när de är kända); lönerapporteringen införs stegvis för arbetsgivare med minst 100 anställda, först för de största.' },

    // Struktur
    { cat:'Struktur', term:'BAS-intervall', short:'Kravnivå enligt arbetsvärdering', long:'Bokstavskod som speglar arbetets svårighetsgrad och värdering enligt arbetsvärderingen. Verktyget antar att varje bokstav motsvarar ett lika brett poängintervall: A är lägst (t.ex. 0–99 poäng), B nästa (100–199) osv. Verktyget analyserar de BAS-intervall som finns i lönefilen (vanligen A–K) och rangordnar efter bokstaven (A=1, B=2, …); ordningen är en del av BAS-systemet och kan inte ändras.' },
    { cat:'Struktur', term:'AID-kod', short:'Arbetsidentifikationskod (yrkeskod)', long:'Sifferkod som identifierar yrket enligt SKR:s lönestatistiksystem. Används för att matcha organisationens yrkesgrupper mot jämförelsestatistiken. Format: vanligen 6 siffror följda av yrkesbenämning, t.ex. "402010 Förskollärare".' },
    { cat:'Struktur', term:'SKR', short:'Sveriges Kommuner och Regioner', long:'Arbetsgivarorganisationen för kommuner och regioner. Verktyget använder tre saker från SKR: yrkesindelningen AID, personalstatistiken (nationell andel kvinnor per yrke, visad som "Kvinnor nationellt" och som reserv i Likvärdigt arbete) och PO-påslaget 39,15 % som standardvärde i kostnadsberäkningen. Perioden för statistiken står i Om verktyget.' },
    { cat:'Struktur', term:'Yrkesgrupp', short:'Personer med samma AID-kod', long:'Den minsta jämförelsegruppen inom "lika arbete". Yrken med samma AID-kod jämförs mellan könen i Lika arbete.' },
    { cat:'Struktur', term:'Heltidsekvivalent (FTE) lön', short:'Lön omräknad till 100% tjänstgöring', long:'Den lön personen skulle ha haft vid heltidstjänst. Används för att rättvist jämföra deltids- och heltidsanställda. Verktyget förutsätter att månadslönerna i lönefilen redan är omräknade till heltid.' },

    // Verktyget
    { cat:'Verktyget', term:'Underlagets kvalitet', short:'Hur väl underlaget räcker för analysen — svagaste kriteriet avgör', long:'Fem kriterier: jämförbarhet (andel av personalen i BAS-intervall där båda könen har minst {k} personer), statistisk styrka (minsta könsskillnad analysen kan upptäcka), fullständighet (rader som föll bort vid inläsningen), rimlighet (orimliga löner, åldrar eller BAS) och modell (om regressionen kunde ta hänsyn till både ålder och BAS). Varje kriterium får OK, Varning eller Kritisk, och underlaget får samma status som det svagaste. Könsfördelningen i organisationen är ett fynd, inte ett kvalitetsmått.' },
    { cat:'Verktyget', term:'Prioriteringsindex', short:'Rangordningsmått 0-100 i Prioriteringen', long:'Kombinerar avvikelsens storlek (50%), gruppens volym (30%) och jämställdhetsläget (20%). Negativ avvikelse väger 2× tyngre än positiv, och bristyrken får en bonus på 1,2×. Används för att rangordna åtgärder i Prioriteringen.' },
    { cat:'Verktyget', term:'Nära pension', short:'Anställda som är 60 år eller äldre', long:'Personer i den här åldern kan gå i pension inom 0–7 år (riktåldersintervallet 60–67). Planera för att deras kunskap förs vidare. Verktyget markerar BAS-intervall där mer än 25 procent är 60 år eller äldre; över 15 procent: håll uppsikt.' },
    { cat:'Verktyget', term:'Brist på återväxt', short:'Låg andel anställda under 40 år', long:'När mindre än 15 % av gruppen är under 40 år. Det tyder på att få yngre anställs, alltså ett strukturellt problem i rekryteringen.' },
    { cat:'Verktyget', term:'Uppmärksamhetstrappa', short:'Coachande skala — var börjar jag titta?', long:'Verktyget rangordnar yrkesgrupper efter hur mycket de är värda att titta på — det är ett stöd för din bedömning, inte en dom. En skillnad mellan kvinnors och mäns lön bedöms med samma ord, färger och märken i alla flikar, och statusen bygger på statistisk signal: Värt att granska (skillnaden är statistiskt säkerställd och minst 3 %), Följ upp (minst 3 % men inte säkerställd, eller säkerställd men under 3 %), Balanserat (under 3 % och inte säkerställd) och Går ej att bedöma (för få av ett kön). 3 % är verktygets egen storleksgräns. Direktivets 5 % är ingen status utan en egen markering på den ojusterade skillnaden (se Direktivmarkering). Prioritering mäter något annat, löneläget mot er referens, och har egna ord (Börja här, Under referens, Nära referens, Över referens). En grupp som lyfts kan mycket väl ha sakliga skäl bakom skillnaden — det är det du väger.' },
    { cat:'Verktyget', term:'Börja här', short:'Tydlig avvikelse i en större grupp (Prioritering)', long:'I Prioritering: gruppens median ligger mer än granskningsgränsen (standard 5 %) under referensen, och gruppen har minst [standard 10] personer. Många berörda och en tydlig kostnad att nå referensen, så ett bra ställe att börja. Det är löneläget mot er referens, inte en skillnad mellan kvinnor och män. Gränserna ändrar du under Inställningar.' },
    { cat:'Verktyget', term:'Under referens', short:'Gruppens median under referensen (Prioritering)', long:'I Prioritering: gruppens median ligger mer än granskningsgränsen (standard 5 %) under referensen, i en grupp som är mindre än för Börja här. Det är löneläget mot er referens, inte en skillnad mellan kvinnor och män.' },
    { cat:'Verktyget', term:'Nära referens', short:'Gruppens median nära referensen (Prioritering)', long:'I Prioritering: gruppens median ligger nära referensen. Nära referens, under: mellan granskningsgränsen (standard −5 %) och uppföljningsgränsen (standard −2 %). Nära referens: från uppföljningsgränsen upp till gränsen för Över referens (standard +5 %). Två färger, samma ord. Det är löneläget mot er referens, inte en skillnad mellan kvinnor och män.' },
    { cat:'Verktyget', term:'Värt att granska', short:'Säkerställd skillnad på minst 3 %', long:'Skillnaden mellan kvinnors och mäns lön är statistiskt säkerställd — utanför slumpens gränser för gruppen, eller ett konfidensintervall som inte når 100 % — och minst 3 % (verktygets storleksgräns). Titta närmare och väg den mot sakliga skäl. Lämpar sig för en riktad titt på enskilda individer och deras sakliga skäl.' },
    { cat:'Verktyget', term:'Följ upp', short:'Minst 3 % men inte säkerställd, eller säkerställd under 3 %', long:'Skillnaden är minst 3 % men inte statistiskt säkerställd, eller säkerställd men under 3 %. Värt att hålla under uppsikt över tid för att se hur det utvecklas.' },
    { cat:'Verktyget', term:'Balanserat', short:'Under 3 % och inte säkerställd', long:'Skillnaden mellan kvinnors och mäns lön är under 3 % och inte statistiskt säkerställd. Inget som sticker ut.' },
    { cat:'Verktyget', term:'Går ej att bedöma', short:'För få av ett kön för att pröva skillnaden', long:'Ett av könen i gruppen har färre än {golv} personer. Skillnaden kan visas men inte prövas mot slumpen, så gruppen får ingen status. Bedöm gruppen på individnivå.' },
    { cat:'Verktyget', term:'Direktivmarkering', short:'Markeringen ≥ 5 % på den ojusterade löneskillnaden', long:'Direktivets regler om gemensam lönebedömning utgår från en skillnad på minst 5 %; markeringen visar var den nivån nås. Den är inte en bedömning. Den står på den ojusterade medianskillnaden (kvinnors median i procent av mäns) i Lika arbete, tabellerna per AID-kod och BAS-intervall, Lönestruktur, Excel och rapporten, aldrig på regressionens justerade tal, och den påverkar inte statusen.' },
    { cat:'Verktyget', term:'Läge i spannet', short:'Var en median ligger mot referensens P10–P90', long:'0 är referensens P10 och 100 dess P90; under 0 ligger medianen nedanför spannet och över 100 ovanför. Visas i Löneläget per yrkesgrupp, med ord: nedanför, i nedre delen, mitt i, i övre delen eller ovanför.' },
    { cat:'Verktyget', term:'Mönster', short:'Löneläget och statistiken mot ställningstagandet, tillsammans', long:'Ställningstagandet är referenspunkten. Ligger både löneläget och statistiken över det har ställningstagandet halkat efter marknaden; ligger bara löneläget över har organisationen gått före både politik och marknad.' },
    { cat:'Verktyget', term:'Över referens', short:'Gruppens median över referensen (Prioritering)', long:'I Prioritering: gruppens median ligger mer än gränsen för Över referens (standard 5 %) över referensen. Ett läge, ingen allvarlighetsgrad; dokumentera gärna varför. Det är löneläget mot er referens, inte en skillnad mellan kvinnor och män.' },
    { cat:'Verktyget', term:'Oförklarad skillnad per BAS-intervall', short:'Separata regressioner inom varje BAS-intervall', long:'För varje BAS-intervall med minst {golv} personer av varje kön körs en separat regression: log(lön) ~ kön + ålder. Visar var inom organisationen den oförklarade löneskillnaden är som störst.' },

    // GDPR
    { cat:'GDPR', term:'K-anonymitet', short:'Skydd mot återidentifiering i det som lämnar verktyget', long:'Verktygets eget skydd mot återidentifiering, som uttryck för uppgiftsminimering och inbyggt dataskydd enligt dataskyddsförordningen. På skärmen visas alla grupper. Det som lämnar verktyget — Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder, rapportunderlaget — redovisar inte lönemått för grupper med färre än {k} personer (minsta gruppstorlek, standard 10), och könsuppdelade mått bara när varje kön når den. Värdet ställs in under Inställningar och står i metodbilagan.' },
    { cat:'GDPR', term:'Uppgiftsminimering', short:'Behandla bara nödvändiga uppgifter (enligt dataskyddsförordningen)', long:'Personuppgifter ska vara adekvata, relevanta och begränsade till vad som är nödvändigt. Verktyget läser bara in godkända fält (BAS, yrke, lön och kön samt tre valfria: ålder, arbetsvärderingspoäng och AID:s kod för ledning och särskilda uppdrag) — anställningsnummer, namn, e-post och personnummer plockas inte upp ens om de finns i filen. Ålder behövs bara för åldersjusteringen och fliken Ålder & karriär; utan ålder körs analysen ändå.' },
    { cat:'GDPR', term:'Pseudonymisering', short:'Ersätt direkta identifierare med koder', long:'Direkta personidentifierare ersätts med löpnummer eller koder. Återmappning hålls separat. Möjliggör analys utan direkt återidentifiering. Rekommenderas innan lönefilen läses in.' },
    { cat:'GDPR', term:'Inbyggt dataskydd', short:'Dataskydd inbyggt från början (eng. privacy by design)', long:'Tekniska och organisatoriska åtgärder som standard. Verktyget har inbyggt dataskydd genom att allt körs bara lokalt (data lämnar aldrig enheten), CSP-spärrar mot nätverksanrop, k-anonymitet, att bara godkända fält läses och att filer med personidentifierare avvisas automatiskt.' },
    { cat:'GDPR', term:'Content Security Policy (CSP)', short:'Webbläsar-policy som blockerar nätverksanrop', long:'En meta-tagg i HTML-filen som instruerar webbläsaren att förbjuda alla utgående nätverksanslutningar (connect-src \'none\'). Hård teknisk spärr mot att data förs ut: även om en framtida bug skulle försöka göra fetch/XHR/WebSocket blockeras anropet.' },
    { cat:'GDPR', term:'Beräkning och urval', short:'Spårbarhet från lönefil till analys', long:'I flera analysflikar finns en panel "Beräkning och urval" som redovisar exakt hur många rader som ingår, vilka som exkluderats och varför. Möjliggör kvalitetssäkring och svar på frågan "Stämmer denna siffra?".' }
];

function _normalizeTerm(s) { return s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, ''); }

const STATISTIK_101 = `
<details class="bak-accent-yta ram-1-accent-kant rund-8 marg-0-0-14 pad-14-16" open>
    <summary class="farg-accent-mork pekare fs-md fw-700 pad-4-0 ej-markerbar">Statistik 101 — kort introduktion för icke-statistiker</summary>
    <div class="fs-md lh-1_7 marg-t-10">
        <h4 class="farg-accent-mork marg-10-0-4">Vad är medianvärde?</h4>
        <p>Sortera alla löner från lägst till högst. Mittersta värdet är medianen. Hälften tjänar mer, hälften mindre. Den påverkas mindre än medelvärdet av enstaka mycket höga löner.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är en löneskillnad?</h4>
        <p>Verktyget visar oftast kvinnors medianlön i procent av mäns: <strong>100 % betyder lika lön</strong>, 95 % att kvinnor tjänar 5 procent mindre. Löneskillnaden är samma tal räknat som skillnad (−5 %). Statusen Värt att granska kräver att skillnaden är statistiskt säkerställd och minst 3 % (verktygets storleksgräns); markeringen ≥ 5 % visar var den ojusterade skillnaden når den nivå som direktivets regler om gemensam lönebedömning utgår från. Lagen kräver att du analyserar varje skillnad.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Tre sorters löneskillnad (samma tre ord används i hela verktyget)</h4>
        <ol class="marg-6-0-0-18 pad-0">
            <li><strong>Rå (ojusterad) löneskillnad</strong>: ren skillnad i median mellan könen. Påverkas av att kvinnor och män ofta har olika ålder, BAS-intervall och yrke. Visar inte diskriminering i sig.</li>
            <li><strong>Åldersjusterad löneskillnad</strong>: samma jämförelse men vid <em>samma genomsnittsålder</em>. Räknar bort att det ena könet i snitt är äldre.</li>
            <li><strong>Oförklarad löneskillnad</strong>: det som blir kvar när verktyget räknat bort de variabler som valts i förklaringsmodellen, som standard <em>både ålder och BAS-intervall</em>. Det som <em>inte</em> kan förklaras av strukturella skillnader.</li>
        </ol>
        <p class="marg-6-0-0"><strong>Tumregel:</strong> krymper skillnaden mycket från (1) till (3) förklaras det mesta av struktur; står den kvar i (3) och är den statistiskt säkerställd finns en oförklarad skillnad som är värd att titta närmare på.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är en regression?</h4>
        <p>Föreställ dig att du frågar underlaget: "Hur mycket av lönen förklaras av varje faktor (kön, ålder, BAS-intervall) om de andra hålls konstanta?" Det är vad regression gör. Den isolerar köneffekten från åldersstrukturen och BAS-fördelningen.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad betyder p-värdet?</h4>
        <p>Svarar på frågan: om det i verkligheten inte fanns någon skillnad, hur ofta skulle slumpen ändå ge en så stor skillnad som den som syns? <strong>p &lt; 0,05</strong> = i färre än 5 fall av 100, det vanliga kravet för "statistiskt säkerställd". <strong>p &lt; 0,001</strong> = i färre än 1 fall av 1 000. Ett lågt p-värde säger att skillnaden är svår att förklara med slump — inte vad den beror på.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad är ett konfidensintervall (95 % KI)?</h4>
        <p>Intervallet visar hur osäker skattningen är. Upprepade man mätningen många gånger skulle 95 av 100 sådana intervall innehålla det verkliga värdet. <strong>Smalt intervall</strong> = säker skattning. <strong>Brett intervall</strong> = osäker (vanligen små grupper).</p>

        <h4 class="farg-accent-mork marg-14-0-4">Vad innebär statistisk och praktisk signifikans?</h4>
        <p>Vid stora urval kan även mycket små skillnader bli "statistiskt signifikanta". En skillnad på 0,3 % kan ha p &lt; 0,001 utan att vara värd en åtgärd i praktiken. Bedöm <strong>båda</strong>: är skillnaden statistiskt säkerställd <em>och</em> stor nog att spela roll? Verktyget kräver båda för statusen Värt att granska, med 3 % som egen storleksgräns; hur stor en skillnad måste vara för att betyda något i praktiken är din bedömning.</p>

        <h4 class="farg-accent-mork marg-14-0-4">Typiska siffror att jämföra mot</h4>
        <ul class="marg-6-0-0-18">
            <li><strong>Ojusterad löneskillnad i hela landet:</strong> 9,9 procent löneåret 2025; kvinnors lön är ungefär 90 procent av mäns (Medlingsinstitutet, <em>Löneskillnaden mellan kvinnor och män 2025</em>, rapport 2026)</li>
            <li><strong>Oförklarad löneskillnad i hela landet:</strong> 4,4 procent löneåret 2025, efter standardvägning för yrke, sektor, utbildning, ålder och arbetstid (samma rapport)</li>
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
        ? lista.filter(g => _normalizeTerm(g.term + ' ' + g.short + ' ' + g.long + ' ' + (g.sok || '')).includes(filter))
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
