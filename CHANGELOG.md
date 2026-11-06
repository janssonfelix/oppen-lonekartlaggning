# Changelog — Öppen lönekartläggning

Datumformat: `ÅÅÅÅ.MM.DD` (CalVer). Varje version är ett bygge av en enda HTML-fil,
`dist/oppen-lonekartlaggning.html`, gjort med `npm run bundle`. Byggets SHA-256 står i
`dist/RELEASE.txt`.

## Oförlöst

### Gränssnitt

- **Fliken Filer och kvalitet.** Filrutorna (organisationspaket, lönefil, ställningstagande och jämförelsestatistik),
  Underlagets kvalitet, extremvärdena och inläsningsrapporten flyttar från Översikt till en egen flik i *1 ·
  Underlag*. Översikt behåller Kom igång, nyckeltalen, Att göra och processen, och raden överst har knappen dit.
  Kvartildiagrammet på Översikt är borttaget; Lönestruktur ritar samma bild. En låst flik och kolumnmappningen leder
  till lönefilskortet i Filer och kvalitet.
- **Lönestruktur: varför gapet sitter där det sitter.** Struktur & rapportmått heter Lönestruktur och tar över
  *Lönegap per BAS-intervall*, *Könsfördelning per BAS-intervall* och *Vad blir kvar av lönegapet?* (förklaringsmodellen,
  regressionen och Blinder-Oaxaca) från Lika arbete, och *Var uppstår löneskillnaden?* från Översikt. Lika arbete
  behåller yrkesgrupperna med trattdiagrammet, Personer att granska, *Lika arbete AID x BAS* och *Analys på
  individnivå*; nyckeltalen överst har kvar regressionens tal. I Lönestruktur är bara representationen utfälld när
  fliken öppnas. Metodbilagans ordning i Excel och utskrift är densamma som förut.
- **Rapporten i tre flikar.** Dokumentera & exportera delas i **Rapporttext** (auto-rapportutkastet och
  rapportunderlaget; låst utan lönefil), **Exportera** (färdigchecken, robustheten direkt efter den, rapportens
  innehåll och all export) och **Spara och jämför år** (konfigurationen, ögonblicksbilden, jämförelsen med förra året
  och självdiagnostiken; öppen utan lönefil). Avsnittet Samverkan och uppföljning är borttaget: dess två knappar,
  protokollet för gemensam lönebedömning och handlingsplanen i Excel, står i Handlingsplans kort *Samverkan &
  uppföljning*. Alla tre flikarna ritas i exportläget.
- **Prioriteringens trösklar och viktning står i Inställningar.** Granskningsgränsen, *Börja här*-tröskeln,
  uppföljnings- och över referens-gränsen och viktningen av prioriteringsindexet flyttar ur Prioritering till en egen
  rubrik i Inställningar, mellan *Gäller alla flikar* och *Läge*. Fliken har raden *Trösklar och viktning*, som säger
  om värdena är ändrade, med länken *Ändra*. En konfigurationsfil sätter värdena som förut.
- **Menyn i rapportens ordning.** Grupperna heter *1 · Underlag*, *2 · Kartläggning*, *3 · Åtgärder*, *4 · Rapport*,
  *Arbetet* och *Hjälp*; *Fördjupa (ej lagkrav)* finns inte längre. Jämförelse heter **Löneläget** och står först i
  Kartläggning, Ålder & karriär sist; båda säger i verktygstipset och inledningen att de är fördjupning och inget
  lagkrav. Utforska heter **Tabeller och egna vyer** och står efter Exportera. *Nästa steg* följer menyn (Regler &
  praxis → Löneläget → … → Handlingsplan → Rapporttext → Exportera) och hoppar över Löneläget och Ålder & karriär
  när de är låsta; leder raden till en låst flik öppnas lönefilskortet, som menyn gör. Processkartans faser heter
  som menyn, och fliknamnen i gränssnittet och exporttexterna är bytta.
- **Sidindex: På den här sidan.** Varje flik med minst tre synliga avsnitt har en lista över dem som följer med när
  sidan rullas. Från 1920 punkters bredd står den i marginalen till höger; smalare än så är den en rad överst,
  *På den här sidan: …*, som säger vilket avsnitt läsaren är i och fälls ut med ett klick. Ett klick på ett avsnitt
  fäller ut det, rullar fram det och ger det fokus. Dolda avsnitt står inte i listan, och den byggs om när fliken
  ritas om.
- **Sökrutan hittar funktioner.** Fältet i sidhuvudet hittar också flikarnas avsnitt, exporterna, dialogerna och
  fälten i Inställningar, med synonymer (*regression* hittar *Vad blir kvar av lönegapet?*), och syns utan lönefil.
  Träfflistan har grupperna först och funktionerna under rubriken *Funktioner*. En funktion i en låst flik säger
  *kräver lönefil* och leder till lönefilskortet i Filer och kvalitet.

### Analys

- **Spärr mot särskilda kategorier av personuppgifter.** Lönefilen avvisas när en kolumnrubrik antyder fackmedlemskap,
  hälsa, sjukfrånvaro, diagnos, etnicitet, religion, politisk tillhörighet, sexuell läggning, funktionsnedsättning,
  genetik eller biometri — som identifierare avvisades redan. Bara rubriken prövas (lagrum.md, C23b).

### Dokumentation

- **Dokumentationen följer den nya menyn.** Körguiden, pilotchecklistan, sammanfattningen för HR-chefer,
  organisationspaketets guide, datauttaget, tillgänglighetsredogörelsen, dataskyddsbeskrivningen, riskanalysen, den tekniska
  planen, diagramkärnans referens, `src/app/README.md` och fliken Om verktyget (flikarna och arbetsgången) beskriver flikarna som de heter
  och ligger nu. Körguiden har ett avsnitt *Hitta rätt: sök och sidindex*.
- **Ansvar och roller, styrning och övertagande.** README har ett avsnitt *Ansvar och roller* (personuppgiftsansvar,
  cyberresiliensakten och produktansvarsdirektivet, AI-förordningen, lagrummens status *Förslag*), med artiklarna i ett
  nytt avsnitt *Produkt- och säkerhetsregler* i `docs/utveckling/lagrum.md`. `GOVERNANCE.md` säger vem som beslutar, hur
  en version släpps och vad som gäller om projektet slutar underhållas; `CODE_OF_CONDUCT.md` är en svensk bearbetning
  av Contributor Covenant 2.1. `docs/anvandare/overta-verktyget.md` beskriver hur en organisation bygger, ändrar,
  signerar och sprider sin egen version. Raden om svensk lag om lönetransparens i `lagrum.md` är uppdaterad till
  läget i oktober 2026.

### Utveckling

- **minimatch 11 under ESLint.** Dependabot larmade om minimatch under 11.0.1 (överbelastning via mönster) men kunde inte
  uppdatera, eftersom ESLint låser 10.x; `overrides` i package.json tvingar fram 11, som ESLint fungerar med. Bara ett
  utvecklingsberoende; verktyget bär inte minimatch.
- **Programvaruförteckning (SBOM) på releasen.** `npm run sbom` (`tools/sbom.mjs`) skriver `dist/sbom.cdx.json` i
  CycloneDX med de fyra inbyggda biblioteken (version, licens, kontrollsumma) och artefaktens kontrollsumma;
  release-arbetsflödet signerar den som de andra filerna. Deterministisk, utan beroenden.

## 2026.11.05

### Gränssnitt

- **Inga bilder i stilmallen.** Sorteringspilarna i tabellhuvuden och hänglåsen på låsta menyflikar och före noten om
  dolda grupper ritades som masker ur inbäddade `data:`-adresser; webbläsarens nätverkspanel visade dem som hämtningar
  fast inget lämnade datorn. Pilarna ritas nu med kanter i CSS, menyns hänglås är en inline-SVG i knappen och notens
  hänglås två pseudo-element, och röktestet kräver att stilmallen inte har någon `url(`.
- **Samma ord, färger och mått i alla flikar.** En skillnad mot 3- och 5-procentsgränserna heter *Balanserat*,
  *Följ upp* eller *Värt att granska* i alla flikar, diagram och exporter, med samma färg och symbol (lila för *Värt
  att granska*, också i Lika arbetes BAS-översikt och Utforska); *Börja här* och *Över referens* finns bara i
  Prioritering, och Förklaringen listar orden en gång med färg och märke bundna till ordet. Nyckeltalsraderna visar
  ett mått, kvinnors lön i % av mäns: regressionens oförklarade skillnad i Lika arbete och livscykelmodellens tal vid
  25 och 65 år räknas om, och kortet längre ned säger hur dess skillnad hänger ihop med nyckeltalet; rågapet på
  Översikt har neutral färg, det är en utgångspunkt, inget fynd. Etiketterna säger vad de betyder: *Som i exporten* i
  stället för *Som export*, *Kvinnodominerad*, *Mansdominerad* och *Könsblandad* i Lika arbetes kolumn Dominans,
  *Summa för gruppen (kr/mån)* med verktygstips i Likvärdigt arbete, Excel-bladen och beviset, och Nästa steg-knappen
  till Prioritering heter som menyn. Utforskas rubriker skriver BAS och AID med versaler, Heatmap heter Värmekarta,
  och "Hur används denna flik vid..." heter *Så används fliken i arbetet*.
- **Resultatet först, och breda tabeller utan rullist.** Lika arbete öppnar med tabellen *Kvinnor och män i samma
  yrkesgrupp* och trattdiagrammet under den; tabellen per BAS-intervall och *Lönegap per BAS-intervall* är ett avsnitt
  i Fördjupning, efter Personer att granska, beviset för en rad står vid intervallets namn, diagrammen med samma kvot
  och samma kronor som tabellen visas inte längre (kvotbilden följer med i rapporten) och länkarna i Att göra fäller
  ut avsnittet de leder till. Översikt har Att göra direkt under nyckeltalen, kartan över organisationen står bara i
  Struktur & rapportmått och lönekvartilerna står efter Att göra i hela bredden. Utforska har två öppna avsnitt,
  *Löneöversikt — alla BAS-intervall* och *Egna vyer*, och diagramtypsväljaren grupperna *Vanliga* (Automatisk,
  Staplar, Liggande staplar, Låddiagram, Grupperade staplar) och *Fler diagramtyper*. Dokumentera & exportera är
  menyns sista steg, efter Fördjupa, och *Klar här?*-raderna går genom fördjupningen dit; fliken har bara exporter
  som rader, de fyra raderna med *Öppna fliken* är en rad med länkar till Likvärdigt arbete, Struktur & rapportmått,
  Prioritering och Löneöversyn, och fältet *Organisation* står intill *Generera PDF* med en mening om att namnet
  skrivs på rapportens försättsblad och hämtas från organisationspaketet. I Löneöversyn står *Föreslå fördelning mot
  osakliga gap* också i rutan Budget (pott), aktiv när en pott är angiven; knappen fäller ut Riktade potter och rullar
  dit, och lönesumman säger "från …" bara när den ändrats. Prioriteringslistan, yrkesgruppstabellen i Lika arbete och
  kandidatparen i Likvärdigt arbete visar det viktigaste först: statusen står direkt efter namnet (i Likvärdigt
  intervallet med *säker skillnad*, efter Gap (%)), och sekundära kolumner ligger bakom knappen *Fler kolumner* bredvid
  Kopiera och CSV, så att tabellerna ryms vid 1280 px med menyn utfälld. Valet gäller tabellen under sessionen och
  lagras inte; Kopiera, CSV, Excel och utskriften tar alltid med alla kolumner, och de gömda talen står i beviset
  (förstoringsglaset) på raden.
- **Handlingsplanen fylls i på skärmen.** Sakligt skäl prövat? och Status är rullistor, Ansvarig och Tidsplan
  fritext. Det som fylls i ligger i minnet, följer med i konfigurationsfilen, Excel-filen, utskriften och Word-utkastets
  åtgärdstabell, och nollas av Rensa all data; fritext som liknar ett personnummer eller en e-postadress ger en
  varning. Alla rader har samma form: yrkesnamnet ("403010 Barnskötare · BAS C") och i Underlag var raden kommer
  ifrån, *Prioritering (under referensen)* eller *Likvärdigt arbete (kandidatpar)*. Word-utkastets tabell under
  Åtgärder och tidsplan är handlingsplanen, med kandidatparen, och ingressen säger "från likvärdighetsanalysen".
- **Jämförelse är en flik med tre avsnitt.** Överblick, mot ställningstagandet (dagens Lönepolitik) och mot
  jämförelsestatistiken; växeln *Jämför mot* är borttagen, fliken syns så snart underlaget och en referens är inlästa,
  och länkar till Lönepolitik leder till Jämförelse. Fliken har en inledning som övriga flikar. Mönster och Förslag på
  referens är en kolumn, *Läge och förslag*, där förslaget bara nämns när det är statistiken; skärmen, Excel-bladet
  Referenser och rapporten säger samma sak. Läget i spannet har skalan i rubriken (0 = P10, 100 = P90) och ett
  verktygstips, och hanteldiagrammet har en rad per yrkesgrupp, med ställningstagandet, statistiken och organisationen
  i var sin färg och en förklaring.
- **Vardagsspråk i inledningar, nyckeltal och hjälptexter.** Prioriteringens inledning och listtext säger vad
  prioriteten väger ihop utan "sammansatt prioriteringsindex", "yrkesgrupp × BAS-intervall" och "1,2× bonus"; filtret
  heter *Visa bara små höjningar med stor effekt*, kostnaden anges med PO-påslag utskrivet och *Så räknas det* beskriver
  statusarna med dagens ord. Struktur och Utforska har sin fråga i fetstil. Om verktyget säger vad verktyget gör och
  vad ni gör själva, med Word-utkastet, Regler & praxis och organisationspaketet på plats; snabbstarten följer
  kartläggningens steg och engelska rubriker i dataskydds- och metodavsnitten är svenska. Ålder & karriär säger
  "inte säkerställd" i stället för "ns", modelljämförelsen markerar med stjärnor som tabellens not förklarar (* p <
  0,05 … *** p < 0,001), modellformeln, standardfelen och referensintervallet står i flikens nya *Så räknas det* →
  *Beräkning & urval*, löptexten säger i en mening vad modellen tar hänsyn till, och *Jämför alla BAS-intervall* visar
  alla intervall oavsett urvalet ovan; histogrammet och ålderskurvan markerar inte längre successionszonen 60+ med
  ett rött fält, nyckeltalet *Andel 60+* och riskrutan bär den läsningen. I Regler & praxis hämtar raden Stöd i verktyget talet från fliken och slutar med
  *Gå dit*: Likvärdigt arbetes par att titta närmare på, Lika arbetes yrkesgrupper att granska och, under befordran,
  andelen kvinnor i högsta och lägsta lönekvartilen; utan underlag står den fasta texten. Krav mot lön i Likvärdigt
  arbete sade "minst 1 personer" på skärmen, och exportkortens *Utelämnar* räknade samma sak två gånger när två
  avsnitt utelämnade det.
- **Efter genomgången: sju öppna beslut.** Regressionens per-BAS-diagram ritar *Säkerställt, över 5 %* i statusens lila,
  inte rött; tratten behåller rött för *Utanför slumpens gränser*, som är en annan skala. Lika arbetes avsnittsnyckeltal
  säger "95,7 % efter ålder och nivå" i stället för "−4,3 % oförklarat", och undertexter över 5 % (Lika arbete, Ålder
  & karriär) är lila som statusen, inte röda. Trädkartan följer med i Word-utkastet och PDF-rapporten under Struktur.
  Excel-bladen *Per BAS* och *Lonegap* behålls båda; *Metod & parametrar* säger vad som skiljer dem. Handlingsplanen
  har knappen *Lägg till rad*: en egen åtgärd med fritext för åtgärd och grupp, som tas bort med *Ta bort* och följer
  med i konfigurationsfilen, Excel-filen, utskriften och Word-utkastet; kortet *5. Handlingsplan* på Översikt räknar
  raderna efter statusen som fyllts i (genomförda, planerade eller pågår, skjuts upp, utan ifyllt) i stället för
  åtgärdslistans bockar. Jämförelsetabellen har *Fler kolumner*: grundvyn visar yrke, BAS, antal och medianens tre
  kolumner, P10 och P90 ligger bakom knappen. Menyn och rubriken säger *Översikt*, inte *Översikt & Data*; sidhuvudets
  ikonknappar gäller upp till 900 punkter; sökfältets ledtext är *Sök yrke eller BAS* med kortkommandot i
  verktygstipset; länkraden i Dokumentera har verktygets länkstil.
- **Menyn, sidhuvudet och flikbytet.** En ny flik börjar överst: flikbytet rullade inte, så den som stod långt ned i
  en flik hamnade långt ned i nästa. Sidomenyns ikonläge (641–1100 px) döljer etiketterna med genomskinlighet i
  stället för `visibility: hidden`, så att knapparna behåller sina namn för skärmläsare. Under 641 punkter är
  Förklaring, Som i exporten, Inställningar och Ordlista ikonknappar på samma rad som sökfältet, med texten kvar i
  knappen för skärmläsare; sidhuvudet vid 375 punkter är 133 punkter högt i stället för 214, och byts fönstret från
  brett till smalt börjar den smala vyn med menyn stängd, utan att spalten glider ut över innehållet.
- **Som export — förhandsvisning av exporten.** Knappen i sidhuvudet visar flikarna som i det som lämnar
  verktyget: grupper under minsta gruppstorlek redovisas inte, en banner och en streckad ram visar att
  förhandsvisningen är på, och *Visa skärmen igen* ritar tillbaka. Efter användartest: skärmen visar alla grupper,
  och den som ska skicka en fil vill se vad som faller bort.
- **Prioritering är vad, Löneöversyn är hur (ADR-50).** Prioritering svarar på vad som bör åtgärdas och vad det
  kostar; Löneöversyn på hur potten fördelas. Lönerevisionssimulatorn i Prioritering är borttagen: en riktad pott i
  Löneöversyn kan i stället begränsas till ett kön eller till löner under en gräns, och lyfta till en nivå
  (*höj till*). PO-påslag och beräkningsperiod står under Inställningar i sidhuvudet (*Gäller alla flikar*) i
  stället för i Prioritering, och Löneöversyns Excel-export beskriver varje riktad rad. Efter användartest: flikarna
  gick in i varandra.
- **Hänvisningarna till SKR är förklarade.** Kolumnerna och märkena som bara sade "SKR" heter nu *Kvinnor nationellt*
  respektive *nationell*, och verktygstipsen säger vad statistiken är (andel kvinnor per yrke i kommuner och regioner),
  varifrån den kommer (SKR:s personalstatistik, med period) och vad valet kommun eller region gör. PO-påslagets
  standardvärde förklaras som SKR:s värde för kommuner och regioner; bristyrkestipset hänvisar inte längre till
  SKR-listor. Ordlistan har fått posten *SKR*, metodbilagan en rad om den nationella referensen, och *Om verktyget*
  förklarar de tre sakerna verktyget hämtar från SKR. Efter användartest: "SKR-statistik" var oklart.
- **Hjälptexterna *Så används fliken*** i Lika arbete, Prioritering och Utforska är omskrivna efter dagens
  avsnitt, knappar och ord (inte längre "waterfall-uppdelningen", "Quantile regression", "röda romber",
  "konfig-panelen"); menyn har ett verktygstips för Prioritering, och ordlistan säger att kvoten (85,2 %) och
  skillnaden (−14,8 %) är samma tal.
- **Rensning vid inaktivitet: 90 minuter som standard** (tidigare 30). Valen är av, 30, 60, 90 och 120 minuter;
  organisationspaketet kan fortfarande låsa tiden. Efter användartest: 30 minuter avbröt ett normalt arbetspass.

### Exporter

- **Fyra blad per AID-kod och BAS-intervall (ADR-57).** Excel-filen har bladen *Lika arbete AID x BAS*, *Likvärdigt
  arbete*, *Hierarkisk jämförelse* och *Analys på individnivå*, med kolumnnamn som går att klistra in i rapporten utan
  att ändras och lönemånaden på raden ovanför tabellen. Lika arbete är samma yrkesgrupp på samma nivå: en rad per
  AID-kod och BAS-intervall ur varje persons egen rad, med kvinnors median i procent av mäns mot slumpens gränser
  (trattdiagrammets omkastning, räknad per grupp) och bedömningen *Inom gränserna*, *Utanför gränserna* eller
  *Analyseras på individnivå* när något kön har färre än tio personer. Likvärdigt arbete klassar varje grupp som
  kvinnodominerad, könsblandad eller mansdominerad, säger om yrket *brukar anses* kvinnodominerat efter andelen kvinnor
  nationellt, ger median och lönespridning ((P90 − P10) / median) för grupper med minst tio personer och en
  sammanfattning per BAS-intervall. Den hierarkiska jämförelsen listar par där ett arbete i lägre BAS som inte är
  kvinnodominerat har högre median än ett kvinnodominerat arbete i högre BAS, eller säger att inga sådana fall finns.
  Arbetslistan för individnivå har grupperna där något kön är under tio, utan löner och med kolumnerna *Analys
  genomförd* och *Resultat* att fylla i. Grupper med färre än fem personer får ingen egen rad utan räknas upp i en not.
  Tal skrivs som tal med svenskt talformat i cellen; procent med en decimal. Bladet Metodik beskriver grupperingen,
  små grupper, gränserna för slumpen och vald definition. Samma tabeller står som avsnitt i Lika arbete och Likvärdigt
  arbete, med Kopiera och CSV.
- **Rättat: fliken Slumpens gränser räknar per AID-kod och BAS-intervall.** Trattdiagrammets underlag grupperade per
  yrkesgrupp över alla BAS-intervall och satte gruppens intervall från dess första rad, så en yrkesgrupp i flera
  intervall redovisades i ett godtyckligt av dem med alla sina personer. Nu är gruppen yrkesgrupp och intervall, i
  diagrammet, i bladet och i tabellen *Lika arbete AID x BAS*, som delar gränserna med fliken.
- **Lönerna mot referenserna.** Nytt blad *Referenser* i Excel-filen, nytt avsnitt *Lönerna mot referenserna* i
  Word-utkastet och PDF-rapporten, block i rapportunderlaget och listan i utskriften. Yrkesgrupper under minsta
  gruppstorlek redovisas inte.

- **Egna tabeller i rapporten (ADR-52).** Ovanför tabellen i Utforska finns *Lägg till i rapporten*: vyn sparas som ett
  recept (rader, kolumner, mått och urval, valfritt en tabell per BAS-intervall) och ritas om med minsta gruppstorlek i
  avsnittet *Egna tabeller* i Word-utkastet och PDF-rapporten, i bladet *Egna tabeller* i Excel-filen och som block
  i rapportunderlaget. Tabellerna
  ordnas och tas bort under *Rapportens innehåll* och följer med i konfigurationsfilen; organisationspaketet kan
  bära dem och receptet per BAS, så att alla handläggare får samma tabeller. Avsnittet per BAS-intervall
  följer ett redigerbart recept: upprepa per BAS eller per sektor, rader, mått, åldersgränser och summeringstabeller.
- **Tabellerna per BAS-intervall, som i en skriven lönekartläggning.** Word-utkastet har ett nytt avsnitt,
  *Lönestruktur per BAS-intervall*, och Excel-filen ett nytt blad, *Per BAS*, byggda efter arbetsgivarnas egna
  utkast: en tabell per BAS-intervall (referensen, organisationen, varje yrkesgrupp med jämförelsestatistikens nivå
  under, kvinnor och män — P10, median, P90 och antal) med ett fält för bedömningen av intervallet, och sist två
  tabeller per BAS: löneskillnader inom likvärdigt arbete (medellön per kön, kvinnors medellön i procent av mäns,
  andel kvinnor, medelålder) och löneskillnader i åldersgrupper (–34, 35–49, 50–). Minsta gruppstorlek gäller:
  yrkesgrupper, intervall och åldersgrupper under gränsen får ingen rad, könsuppdelade mått bara där båda könen når
  den, och avsnittet säger vad det utelämnar. Beräkningen ligger i `src/lib/perbas.js`.

### Analys

- **Valbar förklaringsmodell (ADR-56).** Avsnittet *Vad blir kvar av lönegapet?* i Lika arbete öppnar med panelen
  *Förklaringsmodell*: ta bort BAS-intervall eller ålder, eller lägg till yrkesgrupp inom BAS; fullmodellen är
  utgångsläge och räknar som förut. Tabellen visar vad varje variabel tillför i förklaringsgrad och hur gapet
  flyttar sig, alltid mot fullmodellen, och verktyget föreslår att lämna en variabel utanför när den tillför under
  0,5 procentenheter. Valet styr huvudtalet överallt (Översikt, Att göra, Struktur, rapporten), trappan,
  förklaringsbudgeten och Blinder-Oaxaca; en bortvald variabel blir en mening, "har kontrollerats och tillför …", med
  ett skäl utanför siffrorna som ni kan skriva in, också i rapportens sammanfattning och bilaga. Valet och skälet
  följer med i konfigurationsfilen. Endast kön kan inte väljas när ett kön ligger under minsta gruppstorlek.
- **Kvinnodominerat enligt DO eller SCB.** I Likvärdigt arbetes inställningar väljs definitionen för tabellerna per
  AID-kod och BAS-intervall: DO, mer än kvinnotröskeln (standard), eller SCB, kvinnotröskeln eller mer. En grupp med
  exakt 60 % kvinnor är könsblandad enligt DO och kvinnodominerad enligt SCB. Valet står i bladen och i Metodik och
  följer med i konfigurationsfilen. Kandidatparen i Likvärdigt arbete använder tills vidare sin egen gräns
  (öppen punkt 22 i den tekniska planen).
- **Lönemånad.** Inställningar har fältet *Lönemånad* (fritext, t.ex. 2026-10) som skrivs ovanför tabellerna per
  AID-kod och BAS-intervall; tomt skrivs ut som *inte angiven*, eftersom lönefilen inte säger vilken månad den gäller.
  Följer med i konfigurationsfilen och nollas av Rensa all data.
- **Jämförelse mot båda referenserna (ADR-55).** Fliken Jämförelse visar per yrkesgrupp var löneläget och
  jämförelsestatistiken ligger mot ställningstagandet, som är referenspunkten: skillnaden percentil för percentil,
  läget i spannet, mönstret i ord, ett förslag på referens, en bild med de tre spannen och tabellen statistiken mot
  ställningstagandet. Vyn använder den referens som finns och säger vilken som saknas.
- **Jämförelse med förra året (ADR-54).** Konfigurationsfilen bär ett årsbokslut: nyckeltal, en rad per yrkesgrupp
  där båda könen når minsta gruppstorlek, och Att göra-punkternas läge — inga individer. Spara konfigurationen när
  årets kartläggning är klar och läs in den nästa år, så visar *Jämförelse med förra året* under *Spara och läsa in
  arbetet* nyckeltalen sida vid sida, vilka yrkesgrupper som är flaggade båda åren, nya och inte längre flaggade, och
  vilka av förra årets öppna punkter som är klara. Samma jämförelse står som avsnittet *Jämförelse med förra året*
  i Word-utkastet och PDF-rapporten (efter *Åtgärder och tidsplan*, bara när ett bokslut är inläst), som block i
  rapportunderlaget och som en hantel per yrkesgrupp: förra årets kvot som streck, årets som punkt, grön när den
  närmat sig lika lön och orange när den fjärmat sig.
- **All personal ingår, även BAS K och uppåt.** Begränsningen till BAS A–J är borttagen (ADR-21 upphävd):
  chefsnivåerna läses in och analyseras som alla andra intervall, i stället för att bara räknas. Rimlighetskontrollen
  kräver bara att BAS är en bokstav. Efter användartest: lönekartläggningen ska omfatta hela organisationen.
- **Regressionskortet förklarar sig:** ett avsnitt *Så fungerar regressionen — i tre steg* under inledningen säger
  i vardagsspråk vad modellen gör, vad den räknar bort och inte, och vilket tal i kortet som används till vad.
  Slutsatsen säger vad som blir kvar både med och utan yrkesgruppssteget (tidigare stod två olika "kvarstår" i
  samma block). Internt språk är borta ur kortet ("hero-rutan", "Realistiskt intervall", "Quantile regression",
  "Joint Pay Assessment", "p.e."). Blinder-Oaxaca-kortet säger att det räknar män mot kvinnor och hur talet
  förhåller sig till huvudtalet, och kallar inte längre den oförklarade delen diskrimineringsindikerande.
- **Ålder & karriär:** *Lönegap per åldersgrupp* står direkt under spridningsdiagrammet. Raden under nyckeltalen
  säger i klartext om lönen stiger lika mycket per levnadsår för båda könen och hur mycket åldersfördelningen
  förklarar, i stället för "lutningen skiljer sig med 6 %" och R². Nyckeltalet *Vid samma ålder* säger vad det
  räknar bort och inte. Livscykelavsnittet är lättare: R²-rutorna är borta (talen står i modelljämförelsen),
  tolkningen formulerar hypoteser att pröva i stället för orsaker, tabellens kolumner heter inte *Median* när de är
  modellvärden, och könsskillnaden i modelljämförelsen räknas åt samma håll som huvudmodellen. Hjälptexten *Så
  används fliken* är omskriven efter dagens namn på nyckeltal och paneler, och menyn har ett verktygstips för fliken.
- **Ordlistan** förklarar p-värdet rätt (hur ofta slumpen skulle ge en så stor skillnad om ingen fanns) och har en
  post *Sekventiell dekomponering* med alla stegen i stället för två som sade "tre steg".
- **Ålder & karriär ordnad efter tre frågor.** Överst: finns skillnaden kvar vid samma ålder (nyckeltal, spridning,
  gap per åldersgrupp). Fördjupningen börjar med *Växer gapet med åldern?* (livscykeln, öppen), därefter
  lönespridning över ålder, lönefördelning, åldersstruktur och jämförelsen av alla BAS-intervall. Det andra
  spridningsdiagrammet (*Lön mot ålder, närmare*) är borta; hela urvalets trendlinje är i stället ett valbart lager i
  det övre diagrammet, med samma tröskelregel som förut (visas bara när urvalet når minsta gruppstorlek).
  Nyckeltalet *Ålderskoncentration* ("18 år") heter *Mittersta hälften är* och visar spannet ("35–48 år"), och
  åldersstrukturens risktexter säger att de hör till personalplaneringen, inte till kartläggningen.
- **En bild av dekomponeringen.** Trappan i regressionskortet har fått yrkesgruppssteget, ljusare och efter
  huvudtalet, så att den visar samma sak som förklaringsbudgeten; steglistan med pilar finns kvar för skärmläsare
  och textkopior men visas inte. Den gula metodnoten om median mot geometriskt medelvärde står nu kort i *Så
  fungerar regressionen* (*Två råa gap*). Per-BAS-tabellens rad "För få" säger vad som krävs ("kräver minst 10 av
  varje kön").
- **Ett tecken i hela verktyget: kvinnor mot män, negativt när kvinnor ligger lägre.** Tre ställen räknade åt
  andra hållet och går nu ihop med huvudtalet i Lika arbete: livscykelmodellens skillnad vid 25 och 65 år
  (`gapPerAge` i `src/lib/livscykel.js` är nu log(kvinna) − log(man); nyckeltalen heter *Kvinnors lön mot mäns* och
  en negativ förändring betyder att kvinnorna halkar efter, i texterna, tabellen per BAS och åtgärdslistan),
  Blinder-Oaxaca-kortet (rågap, förklarat och oförklarat visas kvinnor mot män; metoden räknar internt män mot
  kvinnor och kortet säger det) och *Var uppstår löneskillnaden?* på Översikt och i rapportunderlaget
  (`src/lib/gapuppdelning.js` räknar kvinnor − män; negativa belopp betyder att kvinnornas medellön är lägre).
  Undantaget är EU-lönerapportens blad, som har direktivets tecken (art. 9) med tecknet utskrivet, som förut.
- **Blinder-Oaxaca med BAS som indikatorer (ADR-53).** Uppdelningen kodar BAS som en indikator per intervall, som
  huvudregressionen, i stället för som rang; kortets förklarade och oförklarade del vilar därmed på samma variabler
  som huvudtalet, och skillnaden mellan dem är bara att uppdelningen skattar kvinnors och mäns lönesättning var för
  sig. Referensintervallet är det alfabetiskt första som finns hos båda könen; ett intervall som bara finns hos ett
  kön hamnar i samspelet. Raden *BAS-intervall* i tabellen per variabel är summan över indikatorerna.
  Referensvärdena mot statsmodels är omräknade.
- **Täthetskurvorna per BAS är borta ur Ålder & karriär.** De handlade inte om ålder; lönespridningen per BAS och
  kön finns som lådor i Lika arbete, och utskriften använder nu den bilden (*Lönespridning per BAS-intervall och
  kön*). Avsnittet *Jämför alla BAS-intervall* har kvar lön mot ålder i varje intervall.
- **Tre småsaker i texterna.** Kronexemplet i regressionskortet säger också hur stor summan är som andel av
  kvinnornas samlade årslön. Blinder-Oaxaca-kortets förklarade och oförklarade del står i procentenheter av
  rågapet ("10,7 procentenheter") i stället för som negativa procenttal. Inledningen till *Var uppstår
  löneskillnaden?* är en mening utan parentes.
- **Livscykelavsnittet utan dubbletter.** Inledningens tre punkter om växande, krympande och konstant gap är
  borta (tolkningen under kurvan säger det som gäller), liksom metodraden med N och R². Modelljämförelsen har fyra
  rader färre: antal parametrar, R² och ojusterat R² är borta, kvar är antal personer, förklarad del av
  lönespridningen, löneskillnaden och p-värdena.
- **Livscykelns tabell per BAS-intervall** räknar nivåerna ur modellens egna BAS-koefficienter
  (exp(β_BAS − β_visat), ny `basFaktor` i `src/lib/livscykel.js`) i stället för att skala kurvan med kvoten mellan
  intervallens medianlöner; bevisrutan visar faktorn.

### Dataskydd

- **Minsta gruppstorlek gäller det som lämnar verktyget, inte skärmen (ADR-51).** Vyerna visar alla grupper och alla
  könsuppdelade mått oavsett storlek; allt som lämnar verktyget — Excel, Word, PDF, ZIP, CSV, urklipp, diagrambilder,
  rapportunderlaget, gruppdossierns textkopia och allt under Dokumentera & exportera — ritas och räknas i ett
  exportläge med den inställda tröskeln, som förut. Inställningen, stämpeln och metodbilagan är oförändrade; Utforskas
  ruta gäller fortfarande exporten. Efter användartest: den som arbetar i verktyget har redan lönefilen.

### Prestanda

- **Kvantilregressionens konfidensintervall räknas i bakgrunden.** Intervallet (200 omsamplingar × tre
  kvantiler, ett par sekunder vid tusen personer) höll Lika arbete-fliken tills det var klart; nu ritas kortet
  med punktskattningarna och intervallet fylls i strax efteråt, som bootstrap-KI:t vid inläsning. En bild eller
  utskrift som görs innan det är klart bär kortet utan intervall. Testsviten, som ritar fliken i hundratals
  färska fönster, går omkring en tiondel snabbare (170 → 154 s på sexton trådar).
- **Dokumentera & exportera ritas snabbare på stora underlag.** Förhandsbeskedet byggde rapportmodellen tre gånger
  och Excel-bladlistan två; nu en gång var (`rapportModellBada`). Efter en export ritas bara det tillbaka som
  exporten ritade i exportläget, och Lika arbetes minne har ett rum per tröskel, så att ett lägesbyte inte räknar
  om något. På 55 000 rader gick fliken från 12 s till omkring 3 s. Ett byte av minsta gruppstorlek ritar inte
  Översikt två gånger, bygger Att göras lista en gång för Att göra och processöversikten, och räknar om
  bootstrap-KI och styrkan bara när det statistiska golvet ändras — och då i bakgrunden efter omritningen, som vid
  inläsning. Att göra kör regressionen en gång i stället för
  fyra och skickar resultatet vidare till underlagsbedömningen (ingen cache, ADR-17 står kvar).

### Utveckling

- **Testsviten hittar inte andra sessioners arbetskopior.** Vitest utesluter nu `.claude/`, där verktyget lägger
  arbetskopior av hela repot; annars kördes deras testfiler också och sviten blev tre gånger så lång.
- **Dokumenten är allmänna.** README och den tekniska planens §2 säger vilket omfång verktyget har i dag (AID,
  BAS och SKR:s statistik; allt organisationsspecifikt kommer ur paketet). Intern beslutsjargong ("beslut av
  produktägaren") är ersatt av beslut med datum och ADR; checklistan för skarp data, datauttagsguiden,
  lagrumshänvisningarna och planens öppna punkter förutsätter ingen viss pilot, jurist eller
  dataskyddsombud; organisationsfilens designdokument är en formatspecifikation, och dess beslutshistorik
  ligger utanför repot.
- **Läsande tester delar fönster:** `delatFonster()` i testriggen, med en vakt som fäller det test som lämnar fönstret
  ändrat. Tre filer delar (20–25 % snabbare var för sig), elva prövades utan tillräcklig vinst och lämnades; hela
  sviten gick från 176 och 164 s till 168 och 142 s körda växelvis (teknisk plan §6).
- **Riktig Node-typning:** `@types/node` som utvecklingsberoende i stället för den egna minimala typfilen; ett
  typfel i byggskriptet som typfilen dolde är rättat.
- **Stilmallens svans:** 26 klasser utan användning är borttagna och fem komponentklasser med samma deklaration som
  en hjälpklass är utbytta; beräknade stilar jämfördes före och efter i Chromium utan skillnad.
- **Testwrappern räknar rätt vid omkörning:** när en arbetare kraschar efter att filen rapporterat klart och filen
  körs om, dubblas inte dess tester i kontrollen mot teknisk plan (`tools/test.mjs` prövar båda summorna).
- **Testriggen schemalägger inget under nedmonteringen** av ett fönster (`requestAnimationFrame` och `setTimeout`
  stubbas före stängning), så att en uppskjuten omritning inte skriver "d3 is not defined" i CI-loggen.

## 2026.10.19

### Analys

- **Lagrum:** verktyget, exporterna och dokumenten hänvisar nu övergripande ("enligt diskrimineringslagens
  regler om lönekartläggning", "direktivets regler om gemensam lönebedömning") i stället för med paragraf- och
  artikelnummer; de exakta lagrummen står på ett ställe, `docs/utveckling/lagrum.md` (ADR-16). Rapportens avsnitt heter *Åtgärder och tidsplan* och *Samverkan med
  arbetstagarna*. Kvinnodominerat arbete är nu **mer än** 60 % kvinnor (tidigare minst 60 %), och
  icke-kvinnodominerat under 40 %. Hänvisningarna till dataskyddsförordningen är rättade: rensningen är
  lagringsminimering, inte rätt till radering; k-anonymiteten motiveras med uppgiftsminimering och inbyggt
  dataskydd, inte med pseudonymisering.

- **Trattdiagrammet med färre än tio yrkesgrupper** har ett förbehåll under diagrammet, i Word och PDF, och en rad
  i metodbilagan: med så få grupper säger trattens form lite.
- **Regressionen använder BAS som indikatorvariabler (ADR-44):** varje BAS-intervall får sin egen nivå i stället
  för ett lika stort steg per bokstav, så att skillnader mellan intervallen inte blir kvar i det oförklarade
  gapet. Kortet visar nivån per BAS mot referensintervallet.
- **Konfidensintervallen räknas med t-fördelningen (ADR-45):** huvudregressionen, regressionerna per BAS och
  livscykelmodellen använder t-kvantilen i stället för 1,96, så att intervallen i små grupper inte blir för smala.
- **Nytt steg *+ Yrkesgrupp* i dekomponeringen (ADR-46):** könsgapet med fasta effekter för yrkesgrupp inom BAS,
  bredvid huvudtalet (kön + ålder + BAS).
- **Kvantilregressionen** visar ett bootstrap-intervall för könskoefficienten (upp till 5 000 personer), och
  metodtexten säger att skattningen är en approximation.
- **Statistiken är prövad mot statsmodels och scipy:** regressionen, intervallen, p-värdena och
  kvantilregressionen jämförs med referensvärden på en fast fixtur (`tests/stat-referens.test.js`).
- **Minsta påvisbara skillnad per grupp** räknas på spridningen inom grupperna, inte över hela urvalet, och
  blir därmed inte många gånger för stor.
- **Likvärdigt arbete:** kandidatparen får kolumnen *Justerad för ålder* bredvid den råa skillnaden
  (jämförelseyrkets lön omräknad till det kvinnodominerade yrkets åldersfördelning); den följer med i flikens CSV
  och Excel och i rapportunderlaget.
- **Ålder & karriär och livscykelkurvorna** har ett förbehåll om att de bygger på ett tvärsnitt, inte på hur en
  persons lön utvecklas; förbehållet står också i metodbilagan.
- **Struktur:** meningen om vertikal könssegregering hade etiketterna omkastade; den avser nu en högre
  kvinnoandel i det lägst värderade BAS-intervallet än i det högsta.

### Dataskydd

- **Extremvärdeslistan skrivs inte ut:** listan på Översikt visar enskilda löner med radnummer och döljs nu,
  som Personer att granska, när fliken skrivs ut. Tidigare följde den med i utskriften.
- **Webbläsarröktestet prövar fler skydd:** inga nätverksförfrågningar från någon sida under hela körningen,
  att en arbetstråd ur en `blob:`-adress och injicerat skript, `onclick` och `<img onerror>` stoppas av CSP:n,
  och att extremvärdeslistan inte skrivs ut. Ett nytt test kräver att bara de vitlistade fälten hålls i minnet.
- **Minsta gruppstorlek (beslut 2026-10-16):** demografidelens trendlinje och lutning i Ålder & karriär,
  Löneöversyns tröskelmål, lönerevisionssimulatorn och robusthetspanelen följer tröskeln; riktade rader i
  konfigurationsfilen bär uppgiften om de föreslogs ur kandidatparen, så att förslag rensas när tröskeln höjs;
  Prioriteringens varning "underlaget är litet" och processöversiktens steg 4 följer tröskeln.
- **Organisationspaketet kan låsa tre skydd (ADR-47):** ett golv för minsta gruppstorlek, en låst tid för
  rensning vid inaktivitet och att små grupper aldrig tas med i Utforskas export.
- **Innehållspolicyn förbjuder stilattribut** (`style-src-attr 'none'`): sidan har inga `style="…"` kvar, så en
  injicerad stil blockeras på samma sätt som ett injicerat `<style>`.
- **Indata saneras i fler filer:** AID och BAS i jämförelsestatistiken och organisationspaketets textfält rensas
  från HTML-tecken vid inläsningen.
- **PII-kontrollen känner igen rubriken *Förnamn*** (och andra rubriker med å, ä och ö); tidigare bara *Fornamn*.
- **`autocomplete="off"` på alla fält,** också de som skapas medan du arbetar.
- **Diagram som inte lämnar verktyget** är märkta på ett ställe med ett uppräknat skäl, som syns i ett
  verktygstips.

### Exporter

- **Gruppdossiern och rapportunderlaget** har ett räkneexempel: vad skillnaden i medianlön motsvarar per år för
  gruppens kvinnor, med prioriteringens beräkningsperiod och PO-påslag — bara när båda könen når minsta
  gruppstorlek och kvinnornas median ligger minst 100 kr lägre.
- **Skillnaden i kronor per månad** står bredvid procenttalet i verktygstipsen för kvoten per BAS, trattdiagrammet,
  lönegapet per åldersgrupp och percentilerna, och som kolumnen *Skillnad (kr/mån)* i deras diagramdata; i
  yrkesgruppstabellen i kvotcellens verktygstips.
- **Excel (alla flikar):** nytt blad *Lönepolitik* när ett ställningstagande är inläst, med samma regler för
  minsta gruppstorlek som fliken.
- **Excel (alla flikar):** cellerna har den typ och det värde som vyn visar — procent som procent, antal
  "kvinnor/män" som text i stället för datum, kvoten där rubriken säger kvot.
- **EU-lönerapporten och rapportens avsnitt om lönetransparens** redovisar lönegapet med direktivets tecken
  (art. 9): (män − kvinnor) / män, positivt tal = kvinnor lägre.
- **Diagramdata från spridningsdiagrammen** säger på rad 2 att filen innehåller en rad per person och ska
  hanteras som personuppgifter.
- **Bilder med en punkt per person** följer med i ZIP-filen och i *Komplett rapport* (beslut 2026-10-16,
  ADR-48), som förut.

### Gränssnitt

- **Organisationsfil:** systemägaren kan baka in organisationspaketet i verktygsfilen och sprida en enda
  fil (knappen *Skapa organisationsfil* i panelen Organisationspaket; ADR-49). Handläggaren öppnar filen och
  paketet är på plats; filrutan visar *Inbakat i den här filen* med *Visa paketet* och *Ladda ner paketet*.
  Inget skript ändras och ingen lönedata ingår.

- **Organisationspaketet:** formuläret har fält för ställningstagandets namn och kortform (förifyllda med
  det som gäller), så att paketet inte bär den uppladdade filens namn vidare till rubriker som *Lönerna mot …*
  i Lönepolitik. Namnet går också att byta i fältet *Namn på referensen* på Översikt när referensen kommer
  ur ett paket.

- **Små multiplar:** Utforskas hanteldiagram och jämförelseflikens figurer delas i paneler om femton grupper när de
  har fler, med samma lönaxel i alla; i exporterade bilder står upp till tre paneler bredvid varandra.
- **Kvantilpunkter:** lönefördelningen i Ålder & karriär kan visas som tjugo prickar per grupp (reglaget *Form*, *Var
  tjugonde person*), och Utforska har diagramtypen *Kvantilpunkter*. Varje prick är en tjugondel av gruppen;
  täthetskurvan är kvar som standard.
- **Nya könsfärger:** plommon för kvinnor och olivgrönt för män i alla diagram, i stället för rosa och blått. Paret
  knyter inte an till stereotyper, har minst 4,5:1 mot vitt och skiljer sig mer än det tidigare vid nedsatt
  färgseende.
- **Utskriftsfönstret** för Bestämmelser & praxis och handlingsplanens mall var ostilat under innehållspolicyn;
  det får nu stilmallens regler.
- **Om verktyget och ordlistan** säger att direktivet skulle vara infört 7 juni 2026 och att svensk lag och
  ikraftträdande dateras när de är kända.

### Utveckling

- **Licens:** verktyget är nu licensierat under MIT-licensen i stället för EUPL 1.2 (beslut 2026-10-19).
  `LICENSE`, `NOTICE`, licenstexten i bygget och SPDX-raderna i varje källfil är bytta.

- **Release-grind och signerade releaser:** `npm run release:kontroll` stoppar en release när versionen inte står
  lika överallt eller riskanalysen inte är granskad mot koden; release-arbetsflödet signerar artefakten med
  Sigstore cosign och publicerar den som GitHub Release. Dependabot uppdaterar beroendena och arbetsflödenas steg.
- **Stilmallen** har ett namngivet hjälpklassbibliotek i stället för 428 genererade klasser; beräknade stilar är
  oförändrade.
- **Regressionsmodellerna, prioriteringsindexet och livscykelmodellen** ligger i `src/lib/`.
- **Röktestet** prövar utskriftsfönstret och har körts i Chromium, Firefox och WebKit.

## 2026.10.13

Första versionen.

- **Hela lagkedjan:** bestämmelser och praxis, lika arbete med regression och oförklarat gap,
  likvärdigt arbete, EU-direktivets rapportmått, prioritering med kostnadsberäkning och
  handlingsplan.
- **Fyra exporter ur en rapportmodell:** Word-utkast (.docx), PDF, Excel-underlag och ZIP,
  samt rapportunderlag via urklipp och protokoll för gemensam lönebedömning.
- **Organisationspaket:** benämningar, grundinställningar, ställningstagande och
  jämförelsestatistik i en fil som systemägaren tar fram i verktyget. Ingen organisation är
  inbyggd.
- **Dataskydd:** fem obligatoriska och två valfria fält läses in, filer med personnummer, namn
  eller e-post avvisas, grupper under minsta gruppstorlek utelämnas och namnges, inga
  nätverksanrop och ingen lagring (CSP med kontrollsummor).
- **Diagramkärna på D3** med eget figurformat, markering som följer med mellan vyer, och
  export till PNG och SVG.
- **Demoläge** med påhittad data (`?demo=1`) och demosida (`npm run site`).
