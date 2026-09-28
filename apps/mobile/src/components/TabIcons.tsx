import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: string };

export function UnitsIcon({ color }: IconProps) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Path
        d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Path
        d="m4 7.5 8 4.5 8-4.5M12 12v9"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function CalendarIcon({ color }: IconProps) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Rect height={16} rx={2.5} stroke={color} strokeWidth={1.8} width={18} x={3} y={5} />
      <Path
        d="M8 3v4m8-4v4M3 10h18m-13 4h3m2 0h3m-8 3h3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function ScanIcon({ color }: IconProps) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Path
        d="M4 8V6a2 2 0 0 1 2-2h2m8 0h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2m-8 0H6a2 2 0 0 1-2-2v-2M4 12h16"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function RequestIcon({ color }: IconProps) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Path
        d="M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7l-4.5 3.5V17H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Path d="M8 9h8m-8 4h5" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

export function SettingsIcon({ color }: IconProps) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.62.67 1.06 1.3 1.08H21v4h-.3c-.63 0-1.17.42-1.3 1.04Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </Svg>
  );
}
