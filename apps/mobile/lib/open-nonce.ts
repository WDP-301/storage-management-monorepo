let counter = 0;

/**
 * A fresh value per "open this screen" action. Tab screens never unmount, so a route key built from
 * ids alone would revive the previous visit's state; including this nonce remounts the screen.
 */
export function newOpenNonce(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}
