*** Settings ***
Documentation     Module 02: Kiểm thử Tự Động Tính Năng Nuôi & Tương Tác Thú Cưng (OfficePet Pet Care)
Resource          ../resources/common.robot

Test Tags         pet-care-module

Suite Setup       Open Browser Application
Suite Teardown    Close Browser Application

*** Test Cases ***
TC_PET_01: Login And Verify Pet Room Loaded
    [Documentation]    Xác thực người dùng vào Phòng Thú Cưng hiển thị tên thú cưng, chỉ số và bảng tương tác
    [Tags]             smoke    regression    pet-room
    Login As User
    Wait Until Page Contains Element    xpath=//button[contains(., 'Phòng Thú Cưng')]    timeout=10s
    Page Should Contain                 Mochi Neko
    Page Should Contain                 Bể chứa EXP
    Page Should Contain                 Hành động & Biểu cảm

TC_PET_02: Feed Pet Action Should Update State
    [Documentation]    Kiểm thử hành động Cho ăn (EATING), kích hoạt hoạt ảnh và cập nhật trạng thái
    [Tags]             smoke    regression    care-actions
    Click Element By JS                 xpath=//button[contains(., 'Cho ăn')]
    Sleep                               1s
    Page Should Contain Element         xpath=//strong[contains(., 'Ăn') or contains(., 'EATING')]

TC_PET_03: Drink Water Action Should Update State
    [Documentation]    Kiểm thử hành động Cho uống nước (DRINKING) tách bạch theo chuẩn hoạt ảnh
    [Tags]             smoke    regression    care-actions
    Click Element By JS                 xpath=//button[contains(., 'Uống nước')]
    Sleep                               1s
    Page Should Contain Element         xpath=//strong[contains(., 'Uống') or contains(., 'DRINKING')]

TC_PET_04: Put Pet To Sleep And Wake Up Actions
    [Documentation]    Kiểm thử hành động Cho thú cưng Đi ngủ (SLEEPING) và Thức dậy (WAKING_UP)
    [Tags]             regression    care-actions
    Click Element By JS                 xpath=//button[contains(., 'Đi ngủ')]
    Sleep                               1s
    Page Should Contain Element         xpath=//strong[contains(., 'Ngủ') or contains(., 'SLEEPING')]
    # Thức dậy
    Click Element By JS                 xpath=//button[contains(., 'Thức dậy')]
    Sleep                               1s
    Page Should Contain Element         xpath=//strong[contains(., 'Thức dậy') or contains(., 'WAKING_UP') or contains(., 'Đứng yên')]

TC_PET_05: Switch Pet Room Themes
    [Documentation]    Kiểm thử chuyển đổi giao diện bối cảnh phòng (Quán Cafe, Vườn Xuân, Bãi Biển...)
    [Tags]             regression    pet-theme
    Click Element By JS                 xpath=//button[contains(., 'Quán Cafe')]
    Sleep                               0.5s
    Click Element By JS                 xpath=//button[contains(., 'Vườn Xuân')]
    Sleep                               0.5s
    Click Element By JS                 xpath=//button[contains(., 'Bãi Biển')]
    Sleep                               0.5s

TC_PET_06: Change Pet Display Scale
    [Documentation]    Kiểm thử điều chỉnh kích thước phóng to / thu nhỏ thú cưng (Nhỏ, Vừa, To)
    [Tags]             regression    pet-scale
    Click Element By JS                 xpath=//button[contains(., 'Nhỏ')]
    Sleep                               0.5s
    Click Element By JS                 xpath=//button[contains(., 'To')]
    Sleep                               0.5s
    Click Element By JS                 xpath=//button[contains(., 'Vừa')]
    Sleep                               0.5s
