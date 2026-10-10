import { Button } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { handoverBlockedReason } from '../../../lib/contract-files';
import type { StaffContract } from '../../../lib/staff-contracts-api';
import { contractStatusLabel, contractStatusTone, StatusPill } from '../customer/contract-display';
import { ContractDocumentsList } from '../customer/contract-documents-section';
import { ContractSection, HandoverSection, ReturnSection } from '../customer/contract-sections';
import { ContractDocumentsEditor } from './ContractDocumentsEditor';
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
      <View className="flex-1 items-center justify-center px-6">
        {error ? (
          <Text className="font-body text-center text-body-sm text-danger">{error}</Text>
        ) : (
          <ActivityIndicator />
        )}
        <Button variant="ghost" className="mt-4" onPress={onBack}>
          <Button.Label>← Quay lại</Button.Label>
        </Button>
      </View>
    );
  }

  const { permissions } = contract;
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onReload} />}
    >
      <View className="gap-4 px-4 pb-4 pt-5">
        <Button variant="ghost" size="sm" className="self-start" onPress={onBack}>
          <Button.Label>← Hôm nay</Button.Label>
        </Button>
        <Header contract={contract} />
        {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}

        <ContractSection contract={contract}>
          {permissions.documents ? (
            <ContractDocumentsEditor
              contractId={contract.id}
              files={contract.documents}
              onSaved={onReload}
              onUploadingChange={onDocumentsBusyChange}
              onStale={onReload}
            />
          ) : (
            <ContractDocumentsList contract={contract} />
          )}
        </ContractSection>

        {permissions.handover ? (
          <StaffInspectionSection
            kind="handover"
            detail={handover}
            finalizeBlockedReason={handoverBlockedReason(
              contract.documents.length,
              savingDocuments,
            )}
            onFinalized={onReload}
          />
        ) : (
          <HandoverSection handover={contract.handover} viewer="staff" />
        )}

        {permissions.return ? (
          <StaffInspectionSection kind="return" detail={returnDetail} onFinalized={onReload} />
        ) : (
          <ReturnSection inspection={contract.return} viewer="staff" />
        )}
      </View>
    </ScrollView>
  );
}

function Header({ contract }: { contract: StaffContract }) {
  const { customer } = contract;
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-title-md font-strong tracking-tight text-foreground">
          {contract.unit?.code ?? contract.contractNo}
        </Text>
        {contract.facility ? (
          <Text className="font-body mt-1 text-body-sm text-muted">{contract.facility.name}</Text>
        ) : null}
        <Text className="font-body mt-1 text-body-sm text-foreground">
          {customer.fullName}
          {customer.phone ? ` · ${customer.phone}` : ''}
        </Text>
      </View>
      <StatusPill
        label={contractStatusLabel(contract.status)}
        tone={contractStatusTone(contract.status)}
      />
    </View>
  );
}
