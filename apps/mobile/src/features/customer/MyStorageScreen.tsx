import { Button, Card } from 'heroui-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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

type Props = {
  contracts: ApiContract[];
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBrowse: () => void;
  onRefresh: () => void;
  onDetail: (contractId: string) => void;
};

export function MyStorageScreen({
  contracts,
  now,
  isLoading,
  error,
  contentBottomPadding,
  onBrowse,
  onRefresh,
  onDetail,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && contracts.length > 0} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Kho của tôi</Text>
        <Text className="mt-1 text-sm text-muted">Các kho bạn đang thuê theo hợp đồng.</Text>

        {error ? (
          <View className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
            <Text className="text-sm text-danger-foreground">{error}</Text>
          </View>
        ) : null}

        {isLoading && contracts.length === 0 ? (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        ) : contracts.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-center text-sm leading-6 text-muted">
              Bạn chưa thuê kho nào.{`\n`}Tìm một kho phù hợp để bắt đầu.
            </Text>
            <Button className="mt-4" onPress={onBrowse}>
              <Button.Label>Tìm kho</Button.Label>
            </Button>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                now={now}
                onPress={() => onDetail(contract.id)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ContractCard({
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
    <Pressable onPress={onPress}>
      <Card className="border border-border bg-surface">
        <Card.Body className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                {contractWarehouseName(contract)}
              </Text>
              <Text className="mt-1 text-sm text-muted">{contractUnitSummary(contract)}</Text>
            </View>
            <StatusPill label={state.label} tone={state.tone} />
          </View>

          {contract.facility ? (
            <Text className="text-sm text-muted" numberOfLines={2}>
              {contract.facility.address}
            </Text>
          ) : null}

          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text className="text-xs text-muted">Tiền thuê</Text>
              <Text className="mt-0.5 text-base font-bold text-foreground">
                {formatMoney(contract.monthlyPrice)}/tháng
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-muted">Thời hạn</Text>
              <Text className="mt-0.5 text-sm font-semibold text-foreground">
                {formatIsoDate(contractStartIso(contract))} → {formatIsoDate(endIso)}
              </Text>
            </View>
          </View>

          {state.hint ? (
            <Text className="text-xs font-medium text-accent">{state.hint}</Text>
          ) : null}

          <Text className="text-xs text-muted">Hợp đồng {contract.contractNo}</Text>
        </Card.Body>
      </Card>
    </Pressable>
  );
}
