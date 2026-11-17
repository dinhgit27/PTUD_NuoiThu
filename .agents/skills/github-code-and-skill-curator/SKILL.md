---
name: github-code-and-skill-curator
description: >-
  Bộ chuẩn kiến trúc và mẫu thiết kế cố định cho ứng dụng Web và Desktop PTUD_NuoiThu
  (React 18, Electron, HTML5 Canvas 2D, Node.js/Express, Prisma SQL Server).
  Áp dụng khi lập trình, tái cấu trúc hoặc gỡ lỗi để đảm bảo đồng bộ đa nền tảng, an toàn bộ nhớ và build 0 lỗi.
---

# Chuẩn Kiến Trúc & Thực Hành Tốt Nhất — PTUD_NuoiThu

> **Trạng thái tài liệu:** File skill này là **chuẩn cố định** của dự án. Agent **không tự ý cập nhật/sửa đổi** nội dung skill này hoặc tự chạy script tìm kiếm bên ngoài khi chưa có yêu cầu trực tiếp từ đại ca.

---

## 1. Tech Stack & Cấu Trúc Chuẩn
- **Frontend (`frontend/src/`):** React 18, Vite, TypeScript, Tailwind CSS, HTML5 Canvas 2D (Pixel-art), Lucide React (`components/`, `services/`).
- **Desktop (`frontend/electron/`):** Electron đa cửa sổ (Dashboard + Transparent Frameless Pet Overlay), click-through `setIgnoreMouseEvents`, đồng bộ IPC 2 chiều qua `window.officePet`.
- **Backend (`backend/src/`):** Node.js, Express, TypeScript, Prisma ORM + **SQL Server**, JWT Auth (`routes/`, `services/`).

---

## 2. Chuẩn Kỹ Thuật Theo Phân Hệ

1. **Desktop Pet Overlay & Đồng Bộ IPC (`App.tsx`, `DesktopPetWindow.tsx`, `DesktopOverlay.tsx`, `main.cjs`):**
   - Đồng bộ trạng thái thú cưng nhất quán giữa Web Dashboard, Cửa sổ nổi Desktop và Backend API qua `window.officePet`.
   - Không để timer cục bộ trên Desktop ghi đè ngược trạng thái hành động mà người dùng vừa chọn trên Dashboard.
   - Neo tọa độ an toàn trong `workArea`, giữ `setIgnoreMouseEvents(true, { forward: true })` đúng lúc để không chặn thao tác chuột.

2. **Pixel Art Canvas & Animation (`PixelPetCanvas.tsx`):**
   - Tắt làm mịn (`imageSmoothingEnabled = false`) để giữ độ sắc nét pixel-art.
   - Tính số cột thực tế theo kích thước ảnh nạp vào (`naturalWidth / frameWidth`) khi sẵn sàng, hỗ trợ cả chỉ số frame phẳng (1D) lẫn chỉ số tương đối theo hàng (`row` + `col`).
   - Khai báo đầy đủ dependencies cho `useEffect` vòng lặp vẽ và luôn hủy `cancelAnimationFrame` khi unmount hoặc đổi trạng thái.

3. **Pomodoro, Gamification & Audio/Voice:**
   - Bộ đếm Pomodoro tránh lệch giờ khi tab nền bị throttle.
   - Mọi luồng audio, VAD, `setTimeout`, `setInterval`, `addEventListener`, và `ipcRenderer` listener phải được dọn dẹp triệt để trong hàm cleanup của `useEffect`.

---

## 3. Yêu Cầu Kiểm Chứng Trước Khi Hoàn Tất
- Không dùng giải pháp tạm bợ hay kiểu `any` tùy tiện; bảo toàn các comment/docstring hiện có không liên quan đến phần sửa.
- Bắt buộc biên dịch sạch 0 lỗi TypeScript ở cả 2 phía sau lần sửa cuối:
  - `npm --prefix frontend run build` (exit code 0)
  - `npm --prefix backend run build` (exit code 0)
