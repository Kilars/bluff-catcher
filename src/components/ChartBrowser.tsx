/**
 * ChartBrowser — the range views with a menu on top, so one sheet reaches
 * every chart the sources have. The strips, top to bottom:
 *
 *   Format  — Tournament · Cash
 *   Spot    — Drill (only when opened from a trainer) · Open · 3-bet · 4-bet
 *   Stack   — tournament only, and only where there is a choice: the RFI
 *             tiers on Open, 40bb and the BTN-only 50bb+ pack on 3-bet
 *   then the views' own strips: your position, and on 3-bet and 4-bet the
 *   raiser you face (versus).
 *
 * Open is the views' own RFI mode with its tier strip hidden: format and stack
 * pick the chart here. 3-bet (facing an open) and 4-bet (facing a 3-bet) page
 * through `pairChartPages`: hero's seat on the views' seat strip, the raiser
 * on the tabs. Drill shows the trainer's graded charts with their own tabs,
 * and hides the stack strip; picking a format from it leaves the drill.
 *
 * Opened from a trainer it starts on the drill's own charts with the hand
 * marked, and the facing spots open on the dealt pair, hand marked there too
 * when format and stack are the hand's own.
 */

import { useMemo, useState } from 'react';
import RangeSheet from './RangeSheet';
import PhoneSheet from './phone/PhoneSheet';
import PhoneRangeView from './phone/range/PhoneRangeView';
import {
  CHART_META,
  DEFAULT_DEPTH,
  DEPTHS,
  FORMATS,
  FORMAT_META,
  chartKeyFor,
  type ChartKey,
  type Depth,
  type Format,
  type Seat,
  type TableSeat,
} from '../lib/preflop/ranges';
import type { Stack } from '../lib/preflop/range';
import type { ChartPage } from '../lib/preflop/grid';
import type { HandClass } from '../lib/preflop/hands';
import {
  pairChartPages,
  pairPageId,
  pairSet,
  pairSetFor,
  pairSetsFor,
  type PairNode,
} from '../lib/preflop/pairCharts';
import styles from './ChartBrowser.module.css';

/** The spot strip: the decision a chart is for. */
export type BrowserSpotKind = 'drill' | 'open' | '3bet' | '4bet';

const SPOT_LABEL: Record<BrowserSpotKind, string> = {
  drill: 'Drill',
  open: 'Open',
  '3bet': '3-bet',
  '4bet': '4-bet',
};

/** 3-bet is hero facing an open; 4-bet is hero's open facing a 3-bet. */
const SPOT_NODE: Record<'3bet' | '4bet', PairNode> = { '3bet': 'vsOpen', '4bet': 'vs3bet' };
const NODE_SPOT: Record<PairNode, '3bet' | '4bet'> = { vsOpen: '3bet', vs3bet: '4bet' };

/** One tab on the stack strip. */
interface StackTab {
  id: string;
  label: string;
  note?: string;
}

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
  /** The format the browser opens on when no spot says otherwise. */
  format: Format;
  /** The RFI tier the Open view opens on ('cash' means the tournament default). */
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
  const spotSet = spot ? pairSet(spot.setId) : undefined;
  const [fmt, setFmt] = useState<Format>(spotSet?.format ?? format);
  const [kind, setKind] = useState<BrowserSpotKind>(drill ? 'drill' : 'open');
  // Each format keeps its own stack picks, so a trip to Cash and back (or to
  // 4-bet, which has only 40bb) lands where you were.
  const [tier, setTier] = useState<Depth>(depth === 'cash' ? DEFAULT_DEPTH : depth);
  const [mttStack, setMttStack] = useState<Stack>(spotSet?.format === 'mtt' ? spotSet.stack : '40bb');

  const kinds: BrowserSpotKind[] = drill ? ['drill', 'open', '3bet', '4bet'] : ['open', '3bet', '4bet'];
  const node = kind === '3bet' || kind === '4bet' ? SPOT_NODE[kind] : null;
  const chartKey = chartKeyFor(fmt, tier);
  const setId = node ? pairSetFor(fmt, fmt === 'mtt' ? mttStack : '100bb', node) : null;

  const pairPages = useMemo(() => (node && setId ? pairChartPages(setId, node) : undefined), [node, setId]);
  // The dealt pair is marked only on its own decision, format and stack: a
  // cash CO-vs-HJ hand is not "your chart" on the 40bb grid, nor on a 3-bet chart.
  const spotHere = !!spot && node === spot.node && setId === spot.setId;
  const spotPage =
    node && setId && spot && spotHere
      ? (pairPages?.findIndex((p) => p.id === pairPageId(setId, node, spot.hero, spot.villain)) ?? -1)
      : -1;

  let pages: readonly ChartPage[] | undefined;
  let startPage = 0;
  let highlight: HandClass | undefined;
  if (kind === 'drill' && drill) {
    pages = drill.pages;
    startPage = drill.startPage;
    highlight = spot?.hand;
  } else if (pairPages) {
    pages = pairPages;
    startPage = Math.max(0, spotPage);
    highlight = spotPage >= 0 ? spot?.hand : undefined;
  }
  const seat = drill?.seat ?? 'BTN';

  // Stack: tournament only, and only where the format has more than one.
  let stackTabs: StackTab[] = [];
  let stackOn = '';
  if (fmt === 'mtt' && kind === 'open') {
    stackTabs = DEPTHS.map((d) => ({ id: d, label: CHART_META[d].label, note: CHART_META[d].name }));
    stackOn = tier;
  } else if (fmt === 'mtt' && node) {
    stackTabs = pairSetsFor(fmt, node).map((s) => ({ id: s.stack, label: s.label, note: s.note }));
    stackOn = pairSet(setId!).stack;
  }
  const pickStack = (id: string) => (kind === 'open' ? setTier(id as Depth) : setMttStack(id as Stack));

  // The drill's charts are the trainer's format. Picking the other format
  // leaves the drill for its own decision (or Open); coming back resets it.
  const drillFormat = spotSet?.format ?? format;
  const pickFormat = (f: Format) => {
    if (kind === 'drill' && f === drillFormat) return;
    setFmt(f);
    if (kind === 'drill') setKind(spot ? NODE_SPOT[spot.node] : 'open');
  };
  const pickKind = (k: BrowserSpotKind) => {
    if (k === 'drill') setFmt(drillFormat);
    setKind(k);
  };

  const segmented = (
    label: string,
    items: { id: string; text: string }[],
    on: string,
    pick: (id: string) => void,
    size?: 'sm'
  ) => (
    <div className={styles.views} role="tablist" aria-label={label} data-size={size}>
      {items.map(({ id, text }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === on}
          className={styles.view}
          data-active={id === on}
          onClick={() => pick(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );

  const strip = (
    <div className={styles.strips}>
      {segmented(
        'Format',
        FORMATS.map((f) => ({ id: f, text: FORMAT_META[f].label })),
        fmt,
        (f) => pickFormat(f as Format),
        'sm'
      )}
      {segmented(
        'Spot',
        kinds.map((k) => ({ id: k, text: SPOT_LABEL[k] })),
        kind,
        (k) => pickKind(k as BrowserSpotKind)
      )}
      {kind !== 'drill' && stackTabs.length > 1 && (
        <div className={styles.sets} role="tablist" aria-label="Stack">
          {stackTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === stackOn}
              className={styles.set}
              data-active={t.id === stackOn}
              onClick={() => pickStack(t.id)}
            >
              <span className={styles.setLabel}>{t.label}</span>
              {t.note && <span className={styles.setName}>{t.note}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Open is the views' own unpaged RFI mode, its tier picked here.
  const rfi = kind === 'open';
  // Your position stays a strip on the pair charts even with one seat (50bb+ is BTN only).
  const seatStrip = kind !== 'drill';

  if (layout === 'phone') {
    return (
      <PhoneSheet title={title} subtitle={subtitle} onClose={onClose}>
        <PhoneRangeView
          strip={strip}
          position={rfi ? CHART_META[chartKey].seats[0] : seat}
          depth={chartKey}
          depthExternal
          seatStrip={seatStrip}
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
      position={rfi ? CHART_META[chartKey].seats[0] : seat}
      depth={chartKey}
      depthExternal
      seatStrip={seatStrip}
      highlight={highlight}
      legend
      pages={pages}
      startPage={startPage}
      onClose={onClose}
    />
  );
}
