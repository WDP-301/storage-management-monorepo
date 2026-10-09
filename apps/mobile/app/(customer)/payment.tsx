import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { DepositPaymentScreen } from '../../src/features/customer/DepositPaymentScreen';
import { useDepositPayment } from '../../src/features/customer/use-deposit-payment';

export default function PaymentRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cancelBooking } = useHold();
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
      onBack={() => router.navigate('/(customer)/bookings')}
      onDone={() => router.navigate('/(customer)/bookings')}
      // No navigation here: the refreshed booking turns the screen into its cancelled state, which
      // is the confirmation. Leaving immediately would drop the customer on the list with no word
      // on whether the cancel actually worked.
      onCancel={() => cancelBooking(id)}
    />
  );
}
