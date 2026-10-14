import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface ChatResponse {
  reply: string;
  petStateChange?: string;
  isComfortMode: boolean;
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

export class AIService {
  /**
   * Generates a personalized response for the user's pet companion.
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
        take: 8
      })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const petName = user.userPet?.name || 'Thú Cưng Pixel';
    const petType = user.userPet?.petType?.name || 'Mèo Pixel';
    const persona = user.preference?.petPersona || 'Vui vẻ';
    const favMusic = user.preference?.favMusicGenre || 'Lo-fi Hip Hop';
    const latestMood = user.moodLogs[0]?.score || 4; // 1 (Very Tired) - 5 (Great)
    const recentFocusMinutes = user.workSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

    // Context memory (learned facts)
    let memoryJson: any = user.preference?.aiContextMemory || {};

    // 2. Load recent multi-turn history
    const historyChronological = recentChats.reverse();

    // 3. Stress / Fatigue Detection
    const stressKeywords = ['mệt', 'đuối', 'stress', 'áp lực', 'chán', 'buồn', 'nhức đầu', 'đau lưng', 'mỏi mắt', 'kiệt sức', 'deadline'];
    const lowerMsg = userMessage.toLowerCase();
    const isStressed = stressKeywords.some(k => lowerMsg.includes(k)) || latestMood <= 2;
    const asksForMusic = /\b(?:nhạc|bài hát|lofi|music|song)\b/i.test(lowerMsg)
      && /\b(?:bật|mở|phát|nghe|tìm|kiếm|gợi ý|play|listen)\b/i.test(lowerMsg);
    const wantsMusicPlayback = /\b(?:bật|mở|phát|nghe|play|listen)\b/i.test(lowerMsg);
    const musicQuery = asksForMusic
      ? lowerMsg
        .replace(/\b(?:bật|mở|phát|nghe|tìm|kiếm|gợi ý|play|listen|giúp|cho|mình|tôi|bạn|bé|nhạc|bài hát|music|song)\b/gi, ' ')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      : '';

    // 4. Construct System Prompt with Persona & Context
    let personaPrompt = '';
    switch (persona) {
      case 'Nghiêm túc':
        personaPrompt = 'Phong cách: Điềm đạm, nghiêm túc, truyền cảm hứng hành động, kỷ luật Pomodoro, dùng từ ngữ khúc chiết nhưng sâu sắc.';
        break;
      case 'Dịu dàng':
        personaPrompt = 'Phong cách: Dịu dàng, chu đáo, ấm áp, thấu cảm tối đa, luôn ân cần hỏi han sức khỏe như một người bạn tri kỷ.';
        break;
      case 'Ngắn gọn':
        personaPrompt = 'Phong cách: Ngắn gọn, thực tế, chỉ đưa ra thông tin cốt lõi và hành động cần thiết, không dông dài (dưới 2 câu).';
        break;
      case 'Vui vẻ':
      default:
        personaPrompt = 'Phong cách: Hài hước, lạc quan, dí dỏm, thi thoảng dùng emoji vui tươi và âm thanh dễ thương (meo meo, gâu gâu).';
        break;
    }

    const memorySummary = Object.entries(memoryJson)
      .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
      .join('\n');

    const systemInstruction = `
Bạn là ${petName}, một bé thú cưng 2D Pixel Art (${petType}) sống trên màn hình máy tính của bạn ${user.fullName}.
Bạn đồng hành cùng chủ nhân trong giờ làm việc văn phòng tại phòng ban ${user.department?.name || 'Văn Phòng'}.

THÔNG TIN CHỦ NHÂN & TRÍ NHỚ ĐÃ HỌC:
- Tên chủ nhân: ${user.fullName}
- Loài thú cưng của bạn: ${petType}
- Thể loại nhạc yêu thích của chủ nhân: ${favMusic}
- Tâm trạng gần nhất: ${latestMood}/5 (1=Rất mệt, 5=Tuyệt vời)
- Tổng phút tập trung gần đây: ${recentFocusMinutes} phút
- Trí nhớ cá nhân hóa đã học:
${memorySummary || 'Chưa có ghi nhớ đặc biệt.'}

${personaPrompt}

NGUYÊN TẮC PHẢN HỒI:
1. Luôn xưng hô thân mật (ví dụ: "Mình", "Em", "Tớ" hoặc tên pet "${petName}") và gọi người dùng là "bạn" hoặc "${user.fullName}".
2. Độ dài phản hồi: Ngắn gọn, súc tích (1-3 câu), phù hợp hiển thị trong khung chat nhỏ trên màn hình làm việc (không chiếm quá 30% màn hình).
3. Nếu chủ nhân thể hiện căng thẳng/mệt mỏi (${isStressed ? 'CHỦ NHÂN ĐANG CĂNG THẲNG/MỆT MỎI!' : 'Bình thường'}):
   Hãy chuyển sang chế độ VỖ VỀ: gửi lời an ủi ấm áp, đề xuất nghỉ ngơi ngắn (nghỉ 5 phút, giãn cơ cổ vai gáy, uống nước hoặc kỹ thuật thở 4-7-8).
4. KHÔNG bao giờ bịa đặt ngoài phạm vi văn phòng, sức khỏe, công việc và tình bạn thú cưng.
5. Nếu người dùng yêu cầu tìm hoặc phát nhạc, hãy xác nhận ngắn gọn; ứng dụng sẽ mở trình phát nhạc với kết quả phù hợp.
`;

    // 5. Build Gemini API Payload
    const contents: any[] = [];
    
    // Add history
    for (const chat of historyChronological) {
      contents.push({
        role: chat.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: chat.message }]
      });
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    let generatedText = '';
    if (GEMINI_API_KEY) {
      try {
      const response = await axios.post(
        GEMINI_URL,
        {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 160
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          timeout: 8000
        }
      );

      const candidate = response.data?.candidates?.[0];
      generatedText = candidate?.content?.parts?.[0]?.text || '';
      } catch (err: any) {
        console.warn('Gemini API call failed, using contextual fallback:', err?.response?.data || err.message);
      }
    }

    if (!generatedText) {
      generatedText = isStressed
        ? `Mình thấy bạn đang thấm mệt rồi đó. Tạm nghỉ một chút, hít thở sâu và uống ngụm nước nhé!`
        : `Mình luôn ở đây đồng hành cùng bạn nè! Cùng cố gắng nhé, nhưng nhớ giữ gìn sức khỏe nha!`;
    }

    // 6. Save user & assistant messages to AIChatHistory
    await prisma.aIChatHistory.createMany({
      data: [
        {
          userId,
          role: 'user',
          message: userMessage,
          moodContext: `${latestMood}`
        },
        {
          userId,
          role: 'assistant',
          message: generatedText,
          moodContext: isStressed ? 'COMFORT_MODE' : 'NORMAL'
        }
      ]
    });

    // 7. Update User Memory if relevant topics mentioned
    if (lowerMsg.includes('thích nhạc') || lowerMsg.includes('bài hát')) {
      memoryJson['music_interest'] = userMessage;
    }
    if (lowerMsg.includes('hay thức khuya') || lowerMsg.includes('ngủ muộn')) {
      memoryJson['sleep_habit'] = 'Thường làm việc muộn vào ban đêm';
    }
    if (lowerMsg.includes('uống trà') || lowerMsg.includes('cà phê')) {
      memoryJson['drink_preference'] = userMessage;
    }

    await prisma.userPreference.update({
      where: { userId },
      data: {
        aiContextMemory: memoryJson
      }
    });

    // 8. Formulate Response Action
    let petStateChange = 'IDLE';
    let relaxationSuggestion = undefined;

    if (isStressed) {
      petStateChange = 'PETTING';
      relaxationSuggestion = {
        type: 'BREATHING_478' as const,
        title: 'Thở Điều Hòa 4-7-8',
        description: 'Hít vào 4 giây qua mũi, giữ hơi 7 giây, thở ra chậm rãi 8 giây qua miệng để xoa dịu thần kinh.',
        durationMinutes: 3
      };
    } else if (lowerMsg.includes('nhảy') || lowerMsg.includes('nhạc')) {
      petStateChange = 'DANCING';
    } else if (lowerMsg.includes('ăn') || lowerMsg.includes('đói')) {
      petStateChange = 'EATING';
    } else if (lowerMsg.includes('cảm ơn') || lowerMsg.includes('thank')) {
      petStateChange = 'THANKING';
    } else if (lowerMsg.includes('tập trung') || lowerMsg.includes('làm việc')) {
      petStateChange = 'TYPING';
    } else {
      petStateChange = 'HAPPY';
    }

    return {
      reply: generatedText,
      petStateChange,
      isComfortMode: isStressed,
      relaxationSuggestion,
      ...(asksForMusic ? {
        musicAction: {
          query: musicQuery || 'lofi chill music',
          autoPlay: wantsMusicPlayback
        }
      } : {})
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
      return `${petName} nhận thấy hôm nay bạn cảm thấy hơi mệt. Hãy bật Chế độ Thư giãn, chọn một danh sách Lo-fi êm dịu và cứ 45 phút đứng dậy vươn vai nhé!`;
    } else if (score === 3) {
      return `Một ngày bình ổn! Hãy khởi động ca làm việc với một ly nước lọc đầy và hoàn thành mục tiêu 25 phút Pomodoro đầu tiên nha!`;
    } else {
      return `Năng lượng hôm nay thật tuyệt vời! ${petName} đã sẵn sàng bùng nổ cùng bạn để tích lũy thật nhiều EXP cho Khu vườn phòng ban!`;
    }
  }
}
