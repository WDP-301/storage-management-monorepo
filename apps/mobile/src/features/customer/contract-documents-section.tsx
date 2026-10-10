import { Text } from 'react-native';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { ApiContract } from '../../types/contract-api';

/** Read-only view of the signed contract files, shared by the customer and staff screens. */
export function ContractDocumentsList({ contract }: { contract: ApiContract }) {
  if (contract.documents.length > 0) return <EvidenceGallery files={contract.documents} />;
  return (
    <Text className="font-body text-body-sm text-muted">
      {contract.status === 'DRAFT'
        ? 'Hợp đồng sẽ có tại đây sau khi bàn giao kho.'
        : 'Chưa có bản hợp đồng đã ký — liên hệ chi nhánh.'}
    </Text>
  );
}
