import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Maximize2,
  Search,
  Sparkles,
  Warehouse,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Badge } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../design-system/Card';
import { Input } from '../../design-system/Input';
import { Tabs } from '../../design-system/Tabs';
import { formatDistance, formatMoney, INITIAL_FACILITY_OFFERS } from '../../lib/units-data';
import { BrowseMode, FacilityOffer, HeldBooking, UnitOffer } from '../../types/customer';

export const BrowseUnitsPage: React.FC = () => {
  const [facilities] = useState<FacilityOffer[]>(INITIAL_FACILITY_OFFERS);
  const [mode, setMode] = useState<BrowseMode>('recommended');
  const [requestedQuantity, setRequestedQuantity] = useState<number>(2);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000000);
  const [heldBooking, setHeldBooking] = useState<HeldBooking | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [waitlistFacility, setWaitlistFacility] = useState<string | null>(null);

  // All units flattened
  const allUnits = useMemo(() => facilities.flatMap((f) => f.units), [facilities]);

  // Selected unit objects
  const selectedUnits = useMemo(
    () => allUnits.filter((u) => selectedUnitIds.includes(u.id)),
    [allUnits, selectedUnitIds],
  );

  const selectedFacilitiesCount = useMemo(
    () => new Set(selectedUnits.map((u) => u.facilityId)).size,
    [selectedUnits],
  );

  // Filter facilities & units based on user filters
  const filteredFacilities = useMemo(() => {
    return facilities
      .map((fac) => {
        const matchesFacQuery =
          fac.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fac.address.toLowerCase().includes(searchQuery.toLowerCase());

        const matchingUnits = fac.units.filter((unit) => {
          const matchesUnitQuery =
            matchesFacQuery ||
            unit.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            unit.zone.toLowerCase().includes(searchQuery.toLowerCase());

          const matchesSize =
            sizeFilter === 'all' ||
            (sizeFilter === '3' && (unit.areaM2 === 3 || unit.size.includes('3'))) ||
            (sizeFilter === '5' && (unit.areaM2 === 5 || unit.size.includes('5'))) ||
            (sizeFilter === '10' && (unit.areaM2 === 10 || unit.size.includes('10')));

          const matchesPrice = unit.monthlyPrice <= maxPriceFilter;

          return matchesUnitQuery && matchesSize && matchesPrice;
        });

        return {
          ...fac,
          units: matchingUnits,
        };
      })
      .filter(
        (fac) => fac.units.length > 0 || fac.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [facilities, searchQuery, sizeFilter, maxPriceFilter]);

  const toggleSelectUnit = (unit: UnitOffer) => {
    if (selectedUnitIds.includes(unit.id)) {
      setSelectedUnitIds((prev) => prev.filter((id) => id !== unit.id));
    } else {
      if (selectedUnitIds.length >= requestedQuantity) {
        // Replace oldest or keep max
        setSelectedUnitIds((prev) => [...prev.slice(1), unit.id]);
      } else {
        setSelectedUnitIds((prev) => [...prev, unit.id]);
      }
    }
  };

  const handleHoldBooking = (unitsToHold: UnitOffer[]) => {
    const booking: HeldBooking = {
      id: `hold_${Date.now()}`,
      units: unitsToHold,
      startDate: new Date().toLocaleDateString('vi-VN'),
      durationMonths: 3,
      holdExpiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
    };
    setHeldBooking(booking);
    setShowBookingModal(true);
  };

  const handleClearSelection = () => {
    setSelectedUnitIds([]);
  };

  const totalMonthlyPrice = selectedUnits.reduce((acc, u) => acc + u.monthlyPrice, 0);
  const totalDeposit = selectedUnits.reduce((acc, u) => acc + u.deposit, 0);

  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Warehouse className="w-6 h-6 text-accent" />
            Tìm kho tự quản theo cơ sở
          </h1>
          <p className="text-sm text-muted mt-1">
            Đặt nhiều kho trong cùng một lượt, hệ thống tự động gom kho gần nhau tại cùng cơ sở.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="shrink-0">
          <Tabs
            tabs={[
              {
                id: 'recommended',
                label: 'Đề xuất theo cơ sở',
                icon: <Sparkles className="w-4 h-4 text-accent" />,
              },
              {
                id: 'manual',
                label: 'Tự chọn kho',
                icon: <Filter className="w-4 h-4 text-muted" />,
              },
            ]}
            activeTab={mode}
            onChange={(tabId) => setMode(tabId as BrowseMode)}
          />
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <Card className="border border-border bg-surface">
        <CardBody className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search query */}
            <div className="md:col-span-1">
              <label
                htmlFor="filter-search-facility"
                className="text-xs font-semibold text-muted block mb-1.5"
              >
                Cơ sở hoặc khu vực
              </label>
              <Input
                id="filter-search-facility"
                placeholder="Tìm Thủ Đức, Quận 9..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                rightIcon={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-muted hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null
                }
              />
            </div>

            {/* Size filter */}
            <div>
              <label
                htmlFor="filter-unit-size"
                className="text-xs font-semibold text-muted block mb-1.5"
              >
                Diện tích kho
              </label>
              <select
                id="filter-unit-size"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="w-full min-h-[44px] px-3.5 text-sm bg-surface text-foreground border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="all">Tất cả kích thước</option>
                <option value="3">Kho nhỏ (3 m²)</option>
                <option value="5">Kho vừa (5 m²)</option>
                <option value="10">Kho lớn (10 m²)</option>
              </select>
            </div>

            {/* Price filter */}
            <div>
              <label
                htmlFor="filter-max-price"
                className="text-xs font-semibold text-muted block mb-1.5 flex justify-between"
              >
                <span>Ngân sách mỗi kho</span>
                <span className="font-bold text-foreground">{formatMoney(maxPriceFilter)}</span>
              </label>
              <div className="h-[44px] flex items-center">
                <input
                  id="filter-max-price"
                  type="range"
                  min="1500000"
                  max="5000000"
                  step="250000"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <span className="text-xs font-semibold text-muted block mb-1.5">
                Số lượng kho cần thuê
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => {
                      setRequestedQuantity(qty);
                      setSelectedUnitIds((prev) => prev.slice(0, qty));
                    }}
                    className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold border transition-colors cursor-pointer ${
                      requestedQuantity === qty
                        ? 'bg-accent text-accent-foreground border-accent shadow-xs'
                        : 'bg-surface-secondary text-foreground border-border hover:bg-surface-tertiary'
                    }`}
                  >
                    {qty} kho
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Facilities & Units Listing */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">
              {mode === 'recommended' ? 'Cơ sở đáp ứng đề xuất' : 'Danh sách kho theo cơ sở'}
            </h2>
            <Badge variant="accent">{filteredFacilities.length} cơ sở</Badge>
          </div>
          <span className="text-xs text-muted">Được sắp xếp theo khoảng cách gần nhất</span>
        </div>

        {filteredFacilities.length === 0 ? (
          <Card className="border border-border p-12 text-center">
            <Warehouse className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-base font-bold text-foreground">Không tìm thấy kho phù hợp</p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Không có kho hoặc cơ sở nào khớp với tiêu chí lọc. Vui lòng thay đổi khoảng giá hoặc
              diện tích.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSizeFilter('all');
                  setMaxPriceFilter(5000000);
                }}
              >
                Đặt lại bộ lọc
              </Button>
            </div>
          </Card>
        ) : (
          filteredFacilities.map((facility) => {
            const proposedUnits = facility.units.slice(0, requestedQuantity);
            const isFullMatch = proposedUnits.length >= requestedQuantity;
            const facilityMonthlyTotal = proposedUnits.reduce((sum, u) => sum + u.monthlyPrice, 0);
            const facilityDepositTotal = proposedUnits.reduce((sum, u) => sum + u.deposit, 0);

            return (
              <Card key={facility.id} className="border border-border bg-surface">
                {/* Facility Header */}
                <CardHeader className="bg-surface-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <CardTitle className="text-base sm:text-lg font-bold">
                        {facility.name}
                      </CardTitle>
                      <Badge
                        variant={isFullMatch ? 'success' : 'warning'}
                        icon={<CheckCircle2 className="w-3 h-3" />}
                      >
                        {isFullMatch
                          ? `Đủ ${requestedQuantity}/${requestedQuantity} kho`
                          : `Còn ${proposedUnits.length} kho khả dụng`}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        {facility.address}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        Cách bạn {formatDistance(facility.distanceKm)}
                      </span>
                    </div>
                  </div>

                  {/* Recommended Mode Action on Facility Header */}
                  {mode === 'recommended' && (
                    <div className="flex items-center gap-3 shrink-0">
                      {isFullMatch ? (
                        <Button
                          variant="primary"
                          size="md"
                          rightIcon={<ArrowRight className="w-4 h-4" />}
                          onClick={() => handleHoldBooking(proposedUnits)}
                        >
                          Giữ nhóm {requestedQuantity} kho này
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => setWaitlistFacility(facility.id)}
                        >
                          {waitlistFacility === facility.id
                            ? 'Đã ghi nhận chờ'
                            : 'Đăng ký danh sách chờ'}
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>

                {/* Units Grid */}
                <CardBody className="p-4 sm:p-5">
                  {mode === 'recommended' ? (
                    <div>
                      <div className="text-xs font-semibold text-muted mb-3">
                        Kho được hệ thống tự động ghép cặp liền kề:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {proposedUnits.map((unit) => (
                          <div
                            key={unit.id}
                            className="p-3.5 rounded-lg border border-border bg-surface-secondary/40 hover:border-accent/40 transition-colors flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-bold text-accent">
                                  {unit.code}
                                </span>
                                <Badge variant="neutral" className="text-[10px]">
                                  {unit.zone}
                                </Badge>
                              </div>
                              <div className="text-xs text-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                                <Maximize2 className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span>{unit.size}</span>
                                {unit.volumeM3 && (
                                  <span className="text-accent font-semibold">
                                    · {unit.volumeM3} m³
                                  </span>
                                )}
                                <span className="text-muted font-normal">({unit.dimensions})</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {unit.features.map((feat, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-surface text-muted border border-border"
                                  >
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-separator/60 flex items-center justify-between">
                              <span className="text-xs text-muted">Giá thuê:</span>
                              <span className="text-sm font-bold text-foreground">
                                {formatMoney(unit.monthlyPrice)}/tháng
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary Banner for Recommended Mode */}
                      <div className="mt-4 p-3 bg-surface-secondary/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-muted">Tổng thuê/tháng: </span>
                            <span className="font-bold text-sm text-foreground">
                              {formatMoney(facilityMonthlyTotal)}
                            </span>
                          </div>
                          <div className="h-4 w-px bg-separator" />
                          <div>
                            <span className="text-muted">Tiền cọc: </span>
                            <span className="font-bold text-sm text-foreground">
                              {formatMoney(facilityDepositTotal)}
                            </span>
                          </div>
                        </div>
                        <div className="text-muted flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          <span>Giữ chỗ miễn phí trong 15 phút</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Manual Mode: Show all available units with individual select toggles */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {facility.units.map((unit) => {
                        const isSelected = selectedUnitIds.includes(unit.id);
                        return (
                          <button
                            type="button"
                            key={unit.id}
                            aria-pressed={isSelected}
                            onClick={() => toggleSelectUnit(unit)}
                            className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between text-left ${
                              isSelected
                                ? 'bg-accent/5 border-accent ring-1 ring-accent'
                                : 'bg-surface hover:bg-surface-secondary/40 border-border'
                            }`}
                          >
                            <div className="space-y-2 w-full">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-bold text-accent">
                                  {unit.code}
                                </span>
                                <Badge
                                  variant={isSelected ? 'accent' : 'neutral'}
                                  icon={isSelected ? <Check className="w-3 h-3" /> : undefined}
                                >
                                  {isSelected ? 'Đã chọn' : unit.zone}
                                </Badge>
                              </div>
                              <div className="text-xs text-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                                <Maximize2 className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span>{unit.size}</span>
                                {unit.volumeM3 && (
                                  <span className="text-accent font-semibold">
                                    · {unit.volumeM3} m³
                                  </span>
                                )}
                                <span className="text-muted font-normal">({unit.dimensions})</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {unit.features.map((feat, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-surface-secondary text-muted border border-border"
                                  >
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-separator/60 flex items-center justify-between w-full">
                              <span className="text-sm font-bold text-foreground">
                                {formatMoney(unit.monthlyPrice)}/tháng
                              </span>
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                                  isSelected
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-surface-secondary text-foreground hover:bg-surface-tertiary'
                                }`}
                              >
                                {isSelected ? 'Bỏ chọn' : 'Chọn kho'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })
        )}
      </div>

      {/* Floating Bottom Action Bar for Manual Selection Mode */}
      {mode === 'manual' && selectedUnits.length > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="bg-surface border border-accent/40 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-foreground">
                  Đã chọn {selectedUnits.length}/{requestedQuantity} kho
                </span>
                {selectedFacilitiesCount > 1 && (
                  <Badge variant="warning" icon={<AlertTriangle className="w-3 h-3" />}>
                    Kho thuộc {selectedFacilitiesCount} cơ sở khác nhau
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>
                  Tổng tiền thuê:{' '}
                  <strong className="text-foreground">
                    {formatMoney(totalMonthlyPrice)}/tháng
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Tiền cọc: <strong className="text-foreground">{formatMoney(totalDeposit)}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button variant="ghost" size="md" onClick={handleClearSelection}>
                Hủy chọn
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={selectedUnits.length !== requestedQuantity}
                onClick={() => handleHoldBooking(selectedUnits)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Giữ {selectedUnits.length} kho đã chọn
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Hold Confirmation Modal */}
      {showBookingModal && heldBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-secondary/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Giữ chỗ kho thành công</h3>
                  <p className="text-xs text-muted">Mã giữ chỗ: {heldBooking.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="text-muted hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Thời hạn giữ chỗ: 15 phút.</strong> Hệ thống đang bảo lưu các kho này cho
                  bạn. Vui lòng hoàn tất thủ tục thanh toán cọc để ký hợp đồng chính thức.
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Danh sách kho đã giữ ({heldBooking.units.length} kho)
                </h4>
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {heldBooking.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="p-3 bg-surface flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-accent">{unit.code}</span>
                        <span className="text-muted ml-2">
                          ({unit.facility} - {unit.zone})
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatMoney(unit.monthlyPrice)}/tháng
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Ngày bắt đầu dự kiến:</span>
                  <span className="font-medium text-foreground">{heldBooking.startDate}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Thời hạn thuê:</span>
                  <span className="font-medium text-foreground">
                    {heldBooking.durationMonths} tháng
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-sm text-foreground">
                  <span>Tổng tiền cọc cần thanh toán:</span>
                  <span className="text-accent">
                    {formatMoney(heldBooking.units.reduce((s, u) => s + u.deposit, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-secondary/40 border-t border-border flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setShowBookingModal(false)}>
                Đóng
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  alert('Tiếp tục bước thanh toán cọc và tạo hợp đồng.');
                  setShowBookingModal(false);
                }}
              >
                Tiến hành ký hợp đồng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
