// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- #17 Spara/ladda konfiguration som JSON ----
/**
 * Bygger ett serialiserbart snapshot av användarens konfiguration: prio-trösklar,
 * vikter, kostnadsinställningar och bristyrkes-AID:n.
 * Set-objekt konverteras till Array (JSON.stringify hanterar inte Set).
 * @returns {Object} JSON-säker konfigurationsstruktur.
 */
function buildConfigSnapshot() {
    return {
        version: 2,
        timestamp: new Date().toISOString(),
        prioConfig: { ...state.prioConfig },
        prioWeights: { ...state.prioWeights },
        costSettings: { ...state.costSettings },
        kTroskel: kTroskel(),   // minsta gruppstorlek för redovisning (ADR-38); paketets låsningar (ADR-47) bärs inte
        rapportUrval: state.rapportUrval ? { ordning: [...state.rapportUrval.ordning], med: [...state.rapportUrval.med] } : null,   // vilka avsnitt som följer med i rapporten
        // Bug-fix: Set-objekt serialiseras inte korrekt med spread/JSON
        bristAids: Array.from(state.bristAids || []),
        likvardighet: state.likvardighet ? {
            source: state.likvardighet.source,
            kvinnoTrosholdPct: state.likvardighet.kvinnoTrosholdPct,
            minGapPct: state.likvardighet.minGapPct,
            topN: state.likvardighet.topN
        } : null,
        // Löneöversyn/prognos: bara inställningar (pott + fördelningsregler), ej utfall
        forecast: state.forecast ? {
            budget:   { ...state.forecast.budget },
            generell: { ...state.forecast.generell },
            targets:  (state.forecast.targets || []).map(t => ({ ...t })),
            minGroupN: state.forecast.minGroupN,
            roundStep: state.forecast.roundStep,
            years: state.forecast.years
        } : null,
        // Organisationspaketet (ADR-28) bärs inte — bara vilket paket som användes, så att
        // den som läser in konfigurationen kan läsa in samma paket.
        organisationspaket: state.paket ? { organisation: state.paket.organisation, skapat: state.paket.skapat } : null,
        ui: {
            prioRef:          /** @type {HTMLInputElement} */ (document.querySelector('input[name="prio-ref"]:checked'))?.value || null,
            prioLabelMode:    /** @type {HTMLInputElement} */ (document.getElementById('prio-label-mode'))?.value || null,
            konColorBy:       /** @type {HTMLInputElement} */ (document.getElementById('kon-color-by'))?.value || null,
            orgTyp:           _skrDel(),   // organisationstypen styr SKR-referensen (ADR-34)
            jamforelse:       jamforelseVal()   // Jämförelsestatistik: källa, BAS-intervall, sektor
        },
        // HR:s manuella arbete (användarens egna inmatningar). Ingår i den
        // användarinitierade nedladdningen.
        // Innehåller INGA råa individrader; kan innehålla användarförfattad text
        // (avsedd på gruppnivå) och ska hanteras som övriga exportfiler.
        bes8: (typeof _bes8Areas === 'function' ? _bes8Areas() : [])
            .map(a => ({ n: a.n, status: a.status, note: a.note })),
        actionChecklistDone: Array.from(state._actionChecklistDone || []),
        orgName: orgNamn(''),
        jmfNamn: jmfNamn(''),
        strukturNarrative: (() => {
            const nb = document.getElementById('struktur-narrative');
            return (nb && nb.dataset.dirty === '1') ? /** @type {HTMLInputElement} */ (nb).value : null;   // null = auto-genererat, spara ej
        })()
    };
}

/**
 * Återställer state och DOM-inputs från ett tidigare sparat config-snapshot.
 *
 * Transaktionell import med tvåfas-commit.
 * FAS 1 — validera och bygg upp en *kopia* av target-state i ett temporärt objekt.
 *           Eventuella fel kastas innan något muteras.
 * FAS 2 — om validering lyckas: atomär applicering på state + DOM.
 *           Om något kastar i fas 1 är det globala state-objektet helt orört.
 *
 * Detta hindrar att en delvis korrupt config-fil lämnar state i blandat
 * tillstånd (vissa fält ändrade, andra kvar) — vilket annars kan leda till
 * tysta felaktiga analyser.
 *
 * @param {Object} cfg - Snapshot från buildConfigSnapshot().
 * @returns {{varningar: string[]}} Det i filen som inte tillämpades fast filen var giltig (en tröskel under
 *   organisationspaketets golv, ADR-47).
 * @throws {Error} Med beskrivande meddelande vid valideringsfel. State opåverkat.
 */
function applyConfigSnapshot(cfg) {
    // ---- FAS 1: Validera + bygg upp i isolerat temp-objekt ----
    if (!cfg || typeof cfg !== 'object')
        throw new Error('Konfigurationen är inte ett giltigt objekt.');
    if (cfg.version !== 2)
        throw new Error(`Okänt konfigurationsformat (version ${cfg.version}). Förväntade version 2.`);

    const tmp = {};

    // prioConfig: kräver numeriska tröskelvärden
    if (cfg.prioConfig != null) {
        if (typeof cfg.prioConfig !== 'object') throw new Error('prioConfig är inte ett objekt.');
        ['atgardThreshold', 'akutMinN', 'bevakaThreshold', 'analyseraThreshold'].forEach(k => {
            if (cfg.prioConfig[k] != null && typeof cfg.prioConfig[k] !== 'number')
                throw new Error(`prioConfig.${k} måste vara ett nummer, fick ${typeof cfg.prioConfig[k]}.`);
        });
        tmp.prioConfig = { ...PRIO_CONFIG_DEFAULTS, ...cfg.prioConfig };
    }
    // prioWeights: numeriska
    if (cfg.prioWeights != null) {
        if (typeof cfg.prioWeights !== 'object') throw new Error('prioWeights är inte ett objekt.');
        ['avvikelse', 'volym', 'jamstalldhet'].forEach(k => {
            if (cfg.prioWeights[k] != null && typeof cfg.prioWeights[k] !== 'number')
                throw new Error(`prioWeights.${k} måste vara ett nummer.`);
        });
        tmp.prioWeights = { ...PRIO_WEIGHTS_DEFAULTS, ...cfg.prioWeights };
    }
    // costSettings: numeriska + bounds
    if (cfg.costSettings != null) {
        if (typeof cfg.costSettings !== 'object') throw new Error('costSettings är inte ett objekt.');
        if (cfg.costSettings.poPct != null && (typeof cfg.costSettings.poPct !== 'number' || cfg.costSettings.poPct < 0 || cfg.costSettings.poPct > 200))
            throw new Error('costSettings.poPct måste vara ett tal mellan 0 och 200.');
        if (cfg.costSettings.months != null && (typeof cfg.costSettings.months !== 'number' || cfg.costSettings.months < 1 || cfg.costSettings.months > 60))
            throw new Error('costSettings.months måste vara ett tal mellan 1 och 60.');
        tmp.costSettings = { ...COST_DEFAULTS, ...cfg.costSettings };
    }
    // bristAids: array av strängar
    if (cfg.rapportUrval != null) {
        const u = cfg.rapportUrval;
        if (typeof u !== 'object' || !Array.isArray(u.ordning) || !Array.isArray(u.med) || ![...u.ordning, ...u.med].every(x => typeof x === 'string'))
            throw new Error('rapportUrval måste ha listorna ordning och med.');
        tmp.rapportUrval = { ordning: u.ordning, med: u.med };
    }
    if (cfg.bristAids != null) {
        if (!Array.isArray(cfg.bristAids)) throw new Error('bristAids måste vara en array.');
        if (!cfg.bristAids.every(a => typeof a === 'string' || typeof a === 'number'))
            throw new Error('bristAids får endast innehålla strängar eller nummer.');
        tmp.bristAids = new Set(cfg.bristAids.map(String));
    }
    // likvardighet: validera fält (§ 3:10-inställningar)
    if (cfg.likvardighet != null) {
        if (typeof cfg.likvardighet !== 'object') throw new Error('likvardighet måste vara ett objekt.');
        const lv = {};
        if (cfg.likvardighet.source != null) {
            if (cfg.likvardighet.source !== 'organisation' && cfg.likvardighet.source !== 'statistik')
                throw new Error('likvardighet.source måste vara "organisation" eller "statistik".');
            lv.source = cfg.likvardighet.source;
        }
        for (const k of ['kvinnoTrosholdPct', 'minGapPct', 'topN']) {
            if (cfg.likvardighet[k] != null) {
                if (typeof cfg.likvardighet[k] !== 'number') throw new Error(`likvardighet.${k} måste vara ett nummer.`);
                lv[k] = cfg.likvardighet[k];
            }
        }
        tmp.likvardighet = lv;
    }
    // forecast: löneöversynsinställningar (inga råa rader)
    if (cfg.forecast != null) {
        if (typeof cfg.forecast !== 'object') throw new Error('forecast måste vara ett objekt.');
        const fc = { budget: { mode: 'pct', value: null }, generell: { mode: 'pct', value: null }, targets: [], minGroupN: 10, roundStep: 0, years: 1, scenarios: { A: null, B: null }, result: null };
        if (cfg.forecast.minGroupN != null) {
            if (typeof cfg.forecast.minGroupN !== 'number' || cfg.forecast.minGroupN < 0) throw new Error('forecast.minGroupN måste vara ett icke-negativt tal.');
            fc.minGroupN = cfg.forecast.minGroupN;
        }
        if (cfg.forecast.roundStep != null) {
            if (typeof cfg.forecast.roundStep !== 'number' || cfg.forecast.roundStep < 0) throw new Error('forecast.roundStep måste vara ett icke-negativt tal.');
            fc.roundStep = cfg.forecast.roundStep;
        }
        if (cfg.forecast.years != null) {
            if (typeof cfg.forecast.years !== 'number' || cfg.forecast.years < 1 || cfg.forecast.years > 5) throw new Error('forecast.years måste vara 1–5.');
            fc.years = Math.round(cfg.forecast.years);
        }
        const valMode = (o, name) => {
            if (!o) return { mode: 'pct', value: null };
            if (o.mode != null && o.mode !== 'pct' && o.mode !== 'kr') throw new Error(`forecast.${name}.mode måste vara "pct" eller "kr".`);
            if (o.value != null && typeof o.value !== 'number') throw new Error(`forecast.${name}.value måste vara ett nummer eller null.`);
            return { mode: o.mode || 'pct', value: o.value == null ? null : o.value };
        };
        fc.budget = valMode(cfg.forecast.budget, 'budget');
        fc.generell = valMode(cfg.forecast.generell, 'generell');
        if (cfg.forecast.targets != null) {
            if (!Array.isArray(cfg.forecast.targets)) throw new Error('forecast.targets måste vara en array.');
            fc.targets = cfg.forecast.targets.filter(t => t && typeof t === 'object').map(t => ({
                bas: String(t.bas || ''), aid: String(t.aid || ''),
                mode: t.mode === 'kr' ? 'kr' : 'pct',
                value: (t.value == null || typeof t.value !== 'number') ? null : t.value,
                dist: ['flat', 'lowest', 'target'].includes(t.dist) ? t.dist : 'lowest',
                targetLevel: t.targetLevel === 'p25' ? 'p25' : 'median',
                pool: ['equity', 'marknad', 'befordran', 'övrigt'].includes(t.pool) ? t.pool : 'övrigt',
                // Valfritt och bakåtkompatibelt (filer utan fältet läses som förut): en rad verktyget själv
                // föreslog ur § 3:10-par bär kalla: 'par' och rensas när tröskeln höjs (ADR-38 R2); en rad
                // utan fältet är användarens egen och står kvar med noten om gruppen är under tröskeln.
                ...(t.kalla === 'par' ? { kalla: 'par' } : {})
            }));
        }
        tmp.forecast = fc;
    }
    // ui: optional objekt
    if (cfg.ui != null && typeof cfg.ui !== 'object')
        throw new Error('ui-blocket måste vara ett objekt.');
    // organisationspaket: bara en påminnelse; värdena visas som text och vitlistas.
    if (cfg.organisationspaket && typeof cfg.organisationspaket === 'object') {
        const org = typeof cfg.organisationspaket.organisation === 'string' ? cfg.organisationspaket.organisation.substring(0, 200) : null;
        const skapat = typeof cfg.organisationspaket.skapat === 'string' ? cfg.organisationspaket.skapat.substring(0, 20) : null;
        if (org) tmp.organisationspaket = { organisation: org, skapat };
    }
    tmp.ui = cfg.ui || null;

    // HR:s manuella arbete. Saknas fälten hoppar vi över dem.
    if (cfg.bes8 != null) {
        if (!Array.isArray(cfg.bes8)) throw new Error('bes8 måste vara en array.');
        tmp.bes8 = cfg.bes8.map((a, i) => {
            if (!a || typeof a !== 'object') throw new Error(`bes8[${i}] är inte ett objekt.`);
            const n = Number(a.n);
            if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`bes8[${i}].n måste vara ett heltal 1–6.`);
            if (a.status != null && typeof a.status !== 'string') throw new Error(`bes8[${i}].status måste vara en sträng.`);
            if (a.note != null && typeof a.note !== 'string') throw new Error(`bes8[${i}].note måste vara en sträng.`);
            return { n, status: a.status || '', note: a.note || '' };
        });
    }
    if (cfg.actionChecklistDone != null) {
        if (!Array.isArray(cfg.actionChecklistDone)) throw new Error('actionChecklistDone måste vara en array.');
        if (!cfg.actionChecklistDone.every(id => typeof id === 'string')) throw new Error('actionChecklistDone får endast innehålla strängar.');
        tmp.actionChecklistDone = cfg.actionChecklistDone.slice();
    }
    if (cfg.orgName != null) {
        if (typeof cfg.orgName !== 'string') throw new Error('orgName måste vara en sträng.');
        if (cfg.orgName.length > 200) throw new Error('orgName är för långt (max 200 tecken).');
        tmp.orgName = cfg.orgName;
    }
    if (cfg.jmfNamn != null) {
        if (typeof cfg.jmfNamn !== 'string') throw new Error('jmfNamn måste vara en sträng.');
        if (cfg.jmfNamn.length > 200) throw new Error('jmfNamn är för långt (max 200 tecken).');
        tmp.jmfNamn = cfg.jmfNamn;
    }
    // Minsta gruppstorlek (ADR-38). En fil utan fältet lämnar gällande värde orört, som ett
    // organisationspaket utan fältet: den ska inte tyst sänka ett strängare värde till standard.
    if (cfg.kTroskel != null) {
        if (typeof cfg.kTroskel !== 'number' || _kTolka(cfg.kTroskel) == null)
            throw new Error(`kTroskel måste vara ett heltal mellan ${K_MIN} och ${K_MAX}.`);
        tmp.kTroskel = cfg.kTroskel;
    }
    if (cfg.strukturNarrative != null) {
        if (typeof cfg.strukturNarrative !== 'string') throw new Error('strukturNarrative måste vara en sträng eller null.');
        tmp.strukturNarrative = cfg.strukturNarrative;
    }

    // ---- FAS 2: Atomär applicering — state nu garanterat reparerbart ----
    if (tmp.prioConfig)        state.prioConfig       = tmp.prioConfig;
    if (tmp.prioWeights)       state.prioWeights      = tmp.prioWeights;
    if (tmp.costSettings)      state.costSettings     = tmp.costSettings;
    // Frågar vid sänkning under standard; nekad bekräftelse behåller värdet och resten läses in.
    // Omritningen görs en gång, sist (se nedan), eftersom mer än tröskeln ändras här.
    const varningar = [];
    let kAndrad = false;
    if (tmp.kTroskel != null) {
        const kr = sattKTroskel(tmp.kTroskel, { rita: false });
        kAndrad = kr.andrad === true;
        // Under organisationspaketets golv (ADR-47): värdet avvisas som från fältet, resten av filen läses in.
        if (!kr.ok && kr.fel) { varningar.push(`Filens minsta gruppstorlek ${tmp.kTroskel} används inte: ${kr.fel}`); if (typeof _kVisaFel === 'function') _kVisaFel(kr.fel); }
    }
    state.bristAids        = tmp.bristAids || new Set();
    sattRapportUrval(tmp.rapportUrval || null);   // okända avsnitt i filen hoppas över; utan fältet gäller hela dokumentationen
    if (tmp.likvardighet) {
        state.likvardighet = { ...state.likvardighet, ...tmp.likvardighet, result: null };
    }
    if (tmp.forecast) {
        state.forecast = /** @type {any} */ (tmp.forecast);
        // Rader som verktyget föreslog ur par (kalla: 'par') prövas mot den tröskel som gäller nu — filen kan vara
        // sparad vid en lägre — som när tröskeln höjs i gränssnittet.
        if (typeof _fcRensaParMal === 'function') _fcRensaParMal();
        if (typeof renderForecast === 'function' && document.getElementById('view-loneoversyn')) {
            try { renderForecast(); } catch (_e) { /* renderas vid nästa flikbyte */ }
        }
    }

    // Återställ HR:s manuella arbete (endast om snapshoten bar det).
    // Sätts före renderActionChecklist() nedan så avbockningarna slår igenom.
    if (tmp.bes8) tmp.bes8.forEach(a => {
        const s = document.getElementById('bes8-status-' + a.n);
        const t = document.getElementById('bes8-note-' + a.n);
        if (s) /** @type {HTMLInputElement} */ (s).value = a.status;
        if (t) /** @type {HTMLInputElement} */ (t).value = a.note;
    });
    if (typeof bes8Uppdatera === 'function') bes8Uppdatera();
    if (tmp.actionChecklistDone) state._actionChecklistDone = new Set(tmp.actionChecklistDone);
    // Bara namn som finns i filen sätts — en fil utan namn ska inte radera paketets namn.
    if (tmp.orgName) sattOrgNamn(tmp.orgName);
    if (tmp.jmfNamn) sattJmfNamn(tmp.jmfNamn);
    if (tmp.strukturNarrative != null) {
        const nb = document.getElementById('struktur-narrative');
        if (nb) { /** @type {HTMLInputElement} */ (nb).value = tmp.strukturNarrative; nb.dataset.dirty = '1'; }
    }

    // Synka DOM-inputs
    const setIf = (id, val) => { const el = document.getElementById(id); if (el && val != null) /** @type {HTMLInputElement} */ (el).value = val; };
    setIf('prio-cfg-atgard',    state.prioConfig.atgardThreshold);
    setIf('prio-cfg-akutN',     state.prioConfig.akutMinN);
    setIf('prio-cfg-bevaka',    state.prioConfig.bevakaThreshold);
    setIf('prio-cfg-analysera', state.prioConfig.analyseraThreshold);
    setIf('prio-w-avvikelse',   state.prioWeights.avvikelse);
    setIf('prio-w-volym',       state.prioWeights.volym);
    setIf('prio-w-jamstalldhet', state.prioWeights.jamstalldhet);
    setIf('prio-cost-months',   state.costSettings.months);
    setIf('prio-po-pct',        state.costSettings.poPct);
    _readCostSettings();
    if (tmp.ui) {
        ['prio-label-mode','kon-color-by'].forEach(id => {
            const el = document.getElementById(id);
            const map = { 'prio-label-mode':'prioLabelMode','kon-color-by':'konColorBy' };
            const val = tmp.ui[map[id]];
            if (el && val != null) /** @type {HTMLInputElement} */ (el).value = val;
        });
        // Vitlista (värdet kommer ur filen).
        const prioRef = tmp.ui.prioRef;
        if (prioRef === 'stallningstagande' || prioRef === 'statistik') {
            const r = document.querySelector(`input[name="prio-ref"][value="${prioRef}"]`);
            if (r) /** @type {HTMLInputElement} */ (r).checked = true;
        }
        sattOrgTyp(tmp.ui.orgTyp);   // vitlistas i sattOrgTyp
        if (tmp.ui.jamforelse && typeof tmp.ui.jamforelse === 'object') jamforelseSattVal(tmp.ui.jamforelse);
    }
    invalidateStatCaches({ recompute: false });
    // Ändrad tröskel: varje flik och hela Översikt ritas om (det täcker refreshCurrentTab och Att göra).
    if (kAndrad && state.data.length) { populateSelects(); _renderaOmAllaFlikar(); }
    else { refreshCurrentTab(); renderActionChecklist(); }
    // Påminnelse om organisationspaketet som konfigurationen skapades med.
    const op = tmp.organisationspaket;
    if (op && !(state.paket && state.paket.organisation === op.organisation && state.paket.skapat === op.skapat)) {
        const ps = document.getElementById('paket-status');
        if (ps) {
            ps.textContent = `Konfigurationen skapades med organisationspaketet från ${op.organisation}${op.skapat ? ` (${op.skapat})` : ''} — läs in det igen.`;
            ps.className = 'status-msg';
        }
    }
    return { varningar };
}

document.getElementById('btn-config-save')?.addEventListener('click', () => {
    const cfg = buildConfigSnapshot();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lonekartlaggning_config_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    const status = document.getElementById('config-status');
    if (status) { status.textContent = 'Sparad'; status.style.color = FARG.ok; setTimeout(() => status.textContent = '', 3000); }
    // Konfigfilen är en arbetsfil: den bär dina egna bedömningar och anteckningar,
    // inte bara inställningar. Påminn om förvaringsdisciplinen (ingen rå lönedata).
    _showExportSensitivityToast(`<strong>Konfiguration sparad</strong><br>
        Filen innehåller dina inställningar och <em>dina bedömningar och anteckningar</em>
        (bedömningar av regler och praxis, handlingsplan, narrativ) — men ingen rå lönedata. Förvara på behörighetsstyrd
        disk och skicka den inte via okrypterad e-post.`);
});

document.getElementById('btn-config-load')?.addEventListener('change', e => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const cfg = JSON.parse(String(/** @type {FileReader} */ (ev.target).result));
            const { varningar } = applyConfigSnapshot(cfg);
            const status = document.getElementById('config-status');
            if (status) {
                status.textContent = 'Konfiguration laddad' + (varningar.length ? '. ' + varningar.join(' ') : '');
                status.style.color = FARG.ok;
                setTimeout(() => status.textContent = '', varningar.length ? 10000 : 3000);
            }
        } catch (err) {
            const status = document.getElementById('config-status');
            if (status) { status.textContent = 'Fel: ' + err.message; status.style.color = 'var(--danger)'; }
        }
        /** @type {HTMLInputElement} */ (e.target).value = '';
    };
    reader.readAsText(file);
});

// ---- #18 A/B-jämförelse via snapshot ----
function buildAnalysisSnapshot() {
    const d = getData();
    if (!d.length) return null;
    const kv = d.filter(r => r.kon.includes('kvinna'));
    const ma = d.filter(r => r.kon === 'man' || r.kon === 'män');
    // Könsuppdelade medianer och det råa gapet sparas bara när varje kön når tröskeln (ADR-12);
    // bilden visas i jämförelsetabellen och kan ligga kvar efter att urvalet ändrats.
    const konOk = _konFarRedovisas(kv.length, ma.length);
    const medKv = konOk ? Stat.median(kv.map(r => r.lon)) : null;
    const medMa = konOk ? Stat.median(ma.map(r => r.lon)) : null;
    const reg = runOLSRegression();
    const dq = bedomningUnderlag();
    const ages = d.map(r => r.alder).filter(a => a > 0);
    return {
        timestamp: new Date().toISOString(),
        label: 'Hela organisationen',
        n: d.length,
        nKv: kv.length,
        nMa: ma.length,
        medianKv: medKv,
        medianMa: medMa,
        rawGapPct: konOk && medKv != null && medMa != null && medMa > 0 ? (medKv / medMa - 1) * 100 : null,
        unexplainedGapPct: reg.error ? null : reg.konPct,
        unexplainedPValue: reg.error ? null : reg.pValue,
        underlag: dq ? UK_ETIKETT[dq.status] : null,
        avgAge: ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null,
        nBas: getBasIntervals().length
    };
}

function renderSnapshotComparison() {
    const wrap = document.getElementById('snapshot-comparison');
    if (!wrap) return;
    const snap = state.snapshot;
    if (!snap) { wrap.style.display = 'none'; _snapshotLutning(null, null); return; }
    const cur = buildAnalysisSnapshot();
    if (!cur) { wrap.style.display = 'none'; _snapshotLutning(null, null); return; }
    // En bild sparad vid en lägre tröskel kan bära könsuppdelade mått som inte längre får visas.
    const snapKon = _konFarRedovisas(snap.nKv, snap.nMa);
    const sk = v => (snapKon ? v : null);
    wrap.style.display = 'block';
    const fmt = n => n == null ? '–' : (typeof n === 'number' ? n.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : n);
    const diff = (a, b, fmt2) => {
        if (a == null || b == null) return '<span class="f-dampad">–</span>';
        const d = a - b;
        const sgn = d >= 0 ? '+' : '';
        const klass = Math.abs(d) < 0.01 ? 'f-dampad' : (d > 0 ? 'fg-ok' : 'f-kritisk');
        return `<span class="${klass} halvfet">${sgn}${fmt2 ? fmt2(d) : fmt(d)}</span>`;
    };
    const rows = [
        ['Antal personer (n)',         snap.n,                                 cur.n,                            fmt],
        ['Kvinnor / Män',              `${snap.nKv} / ${snap.nMa}`,            `${cur.nKv} / ${cur.nMa}`,        v => v],
        ['Medianlön kvinnor (kr)',     sk(snap.medianKv),                      cur.medianKv,                     v => Math.round(v).toLocaleString('sv-SE')],
        ['Medianlön män (kr)',         sk(snap.medianMa),                      cur.medianMa,                     v => Math.round(v).toLocaleString('sv-SE')],
        // Visas som kvinnors medianlön i procent av mäns (100 + skillnaden); skillnadskolumnen blir procentenheter.
        ['Kvinnors medianlön i % av mäns', sk(snap.rawGapPct) == null ? null : 100 + snap.rawGapPct, cur.rawGapPct == null ? null : 100 + cur.rawGapPct, v => svPct(v, 1)],
        ['Oförklarat gap (regressionen, %)',    snap.unexplainedGapPct,                 cur.unexplainedGapPct,            v => svPct(v, 1)],
        ['Underlagets kvalitet',       snap.underlag,                          cur.underlag,                     v => v],
        ['Genomsnittsålder',           snap.avgAge,                            cur.avgAge,                       v => svTal(v, 1) + ' år'],
        ['Antal BAS-intervall',        snap.nBas,                              cur.nBas,                         fmt]
    ];
    const tableHtml = rows.map(([label, a, b, formatter]) => {
        const valA = (a == null) ? '–' : (formatter ? formatter(a) : fmt(a));
        const valB = (b == null) ? '–' : (formatter ? formatter(b) : fmt(b));
        const diffCell = (typeof a === 'number' && typeof b === 'number') ? diff(b, a, formatter) : '<span class="f-dampad">–</span>';
        return `<tr><td>${esc(label)}</td><td class="t-tal">${valA}</td><td class="t-tal">${valB}</td><td class="t-tal">${diffCell}</td></tr>`;
    }).join('');
    wrap.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-14-16">
            <h4 class="fs-md marg-0-0-6">Jämförelse: ögonblicksbild och nuvarande analys</h4>
            <p class="text-dampad-xs marg-0-0-10">Ögonblicksbild: ${esc(snap.label)} (${new Date(snap.timestamp).toLocaleString('sv-SE')}) — Nuvarande: ${esc(cur.label)}</p>
            <table class="data-table st-088">
                <thead><tr><th>Mått</th><th class="t-hoger">Ögonblicksbild</th><th class="t-hoger">Nuvarande</th><th class="t-hoger">Δ (nuvarande − snapshot)</th></tr></thead>
                <tbody>${tableHtml}</tbody>
            </table>
        </div>
    `;
    _snapshotLutning({ ...snap, medianKv: sk(snap.medianKv), medianMa: sk(snap.medianMa) }, cur);
}
// Medianlönen per kön i ögonblicksbilden och nu, en rad per kön (foreEfterFigur). Samma tal som tabellen ovanför, och samma
// villkor: ett köns median visas bara när den får visas i båda lägena.
function _snapshotLutning(snap, cur) {
    const ruta = document.getElementById('snapshot-lutning-ruta'), el = document.getElementById('chart-snapshot-lutning');
    if (!ruta || !el) return;
    const rader = !snap || !cur ? [] : [['Kvinnor', snap.medianKv, cur.medianKv, PALETTE.kon.kvinna], ['Män', snap.medianMa, cur.medianMa, PALETTE.kon.man]]
        .filter(([, a, b]) => typeof a === 'number' && typeof b === 'number')
        .map(([namn, fore, efter, farg]) => ({ namn, fore: Math.round(fore), efter: Math.round(efter), farg }));
    ruta.hidden = !rader.length;
    if (!rader.length) { rensaFigur(el); return; }
    ritaFigur(el, foreEfterFigur({ rader, kolumner: ['Ögonblicksbild', 'Nuvarande'], titel: 'Medianlön (kr/månad)', format: 'kr',
        beskrivning: 'Kvinnors och mäns medianlön i ögonblicksbilden och i den nuvarande analysen, en rad per kön: strecket är värdet i ögonblicksbilden, punkten det nuvarande. Samma tal som i tabellen ovanför.' }));
}

document.getElementById('btn-snapshot-save')?.addEventListener('click', () => {
    const snap = buildAnalysisSnapshot();
    if (!snap) { alert('Ladda upp data först.'); return; }
    // I: möjlighet att namnge scenariot
    const name = (prompt('Namn på scenariot (lämna tomt för standardnamn):', snap.label) || snap.label).slice(0, 80);
    snap.label = name;
    state.snapshot = snap;
    // I: Spara även i state.scenarios (max 5)
    state.scenarios = (state.scenarios || []);
    state.scenarios.unshift({ ...snap });
    if (state.scenarios.length > 5) state.scenarios.length = 5;
    /** @type {HTMLInputElement} */ (document.getElementById('btn-snapshot-compare')).disabled = false;
    /** @type {HTMLInputElement} */ (document.getElementById('btn-snapshot-clear')).disabled = false;
    const status = document.getElementById('snapshot-status');
    if (status) status.textContent = `Ögonblicksbild "${name}" sparad (${state.scenarios.length} scenario${state.scenarios.length>1?'n':''} totalt)`;
});
document.getElementById('btn-snapshot-compare')?.addEventListener('click', renderSnapshotComparison);
document.getElementById('btn-snapshot-clear')?.addEventListener('click', () => {
    state.snapshot = null;
    /** @type {HTMLInputElement} */ (document.getElementById('btn-snapshot-compare')).disabled = true;
    /** @type {HTMLInputElement} */ (document.getElementById('btn-snapshot-clear')).disabled = true;
    /** @type {HTMLElement} */ (document.getElementById('snapshot-status')).textContent = '';
    /** @type {HTMLElement} */ (document.getElementById('snapshot-comparison')).style.display = 'none';
});
