# SPDX-License-Identifier: MIT
# Copyright 2026 Felix Jansson
"""
Räknar referensvärden för bhJustera (src/lib/stat.js) med statsmodels och skriver
tests/fixtures/bh-justera-referens.json.

    python3 -I tests/fixtures/ref-bh-justera.py

Kördes 2026-11-14 med statsmodels 0.15.0, scipy 1.18.1, numpy 2.5.4 (Python 3.14.8; versionerna står också i
utskriften). Behöver INTE köras i CI — resultatet är incheckat som fixtur.

  - Benjamini–Hochberg: statsmodels.stats.multitest.multipletests(p, method='fdr_bh')[1], de justerade p-värdena
    (q-värdena) i indataordningen.
  - p-vektorerna är påhittade och valda för kantfallen: lika p-värden (band), ett enda p-värde, en osorterad vektor
    med tio värden, en där monotoniseringen slår till (p·m/r är inte växande i r) och en med p-värden nära och lika
    med 1.
"""
import json, os, sys
import numpy as np
import scipy
import statsmodels
from statsmodels.stats.multitest import multipletests

here = os.path.dirname(os.path.abspath(__file__))

FALL = {
    'band': [0.01, 0.02, 0.02, 0.03, 0.03, 0.03, 0.5],
    'ett': [0.04],
    'osorterad': [0.27, 0.003, 0.041, 0.62, 0.012, 0.09, 0.0008, 0.33, 0.049, 0.18],
    'monotonisering': [0.01, 0.04, 0.045, 0.046],
    'nara_ett': [1.0, 0.9, 0.95, 0.2],
}

def ra_bh(p):
    """p · m / r i indataordningen, utan monotonisering (r = rang i stigande ordning, band i indataordning)."""
    p = np.asarray(p, float)
    m = len(p)
    ordning = np.argsort(p, kind='stable')
    ra = np.empty(m)
    for r, i in enumerate(ordning, start=1):
        ra[i] = p[i] * m / r
    return ra

ut = {
    'kalla': "statsmodels.stats.multitest.multipletests(p, method='fdr_bh')[1]",
    'versioner': {
        'statsmodels': statsmodels.__version__,
        'scipy': scipy.__version__,
        'numpy': np.__version__,
        'python': sys.version.split()[0],
    },
    'fall': {},
}
for namn, p in FALL.items():
    q = multipletests(p, method='fdr_bh')[1]
    ut['fall'][namn] = {'p': p, 'q': [float(v) for v in q]}

# Kontroll: monotoniseringen ska faktiskt ändra något i det fall som heter så.
mono = ut['fall']['monotonisering']
assert any(abs(a - b) > 1e-12 for a, b in zip(ra_bh(mono['p']), mono['q'])), 'monotoniseringen slog inte till'

with open(os.path.join(here, 'bh-justera-referens.json'), 'w', encoding='utf-8') as f:
    json.dump(ut, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(json.dumps(ut['versioner']))
for namn, v in ut['fall'].items():
    print(namn, v['q'])
