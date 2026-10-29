import { Router, Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

export type MainRoomType = 'RELAX' | 'FOCUS';
export type RoomTopicId = 'RELAX' | 'FOCUS' | 'WORK' | 'STUDY' | 'CHILL' | 'CREATIVE' | 'SOCIAL';

export interface RoomTypeDetail {
  type: MainRoomType;
  label: string;
  icon: string;
  badgeClass: string;
  description: string;
}

export const ROOM_TYPES: Record<MainRoomType, RoomTypeDetail> = {
  RELAX: {
    type: 'RELAX',
    label: 'Thư giãn',
    icon: '☕',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Nghe nhạc Lofi, nghỉ ngơi xả stress, tán gẫu & thư thái cùng thú cưng'
  },
  FOCUS: {
    type: 'FOCUS',
    label: 'Tập trung',
    icon: '⏱️',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Làm việc chuyên sâu, Pomodoro, chạy deadline & nâng cao hiệu suất'
  }
};

export function normalizeRoomType(input?: string | null): MainRoomType {
  if (!input) return 'RELAX';
  const upper = input.toUpperCase().trim();
  if (upper === 'FOCUS' || upper === 'WORK' || upper === 'STUDY') {
    return 'FOCUS';
  }
  return 'RELAX';
}

export function getRoomTypeInfo(typeOrTheme?: string | null): RoomTypeDetail {
  const norm = normalizeRoomType(typeOrTheme);
  return ROOM_TYPES[norm] || ROOM_TYPES.RELAX;
}

export function getRoomCategoryInfo(themeId?: string | null) {
  const norm = normalizeRoomType(themeId);
  const info = getRoomTypeInfo(norm);
  return {
    id: norm,
    label: info.label,
    icon: info.icon,
    description: info.description,
    keywords: norm === 'RELAX' ? ['thư giãn', 'chill', 'lofi', 'social', 'art'] : ['tập trung', 'work', 'focus', 'study']
  };
}

export function resolveRoomTopicFromText(input?: string | null): MainRoomType | 'ALL' {
  if (!input) return 'RELAX';
  const trimmed = input.trim().toUpperCase();
  if (trimmed === 'ALL') return 'ALL';
  return normalizeRoomType(input);
}

function makeInviteCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

const isSqlServer = () => {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('sqlserver') || !url.startsWith('file:');
};

let tablesInitialized = false;

export async function ensureRoomTablesAndSeed() {
  if (tablesInitialized) return;
  try {
    if (isSqlServer()) {
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='room_likes' AND xtype='U')
        BEGIN
          CREATE TABLE room_likes (
            id NVARCHAR(100) PRIMARY KEY,
            dept_id NVARCHAR(100) NOT NULL,
            user_id NVARCHAR(100) NOT NULL,
            created_at BIGINT NOT NULL
          );
        END
      `);
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_room_likes_dept' AND object_id = OBJECT_ID('room_likes'))
        BEGIN
          CREATE INDEX idx_room_likes_dept ON room_likes(dept_id);
        END
      `);
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='room_member_sessions' AND xtype='U')
        BEGIN
          CREATE TABLE room_member_sessions (
            user_id NVARCHAR(100) NOT NULL,
            dept_id NVARCHAR(100) NOT NULL,
            joined_at BIGINT NOT NULL,
            has_liked INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, dept_id)
          );
        END
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS room_likes (
          id TEXT PRIMARY KEY,
          dept_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_room_likes_dept ON room_likes(dept_id)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS room_member_sessions (
          user_id TEXT NOT NULL,
          dept_id TEXT NOT NULL,
          joined_at INTEGER NOT NULL,
          has_liked INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, dept_id)
        )
      `);
    }

    // Ensure default Organization & Backgrounds exist for seeded rooms
    const org = await prisma.organization.upsert({
      where: { domain: 'techcorp.com' },
      update: {},
      create: {
        name: 'TechCorp Solutions',
        domain: 'techcorp.com',
        packageTier: 'ENTERPRISE',
        status: 'ACTIVE'
      }
    });

    const bgs = await prisma.gardenBackground.findMany({ where: { isActive: true } });
    const bgByName = (keyword: string) =>
      bgs.find(b => b.name.toLowerCase().includes(keyword.toLowerCase()))?.id || bgs[0]?.id || null;

    const defaultRooms: Array<{
      inviteCode: string;
      name: string;
      roomType: MainRoomType;
      gardenLevel: number;
      gardenExp: number;
      workHours: string;
      bgKeyword: string;
      seedLikes: number;
    }> = [
      {
        inviteCode: 'CHILL01',
        name: 'Trạm Dừng Lofi & Trà Chiều Thư Giãn',
        roomType: 'RELAX',
        gardenLevel: 4,
        gardenExp: 2450,
        workHours: '24/7 Tự do',
        bgKeyword: 'Hoàng Hôn',
        seedLikes: 48
      },
      {
        inviteCode: 'WORK01',
        name: 'Không Gian Làm Việc Deep Focus',
        roomType: 'FOCUS',
        gardenLevel: 4,
        gardenExp: 2180,
        workHours: '08:00 - 22:00',
        bgKeyword: 'Cây Xanh',
        seedLikes: 39
      },
      {
        inviteCode: 'STUDY01',
        name: 'Thư Viện Tự Học & Ôn Thi Pomodoro',
        roomType: 'FOCUS',
        gardenLevel: 3,
        gardenExp: 1720,
        workHours: '07:00 - 23:00',
        bgKeyword: 'Cafe',
        seedLikes: 31
      },
      {
        inviteCode: 'RELAX02',
        name: 'Góc Cà Phê Mèo & Thư Giãn Cuối Tuần',
        roomType: 'RELAX',
        gardenLevel: 3,
        gardenExp: 1450,
        workHours: '24/7 Tự do',
        bgKeyword: 'Cafe',
        seedLikes: 25
      },
      {
        inviteCode: 'TECH01',
        name: 'Phòng Kỹ Thuật & Phần Mềm',
        roomType: 'FOCUS',
        gardenLevel: 3,
        gardenExp: 1250,
        workHours: '08:30 - 17:30',
        bgKeyword: 'Mùa Xuân',
        seedLikes: 20
      },
      {
        inviteCode: 'ART01',
        name: 'Xưởng Sáng Tạo & Thư Thái Pixel',
        roomType: 'RELAX',
        gardenLevel: 2,
        gardenExp: 920,
        workHours: '09:00 - 18:30',
        bgKeyword: 'Mùa Xuân',
        seedLikes: 14
      }
    ];

    for (const r of defaultRooms) {
      const bgId = bgByName(r.bgKeyword);
      const dept = await prisma.department.upsert({
        where: { inviteCode: r.inviteCode },
        update: {
          themeId: r.roomType,
          ...(bgId ? { backgroundId: bgId } : {})
        },
        create: {
          orgId: org.id,
          name: r.name,
          inviteCode: r.inviteCode,
          themeId: r.roomType,
          gardenLevel: r.gardenLevel,
          gardenExp: r.gardenExp,
          workHours: r.workHours,
          backgroundId: bgId
        }
      });

      let countRows: any[];
      if (isSqlServer()) {
        countRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = @P1`,
          dept.id
        );
      } else {
        countRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
          dept.id
        );
      }
      const currentLikes = Number(countRows?.[0]?.total || 0);

      if (currentLikes === 0 && r.seedLikes > 0) {
        const now = Date.now();
        for (let i = 1; i <= r.seedLikes; i++) {
          const likeId = `seed_${r.inviteCode}_${i}`;
          const botUserId = `seed_bot_${i}`;
          if (isSqlServer()) {
            await prisma.$executeRawUnsafe(
              `IF NOT EXISTS (SELECT 1 FROM room_likes WHERE id = @P1)
               INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (@P1, @P2, @P3, @P4)`,
              likeId,
              dept.id,
              botUserId,
              BigInt(now - i * 60000)
            );
          } else {
            await prisma.$executeRawUnsafe(
              `INSERT OR IGNORE INTO room_likes (id, dept_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
              likeId,
              dept.id,
              botUserId,
              now - i * 60000
            );
          }
        }
      }
    }

    tablesInitialized = true;
  } catch (err) {
    console.error('Error initializing room tables:', err);
  }
}

export async function recordUserJoinRoom(userId: string, deptId: string) {
  await ensureRoomTablesAndSeed();
}

export async function ensureUserRoomSession(userId: string, deptId: string) {
  await ensureRoomTablesAndSeed();
  let hasLiked = false;
  try {
    if (isSqlServer()) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 1 as liked FROM room_likes WHERE dept_id = @P1 AND user_id = @P2`,
        deptId,
        userId
      );
      hasLiked = Boolean(rows && rows.length > 0);
    } else {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 1 as liked FROM room_likes WHERE dept_id = ? AND user_id = ?`,
        deptId,
        userId
      );
      hasLiked = Boolean(rows && rows.length > 0);
    }
  } catch {}

  let likesCount = 0;
  try {
    let countRows: any[];
    if (isSqlServer()) {
      countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = @P1`,
        deptId
      );
    } else {
      countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
        deptId
      );
    }
    likesCount = Number(countRows?.[0]?.total || 0);
  } catch {}

  return {
    joinedAt: Date.now(),
    hasLiked,
    likesCount,
    elapsedSeconds: 300,
    remainingSeconds: 0,
    canLike: !hasLiked
  };
}

export async function getEnrichedRoomsList(currentUserId?: string, typeFilter?: string, searchQuery?: string) {
  await ensureRoomTablesAndSeed();

  const departments = await prisma.department.findMany({
    include: {
      background: true,
      _count: {
        select: { users: true }
      }
    }
  });

  const likeCountsRaw = await prisma.$queryRawUnsafe<Array<{ dept_id: string; total: number | bigint }>>(
    `SELECT dept_id, COUNT(*) as total FROM room_likes GROUP BY dept_id`
  );
  const likesMap = new Map<string, number>();
  for (const row of likeCountsRaw) {
    likesMap.set(row.dept_id, Number(row.total || 0));
  }

  const userLikedSet = new Set<string>();
  if (currentUserId) {
    let userLikedRows: Array<{ dept_id: string }>;
    if (isSqlServer()) {
      userLikedRows = await prisma.$queryRawUnsafe<Array<{ dept_id: string }>>(
        `SELECT dept_id FROM room_likes WHERE user_id = @P1`,
        currentUserId
      );
    } else {
      userLikedRows = await prisma.$queryRawUnsafe<Array<{ dept_id: string }>>(
        `SELECT dept_id FROM room_likes WHERE user_id = ?`,
        currentUserId
      );
    }
    for (const row of userLikedRows) {
      userLikedSet.add(row.dept_id);
    }
  }

  const filterNorm = typeFilter && typeFilter !== 'ALL' ? normalizeRoomType(typeFilter) : 'ALL';
  const searchLower = (searchQuery || '').trim().toLowerCase();

  const enriched = departments
    .map(dept => {
      const typeInfo = getRoomTypeInfo(dept.themeId);
      const likesCount = likesMap.get(dept.id) || 0;
      const memberCount = dept._count?.users || 0;
      return {
        id: dept.id,
        name: dept.name,
        inviteCode: dept.inviteCode,
        roomType: typeInfo.type,
        themeId: typeInfo.type,
        themeLabel: typeInfo.label,
        themeIcon: typeInfo.icon,
        typeLabel: typeInfo.label,
        typeIcon: typeInfo.icon,
        typeBadgeClass: typeInfo.badgeClass,
        typeDescription: typeInfo.description,
        workHours: dept.workHours || (typeInfo.type === 'RELAX' ? '24/7 Tự do' : '08:00 - 18:00'),
        gardenLevel: dept.gardenLevel,
        gardenExp: dept.gardenExp,
        likesCount,
        memberCount,
        hasLiked: userLikedSet.has(dept.id),
        background: dept.background || {
          id: 'default_spring',
          name: 'Khu Vườn Mùa Xuân',
          imageUrl: '/backgrounds/garden_spring.png'
        },
        createdAt: dept.createdAt
      };
    })
    .filter(room => {
      if (filterNorm !== 'ALL' && room.roomType !== filterNorm) return false;
      if (searchLower) {
        const matchesName = room.name.toLowerCase().includes(searchLower);
        const matchesCode = room.inviteCode.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    })
    // Sort strictly by likesCount descending ("phòng nào được ưa thích thì xếp trên")
    .sort((a, b) => {
      if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return b.gardenExp - a.gardenExp;
    })
    .map((room, index) => ({
      ...room,
      rank: index + 1,
      isHot: index < 3 || room.likesCount >= 20
    }));

  return enriched;
}

/**
 * GET /api/departments/public
 * Danh sách tất cả các phòng hiện có, sắp xếp phòng được ưa thích (Top Like) lên đầu,
 * hỗ trợ tìm kiếm và lọc theo loại phòng: Thư giãn (RELAX) hoặc Tập trung (FOCUS)
 */
router.get('/public', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const type = typeof req.query.type === 'string'
      ? req.query.type
      : typeof req.query.theme === 'string'
      ? req.query.theme
      : 'ALL';
    const search = typeof req.query.search === 'string'
      ? req.query.search
      : typeof req.query.q === 'string'
      ? req.query.q
      : '';

    const rooms = await getEnrichedRoomsList(req.user!.id, type, search);
    res.json({
      types: [
        { id: 'ALL', label: 'Tất cả phòng', icon: '🌐' },
        { id: 'RELAX', label: '☕ Thư giãn', icon: '☕', description: ROOM_TYPES.RELAX.description },
        { id: 'FOCUS', label: '⏱️ Tập trung', icon: '⏱️', description: ROOM_TYPES.FOCUS.description }
      ],
      rooms
    });
  } catch (error: any) {
    console.error('Get public rooms failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách phòng hiện có.' });
  }
});

/**
 * POST /api/departments
 * Tạo phòng mới cho chính mình: chọn phòng Thư giãn (RELAX) hoặc Tập trung (FOCUS)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const roomType = normalizeRoomType(req.body.roomType || req.body.themeId);
    const typeInfo = getRoomTypeInfo(roomType);

    const defaultName = roomType === 'RELAX'
      ? `Góc Thư Giãn của ${user.fullName}`
      : `Phòng Tập Trung của ${user.fullName}`;

    const finalName = rawName || defaultName;

    if (!finalName || finalName.length > 80) {
      return res.status(400).json({ error: 'Tên phòng cần có từ 1 đến 80 ký tự.' });
    }

    const domain = user.email.split('@')[1]?.toLowerCase() || 'officepet.local';

    const defaultBg = await prisma.gardenBackground.findFirst({
      where: { isActive: true },
      orderBy: { isRecommended: 'desc' }
    });

    const department = await prisma.$transaction(async (tx) => {
      const organization = user.orgId
        ? await tx.organization.findUnique({ where: { id: user.orgId } })
        : await tx.organization.upsert({
            where: { domain },
            update: {},
            create: { name: `Cộng đồng ${domain}`, domain }
          });

      if (!organization) throw new Error('Không tìm thấy tổ chức của tài khoản.');

      const created = await tx.department.create({
        data: {
          name: finalName,
          inviteCode: makeInviteCode(),
          orgId: organization.id,
          themeId: roomType,
          workHours: roomType === 'RELAX' ? '24/7 Tự do' : '08:00 - 18:00',
          backgroundId: defaultBg?.id || null,
          gardenLevel: 1,
          gardenExp: 50
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { orgId: organization.id, deptId: created.id }
      });

      return created;
    });

    // Record initial creator like for the newly created room (+1 like)
    const now = Date.now();
    try {
      if (isSqlServer()) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (@P1, @P2, @P3, @P4)`,
          randomUUID(),
          department.id,
          user.id,
          BigInt(now)
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
          randomUUID(),
          department.id,
          user.id,
          now
        );
      }
    } catch {}

    res.status(201).json({
      department: {
        ...department,
        roomType,
        typeLabel: typeInfo.label,
        typeIcon: typeInfo.icon
      }
    });
  } catch (error) {
    console.error('Department creation failed:', error);
    res.status(500).json({ error: 'Không thể tạo phòng lúc này.' });
  }
});

/**
 * POST /api/departments/join
 * Tham gia vào một phòng bằng deptId trực tiếp (từ danh sách phòng) hoặc bằng inviteCode
 */
router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const inviteCode = typeof req.body.inviteCode === 'string'
      ? req.body.inviteCode.trim().toUpperCase()
      : '';
    const deptId = typeof req.body.deptId === 'string' ? req.body.deptId.trim() : '';

    if (!inviteCode && !deptId) {
      return res.status(400).json({ error: 'Vui lòng chọn phòng hoặc nhập mã mời phòng.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    const department = deptId
      ? await prisma.department.findUnique({ where: { id: deptId } })
      : await prisma.department.findUnique({ where: { inviteCode } });

    if (!department) {
      return res.status(404).json({ error: 'Mã mời không hợp lệ hoặc phòng không tồn tại.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: department.orgId, deptId: department.id }
    });

    const typeInfo = getRoomTypeInfo(department.themeId);

    res.json({
      department: {
        id: department.id,
        name: department.name,
        inviteCode: department.inviteCode,
        roomType: typeInfo.type,
        typeLabel: typeInfo.label,
        typeIcon: typeInfo.icon
      }
    });
  } catch (error) {
    console.error('Department join failed:', error);
    res.status(500).json({ error: 'Không thể tham gia phòng lúc này.' });
  }
});

/**
 * POST /api/departments/like
 * Thích / Bỏ thích phòng: Tăng số lượt yêu thích của phòng, đẩy thứ hạng phòng lên cao.
 * Chấp nhận { deptId?: string }, nếu không truyền sẽ lấy phòng hiện tại của user.
 */
router.post('/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    const targetDeptId = typeof req.body.deptId === 'string' && req.body.deptId.trim()
      ? req.body.deptId.trim()
      : user.deptId;

    if (!targetDeptId) {
      return res.status(400).json({ error: 'Vui lòng chọn phòng để thích.' });
    }

    const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
    if (!dept) return res.status(404).json({ error: 'Phòng không tồn tại.' });

    // Check if user already liked
    let hasLiked = false;
    if (isSqlServer()) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 1 as liked FROM room_likes WHERE dept_id = @P1 AND user_id = @P2`,
        targetDeptId,
        user.id
      );
      hasLiked = Boolean(rows && rows.length > 0);
    } else {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 1 as liked FROM room_likes WHERE dept_id = ? AND user_id = ?`,
        targetDeptId,
        user.id
      );
      hasLiked = Boolean(rows && rows.length > 0);
    }

    if (hasLiked) {
      // Toggle unlike
      if (isSqlServer()) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM room_likes WHERE dept_id = @P1 AND user_id = @P2`,
          targetDeptId,
          user.id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `DELETE FROM room_likes WHERE dept_id = ? AND user_id = ?`,
          targetDeptId,
          user.id
        );
      }
    } else {
      // Add like
      const now = Date.now();
      if (isSqlServer()) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (@P1, @P2, @P3, @P4)`,
          randomUUID(),
          targetDeptId,
          user.id,
          BigInt(now)
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
          randomUUID(),
          targetDeptId,
          user.id,
          now
        );
      }
      await prisma.department.update({
        where: { id: targetDeptId },
        data: { gardenExp: { increment: 25 } }
      });
    }

    let countRows: any[];
    if (isSqlServer()) {
      countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = @P1`,
        targetDeptId
      );
    } else {
      countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
        targetDeptId
      );
    }
    const newLikesCount = Number(countRows?.[0]?.total || 0);

    try {
      const { io } = await import('../server');
      io.emit('room_liked', {
        deptId: targetDeptId,
        likesCount: newLikesCount,
        hasLiked: !hasLiked,
        userId: user.id,
        userName: user.fullName
      });
    } catch {}

    res.json({
      message: !hasLiked
        ? `❤️ Cảm ơn bạn đã thích phòng "${dept.name}"! Phòng được cộng 25 EXP và xếp lên Top ưa thích.`
        : `Đã bỏ thích phòng "${dept.name}".`,
      deptId: targetDeptId,
      likesCount: newLikesCount,
      hasLiked: !hasLiked
    });
  } catch (error) {
    console.error('Like room failed:', error);
    res.status(500).json({ error: 'Không thể thích phòng lúc này.' });
  }
});

/**
 * POST /api/departments/join-hot
 * Vào phòng đang hot nhất theo chủ đề
 */
router.post('/join-hot', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const rawType = req.body.roomType || req.body.theme || req.body.topic || 'ALL';
    const resolvedType = normalizeRoomType(rawType);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    let matchingRooms = await getEnrichedRoomsList(user.id, resolvedType);
    if (matchingRooms.length === 0) {
      matchingRooms = await getEnrichedRoomsList(user.id, 'ALL');
    }
    if (matchingRooms.length === 0) {
      return res.status(404).json({ error: 'Hiện chưa có phòng nào đang hoạt động.' });
    }

    const hottestRoom = matchingRooms[0];
    const deptRecord = await prisma.department.findUnique({ where: { id: hottestRoom.id } });
    if (!deptRecord) {
      return res.status(404).json({ error: 'Không tìm thấy phòng phù hợp.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: deptRecord.orgId, deptId: deptRecord.id }
    });

    res.json({
      message: `Đã vào phòng "${hottestRoom.name}" (${hottestRoom.typeLabel}) được yêu thích nhất với ${hottestRoom.likesCount} lượt Like!`,
      department: hottestRoom
    });
  } catch (error) {
    console.error('Join hot room failed:', error);
    res.status(500).json({ error: 'Không thể tìm và vào phòng đang hot lúc này.' });
  }
});

/**
 * POST /api/departments/leave
 * Rời phòng hiện tại
 */
router.post('/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (!user.deptId) return res.status(409).json({ error: 'Bạn chưa tham gia phòng nào.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { deptId: null }
    });

    res.json({ message: 'Bạn đã rời phòng chung. Thú cưng và cấp độ vẫn được giữ nguyên.' });
  } catch (error) {
    console.error('Department leave failed:', error);
    res.status(500).json({ error: 'Không thể rời phòng lúc này.' });
  }
});

/**
 * GET /api/departments/members
 * Lấy danh sách thành viên trong phòng hiện tại
 */
router.get('/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng nào.' });
    }

    const members = await prisma.user.findMany({
      where: { deptId: user.deptId, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        userPet: {
          select: {
            name: true,
            level: true,
            currentState: true,
            petType: {
              select: {
                name: true,
                previewUrl: true
              }
            }
          }
        }
      }
    });

    res.json({
      deptId: user.deptId,
      totalMembers: members.length,
      members
    });
  } catch (error: any) {
    console.error('Get department members failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách thành viên.' });
  }
});

/**
 * GET /api/departments/messages
 * Lấy tin nhắn phòng gần nhất
 */
router.get('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng nào.' });
    }

    const messages = await prisma.message.findMany({
      where: { deptId: user.deptId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const senderIds = Array.from(new Set(messages.map(m => m.senderId).filter(Boolean))) as string[];
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, fullName: true, avatarUrl: true, userPet: { select: { name: true } } }
    });
    const senderMap = new Map(senders.map(s => [s.id, s]));

    const enriched = messages.reverse().map(m => ({
      ...m,
      senderName: m.title || (m.senderId ? senderMap.get(m.senderId)?.fullName : 'Thành viên'),
      senderAvatar: m.senderId ? senderMap.get(m.senderId)?.avatarUrl : undefined,
      petName: m.senderId ? senderMap.get(m.senderId)?.userPet?.name : undefined
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Get department messages failed:', error);
    res.status(500).json({ error: 'Không thể tải tin nhắn phòng.' });
  }
});

/**
 * POST /api/departments/messages
 * Gửi tin nhắn vào phòng
 */
router.post('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { userPet: true }
    });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng nào.' });
    }

    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content || content.length > 500) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được quá 500 ký tự.' });
    }

    const message = await prisma.message.create({
      data: {
        deptId: user.deptId,
        senderId: user.id,
        title: user.fullName,
        content,
        messageType: 'ROOM_CHAT',
        urgency: 'NORMAL'
      }
    });

    const payload = {
      ...message,
      senderName: user.fullName,
      petName: user.userPet?.name || 'Thú cưng'
    };

    const { io } = await import('../server');
    io.to(`garden_${user.deptId}`).emit('room_chat_message', payload);

    res.status(201).json(payload);
  } catch (error: any) {
    console.error('Post department message failed:', error);
    res.status(500).json({ error: 'Không thể gửi tin nhắn vào phòng.' });
  }
});

export default router;
