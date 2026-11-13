# Så tar du över verktyget — bygg, signera och sprid din egen version

**För:** IT, systemägare och den som ansvarar för verktyget hos arbetsgivaren. Verktyget är byggt för
att varje organisation ska kunna äga sitt exemplar helt. Du kan bygga det från källan, ändra det,
signera det med egen identitet och sprida det internt. Du behöver inget konto hos, ingen tjänst från
och inget beroende av projektet. Allt som behövs finns i källkoden under MIT-licensen. Det finns inga
hemligheter, nycklar eller tjänster att få tillgång till.

Du behöver inte göra allt nedan. De flesta organisationer stannar vid steg 1–3 (verifiera, bygg
själva, organisationsfil). Steg 4–6 är för den som ändrar i verktyget eller vill signera i eget namn.

## 1. Hämta och verifiera

1. Hämta källkoden: `git clone` av repot, eller källkodsarkivet från releasen. Taggen `v<VERSION>` är
   den commit som versionen byggdes ur.
2. Hämta `oppen-lonekartlaggning.html`, `RELEASE.txt` och deras Sigstore-paket från samma release och
   verifiera signaturen med kommandot i [`SECURITY.md`](../../SECURITY.md), avsnittet *Kontrollera att
   filen är äkta*. Signaturen styrker att filen byggdes av projektets arbetsflöde ur taggen.

## 2. Bygg själva och jämför

Kräver Node 22.12 eller senare. Allt körs utan nätverk efter `npm ci`.

```bash
npm ci
npm run build:app
npm run bundle
npm run test:full
```

Bygget är **deterministiskt**: `dist/oppen-lonekartlaggning.html` ska bli byte för byte samma fil som
på releasen. Jämför kontrollsumman med `RELEASE.txt`:

```bash
sha256sum dist/oppen-lonekartlaggning.html
```

Stämmer den, har du själv styrkt att den publicerade filen är byggd ur den publicerade källan. Det är
den kontroll en IT-säkerhetsgranskning brukar vilja se, och den kräver ingen tillit till projektet.
Biblioteken i `vendor/` kontrolleras mot `vendor/SHA256SUMS` av testerna och vid bygget.

## 3. Gör verktyget till ditt: organisationsfilen

Organisationens benämningar, grundinställningar, lönepolitiska ställningstagande, jämförelsestatistik och
låsningar läggs i ett **organisationspaket**. Systemägaren bakar in paketet i verktyget till **en
organisationsfil** att sprida. Handläggaren öppnar en fil, och allt är på plats. Hur, steg för steg:
[`organisationspaket.md`](organisationspaket.md), särskilt avsnitt 3b och checklistan i avsnitt 8.

Paketet ligger i filen som data, inte som kod. Koden förblir identisk med den verifierade versionen,
och inget i paketet kan köra kod (innehållssäkerhetspolicyn tillåter bara de inbyggda skripten). Paketet
innehåller inga personuppgifter och kan spridas internt som vilken fil som helst.

## 4. Ändra i verktyget

Vill du ändra något — en text, en tröskel, ett diagram, ett nytt arbetsvärderingssystem — gör det i en
**fork** av repot, inte i den byggda filen.

1. Läs [`arkitekturbeslut.md`](../utveckling/arkitekturbeslut.md). Besluten om
   dataskyddet — inga nätverksanrop, ingen lagring, k-anonymitet i det som lämnar verktyget — är det som
   gör att dokumenten i `docs/dataskydd/` fortsätter att gälla. Behåll dem, så gäller risk- och
   sårbarhetsanalysen fortfarande för din version, med en anteckning om vad du ändrat.
2. Ändra i `src/`, aldrig i `dist/`. Lägg till test. Kör `npm run build:app`, `npm run test:full`,
   `npm run lint`, `npm run bundle` och `npm run test:browser`. (`npm test` är en snabb körning utan
   jsdom-testerna, sekunder i stället för minuter; `test:full` är hela sviten och ska vara grön innan du lämnar
   ifrån dig en ändring.) Testsviten innehåller invarianter som
   vaktar dataskyddet (ingen utgående trafik, ingen lagring, små grupper i exporter) — låt dem stå.
3. Ge din version ett eget versionsnamn i `VERSION` (till exempel `2026.11.03-kommunen`) och en rad i
   `CHANGELOG.md`. Då syns det i *Om verktyget* och i `RELEASE.txt` vilken fil som är din.
4. Byt det som pekar på projektet: säkerhetskontakten i [`SECURITY.md`](../../SECURITY.md) och
   verifieringskommandots identitet (steg 5). Licens- och upphovsnotiserna (`LICENSE`,
   SPDX-raderna och licenstexterna i `src/licenser.txt`) ska följa med enligt MIT-licensen; lägg din
   egen upphovsrad till, ta inte bort den befintliga.
5. Kör `npm run release:kontroll` före varje egen release. Grinden kräver att ändringsloggen och
   risk- och sårbarhetsanalysen anger versionen och att analysen är granskad efter den senaste kodändringen — samma
   disciplin som projektet håller.

Ändringar som kan vara till nytta för andra: skicka dem tillbaka som förslag enligt
[`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md). Du behöver inte, men verktyget blir bättre av det.

## 5. Signera i eget namn

Projektets signatur styrker att en fil byggdes av **projektets** arbetsflöde. Bygger du själv, behöver
din fil en signatur som styrker att den byggdes av **dig**. Två vägar:

**A. Eget arbetsflöde (nyckellöst).** I en fork på GitHub kör `.github/workflows/release.yml` oförändrat
när du pushar en tagg `v<VERSION>`. Sigstore utfärdar då ett certifikat för *din* forks arbetsflöde, och
verifieringskommandot får din identitet:

```bash
cosign verify-blob oppen-lonekartlaggning.html --bundle oppen-lonekartlaggning.html.sigstore.json --certificate-identity-regexp "^https://github\.com/<er-organisation>/<ert-repo>/\.github/workflows/release\.yml@refs/tags/v" --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Byt `<din-organisation>/<ditt-repo>` och skriv in kommandot i din `SECURITY.md` och körguide. Ingen
nyckel behöver förvaras; signeringen står i den publika transparensloggen Rekor.

**B. Egen nyckel (utan GitHub).** Skapa ett nyckelpar med `cosign generate-key-pair`, förvara den privata
nyckeln i din nyckelhantering och signera varje bygge:

```bash
cosign sign-blob --key cosign.key --bundle oppen-lonekartlaggning.html.sigstore.json dist/oppen-lonekartlaggning.html
```

Verifiering hos handläggarens IT: `cosign verify-blob --key cosign.pub --bundle … oppen-lonekartlaggning.html`.
Den publika nyckeln sprids internt tillsammans med verktyget.

I båda fallen: signera `RELEASE.txt` också. Skriv sedan kontrollsumman från ditt bygge på rad 3 i
`docs/dataskydd/riskanalys.md`, så att grinden i steg 4.5 går igenom.

## 6. Underhåll över tid

- **Nya versioner från projektet** hämtar du när du vill. Verktyget hämtar aldrig något självt.
  Jämför `CHANGELOG.md`, bygg om, kör testerna, baka in organisationspaketet på nytt (avsnitt 4 i
  [`organisationspaket.md`](organisationspaket.md)) och signera.
- **Biblioteken** (D3, SheetJS, PapaParse, JSZip) är låsta med kontrollsummor i `vendor/SHA256SUMS` och
  uppgraderas medvetet, i en egen ändring, med uppdaterad kontrollsumma och `TREDJEPARTSLICENSER.md`. Dependabot
  i din fork föreslår uppdateringar av utvecklingsverktygen och arbetsflödenas steg; inget av dem ingår
  i den byggda filen.
- **Sårbarheter** som du hittar i verktyget: rapportera dem till projektet enligt `SECURITY.md`, så att
  rättningen når alla, också om du rättar dem själv först.
- **Om projektet slutar underhållas** gäller [`GOVERNANCE.md`](../../.github/GOVERNANCE.md). Efter tolv månader
  utan releaser eller svar uppmuntras en fork som tar över. Allt du behöver för det har du redan
  efter steg 1–5.

## Vad som inte följer med

- **Support, utbildning och juridisk rådgivning.** Verktyget ger underlag; bedömningarna är
  arbetsgivarens, i samverkan med facklig part. Den som erbjuder support eller drift i eget namn gör det
  under eget ansvar (README, *Ansvar och roller*).
- **Organisationers referensdata.** Ställningstagande och jämförelsestatistik ligger i ditt
  organisationspaket, aldrig i källkoden (ADR-28). Checka inte in dem i din fork heller, om forken är
  publik.
- **Verklig lönedata.** Aldrig i repot, aldrig i ärenden — varken hos projektet eller i din fork.
