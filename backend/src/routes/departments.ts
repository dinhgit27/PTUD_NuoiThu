import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function makeInviteCode() {
  return randomBytes(8).toString('hex').toUpperCase();
}

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'Tên phòng ban cần có từ 1 đến 80 ký tự.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (user.deptId) {
      return res.status(409).json({ error: 'Bạn đang ở trong một phòng ban. Hãy rời phòng ban đó trước khi tạo phòng mới.' });
    }

    const domain = user.email.split('@')[1]?.toLowerCase();
    if (!domain) return res.status(400).json({ error: 'Tài khoản cần có email hợp lệ để tạo phòng ban.' });

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
          name,
          inviteCode: makeInviteCode(),
          orgId: organization.id
        }
      });
      await transaction.user.update({
        where: { id: user.id },
        data: { orgId: organization.id, deptId: created.id }
      });
      return created;
    });

    res.status(201).json({ department });
  } catch (error) {
    console.error('Department creation failed:', error);
    res.status(500).json({ error: 'Không thể tạo phòng ban lúc này.' });
  }
});

router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const inviteCode = typeof req.body.inviteCode === 'string'
      ? req.body.inviteCode.trim().toUpperCase()
      : '';
    if (!inviteCode) return res.status(400).json({ error: 'Vui lòng nhập mã mời phòng ban.' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (user.deptId) {
      return res.status(409).json({ error: 'Bạn đang ở trong một phòng ban. Hãy rời phòng ban đó trước khi tham gia phòng khác.' });
    }

    const department = await prisma.department.findUnique({ where: { inviteCode } });
    if (!department) return res.status(404).json({ error: 'Mã mời không hợp lệ hoặc phòng ban không tồn tại.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: department.orgId, deptId: department.id }
    });
    res.json({ department: { id: department.id, name: department.name, inviteCode: department.inviteCode } });
  } catch (error) {
    console.error('Department join failed:', error);
    res.status(500).json({ error: 'Không thể tham gia phòng ban lúc này.' });
  }
});

router.post('/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (!user.deptId) return res.status(409).json({ error: 'Bạn chưa tham gia phòng ban nào.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { deptId: null }
    });
    res.json({ message: 'Bạn đã rời phòng ban. Tài khoản và thú cưng vẫn được giữ nguyên.' });
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
