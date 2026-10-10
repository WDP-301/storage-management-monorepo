import type { ContractStatus } from '@storage/types';
import type { EvidenceFile } from '../src/types/contract-api';
import { request } from './api';
import { isEvidenceFile } from './evidence';

type ReplaceDocumentsResponse = {
  id: string;
  status: ContractStatus;
  documents: unknown[] | null;
};

export const ContractDocumentsApi = {
  /** Replaces the whole signed-file list; the server validates permission and contract state. */
  replace: async (contractId: string, documents: EvidenceFile[]): Promise<EvidenceFile[]> => {
    const res = await request<ReplaceDocumentsResponse>(`/contracts/${contractId}/documents`, {
      method: 'PUT',
      body: JSON.stringify({ documents }),
    });
    return (res.documents ?? []).filter(isEvidenceFile);
  },
};
