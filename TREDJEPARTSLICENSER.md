# Tredjepartslicenser

Öppen lönekartläggnings egen kod (`src/`, `tools/`, `tests/`) är licensierad under MIT-licensen; se
[`LICENSE`](LICENSE). Varje källfil bär licensraden (SPDX).

Den byggda filen innehåller fyra öppna bibliotek. Alla är tillåtande licenser som får ingå i ett
MIT-licensierat verk och användas kommersiellt, utan avgifter.

| Bibliotek | Version | Licens | Användning i verktyget | Webb |
|---|---|---|---|---|
| PapaParse | 5.7.0 | MIT | CSV-parsning av lönefilen, ställningstagandet och jämförelsestatistiken | https://www.papaparse.com |
| SheetJS Community Edition | 0.20.3 (minibygget, `xlsx.mini.min.js`) | Apache 2.0 | Excel-export och inläsning av Excel-filer (.xlsx) | https://sheetjs.com |
| JSZip | 3.10.2 | MIT (JSZip är dubbellicensierat MIT eller GPLv3; verktyget använder MIT) | ZIP-export och packning av Word-utkastet (.docx) | https://stuk.github.io/jszip/ |
| D3 | 7.9.2 (hela biblioteket, `d3.min.js`) | ISC | Alla diagram (diagramkärnan, ADR-39) | https://d3js.org/ |

Filerna i `vendor/` är låsta med kontrollsummor i `vendor/SHA256SUMS`. Den som uppgraderar ett bibliotek
uppdaterar kontrollsummorna (`cd vendor && sha256sum *.js *.txt > SHA256SUMS`) och versionen i tabellen ovan i
samma ändring.

De fullständiga licenstexterna, som licenserna kräver ska följa med varje kopia, står i `src/licenser.txt`.
Bygget lägger in dem i `dist/oppen-lonekartlaggning.html`, där de visas under *Om verktyget → Referenser →
Licenstexter*.

Utvecklingsverktygen i `devDependencies` (bland annat vitest, eslint, jsdom, axe-core, playwright och typescript)
används bara för test, lint och typkontroll och ingår inte i den byggda filen.
