# Tillgänglighetsredogörelse — Öppen lönekartläggning

**För:** IT, inköp och tillgänglighetssamordnare. Underlag till organisationens egen bedömning av verktyget;
redogörelsen gäller verktyget som fil (`oppen-lonekartlaggning.html`), inte en webbplats. Målet är WCAG 2.1
nivå AA. Senast prövad i webbläsare 2026-11-24. Den automatiska prövningen (axe-core i testsviten, ADR-10) körs mot
varje bygge, också efter de flikar och paneler som tillkommit sedan dess.

## Hur verktyget är prövat

- **Automatiskt i varje testkörning:** axe-core granskar markeringen i alla flikar med demodata, med varje dialog
  öppen, och kräver noll överträdelser (`tests/a11y.test.js`). Den prövar roller, etiketter, namn på knappar och
  länkar, ARIA och tabellrelationer. Testmiljön saknar layout, så färgkontrasten prövas inte där.
- **Färgerna:** statusfärgerna har minst 4,5:1 mot sin bakgrund som text, och diagrammens statusfärger minst
  3:1 mot vit bakgrund. Varning och ok skiljer sig i ljushet, så att rött och grönt inte behöver skiljas på
  färgtonen (`tests/farger.test.js`, ADR-43).
- **I webbläsare 2026-11-24:** axe-core 4.14 (WCAG 2.0 och 2.1, A och AA, med färgkontrast) prövade var och en av
  de 17 flikarna med alla avsnitt utfällda, i Chromium 1400 punkter brett, med det lilla och det stora demot (5 000
  påhittade personer). Resultatet: **inga överträdelser**. Det axe inte kunde avgöra är genomgånget: texten i
  diagrammen (axe läser inte bakgrunden i en SVG) är mätt för sig mot den yta den står på, och all text når 4,5:1;
  flikarnas inledningar, som axe inte kunde avgöra för att de överlappas, har minst 6,9:1. Prövningen hittade två
  brister, som är rättade: en text på en fyllning i en mellanton (trädkartan, staplade staplar) nådde 4,0–4,4:1 och
  har nu en kant i motsatt färg, och ett kortat namn i diagrammens förklaring stod inte i knappens namn (WCAG 2.5.3)
  och kortas nu vid ett ordslut.
- **Tangentbordet:** jsdom-testerna prövar pilarna, Home och End i menyn (`tests/start-och-meny-app.test.js`), och
  fokus, dialogerna, de sorterbara tabellerna, de hopfällbara grupperna och förklaringarna (ⓘ) med tangentbordet
  (`tests/a11y-tangentbord.test.js`). Röktestet
  i Chromium, Firefox och WebKit prövar tre saker. Avsnittens rubriker nås med Tab och fälls ut med Enter. Vid
  900 punkter är menyn ihopfälld till ikoner som behåller sina namn, och ingen flik är bredare än fönstret. Vid
  640 punkter ligger menyn bakom knappen Meny: ett klick visar den, ett val öppnar fliken, och ingen flik är bredare
  än fönstret.

## Det som stöds

- Flikarna nås med Tab, och pilarna, Home och End byter flik; stilmallen har fokusmarkering (`:focus-visible`).
- Fokus stannar kvar när en yta ritas om, och ett val i menyn lämnar fokus på menyknappen. Dialogerna håller kvar
  fokus medan de är öppna, stängs med Escape och lämnar tillbaka fokus till det som öppnade dem.
- Sorterbara kolumner sorteras och hopfällbara grupper fälls ut med Enter eller blanksteg; skärmläsaren får
  sorteringen och om gruppen är utfälld. Förklaringarna (ⓘ) nås med Tab och läses upp.
- Resultatet av en åtgärd (inläsning, export, analys) läses upp av skärmläsaren.
- Varje diagram har en textbeskrivning (`aria-label` på diagrammet), och i diagramytan går piltangenterna mellan
  datapunkterna. Talen finns också i tabeller.
- Två lägen: *vägledande* med förklaringar och *kompakt*.

## Kända begränsningar

- **Telefon och surfplatta stöds inte.** Verktyget är byggt för datorskärm. I ett smalt fönster fungerar menyn
  och sidan går inte utanför fönstret, men tabellerna och diagrammen är inte utformade för en liten skärm.
- **Utskriftsfönstret** för checklistan i Regler & praxis och handlingsplanens mall öppnas som ett eget fönster
  utan skript, och webbläsarens utskriftsdialog visas direkt. Fönstret har ingen egen navigering; stäng det med
  webbläsarens vanliga kommando.
- **Diagrammens text** är kontrastmätt i webbläsaren 2026-11-24 (se ovan), inte i varje testkörning; färgerna
  följer paletten som prövas i `tests/farger.test.js`.
- **Skärmläsare** är inte prövade med en användare. Prövningen ovan är automatisk och strukturell.
- **Exporterna** (Word, Excel, PDF) är inte granskade mot tillgänglighetskrav för dokument; Word-utkastet har
  rubrikformat (Rubrik 1–3) och bildtexter under diagrammen, och PDF-rapporten skrivs ut från webbläsaren.
- **Fokusmarkeringen och förstoring** är inte prövade automatiskt; checklistan för skarp data (avsnitt E) har kontrollen av fokusmarkeringen.

## Synpunkter

Brister i tillgängligheten rapporteras som ärende (mallen *Fel*) eller till adressen i `SECURITY.md`. Skicka
aldrig verklig lönedata.
