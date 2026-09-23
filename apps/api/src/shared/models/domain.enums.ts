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

export const ContractStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

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

export const TicketType = {
  SUPPORT: 'SUPPORT',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type TicketType = (typeof TicketType)[keyof typeof TicketType];

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

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

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
