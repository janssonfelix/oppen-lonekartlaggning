// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för fliken Löneöversyn (ADR-99): det som fliken räknar och bedömer utöver
 * modellen själv (prognosutfall och de andra funktionerna i loneoversyn.js). Utfallet med kontrollerna, lönespannet per
 * BAS-intervall efter k, kostnaden per pott, utfallets rader per grupp med maskeringen under k och den samlade raden,
 * andelen till kvinnodominerade grupper, grupperna som går om varandra, den stegvisa planen, riktningen före och efter,
 * grupperna före och efter i diagrammet, förslagens kandidatpar och prövningen av föreslagna rader (regel R2),
 * scenarierna A/B (regel R4), tröskelmålet (regel R5), känsligheten och kostnaden på individnivå (I1). Tröskeln,
 * inställningarna och raderna är argument; ritfunktionerna i src/app/36-loneoversyn.js ritar bara det de får och
 * skriver orden.
 *
 * Den oförklarade skillnaden före och efter räknas med huvudregression (regression.js) på de rader som ges, med
 * appens regressionsval som argument, varje gång den efterfrågas: inget minns (ADR-17).
 */
import { namnrader } from './aid.js';
import { arKvinna, arMan } from './kon.js';
import { konAntal, konFarRedovisas, konFarRedovisasFor, parForRedovisning, parNarK } from './ktroskel.js';
import { arKvinnodominerad } from './likvardighet.js';
import { beraknaPott, fordela, foreslaRiktning, hittaOmkorningar, individlyft, kanslighetskurva, likalonslyftForMal, lonespannPerBas,
    prognosutfall, riktadeRader, sammanstallGrupper, stegvisPlan } from './loneoversyn.js';
import { konskvotPerGrupp } from './osakerhet.js';
import { huvudregression } from './regression.js';
import { avrundaSymmetriskt, median } from './stat.js';

/** Pottyperna som en riktad rad kan bära, i visningsordning. En rad utan känd typ räknas som 'övrigt'. */
export const POTTYPER = Object.freeze(['equity', 'marknad', 'befordran', 'övrigt']);
/** Läget mot BAS-medianen: gruppens nya median delad med intervallets median, över LAGE_OVER «över», under LAGE_UNDER «under». */
export const LAGE_OVER = 1.1, LAGE_UNDER = 0.9;
/** Diagrammet före och efter per yrkesgrupp visar högst så många grupper; tabellen bär alla. */
export const LUTNING_MAX = 15;
/** Kontrollernas gränser: en budget över BUDGET_MAX_PCT % av lönesumman och ett generellt påslag över GENERELL_MAX_PCT %. */
export const BUDGET_MAX_PCT = 50, GENERELL_MAX_PCT = 25;

/** Är en andel kvinnor (procent) kvinnodominerad med kostnadsvalets definition (samma som Likvärdigt arbete, ADR-60)? */
export function kvDomAv(kostnadsval) {
    const def = (kostnadsval && kostnadsval.kvDefinition) || 'do', grans = kostnadsval?.kvThreshold ?? undefined;
    return andelKv => arKvinnodominerad(andelKv, def, grans);
}

/**
 * Riktningen för ett mått före och efter, avgjord på talen som de visas (en decimal): −1 närmare målet, 1 längre ifrån,
 * 0 oförändrat, null när ett tal saknas. `mal` är värdet där skillnaden är borta: 0 för den oförklarade skillnaden, 100
 * för kvinnors median i procent av mäns.
 * @param {number|null|undefined} fore @param {number|null|undefined} efter @param {number} [mal]
 * @returns {-1|0|1|null}
 */
export function riktning(fore, efter, mal = 0) {
    if (typeof fore !== 'number' || typeof efter !== 'number' || !isFinite(fore) || !isFinite(efter)) return null;
    const avstand = v => Math.abs(avrundaSymmetriskt(v, 1) - mal);
    const a = avstand(fore), b = avstand(efter);
    return b < a ? -1 : b > a ? 1 : 0;
}

/** Riktningen för det råa gapet (kvinnors median i procent av mäns minus 100), mot 100 %. */
export function andelRiktning(fore, efter) {
    return fore == null || efter == null ? null : riktning(100 + fore, 100 + efter, 100);
}

/** Lönerna efter påslagen: raderna med den nya lönen ur utfallets fördelning. */
export function simuleradeRader(rader, utfall) {
    return rader.map((r, i) => ({ ...r, lon: utfall.alloc.perPerson[i].nyLon }));
}

/**
 * Den oförklarade skillnaden (huvudregressionens skillnad i procent) på de givna raderna, som en skattning för
 * tröskelmålet. `regval` är appens val för huvudregressionen (förklaringsmodell, ålder, tröskel och golv). Körs
 * varje gång och minns inget (ADR-17).
 * @param {any} regval
 * @returns {(rader: any[]) => {konPct: number|null, pValue: number|null}}
 */
export function oforklaradSkattning(regval) {
    return rader => {
        const r = huvudregression(rader, regval);
        return r && !r.error ? { konPct: r.konPct, pValue: r.pValue } : { konPct: null, pValue: null };
    };
}

/** Den oförklarade skillnaden före och efter: huvudregressionen på lönerna före och på de nya lönerna (ADR-17). */
export function oforklaratForeEfter(fore, efter, regval) {
    const skatta = oforklaradSkattning(regval);
    return { fore: skatta(fore).konPct, efter: skatta(efter).konPct };
}

/**
 * Kontrollerna före beräkningen, som nycklar: negativBudget, hogBudget, negativtGenerellt, hogtGenerellt, radUtanBelopp
 * (en riktad rad saknar belopp) och radUtanTraff (en riktad rad träffar ingen).
 * @param {any[]} rader @param {any} forecast state.forecast
 * @returns {string[]}
 */
export function kontrollvarningar(rader, forecast) {
    const ut = [], bv = forecast.budget.value, gv = forecast.generell.value;
    if (bv != null && bv < 0) ut.push('negativBudget');
    if (forecast.budget.mode === 'pct' && bv != null && bv > BUDGET_MAX_PCT) ut.push('hogBudget');
    if (gv != null && gv < 0) ut.push('negativtGenerellt');
    if (forecast.generell.mode === 'pct' && gv != null && gv > GENERELL_MAX_PCT) ut.push('hogtGenerellt');
    if (forecast.targets.some(t => t.value == null || !(t.value > 0))) ut.push('radUtanBelopp');
    if (forecast.targets.some(t => riktadeRader(rader, t).length === 0)) ut.push('radUtanTraff');
    return ut;
}

/**
 * En riktad rad för sig: vad den förbrukar av potten (räknad ensam, utan generellt påslag) och hur många den berör.
 * `upplysning` är 'ingen' när ingen träffas och 'underK' när färre än k berörs: en egen rad på en grupp under tröskeln
 * är tillåten (regel R2), och raden får en upplysning.
 * @param {any[]} rader @param {any} rad @param {{roundStep?: number, k: number}} val
 */
export function riktadRadInfo(rader, rad, { roundStep, k }) {
    let kostnad = 0;
    try { kostnad = fordela(rader, { mode: 'pct', value: 0 }, [rad], roundStep).totals.riktadCost; } catch (_e) { kostnad = 0; }
    const n = riktadeRader(rader, rad).length;
    return { kostnad, n, upplysning: n === 0 ? 'ingen' : n < k ? 'underK' : null };
}

/** Kostnaden per pott (kr/mån): varje riktad rad räknad för sig och lagd på sin pottyp; `potter` är typerna med mer än 0,5 kr. */
export function kostnadPerPott(rader, riktningar, roundStep) {
    /** @type {Record<string, number>} */
    const perPott = {};
    for (const t of riktningar) {
        let c = 0;
        try { c = fordela(rader, { mode: 'pct', value: 0 }, [t], roundStep).totals.riktadCost; } catch (_e) { c = 0; }
        const p = POTTYPER.includes(t.pool) ? t.pool : 'övrigt';
        perPott[p] = (perPott[p] || 0) + c;
    }
    return { perPott, potter: POTTYPER.filter(p => perPott[p] > 0.5) };
}

/** Läget mot BAS-medianen: kvoten (null utan median) och 'over', 'under' eller null. */
export function lageMotBas(nyMedian, basMedian) {
    const kvot = basMedian > 0 ? nyMedian / basMedian : null;
    return { kvot, lage: kvot == null ? null : kvot > LAGE_OVER ? 'over' : kvot < LAGE_UNDER ? 'under' : null };
}

/**
 * Utfallets rader per grupp, för tabellen och bladet Fördelning (ADR-70). En grupp under k har sin rad med antal och
 * andel kvinnor, men medianerna och kostnaden maskeras (`sma`). Kostnaden för de maskerade raderna står samlad på en
 * rad, så att radernas kostnader summerar till det använda. Den samlade kostnaden står bara när den omfattar minst k
 * personer; gör den inte det viks den minsta visade gruppens kostnad in, en grupp i taget (`invikta`; minst betyder
 * färst personer, vid lika antal först efter BAS och sedan AID), och dess medianer maskeras också. Når inte ens alla
 * grupper tillsammans k står ingen kostnad per grupp (`samlad.kostnad` är null). De visade raderna står först, i
 * kostnadsordning; de maskerade efter dem, i BAS- och AID-ordning. Vid k = 1 maskeras inget.
 * @param {any[]} rows grupperna med påslag, i kostnadsordning
 * @param {number} k
 */
export function utfallsrader(rows, k) {
    const ordning = (a, b) => String(a.bas).localeCompare(String(b.bas), 'sv') || String(a.aid).localeCompare(String(b.aid), 'sv');
    const antal = gs => gs.reduce((s, g) => s + g.n, 0);
    const sma = rows.filter(g => g.n < k);
    const invikta = [];
    if (sma.length) {
        const kandidater = rows.filter(g => g.n >= k).sort((a, b) => a.n - b.n || ordning(a, b));
        while (antal(sma) + antal(invikta) < k && kandidater.length) invikta.push(/** @type {any} */ (kandidater.shift()));
    }
    const maskerade = [...sma, ...invikta].sort(ordning);
    const n = antal(maskerade);
    return { visade: rows.filter(g => !maskerade.includes(g)), maskerade, sma, invikta,
        samlad: maskerade.length ? { antalGrupper: maskerade.length, n, kostnad: n >= k ? maskerade.reduce((s, g) => s + g.kostnad, 0) : null } : null };
}

/**
 * Hur mycket av påslaget som går till kvinnodominerade grupper, så som det får redovisas bredvid utfallets rader
 * (ADR-70). Talet står när de maskerade kvinnodominerade grupperna och de övriga maskerade var för sig är tomma eller
 * omfattar minst k personer, eller när den ena är tom; annars null (visas som –). Utan maskerade grupper är det
 * `equityCost`.
 * @param {ReturnType<typeof utfallsrader>} utfall @param {number} equityCost @param {number} k
 * @param {(andelKv: number) => boolean} arKvDom
 */
export function varavKvDom(utfall, equityCost, k, arKvDom) {
    if (!utfall.maskerade.length) return equityCost;
    const nKv = utfall.maskerade.filter(g => arKvDom(g.andelKv)).reduce((s, g) => s + g.n, 0), nOvr = /** @type {any} */ (utfall.samlad).n - nKv;
    return (nKv === 0 || nOvr === 0 || (nKv >= k && nOvr >= k)) ? equityCost : null;
}

/**
 * Utfallets grupper så som de redovisas, för fliken och exporten: grupperna med påslag i kostnadsordning (`rader`),
 * deras maskering (`utfall`, utfallsrader), andelen till kvinnodominerade grupper (`varavKvDom`) och grupperna som går
 * om en tidigare högre grupp (`omkorningar`: bara grupper som når k och inte är invikta).
 * @param {any} out prognosutfall @param {number} k @param {(andelKv: number) => boolean} arKvDom
 */
export function utfallsvy(out, k, arKvDom) {
    const rader = out.alloc.perGroup.filter(g => Math.abs(g.kostnad) > 0.5).sort((a, b) => b.kostnad - a.kostnad);
    const utfall = utfallsrader(rader, k);
    return { rader, utfall, varavKvDom: varavKvDom(utfall, out.equityCost, k, arKvDom),
        omkorningar: hittaOmkorningar(out.alloc.perGroup.filter(g => !(g.n < k) && !utfall.invikta.includes(g))) };
}

/**
 * Vymodellen för prognosen (utfallet under formuläret och nyckeltalen i flikens topp).
 * - `out`: prognosutfall; `sim`: lönerna efter påslagen; `varningar`: kontrollvarningar.
 * - `anvandPct` (högst 100) och `matare`: 'over' (över potten), 'nara' (över 95 %) eller 'ok'.
 * - `band`: lönespannet per BAS-intervall, de som visas (minst k) och de utelämnade (namnen).
 * - `potter`: kostnadPerPott.
 * - `rader`, `utfall`, `varavKvDom`, `omkorningar`: utfallsvy; `tabell`: utfallets rader i ordning med maskeringen
 *   (`maskerad`, `underK`) och läget mot BAS-medianen (`lage`, inte för en maskerad rad).
 * - `konOk`: båda könen når k i underlaget; `ra`: det råa gapet före och efter med riktning, null när ett kön är under k.
 * - `oforklarat`: huvudregressionens skillnad före och efter med riktning (null när den inte går att skatta).
 * - `plan`: den stegvisa planen när den har mer än ett år och något används; det råa gapet null när ett kön är under k.
 * - `andelAvPott`: varavKvDom i procent av potten; `tomt`: ingen pott och inga påslag.
 * @param {any[]} rader
 * @param {{forecast: any, kostnadsval: any, k: number, regval: any}} val forecast: state.forecast; kostnadsval:
 *   månader, PO, avrundning och definitionen av kvinnodominerat; regval: huvudregressionens val (ADR-17)
 */
export function vymodellPrognos(rader, { forecast, kostnadsval, k, regval }) {
    const out = prognosutfall(rader, forecast.budget, forecast.generell, forecast.targets, kostnadsval);
    const sim = simuleradeRader(rader, out);
    const ols = oforklaratForeEfter(rader, sim, regval);
    const anvandPct = out.pott > 0 ? Math.min(100, 100 * out.använt / out.pott) : 0;
    const spann = lonespannPerBas(rader);
    const basMedian = new Map(spann.map(b => [b.bas, b.median]));
    const vy = utfallsvy(out, k, kvDomAv(kostnadsval));
    const konOk = konFarRedovisasFor(rader, k);
    const ar = forecast.years || 1;
    return {
        out, sim, varningar: kontrollvarningar(rader, forecast),
        anvandPct, matare: out.overBudget ? 'over' : anvandPct > 95 ? 'nara' : 'ok',
        band: { alla: spann, visade: spann.filter(b => !(b.n < k)), utelamnade: spann.filter(b => b.n < k).map(b => b.bas) },
        potter: kostnadPerPott(rader, forecast.targets, forecast.roundStep),
        ...vy,
        tabell: [...vy.utfall.visade, ...vy.utfall.maskerade].map(g => {
            const maskerad = vy.utfall.maskerade.includes(g);
            return { g, maskerad, underK: g.n < k, lage: maskerad ? { kvot: null, lage: null } : lageMotBas(g.nyMedian, basMedian.get(g.bas) ?? null) };
        }),
        konOk,
        ra: konOk ? { fore: out.rawGapFore, efter: out.rawGapEfter, riktning: andelRiktning(out.rawGapFore, out.rawGapEfter) } : null,
        oforklarat: { fore: ols.fore, efter: ols.efter, riktning: riktning(ols.fore, ols.efter, 0) },
        plan: ar > 1 && out.använt > 0.5
            ? stegvisPlan(rader, out.alloc.perPerson, ar, kostnadsval).map(p => (konOk ? p : { ...p, rawGap: null })) : null,
        andelAvPott: out.pott > 0 && vy.varavKvDom != null ? 100 * vy.varavKvDom / out.pott : null,
        tomt: !(out.pott > 0) && !(out.använt > 0.5)
    };
}

/**
 * Kvinnors median i procent av mäns per BAS-intervall (`niva` 'bas') eller yrkesgrupp ('grupp'), före och efter
 * påslagen, bara där både kvinnorna och männen når k (konskvotPerGrupp, före och efter). `markering(bas, aid)` ger
 * radens markering (appen); `bas` och `yrke` är filtrens fält.
 * @param {any[]} rader @param {any[]} sim lönerna efter, i samma ordning @param {'bas'|'grupp'} niva
 * @param {{k: number, markering?: (bas: any, aid: any) => any}} val
 * @returns {Array<{namn: string, fore: number, efter: number, nKv: number, nMa: number, n: number, [f: string]: any}>}
 */
export function lutningRader(rader, sim, niva, { k, markering = () => undefined }) {
    const grupper = new Map();
    const nyckelAv = r => (niva === 'bas' ? String(r.bas) : `${r.aid}|${r.bas}`);
    // Yrkesgruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namnrad = namnrader(rader.filter((r, i) => (arKvinna(r) || arMan(r)) && sim[i]), nyckelAv);
    rader.forEach((r, i) => {
        const kv = arKvinna(r), ma = arMan(r);
        if (!(kv || ma) || !sim[i]) return;
        const nyckel = nyckelAv(r);
        let g = grupper.get(nyckel);
        if (!g) {
            const nr = namnrad.get(nyckel);
            g = { namn: niva === 'bas' ? `BAS ${r.bas}` : `${nr.yrkeLabel || nr.yrke || nr.aid} · ${r.bas}`,
                  ...(niva === 'bas' ? { bas: String(r.bas) } : { yrke: String(nr.yrkeLabel || nr.yrke || nr.aid) }),
                  markering: markering(r.bas, niva === 'bas' ? null : r.aid), kv: [[], []], ma: [[], []] };
            grupper.set(nyckel, g);
        }
        const h = kv ? g.kv : g.ma;
        h[0].push(r.lon); h[1].push(sim[i].lon);
    });
    const fore = konskvotPerGrupp([...grupper.values()].map(g => [g, g.kv[0], g.ma[0]]), { k }).visade;
    const efter = new Map(konskvotPerGrupp(fore.map(v => [v.nyckel, v.nyckel.kv[1], v.nyckel.ma[1]]), { k }).visade.map(v => [v.nyckel, v.gap]));
    return fore.filter(v => efter.has(v.nyckel))
        .map(({ nyckel: g, nKv, nMa, gap }) => ({ namn: g.namn, markering: g.markering, ...(g.bas != null ? { bas: g.bas } : { yrke: g.yrke }), nKv, nMa,
            n: nKv + nMa, fore: gap, efter: /** @type {number} */ (efter.get(g)) }));
}

/**
 * Raderna i diagrammet och tabellen före och efter. Per BAS-intervall alla; per yrkesgrupp bara de där gapet ändras på
 * en decimal, störst ändring först: tabellen bär alla, diagrammet högst LUTNING_MAX (`fler` är resten).
 * @param {any[]} rader lutningRader @param {'bas'|'grupp'} niva
 */
export function lutningUrval(rader, niva) {
    if (niva !== 'grupp') return { diagram: rader, tabell: rader, fler: 0 };
    const andrade = rader.filter(r => r.efter != null && r.fore != null && avrundaSymmetriskt(r.efter, 1) !== avrundaSymmetriskt(r.fore, 1))
        .sort((x, y) => Math.abs((y.efter ?? 0) - (y.fore ?? 0)) - Math.abs((x.efter ?? 0) - (x.fore ?? 0)));
    return { diagram: andrade.slice(0, LUTNING_MAX), tabell: andrade, fler: Math.max(0, andrade.length - LUTNING_MAX) };
}

/**
 * Förslagens kandidatpar (regel R2, ADR-69): bara par där båda grupperna når den inställda tröskeln `k`, också på
 * skärmen, som kandidater med den kvinnodominerade gruppen, skillnaden i kronor och storleken på paret; `not` är
 * meningen om de utelämnade.
 * @param {any[]} allaPar paren i likvärdigt arbete ur Likvärdigt arbete @param {number} k den inställda tröskeln
 */
export function forslagskandidater(allaPar, k) {
    const r = parForRedovisning(allaPar, k);
    return { kandidater: r.par.map(p => ({ bas: p.kvBas, aid: p.kvAid, gapKr: p.gapKr, n: p.kvN, maN: p.maN })), not: r.not };
}

/**
 * Förslaget ur potten: potten efter det generella påslaget fördelad på kandidaterna (foreslaRiktning), bara grupper med
 * minst `minN` personer.
 * @param {any[]} rader @param {{budget: any, generell: any, kandidater: any[], minN: number}} val
 */
export function forslagUrPotten(rader, { budget, generell, kandidater, minN }) {
    const riktadPott = Math.max(0, beraknaPott(rader, budget) - fordela(rader, generell, []).totals.generellCost);
    return foreslaRiktning(kandidater, riktadPott, minN);
}

/**
 * Grupperna (BAS och AID) som uppfyller ett villkor för en massregel, med minst `minN` personer: 'kvdom'
 * (kvinnodominerade), 'underbas' (medianen under BAS-intervallets median), 'underp25' (under intervallets P25) eller
 * alla.
 * @param {any[]} rader @param {{villkor: string, minN: number, arKvDom: (andelKv: number) => boolean}} val
 */
export function villkorsgrupper(rader, { villkor, minN, arKvDom }) {
    const basMed = new Map(), basP25 = new Map(lonespannPerBas(rader).map(b => [b.bas, b.p25]));
    const basMedian = bas => {
        if (!basMed.has(bas)) basMed.set(bas, median(rader.filter(r => r.bas === bas).map(r => r.lon)));
        return basMed.get(bas);
    };
    return sammanstallGrupper(rader).filter(g => {
        if (g.n < minN) return false;
        if (villkor === 'kvdom') return arKvDom(g.andelKv);
        if (villkor === 'underbas') return g.median < basMedian(g.bas);
        if (villkor === 'underp25') return g.median < basP25.get(g.bas);
        return true;
    });
}

/**
 * Prövar de riktade rader som verktyget föreslog ur par i likvärdigt arbete (`kalla: 'par'`) mot den inställda tröskeln `k`
 * (regel R2, ADR-69). En rad vars par finns i minnet (`ursprung(rad)`: storleken på grupperna) avgörs säkert; en rad
 * utan den uppgiften står kvar bara när parlistan är fullständig, yrket har par och alla når k. Rader som användaren
 * lagt till själv står kvar. Ett sparat scenario som räknades med en rad som inte står sig tas bort.
 * @param {{rader: any[], scenarioRader?: {A?: any[]|null, B?: any[]|null}, ursprung: (rad: any) => any, allaPar: any[],
 *   fullstandig: boolean, k: number}} val
 * @returns {{kvar: any[], sakert: number, forsiktigt: number, bortScenarier: string[]}} sakert: borttagna vars par har en
 *   grupp under k; forsiktigt: borttagna vars par inte går att avgöra; bortScenarier: 'A' och/eller 'B'
 */
export function rensaForeslagnaRader({ rader, scenarioRader = {}, ursprung, allaPar, fullstandig, k }) {
    /** @type {Map<string, any[]>} */
    const perYrke = new Map();
    for (const p of allaPar) {
        const nyckel = p.kvBas + '|' + p.kvAid;
        if (!perYrke.has(nyckel)) perYrke.set(nyckel, []);
        /** @type {any[]} */ (perYrke.get(nyckel)).push(p);
    }
    const prova = t => {
        if (t.kalla !== 'par') return 'ok';
        const u = ursprung(t);
        if (u) return parNarK(u, k) ? 'ok' : 'sakert';
        const par = perYrke.get(t.bas + '|' + t.aid) || [];
        return fullstandig && par.length && par.every(p => parNarK(p, k)) ? 'ok' : 'forsiktigt';
    };
    let sakert = 0, forsiktigt = 0;
    const kvar = rader.filter(t => {
        const svar = prova(t);
        if (svar === 'sakert') sakert++; else if (svar === 'forsiktigt') forsiktigt++;
        return svar === 'ok';
    });
    const bortScenarier = ['A', 'B'].filter(slot => (scenarioRader[slot] || []).some(t => prova(t) !== 'ok'));
    return { kvar, sakert, forsiktigt, bortScenarier };
}

/**
 * Det som ett sparat scenario bär (regel R4): antalen kvinnor och män, grupperna med påslag och summorna. Det råa gapet
 * sparas bara när båda könen når k; antalen följer med, så att jämförelsen kan pröva gapet mot den tröskel som gäller
 * när den visas.
 * @param {any[]} rader @param {any} out prognosutfall @param {{efter: number|null}} ols den oförklarade skillnaden
 * @param {number} k
 */
export function scenarioUr(rader, out, ols, k) {
    const { nKv, nMa } = konAntal(rader);
    const konOk = konFarRedovisas(nKv, nMa, k);
    return {
        nKv, nMa,
        grupper: out.alloc.perGroup.filter(g => Math.abs(g.kostnad) > 0.5).map(g => ({ bas: g.bas, aid: g.aid, n: g.n, andelKv: g.andelKv, kostnad: g.kostnad })),
        summary: {
            använt: out.använt, totalKostnad: out.totalKostnad,
            rawGapFore: konOk ? out.rawGapFore : null, rawGapEfter: konOk ? out.rawGapEfter : null,
            oforklaratEfter: ols.efter, equityCost: out.equityCost,
            leapfrog: hittaOmkorningar(out.alloc.perGroup.filter(g => !(g.n < k))).length
        }
    };
}

/**
 * Scenariojämförelsen A/B vid tröskeln `k` (regel R4): per scenario det använda, den totala kostnaden, det råa gapet
 * efter (null när ett kön är under k; saknas antalen prövas underlaget som det är nu, `nu`), den oförklarade skillnaden
 * efter, andelen till kvinnodominerade grupper (varavKvDom på scenariots grupper, annars null) och antalet grupper som
 * går om varandra; `maskerat` när ett sparat gap inte visas.
 * @param {{A?: any, B?: any}} sc @param {{nu: {nKv: number, nMa: number}, k: number, arKvDom: (andelKv: number) => boolean}} val
 */
export function scenariojamforelse(sc, { nu, k, arKvDom }) {
    const konOk = s => konFarRedovisas(s.nKv ?? nu.nKv, s.nMa ?? nu.nMa, k);
    const rad = s => (s ? {
        anvant: s.summary.använt, totalKostnad: s.summary.totalKostnad,
        raEfter: konOk(s) ? s.summary.rawGapEfter : null, oforklaratEfter: s.summary.oforklaratEfter,
        tillKvDom: Array.isArray(s.grupper) ? varavKvDom(utfallsrader(s.grupper, k), s.summary.equityCost, k, arKvDom) : null,
        omkorningar: s.summary.leapfrog
    } : null);
    return { A: rad(sc.A), B: rad(sc.B), maskerat: [sc.A, sc.B].some(s => s && s.summary.rawGapEfter != null && !konOk(s)) };
}

/**
 * Tröskelmålet vid tröskeln `k` (regel R5): lyftet och kostnaden är ett könsuppdelat lönemått och räknas bara när
 * båda könen når k (status 'konUnderK' annars). Sedan prövas målet: i läget högst X % avvisas ett mål utanför fältets
 * gränser (`malOk` falskt, status 'ogiltigtMal'); i läget inte signifikant spelar det ingen roll. Sist
 * likalonslyftForMal med huvudregressionen som skattning (ADR-17).
 * @param {any[]} rader @param {{k: number, malPct: number, malOk?: boolean, signifikans: boolean, regval: any}} val
 * @returns {{status: string, [f: string]: any}}
 */
export function vymodellTroskelmal(rader, { k, malPct, malOk = true, signifikans, regval }) {
    if (!konFarRedovisasFor(rader, k)) return { status: 'konUnderK' };
    if (!signifikans && !malOk) return { status: 'ogiltigtMal' };
    return likalonslyftForMal(rader, { malPct, signifikans, skatta: oforklaradSkattning(regval) });
}

/**
 * Känsligheten (kanslighetskurva i tio steg) vid tröskeln `k`: det råa gapet är null när ett kön är under k.
 * `storsta` är det största råa gapet i belopp (minst 0,01), som staplarna mäts mot.
 * `minN` är minsta antal personer i gruppen för riktning, som i knappen för att minska skillnaderna.
 * @param {any[]} rader @param {any[]} kandidater @param {any} kostnadsval @param {number} k @param {number} [minN=0]
 */
export function vymodellKanslighet(rader, kandidater, kostnadsval, k, minN = 0) {
    const kurva = kanslighetskurva(rader, kandidater, kostnadsval, 10, minN);
    if (!konFarRedovisasFor(rader, k)) kurva.forEach(c => { c.rawGap = null; });
    return { kurva, storsta: Math.max(...kurva.map(c => Math.abs(c.rawGap || 0)), 0.01) };
}

/** Grupperna i kostnaden på individnivå som får egen rad, och kan bli riktade rader: minst k berörda kvinnor. */
export function individlyftGrupper(rem, k) {
    return rem.perGroup.filter(g => g.count >= k);
}

/**
 * Kostnaden på individnivå vid tröskeln `k` (I1): jämförelsevärdet kräver k män (individlyft med minMen k), en grupp
 * får egen rad först när k kvinnor berörs (`visade`; `dolda` är antalet övriga), och summan står bara när minst k
 * berörs (`summaVisas`). En gräns som inte är ett tal blir 5 %.
 * @param {any[]} rader @param {{gapPct: number, k: number}} val
 */
export function vymodellIndividlyft(rader, { gapPct, k }) {
    const rem = individlyft(rader, { gapPct: isFinite(gapPct) ? gapPct : 5, minMen: k });
    const visade = individlyftGrupper(rem, k);
    return { rem, visade, dolda: rem.perGroup.length - visade.length, summaVisas: rem.count >= k };
}
