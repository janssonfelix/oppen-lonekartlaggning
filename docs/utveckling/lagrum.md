# Lagrumshänvisningar

Det enda stället där verktygets lagrum står med paragraf och artikel. Verktyget självt, exporterna och
användardokumenten hänvisar **övergripande** — "enligt diskrimineringslagens regler om lönekartläggning",
"enligt lönetransparensdirektivet", "uppgiftsminimering enligt dataskyddsförordningen" — och pekar hit för den
som vill veta exakt vilken bestämmelse som avses (ADR-16). Principen beslutades 2026-10-19 efter en
genomgång av alla hänvisningar: hänvisningar med paragrafnummer sprids inte ut i koden, eftersom
3 kap. sannolikt numreras om när lönetransparensdirektivet genomförs i svensk rätt, och eftersom ett
paragrafnummer i en kolumnrubrik lätt blir fel utan att någon märker det.

Status: *Förslag* = väntar på avstämning med jurist och dataskyddsombud ·
*Avstämd* = godkänt av dem. Källor: diskrimineringslagen (2008:567) t.o.m. SFS 2025:736, direktiv (EU)
2023/970, förordning (EU) 2016/679.

## Så hänvisar verktyget

| Sammanhang | Form |
|---|---|
| Gränssnitt, verktygstips, exporter, Word, PDF, protokoll | Övergripande: *enligt diskrimineringslagen*, *lönekartläggningens regler*, *likvärdigt arbete*, *direktivets regler om gemensam lönebedömning*. Inga paragraf- eller artikelnummer. |
| Metodbilagan (varje Excelfil, Word och PDF) | Raden *Rättslig ram*: diskrimineringslagen 3 kap. (lönekartläggning); direktiv (EU) 2023/970; och en hänvisning hit. |
| Dokumenten i `docs/` | Övergripande, med hänvisning hit där ett lagrum behövs. |
| Den här tabellen | Exakt: *3 kap. 9 § 2 diskrimineringslagen*, *art. 10.1 a direktiv (EU) 2023/970*, *art. 5.1 c dataskyddsförordningen*. |

## Diskrimineringslagen (2008:567), 3 kap. — aktiva åtgärder om lönefrågor

| Moment i verktyget | Lagrum | Verktyget skriver | Status |
|---|---|---|---|
| Årlig kartläggning: bestämmelser och praxis | 3 kap. 8 § 1 | *regler och praxis kring lön* | Förslag |
| Årlig kartläggning: löneskillnader | 3 kap. 8 § 2 | *lönekartläggningen* | Förslag |
| Analys av lika arbete | 3 kap. 9 § 1 | *lika arbete* | Förslag |
| Kvinnodominerat arbete mot likvärdigt arbete | 3 kap. 9 § 2 | *likvärdigt arbete* | Förslag |
| Kvinnodominerat arbete mot arbete med lägre krav och högre lön | 3 kap. 9 § 3 | *lägre krav, högre lön* | Förslag |
| Vad som är likvärdigt arbete (kraven) | 3 kap. 10 § | *kraven i arbetet*, *arbetsvärdering* | Förslag |
| Sakliga skäl | följer av 3 kap. 9 § (analys av samband med kön) | *sakliga skäl*, utan paragraf | Förslag |
| Gränsen för kvinnodominerat arbete | lagen anger ingen siffra ("är eller brukar anses vara"); 60 % är förarbetenas riktmärke | **mer än 60 % kvinnor** (`KVINNO_TROSKEL_DEFAULT`, >); icke-kvinnodominerat under 40 % | Förslag — beslut 2026-10-19 |
| Samverkan med arbetstagarna | 3 kap. 11 §; redogörelse 13 § 7; information till facket 12 § | *samverkan med arbetstagarna* | Förslag |
| Åtgärder, kostnadsberäkning och tidsplan (senast inom tre år) | 3 kap. 13 § andra stycket 4–5 (10–24 anställda via 14 §); allmänt 3 kap. 2 § 3 och 3 § | *åtgärder och tidsplan* | Förslag |
| Ordet *handlingsplan* | inte lagens begrepp sedan 2017 (SFS 2016:828) | fliken heter fortfarande *Handlingsplan*; rapportens avsnitt heter *Åtgärder och tidsplan* | Förslag — flikens namn är ett produktbeslut |
| Dokumentation | 3 kap. 13 § (25 eller fler anställda, gäller alltid kommun och region) och 14 § (10–24) | *dokumentationen av lönekartläggningen* | Förslag |
| Ramen | 3 kap. 8–14 §§ | *diskrimineringslagen 3 kap. (lönekartläggning)* | Förslag |
| Svensk lag om lönetransparens | finns inte (oktober 2026); propositionen stoppades 2026-03-26, DO förbereder | ingen hänvisning; bevakas | Förslag, bevakas |
| Offentlighet och sekretess i kommun och region | 10 kap. 11–14 §§ och 12 kap. 2 § offentlighets- och sekretesslagen (2009:400) i stället för MBL:s tystnadsplikt | nämns i samverkansavsnittet när texten uppdateras | Förslag |

**AID** (SKR:s arbetsidentifikation) är ingen rättskälla. Verktyget använder AID-grupperna som utgångspunkt
för lika arbete, med metodtexten att AID inte är ett arbetsvärderingssystem (ADR-33); bedömningen av vilka
arbeten som är lika eller likvärdiga är arbetsgivarens.

## Direktiv (EU) 2023/970 om lönetransparens

| Moment | Artikel | Verktyget skriver | Status |
|---|---|---|---|
| Införandet | art. 34.1, senast 7 juni 2026; Sverige har inte infört direktivet (oktober 2026) | *direktivet skulle vara infört senast den 7 juni 2026; Sverige har inte infört det; delar kan ha direkt verkan mot kommun och region (se SKR)* | Förslag |
| Lönegapets definition och rapportering | definition art. 3.1 c, rapportering art. 9.1 a; lön enligt art. 3.1 a–b (årslön och timlön brutto, inklusive tillägg) | *direktivets lönegap*; metodbilagan säger att verktyget räknar på månadslön | Förslag |
| Kvartiler | art. 9.1 f | *lönekvartilerna* | Förslag |
| Tidplan för rapportering | 250 eller fler: senast 7 juni 2027, därefter årligen (art. 9.2); 150–249: 7 juni 2027, vart tredje år (9.3); 100–149: 7 juni 2031, vart tredje år (9.4) | *stegvis för arbetsgivare med 100 anställda eller fler; svensk tidplan saknas* | Förslag |
| Femprocentsgränsen | art. 10.1 a: 5 % eller mer; gäller bara som villkor för gemensam lönebedömning, aldrig som gräns för analys av lika eller likvärdigt arbete (3 kap. 9 § kräver analys av varje skillnad) | *gränsen 5 % i direktivets regler om gemensam lönebedömning* | Förslag — metodändring att pröva |
| Gemensam lönebedömning | art. 10.1 a–c (tre villkor), innehåll 10.2 a–g, tillgänglighet 10.3, åtgärder inom rimlig tid 10.4 | *gemensam lönebedömning* | Förslag |
| Rätt till information | art. 7 (7.3 årlig information, 7.4 svar inom två månader) | utanför verktygets omfång | Förslag |
| Könsneutrala lönestrukturer och kriterier | art. 4 (kriterier 4.4) och 6; art. 5 gäller tiden före anställning | *könsneutrala lönestrukturer och lönekriterier (art. 4 och 6)* i Om verktyget | Förslag |
| Information till anställda om kartläggningen | ingen regel i direktivet (art. 13 gäller social dialog); mallen bygger på dataskyddsförordningen art. 12–13 | mallen i pilotpaketet | Förslag |

## Dataskyddsförordningen (EU) 2016/679

| Moment | Artikel | Verktyget skriver | Status |
|---|---|---|---|
| k-anonymitet | uppgiftsminimering art. 5.1 c och inbyggt dataskydd art. 25, med skäl 26 som bakgrund; k = 10 är verktygets eget val | *uppgiftsminimering och inbyggt dataskydd*; inte "striktare än GDPR" | Förslag |
| Uppgifts- och lagringsminimering | art. 5.1 c, 5.1 e | *uppgiftsminimering*, *lagringsminimering* | Förslag |
| Panelen *Vad lagras?* | inbyggt dataskydd art. 25 (art. 12–14 gäller information till registrerade, inte till användaren) | *inbyggt dataskydd* | Förslag |
| Rensa all data | lagringsminimering art. 5.1 e och dataskydd som standard art. 25.2; rätten till radering (art. 17) utövas mot källsystemet | *rensning*, inte *rätt till radering* | Förslag |
| Rättslig grund | art. 6.1 c med 6.3: rättslig förpliktelse enligt 3 kap. 8, 13 och 14 §§ diskrimineringslagen | *rättslig förpliktelse* | Förslag |
| Särskilda kategorier | art. 9 inte tillämplig: kön är ingen särskild kategori och underlaget innehåller inga sådana uppgifter; en spärr mot fält som fackmedlemskap eller hälsa bör övervägas | *inga särskilda kategorier* | Förslag |
| Automatiserade beslut | art. 22 inte tillämplig; verktyget fattar inga beslut om enskilda | sägs utan artikel | Förslag |
| Personuppgiftsbiträde | art. 28 inte tillämplig när verktyget körs lokalt; biträdesavtal krävs om drift eller support med tillgång till data tillkommer | *inget biträde* | Förslag |
| Säkerhet | art. 32 | *säkerhet* | Förslag |
| Konsekvensbedömning | art. 35; sannolikt motiverad för kommun och region (EDPB WP248: anställda som sårbara registrerade, stor omfattning); dataskyddsombudet avgör | *dataskyddsombudet avgör* | Förslag — DSO avgör |
