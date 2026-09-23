import { Badge, Breadcrumbs, Sidebar as KumoSidebar } from '@cloudflare/kumo';
import {
  IFacility,
  IStorageUnit,
  MOCK_AUDIT_LOGS,
  MOCK_CONTRACTS,
  MOCK_FACILITIES,
  MOCK_INSPECTIONS,
  MOCK_KEY_INVENTORY,
  MOCK_PERMISSION_TEMPLATES,
  MOCK_PROMOTIONS,
  MOCK_SHIFT_NOTES,
  MOCK_STAFF,
  MOCK_UNITS,
  MOCK_WAITLIST,
  UnitStatus,
  UserRole,
} from '@storage/types';
import { useEffect, useState } from 'react';

import { RolePermissions } from './components/admin/RolePermissions';
import { SecurityAuditLogs } from './components/admin/SecurityAuditLogs';
import { UserManagement } from './components/admin/UserManagement';
import { ContractTracking } from './components/facility-manager/ContractTracking';
import { FacilityDashboard } from './components/facility-manager/FacilityDashboard';
import { FloorPlanMap } from './components/facility-manager/FloorPlanMap';
import { MaintenanceLogs } from './components/facility-manager/MaintenanceLogs';
import { StaffWorkload } from './components/facility-manager/StaffWorkload';
import { UnitManagement } from './components/facility-manager/UnitManagement';
import { WaitlistManagement } from './components/facility-manager/WaitlistManagement';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ExecutiveReports } from './components/ops-manager/ExecutiveReports';
import { FacilityMaster } from './components/ops-manager/FacilityMaster';
import { OpsDashboard } from './components/ops-manager/OpsDashboard';
import { PricingPolicies } from './components/ops-manager/PricingPolicies';
import { PromotionCoupons } from './components/ops-manager/PromotionCoupons';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('FACILITY_MANAGER');
  const [activeTab, setActiveTab] = useState<string>('facility-dashboard');
  const [selectedFacility, setSelectedFacility] = useState<IFacility>(MOCK_FACILITIES[0]);
  const [units, setUnits] = useState<IStorageUnit[]>(MOCK_UNITS);
  const [mode, setMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('theme-mode') as 'light' | 'dark') || 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'FACILITY_MANAGER') setActiveTab('facility-dashboard');
    else if (role === 'OPERATIONS_MANAGER') setActiveTab('ops-dashboard');
    else if (role === 'ADMIN') setActiveTab('users');
  };

  const handleUpdateUnitStatus = (unitId: string, newStatus: UnitStatus) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u)));
  };

  const handleBulkUpdateStatus = (unitIds: string[], status: UnitStatus) => {
    setUnits((prev) => prev.map((u) => (unitIds.includes(u.id) ? { ...u, status } : u)));
  };

  const handleBulkUpdatePrice = (unitIds: string[], price: number) => {
    setUnits((prev) =>
      prev.map((u) => (unitIds.includes(u.id) ? { ...u, pricePerMonth: price } : u)),
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        facilities={MOCK_FACILITIES}
        selectedFacility={selectedFacility}
        onFacilityChange={setSelectedFacility}
        mode={mode}
        onToggleMode={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
      />

      {/* Breadcrumb & Context Bar */}
      <div className="bg-kumo-base border-b border-kumo-hairline px-6 py-2 flex items-center justify-between">
        <Breadcrumbs size="sm">
          <Breadcrumbs.Link href="#">StorageHub</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Link href="#">
            {currentRole === 'ADMIN'
              ? 'System Admin'
              : currentRole === 'OPERATIONS_MANAGER'
                ? 'Multi-Zone Fleet'
                : selectedFacility.city}
          </Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>
            {currentRole === 'ADMIN'
              ? 'Access & Audit'
              : currentRole === 'OPERATIONS_MANAGER'
                ? 'All Zones'
                : selectedFacility.name}
          </Breadcrumbs.Current>
        </Breadcrumbs>
        <Badge variant="success" appearance="dot">
          Active
        </Badge>
      </div>

      <KumoSidebar.Provider
        defaultOpen
        collapsible="icon"
        className="flex flex-1 min-h-[calc(100vh-100px)]"
      >
        {/* Sidebar */}
        <Sidebar currentRole={currentRole} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full overflow-x-hidden">
          {/* FACILITY MANAGER VIEWS */}
          {currentRole === 'FACILITY_MANAGER' && (
            <>
              {activeTab === 'facility-dashboard' && (
                <FacilityDashboard
                  facility={selectedFacility}
                  units={units}
                  onNavigateTab={setActiveTab}
                />
              )}
              {activeTab === 'floor-plan' && (
                <FloorPlanMap
                  facility={selectedFacility}
                  units={units}
                  onUpdateUnitStatus={handleUpdateUnitStatus}
                />
              )}
              {activeTab === 'units' && (
                <UnitManagement
                  units={units}
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkUpdatePrice={handleBulkUpdatePrice}
                />
              )}
              {activeTab === 'contracts' && <ContractTracking contracts={MOCK_CONTRACTS} />}
              {activeTab === 'handover-return' && (
                <MaintenanceLogs inspections={MOCK_INSPECTIONS} />
              )}
              {activeTab === 'waitlist' && (
                <WaitlistManagement waitlist={MOCK_WAITLIST} availableUnits={units} />
              )}
              {activeTab === 'staff-workload' && (
                <StaffWorkload
                  staffList={MOCK_STAFF}
                  shiftNotes={MOCK_SHIFT_NOTES}
                  keyInventory={MOCK_KEY_INVENTORY}
                />
              )}
              {activeTab === 'maintenance' && <MaintenanceLogs inspections={MOCK_INSPECTIONS} />}
              {activeTab === 'facility-audit' && <SecurityAuditLogs auditLogs={MOCK_AUDIT_LOGS} />}
            </>
          )}

          {/* OPERATIONS MANAGER VIEWS */}
          {currentRole === 'OPERATIONS_MANAGER' && (
            <>
              {activeTab === 'ops-dashboard' && (
                <OpsDashboard
                  facilities={MOCK_FACILITIES}
                  onSelectFacility={(fac) => {
                    setSelectedFacility(fac);
                    handleRoleChange('FACILITY_MANAGER');
                  }}
                  onNavigateTab={setActiveTab}
                />
              )}
              {activeTab === 'facilities-master' && (
                <FacilityMaster
                  facilities={MOCK_FACILITIES}
                  onSelectFacility={(fac) => {
                    setSelectedFacility(fac);
                    handleRoleChange('FACILITY_MANAGER');
                  }}
                />
              )}
              {activeTab === 'pricing-policies' && <PricingPolicies />}
              {activeTab === 'promotions' && <PromotionCoupons promotions={MOCK_PROMOTIONS} />}
              {activeTab === 'executive-reports' && <ExecutiveReports />}
            </>
          )}

          {/* ADMIN VIEWS */}
          {currentRole === 'ADMIN' && (
            <>
              {activeTab === 'users' && <UserManagement />}
              {activeTab === 'roles-permissions' && (
                <RolePermissions permissionTemplates={MOCK_PERMISSION_TEMPLATES} />
              )}
              {activeTab === 'security-logs' && <SecurityAuditLogs auditLogs={MOCK_AUDIT_LOGS} />}
              {activeTab === 'system-audit' && <SecurityAuditLogs auditLogs={MOCK_AUDIT_LOGS} />}
            </>
          )}
        </main>
      </KumoSidebar.Provider>
    </div>
  );
}
