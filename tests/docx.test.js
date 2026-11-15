/**
 * Word-utkastet som .docx: den rena XML-skrivaren.
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { docxDelar, xmlText } from '../src/lib/docx.js';

const tolka = xml => new new JSDOM('').window.DOMParser().parseFromString(xml, 'application/xml');
const valformad = xml => tolka(xml).getElementsByTagName('parsererror').length === 0;
const OPT = { titel: 'Lönekartläggning 2026 — dokumentation (utkast)', sidfot: 'Lönekartläggning 2026 — UTKAST', skapad: '2026-09-28T10:00:00Z' };
const t = (text, x = {}) => ({ text, ...x });

describe('docx: xmlText', () => {
    it('escapar och tar bort ogiltiga tecken, men behåller symboler', () => {
        expect(xmlText('a & b < c > "d" \'e\'')).toBe('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
        expect(xmlText('x\u0000y\u0007z\u000Bw\uFFFE')).toBe('xyzw');
        expect(xmlText('🧪 ⚠ ✓ å')).toBe('🧪 ⚠ ✓ å');
        expect(xmlText(null)).toBe('');
    });
});

describe('docx: blocken blir Word-XML', () => {
    const block = [
        { typ: 'rubrik', niva: 1, delar: [t('Lönekartläggning 2026')] },
        { typ: 'stycke', stil: 'dampad', delar: [t('Exempel · genererad')] },
        { typ: 'stycke', stil: 'utkastruta', delar: [t('⚠ UTKAST', { fet: true }), t(' att färdigställa, '), t('[HR fyller i]', { kursiv: true })] },
        { typ: 'rubrik', niva: 2, delar: [t('1. Sammanfattning')] },
        { typ: 'stycke', stil: 'fyllIn', delar: [t('[HR fyller i]', { fet: true }), t(' Slutsats & <plan>')] },
        { typ: 'stycke', delar: [] },
        { typ: 'tabell', rubrikrad: [{ delar: [t('Yrke')] }, { delar: [t('N')] }, { delar: [t('Gap')] }],
          rader: [[{ delar: [t('Usk')] }, { delar: [t('12')] }, { delar: [t('-6 %')] }], [{ delar: [t('Sjuksköterska')] }]] },
    ];
    const d = docxDelar(block, OPT);
    const doc = d['word/document.xml'];
    it('alla filer finns och är välformad XML', () => {
        expect(Object.keys(d).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml',
            'word/_rels/document.xml.rels', 'word/document.xml', 'word/footer1.xml', 'word/settings.xml', 'word/styles.xml']);
        for (const [namn, xml] of Object.entries(d)) expect(valformad(xml), namn).toBe(true);
    });
    it('rubriker har Word-standardens stilar och styckena sina stilar', () => {
        expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
        expect(doc).toContain('<w:pStyle w:val="Heading2"/>');
        expect(doc).toContain('<w:pStyle w:val="Dampad"/>');
        expect(doc).toContain('<w:pStyle w:val="FyllIn"/>');
        expect(doc).toContain('<w:pStyle w:val="Utkastruta"/>');
        for (const id of ['Heading1', 'Heading2', 'Heading3', 'Dampad', 'FyllIn', 'Utkastruta', 'Tabell']) expect(d['word/styles.xml']).toContain(`w:styleId="${id}"`);
        expect(d['word/styles.xml']).toContain('<w:outlineLvl w:val="0"/>');
    });
    it('stilarnas barn står i schemats ordning (Word är strikt, LibreOffice förlåter)', () => {
        const ORDNING = ['name', 'aliases', 'basedOn', 'next', 'link', 'autoRedefine', 'hidden', 'uiPriority', 'semiHidden',
            'unhideWhenUsed', 'qFormat', 'locked', 'rsid', 'pPr', 'rPr', 'tblPr', 'trPr', 'tcPr', 'tblStylePr'];
        const stilar = [...tolka(d['word/styles.xml']).getElementsByTagName('w:style')];
        expect(stilar.length).toBeGreaterThan(0);
        for (const s of stilar) {
            const index = [...s.children].map(c => ORDNING.indexOf(c.localName));
            expect(index, s.getAttribute('w:styleId')).not.toContain(-1);
            expect(index, s.getAttribute('w:styleId')).toEqual([...index].sort((a, b) => a - b));
        }
    });
    it('fet, kursiv och escapad text', () => {
        expect(doc).toContain('<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">⚠ UTKAST</w:t></w:r>');
        expect(doc).toContain('<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">[HR fyller i]</w:t></w:r>');
        expect(doc).toContain('Slutsats &amp; &lt;plan&gt;');
    });
    it('tabell: rubrikrad upprepas, rader delas inte, korta rader fylls ut, stycke efter sista tabellen', () => {
        const x = tolka(doc);
        const rader = x.getElementsByTagName('w:tr');
        expect(rader.length).toBe(3);
        expect(rader[0].getElementsByTagName('w:tblHeader').length).toBe(1);
        expect([...rader].every(r => r.getElementsByTagName('w:cantSplit').length === 1)).toBe(true);
        expect([...rader].every(r => r.getElementsByTagName('w:tc').length === 3)).toBe(true);
        expect([...x.getElementsByTagName('w:tc')].every(c => c.getElementsByTagName('w:p').length >= 1)).toBe(true);
        const kropp = x.getElementsByTagName('w:body')[0];
        const barn = [...kropp.childNodes].filter(n => n.nodeType === 1).map(n => n.nodeName);
        expect(barn.slice(-2)).toEqual(['w:p', 'w:sectPr']);
    });
    it('A4, marginaler och sidfot med sidnummer', () => {
        expect(doc).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
        expect(doc).toMatch(/<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418"/);
        expect(d['word/footer1.xml']).toContain('Lönekartläggning 2026 — UTKAST');
        expect(d['word/footer1.xml']).toContain(' PAGE ');
        expect(d['word/footer1.xml']).toContain(' NUMPAGES ');
    });
    it('relationerna pekar på filer som finns', () => {
        const mal = xml => [...xml.matchAll(/Target="([^"]+)"/g)].map(m => m[1]);
        for (const m of mal(d['_rels/.rels'])) expect(d[m], m).toBeTruthy();
        for (const m of mal(d['word/_rels/document.xml.rels'])) expect(d[`word/${m}`], m).toBeTruthy();
        for (const m of [...d['[Content_Types].xml'].matchAll(/PartName="\/([^"]+)"/g)].map(x => x[1])) expect(d[m], m).toBeTruthy();
    });
    it('metadatan: titel, skapare och tid — inga andra namn', () => {
        const core = d['docProps/core.xml'];
        expect(core).toContain('<dc:title>Lönekartläggning 2026 — dokumentation (utkast)</dc:title>');
        expect(core).toContain('<dc:creator>Öppen lönekartläggning</dc:creator>');
        expect(core).toContain('2026-09-28T10:00:00Z');
        expect(core).not.toMatch(/lastModifiedBy|<cp:keywords|<dc:subject/);
    });
});

describe('docx: bilder', () => {
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const block = [
        { typ: 'rubrik', niva: 2, delar: [t('5. Struktur')] },
        { typ: 'bild', base64: PNG, bredd: 1400, hojd: 620, alt: 'Stapeldiagram: "andel" & <mer>', text: 'Könsfördelning per BAS-intervall' },
        { typ: 'bild', id: 'chart-x', text: 'Ett diagram utan bilddata' },
        { typ: 'bild', base64: PNG, bredd: 300, hojd: 150, text: 'En liten bild' },
    ];
    const d = docxDelar(block, OPT);
    const doc = d['word/document.xml'];
    it('varje bild med data blir en fil, en relation och en ritning; innehållstypen png anges', () => {
        expect(Object.keys(d).filter(k => k.startsWith('word/media/'))).toEqual(['word/media/bild1.png', 'word/media/bild2.png']);
        expect(d['word/media/bild1.png']).toEqual({ base64: PNG });
        expect(d['[Content_Types].xml']).toContain('<Default Extension="png" ContentType="image/png"/>');
        const rel = d['word/_rels/document.xml.rels'];
        expect(rel).toContain('Id="rIdBild1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/bild1.png"');
        expect(rel).toContain('Id="rIdBild2"');
        expect((doc.match(/<w:drawing>/g) || []).length).toBe(2);
        expect(doc).toContain('r:embed="rIdBild1"');
        expect(doc).toContain('r:embed="rIdBild2"');
        for (const xml of Object.values(d).filter(v => typeof v === 'string')) expect(valformad(xml)).toBe(true);
    });
    it('bilden är högst så bred som textytan och behåller sina proportioner; en liten bild förstoras inte', () => {
        const matt = [...doc.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/g)].map(m => [+m[1], +m[2]]);
        expect(matt).toHaveLength(2);
        expect(matt[0][0]).toBe(9070 * 635);                                   // textytans bredd i EMU
        expect(matt[0][1] / matt[0][0]).toBeCloseTo(620 / 1400, 3);
        expect(matt[1]).toEqual([300 * 9525, 150 * 9525]);
    });
    it('ritningens delar står i schemats ordning och namnrymderna är deklarerade', () => {
        const x = tolka(doc);
        expect(doc).toMatch(/<w:document [^>]*xmlns:wp="[^"]+"[^>]*xmlns:a="[^"]+"[^>]*xmlns:pic="[^"]+"/);
        const inline = x.getElementsByTagName('wp:inline')[0];
        expect([...inline.children].map(c => c.nodeName)).toEqual(['wp:extent', 'wp:effectExtent', 'wp:docPr', 'wp:cNvGraphicFramePr', 'a:graphic']);
        const pic = x.getElementsByTagName('pic:pic')[0];
        expect([...pic.children].map(c => c.nodeName)).toEqual(['pic:nvPicPr', 'pic:blipFill', 'pic:spPr']);
        const id = [...x.getElementsByTagName('wp:docPr')].map(e => e.getAttribute('id'));
        expect(new Set(id).size).toBe(id.length);
        expect(x.getElementsByTagName('wp:docPr')[0].getAttribute('descr')).toBe('Stapeldiagram: "andel" & <mer>');
    });
    it('bildtexten står som eget stycke efter bilden, och en bild utan data blir en rad som säger det', () => {
        expect(doc).toContain('Könsfördelning per BAS-intervall');
        expect(doc).toContain('[Diagram: Ett diagram utan bilddata — bilden kunde inte skapas]');
    });
    it('utan bilder har filen ingen png-typ och inga bildfiler', () => {
        const u = docxDelar([{ typ: 'stycke', delar: [t('Text')] }, { typ: 'bild', text: 'Saknas' }], OPT);
        expect(u['[Content_Types].xml']).not.toContain('png');
        expect(Object.keys(u).some(k => k.startsWith('word/media/'))).toBe(false);
        expect(u['word/document.xml']).not.toContain('<w:drawing>');
    });
});

// Förberedelse för Word-testet (A9, förskott på B6): sådant som Word kan läsa annorlunda än LibreOffice.
describe('docx: tabellerna som Word läser dem (A9)', () => {
    const c = s => ({ delar: [t(s)] });
    const tva = { typ: 'tabell', rader: [[c('Yrkesgrupper'), c('8')]] };
    const fem = { typ: 'tabell', rubrikrad: [c('Yrke'), c('n'), c('Median'), c('Mot'), c('Läge')], rader: [[c('A'), c('12'), c('30 000'), c('−3 %'), c('Lägre')]] };
    const kropp = block => [...tolka(docxDelar(block, OPT)['word/document.xml']).getElementsByTagName('w:body')[0].childNodes]
        .filter(n => n.nodeType === 1);
    it('två tabeller i följd skiljs av ett stycke (Word slår annars ihop dem till en tabell)', () => {
        const barn = kropp([tva, fem]).map(n => n.nodeName);
        expect(barn).toEqual(['w:tbl', 'w:p', 'w:tbl', 'w:p', 'w:sectPr']);
    });
    it('tabellens bredd står i samma enhet som kolumnerna och cellerna, och tblLook finns i schemats ordning', () => {
        for (const tbl of kropp([tva, fem]).filter(n => n.nodeName === 'w:tbl')) {
            const pr = tbl.getElementsByTagName('w:tblPr')[0];
            const tblW = pr.getElementsByTagName('w:tblW')[0];
            const grid = [...tbl.getElementsByTagName('w:gridCol')].map(g => Number(g.getAttribute('w:w')));
            expect(tblW.getAttribute('w:type')).toBe('dxa');
            expect(Number(tblW.getAttribute('w:w'))).toBe(grid.reduce((s, v) => s + v, 0));
            expect([...tbl.getElementsByTagName('w:tcW')].every(w => w.getAttribute('w:type') === 'dxa')).toBe(true);
            expect([...pr.childNodes].map(n => n.nodeName)).toEqual(['w:tblStyle', 'w:tblW', 'w:tblLook']);
            const harRubrik = tbl.getElementsByTagName('w:tblHeader').length > 0;
            expect(pr.getElementsByTagName('w:tblLook')[0].getAttribute('w:firstRow')).toBe(harRubrik ? '1' : '0');
        }
    });
});

// F5 i punkt 26: kolumnerna efter innehållet, så att ett ord i en cell inte bryts mitt i.
describe('docx: kolumnbredderna följer innehållet', () => {
    const c = s => ({ delar: [t(s)] });
    // Som Likvärdigt arbete i utkastet: en smal löpnummerkolumn, namn som långa ord, tal och en tom kolumn att fylla i.
    const lv = { typ: 'tabell',
        rubrikrad: ['#', 'Kvinnodominerad AID-etikett', 'Jämförelseetikett', 'Antal (kvinnodom. / jämf.)', 'Könsandel i jämförelseetiketten',
            'AID median högre (kr)', 'Högre med (%)', 'Kravvärdering / sakligt skäl (fyll i)'].map(c),
        rader: [
            ['1', '403010 Barnskötare (BAS C)', '503012 Drifttekniker (BAS C)', '20 / 20', '15 % (mansdominerad)', '6 000 kr', '16,3 %', ''].map(c),
            ['3', '207011 Undersköterska (BAS C)', '502010 Systemutvecklare (BAS C)', '20 / 45', '51 % (blandad)', '1 413 kr', '3,7 %', ''].map(c),
        ] };
    const grid = block => [...tolka(docxDelar([block], OPT)['word/document.xml']).getElementsByTagName('w:gridCol')].map(g => Number(g.getAttribute('w:w')));
    // Ordens bredd i Calibri 10 pt (twips, ur typsnittets mått). Tabellen ryms inte i 10 pt och skrivs tätare: 9 pt
    // och cellmarginaler på 2 × 57.
    const MARGINAL = 114, PT9 = 0.9;
    it('tabellen fyller textytan, och cellerna har kolumnernas bredd', () => {
        const g = grid(lv);
        expect(g.reduce((s, v) => s + v, 0)).toBe(9070);
        const x = tolka(docxDelar([lv], OPT)['word/document.xml']);
        const rad = x.getElementsByTagName('w:tr')[1];
        expect([...rad.getElementsByTagName('w:tcW')].map(w => Number(w.getAttribute('w:w')))).toEqual(g);
    });
    it('löpnumret får en smal kolumn', () => {
        const g = grid(lv);
        expect(g[0]).toBeLessThan(600);
        expect(g[0]).toBeLessThan(Math.min(...g.slice(1)));
    });
    it('det längsta ordet i varje cell ryms i sin kolumn', () => {
        const g = grid(lv);
        expect(g[1]).toBeGreaterThanOrEqual(PT9 * 1283 + MARGINAL);   // Undersköterska
        expect(g[2]).toBeGreaterThanOrEqual(PT9 * 1435 + MARGINAL);   // Systemutvecklare
        expect(g[4]).toBeGreaterThanOrEqual(PT9 * 1452 + MARGINAL);   // (mansdominerad)
    });
    it('ett belopp eller en procentsats står på en rad', () => {
        const g = grid(lv);
        expect(g[5]).toBeGreaterThanOrEqual(PT9 * 657 + MARGINAL);   // 6 000 kr
        expect(g[6]).toBeGreaterThanOrEqual(PT9 * 542 + MARGINAL);  // 16,3 %
    });
    it('en tabell med korta celler delar bredden efter innehållet, inte lika', () => {
        const g = grid({ typ: 'tabell', rubrikrad: [c('N'), c('Beskrivning')], rader: [[c('12'), c('En lång text som behöver mycket mer plats än talet bredvid')]] });
        expect(g[0]).toBeLessThan(g[1] / 3);
    });
    // Som Åtgärder och tidsplan: nio kolumner, belopp i kr/år, namn och fyra kolumner att fylla i. Tabellen ryms inte i
    // 10 pt; den skrivs då tätare (9 pt och smalare cellmarginaler), så att beloppen och namnen står hela.
    const HR = '[HR fyller i]';
    const atgarder = { typ: 'tabell',
        rubrikrad: ['Grupp', 'Antal berörda', 'Underlag', 'Uppskattad kostnad', 'Kostnaden avser', 'Sakliga skäl prövade?', 'Ansvarig',
            'Tidsplan (senast inom tre år)', 'Status'].map(c),
        rader: [
            ['403010 Barnskötare · BAS C', '20', 'Prioritering (under referensen)', '1 427 679 kr/år', 'Nå referensens median', HR, HR, HR, HR].map(c),
            ['207011 Undersköterska · BAS C', '20', 'Likvärdigt arbete (kandidatpar)', '1 669 800 kr/år', 'Nå jämförelseetikettens median', HR, HR, HR, HR].map(c),
        ] };
    it('en bred tabell skrivs tätare, och beloppen och namnen står ändå hela', () => {
        const xml = docxDelar([atgarder], OPT)['word/document.xml'];
        const g = grid(atgarder);
        expect(g.reduce((s, v) => s + v, 0)).toBe(9070);
        expect(xml).toContain('<w:sz w:val="18"/>');                      // 9 pt
        // Alla fyra sidorna, i schemats ordning: utan topp och botten nollar Word dem i stället för att ta stilens.
        expect(xml).toMatch(/<w:tblCellMar><w:top w:w="57" w:type="dxa"\/><w:left w:w="57" w:type="dxa"\/><w:bottom w:w="57" w:type="dxa"\/><w:right w:w="57" w:type="dxa"\/><\/w:tblCellMar>/);
        const M9 = 114;   // cellmarginalerna i den täta tabellen
        expect(g[3]).toBeGreaterThanOrEqual(0.9 * 1249 + M9);   // 1 669 800 kr/år i 9 pt (1249 twips i 10 pt)
        expect(g[0]).toBeGreaterThanOrEqual(0.9 * 1283 + M9);   // Undersköterska
        expect(g[4]).toBeGreaterThanOrEqual(0.9 * 1682 + M9);   // jämförelseetikettens
    });
    it('en tabell som ryms skrivs i tabellstilens 10 pt och marginaler', () => {
        // Som Grupper att bedöma i utkastet.
        const grupper = { typ: 'tabell',
            rubrikrad: ['AID-etikett', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Ojusterad löneskillnad ≥ 5 %',
                'Saklig förklaring (fyll i)', 'Åtgärd/beslut (fyll i)'].map(c),
            rader: [['502010 Systemutvecklare', '23 / 22', '38 219 kr', '40 238 kr', '95,0 %', '≥ 5 %', '', ''].map(c)] };
        const xml = docxDelar([grupper], OPT)['word/document.xml'];
        expect(xml).not.toContain('<w:sz w:val="18"/>');
        expect(xml).not.toContain('<w:tblCellMar>');
    });
});

// S5 i punkt 26: en ruta eller en rubrik delas inte mellan två sidor, och en ruta att fylla i står på samma sida som
// det den bedömer. Rutan själv hålls inte ihop med nästa: då skulle den följa med nästa avsnitts rubrik.
describe('docx: rutor och rubriker hålls ihop över sidbrytningar (S5)', () => {
    const c = s => ({ delar: [t(s)] });
    const stilar = tolka(docxDelar([], OPT)['word/styles.xml']);
    const stilPPr = id => [...stilar.getElementsByTagName('w:style')].find(s => s.getAttribute('w:styleId') === id)
        .getElementsByTagName('w:pPr')[0];
    const har = (pPr, namn) => !!pPr && pPr.getElementsByTagName(namn).length > 0;
    it('varje rubrik hålls ihop med nästa stycke och delas inte', () => {
        for (const id of ['Heading1', 'Heading2', 'Heading3']) {
            expect(har(stilPPr(id), 'w:keepNext'), id).toBe(true);
            expect(har(stilPPr(id), 'w:keepLines'), id).toBe(true);
        }
    });
    it('rutorna och de dämpade styckena (som texten om AID) delas inte', () => {
        for (const id of ['FyllIn', 'Utkastruta', 'Dampad']) expect(har(stilPPr(id), 'w:keepLines'), id).toBe(true);
        for (const id of ['FyllIn', 'Utkastruta', 'Dampad']) expect(har(stilPPr(id), 'w:keepNext'), id).toBe(false);
    });
    it('styckeegenskaperna står i schemats ordning', () => {
        const ORDNING = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'widowControl', 'pBdr', 'shd', 'tabs', 'spacing', 'ind', 'jc', 'outlineLvl', 'rPr'];
        for (const pPr of stilar.getElementsByTagName('w:pPr')) {
            const index = [...pPr.children].map(n => ORDNING.indexOf(n.localName));
            expect(index).not.toContain(-1);
            expect(index).toEqual([...index].sort((a, b) => a - b));
        }
    });
    const kropp = block => [...tolka(docxDelar(block, OPT)['word/document.xml']).getElementsByTagName('w:body')[0].children];
    const ruta = { typ: 'stycke', stil: 'fyllIn', delar: [t('[HR fyller i]', { fet: true }), t(' Bedömning')] };
    it('stycket före en ruta att fylla i hålls ihop med rutan', () => {
        const [fore, r, efter] = kropp([{ typ: 'stycke', delar: [t('Ett köns median står bara där …')] }, ruta, { typ: 'stycke', delar: [t('Nästa')] }]);
        expect(har(fore.getElementsByTagName('w:pPr')[0], 'w:keepNext')).toBe(true);
        expect(har(r.getElementsByTagName('w:pPr')[0], 'w:keepNext')).toBe(false);
        expect(har(efter.getElementsByTagName('w:pPr')[0], 'w:keepNext')).toBe(false);
    });
    it('en tabell före en ruta att fylla i: tabellens sista rad hålls ihop med rutan', () => {
        const tabell = { typ: 'tabell', rubrikrad: [c('AID-etikett'), c('Status')], rader: [[c('Vårdbiträde'), c('Värt att granska')], [c('Lärare'), c('Värt att granska')]] };
        const [tbl] = kropp([tabell, ruta]);
        const rader = [...tbl.getElementsByTagName('w:tr')];
        const keep = tr => [...tr.getElementsByTagName('w:p')].map(p => har(p.getElementsByTagName('w:pPr')[0], 'w:keepNext'));
        expect(keep(rader[rader.length - 1])).toEqual([true, true]);
        expect(keep(rader[1])).toEqual([false, false]);
    });
    it('utan ruta efter får stycken och tabeller inga extra egenskaper', () => {
        const xml = docxDelar([{ typ: 'stycke', delar: [t('A')] }, { typ: 'tabell', rader: [[c('x')]] }, { typ: 'stycke', delar: [t('B')] }], OPT)['word/document.xml'];
        expect(xml).not.toContain('keepNext');
    });
});
