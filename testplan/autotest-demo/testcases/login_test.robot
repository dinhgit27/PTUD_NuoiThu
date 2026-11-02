*** Settings ***
Documentation     Module 01: Kiểm thử Tự Động Tính Năng Xác Thực & Phân Quyền Tài Khoản (OfficePet Auth)
Resource          ../resources/common.robot

Test Tags         auth-module

Test Setup        Open Browser Application
Test Teardown     Close Browser Application

*** Test Cases ***
TC_AUTH_01: Login With Valid User Credentials Should Succeed
    [Documentation]    Kiểm thử đăng nhập thành công với tài khoản Nhân viên (USER) và vào Không gian làm việc
    [Tags]             smoke    regression    user-login
    Input Login Credentials    ${USER_EMAIL}    ${USER_PASSWORD}
    Submit Login Form
    Wait Until Page Contains Element    xpath=//button[contains(., 'Thoát')]    timeout=10s
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Contain                 Phi Hùng

TC_AUTH_02: Login With Valid Admin Credentials Should Succeed
    [Documentation]    Kiểm thử đăng nhập thành công với tài khoản Quản trị viên (ADMIN) và mở quyền Quản trị
    [Tags]             smoke    regression    admin-login
    Input Login Credentials    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}
    Submit Login Form
    Wait Until Page Contains Element    xpath=//button[contains(., 'Thoát')]    timeout=10s
    Wait Until Page Contains Element    xpath=//button[contains(., 'Quản Trị')]    timeout=10s

TC_AUTH_03: Login With Invalid Password Should Fail
    [Documentation]    Kiểm thử đăng nhập thất bại khi nhập sai mật khẩu, hệ thống báo lỗi rõ ràng
    [Tags]             regression    negative-test
    Input Login Credentials    ${USER_EMAIL}    ${INVALID_PASSWORD}
    Submit Login Form
    Wait Until Page Contains Element    xpath=//div[@role='alert']    timeout=5s
    Page Should Contain Element         xpath=//div[@role='alert']

TC_AUTH_04: Login With Nonexistent Email Should Fail
    [Documentation]    Kiểm thử đăng nhập thất bại khi tài khoản không tồn tại trên hệ thống
    [Tags]             regression    negative-test
    Input Login Credentials    ${INVALID_EMAIL}    ${INVALID_PASSWORD}
    Submit Login Form
    Wait Until Page Contains Element    xpath=//div[@role='alert']    timeout=5s
    Page Should Contain Element         xpath=//div[@role='alert']

TC_AUTH_05: Logout Should Clear Session Successfully
    [Documentation]    Kiểm thử đăng xuất tài khoản thành công, phiên làm việc kết thúc và quay lại trạng thái khách
    [Tags]             smoke    regression    logout
    Login As User
    Logout Application
    Page Should Contain Element         xpath=//button[contains(., 'Đăng nhập')]
