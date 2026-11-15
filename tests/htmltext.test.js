// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { describe, it, expect } from 'vitest';
import { utanTaggar, htmlTillText, arTal } from '../src/lib/htmltext.js';

describe('htmltext', () => {
    it('utanTaggar tar bort taggar, också nästlade, och ett ensamt <', () => {
        expect(utanTaggar('<strong>Fet</strong> text')).toBe('Fet text');
        expect(utanTaggar('<scr<b>ipt>alert(1)</scr</b>ipt>')).toBe('alert(1)');
        expect(utanTaggar('a < b')).toBe('a  b');
        expect(utanTaggar('n&lt;10')).toBe('n&lt;10');
        expect(utanTaggar(null)).toBe('');
    });
    it('htmlTillText avkodar tecknen, &amp; sist', () => {
        expect(htmlTillText('Grupper med n&lt;10 <em>visas inte</em>')).toBe('Grupper med n<10 visas inte');
        expect(htmlTillText('&amp;lt;')).toBe('&lt;');
        expect(htmlTillText('&quot;A&quot; &#39;B&#39; &gt;')).toBe('"A" \'B\' >');
    });
    it('arTal: en cell med ett tal och ev. enhet, som Word-utkastet och utskriften håller på en rad', () => {
        for (const t of ['33 932 kr', '93,6 %', '46 (28/18)', '1 427 679 kr/år', '20 / 45', '−3,4 %', '12', ' 5 000 kr/mån ', '2,4 mnkr'])
            expect(arTal(t), t).toBe(true);
        for (const t of ['Barnskötare', '403010 Barnskötare', '≥ 5 %', '', 'Nå referensens median', '[HR fyller i]', null])
            expect(arTal(t), String(t)).toBe(false);
    });
});
