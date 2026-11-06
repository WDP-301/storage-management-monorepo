import { Badge } from '@cloudflare/kumo';
import { Warning } from '@phosphor-icons/react';
import { type ShelfDisputeTicketRef, UserRole } from '@storage/types';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TicketsApi } from '../../lib/api';
import { hasAllowedRole } from '../../lib/roles';
import type { ServiceTicketRecord } from '../../types/service-tickets';
import { formatDateTime } from '../inspections/inspection-display';
import { TICKET_STATUS_LABEL } from './shelf-records-display';

const DETAIL_ROLES = [UserRole.ADMIN, UserRole.FACILITY_MANAGER];

/** Customer-reported mismatch on this receipt. Ticket detail is only readable by ADMIN / FM. */
export const ReceiptDisputePanel: React.FC<{ ticket: ShelfDisputeTicketRef }> = ({ ticket }) => {
  const { user } = useAuth();
  const canReadTicket = hasAllowedRole(user?.roles, DETAIL_ROLES);
  const [detail, setDetail] = useState<ServiceTicketRecord | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!canReadTicket) return;
    let cancelled = false;
    TicketsApi.getOne(ticket.id)
      .then((record) => !cancelled && setDetail(record))
      // A 403 (outside the manager's facilities) just leaves the summary shown.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ticket.id, canReadTicket]);

  return (
    <section className="p-4 rounded-lg border border-kumo-warning bg-kumo-warning-tint space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-kumo-default">
        <Warning className="w-4 h-4 text-kumo-warning" />
        Khách báo phiếu này sai
        <Badge variant="warning">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
      </div>
      <p className="text-sm text-kumo-default">
        <span className="font-mono text-xs">{ticket.ticketNo}</span> · {ticket.subject}
      </p>
      <p className="text-xs text-kumo-subtle">Gửi lúc {formatDateTime(String(ticket.createdAt))}</p>
      {detail?.description && (
        <p className="text-sm text-kumo-default whitespace-pre-wrap">{detail.description}</p>
      )}
      {detail && (
        <p className="text-xs text-kumo-subtle">
          Phụ trách: {detail.assignee?.full_name ?? 'Chưa phân công'}
        </p>
      )}
    </section>
  );
};
