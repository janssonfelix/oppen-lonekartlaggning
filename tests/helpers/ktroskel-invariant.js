// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * I4: invarianten över flikar och exporter vid en tröskel, som en svit att anropa per tröskel.
 *
 * Förberedelsen (samlaUtdata) bygger alla exporter och tar omkring en minut per tröskel. Vitest kör en fil per
 * arbetare, så sviten anropas från en fil per tröskel: tests/ktroskel-invarianter.test.js (10) och
 * tests/ktroskel-invarianter-25.test.js (25), som då körs parallellt.
 *
 * Vaktar: S4 (docs/utveckling/regler.md)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { KON_MA, KON_GAP, KON_GAP_1, KON_GAP_CELL, KON_DOLDA, harNagon, samlaUtdata, sammanhang, fonsterKon, SENT_MELLAN, SENT_SMA, FK_RA } from './ktroskel-rigg.js';

// ===================================================================================
// I4: invarianten över flikar OCH exporter, vid 10 och 25.
//
// Vad som prövas: varje flik i menyn, ritad i exportläget (det som "Som i exporten" visar), Översiktens delar (Att göra, processöversikten,
// inläsningsrapporten), Word-utkastet, utskriften i de tre urvalen,
// rapportunderlagets block (HTML och text), Excel (alla flikar, protokollet, EU-lönerapporten,
// handlingsplanen, jämförelseexporten, Löneöversyn, Löneöversikten, prioriteringslistan, ZIP-filens
// rapport.xlsx), Att göra-CSV, varje tabell med CSV-knapp, diagramdata för varje diagram som diagramkärnan har ritat
// (ur dess register, efter bakgrundsräkningen och nästa bildruta; ett test kräver att inget fattas) och kopiorna i Alla diagram,
// gruppdossiern för varje valbar grupp, BAS-dossiern för varje valbart intervall, Rapporttextens utkast (med delen
// per BAS-intervall), rapportens avsnitt Lönekartläggning per BAS-intervall, med förra årets bokslut inläst blocket
// och avsnittet om förra året (tabellen per BAS-intervall, med lönespridningen) och BAS-hantelns diagramdata,
// konfigurationsfilens årsbokslut, bilagan med gruppdossierer (rapportmodellen och utskriften), och Att göra-punkterna.
//
// Vad som INTE prövas, och varför:
//  - #view-likvardighet och dess egen export: dokumenterat undantag (dataskydd.md § 3, undantag 1).
//  - #view-utforska på skärmen: ADR-14. Dess tabell och diagram prövas med rutan urkryssad.
//  - #personer-att-granska: ADR-23 (individlista, bara i verktyget).
//  - #outliers-container: extremvärdeslistan visar enskilda rader på skärmen, som Personer att
//    granska (ADR-23); att den inte följer med i någon export prövas här genom att exporterna prövas.
//  - Låddiagrammet per kön (INDIVIDDIAGRAM nedan): avvikarna är enskilda löner, utan yrke (dataskydd.md § 4).
//    Spridningsdiagrammen är INTE undantagna: en persons punkt ritas och exporteras bara när
//    personens grupp och kön i gruppen når tröskeln, så deras export prövas som alla andras.
//  - Riktade potter i Löneöversyn på färre personer än tröskeln är användarens egen simulering (ADR-38 R2) och
//    visar beloppet på raden; rigg­en lägger inga sådana rader. Det råa gapet före och efter prövas av C3.
//  - Löneöversyns förslag ur kandidatparen (ADR-69): riggens underlag har inga kandidatpar i likvärdigt arbete,
//    så ett förslag här vore tomt. Förslagen prövas i tests/loneoversyn-forslag-troskel.test.js, med par där
//    det kvinnodominerade yrket eller jämförelseyrket är under tröskeln.
//  - Robusthetspanelen körs här direkt (den räknas annars först på knapptryck) och läses som en egen väg;
//    att den utelämnar par med en grupp under tröskeln och anger antalet prövas med parfixturen ovan.
//  - Diagram som riggens underlag inte ritar finns inte i registret och prövas inte: hanteln per yrkesgrupp med förra
//    årets bokslut (chart-arsjamforelse: riggens bokslut ger den inga rader). Lönehistogrammet per kön och
//    Var uppstår löneskillnaden ritas på skärmen men inte i exportläget, och deras vägar säger "inget att exportera".
//  - Livscykelns kurva ritas för det förvalda intervallet (det största). Kurvan är modellens tal, inte gruppens löner,
//    så sökningen efter sentinelvärden känner inte igen den för ett litet intervall; det prövar
//    tests/ktroskel-livscykel.test.js.
//  - Ålder & karriär ritas här med "Alla BAS". Att fliken följer regeln för ett litet kön, i hela
//    urvalet och i ett valt BAS, prövas av R4 längre ned; regressionens
//    ojusterade steg prövas av R1, som också kör samlaUtdata mot ett underlag med 7 män.
// ===================================================================================
export function invariantSvit(k, extra) {
    describe(`I4: invarianten över flikar och exporter vid ${k}`, () => {
        let utdata;
        const dolda = [...KON_DOLDA, ...SENT_SMA, ...extra];
        // Gränsen fångar ett test som hänger sig, den mäter inte fart: förberedelsen tar omkring en minut ensam och ungefär
        // dubbelt så lång tid under full last.
        beforeAll(async () => { utdata = await samlaUtdata(fonsterKon(k === 10 ? null : k)); }, 300000);
        it('utdata finns för varje väg (annars prövar testet inget)', () => {
            const namn = utdata.map(([n]) => n);
            for (const krav of ['skärm: alla flikar', 'skärm i exportläget: alla flikar', 'Word-utkastet', 'Att göra-CSV', 'ZIP Excel-filen', 'utskrift: komplett', 'utskrift: ledning', 'utskrift: facklig',
                'tabell-CSV: explore-table', 'diagramdata: chart-explore', 'rapportunderlag: sammanfattning',
                'robusthetspanelen'])
                expect(namn, krav).toContain(krav);
            expect(utdata.find(([n]) => n === 'robusthetspanelen')[1]).toMatch(/Kvinnodominerat yrke|Inga kandidatpar/);
            expect(namn.filter(n => n.startsWith('gruppdossier')).length).toBeGreaterThan(5);
            expect(namn.filter(n => n.startsWith('basdossier')).length).toBeGreaterThan(3);
            // Rapportutkastet och rapportens avsnitt per BAS-intervall, och rapportunderlagets block per intervall.
            for (const krav of ['rapportutkastet', 'rapportmodell: basintervall']) expect(namn, krav).toContain(krav);
            expect(utdata.find(([n]) => n === 'rapportutkastet')[1]).toContain('PER BAS-INTERVALL');
            expect(utdata.find(([n]) => n === 'rapportmodell: basintervall')[1]).toContain('BAS-intervall S1');
            expect(namn.filter(n => n.startsWith('rapportunderlag: bas:')).length).toBeGreaterThan(3);
            // Med förra årets bokslut: tabellen Löneutveckling per BAS-intervall och BAS-hanteln.
            for (const krav of ['rapportunderlag: arsjamforelse (med bokslut)', 'rapportmodell: arsjamforelse (med bokslut)', 'diagramdata: chart-arsjamforelse-bas (med bokslut)', 'konfigurationsfilen: årsbokslutet']) expect(namn, krav).toContain(krav);
            expect(utdata.find(([n]) => n === 'konfigurationsfilen: årsbokslutet')[1]).toContain('"spridning"');
            // Importprofilerna: bara rubriknamn — inga lönemått, inga tal utöver formatets version (id:t är en kontrollsumma).
            for (const krav of ['importprofilerna (Exportera JSON)', 'konfigurationsfilen: importprofilerna']) {
                const t = utdata.find(([n]) => n === krav)?.[1];
                expect(t, krav).toContain('Vår personallista');
                expect(t.replace(/"id":\s*"[^"]*"/g, ''), krav).not.toMatch(/\d{2,}/);
            }
            // Bilagan med gruppdossierer: minst en dossier (de stora grupperna), i rapportmodellen och i utskriften.
            for (const krav of ['rapportmodell: dossierer', 'utskrift: med gruppdossierer']) expect(utdata.find(([n]) => n === krav)?.[1], krav).toContain('Gruppdossier: ');
            expect(utdata.find(([n]) => n === 'rapportmodell: arsjamforelse (med bokslut)')[1]).toContain('Lönespridning');
            expect(utdata.find(([n]) => n === 'rapportunderlag: arsjamforelse (med bokslut)')[1]).toContain('Löneutveckling per BAS-intervall');
            // Varje fångad utdata ska ha innehåll, utan undantag: fixturen ger rader i varje tabell med CSV-knapp,
            // spår i varje ritat diagram, minst en iakttagelse och minst en Att göra-punkt. En export som inte
            // skriver något (t.ex. en CSV-knapp utan verkan) ska fälla testet, inte passera som "inget läckte".
            for (const [n, t] of utdata) expect(t.length, n).toBeGreaterThan(50);
            for (const prefix of ['tabell-CSV: ', 'diagramdata: ']) expect(namn.filter(n => n.startsWith(prefix)).length, prefix).toBeGreaterThanOrEqual(5);
            expect(utdata.find(([n]) => n === 'Att göra-CSV')[1].split('\n').length).toBeGreaterThan(3);
            // Excelfilen med alla flikar bär bladet Lönepolitik (fixturen har ett ställningstagande), så det prövas här.
            expect(utdata.find(([n]) => n.startsWith('Excel alla flikar'))[1]).toContain('[Lönepolitik]');
            expect(utdata.find(([n]) => n === 'ZIP Excel-filen')[1]).toContain('[Lönepolitik]');
            // Stora grupper syns, så att tystnad inte beror på tomma utdata.
            expect(utdata.find(([n]) => n === 'Word-utkastet')[1]).toContain('S1');
            expect(utdata.find(([n]) => n === 'skärm: alla flikar')[1]).toContain('Säkeryrke 0');
            // Flikarna i exportläget visar de stora grupperna, och vid 10 mellangrupperna (20 personer).
            const exportlage = utdata.find(([n]) => n === 'skärm i exportläget: alla flikar')[1];
            expect(exportlage).toContain('Säkeryrke 0');
            if (k === 10) expect(harNagon(exportlage, SENT_MELLAN).length, 'mellangrupperna i exportläget vid 10').toBeGreaterThan(0);
            // Y1–Y3 (ett kön under tröskeln) står kvar med samlad median, och noten säger varför gapet saknas; EU-lönerapporten
            // namnger dem. Sökningen efter gapet nedan prövar alltså rader som finns.
            for (const namn of ['Word-utkastet', 'utskrift: komplett']) expect(utdata.find(([n]) => n === namn)[1], namn).toMatch(/ett av könen har färre än \d+ personer/);
            expect(utdata.find(([n]) => n.startsWith('EU-lönerapporten'))[1]).toMatch(/^Y1 \| 31 \|[^]*Y1, Y2, Y3/m);
            // Statistikens matchning: kolumnen i tabellens CSV, detaljlistan, Excel och jämförelseexporten.
            expect(utdata.find(([n]) => n === 'tabell-CSV: benchmark-table')?.[1]).toMatch(/BAS \| Matchning \| N[^]*AID \+ BAS/);
            expect(utdata.find(([n]) => n === 'tabell-CSV: ref-tabell')?.[1]).toMatch(/Matchning[^]*AID \+ BAS/);
            expect(utdata.find(([n]) => n.startsWith('jämförelseexporten'))[1]).toMatch(/BAS \| Matchning \| N \(organisationen\)[^]*AID \+ BAS/);
            expect(utdata.find(([n]) => n.startsWith('Excel alla flikar'))[1]).toMatch(/\[Jämförelsestatistik\][^]*Matchning mot jämförelsestatistiken/);
            expect(utdata.find(([n]) => n === 'rapportunderlag: referenser')?.[1]).toMatch(/<th>Yrkesgrupp<\/th><th>Matchning<\/th>[^]*AID \+ BAS/);
        });
        // Sammanfattningen räknar bara yrkesgrupper som når tröskeln: 14 vid 10 (de sex säkra, toppyrket, de fyra mellan och
        // de tre med ett litet kön), 10 vid 25 (utan de fyra mellan). Fixturen har en statistikrad per AID×BAS.
        it('statistikens matchning räknar bara grupper som når tröskeln', () => {
            const n = k === 10 ? 14 : 10;
            const t = utdata.find(([namn]) => namn === 'Löneläget: statistikens matchning')[1];
            expect(t).toContain(`Statistiken: ${n} yrkesgrupper matchade på AID och BAS, 0 på endast AID, 0 utan statistik.`);
            expect(t).toContain(`I urvalet: ${n} yrkesgrupper på AID + BAS, 0 på endast AID, 0 utan statistik.`);
            // Överblickens diagram över statistikens spann (Löneläget): en punkt per grupp som når tröskeln, med matchningen i
            // serienamnet. Spannet 0–100 per BAS ger inga rader (utanData).
            const d = utdata.find(([namn]) => namn === 'diagramdata: chart-jmf-statlage')?.[1];
            expect(d, 'diagramdata: chart-jmf-statlage').toBeTruthy();
            expect(d.split('\n').filter(r => / · AID \+ BAS \| BAS /.test(r))).toHaveLength(n);
            expect(d).not.toMatch(/Endast AID|Statistikens spann/);
        });
        // Alla diagram (74-alla-diagram.js): kopian exporteras ur källans figur, så dess diagramdata är källans, rad för rad
        // (samma rubrik, stämpel och punkter). Varje kopia har en källa bland diagrammen ovan.
        it('kopiorna i Alla diagram ger samma diagramdata som källan', () => {
            const kopior = utdata.filter(([n]) => n.startsWith('diagramdata (Alla diagram): '));
            expect(kopior.length).toBeGreaterThanOrEqual(5);
            let jamforda = 0;
            for (const [namn, text] of kopior) {
                const kalla = utdata.find(([n]) => n === `diagramdata: ${namn.slice('diagramdata (Alla diagram): ut-diagram-'.length)}`);
                if (!kalla) continue;   // källan har inget id som börjar med chart- (den prövas ändå genom kopian)
                jamforda++;
                expect(text, namn).toBe(kalla[1]);
            }
            expect(jamforda).toBeGreaterThanOrEqual(5);
        });
        // Fullständigheten: varje diagram som diagramkärnan har ritat (riggen läser kärnans register, _rfBehallare, efter
        // ritningen på skärmen, i Alla diagram, i exportläget och med förra årets bokslut) har en väg med diagramdata,
        // så att ett nytt diagram inte kan hamna utanför I4. Också ett diagram som inte har något att exportera (det ritas
        // inte i exportläget, eller allt i det hör till grupper under tröskeln) har en väg, som säger det. Undantagen är
        // de namngivna: de undantagna vyerna, låddiagrammet per kön (INDIVIDDIAGRAM) och diagram märkta markeraUtanExport.
        it('varje diagram som diagramkärnan har ritat har en väg med diagramdata, utom de namngivna undantagen', () => {
            const namn = new Set(utdata.map(([n]) => n));
            const ritade = utdata.diagram;
            expect(ritade.filter(e => !e.kopia && e.steg === 'skärmen').length).toBeGreaterThanOrEqual(30);
            expect(ritade.filter(e => e.kopia).length).toBeGreaterThanOrEqual(25);
            const saknas = [];
            for (const e of ritade) {
                expect(e.id, 'ett ritat diagram utan id').not.toBe('(utan id)');
                if (e.undantag) { expect(['undantagen vy', 'INDIVIDDIAGRAM', 'markeraUtanExport'], e.id).toContain(e.undantag); continue; }
                const vag = e.kopia ? `diagramdata (Alla diagram): ${e.id}` : `diagramdata: ${e.id}${e.steg === 'bokslut' ? ' (med bokslut)' : ''}`;
                if (!namn.has(vag)) saknas.push(`${e.id} (${e.steg})`);
            }
            expect([...new Set(saknas)]).toEqual([]);
        });
        // Skärmen maskerar inget (ADR-51): den vägen prövas positivt nedan och undantas i läckkontrollerna.
        const exporter = () => utdata.filter(([n]) => n !== 'skärm: alla flikar');
        it('skärmen visar grupperna och könen under tröskeln (ADR-51)', () => {
            const skarm = utdata.find(([n]) => n === 'skärm: alla flikar')[1];
            expect(harNagon(skarm, [...SENT_SMA, ...KON_MA]).length).toBeGreaterThan(0);
        });
        it('ingen enskild lön, ingen lön för en grupp under tröskeln och ingen lön för ett kön under tröskeln i det som lämnar verktyget', () => {
            const lackor = [];
            for (const [namn, text] of exporter()) for (const v of harNagon(text, dolda)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
            expect(lackor).toEqual([]);
        });
        // Förhandskontrollen (de tio första raderna med filens råvärden) visas bara på skärmen: inte i någon export, inte i
        // Att göra-punkterna och inte i konfigurationsfilen. Dess varningar står i Att göra, utan värden ur filen.
        it('förhandskontrollens råvärden syns på skärmen men i inget som lämnar verktyget', () => {
            const skarm = utdata.find(([n]) => n === 'skärm: alla flikar')[1];
            for (const v of FK_RA) expect(skarm, v).toContain(v);
            expect(utdata.map(([n]) => n)).toContain('konfigurationsfilen (hela)');
            expect(utdata.find(([n]) => n === 'Att göra-punkter')[1]).toContain('fk-alder-fodelsear');
            const lackor = [];
            // Flikarna i exportläget är också skärmen: förhandskontrollen står där, men följer inte med i någon export.
            for (const [namn, text] of exporter().filter(([n]) => n !== 'skärm i exportläget: alla flikar')) for (const v of harNagon(text, FK_RA)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
            expect(lackor).toEqual([]);
        });
        it('inget könsgap för en grupp där ett kön är under tröskeln i det som lämnar verktyget', () => {
            const lackor = [];
            for (const [namn, text] of exporter()) {   // tidsstämplarna är redan borttagna (utanTid i samlaUtdata)
                for (const v of harNagon(text, KON_GAP)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
                for (const re of [...KON_GAP_1, ...KON_GAP_CELL]) { const m = text.match(re); if (m) lackor.push(`${namn}: ${m[0]} — "${sammanhang(text, m[0])}"`); }
            }
            expect(lackor).toEqual([]);
        });
    });
}
