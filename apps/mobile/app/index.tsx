import { IStorageUnit, UnitSizeCategory } from '@storage/types';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CustomerExplore } from '../components/customer/CustomerExplore';
import { CustomerMyUnits } from '../components/customer/CustomerMyUnits';
import { CustomerPayments } from '../components/customer/CustomerPayments';
import { CustomerSupport } from '../components/customer/CustomerSupport';
import { StaffDailyTasks } from '../components/staff/StaffDailyTasks';
import { StaffInspectionHandover } from '../components/staff/StaffInspectionHandover';
import { StaffQrScanner } from '../components/staff/StaffQrScanner';
import { StaffShiftInventory } from '../components/staff/StaffShiftInventory';

type MobileRole = 'CUSTOMER' | 'STAFF';
type CustomerTab = 'EXPLORE' | 'MY_UNITS' | 'PAYMENTS' | 'SUPPORT';
type StaffTab = 'TASKS' | 'QR_SCAN' | 'HANDOVER' | 'SHIFT';

export default function MobileApp() {
  const [role, setRole] = useState<MobileRole>('CUSTOMER');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('EXPLORE');
  const [staffTab, setStaffTab] = useState<StaffTab>('TASKS');

  // Staff inspection modal
  const [inspectionTarget, setInspectionTarget] = useState<{
    unitCode: string;
    type: 'HANDOVER' | 'RETURN';
  } | null>(null);

  // Handle Customer booking a unit
  const handleBookUnit = (unit: IStorageUnit) => {
    Alert.alert(
      'Đặt Kho Thành Công!',
      `Bạn đã đặt trước Unit ${unit.code} (${unit.categoryLabel}).\nTiền cọc: ${unit.depositAmount.toLocaleString()} ₫.\nVui lòng vào tab "Kho của tôi" để lấy mã QR nhận kho.`,
      [
        {
          text: 'Vào Kho của tôi',
          onPress: () => setCustomerTab('MY_UNITS'),
        },
      ],
    );
  };

  // Handle joining Waitlist
  const handleJoinWaitlist = (category: UnitSizeCategory) => {
    Alert.alert(
      'Đã Tham Gia Waitlist!',
      `Hệ thống đã ghi nhận bạn đang chờ loại kho ${category}. Chúng tôi sẽ gửi thông báo đẩy ngay khi có kho trống!`,
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Role Mode Switcher Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>StorageHub</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>
              {role === 'CUSTOMER' ? 'Khách hàng' : 'Nhân viên'}
            </Text>
          </View>
        </View>

        {/* Switcher Toggle */}
        <View style={styles.roleSwitcher}>
          <TouchableOpacity
            onPress={() => setRole('CUSTOMER')}
            style={[styles.roleBtn, role === 'CUSTOMER' && styles.roleBtnActive]}
          >
            <Text style={[styles.roleBtnText, role === 'CUSTOMER' && styles.roleBtnTextActive]}>
              👤 Khách Thuê
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRole('STAFF')}
            style={[styles.roleBtn, role === 'STAFF' && styles.roleBtnActive]}
          >
            <Text style={[styles.roleBtnText, role === 'STAFF' && styles.roleBtnTextActive]}>
              👷 Nhân Viên
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Body */}
      <View style={styles.body}>
        {role === 'CUSTOMER' ? (
          <>
            {customerTab === 'EXPLORE' && (
              <CustomerExplore onBookUnit={handleBookUnit} onJoinWaitlist={handleJoinWaitlist} />
            )}
            {customerTab === 'MY_UNITS' && <CustomerMyUnits />}
            {customerTab === 'PAYMENTS' && <CustomerPayments />}
            {customerTab === 'SUPPORT' && <CustomerSupport />}
          </>
        ) : (
          <>
            {staffTab === 'TASKS' && (
              <StaffDailyTasks
                onStartInspection={(unitCode, type) => setInspectionTarget({ unitCode, type })}
                onOpenQrScanner={() => setStaffTab('QR_SCAN')}
              />
            )}
            {staffTab === 'QR_SCAN' && (
              <StaffQrScanner
                onScanResult={(_qrCode) => {
                  setStaffTab('HANDOVER');
                  setInspectionTarget({ unitCode: 'A-103', type: 'HANDOVER' });
                }}
                onClose={() => setStaffTab('TASKS')}
              />
            )}
            {staffTab === 'HANDOVER' && (
              <StaffInspectionHandover
                unitCode={inspectionTarget?.unitCode || 'A-103'}
                inspectionType={inspectionTarget?.type || 'HANDOVER'}
                onComplete={() => {
                  setInspectionTarget(null);
                  setStaffTab('TASKS');
                }}
                onCancel={() => {
                  setInspectionTarget(null);
                  setStaffTab('TASKS');
                }}
              />
            )}
            {staffTab === 'SHIFT' && <StaffShiftInventory />}
          </>
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {role === 'CUSTOMER' ? (
          <>
            <TouchableOpacity onPress={() => setCustomerTab('EXPLORE')} style={styles.navItem}>
              <Text style={styles.navIcon}>{customerTab === 'EXPLORE' ? '🔍' : '🔎'}</Text>
              <Text style={[styles.navLabel, customerTab === 'EXPLORE' && styles.navLabelActive]}>
                Khám phá
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCustomerTab('MY_UNITS')} style={styles.navItem}>
              <Text style={styles.navIcon}>{customerTab === 'MY_UNITS' ? '📦' : '🗃️'}</Text>
              <Text style={[styles.navLabel, customerTab === 'MY_UNITS' && styles.navLabelActive]}>
                Kho của tôi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCustomerTab('PAYMENTS')} style={styles.navItem}>
              <Text style={styles.navIcon}>{customerTab === 'PAYMENTS' ? '💳' : '👛'}</Text>
              <Text style={[styles.navLabel, customerTab === 'PAYMENTS' && styles.navLabelActive]}>
                Thanh toán
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCustomerTab('SUPPORT')} style={styles.navItem}>
              <Text style={styles.navIcon}>{customerTab === 'SUPPORT' ? '🔔' : '💬'}</Text>
              <Text style={[styles.navLabel, customerTab === 'SUPPORT' && styles.navLabelActive]}>
                Hỗ trợ
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setStaffTab('TASKS')} style={styles.navItem}>
              <Text style={styles.navIcon}>{staffTab === 'TASKS' ? '📋' : '📑'}</Text>
              <Text style={[styles.navLabel, staffTab === 'TASKS' && styles.navLabelActive]}>
                Ca trực
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStaffTab('QR_SCAN')} style={styles.navItem}>
              <Text style={styles.navIcon}>{staffTab === 'QR_SCAN' ? '📷' : '📱'}</Text>
              <Text style={[styles.navLabel, staffTab === 'QR_SCAN' && styles.navLabelActive]}>
                Quét QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStaffTab('HANDOVER')} style={styles.navItem}>
              <Text style={styles.navIcon}>{staffTab === 'HANDOVER' ? '✍️' : '📝'}</Text>
              <Text style={[styles.navLabel, staffTab === 'HANDOVER' && styles.navLabelActive]}>
                Nghiệm thu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStaffTab('SHIFT')} style={styles.navItem}>
              <Text style={styles.navIcon}>{staffTab === 'SHIFT' ? '🔑' : '🗄️'}</Text>
              <Text style={[styles.navLabel, staffTab === 'SHIFT' && styles.navLabelActive]}>
                Bàn giao ca
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  roleTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: { fontSize: 9, fontWeight: '700', color: '#475569' },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 2,
  },
  roleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  roleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  roleBtnTextActive: { color: '#0f172a' },
  body: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  navLabelActive: { color: '#2563eb' },
});
