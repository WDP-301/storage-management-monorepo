import type { ApiContract, CustomerContractResponse } from '../src/types/contract-api';
import { request } from './api';

export const ContractsApi = {
  /** Contracts the signed-in customer holds — the "Kho của tôi" source. */
  listMine: async (signal?: AbortSignal): Promise<ApiContract[]> => {
    const contracts = await request<CustomerContractResponse[]>('/contracts/mine', { signal });
    return contracts.map(normaliseContract);
  },
};

function normaliseContract(contract: CustomerContractResponse): ApiContract {
  return {
    id: contract.id,
    contractNo: contract.contract_no,
    kind: contract.kind,
    status: contract.status,
    effectiveAt: contract.effective_at,
    endedAt: contract.ended_at,
    months: contract.months,
    monthlyPrice: Number(contract.monthly_price),
    deposit: Number(contract.deposit),
    unit: contract.unit
      ? {
          id: contract.unit.id,
          code: contract.unit.code,
          areaM2: Number(contract.unit.area_m2),
          status: contract.unit.status,
          typeName: contract.unit.type_name,
        }
      : null,
    facility: contract.facility
      ? {
          id: contract.facility.id,
          name: contract.facility.name,
          address: contract.facility.address_line,
        }
      : null,
  };
}
