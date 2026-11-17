# -*- coding: utf-8 -*-
"""
Script tạo file Excel Test Plan hoàn chỉnh:
- Font: Times New Roman 100% toàn bộ ô.
- Đầy đủ 3 Sheet: 
  1. Ke_Hoach_Kiem_Thu (Tổng quan kế hoạch kiểm thử)
  2. Danh_Sach_Test_Cases (Chi tiết kịch bản kiểm thử)
  3. Ma_Tran_Phu_Chuc_Nang (Ma trận bao phủ & Thống kê sẵn sàng)
- Căn chỉnh tự động độ cao hàng (row height) và độ rộng cột (column width) để KHÔNG BỊ CHE CHỮ.
- Tuyệt đối KHÔNG tạo dữ liệu ảo: Trạng thái 'Chưa kiểm thử', kết quả thực tế/ngày/tester/bug để trống.
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from test_cases_data import TEST_CASES_DATA

OUTPUT_DIR = r"c:\Users\PHI HUNG\Downloads\PTUD_NuoiThu\testplan"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "Ke_Hoach_Va_Kich_Ban_Kiem_Thu_OfficePet.xlsx")

os.makedirs(OUTPUT_DIR, exist_ok=True)

wb = openpyxl.Workbook()
wb.remove(wb.active)  # Xóa sheet mặc định

FONT_NAME = "Times New Roman"

# Định nghĩa các style font chuẩn Times New Roman
font_title = Font(name=FONT_NAME, size=16, bold=True, color="1B365D")
font_subtitle = Font(name=FONT_NAME, size=11, italic=True, color="5D6D7E")
font_sec = Font(name=FONT_NAME, size=12, bold=True, color="FFFFFF")
font_subsec = Font(name=FONT_NAME, size=11, bold=True, color="1B365D")
font_tbl_header = Font(name=FONT_NAME, size=11, bold=True, color="FFFFFF")
font_tbl_header_dark = Font(name=FONT_NAME, size=11, bold=True, color="1B365D")

font_body = Font(name=FONT_NAME, size=11, bold=False, color="2C3E50")
font_body_bold = Font(name=FONT_NAME, size=11, bold=True, color="2C3E50")
font_code = Font(name=FONT_NAME, size=11, bold=True, color="1B365D")
font_status_pending = Font(name=FONT_NAME, size=11, bold=True, color="5D6D7E")

# Font & Fill theo Mức độ ưu tiên
font_prio_critical = Font(name=FONT_NAME, size=11, bold=True, color="922B21")
fill_prio_critical = PatternFill(start_color="FDEDEC", end_color="FDEDEC", fill_type="solid")

font_prio_high = Font(name=FONT_NAME, size=11, bold=True, color="B9770E")
fill_prio_high = PatternFill(start_color="FEF9E7", end_color="FEF9E7", fill_type="solid")

font_prio_medium = Font(name=FONT_NAME, size=11, bold=True, color="1E8449")
fill_prio_medium = PatternFill(start_color="EAFAF1", end_color="EAFAF1", fill_type="solid")

font_prio_low = Font(name=FONT_NAME, size=11, bold=True, color="5D6D7E")
fill_prio_low = PatternFill(start_color="EAECEE", end_color="EAECEE", fill_type="solid")

# Fills chủ đạo
fill_navy = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
fill_slate = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
fill_blue_header = PatternFill(start_color="2980B9", end_color="2980B9", fill_type="solid")
fill_light_blue = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")
fill_row_alt = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
fill_pending_cell = PatternFill(start_color="F4F6F6", end_color="F4F6F6", fill_type="solid")
fill_total_row = PatternFill(start_color="EAEDED", end_color="EAEDED", fill_type="solid")

# Borders
border_thin_line = Side(border_style="thin", color="BDC3C7")
border_med_line = Side(border_style="medium", color="1B365D")
border_cell = Border(left=border_thin_line, right=border_thin_line, top=border_thin_line, bottom=border_thin_line)
border_header = Border(left=border_thin_line, right=border_thin_line, top=border_thin_line, bottom=border_med_line)
border_total = Border(left=border_thin_line, right=border_thin_line, top=border_med_line, bottom=Side(border_style="double", color="1B365D"))

# Alignments
align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
align_data_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
align_data_center = Alignment(horizontal="center", vertical="top", wrap_text=True)


# =============================================================================
# SHEET 1: KẾ HOẠCH KIỂM THỬ (TEST PLAN SPECIFICATION)
# =============================================================================
print("Đang tạo Sheet 1: 1. Ke_Hoach_Kiem_Thu...")
ws1 = wb.create_sheet(title="1. Ke_Hoach_Kiem_Thu")
ws1.views.sheetView[0].showGridLines = True

# Tiêu đề tài liệu
ws1.merge_cells("A1:H1")
ws1["A1"] = "KẾ HOẠCH KIỂM THỬ PHẦN MỀM TỔNG THỂ (MASTER TEST PLAN)"
ws1["A1"].font = font_title
ws1["A1"].alignment = align_center
ws1.row_dimensions[1].height = 34

ws1.merge_cells("A2:H2")
ws1["A2"] = "DỰ ÁN: HỆ THỐNG NUÔI THÚ CƯNG ẢO ĐỒNG HÀNH NĂNG SUẤT VĂN PHÒNG (OFFICEPET - PTUD_NUOITHU)"
ws1["A2"].font = font_subtitle
ws1["A2"].alignment = align_center
ws1.row_dimensions[2].height = 22

# Bảng thông tin dự án
meta_info = [
    ("Tên dự án:", "Hệ thống Nuôi Thú Cưng Văn Phòng (OfficePet)", "Mã dự án:", "PTUD_NuoiThu"),
    ("Phiên bản hệ thống:", "Release v1.0.0 (Chuẩn hóa 11 Hoạt ảnh Pet)", "Ngày lập kế hoạch:", "24/10/2026"),
    ("Môi trường áp dụng:", "Staging / QA Test Environment", "Trạng thái kiểm thử:", "Chưa bắt đầu thực thi (Sẵn sàng Test)"),
    ("Quy ước kết quả:", "Chưa có dữ liệu thực tế (Chưa chạy test - Không fake dữ liệu)", "Phạm vi kiểm thử:", "Toàn diện 100% 10 Phân hệ Chức năng & Phi chức năng")
]

for idx, item in enumerate(meta_info, start=4):
    ws1.row_dimensions[idx].height = 24
    ws1[f"A{idx}"] = item[0]
    ws1[f"A{idx}"].font = font_subsec
    ws1[f"A{idx}"].fill = fill_light_blue
    ws1[f"A{idx}"].border = border_cell
    ws1[f"A{idx}"].alignment = align_left

    ws1[f"B{idx}"] = item[1]
    ws1.merge_cells(f"B{idx}:D{idx}")
    ws1[f"B{idx}"].font = font_body_bold
    ws1[f"B{idx}"].border = border_cell
    ws1[f"B{idx}"].alignment = align_left

    ws1[f"E{idx}"] = item[2]
    ws1[f"E{idx}"].font = font_subsec
    ws1[f"E{idx}"].fill = fill_light_blue
    ws1[f"E{idx}"].border = border_cell
    ws1[f"E{idx}"].alignment = align_left

    ws1[f"F{idx}"] = item[3]
    ws1.merge_cells(f"F{idx}:H{idx}")
    ws1[f"F{idx}"].font = font_body
    ws1[f"F{idx}"].border = border_cell
    ws1[f"F{idx}"].alignment = align_left

sections_content = [
    (
        "I. MỤC TIÊU KIỂM THỬ (TEST OBJECTIVES)",
        [
            ("1. Đảm bảo chất lượng chức năng", "Xác nhận toàn bộ các chức năng từ Xác thực, Chăm sóc thú cưng 11 trạng thái, Pomodoro, Bài tập thở, Nhạc Lofi, Chatbot AI, Cửa hàng Shop, Kho đồ đến Admin Console hoạt động chính xác theo tài liệu thiết kế."),
            ("2. Kiểm định tính tương thích ngược", "Đảm bảo các con thú cũ (tạo theo chuẩn 17 hàng trước đây) và thú mới (chuẩn 11 hàng mới) đều hiển thị mượt mà, đúng tọa độ, cơ chế Fallback hoạt động hoàn hảo không bị lỗi hiển thị."),
            ("3. Kiểm định trải nghiệm & Giao diện", "Xác thực chất lượng hiển thị Canvas Pixel Art sắc nét, không bị nhòe, font chữ hiển thị chuẩn Unicode không lỗi dấu tiếng Việt, bố cục rõ ràng, không bị tràn màn hình hay che khuất nút chức năng."),
            ("4. Đảm bảo an toàn bảo mật & Phân quyền", "Xác thực cơ chế xác thực JWT, phân quyền chặt chẽ giữa Quản trị viên (ADMIN) và Nhân viên (USER), ngăn chặn truy cập trái phép vào các API cấu hình nhạy cảm và phòng chống lỗ hổng bảo mật XSS.")
        ]
    ),
    (
        "II. PHẠM VI KIỂM THỬ (TEST SCOPE)",
        [
            ("1. Trong phạm vi (In-Scope)", "Bao phủ đầy đủ 10 phân hệ nghiệp vụ:\n- Module 01: Xác thực & Quản lý Tài khoản (Auth & User Profile)\n- Module 02: Nuôi & Tương tác Thú Cưng 11 Hoạt Ảnh (Pet Care & Animations)\n- Module 03: Desktop Companion & Widget Picture-in-Picture (PiP)\n- Module 04: Đồng hành Năng suất Pomodoro, Bài tập thở & Nhạc Lofi\n- Module 05: Chatbot AI Trò chuyện Đồng hành (AI Companion Chat)\n- Module 06: Nhiệm vụ & Không gian Thi đua Phòng ban (Quests & Leaderboard)\n- Module 07: Khu vườn Cộng đồng & Hệ thống Bạn bè (Shared Garden & Friends)\n- Module 08: Cửa hàng Thú cưng, Trang phục & Kho đồ (Shop & Inventory)\n- Module 09: Cổng Quản trị Admin Toàn diện (Admin Console & Forge Tools)\n- Module 10: Phi chức năng, Bảo mật, Fallback Hoạt ảnh & Hiệu năng"),
            ("2. Ngoài phạm vi (Out-of-Scope)", "- Kiểm thử cổng thanh toán tiền mặt/ngân hàng thực tế (Hệ thống dùng điểm EXP/Coins nội bộ làm tiền tệ).\n- Kiểm thử thâm nhập hạ tầng vật lý của nhà cung cấp máy chủ đám mây.")
        ]
    ),
    (
        "III. MÔI TRƯỜNG & TÀI NGUYÊN KIỂM THỬ (TEST ENVIRONMENT & RESOURCES)",
        [
            ("1. Phần cứng & Hệ điều hành", "Hệ điều hành Windows 10 / Windows 11 (64-bit); Màn hình Full HD (1920x1080) và màn hình Laptop chuẩn (1366x768)."),
            ("2. Trình duyệt kiểm thử", "Google Chrome (v120 trở lên), Microsoft Edge (v120 trở lên), Mozilla Firefox (v120 trở lên)."),
            ("3. Kiến trúc Công nghệ", "Frontend: React 18, TypeScript, TailwindCSS, HTML5 Canvas API, Lucide Icons, Vite.\nBackend: Node.js 20+, Express RESTful API, Prisma ORM, SQLite/PostgreSQL Database, Socket.IO Real-time."),
            ("4. Tài khoản kiểm thử chuẩn bị", "- Tài khoản Quản trị viên: admin@officepet.vn / Admin@123 (Role: ADMIN)\n- Tài khoản Nhân viên: user1@officepet.vn, user2@officepet.vn (Role: USER)\n- Dữ liệu assets: Sprite sheet 11 hàng chuẩn 64x64px, File GIF hoạt ảnh lẻ, Ảnh icon vật phẩm.")
        ]
    ),
    (
        "IV. TIÊU CHÍ BẮT ĐẦU / TẠM DỪNG / KẾT THÚC (TEST CRITERIA)",
        [
            ("1. Tiêu chí bắt đầu (Entry Criteria)", "- Mã nguồn Backend và Frontend biên dịch thành công (0 TypeScript/Vite errors).\n- Cơ sở dữ liệu Prisma migrate đầy đủ bảng biểu (users, pet_types, user_pets, items, user_items, quests, backgrounds, departments).\n- Bộ kịch bản Test Cases được phê duyệt và sẵn sàng chạy thử nghiệm."),
            ("2. Tiêu chí tạm dừng (Suspension Criteria)", "- Xuất hiện lỗi Block (Critical) làm sập hệ thống (Crash server, mất kết nối DB) ngăn cản việc thực hiện luồng chức năng tiếp theo.\n- Hệ thống xác thực bị tê liệt hoàn toàn không thể đăng nhập."),
            ("3. Tiêu chí kết thúc (Exit Criteria)", "- 100% Test Cases trong kịch bản được thực thi và ghi nhận kết quả thực tế.\n- 0 lỗi mức độ Critical và High còn tồn đọng chưa được xử lý.\n- Các lỗi mức độ Medium/Low đã được ghi nhận vào danh mục theo dõi và có kế hoạch khắc phục.")
        ]
    ),
    (
        "V. NGUYÊN TẮC QUẢN LÝ DỮ LIỆU & GHI NHẬN KẾT QUẢ",
        [
            ("1. Tính trung thực dữ liệu", "Tuyệt đối KHÔNG tạo dữ liệu ảo / kết quả ảo khi chưa tiến hành kiểm thử thực tế trên hệ thống. Tất cả các cột Kết quả thực tế (Actual Result), Ngày kiểm thử (Date), Người thực hiện (Tester), Mã lỗi (Defect ID) trong bảng Test Cases được để trống cho đợt kiểm thử thực tế."),
            ("2. Quy ước trạng thái kiểm thử", "- Chưa kiểm thử (Not Run): Sẵn sàng thực hiện, chưa chạy thử nghiệm.\n- Đạt (Passed): Kết quả thực tế khớp hoàn toàn với kết quả mong đợi.\n- Không đạt (Failed): Kết quả thực tế phát sinh lỗi hoặc sai lệch so với yêu cầu.\n- Bị chặn (Blocked): Không thể thực hiện kiểm thử do lỗi nghiêm trọng ở bước trước.")
        ]
    )
]

cur_row = 9
for sec_header, items in sections_content:
    ws1.merge_cells(f"A{cur_row}:H{cur_row}")
    ws1[f"A{cur_row}"] = sec_header
    ws1[f"A{cur_row}"].font = font_sec
    ws1[f"A{cur_row}"].fill = fill_slate
    ws1[f"A{cur_row}"].alignment = align_left
    ws1.row_dimensions[cur_row].height = 26
    cur_row += 1

    for item_title, item_desc in items:
        ws1[f"A{cur_row}"] = item_title
        ws1[f"A{cur_row}"].font = font_subsec
        ws1[f"A{cur_row}"].fill = fill_light_blue
        ws1[f"A{cur_row}"].border = border_cell
        ws1[f"A{cur_row}"].alignment = align_data_left

        ws1[f"B{cur_row}"] = item_desc
        ws1.merge_cells(f"B{cur_row}:H{cur_row}")
        ws1[f"B{cur_row}"].font = font_body
        ws1[f"B{cur_row}"].border = border_cell
        ws1[f"B{cur_row}"].alignment = align_data_left

        # Căn chỉnh độ cao hàng để không che chữ
        lines = item_desc.count('\n') + max(1, len(item_desc) // 85)
        ws1.row_dimensions[cur_row].height = max(24, lines * 19)
        cur_row += 1

    cur_row += 1

# Thiết lập độ rộng cột Sheet 1
col_w1 = {"A": 28, "B": 20, "C": 20, "D": 20, "E": 22, "F": 20, "G": 20, "H": 22}
for c_letter, c_width in col_w1.items():
    ws1.column_dimensions[c_letter].width = c_width


# =============================================================================
# SHEET 2: DANH SÁCH CHI TIẾT TEST CASES
# =============================================================================
print("Đang tạo Sheet 2: 2. Danh_Sach_Test_Cases...")
ws2 = wb.create_sheet(title="2. Danh_Sach_Test_Cases")
ws2.views.sheetView[0].showGridLines = True

# Header Tiêu đề bảng
ws2.merge_cells("A1:N1")
ws2["A1"] = "DANH SÁCH KỊCH BẢN KIỂM THỬ CHI TIẾT (TEST CASES SPECIFICATION)"
ws2["A1"].font = font_title
ws2["A1"].alignment = align_center
ws2.row_dimensions[1].height = 34

ws2.merge_cells("A2:N2")
ws2["A2"] = "HỆ THỐNG OFFICEPET - BAO PHỦ 100% TÍNH NĂNG VÀ 11 HOẠT ẢNH CHUẨN HÓA (TRẠNG THÁI: CHƯA KIỂM THỬ - SẴN SÀNG TEST)"
ws2["A2"].font = font_subtitle
ws2["A2"].alignment = align_center
ws2.row_dimensions[2].height = 20

# Dòng ghi chú quy ước
ws2.merge_cells("A3:N3")
ws2["A3"] = "Lưu ý: Hiện tại hệ thống chưa bắt đầu đợt test thực tế. Trạng thái mặc định là 'Chưa kiểm thử'. Các cột Kết quả thực tế, Ngày, Tester, Mã lỗi được để trống để Tester điền khi chạy test."
ws2["A3"].font = Font(name=FONT_NAME, size=10, italic=True, color="7F8C8D")
ws2["A3"].alignment = align_center
ws2.row_dimensions[3].height = 18

headers = [
    "Mã Test Case",
    "Phân hệ",
    "Tên chức năng / Kịch bản kiểm thử",
    "Điều kiện tiên quyết",
    "Các bước thực hiện",
    "Dữ liệu kiểm thử",
    "Kết quả mong đợi",
    "Mức độ ưu tiên",
    "Loại kiểm thử",
    "Trạng thái kiểm thử",
    "Kết quả thực tế",
    "Ngày kiểm thử",
    "Người thực hiện",
    "Mã lỗi / Ghi chú"
]

header_row = 5
ws2.row_dimensions[header_row].height = 30
for col_idx, col_name in enumerate(headers, start=1):
    cell = ws2.cell(row=header_row, column=col_idx, value=col_name)
    cell.font = font_tbl_header
    cell.fill = fill_navy
    cell.alignment = align_center
    cell.border = border_header

# Bật AutoFilter cho bảng
ws2.auto_filter.ref = f"A{header_row}:N{header_row + len(TEST_CASES_DATA)}"

# Cố định dòng tiêu đề (Freeze Panes dưới header)
ws2.freeze_panes = "C6"

start_tc_row = 6
for idx, tc in enumerate(TEST_CASES_DATA):
    r = start_tc_row + idx
    (tc_id, module, title, prereq, steps, test_data, expected, priority, test_type) = tc

    is_alt = (idx % 2 == 1)
    base_fill = fill_row_alt if is_alt else fill_white

    # Cột 1: Mã Test Case
    c1 = ws2.cell(row=r, column=1, value=tc_id)
    c1.font = font_code
    c1.alignment = align_data_center
    c1.border = border_cell
    c1.fill = base_fill

    # Cột 2: Phân hệ
    c2 = ws2.cell(row=r, column=2, value=module)
    c2.font = font_body_bold
    c2.alignment = align_data_left
    c2.border = border_cell
    c2.fill = base_fill

    # Cột 3: Tên chức năng
    c3 = ws2.cell(row=r, column=3, value=title)
    c3.font = font_body_bold
    c3.alignment = align_data_left
    c3.border = border_cell
    c3.fill = base_fill

    # Cột 4: Điều kiện tiên quyết
    c4 = ws2.cell(row=r, column=4, value=prereq)
    c4.font = font_body
    c4.alignment = align_data_left
    c4.border = border_cell
    c4.fill = base_fill

    # Cột 5: Các bước thực hiện
    c5 = ws2.cell(row=r, column=5, value=steps)
    c5.font = font_body
    c5.alignment = align_data_left
    c5.border = border_cell
    c5.fill = base_fill

    # Cột 6: Dữ liệu kiểm thử
    c6 = ws2.cell(row=r, column=6, value=test_data)
    c6.font = font_body
    c6.alignment = align_data_left
    c6.border = border_cell
    c6.fill = base_fill

    # Cột 7: Kết quả mong đợi
    c7 = ws2.cell(row=r, column=7, value=expected)
    c7.font = font_body
    c7.alignment = align_data_left
    c7.border = border_cell
    c7.fill = base_fill

    # Cột 8: Mức độ ưu tiên (Priority)
    c8 = ws2.cell(row=r, column=8, value=priority)
    c8.alignment = align_data_center
    c8.border = border_cell
    if priority == "Critical":
        c8.font = font_prio_critical
        c8.fill = fill_prio_critical
    elif priority == "High":
        c8.font = font_prio_high
        c8.fill = fill_prio_high
    elif priority == "Medium":
        c8.font = font_prio_medium
        c8.fill = fill_prio_medium
    else:
        c8.font = font_prio_low
        c8.fill = fill_prio_low

    # Cột 9: Loại kiểm thử (Type)
    c9 = ws2.cell(row=r, column=9, value=test_type)
    c9.font = font_body
    c9.alignment = align_data_center
    c9.border = border_cell
    c9.fill = base_fill

    # Cột 10: Trạng thái kiểm thử (MẶC ĐỊNH LÀ "Chưa kiểm thử" - CHƯA TEST, KHÔNG TẠO DỮ LIỆU ẢO)
    c10 = ws2.cell(row=r, column=10, value="Chưa kiểm thử")
    c10.font = font_status_pending
    c10.alignment = align_data_center
    c10.border = border_cell
    c10.fill = fill_pending_cell

    # Cột 11: Kết quả thực tế (ĐỂ TRỐNG)
    c11 = ws2.cell(row=r, column=11, value="")
    c11.font = font_body
    c11.alignment = align_data_left
    c11.border = border_cell
    c11.fill = base_fill

    # Cột 12: Ngày kiểm thử (ĐỂ TRỐNG)
    c12 = ws2.cell(row=r, column=12, value="")
    c12.font = font_body
    c12.alignment = align_data_center
    c12.border = border_cell
    c12.fill = base_fill

    # Cột 13: Người thực hiện (ĐỂ TRỐNG)
    c13 = ws2.cell(row=r, column=13, value="")
    c13.font = font_body
    c13.alignment = align_data_center
    c13.border = border_cell
    c13.fill = base_fill

    # Cột 14: Mã lỗi / Ghi chú (ĐỂ TRỐNG)
    c14 = ws2.cell(row=r, column=14, value="")
    c14.font = font_body
    c14.alignment = align_data_left
    c14.border = border_cell
    c14.fill = base_fill

    # Tính toán độ cao hàng chuẩn mực để không che chữ
    lines_title = title.count('\n') + max(1, len(title) // 32)
    lines_steps = steps.count('\n') + max(1, len(steps) // 48)
    lines_expected = expected.count('\n') + max(1, len(expected) // 50)
    lines_data = test_data.count('\n') + max(1, len(test_data) // 25)
    max_lines = max(lines_title, lines_steps, lines_expected, lines_data, 1)

    ws2.row_dimensions[r].height = max(26, max_lines * 19)

# Thiết lập độ rộng cột cho Sheet 2 rộng rãi, dễ đọc
col_w2 = {
    "A": 16,  # Mã Test Case
    "B": 24,  # Phân hệ
    "C": 36,  # Tên chức năng
    "D": 32,  # Điều kiện tiên quyết
    "E": 54,  # Các bước thực hiện
    "F": 28,  # Dữ liệu kiểm thử
    "G": 54,  # Kết quả mong đợi
    "H": 16,  # Mức độ ưu tiên
    "I": 20,  # Loại kiểm thử
    "J": 20,  # Trạng thái
    "K": 28,  # Kết quả thực tế
    "L": 18,  # Ngày kiểm thử
    "M": 20,  # Người thực hiện
    "N": 22   # Mã lỗi / Ghi chú
}
for c_letter, c_width in col_w2.items():
    ws2.column_dimensions[c_letter].width = c_width


# =============================================================================
# SHEET 3: MA TRẬN PHỦ CHỨC NĂNG & THỐNG KÊ (TRACEABILITY & READINESS)
# =============================================================================
print("Đang tạo Sheet 3: 3. Ma_Tran_Phu_Chuc_Nang...")
ws3 = wb.create_sheet(title="3. Ma_Tran_Phu_Chuc_Nang")
ws3.views.sheetView[0].showGridLines = True

# Tiêu đề Sheet 3
ws3.merge_cells("A1:K1")
ws3["A1"] = "MA TRẬN BAO PHỦ CHỨC NĂNG & TIẾN ĐỘ SẴN SÀNG KIỂM THỬ"
ws3["A1"].font = font_title
ws3["A1"].alignment = align_center
ws3.row_dimensions[1].height = 34

ws3.merge_cells("A2:K2")
ws3["A2"] = "DỰ ÁN OFFICEPET - TỔNG HỢP THEO PHÂN HỆ, MỨC ĐỘ ƯU TIÊN VÀ CHỈ SỐ KPI"
ws3["A2"].font = font_subtitle
ws3["A2"].alignment = align_center
ws3.row_dimensions[2].height = 20

# Tiêu đề bảng ma trận
s3_headers = [
    "STT",
    "Mã Phân hệ",
    "Tên Phân hệ Nghiệp vụ",
    "Tổng số Test Cases",
    "Critical",
    "High",
    "Medium",
    "Low",
    "Đã Pass (Thực tế)",
    "Failed / Blocked",
    "Chưa kiểm thử (Pending)"
]

ws3.row_dimensions[4].height = 28
for c_idx, h_text in enumerate(s3_headers, start=1):
    c = ws3.cell(row=4, column=c_idx, value=h_text)
    c.font = font_tbl_header
    c.fill = fill_navy
    c.alignment = align_center
    c.border = border_header

# Thống kê theo từng module từ dữ liệu thực
modules_stats = {}
for tc in TEST_CASES_DATA:
    mod = tc[1]
    prio = tc[7]
    if mod not in modules_stats:
        modules_stats[mod] = {"total": 0, "Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    modules_stats[mod]["total"] += 1
    modules_stats[mod][prio] = modules_stats[mod].get(prio, 0) + 1

r3 = 5
total_tc = len(TEST_CASES_DATA)
sum_crit = 0
sum_high = 0
sum_med = 0
sum_low = 0

for idx, (mod_name, stats) in enumerate(modules_stats.items(), start=1):
    ws3.row_dimensions[r3].height = 24
    mod_code = mod_name.split(":")[0].strip().replace("Module ", "MOD_")

    is_alt = (idx % 2 == 0)
    row_fill = fill_row_alt if is_alt else fill_white

    # STT
    c = ws3.cell(row=r3, column=1, value=idx)
    c.font = font_body
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill

    # Mã Phân hệ
    c = ws3.cell(row=r3, column=2, value=mod_code)
    c.font = font_code
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill

    # Tên Phân hệ
    c = ws3.cell(row=r3, column=3, value=mod_name)
    c.font = font_body_bold
    c.alignment = align_left
    c.border = border_cell
    c.fill = row_fill

    # Tổng số TC
    c = ws3.cell(row=r3, column=4, value=stats["total"])
    c.font = font_body_bold
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill

    # Critical
    c = ws3.cell(row=r3, column=5, value=stats["Critical"])
    c.font = font_prio_critical
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill
    sum_crit += stats["Critical"]

    # High
    c = ws3.cell(row=r3, column=6, value=stats["High"])
    c.font = font_prio_high
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill
    sum_high += stats["High"]

    # Medium
    c = ws3.cell(row=r3, column=7, value=stats["Medium"])
    c.font = font_prio_medium
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill
    sum_med += stats["Medium"]

    # Low
    c = ws3.cell(row=r3, column=8, value=stats["Low"])
    c.font = font_prio_low
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill
    sum_low += stats["Low"]

    # Đã Pass (0 - vì chưa test)
    c = ws3.cell(row=r3, column=9, value=0)
    c.font = font_body
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill

    # Failed / Blocked (0 - vì chưa test)
    c = ws3.cell(row=r3, column=10, value=0)
    c.font = font_body
    c.alignment = align_center
    c.border = border_cell
    c.fill = row_fill

    # Chưa kiểm thử (Bằng tổng số TC của module)
    c = ws3.cell(row=r3, column=11, value=stats["total"])
    c.font = font_status_pending
    c.alignment = align_center
    c.border = border_cell
    c.fill = fill_pending_cell

    r3 += 1

# Dòng Tổng cộng
ws3.row_dimensions[r3].height = 26
ws3.merge_cells(f"A{r3}:C{r3}")
c_tot = ws3.cell(row=r3, column=1, value="TỔNG CỘNG HỆ THỐNG")
c_tot.font = font_tbl_header_dark
c_tot.alignment = align_center
c_tot.fill = fill_total_row
for col in range(1, 4):
    ws3.cell(row=r3, column=col).border = border_total

# Tổng số TC
c = ws3.cell(row=r3, column=4, value=total_tc)
c.font = font_tbl_header_dark
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Critical
c = ws3.cell(row=r3, column=5, value=sum_crit)
c.font = font_prio_critical
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng High
c = ws3.cell(row=r3, column=6, value=sum_high)
c.font = font_prio_high
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Medium
c = ws3.cell(row=r3, column=7, value=sum_med)
c.font = font_prio_medium
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Low
c = ws3.cell(row=r3, column=8, value=sum_low)
c.font = font_prio_low
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Pass
c = ws3.cell(row=r3, column=9, value=0)
c.font = font_tbl_header_dark
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Fail
c = ws3.cell(row=r3, column=10, value=0)
c.font = font_tbl_header_dark
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Tổng Chưa kiểm thử
c = ws3.cell(row=r3, column=11, value=total_tc)
c.font = font_tbl_header_dark
c.alignment = align_center
c.border = border_total
c.fill = fill_total_row

# Bảng Chỉ số Đánh giá Sẵn sàng (Readiness KPI Table)
r_kpi_start = r3 + 3
ws3.merge_cells(f"A{r_kpi_start}:G{r_kpi_start}")
ws3[f"A{r_kpi_start}"] = "BẢNG ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG KIỂM THỬ (READINESS KPI)"
ws3[f"A{r_kpi_start}"].font = font_sec
ws3[f"A{r_kpi_start}"].fill = fill_slate
ws3[f"A{r_kpi_start}"].alignment = align_left
ws3.row_dimensions[r_kpi_start].height = 26

kpi_data = [
    ("Tỷ lệ bao phủ kịch bản chức năng (Functional Coverage)", "100%", "Đã thiết kế 10/10 phân hệ chức năng & phi chức năng"),
    ("Tổng số kịch bản kiểm thử sẵn sàng (Total Test Cases)", f"{total_tc} Test Cases", "Bao gồm cả kiểm thử luồng chính (Positive) và ngoại lệ (Negative)"),
    ("Số lượng kịch bản trọng yếu (Critical / High Priority)", f"{sum_crit + sum_high} Test Cases", f"Chiếm {(sum_crit + sum_high)*100//total_tc}% tổng số kịch bản"),
    ("Trạng thái thực thi hiện tại (Execution Progress)", "0% (Chưa bắt đầu)", "Đảm bảo tính trung thực - Không tạo dữ liệu ảo khi chưa test"),
    ("Kế hoạch đợt 1 (Smoke & Sanity Test)", "24 kịch bản Critical", "Ưu tiên chạy trước các luồng Xác thực, Nuôi pet, Pomodoro và Admin Forge"),
    ("Kế hoạch đợt 2 (Full Functional & Regression Test)", f"{total_tc - 24} kịch bản còn lại", "Kiểm thử chuyên sâu Shop, Chat AI, Nhiệm vụ, Đa người dùng và Phi chức năng")
]

cur_kpi_row = r_kpi_start + 1
for kpi_name, kpi_val, kpi_note in kpi_data:
    ws3.row_dimensions[cur_kpi_row].height = 24
    ws3[f"A{cur_kpi_row}"] = kpi_name
    ws3.merge_cells(f"A{cur_kpi_row}:C{cur_kpi_row}")
    ws3[f"A{cur_kpi_row}"].font = font_subsec
    ws3[f"A{cur_kpi_row}"].fill = fill_light_blue
    ws3[f"A{cur_kpi_row}"].border = border_cell
    ws3[f"A{cur_kpi_row}"].alignment = align_left

    ws3[f"D{cur_kpi_row}"] = kpi_val
    ws3[f"D{cur_kpi_row}"].font = font_body_bold
    ws3[f"D{cur_kpi_row}"].border = border_cell
    ws3[f"D{cur_kpi_row}"].alignment = align_center

    ws3[f"E{cur_kpi_row}"] = kpi_note
    ws3.merge_cells(f"E{cur_kpi_row}:G{cur_kpi_row}")
    ws3[f"E{cur_kpi_row}"].font = font_body
    ws3[f"E{cur_kpi_row}"].border = border_cell
    ws3[f"E{cur_kpi_row}"].alignment = align_left

    cur_kpi_row += 1

# Thiết lập độ rộng cột cho Sheet 3
col_w3 = {
    "A": 8,   # STT
    "B": 16,  # Mã Phân hệ
    "C": 40,  # Tên Phân hệ
    "D": 22,  # Tổng số TC
    "E": 14,  # Critical
    "F": 14,  # High
    "G": 14,  # Medium
    "H": 14,  # Low
    "I": 18,  # Đã Pass
    "J": 18,  # Failed
    "K": 26   # Chưa kiểm thử
}
for c_letter, c_width in col_w3.items():
    ws3.column_dimensions[c_letter].width = c_width


# =============================================================================
# LƯU WORKBOOK
# =============================================================================
print(f"Đang lưu file Excel vào: {OUTPUT_FILE}...")
wb.save(OUTPUT_FILE)
print(">>> XUẤT FILE EXCEL TEST PLAN THÀNH CÔNG! <<<")
