# Organisationsfil — verktyget med organisationspaketet inbakat

> Formatspecifikation och beteende för organisationsfilen (ADR-49 i [`arkitekturbeslut.md`](arkitekturbeslut.md)).
> Hänvisningar till *paketet* avser organisationspaketet
> ([`organisationspaket.md`](../anvandare/organisationspaket.md), ADR-28 och ADR-47). Riskanalysen §6.9
> beskriver skydden; den här sidan beskriver vad filen är och hur den fungerar.

## 1. Avsikt

Utan organisationsfil sprids två filer till handläggarna: verktyget (`oppen-lonekartlaggning.html`) och
organisationspaketet (`<org>.lonepaket.json`). Paketet måste då både spridas och läsas in som ett eget
steg, och det steget glöms eller görs fel. Organisationsfilen är **en fil som bara öppnas och är färdig**:
systemförvaltaren tar fram den en gång, och det är den som sprids.

En fil som öppnas från disk kan inte läsa andra filer i samma mapp — webbläsaren förbjuder det, och
verktygets egen policy (`connect-src 'none'`) stänger all hämtning. Automatisk inläsning av en fil
bredvid är därför inte möjlig, och den begränsningen är ett medvetet skydd (skyddet S1 i
[`skydd.md`](skydd.md)). Paketet måste ligga **inuti** HTML-filen.

## 2. Mål, icke-mål, antimål

**Mål**
- Systemförvaltaren skapar organisationsfilen i verktyget, utan utvecklarkunskap, i en egen flik med tre steg,
  och flyttar den till en ny version med bara den gamla organisationsfilen och den nya releasefilen.
- Handläggaren öppnar organisationsfilen och har benämningar, ställningstagande, jämförelsestatistik
  och låsningar på plats, utan att läsa in något.
- Det inbakade paketet går att granska i verktyget och ladda ner som fil, så att det kan kontrolleras
  och ändras.
- Allt skydd gäller oförändrat: inga nätverksanrop, ingen lagring, skriptens kontrollsummor i CSP:n
  orörda, k-tröskel och låsningar som för ett inläst paket.

**Icke-mål**
- Ingen verifiering av organisationsfilen mot den publicerade versionens kontrollsumma eller
  signatur i verktyget (beslut, ADR-49): att filen kommer från systemförvaltaren internt räcker. Spårbarhet ges
  i stället genom att filen anger vilken version av verktyget den bygger på. IT kan kontrollera filen för hand:
  utan blocket är den byte för byte releasefilen (`organisationspaket.md` avsnitt 3b, *IT:s kontroll av
  organisationsfilen*; prövat i `tests/organisationsfil.test.js`).
- Ingen automatisk inläsning av filer i samma mapp (omöjligt och oönskat).
- Ingen ändring av paketets format eller innehåll.

**Antimål** (det som gör lösningen till ett misslyckande även om den fungerar)
- Lönedata eller något annat ur en lönefil bakas in. Organisationsfilen bär exakt det som paketet
  bär: aggregat, benämningar och inställningar. En inbakning som skulle ta med rader ur `state.data`
  är ett fel, inte en funktion.
- Inbakningen ändrar något skript i filen. Då bryts CSP-hasharna och verktyget startar inte.

## 3. Hur det ser ut för användaren

**Systemförvaltaren** i fliken *För systemförvaltaren*, sist i menyn (nås också från *Om verktyget* och från en
rad i steg 1 i Filer och kvalitet; `granssnittet.md` §1):
1. **Steg 1, Paketet:** läser in ställningstagande, statistik eller ett befintligt paket och fyller i formuläret.
   När filen som körs är en organisationsfil är det inbakade paketet förvalt. Paketet kan sparas som fil (valfritt).
2. **Steg 2, Verktygsfilen:** väljer den HTML-fil som är öppen, eller en nyare version. Filväljaren behövs eftersom
   en sida från disk inte kan läsa sig själv; texten i steget säger det.
3. **Steg 3, Ladda ner:** fältet *Filnamn* (förslaget `oppen-lonekartlaggning-<organisation>.html`) och knappen
   *Ladda ner organisationsfilen*. Verktyget kontrollerar att den valda filen är verktyget (CSP-metataggen och
   versionsstämpeln finns), tar bort ett eventuellt tidigare inbakat paket, lägger in det gällande paketet och
   laddar ner resultatet. Beskedet säger vad filen innehåller: organisation, paketets datum, verktygets version, att
   ingen lönedata ingår, och om den valda filen är en annan version än den som körs.
4. **Flytta till en ny version:** en ruta med två filval, den gamla organisationsfilen och den nya verktygsfilen,
   ett filnamn och knappen *Ladda ner den nya organisationsfilen*. Paketet läses ut ur den gamla filen, prövas som
   vid inläsning (`tolkaPaket`) och bakas in oförändrat i den nya (`flyttaOrganisationsfil`). Beskedet anger
   organisation, paketets datum, den gamla och den nya versionen och att ingen lönedata ingår, och säger till om
   den nya filen är äldre än den gamla (det tillåts). En gammal fil utan inbakat paket ger ett fel och ingen
   nedladdning. Flytten rör varken sessionens paket eller en inläst lönefil.

**Handläggaren** öppnar organisationsfilen:
- Paketet läses in vid start, tyst, på samma väg som en inläst paketfil (samma validering, samma
  bekräftelsefrågor om tröskeln sänks, samma låsningar).
- Filrutan för organisationspaketet i Filer och kvalitet visar *Inbakat i den här filen: Exempelkommunen,
  2026-10-19* med två knappar: **Visa paketet** (öppnar paketets innehåll i en läsbar vy: organisation,
  benämningar, inställningar och låsningar som tabell, ställningstagandet och statistiken som
  tabeller, och råtexten i JSON under en utfällbar rad) och **Ladda ner paketet** (sparar
  `<org>.lonepaket.json`, så att det kan granskas, ändras och bakas in på nytt).
- Är paketets år (`avserAr`) äldre än året enligt datorns klocka visar filrutan *Paketet avser {år}. Kontrollera
  med systemförvaltaren att det är det som gäller.* För förra årets paket visas raden först från och med 1 mars
  (`paketArGammalt` i `src/lib/organisationspaket.js`). Raden är en upplysning: den stoppar ingenting och kommer
  inte in i Att göra. Ett paket utan år får ingen rad.
- Den som läser in en annan paketfil ersätter det inbakade för sessionen; beskedet säger
  *Ersätter det inbakade paketet*. *Rensa all data* går tillbaka till det inbakade paketet, eftersom
  det är en del av filen.
- *Om verktyget* får avsnittet *Organisationsfil*: organisation, paketets datum, skapad datum,
  verktygets version som filen bygger på och den versionens kontrollsumma.

**Demoläget** (`?demo=1`) går före: demodata och demoreferens som i dag, det inbakade paketet
ignoreras med ett besked. Så kan en organisationsfil ändå visas i demoläge.

## 4. Teknik

**Var paketet ligger.** Som en inaktiv datablock sist i filen, efter sista `</script>` och efter
`<template id="licenstexter">`:

```html
<template id="inbakat-organisationspaket" data-skapad="2026-10-19" data-organisation="Exempelkommunen"
          data-verktygsversion="2026.10.13" data-verktygssha="…">{ …paketets JSON… }</template>
```

Ett `<template>` tolkas inte och exekveras inte; innehållet är text. Skriptens hashar i CSP:n
påverkas inte eftersom inget skript ändras (samma mönster som licenstexterna, prövat i
`tests/dokumentation-struktur.test.js`). JSON-texten skrivs med `<` som `<` och `</` kan därmed inte
avsluta elementet.

**Ren kärna i `src/lib/organisationsfil.js`** (importerad av appen som övriga lib-moduler, ADR-98):
- `bakaIn(html, paketJson, meta)` → `{ ok, html, fel?, varning? }`: kontrollerar att `html` är
  verktyget (CSP-metataggen, `APP_VERSION`-mönstret), läser versionen ur filen, tar bort ett tidigare
  `<template id="inbakat-organisationspaket">`, lägger in det nya före `</body>`, returnerar resultatet.
  Rör aldrig något mellan `<script` och `</script>`; ett test bakar in och hävdar att varje
  skriptblock är byte-identiskt före och efter.
- `lasUt(html)` → `{ json, meta } | null`: läser blocket ur en HTML-text (används av tester och av
  startläsningen genom DOM:en i appen).
- `filnamnForslag(organisation)` → `oppen-lonekartlaggning-<slug>.html`.
- `flyttaOrganisationsfil(gammalHtml, nyHtml, meta)` → `{ ok, html, franVersion, tillVersion, organisation,
  paketSkapat, aldreVersion } | { ok: false, fel }`: läser ut paketet ur den gamla filen med `lasUt`, prövar det
  med `tolkaPaket` och bakar in det med `bakaIn`. Ett paket som redan finns i den nya filen ersätts.

**Appen**
- `29-organisationspaket.js`: stegen i fliken *För systemförvaltaren* (`#view-forvaltare` i `index.html`) och
  rutan *Flytta till en ny version*, årsraden i filrutan, filväljarna och filnamnen, läsning av de valda filerna
  med `File.arrayBuffer` (ingen nätverksåtkomst), anrop till `bakaIn` och `flyttaOrganisationsfil`, nedladdning via `Blob` som övriga
  exporter, beskedet. Kontrollsumman för verktygsfilen räknas med `crypto.subtle.digest` när det
  finns (file:// är en säker kontext i Chrome, Firefox och Safari); saknas det skrivs `–`.
- `90-uppstart.js`: vid start, om `?demo=1` inte är satt och `#inbakat-organisationspaket` finns: läs
  `textContent`, anropa `lasInPaket(text, 'inbakat')` med `kalla: 'inbakat'`; status i filrutan.
  Fel i blocket (ogiltig JSON, ogiltigt paket) visas som fel i filrutan, verktyget startar ändå utan
  paket.
- `12-tillstand.js`: `state.paket.kalla` får värdet `'inbakat'` utöver `'fil'`; `referensKalla()`
  och `statistikBeskrivning()` säger *(inbakat i den här filen)*.
- `26-rensning.js`: efter rensningen läses det inbakade paketet in igen (utan bekräftelsefråga om
  tröskeln: filens eget värde gäller som vid start).
- `65-om-verktyget.js`: avsnittet *Organisationsfil*.
- Vyn *Visa paketet*: en modal (samma mönster som *Vad lagras?*) som ritar paketet ur `state.paket`
  och de inlästa delarna; råtexten ur `#inbakat-organisationspaket`.

**Dokument och vakter**
- `docs/anvandare/organisationspaket.md`: avsnitt 3b *Organisationsfil* (hur den skapas, sprids och granskas, och
  IT:s kontroll) och avsnitt 4 (flytten till en ny version); `korguide.md` §0 och README *Kom igång* steg 2 får alternativet "eller
  öppna organisationsfilen som er systemförvaltare tagit fram"; `pilotchecklista.md` en rad.
- `docs/dataskydd/riskanalys.md` §6.8 (konfigurationsfilen) får ett syskonavsnitt om
  organisationsfilen: innehåll, att lönedata aldrig ingår, att paketet valideras som vid inläsning,
  att blocket inte exekveras; `dataskydd.md` §3 en mening. `tests/dokumentation-struktur.test.js` vaktar att
  blocket ligger efter sista skriptet i en inbakad fil och att den publicerade byggfilen saknar det.
- `arkitekturbeslut.md`: ADR-49; `organisationspaket.md` beskriver hur filen skapas, sprids och uppdateras.
- Tester: `tests/organisationsfil.test.js` (ren kärna: inbakning, borttagning av tidigare block,
  oförändrade skript, avvisning av fel fil, versionsläsning, `<`-escapning); röktest
  (`tests/organisationspaket-app.test.js`): baka in i jsdom ur `dist/oppen-lonekartlaggning.html`, öppna
  resultatet i ett nytt appfönster via harnessen och hävda att paketet lästs in, att *Visa paketet*
  och nedladdningen fungerar, att en annan fil ersätter det, att *Rensa all data* återställer det, och
  att `?demo=1` går före; k-tröskeltest att ett inbakat paket med `kTroskel` under 10 ställer
  bekräftelsefrågan som en inläst fil; webbläsarröktestet (`tools/browser-smoke.mjs`) bakar in
  demopaketet i bygget, öppnar den filen under CSP:n från `file://` och kräver noll CSP-överträdelser
  och inläst paket.

## 5. Avgränsningar

- Råtexten i *Visa paketet* visas som en utfällbar `<pre>`; knapparna sitter i paketets filruta i Filer och kvalitet.
- Filnamnsfältet lägger på ändelsen `.html` när den saknas.
- När den valda verktygsfilen är en annan version än den som körs varnar verktyget och tillåter ändå
  (systemförvaltaren kan medvetet baka in i en nyare fil).
