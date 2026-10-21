# SPDX-License-Identifier: MIT
# Copyright 2026 Felix Jansson
"""
Räknar referensvärden för tests/fixtures/stat-referens.json med etablerade
implementationer och skriver tests/fixtures/stat-referens-varden.json.

    python3 -I tests/fixtures/ref-stat-referens.py

Kördes 2026-10-16 med statsmodels 0.15.0, scipy 1.18.1, numpy 2.x (Python 3.14).
Behöver INTE köras i CI — resultatet är incheckat som fixtur.

  - OLS: statsmodels.OLS; klassisk vcov = cov_params(), HC3 = cov_HC3
    (samma som R: sandwich::vcovHC(fit, type = "HC3")).
  - t-fördelning: scipy.stats.t.cdf.
  - Kvantilregression: EXAKT minimering av check-förlusten som linjärt program
    (scipy.optimize.linprog, HiGHS) — samma lösning som R quantreg::rq(method="br").
    statsmodels QuantReg (IRLS) räknas också, som kontroll av LP-lösningen.
  - Blinder-Oaxaca: två OLS (kvinnor, män) på [1, ålderC, basC] och komponenterna
    endowment/coefficient/interaction enligt formeln i runBlinderOaxaca.
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

# Blinder-Oaxaca.
mK, mM = kv == 1, kv == 0
XK = np.column_stack([np.ones(mK.sum()), ageC[mK], basC[mK]])
XM = np.column_stack([np.ones(mM.sum()), ageC[mM], basC[mM]])
bK = np.asarray(ols(XK, y[mK])['beta']); bM = np.asarray(ols(XM, y[mM])['beta'])
xK, xM = XK.mean(0), XM.mean(0)
dx, db = xM - xK, bM - bK
q, u, i_ = dx * bK, xK * db, dx * db
bo = {
    'betaKv': bK.tolist(), 'betaMa': bM.tolist(), 'xKv': xK.tolist(), 'xMa': xM.tolist(),
    'rawGapLog': float(xM @ bM - xK @ bK),
    'q': float(q.sum()), 'u': float(u.sum()), 'i': float(i_.sum()),
    'perKomponent': {lab: {'q': float(q[j]), 'u': float(u[j]), 'i': float(i_[j])} for j, lab in enumerate(['intercept', 'age', 'bas'])},
    'nKv': int(mK.sum()), 'nMa': int(mM.sum()),
}

# t-fördelningens CDF och tvåsidiga p-värden vid de df verktyget använder.
tgrid = [0.5, 1.0, 1.5, 2.0, 2.056, 2.5, 3.0, 4.0]
tcdf = {str(df): {str(t): float(stats.t.cdf(t, df)) for t in tgrid} for df in (5, 10, 26, 99)}

out = {
    '_kommentar': 'Genererad av tests/fixtures/ref-stat-referens.py (statsmodels/scipy). Se docstring för metod.',
    'ols': full, 'quantreg': quant, 'sekventiell': seq, 'blinderOaxaca': bo, 'tcdf': tcdf,
}
json.dump(out, open(os.path.join(here, 'stat-referens-varden.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'beta': full['beta'], 'seHC3': full['seHC3'], 'pKon': full['pKon'],
                  'rq': {t: v['beta'][1] for t, v in quant.items()},
                  'sm': {t: v['statsmodelsBeta'][1] for t, v in quant.items()}, 'bo': {k: bo[k] for k in ('rawGapLog', 'q', 'u', 'i')}}, indent=1))
