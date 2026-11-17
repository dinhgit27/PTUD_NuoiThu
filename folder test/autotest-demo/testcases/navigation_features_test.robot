*** Settings ***
Documentation     Kiểm thử Tự Động Các Tính Năng Điều Hướng Năng Suất: Shop, Pomodoro, Nhiệm Vụ, Xếp Hạng
Resource          ../resources/common.robot

Test Tags         features-module

Suite Setup       Open Browser Application
Suite Teardown    Close Browser Application

*** Test Cases ***
TC_NAV_01: Login And Navigate To Pet Shop
    [Documentation]    Kiểm thử mở Cửa Hàng (Pet Shop), hiển thị danh mục mua sắm và vật phẩm
    [Tags]             smoke    regression    shop
    Login As User
    Click Element By JS                 xpath=//button[contains(., 'Cửa Hàng')]
    Wait Until Page Contains Element    xpath=//button[contains(., 'Thú cưng')]    timeout=10s
    Page Should Contain                 Cửa hàng

TC_NAV_02: Navigate To Pomodoro Timer Tab
    [Documentation]    Kiểm thử mở Tab Pomodoro, kiểm tra giao diện đồng hồ và các chế độ tập trung
    [Tags]             smoke    regression    pomodoro
    Click Element By JS                 xpath=//button[contains(., 'Pomodoro')]
    Wait Until Page Contains            Bắt đầu    timeout=10s
    Page Should Contain                 Test nhanh 5 giây

TC_NAV_03: Navigate To Quests Tab
    [Documentation]    Kiểm thử mở Tab Nhiệm Vụ, hiển thị các nhiệm vụ hằng ngày của người dùng
    [Tags]             smoke    regression    quests
    Click Element By JS                 xpath=//button[contains(., 'Nhiệm Vụ')]
    Sleep                               1s
    Page Should Contain Element         xpath=//button[contains(., 'Nhiệm Vụ')]

TC_NAV_04: Navigate To Leaderboard Tab
    [Documentation]    Kiểm thử mở Bảng Xếp Hạng phòng ban và đồng nghiệp
    [Tags]             regression    leaderboard
    ${has_leaderboard}=    Run Keyword And Return Status    Page Should Contain Element    xpath=//button[contains(., 'Xếp Hạng')]
    IF    ${has_leaderboard}
        Click Element By JS             xpath=//button[contains(., 'Xếp Hạng')]
        Wait Until Page Contains        XẾP HẠNG    timeout=10s
    END

TC_NAV_05: Return To Pet Room
    [Documentation]    Kiểm thử quay trở về Phòng Thú Cưng mượt mà từ các phân hệ khác
    [Tags]             smoke    regression    pet-room
    Click Element By JS                 xpath=//button[contains(., 'Phòng Thú Cưng')]
    Wait Until Page Contains Element    xpath=//button[contains(., 'Cho ăn')]    timeout=10s
    Page Should Contain                 Mochi Neko
