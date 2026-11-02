# HƯỚNG DẪN CHẠY KIỂM THỬ TỰ ĐỘNG (AUTOMATION TESTING) - HỆ THỐNG OFFICEPET

Bộ kiểm thử tự động được xây dựng bằng **Robot Framework + SeleniumLibrary**, tuân thủ chính xác cấu trúc mẫu của giảng viên và ánh xạ chi tiết theo tài liệu `Ke_Hoach_Va_Kich_Ban_Kiem_Thu_OfficePet.xlsx`.

Theo yêu cầu của giảng viên: **Chọn lọc các chức năng cốt lõi và kiểm thử chuyên sâu vào từng trường hợp chi tiết (Positive, Negative, Boundary, Validation, Security Guard)**, bộ kiểm thử tập trung vào **4 phân hệ trọng yếu nhất** của ứng dụng OfficePet với tổng cộng **34 Test Cases chuyên sâu**:

1. **Phân hệ 1: Xác thực & Quản trị phiên (Authentication & Session)** - *9 Test Cases (TC001 - TC009)*
   - Đăng nhập thành công USER / ADMIN.
   - Bắt lỗi sai mật khẩu, tài khoản không tồn tại.
   - Validation trường bắt buộc Email và Password (HTML5 + Custom Alert).
   - Chuyển đổi trạng thái sang Đăng ký và Quên mật khẩu OTP.
   - Đăng xuất an toàn và xóa sạch Session/LocalStorage.
2. **Phân hệ 2: Phòng Nuôi Thú Cưng & Chi Tiết 11 Hoạt Ảnh (Pet Care & 11 Core Animations)** - *13 Test Cases (TC010 - TC022)*
   - Kiểm tra hiển thị trạng thái sinh học (Đói, Vui vẻ, Năng lượng).
   - Tương tác Cho ăn (EATING) và Cho uống nước riêng biệt (DRINKING).
   - Vuốt ve (PETTING), Cho ngủ (SLEEPING), Đánh thức (WAKING_UP).
   - Chế độ làm việc cùng chủ (TYPING), Vận động thể lực (EXERCISING), Biểu cảm đói (HUNGRY).
   - Tùy biến bối cảnh phòng (Mặc định, Cafe ấm cúng, Vườn hoa, Bãi biển).
   - Tùy biến tỷ lệ kích thước thú cưng (Scale SMALL / LARGE).
3. **Phân hệ 3: Đồng Hành Năng Suất Pomodoro & Thư Giãn Lofi (Focus Pomodoro & Music)** - *5 Test Cases (TC023 - TC027)*
   - Mở đồng hồ Pomodoro, kiểm tra hiển thị thời gian chuẩn.
   - Chuyển đổi giữa chế độ Nghiêm ngặt (Strict) và Thư giãn (Relaxed).
   - Chạy thử nghiệm đếm ngược nhanh 5 giây, kiểm tra trạng thái hoạt động.
   - Tạm dừng và Đặt lại đồng hồ (Reset) về giá trị ban đầu.
   - Điều hướng và tải giao diện Không gian Âm nhạc Lofi.
4. **Phân hệ 4: Cổng Quản Trị Hệ Thống Admin Console & Bảo Mật Phân Quyền (Admin Console & Role Guard)** - *7 Test Cases (TC028 - TC034)*
   - Đăng nhập quyền ADMIN và truy cập `/admin`.
   - Kiểm tra Dashboard Tổng quan số liệu (Người dùng, Thú cưng, Doanh thu, Nhiệm vụ).
   - Kiểm tra tab Quản lý tài khoản & phân quyền (Role assignment).
   - Kiểm tra tab Cấu hình loài thú & 11 hoạt ảnh spritesheet.
   - Kiểm tra Xưởng Pet Forge tạo thú cưng tự động.
   - Kiểm tra tab Quản lý Cửa Hàng vật phẩm & tiền tệ.
   - Kiểm thử bảo mật: Tài khoản USER không thể thấy hoặc truy cập Admin Console (Role Guard).

---

## 1. Cài đặt thư viện phụ thuộc
Đảm bảo đã cài đặt đầy đủ các thư viện trong `requirements.txt`:
```bash
cd testplan/autotest-demo
pip install -r requirements.txt
```

---

## 2. Các lệnh thực thi kiểm thử (Robot Framework Commands)

> **Lưu ý**: Đảm bảo Backend (`http://localhost:4000`) và Frontend (`http://localhost:5173`) đang hoạt động trước khi thực thi.

### 2.1. Chạy Suite Chuyên Sâu Cốt Lõi (Đúng định dạng mẫu chuẩn của cô):
```bash
robot -d results testcases/officepet_test.robot
```
*Tất cả 34 Test Cases chuyên sâu sẽ được thực thi trên Headless Chrome tốc độ cao (0.02s/bước), tự động xuất kết quả ra thư mục `results/`.*

### 2.2. Chạy trên trình duyệt hiển thị giao diện (Để xem trực tiếp quá trình click):
```bash
robot -d results -v BROWSER:chrome testcases/officepet_test.robot
```

### 2.3. Lọc chạy theo Phân hệ (Tags):
* **Chỉ chạy Phân hệ 1 (Xác thực)**:
  ```bash
  robot -d results -i auth testcases/officepet_test.robot
  ```
* **Chỉ chạy Phân hệ 2 (Phòng Thú cưng & Hoạt ảnh)**:
  ```bash
  robot -d results -i pet testcases/officepet_test.robot
  ```
* **Chỉ chạy Phân hệ 3 (Pomodoro & Lofi)**:
  ```bash
  robot -d results -i pomodoro testcases/officepet_test.robot
  ```
* **Chỉ chạy Phân hệ 4 (Quản trị Admin & Bảo mật)**:
  ```bash
  robot -d results -i admin testcases/officepet_test.robot
  ```
* **Chỉ chạy các kịch bản kiểm thử bảo mật & lỗi (Negative/Validation/Security)**:
  ```bash
  robot -d results -i negative testcases/officepet_test.robot
  ```

### 2.4. Chạy file mẫu demo ban đầu của cô (SauceDemo):
```bash
robot -d results testcases/saucedemo_test.robot
```

---

## 3. Xem Báo Cáo Kết Quả Kiểm Thử Chuẩn Mẫu Của Cô
Sau khi kiểm thử hoàn tất, mở trực tiếp các file trong thư mục `results/`:
* **`results/report.html`**: Giao diện tổng quan trực quan chuẩn Robot Framework (Đúng giao diện cũ của cô), hiển thị bảng thống kê Pass/Fail 100%, đồ thị thanh Bar Chart và danh sách 34 Test Cases.
* **`results/log.html`**: Giao diện nhật ký chi tiết từng thao tác click, input text, kiểm tra DOM element và thời gian phản hồi.
* **`results/output.xml`**: Dữ liệu máy đọc chuẩn XML phục vụ tích hợp CI/CD.
