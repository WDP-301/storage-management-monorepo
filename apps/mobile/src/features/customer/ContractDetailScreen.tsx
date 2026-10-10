import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { MapPin } from 'phosphor-react-native';
import { useRef } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ApiContract } from '../../types/contract-api';
import {
  contractUnitSummary,
  contractWarehouseName,
  openReturn,
  StatusPill,
  storageState,
} from './contract-display';
import { ContractDocumentsList } from './contract-documents-section';
import { ContractSection, HandoverSection, ReturnSection } from './contract-sections';
import { ReturnRequestSheet } from './ReturnRequestSheet';

const MUTED = 'hsl(215 16% 47%)';

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
    <View className="flex-1">
      <ScreenHeader backLabel="Quay lại Kho của tôi" title="Chi tiết kho thuê" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl refreshing={isLoading && contract !== null} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!contract ? (
          <Text className="font-body mt-8 text-center text-body-sm text-muted">
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
      </ScrollView>
    </View>
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
  // Matches the server: a deposit-paid (DRAFT) or ended contract still allows facility tickets.
  const canFileTicket = isActive || contract.status === 'DRAFT' || contract.status === 'ENDED';

  return (
    <View className="gap-3">
      <View className="gap-1 rounded-xl border border-border bg-surface p-3">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 font-strong text-foreground text-title-sm">
            {contractWarehouseName(contract)}
          </Text>
          <StatusPill label={state.label} tone={state.tone} />
        </View>
        <Text className="font-numeric text-caption text-muted">
          {contractUnitSummary(contract)}
        </Text>
        {contract.unit ? (
          <View className="flex-row items-start gap-1.5">
            <MapPin color={MUTED} size={14} weight="fill" />
            <Text className="flex-1 font-body text-body-sm text-muted">
              {contract.unit.address}
            </Text>
          </View>
        ) : null}
        {state.hint ? (
          <Text className="mt-1 font-ui text-body-sm text-accent">{state.hint}</Text>
        ) : null}
      </View>

      <ContractSection contract={contract}>
        <ContractDocumentsList contract={contract} />
      </ContractSection>
      <HandoverSection handover={contract.handover} />
      {showReturnSection ? <ReturnSection inspection={contract.return} /> : null}

      {canRequestReturn ? (
        <Button variant="secondary" onPress={() => returnSheet.current?.present()}>
          <Button.Label className="font-ui">Yêu cầu trả kho</Button.Label>
        </Button>
      ) : null}
      {canFileTicket ? (
        <Button onPress={onSupport}>
          <Button.Label className="font-ui">Báo sự cố / hỗ trợ</Button.Label>
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
