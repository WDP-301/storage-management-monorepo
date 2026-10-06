import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { BookingStatus } from '@storage/types';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, useThemeColor } from 'heroui-native';
import { type RefObject, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { type DepositStage } from '../../../lib/booking-payment-state';
import { formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import {
  type SaveImageOutcome,
  saveRemoteImage,
  saveViewAsImage,
} from '../../../lib/save-image-to-library';
import { CheckIcon, DownloadIcon } from '../../components/ActionIcons';
import type { ApiBooking } from '../../types/booking-api';

/** VietQR's "compact2" template is taller than it is wide; locking the ratio stops it stretching. */
const QR_WIDTH = 220;
const QR_ASPECT_RATIO = 0.84;

/** Sits on the filled `bg-success` disc; mirrors `--color-accent-foreground` in global.css. */
const CHECK_MARK_COLOR = 'hsl(0 0% 100%)';

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
 * Opening these hits the app directly with no browser in between — that page is VietQR's only
 * maintained registry, so this table is a snapshot of it. ponytail: stale-bank ceiling — if a
 * bank changes its scheme the link falls back to the app's `deeplink` field (dl.vietqr.io,
 * which does route through a browser) rather than failing hard; refresh this table then.
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
 * VietQR's public registry of banking-app deeplinks (~40 apps, logo + name included). Cached for
 * the session — the list changes about as often as banks rebrand, and a failed fetch resets the
 * cache so the next attempt retries instead of pinning the error.
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
  onDone,
  onCancel,
}: Props) {
  if (!booking || !stage) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">
          Thanh toán tiền cọc
        </Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Booking {booking.bookingNo} · {booking.items.length} kho
        </Text>
      </View>

      <View className="gap-4 px-4">
        {/* The only place a manual re-check belongs. Polling already runs on its own, so a button
          offered while everything works would imply the customer has to push the payment along —
          they cannot. When polling itself fails, though, they need a way out of the dead end. */}
        {error ? (
          <View className="gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
            <Button size="sm" variant="secondary" isDisabled={isChecking} onPress={onCheck}>
              <Button.Label>{isChecking ? 'Đang kiểm tra...' : 'Thử lại'}</Button.Label>
            </Button>
          </View>
        ) : null}

        {stage === 'awaiting' ? <AwaitingTransfer booking={booking} onCancel={onCancel} /> : null}

        {stage === 'paid' ? <PaymentSucceeded booking={booking} onDone={onDone} /> : null}

        {stage === 'closed' ? <BookingClosed booking={booking} onDone={onDone} /> : null}

        {stage === 'unavailable' ? (
          <Card className="border border-border bg-surface">
            <Card.Body className="gap-3 py-6">
              <Text className="text-center font-bold text-foreground">
                Chưa thanh toán online được
              </Text>
              <Text className="text-center text-sm leading-5 text-muted">
                Hệ thống chưa cấu hình tài khoản nhận tiền. Vui lòng liên hệ hỗ trợ kèm mã{' '}
                {booking.bookingNo} để được hướng dẫn thanh toán.
              </Text>
              <Button className="mt-2" variant="secondary" onPress={onDone}>
                <Button.Label>Về booking của tôi</Button.Label>
              </Button>
            </Card.Body>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * Confirmation is the moment the customer stops worrying about their money, so it leads with a
 * check mark and then names the exact amount and booking the transfer landed on — a generic
 * "thành công" leaves them wondering whether it was *their* transfer that went through.
 */
function PaymentSucceeded({ booking, onDone }: { booking: ApiBooking; onDone: () => void }) {
  // Only the receipt itself is captured — the buttons below it have no place in a saved image.
  const receipt = useRef<View>(null);

  return (
    <View className="gap-6 pt-2">
      {/* Laid out like a bank transfer receipt, because that is what the customer just did and the
        shape is already familiar: outcome, amount, timestamp, then the details. Flat on the
        background rather than inside a card — a receipt is the screen, not a widget on it. */}
      <View ref={receipt} collapsable={false} className="items-center gap-5 bg-background pb-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-success">
          <CheckIcon color={CHECK_MARK_COLOR} />
        </View>

        <View className="items-center gap-2">
          <Text className="text-base font-semibold text-foreground">Thanh toán thành công</Text>
          {/* The amount is what the customer scans for first, so it gets the largest type. */}
          <Text className="text-3xl font-bold text-accent">
            {formatMoney(Number(booking.depositTotal))}
          </Text>
          <Text className="text-sm text-muted">{formatIsoDateTime(booking.updatedAt)}</Text>
        </View>

        <View className="w-full gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <SummaryRow label="Mã booking" value={booking.bookingNo} />
          <View className="h-px bg-separator" />
          <SummaryRow label="Số kho đã giữ" value={`${booking.items.length} kho`} />
        </View>
      </View>

      <View className="gap-3">
        <SaveImageButton label="Lưu ảnh" onSave={() => saveViewAsImage(receipt)} />
        <Button onPress={onDone}>
          <Button.Label>Xem booking của tôi</Button.Label>
        </Button>
      </View>
    </View>
  );
}

/**
 * Where a booking ends up when it is no longer payable. Cancelling leads here on purpose: the
 * screen turning into this *is* the confirmation, which is why cancelling does not navigate away.
 * Expiry and cancellation share the shape but not the words — telling someone who just cancelled
 * that their hold "hết hạn" would read as a second, unexplained failure.
 */
function BookingClosed({ booking, onDone }: { booking: ApiBooking; onDone: () => void }) {
  const isCancelled = booking.status === BookingStatus.CANCELLED;
  const [mutedColor] = useThemeColor(['muted']);

  return (
    <View className="gap-6 pt-2">
      {/* Same receipt shape as the paid state — outcome, headline figure, timestamp, details —
        so the two endings of this screen feel like one flow rather than two designs. */}
      <View className="items-center gap-5">
        {/* Muted, not the success green: the task finished, but nothing was gained. */}
        <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
          <CheckIcon color={mutedColor} />
        </View>

        <View className="items-center gap-2">
          <Text className="text-base font-semibold text-foreground">
            {isCancelled ? 'Đã hủy booking' : 'Hết hạn giữ chỗ'}
          </Text>
          {/* Where the paid state puts the amount: what the customer got back, not what they paid. */}
          <Text className="text-3xl font-bold text-foreground">{booking.items.length} kho</Text>
          <Text className="text-sm text-muted">
            đã được trả lại · {formatIsoDateTime(booking.updatedAt)}
          </Text>
        </View>

        <View className="w-full gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <SummaryRow label="Mã booking" value={booking.bookingNo} />
          <View className="h-px bg-separator" />
          <SummaryRow
            label="Tiền cọc"
            value={`${formatMoney(Number(booking.depositTotal))} chưa thu`}
          />
        </View>
      </View>

      <View className="gap-3">
        {/* Money already transferred cannot confirm a booking that is no longer awaiting a
          deposit — the API records the payment and leaves it for manual reconciliation. */}
        <Text className="text-center text-xs leading-5 text-muted">
          {isCancelled
            ? `Nếu bạn đã chuyển khoản cho booking này, vui lòng liên hệ hỗ trợ kèm mã ${booking.bookingNo}.`
            : `Nếu bạn vừa chuyển khoản, tiền đã được ghi nhận nhưng cần đối soát thủ công — vui lòng liên hệ hỗ trợ kèm mã ${booking.bookingNo}.`}
        </Text>
        <Button onPress={onDone}>
          <Button.Label>Về booking của tôi</Button.Label>
        </Button>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-foreground" numberOfLines={1}>
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
  // Bound once so the save callback keeps the narrowed non-null type the JSX guard established.
  const qrUrl = booking.paymentQrUrl;
  const bankSheetRef = useRef<BottomSheetModal>(null);

  return (
    <>
      {/* One panel, not three cards: the QR, the amount and the transfer note are a single task,
        and splitting them pushed the note below the fold on a 6" screen. Dividers separate them
        more cheaply than nested cards, which stacked padding and rounding at every level.
        No countdown either — the tab bar already counts the same hold down. */}
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        <View className="items-center gap-3 px-4 pb-4 pt-4">
          {qrUrl ? (
            <>
              <Image
                accessibilityLabel="Mã VietQR thanh toán tiền cọc"
                source={{ uri: qrUrl }}
                style={{ width: QR_WIDTH, aspectRatio: QR_ASPECT_RATIO }}
                resizeMode="contain"
              />
              <SaveImageButton
                label="Lưu ảnh QR"
                isCompact
                onSave={() => saveRemoteImage(qrUrl, booking.bookingNo)}
              />
              {/* The QR sits on the same device that pays, so the app shortens the only part it
                can: a picker of banking apps (VietQR's registry) that opens the chosen app's own
                deeplink scheme directly. The saved-QR path stays as the fallback for apps not in
                the registry. */}
              <Button size="sm" variant="secondary" onPress={() => bankSheetRef.current?.present()}>
                <Button.Label>Mở app ngân hàng</Button.Label>
              </Button>
            </>
          ) : null}
        </View>

        <View className="h-px bg-separator" />

        <View className="flex-row items-center justify-between gap-3 px-4 py-3">
          <Text className="text-sm text-muted">Số tiền cọc</Text>
          <Text className="text-lg font-bold text-accent">{deposit}</Text>
        </View>

        <View className="h-px bg-separator" />

        <View className="gap-2 px-4 pb-4 pt-3">
          <Text className="text-sm text-muted">Nội dung chuyển khoản</Text>
          <CopyableCode value={booking.bookingNo} />
        </View>
      </View>

      {/* Numbered steps rather than one grey paragraph: this is a procedure the customer carries
        out on a second app, and a wall of text is the one thing nobody reads before paying. */}
      <View className="gap-3">
        <Text className="text-sm font-bold text-foreground">Cách thanh toán</Text>
        <PaymentStep index={1} text="Mở app ngân hàng và quét mã QR ở trên." />
        <PaymentStep index={2} text="Kiểm tra số tiền và giữ nguyên nội dung chuyển khoản." />
        <PaymentStep index={3} text="Chuyển khoản trước khi hết giờ giữ chỗ." />
      </View>

      {/* The webhook finds the booking by parsing the code out of the transfer content, so an
        edited note means the money arrives with nothing to match it to. */}
      <View className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
        <Text className="text-xs leading-5 text-muted">
          Nếu sửa nội dung chuyển khoản, hệ thống sẽ không tự nhận ra khoản thanh toán của bạn.
        </Text>
      </View>

      {/* Nothing to press and no spinner. Polling runs for as long as the hold lasts, so an
        indicator that never resolves would read as a stuck screen, and a button would suggest the
        customer can hurry along a confirmation that only the bank's webhook can deliver. */}
      <Text className="text-center text-xs leading-5 text-muted">
        Hệ thống tự cập nhật khi nhận được tiền, bạn không cần chờ ở màn hình này.
      </Text>

      <CancelBookingButton onCancel={onCancel} />

      <BankAppsSheet sheetRef={bankSheetRef} />
    </>
  );
}

/**
 * Bank-app picker fed by VietQR's public registry (names + logos), but opening the app's own
 * scheme URI — `dl.vietqr.io` only exists to resolve that same scheme, so skipping it removes
 * the browser hop entirely.
 */
function BankAppsSheet({ sheetRef }: { sheetRef: RefObject<BottomSheetModal | null> }) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
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
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      snapPoints={['70%']}
      onChange={(index) => {
        // The registry is only fetched once the customer actually asks for it.
        if (index >= 0 && !apps && !loadFailed) {
          fetchBankApps()
            .then(setApps)
            .catch(() => setLoadFailed(true));
        }
      }}
    >
      <View className="mb-2 px-4">
        <Text className="text-lg font-bold text-foreground">Chọn app ngân hàng</Text>
      </View>
      {loadFailed ? (
        <View className="items-center gap-3 px-4 py-8">
          <Text className="text-sm text-muted">Không tải được danh sách ngân hàng.</Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              setLoadFailed(false);
              fetchBankApps()
                .then(setApps)
                .catch(() => setLoadFailed(true));
            }}
          >
            <Button.Label>Thử lại</Button.Label>
          </Button>
        </View>
      ) : apps === null ? (
        <ActivityIndicator className="my-8" />
      ) : (
        <>
          <BottomSheetTextInput
            className="mx-4 mb-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-foreground"
            placeholder="Tìm ngân hàng..."
            placeholderTextColor={mutedColor}
            value={query}
            onChangeText={setQuery}
          />
          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item: BankApp) => item.appId}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
            renderItem={({ item }: { item: BankApp }) => (
              <Pressable
                className="flex-row items-center gap-3 px-4 py-3"
                onPress={() => openBank(item)}
              >
                <Image source={{ uri: item.appLogo }} className="h-9 w-9 rounded-lg" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.appName}</Text>
                  <Text className="text-xs text-muted" numberOfLines={1}>
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
 * Cancelling frees the units for other customers and cannot be undone, so it asks first. It also
 * warns about money already sent: the API cancels a booking whose deposit arrived only partially
 * and merely logs that the payment needs manual reconciliation — the customer has to hear that
 * before they tap, not after.
 */
function CancelBookingButton({ onCancel }: { onCancel: () => Promise<void> }) {
  const [isCancelling, setIsCancelling] = useState(false);

  const confirm = () =>
    Alert.alert(
      'Hủy booking này?',
      'Các kho đang giữ sẽ được trả lại cho khách khác và không thể hoàn tác. Nếu bạn đã chuyển khoản, hãy liên hệ hỗ trợ trước khi hủy.',
      [
        { text: 'Không hủy', style: 'cancel' },
        {
          text: 'Hủy booking',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await onCancel();
            } catch (cause) {
              // A status code means the server decided — most often 409, when the webhook
              // confirmed the booking while this screen was open. Without one the request never
              // got an answer, and the cancel may well have gone through: the screen refreshes
              // either way, so promising "không hủy được" would contradict what it then shows.
              const answered = cause instanceof ApiError && cause.statusCode !== undefined;
              Alert.alert(
                answered ? 'Không hủy được booking' : 'Không rõ kết quả',
                answered && cause instanceof Error
                  ? cause.message
                  : 'Mạng bị gián đoạn. Vui lòng kiểm tra lại trạng thái booking của bạn.',
              );
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );

  return (
    <Button variant="ghost" isDisabled={isCancelling} onPress={confirm}>
      <Button.Label className="text-danger">
        {isCancelling ? 'Đang hủy...' : 'Hủy booking'}
      </Button.Label>
    </Button>
  );
}

/** Step number in a filled disc — scannable at a glance, unlike a bullet in a paragraph. */
function PaymentStep({ index, text }: { index: number; text: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-accent/10">
        <Text className="text-xs font-bold text-accent">{index}</Text>
      </View>
      <Text className="flex-1 text-sm leading-6 text-foreground">{text}</Text>
    </View>
  );
}

const SAVE_IMAGE_LABELS: Record<SaveImageOutcome, string> = {
  saved: 'Đã lưu vào thư viện ảnh',
  denied: 'Chưa được cấp quyền lưu ảnh',
  failed: 'Lưu không được, thử lại',
};

/**
 * Shared by the QR and the receipt: the button text is the only feedback either save gets, so the
 * outcome replaces the label rather than appearing somewhere else on the screen.
 */
function SaveImageButton({
  label,
  isCompact = false,
  onSave,
}: {
  label: string;
  isCompact?: boolean;
  onSave: () => Promise<SaveImageOutcome>;
}) {
  const [outcome, setOutcome] = useState<SaveImageOutcome | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mutedColor] = useThemeColor(['muted']);

  return (
    <View className="items-center gap-2">
      <Button
        className={isCompact ? undefined : 'w-full'}
        size={isCompact ? 'sm' : 'md'}
        variant="secondary"
        isDisabled={isSaving}
        onPress={async () => {
          setIsSaving(true);
          // A retry must start from a clean slate rather than leave the previous result on screen
          // while the new attempt runs.
          setOutcome(null);
          setOutcome(await onSave());
          setIsSaving(false);
        }}
      >
        <DownloadIcon color={mutedColor} />
        <Button.Label>
          {isSaving ? 'Đang lưu...' : outcome ? SAVE_IMAGE_LABELS[outcome] : label}
        </Button.Label>
      </Button>
      {outcome === 'denied' ? (
        <Text className="text-center text-xs leading-5 text-muted">
          Cấp quyền ảnh cho ứng dụng trong Cài đặt để lưu được ảnh.
        </Text>
      ) : null}
    </View>
  );
}

/** Booking numbers are long and easy to mistype, and a typo costs a manual reconciliation. */
function CopyableCode({ value }: { value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary py-2 pl-3 pr-2">
      <Text className="flex-1 font-mono text-base font-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
      <Button
        size="sm"
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(value);
          setIsCopied(true);
        }}
      >
        <Button.Label>{isCopied ? 'Đã chép' : 'Chép'}</Button.Label>
      </Button>
    </View>
  );
}
