# SPDX-License-Identifier: MIT
# Copyright 2026 Felix Jansson
"""
Räknar referensvärdena för HC3 i huvudregressionen med AID-etikett inom BAS (ADR-77) med statsmodels, på designen med
en indikator per grupp, och skriver ut dem. Värdena är inskrivna som konstanter i tests/stat-referens.test.js.

    python3 -I tests/fixtures/ref-hc3-inom.py

Kördes 2026-11-15 med statsmodels 0.15.0, numpy 2.5.4, scipy 1.18.1 (Python 3.14.8; versionerna står också i
utskriften) i en tillfällig venv utanför repot. Behöver INTE köras i CI.

Designen: raderna i tests/fixtures/stat-referens.json, med yrket satt som i testet: rad 0 får ett eget yrke (en
grupp med en person), rad 4 och 5 (båda BAS D, kvinnor) ett gemensamt (en grupp med två personer), övriga rader
yrke efter radindex (jämnt/udda). Gruppen är yrke|BAS. X = [kvinna, ålder − medel, en indikator per grupp], utan
intercept (indikatorerna spänner det), y = log(lön).

  - HC3 och klassisk kovarians: statsmodels.OLS(y, X).fit(), cov_HC3 och cov_params() (cov_HC3 ≡ R
    sandwich::vcovHC(type = "HC3")).
  - En person ensam i en grupp har hävstången h = 1 och residualen 0. statsmodels och R räknar e²/(1 − h)² utan vakt
    och ger då NaN (eller ett tal som bara avrundningen avgör). Verktyget ger raden vikten 0, vilket är detsamma som
    att ta bort den: raden bär bara sin egen gruppnivå. statsmodels räknas därför på designen UTAN enpersonsgrupperna
    (n − 1 rader, k − 1 kolumner, samma df = n − k och samma RSS), och det är de talen som är referensen.
  - Kontroller i skriptet: numpy på hela designen med vikten 0 för h = 1 ger samma kovarianser för lutningarna
    (relativt 1e-10), och hHoga (antalet h > 0,99) räknas på hela designen med statsmodels hat_matrix_diag.
"""
import json, os, sys
import numpy as np
import scipy
import statsmodels
import statsmodels.api as sm

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
ageC = alder - alder.mean()           # medelåldern över alla rader, som i verktyget
grupp = [f"{yrke(i)}|{r['bas']}" for i, r in enumerate(rows)]
grupper = sorted(set(grupp))
D = np.array([[1.0 if g == G else 0.0 for G in grupper] for g in grupp])
X = np.column_stack([kv, ageC, D])
n, k = X.shape

# Hela designen: hävstången (för hHoga) ur statsmodels.
hela = sm.OLS(y, X).fit()
h = hela.get_influence().hat_matrix_diag

# Referensen: designen utan enpersonsgrupperna.
storlek = {G: grupp.count(G) for G in grupper}
behall = np.array([storlek[g] > 1 for g in grupp])
kvar = [j for j, G in enumerate(grupper) if storlek[G] > 1]
Xr = np.column_stack([kv[behall], ageC[behall], D[behall][:, kvar]])
f = sm.OLS(y[behall], Xr).fit()
V, Vc = np.asarray(f.cov_HC3), np.asarray(f.cov_params())
assert f.df_resid == n - k, 'df ska vara desamma som på hela designen'

# Kontroll: numpy på hela designen med vikten 0 när (1 − h)² ≤ 1e-12, som anpassaOLS.
XtXi = np.linalg.inv(X.T @ X)
e = y - X @ (XtXi @ X.T @ y)
hn = np.einsum('ij,jk,ik->i', X, XtXi, X)
w = np.where((1 - hn) ** 2 > 1e-12, e ** 2 / (1 - hn) ** 2, 0.0)
Vn = XtXi @ (X.T * w) @ X @ XtXi
Vcn = XtXi * (e @ e) / (n - k)
assert np.allclose(Vn[:2, :2], V[:2, :2], rtol=1e-10, atol=0), 'numpy med vikten 0 avviker från statsmodels'
assert np.allclose(Vcn[:2, :2], Vc[:2, :2], rtol=1e-10, atol=0), 'klassisk avviker'

ut = {
    'n': n, 'k': k, 'grupper': len(grupper), 'enpersonsgrupper': int(sum(1 for v in storlek.values() if v == 1)),
    'hHoga': int((h > 0.99).sum()),
    'betaKon': float(f.params[0]), 'betaAlder': float(f.params[1]),
    'seKonHC3': float(np.sqrt(V[0, 0])), 'seAlderHC3': float(np.sqrt(V[1, 1])),
    'seKonKlassisk': float(np.sqrt(Vc[0, 0])),
    'statsmodels': statsmodels.__version__, 'numpy': np.__version__, 'scipy': scipy.__version__,
    'python': sys.version.split()[0],
}
print(json.dumps(ut, indent=1, ensure_ascii=False))
