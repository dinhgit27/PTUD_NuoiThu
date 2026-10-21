import { Request, Response, Router } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
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

    // Reset daily interactions if passed 24h
    const now = new Date();
    if (pet.lastInteractionAt) {
      const diffHours = (now.getTime() - pet.lastInteractionAt.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 24 && pet.dailyInteractionsLeft < 3) {
        await prisma.userPet.update({
          where: { id: pet.id },
          data: { dailyInteractionsLeft: 3 }
        });
        pet.dailyInteractionsLeft = 3;
      }
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

    if (pet.dailyInteractionsLeft <= 0) {
      return res.status(400).json({ error: 'Bạn đã hết 3 lượt tương tác hôm nay. Hãy tiếp tục làm việc chăm chỉ nhé!' });
    }

    const expBoostPercent = calculateExpBoostPercent(pet.userItems);
    const expGain = Math.round(50 * (100 + expBoostPercent) / 100);
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);
    let newLevel = pet.level;
    let didLevelUp = false;

    if (newExp >= nextLevelExp) {
      newLevel += 1;
      didLevelUp = true;
    }

    const newHunger = Math.min(100, pet.hunger + 30);
    const newHappiness = Math.min(100, pet.happiness + 15);

    // Update Pet
    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        hunger: newHunger,
        happiness: newHappiness,
        exp: didLevelUp ? newExp - nextLevelExp : newExp,
        level: newLevel,
        dailyInteractionsLeft: pet.dailyInteractionsLeft - 1,
        lastInteractionAt: new Date(),
        currentState: didLevelUp ? 'EVOLVING' : 'EATING'
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
      message: didLevelUp ? 'Thú cưng đã tiến hóa lên cấp mới!' : 'Cho ăn thành công!',
      pet: formatUserPet(updated),
      didLevelUp,
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

    if (pet.dailyInteractionsLeft <= 0) {
      return res.status(400).json({ error: 'Bạn đã hết 3 lượt tương tác hôm nay.' });
    }

    const expBoostPercent = calculateExpBoostPercent(pet.userItems);
    const expGain = Math.round(30 * (100 + expBoostPercent) / 100);
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);
    let newLevel = pet.level;
    let didLevelUp = false;

    if (newExp >= nextLevelExp) {
      newLevel += 1;
      didLevelUp = true;
    }

    const updated = await prisma.userPet.update({
      where: { id: pet.id },
      data: {
        happiness: Math.min(100, pet.happiness + 25),
        exp: didLevelUp ? newExp - nextLevelExp : newExp,
        level: newLevel,
        dailyInteractionsLeft: pet.dailyInteractionsLeft - 1,
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
      pet: formatUserPet(updated),
      didLevelUp,
      expGained: expGain,
      expBoostPercent
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi vuốt ve thú cưng.', details: error.message });
  }
});

/**
 * Update Pet Animation State (17 states)
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

    const updated = await prisma.userPet.update({
      where: { userId },
      data: { currentState: state }
    });

    if (state === 'DRINKING') {
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
