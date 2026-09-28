import { StaffPlaceholderScreen } from '../../src/features/staff/StaffPlaceholderScreen';

export default function StaffRequestsRoute() {
  return (
    <StaffPlaceholderScreen
      title="Yêu cầu"
      description="Yêu cầu hỗ trợ, bảo trì và đổi kho tại cơ sở."
      upcoming={[
        'Yêu cầu hỗ trợ của khách gắn với cơ sở hoặc kho',
        'Yêu cầu bảo trì theo mức ưu tiên và người phụ trách',
        'Kiểm tra kho cũ trong quy trình đổi kho',
      ]}
    />
  );
}
