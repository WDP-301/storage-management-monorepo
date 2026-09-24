import { Button } from '@cloudflare/kumo/components/button';
import {
  ArrowClockwise,
  CheckCircle,
  Cloud,
  Cube,
  Database,
  MagnifyingGlass,
  Package,
  Plus,
  Stack,
  UploadSimple,
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
import { StorageApi } from './lib/api';

export default function App() {
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
      setUploadMessage(`Uploaded to S3: ${res.key}`);
      setTimeout(() => setUploadMessage(null), 5000);
    } catch (err: any) {
      setUploadMessage(`Upload failed: ${err.message}`);
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

  const getStatusBadge = (status: StorageItemStatus) => {
    switch (status) {
      case StorageItemStatus.IN_STOCK:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" /> In Stock
          </span>
        );
      case StorageItemStatus.LOW_STOCK:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Warning className="w-3.5 h-3.5" /> Low Stock
          </span>
        );
      case StorageItemStatus.OUT_OF_STOCK:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
            <XCircle className="w-3.5 h-3.5" /> Out of Stock
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="isolate min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Cube className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Storage Management Hub</h1>
              <p className="text-xs text-slate-500">React 19 • PostgreSQL • Cloudflare R2</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status pills */}
            <div className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-600">PostgreSQL</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-600">Cloudflare R2</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* S3 Upload Button */}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              <UploadSimple
                className={`w-4 h-4 ${uploading ? 'animate-bounce text-blue-600' : ''}`}
              />
              {uploading ? 'Uploading...' : 'S3 Upload'}
            </button>

            <Button variant="primary">
              <Plus className="w-4 h-4" />
              New Item
            </Button>
          </div>
        </div>
      </header>

      {/* Upload Notification Banner */}
      {uploadMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-center text-xs font-medium text-blue-800 transition">
          {uploadMessage}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Items
              </p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalItems}</p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Locations
              </p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalLocations}</p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Warning className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Low Stock
              </p>
              <p className="text-2xl font-bold text-amber-600">{summary.lowStockCount}</p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Out of Stock
              </p>
              <p className="text-2xl font-bold text-rose-600">{summary.outOfStockCount}</p>
            </div>
          </div>
        </section>

        {/* Warehouse Zones Overview */}
        {locations.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Stack className="w-4 h-4 text-blue-600" /> Active Storage Zones
              </h2>
              <span className="text-xs text-slate-500">{locations.length} Zones Registered</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-600 tracking-wider">
                        {loc.code}
                      </span>
                      <h3 className="font-medium text-slate-900">{loc.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{loc.address || 'No address'}</p>
                    </div>
                    <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono">
                      Cap: {loc.capacity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Inventory Table Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              {['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Item Name</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Quantity</th>
                  <th className="px-6 py-3.5">Price</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      No storage items found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-mono font-medium text-slate-800 text-xs">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          <Warehouse className="w-3 h-3 text-slate-400" />
                          {item.location?.code || item.locationId || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <span className="text-slate-900">{item.quantity}</span>{' '}
                        <span className="text-xs text-slate-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        ${Number(item.price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
