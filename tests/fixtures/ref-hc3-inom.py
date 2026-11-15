# SPDX-License-Identifier: MIT
# Copyright 2026 Felix Jansson
"""
Räknar referensvärdena för HC3 i huvudregressionen med AID-etikett inom BAS (ADR-77) på den FULLA designen,
med en indikator per grupp, och skriver ut dem. Värdena är inskrivna som konstanter i tests/stat-referens.test.js.

    python3 -I tests/fixtures/ref-hc3-inom.py

Designen: raderna i tests/fixtures/stat-referens.json, med yrket satt som i testet: rad 0 får ett eget yrke (en
grupp med en person), rad 4 och 5 (båda BAS D, kvinnor) ett gemensamt (en grupp med två personer), övriga rader
yrke efter radindex (jämnt/udda). Gruppen är yrke|BAS. X = [kvinna, ålder − medel, en indikator per grupp], utan
intercept (indikatorerna spänner det), y = log(lön).

  - HC3: V = (X'X)⁻¹ X' diag(e_i² / (1 − h_i)²) X (X'X)⁻¹, h_i diagonalen i X(X'X)⁻¹X'; vikten sätts till 0 när
    (1 − h_i)² ≤ 1e-12 (en ensam person i en grupp, h = 1, e = 0), som i fitOLS. Det är statsmodels cov_HC3 och R
    sandwich::vcovHC(type = "HC3") på samma design.
  - Klassisk: σ² (X'X)⁻¹ med σ² = RSS / (n − k), k = antalet kolumner.
Räknas med numpy. Finns statsmodels räknas samma kovarianser också med statsmodels.OLS och jämförs.
Behöver INTE köras i CI.
"""
import json, os, sys
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
fx = json.load(open(os.path.join(here, 'stat-referens.json')))
rows = fx['rows']


def yrke(i):
    if i == 0:
        return '300 Yrke tre'
    if i in (4, 5):
        return '400 Yrke fyra'
    return '100 Yrke ett' if i % 2 == 0 else '200 Yrke två'


y = np.log([r['lon'] for r in rows])
kv = np.array([1.0 if r['kon'] == 'kvinna' else 0.0 for r in rows])
alder = np.array([r['alder'] for r in rows], float)
ageC = alder - alder.mean()
grupp = [f"{yrke(i)}|{r['bas']}" for i, r in enumerate(rows)]
grupper = sorted(set(grupp))
D = np.array([[1.0 if g == G else 0.0 for G in grupper] for g in grupp])
X = np.column_stack([kv, ageC, D])
n, k = X.shape

XtXi = np.linalg.inv(X.T @ X)
beta = XtXi @ X.T @ y
e = y - X @ beta
h = np.einsum('ij,jk,ik->i', X, XtXi, X)
w = np.where((1 - h) ** 2 > 1e-12, e ** 2 / (1 - h) ** 2, 0.0)
V = XtXi @ (X.T * w) @ X @ XtXi
Vc = XtXi * (e @ e) / (n - k)

ut = {
    'n': n, 'k': k, 'grupper': len(grupper), 'hHoga': int((h > 0.99).sum()), 'hMax': float(h.max()),
    'betaKon': float(beta[0]), 'betaAlder': float(beta[1]),
    'seKonHC3': float(np.sqrt(V[0, 0])), 'seAlderHC3': float(np.sqrt(V[1, 1])),
    'seKonKlassisk': float(np.sqrt(Vc[0, 0])),
}
try:
    import statsmodels.api as sm
    f = sm.OLS(y, X).fit()
    for a, b in ((np.asarray(f.cov_HC3), V), (np.asarray(f.cov_params()), Vc)):
        assert np.allclose(a[:2, :2], b[:2, :2], rtol=1e-10, atol=0), 'statsmodels avviker'
    ut['statsmodels'] = sm.__version__ if hasattr(sm, '__version__') else 'ja'
except ImportError:
    ut['statsmodels'] = None
ut['numpy'] = np.__version__
ut['python'] = sys.version.split()[0]
print(json.dumps(ut, indent=1, ensure_ascii=False))
