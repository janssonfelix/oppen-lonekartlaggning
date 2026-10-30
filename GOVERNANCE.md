# Styrning

Hur Öppen lönekartläggning beslutas, släpps och lever vidare. Målet är att varje arbetsgivare som
använder verktyget ska kunna äga sitt exemplar helt: bygga, ändra, signera och sprida det utan att vara
beroende av projektet.

## Vem beslutar

- **Upphovspersonen** (Felix Jansson) är underhållare och fattar besluten om innehåll, releaser och
  riktning. Projektet har en underhållare; det står här så att ingen behöver gissa.
- **Arkitekturbesluten** i [`docs/utveckling/teknisk-plan.md`](docs/utveckling/teknisk-plan.md) §8
  (ADR) är bindande. Flera av dem är medvetna begränsningar — inga nätverksanrop, ingen lagring, ingen
  inbyggd organisation, en enda fil. De ändras bara genom ett nytt, daterat ADR i samma dokument, aldrig
  i förbigående i en ändring.
- **Lagrumshänvisningar** ändras bara i [`docs/utveckling/lagrum.md`](docs/utveckling/lagrum.md)
  (ADR-16), med status *Förslag* tills jurist och dataskyddsombud stämt av dem.
- **Bidrag** tas emot enligt [`CONTRIBUTING.md`](CONTRIBUTING.md) och lämnas under MIT-licensen; inget
  bidragsavtal utöver det. Alla som deltar följer [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Hur en ändring kommer in

1. Ärende eller förslag enligt mallarna, aldrig med verklig lönedata.
2. Ändring i `src/` med test; `npm run build:app`, `npm test`, `npm run lint`, `npm run bundle` och
   `npm run test:browser` gröna.
3. Granskning av underhållaren. Grenen `main` är skyddad: grön CI krävs, inga direkta pushar.
4. Raden i `CHANGELOG.md` under *Oförlöst*.

## Hur en version släpps

En version är en tagg `v<VERSION>` (CalVer). Grinden `npm run release:kontroll` kräver att versionen står
lika överallt och att risk- och sårbarhetsanalysen är granskad mot den kod som släpps. Arbetsflödet
bygger om, kräver att artefakten är byte-identisk med den incheckade, signerar med Sigstore och
publicerar. Ingen signeringsnyckel finns att förlora eller lämna över: signaturen styrker att filen
byggdes av arbetsflödet ur taggen (se [`SECURITY.md`](SECURITY.md)).

## Kontinuitet — om projektet slutar underhållas

Allt som behövs för att bygga, testa, signera och släppa verktyget finns i repot: källan, de låsta
biblioteken med kontrollsummor, testerna, byggskripten och arbetsflödena. Det finns inga hemligheter,
inga tjänster och inga konton som en efterträdare måste få tillgång till.

- Om ingen version har släppts och inga ärenden besvarats på **tolv månader**, ska projektet betraktas
  som vilande. Då uppmuntras en **fork** som tar över underhållet, under namnet *Öppen lönekartläggning*
  med ett tillägg som skiljer den från ursprunget (till exempel organisationens namn eller årtal), med
  licens- och upphovsnotiserna bevarade enligt MIT-licensen.
- En sådan fork bör behålla de bärande arkitekturbesluten (dataskyddet i teknisk-plan §3 och ADR som
  märkts som medvetna begränsningar), så att namnet fortsätter att betyda det det betyder.
- Varje organisation kan när som helst, utan att vänta på något av ovanstående, bygga och signera sin
  egen version enligt [`docs/anvandare/overta-verktyget.md`](docs/anvandare/overta-verktyget.md).

## Vad projektet inte gör

- Erbjuder inte support, drift, utbildning eller juridisk rådgivning. Den som gör det i eget namn gör
  det under eget ansvar (README, *Ansvar och roller*).
- Tar inte emot organisationers referensdata, namn eller lönedata i repot (ADR-28).
- Byter inte licens. MIT är vald för att en arbetsgivare ska kunna ändra och sprida verktyget internt
  utan licensfrågor.
