/**
 * K-tröskeln som inställning: bilder av diagram bär meningen under 10.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { fonster } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('k-tröskeln: bilder av diagram bär meningen under 10', () => {
    const MENING = 'Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.';
    // Diagrammen ritas av diagramkärnan (ADR-39): bilden görs ur figuren, och meningen läggs i exportens SVG.
    const FIGUR = () => ({ beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: [{ x: 'a', y: 1 }] }] });
    function ritad(w, id) {
        let el = w.document.getElementById(id);
        if (!el) { el = w.document.createElement('div'); el.id = id; w.document.body.appendChild(el); }
        w.__el = el; w.__f = FIGUR();
        w.eval('ritaFigur(window.__el, window.__f, {})');
        return el;
    }
    // Samlar texten i varje bild som görs (figurTillBild byts mot en uppsamlare som ritar SVG:n).
    function samla(w) {
        const bilder = [];
        w.figurTillBild = (figur, format, b, h, val) => { bilder.push(w.figurTillSvg(figur, b, h, val).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')); return Promise.resolve('data:image/png;base64,AAAA'); };
        return bilder;
    }
    const kontrollera = (text, k) => (k === 6 ? expect(text).toContain(MENING) : expect(text).not.toContain('Tröskeln är sänkt'));

    it.each([[6], [10]])('exportmenyns bild vid %i', async k => {
        const w = fonster(k);
        const bilder = samla(w);
        const el = ritad(w, 'chart-kon-scatter');
        w.HTMLAnchorElement.prototype.click = () => {};
        w.__el = el;
        await w.eval("_chartExportImage(window.__el, 'png-dokument')");
        expect(bilder).toHaveLength(1);
        kontrollera(bilder[0], k);
        expect(el.textContent).not.toContain('Tröskeln är sänkt');   // diagrammet på skärmen är orört
    });
    it.each([[6], [10]])('ZIP-exportens bilder vid %i', async k => {
        const { readFileSync } = await import('node:fs');
        const w = fonster(k);
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));   // ZIP-filen bär också Excel-filen
        // ZIP-filens egna diagrambilder görs i 1920 punkters bredd; Word-utkastets bilder i filen är smalare och står
        // i ett dokument som bär meningen i sidfoten.
        const zipBilder = [];
        w.figurTillBild = (figur, format, b, h, val) => { if (b === 1920) zipBilder.push(w.figurTillSvg(figur, b, h, val).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')); return Promise.resolve('data:image/png;base64,AAAA'); };
        w.JSZip = class { file() {} generateAsync() { return Promise.resolve(new w.Blob(['x'])); } };
        w.URL.createObjectURL = () => 'blob:x';
        w.HTMLAnchorElement.prototype.click = () => {};
        expect(await w.eval('exportZip()')).toBe(true);
        expect(zipBilder.length).toBeGreaterThan(3);                 // diagram ur flera flikar, utan att någon flik öppnats
        for (const bild of zipBilder) kontrollera(bild, k);
    });
    it.each([[6], [10]])('rapportunderlagets diagramkopia vid %i', async k => {
        const w = fonster(k);
        // Diagrammet ritas av diagramkärnan (ADR-39): bilden görs ur figuren, och meningen läggs i SVG:n.
        const svg = [];
        w.figurTillBild = (figur, format, b, h, val) => { svg.push(w.figurTillSvg(figur, b, h, val)); return Promise.resolve('data:image/png;base64,AAAA'); };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: items => items[0].o['image/png'] } });
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        expect(await w.eval("kopieraRapportDiagram('chart-skevhet-overview')")).toBe('urklipp');
        expect(svg).toHaveLength(1);
        const text = svg[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (k === 6) expect(text).toContain('Tröskeln är sänkt från standardvärdet 10');
        else expect(text).not.toContain('Tröskeln är sänkt');
    });
    it.each([[6], [10]])('prioriteringsmatrisens nedladdning vid %i', async k => {
        const w = fonster(k);
        // Matrisen ritas av diagramkärnan (ADR-39): bilden görs ur figuren, och meningen läggs i exportens SVG.
        const svg = [];
        w.figurTillBild = (figur, format, b, h, val) => { svg.push(w.figurTillSvg(figur, b, h, val)); return Promise.resolve('data:image/png;base64,AAAA'); };
        w.HTMLAnchorElement.prototype.click = () => {};
        w.__renderTabContent('prioritering');
        w.document.getElementById('chart-prio-matrix').parentElement.querySelector('.chart-export [data-chart-export="png-presentation"]').click();
        await new Promise(r => setTimeout(r, 400));
        expect(svg).toHaveLength(1);
        const text = svg[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (k === 6) expect(text).toContain('Tröskeln är sänkt från standardvärdet 10');
        else expect(text).not.toContain('Tröskeln är sänkt');
        expect(w.document.getElementById('chart-prio-matrix').textContent).not.toContain('Tröskeln är sänkt');   // skärmens diagram orört
    });
});
