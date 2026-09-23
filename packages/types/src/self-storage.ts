export type UserRole =
  | 'CUSTOMER'
  | 'FACILITY_STAFF'
  | 'FACILITY_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'ADMIN';

export const UnitStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
  OVERDUE: 'OVERDUE',
} as const;
export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const UnitSizeCategory = {
  LOCKER: 'LOCKER',
  MINI: 'MINI',
  STANDARD: 'STANDARD',
  LARGE: 'LARGE',
  CLIMATE_CONTROLLED: 'CLIMATE_CONTROLLED',
} as const;
export type UnitSizeCategory = (typeof UnitSizeCategory)[keyof typeof UnitSizeCategory];

export interface IFacility {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  managerName: string;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  occupancyRate: number;
  zones: string[];
  amenities: string[];
  operatingHours: string;
  imageUrl?: string;
  isFavorite?: boolean;
}

export interface IStorageUnit {
  id: string;
  facilityId: string;
  facilityName?: string;
  code: string;
  zone: string;
  floor: number;
  category: UnitSizeCategory;
  categoryLabel: string;
  dimensions: {
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  areaM2: number;
  volumeM3: number;
  pricePerMonth: number;
  depositAmount: number;
  status: UnitStatus;
  currentRenter?: {
    name: string;
    phone: string;
    email: string;
    contractCode: string;
    startDate: string;
    endDate: string;
  };
  features: string[];
  isClimateControlled?: boolean;
  notes?: string;
}

export const ContractStatus = {
  PENDING_HANDOVER: 'PENDING_HANDOVER',
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  OVERDUE: 'OVERDUE',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export interface IRentalContract {
  id: string;
  contractCode: string;
  unitId: string;
  unitCode: string;
  facilityId: string;
  facilityName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  depositSettled?: number;
  refundAmount?: number;
  damageDeductions?: number;
  status: ContractStatus;
  qrPassCode: string;
  pinCode: string;
  assignedAccessCardId?: string;
  assignedKeyId?: string;
  autoRenew: boolean;
  notes?: string;
  createdAt: string;
}

export interface IPaymentRecord {
  id: string;
  contractCode: string;
  customerName: string;
  amount: number;
  type: 'DEPOSIT' | 'RENT' | 'INCIDENTAL' | 'REFUND';
  method: 'VNPAY' | 'MOMO' | 'BANK_TRANSFER' | 'CASH';
  status: 'PAID' | 'PENDING' | 'REFUNDED';
  paidAt: string;
  invoiceUrl?: string;
}

export interface IWaitlistEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  facilityId: string;
  preferredCategory: UnitSizeCategory;
  desiredStartDate: string;
  createdAt: string;
  status: 'WAITING' | 'OFFERED' | 'EXPIRED' | 'CONVERTED';
}

export interface IInspectionRecord {
  id: string;
  unitCode: string;
  facilityId: string;
  staffName: string;
  type: 'HANDOVER' | 'RETURN' | 'ROUTINE';
  cleanlinessScore: number;
  hasDamage: boolean;
  damageDescription?: string;
  damageFine: number;
  photoUrls: string[];
  customerSignature?: string;
  staffSignature?: string;
  inspectedAt: string;
  status: 'PASSED' | 'FAILED_WITH_PENALTY' | 'PENDING_CONFIRMATION';
}

export interface IKeyInventoryItem {
  id: string;
  code: string;
  type: 'PHYSICAL_KEY' | 'ACCESS_CARD' | 'SMART_PADLOCK';
  facilityId: string;
  assignedUnitCode?: string;
  status: 'IN_STOCK' | 'ASSIGNED' | 'LOST' | 'DAMAGED';
  lastCheckedAt: string;
}

export interface IShiftHandoverNote {
  id: string;
  facilityId: string;
  fromStaffName: string;
  toStaffName: string;
  shift: 'SÁNG (07:00 - 15:00)' | 'CHIỀU (14:30 - 22:30)' | 'ĐÊM (22:00 - 07:00)';
  date: string;
  keySummary: string;
  pendingTasks: string[];
  resolvedIssues: string[];
  urgentAlerts?: string;
}

export interface IStaffMember {
  id: string;
  name: string;
  role: string;
  facilityId: string;
  shift: string;
  avatarUrl?: string;
  activeTasksCount: number;
  completedTodayCount: number;
  performanceScore: number;
}

export interface IAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  target: string;
  facilityName?: string;
  ipAddress: string;
  details: string;
}

export interface IPermissionTemplate {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: {
    canViewFinancials: boolean;
    canApproveRefund: boolean;
    canAssignUnits: boolean;
    canModifyPricing: boolean;
    canInspectUnits: boolean;
    canManageStaff: boolean;
    canViewSystemLogs: boolean;
  };
}

export interface IPromotionCoupon {
  id: string;
  code: string;
  description: string;
  discountPercent: number;
  minRentalMonths: number;
  facilityScope: string;
  validUntil: string;
  usageCount: number;
  isActive: boolean;
}
