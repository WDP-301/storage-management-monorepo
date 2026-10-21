export type {
  ApproveSettlementInput,
  CompleteRefundInput,
  ContractSettlementStatus,
  EvidenceFile,
  ManagedReturnRequestInput,
  RefundBankAccount,
  RefundBankAccountInput,
  ReturnRequestSource,
  SettlementDamage,
  SettlementDecisionsInput,
  SettlementDetailRecord,
  SettlementLine,
  SettlementLineType,
  SettlementTotals,
  SettlementWarning,
} from '@storage/types';

/** `settlementStatus` filter of `GET /contracts`. */
export type SettlementStatusFilter = 'pending' | 'awaiting_refund' | 'completed';

/** Settlement lines a reviewer may waive, with a reason. */
export type WaivableLineType = 'EARLY_RETURN_SHORT_NOTICE' | 'OVERSTAY';
