// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Felen i text som användaren läser, och ett underlag där antalen blir 1: delas av flikarnas text
// (tests/visad-text-app.test.js) och exporternas (tests/exports.golden.test.js).

// Ett tal följt av ett pluralord, där talet är 1 (inte slutet av 11, 0,1 eller −1). Ordet får ha ett förled med
// bindestreck («1 AID-etiketter»); efter ordet får en versal följa, där två element står ihop i textContent.
export const PLURAL_EFTER_1 = /(?<![\d,.−-])1[   ](?:[\wÅÄÖåäö]+-)?(personer|grupper|kvinnor|män|slutsatser|yrken|rader|poster|månader|intervallen|anställda|etiketter|kriterier|punkter|är värda|flaggade)(?![a-zåäö])/;

// Ett mönster per fel, med ett namn som säger vad som är fel.
export const VISAD_TEXT_FEL = [
    ['plural efter 1', PLURAL_EFTER_1],
    ['decimalpunkt', /(?<![\w.])\d+\.\d+(?![\w.])\s*(?:%|kr|år|procent|\b)/],
    ['%-enheter', /%-enhet/],
    ['engelska', /\b(Diff|[Ss]napshot|Spillover|Ring-fenced|Timeout|Sheet|Lifecycle|[Aa]uto-match\w*|[Bb]enchmark|[Oo]utlier\w*|[Gg]ap(?![\wåäö-])|[Ss]core|[Dd]ashboard|[Ss]ummary|[Rr]eport|N\/A|[Pp]ending|[Ww]arning)\b/],
    ['slangord', /\b(obs|pers|datan|datat)\b/],
    ['html-entitet', /&(?:lt|gt|amp|quot|nbsp|#\d+);/],   // escapad två gånger
    ['likhetstecken före <', /=[\s\u00a0]*</],          // «p = < 0,001»
];

/** Felen i en text, med 40 tecken runt varje. */
export const textfel = (var_, text) => {
    const fel = [], t = text.replace(/\s+/g, ' ');
    for (const [namn, re] of VISAD_TEXT_FEL) for (const m of t.matchAll(new RegExp(re.source, 'g'))) fel.push(`${var_}: ${namn}: …${t.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
    return fel;
};

// Underlaget med antal 1: BAS A har AID 5000 med en kvinna och elva män, AID 5001 med tolv kvinnor och en man, och AID
// 5002 med en enda person; BAS B har en man bland femton kvinnor. Ställningstagandet och statistiken har en rad var.
export const ETTOR = (() => {
    const rader = [];
    const lagg = (n, bas, aid, namn, kon, lon) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + i * 211,
        alder: 28 + (i * 7) % 30, yrke: `${aid} ${namn}`, aid, yrkeLabel: namn, enhet: '' }); };
    lagg(1, 'A', '5000', 'Yrke ett', 'kvinna', 30100); lagg(11, 'A', '5000', 'Yrke ett', 'man', 31000);
    lagg(12, 'A', '5001', 'Yrke två', 'kvinna', 29000); lagg(1, 'A', '5001', 'Yrke två', 'man', 33000);
    lagg(1, 'A', '5002', 'Yrke tre', 'kvinna', 34000);
    lagg(15, 'B', '6000', 'Yrke fyra', 'kvinna', 36000); lagg(1, 'B', '6000', 'Yrke fyra', 'man', 41000);
    return rader;
})();
export const lasInEttor = w => {
    w.__state.data = ETTOR.map(r => ({ ...r }));
    w.__state.dataAudit = { totalRaw: ETTOR.length, excludedNoBas: 0, excludedZeroLon: 0 };
    w.__state.policy = [{ bas: 'A', p10: 27000, med: 31000, p90: 36000 }];
    w.__state.statistik = [{ aid: '5000', bas: 'A', median: 31500, andelKv: 20, aidFull: '5000 Yrke ett' }];
    w.eval('fyllValjare(); lasUppFlikar();');
};
