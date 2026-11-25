// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Escaping-vakten: HTML som appen bygger av text får bara ta in värden som är säkra.
 *
 * Appen bygger sin HTML med mallsträngar som tilldelas innerHTML. Skyddet är att varje värde som kan komma ur en
 * inläst fil, ett organisationspaket, en konfigurationsfil, ett filnamn, en kolumnrubrik eller fritext går genom
 * esc() (src/lib/htmltext.js). CSP:n stoppar skript och händelsehanterare, så en miss ger
 * förfalskat innehåll, inte kodkörning (docs/dataskydd/riskanalys.md §7, A3). Vakten läser källtexten i src/app/
 * med en liten tokeniserare, utan att ladda appen; src/lib/ läses för att slå upp funktionerna som appen importerar
 * (libSomKalla). Importer och exporter läses med acorn, och ett namn slås upp via filens egen import, så att
 * utslaget inte beror på filordningen. Motorn står i tests/helpers/htmlmallar.js.
 *
 * Vad som prövas:
 *   - varje ${…} i en mallsträng vars fasta text har en HTML-tagg (<td, </p, <!--),
 *   - värdet som tilldelas .innerHTML/.outerHTML (= och +=) och som ges till insertAdjacentHTML och document.write,
 *   - strängkonkatenering där en strängliteral med en HTML-tagg står i en kedja med + ('<td>' + x + '</td>'),
 *   - intro, formula och footer i beräkningsbevisen (_evidenceFor…) och value på en rad med isHtml: true, som
 *     bevisrutan skriver som HTML.
 *
 * Ett värde godkänns om det är
 *   a. esc(…) (eller en .replace-kedja som tar hand om &, <, > och "), en vitlistad funktion (VITLISTA: ger alltid
 *      säker text eller färdig HTML, kontrollerad för hand) eller en genomskinlig funktion (GENOMSKINLIGA: säker när
 *      argumenten är säkra);
 *   b. en term (T.…), en konstant i VERSALER, en literal, ett tal (aritmetik, jämförelse, .length, .toFixed …) eller
 *      en egenskap vars namn bara bär tal (TALNAMN: n, antal, median …);
 *   c. ett villkor (?:, ||, ??, &&), en sammanfogning, en mallsträng eller en lista (.map(…).join(…), push) vars
 *      delar är säkra, rekursivt;
 *   d. ett namn vars värde är säkert enligt dataflödet: en lokal variabel (alla tilldelningar), en parameter (alla
 *      anrop, eller elementen i listan som .map går över), ett anrop (alla return). Dataflödet är fältkänsligt: för
 *      r.yrke följs bara den del av r som hamnar i HTML, genom objekt, listor, Map, mönster ({ a }, [a, b]) och
 *      ändringar som x.a = v och x.push(v). Ett globalt namn som inte är const (state-liknande) följs inte.
 * Det som är säkert men som vakten inte kan bevisa står i UNDANTAG nedan, med fil, uttryck och skäl. En post matchar
 * uttryckets text (blanktecken sammanslagna), aldrig ett radnummer, och en post som inte längre träffar något fäller
 * testet. Ett fynd anges som det uttryck längst in där beviset tog stopp, med skälet.
 *
 * Vad vakten INTE täcker:
 *   - HTML som byggs på annat sätt än med mallsträngar och +, till exempel en lista av strängar som slås ihop
 *     (['<li>', x].join('')) eller String.raw; DOMParser.parseFromString tar emot HTML som redan prövats här;
 *   - attributkontexten: esc() räcker i både text och citerade attribut, men vakten prövar inte att attributen är
 *     citerade, och inte heller värden i href, style eller händelseattribut (CSP:n stänger de två sista);
 *   - DOM-API:er som är säkra av sig själva (textContent, setAttribute) prövas inte; där behövs ingen escaping;
 *   - ändringar som vakten inte ser: genom ett annat namn för samma objekt (alias), Object.assign och
 *     destrukturerande tilldelning ([a, b] = …); en funktion som aldrig anropas räknas som säker;
 *   - en krets i dataflödet (en funktion som når sig själv) antas säker medan den prövas;
 *   - tokeniseraren förutsätter semikolon mellan satserna och känner igen ett reguljärt uttryck på tecknet före.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { granska, libSomKalla } from './helpers/htmlmallar.js';

const APP = join(import.meta.dirname, '..', 'src/app');
const LIB = 'src/lib';

// ---- Undantagen: säkra uttryck som vakten inte kan bevisa ----
// Varje post: filen, uttrycket som det står i källan (blanktecken spelar ingen roll) och varför det är säkert.

const UNDANTAG = [
    { fil: '27-berakningsbevis.js', uttryck: 'p.intro', skal: 'Bevisens intro byggs i _evidenceFor…, där vakten prövar det (provtypen bevis).' },
    { fil: '27-berakningsbevis.js', uttryck: 'p.formula', skal: 'Som intro: prövas där bevisen byggs.' },
    { fil: '27-berakningsbevis.js', uttryck: 'p.footer', skal: 'Som intro: prövas där bevisen byggs.' },
    { fil: '27-berakningsbevis.js', uttryck: 'r.value', skal: 'Ett värde med isHtml: true prövas där bevisen byggs; de andra går genom esc på samma rad.' },
    { fil: '10-diagramritare.js', uttryck: 'k.senast.html', skal: 'Sätts bara i _rfVidRorelse, till _rfTipsHtml(…), som escapar varje cell; behållaren är ett DOM-element som vakten inte följer.' },
    { fil: '61-regler-och-praxis.js', uttryck: 'li.dataset.fast', skal: 'Sätts på raden ovanför till li.innerHTML: sidans egen statiska HTML, sparad innan texten byts.' },
    { fil: '17-forhandskontroll.js', uttryck: 'v.niva', skal: "Förhandskontrollens nivå är 'fel' eller 'varning', skrivna som literaler i src/lib/forhandskontroll.js (varna(…))." },
    { fil: '58-rapportmodell.js', uttryck: '_rmMinne', skal: 'Minnet håller bara avsnitten från _rmAvsnittenUtanUrval(), som prövas i samma uttryck.' },
    { fil: '44-referensoverblick.js', uttryck: 'k.varde(g)', skal: "Kolumnerna i _rrKolumner: typen 'text' går genom esc(v) på raden nedanför; de andra typerna är tal (antal, kr, pct)." },
    { fil: '44-referensoverblick.js', uttryck: 'k.sortering(g)', skal: 'Sorteringsvärdena i _rrKolumner är tal (en rangordning eller lägets position) eller tom text.' },
    { fil: '70-utforska.js', uttryck: 'd.v(c)', skal: 'Kolumnernas v ger cellens mått (c.value, c.valueKv, c.valueMa): tal som modellen räknat fram.' },
    { fil: '19-konfiguration.js', uttryck: 'formatter(a)', skal: 'Formaterarna i jämförelsetabellen ger tal eller ögonblicksbildens fasta texter (UK_ETIKETT); bilden räknas i sessionen.' },
    { fil: '19-konfiguration.js', uttryck: 'formatter(b)', skal: 'Som formatter(a).' },
    { fil: '19-konfiguration.js', uttryck: 'formatter', skal: 'Som formatter(a): skickas till diff och anropas med en skillnad mellan två tal.' },
    { fil: '19-konfiguration.js', uttryck: 'cfg.likvardighet[f]', skal: 'Varje värde prövas på raden nedanför som ett ändligt tal inom fältets gränser innan det sparas; annars kastas fel.' },
    { fil: LIB, uttryck: '_forandring(f && f[m], n && n[m])', skal: 'm löper över ARSBOKSLUT_BAS_MATT (fasta måttnamn); vakten kan inte skilja dessa nycklar från radens bas.' },
];

// ---- Testerna ----

const appKallor = () => {
    const app = readdirSync(APP).filter(f => /^\d\d-.*\.js$/.test(f)).sort()
        .map(f => ({ namn: f, text: readFileSync(join(APP, f), 'utf8') }));
    // Importerna läses med acorn i granska (namnen slås upp via filens import) och i libSomKalla.
    return [...app.map(a => ({ namn: a.namn, src: a.text, prova: true })),
        { namn: LIB, src: libSomKalla(join(APP, '..', 'lib'), app.map(a => a.text)), prova: false }];
};

describe('escaping-vakten: värden i appens HTML går genom esc() eller är bevisat säkra', () => {
    const { resultat, fynd, oanvanda } = granska(appKallor(), UNDANTAG);
    it('varje uttryck i en HTML-mall, en HTML-sänka och en konkatenering med HTML är säkert', () => {
        expect(fynd.map(f => `${f.fil}:${f.rad} ${f.uttryck} (${f.skal})`)).toEqual([]);
    });
    it('varje post på undantagslistan träffar något, så att listan inte ruttnar', () => {
        expect(oanvanda.map(u => `${u.fil}: ${u.uttryck}`)).toEqual([]);
    });
    it('vakten hittar mallarna och sänkorna (inte noll)', () => {
        expect(resultat.filter(r => r.typ === 'mall').length).toBeGreaterThan(1500);
        expect(resultat.filter(r => r.typ === 'sänka').length).toBeGreaterThan(100);
    });
});

describe('escaping-vakten: självtest', () => {
    // En lista ur en inläst fil (JSON.parse) som ritas som tabellrader: yrket måste escapas.
    const prov = cell => `const esc = s => String(s);
function rita(el, rader) { el.innerHTML = rader.map(r => \`<td>${cell}</td>\`).join(''); }
rita(document.body, JSON.parse(text));`;
    it('fäller ett oskyddat ${r.yrke} i en HTML-mall och godkänner samma med esc', () => {
        expect(granska([{ namn: 'prov.js', src: prov('${r.yrke}') }]).fynd.map(f => f.uttryck)).toEqual(['JSON.parse(text)']);
        expect(granska([{ namn: 'prov.js', src: prov('${esc(r.yrke)}') }]).fynd).toEqual([]);
        expect(granska([{ namn: 'prov.js', src: prov('${r.yrke.length}') }]).fynd).toEqual([]);
    });
    it('följer en flerradig import och ger samma utslag i båda filordningarna', () => {
        // Två filer deklarerar etikett; b.js importerar den osäkra ur a.js över flera rader.
        const filer = [
            { namn: 'a.js', src: 'export function etikett(r) { return r.yrke; }' },
            { namn: 'c.js', src: 'const esc = s => String(s);\nexport function etikett(r) { return esc(r.yrke); }' },
            { namn: 'b.js', src: `import {
    etikett,
} from './a.js';
const rader = JSON.parse(text);
document.body.innerHTML = rader.map(r => \`<td>\${etikett(r)}</td>\`).join('');` },
        ];
        const utslag = kallor => granska(kallor).fynd.map(f => `${f.fil}:${f.rad} ${f.uttryck}`).sort();
        expect(utslag(filer)).toEqual(['b.js:4 JSON.parse(text)']);
        expect(utslag([...filer].reverse())).toEqual(utslag(filer));
    });
    it('fäller en undantagspost som inte träffar något', () => {
        const { fynd, oanvanda } = granska([{ namn: 'prov.js', src: prov('${esc(r.yrke)}') }], [{ fil: 'prov.js', uttryck: 'r.ort', skal: 'prov' }]);
        expect(fynd).toEqual([]);
        expect(oanvanda.map(u => u.uttryck)).toEqual(['r.ort']);
    });
});
