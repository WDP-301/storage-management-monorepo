# Tài liệu nghiệp vụ hệ thống cho thuê kho chứa đồ

## 1. Phạm vi

Hệ thống phục vụ một đơn vị kinh doanh có nhiều cơ sở cho thuê kho chứa đồ. Mỗi kho là một không gian có diện tích riêng và mặc định nằm ở tầng trệt.

Cấu trúc vị trí:

**Cơ sở → Kho chứa đồ**

Không quản lý tòa nhà hoặc tầng. Mỗi cơ sở lưu địa chỉ, vĩ độ và kinh độ. Khái niệm **gần nhau** chỉ áp dụng cho các cơ sở và được xác định bằng khoảng cách giữa các tọa độ địa lý; các kho trong cùng cơ sở không cần tọa độ riêng.

## 2. Vai trò

1. **Khách hàng:** tìm, đặt, thuê, gia hạn, đổi và trả kho.
2. **Nhân viên cơ sở:** kiểm tra đặt chỗ, bàn giao, nhận trả và xử lý yêu cầu.
3. **Quản lý cơ sở:** quản lý kho, nhân viên, giá, bảo trì và hoạt động tại một cơ sở.
4. **Quản lý vận hành:** quản lý nhiều cơ sở, chính sách, khuyến mãi và báo cáo toàn hệ thống.
5. **Quản trị viên:** quản lý tài khoản, vai trò, quyền và nhật ký hệ thống.

## 3. Đặt nhiều kho

- Một lượt đặt có thể gồm nhiều kho.
- Khách có thể chọn kho cụ thể hoặc yêu cầu hệ thống đề xuất.
- Khách được tìm các cơ sở gần vị trí mong muốn trong một bán kính nhất định.
- Hệ thống dùng vĩ độ, kinh độ của địa chỉ để tính và sắp xếp cơ sở theo khoảng cách.
- Khi đặt nhiều kho, hệ thống ưu tiên tìm đủ kho tại một cơ sở; nếu không đủ thì đề xuất cơ sở gần đó.
- Toàn bộ kho trong lượt đặt được giữ tạm trong 15 phút.
- Chỉ xác nhận lượt đặt khi tất cả kho còn hợp lệ và khách hoàn tất tiền cọc.
- Nếu không đủ kho gần nhau, khách có thể chọn nhóm khác, giảm số lượng hoặc tham gia danh sách chờ.

## 4. Trạng thái kho

**Còn trống → Giữ tạm → Đã đặt → Đang thuê → Chờ kiểm tra → Còn trống/Bảo trì**

Quy tắc quan trọng:

- Kho chỉ được xuất hiện trong kết quả tìm kiếm khi ở trạng thái còn trống.
- Hết thời gian giữ tạm mà chưa thanh toán thì kho tự trở lại còn trống.
- Kho chờ kiểm tra chưa được cho khách khác thuê.
- Kho có hư hỏng chuyển sang bảo trì; sau khi xử lý mới trở lại còn trống.

## 5. Hợp đồng và thời gian thuê

- Một hợp đồng có thể chứa nhiều kho.
- Đơn vị thuê chính là tháng.
- Mỗi kho trong hợp đồng vẫn có ngày nhận, ngày trả và giá thuê riêng.
- Tiền cọc mặc định bằng một tháng thuê của từng kho.
- Giá, tiền cọc và chính sách được lưu tại thời điểm xác nhận để thay đổi giá sau này không ảnh hưởng hợp đồng cũ.

## 6. Gia hạn

1. Khách chọn kho và số tháng muốn gia hạn.
2. Hệ thống kiểm tra kho có vướng lịch đặt tiếp theo hay không.
3. Hệ thống hiển thị số tiền cần thanh toán.
4. Sau thanh toán, hệ thống tạo thêm một kỳ thuê; không ghi đè kỳ cũ.
5. Nếu không thể gia hạn đủ thời gian, hệ thống đề xuất thời gian ngắn hơn, kho khác hoặc danh sách chờ.

## 7. Đổi kho

Đổi kho được quản lý bằng **yêu cầu đổi kho**, không kết thúc kho cũ ngay lập tức.

1. Khách chọn kho đang thuê, lý do đổi, nhu cầu mới và ngày chuyển.
2. Hệ thống đề xuất kho phù hợp, ưu tiên kho gần các kho khác của khách nếu có.
3. Hệ thống tính chênh lệch tiền thuê và tiền cọc.
4. Quản lý xác nhận; kho mới được giữ cho khách.
5. Trong khoảng chuyển đồ đã định, khách được sử dụng đồng thời kho cũ và kho mới.
6. Nhân viên kiểm tra kho cũ và ghi nhận hư hỏng nếu có.
7. Hệ thống hoàn tất thay đổi trên hợp đồng, thu thêm hoặc ghi nhận khoản phải hoàn.
8. Toàn bộ lịch sử kho cũ, kho mới, số tiền và người xác nhận phải được giữ lại.

Nếu đổi nhiều kho trong cùng hợp đồng, từng kho được xử lý riêng để tránh ảnh hưởng các kho còn lại.

## 8. Nhận và trả kho

- Mã quét được tạo riêng cho mỗi lần nhận hoặc trả kho và có thời hạn.
- Trước khi bàn giao, nhân viên xác nhận thanh toán, hợp đồng và tình trạng kho.
- Nhân viên cùng khách xác nhận biên bản và ảnh hiện trạng ban đầu.
- Khi trả, kho chuyển sang chờ kiểm tra.
- Sau kiểm tra, kho được chuyển sang còn trống hoặc bảo trì.
- Phí hư hỏng được ghi riêng, có lý do, ảnh và người xác nhận.

## 9. Thanh toán và hoàn cọc

- Trong phạm vi đồ án, thanh toán được mô phỏng.
- Các khoản tiền gồm: tiền cọc, tiền thuê, phí phát sinh và khoản hoàn.
- Một hóa đơn có thể chứa nhiều khoản nhưng phải chỉ rõ khoản tiền thuộc kho nào.
- Khi trả kho, tiền cọc được trừ phí hư hỏng hoặc công nợ trước khi hoàn.
- Mọi điều chỉnh thủ công phải lưu người thực hiện và lý do.

## 10. Danh sách chờ

- Khách đăng ký theo cơ sở, kích thước kho, khoảng giá và số lượng cần thuê.
- Có thể yêu cầu các kho gần nhau.
- Khi đủ kho phù hợp, hệ thống gửi đề nghị có thời hạn.
- Chỉ giữ kho sau khi khách chấp nhận đề nghị.

## 11. Yêu cầu hỗ trợ và bảo trì

- Yêu cầu hỗ trợ của khách phải gắn với cơ sở và có thể gắn với một kho cụ thể.
- Yêu cầu bảo trì phải gắn với kho hoặc khu vực, có mức ưu tiên và người phụ trách.
- Nếu bảo trì ảnh hưởng việc sử dụng, khách có thể tạo yêu cầu đổi kho.
- Hình ảnh, nội dung xử lý và lịch sử trạng thái phải được lưu lại.

## 12. Các giới hạn của đồ án

Không triển khai khóa thông minh thực tế, bảo hiểm, nhiều loại tiền tệ, hoạt động không có mạng, kế toán chuyên sâu hoặc định giá tự động phức tạp.

Trọng tâm của đồ án là:

- Đặt nhiều kho trong một lượt.
- Chọn các kho gần nhau.
- Quản lý nhiều cơ sở.
- Gia hạn không làm mất lịch sử.
- Đổi kho có giai đoạn chuyển tiếp và quyết toán rõ ràng.
- Kiểm tra trạng thái kho trước bàn giao và sau khi trả.
- Phân quyền theo năm vai trò.

## 13. Nguyên tắc thiết kế dữ liệu

- Không xóa lịch sử đặt, thuê, đổi, gia hạn và thanh toán.
- Các trạng thái phải thay đổi theo luồng xác định, không cập nhật tùy ý.
- Mọi nghiệp vụ liên quan đến kho phải xác định rõ cơ sở.
- Dữ liệu tài chính phải lưu giá trị tại thời điểm giao dịch.
- Những thao tác quan trọng phải lưu người thực hiện, thời gian và lý do.
