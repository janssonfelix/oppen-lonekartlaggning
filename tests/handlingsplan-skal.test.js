/**
 * Sakliga skäl som strukturerad post i Handlingsplan: fältet skal på raden, knappen med sammanfattningen, dialogen
 * #skal-modal, förslaget att markera raden som sakligt förklarad, Att göra-punkten, gruppens skillnad och
 * konfigurationsfilen. Demodata; raderna rensas på skäl först så att testerna inte beror på demots förifyllning.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
vi.setConfig({ testTimeout: 30000 });

const fonster = () => {
    const w = createAppWindow();
    w.__loadDemoData();
    w.__state.handlingsplan = {};
    w.__renderTabContent('handlingsplan');
    return w;
};
const rader = w => [...w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-seeded')];
const fyll = (w, el, varde) => { el.value = varde; el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
const ren = t => String(t).replace(/\s+/g, ' ').trim();
const modal = w => w.document.getElementById('skal-modal');
const oppen = w => modal(w).style.display === 'flex';
const knapp = tr => tr.querySelector('[data-hp-skal]');
const oppna = (w, tr) => { knapp(tr).click(); return modal(w); };
const skalRader = w => [...modal(w).querySelectorAll('.skal-rad')];
const laggTill = (w, kategori, belopp, kommentar = '') => {
    w.document.getElementById('skal-lagg-till').click();
    const r = skalRader(w).at(-1);
    fyll(w, r.querySelector('select.skal-kategori'), kategori);
    fyll(w, r.querySelector('input.skal-belopp'), String(belopp));
    if (kommentar) fyll(w, r.querySelector('input.skal-kommentar'), kommentar);
    return r;
};
/** Seedraderna i exportläget, med gruppens skillnad per rad. */
const seedExport = w => w.eval('medExportLage(() => { const s = _handlingsplanSeedRows(); return { nycklar: s.nycklar, skillnader: s.skillnader }; })');
/** En förifylld rad där gruppens skillnad (i exportläget) är över 100 kr/mån. I demot är det kandidatparen: i
 *  prioriteringens grupper har ett kön färre än minsta gruppstorlek, så de har ingen skillnad. */
const radMedSkillnad = w => { const { nycklar, skillnader } = seedExport(w);
    return rader(w).find(tr => skillnader[nycklar.indexOf(knapp(tr).dataset.hpSkal)] > 100); };
/** En rad ur Prioritering (i demot utan skillnad: ett kön under minsta gruppstorlek). */
const prioRad = w => rader(w).find(tr => knapp(tr).dataset.hpSkal.startsWith('prio|'));
const parRad = w => rader(w).find(tr => knapp(tr).dataset.hpSkal.startsWith('par|'));

describe('Handlingsplan: gruppens skillnad per rad', () => {
    it('prio: mäns median minus kvinnors i kr/mån ur prioriteringen; par: parets skillnad; egen rad: null', () => {
        const w = fonster();
        const { nycklar, skillnader } = seedExport(w);
        expect(skillnader).toHaveLength(nycklar.length);
        const prio = w.eval(`medExportLage(() => { const thr = state.prioConfig.atgardThreshold ?? -5; return computePrioritization(_selectedPrioReference()).filter(i => i.diffPct < thr).map(i => ({ n: _hpNyckel('prio', i.aid || i.yrke, i.bas), s: i.medKv && i.medMa ? Math.round(i.medMa - i.medKv) : null })); })`);
        expect(prio.length).toBeGreaterThan(0);
        for (const p of prio) expect(skillnader[nycklar.indexOf(p.n)]).toBe(p.s);
        const par = w.eval(`medExportLage(() => _parForRedovisning(likvardighetResultat().pairs).par.map(p => ({ n: _hpNyckel('par', p.kvAid, p.kvBas, p.maAid, p.maBas), s: Math.round(p.gapKr) })))`);
        expect(par.length).toBeGreaterThan(0);
        for (const p of par) expect(skillnader[nycklar.indexOf(p.n)]).toBe(p.s);
        const egen = w.eval('_hpLaggTillEgen()');
        const efter = seedExport(w);
        expect(efter.skillnader[efter.nycklar.indexOf(egen)]).toBeNull();
    });
});

describe('Handlingsplan: knappen Sakliga skäl och dialogen', () => {
    it('varje förifylld rad har knappen i kolumnen Sakliga skäl prövade?, med "—" när inga skäl finns', () => {
        const w = fonster();
        const r = rader(w);
        expect(r.length).toBeGreaterThan(0);
        for (const tr of r) {
            const b = knapp(tr);
            expect(b, 'knappen saknas').toBeTruthy();
            expect(tr.cells[4].contains(b)).toBe(true);
            expect(ren(b.textContent)).toBe('Sakliga skäl —');
            expect(b.getAttribute('aria-label')).toBe(`Sakliga skäl: ${tr.cells[1].textContent}`);
            expect(b.hasAttribute('data-noprint')).toBe(true);
        }
    });
    it('dialogen öppnas med gruppens medianskillnad överst och stängs med Escape, fokus tillbaka till knappen', () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        const { nycklar, skillnader } = seedExport(w);
        const skillnad = skillnader[nycklar.indexOf(nyckel)];
        knapp(tr).focus();
        oppna(w, tr);
        expect(oppen(w)).toBe(true);
        expect(w.__state.kLage).not.toBe('export');   // dialogen räknar i exportläget och lämnar skärmläget kvar
        const text = ren(modal(w).textContent);
        expect(text).toContain(tr.cells[1].textContent);
        expect(text).toContain(`Medianskillnad ${w.eval(`svTal(${skillnad}, 0)`).replace(/\s/g, ' ')} kr/mån`);
        expect(skalRader(w)).toHaveLength(0);
        modal(w).dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(oppen(w)).toBe(false);
        expect(w.document.activeElement).toBe(knapp(tr));
    });
    it('Lägg till skäl: kategori, belopp och kommentar lagras på raden; summeringen och knappens sammanfattning följer', () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        const { nycklar, skillnader } = seedExport(w);
        const skillnad = skillnader[nycklar.indexOf(nyckel)];
        expect(skillnad).toBeGreaterThan(100);
        oppna(w, tr);
        w.document.getElementById('skal-lagg-till').click();
        const valet = skalRader(w)[0].querySelector('select.skal-kategori');
        expect(valet.getAttribute('aria-label')).toBe('Kategori, skäl 1');
        expect([...valet.options].map(o => o.textContent)).toEqual(['Marknad', 'Utbildning', 'Erfarenhet', 'Prestation och resultat', 'Övergång', 'Annat sakligt skäl']);
        skalRader(w)[0].querySelector('[data-skal-ta-bort]').click();
        expect(skalRader(w)).toHaveLength(0);
        const belopp = Math.round(skillnad / 2);
        laggTill(w, 'marknad', belopp, 'Svårrekryterat yrke');
        expect(w.__state.handlingsplan[nyckel].skal).toEqual([{ kategori: 'marknad', belopp, kommentar: 'Svårrekryterat yrke' }]);
        const summa = ren(w.document.getElementById('skal-summa').textContent);
        const pct = v => w.eval(`svPct(${v}, 0)`).replace(/\s/g, ' ');
        const kr = v => w.eval(`svTal(${v}, 0)`).replace(/\s/g, ' ');
        expect(summa).toBe(`Förklarat ${kr(belopp)} kr (${pct(belopp / skillnad * 100)}) · Återstår ${kr(skillnad - belopp)} kr (${pct((skillnad - belopp) / skillnad * 100)})`);
        expect(ren(knapp(tr).textContent)).toBe(`Sakliga skäl 1 skäl · ${pct(belopp / skillnad * 100)}`);
        // Står kvar efter flikbyte
        w.__renderTabContent('dashboard'); w.__renderTabContent('handlingsplan');
        expect(ren(knapp(radMedSkillnad(w)).textContent)).toBe(`Sakliga skäl 1 skäl · ${pct(belopp / skillnad * 100)}`);
    });
    it('ett ogiltigt belopp lagras inte och fältet markeras; Ta bort tar bort skälet', () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        oppna(w, tr);
        const r = laggTill(w, 'erfarenhet', 300);
        expect(w.__state.handlingsplan[nyckel].skal).toHaveLength(1);
        fyll(w, r.querySelector('input.skal-belopp'), '-5');
        expect(r.querySelector('input.skal-belopp').getAttribute('aria-invalid')).toBe('true');
        expect(w.__state.handlingsplan[nyckel]).toBeUndefined();   // inget annat ifyllt: raden glöms
        fyll(w, r.querySelector('input.skal-belopp'), '250');
        expect(w.__state.handlingsplan[nyckel].skal).toEqual([{ kategori: 'erfarenhet', belopp: 250, kommentar: '' }]);
        r.querySelector('[data-skal-ta-bort]').click();
        expect(skalRader(w)).toHaveLength(0);
        expect(w.__state.handlingsplan[nyckel]).toBeUndefined();
    });
    it('högst 8 skäl: knappen Lägg till skäl blir inaktiv', () => {
        const w = fonster();
        oppna(w, radMedSkillnad(w));
        for (let i = 0; i < 8; i++) laggTill(w, 'annat', 10);
        expect(w.document.getElementById('skal-lagg-till').disabled).toBe(true);
        expect(ren(modal(w).textContent)).toContain('Högst 8 skäl per grupp');
    });
    it('summan över skillnaden varnar; vid 100 % föreslås markeringen, som sätts först när användaren bekräftar', () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        const { nycklar, skillnader } = seedExport(w);
        const skillnad = skillnader[nycklar.indexOf(nyckel)];
        oppna(w, tr);
        const markera = () => w.document.getElementById('skal-markera');
        laggTill(w, 'marknad', skillnad - 1);
        expect(markera()).toBeNull();
        expect(w.document.getElementById('skal-overstiger')).toBeNull();
        fyll(w, skalRader(w)[0].querySelector('input.skal-belopp'), String(skillnad));
        expect(markera()).toBeTruthy();
        expect(ren(markera().textContent)).toBe('Markera som sakligt förklarad');
        expect(w.__state.handlingsplan[nyckel].sakligt).toBe('');   // inte automatiskt
        laggTill(w, 'erfarenhet', 100);
        expect(ren(w.document.getElementById('skal-overstiger').textContent)).toBe('Skälen överstiger skillnaden.');
        expect(ren(w.document.getElementById('skal-summa').textContent)).toMatch(/Återstår 0 kr \(0 %\)$/);
        markera().click();
        expect(w.__state.handlingsplan[nyckel].sakligt).toBe('Ja, sakligt skäl finns');
        expect(markera()).toBeNull();
        expect(radMedSkillnad(w).cells[4].querySelector('select').value).toBe('Ja, sakligt skäl finns');
    });
    it('en grupp där ett kön har färre än minsta gruppstorlek: medianskillnaden redovisas inte, bara belopp', () => {
        const w = fonster();
        const tr = prioRad(w);
        oppna(w, tr);
        expect(ren(modal(w).textContent)).toContain('Medianskillnaden redovisas inte: ett kön i gruppen har färre än 10 personer.');
        laggTill(w, 'marknad', 400);
        expect(ren(w.document.getElementById('skal-summa').textContent)).toBe('Förklarat 400 kr');
        expect(ren(knapp(tr).textContent)).toBe('Sakliga skäl 1 skäl');
    });
    it('ett kandidatpar räknar mot parets skillnad; en egen rad visar bara belopp', () => {
        const w = fonster();
        const tr = parRad(w);
        oppna(w, tr);
        expect(ren(modal(w).textContent)).toMatch(/Medianskillnad \d[\d ]* kr\/mån/);
        w.document.querySelector('[data-skal-close]').click();
        const egen = w.eval('_hpLaggTillEgen()');
        const egenRad = rader(w).find(r => knapp(r).dataset.hpSkal === egen);
        oppna(w, egenRad);
        expect(ren(modal(w).textContent)).toContain('En egen rad har ingen medianskillnad');
        laggTill(w, 'overgang', 700);
        expect(ren(w.document.getElementById('skal-summa').textContent)).toBe('Förklarat 700 kr');
        expect(w.document.getElementById('skal-markera')).toBeNull();
        expect(ren(knapp(rader(w).find(r => knapp(r).dataset.hpSkal === egen)).textContent)).toBe('Sakliga skäl 1 skäl');
    });
    it('en kommentar som liknar ett personnummer varnar men står kvar', () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        oppna(w, tr);
        const varning = () => w.document.getElementById('skal-varning');
        expect(varning().hidden).toBe(true);
        const r = laggTill(w, 'annat', 100, '19800101-1234');
        expect(varning().hidden).toBe(false);
        expect(r.querySelector('input.skal-kommentar').getAttribute('aria-describedby')).toBe('skal-varning');
        expect(w.__state.handlingsplan[nyckel].skal[0].kommentar).toBe('19800101-1234');
        fyll(w, r.querySelector('input.skal-kommentar'), 'Lönekriterierna');
        expect(varning().hidden).toBe(true);
    });
});

describe('Handlingsplan: Att göra-punkten för rader utan val', () => {
    it('räknar förifyllda rader med rullistan tom och försvinner när alla rader har ett val', () => {
        const w = fonster();
        const punkt = () => w.eval('buildActionChecklist()').find(p => p.id === 'hp-sakliga-skal');
        const n = rader(w).length;
        expect(punkt()).toMatchObject({ kategori: 'Handlingsplan', prioritet: 'medel', tab: 'handlingsplan', titel: `${n} ${n === 1 ? 'grupp saknar' : 'grupper saknar'} sakliga skäl eller åtgärd` });
        const [forsta, ...ovriga] = rader(w);
        fyll(w, forsta.cells[4].querySelector('select'), 'Pågår');
        if (ovriga.length) expect(punkt().titel).toBe(`${n - 1} ${n - 1 === 1 ? 'grupp saknar' : 'grupper saknar'} sakliga skäl eller åtgärd`);
        for (const tr of ovriga) fyll(w, tr.cells[4].querySelector('select'), 'Nej, åtgärd behövs');
        expect(punkt()).toBeUndefined();
        w.eval('_hpLaggTillEgen()');   // en egen rad utan val räknas inte: den är ingen grupp ur underlaget
        expect(punkt()).toBeUndefined();
    });
    it('punkten finns inte utan förifyllda rader och följer inte med i sektorsöversiktens urval', () => {
        const w = createAppWindow();
        expect(w.eval('buildActionChecklist()').find(p => p.id === 'hp-sakliga-skal')).toBeUndefined();
        w.__loadDemoData();
        expect(w.eval('buildActionChecklist({ endastGrupper: true })').find(p => p.id === 'hp-sakliga-skal')).toBeUndefined();
    });
});

describe('Handlingsplan: skälen i konfigurationsfilen', () => {
    it('följer med och läses in igen; äldre poster utan skal läses som förut', () => {
        const a = fonster();
        const nyckel = knapp(radMedSkillnad(a)).dataset.hpSkal;
        oppna(a, radMedSkillnad(a));
        laggTill(a, 'marknad', 800, 'Svårrekryterat');
        laggTill(a, 'erfarenhet', 400);
        const cfg = JSON.parse(a.eval('JSON.stringify(buildConfigSnapshot())'));
        expect(cfg.handlingsplan.find(r => r.nyckel === nyckel)).toEqual({ nyckel, sakligt: '', ansvarig: '', tidsplan: '', status: '',
            skal: [{ kategori: 'marknad', belopp: 800, kommentar: 'Svårrekryterat' }, { kategori: 'erfarenhet', belopp: 400, kommentar: '' }] });
        const b = fonster();
        b.__cfg = { ...cfg, handlingsplan: [...cfg.handlingsplan, { nyckel: 'prio|9|Z', status: 'Planerad' }] };
        const { varningar } = b.eval('applyConfigSnapshot(window.__cfg)');
        expect(varningar).toEqual([]);
        expect(b.__state.handlingsplan[nyckel].skal).toEqual(cfg.handlingsplan.find(r => r.nyckel === nyckel).skal);
        expect(b.__state.handlingsplan['prio|9|Z']).toEqual({ sakligt: '', ansvarig: '', tidsplan: '', status: 'Planerad' });
    });
    it('ogiltiga skäl faller bort med en varning; en rad med bara skäl räknas som ifylld', () => {
        const b = fonster();
        b.__cfg = { version: 2, handlingsplan: [
            { nyckel: 'prio|1|A', skal: [{ kategori: 'marknad', belopp: 500 }, { kategori: 'lojalitet', belopp: 500 }, { kategori: 'annat', belopp: 300000 }] },
            { nyckel: 'prio|2|B', skal: 'inte en lista' },
        ] };
        const { varningar } = b.eval('applyConfigSnapshot(window.__cfg)');
        expect(varningar).toEqual(['3 sakliga skäl i filens handlingsplan gick inte att läsa och hoppas över.']);
        expect(b.__state.handlingsplan['prio|1|A']).toEqual({ sakligt: '', ansvarig: '', tidsplan: '', status: '', skal: [{ kategori: 'marknad', belopp: 500, kommentar: '' }] });
        expect(b.__state.handlingsplan['prio|2|B']).toBeUndefined();
    });
});

describe('Dossiererna: läs-raden pekar på bedömningen i handlingsplanen', () => {
    /** Ett kandidatpar med skillnad och ett skäl på halva skillnaden; gruppdossierns nyckel är det kvinnodominerade yrket. */
    const medSkal = () => {
        const w = fonster();
        const tr = radMedSkillnad(w);
        const nyckel = knapp(tr).dataset.hpSkal;
        const { nycklar, skillnader } = seedExport(w);
        const skillnad = skillnader[nycklar.indexOf(nyckel)];
        w.eval(`_hpSattSkal(${JSON.stringify(nyckel)}, [{ kategori: 'marknad', belopp: ${Math.round(skillnad / 2)}, kommentar: '' }, { kategori: 'erfarenhet', belopp: 0, kommentar: '' }])`);
        const [, aid, bas] = nyckel.split('|');
        return { w, nyckel, aid, bas, grupp: tr.cells[1].textContent, pct: w.eval(`svPct(${Math.round(skillnad / 2) / skillnad * 100}, 0)`).replace(/\s/g, ' ') };
    };
    it('gruppdossiern: "Bedömning i handlingsplanen: 2 skäl, NN % av skillnaden förklarad", produktgränsen står kvar', () => {
        const { w, aid, bas, pct } = medSkal();
        w.eval(`openGruppdossier(${JSON.stringify(`${aid}|${bas}`)})`);
        const d = w.document.getElementById('dossier-modal');
        const text = ren(d.textContent);
        expect(text).toContain(`Bedömning i handlingsplanen: 2 skäl, ${pct} av skillnaden förklarad.`);
        expect(text).toContain('Dossiern dokumenterar inte sakliga skäl.');
        expect(d.querySelector('[data-hp-ga-till]')).toBeTruthy();
    });
    it('länken stänger dossiern och visar raden i Handlingsplan med fokus på knappen Sakliga skäl', () => {
        const { w, nyckel, aid, bas } = medSkal();
        w.__renderTabContent('dashboard');
        w.eval(`openGruppdossier(${JSON.stringify(`${aid}|${bas}`)})`);
        [...w.document.querySelectorAll('#dossier-modal [data-hp-ga-till]')].find(a => a.dataset.hpGaTill === nyckel).click();
        expect(w.document.getElementById('dossier-modal').style.display).not.toBe('flex');
        expect(w.document.getElementById('view-handlingsplan').style.display).toBe('block');
        expect(w.document.activeElement.dataset.hpSkal).toBe(nyckel);
    });
    it('BAS-dossiern listar bedömningarna i intervallet med gruppen först; en grupp utan rad får ingen läs-rad', () => {
        const { w, bas, grupp, pct } = medSkal();
        w.eval(`openBasdossier(${JSON.stringify(bas)})`);
        const text = ren(w.document.getElementById('basdossier-modal').textContent);
        expect(text).toContain(`${grupp} (kandidatpar): Bedömning i handlingsplanen: 2 skäl, ${pct} av skillnaden förklarad.`);
        expect(text).toContain('Dossiern dokumenterar inte sakliga skäl.');
        // En grupp som inte finns i handlingsplanen: ingen läs-rad.
        const utan = w.eval(`gruppdossierCandidates().map(g => g.key).find(k => !_handlingsplanSeedRows().nycklar.some(n => n.split('|')[1] === k.split('|')[0] && n.split('|')[2] === k.split('|')[1]))`);
        w.eval(`closeBasdossier(); openGruppdossier(${JSON.stringify(utan)})`);
        expect(w.document.querySelector('#dossier-modal .hp-bedomningar')).toBeNull();
    });
    it('en rad utan skäl: läs-raden säger att inga skäl är angivna', () => {
        const w = fonster();
        const nyckel = knapp(radMedSkillnad(w)).dataset.hpSkal;
        const [, aid, bas] = nyckel.split('|');
        w.eval(`openGruppdossier(${JSON.stringify(`${aid}|${bas}`)})`);
        expect(ren(w.document.getElementById('dossier-modal').textContent)).toContain('Bedömning i handlingsplanen: inga sakliga skäl angivna ännu.');
    });
});
