/**
 * #6 Meta-vakt: app.js är ett GENERERAT hopslaget bygge av de numrerade
 * källmodulerna i src/app/. Detta test misslyckas om app.js och src/app/ glider
 * isär — dvs om någon redigerat app.js direkt utan att uppdatera src/app/, eller
 * ändrat en del utan att köra `node tools/build-app.mjs` (npm run build:app).
 *
 * Skivorna är rena byte-skivor (BOM + CRLF bevarade), så hopslagningen ska vara
 * EXAKT byte-identisk med app.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src', 'app');

describe('#6 app.js ↔ src/app/-moduler', () => {
    it('concat(src/app/NN-*.js) är byte-identiskt med app.js', () => {
        const files = readdirSync(srcDir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
        expect(files.length).toBeGreaterThan(1);
        const rebuilt = Buffer.concat(files.map(f => readFileSync(join(srcDir, f))));
        const current = readFileSync(join(root, 'dist', 'app.js'));
        // Hjälpsamt felmeddelande: kör build:app om detta fallerar.
        expect(
            rebuilt.equals(current),
            'src/app/ och app.js är i osynk. Kör `npm run build:app` (eller redigera rätt src/app/-del).'
        ).toBe(true);
    });
});
