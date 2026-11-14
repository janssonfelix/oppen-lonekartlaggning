# Skydden

De fem grundläggande skydden. De går före arkitekturbesluten i [`arkitekturbeslut.md`](arkitekturbeslut.md): ett
beslut får inte strida mot ett skydd, och ett skydd ändras bara genom ett eget, daterat beslut av underhållaren
(`.github/GOVERNANCE.md`), aldrig i förbigående i en ändring. Andra texter pekar hit i stället för att upprepa.

Varje skydd har en vakt, och det som inte vaktas står utskrivet. Ett skydd som är juridiskt bindande (S2, S4) ska
vaktas av *invarianter* som gäller hela utdatan, inte av stickprov på enskilda vyer: en ny vy ska ärva skyddet utan
att någon kommer ihåg att testa den. Det här dokumentet är källan för skyddens vakter; varje sökväg det nämner prövas
av `tests/dokumentation-struktur.test.js`.

## S1. Inga nätverksanrop

Verktyget gör inga nätverksanrop, och det ska gå att verifiera i bygget. Byggets CSP har `connect-src 'none'`:
webbläsaren blockerar all utgående trafik. Det är en hård teknisk barriär mot exfiltrering, inte ett löfte.

*Varför:* lönedata lämnar aldrig datorn. *Beslut:* ADR-9 (hash-baserad `script-src`), ADR-30 (stilar med
kontrollsumma), ADR-1 (ingen arbetstråd). Hela policyn och vad den inte täcker: `docs/dataskydd/riskanalys.md` §6.1.
*Vakt:* webbläsarröktestet, `tools/browser-smoke/sakerhet.mjs`: inga nätverksförfrågningar under hela körningen,
inga CSP-överträdelser, och en arbetstråd, ett injicerat skript och en injicerad händelsehanterare stoppas.
Testet *byggets CSP släpper inte nätet* i `tests/sakerhet.test.js`: `default-src` och `connect-src` är `'none'` (också i
källans CSP, som bygget ärver dem från), `script-src` har bara kontrollsummor, och inget direktiv har `*`, `'self'`,
ett nätschema eller ett värdnamn; stilarnas del av CSP:n prövas i samma fil. Linten (`eslint.config.js`) förbjuder
`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` och `new Worker`/`new SharedWorker` i
`dist/app.js` och `src/lib/`.
*Vaktas inte:* linten ser bara direkta anrop med de namnen (inte till exempel `window['fetch']` eller ett alias), och
tredjepartsbiblioteken i `vendor/` lintas inte; där är CSP:n och röktestet vakten. Röktestet körs i CI och med
`npm run test:browser`, inte i `npm test`.

## S2. Ingen lagring

Verktyget sparar ingenting mellan sessioner. Varken verktygets kod eller de inbyggda biblioteken skriver till
webbläsarens lagring. Som reserv kastar lagringsspärren fel vid varje skrivning till `localStorage` och
`sessionStorage`, också vid direkt tilldelning, och när `document.cookie` sätts. Spärren har inga undantag; den är
en snubbeltråd mot misstag, inte det egentliga skyddet.

*Varför:* lönedata lämnar aldrig datorn, inte heller till en lagring som finns kvar när fliken stängts.
*Beslut:* ADR-1 (en arbetstråd skulle stå utanför spärren). Spärren i detalj: `docs/dataskydd/riskanalys.md` §6.2.
*Vakt:* lagringsspärren i `tests/sakerhet.test.js` (varje `setItem` och varje direkt tilldelning kastar, ingenting
lagras); `tools/browser-smoke/sakerhet.mjs` (spärren också för cookies, och lagringen är tom efter en full körning).
Linten (`eslint.config.js`) förbjuder `indexedDB` och `caches`, också som `window.indexedDB` och `window.caches`, i
`dist/app.js` och `src/lib/`.
*Vaktas inte:* IndexedDB och Cache API ligger utanför spärren. Linten ser bara direkta anrop med de namnen, och
tredjepartsbiblioteken i `vendor/` lintas inte; där täcks det av kodgranskning, inte av ett test (riskanalysen
§6.2).

## S3. En fil, utan server

Verktyget är en enda HTML-fil som körs lokalt, utan server och utan molntjänst, med alla bibliotek inbyggda och
inga externa resurser. Den går att öppna från `file://` och fungerar utan internet.

*Varför:* utan server och nät har lönedata ingen väg ut, och filen kan köras där lönefilen redan finns.
*Beslut:* ADR-6 och ADR-8 (`app.js` och lib-speglarna som klassiska skript, utan ES-moduler i bygget).
*Vakt:* webbläsarröktestet, `tools/browser-smoke.mjs`, öppnar den byggda filen från `file://` och kör alla flikar
och exporter; artefaktgrinden i `.github/workflows/ci.yml` kräver att en färsk build ger samma `dist/` som den
incheckade, artefakten och `RELEASE.txt`.
*Vaktas inte:* röktestet körs i CI och med `npm run test:browser`, inte i `npm test`.

## S4. Minsta gruppstorlek i allt som lämnar verktyget

Inget som lämnar verktyget redovisar ett lönemått för en grupp, eller ett könsuppdelat lönemått för ett kön, med
färre personer än den inställda tröskeln (standard 10). På skärmen visas alla grupper: den som arbetar i verktyget
har redan lönefilen. Undantagen är uppräknade och beslutade. Ett lönemått får inte heller gå att räkna fram ur
summorna i samma export (Löneöversyns blad *Fördelning*). Antal och andelar, också per kön, omfattas inte av skyddet
utöver de beslutade golven; den som gör kartläggningen ansvarar för vad som lämnas ut (ADR-70).

*Varför:* att förhindra återidentifiering i det som sprids.
*Lydelse:* [`k-troskeln.md`](k-troskeln.md). *Beslut:* ADR-12, 14, 23, 38, 47, 48,
51, 57, 69, 70.
*Vakt:* invarianten I4, `tests/helpers/ktroskel-invariant.js`, ritar flikarna i exportläget och bygger exporterna
vid tröskeln 10 (`tests/ktroskel-invarianter.test.js`) och 25 (`tests/ktroskel-invarianter-25.test.js`);
differentialtesterna i `tests/diagramritare.test.js` kräver att det som lämnar verktyget är identiskt med en figur
där de små punkterna tagits bort; `tests/ktroskel-bas-effekter.test.js` (regressionens BAS-effekter),
`tests/ktroskel-loneoversyn-summor.test.js` (Löneöversyns summor), `tests/ktroskel-livscykel.test.js` (livscykelns
lönekurva) och `tests/ktroskel-loneoversyn-scenarier.test.js` (scenariojämförelsen A/B) prövar lönemått som I4 inte
ser.
*Vaktas inte:* invarianten letar efter de små gruppernas lönevärden, så antal, andelar och namn vaktas inte av den
(de omfattas inte av skyddet, ADR-70), och inte heller ett lönemått som bara går att räkna fram som en differens;
golven i antal (ADR-57) har egna tester. Innehållet i bilder prövas inte. De beslutade undantagen ligger utanför (`docs/dataskydd/dataskydd.md` §3). Vad mer
som inte prövas står i testfilerna och i `docs/dataskydd/riskanalys.md` §6.5.

## S5. Ingen inbyggd organisation

Verktyget har ingen inbyggd organisation och ingen inbyggd referens. Allt som är en viss organisations
(ställningstagande, statistik, benämningar, inställningar) kommer ur användarens egna filer, aldrig ur koden eller
dokumenten. Repot har inga namn på organisationer, arbetsgivare eller lönesystem, utom de undantag som står i
`.github/CONTRIBUTING.md`.

*Varför:* verktyget ska kunna användas av vilken arbetsgivare som helst.
*Beslut:* ADR-28.
*Vakt:* *namnen: inga hårdkodade etiketter* i `tests/sakerhet.test.js` (etiketterna läser `orgNamn` och `jmfNamn`);
*organisationsneutralt standardläge* i `tests/smoke-organisation.test.js` (ingen inbyggd referens, neutral profil).
*Vaktas inte:* att inga namn står i repot prövas inte av något test; det granskas.
