# Exporterna — referens

Exporterna är filerna och urklippen som lämnar verktyget: Word-utkastet, PDF-rapporten, Excel-filen, ZIP-filen,
protokollet för gemensam lönebedömning, tabellernas CSV och urklipp och diagrammens bilder och diagramdata. Det här
dokumentet bär den **gällande lydelsen** för hur de byggs och i vilket format. Koden är sanningen; där dokumentet och
koden skiljer sig är det dokumentet som ska rättas.

Varför det är så här står i besluten i [`arkitekturbeslut.md`](arkitekturbeslut.md): ADR-15 (formelskyddet), 37
(Word-utkastet), 40 (de fyra samlade exporterna), 75 (Word-utkastets täta läge) och 79 och 93 (protokollet).
**Minsta gruppstorlek** i exporterna, exportläget och exportgrinden står i [`k-troskeln.md`](k-troskeln.md) (§2–§4 och
§9), diagrammens bilder och diagramdata i [`diagramkarnan.md`](diagramkarnan.md) §6–§8, och här upprepas inget av det.
Protokollet mot direktivets art. 10.2 står i [`lagrum.md`](lagrum.md). Hur exporterna beskrivs för dataskyddsombudet
står i riskanalysen (`docs/dataskydd/riskanalys.md` §6.6). Jämförelsestatistikens Excel-fil står i
[`granssnittet.md`](granssnittet.md) §4.

| Del | Fil |
|---|---|
| Formelskyddet, CSV-texten och urklippets text | `src/lib/csv.js` (`neutraliseraCell`, `tillCsv`, `tillTsv`) |
| Nedladdningen av en fil (alla exporter) | `src/app/03-hjalpfunktioner.js` (`laddaNer`) |
| CSV-filen och exportnotisen | `src/app/22-exporthjalpare.js` (`_laddaNedCSV`, `_visaExportvarning`) |
| Urklippet | `src/app/12-tillstand.js` (`_kopieraMatrisTillUrklipp`) |
| Rapportmodellen, som Word-utkastet och PDF-rapporten ritas ur | `src/app/58-rapportmodell.js` (`rapportModell`, `rmTillHtml`) |
| Word-utkastet som Office Open XML | `src/lib/docx.js` (`docxDelar`, `xmlText`); `src/app/62-word-utkast.js` (`byggWordUtkast`) |
| PDF-rapporten och utskriften av checklistan och handlingsplanen | `src/app/60-utskrift.js` (`skrivUtMallflik`) |
| Excel-filen med alla flikar och protokollet | `src/app/24-excelexport.js` (`_excelAlltBok`, `exportJPAProtokoll`) |
| ZIP-filen | `src/app/66-zip-export.js` |
| Förhandsbeskedet vid knapparna | `src/app/59-exportbesked.js` (`ritaExportBesked`) |
| Vakterna | `tests/csv.test.js`, `tests/docx.test.js`, `tests/exports.golden.test.js` |

## 1. De samlade exporterna

Alla exporter körs i exportläget (`medExportLage`, `k-troskeln.md` §3).

- **Word-utkastet och PDF-rapporten** ritas ur samma rapportmodell (`rapportModell`) med det urval av avsnitt som
  gäller, så att de inte kan säga olika saker. Word-utkastet görs av modellens HTML (`rmTillHtml`) som blocklista
  (avsnitt 3); PDF-rapporten skrivs ut ur sidan. Med hela dokumentationen vald får utskriften bilagor med flikarnas
  tabeller och diagram; de kortare urvalen är bara avsnitten.
- **ZIP-filen** (`lonekartlaggning_export.zip`) innehåller Excel-filen med alla flikar
  (`lonekartlaggning_komplett.xlsx`), Word-utkastet och en bild 1920 × 1080 av varje diagram som är ritat och får
  exporteras (`diagram/<id>.png`). Varje upplåst flik ritas först, utom Exportera, Rapporttext, Spara och jämför år,
  Om verktyget och För systemförvaltaren; Spara och jämför år ritas när ett årsbokslut är inläst. Ett fel i en del
  stoppar inte de andra: det rapporteras (`granssnittet.md` §6), och filen får det som gick att bygga.
- **Exportnotisen** (`_visaExportvarning`) visas efter en sparad fil och säger att filen innehåller lönedata och ska
  hanteras som personuppgifter.
- **Demodata** märks: Word-utkastets sidfot och filnamn säger DEMODATA, och CSV-filer, diagrambilder och diagramdata får
  prefixet `DEMO_` i filnamnet.

## 2. CSV och urklipp: formelskyddet

En textcell som börjar med `=`, `+`, `-`, `@`, tabb eller vagnretur blir en formel när filen öppnas eller klistras in i
ett kalkylprogram. Texter kommer ur lönefilen, så en fientlig fil kunde annars lägga en formel i en export. Därför går
varje cell i en CSV-fil och i urklippet genom `neutraliseraCell`:

- **En sådan textcell** får ett inledande `'`, som kalkylprogrammet visar som text.
- **Ett tal** lämnas orört, också formaterat med tecken och enhet (`-3,2 %`, `-1 250 kr`, med `st` eller `år`).
- **Ett tal som börjar med `−`** (U+2212, tabellernas minustecken) skrivs med `-`, eftersom kalkylprogrammet annars läser
  det som text. Text med `−` som inte är ett tal, som ett intervall, står kvar.

**CSV-filen** (`tillCsv`, `_laddaNedCSV`) har semikolon som avgränsare, radsluten CRLF, en inledande UTF-8 BOM och
citattecken kring en cell som innehåller avgränsaren, ett citattecken eller en radbrytning. **Urklippet** (`tillTsv`) är
tabbavgränsad text med samma formelskydd. Excel-filerna skriver text som textceller och berörs inte av skyddet.

## 3. Word-utkastet

Word-utkastet är en riktig `.docx`: Office Open XML som `docxDelar` skriver ur en blocklista (rubriker, stycken,
tabeller, bilder) och appen packar med JSZip.

- **Rubrikerna** har Word-standardens stilar *Heading1*–*Heading3* med dispositionsnivå, så att navigeringsfönstret och
  en innehållsförteckning fungerar. Brödtexten är 11 pt, tabellstilen 10 pt, språket `sv-SE`.
- **Metadata** bär titeln, skaparen och programmet *Öppen lönekartläggning* och tidpunkten, aldrig något namn på en
  person. Sidfoten bär stämpeln för minsta gruppstorlek och *UTKAST* (och DEMODATA för demot).
- **Tabeller** har fasta kolumnbredder ur en uppskattning av ordens bredd. En tabell vars celler och rubriker inte ryms i
  10 pt skrivs tätare: 9 pt och cellmarginalen 57 twips till vänster och höger i stället för 85 (ADR-75).
- **Text** escapas och rensas från tecken som är ogiltiga i XML (`xmlText`). En bild utan bilddata skrivs som sin
  bildtext inom hakparentes.

## 4. Protokollet för gemensam lönebedömning

Protokollet (`exportJPAProtokoll`) är en Excel-fil med åtta blad. Vilka led i direktivets art. 10.2 bladen täcker står
i [`lagrum.md`](lagrum.md); vad som utelämnas och döljs under tröskeln i `k-troskeln.md` §2 och §4.

| Blad | Innehåll |
|---|---|
| 1. Försättssida | Omfattningen i antal, fält för deltagarna i samrådet och fält för den gemensamma sammanfattningen, bland dem löneökningen efter föräldraledighet eller ledighet för vård av anhörig, utvärderingen av föregående åtgärder och analysen av systemen för könsneutral arbetsvärdering och arbetsindelning |
| 2. Lika arbete (AID) | Grupperna med statusen *Värt att granska* i Lika arbete, mest negativ skillnad först |
| 2a. Lika arbete, alla grupper | Alla grupper i Lika arbete: samma blad som *Lika arbete AID x BAS* i Excel-filen med alla flikar, byggt av samma funktion (`_aidbasLikaBlad`); antal och medianer, inga medelvärden |
| 3. Likvärdigt arbete (BAS) | BAS-intervallen där regressionens oförklarade skillnad är säkerställd efter korrigering för många tester och minst 3 % |
| 3b. Likvärdigt arbete (krav) | Kandidatparen som når tröskeln |
| 4. Exkluderat (små grupper) | Det som utelämnats under tröskeln |
| 5. Metodik & rättslig grund | Metoden |
| 6. Signaturer | Underskrifterna |

- **Urvalet och statusen** följer i blad 2 Lika arbetes grupper och status (`laLikaGrupper`, ur medianerna) och i
  blad 3 regressionen per BAS-intervall; medelvärdet ändrar inget urval.
- **Lönenivåerna** i blad 2 och 3: median och medelvärde per kön, med skillnaden i kronor och kvinnors i procent av
  mäns. I blad 3 gäller de samma personer som regressionen. Medelvärdena står bara för en grupp där båda könen når
  tröskeln (`jpaNivaCeller` i `src/lib/jpaprotokoll.js`); annars står `—`.
- **Fälten att fylla i** per rad i blad 2 och 3: sakliga skäl, den fackliga partens kommentar, status efter samråd,
  överenskommen åtgärd, tidplan och ansvarig.
