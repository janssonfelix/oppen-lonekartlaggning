// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Sökregistret: funktioner, avsnitt, dialoger och fält ----
/**
 * Det som sökfältet i sidhuvudet (87-sok.js) hittar utöver grupperna: varje avsnitt i flikarna, dialogerna och
 * fälten i Inställningar. Namnet är avsnittets rubrik (eller fältets etikett); synonymerna är orden en användare
 * kan tänkas skriva i stället. Söktexten jämförs mot namn och synonymer med _sokNorm, så versaler och accenter
 * spelar ingen roll.
 *
 * - `avsnitt`: id:t valet leder till (ett avsnitt, eller en knapp i Exportera); `flik` är fliken som visar det.
 * - `dialog`: dialogen valet öppnar, med fokus i `falt` om det finns. Valet byter inte flik; `flik` säger bara var
 *   inställningen främst gör skillnad.
 *
 * tests/sok-funktioner.test.js vaktar att varje avsnitt i index.html har en post och att varje post pekar på
 * något som finns. Ett nytt avsnitt får alltså en rad här.
 *
 * @type {{ namn: string, synonymer: string[], flik: string, avsnitt?: string, dialog?: 'installningar'|'ordlista'|'symboler'|'lagras', falt?: string }[]}
 */
const SOK_FUNKTIONER = [
    // Översikt
    { namn: 'Lönekartläggningsprocessen', synonymer: ['steg', 'process', 'arbetsgång', 'kom igång'], flik: 'dashboard', avsnitt: 'avsnitt-ov-process' },
    // Filer och kvalitet
    { namn: 'Demodata: litet eller stort demo (7 000 personer)', synonymer: ['demo', 'demodata', 'stort demo', 'exempeldata', 'prova', 'syntetisk data', '7000'], flik: 'filer', avsnitt: 'upload-demo-val' },
    { namn: 'Underlagets kvalitet', synonymer: ['datakvalitet', 'kontroll', 'saknas', 'extremvärden', 'outliers', 'avvikande löner', 'registerfel'], flik: 'filer', avsnitt: 'avsnitt-ov-kvalitet' },
    // Lönestruktur
    { namn: 'Representation per BAS-nivå', synonymer: ['segregering', 'andel kvinnor', 'könsfördelning'], flik: 'struktur', avsnitt: 'avsnitt-st-representation' },
    { namn: 'Var i lönefördelningen sitter gapet?', synonymer: ['kvartil', 'fjärdedel', 'percentil', 'klibbigt golv', 'glastak'], flik: 'struktur', avsnitt: 'avsnitt-st-fordelning' },
    { namn: 'Per sektor', synonymer: ['aid-huvudområde', 'huvudområde', 'yrkesområde'], flik: 'struktur', avsnitt: 'avsnitt-st-sektorer' },
    { namn: 'Var uppstår löneskillnaden?', synonymer: ['gapuppdelning', 'uppdelning', 'trappa', 'medellön'], flik: 'struktur', avsnitt: 'avsnitt-ov-gap' },
    { namn: 'EU 2023/970 — lönerapportmått', synonymer: ['eu-mått', 'direktiv', 'lönetransparensdirektivet', 'lönerapport', 'artikel 9', 'kvartil', 'fjärdedel', 'rörlig lön'], flik: 'struktur', avsnitt: 'avsnitt-st-eu' },
    { namn: 'Bakgrund', synonymer: ['könslönegap', 'samhällsnivå', 'lönestruktur'], flik: 'struktur', avsnitt: 'avsnitt-st-metod' },
    { namn: 'Lönegap per BAS-intervall', synonymer: ['skevhet', 'bas-skevhet', 'löneskillnad per nivå'], flik: 'struktur', avsnitt: 'avsnitt-ls-bas' },
    { namn: 'Könsfördelning per BAS-intervall', synonymer: ['kvinnodominerad', 'mansdominerad', '40 %', 'andel kvinnor'], flik: 'struktur', avsnitt: 'avsnitt-ls-kon' },
    { namn: 'Vad blir kvar av lönegapet?', synonymer: ['regression', 'oförklarat', 'oförklarad', 'kvar av gapet', 'oaxaca', 'justerat gap'], flik: 'struktur', avsnitt: 'avsnitt-ls-regression' },
    { namn: 'Så räknas det', synonymer: ['metod', 'beräkning', 'urval', 'bas-skevhet'], flik: 'struktur', avsnitt: 'avsnitt-sr-metod' },
    // Ålder & karriär
    { namn: 'Växer gapet med åldern?', synonymer: ['karriär', 'lönekurva', 'yrkesliv', 'livscykel'], flik: 'kon', avsnitt: 'avsnitt-ak-karriar' },
    { namn: 'Lönespridning över ålder', synonymer: ['percentilband', 'femårsgrupp', 'median'], flik: 'kon', avsnitt: 'avsnitt-ak-lon' },
    { namn: 'Lönefördelning för kvinnor och män', synonymer: ['låddiagram', 'histogram', 'spridning'], flik: 'kon', avsnitt: 'avsnitt-ak-fordelning' },
    { namn: 'Åldersstruktur', synonymer: ['återväxt', 'pension', 'pensionsavgångar', 'demografi'], flik: 'kon', avsnitt: 'avsnitt-ak-struktur' },
    { namn: 'Jämför alla BAS-intervall', synonymer: ['lön mot ålder', 'sida vid sida'], flik: 'kon', avsnitt: 'avsnitt-ak-alla' },
    { namn: 'Så räknas det', synonymer: ['metod', 'beräkning', 'urval', 'ålder'], flik: 'kon', avsnitt: 'avsnitt-ak-metod' },
    // Likvärdigt arbete
    { namn: 'Likvärdigt arbete per BAS-intervall', synonymer: ['klassning', 'kvinnodominerad', 'aid x bas'], flik: 'likvardighet', avsnitt: 'avsnitt-lv-aidbas' },
    { namn: 'Hierarkisk jämförelse', synonymer: ['lägre värderat', 'högre lön', 'hierarki'], flik: 'likvardighet', avsnitt: 'avsnitt-lv-hierarki' },
    { namn: 'Arbetsvärdering med poäng', synonymer: ['arbetsvärdering', 'poäng', 'krav', 'kravprofil'], flik: 'likvardighet', avsnitt: 'avsnitt-lv-poang' },
    { namn: 'Bakgrund', synonymer: ['osaklig', 'likvärdigt arbete'], flik: 'likvardighet', avsnitt: 'avsnitt-lv-metod' },
    // Lika arbete
    { namn: 'Kvinnor och män i samma yrkesgrupp', synonymer: ['lika arbete', 'yrkesgrupp', 'status'], flik: 'matrix', avsnitt: 'avsnitt-la-yrkesgrupper' },
    { namn: 'Personer att granska', synonymer: ['individ', 'enskilda löner', 'avvikande löner', 'under förväntad nivå'], flik: 'matrix', avsnitt: 'avsnitt-la-personer' },
    { namn: 'Lika arbete AID x BAS', synonymer: ['matris', 'slumpens gränser', 'median i procent'], flik: 'matrix', avsnitt: 'avsnitt-la-aidbas' },
    { namn: 'Analys på individnivå', synonymer: ['arbetslista', 'för litet', 'små grupper'], flik: 'matrix', avsnitt: 'avsnitt-la-individ' },
    { namn: 'Så räknas det', synonymer: ['metod', 'beräkning', 'begrepp', 'lika arbete'], flik: 'matrix', avsnitt: 'avsnitt-la-metod' },
    // Löneläget
    { namn: 'Överblick — löneläget och statistiken mot ställningstagandet', synonymer: ['löneläge', 'överblick'], flik: 'benchmark', avsnitt: 'avsnitt-jmf-overblick' },
    { namn: 'Mot ställningstagandet', synonymer: ['lönepolitik', 'bandkarta', 'spann', 'referens'], flik: 'benchmark', avsnitt: 'avsnitt-jmf-stallningstagande' },
    { namn: 'Mot jämförelsestatistiken', synonymer: ['statistik', 'marknad', 'p10', 'p90', 'benchmark'], flik: 'benchmark', avsnitt: 'avsnitt-jmf-statistik' },
    // Prioritering
    { namn: 'Åtgärdslistan', synonymer: ['prioritering', 'prioritet', 'börja här'], flik: 'prioritering', avsnitt: 'avsnitt-pr-lista' },
    { namn: 'Vad kostar det att åtgärda?', synonymer: ['kostnad', 'lyfta grupper'], flik: 'prioritering', avsnitt: 'avsnitt-pr-kostnad' },
    { namn: 'Så räknas det', synonymer: ['metod', 'beräkning', 'prioriteringsindex', 'viktning'], flik: 'prioritering', avsnitt: 'avsnitt-pr-metod' },
    // Löneöversyn
    { namn: 'Riktade potter', synonymer: ['pott', 'satsning', 'löneöversyn'], flik: 'loneoversyn', avsnitt: 'avsnitt-lo-riktade' },
    { namn: 'Avancerat & planering', synonymer: ['avrundning', 'stegvis plan', 'mål för gapet', 'marknadsläge'], flik: 'loneoversyn', avsnitt: 'avsnitt-lo-planering' },
    { namn: 'Individuell analys — lika arbete', synonymer: ['jämförelsevärde', 'lyfta kvinnor'], flik: 'loneoversyn', avsnitt: 'avsnitt-lo-individ' },
    { namn: 'Jämför scenarier (A/B)', synonymer: ['scenario', 'a/b'], flik: 'loneoversyn', avsnitt: 'avsnitt-lo-scenarier' },
    { namn: 'Så ska prognosen läsas', synonymer: ['prognos', 'planeringsunderlag', 'metod'], flik: 'loneoversyn', avsnitt: 'avsnitt-lo-metod' },
    // Regler & praxis
    { namn: '1. Lönesättningsprinciper & lönekriterier', synonymer: ['lönepolicy', 'kriterier', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-1' },
    { namn: '2. Lönerevisionsprocessen (löneöversyn)', synonymer: ['lönerevision', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-2' },
    { namn: '3. Rörlig lön, tillägg & förmåner', synonymer: ['bonus', 'tillägg', 'förmåner', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-3' },
    { namn: '4. Anställningsvillkor & arbetstid', synonymer: ['deltid', 'arbetstid', 'villkor', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-4' },
    { namn: '5. Praxis vid nyanställning & ingångslöner', synonymer: ['ingångslön', 'nyanställning', 'rekrytering', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-5' },
    { namn: '6. Praxis vid befordran & lönehöjning', synonymer: ['befordran', 'lönehöjning', 'karriär', 'bestämmelser'], flik: 'bestammelser', avsnitt: 'avsnitt-rp-6' },
    // Exportera
    { namn: 'Robusthet — står sig slutsatserna?', synonymer: ['känslighet', 'andra inställningar', 'robust'], flik: 'dokumentera', avsnitt: 'avsnitt-dk-robusthet' },
    { namn: 'Rapportens innehåll', synonymer: ['rapporturval', 'avsnitt i rapporten', 'ordning'], flik: 'dokumentera', avsnitt: 'avsnitt-ex-urval' },
    { namn: 'Word-utkast (dokumentation)', synonymer: ['word', 'docx', 'utkast', 'dokumentation'], flik: 'dokumentera', avsnitt: 'btn-export-docdraft' },
    { namn: 'PDF-rapport', synonymer: ['pdf', 'skriv ut', 'utskrift'], flik: 'dokumentera', avsnitt: 'btn-export-pdf' },
    { namn: 'Excel (alla flikar)', synonymer: ['excel', 'xlsx', 'kalkylblad'], flik: 'dokumentera', avsnitt: 'btn-export-all-excel' },
    { namn: 'ZIP', synonymer: ['zip', 'allt i en fil', 'diagrambilder'], flik: 'dokumentera', avsnitt: 'btn-export-zip' },
    { namn: 'Protokoll för gemensam lönebedömning', synonymer: ['gemensam lönebedömning', 'jpa', 'facklig', 'facket', 'protokoll'], flik: 'dokumentera', avsnitt: 'btn-hub-jpa' },
    { namn: 'Handlingsplansunderlag', synonymer: ['åtgärdslista', 'handlingsplan'], flik: 'dokumentera', avsnitt: 'btn-hub-handlingsplan' },
    // Rapporttext
    { namn: 'Auto-rapportutkast', synonymer: ['klarspråk', 'fynd', 'rapporttext', 'utkast'], flik: 'rapporttext', avsnitt: 'avsnitt-rt-utkast' },
    { namn: 'Rapportunderlag', synonymer: ['rapportmall', 'klistra in', 'kopiera'], flik: 'rapporttext', avsnitt: 'avsnitt-dk-rapportunderlag' },
    // Spara och jämför år
    { namn: 'Spara/ladda konfiguration', synonymer: ['konfiguration', 'spara', 'ladda', 'json', 'inställningsfil'], flik: 'arbetet', avsnitt: 'avsnitt-ar-konfiguration' },
    { namn: 'Jämför med en ögonblicksbild', synonymer: ['ögonblicksbild', 'snapshot', 'jämför inställningar', 'före efter'], flik: 'arbetet', avsnitt: 'avsnitt-ar-ogonblick' },
    { namn: 'Jämförelse med förra året', synonymer: ['årsjämförelse', 'förra året', 'fjolår', 'fjolåret', 'årsbokslut'], flik: 'arbetet', avsnitt: 'avsnitt-ar-arsjamforelse' },
    { namn: 'Självdiagnostik (testdata)', synonymer: ['självdiagnostik', 'testdata', 'syntetisk', 'kontrollera verktyget'], flik: 'arbetet', avsnitt: 'avsnitt-ar-diagnostik' },
    // Tabeller och egna vyer
    { namn: 'Löneöversikt — alla BAS-intervall', synonymer: ['tabell', 'lönenivåer', 'fast tabell'], flik: 'utforska', avsnitt: 'avsnitt-ut-oversikt' },
    { namn: 'Egna vyer', synonymer: ['pivot', 'egen tabell', 'eget diagram', 'utforska'], flik: 'utforska', avsnitt: 'avsnitt-ut-egna' },
    // Dialogerna
    { namn: 'Inställningar', synonymer: ['inställning', 'konfigurera'], flik: 'dashboard', dialog: 'installningar' },
    { namn: 'Ordlista', synonymer: ['begrepp', 'termer', 'ord', 'förklaring av ord'], flik: 'info', dialog: 'ordlista' },
    { namn: 'Förklaring av symboler och färger', synonymer: ['symboler', 'färger', 'ikoner', 'teckenförklaring'], flik: 'info', dialog: 'symboler' },
    { namn: 'Vad lagras?', synonymer: ['lagras', 'minnet', 'dataskydd', 'gdpr', 'personuppgifter'], flik: 'filer', dialog: 'lagras' },
    // Fälten i Inställningar
    { namn: 'Minsta gruppstorlek för redovisning', synonymer: ['minsta gruppstorlek', 'k', 'tröskel', 'anonymitet', 'tio personer'], flik: 'dokumentera', dialog: 'installningar', falt: 'k-troskel' },
    { namn: 'Organisationstyp', synonymer: ['organisationen är', 'offentlig', 'privat', 'sektor'], flik: 'filer', dialog: 'installningar', falt: 'org-typ' },
    { namn: 'Lönemånad', synonymer: ['månad', 'period', 'datum'], flik: 'filer', dialog: 'installningar', falt: 'lonemanad' },
    { namn: 'Beräkningsperiod', synonymer: ['månader', 'kostnad per år', 'helår'], flik: 'prioritering', dialog: 'installningar', falt: 'prio-cost-months' },
    { namn: 'PO-påslag', synonymer: ['personalomkostnad', 'lönekostnadspåslag', 'po', 'arbetsgivaravgift'], flik: 'prioritering', dialog: 'installningar', falt: 'prio-po-pct' },
    { namn: 'Prioriteringens trösklar', synonymer: ['granskningsgräns', 'uppföljningsgräns', 'gränser', 'trösklar'], flik: 'prioritering', dialog: 'installningar', falt: 'prio-cfg-atgard' },
    { namn: 'Kompakt läge', synonymer: ['kompakt', 'vägledande', 'läge', 'tätare'], flik: 'dashboard', dialog: 'installningar', falt: 'lage-kompakt' },
    { namn: 'Rensa all data', synonymer: ['rensa', 'ta bort data', 'radera', 'töm'], flik: 'filer', dialog: 'installningar', falt: 'btn-clear-all-data' }
];
