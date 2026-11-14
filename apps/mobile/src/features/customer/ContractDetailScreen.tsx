import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { Headset, MapPin, SignOut, Swap } from 'phosphor-react-native';
import { type ReactNode, useCallback, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openChangeRequest } from '../../../lib/change-requests-api';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ApiContract } from '../../types/contract-api';
import { ContractInvoicesSection } from './ContractInvoicesSection';
import { ContractAmenitiesSection } from './contract-amenities-section';
import {
  ContractUnitLines,
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
import { ShelfStorageSection } from './shelf-storage-section';
import { TermEndNotice } from './TermEndNotice';
import { UnitChangeRequestSheet } from './UnitChangeRequestSheet';
import { UnitChangeStatusCard } from './UnitChangeStatusCard';
import { type ContractInvoicesState, useContractInvoices } from './use-contract-invoices';
import { useUnitChangeRequests } from './use-unit-change-requests';

const MUTED = 'hsl(215 16% 47%)';
const ACCENT = 'hsl(203 100% 30%)';

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
  const changeSheet = useRef<BottomSheetModal>(null);
  const requestSheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  const state = storageState(contract, now);
  const isActive = contract.status === 'ACTIVE';
  const pending = openReturn(contract);
  const canRequestReturn = isActive && !pending;
  // A settled move CANCELLED the old contract, but the customer must still see the status card.
  const changeRequests = useUnitChangeRequests(isActive || contract.status === 'CANCELLED');
  const openChange =
    openChangeRequest(changeRequests.requests.filter((r) => r.contract_id === contract.id)) ?? null;
  // A pending return already blocks a change request server-side; hide the entry point too.
  const canRequestChange = isActive && !pending && !openChange;
  const canRequestAny = canRequestChange || canRequestReturn;

  const openRequest = (kind: 'change' | 'return') => {
    const target = kind === 'change' ? changeSheet : returnSheet;
    requestSheet.current?.dismiss();
    // Let the picker sheet finish closing before the form sheet slides up.
    setTimeout(() => target.current?.present(), 200);
  };

  /** One tile covers both request kinds: direct when only one is possible, picker when both. */
  const onRequestPress = () => {
    if (canRequestChange && canRequestReturn) requestSheet.current?.present();
    else if (canRequestChange) changeSheet.current?.present();
    else if (canRequestReturn) returnSheet.current?.present();
  };
  const changed = () => {
    changeRequests.reload();
    onChanged();
  };
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
        <ContractUnitLines contract={contract} />
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
      <ShelfStorageSection contract={contract} />
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

      {openChange ? <UnitChangeStatusCard request={openChange} onChanged={changed} /> : null}

      {canRequestAny || canFileTicket ? (
        <View className="flex-row justify-around pt-1">
          {canRequestAny ? (
            <QuickAction
              accessibilityLabel="Yêu cầu đổi kho hoặc trả kho"
              icon={<Swap color={ACCENT} size={24} weight="bold" />}
              label="Đổi / trả kho"
              onPress={onRequestPress}
            />
          ) : null}
          {canFileTicket ? (
            <QuickAction
              accessibilityLabel="Báo sự cố hoặc hỗ trợ"
              icon={<Headset color={ACCENT} size={24} weight="bold" />}
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
      {canRequestAny ? (
        <BottomSheetModal
          ref={requestSheet}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: surfaceColor }}
          enablePanDownToClose
          handleIndicatorStyle={{ backgroundColor: mutedColor }}
          snapPoints={['34%']}
        >
          <BottomSheetView
            className="gap-3 px-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <Text className="font-strong text-foreground text-title-sm">Tạo yêu cầu</Text>
            <RequestKindRow
              icon={<Swap color={ACCENT} size={22} weight="bold" />}
              title="Đổi kho"
              subtitle="Chuyển sang kho khác cùng loại, kèm ngày chuyển đồ"
              onPress={() => openRequest('change')}
            />
            <RequestKindRow
              icon={<SignOut color={ACCENT} size={22} weight="bold" />}
              title="Trả kho"
              subtitle="Hẹn ngày dọn đồ và kết thúc hợp đồng"
              onPress={() => openRequest('return')}
            />
          </BottomSheetView>
        </BottomSheetModal>
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
      <View className="size-14 items-center justify-center rounded-full bg-accent/10">{icon}</View>
      <Text className="font-ui text-body-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

function RequestKindRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-secondary px-3 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View className="size-10 items-center justify-center rounded-full bg-accent/10">{icon}</View>
      <View className="flex-1">
        <Text className="font-strong text-body-sm text-foreground">{title}</Text>
        <Text className="font-body text-caption text-muted">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
