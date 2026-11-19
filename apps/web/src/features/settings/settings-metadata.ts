export interface SettingMetadata {
  label?: string;
  description?: string;
  unit?: string;
  group?: string;
}

/**
 * Metadata dictionary mapping keys to friendly Vietnamese labels, descriptions,
 * units, and logical category groups.
 */
export const SETTINGS_METADATA: Record<string, SettingMetadata> = {
  'booking.hold_minutes': {
    label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
    description:
      'Thời gian tối đa hệ thống tạm giữ kho cho khách hàng hoàn tất đặt cọc trước khi tự động giải phóng kho (Mục 3 tài liệu nghiệp vụ).',
    unit: 'phút',
    group: 'booking',
  },
  'booking.lead_days': {
    label: 'Số ngày đặt trước tối đa (Max lead days)',
    description:
      'Khoảng thời gian tối đa tính từ ngày đặt chỗ đến ngày bắt đầu nhận kho thực tế của khách hàng.',
    unit: 'ngày',
    group: 'booking',
  },
  'booking.min_rental_months': {
    label: 'Thời hạn thuê tối thiểu cho hợp đồng mới',
    description:
      'Đơn vị thời gian thuê tối thiểu được chấp nhận khi khách hàng tạo lượt thuê kho mới.',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.max_rental_months': {
    label: 'Thời hạn thuê tối đa cho hợp đồng mới',
    description:
      'Giới hạn thời gian thuê tối đa của một hợp đồng thuê kho (ràng buộc DB tối đa 60 tháng).',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.default_rental_months': {
    label: 'Thời hạn thuê mặc định',
    description:
      'Giá trị thời hạn thuê được chọn sẵn khi khách hàng lần đầu chọn kho trong giao diện.',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.rental_months_options': {
    label: 'Gợi ý các gói kỳ hạn thuê kho',
    description:
      'Danh sách các gói kỳ hạn thuê đề xuất hiển thị trên giao diện người dùng (phân tách bởi dấu phẩy).',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.max_units_per_booking': {
    label: 'Số kho tối đa trong một lượt đặt',
    description:
      'Giới hạn số lượng kho một khách hàng có thể chọn trong cùng một lượt đặt giữ chỗ.',
    unit: 'kho',
    group: 'booking',
  },
  'booking.search_radius_km': {
    label: 'Bán kính tìm kiếm kho lân cận',
    description:
      'Khoảng cách địa lý tối đa theo tọa độ (kinh độ, vĩ độ) để tự động đề xuất các kho gần nhau khi thuê nhiều kho.',
    unit: 'km',
    group: 'booking',
  },
  'contract.abandoned_after_days': {
    label: 'Ngưỡng ngày gợi ý kho bị bỏ hoang',
    description:
      'Số ngày sau khi hết hạn hợp đồng mà khách vẫn chưa yêu cầu trả kho thì hệ thống gợi ý quản lý chi nhánh mở thu hồi kho hộ (ABANDONED).',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.no_show_after_days': {
    label: 'Ngưỡng ngày nhắc khách không đến nhận kho',
    description:
      'Số ngày sau ngày bắt đầu hợp đồng mà khách vẫn chưa đến bàn giao (hợp đồng còn ở trạng thái nháp) thì hệ thống nhắc quản lý chi nhánh liên hệ và hủy hợp đồng để giải phóng kho.',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.return_notice_days': {
    label: 'Nhắc trước khi hết hạn hợp đồng',
    description:
      'Từ số ngày này trước ngày cuối hợp đồng, khách được nhắc hợp đồng sắp hết hạn. Trả kho trước ngày cuối hợp đồng là trả trước hạn và mất tiền cọc theo tỷ lệ cấu hình.',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.unit_change_min_lead_days': {
    label: 'Đổi kho — số ngày báo trước tối thiểu',
    description:
      'Ngày chuyển đồ sang kho mới khách chọn phải cách hôm nay ít nhất số ngày này, để quản lý kịp duyệt và khách kịp thanh toán bù cọc (0 = cho chọn ngay hôm nay, giờ còn lại trong ca hành chính). Giờ chuyển đồ lấy theo các ca hành chính (OFFICE).',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.unit_change_max_days_ahead': {
    label: 'Đổi kho — chọn ngày chuyển xa nhất',
    description:
      'Ngày chuyển đồ sang kho mới chỉ được hẹn (hoặc quản lý xác nhận) trong vòng số ngày này kể từ hôm nay; kho đích được giữ chỗ đến ngày chuyển. Nếu nhỏ hơn số ngày báo trước, hệ thống tự nới bằng số ngày báo trước.',
    unit: 'ngày',
    group: 'contract',
  },
  'deposit.default_months': {
    label: 'Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)',
    description:
      'Áp dụng cho kho chưa cấu hình số tháng cọc riêng; kho đã cấu hình sẽ dùng số tháng của nó.',
    unit: 'tháng thuê',
    group: 'deposit',
  },
  'billing.overdue_penalty_percent': {
    label: 'Phí quá hạn (% tiền thuê một ngày)',
    description:
      'Mỗi ngày giữ kho quá hạn hợp đồng bị tính phí bằng tỷ lệ này của tiền thuê một ngày (giá thuê tháng / 30), trừ vào tiền cọc khi quyết toán.',
    unit: '%',
    group: 'billing',
  },
  'idempotency.ttl_hours': {
    label: 'Thời gian lưu trữ Idempotency Key',
    description:
      'Thời gian tồn tại của khóa chống gửi lặp giao dịch trước khi tác vụ tự động dọn dẹp.',
    unit: 'giờ',
    group: 'idempotency',
  },
  'idempotency.stale_seconds': {
    label: 'Thời gian giải phóng khóa xử lý treo',
    description:
      'Ngưỡng thời gian để thu hồi khóa giao dịch bị kẹt trong trạng thái đang xử lý (sau sự cố máy chủ).',
    unit: 'giây',
    group: 'idempotency',
  },
  'security.session_max_age_days': {
    label: 'Thời hạn hiệu lực phiên đăng nhập (Session TTL)',
    description:
      'Thời gian tồn tại tối đa của cookie phiên bảo mật (sid) trên trình duyệt trước khi người dùng cần đăng nhập lại.',
    unit: 'ngày',
    group: 'security',
  },
  'security.max_login_failed_attempts': {
    label: 'Giới hạn số lần đăng nhập sai tối đa',
    description:
      'Số lần nhập sai mật khẩu liên tiếp cho phép trước khi tạm khóa địa chỉ IP hoặc tài khoản trong 15 phút.',
    unit: 'lần',
    group: 'security',
  },
  'security.system_maintenance_mode': {
    label: 'Chế độ bảo trì hệ thống toàn diện',
    description:
      'Tạm dừng các thao tác đặt kho và thanh toán từ phía khách hàng (chỉ quản trị viên mới có thể truy cập hệ thống).',
    group: 'security',
  },
  'billing.overdue_reminder_days': {
    label: 'Ngày nhắc nợ khách',
    description:
      'Các ngày quá hạn (tính từ hạn thanh toán) hệ thống gửi thông báo nhắc khách trả hóa đơn. Sau ngày cuối cùng trong danh sách, nhắc lặp lại theo chu kỳ bên dưới.',
    unit: 'ngày',
    group: 'billing',
  },
  'billing.overdue_reminder_repeat_days': {
    label: 'Chu kỳ nhắc nợ lặp lại',
    description:
      'Sau ngày nhắc cuối cùng của khách (và từ ngày bắt đầu báo quản lý), cứ mỗi số ngày này hệ thống nhắc lại một lần.',
    unit: 'ngày',
    group: 'billing',
  },
  'billing.overdue_manager_alert_from_days': {
    label: 'Báo quản lý khi nợ quá hạn từ',
    description:
      'Hóa đơn quá hạn từ số ngày này thì quản lý chi nhánh của kho cũng nhận thông báo để gọi cho khách.',
    unit: 'ngày',
    group: 'billing',
  },
  'billing.fee_invoice_due_days': {
    label: 'Hạn thanh toán hóa đơn phí',
    description:
      'Số ngày khách có để trả hóa đơn phí (phí hư hỏng, thiếu cọc, tiền thuê kho cũ còn thiếu khi đổi kho). Quá hạn sẽ chặn khách như hóa đơn thuê quá hạn.',
    unit: 'ngày',
    group: 'billing',
  },
  'billing.rent_grace_days': {
    label: 'Số ngày ân hạn tiền thuê',
    description:
      'Hóa đơn tiền thuê hằng kỳ đến hạn vào ngày bắt đầu kỳ cộng thêm số ngày này. Áp dụng cho hóa đơn phát hành từ khi đổi; 0 = đến hạn ngay ngày bắt đầu kỳ.',
    unit: 'ngày',
    group: 'billing',
  },
  'billing.vat_tax_rate_percent': {
    label: 'Thuế giá trị gia tăng (VAT)',
    description:
      'Thuế suất VAT cộng thêm vào hóa đơn tiền thuê phát hành từ khi đổi. Tiền cọc và hóa đơn phí (hư hỏng, thiếu cọc) không tính VAT.',
    unit: '%',
    group: 'billing',
  },
  'contract.early_return_forfeit_percent': {
    label: 'Tỷ lệ mất cọc khi trả kho trước hạn',
    description:
      'Phần trăm tiền cọc khách mất khi trả kho trước ngày cuối hợp đồng (100 = mất toàn bộ). Áp dụng cho yêu cầu trả kho tạo từ khi đổi; yêu cầu cũ giữ tỷ lệ lúc tạo.',
    unit: '%',
    group: 'contract',
  },
  'contract.return_max_days_ahead': {
    label: 'Hẹn trả kho xa nhất',
    description:
      'Ngày hẹn trả kho (hoặc đổi lịch hẹn) chỉ được chọn trong vòng số ngày này kể từ hôm nay.',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.creation_window_days': {
    label: 'Hạn tạo hợp đồng sau khi đặt kho',
    description: 'Sau khi đặt kho, chi nhánh phải tạo hợp đồng trong vòng số ngày này.',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.unit_change_top_up_due_days': {
    label: 'Đổi kho — hạn đóng bù cọc tối đa',
    description:
      'Hóa đơn bù cọc khi đổi sang kho đắt hơn đến hạn vào ngày chuyển, nhưng không muộn hơn số ngày này kể từ lúc duyệt.',
    unit: 'ngày',
    group: 'contract',
  },
  'contract.unit_change_move_overdue_days': {
    label: 'Đổi kho — tự huỷ khi chưa bù cọc sau',
    description:
      'Yêu cầu đổi kho vẫn chờ khách bù cọc quá số ngày này sau ngày chuyển thì hệ thống tự huỷ, nhả kho đích và huỷ hóa đơn bù cọc chưa trả.',
    unit: 'ngày',
    group: 'contract',
  },
  'shelf.counter_session_minutes': {
    label: 'Thời gian mở quầy kệ sau khi quét mã',
    description:
      'Sau khi nhân viên quét mã của khách, phiên quầy gửi/lấy đồ kệ mở trong số phút này.',
    unit: 'phút',
    group: 'shelf',
  },
  'shelf.request_max_days_ahead': {
    label: 'Hẹn gửi/lấy đồ kệ xa nhất',
    description: 'Khách chỉ được hẹn gửi hoặc lấy đồ kệ trong vòng số ngày này kể từ hôm nay.',
    unit: 'ngày',
    group: 'shelf',
  },
  'staff.check_in_opens_before_minutes': {
    label: 'Mở check-in ca trước giờ bắt đầu',
    description: 'Nhân viên được check-in ca sớm nhất số phút này trước giờ bắt đầu ca.',
    unit: 'phút',
    group: 'staff',
  },
};

export const GROUP_LABELS: Record<string, string> = {
  booking: 'Đặt kho & Giữ chỗ',
  deposit: 'Tiền cọc & Đặt cọc',
  billing: 'Tài chính & Phí',
  contract: 'Hợp đồng & Đổi kho',
  idempotency: 'Bảo mật & Phiên (Idempotency)',
  security: 'Bảo mật & Phiên',
  shelf: 'Lưu trữ kệ',
  staff: 'Nhân viên & Ca làm',
};
