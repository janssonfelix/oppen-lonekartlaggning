// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Tabellerna per AID-kod och BAS-intervall: lika arbete, likvärdigt arbete, hierarkisk jämförelse, individnivå ----
//
// Lika arbete är samma yrkesgrupp (AID-kod) på samma nivå (BAS-intervall). De fyra tabellerna här är de en skriven
// lönekartläggning behöver på den nivån, med kolumnnamn som går att klistra in i rapporten utan att ändras. Logiken
// ligger i src/lib/aidbas.js (speglad); här står reglerna som hör till verktyget:
//
//   - Könsuppdelade mått (ett köns median, kvoten, gränserna) och gruppens median och spridning kräver statGolv()
//     personer — standard 10, följer med uppåt när minsta gruppstorlek höjs — i båda lägena, som övriga skattningar.
//     En grupp där något kön är mindre står som "Analyseras på individnivå" och i arbetslistan.
//   - En egen rad kräver minst LITET_UNDERLAG (5) personer i exportläget; mindre grupper räknas upp i en not under
//     tabellen, med namn och antal men utan löner (ADR-12). På skärmen visas alla grupper (ADR-51).
//   - Gränserna för slumpen är trattdiagrammets (41-lika-arbete.js): omkastning av könen inom gruppen, räknad per
//     AID-kod och BAS-intervall, så att tabellen och fliken Slumpens gränser säger samma sak.
//   - Kvinnodominerat enligt DO (mer än tröskeln) eller SCB (tröskeln eller mer): valet i Likvärdigt arbetes
//     inställningar, standard DO; tröskeln är kvinnotröskeln där (standard 60 %).
//   - Lönemånaden står ovanför varje tabell; den anges i Inställningar, och tomt skrivs ut som "inte angiven".

/** Antalet per kön (och per grupp för median och spridning) som krävs för ett lönemått. */
function aidbasK() { return statGolv(); }
/** Antalet i gruppen som krävs för en egen rad: 5 i exportläget, alla på skärmen (ADR-51). */
function aidbasGolv() { return kTroskel() > K_SKARM ? LITET_UNDERLAG : 1; }
/** Vald definition av kvinnodominerat arbete: 'do' eller 'scb'. */
function aidbasDefinition() { return state.likvardighet && state.likvardighet.kvDomDefinition === 'scb' ? 'scb' : 'do'; }
/** Gränsen i procent kvinnor: kvinnotröskeln i Likvärdigt arbete. */
function aidbasGrans() { return (state.likvardighet && state.likvardighet.kvinnoTrosholdPct) || 60; }
/** Texten om definitionen, för tabellerna och metodbladet. */
function aidbasDefinitionText() { return _aidbasDefinitionText(aidbasDefinition(), aidbasGrans()); }
/** Raden om lönemånaden ovanför tabellerna. */
function lonemanadText() { return `Lönemånad: ${state.lonemanad ? state.lonemanad : 'inte angiven'}`; }
/** Sätter lönemånaden (från panelen eller konfigurationsfilen) och synkar fältet. */
function sattLonemanad(v) {
    state.lonemanad = String(v ?? '').trim().slice(0, 40);
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById('lonemanad'));
    if (el && el.value !== state.lonemanad) el.value = state.lonemanad;
}
document.getElementById('lonemanad')?.addEventListener('change', e => {
    sattLonemanad(/** @type {HTMLInputElement} */ (e.target).value);
    // Den öppna fliken ritas om direkt; övriga ritas när de öppnas.
    const aktiv = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (aktiv === 'matrix') renderAidBasLika();
    if (aktiv === 'likvardighet') renderAidBasLikvardigt();
});

/** Andelen kvinnor nationellt för en AID-kod (SKR:s personalstatistik, organisationstypen i Inställningar), eller null. */
function _aidbasNationell(aid) {
    const r = typeof _skrKvinnoandel === 'function' ? _skrKvinnoandel(aid, { del: _skrDel() }) : null;
    return r && typeof r.pct === 'number' ? r.pct : null;
}
/** Slumpens gränser per grupp ur trattens underlag, räknat med samma antal per kön som tabellen kräver. */
function _aidbasGranser(d) {
    const u = _laTrattUnderlag(d, aidbasK());
    const per = new Map((u ? u.punkter : []).map(p => [p.nyckel, { lag: p.gransLag, hog: p.gransHog }]));
    return g => per.get(`${g.aid}|${g.bas}`) || null;
}
/** De fyra tabellerna ur underlaget, med verktygets regler. */
function aidbasTabeller(d = getData()) {
    const k = aidbasK(), golv = aidbasGolv(), definition = aidbasDefinition(), grans = aidbasGrans();
    return {
        k, golv, definition, grans,
        lika: _aidbasLika(d, { k, golv, granser: _aidbasGranser(d) }),
        likvardigt: _aidbasLikvardigt(d, { k, golv, definition, grans, nationell: _aidbasNationell }),
        par: _aidbasPar(d, { k, definition, grans }),
        individ: _aidbasIndivid(d, { k, golv })
    };
}

// ---- Kolumnerna: exakt de namn rapporten använder. typ styr talformatet på skärmen och i Excel. ----
/** @type {{[tabell: string]: Array<[string, string, (r: any) => any]>}} */
const AIDBAS_KOL = {
    lika: [['BAS-intervall', 'text', r => r.bas], ['AID-kod', 'text', r => r.aid], ['Yrkesgrupp', 'text', r => r.yrke], ['Antal kvinnor', 'antal', r => r.nKv], ['Antal män', 'antal', r => r.nMa],
           ['Medianlön kvinnor', 'kr', r => r.medKv], ['Medianlön män', 'kr', r => r.medMa], ['Kvinnors median i % av mäns', 'pct', r => r.kvot],
           ['Nedre gräns', 'pct', r => r.lag], ['Övre gräns', 'pct', r => r.hog], ['Bedömning', 'text', r => r.bedomning]],
    likvardigt: [['BAS-intervall', 'text', r => r.bas], ['AID-kod', 'text', r => r.aid], ['Yrkesgrupp', 'text', r => r.yrke], ['Antal', 'antal', r => r.n],
                 ['Andel kvinnor (%)', 'pct', r => r.andelKv], ['Andel kvinnor nationellt (%)', 'pct', r => r.andelKvNat], ['Klassning', 'text', r => r.klass],
                 ['Brukar anses kvinnodominerad', 'text', r => r.brukar], ['Medianlön', 'kr', r => r.median], ['Lönespridning', 'kvot', r => r.spridning]],
    sammanfattning: [['BAS-intervall', 'text', s => s.bas], ['Kvinnodominerade grupper', 'antal', s => s.antalKvDom], ['Högsta medianlön kvinnodominerad', 'kr', s => s.kvDom.hogst], ['Lägsta medianlön kvinnodominerad', 'kr', s => s.kvDom.lagst],
                     ['Övriga grupper', 'antal', s => s.antalOvriga], ['Högsta medianlön övriga', 'kr', s => s.ovriga.hogst], ['Lägsta medianlön övriga', 'kr', s => s.ovriga.lagst],
                     ['Skillnad (kr)', 'kr', s => s.skillnadKr], ['Skillnad (%)', 'pct', s => s.skillnadPct]],
    par: [['Grupp A (ej kvinnodominerad)', 'text', p => `${p.a.aid} ${p.a.yrke}`], ['BAS A', 'text', p => p.a.bas], ['Median A', 'kr', p => p.a.median],
          ['Grupp B (kvinnodominerad)', 'text', p => `${p.b.aid} ${p.b.yrke}`], ['BAS B', 'text', p => p.b.bas], ['Median B', 'kr', p => p.b.median],
          ['Skillnad (kr)', 'kr', p => p.skillnadKr], ['Skillnad (%)', 'pct', p => p.skillnadPct]],
    individ: [['BAS-intervall', 'text', r => r.bas], ['AID-kod', 'text', r => r.aid], ['Yrkesgrupp', 'text', r => r.yrke], ['Antal kvinnor', 'antal', r => r.nKv], ['Antal män', 'antal', r => r.nMa],
              ['Analys genomförd', 'text', () => ''], ['Resultat', 'text', () => '']]
};
/** Noten om grupperna under golvet: namn och antal, inga löner. '' när alla grupper har en rad. */
function _aidbasSmaNot(sma, golv) {
    if (!sma.length) return '';
    return `Grupper med färre än ${golv} personer redovisas inte som egen rad (${sma.length}): ${sma.map(s => `${s.aid} ${s.yrke} · BAS ${s.bas} (${s.nKv} kvinnor, ${s.nMa} män)`).join('; ')}.`;
}
/** Sammanfattningen per BAS-intervall som en mening per intervall, för skärmen. */
function _aidbasSammanfattningText(s) {
    return `BAS ${s.bas}: kvinnodominerade grupper (${s.antalKvDom}) har medianlön ${svTal(s.kvDom.lagst, 0)}–${svTal(s.kvDom.hogst, 0)} kr, övriga (${s.antalOvriga}) ${svTal(s.ovriga.lagst, 0)}–${svTal(s.ovriga.hogst, 0)} kr; `
        + `högsta median övriga mot högsta kvinnodominerad: ${s.skillnadKr >= 0 ? '+' : '−'}${svTal(Math.abs(s.skillnadKr), 0)} kr (${s.skillnadPct == null ? '–' : (s.skillnadPct >= 0 ? '+' : '−') + svPct(Math.abs(s.skillnadPct), 1)}).`;
}

// ---- Skärmen ----
function _aidbasCell(v, typ) {
    if (v == null || v === '') return '<td class="tal">–</td>';
    if (typ === 'text') return `<td>${esc(String(v))}</td>`;
    const text = typ === 'kr' ? `${svTal(v, 0)} kr` : typ === 'pct' ? svPct(v, 1) : typ === 'kvot' ? svTal(v, 2) : svTal(v, 0);
    // Sorteringsvärdet avrundas: ett tal med många decimaler kan av en slump innehålla en lön som siffersekvens.
    return `<td class="tal" data-sort-value="${typeof v === 'number' ? Math.round(v * 100) / 100 : ''}">${text}</td>`;
}
/**
 * En tabell på skärmen: lönemånad, kolumnerna, raderna och noten; sortering och Kopiera/CSV som övriga tabeller.
 * @param {string} id
 * @param {Array<[string, string, (r: any) => any]>} kolumner
 * @param {any[]} rader
 * @param {{not?: string, tom?: string, fil?: string}} [val]
 */
function _aidbasTabellHtml(id, kolumner, rader, { not = '', tom = 'Inga grupper att visa.', fil = id } = {}) {
    const kropp = rader.length ? rader.map(r => `<tr>${kolumner.map(([, typ, f]) => _aidbasCell(f(r), typ)).join('')}</tr>`).join('') : '';
    return `<p class="text-dampad-sm marg-0-0-6"><strong>${esc(lonemanadText())}</strong></p>`
        + (rader.length ? `<div class="table-container"><table id="${id}" class="data-table" data-aidbas-fil="${esc(fil)}"><thead><tr>${kolumner.map(([namn, typ]) => `<th${typ === 'text' ? '' : ' class="tal"'}>${esc(namn)}</th>`).join('')}</tr></thead><tbody>${kropp}</tbody></table></div>`
                        : `<p class="text-dampad-sm">${esc(tom)}</p>`)
        + (not ? `<p class="text-dampad-xs marg-8-0-0">${esc(not)}</p>` : '');
}
function _aidbasEfter(id) {
    if (!document.getElementById(id)) return;
    if (typeof enableTableSort === 'function') enableTableSort(id);
    if (typeof addTableExportTools === 'function') addTableExportTools(id, document.getElementById(id)?.getAttribute('data-aidbas-fil') || id);
}
function _aidbasNyckel(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

/** Lika arbete: tabell 1 och arbetslistan (tabell 4). */
function renderAidBasLika() {
    const lika = document.getElementById('aidbas-lika'), individ = document.getElementById('aidbas-individ');
    if (!lika || !individ) return;
    const d = getData();
    if (!d.length) { lika.innerHTML = ''; individ.innerHTML = ''; _aidbasNyckel('nyckel-la-aidbas', ''); _aidbasNyckel('nyckel-la-individ', ''); return; }
    const t = aidbasTabeller(d);
    lika.innerHTML = _aidbasTabellHtml('aidbas-lika-tabell', AIDBAS_KOL.lika, t.lika.rader, { not: _aidbasSmaNot(t.lika.sma, t.golv), fil: 'lika_arbete_aid_bas' })
        + `<p class="text-dampad-xs marg-8-0-0">Medianer, kvot och gränser bara när varje kön har minst ${t.k} personer; annars <em>Analyseras på individnivå</em>. Gränserna är de 95-procentiga för slumpen vid gruppens storlek och könsfördelning, räknade med omkastning av könen inom gruppen som i trattdiagrammet.</p>`;
    _aidbasEfter('aidbas-lika-tabell');
    const ute = t.lika.rader.filter(r => r.bedomning === 'Utanför gränserna').length, bedomda = t.lika.rader.filter(r => r.bedomning !== 'Analyseras på individnivå').length;
    _aidbasNyckel('nyckel-la-aidbas', t.lika.rader.length ? `${t.lika.rader.length} grupper · ${ute} av ${bedomda} utanför gränserna` : '');
    individ.innerHTML = _aidbasTabellHtml('aidbas-individ-tabell', AIDBAS_KOL.individ, t.individ.rader, { not: _aidbasSmaNot(t.individ.sma, t.golv), tom: `Alla grupper har minst ${t.k} kvinnor och ${t.k} män.`, fil: 'analys_pa_individniva' });
    _aidbasEfter('aidbas-individ-tabell');
    _aidbasNyckel('nyckel-la-individ', t.individ.rader.length ? `${t.individ.rader.length} grupper` : '');
}
/** Likvärdigt arbete: tabell 2 med sammanfattningen, och den hierarkiska jämförelsen (tabell 3). */
function renderAidBasLikvardigt() {
    const lv = document.getElementById('aidbas-likvardigt'), hi = document.getElementById('aidbas-hierarki');
    if (!lv || !hi) return;
    const d = getData();
    if (!d.length) { lv.innerHTML = ''; hi.innerHTML = ''; _aidbasNyckel('nyckel-lv-aidbas', ''); _aidbasNyckel('nyckel-lv-hierarki', ''); return; }
    const t = aidbasTabeller(d);
    const def = `Kvinnodominerad enligt ${aidbasDefinitionText()}; mansdominerad med samma gräns för män; övriga könsblandade. "Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt (${skrKallaKort()}) med samma definition.`;
    lv.innerHTML = _aidbasTabellHtml('aidbas-likvardigt-tabell', AIDBAS_KOL.likvardigt, t.likvardigt.rader, { not: _aidbasSmaNot(t.likvardigt.sma, t.golv), fil: 'likvardigt_arbete' })
        + `<p class="text-dampad-xs marg-8-0-0">${esc(def)} Medianlön och lönespridning ((P90 − P10) / median) bara för grupper med minst ${t.k} personer.</p>`
        + (t.likvardigt.sammanfattning.length ? `<h3 class="fs-md marg-14-0-4">Sammanfattning per BAS-intervall</h3><ul class="text-dampad-sm">${t.likvardigt.sammanfattning.map(s => `<li>${esc(_aidbasSammanfattningText(s))}</li>`).join('')}</ul>`
                                               : `<p class="text-dampad-xs marg-8-0-0">Inget BAS-intervall har både kvinnodominerade grupper och andra grupper med minst ${t.k} personer, så det finns ingen sammanfattning.</p>`);
    _aidbasEfter('aidbas-likvardigt-tabell');
    const kvDom = t.likvardigt.rader.filter(r => r.klass === _aidbasKlassNamn().kv).length;
    _aidbasNyckel('nyckel-lv-aidbas', t.likvardigt.rader.length ? `${t.likvardigt.rader.length} grupper · ${kvDom} kvinnodominerade (${_aidbasDefinitionNamn(t.definition)})` : '');
    hi.innerHTML = _aidbasTabellHtml('aidbas-hierarki-tabell', AIDBAS_KOL.par, t.par, { tom: _aidbasIngaParText(), fil: 'hierarkisk_jamforelse' })
        + `<p class="text-dampad-xs marg-8-0-0">Kvinnodominerad enligt ${esc(aidbasDefinitionText())}. Båda grupperna har minst ${t.k} personer. BAS-ordningen är bokstavsordningen.</p>`;
    _aidbasEfter('aidbas-hierarki-tabell');
    _aidbasNyckel('nyckel-lv-hierarki', t.par.length ? `${t.par.length} par` : 'inga par');
}

// ---- Excel: fyra blad, ett per tabell. Tal som tal med svenskt talformat i cellen; procent med en decimal. ----
const AIDBAS_TALFORMAT = { antal: '#,##0', kr: '#,##0', pct: '#,##0.0', kvot: '0.00' };
function _aidbasVarde(v, typ) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
    if (typ === 'text') return String(v);
    return typ === 'pct' ? Math.round(v * 10) / 10 : typ === 'kvot' ? Math.round(v * 100) / 100 : Math.round(v);
}
/**
 * Ett blad: rubrik, lönemånad, eventuella inledande rader, kolumnerna, raderna (eller en tom-text) och noter.
 * @param {string} rubrik
 * @param {Array<[string, string, (r: any) => any]>} kolumner
 * @param {any[]} rader
 * @param {{fore?: string[], efter?: string[], tom?: string}} [val]
 */
function _aidbasBlad(rubrik, kolumner, rader, { fore = [], efter = [], tom = '' } = {}) {
    /** @type {any[][]} */
    const rows = [[rubrik], [lonemanadText()], ...fore.map(t => [t]), []];
    const forstaRad = rows.length + 1;   // 1-baserat radnummer för första dataraden
    rows.push(kolumner.map(([namn]) => namn));
    if (rader.length) rader.forEach(r => rows.push(kolumner.map(([, typ, f]) => _aidbasVarde(f(r), typ))));
    else if (tom) rows.push([tom]);
    for (const t of efter) if (t) rows.push([], [t]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (rader.length) {
        kolumner.forEach(([, typ], c) => {
            const z = AIDBAS_TALFORMAT[typ];
            if (!z) return;
            for (let r = 0; r < rader.length; r++) { const cell = ws[XLSX.utils.encode_cell({ c, r: forstaRad + r })]; if (cell && typeof cell.v === 'number') cell.z = z; }
        });
    }
    ws['!cols'] = kolumner.map(([namn, typ]) => ({ wch: typ === 'text' ? Math.max(14, Math.min(44, namn.length + 4)) : Math.max(10, namn.length + 2) }));
    return ws;
}
/** Bladens namn i ordning, som förhandsbeskedet och arbetsboken delar. */
const AIDBAS_BLADNAMN = ['Lika arbete AID x BAS', 'Likvärdigt arbete', 'Hierarkisk jämförelse', 'Analys på individnivå'];
/** @returns {[string, any][]} bladets namn och kalkylblad */
function _aidbasExcelBlad() {
    const d = getData();
    if (!d.length) return [];
    const t = aidbasTabeller(d);
    const def = `Kvinnodominerad enligt ${aidbasDefinitionText()}; mansdominerad med samma gräns för män; övriga könsblandade.`;
    const lika = _aidbasBlad('Lika arbete: kvinnors medianlön i procent av mäns per AID-kod och BAS-intervall', AIDBAS_KOL.lika, t.lika.rader,
        { fore: [`Medianer, kvot och gränser bara när varje kön har minst ${t.k} personer; annars "Analyseras på individnivå". Gränserna är de 95-procentiga för slumpen vid gruppens storlek och könsfördelning (omkastning av könen inom gruppen, som trattdiagrammet).`],
          efter: [_aidbasSmaNot(t.lika.sma, t.golv)], tom: 'Inga grupper att visa.' });
    const lv = _aidbasBlad('Likvärdigt arbete: grupperna per BAS-intervall', AIDBAS_KOL.likvardigt, t.likvardigt.rader,
        { fore: [def, `"Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt (${skrKallaKort()}) med samma definition. Medianlön och lönespridning ((P90 − P10) / median) bara för grupper med minst ${t.k} personer.`],
          efter: [_aidbasSmaNot(t.likvardigt.sma, t.golv)], tom: 'Inga grupper att visa.' });
    // Sammanfattningen per BAS-intervall under tabellen i samma blad.
    const s = t.likvardigt.sammanfattning;
    const rad0 = XLSX.utils.decode_range(lv['!ref']).e.r + 3;
    XLSX.utils.sheet_add_aoa(lv, [['Sammanfattning per BAS-intervall: högsta och lägsta medianlön bland kvinnodominerade grupper och bland övriga; skillnaden är högsta median övriga mot högsta kvinnodominerad.'],
        ...(s.length ? [AIDBAS_KOL.sammanfattning.map(([namn]) => namn), ...s.map(x => AIDBAS_KOL.sammanfattning.map(([, typ, f]) => _aidbasVarde(f(x), typ)))]
                     : [[`Inget BAS-intervall har både kvinnodominerade grupper och andra grupper med minst ${t.k} personer.`]])], { origin: rad0 });
    if (s.length) AIDBAS_KOL.sammanfattning.forEach(([, typ], c) => { const z = AIDBAS_TALFORMAT[typ]; if (!z) return;
        for (let r = 0; r < s.length; r++) { const cell = lv[XLSX.utils.encode_cell({ c, r: rad0 + 2 + r })]; if (cell && typeof cell.v === 'number') cell.z = z; } });
    const par = _aidbasBlad('Hierarkisk jämförelse: lägre värderat arbete som inte är kvinnodominerat med högre lön än kvinnodominerat arbete på högre nivå', AIDBAS_KOL.par, t.par,
        { fore: [`${def} Båda grupperna har minst ${t.k} personer. BAS-ordningen är bokstavsordningen.`], tom: _aidbasIngaParText() });
    const individ = _aidbasBlad('Analys på individnivå: grupper där något kön har färre än ' + t.k + ' personer', AIDBAS_KOL.individ, t.individ.rader,
        { fore: ['Arbetslista utan löner. Fyll i kolumnerna Analys genomförd och Resultat.'], efter: [_aidbasSmaNot(t.individ.sma, t.golv)], tom: `Alla grupper har minst ${t.k} kvinnor och ${t.k} män.` });
    return [[AIDBAS_BLADNAMN[0], lika], [AIDBAS_BLADNAMN[1], lv], [AIDBAS_BLADNAMN[2], par], [AIDBAS_BLADNAMN[3], individ]];
}
/** Raderna om tabellerna för bladen Metodik och Metod & parametrar: [rubrik, text]. */
function _aidbasMetodRader() {
    const k = aidbasK(), golv = kTroskel() > K_SKARM ? LITET_UNDERLAG : 1;
    return [
        ['Tabellerna per AID-kod och BAS-intervall', `Bladen ${AIDBAS_BLADNAMN.join(', ')} grupperar varje person på AID-kod och BAS-intervall ur personens egen rad: lika arbete är samma yrkesgrupp på samma nivå, och en yrkesgrupp i flera intervall får en rad per intervall. ${lonemanadText()}.`],
        ['Små grupper i tabellerna per AID och BAS', `Grupper med färre än ${golv} personer får ingen egen rad utan räknas upp i en not under tabellen med namn och antal. Ett köns median, kvoten och gränserna redovisas bara när varje kön har minst ${k} personer; gruppens median och lönespridning bara när gruppen har minst ${k} personer. Arbetslistan Analys på individnivå tar upp grupperna där något kön är mindre än ${k}, utan löner.`],
        ['Gränser för slumpen (Lika arbete AID x BAS, Slumpens gränser)', 'Kvinnors median i procent av mäns jämförs med de mittersta 95 procenten av de kvoter slumpen ger när könen kastas om slumpvis mellan gruppens löner 1 000 gånger (för grupper över 300 personer en normalapproximation med gruppens egen spridning). Gränserna gäller gruppens egna löner, antal och könsfördelning. En kvot utanför gränserna är svår att förklara med slumpen; gränserna är ett stöd för bedömningen, inte ett test som friar eller fäller.'],
        ['Kvinnodominerat arbete (Likvärdigt arbete, Hierarkisk jämförelse)', `${aidbasDefinitionText()}. Mansdominerad med samma gräns för män; övriga könsblandade. "Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt i yrket (${skrKallaKort()}) med samma definition — lagen gäller arbete som är eller brukar anses vara kvinnodominerat. Lönespridning = (P90 − P10) / median. Den hierarkiska jämförelsen listar par där en grupp som inte är kvinnodominerad har lägre BAS-intervall och högre median än en kvinnodominerad grupp; BAS-ordningen är bokstavsordningen.`]
    ];
}
