import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Writing images to the photo library, for the two places the deposit flow needs it: the VietQR
 * code before paying, and the receipt afterwards. Both share the permission dance and the same
 * failure modes, so they share a module.
 */
export type SaveImageOutcome = 'saved' | 'denied' | 'failed';

/**
 * writeOnly: these flows only add images. Asking for full library access would request far more
 * than they need and gives iOS a reason to show the scarier prompt.
 */
async function canSave(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  return permission.granted;
}

/**
 * Saves a remote image — the VietQR code. It exists because the customer is looking at the QR on
 * the very phone they will pay from, and no phone can scan its own screen. Every VN banking app
 * can pick a QR out of the photo library, so this turns "retype the account number and the
 * transfer note" — the step where a typo costs a manual reconciliation — into two taps.
 */
export async function saveRemoteImage(url: string, fileName: string): Promise<SaveImageOutcome> {
  try {
    if (!(await canSave())) return 'denied';

    const downloaded = await File.downloadFileAsync(url, new File(Paths.cache, `${fileName}.png`));
    await MediaLibrary.saveToLibraryAsync(downloaded.uri);
    // The library now owns a copy; leaving the cached one behind only grows the app's footprint.
    downloaded.delete();
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Saves a rendered view as an image — the deposit receipt, so the customer keeps proof of payment. */
export async function saveViewAsImage(view: RefObject<View | null>): Promise<SaveImageOutcome> {
  try {
    if (!view.current) return 'failed';
    if (!(await canSave())) return 'denied';

    await MediaLibrary.saveToLibraryAsync(await captureRef(view, { format: 'png', quality: 1 }));
    return 'saved';
  } catch {
    return 'failed';
  }
}
