# Web UI/UX foundation

Phạm vi của `apps/web` ở bước này chỉ là **design system foundation**. Các màn đăng nhập,
Browse Units, giữ chỗ và “Booking của tôi” được triển khai ở `apps/mobile`, không nằm trong
web prototype.

## Stack

- React 19 + Vite 8
- Tailwind CSS v4
- HeroUI React v3 với compound components và `onPress`
- Lucide là icon family thống nhất của web

## Design direction

Giao diện ưu tiên sự rõ ràng của một sản phẩm vận hành: nền trung tính sáng, card trắng có
border, màu xanh cho hành động chính và màu trạng thái luôn đi kèm nhãn chữ. Không dùng
gradient trang trí hoặc shadow dày cho content thông thường.

## Semantic tokens

Token nguồn nằm trong `src/index.css`. Component chỉ dùng semantic token, không hard-code
màu theo từng feature.

| Nhóm | Token chính | Mục đích |
| --- | --- | --- |
| Base | `--background`, `--surface`, `--foreground`, `--muted` | Nền, panel và chữ |
| Brand | `--accent`, `--accent-foreground` | Primary action, focus, selected state |
| State | `--success`, `--warning`, `--danger` | Available, attention, error/destructive |
| Structure | `--border`, `--separator`, `--focus` | Phân cấp và accessibility |

Quy ước hình khối: control 8px, card 12px, badge dạng pill. Shadow chỉ dành cho lớp nổi như
popover, modal hoặc sticky action; card nội dung dùng border.

## Typography and spacing

- Heading dùng trọng lượng 700, body 400–500, label/action 600.
- Body tối thiểu 14px; metadata có thể dùng 12px nhưng phải giữ contrast đạt chuẩn.
- Spacing theo thang 4px; khoảng cách phổ biến: 8, 12, 16, 24, 32px.
- Touch/click target tối thiểu 44px ở các control quan trọng.

## Component rules

- **Tabs:** dùng để chuyển giữa các view ngang hàng; luôn có selected indicator và panel tương
  ứng. Không dùng tab thay button hoặc filter đơn lẻ.
- **Button:** mỗi vùng hành động có một primary action; destructive action phải có label rõ và
  bước xác nhận khi hậu quả khó hoàn tác.
- **Form:** cấu trúc `TextField → Label → Input → Description/FieldError`; không dùng
  placeholder thay label.
- **Card:** dùng border để gom nhóm; header, content và actions có phân cấp rõ ràng.
- **Status:** không truyền đạt bằng màu đơn độc; luôn có text hoặc icon kèm accessible label.
- **Feedback:** mọi async action cần loading, success/error feedback và chống submit lặp.

## Responsive and accessibility

- Thiết kế từ 320px, sau đó mở rộng theo content thay vì theo tên thiết bị.
- Keyboard navigation, visible focus và thứ tự tab phải hoạt động đầy đủ.
- Dùng semantic HTML trước ARIA; icon-only button bắt buộc có accessible name.
- Empty, loading, error và disabled state là một phần bắt buộc của component spec.

## Suggested structure

```text
src/
  design-system/   # primitives, composed components, tokens usage
  features/        # feature modules; không import internals chéo nhau
  layouts/         # app shells and responsive page frames
  types/           # view-model contracts
  index.css        # semantic tokens and global foundation
```

Dữ liệu từ API cần được map sang view model trước khi render. Design-system component không
được phụ thuộc DTO hoặc business rule của một feature cụ thể.
