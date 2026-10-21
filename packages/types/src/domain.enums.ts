export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  FACILITY_STAFF: 'FACILITY_STAFF',
  FACILITY_MANAGER: 'FACILITY_MANAGER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const FacilityStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type FacilityStatus = (typeof FacilityStatus)[keyof typeof FacilityStatus];

export const StorageUnitStatus = {
  AVAILABLE: 'AVAILABLE',
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  RENTED: 'RENTED',
  PENDING_INSPECTION: 'PENDING_INSPECTION',
  MAINTENANCE: 'MAINTENANCE',
  INACTIVE: 'INACTIVE',
} as const;
export type StorageUnitStatus = (typeof StorageUnitStatus)[keyof typeof StorageUnitStatus];

/** SELF_STORAGE: a whole rentable warehouse; SHELF_WAREHOUSE: a building rented per shelf; SHELF: a rentable child of it. */
export const StorageUnitKind = {
  SELF_STORAGE: 'SELF_STORAGE',
  SHELF_WAREHOUSE: 'SHELF_WAREHOUSE',
  SHELF: 'SHELF',
} as const;
export type StorageUnitKind = (typeof StorageUnitKind)[keyof typeof StorageUnitKind];

/** Non-shelf things drawn on a shelf warehouse floor plan; shelves are placements, not elements. */
export const LayoutElementType = {
  DOOR: 'DOOR',
  AISLE: 'AISLE',
  OBSTACLE: 'OBSTACLE',
  LABEL: 'LABEL',
} as const;
export type LayoutElementType = (typeof LayoutElementType)[keyof typeof LayoutElementType];

export const BookingStatus = {
  DRAFT: 'DRAFT',
  HOLDING: 'HOLDING',
  PENDING_DEPOSIT: 'PENDING_DEPOSIT',
  CONFIRMED: 'CONFIRMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const HoldStatus = {
  ACTIVE: 'ACTIVE',
  CONVERTED: 'CONVERTED',
  EXPIRED: 'EXPIRED',
  RELEASED: 'RELEASED',
} as const;
export type HoldStatus = (typeof HoldStatus)[keyof typeof HoldStatus];

export const IdempotencyStatus = {
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
} as const;
export type IdempotencyStatus = (typeof IdempotencyStatus)[keyof typeof IdempotencyStatus];

export const ContractStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const ContractKind = {
  INITIAL: 'INITIAL',
  RENEWAL: 'RENEWAL',
} as const;
export type ContractKind = (typeof ContractKind)[keyof typeof ContractKind];

export const ContractUnitStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  TRANSITIONING: 'TRANSITIONING',
  ENDED: 'ENDED',
} as const;
export type ContractUnitStatus = (typeof ContractUnitStatus)[keyof typeof ContractUnitStatus];

export const RentalPeriodKind = {
  INITIAL: 'INITIAL',
  RENEWAL: 'RENEWAL',
} as const;
export type RentalPeriodKind = (typeof RentalPeriodKind)[keyof typeof RentalPeriodKind];

/** Rental-period invoices reuse the period kinds; SETTLEMENT bills what the deposit could not cover. */
export const InvoiceKind = {
  ...RentalPeriodKind,
  SETTLEMENT: 'SETTLEMENT',
} as const;
export type InvoiceKind = (typeof InvoiceKind)[keyof typeof InvoiceKind];

export const ChangeRequestStatus = {
  REQUESTED: 'REQUESTED',
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  TRANSITIONING: 'TRANSITIONING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type ChangeRequestStatus = (typeof ChangeRequestStatus)[keyof typeof ChangeRequestStatus];

export const WaitlistStatus = {
  WAITING: 'WAITING',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type WaitlistStatus = (typeof WaitlistStatus)[keyof typeof WaitlistStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceItemType = {
  RENT: 'RENT',
  DEPOSIT: 'DEPOSIT',
  DAMAGE: 'DAMAGE',
  SERVICE: 'SERVICE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type InvoiceItemType = (typeof InvoiceItemType)[keyof typeof InvoiceItemType];

export const PaymentType = {
  RENT: 'RENT',
  DEPOSIT: 'DEPOSIT',
  FEE: 'FEE',
  MIXED: 'MIXED',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  VNPAY: 'VNPAY',
  MOMO: 'MOMO',
  SIMULATED: 'SIMULATED',
  /** Money taken from the customer's held deposit when the contract is settled — no new transfer. */
  DEPOSIT: 'DEPOSIT',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const DepositStatus = {
  PENDING: 'PENDING',
  HELD: 'HELD',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  FORFEITED: 'FORFEITED',
} as const;
export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus];

export const RefundStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

/** A deposit settlement exists only once approved; "pending" is the absence of a row. */
export const SettlementStatus = {
  AWAITING_REFUND: 'AWAITING_REFUND',
  COMPLETED: 'COMPLETED',
} as const;
export type SettlementStatus = (typeof SettlementStatus)[keyof typeof SettlementStatus];

export const SettlementLineType = {
  /** Rent still owed for a period that started before the return day. */
  UNPAID_INVOICE: 'UNPAID_INVOICE',
  /** Returned before the term ended without the required notice: one month of rent. */
  EARLY_RETURN_SHORT_NOTICE: 'EARLY_RETURN_SHORT_NOTICE',
  /** Days kept past the end of the term, charged per day. */
  OVERSTAY: 'OVERSTAY',
  DAMAGE: 'DAMAGE',
  /** Rent paid for a period the customer no longer uses; added back to the refund. */
  UNUSED_PERIOD_CREDIT: 'UNUSED_PERIOD_CREDIT',
  /** Money received that staff must confirm before it is added back to the refund. */
  REVIEW_PAYMENT_CREDIT: 'REVIEW_PAYMENT_CREDIT',
} as const;
export type SettlementLineType = (typeof SettlementLineType)[keyof typeof SettlementLineType];

/** Who asked for a return: the customer, or the branch on the customer's behalf. */
export const ReturnRequestSource = {
  CUSTOMER: 'CUSTOMER',
  /** The customer phoned the branch. */
  HOTLINE: 'HOTLINE',
  /** The customer left and stopped responding; the branch takes the unit back. */
  ABANDONED: 'ABANDONED',
} as const;
export type ReturnRequestSource = (typeof ReturnRequestSource)[keyof typeof ReturnRequestSource];

export const AccessEventType = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
} as const;
export type AccessEventType = (typeof AccessEventType)[keyof typeof AccessEventType];

export const InspectionType = {
  PRE_HANDOVER: 'PRE_HANDOVER',
  RETURN: 'RETURN',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

export const InspectionStatus = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  DAMAGE_FOUND: 'DAMAGE_FOUND',
} as const;
export type InspectionStatus = (typeof InspectionStatus)[keyof typeof InspectionStatus];

export const DamageSeverity = {
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
} as const;
export type DamageSeverity = (typeof DamageSeverity)[keyof typeof DamageSeverity];

export const DamageFeeStatus = {
  PROPOSED: 'PROPOSED',
  CONFIRMED: 'CONFIRMED',
  WAIVED: 'WAIVED',
  PAID: 'PAID',
} as const;
export type DamageFeeStatus = (typeof DamageFeeStatus)[keyof typeof DamageFeeStatus];

export const HandoverDirection = {
  HANDOVER: 'HANDOVER',
  RETURN: 'RETURN',
} as const;
export type HandoverDirection = (typeof HandoverDirection)[keyof typeof HandoverDirection];

export const AssetType = {
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
  SIGNATURE: 'SIGNATURE',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const TicketPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/** What happened — stored in `notifications.type` so clients can pick an icon / deep link. */
export const NotificationType = {
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_UPDATED: 'TICKET_UPDATED',
  INVOICE_ISSUED: 'INVOICE_ISSUED',
  INVOICE_PAID: 'INVOICE_PAID',
  RETURN_FINALIZED: 'RETURN_FINALIZED',
  SETTLEMENT_APPROVED: 'SETTLEMENT_APPROVED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  CONTRACT_TERM_ENDING: 'CONTRACT_TERM_ENDING',
  CONTRACT_OVERDUE: 'CONTRACT_OVERDUE',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const DocumentType = {
  IDENTITY: 'IDENTITY',
  CONTRACT: 'CONTRACT',
  INVOICE: 'INVOICE',
  HANDOVER: 'HANDOVER',
  POLICY: 'POLICY',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const FeedbackStatus = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
} as const;
export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus];

export const TourAppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ASSIGNED: 'ASSIGNED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type TourAppointmentStatus =
  (typeof TourAppointmentStatus)[keyof typeof TourAppointmentStatus];
