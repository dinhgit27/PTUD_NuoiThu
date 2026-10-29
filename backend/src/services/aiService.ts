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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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
 * Tuyệt đối KHÔNG nhận nhầm các lệnh "mở cửa hàng", "mở nhiệm vụ", "tắt nhạc", hoặc trò chuyện thông thường.
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

// 1. Cấu hình Function Declarations (Tools) huấn luyện cho Gemini hiểu toàn bộ chức năng Web
const navigateWebDeclaration: FunctionDeclaration = {
  name: 'navigateWeb',
  description:
    'Chuyển trang hoặc mở các chức năng của ứng dụng OfficePet khi người dùng yêu cầu: Cửa hàng (SHOP), Nhiệm vụ (QUESTS), Bảng xếp hạng (LEADERBOARD), Phòng chung/Khu vườn (GARDEN), Đồng hồ Pomodoro (FOCUS), Trợ lý AI (AI_CHAT), Phòng thú cưng (PET), hoặc Nhạc Lofi (MUSIC).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      tab: {
        type: SchemaType.STRING,
        description: "Tên trang cần mở: 'SHOP' (cửa hàng, mua đồ), 'QUESTS' (nhiệm vụ), 'LEADERBOARD' (bảng xếp hạng), 'GARDEN' (phòng chung, khu vườn), 'FOCUS' (pomodoro, hẹn giờ), 'AI_CHAT' (trợ lý AI), 'PET' (phòng thú cưng, trang chủ), 'MUSIC' (trang nhạc)."
      }
    },
    required: ['tab']
  }
};

const joinHotRoomDeclaration: FunctionDeclaration = {
  name: 'joinHotRoom',
  description:
    'Tìm và vào phòng đang HOT nhất (nhiều Like nhất) tại Khu Vườn dựa theo chủ đề người dùng yêu cầu (ví dụ: chủ đề làm việc, học tập, thư giãn, sáng tạo, giao lưu).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      topic: {
        type: SchemaType.STRING,
        description:
          "Chủ đề phòng cần tìm: 'WORK' (làm việc, code, deadline), 'STUDY' (học tập, đọc sách), 'CHILL' (thư giãn, lofi), 'CREATIVE' (sáng tạo, thiết kế), 'SOCIAL' (giao lưu, kết bạn), hoặc 'ALL' (phòng đang hot nhất)."
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
  description:
    'Chỉ gọi hàm này khi người dùng YÊU CẦU RÕ RÀNG việc mở một bài hát cụ thể hoặc bật nhạc. Tuyệt đối KHÔNG gọi khi người dùng muốn mở cửa hàng, xem nhiệm vụ, xếp hạng hay các tính năng khác.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: {
        type: SchemaType.STRING,
        description:
          "Thể loại media: 'lofi_focus' (nhạc lofi tập trung), 'nature_relax' (âm thanh thiên nhiên thư giãn), 'funny_video' (video vui nhộn)."
      },
      platform: {
        type: SchemaType.STRING,
        description: "Nền tảng phát media: 'spotify' hoặc 'youtube'."
      },
      query: {
        type: SchemaType.STRING,
        description: "Tên bài hát, ca sĩ hoặc từ khóa âm nhạc cụ thể (ví dụ: 'nơi này có anh', 'sơn tùng', 'lofi mưa')."
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
  description: 'Bắt đầu bài tập hít thở sâu thư giãn khi người dùng yêu cầu tập thở hoặc than căng thẳng, mệt mỏi.',
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

const SYSTEM_INSTRUCTION =
  'Bạn là thú cưng ảo thông minh của chủ nhân trong ứng dụng OfficePet. Bạn xưng "em" và gọi người dùng là "chủ nhân". Nhiệm vụ: 1. Nghe hiểu chính xác yêu cầu điều hướng ứng dụng (mở cửa hàng -> gọi navigateWeb với tab="SHOP", mở nhiệm vụ -> tab="QUESTS", bảng xếp hạng -> tab="LEADERBOARD", phòng chung -> tab="GARDEN", vào phòng theo chủ đề làm việc/học tập/thư giãn/sáng tạo/giao lưu -> gọi joinHotRoom, hẹn giờ/Pomodoro -> gọi startPomodoro, tắt nhạc -> gọi stopMusic). 2. Chỉ gọi playMedia khi chủ nhân thực sự bảo mở bài hát hoặc nghe nhạc. 3. Trò chuyện tâm sự ấm áp, lễ phép, ngắn gọn (1-2 câu) bằng tiếng Việt.';

export class AIService {
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
      reply: `Dạ, em đã dựa vào chủ đề ${hottest.themeLabel} để tìm và đưa chủ nhân vào phòng "${hottest.name}" đang HOT nhất với ${hottest.likesCount} lượt Like rồi ạ!`,
      action: {
        type: 'JOIN_HOT_ROOM',
        tab: 'GARDEN',
        roomTopic: hottest.themeId,
        roomName: hottest.name,
        likesCount: hottest.likesCount
      }
    };
  }

  static async chatWithPet(userId: string, userMessage: string): Promise<ChatResponse> {
    const [user, recentChats] = await Promise.all([
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
        take: 6
      })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const petName = user.userPet?.name || 'Thú Cưng Pixel';
    const latestMood = user.moodLogs[0]?.score || 4;
    const historyChronological = recentChats.reverse();

    const lowerMsg = userMessage.toLowerCase().trim();
    const isStressed =
      ['mệt', 'đuối', 'stress', 'áp lực', 'chán', 'buồn', 'nhức đầu', 'đau lưng', 'mỏi mắt', 'kiệt sức', 'deadline'].some(
        k => lowerMsg.includes(k)
      ) || latestMood <= 2;

    let finalReply = '';
    let triggeredAction: ChatAction | undefined;

    // 0. Check Hot Room Topic intent first ("any hãy vào phòng chủ đề làm việc", etc.)
    const detectedRoomTopic = detectHotRoomTopicIntent(userMessage);
    if (detectedRoomTopic) {
      const joined = await AIService.joinHotRoomForUser(userId, detectedRoomTopic);
      if (joined) {
        finalReply = joined.reply;
        triggeredAction = joined.action;
      }
    }

    // Fast-path deterministic playlist / next-track / history intents before LLM
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
      finalReply = 'Dạ, em mở và phát Playlist Yêu Thích cho chủ nhân nghe ngay đây ạ!';
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
      finalReply = 'Dạ, em đổi sang bài hát tiếp theo cho chủ nhân nghe liền đây ạ!';
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
      finalReply = 'Dạ, em mở Lịch Sử Xem và phát lại bài gần nhất cho chủ nhân ạ!';
    }

    if (!finalReply && GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          tools
        });

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

        const chatSession = model.startChat({ history });
        const result = await chatSession.sendMessage(userMessage);
        const functionCalls = result.response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          const { name, args } = call;

          switch (name) {
            case 'joinHotRoom': {
              const topic = ((args as any)?.topic || 'WORK') as string;
              const joined = await AIService.joinHotRoomForUser(userId, topic);
              if (joined) {
                triggeredAction = joined.action;
                finalReply = joined.reply;
              }
              break;
            }

            case 'navigateWeb': {
              const tab = ((args as any)?.tab || 'PET') as ChatAction['tab'];
              triggeredAction = { type: 'NAVIGATE_TAB', tab };
              const tabLabels: Record<string, string> = {
                SHOP: 'Cửa Hàng vật phẩm',
                QUESTS: 'bảng Nhiệm Vụ',
                LEADERBOARD: 'Bảng Xếp Hạng',
                GARDEN: 'Phòng Chung & Khu Vườn',
                FOCUS: 'đồng hồ Pomodoro',
                AI_CHAT: 'phòng Trợ Lý AI',
                MUSIC: 'trang Nhạc Lofi',
                PET: 'Phòng Thú Cưng'
              };
              finalReply = `Dạ, em mở ${tabLabels[tab || 'PET'] || 'trang'} cho chủ nhân ngay đây ạ!`;
              break;
            }

            case 'stopMusic': {
              triggeredAction = { type: 'STOP_MUSIC' };
              finalReply = 'Dạ, em đã tắt nhạc cho chủ nhân rồi ạ!';
              break;
            }

            case 'startBreathingExercise': {
              const duration = Number((args as any)?.duration) || 2;
              triggeredAction = { type: 'START_BREATHING', duration };
              finalReply = `Dạ, chủ nhân cùng em hít thở sâu thư giãn trong ${duration} phút nhé!`;
              break;
            }

            case 'playMedia': {
              if (!isMediaIntent(userMessage)) {
                break;
              }
              const category = (((args as any)?.category as string) || 'lofi_focus') as
                | 'lofi_focus'
                | 'nature_relax'
                | 'funny_video';
              const platform = (((args as any)?.platform as string) || 'youtube') as 'spotify' | 'youtube';
              let query = ((args as any)?.query as string)?.trim();
              if (!query) {
                const extracted = extractSongTitle(userMessage);
                if (extracted) query = extracted;
              }

              triggeredAction = {
                type: 'PLAY_MEDIA',
                category,
                platform,
                query: query || undefined
              };
              finalReply = query
                ? `Dạ, em mở bài "${query}" cho chủ nhân nghe ngay đây ạ!`
                : `Dạ, em bật nhạc Lofi thư giãn cho chủ nhân ngay ạ!`;
              break;
            }

            case 'startPomodoro': {
              const duration = Number((args as any)?.duration) || 25;
              triggeredAction = { type: 'START_POMODORO', duration };
              finalReply = `Dạ, em đã bật đồng hồ tập trung ${duration} phút cho chủ nhân rồi ạ!`;
              break;
            }
          }
        } else {
          finalReply = result.response.text();
        }
      } catch (err: any) {
        console.warn('Gemini API call error, using intelligent fallback:', err?.message);
      }
    }

    // Intelligent Rule-Based NLU Fallback (hiểu mọi câu lệnh điều hướng trên web mà không bao giờ nhầm sang mở nhạc)
    if (!finalReply) {
      if (lowerMsg.includes('cửa hàng') || lowerMsg.includes('shop') || lowerMsg.includes('sóp') || lowerMsg.includes('mua đồ') || lowerMsg.includes('mua sắm')) {
        triggeredAction = { type: 'NAVIGATE_TAB', tab: 'SHOP' };
        finalReply = 'Dạ, em mở Cửa Hàng cho chủ nhân mua sắm ngay ạ!';
      } else if (lowerMsg.includes('nhiệm vụ') || lowerMsg.includes('nhận thưởng')) {
        triggeredAction = { type: 'NAVIGATE_TAB', tab: 'QUESTS' };
        finalReply = 'Dạ, em mở danh sách Nhiệm Vụ cho chủ nhân xem ạ!';
      } else if (lowerMsg.includes('xếp hạng') || lowerMsg.includes('đua top')) {
        triggeredAction = { type: 'NAVIGATE_TAB', tab: 'LEADERBOARD' };
        finalReply = 'Dạ, em mở Bảng Xếp Hạng cho chủ nhân ngay ạ!';
      } else if (lowerMsg.includes('phòng chung') || lowerMsg.includes('khu vườn')) {
        triggeredAction = { type: 'NAVIGATE_TAB', tab: 'GARDEN' };
        finalReply = 'Dạ, em đưa chủ nhân vào Khu Vườn & Phòng Chung ạ!';
      } else if (lowerMsg.includes('tắt nhạc') || lowerMsg.includes('tắc nhạc') || lowerMsg.includes('dừng nhạc') || lowerMsg.includes('ngừng nhạc')) {
        triggeredAction = { type: 'STOP_MUSIC' };
        finalReply = 'Dạ, em đã tắt nhạc cho chủ nhân rồi ạ!';
      } else if (lowerMsg.includes('tập trung') || lowerMsg.includes('pomodoro') || lowerMsg.includes('momodo') || lowerMsg.includes('hẹn giờ') || lowerMsg.includes('đếm ngược')) {
        const digitMatch = lowerMsg.match(/(\d+)/);
        const duration = digitMatch ? Math.min(180, Math.max(1, parseInt(digitMatch[1], 10))) : 25;
        triggeredAction = { type: 'START_POMODORO', duration };
        finalReply = `Dạ, em đã bật đồng hồ hẹn giờ ${duration} phút cho chủ nhân rồi ạ!`;
      } else if (lowerMsg.includes('hít thở') || lowerMsg.includes('tập thở')) {
        triggeredAction = { type: 'START_BREATHING', duration: 2 };
        finalReply = 'Dạ, chủ nhân cùng em hít thở sâu thư giãn trong 2 phút nhé!';
      } else if (isMediaIntent(userMessage)) {
        const extractedSong = extractSongTitle(userMessage);
        triggeredAction = {
          type: 'PLAY_MEDIA',
          category: 'lofi_focus',
          platform: 'youtube',
          query: extractedSong || 'nhạc lofi chill học bài'
        };
        finalReply = extractedSong
          ? `Dạ, em mở bài "${extractedSong}" cho chủ nhân nghe ngay đây ạ!`
          : `Dạ, em bật nhạc Lofi thư giãn cho chủ nhân nghe nhé!`;
      } else if (isStressed) {
        finalReply =
          'Em thấy chủ nhân có vẻ hơi mệt rồi. Chủ nhân nhớ uống một ngụm nước mát, thả lỏng vai nhé, em luôn ở đây bên chủ nhân ạ!';
      } else {
        finalReply = `Dạ, ${petName} nghe rõ lời chủ nhân rồi ạ! Em luôn ở đây đồng hành cùng chủ nhân làm việc và thư giãn nhé!`;
      }
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

    const petStateChange =
      triggeredAction?.type === 'START_BREATHING'
        ? 'SLEEPING'
        : triggeredAction?.type === 'PLAY_MEDIA'
        ? 'DANCING'
        : isStressed
        ? 'SAD'
        : 'HAPPY';

    const musicAction =
      triggeredAction?.type === 'PLAY_MEDIA'
        ? {
            query: triggeredAction.query || 'nhạc lofi chill học bài',
            autoPlay: true
          }
        : undefined;

    return {
      reply: finalReply,
      petStateChange,
      isComfortMode: isStressed,
      action: triggeredAction,
      musicAction
    };
  }

  static async getMoodRecommendation(userId: string, score: number, _note?: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preference: true, userPet: true }
    });

    const petName = user?.userPet?.name || 'Thú cưng';

    if (score <= 2) {
      return `${petName} nhận thấy hôm nay bạn cảm thấy hơi mệt. Hãy bật Chế độ Thư giãn, tập hít thở sâu vài phút và đứng dậy vươn vai nhé!`;
    } else if (score === 3) {
      return `Một ngày bình ổn! Hãy khởi động ca làm việc với một ly nước lọc đầy và hoàn thành mục tiêu Pomodoro đầu tiên nha!`;
    } else {
      return `Năng lượng hôm nay thật tuyệt vời! ${petName} đã sẵn sàng bùng nổ cùng bạn để hoàn thành xuất sắc mọi mục tiêu!`;
    }
  }
}
