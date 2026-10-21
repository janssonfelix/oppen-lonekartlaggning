// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Byggets förminskning av stilmallen (tools/lib/minify-css.mjs). Tre sätt att ändra betydelsen vaktas: ogiltig
// calc(), "a :is(b)" som blir "a:is(b)", och strängar i väljare.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { minifyCss } from '../tools/lib/minify-css.mjs';

describe('förminskningen bevarar betydelsen', () => {
    it('calc: blanksteg runt + och - står kvar (utan dem är uttrycket ogiltigt)', () => {
        expect(minifyCss('.a { top: calc(100% + 4px); width: calc( 100vw - 32px ); }')).toBe('.a{top:calc(100% + 4px);width:calc(100vw - 32px)}');
        expect(minifyCss('.g { background: linear-gradient(to right, transparent calc(50% - 1px), red calc(50% + 1px)); }'))
            .toBe('.g{background:linear-gradient(to right,transparent calc(50% - 1px),red calc(50% + 1px))}');
    });
    it('väljare: blanksteget före en pseudoklass står kvar (efterkommande), kombinatorer trycks ihop', () => {
        expect(minifyCss('#v:not(.x) :is(#a, #b) { display: none; }')).toBe('#v:not(.x) :is(#a,#b){display:none}');
        expect(minifyCss('ul :first-child , a > b + c ~ d { color: red; }')).toBe('ul :first-child,a>b+c~d{color:red}');
        expect(minifyCss('a:hover , a:focus-visible { color: red; }')).toBe('a:hover,a:focus-visible{color:red}');
        expect(minifyCss(':is(div, td):has(> table) { overflow-x: auto; }')).toBe(':is(div,td):has(>table){overflow-x:auto}');
    });
    it('strängar och url() rörs inte', () => {
        expect(minifyCss('.p [style*="display: flex"] { flex-wrap: wrap; }')).toBe('.p [style*="display: flex"]{flex-wrap:wrap}');
        expect(minifyCss(`.q::after { content: "a : b , c  > d"; }`)).toBe('.q::after{content:"a : b , c  > d"}');
        expect(minifyCss(".r::before { content: 'x /* inte en kommentar */ y'; }")).toBe(".r::before{content:'x /* inte en kommentar */ y'}");
        expect(minifyCss('.u { background: url( data:image/png;base64,AA+BB/C== ) no-repeat; }')).toBe('.u{background:url( data:image/png;base64,AA+BB/C== ) no-repeat}');
        expect(minifyCss('.u2 { background: url("a b.png"); }')).toBe('.u2{background:url("a b.png")}');
        expect(minifyCss('.e::after { content: "\\"}"; color: red; }')).toBe('.e::after{content:"\\"}";color:red}');
    });
    it('strängar i väljare (attributväljare) rörs inte: tecken som , > + ~ : ; { } och dubbla blanksteg står kvar', () => {
        expect(minifyCss('a[title="x , y > z"] { color: red; }')).toBe('a[title="x , y > z"]{color:red}');
        expect(minifyCss(`a[data-t="a  b"] , b[data-u='c : d'] > i { margin: 0 ; }`)).toBe(`a[data-t="a  b"],b[data-u='c : d']>i{margin:0}`);
        expect(minifyCss('.x[data-tip="1 + 2 ~ 3"]::after { content: "a  ,  b : c" ; }')).toBe('.x[data-tip="1 + 2 ~ 3"]::after{content:"a  ,  b : c"}');
        expect(minifyCss('a[href$=".pdf"]:not([title*="a{b}"]) { color: blue }')).toBe('a[href$=".pdf"]:not([title*="a{b}"]){color:blue}');
        expect(minifyCss('a[title="}"] { color: red } b { color: blue }')).toBe('a[title="}"]{color:red}b{color:blue}');   // en klammer i en sträng avslutar ingen regel
        expect(minifyCss('.z[data-a="x;y"] + .w { top: 0 }')).toBe('.z[data-a="x;y"]+.w{top:0}');
        expect(minifyCss('p[lang|="sv" i] { quotes: "«" "»" ; }')).toBe('p[lang|="sv" i]{quotes:"«" "»"}');
    });
    it('kommentarer tas bort, sista semikolon och tomma deklarationer likaså', () => {
        expect(minifyCss('/* a */ .a { /* b */ color : red ; ; margin: 0 auto ; } /* c */')).toBe('.a{color:red;margin:0 auto}');
    });
    it('@media, @supports och @keyframes: inledningen och reglerna inuti', () => {
        expect(minifyCss('@media (min-width: 641px) and (max-width: 1100px) { .a > .b { top: calc(1px + 2px); } .c { d: e; } }'))
            .toBe('@media (min-width:641px) and (max-width:1100px){.a>.b{top:calc(1px + 2px)}.c{d:e}}');
        expect(minifyCss('@keyframes snurr { from { transform: rotate(0deg); } 50% , 60% { opacity: .5; } to { transform: rotate(360deg); } }'))
            .toBe('@keyframes snurr{from{transform:rotate(0deg)}50%,60%{opacity:.5}to{transform:rotate(360deg)}}');
        expect(minifyCss('@media print { @page { margin: 1cm; } .a { b: c; } }')).toBe('@media print{@page{margin:1cm}.a{b:c}}');
        expect(minifyCss('@font-face { font-family: "X Y"; src: url(x.woff2) format("woff2"), url(y.woff); }')).toBe('@font-face{font-family:"X Y";src:url(x.woff2) format("woff2"),url(y.woff)}');
    });
    it('värden med snedstreck, minustecken och flera delar är oförändrade', () => {
        expect(minifyCss('.a { grid-area: 1 / 2 / 3 / 4; margin: -4px auto 0 -2px; font: 600 12px/1.5 "Inter", sans-serif; transition: opacity .2s ease, transform .2s; }'))
            .toBe('.a{grid-area:1 / 2 / 3 / 4;margin:-4px auto 0 -2px;font:600 12px/1.5 "Inter",sans-serif;transition:opacity .2s ease,transform .2s}');
        expect(minifyCss('.a { --x: 1; width: max( 100%, 340px ); color: var( --primary , #1d4ed8 ); }')).toBe('.a{--x:1;width:max(100%,340px);color:var(--primary,#1d4ed8)}');
    });
});

describe('förminskningen på verktygets stilmall', () => {
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const ut = minifyCss(css);
    it('klamrarna är i balans och inget innehåll har tappats', () => {
        expect((ut.match(/{/g) || []).length).toBe((ut.match(/}/g) || []).length);
        // Lika många block som i källan (utan kommentarer): gränsen följer stilmallen i stället för ett fast tal.
        expect((ut.match(/{/g) || []).length).toBe((css.replace(/\/\*[\s\S]*?\*\//g, '').match(/{/g) || []).length);
        expect((ut.match(/{/g) || []).length).toBeGreaterThan(500);
        expect(ut.length).toBeLessThan(css.length * 0.8);
        expect(ut).not.toMatch(/\/\*/);
    });
    it('inget calc-uttryck har förlorat blanksteget runt + eller -', () => {
        const calc = ut.match(/calc\([^;{}]*?\)/g) || [];
        expect(calc.length).toBeGreaterThan(3);
        for (const c of calc) expect(c, c).not.toMatch(/[\d%a-z)][+*/](?=[\d(a-z])|[\d%)]-[\d(]/i);
        expect(ut).toContain('top:calc(100% + 4px)');
    });
    it('varje efterkommande-väljare med pseudoklass i källan finns kvar med sitt blanksteg', () => {
        const kalla = css.replace(/\/\*[\s\S]*?\*\//g, '');
        const fall = [...kalla.matchAll(/([#.\w\])-]+) (:(?:is|not|where|has|first-child|last-child|nth-child)\b[^,{]*)/g)].filter(m => !/^\d/.test(m[1]));
        for (const m of fall) expect(ut, m[0]).toContain(`${m[1]} ${m[2].trim().split(/\s/)[0].slice(0, 6)}`);
    });
});
