import { Button, useThemeColor } from 'heroui-native';
import { ArrowLeft, Check, MapPin, Plus } from 'phosphor-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { WarehouseGallery } from '../../components/WarehousePhotos';
import type { Warehouse } from '../../types/storage-api';
import { WarehouseSpecs } from './WarehouseCard';

const SafeAreaView = withUniwind(RNSafeAreaView);

type Props = {
  /** The warehouse shown; null keeps the page closed. */
  warehouse: Warehouse | null;
  distanceKm?: number;
  isSelected: boolean;
  isDisabled: boolean;
  hasHolding: boolean;
  onToggle: (warehouse: Warehouse) => void;
  onClose: () => void;
};

/**
 * Full-screen warehouse detail over Browse. A modal rather than a route, so the customer's
 * selection survives opening and closing it.
 */
export function WarehouseDetailScreen({
  warehouse,
  distanceKm,
  isSelected,
  isDisabled,
  hasHolding,
  onToggle,
  onClose,
}: Props) {
  const [accent, muted, onAccent] = useThemeColor(['accent', 'muted', 'accent-foreground']);

  return (
    <Modal
      visible={warehouse !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {warehouse ? (
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <View className="flex-row items-center gap-1 px-2 py-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại danh sách kho"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              onPress={onClose}
            >
              <View className="size-10 items-center justify-center rounded-full">
                <ArrowLeft color={accent} size={22} weight="bold" />
              </View>
            </Pressable>
            <Text className="flex-1 font-strong text-foreground text-title-md" numberOfLines={1}>
              Chi tiết kho
            </Text>
          </View>

          <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
            <WarehouseGallery images={warehouse.images ?? []} />

            <View className="gap-4 px-4 pt-4">
              <View className="gap-1.5">
                <Text className="font-numeric text-caption text-muted">{warehouse.code}</Text>
                <Text className="font-strong text-foreground text-title-md">{warehouse.name}</Text>
                <Text className="font-body text-caption text-muted">
                  Thuộc {warehouse.facility.name}
                </Text>
                <View className="flex-row items-start gap-1.5">
                  <MapPin color={accent} size={16} weight="fill" />
                  <Text className="flex-1 font-body text-body-sm text-subtle">
                    {warehouse.addressLine}
                  </Text>
                </View>
                {distanceKm !== undefined ? (
                  <Text className="self-start rounded-full bg-accent/10 px-2 py-0.5 font-ui text-caption text-accent">
                    Cách {formatNumber(Math.round(distanceKm * 10) / 10)} km
                  </Text>
                ) : null}
                <View className="flex-row items-baseline gap-1">
                  <Text className="font-numeric-strong text-accent text-num-lg">
                    {formatMoney(warehouse.monthlyPrice)}
                  </Text>
                  <Text className="font-body text-caption text-muted">/tháng</Text>
                </View>
              </View>

              <View className="rounded-xl bg-surface-secondary p-3">
                <WarehouseSpecs warehouse={warehouse} />
              </View>

              {warehouse.notes ? (
                <View className="gap-1">
                  <Text className="font-strong text-body-sm text-foreground">Mô tả</Text>
                  <Text className="font-body text-body-sm text-subtle">{warehouse.notes}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View className="gap-2 border-t border-border bg-surface px-4 pt-3 pb-2">
            {hasHolding ? (
              <Text className="font-body text-caption text-warning">
                Bạn đang có đơn giữ kho. Hoàn tất hoặc hủy đơn trong Kho của tôi để chọn thêm.
              </Text>
            ) : null}
            <Button
              isDisabled={isDisabled}
              variant={isSelected ? 'secondary' : 'primary'}
              onPress={() => onToggle(warehouse)}
            >
              {isSelected ? (
                <Check color={accent} size={16} weight="bold" />
              ) : (
                <Plus color={isDisabled ? muted : onAccent} size={16} weight="bold" />
              )}
              <Button.Label className="font-ui">
                {isSelected ? 'Đã chọn — bấm để bỏ chọn' : 'Chọn kho này'}
              </Button.Label>
            </Button>
          </View>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}
