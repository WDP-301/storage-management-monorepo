import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  /** Available units at this facility, shown inside the pin head. */
  count: number;
  color: string;
  isSelected: boolean;
};

/**
 * Teardrop pin drawn in SVG rather than loaded as a sprite image: `<Marker>` takes any RN view, so
 * the pin can carry a live unit count and a selected state that a style sprite could not.
 *
 * The viewBox is 32x40 with the tip at the bottom, so the marker must anchor at "bottom" for the
 * tip — not the middle of the pin — to sit on the facility's coordinates.
 */
export function FacilityPin({ count, color, isSelected }: Props) {
  const width = isSelected ? 36 : 29;
  const height = width * 1.25;

  return (
    <View className="items-center justify-center">
      <Svg height={height} viewBox="0 0 32 40" width={width}>
        <Path
          d="M16 1c8.3 0 15 6.7 15 15 0 10-15 23-15 23S1 26 1 16C1 7.7 7.7 1 16 1Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth={2}
        />
        <Circle cx={16} cy={15} fill="#ffffff" r={8.5} />
      </Svg>
      {/* Absolute so the number sits on the pin head without a second SVG text node. */}
      <View className="absolute" style={{ top: height * 0.13 }}>
        <Text className="font-bold text-[11px]" style={{ color }}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    </View>
  );
}
