import { BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { type RefObject, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, colors, renderCoatBackdrop, Text } from '../../components/ui';

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

/**
 * Bank-app picker fed by VietQR's public registry (names + logos).
 */
export function BankAppsSheet({ sheetRef }: { sheetRef: RefObject<BottomSheetModal | null> }) {
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
            className="self-center"
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
