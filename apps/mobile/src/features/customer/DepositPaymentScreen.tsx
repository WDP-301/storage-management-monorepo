import { BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BookingStatus } from '@storage/types';
import * as Clipboard from 'expo-clipboard';
import { Timer } from 'phosphor-react-native';
import { type RefObject, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { formatRemaining, holdDeadline } from '../../../lib/booking-hold-state';
import type { DepositStage } from '../../../lib/booking-payment-state';
import {
  formatIsoDate,
  formatIsoDateTime,
  formatMoney,
  formatNumber,
} from '../../../lib/format-vi';
import { useHold } from '../../../lib/hold';
import { saveRemoteImage, saveViewAsImage } from '../../../lib/save-image-to-library';
import {
  AlertSheet,
  Button,
  colors,
  Dashed,
  FlowScreen,
  Icon,
  InlineMessage,
  ReviewItem,
  renderCoatBackdrop,
  StatusPill,
  Text,
} from '../../components/ui';
import type { ApiBooking } from '../../types/booking-api';
import { SaveImageButton } from './SaveImageButton';
import { useBookingWarehouses } from './use-booking-warehouses';

/** VietQR's "compact2" template is taller than it is wide; locking the ratio stops it stretching. */
const QR_WIDTH = 220;
const QR_ASPECT_RATIO = 0.84;

/** A banking app entry from VietQR's deeplink registry. */
type BankApp = {
  appId: string;
  appLogo: string;
  appName: string;
  bankName: string;
  /** `https://dl.vietqr.io/pay?app=...` — VietQR's router redirects to the app's own scheme. */
  deeplink: string;
};

let bankAppsRequest: Promise<BankApp[]> | null = null;

/**
 * Each banking app's own deeplink URI (`scheme://path`), extracted from what
 * `dl.vietqr.io/pay?app=<id>` 301-redirects to (`intent://#Intent;scheme=…;package=…;end`).
 */
const BANK_APP_SCHEMES: Record<string, string> = {
  icb: 'vietinbankipay://',
  bidv: 'bidv.smartbanking.partner://payment',
  ocb: 'newomni-app://',
  acb: 'acbone://',
  mb: 'mbbank://',
  vcb: 'vietcombankmobile://',
  tcb: 'tcb://applink',
  vpb: 'vpbankneo://',
  'vib-2': 'myvib2://myvib2.com.vn/data',
  shb: 'shbmobile://',
  lpb: 'lv24h://',
  seab: 'seamobile://app',
  scb: 'scbmobilebanking://',
  vietbank: 'vietbankmobilebanking://',
  cake: 'cake.vn://',
  hdb: 'hdbankmobile://',
  vba: 'agribankmobile://',
  tpb: 'hydro://onboarding',
  timo: 'plus://',
  vib: 'myvib://vib.com.vn/data',
  shbvn: 'shinhanglbvnbank://',
  nab: 'deeplinkapp://nab/softotp',
  abb: 'abbankmobile://',
  eib: 'eximbankmobile://',
  coopbank: 'coopbankmobile://',
  pvcb: 'pvcombankapp://',
  wvn: 'wvbs://',
  klb: 'ksbank://ksbank.co',
  bvb: 'baovietmobile://',
  vab: 'vabmobilebanking://',
  'tpb-pay': 'qpaymobile://',
  ncb: 'ncbizimobile://',
  'acb-biz': 'abaapp://',
  oceanbank: 'oceanbankmobilebanking://',
  pbvn: 'publicbankmobile://',
  sgicb: 'Sgbmobile://',
  cimb: 'cimb://',
};

/**
 * VietQR's public registry of banking-app deeplinks (~40 apps, logo + name included).
 */
function fetchBankApps(): Promise<BankApp[]> {
  const os = Platform.OS === 'ios' ? 'ios' : 'android';
  bankAppsRequest ??= fetch(`https://api.vietqr.io/v2/${os}-app-deeplinks`)
    .then((res) => res.json())
    .then((data) => (data.apps ?? []) as BankApp[])
    .catch((error) => {
      bankAppsRequest = null;
      throw error;
    });
  return bankAppsRequest;
}

type Props = {
  booking: ApiBooking | null;
  stage: DepositStage | null;
  isChecking: boolean;
  error: string | null;
  contentBottomPadding: number;
  onCheck: () => void;
  onBack: () => void;
  onDone: () => void;
  /** Resolves once the booking is cancelled; rejects with the API's reason when it cannot be. */
  onCancel: () => Promise<void>;
};

/**
 * Deposit payment by bank transfer. The app cannot settle anything itself: the customer transfers,
 * SePay calls the API's webhook, and this screen polls until the booking turns CONFIRMED.
 */
export function DepositPaymentScreen({
  booking,
  stage,
  isChecking,
  error,
  contentBottomPadding,
  onCheck,
  onBack,
  onDone,
  onCancel,
}: Props) {
  if (!booking || !stage) {
    return (
      <FlowScreen muted title="Thanh toán tiền cọc" titleAlign="left" onBack={onBack}>
        <View className="flex-1 items-center justify-center p-6">
          {error ? (
            <View className="w-full gap-4 rounded-[20px] border border-border-default bg-bg-card p-5">
              <InlineMessage message={error} type="error" />
              <Button
                disabled={isChecking}
                label={isChecking ? 'Đang kiểm tra...' : 'Thử lại'}
                loading={isChecking}
                onPress={onCheck}
              />
            </View>
          ) : (
            <ActivityIndicator color={colors.semantic.actionPrimary} size="large" />
          )}
        </View>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen muted title="Thanh toán tiền cọc" titleAlign="left" onBack={onBack}>
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {stage === 'awaiting' ? <HoldCountdownBanner booking={booking} /> : null}

        <View className="gap-4 p-4">
          {/* Polling error banner — lets customer retry without implying manual confirmation is needed normally. */}
          {error ? (
            <View className="gap-3 rounded-[20px] border border-danger-200 bg-bg-card p-4">
              <InlineMessage message={error} type="error" />
              <Button
                disabled={isChecking}
                label={isChecking ? 'Đang kiểm tra...' : 'Thử lại'}
                loading={isChecking}
                size="sm"
                variant="secondary"
                onPress={onCheck}
              />
            </View>
          ) : null}

          {stage === 'awaiting' ? <AwaitingTransfer booking={booking} onCancel={onCancel} /> : null}

          {stage === 'paid' ? <PaymentSucceeded booking={booking} onDone={onDone} /> : null}

          {stage === 'closed' ? <BookingClosed booking={booking} onDone={onDone} /> : null}

          {stage === 'unavailable' ? (
            <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-5">
              <InlineMessage message="Chưa thanh toán online được" type="warning" />
              <Text className="text-body-sm text-text-secondary">
                Hệ thống chưa cấu hình tài khoản nhận tiền. Vui lòng liên hệ bộ phận hỗ trợ trong
                mục Cài đặt để được hướng dẫn thanh toán.
              </Text>
              <Button label="Về Kho của tôi" variant="secondary" onPress={onDone} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </FlowScreen>
  );
}

function HoldCountdownBanner({ booking }: { booking: ApiBooking }) {
  const { now } = useHold();
  const { names: warehouseNames } = useBookingWarehouses(booking);
  if (!booking.expiresAt) return null;

  return (
    <View className="bg-bg-inverse px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Timer color={colors.white} size={16} weight="fill" />
            <Text className="text-body-sm font-medium text-text-inverse">
              Thời gian giữ chỗ còn lại
            </Text>
          </View>
          <Text className="text-caption text-text-inverse/80" numberOfLines={1}>
            {booking.items.length} kho · {warehouseNames}
          </Text>
        </View>
        <View className="rounded-full bg-danger-0 px-3 py-1">
          <Text className="text-body-sm font-bold text-status-danger tabular-nums">
            {formatRemaining(holdDeadline(booking) - now)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PaymentSucceeded({ booking, onDone }: { booking: ApiBooking; onDone: () => void }) {
  const receipt = useRef<View>(null);
  const { names: warehouseNames } = useBookingWarehouses(booking);
  const firstItem = booking.items[0];

  return (
    <View className="gap-5">
      <View
        ref={receipt}
        collapsable={false}
        className="items-center gap-4 rounded-[20px] border border-border-default bg-bg-card p-5"
      >
        <View className="size-16 items-center justify-center rounded-full bg-status-success-solid">
          <Icon color={colors.white} name="check" size={32} />
        </View>

        <View className="items-center gap-1.5">
          <Text className="text-subtitle font-bold text-text-primary">Thanh toán thành công</Text>
          <Text className="text-display font-bold text-text-brand tabular-nums">
            {formatMoney(Number(booking.depositTotal))}
          </Text>
          <Text className="text-caption text-text-secondary tabular-nums">
            {formatIsoDateTime(booking.updatedAt)}
          </Text>
        </View>

        <Dashed className="w-full" />

        <View className="w-full gap-2.5">
          <SummaryRow
            label="Kho đã giữ"
            value={`${booking.items.length} kho · ${warehouseNames}`}
          />
          {firstItem ? (
            <SummaryRow
              label="Ngày bắt đầu thuê"
              value={`${formatIsoDate(firstItem.requestedStartAt.slice(0, 10))} (${firstItem.rentalMonths} tháng)`}
            />
          ) : null}
        </View>
      </View>

      <View className="gap-3">
        <SaveImageButton label="Lưu ảnh biên nhận" onSave={() => saveViewAsImage(receipt)} />
        <Button label="Xem kho của tôi" onPress={onDone} />
      </View>
    </View>
  );
}

function BookingClosed({ booking, onDone }: { booking: ApiBooking; onDone: () => void }) {
  const isCancelled = booking.status === BookingStatus.CANCELLED;

  return (
    <View className="gap-5">
      <View className="items-center gap-4 rounded-[20px] border border-border-default bg-bg-card p-5">
        <View className="size-16 items-center justify-center rounded-full bg-bg-subtle">
          <Icon color={colors.semantic.textSecondary} name="close" size={30} />
        </View>

        <View className="items-center gap-1.5">
          <Text className="text-subtitle font-bold text-text-primary">
            {isCancelled ? 'Đã hủy giữ chỗ' : 'Hết hạn giữ chỗ'}
          </Text>
          <Text className="text-display font-bold text-text-primary tabular-nums">
            {booking.items.length} kho
          </Text>
          <Text className="text-caption text-text-secondary tabular-nums">
            đã được trả lại lúc {formatIsoDateTime(booking.updatedAt)}
          </Text>
        </View>

        <Dashed className="w-full" />

        <View className="w-full gap-2.5">
          <SummaryRow label="Trạng thái" value={isCancelled ? 'Đã hủy' : 'Đã hết hạn'} />
          <SummaryRow
            label="Tiền cọc"
            value={`${formatMoney(Number(booking.depositTotal))} (chưa thu)`}
          />
        </View>
      </View>

      <View className="gap-3">
        <InlineMessage
          message={
            isCancelled
              ? 'Nếu bạn đã chuyển khoản trước khi hủy, vui lòng liên hệ hỗ trợ trong mục Cài đặt.'
              : 'Nếu bạn vừa chuyển khoản, khoản tiền cần được đối soát thủ công — vui lòng liên hệ hỗ trợ trong mục Cài đặt.'
          }
          type="info"
        />
        <Button label="Về Kho của tôi" onPress={onDone} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-body-sm text-text-secondary">{label}</Text>
      <Text
        className="flex-1 text-right text-body-sm font-semibold text-text-primary"
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function AwaitingTransfer({
  booking,
  onCancel,
}: {
  booking: ApiBooking;
  onCancel: () => Promise<void>;
}) {
  const deposit = formatMoney(Number(booking.depositTotal));
  const qrUrl = booking.paymentQrUrl;
  const bankSheetRef = useRef<BottomSheetModal>(null);

  const { names: warehouseNames, totalArea } = useBookingWarehouses(booking);
  const firstItem = booking.items[0];

  return (
    <>
      <View className="items-center gap-4 rounded-[20px] border border-border-default bg-bg-card p-5">
        <View className="items-center gap-1">
          <Text className="text-caption font-medium text-text-secondary">
            Quét mã VietQR để thanh toán tiền cọc
          </Text>
          <Text className="text-display font-bold text-text-brand tabular-nums">{deposit}</Text>
        </View>

        {qrUrl ? (
          <>
            <View className="items-center justify-center rounded-2xl bg-secondary-0 p-4">
              <Image
                accessibilityLabel="Mã VietQR thanh toán tiền cọc"
                source={{ uri: qrUrl }}
                style={{ width: QR_WIDTH, aspectRatio: QR_ASPECT_RATIO }}
                resizeMode="contain"
              />
            </View>
            <View className="w-full flex-row gap-2.5">
              <View className="flex-1">
                <SaveImageButton
                  label="Lưu ảnh QR"
                  isCompact
                  onSave={() => saveRemoteImage(qrUrl, booking.bookingNo)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Mở app ngân hàng"
                  leftIcon="account-balance"
                  size="sm"
                  variant="secondary"
                  onPress={() => bankSheetRef.current?.present()}
                />
              </View>
            </View>
          </>
        ) : null}

        <InlineMessage
          message="Hệ thống tự xác nhận ngay khi nhận được chuyển khoản."
          type="info"
        />
      </View>

      <View className="gap-3.5 rounded-[20px] border border-border-default bg-bg-card p-4">
        <ReviewItem
          icon="inventory-2"
          subtitle={`${booking.items.length} kho · ${formatNumber(totalArea)} m²${
            firstItem
              ? ` · Nhận ${formatIsoDate(firstItem.requestedStartAt.slice(0, 10))} (${firstItem.rentalMonths} tháng)`
              : ''
          }`}
          title={warehouseNames}
        />

        <Dashed />

        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-body-sm text-text-secondary">Số tiền cọc</Text>
          <Text className="text-subtitle font-bold text-text-brand tabular-nums">{deposit}</Text>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-body-sm text-text-secondary">Nội dung chuyển khoản</Text>
            <StatusPill label="Giữ nguyên nội dung" tone="warning" />
          </View>
          <CopyableCode value={booking.bookingNo} />
        </View>
      </View>

      <CancelBookingButton onCancel={onCancel} />

      <BankAppsSheet sheetRef={bankSheetRef} />
    </>
  );
}

/**
 * Bank-app picker fed by VietQR's public registry (names + logos).
 */
function BankAppsSheet({ sheetRef }: { sheetRef: RefObject<BottomSheetModal | null> }) {
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<BankApp[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');

  // Folding diacritics lets "tech" hit "Techcombank" and "ngoai" hit "Ngoại Thương".
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  const filtered = apps?.filter((app) =>
    norm(`${app.appName} ${app.bankName}`).includes(norm(query)),
  );

  const openBank = (app: BankApp) => {
    sheetRef.current?.dismiss();
    Linking.openURL(BANK_APP_SCHEMES[app.appId] ?? app.deeplink).catch(() =>
      Alert.alert('Chưa mở được', `Hãy cài ${app.appName} rồi thử lại.`),
    );
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: colors.neutral[200], width: 40 }}
      snapPoints={['70%']}
      onChange={(index) => {
        if (index >= 0 && !apps && !loadFailed) {
          fetchBankApps()
            .then(setApps)
            .catch(() => setLoadFailed(true));
        }
      }}
    >
      <View className="mb-2 px-4">
        <Text className="text-title-sm font-bold text-text-primary">Chọn app ngân hàng</Text>
      </View>
      {loadFailed ? (
        <View className="items-center gap-3 px-4 py-8">
          <Text className="text-body-sm text-text-secondary">
            Không tải được danh sách ngân hàng.
          </Text>
          <Button
            fullWidth={false}
            label="Thử lại"
            size="sm"
            variant="secondary"
            onPress={() => {
              setLoadFailed(false);
              fetchBankApps()
                .then(setApps)
                .catch(() => setLoadFailed(true));
            }}
          />
        </View>
      ) : apps === null ? (
        <ActivityIndicator className="my-8" color={colors.semantic.actionPrimary} />
      ) : (
        <>
          <BottomSheetTextInput
            className="mx-4 mb-2 h-[42px] rounded-full border border-border-default bg-bg-subtle px-4 font-sans text-body-sm text-text-primary"
            placeholder="Tìm ngân hàng..."
            placeholderTextColor={colors.semantic.textPlaceholder}
            value={query}
            onChangeText={setQuery}
          />
          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item: BankApp) => item.appId}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
            renderItem={({ item }: { item: BankApp }) => (
              <Pressable
                className="flex-row items-center gap-3 border-b border-border-default px-4 py-3"
                onPress={() => openBank(item)}
              >
                <Image source={{ uri: item.appLogo }} className="h-9 w-9 rounded-lg" />
                <View className="flex-1">
                  <Text className="text-body-sm font-semibold text-text-primary">
                    {item.appName}
                  </Text>
                  <Text className="text-caption text-text-secondary" numberOfLines={1}>
                    {item.bankName}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </BottomSheetModal>
  );
}

/**
 * Cancelling frees the units for other customers and cannot be undone, so it asks first via AlertSheet.
 */
function CancelBookingButton({ onCancel }: { onCancel: () => Promise<void> }) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirmCancel = async () => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      await onCancel();
    } catch (cause) {
      const answered = cause instanceof ApiError && cause.statusCode !== undefined;
      setCancelError(
        answered && cause instanceof Error
          ? cause.message
          : 'Mạng bị gián đoạn. Vui lòng kiểm tra lại trạng thái đơn giữ chỗ.',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <View className="gap-2">
      {cancelError ? <InlineMessage message={cancelError} type="error" /> : null}
      <Button
        disabled={isCancelling}
        label={isCancelling ? 'Đang hủy...' : 'Hủy giữ chỗ'}
        loading={isCancelling}
        textClassName="text-status-danger"
        variant="text"
        onPress={() => sheetRef.current?.present()}
      />
      <AlertSheet
        ref={sheetRef}
        destructive
        message="Các kho đang giữ sẽ được trả lại cho khách khác và không thể hoàn tác. Nếu bạn đã chuyển khoản, hãy liên hệ hỗ trợ trước khi hủy."
        onPrimary={() => void handleConfirmCancel()}
        onSecondary={() => sheetRef.current?.dismiss()}
        primaryLabel="Hủy giữ chỗ"
        secondaryLabel="Không hủy"
        title="Hủy giữ chỗ này?"
      />
    </View>
  );
}

/** Booking transfer note is long and must match exactly. */
function CopyableCode({ value }: { value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-subtle py-2 pr-2 pl-3.5">
      <Text
        className="flex-1 text-body-lg font-semibold text-text-primary tabular-nums"
        numberOfLines={1}
      >
        {value}
      </Text>
      <Button
        fullWidth={false}
        label={isCopied ? 'Đã chép' : 'Chép'}
        leftIcon={isCopied ? 'check' : 'content-copy'}
        size="sm"
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(value);
          setIsCopied(true);
        }}
      />
    </View>
  );
}
