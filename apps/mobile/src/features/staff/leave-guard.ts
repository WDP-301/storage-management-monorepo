/**
 * Lets the staff tab bar ask whether the open inspection still has work that would be lost
 * (unsaved edits, photos mid-upload). The detail route registers itself while focused.
 */
let hasUnsavedWork: () => boolean = () => false;

export function registerLeaveGuard(check: () => boolean): () => void {
  hasUnsavedWork = check;
  return () => {
    if (hasUnsavedWork === check) hasUnsavedWork = () => false;
  };
}

export const shouldConfirmLeave = (): boolean => hasUnsavedWork();
