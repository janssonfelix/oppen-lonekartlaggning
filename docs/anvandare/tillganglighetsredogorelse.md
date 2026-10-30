# Tillgänglighetsredogörelse — Öppen lönekartläggning

**För:** IT, inköp och tillgänglighetssamordnare. Underlag till organisationens egen bedömning av verktyget;
redogörelsen gäller verktyget som fil (`oppen-lonekartlaggning.html`), inte en webbplats. Målet är WCAG 2.1
nivå AA. Senast bedömd för hand 2026-10-17; den automatiska prövningen (axe-core i testsviten, ADR-10) körs mot
varje bygge, också efter de flikar och paneler som tillkommit sedan dess.

## Hur verktyget är prövat

- **Automatiskt i varje testkörning:** axe-core granskar markeringen i alla flikar med demodata (roller,
  etiketter, namn på knappar och länkar, ARIA, tabellrelationer) och kräver noll överträdelser
  (`tests/a11y.test.js`). Testmiljön saknar layout, så färgkontrasten prövas inte där.
- **Färgerna:** statusfärgerna har minst 4,5:1 mot sin bakgrund som text, och diagrammens statusfärger minst
  3:1 mot vit bakgrund; varning och ok skiljer sig i ljushet, så att rött och grönt inte behöver skiljas på
  färgtonen (`tests/farger.test.js`, ADR-43).
- **I webbläsare 2026-10-17:** axe-core (WCAG 2.0 och 2.1, A och AA, med färgkontrast) i Chromium 1400 punkter
  brett, med demodata, i var och en av de då 14 flikarna (i dag 13, sedan Lönepolitik blev ett avsnitt i
  Jämförelse): **inga överträdelser**. Axe prövar inte kontrasten i
  diagrammens SVG-text, och det som axe markerar som "behöver granskas" är inte genomgånget för hand.
- **Tangentbordet:** jsdom-testerna prövar pilarna och Home mellan flikarna (`tests/smoke.test.js`); röktestet
  i Chromium, Firefox och WebKit prövar att avsnittens rubriker nås med Tab och fälls ut med Enter, menyn i
  smalt fönster (öppnas, fokus flyttas dit, Escape stänger och lämnar tillbaka fokus) och att ingen flik är
  bredare än fönstret vid 390 punkter.

## Det som stöds

- Flikarna nås med Tab, och pilarna, Home och End byter flik; stilmallen har fokusmarkering (`:focus-visible`).
- Varje diagram har en textbeskrivning (`aria-label` på diagrammet), och i diagramytan går piltangenterna mellan
  datapunkterna. Talen finns också i tabeller.
- Två lägen: *vägledande* med förklaringar och *kompakt*.

## Kända begränsningar

- **Telefon och surfplatta stöds inte.** Verktyget är byggt för datorskärm. I ett smalt fönster fungerar menyn
  och sidan går inte utanför fönstret, men tabellerna och diagrammen är inte utformade för en liten skärm.
- **Utskriftsfönstret** för checklistan i Regler & praxis och handlingsplanens mall öppnas som ett eget fönster
  utan skript, och webbläsarens utskriftsdialog visas direkt. Fönstret har ingen egen navigering; stäng det med
  webbläsarens vanliga kommando.
- **Diagrammens text** är inte kontrastprövad automatiskt (se ovan); färgerna i dem följer paletten som prövas
  i `tests/farger.test.js`.
- **Skärmläsare** är inte prövade med en användare. Prövningen ovan är automatisk och strukturell.
- **Exporterna** (Word, Excel, PDF) är inte granskade mot tillgänglighetskrav för dokument; Word-utkastet har
  rubrikformat (Rubrik 1–3) och bildtexter under diagrammen, och PDF-rapporten skrivs ut från webbläsaren.
- **Fokusmarkeringen och förstoring** är inte prövade automatiskt; pilotchecklistan (avsnitt E) har kontrollen av fokusmarkeringen.

## Synpunkter

Brister i tillgängligheten rapporteras som ärende (mallen *Fel*) eller till adressen i `SECURITY.md`. Skicka
aldrig verklig lönedata.
