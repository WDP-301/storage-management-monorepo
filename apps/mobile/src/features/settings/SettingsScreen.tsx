import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { primaryRoleLabel } from '../../../lib/app-area';
import {
  AlertSheet,
  colors,
  Divider,
  Icon,
  type IconName,
  StatusPill,
  Text,
  useModal,
} from '../../components/ui';
import { FlowScreen } from '../../components/ui/flow-screen';
import type { AuthUser } from '../../types/auth';

type Props = {
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
  onSupport?: () => void;
  onTours?: () => void;
  onShifts?: () => void;
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  onWarehouseRules?: () => void;
  addressLabel?: string | null;
  companyLabel?: string | null;
  rentalUnitCount?: number | null;
  pendingDepositCount?: number | null;
  /** Customer-only: the check-in code, shown right under the identity card. */
  accessCard?: ReactNode;
};

export function SettingsScreen({
  user,
  isLoggingOut,
  onLogout,
  onSupport,
  onTours,
  onShifts,
  onEditProfile,
  onChangePassword,
  onWarehouseRules,
  addressLabel,
  companyLabel,
  rentalUnitCount,
  pendingDepositCount,
  accessCard,
}: Props) {
  const logoutModal = useModal();
  const initial = user.fullName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <FlowScreen muted showBack={false} title="Tài khoản">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pt-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-2 pt-2 pb-1">
          <View className="size-20 items-center justify-center rounded-full border-2 border-bg-card bg-secondary-0 shadow-sm">
            <Text className="text-heading font-bold text-text-link">{initial}</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-center text-title font-bold text-text-primary">
              {user.fullName}
            </Text>
            <Text className="text-center text-body text-text-secondary" numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <StatusPill align="center" label={primaryRoleLabel(user.roles)} tone="info" />
        </View>

        {accessCard ? <View>{accessCard}</View> : null}

        {rentalUnitCount !== undefined ? (
          <View className="flex-row rounded-2xl bg-bg-card p-4">
            <AccountStat
              icon="lock-outline"
              iconBg="bg-secondary-0"
              iconColor={colors.semantic.textLink}
              label="Đã xác nhận thuê"
              value={rentalUnitCount === null ? '—' : `${rentalUnitCount} kho`}
            />
            <View className="mx-3 w-px bg-border-divider" />
            <AccountStat
              icon="hourglass-empty"
              iconBg="bg-warning-0"
              iconColor={colors.warning[700]}
              label="Chờ chuyển cọc"
              value={pendingDepositCount == null ? '—' : `${pendingDepositCount} đơn`}
            />
          </View>
        ) : null}

        <AccountSection title="Thông tin liên hệ">
          <InfoRow label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} />
          {addressLabel ? (
            <>
              <Divider />
              <InfoRow label="Địa chỉ" value={addressLabel} />
            </>
          ) : null}
          {companyLabel ? (
            <>
              <Divider />
              <InfoRow label="Công ty" value={companyLabel} />
            </>
          ) : null}
          <Divider />
          <View className="min-h-12 flex-row items-center justify-between gap-3 py-2.5">
            <Text className="text-body text-text-secondary">Trạng thái tài khoản</Text>
            <StatusPill label="Đang hoạt động" tone="success" />
          </View>
        </AccountSection>

        {onEditProfile || onChangePassword ? (
          <AccountSection title="Tài khoản & Bảo mật">
            {onEditProfile ? (
              <>
                <ActionRow
                  icon="edit"
                  label="Chỉnh sửa hồ sơ"
                  onPress={onEditProfile}
                  subtitle="Cập nhật họ tên, số điện thoại và thông tin liên hệ"
                />
                {onChangePassword ? <Divider /> : null}
              </>
            ) : null}
            {onChangePassword ? (
              <ActionRow
                icon="vpn-key"
                label="Đổi mật khẩu"
                onPress={onChangePassword}
                subtitle="Thay mật khẩu mới và bảo vệ tài khoản"
              />
            ) : null}
          </AccountSection>
        ) : null}

        <AccountSection title="Dịch vụ & Hỗ trợ">
          {onShifts ? (
            <>
              <ActionRow
                icon="event-available"
                label="Ca làm việc & Chấm công"
                onPress={onShifts}
                subtitle="Xem lịch trực theo tuần và check-in / check-out"
              />
              <Divider />
            </>
          ) : null}
          {onTours ? (
            <>
              <ActionRow
                icon="calendar-month"
                label="Lịch hẹn xem kho"
                onPress={onTours}
                subtitle="Theo dõi lịch tham quan kho mẫu và tư vấn"
              />
              <Divider />
            </>
          ) : null}
          {onWarehouseRules ? (
            <>
              <ActionRow
                icon="menu-book"
                label="Quy định sử dụng kho"
                onPress={onWarehouseRules}
                subtitle="Các nội dung cần tuân thủ khi thuê và sử dụng kho"
              />
              <Divider />
            </>
          ) : null}
          {onSupport ? (
            <>
              <ActionRow
                icon="support-agent"
                label="Yêu cầu hỗ trợ của tôi"
                onPress={onSupport}
                subtitle="Gửi phản hồi hoặc theo dõi tiến độ xử lý"
              />
              <Divider />
            </>
          ) : null}
          <ActionRow
            danger
            icon="logout"
            label={isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            onPress={() => {
              if (!isLoggingOut) logoutModal.present();
            }}
            showChevron={false}
          />
        </AccountSection>
      </ScrollView>

      <AlertSheet
        actionsLayout="row"
        icon="logout"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?"
        primaryAction={{
          label: isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất',
          loading: isLoggingOut,
          onPress: onLogout,
        }}
        ref={logoutModal.ref}
        secondaryAction={{ label: 'Hủy' }}
        testID="logout-sheet"
        title="Đăng xuất"
        variant="danger"
      />
    </FlowScreen>
  );
}

function AccountSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="rounded-2xl bg-bg-card px-4 pt-4 pb-1">
      <Text className="mb-1 text-caption font-semibold text-text-secondary uppercase">{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-3 py-2.5">
      <Text className="text-body text-text-secondary">{label}</Text>
      <Text
        className="flex-1 text-right text-body font-semibold text-text-primary"
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  subtitle,
  onPress,
  danger = false,
  showChevron = true,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-14 flex-row items-center gap-3 py-3"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        className={`size-9 items-center justify-center rounded-xl ${
          danger ? 'bg-danger-0' : 'bg-secondary-0'
        }`}
      >
        <Icon
          color={danger ? colors.semantic.statusDanger : colors.semantic.actionPrimary}
          name={icon}
          size={20}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-body font-semibold ${
            danger ? 'text-status-danger' : 'text-text-primary'
          }`}
        >
          {label}
        </Text>
        {subtitle ? <Text className="text-caption text-text-secondary">{subtitle}</Text> : null}
      </View>
      {showChevron ? (
        <Icon color={colors.semantic.textSecondary} name="chevron-right" size={20} />
      ) : null}
    </Pressable>
  );
}

function AccountStat({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 items-center gap-1.5 px-1">
      <View className={`size-9 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon color={iconColor} name={icon} size={18} />
      </View>
      <Text className="text-lead font-bold text-text-primary">{value}</Text>
      <Text className="text-center text-caption text-text-secondary">{label}</Text>
    </View>
  );
}
