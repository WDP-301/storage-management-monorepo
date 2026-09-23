import {
  IFacility,
  IStorageUnit,
  MOCK_FACILITIES,
  MOCK_UNITS,
  UnitSizeCategory,
  UnitStatus,
} from '@storage/types';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface CustomerExploreProps {
  onBookUnit: (unit: IStorageUnit) => void;
  onJoinWaitlist: (category: UnitSizeCategory) => void;
}

export const CustomerExplore: React.FC<CustomerExploreProps> = ({ onBookUnit, onJoinWaitlist }) => {
  const [facilities, _setFacilities] = useState<IFacility[]>(MOCK_FACILITIES);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(facilities[0].id);
  const [units, _setUnits] = useState<IStorageUnit[]>(MOCK_UNITS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedUnitDetail, setSelectedUnitDetail] = useState<IStorageUnit | null>(null);
  const [favorites, setFavorites] = useState<string[]>(['u-b201']);

  const currentFacility = facilities.find((f) => f.id === selectedFacilityId) || facilities[0];

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const filteredUnits = units.filter((u) => {
    const matchCategory = selectedCategory === 'ALL' || u.category === selectedCategory;
    const matchSearch =
      u.code.toLowerCase().includes(search.toLowerCase()) ||
      u.categoryLabel.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <View style={styles.container}>
      {/* Search & Facility Picker Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Khám Phá & Đặt Kho Tự Quản</Text>
        <Text style={styles.headerSubtitle}>Lưu trữ an toàn 24/7 • Truy cập bằng Smart QR</Text>

        {/* Facility Selector Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.facilityScroll}>
          {facilities.map((fac) => (
            <TouchableOpacity
              key={fac.id}
              onPress={() => setSelectedFacilityId(fac.id)}
              style={[
                styles.facilityPill,
                selectedFacilityId === fac.id && styles.facilityPillActive,
              ]}
            >
              <Text
                style={[
                  styles.facilityPillText,
                  selectedFacilityId === fac.id && styles.facilityPillTextActive,
                ]}
              >
                {fac.name.replace('StorageHub ', '')}
              </Text>
              <View style={styles.badgeSmall}>
                <Text style={styles.badgeSmallText}>{fac.occupancyRate}% đầy</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Input */}
        <TextInput
          placeholder="🔍 Tìm loại kho, kích thước hoặc mã..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoryRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'ALL', label: 'Tất cả kho' },
            { id: UnitSizeCategory.LOCKER, label: 'Locker (1.5 m³)' },
            { id: UnitSizeCategory.STANDARD, label: 'Tiêu chuẩn (12.5 m³)' },
            { id: UnitSizeCategory.CLIMATE_CONTROLLED, label: 'Kho mát (8 m³)' },
            { id: UnitSizeCategory.LARGE, label: 'Kho lớn (30 m³)' },
          ].map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
            >
              <Text
                style={[
                  styles.catChipText,
                  selectedCategory === cat.id && styles.catChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Facility Info Card */}
      <View style={styles.facilityCard}>
        <View style={styles.facilityCardHeader}>
          <Text style={styles.facilityName}>{currentFacility.name}</Text>
          <Text style={styles.facilityHours}>⏰ {currentFacility.operatingHours}</Text>
        </View>
        <Text style={styles.facilityAddress}>📍 {currentFacility.address}</Text>
        <View style={styles.amenitiesRow}>
          {currentFacility.amenities.slice(0, 3).map((am, idx) => (
            <View key={idx} style={styles.amenityTag}>
              <Text style={styles.amenityTagText}>✓ {am}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Units List */}
      <FlatList
        data={filteredUnits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isFav = favorites.includes(item.id);
          const isAvailable = item.status === UnitStatus.AVAILABLE;

          return (
            <TouchableOpacity
              onPress={() => setSelectedUnitDetail(item)}
              activeOpacity={0.85}
              style={styles.unitCard}
            >
              <View style={styles.unitCardTop}>
                <View>
                  <View style={styles.codeRow}>
                    <Text style={styles.unitCode}>{item.code}</Text>
                    {item.isClimateControlled && (
                      <View style={styles.climateTag}>
                        <Text style={styles.climateTagText}>❄️ 18-20°C</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.unitLabel}>{item.categoryLabel}</Text>
                  <Text style={styles.unitDim}>
                    Dài {item.dimensions.lengthM}m × Rộng {item.dimensions.widthM}m × Cao{' '}
                    {item.dimensions.heightM}m ({item.volumeM3} m³)
                  </Text>
                </View>

                <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.favBtn}>
                  <Text style={styles.favIcon}>{isFav ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.featuresRow}>
                {item.features.map((feat, idx) => (
                  <Text key={idx} style={styles.featureText}>
                    • {feat}
                  </Text>
                ))}
              </View>

              <View style={styles.unitCardBottom}>
                <View>
                  <Text style={styles.priceLabel}>Giá thuê tháng:</Text>
                  <Text style={styles.priceValue}>
                    {item.pricePerMonth.toLocaleString('vi-VN')} ₫
                  </Text>
                </View>

                {isAvailable ? (
                  <TouchableOpacity onPress={() => onBookUnit(item)} style={styles.bookBtn}>
                    <Text style={styles.bookBtnText}>Đặt thuê ngay</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => onJoinWaitlist(item.category)}
                    style={styles.waitlistBtn}
                  >
                    <Text style={styles.waitlistBtnText}>Vào Waitlist</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Unit Detail Modal */}
      {selectedUnitDetail && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalBar} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết Unit {selectedUnitDetail.code}</Text>
                <TouchableOpacity onPress={() => setSelectedUnitDetail(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>{selectedUnitDetail.categoryLabel}</Text>
                <Text style={styles.modalZone}>
                  {selectedUnitDetail.zone} • Tầng {selectedUnitDetail.floor}
                </Text>

                <View style={styles.specBox}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Diện tích sàn</Text>
                    <Text style={styles.specValue}>{selectedUnitDetail.areaM2} m²</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Thể tích chứa</Text>
                    <Text style={styles.specValue}>{selectedUnitDetail.volumeM3} m³</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Tiền cọc quy định</Text>
                    <Text style={styles.specValue}>
                      {selectedUnitDetail.depositAmount.toLocaleString('vi-VN')} ₫
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionHeader}>Đặc tính nổi bật</Text>
                {selectedUnitDetail.features.map((f, i) => (
                  <Text key={i} style={styles.bulletText}>
                    ✓ {f}
                  </Text>
                ))}

                <Text style={styles.sectionHeader}>Chính sách thuê</Text>
                <Text style={styles.bulletText}>
                  • Hỗ trợ thuê theo tháng hoặc theo năm linh hoạt.
                </Text>
                <Text style={styles.bulletText}>
                  • Check-in và mở khóa bằng mã QR cá nhân 24/7.
                </Text>
                <Text style={styles.bulletText}>• Hoàn 100% tiền cọc khi kết thúc hợp đồng.</Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                {selectedUnitDetail.status === UnitStatus.AVAILABLE ? (
                  <TouchableOpacity
                    onPress={() => {
                      const u = selectedUnitDetail;
                      setSelectedUnitDetail(null);
                      onBookUnit(u);
                    }}
                    style={styles.modalPrimaryBtn}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      Tiến hành Đặt kho ({selectedUnitDetail.pricePerMonth.toLocaleString()} ₫/th)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      const cat = selectedUnitDetail.category;
                      setSelectedUnitDetail(null);
                      onJoinWaitlist(cat);
                    }}
                    style={styles.modalWaitlistBtn}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      Kho đang có người thuê - Vào Danh sách Chờ
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  facilityScroll: { marginTop: 10, marginBottom: 8 },
  facilityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facilityPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  facilityPillText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  facilityPillTextActive: { color: '#ffffff' },
  badgeSmall: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeSmallText: { fontSize: 9, fontWeight: '700', color: '#64748b' },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    marginTop: 4,
  },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 6 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
  },
  catChipActive: { backgroundColor: '#0f172a' },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  catChipTextActive: { color: '#ffffff' },
  facilityCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  facilityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  facilityName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  facilityHours: { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  facilityAddress: { fontSize: 11, color: '#64748b', marginTop: 2 },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  amenityTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  amenityTagText: { fontSize: 10, color: '#475569', fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 90, gap: 10 },
  unitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  unitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unitCode: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  climateTag: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  climateTagText: { fontSize: 10, fontWeight: '700', color: '#0891b2' },
  unitLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 2 },
  unitDim: { fontSize: 10, color: '#64748b', marginTop: 1 },
  favBtn: { padding: 4 },
  favIcon: { fontSize: 16 },
  featuresRow: { marginTop: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: '#f1f5f9' },
  featureText: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  unitCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  priceLabel: { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' },
  priceValue: { fontSize: 14, fontWeight: '900', color: '#2563eb' },
  bookBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bookBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  waitlistBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  waitlistBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalBar: {
    width: 36,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  modalClose: { fontSize: 16, color: '#94a3b8', fontWeight: '800', padding: 4 },
  modalBody: { marginVertical: 12 },
  modalSubtitle: { fontSize: 13, fontWeight: '800', color: '#2563eb' },
  modalZone: { fontSize: 11, color: '#64748b', marginTop: 1 },
  specBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginVertical: 12,
  },
  specItem: { alignItems: 'center' },
  specLabel: { fontSize: 10, color: '#64748b' },
  specValue: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 10,
    marginBottom: 4,
  },
  bulletText: { fontSize: 11, color: '#475569', lineHeight: 18 },
  modalFooter: { paddingTop: 12, borderTopWidth: 1, borderColor: '#e2e8f0' },
  modalPrimaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalWaitlistBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
