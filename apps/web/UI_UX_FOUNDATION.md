# Web UI/UX foundation

Phạm vi của `apps/web` ở bước này chỉ là **design system foundation**. Các màn đăng nhập,
Browse Units, giữ chỗ và “Booking của tôi” được triển khai ở `apps/mobile`, không nằm trong
web prototype.

## Stack

- React 19 + Vite 8
- Tailwind CSS v4
- `@cloudflare/kumo` là design system thống nhất của web
- `@phosphor-icons/react` là icon family thống nhất của web

## Design direction

Giao diện ưu tiên sự rõ ràng của một sản phẩm vận hành: nền trung tính sáng, card trắng có
border, màu xanh cho hành động chính và màu trạng thái luôn đi kèm nhãn chữ. Không dùng
gradient trang trí hoặc shadow dày cho content thông thường.

## Semantic tokens

Web chỉ dùng semantic token `kumo-*` do `@cloudflare/kumo` cung cấp; không hard-code màu
Tailwind theo feature và không tự define lớp token riêng trong `index.css`.

| Nhóm | Token chính | Mục đích |
| --- | --- | --- |
| Base | `kumo-base`, `kumo-elevated`, `kumo-default`, `kumo-subtle` | Nền, panel và chữ |
| Brand | `kumo-brand`, `kumo-contrast` | Primary action, focus, selected state |
| State | `kumo-success`, `kumo-warning`, `kumo-danger`, `kumo-info` (+ `*-tint`) | Available, attention, error/destructive |
| Structure | `kumo-line`, `kumo-control`, `kumo-focus` | Phân cấp và accessibility |

Quy ước hình khối theo mặc định của Kumo. Dark mode do token `kumo-*` xử lý — tuyệt đối
không dùng class `dark:`; khi cần biến thể light/dark dùng `light-dark()`.

## Typography and spacing

- Heading và body theo `Text`/`Heading` variant của Kumo; sentence case, không `uppercase`,
  không `tracking-*`, không tự nhét `font-bold`.
- Body tối thiểu 14px; metadata có thể dùng 12px nhưng phải giữ contrast đạt chuẩn.
- Spacing theo thang 4px; khoảng cách phổ biến: 8, 12, 16, 24, 32px.
- Touch/click target tối thiểu 44px ở các control quan trọng.

## Component rules

- **Không tự chế** thứ Kumo đã có: `Sidebar`, `LayerCard`, `Table`, `Tabs`, `Dialog`,
  `Select`, `Input`, `InputArea`, `Field`, `Meter`, `Empty`, `Badge`, `Banner`, `Toasty`.
  Tham khảo `npx @cloudflare/kumo doc <Component>` và `dist/blocks-source/`.
- **Tabs:** dùng để chuyển giữa các view ngang hàng; luôn có selected indicator và panel
  tương ứng. Không dùng tab thay button hoặc filter đơn lẻ.
- **Button:** mỗi vùng hành động có một primary action; destructive action phải có label rõ
  và bước xác nhận khi hậu quả khó hoàn tác.
- **Form:** label và error qua prop của `Input`/`Field`/`Select`; không dùng placeholder
  thay label.
- **Card:** `LayerCard` với `ring ring-kumo-line`; header, content và actions có phân cấp
  rõ ràng.
- **Status:** không truyền đạt bằng màu đơn độc; luôn có text hoặc icon kèm accessible label.
- **Feedback:** notify qua `useAppToast()` (wrapper của `useKumoToastManager`); mọi async
  action cần loading, success/error feedback và chống submit lặp.

## Responsive and accessibility

- Thiết kế từ 320px, sau đó mở rộng theo content thay vì theo tên thiết bị.
- Keyboard navigation, visible focus và thứ tự tab phải hoạt động đầy đủ.
- Dùng semantic HTML trước ARIA; icon-only button bắt buộc có accessible name.
- Empty, loading, error và disabled state là một phần bắt buộc của component spec.

## Suggested structure

```text
src/
  features/        # feature modules; không import internals chéo nhau
  layouts/         # app shells and responsive page frames
  types/           # view-model contracts
  index.css        # kumo theme import + font stack
```

Dữ liệu từ API cần được map sang view model trước khi render. UI component không được phụ
thuộc DTO hoặc business rule của một feature cụ thể.
