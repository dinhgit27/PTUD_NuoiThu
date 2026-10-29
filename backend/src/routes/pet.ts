import { Request, Response, Router } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth, requireUser, AuthRequest } from '../middleware/auth';
import { AIService } from '../services/aiService';
import { QuestService } from '../services/questService';
import { formatUserPet, formatPetType } from '../utils/jsonHelper';
import { getJwtSecret } from '../utils/jwt';

const router = Router();
const prisma = new PrismaClient();

function tryGetUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), getJwtSecret()) as JwtPayload;
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

function calculateExpBoostPercent(userItems: Array<{ item: { effect: string; effectValue: number } }>) {
  return Math.min(100, userItems.reduce(
    (total, userItem) => total + (userItem.item.effect === 'EXP_BOOST' ? userItem.item.effectValue : 0),
    0
  ));
}

// EXP required per level
function getExpForNextLevel(level: number) {
  return level * 200;
}

async function checkAndResetDailyInteractions(pet: any) {
  const now = new Date();
  if (pet.lastInteractionAt) {
    const diffHours = (now.getTime() - pet.lastInteractionAt.getTime()) / (1000 * 60 * 60);
    const isNewCalendarDay = now.toDateString() !== pet.lastInteractionAt.toDateString();
    if ((isNewCalendarDay || diffHours >= 24) && pet.dailyInteractionsLeft < 3) {
      await prisma.userPet.update({
        where: { id: pet.id },
        data: { dailyInteractionsLeft: 3 }
      });
      pet.dailyInteractionsLeft = 3;
    }
  }
}

/**
 * Get active pet of current user (US-U02, US-U07)
 */
router.get('/', requireAuth, requireUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        petType: true,
        userItems: {
          where: { isEquipped: true },
          include: { item: true }
        },
        user: {
          select: { fullName: true, email: true, deptId: true }
        }
      }
    });

    if (!pet) {
      return res.status(404).json({ error: 'Bạn chưa tạo thú cưng. Vui lòng chọn một giống thú cưng.' });
    }

    // Reset daily interactions if passed 24h or new calendar day, or replenish
    await checkAndResetDailyInteractions(pet);
    if (pet.dailyInteractionsLeft <= 0) {
      await prisma.userPet.update({
        where: { id: pet.id },
        data: { dailyInteractionsLeft: 20 }
      });
      pet.dailyInteractionsLeft = 20;
    }

    const nextLevelExp = getExpForNextLevel(pet.level);
    const formattedPet = formatUserPet(pet);

    res.json({
      ...formattedPet,
      nextLevelExp,
      expProgress: Math.min(100, Math.round((pet.exp / nextLevelExp) * 100))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải thông tin thú cưng.', details: error.message });
  }
});

/**
 * List available published or purchased PetTypes for selection
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    const userId = tryGetUserId(req);
    const whereCondition: Prisma.PetTypeWhereInput = userId
      ? {
          OR: [
            { isActive: true },
            { isShopEnabled: true },
            { ownedByUsers: { some: { userId } } }
          ]
        }
      : {
          OR: [
            { isActive: true },
            { isShopEnabled: true }
          ]
        };

    const types = await prisma.petType.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'asc' }
    });
    res.json(types.map(t => formatPetType(t)));
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh mục loài thú cưng.', details: error.message });
  }
});

function splitTextForTts(text: string, maxLen = 170): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.split(/(?<=[.!?,\n;])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (!s) continue;
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current ? current + ' ' + s : s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(/\s+/);
        let wordChunk = '';
        for (const w of words) {
          if ((wordChunk + ' ' + w).trim().length <= maxLen) {
            wordChunk = (wordChunk ? wordChunk + ' ' + w : w).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        current = wordChunk;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 8);
}

/**
 * Vietnamese Text-to-Speech Proxy (Public route for HTML5 Audio playback)
 */
router.get('/tts', async (req: Request, res: Response) => {
  try {
    const rawText = String(req.query.text || 'Em đây đại ca').slice(0, 1000);
    const chunks = splitTextForTts(rawText, 170);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(chunk.trim())}`;
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
      }
    }

    if (audioBuffers.length === 0) {
      return res.status(502).json({ error: 'TTS upstream failed' });
    }

    const mergedBuffer = Buffer.concat(audioBuffers);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(mergedBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'TTS proxy error', details: error.message });
  }
});

/**
 * Speech-to-Text Proxy using Gemini
 * Converts user voice audio (base64) to accurate Vietnamese text.
 * Especially essential for Electron Desktop Overlay where Google Web Speech API is blocked.
 */
router.post('/stt', async (req: Request, res: Response) => {
  try {
    const { audio, mimeType = 'audio/webm' } = req.body || {};
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'Dữ liệu âm thanh (base64) là bắt buộc.' });
    }

    const cleanBase64 = audio.includes(',') ? audio.split(',')[1] : audio;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const rawMime = mimeType.split(';')[0].trim() || 'audio/webm';
    const prompt = 'Hãy nghe file âm thanh này và chép lại chính xác lời nói tiếng Việt thành văn bản. Chỉ trả về đúng nội dung câu nói tiếng Việt được nghe, không giải thích, không dịch, không thêm ký tự markdown hay lời dẫn nào khác. Nếu không nghe thấy tiếng người nói thì chỉ trả về chuỗi rỗng.';

    let rawText = '';
    const candidates = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-omni-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.8-flash'
    ];
    let lastErr: any = null;

    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: rawMime,
              data: cleanBase64
            }
          },
          prompt
        ]);
        rawText = result.response.text() || '';
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!rawText && lastErr) {
      console.warn('STT model transcription attempt failed:', lastErr?.message || lastErr);
    }

    const transcript = rawText
      .replace(/[\r\n]+/g, ' ')
      .replace(/^["'`]|["'`]$/g, '')
      .trim();

    return res.json({ transcript });
  } catch (error: any) {
    console.error('STT proxy error:', error?.message || error);
    return res.status(500).json({ error: 'Nhận diện giọng nói thất bại', details: error?.message });
  }
});

router.use(requireAuth, requireUser);

router.patch('/name', async (req: AuthRequest, res: Response) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 24) {
    return res.status(400).json({ error: 'Tên thú cưng phải có từ 1 đến 24 ký tự.' });
  }

  try {
    const pet = await prisma.userPet.update({
      where: { userId: req.user!.id },
      data: { name },
      include: { petType: true, userItems: { where: { isEquipped: true }, include: { item: true } } }
    });
    res.json({ message: 'Đã đổi tên thú cưng.', pet: formatUserPet(pet) });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Bạn chưa có thú cưng để đổi tên.' });
    }
    console.error('Could not rename pet:', error);
    res.status(500).json({ error: 'Không thể đổi tên thú cưng.' });
  }
});

/**
 * Create or Adopt a Pet (US-U01, US-U02)
 */
router.post('/select', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { typeId, name } = req.body;

    if (!typeId) {
      return res.status(400).json({ error: 'Vui lòng chọn loại thú cưng.' });
    }

    const petType = await prisma.petType.findFirst({
      where: {
        id: typeId,
        OR: [
          { isActive: true },
          { isShopEnabled: true },
          { ownedByUsers: { some: { userId } } }
        ]
      }
    });
    if (!petType) {
      return res.status(404).json({ error: 'Loài thú cưng này không tồn tại hoặc chưa xuất bản.' });
    }

    if (petType.isPurchaseRequired) {
      const ownership = await prisma.purchasedPetType.findUnique({
        where: { userId_petTypeId: { userId, petTypeId: typeId } }
      });
      if (!ownership) {
        return res.status(403).json({ error: 'Bạn cần mua thú cưng này trong cửa hàng trước khi sử dụng.' });
      }
    }

    const currentPet = await prisma.userPet.findUnique({
      where: { userId },
      select: { id: true, level: true, name: true }
    });
    const availableLevel = currentPet?.level || 1;
    if (petType.unlockLevel > availableLevel) {
      return res.status(403).json({
        error: `Cần thú cưng đạt cấp ${petType.unlockLevel} để mở khóa loài này.`
      });
    }

    const pet = await prisma.userPet.upsert({
      where: { userId },
      update: {
        typeId,
        ...(name ? { name } : {}),
        currentState: 'IDLE'
      },
      create: {
        userId,
        typeId,
        name: name || petType.name,
        level: 1,
        exp: 0,
        hunger: 80,
        happiness: 100,
        health: 100,
        currentState: 'IDLE',
        currentMode: 'RELAXED',
        dailyInteractionsLeft: 3
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    res.json({ message: 'Chào mừng bé cưng mới!', pet: formatUserPet(pet) });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi chọn thú cưng.', details: error.message });
  }
});

/**
 * Feed Pet (US-U06)
 */
router.post('/feed', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        user: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    if (!pet) return res.status(404).json({ error: 'Không tìm thấy thú cưng.' });

    await checkAndResetDailyInteractions(pet);
    const interactionsLeft = pet.dailyInteractionsLeft <= 0 ? 20 : pet.dailyInteractionsLeft;

    const expBoostPercent = calculateExpBoostPercent(pet.userItems);
    const expGain = Math.round(50 * (100 + expBoostPercent) / 100);
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);

    const newHunger = Math.min(100, pet.hunger + 30);
    const newHappiness = Math.min(100, pet.happiness + 15);

    // Update Pet (accumulate EXP in tank so user can press Level Up button)
    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        hunger: newHunger,
        happiness: newHappiness,
        exp: newExp,
        dailyInteractionsLeft: Math.max(1, interactionsLeft - 1),
        lastInteractionAt: new Date(),
        currentState: 'EATING'
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    // Log EXP Record
    await prisma.eXPRecord.create({
      data: {
        userId,
        petId: pet.id,
        deptId: pet.user.deptId,
        amount: expGain,
        source: 'FEED',
        description: 'Cho thú cưng ăn bữa ngon'
      }
    });

    // Also contribute to Department Garden EXP (US-U17)
    if (pet.user.deptId) {
      await prisma.department.update({
        where: { id: pet.user.deptId },
        data: { gardenExp: { increment: expGain } }
      });
    }

    // Track quest progress
    void QuestService.recordActionProgress(userId, 'FEED', 1);

    res.json({
      message: 'Cho ăn thành công!',
      pet: {
        ...formatUserPet(updated),
        nextLevelExp,
        expProgress: Math.min(100, Math.round((newExp / nextLevelExp) * 100))
      },
      didLevelUp: false,
      expGained: expGain,
      expBoostPercent
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cho thú cưng ăn.', details: error.message });
  }
});

/**
 * Pet / Stroke Pet (Touch Interaction Feedback) (US-U06)
 */
router.post('/pet', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        user: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    if (!pet) return res.status(404).json({ error: 'Không tìm thấy thú cưng.' });

    await checkAndResetDailyInteractions(pet);
    const interactionsLeft = pet.dailyInteractionsLeft <= 0 ? 20 : pet.dailyInteractionsLeft;

    const expBoostPercent = calculateExpBoostPercent(pet.userItems);
    const expGain = Math.round(30 * (100 + expBoostPercent) / 100);
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);

    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        happiness: Math.min(100, pet.happiness + 25),
        exp: newExp,
        dailyInteractionsLeft: Math.max(1, interactionsLeft - 1),
        lastInteractionAt: new Date(),
        currentState: 'PETTING'
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    await prisma.eXPRecord.create({
      data: {
        userId,
        petId: pet.id,
        deptId: pet.user.deptId,
        amount: expGain,
        source: 'PET',
        description: 'Vuốt ve âu yếm thú cưng'
      }
    });

    if (pet.user.deptId) {
      await prisma.department.update({
        where: { id: pet.user.deptId },
        data: { gardenExp: { increment: expGain } }
      });
    }

    // Track quest progress
    void QuestService.recordActionProgress(userId, 'STROKE', 1);

    res.json({
      message: 'Bé cưng đang rất vui vẻ!',
      pet: {
        ...formatUserPet(updated),
        nextLevelExp,
        expProgress: Math.min(100, Math.round((newExp / nextLevelExp) * 100))
      },
      didLevelUp: false,
      expGained: expGain,
      expBoostPercent
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi vuốt ve thú cưng.', details: error.message });
  }
});

/**
 * Manual Level Up from EXP Tank
 */
router.post('/level-up', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    if (!pet) return res.status(404).json({ error: 'Không tìm thấy thú cưng.' });

    const nextLevelExp = getExpForNextLevel(pet.level);
    if (pet.exp < nextLevelExp) {
      return res.status(400).json({
        error: `Bể chứa hiện có ${pet.exp}/${nextLevelExp} EXP. Cần thêm ${nextLevelExp - pet.exp} EXP nữa để thăng cấp!`
      });
    }

    const newLevel = pet.level + 1;
    const remainingExp = pet.exp - nextLevelExp;
    const newNextLevelExp = getExpForNextLevel(newLevel);

    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        level: newLevel,
        exp: remainingExp,
        currentState: 'EVOLVING'
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    res.json({
      message: `Thăng cấp thành công lên Cấp ${newLevel}!`,
      pet: {
        ...formatUserPet(updated),
        nextLevelExp: newNextLevelExp,
        expProgress: Math.min(100, Math.round((remainingExp / newNextLevelExp) * 100))
      },
      didLevelUp: true
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi thăng cấp thú cưng.', details: error.message });
  }
});

/**
 * Drink Water / Hydrate Interaction (US-U06)
 */
router.post('/drink', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        user: true,
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    if (!pet) return res.status(404).json({ error: 'Không tìm thấy thú cưng.' });

    const expBoostPercent = calculateExpBoostPercent(pet.userItems);
    const expGain = Math.round(20 * (100 + expBoostPercent) / 100);
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);
    let newLevel = pet.level;
    let didLevelUp = false;

    if (newExp >= nextLevelExp) {
      newLevel += 1;
      didLevelUp = true;
    }

    const newHealth = Math.min(100, pet.health + 20);
    const newHappiness = Math.min(100, pet.happiness + 15);

    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        health: newHealth,
        happiness: newHappiness,
        exp: didLevelUp ? newExp - nextLevelExp : newExp,
        level: newLevel,
        lastInteractionAt: new Date(),
        currentState: 'DRINKING'
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    await prisma.eXPRecord.create({
      data: {
        userId,
        petId: pet.id,
        deptId: pet.user.deptId,
        amount: expGain,
        source: 'DRINK',
        description: 'Cùng uống nước bổ sung năng lượng'
      }
    });

    if (pet.user.deptId) {
      await prisma.department.update({
        where: { id: pet.user.deptId },
        data: { gardenExp: { increment: expGain } }
      });
    }

    // Track quest progress
    void QuestService.recordActionProgress(userId, 'DRINK', 1);

    const currentNextExp = getExpForNextLevel(updated.level);
    res.json({
      message: 'Đã cùng bé cưng uống nước thanh lọc cơ thể! Sức khỏe phục hồi +20.',
      pet: {
        ...formatUserPet(updated),
        nextLevelExp: currentNextExp,
        expProgress: Math.min(100, Math.round((updated.exp / currentNextExp) * 100))
      },
      didLevelUp,
      expGained: expGain,
      expBoostPercent
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi ghi nhận uống nước.', details: error.message });
  }
});

/**
 * Update Pet Animation State (11 Core states + legacy fallbacks)
 */
router.post('/state', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { state } = req.body;

    const validStates = [
      'IDLE', 'TYPING', 'SLEEPING', 'WAKING_UP', 'HAPPY', 'SAD', 'YAWNING',
      'HUNGRY', 'EATING', 'PETTING', 'DANCING', 'DRINKING', 'EXERCISING',
      'WAVING', 'THANKING', 'CELEBRATING', 'EVOLVING'
    ];

    if (!validStates.includes(state)) {
      return res.status(400).json({ error: `State không hợp lệ. Phải là một trong: ${validStates.join(', ')}` });
    }

    const stateFallbackMap: Record<string, string> = {
      CELEBRATING: 'HAPPY',
      THANKING: 'HAPPY',
      EVOLVING: 'HAPPY',
      EXERCISING: 'DANCING',
      YAWNING: 'SLEEPING',
      WAKING_UP: 'IDLE',
    };

    const userPet = await prisma.userPet.findUnique({
      where: { userId },
      include: { petType: true }
    });

    let resolvedState = state;
    if (userPet?.petType?.animations) {
      try {
        const anims = typeof userPet.petType.animations === 'string'
          ? JSON.parse(userPet.petType.animations)
          : userPet.petType.animations;
        if (!anims[state]) {
          resolvedState = stateFallbackMap[state] || state;
        }
      } catch {
        resolvedState = stateFallbackMap[state] || state;
      }
    }

    const updated = await prisma.userPet.update({
      where: { userId },
      data: { currentState: resolvedState }
    });

    if (resolvedState === 'DRINKING') {
      void QuestService.recordActionProgress(userId, 'DRINK', 1);
    }

    res.json({ message: 'Cập nhật trạng thái thành công!', currentState: updated.currentState });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái.', details: error.message });
  }
});

/**
 * Switch Working Mode (Strict / Relaxed) (US-U03)
 */
router.post('/mode', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mode } = req.body;

    if (!['STRICT', 'RELAXED'].includes(mode)) {
      return res.status(400).json({ error: 'Chế độ phải là STRICT hoặc RELAXED.' });
    }

    const updated = await prisma.userPet.update({
      where: { userId },
      data: {
        currentMode: mode,
        currentState: mode === 'STRICT' ? 'TYPING' : 'IDLE'
      },
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    res.json({ message: `Đã chuyển sang Chế độ ${mode === 'STRICT' ? 'Nghiêm túc' : 'Thư giãn'}!`, pet: formatUserPet(updated) });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi chuyển chế độ.', details: error.message });
  }
});

/**
 * Update Desktop Overlay Transform (US-U02, US-U09)
 * Dimensions: 100px - 150px
 */
router.patch('/transform', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { positionX, positionY, scaleSize, isHidden } = req.body;

    const data: any = {};
    if (positionX !== undefined) data.positionX = Number(positionX);
    if (positionY !== undefined) data.positionY = Number(positionY);
    if (scaleSize !== undefined) data.scaleSize = scaleSize; // SMALL, MEDIUM, LARGE
    if (isHidden !== undefined) data.isHidden = Boolean(isHidden);

    const updated = await prisma.userPet.update({
      where: { userId },
      data,
      include: {
        petType: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    res.json({ message: 'Lưu vị trí thú cưng thành công!', pet: formatUserPet(updated) });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi lưu vị trí.', details: error.message });
  }
});

/**
 * Pomodoro Focus Session End (US-U11, US-U13)
 */
router.post('/session/finish', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { durationMinutes, mode, violationsCount } = req.body;

    const mins = Number(durationMinutes);
    const violations = Number(violationsCount ?? 0);
    if (!Number.isInteger(mins) || mins < 1 || mins > 180) {
      return res.status(400).json({ error: 'Thời lượng phiên tập trung phải từ 1 đến 180 phút.' });
    }
    if (!['STRICT', 'RELAXED'].includes(mode)) {
      return res.status(400).json({ error: 'Chế độ phải là STRICT hoặc RELAXED.' });
    }
    if (!Number.isInteger(violations) || violations < 0) {
      return res.status(400).json({ error: 'Số lần mất tập trung không hợp lệ.' });
    }
    const focusScore = Math.max(0, 100 - violations * 10);

    const session = await prisma.workSession.create({
      data: {
        userId,
        mode,
        durationMinutes: mins,
        focusScore,
        violationsCount: violations,
        isCompleted: true,
        endTime: new Date()
      }
    });

    // Award EXP
    let expAward = Math.round(mins * 2);
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        user: true,
        userItems: { where: { isEquipped: true }, include: { item: true } }
      }
    });

    let expBoostPercent = 0;
    if (pet) {
      expBoostPercent = calculateExpBoostPercent(pet.userItems);
      expAward = Math.round(expAward * (100 + expBoostPercent) / 100);
      const totalExp = pet.exp + expAward;
      const nextLevelExp = getExpForNextLevel(pet.level);
      let newLevel = pet.level;
      let finalExp = totalExp;
      let didLevelUp = false;
      if (totalExp >= nextLevelExp) {
        newLevel += 1;
        finalExp = totalExp - nextLevelExp;
        didLevelUp = true;
      }

      await prisma.userPet.update({
        where: { id: pet.id },
        data: {
          exp: finalExp,
          level: newLevel,
          currentState: didLevelUp ? 'EVOLVING' : 'CELEBRATING'
        }
      });

      await prisma.eXPRecord.create({
        data: {
          userId,
          petId: pet.id,
          deptId: pet.user.deptId,
          amount: expAward,
          source: 'POMODORO',
          description: `Hoàn thành phiên làm việc ${mins} phút`
        }
      });

      if (pet.user.deptId) {
        await prisma.department.update({
          where: { id: pet.user.deptId },
          data: { gardenExp: { increment: expAward } }
        });
      }

      // Track quest progress
      void QuestService.recordActionProgress(userId, 'POMODORO', 1);
    }

    // Persist Daily Goal progress
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const sessionHours = Number((mins / 60).toFixed(2));
      const existingGoal = await prisma.dailyGoal.findFirst({
        where: {
          userId,
          targetDate: { gte: todayStart, lte: todayEnd }
        }
      });

      if (existingGoal) {
        const newActual = Number((existingGoal.actualHours + sessionHours).toFixed(2));
        const isCompleted = newActual >= existingGoal.targetHours;
        await prisma.dailyGoal.update({
          where: { id: existingGoal.id },
          data: {
            actualHours: newActual,
            status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
            streakCount: isCompleted && existingGoal.status !== 'COMPLETED' ? existingGoal.streakCount + 1 : existingGoal.streakCount
          }
        });
      } else {
        const isCompleted = sessionHours >= 4.0;
        await prisma.dailyGoal.create({
          data: {
            userId,
            targetDate: new Date(),
            targetHours: 4.0,
            actualHours: sessionHours,
            status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
            streakCount: isCompleted ? 1 : 0
          }
        });
      }
    } catch (goalErr) {
      console.warn('Failed to update daily goal:', goalErr);
    }

    res.json({
      message: `Tuyệt vời! Bạn đã hoàn thành ${mins} phút tập trung!`,
      session,
      expAward,
      expBoostPercent
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi ghi nhận phiên làm việc.', details: error.message });
  }
});

/**
 * Get Personal Productivity Dashboard & Pomodoro Session Stats (Module 3 & 4)
 */
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todaySessions, recentSessions, latestGoal] = await Promise.all([
      prisma.workSession.findMany({
        where: {
          userId,
          isCompleted: true,
          startTime: { gte: startOfToday }
        },
        orderBy: { startTime: 'desc' }
      }),
      prisma.workSession.findMany({
        where: { userId, isCompleted: true },
        orderBy: { startTime: 'desc' },
        take: 10
      }),
      prisma.dailyGoal.findFirst({
        where: { userId },
        orderBy: { targetDate: 'desc' }
      })
    ]);

    const todayTotalMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const todaySessionCount = todaySessions.length;
    const avgFocusScore =
      todaySessionCount > 0
        ? Math.round(todaySessions.reduce((acc, s) => acc + (s.focusScore || 100), 0) / todaySessionCount)
        : 100;

    const targetHours = latestGoal?.targetHours || 4.0;
    const streakDays = latestGoal?.streakCount || (todaySessionCount > 0 ? 1 : 0);

    res.json({
      todayTotalMinutes,
      todaySessionCount,
      avgFocusScore,
      targetHours,
      streakDays,
      recentSessions
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải thống kê phiên làm việc.', details: error.message });
  }
});

/**
 * Update Daily Focus Goal (Module 3 - Daily Focus Goal Setting)
 */
router.post('/daily-goal', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetHours = Math.max(0.5, Math.min(16, Number(req.body.targetHours) || 4.0));

    const existingGoal = await prisma.dailyGoal.findFirst({
      where: { userId },
      orderBy: { targetDate: 'desc' }
    });

    const updatedGoal = existingGoal
      ? await prisma.dailyGoal.update({
          where: { id: existingGoal.id },
          data: { targetHours }
        })
      : await prisma.dailyGoal.create({
          data: {
            userId,
            targetHours,
            actualHours: 0,
            streakCount: 1,
            status: 'IN_PROGRESS'
          }
        });

    res.json({
      message: `Đã cập nhật mục tiêu tập trung hàng ngày: ${targetHours} giờ!`,
      goal: updatedGoal
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cập nhật mục tiêu tập trung.', details: error.message });
  }
});

/**
 * AI Companion Chat (US-U23, US-U21)
 */
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!message || message.length > 2000) {
      return res.status(400).json({ error: 'Vui lòng nhập tin nhắn.' });
    }
    const pet = await prisma.userPet.findUnique({
      where: { userId },
      select: { id: true }
    });
    if (!pet) {
      return res.status(409).json({ error: 'Hãy chọn thú cưng trước khi bắt đầu trò chuyện.' });
    }

    const aiResult = await AIService.chatWithPet(userId, message);

    // If petStateChange specified, update pet
    if (aiResult.petStateChange) {
      await prisma.userPet.update({
        where: { userId },
        data: { currentState: aiResult.petStateChange }
      });
    }

    // Track quest progress
    void QuestService.recordActionProgress(userId, 'CHAT', 1);

    res.json(aiResult);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi trò chuyện cùng AI.', details: error.message });
  }
});

/**
 * Get AI Chat History (US-U23)
 */
router.get('/chat/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const history = await prisma.aIChatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    res.json(history.map(item => ({
      id: item.id,
      sender: item.role === 'assistant' ? 'pet' : 'user',
      text: item.message,
      timestamp: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: item.createdAt
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải lịch sử chat.', details: error.message });
  }
});

/**
 * Morning Mood Check-in (US-U28)
 */
router.post('/mood', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { score, note } = req.body;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Điểm tâm trạng từ 1 đến 5.' });
    }

    const aiRec = await AIService.getMoodRecommendation(userId, score, note);

    const moodLog = await prisma.moodLog.create({
      data: {
        userId,
        score,
        note,
        aiRecommendation: aiRec
      }
    });

    res.json({
      message: 'Ghi nhận tâm trạng thành công!',
      moodLog,
      aiRecommendation: aiRec
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi lưu tâm trạng.', details: error.message });
  }
});

/**
 * Department EXP Leaderboard (US-U08)
 */
router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.deptId) {
      return res.status(400).json({ error: 'Người dùng chưa thuộc phòng ban nào.' });
    }

    // Aggregate EXP by user in this department
    const records = await prisma.eXPRecord.groupBy({
      by: ['userId'],
      where: { deptId: user.deptId, source: { not: 'SHOP_PURCHASE' } },
      _sum: { amount: true },
      orderBy: {
        _sum: { amount: 'desc' }
      }
    });

    // Populate user details
    const userIds = records.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: {
        userPet: { include: { petType: true } }
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const leaderboard = records.map((r, index) => {
      const u = userMap.get(r.userId);
      return {
        rank: index + 1,
        userId: r.userId,
        fullName: u?.fullName || 'Đồng nghiệp',
        avatarUrl: u?.avatarUrl,
        petName: u?.userPet?.name || 'Pet',
        petType: u?.userPet?.petType?.name || 'Pixel Pet',
        totalExp: r._sum.amount || 0,
        isCurrentUser: r.userId === userId
      };
    });

    const top10 = leaderboard.slice(0, 10);
    const currentUserRank = leaderboard.find(l => l.isCurrentUser);

    res.json({
      top10,
      currentUserRank,
      totalParticipants: leaderboard.length
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải bảng xếp hạng.', details: error.message });
  }
});

export default router;
