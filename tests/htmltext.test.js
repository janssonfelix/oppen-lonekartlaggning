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
    it('arTal: ett intervall är ett tal, också med «till» när ett av talen är negativt (95 % KI i Rapporttext)', () => {
        for (const t of ['0,9–3,8 %', '−0,8 till 1,7 %', '−0,8\u00a0till\u00a01,7\u00a0%', '−12,90 till −8,14 %', '1 200–3 400 kr'])
            expect(arTal(t), t).toBe(true);
        for (const t of ['till 5 %', '5 till', 'från 5 till 10 kr', '5 till 10 personer'])
            expect(arTal(t), t).toBe(false);
    });
});
