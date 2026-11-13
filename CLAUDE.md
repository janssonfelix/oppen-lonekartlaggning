# Instruktioner för AI-assistenter

- **Neutralt verktyg.** Öppen lönekartläggning är skriven för alla arbetsgivare och är inte kopplad till någon
  särskild organisation. Skriv aldrig namn på organisationer, arbetsgivare eller lönesystem i kod, tester, exempel,
  commitmeddelanden eller dokument; skriv "organisationen" eller "arbetsgivaren", och använd påhittade, uppenbart
  syntetiska data. Tre undantag: lönesystem får namnges i uttagsguiden (`docs/anvandare/datauttag.md`) och där
  den citeras, som system, aldrig som någons kund eller arbetsgivare; källan till jämförelsestatistiken får namnges
  som källa; demodatan har en påhittad organisation. Se `.github/CONTRIBUTING.md`.
- **Lönedata lämnar aldrig datorn**, och varje ny utdata prövas mot k-tröskeln (`.github/CONTRIBUTING.md`, punkt 3).
- Läs `docs/utveckling/arkitekturbeslut.md` (arkitekturbesluten) innan du ändrar beteende.
- Skriv på svenska, i samma stil som omgivande kod och dokument.
