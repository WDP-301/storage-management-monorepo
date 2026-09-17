import { IStorageItem, StorageItemStatus } from '@storage/types';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const INITIAL_ITEMS: IStorageItem[] = [
  {
    id: '1',
    sku: 'STG-BOX-001',
    name: 'Heavy Duty Storage Tote 60L',
    description: 'Stackable industrial plastic container',
    quantity: 180,
    minQuantity: 20,
    unit: 'units',
    price: 18.5,
    status: StorageItemStatus.IN_STOCK,
    locationId: 'loc-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    sku: 'STG-RACK-002',
    name: 'Adjustable Steel Shelving Unit',
    description: '4-Tier commercial grade shelving rack',
    quantity: 8,
    minQuantity: 10,
    unit: 'sets',
    price: 145.0,
    status: StorageItemStatus.LOW_STOCK,
    locationId: 'loc-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    sku: 'STG-PAL-003',
    name: 'Euro Timber Pallet 1200x800',
    description: 'Heat-treated logistics wooden pallet',
    quantity: 0,
    minQuantity: 30,
    unit: 'pallets',
    price: 24.0,
    status: StorageItemStatus.OUT_OF_STOCK,
    locationId: 'loc-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function App() {
  const [items, _setItems] = useState<IStorageItem[]>(INITIAL_ITEMS);
  const [search, setSearch] = useState('');
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [_scannedCode, setScannedCode] = useState('');

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const simulateScan = (code: string) => {
    setScannedCode(code);
    setScanModalVisible(false);
    setSearch(code);
  };

  const getStatusColor = (status: StorageItemStatus) => {
    switch (status) {
      case StorageItemStatus.IN_STOCK:
        return { bg: '#dcfce7', text: '#15803d' };
      case StorageItemStatus.LOW_STOCK:
        return { bg: '#fef3c7', text: '#b45309' };
      case StorageItemStatus.OUT_OF_STOCK:
        return { bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { bg: '#f3f4f6', text: '#4b5563' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Storage Mobile</Text>
          <Text style={styles.headerSubtitle}>Warehouse Handheld Scanner</Text>
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={() => setScanModalVisible(true)}>
          <Text style={styles.scanButtonText}>📷 Scan QR</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Items</Text>
          <Text style={styles.kpiValue}>{items.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Low Stock</Text>
          <Text style={[styles.kpiValue, { color: '#b45309' }]}>
            {items.filter((i) => i.status === StorageItemStatus.LOW_STOCK).length}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Out of Stock</Text>
          <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>
            {items.filter((i) => i.status === StorageItemStatus.OUT_OF_STOCK).length}
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search SKU or item name..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Item List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const statusStyle = getStatusColor(item.status);
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemSku}>{item.sku}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <Text style={styles.itemName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              )}

              <View style={styles.itemCardFooter}>
                <Text style={styles.itemQuantity}>
                  Qty: <Text style={styles.bold}>{item.quantity}</Text> {item.unit}
                </Text>
                <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Scanner Simulation Modal */}
      <Modal visible={scanModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Barcode / QR Scanner</Text>
            <Text style={styles.modalDesc}>Simulate barcode scan by picking a sample SKU:</Text>

            {items.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.simulateItemBtn}
                onPress={() => simulateScan(it.sku)}
              >
                <Text style={styles.simulateItemText}>
                  {it.sku} - {it.name}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setScanModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  kpiContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  clearButton: {
    position: 'absolute',
    right: 28,
    top: 12,
  },
  clearButtonText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemSku: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemQuantity: {
    fontSize: 13,
    color: '#475569',
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  simulateItemBtn: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
  },
  simulateItemText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
  },
  closeModalBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
