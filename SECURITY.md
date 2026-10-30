# Säkerhet

Öppen lönekartläggning körs helt i webbläsaren: det finns ingen server, inga nätverksanrop och
ingen lagring. Säkerhetsbrister handlar därför främst om att **lönedata på något sätt skulle
kunna lämna datorn eller bli kvar**, eller att en inläst fil skulle kunna köra kod.

## Rapportera en säkerhetsbrist

Rapportera privat på GitHub (*Security* → *Report a vulnerability* i repot), eller skicka en
beskrivning till **oppen-lonekartlaggning@proton.me** med ämnesraden "Säkerhet: Öppen
lönekartläggning". Rapportera inte säkerhetsbrister som öppna ärenden.

Ta med:
- version (se `RELEASE.txt` eller fliken Om verktyget) och webbläsare,
- hur bristen kan återskapas — gärna med påhittad data (demoläget),
- vad bristen gör möjligt.

**Skicka aldrig verkliga löner eller personuppgifter**, inte heller som exempel.

Du får en bekräftelse inom fem arbetsdagar. Allvarliga brister rättas i en ny version så
snart som möjligt, och den som rapporterat nämns i versionsnyheterna om den vill.

## Vad som räknas som en säkerhetsbrist

- Att lönedata, eller något som härletts ur den, kan skickas över nätverket.
- Att data blir kvar på datorn efter att fliken stängts eller *Rensa all data* valts.
- Att en lönefil, referensfil eller ett organisationspaket kan köra kod i verktyget (XSS)
  eller ändra dess beteende.
- Att små grupper (färre än den minsta gruppstorlek som gäller — 10 personer som standard)
  kan röjas i en export trots skyddet. Undantagen står i `docs/dataskydd/dataskydd.md` §3.
- Att något skrivs till webbläsarens lagring. Spärren mot lagring har kända luckor
  (`docs/dataskydd/riskanalys.md` §6.2); de behöver inte rapporteras igen.
- Att en fil med personnummer, namn eller e-post inte avvisas (kontrollen ser på
  rubrikerna och de 50 första raderna), eller att en kolumnrubrik som antyder en särskild
  kategori av personuppgifter (fackmedlemskap, hälsa, etnicitet, religion, politisk åskådning,
  sexualliv, genetik, biometri) inte avvisas (kontrollen ser bara på rubriken).

## Kontrollera att filen är äkta

Varje version publiceras som en GitHub Release med sex filer: verktyget
(`oppen-lonekartlaggning.html`), `RELEASE.txt`, programvaruförteckningen `sbom.cdx.json` (CycloneDX: de
fyra inbyggda biblioteken med version, licens och kontrollsumma, och artefaktens kontrollsumma) och ett
Sigstore-paket (`.sigstore.json`) för var och en av dem. Paketet innehåller signaturen och det certifikat som Sigstore utfärdade för
release-arbetsflödet (`.github/workflows/release.yml`) när filen byggdes ur versionens tagg; ingen
nyckel finns att stjäla, och signeringen står i den publika transparensloggen Rekor.

**Signaturen styrker äktheten.** Verifiera den med [cosign](https://docs.sigstore.dev/cosign/system_config/installation/)
innan filen används med verklig lönedata:

```bash
cosign verify-blob oppen-lonekartlaggning.html --bundle oppen-lonekartlaggning.html.sigstore.json --certificate-identity-regexp "^https://github\.com/janssonfelix/oppen-lonekartlaggning/\.github/workflows/release\.yml@refs/tags/v" --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Samma kommando fungerar i PowerShell på Windows (`cosign.exe`). `Verified OK` betyder att filen är
oförändrad sedan arbetsflödet signerade den. Gör samma kontroll av `RELEASE.txt` med dess paket.

**Kontrollsumman (SHA-256) i `RELEASE.txt` skyddar bara mot en skadad fil**, inte mot en utbytt: den
som byter filen kan byta kontrollsumman också. Den är ett snabbt sätt att se att en kopia som delats
internt är samma fil som den verifierade — kommandona står i `docs/anvandare/korguide.md` §0.

Använd verklig lönedata bara i en nedladdad, kontrollerad fil — inte i en kopia som visas
direkt från en webbplats, eftersom den som driver webbplatsen styr vilken fil som visas.

De inbyggda biblioteken i `vendor/` har kontrollsummor i `vendor/SHA256SUMS`
(`cd vendor && sha256sum -c SHA256SUMS`), och testerna kräver att de stämmer.
