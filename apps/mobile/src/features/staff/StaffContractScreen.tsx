import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { handoverBlockedReason } from '../../../lib/contract-files';
import type { StaffContract } from '../../../lib/staff-contracts-api';
import { Button, colors, FlowScreen, Icon, InlineMessage, Text } from '../../components/ui';
import { contractStatusLabel, contractStatusTone, StatusPill } from '../customer/contract-display';
import { ContractDocumentsList } from '../customer/contract-documents-section';
import { ContractSection, HandoverSection, ReturnSection } from '../customer/contract-sections';
import { ContractDocumentsEditor } from './ContractDocumentsEditor';
import { FirstRentSection } from './FirstRentSection';
import { StaffInspectionSection } from './StaffInspectionSection';
import type { useInspectionDetail } from './use-inspection-detail';

type Detail = ReturnType<typeof useInspectionDetail>;

type Props = {
  contract: StaffContract | null;
  isLoading: boolean;
  error: string | null;
  handover: Detail;
  returnDetail: Detail;
  savingDocuments: boolean;
  onDocumentsBusyChange: (busy: boolean) => void;
  onBack: () => void;
  onReload: () => void;
};

/** One contract, three records: signed files, handover receipt and return record. */
export function StaffContractScreen({
  contract,
  isLoading,
  error,
  handover,
  returnDetail,
  savingDocuments,
  onDocumentsBusyChange,
  onBack,
  onReload,
}: Props) {
  if (!contract) {
    return (
      <FlowScreen backLabel="Quay lại Hôm nay" muted onBack={onBack} title="Hợp đồng">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          {error ? (
            <InlineMessage message={error} type="error" />
          ) : (
            <ActivityIndicator color={colors.semantic.actionPrimary} />
          )}
          <Button label="Quay lại" onPress={onBack} variant="secondary" />
        </View>
      </FlowScreen>
    );
  }

  const { permissions } = contract;
  const firstRentPaid = contract.firstRent?.status === 'PAID';
  const showFirstRent =
    (contract.status === 'DRAFT' || Boolean(contract.firstRent)) &&
    !((contract.status === 'ACTIVE' || contract.status === 'ENDED') && firstRentPaid);

  const documentsNode = (
    <ContractSection contract={contract}>
      {permissions.documents ? (
        <ContractDocumentsEditor
          contractId={contract.id}
          files={contract.documents}
          onSaved={onReload}
          onStale={onReload}
          onUploadingChange={onDocumentsBusyChange}
        />
      ) : (
        <ContractDocumentsList contract={contract} />
      )}
    </ContractSection>
  );

  const firstRentNode = showFirstRent ? (
    <FirstRentSection
      key={contract.id}
      canCollect={contract.permissions.firstRent}
      contractId={contract.id}
      firstRent={contract.firstRent}
      monthlyPrice={contract.monthlyPrice}
      onChanged={onReload}
    />
  ) : null;

  const handoverNode = permissions.handover ? (
    <StaffInspectionSection
      detail={handover}
      finalizeBlockedReason={handoverBlockedReason(
        contract.documents.length,
        savingDocuments,
        contract.firstRent?.status ?? null,
      )}
      kind="handover"
      onFinalized={onReload}
    />
  ) : (
    <HandoverSection handover={contract.handover} viewer="staff" />
  );

  const returnNode = permissions.return ? (
    <StaffInspectionSection detail={returnDetail} kind="return" onFinalized={onReload} />
  ) : (
    <ReturnSection inspection={contract.return} viewer="staff" />
  );

  return (
    <FlowScreen
      backLabel="Quay lại Hôm nay"
      muted
      onBack={onBack}
      title={contract.unit?.code ?? contract.contractNo}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.semantic.actionPrimary]}
            onRefresh={onReload}
            refreshing={isLoading}
            tintColor={colors.semantic.actionPrimary}
          />
        }
      >
        <Header contract={contract} />
        {error ? (
          <View className="rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
            <InlineMessage message={error} type="error" />
          </View>
        ) : null}

        {permissions.return ? (
          <>
            {firstRentNode}
            {returnNode}
            {documentsNode}
            {handoverNode}
          </>
        ) : (
          <>
            {documentsNode}
            {firstRentNode}
            {handoverNode}
            {returnNode}
          </>
        )}
      </ScrollView>
    </FlowScreen>
  );
}

function Header({ contract }: { contract: StaffContract }) {
  const { customer } = contract;
  return (
    <View className="flex-row items-start justify-between gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-1 gap-1">
        <Text className="text-title font-bold text-text-primary">
          {contract.unit?.code ?? contract.contractNo}
        </Text>
        {contract.facility ? (
          <Text className="text-body text-text-secondary">{contract.facility.name}</Text>
        ) : null}
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-body font-medium text-text-primary">{customer.fullName}</Text>
          {customer.phone ? (
            <Pressable
              accessibilityLabel={`Gọi ${customer.phone}`}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-full bg-secondary-0 px-2.5 py-1"
              onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            >
              <Icon color={colors.semantic.textLink} name="phone" size={14} />
              <Text className="text-caption font-semibold text-text-link">{customer.phone}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <StatusPill
        label={contractStatusLabel(contract.status)}
        tone={contractStatusTone(contract.status)}
      />
    </View>
  );
}
