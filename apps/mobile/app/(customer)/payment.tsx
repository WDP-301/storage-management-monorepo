import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { DepositPaymentScreen } from '../../src/features/customer/DepositPaymentScreen';
import { useDepositPayment } from '../../src/features/customer/use-deposit-payment';

export default function PaymentRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { booking, stage, isChecking, error, check } = useDepositPayment(id);

  // Reached only via a booking, so a missing id means a stale deep link rather than a real state.
  if (!id) return <Redirect href="/(customer)/bookings" />;

  return (
    <DepositPaymentScreen
      booking={booking}
      stage={stage}
      isChecking={isChecking}
      error={error}
      contentBottomPadding={32}
      onCheck={() => void check()}
      onDone={() => router.navigate('/(customer)/bookings')}
    />
  );
}
