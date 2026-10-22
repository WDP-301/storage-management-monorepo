import { useRouter } from 'expo-router';
import { useSession } from '../../lib/session';
import { StaffTicketsScreen } from '../../src/features/staff/StaffTicketsScreen';
import { useStaffTickets } from '../../src/features/staff/use-staff-tickets';

export default function StaffRequestsRoute() {
  const router = useRouter();
  const { user } = useSession();
  const list = useStaffTickets();

  return (
    <StaffTicketsScreen
      tickets={list.tickets}
      isManager={user?.roles.includes('FACILITY_MANAGER') ?? false}
      isLoading={list.isLoading}
      isLoadingMore={list.isLoadingMore}
      hasMore={list.hasMore}
      error={list.error}
      statusFilter={list.statusFilter}
      onFilterStatus={list.setStatusFilter}
      onRefresh={list.refresh}
      onLoadMore={list.loadMore}
      onOpenTicket={(id) => router.navigate(`/(staff)/staff-ticket?id=${encodeURIComponent(id)}`)}
    />
  );
}
