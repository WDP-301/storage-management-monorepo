import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button, Card } from 'heroui-native';
import { useRef } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import type { ApiContract } from '../../types/contract-api';
import {
  contractUnitSummary,
  contractWarehouseName,
  openReturn,
  StatusPill,
  storageState,
} from './contract-display';
import { ContractSection, HandoverSection, ReturnSection } from './contract-sections';
import { ReturnRequestSheet } from './ReturnRequestSheet';

type Props = {
  contract: ApiContract | null;
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBack: () => void;
  onSupport: () => void;
  onRefresh: () => void;
};

export function ContractDetailScreen({
  contract,
  now,
  isLoading,
  error,
  contentBottomPadding,
  onBack,
  onSupport,
  onRefresh,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && contract !== null} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Button variant="ghost" size="sm" className="self-start" onPress={onBack}>
          <Button.Label>← Kho của tôi</Button.Label>
        </Button>

        {!contract ? (
          <Text className="mt-8 text-center text-sm text-muted">
            {isLoading ? 'Đang tải…' : (error ?? 'Không tìm thấy hợp đồng này.')}
          </Text>
        ) : (
          <ContractDetail
            contract={contract}
            now={now}
            onSupport={onSupport}
            onReturnRequested={onRefresh}
          />
        )}
      </View>
    </ScrollView>
  );
}

function ContractDetail({
  contract,
  now,
  onSupport,
  onReturnRequested,
}: {
  contract: ApiContract;
  now: number;
  onSupport: () => void;
  onReturnRequested: () => void;
}) {
  const returnSheet = useRef<BottomSheetModal>(null);
  const state = storageState(contract, now);
  const isActive = contract.status === 'ACTIVE';
  const canRequestReturn = isActive && !openReturn(contract);
  const showReturnSection = isActive || contract.status === 'ENDED' || contract.return !== null;

  return (
    <View className="mt-2 gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold tracking-tight text-foreground">
            {contractWarehouseName(contract)}
          </Text>
          <Text className="mt-1 text-sm text-muted">{contractUnitSummary(contract)}</Text>
          {state.hint ? (
            <Text className="mt-1 text-sm font-medium text-accent">{state.hint}</Text>
          ) : null}
        </View>
        <StatusPill label={state.label} tone={state.tone} />
      </View>

      {contract.unit ? (
        <Card className="border border-border bg-surface">
          <Card.Body className="gap-1">
            <Text className="text-sm leading-5 text-muted">{contract.unit.address}</Text>
          </Card.Body>
        </Card>
      ) : null}

      <ContractSection contract={contract} />
      <HandoverSection handover={contract.handover} />
      {showReturnSection ? <ReturnSection inspection={contract.return} /> : null}

      {canRequestReturn ? (
        <Button variant="secondary" onPress={() => returnSheet.current?.present()}>
          <Button.Label>Yêu cầu trả kho</Button.Label>
        </Button>
      ) : null}
      {isActive ? (
        <Button onPress={onSupport}>
          <Button.Label>Báo sự cố / hỗ trợ</Button.Label>
        </Button>
      ) : null}

      <ReturnRequestSheet
        sheetRef={returnSheet}
        contractId={contract.id}
        warehouseName={contractWarehouseName(contract)}
        onSubmitted={onReturnRequested}
      />
    </View>
  );
}
