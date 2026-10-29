// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Genererar src/app/09-lib-speglar.js från de rena kärnmodulerna i src/lib/.
//
// BAKGRUND (ADR-8): app.js måste innehålla den statistiska kärnan
// (stat/forecast/structure/rng/lonepolitik) eftersom webbläsarbygget skeppar app.js, inte
// src/lib/. src/lib/ är enda källa: varje modul inlinas VERBATIM i en
// IIFE (endast `export` strippas — funktionskropparna rörs aldrig) och de namn
// som app.js anropar exponeras som const-alias med oförändrade speglingsnamn
// (_fitOLS, _fcComputePott, _stMedianGapPct, _rngFor, _lpBandPosition …).
//
// Eftersom kropparna inlinas oförändrade kan spegel och lib inte glida isär.
// tests/drift.test.js vaktar att den incheckade 09-lib-speglar.js är i synk med
// src/lib/ (kör generatorn och jämför), och tests/exports.golden.test.js vaktar
// att exporterna är oförändrade (facit byte för byte).
//
// Körs av tools/build-app.mjs före hopslagningen, så varje byggväg (npm run
// build:app och npm run bundle) regenererar filen.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const libDir = join(root, 'src', 'lib');
const outFile = join(root, 'src', 'app', '09-lib-speglar.js');

// Per lib-modul: { internt namn i lib  →  app-globalt spegelnamn }.
// Privata hjälpare som app.js anropar direkt (_fcMedian m.fl.) listas explicit.
// Endast namnen app.js faktiskt använder exponeras; övriga lib-exporter inlinas
// men aliasas inte (oanvända men ofarliga inuti closuren). Värdet null: namnet
// returneras ur modulen för att en senare lib-modul importerar det, men appen får
// inget alias.
export const MODULES = [
    {
        file: 'stat.js', ns: '__mirrorStat',
        expose: {
            tQuantile: '_tQuantile', pValue2Sided: '_pValue2Sided', fitOLS: '_fitOLS', quantile: '_libQuantile',
            // returneras för att andra lib-moduler importerar dem (se _parseImports); appen använder dem inte
            matMul: null, invert: null, median: null
        }
    },
    {
        file: 'loneoversyn.js', ns: '__mirrorForecast',
        expose: {
            computePott: '_fcComputePott', allocate: '_fcAllocate', suggestTargets: '_fcSuggestTargets', closureTargets: '_fcClosureTargets',
            stagedPlan: '_fcStagedPlan', summarizeGroups: '_fcSummarizeGroups', detectLeapfrog: '_fcDetectLeapfrog',
            forecastOutcome: '_fcForecastOutcome', bandStats: '_fcBandStats',
            individualRemediation: '_fcIndividualRemediation', marketTargets: '_fcMarketTargets',
            sensitivityCurve: '_fcSensitivityCurve',
            // privata hjälpare som app.js anropar direkt:
            _median: '_fcMedian'
        }
    },
    {
        file: 'struktur.js', ns: '__mirrorStructure',
        expose: {
            medianGapPct: '_stMedianGapPct', representationByBas: '_stRepresentationByBas',
            quartileDistribution: '_stQuartileDistribution', distributionalGap: '_stDistributionalGap',
            tillDirektivtecken: '_stTillDirektivtecken'
        }
    },
    {
        file: 'rng.js', ns: '__mirrorRng',
        expose: { hashSeed: '_rngHashSeed', seedFromNumbers: '_rngSeedFrom', rngFor: '_rngFor' }
    },
    {
        file: 'likvardighet.js', ns: '__mirrorLikvardighet',
        expose: { computeLikvardighetPairs: '_lvComputePairs', basRangFn: '_lvBasRangFn' }
    },
    {
        // Regressionsmodellerna (ADR-46-regressionen m.fl.) — importerar stat.js och likvardighet.js
        file: 'regression.js', ns: '__mirrorRegression',
        expose: {
            diagnoseCollinearity: '_rgDiagnoseCollinearity', computePerBasGap: '_rgComputePerBasGap',
            basIndikatorer: '_rgBasIndikatorer', computeSequentialGap: '_rgComputeSequentialGap',
            quantileRegression: '_rgQuantileRegression',
            blinderOaxaca: '_rgBlinderOaxaca', quantileRegressionAtAllTau: '_rgQuantileRegressionAtAllTau'
        }
    },
    {
        file: 'lonepolitik.js', ns: '__mirrorLonepolitik',
        expose: {
            bandPosition: '_lpBandPosition', groupBandStats: '_lpGroupBandStats',
            complianceCounts: '_lpComplianceCounts', genderBandGap: '_lpGenderBandGap',
            costToFloor: '_lpCostToFloor', policyCoverage: '_lpPolicyCoverage', organisationsBand: '_lpOrganisationsBand'
        }
    },
    {
        // Prioriteringsanalysen (ren modell; referensen kommer in som funktion från adaptern)
        file: 'prioritering.js', ns: '__mirrorPrioritering',
        expose: { prioritera: '_prPrioritera', arsbeloppMening: '_prArsbeloppMening' }
    },
    {
        // Livscykelmodellen (log-lön med kön×ålder och BAS-indikatorer); importerar stat.js
        file: 'livscykel.js', ns: '__mirrorLivscykel',
        expose: { livscykelRegression: '_lcLivscykelRegression' }
    },
    {
        // Organisationsfilen: verktyget med organisationspaketet inbakat (ren strängmodul)
        file: 'organisationsfil.js', ns: '__mirrorOrganisationsfil',
        expose: { bakaIn: '_ofBakaIn', filnamnForslag: '_ofFilnamnForslag', normaliseraFilnamn: '_ofNormaliseraFilnamn' }
    },
    {
        file: 'aid-etiketter.js', ns: '__mirrorAidEtiketter',
        expose: { aidEtikettlista: null }
    },
    {
        file: 'aid.js', ns: '__mirrorAid',
        expose: {
            normaliseraAid: null, huvudomrade: null, sektorsnamn: '_aidSektorsnamn', mellannivaEtikett: null, etikett: null,
            arRestkod: null, arLedningsetikett: null,
            jamforSektor: '_aidJamforSektor', etikettlistaInfo: '_aidEtikettlistaInfo'
        }
    },
    {
        file: 'namn.js', ns: '__mirrorNamn',
        expose: { namnGenitiv: '_namnGenitiv', normaliseraNamn: '_namnNormalisera' }
    },
    {
        file: 'skr-personal.js', ns: '__mirrorSkrPersonal',
        expose: { skrPersonalstatistik: null }
    },
    {
        file: 'skrreferens.js', ns: '__mirrorSkrReferens',
        expose: { skrKvinnoandel: '_skrKvinnoandel', skrKvinnoandelPrefix: '_skrKvinnoandelPrefix',
                  skrKvinnoandelSektor: null, skrReferensInfo: '_skrReferensInfo', skrDelText: '_skrDelText' }
    },
    {
        file: 'falt.js', ns: '__mirrorFalt',
        expose: { groupKey: '_utGroupKey', konOf: '_utKonOf', jamforAldersgrupp: '_faltJamforAlder', jamforLonespann: null }
    },
    {
        file: 'urval.js', ns: '__mirrorUrval',
        expose: {
            villkorAktivt: '_urVillkorAktivt', personFilter: '_urPersonFilter',
            gruppVillkorAktivt: '_urGruppVillkorAktivt', uppfyllerGrupp: null,
            beskrivUrval: '_urBeskrivUrval', faltInfo: '_urFaltInfo', gruppMattInfo: '_urGruppMattInfo'
        }
    },
    {
        file: 'referens.js', ns: '__mirrorReferens',
        expose: { namnFranFil: '_refNamnFranFil' }
    },
    {
        file: 'datakvalitet.js', ns: '__mirrorDatakvalitet',
        expose: { jamforbaraBas: '_dqJamforbaraBas', mdeFranSe: '_dqMdeFranSe', bedomUnderlag: '_dqBedomUnderlag' }
    },
    {
        file: 'rapportunderlag.js', ns: '__mirrorRapportunderlag',
        expose: {
            likaArbeteGrupper: '_ruLikaArbeteGrupper', justeratGapInomYrke: '_ruJusteratGap',
            gruppBlock: '_ruGruppBlock', parBlock: '_ruParBlock', avsnittBlock: '_ruAvsnittBlock',
            tillWordHtml: '_ruTillWordHtml', tillText: '_ruTillText', stabilitetKort: '_ruStabilitetKort'
        }
    },
    {
        file: 'gapuppdelning.js', ns: '__mirrorGapuppdelning',
        expose: { gapUppdelning: '_guGapUppdelning' }
    },
    {
        file: 'individflaggor.js', ns: '__mirrorIndivid',
        expose: { flaggaIndivider: '_ifFlaggaIndivider' }
    },
    {
        file: 'utforska.js', ns: '__mirrorUtforska',
        expose: {
            computePivot: '_utComputePivot'
        }
    },
    {
        file: 'organisationspaket.js', ns: '__mirrorOrganisationspaket',
        expose: { byggPaket: '_opByggPaket', tolkaPaket: '_opTolkaPaket', liknarPersonuppgift: '_opLiknarPersonuppgift' }
    },
    {
        file: 'attgora.js', ns: '__mirrorAttgora',
        expose: { borjaHar: '_agBorjaHar', hanterade: '_agHanterade',
                  stegLikaArbete: '_agStegLikaArbete', stegLikvardigt: '_agStegLikvardigt' }
    },
    {
        file: 'sektor.js', ns: '__mirrorSektor',
        expose: { sektorsTabell: '_skSektorsTabell', sektorernasAndel: '_skSektorernasAndel' }
    },
    {
        file: 'ansvar.js', ns: '__mirrorAnsvar',
        expose: { tolkaAnsvarskod: '_anTolka', ansvarsgrupp: '_anGrupp', andelGiltiga: '_anAndelGiltiga', arAnsvarskodRubrik: '_anArRubrik',
                  ansvarsUnderrader: '_anUnderrader' }
    },
    {
        file: 'aidkontroll.js', ns: '__mirrorAidkontroll',
        expose: { aidKriterier: '_akAidKriterier' }
    },
    {
        file: 'jamforelse.js', ns: '__mirrorJamforelse',
        expose: { jamforelseRader: '_jfRader', avvikelseRangordning: '_jfRangordning' }
    },
    {
        file: 'docx.js', ns: '__mirrorDocx',
        expose: { docxDelar: '_docxDelar' }
    },
    {
        file: 'figur.js', ns: '__mirrorFigur',
        expose: { talformat: '_figTalformat', valideraFigur: '_figValidera', utanSmaGrupper: '_figUtanSma',
                  skalDoman: '_figSkalDoman', ladstatistik: '_figLadstatistik', antalPunkter: '_figAntalPunkter',
                  figurTillTabell: '_figTillTabell', panelerMedLager: '_figPanelerMedLager',
                  kronorSkillnad: '_figKronorSkillnad', kronorTipsRad: '_figKronorTipsRad',
                  kvantilpunkter: '_figKvantilpunkter' }
    }
];

// Plockar ut lib-interna imports (`import { median as _median } from './stat.js';`)
// och översätter dem till alias mot den redan inlinade modulens IIFE-namespace.
// Importer stryks ur källan och ersätts av `const _median = __mirrorStat.median;`
// INUTI den importerande modulens IIFE — alltså inget nytt globalt namn.
//
// Måste hantera detta eftersom lib-moduler bygger på varandra
// (likvardighet.js använder stat.median och rng.rngFor). Utan stödet hamnar en
// `import`-sats i ett classic script och hela bygget faller.
function _parseImports(src, modIndex, självFil) {
    const rx = /^import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.-]+)['"];?\s*$/gm;
    const alias = [];
    let m;
    while ((m = rx.exec(src)) !== null) {
        const fil = m[2];
        const mål = modIndex.get(fil);
        if (!mål) {
            throw new Error(`gen-mirrors: ${självFil} importerar ./${fil}, som inte speglas. `
                + 'Lägg till modulen i MODULES (före den importerande modulen).');
        }
        if (mål.ordning >= modIndex.get(självFil).ordning) {
            throw new Error(`gen-mirrors: ${självFil} importerar ./${fil}, som kommer senare i `
                + 'MODULES. Flytta den importerade modulen före.');
        }
        for (const bit of m[1].split(',')) {
            const t = bit.trim();
            if (!t) continue;
            const mm = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(t);
            if (!mm) throw new Error(`gen-mirrors: kan inte tolka importen "${t}" i ${självFil}.`);
            const exportNamn = mm[1], lokaltNamn = mm[2] || mm[1];
            if (!Object.prototype.hasOwnProperty.call(mål.expose, exportNamn)) {
                throw new Error(`gen-mirrors: ${självFil} importerar ${exportNamn} ur ./${fil}, `
                    + 'men den exponeras inte i den modulens expose-lista.');
            }
            alias.push(`    const ${lokaltNamn} = ${mål.ns}.${exportNamn};`);
        }
    }
    return { alias, src: src.replace(rx, '') };
}

// Tar bort `export ` framför deklarationer + ev. `export { … }` / `export default`.
// src/lib/-modulerna använder i praktiken bara `export function`; resten är defensivt.
function stripExports(src) {
    return src
        .replace(/^﻿/, '')
        .replace(/^export\s+default\s+/gm, '')
        .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
        .replace(/^export\s+(?=(async\s+)?function\b|const\b|let\b|var\b|class\b)/gm, '');
}

function buildModuleBlock(mod, modIndex) {
    const raw = readFileSync(join(libDir, mod.file), 'utf8');
    const { alias, src } = _parseImports(raw, modIndex, mod.file);
    const body = stripExports(src).replace(/\s+$/, '');
    const returned = Object.keys(mod.expose);
    const out = [];
    out.push(`// ---- speglar src/lib/${mod.file} ----`);
    out.push(`const ${mod.ns} = (() => {`);
    if (alias.length) {
        out.push('    // importer ur tidigare speglade lib-moduler');
        out.push(...alias);
        out.push('');
    }
    out.push(body);
    out.push('');
    out.push(`    return { ${returned.join(', ')} };`);
    out.push(`})();`);
    for (const [internal, appName] of Object.entries(mod.expose)) {
        if (appName) out.push(`const ${appName} = ${mod.ns}.${internal};`);
    }
    return out.join('\n');
}

export function generateMirrorsSource() {
    const header = [
        '// ====================================================================',
        '// AUTO-GENERERAD FIL — RÖR INTE.',
        '//',
        '// Speglar de rena kärnmodulerna i src/lib/ (stat, forecast, structure, rng,',
        '// likvardighet, lonepolitik, falt, urval, utforska, chartdata)',
        '// för webbläsarbygget. Varje modul inlinas verbatim i en IIFE (endast',
        '// `export` strippas) och de namn app.js anropar exponeras som const-alias.',
        '// src/lib/ är enda källa — ändra där och kör `npm run build:app` (eller',
        '// npm run bundle). Genererad av tools/gen-mirrors.mjs; vaktas av',
        '// tests/drift.test.js.',
        '// ====================================================================',
        '/* eslint-disable */',
        ''
    ].join('\n');
    const modIndex = new Map(MODULES.map((m, i) => [m.file, { ...m, ordning: i }]));
    const blocks = MODULES.map(m => buildModuleBlock(m, modIndex)).join('\n\n');
    return header + blocks + '\n/* eslint-enable */\n';
}

export function writeMirrors() {
    const text = generateMirrorsSource();
    writeFileSync(outFile, text);
    return text;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    writeMirrors();
    console.log('gen-mirrors: skrev src/app/09-lib-speglar.js');
}
