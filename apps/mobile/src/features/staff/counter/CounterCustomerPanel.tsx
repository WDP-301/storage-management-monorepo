import type { CounterSessionView } from '@storage/types';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { CounterContractCard } from './CounterContractCard';

type Props = {
  session: CounterSessionView;
  secondsLeft: number;
  onDropOff: (contractId: string) => void;
  onPickUp: (contractId: string, requestId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
  onNextCustomer: () => void;
};

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Who is at the counter, their debt flags, and one card per shelf they rent in this warehouse. */
export function CounterCustomerPanel({
  session,
  secondsLeft,
  onDropOff,
  onPickUp,
  onOpenReceipt,
  onNextCustomer,
}: Props) {
  const { customer } = session;
  return (
    <View className="gap-4">
      <View className="gap-1 rounded-xl border border-success bg-success-bg p-4">
        <Text className="font-strong text-body-md text-foreground">
          {customer.fullName ?? customer.phone ?? '—'}
        </Text>
        {customer.fullName && customer.phone ? (
          <Text className="font-body text-body-sm text-foreground">{customer.phone}</Text>
        ) : null}
        <Text className="font-body text-caption text-muted">
          {session.warehouse.name} · phiên còn {clock(secondsLeft)}
        </Text>
      </View>

      {session.overdueInvoiceNos.length > 0 ? (
        <View className="gap-0.5 rounded-xl bg-danger-bg p-3">
          <Text className="font-strong text-body-sm text-danger">Khách còn hóa đơn quá hạn</Text>
          <Text className="font-body text-body-sm text-foreground">
            {session.overdueInvoiceNos.join(', ')}
          </Text>
        </View>
      ) : null}

      {session.contracts.map((contract) => (
        <CounterContractCard
          key={contract.contractId}
          contract={contract}
          onDropOff={() => onDropOff(contract.contractId)}
          onPickUp={(requestId) => onPickUp(contract.contractId, requestId)}
          onOpenReceipt={onOpenReceipt}
        />
      ))}

      <Button variant="secondary" onPress={onNextCustomer}>
        <Button.Label>Khách tiếp theo</Button.Label>
      </Button>
    </View>
  );
}
