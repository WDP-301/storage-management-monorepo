import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import colors from './colors';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  testID?: string;
};

/** Material Icons wrapper matching the Medipay 20px default icon grid. */
export function Icon({ name, size = 20, color = colors.ink, testID }: Props) {
  return <MaterialIcons color={color} name={name} size={size} testID={testID} />;
}
