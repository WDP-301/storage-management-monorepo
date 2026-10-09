import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { TicketsApi } from '../../lib/tickets-api';
import { TicketDetailScreen } from '../../src/features/customer/TicketDetailScreen';
import type { ServiceTicketRecord } from '../../src/types/ticket-api';

export default function TicketDetailRoute() {
  const router = useRouter();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [ticket, setTicket] = useState<ServiceTicketRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      setTicket(await TicketsApi.getById(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tải được yêu cầu.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Reached only via a ticket row, so a missing id means a stale deep link, not real state.
  if (!id) return <Redirect href="/(customer)/tickets" />;

  const cancel = () => {
    if (!ticket) return;
    Alert.alert('Hủy yêu cầu hỗ trợ', 'Bạn chắc chắn muốn hủy yêu cầu này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy yêu cầu',
        style: 'destructive',
        onPress: () => {
          setIsCancelling(true);
          TicketsApi.cancel(ticket.id)
            .then(setTicket)
            .catch((e: unknown) =>
              setError(e instanceof ApiError ? e.message : 'Không hủy được yêu cầu.'),
            )
            .finally(() => setIsCancelling(false));
        },
      },
    ]);
  };

  return (
    <TicketDetailScreen
      ticket={ticket}
      isLoading={isLoading}
      isCancelling={isCancelling}
      error={error}
      sessionUserId={user?.id}
      onCancel={cancel}
      onRetry={() => void load()}
      onBack={() => router.navigate('/(customer)/tickets')}
    />
  );
}
