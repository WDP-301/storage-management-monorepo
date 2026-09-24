import {
  IStorageItem,
  IStorageLocation,
  StorageDashboardSummary,
  StorageItemStatus,
} from '@storage/types';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CheckCircle,
  CloudUpload,
  Database,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../design-system/Card';
import { Input } from '../../design-system/Input';
import { StorageApi } from '../../lib/api';

export const DashboardPage: React.FC = () => {
  const [items, setItems] = useState<IStorageItem[]>([]);
  const [locations, setLocations] = useState<IStorageLocation[]>([]);
  const [summary, setSummary] = useState<StorageDashboardSummary>({
    totalLocations: 2,
    totalItems: 3,
    totalQuantity: 188,
    lowStockCount: 1,
    outOfStockCount: 1,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, itemRes, locRes] = await Promise.allSettled([
        StorageApi.getDashboardSummary(),
        StorageApi.getItems({ search }),
        StorageApi.getLocations(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (itemRes.status === 'fulfilled' && itemRes.value.data) setItems(itemRes.value.data);
      if (locRes.status === 'fulfilled') setLocations(locRes.value);

      setApiConnected(true);
    } catch {
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);
    try {
      const res = await StorageApi.uploadFileDirect(file);
      setUploadMessage(`Tải tệp lên thành công: ${res.key}`);
      setTimeout(() => setUploadMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại';
      setUploadMessage(`Lỗi tải lên: ${msg}`);
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
          <Badge variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>
            Đủ hàng
          </Badge>
        );
      case StorageItemStatus.LOW_STOCK:
        return (
          <Badge variant="warning" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            Sắp hết hàng
          </Badge>
        );
      case StorageItemStatus.OUT_OF_STOCK:
        return (
          <Badge variant="danger" icon={<XCircle className="w-3.5 h-3.5" />}>
            Hết hàng
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-accent" />
            Tổng quan Hàng tồn & Vận hành
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Quản lý tài sản kho hàng, đồng bộ dữ liệu PostgreSQL và Cloudflare R2
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status indicators */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs">
            <Database className="w-3.5 h-3.5 text-accent" />
            <span className="text-muted">PostgreSQL</span>
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            isLoading={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Làm mới
          </Button>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={uploading}
            leftIcon={<CloudUpload className="w-3.5 h-3.5" />}
          >
            Tải lên tệp
          </Button>

          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Tạo mặt hàng
          </Button>
        </div>
      </div>

      {uploadMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <span>{uploadMessage}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Tổng mặt hàng
              </p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{summary.totalItems}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-border">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Khu vực lưu trữ
              </p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{summary.totalLocations}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-border">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Sắp hết hàng
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-0.5">{summary.lowStockCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-border">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Hết hàng tồn
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-0.5">{summary.outOfStockCount}</p>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Warehouse Zones Overview */}
      {locations.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="p-4 sm:p-5 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Layers className="w-4 h-4 text-accent" />
              Khu vực kho đang hoạt động
            </CardTitle>
            <Badge variant="accent">{locations.length} Khu vực</Badge>
          </CardHeader>
          <CardBody className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-3.5 rounded-lg bg-surface-secondary/50 border border-border flex items-start justify-between"
                >
                  <div>
                    <span className="text-xs font-mono font-bold text-accent">{loc.code}</span>
                    <h4 className="font-semibold text-sm text-foreground">{loc.name}</h4>
                    <p className="text-xs text-muted mt-0.5">
                      {loc.address || 'Chưa cập nhật địa chỉ'}
                    </p>
                  </div>
                  <span className="text-xs bg-surface px-2 py-1 rounded border border-border font-mono text-muted">
                    Sức chứa: {loc.capacity || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Inventory Items Table */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Tìm mã SKU hoặc tên sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'IN_STOCK', label: 'Đủ hàng' },
              { id: 'LOW_STOCK', label: 'Sắp hết' },
              { id: 'OUT_OF_STOCK', label: 'Hết hàng' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap border ${
                  statusFilter === st.id
                    ? 'bg-accent text-accent-foreground border-accent shadow-xs'
                    : 'bg-surface-secondary text-muted border-border hover:text-foreground'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary/50 border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Mã SKU</th>
                <th className="px-6 py-3.5">Tên sản phẩm</th>
                <th className="px-6 py-3.5">Khu vực</th>
                <th className="px-6 py-3.5">Số lượng</th>
                <th className="px-6 py-3.5">Đơn giá</th>
                <th className="px-6 py-3.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    Không có mặt hàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-xs text-foreground">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs text-muted bg-surface-secondary px-2 py-1 rounded border border-border">
                        <Warehouse className="w-3 h-3 text-muted" />
                        {item.location?.code || item.locationId || 'Chưa gán'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <span className="text-foreground">{item.quantity}</span>{' '}
                      <span className="text-xs text-muted">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      ${Number(item.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">{renderStatusBadge(item.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
