# Styrning

Hur Öppen lönekartläggning beslutas, släpps och lever vidare. Målet är att varje arbetsgivare som
använder verktyget ska kunna äga sitt exemplar helt: bygga, ändra, signera och sprida det utan att vara
beroende av projektet.

## Vem beslutar

- **Upphovspersonen** (Felix Jansson) är underhållare och fattar besluten om innehåll, releaser och
  riktning. Projektet har en underhållare; det står här så att ingen behöver gissa.
- **Skydden** S1–S5 i [`docs/utveckling/skydd.md`](../docs/utveckling/skydd.md) går före allt annat och ändras bara
  genom ett eget, daterat beslut av underhållaren, aldrig i förbigående i en ändring. **Principerna** i
  [`docs/utveckling/principer.md`](../docs/utveckling/principer.md) binder tillsammans med dem. Övriga designval
  står i referensen för sitt område.
- **Lagrumshänvisningar** ändras bara i [`docs/utveckling/lagrum.md`](../docs/utveckling/lagrum.md)
  (ADR-16), med status *Förslag* tills jurist och dataskyddsombud stämt av dem.
- **Bidrag** tas emot enligt [`CONTRIBUTING.md`](CONTRIBUTING.md) och lämnas under MIT-licensen; inget
  bidragsavtal utöver det. Alla som deltar följer [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Hur en ändring kommer in

Ett ärende eller förslag, aldrig med verklig lönedata; en ändring klar enligt *Definition of Done* i
[`CONTRIBUTING.md`](CONTRIBUTING.md) (punkt 3); granskning av underhållaren. Grenen `main` är skyddad: grön CI
krävs, inga direkta pushar.

## När ett beslut förs in

Ett designval ändras i en och samma ändring:

1. Referensen för området och koden, med test, ändras.
2. Beslutsloggen [`docs/utveckling/arkitekturbeslut.md`](../docs/utveckling/arkitekturbeslut.md) får ett nytt beslut
   med nästa lediga nummer och en rad i indexet, och det beslut det ändrar får status. Ett nummer byts aldrig.
3. Hänvisningar till det ändrade beslutet (`ADR-n`) i `src/`, `tests/` och `docs/` rättas.

## Hur en version släpps

En version är en tagg `v<VERSION>` (CalVer). Grinden `npm run release:kontroll` prövar det som bara gäller vid en
release (huvudet i `tools/release.mjs`). Arbetsflödet bygger om, kräver att `dist/` är byte-identisk med det
incheckade, signerar med Sigstore och publicerar. Signaturen styrker att filen byggdes ur taggen, och ingen nyckel
finns att förlora eller lämna över (se [`SECURITY.md`](../SECURITY.md)).

## Kontinuitet — om projektet slutar underhållas

Allt som behövs för att bygga, testa, signera och släppa verktyget finns i repot, utan hemligheter, tjänster eller
konton. Har ingen version släppts och inga ärenden besvarats på **tolv månader** är projektet vilande, och en
**fork** uppmuntras: under namnet *Öppen lönekartläggning* med ett tillägg som skiljer den från ursprunget, med
licens- och upphovsnotiserna kvar och med de fem skydden behållna. Varje organisation kan när som helst bygga och
signera sin egen version enligt [`docs/anvandare/overta-verktyget.md`](../docs/anvandare/overta-verktyget.md).

## Vad projektet inte gör

Erbjuder inte support, drift, utbildning eller juridisk rådgivning (den som gör det i eget namn gör det under eget
ansvar, README *Ansvar och roller*). Tar inte emot organisationers referensdata, namn eller lönedata (ADR-28). Byter
inte licens: MIT är vald för att en arbetsgivare ska kunna ändra och sprida verktyget utan licensfrågor.
