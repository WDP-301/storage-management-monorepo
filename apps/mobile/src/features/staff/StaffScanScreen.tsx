import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { newOpenNonce } from '../../../lib/open-nonce';
import { useSession } from '../../../lib/session';
import type { ScanWarehouse } from '../../../lib/shelf-storage-api';
import { FlowScreen, TabChip, Text } from '../../components/ui';
import { AbandonedShelvesList } from './counter/AbandonedShelvesList';
import { CounterCustomerPanel } from './counter/CounterCustomerPanel';
import { CounterScanner } from './counter/CounterScanner';
import { useCounterSession } from './counter/use-counter-session';
import { WarehouseDropOffRequests } from './counter/WarehouseDropOffRequests';
import { WarehousePickupRequests } from './counter/WarehousePickupRequests';
import { WarehouseReceiptsList } from './counter/WarehouseReceiptsList';
import { ScanWarehousePicker } from './ScanWarehousePicker';

type Segment = 'COUNTER' | 'REQUESTS' | 'DROP_OFF_REQUESTS' | 'RECEIPTS' | 'RECOVERY';

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
    ['DROP_OFF_REQUESTS', 'Yêu cầu gửi đồ'],
    ['REQUESTS', 'Yêu cầu lấy đồ'],
    ['RECEIPTS', 'Phiếu'],
    ...(isManager ? ([['RECOVERY', 'Thu hồi']] as [Segment, string][]) : []),
  ];

  return (
    <FlowScreen muted showBack={false} title="Gửi / lấy đồ" titleAlign="left">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <ScanWarehousePicker onChange={setWarehouse} value={warehouse} />
        <ScrollView
          className="-mx-4"
          contentContainerClassName="gap-2 px-4"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {segments.map(([id, label]) => (
            <TabChip
              key={id}
              label={label}
              onPress={() => setSegment(id)}
              selected={segment === id}
              tone="primary"
            />
          ))}
        </ScrollView>

        {!warehouse ? null : segment === 'COUNTER' ? (
          session && counter.status === 'open' ? (
            <CounterCustomerPanel
              onDropOff={(contractId, requestId) => openForm(contractId, 'DROP_OFF', requestId)}
              onNextCustomer={counter.end}
              onOpenReceipt={openReceipt}
              onPickUp={(contractId, requestId) => openForm(contractId, 'PICK_UP', requestId)}
              secondsLeft={counter.secondsLeft}
              session={session}
            />
          ) : (
            <View className="gap-3">
              <Text className="text-body text-text-secondary">
                Quét mã “Gửi / lấy đồ” trên điện thoại khách. Mỗi mã chỉ dùng một lần.
              </Text>
              <CounterScanner
                busy={counter.status === 'opening'}
                error={counter.error}
                onDismissError={counter.end}
                onSubmit={counter.open}
              />
            </View>
          )
        ) : segment === 'DROP_OFF_REQUESTS' ? (
          <WarehouseDropOffRequests warehouseId={warehouse.id} />
        ) : segment === 'REQUESTS' ? (
          <WarehousePickupRequests warehouseId={warehouse.id} />
        ) : segment === 'RECEIPTS' ? (
          <WarehouseReceiptsList onOpen={openReceipt} warehouseId={warehouse.id} />
        ) : (
          <AbandonedShelvesList
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
            warehouseId={warehouse.id}
          />
        )}
      </ScrollView>
    </FlowScreen>
  );
}
