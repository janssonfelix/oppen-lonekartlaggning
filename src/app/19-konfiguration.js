// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { valideraArsbokslut } from '../lib/arsbokslut.js';
import { gapVariablerArStandard, normaliseraGapVariabler } from '../lib/gapuppdelning.js';
import { valideraImportprofiler } from '../lib/importprofiler.js';
import { arInomGrans, filStorlekFel, installningsGrans } from '../lib/installningsgranser.js';
import { konfigurationMedNyaNamn, konfigurationVersion, konfigurationVersionFel } from '../lib/konfiguration.js';
import { K_MAX, K_MIN, kTolka } from '../lib/ktroskel.js';
import { perBasReceptArStandard, valideraPerBasRecept } from '../lib/perbas.js';
import { forklaringsmodellArStandard, normaliseraForklaringsmodell } from '../lib/regression.js';
import { ogonblicksbildMatt } from '../lib/struktur.js';
import { valideraRecept } from '../lib/tabellrecept.js';
import { svPct, svTal } from '../lib/talformat.js';
import { FARG } from './01-farger.js';
import { esc } from './01-html-och-tillganglighet.js';
import { idagDatum } from './03-hjalpfunktioner.js';
import { _konFarRedovisas, _kVisaFel, _renderaOmAllaFlikar, kInstalld, kTroskel, sattKTroskel } from './06-k-troskel.js';
import { _skrDel } from './06-kvinnoandel-referens.js';
import { COST_DEFAULTS, jmfNamn, orgNamn, PRIO_CONFIG_DEFAULTS, PRIO_WEIGHTS_DEFAULTS, sattJmfNamn, sattOrgNamn } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { rensaFigur, ritaFigur } from './10-diagramritare.js';
import { PALETTE } from './10-diagramtema.js';
import { getBasIntervals, getData, state } from './12-tillstand.js';
import { bedomningUnderlag, populateSelects, UK_ETIKETT } from './13-oversikt.js';
import { renderActionChecklist } from './18-atgardslista.js';
import { _showExportSensitivityToast } from './22-exporthjalpare.js';
import { medExportLage, visningNy } from './23-exportgrind.js';
import { sattOrgTyp } from './29-organisationspaket.js';
import { invalidateStatCaches } from './30-statistikcacher.js';
import { refreshCurrentTab } from './31-navigering.js';
import { _fcRensaParMal, foreEfterFigur, ritaLoneoversyn } from './36-loneoversyn.js';
import { jamforelseSattVal, jamforelseVal } from './42-jamforelse.js';
import { sattLonemanad } from './45-aid-bas-tabeller.js';
import { runOLSRegression } from './51-lika-arbete-regressionskort.js';
import { _readCostSettings } from './55-prioritering.js';
import { _hpDemoNycklar, _hpForKonfiguration, _hpValideraKonfiguration, renderHandlingsplanSeed } from './56-handlingsplan.js';
import { sattRapportUrval } from './58-rapportmodell.js';
import { _bes8Areas, bes8Uppdatera } from './61-regler-och-praxis.js';
import { byggArsbokslutNu, renderArsjamforelse } from './73-arsbokslut.js';

// ---- #17 Spara/ladda konfiguration som JSON ----
/** Sessionens egna importprofiler för konfigurationsfilen; inget fält alls när de saknas. */
function _konfigImportprofiler() {
    const egna = (state.importprofiler || []).filter(p => p.kalla === 'konfiguration')
        .map(p => ({ id: p.id, namn: p.namn, rubriker: p.rubriker, kannetecken: p.kannetecken }));
    return egna.length ? { importprofiler: egna } : {};
}

/**
 * Bygger ett serialiserbart snapshot av användarens konfiguration: prio-trösklar,
 * vikter, kostnadsinställningar och bristyrkes-AID:n.
 * Set-objekt konverteras till Array (JSON.stringify hanterar inte Set). Fälten har svenska namn från version 3; de
 * äldre namnen står bara i namnbytenas tabell i src/lib/konfiguration.js (ADR-96).
 * @returns {Object} JSON-säker konfigurationsstruktur.
 */
function buildConfigSnapshot() {
    return {
        version: konfigurationVersion(),
        sparad: new Date().toISOString(),
        prioTrosklar: {
            atgardTroskel: state.prioConfig.atgardThreshold, akutMinstN: state.prioConfig.akutMinN,
            bevakaTroskel: state.prioConfig.bevakaThreshold, analyseraTroskel: state.prioConfig.analyseraThreshold
        },
        prioVikter: { ...state.prioWeights },
        kostnad: { manader: state.costSettings.months, poPct: state.costSettings.poPct },
        kTroskel: kInstalld(),  // minsta gruppstorlek för redovisning (ADR-38); paketets låsningar (ADR-47) bärs inte
        rapportUrval: state.rapportUrval ? { ordning: [...state.rapportUrval.ordning], med: [...state.rapportUrval.med], ...(state.rapportUrval.fast ? { fast: state.rapportUrval.fast } : {}) } : null,
        rapportTabeller: (state.rapportTabeller || []).map(t => JSON.parse(JSON.stringify(t))),   // egna tabeller: recept, inga tal (ADR-52)
        perBasRecept: state.perBasRecept ? JSON.parse(JSON.stringify(state.perBasRecept)) : null,   // vilka avsnitt som följer med i rapporten
        forklaringsmodell: state.forklaringsmodell ? { ...state.forklaringsmodell } : null,   // regressionens variabler och skälet (ADR-56); null = standard
        gapUppdelning: state.gapUppdelning ? { variabler: [...state.gapUppdelning.variabler] } : null,   // uppdelningens variabler i ordning (ADR-65); null = standard
        // Bug-fix: Set-objekt serialiseras inte korrekt med spread/JSON
        bristAids: Array.from(state.bristAids || []),
        likvardighet: state.likvardighet ? {
            kvinnoTroskelPct: state.likvardighet.kvinnoTrosholdPct,
            kvDomDefinition: state.likvardighet.kvDomDefinition || 'do',
            jamforelse: state.likvardighet.jamforelse === 'mansdominerade' ? 'mansdominerade' : 'alla',
            minstaGapPct: state.likvardighet.minGapPct,
            antalPar: state.likvardighet.topN
        } : null,
        lonemanad: state.lonemanad || null,   // lönemånaden på bladen per AID och BAS
        forhandskontrollStopp: state.forhandskontrollStopp === true,   // stoppa och visa förhandskontrollen innan inläsning
        // Löneöversyn/prognos: bara inställningar (pott + fördelningsregler), ej utfall
        loneoversyn: state.forecast ? {
            budget:   { enhet: state.forecast.budget.mode, varde: state.forecast.budget.value },
            generell: { enhet: state.forecast.generell.mode, varde: state.forecast.generell.value },
            mal: (state.forecast.targets || []).map(t => ({ bas: t.bas, aid: t.aid, enhet: t.mode, varde: t.value, fordelning: t.dist,
                malniva: t.targetLevel, pott: t.pool, ...(t.kalla ? { kalla: t.kalla } : {}) })),
            minstaGruppN: state.forecast.minGroupN,
            avrundning: state.forecast.roundStep,
            ar: state.forecast.years
        } : null,
        // Egna importprofiler (src/lib/importprofiler.js): bara rubriknamn. Organisationspaketets följer paketet och bärs inte.
        // En tom lista skrivs inte, så att filen inte tömmer en annan sessions profiler (applyConfigSnapshot).
        ..._konfigImportprofiler(),
        // Organisationspaketet (ADR-28) bärs inte — bara vilket paket som användes, så att
        // den som läser in konfigurationen kan läsa in samma paket.
        organisationspaket: state.paket ? { organisation: state.paket.organisation, skapat: state.paket.skapat } : null,
        visning: {
            prioReferens:     /** @type {HTMLInputElement} */ (document.querySelector('input[name="prio-ref"]:checked'))?.value || null,
            prioEtiketter:    /** @type {HTMLInputElement} */ (document.getElementById('prio-label-mode'))?.value || null,
            konFargning:      /** @type {HTMLInputElement} */ (document.getElementById('kon-color-by'))?.value || null,
            organisationstyp: _skrDel(),   // organisationstypen styr SKR-referensen (ADR-34)
            jamforelse:       jamforelseVal()   // Jämförelsestatistik: källa, BAS-intervall, sektor
        },
        // HR:s manuella arbete (användarens egna inmatningar). Ingår i den
        // användarinitierade nedladdningen.
        // Innehåller INGA råa individrader; kan innehålla användarförfattad text
        // (avsedd på gruppnivå) och ska hanteras som övriga exportfiler.
        bes8: (typeof _bes8Areas === 'function' ? _bes8Areas() : [])
            .map(a => ({ n: a.n, status: a.status, anteckning: a.note })),
        // Handlingsplanens ifyllda fält per rad (sakligt skäl, ansvarig, tidsplan, status): användarförfattad text, som bes8.
        handlingsplan: (typeof _hpForKonfiguration === 'function' ? _hpForKonfiguration() : []),
        attGoraKlara: Array.from(state._actionChecklistDone || []),
        // Årsbokslutet (ADR-54): årets k-skyddade sammandrag, eller det inlästa när inget underlag finns.
        arsbokslut: (typeof byggArsbokslutNu === 'function' ? byggArsbokslutNu() : null) || state.forraArsbokslut || null,
        orgNamn: orgNamn(''),
        jmfNamn: jmfNamn(''),
        strukturNarrativ: (() => {
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
 * @param {Object} cfg - Snapshot från buildConfigSnapshot(), version 3, eller en äldre fil i version 2 (de gamla namnen
 *   byts mot de nya före valideringen, ADR-96).
 * @returns {{varningar: string[]}} Det i filen som inte tillämpades fast filen var giltig (en tröskel under
 *   organisationspaketets golv, ADR-47).
 * @throws {Error} Med beskrivande meddelande vid valideringsfel. State opåverkat.
 */
// En konfigurationsfil kan ändra nästan allt som visas: ingen ritad flik visas igen som den är efteråt (ADR-81).
function applyConfigSnapshot(cfg) { try { return _applyConfigSnapshot(cfg); } finally { visningNy(); } }
/**
 * @param {Object} cfg
 * @returns {{varningar: string[]}}
 */
function _applyConfigSnapshot(cfg) {
    // ---- FAS 1: Validera + bygg upp i isolerat temp-objekt ----
    if (!cfg || typeof cfg !== 'object')
        throw new Error('Konfigurationen är inte ett giltigt objekt.');
    const versionFel = konfigurationVersionFel(/** @type {any} */ (cfg).version);
    if (versionFel) throw new Error(versionFel);
    cfg = konfigurationMedNyaNamn(cfg);   // en äldre fils namn byts mot de nya; valideringen nedan känner bara de nya (ADR-96)

    const tmp = {};

    // prioTrosklar: numeriska tröskelvärden; filens namn → tillståndets (state.prioConfig)
    if (cfg.prioTrosklar != null) {
        if (typeof cfg.prioTrosklar !== 'object') throw new Error('prioTrosklar är inte ett objekt.');
        const pt = /** @type {any} */ ({ ...PRIO_CONFIG_DEFAULTS });
        [['atgardTroskel', 'atgardThreshold'], ['akutMinstN', 'akutMinN'], ['bevakaTroskel', 'bevakaThreshold'], ['analyseraTroskel', 'analyseraThreshold']].forEach(([f, k]) => {
            const v = cfg.prioTrosklar[f];
            if (v == null) return;
            if (typeof v !== 'number') throw new Error(`prioTrosklar.${f} måste vara ett nummer, fick ${typeof v}.`);
            if (!arInomGrans(v, installningsGrans('prioTroskel')[k]))
                throw new Error(`prioTrosklar.${f} måste vara ett tal mellan ${installningsGrans('prioTroskel')[k].min} och ${installningsGrans('prioTroskel')[k].max}.`);
            pt[k] = v;
        });
        tmp.prioConfig = pt;
    }
    // prioVikter: numeriska
    if (cfg.prioVikter != null) {
        if (typeof cfg.prioVikter !== 'object') throw new Error('prioVikter är inte ett objekt.');
        ['avvikelse', 'volym', 'jamstalldhet'].forEach(k => {
            if (cfg.prioVikter[k] != null && typeof cfg.prioVikter[k] !== 'number')
                throw new Error(`prioVikter.${k} måste vara ett nummer.`);
            if (cfg.prioVikter[k] != null && !arInomGrans(cfg.prioVikter[k], installningsGrans('prioVikt')[k]))
                throw new Error(`prioVikter.${k} måste vara ett tal mellan ${installningsGrans('prioVikt')[k].min} och ${installningsGrans('prioVikt')[k].max}.`);
        });
        tmp.prioWeights = { ...PRIO_WEIGHTS_DEFAULTS, ...cfg.prioVikter };
    }
    // kostnad: numeriska + gränser; filens manader är tillståndets months
    if (cfg.kostnad != null) {
        const ko = cfg.kostnad;
        if (typeof ko !== 'object') throw new Error('kostnad är inte ett objekt.');
        if (ko.poPct != null && !arInomGrans(ko.poPct, installningsGrans('poPct')))
            throw new Error(`kostnad.poPct måste vara ett tal mellan ${installningsGrans('poPct').min} och ${installningsGrans('poPct').max}.`);
        if (ko.manader != null && !arInomGrans(ko.manader, installningsGrans('manader')))
            throw new Error(`kostnad.manader måste vara ett tal mellan ${installningsGrans('manader').min} och ${installningsGrans('manader').max}.`);
        tmp.costSettings = { ...COST_DEFAULTS, ...(ko.manader != null ? { months: ko.manader } : {}), ...(ko.poPct != null ? { poPct: ko.poPct } : {}) };
    }
    // bristAids: array av strängar
    if (cfg.rapportUrval != null) {
        const u = cfg.rapportUrval;
        if (typeof u !== 'object' || !Array.isArray(u.ordning) || !Array.isArray(u.med) || ![...u.ordning, ...u.med].every(x => typeof x === 'string'))
            throw new Error('rapportUrval måste ha listorna ordning och med.');
        if (u.fast != null && typeof u.fast !== 'string') throw new Error('rapportUrval.fast måste vara en text.');
        tmp.rapportUrval = { ordning: u.ordning, med: u.med, ...(u.fast ? { fast: u.fast } : {}) };   // fast: ett färdigt urvals id; okänt id hoppas över
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
        // Fältet source i äldre filer läses aldrig och hoppas över.
        // Gränserna är fältens i Likvärdigt arbetes inställningar. Antalet par har ingen övre gräns: Visa alla sätter det
        // till hela listan, som kan vara längre än fältets 500. Den nedre är 1, inte fältets 10: en fil får kapa listan
        // kortare än fältet (testerna av den kapade listan i Löneöversyn läser in sådana filer).
        // Filens namn och tillståndets (state.likvardighet).
        /** @type {Array<[string, string, number, number, string]>} */
        const lvGranser = [
            ['kvinnoTroskelPct', 'kvinnoTrosholdPct', 50, 70, 'ett tal mellan 50 och 70'],
            ['minstaGapPct', 'minGapPct', 0, 50, 'ett tal mellan 0 och 50'],
            ['antalPar', 'topN', 1, Infinity, 'ett tal som är minst 1']
        ];
        for (const [f, k, min, max, text] of lvGranser) {
            const v = cfg.likvardighet[f];
            if (v != null) {
                if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`likvardighet.${f} måste vara ${text}.`);
                lv[k] = v;
            }
        }
        if (cfg.likvardighet.kvDomDefinition != null) {
            // Nycklarna 'do' (*Mer än X %*) och 'scb' (*X % eller mer*) är historiska och står kvar, så att sparade
            // konfigurationsfiler fortsätter att läsas (ADR-72).
            if (cfg.likvardighet.kvDomDefinition !== 'do' && cfg.likvardighet.kvDomDefinition !== 'scb')
                throw new Error('likvardighet.kvDomDefinition måste vara "do" eller "scb".');
            lv.kvDomDefinition = cfg.likvardighet.kvDomDefinition;
        }
        if (cfg.likvardighet.jamforelse != null) {
            if (cfg.likvardighet.jamforelse !== 'alla' && cfg.likvardighet.jamforelse !== 'mansdominerade')
                throw new Error('likvardighet.jamforelse måste vara "alla" eller "mansdominerade".');
            lv.jamforelse = cfg.likvardighet.jamforelse;
        }
        tmp.likvardighet = lv;
    }
    if (cfg.lonemanad != null) {
        if (typeof cfg.lonemanad !== 'string' || cfg.lonemanad.length > 40) throw new Error('lonemanad måste vara en text på högst 40 tecken.');
        tmp.lonemanad = cfg.lonemanad;
    }
    if (cfg.forhandskontrollStopp != null) {
        if (typeof cfg.forhandskontrollStopp !== 'boolean') throw new Error('forhandskontrollStopp måste vara true eller false.');
        tmp.forhandskontrollStopp = cfg.forhandskontrollStopp;
    }
    // loneoversyn: löneöversynsinställningar (inga råa rader); filens namn → tillståndets (state.forecast)
    if (cfg.loneoversyn != null) {
        const lo = cfg.loneoversyn;
        if (typeof lo !== 'object') throw new Error('loneoversyn måste vara ett objekt.');
        const fc = { budget: { mode: 'pct', value: null }, generell: { mode: 'pct', value: null }, targets: [], minGroupN: 10, roundStep: 0, years: 1, scenarios: { A: null, B: null }, result: null };
        if (lo.minstaGruppN != null) {
            if (typeof lo.minstaGruppN !== 'number' || lo.minstaGruppN < 0) throw new Error('loneoversyn.minstaGruppN måste vara ett icke-negativt tal.');
            fc.minGroupN = lo.minstaGruppN;
        }
        if (lo.avrundning != null) {
            if (typeof lo.avrundning !== 'number' || lo.avrundning < 0) throw new Error('loneoversyn.avrundning måste vara ett icke-negativt tal.');
            fc.roundStep = lo.avrundning;
        }
        if (lo.ar != null) {
            if (typeof lo.ar !== 'number' || lo.ar < 1 || lo.ar > 5) throw new Error('loneoversyn.ar måste vara 1–5.');
            fc.years = Math.round(lo.ar);
        }
        const valMode = (o, name) => {
            if (!o) return { mode: 'pct', value: null };
            if (o.enhet != null && o.enhet !== 'pct' && o.enhet !== 'kr') throw new Error(`loneoversyn.${name}.enhet måste vara "pct" eller "kr".`);
            if (o.varde != null && typeof o.varde !== 'number') throw new Error(`loneoversyn.${name}.varde måste vara ett nummer eller null.`);
            return { mode: o.enhet || 'pct', value: o.varde == null ? null : o.varde };
        };
        fc.budget = valMode(lo.budget, 'budget');
        fc.generell = valMode(lo.generell, 'generell');
        if (lo.mal != null) {
            if (!Array.isArray(lo.mal)) throw new Error('loneoversyn.mal måste vara en array.');
            fc.targets = lo.mal.filter(t => t && typeof t === 'object').map(t => ({
                bas: String(t.bas || ''), aid: String(t.aid || ''),
                mode: t.enhet === 'kr' ? 'kr' : 'pct',
                value: (t.varde == null || typeof t.varde !== 'number') ? null : t.varde,
                dist: ['flat', 'lowest', 'target'].includes(t.fordelning) ? t.fordelning : 'lowest',
                targetLevel: t.malniva === 'p25' ? 'p25' : 'median',
                pool: ['equity', 'marknad', 'befordran', 'övrigt'].includes(t.pott) ? t.pott : 'övrigt',
                // Valfritt och bakåtkompatibelt (filer utan fältet läses som förut): en rad verktyget själv
                // föreslog ur § 3:10-par bär kalla: 'par', prövas mot den inställda tröskeln när filen läses in
                // och rensas när tröskeln höjs (ADR-69); en rad utan fältet är användarens egen och står kvar
                // med noten om gruppen är under tröskeln (ADR-38, regel R2).
                ...(t.kalla === 'par' ? { kalla: 'par' } : {})
            }));
        }
        tmp.forecast = fc;
    }
    // visning: valfritt objekt
    if (cfg.visning != null && typeof cfg.visning !== 'object')
        throw new Error('visning måste vara ett objekt.');
    // organisationspaket: bara en påminnelse; värdena visas som text och vitlistas.
    if (cfg.organisationspaket && typeof cfg.organisationspaket === 'object') {
        const org = typeof cfg.organisationspaket.organisation === 'string' ? cfg.organisationspaket.organisation.substring(0, 200) : null;
        const skapat = typeof cfg.organisationspaket.skapat === 'string' ? cfg.organisationspaket.skapat.substring(0, 20) : null;
        if (org) tmp.organisationspaket = { organisation: org, skapat };
    }
    tmp.ui = cfg.visning || null;

    // HR:s manuella arbete. Saknas fälten hoppar vi över dem.
    if (cfg.bes8 != null) {
        if (!Array.isArray(cfg.bes8)) throw new Error('bes8 måste vara en array.');
        tmp.bes8 = cfg.bes8.map((a, i) => {
            if (!a || typeof a !== 'object') throw new Error(`bes8[${i}] är inte ett objekt.`);
            const n = Number(a.n);
            if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`bes8[${i}].n måste vara ett heltal 1–6.`);
            if (a.status != null && typeof a.status !== 'string') throw new Error(`bes8[${i}].status måste vara en sträng.`);
            if (a.anteckning != null && typeof a.anteckning !== 'string') throw new Error(`bes8[${i}].anteckning måste vara en sträng.`);
            return { n, status: a.status || '', note: a.anteckning || '' };
        });
    }
    // Sakliga skäl som inte går att läsa faller bort med en varning (läggs till varningarna nedan).
    tmp.hpVarningar = [];
    if (cfg.handlingsplan != null) tmp.handlingsplan = _hpValideraKonfiguration(cfg.handlingsplan, tmp.hpVarningar);
    if (cfg.attGoraKlara != null) {
        if (!Array.isArray(cfg.attGoraKlara)) throw new Error('attGoraKlara måste vara en array.');
        if (!cfg.attGoraKlara.every(id => typeof id === 'string')) throw new Error('attGoraKlara får endast innehålla strängar.');
        tmp.actionChecklistDone = cfg.attGoraKlara.slice();
    }
    if (cfg.orgNamn != null) {
        if (typeof cfg.orgNamn !== 'string') throw new Error('orgNamn måste vara en sträng.');
        if (cfg.orgNamn.length > 200) throw new Error('orgNamn är för långt (max 200 tecken).');
        tmp.orgName = cfg.orgNamn;
    }
    if (cfg.jmfNamn != null) {
        if (typeof cfg.jmfNamn !== 'string') throw new Error('jmfNamn måste vara en sträng.');
        if (cfg.jmfNamn.length > 200) throw new Error('jmfNamn är för långt (max 200 tecken).');
        tmp.jmfNamn = cfg.jmfNamn;
    }
    // Minsta gruppstorlek (ADR-38). En fil utan fältet lämnar gällande värde orört, som ett
    // organisationspaket utan fältet: den ska inte tyst sänka ett strängare värde till standard.
    if (cfg.kTroskel != null) {
        if (typeof cfg.kTroskel !== 'number' || kTolka(cfg.kTroskel) == null)
            throw new Error(`kTroskel måste vara ett heltal mellan ${K_MIN} och ${K_MAX}.`);
        tmp.kTroskel = cfg.kTroskel;
    }
    if (cfg.strukturNarrativ != null) {
        if (typeof cfg.strukturNarrativ !== 'string') throw new Error('strukturNarrativ måste vara en sträng eller null.');
        tmp.strukturNarrative = cfg.strukturNarrativ;
    }

    // ---- FAS 2: Atomär applicering — state nu garanterat reparerbart ----
    if (tmp.prioConfig)        state.prioConfig       = tmp.prioConfig;
    if (tmp.prioWeights)       state.prioWeights      = tmp.prioWeights;
    if (tmp.costSettings)      state.costSettings     = tmp.costSettings;
    // Frågar vid sänkning under standard; nekad bekräftelse behåller värdet och resten läses in.
    // Omritningen görs en gång, sist (se nedan), eftersom mer än tröskeln ändras här.
    const varningar = [...tmp.hpVarningar];
    if (cfg.rapportTabeller != null) {
        if (!Array.isArray(cfg.rapportTabeller)) throw new Error('rapportTabeller måste vara en array.');
        const giltiga = cfg.rapportTabeller.map(t => valideraRecept(t)).filter(Boolean);
        if (giltiga.length < cfg.rapportTabeller.length) varningar.push(`${cfg.rapportTabeller.length - giltiga.length} egna tabeller i filen gick inte att läsa och hoppas över.`);
        tmp.rapportTabeller = giltiga;
    }
    if (cfg.arsbokslut != null) {
        const a = typeof valideraArsbokslut === 'function' ? valideraArsbokslut(cfg.arsbokslut) : null;
        if (!a) varningar.push('Filens årsbokslut gick inte att läsa och hoppas över.');
        else tmp.arsbokslut = a;
    }
    // Importprofilerna valideras som i ett organisationspaket (bara rubriknamn); en ogiltig profil hoppas över med en
    // varning, som årsbokslutet. Utan fältet står sessionens egna profiler kvar.
    if (cfg.importprofiler != null) {
        const ip = valideraImportprofiler(cfg.importprofiler, { kalla: 'konfiguration' });
        if (ip.fel) varningar.push(`Filens importprofiler läses inte in: ${ip.fel}`);
        else {
            if (ip.bort) varningar.push(`${ip.bort} ${ip.bort === 1 ? 'importprofil' : 'importprofiler'} i filen gick inte att läsa och hoppas över.`);
            tmp.importprofiler = ip.profiler;
        }
    }
    if (cfg.perBasRecept != null) {
        if (typeof cfg.perBasRecept !== 'object') throw new Error('perBasRecept måste vara ett objekt.');
        tmp.perBasRecept = valideraPerBasRecept(cfg.perBasRecept);
    }
    // Förklaringsmodellen (ADR-56): ett ogiltigt värde ger standard med varning, aldrig fel; utan fältet gäller standard.
    // Utan inläst lönefil prövas inte yrkesgrupp mot datat (det görs av forklaringsmodell() när filen finns).
    const rader = getData();
    const fm = normaliseraForklaringsmodell(cfg.forklaringsmodell, { harYrke: !rader.length || rader.some(d => d.aid || d.yrke) });
    varningar.push(...fm.varningar);
    // Uppdelningens variabler (ADR-65): samma mönster. En äldre fil utan fältet ger standard (BAS, AID); ett ogiltigt
    // värde ger standard med varning, aldrig fel. Åldersgrupp prövas inte mot datat här (det görs av gapVariabler()).
    const guRa = cfg.gapUppdelning;
    const gu = normaliseraGapVariabler(guRa == null ? null : (typeof guRa === 'object' && !Array.isArray(guRa) ? (guRa.variabler ?? null) : guRa));
    varningar.push(...gu.varningar);
    let kAndrad = false;
    if (tmp.kTroskel != null) {
        const kr = sattKTroskel(tmp.kTroskel, { rita: false });
        kAndrad = kr.andrad === true;
        // Under organisationspaketets golv (ADR-47): värdet avvisas som från fältet, resten av filen läses in.
        if (!kr.ok && kr.fel) { varningar.push(`Filens minsta gruppstorlek ${tmp.kTroskel} används inte: ${kr.fel}`); if (typeof _kVisaFel === 'function') _kVisaFel(kr.fel); }
    }
    state.bristAids        = tmp.bristAids || new Set();
    sattRapportUrval(tmp.rapportUrval || null);   // okända avsnitt i filen hoppas över; utan fältet gäller hela dokumentationen
    if (tmp.rapportTabeller) state.rapportTabeller = tmp.rapportTabeller;
    if (tmp.perBasRecept) state.perBasRecept = perBasReceptArStandard(tmp.perBasRecept) ? null : tmp.perBasRecept;
    state.forklaringsmodell = forklaringsmodellArStandard(fm.modell) ? null : fm.modell;
    state.gapUppdelning = gapVariablerArStandard(gu.variabler) ? null : { variabler: gu.variabler };
    if (tmp.lonemanad != null && typeof sattLonemanad === 'function') sattLonemanad(tmp.lonemanad);
    if (tmp.forhandskontrollStopp != null) state.forhandskontrollStopp = tmp.forhandskontrollStopp;
    if (tmp.likvardighet) {
        state.likvardighet = { ...state.likvardighet, ...tmp.likvardighet, result: null };
    }
    if (tmp.forecast) {
        state.forecast = /** @type {any} */ (tmp.forecast);
        // Rader som verktyget föreslog ur par (kalla: 'par') prövas mot den inställda tröskeln, också på skärmen — filen
        // kan vara sparad vid en lägre — som när tröskeln höjs i gränssnittet (ADR-69). Utan lönefil prövas de när den läses in.
        if (typeof _fcRensaParMal === 'function') _fcRensaParMal();
        if (typeof ritaLoneoversyn === 'function' && document.getElementById('view-loneoversyn')) {
            try { ritaLoneoversyn(); } catch (_e) { /* renderas vid nästa flikbyte */ }
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
    // Handlingsplanens fält ersätts bara när filen bär dem; rader som inte finns i underlaget nu ligger kvar i minnet.
    // Demots nycklar glöms: filens skäl är användarens, också på en nyckel där demot skrev skäl.
    if (tmp.handlingsplan) { state.handlingsplan = tmp.handlingsplan; if (typeof _hpDemoNycklar !== 'undefined') _hpDemoNycklar.clear(); if (typeof renderHandlingsplanSeed === 'function') renderHandlingsplanSeed(); }
    if (tmp.actionChecklistDone) state._actionChecklistDone = new Set(tmp.actionChecklistDone);
    // Filens egna profiler ersätter sessionens egna; organisationspaketets står kvar.
    // Bara en fil med profiler ersätter sessionens egna: en äldre fil (eller en tom lista) tar inte bort dem tyst.
    if (tmp.importprofiler && tmp.importprofiler.length) state.importprofiler = [...(state.importprofiler || []).filter(p => p.kalla !== 'konfiguration'), ...tmp.importprofiler];
    if (tmp.arsbokslut) { state.forraArsbokslut = tmp.arsbokslut; if (typeof renderArsjamforelse === 'function') medExportLage(() => renderArsjamforelse()); }
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
            const map = { 'prio-label-mode':'prioEtiketter','kon-color-by':'konFargning' };
            const val = tmp.ui[map[id]];
            if (el && val != null) /** @type {HTMLInputElement} */ (el).value = val;
        });
        // Vitlista (värdet kommer ur filen).
        const prioRef = tmp.ui.prioReferens;
        if (prioRef === 'stallningstagande' || prioRef === 'statistik') {
            const r = document.querySelector(`input[name="prio-ref"][value="${prioRef}"]`);
            if (r) /** @type {HTMLInputElement} */ (r).checked = true;
        }
        sattOrgTyp(tmp.ui.organisationstyp);   // vitlistas i sattOrgTyp
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

// ---- #18 A/B-jämförelse via snapshot ----
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
export function buildAnalysisSnapshot(...a) { return medExportLage(() => _buildAnalysisSnapshotExport.apply(null, /** @type {any} */ (a))); }
function _buildAnalysisSnapshotExport() {
    const d = getData();
    if (!d.length) return null;
    // Könsuppdelade medianer och det råa gapet sparas bara när varje kön når tröskeln (ADR-12);
    // bilden visas i jämförelsetabellen och kan ligga kvar efter att urvalet ändrats.
    const m = ogonblicksbildMatt(d, kTroskel());
    const reg = runOLSRegression();
    const dq = bedomningUnderlag();
    return {
        timestamp: new Date().toISOString(),
        label: 'Hela organisationen',
        n: m.n,
        nKv: m.nKv,
        nMa: m.nMa,
        medianKv: m.medianKv,
        medianMa: m.medianMa,
        rawGapPct: m.rawGapPct,
        unexplainedGapPct: reg.error ? null : reg.konPct,
        unexplainedPValue: reg.error ? null : reg.pValue,
        underlag: dq ? UK_ETIKETT[dq.status] : null,
        avgAge: m.avgAge,
        nBas: getBasIntervals().length
    };
}

export function renderSnapshotComparison() {
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
        ['Oförklarad löneskillnad (regressionen, %)', snap.unexplainedGapPct,                 cur.unexplainedGapPct,            v => svPct(v, 1)],
        ['Underlagets kvalitet',       snap.underlag,                          cur.underlag,                     v => v],
        ['Genomsnittsålder',           snap.avgAge,                            cur.avgAge,                       v => svTal(v, 1) + ' år'],
        [`Antal ${T.niva.fl}`,        snap.nBas,                              cur.nBas,                         fmt]
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

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartKonfiguration() {
    document.getElementById('btn-config-save')?.addEventListener('click', () => {
        const cfg = buildConfigSnapshot();
        const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lonekartlaggning_config_${idagDatum()}.json`;
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
        const status = document.getElementById('config-status');
        // Storleken prövas innan filen läses: en för stor fil tolkas inte alls.
        const storlekFel = filStorlekFel(file.size, 'konfiguration');
        if (storlekFel) {
            if (status) { status.textContent = storlekFel; status.style.color = 'var(--danger)'; }
            /** @type {HTMLInputElement} */ (e.target).value = '';
            return;
        }
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
    document.getElementById('btn-snapshot-save')?.addEventListener('click', () => {
        const snap = buildAnalysisSnapshot();
        if (!snap) { alert('Läs in lönefilen först.'); return; }
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
}
