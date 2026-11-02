*** Settings ***
Documentation     File chứa các từ khóa dùng chung (Global Keywords) cho toàn dự án OfficePet
Library           SeleniumLibrary

*** Variables ***
${URL}                   http://localhost:5173/
${BROWSER}               Chrome
${DEFAULT_TIMEOUT}       8s
${SELENIUM_SPEED}        0.02s

# Tài khoản kiểm thử chuẩn trong hệ thống OfficePet
${ADMIN_EMAIL}           admin@techcorp.com
${ADMIN_PASSWORD}        Admin@123

${USER_EMAIL}            hung@techcorp.com
${USER_PASSWORD}         User@123

${INVALID_EMAIL}         khongtontai@officepet.vn
${INVALID_PASSWORD}      WrongPassword@999

*** Keywords ***
Mở Trình Duyệt Và Truy Cập OfficePet
    ${options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${options}    add_argument    --headless\=new
    Call Method    ${options}    add_argument    --disable-features\=CalculateNativeWinOcclusion
    Call Method    ${options}    add_argument    --disable-backgrounding-occluded-windows
    Call Method    ${options}    add_argument    --disable-gpu
    Call Method    ${options}    add_argument    --no-sandbox
    Call Method    ${options}    add_argument    --window-size\=1920,1080
    Open Browser    ${URL}    ${BROWSER}    options=${options}
    Maximize Browser Window
    Set Selenium Speed    ${SELENIUM_SPEED}
    Set Selenium Timeout    ${DEFAULT_TIMEOUT}

Đóng Trình Duyệt
    Close All Browsers

Click Safely
    [Arguments]    ${locator}
    Wait Until Page Contains Element    ${locator}    timeout=${DEFAULT_TIMEOUT}
    ${elem}=       Get WebElement       ${locator}
    Execute Javascript    arguments[0].scrollIntoView({block: 'center', inline: 'center'}); arguments[0].click();    ARGUMENTS    ${elem}
    Sleep          0.15s

Đảm Bảo Mở Modal Đăng Nhập
    ${is_modal_visible}=    Run Keyword And Return Status    Page Should Contain Element    id=auth-email
    IF    not ${is_modal_visible}
        Wait Until Page Contains Element    xpath=//button[contains(., 'Đăng nhập')]    timeout=${DEFAULT_TIMEOUT}
        Click Safely    xpath=//button[contains(., 'Đăng nhập')]
        Wait Until Page Contains Element    id=auth-email    timeout=${DEFAULT_TIMEOUT}
    END

Đăng Nhập Thành Công
    [Arguments]    ${email}    ${password}
    Đảm Bảo Mở Modal Đăng Nhập
    Wait Until Page Contains Element    id=auth-email       timeout=${DEFAULT_TIMEOUT}
    Clear Element Text                  id=auth-email
    Input Text                          id=auth-email       ${email}
    Clear Element Text                  id=auth-password
    Input Text                          id=auth-password    ${password}
    Click Safely                        xpath=//button[@type='submit']
    Wait Until Page Contains Element    xpath=//button[contains(., 'Thoát')]    timeout=${DEFAULT_TIMEOUT}

# Tương thích ngược với các tên gọi khóa cũ của cô giáo
Open Browser Application
    [Arguments]    ${url}=${URL}
    Mở Trình Duyệt Và Truy Cập OfficePet

Close Browser Application
    Đóng Trình Duyệt
