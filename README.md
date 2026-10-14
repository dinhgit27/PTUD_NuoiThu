# PTUD_NuoiThu

## Cấu hình dịch vụ

Sao chép `backend/.env.example` thành `backend/.env` rồi điền cấu hình riêng của môi trường:

- `DATABASE_URL` và `JWT_SECRET` là cấu hình backend cần thiết.
- `GEMINI_API_KEY` bật phản hồi Gemini cho trợ lý; nếu bỏ trống, ứng dụng dùng câu trả lời dự phòng theo ngữ cảnh.
- `YOUTUBE_API_KEY` bật tìm kiếm nhạc bằng YouTube Data API v3. Không đưa khóa này vào frontend.
- Các biến `SMTP_*` chỉ cần khi sử dụng gửi mã OTP qua email.

Tài khoản Admin và User dùng chung biểu mẫu đăng nhập. Quyền được lấy từ trường `role` của tài khoản (`ADMIN` hoặc `USER`), không chọn loại tài khoản ở giao diện.

Admin chỉ dùng bảng điều khiển quản trị để quản lý loại thú và hệ thống; không có thú cưng cá nhân. API thú cưng chỉ cho phép User truy cập. Dữ liệu thú cưng cũ gắn với tài khoản Admin không bị xóa, nhưng không được hiển thị hoặc sử dụng.

## Phòng ban

Đăng ký tài khoản không cần mã mời và không bắt buộc tham gia phòng ban. Sau khi đăng nhập, mở tab **Phòng ban** để tự tạo phòng và chia sẻ mã mời, hoặc tham gia bằng mã do bạn bè gửi. Người dùng cũng có thể rời phòng ban mà vẫn giữ tài khoản và thú cưng.

## Ứng dụng desktop Electron

Khởi động backend bằng `cd backend` rồi `npm run dev`; ở terminal khác, chạy `cd frontend` rồi `npm run desktop` để mở bảng điều khiển và thú cưng dạng cửa sổ trong suốt, luôn nổi trên các ứng dụng khác. Thú cưng chỉ đi ngang ở dải dưới màn hình. Nhấp biểu tượng ✨ trên thanh điều khiển để mở menu có nhãn; chọn Chat, Pomodoro, nhạc hoặc thao tác chăm sóc. Nhấp trực tiếp vào thú cưng chỉ để vuốt ve; nhấp nút X để đóng bảng đang mở. Các bảng được canh theo vùng làm việc của màn hình để tránh tràn mép. Dùng biểu tượng OfficePet ở khay hệ thống hoặc `Ctrl+Shift+P` để điều khiển overlay. Dashboard và overlay trao đổi trạng thái thú cưng qua IPC giới hạn trong preload.

## Tạo thú cưng pixel

Sprite từ prompt được vẽ theo bộ quy tắc với các loài, màu sắc, phụ kiện và tùy chọn dáng tròn/thanh mảnh/họa tiết đốm; đây không phải công cụ sinh ảnh AI. Ảnh tham chiếu được tách nền, thu thành pixel art và làm chuyển động bằng các hiệu ứng theo frame, nhưng không thể suy ra tư thế giải phẫu mới từ một ảnh tĩnh.

## Hiệu ứng bối cảnh pixel

Khu vườn chung áp dụng bộ lọc WebGL cho ảnh bối cảnh: lấy mẫu theo lưới pixel và tạo viền nhẹ từ độ tương phản sáng tối. Đây là bản port 2D phù hợp với ảnh nền của ứng dụng; shader Defold gốc cần dữ liệu depth/normal từ cảnh 3D nên không thể chạy nguyên trạng trên ảnh 2D. Bản quyền và ghi nhận nguồn xem tại [frontend/THIRD_PARTY_NOTICES.md](frontend/THIRD_PARTY_NOTICES.md).