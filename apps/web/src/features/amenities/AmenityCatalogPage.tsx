import { Badge, Button, Empty, LayerCard, Table, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  ListChecks,
  PencilSimple,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AmenitiesApi } from '../../lib/amenities-api';
import { useAppToast } from '../../lib/toast';
import type { Amenity } from '../../types/amenity';
import { AmenityDeactivateDialog } from './AmenityDeactivateDialog';
import { AmenityFormDialog } from './AmenityFormDialog';
import { describeAmenityError } from './amenity-form';

type LoadStatus = 'loading' | 'ready' | 'failed';

export const AmenityCatalogPage: React.FC = () => {
  const toast = useAppToast();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [deactivating, setDeactivating] = useState<Amenity | null>(null);

  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    // Only the newest request may write state, so a slow older response cannot overwrite fresher data.
    const requestId = ++latestRequest.current;
    setStatus('loading');
    try {
      const result = await AmenitiesApi.listAdmin();
      if (requestId !== latestRequest.current) return;
      setAmenities(result);
      setStatus('ready');
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setStatus('failed');
      toast.error('Lỗi tải dữ liệu', describeAmenityError(err, 'Không tải được tiện ích.'));
    }
  }, [toast]);

  useEffect(() => {
    load();
    // Invalidate any in-flight request on unmount.
    return () => {
      latestRequest.current += 1;
    };
  }, [load]);

  const isLoading = status === 'loading';

  const openForm = (amenity: Amenity | null) => {
    setEditing(amenity);
    setFormOpen(true);
  };

  const reactivate = async (amenity: Amenity) => {
    setBusyId(amenity.id);
    try {
      await AmenitiesApi.update(amenity.id, { isActive: true });
      toast.success('Dùng lại tiện ích', `Đã dùng lại tiện ích ${amenity.code}.`);
      await load();
    } catch (err) {
      toast.error('Không thể dùng lại tiện ích', describeAmenityError(err, 'Vui lòng thử lại.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-kumo-default">Tiện ích kho</h1>
          <Text variant="secondary" size="sm">
            Tiện ích đã bao gồm trong giá thuê — không thu phí riêng.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={load}
            loading={isLoading}
          >
            Làm mới
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => openForm(null)}
          >
            Thêm tiện ích
          </Button>
        </div>
      </div>

      {status === 'failed' && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2.5"
        >
          <WarningCircle className="w-4 h-4 shrink-0" />
          Không tải được danh sách tiện ích. Hãy bấm "Làm mới" để thử lại.
        </div>
      )}

      <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Mã</Table.Head>
              <Table.Head>Tên</Table.Head>
              <Table.Head>Mô tả</Table.Head>
              <Table.Head>Thứ tự</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {amenities.length === 0 && isLoading && (
              <Table.Row>
                <Table.Cell className="p-6 text-center text-kumo-subtle" colSpan={6}>
                  Đang tải…
                </Table.Cell>
              </Table.Row>
            )}
            {amenities.length === 0 && status === 'ready' && (
              <Table.Row>
                <Table.Cell className="p-0" colSpan={6}>
                  <Empty
                    size="sm"
                    icon={<ListChecks className="w-8 h-8" />}
                    title="Chưa có tiện ích nào"
                    description="Hãy thêm tiện ích đầu tiên để gắn vào kho."
                  />
                </Table.Cell>
              </Table.Row>
            )}
            {amenities.map((a) => (
              <Table.Row key={a.id}>
                <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                  {a.code}
                </Table.Cell>
                <Table.Cell className="font-medium text-kumo-default">{a.name}</Table.Cell>
                <Table.Cell className="text-kumo-subtle max-w-xs">
                  {a.description ?? '—'}
                </Table.Cell>
                <Table.Cell>{a.sortOrder}</Table.Cell>
                <Table.Cell>
                  <Badge variant={a.isActive ? 'success' : 'neutral'}>
                    {a.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Sửa tiện ích ${a.code}`}
                      icon={<PencilSimple className="w-3.5 h-3.5" />}
                      onClick={() => openForm(a)}
                    >
                      Sửa
                    </Button>
                    {a.isActive ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Ngừng dùng tiện ích ${a.code}`}
                        onClick={() => setDeactivating(a)}
                      >
                        Ngừng dùng
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Dùng lại tiện ích ${a.code}`}
                        loading={busyId === a.id}
                        onClick={() => reactivate(a)}
                      >
                        Dùng lại
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>

      <AmenityFormDialog
        open={formOpen}
        amenity={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, created) => {
          setFormOpen(false);
          if (created) toast.notifyCreated('tiện ích', saved.code);
          else toast.notifyUpdated('tiện ích', saved.code);
          load();
        }}
      />
      <AmenityDeactivateDialog
        amenity={deactivating}
        onClose={() => setDeactivating(null)}
        onDone={() => {
          setDeactivating(null);
          load();
        }}
      />
    </div>
  );
};
