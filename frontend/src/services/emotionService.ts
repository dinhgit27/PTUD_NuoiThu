import * as ort from 'onnxruntime-web';
import { formatAddressing, getActiveAddressing } from '../utils/petAddressing';

export type EmotionType =
  | 'Surprise'
  | 'Fear'
  | 'Disgust'
  | 'Happiness'
  | 'Sadness'
  | 'Anger'
  | 'Neutral';

export interface EmotionScanResult {
  emotion: EmotionType;
  confidence: number;
  probabilities: Record<EmotionType, number>;
  timestamp: number;
  labelVi: string;
  emoji: string;
  speechText: string;
  reactionState: 'HAPPY' | 'DRINKING' | 'PETTING' | 'WAVING' | 'IDLE';
}

export const EMOTION_META: Record<
  EmotionType,
  {
    vi: string;
    emoji: string;
    reactionTemplate: string;
    reactionState: 'HAPPY' | 'DRINKING' | 'PETTING' | 'WAVING' | 'IDLE';
  }
> = {
  Happiness: {
    vi: 'Vui vẻ',
    emoji: '😊',
    reactionTemplate: '{Call} cười tươi làm {self} cũng vui lây nè! Tiếp tục năng lượng tích cực này nhé! 🌟',
    reactionState: 'HAPPY'
  },
  Anger: {
    vi: 'Căng thẳng / Cau mày',
    emoji: '😠',
    reactionTemplate: '{Call} đang gặp bài toán khó hay căng thẳng đúng không ạ? Cùng {self} uống ngụm nước nghỉ mắt 1 phút nhé! 💧',
    reactionState: 'DRINKING'
  },
  Sadness: {
    vi: 'Mệt mỏi / Buồn bã',
    emoji: '🥺',
    reactionTemplate: '{Self} thấy {call} có vẻ hơi mệt rồi đó... Hãy vươn vai thư giãn hoặc xoa đầu {self} một chút nhé! 🥰',
    reactionState: 'PETTING'
  },
  Surprise: {
    vi: 'Bất ngờ',
    emoji: '😲',
    reactionTemplate: 'Có phát hiện gì bất ngờ thế ạ {call}? {Self} luôn ở đây đồng hành cùng {call} nè! 👋',
    reactionState: 'WAVING'
  },
  Fear: {
    vi: 'Lo âu / Áp lực',
    emoji: '😨',
    reactionTemplate: 'Đừng lo lắng quá nhé {call}, từng bước một rồi mọi chuyện sẽ đâu vào đấy thôi! 💖',
    reactionState: 'HAPPY'
  },
  Disgust: {
    vi: 'Khó chịu / Bực bội',
    emoji: '😣',
    reactionTemplate: 'Nếu công việc đang gây bực bội, {call} tạm dừng tay hít thở sâu 2 phút cùng {self} nha! 🍃',
    reactionState: 'IDLE'
  },
  Neutral: {
    vi: 'Tập trung / Điềm tĩnh',
    emoji: '😐',
    reactionTemplate: '{Self} đứng ngoan trật tự để {call} tập trung làm việc đạt năng suất cao nhất nhé! 💻',
    reactionState: 'IDLE'
  }
};

const EMOTION_ORDER: EmotionType[] = [
  'Surprise',
  'Fear',
  'Disgust',
  'Happiness',
  'Sadness',
  'Anger',
  'Neutral'
];

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MODEL_SIZE = 224;

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let isScanningNow = false;

// Configure WASM paths (use local offline copy with CDN fallback)
try {
  ort.env.wasm.wasmPaths = '/onnx/';
} catch {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
}

export async function getEmotionSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        return await ort.InferenceSession.create('/models/emotion_rafdb.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });
      } catch (err) {
        console.warn('Failed to load local ONNX, trying relative path fallback:', err);
        return await ort.InferenceSession.create('./models/emotion_rafdb.onnx', {
          executionProviders: ['wasm']
        });
      }
    })();
  }
  return sessionPromise;
}

function softmax(arr: Float32Array | number[]): number[] {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  let sum = 0;
  const exps = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    exps[i] = Math.exp(arr[i] - max);
    sum += exps[i];
  }
  return exps.map(v => v / (sum || 1));
}

/**
 * Perform a burst scan: turn on camera -> capture 3-4 frames -> turn OFF camera immediately.
 */
export async function burstScanEmotion(options?: {
  maxWaitMs?: number;
  sampleFrames?: number;
}): Promise<EmotionScanResult | null> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  if (isScanningNow) {
    return null;
  }

  isScanningNow = true;
  let stream: MediaStream | null = null;
  const maxWait = options?.maxWaitMs ?? 3000;
  const targetSamples = options?.sampleFrames ?? 3;

  try {
    const session = await getEmotionSession();

    // 1. Request camera
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video stream metadata error'));
      setTimeout(() => reject(new Error('Webcam metadata timeout')), 2500);
    });

    await video.play();

    // 2. Allow camera sensor 350ms to auto-adjust exposure
    await new Promise(r => setTimeout(r, 350));

    const canvas = document.createElement('canvas');
    canvas.width = MODEL_SIZE;
    canvas.height = MODEL_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const collectedProbs: number[][] = [];
    const startTime = Date.now();

    // Detect Face if window.FaceDetector is available in Chromium / Electron
    const hasNativeDetector = typeof (window as any).FaceDetector !== 'undefined';
    const detector = hasNativeDetector
      ? new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
      : null;

    while (Date.now() - startTime < maxWait && collectedProbs.length < targetSamples) {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      let cropX = 0;
      let cropY = 0;
      let cropSize = Math.min(vw, vh);

      if (detector) {
        try {
          const faces = await detector.detect(video);
          if (faces && faces.length > 0) {
            const box = faces[0].boundingBox;
            const pad = Math.round(box.width * 0.15);
            cropSize = Math.max(box.width, box.height) + pad * 2;
            cropX = Math.max(0, Math.min(vw - cropSize, Math.round(box.x - pad)));
            cropY = Math.max(0, Math.min(vh - cropSize, Math.round(box.y - pad)));
          } else {
            // No face in this frame, wait next tick
            await new Promise(r => setTimeout(r, 80));
            continue;
          }
        } catch {
          // Fallback to center portrait crop
        }
      }

      if (!detector) {
        // Smart upper-center portrait crop where user face typically sits
        cropSize = Math.round(Math.min(vw, vh) * 0.78);
        cropX = Math.round((vw - cropSize) / 2);
        cropY = Math.round(vh * 0.08);
      }

      ctx.clearRect(0, 0, MODEL_SIZE, MODEL_SIZE);
      ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, MODEL_SIZE, MODEL_SIZE);

      const imgData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
      const { data } = imgData;

      // Convert RGBA -> Float32 planar tensor [1, 3, 224, 224] with ImageNet normalization
      const totalPixels = MODEL_SIZE * MODEL_SIZE;
      const tensorData = new Float32Array(3 * totalPixels);

      for (let i = 0; i < totalPixels; i++) {
        const r = data[i * 4] / 255.0;
        const g = data[i * 4 + 1] / 255.0;
        const b = data[i * 4 + 2] / 255.0;

        tensorData[i] = (r - MEAN[0]) / STD[0];
        tensorData[totalPixels + i] = (g - MEAN[1]) / STD[1];
        tensorData[2 * totalPixels + i] = (b - MEAN[2]) / STD[2];
      }

      const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);
      const results = await session.run({ input: inputTensor });
      const logits = results.logits?.data as Float32Array;

      if (logits && logits.length >= 7) {
        collectedProbs.push(softmax(logits));
      }

      await new Promise(r => setTimeout(r, 120));
    }

    if (collectedProbs.length === 0) {
      return null;
    }

    // Average probabilities
    const avgProbs = new Array(7).fill(0);
    for (const p of collectedProbs) {
      for (let i = 0; i < 7; i++) {
        avgProbs[i] += p[i];
      }
    }
    for (let i = 0; i < 7; i++) {
      avgProbs[i] /= collectedProbs.length;
    }

    let bestIdx = 0;
    let maxProb = -1;
    for (let i = 0; i < 7; i++) {
      if (avgProbs[i] > maxProb) {
        maxProb = avgProbs[i];
        bestIdx = i;
      }
    }

    const emotion = EMOTION_ORDER[bestIdx];
    const meta = EMOTION_META[emotion];
    const addressing = getActiveAddressing();
    const speechText = formatAddressing(meta.reactionTemplate, addressing.callName, addressing.selfName);

    const probMap = {} as Record<EmotionType, number>;
    EMOTION_ORDER.forEach((name, idx) => {
      probMap[name] = Math.round(avgProbs[idx] * 100);
    });

    const scanResult: EmotionScanResult = {
      emotion,
      confidence: Math.round(maxProb * 100),
      probabilities: probMap,
      timestamp: Date.now(),
      labelVi: meta.vi,
      emoji: meta.emoji,
      speechText,
      reactionState: meta.reactionState
    };

    saveLastMoodResult(scanResult);
    return scanResult;
  } catch (err) {
    console.warn('Emotion burst scan error:', err);
    return null;
  } finally {
    // 3. CRITICAL: Guarantee camera hardware is completely shut down immediately
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
    }
    isScanningNow = false;
  }
}

const MOOD_STORAGE_KEY = 'officepet_last_mood';
const MOOD_HISTORY_KEY = 'officepet_mood_history';

export function getLastMoodResult(): EmotionScanResult | null {
  try {
    const raw = localStorage.getItem(MOOD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getMoodHistory(): EmotionScanResult[] {
  try {
    const raw = localStorage.getItem(MOOD_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLastMoodResult(res: EmotionScanResult) {
  try {
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(res));
    const hist = getMoodHistory().slice(-19); // keep last 20
    hist.push(res);
    localStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(hist));
    window.dispatchEvent(new CustomEvent('officepet-mood-scanned', { detail: res }));
  } catch {}
}
