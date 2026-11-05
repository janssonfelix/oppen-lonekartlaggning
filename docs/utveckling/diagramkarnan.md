# Diagramkärnan — referens

Diagramkärnan ritar diagram som SVG med D3 ur ett eget figurformat (ADR-39 i `teknisk-plan.md`). Det här
dokumentet beskriver kärnan **som den är byggd**: formatet, vad `ritaFigur` gör, exporten och rensningen — och
vad en vy måste göra själv för att skyddet av små grupper ska hålla. Koden är sanningen; där dokumentet och
koden skiljer sig är det dokumentet som ska rättas.

Alla diagram i verktyget ritas av kärnan. Den som lägger till ett diagram läser avsnitt 7 och 8 först.

| Del | Fil |
|---|---|
| Figurformatet: validering, små grupper, domäner, lådstatistik, talformat, diagramdata | `src/lib/figur.js` (speglad i `src/app/09-lib-speglar.js` med namn som börjar på `_fig`) |
| Mått och layout | `src/app/10-diagramlayout.js` |
| Märkena, färgskalan, referenserna | `src/app/10-diagrammarken.js` |
| `_rfByggSvg`, sidans API (`ritaFigur`, `rensaFigur`), registret, exporten (`figurTillSvg`, `figurTillBild`) | `src/app/10-diagramritare.js` |
| Exportmenyn | `src/app/11-diagramexport.js` |
| Rensningen av sidan | `src/app/26-rensning.js` (`_rensaAllData`) |
| Tester | `tests/figur.test.js`, `tests/diagramritare.test.js`, figurlistan `tests/helpers/ritfigurer.js`, webbläsarprovet `tools/browser-smoke.mjs` |

## 1. Regeln som bär allt

En datapunkt med `liten: true` ritas inte och lämnar inget spår — varken märket, värdet, kategorin, ett
serienamn som bara små punkter bär, en panel, ett antal, en axelände eller en lucka i ett index — om inte vyn
uttryckligen har begärt det. Det gäller skärmen (`val.visaSma`), verktygstips och klick, och allt som lämnar
verktyget (`val.exportMedSma`). Exporten faller åt det säkra hållet: kan frågan om små grupper inte besvaras
följer de inte med.

Kärnan känner inte tröskeln. Den litar på vyns `liten`-flaggor och på att vyn följer avsnitt 7.

Tre regler bär ritaren:

1. Den mäter aldrig text i DOM. Bredd räknas ur teckenantal, så samma figur ger samma SVG i webbläsaren, i
   jsdom och i ett element utanför sidan (exporten).
2. SVG:n bär bara presentationsattribut: inga `id`, `class`, `style`, `<style>`, `defs`, `clipPath`,
   `pattern`, `url(` eller `foreignObject`. Klippning och ränder görs med inre `<svg>`.
3. Ritaren får alltid **originalfiguren** och avgör själv vad som ritas. En förfiltrerad kopia ger andra
   index, andra palettfärger och en annan kategoriordning.

## 2. Figurformatet

Läge anges alltid i skärmens axlar: x är vågrät, y lodrät. En liggande stapel har kategorin i `y` och värdet i
`x`. Kategorier på en bandskala jämförs som strängar.

### Figuren

| Fält | Innebörd |
|---|---|
| `beskrivning` | Obligatorisk, icke-tom sträng. Blir bildens `aria-label` — också i exporten. |
| `x`, `y` | Axlar (nedan). Obligatoriska. |
| `y2` | Höger axel, bara `skala: 'linjar'`. Ett lager väljer den med `axel: 'y2'`. Ritas aldrig omvänd och har ingen nollinje. |
| `lager` | Minst ett lager (nedan). |
| `referens` | Lista med zoner och linjer (nedan). Prövas inte av `valideraFigur`. |
| `fargskala` | Krävs för `ruta` och för `punkt` med `fargvarde` (nedan). |
| `paneler` | `string[]`. Ett lager med `panel: 'namn'` ritas i den panelen; ett lager utan `panel` ritas i varje panel. Panelerna står sida vid sida med gemensam y-axel. Saknas listan (eller är tom) finns en namnlös panel. `'auto'`: en liggande figur med kategorier på y och fler än 15 kategorier ritas som delbilder om högst 15 i figurens ordning, under varandra med samma x-domän, samma vänstermarginal och rubrikerna "1–15", "16–30" …; förklaringen står under den sista. Punkterna utanför en del är `null` i delbilden, så `data-l`/`data-i` pekar på samma punkt som i hela figuren. I exporten (fast 16:9) står upp till tre delar bredvid varandra. Diagramdatan påverkas inte. Lagren får då ingen egen `panel`. |
| `legend` | `false` stänger av förklaringen. |
| `hojd` | Pixlar; annars 320. `val.hojd` går före. |
| `individer` | `true` när figuren har en punkt per person (spridningsdiagrammen lön mot ålder i Ålder & karriär). Diagramdatan (CSV, urklipp) får då raden om att filen innehåller en rad per person och ska hanteras som personuppgifter (`kIndividRad`, `11-diagramexport.js`). En `lada` behöver inte märket: den skrivs aldrig som individer. Prövas inte av `valideraFigur`. |

**Axel:** `{ skala: 'band' | 'linjar' | 'log', titel?, format?, doman?: [a, b], ordning?: string[],
omvand?: boolean, nollinje?: boolean, etikettMax?: number, dold?: boolean }`.
- `dold` tar bort axelns markeringar, stödlinjer och (för `x`) axellinjen. För figurer där lägena inte är värden (trädkarta).
- `doman` gäller talaxlar: två olika ändliga tal (större än noll på en log-axel). Med `doman` rundas axeln
  inte av till jämna tal. Utan `doman` räknas domänen ur de punkter som ritas; staplar tar med noll.
- `ordning` gäller bandaxlar. Domänen är `ordning` följd av övriga kategorier i den ordning de först
  förekommer, begränsad till kategorier som har en ritad punkt. En etikett utan datapunkt ritas aldrig.
- `format` är ett namn i `talformat`: `'kr'`, `'pct'`, `'pctAbs'` (procent utan tecken, för axeln i en divergerande stapel), `'antal'`, `'tal2'`, `'ar'`. Axelmarkeringar skrivs utan
  enhet.
- `nollinje` ritar en linje vid noll på en talaxel (`x` eller `y`). På en log-axel ritas ingen.
- Kategorinamn på en stående bandaxel (`x`) som inte ryms på en rad bryts på två, vid ordgräns; det som inte ryms på
  andra raden kortas. En rad extra reserveras under axeln när något namn behöver det.
- `etikettMax` (bara y-axel med bandskala): längsta kategorinamn i tecken innan det kortas; annars 30. Aldrig mer
  än 42 % av bildens bredd. Hela namnet står alltid i `<title>`.

### Lager

Gemensamt för alla lager: `marke`, `data`, `serie?` (namnet i förklaringen och i diagramdatan), `farg?`
(annars paletten efter lagrets index i figuren), `panel?`, `axel?: 'y2'`, `legend?: false` (ingen egen post i
förklaringen), `tips?` (funktion, avsnitt 3).

Gemensamt för alla datapunkter: `liten?` (boolean) och `nyckel?` (gruppens identitet). Övriga fält är fria
och finns till för `tips`.

| Märke | Datapunkt | Lagrets val |
|---|---|---|
| `stapel` | `{ x, y, etikett?, fel?: { lag, hog }, farg?, monster? }` (`monster` på en datapunkt ger just den stapeln mönstret, t.ex. en stapel med litet underlag) | `riktning?: 'liggande'`; `lage?: 'bredvid'` (standard) \| `'staplad'` \| `'overlagrad'`; `bredd?` (andel av bandet, bara `overlagrad`); `opacitet?`; `absolut?: true` (lagret ritas åt det negativa hållet i en divergerande stapel men bär en storlek: diagramdatan skriver värdet utan tecken); `etikettKant?: true` (vit kant kring stapeletiketterna, när andra märken kan ligga på dem); `monster?: 'linjer'` \| `'prickar'` (vitt mönster över fyllningen, också i förklaringens ruta — för status som inte får bäras av färgen ensam) |
| `punkt` | `{ x, y, storlek?, fargvarde?, farg?, forskjutning?, etikett?, fel?: { lag, hog } }` (`fel`: punktens osäkerhet, ritad som ett streck genom punkten längs värdeaxeln — y, eller x när lagret har `riktning: 'liggande'`; intervallets ändar räknas in i axelns omfång. `etikett`: text över punkten, högst 28 tecken, hela texten i `<title>`; etiketter som skulle skriva över varandra flyttas isär i höjdled) | `symbol?: 'cirkel'` (standard) \| `'romb'` \| `'kvadrat'` \| `'streck'` \| `'triangelVanster'` \| `'triangelHoger'` (cirkel, romb, kvadrat och streck ritas också som prov i förklaringen, så att formen och inte bara färgen skiljer serierna); `riktning?: 'liggande'` (bara för `fel`); `storlek?` (radie, standard 4); `opacitet?`; `kant?` (färg på en 1 px kant); `etikettLage?: 'vanster'` \| `'hoger'` (etiketten bredvid punkten i stället för över den); `utanData?: true` (lagret bär bara etiketter till värden som står i ett annat lager, och får inga rader i diagramdatan — gäller alla märken utom `ruta`) |
| `linje` | `{ x, y }`; `y: null` bryter linjen | `streck?: 'hel'` \| `'streckad'` \| `'prickad'`; `kurva?: 'monoton'`; `punkter?: boolean`; `tjocklek?` (standard 2) |
| `band` | `{ x, lag, hog }` | `kurva?: 'monoton'`; `opacitet?` (standard 0,18) |
| `intervall` | `{ x \| y, lag, hog, farg?, forskjutning? }` | `riktning?: 'liggande'`; `tjocklek?` (standard 6); `opacitet?` |
| `lada` | en per individ: `{ x, y, farg? }` | `avvikare?: false` (lådan ritas utan de enskilda lönerna utanför morrhåren — en avvikare är en person); `punkter?: 'avvikare'` (standard: låda med morrhår och avvikare) \| `'alla'` (varje individ som punkt, utspridda i sidled, ingen låda) \| `'svarm'` (varje individ som punkt, packade intill varandra utan att täcka varandra, så att fördelningens form syns); `form?: 'fiol'` (en täthetskurva speglad kring kategorins mitt i stället för lådan, med median och kvartiler som streck; kurvan går mellan morrhårens ändar och ritar varken morrhår eller avvikarpunkter. Den är lådan i allt annat: tips, klick, tangentbord, små individer och diagramdata) \| `form?: 'regnmoln'` (en halv täthetskurva till höger om kategorins mitt, median och kvartiler som streck, och varje individ som en punkt till vänster; kurvan är ett aggregat som lådan, punkterna är individer som i `punkter: 'alla'`) \| `form?: 'kvantiler'` med `antal?: 20 \| 50` (standard 20; kvantilpunktdiagram: gruppen som `antal` lika stora andelar, varje andel en prick vid sin kvantil, staplade i sidled där de annars skulle täcka varandra, med samma prickstorlek i hela lagret; antalet är högst halva gruppen, så att en prick aldrig står för färre än två personer — `kvantilpunkter` i `src/lib/figur.js`. Prickarna är ett aggregat: träffen ger lådans sammanfattning med `kvantil: { nr, antal, varde }`, och diagramdatan är en rad per prick med kvantilens värde, aldrig individer) |
| `ruta` | `{ x, y, varde, text? }` | `visaText?: boolean` |
| `yta` | `{ x0, x1, y0, y1, namn?, varde?, fargvarde?, farg?, etikett?, undertext? }` — en fri rektangel mellan två hörn på talaxlar (trädkarta: vyn räknar lägena). Färgen är punktens `farg`, annars färgskalan för `fargvarde`, annars lagrets. I diagramdatan: en rad per yta med `namn` (annars `etikett`) och `varde` | `opacitet?`; `etikettLage?: 'topp'` (bara etiketten, ingen undertext). Etiketten ritas uppe till vänster när ytan rymmer den |

- `forskjutning` flyttar en punkt eller ett intervall i sidled på en bandaxel, i andelar av bandets bredd.
- `stapel` och `lada` kräver bandskala på kategoriaxeln; `ruta` på både x och y. `lada` ritas bara stående
  (`riktning: 'liggande'` avvisas av `valideraFigur`).
- Staplade staplar summerar positiva värden uppåt och negativa nedåt, var för sig, per kategori och panel.
- En stapeletikett på en stående stapel med felstapel ställs bredvid strecket när den ryms på stapelns högra halva;
  annars får den vit kant, så att strecket inte stryker över siffrorna.
- Stapeletiketter (`etikett`) ritas för ett lager om alla ryms, annars inga; rum reserveras bara när de
  ritas. Etiketter i staplade staplar ligger i sitt segment och ritas bara där de ryms.
- En `linje` får träffytor för verktygstips bara när lagret har `tips`.
- `ruta`: `text` ritas bara med `visaText`, och bara om varje ritad cells text ryms — alla eller inga.
- `lada`: måtten räknas med `ladstatistik` (kvartiler med `quantile` ur `src/lib/stat.js`, morrhår till
  yttersta värdet inom 1,5 kvartilavstånd) ur de individer som ritas i kategorin. Flera lådlager i samma
  panel delar kategorins band sida vid sida. Har lådans alla ritade individer samma `farg` får lådan den färgen
  (ett lager med en färg per kategori); annars lagrets.
- Punktlager, och lådlager med `punkter: 'alla'` eller `'svarm'`, med fler än 8 000 ritbara punkter (`SCATTER_MAX_POINTS`)
  ritar var k:te. Små punkter tas bort före urvalet. Lådor räknas alltid ur alla.

### Färgskala

`{ typ: 'sekventiell' | 'divergerande' | 'tvafarg', doman: [a, b], mitt?, titel?, format?, farger? }`. En
skala per figur, gemensam för alla lager och paneler. `doman` är två ändliga tal; lika tal vidgas med ±1 och
omvänd ordning ger omvänd skala. `mitt` (strikt inom domänen) lägger skalans mittfärg där. `farger`
(`[[andel 0–1, färg], …]`, minst två) ersätter paletten. Skalan följer bara `fargskala` — aldrig lagrens
data — och ritas som en färgstapel i högermarginalen med ändvärdena och titeln.

### Referenser

- Zon: `{ typ: 'zon', x0?, x1? | y0?, y1?, axel?: 'y2', farg?, opacitet?, etikett?, textfarg? }`. Ritas under
  märkena. En gräns som saknas är panelens kant. Etiketten ritas överst i zonen, ovanpå märkena; ryms den
  inte kortas den (hela texten i `<title>`), och ryms inte tre tecken ritas den inte.
  På en bandaxel är gränserna kategorinamn och zonen täcker dem inklusive; saknas en gränskategori bland de
  ritade kategorierna ritas ingen zon.
- Linje: `{ typ?: 'linje', x | y, axel?: 'y2', streck?, farg?, tjocklek?, etikett?, textfarg? }`. `etikett` står vid linjens
  högra ände (överst för en lodrät linje), i linjens färg. Ritas över märkena, över hela
  panelen. På en bandaxel ligger den mitt i kategorins band.

Domänerna räknas aldrig ur referenserna.

### Funktionerna i `src/lib/figur.js`

| Funktion | Gör |
|---|---|
| `valideraFigur(figur, id)` | Kastar `Ogiltig figur (id): …` om figuren inte går att rita. |
| `utanSmaGrupper(figur)` | Figuren utan små punkter, utan tömda lager och utan namn på borttagna kategorier och paneler. Originalet rörs inte. Det här är det som får lämnas vidare som **data**. |
| `kronorSkillnad(medKv, medMa)`, `kronorTipsRad(belopp)` | Skillnaden mellan kvinnors och mäns median i kronor per månad, avrundad till hundratal och negativ när kvinnorna ligger lägre (`null` när en median saknas), och verktygstipsets rad `Skillnad: −3 200 kr/mån`. En vy som visar ett gap i procent och har båda medianerna lägger beloppet på datapunkten som `skillnadKr` (`_kronorFalt` i `03-hjalpfunktioner.js`), så att tipset och diagramdatan bär det. Vyn skickar bara medianer som får redovisas. |
| `figurTillTabell(figur)` | Diagramdata som rader. Filtrerar inte själv. `ruta` blir en korstabell per lager; övriga `Serie \| x \| y`, med `Undre \| Övre` när figuren har band, intervall, felstaplar eller lådor. En låda skrivs aldrig som individer: en rad per kategori med median, första och tredje kvartilen. Ett lager på höger axel får tillägget ` (höger axel: <titel>)` i serienamnet, ett lager i en panel ` · <panel>`. Bär någon datapunkt `skillnadKr` får tabellen kolumnen `Skillnad (kr/mån)`. |
| `skalDoman`, `axelVarden`, `panelerMedLager`, `antalPunkter`, `ladstatistik`, `talformat` | Hjälpare som ritaren och testerna delar. |

## 3. `ritaFigur(id, figur, val)`

Enda vägen att sätta ett diagram i sidan. `id` är ett element eller ett id. Returnerar behållaren, eller
`null` om den inte finns. Kastar aldrig.

`val` (allt valfritt):

| Alternativ | Innebörd |
|---|---|
| `visaSma` | Rita små punkter, markerade (streckad kant, ränder). Bara Utforska (ADR-14). |
| `hojd` | Höjd i pixlar; annars figurens `hojd`, annars 320. |
| `bredd` | Fast bredd. Diagrammet ritas då inte om när behållaren ändrar storlek. |
| `tomtext` | Texten i tomt läge; annars "Inget att visa". |
| `vidKlick` | `vidKlick(d, { serie, marke, panel, axel, index })` vid klick på ett märke. |
| `exportMedSma` | **Funktion** som svarar om små grupper ska följa med i exporten. Frågas en gång per export. Bara svaret exakt `true` räknas som ja; saknas den, kastar den eller svarar den något annat (också ett löfte), följer de inte med. |
| `exportBeskrivning` | Sträng som blir raden `Urval: …` i diagramdatan. |

Bredden är `val.bredd`, annars behållarens, annars 640 (en dold behållare har bredden 0); ritaren ritar aldrig
smalare än 320. En `ResizeObserver` ritar om efter 100 ms när bredden ändrats, och genast när behållaren går
från dold till synlig.

**Tomt läge.** Återstår ingen datapunkt när de små är borta innehåller behållaren bara
`<p data-rf="tom" role="note">` med `tomtext`: inga axlar, ingen förklaring. Behållaren behåller figuren och
får en exportmeny, som svarar att det inte finns något att exportera. En figur där alla serier dolts via
förklaringen är inte tom.

**Fel.** En ogiltig figur eller ett fel under ritningen rapporteras (`rapporteraFel('diagram <id>', …)`),
behållaren rensas och visar `<p data-rf="fel" role="note">Diagrammet kunde inte ritas.</p>`.

**Pekskärm.** Ett tryck på ett märke visar verktygstipset, och det står kvar när fingret lyfts; ett tryck utanför
märkena eller rullning döljer det.

**Små grupper med `visaSma`.** Staplar får streckad kant och glesa, tunna ränder; punkter streckad kant; en ruta i
en värmekarta streckad kant och ett hörnmärke (inga ränder över rutan — i en karta med många små celler skulle de
dölja färgerna). Markeringen är aldrig bara färg.

**Verktygstips: `tips(d, sammanfattning)`.** Lagrets `tips` ger rader: `[etikett]` (rubrikrad) eller
`[etikett, värde]`. Raderna sätts som escapad HTML (`_rfTipsHtml`): namn ur filen kan stå i ett tips utan
risk. `tips` anropas en gång per märke och ritning och utan `this`. Kastar den rapporteras felet och inget
tips visas. Portalen är gemensam för sidan; ett dolt tips töms alltid.

**Klick: `vidKlick(d, { serie, marke, panel, axel, index })`.** Andra argumentet är ett nytt, fryst objekt:
`panel` är lagrets plats i `figur.paneler` (inte panelen klicket skedde i), `axel` är `'y'` eller `'y2'`,
`index` lagrets plats i figuren. Hanteraren får aldrig lagret självt — dess data bär de små punkterna.

**Vad `d` är.** För en låda (allt i ett lådlager utom individpunkterna) är `d` ett nytt objekt `{ x }` och
`sammanfattning` är `{ q1, median, q3, lag, hog, n }`, räknad ur samma individer som den ritade lådan.
`nyckel` följer med bara när lådans alla individer har samma, definierade nyckel. För alla andra märken är
`d` datapunkten ur figuren och `sammanfattning` `undefined`. En liten punkt som inte ritas finns inte i DOM
och kan inte nå en hanterare.

**Förklaringen.** En post per serienamn som har minst en ritad punkt. Klick, Enter eller mellanslag döljer
eller visar serien; posten står kvar, nedtonad. Högst fyra rader, namn kortas till 36 tecken (hela namnet i
`<title>`), därefter "+ N till". Rader tas bort om ritytan annars blir lägre än 40 px.

**Notisen om urval.** Har ritaren nedsamplat står antalen i en rad under diagrammet
(`_setScatterSampleNote`). Antalen räknar inte dolda punkter.

**Rubrik och fotrad i exporten.** `figurTillSvg` och `figurTillBild` tar `rubrik` och `fot` (en rad var, avkortas).
Exportmenyn och den gemensamma bildvägen sätter dem: rubriken är kortets rubrik, foten "Lönekartläggning <datum>"
följt av urvalet om vyn har angett `exportBeskrivning`. Skärmens diagram har varken rubrik eller fot — kortet har
dem redan. Utskriften sätter egna rubriker och får därför bilderna utan.

**Länkade vyer: fältet `markering`.** En datapunkt som hör till ett BAS-intervall eller en yrkesgrupp bär
`markering: markeringFor(bas, aid?)` — `['bas:C']` eller `['bas:C', 'grupp:207011|C']`. Ett klick på märket markerar
gruppen (den mest specifika nyckeln) i hela verktyget, och varje ritat diagram framhäver sina märken för gruppen
och tonar ned de andra (`11-markering.js`). Kärnan gör det efter varje ritning och när markeringen ändras, utan
omritning; diagram utan märken för gruppen lämnas orörda, liksom märken utan `markering`. Vyns egen `vidKlick`
körs efter markeringen. Markeringen ändrar bara ritade märken, finns inte i exporten och sparas inte. Med Ctrl, Cmd
eller Skift läggs gruppen till de markerade. En tabellrad följer markeringen när vyn sätter `tr._markering =
markeringFor(…)` (eller raden har `data-rad="aid|bas"`).

**Pensling.** I ett diagram med punkter (`punkt`) på två talaxlar kan användaren dra en ruta över ytan. Kärnan
framhäver punkterna i rutan och skriver antal och median (y) per serie under diagrammet. Inget behövs av vyn.
Penslingen räknar bara på ritade punkter och finns inte i exporten.

**Zoom.** Ett penslat område med minst två punkter får knappen "Zooma hit". Kärnan ritar då om diagrammet med
områdets omfång (ur de ritade punkterna i området, med lite luft) som domän på båda axlar, och en rad under
diagrammet säger att det är ett utsnitt, med knappen "Visa hela diagrammet". Figuren ändras inte: utsnittet är en
kopia med andra domäner och samma lager (`_rfZoomad`), så tips, klick och markering fungerar som vanligt. Det som
hamnar utanför klipps av panelen. En ny figur från vyn (`ritaFigur`) och `rensaFigur` tar bort utsnittet; en
storleksändring behåller det. Bildexporten ritar utsnittet och fotraden slutar med "Utsnitt av diagrammet";
diagramdatan bär som alltid alla rader som får visas. Inget behövs av vyn.

**Närmaste punkt.** När pekaren är över ritytan men inte på ett märke får den närmaste ritade punkten (märkena
`punkt`, `individ` och linjernas träffpunkter) verktygstipset inom 24 bildpunkter och klicket inom 12, och en
ring (`data-nara`) visar vilken det är. Sökningen görs med `d3.Delaunay` över de ritade cirklarnas lägen, byggd
en gång per ritning och panel. Bara märken i DOM är med, så en dold liten punkt kan aldrig bli närmast. Inget
behövs av vyn.

**Pekarens läge i en panel** räknas med panelens skärmmatris (`_rfPanelLage`, `getScreenCTM`). Använd aldrig
`getBoundingClientRect` på panelens nästlade `<svg>` för det: den ger innehållets omskrivande ruta, inte ramen.

**Övergångar.** När ett diagram ritas om flyttar sig märkena från sina gamla lägen till de nya på 200 ms. Ritaren
bygger en ny SVG och byter ut den gamla; övergången läser av den gamla bildens lägen först och ställer
sedan de nya märkena där (`_rfOvergangStarta`). När den är klar eller avbryts bär varje märke exakt ritarens
attribut. Ett märke känns igen på lager och index när samma figur ritas igen (zoom, växlad serie); för en ny figur
på märkestyp, serie och punktens `nyckel`, eller kategorin på en bandaxel, och bara när nyckeln är ensam om sitt
märke. Punkter utan nyckel på talaxlar följs alltså inte mellan två figurer. Övergången är avslagen när
webbläsaren inte säger att rörelse går bra (`prefers-reduced-motion`), vid storleksändring och över 2 000 märken.
Bara cirklar, rektanglar och streck flyttas; linjer, band och text byts direkt. Inget behövs av vyn — men ge
datapunkter en `nyckel` om de ska följas mellan figurer och inte ligger på en bandaxel.

**Tangentbord.** Ritytan är ett fokuserbart område (`tabindex="0"`). Piltangenterna går mellan de ritade märkena
(höger/ned till nästa, vänster/upp till föregående; serie för serie), Home och End till första och sista, Enter eller mellanslag gör
det ett klick gör, Escape lämnar. Märket med fokus får `data-fokus` och en synlig ring, och dess tips visas och
läses upp. Märken som inte ritas — små grupper, dolda serier — finns inte i ordningen.

## 4. SVG:n

```
svg[role=group][aria-label=<beskrivning>][width][height][viewBox]   (+ data-nedsamplat="ritade/totalt")
  rect                                  bakgrund, bara i exporten
  g[data-del=rityta][role=img][aria-label=Diagramyta]
    g[transform]
      text[data-axel=y], text[data-axel=y2], axeltitlar
      per panel: g[transform]
        line                            stödlinjer
        svg[data-del=panel]             klipper till panelen
          zoner → märkena i lagerordning → referenslinjer → nollinjer
        g                               texter som inte klipps: stapeletiketter, zonetiketter
        line                            x-axelns linje
        text[data-axel=x], paneltitel
      text                              x-titel
      g                                 färgstapeln
  g[data-del=forklaring]
    g[data-serie][role=button][tabindex=0][aria-pressed][aria-label]
    text[data-legend=fler]              "+ N till"
  text                                  noten (bara i exporten)
```

- Roten har `role="group"` och ritytan `role="img"`: förklaringens knappar ligger utanför bilden så att
  hjälpmedel når dem.
- `data-marke` har värdena `stapel`, `punkt`, `linje`, `linjepunkt`, `litenpunkt`, `band`, `intervall`,
  `lada`, `median`, `morrhar`, `avvikare`, `individ`, `ruta`, `rutatext`, `etikett`, `fel`, `rander`,
  `fargstapel`, `zon`, `zonetikett`, `referenslinje`, `nollinje`.
- `data-l` är lagrets index i figuren som skickades in och `data-i` punktens index i lagrets data — alltid,
  med eller utan små grupper och dolda serier. De bärs av märken som går att träffa: `stapel`, `punkt`,
  `linjepunkt`, `litenpunkt`, `intervall`, `individ`, `ruta` och `lada` (lådans `data-i` är den första ritade
  individen i kategorin). Banorna `linje` och `band` har bara `data-l`.
- Ett `<text>` har ett `<title>` bara när den visade texten har kortats.
- Det finns två slags inre `<svg>`: panelen (`data-del="panel"`) och ränderna i en liten yta
  (`data-marke="rander"`). Diagrammets egen svg är `:scope > svg` i behållaren.
- Egenskaper på behållaren (inget skrivs som attribut): `_figur` (originalet, med små punkter),
  `_figurVal`, `_figurDolda`, `_figurBredd`, `_rfKoppling`, `_exportBeskrivning`.

## 5. Det som inte ritas, utan fel

`valideraFigur` stoppar det mesta. Följande ger ingen bild och inget fel:

- En kategori utan ritad punkt; en panel utan lager med ritade punkter; en serie där alla punkter är små.
- En punkt utan läge: värdet saknas eller är inte ett ändligt tal, eller kategorin finns inte på axeln.
- En stapel- eller rutetikett som inte ryms (hela lagrets etiketter faller då bort); en stapel som skärs av
  `doman` får ingen etikett.
- En talmarkering som överlappar en annan eller hamnar utanför; kategorietiketter tunnas ut.
- En referens med en gräns som inte är ett ändligt tal, helt utanför panelen eller på en kategori som inte
  finns på axeln; en zon på en bandaxel.
- En nollinje på en log-axel.
- Poster i förklaringen utöver fyra rader ("+ N till").
- Okända alternativ i `val`, okända fält i figuren.

## 6. Export och rensning

**`figurTillSvg(figur, bredd, hojd, val)`** ger figuren som fristående SVG-text. `val`: `visaSma`, `dolda`
(mängden serier som dolts via förklaringen). Bilden ritas på nytt utanför sidan i en logisk bredd på 800 och
skalas med `viewBox` till begärd storlek. Mått som inte är tal större än noll ger bredd 1600 respektive höjd
bredd × 9/16. Bakgrunden är vit. Under standardvärdet för minsta gruppstorlek bär bilden meningen om sänkt
tröskel (ADR-38); har ritaren nedsamplat står "Visar ett urval (a av b punkter)." före den. Kastar om figuren
är ogiltig.

Ur den fristående SVG:n tas bort: `data-nedsamplat`; `data-l` och `data-i` (en lucka i index skulle visa att
en punkt saknas); `pointer-events`, `cursor`, `tabindex`; `role`, `aria-pressed` och `aria-label` på
förklaringens poster; de osynliga träffytorna (`linjepunkt`, individpunkternas genomskinliga kant). Kvar är
`data-marke`, `data-del`, `data-axel`, `data-serie`, rotens `role` och `aria-label`, och `<title>` på kortade
texter.

**`figurTillBild(figur, format, bredd, hojd, val)`** ger en `data:`-adress. `'svg'`: SVG-texten. `'png'`:
SVG:n läses som bild från en `data:`-adress (inte en blob — WebKit har vägrat läsa ut en sådan canvas) och
ritas på en canvas med samma mått som SVG:n. Okänt format, ogiltig figur, en bild som inte går att läsa
eller en canvas som ger en tom bild avvisas.

**Exportmenyn** (`11-diagramexport.js`) läggs till av `ritaFigur`. `chartExportRun` bestämmer underlaget en
gång (`_rfExportFigur`: figuren, svaret från `exportMedSma`, de dolda serierna) och ger samma underlag till
bilden, diagramdatan och stämpeln.
- Bilden ritas ur originalfiguren med `visaSma` enligt svaret och utan de serier användaren dolt.
- Diagramdatan är `figurTillTabell(utanSmaGrupper(figur))` — eller hela figuren när små grupper följer
  med — med alla serier, också dolda, och utan påverkan av nedsampling. Rad 1 är spårbarhetsraden med
  stämpeln, rad 2 `Urval: <exportBeskrivning>` om den finns.
- Finns inget att exportera — behållaren saknar figur (felläge, rensad) eller alla punkter hör till små
  grupper som inte följer med — lämnar ingenting verktyget: menyn visar "Exporten misslyckades: Det finns
  inget att exportera i diagrammet."
- Rensas diagrammet eller ritas det med en annan figur medan bilden görs laddas ingenting ner:
  "Diagrammet rensades innan exporten blev klar."

**Stämpeln** (`_kUndantagFor`). Allt i fliken Likvärdigt arbete (`#view-likvardighet`) får tillägget
"(undantag: Likvärdigt arbete)", vad exporten än bär: fliken redovisar
grupper under tröskeln, och en stämpel som varnar i onödan är ofarlig. Ett diagram från kärnan utanför den
fliken får "(undantag: valt i Utforska)" bara när exporten faktiskt bär små grupper.

**Rensning.**
- `rensaFigur(id)` kopplar loss lyssnare och storleksbevakning, döljer behållarens tips, tar bort figuren och
  de andra egenskaperna, tar bort notisen om urval och tömmer behållaren. Exportmenyn står kvar. Idempotent.
- `ritaFigur` för ett register över sina behållare. `_rfRensaAlla()` rensar dem alla — oavsett id, också i
  tomt läge och sedan de lämnat dokumentet — och nollställer verktygstipset. `_rensaAllData` anropar den
  ("Rensa all data" och inaktivitetsrensningen).
- `_rfNollstallTips()` döljer och tömmer portalen och glömmer vem som ägde tipset. Sitter ägaren inte
  kvar i dokumentet rensas den.
- Vid varje `ritaFigur` rensas registrerade behållare som har suttit i dokumentet men inte gör det längre.

## 7. Vyns skyldigheter

Kärnan kan inte kontrollera något av följande. Varje punkt är ett sätt att läcka en liten grupp eller lämna
ett trasigt diagram.

1. **`liten` sätts per cell.** En låda över mycket få individer är de individernas löner: en individ ger
   lönen själv, två eller tre går att räkna fram ur median och kvartiler. Sätt `liten` på varje individ vars
   cell — lager × kategori × panel — har färre individer än tröskeln, inte bara vars kategori har det. Ingen
   låda och inget annat aggregat får sammanfatta färre än tröskeln. Det gäller den ritade lådan, tipsets
   sammanfattning och raden i diagramdatan.
2. **`nyckel` är en gruppnyckel**, aldrig något som pekar ut en person. Den lämnas till `vidKlick`.
3. **Rita efter att fliken visats.** Ett diagram som ritas i en dold flik ritas i reservbredden 640 och ritas
   om först när behållaren ändrar storlek.
4. **Axelns `doman`, `fargskala.doman`, `referens` och `ordning` räknas bara ur punkter som får visas.**
   Kärnan använder dem som de står: en domän som sträckts ut av en liten grupps värde, en referenslinje vid
   det eller en ordning som bygger på det syns i bilden och i exporten.
5. **Sätt alltid `farg` på lagren.** Utan `farg` tas färgen ur paletten efter lagrets index i figuren; ett
   lager där alla punkter är små och som därför inte ritas lämnar då en lucka i färgföljden.
6. **Stämpeln.** I Likvärdigt arbete bär varje export undantaget. Annars bär den "valt i Utforska" bara när
   `exportMedSma` svarar ja. En vy som redovisar små grupper utan att märka dem `liten` får alltså ingen
   varning utanför Likvärdigt arbete — märk dem.
7. **`beskrivning`, axel- och paneltitlar, serienamn, `tomtext` och `exportBeskrivning` exporteras som de är
   skrivna.** De får inte namnge en liten grupp eller bära ett värde ur den.
8. **Rita om efter att en behållare satts in igen.** En behållare som tas ur dokumentet rensas vid nästa
   `ritaFigur` (vilket diagram som helst). Sätts den in igen är den tom.
9. **`rensaFigur` innan en behållare byts ut.** Annars lever figuren, med lönevärden, kvar till nästa
   `ritaFigur` eller till sidan rensas.
10. **En behållare som ritas utanför dokumentet och aldrig sätts in står kvar i registret** tills
    `rensaFigur` anropas på den eller sidan rensas.
11. **Ett nytt `ritaFigur`-anrop visar alla serier igen.** Det användaren dolt via förklaringen nollställs av
    en ny figur (omritning vid ändrad storlek behåller det).

## 8. Krav på varje vy

- **Ett vakttest per vy:** ingen cell under tröskeln når SVG:n, verktygstipset eller tabellen
  (diagramdatan). Testet bygger vyns figur ur data med en cell under tröskeln och prövar alla tre.
  Kärnans differentialtester (`S1: …` för skärmen och `export: det som lämnar verktyget …` i
  `tests/diagramritare.test.js`) vaktar att kärnan respekterar `liten`; de vaktar inte att vyn sätter den.
- **Inget ritas förbi kärnan:** ett test håller andra ritande och exporterande anrop borta från källan.
- **En gemensam väg från diagram till bild.** ZIP-exporten (`66`), "Kopiera diagram" i
  rapportunderlaget (`67`), utskriften (`60`) och prioriteringsmatrisens bild (`55`) hämtar bilden genom
  `diagramTillBild(el, { bredd, hojd })` och frågar `diagramRitat(el)`. En ny plats som behöver en diagrambild ska
  använda samma väg; `utanRubrik: true` ger bilden utan rubrik och fotrad.

## 9. Kända luckor

- `fargvarde`, `storlek` och rutans `text` står inte i diagramdatan.
- Ett lager utan `serie` heter "Serie N" i diagramdatan, där N är lagrets plats i den figur tabellen görs av —
  efter att små grupper tagits bort kan numret alltså vara ett annat än på skärmen. Ge lagren namn.
- Zoom finns bara i diagram med punkter på två talaxlar (det som går att pensla); lådagram och staplar har ingen.
- Ritaren ritar aldrig smalare än 320 px; en smalare behållare får en bild som är bredare än den.
- Pekaren byter inte utseende över klickbara märken.
- Lådor ritas bara stående.
- Staplar kräver en bandaxel för kategorin (inga staplar på en talaxel, t.ex. histogram med tal på x).
- Det finns inga fria anteckningar i bilden (text på punkter och etiketter på referenslinjer och zoner finns).
- Punktsymbolerna är cirkel, romb, kvadrat, streck och två trianglar; trianglarna har inget prov i förklaringen.
- Punkter som ligger på varandra flyttas inte isär (bara deras etiketter): många grupper med nästan samma värde
  i samma kategori täcker varandra (sett i bandkartan och i *Krav mot lön* med ett fyrtiotal yrkesgrupper).
- WebKit körs inte direkt på utvecklingsdatorn (systembibliotek saknas) utan i en behållare: `npm run test:browser:webkit:behallare` (Podman och Playwrights avbild, utan nätverk, projektet monterat skrivskyddat). Avbildens version ska följa Playwrights version i `package.json`.

## 10. Form och färg efter uppgift

Varje diagram prövas mot frågan: vilken uppgift har bilden, och vilken form löser den? Reglerna gäller varje
nytt diagram.

**Form.**

| Uppgift | Form | Inte |
|---|---|---|
| Ett värde jämfört med en referens (kvot mot 100 %, gap mot noll), med osäkerhet | Punkt med intervall mot en referenslinje (`punkt` med `fel`) | Stapel från en avkortad axel — längden säger ingenting |
| Två gruppers nivå i samma enhet (kvinnor och män i kronor, rå och justerad kvot, före och efter) | Hantel: två punkter och ett streck emellan (`intervall` + `punkt`) | Parvisa staplar; lutande linjer på en avkortad axel |
| Storlek per kategori, rangordnad | Liggande sorterade staplar, högst ett femtontal | Staplar med en linje mot en andra axel (två skalor i en bild) |
| Delar av en helhet | Staplat till 100 %, liggande när namnen är långa | — |
| Uppdelning av en skillnad i delar | Trappa: delarna läggs på varandra och landar i helheten | — |
| Fördelning, två grupper | Kvantilpunkter (`form: 'kvantiler'`) för lekmän — läsaren kan räkna andelen under en lön; annars halvgenomskinliga lager på samma plats, eller lådor sida vid sida | Parvisa staplar per klass, täthetskurvor för den som inte vant sig vid dem |
| Spridning över en ordnad variabel | Median med band (P25–P75, P10–P90) | Flera hackiga linjer |
| Enheter av olika storlek mot slumpen | Trattdiagram: värdet mot storleken, med gränser som smalnar | Rangordning utan hänsyn till storlek |
| Få kategorier, flera mått, blandade enheter | **Tabell med grafik i raden** — inte ett diagram | Ett diagram som visar ett av måtten |

Tabellernas radgrafik (`_laOversiktGrafik`, `_pagAvvikelseGrafik`) ritas med vanlig SVG utanför kärnan. Den är en
utsmyckning av talet i cellen bredvid (`aria-hidden`), har ingen export och bär inga värden som inte står i raden.
ADR-39 gäller för allt som är ett diagram.

**Färg** (`PALETTE` i `10-diagramtema.js`). Färgen väljs efter vad den ska säga:

- **Kön:** två färger, plommon för kvinnor och olivgrönt för män — inte rosa och blått, som knyter färgen till en stereotyp. Båda har minst 4,5:1 mot vitt, skiljer sig vid simulerad protanopi och deuteranopi och ligger ifrån status- och seriefärgerna (`tests/farger.test.js`). Används bara för kön, och kön står alltid också med ord i legenden.
- **Serier:** en fast ordning av tydligt olika färger; en serie behåller sin färg när andra döljs.
- **Storlek:** en nyans, ljus till mörk. **Avvikelse:** två nyanser kring neutralt grått.
- **Status:** bara för status, och alltid tillsammans med form eller ord. En skillnad som bedöms mot 3- och
  5-procentsgränserna har ett ordförråd i hela verktyget, `GAP_STATUS` i `10-diagramtema.js`: *Balanserat* (grönt,
  cirkel), *Följ upp* (bärnsten, kvadrat) och *Värt att granska* (lila, romb) i diagrammen; samma ord, färg och
  linjeikon i tabellerna. Sådant som inte är en bedömning (att ett gap *förklaras* av ålder, att en lön ligger
  *under* ett spann) får inte statusfärg.
- **Prioriteringens statusar:** «Börja här» (rangordningens översta nivå) och «Värt att granska» är lila, samma lila
  som i Lika arbete (användarens beslut) — «titta här först» utan att påstå att något är fel. «Över referens» är
  blått: ett läge, ingen allvarlighetsgrad.

**Märken.** Staplar har ett tak för tjockleken och rundade hörn; staplade delar och punkter har en tunn kant i
ytans färg; axelsiffror är dämpade. Mönster (tunna sneda streck, små prickar) används bara för litet underlag.
Etiketter sätts på det som behöver namnges, inte på allt: trattdiagrammet namnger högst sex grupper.

**Förbehåll under diagrammet.** Ett metodförbehåll står i en egen not under diagrammet (`_setDiagramMetodNot` i
`06-k-anonymitet-och-dataminimering.js`), efter k-noten och utan att skriva över den, och samma mening står under
diagrammet i Word och PDF (`metodNot` i `RM_DIAGRAM`). Trattdiagrammet med färre än tio grupper har ett
(`LA_TRATT_GLEST`). Under ett diagram där två punkter med var sitt konfidensintervall jämförs ska det stå att
intervall som överlappar inte visar att skillnaden saknas och inte kan läggas ihop till ett intervall för skillnaden;
i dag har inget diagram den formen — där verktyget visar intervall jämförs punkten mot en referenslinje, och
intervallet är skillnadens eget.

**Många kategorier.** Liggande staplar, hantlar och punkter per kategori ritas med `paneler: 'auto'`, så att mer än femton kategorier blir små multiplar (Utforskas hantel, jämförelseflikens två figurer). Kandidatparens figur visar högst 14 par och behöver det inte.

**Pröva med många grupper.** Demodatan har åtta yrkesgrupper. Tre fel syntes först med ett fyrtiotal: en tabell
som inte rymdes, namn som låg på varandra och ett diagram som blev över tusen punkter högt. Ett nytt diagram ska
ses med ett stort underlag innan det är klart.
