import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export const StaffShiftInventory: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'SHIFT_NOTE' | 'UNIT_STATUS' | 'KEY_BOX'>(
    'SHIFT_NOTE',
  );

  // Shift note state
  const [shiftText, setShiftText] = useState('');
  const [pendingText, setPendingText] = useState('');

  // Unit status updater state
  const [unitCodeToUpdate, setUnitCodeToUpdate] = useState('B-204');
  const [selectedNewStatus, setSelectedNewStatus] = useState('SẴN SÀNG');

  // Keys in inventory
  const [keys] = useState([
    { id: 'k1', code: 'CARD-SG-001', type: 'Thẻ từ RFID', status: 'Đang giao Unit A-101' },
    { id: 'k2', code: 'CARD-SG-002', type: 'Thẻ từ RFID', status: 'Trong tủ (Sẵn sàng)' },
    { id: 'k3', code: 'CARD-SG-003', type: 'Thẻ từ RFID', status: 'Trong tủ (Sẵn sàng)' },
    { id: 'k4', code: 'PADLOCK-088', type: 'Ổ khóa số', status: 'Trong tủ (Sẵn sàng)' },
  ]);

  const handleSaveShiftNote = () => {
    if (!shiftText) {
      Alert.alert('Vui lòng nhập tóm tắt ca trực.');
      return;
    }
    Alert.alert(
      'Đã Lưu Ghi Chú Bàn Giao Ca!',
      'Ghi chú ca sáng đã được gửi tới nhân viên ca chiều (Đặng Tuấn Kiệt) và lưu vào nhật ký cơ sở.',
    );
    setShiftText('');
    setPendingText('');
  };

  const handleUpdateUnitStatus = () => {
    Alert.alert(
      'Cập Nhật Trạng Thái Thành Công!',
      `Unit ${unitCodeToUpdate} đã được chuyển sang trạng thái: "${selectedNewStatus}". Bản đồ mặt bằng Web và Mobile đã được đồng bộ.`,
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quản Lý Kho Thẻ & Bàn Giao Ca</Text>
      <Text style={styles.subtitle}>Kiểm kê thiết bị và ghi chép nhật ký chuyển giao ca trực</Text>

      {/* Segment Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          onPress={() => setActiveSubTab('SHIFT_NOTE')}
          style={[styles.subTab, activeSubTab === 'SHIFT_NOTE' && styles.subTabActive]}
        >
          <Text
            style={[styles.subTabText, activeSubTab === 'SHIFT_NOTE' && styles.subTabTextActive]}
          >
            Bàn giao ca
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveSubTab('UNIT_STATUS')}
          style={[styles.subTab, activeSubTab === 'UNIT_STATUS' && styles.subTabActive]}
        >
          <Text
            style={[styles.subTabText, activeSubTab === 'UNIT_STATUS' && styles.subTabTextActive]}
          >
            Đổi trạng thái kho
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveSubTab('KEY_BOX')}
          style={[styles.subTab, activeSubTab === 'KEY_BOX' && styles.subTabActive]}
        >
          <Text style={[styles.subTabText, activeSubTab === 'KEY_BOX' && styles.subTabTextActive]}>
            Tủ thẻ từ & Khóa
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. SHIFT NOTE SECTION */}
      {activeSubTab === 'SHIFT_NOTE' && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>📝 Sổ Bàn Giao Ca Trực (Ca Sáng → Ca Chiều)</Text>

          <Text style={styles.label}>Tóm tắt công việc đã xử lý trong ca:</Text>
          <TextInput
            placeholder="Ví dụ: Đã bàn giao 2 kho, dọn dẹp vệ sinh xong Unit B-201..."
            placeholderTextColor="#94a3b8"
            value={shiftText}
            onChangeText={setShiftText}
            multiline
            numberOfLines={3}
            style={styles.textInput}
          />

          <Text style={styles.label}>Nhiệm vụ tồn đọng bàn giao ca sau xử lý:</Text>
          <TextInput
            placeholder="Ví dụ: Khách Ngô Thanh Hằng hẹn 17:00 đến nhận thẻ từ..."
            placeholderTextColor="#94a3b8"
            value={pendingText}
            onChangeText={setPendingText}
            multiline
            numberOfLines={2}
            style={styles.textInput}
          />

          <TouchableOpacity onPress={handleSaveShiftNote} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Lưu & Gửi Bàn Giao Ca</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. UNIT STATUS CHANGER */}
      {activeSubTab === 'UNIT_STATUS' && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>⚡ Cập Nhật Trạng Thái Unit Nhanh</Text>

          <Text style={styles.label}>Mã Unit cần đổi trạng thái:</Text>
          <TextInput
            value={unitCodeToUpdate}
            onChangeText={setUnitCodeToUpdate}
            style={styles.textInput}
          />

          <Text style={styles.label}>Chọn trạng thái mới:</Text>
          <View style={styles.statusRow}>
            {['SẴN SÀNG', 'ĐANG BẢO TRÌ', 'CHỜ DỌN DẸP'].map((st) => (
              <TouchableOpacity
                key={st}
                onPress={() => setSelectedNewStatus(st)}
                style={[styles.statusChip, selectedNewStatus === st && styles.statusChipActive]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    selectedNewStatus === st && styles.statusChipTextActive,
                  ]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={handleUpdateUnitStatus} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Cập Nhật Trạng Thái Kho Ngay</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. KEY BOX INVENTORY */}
      {activeSubTab === 'KEY_BOX' && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🗄️ Tủ Thiết Bị & Thẻ Từ RFID Cơ Sở</Text>

          <View style={styles.keyList}>
            {keys.map((k) => (
              <View key={k.id} style={styles.keyRow}>
                <View>
                  <Text style={styles.keyCode}>{k.code}</Text>
                  <Text style={styles.keyType}>{k.type}</Text>
                </View>
                <Text
                  style={[
                    styles.keyStatus,
                    k.status.includes('Sẵn sàng')
                      ? styles.keyStatusReady
                      : styles.keyStatusAssigned,
                  ]}
                >
                  {k.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 14 },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  subTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12 },
  subTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subTabText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  subTabTextActive: { color: '#0f172a' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  statusRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  statusChipActive: { backgroundColor: '#2563eb' },
  statusChipText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  statusChipTextActive: { color: '#ffffff' },
  keyList: { gap: 8 },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keyCode: { fontSize: 12, fontWeight: '800', color: '#0f172a', fontFamily: 'monospace' },
  keyType: { fontSize: 10, color: '#64748b', marginTop: 1 },
  keyStatus: { fontSize: 10, fontWeight: '800' },
  keyStatusReady: { color: '#059669' },
  keyStatusAssigned: { color: '#2563eb' },
});
