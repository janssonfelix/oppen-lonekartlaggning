# src/app/ — källmoduler för dist/app.js

`dist/app.js` är ett **genererat** hopslaget bygge av de numrerade
delarna i den här mappen. Syftet är navigerbarhet: i stället för en fil på drygt 27 000
rader är logiken uppdelad i hanterbara delar.

## Arbetsflöde

**Redigera ALDRIG `dist/app.js` direkt.** Ändra rätt `NN-*.js`-del här och regenerera:

```sh
npm run build:app        # eller: node tools/build-app.mjs
```

`tests/appsource.test.js` vaktar att `dist/app.js` och `src/app/` aldrig glider isär
(byte-identisk hopslagning). `npm run bundle` regenererar `dist/app.js` automatiskt före
varje bygge.

## Delarna

Delarna är namngivna efter den flik eller funktion de hör till, i samma ordning som
menyn där det går. Sifferprefixet styr i vilken ordning de slås ihop — hela bygget är
ett enda klassiskt skript, så funktionsdeklarationer syns överallt, men kod som körs
direkt vid laddning (händelsekopplingar, `const`) körs i den här ordningen.

| Del | Innehåll |
|---|---|
| `00-sakerhet-och-uppstart.js` | Storage-tripwire (reservspärr mot `setItem` och cookies; luckorna står i `docs/dataskydd/riskanalys.md` §6.2), boot-splash |
| `01-html-och-tillganglighet.js` | `esc`-hjälpare, fokusfällor, skärmläsarmeddelanden |
| `01-farger.js` | `FARG`: gränssnittets färger på ett ställe — statusarna (text, botten, yta, kant), neutrala och blå accent. Mallar, palett och stilmallens `--status-*` läser härifrån; `tests/farger.test.js` håller hexkoderna borta från resten |
| `02-verktygstips.js` | Diagrammens verktygstipsportal, gränsen för nedsampling av punktmoln, verktygstips |
| `03-hjalpfunktioner.js` | Diagrambeskrivning, http-varning, laddningsindikator, fält- och kolumnigenkänning, svenska talformat (`svTal`, `svPct`) |
| `03-ikoner.js` | Linjeikonerna (`ikon`): ett bildspråk i stället för bildtecken; statusmärken med egen form |
| `04-ordlista.js` | Ordlistan, symbolförklaringen och metodtexten om AID (`AID_METODTEXT`) |
| `05-tabeller-och-lankar.js` | Beräkningspaneler (audit), sorterbara (underrader följer sin rad) och hopfällbara tabeller, växeln *Fler kolumner* för breda tabeller (`flerKolumner`; grundvyn gömmer sekundära kolumner, exporterna tar alla), `navigateTo`, korslänkar, stapelceller |
| `06-k-anonymitet-och-dataminimering.js` | `K_STANDARD`, `kTroskel()`, `statGolv()`, `sattKTroskel()` (ADR-38), maskeringsnoter, SCB-klass, vitlistade fält, normalisering, PII-detektor |
| `07-standardinstallningar.js` | Standardvärden för prioritering och kostnad, BAS-gränsen (`BAS_MAX`, ADR-21), den neutrala standardprofilen (inga färdiga profiler, ADR-28), profiletiketter, namnen på organisationen och jämförelsestatistiken (`orgNamn`, `jmfNamn`, ADR-36) |
| `08-version.js` | **AUTO-GENERERAD** ur `VERSION`: `APP_VERSION`, `APP_BUILD_DATE` |
| `09-lib-speglar.js` | **AUTO-GENERERAD** spegel av `src/lib/` |
| `10-diagramlayout.js` | Diagramkärnan (ADR-39), del 1 av 3 — mått och layout: konstanter (`_RF`), texthjälpare (bredd ur teckenantal, aldrig DOM-mätning), skalor, märkenas marginaler och stapeletiketternas beslut, förklaringens poster och layoutstegen (lodrätt, y-axlar, vågrätt, x-markeringar) |
| `10-diagrammarken.js` | Diagramkärnan, del 2 av 3 — det som ritas i en panel: märkena stapel, punkt (med symbolerna cirkel, romb, kvadrat och streck, och osäkerhet som ett streck genom punkten), linje, band, intervall, låda och ruta (`_RF_MARKEN`), markeringen av små grupper, mönstren, färgskalan och färgstapeln, referenserna (zoner och linjer) |
| `10-diagramritare.js` | Diagramkärnan, del 3 av 3 — figur → SVG med D3: vad som ritas (`_rfSynligt`: små grupper, dolda serier, paneler, domäner), panelen med klippning, förklaringen och `_rfByggSvg`; sidans API `ritaFigur`/`rensaFigur` (verktygstips, klick, förklaring, storlek), registret och `_rfRensaAlla`, och exporten `figurTillSvg`/`figurTillBild`/`_rfExportFigur`. Formatets logik i `src/lib/figur.js`; referensen för hela kärnan (format, vyernas skyldigheter, kända luckor) är `docs/utveckling/diagramkarnan.md` |
| `10-diagramtema.js` | Diagrammens palett och typografi (`PALETTE`, `CHART_FONT`): färg efter uppgift — kön, serier i fast ordning, storlek i en nyans, avvikelse i två nyanser kring neutralt, status och prioriteringens statusar |
| `11-diagramexport.js` | Exportmeny på alla diagram (PNG, SVG, diagramdata), tillagd av `ritaFigur`; diagrammen exporteras ur sin figur (ADR-39). Regeln för när ett diagram inte får lämna verktyget (`exportTillaten`, `markeraUtanExport`, skälen i `EXPORT_SKAL`) |
| `11-markering.js` | Länkade vyer: en markerad grupp (BAS eller yrke inom BAS) framhävs i alla diagram; raden som säger vad som är markerat står överst i innehållet och följer med när sidan rullas |
| `12-tillstand.js` | `state`, dataåtkomst, referensens namn och källa (ingen inbyggd referens, ADR-28), `policyFor`, tal-tolkning, tabellverktyg (kopiera, exportera) |
| `13-oversikt.js` | Översikt: filraden, nyckeltalen, status mot lagkraven, bootstrap-KI, styrka, processkarta (stegens regler i `src/lib/attgora.js`); och Filer och kvalitet (`renderFilerDelar`): underlagets kvalitet (sammanfattad, med kontrollen av AID-kodningen i `src/lib/aidkontroll.js`), extremvärdena och inläsningsrapporten |
| `15-extremvarden-basrang.js` | Extremvärden (enskilda löner) i Underlagets kvalitet; BAS-ordningen är fast (se §5 i `teknisk-plan.md`) |
| `16-inlasningskontroll.js` | Rimlighetskontroll, inläsningsrapport, konsistens mellan filer |
| `17-forhandskontroll.js` | Förhandskontroll av lönefilen överst i Filer och kvalitet (`renderForhandskontroll`): tolkningen av de tio första raderna, sammandraget, värdefördelningen, varningarna (logiken i `src/lib/forhandskontroll.js`), punkterna i Att göra (`_fkAttGora`), raden i inläsningsrapporten, och det blockerande läget med *Läs in* och *Avbryt* (`_fkPausa`; inställningen `state.forhandskontrollStopp`) |
| `18-atgardslista.js` | Kortet Att göra på Översikt: åtgärdslistan, Börja här (ordningen i `src/lib/attgora.js`) och CSV-export |
| `19-konfiguration.js` | Spara/ladda konfiguration, jämförelse med ögonblicksbild (fliken Spara och jämför år) |
| `20-demodata-diagnostik.js` | Demodata (med riktiga AID-koder och ansvarskoder), testdata, självdiagnostik, demobanner; inläsningen som det lilla och det stora demot delar (`_lasInDemounderlag`) |
| `21-stort-demo.js` | Stort demo: `generateStortDemo` (7 000 påhittade personer i BAS A–K och 30 yrken, med inlagda gap, ett par för likvärdigt arbete och små grupper) och `loadStortDemo` (som det lilla demot, utan självdiagnostik); ingångarna i Kom igång, lönefilskortet och `?demo=stor` |
| `22-exporthjalpare.js` | Exportnavets knappar, metodbilagans data, Excel-/CSV-hjälpare, formelskydd |
| `23-exportgrind.js` | Exportgrinden: ingen export läser en tabell eller ett diagram ur en flik som inte är ritad med gällande tröskel |
| `24-excelexport.js` | Excel (alla flikar) och JPA-protokollet |
| `25-dataskyddsinfo.js` | Dataskyddsrutan och GDPR-bannern |
| `26-rensning.js` | "Rensa all data" (`_rensaAllData`) |
| `27-berakningsbevis.js` | Bevisrutan: uträkningen bakom ett fynd |
| `28-vad-lagras-inaktivitet.js` | "Vad lagras?" och automatisk rensning vid inaktivitet |
| `29-organisationspaket.js` | Organisationspaket: läs in och skapa (profil, grundinställningar, ställningstagande, jämförelsestatistik; logiken i `src/lib/organisationspaket.js`, ADR-28) |
| `30-statistikcacher.js` | Tömmer och räknar om statistiska cacher när datasetet ändras (`invalidateStatCaches`), bland dem Lika arbetes minne (`laMinneSlapp`) |
| `31-navigering.js` | Menyn: flikbyte, låsta flikar (`aria-disabled`; ett klick leder till lönefilskortet i Filer och kvalitet), flikgrupper och alias (`PANEL_GROUPS`, `TAB_ALIAS`), "Nästa steg" i menyns ordning (`FLOW_NEXT`; Löneläget och Ålder & karriär hoppas över när de är låsta), sidrubrik, länkar till flikar; `renderTabContent` ritar fliken och bygger dess sidindex |
| `32-filinlasning.js` | Filinläsning (CSV/XLSX), filrutorna (status, *Byt fil*, ADR-36), PII-spärr, kolumnmappning med importprofilerna (*Känd uppsättning*, *Spara som importprofil*, *Lägg till i organisationspaketet*; logiken i `src/lib/importprofiler.js`) |
| `33-sidans-innehall.js` | Hopplänkar inom sidan (`data-hoppa-till`), som rapportunderlagets förteckning använder |
| `34-likvardigt-arbete.js` | Likvärdigt arbete: kandidatpar, diagrammen *Krav mot lön* och *Kandidatparen i kronor* (parvis hantel), krav-proxy, export |
| `36-loneoversyn.js` | Löneöversyn: nyckeltalen, pott, riktade potter, scenarier (kärnan i `src/lib/loneoversyn.js`); `foreEfterFigur` — ett värde före och efter per grupp, som också ögonblicksbilden använder |
| `37-struktur.js` | Lönestruktur: representation, lön per percentil, kvartiler, trädkartan, sektorsöversikten per AID-huvudområde (logiken i `src/lib/sektor.js`); auto-rapportutkastet i Rapporttext (`renderStrukturUtkast`, med delen per BAS-intervall ur `basintervallUtkastText` i `81-basdossier.js`) |
| `38-referensfiler.js` | Referenskortet, uppladdning av eget ställningstagande och jämförelsestatistik |
| `39-loneoversikt.js` | Löneöversikten (i Tabeller och egna vyer): tabell, sök, fäll in/ut, Excel |
| `40-alder-karriar.js` | Ålder & karriär: lön mot ålder med trend, lönegap per åldersgrupp, percentilband över ålder, lönefördelning per kön, små multiplar, lönefördelningen per BAS som lådor (`_konTathetFigur`, ritad i Lönestruktur), åldersstruktur |
| `41-lika-arbete.js` | Lika arbete och BAS-avsnitten i Lönestruktur: översikten per BAS-intervall (`_laOversiktRader` — en beräkning för skärmens tabell, diagrammen och rapporten), tabellen med grafik i raden, lönespridning per BAS och kön och könsfördelning (`generateSkevhet`, avsnitten *Lönegap per BAS-intervall* och *Könsfördelning per BAS-intervall* i Lönestruktur), trattdiagrammet (`_laTrattUnderlag`: omkastning per yrkesgrupp), yrkesgruppstabellen med underrader per ansvarsgrupp, nyckeltalen i Lika arbete och Lönestruktur (`_laSlutsats`, `_laNyckel`, `renderLonestrukturNycklar`) |
| `42-jamforelse.js` | Löneläget, avsnittet mot statistiken: filter, tabellen i tre block och diagrammen för spannet och avvikelsen (beräkningen i `src/lib/jamforelse.js`) |
| `43-personer-att-granska.js` | Panelen "Personer att granska" i Lika arbete: personer minst X % under förväntad lön bland kollegor i samma AID och BAS (logiken i `src/lib/individflaggor.js`), med kolumnen Ansvar när ansvarskoden finns, och tabellen över avvikelsen per kön och BAS-intervall |
| `45-aid-bas-tabeller.js` | Tabellerna per AID-kod och BAS-intervall för rapporten (logiken i `src/lib/aidbas.js`): *Lika arbete AID x BAS* och *Analys på individnivå* i Lika arbete, *Likvärdigt arbete per BAS-intervall* och *Hierarkisk jämförelse* i Likvärdigt arbete, de fyra Excel-bladen med samma namn och raderna i Metodik; definitionen av kvinnodominerat (DO/SCB) och lönemånaden (ADR-57) |
| `44-referensoverblick.js` | Löneläget, avsnittet Överblick: löneläget och statistiken mot ställningstagandet per yrkesgrupp, med talen, listan, bilden och statistiken mot ställningstagandet (beräkningen i `src/lib/referenser.js`) |
| `50-regressionsmodeller.js` | Tunn adapter till `src/lib/regression.js` (via spegeln): kollinearitet, gap per BAS, sekventiell dekomponering (med yrkesgrupp- och ansvarssteget), kvantilregression, Blinder-Oaxaca. Läser `getData()` och `statGolv()` |
| `51-lika-arbete-regressionskort.js` | Regressionen (avsnittet *Vad blir kvar av lönegapet?* i Lönestruktur; huvudtalet står också i Lika arbetes nyckeltal): `runOLSRegression`, p-värden, kronor, panelen Förklaringsmodell, förklaringsbudget, ansvarsraden, regressions- och Oaxaca-korten, och diagrammen trappan, oförklarat gap per BAS och gapet längs lönefördelningen |
| `52-livscykel.js` | Ålder & karriär: adaptern till livscykelmodellen (`src/lib/livscykel.js`, speglad), tolkningstexten, analysen och dess diagram |
| `55-prioritering.js` | Prioriteringsanalys: adaptern till `src/lib/prioritering.js` (speglad), matrisen, kostnadsdiagrammet (sorterade staplar, högst 15 grupper), motiveringsmotor, trösklarna och viktningen (fälten står i Inställningar; fliken visar raden *Trösklar och viktning*) och export |
| `56-handlingsplan.js` | Handlingsplan: mall, förifyllning och export |
| `57-sakliga-skal.js` | Dialogen Sakliga skäl i Handlingsplan: kategori, belopp och kommentar per grupp |
| `58-rapportmodell.js` | Rapportmodellen: rapportens avsnitt som data (stycken, typade tabeller, diagram, fält att fylla i) som Word-utkastet och PDF-kopian ritas ur; vilka diagram som följer med (`RM_DIAGRAM`) och urvalen (`RM_URVAL`) |
| `59-exportbesked.js` | Förhandsbesked per export i Exportera, och urvalet av rapportens avsnitt (ordning och vilka som följer med) |
| `60-utskrift.js` | PDF-rapporten: en låst kopia av Word-utkastet, ritad ur rapportmodellen; utskrift av handlingsplanens mall och checklistan |
| `61-regler-och-praxis.js` | Regler & praxis: bedömning per område |
| `62-word-utkast.js` | Word-utkastet (dokumentationen) som `.docx`: HTML till block, Word-XML i `src/lib/docx.js`, packat med JSZip (ADR-37) |
| `63-tangentbordsnavigering.js` | Tangentbordsnavigering i menyn och i flikgrupper |
| `64-jamforelse-export.js` | Samlad Excel-export av jämförelsen (raderna ur `src/lib/jamforelse.js`) |
| `65-om-verktyget.js` | Fliken Om verktyget (`INFO_SECTIONS`) |
| `66-zip-export.js` | ZIP-exporten: Word-utkastet, Excel-filen med alla flikar och diagrammen från alla flikar som bilder |
| `67-rapportunderlag.js` | Rapportunderlag i Rapporttext: kopierbara avsnitt, yrkesgrupper, kandidatpar och diagram (logiken i `src/lib/rapportunderlag.js`) |
| `68-var-uppstar-gapet.js` | Avsnittet "Var uppstår löneskillnaden?" i Lönestruktur: gapet i medellön delat på BAS-fördelning, AID inom BAS och inom AID och BAS, med trappan som visar delarna (logiken i `src/lib/gapuppdelning.js`) |
| `70-utforska.js` | Tabeller och egna vyer (fliken `utforska`), Egna vyer: kontroller, tabell, små grupper, klick till gruppdossier |
| `71-utforska-figur.js` | Egna vyer: figur per diagramtyp ur pivotmodellen (`src/lib/utforska.js`) |
| `72-utforska-urval.js` | Egna vyer: villkorsbyggaren för urval och gruppvillkor (`src/lib/urval.js`) |
| `73-arsbokslut.js` | Årsbokslutet och panelen *Jämförelse med förra året* i Spara och jämför år (`src/lib/arsbokslut.js`, ADR-54) |
| `75-lonepolitik.js` | Löneläget, avsnittet mot ställningstagandet: analys mot referensen, bandkartan, könens läge i spannet (hantel) och fördelningen i spannets tredjedelar per kön, efterlevnaden |
| `80-gruppdossier.js` | Gruppdossier — en yrkesgrupp på en sida (modal), med antal per ansvarsgrupp |
| `81-basdossier.js` | BAS-dossier — ett BAS-intervall på en sida (modal) i rapportens ordning: nyckeltal och läget mot ställningstagandet, yrkesgrupperna med Lika arbetes status, likvärdigt arbete, ålder, förra året (årsbokslutet) och en textversion byggd i exportläget; textbyggaren (`basdossierStycken`) är gemensam för dossierns kopia, rapportutkastet, rapportens avsnitt Lönekartläggning per BAS-intervall och rapportunderlagets block per intervall; ingångar i Löneöversikten, Lönestrukturs tabell per BAS-intervall, gruppdossiern, markeringsraden och sökrutan |
| `85-robusthet-fardigcheck.js` | Robusthetspanel (kvinnotröskel, prioriteringsreferens) + färdigcheck, båda i Exportera |
| `86-installningar.js` | Panelen Inställningar: det som gäller alla flikar (minsta gruppstorlek, organisationstyp, lönemånad, PO-påslag och beräkningsperiod), Prioriteringens trösklar och viktning, läget, importprofilerna (lista, *Ta bort*, *Exportera JSON*), och en förteckning över flikarnas egna inställningar |
| `86-sok-register.js` | Sökregistret `SOK_FUNKTIONER`: varje avsnitt i flikarna, dialogerna och fälten i Inställningar, med synonymer, som sökfältet hittar |
| `87-sok.js` | Sök och hoppa: fältet i sidhuvudet som markerar en grupp i alla diagram och leder till funktioner och avsnitt (också utan lönefil); bara grupper som får visas går att söka fram |
| `88-lage.js` | Två lägen: vägledande (varje flik förklarar sig) och kompakt (förklaringarna undanfällda, tätare sidor); lagras inte. Flikarnas inledning på en rad med *Visa mer* (`introRader`) |
| `89-sidindex.js` | Sidindex (*På den här sidan*): flikens synliga avsnitt som en lista som följer med när sidan rullas, byggs när fliken ritas; ett klick fäller ut och ger fokus |
| `90-uppstart.js` | Uppstart: anrop som körs en gång sist vid laddning (processkartan, tangentbordsnavigering, profiletiketter, referenskortet) |

Delarna underhålls för hand: `tools/build-app.mjs` slår helt enkelt ihop alla
`NN-*.js` i namnordning, så en ny del skapas genom att lägga en fil med rätt
sifferprefix. Uppstartsanropen ligger i `90-uppstart.js`. Delas en fil måste bitarna
behålla sorteringsordningen — `tests/appsource.test.js` bevisar att hopslagningen
är byte-identisk med `dist/app.js`.

`09-lib-speglar.js` är ett undantag: den **genereras** ur `src/lib/*.js` av
`tools/gen-mirrors.mjs` (varje lib-modul inlinas verbatim i en IIFE, endast
`export` strippas, och namnen `app.js` anropar exponeras som `const`-alias).
`tools/build-app.mjs` regenererar den före varje hopslagning, så `src/lib/` är enda
källa för den statistiska kärnan (se ADR-8 i `teknisk-plan.md`). **Redigera aldrig `09`
för hand** — ändra `src/lib/`-modulen och kör `npm run build:app`. `tests/drift.test.js`
vaktar att den är i synk med `src/lib/`.
