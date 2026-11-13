// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Regelmatrisen (docs/utveckling/regler.md) hålls hel i båda riktningarna: varje rad pekar på en källa och en vakt
 * som finns, varje vaktfil bland testerna och webbläsarröktestet bär sin märkning i filhuvudet, och varje märkning
 * pekar tillbaka på en rad där filen står som vakt. Testet prövar struktur, aldrig formuleringar: vad en regel säger
 * och om vakten räcker avgörs i granskningen.
 *
 * Märkningen är en kommentarsrad som börjar med ordet Vaktar och ett kolon (efter "* " eller "// "), med radernas
 * id åtskilda med kommatecken. Kontrollerna är rena funktioner som tar text in, så att självtestet sist kan pröva
 * dem på en påhittad matris utan att röra riktiga filer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const KOLUMNER = ['Id', 'Regel', 'Källa', 'Vakt', 'Vaktas inte'];
const MIN_RADER = 20;
const HUVUD_RADER = 40;
const MÄRKNING = /^[ \t]*(?:\*|\/\/)[ \t]*Vaktar:[ \t]*(.*)$/gm;

// Filer vars vaktroll ska märkas: testerna (också hjälparna) och webbläsarröktestet.
const skaMärkas = f => f.startsWith('tests/') || f.startsWith('tools/browser-smoke');

const celler = rad => rad.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/** Tabellen med matrisens kolumner: rubriken, och raderna efter skiljeraden. */
function tolkaMatris(text) {
    const rader = text.split('\n');
    const start = rader.findIndex(r => r.trim().startsWith('|') && celler(r)[0] === 'Id');
    if (start < 0) return { kolumner: [], rader: [], fel: [{ slag: 'ingen-tabell' }] };
    const kolumner = celler(rader[start]);
    const fel = [];
    const tabell = [];
    for (let i = start + 2; i < rader.length && rader[i].trim().startsWith('|'); i++) {
        const c = celler(rader[i]);
        if (c.length !== kolumner.length) { fel.push({ slag: 'trasig-rad', rad: i + 1 }); continue; }
        tabell.push({ id: c[0], regel: c[1], källa: c[2], vakt: c[3], vaktasInte: c[4], rad: i + 1 });
    }
    return { kolumner, rader: tabell, fel };
}

/** Vaktcellen: sökvägar inom backtick åtskilda med kommatecken (förklaring inom parentes efter), eller "ingen: …". */
function tolkaVakt(cell) {
    if (cell.startsWith('ingen:')) return { ingen: true, sökvägar: [], fel: false };
    const delar = cell.replace(/\([^)]*\)/g, '').split(',').map(d => d.trim());
    const sökvägar = delar.map(d => /^`([^`\s]+)`$/.exec(d)?.[1]);
    return { ingen: false, sökvägar: sökvägar.filter(Boolean), fel: delar.length === 0 || sökvägar.some(s => !s) };
}

/** Id i en märkning: "S4, R12 (docs/…)" ger ['S4', 'R12']. */
const idIMärkning = innehåll => innehåll.replace(/\([^)]*\)/g, '').split(',').map(s => s.trim()).filter(Boolean);

/** Märkningarna i en fil: alla, och de som står inom filhuvudets första rader. */
function märkningar(text) {
    const alla = [], iHuvudet = [];
    for (const m of text.matchAll(MÄRKNING)) {
        const id = idIMärkning(m[1]);
        alla.push(...id);
        if (text.slice(0, m.index).split('\n').length <= HUVUD_RADER) iHuvudet.push(...id);
    }
    return { alla, iHuvudet };
}

/**
 * Alla kontroller. `filer` är filerna som söks igenom efter märkningar (sökväg → text), `finns` säger om en
 * sökväg finns på disk, `läsFil` ger texten i en vaktfil. Returnerar en lista med fel, vart och ett med sitt slag.
 */
function granska({ matris, finns, läsFil, filer, adr, skydd, minRader = MIN_RADER }) {
    const { kolumner, rader, fel } = tolkaMatris(matris);
    if (fel.some(f => f.slag === 'ingen-tabell')) return fel;
    if (JSON.stringify(kolumner) !== JSON.stringify(KOLUMNER)) fel.push({ slag: 'kolumner', kolumner });
    if (rader.length < minRader) fel.push({ slag: 'för-få-rader', antal: rader.length });

    // Id: unika, och S eller R följt av ett tal.
    const sedda = new Set();
    for (const r of rader) {
        if (!/^[SR]\d+$/.test(r.id)) fel.push({ slag: 'id-form', id: r.id });
        if (sedda.has(r.id)) fel.push({ slag: 'dubbelt-id', id: r.id });
        sedda.add(r.id);
    }

    // Vakterna: sökvägar som finns, eller "ingen:"; vaktfiler bland testerna bär radens id i filhuvudet.
    const vakterPerId = new Map();
    for (const r of rader) {
        const v = tolkaVakt(r.vakt);
        if (v.fel) fel.push({ slag: 'vaktcell', id: r.id, vakt: r.vakt });
        vakterPerId.set(r.id, new Set([...(vakterPerId.get(r.id) ?? []), ...v.sökvägar]));
        for (const s of v.sökvägar) {
            if (!finns(s)) { fel.push({ slag: 'saknad-sökväg', id: r.id, sökväg: s }); continue; }
            if (skaMärkas(s) && !märkningar(läsFil(s)).iHuvudet.includes(r.id)) fel.push({ slag: 'omärkt-vakt', id: r.id, sökväg: s });
        }
    }

    // Omvänt: varje märkning pekar på en rad, och filen står som vakt på den raden.
    for (const [sökväg, text] of filer) {
        for (const id of märkningar(text).alla) {
            if (!vakterPerId.has(id)) fel.push({ slag: 'märkning-utan-rad', id, sökväg });
            else if (!vakterPerId.get(id).has(sökväg)) fel.push({ slag: 'märkning-utan-vakt', id, sökväg });
        }
    }

    // Källorna: varje ADR-nummer har sin rubrik i arkitekturbesluten.
    for (const r of rader) {
        for (const [, n] of r.källa.matchAll(/ADR-(\d+)/g)) {
            if (!new RegExp(`^\\*\\*ADR-${n} —`, 'm').test(adr)) fel.push({ slag: 'saknat-adr', id: r.id, adr: `ADR-${n}` });
        }
    }

    // Skydden: samma S-id i skydd.md och i matrisen.
    const iSkydd = [...skydd.matchAll(/^## (S\d+)\./gm)].map(m => m[1]);
    const iMatris = rader.map(r => r.id).filter(id => id.startsWith('S'));
    for (const id of iSkydd) if (!iMatris.includes(id)) fel.push({ slag: 'skydd-utan-rad', id });
    for (const id of iMatris) if (!iSkydd.includes(id)) fel.push({ slag: 'rad-utan-skydd', id });
    return fel;
}

// ---------------------------------------------------------------------------------------------------------------

const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const sökbara = () => [...gå('tests'), ...gå('tools/browser-smoke'), 'tools/browser-smoke.mjs']
    .filter(f => /\.(js|mjs)$/.test(f));

const MATRIS = 'docs/utveckling/regler.md';
let riktigtUnderlag;
const riktig = () => riktigtUnderlag ??= ({
    matris: läs(MATRIS),
    finns: s => existsSync(join(root, s)),
    läsFil: läs,
    filer: new Map(sökbara().map(f => [f, läs(f)])),
    adr: läs('docs/utveckling/arkitekturbeslut.md'),
    skydd: läs('docs/utveckling/skydd.md'),
});
const slag = (fel, s) => fel.filter(f => f.slag === s);

describe('regelmatrisen: docs/utveckling/regler.md', () => {
    it('tabellen går att tolka, har matrisens kolumner och minst 20 rader', () => {
        const { kolumner, rader, fel } = tolkaMatris(läs(MATRIS));
        expect(fel).toEqual([]);
        expect(kolumner).toEqual(KOLUMNER);
        expect(rader.length).toBeGreaterThanOrEqual(MIN_RADER);
    });
    it('varje id är unikt och har formen S1… eller R1…', () => {
        const fel = granska(riktig());
        expect([...slag(fel, 'id-form'), ...slag(fel, 'dubbelt-id')]).toEqual([]);
    });
    it('varje sökväg i Vakt finns, och en vaktcell är sökvägar eller börjar med "ingen:"', () => {
        const fel = granska(riktig());
        expect([...slag(fel, 'vaktcell'), ...slag(fel, 'saknad-sökväg')]).toEqual([]);
    });
    it('varje vaktfil bland testerna och röktestet bär radens id i filhuvudet', () => {
        expect(slag(granska(riktig()), 'omärkt-vakt')).toEqual([]);
    });
    it('omvänt: varje märkning nämner en rad som finns, och filen står som vakt på den', () => {
        const fel = granska(riktig());
        expect([...slag(fel, 'märkning-utan-rad'), ...slag(fel, 'märkning-utan-vakt')]).toEqual([]);
    });
    it('varje ADR-nummer i Källa har sin rubrik i arkitekturbesluten', () => {
        expect(slag(granska(riktig()), 'saknat-adr')).toEqual([]);
    });
    it('varje skydd i skydd.md har en rad, och varje S-rad är ett skydd', () => {
        const fel = granska(riktig());
        expect([...slag(fel, 'skydd-utan-rad'), ...slag(fel, 'rad-utan-skydd')]).toEqual([]);
    });
    it('inga andra fel', () => {
        expect(granska(riktig())).toEqual([]);
    });
});

describe('regelmatrisen: självtest av tolkaren och kontrollerna', () => {
    // En påhittad matris med ett fel av varje slag. Filernas text är skriven på en rad med \n, så att den här
    // filens egen källtext inte innehåller några märkningsrader, och beslutet som saknas sätts ihop, så att
    // dokumentationstestets sökning efter beslutsnummer inte hittar det.
    const okäntAdr = ['ADR', '99'].join('-');
    const matris = [
        'Inledning.',
        '',
        '| Id | Regel | Källa | Vakt | Vaktas inte |',
        '|---|---|---|---|---|',
        '| S1 | Ett skydd | `skydd.md` S1, ADR-1 | `tests/a.test.js` (förklaring, med komma) | – |',
        `| R1 | En regel | ${okäntAdr} | \`tests/b.test.js\`, \`tests/saknas.test.js\` | – |`,
        '| R1 | Samma id igen | – | ingen: text | – |',
        '| R2 | Utan vakt | – | ingen: text | – |',
        '| X3 | Fel form | – | tests/utan-backtick.test.js | – |',
        '| R4 | Trasig rad | – |',
    ].join('\n');
    const filer = new Map([
        ['tests/a.test.js', '/**\n * Om a.\n * Vaktar: S1 (docs/utveckling/regler.md)\n */\n'],
        ['tests/b.test.js', '/**\n * Om b, utan märkning.\n */\n'],
        ['tests/c.test.js', '// Vaktar: R7\n'],
        ['tests/d.test.js', '// Vaktar: R2\n'],
        ['tests/e.test.js', 'describe(\'S2: en etikett, ingen märkning\', () => {});\n'],
    ]);
    const fel = granska({
        matris,
        finns: s => filer.has(s),
        läsFil: s => filer.get(s),
        filer,
        adr: '**ADR-1 — Ett beslut.**\n',
        skydd: '## S1. Ett skydd\n\n## S2. Ett till\n',
        minRader: 20,
    });

    it('tolkaren läser raderna och vaktcellerna', () => {
        const { rader, fel: tolkfel } = tolkaMatris(matris);
        expect(rader.map(r => r.id)).toEqual(['S1', 'R1', 'R1', 'R2', 'X3']);
        expect(tolkfel).toEqual([{ slag: 'trasig-rad', rad: 10 }]);
        expect(tolkaVakt('`tests/a.test.js` (förklaring, med komma), `eslint.config.js`')).toEqual({ ingen: false, sökvägar: ['tests/a.test.js', 'eslint.config.js'], fel: false });
        expect(tolkaVakt('ingen: text').ingen).toBe(true);
        expect(tolkaVakt('tests/a.test.js').fel).toBe(true);
        expect(idIMärkning('S4, R12 (docs/utveckling/regler.md)')).toEqual(['S4', 'R12']);
    });
    it('märkningen läses bara som kommentarsrad, och i huvudet bara inom de första 40 raderna', () => {
        expect(märkningar('/**\n * Vaktar: S4, R1\n */').iHuvudet).toEqual(['S4', 'R1']);
        expect(märkningar('// Vaktar: S2').alla).toEqual(['S2']);
        expect(märkningar('describe(\'S2: inga id i SVG:n\')\n * Vaktar att listan byggs om\n').alla).toEqual([]);
        const sent = '\n'.repeat(45) + '// Vaktar: S1\n';
        expect(märkningar(sent)).toEqual({ alla: ['S1'], iHuvudet: [] });
    });
    it('rapporterar ett fel av varje slag i den påhittade matrisen', () => {
        expect(slag(fel, 'trasig-rad')).toHaveLength(1);
        expect(slag(fel, 'för-få-rader')).toHaveLength(1);
        expect(slag(fel, 'dubbelt-id')).toEqual([{ slag: 'dubbelt-id', id: 'R1' }]);
        expect(slag(fel, 'id-form')).toEqual([{ slag: 'id-form', id: 'X3' }]);
        expect(slag(fel, 'vaktcell')).toEqual([expect.objectContaining({ id: 'X3' })]);
        expect(slag(fel, 'saknad-sökväg')).toEqual([{ slag: 'saknad-sökväg', id: 'R1', sökväg: 'tests/saknas.test.js' }]);
        expect(slag(fel, 'omärkt-vakt')).toEqual([{ slag: 'omärkt-vakt', id: 'R1', sökväg: 'tests/b.test.js' }]);
        expect(slag(fel, 'märkning-utan-rad')).toEqual([{ slag: 'märkning-utan-rad', id: 'R7', sökväg: 'tests/c.test.js' }]);
        expect(slag(fel, 'märkning-utan-vakt')).toEqual([{ slag: 'märkning-utan-vakt', id: 'R2', sökväg: 'tests/d.test.js' }]);
        expect(slag(fel, 'saknat-adr')).toEqual([{ slag: 'saknat-adr', id: 'R1', adr: okäntAdr }]);
        expect(slag(fel, 'skydd-utan-rad')).toEqual([{ slag: 'skydd-utan-rad', id: 'S2' }]);
    });
    it('en riktig etikett som "S2: …" i en testfil räknas inte som märkning', () => {
        expect(fel.filter(f => f.sökväg === 'tests/e.test.js')).toEqual([]);
    });
    it('en matris utan tabell ger ett enda fel', () => {
        expect(granska({ matris: 'ingen tabell', finns: () => true, läsFil: () => '', filer: new Map(), adr: '', skydd: '' }))
            .toEqual([{ slag: 'ingen-tabell' }]);
    });
});
