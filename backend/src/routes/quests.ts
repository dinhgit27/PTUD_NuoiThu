import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { QuestService } from '../services/questService';

const router = Router();

/**
 * GET /api/quests
 * Lấy danh sách nhiệm vụ và tiến độ của người dùng hiện tại
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const quests = await QuestService.getQuestsForUser(userId);
    res.json(quests);
  } catch (error: any) {
    console.error('Get quests error:', error);
    res.status(500).json({ error: 'Không thể tải danh sách nhiệm vụ.', details: error.message });
  }
});

/**
 * POST /api/quests/:id/claim
 * Nhận phần thưởng cho nhiệm vụ đã hoàn thành
 */
router.post('/:id/claim', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const questId = req.params.id;
    const result = await QuestService.claimReward(userId, questId);

    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.status(result.status || 200).json(result.data);
  } catch (error: any) {
    console.error('Claim quest error:', error);
    res.status(500).json({ error: 'Không thể nhận thưởng nhiệm vụ.', details: error.message });
  }
});

/**
 * POST /api/quests/action
 * Ghi nhận tiến độ nhiệm vụ cho một hành động (VD: DRINK, MUSIC)
 */
router.post('/action', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { actionType, count = 1 } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'Thiếu loại hành động.' });
    }

    await QuestService.recordActionProgress(userId, String(actionType).toUpperCase(), Number(count) || 1);
    res.json({ message: 'Đã cập nhật tiến độ nhiệm vụ.' });
  } catch (error: any) {
    console.error('Record quest action error:', error);
    res.status(500).json({ error: 'Không thể cập nhật tiến độ nhiệm vụ.', details: error.message });
  }
});

export default router;
