# Organisationspaket — guide för systemägaren

Ett **organisationspaket** är en fil som samlar det som är gemensamt för hela organisationen,
så att varje HR-handläggare läser in det i ett steg i stället för att hämta och ladda upp
flera filer var för sig. Verktyget har ingen inbyggd organisation: utan paket (eller egna
filer) finns ingen referens att jämföra mot.

> Den här guiden är för den som förvaltar lönekartläggningen i organisationen — till exempel
> en lönespecialist eller HR-controller. Handläggarens arbetsflöde står i `korguide.md`.

---

## 1. Vad paketet innehåller

| Del | Innehåll | Används till |
|---|---|---|
| Organisation | Organisationens namn, utgivare (t.ex. "Lönefunktionen, HR-avdelningen"), datum, vilket år paketet avser och organisationstypen (kommun, region eller båda) | Visas i verktyget och i exporter, så att det framgår vilket underlag som använts |
| Benämningar | Vad jämförelsestatistiken heter (t.ex. "Kommunens lönestatistik") | Rubriker och texter i Jämförelse, Prioritering och exporter |
| Grundinställningar | PO-påslag och beräkningsperiod, och *Minsta gruppstorlek för redovisning* (valfritt; utan värde gäller 10 eller det handläggaren har satt) | Kostnadsberäkningarna i Prioritering och Löneöversyn, och vilka grupper som redovisas. Ett värde under 10 ger handläggaren en fråga om bekräftelse när paketet läses in |
| Låsningar (valfritt) | *Lägsta tillåtna minsta gruppstorlek*, en låst tid för *rensning vid inaktivitet*, och om *små grupper får tas med i Utforskas export* | Det handläggaren inte får ändra, se avsnitt 5 |
| Rapportens recept (valfritt) | Egna tabeller byggda i Utforska och ett eget recept för avsnittet per BAS-intervall — bara recepten (rader, kolumner, mått, urval), inga tal | Samma tabeller i Word, PDF, Excel och rapportunderlaget hos alla handläggare; ersätter de egna tabeller som finns när paketet läses in |
| Lönepolitiskt ställningstagande | P10, median och P90 per BAS-intervall (och/eller per yrke) | Prioritering, Jämförelse och statusrutan i Att göra |
| Jämförelsestatistik | Median (och gärna P10, P90 och könsfördelning) per yrke och BAS | Fliken Jämförelse, prioritering mot statistiken och reserven i Likvärdigt arbete |

Ställningstagandet och jämförelsestatistiken är var för sig valfria, men paketet måste
innehålla minst det ena. Analysens trösklar (t.ex. 60 % för kvinnodominans och 5 % för
flaggning) ingår inte — de är verktygets standard och kan ändras av handläggaren.

**Paketet innehåller inga personuppgifter** — bara organisationens ställningstagande och
aggregerad statistik. Verktyget avvisar ett paket som innehåller något som liknar
personnummer eller e-postadresser.

## 2. Skapa paketet

1. Öppna verktyget och gå till **Översikt**.
2. Läs in **ställningstagandet** och **jämförelsestatistiken** i sina rutor, precis som vid en
   vanlig kartläggning. Kontrollera att antalet rader stämmer.
3. Fäll ut **Skapa organisationspaket (för systemägaren)** i panelen *Organisationspaket*,
   längst ned i uppladdningsytan.
4. Fyll i organisationens namn, utgivare och år, vad jämförelsestatistiken ska heta, vad
   ställningstagandet ska heta (fältet är förifyllt med filens namn — byt till ett namn som passar i
   rapporten, t.ex. *Lönepolitiskt ställningstagande 2026*, och en kort form som *ställningstagandet*), samt
   PO-påslag och beräkningsperiod. Fältet *Minsta gruppstorlek för redovisning* är ifyllt med
   det värde som gäller just nu; lämna det tomt om paketet inte ska ange något. Ett ogiltigt
   värde (inte ett heltal mellan 2 och 1000) stoppar sparandet.
5. Fyll i låsningarna om organisationen vill ha dem (avsnitt 5): *Lägsta tillåtna minsta
   gruppstorlek*, *Rensning vid inaktivitet* med rutan *Lås rensningstiden*, och rutan *Små
   grupper får tas med i Utforskas export*. Tomma fält betyder att paketet inte anger något.
6. Kontrollera sammanfattningen ("Paketet får med: …" — den anger också vilken minsta
   gruppstorlek paketet får och vad det låser) och välj **Spara som
   organisationspaket**. Filen heter `<organisation>.lonepaket.json`.

Ingen lönefil behövs för att skapa paketet.

## 3. Sprida paketet

- Lägg filen på den plats där handläggarna hämtar verktyget, till exempel samma interna
  filyta. Den kan skickas som vanlig bilaga — den innehåller inga personuppgifter.
- Tala om för handläggarna vilket paket som gäller (år och datum). Verktyget visar
  organisation, utgivare, datum och innehåll när paketet läses in.
- En handläggare läser in paketet med **Läs in organisationspaket** på Översikt. Det sparas
  inte i verktyget och läses in varje gång, precis som lönefilen. En sparad
  konfigurationsfil påminner om vilket paket som användes.

## 3b. Organisationsfil — en enda fil att sprida

Handläggarna behöver inte få paketet som en egen fil. Systemägaren kan i stället baka in paketet
i själva verktyget och sprida **en organisationsfil**: handläggaren öppnar den, och benämningar,
ställningstagande, jämförelsestatistik och låsningar är på plats utan att något läses in.

1. Läs in paketet (eller bygg det i formuläret under *Skapa organisationspaket*).
2. Gå till **Skapa organisationsfil — verktyget med paketet inbakat** längst ned i samma panel.
3. Peka ut **verktygsfilen du öppnade** (`oppen-lonekartlaggning.html`). Det behövs eftersom en
   sida som öppnats från disk inte kan läsa sig själv — webbläsaren förbjuder det, och verktyget
   hämtar aldrig något.
4. Välj **filnamn** (förslaget är `oppen-lonekartlaggning-<organisation>.html`; ändelsen `.html`
   läggs på om den saknas) och klicka **Ladda ner organisationsfilen**.

Organisationsfilen innehåller verktyget oförändrat plus paketet som en inaktiv datablock sist i
filen. Inget skript ändras, så skyddet mot nätverk och lagring och kontrollsummorna i
innehållssäkerhetspolicyn gäller som förut. **Ingen lönedata ingår** — bara det paketet bär.
Filen visar i *Om verktyget* vilken version av verktyget den bygger på.

För handläggaren: filrutan *Organisationspaket* visar *Inbakat i den här filen* med knapparna
**Visa paketet** (innehållet som tabeller och råtext) och **Ladda ner paketet** (sparar det som
`.lonepaket.json`, så att det kan granskas, ändras och bakas in på nytt). Den som läser in en annan
paketfil ersätter det inbakade för sessionen; *Rensa all data* går tillbaka till det inbakade.
Demoläget (`?demo=1`) går före och använder inte det inbakade paketet.

**Ny version av verktyget eller ändrat paket:** gör om stegen ovan med den nya verktygsfilen eller
det ändrade paketet, och sprid den nya organisationsfilen. Verktyget varnar om den utpekade
filen är en annan version än den som körs.

## 4. Uppdatera paketet

Gör ett nytt paket när ställningstagandet eller jämförelsestatistiken ändras — i regel en
gång om året. Läs in det gamla paketet, byt ut det som ändrats med rutorna, ändra år i
formuläret och spara. Datumet i paketet visar vilken version som använts.

## 5. Låsningar — det handläggaren inte får ändra

Verktygets skydd för små grupper och den automatiska rensningen kan handläggaren annars ställa
in själv. Vill organisationen bestämma dem kan paketet låsa tre saker. Ingen låsning är
förvald; ett paket utan fälten låser ingenting.

| Låsning | Fält i formuläret | Vad som gäller när paketet är inläst |
|---|---|---|
| Golv för minsta gruppstorlek | *Lägsta tillåtna minsta gruppstorlek* (heltal 2–1000) | Minsta gruppstorlek kan inte sättas under värdet — inte i *Inställningar*, inte ur en konfigurationsfil och inte av ett annat paket som läses in senare. Fältet i *Inställningar* visar gränsen ("lägst N enligt organisationspaketet") och avvisar lägre värden med samma felmeddelande som ett ogiltigt värde. Är gällande tröskel lägre när paketet läses in höjs den till golvet. Paketets egen *Minsta gruppstorlek* får inte ligga under golvet |
| Låst rensningstid | *Rensning vid inaktivitet* (0 = av, eller 5–120 minuter) och rutan *Lås rensningstiden* | Rullistan under *Vad lagras?* står på värdet och går inte att ändra; en rad säger att organisationspaketet har låst tiden. Utan rutan är värdet bara en förinställning som handläggaren kan ändra. Läget *Av* (0) kan inte låsas |
| Små grupper i Utforskas export | Rutan *Små grupper får tas med i Utforskas export* (förvald) | Avkryssad: rutan "Ta med grupper under tröskeln i exporten" i Utforska är dold, exporten utelämnar alltid små grupper, och en rad säger att organisationspaketet inte tillåter det |

Låsningarna gäller så länge paketet är inläst. *Rensa all data* tar bort dem tillsammans med
paketet, och konfigurationsfilen bär dem inte — en konfigurationsfil kan alltså varken sätta
eller häva en låsning. Läser handläggaren in ett **annat paket** som har ett lägre golv, eller
inget golv alls, frågar verktyget om bekräftelse (samma fråga som vid en sänkt tröskel); nekas
den står det gamla golvet kvar och resten av det nya paketet läses in. Ett högre golv kräver
ingen bekräftelse.

Ett ogiltigt värde i formuläret stoppar sparandet. Ett ogiltigt värde i en fil som skapats på
annat sätt används inte, och handläggaren får en varning när paketet läses in.

## 6. Formatet

Filen är JSON (formatversion 1). Den skapas och läses av verktyget; den behöver inte
redigeras för hand. Verktyget läser bara de fält som hör till formatet och ignorerar allt
annat. Formatet beskrivs i `docs/utveckling/teknisk-plan.md` (ADR-28) för
den som vill ta fram paket automatiskt ur ett lönestatistiksystem. Rapportens recept ligger under
`rapport`: `tabeller` är en lista med recept som verktyget själv skriver med *Lägg till i rapporten*
(skapa dem i verktyget och spara paketet; skriv dem inte för hand), och `perBasRecept` receptet för
avsnittet per BAS-intervall. Ett recept som inte går att läsa hoppas över med en varning; ett
paket utan `rapport` rör inte handläggarens egna tabeller.

## 7. Exempelpaket

Ett komplett paket för en **påhittad** organisation, med alla tre låsningarna ifyllda. Talen är
påhittade och ska inte användas som referens. Det är skrivet av verktygets egen funktion för att
bygga paket och läses in utan varningar (vaktas av `tests/organisationspaket.test.js`); använd det
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
    "smaGrupperIExport": false
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
- små grupper kan inte tas med i Utforskas export (`smaGrupperIExport: false`);
- ställningstagandet har spann för BAS A och B och för en yrkesgrupp i BAS C, och statistiken har
  två yrken.

## 8. Checklista för systemägaren

Före spridning:

- [ ] Ställningstagandet är det beslutade för året, och antalet rader stämmer med beslutet.
- [ ] Jämförelsestatistiken avser rätt mätmånad och har AID-koder som stämmer med lönefilens.
- [ ] Inga rader i statistiken bygger på så få personer att en enskild lön kan räknas fram.
- [ ] Organisationens namn, utgivare och datum stämmer; året (`avserAr`) är kartläggningens år.
- [ ] PO-påslaget och beräkningsperioden är årets.
- [ ] Låsningarna är beslutade: golv för minsta gruppstorlek, rensningstid, små grupper i Utforskas
      export. Beslutet och skälet är dokumenterat, till exempel i dataskyddsombudets bedömning.
- [ ] Paketet är prövat: läs in det i en ny flik, kontrollera faktarutan (organisation, datum,
      innehåll och låsningar) och att *Inställningar* visar golvet och *Vad lagras?* den låsta tiden.

Vid spridning:

- [ ] Paketet ligger bredvid verktyget på den interna filytan, med ett namn som visar året — eller
      organisationsfilen (avsnitt 3b) är det som ligger där, så att handläggarna bara behöver en fil.
- [ ] Handläggarna vet vilket paket som gäller och att det läses in varje gång verktyget öppnas.
- [ ] Det gamla paketet är borttaget eller tydligt markerat som ersatt.
