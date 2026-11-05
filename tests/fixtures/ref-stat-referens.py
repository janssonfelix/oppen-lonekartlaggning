# SPDX-License-Identifier: MIT
# Copyright 2026 Felix Jansson
"""
Räknar referensvärden för tests/fixtures/stat-referens.json med etablerade
implementationer och skriver tests/fixtures/stat-referens-varden.json.

    python3 -I tests/fixtures/ref-stat-referens.py

Kördes 2026-10-16 med statsmodels 0.15.0, scipy 1.18.1, numpy 2.x (Python 3.14); Oaxaca-delen om 2026-10-29
med BAS som indikatorer och 2026-11-05 med de valbara modellerna (ADR-56; versioner nedan i utskriften).
Behöver INTE köras i CI — resultatet är incheckat som fixtur.

  - OLS: statsmodels.OLS; klassisk vcov = cov_params(), HC3 = cov_HC3
    (samma som R: sandwich::vcovHC(fit, type = "HC3")).
  - t-fördelning: scipy.stats.t.cdf.
  - Kvantilregression: EXAKT minimering av check-förlusten som linjärt program
    (scipy.optimize.linprog, HiGHS) — samma lösning som R quantreg::rq(method="br").
    statsmodels QuantReg (IRLS) räknas också, som kontroll av LP-lösningen.
  - Blinder-Oaxaca: två OLS (kvinnor, män) på [1, ålderC, en indikator per BAS utom referensen] (ADR-53) och
    komponenterna endowment/coefficient/interaction enligt formeln i runBlinderOaxaca.
"""
import json, os
import numpy as np
import statsmodels.api as sm
from scipy import stats
from scipy.optimize import linprog

here = os.path.dirname(os.path.abspath(__file__))
fx = json.load(open(os.path.join(here, 'stat-referens.json')))
d = fx['design']
y = np.array([r['y'] for r in d])
kv = np.array([r['kv'] for r in d], float)
ageC = np.array([r['alderC'] for r in d])
basC = np.array([r['basC'] for r in d])
X = np.column_stack([np.ones(len(y)), kv, ageC, basC])

def ols(Xm, ym):
    f = sm.OLS(ym, Xm).fit()
    return {
        'beta': f.params.tolist(),
        'vcovClassic': np.asarray(f.cov_params()).tolist(),
        'vcovHC3': np.asarray(f.cov_HC3).tolist(),
        'R2': float(f.rsquared), 'adjR2': float(f.rsquared_adj),
        'rss': float(f.ssr), 'sigma2': float(f.mse_resid),
        'seHC3': np.sqrt(np.diag(f.cov_HC3)).tolist(),
    }

full = ols(X, y)
# p-värde för könskoefficienten som verktyget räknar det: t = β/SE_HC3, df = n−k.
n, k = X.shape
tKon = full['beta'][1] / full['seHC3'][1]
full['tKon'] = float(tKon)
full['pKon'] = float(2 * stats.t.sf(abs(tKon), n - k))

def rq(Xm, ym, tau):
    """min Σ ρ_τ(y − Xβ) som LP: variabler [β⁺, β⁻, u, v] ≥ 0, y = Xβ + u − v."""
    n, p = Xm.shape
    c = np.concatenate([np.zeros(2 * p), tau * np.ones(n), (1 - tau) * np.ones(n)])
    Aeq = np.hstack([Xm, -Xm, np.eye(n), -np.eye(n)])
    res = linprog(c, A_eq=Aeq, b_eq=ym, bounds=[(0, None)] * (2 * p + 2 * n), method='highs')
    assert res.status == 0, res.message
    beta = res.x[:p] - res.x[p:2 * p]
    return beta.tolist(), float(res.fun)

quant = {}
for tau in (0.1, 0.5, 0.9):
    beta, loss = rq(X, y, tau)
    smq = sm.QuantReg(y, X).fit(q=tau, max_iter=5000, p_tol=1e-10)
    quant[str(tau)] = {'beta': beta, 'loss': loss, 'statsmodelsBeta': smq.params.tolist()}

# Sekventiell dekomponering (samma steg som _computeSequentialGap).
seq = {
    'endastKon': ols(X[:, :2], y)['beta'],
    'plusBas': ols(np.column_stack([X[:, :2], basC]), y)['beta'],
    'plusAlder': full['beta'],
}

# Blinder-Oaxaca (ADR-53, ADR-56): två OLS (kvinnor, män) på [1, (ålderC), en indikator per grupp utom referensen];
# referens = alfabetiskt första gruppen som finns hos båda könen; en grupp som saknas hos ett kön får β = 0 i det
# könets ekvation (kolumnen lämnas utanför skattningen). Gruppen är BAS (kolumn 'bas') eller yrkesgrupp inom BAS
# (kolumn 'yrke': yrke härlett ur radindex, samma regel som i tests/stat-referens.test.js, nyckel yrke|bas).
rows = fx['rows']
mK = np.array([r['kon'] == 'kvinna' for r in rows]); mM = ~mK
def yrke_av(i):
    return '100 Yrke ett' if i % 2 == 0 else '200 Yrke två'
def oaxaca(med_alder, grupp):
    """grupp: None (ingen gruppindikator), 'bas' eller 'yrke'."""
    if grupp == 'bas':
        g_rad = np.array([r['bas'] for r in rows])
    elif grupp == 'yrke':
        g_rad = np.array([f"{yrke_av(i)}|{r['bas']}" for i, r in enumerate(rows)])
    else:
        g_rad = None
    if g_rad is not None:
        alla = sorted(set(g_rad))
        gK = set(g_rad[mK]); gM = set(g_rad[mM])
        ref = next(b for b in alla if b in gK and b in gM)
        ind = [b for b in alla if b != ref]
    else:
        alla, ref, ind, gK, gM = [], None, [], set(), set()
    def grupp_fit(mask, finns):
        kol = [b for b in ind if b in finns]
        cols = [np.ones(mask.sum())] + ([ageC[mask]] if med_alder else []) + [(g_rad[mask] == b).astype(float) for b in kol]
        Xg = np.column_stack(cols)
        beta = np.asarray(ols(Xg, y[mask])['beta'])
        bas0 = 2 if med_alder else 1
        full_b = list(beta[:bas0]) + [beta[bas0 + kol.index(b)] if b in kol else 0.0 for b in ind]
        xbar = [1.0] + ([float(ageC[mask].mean())] if med_alder else []) + [float((g_rad[mask] == b).mean()) for b in ind]
        return np.array(full_b), np.array(xbar)
    bK, xK = grupp_fit(mK, gK); bM, xM = grupp_fit(mM, gM)
    dx, db = xM - xK, bM - bK
    q, u, i_ = dx * bK, xK * db, dx * db
    lab = ['intercept'] + (['age'] if med_alder else []) + [grupp] * len(ind)
    per = {k: {'q': 0.0, 'u': 0.0, 'i': 0.0} for k in dict.fromkeys(lab)}
    for j, k in enumerate(lab):
        per[k]['q'] += float(q[j]); per[k]['u'] += float(u[j]); per[k]['i'] += float(i_[j])
    return {
        'basRef': ref, 'basIndikatorer': ind,
        'betaKv': bK.tolist(), 'betaMa': bM.tolist(), 'xKv': xK.tolist(), 'xMa': xM.tolist(),
        'rawGapLog': float(xM @ bM - xK @ bK),
        'q': float(q.sum()), 'u': float(u.sum()), 'i': float(i_.sum()),
        'perKomponent': per,
        'nKv': int(mK.sum()), 'nMa': int(mM.sum()),
    }
bo = oaxaca(True, 'bas')                 # standardmodellen (ADR-53): ålder + BAS
bo_bas = oaxaca(False, 'bas')            # bara BAS
bo_alder = oaxaca(True, None)            # bara ålder
bo_yrke = oaxaca(True, 'yrke')           # ålder + yrkesgrupp inom BAS

# t-fördelningens CDF och tvåsidiga p-värden vid de df verktyget använder.
tgrid = [0.5, 1.0, 1.5, 2.0, 2.056, 2.5, 3.0, 4.0]
tcdf = {str(df): {str(t): float(stats.t.cdf(t, df)) for t in tgrid} for df in (5, 10, 26, 99)}

out = {
    '_kommentar': 'Genererad av tests/fixtures/ref-stat-referens.py (statsmodels/scipy). Se docstring för metod.',
    'ols': full, 'quantreg': quant, 'sekventiell': seq, 'blinderOaxaca': bo, 'tcdf': tcdf,
    'blinderOaxacaBas': bo_bas, 'blinderOaxacaAlder': bo_alder, 'blinderOaxacaYrke': bo_yrke,
}
json.dump(out, open(os.path.join(here, 'stat-referens-varden.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'beta': full['beta'], 'seHC3': full['seHC3'], 'pKon': full['pKon'],
                  'rq': {t: v['beta'][1] for t, v in quant.items()},
                  'sm': {t: v['statsmodelsBeta'][1] for t, v in quant.items()}, 'bo': {k: bo[k] for k in ('rawGapLog', 'q', 'u', 'i')}}, indent=1))
