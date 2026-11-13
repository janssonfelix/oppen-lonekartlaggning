# Dokumentation

Dokumenten i `docs/`, ordnade efter vem som läser dem. Översikten över hela repot står i
[`README.md`](../README.md) i roten. Ingången för AI-assistenter är [`CLAUDE.md`](../CLAUDE.md) i roten.

## För den som gör kartläggningen

| Dokument | Vad det är |
|---|---|
| [`korguide.md`](anvandare/korguide.md) | Steg för steg genom en lönekartläggning med verktyget, från datauttag till färdig dokumentation. |
| [`datauttag.md`](anvandare/datauttag.md) | Hur lönefilen tas ut ur lönesystemet: fälten, formatet och vad filen aldrig får innehålla. |
| [`information-till-anstallda.md`](anvandare/information-till-anstallda.md) | Textförslag till information till de anställda om lönekartläggningen, att stämma av med dataskyddsombudet. |
| [`tillganglighetsredogorelse.md`](anvandare/tillganglighetsredogorelse.md) | Tillgänglighetsredogörelse för verktyget (WCAG 2.1 AA) som underlag till organisationens bedömning. |

## För införande: HR, IT, systemägare, dataskyddsombud

| Dokument | Vad det är |
|---|---|
| [`organisationspaket.md`](anvandare/organisationspaket.md) | Guide för systemägaren: organisationspaketet med benämningar, inställningar, ställningstagande och statistik. |
| [`overta-verktyget.md`](anvandare/overta-verktyget.md) | Så bygger, signerar och sprider organisationen sin egen version av verktyget. |
| [`pilotchecklista.md`](anvandare/pilotchecklista.md) | Checklista för en provkörning med verklig lönefil innan verktyget används på riktigt. |
| [`sammanfattning-hr-chefer.md`](anvandare/sammanfattning-hr-chefer.md) | Sammanfattning för HR-chefer: vad verktyget gör och inte gör. |
| [`sakerhetsbeskrivning.md`](anvandare/sakerhetsbeskrivning.md) | Säkerhetsbeskrivning på en sida för IT-säkerhet och dataskyddsombud. |
| [`dataskydd.md`](dataskydd/dataskydd.md) | Dataskyddsbeskrivningen i sammanfattning: vilka uppgifter, var de finns och hur de skyddas. |
| [`riskanalys.md`](dataskydd/riskanalys.md) | Den fullständiga, kodgranskade risk- och sårbarhetsanalysen: dataflöde, skydd, riskregister och verifiering. |

## För utvecklare och granskare

| Dokument | Vad det är |
|---|---|
| [`skydd.md`](utveckling/skydd.md) | De fem skydden som går före besluten: regeln, varför, beslut, vakt och vad som inte vaktas. |
| [`regler.md`](utveckling/regler.md) | Regelmatrisen: varje bindande regel med sin källa och sin vakt, och det som inte vaktas. |
| [`teknisk-plan.md`](utveckling/teknisk-plan.md) | Syfte, avgränsning, dataskydd, funktionsmål, likvärdighetsmodellen, teknisk plan, kvalitetskrav och öppna punkter. |
| [`arkitekturbeslut.md`](utveckling/arkitekturbeslut.md) | Arkitekturbesluten (ADR) med motiv, avvisade alternativ och status; numren som koden och testerna pekar på. |
| [`k-troskeln.md`](utveckling/k-troskeln.md) | Minsta gruppstorlek (skyddet S4) som den gäller: de två lägena, redovisningsformen, vägen ut, undantagen, golven, inställningen och vakterna. |
| [`regressionsmodellen.md`](utveckling/regressionsmodellen.md) | Regressionen och uppdelningen av löneskillnaden som de räknas: huvudtalet, förklaringsmodellen, BAS-kodningen, Blinder-Oaxaca, kvantilregressionen, konfidensintervallen, *Var uppstår löneskillnaden?* och referensvärdena. |
| [`diagramkarnan.md`](utveckling/diagramkarnan.md) | Diagramkärnan som den är byggd: figurformatet, ritaren, exporten och vyernas skyldigheter. |
| [`organisationsfil.md`](utveckling/organisationsfil.md) | Formatspecifikation för organisationsfilen: verktyget med organisationspaketet inbakat. |
| [`lagrum.md`](utveckling/lagrum.md) | Lagrumshänvisningarna: det enda stället där lagrummen står med paragraf och artikel. |
