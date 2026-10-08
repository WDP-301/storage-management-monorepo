import { Button, Card } from 'heroui-native';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatArea, formatIsoDate, formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import type { ApiContract, ApiHandover } from '../../types/contract-api';
import {
  ContractStatusChip,
  contractDaysLeft,
  contractEndIso,
  contractKindLabel,
  contractRemainingLabel,
  contractStartIso,
} from './contract-display';

type Props = {
  contract: ApiContract | null;
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBack: () => void;
  onSupport: () => void;
  onRefresh: () => void;
};

export function ContractDetailScreen({
  contract,
  now,
  isLoading,
  error,
  contentBottomPadding,
  onBack,
  onSupport,
  onRefresh,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && contract !== null} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Button variant="ghost" size="sm" className="self-start" onPress={onBack}>
          <Button.Label>← Kho của tôi</Button.Label>
        </Button>

        {!contract ? (
          <Text className="mt-8 text-center text-sm text-muted">
            {isLoading ? 'Đang tải…' : (error ?? 'Không tìm thấy hợp đồng này.')}
          </Text>
        ) : (
          <ContractDetail contract={contract} now={now} onSupport={onSupport} />
        )}
      </View>
    </ScrollView>
  );
}

function ContractDetail({
  contract,
  now,
  onSupport,
}: {
  contract: ApiContract;
  now: number;
  onSupport: () => void;
}) {
  const daysLeft = contractDaysLeft(contract, now);

  return (
    <View className="mt-2 gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold tracking-tight text-foreground">
            {contract.unit?.code ?? 'Kho'}
          </Text>
          <Text className="mt-1 text-sm text-muted">
            {[contract.unit?.typeName, contract.unit ? formatArea(contract.unit.areaM2) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <ContractStatusChip status={contract.status} />
      </View>

      {contract.facility ? (
        <Card className="border border-border bg-surface">
          <Card.Body className="gap-1">
            <Text className="text-sm font-semibold text-foreground">{contract.facility.name}</Text>
            <Text className="text-sm leading-5 text-muted">{contract.facility.address}</Text>
          </Card.Body>
        </Card>
      ) : null}

      <Card className="border border-border bg-surface">
        <Card.Body className="gap-3">
          <InfoRow label="Số hợp đồng" value={contract.contractNo} />
          <InfoRow label="Loại hợp đồng" value={contractKindLabel(contract.kind)} />
          <InfoRow label="Ngày hiệu lực" value={formatIsoDate(contractStartIso(contract))} />
          <InfoRow label="Ngày kết thúc" value={formatIsoDate(contractEndIso(contract))} />
          <InfoRow label="Kỳ hạn" value={`${contract.months} tháng`} />
          {daysLeft !== null ? (
            <InfoRow label="Tình trạng" value={contractRemainingLabel(daysLeft)} accent />
          ) : null}
        </Card.Body>
      </Card>

      <Card className="border border-border bg-surface">
        <Card.Body className="gap-3">
          <InfoRow label="Tiền thuê" value={`${formatMoney(contract.monthlyPrice)}/tháng`} />
          <InfoRow label="Tiền cọc" value={formatMoney(contract.deposit)} />
        </Card.Body>
      </Card>

      {contract.handover ? <HandoverCard handover={contract.handover} /> : null}

      {contract.status === 'ACTIVE' ? (
        <Button onPress={onSupport}>
          <Button.Label>Báo sự cố / hỗ trợ</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function HandoverCard({ handover }: { handover: ApiHandover }) {
  const received = handover.finalizedAt !== null;
  return (
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-3">
        <Text className="text-base font-semibold text-foreground">Biên nhận kho</Text>
        <InfoRow label="Trạng thái" value={received ? 'Đã nhận kho' : 'Chờ nhận kho'} accent />
        {handover.finalizedAt ? (
          <InfoRow label="Ngày nhận" value={formatIsoDateTime(handover.finalizedAt)} />
        ) : null}
        <InfoRow label="Nhân viên bàn giao" value={handover.inspectorName ?? 'Chưa phân công'} />
        {received ? (
          <InfoRow
            label="Hiện trạng"
            value={
              handover.damageCount > 0 ? `${handover.damageCount} điểm ghi nhận` : 'Bình thường'
            }
          />
        ) : null}
        {handover.conditionNotes ? (
          <Text className="text-sm leading-5 text-muted">{handover.conditionNotes}</Text>
        ) : null}
      </Card.Body>
    </Card>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="shrink-0 text-sm text-muted">{label}</Text>
      <Text
        className={`flex-1 text-right text-sm font-semibold ${accent ? 'text-accent' : 'text-foreground'}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
