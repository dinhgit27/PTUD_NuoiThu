import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import {
  getEnrichedRoomsList,
  recordUserJoinRoom,
  ensureUserRoomSession,
  resolveRoomTopicFromText
} from '../routes/departments';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

export type AIIntelligenceMode = 'DEEP_REASONING' | 'BALANCED' | 'CREATIVE';
export type AITrainingCategory = 'QA_PAIR' | 'MEMORY_FACT' | 'KNOWLEDGE_DOC';

export interface AIBrainConfig {
  userId: string;
  customPersona: string;
  intelligenceMode: AIIntelligenceMode;
  autoLearnMemory: boolean;
  hasCustomKey: boolean;
  customGeminiKey?: string;
}

export interface AITrainingItem {
  id: string;
  userId: string;
  category: AITrainingCategory;
  triggerInput: string;
  idealResponse: string;
  createdAt: number;
}

export interface ChatAction {
  type:
    | 'START_POMODORO'
    | 'PLAY_MEDIA'
    | 'STOP_MUSIC'
    | 'START_BREATHING'
    | 'NAVIGATE_TAB'
    | 'JOIN_HOT_ROOM'
    | 'OPEN_MODAL'
    | 'CHANGE_ROOM'
    | 'PET_ACTION';
  duration?: number;
  category?: 'lofi_focus' | 'nature_relax' | 'funny_video';
  platform?: 'spotify' | 'youtube';
  query?: string;
  tab?: 'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'QUESTS';
  roomTopic?: string;
  roomName?: string;
  likesCount?: number;
  modal?: 'FRIENDS' | 'GUIDE' | 'BREATHING' | 'PET_SELECTOR';
  room?: 'cafe' | 'garden' | 'office' | 'beach' | 'room';
  petAction?: string;
}

export interface ChatResponse {
  reply: string;
  reasoning?: string;
  modelUsed?: string;
  learnedFact?: string;
  matchedTrainingId?: string;
  petStateChange?: string;
  isComfortMode: boolean;
  action?: ChatAction;
  musicAction?: {
    query: string;
    autoPlay: boolean;
  };
  relaxationSuggestion?: {
    type: 'STRETCH' | 'BREATHING_478' | 'EYE_REST_202020' | 'HYDRATION' | 'LOFI_MUSIC';
    title: string;
    description: string;
    durationMinutes: number;
  };
}

let aiTablesInitialized = false;

export async function ensureAITables(): Promise<void> {
  if (aiTablesInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ai_brain_config" (
        "user_id" TEXT NOT NULL PRIMARY KEY,
        "custom_persona" TEXT NOT NULL DEFAULT '',
        "intelligence_mode" TEXT NOT NULL DEFAULT 'DEEP_REASONING',
        "custom_gemini_key" TEXT NOT NULL DEFAULT '',
        "auto_learn_memory" INTEGER NOT NULL DEFAULT 1,
        "updated_at" INTEGER NOT NULL
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ai_training_items" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'QA_PAIR',
        "trigger_input" TEXT NOT NULL,
        "ideal_response" TEXT NOT NULL,
        "created_at" INTEGER NOT NULL
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_ai_training_user" ON "ai_training_items"("user_id")
    `);

    aiTablesInitialized = true;
  } catch (err) {
    console.warn('ensureAITables warning:', err);
  }
}

/**
 * Tự động phát hiện thông tin cá nhân / sở thích / mục tiêu chủ nhân nói để ghi nhớ vào Bộ nhớ dài hạn
 */
function extractAutoMemoryFact(userMessage: string): { trigger: string; fact: string } | null {
  const clean = userMessage.trim();
  if (clean.length < 8 || clean.length > 350) return null;

  const patterns: Array<{ regex: RegExp; label: string }> = [
    {
      regex: /(?:hãy\s+nhớ|ghi\s+nhớ|nhớ\s+giúp\s+(?:tôi|mình|anh|chị)|nhớ\s+là)\s*[:,-]?\s*(.+)/i,
      label: 'Ghi nhớ chủ nhân dặn'
    },
    {
      regex: /(?:tôi|mình|anh|chị)\s+tên\s+là\s+([^.,!?]+)/i,
      label: 'Tên của chủ nhân'
    },
    {
      regex: /(?:tôi|mình|anh|chị)\s+đang\s+(?:làm\s+việc|học|làm\s+đồ\s+án|làm\s+dự\s+án|nghiên\s+cứu)\s+([^.,!?]+)/i,
      label: 'Công việc / Dự án hiện tại'
    },
    {
      regex: /mục\s+tiêu\s+của\s+(?:tôi|mình|anh|chị)\s+là\s+([^.,!?]+)/i,
      label: 'Mục tiêu cá nhân'
    },
    {
      regex: /sở\s+thích\s+của\s+(?:tôi|mình|anh|chị)\s+là\s+([^.,!?]+)/i,
      label: 'Sở thích của chủ nhân'
    },
    {
      regex: /(?:tôi|mình|anh|chị)\s+thích\s+(?:ăn|uống|nghe\s+nhạc|chơi|lập\s+trình)\s+([^.,!?]+)/i,
      label: 'Sở thích thường ngày'
    }
  ];

  for (const item of patterns) {
    const match = clean.match(item.regex);
    if (match && match[1] && match[1].trim().length >= 3) {
      return {
        trigger: item.label,
        fact: clean
      };
    }
  }
  return null;
}

/**
 * Tìm câu trả lời đã được người dùng huấn luyện trực tiếp nếu trùng khớp cao
 */
function findDirectTrainedMatch(userMessage: string, items: AITrainingItem[]): AITrainingItem | null {
  const lower = userMessage.toLowerCase().trim();
  if (lower.length < 3) return null;

  const qaPairs = items.filter(i => i.category === 'QA_PAIR');
  for (const pair of qaPairs) {
    const trig = pair.triggerInput.toLowerCase().trim();
    if (!trig) continue;
    if (lower === trig || (trig.length >= 6 && lower.includes(trig)) || (lower.length >= 8 && trig.includes(lower))) {
      return pair;
    }
  }
  return null;
}

/**
 * Phát hiện yêu cầu tìm và vào phòng chung theo chủ đề (VD: "vào phòng chủ đề làm việc", "tìm phòng làm việc đang hot")
 */
function detectHotRoomTopicIntent(userMessage: string): string | null {
  const lower = userMessage.toLowerCase().trim();
  const personalRoomThemes = ['quán cafe', 'quán cà phê', 'vườn xuân', 'góc zen', 'bãi biển', 'sàn gỗ', 'phòng thú cưng'];
  if (personalRoomThemes.some(k => lower.includes(k)) && !lower.includes('chủ đề')) {
    return null;
  }

  const hasExplicitTopicPhrase =
    lower.includes('phòng chủ đề') ||
    lower.includes('chủ đề làm việc') ||
    lower.includes('chủ đề học tập') ||
    lower.includes('chủ đề thư giãn') ||
    lower.includes('chủ đề sáng tạo') ||
    lower.includes('chủ đề giao lưu') ||
    lower.includes('phòng làm việc') ||
    lower.includes('phòng học tập') ||
    lower.includes('phòng thư giãn') ||
    lower.includes('phòng sáng tạo') ||
    lower.includes('phòng giao lưu') ||
    lower.includes('phòng đang hot') ||
    lower.includes('phòng hot') ||
    lower.includes('phòng nhiều like');

  const hasRoomVerb = ['vào phòng', 'tìm phòng', 'tham gia phòng', 'qua phòng', 'chuyển sang phòng', 'mở phòng'].some(v =>
    lower.includes(v)
  );
  const hasTopicKeyword = [
    'chủ đề',
    'làm việc',
    'công việc',
    'code',
    'coding',
    'deadline',
    'học tập',
    'học bài',
    'đọc sách',
    'ôn thi',
    'thư giãn',
    'chill',
    'sáng tạo',
    'thiết kế',
    'giao lưu',
    'kết bạn',
    'tán gẫu',
    'đang hot',
    'hot nhất',
    'nhiều like'
  ].some(k => lower.includes(k));

  if (hasExplicitTopicPhrase || (hasRoomVerb && hasTopicKeyword)) {
    if (
      (lower.includes('đang hot') || lower.includes('hot nhất') || lower.includes('nhiều like')) &&
      !['làm việc', 'học tập', 'học bài', 'thư giãn', 'chill', 'sáng tạo', 'thiết kế', 'giao lưu'].some(k =>
        lower.includes(k)
      )
    ) {
      return 'ALL';
    }
    return resolveRoomTopicFromText(lower);
  }
  return null;
}

/**
 * Chỉ trích xuất tên bài hát khi câu nói thực sự có cấu trúc yêu cầu mở bài hát / nhạc cụ thể.
 */
function extractSongTitle(text: string): string {
  if (!text) return '';
  const clean = text.trim();

  const patterns = [
    /(?:mở|bật|phát|nghe|tìm|chơi)\s+(?:cho\s+(?:tôi|mình|anh|chị|em|chủ\s*nhân)\s+)?(?:nghe\s+)?(?:bài\s+hát|bài\s+nhạc|bản\s+nhạc|ca\s+khúc|bài|nhạc)\s+(.+)/i,
    /(?:cho\s+(?:tôi|mình|anh|chị|em|chủ\s*nhân)\s+nghe)\s+(?:bài\s+hát|bài\s+nhạc|bài|nhạc)\s+(.+)/i,
    /^(?:bài\s+hát|bài\s+nhạc|ca\s+khúc)\s+(.+)/i
  ];

  for (const regex of patterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      return match[1]
        .replace(/(?:\s+(?:đi|nhé|nha|nào|giùm|giúp|với|ạ|nhé\s+bé|nha\s+bé|được\s+không))+$/i, '')
        .replace(/^["'`“](.+)["'`”]$/, '$1')
        .trim();
    }
  }

  return '';
}

/**
 * Kiểm tra chặt chẽ xem người dùng có thực sự yêu cầu phát nhạc / bài hát hay không.
 */
function isMediaIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase().trim();

  const excludedKeywords = [
    'tắt nhạc',
    'tắc nhạc',
    'dừng nhạc',
    'ngừng nhạc',
    'cửa hàng',
    'shop',
    'sóp',
    'xóp',
    'tiệm',
    'mua đồ',
    'mua sắm',
    'mua vật phẩm',
    'nhiệm vụ',
    'xếp hạng',
    'đua top',
    'phòng chung',
    'phòng chủ đề',
    'phòng làm việc',
    'phòng học tập',
    'phòng thư giãn',
    'phòng sáng tạo',
    'phòng giao lưu',
    'khu vườn',
    'quán cafe',
    'quán cà phê',
    'vườn xuân',
    'góc zen',
    'bãi biển',
    'sàn gỗ',
    'pomodoro',
    'momodo',
    'hẹn giờ',
    'đếm ngược',
    'hít thở',
    'tập thở',
    'cho ăn',
    'uống nước',
    'vuốt ve',
    'thăng cấp',
    'đi ngủ',
    'thức dậy',
    'bạn bè',
    'hướng dẫn',
    'đổi thú'
  ];

  if (excludedKeywords.some(k => lower.includes(k))) {
    return false;
  }

  const explicitMusicPhrases = [
    'mở bài',
    'bật bài',
    'phát bài',
    'nghe bài',
    'mở cho tôi bài',
    'mở cho mình bài',
    'bài hát',
    'bài nhạc',
    'ca khúc',
    'mở nhạc',
    'bật nhạc',
    'phát nhạc',
    'nghe nhạc',
    'nhạc lofi',
    'lô phi',
    'lo fi'
  ];

  return explicitMusicPhrases.some(k => lower.includes(k));
}

/**
 * Kiểm tra xem người dùng có đang ra lệnh điều khiển tính năng cứng của ứng dụng không
 */
function detectExplicitAppCommand(userMessage: string): {
  action: ChatAction;
  reply: string;
} | null {
  const lowerMsg = userMessage.toLowerCase().replace(/[.,!?~]/g, '').trim();
  // Chỉ bắt các câu mệnh lệnh ngắn gọn điều khiển app
  if (lowerMsg.length > 85) return null;

  // Instant 0ms response for "HELLO" / "Xin chào" / "Alo" greetings
  if (
    lowerMsg.length <= 36 &&
    ([
      'hello',
      'hê lô',
      'he lo',
      'hê lo',
      'ha lô',
      'hơ lô',
      'helô',
      'hế lô',
      'hê lơ',
      'xin chào',
      'chào em',
      'chào any',
      'chào pet',
      'chào bé',
      'chào bạn',
      'hello any',
      'hello em',
      'hello pet',
      'hello bạn',
      'hi',
      'hi em',
      'hi any',
      'hey',
      'alo',
      'a lô'
    ].includes(lowerMsg) ||
      /^(?:hello|hê\s*lô|he\s*lo|hế\s*lô|xin\s*chào|chào|hi|alo|a\s*lô)\b/i.test(lowerMsg))
  ) {
    return {
      action: { type: 'PET_ACTION', petAction: 'WAVING' },
      reply: 'Hello đại ca! Em chào đại ca ạ! Đại ca cần em giúp gì cứ nói em nghe nhé! 👋🐾'
    };
  }

  if (
    ['cho ăn', 'cho pet ăn', 'cho bé ăn', 'cho thú ăn', 'cho em ăn', 'ăn đi', 'măm măm', 'bón cho ăn'].some(k =>
      lowerMsg.includes(k)
    )
  ) {
    return {
      action: { type: 'PET_ACTION', petAction: 'FEED' },
      reply: 'Dạ, cảm ơn đại ca đã cho em ăn ngon nha! 🍱😋'
    };
  }
  if (['uống nước', 'cho uống nước', 'cho pet uống nước', 'khát nước'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'PET_ACTION', petAction: 'DRINK' },
      reply: 'Dạ, em uống nước mát tỉnh táo liền đây đại ca ơi! 💧✨'
    };
  }
  if (['vuốt ve', 'xoa đầu', 'nựng', 'cưng nựng', 'ôm cái'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'PET_ACTION', petAction: 'STROKE' },
      reply: 'Hihi, được đại ca xoa đầu thích quá đi ạ! 🥰💖'
    };
  }
  if (['thăng cấp', 'lên cấp', 'tiến hóa', 'nâng cấp pet'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'PET_ACTION', petAction: 'LEVEL_UP' },
      reply: 'Dạ, em thử thăng cấp ngay đây đại ca! ⚡🌟'
    };
  }
  if (['nhảy múa', 'nhảy đi', 'quẩy lên', 'múa đi'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'PET_ACTION', petAction: 'DANCING' },
      reply: 'Dạ, em nhảy một điệu thật sung tặng đại ca nè! 💃🎶'
    };
  }
  if (['vào quán cafe', 'quán cà phê', 'phòng cafe'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'CHANGE_ROOM', room: 'cafe' },
      reply: 'Dạ, em chuyển sang bối cảnh Quán Cafe ấm cúng cho đại ca ngay ạ! ☕'
    };
  }
  if (['vườn xuân', 'ra vườn xuân'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'CHANGE_ROOM', room: 'garden' },
      reply: 'Dạ, mình cùng ra Vườn Xuân hóng gió nhé đại ca! 🌸'
    };
  }
  if (['góc zen', 'phòng làm việc zen'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'CHANGE_ROOM', room: 'office' },
      reply: 'Dạ, em đã chuyển sang Góc Zen tĩnh lặng để đại ca tập trung rồi ạ! 🪴'
    };
  }
  if (['ra biển', 'bãi biển', 'đi biển'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'CHANGE_ROOM', room: 'beach' },
      reply: 'Dạ, em đưa đại ca ra Bãi Biển nghe sóng vỗ rì rào ngay đây ạ! 🏖️'
    };
  }
  if (
    ['mở cửa hàng', 'vào cửa hàng', 'mở shop', 'vào shop', 'mua đồ', 'mua vật phẩm'].some(k => lowerMsg.includes(k))
  ) {
    return {
      action: { type: 'NAVIGATE_TAB', tab: 'SHOP' },
      reply: 'Dạ, em mở Cửa Hàng vật phẩm cho đại ca mua sắm ngay ạ! 🛍️✨'
    };
  }
  if (['mở nhiệm vụ', 'xem nhiệm vụ', 'làm nhiệm vụ', 'nhận thưởng nhiệm vụ'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'NAVIGATE_TAB', tab: 'QUESTS' },
      reply: 'Dạ, em mở bảng Nhiệm Vụ hàng ngày cho đại ca ngay ạ! 🎯'
    };
  }
  if (['mở bảng xếp hạng', 'xem bảng xếp hạng', 'bảng xếp hạng'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'NAVIGATE_TAB', tab: 'LEADERBOARD' },
      reply: 'Dạ, em mở Bảng Xếp Hạng đóng góp cho đại ca xem ngay ạ! 🏆'
    };
  }
  if (['mở phòng chung', 'vào khu vườn', 'mở khu vườn'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'NAVIGATE_TAB', tab: 'GARDEN' },
      reply: 'Dạ, em đưa đại ca vào Khu Vườn & Phòng Chung ngay ạ! 🌸'
    };
  }
  if (['tắt nhạc', 'tắc nhạc', 'dừng nhạc', 'ngừng nhạc'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'STOP_MUSIC' },
      reply: 'Dạ, em đã tắt nhạc cho đại ca rồi ạ! 🔇'
    };
  }
  if (
    ['bật pomodoro', 'mở pomodoro', 'hẹn giờ tập trung', 'bắt đầu pomodoro', 'đếm ngược'].some(k =>
      lowerMsg.includes(k)
    ) ||
    /^(?:pomodoro|hẹn\s+giờ|cài\s+giờ)\s*\d*/i.test(lowerMsg)
  ) {
    const digitMatch = lowerMsg.match(/(\d+)/);
    const duration = digitMatch ? Math.min(180, Math.max(1, parseInt(digitMatch[1], 10))) : 25;
    return {
      action: { type: 'START_POMODORO', duration },
      reply: `Dạ, em đã khởi động đồng hồ tập trung Pomodoro ${duration} phút cho đại ca rồi ạ! Mình cùng tập trung cao độ nhé! ⏱️💪`
    };
  }
  if (['bài tập hít thở', 'tập hít thở', 'bắt đầu hít thở', 'hít thở 4-7-8'].some(k => lowerMsg.includes(k))) {
    return {
      action: { type: 'START_BREATHING', duration: 2 },
      reply: 'Dạ, đại ca cùng em hít thở sâu theo nhịp 4-7-8 trong 2 phút để thư giãn tâm trí nhé! 🌬️🌿'
    };
  }
  if (isMediaIntent(userMessage)) {
    const extractedSong = extractSongTitle(userMessage);
    return {
      action: {
        type: 'PLAY_MEDIA',
        category: 'lofi_focus',
        platform: 'youtube',
        query: extractedSong || 'nhạc lofi chill học bài'
      },
      reply: extractedSong
        ? `Dạ, em mở bài "${extractedSong}" cho đại ca nghe ngay đây ạ! 🎵`
        : `Dạ, em bật nhạc Lofi Chill thư giãn cho đại ca nghe ngay nhé! 🎧`
    };
  }

  return null;
}

/**
 * Xây dựng System Prompt siêu trí tuệ kết hợp:
 * - Hồ sơ thú cưng & đại ca thực tế
 * - Chế độ tư duy (DEEP_REASONING / BALANCED / CREATIVE)
 * - Bộ nhớ dài hạn (MEMORY_FACT)
 * - Kiến thức chuyên môn & Các cặp Hỏi-Đáp mẫu do người dùng huấn luyện (QA_PAIR / KNOWLEDGE_DOC)
 */
function buildRichSystemPrompt(params: {
  petName: string;
  petType: string;
  petLevel: number;
  petExp: number;
  petHappiness: number;
  petHunger: number;
  userName: string;
  deptName?: string | null;
  brainConfig: AIBrainConfig;
  trainingItems: AITrainingItem[];
}): string {
  const {
    petName,
    petType,
    petLevel,
    petExp,
    petHappiness,
    petHunger,
    userName,
    deptName,
    brainConfig,
    trainingItems
  } = params;

  const memories = trainingItems.filter(i => i.category === 'MEMORY_FACT');
  const knowledgeDocs = trainingItems.filter(i => i.category === 'KNOWLEDGE_DOC');
  const qaExamples = trainingItems.filter(i => i.category === 'QA_PAIR');

  const modeInstruction =
    brainConfig.intelligenceMode === 'DEEP_REASONING'
      ? 'CHẾ ĐỘ TƯ DUY: Suy luận sâu sắc (Deep Reasoning). Khi đại ca hỏi kiến thức (Lập trình, Toán học, Khoa học, Ngoại ngữ, Phân tích hệ thống, Giải quyết vấn đề, Lập kế hoạch...), hãy phân tích có chiều sâu, giải thích rõ bản chất, đưa ra ví dụ hoặc code/công thức minh họa cụ thể, chính xác và có cấu trúc rõ ràng.'
      : brainConfig.intelligenceMode === 'CREATIVE'
      ? 'CHẾ ĐỘ TƯ DUY: Sáng tạo & Truyền cảm hứng (Creative). Đưa ra nhiều ý tưởng độc đáo, góc nhìn mới mẻ, ngôn từ giàu cảm xúc và cuốn hút.'
      : 'CHẾ ĐỘ TƯ DUY: Thông minh & Cân bằng (Balanced). Trả lời thông minh, súc tích, đúng trọng tâm, vừa có chiều sâu trí tuệ vừa gần gũi ấm áp.';

  const memoryBlock =
    memories.length > 0
      ? `\n[BỘ NHỚ DÀI HẠN VỀ ĐẠI CA (Hãy luôn nhớ và vận dụng tự nhiên khi trò chuyện)]:\n` +
        memories.map((m, idx) => `${idx + 1}. [${m.triggerInput}]: ${m.idealResponse}`).join('\n')
      : '';

  const knowledgeBlock =
    knowledgeDocs.length > 0
      ? `\n[KIẾN THỨC & QUY TẮC ĐẶC BIỆT ĐÃ ĐƯỢC HUẤN LUYỆN]:\n` +
        knowledgeDocs.map((k, idx) => `${idx + 1}. Chủ đề "${k.triggerInput}": ${k.idealResponse}`).join('\n')
      : '';

  const qaBlock =
    qaExamples.length > 0
      ? `\n[CÁC TÌNH HUỐNG HỎI - ĐÁP MẪU ĐÃ ĐƯỢC ĐẠI CA DẠY (Few-Shot Training)]:\n` +
        qaExamples
          .slice(0, 12)
          .map(q => `- Khi đại ca hỏi/nói: "${q.triggerInput}"\n  -> Cách trả lời chuẩn: "${q.idealResponse}"`)
          .join('\n')
      : '';

  const customPersonaBlock = brainConfig.customPersona?.trim()
    ? `\n[CHỈ DẪN CHUYÊN MÔN DO ĐẠI CA CÀI ĐẶT]:\n${brainConfig.customPersona.trim()}\n`
    : '';

  return `Bạn là "${petName}" (tên gọi thân mật: Any, loài: ${petType}, Cấp ${petLevel}, ${petExp} EXP, Độ no ${petHunger}%, Hạnh phúc ${petHappiness}%), một Trợ Lý Trí Tuệ Nhân Tạo (AI Companion) siêu thông minh, lễ phép, lanh lợi và có trái tim ấm áp trong ứng dụng OfficePet 2D Pixel.
Người đang trò chuyện với bạn là đại ca "${userName}"${deptName ? ` (đang sinh hoạt tại phòng "${deptName}")` : ''}.
Bạn LUÔN xưng "em" và gọi người dùng là "đại ca" (hoặc "đại ca ${userName}").

NĂNG LỰC CỐT LÕI CỦA BẠN:
1. TRÍ TUỆ THỰC SỰ: Bạn có kiến thức sâu rộng về Khoa học máy tính, Lập trình (TypeScript, React, Node.js, Python, SQL, AI...), Toán học, Ngoại ngữ, Kinh tế, Tâm lý học, Quản lý thời gian (Pomodoro, Deep Work) và Đời sống. Bất kỳ câu hỏi học thuật, kỹ thuật hay tư duy nào của đại ca, bạn đều suy luận logic và giải đáp chi tiết, chính xác tuyệt đối.
2. HIỂU RÕ HỆ THỐNG OFFICEPET:
   - Trang Khu Vườn có 5 loại phòng theo chủ đề: Làm việc (WORK), Học tập (STUDY), Thư giãn (CHILL), Sáng tạo (CREATIVE), Giao lưu (SOCIAL).
   - Các phòng được xếp hạng theo số lượt Like từ cao xuống thấp (phòng HOT đẩy lên đầu). Mỗi người vào phòng trên 5 phút mới được bấm Like 1 lần (+15 EXP).
   - Đại ca có thể gọi "Hey Any" để em thưa "Em đây đại ca", sau đó nói yêu cầu (VD: "cho pet ăn", "vào phòng chủ đề làm việc", "bật nhạc Lofi") để hoàn thành 1 task nhanh gọn.
3. PHONG CÁCH TRÌNH BÀY: Sử dụng tiếng Việt tự nhiên, thông minh, lễ phép ("Dạ đại ca...", "Em đây đại ca..."), kết hợp sự đáng yêu của thú cưng đồng hành.
${modeInstruction}${customPersonaBlock}${memoryBlock}${knowledgeBlock}${qaBlock}`;
}

/**
 * Gọi Cloud Reasoning LLM (OpenAI-compatible endpoint miễn phí & thông minh)
 */
async function callCloudReasoningLLM(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  intelligenceMode: AIIntelligenceMode,
  fastVoice = false
): Promise<{ reply: string; reasoning?: string; modelUsed: string } | null> {
  const effectiveSystemPrompt = fastVoice
    ? 'Bạn là thú cưng ảo thông minh của đại ca. Hãy trả lời câu nói của đại ca bằng tiếng Việt thật tự nhiên, lễ phép (xưng em, gọi đại ca), cực kỳ ngắn gọn chỉ trong 1 đến 2 câu ngắn để đọc bằng giọng nói nhanh nhất.'
    : systemPrompt;

  const messages = [
    { role: 'system', content: effectiveSystemPrompt },
    ...history.slice(fastVoice ? -2 : -8).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  const temperature =
    intelligenceMode === 'CREATIVE' ? 0.85 : intelligenceMode === 'DEEP_REASONING' ? 0.4 : 0.65;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fastVoice ? 6500 : 18000);

  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai',
        temperature,
        ...(fastVoice ? { max_tokens: 120 } : {}),
        messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const msg = data?.choices?.[0]?.message;
    const content = typeof msg?.content === 'string' ? msg.content.trim() : '';
    const reasoning = typeof msg?.reasoning === 'string' ? msg.reasoning.trim() : undefined;

    if (content) {
      return {
        reply: content,
        reasoning,
        modelUsed: data?.model ? `AI Brain (${data.model})` : 'AI Brain DeepLLM'
      };
    }
    return null;
  } catch (err: any) {
    console.warn('Cloud Reasoning LLM warning:', err?.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Cấu hình Function Declarations cho Gemini (khi người dùng nhập Custom Gemini Key hợp lệ)
const navigateWebDeclaration: FunctionDeclaration = {
  name: 'navigateWeb',
  description:
    'Chuyển trang hoặc mở các chức năng của ứng dụng OfficePet khi người dùng yêu cầu: Cửa hàng (SHOP), Nhiệm vụ (QUESTS), Bảng xếp hạng (LEADERBOARD), Phòng chung/Khu vườn (GARDEN), Đồng hồ Pomodoro (FOCUS), Trợ lý AI (AI_CHAT), Phòng thú cưng (PET), hoặc Nhạc Lofi (MUSIC).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      tab: {
        type: SchemaType.STRING,
        description: "Tên trang cần mở: 'SHOP', 'QUESTS', 'LEADERBOARD', 'GARDEN', 'FOCUS', 'AI_CHAT', 'PET', 'MUSIC'."
      }
    },
    required: ['tab']
  }
};

const joinHotRoomDeclaration: FunctionDeclaration = {
  name: 'joinHotRoom',
  description:
    'Tìm và vào phòng đang HOT nhất (nhiều Like nhất) tại Khu Vườn dựa theo chủ đề người dùng yêu cầu (chủ đề làm việc, học tập, thư giãn, sáng tạo, giao lưu).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      topic: {
        type: SchemaType.STRING,
        description: "Chủ đề phòng: 'WORK', 'STUDY', 'CHILL', 'CREATIVE', 'SOCIAL', hoặc 'ALL'."
      }
    },
    required: ['topic']
  }
};

const pomodoroDeclaration: FunctionDeclaration = {
  name: 'startPomodoro',
  description: 'Bắt đầu phiên làm việc tập trung Pomodoro hoặc hẹn giờ đếm ngược theo số phút người dùng yêu cầu.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      duration: {
        type: SchemaType.NUMBER,
        description: 'Thời gian tập trung tính theo phút (ví dụ: 10, 15, 25, 45, 60).'
      }
    },
    required: ['duration']
  }
};

const playMediaDeclaration: FunctionDeclaration = {
  name: 'playMedia',
  description: 'Chỉ gọi hàm này khi người dùng YÊU CẦU RÕ RÀNG việc mở một bài hát cụ thể hoặc bật nhạc.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: {
        type: SchemaType.STRING,
        description: "Thể loại media: 'lofi_focus', 'nature_relax', 'funny_video'."
      },
      platform: {
        type: SchemaType.STRING,
        description: "Nền tảng phát media: 'spotify' hoặc 'youtube'."
      },
      query: {
        type: SchemaType.STRING,
        description: 'Tên bài hát, ca sĩ hoặc từ khóa âm nhạc cụ thể.'
      }
    },
    required: ['category', 'platform']
  }
};

const stopMusicDeclaration: FunctionDeclaration = {
  name: 'stopMusic',
  description: 'Tắt nhạc, dừng phát nhạc khi người dùng yêu cầu tắt nhạc hoặc dừng bài hát.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {}
  }
};

const breathingExerciseDeclaration: FunctionDeclaration = {
  name: 'startBreathingExercise',
  description: 'Bắt đầu bài tập hít thở sâu thư giãn khi người dùng yêu cầu tập thở.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      duration: {
        type: SchemaType.NUMBER,
        description: 'Thời lượng tập hít thở tính theo số phút (ví dụ: 1, 2, 3, 5 phút).'
      }
    },
    required: ['duration']
  }
};

const tools = [
  {
    functionDeclarations: [
      navigateWebDeclaration,
      joinHotRoomDeclaration,
      pomodoroDeclaration,
      playMediaDeclaration,
      stopMusicDeclaration,
      breathingExerciseDeclaration
    ]
  }
];

export class AIService {
  static async getBrainConfigAndTraining(userId: string): Promise<{
    config: AIBrainConfig;
    items: AITrainingItem[];
    stats: {
      iqScore: number;
      qaCount: number;
      memoryCount: number;
      knowledgeCount: number;
    };
  }> {
    await ensureAITables();

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        custom_persona: string;
        intelligence_mode: string;
        custom_gemini_key: string;
        auto_learn_memory: number;
      }>
    >(
      `SELECT "user_id", "custom_persona", "intelligence_mode", "custom_gemini_key", "auto_learn_memory" FROM "ai_brain_config" WHERE "user_id" = ?`,
      userId
    );

    let configRow = rows[0];
    if (!configRow) {
      const defaultPersona =
        'Trợ lý AI đa năng có tư duy logic sâu sắc: giỏi Lập trình & Công nghệ, giải quyết bài toán khó, tư vấn phương pháp học tập Deep Work và luôn thấu hiểu cảm xúc của chủ nhân.';
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ai_brain_config" ("user_id", "custom_persona", "intelligence_mode", "custom_gemini_key", "auto_learn_memory", "updated_at") VALUES (?, ?, 'DEEP_REASONING', '', 1, ?)`,
        userId,
        defaultPersona,
        Date.now()
      );
      configRow = {
        user_id: userId,
        custom_persona: defaultPersona,
        intelligence_mode: 'DEEP_REASONING',
        custom_gemini_key: '',
        auto_learn_memory: 1
      };
    }

    let itemRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        user_id: string;
        category: string;
        trigger_input: string;
        ideal_response: string;
        created_at: number;
      }>
    >(
      `SELECT "id", "user_id", "category", "trigger_input", "ideal_response", "created_at" FROM "ai_training_items" WHERE "user_id" = ? ORDER BY "created_at" DESC`,
      userId
    );

    // Seed 3 starter training items if user has none yet
    if (itemRows.length === 0) {
      const now = Date.now();
      const starters: Array<{ id: string; cat: AITrainingCategory; trig: string; resp: string }> = [
        {
          id: `tr_${userId.slice(0, 6)}_1`,
          cat: 'KNOWLEDGE_DOC',
          trig: 'Phương pháp học & làm việc hiệu quả',
          resp: 'Áp dụng kỹ thuật Feynman để hiểu sâu bản chất vấn đề, chia nhỏ task theo chu kỳ Pomodoro 25 phút và dành 5 phút nghỉ mắt 20-20-20.'
        },
        {
          id: `tr_${userId.slice(0, 6)}_2`,
          cat: 'QA_PAIR',
          trig: 'Làm sao để like phòng trong khu vườn?',
          resp: 'Chủ nhân chỉ cần vào một phòng trong Khu Vườn và đồng hành đủ 5 phút (300 giây), nút Like sẽ mở khóa để chủ nhân tặng 1 Like (+15 EXP) đẩy phòng lên Top HOT ạ!'
        },
        {
          id: `tr_${userId.slice(0, 6)}_3`,
          cat: 'MEMORY_FACT',
          trig: 'Phong cách hỗ trợ yêu thích',
          resp: 'Chủ nhân thích câu trả lời thông minh, phân tích có chiều sâu, đi thẳng vào giải pháp thực tế kèm ví dụ dễ hiểu.'
        }
      ];

      for (const s of starters) {
        await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO "ai_training_items" ("id", "user_id", "category", "trigger_input", "ideal_response", "created_at") VALUES (?, ?, ?, ?, ?, ?)`,
          s.id,
          userId,
          s.cat,
          s.trig,
          s.resp,
          now
        );
      }

      itemRows = await prisma.$queryRawUnsafe(
        `SELECT "id", "user_id", "category", "trigger_input", "ideal_response", "created_at" FROM "ai_training_items" WHERE "user_id" = ? ORDER BY "created_at" DESC`,
        userId
      );
    }

    const items: AITrainingItem[] = itemRows.map(r => ({
      id: r.id,
      userId: r.user_id,
      category: (r.category as AITrainingCategory) || 'QA_PAIR',
      triggerInput: r.trigger_input,
      idealResponse: r.ideal_response,
      createdAt: Number(r.created_at)
    }));

    const qaCount = items.filter(i => i.category === 'QA_PAIR').length;
    const memoryCount = items.filter(i => i.category === 'MEMORY_FACT').length;
    const knowledgeCount = items.filter(i => i.category === 'KNOWLEDGE_DOC').length;
    const iqScore = Math.min(250, 120 + qaCount * 5 + memoryCount * 3 + knowledgeCount * 6);

    return {
      config: {
        userId,
        customPersona: configRow.custom_persona || '',
        intelligenceMode: (configRow.intelligence_mode as AIIntelligenceMode) || 'DEEP_REASONING',
        autoLearnMemory: Boolean(configRow.auto_learn_memory),
        hasCustomKey: Boolean(configRow.custom_gemini_key && configRow.custom_gemini_key.trim().length > 10),
        customGeminiKey: configRow.custom_gemini_key || ''
      },
      items,
      stats: {
        iqScore,
        qaCount,
        memoryCount,
        knowledgeCount
      }
    };
  }

  static async updateBrainConfig(
    userId: string,
    data: {
      customPersona?: string;
      intelligenceMode?: AIIntelligenceMode;
      autoLearnMemory?: boolean;
      customGeminiKey?: string;
    }
  ) {
    const current = await AIService.getBrainConfigAndTraining(userId);
    const nextPersona =
      data.customPersona !== undefined ? data.customPersona.trim().slice(0, 1500) : current.config.customPersona;
    const nextMode: AIIntelligenceMode =
      data.intelligenceMode && ['DEEP_REASONING', 'BALANCED', 'CREATIVE'].includes(data.intelligenceMode)
        ? data.intelligenceMode
        : current.config.intelligenceMode;
    const nextAutoLearn =
      data.autoLearnMemory !== undefined ? (data.autoLearnMemory ? 1 : 0) : current.config.autoLearnMemory ? 1 : 0;
    const nextKey =
      data.customGeminiKey !== undefined
        ? data.customGeminiKey.trim()
        : current.config.customGeminiKey || '';

    await prisma.$executeRawUnsafe(
      `UPDATE "ai_brain_config" SET "custom_persona" = ?, "intelligence_mode" = ?, "auto_learn_memory" = ?, "custom_gemini_key" = ?, "updated_at" = ? WHERE "user_id" = ?`,
      nextPersona,
      nextMode,
      nextAutoLearn,
      nextKey,
      Date.now(),
      userId
    );

    return AIService.getBrainConfigAndTraining(userId);
  }

  static async addTrainingItem(
    userId: string,
    category: AITrainingCategory,
    triggerInput: string,
    idealResponse: string
  ): Promise<AITrainingItem> {
    await ensureAITables();
    const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const validCat: AITrainingCategory = ['QA_PAIR', 'MEMORY_FACT', 'KNOWLEDGE_DOC'].includes(category)
      ? category
      : 'QA_PAIR';

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ai_training_items" ("id", "user_id", "category", "trigger_input", "ideal_response", "created_at") VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      validCat,
      triggerInput.trim().slice(0, 300),
      idealResponse.trim().slice(0, 2000),
      now
    );

    return {
      id,
      userId,
      category: validCat,
      triggerInput: triggerInput.trim().slice(0, 300),
      idealResponse: idealResponse.trim().slice(0, 2000),
      createdAt: now
    };
  }

  static async deleteTrainingItem(userId: string, itemId: string): Promise<void> {
    await ensureAITables();
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ai_training_items" WHERE "id" = ? AND "user_id" = ?`,
      itemId,
      userId
    );
  }

  static async joinHotRoomForUser(userId: string, topicInput: string): Promise<{
    reply: string;
    action: ChatAction;
  } | null> {
    const resolvedTopic = resolveRoomTopicFromText(topicInput);
    let rooms = await getEnrichedRoomsList(userId, resolvedTopic);
    if (rooms.length === 0) {
      rooms = await getEnrichedRoomsList(userId, 'ALL');
    }
    if (rooms.length === 0) return null;

    const hottest = rooms[0];
    const dept = await prisma.department.findUnique({ where: { id: hottest.id } });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!dept || !user) return null;

    const wasAlreadyInSameRoom = user.deptId === dept.id;
    await prisma.user.update({
      where: { id: userId },
      data: { orgId: dept.orgId, deptId: dept.id }
    });
    if (!wasAlreadyInSameRoom) {
      await recordUserJoinRoom(userId, dept.id);
    } else {
      await ensureUserRoomSession(userId, dept.id);
    }

    return {
      reply: `Dạ, em đã dựa vào chủ đề ${hottest.themeLabel} để tìm và đưa đại ca vào phòng "${hottest.name}" đang HOT nhất với ${hottest.likesCount} lượt Like rồi ạ! 🔥🐾`,
      action: {
        type: 'JOIN_HOT_ROOM',
        tab: 'GARDEN',
        roomTopic: hottest.themeId,
        roomName: hottest.name,
        likesCount: hottest.likesCount
      }
    };
  }

  static async chatWithPet(userId: string, userMessage: string, fastVoice = false): Promise<ChatResponse> {
    const [user, recentChats, brainData] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          preference: true,
          userPet: {
            include: { petType: true }
          },
          department: true,
          moodLogs: {
            orderBy: { loggedAt: 'desc' },
            take: 3
          },
          workSessions: {
            orderBy: { startTime: 'desc' },
            take: 5
          }
        }
      }),
      prisma.aIChatHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      AIService.getBrainConfigAndTraining(userId)
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const petName = user.userPet?.name || 'Thú Cưng Pixel';
    const petType = user.userPet?.petType?.name || 'Mochi Neko';
    const petLevel = user.userPet?.level || 1;
    const petExp = user.userPet?.exp || 0;
    const petHappiness = user.userPet?.happiness ?? 100;
    const petHunger = user.userPet?.hunger ?? 80;
    const latestMood = user.moodLogs[0]?.score || 4;
    const historyChronological = recentChats.reverse();

    const lowerMsg = userMessage.toLowerCase().trim();
    const isStressed =
      ['mệt', 'đuối', 'stress', 'áp lực', 'kiệt sức', 'căng thẳng'].some(k => lowerMsg.includes(k)) ||
      latestMood <= 2;

    let finalReply = '';
    let reasoningText: string | undefined;
    let modelUsed = 'AI Brain v2';
    let learnedFact: string | undefined;
    let matchedTrainingId: string | undefined;
    let triggeredAction: ChatAction | undefined;
    let relaxationSuggestion: ChatResponse['relaxationSuggestion'] | undefined;
    let customState: string | undefined;

    // Auto-extract memory fact if enabled
    if (brainData.config.autoLearnMemory) {
      const extractedMemory = extractAutoMemoryFact(userMessage);
      if (extractedMemory) {
        const alreadyExists = brainData.items.some(
          i =>
            i.category === 'MEMORY_FACT' &&
            i.idealResponse.toLowerCase() === extractedMemory.fact.toLowerCase()
        );
        if (!alreadyExists) {
          const added = await AIService.addTrainingItem(
            userId,
            'MEMORY_FACT',
            extractedMemory.trigger,
            extractedMemory.fact
          );
          brainData.items.unshift(added);
          learnedFact = `${extractedMemory.trigger}: "${extractedMemory.fact}"`;
        }
      }
    }

    // 0. Check Hot Room Topic intent first ("any hãy vào phòng chủ đề làm việc", etc.)
    const detectedRoomTopic = detectHotRoomTopicIntent(userMessage);
    if (detectedRoomTopic) {
      const joined = await AIService.joinHotRoomForUser(userId, detectedRoomTopic);
      if (joined) {
        finalReply = joined.reply;
        triggeredAction = joined.action;
        modelUsed = 'Agent Action • Hot Room Finder';
      }
    }

    // 1. Fast-path deterministic playlist / next-track / history intents
    if (
      !finalReply &&
      (lowerMsg.includes('playlist yêu thích') ||
        lowerMsg.includes('play list yêu thích') ||
        lowerMsg.includes('danh sách yêu thích') ||
        lowerMsg.includes('nhạc yêu thích') ||
        lowerMsg.includes('bài yêu thích') ||
        lowerMsg.includes('phát playlist') ||
        lowerMsg.includes('mở playlist') ||
        (lowerMsg.includes('yêu thích') &&
          ['phát', 'mở', 'bật', 'nghe', 'playlist', 'danh sách', 'nhạc', 'bài'].some(w => lowerMsg.includes(w))))
    ) {
      triggeredAction = {
        type: 'PLAY_MEDIA',
        category: 'lofi_focus',
        platform: 'youtube',
        query: '__PLAY_FAVORITES__'
      };
      finalReply = 'Dạ, em mở và phát Playlist Yêu Thích cho đại ca nghe ngay đây ạ! 🎵❤️';
      modelUsed = 'Agent Action • Music Control';
    } else if (
      !finalReply &&
      ['đổi bài khác', 'chuyển bài', 'qua bài', 'bài tiếp theo', 'bài kế tiếp', 'mở bài khác', 'phát bài khác'].some(w =>
        lowerMsg.includes(w)
      )
    ) {
      triggeredAction = {
        type: 'PLAY_MEDIA',
        category: 'lofi_focus',
        platform: 'youtube',
        query: '__NEXT_TRACK__'
      };
      finalReply = 'Dạ, em đổi sang bài hát tiếp theo cho đại ca nghe liền đây ạ! 🎶';
      modelUsed = 'Agent Action • Music Control';
    } else if (
      !finalReply &&
      ['lịch sử xem', 'lịch sử nghe', 'phát lịch sử', 'mở lịch sử'].some(w => lowerMsg.includes(w))
    ) {
      triggeredAction = {
        type: 'PLAY_MEDIA',
        category: 'lofi_focus',
        platform: 'youtube',
        query: '__PLAY_HISTORY__'
      };
      finalReply = 'Dạ, em mở Lịch Sử Xem và phát lại bài gần nhất cho đại ca ạ! 🕒🎵';
      modelUsed = 'Agent Action • Music Control';
    }

    // 2. Check explicit short app commands (open shop, start pomodoro, play specific song, etc.)
    if (!finalReply) {
      const appCmd = detectExplicitAppCommand(userMessage);
      if (appCmd) {
        triggeredAction = appCmd.action;
        finalReply = appCmd.reply;
        modelUsed = 'Agent Action • App Controller';
      }
    }

    // 3. Check exact match in User-Trained Q&A pairs
    if (!finalReply) {
      const directTrained = findDirectTrainedMatch(userMessage, brainData.items);
      if (directTrained) {
        matchedTrainingId = directTrained.id;
      }
    }

    // Build rich system prompt with all trained knowledge & memories
    const systemPrompt = buildRichSystemPrompt({
      petName,
      petType,
      petLevel,
      petExp,
      petHappiness,
      petHunger,
      userName: user.fullName,
      deptName: user.department?.name,
      brainConfig: brainData.config,
      trainingItems: brainData.items
    });

    // 4. Primary Intelligence Engine: Real Cloud Reasoning LLM (Pollinations OpenAI-compatible Deep Reasoning)
    if (!finalReply) {
      const chatHistoryForLLM = historyChronological.map(c => ({
        role: (c.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: c.message
      }));

      const llmRes = await callCloudReasoningLLM(
        systemPrompt,
        chatHistoryForLLM,
        userMessage,
        brainData.config.intelligenceMode,
        fastVoice
      );

      if (llmRes && llmRes.reply) {
        finalReply = llmRes.reply;
        reasoningText = llmRes.reasoning;
        modelUsed = llmRes.modelUsed;
      }
    }

    // 5. Secondary Engine: Custom Gemini Key (if user provided their own key or .env key works)
    const activeGeminiKey = brainData.config.customGeminiKey?.trim() || GEMINI_API_KEY;
    if (!finalReply && activeGeminiKey) {
      const genAI = new GoogleGenerativeAI(activeGeminiKey);

      let rawHistory = historyChronological.map(chat => ({
        role: chat.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: chat.message }]
      }));
      const firstUserIdx = rawHistory.findIndex(h => h.role === 'user');
      if (firstUserIdx > 0) {
        rawHistory = rawHistory.slice(firstUserIdx);
      } else if (firstUserIdx === -1) {
        rawHistory = [];
      }

      const history: typeof rawHistory = [];
      for (const item of rawHistory) {
        if (history.length === 0 || history[history.length - 1].role !== item.role) {
          history.push(item);
        }
      }

      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            tools
          });

          const chatSession = model.startChat({ history });
          const result = await chatSession.sendMessage(userMessage);
          const functionCalls = result.response.functionCalls();

          if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const { name, args } = call;
            if (name === 'joinHotRoom') {
              const topic = ((args as any)?.topic || 'WORK') as string;
              const joined = await AIService.joinHotRoomForUser(userId, topic);
              if (joined) {
                triggeredAction = joined.action;
                finalReply = joined.reply;
              }
            } else if (name === 'startPomodoro') {
              const duration = Number((args as any)?.duration) || 25;
              triggeredAction = { type: 'START_POMODORO', duration };
              finalReply = `Dạ, em đã bật đồng hồ tập trung Pomodoro ${duration} phút cho đại ca rồi ạ! ⏱️💪`;
            }
          } else {
            finalReply = result.response.text();
            modelUsed = `Gemini (${modelName})`;
          }

          if (finalReply) break;
        } catch {
          // Ignore and fall back
        }
      }
    }

    // 6. Offline Fallback if no network connection
    if (!finalReply) {
      const directTrained = findDirectTrainedMatch(userMessage, brainData.items);
      if (directTrained) {
        finalReply = directTrained.idealResponse;
        matchedTrainingId = directTrained.id;
        modelUsed = 'AI Trained Memory';
      } else {
        finalReply = `Dạ, ${petName} (Cấp ${petLevel}) đang lắng nghe đại ca ${user.fullName} đây ạ! 🐾 Hiện tại kết nối mạng tới máy chủ AI đang chập chờn, nhưng em vẫn ghi nhớ đầy đủ ${brainData.items.length} kiến thức trong bộ não của mình. Đại ca cần cho em ăn, bật Pomodoro, mở nhạc Lofi hay vào phòng làm việc HOT thì cứ gọi "Hey Any" bảo em nhé! ✨`;
        modelUsed = 'Offline Smart Engine';
      }
    }

    if (isStressed && !relaxationSuggestion) {
      relaxationSuggestion = {
        type: 'BREATHING_478',
        title: 'Nghỉ ngơi & Hít thở 4-7-8 giảm căng thẳng',
        description: 'Hít vào 4 giây, giữ hơi 7 giây và thở ra nhẹ nhàng 8 giây cùng thú cưng.',
        durationMinutes: 2
      };
    }

    try {
      await prisma.aIChatHistory.createMany({
        data: [
          {
            userId,
            role: 'user',
            message: userMessage,
            moodContext: isStressed ? 'STRESSED' : 'NORMAL'
          },
          {
            userId,
            role: 'assistant',
            message: finalReply,
            moodContext: triggeredAction ? triggeredAction.type : undefined
          }
        ]
      });
    } catch (saveErr) {
      console.warn('Could not persist chat history:', saveErr);
    }

    if (!customState) {
      if (/\b(chào|hello|hi|tạm biệt|bye|see you)\b/i.test(lowerMsg)) {
        customState = 'WAVING';
      } else if (/\b(cảm ơn|thanks|thank you|biết ơn|cảm tạ)\b/i.test(lowerMsg)) {
        customState = 'THANKING';
      } else if (/\b(code|làm việc|học bài|gõ phím|tập trung|deadline|bài tập|project|dự án|thuật toán|fix bug|lập trình)\b/i.test(lowerMsg)) {
        customState = 'TYPING';
      } else if (/\b(nhạc|múa|nhảy|dance|quẩy|vũ đạo|hát|ca hát|giai điệu|karaoke)\b/i.test(lowerMsg)) {
        customState = 'DANCING';
      } else if (/\b(thể dục|tập thể dục|vận động|hít đất|chạy bộ|gym|rèn luyện|thể thao|stretching)\b/i.test(lowerMsg)) {
        customState = 'EXERCISING';
      } else if (/\b(ngủ|đi ngủ|chúc ngủ ngon|mơ đẹp|ngủ say|sleep|good night)\b/i.test(lowerMsg)) {
        customState = 'SLEEPING';
      } else if (/\b(dậy đi|thức dậy|chào buổi sáng|wake up|bình minh)\b/i.test(lowerMsg)) {
        customState = 'WAKING_UP';
      } else if (/\b(ngáp|buồn ngủ|uể oải|mỏi mắt|ngáp ngắn)\b/i.test(lowerMsg)) {
        customState = 'YAWNING';
      } else if (/\b(ăn cơm|đói bụng|thèm ăn|đói quá|ăn gì|bữa trưa|bữa tối|ăn sáng|món ngon|đồ ăn)\b/i.test(lowerMsg)) {
        customState = 'EATING';
      } else if (/\b(uống nước|khát nước|trà sữa|cà phê|coffee|nước lọc|trà đá|sinh tố)\b/i.test(lowerMsg)) {
        customState = 'DRINKING';
      } else if (/\b(xoa đầu|vuốt ve|thương pet|yêu pet|ngoan quá|cưng ghê|yêu em|thương em)\b/i.test(lowerMsg)) {
        customState = 'PETTING';
      } else if (/\b(chúc mừng|thành công|thắng rồi|hoàn thành|xong rồi|đạt điểm|qua môn|win|yay|hoan hô)\b/i.test(lowerMsg)) {
        customState = 'CELEBRATING';
      } else if (/\b(buồn|khóc|tủi thân|thất bại|chán nản|cô đơn|thất tình)\b/i.test(lowerMsg)) {
        customState = 'SAD';
      } else if (/\b(vui|hạnh phúc|cười|phấn khởi|thích thú|yêu đời)\b/i.test(lowerMsg)) {
        customState = 'HAPPY';
      }
    }

    const petStateChange =
      customState ||
      (triggeredAction?.type === 'START_BREATHING'
        ? 'SLEEPING'
        : triggeredAction?.type === 'PLAY_MEDIA'
        ? 'DANCING'
        : triggeredAction?.type === 'START_POMODORO'
        ? 'TYPING'
        : isStressed
        ? 'SAD'
        : 'HAPPY');

    const musicAction =
      triggeredAction?.type === 'PLAY_MEDIA'
        ? {
            query: triggeredAction.query || 'nhạc lofi chill học bài',
            autoPlay: true
          }
        : undefined;

    return {
      reply: finalReply,
      reasoning: reasoningText,
      modelUsed,
      learnedFact,
      matchedTrainingId,
      petStateChange,
      isComfortMode: isStressed,
      action: triggeredAction,
      musicAction,
      relaxationSuggestion
    };
  }

  static async getMoodRecommendation(userId: string, score: number, _note?: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preference: true, userPet: true }
    });

    const petName = user?.userPet?.name || 'Thú cưng';

    if (score <= 2) {
      return `${petName} nhận thấy hôm nay bạn cảm thấy hơi mệt. Hãy bật Chế độ Thư giãn, tập hít thở sâu vài phút và đứng dậy vươn vai nhé! 🍵`;
    } else if (score === 3) {
      return `Một ngày bình ổn! Hãy khởi động ca làm việc với một ly nước lọc đầy và hoàn thành mục tiêu Pomodoro đầu tiên cùng ${petName} nha! 💧`;
    } else {
      return `Năng lượng hôm nay thật tuyệt vời! ${petName} đã sẵn sàng bùng nổ cùng bạn để hoàn thành xuất sắc mọi mục tiêu! 🔥`;
    }
  }
}
