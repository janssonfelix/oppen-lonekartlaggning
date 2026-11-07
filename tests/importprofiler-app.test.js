// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Importprofiler i appen: en gjord mappning sparas, följer med i konfigurationsfilen och organisationspaketet, och
// samma fil känns igen nästa gång utan mappning. Profilen bär bara rubriknamn.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { papa, vanta, csvFil, okandaRader, braRader, rot } from './helpers/granssnitt-rigg.js';
import { bakaIn } from '../src/lib/organisationsfil.js';
import { valideraImportprofil } from '../src/lib/importprofiler.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const status = w => w.document.getElementById('data-status').textContent;
const lasIn = async (w, rader, namn) => {
    papa(w);
    w.document.getElementById('data-status').textContent = '';
    w.loadStructureFile(csvFil(w, rader, namn));
    await vanta(() => status(w) && !/läser|Läser/.test(status(w)));
};
const panel = w => w.document.getElementById('column-map-panel');
const kortet = w => w.document.querySelector('#upload-cell-data .upload-importprofil');
// Kolumnerna som okandaRader() har och som delsträngarna inte känner igen.
const mappa = async w => {
    const val = { bas: 'Avd', alder: 'Fodd', kon: 'Sex' };
    for (const [roll, rubrik] of Object.entries(val)) panel(w).querySelector(`[data-colmap-role="${roll}"]`).value = rubrik;
    w.document.getElementById('data-status').textContent = '';
    panel(w).querySelector('#colmap-apply').click();
    await vanta(() => w.__state.data.length === 30 && status(w) && !/läser|Läser/.test(status(w)));
};
// CSV-mallens rubriker (BAS-intervall;AID;Manadslon;Alder;Kon) med 30 rader.
const mallRader = (poang = false) => {
    const rader = ['BAS-intervall;AID;Manadslon;Alder;Kon' + (poang ? ';Poang' : '')];
    for (let i = 0; i < 30; i++) rader.push(`C;207011;${30000 + i * 10};${30 + (i % 30)};${i % 2 ? 'Man' : 'Kvinna'}` + (poang ? ';' : ''));
    return rader;
};
const PROFIL = { id: 'personallistan', namn: 'Lönesystemets personallista',
    rubriker: { bas: ['Avd'], yrke: ['Befattning'], lon: ['Grundlon'], alder: ['Fodd'], kon: ['Sex'] } };
// Id:t härleds ur namnet och kännetecknen (src/lib/importprofiler.js); filens id används aldrig.
const PID = valideraImportprofil(PROFIL).id;
const EID = valideraImportprofil({ ...PROFIL, namn: 'Egen lista' }).id;
const paketText = (w, profiler = [PROFIL], org = 'Exempelregionen') => {
    w.__p = profiler;
    return w.eval(`JSON.stringify(_opByggPaket({ organisation: ${JSON.stringify(org)}, skapat: '2026-10-01',
        referens: { namn: 'Ställningstagande', rader: [{ aid: null, bas: 'A', p10: 25000, med: 28000, p90: 31000 }] },
        importprofiler: window.__p }))`);
};

describe('importprofiler: spara en gjord mappning och känna igen filen nästa gång', () => {
    it('okända rubriker → manuell mappning → spara → ny session med konfigurationsfilen → samma fil utan mappning', async () => {
        const w = createAppWindow();
        await lasIn(w, okandaRader());
        expect(panel(w).textContent).toContain('Kolumnmappning behövs');
        expect(panel(w).querySelector('#colmap-spara-profil')).toBeNull();   // inget att spara förrän filen lästs in med mappningen
        await mappa(w);
        expect(w.__state.data.length).toBe(30);
        const knapp = panel(w).querySelector('#colmap-spara-profil');
        expect(knapp?.textContent).toBe('Spara som importprofil');
        expect(panel(w).querySelector('#colmap-profil-namn').value).toBe('Vår personallista');
        expect(panel(w).querySelector('#colmap-till-paket')).toBeNull();   // inget paket inläst
        knapp.click();
        expect(w.__state.importprofiler).toHaveLength(1);
        const p = w.__state.importprofiler[0];
        expect(p).toMatchObject({ namn: 'Vår personallista', kalla: 'konfiguration' });
        expect(p.rubriker).toEqual({ bas: ['Avd'], yrke: ['Befattning'], lon: ['Grundlon'], alder: ['Fodd'], kon: ['Sex'] });
        expect(panel(w).textContent).toContain('Sparad som importprofil');
        expect(panel(w).querySelector('#colmap-spara-profil')).toBeNull();

        // Konfigurationsfilen bär profilen — bara rubriknamn.
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        expect(cfg.importprofiler).toEqual([{ id: p.id, namn: p.namn, rubriker: p.rubriker, kannetecken: p.kannetecken }]);

        // Ny session: konfigurationen läses in, sedan samma fil.
        const w2 = createAppWindow();
        w2.__cfg = cfg;
        const r = w2.eval('applyConfigSnapshot(window.__cfg)');
        expect(r.varningar).toEqual([]);
        expect(w2.__state.importprofiler).toHaveLength(1);
        await lasIn(w2, okandaRader());
        expect(w2.__state.data.length).toBe(30);
        expect(w2.__state.columnMap).toBeNull();
        expect(w2.__state.importprofil).toMatchObject({ namn: 'Vår personallista', kalla: 'konfiguration' });
        expect(panel(w2).textContent).not.toContain('Kolumnmappning behövs');
        expect(panel(w2).textContent).toContain('Känd uppsättning: Vår personallista (konfigurationsfilen)');
        expect(kortet(w2).hidden).toBe(false);
        expect(kortet(w2).textContent).toContain('Känd uppsättning: Vår personallista (konfigurationsfilen)');
        // Åldern kom ur födelseåret i kolumnen Fodd, könet ur Sex.
        expect(w2.__state.data.filter(d => d.kon === 'kvinna').length).toBe(15);
        expect(w2.__state.data.every(d => d.bas === 'X' && d.alder > 0)).toBe(true);
    });

    it('en konfigurationsfil med en ogiltig profil läses in med en varning, utan profilen', () => {
        const w = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        cfg.importprofiler = [PROFIL, { ...PROFIL, id: 'x', namn: 'Anna 19850101-1234' }];
        w.__cfg = cfg;
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(r.varningar.join(' ')).toMatch(/1 importprofil i filen gick inte att läsa/);
        expect(w.__state.importprofiler.map(p => p.id)).toEqual([PID]);
        cfg.importprofiler = Array.from({ length: 51 }, (_, i) => ({ ...PROFIL, id: `p-${i}` }));
        expect(w.eval('applyConfigSnapshot(window.__cfg)').varningar.join(' ')).toMatch(/50/);
    });

    it('en fil som känns igen av sig själv visar ingen sparknapp, och en inbyggd profil säger sitt namn', async () => {
        const w = createAppWindow();
        await lasIn(w, mallRader(true));
        expect(w.__state.data.length).toBe(30);
        expect(w.__state.importprofil).toMatchObject({ id: 'inbyggd-csv-mallen', kalla: 'inbyggd' });
        expect(kortet(w).textContent).toContain('Känd uppsättning: Verktygets CSV-mall (inbyggd)');
        expect(panel(w).querySelector('#colmap-spara-profil')).toBeNull();
        // En fil som ingen profil gäller för: ingen rad om känd uppsättning.
        await lasIn(w, braRader());
        expect(w.__state.importprofil).toBeNull();
        expect(kortet(w).hidden).toBe(true);
    });

    it('rubrikraden hittas efter försättsrader också när bara profilen känner igen den', async () => {
        const w = createAppWindow();
        w.__p = [PROFIL];
        w.eval("state.importprofiler = _ipValideraLista(window.__p, { kalla: 'konfiguration' }).profiler");
        // Försättsraden ger två delsträngsträffar (Lonelista, Kontor), lika många som rubrikraden (Befattning,
        // Grundlon): utan profilen tas försättsraden, den första, för rubrikrad.
        await lasIn(w, ['Rapport uttagen;Lonelista;Kontor', 'Avd;Befattning;Grundlon;Fodd;Sex', ...okandaRader().slice(1)]);
        expect(w.__state.data.length).toBe(30);
        expect(w.__state.importprofil?.id).toBe(PID);
        expect(status(w)).toContain('1 försättsrad överhoppad');
    });
});

describe('importprofiler: organisationspaketet', () => {
    it('ett paket med en profil känns igen före konfigurationsfilens, och visar källan', async () => {
        const w = createAppWindow();
        w.__p = [{ ...PROFIL, id: 'egen', namn: 'Egen lista' }];
        w.eval("state.importprofiler = _ipValideraLista(window.__p, { kalla: 'konfiguration' }).profiler");
        expect(w.lasInPaket(paketText(w)).ok).toBe(true);
        expect(w.__state.importprofiler.map(p => `${p.kalla}:${p.id}`)).toEqual(['konfiguration:' + EID, 'organisationspaket:' + PID]);
        expect(w.document.getElementById('paket-info').textContent).toContain('1 importprofil');
        await lasIn(w, okandaRader());
        expect(w.__state.data.length).toBe(30);
        expect(w.__state.importprofil).toMatchObject({ namn: 'Lönesystemets personallista', kalla: 'organisationspaket' });
        expect(kortet(w).textContent).toContain('Känd uppsättning: Lönesystemets personallista (organisationspaketet)');
    });

    it('ett nytt paket ersätter det förras profiler', () => {
        const w = createAppWindow();
        expect(w.lasInPaket(paketText(w)).ok).toBe(true);
        expect(w.lasInPaket(paketText(w, [], 'Annan organisation')).ok).toBe(true);
        expect(w.__state.importprofiler).toEqual([]);
    });

    it('med ett paket inläst: "Lägg till i organisationspaketet" laddar ner ett nytt paket med profilen', async () => {
        const w = createAppWindow();
        expect(w.lasInPaket(paketText(w, [])).ok).toBe(true);
        await lasIn(w, okandaRader());
        await mappa(w);
        panel(w).querySelector('#colmap-profil-namn').value = 'Personallistan ur lönesystemet';
        const knapp = panel(w).querySelector('#colmap-till-paket');
        expect(knapp?.textContent).toBe('Lägg till i organisationspaketet');
        let fangad = null, filnamn = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        w.HTMLAnchorElement.prototype.click = function () { filnamn = this.download; };
        knapp.click();
        await vanta(() => fangad);
        const text = await fangad.text();
        const t = w.eval('_opTolkaPaket')(text);
        expect(t.ok).toBe(true);
        expect(t.delar.importprofiler.map(p => p.namn)).toEqual(['Personallistan ur lönesystemet']);
        expect(t.paket.organisation).toBe('Exempelregionen');
        expect(filnamn).toBe('exempelregionen.lonepaket.json');
        // Profilen är också sparad för sessionen.
        expect(w.__state.importprofiler.some(p => p.namn === 'Personallistan ur lönesystemet' && p.kalla === 'konfiguration')).toBe(true);
    });
});

describe('importprofiler: Inställningar, rensning och demodata', () => {
    it('Inställningar listar profilerna med namn, källa och rubriker; Ta bort och Exportera JSON', () => {
        const w = createAppWindow(), d = w.document;
        w.__p = [PROFIL];
        w.eval("state.importprofiler = _ipValideraLista(window.__p, { kalla: 'konfiguration' }).profiler");
        w.eval('oppnaInstallningar()');
        const lista = d.getElementById('inst-importprofiler');
        expect(lista.textContent).toContain('Lönesystemets personallista');
        expect(lista.textContent).toContain('konfigurationsfilen');
        expect(lista.textContent).toMatch(/BAS-intervall\s*Avd/);
        expect(lista.textContent).toContain('Verktygets CSV-mall');   // de inbyggda nämns
        let fangad = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        w.HTMLAnchorElement.prototype.click = () => {};
        lista.querySelector(`[data-ip-exportera="${PID}"]`).click();
        expect(fangad).not.toBeNull();
        lista.querySelector(`[data-ip-ta-bort="${PID}"]`).click();
        expect(w.__state.importprofiler).toEqual([]);
        expect(d.getElementById('inst-importprofiler').textContent).toContain('Inga sparade importprofiler');
    });

    it('exporten är bara rubriknamn', () => {
        const w = createAppWindow();
        w.__p = [PROFIL];
        w.eval("state.importprofiler = _ipValideraLista(window.__p, { kalla: 'organisationspaket' }).profiler");
        const o = JSON.parse(w.eval(`importprofilExport('${PID}')`));
        expect(o.format).toBe('lonekartlaggning-importprofiler');
        expect(o.profiler).toEqual([{ id: PID, namn: PROFIL.namn, rubriker: PROFIL.rubriker,
            kannetecken: ['Avd', 'Befattning', 'Grundlon', 'Fodd', 'Sex'] }]);
    });

    it('sökregistret hittar Importprofiler i Inställningar', () => {
        const w = createAppWindow();
        const post = w.eval('SOK_FUNKTIONER').find(p => p.namn === 'Importprofiler');
        expect(post).toMatchObject({ dialog: 'installningar', falt: 'inst-importprofiler-rubrik' });
    });

    it('Rensa all data tar bort konfigurationsfilens profiler och paketets, och nollar den som gällde', async () => {
        const w = createAppWindow();
        w.__p = [{ ...PROFIL, id: 'egen', namn: 'Egen lista' }];
        w.eval("state.importprofiler = _ipValideraLista(window.__p, { kalla: 'konfiguration' }).profiler");
        expect(w.lasInPaket(paketText(w)).ok).toBe(true);
        await lasIn(w, okandaRader());
        expect(w.__state.importprofil).not.toBeNull();
        w.__clearAllData();
        expect(w.__state.importprofiler).toEqual([]);
        expect(w.__state.importprofil).toBeNull();
        expect(kortet(w).hidden).toBe(true);
    });

    it('i en organisationsfil kommer det inbakade paketets profiler tillbaka efter rensningen, som paketets övriga delar', () => {
        const INDEX = readFileSync(join(rot, 'src', 'index.html'), 'utf8');
        const tmp = createAppWindow();
        const r = bakaIn(INDEX, paketText(tmp), { skapad: '2026-10-19', organisation: 'Exempelregionen', verktygssha: 'f00' });
        const w = createAppWindow({ html: r.html });
        expect(w.__state.importprofiler.map(p => p.kalla)).toEqual(['organisationspaket']);
        w.__p = [{ ...PROFIL, id: 'egen', namn: 'Egen lista' }];
        w.eval("state.importprofiler.push(..._ipValideraLista(window.__p, { kalla: 'konfiguration' }).profiler)");
        w.__clearAllData();
        expect(w.__state.importprofiler.map(p => `${p.kalla}:${p.id}`)).toEqual(['organisationspaket:' + PID]);
    });

    it('demodatan har ingen känd uppsättning (den läses inte ur en fil)', async () => {
        const w = createAppWindow();
        await lasIn(w, mallRader());
        expect(w.__state.importprofil).not.toBeNull();
        w.__loadDemoData();
        expect(w.__state.importprofil).toBeNull();
        expect(kortet(w).hidden).toBe(true);
    });
});
