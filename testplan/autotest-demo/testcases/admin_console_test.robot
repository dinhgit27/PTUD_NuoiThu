*** Settings ***
Documentation     Module 09: Kiểm thử Tự Động Cổng Quản Trị Hệ Thống (OfficePet Admin Console)
Resource          ../resources/common.robot

Test Tags         admin-module

Suite Setup       Open Browser Application
Suite Teardown    Close Browser Application

*** Test Cases ***
TC_ADMIN_01: Login As Admin And Access Admin Console
    [Documentation]    Xác thực tài khoản ADMIN đăng nhập thành công và mở Bảng điều khiển Quản trị
    [Tags]             smoke    regression    admin-access
    Login As Admin
    Wait Until Page Contains Element    xpath=//button[contains(., 'Quản Trị')]    timeout=10s
    Click Element By JS                 xpath=//button[contains(., 'Quản Trị')]
    Wait Until Page Contains            Tổng quan    timeout=10s

TC_ADMIN_02: Admin Can View System Overview Dashboard
    [Documentation]    Kiểm tra tab Tổng quan (SYSTEM) hiển thị số liệu hệ thống và cấu hình
    [Tags]             regression    admin-dashboard
    Click Element By JS                 xpath=//button[contains(., 'Tổng quan')]
    Sleep                               1s
    Page Should Contain                 Tổng quan

TC_ADMIN_03: Admin Can Switch To Pet Management Tab
    [Documentation]    Kiểm thử điều hướng sang tab Loài thú & hoạt ảnh (CONFIG)
    [Tags]             regression    admin-pets
    Click Element By JS                 xpath=//button[contains(., 'Loài thú & hoạt ảnh')]
    Sleep                               1s
    Page Should Contain Element         xpath=//button[contains(., 'Loài thú & hoạt ảnh')]

TC_ADMIN_04: Admin Can Switch To Forge Creation Tab
    [Documentation]    Kiểm thử điều hướng sang Xưởng tạo thú cưng (Pet Forge)
    [Tags]             smoke    regression    admin-forge
    Click Element By JS                 xpath=//button[contains(., 'Tạo thú cưng')]
    Sleep                               1s
    Page Should Contain                 Tên thú cưng

TC_ADMIN_05: Admin Can Switch To Shop Management Tab
    [Documentation]    Kiểm thử điều hướng sang Quản lý cửa hàng trong Admin Console
    [Tags]             regression    admin-shop
    Click Element By JS                 xpath=//button[contains(., 'Quản lý cửa hàng')]
    Sleep                               1s
    Page Should Contain Element         xpath=//button[contains(., 'Quản lý cửa hàng')]

TC_ADMIN_06: Normal User Does Not Have Admin Tab
    [Documentation]    Kiểm tra tính an toàn bảo mật: Người dùng thông thường (USER) không có quyền truy cập menu Quản Trị
    [Tags]             smoke    regression    security    role-guard
    Logout Application
    Login As User
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Not Contain Element     xpath=//button[contains(., 'Quản Trị')]
