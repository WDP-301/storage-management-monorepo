import { EvidenceGallery } from '../../components/EvidenceGallery';
import { Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';

/** Read-only view of the signed contract files, shared by the customer and staff screens. */
export function ContractDocumentsList({ contract }: { contract: ApiContract }) {
  if (contract.documents.length > 0) return <EvidenceGallery files={contract.documents} />;
  return (
    <Text className="text-body-sm text-text-secondary">
      {contract.status === 'DRAFT'
        ? 'Hợp đồng sẽ có tại đây sau khi bàn giao kho.'
        : 'Chưa có bản hợp đồng đã ký — liên hệ chi nhánh.'}
    </Text>
  );
}
