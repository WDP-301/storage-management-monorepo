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

export const CustomerSupport: React.FC = () => {
  const [ticketType, setTicketType] = useState('Khóa thông minh / Thẻ từ');
  const [ticketDesc, setTicketDesc] = useState('');
  const [photoAttached, setPhotoAttached] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const notifications = [
    {
      id: 'noti-1',
      title: 'Nhắc hạn thanh toán kỳ tháng 10',
      time: 'Hôm nay 08:00',
      content: 'Hợp đồng kho B-201 sắp đến hạn đóng tiền vào ngày 10/10.',
      isRead: false,
    },
    {
      id: 'noti-2',
      title: 'Đã hoàn tất kiểm tra nhiệt độ Zone C',
      time: 'Hôm qua 15:30',
      content: 'Nhiệt độ hiện tại duy trì 19.5°C, độ ẩm 54%.',
      isRead: true,
    },
  ];

  const handleSendTicket = () => {
    if (!ticketDesc) {
      Alert.alert('Vui lòng nhập nội dung yêu cầu hỗ trợ.');
      return;
    }
    Alert.alert(
      'Đã Gửi Yêu Cầu Thành Công!',
      `Ticket hỗ trợ về "${ticketType}" đã được gửi tới kỹ thuật viên cơ sở. Chúng tôi sẽ phản hồi trong vòng 15 phút.`,
    );
    setTicketDesc('');
    setPhotoAttached(false);
  };

  const handleSendFeedback = () => {
    Alert.alert(
      'Cảm Ơn Đánh Giá Của Bạn!',
      'Ý kiến đóng góp giúp StorageHub không ngừng nâng cao chất lượng phục vụ.',
    );
    setFeedbackNotes('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Hỗ Trợ & Thông Báo</Text>
      <Text style={styles.subtitle}>
        Gửi sự cố hiện trường, nhận thông báo đẩy và đánh giá dịch vụ
      </Text>

      {/* Notifications Section */}
      <Text style={styles.sectionTitle}>🔔 Thông báo mới nhất</Text>
      <View style={styles.notiList}>
        {notifications.map((n) => (
          <View key={n.id} style={[styles.notiCard, !n.isRead && styles.notiCardUnread]}>
            <View style={styles.notiHeader}>
              <Text style={styles.notiTitle}>{n.title}</Text>
              <Text style={styles.notiTime}>{n.time}</Text>
            </View>
            <Text style={styles.notiContent}>{n.content}</Text>
          </View>
        ))}
      </View>

      {/* Support Ticket Section */}
      <View style={styles.ticketCard}>
        <Text style={styles.ticketHeader}>🛠️ Tạo yêu cầu hỗ trợ kỹ thuật</Text>
        <Text style={styles.ticketSub}>Nhân viên cơ sở sẽ có mặt hỗ trợ tại kho của bạn</Text>

        <Text style={styles.fieldLabel}>Vấn đề bạn đang gặp phải:</Text>
        <View style={styles.pillRow}>
          {['Khóa thông minh / Thẻ từ', 'Cửa kho bị kẹt', 'Đèn / Điện / Điều hòa', 'Khác'].map(
            (t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTicketType(t)}
                style={[styles.pill, ticketType === t && styles.pillActive]}
              >
                <Text style={[styles.pillText, ticketType === t && styles.pillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>

        <Text style={styles.fieldLabel}>Chi tiết sự cố:</Text>
        <TextInput
          placeholder="Mô tả cụ thể sự cố cần giải quyết..."
          placeholderTextColor="#94a3b8"
          value={ticketDesc}
          onChangeText={setTicketDesc}
          multiline
          numberOfLines={3}
          style={styles.textInput}
        />

        <TouchableOpacity onPress={() => setPhotoAttached(!photoAttached)} style={styles.attachBtn}>
          <Text style={styles.attachBtnText}>
            {photoAttached
              ? '📸 Đã đính kèm ảnh hiện trường (1 ảnh)'
              : '📷 Chụp / Đính kèm ảnh hiện trường'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSendTicket} style={styles.submitTicketBtn}>
          <Text style={styles.submitTicketBtnText}>Gửi yêu cầu tới nhân viên trực</Text>
        </TouchableOpacity>
      </View>

      {/* Feedback Section */}
      <View style={styles.feedbackCard}>
        <Text style={styles.ticketHeader}>⭐ Đánh giá chất lượng sau khi thuê</Text>
        <Text style={styles.ticketSub}>Phản hồi về kho và thái độ nhân viên bàn giao</Text>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <Text style={styles.starText}>{s <= rating ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          placeholder="Ý kiến đóng góp của bạn về sự sạch sẽ, an ninh..."
          placeholderTextColor="#94a3b8"
          value={feedbackNotes}
          onChangeText={setFeedbackNotes}
          style={styles.feedbackInput}
        />

        <TouchableOpacity onPress={handleSendFeedback} style={styles.feedbackBtn}>
          <Text style={styles.feedbackBtnText}>Gửi đánh giá</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  notiList: { gap: 8, marginBottom: 16 },
  notiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notiCardUnread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  notiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notiTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  notiTime: { fontSize: 10, color: '#64748b' },
  notiContent: { fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 16 },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  ticketHeader: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  ticketSub: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pill: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  pillActive: { backgroundColor: '#2563eb' },
  pillText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  pillTextActive: { color: '#ffffff', fontWeight: '700' },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  attachBtn: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
  },
  attachBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  submitTicketBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitTicketBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  feedbackCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  starRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  starText: { fontSize: 24 },
  feedbackInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 10,
  },
  feedbackBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  feedbackBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
});
