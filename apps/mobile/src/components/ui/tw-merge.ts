import { extendTailwindMerge } from 'tailwind-merge';
import { createTV } from 'tailwind-variants';

const FONT_SIZE_CLASS_GROUP = [
  {
    text: [
      'display',
      'heading',
      'title',
      'subtitle',
      'lead',
      'body-xl',
      'body-lg',
      'body',
      'caption',
      'overline',
      'micro',
      'body-sm',
      'body-md',
      'title-sm',
      'title-md',
      'title-lg',
      'num-sm',
      'num-md',
      'num-lg',
    ],
  },
];

const twMergeConfig = {
  extend: {
    classGroups: {
      'font-size': FONT_SIZE_CLASS_GROUP,
    },
  },
};

export const twMerge = extendTailwindMerge(twMergeConfig);

export const tv = createTV({ twMergeConfig });
