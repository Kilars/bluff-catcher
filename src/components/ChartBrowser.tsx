/**
 * ChartBrowser — the range views with a menu on top, so one sheet reaches
 * every chart the sources have. The rows, top to bottom:
 *
 *   Format  — Tournament · Cash
 *   Spot    — Drill (only when opened from a trainer) · Open · 3-bet · 4-bet
 *   Stack   — tournament only: 10bb · 20bb · 40bb · 50bb+ · 60bb+
 *   You     — every seat at the format's table
 *   vs      — the same seats again, the raiser you face
 *
 * Within a format the rows never change shape: a tab that doesn't apply to
 * what's picked above it is greyed, not removed, and You and vs share columns
 * (on the rows an opener sits left of you, a 3-bettor right). The rules live in
 * `lib/preflop/browserAxes.ts`; this file draws them and owns the picks.
 *
 * Open shows the views' unpaged RFI chart for the picked seat; 3-bet (facing
 * an open) and 4-bet (facing a 3-bet) show the picked pair's page. The views
 * hide their own strips and take the chart from here (`menuExternal`). Drill
 * shows the trainer's graded charts with their own tabs in place of the rows
 * below Spot; picking a format from it leaves the drill.
 *
 * Opened from a trainer it starts on the drill's own charts with the hand
 * marked, and the facing spots start on the dealt pair, hand marked there too
 * when format and stack are the hand's own.
 */

import { useCallback, useState } from 'react';
import RangeSheet from './RangeSheet';
import PhoneSheet from './phone/PhoneSheet';
import PhoneRangeView from './phone/range/PhoneRangeView';
import { FORMAT_META, type ChartKey, type Format, type Seat, type TableSeat } from '../lib/preflop/ranges';
import type { ChartPage } from '../lib/preflop/grid';
import type { HandClass } from '../lib/preflop/hands';
import { positionLabel } from '../lib/preflop/boundary';
import { pairPageId, pairSet, type PairNode } from '../lib/preflop/pairCharts';
import {
  NODE_SPOT,
  chartKeyOf,
  enabled,
  initialAxes,
  nodeOf,
  pairPagesOf,
  pick,
  rowTabs,
  setIdOf,
  step,
  type Axes,
  type Row,
  type SpotKind,
} from '../lib/preflop/browserAxes';
import styles from './ChartBrowser.module.css';

const SPOT_LABEL: Record<SpotKind, string> = {
  drill: 'Drill',
  open: 'Open',
  '3bet': '3-bet',
  '4bet': '4-bet',
};

/** What a stack is, on hover: the tier's name, or what the pack is limited to. */
const STACK_NOTE: Record<string, string> = {
  '10bb': 'Short: jam or fold',
  '20bb': 'Mid',
  '40bb': 'Every seat pair',
  '50bb+': 'BTN only, vs an open',
  '60bb+': 'Deep',
};

/**
 * The rows below Format: [row, its accessible name, its caption]. Only the two
 * seat rows need a caption: they're the same seats twice.
 */
const ROWS: [Row, string, string?][] = [
  ['spot', 'Spot'],
  ['stack', 'Stack'],
  ['seat', 'You', 'You'],
  ['versus', 'Versus', 'vs'],
];

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
  const [axes, setAxes] = useState<Axes>(() => initialAxes({ format, depth, drill: !!drill, spot }));
  const drillFormat = spot ? pairSet(spot.setId).format : format;

  const node = nodeOf(axes.spot);
  const setId = setIdOf(axes);
  const chartKey = chartKeyOf(axes);
  const pairPages = node && setId ? pairPagesOf(setId, node) : undefined;
  // The dealt pair is marked only on its own decision, format and stack: a
  // cash CO-vs-HJ hand is not "your chart" on the 40bb grid, nor on a 3-bet chart.
  const spotHere = !!spot && node === spot.node && setId === spot.setId;
  const dealtPage =
    pairPages && spotHere ? pairPages.findIndex((p) => p.id === pairPageId(setId!, node!, spot.hero, spot.villain)) : -1;
  const page =
    pairPages && axes.villain
      ? pairPages.findIndex((p) => p.id === pairPageId(setId!, node!, axes.hero, axes.villain!))
      : -1;

  // The drill's charts are the trainer's format. Picking the other format
  // leaves the drill for its own decision (or Open); coming back resets it.
  const pickTab = (row: Row, id: string) =>
    setAxes((a) => {
      if (row === 'format' && a.spot === 'drill') {
        if (id === drillFormat) return a;
        return pick(pick(a, 'format', id), 'spot', spot ? NODE_SPOT[spot.node] : 'open');
      }
      if (row === 'spot' && id === 'drill') return pick(pick(a, 'format', drillFormat), 'spot', 'drill');
      return pick(a, row, id);
    });
  // Stable, so the desktop sheet's key listener isn't rebound on every render.
  const onStep = useCallback((delta: number) => setAxes((a) => step(a, delta)), []);

  const tabText = (row: Row, id: string) => {
    if (row === 'format') return FORMAT_META[id as Format].label;
    if (row === 'spot') return SPOT_LABEL[id as SpotKind];
    if (row === 'stack') return id;
    // Nine seats leave a phone column about 30px: "UTG1" fits it, "UTG+1" doesn't.
    return axes.format === 'mtt' ? id : positionLabel(id as TableSeat);
  };

  const on: Record<Row, string | null> = {
    format: axes.format,
    spot: axes.spot,
    stack: axes.spot === 'drill' ? null : axes.stacks[axes.spot],
    seat: axes.hero,
    versus: node ? axes.villain : null,
  };
  // The dealt seats, dotted where their chart is the one on offer.
  const dealt: Partial<Record<Row, string>> = spotHere
    ? { seat: spot.hero, ...(axes.hero === spot.hero && { versus: spot.villain }) }
    : {};

  const row = (r: Row, name: string, caption?: string) => {
    const tabs = rowTabs(axes.format, r, !!drill);
    if (tabs.length === 0) return null;
    const live = enabled(axes, r);
    const selected = live.size > 0 ? on[r] : null;
    return (
      <div
        key={r}
        className={styles.row}
        role="tablist"
        aria-label={name}
        data-row={r}
        data-captioned={caption ? true : undefined}
        data-dense={tabs.length > 6 || undefined}
        style={{ '--cols': tabs.length } as React.CSSProperties}
      >
        {caption && (
          <span className={styles.caption} aria-hidden="true">
            {caption}
          </span>
        )}
        {tabs.map((id) => {
          const off = !live.has(id);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === selected}
              aria-disabled={off || undefined}
              className={styles.tab}
              data-active={id === selected}
              data-off={off || undefined}
              data-id={id}
              title={r === 'stack' ? STACK_NOTE[id] : undefined}
              onClick={() => !off && pickTab(r, id)}
            >
              {tabText(r, id)}
              {dealt[r] === id && <span className={styles.dot} aria-label="(dealt)" />}
            </button>
          );
        })}
      </div>
    );
  };

  const menu = (
    <div className={styles.strips}>
      {row('format', 'Format')}
      {/* Drill navigates by its own seat and chart tabs, so it keeps only Spot. */}
      <div className={styles.rows}>
        {ROWS.filter(([r]) => axes.spot !== 'drill' || r === 'spot').map(([r, name, caption]) => row(r, name, caption))}
      </div>
    </div>
  );

  // Drill: the trainer's charts, navigated by their own tabs. Otherwise the
  // views show the picked chart and leave the menu to us.
  const isDrill = axes.spot === 'drill' && !!drill;
  const pages = isDrill ? drill.pages : pairPages;
  const startPage = isDrill ? drill.startPage : dealtPage;
  const highlight = isDrill || dealtPage >= 0 ? spot?.hand : undefined;
  const position: Seat = isDrill ? drill.seat : node ? 'BTN' : (axes.hero as Seat);
  const external = isDrill ? {} : { menuExternal: true, page: Math.max(0, page), onStep };

  if (layout === 'phone') {
    return (
      <PhoneSheet title={title} subtitle={subtitle} onClose={onClose}>
        <PhoneRangeView
          strip={menu}
          position={position}
          depth={chartKey}
          depthExternal
          {...external}
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
      strip={menu}
      position={position}
      depth={chartKey}
      depthExternal
      {...external}
      highlight={highlight}
      legend
      pages={pages}
      startPage={startPage}
      onClose={onClose}
    />
  );
}
