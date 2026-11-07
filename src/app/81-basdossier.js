// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 81-basdossier.js — "Ett BAS-intervall, en sida"
//
// Samlar det verktyget redan vet om ett BAS-intervall i rapportens ordning, så att avsnittet om intervallet kan
// skrivas utan att samla ihop det ur fem flikar: nyckeltal och läget mot ställningstagandet, yrkesgrupperna (som i
// Lika arbete), likvärdigt arbete, ålder, förra året (årsbokslutet, ADR-54) och en textversion.
//
// Ingen ny statistik: yrkesgrupperna och deras status kommer ur likaArbeteGrupper (src/lib/rapportunderlag.js) med
// Lika arbetes gränser, paren ur likvardighetResultat() och förra året ur state.forraArsbokslut. Samma dialogmönster
// som gruppdossiern (80-gruppdossier.js).
//
// Dataskydd: skärmen följer läget (kTroskel(), ADR-51) som övriga flikar; könsuppdelade mått bara där båda könen når
// k. Textversionen lämnar verktyget och byggs därför i exportläget (basdossierText): grupper under k utelämnas och
// räknas upp utan lönemått.
// ====================================================================

const BD_ALDERSGRANSER = [35, 50];   // –34, 35–49, 50– (samma som rapportens tabell Löneskillnader i åldersgrupper)

/** BAS-intervallen som får öppnas i dossiern: minst k personer, i intervallens ordning. */
function basdossierKandidater() {
    const d = getData();
    return getBasIntervals().map(bas => ({ bas, n: d.filter(r => r.bas === bas && r.lon > 0).length }))
        .filter(x => x.n > 0 && !isKMasked(x.n));
}

/** Lika arbetes status för en yrkesgrupp ur likaArbeteGrupper (samma gränser som yrkesgruppstabellen i Lika arbete). */
function _bdStatus(g) {
    if (g.samladMedian) return 'liten';
    return g.flaggad ? 'granska' : g.gapPct > 3 ? 'folj' : 'balanserat';
}
const BD_STATUS_TEXT = { granska: 'Värt att granska', folj: 'Följ upp', balanserat: 'Balanserat', liten: 'Könsuppdelningen är för liten' };
const BD_STATUS_KLASS = { granska: ['farg-granska', 'sok'], folj: ['farg-varning', 'oga'], balanserat: ['farg-ok', 'bock'], liten: ['f-dampad', null] };

/**
 * Dossiern för ett BAS-intervall som ren data, eller null när intervallet saknas eller har färre än k personer.
 * @param {string} bas
 */
function buildBasdossier(bas) {
    if (!basdossierKandidater().some(x => x.bas === bas)) return null;
    const k = kTroskel();
    const df = getData().filter(r => r.bas === bas && r.lon > 0);
    const arKv = r => !!(r.kon && r.kon.includes('kvinna')), arMa = r => r.kon === 'man' || r.kon === 'män';
    const kv = df.filter(arKv), ma = df.filter(arMa);
    const lon = df.map(r => r.lon);
    const konOk = _konFarRedovisas(kv.length, ma.length);
    const median = Stat.median(lon), p10 = Stat.quantile(lon, 0.10), p90 = Stat.quantile(lon, 0.90);
    const medKv = konOk ? Stat.median(kv.map(r => r.lon)) : null, medMa = konOk ? Stat.median(ma.map(r => r.lon)) : null;

    // 1. Läget mot ställningstagandet: referensens rad för BAS-intervallet (inte en yrkesrad).
    const pol = typeof policyFor === 'function' ? policyFor(null, bas) : null;
    const pct = (v, ref) => (v != null && ref > 0 ? (v / ref - 1) * 100 : null);
    const referens = pol ? { namn: referensKortnamn(), p10: pol.p10 ?? null, med: pol.med ?? null, p90: pol.p90 ?? null,
        diffPct: { p10: pct(p10, pol.p10), med: pct(median, pol.med), p90: pct(p90, pol.p90) } } : null;

    // 2. Yrkesgrupperna i intervallet: antal och medianer räknade på intervallets rader, statusen Lika arbetes för hela
    //    yrket (Lika arbete grupperar per yrke över alla BAS-intervall), så att dossiern aldrig säger något annat.
    const lika = _ruLikaArbeteGrupper(df, { k, troskel: 5 });
    const alla = getData();
    const helaYrket = new Map(_ruLikaArbeteGrupper(alla, { k, troskel: 5 }).grupper.map(g => [g.yrke, g]));
    const basPerYrke = new Map();
    for (const r of alla) { if (!(r.lon > 0)) continue; if (!basPerYrke.has(r.yrke)) basPerYrke.set(r.yrke, new Set()); basPerYrke.get(r.yrke).add(r.bas); }
    const nycklar = new Set(gruppdossierCandidates().map(g => g.key));
    const yrken = lika.grupper.map(g => {
        const m = String(g.yrke || '').match(/^(\d+)/), aid = m ? m[1] : String(g.yrke || '');
        const delade = !g.samladMedian, hela = helaYrket.get(g.yrke) || g;
        const ocksaI = [...(basPerYrke.get(g.yrke) || [])].filter(b => b !== bas).sort();
        return { yrke: g.yrke, aid, nKv: g.nKv, nMa: g.nMa, tot: g.tot, status: _bdStatus(hela), samlad: !!g.samladMedian, helaTot: hela.tot, ocksaI,
            medKv: delade ? g.medKv : null, medMa: delade ? g.medMa : null, kvotPct: delade ? g.kvot * 100 : null,
            medTot: g.samladMedian ? g.medTot : null, dossierKey: nycklar.has(`${aid}|${bas}`) ? `${aid}|${bas}` : null };
    }).sort((a, b) => b.tot - a.tot || String(a.yrke).localeCompare(String(b.yrke), 'sv'));

    // 3. Likvärdigt arbete: kandidatpar och hierarkiska par där det kvinnodominerade yrket ligger i intervallet.
    let kandidat = [], hierarkiska = [], parUtelamnade = 0;
    try {
        const lv = likvardighetResultat();
        const a = _parForRedovisning(((lv && lv.pairs) || []).filter(p => p.kvBas === bas));
        const b = _parForRedovisning(((lv && lv.lagreKrav) || []).filter(p => p.kvBas === bas));
        kandidat = a.par; hierarkiska = b.par; parUtelamnade = a.utelamnade + b.utelamnade;
    } catch (e) { rapporteraFel('BAS-dossier: likvärdigt arbete', e); }
    const parRad = p => ({ kvLabel: p.kvLabel, kvAid: p.kvAid, kvBas: p.kvBas, kvN: p.kvN, kvMedian: p.kvMedian,
        maLabel: p.maLabel, maAid: p.maAid, maBas: p.maBas, maN: p.maN ?? null, maMedian: p.maMedian, gapKr: p.gapKr, gapPct: p.gapPct });

    // 4. Ålder: medianlön per åldersgrupp och kön; ett köns median bara när båda könen i åldersgruppen når k.
    const namn = __mirrorPerBas.aldersgruppNamn(BD_ALDERSGRANSER);
    const iGrupp = (r, i) => { const lo = i === 0 ? -Infinity : BD_ALDERSGRANSER[i - 1], hi = i < BD_ALDERSGRANSER.length ? BD_ALDERSGRANSER[i] : Infinity; return r.alder >= lo && r.alder < hi; };
    const medAlder = df.filter(r => typeof r.alder === 'number' && r.alder > 0);
    const alder = namn.map((n, i) => {
        const rader = medAlder.filter(r => iGrupp(r, i)), gKv = rader.filter(arKv), gMa = rader.filter(arMa);
        const ok = _konFarRedovisas(gKv.length, gMa.length);
        return { namn: n, n: rader.length, nKv: gKv.length, nMa: gMa.length,
            med: rader.length && !isKMasked(rader.length) ? Stat.median(rader.map(r => r.lon)) : null,
            medKv: ok ? Stat.median(gKv.map(r => r.lon)) : null, medMa: ok ? Stat.median(gMa.map(r => r.lon)) : null };
    });

    // 5. Förra året: intervallets rad ur förra årets bokslut, jämförd med årets (samma rad som bokslutet bär).
    // Förra årets fil kan ha sparats med en lägre tröskel: raden läses med den högre av filens och den inställda.
    const fb0 = state.forraArsbokslut;
    /** @type {any} */ const fb = fb0 ? _abMedGrans(fb0, Math.max(fb0.k, kInstalld())) : null;
    /** @type {any} */ let forra = { lage: 'ingetBokslut' };
    if (fb && !Array.isArray(fb.basIntervall)) forra = { lage: 'saknasFalt', ar: fb.ar };
    else if (fb) {
        const f = fb.basIntervall.find(r => r.bas === bas);
        const nu = typeof _abBasRad === 'function' ? _abBasRad(getData(), bas, k) : null;
        const j = f && nu ? _abJamforBas([f], [nu]) : null;
        forra = j && j[0] ? { lage: 'ok', ar: fb.ar, rad: j[0] } : { lage: 'saknasIntervall', ar: fb.ar };
    }

    return { bas, n: df.length, nKv: kv.length, nMa: ma.length, andelKv: df.length ? kv.length / df.length * 100 : null,
        median, p10, p90, konOk, medKv, medMa, kvotPct: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null,
        referens, yrken, yrkenUtelamnade: lika.utelamnade.slice().sort((a, b) => String(a).localeCompare(String(b), 'sv')),
        ejJamforbara: lika.ejJamforbara.slice(),
        par: { kandidat: kandidat.map(parRad), hierarkiska: hierarkiska.map(parRad), utelamnade: parUtelamnade },
        alder, forra, k };
}

// ---- Rendering --------------------------------------------------------------

/** @type {string|null} */
let _bdVald = null;
/** Öppnar dossiern för ett BAS-intervall (eller det första), med fokus tillbaka till öppnaren när den stängs. */
function openBasdossier(bas, opener) {
    const modal = document.getElementById('basdossier-modal');
    if (!modal) return;
    renderBasdossier(bas);
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal, opener || document.activeElement);
}
function closeBasdossier() {
    const modal = document.getElementById('basdossier-modal');
    if (!modal || modal.style.display !== 'flex') return;
    if (typeof releaseFocus === 'function') releaseFocus(modal);
    modal.style.display = 'none';
}

function renderBasdossier(bas) {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('basdossier-select'));
    const body = document.getElementById('basdossier-body');
    if (!sel || !body) return;
    const kand = basdossierKandidater();
    if (!kand.length) {
        sel.innerHTML = '';
        body.innerHTML = `<div class="flik-empty-state"><div class="empty-icon">${ikon('tomLada')}</div>
            <h3>Inga BAS-intervall att visa</h3><p>Inget BAS-intervall når ${kTroskel()} personer, eller ingen lönefil är inläst.</p></div>`;
        return;
    }
    const onskat = bas || sel.value || _bdVald || kand[0].bas;
    sel.innerHTML = kand.map(x => `<option value="${esc(x.bas)}">BAS ${esc(x.bas)} (${svTal(x.n, 0)} personer)</option>`).join('');
    sel.value = kand.some(x => x.bas === onskat) ? onskat : kand[0].bas;
    _bdVald = sel.value;
    // Ett begärt intervall som inte (längre) når tröskeln öppnas inte i tysthet som ett annat: det sägs.
    if (bas && bas !== sel.value) announceToScreenReader(`BAS ${bas} visas inte i dossiern: intervallet finns inte i underlaget eller har färre än ${kTroskel()} personer. Visar BAS ${sel.value}.`);
    const d = buildBasdossier(sel.value);
    body.innerHTML = d ? _bdRenderBody(d) : '<p class="f-dampad">BAS-intervallet kunde inte läsas.</p>';
    // Fokusfällan cachar de fokuserbara elementen; när innehållet byggs om medan dialogen är öppen läggs den om,
    // med samma öppnare. Fokus står kvar där det var (väljaren), i stället för att hoppa till stängknappen.
    const modal = document.getElementById('basdossier-modal');
    if (modal && modal.style.display === 'flex') {
        const trap = _focusTraps.get(modal), opener = trap ? trap.opener : null, aktiv = document.activeElement;
        if (trap) { modal.removeEventListener('keydown', trap.handler); _focusTraps.delete(modal); }
        trapFocus(modal, opener);
        if (aktiv && aktiv !== document.body && modal.contains(aktiv)) setTimeout(() => /** @type {HTMLElement} */ (aktiv).focus(), 60);
    }
}

const _bdKr = v => (v == null || !isFinite(v) ? '–' : `${svTal(Math.round(v), 0)} kr`);
const _bdTecken = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
const _bdPctTecken = v => (v == null ? '–' : `${_bdTecken(v)}${svPct(Math.abs(v), 1)}`);

function _bdRenderBody(d) {
    const card = (title, inner, note) => `<div class="gd-card bd-card"><h3>${title}</h3>${note ? `<p class="gd-note">${note}</p>` : ''}${inner}</div>`;
    const missing = txt => `<p class="gd-missing">${txt}</p>`;
    const k = d.k;

    // 1. Nyckeltal och läget mot ställningstagandet
    const nyckeltal = `<div class="gd-kpis">
            <div class="gd-kpi"><span>${svTal(d.n, 0)}</span><small>personer</small></div>
            <div class="gd-kpi"><span>${d.nKv} / ${d.nMa}</span><small>kvinnor / män (${svPct(d.andelKv, 0)} kvinnor)</small></div>
            <div class="gd-kpi"><span>${_bdKr(d.median)}</span><small>median</small></div>
            <div class="gd-kpi"><span>${_bdKr(d.p10)} – ${_bdKr(d.p90)}</span><small>P10 – P90</small></div>
        </div>`
        + (d.konOk ? `<p>Kvinnors median ${_bdKr(d.medKv)}, mäns ${_bdKr(d.medMa)}: kvinnors median är ${svPct(d.kvotPct, 1)} av mäns.</p>`
            : `<p class="gd-note">${esc(_konUtelamnatNot())}</p>`)
        + (d.referens
            ? `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Mot ${esc(d.referens.namn)}</th><th scope="col" class="t-hoger">P10</th><th scope="col" class="t-hoger">Median</th><th scope="col" class="t-hoger">P90</th></tr></thead><tbody>`
              + `<tr><th scope="row">Referensen</th><td class="t-tal">${_bdKr(d.referens.p10)}</td><td class="t-tal">${_bdKr(d.referens.med)}</td><td class="t-tal">${_bdKr(d.referens.p90)}</td></tr>`
              + `<tr><th scope="row">BAS ${esc(d.bas)}</th><td class="t-tal">${_bdKr(d.p10)}</td><td class="t-tal">${_bdKr(d.median)}</td><td class="t-tal">${_bdKr(d.p90)}</td></tr>`
              + `<tr><th scope="row">Skillnad</th><td class="t-tal">${_bdPctTecken(d.referens.diffPct.p10)}</td><td class="t-tal">${_bdPctTecken(d.referens.diffPct.med)}</td><td class="t-tal">${_bdPctTecken(d.referens.diffPct.p90)}</td></tr></tbody></table>`
            : missing('Inget ställningstagande har en rad för intervallet.'));

    // 2. Yrkesgrupperna
    const status = y => { const [klass, ik] = BD_STATUS_KLASS[y.status]; return `<span class="la-status ${klass}">${ik ? ikon(ik) : ''} ${BD_STATUS_TEXT[y.status]}</span>`; };
    const yrkesrad = y => `<tr><td>${esc(y.aid)}</td><td>${esc(String(y.yrke).replace(/^\d+\s*/, '') || y.yrke)}</td>`
        + `<td class="t-tal">${y.tot} (${y.nKv}/${y.nMa})</td>`
        + (y.samlad ? `<td colspan="3" class="t-mitt">Gruppens median ${_bdKr(y.medTot)}</td>`
            : `<td class="t-tal">${_bdKr(y.medKv)}</td><td class="t-tal">${_bdKr(y.medMa)}</td><td class="t-tal">${svPct(y.kvotPct, 1)}</td>`)
        + `<td>${status(y)}${y.ocksaI.length ? `<br><span class="gd-note">${esc(_bdHelaYrketNot(y))}</span>` : ''}</td><td class="t-mitt">${y.dossierKey ? `<button type="button" class="btn-table-tool" data-bd-gruppdossier="${esc(y.dossierKey)}" aria-label="Öppna gruppdossiern för ${esc(y.yrke)}">Gruppdossier</button>` : ''}</td></tr>`;
    const yrken = (d.yrken.length
        ? `<div class="table-container"><table class="data-table st-088 bd-tabell" id="basdossier-yrken"><thead><tr><th scope="col">AID</th><th scope="col">Yrke</th><th scope="col" class="t-hoger">Antal (kv/mä)</th><th scope="col" class="t-hoger">Median kvinnor</th><th scope="col" class="t-hoger">Median män</th><th scope="col" class="t-hoger">Kvinnors median i % av mäns</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Gruppdossier</span></th></tr></thead><tbody>${d.yrken.map(yrkesrad).join('')}</tbody></table></div>`
        : missing('Ingen yrkesgrupp i intervallet har både kvinnor och män att jämföra.'))
        + (d.yrkenUtelamnade.length ? kMaskNote(d.yrkenUtelamnade, 'yrkesgrupp|yrkesgrupper') : '')
        + (d.ejJamforbara.length ? `<p class="gd-note">Inte jämförbara (ett kön har färre än två personer): ${esc(d.ejJamforbara.join(', '))}.</p>` : '');

    // 3. Likvärdigt arbete
    const parLista = lista => `<ul class="gd-list">${lista.map(p => `<li>${esc(gruppNamn({ aid: p.kvAid, yrke: p.kvLabel }))} (BAS ${esc(p.kvBas)}) mot ${esc(gruppNamn({ aid: p.maAid, yrke: p.maLabel }))} (BAS ${esc(p.maBas)}): ${_bdKr(p.kvMedian)} mot ${_bdKr(p.maMedian)}, skillnad ${_bdKr(p.gapKr)} (${svPct(p.gapPct, 1)})</li>`).join('')}</ul>`;
    const parNot = d.par.utelamnade ? `<p class="gd-note">${esc(_parUtelamnadeNot(d.par.utelamnade))}</p>` : '';
    const likvardigt = (d.par.kandidat.length || d.par.hierarkiska.length)
        ? (d.par.kandidat.length ? `<p><strong>Kandidatpar där det kvinnodominerade yrket ligger i intervallet</strong></p>${parLista(d.par.kandidat)}` : '<p>Inga kandidatpar där det kvinnodominerade yrket ligger i intervallet.</p>')
          + (d.par.hierarkiska.length ? `<p><strong>Lägre krav, högre lön</strong> (jämförelseyrket ligger i ett lägre intervall)</p>${parLista(d.par.hierarkiska)}` : '') + parNot
        : (parNot || missing('Inget kvinnodominerat yrke i intervallet ingår i en jämförelse av likvärdigt arbete.'));

    // 4. Ålder
    const alder = `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Åldersgrupp</th><th scope="col" class="t-hoger">Antal (kv/mä)</th><th scope="col" class="t-hoger">Median</th><th scope="col" class="t-hoger">Median kvinnor</th><th scope="col" class="t-hoger">Median män</th></tr></thead><tbody>`
        + d.alder.map(a => `<tr><th scope="row">${esc(a.namn)}</th><td class="t-tal">${a.n} (${a.nKv}/${a.nMa})</td><td class="t-tal">${_bdKr(a.med)}</td><td class="t-tal">${_bdKr(a.medKv)}</td><td class="t-tal">${_bdKr(a.medMa)}</td></tr>`).join('')
        + `</tbody></table><p class="gd-note">Ett köns median står bara där båda könen i åldersgruppen har minst ${k} personer.</p>`
        + `<p><button type="button" class="btn-table-tool" data-bd-alder="${esc(d.bas)}">${ikon('pilUt', 14)} Ålder &amp; karriär för BAS ${esc(d.bas)}</button></p>`;

    // 5. Förra året
    const f = d.forra;
    let forra;
    if (f.lage === 'ok') {
        const r = f.rad;
        forra = `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Mått</th><th scope="col" class="t-hoger">${f.ar}</th><th scope="col" class="t-hoger">I år</th><th scope="col" class="t-hoger">Förändring</th></tr></thead><tbody>`
            + `<tr><th scope="row">Antal</th><td class="t-tal">${r.n.forra ?? '–'}</td><td class="t-tal">${r.n.nu ?? '–'}</td><td class="t-tal">${r.n.diff == null ? '–' : `${_bdTecken(r.n.diff)}${Math.abs(r.n.diff)}`}</td></tr>`
            + [['p10', 'P10'], ['med', 'Median'], ['p90', 'P90'], ['medKv', 'Median kvinnor'], ['medMa', 'Median män']].map(([m, e]) => `<tr><th scope="row">${e}</th><td class="t-tal">${_bdKr(r[m].forra)}</td><td class="t-tal">${_bdKr(r[m].nu)}</td><td class="t-tal halvfet">${_abForandringText(r[m])}</td></tr>`).join('')
            + '</tbody></table>';
    } else forra = missing(_bdForraText(f));

    return `
        <div class="gd-head">
            <h3 class="fs-lg marg-0">BAS-intervall ${esc(d.bas)}</h3>
            <span class="gd-sub">${svTal(d.n, 0)} personer · ${d.yrken.length} ${d.yrken.length === 1 ? 'yrkesgrupp' : 'yrkesgrupper'}</span>
            <button type="button" class="btn-table-tool" id="btn-basdossier-copy" title="Kopiera dossiern som text, i rapportens form">${ikon('kopiera', 14)} Kopiera som text</button>
        </div>
        <div class="bd-stack">
            ${(() => { const hp = _hpBedomningHtml(_hpBedomningar(([kalla, , bas]) => (kalla === 'prio' || kalla === 'par') && bas === String(d.bas)), { medGrupp: true });
                return hp ? card('Bedömning i handlingsplanen', hp, 'Dossiern dokumenterar inte sakliga skäl. Raderna pekar på bedömningen i Handlingsplan.') : ''; })()}
            ${card('Nyckeltal', nyckeltal)}
            ${card('Yrkesgrupperna i intervallet', yrken, 'Samma gränser som i Lika arbete, räknade på intervallets personer. Könsuppdelade mått bara där båda könen når minsta gruppstorlek.')}
            ${card('Likvärdigt arbete i intervallet', likvardigt)}
            ${card('Ålder', alder)}
            ${card('Förra året', forra)}
        </div>`;
}

/** Noten för ett yrke som också finns i andra BAS-intervall: statusen är Lika arbetes, för hela yrket. */
function _bdHelaYrketNot(y) {
    return `Status gäller hela yrket (${y.helaTot} personer), som i Lika arbete; yrket finns också i ${y.ocksaI.map(b => `BAS ${b}`).join(', ')}`;
}

/** Raden i punkt 5 när det inte finns något att jämföra med. */
function _bdForraText(f) {
    if (f.lage === 'saknasFalt') return `Förra årets bokslut (${f.ar}) sparades med en äldre version av verktyget och saknar raderna per BAS-intervall. Årets konfigurationsfil har dem.`;
    if (f.lage === 'saknasIntervall') return `Förra årets bokslut (${f.ar}) har ingen rad för intervallet: det hade färre än minsta gruppstorlek eller fanns inte.`;
    return 'Inget årsbokslut inläst. Konfigurationsfilen bär bokslutet: läs in förra årets fil i Spara och jämför år, så står intervallets rad här.';
}

/**
 * Textens stycken för ett BAS-intervall, i rapportens ordning: en rubrik och raderna under den per punkt. En enda
 * textbyggare för dossierns textkopia (basdossierAsText), rapportutkastet i Rapporttext (basintervallUtkastText),
 * avsnittet Lönekartläggning per BAS-intervall i Word och PDF (58-rapportmodell.js) och rapportunderlagets block
 * per intervall (67-rapportunderlag.js), så att de inte kan säga olika saker. Modellen ska vara byggd i exportläget:
 * grupper under k står då bara med namn bland de utelämnade.
 * @param {any} d modellen ur buildBasdossier
 * @param {{forraBaraMedBokslut?: boolean}} [val] forraBaraMedBokslut: punkten Förra året bara när ett bokslut är
 *   inläst (rapporten); dossiern säger annars hur man får ett
 * @returns {{rubrik: string, rader: string[]}[]}
 */
function basdossierStycken(d, { forraBaraMedBokslut = false } = {}) {
    const kr = _bdKr;
    const ut = [];
    const nyckeltal = [`${svTal(d.n, 0)} personer, ${d.nKv} kvinnor och ${d.nMa} män (${svPct(d.andelKv, 0)} kvinnor). Medianlön ${kr(d.median)}, P10–P90 ${kr(d.p10)}–${kr(d.p90)}.`
        + (d.konOk ? ` Kvinnors median ${kr(d.medKv)} och mäns ${kr(d.medMa)}: kvinnors median är ${svPct(d.kvotPct, 1)} av mäns.` : ` ${_konUtelamnatNot()}`)];
    if (d.referens) nyckeltal.push(`Mot ${d.referens.namn}: P10 ${kr(d.p10)} mot ${kr(d.referens.p10)} (${_bdPctTecken(d.referens.diffPct.p10)}), median ${kr(d.median)} mot ${kr(d.referens.med)} (${_bdPctTecken(d.referens.diffPct.med)}), P90 ${kr(d.p90)} mot ${kr(d.referens.p90)} (${_bdPctTecken(d.referens.diffPct.p90)}).`);
    ut.push({ rubrik: 'Nyckeltal', rader: nyckeltal });

    const yrken = [];
    if (!d.yrken.length) yrken.push('Ingen yrkesgrupp i intervallet har både kvinnor och män att jämföra.');
    for (const y of d.yrken) {
        const antal = `${y.tot} personer (${y.nKv} kvinnor, ${y.nMa} män)`;
        yrken.push((y.samlad
            ? `- ${y.yrke}: ${antal}. Gruppens median ${kr(y.medTot)}; könsuppdelningen är för liten för en jämförelse.${y.ocksaI.length && y.status !== 'liten' ? ` ${BD_STATUS_TEXT[y.status]}.` : ''}`
            : `- ${y.yrke}: ${antal}. Kvinnor ${kr(y.medKv)}, män ${kr(y.medMa)}; kvinnors median ${svPct(y.kvotPct, 1)} av mäns. ${BD_STATUS_TEXT[y.status]}.`)
            + (y.ocksaI.length ? ` ${_bdHelaYrketNot(y)}.` : ''));
    }
    if (d.yrkenUtelamnade.length) yrken.push(`Redovisas inte (färre än ${d.k} personer): ${d.yrkenUtelamnade.join(', ')}.`);
    if (d.ejJamforbara.length) yrken.push(`Inte jämförbara (ett kön har färre än två personer): ${d.ejJamforbara.join(', ')}.`);
    ut.push({ rubrik: 'Yrkesgrupperna i intervallet', rader: yrken });

    const likvardigt = [];
    const par = p => `- ${gruppNamn({ aid: p.kvAid, yrke: p.kvLabel })} (BAS ${p.kvBas}) mot ${gruppNamn({ aid: p.maAid, yrke: p.maLabel })} (BAS ${p.maBas}): ${kr(p.kvMedian)} mot ${kr(p.maMedian)}, skillnad ${kr(p.gapKr)} (${svPct(p.gapPct, 1)}).`;
    if (d.par.kandidat.length) { likvardigt.push('Kandidatpar där det kvinnodominerade yrket ligger i intervallet:'); d.par.kandidat.forEach(p => likvardigt.push(par(p))); }
    if (d.par.hierarkiska.length) { likvardigt.push('Lägre krav, högre lön:'); d.par.hierarkiska.forEach(p => likvardigt.push(par(p))); }
    if (!d.par.kandidat.length && !d.par.hierarkiska.length) likvardigt.push('Inget kvinnodominerat yrke i intervallet ingår i en jämförelse av likvärdigt arbete.');
    if (d.par.utelamnade) likvardigt.push(_parUtelamnadeNot(d.par.utelamnade));
    ut.push({ rubrik: 'Likvärdigt arbete i intervallet', rader: likvardigt });

    const alder = d.alder.map(a => {
        const kon = a.medKv != null ? `, kvinnor ${kr(a.medKv)}, män ${kr(a.medMa)}` : '';
        return `- ${a.namn}: ${a.n} personer (${a.nKv} kvinnor, ${a.nMa} män)${a.med != null ? `, median ${kr(a.med)}${kon}` : ''}.`;
    });
    alder.push(`Ett köns median står bara där båda könen i åldersgruppen har minst ${d.k} personer.`);
    ut.push({ rubrik: 'Ålder', rader: alder });

    const f = d.forra;
    if (f.lage === 'ok') {
        const r = f.rad;
        ut.push({ rubrik: 'Förra året', rader: [`Jämfört med ${f.ar}: antal ${r.n.forra ?? '–'} till ${r.n.nu ?? '–'}; `
            + [['p10', 'P10'], ['med', 'median'], ['p90', 'P90']].map(([m, e]) => `${e} ${kr(r[m].forra)} till ${kr(r[m].nu)} (${_abForandringText(r[m])})`).join('; ') + '.'] });
    } else if (!(forraBaraMedBokslut && f.lage === 'ingetBokslut')) ut.push({ rubrik: 'Förra året', rader: [_bdForraText(f)] });
    return ut;
}

/** Fältet att fylla i som avslutar ett intervall i rapportutkastet, Word-utkastet och rapportunderlaget. */
const BD_BEDOMNING = 'Bedömning: har skillnaderna mellan kvinnor och män i intervallets yrkesgrupper sakliga skäl, och motsvarar lönen i de kvinnodominerade yrkena kraven i arbetet? Ange åtgärd där det behövs.';

/** Textens rader: rubriken "BAS-intervall X" och styckena, åtskilda av en tom rad. */
function _bdTextRader(d, val) {
    return [`BAS-intervall ${d.bas}`, '', ...basdossierStycken(d, val).flatMap((s, i) => [...(i ? [''] : []), s.rubrik, ...s.rader])];
}

/**
 * Textversionen i rapportens form: rubriken "BAS-intervall X" och ett stycke per punkt. Byggs ur en modell som
 * byggts i exportläget (basdossierText), så grupper under k står bara med namn bland de utelämnade.
 */
function basdossierAsText(d) {
    const L = _bdTextRader(d);
    if (_kSanktNot()) L.push('', _kSanktNot());
    return L.join('\n');
}

/**
 * Intervallets stycke i rapportutkastet (Rapporttext): dossierns text, förra året bara när ett bokslut är inläst, och
 * raden att fylla i sist. Meningen om sänkt tröskel står en gång, sist i utkastet. Modellen byggs i exportläget.
 */
function basintervallUtkastText(d) {
    return [..._bdTextRader(d, { forraBaraMedBokslut: true }), '', `[HR fyller i] ${BD_BEDOMNING}`].join('\n');
}

/**
 * Yrkesgruppstabellen i rapportens avsnitt och rapportunderlagets block: bara yrken där båda könen når k (de övriga
 * står i texten, med gruppens median eller bland de utelämnade). Talen som tal; den som ritar formaterar.
 * @param {any} d modellen ur buildBasdossier, byggd i exportläget
 */
function basdossierYrkesrader(d) {
    return d.yrken.filter(y => !y.samlad).map(y => ({ aid: y.aid, yrke: String(y.yrke).replace(/^\d+\s*/, '') || String(y.yrke),
        nKv: y.nKv, nMa: y.nMa, medKv: y.medKv, medMa: y.medMa, kvotPct: y.kvotPct, status: BD_STATUS_TEXT[y.status] }));
}
const BD_YRKESKOLUMNER = ['AID', 'Yrke', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Status'];

/** BAS-intervallen med lönerader som inte når k: de nämns i rapporten och utkastet, utan mått (som i Lönestruktur). */
function basdossierUtelamnade() {
    const d = getData(), kand = new Set(basdossierKandidater().map(x => x.bas));
    return getBasIntervals().filter(b => !kand.has(b) && d.some(r => r.bas === b && r.lon > 0));
}

/** Texten för ett BAS-intervall, byggd i exportläget (ADR-51); null när intervallet inte når den inställda tröskeln. */
function basdossierText(bas) {
    return medExportLage(() => { const d = buildBasdossier(bas); return d ? basdossierAsText(d) : null; });
}

/**
 * Knappen som öppnar dossiern, för tabellerna (Löneöversikten, Lönestrukturs tabell per BAS-intervall) och
 * gruppdossiern. `ikonEndast`: bara en ikon, som bevisknappen bredvid, så att radens rubrik har samma text som förut.
 */
function basdossierKnapp(bas, { text = 'BAS-dossier', ikonEndast = false } = {}) {
    const attr = `type="button" data-open-basdossier="${esc(bas)}" aria-label="Öppna BAS-dossiern för BAS ${esc(bas)}" title="BAS-dossier: allt om BAS ${esc(bas)} på en sida"`;
    return ikonEndast ? `<button ${attr} class="btn-evidence bd-oppna-ikon">${ikon('dokument')}</button>`
        : `<button ${attr} class="btn-table-tool bd-oppna">${esc(text)}</button>`;
}

// ---- Wiring ----
document.getElementById('basdossier-select')?.addEventListener('change', () => renderBasdossier());
// Knapparna i tabellraderna: fångas före radens egna lyssnare (fäll in/ut, markering), som inte ska reagera.
document.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[data-open-basdossier]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const bas = btn.getAttribute('data-open-basdossier') || '';
    // Från gruppdossiern: den stängs först, så att fokus går tillbaka till det som öppnade den när BAS-dossiern stängs.
    const iGrupp = btn.closest('#dossier-modal');
    if (iGrupp) { closeGruppdossier(); openBasdossier(bas); } else openBasdossier(bas, btn);
}, true);
document.addEventListener('click', e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest) return;
    if (t.closest('[data-basdossier-close]')) { closeBasdossier(); return; }
    const grupp = t.closest('[data-bd-gruppdossier]');
    if (grupp) { closeBasdossier(); openGruppdossier(grupp.getAttribute('data-bd-gruppdossier')); return; }
    const alder = t.closest('[data-bd-alder]');
    if (alder) {
        const bas = alder.getAttribute('data-bd-alder') || '';
        closeBasdossier();
        const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('bas-select-kon'));
        if (sel && [...sel.options].some(o => o.value === bas)) sel.value = bas;
        navigateTo('kon');
        return;
    }
    if (t.closest('#btn-basdossier-copy')) {
        const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('basdossier-select'));
        const txt = sel ? basdossierText(sel.value) : null;   // texten lämnar verktyget (ADR-51)
        if (!txt) { announceToScreenReader(`BAS-intervallet har färre än ${kInstalld()} personer och kopieras inte.`); return; }
        const klart = () => announceToScreenReader('BAS-dossiern kopierad.');
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(klart).catch(() => {});
        else klart();
    }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('basdossier-modal')?.style.display === 'flex') closeBasdossier();
});
