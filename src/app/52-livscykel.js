// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { talformat } from '../lib/figur.js';
import { livscykelRegression, samspelSakerstallt } from '../lib/livscykel.js';
import { personOrd } from '../lib/namn.js';
import { svKr, svPct, svTal, svTecken } from '../lib/talformat.js';
import { livscykelKurvaUtelamnad, vymodellLivscykel } from '../lib/vymodell-livscykel.js';
import { adjektiv, stor } from '../lib/termer.js';
import { behallFokus, esc } from './01-html-och-tillganglighet.js';
import { antalRubrik, antalText } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { byggGrundurval, sattMetodik } from './05-tabeller-och-lankar.js';
import { kMaskerad, kTroskel, provaEnskiltText, statGolv } from './06-k-troskel.js';
import { kMaskNot } from './06-maskeringsnoter.js';
import { T } from './09-termer.js';
import { ritaFigur } from './10-diagramritare.js';
import { gapStatusNiva, PALETT } from './10-diagramtema.js';
import { hamtaData, state } from './12-tillstand.js';
import { iExportLage } from './23-exportgrind.js';
import { _oppnaBevisruta } from './27-berakningsbevis.js';
import { KOHORT_FORBEHALL } from './40-alder-karriar.js';
import { korOLSRegression } from './51-lika-arbete-regressionskort.js';

// ---- Livscykelanalys (sekundär regression) ----
/**
 * Senast valt BAS för livscykelanalys (sparas mellan re-renders så användarens
 * val inte återställs varje gång regressionskortet renderas om).
 */
/** @type {string|null} */
export let _livscykelValdBas = null;
/** Rensa all data: valet var ett BAS-intervall i det rensade underlaget. */
export function livscykelSlapp() { _livscykelValdBas = null; }

/**
 * Ritar livscykelanalysen: nyckeltalen, slutsatsen, kurvorna med 95 % KI-band, översiktstabellen per BAS och
 * modelljämförelsen. Det som räknas och bedöms står i vymodellen (vymodellLivscykel i src/lib/vymodell-livscykel.js,
 * ADR-99); här skrivs orden och ritas.
 *
 * Anropas när fliken Ålder & karriär (data-tab="kon") öppnas — livscykel-
 * panelen visas tillsammans med kön/ålder-kurvorna (sammanslagen flik).
 *
 * @param {any} [given] huvudregressionen från regressionskortet i samma varv (ADR-17)
 */
export function ritaLivscykel(given) {
    const wrap = document.getElementById('livscykel-content');
    if (!wrap) return;

    const result = korLivscykelregression(_livscykelValdBas);
    if (result.error) {
        wrap.innerHTML = `<div class="insight-box warn pad-18">
            <strong>${ikon('statusVarning')} Livscykelanalysen kunde inte köras</strong>
            <p class="fs-md marg-8-0-0">${esc(result.error)}</p>
            ${['no_age', 'ingen_spridning', 'inget_gemensamt_spann'].includes(result.errorCode) ? '' : `<p class="text-dampad-sm marg-8-0-0">Analysen kräver minst 50 personer totalt, minst ${statGolv()} av varje kön och minst 2 ${T.niva.fl}. Säkerställ också att kön-, ålders- och lönefält är korrekt mappade.${result.errorCode === 'low_n' || result.errorCode === 'imbalance' ? provaEnskiltText() : ''}</p>`}
        </div>`;
        return;
    }
    _livscykelValdBas = result.fixBas;

    // Jämför med primäranalysen: given från regressionskortet i samma varv, annars räknad här (ADR-17)
    const primary = given || korOLSRegression();
    const vm = vymodellLivscykel(result, { rader: state.data, k: kTroskel(), huvud: primary });
    const h = vm.huvud;
    // Modelljämförelsens rubrikrad: urvalet bakom modellerna. Bygger de på samma personer står det en gång.
    const modellCaption = !h || vm.sammaUrval
        ? antalRubrik(result.kvN, result.maN)
        : `<caption class="text-dampad-sm ta-vanster">Huvudmodell: ${antalText(h.nKv, h.nMa)} · Livscykelmodell: ${antalText(result.kvN, result.maN)}</caption>`;

    // Modelljämförelsens tabell markerar säkerheten med stjärnor, som tabellens not förklarar; utan stjärna är
    // p ≥ 0,05. Nyckeltalet säger det med ord, med samma gräns som tolkningsregeln (samspelSakerstallt i src/lib/livscykel.js: p < 0,10).
    const sigBadge = p => p < 0.001 ? `<span class="farg-kritisk">***</span>`
                       : p < 0.01  ? `<span class="farg-kritisk">**</span>`
                       : p < 0.05  ? `<span class="farg-varning">*</span>`
                       : '';
    const sakerOrd = p => samspelSakerstallt(p) ? 'säkerställd' : '<span class="f-dampad">inte säkerställd</span>';
    const pText = p => p < 0.001 ? '< 0,001' : svTal(p, 3);
    // I löptext: «p < 0,001» eller «p = 0,012», aldrig «p = < 0,001».
    const pLika = p => p < 0.001 ? '< 0,001' : `= ${svTal(p, 3)}`;

    const basOptions = result.basList.map(b =>
        `<option value="${esc(b)}"${b === result.fixBas ? ' selected' : ''}>BAS ${esc(b)}</option>`
    ).join('');

    // Sammanfattningsrutor för gap-utveckling
    const gapStart = result.gapFran;
    const gapEnd   = result.gapTill;
    // Nyckeltalens färg följer uppmärksamhetstrappan (ADR-59, ADR-71): modellens 95 %-intervall för skillnaden vid åldern
    // prövar den (result.nivaFran, result.nivaTill ur src/lib/livscykel.js). Färgen bär inte betydelsen ensam: statusens
    // ikon står bredvid talet och ordet i verktygstipset och för skärmläsaren (WCAG 1.4.1).
    const nyckeltal = (niva, kvot) => {
        const st = gapStatusNiva(niva);
        const klass = { granska: 'farg-granska', varning: 'farg-varning', ok: 'farg-ok' }[st.farg] || 'farg-dampad';
        return `<div class="fs-xl fw-700 ${klass}" data-niva="${st.niva}" title="${esc(st.serie)}">${ikon(st.ikon)} ${svPct(kvot, 1)}</div>
                <span class="sr-only">${esc(st.serie)}</span>`;
    };
    // Nyckeltalen är kvinnors lön i % av mäns, som i resten av verktyget. Modellen är log-linjär och ger skillnaden
    // (exp(skillnaden på log-skalan) − 1) × 100, så kvoten är 100 + skillnaden; förändringen mellan spannets ändar är densamma i
    // procentenheter vilket mått man än läser.
    const { kvotFran, kvotTill } = vm;
    const kvotMening = `Modellen ger skillnaden i procent, kvinnor mot män: ${gapStart >= 0 ? '+' : ''}${svPct(gapStart, 1)} vid ${result.alderFran} år och ${gapEnd >= 0 ? '+' : ''}${svPct(gapEnd, 1)} vid ${result.alderTill} år. Det är samma sak som att kvinnors lön är ${svPct(kvotFran, 1)} respektive ${svPct(kvotTill, 1)} av mäns, talen ovan.`;

    // ====== B4: Översiktstabell — modellens lönenivåer per BAS (vm.basRader) ======
    // Minsta gruppstorlek: ett BAS-intervall under tröskeln har en koefficient skattad på få personers löner, så
    // kronvärdena skulle peka ut dem. Raden utelämnas helt — en rad där varenda kronkolumn står som "< 10" ger
    // inget att analysera — och BAS:et räknas upp i noten under tabellen.
    const basVisade = vm.visade;
    const basUtelamnade = vm.utelamnade;
    // Kurvan är modellens lönenivå i det valda intervallet, ett lönemått (ADR-70). Ett valt intervall som tabellen
    // utelämnar får heller ingen kurva: ingen figur ritas, så varken bilden, diagramdatan eller kopian i Alla diagram
    // bär den, och en not säger vilket intervall som är valt och varför. Det valda intervallet byts inte, så att
    // exporten inte tyst visar något annat än skärmen. På skärmen syns allt (kTroskel() är 1, ADR-51).
    const kurvaUtelamnad = vm.kurvaUtelamnad;
    const kurvNot = kurvaUtelamnad
        ? `BAS ${result.fixBas} är valt. Lönekurvan visas inte här: intervallet har färre än ${kTroskel()} ${personOrd(kTroskel())}, och dess lönenivå skulle kunna peka ut enskilda. Personerna ingår fortfarande i modellen. Välj ett intervall med minst ${kTroskel()} ${personOrd(kTroskel())} för att se kurvan.`
        : '';

    // ====== Modelljämförelse: vad livscykelmodellen tillför utöver huvudmodellen (justerat R²) ======
    // Står som en mening i tolkningen; talen finns i tabellen längst ned.
    const { adjR2Delta, mervarde: modelMervarde } = vm;
    const modellMening = adjR2Delta != null
        ? (svTecken(adjR2Delta, 1)
            ? ` Jämfört med huvudmodellen i Lönestruktur förklarar livscykelmodellen ${svTal(adjR2Delta, 1)} procentenheter mer av lönespridningen (${modelMervarde === 'stor' ? 'ett stort' : modelMervarde === 'måttlig' ? 'ett måttligt' : 'ett litet'} tillägg${modelMervarde === 'liten' ? '; den enklare modellen räcker' : ''}).`
            : ` Jämfört med huvudmodellen i Lönestruktur förklarar livscykelmodellen inte mer av lönespridningen (${svTal(adjR2Delta, 1)} procentenheter); den enklare modellen räcker.`)
        : '';

    // ====== B7: Regelbaserad HR-coach ======
    const interaktionSig = vm.samspel;
    const coachKategori = vm.monster;
    let coachRubrik, coachText;
    if (coachKategori === 'konstant') {
        coachRubrik = 'Samma skillnad över karriären';
        coachText = `Skillnaden ändras <strong>inte säkert</strong> med åldern (p<sub>kön×ålder</sub> ${pLika(result.kvAgePVal)}, p<sub>kön×ålder²</sub> ${pLika(result.kvAge2PVal)}). Förändringen i rutan bredvid är därför inte säkerställd. <strong>Att utforska:</strong> lägg kraften på de strukturella analyserna (${T.niva.fl}, likvärdigt arbete) snarare än på karriären.`;
    } else if (coachKategori === 'växande') {
        coachRubrik = 'Skillnaden växer med åldern';
        coachText = `Skillnaden är större i de högre åldrarna än i de lägre: kvinnors lön mot mäns ${result.gapDelta < 0 ? 'sjunker' : 'stiger'} med ${svTal(Math.abs(result.gapDelta), 1)} procentenheter mellan ${result.alderFran} och ${result.alderTill} år. Kurvorna är ett tvärsnitt och visar inte orsaken, men hypoteser att pröva är (1) <strong>föräldraledighet</strong> vars effekt samlas över karriären, (2) <strong>långsammare karriärväg</strong> för ${result.gapTill < 0 ? 'kvinnor' : 'män'} — färre steg till högre BAS, (3) <strong>lönerevisioner som slår olika</strong> år efter år. <strong>Att utforska:</strong> granska löneöversynernas utfall per kön i organisationens egna system (verktyget analyserar en kartläggning i taget), kontrollera befordringar per ${T.niva.en}, undersök om föräldralediga får samma lönelyft som heltidsarbetande.`;
    } else if (coachKategori === 'krympande') {
        coachRubrik = 'Skillnaden krymper med åldern';
        coachText = `Skillnaden är mindre i de högre åldrarna än i de lägre: kvinnors lön mot mäns ${result.gapDelta < 0 ? 'sjunker' : 'stiger'} med ${svTal(Math.abs(result.gapDelta), 1)} procentenheter mellan ${result.alderFran} och ${result.alderTill} år. Kurvorna är ett tvärsnitt och visar inte orsaken, men en hypotes att pröva är att <strong>skillnaden uppstår vid rekryteringen</strong>: kvinnor och män börjar med olika ingångslöner och ligger närmare varandra i de äldre grupperna. <strong>Att utforska:</strong> granska ingångslöner per kön och BAS, undersök rekryteringsprocessen, kontrollera lönesättningen för nyanställda.`;
    } else {
        coachRubrik = 'Skillnaden är i praktiken densamma';
        coachText = `Löneskillnaden ändras med åldern (p under 0,10), men lite: ${svTecken(result.gapDelta, 1)}${svTal(result.gapDelta, 1)} procentenheter. I praktiken är skillnaden densamma över karriären. <strong>Att utforska:</strong> behandla den som en strukturell skillnad och arbeta med huvudregressionen och ${T.niva.bfl}, inte med insatser för karriären.`;
    }

    coachText += modellMening;
    // Slutsatsens rand följer samma regel (ADR-71): rand i statusfärg bara när skillnaden växer eller krymper. Båda
    // konstanta lägena står utan rand, som förändringen bredvid står i neutral färg: "densamma" är inte "balanserat".

    // Förändringen mellan spannets ändar färgas på prövningen, inte på storleken (ADR-71): varningsfärg när samspelet mellan kön
    // och ålder är säkerställt (interaktionSig, samma gräns som tolkningen och rutan bredvid), annars neutral. Inte
    // grön: "inte säkerställd" är inte "balanserat". Ordet står i verktygstipset och för skärmläsaren (WCAG 1.4.1).
    const forandringOrd = interaktionSig ? 'säkerställd förändring' : 'inte säkerställd';
    const forandring = `<div class="fs-xl fw-700 ${interaktionSig ? 'farg-varning' : 'farg-dampad'}" title="${forandringOrd}">${result.gapDelta >= 0 ? '+' : ''}${svTal(result.gapDelta, 1)}</div>
                <span class="sr-only">${forandringOrd}</span>`;

    // ====== UI ======
    // Ett byte i BAS-väljaren ritar om rutan: fokus står kvar på väljaren (behallFokus).
    behallFokus(wrap, () => { wrap.innerHTML = `
        <!-- B5: KPI:er + signifikanstest -->
        <div class="summary-stats">
            <div class="stat-box">
                <div class="stat-etikett fs-xs marg-0-0-4">Kvinnors lön i % av mäns, ${result.alderFran} år</div>
                ${nyckeltal(result.nivaFran, kvotFran)}
                <div class="stat-under">när nivå räknats bort, enligt modellen</div>
            </div>
            <div class="stat-box">
                <div class="stat-etikett fs-xs marg-0-0-4">Kvinnors lön i % av mäns, ${result.alderTill} år</div>
                ${nyckeltal(result.nivaTill, kvotTill)}
                <div class="stat-under">när nivå räknats bort, enligt modellen</div>
            </div>
            <div class="stat-box" title="Förändringen i kvinnors lön i % av mäns mellan ${result.alderFran} och ${result.alderTill} år, enligt modellen">
                <div class="stat-etikett fs-xs marg-0-0-4">Förändring ${result.alderFran}–${result.alderTill} år, procentenheter</div>
                ${forandring}
                <div class="stat-under">minus: kvinnorna halkar efter</div>
            </div>
            <div class="stat-box" title="Test av om skillnaden förändras med åldern (kön×ålder). Vid p ≥ 0,10 är förändringen inte säkerställd.">
                <div class="stat-etikett fs-xs marg-0-0-4">Är förändringen säkerställd?</div>
                <div class="livscykel-provning fs-sm lh-1_5">
                    Linjär: p ${pLika(result.kvAgePVal)}, ${sakerOrd(result.kvAgePVal)}<br>
                    Kvadratisk: p ${pLika(result.kvAge2PVal)}, ${sakerOrd(result.kvAge2PVal)}
                </div>
            </div>
        </div>
        <p class="livscykel-kvot-not text-dampad-sm lh-1_5 marg-0-0-14">${kvotMening}</p>

        <!-- B7: HR-coach baserad på mönster -->
        <div class="card mb-14${coachKategori === 'växande' ? ' ram-v-3-kritisk' : coachKategori === 'krympande' ? ' ram-v-3-varning' : ''}">
            <h3 class="fs-lg marg-0-0-8">${coachRubrik}</h3>
            <p class="fs-md lh-1_6 marg-0">${coachText}</p>
        </div>

        <!-- BAS-dropdown + kurva -->
        <div class="card mb-14">
            <div class="rad-bryt-mitt gap-14 marg-b-8">
                <label for="lifecycle-bas-select" class="fs-sm fw-600">Visa lönekurvor för ${T.niva.en}:</label>
                <select id="lifecycle-bas-select" class="form-select pad-6-12 bredd-auto">${basOptions}</select>
            </div>
            <div id="lifecycle-chart"></div>${kurvNot ? `
            <p class="k-mask-note" role="note">${esc(kurvNot)}</p>` : ''}
            <p class="livscykel-kohort-not text-dampad-xs lh-1_5 marg-8-0-0">${esc(KOHORT_FORBEHALL)}</p>
        </div>

        <!-- B4: Översiktstabell — gap-utveckling per BAS -->
        <details class="mb-14" id="livscykel-bas-tabell">
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Modellens lönenivåer per ${T.niva.en} vid ${result.alderFran} och ${result.alderTill} år
            </summary>
            <div class="pad-10-0">
                <table class="data-table st-088">
                    <thead>
                        <tr>
                            <th>BAS</th>
                            <th class="t-hoger" title="Antal personer i organisationens ${T.niva.en}">n</th>
                            <th class="t-hoger">Kvinna ${result.alderFran} år</th>
                            <th class="t-hoger">Man ${result.alderFran} år</th>
                            <th class="t-hoger" title="Kvinnors modellön minus mäns vid ${result.alderFran} år, för ${T.niva.bf}; negativt när kvinnor ligger lägre">Skillnad ${result.alderFran} år (kr)</th>
                            <th class="t-hoger">Kvinna ${result.alderTill} år</th>
                            <th class="t-hoger">Man ${result.alderTill} år</th>
                            <th class="t-hoger" title="Kvinnors modellön minus mäns vid ${result.alderTill} år; negativt när kvinnor ligger lägre">Skillnad ${result.alderTill} år (kr)</th>
                            <th class="t-mitt">Beräkning</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${basVisade.map((r) => `
                            <tr${r.bas === result.fixBas ? ' class="bg-ok-yta"' : ''}>
                                <td><strong>${esc(r.bas)}</strong>${r.bas === result.fixBas ? ' <small class="f-dampad">(visad)</small>' : ''}</td>
                                <td class="t-hoger">${r.n}</td>
                                <td class="t-hoger">${svKr(r.kvFran)}</td>
                                <td class="t-hoger">${svKr(r.maFran)}</td>
                                <td class="t-hoger halvfet">${svKr(r.gapFranKr)}</td>
                                <td class="t-hoger">${svKr(r.kvTill)}</td>
                                <td class="t-hoger">${svKr(r.maTill)}</td>
                                <td class="t-hoger halvfet">${svKr(r.gapTillKr)}</td>
                                <td class="t-mitt"><button class="btn-evidence" type="button" data-livscykel-bas="${esc(r.bas)}" title="Visa beräkningen för BAS ${esc(r.bas)}" aria-label="Visa beräkningen för BAS ${esc(r.bas)}">${ikon('sok')}</button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
                ${kMaskNot(basUtelamnade, `${T.niva.en}|${T.niva.fl}`)}
                <p class="text-dampad-xs lh-1_5 marg-10-0-0">
                    <em>Talen är modellens lönenivåer, inte uppmätta medianer: kurvan räknas för det visade intervallet (${esc(result.fixBas)}) och övriga intervall får sin nivå ur modellens egna BAS-koefficienter. Skillnaden i procent, kvinnor mot män (${svPct(result.gapFran, 1)} vid ${result.alderFran} år, ${svPct(result.gapTill, 1)} vid ${result.alderTill}), är densamma för alla intervall i modellen; kronorna skiljer eftersom lönenivåerna skiljer.</em>
                </p>
            </div>
        </details>

        <!-- B6: Detaljerad modelljämförelse -->
        <details class="mb-14" id="livscykel-modelljamforelse">
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Modelljämförelse: huvudmodell mot livscykelmodell
            </summary>
            <div class="pad-10-0">
                <table class="data-table fs-sm">${modellCaption}
                    <thead>
                        <tr>
                            <th>Mått</th>
                            <th>Huvudmodell (${h && primary.fras ? esc(primary.fras) : h ? 'bara kön' : 'kunde inte skattas'})</th>
                            <th>Livscykelmodell (BAS-indikatorer, ålder² + interaktioner)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><strong>Antal personer</strong></td><td>${h ? h.n : '—'}</td><td>${result.n}</td></tr>
                        <tr><td><strong>Förklarad del av lönespridningen (justerat R²)</strong></td><td>${h && h.adjR2 != null ? svPct((h.adjR2*100), 1) : '—'}</td><td>${svPct((result.adjR2*100), 1)}</td></tr>
                        <tr><td><strong>Löneskillnad kvinnor mot män</strong></td><td>${h && h.gapPct != null ? (h.gapPct >= 0 ? '+' : '') + svPct(h.gapPct, 1) : '—'}</td><td>${vm.livscykelGapPct >= 0 ? '+' : ''}${svPct(vm.livscykelGapPct, 1)} (vid medelåldern ${Math.round(result.ageMean)} år)</td></tr>
                        <tr><td><strong>Kön — p-värde</strong></td><td>${h && h.p != null ? (h.p < 0.001 ? '< 0,001' : svTal(h.p, 3)) : '—'} ${h && h.p != null ? sigBadge(h.p) : ''}</td><td>${pText(result.kvPValue)} ${sigBadge(result.kvPValue)}</td></tr>
                        <tr><td><strong>Kön×ålder — p-värde</strong></td><td><em class="f-dampad">ej i modellen</em></td><td>${result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 3)} ${sigBadge(result.kvAgePVal)}</td></tr>
                        <tr><td><strong>Kön×ålder² — p-värde</strong></td><td><em class="f-dampad">ej i modellen</em></td><td>${result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 3)} ${sigBadge(result.kvAge2PVal)}</td></tr>
                    </tbody>
                </table>
                <p class="livscykel-stjarnor text-dampad-xs lh-1_5 marg-10-0-0">
                    Stjärnorna visar hur säkert resultatet är: * p &lt; 0,05, ** p &lt; 0,01, *** p &lt; 0,001. Utan stjärna är p minst 0,05.
                </p>
                <p class="text-dampad-xs lh-1_5 marg-6-0-0">
                    <strong>Tolkningsregel:</strong> Är kön×ålder inte säkerställd (p ≥ 0,10) räcker huvudmodellen. Är den säkerställd döljer huvudmodellens enda tal att skillnaden varierar med åldern, och livscykelmodellen ger en mer fullständig bild.
                </p>
            </div>
        </details>

        <p class="livscykel-modell-not text-dampad-xs lh-1_5 marg-t-10">
            Modellen bygger på ${svTal(result.n, 0)} personer och tar hänsyn till kön, ålder, åldern i kvadrat (att lönen planar ut sent i karriären), samspelet mellan kön och ålder, och ${T.niva.en}. De skuggade banden runt kurvorna visar osäkerheten. Detaljerna står under <em>Så räknas det</em> längst ned i fliken, i <em>Beräkning &amp; urval</em>.
        </p>
    `; });

    // Modellformeln och de statistiska detaljerna står i flikens beräkningspanel (Så räknas det), inte i löptexten.
    const baseL = byggGrundurval();
    const utanfor = Math.max(0, baseL.afterFilter - result.n);
    sattMetodik('livscykel', {
        title: 'Ålder & karriär — livscykelmodellen',
        ...baseL,
        usedInAnalysis: result.n,
        analysisExclusions: utanfor > 0 ? [['Saknar ålder eller kön', utanfor]] : [],
        formler: [
            ['Modell', '<code>log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)</code>, skattad med minsta kvadratmetoden'],
            ['Standardfel', 'HC3-robusta standardfel (tål att lönespridningen skiljer mellan grupper)'],
            [stor(T.niva.en), `Indikatorvariabler; i kodningen är BAS ${esc(result.refBas)} referensintervall. Kurvan visas för det valda intervallet (${esc(result.fixBas)}), övriga intervall får sin nivå ur sin BAS-koefficient${kurvaUtelamnad ? `. Här visas ingen kurva: det valda intervallet har färre än ${kTroskel()} ${personOrd(kTroskel())}` : ''}`],
            ['Skillnad kvinnor mot män', '<code>(exp(skillnaden på log-skalan) − 1) × 100</code> vid varje ålder; kvinnors lön i % av mäns är 100 plus skillnaden'],
            ['Skuggade band', '95 % konfidensintervall för den predicerade lönen'],
            ['Säkerställd förändring', 'Kön×ålder eller kön×ålder² med p under 0,10 (tolkningsregeln). Stjärnorna i modelljämförelsen: * p under 0,05, ** p under 0,01, *** p under 0,001']
        ],
        notes: [
            `Modellen räknas på hela underlaget, inte på flikens urval av ${T.niva.fl}`,
            esc(KOHORT_FORBEHALL)
        ]
    });

    // Cache result + basRows på state för bevis-handlern
    // Huvudregressionen sparas inte (ADR-17).
    state._lifecycleCache = { result, basRows: vm.basRader };

    // Rita diagrammet efter DOM-uppdatering
    // I exportläget (ADR-51) ritas figuren direkt: exportgrinden läser den i samma varv som fliken ritas om.
    // Ritningen på skärmen väntar en bildruta och ritar bara i behållaren den gällde: har fliken hunnit ritas om
    // (i exportläget, där kurvan kan vara utelämnad) ritas ingenting.
    const behallare = document.getElementById('lifecycle-chart');
    if (kurvaUtelamnad || !behallare) { /* ingen figur: noten står i stället */ }
    else if (iExportLage()) _ritaLivscykelDiagram(result, behallare);
    else requestAnimationFrame(() => { if (behallare.isConnected) _ritaLivscykelDiagram(result, behallare); });

    // Koppla BAS-dropdown
    const sel = document.getElementById('lifecycle-bas-select');
    if (sel) sel.addEventListener('change', () => {
        _livscykelValdBas = /** @type {HTMLInputElement} */ (sel).value;
        ritaLivscykel();
    });

    // B8: Bevis-popup per BAS-rad
    wrap.querySelectorAll('.btn-evidence[data-livscykel-bas]').forEach(btn => {
        btn.addEventListener('click', () => {
            const bas = /** @type {HTMLElement} */ (btn).dataset.livscykelBas;
            const row = (state._lifecycleCache?.basRows || []).find(r => r.bas === bas);
            if (!row) return;
            if (kMaskerad(row.n)) return;   // Minsta gruppstorlek: knappen ritas inte för
                                            // maskerade BAS, men vägen stängs även här
            const c = state._lifecycleCache;
            _oppnaBevisruta(_bevisForLivscykelBas(row, c.result, livscykelKurvaUtelamnad(c.result, c.basRows, kTroskel())));
        });
    });
}

/**
 * Bygger bevis-payload för en BAS-rad i livscykelöversikten. `utanKurva`: kurvan för det valda intervallet visas
 * inte (`livscykelKurvaUtelamnad`); då skrivs ingen nivåfaktor mot det, eftersom raden delad med faktorn är det
 * intervallets lönenivå.
 */
function _bevisForLivscykelBas(row, result, utanKurva = false) {
    const fmtKr = v => svKr(v, '—');
    const fmtPct = v => v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + svPct(v, 1);
    return {
        title: `Beräkningen — BAS ${row.bas} (ålder och karriär)`,
        intro: `Predikterade lönenivåer från livscykelmodellen för BAS <strong>${esc(row.bas)}</strong>. Modellen är global (en regression över alla BAS samtidigt); nivån per BAS kommer ur modellens egen BAS-koefficient.`,
        rows: [
            { label: stor(T.niva.en),                  value: row.bas },
            { label: 'Antal personer i BAS (organisation)',  value: row.n.toLocaleString('sv-SE') },
            { label: `${stor(adjektiv('visad', T.niva))} ${T.niva.en}`, value: result.fixBas, note: 'Intervallet som lönekurvan räknas för direkt. Övriga intervall får sin nivå ur sin BAS-koefficient.' },
            utanKurva
                ? { label: 'Nivåfaktor mot visat intervall',    value: '—', note: `Visas inte: kurvan för BAS ${result.fixBas} visas inte, eftersom intervallet har färre än ${kTroskel()} ${personOrd(kTroskel())}.` }
                : { label: 'Nivåfaktor mot visat intervall',    value: result.basFaktor?.[row.bas] != null ? svTal(result.basFaktor[row.bas], 3) : '—', note: 'exp(β_BAS − β_visat); 1,000 för det visade intervallet.' },
            { label: `— Predikterad lön vid ${result.alderFran} år`,         value: '' },
            { label: 'Kvinna',                              value: fmtKr(row.kvFran) },
            { label: 'Man',                                  value: fmtKr(row.maFran) },
            { label: 'Skillnad, kvinnor mot män (kr)',      value: fmtKr(row.gapFranKr), note: `I procent: ${fmtPct(row.gapFranPct)}` },
            { label: `— Predikterad lön vid ${result.alderTill} år`,         value: '' },
            { label: 'Kvinna',                              value: fmtKr(row.kvTill) },
            { label: 'Man',                                  value: fmtKr(row.maTill) },
            { label: 'Skillnad, kvinnor mot män (kr)',      value: fmtKr(row.gapTillKr), note: `I procent: ${fmtPct(row.gapTillPct)}` },
            { label: '— Modellstatistik',                   value: '' },
            { label: 'Kön×ålder (linjär) p-värde',          value: result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 4) },
            { label: 'Kön×ålder² (kvadratisk) p-värde',     value: result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 4) },
            { label: `Förändring ${result.alderFran}–${result.alderTill} år`,                     value: (result.gapDelta >= 0 ? '+' : '') + svTal(result.gapDelta, 2) + ' procentenheter', note: 'Kvinnors lön mot mäns; minus betyder att kvinnorna halkar efter.' }
        ],
        formula: `<strong>Beräkning av predikterad lön per BAS:</strong><br>
            För referens-BAS "${esc(result.fixBas)}" beräknas direkt från modellen:<br>
            ln(lön) = β₀ + β_kön·isKv + β_ålder·(ålder−medel) + β_ålder²·(ålder−medel)² + β_kön×ålder·... + Σβ_BAS·dummies<br><br>
            För andra BAS ger modellens BAS-koefficient nivån:<br>
            lön(BAS) = lön(${esc(result.fixBas)}) × <em>exp(β_BAS − β_${esc(result.fixBas)})</em><br><br>
            <em>Obs! Modellen är additiv: ${T.niva.bf} påverkar lönenivån men inte hur skillnaden utvecklas. Därför är skillnaden i procent densamma i alla ${T.niva.fl}, medan beloppet i kronor skiljer eftersom lönenivåerna skiljer.</em>`,
        footer: `Livscykelmodellen låter skillnaden variera med åldern (via samspelet mellan kön och ålder). Är samspelet inte signifikant (p minst 0,10) är skillnaden i praktiken densamma, och då räcker huvudregressionen. Är det signifikant behöver du överväga åtgärder som rör karriären.`
    };
}

/**
 * Ritar livscykelanalysens diagram med diagramkärnan (ADR-39): två kurvor med 95 % KI som band.
 * Bandens gränser finns därmed i exporterad diagramdata.
 */
function _ritaLivscykelDiagram(r, el) {
    ritaFigur(el || 'lifecycle-chart', _livscykelFigur(r), { hojd: 380 });
}

function _livscykelFigur(r) {
    const band = (serie, farg, pred) => ({ marke: 'band', serie, farg, opacitet: 0.18, legend: false, data: pred.map(p => ({ x: p.age, lag: p.lo, hog: p.hi })) });
    const kurva = (serie, kon, farg, pred, streck) => ({ marke: 'linje', serie, farg, tjocklek: 3, streck, data: pred.map(p => ({ x: p.age, y: p.lon })),
        tips: d => [[`${kon}, ${d.x} år`], ['Predikterad lön', talformat(d.y, 'kr')]] });
    return { beskrivning: `Predikterade lönekurvor för kvinnor och män, kvinnor ${r.predKvinna[0].age}–${r.predKvinna[r.predKvinna.length - 1].age} år och män ${r.predMan[0].age}–${r.predMan[r.predMan.length - 1].age} år (underlagets åldrar), vid BAS ${r.fixBas} (valt intervall). ` +
            `Vid ${r.alderFran} år är skillnaden, kvinnor mot män, ${svTal(r.gapFran, 1)} procent, vid ${r.alderTill} år ${svTal(r.gapTill, 1)} procent. Skuggade band visar 95 % konfidensintervall.`,
        x: { skala: 'linjar', titel: `Ålder — predikterad lönekurva för BAS ${r.fixBas} (valt intervall)` },
        y: { skala: 'linjar', titel: 'Predikterad månadslön (kr)', format: 'kr' },
        lager: [band('Kvinna 95 % KI', PALETT.kon.kvinna, r.predKvinna), band('Man 95 % KI', PALETT.kon.man, r.predMan),
                kurva('Kvinna (predikterad lön)', 'Kvinna', PALETT.kon.kvinna, r.predKvinna, 'hel'),
                kurva('Man (predikterad lön)', 'Man', PALETT.kon.man, r.predMan, 'streckad')] };
}

/**
 * Sekundär livscykelanalys (utökad modell):
 *   log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)
 * Kvadratisk åldersterm (lönen planar ut sent i karriären) och samspel mellan kön och ålder (skillnaden kan växa eller
 * krympa med åldern). Ger { error } eller resultatet med prediktionspunkter och 95 % KI.
 * @param {string|null} [fixBas] BAS-intervall att fixera vid; null = det mest folkrika
 */
export function korLivscykelregression(fixBas) {
    // Modellen (designmatris, OLS, HC3, prediktioner) ligger i src/lib/livscykel.js (ADR-98).
    return livscykelRegression(hamtaData(), { fixBas, golv: statGolv() });
}
