import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Headset, MapPin, Swap } from 'phosphor-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { changeRequestSignature, openChangeForContract } from '../../../lib/change-requests-api';
import { useBookingSettings } from '../../../lib/client-settings';
import { canRequestRenewal, renewalToShow } from '../../../lib/contract-renewal-state';
import { todayIso } from '../../../lib/rental-schedule';
import { vietnamDayIso } from '../../../lib/settlement-format';
import { Button, colors, FlowScreen, InlineMessage, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { ContractInvoicesSection } from './ContractInvoicesSection';
import { ContractRequestPicker, type RequestKind } from './ContractRequestPicker';
import { ContractAmenitiesSection } from './contract-amenities-section';
import {
  ContractUnitLines,
  contractWarehouseName,
  isShelfWithoutHandover,
  openReturn,
  StatusPill,
  storageState,
} from './contract-display';
import { ContractDocumentsList } from './contract-documents-section';
import { ContractSection, HandoverSection, ReturnSection } from './contract-sections';
import { RenewalRequestForm } from './RenewalRequestForm';
import { RenewalStatusCard } from './RenewalStatusCard';
import { RequestFormSheet } from './RequestFormSheet';
import { ReturnRequestActions } from './ReturnRequestActions';
import { ReturnRequestSheet } from './ReturnRequestSheet';
import { SettlementSection } from './SettlementSection';
import { isFirstRentPaid, ShelfActivationSection } from './shelf-activation-section';
import { ShelfStorageSection } from './shelf-storage-section';
import { TermEndNotice } from './TermEndNotice';
import { UnitChangeRequestSheet } from './UnitChangeRequestSheet';
import { UnitChangeStatusCard } from './UnitChangeStatusCard';
import { type ContractInvoicesState, useContractInvoices } from './use-contract-invoices';
import { useContractRenewals } from './use-contract-renewals';
import { useUnitChangeRequests } from './use-unit-change-requests';

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
    <FlowScreen muted title="Chi tiết kho thuê" titleAlign="left" onBack={onBack}>
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: contentBottomPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading && contract !== null} onRefresh={refresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!contract ? (
          isLoading ? (
            <View className="items-center gap-2 py-12">
              <ActivityIndicator color={colors.semantic.actionPrimary} />
              <Text className="text-body-sm text-text-secondary">Đang tải…</Text>
            </View>
          ) : error ? (
            <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
              <InlineMessage message={error} type="error" />
              <Button label="Thử lại" onPress={refresh} size="sm" variant="secondary" />
            </View>
          ) : (
            <View className="items-center rounded-[20px] border border-border-default bg-bg-card px-5 py-8">
              <Text className="text-body text-text-secondary">Không tìm thấy hợp đồng này.</Text>
            </View>
          )
        ) : (
          <ContractDetail
            contract={contract}
            now={now}
            invoices={
              hasInvoices &&
              // Before the first month is issued a DRAFT has nothing to bill — no "Không còn nợ" card.
              (contract.status !== 'DRAFT' ||
                invoices.invoices.some((inv) => inv.status !== 'VOID') ||
                invoices.error !== null)
                ? invoices
                : null
            }
            onSupport={onSupport}
            onChanged={refresh}
          />
        )}
      </ScrollView>
    </FlowScreen>
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
  const changeSheet = useRef<BottomSheetModal>(null);
  const requestSheet = useRef<BottomSheetModal>(null);
  const renewSheet = useRef<BottomSheetModal>(null);
  const booking = useBookingSettings();
  const state = storageState(contract, now);
  const isActive = contract.status === 'ACTIVE';
  const pending = openReturn(contract);
  const canRequestReturn = isActive && !pending;
  // A settled move attaches `new_contract_id` on DRAFT, and CANCELLED old contracts still keep
  // status context visible on the detail screen.
  const changeRequests = useUnitChangeRequests(
    isActive || contract.status === 'DRAFT' || contract.status === 'CANCELLED',
  );
  const openChange = openChangeForContract(changeRequests.requests, contract.id);
  const renewals = useContractRenewals(isActive);
  const shownRenewal = renewalToShow(renewals.renewals, contract.id);
  // While the branch weighs a renewal, a return or a move would contradict it.
  const renewalPending = shownRenewal?.status === 'PENDING';
  // A pending return already blocks a change request server-side; hide the entry point too.
  const canRequestChange = isActive && !pending && !openChange && !renewalPending;
  const canRenew = canRequestRenewal({
    isActive,
    todayIso: vietnamDayIso(new Date(now)) ?? todayIso(),
    termEndDayIso: contract.termEndAt ? vietnamDayIso(contract.termEndAt) : null,
    hasOpenReturn: pending !== null,
    hasOpenChange: openChange !== null,
    hasPendingRenewal: renewalPending,
  });
  const requestKinds = (
    [
      canRenew && 'renew',
      canRequestChange && 'change',
      canRequestReturn && !renewalPending && 'return',
    ] as const
  ).filter((kind): kind is RequestKind => kind !== false);
  const canRequestAny = requestKinds.length > 0;
  const sheetFor = { renew: renewSheet, change: changeSheet, return: returnSheet };

  const openRequest = (kind: RequestKind) => {
    requestSheet.current?.dismiss();
    // Let the picker sheet finish closing before the form sheet slides up.
    setTimeout(() => sheetFor[kind].current?.present(), 200);
  };

  /** One tile covers every request kind: direct when only one is possible, a picker otherwise. */
  const onRequestPress = () => {
    if (requestKinds.length === 1) sheetFor[requestKinds[0]].current?.present();
    else requestSheet.current?.present();
  };
  const renewalChanged = () => {
    renewals.reload();
    onChanged();
  };
  const changed = () => {
    changeRequests.reload();
    onChanged();
  };

  // The request list polls on its own; when a poll lands a new status (approved, settled,
  // cancelled server-side), pull the rest of the screen along — the top-up invoice and the new
  // unit live outside the card.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });
  const changeSignature = changeRequestSignature(openChange);
  const seenSignature = useRef<string | null>(null);
  useEffect(() => {
    if (seenSignature.current === null) {
      seenSignature.current = changeSignature;
      return;
    }
    if (seenSignature.current === changeSignature) return;
    seenSignature.current = changeSignature;
    onChangedRef.current();
  }, [changeSignature]);
  const showReturnSection = isActive || contract.status === 'ENDED' || contract.return !== null;
  // Matches the server: a deposit-paid (DRAFT) or ended contract still allows facility tickets.
  const canFileTicket = isActive || contract.status === 'DRAFT' || contract.status === 'ENDED';

  return (
    <View className="gap-4">
      {/* 1. Overview card */}
      <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-subtitle font-bold text-text-primary">
            {contractWarehouseName(contract)}
          </Text>
          <StatusPill label={state.label} tone={state.tone} />
        </View>
        <ContractUnitLines contract={contract} />
        {contract.unit ? (
          <View className="flex-row items-start gap-1.5">
            <MapPin color={colors.semantic.iconBrand} size={15} weight="fill" />
            <Text className="flex-1 text-body-sm text-text-secondary">{contract.unit.address}</Text>
          </View>
        ) : null}
        {state.hint ? (
          <Text className="mt-0.5 text-body-sm font-medium text-text-link">{state.hint}</Text>
        ) : null}
      </View>

      {/* 2. Urgent alerts (ending/overdue, due invoices, unit-change status) */}
      {/* A pending renewal may move the term end, so the ending/overdue banner waits for it. */}
      {renewalPending ? null : <TermEndNotice contract={contract} />}
      {shownRenewal && isActive ? (
        <RenewalStatusCard renewal={shownRenewal} onChanged={renewalChanged} />
      ) : null}
      {invoices ? (
        <ContractInvoicesSection
          state={invoices}
          returnScheduledAt={pending?.scheduledAt ?? null}
        />
      ) : null}
      {openChange ? <UnitChangeStatusCard request={openChange} onChanged={changed} /> : null}

      {/* 3. Operations (shelf goods, handover, return inspections) */}
      <ShelfStorageSection contract={contract} />
      {!isShelfWithoutHandover(contract) ? (
        <HandoverSection handover={contract.handover} />
      ) : contract.status === 'DRAFT' ? (
        <ShelfActivationSection
          contract={contract}
          firstRentPaid={isFirstRentPaid(invoices?.invoices ?? [])}
        />
      ) : null}
      {showReturnSection ? (
        <ReturnSection inspection={contract.return} shelf={contract.unit?.kind === 'SHELF'}>
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

      {/* 4. History & billing */}
      {(contract.status === 'ENDED' || contract.status === 'CANCELLED') && contract.settlement ? (
        <SettlementSection settlement={contract.settlement} />
      ) : null}

      {/* 5. Static reference (contract terms, documents, amenities) */}
      <ContractSection contract={contract}>
        <ContractDocumentsList contract={contract} />
      </ContractSection>
      <ContractAmenitiesSection contract={contract} />

      {/* 6. Bottom actions */}
      {canRequestAny || canFileTicket ? (
        <View className="flex-row justify-around pt-2">
          {canRequestAny ? (
            <QuickAction
              accessibilityLabel="Yêu cầu gia hạn, đổi kho hoặc trả kho"
              icon={<Swap color={colors.semantic.actionPrimary} size={24} weight="bold" />}
              label="Yêu cầu"
              onPress={onRequestPress}
            />
          ) : null}
          {canFileTicket ? (
            <QuickAction
              accessibilityLabel="Báo sự cố hoặc hỗ trợ"
              icon={<Headset color={colors.semantic.actionPrimary} size={24} weight="bold" />}
              label="Hỗ trợ"
              onPress={onSupport}
            />
          ) : null}
        </View>
      ) : null}

      {isActive ? (
        <ReturnRequestSheet sheetRef={returnSheet} contract={contract} onSubmitted={onChanged} />
      ) : null}
      {isActive ? (
        <UnitChangeRequestSheet sheetRef={changeSheet} contract={contract} onSubmitted={changed} />
      ) : null}
      {canRenew ? (
        <RequestFormSheet sheetRef={renewSheet} onSubmitted={renewalChanged}>
          {(done) => <RenewalRequestForm contract={contract} booking={booking} onDone={done} />}
        </RequestFormSheet>
      ) : null}
      {canRequestAny ? (
        <ContractRequestPicker sheetRef={requestSheet} kinds={requestKinds} onPick={openRequest} />
      ) : null}
    </View>
  );
}

/** Circle icon with the label under it, the quick-action look used for the two main actions. */
function QuickAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="items-center gap-1.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View className="size-14 items-center justify-center rounded-full bg-secondary-0">
        {icon}
      </View>
      <Text className="text-body-sm font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}
