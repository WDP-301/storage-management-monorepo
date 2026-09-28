import { StaffPlaceholderScreen } from '../../src/features/staff/StaffPlaceholderScreen';

export default function StaffScanRoute() {
  return (
    <StaffPlaceholderScreen
      title="Quét mã"
      description="Quét mã của khách để bàn giao hoặc nhận trả kho."
      upcoming={[
        'Quét mã nhận/trả kho có thời hạn của từng lượt',
        'Lập biên bản bàn giao kèm ảnh hiện trạng',
        'Ghi nhận hư hỏng và phí phát sinh khi nhận trả',
      ]}
    />
  );
}
