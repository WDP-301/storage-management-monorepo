import {
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
  Textarea,
} from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  DotsThree,
  Link as LinkIcon,
  Money,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { SepayTransferOutcome } from '@storage/types';
import React, { useCallback, useEffect, useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { type SepayTransferRecord, SepayTransfersApi } from '../../lib/sepay-transfers-api';
import { useAppToast } from '../../lib/toast';

const PAGE_SIZE = 20;

const OUTCOME_LABEL: Record<SepayTransferOutcome, string> = {
  RECEIVED: 'Chờ khớp',
  IGNORED: 'Bỏ qua',
  DEPOSIT_CONFIRMED: 'Đủ cọc',
  DEPOSIT_PARTIAL: 'Cọc một phần',
  INVOICE_PAID: 'Đã trả HĐ',
  INVOICE_PARTIAL: 'Trả HĐ một phần',
  UNMATCHED: 'Không khớp',
  AMBIGUOUS: 'Khớp nhiều',
  LATE: 'Đến trễ',
  NEEDS_REVIEW: 'Cần xem xét',
  RESOLVED: 'Đã xử lý',
};

const OUTCOME_VARIANT: Record<
  SepayTransferOutcome,
  'success' | 'warning' | 'error' | 'neutral' | 'primary'
> = {
  RECEIVED: 'primary',
  IGNORED: 'neutral',
  DEPOSIT_CONFIRMED: 'success',
  DEPOSIT_PARTIAL: 'warning',
  INVOICE_PAID: 'success',
  INVOICE_PARTIAL: 'warning',
  UNMATCHED: 'error',
  AMBIGUOUS: 'error',
  LATE: 'warning',
  NEEDS_REVIEW: 'error',
  RESOLVED: 'success',
};

const ACTIONABLE: readonly SepayTransferOutcome[] = [
  SepayTransferOutcome.RECEIVED,
  SepayTransferOutcome.UNMATCHED,
  SepayTransferOutcome.AMBIGUOUS,
  SepayTransferOutcome.LATE,
  SepayTransferOutcome.NEEDS_REVIEW,
];

const vnd = (n: number) => `${Number(n).toLocaleString('vi-VN')}₫`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour12: false }) : '—';

export const SepayReconciliationPage: React.FC = () => {
  const toast = useAppToast();
  const [transfers, setTransfers] = useState<SepayTransferRecord[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignTarget, setAssignTarget] = useState<SepayTransferRecord | null>(null);
  const [bookingNo, setBookingNo] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [resolveTarget, setResolveTarget] = useState<SepayTransferRecord | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await SepayTransfersApi.list({
        page,
        limit: PAGE_SIZE,
        attention: !showAll,
      });
      setTransfers(res.transfers);
      setMeta(res.meta);
    } catch (err) {
      setTransfers([]);
      const msg = err instanceof Error ? err.message : 'Không tải được danh sách chuyển khoản.';
      setError(msg);
      toast.error('Lỗi tải dữ liệu', msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, showAll, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = (t: SepayTransferRecord) => {
    setAssignTarget(t);
    setBookingNo('');
    setAssignNote('');
    setAssignError(null);
  };

  const handleAssign = async () => {
    if (!assignTarget || !bookingNo.trim()) return;
    setIsAssigning(true);
    setAssignError(null);
    try {
      const res = await SepayTransfersApi.assign(assignTarget.id, bookingNo, assignNote);
      toast.success('Đã gán chuyển khoản', res.message);
      setAssignTarget(null);
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 404
          ? 'Không tìm thấy booking với mã này.'
          : status === 409
            ? (err as Error).message || 'Booking không ở trạng thái chờ cọc.'
            : err instanceof Error
              ? err.message
              : 'Không gán được chuyển khoản.';
      setAssignError(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget || !resolveNote.trim()) return;
    setIsResolving(true);
    setResolveError(null);
    try {
      await SepayTransfersApi.resolve(resolveTarget.id, resolveNote);
      toast.success('Đã đóng chuyển khoản', 'Ghi chú xử lý đã được lưu.');
      setResolveTarget(null);
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 409
          ? 'Chuyển khoản này đã được xử lý.'
          : err instanceof Error
            ? err.message
            : 'Không đóng được chuyển khoản.';
      setResolveError(msg);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-kumo-default">Đối soát chuyển khoản</h1>
          <Text variant="secondary" size="sm">
            Tiền vào tài khoản ngân hàng chưa khớp booking/hóa đơn — gán tay hoặc đóng kèm ghi chú.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Phạm vi hiển thị"
            value={showAll ? 'all' : 'queue'}
            onValueChange={(v) => {
              setShowAll(v === 'all');
              setPage(1);
            }}
            items={[
              { value: 'queue', label: 'Chỉ cần xử lý' },
              { value: 'all', label: 'Tất cả chuyển khoản' },
            ]}
          />
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className={isLoading ? 'animate-spin' : ''} />}
            onClick={load}
            disabled={isLoading}
          >
            Tải lại
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm">
          <WarningCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Queue table */}
      <LayerCard>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Thời gian · Ngân hàng</Table.Head>
              <Table.Head>Số tiền</Table.Head>
              <Table.Head>Nội dung chuyển khoản</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head>Chi tiết xử lý</Table.Head>
              <Table.Head className="text-center">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-10 text-kumo-subtle">
                  <CircleNotch className="w-5 h-5 animate-spin inline-block mr-2" />
                  Đang tải…
                </Table.Cell>
              </Table.Row>
            ) : transfers.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-10">
                  <CheckCircle className="w-6 h-6 text-kumo-success inline-block mb-1" />
                  <div className="text-kumo-subtle text-sm">
                    {showAll
                      ? 'Chưa có chuyển khoản nào.'
                      : 'Không còn chuyển khoản nào cần xử lý.'}
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : (
              transfers.map((t) => {
                const actionable = ACTIONABLE.includes(t.outcome);
                return (
                  <Table.Row key={t.id}>
                    <Table.Cell className="whitespace-nowrap">
                      <div className="text-sm text-kumo-default">{fmtDate(t.transaction_date)}</div>
                      <div className="text-xs text-kumo-subtle font-mono">
                        {t.gateway ?? '—'} · #{t.sepay_id}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="font-semibold text-kumo-default">{vnd(t.amount)}</span>
                      {t.reference_code && (
                        <div className="text-xs text-kumo-subtle font-mono">
                          ref {t.reference_code}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell className="min-w-[220px] max-w-sm">
                      <span className="text-xs font-mono text-kumo-default break-all">
                        {t.content || '—'}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <Badge variant={OUTCOME_VARIANT[t.outcome]}>{OUTCOME_LABEL[t.outcome]}</Badge>
                    </Table.Cell>
                    <Table.Cell className="min-w-[160px] max-w-[220px]">
                      {t.resolution_note ? (
                        <span className="text-xs text-kumo-subtle">{t.resolution_note}</span>
                      ) : t.booking_id ? (
                        <span className="text-xs text-kumo-subtle">Booking đã gán</span>
                      ) : t.invoice_id ? (
                        <span className="text-xs text-kumo-subtle">Đã ghi nhận hóa đơn</span>
                      ) : (
                        <span className="text-xs text-kumo-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-center">
                      {actionable ? (
                        <DropdownMenu>
                          <DropdownMenu.Trigger
                            render={
                              <Button
                                size="sm"
                                variant="ghost"
                                shape="square"
                                icon={<DotsThree weight="bold" />}
                                aria-label={`Thao tác chuyển khoản ${t.sepay_id}`}
                                title={`Thao tác chuyển khoản ${t.sepay_id}`}
                              />
                            }
                          />
                          <DropdownMenu.Content align="end" sideOffset={4}>
                            <DropdownMenu.Item icon={LinkIcon} onClick={() => openAssign(t)}>
                              Gán vào booking…
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              icon={CheckCircle}
                              onClick={() => {
                                setResolveTarget(t);
                                setResolveNote('');
                                setResolveError(null);
                              }}
                            >
                              Đóng thủ công…
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-kumo-subtle">Đã xong</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </LayerCard>

      {meta && meta.total > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={meta.limit} totalCount={meta.total}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      {/* Assign dialog */}
      <Dialog.Root open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-xl sm:w-[560px] w-full`}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <Money className="w-5 h-5 text-kumo-brand" />
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Gán chuyển khoản vào booking
              </Dialog.Title>
            </div>
            <Dialog.Close
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X weight="bold" />}
                  aria-label="Đóng"
                />
              }
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            {assignTarget && (
              <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-kumo-default">
                    {vnd(assignTarget.amount)}
                  </span>
                  <Badge variant={OUTCOME_VARIANT[assignTarget.outcome]}>
                    {OUTCOME_LABEL[assignTarget.outcome]}
                  </Badge>
                </div>
                <div className="font-mono text-kumo-subtle break-all">
                  {assignTarget.content || '(không có nội dung)'}
                </div>
                <div className="text-kumo-subtle">
                  {fmtDate(assignTarget.transaction_date)} · {assignTarget.gateway ?? '—'}
                </div>
              </div>
            )}

            <InputGroup
              label="Mã booking (BK-…)"
              description="Hệ thống sẽ ghi nhận khoản này như tiền cọc của booking và xác nhận nếu đủ."
            >
              <InputGroup.Input
                value={bookingNo}
                onChange={(e) => setBookingNo(e.target.value)}
                placeholder="VD: BK-20261110-1234"
                autoFocus
              />
            </InputGroup>

            <Textarea
              label="Ghi chú (không bắt buộc)"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Vì sao gán vào booking này — khách xác nhận qua hotline…"
              rows={2}
              className="w-full min-w-0 resize-y"
            />

            {assignError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm">
                <WarningCircle className="w-4 h-4 shrink-0" />
                {assignError}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAssignTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={isAssigning || !bookingNo.trim()}
            >
              {isAssigning ? 'Đang gán…' : 'Gán vào booking'}
            </Button>
          </DialogFooter>
        </Dialog>
      </Dialog.Root>

      {/* Resolve dialog */}
      <Dialog.Root open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-xl sm:w-[560px] w-full`}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-kumo-brand" />
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Đóng chuyển khoản thủ công
              </Dialog.Title>
            </div>
            <Dialog.Close
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X weight="bold" />}
                  aria-label="Đóng"
                />
              }
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            {resolveTarget && (
              <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-kumo-default">
                    {vnd(resolveTarget.amount)}
                  </span>
                  <Badge variant={OUTCOME_VARIANT[resolveTarget.outcome]}>
                    {OUTCOME_LABEL[resolveTarget.outcome]}
                  </Badge>
                </div>
                <div className="font-mono text-kumo-subtle break-all">
                  {resolveTarget.content || '(không có nội dung)'}
                </div>
              </div>
            )}

            <Text variant="secondary" size="sm">
              Dùng khi tiền không thuộc booking nào — khách chuyển nhầm, đã hoàn tay, hoặc xử lý
              ngoài hệ thống. Ghi chú là bắt buộc để đối soát sau này.
            </Text>

            <Textarea
              label="Cách xử lý"
              required
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="VD: Khách CK nhầm, đã hoàn 1.500.000₫ qua MB lúc 14h 10/11 — phiếu chi #123"
              rows={4}
              autoFocus
              className="w-full min-w-0 resize-y"
            />

            {resolveError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm">
                <WarningCircle className="w-4 h-4 shrink-0" />
                {resolveError}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResolveTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleResolve}
              disabled={isResolving || !resolveNote.trim()}
            >
              {isResolving ? 'Đang lưu…' : 'Đóng chuyển khoản'}
            </Button>
          </DialogFooter>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
