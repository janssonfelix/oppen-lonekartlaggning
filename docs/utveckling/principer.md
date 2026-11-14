# Principerna

Sex principer som, tillsammans med skydden S1–S5 i [`skydd.md`](skydd.md), är det som binder i projektet. Skydden
går före: en princip får aldrig läsas så att den strider mot ett skydd. Hur något fungerar i dag står i referensen
för området, och varför det blev så i [`arkitekturbeslut.md`](arkitekturbeslut.md).

1. **Underlag, inte bedömning.** Verktyget visar underlag för arbetsgivarens egen analys och avgör inte vad lagen
   kräver. Gränssnitt, hjälptexter och exporter hänvisar inte till paragrafer; lagrummen står bara i
   [`lagrum.md`](lagrum.md).
   *Vakt:* `tests/smoke-vyer.test.js`, `tests/dokumentation-sprak.test.js`, `tests/juridiksprak.test.js`.
2. **Statistik som går att kontrollera.** Formlerna är dokumenterade i referenserna och prövas mot etablerade
   implementationer, och kärnalgoritmerna har enhetstester som följer den gällande modellen.
   *Vakt:* `tests/stat-referens.test.js`, `tests/stat.test.js`, `tests/regression.test.js`.
3. **Skillnader bedöms på statistisk signal, inte på storleken ensam.** En status eller färg på en skillnad mellan
   kvinnors och mäns lön sätts på om skillnaden är säkerställd och på storleksgränsen tillsammans.
   *Vakt:* `tests/status-trappa.test.js`, `tests/livscykel.test.js`.
4. **En källa per uppgift.** Det som flera filer behöver står på ett ställe; det som härleds byggs ur källan och
   jämförs med det incheckade, det skrivs inte av. Varje sak prövas av en kontroll, och säkerhetsgranskningen står
   samlad i `docs/dataskydd/riskanalys.md`.
   *Vakt:* `tests/drift.test.js`, `tests/version.test.js`, `tests/farger.test.js`, `tests/appsource.test.js`,
   `tests/dokumentation-struktur.test.js` och artefaktgrinden i `.github/workflows/ci.yml`.
5. **Bygget går att lita på.** En färsk build ger samma fil som den incheckade, biblioteken är låsta med
   kontrollsummor, och en release signeras av arbetsflödet ur taggen.
   *Vakt:* artefaktgrinden i `.github/workflows/ci.yml`, `tests/sakerhet.test.js`, release-grinden
   (`tools/release.mjs`, `tests/release.test.js`).
6. **Tillgängligt och begripligt.** Gränssnittet följer WCAG 2.1 AA, och det användaren läser är skrivet på
   klarspråk.
   *Vakt:* `tests/a11y.test.js`, statusfärgernas kontrast i `tests/sakerhet.test.js`,
   `tests/dokumentation-sprak.test.js`. Övrig färgkontrast och om en text är begriplig prövas för hand.
