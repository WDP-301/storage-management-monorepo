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

interface StaffInspectionHandoverProps {
  unitCode: string;
  inspectionType: 'HANDOVER' | 'RETURN';
  onComplete: () => void;
  onCancel: () => void;
}

export const StaffInspectionHandover: React.FC<StaffInspectionHandoverProps> = ({
  unitCode,
  inspectionType,
  onComplete,
  onCancel,
}) => {
  // Handover fields
  const [cardCode, setCardCode] = useState('CARD-SG-003');
  const [pinVerified, setPinVerified] = useState(true);
  const [keyHandedOver, setKeyHandedOver] = useState(true);
  const [customerSigned, setCustomerSigned] = useState(true);

  // Return inspection fields
  const [cleanlinessScore, setCleanlinessScore] = useState(4);
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');
  const [extraFine, setExtraFine] = useState('');
  const [photosCount, setPhotosCount] = useState(2);

  const handleSubmit = () => {
    if (inspectionType === 'HANDOVER') {
      Alert.alert(
        'Đã Lập Biên Bản Bàn Giao Thành Công!',
        `Unit ${unitCode} đã được bàn giao cho khách.\n- Thẻ từ cấp: ${cardCode}\n- Trạng thái unit: Chuyển sang OCCUPIED.\n- Biên bản điện tử đã được ký số và gửi email cho khách.`,
      );
    } else {
      Alert.alert(
        'Đã Hoàn Tất Nghiệm Thu Trả Kho!',
        `Unit ${unitCode} đã được tiếp nhận hoàn trả.\n- Điểm vệ sinh: ${cleanlinessScore}/5\n- Hư hại ghi nhận: ${hasDamage ? damageNotes : 'Không có'}\n- Phí cấn trừ cọc: ${hasDamage && extraFine ? `${extraFine} ₫` : '0 ₫'}\n- Đã cập nhật trạng thái kho sang SẴN SÀNG.`,
      );
    }
    onComplete();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {inspectionType === 'HANDOVER'
              ? `Biên Bản Bàn Giao: Unit ${unitCode}`
              : `Nghiệm Thu Trả Kho: Unit ${unitCode}`}
          </Text>
          <Text style={styles.subtitle}>
            Nhân viên thực hiện: Lê Minh Quân • Cơ sở Sala Mega Center
          </Text>
        </View>

        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Đóng</Text>
        </TouchableOpacity>
      </View>

      {/* HANDOVER WORKFLOW */}
      {inspectionType === 'HANDOVER' && (
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>🔑 Bàn giao Thiết bị & Truy cập</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mã Thẻ từ RFID cấp phát:</Text>
            <TextInput value={cardCode} onChangeText={setCardCode} style={styles.textInput} />
          </View>

          <View style={styles.checklist}>
            <TouchableOpacity
              onPress={() => setKeyHandedOver(!keyHandedOver)}
              style={styles.checkItem}
            >
              <Text style={styles.checkIcon}>{keyHandedOver ? '☑' : '☐'}</Text>
              <Text style={styles.checkText}>Đã bàn giao ổ khóa / chìa khóa cơ dự phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPinVerified(!pinVerified)} style={styles.checkItem}>
              <Text style={styles.checkIcon}>{pinVerified ? '☑' : '☐'}</Text>
              <Text style={styles.checkText}>
                Đã hướng dẫn khách đổi mã PIN cá nhân tại cửa kho
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCustomerSigned(!customerSigned)}
              style={styles.checkItem}
            >
              <Text style={styles.checkIcon}>{customerSigned ? '☑' : '☐'}</Text>
              <Text style={styles.checkText}>
                Khách đã đồng ý và ký số xác nhận nhận kho sạch sẽ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* RETURN INSPECTION WORKFLOW */}
      {inspectionType === 'RETURN' && (
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>📋 Kiểm tra Tình trạng Hiện trường</Text>

          {/* Cleanliness Score */}
          <Text style={styles.label}>Chấm điểm độ sạch sẽ khi trả kho:</Text>
          <View style={styles.scoreRow}>
            {[1, 2, 3, 4, 5].map((score) => (
              <TouchableOpacity
                key={score}
                onPress={() => setCleanlinessScore(score)}
                style={[styles.scoreBtn, cleanlinessScore === score && styles.scoreBtnActive]}
              >
                <Text
                  style={[
                    styles.scoreBtnText,
                    cleanlinessScore === score && styles.scoreBtnTextActive,
                  ]}
                >
                  {score} ⭐
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Damage Toggle */}
          <TouchableOpacity
            onPress={() => setHasDamage(!hasDamage)}
            style={[styles.damageBox, hasDamage && styles.damageBoxActive]}
          >
            <Text style={styles.checkIcon}>{hasDamage ? '☑' : '☐'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.damageTitle}>Phát hiện hư hỏng / móp cửa / trầy sàn</Text>
              <Text style={styles.damageSub}>Cần chụp ảnh và ghi nhận phí phạt khấu trừ cọc</Text>
            </View>
          </TouchableOpacity>

          {hasDamage && (
            <View style={styles.damageDetails}>
              <Text style={styles.label}>Mô tả chi tiết vị trí hư hỏng:</Text>
              <TextInput
                placeholder="Ví dụ: Ray trượt cửa cuốn bị móp, dính vết dầu loang..."
                placeholderTextColor="#94a3b8"
                value={damageNotes}
                onChangeText={setDamageNotes}
                style={styles.textInput}
              />

              <Text style={styles.label}>Số tiền khấu trừ cọc đề xuất (VNĐ):</Text>
              <TextInput
                placeholder="Ví dụ: 750000"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                value={extraFine}
                onChangeText={setExtraFine}
                style={styles.textInput}
              />
            </View>
          )}

          {/* Upload Photos Section */}
          <Text style={styles.label}>Hình ảnh kiểm tra hiện trường:</Text>
          <View style={styles.photosBox}>
            <Text style={styles.photoCountText}>📷 Đã chụp {photosCount} ảnh hiện trường</Text>
            <TouchableOpacity
              onPress={() => setPhotosCount(photosCount + 1)}
              style={styles.addPhotoBtn}
            >
              <Text style={styles.addPhotoBtnText}>+ Chụp thêm ảnh</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn}>
        <Text style={styles.submitBtnText}>
          {inspectionType === 'HANDOVER'
            ? '✓ Hoàn tất Biên bản Bàn giao Kho'
            : '✓ Xác nhận Hoàn tất Nghiệm thu Trả kho'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  cancelBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionHeader: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 10,
  },
  checklist: { gap: 10, marginTop: 6 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkIcon: { fontSize: 18, color: '#2563eb' },
  checkText: { fontSize: 11, color: '#334155', flex: 1, lineHeight: 16 },
  scoreRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  scoreBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  scoreBtnActive: { backgroundColor: '#f59e0b' },
  scoreBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  scoreBtnTextActive: { color: '#ffffff' },
  damageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  damageBoxActive: { backgroundColor: '#fff1f2', borderColor: '#fca5a5' },
  damageTitle: { fontSize: 12, fontWeight: '800', color: '#991b1b' },
  damageSub: { fontSize: 10, color: '#b91c1c', marginTop: 1 },
  damageDetails: { paddingLeft: 4, marginBottom: 8 },
  photosBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  photoCountText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  addPhotoBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPhotoBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
});
