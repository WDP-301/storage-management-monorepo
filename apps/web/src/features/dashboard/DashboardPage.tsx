import { Badge, Button, Empty, InputGroup, LayerCard, Table, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CloudArrowUp,
  MagnifyingGlass,
  Package,
  Plus,
  Warehouse,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import {
  IStorageItem,
  IStorageLocation,
  StorageDashboardSummary,
  StorageItemStatus,
} from '@storage/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StorageApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';

export const DashboardPage: React.FC = () => {
  const toast = useAppToast();
  const [items, setItems] = useState<IStorageItem[]>([]);
  const [locations, setLocations] = useState<IStorageLocation[]>([]);
  const [summary, setSummary] = useState<StorageDashboardSummary>({
    totalLocations: 0,
    totalItems: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, itemRes, locRes] = await Promise.allSettled([
        StorageApi.getDashboardSummary(),
        StorageApi.getItems(),
        StorageApi.getLocations(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (itemRes.status === 'fulfilled' && itemRes.value.data) setItems(itemRes.value.data);
      if (locRes.status === 'fulfilled') setLocations(locRes.value);

      if (sumRes.status === 'rejected' || itemRes.status === 'rejected') {
        toast.error('Lỗi tải dữ liệu', 'Không thể đồng bộ dữ liệu từ máy chủ.');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await StorageApi.uploadFileDirect(file);
      toast.success('Tải lên thành công', `Tệp ${res.key} đã được tải lên.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại';
      toast.error('Lỗi tải lên', msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const renderStatusBadge = (status: StorageItemStatus) => {
    switch (status) {
      case StorageItemStatus.IN_STOCK:
        return (
          <Badge variant="success" appearance="dot">
            Đủ hàng
          </Badge>
        );
      case StorageItemStatus.LOW_STOCK:
        return (
          <Badge variant="warning" appearance="dot">
            Sắp hết hàng
          </Badge>
        );
      case StorageItemStatus.OUT_OF_STOCK:
        return (
          <Badge variant="error" appearance="dot">
            Hết hàng
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const kpis = [
    { label: 'Tổng mặt hàng', value: summary.totalItems, icon: Package },
    { label: 'Khu vực lưu trữ', value: summary.totalLocations, icon: Warehouse },
    {
      label: 'Sắp hết hàng',
      value: summary.lowStockCount,
      icon: Warning,
      iconClass: 'text-kumo-warning',
    },
    {
      label: 'Hết hàng tồn',
      value: summary.outOfStockCount,
      icon: XCircle,
      iconClass: 'text-kumo-danger',
    },
  ];

  const statusFilters = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'IN_STOCK', label: 'Đủ hàng' },
    { id: 'LOW_STOCK', label: 'Sắp hết' },
    { id: 'OUT_OF_STOCK', label: 'Hết hàng' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Tổng quan hàng tồn & vận hành
          </Text>
          <Text variant="secondary">
            Quản lý tài sản kho hàng, đồng bộ dữ liệu PostgreSQL và Cloudflare R2.
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            loading={loading}
            icon={<ArrowsClockwise className="w-4 h-4" />}
          >
            Làm mới
          </Button>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            icon={<CloudArrowUp className="w-4 h-4" />}
          >
            Tải lên tệp
          </Button>

          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            Tạo mặt hàng
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <LayerCard key={kpi.label} className="px-5 py-4 ring ring-kumo-line">
            <div className="flex items-center justify-between">
              <Text variant="secondary">{kpi.label}</Text>
              <kpi.icon className={`w-4 h-4 ${kpi.iconClass ?? 'text-kumo-subtle'}`} />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-semibold text-kumo-default">{kpi.value}</span>
            </div>
          </LayerCard>
        ))}
      </div>

      {locations.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-1">
            <Text as="h3" variant="heading">
              Khu vực kho đang hoạt động
            </Text>
            <Text variant="secondary">
              {locations.length} khu vực đang được sử dụng trong hệ thống.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locations.map((loc) => (
              <LayerCard key={loc.id} className="px-5 py-4 ring ring-kumo-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <span className="font-mono text-xs text-kumo-subtle">{loc.code}</span>
                    <Text as="strong" bold>
                      {loc.name}
                    </Text>
                    <Text variant="secondary" size="xs">
                      {loc.address || 'Chưa cập nhật địa chỉ'}
                    </Text>
                  </div>
                  <Badge variant="neutral">Sức chứa: {loc.capacity || 'N/A'}</Badge>
                </div>
              </LayerCard>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <InputGroup size="sm">
              <InputGroup.Addon align="start">
                <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
              </InputGroup.Addon>
              <InputGroup.Input
                type="text"
                placeholder="Tìm mã SKU hoặc tên sản phẩm..."
                aria-label="Tìm kiếm mặt hàng"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {statusFilters.map((st) => (
              <Button
                key={st.id}
                size="sm"
                variant={statusFilter === st.id ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(st.id)}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã SKU</Table.Head>
                <Table.Head>Tên sản phẩm</Table.Head>
                <Table.Head>Khu vực</Table.Head>
                <Table.Head>Số lượng</Table.Head>
                <Table.Head>Đơn giá</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredItems.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6} className="p-0">
                    <Empty
                      size="sm"
                      icon={<Package className="w-8 h-8" />}
                      title="Không có mặt hàng nào"
                      description="Không có mặt hàng nào phù hợp với bộ lọc hiện tại."
                    />
                  </Table.Cell>
                </Table.Row>
              ) : (
                filteredItems.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell className="whitespace-nowrap font-mono text-xs">
                      {item.sku}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="font-medium text-kumo-default">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-kumo-subtle line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                      {item.location?.code || item.locationId || 'Chưa gán'}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="font-medium text-kumo-default">{item.quantity}</span>{' '}
                      <span className="text-xs text-kumo-subtle">{item.unit}</span>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                      {Number(item.price).toLocaleString('vi-VN')} đ
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>
    </div>
  );
};
