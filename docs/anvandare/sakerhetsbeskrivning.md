# Säkerhetsbeskrivning — Öppen lönekartläggning

**För:** IT-säkerhet och dataskyddsombud som ska godkänna verktyget. En sida; den fullständiga,
kodgranskade analysen står i [`riskanalys.md`](../dataskydd/riskanalys.md) (avsnitten anges inom parentes) och
dataskyddet i korthet i [`dataskydd.md`](../dataskydd/dataskydd.md).

## Vad verktyget är

En enda HTML-fil (`oppen-lonekartlaggning.html`) som öppnas lokalt i Chrome, Edge, Firefox eller Safari 16.4+
på en dator. Ingen installation, ingen server, inget konto, ingen administratörsbehörighet. Filen innehåller
verktygets kod och fyra låsta bibliotek (D3, SheetJS, PapaParse, JSZip).

## Skydden

| Skydd | Hur | Prövat |
|---|---|---|
| **Inget nätverk** | Innehållspolicyn (CSP) i filen: `connect-src 'none'`, `form-action 'none'`, `default-src 'none'`; inga externa resurser, inga länkar ut | Statisk sökning i koden; körning utan nätverk med alla flikar och exporter: noll förfrågningar (§6.1) |
| **Ingen kod utifrån** | `script-src` tillåter bara de fem inbyggda skripten (SHA-256-hashar); inga inline-händelser, inga stilattribut (`style-src-attr 'none'`) | Injicerat skript, injicerad händelse och injicerad stil i en lönefil körs inte (§6.1) |
| **Ingen lagring** | Ingen kod skriver till localStorage, sessionStorage, IndexedDB eller cookies; en spärr kastar vid försök (reserv) | Lagringen är tom efter full körning i webbläsaren (§6.2) |
| **Minimerad indata** | Bara fem fält (lön, kön, ålder, yrke/AID, BAS) och två valfria läses in; en fil med kolumner för personnummer, namn eller e-post avvisas | Fälten i minnet efter inläsning; avvisning prövad (§6.4) |
| **Små grupper** | Lönemått för grupper under minsta gruppstorlek (standard 10) redovisas inte; undantagen är uppräknade | Invarianter över flikar och exporter (§6.5) |
| **Rensning** | *Rensa all data* och rensning efter 30 minuters inaktivitet (kan låsas i organisationspaketet) tömmer minnet och sidan | Inget lönevärde kvar i dokumentet efter rensning (§6.3) |
| **Äkthet** | Varje version signeras med Sigstore cosign i ett publikt byggflöde; kontrollsumma i `RELEASE.txt` | Verifieringskommandot i [`SECURITY.md`](../../SECURITY.md) |

## Det som ligger hos organisationen

1. **Exporterade filer** (Excel, Word, PDF, ZIP, diagramdata, konfigurationsfil) innehåller lönedata och
   ska hanteras som personuppgifter: behörighetsstyrd lagring, ingen okrypterad e-post (§8 punkt 1).
2. **Datorn och webbläsaren:** en förvaltad dator med få tillägg; ett tillägg som läser sidan ligger utanför
   verktygets kontroll (§7 A5).
3. **Urklipp:** stäng av synkning av urklipp (Windows molnurklipp, Apples universella urklipp) på datorerna
   som används (§8 punkt 7).
4. **Verifiera filen** före användning med verklig lönedata, och använd den nedladdade filen — inte en kopia
   som visas från en webbplats.
5. **Konsekvensbedömning:** verktyget är en lågriskkomponent; om lönekartläggningsprocessen som helhet kräver
   en DPIA avgör dataskyddsombudet (§9).

## Vanliga frågor

- **Personuppgiftsbiträdesavtal?** Nej. Ingen uppgift når verktygets upphovsperson eller någon annan (§3).
- **AI eller molntjänster?** Nej. Lokal, deterministisk statistik i öppen källkod.
- **Uppdateringar?** En ny version är en ny fil, med egen signatur. Verktyget hämtar ingenting själv.
- **Säkerhetsbrister** rapporteras privat enligt `SECURITY.md`.
