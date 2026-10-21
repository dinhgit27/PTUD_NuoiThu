import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireAuth, requireUser, AuthRequest } from '../middleware/auth';
import { formatItem, formatPetType, safeJsonParse } from '../utils/jsonHelper';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireUser);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [pet, user, items, inventory, balance, backgrounds, petTypes, ownedPetTypes] = await Promise.all([
      prisma.userPet.findUnique({ where: { userId }, select: { id: true } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          deptId: true,
          department: { select: { backgroundId: true } }
        }
      }),
      prisma.item.findMany({
        where: { isAvailable: true },
        orderBy: [{ expPrice: 'asc' }, { name: 'asc' }]
      }),
      prisma.userItem.findMany({
        where: { userId },
        include: { item: true },
        orderBy: { acquiredAt: 'desc' }
      }),
      prisma.eXPRecord.aggregate({
        where: { userId },
        _sum: { amount: true }
      }),
      prisma.gardenBackground.findMany({
        where: { isActive: true },
        orderBy: [{ isRecommended: 'desc' }, { expPrice: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.petType.findMany({
        where: { isActive: true, isShopEnabled: true },
        orderBy: [{ expPrice: 'asc' }, { name: 'asc' }]
      }),
      prisma.purchasedPetType.findMany({
        where: { userId },
        select: { petTypeId: true }
      })
    ]);

    const ownedBackgrounds = user?.deptId
      ? await prisma.departmentBackground.findMany({
          where: { departmentId: user.deptId },
          select: { backgroundId: true }
        })
      : [];
    const ownedBackgroundIds = new Set(ownedBackgrounds.map(background => background.backgroundId));
    if (user?.department?.backgroundId) ownedBackgroundIds.add(user.department.backgroundId);

    res.json({
      items: items.map(formatItem),
      inventory: inventory.map(inv => ({ ...inv, item: formatItem(inv.item) })),
      backgrounds,
      petTypes: petTypes.map(formatPetType),
      ownedPetTypeIds: ownedPetTypes.map(owned => owned.petTypeId),
      departmentId: user?.deptId || null,
      activeBackgroundId: user?.department?.backgroundId || null,
      ownedBackgroundIds: [...ownedBackgroundIds],
      expBalance: balance._sum.amount || 0,
      petId: pet?.id || null
    });
  } catch (error) {
    console.error('Could not load the item shop:', error);
    res.status(500).json({ error: 'Không thể tải cửa hàng lúc này.' });
  }
});

router.post('/buy-pet', async (req: AuthRequest, res: Response) => {
  const petTypeId = typeof req.body.petTypeId === 'string' ? req.body.petTypeId : '';
  if (!petTypeId) return res.status(400).json({ error: 'Vui lòng chọn thú cưng cần mua.' });

  try {
    const result = await prisma.$transaction(async tx => {
      const petType = await tx.petType.findFirst({
        where: { id: petTypeId, isActive: true, isShopEnabled: true }
      });
      if (!petType) return { status: 404, body: { error: 'Thú cưng này hiện không được mở bán.' } };

      const existing = await tx.purchasedPetType.findUnique({
        where: { userId_petTypeId: { userId: req.user!.id, petTypeId } }
      });
      if (existing) return { status: 200, body: { message: 'Bạn đã sở hữu thú cưng này.' } };

      const balance = await tx.eXPRecord.aggregate({
        where: { userId: req.user!.id },
        _sum: { amount: true }
      });
      const currentBalance = balance._sum.amount || 0;
      if (petType.expPrice < 0) return { status: 400, body: { error: 'Giá thú cưng không hợp lệ.' } };
      if (currentBalance < petType.expPrice) {
        return { status: 400, body: { error: 'Bạn chưa có đủ EXP để mua thú cưng.' } };
      }

      await tx.purchasedPetType.create({ data: { userId: req.user!.id, petTypeId } });
      if (petType.expPrice > 0) {
        const [pet, user] = await Promise.all([
          tx.userPet.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
          tx.user.findUnique({ where: { id: req.user!.id }, select: { deptId: true } })
        ]);
        await tx.eXPRecord.create({
          data: {
            userId: req.user!.id,
            petId: pet?.id,
            deptId: user?.deptId,
            amount: -petType.expPrice,
            source: 'SHOP_PURCHASE',
            description: `Mua thú cưng: ${petType.name}`
          }
        });
      }
      return {
        status: 201,
        body: {
          message: `Đã mua ${petType.name}. Bạn có thể chọn thú cưng này trong danh sách.`,
          expBalance: currentBalance - petType.expPrice
        }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Số dư hoặc quyền sở hữu vừa thay đổi. Vui lòng tải lại cửa hàng.' });
    }
    console.error('Could not purchase pet type:', error);
    res.status(500).json({ error: 'Không thể hoàn tất giao dịch mua thú cưng.' });
  }
});

router.post('/buy-background', async (req: AuthRequest, res: Response) => {
  const backgroundId = typeof req.body.backgroundId === 'string' ? req.body.backgroundId : '';
  if (!backgroundId) return res.status(400).json({ error: 'Vui lòng chọn bối cảnh cần mua.' });

  try {
    const result = await prisma.$transaction(async tx => {
      const [user, background] = await Promise.all([
        tx.user.findUnique({
          where: { id: req.user!.id },
          select: { deptId: true }
        }),
        tx.gardenBackground.findFirst({
          where: { id: backgroundId, isActive: true }
        })
      ]);

      if (!user?.deptId) {
        return { status: 400, body: { error: 'Hãy tạo hoặc tham gia phòng chung trước khi mua bối cảnh.' } };
      }
      if (!background) {
        return { status: 404, body: { error: 'Bối cảnh không còn được mở bán.' } };
      }
      if (background.expPrice < 0) {
        return { status: 400, body: { error: 'Giá bối cảnh không hợp lệ.' } };
      }

      const existing = await tx.departmentBackground.findUnique({
        where: {
          departmentId_backgroundId: {
            departmentId: user.deptId,
            backgroundId: background.id
          }
        }
      });
      if (existing) {
        await tx.department.update({
          where: { id: user.deptId },
          data: { backgroundId: background.id }
        });
        return {
          status: 200,
          body: { message: `Đã áp dụng lại bối cảnh "${background.name}".` }
        };
      }

      const balance = await tx.eXPRecord.aggregate({
        where: { userId: req.user!.id },
        _sum: { amount: true }
      });
      const currentBalance = balance._sum.amount || 0;
      if (currentBalance < background.expPrice) {
        return { status: 400, body: { error: 'Bạn chưa có đủ EXP để mua bối cảnh.' } };
      }

      await tx.departmentBackground.create({
        data: { departmentId: user.deptId, backgroundId: background.id }
      });
      await tx.department.update({
        where: { id: user.deptId },
        data: { backgroundId: background.id }
      });

      if (background.expPrice > 0) {
        const pet = await tx.userPet.findUnique({
          where: { userId: req.user!.id },
          select: { id: true }
        });
        await tx.eXPRecord.create({
          data: {
            userId: req.user!.id,
            petId: pet?.id,
            deptId: user.deptId,
            amount: -background.expPrice,
            source: 'SHOP_PURCHASE',
            description: `Mua bối cảnh phòng chung: ${background.name}`
          }
        });
      }

      return {
        status: 201,
        body: {
          message: `Đã mua và áp dụng bối cảnh "${background.name}" cho phòng chung.`,
          expBalance: currentBalance - background.expPrice
        }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Số dư hoặc quyền sở hữu vừa thay đổi. Vui lòng tải lại cửa hàng.' });
    }
    console.error('Could not purchase department background:', error);
    res.status(500).json({ error: 'Không thể hoàn tất giao dịch mua bối cảnh.' });
  }
});

router.post('/buy', async (req: AuthRequest, res: Response) => {
  const itemId = typeof req.body.itemId === 'string' ? req.body.itemId : '';
  if (!itemId) return res.status(400).json({ error: 'Vui lòng chọn vật phẩm cần mua.' });

  try {
    const result = await prisma.$transaction(async tx => {
      const [item, pet, user] = await Promise.all([
        tx.item.findFirst({ where: { id: itemId, isAvailable: true } }),
        tx.userPet.findUnique({ where: { userId: req.user!.id } }),
        tx.user.findUnique({ where: { id: req.user!.id }, select: { deptId: true } })
      ]);

      if (!item) return { status: 404, body: { error: 'Vật phẩm không còn được bán.' } };
      if (!pet) return { status: 400, body: { error: 'Bạn cần nhận nuôi thú cưng trước khi mua vật phẩm.' } };
      if (item.expPrice < 0) return { status: 400, body: { error: 'Giá vật phẩm không hợp lệ.' } };

      const balance = await tx.eXPRecord.aggregate({
        where: { userId: req.user!.id },
        _sum: { amount: true }
      });
      const currentBalance = balance._sum.amount || 0;
      if (currentBalance < item.expPrice) {
        return { status: 400, body: { error: 'Bạn chưa có đủ EXP để mua vật phẩm.' } };
      }

      const existingItem = await tx.userItem.findFirst({
        where: {
          userId: req.user!.id,
          itemId: item.id,
          ...(item.itemType === 'SKIN' ? {} : { petId: pet.id })
        }
      });
      if (item.itemType === 'SKIN' && existingItem) {
        return { status: 200, body: { message: `Bạn đã sở hữu skin "${item.name}".` } };
      }
      if (existingItem) {
        await tx.userItem.update({
          where: { id: existingItem.id },
          data: { quantity: { increment: 1 } }
        });
      } else {
        await tx.userItem.create({
          data: { userId: req.user!.id, itemId: item.id, petId: pet.id, quantity: 1 }
        });
      }

      if (item.expPrice > 0) {
        await tx.eXPRecord.create({
          data: {
            userId: req.user!.id,
            petId: pet.id,
            deptId: user?.deptId,
            amount: -item.expPrice,
            source: 'SHOP_PURCHASE',
            description: `Mua vật phẩm: ${item.name}`
          }
        });
      }

      return {
        status: 201,
        body: { message: `Đã mua ${item.name}.`, expBalance: currentBalance - item.expPrice }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Số dư vừa thay đổi. Vui lòng tải lại cửa hàng rồi thử lại.' });
    }
    console.error('Could not purchase shop item:', error);
    res.status(500).json({ error: 'Không thể hoàn tất giao dịch mua vật phẩm.' });
  }
});

router.post('/use', async (req: AuthRequest, res: Response) => {
  const userItemId = typeof req.body.userItemId === 'string' ? req.body.userItemId : '';
  if (!userItemId) return res.status(400).json({ error: 'Vui lòng chọn vật phẩm cần sử dụng.' });

  try {
    const result = await prisma.$transaction(async tx => {
      const [inventoryItem, pet] = await Promise.all([
        tx.userItem.findFirst({
          where: { id: userItemId, userId: req.user!.id },
          include: { item: true }
        }),
        tx.userPet.findUnique({ where: { userId: req.user!.id } })
      ]);

      if (!inventoryItem || inventoryItem.quantity < 1) {
        return { status: 404, body: { error: 'Không tìm thấy vật phẩm trong túi đồ.' } };
      }
      if (inventoryItem.item.itemType !== 'FOOD') {
        return { status: 400, body: { error: 'Vật phẩm này không thể sử dụng như thức ăn.' } };
      }
      if (!pet) return { status: 404, body: { error: 'Không tìm thấy thú cưng.' } };

      const updatedPet = await tx.userPet.update({
        where: { id: pet.id },
        data: {
          hunger: Math.min(100, pet.hunger + 40),
          health: Math.min(100, pet.health + 10),
          currentState: 'EATING'
        },
        include: {
          petType: true,
          userItems: { where: { isEquipped: true }, include: { item: true } }
        }
      });

      if (inventoryItem.quantity === 1) {
        await tx.userItem.delete({ where: { id: inventoryItem.id } });
      } else {
        await tx.userItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: { decrement: 1 } }
        });
      }

      return { status: 200, body: { message: 'Đã dùng thức ăn cho thú cưng.', pet: updatedPet } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Could not use shop item:', error);
    res.status(500).json({ error: 'Không thể sử dụng vật phẩm lúc này.' });
  }
});

router.post('/equip', async (req: AuthRequest, res: Response) => {
  const userItemId = typeof req.body.userItemId === 'string' ? req.body.userItemId : '';
  const equipped = req.body.equipped;
  if (!userItemId || typeof equipped !== 'boolean') {
    return res.status(400).json({ error: 'Thông tin trang bị không hợp lệ.' });
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const [inventoryItem, pet] = await Promise.all([
        tx.userItem.findFirst({
          where: { id: userItemId, userId: req.user!.id },
          include: { item: true }
        }),
        tx.userPet.findUnique({ where: { userId: req.user!.id } })
      ]);

      if (!inventoryItem || inventoryItem.quantity < 1) {
        return { status: 404, body: { error: 'Không tìm thấy vật phẩm trong túi đồ.' } };
      }
      if (inventoryItem.item.itemType === 'FOOD') {
        return { status: 400, body: { error: 'Thức ăn không thể trang bị.' } };
      }
      if (!pet) return { status: 404, body: { error: 'Không tìm thấy thú cưng.' } };

      if (equipped) {
        const item = inventoryItem.item;
        const compatiblePetIds = safeJsonParse(item.compatiblePetIds, null);
        const targetPetTypeId = item.petTypeId;

        if (targetPetTypeId && targetPetTypeId !== pet.typeId) {
          const targetPetType = await tx.petType.findUnique({ where: { id: targetPetTypeId } });
          const petName = targetPetType?.name || 'loài thú khác';
          return { status: 400, body: { error: `Vật phẩm này chỉ dành riêng cho ${petName}. Bé cưng hiện tại không thể mặc.` } };
        }

        if (Array.isArray(compatiblePetIds) && compatiblePetIds.length > 0 && !compatiblePetIds.includes(pet.typeId)) {
          const compatiblePets = await tx.petType.findMany({
            where: { id: { in: compatiblePetIds } },
            select: { name: true }
          });
          const petNames = compatiblePets.map(p => p.name).join(', ') || 'loài thú khác';
          return { status: 400, body: { error: `Vật phẩm này chỉ có thể mặc cho: ${petNames}. Bé cưng hiện tại không thể mặc.` } };
        }

        const equippedItems = await tx.userItem.findMany({
          where: {
            userId: req.user!.id,
            petId: pet.id,
            isEquipped: true,
            item: { itemType: inventoryItem.item.itemType }
          }
        });
        for (const item of equippedItems) {
          if (item.id !== inventoryItem.id) {
            await tx.userItem.update({ where: { id: item.id }, data: { isEquipped: false } });
          }
        }
      }

      await tx.userItem.update({
        where: { id: inventoryItem.id },
        data: { isEquipped: equipped, petId: pet.id }
      });
      return { status: 200, body: { message: equipped ? 'Đã trang bị vật phẩm.' : 'Đã tháo vật phẩm.' } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Could not equip shop item:', error);
    res.status(500).json({ error: 'Không thể cập nhật trang bị lúc này.' });
  }
});

export default router;
