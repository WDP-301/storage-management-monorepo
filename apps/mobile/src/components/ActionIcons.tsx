import Svg, { Path } from 'react-native-svg';

type IconProps = { color: string; size?: number };

/** Tick mark for success states. Stroke is deliberately heavy so it reads at a glance. */
export function CheckIcon({ color, size = 30 }: IconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size} fill="none">
      <Path
        d="m4.5 12.5 5 5 10-11"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.75}
      />
    </Svg>
  );
}

/** Arrow into a tray — the save-to-device convention on both platforms. */
export function DownloadIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size} fill="none">
      <Path
        d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </Svg>
  );
}
