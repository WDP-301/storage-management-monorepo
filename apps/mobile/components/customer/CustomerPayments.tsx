import { IPaymentRecord, MOCK_PAYMENTS } from '@storage/types';
import React, { useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const CustomerPayments: React.FC = () => {
  const [payments, setPayments] = useState<IPaymentRecord[]>(MOCK_PAYMENTS);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'VNPAY' | 'MOMO' | 'BANK_TRANSFER'>('VNPAY');

  const pendingBill = {
    contractCode: 'HD-2026-0045',
    unitCode: 'B-201',
    description: 'Tiền thuê kho tháng 10/2026',
    amount: 1850000,
    dueDate: '2026-10-10',
  };

  const handlePay = () => {
    setShowPayModal(false);
    const newRecord: IPaymentRecord = {
      id: `pay-${Date.now()}`,
      contractCode: pendingBill.contractCode,
      customerName: 'Phạm Hồng Ánh',
      amount: pendingBill.amount,
      type: 'RENT',
      method: selectedMethod,
      status: 'PAID',
      paidAt: 'Vừa thanh toán',
      invoiceUrl: '/invoices/INV-NEW.pdf',
    };
    setPayments([newRecord, ...payments]);
    Alert.alert(
      'Thanh Toán Thành Công!',
      `Đã thanh toán ${pendingBill.amount.toLocaleString()} ₫ qua cổng ${selectedMethod}. Hóa đơn điện tử đã được lưu vào lịch sử.`,
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thanh Toán & Hóa Đơn</Text>
        <Text style={styles.subtitle}>Quản lý tiền thuê, tiền cọc và lịch sử biên lai điện tử</Text>
      </View>

      {/* Pending Bill Card */}
      <View style={styles.billCard}>
        <View style={styles.billHeader}>
          <Text style={styles.billTag}>Hóa đơn đến hạn</Text>
          <Text style={styles.dueDate}>Hạn: {pendingBill.dueDate}</Text>
        </View>

        <Text style={styles.billTitle}>{pendingBill.description}</Text>
        <Text style={styles.billUnit}>
          Kho: {pendingBill.unitCode} • HĐ: {pendingBill.contractCode}
        </Text>

        <View style={styles.billBottom}>
          <Text style={styles.billAmount}>{pendingBill.amount.toLocaleString('vi-VN')} ₫</Text>
          <TouchableOpacity onPress={() => setShowPayModal(true)} style={styles.payNowBtn}>
            <Text style={styles.payNowBtnText}>Thanh toán ngay</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.historyTitle}>Lịch sử thanh toán & Hóa đơn ({payments.length})</Text>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.paymentItem}>
            <View style={styles.paymentLeft}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>💳</Text>
              </View>
              <View>
                <Text style={styles.paymentType}>
                  {item.type === 'DEPOSIT'
                    ? 'Đặt cọc giữ kho'
                    : item.type === 'RENT'
                      ? 'Tiền thuê định kỳ'
                      : 'Phụ phí phát sinh'}
                </Text>
                <Text style={styles.paymentSub}>
                  {item.contractCode} • Cổng: {item.method} • {item.paidAt}
                </Text>
              </View>
            </View>

            <View style={styles.paymentRight}>
              <Text style={styles.paymentAmount}>+{item.amount.toLocaleString('vi-VN')} ₫</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Hóa đơn điện tử', `Đang tải biên lai số của giao dịch ${item.id}...`)
                }
              >
                <Text style={styles.invoiceLink}>Xem hóa đơn</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Payment Gateway Modal */}
      {showPayModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Cổng Thanh Toán Trực Tuyến</Text>
              <Text style={styles.modalSubtitle}>
                Số tiền: {pendingBill.amount.toLocaleString('vi-VN')} ₫
              </Text>

              <Text style={styles.methodTitle}>Chọn phương thức thanh toán:</Text>

              {[
                { id: 'VNPAY', label: 'VNPay QR (Mọi App Ngân Hàng)', icon: '🏦' },
                { id: 'MOMO', label: 'Ví Điện Tử MoMo', icon: '📱' },
                { id: 'BANK_TRANSFER', label: 'Chuyển khoản VietQR 24/7', icon: '⚡' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setSelectedMethod(m.id as any)}
                  style={[styles.methodItem, selectedMethod === m.id && styles.methodItemActive]}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <Text
                    style={[styles.methodText, selectedMethod === m.id && styles.methodTextActive]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={handlePay} style={styles.confirmPayBtn}>
                <Text style={styles.confirmPayBtnText}>Xác nhận thanh toán ngay</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowPayModal(false)} style={styles.cancelPayBtn}>
                <Text style={styles.cancelPayBtnText}>Quay lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, paddingBottom: 6 },
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  billCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billTag: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dueDate: { fontSize: 11, fontWeight: '700', color: '#e11d48' },
  billTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginTop: 10 },
  billUnit: { fontSize: 11, color: '#64748b', marginTop: 2 },
  billBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  billAmount: { fontSize: 18, fontWeight: '900', color: '#2563eb' },
  payNowBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  payNowBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  paymentItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 16 },
  paymentType: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  paymentSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 13, fontWeight: '900', color: '#059669' },
  invoiceLink: { fontSize: 10, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalSubtitle: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 14,
  },
  methodTitle: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 10,
  },
  methodItemActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  methodIcon: { fontSize: 18 },
  methodText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  methodTextActive: { color: '#1d4ed8' },
  confirmPayBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmPayBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  cancelPayBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  cancelPayBtnText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
});
