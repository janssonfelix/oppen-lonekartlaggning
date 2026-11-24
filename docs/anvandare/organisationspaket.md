# Organisationspaket — guide för systemförvaltaren

Ett **organisationspaket** är en fil som samlar det som är gemensamt för hela organisationen.
Varje HR-handläggare läser då in det i ett steg, i stället för att hämta och ladda upp
flera filer var för sig. Verktyget har ingen inbyggd organisation: utan paket (eller egna
filer) finns ingen referens att jämföra mot.

> Den här guiden är för den som förvaltar lönekartläggningen i organisationen — till exempel
> en lönespecialist eller HR-controller. Handläggarens arbetsflöde står i `korguide.md`.

---

## 1. Vad paketet innehåller

| Del | Innehåll | Används till |
|---|---|---|
| Organisation | Organisationens namn, utgivare (t.ex. "Lönefunktionen, HR-avdelningen"), datum, vilket år paketet avser och organisationstypen (kommun, region eller båda) | Visas i verktyget och i exporter, så att det framgår vilket underlag som använts |
| Benämningar | Vad jämförelsestatistiken heter (t.ex. "Kommunens lönestatistik") | Rubriker och texter i Löneläget, Prioritering och exporter |
| Grundinställningar | PO-påslag och beräkningsperiod, och *Minsta gruppstorlek för redovisning* (valfritt; utan värde gäller 10 eller det handläggaren har satt) | Kostnadsberäkningarna i Prioritering och Löneöversyn, och vilka grupper som redovisas. Ett värde under 10 ger handläggaren en fråga om bekräftelse när paketet läses in |
| Jämförelseetiketter i likvärdigt arbete (valfritt) | `jamforelse`: `alla` (alla AID-etiketter som inte är kvinnodominerade, standard) eller `mansdominerade` (bara mansdominerade). Formuläret tar med valet i fliken Likvärdigt arbete när paketet skapas | Sätter rutan *Jämför bara med mansdominerade AID-etiketter* när paketet läses in; handläggaren kan ändra den efteråt (ingen låsning). Ett annat värde ger en varning och används inte |
| Låsningar (valfritt) | *Lägsta tillåtna minsta gruppstorlek*, en låst tid för *rensning vid inaktivitet*, och om *små grupper får tas med i exporten från Tabeller och egna vyer* | Det handläggaren inte får ändra, se avsnitt 5 |
| Rapportens recept (valfritt) | Egna tabeller byggda i Tabeller och egna vyer och ett eget recept för avsnittet per BAS-intervall — bara recepten (rader, kolumner, mått, urval), inga tal | Samma tabeller i Word, PDF, Excel och rapportunderlaget hos alla handläggare; ersätter de egna tabeller som finns när paketet läses in |
| Importprofiler (valfritt) | Sparade kolumnmappningar för lönesystemets uttag: vilken rubrik som är BAS-intervall, AID-etikett, lön, ålder och kön (och poäng och ansvarskod). Dessutom vilka rubriker som måste finnas. Bara rubrikernas namn, inga värden | Uttaget känns igen utan kolumnmappning hos alla handläggare; paketets profiler prövas före handläggarens egna och verktygets inbyggda |
| Lönepolitiskt ställningstagande | P10, median och P90 per BAS-intervall (och/eller per AID-etikett) | Prioritering, Löneläget och statusrutan i Att göra |
| Jämförelsestatistik | Median (och gärna P10, P90 och könsfördelning) per AID-etikett och BAS-intervall | Fliken Löneläget, prioritering mot statistiken och reserven i Likvärdigt arbete (med BAS-intervall) |

Ställningstagandet och jämförelsestatistiken är var för sig valfria, men paketet måste
innehålla minst det ena. Analysens trösklar (t.ex. 60 % för kvinnodominans och minsta skillnad för
kandidatparen, standard 0 %) ingår inte — de är verktygets standard och kan ändras av handläggaren. Valet av
jämförelseetiketter i likvärdigt arbete (`jamforelse`) är det enda analysvalet paketet kan bära.

**Paketet innehåller inga personuppgifter** — bara organisationens ställningstagande och
aggregerad statistik. Verktyget avvisar ett paket som innehåller något som liknar
personnummer eller e-postadresser.

## 2. Skapa paketet

1. Öppna verktyget och gå till **För systemförvaltaren**, sist i menyn. Fliken nås också från *Om verktyget* och
   från en rad i steg 1 i Filer och kvalitet.
2. I **Steg 1, Paketet**: läs in ställningstagandet och jämförelsestatistiken med knapparna **Läs in
   ställningstagande** och **Läs in jämförelsestatistik**, eller ett befintligt paket med **Läs in
   organisationspaket**. Är filen du har öppen redan en organisationsfil, är dess paket förvalt.
3. Fyll i organisationens namn, utgivare och år, vad jämförelsestatistiken ska heta och vad
   ställningstagandet ska heta. Fyll också i PO-påslag och beräkningsperiod (utan paket gäller 40 %, ett
   standardantagande). Fältet för ställningstagandets namn är förifyllt med filens namn. Byt till ett namn som passar i rapporten,
   t.ex. *Lönepolitiskt ställningstagande 2026*, och en kort form som *ställningstagandet*. Fältet
   *Minsta gruppstorlek för redovisning* är ifyllt med det värde som gäller just nu. Lämna det tomt
   om paketet inte ska ange något. Ett ogiltigt
   värde (inte ett heltal mellan 3 och 1000) stoppar sparandet.
4. Fyll i låsningarna om organisationen vill ha dem (avsnitt 5): *Lägsta tillåtna minsta
   gruppstorlek*, *Rensning vid inaktivitet* med rutan *Lås rensningstiden*, och rutan *Små
   grupper får tas med i exporten från Tabeller och egna vyer*. Tomma fält betyder att paketet inte anger något.
5. Kontrollera sammanfattningen ("Paketet får med: …" — den anger också vilken minsta
   gruppstorlek paketet får och vad det låser). Ska paketet spridas som en egen fil (avsnitt 3) eller arkiveras,
   välj **Spara som organisationspaket**. Filen heter `<organisation>.lonepaket.json`. Sprids i stället en
   organisationsfil (avsnitt 3b), behövs ingen paketfil.

Ingen lönefil behövs för att skapa paketet.

## 3. Sprida paketet

- Lägg filen på den plats där handläggarna hämtar verktyget, till exempel samma interna
  filyta. Den kan skickas som vanlig bilaga — den innehåller inga personuppgifter.
- Tala om för handläggarna vilket paket som gäller (år och datum). Verktyget visar
  organisation, utgivare, datum och innehåll när paketet läses in.
- En handläggare läser in paketet med **Läs in organisationspaket** i fliken Filer och kvalitet. Det sparas
  inte i verktyget och läses in varje gång, precis som lönefilen. En sparad
  konfigurationsfil påminner om vilket paket som användes.

## 3b. Organisationsfil — en enda fil att sprida

Handläggarna behöver inte få paketet som en egen fil. Systemförvaltaren kan i stället baka in paketet
i själva verktyget och sprida **en organisationsfil**. Handläggaren öppnar den, och benämningar,
ställningstagande, jämförelsestatistik och låsningar är på plats utan att något läses in.

Stegen står i fliken **För systemförvaltaren**:

1. **Steg 1, Paketet:** läs in eller bygg paketet (avsnitt 2).
2. **Steg 2, Verktygsfilen:** välj den HTML-fil du har öppen nu (`oppen-lonekartlaggning.html`), eller en nyare
   version. Webbläsaren låter inte en sida läsa sig själv, och verktyget hämtar aldrig något, så filen måste väljas.
3. **Steg 3, Ladda ner:** välj **filnamn** (förslaget är `oppen-lonekartlaggning-<organisation>.html`; ändelsen
   `.html` läggs på om den saknas) och klicka **Ladda ner organisationsfilen**. Beskedet anger organisation,
   paketets datum och vilken version av verktyget filen bygger på, och att ingen lönedata ingår. Är den valda filen
   en annan version än den som körs, säger beskedet det.

Organisationsfilen innehåller verktyget oförändrat plus paketet som en inaktiv datablock sist i
filen. Inget skript ändras, så skyddet mot nätverk och lagring och kontrollsummorna i
innehållssäkerhetspolicyn gäller som förut. **Ingen lönedata ingår** — bara det paketet bär.
Filen visar i *Om verktyget* vilken version av verktyget den bygger på.

För handläggaren: filrutan *Organisationspaket* visar *Inbakat i den här filen* med två knappar.
**Visa paketet** visar innehållet som tabeller och råtext. **Ladda ner paketet** sparar det som
`.lonepaket.json`, så att det kan granskas, ändras och bakas in på nytt. Den som läser in en annan
paketfil ersätter det inbakade för sessionen. *Rensa all data* går tillbaka till det inbakade.
Demoläget (`?demo=1`) går före och använder inte det inbakade paketet.

När paketet avser ett tidigare år visar filrutan en rad, till exempel *Paketet avser 2025. Kontrollera med
systemförvaltaren att det är det som gäller.* För förra årets paket visas raden från och med 1 mars, så att förra
årets kartläggning kan göras i början av året. Raden är en upplysning och stoppar ingenting. Ett paket utan år får
ingen rad.

**Ändrat paket:** gör om steg 1–3 och sprid den nya organisationsfilen. **Ny version av verktyget:** se avsnitt 4.

### IT:s kontroll av organisationsfilen

Organisationsfilen är releasefilen oförändrad plus ett block sist i filen,
`<template id="inbakat-organisationspaket" …>…</template>`. Den har därför en annan kontrollsumma än releasen.
IT kan kontrollera den genom att ta bort blocket och jämföra kontrollsumman för resten med `RELEASE.txt` för den
version filen bygger på (versionen står i *Om verktyget*). Kommandona skriver resten till en ny fil och räknar dess
kontrollsumma; organisationsfilen ändras inte.

Linux och macOS (byt `organisationsfil.html` mot filens namn; på en Mac utan `sha256sum`: `shasum -a 256`):

```bash
perl -0pe 's/<template id="inbakat-organisationspaket"[^>]*>[\s\S]*?<\/template>//' organisationsfil.html > utan-paket.html
sha256sum utan-paket.html
```

Windows (PowerShell, i mappen där filen ligger):

```powershell
$text = [IO.File]::ReadAllText("$PWD\organisationsfil.html")
$rest = $text -creplace '<template id="inbakat-organisationspaket"[^>]*>[\s\S]*?</template>', ''
[IO.File]::WriteAllText("$PWD\utan-paket.html", $rest)
Get-FileHash .\utan-paket.html -Algorithm SHA256
```

Kontrollsumman ska vara densamma som i `RELEASE.txt`, vars signatur IT verifierar enligt `SECURITY.md`. Det
styrker att allt utom paketet är den publicerade filen.
Paketet självt granskas med **Visa paketet**. Ett annat sätt är att jämföra organisationsfilen med releasefilen i
ett jämförelseverktyg och se att bara blocket skiljer sig.

## 4. Uppdatera paketet

Gör ett nytt paket när ställningstagandet eller jämförelsestatistiken ändras — i regel en
gång om året, eller när lönesystemets uttag fått nya kolumnnamn (en ny importprofil). Öppna organisationsfilen (dess
paket är förvalt i steg 1) eller läs in det gamla paketet, byt ut det som ändrats med knapparna, ändra år i
formuläret och gör steg 2 och 3 (eller spara paketet). Datumet i paketet visar vilken version som använts.

**Ny version av verktyget.** Rutan **Flytta till en ny version** i fliken För systemförvaltaren flyttar paketet
oförändrat, utan någon separat paketfil:

1. Välj **den gamla organisationsfilen**, den som handläggarna använder.
2. Välj **den nya verktygsfilen**, releasefilen för den nya versionen.
3. Välj filnamn och klicka **Ladda ner den nya organisationsfilen**.

Paketet i den gamla filen prövas som vid inläsning. Beskedet anger organisation, paketets datum, den gamla och den
nya versionen, och att ingen lönedata ingår. Är den nya filen en äldre version än den gamla, säger beskedet det,
men filen laddas ändå ner. Har den gamla filen inget inbakat paket, laddas inget ner. Ska paketet också ändras, gör
det i steg 1–3.

## 5. Låsningar — det handläggaren inte får ändra

Verktygets skydd för små grupper och den automatiska rensningen kan handläggaren annars ställa
in själv. Vill organisationen bestämma dem kan paketet låsa tre saker. Ingen låsning är
förvald; ett paket utan fälten låser ingenting.

| Låsning | Fält i formuläret | Vad som gäller när paketet är inläst |
|---|---|---|
| Golv för minsta gruppstorlek | *Lägsta tillåtna minsta gruppstorlek* (heltal 3–1000) | Minsta gruppstorlek kan inte sättas under värdet — inte i *Inställningar*, inte ur en konfigurationsfil och inte av ett annat paket som läses in senare. Fältet i *Inställningar* visar gränsen ("lägst N enligt organisationspaketet") och avvisar lägre värden med samma felmeddelande som ett ogiltigt värde. Är gällande tröskel lägre när paketet läses in höjs den till golvet. Paketets egen *Minsta gruppstorlek* får inte ligga under golvet |
| Låst rensningstid | *Rensning vid inaktivitet* (0 = av, eller 5–120 minuter) och rutan *Lås rensningstiden* | Rullistan under *Vad lagras?* står på värdet och går inte att ändra; en rad säger att organisationspaketet har låst tiden. Utan rutan är värdet bara en förinställning som handläggaren kan ändra. Läget *Av* (0) kan inte låsas |
| Små grupper i exporten från Tabeller och egna vyer | Rutan *Små grupper får tas med i exporten från Tabeller och egna vyer* (förvald) | Avkryssad: rutan "Ta med grupper under tröskeln i exporten" i Tabeller och egna vyer är dold, och exporten utelämnar alltid små grupper. En rad säger att organisationspaketet inte tillåter det |

Låsningarna gäller så länge paketet är inläst. *Rensa all data* tar bort dem tillsammans med
paketet, och konfigurationsfilen bär dem inte — en konfigurationsfil kan alltså varken sätta
eller häva en låsning. Läser handläggaren in ett **annat paket** som har ett lägre golv, eller
inget golv alls, frågar verktyget om bekräftelse (samma fråga som vid en sänkt tröskel). Nekar
handläggaren står det gamla golvet kvar, och resten av det nya paketet läses in. Ett högre golv kräver
ingen bekräftelse.

Ett ogiltigt värde i formuläret stoppar sparandet. Ett ogiltigt värde i en fil som skapats på
annat sätt används inte, och handläggaren får en varning när paketet läses in.

## 6. Formatet

Filen är JSON (formatversion 1). Den skapas och läses av verktyget; den behöver inte
redigeras för hand. Verktyget läser bara de fält som hör till formatet och ignorerar allt
annat. Formatet beskrivs i `docs/utveckling/arkitekturbeslut.md` (ADR-28) för
den som vill ta fram paket automatiskt ur ett lönestatistiksystem. Rapportens recept ligger under
`rapport`. `tabeller` är en lista med recept som verktyget själv skriver med *Lägg till i rapporten*.
Skapa dem i verktyget och spara paketet; skriv dem inte för hand. `perBasRecept` är receptet för
avsnittet per BAS-intervall. Ett recept som inte går att läsa hoppas över med en varning. Ett
paket utan `rapport` rör inte handläggarens egna tabeller.

Importprofilerna ligger under `importprofiler` (valfritt): en lista med högst 50 profiler, var och en
`{ "id", "namn", "rubriker": { "bas": […], "yrke": […], "lon": […], "alder": […], "kon": […], "poang": […],
"ansvar": […] }, "kannetecken": […] }`. `rubriker` är rubriknamnen per fält (högst 20 per fält; versaler och
tecken spelar ingen roll). `kannetecken` är de rubriker som måste finnas i filen för att profilen ska gälla
(utelämnat: de obligatoriska fältens första rubriker). Varje text är högst 80 tecken. En profil som inte går
att läsa hoppas över med en varning.

Profilerna skapas enklast i verktyget. Läs in paketet och ett uttag, peka ut kolumnerna i
kolumnmappningen och välj *Lägg till i organisationspaketet*. Det ger ett nytt paket med profilen,
byggt ur det inlästa paketets egna delar: inställningar, låsningar, ställningstagande och statistik
som paketet hade, inte sessionens värden. Det inlästa paketets profiler följer med. En
paketprofil som tagits bort i *Inställningar* följer inte med i det nya paketet. Profilens id härleds ur namnet
och kännetecknen; ett id i filen läses inte. Paket utan fältet fungerar som förut. Ett nytt
paket ersätter det förras profiler; *Rensa all data* tar bort dem tillsammans med paketet.

## 7. Exempelpaket

Ett komplett paket för en **påhittad** organisation, med alla tre låsningarna ifyllda. Talen är
påhittade och ska inte användas som referens. Det är skrivet av verktygets egen funktion för att
bygga paket och läses in utan varningar (vaktas av `tests/organisationspaket.test.js`). Använd det
för att se vad formuläret i avsnitt 2 ger, inte som mall att redigera för hand.

```json
{
  "format": "lonekartlaggning-organisationspaket",
  "version": 1,
  "organisation": {
    "namn": "Exempelkommunen"
  },
  "utgivare": "Lönefunktionen, HR-avdelningen",
  "skapat": "2026-11-02",
  "avserAr": 2026,
  "profil": {
    "jamforelseNamn": "Exempelkommunens lönestatistik",
    "jamforelseGenitiv": "Exempelkommunens lönestatistiks",
    "jamforelseKort": "lönestatistiken",
    "organisationstyp": "kommun"
  },
  "installningar": {
    "poPct": 41.5,
    "poNot": "Arbetsgivaravgifter och avtalsförsäkringar 2026",
    "manader": 12,
    "kTroskel": 10,
    "kTroskelLagst": 10,
    "inaktivitetMin": 30,
    "inaktivitetLast": true,
    "smaGrupperIExport": false,
    "jamforelse": "alla"
  },
  "referens": {
    "namn": "Lönepolitiskt ställningstagande 2026",
    "kortnamn": "Ställningstagandet",
    "rader": [
      {
        "aid": null,
        "bas": "A",
        "p10": 26000,
        "med": 28500,
        "p90": 31500
      },
      {
        "aid": null,
        "bas": "B",
        "p10": 28000,
        "med": 30500,
        "p90": 34000
      },
      {
        "aid": "402010",
        "bas": "C",
        "p10": 33000,
        "med": 36000,
        "p90": 40000
      }
    ]
  },
  "statistik": {
    "namn": "Lönestatistik november 2025",
    "rader": [
      {
        "aid": "402010",
        "aidFull": "402010 Förskollärare",
        "bas": "C",
        "median": 36200,
        "p10": 33100,
        "p90": 39800,
        "nKv": 412,
        "nMa": 31,
        "andelKv": 93
      },
      {
        "aid": "207009",
        "aidFull": "207009 Undersköterska, hemtjänst",
        "bas": "B",
        "median": 30900,
        "p10": 28400,
        "p90": 33900,
        "nKv": 820,
        "nMa": 140,
        "andelKv": 85.4
      }
    ]
  }
}
```

Vad paketet gör när det läses in:

- organisationen heter *Exempelkommunen*, jämförelsestatistiken *Exempelkommunens lönestatistik*,
  och SKR:s personalstatistik för kommuner är referens (`organisationstyp`);
- PO-påslaget 41,5 % och beräkningsperioden 12 månader används i Prioritering och Löneöversyn;
- minsta gruppstorlek är 10 och kan inte sättas lägre (`kTroskelLagst`);
- rensning vid inaktivitet är låst på 30 minuter (`inaktivitetMin` med `inaktivitetLast`);
- små grupper kan inte tas med i exporten från Tabeller och egna vyer (`smaGrupperIExport: false`);
- ställningstagandet har spann för BAS A och B och för en AID-etikett i BAS C, och statistiken har
  två AID-etiketter.

## 8. Checklista för systemförvaltaren

Före spridning:

- [ ] Ställningstagandet är det beslutade för året, och antalet rader stämmer med beslutet.
- [ ] Jämförelsestatistiken avser rätt mätmånad och har AID-koder som stämmer med lönefilens.
- [ ] Inga rader i statistiken bygger på så få personer att en enskild lön kan räknas fram.
- [ ] Organisationens namn, utgivare och datum stämmer; året (`avserAr`) är kartläggningens år.
- [ ] PO-påslaget och beräkningsperioden är årets.
- [ ] Låsningarna är beslutade: golv för minsta gruppstorlek, rensningstid, små grupper i exporten
      från Tabeller och egna vyer. Beslutet och skälet är dokumenterat, till exempel i dataskyddsombudets bedömning.
- [ ] Paketet är prövat: läs in det i en ny flik och kontrollera faktarutan (organisation, datum,
      innehåll och låsningar). Kontrollera också att *Inställningar* visar golvet och *Vad lagras?* den låsta tiden.
- [ ] En organisationsfil är öppnad och prövad på samma sätt, och IT har kontrollerat den mot `RELEASE.txt`
      (avsnitt 3b, *IT:s kontroll av organisationsfilen*).

Vid spridning:

- [ ] Paketet ligger bredvid verktyget på den interna filytan, med ett namn som visar året. Alternativt
      ligger organisationsfilen (avsnitt 3b) där, så att handläggarna bara behöver en fil.
- [ ] Vid en ny version av verktyget är paketet flyttat med *Flytta till en ny version* (avsnitt 4), och den gamla
      organisationsfilen är ersatt.
- [ ] Handläggarna vet vilket paket som gäller och att det läses in varje gång verktyget öppnas.
- [ ] Det gamla paketet är borttaget eller tydligt markerat som ersatt.
