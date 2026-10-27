import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { formatPetType } from '../utils/jsonHelper';
import { ensureUserRoomSession, getRoomCategoryInfo } from './departments';

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
    const roomSession = await ensureUserRoomSession(userId, dept.id);
    const cat = getRoomCategoryInfo(dept.themeId);

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
      inviteCode: dept.inviteCode,
      themeId: cat.id,
      themeLabel: cat.label,
      themeIcon: cat.icon,
      likesCount: roomSession.likesCount,
      hasLiked: roomSession.hasLiked,
      joinedAt: roomSession.joinedAt,
      elapsedSeconds: roomSession.elapsedSeconds,
      remainingSeconds: roomSession.remainingSeconds,
      canLike: roomSession.canLike,
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

export default router;
