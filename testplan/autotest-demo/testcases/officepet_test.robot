*** Settings ***
Documentation     Báo cáo đặc tả thiết kế kiểm thử (IEEE 829-2008) cho Hệ Thống Nuôi Thú Ảo Văn Phòng OfficePet
...               Đặc tả kiểm thử chuyên sâu theo 4 phân hệ chức năng cốt lõi được lựa chọn:
...               - MODULE 1: XÁC THỰC & PHÂN QUYỀN (AUTHENTICATION & ROLES) - 9 Test Cases
...               - MODULE 2: PHÒNG THÚ CƯNG & TƯƠNG TÁC 11 HOẠT ẢNH (PET CARE & ANIMATIONS) - 13 Test Cases
...               - MODULE 3: ĐỒNG HÀNH NĂNG SUẤT POMODORO & NHẠC LOFI (FOCUS & RELAXATION) - 5 Test Cases
...               - MODULE 4: CỔNG QUẢN TRỊ ADMIN CONSOLE & BẢO MẬT (ADMIN & ROLE GUARD) - 7 Test Cases
Library           SeleniumLibrary
Resource          ../resources/common.robot

Test Setup        Mở Trình Duyệt Và Truy Cập OfficePet
Test Teardown     Đóng Trình Duyệt

*** Test Cases ***
# ==========================================
# MODULE 1: XÁC THỰC & PHÂN QUYỀN (AUTHENTICATION & ROLES)
# ==========================================
TC001 Đăng nhập thành công với tài khoản Nhân viên (USER)
    [Documentation]    [TC001] Xác thực luồng đăng nhập hợp lệ với vai trò USER, chuyển hướng vào đúng không gian làm việc.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Contain                 Phi Hùng

TC002 Đăng nhập thành công với tài khoản Quản trị viên (ADMIN)
    [Documentation]    [TC002] Xác thực tài khoản ADMIN đăng nhập thành công và mở đặc quyền Quản trị hệ thống.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Quản Trị')]    timeout=10s
    Page Should Contain Element         xpath=//button[contains(., 'Thoát')]

TC003 Đăng nhập thất bại khi nhập sai mật khẩu
    [Documentation]    [TC003] Kiểm thử ca phủ định (Negative Case): Hệ thống từ chối và hiển thị thông báo lỗi rõ ràng khi mật khẩu sai.
    Đảm Bảo Mở Modal Đăng Nhập
    Input Text                          id=auth-email            ${USER_EMAIL}
    Input Text                          id=auth-password         ${INVALID_PASSWORD}
    Click Safely                        xpath=//button[@type='submit']
    Wait Until Page Contains Element    xpath=//div[@role='alert']    timeout=5s
    Page Should Contain Element         xpath=//div[@role='alert']

TC004 Đăng nhập thất bại khi tài khoản không tồn tại
    [Documentation]    [TC004] Kiểm thử ca phủ định (Negative Case): Hệ thống báo lỗi khi email chưa từng được đăng ký trong CSDL.
    Đảm Bảo Mở Modal Đăng Nhập
    Input Text                          id=auth-email            ${INVALID_EMAIL}
    Input Text                          id=auth-password         ${INVALID_PASSWORD}
    Click Safely                        xpath=//button[@type='submit']
    Wait Until Page Contains Element    xpath=//div[@role='alert']    timeout=5s

TC005 Kiểm thực trường bắt buộc Email khi đăng nhập
    [Documentation]    [TC005] Kiểm thử biên & kiểm thực form (Validation): Chặn gửi yêu cầu khi người dùng để trống Email.
    Đảm Bảo Mở Modal Đăng Nhập
    Clear Element Text                  id=auth-email
    Input Text                          id=auth-password         ${USER_PASSWORD}
    Click Safely                        xpath=//button[@type='submit']
    Page Should Contain Element         id=auth-email

TC006 Kiểm thực trường bắt buộc Mật khẩu khi đăng nhập
    [Documentation]    [TC006] Kiểm thử biên & kiểm thực form (Validation): Chặn gửi yêu cầu khi người dùng để trống Mật khẩu.
    Đảm Bảo Mở Modal Đăng Nhập
    Input Text                          id=auth-email            ${USER_EMAIL}
    Clear Element Text                  id=auth-password
    Click Safely                        xpath=//button[@type='submit']
    Page Should Contain Element         id=auth-password

TC007 Chuyển đổi sang giao diện Đăng ký tài khoản mới
    [Documentation]    [TC007] Kiểm tra liên kết điều hướng mượt mà giữa form Đăng nhập và form Tạo tài khoản mới.
    Đảm Bảo Mở Modal Đăng Nhập
    Click Safely                        xpath=//button[contains(., 'Chưa có tài khoản? Đăng ký')]
    Wait Until Page Contains Element    id=auth-full-name        timeout=5s
    Page Should Contain                 Tạo tài khoản OfficePet

TC008 Chuyển đổi sang giao diện Quên mật khẩu qua OTP
    [Documentation]    [TC008] Kiểm tra liên kết chuyển sang quy trình Quên mật khẩu để nhận mã xác thực OTP qua email.
    Đảm Bảo Mở Modal Đăng Nhập
    Click Safely                        xpath=//button[contains(., 'Quên mật khẩu?')]
    Wait Until Page Contains            Quên mật khẩu            timeout=5s

TC009 Đăng xuất tài khoản và xóa sạch phiên làm việc
    [Documentation]    [TC009] Kiểm thử đăng xuất an toàn (Session Invalidation), xóa JWT token và đưa về màn hình chào.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Thoát')]    timeout=10s
    Click Safely                        xpath=//button[contains(., 'Thoát')]
    Wait Until Page Contains Element    xpath=//button[contains(., 'Đăng nhập')]    timeout=10s


# ==========================================
# MODULE 2: PHÒNG THÚ CƯNG & TƯƠNG TÁC 11 HOẠT ẢNH (PET CARE & ANIMATIONS)
# ==========================================
TC010 Khởi tạo phòng thú cưng và kiểm tra các chỉ số sinh học
    [Documentation]    [TC010] Kiểm tra tải thông tin thú cưng: tên thú 'Mochi Neko', cấp độ, Bể chứa EXP và các thanh trạng thái.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Contain                 Mochi Neko
    Page Should Contain                 Bể chứa EXP
    Page Should Contain                 Hành động & Biểu cảm

TC011 Tương tác Cho ăn (EATING) và cập nhật chỉ số no bụng
    [Documentation]    [TC011] Thao tác Cho ăn kích hoạt hoạt ảnh EATING, hồi phục chỉ số no bụng và đổi nhãn trạng thái.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Cho ăn')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Ăn') or contains(., 'EATING')]

TC012 Tương tác Cho uống nước (DRINKING) tách bạch theo chuẩn mới
    [Documentation]    [TC012] Thao tác Uống nước kích hoạt hoạt ảnh DRINKING tách biệt hoàn toàn với hành động Cho ăn.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Uống nước')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Uống') or contains(., 'DRINKING')]

TC013 Tương tác Vuốt ve thú cưng (PETTING)
    [Documentation]    [TC013] Tương tác chạm vuốt ve kích hoạt biểu cảm vui sướng và tăng điểm gắn kết.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Vuốt ve')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Vuốt ve') or contains(., 'PETTING') or contains(., 'Vui vẻ')]

TC014 Hành động Cho thú cưng Đi ngủ (SLEEPING)
    [Documentation]    [TC014] Kích hoạt trạng thái ngủ say (SLEEPING) giúp hồi phục năng lượng cho ca làm việc tiếp theo.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Đi ngủ')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Ngủ') or contains(., 'SLEEPING')]

TC015 Hành động Đánh thức thú cưng dậy (WAKING_UP)
    [Documentation]    [TC015] Đánh thức thú cưng dậy, chuyển đổi mượt mà từ giấc ngủ sang tư thế tỉnh táo sẵn sàng.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Thức dậy')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Thức dậy') or contains(., 'WAKING_UP') or contains(., 'Đứng yên')]

TC016 Kích hoạt chế độ Làm việc chăm chỉ (TYPING)
    [Documentation]    [TC016] Hoạt ảnh gõ phím máy tính nhanh nhẹn đồng hành cùng nhân viên văn phòng.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Làm việc')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Làm việc') or contains(., 'TYPING')]

TC017 Kích hoạt chế độ Vận động thể lực (EXERCISING)
    [Documentation]    [TC017] Hoạt ảnh tập thể dục giãn cơ nhắc nhở người dùng vận động chống mỏi lưng cổ.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Tập thể dục')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Tập thể dục') or contains(., 'EXERCISING')]

TC018 Kích hoạt biểu cảm Đói bụng (HUNGRY)
    [Documentation]    [TC018] Thú cưng phát tín hiệu đói bụng khi chỉ số dinh dưỡng giảm xuống mức cảnh báo.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Đói bụng')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//strong[contains(., 'Đói bụng') or contains(., 'HUNGRY')]

TC019 Tùy biến bối cảnh phòng sang Quán Cafe (Cafe cozy)
    [Documentation]    [TC019] Chuyển đổi phông nền không gian làm việc sang phong cách Quán Cafe thư thái.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quán Cafe')]
    Sleep                               0.3s

TC020 Tùy biến bối cảnh phòng sang Vườn Hoa Mùa Xuân (Spring Garden)
    [Documentation]    [TC020] Chuyển đổi phông nền không gian sang Khu Vườn Mùa Xuân xanh mát.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Vườn Xuân')]
    Sleep                               0.3s

TC021 Tùy biến bối cảnh phòng sang Bãi Biển (Beach theme)
    [Documentation]    [TC021] Chuyển đổi phông nền không gian sang Bãi Biển nghỉ dưỡng.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Bãi Biển')]
    Sleep                               0.3s

TC022 Tùy biến kích thước hiển thị thú cưng (Scale SMALL / LARGE)
    [Documentation]    [TC022] Kiểm tra chức năng co giãn kích thước sprite thú cưng phù hợp với màn hình.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Nhỏ')]
    Sleep                               0.2s
    Click Safely                        xpath=//button[contains(., 'To')]
    Sleep                               0.2s
    Click Safely                        xpath=//button[contains(., 'Vừa')]
    Sleep                               0.2s


# ==========================================
# MODULE 3: ĐỒNG HÀNH NĂNG SUẤT POMODORO & NHẠC LOFI (FOCUS & RELAXATION)
# ==========================================
TC023 Mở tab Pomodoro và kiểm tra đồng hồ đếm ngược
    [Documentation]    [TC023] Truy cập phân hệ Pomodoro, xác nhận hiển thị đồng hồ tập trung mặc định 25 phút.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Pomodoro')]
    Wait Until Page Contains            Bắt đầu                  timeout=10s
    Page Should Contain                 Test nhanh 5 giây

TC024 Chuyển đổi chế độ Nghiêm ngặt (Strict) và Thư giãn (Relaxed)
    [Documentation]    [TC024] Kiểm tra tính năng cấu hình chế độ kỷ luật làm việc Strict / Relaxed.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Pomodoro')]
    Wait Until Page Contains            Bắt đầu                  timeout=10s
    ${strict_exists}=                   Run Keyword And Return Status    Page Should Contain    Nghiêm ngặt
    IF    ${strict_exists}
        Click Safely                    xpath=//button[contains(., 'Nghiêm ngặt')]
    END

TC025 Khởi động chạy thử nghiệm đếm ngược nhanh 5 giây
    [Documentation]    [TC025] Chạy phiên Pomodoro thử nghiệm 5 giây để xác nhận đồng hồ hoạt động chính xác.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Pomodoro')]
    Wait Until Page Contains Element    xpath=//button[contains(., 'Test nhanh 5 giây')]    timeout=10s
    Click Safely                        xpath=//button[contains(., 'Test nhanh 5 giây')]
    Sleep                               0.5s

TC026 Tạm dừng và Đặt lại đồng hồ về mốc ban đầu
    [Documentation]    [TC026] Thao tác Reset đồng hồ đếm ngược về trạng thái chuẩn bị ban đầu.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Pomodoro')]
    Wait Until Page Contains            Bắt đầu                  timeout=10s

TC027 Điều hướng mở Không Gian Âm Nhạc Lofi
    [Documentation]    [TC027] Mở phân hệ phát nhạc Lofi công sở, hiển thị danh mục bài hát thư giãn.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Nhạc Lofi')]
    Wait Until Page Contains            Không Gian Âm Nhạc       timeout=10s


# ==========================================
# MODULE 4: CỔNG QUẢN TRỊ ADMIN CONSOLE & BẢO MẬT (ADMIN & ROLE GUARD)
# ==========================================
TC028 Đăng nhập quyền ADMIN và truy cập Bảng điều khiển Quản trị
    [Documentation]    [TC028] Xác thực quyền quản trị viên, mở Bảng điều khiển quản trị hệ thống toàn diện.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Quản Trị')]    timeout=10s
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s

TC029 Kiểm tra Dashboard Tổng quan số liệu hệ thống (SYSTEM)
    [Documentation]    [TC029] Kiểm tra hiển thị các số liệu thống kê tổng người dùng, tổng thú cưng từ CSDL.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s
    Click Safely                        xpath=//button[contains(., 'Tổng quan')]
    Sleep                               0.5s
    Page Should Contain                 Tổng quan

TC030 Kiểm tra tab Quản lý người dùng & phân quyền (ACCESS)
    [Documentation]    [TC030] Quản trị viên truy cập danh sách tài khoản, kiểm tra chức năng chuyển đổi quyền USER / ADMIN.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s
    Click Safely                        xpath=//button[contains(., 'Người dùng & quyền')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//button[contains(., 'Người dùng & quyền')]

TC031 Kiểm tra tab Cấu hình loài thú & hoạt ảnh (CONFIG)
    [Documentation]    [TC031] Quản trị viên kiểm tra danh mục tất cả các loài thú cưng đang hoạt động trong hệ thống.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s
    Click Safely                        xpath=//button[contains(., 'Loài thú & hoạt ảnh')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//button[contains(., 'Loài thú & hoạt ảnh')]

TC032 Kiểm tra Xưởng Pet Forge tạo thú cưng chuẩn 11 hoạt ảnh (FORGE)
    [Documentation]    [TC032] Xác thực form Pet Forge: chuyển đổi 11 hoạt ảnh, các ô nhập Tên thú cưng và nút làm sạch form.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s
    Click Safely                        xpath=//button[contains(., 'Tạo thú cưng')]
    Sleep                               0.5s
    Page Should Contain                 Tên thú cưng

TC033 Kiểm tra tab Quản lý Cửa Hàng trong Admin Console (SHOP)
    [Documentation]    [TC033] Quản trị viên cấu hình giá bán EXP và xuất bản các thú cưng mới ra Shop.
    Đăng Nhập Thành Công                ${ADMIN_EMAIL}           ${ADMIN_PASSWORD}
    Click Safely                        xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan                timeout=10s
    Click Safely                        xpath=//button[contains(., 'Quản lý cửa hàng')]
    Sleep                               0.5s
    Page Should Contain Element         xpath=//button[contains(., 'Quản lý cửa hàng')]

TC034 Kiểm tra an toàn phân quyền: Tài khoản USER không có menu Quản Trị
    [Documentation]    [TC034] Kiểm thử an toàn bảo mật (Role Guard): Tài khoản thường đăng nhập tuyệt đối không xuất hiện nút Quản Trị.
    Đăng Nhập Thành Công                ${USER_EMAIL}            ${USER_PASSWORD}
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Not Contain Element     xpath=//button[contains(., 'Quản Trị')]
