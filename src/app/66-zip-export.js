// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// Export ZIP

/**
 * Diagrammen som följer med i ZIP-filen: alla som är ritade just nu och som får exporteras, i id-ordning.
 * Ett diagram som inte får lämna verktyget (exportTillaten i 11-diagramexport.js, där skälen står) följer
 * aldrig med, och inte heller ett som inte har något kvar att exportera när små grupper är borta. Bilden ritas
 * av exportvägen (diagramTillBild), som alltid utelämnar små grupper om användaren inte valt annat i Utforska.
 */
function zipDiagram() {
    exportSakraAlla();   // varje flik som har ritats ritas om om den inte är aktuell — före uppräkningen, som annars missar ersatta diagram
    const alla = typeof _rfBehallare !== 'undefined' ? [..._rfBehallare] : [];
    return alla.filter(el => el && el.id && el.isConnected && exportTillaten(el) && diagramRitat(el))
        .filter(el => { const u = typeof _rfExportFigur === 'function' ? _rfExportFigur(el) : null; return !u || !u.tom; })
        .sort((a, b) => a.id.localeCompare(b.id));
}
/**
 * ZIP-filen är "allt" (ADR-40): Word-utkastet, Excel-filen med alla flikar och diagrammen i ALLA
 * flikar. Varje upplåst flik ritas först, så att innehållet inte beror på vilka flikar som råkar ha öppnats.
 */
async function exportZip() {
    if (typeof JSZip === 'undefined') { alert('JSZip ej laddad.'); return false; }
    if (!getData().length) { alert('Ladda upp data först.'); return false; }
    const zip = new JSZip();
    if (typeof showLoading === 'function') showLoading();
    try {
        // Excel-filen först: den byggs utan väntan, före Word-utkastets bilder.
        // Ett fel i en del stoppar inte de andra: det rapporteras, och filen får det som gick att bygga.
        if (typeof XLSX !== 'undefined') {
            try { zip.file('lonekartlaggning_komplett.xlsx', XLSX.write(_excelAlltBok(), { bookType: 'xlsx', type: 'array' })); }
            catch (e) { rapporteraFel('ZIP: Excel-filen', e); }
        }
        try { const word = await byggWordUtkast(); zip.file(word.namn, word.blob); }
        catch (e) { rapporteraFel('ZIP: Word-utkastet', e); }
        // Diagrammen: varje upplåst flik ritas, och sedan tas allt som är ritat och får exporteras.
        for (const knapp of document.querySelectorAll('.nav-item[data-tab]')) {
            if (/** @type {HTMLInputElement} */ (knapp).disabled || /** @type {HTMLElement} */ (knapp).hidden) continue;
            const flik = knapp.getAttribute('data-tab');
            if (flik === 'dokumentera' || flik === 'info') continue;      // inga diagram att hämta där
            try { renderTabContent(flik); } catch (e) { rapporteraFel(`ZIP: ${flik}`, e); }
        }
        for (const el of zipDiagram()) {
            try { const b64 = (await diagramTillBild(el, { bredd: 1920, hojd: 1080 })).split(',')[1]; zip.file(`diagram/${el.id}.png`, b64, { base64: true }); } catch (_err) { /* ett diagram som inte går att rita följer inte med */ }
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'lonekartlaggning_export.zip'; a.click();
        return true;
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
        const oppen = document.querySelector('.nav-item.active[data-tab]');
        if (oppen && oppen.getAttribute('data-tab') === 'dokumentera' && typeof renderExportBesked === 'function') renderExportBesked();
    }
}
document.getElementById('btn-export-zip')?.addEventListener('click', () => { exportZip(); });

