// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Word-utkastet som .docx (ADR-37).
 *
 * Skriver en enkel blocklista (rubriker, stycken, tabeller, bilder) som Office Open XML-filer. Ingen DOM och
 * ingen zip här: appen packar filerna med JSZip. En bild är ett block `{ typ: 'bild', base64, bredd, hojd, alt,
 * text }` (PNG; mått i bildpunkter). Saknar blocket bilddata skrivs bara bildtexten, inom hakparentes.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const TEXTBREDD = 9070;   // A4 11906 − 2 × 1418 twips
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const EMU_PER_TWIP = 635, EMU_PER_PX = 9525;

/** Text för XML: escapad, utan tecken som är ogiltiga i XML 1.0. */
export function xmlText(s) {
    return String(s ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const _kor = d => `<w:r>${d.fet || d.kursiv ? `<w:rPr>${d.fet ? '<w:b/>' : ''}${d.kursiv ? '<w:i/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlText(d.text)}</w:t></w:r>`;
const _stycke = (delar, stil) => `<w:p>${stil ? `<w:pPr><w:pStyle w:val="${stil}"/></w:pPr>` : ''}${(delar || []).map(_kor).join('')}</w:p>`;
const STIL = { dampad: 'Dampad', fyllIn: 'FyllIn', utkastruta: 'Utkastruta' };

function _tabell(b) {
    const alla = [...(b.rubrikrad ? [b.rubrikrad] : []), ...(b.rader || [])];
    const kolumner = Math.max(1, ...alla.map(r => r.length));
    const bredd = Math.floor(TEXTBREDD / kolumner);
    const rad = (celler, rubrik) => {
        const fyllda = [...celler, ...Array(kolumner - celler.length).fill({ delar: [] })];
        return `<w:tr><w:trPr><w:cantSplit/>${rubrik ? '<w:tblHeader/>' : ''}</w:trPr>${fyllda.map(c =>
            `<w:tc><w:tcPr><w:tcW w:w="${bredd}" w:type="dxa"/>${rubrik ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>' : ''}</w:tcPr>`
            + _stycke((c.delar || []).map(d => (rubrik ? { ...d, fet: true } : d))) + '</w:tc>').join('')}</w:tr>`;
    };
    return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabell"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>`
        + `<w:tblGrid>${Array(kolumner).fill(`<w:gridCol w:w="${bredd}"/>`).join('')}</w:tblGrid>`
        + (b.rubrikrad ? rad(b.rubrikrad, true) : '') + (b.rader || []).map(r => rad(r, false)).join('') + '</w:tbl>';
}

const _harBild = b => b && b.typ === 'bild' && typeof b.base64 === 'string' && b.base64.length > 0 && b.bredd > 0 && b.hojd > 0;

/** En bild som eget, centrerat stycke, högst så bred som textytan, följd av bildtexten. `nr` börjar på 1. */
function _bild(b, nr) {
    const text = b.text ? _stycke([{ text: b.text }], STIL.dampad) : '';
    if (!_harBild(b)) return _stycke([{ text: `[Diagram: ${b.text || b.alt || 'utan rubrik'} — bilden kunde inte skapas]` }], STIL.dampad);
    const maxCx = TEXTBREDD * EMU_PER_TWIP;
    const cx = Math.min(maxCx, Math.round(b.bredd * EMU_PER_PX)), cy = Math.round(cx * b.hojd / b.bredd);
    const besk = xmlText(b.alt || b.text || `Diagram ${nr}`);
    return '<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
        + `<wp:docPr id="${nr}" name="Bild ${nr}" descr="${besk}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
        + `<a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${nr}" name="bild${nr}.png" descr="${besk}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="rIdBild${nr}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' + text;
}

function _dokument(block) {
    let nr = 0;
    const delar = block.map(b => (b.typ === 'rubrik' ? _stycke(b.delar, `Heading${b.niva}`)
        : b.typ === 'tabell' ? _tabell(b)
        : b.typ === 'bild' ? _bild(b, _harBild(b) ? ++nr : 0) : _stycke(b.delar, STIL[b.stil])));
    if (!block.length || block[block.length - 1].typ === 'tabell') delar.push('<w:p/>');   // stycke före sectPr
    return `${XML}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"><w:body>${delar.join('')}`
        + `<w:sectPr><w:footerReference w:type="default" r:id="rIdSidfot"/><w:pgSz w:w="11906" w:h="16838"/>`
        + `<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`
        + '</w:body></w:document>';
}

function _stilar() {
    const ram = (typ, sz, farg) => ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="${typ}" w:sz="${sz}" w:space="4" w:color="${farg}"/>`).join('');
    const rubrik = (id, namn, niva, sz, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${namn}"/>`
        + `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
        + `<w:pPr><w:keepNext/>${extra}<w:outlineLvl w:val="${niva}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
    return `${XML}<w:styles xmlns:w="${W}">`
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>'
        + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="sv-SE"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + rubrik('Heading1', 'heading 1', 0, 40, '<w:spacing w:before="0" w:after="60"/>')
        + rubrik('Heading2', 'heading 2', 1, 28, '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:spacing w:before="360" w:after="120"/>')
        + rubrik('Heading3', 'heading 3', 2, 24, '<w:spacing w:before="240" w:after="80"/>')
        + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Dampad"><w:name w:val="Dämpad"/><w:basedOn w:val="Normal"/><w:qFormat/>'
        + '<w:rPr><w:color w:val="555555"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="FyllIn"><w:name w:val="Fyll i"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:pBdr>${ram('dashed', 4, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7D6"/><w:spacing w:before="120" w:after="120"/></w:pPr>`
        + '<w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Utkastruta"><w:name w:val="Utkastruta"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:pBdr>${ram('single', 12, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7ED"/><w:spacing w:after="240"/></w:pPr></w:style>`
        + '<w:style w:type="table" w:customStyle="1" w:styleId="Tabell"><w:name w:val="Tabell"/>'
        + '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:tblPr><w:tblBorders>'
        + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')
        + '</w:tblBorders><w:tblCellMar><w:top w:w="57" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="57" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        + '</w:styles>';
}

function _sidfot(text) {
    const falt = namn => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${namn} </w:instrText></w:r>`
        + '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    return `${XML}<w:ftr xmlns:w="${W}" xmlns:r="${R}"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${TEXTBREDD}"/></w:tabs>`
        + '<w:rPr><w:sz w:val="16"/></w:rPr></w:pPr>'
        + `<w:r><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">Sida </w:t></w:r>`
        + `${falt('PAGE')}<w:r><w:t xml:space="preserve"> av </w:t></w:r>${falt('NUMPAGES')}</w:p></w:ftr>`;
}

/**
 * @param {Array} block
 * @param {{titel:string, sidfot:string, skapad:string}} opt - skapad i ISO 8601 (UTC)
 * @returns {Object<string,string|{base64:string}>} sökväg i zip:en → XML, eller `{ base64 }` för en bildfil
 */
export function docxDelar(block, { titel, sidfot, skapad }) {
    const bilder = (block || []).filter(_harBild);
    const PKG = 'http://schemas.openxmlformats.org/package/2006';
    const OFF = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const typ = t => `application/vnd.openxmlformats-officedocument.${t}`;
    return {
        '[Content_Types].xml': `${XML}<Types xmlns="${PKG}/content-types">`
            + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + (bilder.length ? '<Default Extension="png" ContentType="image/png"/>' : '')
            + `<Override PartName="/word/document.xml" ContentType="${typ('wordprocessingml.document.main+xml')}"/>`
            + `<Override PartName="/word/styles.xml" ContentType="${typ('wordprocessingml.styles+xml')}"/>`
            + `<Override PartName="/word/settings.xml" ContentType="${typ('wordprocessingml.settings+xml')}"/>`
            + `<Override PartName="/word/footer1.xml" ContentType="${typ('wordprocessingml.footer+xml')}"/>`
            + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            + `<Override PartName="/docProps/app.xml" ContentType="${typ('extended-properties+xml')}"/></Types>`,
        '_rels/.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/officeDocument" Target="word/document.xml"/>`
            + `<Relationship Id="rId2" Type="${PKG}/relationships/metadata/core-properties" Target="docProps/core.xml"/>`
            + `<Relationship Id="rId3" Type="${OFF}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
        'word/_rels/document.xml.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/styles" Target="styles.xml"/>`
            + `<Relationship Id="rId2" Type="${OFF}/settings" Target="settings.xml"/>`
            + `<Relationship Id="rIdSidfot" Type="${OFF}/footer" Target="footer1.xml"/>`
            + bilder.map((_b, i) => `<Relationship Id="rIdBild${i + 1}" Type="${OFF}/image" Target="media/bild${i + 1}.png"/>`).join('')
            + '</Relationships>',
        ...Object.fromEntries(bilder.map((b, i) => [`word/media/bild${i + 1}.png`, { base64: b.base64 }])),
        'word/document.xml': _dokument(block || []),
        'word/styles.xml': _stilar(),
        'word/settings.xml': `${XML}<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="709"/>`
            + '<w:characterSpacingControl w:val="doNotCompress"/><w:compat>'
            + '<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
        'word/footer1.xml': _sidfot(sidfot),
        'docProps/core.xml': `${XML}<cp:coreProperties xmlns:cp="${PKG}/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"`
            + ' xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            + `<dc:title>${xmlText(titel)}</dc:title><dc:creator>Öppen lönekartläggning</dc:creator>`
            + `<dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:created>`
            + `<dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:modified></cp:coreProperties>`,
        'docProps/app.xml': `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">`
            + '<Application>Öppen lönekartläggning</Application></Properties>',
    };
}
