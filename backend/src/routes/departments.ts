import { Router, Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

export const LIKE_REQUIRED_SECONDS = 5 * 60; // 5 minutes (300 seconds)
export const LIKE_REQUIRED_MS = LIKE_REQUIRED_SECONDS * 1000;

export type RoomTopicId = 'WORK' | 'STUDY' | 'CHILL' | 'CREATIVE' | 'SOCIAL';

export interface RoomCategoryInfo {
  id: RoomTopicId;
  label: string;
  icon: string;
  description: string;
  keywords: string[];
}

export const ROOM_CATEGORIES: RoomCategoryInfo[] = [
  {
    id: 'WORK',
    label: 'Làm việc',
    icon: '💼',
    description: 'Tập trung làm việc, chạy deadline, coding & năng suất công sở',
    keywords: [
      'làm việc',
      'công việc',
      'code',
      'coding',
      'lập trình',
      'văn phòng',
      'deadline',
      'work',
      'kỹ thuật',
      'công nghệ',
      'phần mềm',
      'deep focus'
    ]
  },
  {
    id: 'STUDY',
    label: 'Học tập',
    icon: '📚',
    description: 'Tự học, đọc sách, ôn thi & nghiên cứu tài liệu yên tĩnh',
    keywords: ['học tập', 'học bài', 'ôn thi', 'đọc sách', 'nghiên cứu', 'study', 'tự học', 'thư viện']
  },
  {
    id: 'CHILL',
    label: 'Thư giãn',
    icon: '☕',
    description: 'Nghe nhạc Lofi, nghỉ ngơi xả stress & thưởng trà chiều',
    keywords: ['thư giãn', 'chill', 'nghỉ ngơi', 'xả stress', 'lofi', 'nhạc', 'cà phê', 'trà chiều', 'giải lao']
  },
  {
    id: 'CREATIVE',
    label: 'Sáng tạo',
    icon: '🎨',
    description: 'Thiết kế, lên ý tưởng, nghệ thuật Pixel & sáng tạo nội dung',
    keywords: ['sáng tạo', 'thiết kế', 'design', 'ý tưởng', 'nghệ thuật', 'art', 'vẽ', 'content', 'marketing']
  },
  {
    id: 'SOCIAL',
    label: 'Giao lưu',
    icon: '💬',
    description: 'Trò chuyện vui vẻ, kết bạn đồng nghiệp & khoe thú cưng',
    keywords: ['giao lưu', 'tán gẫu', 'trò chuyện', 'kết bạn', 'nói chuyện', 'tâm sự', 'social', 'hội quán']
  }
];

export function getRoomCategoryInfo(themeId?: string | null): RoomCategoryInfo {
  const upper = (themeId || 'WORK').toUpperCase();
  return ROOM_CATEGORIES.find(c => c.id === upper) || ROOM_CATEGORIES[0];
}

export function resolveRoomTopicFromText(input?: string | null): RoomTopicId | 'ALL' {
  if (!input) return 'WORK';
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'ALL') return 'ALL';
  const direct = ROOM_CATEGORIES.find(c => c.id === upper);
  if (direct) return direct.id;

  const lower = trimmed.toLowerCase();
  for (const cat of ROOM_CATEGORIES) {
    if (lower.includes(cat.label.toLowerCase()) || cat.keywords.some(k => lower.includes(k))) {
      return cat.id;
    }
  }
  return 'WORK';
}

function makeInviteCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

let tablesInitialized = false;

export async function ensureRoomTablesAndSeed() {
  if (tablesInitialized) return;
  try {
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
      themeId: RoomTopicId;
      gardenLevel: number;
      gardenExp: number;
      workHours: string;
      bgKeyword: string;
      seedLikes: number;
    }> = [
      {
        inviteCode: 'WORK01',
        name: 'Không Gian Làm Việc Deep Focus',
        themeId: 'WORK',
        gardenLevel: 4,
        gardenExp: 1850,
        workHours: '08:00 - 22:00',
        bgKeyword: 'Cây Xanh',
        seedLikes: 32
      },
      {
        inviteCode: 'TECH01',
        name: 'Phòng Kỹ Thuật & Phần Mềm',
        themeId: 'WORK',
        gardenLevel: 3,
        gardenExp: 1250,
        workHours: '08:30 - 17:30',
        bgKeyword: 'Mùa Xuân',
        seedLikes: 19
      },
      {
        inviteCode: 'STUDY01',
        name: 'Thư Viện Tự Học & Ôn Thi Pomodoro',
        themeId: 'STUDY',
        gardenLevel: 3,
        gardenExp: 1420,
        workHours: '07:00 - 23:00',
        bgKeyword: 'Cafe',
        seedLikes: 26
      },
      {
        inviteCode: 'CHILL01',
        name: 'Trạm Dừng Lofi & Trà Chiều Thư Giãn',
        themeId: 'CHILL',
        gardenLevel: 3,
        gardenExp: 1180,
        workHours: '24/7 Tự do',
        bgKeyword: 'Hoàng Hôn',
        seedLikes: 24
      },
      {
        inviteCode: 'ART01',
        name: 'Xưởng Sáng Tạo & Thiết Kế Pixel',
        themeId: 'CREATIVE',
        gardenLevel: 2,
        gardenExp: 920,
        workHours: '09:00 - 18:30',
        bgKeyword: 'Mùa Xuân',
        seedLikes: 16
      },
      {
        inviteCode: 'SOCIAL01',
        name: 'Hội Quán Giao Lưu & Khoe Thú Cưng',
        themeId: 'SOCIAL',
        gardenLevel: 2,
        gardenExp: 840,
        workHours: '24/7 Kết nối',
        bgKeyword: 'Cafe',
        seedLikes: 15
      },
      {
        inviteCode: 'WORK02',
        name: 'Biệt Đội Chạy Deadline & Coding Đêm',
        themeId: 'WORK',
        gardenLevel: 2,
        gardenExp: 760,
        workHours: '19:00 - 02:00',
        bgKeyword: 'Cafe',
        seedLikes: 11
      }
    ];

    for (const r of defaultRooms) {
      const bgId = bgByName(r.bgKeyword);
      const dept = await prisma.department.upsert({
        where: { inviteCode: r.inviteCode },
        update: {
          themeId: r.themeId,
          ...(bgId ? { backgroundId: bgId } : {})
        },
        create: {
          orgId: org.id,
          name: r.name,
          inviteCode: r.inviteCode,
          themeId: r.themeId,
          gardenLevel: r.gardenLevel,
          gardenExp: r.gardenExp,
          workHours: r.workHours,
          backgroundId: bgId
        }
      });

      const countRows = await prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
        `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
        dept.id
      );
      const currentLikes = Number(countRows?.[0]?.total || 0);
      if (currentLikes === 0 && r.seedLikes > 0) {
        const now = Date.now();
        for (let i = 1; i <= r.seedLikes; i++) {
          const likeId = `seed_${r.inviteCode}_${i}`;
          const botUserId = `seed_bot_${i}`;
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

    tablesInitialized = true;
  } catch (err) {
    console.error('Error initializing room tables:', err);
  }
}

export async function recordUserJoinRoom(userId: string, deptId: string) {
  await ensureRoomTablesAndSeed();
  const now = Date.now();
  await prisma.$executeRawUnsafe(
    `INSERT INTO room_member_sessions (user_id, dept_id, joined_at, has_liked)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(user_id, dept_id) DO UPDATE SET joined_at = ?, has_liked = 0`,
    userId,
    deptId,
    now,
    now
  );
}

export async function ensureUserRoomSession(userId: string, deptId: string): Promise<{
  joinedAt: number;
  hasLiked: boolean;
  likesCount: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  canLike: boolean;
}> {
  await ensureRoomTablesAndSeed();
  const now = Date.now();

  const existing = await prisma.$queryRawUnsafe<Array<{ joined_at: number | bigint; has_liked: number | bigint }>>(
    `SELECT joined_at, has_liked FROM room_member_sessions WHERE user_id = ? AND dept_id = ?`,
    userId,
    deptId
  );

  let joinedAt = now;
  let sessionLiked = false;

  if (!existing || existing.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO room_member_sessions (user_id, dept_id, joined_at, has_liked) VALUES (?, ?, ?, 0)`,
      userId,
      deptId,
      now
    );
  } else {
    joinedAt = Number(existing[0].joined_at);
    sessionLiked = Number(existing[0].has_liked) === 1;
  }

  const likeCountRows = await prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
    deptId
  );
  const likesCount = Number(likeCountRows?.[0]?.total || 0);

  const hasLiked = sessionLiked;
  const elapsedSeconds = Math.max(0, Math.floor((now - joinedAt) / 1000));
  const remainingSeconds = Math.max(0, LIKE_REQUIRED_SECONDS - elapsedSeconds);
  const canLike = !hasLiked && remainingSeconds === 0;

  return {
    joinedAt,
    hasLiked,
    likesCount,
    elapsedSeconds,
    remainingSeconds,
    canLike
  };
}

export async function getEnrichedRoomsList(currentUserId?: string, themeFilter?: string) {
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
    const userSessions = await prisma.$queryRawUnsafe<Array<{ dept_id: string; has_liked: number | bigint }>>(
      `SELECT dept_id, has_liked FROM room_member_sessions WHERE user_id = ? AND has_liked = 1`,
      currentUserId
    );
    for (const s of userSessions) {
      userLikedSet.add(s.dept_id);
    }
  }

  const normalizedFilter = themeFilter && themeFilter !== 'ALL' ? resolveRoomTopicFromText(themeFilter) : 'ALL';

  const enriched = departments
    .map(dept => {
      const cat = getRoomCategoryInfo(dept.themeId);
      const likesCount = likesMap.get(dept.id) || 0;
      const memberCount = dept._count?.users || 0;
      return {
        id: dept.id,
        name: dept.name,
        inviteCode: dept.inviteCode,
        themeId: cat.id,
        themeLabel: cat.label,
        themeIcon: cat.icon,
        workHours: dept.workHours || '24/7 Tự do',
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
    .filter(room => normalizedFilter === 'ALL' || room.themeId === normalizedFilter)
    .sort((a, b) => {
      if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return b.gardenExp - a.gardenExp;
    })
    .map((room, index) => ({
      ...room,
      rank: index + 1,
      isHot: index < 3 || room.likesCount >= 15
    }));

  return enriched;
}

/**
 * GET /api/departments/public
 * Danh sách tất cả các phòng hiện có, sắp xếp phòng Top nhiều Like lên đầu, hỗ trợ lọc theo loại phòng (chủ đề)
 */
router.get('/public', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const theme = typeof req.query.theme === 'string' ? req.query.theme : 'ALL';
    const rooms = await getEnrichedRoomsList(req.user!.id, theme);
    res.json({
      categories: ROOM_CATEGORIES,
      rooms
    });
  } catch (error: any) {
    console.error('Get public rooms failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách phòng hiện có.' });
  }
});

/**
 * POST /api/departments
 * Tạo phòng mới cho chính mình (có chọn loại/chủ đề phòng)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const isPersonal = Boolean(req.body.isPersonal);
    const themeInfo = getRoomCategoryInfo(req.body.themeId);
    const finalName = rawName || (isPersonal ? `Phòng ${themeInfo.label} của ${user.fullName}` : '');

    if (!finalName || finalName.length > 80) {
      return res.status(400).json({ error: 'Tên phòng cần có từ 1 đến 80 ký tự.' });
    }

    const domain = user.email.split('@')[1]?.toLowerCase() || 'officepet.local';

    const defaultBg = await prisma.gardenBackground.findFirst({
      where: { isActive: true },
      orderBy: { isRecommended: 'desc' }
    });

    const department = await prisma.$transaction(async (transaction) => {
      const organization = user.orgId
        ? await transaction.organization.findUnique({ where: { id: user.orgId } })
        : await transaction.organization.upsert({
            where: { domain },
            update: {},
            create: { name: `Cộng đồng ${domain}`, domain }
          });

      if (!organization) throw new Error('Không tìm thấy tổ chức của tài khoản.');

      const created = await transaction.department.create({
        data: {
          name: finalName,
          inviteCode: makeInviteCode(),
          orgId: organization.id,
          themeId: themeInfo.id,
          workHours: '24/7 Tự do',
          backgroundId: defaultBg?.id || null
        }
      });

      await transaction.user.update({
        where: { id: user.id },
        data: { orgId: organization.id, deptId: created.id }
      });

      return created;
    });

    await recordUserJoinRoom(user.id, department.id);

    res.status(201).json({
      department: {
        ...department,
        themeId: themeInfo.id,
        themeLabel: themeInfo.label,
        themeIcon: themeInfo.icon
      }
    });
  } catch (error) {
    console.error('Department creation failed:', error);
    res.status(500).json({ error: 'Không thể tạo phòng lúc này.' });
  }
});

/**
 * POST /api/departments/join
 * Tham gia vào một phòng (bằng inviteCode hoặc deptId trực tiếp từ danh sách phòng)
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

    await recordUserJoinRoom(user.id, department.id);
    const cat = getRoomCategoryInfo(department.themeId);

    res.json({
      department: {
        id: department.id,
        name: department.name,
        inviteCode: department.inviteCode,
        themeId: cat.id,
        themeLabel: cat.label,
        themeIcon: cat.icon
      }
    });
  } catch (error) {
    console.error('Department join failed:', error);
    res.status(500).json({ error: 'Không thể tham gia phòng lúc này.' });
  }
});

/**
 * POST /api/departments/join-hot
 * Tìm và vào ngay phòng đang HOT nhất (nhiều Like nhất) theo chủ đề người dùng yêu cầu (dùng cho trợ lý Any & nút Vào nhanh)
 */
router.post('/join-hot', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const rawTopic = req.body.theme || req.body.topic || req.body.query || 'WORK';
    const resolvedTopic = resolveRoomTopicFromText(rawTopic);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    let matchingRooms = await getEnrichedRoomsList(user.id, resolvedTopic);
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

    const wasAlreadyInSameRoom = user.deptId === deptRecord.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: deptRecord.orgId, deptId: deptRecord.id }
    });

    if (!wasAlreadyInSameRoom) {
      await recordUserJoinRoom(user.id, deptRecord.id);
    } else {
      await ensureUserRoomSession(user.id, deptRecord.id);
    }

    res.json({
      message: `Đã vào phòng "${hottestRoom.name}" (Chủ đề ${hottestRoom.themeLabel}) đang HOT nhất với ${hottestRoom.likesCount} lượt Like!`,
      department: hottestRoom
    });
  } catch (error) {
    console.error('Join hot room failed:', error);
    res.status(500).json({ error: 'Không thể tìm và vào phòng đang hot lúc này.' });
  }
});

/**
 * POST /api/departments/like
 * Like phòng hiện tại: Mỗi người mỗi lần vào phòng được 1 Like, yêu cầu phải ở trong phòng hơn 5 phút (>= 300 giây)
 */
router.post('/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.deptId) {
      return res.status(400).json({ error: 'Bạn cần vào một phòng trước khi bấm Like phòng.' });
    }

    const sessionState = await ensureUserRoomSession(user.id, user.deptId);

    if (sessionState.hasLiked) {
      return res.status(409).json({
        error: 'Mỗi người mỗi lần chỉ được tặng 1 Like cho phòng! Bạn đã Like phòng này rồi.',
        likesCount: sessionState.likesCount,
        hasLiked: true
      });
    }

    if (sessionState.remainingSeconds > 0) {
      const mins = Math.floor(sessionState.remainingSeconds / 60);
      const secs = sessionState.remainingSeconds % 60;
      return res.status(400).json({
        error: `Bạn cần ở trong phòng hơn 5 phút mới được Like! Thời gian còn lại: ${mins} phút ${secs} giây.`,
        remainingSeconds: sessionState.remainingSeconds,
        elapsedSeconds: sessionState.elapsedSeconds,
        likesCount: sessionState.likesCount,
        hasLiked: false
      });
    }

    const now = Date.now();
    await prisma.$executeRawUnsafe(
      `INSERT INTO room_likes (id, dept_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
      randomUUID(),
      user.deptId,
      user.id,
      now
    );

    await prisma.$executeRawUnsafe(
      `UPDATE room_member_sessions SET has_liked = 1 WHERE user_id = ? AND dept_id = ?`,
      user.id,
      user.deptId
    );

    await prisma.department.update({
      where: { id: user.deptId },
      data: { gardenExp: { increment: 25 } }
    });

    const likeCountRows = await prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) as total FROM room_likes WHERE dept_id = ?`,
      user.deptId
    );
    const newLikesCount = Number(likeCountRows?.[0]?.total || sessionState.likesCount + 1);

    try {
      const { io } = await import('../server');
      io.to(`garden_${user.deptId}`).emit('room_liked', {
        deptId: user.deptId,
        likesCount: newLikesCount,
        userId: user.id,
        userName: user.fullName
      });
    } catch {
      // Ignore socket broadcast error if server not ready
    }

    res.json({
      message: '🎉 Cảm ơn bạn đã tặng 1 Like cho phòng! Phòng được +25 EXP và đẩy lên Top thịnh hành!',
      likesCount: newLikesCount,
      hasLiked: true
    });
  } catch (error) {
    console.error('Like room failed:', error);
    res.status(500).json({ error: 'Không thể Like phòng lúc này.' });
  }
});

router.post('/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureRoomTablesAndSeed();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (!user.deptId) return res.status(409).json({ error: 'Bạn chưa tham gia phòng ban nào.' });

    const oldDeptId = user.deptId;
    await prisma.user.update({
      where: { id: user.id },
      data: { deptId: null }
    });

    await prisma.$executeRawUnsafe(
      `DELETE FROM room_member_sessions WHERE user_id = ? AND dept_id = ?`,
      user.id,
      oldDeptId
    );

    res.json({ message: 'Bạn đã rời phòng chung. Tài khoản và thú cưng vẫn được giữ nguyên.' });
  } catch (error) {
    console.error('Department leave failed:', error);
    res.status(500).json({ error: 'Không thể rời phòng ban lúc này.' });
  }
});

/**
 * GET /api/departments/members
 * Lấy danh sách thành viên trong phòng ban của người dùng hiện tại
 */
router.get('/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng ban nào.' });
    }

    const members = await prisma.user.findMany({
      where: { deptId: user.deptId, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
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
 * Lấy tin nhắn phòng chung gần nhất
 */
router.get('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng ban nào.' });
    }

    const messages = await prisma.message.findMany({
      where: { deptId: user.deptId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const senderIds = Array.from(new Set(messages.map(m => m.senderId).filter(Boolean))) as string[];
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, fullName: true, userPet: { select: { name: true } } }
    });
    const senderMap = new Map(senders.map(s => [s.id, s]));

    const enriched = messages.reverse().map(m => ({
      ...m,
      senderName: m.title || (m.senderId ? senderMap.get(m.senderId)?.fullName : 'Thành viên'),
      petName: m.senderId ? senderMap.get(m.senderId)?.userPet?.name : undefined
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Get department messages failed:', error);
    res.status(500).json({ error: 'Không thể tải tin nhắn phòng chung.' });
  }
});

/**
 * POST /api/departments/messages
 * Gửi tin nhắn vào phòng chung
 */
router.post('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { userPet: true }
    });
    if (!user || !user.deptId) {
      return res.status(404).json({ error: 'Bạn chưa tham gia phòng ban nào.' });
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
    res.status(500).json({ error: 'Không thể gửi tin nhắn vào phòng chung.' });
  }
});

export default router;
