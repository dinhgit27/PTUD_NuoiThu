# -*- coding: utf-8 -*-
"""
Script xóa sạch 100% mọi dấu vết của các tester / owner cũ (Tester 1..15, Owner 1..16),
chỉ giữ lại DUY NHẤT 3 TESTER CHÍNH:
1. Nguyễn Đỉnh (123000431) - Nhóm trưởng
2. Hồ Tâm Phi Hùng (123000287)
3. Võ Lê Hoàng Nhã (123000311)
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import openpyxl
from openpyxl.styles import Font, Alignment

FILE_PATH = r"c:\Users\PHI HUNG\Downloads\PTUD_NuoiThu\testplan\test-plan-iterations.xlsx"

LEADER_DINH = "Nguyễn Đỉnh (123000431)"
MEMBER_HUNG = "Hồ Tâm Phi Hùng (123000287)"
MEMBER_NHA  = "Võ Lê Hoàng Nhã (123000311)"
APPROVER_NAME = "Nguyễn Đỉnh (123000431) - Lead QA"

# 25 Kịch bản chuẩn hóa với phân công chuẩn:
OFFICEPET_25_TEST_CASES = [
    # TS01 - Nguyễn Đỉnh
    ("TS01", "Xác thực & Tài khoản", "TC1.1", "Đăng ký tài khoản mới hợp lệ & Kiểm thực lỗi email/mật khẩu",
     "[Mục đích] Xác nhận quy trình đăng ký tài khoản nhân viên mới vào hệ thống.\n[Điều kiện] Người dùng chưa có tài khoản, đang ở màn hình Đăng ký.\n[Các bước] 1. Nhập Họ tên 'Nguyễn Văn A', Email hợp lệ, Mật khẩu >= 8 ký tự, chọn Phòng ban.\n2. Nhấn nút 'Đăng ký'.\n3. Thử lại với email trùng hoặc mật khẩu < 8 ký tự.\n[Kỳ vọng] Hệ thống tạo tài khoản mã hóa bcrypt, báo thành công; chặn email trùng và mật khẩu yếu.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-01", "FR-01.1, FR-01.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS01", "Xác thực & Tài khoản", "TC1.2", "Đăng nhập phân quyền vai trò (Role ADMIN & USER) và JWT Token",
     "[Mục đích] Xác thực cơ chế phân quyền truy cập giữa Quản trị viên và Nhân viên.\n[Điều kiện] Đã có sẵn tài khoản Admin và User trong hệ thống.\n[Các bước] 1. Đăng nhập User -> điều hướng vào Vườn thú cưng làm việc.\n2. Đăng xuất tài khoản.\n3. Đăng nhập Admin -> hiển thị menu Bảng điều khiển Quản trị (Admin Console).\n[Kỳ vọng] JWT token cấp đúng role; User bị chặn vào /admin, Admin truy cập được trang quản trị.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-01", "FR-01.3, FR-01.4", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS01", "Xác thực & Tài khoản", "TC1.3", "Quên mật khẩu qua mã OTP Email & Cập nhật ảnh đại diện Avatar",
     "[Mục đích] Kiểm tra quy trình khôi phục mật khẩu qua OTP và cập nhật thông tin cá nhân.\n[Điều kiện] Tài khoản người dùng có email hợp lệ.\n[Các bước] 1. Bấm 'Quên mật khẩu', nhập email nhận mã OTP 6 chữ số.\n2. Nhập mã OTP và thiết lập mật khẩu mới.\n3. Đăng nhập đổi ảnh đại diện trong trang Hồ sơ cá nhân.\n[Kỳ vọng] OTP gửi thành công; cập nhật mật khẩu và avatar hiển thị tức thì trên giao diện.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-01", "FR-01.5, FR-01.6", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),

    # TS02 - Hồ Tâm Phi Hùng
    ("TS02", "Nuôi & Chăm sóc Thú Cưng", "TC2.1", "Khởi tạo nhận nuôi thú cưng & Cơ chế suy giảm chỉ số sinh học tự nhiên",
     "[Mục đích] Xác thực nhận nuôi thú cưng ban đầu và suy giảm chỉ số Đói/Khát/Năng lượng theo thời gian.\n[Điều kiện] Tài khoản mới đăng nhập lần đầu vào hệ thống.\n[Các bước] 1. Chọn thú cưng mặc định (Corgi), đặt tên 'Bắp Cải', nhận nuôi.\n2. Quan sát chỉ số Đói và Khát giảm dần sau mỗi chu kỳ 5-10 phút.\n[Kỳ vọng] Bản ghi UserPet tạo đúng Level 1, 100 Năng lượng, 80 Đói/Khát; thanh trạng thái đổi màu vàng/đỏ khi < 30%.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-02", "FR-02.1, FR-02.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS02", "Nuôi & Chăm sóc Thú Cưng", "TC2.2", "Hành động Cho ăn (EATING) và Cho uống nước (DRINKING) tách bạch",
     "[Mục đích] Kiểm tra hoạt ảnh chuẩn hóa riêng biệt giữa Ăn và Uống theo chuẩn 11 hoạt ảnh mới.\n[Điều kiện] Thú cưng có chỉ số Đói < 80 và Khát < 80.\n[Các bước] 1. Nhấn nút 'Cho ăn' -> quan sát hoạt ảnh EATING.\n2. Nhấn nút 'Cho uống nước' -> quan sát hoạt ảnh DRINKING tách biệt riêng.\n[Kỳ vọng] Cho ăn hồi +30 Đói với hoạt ảnh nhai thức ăn; Cho uống hồi +25 Khát với hoạt ảnh uống nước riêng; kết thúc trở về IDLE.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-02", "FR-02.3, FR-02.4", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS02", "Nuôi & Chăm sóc Thú Cưng", "TC2.3", "Tương tác vuốt ve (PETTING) giới hạn +30 EXP/ngày và Hoạt ảnh HAPPY / SAD",
     "[Mục đích] Kiểm tra tương tác vuốt ve, cơ chế chống spam cày cấp và chuyển đổi hoạt ảnh cảm xúc.\n[Điều kiện] Thú cưng đang đứng yên ở trạng thái IDLE.\n[Các bước] 1. Click chuột vuốt ve thú cưng liên tục 6 lần (+5 EXP/lần).\n2. Click tiếp tục lần 7 trở đi trong ngày.\n3. Để chỉ số đói khát tụt xuống < 15%.\n[Kỳ vọng] Thú cưng phát tim (PETTING), cộng tối đa +30 EXP/ngày; click tiếp vẫn vui nhưng không cộng thêm EXP; khi đói hiển thị HUNGRY/SAD.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-02", "FR-02.5, FR-02.6", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS02", "Nuôi & Chăm sóc Thú Cưng", "TC2.4", "Cho thú cưng ngủ (SLEEPING) hồi năng lượng và Thăng cấp thú cưng",
     "[Mục đích] Kiểm tra cơ chế hồi phục năng lượng khi ngủ và thăng cấp (Level Up).\n[Điều kiện] Năng lượng < 50, điểm kinh nghiệm đạt 95/100 EXP.\n[Các bước] 1. Bấm 'Đi ngủ' -> phòng tối, hoạt ảnh SLEEPING phập phồng chữ Zzz.\n2. Bấm 'Đánh thức'.\n3. Thực hiện hành động chăm sóc để đạt mốc 100 EXP.\n[Kỳ vọng] Năng lượng tăng dần khi ngủ; khi đạt 100 EXP kích hoạt Level Up, hoạt ảnh nhảy múa DANCING và nhận thưởng mở khóa.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-02", "FR-02.7, FR-02.8", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),

    # TS03 - Nguyễn Đỉnh
    ("TS03", "Desktop Companion & PiP", "TC3.1", "Thu nhỏ thú cưng ra màn hình Desktop (PiP) và Kéo thả ghi nhớ tọa độ",
     "[Mục đích] Kiểm tra tính năng Document PiP luôn nổi trên desktop và ghi nhớ tọa độ màn hình.\n[Điều kiện] Trình duyệt có hỗ trợ Document PiP API.\n[Các bước] 1. Nhấn nút Desktop PiP trên web.\n2. Kéo thả thú cưng sang góc phải dưới màn hình.\n3. Đóng cửa sổ và mở lại PiP.\n[Kỳ vọng] Cửa sổ popup trong suốt nổi trên màn hình; khi mở lại tự động khôi phục đúng tọa độ đã kéo thả trước đó.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-03", "FR-03.1, FR-03.2", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS03", "Desktop Companion & PiP", "TC3.2", "Thú cưng tự do đi lại trong ranh giới (Roaming) và Menu thao tác nhanh",
     "[Mục đích] Kiểm tra chuyển động đi bộ tự nhiên và bảng menu chuột phải trên desktop.\n[Điều kiện] Cửa sổ Desktop PiP đang mở.\n[Các bước] 1. Bật chế độ Roaming, quan sát thú đi dạo.\n2. Nhấp chuột phải (Right-click) lên thú cưng.\n3. Chọn nút 'Cho ăn nhanh'.\n[Kỳ vọng] Thú cưng tự động quay đầu khi chạm mép màn hình (WALKING); menu chuột phải hiển thị mượt mà và thực hiện hành động tức thì.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-03", "FR-03.3, FR-03.4", "Minor", "P3 - Low", ("No", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),

    # TS04 - Võ Lê Hoàng Nhã
    ("TS04", "Pomodoro & Năng suất", "TC4.1", "Phiên Pomodoro 25 phút, thú cưng gõ phím TYPING và Nhận thưởng hoàn thành",
     "[Mục đích] Kiểm tra đồng hồ đếm giờ Pomodoro, đồng bộ trạng thái gõ phím và cộng thưởng hoàn thành.\n[Điều kiện] Thú cưng đang ở trạng thái IDLE.\n[Các bước] 1. Bắt đầu phiên 25 phút -> quan sát thú chuyển sang TYPING.\n2. Tạm dừng -> trở về IDLE.\n3. Để đếm hết 25 phút.\n[Kỳ vọng] Đồng hồ chạy chuẩn xác; thú cưng ngồi gõ máy tính chăm chỉ; kết thúc phiên nhận +50 EXP, +20 Vàng và phát chuông báo.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-04", "FR-04.1, FR-04.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), MEMBER_NHA),
    ("TS04", "Pomodoro & Năng suất", "TC4.2", "Chế độ Nghiêm khắc cảnh báo xao nhãng khi người dùng rời tab làm việc",
     "[Mục đích] Kiểm tra tính năng chống xao nhãng của Pomodoro trong giờ làm việc.\n[Điều kiện] Bật 'Chế độ Nghiêm khắc' (Strict Mode) trong cài đặt Pomodoro.\n[Các bước] 1. Bắt đầu phiên làm việc.\n2. Chuyển sang tab khác (Youtube/MXH) hơn 15 giây.\n3. Quay trở lại ứng dụng.\n[Kỳ vọng] Trình duyệt gửi thông báo đẩy nhắc nhở tập trung; thú cưng chuyển vẻ mặt buồn (SAD) cảnh báo người dùng.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-04", "FR-04.3", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_NHA),
    ("TS04", "Pomodoro & Năng suất", "TC4.3", "Thực hiện Bài tập thở thư giãn (4-7-8 / Box) và Trình phát nhạc Lofi",
     "[Mục đích] Kiểm tra các tính năng chăm sóc sức khỏe tinh thần và phát nhạc nền tập trung.\n[Điều kiện] Thiết bị có loa / tai nghe kết nối hoạt động.\n[Các bước] 1. Chọn kỹ thuật thở 4-7-8, làm theo nhịp thở trực quan trên màn hình.\n2. Bật trình phát nhạc Lofi, chỉnh âm lượng, chuyển sang track tiếng mưa.\n[Kỳ vọng] Đồ họa vòng tròn thở co giãn đúng nhịp giây; nhạc Lofi phát êm ái, chuyển bài mượt mà không lỗi âm thanh.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-04", "FR-04.4, FR-04.5", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_NHA),

    # TS05 - Võ Lê Hoàng Nhã
    ("TS05", "Chatbot AI Đồng hành", "TC5.1", "Hộp thoại Chatbot AI, gửi câu hỏi công việc và Nhận phản hồi thông minh",
     "[Mục đích] Kiểm tra giao diện ngăn kéo chat và phản hồi thông minh từ trợ lý AI.\n[Điều kiện] Kết nối Internet hoạt động, API Key được cấu hình.\n[Các bước] 1. Mở ngăn kéo chat bên cạnh thú cưng.\n2. Nhập câu hỏi xin lời khuyên sắp xếp công việc.\n3. Nhấn gửi tin nhắn.\n[Kỳ vọng] Tin nhắn hiển thị đẹp mắt, thú cưng hiển thị bong bóng suy nghĩ và trả lời động viên khoa học trong 1-3 giây.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-05", "FR-05.1, FR-05.2", "Major", "P2 - Medium", ("No", "No", "Yes", "Yes", "Yes"), MEMBER_NHA),
    ("TS05", "Chatbot AI Đồng hành", "TC5.2", "Đồng bộ hoạt ảnh biểu cảm thú cưng (HAPPY / SAD) theo sắc thái trò chuyện",
     "[Mục đích] Kiểm tra sự gắn kết cảm xúc giữa nội dung trò chuyện AI và hoạt ảnh thú cưng.\n[Điều kiện] Chatbot AI đang hoạt động bình thường.\n[Các bước] 1. Gửi tin nhắn khoe tin vui hoàn thành dự án -> quan sát thú cưng.\n2. Gửi tin nhắn tâm sự chuyện buồn áp lực -> quan sát thú cưng.\n[Kỳ vọng] Với tin vui thú cưng kích hoạt HAPPY / DANCING; với chuyện buồn thú làm động tác vẫy tay chia sẻ an ủi.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-05", "FR-05.3", "Minor", "P3 - Low", ("No", "No", "Yes", "Yes", "Yes"), MEMBER_NHA),

    # TS06 - Hồ Tâm Phi Hùng
    ("TS06", "Nhiệm vụ & Thi đua", "TC6.1", "Nhiệm vụ hàng ngày, tự động cộng dồn tiến độ và Nhận thưởng EXP",
     "[Mục đích] Kiểm tra hệ thống tự động ghi nhận hành vi người dùng vào tiến độ nhiệm vụ.\n[Điều kiện] Nhiệm vụ 'Cho ăn 3 lần' đang có tiến độ 0/3.\n[Các bước] 1. Thực hiện cho thú ăn đủ 3 lần.\n2. Mở tab Nhiệm vụ kiểm tra tiến độ.\n3. Bấm nút 'Nhận thưởng'.\n[Kỳ vọng] Thanh tiến trình tự động nhảy 3/3; nút 'Nhận thưởng' sáng lên; bấm nhận cộng đúng EXP và nút chuyển sang 'Đã nhận'.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-06", "FR-06.1, FR-06.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS06", "Nhiệm vụ & Thi đua", "TC6.2", "Bảng xếp hạng thi đua cá nhân, phòng ban và Cơ chế reset tự động lúc 00:00",
     "[Mục đích] Kiểm tra bảng xếp hạng thi đua và cơ chế reset ngày mới của hệ thống.\n[Điều kiện] Đã có dữ liệu tích lũy điểm của các phòng ban.\n[Các bước] 1. Mở Bảng xếp hạng, chuyển đổi bộ lọc Tuần/Tháng/Phòng ban.\n2. Kiểm tra reset nhiệm vụ sau mốc 00:00.\n[Kỳ vọng] Danh sách xếp hạng hiển thị đúng theo điểm số giảm dần; nhiệm vụ ngày cũ được làm mới tự động lúc 00:00.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-06", "FR-06.3, FR-06.4", "Major", "P2 - Medium", ("No", "No", "Yes", "Yes", "Yes"), MEMBER_HUNG),

    # TS07 - Võ Lê Hoàng Nhã
    ("TS07", "Khu vườn & Bạn bè", "TC7.1", "Khu vườn chung đa thú cưng phòng ban, Kết nối bạn bè & Ghé thăm vườn",
     "[Mục đích] Kiểm tra render nhiều thú cưng trên Canvas chung, tính năng kết bạn và thăm vườn.\n[Điều kiện] Đồng nghiệp trong cùng phòng ban cùng trực tuyến.\n[Các bước] 1. Mở 'Vườn Chung' xem thú cưng các đồng nghiệp dạo chơi.\n2. Tìm kiếm email gửi kết bạn.\n3. Ghé thăm vườn riêng của người bạn đó.\n[Kỳ vọng] Thú cưng hiển thị đồng thời mượt mà không đè tọa độ; kết bạn thành công và chuyển cảnh thăm vườn chuẩn xác.",
     "Approved", MEMBER_NHA, APPROVER_NAME, "", "UC-07", "FR-07.1, FR-07.2", "Major", "P2 - Medium", ("No", "No", "Yes", "Yes", "Yes"), MEMBER_NHA),

    # TS08 - Hồ Tâm Phi Hùng
    ("TS08", "Cửa hàng Shop & Kho đồ", "TC8.1", "Mua Thú cưng mới từ Shop bằng điểm EXP và Đổi thú cưng đại diện trong Kho đồ",
     "[Mục đích] Kiểm tra giao dịch mua thú cưng bằng điểm tích lũy và chuyển đổi thú cưng hoạt động.\n[Điều kiện] Tài khoản có đủ 500 EXP.\n[Các bước] 1. Vào Shop tab Thú cưng, chọn 'Cáo Tuyết' (500 EXP), nhấn Mua.\n2. Vào Kho đồ, bấm 'Đặt làm thú cưng đại diện'.\n[Kỳ vọng] Số dư EXP bị trừ đúng 500; Cáo Tuyết được thêm vào UserPet; Màn hình chính và Desktop đổi ngay sang Cáo Tuyết.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-08", "FR-08.1, FR-08.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS08", "Cửa hàng Shop & Kho đồ", "TC8.2", "Mua Skin/Trang phục và Trang bị (Equip/Unequip) lên thú cưng",
     "[Mục đích] Kiểm tra tính năng mua sắm trang phục và hiển thị skin layer trên canvas.\n[Điều kiện] Người dùng có đủ Vàng và sở hữu thú cưng tương thích.\n[Các bước] 1. Mua skin 'Áo Hoodie Dev'.\n2. Vào Kho đồ nhấn 'Trang bị' (Equip).\n3. Bấm 'Tháo ra' (Unequip).\n[Kỳ vọng] Khi Equip thú cưng hiển thị áo hoodie mượt mà; khi Unequip trở về diện mạo nguyên bản mặc định.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-08", "FR-08.3, FR-08.4", "Major", "P2 - Medium", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),
    ("TS08", "Cửa hàng Shop & Kho đồ", "TC8.3", "Mua bối cảnh Nền vườn mới và Áp dụng thay đổi không gian làm việc",
     "[Mục đích] Kiểm tra tùy biến bối cảnh nền và hiệu ứng gia tăng EXP nội tại từ vật phẩm.\n[Điều kiện] Đủ điểm EXP mua background mới trong Shop.\n[Các bước] 1. Mua nền 'Văn phòng Cyberpunk'.\n2. Vào Kho đồ bấm 'Áp dụng làm nền vườn'.\n[Kỳ vọng] Khu vườn đổi ngay sang phong cách Cyberpunk, thú cưng đứng đúng vị trí sàn; buff EXP hoạt động chính xác.",
     "Approved", MEMBER_HUNG, APPROVER_NAME, "", "UC-08", "FR-08.5", "Minor", "P3 - Low", ("No", "Yes", "Yes", "Yes", "Yes"), MEMBER_HUNG),

    # TS09 - Nguyễn Đỉnh
    ("TS09", "Cổng Quản trị Admin", "TC9.1", "Bảng điều khiển số liệu hệ thống và Đổi quyền người dùng (Role USER <-> ADMIN)",
     "[Mục đích] Kiểm tra các widget thống kê quản trị và phân quyền bảo mật tài khoản.\n[Điều kiện] Đăng nhập bằng tài khoản Quản trị viên (Admin).\n[Các bước] 1. Mở Admin Dashboard -> xem số liệu tổng người dùng, thú cưng.\n2. Vào Quản lý Người dùng, đổi role một tài khoản thử nghiệm.\n[Kỳ vọng] Số liệu tải chính xác từ DB; role được cập nhật ngay lập tức; chặn tài khoản bị ban đăng nhập.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-09", "FR-09.1, FR-09.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS09", "Cổng Quản trị Admin", "TC9.2", "Xưởng Pet Forge tạo thú 11 hành động, bỏ ô mô tả thừa, dọn sạch form và Hiện ở Shop",
     "[Mục đích] Xác thực cải tiến Pet Forge: preview đủ 11 hành động, không có ô mô tả thừa, dọn sạch UI sau tạo và lưu DB hiện ngay ở Shop.\n[Điều kiện] Admin đang ở công cụ Pet Forge.\n[Các bước] 1. Upload Sprite sheet 11 hàng.\n2. Xác nhận form không có ô 'Mô tả'.\n3. Nhập Tên, Giá và nhấn 'Tạo thú cưng'.\n4. Kiểm tra form reset sạch sẽ và sang Quản lý Shop kiểm tra.\n[Kỳ vọng] Form dọn sạch giao diện ngay sau khi tạo; thú mới lưu vào bảng PetType và xuất hiện ngay lập tức trong Quản lý Shop.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-09", "FR-09.3, FR-09.4", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS09", "Cổng Quản trị Admin", "TC9.3", "Xưởng tạo Skin, Xưởng tạo Vật phẩm hoạt ảnh và Chức năng Xóa thú cưng khỏi hệ thống",
     "[Mục đích] Xác thực việc tách riêng 2 xưởng tạo Skin/Vật phẩm, loại bỏ mục vật phẩm tĩnh cũ và kiểm tra nút xóa thú.\n[Điều kiện] Admin ở trang Quản lý Shop.\n[Các bước] 1. Kiểm tra menu điều hướng sang Tạo Skin và Tạo Vật phẩm (đã bỏ nút thêm vật phẩm cũ và mục vật phẩm tĩnh).\n2. Nhấn nút Xóa một thú cưng thử nghiệm.\n[Kỳ vọng] Modal xác nhận xóa hiển thị an toàn; sau khi bấm xóa, thú cưng bị gỡ khỏi danh sách quản lý và database.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-09", "FR-09.5, FR-09.6", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),

    # TS10 - Nguyễn Đỉnh
    ("TS10", "Phi Chức Năng & Bảo Mật", "TC10.1", "Tương thích ngược thú cũ 17 hàng và Fallback CELEBRATING->HAPPY, EXERCISING->DANCING",
     "[Mục đích] Đảm bảo các con thú tạo trước đây (chuẩn 17 hàng) và thú mới (11 hàng) đều hiển thị bình thường không bị lỗi.\n[Điều kiện] Hệ thống có thú cưng sprite sheet 17 hàng cũ.\n[Các bước] 1. Mở xem thú cưng cũ 17 hàng.\n2. Kích hoạt các sự kiện cũ CELEBRATING và EXERCISING.\n[Kỳ vọng] Thú cũ chạy mượt mà không lệch tọa độ frame; cơ chế fallback tự động chuyển CELEBRATING->HAPPY và EXERCISING->DANCING không gây crash console.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-10", "FR-10.1, FR-10.2", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
    ("TS10", "Phi Chức Năng & Bảo Mật", "TC10.2", "Render Canvas 60 FPS không rò rỉ RAM, Chặn Route Guard /admin và Chống XSS",
     "[Mục đích] Kiểm tra hiệu năng mượt mà của Canvas và kiểm thử an toàn bảo mật hệ thống.\n[Điều kiện] Đăng nhập bằng tài khoản User thông thường.\n[Các bước] 1. Đo FPS khi thú cưng chuyển động trong 30 phút.\n2. Nhập URL /admin/pets trên trình duyệt.\n3. Thử inject payload <script>alert(1)</script> vào tên thú.\n[Kỳ vọng] FPS đạt 55-60 FPS ổn định, RAM không phình; route /admin bị chặn 403; payload XSS bị escape an toàn.",
     "Approved", LEADER_DINH, APPROVER_NAME, "", "UC-10", "FR-10.3, FR-10.4, FR-10.5", "Critical", "P1 - High", ("Yes", "Yes", "Yes", "Yes", "Yes"), LEADER_DINH),
]

print(f"Đang mở file: {FILE_PATH}...")
wb = openpyxl.load_workbook(FILE_PATH)
FONT_TNR = "Times New Roman"

def set_tnr(cell, size=None, bold=None, italic=None, color=None):
    base_f = cell.font
    cell.font = Font(
        name=FONT_TNR,
        size=size if size is not None else (base_f.size if base_f else 11),
        bold=bold if bold is not None else (base_f.bold if base_f else False),
        italic=italic if italic is not None else (base_f.italic if base_f else False),
        color=color if color is not None else (base_f.color if base_f else None)
    )

# 1. SHEET ReadMe
print("1. Sheet ReadMe...")
ws_readme = wb['ReadMe']
ws_readme['B4'].value = "Nguyễn Đỉnh - MSSV: 123000431 (Phụ trách: Auth, Desktop PiP, Admin Console, Security & NFR)"
ws_readme['B5'].value = "Hồ Tâm Phi Hùng  - MSSV: 123000287 (Phụ trách: Nuôi thú 11 hoạt ảnh, Nhiệm vụ, Shop & Kho đồ)"
ws_readme['B6'].value = "Võ Lê Hoàng Nhã - MSSV: 123000311 (Phụ trách: Pomodoro, Wellness Lofi/Thở, Chatbot AI, Vườn chung)"

# 2. SHEET Test Case List
print("2. Xóa sạch mọi tester dư trong 'Test Case List'...")
ws_tc = wb['Test Case List']

for idx, tc in enumerate(OFFICEPET_25_TEST_CASES):
    row_num = 2 + idx
    (sc_id, sc_name, tc_id, tc_name, tc_desc, status, owner, approver, comments, ucs, frs, class_a, class_b, iter_plan, lead_tester) = tc
    ws_tc.cell(row_num, 7).value = owner
    ws_tc.cell(row_num, 8).value = approver

# Xóa hàng 27 & 28 cột G (Owner)
ws_tc.cell(27, 7).value = None
ws_tc.cell(28, 7).value = None

# Đặt 3 tester duy nhất vào A42:A44
ws_tc.cell(41, 1).value = "Test Case Owner"
ws_tc.cell(42, 1).value = LEADER_DINH
ws_tc.cell(43, 1).value = MEMBER_HUNG
ws_tc.cell(44, 1).value = MEMBER_NHA

# Xóa toàn bộ từ A45 trở đi
for r_del in range(45, 70):
    ws_tc.cell(r_del, 1).value = None

# Cập nhật Data Validation cho G2:G26
for dv in ws_tc.data_validations.dataValidation:
    if "G2:G26" in str(dv.sqref) or "G" in str(dv.sqref):
        dv.formula1 = "$A$42:$A$44"

# 3. SHEET Test Case Coverage Plan
print("3. Xóa sạch mọi tester dư trong 'Test Case Coverage Plan'...")
ws_cov = wb['Test Case Coverage Plan']

for idx, tc in enumerate(OFFICEPET_25_TEST_CASES):
    cov_row = 3 + idx
    lead_tester = tc[14]
    ws_cov.cell(cov_row, 8).value = lead_tester

# Xóa hàng 28 cột H
ws_cov.cell(28, 8).value = None
ws_cov.cell(29, 8).value = None

# Đặt 3 tester duy nhất vào A41:A43
ws_cov.cell(40, 1).value = "Planned Tester"
ws_cov.cell(41, 1).value = LEADER_DINH
ws_cov.cell(42, 1).value = MEMBER_HUNG
ws_cov.cell(43, 1).value = MEMBER_NHA

# Xóa toàn bộ từ A44 trở đi
for r_del in range(44, 70):
    ws_cov.cell(r_del, 1).value = None

# Cập nhật Data Validation H3:H27
for dv in ws_cov.data_validations.dataValidation:
    if "H3:H27" in str(dv.sqref) or "H" in str(dv.sqref):
        dv.formula1 = "$A$41:$A$43"

# 4. SHEETS Test Iteration 1..5
for iter_idx in range(1, 6):
    sname = f"Test Iteration {iter_idx}"
    print(f"4.{iter_idx}. Xóa sạch mọi tester dư trong '{sname}'...")
    ws_it = wb[sname]

    for idx, tc in enumerate(OFFICEPET_25_TEST_CASES):
        r = 2 + idx
        iter_plan = tc[13]
        lead_tester = tc[14]
        in_this_iter = iter_plan[iter_idx - 1]

        if in_this_iter == "Yes":
            ws_it.cell(r, 4).value = lead_tester
            ws_it.cell(r, 5).value = "Not Run"
        else:
            ws_it.cell(r, 4).value = None
            ws_it.cell(r, 5).value = "N/A"

    # Xóa hàng 27 & 28 cột D
    ws_it.cell(27, 4).value = "Insert Rows Only Above Here"
    ws_it.cell(28, 4).value = None

    # Đặt 3 tester duy nhất vào A31:A33
    ws_it.cell(30, 1).value = "Tester"
    ws_it.cell(31, 1).value = LEADER_DINH
    ws_it.cell(32, 1).value = MEMBER_HUNG
    ws_it.cell(33, 1).value = MEMBER_NHA

    # Xóa toàn bộ từ A34 trở đi
    for r_del in range(34, 60):
        ws_it.cell(r_del, 1).value = None

    # Cập nhật Data Validation D2:D26
    for dv in ws_it.data_validations.dataValidation:
        if "D2:D26" in str(dv.sqref) or "D" in str(dv.sqref):
            dv.formula1 = "$A$31:$A$33"

# 5. SHEET Stats
print("5. Đồng bộ Sheet Stats...")
ws_stats = wb['Stats']
for iter_idx in range(1, 6):
    iter_sheet_name = f"Test Iteration {iter_idx}"
    start_stat_row = 2 + (iter_idx - 1) * 25

    for idx in range(25):
        stat_r = start_stat_row + idx
        source_r = 2 + idx
        list_r = 2 + idx

        ws_stats.cell(stat_r, 1).value = f"='{iter_sheet_name}'!A{source_r}"
        ws_stats.cell(stat_r, 2).value = f"='{iter_sheet_name}'!B{source_r}"
        ws_stats.cell(stat_r, 3).value = f"='{iter_sheet_name}'!$G$31"
        ws_stats.cell(stat_r, 4).value = f"='{iter_sheet_name}'!C{source_r}"
        ws_stats.cell(stat_r, 5).value = f"='{iter_sheet_name}'!D{source_r}"
        ws_stats.cell(stat_r, 6).value = f"='{iter_sheet_name}'!E{source_r}"
        ws_stats.cell(stat_r, 7).value = f"='Test Case List'!L{list_r}"
        ws_stats.cell(stat_r, 8).value = f"='Test Case List'!M{list_r}"

# 6. ÉP BUỘC 100% TIMES NEW ROMAN
print("6. Rà soát font chữ Times New Roman...")
for sname in wb.sheetnames:
    ws = wb[sname]
    for row in ws.iter_rows():
        for cell in row:
            if cell.value is not None:
                set_tnr(cell)

print(f"7. Đang lưu file chuẩn hóa vào: {FILE_PATH}...")
wb.save(FILE_PATH)
print(">>> HOÀN TẤT: ĐÃ XÓA 100% TESTER DƯ THỪA! <<<")
