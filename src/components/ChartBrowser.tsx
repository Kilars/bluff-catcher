/**
 * ChartBrowser — the range views with a decision strip on top, so one sheet
 * reaches every chart the sources have:
 *
 *   Drill    — the charts the open trainer grades (only when opened from one)
 *   Open     — raise-first-in, per seat and tier (the RFI browser)
 *   vs open  — any hero seat against any opener
 *   vs 3-bet — any opener against any 3-bettor
 *
 * The two facing views add a source strip (cash 100bb, tournament 40bb, and
 * the BTN-only 50bb+ pack) and page through `pairChartPages`: hero's seat on
 * the views' seat strip, the raiser on the tabs. The views themselves are
 * unchanged; this only picks what they page through.
 *
 * Opened from a trainer it starts on the drill's own charts with the hand
 * marked, and the facing views open on the dealt pair, hand marked there too
 * when the source is the hand's own format.
 */

import { useMemo, useState } from 'react';
import RangeSheet from './RangeSheet';
import PhoneSheet from './phone/PhoneSheet';
import PhoneRangeView from './phone/range/PhoneRangeView';
import { CHART_META, type ChartKey, type Format, type Seat, type TableSeat } from '../lib/preflop/ranges';
import type { ChartPage } from '../lib/preflop/grid';
import type { HandClass } from '../lib/preflop/hands';
import {
  DEFAULT_PAIR_SET,
  PAIR_SETS,
  pairChartPages,
  pairPageId,
  pairSet,
  type PairNode,
} from '../lib/preflop/pairCharts';
import styles from './ChartBrowser.module.css';

export type BrowserView = 'drill' | 'open' | PairNode;

const VIEW_LABEL: Record<BrowserView, string> = {
  drill: 'Drill',
  open: 'Open',
  vsOpen: 'vs open',
  vs3bet: 'vs 3-bet',
};

/** The trainer's graded charts, as its range sheet always showed them. */
export interface DrillCharts {
  pages: readonly ChartPage[];
  startPage: number;
  /** Any RFI seat: a paged sheet only uses it to seed its hidden seat tabs. */
  seat: Seat;
}

/** The dealt spot, so the facing views open on its pair with the hand marked. */
export interface BrowserSpot {
  node: PairNode;
  setId: string;
  hero: TableSeat;
  villain: TableSeat;
  hand: HandClass;
}

export interface ChartBrowserProps {
  layout: 'phone' | 'desktop';
  /** The format the facing views open on when no spot says otherwise. */
  format: Format;
  /** The RFI tier the Open view opens on. */
  depth: ChartKey;
  /** The trainer's own charts; adds the Drill view and opens on it. */
  drill?: DrillCharts;
  spot?: BrowserSpot;
  /** Phone sheet header. */
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export default function ChartBrowser({
  layout,
  format,
  depth,
  drill,
  spot,
  title,
  subtitle,
  onClose,
}: ChartBrowserProps) {
  const [view, setView] = useState<BrowserView>(drill ? 'drill' : 'open');
  const [setId, setSetId] = useState(spot?.setId ?? DEFAULT_PAIR_SET[format]);

  const views: BrowserView[] = drill ? ['drill', 'open', 'vsOpen', 'vs3bet'] : ['open', 'vsOpen', 'vs3bet'];
  const node = view === 'vsOpen' || view === 'vs3bet' ? view : null;
  // A source without charts for this decision (50bb+ has no 3-bet pots) falls back to its format's grid.
  const picked = pairSet(setId);
  const shownSet = node && !picked.nodes.includes(node) ? DEFAULT_PAIR_SET[picked.format] : setId;

  const pairPages = useMemo(() => (node ? pairChartPages(shownSet, node) : undefined), [node, shownSet]);
  // The dealt pair is marked only on its own decision and format: a cash
  // CO-vs-HJ hand is not "your chart" on the 40bb grid, nor on a 3-bet chart.
  const spotHere = !!spot && node === spot.node && pairSet(shownSet).format === pairSet(spot.setId).format;
  const spotPage =
    node && spot && spotHere
      ? (pairPages?.findIndex((p) => p.id === pairPageId(shownSet, node, spot.hero, spot.villain)) ?? -1)
      : -1;

  let pages: readonly ChartPage[] | undefined;
  let startPage = 0;
  let highlight: HandClass | undefined;
  if (view === 'drill' && drill) {
    pages = drill.pages;
    startPage = drill.startPage;
    highlight = spot?.hand;
  } else if (pairPages) {
    pages = pairPages;
    startPage = Math.max(0, spotPage);
    highlight = spotPage >= 0 ? spot?.hand : undefined;
  }
  const seat = drill?.seat ?? 'BTN';

  const strip = (
    <div className={styles.strips}>
      <div className={styles.views} role="tablist" aria-label="Decision">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            className={styles.view}
            data-active={v === view}
            onClick={() => setView(v)}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      {node && (
        <div className={styles.sets} role="tablist" aria-label="Source">
          {PAIR_SETS.filter((s) => s.nodes.includes(node)).map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === shownSet}
              className={styles.set}
              data-active={s.id === shownSet}
              onClick={() => setSetId(s.id)}
            >
              <span className={styles.setLabel}>{s.label}</span>
              <span className={styles.setName}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // The RFI view is the views' own unpaged mode; it keeps its tier strip.
  const rfi = view === 'open';

  if (layout === 'phone') {
    return (
      <PhoneSheet title={title} subtitle={subtitle} onClose={onClose}>
        <PhoneRangeView
          strip={strip}
          position={rfi ? CHART_META[depth].seats[0] : seat}
          depth={depth}
          depthSwitchable={rfi}
          highlight={highlight}
          legend
          pages={pages}
          startPage={startPage}
        />
      </PhoneSheet>
    );
  }

  return (
    <RangeSheet
      strip={strip}
      position={rfi ? CHART_META[depth].seats[0] : seat}
      depth={depth}
      highlight={highlight}
      legend
      pages={pages}
      startPage={startPage}
      onClose={onClose}
    />
  );
}
