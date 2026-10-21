import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export interface ChatAction {
  type: 'START_POMODORO' | 'PLAY_MEDIA' | 'START_BREATHING';
  duration?: number;
  category?: 'lofi_focus' | 'nature_relax' | 'funny_video';
  platform?: 'spotify' | 'youtube';
  query?: string;
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
 * Trích xuất tên bài hát hoặc từ khóa tìm kiếm âm nhạc/video từ câu nói của người dùng tiếng Việt.
 * Hỗ trợ mọi biến thể:
 * - "mở bài hãy trao cho anh" -> "hãy trao cho anh"
 * - "bật bài hát lạc trôi nhé" -> "lạc trôi"
 * - "hãy trao cho anh" -> "hãy trao cho anh"
 * - "nhạc hãy trao cho anh" -> "hãy trao cho anh"
 * - "bài hãy trao cho anh" -> "hãy trao cho anh"
 * - "sơn tùng hãy trao cho anh" -> "sơn tùng hãy trao cho anh"
 * - "cho mình nghe bài chúng ta của hiện tại đi" -> "chúng ta của hiện tại"
 */
function extractSongTitle(text: string): string {
  if (!text) return '';
  let clean = text.trim();

  // Bỏ các từ chào hỏi / xưng hô đầu câu
  clean = clean.replace(/^(?:xin\s+chào\s+|chào\s+bạn\s+|chào\s+bé\s+|bé\s+ơi\s+|cưng\s+ơi\s+|ê\s+|alo\s+)/i, '').trim();

  // Bỏ các câu mệnh lệnh / yêu cầu: "cho mình nghe", "tôi muốn nghe", "bật cho tôi", "làm ơn mở", "hãy mở"...
  clean = clean.replace(/^(?:cho\s+(?:mình|tôi|em)\s+(?:nghe|xem)\s*|tôi\s+muốn\s+(?:nghe|xem)\s*|mình\s+muốn\s+(?:nghe|xem)\s*|hãy\s+(?:mở|bật|phát|cho\s+nghe)\s*|(?:làm\s+ơn\s+)?(?:mở|bật|phát|nghe|play|tìm|search|kiếm)\s+(?:cho\s+(?:mình|tôi|em)\s+)?(?:nghe|xem\s+)?)/i, '').trim();

  // Bỏ từ chỉ thể loại media ở đầu: "bài hát", "bài nhạc", "ca khúc", "bài", "nhạc", "mv", "video", "clip"
  clean = clean.replace(/^(?:bài\s+hát|bài\s+nhạc|ca\s+khúc|bài|nhạc|mv|video|clip|track|song)\s+(?:về\s+|tên\s+là\s+|của\s+)?/i, '').trim();

  // Bỏ hậu tố lịch sự: "nhé", "nha", "đi", "với", "giùm", "giúp", "được không", "ạ"
  clean = clean.replace(/(?:\s+(?:đi|nhé|nha|nào|giùm|giúp|với|ạ|nhé\s+bé|nha\s+bé|được\s+không|cho\s+mình|cho\s+tôi))+$/i, '').trim();

  // Bỏ ngoặc kép nếu có
  clean = clean.replace(/^["'`“](.+)["'`”]$/, '$1').trim();

  return clean;
}

function isMediaIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase().trim();
  if (lower.includes('pomodoro') || lower.includes('hít thở') || lower.includes('tập thở') || lower.startsWith('chào') || lower === 'bạn là ai') {
    return false;
  }
  
  const mediaKeywords = [
    'mở', 'bật', 'phát', 'nghe', 'play', 'tìm', 'search', 'nhạc', 'bài hát', 'bài nhạc', 'ca khúc', 'bài',
    'mv', 'video', 'youtube', 'spotify', 'lofi', 'hát', 'ca sĩ'
  ];
  if (mediaKeywords.some(k => lower.includes(k))) return true;

  const candidate = extractSongTitle(userMessage);
  if (candidate.length >= 2 && candidate.length <= 60) {
    const nonMedia = ['mệt', 'đuối', 'stress', 'áp lực', 'chán', 'buồn', 'nhức đầu', 'đau lưng', 'mỏi mắt', 'kiệt sức', 'deadline', 'hello', 'hi'];
    if (nonMedia.includes(lower)) return false;
    return true;
  }

  return false;
}

// 1. Cấu hình Function Declarations (Tools)
const pomodoroDeclaration: FunctionDeclaration = {
  name: 'startPomodoro',
  description: 'Bắt đầu phiên làm việc tập trung Pomodoro để chống xao nhãng và hoàn thành công việc.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      duration: {
        type: SchemaType.NUMBER,
        description: 'Thời gian tập trung tính theo phút (ví dụ: 15, 25, 45, 60).'
      }
    },
    required: ['duration']
  }
};

const playMediaDeclaration: FunctionDeclaration = {
  name: 'playMedia',
  description: 'Phát nhạc hoặc video giúp người dùng tập trung hoặc thư giãn, xả stress khi mệt mỏi.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: {
        type: SchemaType.STRING,
        description: "Thể loại media: 'lofi_focus' (nhạc lofi tập trung), 'nature_relax' (âm thanh thiên nhiên thư giãn), 'funny_video' (video vui nhộn giải trí xả stress)."
      },
      platform: {
        type: SchemaType.STRING,
        description: "Nền tảng phát media: 'spotify' hoặc 'youtube'."
      },
      query: {
        type: SchemaType.STRING,
        description: "Tên bài hát, ca sĩ hoặc từ khóa video mà người dùng yêu cầu (ví dụ: 'hãy trao cho anh', 'sơn tùng', 'lofi mưa')."
      }
    },
    required: ['category', 'platform']
  }
};

const breathingExerciseDeclaration: FunctionDeclaration = {
  name: 'startBreathingExercise',
  description: 'Bắt đầu bài tập hít thở sâu thư giãn để giải tỏa căng thẳng, mệt mỏi, áp lực cho người dùng.',
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
    functionDeclarations: [pomodoroDeclaration, playMediaDeclaration, breathingExerciseDeclaration]
  }
];

// System Instruction chuẩn theo yêu cầu
const SYSTEM_INSTRUCTION =
  'Bạn là một thú cưng ảo đồng hành trên màn hình. Nhiệm vụ: 1. Giúp người dùng tập trung làm việc (gợi ý Pomodoro). 2. Giúp người dùng thư giãn, xả stress khi họ than mệt mỏi hoặc căng thẳng (gợi ý tập thở, bật nhạc thiên nhiên, mở video vui nhộn). Tính cách: Dễ thương, ân cần, luôn dùng emoji động vật (🐾, 🐱, 🐶). Phản hồi ngắn gọn, tự nhiên như một người bạn.';

export class AIService {
  /**
   * Generates a personalized response for the user's pet companion with Function Calling.
   */
  static async chatWithPet(userId: string, userMessage: string): Promise<ChatResponse> {
    // 1. Fetch user context & preferences
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

    // Multi-turn history
    const historyChronological = recentChats.reverse();

    // Keywords detection for fallback or intent context
    const lowerMsg = userMessage.toLowerCase();
    const isStressed =
      ['mệt', 'đuối', 'stress', 'áp lực', 'chán', 'buồn', 'nhức đầu', 'đau lưng', 'mỏi mắt', 'kiệt sức', 'deadline'].some(
        k => lowerMsg.includes(k)
      ) || latestMood <= 2;

    let finalReply = '';
    let triggeredAction: ChatAction | undefined;

    // 2. Cấu hình và gọi Google Generative AI Model với Function Calling
    if (GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          tools
        });

        // Chuẩn hóa history cho Gemini: bắt đầu bằng 'user' và xen kẽ user/model
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

        // 3. Xử lý luồng Function Calling
        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          const { name, args } = call;
          let functionResult: any = {};

          switch (name) {
            case 'startBreathingExercise': {
              const rawDuration = (args as any)?.duration;
              const duration = Number(rawDuration) || 2;
              triggeredAction = {
                type: 'START_BREATHING',
                duration
              };
              functionResult = {
                status: 'success',
                duration,
                message: `Đã mở giao diện tập hít thở sâu thư giãn trong ${duration} phút cho người dùng.`
              };
              break;
            }

            case 'playMedia': {
              const rawCategory = (args as any)?.category;
              const rawPlatform = (args as any)?.platform;
              const category = ((rawCategory as string) || 'lofi_focus') as 'lofi_focus' | 'nature_relax' | 'funny_video';
              const platform = ((rawPlatform as string) || 'youtube') as 'spotify' | 'youtube';
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
              functionResult = {
                status: 'success',
                category,
                platform,
                query,
                message: query
                  ? `Đang tìm và phát bài hát "${query}" trên ${platform}.`
                  : `Đang phát nội dung ${category} trên ${platform}.`
              };
              break;
            }

            case 'startPomodoro': {
              const rawDuration = (args as any)?.duration;
              const duration = Number(rawDuration) || 25;
              triggeredAction = {
                type: 'START_POMODORO',
                duration
              };
              functionResult = {
                status: 'success',
                duration,
                message: `Đã kích hoạt chế độ làm việc tập trung Pomodoro ${duration} phút.`
              };
              break;
            }

            default:
              functionResult = { status: 'acknowledged' };
          }

          // Trả kết quả về qua functionResponse để nhận lời xác nhận tự nhiên từ thú cưng
          try {
            const secondResult = await chatSession.sendMessage([
              {
                functionResponse: {
                  name,
                  response: functionResult
                }
              }
            ]);
            finalReply = secondResult.response.text();
          } catch (fnErr) {
            if (name === 'startBreathingExercise') {
              finalReply = `Cùng mình hít thở sâu thư giãn trong ${triggeredAction?.duration || 2} phút nhé! Hít vào... thở ra... 🐾🌸`;
            } else if (name === 'playMedia') {
              if (triggeredAction?.query) {
                finalReply = `Mình mở bài "${triggeredAction.query}" trên ${triggeredAction.platform || 'youtube'} cho bạn ngay đây! Cùng nghe và thư giãn nhé! 🎵🐾`;
              } else {
                finalReply = `Mình đã mở ${
                  triggeredAction?.category === 'funny_video'
                    ? 'video vui nhộn'
                    : triggeredAction?.category === 'nature_relax'
                    ? 'âm thanh thiên nhiên thư giãn'
                    : 'nhạc lofi tập trung'
                } trên ${triggeredAction?.platform || 'youtube'} cho bạn rồi nè! Thưởng thức nhé! 🎵🐾`;
              }
            } else {
              finalReply = `Cùng tập trung cao độ làm việc trong ${triggeredAction?.duration || 25} phút nhé! Bạn làm được mà! 🐶🐾`;
            }
          }
        } else {
          finalReply = result.response.text();
        }
      } catch (err: any) {
        console.warn('Gemini API call error, using intelligent fallback:', err?.message);
      }
    }

    // 4. Intelligent Fallback nếu API gặp sự cố hoặc chưa có phản hồi
    if (!finalReply) {
      const extractedSong = extractSongTitle(userMessage);
      const isMedia = isMediaIntent(userMessage);

      if (isMedia) {
        const isRelax = lowerMsg.includes('thư giãn') || lowerMsg.includes('nghỉ') || lowerMsg.includes('thiên nhiên');
        const isFunny = lowerMsg.includes('hài') || lowerMsg.includes('vui') || lowerMsg.includes('cười');
        const category = isFunny ? 'funny_video' : isRelax ? 'nature_relax' : 'lofi_focus';
        
        let songQuery = extractedSong;
        if (songQuery === 'lofi' || songQuery === 'nhạc lofi') songQuery = '';
        if (songQuery === 'hài hước' || songQuery === 'video hài') songQuery = 'funny pets compilation';
        if (songQuery === 'thiên nhiên' || songQuery === 'nhạc thiên nhiên') songQuery = 'nature sounds relax';

        triggeredAction = {
          type: 'PLAY_MEDIA',
          category,
          platform: 'youtube',
          query: songQuery || undefined
        };
        finalReply = songQuery
          ? `Mình mở bài "${songQuery}" trên YouTube cho bạn ngay đây! Cùng thưởng thức nhé! 🎵🐾`
          : `Mình mở ngay ${category === 'funny_video' ? 'video hài hước' : category === 'nature_relax' ? 'tiếng suối và thiên nhiên' : 'nhạc lofi'} trên YouTube cho bạn thư giãn nè! 🎵🐾`;
      } else if (lowerMsg.includes('thở') || lowerMsg.includes('hít thở') || (isStressed && (lowerMsg.includes('mệt') || lowerMsg.includes('căng thẳng')))) {
        triggeredAction = { type: 'START_BREATHING', duration: 2 };
        finalReply = 'Cùng mình hít thở sâu thư giãn trong 2 phút nhé! Thả lỏng toàn thân nào bạn ơi! 🐾🌸';
      } else if (lowerMsg.includes('tập trung') || lowerMsg.includes('pomodoro') || lowerMsg.includes('làm việc') || lowerMsg.includes('bắt đầu')) {
        triggeredAction = { type: 'START_POMODORO', duration: 25 };
        finalReply = 'Cùng mình kích hoạt phiên Pomodoro 25 phút để làm việc thật năng suất và tránh xao nhãng nhé! 🐶🐾';
      } else {
        finalReply = isStressed
          ? 'Mình thấy bạn có vẻ đang căng thẳng rồi nè. Hãy uống một ngụm nước, thả lỏng vai và để mình đồng hành cùng bạn nha! 🐱🐾'
          : `Chào bạn! ${petName} luôn sẵn sàng cùng bạn tập trung làm việc hoặc thư giãn xả stress nè! 🐾✨`;
      }
    }

    // 5. Lưu lịch sử chat
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

    // Determine pet state
    const petStateChange = triggeredAction?.type === 'START_BREATHING'
      ? 'SLEEPING'
      : triggeredAction?.type === 'PLAY_MEDIA'
      ? 'WALK'
      : isStressed
      ? 'COMFORTING'
      : 'IDLE';

    const musicAction = triggeredAction?.type === 'PLAY_MEDIA'
      ? {
          query: triggeredAction.query || (triggeredAction.category === 'nature_relax' ? 'nature sounds relax' : triggeredAction.category === 'funny_video' ? 'funny pets compilation' : 'lofi hip hop'),
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

  /**
   * Generates morning mood recommendation (US-U28).
   */
  static async getMoodRecommendation(userId: string, score: number, note?: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preference: true, userPet: true }
    });

    const petName = user?.userPet?.name || 'Thú cưng';
    
    if (score <= 2) {
      return `${petName} nhận thấy hôm nay bạn cảm thấy hơi mệt. Hãy bật Chế độ Thư giãn, tập hít thở sâu vài phút và đứng dậy vươn vai nhé! 🐾`;
    } else if (score === 3) {
      return `Một ngày bình ổn! Hãy khởi động ca làm việc với một ly nước lọc đầy và hoàn thành mục tiêu Pomodoro đầu tiên nha! 🐾`;
    } else {
      return `Năng lượng hôm nay thật tuyệt vời! ${petName} đã sẵn sàng bùng nổ cùng bạn để hoàn thành xuất sắc mọi mục tiêu! 🐾✨`;
    }
  }
}
