import { MapPin } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { colors, Dashed, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import {
  ContractUnitLines,
  contractEndIso,
  contractStartIso,
  contractWarehouseName,
  StatusPill,
  storageState,
} from './contract-display';

/** One rented (or paid-for) warehouse; opens the contract detail. */
export function ContractCard({
  contract,
  now,
  onPress,
}: {
  contract: ApiContract;
  now: number;
  onPress: () => void;
}) {
  const endIso = contractEndIso(contract);
  const state = storageState(contract, now);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      onPress={onPress}
    >
      <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-title-sm font-bold text-text-primary" numberOfLines={1}>
              {contractWarehouseName(contract)}
            </Text>
            <ContractUnitLines contract={contract} />
            {contract.unit ? (
              <View className="mt-0.5 flex-row items-start gap-1.5">
                <MapPin color={colors.semantic.textSecondary} size={14} weight="fill" />
                <Text className="flex-1 text-body-sm text-text-secondary" numberOfLines={2}>
                  {contract.unit.address}
                </Text>
              </View>
            ) : null}
          </View>
          <StatusPill label={state.label} tone={state.tone} />
        </View>

        <Dashed />

        <View className="flex-row items-end justify-between gap-3">
          <View>
            <Text className="text-caption text-text-secondary">Thời hạn</Text>
            <Text className="mt-0.5 text-body-md font-semibold text-text-primary tabular-nums">
              {formatIsoDate(contractStartIso(contract))} → {formatIsoDate(endIso)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-subtitle font-bold text-text-brand tabular-nums">
              {formatMoney(contract.monthlyPrice)}
            </Text>
            <Text className="text-caption text-text-secondary">/tháng</Text>
          </View>
        </View>

        {state.hint ? (
          <Text className="text-body-sm font-medium text-text-link">{state.hint}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
