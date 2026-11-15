import type { CounterSessionView } from '@storage/types';
import { View } from 'react-native';
import { Button, InlineMessage, Text } from '../../../components/ui';
import { CounterContractCard } from './CounterContractCard';

type Props = {
  session: CounterSessionView;
  secondsLeft: number;
  onDropOff: (contractId: string, requestId?: string) => void;
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
      <View className="gap-1 rounded-[20px] border border-success-200 bg-success-0 p-4">
        <Text className="text-subtitle font-semibold text-text-primary">
          {customer.fullName ?? customer.phone ?? '—'}
        </Text>
        {customer.fullName && customer.phone ? (
          <Text className="text-body text-text-primary">{customer.phone}</Text>
        ) : null}
        <Text className="text-caption font-medium text-status-success">
          {session.warehouse.name} · phiên còn {clock(secondsLeft)}
        </Text>
      </View>

      {session.overdueInvoiceNos.length > 0 ? (
        <View className="gap-1 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
          <InlineMessage message="Khách còn hóa đơn quá hạn" type="error" />
          <Text className="text-body text-text-primary">
            {session.overdueInvoiceNos.join(', ')}
          </Text>
        </View>
      ) : null}

      {session.contracts.map((contract) => (
        <CounterContractCard
          key={contract.contractId}
          contract={contract}
          onDropOff={(requestId) => onDropOff(contract.contractId, requestId)}
          onOpenReceipt={onOpenReceipt}
          onPickUp={(requestId) => onPickUp(contract.contractId, requestId)}
        />
      ))}

      <Button fullWidth label="Khách tiếp theo" onPress={onNextCustomer} variant="secondary" />
    </View>
  );
}
