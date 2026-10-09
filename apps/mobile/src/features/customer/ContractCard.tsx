import { MapPin } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import type { ApiContract } from '../../types/contract-api';
import {
  contractEndIso,
  contractStartIso,
  contractUnitSummary,
  contractWarehouseName,
  StatusPill,
  storageState,
} from './contract-display';

const MUTED = 'hsl(215 16% 47%)';

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
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-strong text-foreground text-title-sm" numberOfLines={1}>
              {contractWarehouseName(contract)}
            </Text>
            <Text className="font-numeric text-caption text-muted">
              {contractUnitSummary(contract)}
            </Text>
            {contract.unit ? (
              <View className="flex-row items-start gap-1.5">
                <MapPin color={MUTED} size={14} weight="fill" />
                <Text className="flex-1 font-body text-body-sm text-muted" numberOfLines={2}>
                  {contract.unit.address}
                </Text>
              </View>
            ) : null}
          </View>
          <StatusPill label={state.label} tone={state.tone} />
        </View>

        <View className="h-px bg-separator" />

        <View className="flex-row items-end justify-between gap-3">
          <View>
            <Text className="font-body text-caption text-muted">Thời hạn</Text>
            <Text className="mt-0.5 font-numeric text-foreground text-num-md">
              {formatIsoDate(contractStartIso(contract))} → {formatIsoDate(endIso)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-numeric-strong text-accent text-num-lg">
              {formatMoney(contract.monthlyPrice)}
            </Text>
            <Text className="font-body text-caption text-muted">/tháng</Text>
          </View>
        </View>

        {state.hint ? <Text className="font-ui text-body-sm text-accent">{state.hint}</Text> : null}
      </View>
    </Pressable>
  );
}
