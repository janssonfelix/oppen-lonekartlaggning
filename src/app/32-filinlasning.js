// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- File Upload: Struktur CSV ----
// Radnummer i källfilen (Excel-numrering) på varje rårad — en Symbol, så att
// PII-detektorn och getField inte ser den som en kolumn.
const _RADNR = Symbol('radnr');
const dataInput  = document.getElementById("file-input-data");
const dataStatus = /** @type {HTMLElement} */ (document.getElementById("data-status"));

function setupDrop(dropId, inputId) {
    const drop = document.getElementById(dropId);
    const inp  = document.getElementById(inputId);
    if (!drop || !inp) return;
    // Input-elementet ligger INNE i drop-arean (HTML-struktur).
    // När användaren klickar på inputen triggar webbläsaren native fil-dialog,
    // OCH klicket bubblar upp till drop-arean som anropar inp.click() igen →
    // två dialoger öppnas. Därför: bortse från klick som har inputen som mål
    // (eller bubblar genom inputen) — då hanterar webbläsaren själv dialogen.
    drop.addEventListener("click", e => {
        if (e.target === inp || (inp.contains && inp.contains(/** @type {Node} */ (e.target)))) return;
        inp.click();
    });
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
    drop.addEventListener("drop", e => {
        e.preventDefault(); drop.classList.remove("drag-over");
        if (/** @type {DataTransfer} */ (e.dataTransfer).files.length) { /** @type {HTMLInputElement} */ (inp).files = /** @type {DataTransfer} */ (e.dataTransfer).files; inp.dispatchEvent(new Event("change")); }
    });
}
setupDrop("drop-area-data", "file-input-data");
setupDrop("drop-area-policy", "file-input-policy");
setupDrop("drop-area-stat", "file-input-stat");

/**
 * Visar GDPR-avvisning i UI:t när detectSensitiveColumns flaggat känsliga fält.
 * @param {Array<{col:string, reason:string}>} sensitive
 */
function _renderSensitiveRejection(sensitive) {
    const list = sensitive.map(s => `<li><code>${esc(s.col)}</code> – ${esc(s.reason)}</li>`).join('');
    dataStatus.innerHTML = `<div class="bak-varning-bg-gammal ram-v-4-danger rund-6 lh-1_55 marg-t-10 pad-14-16">
        <strong class="f-kritisk">${ikon('stopp')} Filen avvisad – innehåller känsliga personuppgifter</strong><br>
        Följande kolumner verkar innehålla data som inte ska användas i lönekartläggning:
        <ul class="fs-sm marg-8-0-8-20">${list}</ul>
        <span class="text-dampad-sm">Ta bort kolumnerna i filen och försök igen. Verktyget kräver endast: BAS-intervall, AID, månadslön, ålder och kön. Identifierare (personnummer, namn, e-post) och särskilda kategorier av personuppgifter (fackmedlemskap, hälsa med mera) ska inte ingå i uttaget.</span>
    </div>`;
    dataStatus.className = "status-msg";
}

/**
 * Kör alla UI-uppdateringar som hör till en lyckad strukturdataladdning.
 * Bröts ut för att kunna delas mellan streaming-completion och testdata-injektion.
 */
// Arbetsvärdering (poäng) härleds ur strukturdatans valfria Poäng-kolumn —
// en del av samma fil som BAS, INTE en separat uppladdning. Bygger samma
// interna struktur som § 3:10-motorn alltid använt: Map "aid|bas" → poäng.
// Returnerar antal befattningar med poäng (0 = ingen kolumn → BAS-rank-proxy).
function _deriveArbetsvarderingFromData() {
    const byKey = new Map();
    let count = 0;
    for (const r of state.data) {
        if (r.poang == null || !isFinite(r.poang)) continue;
        const aid = (r.aid || r.yrke || '').toString().trim();
        if (!aid || !r.bas) continue;
        const key = aid + '|' + r.bas;
        if (!byKey.has(key)) { byKey.set(key, r.poang); count++; }
    }
    state.arbetsvardering = count > 0 ? { byKey, count, hasBas: true } : null;
    if (state.likvardighet) state.likvardighet.result = null;   // tvinga omberäkning
    return count;
}

function _afterDataLoaded() {
    // En riktig lönefil efter demot: demots namn, organisationstyp och ställningstagande
    // hör till den påhittade organisationen och tas bort (ADR-36).
    if (state.isDemo) {
        state.profile = { ...DEFAULT_PROFILE };
        if (state.policyKalla === 'demo') {
            aterstallReferens();
            resetUploadCell('upload-cell-policy', 'upload-cell optional', 'Valfritt');
        }
        if (typeof synkaNamnFalt === 'function') synkaNamnFalt();
        if (typeof _synkaOrgTyp === 'function') _synkaOrgTyp();
        applyProfileLabels();
        if (typeof renderReferensKort === 'function') renderReferensKort();
    }
    state.isDemo = false;   // #9: verklig uppladdning lämnar demoläge
    if (typeof _renderDemoBanner === 'function') _renderDemoBanner();
    /** @type {HTMLElement} */ (document.getElementById("dashboard-summary")).style.display = "grid";
    const poangCount = _deriveArbetsvarderingFromData();
    unlockTabs();
    updateDashboardStats();
    populateSelects();
    generateRapport();
    const bas = getBasIntervals();
    dataStatus.textContent = `${state.data.length} rader · ${bas.length} BAS`;
    if (poangCount > 0) dataStatus.textContent += ` · arbetsvärdering: ${poangCount} befattningar (poäng som krav-proxy i likvärdighetsanalysen)`;
    dataStatus.className = "status-msg success";
    markUploadLoaded('upload-cell-data', 'Inläst');
    updateCompliance();
    renderUnderlagetsKvalitet();
    renderProcessTracker();
    updateGdprBanner();
    // Starta inaktivitetstimern (på som standard, kan stängas av)
    if (typeof _resetInactivityTimer === 'function') _resetInactivityTimer();
    renderConsistencyBanner();
    renderOutliers();
    renderRealityCheck();
    renderDataValidationReport();
    syncDatakvalitetPanel();
    announceToScreenReader(`Datafil inläst: ${state.data.length} personer i ${getBasIntervals().length} BAS-intervall. Analyserna är nu tillgängliga i menyn.`);
    hideLoading();

    // Bootstrap-CI, åtgärdslista och skevhet tar merparten av inläsningstiden
    // vid stora underlag. De körs EFTER att gränssnittet målats (deferrade i två steg så
    // statusnotisen hinner synas). Flikbesök renderar ändå on-demand via
    // renderTabContent, och exporterna self-heal:ar (se exportAllToExcel).
    const DEFER_NOTE = ' · förbereder analyser i bakgrunden…';
    setTimeout(() => {
        if (dataStatus) dataStatus.textContent += DEFER_NOTE;
        setTimeout(() => {
            try {
                generateSkevhet();
                renderKon("__ALLA__");
                computeBootstrapCI();
                renderActionChecklist();
            } finally {
                if (dataStatus) dataStatus.textContent = dataStatus.textContent.replace(DEFER_NOTE, '');
            }
        }, 50);
    }, 0);
}

// ---- CSV-mall: nedladdning ----
// Genererar en tom CSV med rätt headers + 3 exempelrader så förstagångsanvändare
// inte behöver gissa kolumnnamn. Innehåller ingen riktig data — bara mall.
document.getElementById('btn-download-csv-template')?.addEventListener('click', () => {
    // Poang är valfri: arbetsvärderingspoäng per befattning (krav-proxy i § 3:10).
    // Lämnas tom om ingen arbetsvärdering gjorts — BAS-rank används då.
    const headers = ['BAS-intervall', 'AID', 'Manadslon', 'Alder', 'Kon', 'Poang'];
    const examples = [
        ['E', '101011 Ledning, ekonomi',         '52000', '47', 'Kvinna', '480'],
        ['D', '152012 Administrator personal/HR', '34500', '38', 'Man',    '350'],
        ['C', '207009 Underskoterska, hemtjanst', '29800', '54', 'Kvinna', '']
    ];
    // Använd semikolon-separator (svensk Excel-default), CRLF radslut
    const csv = [headers, ...examples].map(row =>
        row.map(cell => {
            const s = String(cell);
            // Citera om cellen innehåller separator, citationstecken eller radslut
            return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(';')
    ).join('\r\n');

    // UTF-8 BOM så Excel öppnar med korrekt encoding
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'strukturdata_mall.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    announceToScreenReader('CSV-mall nedladdad: strukturdata_mall.csv');
});

// #2: Robust CSV-inläsning. Excel-exporterad CSV är ofta Windows-1252 (inte
// UTF-8) och ibland kommaseparerad. Vi detekterar teckenkodning och avgränsare
// LOKALT (TextDecoder i webbläsaren, inga nätverksanrop) innan parsning så att
// å/ä/ö inte mojibakar och raderna inte hamnar i en enda kolumn.
function _decodeCsvBuffer(buf) {
    const bytes = new Uint8Array(buf);
    // UTF-16 (Excels "Unicode-text" sparar UTF-16LE med BOM, tab-avgränsat).
    // Utan denna kontroll faller UTF-16 igenom till Windows-1252 och blir
    // NUL-interfolierad rappakalja som parsern tuggar utan tydligt fel.
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return { text: new TextDecoder('utf-16le').decode(buf).replace(/^﻿/, ''), encoding: 'UTF-16 LE' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return { text: new TextDecoder('utf-16be').decode(buf).replace(/^﻿/, ''), encoding: 'UTF-16 BE' };
    }
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        return { text: new TextDecoder('utf-8').decode(buf), encoding: 'UTF-8 (BOM)' };
    }
    try {
        // Strikt UTF-8: kastar om byten inte är giltig UTF-8 (typiskt Windows-1252-åäö).
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'UTF-8' };
    } catch (_e) {
        try {
            return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'Windows-1252' };
        } catch (_e2) {
            return { text: new TextDecoder('utf-8').decode(buf), encoding: 'UTF-8 (osäker)' };
        }
    }
}

/**
 * Identifierar filformat via magiska bytes (accept-attributet är bara rådgivande
 * — användare kan välja "Alla filer" och lägga en Excel-fil i en CSV-ruta).
 *   - "xlsx"       : ZIP-container (PK..) — .xlsx
 *   - "xls-legacy" : OLE2-container — gammalt .xls (stöds ej av mini-bygget)
 *   - "text"       : allt annat — behandlas som CSV/text
 * @param {Uint8Array} bytes
 * @returns {'xlsx'|'xls-legacy'|'text'}
 */
function _sniffTabularFormat(bytes) {
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B &&
        (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) return 'xlsx';
    if (bytes.length >= 4 && bytes[0] === 0xD0 && bytes[1] === 0xCF &&
        bytes[2] === 0x11 && bytes[3] === 0xE0) return 'xls-legacy';
    return 'text';
}
// Radslut: CRLF, LF eller bara CR (gamla Mac-filer) — samma regel i alla steg.
const _RADSLUT = /\r\n|\r|\n/;

function _detectDelimiter(text) {
    const firstLine = (text.split(_RADSLUT).find(l => l.trim().length) || '');
    let best = ';', bestN = 0;
    for (const d of [';', ',', '\t', '|']) {
        const n = firstLine.split(d).length - 1;
        if (n > bestN) { bestN = n; best = d; }
    }
    return bestN > 0 ? best : ';';
}

/**
 * Hittar rubrikraden i CSV-text och dess avgränsare. Exportverktyg lägger
 * ofta försättsrader före rubrikerna ("Rapport uttagen 2026-01-15;;;;"), och
 * de får inte tas för rubriker. Vi provar de
 * 15 första raderna × alla avgränsare och väljer den kombination som matchar
 * flest kända kolumnroller (synonymGroups = array av normaliserade substrängar
 * per roll, t.ex. Object.values(ALLOWED_FIELDS)).
 *
 * @param {string} text - Avkodad filtext.
 * @param {Array<Array<string>>} synonymGroups - En grupp synonymer per roll.
 * @param {number} [minHits=2] - Min antal roller som måste matcha.
 * @returns {{line:number, delim:string|null, hits:number}} line = 0-baserat radindex;
 *          vid ingen träff: line 0 + avgränsaren från _detectDelimiter.
 */
function _findCsvHeader(text, synonymGroups, minHits = 2) {
    const lines = text.split(_RADSLUT).slice(0, 15);
    /** @type {{line: number, delim: string|null, hits: number}} */
    let best = { line: 0, delim: null, hits: -1 };
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i] || !lines[i].trim()) continue;
        for (const d of [';', ',', '\t', '|']) {
            const cells = lines[i].split(d).map(c =>
                c.replace(/^"+|"+$/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (cells.length < 2) continue;
            let hits = 0;
            for (const group of synonymGroups) {
                if (group.some(syn => cells.some(c => c.includes(syn)))) hits++;
            }
            if (hits > best.hits) best = { line: i, delim: d, hits };
        }
    }
    if (best.hits >= minHits) return best;
    return { line: 0, delim: _detectDelimiter(text), hits: 0 };
}

/**
 * Läser första bladet i en XLSX-buffer till rad-objekt (samma form som
 * PapaParse header:true ger), med rubrikradssökning bland de 20 första raderna
 * (samma princip som _findCsvHeader — tål försättsrader i kalkylblad).
 * Cellvärden konverteras till strängar så resten av pipelinen (getField,
 * parseNumberStrict, detectSensitiveColumns) fungerar identiskt med CSV.
 *
 * @param {ArrayBuffer} buf
 * @param {Array<Array<string>>} synonymGroups - Som i _findCsvHeader.
 * @param {number} [minHits=2]
 * @returns {{headers:string[], rows:Array<Object<string,string>>, sheet:string}}
 * @throws {Error} om arbetsboken inte kan läsas eller saknar datarader.
 */
function _xlsxToObjects(buf, synonymGroups, minHits = 2) {
    if (typeof XLSX === 'undefined') throw new Error('Excel-biblioteket kunde inte laddas.');
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
    const startRad = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0;
    if (!grid.length) throw new Error('Excel-bladet är tomt.');
    // Rubrikradssökning (max 20 rader)
    let hdrIdx = 0, bestHits = -1;
    for (let i = 0; i < Math.min(20, grid.length); i++) {
        const cells = (grid[i] || []).map(c =>
            String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''));
        let hits = 0;
        for (const group of synonymGroups) {
            if (group.some(syn => cells.some(c => c.includes(syn)))) hits++;
        }
        if (hits > bestHits) { bestHits = hits; hdrIdx = i; }
        if (hits >= synonymGroups.length) break;   // full träff — sluta leta
    }
    if (bestHits < minHits) hdrIdx = 0;            // fallback: första raden
    const headers = (grid[hdrIdx] || []).map(h => String(h ?? '').trim());
    const rows = [];
    for (let i = hdrIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        if (!r || !r.length) continue;
        const obj = {};
        let hasValue = false;
        headers.forEach((h, c) => {
            if (!h) return;
            const v = r[c];
            const s = v == null ? '' : String(v);
            obj[h] = s;
            if (s.trim() !== '') hasValue = true;
        });
        obj[_RADNR] = startRad + i + 1;
        if (hasValue) rows.push(obj);
    }
    return { headers, rows, sheet: sheetName };
}

/**
 * Gemensam tabulär filläsning för uppladdningarna — CSV (alla kodningar,
 * preamble-tolerant, alla vanliga avgränsare) och Excel (.xlsx) via samma väg.
 * Callbacken får alltid ett resultatobjekt; ingen exception läcker ut.
 *
 * @param {File} file
 * @param {Array<Array<string>>} synonymGroups - Kolumnroller för rubrikradssökning.
 * @param {(res: {ok:true, format:string, encoding:string, headers:string[],
 *                rows:Array<Object<string,string>>}
 *             | {ok:false, error:string}) => void} callback
 */
function readTabularFile(file, synonymGroups, callback) {
    if (!file) { callback({ ok: false, error: 'Ingen fil vald.' }); return; }
    const reader = new FileReader();
    reader.onerror = () => callback({ ok: false, error: 'Kunde inte läsa filen.' });
    reader.onload = () => {
        try {
            const buf = reader.result;
            const fmt = _sniffTabularFormat(new Uint8Array(/** @type {ArrayBuffer} */ (buf)));
            if (fmt === 'xls-legacy') {
                callback({ ok: false, error: 'Filen är i äldre Excel-format (.xls). Spara om som .xlsx eller .csv och försök igen.' });
                return;
            }
            if (fmt === 'xlsx') {
                const x = _xlsxToObjects(/** @type {ArrayBuffer} */ (buf), synonymGroups);
                callback({ ok: true, format: `Excel (blad "${x.sheet}")`, encoding: 'XLSX', headers: x.headers, rows: x.rows });
                return;
            }
            const dec = _decodeCsvBuffer(buf);
            const hdr = _findCsvHeader(dec.text, synonymGroups);
            const csvText = hdr.line > 0
                ? dec.text.split(_RADSLUT).slice(hdr.line).join('\n')
                : dec.text;
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, delimiter: hdr.delim });
            const rows = (parsed.data || []).filter(r => r && typeof r === 'object');
            callback({
                ok: true,
                format: `CSV (avgränsare "${hdr.delim === '\t' ? 'TAB' : hdr.delim}"${hdr.line > 0 ? `, ${hdr.line} försättsrad${hdr.line > 1 ? 'er' : ''} överhoppad` : ''})`,
                encoding: dec.encoding,
                headers: parsed.meta && parsed.meta.fields ? parsed.meta.fields.slice() : [],
                rows
            });
        } catch (err) {
            callback({ ok: false, error: (err && err.message) ? err.message : 'Kunde inte tolka filen.' });
        }
    };
    reader.readAsArrayBuffer(file);
}

function loadStructureFile(file) {
    if (!file) return;
    // Behåll filreferensen (endast RAM) så "Tillämpa mappning & läs in igen"
    // alltid kan läsa om filen, även om filväljaren tömts. Nollas i clearAllData.
    // Kolumnmappningen läser om den senast inlästa filen, också en som inte gav några rader; den sätts i finishLoad.
    showLoading();
    let capturedHeaders = null;   // #11: rubriker för kolumnmappnings-guiden

    // GDPR Art. 25.2: minimal data resident i minnet under parsning.
    // Streaming step-mode → en rad i taget. Vi sparar de första 50 raderna
    // i en sample-buffer för att kunna köra detectSensitiveColumns (som behöver
    // sample för värdebaserad upptäckt). Efter detektering nollas bufferten
    // och rader processas direkt till `parsed[]` utan mellanlagring.
    const SAMPLE_SIZE = 50;
    /** @type {any[]|null} */
    let sampleBuffer = [];
    const parsed = [];
    // Graderad räkning — distinguerar tomma fält
    // (legitima avsaknader) från ogiltiga fält (text där siffra förväntas).
    // Parse-spårning: vi loggar
    // separat per-anledning-räknare + upp till 3 exempel per anledning så
    // HR kan se exakt vilka mönster som föll ut. Inga PII sparas — bara
    // det specifika cell-värdet i den problematiska kolumnen (lönesiffran
    // eller åldersträngen) och dess maxlängd är 24 tecken.
    /** @type {{[k: string]: any, invalidLonExamples: string[], invalidAlderExamples: string[], missingKonExamples: string[]}} */
    const parseStats = {
        totalRaw: 0,
        excludedNoBas: 0,
        excludedZeroLon: 0,
        excludedMissingKon: 0,    // rec.kon tomt eller okänt format
        invalidLon: 0,            // icke-tom men oparsbar lön
        invalidAlder: 0,          // icke-tom men oparsbar ålder
        invalidAlderUtesluten: 0, // varav rader som ändå uteslöts (räknas inte två gånger i fullständigheten)
        alderFromBirthYear: 0,    // ålder tolkad om från födelseår (transparens)
        invalidLonExamples: [],   // upp till 3 exempel för audit-panelen
        invalidAlderExamples: [], // upp till 3 exempel
        missingKonExamples: []    // upp till 3 exempel på okända kön-värden
    };
    let detectionDone = false;
    let aborted = false;

    // AID:s ansvarskod (ADR-33): kolumnen väljs på första raden och godkänns
    // i finishLoad när hela filen är läst (≥ 95 % giltiga värden). Bara kolumnens värden
    // sparas under inläsningen, för bedömningen.
    let ansvarBedomd = false;
    const ansvarVarden = [];
    // Ansvarskolumnen sätts redan på första raden (extractMinimalRecord behöver den). Fallerar
    // inläsningen efteråt ska den data som redan finns behålla sin kolumn.
    const tidigareAnsvarKolumn = state.ansvarKolumn;
    function processRow(row) {
        if (!ansvarBedomd) {
            ansvarBedomd = true;
            const kol = _hittaAnsvarKolumn(Object.keys(row || {}));
            state.ansvarKolumn = kol ? { namn: kol } : null;
        }
        if (state.ansvarKolumn) ansvarVarden.push(row[state.ansvarKolumn.namn]);
        /** @type {any} */
        const rec = extractMinimalRecord(row);
        // Trunkera exempel-värden för att undvika att en hel rad fastnar
        const truncEx = v => {
            if (v == null) return '(tom)';
            const s = String(v).trim();
            if (!s) return '(tom)';
            return s.length > 24 ? s.slice(0, 24) + '…' : s;
        };
        // Spåra invalid-värden innan kasering — användaren ska se vad som gick fel
        if (rec._lonStatus === 'invalid') {
            parseStats.invalidLon++;
            if (parseStats.invalidLonExamples.length < 3) {
                parseStats.invalidLonExamples.push(truncEx(getField(row, ALLOWED_FIELDS.lon, 'lon')));
            }
        }
        if (rec._alderStatus === 'invalid') {
            parseStats.invalidAlder++;
            if (parseStats.invalidAlderExamples.length < 3) {
                parseStats.invalidAlderExamples.push(truncEx(getField(row, ALLOWED_FIELDS.alder, 'alder')));
            }
        }
        // Transparens: ålderskolumnen innehöll födelseår som räknats om till ålder
        if (rec._alderStatus === 'birthyear') parseStats.alderFromBirthYear++;
        // Spåra rader utan användbart kön
        // (efter normalisering till lowercase utan icke-bokstäver).
        const konOk = typeof rec.kon === 'string' &&
                      (rec.kon.includes('kvinna') || rec.kon === 'man' || rec.kon === 'män');
        if (!konOk && parseStats.missingKonExamples.length < 3) {
            const rawKon = getField(row, ALLOWED_FIELDS.kon, 'kon');
            parseStats.missingKonExamples.push(truncEx(rawKon));
        }
        // Plocka bort spårningsfält innan state.data — Privacy by Design,
        // staten ska bara innehålla strikt minimerade fält
        const alderOgiltig = rec._alderStatus === 'invalid';
        delete rec._lonStatus;
        delete rec._alderStatus;
        const utesluts = () => { if (alderOgiltig) parseStats.invalidAlderUtesluten++; };
        if (!rec.bas)     { parseStats.excludedNoBas++; utesluts(); return; }
        if (rec.lon <= 0) { parseStats.excludedZeroLon++; utesluts(); return; }
        if (!konOk)       { parseStats.excludedMissingKon++; utesluts(); return; }
        rec.radnr = row[_RADNR] ?? null;
        parsed.push(rec);
    }

    function rejectFile(sensitive) {
        aborted = true;
        state.ansvarKolumn = tidigareAnsvarKolumn;
        // Nolla bufferten direkt så raw rows blir GC-bara
        sampleBuffer = null;
        hideLoading();
        _renderSensitiveRejection(sensitive);
    }

    // Gemensam avslutning för CSV- och XLSX-vägen: committa state + UI.
    function finishLoad(metaText) {
        sampleBuffer = null;
        let ansvarNot = '';
        if (state.ansvarKolumn) {
            const b = _bedomAnsvarKolumn(state.ansvarKolumn.namn, ansvarVarden);
            if (b.godkand) {
                state.ansvarKolumn = { namn: b.namn, giltiga: b.giltiga };
                const antal = g => parsed.filter(r => r.ansvarsgrupp === g).length;
                ansvarNot = ` · ansvarskod: ${antal('ledning')} med ledningsansvar, ${antal('uppdrag')} med särskilt uppdrag`;
                const ogiltiga = ansvarVarden.filter(v => String(v ?? '').trim() !== '' && _anTolka(v) === null).length;
                if (ogiltiga) ansvarNot += `; ${ogiltiga} ${ogiltiga === 1 ? 'ogiltigt värde räknades' : 'ogiltiga värden räknades'} som inget särskilt ansvar`;
            } else {
                parsed.forEach(r => { r.ansvarskoder = null; r.ansvarsgrupp = null; });
                ansvarNot = ` · ansvarskod: kolumnen "${b.namn}" lästes inte (${b.giltiga == null ? 'inga värden' : Math.round(b.giltiga * 100) + ' % giltiga värden'}, minst 95 % krävs)`;
                state.ansvarKolumn = null;
            }
        }
        ansvarVarden.length = 0;
        // En fil utan användbara rader är inte inläst: den får inte låsa upp flikarna eller ersätta ett underlag som
        // redan ligger inne. Filen och dess rubriker behålls så att kolumnmappningen kan läsa om den.
        // Saknas en obligatorisk kolumn men raderna går att läsa läses filen in, och kolumnmappningen säger vad som saknas.
        const saknas = (capturedHeaders || []).length ? _kolumnerSomSaknas(capturedHeaders) : [];
        if (!parsed.length) {
            state.ansvarKolumn = tidigareAnsvarKolumn;
            state._lastStructureFile = file;
            state._dataHeaders = capturedHeaders || [];
            _visaEjInlast(saknas, parseStats);
            return;
        }
        state.data = parsed;
        state._lastStructureFile = file;
        state.filnamn = { ...(state.filnamn || {}), data: file ? file.name : null };
        state.dataAudit = parseStats;
        state._dataHeaders = capturedHeaders || [];
        _afterDataLoaded();
        maybeShowColumnMapping();   // #11: visa guide om obligatoriska kolumner saknas
        // #2: redovisa detekterat format (transparens)
        if (dataStatus) {
            dataStatus.textContent += ` · ${metaText}${ansvarNot}`;
            if (parseStats.alderFromBirthYear > 0) {
                dataStatus.textContent += ` · ålder tolkad från födelseår (${parseStats.alderFromBirthYear} rader)`;
            }
        }
    }
    function failLoad(msg) {
        sampleBuffer = null;
        state.ansvarKolumn = tidigareAnsvarKolumn;
        hideLoading();
        dataStatus.textContent = msg;
        dataStatus.className = 'status-msg';
    }

    // Läs bytes → sniffa format (XLSX/legacy XLS/text) → parsa via rätt väg.
    let detectedEnc = 'UTF-8', detectedDelim = ';';
    const _csvReader = new FileReader();
    _csvReader.onerror = () => failLoad('Kunde inte läsa filen.');
    _csvReader.onload = () => {
      const buf = _csvReader.result;
      const fmt = _sniffTabularFormat(new Uint8Array(/** @type {ArrayBuffer} */ (buf)));
      if (fmt === 'xls-legacy') {
          failLoad('Filen är i äldre Excel-format (.xls). Spara om som .xlsx eller .csv och försök igen.');
          return;
      }
      if (fmt === 'xlsx') {
          // Excel-väg: hela bladet läses (kan inte strömmas), därefter exakt
          // samma pipeline som CSV — PII-detektering på sample, sedan processRow.
          let x;
          try { x = _xlsxToObjects(/** @type {ArrayBuffer} */ (buf), Object.values(ALLOWED_FIELDS)); }
          catch (err) { failLoad('Kunde inte läsa Excel-filen: ' + err.message); return; }
          capturedHeaders = x.headers.filter(h => h);
          parseStats.totalRaw = x.rows.length;
          const sensitive = detectSensitiveColumns(x.rows.slice(0, SAMPLE_SIZE));
          if (sensitive.length > 0) { rejectFile(sensitive); return; }
          x.rows.forEach(processRow);
          x.rows.length = 0;   // släpp raw rows (GDPR: minimera residens)
          finishLoad(`Excel (blad "${x.sheet}")`);
          return;
      }
      // Text-/CSV-väg: avkoda → hitta rubrikrad (preamble-tolerant) → strömma.
      const _dec = _decodeCsvBuffer(buf);
      detectedEnc = _dec.encoding;
      const hdrInfo = _findCsvHeader(_dec.text, Object.values(ALLOWED_FIELDS));
      detectedDelim = hdrInfo.delim || ';';
      // Filen delas i rader en gång: försättsraderna före rubriken tas bort, och filens
      // radnummer för varje datarad räknas ur samma rader. Papa hoppar över tomma rader
      // (skipEmptyLines), så listan byggs med samma regel. Citerade fält med
      // radbrytning förskjuter numreringen (accepterad begränsning, ADR-23).
      const linjer = _dec.text.split(_RADSLUT).slice(hdrInfo.line);
      const csvText = linjer.join('\n');
      const radLista = [];
      for (let j = 1; j < linjer.length; j++) if (linjer[j] !== '') radLista.push(hdrInfo.line + j + 1);
      let radIdx = 0;
      Papa.parse(csvText, {
        header: true, skipEmptyLines: true, delimiter: detectedDelim,
        step: (results, parser) => {
            if (aborted) return;
            if (!capturedHeaders && results.meta && results.meta.fields) capturedHeaders = results.meta.fields.slice();
            if (results.data) results.data[_RADNR] = radLista[radIdx++] ?? null;
            parseStats.totalRaw++;
            if (!detectionDone && sampleBuffer) {
                sampleBuffer.push(results.data);
                if (sampleBuffer.length >= SAMPLE_SIZE) {
                    const sensitive = detectSensitiveColumns(sampleBuffer);
                    if (sensitive.length > 0) {
                        parser.abort();
                        rejectFile(sensitive);
                        return;
                    }
                    detectionDone = true;
                    sampleBuffer.forEach(processRow);
                    sampleBuffer.length = 0; // släpp raw rows
                }
            } else {
                processRow(results.data);
            }
            // Defensivt: nolla referensen i results-objektet så PapaParse
            // inte kan retain'a raden i sin interna struktur.
            results.data = null;
        },
        complete: () => {
            if (aborted) return;
            // Edge-case: filen hade < SAMPLE_SIZE rader → kör detektion på det vi har
            if (!detectionDone && sampleBuffer && sampleBuffer.length > 0) {
                const sensitive = detectSensitiveColumns(sampleBuffer);
                if (sensitive.length > 0) {
                    rejectFile(sensitive);
                    return;
                }
                sampleBuffer.forEach(processRow);
                sampleBuffer.length = 0;
            }
            const preambleNote = hdrInfo.line > 0 ? ` · ${hdrInfo.line} försättsrad${hdrInfo.line > 1 ? 'er' : ''} överhoppad` : '';
            finishLoad(`${detectedEnc} · avgränsare "${detectedDelim === '\t' ? 'TAB' : detectedDelim}"${preambleNote}`);
        },
        error: () => failLoad('Fel vid CSV-parsning. Kontrollera filen.')
      });
    };
    _csvReader.readAsArrayBuffer(file);
}
/** @type {HTMLElement} */ (dataInput).addEventListener("change", e => loadStructureFile(/** @type {HTMLInputElement} */ (e.target).files?.[0]));

// #11: Kolumnmappnings-guide. Visas efter inläsning om en obligatorisk roll
// inte kunde auto-matchas mot någon CSV-rubrik (olika personalsystem döper
// kolumner olika). Låter användaren peka ut rätt kolumn och läsa in igen.
const COLMAP_ROLES = [
    { role: 'bas',    label: 'BAS-intervall', required: true },
    { role: 'yrke',   label: 'Yrke / AID', required: true },
    { role: 'lon',    label: 'Månadslön', required: true },
    { role: 'alder',  label: 'Ålder', required: true },
    { role: 'kon',    label: 'Kön', required: true },
    { role: 'poang',  label: 'Arbetsvärdering (poäng)', required: false },
    { role: 'ansvar', label: 'Ansvarskod (AID)', required: false }
];
/** Vilka värden kolumnmappningen har för varje roll: det användaren valt, annars det som känns igen i rubrikerna. */
function _kolumnval(headers) {
    const auto = autoDetectColumnMap(headers), eff = {};
    COLMAP_ROLES.forEach(({ role }) => {
        const vald = state.columnMap && state.columnMap[role];   // en vald rubrik gäller bara om filen har den
        eff[role] = role === 'ansvar' && state.columnMap?.ansvar === '' ? '' : (vald && headers.includes(vald) ? vald : '') || auto[role] || '';
    });
    return { auto, eff };
}
/** De obligatoriska roller som ingen rubrik i filen svarar mot. */
function _kolumnerSomSaknas(headers) {
    const { eff } = _kolumnval(headers);
    return COLMAP_ROLES.filter(r => r.required && !eff[r.role]);
}
/**
 * Filen gav inget underlag: obligatoriska kolumner känns inte igen, eller ingen rad gick att använda. Filkortet säger
 * det i varningsfärg, flikarna låses inte upp, och kolumnmappningen rullas in i bild med fokus i första fältet som
 * saknar kolumn.
 */
function _visaEjInlast(saknas, stats) {
    hideLoading();
    const harUnderlag = state.data.length > 0;
    const skal = [];
    if (saknas.length) skal.push(`filens rubriker kändes inte igen (${saknas.map(m => m.label).join(', ')} saknas)`);
    else {
        const n = (antal, text) => { if (antal) skal.push(`${antal} ${antal === 1 ? 'rad' : 'rader'} ${text}`); };
        n(stats.excludedNoBas, 'utan BAS-intervall');
        n(stats.excludedZeroLon, 'utan lön');
        n(stats.excludedMissingKon, 'utan kön');
        if (!skal.length) skal.push('filen har inga rader');
    }
    dataStatus.textContent = `Inga rader lästes in: ${skal.join(', ')}.`
        + (saknas.length ? ' Peka ut kolumnerna i kolumnmappningen nedan.' : '')
        + (harUnderlag ? ' Det tidigare inlästa underlaget ligger kvar.' : '');
    dataStatus.className = 'status-msg warning';
    if (!harUnderlag) {
        const badge = document.querySelector('#upload-cell-data .upload-badge');
        if (badge) {
            badge.classList.remove('required', 'optional', 'loaded');
            badge.classList.add('varning');
            badge.textContent = saknas.length ? 'Kolumnmappning behövs' : 'Inga rader lästa';
        }
    }
    maybeShowColumnMapping();
    _visaKolumnmappning();
    announceToScreenReader(dataStatus.textContent);
}
/** Fäller ut kolumnmappningen, rullar den in i bild och sätter fokus i första fältet som saknar kolumn. */
function _visaKolumnmappning() {
    const panel = document.getElementById('column-map-panel');
    if (!panel) return;
    panel.querySelector('details')?.setAttribute('open', '');
    panel.scrollIntoView?.({ block: 'center' });
    /** @type {HTMLInputElement} */ ((panel.querySelector('select.colmap-saknas') || panel.querySelector('select')))?.focus?.({ preventScroll: true });
}
function maybeShowColumnMapping() {
    const headers = state._dataHeaders || [];
    let panel = document.getElementById('column-map-panel');
    const row = document.getElementById('upload-row');
    if (!panel && row && row.parentNode) {
        panel = document.createElement('div');
        panel.id = 'column-map-panel';
        panel.style.marginTop = '12px';
        row.parentNode.insertBefore(panel, row.nextSibling);
    }
    if (!panel) return;
    if (!headers.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }

    const esc2 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const { auto, eff } = _kolumnval(headers);
    const missing = COLMAP_ROLES.filter(r => r.required && !eff[r.role]);

    const selects = COLMAP_ROLES.map(({ role, label, required }) => {
        const opts = ['<option value="">— ingen —</option>']
            .concat(headers.map(h => `<option value="${esc2(h)}"${eff[role] === h ? ' selected' : ''}>${esc2(h)}</option>`))
            .join('');
        const saknas = required && !eff[role];
        return `<label class="faltkolumn">
            <span>${esc2(label)}${required ? ' <span class="f-kritisk">*</span>' : ' <span class="f-dampad">(valfri)</span>'}</span>
            <select data-colmap-role="${role}" class="form-select${saknas ? ' colmap-saknas' : ''}">${opts}</select>
        </label>`;
    }).join('');

    const head = missing.length
        ? `<strong class="f-kritisk">${ikon('statusVarning')} Kolumnmappning behövs</strong>
           <p class="fs-sm lh-1_5 marg-6-0">Verktyget kunde inte auto-känna igen ${missing.map(m => `<strong>${esc2(m.label)}</strong>`).join(', ')}. Peka ut rätt kolumn nedan och läs in igen.</p>
           <p class="colmap-rubriker f-dampad fs-sm lh-1_5 marg-6-0">Filens rubriker: ${headers.map(h => `<code>${esc2(h)}</code>`).join(', ')}</p>`
        : `<strong>${ikon('bock')} Kolumner auto-matchade</strong>
           <p class="text-dampad-sm marg-6-0">Verktyget kände igen alla obligatoriska kolumner. Justera vid behov om någon matchats fel.</p>`;

    panel.innerHTML = `
        <details class="card${missing.length ? ' bl4-kritisk' : ''}" open>
            <summary class="pekare fw-600 pad-6-0">Kolumnmappning (filens kolumner till verktygets fält)</summary>
            <div class="pad-t-10">
                ${head}
                <div class="rutnat gap-12 kolumner-auto-200 marg-10-0">${selects}</div>
                <div class="rad-bryt gap-10">
                    <button id="colmap-apply" class="btn btn-primary btn-sm" type="button">Tillämpa mappning &amp; läs in igen</button>
                    <button id="colmap-reset" class="btn btn-secondary btn-sm" type="button">Återställ till auto</button>
                </div>
            </div>
        </details>`;
    panel.style.display = 'block';

    panel.querySelector('#colmap-apply')?.addEventListener('click', () => {
        const map = {};
        panel.querySelectorAll('[data-colmap-role]').forEach(sel => {
            const role = sel.getAttribute('data-colmap-role');
            if (/** @type {HTMLInputElement} */ (sel).value) map[role] = /** @type {HTMLInputElement} */ (sel).value;
            // Ansvarskoden är valfri personuppgift: ett aktivt "— ingen —" ska stå sig mot autoigenkänningen.
            else if (role === 'ansvar' && auto.ansvar) map.ansvar = '';
        });
        state.columnMap = Object.keys(map).length ? map : null;
        const f = state._lastStructureFile || (/** @type {HTMLInputElement} */ (dataInput).files && /** @type {HTMLInputElement} */ (dataInput).files?.[0]);
        if (f) loadStructureFile(f);
        else { dataStatus.textContent = 'Ladda upp filen igen för att tillämpa mappningen.'; dataStatus.className = 'status-msg'; }
    });
    panel.querySelector('#colmap-reset')?.addEventListener('click', () => {
        state.columnMap = null;
        const f = state._lastStructureFile || (/** @type {HTMLInputElement} */ (dataInput).files && /** @type {HTMLInputElement} */ (dataInput).files?.[0]);
        if (f) loadStructureFile(f);
    });
}

// ============================================================

// ---- Markera upload-cell som "loaded" + visuell badge ----
function markUploadLoaded(cellId, badgeText) {
    const cell = document.getElementById(cellId);
    if (!cell) return;
    cell.classList.remove('required', 'optional');
    cell.classList.add('loaded');
    const badge = cell.querySelector('.upload-badge');
    if (badge) {
        badge.classList.remove('required', 'optional', 'varning');
        badge.classList.add('loaded');
        badge.innerHTML = `${ikon('bock', 12)} ${esc(badgeText || 'Inläst')}`;   // bocken är en linjeikon, texten säger resten
    }
    const inl = cell.querySelector('.upload-inlast');
    if (inl) /** @type {HTMLElement} */ (inl).hidden = false;
    renderFilrutor();
}
function resetUploadCell(cellId, originalClass, originalBadge) {
    const cell = document.getElementById(cellId);
    if (!cell) return;
    // classList.add kastar på tokens med mellanslag ("upload-cell required") —
    // splitta så "Rensa all data" inte avbryts halvvägs.
    const tokens = String(originalClass || '').split(/\s+/).filter(Boolean);
    cell.classList.remove('loaded');
    if (tokens.length) cell.classList.add(...tokens);
    const badge = cell.querySelector('.upload-badge');
    if (badge) {
        badge.classList.remove('loaded', 'varning');
        // Badgen ska bara ha badge-varianten (required/optional), inte cell-klasser
        const badgeTokens = tokens.filter(t => t === 'required' || t === 'optional');
        if (badgeTokens.length) badge.classList.add(...badgeTokens);
        badge.textContent = originalBadge;
    }
    const inl = cell.querySelector('.upload-inlast');
    if (inl) /** @type {HTMLElement} */ (inl).hidden = true;
    renderFilrutor();
}

// Filnamnsraden i varje inläst filruta (ADR-36).
function renderFilrutor() {
    const fn = state.filnamn || {};
    const rad = (cellId, text) => {
        const el = document.querySelector(`#${cellId} .upload-filnamn`);
        if (el) el.innerHTML = text ? `${ikon('bock', 14)} ${esc(text)}` : '';
    };
    rad('upload-cell-data', state.isDemo ? 'Demodata' : fn.data);
    rad('upload-cell-policy', state.policyKalla === 'paket' ? 'Ur organisationspaketet' : state.policyKalla === 'demo' ? 'Demots ställningstagande' : fn.policy);
    rad('upload-cell-stat', state.statistikKalla === 'paket' ? 'Ur organisationspaketet' : fn.statistik);
}
// "Byt fil" öppnar respektive filväljare direkt.
document.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('[data-byt-fil]');
    if (b) document.getElementById(/** @type {HTMLElement} */ (b).dataset.bytFil || '')?.click();
});
document.getElementById('btn-kolumnmappning')?.addEventListener('click', () => {
    // Panelen byggs av maybeShowColumnMapping; knappen fäller ut den och visar den.
    if (typeof maybeShowColumnMapping === 'function') maybeShowColumnMapping();
    _visaKolumnmappning();
});
_kopplaNamnFalt('org-namn', sattOrgNamn);
_kopplaNamnFalt('jmf-namn', sattJmfNamn);

// #8: kollapsa uppladdningsraden när data lästs in så att översikten/insikterna
// hamnar överst. Återställs av clearAllData.
