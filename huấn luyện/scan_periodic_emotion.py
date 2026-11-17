import os
import sys
import time
import json
import cv2
import numpy as np
import onnxruntime as ort

# =====================================================================
# CẤU HÌNH THEO Ý ĐẠI CA
# =====================================================================
# Khoảng thời gian giữa các lần quét (tính bằng GIÂY)
# Để test thử ngay: 15 (15 giây quét 1 lần)
# Khi làm việc thực tế: 300 (5 phút) hoặc 600 (10 phút)
SCAN_INTERVAL_SECONDS = 15

WARMUP_FRAMES = 8          # Bỏ qua 8 frame đầu để webcam kịp cân bằng sáng
SAMPLE_TARGET_FRAMES = 5   # Lấy trung bình 5 frame có mặt người để kết quả ổn định
MAX_WAIT_SECONDS = 3.5     # Quá 3.5 giây không thấy mặt thì tự tắt cam tránh chiếm cam
# =====================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(SCRIPT_DIR, "emotion_rafdb.onnx")
LABELS_PATH = os.path.join(SCRIPT_DIR, "emotion_labels.json")

if not os.path.exists(ONNX_PATH) or not os.path.exists(LABELS_PATH):
    print("❌ Lỗi: Không tìm thấy file emotion_rafdb.onnx hoặc emotion_labels.json trong thư mục:", SCRIPT_DIR)
    sys.exit(1)

with open(LABELS_PATH, "r", encoding="utf-8") as f:
    meta = json.load(f)

EMOTIONS = meta["emotions"]
IMG_SIZE = meta.get("img_size", 224)
MEAN = np.array(meta.get("mean", [0.485, 0.456, 0.406]), dtype=np.float32)
STD = np.array(meta.get("std", [0.229, 0.224, 0.225]), dtype=np.float32)

# Từ điển dịch cảm xúc sang Tiếng Việt cho thân thiện
EMOTION_VI = {
    "Surprise": "Bất ngờ 😲",
    "Fear": "Lo lắng / Bất an 😨",
    "Disgust": "Khó chịu 😣",
    "Happiness": "Vui vẻ / Cười tươi 😊",
    "Sadness": "Buồn bã / Mệt mỏi 🥺",
    "Anger": "Căng thẳng / Cau mày 😠",
    "Neutral": "Bình thường / Tập trung 😐"
}

print(">> Đang tải mô hình ONNX...")
sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
print("✅ Mô hình đã sẵn sàng!")

def softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()

def burst_scan_once():
    """
    Bật camera -> Đợi cảm biến cân sáng -> Lấy 5 frame có mặt -> Tắt hẳn camera
    """
    now_str = time.strftime("%H:%M:%S")
    print(f"\n[{now_str}] 📷 Đang BẬT camera quét nhanh...")
    
    # Dùng cv2.CAP_DSHOW trên Windows để bật/tắt camera mượt và nhanh nhất
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("  ⚠️ Không mở được webcam (có thể đang bị Zoom/Meet hoặc app khác sử dụng).")
        return None, 0.0

    collected_probs = []
    start_time = time.time()
    frame_count = 0

    try:
        while (time.time() - start_time) < MAX_WAIT_SECONDS and len(collected_probs) < SAMPLE_TARGET_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break
            frame_count += 1
            if frame_count <= WARMUP_FRAMES:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(70, 70))
            if len(faces) == 0:
                continue

            # Lấy khuôn mặt lớn nhất (gần camera nhất)
            x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
            pad = int(0.12 * w)
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2, y2 = min(frame.shape[1], x + w + pad), min(frame.shape[0], y + h + pad)

            face_rgb = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)
            face_resized = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE)).astype(np.float32) / 255.0
            face_norm = (face_resized - MEAN) / STD
            inp = np.transpose(face_norm, (2, 0, 1))[None, ...]

            logits = sess.run(["logits"], {"input": inp})[0][0]
            collected_probs.append(softmax(logits))
    finally:
        # Bắt buộc tắt camera ngay lập tức để đèn webcam tắt hoàn toàn
        cap.release()
        print("  🔒 ĐÃ TẮT HẲN CAMERA (Đèn LED webcam tắt).")

    if not collected_probs:
        return None, 0.0

    avg_probs = np.mean(collected_probs, axis=0)
    best_idx = int(np.argmax(avg_probs))
    return EMOTIONS[best_idx], float(avg_probs[best_idx])

def main():
    print("=" * 65)
    print("🎯 CHƯƠNG TRÌNH NHẬN DIỆN CẢM XÚC ĐỊNH KỲ (TIẾT KIỆM TÀI NGUYÊN)")
    print(f"⏰ Chu kỳ quét: Mỗi {SCAN_INTERVAL_SECONDS} giây (Sẽ tự bật camera ~1.5s rồi tắt)")
    print("🛑 Bấm Ctrl + C trên bàn phím bất kỳ lúc nào để dừng chương trình.")
    print("=" * 65)

    try:
        while True:
            emotion, conf = burst_scan_once()
            now_str = time.strftime("%H:%M:%S")

            if emotion:
                vi_name = EMOTION_VI.get(emotion, emotion)
                print(f"[{now_str}] 🎉 CẢM XÚC PHÁT HIỆN: {vi_name} (Độ tin cậy: {conf*100:.1f}%)")
            else:
                print(f"[{now_str}] ℹ️ Không phát hiện khuôn mặt trước máy trong 3 giây.")

            print(f"💤 Nghỉ ngơi hoàn toàn... Lần quét kế tiếp sau {SCAN_INTERVAL_SECONDS}s.")
            time.sleep(SCAN_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\n\n👋 Đã dừng chương trình theo dõi cảm xúc.")

if __name__ == "__main__":
    main()
