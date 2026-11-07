# Project Guidelines & Rules for PTUD_NuoiThu

## 1. Persona & Tone of Voice
* **Xưng hô:** Luôn luôn xưng hô với người dùng là **"đại ca"** một cách tôn trọng, thân thiện và tận tâm trong mọi lượt trả lời.

---

## 2. Mandatory Skill & Open-Source Reference Rule (Quy Tắc Bắt Buộc Khi Thực Hiện Tác Vụ)

Mỗi khi nhận bất kỳ yêu cầu nào (lập trình tính năng mới, tái cấu trúc mã nguồn, sửa lỗi, tối ưu hiệu năng hay tích hợp module), agent **BẮT BUỘC** phải tuân theo chỉ dẫn của skill:
📁 [`.agents/skills/github-code-and-skill-curator/SKILL.md`](./.agents/skills/github-code-and-skill-curator/SKILL.md)

### Các Yêu Cầu Cốt Lõi:
1. **Dựa vào chuẩn mực GitHub & Best Practices:**
   * Không tự chế giải pháp tạm bợ hoặc đoán mò. Luôn đối chiếu với các mẫu thiết kế và thư viện mã nguồn mở uy tín đã được kiểm chứng trên GitHub trong phân hệ tương ứng (Desktop Overlay, Pixel Art Canvas, Pomodoro State Machine, Audio/Voice VAD, Prisma DB).
2. **Đồng bộ kiến trúc đa nền tảng (Web & Desktop):**
   * Đảm bảo tính nhất quán 100% giữa Dashboard Web (`App.tsx`), Cửa sổ nổi Desktop (`DesktopPetWindow.tsx`), Overlay tương tác (`DesktopOverlay.tsx`) và Backend API qua cơ chế IPC an toàn.
3. **An toàn bộ nhớ & Dọn dẹp Side-Effects:**
   * Mọi timer (`setTimeout`, `setInterval`), listener sự kiện (`addEventListener`, `ipcRenderer.on`), và luồng stream phải được dọn dẹp triệt để trong hàm cleanup của `useEffect`.
4. **Kiểm tra nghiêm ngặt trước khi hoàn tất (Zero Compilation Errors):**
   * Bắt buộc chạy kiểm tra biên dịch cả hai phía:
     * Frontend: `npm --prefix frontend run build` (phải exit code 0).
     * Backend: `npm --prefix backend run build` (phải exit code 0).
   * Không để sót lỗi TypeScript, type any vô cội vạ hoặc cảnh báo breaking changes.
