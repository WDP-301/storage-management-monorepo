import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StaffQrScannerProps {
  onScanResult: (qrCode: string) => void;
  onClose: () => void;
}

export const StaffQrScanner: React.FC<StaffQrScannerProps> = ({ onScanResult, onClose }) => {
  const [_isScanning, setIsScanning] = useState(true);

  const simulateScanSuccess = (sampleQr: string) => {
    setIsScanning(false);
    Alert.alert(
      'Quét QR Thành Công!',
      `Đã nhận diện mã đặt phòng: ${sampleQr}\nKhách hàng: Ngô Thanh Hằng\nUnit: A-103 (Sala Mega Center)`,
      [
        {
          text: 'Tiến hành Bàn Giao Kho',
          onPress: () => onScanResult(sampleQr),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trình Quét Smart QR Hiện Trường</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Đóng</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>
        Hướng camera về phía mã QR Pass trên điện thoại của khách hàng
      </Text>

      {/* Simulated Camera Viewfinder */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinder}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          {/* Animated scan line */}
          <View style={styles.scanLine} />

          <Text style={styles.cameraText}>Đang nhận diện mã QR...</Text>
        </View>
      </View>

      {/* Quick Test Action Buttons for Simulation */}
      <View style={styles.testActionsBox}>
        <Text style={styles.testTitle}>Mô phỏng quét nhanh các mã QR thực tế:</Text>
        <TouchableOpacity
          onPress={() => simulateScanSuccess('QR-PASS-A103-8831')}
          style={styles.simulateBtn}
        >
          <Text style={styles.simulateBtnText}>
            ⚡ Quét QR Khách Check-in (Unit A-103 - Ngô Thanh Hằng)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => simulateScanSuccess('QR-PASS-B204-7712')}
          style={styles.simulateBtnSecondary}
        >
          <Text style={styles.simulateBtnSecondaryText}>
            ⚡ Quét QR Khách Trả Kho (Unit B-204 - Nguyễn Văn Đạt)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  title: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  instruction: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 14 },
  viewfinderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    width: 240,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#38bdf8',
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#38bdf8',
    borderTopRightRadius: 10,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#38bdf8',
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#38bdf8',
    borderBottomRightRadius: 10,
  },
  scanLine: {
    width: '85%',
    height: 2,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowRadius: 10,
    shadowOpacity: 1,
    marginBottom: 16,
  },
  cameraText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  testActionsBox: { paddingBottom: 20 },
  testTitle: { fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: '700' },
  simulateBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  simulateBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  simulateBtnSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  simulateBtnSecondaryText: { color: '#cbd5e1', fontSize: 11, fontWeight: '800' },
});
