import type { ReactNode } from 'react';

import { AppBar } from './ui/app-bar';

/** Top bar with back button and title, delegating to Medipay-style AppBar. */
export function ScreenHeader({
  title,
  backLabel,
  onBack,
  right,
}: {
  title: string;
  /** Accessible name of the back button, e.g. "Quay lại Tài khoản". */
  backLabel: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <AppBar
      backLabel={backLabel}
      onBack={onBack}
      rightSlot={right}
      title={title}
      titleAlign="center"
    />
  );
}
