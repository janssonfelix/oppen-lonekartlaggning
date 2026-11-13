// ESLint flat config (ESLint 10) för Öppen lönekartläggning.
// dist/app.js körs som klassisk browser-script (inga ES-moduler); src/lib/ är rena
// ES-moduler; tester körs som ESM under Node/Vitest.
import globals from 'globals';

const browserLibs = {
    ...globals.browser,
    ...globals.es2021,
    // Inlinade tredjepartsbibliotek (globala i bundlen)
    Papa: 'readonly',
    XLSX: 'readonly',
    d3: 'readonly',
    JSZip: 'readonly'
};

// Skydden S1 och S2 (docs/utveckling/skydd.md): appens kod och lib-modulerna använder inga nät-API och ingen
// lagring utanför lagringsspärren. Spärren i src/app/00-sakerhet-och-uppstart.js rör localStorage,
// sessionStorage och document.cookie avsiktligt; de förbjuds därför inte här. Linten ser bara direkta anrop
// med de här namnen, och tredjepartsbiblioteken i vendor/ lintas inte.
const S1 = 'S1 i docs/utveckling/skydd.md: verktyget gör inga nätverksanrop.';
const S2 = 'S2 i docs/utveckling/skydd.md: verktyget sparar ingenting i webbläsarens lagring.';
const natOchLagring = {
    'no-restricted-globals': ['error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map(name => ({ name, message: S1 })),
        ...['indexedDB', 'caches'].map(name => ({ name, message: S2 }))
    ],
    'no-restricted-properties': ['error',
        { object: 'navigator', property: 'sendBeacon', message: S1 },
        ...['fetch', 'XMLHttpRequest', 'WebSocket'].map(property => ({ object: 'window', property, message: S1 })),
        ...['indexedDB', 'caches'].map(property => ({ object: 'window', property, message: S2 })),
        { object: 'self', property: 'fetch', message: S1 },
        { object: 'globalThis', property: 'fetch', message: S1 }
    ],
    'no-restricted-syntax': ['error', {
        selector: 'NewExpression[callee.name=/^(Shared)?Worker$/]',
        message: 'ADR-1 och S2 i docs/utveckling/skydd.md: ingen arbetstråd; en arbetstråd står utanför lagringsspärren.'
    }]
};

export default [
    {
        ignores: [
            'dist/oppen-lonekartlaggning.html',
            'vendor/**',
            '*.min.js',
            'node_modules/**',
            'types/**'   // ambienta deklarationer för typkontrollen (tsc), inte körbar kod
        ]
    },
    {
        files: ['dist/app.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: browserLibs
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-implicit-globals': 'off', // dist/app.js definierar globaler avsiktligt
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-dupe-keys': 'error',
            'no-unreachable': 'error',
            'no-fallthrough': 'error',
            'use-isnan': 'error',
            'valid-typeof': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'warn',
            'no-trailing-spaces': 'warn',
            ...natOchLagring
        }
    },
    {
        files: ['src/lib/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.es2021 }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'warn',
            ...natOchLagring
        }
    },
    {
        // Bygg- och generatorskripten producerar den skeppade artefakten och var
        // tidigare helt olintade (npm run lint tog bara app.js, lib och tests — nu dist/app.js, src/lib och tests).
        files: ['tools/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.es2021 }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'warn'
        }
    },
    {
        // Röktestet och prestandasvepet kör page.evaluate(), vars callbacks
        // exekveras i webbläsarens realm — document/localStorage och appens egna
        // globaler finns där, inte i Node.
        files: ['tools/browser-smoke.mjs', 'tools/browser-smoke/**/*.mjs', 'tools/perf-smoke.mjs'],
        languageOptions: {
            // Appens egna globaler som skripten anropar inne i sidan.
            globals: { ...globals.browser, XLSX: 'readonly', renderTabContent: 'readonly', renderExplorer: 'readonly', sattRapportUrval: 'readonly', renderExportBesked: 'readonly',
                buildPrintReport: 'readonly', rapportModell: 'readonly', excelAlltBlad: 'readonly', sattLage: 'readonly' }
        }
    },
    {
        files: ['tests/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.es2021 }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'warn'
        }
    }
];
