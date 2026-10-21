import { PrismaClient } from '@prisma/client';
import { io } from '../server';
import { formatItem, formatUserPet } from '../utils/jsonHelper';

const prisma = new PrismaClient();

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getExpForNextLevel(level: number) {
  return level * 200;
}

export class QuestService {
  /**
   * Get all active quests with user's progress and claim status
   */
  static async getQuestsForUser(userId: string) {
    const now = new Date();
    const [quests, userQuests] = await Promise.all([
      prisma.quest.findMany({
        where: { isActive: true },
        include: { rewardItem: true },
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
      }),
      prisma.userQuest.findMany({
        where: { userId }
      })
    ]);

    const userQuestMap = new Map<string, any>(userQuests.map((uq: any) => [uq.questId, uq]));

    // Format and handle daily reset if needed
    const result = await Promise.all(
      quests.map(async (quest: any) => {
        let uq = userQuestMap.get(quest.id);

        if (uq && quest.category === 'DAILY') {
          const lastUpdated = new Date(uq.updatedAt);
          if (!isSameDay(lastUpdated, now)) {
            // Reset daily quest for the new day
            uq = await prisma.userQuest.update({
              where: { id: uq.id },
              data: {
                progress: 0,
                isCompleted: false,
                isClaimed: false,
                claimedAt: null
              }
            });
          }
        }

        const progress = uq?.progress ?? 0;
        const isCompleted = uq ? (uq.isCompleted || progress >= quest.targetCount) : false;
        const isClaimed = uq?.isClaimed ?? false;

        return {
          id: quest.id,
          title: quest.title,
          description: quest.description,
          category: quest.category,
          actionType: quest.actionType,
          targetCount: quest.targetCount,
          rewardExp: quest.rewardExp,
          rewardItemId: quest.rewardItemId,
          rewardItem: quest.rewardItem ? formatItem(quest.rewardItem) : null,
          progress,
          isCompleted,
          isClaimed,
          claimedAt: uq?.claimedAt ?? null
        };
      })
    );

    return result;
  }

  /**
   * Record progress for an action type performed by a user
   */
  static async recordActionProgress(userId: string, actionType: string, count: number = 1) {
    try {
      const now = new Date();
      const activeQuests = await prisma.quest.findMany({
        where: { actionType, isActive: true }
      });

      if (activeQuests.length === 0) return;

      for (const quest of activeQuests) {
        let uq = await prisma.userQuest.findUnique({
          where: { userId_questId: { userId, questId: quest.id } }
        });

        if (uq && quest.category === 'DAILY') {
          const lastUpdated = new Date(uq.updatedAt);
          if (!isSameDay(lastUpdated, now)) {
            uq = await prisma.userQuest.update({
              where: { id: uq.id },
              data: {
                progress: 0,
                isCompleted: false,
                isClaimed: false,
                claimedAt: null
              }
            });
          }
        }

        // If already claimed, don't update progress
        if (uq?.isClaimed) continue;

        const currentProgress = uq?.progress ?? 0;
        const newProgress = Math.min(quest.targetCount, currentProgress + count);
        const isCompleted = newProgress >= quest.targetCount;

        const updatedUq = await prisma.userQuest.upsert({
          where: { userId_questId: { userId, questId: quest.id } },
          update: {
            progress: newProgress,
            isCompleted
          },
          create: {
            userId,
            questId: quest.id,
            progress: newProgress,
            isCompleted,
            isClaimed: false
          }
        });

        // Notify client if newly completed
        if (isCompleted && (!uq || !uq.isCompleted)) {
          io.to(`user_${userId}`).emit('quest_completed', {
            questId: quest.id,
            title: quest.title,
            rewardExp: quest.rewardExp
          });
        }
      }
    } catch (error) {
      console.error('Error tracking quest progress:', error);
    }
  }

  /**
   * Claim reward for a completed quest
   */
  static async claimReward(userId: string, questId: string) {
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
      include: { rewardItem: true }
    });

    if (!quest) {
      return { error: 'Nhiệm vụ không tồn tại.', status: 404 };
    }

    const uq = await prisma.userQuest.findUnique({
      where: { userId_questId: { userId, questId } }
    });

    if (!uq || (!uq.isCompleted && uq.progress < quest.targetCount)) {
      return { error: 'Bạn chưa hoàn thành nhiệm vụ này.', status: 400 };
    }

    if (uq.isClaimed) {
      return { error: 'Bạn đã nhận thưởng nhiệm vụ này rồi.', status: 400 };
    }

    const pet = await prisma.userPet.findUnique({
      where: { userId },
      include: {
        user: true,
        userItems: { where: { isEquipped: true }, include: { item: true } },
        petType: true
      }
    });

    if (!pet) {
      return { error: 'Bạn cần nhận nuôi thú cưng để nhận thưởng.', status: 400 };
    }

    const expGain = quest.rewardExp;
    const newExp = pet.exp + expGain;
    const nextLevelExp = getExpForNextLevel(pet.level);
    let newLevel = pet.level;
    let finalExp = newExp;
    let didLevelUp = false;

    if (newExp >= nextLevelExp) {
      newLevel += 1;
      finalExp = newExp - nextLevelExp;
      didLevelUp = true;
    }

    // Perform updates in transaction
    const [updatedPet, updatedUq] = await prisma.$transaction([
      // Update pet exp and level
      prisma.userPet.update({
        where: { id: pet.id },
        data: {
          exp: finalExp,
          level: newLevel,
          currentState: didLevelUp ? 'EVOLVING' : 'CELEBRATING'
        },
        include: {
          petType: true,
          userItems: { where: { isEquipped: true }, include: { item: true } }
        }
      }),
      // Mark quest as claimed
      prisma.userQuest.update({
        where: { id: uq.id },
        data: {
          isCompleted: true,
          isClaimed: true,
          claimedAt: new Date()
        }
      }),
      // Create EXP Record
      prisma.eXPRecord.create({
        data: {
          userId,
          petId: pet.id,
          deptId: pet.user.deptId,
          amount: expGain,
          source: 'QUEST',
          description: `Phần thưởng nhiệm vụ: ${quest.title}`
        }
      })
    ]);

    // Department Garden Exp
    if (pet.user.deptId) {
      await prisma.department.update({
        where: { id: pet.user.deptId },
        data: { gardenExp: { increment: expGain } }
      });
    }

    // Award Item if configured
    let rewardedItem: any = null;
    if (quest.rewardItemId && quest.rewardItem) {
      const existingUserItem = await prisma.userItem.findFirst({
        where: {
          userId,
          itemId: quest.rewardItemId,
          ...(quest.rewardItem.itemType === 'SKIN' ? {} : { petId: pet.id })
        }
      });

      if (existingUserItem) {
        await prisma.userItem.update({
          where: { id: existingUserItem.id },
          data: { quantity: { increment: 1 } }
        });
      } else {
        await prisma.userItem.create({
          data: {
            userId,
            itemId: quest.rewardItemId,
            petId: quest.rewardItem.itemType === 'SKIN' ? null : pet.id,
            quantity: 1,
            isEquipped: false
          }
        });
      }
      rewardedItem = formatItem(quest.rewardItem);
    }

    return {
      status: 200,
      data: {
        message: didLevelUp
          ? `Nhận thưởng thành công! Bé cưng đã lên cấp ${newLevel}! 🎉`
          : 'Nhận thưởng nhiệm vụ thành công! ✨',
        expGained: expGain,
        didLevelUp,
        rewardItem: rewardedItem,
        pet: formatUserPet(updatedPet),
        quest: {
          id: quest.id,
          title: quest.title,
          isCompleted: true,
          isClaimed: true,
          claimedAt: updatedUq.claimedAt
        }
      }
    };
  }
}
