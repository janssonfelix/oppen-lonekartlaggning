# Kom igång: första timmen

Två vägar in: utvecklaren (del a) och granskaren av beräkningarna (del b). Kommandona kördes i en arbetskopia när
dokumentet skrevs (Node v22.22.2). Kräver **Node 22.12 eller senare** (`engines`). Kör från repots rot.

## a. För utvecklaren

### 1. Installera

```sh
npm ci
```

Installerar exakt de versioner som står i `package-lock.json`.

### 2. Kör den snabba sviten

```sh
npm test
```

Vid körningen slutade den så här:

```
 Test Files  55 passed (55)
      Tests  1478 passed | 6 expected fail (1484)
```

### 3. Var ändringar görs

| Vad du ändrar | Var |
|---|---|
| En beräkning (statistik, regression, kostnad, regler) | `src/lib/` |
| Appen: vyer, inläsning, export, menyn | `src/app/NN-*.js` ([`src/app/README.md`](../../src/app/README.md)) |
| Sidans skal, stilmall och CSP | `src/index.html`, `src/style.css` |

Ändra aldrig `dist/`, `src/app/08-version.js` eller `src/app/09-lib-speglar.js`. De genereras av bygget.

### 4. En första ändring: ett testfall i kostnaden

`kostnadPerAr` i `src/lib/kostnad.js` testas i `tests/kostnad.test.js`. Lägg till ett fall i blocket `kostnadPerAr: formeln …`, före raden `antal 0 ger 0 oavsett belopp och PO`:

```js
    it('en person: 1 000 kr × 12 mån × PO 39,15 % = 16 698', () => {
        expect(kostnadPerAr(1000, 1, KOST)).toBeCloseTo(16698, 6);
    });
```

Kör den filen med `npx vitest run tests/kostnad.test.js`. Det ska bli `Tests  25 passed (25)`. Byt sedan förväntat värde till `16699`: körningen faller då. Ta tillbaka ändringen
med `git checkout -- tests/kostnad.test.js`.

### 5. Bygg

```sh
npm run build:app
npm run bundle
```

`build:app` genererar speglen ur `src/lib/` och slår ihop `src/app/` till `dist/app.js`. `bundle` bygger
`dist/oppen-lonekartlaggning.html` och `dist/RELEASE.txt`; utskriften slutar med `Klar: …`, versionen och SHA-256-summan.
Varningen om `VERSION` stoppar inget. Ändrade filer i `dist/` checkas in med källan; det prövar `npm run kontroll`.

### 6. Öppna och prova

Öppna `dist/oppen-lonekartlaggning.html` direkt i webbläsaren och klicka på **litet demo** i rutan *Prova med demodata*.
Statusraden ska säga `Syntetisk testdata: 260 personer`. Prövat i headless Chromium med `file://`: 260 rader lästes in,
och inga anrop till nätet gjordes.

### 7. Under arbetet och före en pull request

```sh
npm run kontroll -- --snabb    # under arbetet: bygge, lint, typkontroll, snabb sviten och bundle
npm run kontroll               # före en pull request: hela kedjan, i CI:s ordning
```

Vad som krävs för att en ändring är klar står i *Definition of Done* i [`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md)
(punkt 3); vad varje steg kör står i [`bygge-och-test.md`](bygge-och-test.md).

## b. För granskaren av beräkningarna

Varje beräkning är en ren funktion i `src/lib/`, utan DOM och utan tillstånd. Den går att köra i Node på egen data;
appen använder samma funktion via spegeln. Börja i spårbarhetsmatrisen, [`sparbarhet.md`](sparbarhet.md): där står varje
beräkning med funktion, vad den bygger på, tester och referensfall, och modellparametrarna.

### Huvudtalet på ett påhittat underlag

Spara som `exempel.mjs` i repots rotmapp och kör med `node exempel.mjs`:

```js
// Spara som exempel.mjs i repots rotmapp och kör med: node exempel.mjs
import { huvudregression, FORKLARINGSMODELL_STANDARD } from './src/lib/regression.js';
import { kostnadPerAr } from './src/lib/kostnad.js';

// Ett påhittat underlag med 80 personer: två kön, BAS A–D och två yrken. Lönen följer BAS och ålder, och kvinnor
// har lägre lön än män i samma BAS och ålder. Slumpen är seedad, så varje körning ger samma tal.
let s = 20261120;
const slump = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rader = [];
for (let i = 0; i < 80; i++) {
    const kvinna = i % 8 < 4;
    const bas = 'ABCD'[i % 4];
    const alder = 25 + Math.floor(slump() * 40);
    const lon = Math.round(28000 + 4000 * 'ABCD'.indexOf(bas) + 120 * (alder - 25) - (kvinna ? 900 : 0) + 2500 * (slump() - 0.5));
    rader.push({ kon: kvinna ? 'kvinna' : 'man', bas, alder, lon, aid: `${bas}${(i >> 3) % 2}`, yrke: `Yrke ${(i >> 3) % 2}` });
}

// Huvudtalet: könsskillnaden i procent, justerad för ålder och BAS, med 95 procent konfidensintervall.
const r = huvudregression(rader, { modell: FORKLARINGSMODELL_STANDARD, kInstalld: 10, golv: 10 });
console.log('Könsskillnad, procent:', r.konPct.toFixed(2), `(95 % KI ${r.konPctLow.toFixed(2)} till ${r.konPctHigh.toFixed(2)})`);
console.log('Observationer:', r.n, 'modell:', r.modelName);

// Kostnad: 1 000 kr i månaden för tio personer, 12 månader, PO-påslag 39,15 procent.
console.log('Kostnad per år:', kostnadPerAr(1000, 10, { months: 12, poPct: 39.15 }).toFixed(2));
```

Utdata:

```
Könsskillnad, procent: -2.77 (95 % KI -3.81 till -1.71)
Observationer: 80 modell: full
Kostnad per år: 166980.00
```

Ett negativt tal betyder att kvinnor har lägre lön än män med samma BAS och ålder. Se `tests/huvudregression.test.js`
för hur `huvudregression` anropas i testerna.

### Var talen är prövade

- **Handräknade referensfall**: `tests/fixtures/referensfall/` (femton JSON-filer). Fältet `harledning` visar uträkningen
  steg för steg; `tests/referensfall.test.js` kör dem.
- **Etablerade implementationer**: `tests/fixtures/ref-*.py` med statsmodels och scipy. Resultaten är incheckade, och
  `tests/stat-referens.test.js` jämför verktygets tal mot dem. **Låsta tal**: `tests/berakningar-las.test.js`.
- **Referensdokumenten**: [`regressionsmodellen.md`](regressionsmodellen.md),
  [`likvardighetsmodellen.md`](likvardighetsmodellen.md) och [`k-troskeln.md`](k-troskeln.md).

### Python-referenserna

Skripten behöver inte köras för att granska. Vill du räkna om dem, i en venv under `privat/` (ignorerad av git):

```sh
python3 -m venv privat/venv-ref
privat/venv-ref/bin/pip install -r tests/fixtures/requirements.txt
privat/venv-ref/bin/python -I tests/fixtures/ref-stat-referens.py
```

Några skript skriver över `tests/fixtures/*.json`; förstå varför en diff uppstår innan du checkar in den.
