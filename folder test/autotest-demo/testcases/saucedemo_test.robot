*** Settings ***
Documentation     Báo cáo đặc tả thiết kế kiểm thử (IEEE 829-2008) cho SauceDemo
...               Bao gồm 19 Test Cases phân bổ ở 4 module: Login, Catalog, Cart, Checkout.
Library           SeleniumLibrary
Test Setup        Mở Trình Duyệt Và Truy Cập SauceDemo
Test Teardown     Đóng Trình Duyệt

*** Variables ***
${URL}                  https://www.saucedemo.com/
${BROWSER}              Chrome
${STANDARD_USER}        standard_user
${LOCKED_OUT_USER}      locked_out_user
${PROBLEM_USER}         problem_user
${VALID_PASSWORD}       secret_sauce

# Các locator dùng chung
${USERNAME_INPUT}       id=user-name
${PASSWORD_INPUT}       id=password
${LOGIN_BTN}            id=login-button
${ERROR_MESSAGE_H3}     css=h3[data-test="error"]
${INVENTORY_CONTAINER}  id=inventory_container
${SHOPPING_CART_LINK}   css=a.shopping_cart_link
${SHOPPING_CART_BADGE}  css=.shopping_cart_badge

*** Keywords ***
Mở Trình Duyệt Và Truy Cập SauceDemo
    ${options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${options}    add_argument    --disable-features\=CalculateNativeWinOcclusion
    Call Method    ${options}    add_argument    --disable-backgrounding-occluded-windows
    Call Method    ${options}    add_argument    --disable-gpu
    Call Method    ${options}    add_argument    --no-sandbox
    Call Method    ${options}    add_argument    --window-size\=1920,1080
    Open Browser    ${URL}    ${BROWSER}    options=${options}
    Maximize Browser Window
    Set Selenium Speed    0.1s
    Wait Until Page Contains Element    ${USERNAME_INPUT}    timeout=10s

Đóng Trình Duyệt
    Close All Browsers

Click Safely
    [Arguments]    ${locator}
    Wait Until Element Is Visible    ${locator}    timeout=10s
    ${elem}=       Get WebElement    ${locator}
    Execute Javascript    arguments[0].click();    ARGUMENTS    ${elem}

Đăng Nhập Thành Công
    [Arguments]    ${username}    ${password}
    Wait Until Element Is Visible       ${USERNAME_INPUT}        timeout=10s
    Input Text                          ${USERNAME_INPUT}        ${username}
    Input Text                          ${PASSWORD_INPUT}        ${password}
    Click Safely                        ${LOGIN_BTN}
    Wait Until Location Contains        /inventory.html          timeout=10s
    Wait Until Page Contains Element    ${INVENTORY_CONTAINER}   timeout=10s
    Wait Until Element Is Visible       css=.inventory_item      timeout=10s

Mở Trang Giỏ Hàng
    Click Safely                        ${SHOPPING_CART_LINK}
    Wait Until Location Contains        /cart.html               timeout=10s

Thêm Sản Phẩm Vào Giỏ
    [Arguments]    ${add_btn_id}        ${remove_btn_id}
    Click Safely                        id=${add_btn_id}
    Wait Until Page Contains Element    id=${remove_btn_id}      timeout=10s

*** Test Cases ***
# ==========================================
# MODULE 1: XÁC THỰC (AUTHENTICATION)
# ==========================================
TC001 Đăng nhập thành công với tài khoản chuẩn
    [Documentation]    [TC001] Kiểm thử đăng nhập thành công với tài khoản chuẩn standard_user.
    Wait Until Element Is Visible       ${USERNAME_INPUT}        timeout=10s
    Input Text                          ${USERNAME_INPUT}        ${STANDARD_USER}
    Input Text                          ${PASSWORD_INPUT}        ${VALID_PASSWORD}
    Click Safely                        ${LOGIN_BTN}
    # Xác minh chuyển hướng thành công
    Wait Until Location Contains        /inventory.html          timeout=10s
    Wait Until Page Contains Element    ${INVENTORY_CONTAINER}   timeout=10s
    Page Should Contain Element         ${SHOPPING_CART_LINK}

TC002 Đăng nhập thất bại với tài khoản bị khóa
    [Documentation]    [TC002] Hệ thống từ chối đăng nhập và hiển thị cảnh báo khi tài khoản bị khóa.
    Wait Until Element Is Visible       ${USERNAME_INPUT}        timeout=10s
    Input Text                          ${USERNAME_INPUT}        ${LOCKED_OUT_USER}
    Input Text                          ${PASSWORD_INPUT}        ${VALID_PASSWORD}
    Click Safely                        ${LOGIN_BTN}
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}      timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Epic sadface: Sorry, this user has been locked out.

TC003 Đăng nhập thất bại khi nhập sai mật khẩu
    [Documentation]    [TC003] Kiểm tra hệ thống báo lỗi khi người dùng nhập sai mật khẩu.
    Wait Until Element Is Visible       ${USERNAME_INPUT}        timeout=10s
    Input Text                          ${USERNAME_INPUT}        ${STANDARD_USER}
    Input Text                          ${PASSWORD_INPUT}        wrong_password_123
    Click Safely                        ${LOGIN_BTN}
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}      timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Epic sadface: Username and password do not match any user in this service

TC004 Đăng nhập khi để trống trường Tên đăng nhập
    [Documentation]    [TC004] Kiểm tra xác thực trường bắt buộc Username.
    Wait Until Element Is Visible       ${PASSWORD_INPUT}        timeout=10s
    Input Text                          ${PASSWORD_INPUT}        ${VALID_PASSWORD}
    Click Safely                        ${LOGIN_BTN}
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}      timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Epic sadface: Username is required

TC005 Đăng nhập khi để trống trường Mật khẩu
    [Documentation]    [TC005] Kiểm tra xác thực trường bắt buộc Password.
    Wait Until Element Is Visible       ${USERNAME_INPUT}        timeout=10s
    Input Text                          ${USERNAME_INPUT}        ${STANDARD_USER}
    Click Safely                        ${LOGIN_BTN}
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}      timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Epic sadface: Password is required

# ==========================================
# MODULE 2: DANH MỤC (PRODUCT CATALOG)
# ==========================================
TC006 Hiển thị đầy đủ danh mục 6 sản phẩm và chi tiết
    [Documentation]    [TC006] Đảm bảo trang inventory hiển thị chính xác toàn bộ 6 sản phẩm.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Wait Until Page Contains Element    css=.inventory_item      timeout=10s
    ${item_count}=                      Get Element Count        css=.inventory_item
    Should Be Equal As Integers         ${item_count}            6
    Page Should Contain                 Sauce Labs Backpack
    Page Should Contain                 $29.99

TC007 Sắp xếp danh mục sản phẩm theo tên (A đến Z)
    [Documentation]    [TC007] Kiểm tra sắp xếp sản phẩm tăng dần từ A đến Z.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Wait Until Element Is Visible       css=.product_sort_container    timeout=10s
    Select From List By Value           css=.product_sort_container    az
    Wait Until Element Is Visible       css=.inventory_item:nth-child(1) .inventory_item_name    timeout=10s
    ${first_item}=                      Get Text                 css=.inventory_item:nth-child(1) .inventory_item_name
    Should Be Equal As Strings          ${first_item}            Sauce Labs Backpack

TC008 Sắp xếp danh mục sản phẩm theo tên (Z đến A)
    [Documentation]    [TC008] Kiểm tra sắp xếp sản phẩm giảm dần từ Z đến A.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Wait Until Element Is Visible       css=.product_sort_container    timeout=10s
    Select From List By Value           css=.product_sort_container    za
    Wait Until Element Is Visible       css=.inventory_item:nth-child(1) .inventory_item_name    timeout=10s
    ${first_item}=                      Get Text                 css=.inventory_item:nth-child(1) .inventory_item_name
    Should Be Equal As Strings          ${first_item}            Test.allTheThings() T-Shirt (Red)

TC009 Sắp xếp danh mục sản phẩm theo giá (Thấp đến Cao)
    [Documentation]    [TC009] Kiểm tra sắp xếp sản phẩm theo giá bán tăng dần.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Wait Until Element Is Visible       css=.product_sort_container    timeout=10s
    Select From List By Value           css=.product_sort_container    lohi
    Wait Until Element Is Visible       css=.inventory_item:nth-child(1) .inventory_item_price    timeout=10s
    ${first_price}=                     Get Text                 css=.inventory_item:nth-child(1) .inventory_item_price
    Should Be Equal As Strings          ${first_price}           $7.99

TC010 Sắp xếp danh mục sản phẩm theo giá (Cao xuống Thấp)
    [Documentation]    [TC010] Kiểm tra sắp xếp sản phẩm theo giá bán giảm dần.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Wait Until Element Is Visible       css=.product_sort_container    timeout=10s
    Select From List By Value           css=.product_sort_container    hilo
    Wait Until Element Is Visible       css=.inventory_item:nth-child(1) .inventory_item_price    timeout=10s
    ${first_price}=                     Get Text                 css=.inventory_item:nth-child(1) .inventory_item_price
    Should Be Equal As Strings          ${first_price}           $49.99

# ==========================================
# MODULE 3: GIỎ HÀNG (SHOPPING CART)
# ==========================================
TC011 Thêm một sản phẩm vào giỏ hàng thành công
    [Documentation]    [TC011] Thêm sản phẩm và cập nhật huy hiệu số lượng trên header.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    # Kiểm tra huy hiệu (badge)
    Wait Until Element Is Visible       ${SHOPPING_CART_BADGE}   timeout=10s
    ${badge_text}=                      Get Text                 ${SHOPPING_CART_BADGE}
    Should Be Equal As Strings          ${badge_text}            1

TC012 Thêm nhiều sản phẩm và kiểm tra bộ đếm giỏ hàng
    [Documentation]    [TC012] Thêm liên tiếp 3 mặt hàng khác nhau vào giỏ.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-bike-light  remove-sauce-labs-bike-light
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-bolt-t-shirt    remove-sauce-labs-bolt-t-shirt
    Wait Until Element Is Visible       ${SHOPPING_CART_BADGE}   timeout=10s
    ${badge_text}=                      Get Text                 ${SHOPPING_CART_BADGE}
    Should Be Equal As Strings          ${badge_text}            3

TC013 Xóa sản phẩm khỏi giỏ hàng
    [Documentation]    [TC013] Xóa mặt hàng trực tiếp từ trang chi tiết giỏ hàng.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    # Xóa từ giỏ hàng
    Click Safely                        id=remove-sauce-labs-backpack
    Wait Until Page Does Not Contain Element  ${SHOPPING_CART_BADGE}          timeout=10s
    Page Should Not Contain Element     css=.cart_item

TC014 Tiếp tục mua sắm từ trang giỏ hàng
    [Documentation]    [TC014] Nút 'Continue Shopping' đưa người dùng quay lại trang danh mục.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Mở Trang Giỏ Hàng
    Click Safely                        id=continue-shopping
    Wait Until Location Contains        /inventory.html                       timeout=10s

# ==========================================
# MODULE 4: THANH TOÁN (CHECKOUT)
# ==========================================
TC015 Thanh toán Bước 1 khi bỏ trống First Name
    [Documentation]    [TC015] Báo lỗi khi người dùng không nhập Tên (First Name).
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    Click Safely                        id=checkout
    Wait Until Location Contains        /checkout-step-one.html               timeout=10s
    
    # Để trống First Name, điền các trường còn lại
    Wait Until Element Is Visible       id=last-name                          timeout=10s
    Input Text                          id=last-name             Nguyen
    Input Text                          id=postal-code           70000
    Click Safely                        id=continue
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}                   timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Error: First Name is required

TC016 Thanh toán Bước 1 khi bỏ trống Last Name
    [Documentation]    [TC016] Báo lỗi khi người dùng không nhập Họ (Last Name).
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    Click Safely                        id=checkout
    Wait Until Location Contains        /checkout-step-one.html               timeout=10s
    
    Wait Until Element Is Visible       id=first-name                         timeout=10s
    Input Text                          id=first-name            Dinh
    # Để trống Last Name
    Input Text                          id=postal-code           70000
    Click Safely                        id=continue
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}                   timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Error: Last Name is required

TC017 Thanh toán Bước 1 khi bỏ trống Postal Code
    [Documentation]    [TC017] Báo lỗi khi người dùng không nhập Mã bưu chính.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    Click Safely                        id=checkout
    Wait Until Location Contains        /checkout-step-one.html               timeout=10s
    
    Wait Until Element Is Visible       id=first-name                         timeout=10s
    Input Text                          id=first-name            Dinh
    Input Text                          id=last-name             Nguyen
    # Để trống Postal code
    Click Safely                        id=continue
    Wait Until Element Is Visible       ${ERROR_MESSAGE_H3}                   timeout=10s
    Element Text Should Be              ${ERROR_MESSAGE_H3}      Error: Postal Code is required

TC018 Hủy bỏ quy trình thanh toán tại Bước 1
    [Documentation]    [TC018] Kiểm tra nút 'Cancel' hủy thao tác và quay về giỏ hàng.
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    Click Safely                        id=checkout
    Wait Until Location Contains        /checkout-step-one.html               timeout=10s
    
    Click Safely                        id=cancel
    Wait Until Location Contains        /cart.html                            timeout=10s

TC019 Hoàn tất quy trình đặt hàng và thanh toán thành công
    [Documentation]    [TC019] Toàn trình quy trình thanh toán hợp lệ (E2E Workflow).
    Đăng Nhập Thành Công                ${STANDARD_USER}         ${VALID_PASSWORD}
    Thêm Sản Phẩm Vào Giỏ               add-to-cart-sauce-labs-backpack    remove-sauce-labs-backpack
    Mở Trang Giỏ Hàng
    Click Safely                        id=checkout
    Wait Until Location Contains        /checkout-step-one.html               timeout=10s
    
    # Nhập thông tin bước 1
    Wait Until Element Is Visible       id=first-name                         timeout=10s
    Input Text                          id=first-name            Dinh
    Input Text                          id=last-name             Nguyen
    Input Text                          id=postal-code           70000
    Click Safely                        id=continue
    
    # Kiểm tra thông tin bước 2
    Wait Until Location Contains        /checkout-step-two.html               timeout=10s
    Wait Until Page Contains            SauceCard #31337                      timeout=10s
    Page Should Contain                 Free Pony Express Delivery!
    Page Should Contain                 Item total: $29.99
    Page Should Contain                 Tax: $2.40
    Page Should Contain                 Total: $32.39
    
    # Hoàn tất thanh toán
    Click Safely                        id=finish
    Wait Until Location Contains        /checkout-complete.html               timeout=10s
    Wait Until Page Contains            Thank you for your order!             timeout=10s
    
    # Quay lại trang chủ và kiểm tra giỏ hàng rỗng
    Click Safely                        id=back-to-products
    Wait Until Location Contains        /inventory.html                       timeout=10s
    Wait Until Page Does Not Contain Element  ${SHOPPING_CART_BADGE}          timeout=10s