import { Router, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { SpriteForgeService } from '../services/spriteForgeService';

const router = Router();
const prisma = new PrismaClient();
const shopItemTypes = ['FOOD', 'SKIN', 'HAT', 'ACCESSORY', 'BADGE', 'THEME'];
const itemRarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const itemEquipSlots = ['AUTO', 'HEAD', 'BODY', 'HAND', 'FEET', 'AURA'];
const itemEffects = ['NONE', 'BOUNCE', 'FLOAT', 'SPARKLE', 'GLOW', 'HEARTS'];

const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh PNG, JPG, JPEG, WEBP!'));
    }
  }
});

function auditAdminId(req: AuthRequest): string | undefined {
  return req.user?.role === 'ADMIN' ? req.user.id : undefined;
}

/**
 * Agent Sprite Forge - Prompt to generate a new 2D Pixel Art animal sprite sheet
 */
router.post('/sprite/generate', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, name, description, naturalAspectRatio } = req.body;

    if (!prompt || !name) {
      return res.status(400).json({ error: 'Vui lòng cung cấp prompt và tên loài thú cưng.' });
    }

    const result = await SpriteForgeService.generatePetSprite({
      prompt,
      name,
      description,
      naturalAspectRatio: Number(naturalAspectRatio) || 1.0
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'GENERATE_SPRITE_ASSET',
        targetEntity: 'PetType',
        targetId: result.petType.id,
        newValue: { prompt, name }
      }
    });

    res.status(201).json({
      message: 'Đã tạo thành công Sprite Sheet 2D Pixel Art cho tất cả 17 trạng thái hoạt ảnh!',
      ...result
    });
  } catch (error: any) {
    console.error('Sprite generation failed:', error);
    res.status(500).json({ error: 'Lỗi Agent Sprite Forge khi tạo nhân vật.', details: error.message });
  }
});

/**
 * Agent Sprite Forge - Upload image and generate 2D Pixel Art pet with 17 animation states
 */
router.post('/sprite/generate-from-image', requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng tải lên file hình ảnh (PNG, JPG, WEBP).' });
    }

    const name = typeof req.body.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : 'Pet_' + Date.now().toString().slice(-4);
    const description = typeof req.body.description === 'string' && req.body.description.trim()
      ? req.body.description.trim()
      : `Thú cưng Pixel Art sinh từ hình ảnh ${req.file.originalname}`;
    const naturalAspectRatio = Number(req.body.naturalAspectRatio) || 1.0;

    const result = await SpriteForgeService.generatePetFromImage({
      imagePath: req.file.path,
      name,
      description,
      naturalAspectRatio
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'GENERATE_SPRITE_FROM_IMAGE',
        targetEntity: 'PetType',
        targetId: result.petType.id,
        newValue: { name, originalFilename: req.file.originalname }
      }
    });

    res.status(201).json({
      message: 'Đã sinh thành công thú cưng 2D Pixel Art 17 trạng thái từ ảnh tải lên!',
      ...result
    });
  } catch (error: any) {
    console.error('Sprite image generation failed:', error);
    res.status(500).json({ error: 'Lỗi khi sinh hoạt ảnh pixel từ hình ảnh tải lên.', details: error.message });
  }
});

/**
 * Configure Frame Slices (rows/columns, frame counts, animation speed/FPS) for the 17 states
 */
router.patch('/sprite/:id/config', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { frameConfig, animations } = req.body;

    const updated = await SpriteForgeService.updateFrameConfig(id, frameConfig || {}, animations || {});

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_SPRITE_FRAME_CONFIG',
        targetEntity: 'PetType',
        targetId: id,
        newValue: { frameConfig, animations }
      }
    });

    res.json({
      message: 'Cập nhật cấu hình phân cắt khung hình (Frame Slices) và FPS thành công!',
      petType: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cập nhật cấu hình frame slice.', details: error.message });
  }
});

/**
 * Publish / Unpublish PetType to users
 */
router.patch('/sprite/:id/publish', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updated = await SpriteForgeService.setPublished(id, Boolean(isActive));

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: isActive ? 'PUBLISH_PET_TYPE' : 'UNPUBLISH_PET_TYPE',
        targetEntity: 'PetType',
        targetId: id
      }
    });

    res.json({
      message: isActive ? 'Đã xuất bản thú cưng cho toàn bộ người dùng!' : 'Đã ẩn thú cưng khỏi danh mục người dùng.',
      petType: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi xuất bản thú cưng.', details: error.message });
  }
});

/**
 * List all PetTypes including unpublished ones (Admin view)
 */
router.get('/sprites', requireAdmin, async (_req, res: Response) => {
  try {
    const types = await SpriteForgeService.listPetTypes(true);
    res.json(types);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh sách sprites.', details: error.message });
  }
});

/**
 * Manage Shared Garden Backgrounds: List
 */
router.get('/backgrounds', requireAdmin, async (_req, res: Response) => {
  try {
    const backgrounds = await prisma.gardenBackground.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(backgrounds);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh sách hình nền.', details: error.message });
  }
});

/**
 * Manage Shared Garden Backgrounds: Add new Pixel Art Background
 */
router.post('/backgrounds', requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  let backgroundCreated = false;
  try {
    const { name, description, isRecommended } = req.body;
    const expPrice = req.body.expPrice === undefined ? 0 : Number(req.body.expPrice);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;

    if (typeof name !== 'string' || !name.trim() || typeof imageUrl !== 'string' || !imageUrl.trim() ||
        !Number.isInteger(expPrice) || expPrice < 0) {
      if (req.file) await fs.promises.unlink(req.file.path);
      return res.status(400).json({ error: 'Vui lòng cung cấp tên, ảnh và giá EXP hợp lệ cho bối cảnh.' });
    }

    const bg = await prisma.gardenBackground.create({
      data: {
        name: name.trim(),
        imageUrl: imageUrl.trim(),
        description,
        expPrice,
        isRecommended: isRecommended === true || isRecommended === 'true',
        isActive: true
      }
    });
    backgroundCreated = true;

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'ADD_GARDEN_BACKGROUND',
        targetEntity: 'GardenBackground',
        targetId: bg.id,
        newValue: { name: name.trim(), imageUrl: imageUrl.trim() }
      }
    });

    res.status(201).json({ message: 'Thêm bối cảnh Pixel Art Khu vườn chung thành công!', background: bg });
  } catch (error: any) {
    if (req.file && !backgroundCreated) {
      await fs.promises.unlink(req.file.path).catch(unlinkError => {
        console.error('Failed to remove an unreferenced background upload:', unlinkError);
      });
    }
    res.status(500).json({ error: 'Lỗi tạo hình nền.', details: error.message });
  }
});

router.patch('/backgrounds/:id/shop', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { expPrice, isActive } = req.body;
  if (!Number.isInteger(expPrice) || expPrice < 0 || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Giá nền phải là số nguyên không âm và trạng thái bán phải hợp lệ.' });
  }
  try {
    const background = await prisma.gardenBackground.update({
      where: { id: req.params.id },
      data: { expPrice, isActive }
    });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_GARDEN_BACKGROUND_SHOP',
        targetEntity: 'GardenBackground',
        targetId: background.id,
        newValue: { expPrice, isActive }
      }
    });
    res.json({ message: 'Đã cập nhật giá và trạng thái bán bối cảnh.', background });
  } catch (error) {
    console.error('Could not update garden background shop listing:', error);
    res.status(500).json({ error: 'Không thể cập nhật giá và trạng thái bán bối cảnh.' });
  }
});

/**
 * Manage Shared Garden Backgrounds: Delete Background
 */
router.delete('/backgrounds/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.gardenBackground.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'DELETE_GARDEN_BACKGROUND',
        targetEntity: 'GardenBackground',
        targetId: id
      }
    });

    res.json({ message: 'Xóa hình nền thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi xóa hình nền.', details: error.message });
  }
});

/**
 * Manage Shared Garden Backgrounds: Set Recommended
 */
router.patch('/backgrounds/:id/recommend', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isRecommended } = req.body;

    const bg = await prisma.gardenBackground.update({
      where: { id },
      data: { isRecommended: Boolean(isRecommended) }
    });

    res.json({ message: 'Cập nhật đề xuất hình nền thành công!', background: bg });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cập nhật đề xuất hình nền.', details: error.message });
  }
});

router.get('/shop/items', requireAdmin, async (_req, res: Response) => {
  try {
    const items = await prisma.item.findMany({ orderBy: [{ createdAt: 'desc' }] });
    res.json(items);
  } catch (error) {
    console.error('Could not load admin shop items:', error);
    res.status(500).json({ error: 'Không thể tải vật phẩm cửa hàng.' });
  }
});

router.post('/shop/items', requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  let itemCreated = false;
  try {
    const { name, description, itemType, rarity } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;
    const price = Number(req.body.expPrice);
    const equipSlot = typeof req.body.equipSlot === 'string' ? req.body.equipSlot : 'AUTO';
    const effect = typeof req.body.effect === 'string' ? req.body.effect : 'NONE';
    if (typeof name !== 'string' || !name.trim() ||
        typeof imageUrl !== 'string' || !imageUrl.trim() ||
        !shopItemTypes.includes(itemType) || !itemRarities.includes(rarity) ||
        !Number.isInteger(price) || price < 0 ||
        !itemEquipSlots.includes(equipSlot) || !itemEffects.includes(effect)) {
      if (req.file) await fs.promises.unlink(req.file.path);
      return res.status(400).json({ error: 'Thông tin vật phẩm không hợp lệ. Kiểm tra tên, ảnh, loại, độ hiếm và giá EXP.' });
    }

    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : null,
        itemType,
        rarity,
        expPrice: price,
        equipSlot,
        effect,
        imageUrl: imageUrl.trim(),
        isAvailable: true
      }
    });
    itemCreated = true;
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'CREATE_SHOP_ITEM',
        targetEntity: 'Item',
        targetId: item.id,
        newValue: { name: item.name, itemType: item.itemType, expPrice: item.expPrice }
      }
    });
    res.status(201).json({ message: 'Đã tạo vật phẩm và mở bán trong cửa hàng.', item });
  } catch (error) {
    if (req.file && !itemCreated) {
      await fs.promises.unlink(req.file.path).catch(unlinkError => {
        console.error('Failed to remove an unreferenced item upload:', unlinkError);
      });
    }
    console.error('Could not create shop item:', error);
    res.status(500).json({ error: 'Không thể tạo vật phẩm cửa hàng.' });
  }
});

router.patch('/shop/items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, itemType, rarity, expPrice, isAvailable, equipSlot, effect } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Tên vật phẩm không hợp lệ.' });
      data.name = name.trim();
    }
    if (description !== undefined) data.description = typeof description === 'string' ? description.trim() : null;
    if (itemType !== undefined) {
      if (!shopItemTypes.includes(itemType)) return res.status(400).json({ error: 'Loại vật phẩm không hợp lệ.' });
      data.itemType = itemType;
    }
    if (rarity !== undefined) {
      if (!itemRarities.includes(rarity)) return res.status(400).json({ error: 'Độ hiếm không hợp lệ.' });
      data.rarity = rarity;
    }
    if (expPrice !== undefined) {
      if (!Number.isInteger(expPrice) || expPrice < 0) return res.status(400).json({ error: 'Giá EXP phải là số nguyên không âm.' });
      data.expPrice = expPrice;
    }
    if (isAvailable !== undefined) {
      if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'Trạng thái mở bán không hợp lệ.' });
      data.isAvailable = isAvailable;
    }
    if (equipSlot !== undefined) {
      if (!itemEquipSlots.includes(equipSlot)) return res.status(400).json({ error: 'Vị trí trang bị không hợp lệ.' });
      data.equipSlot = equipSlot;
    }
    if (effect !== undefined) {
      if (!itemEffects.includes(effect)) return res.status(400).json({ error: 'Hiệu ứng phụ kiện không hợp lệ.' });
      data.effect = effect;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Không có thông tin cần cập nhật.' });
    const item = await prisma.item.update({ where: { id: req.params.id }, data });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_SHOP_ITEM',
        targetEntity: 'Item',
        targetId: item.id,
        newValue: data as object
      }
    });
    res.json({ message: 'Đã cập nhật vật phẩm cửa hàng.', item });
  } catch (error) {
    console.error('Could not update shop item:', error);
    res.status(500).json({ error: 'Không thể cập nhật vật phẩm cửa hàng.' });
  }
});

router.get('/shop/pets', requireAdmin, async (_req, res: Response) => {
  try {
    res.json(await prisma.petType.findMany({ orderBy: [{ createdAt: 'desc' }] }));
  } catch (error) {
    console.error('Could not load pet market:', error);
    res.status(500).json({ error: 'Không thể tải danh sách thú cưng.' });
  }
});

router.patch('/shop/pets/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { isShopEnabled, expPrice } = req.body;
  if (typeof isShopEnabled !== 'boolean' || !Number.isInteger(expPrice) || expPrice < 0) {
    return res.status(400).json({ error: 'Trạng thái bán và giá thú cưng không hợp lệ.' });
  }
  try {
    const petType = await prisma.petType.update({
      where: { id: req.params.id },
      data: {
        isShopEnabled,
        expPrice,
        ...(isShopEnabled ? { isPurchaseRequired: true } : {})
      }
    });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: isShopEnabled ? 'ENABLE_PET_SHOP_LISTING' : 'DISABLE_PET_SHOP_LISTING',
        targetEntity: 'PetType',
        targetId: petType.id,
        newValue: { isShopEnabled, expPrice }
      }
    });
    res.json({ message: isShopEnabled ? 'Đã đưa thú cưng vào cửa hàng.' : 'Đã gỡ thú cưng khỏi cửa hàng.', petType });
  } catch (error) {
    console.error('Could not update pet shop listing:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái bán thú cưng.' });
  }
});

/**
 * System Monitoring & Infrastructure Stats (US-A07)
 */
router.get('/stats', requireAdmin, async (_req, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const activePets = await prisma.userPet.count();
    const totalDepartments = await prisma.department.count();
    const totalWorkSessions = await prisma.workSession.count();
    const totalPetTypes = await prisma.petType.count();
    const totalBackgrounds = await prisma.gardenBackground.count();

    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    const cpuLoad = os.loadavg();

    res.json({
      counts: {
        totalUsers,
        activePets,
        totalDepartments,
        totalWorkSessions,
        totalPetTypes,
        totalBackgrounds
      },
      system: {
        platform: os.platform(),
        uptimeSeconds: os.uptime(),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model,
        cpuLoad1Min: cpuLoad[0],
        memoryTotalMB: Math.round(memTotal / (1024 * 1024)),
        memoryUsedMB: Math.round(memUsed / (1024 * 1024)),
        memoryUsagePercent: Math.round((memUsed / memTotal) * 100)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải thông số hệ thống.', details: error.message });
  }
});

/**
 * User Accounts Management (US-A03)
 */
router.get('/users', requireAdmin, async (_req, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        organization: { select: { id: true, name: true, domain: true } },
        department: { select: { id: true, name: true } },
        userPet: { include: { petType: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh sách người dùng.', details: error.message });
  }
});

/**
 * Toggle User Lock Status (US-A03)
 */
router.patch('/users/:id/status', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái tài khoản không hợp lệ.' });
  }
  if (id === req.user!.id && status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của mình.' });
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, status: true }
      });
      if (!target) return { status: 404, body: { error: 'Không tìm thấy tài khoản.' } };
      if (target.role === 'ADMIN' && target.status === 'ACTIVE' && status !== 'ACTIVE') {
        const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdmins <= 1) {
          return { status: 400, body: { error: 'Không thể khóa hoặc vô hiệu hóa Admin đang hoạt động cuối cùng.' } };
        }
      }
      const user = await tx.user.update({
        where: { id },
        data: { status },
        select: { id: true, email: true, fullName: true, role: true, status: true }
      });
      await tx.auditLog.create({
        data: {
          adminId: auditAdminId(req),
          action: 'UPDATE_USER_STATUS',
          targetEntity: 'User',
          targetId: id,
          newValue: { status }
        }
      });
      return { status: 200, body: { message: `Cập nhật trạng thái người dùng thành ${status}!`, user } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Trạng thái tài khoản vừa thay đổi. Tải lại danh sách rồi thử lại.' });
    }
    console.error('Could not update user status:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái tài khoản.' });
  }
});

router.patch('/users/:id/role', requireAdmin, async (req: AuthRequest, res: Response) => {
  const role = req.body.role;
  if (role !== 'ADMIN' && role !== 'USER') {
    return res.status(400).json({ error: 'Quyền tài khoản chỉ có thể là Admin hoặc User.' });
  }
  if (req.params.id === req.user!.id && role !== 'ADMIN') {
    return res.status(400).json({ error: 'Bạn không thể tự gỡ quyền Admin của mình.' });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, status: true }
      });
      if (!target) return { status: 404, body: { error: 'Không tìm thấy tài khoản.' } };
      if (target.role === 'ADMIN' && target.status === 'ACTIVE' && role === 'USER') {
        const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdmins <= 1) {
          return { status: 400, body: { error: 'Không thể hạ quyền Admin đang hoạt động cuối cùng.' } };
        }
      }
      const user = await tx.user.update({
        where: { id: target.id },
        data: { role },
        select: { id: true, email: true, fullName: true, role: true, status: true }
      });
      await tx.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'UPDATE_USER_ROLE',
          targetEntity: 'User',
          targetId: target.id,
          oldValue: { role: target.role },
          newValue: { role }
        }
      });
      return { status: 200, body: { message: 'Đã cập nhật quyền tài khoản.', user } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Quyền tài khoản vừa thay đổi. Tải lại danh sách rồi thử lại.' });
    }
    console.error('Could not update user role:', error);
    res.status(500).json({ error: 'Không thể cập nhật quyền tài khoản.' });
  }
});

/**
 * System Audit Logs (US-A09)
 */
router.get('/audit-logs', requireAdmin, async (_req, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { performedAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải nhật ký kiểm toán.', details: error.message });
  }
});

export default router;
