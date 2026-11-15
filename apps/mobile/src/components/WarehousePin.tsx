import { View } from 'react-native';
import { formatMoney, formatMoneyShort } from '../../lib/format-vi';
import { Text } from './ui';

type Props = {
  monthlyPrice: number | null;
  isShelf?: boolean;
  isSelected: boolean;
  /** Warehouse already in the customer's booking selection. */
  isPicked?: boolean;
};

/** Map marker for one warehouse, labelled with its monthly price in Techvera tokens. */
export function WarehousePin({
  monthlyPrice,
  isShelf = false,
  isSelected,
  isPicked = false,
}: Props) {
  const highlighted = isSelected || isPicked;
  const priceText =
    monthlyPrice === null
      ? 'Liên hệ'
      : isSelected
        ? `${isShelf ? 'Từ ' : ''}${formatMoney(monthlyPrice)}`
        : formatMoneyShort(monthlyPrice);

  return (
    <View className="items-center">
      <View
        className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 shadow-sm ${
          highlighted ? 'border-action-primary bg-primary-500' : 'border-border-default bg-bg-card'
        }`}
      >
        <View
          className={`size-2 rounded-full ${
            isPicked ? 'bg-action-primary' : 'bg-status-success-solid'
          }`}
        />
        <Text
          className={`text-caption font-bold ${
            highlighted ? 'text-text-inverse' : 'text-text-primary'
          }`}
        >
          {priceText}
        </Text>
      </View>
      <View className={`h-2 w-0.5 ${highlighted ? 'bg-action-primary' : 'bg-border-strong'}`} />
    </View>
  );
}
