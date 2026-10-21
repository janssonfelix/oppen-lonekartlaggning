# Licenser

**Öppen lönekartläggning** är öppen källkod under **MIT-licensen** (se `LICENSE` och `NOTICE`).
Copyright 2026 Felix Jansson.

Verktyget använder följande öppna bibliotek. Samtliga är godkända för **kommersiell användning**
och får ingå i ett MIT-licensierat verk (MIT, zlib, Apache 2.0 och ISC är tillåtande licenser;
JSZip används under MIT, inte GPLv3).

> Den här filen är en översikt. **De fullständiga licenstexterna** — som licenserna kräver ska
> följa med varje kopia — står i `src/licenser.txt` och byggs in i
> `dist/oppen-lonekartlaggning.html`, där de visas under *Om verktyget → Referenser →
> Licenstexter*. Utdragen nedan är förkortade.
>
> Filerna i `vendor/` är låsta med kontrollsummor i `vendor/SHA256SUMS`. Den som uppgraderar
> ett bibliotek uppdaterar filen (`cd vendor && sha256sum *.js *.txt > SHA256SUMS`) i samma
> ändring.
---

## PapaParse

- **Version:** 5.7.0
- **Licens:** MIT
- **Webb:** https://www.papaparse.com
- **Användning i verktyget:** CSV-parsning av lönefilen, det lönepolitiska ställningstagandet och jämförelsestatistiken
- **Storlek:** ~19 KB minified

```
The MIT License (MIT)
Copyright (c) Matt Holt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## SheetJS Community Edition (XLSX.js)

- **Version:** 0.20.3, Community Edition, minibygget (fil: `xlsx.mini.min.js`)
- **Licens:** Apache 2.0
- **Webb:** https://sheetjs.com / https://sheetjs.com/community
- **Användning i verktyget:** Excel-export (multi-flik) och inläsning av Excel-filer (.xlsx): lönefilen, ställningstagandet och jämförelsestatistiken
- **Storlek:** ~273 KB minified
- **Anmärkning:** Detta är **Community Edition** som är fri för kommersiell användning. SheetJS Pro är en separat betalprodukt med fler funktioner men behövs inte för verktyget.

---

## JSZip

- **Version:** 3.10.2
- **Licens:** MIT eller GPLv3 (dual-licensed) — vi väljer **MIT** för kommersiell användning
- **Webb:** https://stuk.github.io/jszip/
- **Användning i verktyget:** ZIP-export av analyser (grafer som PNG + Excel-tabeller) och packning av Word-utkastet (.docx)
- **Storlek:** ~95 KB minified

```
JSZip is dual-licensed. You may use it under the MIT license OR the
GPLv3 license.

The MIT License
===============
Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger,
António Afonso

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software...
```

---

## D3

- **Version:** 7.9.0 (fil: `d3.min.js`, hela biblioteket)
- **Licens:** ISC
- **Webb:** https://d3js.org/
- **Används till:** alla diagram (diagramkärnan, ADR-39)

Copyright 2010-2023 Mike Bostock. Hela licenstexten finns i verktyget under *Om verktyget → Licenstexter*.

---

## Sammanfattning för kommersiell användning

| Bibliotek | Licens | Krav | Royalties |
|---|---|---|---|
| PapaParse | MIT | Behåll copyright-notis | Inga |
| SheetJS CE | Apache 2.0 | Behåll copyright-notis + NOTICE-fil om sådan finns | Inga |
| D3 | ISC | Behåll copyright-notis | Inga |
| JSZip | MIT | Behåll copyright-notis | Inga |

**Inga royalty-betalningar krävs.** Inga begränsningar gällande antal användare, geografi eller bransch.

**Endast krav:** Behåll license-headers i bundlade filer (sker automatiskt eftersom bundlern inlinar biblioteken ordagrant och inte minifierar JS).

**Utvecklingsverktyg (distribueras inte):** vitest, eslint, globals, jsdom, axe-core och playwright
används endast för test/lint under utveckling (devDependencies) och ingår
**inte** i det distribuerade bygget `oppen-lonekartlaggning.html` — de omfattas
därför inte av distributionskraven ovan.

---

## Verktygets egen licens

Egen kod (`src/`, `tools/`, `tests/`) är licensierad under **MIT-licensen**. Copyright 2026 Felix Jansson. Se `LICENSE` och `NOTICE`; varje källfil bär licensraden (SPDX).
