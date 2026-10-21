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
            'no-trailing-spaces': 'warn'
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
            'prefer-const': 'warn'
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
        files: ['tools/browser-smoke.mjs', 'tools/perf-smoke.mjs'],
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
