# Så tar ni över verktyget — bygg, signera och sprid er egen version

**För:** IT, systemägare och den som ansvarar för verktyget hos arbetsgivaren. Verktyget är byggt för
att varje organisation ska kunna äga sitt exemplar helt: bygga det från källan, ändra det, signera det
med egen identitet och sprida det internt — utan konto hos, tjänst från eller beroende av projektet.
Allt som behövs finns i källkoden under MIT-licensen; det finns inga hemligheter, nycklar eller
tjänster att få tillgång till.

Ni behöver inte göra allt nedan. De flesta organisationer stannar vid steg 1–3 (verifiera, bygg
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
npm test
```

Bygget är **deterministiskt**: `dist/oppen-lonekartlaggning.html` ska bli byte för byte samma fil som
på releasen. Jämför kontrollsumman med `RELEASE.txt`:

```bash
sha256sum dist/oppen-lonekartlaggning.html
```

Stämmer den, har ni själva styrkt att den publicerade filen är byggd ur den publicerade källan. Det är
den kontroll en IT-säkerhetsgranskning brukar vilja se, och den kräver ingen tillit till projektet.
Biblioteken i `vendor/` kontrolleras mot `vendor/SHA256SUMS` av testerna och vid bygget.

## 3. Gör verktyget till ert: organisationsfilen

Organisationens benämningar, grundinställningar, lönepolitiska ställningstagande, jämförelsestatistik och
låsningar läggs i ett **organisationspaket**, som systemägaren bakar in i verktyget till **en
organisationsfil** att sprida — handläggaren öppnar en fil och allt är på plats. Hur, steg för steg:
[`organisationspaket.md`](organisationspaket.md), särskilt avsnitt 3b och checklistan i avsnitt 8.

Paketet ligger i filen som data, inte som kod: koden förblir identisk med den verifierade versionen,
och inget i paketet kan köra kod (innehållssäkerhetspolicyn tillåter bara de inbyggda skripten). Paketet
innehåller inga personuppgifter och kan spridas internt som vilken fil som helst.

## 4. Ändra i verktyget

Vill ni ändra något — en text, en tröskel, ett diagram, ett nytt arbetsvärderingssystem — gör det i en
**fork** av repot, inte i den byggda filen.

1. Läs [`teknisk-plan.md`](../utveckling/teknisk-plan.md) §8 (arkitekturbesluten). Besluten om
   dataskyddet — inga nätverksanrop, ingen lagring, k-anonymitet i det som lämnar verktyget — är det som
   gör att dokumenten i `docs/dataskydd/` fortsätter att gälla. Behåll dem, så gäller risk- och
   sårbarhetsanalysen fortfarande för er version, med en anteckning om vad ni ändrat.
2. Ändra i `src/`, aldrig i `dist/`. Lägg till test. Kör `npm run build:app`, `npm test`,
   `npm run lint`, `npm run bundle` och `npm run test:browser`. Testsviten innehåller invarianter som
   vaktar dataskyddet (ingen utgående trafik, ingen lagring, små grupper i exporter) — låt dem stå.
3. Ge er version ett eget versionsnamn i `VERSION` (till exempel `2026.11.03-kommunen`) och en rad i
   `CHANGELOG.md`, så att det syns i *Om verktyget* och i `RELEASE.txt` vilken fil som är er.
4. Byt det som pekar på projektet: säkerhetskontakten i [`SECURITY.md`](../../SECURITY.md) och
   verifieringskommandots identitet (steg 5). Licens- och upphovsnotiserna (`LICENSE`, `NOTICE`,
   SPDX-raderna och licenstexterna i `src/licenser.txt`) ska följa med enligt MIT-licensen; lägg er
   egen upphovsrad till, ta inte bort den befintliga.
5. Kör `npm run release:kontroll` före varje egen release. Grinden kräver att versionen står lika
   överallt och att risk- och sårbarhetsanalysen är granskad efter den senaste kodändringen — samma
   disciplin som projektet håller.

Ändringar som kan vara till nytta för andra: skicka dem tillbaka som förslag enligt
[`CONTRIBUTING.md`](../../CONTRIBUTING.md). Ni behöver inte, men verktyget blir bättre av det.

## 5. Signera i eget namn

Projektets signatur styrker att en fil byggdes av **projektets** arbetsflöde. Bygger ni själva, behöver
er fil en signatur som styrker att den byggdes av **er**. Två vägar:

**A. Eget arbetsflöde (nyckellöst).** I en fork på GitHub kör `.github/workflows/release.yml` oförändrat
när ni pushar en tagg `v<VERSION>`. Sigstore utfärdar då ett certifikat för *er* forks arbetsflöde, och
verifieringskommandot får er identitet:

```bash
cosign verify-blob oppen-lonekartlaggning.html --bundle oppen-lonekartlaggning.html.sigstore.json --certificate-identity-regexp "^https://github\.com/<er-organisation>/<ert-repo>/\.github/workflows/release\.yml@refs/tags/v" --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Byt `<er-organisation>/<ert-repo>` och skriv in kommandot i er `SECURITY.md` och körguide. Ingen
nyckel behöver förvaras; signeringen står i den publika transparensloggen Rekor.

**B. Egen nyckel (utan GitHub).** Skapa ett nyckelpar med `cosign generate-key-pair`, förvara den privata
nyckeln i er nyckelhantering och signera varje bygge:

```bash
cosign sign-blob --key cosign.key --bundle oppen-lonekartlaggning.html.sigstore.json dist/oppen-lonekartlaggning.html
```

Verifiering hos handläggarens IT: `cosign verify-blob --key cosign.pub --bundle … oppen-lonekartlaggning.html`.
Den publika nyckeln sprids internt tillsammans med verktyget.

I båda fallen: signera `RELEASE.txt` också, och skriv kontrollsumman från ert bygge på rad 3 i
`docs/dataskydd/riskanalys.md`, så att grinden i steg 4.5 går igenom.

## 6. Underhåll över tid

- **Nya versioner från projektet** hämtar ni när ni vill. Verktyget hämtar aldrig något självt.
  Jämför `CHANGELOG.md`, bygg om, kör testerna, baka in organisationspaketet på nytt (avsnitt 4 i
  [`organisationspaket.md`](organisationspaket.md)) och signera.
- **Biblioteken** (D3, SheetJS, PapaParse, JSZip) är låsta med kontrollsummor i `vendor/SHA256SUMS` och
  uppgraderas medvetet, i en egen ändring, med uppdaterad kontrollsumma och `LICENSES.md`. Dependabot
  i er fork föreslår uppdateringar av utvecklingsverktygen och arbetsflödenas steg; inget av dem ingår
  i den byggda filen.
- **Sårbarheter** som ni hittar i verktyget: rapportera dem till projektet enligt `SECURITY.md`, så att
  rättningen når alla, också om ni rättar dem själva först.
- **Om projektet slutar underhållas** gäller [`GOVERNANCE.md`](../../GOVERNANCE.md): efter tolv månader
  utan releaser eller svar uppmuntras en fork som tar över, och allt ni behöver för det har ni redan
  efter steg 1–5.

## Vad som inte följer med

- **Support, utbildning och juridisk rådgivning.** Verktyget ger underlag; bedömningarna är
  arbetsgivarens, i samverkan med facklig part. Den som erbjuder support eller drift i eget namn gör det
  under eget ansvar (README, *Ansvar och roller*).
- **Organisationers referensdata.** Ställningstagande och jämförelsestatistik ligger i ert
  organisationspaket, aldrig i källkoden (ADR-28). Checka inte in dem i er fork heller, om forken är
  publik.
- **Verklig lönedata.** Aldrig i repot, aldrig i ärenden — varken hos projektet eller i er fork.
