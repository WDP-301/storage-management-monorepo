import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/**
 * Loads the Inter family and explicit weights for both native font embedding and Expo Go.
 *
 * `Inter` maps to regular for CSS `font-inter` / `font-sans`, while explicit weight keys let
 * legacy `font-*` tokens resolve cleanly on Android without native prebuild.
 */
export function useAppFonts(): boolean {
  const [isLoaded, error] = useFonts({
    Inter: Inter_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // A failed load falls back to system fonts instead of holding the splash screen forever.
  return isLoaded || error != null;
}
