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
