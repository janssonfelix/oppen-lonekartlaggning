# Öppen lönekartläggning — analysverktyget som gör lagkravet hanterbart

**För:** HR-chefer och HR-specialister som ansvarar för den årliga lönekartläggningen
**Vad:** Ett analysverktyg för lönekartläggning enligt diskrimineringslagen 3 kap. och EU:s lönetransparensdirektiv (2023/970) — i **en enda fil** som körs lokalt i webbläsaren.

---

## Problemet

Lönekartläggningen är ett årligt lagkrav. Lönerna ska kartläggas och analyseras, skillnader utan sakliga skäl ska åtgärdas och arbetet ska dokumenteras. Lönetransparensdirektivet skärper kraven när det införs. Alternativen är ofta dyra konsulttimmar, molntjänster som kräver upphandling och biträdesavtal, eller manuellt Excel-arbete där metoden är svår att försvara i samverkan.

## Lösningen

**Läs in lönefilen (CSV eller Excel) — få färdiga underlag.** Menyn följer rapportens ordning i fyra delar:

1. **Underlag:** översikt, inläsning och kontroll av underlaget, regler och praxis.
2. **Kartläggning:** löneläget, lika arbete, likvärdigt arbete, lönestruktur, ålder och karriär. Löneläget och ålder och karriär är fördjupning, inget lagkrav.
3. **Åtgärder:** prioritering, löneöversyn, handlingsplan.
4. **Rapport:** rapporttext, export och egna tabeller.

Därtill finns **Spara och jämför år**, där arbetet sparas som fil och jämförs med förra året. Sökrutan hittar både yrken och funktioner. Flikarna har en lista över sina avsnitt som följer med när sidan rullas.

### Det här får du

- **Hela lagkedjan i ett verktyg:** genomgång av bestämmelser och praxis, lika arbete, oförklarad löneskillnad med regression, likvärdigt arbete, direktivets rapportmått, prioritering med kostnadsberäkning och handlingsplan.
- **Färdig dokumentation, inte bara siffror:** ett klick ger ett **redigerbart Word-utkast av dokumentationen**. Verktygets fynd är ifyllda, och dina bedömningar markeras som gula *[HR fyller i]*-fält. Därtill får du en Excel-fil med hela underlaget och en PDF som låst kopia av utkastet. PDF:en kan vara hela dokumentationen, en ledningsbrief, en facklig dialog eller ett eget urval av avsnitt. Du får också en ZIP-fil med allt, protokoll för **gemensam lönebedömning** i samverkan med facket, förifyllt underlag till handlingsplanen och en budgetprognos. Varje siffra går att återskapa med knappen *Visa beräkningen*.
- **Byggt för HR, inte statistiker:** språket coachar ("Börja här", "Värt att granska") och larmar aldrig. Bakgrundspaneler förklarar till exempel skillnaden mellan *oförklarad* och *osaklig* löneskillnad. En lista *Att göra* visar var du ska börja.
- **Resultatet först:** varje flik öppnar med sina viktigaste tal och sitt huvudresultat. Fördjupningen ligger i avsnitt som fälls ut vid behov. Diagrammen är valda efter vad de ska visa. Ett tal som jämförs mot lika lön ritas som en punkt med osäkerhet mot en linje, inte som en stapel. Där ett diagram skulle visa för lite står en tabell med grafiken i raden.
- **Etablerade statistiska metoder:** regression med robusta standardfel, konfidensintervall och skydd mot falska utslag vid många jämförelser. Metoderna beskrivs i verktygets flik *Om verktyget*.

### Tryggt ur dataskyddssynpunkt — inbyggt från början

- **Ingen data lämnar datorn.** Allt bearbetas i webbläsarens minne. Nätverkstrafik är tekniskt spärrad, och verktyget sparar ingenting på datorn. Inget molnkonto, ingen server, inget biträdesavtal.
- **Minimerat:** bara fem fält läses in: lön, kön, ålder, yrke och BAS. Två fält är valfria: arbetsvärderingspoäng per befattning och ansvarskod enligt AID. Filer med personnummer, namn eller e-post avvisas.
- **Små grupper skyddas i det som lämnar verktyget:** på skärmen visas alla grupper. Men i Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder och rapportunderlaget redovisas inte lönemått för grupper med färre än 10 personer (k-anonymitet). Standardvärdet är 10, och du kan ändra det. Ett lägre värde kräver bekräftelse och visas som en varning. Värdet står i metodbilagan och i exporterad data, och under 10 även på diagrambilder, kopierade tabeller och rapporter.
- **Två medvetna undantag:** **likvärdigt arbete** prövar även små kvinnodominerade yrken, eftersom lagen kräver det. Fliken och dess export visar dem, men Word-utkastet, PDF-rapporten och rapportunderlaget gör det inte. I fliken **Tabeller och egna vyer** följer små grupper bara med i exporten om du själv väljer det.
- **Enskilda personer:** **Personer att granska** listar enskilda personer som ligger klart under sina kollegor. Listan finns bara i verktyget, aldrig i någon export eller utskrift. Diagram med en punkt per person (lön mot ålder) visar enskilda löner. Bilder av sådana diagram ingår i PDF-rapportens mall *Komplett rapport* och i ZIP-exporten.
- **Löneskillnaden mellan könen:** medianlön per kön, den råa löneskillnaden och regressionens ojusterade steg visas bara när både kvinnor och män är minst 10. Den justerade löneskillnaden (regressionen i Lönestruktur) visas från regressionens eget golv, 5 av varje kön. I Ålder & karriär gäller samma regel för löneskillnader, trendlinjer och lådor per kön. En persons punkt visas bara när personens grupp (yrke inom BAS) och kön i gruppen når tröskeln.
- **Underlag till dataskyddsombudet ingår:** en risk- och sårbarhetsanalys som underlag för organisationens konsekvensbedömning (DPIA). Den har **färdiga svar på IT:s och dataskyddsombudets vanligaste frågor** (biträdesavtal? nätverk? lagring? — nej, nej, nej).
- **Kvalitetssäkrat:** över två tusen automatiska tester (bland annat dataskydd och tillgänglighet) körs vid varje ändring, och varje bygge är spårbart med kontrollsumma.

### Kom igång på fem minuter

1. Öppna filen i webbläsaren på en dator — ingen installation, ingen IT-beställning.
2. Klicka **"litet demo"** (under *Prova med demodata*) och utforska hela verktyget med påhittad exempeldata — ingen verklig lönedata behövs för att utvärdera.
3. När du är redo: läs in organisationens **organisationspaket**. Det är en fil med ställningstagande, jämförelsestatistik och benämningar, som organisationens systemägare tar fram i verktyget. Läs sedan in lönefilen ur lönesystemet (heltidsomräknade månadslöner, CSV eller Excel).

---

**Viktigt att veta:** Verktyget pekar ut *kandidater* för granskning — det dömer inte. Bedömningen av sakliga skäl och den slutliga dokumentationen är din, i samverkan med facklig part. Verktyget levererar underlagen. Verktyget är ett stöd för arbetsgivarens egen lönekartläggning. Användaren ansvarar för hur verktyget används, för tolkningen av resultaten och för den juridiska bedömningen. Verktyget är inte juridiskt granskat. Verktyget är ännu inte prövat med verklig lönedata hos en arbetsgivare; checklistan för skarp data finns för den som gör det först. Word-utkastet är prövat i LibreOffice, ännu inte i Microsoft Word.

*Öppen lönekartläggning · versionen står i `RELEASE.txt` · körs lokalt, helt utan molntjänst · medföljande dokument: körguide, guide för datauttag, checklistan för skarp data och risk- och sårbarhetsanalys (`riskanalys.md`).*
