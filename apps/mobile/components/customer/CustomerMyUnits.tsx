import { IRentalContract, MOCK_CONTRACTS } from '@storage/types';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const CustomerMyUnits: React.FC = () => {
  const [contracts, _setContracts] = useState<IRentalContract[]>(MOCK_CONTRACTS);
  const [selectedContract, _setSelectedContract] = useState<IRentalContract>(contracts[0]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showContractDocModal, setShowContractDocModal] = useState(false);

  const handleRenew = (months: number) => {
    setShowRenewalModal(false);
    Alert.alert(
      'Gia Hạn Thành Công!',
      `Hợp đồng ${selectedContract.contractCode} đã được gia hạn thêm ${months} tháng. Hệ thống đã xuất hóa đơn kỳ mới.`,
    );
  };

  const handleRequestReturn = () => {
    setShowReturnModal(false);
    Alert.alert(
      'Đã Gửi Yêu Cầu Trả Kho',
      `Yêu cầu nghiệm thu trả kho cho Unit ${selectedContract.unitCode} đã được gửi tới nhân viên cơ sở. Vui lòng mang chìa khóa và thẻ từ tới quầy lễ tân để hoàn tất thủ tục hoàn cọc.`,
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kho Đang Thuê (My Storage)</Text>
      <Text style={styles.subtitle}>Quản lý thẻ truy cập QR, mã PIN và thời hạn hợp đồng</Text>

      {/* Main Active Unit Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeActive}>
            <Text style={styles.badgeActiveText}>● Đang hoạt động</Text>
          </View>
          <Text style={styles.contractCode}>{selectedContract.contractCode}</Text>
        </View>

        <View style={styles.unitHero}>
          <Text style={styles.unitHeroCode}>{selectedContract.unitCode}</Text>
          <View>
            <Text style={styles.facilityName}>{selectedContract.facilityName}</Text>
            <Text style={styles.unitDates}>
              Thời hạn: {selectedContract.startDate} → {selectedContract.endDate}
            </Text>
          </View>
        </View>

        {/* Access Codes Info Box */}
        <View style={styles.accessBox}>
          <View style={styles.accessItem}>
            <Text style={styles.accessLabel}>Mã PIN Cửa kho</Text>
            <Text style={styles.accessValue}>{selectedContract.pinCode}</Text>
          </View>
          <View style={styles.accessDivider} />
          <View style={styles.accessItem}>
            <Text style={styles.accessLabel}>Thẻ từ gán</Text>
            <Text style={styles.accessValue}>
              {selectedContract.assignedAccessCardId || 'CARD-SG-018'}
            </Text>
          </View>
          <View style={styles.accessDivider} />
          <View style={styles.accessItem}>
            <Text style={styles.accessLabel}>Cọc bảo lưu</Text>
            <Text style={styles.accessValue}>
              {(selectedContract.depositAmount / 1000).toLocaleString()}k ₫
            </Text>
          </View>
        </View>

        {/* QR Access Button */}
        <TouchableOpacity onPress={() => setShowQrModal(true)} style={styles.qrPassBtn}>
          <Text style={styles.qrPassBtnText}>📱 Mở Smart QR Pass Check-in / Mở Cửa</Text>
        </TouchableOpacity>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => setShowRenewalModal(true)}
            style={styles.actionBtnSecondary}
          >
            <Text style={styles.actionBtnSecondaryText}>🔄 Gia hạn thuê</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowContractDocModal(true)}
            style={styles.actionBtnSecondary}
          >
            <Text style={styles.actionBtnSecondaryText}>📄 Xem hợp đồng</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowReturnModal(true)} style={styles.actionBtnDanger}>
            <Text style={styles.actionBtnDangerText}>🚪 Trả kho</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tips & Safety Rules */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>🛡️ Nội quy & An toàn cơ sở</Text>
        <Text style={styles.ruleItem}>• Cổng an ninh tự động nhận diện mã QR của bạn 24/7.</Text>
        <Text style={styles.ruleItem}>
          • Nghiêm cấm lưu trữ hóa chất độc hại, chất nổ, pin xe điện.
        </Text>
        <Text style={styles.ruleItem}>• Xe đẩy hàng luôn có sẵn tại sảnh tầng 1 miễn phí.</Text>
      </View>

      {/* QR Pass Full Modal */}
      {showQrModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.qrModalCard}>
              <Text style={styles.qrModalTitle}>Smart QR Access Pass</Text>
              <Text style={styles.qrModalSub}>Quét tại cổng trượt & cửa kho của bạn</Text>

              {/* Simulated QR Code Box */}
              <View style={styles.qrCodeContainer}>
                <View style={styles.qrBox}>
                  <Text style={styles.qrMockText}>[ ■■■ STORAGE-QR ■■■ ]</Text>
                  <Text style={styles.qrMockCode}>{selectedContract.qrPassCode}</Text>
                  <Text style={styles.qrMockSub}>Tự động đổi mã sau: 59s</Text>
                </View>
              </View>

              <View style={styles.qrInfoBox}>
                <Text style={styles.qrInfoText}>Khách hàng: {selectedContract.customerName}</Text>
                <Text style={styles.qrInfoText}>
                  Unit: {selectedContract.unitCode} • PIN: {selectedContract.pinCode}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.closeQrBtn}>
                <Text style={styles.closeQrBtnText}>Đóng mã QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>Gia Hạn Hợp Đồng Thuê Kho</Text>
              <Text style={styles.sheetSub}>
                Unit {selectedContract.unitCode} • Đơn giá:{' '}
                {selectedContract.monthlyRent.toLocaleString()} ₫/tháng
              </Text>

              <View style={styles.periodRow}>
                {[
                  { m: 1, label: 'Thêm 1 Tháng', discount: '' },
                  { m: 3, label: 'Thêm 3 Tháng', discount: 'Giảm 5%' },
                  { m: 6, label: 'Thêm 6 Tháng', discount: 'Giảm 10%' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.m}
                    onPress={() => handleRenew(item.m)}
                    style={styles.periodBtn}
                  >
                    <Text style={styles.periodMonths}>{item.label}</Text>
                    {item.discount ? (
                      <Text style={styles.discountBadge}>{item.discount}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={() => setShowRenewalModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Return Request Modal */}
      {showReturnModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>Xác Nhận Yêu Cầu Trả Kho</Text>
              <Text style={styles.sheetSub}>
                Unit {selectedContract.unitCode} • Khoản cọc sẽ hoàn lại:{' '}
                {selectedContract.depositAmount.toLocaleString()} ₫
              </Text>

              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>Lưu ý trước khi trả:</Text>
                <Text style={styles.noticeText}>1. Dọn sạch toàn bộ đồ đạc và rác trong kho.</Text>
                <Text style={styles.noticeText}>
                  2. Nhân viên cơ sở sẽ nghiệm thu hiện trường và chụp ảnh.
                </Text>
                <Text style={styles.noticeText}>
                  3. Tiền cọc sẽ được chuyển khoản hoàn trả trong vòng 24 giờ.
                </Text>
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  onPress={() => setShowReturnModal(false)}
                  style={styles.cancelBtnHalf}
                >
                  <Text style={styles.cancelBtnText}>Đóng</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRequestReturn} style={styles.confirmReturnBtn}>
                  <Text style={styles.confirmReturnBtnText}>Gửi yêu cầu trả kho</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Contract Doc Viewer Modal */}
      {showContractDocModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.docModalCard}>
              <Text style={styles.sheetTitle}>Hợp Đồng Điện Tử Số</Text>
              <Text style={styles.sheetSub}>Mã: {selectedContract.contractCode}</Text>

              <ScrollView style={styles.docScroll}>
                <Text style={styles.docText}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                <Text style={styles.docTextSub}>Độc lập - Tự do - Hạnh phúc</Text>
                <Text style={styles.docHeading}>HỢP ĐỒNG CHO THUÊ KHO TỰ QUẢN</Text>
                <Text style={styles.docParagraph}>
                  BÊN CHO THUÊ: Công ty CP Vận Hành Kho Thông Minh StorageHub.{'\n'}
                  BÊN THUÊ: {selectedContract.customerName} ({selectedContract.customerPhone}).
                  {'\n'}
                  Kho thuê: Unit {selectedContract.unitCode} tại {selectedContract.facilityName}.
                  {'\n'}
                  Thời hạn: Từ {selectedContract.startDate} đến {selectedContract.endDate}.{'\n'}
                  Giá thuê: {selectedContract.monthlyRent.toLocaleString()} VNĐ/tháng.{'\n'}
                  Tiền đặt cọc: {selectedContract.depositAmount.toLocaleString()} VNĐ.{'\n'}
                  Trạng thái ký: Đã xác thực OTP & Chữ ký số hợp lệ.
                </Text>
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowContractDocModal(false)}
                style={styles.closeQrBtn}
              >
                <Text style={styles.closeQrBtnText}>Đóng tài liệu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeActive: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeActiveText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  contractCode: { fontSize: 11, fontWeight: '700', color: '#64748b', fontFamily: 'monospace' },
  unitHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  unitHeroCode: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  facilityName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  unitDates: { fontSize: 11, color: '#64748b', marginTop: 2 },
  accessBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  accessItem: { alignItems: 'center', flex: 1 },
  accessLabel: { fontSize: 10, color: '#64748b' },
  accessValue: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  accessDivider: { width: 1, backgroundColor: '#e2e8f0' },
  qrPassBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  qrPassBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 6 },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnSecondaryText: { color: '#334155', fontSize: 11, fontWeight: '700' },
  actionBtnDanger: {
    flex: 1,
    backgroundColor: '#fff1f2',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnDangerText: { color: '#e11d48', fontSize: 11, fontWeight: '700' },
  rulesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginTop: 14,
  },
  rulesTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  ruleItem: { fontSize: 11, color: '#475569', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  qrModalCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20, alignItems: 'center' },
  qrModalTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  qrModalSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  qrCodeContainer: {
    marginVertical: 20,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrBox: {
    width: 200,
    height: 200,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  qrMockText: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  qrMockCode: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 12,
    fontFamily: 'monospace',
  },
  qrMockSub: { color: '#94a3b8', fontSize: 10, marginTop: 8 },
  qrInfoBox: { marginBottom: 16, alignItems: 'center' },
  qrInfoText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  closeQrBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeQrBtnText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  sheetCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  sheetSub: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 14 },
  periodRow: { gap: 8, marginBottom: 14 },
  periodBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  periodMonths: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  discountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 12 },
  noticeBox: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 14,
  },
  noticeTitle: { fontSize: 11, fontWeight: '800', color: '#b45309', marginBottom: 4 },
  noticeText: { fontSize: 11, color: '#92400e', lineHeight: 16 },
  sheetActions: { flexDirection: 'row', gap: 8 },
  cancelBtnHalf: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  confirmReturnBtn: {
    flex: 2,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#e11d48',
  },
  confirmReturnBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  docModalCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20, maxHeight: '80%' },
  docScroll: { marginVertical: 12 },
  docText: { fontSize: 11, fontWeight: '900', textAlign: 'center', color: '#0f172a' },
  docTextSub: { fontSize: 10, textAlign: 'center', color: '#64748b', marginBottom: 12 },
  docHeading: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    color: '#2563eb',
    marginBottom: 10,
  },
  docParagraph: { fontSize: 11, color: '#334155', lineHeight: 20 },
});
