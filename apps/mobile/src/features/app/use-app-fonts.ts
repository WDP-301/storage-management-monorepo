import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';

/**
 * Loads the four Be Vietnam Pro weights the UI references plus two JetBrains Mono weights.
 *
 * Keys match the family names declared in `global.css`. Android ignores `fontWeight` once a custom
 * `fontFamily` is set, so every weight the design uses must be registered here by name — adding a
 * `font-*` token without a matching entry renders as the system font with no error.
 */
export function useAppFonts(): boolean {
  const [isLoaded, error] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  // A failed load falls back to system fonts instead of holding the splash screen forever.
  return isLoaded || error != null;
}
