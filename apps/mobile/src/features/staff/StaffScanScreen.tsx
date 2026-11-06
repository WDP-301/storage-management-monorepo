import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { newOpenNonce } from '../../../lib/open-nonce';
import { useSession } from '../../../lib/session';
import type { ScanWarehouse } from '../../../lib/shelf-storage-api';
import { FilterPill } from '../../components/FilterPill';
import { AbandonedShelvesList } from './counter/AbandonedShelvesList';
import { CounterCustomerPanel } from './counter/CounterCustomerPanel';
import { CounterScanner } from './counter/CounterScanner';
import { useCounterSession } from './counter/use-counter-session';
import { WarehousePickupRequests } from './counter/WarehousePickupRequests';
import { WarehouseReceiptsList } from './counter/WarehouseReceiptsList';
import { ScanWarehousePicker } from './ScanWarehousePicker';

type Segment = 'COUNTER' | 'REQUESTS' | 'RECEIPTS' | 'RECOVERY';

const MANAGER_ROLES = ['FACILITY_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN'];

/** The counter: pick the warehouse, scan the customer's code, then receive or hand back goods. */
export function StaffScanScreen() {
  const router = useRouter();
  const { user } = useSession();
  const isManager = user?.roles.some((role) => MANAGER_ROLES.includes(role)) ?? false;
  const [warehouse, setWarehouse] = useState<ScanWarehouse | null>(null);
  const [segment, setSegment] = useState<Segment>('COUNTER');
  const counter = useCounterSession(warehouse?.id);
  const { session } = counter;

  const openForm = (contractId: string, type: 'DROP_OFF' | 'PICK_UP', requestId?: string) =>
    router.push({
      pathname: '/(staff)/shelf-receipt-form',
      params: {
        sessionId: session?.sessionId ?? '',
        contractId,
        type,
        nonce: newOpenNonce(),
        ...(requestId ? { requestId } : {}),
      },
    });
  const openReceipt = (id: string) =>
    router.push({ pathname: '/(staff)/shelf-receipt', params: { id, nonce: newOpenNonce() } });

  const segments: [Segment, string][] = [
    ['COUNTER', 'Quầy'],
    ['REQUESTS', 'Yêu cầu lấy đồ'],
    ['RECEIPTS', 'Phiếu'],
    ...(isManager ? ([['RECOVERY', 'Thu hồi']] as [Segment, string][]) : []),
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 px-4 pt-6 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="font-strong text-title-md text-foreground">Gửi / lấy đồ</Text>
      <ScanWarehousePicker value={warehouse} onChange={setWarehouse} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {segments.map(([id, label]) => (
          <FilterPill
            key={id}
            label={label}
            isSelected={segment === id}
            onPress={() => setSegment(id)}
          />
        ))}
      </ScrollView>

      {!warehouse ? null : segment === 'COUNTER' ? (
        session && counter.status === 'open' ? (
          <CounterCustomerPanel
            session={session}
            secondsLeft={counter.secondsLeft}
            onDropOff={(contractId) => openForm(contractId, 'DROP_OFF')}
            onPickUp={(contractId, requestId) => openForm(contractId, 'PICK_UP', requestId)}
            onOpenReceipt={openReceipt}
            onNextCustomer={counter.end}
          />
        ) : (
          <View className="gap-3">
            <Text className="font-body text-body-sm text-muted">
              Quét mã “Gửi / lấy đồ” trên điện thoại khách. Mỗi mã chỉ dùng một lần.
            </Text>
            <CounterScanner
              busy={counter.status === 'opening'}
              error={counter.error}
              onSubmit={counter.open}
              onDismissError={counter.end}
            />
          </View>
        )
      ) : segment === 'REQUESTS' ? (
        <WarehousePickupRequests warehouseId={warehouse.id} />
      ) : segment === 'RECEIPTS' ? (
        <WarehouseReceiptsList warehouseId={warehouse.id} onOpen={openReceipt} />
      ) : (
        <AbandonedShelvesList
          warehouseId={warehouse.id}
          onOpen={(contract) =>
            router.push({
              pathname: '/(staff)/shelf-receipt-form',
              params: {
                mode: 'RECOVERY',
                contractId: contract.contractId,
                type: 'PICK_UP',
                nonce: newOpenNonce(),
                customerName: contract.customer.fullName ?? contract.customer.phone ?? '',
              },
            })
          }
        />
      )}
    </ScrollView>
  );
}
