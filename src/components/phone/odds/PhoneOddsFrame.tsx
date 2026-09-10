/**
 * PhoneOddsFrame — the column the phone odds drill lives in.
 *
 * A shell and nothing else: gutters, safe-area insets, and the rule that the
 * read zone sits at the top while the swap zone sits in the thumb zone at the
 * bottom, with any slack between them. It exists as a component so that
 * `modes/phone/PhoneOddsTrainer.tsx` can be pure composition with no styles of
 * its own, and so the whole phone odds tree stays inside one directory.
 */

import type { ReactNode } from 'react';
import styles from './PhoneOddsFrame.module.css';

interface PhoneOddsFrameProps {
  children: ReactNode;
}

export default function PhoneOddsFrame({ children }: PhoneOddsFrameProps) {
  return (
    <div className={styles.frame} data-testid="phone-odds-frame">
      {children}
    </div>
  );
}
