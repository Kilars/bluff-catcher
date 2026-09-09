/**
 * ExplainSheet — bottom sheet overlay teaching the rule of 2 & 4.
 *
 * Backdrop click → close. × button → close.
 * Footer: "Back to the table" (close) + "Deal me another →" (next + close).
 * riseSheet animation: translateY(24px) opacity:0 → rest, 220ms.
 */

import Card from './Card';
import styles from './ExplainSheet.module.css';
import type { Explanation } from '../lib/explain';
import type { Card as CardCode } from '../lib/odds';

interface ExplainSheetProps {
  explanation: Explanation;
  drawName: string;
  street: 'flop' | 'turn';
  onClose: () => void;
  onNext: () => void;
  layout?: 'Bottom sheet' | 'Full screen';
}

export default function ExplainSheet({
  explanation,
  drawName,
  street,
  onClose,
  onNext,
  layout = 'Bottom sheet',
}: ExplainSheetProps) {
  // Bottom sheet: 240px down from the top of the frame at the design height of
  // 860px, but never leaving the sheet less than 620px — on a short laptop the
  // fixed 240px cost the sheet the room its body needs. `100%` here is the
  // frame's height (the sheet's containing block).
  const sheetTop =
    layout === 'Full screen'
      ? '0px'
      : 'clamp(96px, calc(100% - 620px), 240px)';
  const borderRadius =
    layout === 'Full screen' ? '0px' : 'var(--radius-lg) var(--radius-lg) 0 0';

  const { title, outsList, step1, step2, step3, headMaths, memorise } =
    explanation;

  const toCome = street === 'flop' ? 'two cards to come' : 'one card to come';
  const streetLabel = street === 'flop' ? 'Flop' : 'Turn';

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleNextFromExplain() {
    onClose();
    onNext();
  }

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet */}
      <div
        className={styles.sheet}
        style={{ top: sheetTop }}
      >
        <div
          className={styles.sheetInner}
          style={{ borderRadius }}
        >
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>How it&rsquo;s counted</span>
              <h1 className={styles.headerTitle}>{title}</h1>
              <p className={styles.headerSubline}>
                {drawName} · {streetLabel} · {toCome}
              </p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close explanation"
            >
              ×
            </button>
          </div>

          {/* Faded divider */}
          <div className={styles.divider} />

          {/* Body */}
          <div className={styles.body}>
            {/* Left: numbered steps */}
            <div className={styles.leftCol}>
              {/* Step 01 */}
              <div className={styles.step}>
                <span className={styles.stepIndex}>01</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>{step1.title}</h2>
                  <p className={styles.stepBody}>{step1.body}</p>
                  {outsList.length > 0 && (
                    <div className={styles.outCards}>
                      {outsList.map((code: CardCode) => (
                        <Card key={code} code={code} variant="out" />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 02 */}
              <div className={styles.step}>
                <span className={styles.stepIndex}>02</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>{step2.title}</h2>
                  <p className={styles.stepBody}>{step2.body}</p>
                </div>
              </div>

              {/* Step 03 — only if non-null */}
              {step3 && (
                <div className={styles.step}>
                  <span className={styles.stepIndex}>03</span>
                  <div className={styles.stepContent}>
                    <h2 className={styles.stepTitle}>{step3.title}</h2>
                    <p className={styles.stepBody}>{step3.body}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: head-maths card + memorise card */}
            <div className={styles.rightCol}>
              {/* Two-part maths card */}
              <div className={styles.mathsCard}>
                <div className={styles.mathsTop}>
                  <span className={styles.mathsKicker}>On the fly</span>
                  <span className={styles.mathsQuickSum}>{headMaths.quickSum}</span>
                  <span className={styles.mathsNote}>{headMaths.quickNote}</span>
                </div>
                <div className={styles.mathsDivider} />
                <div className={styles.mathsBottom}>
                  <span className={styles.mathsBottomKicker}>True number</span>
                  <div className={styles.trueValueRow}>
                    <span className={styles.trueNumber}>{headMaths.trueNumber}</span>
                    <span className={styles.truePct}>%</span>
                  </div>
                  <span className={styles.trueNote}>{headMaths.trueNote}</span>
                </div>
              </div>

              {/* Worth memorising */}
              <div className={styles.memoriseCard}>
                <span className={styles.memoriseKicker}>Worth memorising</span>
                <div className={styles.memoriseGrid}>
                  {memorise.map((item) => (
                    <div key={item.label} className={styles.memoriseRow}>
                      <span>{item.label}</span>
                      <span className={styles.memoriseValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer — no margin-top:auto (see README warning) */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnAccent}
              onClick={onClose}
            >
              Back to the table
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleNextFromExplain}
            >
              Deal me another →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
