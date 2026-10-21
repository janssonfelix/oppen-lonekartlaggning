// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Word-utkast: hela dokumentationen som redigerbar .doc ----

/**
 * Bygger dokumentationsutkastets HTML-kropp (testbar; ren av nedladdning).
 * Läser state/DOM men returnerar bara en sträng.
 */
/** Utkastet som HTML, ritat ur rapportmodellen (58-rapportmodell.js). */
function _buildDocumentationDraftHtml() { return rmTillHtml(rapportModell()); }

// ---- Word-utkastet som .docx (ADR-37) ----
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Utkastets HTML → blocklista för src/lib/docx.js. Okända element blir stycken med sin text. */
function _utkastTillBlock(html) {
    const rot = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
    const delarAv = (nod, fet = false, kursiv = false, ut = []) => {
        for (const n of nod.childNodes) {
            if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' '); if (t) ut.push({ text: t, fet, kursiv }); }
            else if (n.nodeType === 1) {
                const tag = n.tagName.toLowerCase();
                delarAv(n, fet || tag === 'strong' || tag === 'b', kursiv || tag === 'em' || tag === 'i', ut);
            }
        }
        return ut;
    };
    const trimma = delar => {
        const d = delar.map(x => ({ ...x }));
        if (d.length) { d[0].text = d[0].text.replace(/^\s+/, ''); d[d.length - 1].text = d[d.length - 1].text.replace(/\s+$/, ''); }
        return d.filter(x => x.text);
    };
    const cell = el => {
        const d = trimma(delarAv(el));
        return { delar: el.tagName.toLowerCase() === 'th' ? d.map(x => ({ ...x, fet: true })) : d };
    };
    const tabell = t => {
        const rader = [...t.querySelectorAll('tr')].map(tr => [...tr.children].filter(c => /^t[hd]$/i.test(c.tagName)));
        const thead = t.querySelector('thead');
        const forstaAllaTh = rader.length && rader[0].length && rader[0].every(c => c.tagName.toLowerCase() === 'th');
        const harRubrik = !!thead || (forstaAllaTh && rader.length > 1 && rader.slice(1).some(r => r.some(c => c.tagName.toLowerCase() === 'td')) && rader[0].length > 2);
        return { typ: 'tabell', rubrikrad: harRubrik ? rader[0].map(cell) : null, rader: (harRubrik ? rader.slice(1) : rader).map(r => r.map(cell)) };
    };
    const block = [];
    const besok = el => {
        for (const n of el.childNodes) {
            if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) block.push({ typ: 'stycke', delar: [{ text: t }] }); continue; }
            if (n.nodeType !== 1) continue;
            const tag = n.tagName.toLowerCase();
            const klass = n.classList;
            if (/^h[1-3]$/.test(tag)) block.push({ typ: 'rubrik', niva: +tag[1], delar: trimma(delarAv(n)) });
            else if (tag === 'table') block.push(tabell(n));
            else if (tag === 'figure' && n.hasAttribute('data-rm-bild')) block.push({ typ: 'bild', id: n.getAttribute('data-rm-bild'), flik: n.getAttribute('data-rm-flik'), text: n.textContent.trim() });
            else if (tag === 'div' && klass.contains('fillin')) block.push({ typ: 'stycke', stil: 'fyllIn', delar: trimma(delarAv(n)) });
            else if (tag === 'div' && klass.contains('draftbox')) block.push({ typ: 'stycke', stil: 'utkastruta', delar: trimma(delarAv(n)) });
            else if (tag === 'p') block.push({ typ: 'stycke', delar: trimma(delarAv(n)), ...(klass.contains('muted') || klass.contains('report-muted') ? { stil: 'dampad' } : {}) });
            else if (tag === 'div' || tag === 'section') besok(n);
            else { const d = trimma(delarAv(n)); if (d.length) block.push({ typ: 'stycke', delar: d }); }
        }
    };
    besok(rot);
    return block;
}

/** Laddar ner en fil (egen funktion så att testerna kan fånga den). */
function _laddaNerBlob(blob, filnamn) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filnamn;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Fyller bildblocken med diagrammens PNG (rmDiagramBild i 58-rapportmodell.js). Ett diagram som inte ritas tas bort
 * ur listan; `saknas` säger vilka.
 */
async function _utkastFyllBilder(block) {
    const ut = [], saknas = [], ritade = new Set();
    for (const b of block) {
        if (b.typ !== 'bild') { ut.push(b); continue; }
        const bild = await rmDiagramBild({ id: b.id, flik: b.flik, rubrik: b.text }, ritade);
        if (bild) ut.push({ typ: 'bild', base64: bild.base64, bredd: bild.bredd, hojd: bild.hojd, alt: bild.alt, text: b.text }); else saknas.push(b.text);
    }
    return { block: ut, saknas };
}

/** Bygger Word-utkastet som .docx: filen som Blob och dess namn. Används av knappen och av ZIP-exporten. */
async function byggWordUtkast() {
    if (typeof JSZip === 'undefined') throw new Error('zip-biblioteket saknas');
    const year = new Date().getFullYear();
    const stamp = new Date().toISOString().slice(0, 10);
    const demo = state.isDemo;
    const { block } = await _utkastFyllBilder(_utkastTillBlock(_buildDocumentationDraftHtml()));
    const delar = _docxDelar(block, {
        titel: `Lönekartläggning ${year} — dokumentation (utkast)`,
        sidfot: _kSidfot(`Lönekartläggning ${year} — ${demo ? 'DEMODATA, UTKAST' : 'UTKAST'}`),
        skapad: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
    const zip = new JSZip();
    for (const [sokvag, del] of Object.entries(delar)) {
        if (del && typeof del === 'object') zip.file(sokvag, del.base64, { base64: true }); else zip.file(sokvag, del);
    }
    const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
    return { blob, namn: `Lonekartlaggning_${year}_dokumentation_UTKAST_${demo ? 'DEMODATA_' : ''}${stamp}.docx` };
}

/** Bygger och laddar ner Word-utkastet som .docx. */
async function exportDocumentationDraft() {
    if (!getData().length) { alert('Ladda upp data först.'); return false; }
    try {
        const { blob, namn } = await byggWordUtkast();
        _laddaNerBlob(blob, namn);
        return true;
    } catch (err) {
        rapporteraFel('Word-utkast', err);
        alert('Word-utkastet kunde inte skapas: ' + (err && err.message ? err.message : err));
        return false;
    }
}
document.getElementById('btn-export-docdraft')?.addEventListener('click', exportDocumentationDraft);
