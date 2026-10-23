import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { MapPin } from 'phosphor-react-native';
import { useRef } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { isInvoiceDue } from '../../../lib/settlement-format';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ApiContract } from '../../types/contract-api';
import { ContractInvoicesSection } from './ContractInvoicesSection';
import { ContractAmenitiesSection } from './contract-amenities-section';
import {
  contractUnitSummary,
  contractWarehouseName,
  openReturn,
  StatusPill,
  storageState,
} from './contract-display';
import { ContractDocumentsList } from './contract-documents-section';
import { ContractSection, HandoverSection, ReturnSection } from './contract-sections';
import { ReturnRequestActions } from './ReturnRequestActions';
import { ReturnRequestSheet } from './ReturnRequestSheet';
import { SettlementSection } from './SettlementSection';
import { TermEndNotice } from './TermEndNotice';
import { type ContractInvoicesState, useContractInvoices } from './use-contract-invoices';

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
  // A DRAFT contract has its first month's rent to pay at handover; the customer pays it here.
  const hasInvoices =
    contract?.status === 'ACTIVE' || contract?.status === 'ENDED' || contract?.status === 'DRAFT';
  const invoices = useContractInvoices(hasInvoices && contract ? contract.id : null);
  const refresh = () => {
    onRefresh();
    if (hasInvoices) invoices.reload();
  };

  return (
    <View className="flex-1">
      <ScreenHeader backLabel="Quay lại Kho của tôi" title="Chi tiết kho thuê" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl refreshing={isLoading && contract !== null} onRefresh={refresh} />
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
            invoices={
              hasInvoices &&
              // Before the first month is issued a DRAFT has nothing to bill — no "Không còn nợ" card.
              (contract.status !== 'DRAFT' || invoices.invoices.some(isInvoiceDue))
                ? invoices
                : null
            }
            onSupport={onSupport}
            onChanged={refresh}
          />
        )}
      </ScrollView>
    </View>
  );
}

function ContractDetail({
  contract,
  now,
  invoices,
  onSupport,
  onChanged,
}: {
  contract: ApiContract;
  now: number;
  /** null when the contract has no invoices to show (not ACTIVE or ENDED). */
  invoices: ContractInvoicesState | null;
  onSupport: () => void;
  /** The return request or the contract changed; reload the screen. */
  onChanged: () => void;
}) {
  const returnSheet = useRef<BottomSheetModal>(null);
  const state = storageState(contract, now);
  const isActive = contract.status === 'ACTIVE';
  const pending = openReturn(contract);
  const canRequestReturn = isActive && !pending;
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

      <TermEndNotice contract={contract} />
      <ContractSection contract={contract}>
        <ContractDocumentsList contract={contract} />
      </ContractSection>
      <ContractAmenitiesSection contract={contract} />
      <HandoverSection handover={contract.handover} />
      {showReturnSection ? (
        <ReturnSection inspection={contract.return}>
          {isActive && pending ? (
            <ReturnRequestActions
              contractId={contract.id}
              inspection={pending}
              onReschedule={() => returnSheet.current?.present()}
              onChanged={onChanged}
            />
          ) : null}
        </ReturnSection>
      ) : null}
      {contract.status === 'ENDED' && contract.settlement ? (
        <SettlementSection settlement={contract.settlement} />
      ) : null}
      {invoices ? (
        <ContractInvoicesSection
          state={invoices}
          returnScheduledAt={pending?.scheduledAt ?? null}
        />
      ) : null}

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

      {isActive ? (
        <ReturnRequestSheet sheetRef={returnSheet} contract={contract} onSubmitted={onChanged} />
      ) : null}
    </View>
  );
}
