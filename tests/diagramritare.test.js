/**
 * Diagramkärnan på D3. Riggen laddar ÄKTA D3 ur vendor/,
 * så det som prövas här är riktig SVG — inte en stubb.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createAppWindow } from './helpers/app-harness.js';
import { ritfigurer } from './helpers/ritfigurer.js';
import { utanSmaGrupper, ladstatistik, talformat, figurTillTabell, valideraFigur, axelVarden } from '../src/lib/figur.js';

const sha = fil => createHash('sha256').update(readFileSync(fil)).digest('hex');

describe('D3 i bygget', () => {
    it('testriggen har äkta D3 7.9.0', () => {
        const w = createAppWindow();
        expect(w.__bootErr).toBeUndefined();
        expect(w.d3.version).toBe('7.9.0');
        expect(typeof w.d3.scaleBand).toBe('function');
        expect(w.d3.create('svg').node().namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
    it('vendor/d3.min.js är byte för byte npm-paketets fil och står i SHA256SUMS', () => {
        expect(sha('vendor/d3.min.js')).toBe(sha('node_modules/d3/dist/d3.min.js'));
        expect(readFileSync('vendor/SHA256SUMS', 'utf8')).toContain(`${sha('vendor/d3.min.js')}  d3.min.js`);
        expect(JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.d3).toBe('7.9.0');
    });
    it('index.html laddar D3 före app.js, och bundlern inlinar den', () => {
        const html = readFileSync('src/index.html', 'utf8');
        expect(html.indexOf('<script src="../vendor/d3.min.js"></script>')).toBeGreaterThan(0);
        expect(html.indexOf('../vendor/d3.min.js')).toBeLessThan(html.indexOf('../dist/app.js'));
        expect(readFileSync('tools/bundle.mjs', 'utf8')).toContain("'vendor/d3.min.js'");
    });
});

const w = createAppWindow();
const rita = (figur, bredd = 600, val = {}) => {
    w.__f = figur; w.__val = val;
    return w.eval(`_rfByggSvg(window.__f, ${bredd}, window.__val)`);
};
const alla = (svg, sel) => [...svg.querySelectorAll(sel)];
const tal = (el, a) => Number(el.getAttribute(a));
const staplar = (over = {}) => ({
    beskrivning: 'Medianlön per BAS och kön',
    x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
    lager: [
        { marke: 'stapel', serie: 'Kvinna', farg: '#e74c8b', data: [{ x: 'A', y: 30000 }, { x: 'B', y: 40000 }] },
        { marke: 'stapel', serie: 'Man', farg: '#0077bc', data: [{ x: 'A', y: 32000 }, { x: 'B', y: 20000 }] },
    ],
    ...over,
});

describe('ritaren: stomme och axlar', () => {
    it('svg:n är en grupp med beskrivningen; ytan är en bild utan egen beskrivning av figuren; förklaringen ligger utanför; inga style-element, klasser eller foreignObject', () => {
        const svg = rita(staplar(), 600, { hojd: 300 });
        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.getAttribute('role')).toBe('group');
        expect(svg.getAttribute('aria-label')).toBe('Medianlön per BAS och kön');
        expect(svg.getAttribute('width')).toBe('600');
        expect(svg.getAttribute('height')).toBe('300');
        expect(svg.getAttribute('viewBox')).toBe('0 0 600 300');
        const bild = svg.querySelector('g[role="img"]');
        expect(bild.getAttribute('aria-label')).toBe('Diagramyta');
        expect(alla(svg, '[data-marke]').every(e => bild.contains(e))).toBe(true);
        expect(alla(svg, '[data-serie]').length).toBe(2);
        expect(alla(svg, '[data-serie]').some(e => bild.contains(e))).toBe(false);
        expect(svg.querySelector('style, foreignObject')).toBeNull();
        expect(alla(svg, '[class], [style]')).toEqual([]);
        const text = ser(svg);
        expect(text).not.toMatch(/ id=/);       // inga id: id i inbäddad SVG är dokumentglobala (S2)
        expect(text).not.toContain('url(');
        expect(text).not.toMatch(/<(defs|clipPath|pattern)/);
        const doc = new w.DOMParser().parseFromString(text, 'image/svg+xml');
        expect(doc.querySelector('parsererror')).toBeNull();
    });
    it('samma figur och bredd ger identisk SVG', () => {
        const ser = s => new w.XMLSerializer().serializeToString(s);
        expect(ser(rita(staplar()))).toBe(ser(rita(staplar())));
    });
    it('inget attribut innehåller NaN, undefined eller null', () => {
        const svg = rita(staplar({ lager: [{ marke: 'stapel', data: [{ x: 'A', y: null }, { x: 'B', y: NaN }, { x: 'C', y: 5 }] }] }));
        for (const el of alla(svg, '*')) for (const a of el.attributes) expect(a.value, `${el.tagName} ${a.name}`).not.toMatch(/NaN|undefined|null/);
        expect(alla(svg, '[data-marke="stapel"]')).toHaveLength(1);
    });
    it('axeltitlar och markeringar; y-axelns tal utan enhet, svensk tusentalsavgränsning', () => {
        const svg = rita(staplar());
        const text = alla(svg, 'text').map(t => t.textContent.replace(/\s/g, ' '));
        expect(text).toContain('BAS');
        expect(text).toContain('Kronor/månad');
        expect(alla(svg, '[data-axel="x"]').map(t => t.textContent)).toEqual(['A', 'B']);
        const y = alla(svg, '[data-axel="y"]').map(t => t.textContent.replace(/\s/g, ' '));
        expect(y).toContain('0');
        expect(y.some(s => /^\d{2} 000$/.test(s))).toBe(true);
        expect(y.some(s => s.includes('kr'))).toBe(false);
    });
    it('förklaringen har en post per serie; legend: false tar bort den', () => {
        expect(alla(rita(staplar()), '[data-serie]').map(g => g.getAttribute('data-serie'))).toEqual(['Kvinna', 'Man']);
        expect(alla(rita(staplar({ legend: false })), '[data-serie]')).toEqual([]);
    });
    it('kategorinamn med markup hamnar som text', () => {
        const svg = rita(staplar({ lager: [{ marke: 'stapel', serie: '<b>Kv</b>', data: [{ x: '<img src=x onerror=1>', y: 1 }, { x: 'A & "B"', y: 2 }] }] }));
        expect(svg.querySelector('img, b')).toBeNull();
        expect(alla(svg, '[data-axel="x"]')[0].textContent.startsWith('<img')).toBe(true);
    });
    it('60 långa kategorinamn: etiketterna kortas, hela namnet i title, inget ritas utanför bredden', () => {
        const data = Array.from({ length: 60 }, (_, i) => ({ x: `Yrkesgrupp nummer ${i} med ett mycket långt namn`, y: i + 1 }));
        const svg = rita(staplar({ lager: [{ marke: 'stapel', data }] }), 500);
        const etiketter = alla(svg, '[data-axel="x"]');
        expect(etiketter.length).toBeGreaterThan(0);
        for (const t of etiketter) {
            expect(t.getAttribute('transform') || '').not.toMatch(/rotate/);
            expect(t.querySelector('title').textContent).toMatch(/^Yrkesgrupp nummer \d+ med ett mycket långt namn$/);
        }
        for (const r of alla(svg, '[data-marke="stapel"]')) {
            expect(tal(r, 'x')).toBeGreaterThanOrEqual(0);
            expect(tal(r, 'x') + tal(r, 'width')).toBeLessThanOrEqual(500);
        }
        const liggande = rita(staplar({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', data: data.map(d => ({ y: d.x, x: d.y })) }] }), 500);
        const forsta = alla(liggande, '[data-marke="stapel"]')[0];
        expect(tal(forsta, 'x')).toBeLessThan(250);   // marginalen för etiketter tar högst halva bredden
        expect(alla(liggande, '[data-axel="y"]')[0].childNodes[0].nodeValue.endsWith('…')).toBe(true);   // första noden är etiketten; <title> bär hela namnet
    });
});

describe('ritaren: stapel', () => {
    it('bredvid: två staplar per kategori, höjd i proportion till värdet, samma baslinje', () => {
        const svg = rita(staplar());
        const r = alla(svg, '[data-marke="stapel"]');
        expect(r).toHaveLength(4);
        expect(r.map(e => e.getAttribute('fill'))).toEqual(['#e74c8b', '#e74c8b', '#0077bc', '#0077bc']);
        const [kvA, kvB, maA] = r;
        expect(tal(kvB, 'height') / tal(kvA, 'height')).toBeCloseTo(40000 / 30000, 5);
        expect(tal(kvA, 'y') + tal(kvA, 'height')).toBeCloseTo(tal(kvB, 'y') + tal(kvB, 'height'), 5);
        expect(tal(maA, 'x')).toBeGreaterThan(tal(kvA, 'x'));                       // bredvid, inte ovanpå
        expect(tal(maA, 'x')).toBeLessThan(tal(kvB, 'x'));                          // samma kategori
        expect(kvA.getAttribute('data-l')).toBe('0');
        expect(kvB.getAttribute('data-i')).toBe('1');
    });
    it('staplad: andra lagret börjar där första slutar', () => {
        const f = staplar();
        f.lager.forEach(l => { l.lage = 'staplad'; });
        const [kvA, , maA] = alla(rita(f), '[data-marke="stapel"]');
        expect(tal(maA, 'x')).toBeCloseTo(tal(kvA, 'x'), 5);
        expect(tal(maA, 'y') + tal(maA, 'height')).toBeCloseTo(tal(kvA, 'y'), 5);
    });
    it('staplad med negativa värden: positiva uppåt och negativa nedåt, var för sig från nollan', () => {
        const lager = (serie, y1, y2) => ({ marke: 'stapel', lage: 'staplad', serie, data: [{ x: 'A', y: y1 }, { x: 'B', y: y2 }] });
        const svg = rita(staplar({ lager: [lager('P', 5, -3), lager('N', -3, -4)] }));
        const r = alla(svg, '[data-marke="stapel"]');
        const [pA, pB, nA, nB] = r;
        const kant = e => [tal(e, 'y'), tal(e, 'y') + tal(e, 'height')];
        // A: +5 uppåt från nollan, −3 nedåt från nollan (nollan = pAs underkant)
        const noll = kant(pA)[1];
        expect(kant(nA)[0]).toBeCloseTo(noll, 5);
        // B: −3 och −4 staplas nedåt: andra börjar där första slutar, ihop −7
        expect(kant(pB)[0]).toBeCloseTo(noll, 5);
        expect(kant(nB)[0]).toBeCloseTo(kant(pB)[1], 5);
        expect(tal(pB, 'height') / tal(nB, 'height')).toBeCloseTo(3 / 4, 5);
        // skalan når hela −7: den nedersta staplen slutar inte under diagrammets nederkant (x-axelns linje)
        const botten = tal(svg.querySelector('line[stroke="#94a3b8"]'), 'y1');
        expect(kant(nB)[1]).toBeLessThanOrEqual(botten + 1e-6);
    });
    it('liggande: bredden bär värdet; första kategorin överst', () => {
        const svg = rita(staplar({ x: { skala: 'linjar' }, y: { skala: 'band' },
            lager: [{ marke: 'stapel', riktning: 'liggande', data: [{ y: 'A', x: 10 }, { y: 'B', x: 30 }] }] }));
        const [a, b] = alla(svg, '[data-marke="stapel"]');
        expect(tal(b, 'width') / tal(a, 'width')).toBeCloseTo(3, 5);
        expect(tal(a, 'x')).toBeCloseTo(tal(b, 'x'), 5);
        expect(tal(a, 'y')).toBeLessThan(tal(b, 'y'));
    });
    it('negativa värden går åt andra hållet från nollan; etikett och felstapel ritas', () => {
        const svg = rita(staplar({ y: { skala: 'linjar', format: 'pct' }, lager: [{ marke: 'stapel', data: [
            { x: 'A', y: -4, etikett: '−4,0 %' }, { x: 'B', y: 6, etikett: '+6,0 %', fel: { lag: 3, hog: 9 } }] }] }));
        const [neg, pos] = alla(svg, '[data-marke="stapel"]');
        expect(tal(neg, 'y')).toBeCloseTo(tal(pos, 'y') + tal(pos, 'height'), 5);   // negativ börjar vid nollan
        expect(alla(svg, '[data-marke="etikett"]').map(t => t.textContent)).toEqual(['−4,0 %', '+6,0 %']);
        const fel = alla(svg, '[data-marke="fel"]');
        expect(fel).toHaveLength(1);
        expect(tal(fel[0], 'y1')).not.toBeCloseTo(tal(fel[0], 'y2'), 5);
    });
    it('överlagrad med bredd: smalare och centrerad i bandet', () => {
        const svg = rita(staplar({ lager: [
            { marke: 'stapel', lage: 'overlagrad', data: [{ x: 'A', y: 10 }] },
            { marke: 'stapel', lage: 'overlagrad', bredd: 0.5, data: [{ x: 'A', y: 5 }] },
        ] }));
        const [bred, smal] = alla(svg, '[data-marke="stapel"]');
        expect(tal(smal, 'width')).toBeCloseTo(tal(bred, 'width') / 2, 5);
        expect(tal(smal, 'x') + tal(smal, 'width') / 2).toBeCloseTo(tal(bred, 'x') + tal(bred, 'width') / 2, 5);
    });
});

describe('ritaren: punkt och linje', () => {
    const xy = lager => ({ beskrivning: 'b', x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Lön' }, lager });
    it('punkter: en cirkel per datapunkt; högre y ligger högre upp; storlek styr radien', () => {
        const svg = rita(xy([{ marke: 'punkt', serie: 'Anställda', data: [{ x: 25, y: 100 }, { x: 60, y: 300, storlek: 12 }, { x: 40, y: null }] }]));
        const c = alla(svg, 'circle[data-marke="punkt"]');
        expect(c).toHaveLength(2);
        expect(tal(c[1], 'cy')).toBeLessThan(tal(c[0], 'cy'));
        expect(tal(c[1], 'cx')).toBeGreaterThan(tal(c[0], 'cx'));
        expect(tal(c[1], 'r')).toBe(12);
        expect(c[1].getAttribute('data-i')).toBe('1');
    });
    it('punkter på bandskala: mitt i bandet, förskjutning flyttar inom bandet', () => {
        const svg = rita(staplar({ lager: [{ marke: 'punkt', data: [{ x: 'A', y: 1 }, { x: 'A', y: 2, forskjutning: 0.25 }, { x: 'B', y: 3 }] }] }));
        const [a, a2, b] = alla(svg, '[data-marke="punkt"]');
        expect(tal(a2, 'cx')).toBeGreaterThan(tal(a, 'cx'));
        expect(tal(a2, 'cx')).toBeLessThan(tal(b, 'cx'));
    });
    it('symbolerna streck och triangel ritas som path, inte cirkel', () => {
        const svg = rita(staplar({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [
            { marke: 'punkt', symbol: 'streck', data: [{ y: 'A', x: 5 }] },
            { marke: 'punkt', symbol: 'triangelVanster', data: [{ y: 'A', x: 2 }] },
            { marke: 'punkt', symbol: 'triangelHoger', data: [{ y: 'A', x: 8 }] },
        ] }));
        expect(alla(svg, 'circle[data-marke="punkt"]')).toHaveLength(0);
        expect(alla(svg, '[data-marke="punkt"]')).toHaveLength(3);
    });
    it('linje: en path per lager; null bryter linjen; streckad och monoton', () => {
        const svg = rita(xy([
            { marke: 'linje', serie: 'P50', streck: 'streckad', kurva: 'monoton', data: [{ x: 10, y: 1 }, { x: 20, y: 3 }, { x: 30, y: 2 }, { x: 40, y: null }, { x: 50, y: 4 }, { x: 60, y: 5 }] },
        ]));
        const p = alla(svg, 'path[data-marke="linje"]');
        expect(p).toHaveLength(1);
        expect(p[0].getAttribute('fill')).toBe('none');
        expect(p[0].getAttribute('stroke-dasharray')).toBe('6 4');
        expect((p[0].getAttribute('d').match(/M/g) || []).length).toBe(2);    // två delar
        expect(p[0].getAttribute('d')).toContain('C');                         // kurva, inte raka segment
    });
    it('linje med tips får träffytor per punkt', () => {
        const svg = rita(xy([{ marke: 'linje', serie: 'P50', tips: d => [[String(d.x)]], data: [{ x: 20, y: 1 }, { x: 30, y: null }, { x: 40, y: 3 }] }]));
        expect(alla(svg, '[data-marke="linjepunkt"]').map(e => e.getAttribute('data-i'))).toEqual(['0', '2']);
    });
    it('logaritmisk axel och omvänd axel', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'log' },
            lager: [{ marke: 'punkt', data: [{ x: 1, y: 10 }, { x: 2, y: 100 }, { x: 3, y: 1000 }] }] });
        const c = alla(svg, '[data-marke="punkt"]');
        expect(tal(c[0], 'cy') - tal(c[1], 'cy')).toBeCloseTo(tal(c[1], 'cy') - tal(c[2], 'cy'), 3);   // lika steg per tiopotens
        const omv = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar', omvand: true }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 1 }, { x: 2, y: 9 }] }] });
        const o = alla(omv, '[data-marke="punkt"]');
        expect(tal(o[1], 'cy')).toBeGreaterThan(tal(o[0], 'cy'));
    });
});

describe('ritaren: stora punktmoln', () => {
    it('fler punkter än SCATTER_MAX_POINTS nedsamplas jämnt; data-i pekar på originalets index; antalet anges', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max * 3 }, (_, i) => ({ x: i, y: i % 100 }));
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        const p = alla(svg, '[data-marke="punkt"]');
        expect(p.length).toBe(max);
        expect(p[1].getAttribute('data-i')).toBe('3');
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${max}/${max * 3}`);
        expect(rita(staplar()).getAttribute('data-nedsamplat')).toBeNull();
    });
});

describe('ritaren: små grupper', () => {
    it('ritas inte utan visaSma — varken märket eller dess etikett på axeln', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 1 }, { x: 'Liten', y: 2, liten: true }] }] });
        const svg = rita(f);
        expect(alla(svg, '[data-marke="stapel"]')).toHaveLength(1);
        expect(alla(svg, '[data-axel="x"]').map(t => t.textContent)).toEqual(['A']);
        expect(new w.XMLSerializer().serializeToString(svg)).not.toContain('Liten');
    });
    it('med visaSma ritas de, markerade med mer än färg', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'Alla', farg: '#2563eb', data: [{ x: 'A', y: 1 }, { x: 'Liten', y: 2, liten: true }] }] });
        const svg = rita(f, 600, { visaSma: true });
        const [stor, liten] = alla(svg, '[data-marke="stapel"]');
        expect(liten.getAttribute('fill')).toBe('#2563eb');                      // samma färg …
        expect(liten.getAttribute('stroke-dasharray')).toBeTruthy();             // … plus streckad kant
        expect(stor.getAttribute('stroke-dasharray')).toBeNull();
        expect(svg.querySelector('svg[data-marke="rander"] line')).not.toBeNull();   // … och ränder (verkliga streck, inget mönster)
        expect(alla(svg, '[data-marke="rander"]')).toHaveLength(1);
        const p = rita(staplar({ lager: [{ marke: 'punkt', data: [{ x: 'A', y: 1, liten: true }] }] }), 600, { visaSma: true });
        expect(alla(p, '[data-marke="punkt"]')[0].getAttribute('stroke-dasharray')).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------------------------
// Rättningsomgång 1 (R1–R11)
// ---------------------------------------------------------------------------------------------
const NF = 0.58;
const ser = s => new w.XMLSerializer().serializeToString(s);
const texten = t => [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('');
// Textens uppskattade ruta i SVG:ns koordinater: samma teckenbredd som ritaren, translate från föräldrarna,
// translate + rotate(±90) på texten själv.
function textRuta(t) {
    let ox = 0, oy = 0;
    for (let n = t.parentNode; n && n.getAttribute; n = n.parentNode) {
        const m = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(n.getAttribute('transform') || '');
        if (m) { ox += +m[1]; oy += +m[2]; }
    }
    const px = tal(t, 'font-size');
    const br = texten(t).length * px * NF;
    const tf = t.getAttribute('transform') || '';
    const tm = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(tf);
    const rot = /rotate\((-?90)\)/.exec(tf);
    const x = ox + (tm ? +tm[1] : 0) + tal(t, 'x'), y = oy + (tm ? +tm[2] : 0) + tal(t, 'y');
    const a = t.getAttribute('text-anchor') || 'start';
    if (!rot) {
        const x0 = a === 'end' ? x - br : a === 'middle' ? x - br / 2 : x;
        return { x0, x1: x0 + br, y0: y - px * 0.8, y1: y + px * 0.25 };
    }
    const upp = rot[1] === '-90';
    const f = upp ? { start: [-br, 0], end: [0, br], middle: [-br / 2, br / 2] } : { start: [0, br], end: [-br, 0], middle: [-br / 2, br / 2] };
    const [d0, d1] = f[a];
    return upp ? { x0: x - px * 0.8, x1: x + px * 0.25, y0: y + d0, y1: y + d1 } : { x0: x - px * 0.25, x1: x + px * 0.8, y0: y + d0, y1: y + d1 };
}
const tom = (a, b) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
function kontrolleraYta(svg, namn) {
    const B = tal(svg, 'width'), H = tal(svg, 'height');
    const fel = [];
    for (const t of alla(svg, 'text')) {
        const r = textRuta(t);
        if (r.x0 < -0.01 || r.y0 < -0.01 || r.x1 > B + 0.01 || r.y1 > H + 0.01) fel.push(`${namn}: "${texten(t)}" utanför (${r.x0.toFixed(1)}..${r.x1.toFixed(1)} × ${r.y0.toFixed(1)}..${r.y1.toFixed(1)} i ${B}×${H})`);
    }
    // Markeringar och stapeletiketter: inga två texter på samma axel eller etiketter överlappar varandra eller markeringarna.
    const grupper = [...['x', 'y', 'y2'].map(ax => alla(svg, `text[data-axel="${ax}"]`)), alla(svg, 'text[data-axel], text[data-marke="etikett"]')];
    for (const ts of grupper) {
        for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
            if (tom(textRuta(ts[i]), textRuta(ts[j]))) fel.push(`${namn}: "${texten(ts[i])}" och "${texten(ts[j])}" överlappar`);
        }
    }
    // Zonernas etiketter (V1): ingen får ligga över en annan text — vilken som helst.
    for (const z of alla(svg, 'text[data-marke="zonetikett"]')) {
        for (const t of alla(svg, 'text')) {
            if (t !== z && tom(textRuta(z), textRuta(t))) fel.push(`${namn}: zonetiketten "${texten(z)}" och "${texten(t)}" överlappar`);
        }
    }
    return fel;
}
const kat = n => Array.from({ length: n }, (_, i) => `Yrkesgrupp nummer ${i} med ett mycket långt namn`);
const ytfigurer = () => {
    const bar = (data, extra = {}) => ({ beskrivning: 'b', x: { skala: 'linjar', titel: 'Skillnad', format: 'pct' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', serie: 'S', data }], ...extra });
    return [
        ['staplar 600', staplar(), 600, {}],
        ['staplar 320', staplar(), 320, {}],
        ['liggande med etiketter och negativa', bar([{ y: 'Undersköterska, äldreomsorg', x: -6.2, etikett: '−6,2 %' }, { y: 'Förskollärare', x: 1.4, etikett: '+1,4 %' }, { y: 'Systemutvecklare', x: 7.5, etikett: '+7,5 %' }]), 640, {}],
        ['liggande med etiketter 320', bar([{ y: 'Undersköterska, äldreomsorg', x: -6.2, etikett: '−6,2 % (n = 120)' }, { y: 'Systemutvecklare', x: 7.5, etikett: '+7,5 % (n = 80)' }]), 320, {}],
        ['stående med etiketter och negativa', staplar({ y: { skala: 'linjar', titel: 'Förändring', format: 'pct', nollinje: true }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: -4, etikett: '−4,0 %' }, { x: 'B', y: 6, etikett: '+6,0 %' }, { x: 'C', y: 7.5, etikett: '+7,5 %' }] }] }), 600, {}],
        ['spridning med domän som slutar på en markering', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Lön', format: 'kr' }, y: { skala: 'linjar', titel: 'Ålder' }, lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 0, y: 20 }, { x: 100000, y: 60 }] }] }, 600, {}],
        ['spridning smal', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Lön', format: 'kr' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data: [{ x: 0, y: 20 }, { x: 2500000, y: 60 }] }] }, 320, {}],
        ['logaritmisk y', { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'log', titel: 'Log' }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 10 }, { x: 2, y: 1000 }] }] }, 600, { hojd: 320 }],
        ['logaritmisk x', { beskrivning: 'b', x: { skala: 'log' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 10 }, { x: 5000, y: 1000 }] }] }, 420, {}],
        ['60 kategorier 420', staplar({ lager: [{ marke: 'stapel', data: kat(60).map((x, i) => ({ x, y: i + 1 })) }] }), 420, {}],
        ['500 kategorier 320', staplar({ lager: [{ marke: 'stapel', data: kat(500).map((x, i) => ({ x, y: i + 1 })) }] }), 320, {}],
        ['60 liggande kategorier', bar(kat(60).map((y, i) => ({ y, x: i + 1 }))), 500, {}],
        ['40 serier 320', staplar({ lager: Array.from({ length: 40 }, (_, i) => ({ marke: 'stapel', serie: `Serie nummer ${i}`, data: [{ x: 'A', y: i + 1 }] })) }), 320, {}],
        ['40 serier 600', staplar({ lager: Array.from({ length: 40 }, (_, i) => ({ marke: 'stapel', serie: `Serie nummer ${i}`, data: [{ x: 'A', y: i + 1 }] })) }), 600, {}],
        ['långa titlar och not', staplar({ x: { skala: 'band', titel: 'T'.repeat(300) }, y: { skala: 'linjar', titel: 'Y'.repeat(300) } }), 320, { not: 'En mycket lång not som förklarar urvalet och tröskeln på flera rader '.repeat(6) }],
        ['två paneler', staplar({ paneler: ['Kvinna', 'Man'], x: { skala: 'band', titel: 'BAS' }, lager: [{ marke: 'stapel', panel: 'Kvinna', serie: 'K', data: [{ x: 'A', y: 1 }, { x: 'B', y: 3 }] }, { marke: 'stapel', panel: 'Man', serie: 'M', data: [{ x: 'A', y: 2 }, { x: 'B', y: 2 }] }] }), 500, {}],
        ['två paneler med tal på x', { beskrivning: 'b', x: { skala: 'linjar', format: 'kr' }, y: { skala: 'linjar' }, paneler: ['Kvinna', 'Man'], lager: [{ marke: 'punkt', panel: 'Kvinna', data: [{ x: 0, y: 1 }, { x: 100000, y: 3 }] }, { marke: 'punkt', panel: 'Man', data: [{ x: 0, y: 1 }, { x: 100000, y: 3 }] }] }, 500, {}],
        ['domän smalare än data', staplar({ y: { skala: 'linjar', doman: [10, 20] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 5, etikett: 'lågt' }, { x: 'B', y: 15, etikett: 'mitt' }, { x: 'C', y: 100, etikett: 'högt' }] }] }), 600, {}],
        ['16 stående staplar med etiketter 600', staplar({ y: { skala: 'linjar', format: 'kr' }, lager: [{ marke: 'stapel', serie: 'S', data: Array.from({ length: 16 }, (_, i) => ({ x: `Kat ${i}`, y: 30000 + ((i * 7) % 5) * 2500, etikett: `${30000 + ((i * 7) % 5) * 2500} kr` })) }] }), 600, {}],
        ['60 liggande staplar med etiketter 420', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Värde' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', serie: 'S', data: kat(60).map((y, i) => ({ y, x: i + 1, etikett: `${i + 1} st` })) }] }, 420, {}],
        ['staplad med etiketter i segmenten', staplar({ y: { skala: 'linjar', titel: 'Antal' }, lager: [{ marke: 'stapel', lage: 'staplad', serie: 'Låg', data: [{ x: 'A', y: 10, etikett: '10' }, { x: 'B', y: 1, etikett: '1 st' }] }, { marke: 'stapel', lage: 'staplad', serie: 'Hög', data: [{ x: 'A', y: 20, etikett: '20' }, { x: 'B', y: 25, etikett: '25' }] }] }), 500, {}],
        ['staplad liggande med etiketter', { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', lage: 'staplad', serie: 'A', data: [{ y: 'P', x: 30, etikett: 'trettio' }, { y: 'Q', x: 2, etikett: 'två' }] }, { marke: 'stapel', riktning: 'liggande', lage: 'staplad', serie: 'B', data: [{ y: 'P', x: 40, etikett: 'fyrtio' }, { y: 'Q', x: 50, etikett: 'femtio' }] }] }, 500, {}],
        ['högre axel', staplar({ y2: { skala: 'linjar', titel: 'Antal', format: 'antal' }, lager: [...staplar().lager, { marke: 'linje', axel: 'y2', serie: 'N', data: [{ x: 'A', y: 5 }, { x: 'B', y: 1500000 }] }] }), 600, {}],
    ];
};

describe('R5: text innanför bilden och utan överlapp', () => {
    for (const [namn, f, b, v] of ytfigurer()) {
        it(`${namn}: ingen text utanför bilden, inga överlappande markeringar`, () => {
            expect(kontrolleraYta(rita(f, b, v), namn)).toEqual([]);
        });
    }
    it('avstånd på minst 10 px mellan axeltexten och förklaringens första rad, med och utan x-titel', () => {
        for (const titel of ['BAS', undefined]) {
            const svg = rita(staplar({ x: { skala: 'band', titel } }), 600);
            const axel = alla(svg, 'text').filter(t => !t.closest('[data-serie]') && (t.hasAttribute('data-axel') || texten(t) === titel)).map(textRuta);
            const lagsta = Math.max(...axel.map(r => r.y1));
            const legend = alla(svg, '[data-serie]').map(g => { const m = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(g.getAttribute('transform')); return +m[2]; });
            const overkant = Math.min(...legend) - Math.max(10, 0.8 * 12);
            expect(overkant - lagsta, `titel ${titel}`).toBeGreaterThanOrEqual(10 - 0.01);
        }
    });
    it('60 kategorier på 420 px och 500 på 320: varje visad etikett har minst 8 tecken', () => {
        for (const [n, b] of [[60, 420], [500, 320]]) {
            const svg = rita(staplar({ lager: [{ marke: 'stapel', data: kat(n).map((x, i) => ({ x, y: i + 1 })) }] }), b);
            const et = alla(svg, '[data-axel="x"]');
            expect(et.length).toBeGreaterThan(0);
            for (const t of et) expect(texten(t).length, texten(t)).toBeGreaterThanOrEqual(8);
        }
    });
    it('tal på axlarna kortas aldrig med …; ryms inte ett tal hoppas det över', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar', format: 'kr' }, y: { skala: 'linjar', format: 'kr' }, lager: [{ marke: 'punkt', data: [{ x: 0, y: 0 }, { x: 2.5e9, y: 2.5e9 }] }] }, 200);
        for (const t of alla(svg, '[data-axel]')) expect(texten(t)).not.toContain('…');
    });
    it('logaritmisk axel 10..1000 på 240 px: etiketterna ligger minst en textrad isär', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'log' }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 10 }, { x: 2, y: 1000 }] }] }, 600, { hojd: 320 });
        const ys = alla(svg, '[data-axel="y"]').map(t => tal(t, 'y')).sort((a, b) => a - b);
        expect(ys.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(12);
        expect(alla(svg, '[data-axel="y"]').map(texten)).toEqual(expect.arrayContaining(['10', '100', '1 000'].map(s => expect.stringMatching(new RegExp('^' + s.replace(' ', '\\s') + '$')))));
    });
    it('logaritmisk axel utan format: decimaler per markering (0,01 / 1 / 100), inte "100,00"', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'log' }, lager: [{ marke: 'punkt', data: [0.01, 1, 100, 10000].map((y, i) => ({ x: i, y })) }] }, 600, { hojd: 400 });
        const y = alla(svg, '[data-axel="y"]').map(texten);
        expect(y.some(s => /,\d/.test(s) && !s.startsWith('0,'))).toBe(false);
        expect(y).toContain('0,01');
    });
    it('axel utan format: små tal ger skilda etiketter med decimalkomma', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 0.001 }, { x: 2, y: 0.005 }] }] });
        const y = alla(svg, '[data-axel="y"]').map(texten);
        expect(new Set(y).size).toBe(y.length);
        expect(y.some(s => s.includes(','))).toBe(true);
        expect(y).not.toContain('0,0');
    });
});

describe('R1: data-l och data-i pekar på figuren som skickades in', () => {
    it('A, Liten, B: stapeln för A har data-i 1 (den lilla ritas inte)', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'Liten', y: 9, liten: true }, { x: 'A', y: 1 }, { x: 'B', y: 2 }] }] });
        const r = alla(rita(f), '[data-marke="stapel"]');
        expect(r.map(e => e.getAttribute('data-i'))).toEqual(['1', '2']);
    });
    it('ett lager som tömts av filtreringen framför ett annat: det andra behåller data-l 1', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'Tom', data: [{ x: 'A', y: 1, liten: true }] }, { marke: 'stapel', serie: 'Kvar', data: [{ x: 'A', y: 2 }] }] });
        const r = alla(rita(f), '[data-marke="stapel"]');
        expect(r).toHaveLength(1);
        expect(r[0].getAttribute('data-l')).toBe('1');
    });
    it('standardfärgen för ett ofärgat lager är densamma med och utan visaSma', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'Tom', data: [{ x: 'A', y: 1, liten: true }] }, { marke: 'stapel', serie: 'Kvar', data: [{ x: 'A', y: 2 }] }] });
        const utan = alla(rita(f), '[data-marke="stapel"]')[0].getAttribute('fill');
        const med = alla(rita(f, 600, { visaSma: true }), '[data-marke="stapel"]')[1].getAttribute('fill');
        expect(utan).toBe(med);
    });
    it('linje över [p0, liten, p2] utan visaSma är ett enda segment; träffytorna bär data-i 0 och 2', () => {
        const f = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'linje', serie: 'L', tips: d => [[String(d.x)]], data: [{ x: 1, y: 1 }, { x: 2, y: 5, liten: true }, { x: 3, y: 2 }] }] };
        const svg = rita(f);
        expect((alla(svg, 'path[data-marke="linje"]')[0].getAttribute('d').match(/M/g) || []).length).toBe(1);
        expect(alla(svg, '[data-marke="linjepunkt"]').map(e => e.getAttribute('data-i'))).toEqual(['0', '2']);
    });
});

describe('R2–R4: paneler, förklaring och märken för små grupper', () => {
    it('en panel vars data alla är små ritas inte, varken titel eller yta', () => {
        const f = staplar({ paneler: ['Kvinna', 'HemligPanel'], lager: [{ marke: 'stapel', panel: 'Kvinna', serie: 'K', data: [{ x: 'A', y: 1 }] }, { marke: 'stapel', panel: 'HemligPanel', serie: 'H', data: [{ x: 'A', y: 2, liten: true }] }] });
        const svg = rita(f);
        expect(ser(svg)).not.toContain('HemligPanel');
        expect(alla(svg, 'svg[data-del="panel"]')).toHaveLength(1);
        expect(ser(rita(f, 600, { visaSma: true }))).toContain('HemligPanel');
    });
    it('om ingen panel återstår ges ändå en giltig SVG utan NaN', () => {
        const f = staplar({ paneler: ['H'], lager: [{ marke: 'stapel', panel: 'H', serie: 'H', data: [{ x: 'A', y: 2, liten: true }] }] });
        const svg = rita(f);
        expect(alla(svg, '[data-marke]')).toHaveLength(0);
        for (const el of alla(svg, '*')) for (const a of el.attributes) expect(a.value, `${el.tagName} ${a.name}`).not.toMatch(/NaN|undefined|null/);
    });
    it('döljs alla serier finns alla förklaringsposter kvar (nedtonade)', () => {
        const svg = rita(staplar(), 600, { dolda: new Set(['Kvinna', 'Man']) });
        const g = alla(svg, '[data-serie]');
        expect(g.map(e => e.getAttribute('data-serie'))).toEqual(['Kvinna', 'Man']);
        expect(g.every(e => e.getAttribute('aria-pressed') === 'false')).toBe(true);
        expect(alla(svg, '[data-marke]')).toHaveLength(0);
    });
    it('små punkter på en linje får ett ihåligt, streckat märke med visaSma — och inget utan', () => {
        const f = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'linje', serie: 'L', data: [{ x: 1, y: 1 }, { x: 2, y: 5, liten: true }, { x: 3, y: 2 }] }] };
        const m = alla(rita(f, 600, { visaSma: true }), '[data-marke="litenpunkt"]');
        expect(m).toHaveLength(1);
        expect(m[0].getAttribute('data-i')).toBe('1');
        expect(m[0].getAttribute('fill')).toBe('none');
        expect(m[0].getAttribute('stroke-dasharray')).toBeTruthy();
        expect(alla(rita(f), '[data-marke="litenpunkt"]')).toHaveLength(0);
    });
    it('streck och triangel behåller seriens färg när de är små och får streckad kant', () => {
        const f = staplar({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [
            { marke: 'punkt', symbol: 'streck', farg: '#123456', data: [{ y: 'A', x: 5, liten: true }] },
            { marke: 'punkt', symbol: 'triangelVanster', farg: '#654321', data: [{ y: 'A', x: 2, liten: true }] },
        ] });
        const [streck, tri] = alla(rita(f, 600, { visaSma: true }), '[data-marke="punkt"]');
        expect(streck.getAttribute('stroke')).toBe('#123456');
        expect(streck.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(tri.getAttribute('fill')).toBe('#654321');
        expect(tri.getAttribute('stroke-dasharray')).toBeTruthy();
    });
});

describe('R6: förklaring och texter är begränsade', () => {
    const manga = n => staplar({ lager: Array.from({ length: n }, (_, i) => ({ marke: 'stapel', serie: `Serie nummer ${i}`, data: [{ x: 'A', y: i + 1 }] })) });
    it('ett 200 tecken långt serienamn kortas till högst 36 tecken och bär hela namnet i title', () => {
        const namn = 'X'.repeat(200);
        const svg = rita(staplar({ lager: [{ marke: 'stapel', serie: namn, data: [{ x: 'A', y: 1 }] }] }), 320);
        const g = alla(svg, '[data-serie]')[0];
        expect(g.getAttribute('data-serie')).toBe(namn);
        const t = g.querySelector('text');
        expect(texten(t).length).toBeLessThanOrEqual(36);
        expect(texten(t).endsWith('…')).toBe(true);
        expect(t.querySelector('title').textContent).toBe(namn);
        expect(kontrolleraYta(svg, 'lång serie')).toEqual([]);
    });
    for (const b of [320, 600]) {
        it(`40 serier på ${b} px: högst fyra rader, "+ N till", ytan minst 120 px hög`, () => {
            const svg = rita(manga(40), b);
            const g = alla(svg, '[data-serie]');
            expect(g.length).toBeLessThan(40);
            const rader = new Set(g.map(e => /,([-\d.e]+)\)/.exec(e.getAttribute('transform'))[1]));
            expect(rader.size).toBeLessThanOrEqual(4);
            const fler = alla(svg, '[data-legend="fler"]');
            expect(fler).toHaveLength(1);
            expect(texten(fler[0])).toBe(`+ ${40 - g.length} till`);
            expect(fler[0].getAttribute('role')).toBeNull();
            expect(tal(svg.querySelector('svg[data-del="panel"]'), 'height')).toBeGreaterThanOrEqual(120);
            expect(kontrolleraYta(svg, 'många serier')).toEqual([]);
        });
    }
    it('en lång not radbryts på högst två rader och ryms i bilden', () => {
        const svg = rita(staplar(), 320, { not: 'Ett urval av punkterna visas i diagrammet och tröskeln är sänkt från standardvärdet tio till sex. '.repeat(5) });
        const rader = alla(svg, 'text').filter(t => t.getAttribute('fill') === '#b91c1c');
        expect(rader.length).toBeGreaterThanOrEqual(1);
        expect(rader.length).toBeLessThanOrEqual(2);
        expect(kontrolleraYta(svg, 'not')).toEqual([]);
    });
    it('axeltitlar kortas till utrymmet och bär hela titeln i title', () => {
        const svg = rita(staplar({ x: { skala: 'band', titel: 'T'.repeat(300) }, y: { skala: 'linjar', titel: 'Y'.repeat(300) } }), 320);
        const lang = alla(svg, 'text').filter(t => /^[TY]+…$/.test(texten(t)));
        expect(lang).toHaveLength(2);
        for (const t of lang) expect(t.querySelector('title').textContent).toHaveLength(300);
    });
});

describe('S2: inga id i SVG:n', () => {
    it('utan id, defs, clipPath, pattern och url(…) — även med små grupper och flera paneler', () => {
        const f = staplar({ paneler: ['K', 'M'], lager: [{ marke: 'stapel', panel: 'K', serie: 'K', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }] }, { marke: 'stapel', panel: 'M', serie: 'M', data: [{ x: 'A', y: 2 }] }] });
        for (const val of [{}, { visaSma: true }, { visaSma: true, bakgrund: '#fff', not: 'En not.' }]) {
            const text = ser(rita(f, 600, val));
            expect(text).not.toMatch(/ id=|url\(|<defs|<clipPath|<pattern/);
            expect(new w.DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror')).toBeNull();
        }
    });
    it('ränder på en liten stapel är streck i en nästlad svg som klipper till staplen', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }] }] });
        const svg = rita(f, 600, { visaSma: true });
        const [, liten] = alla(svg, '[data-marke="stapel"]');
        const r = svg.querySelector('svg[data-marke="rander"]');
        expect(r.getAttribute('pointer-events')).toBe('none');
        expect(r.getAttribute('overflow')).toBe('hidden');
        for (const a of ['x', 'y', 'width', 'height']) expect(tal(r, a)).toBeCloseTo(tal(liten, a), 5);
        expect(alla(r, 'line').length).toBeGreaterThan(3);
    });
});

describe('R8: märkena klipps mot ytan', () => {
    it('märkena ligger i en nästlad svg med panelens mått och overflow hidden (klipper utan id)', () => {
        const f = staplar({ y: { skala: 'linjar', doman: [10, 20] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 5 }, { x: 'B', y: 15 }, { x: 'C', y: 100 }] }] });
        const svg = rita(f);
        const m = alla(svg, '[data-marke="stapel"]');
        const panel = m[0].parentNode;
        expect(panel.tagName.toLowerCase()).toBe('svg');
        expect(panel.getAttribute('data-del')).toBe('panel');
        expect(m.every(e => e.parentNode === panel)).toBe(true);
        const axel = svg.querySelector('line[stroke="#94a3b8"]');
        expect(panel.getAttribute('overflow')).toBe('hidden');
        expect(tal(panel, 'x')).toBe(0);
        expect(tal(panel, 'y')).toBe(0);
        expect(tal(panel, 'width')).toBeCloseTo(tal(axel, 'x2'), 5);
        expect(tal(panel, 'height')).toBeCloseTo(tal(axel, 'y1'), 5);
        expect(alla(svg, '[class], [style], foreignObject')).toEqual([]);
    });
    it('etiketter ligger utanför den klippta gruppen; etiketten på en stapel som skärs av domänen ritas inte', () => {
        const f = staplar({ y: { skala: 'linjar', doman: [10, 20] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 15, etikett: 'inne' }, { x: 'B', y: 100, etikett: 'ute' }] }] });
        const svg = rita(f);
        const e = alla(svg, '[data-marke="etikett"]');
        expect(e.map(texten)).toEqual(['inne']);
        expect(e[0].closest('svg[data-del="panel"]')).toBeNull();
    });
});

describe('R8: punkter vid axelns ände', () => {
    it('punkter på domänens ändar klipps inte mitt itu: hela cirkeln ligger i ytan', () => {
        const f = { beskrivning: 'b', x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'log' }, lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 0, y: 10 }, { x: 100, y: 1000 }, { x: 50, y: 100 }] }] };
        const svg = rita(f, 480);
        const r = svg.querySelector('svg[data-del="panel"]');
        for (const c of alla(svg, 'circle[data-marke="punkt"]')) {
            expect(tal(c, 'cx') - tal(c, 'r')).toBeGreaterThanOrEqual(-1e-6);
            expect(tal(c, 'cx') + tal(c, 'r')).toBeLessThanOrEqual(tal(r, 'width') + 1e-6);
            expect(tal(c, 'cy') - tal(c, 'r')).toBeGreaterThanOrEqual(-1e-6);
            expect(tal(c, 'cy') + tal(c, 'r')).toBeLessThanOrEqual(tal(r, 'height') + 1e-6);
        }
    });
});

describe('R10: små grupper lämnar inga spår utan visaSma', () => {
    const HEM = ['HEMLIG', '987123', '987\\D{1,2}123', 'ETIKETT-HEMLIG', '876543', '765432', 'NYCKEL-HEMLIG'];
    const spar = svg => { const s = ser(svg); return HEM.filter(h => new RegExp(h).test(s)); };
    const hemlig = (x, extra = {}) => ({ x, y: 987123, liten: true, etikett: 'ETIKETT-HEMLIG', nyckel: 'NYCKEL-HEMLIG', fel: { lag: 765432, hog: 876543 }, ...extra });
    it('punktlager', () => {
        const f = staplar({ lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 'A', y: 100 }, hemlig('HEMLIG')] }] });
        expect(spar(rita(f))).toEqual([]);
        expect(spar(rita(f, 600, { visaSma: true })).length).toBeGreaterThan(0);
    });
    it('linjelager med tips och punkter', () => {
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'linje', serie: 'L', punkter: true, tips: () => [['HEMLIG']], data: [{ x: 'A', y: 1 }, hemlig('HEMLIG'), { x: 'C', y: 2 }] }] };
        expect(spar(rita(f))).toEqual([]);
        const med = rita(f, 600, { visaSma: true });
        expect(ser(med)).toContain('HEMLIG');
        expect(alla(med, '[data-marke="litenpunkt"]')).toHaveLength(1);
    });
    it('staplar', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, hemlig('HEMLIG')] }] });
        expect(spar(rita(f))).toEqual([]);
        const med = rita(f, 600, { visaSma: true });
        expect(ser(med)).toContain('HEMLIG');
        expect(alla(med, '[data-marke="rander"]')).toHaveLength(1);
        expect(alla(med, '[data-marke="stapel"]')[1].getAttribute('stroke-dasharray')).toBeTruthy();
    });
    it('en serie där alla punkter är små har ingen förklaringspost och inget namn', () => {
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'Synlig', data: [{ x: 'A', y: 1 }] }, { marke: 'stapel', serie: 'HEMLIG-SERIE', data: [{ x: 'A', y: 5, liten: true }] }] });
        const svg = rita(f);
        expect(alla(svg, '[data-serie]').map(g => g.getAttribute('data-serie'))).toEqual(['Synlig']);
        expect(ser(svg)).not.toContain('HEMLIG');
    });
    it('staplad: det nedre segmentet är litet — det övre börjar vid baslinjen och domänen spänner inte över det borttagna värdet', () => {
        const f = staplar({ lager: [
            { marke: 'stapel', lage: 'staplad', serie: 'S0', data: [{ x: 'A', y: 900000, liten: true }, { x: 'B', y: 5 }] },
            { marke: 'stapel', lage: 'staplad', serie: 'S1', data: [{ x: 'A', y: 10 }, { x: 'B', y: 6 }] },
        ] });
        const svg = rita(f);
        const r = alla(svg, '[data-marke="stapel"]');
        const kant = e => tal(e, 'y') + tal(e, 'height');
        const [s0B, s1A, s1B] = [r.find(e => e.getAttribute('data-l') === '0'), r.find(e => e.getAttribute('data-l') === '1' && e.getAttribute('data-i') === '0'), r.find(e => e.getAttribute('data-l') === '1' && e.getAttribute('data-i') === '1')];
        expect(kant(s1A)).toBeCloseTo(kant(s0B), 5);
        expect(s1B).toBeTruthy();
        const maxY = Math.max(...alla(svg, '[data-axel="y"]').map(t => Number(texten(t).replace(/\s/g, '').replace(',', '.'))));
        expect(maxY).toBeLessThan(1000);
    });
    it('x.ordning som nämner en liten kategori ger ingen etikett för den', () => {
        const f = staplar({ x: { skala: 'band', ordning: ['HEMLIG', 'A'] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, { x: 'HEMLIG', y: 2, liten: true }] }] });
        expect(alla(rita(f), '[data-axel="x"]').map(texten)).toEqual(['A']);
        expect(alla(rita(f, 600, { visaSma: true }), '[data-axel="x"]').map(texten)).toEqual(['HEMLIG', 'A']);
    });
    it('dolda serier ihop med små grupper: dold serie finns kvar nedtonad, en helt liten serie finns inte', () => {
        const f = staplar({ lager: [
            { marke: 'stapel', serie: 'Syns', data: [{ x: 'A', y: 1 }] },
            { marke: 'stapel', serie: 'Dold', data: [{ x: 'A', y: 2 }] },
            { marke: 'stapel', serie: 'HEMLIG-SERIE', data: [{ x: 'A', y: 3, liten: true }] },
        ] });
        const svg = rita(f, 600, { dolda: new Set(['Dold', 'HEMLIG-SERIE']) });
        const g = alla(svg, '[data-serie]');
        expect(g.map(e => e.getAttribute('data-serie'))).toEqual(['Syns', 'Dold']);
        expect(g[1].getAttribute('aria-pressed')).toBe('false');
        expect(g[1].getAttribute('opacity')).toBe('0.4');
        expect(ser(svg)).not.toContain('HEMLIG');
    });
    it('nedsampling ihop med små punkter: de små tas bort före urvalet och syns aldrig', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max * 3 }, (_, i) => ({ x: i, y: i % 100, liten: i % 3 === 0, nyckel: 'NYCKEL-HEMLIG' }));
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        const p = alla(svg, '[data-marke="punkt"]');
        expect(p.some(e => Number(e.getAttribute('data-i')) % 3 === 0)).toBe(false);
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${p.length}/${max * 2}`);
        expect(ser(svg)).not.toContain('NYCKEL');
    });
});

describe('R11: smärre rättelser', () => {
    it('data-nedsamplat: exakt SCATTER_MAX_POINTS + 1 punkter ritar varannan och anger det som ritades', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max + 1 }, (_, i) => ({ x: i, y: i % 10 }));
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        const n = alla(svg, '[data-marke="punkt"]').length;
        expect(n).toBe(Math.ceil((max + 1) / 2));
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${n}/${max + 1}`);
    });
    it('data-nedsamplat: ett lager utan panel räknas en gång även med två paneler', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max * 2 }, (_, i) => ({ x: i, y: i % 10 }));
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, paneler: ['P1', 'P2'], lager: [{ marke: 'punkt', data }] });
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${max}/${max * 2}`);
    });
    it('data-nedsamplat: bara de synliga punkterna räknas — är de högst SCATTER_MAX_POINTS nedsamplas inget', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max + 100 }, (_, i) => ({ x: i, y: i % 10, liten: i < 200 }));
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        expect(alla(svg, '[data-marke="punkt"]')).toHaveLength(max - 100);
        expect(svg.getAttribute('data-nedsamplat')).toBeNull();
    });
    it('staplade summor delas per värdeaxel: ett staplat lager på y2 och ett på y delar inte summa', () => {
        const f = staplar({ y2: { skala: 'linjar' }, lager: [
            { marke: 'stapel', lage: 'staplad', serie: 'A', data: [{ x: 'K', y: 10 }] },
            { marke: 'stapel', lage: 'staplad', axel: 'y2', serie: 'B', data: [{ x: 'K', y: 3 }] },
        ] });
        const [a, b] = alla(rita(f), '[data-marke="stapel"]');
        expect(tal(a, 'y') + tal(a, 'height')).toBeCloseTo(tal(b, 'y') + tal(b, 'height'), 5);   // båda börjar vid nollan
    });
    it('y-stödlinjerna ritas per panel, inte genom mellanrummet', () => {
        const f = staplar({ paneler: ['K', 'M'], lager: [{ marke: 'stapel', panel: 'K', serie: 'K', data: [{ x: 'A', y: 1 }] }, { marke: 'stapel', panel: 'M', serie: 'M', data: [{ x: 'A', y: 2 }] }] });
        const svg = rita(f, 600);
        const rader = alla(svg, 'line[stroke="#f1f5f9"]');
        const klipp = alla(svg, 'svg[data-del="panel"]');
        expect(klipp).toHaveLength(2);
        expect(rader.length).toBeGreaterThan(0);
        for (const l of rader) expect(tal(l, 'x2')).toBeCloseTo(tal(klipp[0], 'width'), 5);
    });
});

describe('S1: ritning utan visaSma är identisk med ritning av en figur där de små punkterna tagits bort', () => {
    // Bara data-l och data-i får skilja (R1). Axlarna tas ur _figUtanSma (kategoriordningen, S5); lagren
    // behålls (tömda) så att färger efter lagerindex är desamma.
    const borttagen = f => {
        const u = utanSmaGrupper(f);
        return { ...f, x: u.x, y: u.y, lager: f.lager.map(l => ({ ...l, data: l.data.filter(d => !(d && d.liten)) })) };
    };
    const normal = s => s.replace(/ data-[li]="\d+"/g, '');
    // Täckning (T2): listan ska faktiskt pröva något.
    it('varje figur har en liten punkt som ritas när små grupper visas', () => {
        for (const [namn, figur, val] of ritfigurer()) {
            for (const b of [600, 320]) expect(ser(rita(figur, b, { ...val, visaSma: true })), `${namn} (${b})`).not.toBe(ser(rita(figur, b, val)));
        }
    }, 30000);   // går igenom varje figur i två bredder: över standardgränsen 5 s när hela sviten körs parallellt
    it('varje märke i _RF_MARKEN har en figur med en liten punkt (lägg till en figur i tests/helpers/ritfigurer.js när ett märke tillkommer)', () => {
        const marken = w.__rfMarken();
        expect(marken.length).toBeGreaterThan(0);
        const tackta = new Set();
        for (const [, figur] of ritfigurer()) for (const l of figur.lager) if (l.data.some(d => d && d.liten)) tackta.add(l.marke);
        for (const m of marken) expect(tackta.has(m), `märket "${m}" saknar figur`).toBe(true);
    });
    for (const [namn, figur, val] of ritfigurer()) {
        for (const b of [600, 320]) {
            it(`${namn} (${b} px)`, () => {
                expect(normal(ser(rita(figur, b, val)))).toBe(normal(ser(rita(borttagen(figur), b, val))));
            });
        }
    }
});

describe('S3–S5: baslinje, stående etiketter, kategoriordning', () => {
    it('S3: staplar står på axellinjen även när ett streck-lager delar värdeaxeln', () => {
        const f = staplar({ lager: [
            { marke: 'stapel', serie: 'Medel', data: [{ x: 'A', y: 30000 }, { x: 'B', y: 34000 }] },
            { marke: 'punkt', symbol: 'streck', serie: 'Median', data: [{ x: 'A', y: 29000 }, { x: 'B', y: 33000 }] },
        ] });
        const svg = rita(f);
        const axel = tal(svg.querySelector('line[stroke="#94a3b8"]'), 'y1');
        for (const r of alla(svg, 'rect[data-marke="stapel"]')) expect(tal(r, 'y') + tal(r, 'height')).toBeCloseTo(axel, 0);
        const noll = alla(svg, '[data-axel="y"]').find(t => texten(t) === '0');
        expect(tal(noll, 'y') - 12 * 0.35).toBeCloseTo(axel, 0);
    });
    it('S3: nollorna på y och y2 ligger på samma höjd när båda axlarna har staplar och börjar i noll', () => {
        const f = staplar({ y2: { skala: 'linjar', format: 'antal' }, lager: [
            { marke: 'stapel', serie: 'Lön', data: [{ x: 'A', y: 30000 }] },
            { marke: 'punkt', serie: 'P', data: [{ x: 'A', y: 31000 }] },
            { marke: 'stapel', axel: 'y2', serie: 'N', data: [{ x: 'B', y: 40 }] },
            { marke: 'linje', axel: 'y2', serie: 'L', data: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }] },
        ] });
        const svg = rita(f);
        const noll = ax => tal(alla(svg, `[data-axel="${ax}"]`).find(t => texten(t) === '0'), 'y');
        expect(noll('y')).toBeCloseTo(noll('y2'), 5);
    });
    it('S4: stående etiketter ritas alla eller inga — 16 staplar på 600 px ger inga, 3 staplar ger alla', () => {
        const rader = n => staplar({ y: { skala: 'linjar', format: 'kr' }, lager: [{ marke: 'stapel', serie: 'S', data: Array.from({ length: n }, (_, i) => ({ x: `K${i}`, y: 30000 + i * 1000, etikett: `${30000 + i * 1000} kr` })) }] });
        expect(alla(rita(rader(16), 600), '[data-marke="etikett"]')).toHaveLength(0);
        expect(alla(rita(rader(3), 600), '[data-marke="etikett"]')).toHaveLength(3);
    });
    it('S5: en linje över kategorier där små punkter hoppats över sicksackar inte — x-lägena växer', () => {
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [
            { marke: 'linje', serie: 'L1', tips: () => [['t']], data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }, { x: 'C', y: 3 }, { x: 'D', y: 4, liten: true }, { x: 'E', y: 5 }] },
            { marke: 'linje', serie: 'L2', tips: () => [['t']], data: ['A', 'B', 'C', 'D', 'E'].map((x, i) => ({ x, y: i })) },
        ] };
        const svg = rita(f);
        const x = l => alla(svg, `[data-marke="linjepunkt"][data-l="${l}"]`).map(e => tal(e, 'cx'));
        for (const l of [0, 1]) { const v = x(l); expect(v.length).toBeGreaterThan(1); expect(v).toEqual([...v].sort((a, b) => a - b)); }
        expect(alla(svg, '[data-axel="x"]').map(texten)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
});

describe('T1, T3-T6', () => {
    it('T1: staplar på y + linje på y2: båda nollorna ligger på axellinjen — och omvänt', () => {
        for (const [barAxel, linjeAxel] of [[undefined, 'y2'], ['y2', undefined]]) {
            const f = staplar({ y2: { skala: 'linjar', format: 'antal', doman: [0, 100] }, y: { skala: 'linjar', format: 'kr', doman: [0, 40000] }, lager: [
                { marke: 'stapel', serie: 'S', ...(barAxel ? { axel: barAxel } : {}), data: [{ x: 'A', y: barAxel ? 40 : 30000 }, { x: 'B', y: barAxel ? 50 : 20000 }] },
                { marke: 'linje', serie: 'L', ...(linjeAxel ? { axel: linjeAxel } : {}), data: [{ x: 'A', y: linjeAxel ? 30 : 15000 }, { x: 'B', y: linjeAxel ? 60 : 10000 }] },
            ] });
            const svg = rita(f);
            const axel = tal(svg.querySelector('line[stroke="#94a3b8"]'), 'y1');
            for (const ax of ['y', 'y2']) {
                const noll = alla(svg, `[data-axel="${ax}"]`).find(t => texten(t) === '0');
                expect(tal(noll, 'y') - 12 * 0.35, `${ax} med staplar på ${barAxel || 'y'}`).toBeCloseTo(axel, 0);
            }
        }
    });
    it('T3: utanSmaGrupper bär inga borttagna namn eller värden, och är idempotent', () => {
        const f = { beskrivning: 'b', x: { skala: 'band', ordning: ['HEMLIG', 'B', 'A'] }, y: { skala: 'band', ordning: ['YHEMLIG', 'P'] }, lager: [{ marke: 'punkt', serie: 'S', data: [{ x: 'A', y: 'P' }, { x: 'HEMLIG', y: 'YHEMLIG', liten: true, nyckel: 'NYCK', etikett: 'ETIK', storlek: 77123 }, null, 'text', { x: 'B', y: 'P' }] }] };
        const u = utanSmaGrupper(f);
        const json = JSON.stringify(u);
        for (const h of ['HEMLIG', 'YHEMLIG', 'NYCK', 'ETIK', '77123']) expect(json).not.toContain(h);
        expect(u.lager[0].data).toHaveLength(2);
        expect(u.x.ordning).toEqual(['B', 'A']);
        expect(utanSmaGrupper(u)).toEqual(u);
    });
    it('T4: att slå av och på en serie ändrar inte kategoriernas ordning — med och utan visaSma', () => {
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [
            { marke: 'stapel', serie: 'Ett', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }, { x: 'C', y: 3 }] },
            { marke: 'stapel', serie: 'Två', data: [{ x: 'C', y: 1 }, { x: 'B', y: 2 }, { x: 'D', y: 3 }, { x: 'A', y: 1 }] },
        ] };
        for (const visaSma of [false, true]) {
            const ordning = dolda => alla(rita(f, 600, { visaSma, dolda: new Set(dolda) }), '[data-axel="x"]').map(texten);
            const alltsa = ordning([]);
            for (const [dold, kvar] of [['Ett', ['C', 'B', 'D', 'A']], ['Två', ['A', 'B', 'C']]]) {
                const ut = ordning([dold]);
                expect(ut, `${dold} dold, visaSma ${visaSma}`).toEqual(alltsa.filter(k => ut.includes(k)));
                expect(new Set(ut)).toEqual(new Set(visaSma || dold === 'Ett' ? kvar : ['A', 'C']));
            }
        }
    });
    it('T5: vågräta etiketter — alla eller inga per lager (60 staplar på 420 px ger inga, 3 ger alla)', () => {
        const lig = n => ({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', serie: 'S', data: Array.from({ length: n }, (_, i) => ({ y: `K${i}`, x: i + 1, etikett: `${i + 1} st` })) }] });
        expect(alla(rita(lig(60), 420), '[data-marke="etikett"]')).toHaveLength(0);
        expect(alla(rita(lig(3), 420), '[data-marke="etikett"]')).toHaveLength(3);
    });
    it('T5: staplad stapel: etiketten ligger mitt i sitt eget segment och ritas bara om den ryms', () => {
        const f = staplar({ y: { skala: 'linjar' }, lager: [
            { marke: 'stapel', lage: 'staplad', serie: 'Låg', data: [{ x: 'A', y: 10, etikett: '10' }, { x: 'B', y: 0.3, etikett: 'litet' }] },
            { marke: 'stapel', lage: 'staplad', serie: 'Hög', data: [{ x: 'A', y: 20, etikett: '20' }, { x: 'B', y: 25, etikett: '25' }] },
        ] });
        const svg = rita(f, 500);
        const e = alla(svg, '[data-marke="etikett"]');
        expect(e.map(texten)).toEqual(['10', '20', '25']);   // "litet" ryms inte i sitt segment
        const rect = (l, i) => alla(svg, `rect[data-marke="stapel"][data-l="${l}"][data-i="${i}"]`)[0];
        [[e[0], rect(0, 0)], [e[1], rect(1, 0)], [e[2], rect(1, 1)]].forEach(([t, r]) => {
            const mitt = tal(r, 'y') + tal(r, 'height') / 2;
            expect(Math.abs(tal(t, 'y') - 12 * 0.35 * (11 / 12) - mitt)).toBeLessThan(1);
            expect(tal(t, 'x')).toBeCloseTo(tal(r, 'x') + tal(r, 'width') / 2, 5);
        });
    });
    it('T5: inget etikettrum reserveras för ett lager vars etiketter utelämnas', () => {
        const med = etikett => staplar({ y: { skala: 'linjar', format: 'kr' }, lager: [{ marke: 'stapel', serie: 'S', data: Array.from({ length: 16 }, (_, i) => ({ x: `Kat ${i}`, y: 30000 + i * 100, ...(etikett ? { etikett: `${30000 + i * 100} kr` } : {}) })) }] });
        expect(ser(rita(med(true), 600))).toBe(ser(rita(med(false), 600)));
    });
    it('T6: en stapel tunnare än 3 px får streckad kant men inga ränder; 5 000 små staplar går snabbt', () => {
        const smal = n => staplar({ lager: [{ marke: 'stapel', serie: 'S', data: Array.from({ length: n }, (_, i) => ({ x: `K${i}`, y: 5 + (i % 7), liten: true })) }] });
        const svg = rita(smal(150), 400, { visaSma: true });
        const r = alla(svg, 'rect[data-marke="stapel"]');
        expect(tal(r[0], 'width')).toBeLessThan(3);
        expect(r[0].getAttribute('stroke-dasharray')).toBeTruthy();
        expect(alla(svg, '[data-marke="rander"]')).toHaveLength(0);
        // Vakten gäller skalningen, inte maskinens fart: på en delad CI-maskin tog 5 000 staplar 733 ms och lokalt
        // 160 ms. Linjär ritning ger kvoten ≈ 4–5 mellan 5 000 och 1 000 staplar, kvadratisk ≈ 25. Median av tre.
        const tid = n => { const t = []; for (let i = 0; i < 3; i++) { const t0 = performance.now(); rita(smal(n), 600, { visaSma: true }); t.push(performance.now() - t0); } return t.sort((x, y) => x - y)[1]; };
        const t1000 = tid(1000), t5000 = tid(5000);
        expect(t5000 / t1000, `5 000 staplar ${t5000.toFixed(0)} ms, 1 000 staplar ${t1000.toFixed(0)} ms`).toBeLessThan(12);
        expect(t5000).toBeLessThan(3000);
    });
});

// ---------------------------------------------------------------------------------------------
// Rättningsomgång 4 (U1): etikettrum reserveras om och endast om etiketterna ritas
// ---------------------------------------------------------------------------------------------
describe('U1: etikettrum reserveras om och endast om lagrets etiketter ritas', () => {
    const NAMN = ['Kvinnor', 'Män', 'Alla'];
    // n kategorier × s serier, stående eller liggande. `etikett(k, v, i)` ger lagrets etikett (null = ingen).
    const fig = (n, s, ligg, etikett) => ({
        beskrivning: 'b',
        x: ligg ? { skala: 'linjar', titel: 'Kr', format: 'kr' } : { skala: 'band', titel: 'Grupp' },
        y: ligg ? { skala: 'band' } : { skala: 'linjar', titel: 'Kr', format: 'kr' },
        lager: Array.from({ length: s }, (_, k) => ({
            marke: 'stapel', serie: NAMN[k], ...(ligg ? { riktning: 'liggande' } : {}),
            data: Array.from({ length: n }, (_, i) => {
                const v = 30000 + k * 1500 + ((i * 7) % 5) * 900, e = etikett(k, v, i);
                return { [ligg ? 'y' : 'x']: `G${i}`, [ligg ? 'x' : 'y']: v, ...(e ? { etikett: e } : {}) };
            }),
        })),
    });
    // Etiketten börjar på lagrets siffra, så att ritade etiketter kan föras till sitt lager.
    const markt = (k, v) => `${k}: ${v} kr`;
    const perLager = (svg, s) => Array.from({ length: s }, (_, k) => alla(svg, '[data-marke="etikett"]').filter(t => texten(t).startsWith(`${k}:`)).length);
    const kr = (k, v) => `${String(v).slice(0, 2)} ${String(v).slice(2)} kr`;

    // Tre former, var och en stående och liggande: [namn, n, s, bredd].
    for (const [namn, n, s, b] of [['en serie × 14', 14, 1, 600], ['Kvinnor/Män × 6', 6, 2, 600], ['två serier × 12', 12, 2, 600]]) {
        for (const ligg of [false, true]) {
            it(`${namn}, ${ligg ? 'liggande' : 'stående'}: utelämnade etiketter lämnar ingen plats efter sig; ritade ligger i bilden utan överlapp`, () => {
                const svg = rita(fig(n, s, ligg, kr), b);
                const ritade = alla(svg, '[data-marke="etikett"]').length;
                expect([0, n * s]).toContain(ritade);
                if (ritade === 0) expect(ser(svg)).toBe(ser(rita(fig(n, s, ligg, () => null), b)));
                else expect(kontrolleraYta(svg, namn)).toEqual([]);
            });
        }
    }
    it('2 × 6 stående och 2 × 12 liggande med "30 000 kr" på 600 px ritar inga etiketter och reserverar inget', () => {
        for (const [n, ligg] of [[6, false], [12, true]]) {
            const svg = rita(fig(n, 2, ligg, kr), 600);
            expect(alla(svg, '[data-marke="etikett"]'), `${n} ${ligg}`).toHaveLength(0);
            expect(ser(svg), `${n} ${ligg}`).toBe(ser(rita(fig(n, 2, ligg, () => null), 600)));
        }
    });
    it('få staplar: etiketterna ritas (stående och liggande, en och flera serier), i bilden och utan överlapp', () => {
        for (const [n, s, ligg, b] of [[3, 1, false, 600], [2, 2, false, 600], [3, 1, true, 600], [4, 2, true, 600], [3, 3, true, 420]]) {
            const svg = rita(fig(n, s, ligg, kr), b);
            expect(alla(svg, '[data-marke="etikett"]'), `${n}×${s} ${ligg}`).toHaveLength(n * s);
            expect(kontrolleraYta(svg, `${n}×${s}`)).toEqual([]);
            expect(ser(svg)).not.toBe(ser(rita(fig(n, s, ligg, () => null), b)));
        }
    });
    it('två lager där bara det enas etiketter ryms: bilden är identisk med figuren utan det andra lagrets etiketter', () => {
        const e = (k, v, i) => (k === 0 ? `0:${i}` : `1: en väldigt lång etikett ${i}`);
        const svg = rita(fig(3, 2, false, e), 520);
        expect(perLager(svg, 2)).toEqual([3, 0]);
        expect(ser(svg)).toBe(ser(rita(fig(3, 2, false, (k, v, i) => (k === 0 ? e(k, v, i) : null)), 520)));
        expect(kontrolleraYta(svg, 'två lager')).toEqual([]);
    });
    // Egenskapen: 2..24 staplar × 1..3 serier × stående/liggande × tre bredder. Varje lager: alla etiketter eller inga;
    // och bilden är identisk med samma figur där `etikett` tagits bort ur de lager som inte fick några.
    for (const ligg of [false, true]) {
        for (const b of [320, 420, 600]) {
            it(`egenskap, ${ligg ? 'liggande' : 'stående'} ${b} px: inga ritade etiketter ⇒ samma bild som utan etikett`, () => {
                let utelamnade = 0, ritadeFall = 0;
                for (let n = 2; n <= 24; n++) for (let s = 1; s <= 3; s++) {
                    const svg = rita(fig(n, s, ligg, markt), b);
                    const per = perLager(svg, s);
                    for (const antal of per) expect([0, n], `${n}×${s}`).toContain(antal);
                    expect(ser(svg), `${n}×${s}: ${per}`).toBe(ser(rita(fig(n, s, ligg, (k, v) => (per[k] ? markt(k, v) : null)), b)));
                    if (per.some(a => a)) { ritadeFall++; expect(kontrolleraYta(svg, `${n}×${s}`), `${n}×${s}`).toEqual([]); }
                    if (per.some(a => !a)) utelamnade++;
                }
                expect(utelamnade).toBeGreaterThan(0);   // egenskapen prövar något
                if (ligg || b === 600) expect(ritadeFall).toBeGreaterThan(0);
            });
        }
    }
    it('etiketten på en stapel som skärs av domänen ritas inte och reserverar inget rum', () => {
        const f = etikett => staplar({ y: { skala: 'linjar', doman: [0, 20] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 100, ...(etikett ? { etikett: 'högt' } : {}) }, { x: 'B', y: 10 }] }] });
        const svg = rita(f(true), 600);
        expect(alla(svg, '[data-marke="etikett"]')).toHaveLength(0);
        expect(ser(svg)).toBe(ser(rita(f(false), 600)));
    });
    it('ett lager utan panel i två paneler med olika många staplar bredvid varandra: ett beslut för lagret, i båda panelerna', () => {
        const f = etikett => staplar({ paneler: ['P1', 'P2'], lager: [
            { marke: 'stapel', serie: 'Alla', data: ['A', 'B', 'C', 'D'].map((x, i) => ({ x, y: 30000 + i, ...(etikett ? { etikett: '30 000 kr' } : {}) })) },
            { marke: 'stapel', serie: 'Bara P2', panel: 'P2', data: ['A', 'B', 'C', 'D'].map(x => ({ x, y: 20000 })) },
        ] });
        // 600 px: etiketten ryms i P1 (en stapel per kategori) men inte i P2 (två) — då ritas den inte i någon panel.
        const svg = rita(f(true), 600);
        expect(alla(svg, '[data-marke="etikett"]')).toHaveLength(0);
        expect(ser(svg)).toBe(ser(rita(f(false), 600)));
        const bred = rita(f(true), 1400);
        expect(alla(bred, '[data-marke="etikett"]')).toHaveLength(8);
        expect(kontrolleraYta(bred, 'paneler')).toEqual([]);
    });
});

describe('U1: staplade etiketter ritas bara när inget annat stapellager kan täcka segmentet', () => {
    const lagerS = (serie, ys, extra = {}) => ({ marke: 'stapel', lage: 'staplad', serie, ...extra, data: ys.map((y, i) => ({ x: 'AB'[i], y, etikett: `${serie}${y}` })) });
    it('alla stapellager staplade på samma axel: etiketterna ritas i segmenten', () => {
        const svg = rita(staplar({ y: { skala: 'linjar' }, lager: [lagerS('a', [10, 12]), lagerS('b', [20, 25])] }), 500);
        expect(alla(svg, '[data-marke="etikett"]').map(texten)).toEqual(['a10', 'a12', 'b20', 'b25']);
    });
    it('ett överlagrat eller fristående stapellager i samma panel: inga staplade etiketter', () => {
        for (const annat of [{ marke: 'stapel', lage: 'overlagrad', serie: 'tak', data: [{ x: 'A', y: 28 }, { x: 'B', y: 30 }] }, { marke: 'stapel', serie: 'fri', data: [{ x: 'A', y: 28 }] }]) {
            const lager = [lagerS('a', [10, 12]), lagerS('b', [20, 25]), annat];
            const svg = rita(staplar({ y: { skala: 'linjar' }, lager }), 500);
            expect(alla(svg, '[data-marke="etikett"]'), annat.serie).toHaveLength(0);
            const utan = lager.map(l => ({ ...l, data: l.data.map(d => ({ x: d.x, y: d.y })) }));
            expect(ser(svg)).toBe(ser(rita(staplar({ y: { skala: 'linjar' }, lager: utan }), 500)));
        }
    });
    it('staplade lager på y och y2 täcker varandra: inga etiketter; i skilda paneler ritas de', () => {
        const y2 = { skala: 'linjar' };
        const blandat = rita(staplar({ y: { skala: 'linjar' }, y2, lager: [lagerS('a', [10, 12]), lagerS('b', [20, 25], { axel: 'y2' })] }), 500);
        expect(alla(blandat, '[data-marke="etikett"]')).toHaveLength(0);
        const skilda = rita(staplar({ y: { skala: 'linjar' }, y2, paneler: ['P', 'Q'], lager: [lagerS('a', [10, 12], { panel: 'P' }), lagerS('b', [20, 25], { panel: 'Q', axel: 'y2' })] }), 700);
        expect(alla(skilda, '[data-marke="etikett"]')).toHaveLength(4);
    });
    it('ett dolt stapellager täcker inget: de staplade etiketterna ritas', () => {
        const lager = [lagerS('a', [10, 12]), lagerS('b', [20, 25]), { marke: 'stapel', lage: 'overlagrad', serie: 'tak', data: [{ x: 'A', y: 28 }] }];
        const svg = rita(staplar({ y: { skala: 'linjar' }, lager }), 500, { dolda: new Set(['tak']) });
        expect(alla(svg, '[data-marke="etikett"]')).toHaveLength(4);
    });
});

describe('U2: figuren och bilden namnger samma paneler', () => {
    it('utanSmaGrupper(f).paneler är exakt de paneler ritaren ritar för f — för varje figur med paneler i listan', () => {
        let prov = 0;
        for (const [namn, figur, val] of ritfigurer()) {
            if (!figur.paneler) continue;
            prov++;
            const titlar = alla(rita(figur, 700, val), 'text[font-weight="600"]').map(texten);
            expect(titlar, namn).toEqual(utanSmaGrupper(figur).paneler);
            expect(alla(rita(figur, 700, val), 'svg[data-del="panel"]'), namn).toHaveLength(titlar.length);
        }
        expect(prov).toBeGreaterThan(2);
    });
});

describe('Rättning 4: smått', () => {
    it('nollinjer är märkta data-marke="nollinje" och ligger i panelens klippta svg, efter märkena', () => {
        const f = { beskrivning: 'b', x: { skala: 'linjar', nollinje: true }, y: { skala: 'linjar', nollinje: true }, lager: [{ marke: 'punkt', data: [{ x: -2, y: -3 }, { x: 4, y: 5 }] }] };
        const svg = rita(f, 500);
        const linjer = alla(svg, 'svg[data-del="panel"] > line[data-marke="nollinje"]');
        expect(linjer).toHaveLength(2);
        expect(alla(svg, '[data-marke="nollinje"]')).toHaveLength(2);
        const barn = [...svg.querySelector('svg[data-del="panel"]').children];
        expect(barn.slice(-2)).toEqual(linjer);                                   // sist: efter märken och referenser
        expect(tal(linjer[0], 'x1')).toBe(tal(linjer[0], 'x2'));                  // x-axelns nollinje är lodrät
        expect(tal(linjer[1], 'y1')).toBe(tal(linjer[1], 'y2'));
        expect(alla(rita({ ...f, x: { skala: 'linjar' }, y: { skala: 'linjar' } }, 500), '[data-marke="nollinje"]')).toHaveLength(0);
    });
    it('figurlistan har ett punktmoln som nedsamplas, med en liten punkt', () => {
        const [, figur] = ritfigurer().find(([namn]) => namn === 'punktmoln som nedsamplas');
        expect(rita(figur, 600).getAttribute('data-nedsamplat')).toBe('4100/8200');
        expect(rita(figur, 600, { visaSma: true }).getAttribute('data-nedsamplat')).toBe('4101/8201');
    });
});

// ---------------------------------------------------------------------------------------------
// Uppgift 5 (briefens tester)
// ---------------------------------------------------------------------------------------------
describe('ritaren: band och intervall', () => {
    it('band: en fylld yta utan kant, bakom linjen i ritordning', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [
            { marke: 'band', serie: 'KI', farg: '#e74c8b', data: [{ x: 25, lag: 100, hog: 300 }, { x: 45, lag: 150, hog: 250 }, { x: 65, lag: 120, hog: 260 }] },
            { marke: 'linje', serie: 'Kvinna', data: [{ x: 25, y: 200 }, { x: 65, y: 190 }] },
        ] });
        const band = alla(svg, 'path[data-marke="band"]');
        expect(band).toHaveLength(1);
        expect(band[0].getAttribute('fill')).toBe('#e74c8b');
        expect(Number(band[0].getAttribute('fill-opacity'))).toBeLessThan(0.5);
        expect(band[0].getAttribute('stroke')).toBe('none');
        expect(band[0].getAttribute('d')).toMatch(/Z$/);
        const ordning = alla(svg, '[data-marke]').map(e => e.getAttribute('data-marke'));
        expect(ordning.indexOf('band')).toBeLessThan(ordning.indexOf('linje'));
    });
    it('intervall: ett streck från lag till hog; liggande och stående', () => {
        const ligg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [
            { marke: 'intervall', riktning: 'liggande', tjocklek: 8, data: [{ y: 'A', lag: 20, hog: 60 }, { y: 'B', lag: 30, hog: null }] }] });
        const l = alla(ligg, 'line[data-marke="intervall"]');
        expect(l).toHaveLength(1);
        expect(tal(l[0], 'y1')).toBe(tal(l[0], 'y2'));
        expect(tal(l[0], 'x2')).toBeGreaterThan(tal(l[0], 'x1'));
        expect(l[0].getAttribute('stroke-width')).toBe('8');
        const sta = rita(staplar({ lager: [{ marke: 'intervall', data: [{ x: 'A', lag: 1, hog: 5 }] }] }));
        const s = alla(sta, 'line[data-marke="intervall"]')[0];
        expect(tal(s, 'x1')).toBe(tal(s, 'x2'));
        expect(tal(s, 'y1')).not.toBe(tal(s, 'y2'));
    });
});

describe('ritaren: låda', () => {
    const ind = (x, loner) => loner.map(y => ({ x, y }));
    it('en låda per kategori och serie: låda, median, två morrhår och avvikare', () => {
        const svg = rita(staplar({ lager: [
            { marke: 'lada', serie: 'Kvinna', data: [...ind('A', [10, 12, 13, 14, 15, 16, 17, 18, 40]), ...ind('B', [20, 21, 22])] },
            { marke: 'lada', serie: 'Man', data: ind('A', [11, 12, 13]) },
        ] }));
        expect(alla(svg, 'rect[data-marke="lada"]')).toHaveLength(3);
        expect(alla(svg, '[data-marke="median"]')).toHaveLength(3);
        expect(alla(svg, '[data-marke="morrhar"]')).toHaveLength(6);
        expect(alla(svg, '[data-marke="avvikare"]')).toHaveLength(1);
        const [kvA, , maA] = alla(svg, 'rect[data-marke="lada"]');
        expect(tal(maA, 'x')).toBeGreaterThan(tal(kvA, 'x'));        // bredvid varandra inom kategorin
        const m = alla(svg, '[data-marke="median"]')[0];
        expect(tal(m, 'y1')).toBeGreaterThanOrEqual(tal(kvA, 'y'));
        expect(tal(m, 'y1')).toBeLessThanOrEqual(tal(kvA, 'y') + tal(kvA, 'height'));
    });
    it('punkter: "alla" ritar varje individ, utan låda, med stillastående spridning', () => {
        const f = staplar({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'Alla', data: ind('A', [10, 11, 12, 13]) }] });
        const svg = rita(f);
        expect(alla(svg, 'rect[data-marke="lada"]')).toHaveLength(0);
        const p = alla(svg, '[data-marke="individ"]');
        expect(p).toHaveLength(4);
        expect(new Set(p.map(e => e.getAttribute('cx'))).size).toBeGreaterThan(1);
        expect(alla(rita(f), '[data-marke="individ"]').map(e => e.getAttribute('cx'))).toEqual(p.map(e => e.getAttribute('cx')));
    });
});

describe('ritaren: ruta och färgskala', () => {
    const heat = over => ({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' },
        fargskala: { typ: 'sekventiell', doman: [0, 100], titel: 'Gap %' },
        lager: [{ marke: 'ruta', serie: 'Gap', visaText: true, data: [{ x: 'a', y: 'r1', varde: 0, text: '0 %' }, { x: 'b', y: 'r1', varde: 100, text: '100 %' }, { x: 'a', y: 'r2', varde: null }] }], ...over });
    it('en ruta per cell med värde; färgen följer skalan; texten ritas; färgstapel med titel', () => {
        const svg = rita(heat());
        const r = alla(svg, 'rect[data-marke="ruta"]');
        expect(r).toHaveLength(2);
        expect(r[0].getAttribute('fill')).not.toBe(r[1].getAttribute('fill'));
        expect(alla(svg, '[data-marke="rutatext"]').map(t => t.textContent)).toEqual(['0 %', '100 %']);
        expect(alla(svg, '[data-marke="fargstapel"]').length).toBeGreaterThan(5);
        expect(alla(svg, 'text').map(t => t.textContent)).toContain('Gap %');
    });
    it('divergerande skala: mitten skiljer sig från båda ändar; värden utanför domänen kläms', () => {
        w.__fs = { typ: 'divergerande', doman: [50, 150] };
        const [lag, mitt, hog, under] = w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(50), s(100), s(150), s(-999)]; })()');
        expect(new Set([lag, mitt, hog]).size).toBe(3);
        expect(under).toBe(lag);
        expect(w.eval('_rfFargskala(null)')).toBeNull();
    });
    it('punkter med fargvarde använder skalan', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, fargskala: { typ: 'tvafarg', doman: [0, 100], titel: 'Andel kvinnor' },
            lager: [{ marke: 'punkt', data: [{ x: 1, y: 1, fargvarde: 0 }, { x: 2, y: 2, fargvarde: 100 }] }] });
        const [a, b] = alla(svg, '[data-marke="punkt"]');
        expect(a.getAttribute('fill')).not.toBe(b.getAttribute('fill'));
    });
    it('små rutor får ränder med visaSma', () => {
        const f = heat();
        f.lager[0].data[1].liten = true;
        expect(alla(rita(f), 'rect[data-marke="ruta"]')).toHaveLength(1);
        expect(alla(rita(f, 600, { visaSma: true }), '[data-marke="rander"]')).toHaveLength(1);
    });
});

describe('ritaren: referenser, paneler och y2', () => {
    it('referenslinje och zon med etikett; zonen ligger under märkena, linjen över', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'linjar' },
            referens: [{ typ: 'linje', x: 40, streck: 'streckad' }, { typ: 'linje', y: 5 }, { typ: 'zon', x0: 60, x1: 100, farg: '#fee2e2', etikett: 'Successionszon' }],
            lager: [{ marke: 'punkt', data: [{ x: 10, y: 1 }, { x: 90, y: 9 }] }] });
        const ordning = alla(svg, '[data-marke]').map(e => e.getAttribute('data-marke'));
        expect(ordning.filter(m => m === 'referenslinje')).toHaveLength(2);
        expect(ordning.indexOf('zon')).toBeLessThan(ordning.indexOf('punkt'));
        expect(ordning.lastIndexOf('referenslinje')).toBeGreaterThan(ordning.lastIndexOf('punkt'));
        expect(alla(svg, '[data-marke="referenslinje"]')[0].getAttribute('stroke-dasharray')).toBe('6 4');
        expect(alla(svg, 'text').map(t => t.textContent)).toContain('Successionszon');
        const zon = alla(svg, '[data-marke="zon"]')[0];
        expect(tal(zon, 'width')).toBeGreaterThan(0);
        expect(zon.getAttribute('fill')).toBe('#fee2e2');
    });
    it('en referens utanför domänen ritas inte', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar', doman: [0, 10] }, y: { skala: 'linjar' },
            referens: [{ typ: 'linje', x: 400 }], lager: [{ marke: 'punkt', data: [{ x: 1, y: 1 }] }] });
        expect(alla(svg, '[data-marke="referenslinje"]')).toHaveLength(0);
    });
    it('paneler: lager ritas i sin panel, sida vid sida, med rubrik; y-axeln ritas en gång', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, paneler: ['Kvinna', 'Man'],
            fargskala: { typ: 'sekventiell', doman: [0, 1], titel: 'Median' },
            lager: [
                { marke: 'ruta', serie: 'Median', panel: 'Kvinna', data: [{ x: 'a', y: 'r', varde: 0 }] },
                { marke: 'ruta', serie: 'Median', panel: 'Man', data: [{ x: 'a', y: 'r', varde: 1 }] },
            ] }, 700);
        const r = alla(svg, 'rect[data-marke="ruta"]');
        expect(r).toHaveLength(2);
        expect(r[0].parentNode).not.toBe(r[1].parentNode);
        expect(r[0].getAttribute('data-l')).toBe('0');
        expect(r[1].getAttribute('data-l')).toBe('1');
        const text = alla(svg, 'text').map(t => t.textContent);
        expect(text).toContain('Kvinna');
        expect(text).toContain('Man');
        expect(alla(svg, '[data-axel="y"]')).toHaveLength(1);
        expect(alla(svg, '[data-axel="x"]')).toHaveLength(2);
    });
    it('y2: lagret följer sin egen skala och axeln ritas till höger', () => {
        const svg = rita(staplar({ y2: { skala: 'linjar', titel: 'Kumulativ %', format: 'pct', doman: [0, 100] }, lager: [
            { marke: 'stapel', serie: 'Kostnad', data: [{ x: 'A', y: 1000 }, { x: 'B', y: 500 }] },
            { marke: 'linje', serie: 'Kumulativ', axel: 'y2', data: [{ x: 'A', y: 50 }, { x: 'B', y: 100 }] },
        ] }));
        expect(alla(svg, '[data-axel="y2"]').length).toBeGreaterThan(1);
        expect(alla(svg, 'text').map(t => t.textContent)).toContain('Kumulativ %');
        const d = alla(svg, 'path[data-marke="linje"]')[0].getAttribute('d');
        const ys = [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => Number(m[2]));
        expect(ys[1]).toBeLessThan(ys[0]);                        // 100 % ligger högre än 50 %
        expect(ys[1]).toBeLessThan(20);                           // nära ritytans topp (0–100 på y2, inte 0–1000)
    });
});

// ---------------------------------------------------------------------------------------------
// Uppgift 5: de nya märkena och små grupper, färgstapeln, referenserna
// ---------------------------------------------------------------------------------------------
describe('Uppgift 5: små grupper i band, intervall, låda och ruta', () => {
    const utanAttr = svg => alla(svg, '*').filter(e => /NaN|undefined|null|Infinity/.test([...e.attributes].map(a => a.value).join(' ')));
    const ind = (x, loner, sma = []) => loner.map((y, i) => (sma.includes(i) ? { x, y, liten: true } : { x, y }));
    it('band: en borttagen liten punkt bryter inte bandet; med visaSma får den ihåliga streckade märken vid båda gränserna', () => {
        const f = sma => ({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar', doman: [0, 20] }, lager: [{ marke: 'band', serie: 'KI', data: [{ x: 1, lag: 2, hog: 6 }, ...(sma ? [{ x: 2, lag: 10, hog: 18, liten: true }] : []), { x: 3, lag: 3, hog: 7 }, { x: 4, lag: 4, hog: 8 }] }] });
        const d = svg => alla(svg, 'path[data-marke="band"]')[0].getAttribute('d');
        expect((d(rita(f(true))).match(/M/g) || []).length).toBe(1);
        expect(d(rita(f(true)))).toBe(d(rita(f(false))));
        const med = rita(f(true), 600, { visaSma: true });
        const m = alla(med, '[data-marke="litenpunkt"]');
        expect(m).toHaveLength(2);
        expect(m.map(e => e.getAttribute('data-i'))).toEqual(['1', '1']);
        expect(tal(m[0], 'cy')).not.toBe(tal(m[1], 'cy'));
        for (const e of m) { expect(e.getAttribute('fill')).toBe('none'); expect(e.getAttribute('stroke-dasharray')).toBeTruthy(); }
        expect(alla(rita(f(true)), '[data-marke="litenpunkt"]')).toHaveLength(0);
        expect(alla(rita(f(true)), 'path[data-marke="band"]')[0].hasAttribute('data-i')).toBe(false);
    });
    it('intervall: ett litet intervall ritas inte; med visaSma är det streckat och svagare; data-i är originalets', () => {
        const f = staplar({ lager: [{ marke: 'intervall', serie: 'P', data: [{ x: 'Liten', lag: 1, hog: 900000, liten: true }, { x: 'A', lag: 1, hog: 5 }, { x: 'B', lag: 2, hog: 6 }] }] });
        const utan = alla(rita(f), 'line[data-marke="intervall"]');
        expect(utan.map(e => e.getAttribute('data-i'))).toEqual(['1', '2']);
        expect(utan.every(e => !e.hasAttribute('stroke-dasharray'))).toBe(true);
        expect(ser(rita(f))).not.toContain('Liten');
        const [liten, stor] = alla(rita(f, 600, { visaSma: true }), 'line[data-marke="intervall"]');
        expect(liten.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(tal(liten, 'stroke-opacity')).toBeLessThan(tal(stor, 'stroke-opacity'));
    });
    it('intervall: slutar exakt vid sina värden — inget rum reserveras längs värdeaxeln', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'linjar', doman: [20, 60] }, y: { skala: 'band' }, lager: [{ marke: 'intervall', riktning: 'liggande', data: [{ y: 'A', lag: 20, hog: 60 }] }] });
        const l = alla(svg, 'line[data-marke="intervall"]')[0];
        expect(tal(l, 'x1')).toBe(0);
        expect(tal(l, 'x2')).toBeCloseTo(tal(svg.querySelector('svg[data-del="panel"]'), 'width'), 6);
    });
    it('låda: små individer går aldrig in i kvartiler, morrhår eller avvikare', () => {
        const f = sma => staplar({ y: { skala: 'linjar', doman: [0, 50] }, lager: [{ marke: 'lada', serie: 'L', data: [...ind('A', [10, 12, 13, 14, 15, 16, 17, 18]), ...(sma ? [{ x: 'A', y: 49, liten: true }, { x: 'A', y: 48, liten: true }, { x: 'A', y: 1, liten: true }] : [])] }] });
        const matt = svg => ['lada', 'median', 'morrhar', 'avvikare'].map(m => alla(svg, `[data-marke="${m}"]`).map(e => ['y', 'height', 'y1', 'y2', 'cy'].map(a => e.getAttribute(a)).join('|')));
        expect(matt(rita(f(true)))).toEqual(matt(rita(f(false))));
        expect(alla(rita(f(true)), '[data-marke="avvikare"]')).toHaveLength(0);
        expect(matt(rita(f(true), 600, { visaSma: true }))).not.toEqual(matt(rita(f(false))));
    });
    it('låda: lådans data-i är den första kvarvarande individens; morrhår, median och avvikare bär inga index', () => {
        const f = staplar({ lager: [{ marke: 'lada', serie: 'L', data: [{ x: 'A', y: 99, liten: true }, ...ind('A', [10, 12, 13, 14, 15, 16, 17, 18, 40]), ...ind('B', [5, 6, 7])] }] });
        const svg = rita(f);
        expect(alla(svg, 'rect[data-marke="lada"]').map(e => [e.getAttribute('data-l'), e.getAttribute('data-i')])).toEqual([['0', '1'], ['0', '10']]);
        expect(alla(svg, '[data-marke="avvikare"]')).toHaveLength(1);
        for (const m of ['morrhar', 'median', 'avvikare']) for (const e of alla(svg, `[data-marke="${m}"]`)) {
            expect(e.hasAttribute('data-l') || e.hasAttribute('data-i'), m).toBe(false);
            expect(e.getAttribute('pointer-events')).toBe('none');
        }
    });
    it('låda med visaSma: en låda med någon liten individ får streckad kant och ränder', () => {
        const f = staplar({ lager: [{ marke: 'lada', serie: 'L', data: [...ind('A', [10, 12, 13, 14, 30], [2]), ...ind('B', [5, 9, 16, 22])] }] });
        const svg = rita(f, 600, { visaSma: true });
        const [a, b] = alla(svg, 'rect[data-marke="lada"]');
        expect(a.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(b.getAttribute('stroke-dasharray')).toBeNull();
        expect(alla(svg, '[data-marke="rander"]')).toHaveLength(1);
        expect(a.nextElementSibling.getAttribute('data-marke')).toBe('rander');   // ränderna ligger intill sin låda
        expect(alla(rita(f), '[data-marke="rander"]')).toHaveLength(0);
    });
    it('punkter "alla": spridningen i sidled beror inte på dolda individer — bara på ordningen bland dem som ritas', () => {
        const f = sma => staplar({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'L', data: [...(sma ? [{ x: 'A', y: 11, liten: true }] : []), { x: 'A', y: 10 }, ...(sma ? [{ x: 'A', y: 12, liten: true }, { x: 'B', y: 12, liten: true }] : []), { x: 'A', y: 12 }, { x: 'A', y: 13 }, { x: 'B', y: 11 }, { x: 'B', y: 14 }] }] });
        const lagen = svg => alla(svg, '[data-marke="individ"]').map(e => `${e.getAttribute('cx')},${e.getAttribute('cy')}`);
        expect(lagen(rita(f(true)))).toEqual(lagen(rita(f(false))));
        expect(alla(rita(f(true)), '[data-marke="individ"]').map(e => e.getAttribute('data-i'))).toEqual(['1', '4', '5', '6', '7']);
        const med = alla(rita(f(true), 600, { visaSma: true }), '[data-marke="individ"]');
        expect(med).toHaveLength(8);
        const nr = i => med.find(e => e.getAttribute('data-i') === String(i));
        expect(nr(0).getAttribute('stroke-dasharray')).toBeTruthy();   // liten individ: streckad kant
        expect(nr(1).getAttribute('stroke-dasharray')).toBeNull();
    });
    it('individer och avvikare vid värdeaxelns ände klipps inte mitt itu', () => {
        for (const punkter of ['alla', 'avvikare']) {
            const svg = rita(staplar({ y: { skala: 'linjar', doman: [10, 60] }, lager: [{ marke: 'lada', punkter, serie: 'L', data: ind('A', [10, 20, 21, 22, 23, 24, 60]) }] }));
            const h = tal(svg.querySelector('svg[data-del="panel"]'), 'height');
            const c = alla(svg, punkter === 'alla' ? '[data-marke="individ"]' : '[data-marke="avvikare"]');
            expect(c.length, punkter).toBeGreaterThan(1);
            for (const e of c) {
                expect(tal(e, 'cy') - tal(e, 'r'), punkter).toBeGreaterThanOrEqual(0);
                expect(tal(e, 'cy') + tal(e, 'r'), punkter).toBeLessThanOrEqual(h);
            }
        }
    });
    it('ett lådlager där alla individer är små tar ingen plats bredvid de andra', () => {
        const lager = sma => [{ marke: 'lada', serie: 'K', data: ind('A', [10, 12, 14]) }, ...(sma ? [{ marke: 'lada', serie: 'Hemlig', data: ind('A', [50, 60, 70], [0, 1, 2]) }] : []), { marke: 'lada', serie: 'M', farg: '#0077bc', data: ind('A', [11, 13, 15]) }];
        const x = svg => alla(svg, 'rect[data-marke="lada"]').map(e => `${e.getAttribute('x')}|${e.getAttribute('width')}`);
        expect(x(rita(staplar({ lager: lager(true) })))).toEqual(x(rita(staplar({ lager: lager(false) }))));
        expect(alla(rita(staplar({ lager: lager(true) }), 600, { visaSma: true }), 'rect[data-marke="lada"]')).toHaveLength(3);
    });
    it('ruta: en liten ruta lämnar varken ruta, text eller kategori; inga NaN', () => {
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100] },
            lager: [{ marke: 'ruta', visaText: true, data: [{ x: 'a', y: 'r1', varde: 10, text: 'tio' }, { x: 'Hemlig', y: 'r1', varde: 99, text: 'TEXT-HEMLIG', liten: true }, { x: 'a', y: 'r2', varde: 50, text: 'femtio' }] }] };
        const svg = rita(f);
        expect(ser(svg)).not.toMatch(/Hemlig|HEMLIG/);
        expect(alla(svg, 'rect[data-marke="ruta"]').map(e => e.getAttribute('data-i'))).toEqual(['0', '2']);
        expect(utanAttr(svg)).toEqual([]);
        const med = rita(f, 600, { visaSma: true });
        expect(alla(med, '[data-marke="rutatext"]').map(texten)).toContain('TEXT-HEMLIG');
        const liten = alla(med, 'rect[data-marke="ruta"]')[1];
        expect(liten.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(liten.nextElementSibling.getAttribute('data-marke')).toBe('rander');
    });
    it('ruta utan visaText ritar ingen text; texterna ritas alla eller inga — ryms inte en ritad cells text ritas ingen', () => {
        const f = (visaText, lang, liten) => ({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100] },
            lager: [{ marke: 'ruta', visaText, data: [{ x: 'a', y: 'r', varde: 10, text: 'tio' }, { x: 'b', y: 'r', varde: 20, text: lang ? 'x'.repeat(200) : 'tjugo', ...(liten ? { liten: true } : {}) }, { x: 'c', y: 'r', varde: 30 }] }] });
        expect(alla(rita(f(false, false)), '[data-marke="rutatext"]')).toHaveLength(0);
        expect(alla(rita(f(true, false)), '[data-marke="rutatext"]').map(texten)).toEqual(['tio', 'tjugo']);
        expect(alla(rita(f(true, true)), '[data-marke="rutatext"]')).toHaveLength(0);
        // En dold liten cell med en text som inte ryms avgör ingenting: de övriga texterna ritas.
        expect(alla(rita(f(true, true, true)), '[data-marke="rutatext"]').map(texten)).toEqual(['tio']);
        expect(alla(rita(f(true, true, true), 600, { visaSma: true }), '[data-marke="rutatext"]')).toHaveLength(0);
    });
    it('rutans text syns mot sin bakgrund: ljus text på mörk ruta, mörk på ljus', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100], farger: [[0, '#ffffff'], [1, '#111827']] },
            lager: [{ marke: 'ruta', visaText: true, data: [{ x: 'a', y: 'r', varde: 0, text: 'ljus' }, { x: 'b', y: 'r', varde: 100, text: 'mörk' }] }] });
        const [ljus, mork] = alla(svg, '[data-marke="rutatext"]');
        expect(mork.getAttribute('fill')).toBe('#ffffff');
        expect(ljus.getAttribute('fill')).not.toBe('#ffffff');
    });
});

describe('Uppgift 5: färgskala och färgstapel', () => {
    const bubblor = (titel, extra = {}) => ({ beskrivning: 'b', x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Lön', format: 'kr' },
        fargskala: { typ: 'tvafarg', doman: [0, 100], titel, format: 'pct', ...extra },
        lager: [{ marke: 'punkt', serie: 'Yrken', data: [{ x: 30, y: 30000, storlek: 8, fargvarde: 10 }, { x: 50, y: 42000, storlek: 14, fargvarde: 90 }] }] });
    const stapelTexter = svg => alla(alla(svg, '[data-marke="fargstapel"]')[0].parentNode, 'text');
    it('färgstapeln: fält utan index, ändvärden som text, och titeln "Andel kvinnor" ryms okortad i bilden', () => {
        for (const b of [600, 320]) {
            const svg = rita(bubblor('Andel kvinnor'), b);
            const falt = alla(svg, 'rect[data-marke="fargstapel"]');
            expect(falt.length).toBeGreaterThan(5);
            expect(falt.every(e => !e.hasAttribute('data-l') && !e.hasAttribute('data-i') && e.getAttribute('pointer-events') === 'none')).toBe(true);
            expect(new Set(falt.map(e => e.getAttribute('fill'))).size).toBeGreaterThan(5);
            expect(stapelTexter(svg).map(texten), `${b}`).toEqual(expect.arrayContaining(['Andel kvinnor', '100,0', '0,0']));
            expect(kontrolleraYta(svg, `bubblor ${b}`)).toEqual([]);
            const rutor = stapelTexter(svg).map(textRuta);
            for (let i = 0; i < rutor.length; i++) for (let j = i + 1; j < rutor.length; j++) expect(tom(rutor[i], rutor[j]), `${b}: ${i}/${j}`).toBe(false);
        }
    });
    it('en titel som är längre än platsen kortas och bär hela titeln i title; inget hamnar utanför bilden', () => {
        const titel = 'Andel kvinnor i yrkesgruppen enligt den senaste kartläggningen';
        const svg = rita(bubblor(titel), 320);
        const t = stapelTexter(svg).find(e => e.querySelector('title'));
        expect(texten(t).endsWith('…')).toBe(true);
        expect(t.querySelector('title').textContent).toBe(titel);
        expect(kontrolleraYta(svg, 'lång färgtitel')).toEqual([]);
        expect(tal(svg.querySelector('svg[data-del="panel"]'), 'width')).toBeGreaterThan(100);   // ritytan finns kvar
    });
    it('färgstapeln kräver varken defs, gradient, id eller url(…)', () => {
        const text = ser(rita(bubblor('Andel kvinnor'), 600, { visaSma: true }));
        expect(text).not.toMatch(/ id=|url\(|<defs|<clipPath|<pattern|<linearGradient| class=| style=/);
    });
    it('mitt: en divergerande skala med mittvärde har mittfärgen där, också när domänen är sned', () => {
        w.__fs = { typ: 'divergerande', doman: [50, 200], mitt: 100 };
        const [vid100, vid125, lag, hog] = w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(100), s(125), s(50), s(200)]; })()');
        const mittfarg = w.eval('d3.color("#eeeeec").formatRgb()');   // PALETTE.divergerande: mittstoppet
        expect(w.eval(`d3.color(${JSON.stringify(vid100)}).formatRgb()`)).toBe(mittfarg);
        expect(vid125).not.toBe(vid100);
        expect(new Set([vid100, lag, hog]).size).toBe(3);
    });
    it('utan domän finns ingen skala: rutor ritas inte och ingen färgstapel reserveras eller ritas', () => {
        expect(w.eval('_rfFargskala({ typ: "sekventiell" })')).toBeNull();
        expect(w.eval('_rfFargskala({ typ: "sekventiell", doman: ["a", "b"] })')).toBeNull();
        const f = fargskala => ({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, ...(fargskala ? { fargskala } : {}), lager: [{ marke: 'punkt', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] });
        expect(ser(rita(f({ typ: 'sekventiell', titel: 'T' })))).toBe(ser(rita(f(null))));
    });
    it('färgstapeln är densamma med och utan små punkter (den följer bara figurens fargskala)', () => {
        const f = bubblor('Andel kvinnor');
        f.lager[0].data.splice(1, 0, { x: 40, y: 99999, storlek: 30, fargvarde: 5000, liten: true });
        const stapel = svg => ser(alla(svg, '[data-marke="fargstapel"]')[0].parentNode);
        expect(stapel(rita(f))).toBe(stapel(rita(bubblor('Andel kvinnor'))));
    });
});

describe('text på punkter och etikett på referenslinjer', () => {
    const f = () => ({ beskrivning: 'E', x: { skala: 'linjar' }, y: { skala: 'linjar' }, referens: [{ y: 15, etikett: '80 %', farg: '#10b981' }],
        lager: [{ marke: 'punkt', serie: 'P', farg: '#2563eb', data: [{ x: 1, y: 10, etikett: 'Ett' }, { x: 2, y: 50, etikett: 'HEMLIG', liten: true }, { x: 3, y: 20 }] }] });
    it('punktens etikett ritas över punkten, bara för ritade punkter; exporten har den', () => {
        const svg = rita(f(), 600);
        expect(alla(svg, 'text[data-marke="punktetikett"]').map(t => t.firstChild.textContent)).toEqual(['Ett']);
        expect(svg.outerHTML).not.toContain('HEMLIG');
        expect(alla(rita(f(), 600, { visaSma: true }), 'text[data-marke="punktetikett"]').map(t => t.firstChild.textContent)).toEqual(['Ett', 'HEMLIG']);
        expect(svgText(f())).toContain('>Ett<');
        expect(svgText(f())).not.toContain('HEMLIG');
    });
    it('referenslinjens etikett står vid linjens högra ände i linjens färg', () => {
        const t = rita(f(), 600).querySelector('text[data-marke="linjeetikett"]');
        expect(t.firstChild.textContent).toBe('80 %');
        expect(t.getAttribute('fill')).toBe('#10b981');
        expect(rita({ ...f(), referens: [{ y: 15 }] }, 600).querySelector('text[data-marke="linjeetikett"]')).toBeNull();
    });
});

describe('mönster på staplar och stapel på avkortad axel', () => {
    it('monster: linjer och prickar ritas som geometri i en nästlad svg, utan pattern och id', () => {
        const lager = m => ({ marke: 'stapel', serie: m, farg: '#dc2626', lage: 'overlagrad', monster: m, data: [{ x: m, y: 5 }] });
        const svg = rita({ beskrivning: 'M', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [lager('linjer'), lager('prickar')] }, 640);
        const panel = alla(svg, 'svg[data-del="panel"] svg[data-marke="monster"]');
        expect(panel).toHaveLength(2);
        expect(panel[0].querySelectorAll('line').length).toBeGreaterThan(0);
        expect(panel[1].querySelectorAll('circle').length).toBeGreaterThan(0);
        expect(svg.outerHTML).not.toMatch(/<pattern|<defs|url\(| id=/);
        expect(alla(svg, '[data-del="forklaring"] svg[data-marke="monster"]')).toHaveLength(2);
    });
    it('punkt med osäkerhet: intervallet ritas som ett streck genom punkten längs värdeaxeln, under punkten', () => {
        const f = { beskrivning: 'P', x: { skala: 'linjar', doman: [88, 112] }, y: { skala: 'band' },
            lager: [{ marke: 'punkt', riktning: 'liggande', symbol: 'romb', storlek: 6, serie: 'Avviker', farg: '#b91c1c',
                      data: [{ y: 'BAS 3', x: 93.4, fel: { lag: 90, hog: 97 } }, { y: 'BAS 4', x: 99 }] }] };
        expect(() => valideraFigur(f, 't')).not.toThrow();
        const svg = rita(f, 640);
        const fel = alla(svg, '[data-marke="fel"]'), punkter = alla(svg, '[data-marke="punkt"]');
        expect(fel).toHaveLength(1);                                                   // bara punkten som har ett intervall
        expect(punkter).toHaveLength(2);
        expect(fel[0].getAttribute('y1')).toBe(fel[0].getAttribute('y2'));             // vågrätt: värdet löper längs x
        expect(Number(fel[0].getAttribute('x1'))).toBeLessThan(Number(fel[0].getAttribute('x2')));
        expect(fel[0].compareDocumentPosition(punkter[0]) & 4).toBe(4);                // strecket före punkten: punkten överst
        expect(punkter[0].tagName.toLowerCase()).toBe('path');                         // romben
        // Intervallets ändar räknas in i axelns omfång när domänen inte är given.
        const fri = { ...f, x: { skala: 'linjar' } };
        expect(axelVarden(fri, 'x')).toEqual(expect.arrayContaining([90, 97]));
        // Ett intervall som inte är tal avvisas, som för staplar.
        expect(() => valideraFigur({ ...f, lager: [{ ...f.lager[0], data: [{ y: 'BAS 3', x: 93, fel: { lag: 'a', hog: 97 } }] }] }, 't')).toThrow(/fel\.lag/);
    });
    it('punktens symbol — cirkel, romb, kvadrat — ritas också i förklaringen, så att formen och inte bara färgen skiljer serierna', () => {
        const lager = (symbol, farg) => ({ marke: 'punkt', symbol, serie: symbol, farg, data: [{ x: 1, y: 1 }] });
        const svg = rita({ beskrivning: 'S', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [lager('cirkel', '#0f766e'), lager('romb', '#b91c1c'), lager('kvadrat', '#d97706')] }, 640);
        expect(alla(svg, 'svg[data-del="panel"] [data-marke="punkt"]').map(e => e.tagName.toLowerCase())).toEqual(['circle', 'path', 'rect']);
        expect(alla(svg, '[data-del="forklaring"] [data-prov="punkt"]').map(e => e.tagName.toLowerCase())).toEqual(['circle', 'path', 'rect']);
    });
    it('monster följer med i den exporterade bilden', () => {
        const txt = svgText({ beskrivning: 'M', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'stapel', serie: 'S', farg: '#dc2626', monster: 'linjer', data: [{ x: 'a', y: 5 }] }] });
        expect(txt).toContain('data-marke="monster"');
    });
    it('stapel på en axel som inte börjar i noll ritas från panelens kant', () => {
        const svg = rita({ beskrivning: 'D', x: { skala: 'band' }, y: { skala: 'linjar', doman: [77, 113] },
            lager: [{ marke: 'stapel', serie: 'A', farg: '#10b981', data: [{ x: 'a', y: 96 }] }] }, 640, { hojd: 320 });
        const r = svg.querySelector('rect[data-marke="stapel"]');
        const panel = r.closest('svg[data-del="panel"]');
        expect(tal(r, 'y') + tal(r, 'height')).toBeGreaterThanOrEqual(tal(panel, 'height'));
        expect(tal(r, 'y')).toBeGreaterThan(0);
    });
});

describe('Uppgift 5: referenser', () => {
    it('zon på en bandaxel täcker från första kategorins början till sista kategorins slut', () => {
        const f = { beskrivning: 'Z', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: ['a', 'b', 'c', 'd'].map((x, i) => ({ x, y: i + 1 })) }],
            referens: [{ typ: 'zon', x0: 'c', x1: 'd', etikett: 'Zon' }] };
        const svg = rita(f, 640);
        const zon = svg.querySelector('[data-marke="zon"]');
        const st = alla(svg, 'rect[data-marke="stapel"]');
        expect(zon).not.toBeNull();
        const x = tal(zon, 'x'), b = tal(zon, 'width');
        const kant = r => [tal(r, 'x'), tal(r, 'x') + tal(r, 'width')];
        expect(x).toBeLessThanOrEqual(kant(st[2])[0]);
        expect(x).toBeGreaterThanOrEqual(kant(st[1])[1]);
        expect(x + b).toBeGreaterThanOrEqual(kant(st[3])[1]);
    });
    it('zon på en bandaxel ritas inte när en gränskategori inte finns i den ritade domänen', () => {
        const f = { beskrivning: 'Z', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: [{ x: 'a', y: 1 }, { x: 'hemlig', y: 9, liten: true }] }],
            referens: [{ typ: 'zon', x0: 'hemlig', x1: 'hemlig', etikett: 'Zon' }] };
        const svg = rita(f, 640);
        expect(svg.querySelector('[data-marke="zon"]')).toBeNull();
        expect(svg.outerHTML).not.toContain('Zon');
    });
    const xy = (referens, over = {}) => ({ beskrivning: 'b', x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'linjar', doman: [0, 10] }, referens, lager: [{ marke: 'punkt', data: [{ x: 10, y: 1 }, { x: 90, y: 9 }] }], ...over });
    const zontexter = svg => alla(svg, 'text[data-marke="zonetikett"]');
    // Etikettens utsträckning i x, i panelens koordinater (etiketten ligger i panelens oklippta textgrupp).
    const xled = e => { const br = texten(e).length * tal(e, 'font-size') * NF, a = e.getAttribute('text-anchor'); const x0 = a === 'middle' ? tal(e, 'x') - br / 2 : a === 'end' ? tal(e, 'x') - br : tal(e, 'x'); return [x0, x0 + br]; };
    it('V1: zonens etikett ligger i den oklippta textgruppen, över märken och linjer, med vit kant — och inom sin zons bredd', () => {
        const svg = rita(xy([{ typ: 'zon', x0: 60, x1: 100, farg: '#fee2e2', etikett: 'Successionszon' }, { typ: 'zon', x0: 0, x1: 30, etikett: 'Nya' }, { typ: 'linje', x: 80 }], { x: { skala: 'linjar', doman: [0, 100], nollinje: true } }));
        const t = zontexter(svg), zoner = alla(svg, '[data-marke="zon"]');
        expect(t.map(texten)).toEqual(['Successionszon', 'Nya']);
        const panel = svg.querySelector('svg[data-del="panel"]');
        for (const [i, e] of t.entries()) {
            expect(e.closest('svg[data-del="panel"]')).toBeNull();                                           // inte klippt
            expect(panel.compareDocumentPosition(e) & 4, 'efter panelens svg i dokumentet').toBeTruthy();    // ritas över märken, referenslinjer och nollinjer
            expect(e.getAttribute('stroke')).toBe('#ffffff');
            expect(e.getAttribute('paint-order')).toBe('stroke');
            expect(e.getAttribute('stroke-linejoin')).toBe('round');
            expect(tal(e, 'stroke-width')).toBeGreaterThan(0);
            expect(e.getAttribute('pointer-events')).toBe('none');
            expect(e.hasAttribute('data-l') || e.hasAttribute('data-i')).toBe(false);
            const [x0, x1] = xled(e), z = zoner[i];
            expect(x0).toBeGreaterThanOrEqual(tal(z, 'x'));
            expect(x1).toBeLessThanOrEqual(tal(z, 'x') + tal(z, 'width'));
            expect(tal(e, 'y') - tal(e, 'font-size')).toBeLessThan(6);                                       // överst i zonen
        }
        expect(kontrolleraYta(svg, 'zoner')).toEqual([]);
    });
    it('V1: en etikett som inte ryms i sin zons bredd kortas med … och title; ryms färre än tre tecken ritas den inte', () => {
        const svg = rita(xy([{ typ: 'zon', x0: 40, x1: 52, etikett: 'En väldigt lång etikett' }, { typ: 'zon', x0: 90, x1: 91, etikett: 'Smal zon' }, { typ: 'zon', x0: 0, x1: 4, etikett: 'OK' }]), 600);
        const t = zontexter(svg);
        expect(t.map(e => texten(e))).toEqual([expect.stringMatching(/^En.*…$/), 'OK']);
        expect(texten(t[0]).length).toBeGreaterThanOrEqual(3);
        expect(t[0].querySelector('title').textContent).toBe('En väldigt lång etikett');
        expect(t[1].querySelector('title')).toBeNull();
        const z = alla(svg, '[data-marke="zon"]')[0], [x0, x1] = xled(t[0]);
        expect(x0).toBeGreaterThanOrEqual(tal(z, 'x'));
        expect(x1).toBeLessThanOrEqual(tal(z, 'x') + tal(z, 'width'));
        expect(alla(svg, '[data-marke="zon"]')).toHaveLength(3);   // zonen ritas även när etiketten utelämnas
    });
    it('V1: en zonetikett läggs inte över en stapeletikett eller en annan zonetikett; vågrät zon har etiketten i sitt övre vänstra hörn', () => {
        const f = staplar({ y: { skala: 'linjar', titel: 'Antal' }, referens: [{ typ: 'zon', y0: 80, farg: '#fee2e2', etikett: 'Successionszon (60+)' }, { typ: 'zon', y0: 90, etikett: 'Överst' }],
            lager: [{ marke: 'stapel', serie: 'Antal', data: ['a', 'b', 'c'].map((x, i) => ({ x, y: [108, 60, 107][i], etikett: `${[108, 60, 107][i]} st` })) }] });
        for (const b of [600, 340]) {
            const svg = rita(f, b);
            expect(zontexter(svg).length, `${b}`).toBeGreaterThan(0);
            expect(kontrolleraYta(svg, `zon + stapeletiketter ${b}`)).toEqual([]);
        }
        const svg = rita(xy([{ typ: 'zon', y0: 2, y1: 6, etikett: 'Vågrät' }]));
        const [e] = zontexter(svg), [z] = alla(svg, '[data-marke="zon"]');
        expect(tal(e, 'x')).toBeLessThan(10);
        expect(tal(e, 'y') - tal(e, 'font-size')).toBeGreaterThanOrEqual(tal(z, 'y') - 1);
        expect(tal(e, 'y')).toBeLessThan(tal(z, 'y') + 20);
    });
    it('zon utan ena gränsen når axelns ände; vågrät zon; zon på kategoriaxel kräver kända kategorier', () => {
        const svg = rita(xy([{ typ: 'zon', x0: 60 }, { typ: 'zon', y0: 2, y1: 4 }]));
        const p = svg.querySelector('svg[data-del="panel"]');
        const [lod, vag] = alla(svg, '[data-marke="zon"]');
        expect(tal(lod, 'x') + tal(lod, 'width')).toBeCloseTo(tal(p, 'width'), 6);
        expect(tal(lod, 'height')).toBeCloseTo(tal(p, 'height'), 6);
        expect(tal(vag, 'width')).toBeCloseTo(tal(p, 'width'), 6);
        expect(tal(vag, 'height')).toBeGreaterThan(0);
        // En zon på en kategoriaxel ritas mellan kategorier som finns; en okänd kategori ger ingen zon.
        expect(alla(rita(staplar({ referens: [{ typ: 'zon', x0: 'A', x1: 'B' }] })), '[data-marke="zon"]')).toHaveLength(1);
        expect(alla(rita(staplar({ referens: [{ typ: 'zon', x0: 'A', x1: 'FINNS-INTE' }] })), '[data-marke="zon"]')).toHaveLength(0);
    });
    it('linje på höger axel följer y2; linje på en kategori ligger mitt i bandet; okänd kategori ritas inte', () => {
        const svg = rita(staplar({ y2: { skala: 'linjar', doman: [0, 100] }, referens: [{ typ: 'linje', y: 50, axel: 'y2' }, { typ: 'linje', x: 'B', streck: 'prickad' }, { typ: 'linje', x: 'Finns inte' }],
            lager: [...staplar().lager, { marke: 'linje', axel: 'y2', serie: 'N', data: [{ x: 'A', y: 0 }, { x: 'B', y: 100 }] }] }));
        const [vag, lod] = alla(svg, '[data-marke="referenslinje"]');
        expect(alla(svg, '[data-marke="referenslinje"]')).toHaveLength(2);
        const h = tal(svg.querySelector('svg[data-del="panel"]'), 'height');
        expect(tal(vag, 'y1')).toBeGreaterThan(h * 0.35);
        expect(tal(vag, 'y1')).toBeLessThan(h * 0.65);
        expect(lod.getAttribute('stroke-dasharray')).toBe('2 3');
        const b = alla(svg, 'rect[data-marke="stapel"]').filter(e => e.getAttribute('data-i') === '1');
        expect(tal(lod, 'x1')).toBeGreaterThan(tal(b[0], 'x'));
        expect(tal(lod, 'x1')).toBeLessThan(tal(b[1], 'x') + tal(b[1], 'width'));
    });
    it('referenser bär inga index och tar inte emot pekaren; ordningen i panelen är zoner, märken, linjer, nollinjer', () => {
        const svg = rita(xy([{ typ: 'linje', x: 40 }, { typ: 'zon', x0: 60, x1: 100, etikett: 'Z' }], { x: { skala: 'linjar', doman: [-10, 100], nollinje: true } }));
        for (const e of alla(svg, '[data-marke="zon"], [data-marke="referenslinje"]')) {
            expect(e.hasAttribute('data-l') || e.hasAttribute('data-i')).toBe(false);
            expect(e.getAttribute('pointer-events')).toBe('none');
        }
        const ordning = [...svg.querySelector('svg[data-del="panel"]').children].map(e => e.getAttribute('data-marke') || e.tagName);
        expect(ordning).toEqual(['zon', 'punkt', 'punkt', 'referenslinje', 'nollinje']);   // zonens etikett ligger i textgruppen, över alltihop (V1)
    });
    it('referenser med ogiltiga värden ritas inte och ger inga NaN', () => {
        const svg = rita(xy([{ typ: 'linje', x: 'abc' }, { typ: 'linje' }, { typ: 'zon', x0: NaN, x1: 5 }, { typ: 'zon' }, null, { typ: 'linje', y: Infinity }]));
        expect(alla(svg, '[data-marke="zon"], [data-marke="referenslinje"]')).toHaveLength(0);
        for (const el of alla(svg, '*')) for (const a of el.attributes) expect(a.value, `${el.tagName} ${a.name}`).not.toMatch(/NaN|undefined|null|Infinity/);
    });
});

describe('Uppgift 5: text innanför bilden för de nya märkena', () => {
    const K5 = ['Undersköterska', 'Förskollärare', 'Socialsekreterare', 'Ingenjör', 'Systemutvecklare'];
    const loner = (k, s) => Array.from({ length: 14 }, (_, i) => 26000 + k * 2500 + s * 1200 + ((i * 7919) % 9000) + (i === 13 ? 30000 : 0));
    const lador = punkter => ({ beskrivning: 'b', x: { skala: 'band', titel: 'Yrke' }, y: { skala: 'linjar', titel: 'Lön', format: 'kr' },
        lager: ['Kvinna', 'Man'].map((serie, s) => ({ marke: 'lada', punkter, serie, data: K5.flatMap((x, k) => loner(k, s).map(y => ({ x, y }))) })) });
    const heat = (paneler) => ({ beskrivning: 'b', x: { skala: 'band', titel: 'Åldersgrupp' }, y: { skala: 'band' }, ...(paneler ? { paneler } : {}),
        fargskala: { typ: 'divergerande', doman: [80, 120], mitt: 100, titel: 'Index mot median' },
        lager: (paneler || [null]).map((panel, p) => ({ marke: 'ruta', serie: 'Index', visaText: true, ...(panel ? { panel } : {}),
            data: ['–24', '25–34', '35–44', '45–54', '55–64', '65–', 'Okänd', 'Alla'].flatMap((x, i) => ['Nivå 1', 'Nivå 2', 'Nivå 3', 'Nivå 4', 'Nivå 5', 'Nivå 6'].map((y, j) => ({ x, y, varde: 82 + ((i * 5 + j * 7 + p * 3) % 37), text: String(82 + ((i * 5 + j * 7 + p * 3) % 37)) }))) })) });
    const figurer = [
        ['band och trendlinjer', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Lön', format: 'kr' }, lager: [
            { marke: 'band', serie: 'KI kvinnor', farg: '#e74c8b', data: [25, 35, 45, 55, 65].map((x, i) => ({ x, lag: 26000 + i * 1500, hog: 30000 + i * 2200 })) },
            { marke: 'linje', serie: 'Kvinnor', farg: '#e74c8b', data: [25, 35, 45, 55, 65].map((x, i) => ({ x, y: 28000 + i * 1850 })) }] }],
        ['liggande intervall med medianer', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' }, y: { skala: 'band' }, lager: [
            { marke: 'intervall', riktning: 'liggande', serie: 'Marknad P10–P90', farg: '#94a3b8', tjocklek: 12, data: K5.map((y, i) => ({ y, lag: 24000 + i * 3000, hog: 36000 + i * 4500 })) },
            { marke: 'intervall', riktning: 'liggande', serie: 'Egen P10–P90', farg: '#2563eb', tjocklek: 5, data: K5.map((y, i) => ({ y, lag: 26000 + i * 2800, hog: 33000 + i * 4000 })) },
            { marke: 'punkt', symbol: 'streck', serie: 'Marknad median', farg: '#475569', data: K5.map((y, i) => ({ y, x: 30000 + i * 3600 })) },
            { marke: 'punkt', serie: 'Egen median', farg: '#1d4ed8', data: K5.map((y, i) => ({ y, x: 29500 + i * 3400 })) }] }],
        ['lådor två serier', lador('avvikare')],
        ['alla individer två serier', lador('alla')],
        ['värmekarta 8 × 6 med text', heat()],
        ['värmekarta i två paneler', heat(['Kvinna', 'Man'])],
        ['bubblor med färgstapeln Andel kvinnor', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Medianlön', format: 'kr' }, y: { skala: 'linjar', titel: 'Lönegap', format: 'pct' },
            fargskala: { typ: 'tvafarg', doman: [0, 100], titel: 'Andel kvinnor', format: 'pct' },
            lager: [{ marke: 'punkt', serie: 'Yrken', opacitet: 0.8, data: Array.from({ length: 12 }, (_, i) => ({ x: 26000 + i * 2100, y: -6 + ((i * 5) % 13), storlek: 5 + (i * 3) % 14, fargvarde: (i * 37) % 101 })) }] }],
        ['färgstapel ihop med höger axel', { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar', format: 'kr' }, y2: { skala: 'linjar', titel: 'Antal anställda', format: 'antal' },
            fargskala: { typ: 'sekventiell', doman: [0, 250000], titel: 'Kostnad', format: 'kr' },
            lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 'A', y: 30000, fargvarde: 1000 }, { x: 'B', y: 41000, fargvarde: 240000 }] }, { marke: 'linje', axel: 'y2', serie: 'N', data: [{ x: 'A', y: 5 }, { x: 'B', y: 1500 }] }] }],
        ['zoner och referenslinjer', { beskrivning: 'b', x: { skala: 'linjar', titel: 'Ålder', doman: [18, 70] }, y: { skala: 'linjar', titel: 'Lön', format: 'kr' },
            referens: [{ typ: 'zon', x0: 60, x1: 70, farg: '#fee2e2', etikett: 'Successionszon' }, { typ: 'zon', x0: 18, x1: 25, etikett: 'Nya i yrket' }, { typ: 'linje', x: 40, streck: 'streckad' }, { typ: 'linje', y: 35000, streck: 'prickad' }],
            lager: [{ marke: 'punkt', serie: 'Anställda', data: Array.from({ length: 40 }, (_, i) => ({ x: 19 + (i * 37) % 50, y: 26000 + ((i * 7919) % 20000) })) }] }],
    ];
    for (const [namn, f] of figurer) {
        for (const b of [640, 320]) {
            it(`${namn} (${b} px): ingen text utanför bilden, inga NaN, inga förbjudna element; samma SVG varje gång`, () => {
                for (const visaSma of [false, true]) {
                    const svg = rita(f, b, { visaSma });
                    expect(kontrolleraYta(svg, namn)).toEqual([]);
                    for (const el of alla(svg, '*')) for (const a of el.attributes) expect(a.value, `${el.tagName} ${a.name}`).not.toMatch(/NaN|undefined|null|Infinity/);
                    const text = ser(svg);
                    expect(text).not.toMatch(/ id=|url\(|<defs|<clipPath|<pattern|<linearGradient|<style| class=| style=|foreignObject/);
                    expect(ser(rita(f, b, { visaSma }))).toBe(text);
                }
            });
        }
    }
    it('rutornas texter ligger i sina rutor och överlappar inte varandra', () => {
        const svg = rita(heat(), 640);
        const t = alla(svg, '[data-marke="rutatext"]');
        expect(t).toHaveLength(48);
        const rutor = t.map(textRuta);
        for (let i = 0; i < rutor.length; i++) for (let j = i + 1; j < rutor.length; j++) expect(tom(rutor[i], rutor[j])).toBe(false);
    });
    it('märkenamnen: de åtta märkena finns i _RF_MARKEN', () => {
        expect(w.__rfMarken()).toEqual(['stapel', 'punkt', 'linje', 'band', 'intervall', 'lada', 'ruta', 'yta']);
    });
});

// ---------------------------------------------------------------------------------------------
// Uppgift 5, rättning 1 (V2, V3, V5)
// ---------------------------------------------------------------------------------------------
describe('Rättning 1, V2: färgskalans domän', () => {
    const heat = doman => ({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'divergerande', doman, titel: 'Index' },
        lager: [{ marke: 'ruta', data: [{ x: 'a', y: 'r', varde: 99 }, { x: 'b', y: 'r', varde: 100 }, { x: 'c', y: 'r', varde: 101 }] }] });
    const stapelTexter = svg => alla(alla(svg, '[data-marke="fargstapel"]')[0].parentNode, 'text').map(texten);
    it('lika gränser vidgas med ±1 kring värdet: rutorna ritas, med skilda färger, och färgstapeln visar 99–101', () => {
        const svg = rita(heat([100, 100]));
        const r = alla(svg, 'rect[data-marke="ruta"]');
        expect(r).toHaveLength(3);
        expect(new Set(r.map(e => e.getAttribute('fill'))).size).toBe(3);
        expect(stapelTexter(svg)).toEqual(expect.arrayContaining(['101', '99', 'Index']));
        expect(kontrolleraYta(svg, 'lika gränser')).toEqual([]);
        w.__fs = { typ: 'divergerande', doman: [100, 100] };
        const [a, b, c] = w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(99), s(100), s(101)]; })()');
        w.__fs = { typ: 'divergerande', doman: [99, 101] };
        expect(w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(99), s(100), s(101)]; })()')).toEqual([a, b, c]);
    });
    it('omvänd domän ger omvänd skala; färgstapeln har ändå det största värdet överst', () => {
        w.__fs = { typ: 'sekventiell', doman: [80, 120] };
        const fram = w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(80), s(90), s(120), s(500)]; })()');
        w.__fs = { typ: 'sekventiell', doman: [120, 80] };
        const bak = w.eval('(() => { const s = _rfFargskala(window.__fs); return [s(120), s(110), s(80), s(-500)]; })()');
        expect(bak).toEqual(fram);
        const svg = rita(heat([120, 80]));
        const texter = alla(alla(svg, '[data-marke="fargstapel"]')[0].parentNode, 'text').filter(t => /^\d+$/.test(texten(t)));
        const overst = texter.slice().sort((p, q) => tal(p, 'y') - tal(q, 'y'))[0];
        expect(texten(overst)).toBe('120');
        // Det översta fältet har färgen för 120 — i den omvända skalan stoppet 0.
        const falt = alla(svg, 'rect[data-marke="fargstapel"]');
        w.__fs = heat([120, 80]).fargskala;
        w.__v = 120 - 20 / falt.length;   // det översta fältets mittvärde
        expect(falt[0].getAttribute('fill')).toBe(w.eval('_rfFargskala(window.__fs)(window.__v)'));
        expect(falt[0].getAttribute('fill')).not.toBe(falt[falt.length - 1].getAttribute('fill'));
    });
    it('färgstapelns mittvärde står på sin plats när skalan har mitt', () => {
        const svg = rita({ ...heat([80, 120]), fargskala: { typ: 'divergerande', doman: [80, 120], mitt: 100, titel: 'Index' } });
        const g = alla(svg, '[data-marke="fargstapel"]')[0].parentNode;
        const t = alla(g, 'text').filter(e => /^\d+$/.test(texten(e)));
        expect(t.map(texten)).toEqual(['120', '80', '100']);
        const [topp, botten, mitt] = t.map(e => tal(e, 'y'));
        expect(mitt).toBeGreaterThan(topp + 11);
        expect(mitt).toBeLessThan(botten - 11);
        expect(Math.abs((topp + botten) / 2 - mitt)).toBeLessThan(8);
        // Utan mitt: bara ändvärdena.
        expect(stapelTexter(rita(heat([80, 120]))).filter(x => /^\d+$/.test(x))).toEqual(['120', '80']);
    });
});

describe('Rättning 1, V3: individpunkter nedsamplas', () => {
    const manga = (n, sma) => ({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'lada', punkter: 'alla', serie: 'L',
        data: Array.from({ length: n }, (_, i) => ({ x: `K${i % 4}`, y: 100 + ((i * 7919) % 500), ...(sma && i % 5 === 1 ? { liten: true } : {}) })) }] });
    it('fler individer än SCATTER_MAX_POINTS: var k:te ritas, antalet anges, data-i pekar på originalet', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const svg = rita(manga(max * 3));
        const p = alla(svg, '[data-marke="individ"]');
        expect(p).toHaveLength(max);
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${max}/${max * 3}`);
        expect(new Set(p.map(e => Number(e.getAttribute('data-i')) % 3))).toEqual(new Set([0]));
        expect(rita(manga(max)).getAttribute('data-nedsamplat')).toBeNull();
        expect(alla(rita(manga(max)), '[data-marke="individ"]')).toHaveLength(max);
    });
    it('små individer tas bort före urvalet; lådor (avvikare) nedsamplas aldrig', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const f = manga(max * 2, true);
        const svg = rita(f);
        const kvar = f.lager[0].data.filter(d => !d.liten).length;
        const p = alla(svg, '[data-marke="individ"]');
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${p.length}/${kvar}`);
        expect(p.length).toBeLessThanOrEqual(max);
        expect(p.some(e => f.lager[0].data[Number(e.getAttribute('data-i'))].liten)).toBe(false);
        const lada = rita({ ...f, lager: [{ ...f.lager[0], punkter: 'avvikare' }] });
        expect(lada.getAttribute('data-nedsamplat')).toBeNull();
        expect(alla(lada, 'rect[data-marke="lada"]')).toHaveLength(4);
    });
    it('figurlistan har ett individlager som nedsamplas, med små individer som inte ligger sist', () => {
        const [, figur] = ritfigurer().find(([namn]) => namn === 'individer som nedsamplas');
        expect(rita(figur, 600).getAttribute('data-nedsamplat')).toMatch(/^\d+\/\d+$/);
        const d = figur.lager[0].data;
        expect(d[0].liten).toBe(true);
        expect(d[d.length - 1].liten).toBeFalsy();
    });
});

describe('Rättning 1, V5: smått', () => {
    const ind = (x, loner, sma = []) => loner.map((y, i) => (sma.includes(i) ? { x, y, liten: true } : { x, y }));
    it('spridningen i sidled flyttar sig inte när små grupper visas: de små får ordningsnummer efter de övriga', () => {
        const f = staplar({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'L', data: [...ind('A', [10, 11, 12, 13, 14, 15], [0, 3]), ...ind('B', [20, 21, 22], [1])] }] });
        const lage = svg => Object.fromEntries(alla(svg, '[data-marke="individ"]').map(e => [e.getAttribute('data-i'), `${e.getAttribute('cx')}`]));
        const utan = lage(rita(f)), med = lage(rita(f, 600, { visaSma: true }));
        expect(Object.keys(med)).toHaveLength(9);
        expect(Object.keys(utan).sort()).toEqual(['1', '2', '4', '5', '6', '8']);
        for (const i of Object.keys(utan)) expect(med[i], `individ ${i}`).toBe(utan[i]);
    });
    it('ett band över kategorier byggs i axelns ordning, inte i datans', () => {
        const f = { beskrivning: 'b', x: { skala: 'band', ordning: ['A', 'B', 'C', 'D'] }, y: { skala: 'linjar' }, lager: [{ marke: 'band', serie: 'KI', data: [{ x: 'C', lag: 3, hog: 5 }, { x: 'A', lag: 1, hog: 3 }, { x: 'D', lag: 4, hog: 6 }, { x: 'B', lag: 2, hog: 4 }] }] };
        const d = alla(rita(f), 'path[data-marke="band"]')[0].getAttribute('d');
        const xs = [...d.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map(m => Number(m[1]));
        expect(xs).toHaveLength(8);
        expect(xs.slice(0, 4)).toEqual([...xs.slice(0, 4)].sort((a, b) => a - b));      // övre kanten: vänster till höger
        expect(xs.slice(4)).toEqual([...xs.slice(4)].sort((a, b) => b - a));            // undre kanten tillbaka
        expect(new Set(xs.slice(0, 4)).size).toBe(4);
        // På en talaxel gäller dataordningen, som för linjer.
        const tal_ = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'band', data: [{ x: 3, lag: 3, hog: 5 }, { x: 1, lag: 1, hog: 3 }] }] };
        const xt = [...alla(rita(tal_), 'path[data-marke="band"]')[0].getAttribute('d').matchAll(/[ML]([-\d.]+),/g)].map(m => Number(m[1]));
        expect(xt[0]).toBeGreaterThan(xt[1]);
    });
    it('text på en liten (randig) ruta har en kant i motsatt färg: vit kring mörk text, mörk kring vit', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100], farger: [[0, '#ffffff'], [1, '#111827']] },
            lager: [{ marke: 'ruta', visaText: true, data: [{ x: 'a', y: 'r', varde: 0, text: 'ljus', liten: true }, { x: 'b', y: 'r', varde: 100, text: 'mörk', liten: true }, { x: 'c', y: 'r', varde: 0, text: 'stor' }] }] }, 600, { visaSma: true });
        const [ljus, mork, stor] = alla(svg, '[data-marke="rutatext"]');
        expect(ljus.getAttribute('fill')).not.toBe('#ffffff');
        expect(ljus.getAttribute('stroke')).toBe('#ffffff');
        expect(mork.getAttribute('fill')).toBe('#ffffff');
        expect(mork.getAttribute('stroke')).toBe(ljus.getAttribute('fill'));
        for (const t of [ljus, mork]) expect(t.getAttribute('paint-order')).toBe('stroke');
        expect(stor.hasAttribute('stroke')).toBe(false);
    });
    it('de nya märkena följer höger axel med axel: "y2"', () => {
        const fig = lager => staplar({ y: { skala: 'linjar', doman: [0, 1000] }, y2: { skala: 'linjar', doman: [0, 100] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1000 }, { x: 'B', y: 500 }] }, lager] });
        const h = svg => tal(svg.querySelector('svg[data-del="panel"]'), 'height');
        const i = rita(fig({ marke: 'intervall', axel: 'y2', data: [{ x: 'A', lag: 0, hog: 100 }] }));
        expect(tal(alla(i, '[data-marke="intervall"]')[0], 'y1')).toBeLessThan(h(i) * 0.1);
        const l = rita(fig({ marke: 'lada', axel: 'y2', data: [80, 90, 100].map(y => ({ x: 'A', y })) }));
        expect(tal(alla(l, 'rect[data-marke="lada"]')[0], 'y')).toBeLessThan(h(l) * 0.25);
        const a = rita(fig({ marke: 'lada', axel: 'y2', punkter: 'alla', data: [90, 100].map(y => ({ x: 'A', y })) }));
        expect(Math.max(...alla(a, '[data-marke="individ"]').map(e => tal(e, 'cy')))).toBeLessThan(h(a) * 0.25);
        const b = rita(fig({ marke: 'band', axel: 'y2', data: [{ x: 'A', lag: 90, hog: 100 }, { x: 'B', lag: 90, hog: 100 }] }));
        const ys = [...alla(b, 'path[data-marke="band"]')[0].getAttribute('d').matchAll(/[ML][-\d.]+,([-\d.]+)/g)].map(m => Number(m[1]));
        expect(Math.max(...ys)).toBeLessThan(h(b) * 0.25);
    });
    it('låda på en omvänd y-axel: lådan har positiv höjd, medianen ligger i den, och högre löner ligger längre ned', () => {
        const svg = rita(staplar({ y: { skala: 'linjar', omvand: true }, lager: [{ marke: 'lada', serie: 'L', data: [...ind('A', [10, 12, 13, 14, 15, 16, 30]), ...ind('B', [40, 42, 44, 46])] }] }));
        const [a, b] = alla(svg, 'rect[data-marke="lada"]');
        const [ma] = alla(svg, '[data-marke="median"]');
        expect(tal(a, 'height')).toBeGreaterThan(1);
        expect(tal(ma, 'y1')).toBeGreaterThan(tal(a, 'y'));
        expect(tal(ma, 'y1')).toBeLessThan(tal(a, 'y') + tal(a, 'height'));
        expect(tal(b, 'y')).toBeGreaterThan(tal(a, 'y') + tal(a, 'height'));
        expect(tal(alla(svg, '[data-marke="avvikare"]')[0], 'cy')).toBeGreaterThan(tal(a, 'y') + tal(a, 'height'));
    });
    it('ett lådlager som dolts via förklaringen lämnar sin plats: de övriga står som om det inte fanns', () => {
        const lager = [{ marke: 'lada', serie: 'K', farg: '#e74c8b', data: ind('A', [10, 12, 14]) }, { marke: 'lada', serie: 'M', farg: '#0077bc', data: ind('A', [11, 13, 15]) }];
        const x = svg => alla(svg, 'rect[data-marke="lada"]').map(e => `${e.getAttribute('x')}|${e.getAttribute('width')}`);
        const dold = rita(staplar({ lager }), 600, { dolda: new Set(['M']) });
        expect(x(dold)).toEqual(x(rita(staplar({ lager: [lager[0]] }))));
        expect(x(dold)).not.toEqual(x(rita(staplar({ lager }))).slice(0, 1));
        expect(alla(dold, '[data-serie]').map(g => g.getAttribute('data-serie'))).toEqual(['K', 'M']);
    });
    it('en individ med egen färg ritas i den', () => {
        const svg = rita(staplar({ lager: [{ marke: 'lada', punkter: 'alla', farg: '#111111', data: [{ x: 'A', y: 1 }, { x: 'A', y: 2, farg: '#abcdef' }] }] }));
        expect(alla(svg, '[data-marke="individ"]').map(e => e.getAttribute('fill'))).toEqual(['#111111', '#abcdef']);
    });
});

// ---- Uppgift 6: sidan (ritaFigur, rensaFigur) ----
// jsdom saknar layout (clientWidth sätts av testet) och PointerEvent: händelserna skickas som MouseEvent med
// pekarhändelsernas namn, vilket lyssnarna tar emot.
const behallare = (id = 'chart-test', bredd = 600) => {
    const d = w.document;
    d.getElementById(id)?.parentElement.remove();
    const kort = d.createElement('div'); kort.className = 'card';
    const el = d.createElement('div'); el.id = id;
    Object.defineProperty(el, 'clientWidth', { value: bredd, configurable: true });
    kort.appendChild(el); d.body.appendChild(kort);
    return el;
};
const ritaI = (el, figur, val = {}) => { w.__f = figur; w.__val = val; w.__el = el; return w.eval('ritaFigur(window.__el, window.__f, window.__val)'); };
const handelse = (typ, over = {}) => new w.MouseEvent(typ, { bubbles: true, clientX: 50, clientY: 60, ...over });
const egenSvg = el => el.querySelector(':scope > svg');
const tipset = () => w.document.querySelector('.chart-tip-portal');   // portalens element (_ensureChartTip): klass, inget id
const tipsSyns = () => !!tipset() && tipset().classList.contains('visible');
const individer = (x, loner, sma = []) => loner.map((y, i) => (sma.includes(i) ? { x, y, liten: true, nyckel: `person-${x}-${i}`, namn: 'HEMLIG' } : { x, y, nyckel: `person-${x}-${i}`, namn: `N${i}` }));

describe('ritaFigur', () => {
    it('ritar en svg i behållarens bredd, sparar figuren och hänger på exportmenyn', () => {
        const el = behallare();
        expect(ritaI(el, staplar())).toBe(el);
        const svg = egenSvg(el);
        expect(svg.getAttribute('role')).toBe('group');
        expect(svg.getAttribute('width')).toBe('600');
        expect(el.children).toHaveLength(1);
        expect(el._figur.beskrivning).toBe('Medianlön per BAS och kön');
        expect(el.parentElement.querySelector('.chart-export-btn')).not.toBeNull();
        expect(el.data).toBeUndefined();                              // figuren ligger i el._figur, inte som data/layout
    });
    it('godtar id som sträng; okänt id ger null utan fel; val får vara null', () => {
        behallare('chart-test');
        w.__f = staplar();
        expect(w.eval('ritaFigur("chart-test", window.__f)').id).toBe('chart-test');
        expect(w.eval('ritaFigur("finns-inte", window.__f)')).toBeNull();
        expect(w.eval('ritaFigur(null, window.__f)')).toBeNull();
        expect(w.eval('ritaFigur(42, window.__f)')).toBeNull();
        expect(w.eval('ritaFigur("chart-test", window.__f, null)').querySelector(':scope > svg')).not.toBeNull();
    });
    it('ritaren får ORIGINALFIGUREN: data-l/data-i och palettfärger följer den, också när små punkter är dolda', () => {
        const el = behallare();
        const f = staplar({ lager: [
            { marke: 'stapel', serie: 'Liten', data: [{ x: 'A', y: 77777, liten: true }] },
            { marke: 'stapel', serie: 'Stor', data: [{ x: 'B', y: 5, liten: true }, { x: 'A', y: 10 }] }] });
        ritaI(el, f);
        const s = alla(el, '[data-marke="stapel"]');
        expect(s.map(e => [e.getAttribute('data-l'), e.getAttribute('data-i')])).toEqual([['1', '1']]);
        w.__f = f;
        expect(s[0].getAttribute('fill')).toBe(alla(w.eval('_rfByggSvg(window.__f, 600, {})'), '[data-marke="stapel"]')[0].getAttribute('fill'));
        expect(el._figur).toBe(f);
        expect(el._figurRitad).toBeUndefined();
    });
    it('omritning ersätter svg:n och dubblerar inte lyssnarna', () => {
        const el = behallare();
        let klick = 0;
        ritaI(el, staplar(), { vidKlick: () => { klick++; } });
        ritaI(el, staplar(), { vidKlick: () => { klick++; } });
        expect(el.querySelectorAll(':scope > svg')).toHaveLength(1);
        expect(el.children).toHaveLength(1);
        expect(el.parentElement.querySelectorAll('.chart-export-btn')).toHaveLength(1);
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('click'));
        expect(klick).toBe(1);
    });
    it('ogiltig figur: felet rapporteras, behållaren säger att diagrammet inte kunde ritas, inget kastas', () => {
        const el = behallare();
        ritaI(el, staplar());
        w.__state._interntFel = [];
        expect(() => ritaI(el, { beskrivning: '', x: {}, y: {}, lager: [] })).not.toThrow();
        expect(el.textContent).toBe('Diagrammet kunde inte ritas.');
        expect(el.querySelector('svg')).toBeNull();
        expect(el._figur).toBeUndefined();
        expect(w.__state._interntFel.some(f => f.plats === 'diagram chart-test')).toBe(true);
        expect(() => ritaI(el, null)).not.toThrow();
        expect(el.textContent).toBe('Diagrammet kunde inte ritas.');
        // Ett annat diagram på sidan berörs inte, och behållaren går att rita i igen.
        const annan = behallare('chart-annan');
        ritaI(annan, staplar());
        expect(egenSvg(annan)).not.toBeNull();
        ritaI(el, staplar());
        expect(egenSvg(el)).not.toBeNull();
        expect(el.textContent).not.toContain('kunde inte ritas');
        w.__state._interntFel = [];
    });
    it('ett fel under ritningen (inte i valideringen) fångas på samma sätt — också vid omritning efter storleksändring', () => {
        const el = behallare();
        w.__state._interntFel = [];
        const f = staplar();
        ritaI(el, f);
        // En figur som ändras i efterhand så att ritaren kastar: dolda-mängden byts mot något som saknar has().
        el._figurDolda = { inte: 'en mängd' };
        Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true });
        expect(() => w.eval('_rfOmStorlek(window.__el)')).not.toThrow();
        expect(el.textContent).toBe('Diagrammet kunde inte ritas.');
        expect(w.__state._interntFel.some(x => x.plats === 'diagram chart-test')).toBe(true);
        w.__state._interntFel = [];
    });
    it('inga datapunkter kvar: tomtext och inget annat — inget koordinatsystem, ingen förklaring, inget fel', () => {
        const el = behallare();
        w.__state._interntFel = [];
        const baraSma = staplar({ lager: [{ marke: 'stapel', serie: 'HEMLIG-SERIE', data: [{ x: 'HEMLIG-KAT', y: 77777, liten: true }] }] });
        ritaI(el, baraSma, { tomtext: 'Inga grupper att visa' });
        expect(el.querySelector('svg')).toBeNull();
        expect(el.textContent).toBe('Inga grupper att visa');
        expect(el.children).toHaveLength(1);
        expect(el.outerHTML).not.toMatch(/HEMLIG|77777|77 777/);
        expect(w.document.getElementById('chart-test-sample-note')).toBeNull();
        expect(w.__state._interntFel).toEqual([]);
        ritaI(el, baraSma);
        expect(el.textContent).toBe('Inget att visa');
        ritaI(el, baraSma, { visaSma: true });
        expect(el.querySelectorAll('[data-marke="stapel"]')).toHaveLength(1);
        expect(el.textContent).not.toContain('Inget att visa');
        ritaI(el, staplar({ lager: [{ marke: 'stapel', data: [] }] }));
        expect(el.textContent).toBe('Inget att visa');
    });
    it('tomtexten skrivs som text, inte som HTML', () => {
        const el = behallare();
        ritaI(el, staplar({ lager: [{ marke: 'stapel', data: [] }] }), { tomtext: '<b>tomt</b>' });
        expect(el.querySelector('b')).toBeNull();
        expect(el.textContent).toBe('<b>tomt</b>');
    });
    it('inget av figuren skrivs i DOM som attribut: behållaren och svg:n bär inga data-attribut med figurens innehåll', () => {
        const el = behallare();
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 10, nyckel: 'A|1' }, { x: 'HEMLIG-KAT', y: 77777, liten: true, nyckel: 'NYCK-HEMLIG', etikett: 'ETIK-HEMLIG' }] }] });
        ritaI(el, f, { vidKlick: () => {} });
        expect(el.parentElement.outerHTML).not.toMatch(/HEMLIG|77777|77 777/);
        expect([...el.attributes].map(a => a.name)).toEqual(['id']);
        // Egenskaperna på elementet: bara de dokumenterade.
        expect(Object.keys(el).filter(k => k.startsWith('_')).sort()).toEqual(['_chartExportAttached', '_exportBeskrivning', '_figur', '_figurBredd', '_figurDolda', '_figurVal', '_rfKoppling', '_rfRitadFigur']);
    });
    it('verktygstips: lagrets tips får datapunkten; raderna escapas; musen ut döljer', () => {
        const el = behallare();
        const f = staplar();
        const sett = [];
        f.lager[0].tips = (d, s) => { sett.push([d, s]); return [[`<b>${d.x}</b>`], ['Median', `${d.y} kr`]]; };
        ritaI(el, f);
        el.querySelectorAll('[data-marke="stapel"]')[1].dispatchEvent(handelse('pointermove'));
        const tip = tipset();
        expect(tip, 'portalens element').not.toBeNull();
        expect(tip.querySelector('b')).toBeNull();
        expect(tip.textContent).toContain('<b>B</b>');
        expect(tip.textContent).toContain('40000 kr');
        expect(tip.classList.contains('visible')).toBe(true);
        expect(sett[0][0]).toBe(f.lager[0].data[1]);
        expect(sett[0][1]).toBeUndefined();                           // G1: ingen sammanfattning för andra märken än lådor
        egenSvg(el).dispatchEvent(handelse('pointerleave'));
        expect(tip.classList.contains('visible')).toBe(false);
        expect(w.eval('_rfTipsHtml([["A & B"], ["n", 5], null, []])')).toBe('<strong>A &amp; B</strong><br>n: <strong>5</strong>');
        expect(w.eval('_rfTipsHtml("inte rader")')).toBe('');
        expect(w.eval('_rfTipsHtml([["<i>x</i>", "<script>1</script>"]])')).toBe('&lt;i&gt;x&lt;/i&gt;: <strong>&lt;script&gt;1&lt;/script&gt;</strong>');
    });
    it('verktygstips: pekaren över något som inte är ett märke döljer tipset; en omritning döljer det också', () => {
        const el = behallare();
        const f = staplar();
        f.lager[0].tips = d => [[d.x]];
        ritaI(el, f);
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(true);
        egenSvg(el).dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(false);
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(true);
        Object.defineProperty(el, 'clientWidth', { value: 450, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(tipsSyns()).toBe(false);
    });
    it('ett lager utan tips ger inget verktygstips', () => {
        const el = behallare();
        ritaI(el, staplar());
        w.eval('_hideChartTip()');
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(false);
    });
    it('en tips-funktion som kastar rapporteras och ger inget verktygstips', () => {
        const el = behallare();
        w.__state._interntFel = [];
        const f = staplar();
        f.lager[0].tips = () => { throw new Error('trasig'); };
        ritaI(el, f);
        w.eval('_hideChartTip()');
        expect(() => el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'))).not.toThrow();
        expect(tipsSyns()).toBe(false);
        expect(w.__state._interntFel.map(x => x.plats)).toEqual(['diagramtips chart-test']);
        w.__state._interntFel = [];
    });
    it('linje: träffytan (linjepunkt) ger punktens tips; själva banan ger varken tips eller klick', () => {
        const el = behallare();
        const sett = [];
        const f = staplar({ lager: [{ marke: 'linje', serie: 'L', tips: d => [[`punkt ${d.x}`]], data: [{ x: 'A', y: 1 }, { x: 'B', y: 2 }] }] });
        ritaI(el, f, { vidKlick: d => sett.push(d) });
        el.querySelectorAll('[data-marke="linjepunkt"]')[1].dispatchEvent(handelse('pointermove'));
        expect(tipset().textContent).toBe('punkt B');
        el.querySelector('path[data-marke="linje"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(false);
        el.querySelector('path[data-marke="linje"]').dispatchEvent(handelse('click'));
        expect(sett).toEqual([]);
        el.querySelectorAll('[data-marke="linjepunkt"]')[0].dispatchEvent(handelse('click'));
        expect(sett).toEqual([f.lager[0].data[0]]);
    });
    it('klick lämnar datapunkten och lagret; klick utanför märken gör inget; en hanterare som kastar rapporteras', () => {
        const el = behallare();
        const sett = [];
        const f = staplar();
        f.lager[1].data[0].nyckel = 'A|351010';
        ritaI(el, f, { vidKlick: (d, l) => sett.push([d.nyckel, l.serie]) });
        el.querySelectorAll('[data-marke="stapel"]')[2].dispatchEvent(handelse('click'));
        egenSvg(el).dispatchEvent(handelse('click'));
        expect(sett).toEqual([['A|351010', 'Man']]);
        w.__state._interntFel = [];
        ritaI(el, f, { vidKlick: () => { throw new Error('trasig'); } });
        expect(() => el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('click'))).not.toThrow();
        expect(w.__state._interntFel.map(x => x.plats)).toEqual(['diagramklick chart-test']);
        w.__state._interntFel = [];
    });
    it('förklaringen: klick och Enter döljer och visar en serie; posten finns kvar; tillståndet nollställs av en ny figur', () => {
        const el = behallare();
        ritaI(el, staplar());
        const post = () => el.querySelector('[data-serie="Man"]');
        post().dispatchEvent(handelse('click'));
        expect(el.querySelectorAll('[data-marke="stapel"]')).toHaveLength(2);
        expect(post().getAttribute('aria-pressed')).toBe('false');
        expect(post().getAttribute('role')).toBe('button');
        expect(post().getAttribute('tabindex')).toBe('0');
        post().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(el.querySelectorAll('[data-marke="stapel"]')).toHaveLength(4);
        expect(post().getAttribute('aria-pressed')).toBe('true');
        post().dispatchEvent(handelse('click'));
        ritaI(el, staplar());
        expect(el.querySelectorAll('[data-marke="stapel"]')).toHaveLength(4);
    });
    it('förklaringen med tangentbord: mellanslag växlar (och rullar inte sidan), andra tangenter gör inget, fokus stannar på posten', () => {
        const el = behallare();
        ritaI(el, staplar());
        const post = () => el.querySelector('[data-serie="Kvinna"]');
        post().focus();
        const mellanslag = new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        post().dispatchEvent(mellanslag);
        expect(mellanslag.defaultPrevented).toBe(true);
        expect(post().getAttribute('aria-pressed')).toBe('false');
        expect(w.document.activeElement).toBe(post());                // den NYA posten efter omritningen
        const annan = new w.KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
        post().dispatchEvent(annan);
        expect(annan.defaultPrevented).toBe(false);
        expect(post().getAttribute('aria-pressed')).toBe('false');
        // Enter på ett märke (inte en post) gör inget.
        el.querySelector('[data-marke="stapel"]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(el.querySelectorAll('[data-marke="stapel"]')).toHaveLength(2);
        // Fokus följer med också när diagrammet ritas om av en storleksändring.
        Object.defineProperty(el, 'clientWidth', { value: 480, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(w.document.activeElement).toBe(post());
        expect(post().getAttribute('aria-pressed')).toBe('false');    // dolda serier överlever omritningen
    });
    it('ändrad bredd ritar om i den nya bredden; rensaFigur kopplar loss allt', () => {
        const el = behallare('chart-test', 600);
        ritaI(el, staplar());
        Object.defineProperty(el, 'clientWidth', { value: 400, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(egenSvg(el).getAttribute('width')).toBe('400');
        // Oförändrad bredd ritar inte om; en dold behållare (bredd 0) ritas inte om förrän den syns igen.
        const svg = egenSvg(el);
        w.eval('_rfOmStorlek(window.__el)');
        expect(egenSvg(el)).toBe(svg);
        Object.defineProperty(el, 'clientWidth', { value: 0, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(egenSvg(el)).toBe(svg);
        let klick = 0;
        ritaI(el, staplar(), { vidKlick: () => { klick++; }, exportBeskrivning: 'BAS = A' });
        expect(el._exportBeskrivning).toBe('BAS = A');
        const stapel = el.querySelector('[data-marke="stapel"]');
        w.eval('rensaFigur(window.__el)');
        expect(el.innerHTML).toBe('');
        expect(el._figur).toBeUndefined();
        expect(Object.keys(el).filter(k => k.startsWith('_') && k !== '_chartExportAttached')).toEqual([]);
        stapel.dispatchEvent(handelse('click'));
        el.dispatchEvent(handelse('click'));
        expect(klick).toBe(0);
        expect(() => w.eval('rensaFigur("finns-inte")')).not.toThrow();
        expect(() => w.eval('rensaFigur(window.__el)')).not.toThrow();
        expect(() => w.eval('_rfOmStorlek(window.__el)')).not.toThrow();
        expect(el.innerHTML).toBe('');
    });
    it('lyssnarna läggs på behållaren en gång, överlever omritningar och tas alla bort av rensaFigur', () => {
        const el = behallare();
        const aktiva = [];
        const lagg = el.addEventListener.bind(el), ta = el.removeEventListener.bind(el);
        el.addEventListener = (typ, fn, o) => { aktiva.push([typ, fn]); lagg(typ, fn, o); };
        el.removeEventListener = (typ, fn, o) => { const i = aktiva.findIndex(a => a[0] === typ && a[1] === fn); if (i >= 0) aktiva.splice(i, 1); ta(typ, fn, o); };
        ritaI(el, staplar());
        expect(aktiva.map(a => a[0]).sort()).toEqual(['click', 'focusout', 'keydown', 'pointerdown', 'pointerleave', 'pointermove', 'pointerup']);
        ritaI(el, staplar());
        el.querySelector('[data-serie="Man"]').dispatchEvent(handelse('click'));
        Object.defineProperty(el, 'clientWidth', { value: 430, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(aktiva).toHaveLength(7);
        w.eval('rensaFigur(window.__el)');
        expect(aktiva).toEqual([]);
        delete el.addEventListener; delete el.removeEventListener;
        // En ny ritning efter rensning kopplar på nytt — en gång.
        let klick = 0;
        ritaI(el, staplar(), { vidKlick: () => { klick++; } });
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('click'));
        expect(klick).toBe(1);
    });
    it('storleksbevakningen (ResizeObserver) kopplas en gång och kopplas loss av rensaFigur; ändringar ritas om med fördröjning', async () => {
        const el = behallare('chart-test', 600);
        const skapade = [];
        w.ResizeObserver = class { constructor(fn) { this.fn = fn; this.mal = []; skapade.push(this); } observe(e) { this.mal.push(e); } disconnect() { this.mal = []; this.bortkopplad = true; } };
        try {
            ritaI(el, staplar());
            ritaI(el, staplar());
            expect(skapade).toHaveLength(1);
            expect(skapade[0].mal).toEqual([el]);
            Object.defineProperty(el, 'clientWidth', { value: 444, configurable: true });
            skapade[0].fn(); skapade[0].fn();
            expect(egenSvg(el).getAttribute('width')).toBe('600');    // inte direkt
            await new Promise(r => setTimeout(r, 160));
            expect(egenSvg(el).getAttribute('width')).toBe('444');
            // En väntande omritning avbryts av rensaFigur.
            Object.defineProperty(el, 'clientWidth', { value: 555, configurable: true });
            skapade[0].fn();
            w.eval('rensaFigur(window.__el)');
            expect(skapade[0].bortkopplad).toBe(true);
            await new Promise(r => setTimeout(r, 160));
            expect(el.innerHTML).toBe('');
        } finally { delete w.ResizeObserver; }
    });
    it('fast bredd (val.bredd) går före behållarens; storleksändring ritar då inte om', () => {
        const el = behallare('chart-test', 600);
        ritaI(el, staplar(), { bredd: 500, hojd: 250 });
        expect(egenSvg(el).getAttribute('width')).toBe('500');
        expect(egenSvg(el).getAttribute('height')).toBe('250');
        const svg = egenSvg(el);
        Object.defineProperty(el, 'clientWidth', { value: 400, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(egenSvg(el)).toBe(svg);
        ritaI(el, staplar(), { bredd: 100 });
        expect(egenSvg(el).getAttribute('width')).toBe('320');        // aldrig smalare än 320
    });
    it('stort punktmoln: notisen under diagrammet visas med ritarens antal, och försvinner när figuren byts eller rensas', () => {
        const el = behallare();
        const max = w.eval('SCATTER_MAX_POINTS');
        const data = Array.from({ length: max + 10 }, (_, i) => ({ x: i, y: i % 50 }));
        const moln = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] };
        ritaI(el, moln);
        const not = () => w.document.getElementById('chart-test-sample-note');
        expect(not().textContent).toMatch(/representativt urval/);
        const [ritade, totalt] = egenSvg(el).getAttribute('data-nedsamplat').split('/').map(Number);
        expect(not().textContent).toContain(`${ritade.toLocaleString('sv-SE')} av ${totalt.toLocaleString('sv-SE')} punkter`);
        ritaI(el, staplar());
        expect(not()).toBeNull();
        ritaI(el, moln);
        expect(not()).not.toBeNull();
        w.eval('rensaFigur(window.__el)');
        expect(not()).toBeNull();
    });
    it('notisens antal räknar inte dolda små punkter (de kommer ur ritarens data-nedsamplat, inte ur figuren)', () => {
        const el = behallare();
        const max = w.eval('SCATTER_MAX_POINTS');
        // max + 10 punkter som får visas och 500 små: totalen i notisen är max + 10, inte max + 510.
        const data = [...Array.from({ length: 500 }, (_, i) => ({ x: i, y: 77777, liten: true })), ...Array.from({ length: max + 10 }, (_, i) => ({ x: i, y: i % 50 }))];
        ritaI(el, { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        const text = w.document.getElementById('chart-test-sample-note').textContent;
        expect(text).toContain(`av ${(max + 10).toLocaleString('sv-SE')} punkter`);
        expect(text).not.toContain((max + 510).toLocaleString('sv-SE'));
        // Under gränsen utan de små: ingen notis alls, fast lagret har fler än max punkter.
        const under = [...Array.from({ length: 500 }, (_, i) => ({ x: i, y: 77777, liten: true })), ...Array.from({ length: max - 10 }, (_, i) => ({ x: i, y: i % 50 }))];
        ritaI(el, { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data: under }] });
        expect(w.document.getElementById('chart-test-sample-note')).toBeNull();
    });
    it('bredd 0 (dold flik): ritar i en reservbredd i stället för att ge en tom bild', () => {
        const el = behallare('chart-test', 0);
        ritaI(el, staplar());
        expect(Number(egenSvg(el).getAttribute('width'))).toBeGreaterThanOrEqual(320);
        // När behållaren sedan får en bredd ritas diagrammet om i den.
        Object.defineProperty(el, 'clientWidth', { value: 520, configurable: true });
        w.eval('_rfOmStorlek(window.__el)');
        expect(egenSvg(el).getAttribute('width')).toBe('520');
    });
});

describe('ritaFigur: små grupper når aldrig en hanterare', () => {
    it('en dold punkt finns inte i DOM; pekar ett element ändå på en (fel i ritaren), blir det ingen träff och ett internt fel', () => {
        const el = behallare();
        w.__state._interntFel = [];
        const sett = [];
        const f = staplar({ lager: [{ marke: 'stapel', serie: 'S', tips: d => { sett.push(d); return [[String(d.y)]]; }, data: [{ x: 'A', y: 10 }, { x: 'HEMLIG-KAT', y: 77777, liten: true, nyckel: 'NYCK-HEMLIG' }, { x: 'B', y: 12 }] }] });
        ritaI(el, f, { vidKlick: d => sett.push(d) });
        const s = alla(el, '[data-marke="stapel"]');
        expect(s.map(e => e.getAttribute('data-i'))).toEqual(['0', '2']);
        for (const e of s) { e.dispatchEvent(handelse('pointermove')); e.dispatchEvent(handelse('click')); }
        expect(sett.every(d => !d.liten)).toBe(true);
        expect(sett).toHaveLength(4);
        // Simulerat ritarfel: ett element som pekar på den dolda punkten.
        sett.length = 0;
        w.eval('_hideChartTip()');
        s[0].setAttribute('data-i', '1');
        s[0].dispatchEvent(handelse('pointermove'));
        s[0].dispatchEvent(handelse('click'));
        expect(sett).toEqual([]);
        expect(tipsSyns()).toBe(false);
        expect(w.__state._interntFel.map(x => x.plats)).toEqual(['diagramträff chart-test']);
        w.__state._interntFel = [];
        // Med visaSma är punkten synlig och lämnas som vanligt.
        ritaI(el, f, { visaSma: true, vidKlick: d => sett.push(d) });
        el.querySelector('[data-marke="stapel"][data-i="1"]').dispatchEvent(handelse('click'));
        expect(sett).toEqual([f.lager[0].data[1]]);
        expect(w.__state._interntFel).toEqual([]);
    });
    it('index utanför figuren eller skräp i attributen ger ingen träff och inget fel', () => {
        const el = behallare();
        const sett = [];
        const f = staplar();
        f.lager[0].tips = d => { sett.push(d); return [['x']]; };
        ritaI(el, f, { vidKlick: d => sett.push(d) });
        const s = el.querySelector('[data-marke="stapel"]');
        for (const [l, i] of [['9', '0'], ['0', '99'], ['x', 'y'], ['-1', '0'], ['0', ''], ['0', '0.5'], ['', '0'], ['0', '1e0']]) {
            s.setAttribute('data-l', l); s.setAttribute('data-i', i);
            expect(() => { s.dispatchEvent(handelse('pointermove')); s.dispatchEvent(handelse('click')); }).not.toThrow();
        }
        expect(sett).toEqual([]);                                     // bara heltal i attributen läses som index
    });
    it('G1/G2: en låda lämnar {x, nyckel} och statistiken över de individer som får visas — aldrig en individs post', () => {
        const el = behallare();
        const tips = [], klick = [];
        const data = [...individer('A', [77777, 10, 20, 30, 40, 99999], [0, 5]), ...individer('B', [50, 60, 70])];
        const f = staplar({ lager: [{ marke: 'lada', serie: 'Lön', tips: (d, s) => { tips.push([d, s]); return [[String(d.x)], ['Median', s.median], ['n', s.n]]; }, data }] });
        ritaI(el, f, { vidKlick: (d, l) => klick.push([d, l]) });
        const [a, b] = alla(el, 'rect[data-marke="lada"]');
        expect(a.getAttribute('data-i')).toBe('1');                   // första kvarvarande individen i A
        a.dispatchEvent(handelse('pointermove'));
        a.dispatchEvent(handelse('click'));
        const [d, s] = tips[0];
        expect(Object.keys(d)).toEqual(['x']);                        // F2: individerna har olika nycklar — ingen nyckel ut
        expect(d).toEqual({ x: 'A' });
        expect(data.includes(d)).toBe(false);                         // ett NYTT objekt, inte individens post
        expect(Object.keys(s).sort()).toEqual(['hog', 'lag', 'median', 'n', 'q1', 'q3']);
        expect(s).toEqual({ q1: 17.5, median: 25, q3: 32.5, lag: 10, hog: 40, n: 4 });
        expect(tipset().textContent).toBe('AMedian: 25n: 4');
        expect(klick).toHaveLength(1);
        expect(Object.keys(klick[0][0])).toEqual(['x']);
        expect(data.includes(klick[0][0])).toBe(false);
        expect(klick[0][1]).not.toBe(f.lager[0]);                     // F1: aldrig lagret självt
        expect(klick[0][1]).toEqual({ serie: 'Lön', marke: 'lada', panel: undefined, axel: 'y', index: 0 });
        b.dispatchEvent(handelse('pointermove'));
        expect(tips[1][0]).toEqual({ x: 'B' });
        expect(tips[1][1]).toEqual({ q1: 55, median: 60, q3: 65, lag: 50, hog: 70, n: 3 });
        expect(JSON.stringify(tips) + JSON.stringify(klick.map(k => k[0]))).not.toMatch(/77777|99999|HEMLIG/);
        // Med visaSma ingår de små i lådan — och då också i sammanfattningen.
        tips.length = 0;
        ritaI(el, f, { visaSma: true });
        const a2 = alla(el, 'rect[data-marke="lada"]')[0];
        expect(a2.getAttribute('data-i')).toBe('0');
        a2.dispatchEvent(handelse('pointermove'));
        expect(tips[0][0]).toEqual({ x: 'A' });
        expect(tips[0][1].n).toBe(6);
        const stat = ladstatistik(data.filter(p => p.x === 'A').map(p => p.y));
        expect(tips[0][1]).toEqual({ q1: stat.q1, median: stat.median, q3: stat.q3, lag: stat.lag, hog: stat.hog, n: 6 });
    });
    it('G1: sammanfattningen räknar med samma individer som lådan — utan värde (eller utan läge på en log-axel) räknas inte; utan nyckel saknas fältet', () => {
        const el = behallare();
        const tips = [];
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'lada', serie: 'L', tips: (d, s) => { tips.push([d, s]); return [['x']]; }, data: [{ x: 'A', y: null }, { x: 'A' }, { x: 'A', y: 10 }, { x: 'A', y: 100 }, { x: 'A', y: 1000 }, { x: 'B', y: 5 }] }] };
        ritaI(el, f);
        const a = alla(el, 'rect[data-marke="lada"]')[0];
        expect(a.getAttribute('data-i')).toBe('2');
        a.dispatchEvent(handelse('pointermove'));
        expect(tips[0][0]).toEqual({ x: 'A' });
        expect(Object.keys(tips[0][0])).toEqual(['x']);
        expect(tips[0][1]).toEqual({ q1: 55, median: 100, q3: 550, lag: 10, hog: 1000, n: 3 });
        // Urvalet bakom måtten, prövat direkt — samma funktion som ritaren använder (F5). Utan skala (sidan) avgör
        // axelns slag om ett värde har ett läge; med skala (ritaren) avgör skalan.
        w.__f = { x: { skala: 'band' }, y: { skala: 'log' }, y2: { skala: 'linjar' } };
        w.__l = { marke: 'lada', data: [{ x: 'A', y: 0 }, { x: 'A', y: -5 }, { x: 'A', y: 10 }, { x: 'A', y: 77777, liten: true }, null, { x: 'B', y: 3 }, { x: 'A', y: '12' }] };
        const urval = (kod) => w.eval(kod).map(o => [o.i, o.d.y]);
        expect(urval('_rfLadIndivider(window.__f, window.__l, d => !!d.liten)')).toEqual([[2, 10], [5, 3]]);
        expect(urval('_rfLadIndivider(window.__f, window.__l, () => false)')).toEqual([[2, 10], [3, 77777], [5, 3]]);
        expect(urval('_rfLadIndivider(window.__f, { ...window.__l, axel: "y2" }, d => !!d.liten)')).toEqual([[0, 0], [1, -5], [2, 10], [5, 3]]);
        expect(urval('_rfLadIndivider(window.__f, window.__l, d => !!d.liten, v => (v > 5 ? v : NaN))')).toEqual([[2, 10]]);
        expect(w.eval('_rfLadKategori({ x: 7 })')).toBe('7');
    });
    it('G1/G2: en individpunkt (punkter "alla") lämnar individens post och ingen sammanfattning', () => {
        const el = behallare();
        const tips = [], klick = [];
        const data = individer('A', [77777, 10, 20, 30], [0]);
        const f = staplar({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'Lön', tips: (d, s) => { tips.push([d, s]); return [[String(d.y)]]; }, data }] });
        ritaI(el, f, { vidKlick: d => klick.push(d) });
        const p = alla(el, '[data-marke="individ"]');
        expect(p).toHaveLength(3);
        for (const e of p) { e.dispatchEvent(handelse('pointermove')); e.dispatchEvent(handelse('click')); }
        expect(tips.map(t => t[0])).toEqual([data[1], data[2], data[3]]);
        expect(tips.every(t => t[1] === undefined)).toBe(true);
        expect(klick).toEqual([data[1], data[2], data[3]]);
    });
    it('G1: övriga märken (punkt, intervall, ruta) får datapunkten och ingen sammanfattning', () => {
        const el = behallare();
        const tips = [];
        const t = (d, s) => { tips.push([d, s]); return [['x']]; };
        const f = { beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100] },
            lager: [{ marke: 'ruta', tips: t, data: [{ x: 'A', y: 'r', varde: 10 }, { x: 'B', y: 'r', varde: 77777, liten: true }] }] };
        ritaI(el, f);
        expect(alla(el, '[data-marke="ruta"]')).toHaveLength(1);
        el.querySelector('[data-marke="ruta"]').dispatchEvent(handelse('pointermove'));
        const g = staplar({ lager: [{ marke: 'intervall', tips: t, data: [{ x: 'A', lag: 1, hog: 2 }] }, { marke: 'punkt', tips: t, data: [{ x: 'A', y: 1.5 }] }] });
        ritaI(el, g);
        el.querySelector('[data-marke="intervall"]').dispatchEvent(handelse('pointermove'));
        el.querySelector('[data-marke="punkt"]').dispatchEvent(handelse('pointermove'));
        expect(tips.map(x => x[0])).toEqual([f.lager[0].data[0], g.lager[0].data[0], g.lager[1].data[0]]);
        expect(tips.every(x => x[1] === undefined)).toBe(true);
    });
    it('små punkter som ritas med visaSma på linjer (litenpunkt) tar inte emot pekaren; träffytan gör det', () => {
        const el = behallare();
        const f = staplar({ lager: [{ marke: 'linje', serie: 'L', tips: d => [[String(d.y)]], data: [{ x: 'A', y: 1 }, { x: 'B', y: 77777, liten: true }] }] });
        ritaI(el, f, { visaSma: true });
        expect(el.querySelector('[data-marke="litenpunkt"]').getAttribute('pointer-events')).toBe('none');
        ritaI(el, f);
        expect(alla(el, '[data-marke="linjepunkt"]').map(e => e.getAttribute('data-i'))).toEqual(['0']);
        expect(el.outerHTML).not.toContain('77777');
    });
});

describe('Uppgift 6: ritarens ändringar (G4, G5, smått)', () => {
    const xy = (referens, over = {}) => ({ beskrivning: 'b', x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'linjar', doman: [0, 10] }, referens, lager: [{ marke: 'punkt', data: [{ x: 10, y: 1 }, { x: 90, y: 9 }] }], ...over });
    it('G4: en kortad zonetikett (med <title>) tar emot pekaren så att hela texten visas; en okortad gör det inte', () => {
        const lang = 'En zonetikett som är alldeles för lång för sin smala zon';
        const svg = rita(xy([{ typ: 'zon', x0: 60, x1: 100, etikett: lang }, { typ: 'zon', x0: 0, x1: 30, etikett: 'Nya' }]));
        const [kortad, hel] = alla(svg, 'text[data-marke="zonetikett"]');
        expect(texten(kortad)).toMatch(/…$/);
        expect(kortad.querySelector('title').textContent).toBe(lang);
        expect(kortad.hasAttribute('pointer-events')).toBe(false);
        expect(texten(hel)).toBe('Nya');
        expect(hel.querySelector('title')).toBeNull();
        expect(hel.getAttribute('pointer-events')).toBe('none');
        // Regeln gäller varje zonetikett: <title> om och endast om den tar emot pekaren.
        for (const b of [600, 320]) for (const e of alla(rita(xy([{ typ: 'zon', y0: 2, y1: 8, etikett: lang + ' ' + lang }, { typ: 'zon', x0: 0, x1: 50, etikett: 'Kort' }]), b), 'text[data-marke="zonetikett"]')) {
            expect(e.hasAttribute('pointer-events'), texten(e)).toBe(!e.querySelector('title'));
        }
    });
    it('G4 på sidan: en kortad zonetikett är ingen träff (inget verktygstips från diagrammet, inget klick)', () => {
        const el = behallare();
        const sett = [];
        const f = xy([{ typ: 'zon', x0: 60, x1: 100, etikett: 'En zonetikett som är alldeles för lång för sin smala zon' }]);
        f.lager[0].tips = d => [[String(d.x)]];
        ritaI(el, f, { vidKlick: d => sett.push(d) });
        const z = el.querySelector('text[data-marke="zonetikett"]');
        el.querySelector('[data-marke="punkt"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(true);
        z.dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(false);
        z.dispatchEvent(handelse('click'));
        expect(sett).toEqual([]);
    });
    it('G5: en individpunkt har en osynlig bredare träffyta (genomskinlig kant, inga extra element); en liten individ behåller sin synliga kant', () => {
        const f = staplar({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'L', data: [{ x: 'A', y: 10 }, { x: 'A', y: 12, liten: true }, { x: 'A', y: 14 }] }] });
        const svg = rita(f, 600, { visaSma: true });
        const p = i => svg.querySelector(`[data-marke="individ"][data-i="${i}"]`);
        for (const i of [0, 2]) {
            expect(p(i).getAttribute('stroke')).toBe('#000000');
            expect(p(i).getAttribute('stroke-opacity')).toBe('0');
            expect(p(i).getAttribute('stroke-width')).toBe('8');
            expect(p(i).hasAttribute('stroke-dasharray')).toBe(false);
            expect(p(i).getAttribute('r')).toBe('2.5');
            expect(p(i).hasAttribute('pointer-events')).toBe(false);
        }
        expect(p(1).getAttribute('stroke')).not.toBe('#000000');
        expect(p(1).hasAttribute('stroke-opacity')).toBe(false);
        expect(p(1).getAttribute('stroke-width')).toBe('1.2');
        expect(p(1).getAttribute('stroke-dasharray')).toBeTruthy();
        // Inga extra element: en cirkel per individ, och inget annat i panelen.
        expect([...svg.querySelector('svg[data-del="panel"]').children].map(e => e.getAttribute('data-marke'))).toEqual(['individ', 'individ', 'individ']);
        // Avvikarnas cirklar (i en låda) rörs inte.
        const lada = rita(staplar({ lager: [{ marke: 'lada', serie: 'L', data: [10, 11, 12, 13, 14, 90].map(y => ({ x: 'A', y })) }] }));
        for (const a of alla(lada, '[data-marke="avvikare"]')) expect(a.hasAttribute('stroke-opacity')).toBe(false);
    });
    it('spridningens ordningsnummer räknas bland de individer som RITAS — efter urvalet, inte bland lagrets alla', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const n = max * 2 + 1;                                         // steg 3: var tredje individ ritas
        const data = Array.from({ length: n }, (_, i) => ({ x: i % 2 ? 'B' : 'A', y: 20000 + ((i * 7919) % 30000) }));
        const f = d => staplar({ y: { skala: 'linjar', doman: [0, 60000] }, lager: [{ marke: 'lada', punkter: 'alla', serie: 'L', data: d }] });
        const hel = alla(rita(f(data)), '[data-marke="individ"]');
        const urval = data.filter((_, i) => i % 3 === 0);
        expect(urval.length).toBeLessThanOrEqual(max);
        const bara = alla(rita(f(urval)), '[data-marke="individ"]');
        expect(hel).toHaveLength(urval.length);
        expect(hel.map(e => Number(e.getAttribute('data-i')) % 3)).toEqual(hel.map(() => 0));
        // Samma lägen som om bara de ritade individerna fanns: numret är platsen bland dem, per kategori.
        expect(hel.map(e => `${e.getAttribute('cx')},${e.getAttribute('cy')}`)).toEqual(bara.map(e => `${e.getAttribute('cx')},${e.getAttribute('cy')}`));
        // …och lägena följer _rfSprid(0), _rfSprid(1), … inom kategorin.
        const iA = hel.filter(e => data[Number(e.getAttribute('data-i'))].x === 'A').slice(0, 5).map(e => tal(e, 'cx'));
        const s = [0, 1, 2, 3, 4].map(k => w.eval(`_rfSprid(${k})`));
        const skala = (iA[1] - iA[0]) / (s[1] - s[0]);
        for (let k = 2; k < 5; k++) expect(iA[k] - iA[0]).toBeCloseTo((s[k] - s[0]) * skala, 6);
    });
    it('figurlistan har ett band på kategoriaxel där x.ordning skiljer sig från datans ordning, med en liten punkt som inte ligger sist', () => {
        const [, figur] = ritfigurer().find(([namn]) => namn === 'band över kategorier i annan ordning än datan');
        const band = figur.lager.find(l => l.marke === 'band');
        const sma = band.data.map((d, i) => (d.liten ? i : -1)).filter(i => i >= 0);
        expect(sma.length).toBeGreaterThan(0);
        expect(Math.max(...sma)).toBeLessThan(band.data.length - 1);
        expect(figur.x.ordning).not.toEqual(band.data.map(d => d.x));
        expect(figur.x.ordning).not.toEqual(band.data.filter(d => !d.liten).map(d => d.x));
        // Bandet ritas i axelns ordning med och utan de små.
        for (const visaSma of [false, true]) {
            const d = alla(rita(figur, 600, { visaSma }), 'path[data-marke="band"]')[0].getAttribute('d');
            const xs = [...d.matchAll(/[ML]([-\d.]+),/g)].map(m => Number(m[1]));
            const ovre = xs.slice(0, xs.length / 2);
            expect(ovre).toEqual([...ovre].sort((a, b) => a - b));
        }
    });
    it('text på en liten mörk ruta: den mörka kanten kring vit text är tunnare än den vita kring mörk text', () => {
        const svg = rita({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100], farger: [[0, '#ffffff'], [1, '#111827']] },
            lager: [{ marke: 'ruta', visaText: true, data: [{ x: 'a', y: 'r', varde: 0, text: 'ljus', liten: true }, { x: 'b', y: 'r', varde: 100, text: 'mörk', liten: true }] }] }, 600, { visaSma: true });
        const [ljus, mork] = alla(svg, '[data-marke="rutatext"]');
        expect(mork.getAttribute('fill')).toBe('#ffffff');
        expect(tal(mork, 'stroke-width')).toBeLessThan(tal(ljus, 'stroke-width'));
        expect(tal(mork, 'stroke-width')).toBeGreaterThan(0);
        expect(tal(ljus, 'stroke-width')).toBe(3);
    });
});

describe('Uppgift 6, rättning 1', () => {
    const lada = (data, over = {}) => staplar({ lager: [{ marke: 'lada', serie: 'Lön', tips: (d, s) => [[String(d.x)], ['n', s.n]], data, ...over }] });
    const ladklick = (figur, val = {}) => {
        const el = behallare();
        const sett = [];
        ritaI(el, figur, { ...val, vidKlick: (d, l) => sett.push([d, l]) });
        for (const r of alla(el, 'rect[data-marke="lada"]')) r.dispatchEvent(handelse('click'));
        return sett;
    };
    it('F1: vidKlick får en fryst beskrivning av lagret — aldrig lagret, och ingen väg till dess data', () => {
        const el = behallare();
        const sett = [];
        const f = staplar({ y2: { skala: 'linjar' }, paneler: ['P1', 'P2'], lager: [
            { marke: 'stapel', serie: 'S', panel: 'P2', data: [{ x: 'A', y: 10, nyckel: 'A|1' }, { x: 'HEMLIG-KAT', y: 77777, liten: true }] },
            { marke: 'punkt', axel: 'y2', data: [{ x: 'A', y: 3 }, { x: 'A', y: 77777, liten: true }] }] });
        ritaI(el, f, { vidKlick: (d, l) => sett.push([d, l]) });
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('click'));
        el.querySelector('[data-marke="punkt"]').dispatchEvent(handelse('click'));
        expect(sett.map(x => x[0])).toEqual([f.lager[0].data[0], f.lager[1].data[0]]);
        const [a, b] = sett.map(x => x[1]);
        expect(a).toEqual({ serie: 'S', marke: 'stapel', panel: 1, axel: 'y', index: 0 });
        expect(b).toEqual({ serie: undefined, marke: 'punkt', panel: undefined, axel: 'y2', index: 1 });
        for (const l of [a, b]) {
            expect(Object.keys(l).sort()).toEqual(['axel', 'index', 'marke', 'panel', 'serie']);
            expect(Object.isFrozen(l)).toBe(true);
            expect(f.lager.includes(l)).toBe(false);
            expect(l.data).toBeUndefined();
            expect(l.tips).toBeUndefined();
            expect(Object.getPrototypeOf(l)).toBe(w.Object.prototype);
            expect(JSON.stringify(l)).not.toMatch(/77777|HEMLIG/);
        }
        // Varje klick ger ett nytt objekt.
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('click'));
        expect(sett[2][1]).not.toBe(a);
        expect(sett[2][1]).toEqual(a);
    });
    it('F1: tips anropas lös från lagret — this är inte lagret (undefined i strikt läge)', () => {
        const el = behallare();
        const sett = [];
        const f = staplar();
        f.lager[0].tips = function (d) { sett.push(this); return [[String(d.x)]]; };   // testfilen är en modul: strikt läge
        ritaI(el, f);
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipsSyns()).toBe(true);
        expect(sett).toEqual([undefined]);
        const g = lada(individer('A', [10, 20, 30]));
        g.lager[0].tips = function (d, s) { sett.push(this); return [[String(s.n)]]; };
        ritaI(el, g);
        el.querySelector('rect[data-marke="lada"]').dispatchEvent(handelse('pointermove'));
        expect(sett).toEqual([undefined, undefined]);
    });
    it('F2: en låda lämnar nyckel bara när alla dess individer delar en och samma, definierade nyckel', () => {
        const ind = (x, nycklar, sma = []) => nycklar.map((nyckel, i) => ({ x, y: 10 + i, ...(nyckel === undefined ? {} : { nyckel }), ...(sma.includes(i) ? { liten: true } : {}) }));
        const d = figur => ladklick(figur).map(x => x[0]);
        expect(d(lada(ind('A', ['A|351', 'A|351', 'A|351'])))).toEqual([{ x: 'A', nyckel: 'A|351' }]);
        expect(d(lada(ind('A', ['p1', 'p2', 'p3'])))).toEqual([{ x: 'A' }]);
        expect(d(lada(ind('A', ['g', 'g', undefined])))).toEqual([{ x: 'A' }]);
        expect(d(lada(ind('A', [undefined, 'g', 'g'])))).toEqual([{ x: 'A' }]);
        expect(d(lada(ind('A', [null, null])))).toEqual([{ x: 'A' }]);
        expect(d(lada(ind('A', [0, 0])))).toEqual([{ x: 'A', nyckel: 0 }]);
        expect(d(lada([...ind('A', ['a', 'a']), ...ind('B', ['b', 'x'])]))).toEqual([{ x: 'A', nyckel: 'a' }, { x: 'B' }]);
        // En dold liten individ med en annan nyckel ändrar ingenting — åt något håll: samma som om den inte fanns.
        for (const [nycklar, sma] of [[['HEMLIG', 'g', 'g', 'g'], [0]], [['g', 'HEMLIG', 'g'], [1]], [['HEMLIG', 'p1', 'p2'], [0]], [['g', 'g', 'HEMLIG'], [2]], [['HEMLIG', 'HEMLIG', 'g'], [0, 1]]]) {
            const med = ind('A', nycklar, sma), utan = med.filter(p => !p.liten);
            expect(d(lada(med)), nycklar.join()).toEqual(d(lada(utan)));
            expect(JSON.stringify(d(lada(med)))).not.toContain('HEMLIG');
        }
        // Med visaSma hör de små till lådan och räknas med.
        expect(ladklick(lada(ind('A', ['HEMLIG', 'g', 'g'], [0])), { visaSma: true }).map(x => x[0])).toEqual([{ x: 'A' }]);
        expect(ladklick(lada(ind('A', ['g', 'g', 'g'], [0])), { visaSma: true }).map(x => x[0])).toEqual([{ x: 'A', nyckel: 'g' }]);
        // En individ utan värde ritas inte i lådan och räknas inte heller för nyckeln.
        expect(d(lada([{ x: 'A', y: null, nyckel: 'annan' }, ...ind('A', ['g', 'g'])]))).toEqual([{ x: 'A', nyckel: 'g' }]);
    });
    it('F3: ett dolt tips lämnar ingen text i portalen — efter att pekaren lämnat, efter omritning och efter rensaFigur', () => {
        const el = behallare();
        const f = staplar();
        f.lager[0].tips = d => [[`TIPS-${d.x}`]];
        const visa = () => { ritaI(el, f); el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove')); expect(tipset().textContent).toBe('TIPS-A'); expect(w.__rfTipsAgare()).toBe(el); };
        visa();
        el.dispatchEvent(handelse('pointerleave'));
        expect(tipsSyns()).toBe(false);
        expect(tipset().innerHTML).toBe('');
        expect(w.__rfTipsAgare()).toBeNull();
        visa();
        egenSvg(el).dispatchEvent(handelse('pointermove'));           // ytan, inget märke
        expect(tipset().innerHTML).toBe('');
        visa();
        ritaI(el, f);                                                 // ny ritning
        expect(tipsSyns()).toBe(false);
        expect(tipset().innerHTML).toBe('');
        visa();
        w.eval('rensaFigur(window.__el)');                            // F4: rensaFigur döljer ett synligt tips
        expect(tipsSyns()).toBe(false);
        expect(tipset().innerHTML).toBe('');
        expect(w.__rfTipsAgare()).toBeNull();
        visa();
        w.eval('_rfNollstallTips()');
        expect(tipsSyns()).toBe(false);
        expect(tipset().innerHTML).toBe('');
        expect(w.__rfTipsAgare()).toBeNull();
        expect(el._figur).toBe(f);                                    // ägaren sitter kvar i sidan: bara tipset nollställs
        expect(() => w.eval('_rfNollstallTips()')).not.toThrow();
    });
    it('F3: en behållare som tas ur dokumentet medan dess tips visas städas bort — av _rfNollstallTips, av nästa pekarrörelse och av storleksbevakningen', () => {
        const f = () => { const x = staplar(); x.lager[0].tips = d => [[`TIPS-${d.x}`]]; return x; };
        const visaOchTaBort = () => {
            const el = behallare('chart-borta');
            ritaI(el, f());
            el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
            expect(tipsSyns()).toBe(true);
            el.parentElement.remove();                                // vyn byter ut sitt innehåll utan rensaFigur
            expect(el.isConnected).toBe(false);
            expect(el._figur).toBeDefined();
            return el;
        };
        const borta = el => {
            expect(tipsSyns()).toBe(false);
            expect(tipset().textContent).toBe('');
            expect(w.__rfTipsAgare()).toBeNull();
            expect(el._figur).toBeUndefined();
            expect(Object.keys(el).filter(k => k.startsWith('_') && k !== '_chartExportAttached')).toEqual([]);
            expect(el.innerHTML).toBe('');
        };
        let el = visaOchTaBort();
        w.eval('_rfNollstallTips()');
        borta(el);
        // Nästa pekarrörelse på ett annat diagram (över något som inte är ett märke).
        const annan = behallare('chart-test');
        ritaI(annan, f());
        el = visaOchTaBort();
        egenSvg(annan).dispatchEvent(handelse('pointermove'));
        borta(el);
        expect(annan._figur).toBeDefined();
        // Storleksbevakningens svar på ett annat diagram.
        el = visaOchTaBort();
        w.__el = annan;
        w.eval('_rfVidStorlek(window.__el)');
        borta(el);
        // När det andra diagrammet rensas (döljvägen).
        el = visaOchTaBort();
        w.eval('rensaFigur(window.__el)');
        borta(el);
    });
    it('F3: två diagram — tipset har en ägare; att lämna det ena döljer inte det andras tips, och ägandet flyttar med pekaren', () => {
        const a = behallare('chart-a'), b = behallare('chart-b');
        const f = namn => { const x = staplar(); x.lager[0].tips = d => [[`${namn}-${d.x}`]]; return x; };
        ritaI(a, f('A')); ritaI(b, f('B'));
        a.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipset().textContent).toBe('A-A');
        expect(w.__rfTipsAgare()).toBe(a);
        b.dispatchEvent(handelse('pointerleave'));                    // B lämnas: A:s tips står kvar
        egenSvg(b).dispatchEvent(handelse('pointermove'));            // pekaren över B:s yta utan märke: likaså
        w.__el = b; w.eval('_rfOmStorlek(window.__el)');
        ritaI(b, f('B'));                                             // B ritas om: likaså
        expect(tipsSyns()).toBe(true);
        expect(tipset().textContent).toBe('A-A');
        expect(w.__rfTipsAgare()).toBe(a);
        b.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipset().textContent).toBe('B-A');
        expect(w.__rfTipsAgare()).toBe(b);
        a.dispatchEvent(handelse('pointerleave'));                    // nu är det A som inte äger tipset
        expect(tipset().textContent).toBe('B-A');
        w.__el = a; w.eval('rensaFigur(window.__el)');
        expect(tipsSyns()).toBe(true);
        b.dispatchEvent(handelse('pointerleave'));
        expect(tipsSyns()).toBe(false);
        expect(tipset().textContent).toBe('');
    });
    it('F4: den enda serien som får visas döljs via förklaringen — svg och förklaring står kvar, posten är nedtonad, inget om de små syns, klick återställer', () => {
        const el = behallare();
        const f = staplar({ lager: [
            { marke: 'stapel', serie: 'Synlig', data: [{ x: 'A', y: 10 }, { x: 'HEMLIG-KAT', y: 77777, liten: true }] },
            { marke: 'stapel', serie: 'HEMLIG-SERIE', data: [{ x: 'A', y: 88888, liten: true, etikett: 'ETIK-HEMLIG' }] }] });
        ritaI(el, f, { tomtext: 'TOMT' });
        const post = () => el.querySelector('[data-serie="Synlig"]');
        post().dispatchEvent(handelse('click'));
        expect(egenSvg(el)).not.toBeNull();
        expect(el.textContent).not.toContain('TOMT');                 // inte det tomma läget: förklaringen behövs för att ångra
        expect(alla(el, '[data-marke]')).toEqual([]);
        expect(alla(el, '[data-serie]').map(g => g.getAttribute('data-serie'))).toEqual(['Synlig']);
        expect(post().getAttribute('aria-pressed')).toBe('false');
        expect(el.parentElement.outerHTML).not.toMatch(/HEMLIG|77777|77 777|88888|88 888/);
        // Axeln får inte ha sträckts av de små värdena.
        expect(alla(el, 'text[data-axel="y"]').map(texten).join(' ')).not.toMatch(/[6-9]\d[\s\u00a0]?\d{3}/);
        post().dispatchEvent(handelse('click'));
        expect(alla(el, '[data-marke="stapel"]')).toHaveLength(1);
        expect(post().getAttribute('aria-pressed')).toBe('true');
        expect(el.parentElement.outerHTML).not.toMatch(/HEMLIG|77777|88888/);
    });
    it('F4: verktygstipsets sammanfattning är den RITADE lådans mått — lådans kant och medianstreck ligger där q1, q3 och medianen hamnar på axeln', () => {
        // Två lådor på samma axel: den ena lådans mått ger skalan (pixel = a + b·värde), den andras rityta ska följa
        // sin egen sammanfattning genom samma skala. Små individer med extrema värden får inte rubba någotdera.
        for (const visaSma of [false, true]) {
            const el = behallare();
            const tips = [];
            const data = [...individer('A', [900, 100, 120, 150, 190, 950, 240], [0, 5]), ...individer('B', [300, 340, 345, 420, 500, 800], [5])];
            const f = staplar({ lager: [{ marke: 'lada', serie: 'Lön', tips: (d, s) => { tips.push(s); return [['x']]; }, data }] });
            ritaI(el, f, { visaSma });
            const rutor = alla(el, 'rect[data-marke="lada"]'), streck = alla(el, 'line[data-marke="median"]');
            for (const r of rutor) r.dispatchEvent(handelse('pointermove'));
            const [sa, sb] = tips;
            expect(sa.n).toBe(visaSma ? 7 : 5);
            // Skalan ur låda A: överkanten är q3, underkanten q1.
            const b = tal(rutor[0], 'height') / (sa.q1 - sa.q3), a = tal(rutor[0], 'y') - b * sa.q3;
            const px = v => a + b * v;
            expect(tal(streck[0], 'y1')).toBeCloseTo(px(sa.median), 6);
            expect(tal(rutor[1], 'y')).toBeCloseTo(px(sb.q3), 6);
            expect(tal(rutor[1], 'y') + tal(rutor[1], 'height')).toBeCloseTo(px(sb.q1), 6);
            expect(tal(streck[1], 'y1')).toBeCloseTo(px(sb.median), 6);
            // Morrhåren når lag och hog.
            const morr = alla(el, 'line[data-marke="morrhar"]');
            expect(tal(morr[2], 'y2')).toBeCloseTo(px(sb.lag), 6);
            expect(tal(morr[3], 'y2')).toBeCloseTo(px(sb.hog), 6);
        }
    });
    it('F6: från dold (bredd 0) till synlig ritas diagrammet om genast; andra ändringar väntar', async () => {
        const el = behallare('chart-test', 0);
        const skapade = [];
        w.ResizeObserver = class { constructor(fn) { this.fn = fn; skapade.push(this); } observe() {} disconnect() {} };
        try {
            ritaI(el, staplar());
            expect(egenSvg(el).getAttribute('width')).toBe('640');
            Object.defineProperty(el, 'clientWidth', { value: 510, configurable: true });
            skapade[0].fn();
            expect(egenSvg(el).getAttribute('width')).toBe('510');    // genast, ingen väntan
            Object.defineProperty(el, 'clientWidth', { value: 470, configurable: true });
            skapade[0].fn();
            expect(egenSvg(el).getAttribute('width')).toBe('510');    // synlig → synlig: väntar
            await new Promise(r => setTimeout(r, 160));
            expect(egenSvg(el).getAttribute('width')).toBe('470');
            // Dold igen (ritas inte om), ny figur i dolt läge (reservbredd), synlig: genast.
            Object.defineProperty(el, 'clientWidth', { value: 0, configurable: true });
            skapade[0].fn();
            await new Promise(r => setTimeout(r, 160));
            expect(egenSvg(el).getAttribute('width')).toBe('470');
            ritaI(el, staplar());
            expect(egenSvg(el).getAttribute('width')).toBe('640');
            Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true });
            skapade[0].fn();
            expect(egenSvg(el).getAttribute('width')).toBe('600');
            w.eval('rensaFigur(window.__el)');
            expect(() => skapade[0].fn()).not.toThrow();              // ett sent svar efter rensning gör inget
            expect(el.innerHTML).toBe('');
        } finally { delete w.ResizeObserver; }
    });
    it('F6: notisen om urval visas också under en behållare utan id, och tas bort när figuren byts eller rensas', () => {
        const el = behallare('chart-utan-id');
        el.removeAttribute('id');
        const max = w.eval('SCATTER_MAX_POINTS');
        const moln = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', data: Array.from({ length: max + 10 }, (_, i) => ({ x: i, y: i % 50 })) }] };
        const not = () => el.parentElement.querySelectorAll('.scatter-sample-note');
        ritaI(el, moln);
        expect(not()).toHaveLength(1);
        expect(el.nextElementSibling).toBe(not()[0]);
        expect(not()[0].hasAttribute('id')).toBe(false);
        expect(not()[0].textContent).toMatch(/representativt urval/);
        ritaI(el, moln);
        expect(not()).toHaveLength(1);                                // ingen dubblering
        ritaI(el, staplar());
        expect(not()).toHaveLength(0);
        ritaI(el, moln);
        w.eval('rensaFigur(window.__el)');
        expect(not()).toHaveLength(0);
        // Får behållaren ett id efter att notisen skapats hittas notisen ändå (syskonet efter diagrammet).
        ritaI(el, moln);
        el.id = 'chart-fick-id';
        w.eval('rensaFigur(window.__el)');
        expect(not()).toHaveLength(0);
        el.parentElement.remove();
        // Med id har notisen id = <id>-sample-note, också när anroparen ger ett id som sträng.
        const medId = behallare('chart-test');
        ritaI(medId, moln);
        expect(w.document.getElementById('chart-test-sample-note').previousElementSibling).toBe(medId);
        w.eval('_setScatterSampleNote("chart-test", null)');
        expect(w.document.getElementById('chart-test-sample-note')).toBeNull();
    });
});

// ---- Uppgift 7: export (figurTillSvg, figurTillBild, exportmenyn), rensning ----
// PNG-vägen (canvas) finns inte i jsdom; den prövas i riktiga webbläsare av tools/browser-smoke.mjs.
const nyBehallare = (id = 'chart-exp') => {
    const d = w.document;
    d.getElementById('view-test')?.remove();
    const panel = d.createElement('div'); panel.id = 'view-test'; panel.className = 'view-panel';
    const kort = d.createElement('div'); kort.className = 'card';
    const h = d.createElement('h3'); h.textContent = 'Medianlön per BAS';
    const el = d.createElement('div'); if (id) el.id = id;
    kort.append(h, el); panel.appendChild(kort); d.body.appendChild(panel);
    Object.defineProperty(el, 'clientWidth', { value: 0, configurable: true });      // dold flik
    return el;
};
const medSma = () => staplar({ lager: [{ marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 30000 }, { x: 'Liten', y: 77777, liten: true }] }] });
const baraSma = () => staplar({ lager: [{ marke: 'stapel', serie: 'Hemlig serie', data: [{ x: 'Liten', y: 77777, liten: true, etikett: '77 777 kr' }] }] });
const svgText = (figur, val = {}, bredd = 1600, hojd = 900) => { w.__f = figur; w.__val = val; w.__b = bredd; w.__h = hojd; return w.eval('figurTillSvg(window.__f, window.__b, window.__h, window.__val)'); };
const svgDok = text => new w.DOMParser().parseFromString(text, 'image/svg+xml');
// All text en läsare av bilden ser (också <title>), utan mellanrum mellan siffror ("77 777" hittas som 77777).
const bildtext = text => [...svgDok(text).querySelectorAll('text, title')].map(t => t.textContent).join('\n').replace(/(\d)[\s  ](?=\d)/g, '$1');
const notrader = text => [...svgDok(text).documentElement.children].filter(e => e.tagName === 'text').map(t => t.textContent).join(' ');
const utanSmaPunkter = f => {
    const u = utanSmaGrupper(f);
    return { ...f, x: u.x, y: u.y, lager: f.lager.map(l => ({ ...l, data: l.data.filter(d => !(d && d.liten)) })) };
};
// Kör ett menyval och fångar allt som skulle lämna verktyget: bildanrop, nedladdad CSV, urklipp.
const korMeny = async (el, menyval) => {
    const ut = { bilder: [], csv: [], urklipp: [], fel: null };
    const org = { bild: w.figurTillBild, csv: w._downloadCSV, kopiera: w._copyMatrixToClipboard };
    w.figurTillBild = (figur, format, bredd, hojd, val) => { ut.bilder.push({ figur, format, bredd, hojd, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
    w._downloadCSV = rader => { ut.csv.push(rader); };
    w._copyMatrixToClipboard = rader => { ut.urklipp.push(rader); };
    w.__el = el;
    try { for (const v of menyval) await w.eval(`chartExportRun(window.__el, ${JSON.stringify(v)})`); } catch (e) { ut.fel = e; } finally {
        w.figurTillBild = org.bild; w._downloadCSV = org.csv; w._copyMatrixToClipboard = org.kopiera;
    }
    return ut;
};
const ALLA_MENYVAL = ['png-presentation', 'png-dokument', 'svg', 'data-kopiera', 'data-csv'];

describe('export av figurer', () => {
    it('figurTillSvg: fristående SVG i begärd storlek, ritad i logisk bredd 800 och skalad med viewBox; vit bakgrund, inga små grupper', () => {
        const s = svgText(medSma());
        expect(s.startsWith('<svg')).toBe(true);
        expect(s).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(s).toContain('width="1600"');
        expect(s).toContain('height="900"');
        expect(s).toContain('viewBox="0 0 800 450"');
        expect(s).toContain('fill="#ffffff"');
        expect(s).not.toContain('Liten');
        expect(bildtext(s)).not.toContain('77777');
        expect(s).not.toMatch(/class=|<style|foreignObject/);
        expect(svgText(medSma(), { visaSma: true })).toContain('Liten');
        // Menyns andra storlek och en annan proportion: viewBox följer höjd/bredd, texten är densamma.
        expect(svgText(medSma(), {}, 1920, 1080)).toContain('viewBox="0 0 800 450"');
        expect(svgText(medSma(), {}, 1920, 1080)).toContain('width="1920"');
        expect(svgText(medSma(), {}, 1000, 1000)).toContain('viewBox="0 0 800 800"');
        // Texten har ritarens vanliga storlek i den logiska bilden (skalas med bilden, inte 3–4 punkter vid 1600 px).
        const storlekar = [...svgDok(s).querySelectorAll('text')].map(t => Number(t.getAttribute('font-size')));
        expect(Math.min(...storlekar)).toBeGreaterThanOrEqual(11);
        // Ogiltiga mått ger reservstorleken i stället för NaN i bilden.
        expect(svgText(medSma(), {}, 'x', -1)).toContain('viewBox="0 0 800 450"');
    });
    it('den fristående SVG:n bär inget som hör till sidan: inga index, träffytor, knappattribut, id, skript eller yttre referenser', () => {
        const figur = staplar({ lager: [
            { marke: 'stapel', serie: 'Kvinna', data: [{ x: 'A', y: 30000, etikett: 'a' }, { x: 'Liten', y: 77777, liten: true }, { x: 'B', y: 40000 }] },
            { marke: 'linje', serie: 'Referens', tips: d => [[d.x]], data: [{ x: 'A', y: 32000 }, { x: 'B', y: 39000 }] },
            { marke: 'lada', serie: 'Individer', punkter: 'alla', data: individer('A', [30000, 31000, 32000, 33000]) },
        ] });
        // På skärmen finns allt detta (annars prövar testet ingenting).
        const skarm = ser(rita(figur, 800, { hojd: 450 }));
        for (const a of ['data-i=', 'pointer-events=', 'tabindex=', 'stroke-opacity="0"', 'data-marke="linjepunkt"']) expect(skarm, a).toContain(a);
        const s = svgText(figur);
        expect(s).not.toMatch(/ data-[li]=/);                         // en lucka i index (0, 2) skulle visa att punkt 1 saknas
        expect(s).not.toMatch(/data-nedsamplat|pointer-events|tabindex|cursor=|aria-pressed|role="button"|linjepunkt|stroke-opacity="0"/);
        expect(s).not.toMatch(/ id=|<script|<defs|<clipPath|<pattern|<image|<use|<a[ >]|url\(|href|\son[a-z]+=|<!ENTITY|<\?xml-stylesheet|<style|foreignObject|class=|style=/);
        expect((s.match(/https?:/g) || [])).toEqual(['http:']);       // bara namnrymden
        expect((s.match(/xmlns/g) || []).length).toBe(1);
        expect(svgDok(s).querySelector('parsererror')).toBeNull();
        expect(svgDok(s).documentElement.getAttribute('role')).toBe('group');
        expect(svgDok(s).documentElement.getAttribute('aria-label')).toBe(figur.beskrivning);
        // Förklaringen står kvar som bild (text och symbol), utan knapproll.
        expect([...svgDok(s).querySelectorAll('[data-serie]')].map(g => g.getAttribute('data-serie'))).toEqual(['Kvinna', 'Referens', 'Individer']);
        // Samma märken som på skärmen, minus träffytorna.
        const antal = (text, marke) => (text.match(new RegExp(`data-marke="${marke}"`, 'g')) || []).length;
        for (const m of ['stapel', 'linje', 'individ']) expect(antal(s, m), m).toBe(antal(skarm, m));
    });
    it('samma figur ger samma SVG-text varje gång, och originalfiguren rörs inte', () => {
        const f = medSma();
        const fore = JSON.stringify(f);
        expect(svgText(f)).toBe(svgText(f));
        expect(svgText(f)).toBe(svgText(medSma()));
        expect(JSON.stringify(f)).toBe(fore);
    });
    it('en ogiltig figur kastar (figurTillSvg) och avvisas (figurTillBild) — ingen halv bild', async () => {
        expect(() => svgText({ beskrivning: '', x: {}, y: {}, lager: [] })).toThrow(/Ogiltig figur/);
        w.__f = { lager: [] };
        await expect(w.eval('figurTillBild(window.__f, "svg", 800, 450)')).rejects.toThrow(/Ogiltig figur/);
    });
    it('meningen om sänkt tröskel står i bilden under 10 och saknas vid 10', () => {
        expect(svgText(staplar())).not.toContain('Minsta gruppstorlek');
        w.eval('sattKTroskel(6, { fraga: false })');
        try {
            expect(svgText(staplar())).toContain('Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.');
        } finally { w.eval('sattKTroskel(10, { fraga: false })'); }
    });
    it('G6: en nedsamplad bild säger att den visar ett urval — före meningen om sänkt tröskel, och båda ryms', () => {
        const max = w.eval('SCATTER_MAX_POINTS');
        const moln = n => ({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'P', data: [
            { x: 5, y: 77777, liten: true }, ...Array.from({ length: n }, (_, i) => ({ x: i % 97, y: i % 50 }))] }] });
        const stor = svgText(moln(2 * max + 1));
        const ritade = (stor.match(/data-marke="punkt"/g) || []).length;
        expect(ritade).toBeLessThanOrEqual(max);
        // Antalen är ritarens (utan den dolda lilla punkten), med svensk tusentalsavgränsning.
        const fmt = n => talformat(n, 'antal').replace(/\s/g, ' ');   // radbrytningen gör hårda mellanslag till vanliga
        expect(notrader(stor)).toBe(`Visar ett urval (${fmt(ritade)} av ${fmt(2 * max + 1)} punkter).`);
        expect(stor).not.toContain('data-nedsamplat');
        expect(svgText(moln(2 * max + 1))).toBe(stor);                // två ritningar, samma resultat
        expect(notrader(svgText(moln(max)))).toBe('');                // inte nedsamplad: ingen mening
        w.eval('sattKTroskel(6, { fraga: false })');
        try {
            expect(notrader(svgText(moln(2 * max + 1)))).toBe(`Visar ett urval (${fmt(ritade)} av ${fmt(2 * max + 1)} punkter). Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.`);
            // Också i menyns andra proportion och med mycket stora antal ryms båda meningarna oavkortade.
            const jatte = `Visar ett urval (${fmt(7999999)} av ${fmt(987654321)} punkter). ${w.eval('_kSanktNot()')}`;
            w.__not = jatte;
            expect([...svgDok(stor).documentElement.children].filter(e => e.tagName === 'text')[0].getAttribute('font-size')).toBe('11');   // notens storlek: 12 − 1
            expect(w.eval(`_rfRadbryt(window.__not, ${(800 - 16) / ((12 - 1) * NF)}, 2)`).join(' ')).toBe(jatte);
        } finally { w.eval('sattKTroskel(10, { fraga: false })'); }
    });
    it('serier som dolts via förklaringen ritas inte i bilden (nedtonade i förklaringen); val.dolda som inte är en mängd ignoreras', () => {
        const s = svgText(staplar(), { dolda: new Set(['Man']) });
        expect((s.match(/data-marke="stapel"/g) || []).length).toBe(2);
        expect((svgText(staplar()).match(/data-marke="stapel"/g) || []).length).toBe(4);
        expect([...svgDok(s).querySelectorAll('[data-serie]')].map(g => g.getAttribute('opacity'))).toEqual(['1', '0.4']);
        expect(() => svgText(staplar(), { dolda: ['Man'] })).not.toThrow();
        expect(() => svgText(staplar(), null)).not.toThrow();
    });
    it('figurTillBild: svg ger en data-URL som går att läsa tillbaka; okänt format avvisas', async () => {
        w.__f = staplar();
        const url = await w.eval('figurTillBild(window.__f, "svg", 800, 450)');
        expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        expect(decodeURIComponent(url.split(',')[1])).toContain('width="800"');
        expect(decodeURIComponent(url.split(',')[1])).toBe(svgText(staplar(), {}, 800, 450));
        await expect(w.eval('figurTillBild(window.__f, "gif", 800, 450)')).rejects.toThrow(/format/);
    });
    it('exportmenyn: diagramdata för ett ritat diagram — spårbarhetsrad, utan små grupper, decimalkomma', () => {
        const el = nyBehallare();
        w.__el = el; w.__f = medSma(); w.__f.lager[0].data.push({ x: 'B', y: 31000.456 });
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportBeskrivning: "BAS = A" })');
        expect(el.querySelector('svg')).not.toBeNull();                 // ritad trots bredd 0
        expect(el.querySelector('svg').textContent).toContain('Liten'); // på skärmen syns den lilla gruppen (visaSma)
        const rader = w.__chartExportRows(el);
        expect(rader[0][0]).toMatch(/^Medianlön per BAS — Lönekartläggning .*Minsta gruppstorlek för redovisning: 10\.$/);
        expect(rader[1]).toEqual(['Urval: BAS = A']);
        expect(rader.slice(2)).toEqual([['Serie', 'BAS', 'Kronor/månad'], ['Alla', 'A', 30000], ['Alla', 'B', '31000,46']]);
        expect(JSON.stringify(rader)).not.toMatch(/77777|Liten/);
    });
    it('exportMedSma: vyn avgör om små grupper följer med (Utforskas kryssruta) — och spårbarhetsraden säger det bara då', () => {
        const el = nyBehallare();
        let med = false;
        w.__el = el; w.__f = medSma(); w.__med = () => med;
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
        expect(JSON.stringify(w.__chartExportRows(el))).not.toContain('77777');
        expect(w.__chartExportRows(el)[0][0]).not.toContain('undantag');
        expect(w.eval('_rfExportFigur(window.__el).visaSma')).toBe(false);
        med = true;
        expect(JSON.stringify(w.__chartExportRows(el))).toContain('77777');
        expect(w.__chartExportRows(el)[0][0]).toContain('Den här filen kan även innehålla grupper under tröskeln (undantag: valt i Utforska).');
        expect(w.eval('_rfExportFigur(window.__el).visaSma')).toBe(true);
        // En exportMedSma som kastar räknas som nej (och rapporteras) — aldrig som ja.
        w.__state._interntFel = [];
        w.__med = () => { throw new Error('trasig'); };
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
        expect(JSON.stringify(w.__chartExportRows(el))).not.toContain('77777');
        expect(w.__state._interntFel.some(f => /diagramexport chart-exp/.test(f.plats))).toBe(true);
        w.__state._interntFel = [];
        // Bara exakt `true` är ett ja: ett löfte, en sträng eller ett tal får aldrig släppa ut små grupper.
        for (const svar of [async () => false, () => 'nej', () => 1, () => ({}), () => undefined]) {
            w.__med = svar;
            w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
            expect(w.eval('_rfExportFigur(window.__el).visaSma')).toBe(false);
            expect(JSON.stringify(w.__chartExportRows(el))).not.toMatch(/77777|undantag/);
        }
    });
    it('undantaget "Likvärdigt arbete" gäller ALLT i fliken, också ett ritat diagram vars export inte bär märkta små grupper', () => {
        const el = nyBehallare();
        el.closest('.view-panel').id = 'view-likvardighet-test';
        const lv = w.document.getElementById('view-likvardighet');
        lv.appendChild(el.closest('.card'));
        try {
            // En liten grupp som vyn inte har märkt `liten` (fliken redovisar små grupper, ADR-14): stämpeln
            // måste säga det ändå. En stämpel som varnar för mycket är ofarlig; en som varnar för lite är det inte.
            const omarkt = staplar({ lager: [{ marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 30000 }, { x: 'Liten', y: 77777 }] }] });
            w.__el = el; w.__f = omarkt;
            w.eval('ritaFigur(window.__el, window.__f, {})');
            expect(JSON.stringify(w.__chartExportRows(el))).toContain('77777');
            expect(w.__chartExportRows(el)[0][0]).toContain('(undantag: Likvärdigt arbete)');
            w.__f = medSma();
            w.eval('ritaFigur(window.__el, window.__f, {})');
            expect(w.__chartExportRows(el)[0][0]).toContain('(undantag: Likvärdigt arbete)');
            w.eval('ritaFigur(window.__el, window.__f, { exportMedSma: () => true })');
            expect(w.__chartExportRows(el)[0][0]).toContain('(undantag: Likvärdigt arbete)');
        } finally { el.closest('.card').remove(); w.document.getElementById('view-likvardighet-test')?.remove(); }
        // Utanför fliken: "valt i Utforska" bara när exporten faktiskt bär små grupper.
        const annan = nyBehallare();
        w.__el = annan; w.__f = medSma();
        w.eval('ritaFigur(window.__el, window.__f, {})');
        expect(w.__chartExportRows(annan)[0][0]).not.toContain('undantag');
        w.eval('ritaFigur(window.__el, window.__f, { exportMedSma: () => true })');
        expect(w.__chartExportRows(annan)[0][0]).toContain('(undantag: valt i Utforska)');
    });
    it('exportens underlag bestäms EN gång per export: exportMedSma anropas en gång, och stämpel och innehåll följer samma svar', async () => {
        const el = nyBehallare();
        let n = 0;
        // Svarar ja första gången och nej sedan (en kryssruta som ändras mitt i exporten): med flera frågor
        // skulle innehåll och stämpel kunna komma ur olika svar.
        w.__el = el; w.__f = medSma(); w.__med = () => { n += 1; return n === 1; };
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
        for (const v of ALLA_MENYVAL) {
            n = 0;
            const ut = await korMeny(el, [v]);
            expect(ut.fel, v).toBeNull();
            expect(n, v).toBe(1);
            const rader = ut.csv[0] || ut.urklipp[0];
            if (rader) {
                expect(JSON.stringify(rader), v).toContain('77777');
                expect(rader[0][0], v).toContain('(undantag: valt i Utforska)');
            } else expect(ut.bilder[0].val.visaSma, v).toBe(true);
        }
        // Tvärtom: nej första gången, ja sedan — varken små grupper eller undantag.
        w.__med = () => { n += 1; return n !== 1; };
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
        for (const v of ALLA_MENYVAL) {
            n = 0;
            const ut = await korMeny(el, [v]);
            expect(n, v).toBe(1);
            const rader = ut.csv[0] || ut.urklipp[0];
            if (rader) {
                expect(JSON.stringify(rader), v).not.toContain('77777');
                expect(rader[0][0], v).not.toContain('undantag');
            } else expect(ut.bilder[0].val.visaSma, v).toBe(false);
        }
    });
    it('en exportMedSma som kastar rapporteras en gång per export, och exporten sker utan små grupper', async () => {
        const el = nyBehallare();
        let n = 0;
        w.__el = el; w.__f = medSma(); w.__med = () => { n += 1; throw new Error('trasig'); };
        w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
        for (const v of ALLA_MENYVAL) {
            w.__state._interntFel = [];
            n = 0;
            const ut = await korMeny(el, [v]);
            expect(ut.fel, v).toBeNull();
            expect(n, v).toBe(1);                                     // en fråga, alltså en rapport
            expect(w.__state._interntFel.filter(f => /diagramexport chart-exp/.test(f.plats)), v).toHaveLength(1);
            const rader = ut.csv[0] || ut.urklipp[0];
            if (rader) {
                expect(JSON.stringify(rader), v).not.toMatch(/77777|Liten|undantag/);
            } else {
                expect(ut.bilder[0].val.visaSma, v).toBe(false);
                expect(svgText(ut.bilder[0].figur, ut.bilder[0].val), v).not.toContain('Liten');
            }
        }
        w.__state._interntFel = [];
    });
    it('exportMedSma når bilden: ja ger visaSma === true till figurTillBild och figurTillSvg, nej ger false', async () => {
        const el = nyBehallare();
        const org = w.figurTillSvg, orgKlick = w.HTMLAnchorElement.prototype.click;
        const sedda = [];
        let href = '';
        w.HTMLAnchorElement.prototype.click = function () { href = this.getAttribute('href'); };
        for (const svar of [true, false]) {
            w.__el = el; w.__f = medSma(); w.__med = () => svar;
            w.eval('ritaFigur(window.__el, window.__f, { visaSma: true, exportMedSma: window.__med })');
            const ut = await korMeny(el, ['png-presentation', 'png-dokument', 'svg']);
            expect(ut.fel).toBeNull();
            expect(ut.bilder.map(b => b.val.visaSma)).toEqual([svar, svar, svar]);
            // Den riktiga figurTillBild lämnar valet vidare till figurTillSvg (SVG-vägen går i jsdom).
            w.figurTillSvg = (figur, bredd, hojd, val) => { sedda.push(val.visaSma); return org(figur, bredd, hojd, val); };
            try {
                await w.eval('chartExportRun(window.__el, "svg")');
                expect(decodeURIComponent(href.split(',')[1]).includes('Liten')).toBe(svar);
            } finally { w.figurTillSvg = org; }
        }
        w.HTMLAnchorElement.prototype.click = orgKlick;
        expect(sedda).toEqual([true, false]);
    });
    it('rensas diagrammet medan bilden görs laddas ingenting ner: menyn säger det i sin felrad', async () => {
        const orgBild = w.figurTillBild, orgKlick = w.HTMLAnchorElement.prototype.click;
        let nedladdat = 0, slapp;
        w.HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) nedladdat += 1; else orgKlick.call(this); };
        w.figurTillBild = () => new Promise(klar => { slapp = () => klar('data:image/png;base64,AAAA'); });
        const vanta = () => new Promise(r => setTimeout(r, 0));
        try {
            for (const [vad, stor] of [['rensad', () => w.eval('_rfRensaAlla()')], ['ny figur', el => ritaI(el, medSma())]]) {
                const el = nyBehallare();
                ritaI(el, medSma());
                const meny = el.parentElement.querySelector('.chart-export');
                meny.querySelector('[data-chart-export="png-dokument"]').click();
                await vanta();
                stor(el);                                             // Rensa all data (eller en ny ritning) medan bilden görs
                slapp();
                await vanta();
                expect(nedladdat, vad).toBe(0);
                expect(meny.querySelector('.chart-export-fel').hidden, vad).toBe(false);
                expect(meny.querySelector('.chart-export-fel').textContent, vad).toBe('Exporten misslyckades: Diagrammet rensades innan exporten blev klar.');
            }
            // Utan störning laddas bilden ner.
            const el = nyBehallare();
            ritaI(el, medSma());
            el.parentElement.querySelector('[data-chart-export="png-dokument"]').click();
            await vanta(); slapp(); await vanta();
            expect(nedladdat).toBe(1);
        } finally { w.figurTillBild = orgBild; w.HTMLAnchorElement.prototype.click = orgKlick; }
    });
    it('figurTillBild: canvasen får samma mått som SVG:n också för ogiltiga mått (NaN, 0, text), och en tom bild avvisas', async () => {
        const d = w.document;
        const orgImage = w.Image, orgSkapa = d.createElement;
        const dukar = [];
        let tomBild = false;
        w.Image = class { set src(u) { this.url = u; setTimeout(() => this.onload(), 0); } };
        d.createElement = function (namn, ...r) {
            if (String(namn).toLowerCase() !== 'canvas') return orgSkapa.call(this, namn, ...r);
            const duk = { width: 300, height: 150, getContext: () => ({ fillRect() {}, drawImage() {} }),
                toDataURL() { return tomBild || !(this.width > 0 && this.height > 0) ? 'data:,' : 'data:image/png;base64,AAAA'; } };
            // Som en riktig canvas: ett mått som inte är ett tal blir 0.
            for (const a of ['width', 'height']) { let v = duk[a]; Object.defineProperty(duk, a, { get: () => v, set: n => { v = Number.isFinite(+n) && +n > 0 ? Math.floor(+n) : 0; } }); }
            dukar.push(duk);
            return duk;
        };
        try {
            w.__f = staplar();
            const fall = [[800, 450, 800, 450], [NaN, NaN, 1600, 900], [0, 0, 1600, 900], ['x', 'y', 1600, 900], ['1000', '500', 1000, 500],
                [1000, NaN, 1000, 563], [-5, 300, 1600, 300], [undefined, undefined, 1600, 900], [1000.4, 500.6, 1000, 501]];
            for (const [b, h, vB, vH] of fall) {
                w.__b = b; w.__h = h;
                const url = await w.eval('figurTillBild(window.__f, "png", window.__b, window.__h)');
                expect(url, `${b} × ${h}`).toBe('data:image/png;base64,AAAA');
                const duk = dukar[dukar.length - 1];
                expect([duk.width, duk.height], `${b} × ${h}`).toEqual([vB, vH]);
                // SVG:n i samma anrop har samma mått (oavrundade) som figurTillSvg ger för samma indata.
                expect(w.eval('figurTillSvg(window.__f, window.__b, window.__h)')).toMatch(new RegExp(`width="${vB}(\\.\\d+)?" height="${vH === 563 ? '562.5' : vH === 501 ? '500.6' : vH}"`));
            }
            tomBild = true;
            await expect(w.eval('figurTillBild(window.__f, "png", 800, 450)')).rejects.toThrow('Diagrambilden kunde inte skapas.');
        } finally { w.Image = orgImage; d.createElement = orgSkapa; }
    });
    it('exportmenyn: bild för ett ritat diagram går genom figurTillBild i menyns storlek, ur originalfiguren med visaSma av och de dolda serierna — bilden bär inga små grupper', async () => {
        const el = nyBehallare();
        const figur = staplar({ lager: [
            { marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 30000 }, { x: 'Liten', y: 77777, liten: true, etikett: '77 777 kr' }] },
            { marke: 'stapel', serie: 'Bara små', data: [{ x: 'A', y: 66666, liten: true }] },
            { marke: 'stapel', serie: 'Dold', data: [{ x: 'A', y: 55555 }] },
        ] });
        ritaI(el, figur, { visaSma: true });
        [...el.querySelectorAll('[data-serie]')].find(g => g.getAttribute('data-serie') === 'Dold').dispatchEvent(handelse('click'));
        expect([...el._figurDolda]).toEqual(['Dold']);
        const { bilder, fel } = await korMeny(el, ['png-presentation', 'png-dokument', 'svg']);
        expect(fel).toBeNull();
        expect(bilder.map(a => [a.format, a.bredd, a.hojd])).toEqual([['png', 1920, 1080], ['png', 1600, 900], ['svg', 1600, 900]]);
        for (const a of bilder) {
            expect(a.figur).toBe(figur);                              // originalet: färger och index som på skärmen
            expect(a.val.visaSma).toBe(false);
            expect([...a.val.dolda]).toEqual(['Dold']);
            expect(a.val.dolda).not.toBe(el._figurDolda);             // en kopia: exporten kan inte ändra skärmens läge
            const s = svgText(a.figur, a.val, a.bredd, a.hojd);
            expect(s).not.toMatch(/Liten|Bara små/);                  // varken gruppens namn eller serien som bara små punkter bär
            expect(bildtext(s)).not.toMatch(/77777|66666/);
            expect((s.match(/data-marke="stapel"/g) || []).length).toBe(1);   // A i serien Alla; Dold är dold
            expect(bildtext(s)).toContain('Dold');                    // den dolda serien står nedtonad i förklaringen
        }
        // Skärmen visar fortfarande de små (visaSma) — exporten har inte ritat om något i sidan.
        expect(el.querySelector('svg').textContent).toContain('Liten');
    });
    it('diagramdata bär alla serier (också de som dolts via förklaringen) och påverkas inte av nedsampling', () => {
        const el = nyBehallare();
        const max = w.eval('SCATTER_MAX_POINTS');
        const figur = { beskrivning: 'b', x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Lön' }, lager: [
            { marke: 'punkt', serie: 'Moln', data: Array.from({ length: max + 5 }, (_, i) => ({ x: i, y: i % 7 })) },
            { marke: 'punkt', serie: 'Dold', data: [{ x: 1, y: 2 }] }] };
        ritaI(el, figur);
        el._figurDolda.add('Dold');
        const rader = w.__chartExportRows(el);
        expect(rader.length).toBe(1 + 1 + max + 5 + 1);
        expect(rader[rader.length - 1]).toEqual(['Dold', 1, 2]);
    });
    it('en låda exporteras som statistik per kategori — aldrig individer — och bara ur det som får visas', () => {
        const el = nyBehallare();
        const loner = [30000, 31000, 32000, 33000, 34000, 35000, 36000, 37000, 38000, 39000];
        const figur = staplar({ lager: [{ marke: 'lada', serie: 'Löner', punkter: 'alla', data: [...individer('A', loner), ...individer('A', [91234], [0]), ...individer('B', [41234, 42345, 43456], [0, 1, 2])] }] });
        ritaI(el, figur, { visaSma: true });
        const rader = w.__chartExportRows(el);
        const st = ladstatistik(loner);
        expect(rader.slice(1)).toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['Löner', 'A', st.median, st.q1, st.q3]]);
        const platt = JSON.stringify(rader);
        for (const hemligt of ['91234', '41234', '42345', '43456', 'person-', 'HEMLIG', '"B"', '30000', '39000']) expect(platt, hemligt).not.toContain(hemligt);
        // Bilden: inga individers nycklar eller namn finns i SVG:n, och den lilla kategorin saknas.
        const s = svgText(figur);
        expect(s).not.toMatch(/person-|HEMLIG|nyckel/);
        expect([...svgDok(s).querySelectorAll('[data-axel="x"]')].map(t => t.textContent)).toEqual(['A']);
    });
    it('ett element som bara bär data och layout (ingen figur från diagramkärnan) exporteras inte alls', async () => {
        // Det enda som kan exporteras är en figur som ritaFigur har ritat.
        const el = nyBehallare('chart-utan-figur');
        el.data = [{ type: 'bar', name: 'A', x: ['a'], y: [1] }]; el.layout = {};
        expect(w.__chartExportRows(el)).toEqual([]);
        const ut = await korMeny(el, ['svg']);
        expect(ut.bilder).toHaveLength(0);
    });
    it('utan något att exportera lämnar ingenting verktyget: behållare utan figur (felläge, rensad) och tomt läge (alla punkter små)', async () => {
        const inget = async (el, vad) => {
            expect(w.__chartExportRows(el), vad).toEqual([]);
            for (const v of ALLA_MENYVAL) {
                const ut = await korMeny(el, [v]);
                expect(ut.fel && ut.fel.message, `${vad}: ${v}`).toBe('Det finns inget att exportera i diagrammet.');
                expect([ut.bilder, ut.csv, ut.urklipp], `${vad}: ${v}`).toEqual([[], [], []]);
            }
        };
        // Rensad: menyn står kvar, behållaren har ingen figur.
        const rensad = nyBehallare();
        ritaI(rensad, medSma());
        expect(rensad.parentElement.querySelector('.chart-export-btn')).not.toBeNull();
        w.__el = rensad; w.eval('rensaFigur(window.__el)');
        await inget(rensad, 'rensad');
        // Felläge efter en lyckad ritning.
        const trasig = nyBehallare();
        ritaI(trasig, medSma());
        w.__state._interntFel = [];
        ritaI(trasig, { beskrivning: 'x', lager: [] });
        w.__state._interntFel = [];
        expect(trasig.querySelector('[data-rf="fel"]')).not.toBeNull();
        expect(trasig._figur).toBeUndefined();
        await inget(trasig, 'felläge');
        // Tomt läge: figuren finns kvar (med den lilla gruppen) men inget av den får lämna verktyget.
        const tom = nyBehallare();
        ritaI(tom, baraSma());
        expect(tom.querySelector('[data-rf="tom"]')).not.toBeNull();
        expect(tom._figur).toBeDefined();
        expect(w.eval('_rfExportFigur(window.__el).tom')).toBe(true);
        await inget(tom, 'tomt läge');
        // Säger vyn att små grupper följer med finns det något att exportera.
        ritaI(tom, baraSma(), { visaSma: true, exportMedSma: () => true });
        expect(JSON.stringify(w.__chartExportRows(tom))).toContain('77777');
        expect((await korMeny(tom, ['svg'])).bilder).toHaveLength(1);
        // Menyn i sidan: klicket visar felraden i stället för att ladda ner något, och kastar inte.
        ritaI(tom, baraSma());
        const meny = tom.parentElement.querySelector('.chart-export');
        meny.querySelector('[data-chart-export="svg"]').click();
        await new Promise(r => setTimeout(r, 0));
        expect(meny.querySelector('.chart-export-fel').hidden).toBe(false);
        expect(meny.querySelector('.chart-export-fel').textContent).toBe('Exporten misslyckades: Det finns inget att exportera i diagrammet.');
        // Anropad direkt ritar figurTillSvg en tom yta för en figur med bara små punkter — utan spår av dem.
        const s = svgText(baraSma());
        expect(s).toBe(svgText(utanSmaPunkter(baraSma())));
        expect(s).not.toMatch(/Liten|Hemlig serie|data-marke/);
        expect(bildtext(s)).not.toContain('77777');
    });
    it('Rensa all data tar bort ritade diagram och deras sparade figurer — oavsett id, också tomt läge och bortkopplade behållare', () => {
        const d = w.document;
        const kon = d.getElementById('chart-kon-scatter');            // ett diagram med chart-id
        const utanChart = nyBehallare('figur-utan-chart-id');
        const utanId = d.createElement('div'); utanChart.parentElement.appendChild(utanId);
        const tom = d.createElement('div'); tom.id = 'tomt-diagram'; utanChart.parentElement.appendChild(tom);
        const lost = d.createElement('div'); lost.id = 'lost'; utanChart.parentElement.appendChild(lost);
        const medTips = () => { const f = staplar(); f.lager[0].tips = p => [[`TIPS ${p.y}`]]; return f; };
        ritaI(kon, staplar()); ritaI(utanChart, staplar()); ritaI(utanId, staplar()); ritaI(tom, baraSma()); ritaI(lost, medTips());
        lost.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        expect(tipset().textContent).toContain('TIPS');
        lost.remove();                                                // vyn byter ut behållaren medan tipset visas
        const alla = [kon, utanChart, utanId, tom, lost];
        expect(w.__rfBehallare().length).toBeGreaterThanOrEqual(alla.length);
        for (const el of alla) expect(el._figur).toBeDefined();
        w.eval('_rensaAllData()');
        for (const el of alla) {
            expect(el._figur, el.id).toBeUndefined();
            expect(el._rfKoppling, el.id).toBeUndefined();
            expect(el.querySelector('svg'), el.id).toBeNull();
            expect(el.textContent, el.id).toBe('');
        }
        expect(w.__rfBehallare()).toEqual([]);
        expect(tipset().textContent).toBe('');
        expect(tipsSyns()).toBe(false);
        expect(w.__rfTipsAgare()).toBeNull();
    });
});

describe('export: det som lämnar verktyget är identiskt med exporten av en figur där de små punkterna tagits bort', () => {
    // Differentialtest över hela figurlistan (samma som S1 använder för skärmen). Bilden jämförs tecken för tecken,
    // utan normalisering: den exporterade SVG:n bär inga index. Diagramdatan går den riktiga vägen (ritaFigur →
    // chartExportRows). En läcka — ett värde, en kategori, ett serienamn, ett antal, en förskjuten geometri,
    // en not — gör att texterna skiljer sig.
    const HEMLIGT = /HEMLIG|NYCK|ETIK|98765|91111|99333/;
    const rader = figur => {
        const el = nyBehallare();
        ritaI(el, figur);
        const ut = w.__chartExportRows(el);
        w.__el = el; w.eval('rensaFigur(window.__el)');
        return ut;
    };
    it('listan prövar något: varje figur ger en annan bild och annan diagramdata när små grupper följer med', () => {
        for (const [namn, figur, val] of ritfigurer()) {
            const v = { dolda: val && val.dolda };
            expect(svgText(figur, { ...v, visaSma: true }), namn).not.toBe(svgText(figur, v));
            expect(JSON.stringify(figurTillTabell(figur)), namn).not.toBe(JSON.stringify(figurTillTabell(utanSmaGrupper(figur))));
        }
    });
    for (const [namn, figur, val] of ritfigurer()) {
        const v = { dolda: val && val.dolda };
        it(`bild: ${namn}`, () => {
            for (const [b, h] of [[1600, 900], [1920, 1080], [900, 1200]]) {
                const s = svgText(figur, v, b, h);
                expect(s, `${b}×${h}`).toBe(svgText(utanSmaPunkter(figur), v, b, h));
                expect(bildtext(s), `${b}×${h}`).not.toMatch(HEMLIGT);
                expect(s).not.toMatch(/HEMLIG|NYCK|ETIK/);
            }
        });
        it(`diagramdata: ${namn}`, () => {
            const ut = rader(figur);
            expect(ut).toEqual(rader(utanSmaPunkter(figur)));
            expect(JSON.stringify(ut)).not.toMatch(HEMLIGT);
        });
    }
    it('sänkt tröskel och nedsampling ändrar inte det: noten räknas ur det som ritas', () => {
        w.eval('sattKTroskel(4, { fraga: false })');
        try {
            for (const [namn, figur, val] of ritfigurer().filter(([n]) => /nedsampla|staplar bredvid|lådor/.test(n))) {
                const v = { dolda: val && val.dolda };
                expect(svgText(figur, v), namn).toBe(svgText(utanSmaPunkter(figur), v));
                expect(rader(figur), namn).toEqual(rader(utanSmaPunkter(figur)));
            }
        } finally { w.eval('sattKTroskel(10, { fraga: false })'); }
    });
});

describe('Uppgift 7: verktygstipset, storleksbevakningen, notisen och registret (tillägg 3)', () => {
    const medTips = () => { const f = staplar(); f.lager[0].tips = d => [['Lön', `${d.y} kr`]]; return f; };
    it('_hideChartTip tömmer portalen och släpper ägaren — Escape, rullning och ändrad fönsterstorlek lämnar ingen lönetext', () => {
        const el = behallare('chart-test');
        ritaI(el, medTips());
        const stapel = () => el.querySelector('[data-marke="stapel"]');
        const visa = () => { stapel().dispatchEvent(handelse('pointermove')); expect(tipset().textContent).toContain('30000 kr'); expect(w.__rfTipsAgare()).toBe(el); };
        const dolt = vad => {
            expect(tipsSyns(), vad).toBe(false);
            expect(tipset().textContent, vad).toBe('');
            expect(tipset().innerHTML, vad).toBe('');
            expect(w.__rfTipsAgare(), vad).toBeNull();
            expect(el._figur, vad).toBeDefined();                     // ägaren sitter i sidan: bara tipset släpps
        };
        visa(); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); dolt('Escape');
        visa(); w.dispatchEvent(new w.Event('scroll')); dolt('rullning');
        visa(); w.dispatchEvent(new w.Event('resize')); dolt('fönsterstorlek');
        visa(); w.eval('_hideChartTip()'); dolt('_hideChartTip');
        // Tipset kommer tillbaka vid nästa pekarrörelse på samma märke, utan att tips anropas igen (sparad per märke och ritning).
        let anrop = 0;
        const f = medTips(); f.lager[0].tips = d => { anrop++; return [['Lön', `${d.y} kr`]]; };
        ritaI(el, f);
        stapel().dispatchEvent(handelse('pointermove'));
        w.eval('_hideChartTip()');
        stapel().dispatchEvent(handelse('pointermove'));
        expect(tipset().textContent).toContain('30000 kr');
        expect(anrop).toBe(1);
        w.eval('_hideChartTip()');
    });
    it('_hideChartTip rensar en ägare som har lämnat dokumentet; ett tömt tips visas rätt igen', () => {
        const el = behallare('chart-borta');
        ritaI(el, medTips());
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        el.parentElement.remove();
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(el._figur).toBeUndefined();
        expect(el._rfKoppling).toBeUndefined();
        expect(tipset().textContent).toBe('');
        // _showChartTip sätter innehållet varje gång, så ett tömt tips visas rätt igen.
        w.eval('_showChartTip("<strong>Tips 1</strong>", 10, 10)');
        expect(tipsSyns()).toBe(true);
        w.eval('_hideChartTip()');
        expect(tipset().innerHTML).toBe('');
        w.eval('_showChartTip("<strong>Tips 2</strong>", 10, 10)');
        expect(tipset().innerHTML).toBe('<strong>Tips 2</strong>');
        expect(tipsSyns()).toBe(true);
        w.eval('_hideChartTip()');
    });
    it('storleksbevakningen sätter ingen timer på en behållare som städningen just rensade', () => {
        const el = behallare('chart-borta');
        ritaI(el, medTips());
        el.querySelector('[data-marke="stapel"]').dispatchEvent(handelse('pointermove'));
        const k = el._rfKoppling;
        el.parentElement.remove();                                    // behållaren äger tipset och lämnar dokumentet
        w.__el = el;
        w.eval('_rfVidStorlek(window.__el)');                         // bevakningens sista svar
        expect(el._rfKoppling).toBeUndefined();
        expect(k.vantar ?? null).toBeNull();                          // ingen väntande omritning på den kasserade kopplingen
    });
    it('notisen om urval: ett syskon med ett annat diagrams id rörs inte', () => {
        const d = w.document;
        const el = behallare('chart-test');
        const annans = d.createElement('p'); annans.className = 'scatter-sample-note'; annans.id = 'chart-annat-sample-note'; annans.textContent = 'annat diagrams notis';
        el.insertAdjacentElement('afterend', annans);
        w.__el = el;
        w.eval('_setScatterSampleNote(window.__el, null)');
        expect(annans.isConnected).toBe(true);
        w.eval('_setScatterSampleNote(window.__el, { shown: 1, total: 2 })');
        expect(d.getElementById('chart-test-sample-note').previousElementSibling).toBe(el);
        expect(annans.textContent).toBe('annat diagrams notis');
        w.eval('_setScatterSampleNote(window.__el, null)');
        expect(d.getElementById('chart-test-sample-note')).toBeNull();
        expect(annans.isConnected).toBe(true);
        // Ett syskon utan id (diagrammet fick sitt id i efterhand) är fortfarande diagrammets egen notis.
        annans.removeAttribute('id');
        w.eval('_setScatterSampleNote(window.__el, null)');
        expect(annans.isConnected).toBe(false);
    });
    it('registret: ritaFigur lägger till, rensaFigur tar bort; en behållare som lämnat dokumentet släpps vid nästa ritaFigur', () => {
        w.eval('_rfRensaAlla()');
        expect(w.__rfBehallare()).toEqual([]);
        const a = behallare('chart-a'), b = behallare('chart-b');
        ritaI(a, staplar()); ritaI(b, staplar());
        expect(w.__rfBehallare()).toEqual([a, b]);
        ritaI(a, staplar());
        expect(w.__rfBehallare()).toEqual([a, b]);                    // ingen dubblett
        // En ogiltig figur: felläget har ingen figur och står inte i registret.
        w.__state._interntFel = [];
        ritaI(b, { lager: [] });
        w.__state._interntFel = [];
        expect(w.__rfBehallare()).toEqual([a]);
        ritaI(b, staplar());
        // Vyn bygger om sin HTML utan rensaFigur: den gamla behållaren släpps när nästa diagram ritas.
        a.parentElement.remove();
        expect(a._figur).toBeDefined();
        const c = behallare('chart-c');
        ritaI(c, staplar());
        expect(a._figur).toBeUndefined();
        expect(a._rfKoppling).toBeUndefined();
        expect(w.__rfBehallare()).toEqual([b, c]);
        // En behållare som ritas UTANFÖR dokumentet och sätts in efteråt rörs inte av städningen.
        const fri = w.document.createElement('div');
        ritaI(fri, staplar());
        ritaI(c, staplar());
        expect(fri._figur).toBeDefined();
        w.document.body.appendChild(fri);
        ritaI(c, staplar());
        expect(fri._figur).toBeDefined();
        // _rfRensaAlla tar alla, också en som aldrig suttit i dokumentet.
        const aldrig = w.document.createElement('div');
        ritaI(aldrig, staplar());
        w.eval('_rfRensaAlla()');
        for (const el of [b, c, fri, aldrig]) expect(el._figur).toBeUndefined();
        expect(w.__rfBehallare()).toEqual([]);
        fri.remove();
    });
});

describe('radpaneler: små multiplar för fler än femton kategorier', () => {
    const hantel = (n, extra = {}) => {
        const kat = Array.from({ length: n }, (_, i) => `Grupp ${String(i + 1).padStart(2, '0')}`);
        return { beskrivning: 'Hantel', paneler: 'auto', hojd: 110 + 26 * n, ...extra,
            x: { skala: 'linjar', titel: 'Kronor', format: 'kr' }, y: { skala: 'band', ordning: kat },
            lager: [
                { marke: 'intervall', riktning: 'liggande', serie: 'Skillnad', farg: '#888888', data: kat.map((y, i) => ({ y, lag: 30000 + i * 100, hog: 33000 + i * 100 })) },
                { marke: 'punkt', serie: 'Kvinnor', farg: '#833a8f', data: kat.map((y, i) => ({ y, x: 30000 + i * 100 })) },
                { marke: 'punkt', serie: 'Män', farg: '#5f7f16', data: kat.map((y, i) => ({ y, x: 33000 + i * 100 })) }] };
    };
    it('15 kategorier eller färre: en vanlig bild', () => {
        const svg = rita(hantel(15));
        expect(svg.getAttribute('data-radpaneler')).toBeNull();
        expect(alla(svg, '[data-del="radpanel"]')).toHaveLength(0);
    });
    it('40 kategorier: tre delar med rubrikerna 1–15, 16–30, 31–40; varje kategori i exakt en del, med sitt index', () => {
        const f = hantel(40), svg = rita(f, 800);
        expect(svg.getAttribute('data-radpaneler')).toBe('3');
        const delar = alla(svg, ':scope > svg[data-del="radpanel"]');
        expect(delar).toHaveLength(3);
        expect(delar.map(d => alla(d, 'text').map(t => t.textContent).find(t => /^\d+–\d+$/.test(t)))).toEqual(['1–15', '16–30', '31–40']);
        const perDel = delar.map(d => alla(d, '[data-axel="y"]').map(t => t.textContent));
        expect(perDel.map(p => p.length)).toEqual([15, 15, 10]);
        expect(new Set(perDel.flat()).size).toBe(40);
        // Märkena behåller sina index i hela figuren: punkt 37 i lager 1 är Grupp 38, i sista delen.
        const m = delar[2].querySelector('[data-l="1"][data-i="37"]');
        expect(m).not.toBeNull();
        expect(delar[0].querySelector('[data-l="1"][data-i="37"]')).toBeNull();
        // Samma x-axel i alla delar, och bara den sista har förklaringen.
        const markeringar = delar.map(d => alla(d, '[data-axel="x"]').map(t => t.textContent).join('|'));
        expect(new Set(markeringar).size).toBe(1);
        expect(delar.map(d => !!d.querySelector('[data-del="forklaring"] [data-serie]'))).toEqual([false, false, true]);
        expect(tal(svg, 'height')).toBe(delar.reduce((s, d) => s + tal(d, 'height'), 0));
    });
    it('x-axlarna står rakt under varandra: samma vänstermarginal i alla delar', () => {
        const f = hantel(32);
        f.y.ordning[20] = 'En betydligt längre gruppbenämning här';
        f.lager.forEach(l => { l.data[20].y = f.y.ordning[20]; });
        const delar = alla(rita(f, 800), ':scope > svg[data-del="radpanel"]');
        const vanster = delar.map(d => d.querySelector('[data-del="rityta"] > g').getAttribute('transform'));
        expect(new Set(vanster).size).toBe(1);
    });
    it('diagramdatan är densamma som utan delning, och valideringen kräver en liggande figur', () => {
        const f = hantel(40);
        expect(figurTillTabell(f)).toEqual(figurTillTabell({ ...f, paneler: undefined }));
        expect(() => valideraFigur(f, 't')).not.toThrow();
        expect(() => valideraFigur({ ...f, y: { skala: 'linjar' }, x: { skala: 'band' } }, 't')).toThrow(/paneler "auto"/);
        expect(() => valideraFigur({ ...f, paneler: 'alla' }, 't')).toThrow(/paneler måste/);
    });
});

describe('radpaneler i exporten', () => {
    it('upp till tre delar står bredvid varandra i bildens fulla höjd', () => {
        const kat = Array.from({ length: 40 }, (_, i) => `Grupp ${i + 1}`);
        w.__f = { beskrivning: 'H', paneler: 'auto', x: { skala: 'linjar' }, y: { skala: 'band', ordning: kat },
            lager: [{ marke: 'punkt', serie: 'K', farg: '#833a8f', data: kat.map((y, i) => ({ y, x: 30000 + i })) }] };
        const svg = new w.DOMParser().parseFromString(w.eval('figurTillSvg(window.__f, 1600, 900)'), 'image/svg+xml').documentElement;
        const delar = [...svg.querySelectorAll(':scope > svg[data-del="radpanel"]')];
        expect(delar).toHaveLength(3);
        expect(delar.map(d => Number(d.getAttribute('x')))).toEqual([0, 266, 532]);
        expect(delar.every(d => d.getAttribute('y') === '0')).toBe(true);
    });
});
