import * as React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { twMerge } from './tw-merge';

type Props = {
  className?: string;
} & TextProps;

/** Base body typography using Inter and Techvera primary ink. */
export function Text({ className = '', children, ...props }: Props) {
  const merged = React.useMemo(
    () => twMerge('font-inter text-body text-text-primary', className),
    [className],
  );

  return (
    <RNText className={merged} {...props}>
      {children}
    </RNText>
  );
}
