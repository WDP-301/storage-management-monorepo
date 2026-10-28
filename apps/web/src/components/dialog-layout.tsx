import type React from 'react';
import { cn } from '../lib/cn';

/**
 * Shared modal frame: header and footer stay pinned, only the body scrolls.
 *
 * Put `DIALOG_SHELL` on Kumo `<Dialog className>` (plus a width), then compose
 * `DialogHeader` / `DialogBody` / `DialogFooter` as direct children. A `<form>` wrapping
 * all three must use `DIALOG_FORM` so the column layout reaches the body.
 */
export const DIALOG_SHELL = 'p-0 flex flex-col max-h-[90vh] overflow-hidden';

/** For a `<form>` placed between the Dialog and its header/body/footer. */
export const DIALOG_FORM = 'flex flex-col flex-1 min-h-0';

const EDGE_X = 'px-6 sm:px-7';

export const DialogHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'shrink-0 flex items-center justify-between gap-3 border-b border-kumo-line pt-6 sm:pt-7 pb-3.5',
      EDGE_X,
      className,
    )}
  >
    {children}
  </div>
);

export const DialogBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('flex-1 min-h-0 overflow-y-auto py-5 space-y-5', EDGE_X, className)}>
    {children}
  </div>
);

export const DialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'shrink-0 flex flex-wrap items-center justify-end gap-2.5 border-t border-kumo-line py-4',
      EDGE_X,
      className,
    )}
  >
    {children}
  </div>
);
