# Dokumentation

Dokumenten i `docs/`, med en ingång per läsare. Varje ingång listar dokumenten i den ordning de läses. Översikten
över hela repot står i [`README.md`](../README.md) i roten. Ingången för AI-assistenter är [`CLAUDE.md`](../CLAUDE.md)
i roten.

Verktyget är ett proof of concept; vad det betyder står i README:s [*Status*](../README.md#status-ett-proof-of-concept).

## Gör kartläggningen

| Dokument | Vad det är |
|---|---|
| [`korguide.md`](anvandare/korguide.md) | Steg för steg genom en lönekartläggning med verktyget, från datauttag till färdig dokumentation. |
| [`datauttag.md`](anvandare/datauttag.md) | Hur lönefilen tas ut ur lönesystemet: fälten, formatet och vad filen aldrig får innehålla. |
| [`information-till-anstallda.md`](anvandare/information-till-anstallda.md) | Textförslag till information till de anställda om lönekartläggningen, att stämma av med dataskyddsombudet. |

## Inför verktyget: HR, IT, dataskyddsombud

| Dokument | Vad det är |
|---|---|
| [`sammanfattning-hr-chefer.md`](anvandare/sammanfattning-hr-chefer.md) | Sammanfattning för HR-chefer: vad verktyget gör och inte gör. |
| [`sakerhetsbeskrivning.md`](anvandare/sakerhetsbeskrivning.md) | Säkerhetsbeskrivning på en sida för IT-säkerhet och dataskyddsombud. |
| [`dataskydd.md`](dataskydd/dataskydd.md) | Dataskyddsbeskrivningen i sammanfattning: vilka uppgifter, var de finns och hur de skyddas. |
| [`riskanalys.md`](dataskydd/riskanalys.md) | Den fullständiga risk- och sårbarhetsanalysen, granskad mot koden med AI-verktyg: dataflöde, skydd, riskregister och verifiering. |
| [`tillganglighetsredogorelse.md`](anvandare/tillganglighetsredogorelse.md) | Tillgänglighetsredogörelse för verktyget (WCAG 2.1 AA) som underlag till organisationens bedömning. |
| [`organisationspaket.md`](anvandare/organisationspaket.md) | Guide för systemägaren: organisationspaketet med benämningar, inställningar, ställningstagande och statistik. |
| [`overta-verktyget.md`](anvandare/overta-verktyget.md) | Så bygger, signerar och sprider organisationen sin egen version av verktyget. |
| [`pilotchecklista.md`](anvandare/pilotchecklista.md) | Checklista för en provkörning med verklig lönefil innan verktyget används på riktigt. |

## Granska beräkningarna

| Dokument | Vad det är |
|---|---|
| [`kom-igang.md`](utveckling/kom-igang.md) | Första timmen; granskarens väg kör en beräkning i Node. |
| [`berakningsregister.md`](utveckling/berakningsregister.md) | En rad per beräkning med funktion, indata, vad den bygger på, tester och referensfall, och modellparametrarna med värde och vem som kan ändra dem. |
| [`regressionsmodellen.md`](utveckling/regressionsmodellen.md) | Regressionen och uppdelningen av löneskillnaden som de räknas: huvudtalet, förklaringsmodellen, BAS-kodningen, Blinder-Oaxaca, kvantilregressionen, konfidensintervallen, *Var uppstår löneskillnaden?* och referensvärdena. |
| [`likvardighetsmodellen.md`](utveckling/likvardighetsmodellen.md) | Analysen av likvärdigt arbete som den räknas: definitionen av kvinnodominerat, jämförelseetiketterna, kandidatparen med konfidensintervall och åldersjustering, *Lägre krav, högre lön*, inställningarna och vakterna. |
| [`prioriteringsmodellen.md`](utveckling/prioriteringsmodellen.md) | Prioriteringen som den räknas: grupperna, avvikelsen mot referensen, lägena, delpoängen och indexet, snabb vinst, kostnaden, inställningarna och vakterna. |
| [`loneoversynsmodellen.md`](utveckling/loneoversynsmodellen.md) | Löneöversynen som den räknas: potten, det generella påslaget, de riktade raderna och algoritmen lägst först, avrundningen, utfallet, förslagen, planen, tröskelmålet och vakterna. |
| [`k-troskeln.md`](utveckling/k-troskeln.md) | Minsta gruppstorlek (skyddet S4) som den gäller: de två lägena, redovisningsformen, vägen ut, undantagen, golven, inställningen och vakterna. |
| [`lagrum.md`](utveckling/lagrum.md) | Lagrumshänvisningarna: det enda stället där lagrummen står med paragraf och artikel. |

## Utveckla

| Dokument | Vad det är |
|---|---|
| [`CONTRIBUTING.md`](../.github/CONTRIBUTING.md) | Hur ett bidrag lämnas, Definition of Done och neutralitetsregeln. |
| [`skydd.md`](utveckling/skydd.md) | De fem skydden S1–S5: regeln, varför, beslut, vakt och vad som inte vaktas. |
| [`principer.md`](utveckling/principer.md) | De sex principerna, med sina vakter. |
| [`mal.md`](utveckling/mal.md) | Syfte, avgränsning och funktionsmål. |
| [`arkitektur.md`](utveckling/arkitektur.md) | Arkitekturen på en sida: lagren, dataflödet från fil till export och beräkningskärnans moduler. |
| [`kom-igang.md`](utveckling/kom-igang.md) | Första timmen; utvecklarens väg ändrar, bygger och provar. |
| [`bygge-och-test.md`](utveckling/bygge-och-test.md) | Hur verktyget byggs, testas, typkontrolleras och släpps: bygget och dess skyddsnät, testsviten och testmiljön, typkontrollen, linten, `npm run kontroll`, CI, releasen och demosidan. |
| [`diagramkarnan.md`](utveckling/diagramkarnan.md) | Diagramkärnan som den är byggd: figurformatet, ritaren, exporten och vyernas skyldigheter. |
| [`organisationsfil.md`](utveckling/organisationsfil.md) | Formatspecifikation för organisationsfilen: verktyget med organisationspaketet inbakat. |
| [`arkitekturbeslut.md`](utveckling/arkitekturbeslut.md) | Loggen över arkitekturbesluten (ADR): vad som valdes och varför, med status; numren som koden och testerna pekar på. |
| [`oppna-punkter.md`](utveckling/oppna-punkter.md) | Kända brister och obesvarade frågor, med numren som koden och dokumenten pekar på. |

Referenserna för beräkningarna står under *Granska beräkningarna*.
