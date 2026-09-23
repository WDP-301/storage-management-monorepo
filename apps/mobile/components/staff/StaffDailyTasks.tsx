import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StaffTask {
  id: string;
  type: 'CHECK_IN' | 'RETURN' | 'MAINTENANCE' | 'SUPPORT';
  time: string;
  unitCode: string;
  customerName: string;
  phone: string;
  status: 'PENDING' | 'DONE';
  details: string;
}

interface StaffDailyTasksProps {
  onStartInspection: (unitCode: string, type: 'HANDOVER' | 'RETURN') => void;
  onOpenQrScanner: () => void;
}

export const StaffDailyTasks: React.FC<StaffDailyTasksProps> = ({
  onStartInspection,
  onOpenQrScanner,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [tasks, _setTasks] = useState<StaffTask[]>([
    {
      id: 'tsk-01',
      type: 'CHECK_IN',
      time: '17:00 Hôm nay',
      unitCode: 'A-103',
      customerName: 'Ngô Thanh Hằng',
      phone: '0918 882 119',
      status: 'PENDING',
      details: 'Khách đến nhận kho mới. Cần bàn giao Thẻ từ CARD-SG-003 và hướng dẫn đổi mã PIN.',
    },
    {
      id: 'tsk-02',
      type: 'RETURN',
      time: '16:30 Hôm nay',
      unitCode: 'B-204',
      customerName: 'Nguyễn Văn Đạt',
      phone: '0938 123 456',
      status: 'PENDING',
      details: 'Nghiệm thu trả kho tiêu chuẩn. Chú ý kiểm tra ray trượt cửa cuốn bị móp.',
    },
    {
      id: 'tsk-03',
      type: 'MAINTENANCE',
      time: '19:00 Hôm nay',
      unitCode: 'Zone C',
      customerName: 'Kỹ thuật nội bộ',
      phone: 'Nội bộ',
      status: 'PENDING',
      details: 'Kiểm tra van xả áp và nồng độ khí chữa cháy FM200 Zone C Climate.',
    },
    {
      id: 'tsk-04',
      type: 'CHECK_IN',
      time: '10:15 Sáng nay',
      unitCode: 'B-201',
      customerName: 'Phạm Hồng Ánh',
      phone: '0977 345 889',
      status: 'DONE',
      details: 'Đã hoàn tất bàn giao và ký biên bản số thành công.',
    },
  ]);

  const filteredTasks = tasks.filter((t) => filterType === 'ALL' || t.type === filterType);

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Lịch Trình Vận Hành Ca Trực</Text>
          <Text style={styles.subtitle}>Nhân viên: Lê Minh Quân • Cơ sở Sala Mega Center</Text>
        </View>

        <TouchableOpacity onPress={onOpenQrScanner} style={styles.scanQuickBtn}>
          <Text style={styles.scanQuickBtnText}>📷 Quét QR</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'CHECK_IN', label: 'Nhận kho' },
          { id: 'RETURN', label: 'Trả kho' },
          { id: 'MAINTENANCE', label: 'Bảo trì' },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilterType(f.id)}
            style={[styles.filterChip, filterType === f.id && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterChipText, filterType === f.id && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isDone = item.status === 'DONE';

          return (
            <View style={[styles.taskCard, isDone && styles.taskCardDone]}>
              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {item.type === 'CHECK_IN'
                      ? '📥 NHẬN KHO'
                      : item.type === 'RETURN'
                        ? '📤 TRẢ KHO'
                        : '🔧 BẢO TRÌ'}
                  </Text>
                </View>
                <Text style={styles.taskTime}>⏰ {item.time}</Text>
              </View>

              <View style={styles.taskMain}>
                <Text style={styles.taskUnitCode}>{item.unitCode}</Text>
                <View style={styles.taskCustomerBox}>
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  <Text style={styles.customerPhone}>📞 {item.phone}</Text>
                </View>
              </View>

              <Text style={styles.taskDetails}>{item.details}</Text>

              <View style={styles.cardFooter}>
                {isDone ? (
                  <Text style={styles.doneText}>✓ Đã hoàn thành nhiệm vụ</Text>
                ) : (
                  <View style={styles.actionButtons}>
                    {item.type === 'CHECK_IN' && (
                      <TouchableOpacity
                        onPress={() => onStartInspection(item.unitCode, 'HANDOVER')}
                        style={styles.actionPrimary}
                      >
                        <Text style={styles.actionPrimaryText}>Lập Biên Bản Bàn Giao</Text>
                      </TouchableOpacity>
                    )}
                    {item.type === 'RETURN' && (
                      <TouchableOpacity
                        onPress={() => onStartInspection(item.unitCode, 'RETURN')}
                        style={styles.actionDanger}
                      >
                        <Text style={styles.actionDangerText}>Nghiệm Thu & Chụp Ảnh Trả Kho</Text>
                      </TouchableOpacity>
                    )}
                    {item.type === 'MAINTENANCE' && (
                      <TouchableOpacity
                        onPress={() => alert(`Bắt đầu xử lý bảo trì cho ${item.unitCode}`)}
                        style={styles.actionSecondary}
                      >
                        <Text style={styles.actionSecondaryText}>Bắt đầu xử lý</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  scanQuickBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scanQuickBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 6, backgroundColor: '#ffffff' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },
  listContent: { padding: 16, paddingBottom: 100, gap: 12 },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  taskCardDone: { opacity: 0.6, backgroundColor: '#f8fafc' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', color: '#334155' },
  taskTime: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  taskMain: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  taskUnitCode: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  taskCustomerBox: { flex: 1 },
  customerName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  customerPhone: { fontSize: 11, color: '#64748b', marginTop: 1 },
  taskDetails: { fontSize: 11, color: '#475569', lineHeight: 16, marginBottom: 12 },
  cardFooter: { borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 10 },
  doneText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  actionButtons: { width: '100%' },
  actionPrimary: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionPrimaryText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  actionDanger: {
    backgroundColor: '#e11d48',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionDangerText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  actionSecondary: {
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionSecondaryText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
});
