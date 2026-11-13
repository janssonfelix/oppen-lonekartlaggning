# Instruktioner för AI-assistenter

- **Neutralt verktyg.** Öppen lönekartläggning är skriven för alla arbetsgivare och är inte kopplad till någon
  särskild organisation. Skriv aldrig namn på organisationer, arbetsgivare eller lönesystem i kod, tester, exempel,
  commitmeddelanden eller dokument; skriv "organisationen" eller "arbetsgivaren", och använd påhittade, uppenbart
  syntetiska data. Tre undantag: lönesystem får namnges i uttagsguiden (`docs/anvandare/datauttag.md`) och där
  den citeras, som system, aldrig som någons kund eller arbetsgivare; källan till jämförelsestatistiken får namnges
  som källa; demodatan har en påhittad organisation. Se `.github/CONTRIBUTING.md`.
- **Lönedata lämnar aldrig datorn**, och varje ny utdata prövas mot k-tröskeln (`.github/CONTRIBUTING.md`, punkt 3).
- Läs `docs/utveckling/arkitekturbeslut.md` (arkitekturbesluten) innan du ändrar beteende.
- Skriv på svenska, i samma stil som omgivande kod och dokument.

**Skydden** går före allt annat, också arkitekturbesluten. En ändring som rör ett skydd tas upp med underhållaren
innan den görs. Regel, vakt och undantag står i `docs/utveckling/skydd.md`.

- **S1. Inga nätverksanrop:** byggets CSP stänger all utgående trafik.
- **S2. Ingen lagring:** ingenting sparas mellan sessioner.
- **S3. En fil, utan server:** en HTML-fil som fungerar från `file://` utan nät.
- **S4. Minsta gruppstorlek i allt som lämnar verktyget:** k-tröskeln, standard 10.
- **S5. Ingen inbyggd organisation:** det organisationsspecifika kommer ur användarens filer.

**Klart betyder** Definition of Done i `.github/CONTRIBUTING.md` punkt 3. Kör `npm run kontroll` före en pull
request och `npm run kontroll -- --snabb` under arbetet. Ändra i `src/`, aldrig i `dist/` eller
`src/app/09-lib-speglar.js`, och kör `npm run build:app` efter en ändring i `src/`.

| Innan du ändrar … | läs |
|---|---|
| något som lämnar verktyget (text, tabell, bild, fil) | `docs/utveckling/skydd.md` S4, `docs/utveckling/k-troskeln.md`, `docs/utveckling/diagramkarnan.md` §1 och §7–8, k-riggen `tests/helpers/ktroskel-rigg.js` |
| ett diagram | `docs/utveckling/diagramkarnan.md` §1, §7–8 och §10 |
| regressionen eller annan statistik | ADR-44, ADR-45, ADR-46, ADR-53, ADR-56, ADR-63, ADR-64 och ADR-17 (regressionen cachas aldrig); `docs/utveckling/teknisk-plan.md` §5; `tests/stat-referens.test.js` |
| `src/index.html`, stilmallen (`src/style.css`) eller CSP:n | `docs/utveckling/skydd.md` S1, ADR-9, ADR-30, ADR-43 |
| text som användaren läser | ADR-16, `docs/utveckling/lagrum.md`, de avförda orden i `tests/dokumentation-sprak.test.js` |
| bygget eller testmiljön | `docs/utveckling/teknisk-plan.md` §6, `src/app/README.md` |
| organisationspaketet, namn och etiketter | `docs/utveckling/skydd.md` S5, ADR-28, ADR-47 |

**Regler och vakter:** `docs/utveckling/regler.md` säger vilket test som vaktar vilken regel. En ny bindande regel
får en rad där.

**Ett beslut som ändras** förs in enligt *När ett beslut förs in* i `.github/GOVERNANCE.md`.

**Arbetsmaterial:** planer, designdokument, granskningar och skisser läggs i den ignorerade mappen
`privat/utveckling/`, aldrig i repot och aldrig i en pull request.
