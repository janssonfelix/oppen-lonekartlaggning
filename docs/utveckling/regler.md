# Regelmatrisen

Varje bindande regel i projektet, med källan där den står och vakten som fäller en ändring som bryter den. En regel
står i sin källa; matrisen upprepar den inte, den pekar på källan och på vakten. Lydelsen, undantagen och skälen
läses i källan. Skydden S1–S5 står i [`skydd.md`](skydd.md), besluten i [`arkitekturbeslut.md`](arkitekturbeslut.md)
och kvalitetskraven K1–K10 i [`teknisk-plan.md`](teknisk-plan.md) §7.

En regel som ingen vakt prövar står med `ingen: text` i kolumnen *Vakt*, så att luckan syns. *Vaktas inte* säger
vad i regeln som faller utanför vakten.

**Lägga till en rad.** Ge regeln nästa lediga id: `S` följt av skyddets nummer i `skydd.md`, annars `R` följt av
nästa nummer. Ett id byts aldrig och återanvänds inte, inte heller när en regel stryks (raden tas bort, numret står
tomt). *Källa* är ett dokument med avsnitt och ADR-nummer skrivna `ADR-n`. *Vakt* är en eller flera sökvägar inom
backtick, relativa repots rot och åtskilda med kommatecken, med förklaring inom parentes efter sökvägen; eller
`ingen: text`. Varje vaktfil under `tests/` och i webbläsarröktestet (`tools/browser-smoke.mjs`,
`tools/browser-smoke/`) får i filhuvudets kommentar en rad `Vaktar: <id>[, <id>…] (docs/utveckling/regler.md)`,
med bara id, inga sökvägar. `tests/regler.test.js` kräver att raden stämmer i båda riktningarna: varje sökväg finns,
varje vaktfil bär radens id, varje märkning pekar på en rad där filen står som vakt, varje ADR finns och varje skydd
i `skydd.md` har sin rad. Testet prövar strukturen, aldrig formuleringarna.

| Id | Regel | Källa | Vakt | Vaktas inte |
|---|---|---|---|---|
| S1 | Inga nätverksanrop. | `skydd.md` S1, teknisk-plan §7 K2, ADR-1, ADR-9, ADR-30 | `tests/sakerhet.test.js` (byggets CSP släpper inte nätet), `tools/browser-smoke/sakerhet.mjs` (inga förfrågningar, inga CSP-överträdelser), `eslint.config.js` (förbjudna nät-API) | Indirekta anrop (`window['fetch']`, alias) och `vendor/` i linten; röktestet körs inte i `npm test` |
| S2 | Ingen lagring mellan sessioner. | `skydd.md` S2, teknisk-plan §7 K2, ADR-1 | `tests/sakerhet.test.js` (lagringsspärren), `tools/browser-smoke/sakerhet.mjs` (cookies, tom lagring efter körningen), `eslint.config.js` (`indexedDB`, `caches`) | IndexedDB och Cache API ligger utanför spärren; `vendor/` lintas inte |
| S3 | En fil, utan server, som fungerar från `file://` utan nät. | `skydd.md` S3, teknisk-plan §7 K6, ADR-6, ADR-8 | `tools/browser-smoke.mjs` (den byggda filen från `file://`), `tools/browser-smoke/laddning.mjs` (laddning under CSP:n), `.github/workflows/ci.yml` (artefaktgrinden) | Röktestet körs inte i `npm test` |
| S4 | Minsta gruppstorlek i allt som lämnar verktyget. | `skydd.md` S4, `k-troskeln.md`, teknisk-plan §7 K7, ADR-12, ADR-14, ADR-23, ADR-38, ADR-47, ADR-48, ADR-51, ADR-57, ADR-69, ADR-70 | `tests/helpers/ktroskel-invariant.js` (I4), `tests/ktroskel.test.js`, `tests/ktroskel-bilder.test.js`, `tests/ktroskel-exporter.test.js`, `tests/ktroskel-hojning.test.js`, `tests/ktroskel-invarianter.test.js`, `tests/ktroskel-invarianter-25.test.js`, `tests/ktroskel-kon.test.js`, `tests/ktroskel-regression.test.js`, `tests/ktroskel-utdata.test.js`, `tests/kanonymitet.test.js`, `tests/troskelbeslut.test.js`, `tests/loneoversyn-forslag-troskel.test.js` (Löneöversyns förslag, ADR-69), `tests/diagramritare.test.js` (differentialtesterna), `tests/diagramvyer-marken.test.js` (könsfördelningen per BAS-intervall, ADR-57), `tests/ktroskel-bas-effekter.test.js` (regressionens BAS-effekter, ADR-70), `tests/ktroskel-loneoversyn-summor.test.js` (Löneöversyns summor, ADR-70), `tests/ktroskel-livscykel.test.js` (livscykelns lönekurva, ADR-70), `tests/ktroskel-loneoversyn-scenarier.test.js` (Löneöversyns scenariojämförelse, ADR-70) | Antal, andelar och namn (utanför skyddet, ADR-70); lönemått som bara går att räkna fram som en differens, utom i Löneöversyns summor och scenariojämförelse; innehållet i bilder; de beslutade undantagen |
| S5 | Ingen inbyggd organisation, och inga namn på organisationer eller lönesystem i repot. | `skydd.md` S5, `CONTRIBUTING.md`, ADR-28 | `tests/sakerhet.test.js` (inga hårdkodade etiketter), `tests/smoke-organisation.test.js` (organisationsneutralt standardläge) | Namn i repot; det granskas |
| R1 | Ny utdata läggs i k-invariantsviten och i riskanalysens tabell över utdata. | `CONTRIBUTING.md` punkt 3 (Definition of Done), teknisk-plan §7 K7 | `tests/ktroskel-exporter.test.js` (riggens flikar mot menyn) | Exportvägarna i riggen och riskanalysens tabell |
| R2 | Verklig data checkas aldrig in. | `CONTRIBUTING.md` (Det här checkas aldrig in) | `tests/dokumentation-struktur.test.js` (inga datafiler i git, `.gitignore`) | Personuppgifter i andra filformat |
| R3 | Ändringar görs i `src/`, aldrig i `dist/`. | `CONTRIBUTING.md` punkt 2, ADR-6 | `tests/appsource.test.js`, `.github/workflows/ci.yml` (artefaktgrinden: hela `dist/` är ett färskt bygge) | – |
| R4 | `src/lib/` är den enda källan för kärnan; speglarna genereras. | ADR-8 | `tests/drift.test.js` | – |
| R5 | Skript körs bara med kontrollsumma i CSP:n. | ADR-9 | `tests/sakerhet.test.js` (script-src), `tools/browser-smoke/sakerhet.mjs` (injicerat skript stoppas) | – |
| R6 | Stilar med kontrollsumma, inga stilattribut; låsta bibliotek och CI-steg. | ADR-30 | `tests/sakerhet.test.js` (stilarna, `vendor/SHA256SUMS`, bibliotekens versioner i dokumenten, CI- och release-stegen) | – |
| R7 | Inga paragrafhänvisningar i gränssnitt, hjälptexter och exporter; lagrummen står bara i `lagrum.md`. | ADR-16 | `tests/smoke-vyer.test.js` (gränssnittet), `tests/dokumentation-sprak.test.js` (paragrafer och artiklar i användartexten) | Att lagrummen inte står någon annanstans i utvecklardokumenten |
| R8 | Formler i CSV och urklipp neutraliseras. | ADR-15 | `tests/smoke.test.js`, `tests/talformat.test.js` | – |
| R9 | Regressionen cachas aldrig. | ADR-17 | `tests/forhandsvisning.test.js` (en körning per funktion) | Förbudet i sig; testet ser antalet körningar |
| R10 | Färgerna har en källa. | ADR-43 | `tests/farger.test.js` | – |
| R11 | `VERSION` är enda källan för versionen. | ADR-13, `CONTRIBUTING.md` (Var uppgifterna står) | `tests/version.test.js` (CalVer, stämpeln och `package.json`) | Att `CHANGELOG.md` och riskanalysen anger versionen; det prövas först vid release (R14) |
| R12 | Interna fel rapporteras i stället för att sväljas. | ADR-31 | `tests/smoke-ansvar.test.js`, `tools/browser-smoke/sakerhet.mjs` (inga interna fel under körningen) | – |
| R13 | Dokumentationen beskriver den byggda versionen. | teknisk-plan §7 K4 | `tests/dokumentation-struktur.test.js` (filer, skript, tröskeltal, nummer) | Sakmotsägelser mellan dokumenten; riskanalysens bygge och kontrollsumma, som prövas först vid release (R14) |
| R14 | Riskanalysen granskas mot koden före varje release. | teknisk-plan §9 punkt 17b | `tools/release.mjs` (release-grinden), `tests/release.test.js` | Själva granskningen; grinden ser datum, bygge och kontrollsumma, och bara vid release |
| R15 | Alla diagram ritas av diagramkärnan. | ADR-39, `diagramkarnan.md` §8 | `tests/sakerhet.test.js` (inget ritas förbi kärnan) | Att varje vy har ett eget vakttest |
| R16 | Tillgänglighet enligt WCAG 2.1 AA. | teknisk-plan §7 K8, ADR-10 | `tests/a11y.test.js` (axe-core över alla flikar), `tests/sakerhet.test.js` (statusfärgernas kontrast) | Övrig färgkontrast prövas för hand |
| R17 | Byggstegen är gröna före en ändring: `npm run kontroll`. | `CONTRIBUTING.md` punkt 3 (Definition of Done), `GOVERNANCE.md` | `.github/workflows/ci.yml`, `tools/kontroll.mjs` (kedjan lokalt, med artefaktgrinden över hela `dist/` och teckenkodningsgrinden), `tests/dokumentation-struktur.test.js` (kedjan har CI:s steg) | Att stegen körs lokalt före en pull request |
| R18 | Varje ändring har en rad i `CHANGELOG.md` under *Oförlöst*. | `CONTRIBUTING.md` punkt 3 (Definition of Done), `GOVERNANCE.md` | ingen: text | Allt |
| R19 | Ett beslut ändras bara genom ett nytt, daterat beslut; numren står kvar. | `GOVERNANCE.md` (Vem beslutar, När ett beslut förs in), ADR-68 | `tests/dokumentation-struktur.test.js` (index, status, inga datum i rubrikerna) | Ändringar på plats i ett befintligt beslut; att checklistan följs |
| R20 | De statistiska formlerna är spårbara och dokumenterade. | teknisk-plan §7 K1, `regressionsmodellen.md` | `tests/stat-referens.test.js` (mot etablerade implementationer) | Att formlerna är dokumenterade |
| R21 | Kärnalgoritmerna har enhetstester som speglar den gällande modellen. | teknisk-plan §7 K3, `regressionsmodellen.md` §11 | `tests/stat.test.js`, `tests/regression.test.js`, `tests/stat-referens.test.js` | Att testerna följer med när modellen ändras |
| R22 | Bygget är reproducerbart. | teknisk-plan §7 K9 | `.github/workflows/ci.yml` (artefaktgrinden: en färsk build ger samma `dist/`, också `RELEASE.txt`) | – |
| R23 | Klarspråk och ordval: inga avförda ord, juridiska formuleringar hålls övergripande. | teknisk-plan §7 K10 | `tests/dokumentation-sprak.test.js` (avförda ord), `tests/juridiksprak.test.js` | Om en text är begriplig |
| R24 | Varje källfil bär licensraden (SPDX). | `CONTRIBUTING.md` punkt 3 (Definition of Done) | `tests/dokumentation-struktur.test.js` | – |
| R25 | Ålder är valfri i lönefilen. | ADR-64, `regressionsmodellen.md` §8 | `tests/ktroskel-utan-alder.test.js` (varje utdataväg utan ålder), `tests/regression.test.js` (modellerna utan ålder) | – |
| R26 | Ett nytt eller ändrat diagram ses i webbläsaren med många grupper. | `CONTRIBUTING.md` punkt 3 (Definition of Done), ADR-42 | ingen: text | Allt; det görs för hand |
| R27 | Planer och designdokument ligger utanför repot, i den ignorerade mappen `privat/`. | `CLAUDE.md` (Arbetsmaterial) | ingen: text | Allt |
| R28 | Status för en skillnad mellan kvinnors och mäns lön sätts på statistisk signal och storleksgränsen 3 %, aldrig på storleken ensam; 5 % är bara direktivmarkeringen vid ojusterade medianskillnader. | ADR-59, ADR-71 | `tests/status-trappa.test.js` (trappan, direktivmarkeringen, ingen färgklass i appen på en skillnad över 5 % ensam, ingen färg- eller viktklass i Lönestruktur på en skillnad jämförd med en storleksgräns), `tests/livscykel.test.js` (livscykelns nyckeltal och samspelet) | Färg eller status på storleken i andra former än vaktens mönster (`Math.abs(…) > 5 ?` följt av en färgklass); Utforska och *Skillnad kön*, som enligt besluten (ADR-59, ADR-71) visar storlek utan prövning |
