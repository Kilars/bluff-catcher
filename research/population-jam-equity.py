"""
Equity of each cash value 4-bet against a low-stakes 5-bet jam range.

`src/lib/preflop/lowStakes.ts` uses these numbers to decide which value
4-bets still call a jam when the jammer has no bluffs. Re-run after adding a
hand to any cash 4-bet value set (btn4BetRanges.ts, open4BetRanges.ts):

    pip install eval7
    python3 research/population-jam-equity.py > research/population-jam-equity.json

Monte Carlo, 2M boards per hand: about +-0.05 points, so a hand within a
tenth of a point of its price can flip between runs. None is that close today.
"""

import json

import eval7

JAM = 'QQ+,AK'
SAMPLES = 2_000_000

# One combo per class. Card removal against the range is handled by eval7;
# every combo of a pair, suited or offsuit class is equivalent here.
HANDS = {
    'AA': 'AhAd', 'KK': 'KhKd', 'QQ': 'QhQd', 'JJ': 'JhJd', 'TT': 'ThTd',
    'AKs': 'AhKh', 'AKo': 'AhKd', 'AQs': 'AhQh',
}

villain = eval7.HandRange(JAM)
equity = {}
for hc, cards in HANDS.items():
    hero = [eval7.Card(cards[:2]), eval7.Card(cards[2:])]
    eq = eval7.py_hand_vs_range_monte_carlo(hero, villain, [], SAMPLES)
    equity[hc] = round(100 * eq, 1)

print(json.dumps({
    '_source': {
        'tool': 'eval7 py_hand_vs_range_monte_carlo, research/population-jam-equity.py',
        'samples': SAMPLES,
        'note': 'Hero equity (%) all-in preflop against the jam range below. '
                'The range is an assumption about low-stakes cash pools, not a solve: '
                'a 5-bet jam there is value only.',
    },
    'jam': JAM,
    'equity': equity,
}, indent=2))
