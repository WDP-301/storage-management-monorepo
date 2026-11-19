import { View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { vietnamDayIso } from '../../../lib/settlement-format';
import { colors, Icon, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import type { ApiInvoice } from '../../types/invoice-api';
import { SectionCard } from './contract-sections';

type Viewer = 'customer' | 'staff';

export function isFirstRentPaid(invoices: ApiInvoice[]): boolean {
  return invoices.some(
    (invoice) => invoice.kind === 'INITIAL' && invoice.periodNo === 1 && invoice.status === 'PAID',
  );
}

const HINTS: Record<Viewer, { files: string; rent: string }> = {
  customer: {
    files: 'Ký tại quầy khi bạn tới gửi đồ lần đầu.',
    rent: 'Thanh toán hoá đơn tháng đầu ở mục Hoá đơn.',
  },
  staff: {
    files: 'Tải bản hợp đồng khách đã ký ở mục Hợp đồng.',
    rent: 'Khách chuyển khoản theo QR, hoặc thu tiền mặt ở mục bên dưới.',
  },
};

/** What a DRAFT shelf contract still waits for; it activates by itself once both are done. */
export function ShelfActivationSection({
  contract,
  firstRentPaid,
  viewer = 'customer',
}: {
  contract: ApiContract;
  firstRentPaid: boolean;
  viewer?: Viewer;
}) {
  const hasFiles = contract.documents.length > 0;
  const startDay = vietnamDayIso(contract.effectiveAt);
  return (
    <SectionCard badge="Chờ kích hoạt" title="Kích hoạt kệ" tone="neutral">
      <View className="gap-3">
        <Step done={hasFiles} hint={HINTS[viewer].files} label="Hợp đồng đã ký" />
        <Step done={firstRentPaid} hint={HINTS[viewer].rent} label="Tiền thuê tháng đầu" />
        <Text className="text-body-sm text-text-secondary">
          Đủ hai mục thì kệ tự có hiệu lực (sớm nhất {startDay ? formatIsoDate(startDay) : '—'})
          {viewer === 'customer' ? ', mã QR gửi đồ sẽ hiện trong app.' : '.'}
        </Text>
      </View>
    </SectionCard>
  );
}

function Step({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <Icon
        color={done ? colors.semantic.statusSuccess : colors.semantic.textSecondary}
        name={done ? 'check-circle' : 'radio-button-unchecked'}
        size={20}
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-body font-medium text-text-primary">{label}</Text>
        {done ? null : <Text className="text-body-sm text-text-secondary">{hint}</Text>}
      </View>
    </View>
  );
}
