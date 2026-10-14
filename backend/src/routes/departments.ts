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

export default router;
