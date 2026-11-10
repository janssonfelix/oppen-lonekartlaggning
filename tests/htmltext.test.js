// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { describe, it, expect } from 'vitest';
import { utanTaggar, htmlTillText } from '../src/lib/htmltext.js';

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
});
