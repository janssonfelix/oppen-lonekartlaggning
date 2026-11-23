# src/app/ — källmoduler för dist/app.js

`dist/app.js` är **genererad** ur de numrerade delarna i den här mappen, som är ES-moduler:
varje del importerar det den använder ur andra delar och ur `src/lib/` under lib-namnet, och
exporterar det andra delar, sidan och testerna använder. Syftet är navigerbarhet och granskning:
beroendena står i källan (ADR-98).

## Arbetsflöde

**Redigera ALDRIG `dist/app.js` direkt.** Ändra rätt `NN-*.js`-del här och regenerera:

```sh
npm run build:app        # eller: node tools/build-app.mjs
```

`tools/build-app.mjs` bygger med esbuild från `index.js` till en platt fil utan `import` och
`export`, som körs som ett klassiskt skript: appens toppnivånamn är globala, som sidan, testerna
och röktestet läser dem. Bygget fäller om ett av appens namn skulle döpas om (två moduler med samma
toppnivånamn), om ett toppnivånamn heter som en egenskap på `window` eller om utfilen inte är ett
klassiskt skript. Artefaktgrinden (`tools/kontroll.mjs`
och `.github/workflows/ci.yml`) bygger om och kräver samma fil. `npm run bundle` bygger
`dist/app.js` före varje bygge.

## Delarna

Delarna är namngivna efter den flik eller funktion de hör till, i samma ordning som
menyn där det går. ES-moduler körs i importgrafens ordning, inte i sifferordning, så en del
**deklarerar bara**: funktioner, konstanter och tillstånd. Det som ska köras vid laddning
(händelsekopplingar, anrop) står i delens uppstartsfunktion (`uppstartFilinlasning` och så vidare),
och `index.js` anropar dem i sifferordning när alla delar är lästa; bygget fäller en del med kod
utanför en deklaration. `00-sakerhet-och-uppstart.js` är undantaget: den importerar inget, körs
först i utfilen och sätter lagringsspärren innan något annat körs.

| Del | Innehåll |
|---|---|
| `00-sakerhet-och-uppstart.js` | Storage-tripwire (reservspärr mot `setItem` och cookies; luckorna står i `docs/dataskydd/riskanalys.md` §6.2), boot-splash |
| `01-html-och-tillganglighet.js` | `esc`-hjälpare, fokusfällor, skärmläsarmeddelanden |
| `01-farger.js` | `FARG`: gränssnittets färger på ett ställe — statusarna (text, botten, yta, kant), neutrala och blå accent. Mallar, palett och stilmallens `--status-*` läser härifrån; `tests/farger.test.js` håller hexkoderna borta från resten |
| `02-verktygstips.js` | Diagrammens verktygstipsportal, gränsen för nedsampling av punktmoln, verktygstips |
| `03-hjalpfunktioner.js` | Diagrambeskrivning, http-varning, laddningsindikator och adaptern `getField`, som skickar kolumnmappningen och importprofilen ur tillståndet till kolumnvalet i `src/lib/inlasning.js` (där också `gissaKolumnmappning` bor) |
| `03-ikoner.js` | Linjeikonerna (`ikon`): ett bildspråk i stället för bildtecken; statusmärken med egen form |
| `04-ordlista.js` | Ordlistan, symbolförklaringen och metodtexten om AID (`AID_METODTEXT`); texterna är mallar med termerna (`{enhet.en}`), fyllda med `termText` |
| `05-tabeller-och-lankar.js` | Beräkningspaneler (audit), sorterbara (underrader följer sin rad) och hopfällbara tabeller, växeln *Fler kolumner* för breda tabeller (`flerKolumner`; grundvyn gömmer sekundära kolumner, exporterna tar alla), `navigateTo`, korslänkar, stapelceller |
| `06-k-troskel.js` | Tröskeln för minsta gruppstorlek: `kTroskel()`, `statGolv()`, `sattKTroskel()` (ADR-38), könsuppdelade mått och par för redovisning, stämplarna, diagramnoterna och omritningen (se `docs/utveckling/k-troskeln.md`) |
| `06-kvinnoandel-referens.js` | Den nationella kvinnoandelen per AID ur SKR:s personalstatistik (`nationellAidKlass`, `skrForklaring`), reserv i likvärdighetsanalysen |
| `06-maskeringsnoter.js` | Maskeringsnoterna: `kMaskNote`, `kSamladNote` |
| `06-uppgiftsminimering.js` | Uppgiftsminimeringens adaptrar: `_hittaAnsvarKolumn`, `_lonefilensRubriker` och `extractMinimalRecord` skickar kolumnmappningen, importprofilen, den godkända ansvarskolumnen och innevarande år till `src/lib/inlasning.js`. Där bor vitlistan (`TILLATNA_FALT`), kolumnvalet, `_bedomAnsvarKolumn` och själva tolkningen (talen, kön, BAS, `_stadaYrkesfalt` utan namnmaskering, ADR-85, `hittaKansligaKolumner` och upptäckten av personnamn i fältet för AID-etikett); funktionerna utan adapter importeras ur lib |
| `07-standardinstallningar.js` | Standardvärden för prioritering och kostnad, den neutrala standardprofilen (inga färdiga profiler, ADR-28), profiletiketter och termerna i `index.html` (`applyProfileLabels` fyller `data-profile-template` och `data-term-template`), namnen på organisationen och jämförelsestatistiken (`orgNamn`, `jmfNamn`, ADR-36) |
| `08-version.js` | **AUTO-GENERERAD** ur `VERSION`: `APP_VERSION`, `APP_BUILD_DATE` |
| `09-termer.js` | Termerna (ADR-74): `T`, den gällande uppsättningen ur `src/lib/termer.js`, och `termText`, som fyller en mall (`{Enhet.bfl} i samma {niva.en}`); hjälparna (`termFras`, `artikel`, `adjektiv`, `genitiv`, `stor`, `ordForAntal`) importeras ur `src/lib/termer.js`. Vakten `tests/termer.test.js` håller orden borta från resten av appen |
| `10-diagramlayout.js` | Diagramkärnan (ADR-39), del 1 av 3 — mått och layout: konstanter (`_RF`), texthjälpare (bredd ur teckenantal, aldrig DOM-mätning), skalor, märkenas marginaler och stapeletiketternas beslut, förklaringens poster och layoutstegen (lodrätt, y-axlar, vågrätt, x-markeringar) |
| `10-diagrammarken.js` | Diagramkärnan, del 2 av 3 — det som ritas i en panel: märkena stapel, punkt (med symbolerna cirkel, romb, kvadrat och streck, och osäkerhet som ett streck genom punkten), linje, band, intervall, låda och ruta (`_RF_MARKEN`), markeringen av små grupper, mönstren, färgskalan och färgstapeln, referenserna (zoner och linjer) |
| `10-diagramritare.js` | Diagramkärnan, del 3 av 3 — figur → SVG med D3: vad som ritas (`_rfSynligt`: små grupper, dolda serier, paneler, domäner), panelen med klippning, förklaringen och `_rfByggSvg`; sidans API `ritaFigur`/`rensaFigur` (verktygstips, klick, förklaring, storlek), registret och `_rfRensaAlla`, och exporten `figurTillSvg`/`figurTillBild`/`_rfExportFigur`. Formatets logik i `src/lib/figur.js`; referensen för hela kärnan (format, vyernas skyldigheter, kända luckor) är `docs/utveckling/diagramkarnan.md` |
| `10-diagramtema.js` | Diagrammens palett och typografi (`PALETTE`, `CHART_FONT`): färg efter uppgift — kön, serier i fast ordning, storlek i en nyans, avvikelse i två nyanser kring neutralt, status och prioriteringens statusar |
| `11-diagramexport.js` | Exportmeny på alla diagram (PNG, SVG, diagramdata), tillagd av `ritaFigur`; diagrammen exporteras ur sin figur (ADR-39). Regeln för när ett diagram inte får lämna verktyget (`exportTillaten`, `markeraUtanExport`, skälen i `EXPORT_SKAL`) |
| `11-markering.js` | Länkade vyer: en markerad grupp (BAS-intervall eller AID-etikett inom BAS) framhävs i alla diagram; raden som säger vad som är markerat står överst i innehållet och följer med när sidan rullas |
| `12-tillstand.js` | `state`, dataåtkomst, referensens namn och källa (ingen inbyggd referens, ADR-28), `policyFor`, tabellverktyg (kopiera, exportera); talen i indata (`tolkaTal`, `tolkaTalStrikt`) tolkas i `src/lib/inlasning.js`; `linearRegressionCI` är en tunn adapter till konfidensbandet i `src/lib/osakerhet.js` |
| `13-oversikt.js` | Översikt: filraden, nyckeltalen och status mot lagkraven (`ritaNyckeltal`, `ritaKravstatus`, ur vymodellen i `src/lib/vymodell-oversikt.js`, ADR-99), bootstrap-KI och styrka (`computeBootstrapCI`, `computePowerAnalysis`, `computeGroupMDE`: tunna adaptrar till `src/lib/osakerhet.js` som läser `getData()` och `statGolv()`), processkarta (stegens regler i `src/lib/attgora.js`); och Filer och kvalitet (`renderFilerDelar`): underlagets kvalitet (sammanfattad, med kontrollen av AID-kodningen i `src/lib/aidkontroll.js`), extremvärdena och inläsningsrapporten |
| `15-extremvarden-basrang.js` | Extremvärden (enskilda löner) i Underlagets kvalitet (`detectOutliers`, en tunn adapter till `extremvarden` i `src/lib/osakerhet.js`); BAS-ordningen är fast (se §6 i `docs/utveckling/likvardighetsmodellen.md`) |
| `16-inlasningskontroll.js` | Inläsningsrapport (med raden om personnamn i fältet för AID-etikett, radnumren ur `namnIYrkesfaltetRadnr` i `src/lib/forhandskontroll.js`), konsistens mellan filer |
| `17-forhandskontroll.js` | Förhandskontroll av lönefilen överst i Filer och kvalitet (`renderForhandskontroll`): tolkningen av de tio första raderna, sammandraget, värdefördelningen, varningarna (logiken i `src/lib/forhandskontroll.js`), punkterna i Att göra (`_fkAttGora`), raden i inläsningsrapporten, och det blockerande läget med *Läs in* och *Avbryt* (`_fkPausa`; inställningen `state.forhandskontrollStopp`) |
| `18-atgardslista.js` | Kortet Att göra på Översikt: åtgärdslistan, Börja här (ordningen i `src/lib/attgora.js`) och CSV-export |
| `19-konfiguration.js` | Spara/ladda konfiguration, jämförelse med ögonblicksbild (fliken Spara och jämför år) |
| `20-demodata-diagnostik.js` | Inläsningen av det lilla demot (`loadDemoData`), självdiagnostik, demobanner, demoreferensen; inläsningen som det lilla och det stora demot delar (`_lasInDemounderlag`). Generatorerna (demodata och testdata) står i `src/lib/demodata.js` |
| `21-stort-demo.js` | Stort demo: `loadStortDemo` (som det lilla demot, utan självdiagnostik) och ingångarna i Kom igång, lönefilskortet och `?demo=stor`. Generatorn står i `src/lib/demodata.js`: `genereraStortDemo` (5 000 påhittade personer med 100 AID-etiketter i BAS A–K, med inlagda gap, ett par för likvärdigt arbete och små grupper), påhittad jämförelsestatistik och ett ställningstagande ur demots löner |
| `22-exporthjalpare.js` | Exportnavets knappar, metodbilagans data, Excel-/CSV-hjälpare, formelskydd |
| `23-exportgrind.js` | Exportgrinden: ingen export läser en tabell eller ett diagram ur en flik som inte är ritad med gällande tröskel |
| `24-excelexport.js` | Excel (alla flikar) och JPA-protokollet |
| `25-dataskyddsinfo.js` | Dataskyddsrutan och GDPR-bannern |
| `26-rensning.js` | "Rensa all data" (`_rensaAllData`) |
| `27-berakningsbevis.js` | Bevisrutan: uträkningen bakom ett fynd. Prioriteringens delpoäng läses ur posten och taken ur `prioKonstanter()` i `src/lib/prioritering.js`, så beviset och rangordningen visar samma tal |
| `28-vad-lagras-inaktivitet.js` | "Vad lagras?" och automatisk rensning vid inaktivitet |
| `29-organisationspaket.js` | Organisationspaket: läs in och skapa (profil, grundinställningar, ställningstagande, jämförelsestatistik; logiken i `src/lib/organisationspaket.js`, ADR-28) |
| `30-statistikcacher.js` | Tömmer och räknar om statistiska cacher när datasetet ändras (`invalidateStatCaches`), bland dem Lika arbetes minne (`laMinneSlapp`) |
| `31-navigering.js` | Menyn: flikbyte, låsta flikar (`aria-disabled`; ett klick leder till lönefilskortet i Filer och kvalitet), flikgrupper och alias (`PANEL_GROUPS`, `TAB_ALIAS`), "Nästa steg" i menyns ordning (`FLOW_NEXT`; Löneläget och Ålder & karriär hoppas över när de är låsta), sidrubrik, länkar till flikar; `renderTabContent` ritar fliken och bygger dess sidindex |
| `32-filinlasning.js` | Filinläsning (CSV/XLSX), filrutorna (status, *Byt fil*, ADR-36), PII-spärr, räkningen av personnamn i fältet för AID-etikett (en tillfällig räknare per text som töms när filen är läst; i `parseStats` bara antal och radnummer, ADR-85), kolumnmappning med importprofilerna (*Känd uppsättning*, *Spara som importprofil*, *Lägg till i organisationspaketet*; logiken i `src/lib/importprofiler.js`) |
| `33-sidans-innehall.js` | Hopplänkar inom sidan (`data-hoppa-till`), som rapportunderlagets förteckning använder |
| `34-likvardigt-arbete.js` | Likvärdigt arbete: kandidatpar, diagrammen *Krav mot lön* och *Kandidatparen i kronor* (parvis hantel), krav-proxy, export |
| `36-loneoversyn.js` | Löneöversyn: nyckeltalen, pott, riktade potter, scenarier (kärnan i `src/lib/loneoversyn.js`); tröskelmålet är en adapter: fälten och k-spärren här, sökningen i `likalonslyftForMal` med huvudregressionen som skattning; `foreEfterFigur` — ett värde före och efter per grupp, som också ögonblicksbilden använder |
| `37-struktur.js` | Lönestruktur: representation, lön per percentil, kvartiler, trädkartan, översikten per huvudområde i AID (logiken i `src/lib/sektor.js`); auto-rapportutkastet i Rapporttext (`renderStrukturUtkast`, med delen per BAS-intervall ur `basintervallUtkastText` i `81-basdossier.js`) |
| `38-referensfiler.js` | Referenskortet, uppladdning av eget ställningstagande och jämförelsestatistik |
| `39-loneoversikt.js` | Löneöversikten (i Tabeller och egna vyer): tabell (`ritaLoneoversikt`, ur vymodellen i `src/lib/vymodell-loneoversikt.js`, ADR-99), sök, fäll in/ut, Excel |
| `40-alder-karriar.js` | Ålder & karriär: lön mot ålder med trend, lönegap per åldersgrupp, percentilband över ålder, lönefördelning per kön, små multiplar, lönefördelningen per BAS som lådor (`_konTathetFigur`, ritad i Lönestruktur), åldersstruktur; `ritaAlderOchLon` och `ritaAldersstruktur` ritar ur vymodellen i `src/lib/vymodell-alder-karriar.js` (ADR-99) |
| `41-lika-arbete.js` | Lika arbete och BAS-avsnitten i Lönestruktur: översikten per BAS-intervall (`_laOversiktRader` — en beräkning för skärmens tabell, diagrammen och rapporten), tabellen med grafik i raden, lönespridning per BAS och kön och könsfördelning (`ritaLoneskillnadPerBas`, avsnitten *Löneskillnad per BAS-intervall* och *Könsfördelning per BAS-intervall* i Lönestruktur, ur vymodellen i `src/lib/vymodell-lonestruktur.js`), trattdiagrammet (`_laTrattUnderlag`: omkastning per AID-etikett; räkningen i `src/lib/osakerhet.js`), bootstrap-KI:t per BAS-intervall (`_laBootstrapGapCI`, adapter till `src/lib/osakerhet.js`), tabellen per AID-etikett och BAS-intervall med underrader per ansvarsgrupp (`ritaLikaArbete`, ur vymodellen i `src/lib/vymodell-lika-arbete.js`, ADR-99; en rad per AID-kod i varje BAS-intervall, intill varandra, ADR-89), nyckeltalen i Lika arbete och Lönestruktur (`_laSlutsats`, `_laNyckel`, `renderLonestrukturNycklar`) |
| `42-jamforelse.js` | Löneläget, avsnittet mot statistiken: filter, tabellen i tre block och diagrammen för spannet och avvikelsen (beräkningen i `src/lib/jamforelse.js`) |
| `43-personer-att-granska.js` | Panelen "Personer att granska" i Lika arbete: personer minst X % under förväntad lön bland kollegor i samma AID och BAS (logiken i `src/lib/individflaggor.js`), med kolumnen Ansvar när ansvarskoden finns, och tabellen över avvikelsen per kön och BAS-intervall |
| `45-aid-bas-tabeller.js` | Tabellerna per AID-kod och BAS-intervall för rapporten (logiken i `src/lib/aidbas.js`): *Lika arbete AID x BAS* och *Analys på individnivå* i Lika arbete, *Likvärdigt arbete per BAS-intervall* och *Hierarkisk jämförelse* i Likvärdigt arbete, de fyra Excel-bladen med samma namn och raderna i Metodik; definitionen av kvinnodominerat (DO/SCB) och lönemånaden (ADR-57) |
| `44-referensoverblick.js` | Löneläget, avsnittet Överblick: löneläget och statistiken mot ställningstagandet per AID-etikett, med talen, listan, bilden och statistiken mot ställningstagandet (beräkningen i `src/lib/referenser.js`) |
| `50-regressionsmodeller.js` | Tunn adapter till `src/lib/regression.js`: kollinearitet, gap per BAS, sekventiell dekomponering (med stegen för AID-etikett inom BAS och ansvar), kvantilregression, Blinder-Oaxaca. Läser `getData()` och `statGolv()` |
| `51-lika-arbete-regressionskort.js` | Regressionen (avsnittet *Vad blir kvar av lönegapet?* i Lönestruktur; huvudtalet står också i Lika arbetes nyckeltal): `runOLSRegression`, den tunna adaptern som läser tillståndet och anropar `huvudregression` i `src/lib/regression.js`, p-värden, kronor, panelen Förklaringsmodell, förklaringsbudget, ansvarsraden, regressions- och Oaxaca-korten, och diagrammen trappan, oförklarat gap per BAS och gapet längs lönefördelningen (kvantilregressionens intervall: `_regKvantilBootstrap`, adapter till `kvantilBootstrap` i `src/lib/osakerhet.js`) |
| `52-livscykel.js` | Ålder & karriär: adaptern till livscykelmodellen (`src/lib/livscykel.js`), tolkningstexten, analysen och dess diagram |
| `55-prioritering.js` | Prioriteringsanalys: adaptern till `src/lib/prioritering.js`, matrisen, kostnadsdiagrammet (sorterade staplar, högst 15 grupper), texterna till motiveringsförslagen (reglerna är `motiveringsgrunder` i lib), trösklarna och viktningen (fälten står i Inställningar; fliken visar raden *Trösklar och viktning*) och export |
| `56-handlingsplan.js` | Handlingsplan: mall, förifyllning och export |
| `57-sakliga-skal.js` | Dialogen Sakliga skäl i Handlingsplan: kategori, belopp och kommentar per grupp |
| `58-rapportmodell.js` | Rapportmodellen: rapportens avsnitt som data (stycken, typade tabeller, diagram, fält att fylla i) som Word-utkastet och PDF-kopian ritas ur, med orden ur vymodellen i `src/lib/vymodell-rapport.js` (det som räknas och maskeras, och urvalen `RM_URVAL`, ADR-99); vilka diagram som följer med (`RM_DIAGRAM`) |
| `59-exportbesked.js` | Förhandsbesked per export i Exportera, och urvalet av rapportens avsnitt (ordning och vilka som följer med) |
| `60-utskrift.js` | PDF-rapporten: en låst kopia av Word-utkastet, ritad ur rapportmodellen; utskrift av handlingsplanens mall och checklistan |
| `61-regler-och-praxis.js` | Regler & praxis: bedömning per område |
| `62-word-utkast.js` | Word-utkastet (dokumentationen) som `.docx`: HTML till block, Word-XML i `src/lib/docx.js`, packat med JSZip (ADR-37) |
| `63-tangentbordsnavigering.js` | Tangentbordsnavigering i menyn och i flikgrupper |
| `64-jamforelse-export.js` | Samlad Excel-export av jämförelsen (raderna ur `src/lib/jamforelse.js`) |
| `65-om-verktyget.js` | Fliken Om verktyget (`INFO_SECTIONS`) |
| `66-zip-export.js` | ZIP-exporten: Word-utkastet, Excel-filen med alla flikar och diagrammen från alla flikar som bilder |
| `67-rapportunderlag.js` | Rapportunderlag i Rapporttext: kopierbara avsnitt, AID-etiketter, kandidatpar och diagram (blocken ur vymodellen i `src/lib/vymodell-rapportunderlag.js`, ADR-99, och `src/lib/rapportunderlag.js`) |
| `68-var-uppstar-gapet.js` | Avsnittet "Var uppstår löneskillnaden?" i Lönestruktur: gapet i medellön delat efter de valda förklaringsvariablerna (standard BAS-fördelning, AID inom BAS och inom AID och BAS), valet *Förklara med:* (`gapVariabler`, `sattGapVariabler`, ADR-65) och trappan som visar delarna (`ritaGapUppdelning`, ur vymodellen i `src/lib/vymodell-var-uppstar-gapet.js`, ADR-99; logiken i `src/lib/gapuppdelning.js`) |
| `70-utforska.js` | Tabeller och egna vyer (fliken `utforska`), Egna vyer: kontroller, tabell, små grupper, klick till gruppdossier; AID-etiketten grupperas på koden (`_utNycklar`, `gruppnycklar` i `src/lib/falt.js`, ADR-89) |
| `71-utforska-figur.js` | Egna vyer: figur per diagramtyp ur pivotmodellen (`src/lib/utforska.js`) |
| `72-utforska-urval.js` | Egna vyer: villkorsbyggaren för urval och gruppvillkor (`src/lib/urval.js`) |
| `73-arsbokslut.js` | Årsbokslutet och panelen *Jämförelse med förra året* i Spara och jämför år (`src/lib/arsbokslut.js`, ADR-54) |
| `74-alla-diagram.js` | Tabeller och egna vyer: underflikarna Egna vyer och Alla diagram. Alla diagram har en grupp per flik med kopior av flikens diagram (`ritaFigur` ur källans figur, behållaren `ut-diagram-<källans id>`, egna filter och egen meny); `diagramUrval` är urvalet som ZIP-filen delar, och exportgrinden går till källan för en kopia (`_exportSakraKopia`) |
| `75-lonepolitik.js` | Löneläget, avsnittet mot ställningstagandet: analys mot referensen, bandkartan, könens läge i spannet (hantel) och fördelningen i spannets tredjedelar per kön, efterlevnaden |
| `80-gruppdossier.js` | Gruppdossier — en AID-etikett i ett BAS-intervall på en sida (modal), med antal per ansvarsgrupp; `buildGruppdossier` hämtar tillståndet och vymodellen i `src/lib/vymodell-gruppdossier.js` räknar (ADR-99); bootstrap-KI:t (`_gdBootstrapGapCI`, adapter till `src/lib/osakerhet.js`) |
| `81-basdossier.js` | BAS-dossier — ett BAS-intervall på en sida (modal) i rapportens ordning: nyckeltal och läget mot ställningstagandet, AID-etiketterna med Lika arbetes status, likvärdigt arbete, ålder, förra året (årsbokslutet) och en textversion byggd i exportläget; `buildBasdossier` hämtar tillståndet och vymodellen i `src/lib/vymodell-basdossier.js` räknar (ADR-99); textbyggaren (`basdossierStycken`) är gemensam för dossierns kopia, rapportutkastet, rapportens avsnitt Lönekartläggning per BAS-intervall och rapportunderlagets block per intervall; ingångar i Löneöversikten, Lönestrukturs tabell per BAS-intervall, gruppdossiern, markeringsraden och sökrutan |
| `85-robusthet-fardigcheck.js` | Robusthetspanel (kvinnotröskel, prioriteringsreferens) + färdigcheck, båda i Exportera |
| `86-installningar.js` | Panelen Inställningar: det som gäller alla flikar (minsta gruppstorlek, organisationstyp, lönemånad, PO-påslag och beräkningsperiod), Prioriteringens trösklar och viktning, läget, importprofilerna (lista, *Ta bort*, *Exportera JSON*), och en förteckning över flikarnas egna inställningar |
| `86-sok-register.js` | Sökregistret `SOK_FUNKTIONER`: varje avsnitt i flikarna, dialogerna och fälten i Inställningar, med synonymer, som sökfältet hittar |
| `87-sok.js` | Sök och hoppa: fältet i sidhuvudet som markerar en grupp i alla diagram och leder till funktioner och avsnitt (också utan lönefil); bara grupper som får visas går att söka fram |
| `88-lage.js` | Två lägen: vägledande (varje flik förklarar sig) och kompakt (förklaringarna undanfällda, tätare sidor); lagras inte. Flikarnas inledning på en rad med *Visa mer* (`introRader`) |
| `89-sidindex.js` | Sidindex (*På den här sidan*): flikens synliga avsnitt som en lista som följer med när sidan rullas, byggs när fliken ritas; ett klick fäller ut och ger fokus |
| `90-uppstart.js` | Uppstart: anrop som körs en gång sist vid laddning (processkartan, tangentbordsnavigering, profiletiketter, referenskortet) |

Delarna underhålls för hand. En ny del är en fil med rätt sifferprefix och en rad i `index.js`
(med uppstartsfunktionen om den har en). Den sista uppstarten är `90-uppstart.js`.
