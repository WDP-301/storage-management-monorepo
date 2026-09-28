import { StaffPlaceholderScreen } from '../../src/features/staff/StaffPlaceholderScreen';

export default function StaffTodayRoute() {
  return (
    <StaffPlaceholderScreen
      title="Hôm nay"
      description="Lịch nhận và trả kho tại cơ sở trong ngày."
      upcoming={[
        'Danh sách lượt nhận kho và trả kho theo giờ hẹn',
        'Kiểm tra đặt chỗ: thanh toán, hợp đồng và tình trạng kho trước bàn giao',
        'Kho đang chờ kiểm tra sau khi khách trả',
      ]}
    />
  );
}
