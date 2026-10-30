# Öppen lönekartläggning — analysverktyget som gör lagkravet hanterbart

**För:** HR-chefer och HR-specialister som ansvarar för den årliga lönekartläggningen
**Vad:** Ett analysverktyg för lönekartläggning enligt diskrimineringslagen 3 kap. och EU:s lönetransparensdirektiv (2023/970) — i **en enda fil** som körs lokalt i webbläsaren.

---

## Problemet

Lönekartläggningen är ett årligt lagkrav som kräver statistisk analys, dokumentation och handlingsplan — och EU:s lönetransparensdirektiv skärper kraven. Alternativen är ofta dyra konsulttimmar, molntjänster som kräver upphandling och biträdesavtal, eller manuellt Excel-arbete där metoden är svår att försvara i samverkan.

## Lösningen

**Läs in er personalfil (CSV eller Excel) — få färdiga underlag.** Menyn följer processens faser: **1 Underlag** (inläsning och kontroll av underlaget) → **2 Kartlägg och analysera** (regler och praxis, lika arbete, likvärdigt arbete, struktur) → **3 Åtgärda** (prioritering, löneöversyn, handlingsplan) → **4 Fördjupa** (frivillig) → **5 Dokumentera** (underlag till rapporten och samverkan).

### Det här får ni

- **Hela lagkedjan i ett verktyg:** genomgång av bestämmelser och praxis, lika arbete med regression och oförklarat gap, likvärdigt arbete, EU-direktivets rapportmått, prioritering med kostnadsberäkning och handlingsplan.
- **Färdig dokumentation, inte bara siffror:** ett klick ger ett **redigerbart Word-utkast av dokumentationen** — verktygets fynd är ifyllda och era kvalitativa bedömningar markeras som gula *[HR fyller i]*-fält. Därtill en Excel-fil med hela underlaget, en PDF som låst kopia av utkastet (hela dokumentationen, ledningsbrief, facklig dialog eller ett eget urval av avsnitt), en ZIP-fil med allt, protokoll för **gemensam lönebedömning** i samverkan med facket, förifyllt underlag till handlingsplanen och budgetprognos. Varje siffra går att återskapa med knappen *Visa beräkningen*.
- **Byggt för HR, inte statistiker:** coachande språk ("Börja här", "Värt att granska" — aldrig larm), bakgrundspaneler som förklarar t.ex. skillnaden mellan *oförklarad* och *osaklig* löneskillnad, och en lista *Att göra* som visar var ni ska börja.
- **Resultatet först:** varje flik öppnar med sina viktigaste tal och sitt huvudresultat; fördjupningen ligger i avsnitt som fälls ut vid behov. Diagrammen är valda efter vad de ska visa — ett tal som jämförs mot lika lön ritas som en punkt med osäkerhet mot en linje, inte som en stapel — och där ett diagram skulle visa för lite står en tabell med grafiken i raden.
- **Etablerade statistiska metoder:** regression med robusta standardfel, konfidensintervall och skydd mot falska utslag vid många jämförelser. Metoderna beskrivs i verktygets flik *Om verktyget*.

### Tryggt ur dataskyddssynpunkt — inbyggt från början

- **Ingen data lämnar datorn.** Allt bearbetas i webbläsarens minne; nätverkstrafik är tekniskt spärrad, och verktyget sparar ingenting på datorn. Inget molnkonto, ingen server, inget biträdesavtal.
- **Minimerat:** endast fem fält läses in (lön, kön, ålder, yrke och BAS), plus två valfria (arbetsvärderingspoäng per befattning och ansvarskod enligt AID) — filer med personnummer, namn eller e-post avvisas.
- **Små grupper skyddas i det som lämnar verktyget:** på skärmen visas alla grupper, men i Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder och rapportunderlaget redovisas inte lönemått för grupper med färre än 10 personer (k-anonymitet). Standardvärdet är 10; ni kan ändra det (ett lägre värde kräver bekräftelse och visas som en varning), och värdet står i metodbilagan och i exporterad data (under 10 även på diagrambilder, kopierade tabeller och rapporter). Två medvetna undantag: **likvärdigt arbete** prövar även små kvinnodominerade yrken, eftersom lagen kräver det (fliken och dess export visar dem; Word-utkastet, PDF-rapporten och rapportunderlaget gör det inte), och i fliken **Utforska** följer små grupper bara med i exporten om ni själva väljer det. Därtill listar **Personer att granska** enskilda personer som ligger klart under sina kollegor — bara i verktyget, aldrig i någon export eller utskrift. Diagram med en punkt per person (lön mot ålder) visar enskilda löner; bilder av sådana diagram ingår i PDF-rapportens mall *Komplett rapport* och i ZIP-exporten. Medianlön per kön, det råa lönegapet och regressionens ojusterade steg visas bara när både kvinnor och män är minst 10; den justerade löneskillnaden i Lika arbete visas från regressionens eget golv, 5 av varje kön. I Ålder & karriär gäller samma regel för lönegap, trendlinjer och lådor per kön, och en persons punkt visas bara när personens grupp (yrke inom BAS) och kön i gruppen når tröskeln.
- **Underlag till dataskyddsombudet ingår:** en risk- och sårbarhetsanalys som underlag för er konsekvensbedömning (DPIA), med **färdiga svar på IT:s och dataskyddsombudets vanligaste frågor** (biträdesavtal? nätverk? lagring? — nej, nej, nej).
- **Kvalitetssäkrat:** över två tusen automatiska tester (bland annat dataskydd och tillgänglighet) körs vid varje ändring, och varje bygge är spårbart med kontrollsumma.

### Kom igång på fem minuter

1. Öppna filen i webbläsaren på en dator — ingen installation, ingen IT-beställning.
2. Klicka **"Prova med demodata"** och utforska hela verktyget med påhittad exempeldata — ingen verklig lönedata behövs för att utvärdera.
3. När ni är redo: läs in er organisations **organisationspaket** (ställningstagande, jämförelsestatistik och benämningar i en fil, som er systemägare tar fram i verktyget) och därefter personalfilen ur lönesystemet (heltidsomräknade månadslöner, CSV eller Excel).

---

**Viktigt att veta:** Verktyget pekar ut *kandidater* för granskning — det dömer inte. Bedömningen av sakliga skäl och den slutliga dokumentationen är er, i samverkan med facklig part. Verktyget levererar underlagen.

*Öppen lönekartläggning · versionen står i `RELEASE.txt` · körs lokalt, helt utan molntjänst · medföljande dokument: körguide, guide för datauttag, pilotchecklista och risk- och sårbarhetsanalys (`riskanalys.md`).*
