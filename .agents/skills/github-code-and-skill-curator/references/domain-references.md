# Domain References & Curated GitHub Repositories for PTUD_NuoiThu

Tài liệu này tổng hợp danh sách các kho mã nguồn mở (repositories), thư viện chuẩn và mẫu thiết kế (design patterns) hàng đầu trên GitHub dành riêng cho các phân hệ của dự án **PTUD_NuoiThu**.

---

## 1. Desktop Pet & Electron Transparent Overlay

| Repository / Module | Sao (Stars) | Đặc điểm nổi bật | Áp dụng cho PTUD_NuoiThu |
| :--- | :--- | :--- | :--- |
| **`electron-overlay-window`** | ~1k+ | Cung cấp overlay trong suốt, bắt xuyên chuột (`setIgnoreMouseEvents`), không cướp focus của game hay cửa sổ làm việc khác | Cơ chế click-through của `DesktopPetWindow` và `DesktopOverlay` |
| **`screen-pet` / `desktop-mascot`** | ~800+ | Quản lý vòng đời thú cưng trên màn hình, neo toạ độ góc dưới màn hình (`workArea.x`, `workArea.y`) | Roaming walker, tự động tính biên màn hình để không rơi khỏi màn hình |
| **`electron-trpc` / `electron-better-ipc`** | ~2k+ | Mô hình IPC gõ kiểu an toàn 2 chiều giữa Main Process và Renderer Processes | Giao tiếp giữa `dashboardWindow`, `petWindow` và `alarmWindow` |

---

## 2. 2D Pixel Art Canvas & Sprite Animation Engine

| Repository / Module | Sao (Stars) | Đặc điểm nổi bật | Áp dụng cho PTUD_NuoiThu |
| :--- | :--- | :--- | :--- |
| **`crisp-game-lib`** | ~3k+ | Thư viện pixel art tối giản, cơ chế render theo frame tick `delta % frameInterval` cực mượt và nhẹ | Thuật toán trong `PixelPetCanvas.tsx` |
| **`pixi.js` (Spritesheet module)** | ~40k+ | Chuẩn xử lý Atlas / Spritesheet JSON (`frames`, `meta`, `animations`) | Phân tích và mapping 17 hàng hoạt ảnh từ ảnh sprite sheet ghép |
| **`aseprite-exporter`** | ~1.5k+ | Xuất animation dạng frame index và tính toán FPS, one-shot vs loop | Định dạng JSON cấu hình hoạt ảnh (`frameConfig` & `animations`) |

---

## 3. Pomodoro Focus Engine & Gamification State Machine

| Repository / Module | Sao (Stars) | Đặc điểm nổi bật | Áp dụng cho PTUD_NuoiThu |
| :--- | :--- | :--- | :--- |
| **`xstate` (Finite State Machines)** | ~25k+ | Quản lý trạng thái chuyển đổi giữa IDLE, FOCUS, SHORT_BREAK, LONG_BREAK, CELEBRATING | Máy trạng thái trong `PomodoroTimer.tsx` |
| **`useWorkerTimer`** | ~1k+ | Dùng Web Worker chạy bộ đếm thời gian ngầm, ngăn chặn trình duyệt throttle khi tab bị ẩn | Bộ đếm Pomodoro chính xác từng giây không bị lệch giờ |
| **`habitrpg` / `habitica`** | ~10k+ | Cơ chế tính EXP, Level Up Tank, độ đói (hunger) và độ vui vẻ (happiness) | Hệ thống bể EXP và tăng cấp thú cưng trong `App.tsx` |

---

## 4. Voice, STT / TTS & Audio Stream

| Repository / Module | Sao (Stars) | Đặc điểm nổi bật | Áp dụng cho PTUD_NuoiThu |
| :--- | :--- | :--- | :--- |
| **`vad` / `@ricky0123/vad-web`** | ~3k+ | Voice Activity Detection thời gian thực, lọc tiếng ồn và phát hiện khoảng lặng (silence timeout) | Bộ thu âm giọng nói trong `VoiceAssistant.tsx` |
| **`howler.js`** | ~23k+ | Thư viện âm thanh Web Audio API / HTML5 Audio với fade-in/fade-out, stereo panner và playlist | Hiệu ứng âm thanh khi cho ăn, thăng cấp, chuông báo thức |
| **`react-youtube`** | ~2k+ | Component bọc YouTube Player iFrame API chuẩn React, bắt sự kiện onStateChange, autoplay an toàn | Trình phát nhạc và video YouTube trong `MusicPlayer.tsx` |
