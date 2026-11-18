import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { io } from '../server';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/friends
 * Danh sách bạn bè của người dùng hiện tại
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Lấy danh sách quan hệ bạn bè 2 chiều
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId },
          { friendId: userId }
        ]
      }
    });

    const friendIds = friendships.map(f => (f.userId === userId ? f.friendId : f.userId));

    if (friendIds.length === 0) {
      return res.json([]);
    }

    const friends = await prisma.user.findMany({
      where: {
        id: { in: friendIds },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        department: {
          select: { id: true, name: true }
        },
        userPet: {
          select: {
            id: true,
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

    res.json(friends);
  } catch (error: any) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Không thể tải danh sách bạn bè.', details: error.message });
  }
});

/**
 * GET /api/friends/search?q=...
 * Tìm kiếm người dùng để kết bạn
 */
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!query) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        OR: [
          { email: { contains: query } },
          { fullName: { contains: query } }
        ]
      },
      take: 10,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        department: { select: { id: true, name: true } },
        userPet: {
          select: {
            name: true,
            level: true,
            petType: { select: { name: true, previewUrl: true } }
          }
        }
      }
    });

    // Kiểm tra trạng thái bạn bè hiện tại
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId },
          { friendId: userId }
        ]
      }
    });

    const friendMap = new Map<string, string>();
    for (const f of friendships) {
      const otherId = f.userId === userId ? f.friendId : f.userId;
      friendMap.set(otherId, f.status);
    }

    const results = users.map(u => ({
      ...u,
      friendshipStatus: friendMap.get(u.id) || 'NONE'
    }));

    res.json(results);
  } catch (error: any) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Lỗi tìm kiếm bạn bè.', details: error.message });
  }
});

/**
 * POST /api/friends/request
 * Gửi yêu cầu kết bạn / Kết bạn
 */
router.post('/request', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = typeof req.body.friendId === 'string' ? req.body.friendId.trim() : '';

    if (!friendId || friendId === userId) {
      return res.status(400).json({ error: 'Mã người bạn không hợp lệ.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: friendId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
    }

    // Kiểm tra đã có quan hệ chưa
    const existing = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    });

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Hai bạn đã là bạn bè hoặc đã gửi lời mời.' });
    }

    await prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: 'ACCEPTED'
      }
    });

    // Lấy tên người gửi
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const senderName = currentUser?.fullName || 'Bạn bè';

    // Gửi thông báo realtime qua Socket.IO
    io.to(`user_${friendId}`).emit('friend_update', {
      fromUserId: userId,
      fromUserName: senderName
    });

    res.json({ message: `Đã kết bạn thành công với ${targetUser.fullName}! 🐾` });
  } catch (error: any) {
    console.error('Add friend error:', error);
    res.status(500).json({ error: 'Không thể gửi lời mời kết bạn.', details: error.message });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Hủy kết bạn
 */
router.delete('/:friendId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    });

    res.json({ message: 'Đã hủy kết bạn thành công.' });
  } catch (error: any) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Không thể hủy kết bạn.', details: error.message });
  }
});

/**
 * GET /api/friends/:friendId/messages
 * Lấy lịch sử tin nhắn 1-1 giữa 2 người bạn
 */
router.get('/:friendId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    // Đánh dấu đã đọc
    await prisma.directMessage.updateMany({
      where: {
        senderId: friendId,
        receiverId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json(messages);
  } catch (error: any) {
    console.error('Get DM error:', error);
    res.status(500).json({ error: 'Không thể tải tin nhắn.', details: error.message });
  }
});

/**
 * POST /api/friends/:friendId/messages
 * Gửi tin nhắn 1-1 cho bạn bè
 */
router.post('/:friendId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (!content || content.length > 1000) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống và dưới 1000 ký tự.' });
    }

    const savedMessage = await prisma.directMessage.create({
      data: {
        senderId: userId,
        receiverId: friendId,
        content,
        isRead: false
      }
    });

    // Lấy tên người gửi
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const senderName = currentUser?.fullName || 'Bạn bè';

    // Gửi realtime qua Socket.IO tới phòng của người nhận và người gửi
    io.to(`user_${friendId}`).emit('direct_message', {
      ...savedMessage,
      senderName
    });
    io.to(`user_${userId}`).emit('direct_message', {
      ...savedMessage,
      senderName
    });

    res.status(201).json(savedMessage);
  } catch (error: any) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Không thể gửi tin nhắn.', details: error.message });
  }
});

export default router;
