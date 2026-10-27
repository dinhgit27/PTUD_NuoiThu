import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { formatPetType } from '../utils/jsonHelper';

const router = Router();
const prisma = new PrismaClient();

function getGardenBuffMultiplier(level: number) {
  if (level >= 5) return 1.8;
  if (level >= 3) return 1.5;
  if (level >= 2) return 1.2;
  return 1.0;
}

/**
 * Get Shared Virtual Garden info for user's department (US-U17, US-U18)
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          include: { background: true }
        }
      }
    });

    if (!user || !user.deptId) {
      return res.status(400).json({ error: 'Người dùng chưa được phân vào phòng ban nào.' });
    }

    const dept = user.department!;

    // Fetch all pets of members in this department
    const memberPets = await prisma.userPet.findMany({
      where: {
        user: { deptId: dept.id }
      },
      include: {
        petType: true,
        user: {
          select: { id: true, fullName: true, avatarUrl: true }
        }
      }
    });

    const expNeededForNextLevel = dept.gardenLevel * 1000;
    const buffMultiplier = getGardenBuffMultiplier(dept.gardenLevel);

    res.json({
      departmentId: dept.id,
      departmentName: dept.name,
      gardenLevel: dept.gardenLevel,
      gardenExp: dept.gardenExp,
      expNeededForNextLevel,
      expProgress: Math.min(100, Math.round((dept.gardenExp / expNeededForNextLevel) * 100)),
      buffMultiplier,
      background: dept.background || {
        id: 'default_spring',
        name: 'Khu Vườn Mùa Xuân',
        imageUrl: '/backgrounds/garden_spring.png'
      },
      pets: memberPets.map(p => ({
        id: p.id,
        name: p.name,
        level: p.level,
        ownerId: p.userId,
        ownerName: p.user.fullName,
        ownerAvatar: p.user.avatarUrl,
        currentState: p.currentState,
        currentMode: p.currentMode,
        positionX: p.positionX,
        positionY: p.positionY,
        petType: formatPetType(p.petType),
        isCurrentUsersPet: p.userId === userId
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải Khu vườn ảo phòng ban.', details: error.message });
  }
});

/**
 * List pixel-art backgrounds available for users to select
 */
router.get('/backgrounds', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { deptId: true }
    });
    if (!user?.deptId) return res.json([]);

    const backgrounds = await prisma.gardenBackground.findMany({
      where: {
        isActive: true,
        OR: [
          { ownedByDepartments: { some: { departmentId: user.deptId } } },
          { departments: { some: { id: user.deptId } } }
        ]
      },
      orderBy: [{ isRecommended: 'desc' }, { createdAt: 'desc' }]
    });
    res.json(backgrounds);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh sách bối cảnh.', details: error.message });
  }
});

/**
 * Set the Shared Garden background for user's department
 */
router.post('/background', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { backgroundId } = req.body;

    if (!backgroundId) {
      return res.status(400).json({ error: 'Vui lòng chọn bối cảnh.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.deptId) {
      return res.status(400).json({ error: 'Người dùng không thuộc phòng ban nào.' });
    }

    const bg = await prisma.gardenBackground.findUnique({ where: { id: backgroundId, isActive: true } });
    if (!bg) {
      return res.status(404).json({ error: 'Không tìm thấy bối cảnh này.' });
    }

    const owned = await prisma.departmentBackground.findUnique({
      where: {
        departmentId_backgroundId: {
          departmentId: user.deptId,
          backgroundId
        }
      }
    });
    const department = await prisma.department.findUnique({
      where: { id: user.deptId },
      select: { backgroundId: true }
    });
    if (!owned && department?.backgroundId !== backgroundId) {
      return res.status(403).json({ error: 'Phòng chung chưa sở hữu bối cảnh này. Hãy mua tại Cửa hàng.' });
    }

    const updatedDept = await prisma.department.update({
      where: { id: user.deptId },
      data: { backgroundId },
      include: { background: true }
    });

    res.json({
      message: `Đã đổi không gian Khu vườn chung sang "${bg.name}"!`,
      department: updatedDept
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi đổi bối cảnh khu vườn.', details: error.message });
  }
});

/**
 * Send Gift to a Colleague's Pet (US-U12)
 */
router.post('/gift', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, itemId, message } = req.body;

    if (!receiverId || !itemId) {
      return res.status(400).json({ error: 'Vui lòng chọn đồng nghiệp và quà tặng.' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Bạn không thể tự gửi quà cho chính mình.' });
    }

    const gift = await prisma.gift.create({
      data: {
        senderId,
        receiverId,
        itemId,
        message
      },
      include: {
        item: true,
        receiver: {
          select: { fullName: true }
        }
      }
    });

    // Add EXP to Department Garden
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (sender?.deptId) {
      await prisma.department.update({
        where: { id: sender.deptId },
        data: { gardenExp: { increment: 20 } }
      });
    }

    res.status(201).json({
      message: `Đã gửi ${gift.item.name} tặng bé cưng của bạn ${gift.receiver.fullName}!`,
      gift
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi gửi quà.', details: error.message });
  }
});

/**
 * Water Shared Virtual Garden (US-U17)
 */
router.post('/water', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        userPet: true
      }
    });

    if (!user || !user.deptId || !user.department) {
      return res.status(400).json({ error: 'Người dùng chưa được phân vào phòng ban nào.' });
    }

    const dept = user.department;
    const gardenExpGain = 25;
    const petExpGain = 15;
    const newGardenExp = dept.gardenExp + gardenExpGain;
    const expNeeded = dept.gardenLevel * 1000;
    let newGardenLevel = dept.gardenLevel;
    let didLevelUp = false;

    if (newGardenExp >= expNeeded) {
      newGardenLevel += 1;
      didLevelUp = true;
    }

    const updatedDept = await prisma.department.update({
      where: { id: dept.id },
      data: {
        gardenExp: didLevelUp ? newGardenExp - expNeeded : newGardenExp,
        gardenLevel: newGardenLevel
      }
    });

    // Award pet exp & happiness if user has pet
    if (user.userPet) {
      await prisma.userPet.update({
        where: { id: user.userPet.id },
        data: {
          happiness: Math.min(100, user.userPet.happiness + 10),
          exp: user.userPet.exp + petExpGain,
          currentState: 'HAPPY'
        }
      });

      await prisma.eXPRecord.create({
        data: {
          userId,
          petId: user.userPet.id,
          deptId: dept.id,
          amount: petExpGain,
          source: 'GARDEN_WATER',
          description: 'Tưới nước chăm sóc khu vườn chung phòng ban'
        }
      });
    }

    res.json({
      message: didLevelUp
        ? `🌸 Tuyệt vời! Khu vườn chung "${dept.name}" đã thăng lên Cấp ${newGardenLevel}!`
        : `💧 Bạn đã tưới nước cho cây vườn! Nhận thêm +${gardenExpGain} EXP Khu Vườn và +${petExpGain} EXP Bé cưng.`,
      gardenLevel: updatedDept.gardenLevel,
      gardenExp: updatedDept.gardenExp,
      didLevelUp
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tưới cây khu vườn.', details: error.message });
  }
});

/**
 * Send Hearts to Shared Garden & Member Pets (US-U17)
 */
router.post('/heart', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        userPet: true
      }
    });

    if (!user || !user.deptId || !user.department) {
      return res.status(400).json({ error: 'Người dùng chưa được phân vào phòng ban nào.' });
    }

    const dept = user.department;
    const gardenExpGain = 15;
    const newGardenExp = dept.gardenExp + gardenExpGain;
    const expNeeded = dept.gardenLevel * 1000;
    let newGardenLevel = dept.gardenLevel;
    let didLevelUp = false;

    if (newGardenExp >= expNeeded) {
      newGardenLevel += 1;
      didLevelUp = true;
    }

    const updatedDept = await prisma.department.update({
      where: { id: dept.id },
      data: {
        gardenExp: didLevelUp ? newGardenExp - expNeeded : newGardenExp,
        gardenLevel: newGardenLevel
      }
    });

    // Spread happiness to all pets in the department
    await prisma.userPet.updateMany({
      where: { user: { deptId: dept.id } },
      data: {
        happiness: 100
      }
    });

    if (user.userPet) {
      await prisma.eXPRecord.create({
        data: {
          userId,
          petId: user.userPet.id,
          deptId: dept.id,
          amount: gardenExpGain,
          source: 'GARDEN_HEART',
          description: 'Thả tim lan tỏa năng lượng tích cực cho cả phòng ban'
        }
      });
    }

    res.json({
      message: '💖 Bạn đã thả tim lan tỏa năng lượng tích cực! Tất cả thú cưng trong phòng đã hồi phục 100% Hạnh phúc!',
      gardenLevel: updatedDept.gardenLevel,
      gardenExp: updatedDept.gardenExp,
      didLevelUp
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi thả tim khu vườn.', details: error.message });
  }
});

export default router;
