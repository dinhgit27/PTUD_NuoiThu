import { Router, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { SpriteForgeService, SpriteSheetValidationError } from '../services/spriteForgeService';
import { formatItem, safeJsonParse } from '../utils/jsonHelper';

const router = Router();
const prisma = new PrismaClient();
const shopItemTypes = ['FOOD', 'SKIN', 'HAT', 'ACCESSORY', 'BADGE', 'THEME'];
const itemRarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const itemEquipSlots = ['AUTO', 'HEAD', 'BODY', 'HAND', 'FEET', 'AURA'];
const itemEffects = ['NONE', 'BOUNCE', 'FLOAT', 'SPARKLE', 'GLOW', 'HEARTS', 'EXP_BOOST'];

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

function auditJson(val: any): string | null {
  if (val === undefined || val === null) return null;
  return typeof val === 'string' ? val : JSON.stringify(val);
}

router.patch('/sprite/:id/details', requireAdmin, async (req: AuthRequest, res: Response) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!name || name.length > 80 || description.length > 500) {
    return res.status(400).json({ error: 'Tên loài thú phải từ 1–80 ký tự; mô tả tối đa 500 ký tự.' });
  }

  try {
    const petType = await prisma.petType.update({
      where: { id: req.params.id },
      data: { name, description: description || null }
    });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_PET_TYPE_DETAILS',
        targetEntity: 'PetType',
        targetId: petType.id,
        newValue: auditJson({ name, description: description || null })
      }
    });
    res.json({ message: 'Đã cập nhật tên và mô tả loài thú.', petType });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Tên loài thú này đã được sử dụng.' });
    }
    console.error('Could not update pet type details:', error);
    res.status(500).json({ error: 'Không thể cập nhật thông tin loài thú.' });
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh PNG, JPG, JPEG, WEBP, GIF!'));
    }
  }
});

router.get('/analytics', requireAdmin, async (_req, res: Response) => {
  try {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 29);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 30);

    const [activeUsers, focusTimes, newUsers] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string; value: number | bigint }>>`
        SELECT CONVERT(VARCHAR(10), [start_time], 23) AS [day],
               COUNT(DISTINCT [user_id]) AS [value]
        FROM [dbo].[work_sessions]
        WHERE [start_time] >= ${startDate} AND [start_time] < ${endDate}
        GROUP BY CONVERT(VARCHAR(10), [start_time], 23)
        ORDER BY CONVERT(VARCHAR(10), [start_time], 23)
      `,
      prisma.$queryRaw<Array<{ day: string; value: number | null }>>`
        SELECT CONVERT(VARCHAR(10), [start_time], 23) AS [day],
               CAST(ROUND(AVG(CAST([duration_minutes] AS FLOAT)), 0) AS INT) AS [value]
        FROM [dbo].[work_sessions]
        WHERE [is_completed] = 1
          AND [start_time] >= ${startDate} AND [start_time] < ${endDate}
        GROUP BY CONVERT(VARCHAR(10), [start_time], 23)
        ORDER BY CONVERT(VARCHAR(10), [start_time], 23)
      `,
      prisma.$queryRaw<Array<{ day: string; value: number | bigint }>>`
        SELECT CONVERT(VARCHAR(10), [created_at], 23) AS [day],
               COUNT(*) AS [value]
        FROM [dbo].[users]
        WHERE [created_at] >= ${startDate} AND [created_at] < ${endDate}
        GROUP BY CONVERT(VARCHAR(10), [created_at], 23)
        ORDER BY CONVERT(VARCHAR(10), [created_at], 23)
      `
    ]);

    const activeByDay = new Map(activeUsers.map(row => [row.day, Number(row.value)]));
    const focusByDay = new Map(focusTimes.map(row => [row.day, Number(row.value || 0)]));
    const createdByDay = new Map(newUsers.map(row => [row.day, Number(row.value)]));
    const days = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return { date: key, activeUsers: activeByDay.get(key) || 0, averageFocusMinutes: focusByDay.get(key) || 0, newUsers: createdByDay.get(key) || 0 };
    });
    let cumulativeUsers = await prisma.user.count({ where: { createdAt: { lt: startDate } } });
    const daily = days.map(day => {
      cumulativeUsers += day.newUsers;
      return { ...day, totalUsers: cumulativeUsers };
    });
    res.json({ days: daily });
  } catch (error) {
    console.error('Could not load admin analytics:', error);
    res.status(500).json({ error: 'Không thể tải số liệu phân tích quản trị.' });
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
        newValue: auditJson({ prompt, name })
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

router.post('/sprite/import-sheet', requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  let petImported = false;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng tải lên sprite sheet PNG, JPG hoặc WEBP.' });
    }
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({ error: 'Vui lòng nhập tên thú cưng.' });
    }

    const result = await SpriteForgeService.importPetSpriteSheet({
      imagePath: req.file.path,
      sheetUrl: `/uploads/${req.file.filename}`,
      name,
      description: typeof req.body.description === 'string' ? req.body.description : undefined
    });
    petImported = true;
    await fs.promises.unlink(req.file.path).catch(unlinkError => {
      console.error('Failed to remove the processed pet sprite upload:', unlinkError);
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'IMPORT_PET_SPRITE_SHEET',
        targetEntity: 'PetType',
        targetId: result.petType.id,
        newValue: auditJson({ name, originalFilename: req.file.originalname, frameConfig: result.generatedMeta.frameConfig })
      }
    });

    res.status(201).json({
      message: 'Đã nhập sprite sheet 17 trạng thái (chuẩn 64×64 px). Thú cưng đang ở trạng thái nháp.',
      ...result
    });
  } catch (error) {
    if (req.file && !petImported) {
      await fs.promises.unlink(req.file.path).catch(unlinkError => {
        console.error('Failed to remove an unreferenced sprite sheet upload:', unlinkError);
      });
    }
    if (error instanceof SpriteSheetValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Sprite sheet import failed:', error);
    res.status(500).json({ error: 'Không thể nhập sprite sheet lúc này.' });
  }
});

/**
 * Create Pet from individual action files (GIF, WEBP, PNG per action)
 */
router.post('/sprite/create-by-actions', requireAdmin, upload.any(), async (req: AuthRequest, res: Response) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      await Promise.all(uploadedFiles.map(f => fs.promises.unlink(f.path).catch(() => {})));
      return res.status(400).json({ error: 'Vui lòng nhập tên thú cưng.' });
    }

    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const removeBackground = req.body.removeBackground === 'true' || req.body.removeBackground === true;

    // Map files by action name
    const actionsFiles: Record<string, string> = {};
    for (const file of uploadedFiles) {
      const actionName = file.fieldname.replace(/^action_/, '').toUpperCase();
      actionsFiles[actionName] = file.path;
    }

    if (!actionsFiles['IDLE']) {
      await Promise.all(uploadedFiles.map(f => fs.promises.unlink(f.path).catch(() => {})));
      return res.status(400).json({ error: 'Hành động IDLE (Mặc định) là bắt buộc. Vui lòng tải ít nhất ảnh cho trạng thái IDLE.' });
    }

    let actionFrameCounts: Record<string, number> = {};
    if (typeof req.body.frameCounts === 'string') {
      try {
        actionFrameCounts = JSON.parse(req.body.frameCounts);
      } catch {}
    } else if (typeof req.body.frameCounts === 'object' && req.body.frameCounts) {
      actionFrameCounts = req.body.frameCounts;
    }

    let actionSliceConfigs: Record<string, any> = {};
    if (typeof req.body.sliceConfigs === 'string') {
      try {
        actionSliceConfigs = JSON.parse(req.body.sliceConfigs);
      } catch {}
    } else if (typeof req.body.sliceConfigs === 'object' && req.body.sliceConfigs) {
      actionSliceConfigs = req.body.sliceConfigs;
    }

    const result = await SpriteForgeService.createPetFromActions({
      name,
      description,
      removeBackground,
      actionsFiles,
      actionFrameCounts,
      actionSliceConfigs
    });

    // Clean up uploaded temp files
    await Promise.all(uploadedFiles.map(f => fs.promises.unlink(f.path).catch(() => {})));

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'CREATE_PET_FROM_ACTIONS',
        targetEntity: 'PetType',
        targetId: result.petType.id,
        newValue: auditJson({ name, actionCount: Object.keys(actionsFiles).length, actions: Object.keys(actionsFiles) })
      }
    });

    res.status(201).json({
      message: `Đã ghép thành công hoạt ảnh cho thú cưng ${name} từ các hành động!`,
      ...result
    });
  } catch (error: any) {
    await Promise.all(uploadedFiles.map(f => fs.promises.unlink(f.path).catch(() => {})));
    console.error('Create pet from actions failed:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi tạo thú cưng từ các hành động.' });
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
        newValue: auditJson({ frameConfig, animations })
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
 * Delete PetType from database
 */
router.delete('/sprites/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const petType = await prisma.petType.findUnique({ where: { id } });
    if (!petType) {
      return res.status(404).json({ error: 'Không tìm thấy thú cưng cần xóa.' });
    }

    // 1. If any user has this pet equipped, migrate them to another available active pet
    const fallbackPet = await prisma.petType.findFirst({
      where: { id: { not: id }, isActive: true }
    });

    if (fallbackPet) {
      await prisma.userPet.updateMany({
        where: { typeId: id },
        data: { typeId: fallbackPet.id }
      });
    }

    // 2. Remove user purchase records
    await prisma.purchasedPetType.deleteMany({
      where: { petTypeId: id }
    });

    // 3. Clear petTypeId on shop items if any
    await prisma.item.updateMany({
      where: { petTypeId: id },
      data: { petTypeId: null }
    });

    // 4. Delete pet type from database
    await prisma.petType.delete({ where: { id } });

    // 5. Try to clean up physical sprite files if not default built-ins
    const isDefault = ['corgi', 'cat', 'rabbit', 'husky'].some(d => petType.spriteSheetUrl.toLowerCase().includes(d));
    if (!isDefault) {
      const publicDir = path.resolve(process.cwd(), 'public');
      const rootPublicDir = path.resolve(process.cwd(), '..', 'public');
      [publicDir, rootPublicDir].forEach(pDir => {
        try {
          if (petType.spriteSheetUrl) {
            const sPath = path.join(pDir, petType.spriteSheetUrl.replace(/^\//, ''));
            if (fs.existsSync(sPath)) fs.unlinkSync(sPath);
          }
          if (petType.previewUrl) {
            const pPath = path.join(pDir, petType.previewUrl.replace(/^\//, ''));
            if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
          }
        } catch {}
      });
    }

    // 6. Audit log
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'DELETE_PET_TYPE',
        targetEntity: 'PetType',
        targetId: id,
        oldValue: auditJson({ name: petType.name, spriteSheetUrl: petType.spriteSheetUrl })
      }
    });

    res.json({ message: `Đã xóa thành công thú cưng "${petType.name}".`, id });
  } catch (error: any) {
    console.error('Delete pet failed:', error);
    res.status(500).json({ error: error.message || 'Không thể xóa thú cưng.' });
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
    const requestedFrames = req.body.animationFrames === undefined ? 1 : Number(req.body.animationFrames);
    const animationColumns = req.body.animationColumns === undefined
      ? requestedFrames
      : Number(req.body.animationColumns);
    const animationRows = req.body.animationRows === undefined ? 1 : Number(req.body.animationRows);
    const animationFrames = animationColumns * animationRows;
    const animationFps = req.body.animationFps === undefined ? (animationFrames > 1 ? 4 : 0) : Number(req.body.animationFps);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;

    if (typeof name !== 'string' || !name.trim() || typeof imageUrl !== 'string' || !imageUrl.trim() ||
        !Number.isInteger(expPrice) || expPrice < 0 ||
        !Number.isInteger(animationColumns) || animationColumns < 1 || animationColumns > 12 ||
        !Number.isInteger(animationRows) || animationRows < 1 || animationRows > 12 ||
        !Number.isInteger(animationFrames) || animationFrames < 1 || animationFrames > 12 ||
        (req.body.animationFrames !== undefined && requestedFrames !== animationFrames) ||
        !Number.isInteger(animationFps) || animationFps < 0 || animationFps > 12 ||
        (animationFrames > 1 && (animationFps < 1 || !req.file)) ||
        (animationFrames === 1 && animationFps !== 0)) {
      if (req.file) await fs.promises.unlink(req.file.path);
      return res.status(400).json({ error: 'Tên, ảnh, giá và cấu hình hoạt ảnh bối cảnh không hợp lệ. Sprite sheet cần 1–12 cột, 1–12 hàng, tối đa 12 khung tổng cộng và 1–12 FPS; ảnh tĩnh dùng 1×1 khung và 0 FPS.' });
    }

    const bg = await prisma.gardenBackground.create({
      data: {
        name: name.trim(),
        imageUrl: imageUrl.trim(),
        animationFrames,
        animationFps,
        animationColumns,
        animationRows,
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
        newValue: auditJson({ name: name.trim(), imageUrl: imageUrl.trim() })
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

router.patch('/backgrounds/:id/animation', requireAdmin, async (req: AuthRequest, res: Response) => {
  const animationColumns = req.body.animationColumns === undefined
    ? Number(req.body.animationFrames)
    : req.body.animationColumns;
  const animationRows = req.body.animationRows === undefined ? 1 : req.body.animationRows;
  const animationFrames = animationColumns * animationRows;
  const { animationFps } = req.body;
  if (!Number.isInteger(animationColumns) || animationColumns < 1 || animationColumns > 12 ||
      !Number.isInteger(animationRows) || animationRows < 1 || animationRows > 12 ||
      animationFrames < 1 || animationFrames > 12 ||
      !Number.isInteger(animationFps) || animationFps < 0 || animationFps > 12 ||
      (animationFrames > 1 && animationFps < 1) ||
      (animationFrames === 1 && animationFps !== 0)) {
    return res.status(400).json({
      error: 'Cấu hình không hợp lệ. Ảnh tĩnh dùng 1 khung và 0 FPS; ảnh động dùng 2–12 khung và 1–12 FPS.'
    });
  }

  try {
    const background = await prisma.gardenBackground.update({
      where: { id: req.params.id },
      data: { animationFrames, animationFps, animationColumns, animationRows }
    });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_GARDEN_BACKGROUND_ANIMATION',
        targetEntity: 'GardenBackground',
        targetId: background.id,
        newValue: auditJson({ animationFrames, animationFps, animationColumns, animationRows })
      }
    });
    res.json({ message: 'Đã cập nhật cấu hình hoạt ảnh bối cảnh.', background });
  } catch (error) {
    console.error('Could not update garden background animation:', error);
    res.status(500).json({ error: 'Không thể cập nhật cấu hình hoạt ảnh bối cảnh.' });
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
        newValue: auditJson({ expPrice, isActive })
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
    res.json(items.map(formatItem));
  } catch (error) {
    console.error('Could not load admin shop items:', error);
    res.status(500).json({ error: 'Không thể tải vật phẩm cửa hàng.' });
  }
});

router.post('/shop/items', requireAdmin, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'spriteSheet', maxCount: 1 }
]), async (req: AuthRequest, res: Response) => {
  let itemCreated = false;
  const files = req.files as { image?: Express.Multer.File[]; spriteSheet?: Express.Multer.File[] } | undefined;
  const imageFile = files?.image?.[0];
  const spriteSheetFile = files?.spriteSheet?.[0];
  const removeUploadedFiles = async () => {
    await Promise.all([imageFile, spriteSheetFile].filter((file): file is Express.Multer.File => Boolean(file)).map(file =>
      fs.promises.unlink(file.path).catch(unlinkError => {
        console.error('Failed to remove an unreferenced item upload:', unlinkError);
      })
    ));
  };
  try {
    const { name, description, itemType, rarity } = req.body;
    const price = Number(req.body.expPrice);
    const equipSlot = typeof req.body.equipSlot === 'string' ? req.body.equipSlot : 'AUTO';
    const effect = typeof req.body.effect === 'string' ? req.body.effect : 'NONE';
    const effectValue = req.body.effectValue === undefined ? 0 : Number(req.body.effectValue);
    if (spriteSheetFile && itemType === 'FOOD') {
      await removeUploadedFiles();
      return res.status(400).json({ error: 'Sprite sheet chỉ dùng cho skin và trang bị; thức ăn chỉ hỗ trợ ảnh đại diện tĩnh.' });
    }
    if (typeof name !== 'string' || !name.trim() ||
        !shopItemTypes.includes(itemType) || !itemRarities.includes(rarity) ||
        !Number.isInteger(price) || price < 0 ||
        !itemEquipSlots.includes(equipSlot) || !itemEffects.includes(effect) ||
        !Number.isInteger(effectValue) || effectValue < 0 || effectValue > 100 ||
        (effect === 'EXP_BOOST' && effectValue < 1)) {
      await removeUploadedFiles();
      return res.status(400).json({ error: 'Thông tin vật phẩm không hợp lệ. Hiệu ứng tăng EXP phải từ 1% đến 100%.' });
    }

    let imageUrl = req.body.imageUrl;
    if (imageFile) {
      const cleanedPath = await SpriteForgeService.removeImageBackground(imageFile.path, false);
      const cleanedFilename = path.basename(cleanedPath);
      imageUrl = `/uploads/${cleanedFilename}`;
    }
    let spriteSheetUrl: string | null = null;
    let frameConfig: any = undefined;
    let animations: any = undefined;
    if (spriteSheetFile) {
      const spriteMeta = await SpriteForgeService.inspectSpriteSheet({
        imagePath: spriteSheetFile.path,
        sheetUrl: `/uploads/${spriteSheetFile.filename}`,
        name: name.trim()
      });
      imageUrl = typeof imageUrl === 'string' && imageUrl.trim()
        ? imageUrl.trim()
        : spriteMeta.previewUrl;
      spriteSheetUrl = spriteMeta.sheetUrl;
      frameConfig = spriteMeta.frameConfig;
      animations = spriteMeta.animations;
    }
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      await removeUploadedFiles();
      return res.status(400).json({ error: 'Vui lòng tải ảnh lên hoặc cung cấp URL ảnh.' });
    }

    let compatiblePetIds: string | null = null;
    if (req.body.compatiblePetIds) {
      if (Array.isArray(req.body.compatiblePetIds)) {
        compatiblePetIds = JSON.stringify(req.body.compatiblePetIds);
      } else if (typeof req.body.compatiblePetIds === 'string') {
        try {
          const parsed = JSON.parse(req.body.compatiblePetIds);
          compatiblePetIds = Array.isArray(parsed) ? JSON.stringify(parsed) : null;
        } catch {
          compatiblePetIds = req.body.compatiblePetIds.trim() ? JSON.stringify([req.body.compatiblePetIds.trim()]) : null;
        }
      }
    }
    const petTypeId = typeof req.body.petTypeId === 'string' && req.body.petTypeId.trim() ? req.body.petTypeId.trim() : null;

    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : null,
        itemType,
        rarity,
        expPrice: price,
        equipSlot,
        effect,
        effectValue,
        imageUrl: imageUrl.trim(),
        spriteSheetUrl,
        frameConfig: frameConfig ? (typeof frameConfig === 'string' ? frameConfig : JSON.stringify(frameConfig)) : null,
        animations: animations ? (typeof animations === 'string' ? animations : JSON.stringify(animations)) : null,
        petTypeId,
        compatiblePetIds,
        isAvailable: true
      }
    });
    itemCreated = true;
    if (spriteSheetFile) {
      await fs.promises.unlink(spriteSheetFile.path).catch(unlinkError => {
        console.error('Failed to remove the processed item sprite upload:', unlinkError);
      });
    }
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'CREATE_SHOP_ITEM',
        targetEntity: 'Item',
        targetId: item.id,
        newValue: auditJson({ name: item.name, itemType: item.itemType, expPrice: item.expPrice, isAnimated: Boolean(item.spriteSheetUrl) })
      }
    });
    res.status(201).json({
      message: item.spriteSheetUrl
        ? 'Đã tạo trang bị hoạt ảnh và mở bán trong cửa hàng.'
        : 'Đã tạo vật phẩm và mở bán trong cửa hàng.',
      item: formatItem(item)
    });
  } catch (error) {
    if (!itemCreated) {
      await removeUploadedFiles();
    }
    if (error instanceof SpriteSheetValidationError) {
      return res.status(400).json({ error: error.message });
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
      if (effect === 'EXP_BOOST' && req.body.effectValue === undefined) {
        data.effectValue = 10;
      }
    }
    if (req.body.effectValue !== undefined) {
      const effectValue = Number(req.body.effectValue);
      if (!Number.isInteger(effectValue) || effectValue < 0 || effectValue > 100 ||
          ((effect ?? 'NONE') === 'EXP_BOOST' && effectValue < 1)) {
        return res.status(400).json({ error: 'Mức tăng EXP phải là số nguyên từ 1% đến 100% khi chọn hiệu ứng tăng EXP.' });
      }
      data.effectValue = effectValue;
    }
    if (req.body.compatiblePetIds !== undefined) {
      const val = req.body.compatiblePetIds;
      if (Array.isArray(val)) {
        data.compatiblePetIds = val.length > 0 ? JSON.stringify(val) : null;
      } else if (typeof val === 'string') {
        data.compatiblePetIds = val.trim() ? val : null;
      } else {
        data.compatiblePetIds = null;
      }
    }
    if (req.body.petTypeId !== undefined) {
      data.petTypeId = typeof req.body.petTypeId === 'string' && req.body.petTypeId.trim() ? req.body.petTypeId.trim() : null;
    }

    if (!Object.keys(data).length) return res.status(400).json({ error: 'Không có thông tin cần cập nhật.' });
    const item = await prisma.item.update({ where: { id: req.params.id }, data });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_SHOP_ITEM',
        targetEntity: 'Item',
        targetId: item.id,
        newValue: auditJson(data)
      }
    });
    res.json({ message: 'Đã cập nhật vật phẩm cửa hàng.', item: formatItem(item) });
  } catch (error) {
    console.error('Could not update shop item:', error);
    res.status(500).json({ error: 'Không thể cập nhật vật phẩm cửa hàng.' });
  }
});

/**
 * POST /api/admin/shop/items/:id/sheet
 * Tải lên sprite sheet riêng cho một loài thú cụ thể hoặc sheet mặc định
 */
router.post('/shop/items/:id/sheet', requireAdmin, upload.single('spriteSheet'), async (req: AuthRequest, res: Response) => {
  const itemId = req.params.id;
  const petTypeId = typeof req.body.petTypeId === 'string' ? req.body.petTypeId.trim() : '';
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Vui lòng chọn file ảnh sprite sheet.' });
  }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      await fs.promises.unlink(file.path).catch(() => {});
      return res.status(404).json({ error: 'Không tìm thấy vật phẩm.' });
    }

    const spriteMeta = await SpriteForgeService.inspectSpriteSheet({
      imagePath: file.path,
      sheetUrl: `/uploads/${file.filename}`,
      name: `${item.name}_${petTypeId || 'sheet'}`
    });

    let updated;
    if (petTypeId) {
      const currentSheets = item.petSheets ? safeJsonParse(item.petSheets, {}) : {};
      currentSheets[petTypeId] = {
        spriteSheetUrl: spriteMeta.sheetUrl,
        frameConfig: spriteMeta.frameConfig,
        animations: spriteMeta.animations
      };

      let currentCompat: string[] = item.compatiblePetIds ? safeJsonParse(item.compatiblePetIds, []) : [];
      if (!currentCompat.includes(petTypeId)) {
        currentCompat.push(petTypeId);
      }

      updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          petSheets: JSON.stringify(currentSheets),
          compatiblePetIds: JSON.stringify(currentCompat)
        }
      });
    } else {
      updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          spriteSheetUrl: spriteMeta.sheetUrl,
          frameConfig: JSON.stringify(spriteMeta.frameConfig),
          animations: JSON.stringify(spriteMeta.animations)
        }
      });
    }

    await fs.promises.unlink(file.path).catch(() => {});

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_ITEM_SPRITE_SHEET',
        targetEntity: 'Item',
        targetId: item.id,
        newValue: auditJson({ petTypeId, sheetUrl: spriteMeta.sheetUrl })
      }
    });

    res.json({
      message: petTypeId ? 'Đã tải lên sprite sheet cho loài thú cưng!' : 'Đã cập nhật sprite sheet mặc định!',
      item: formatItem(updated)
    });
  } catch (err: any) {
    if (file) await fs.promises.unlink(file.path).catch(() => {});
    console.error('Upload item sheet error:', err);
    res.status(500).json({ error: err.message || 'Không thể xử lý sprite sheet.' });
  }
});

/**
 * DELETE /api/admin/shop/items/:id/sheet/:petTypeId
 * Xóa sprite sheet gắn với loài thú cụ thể
 */
router.delete('/shop/items/:id/sheet/:petTypeId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id: itemId, petTypeId } = req.params;
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Không tìm thấy vật phẩm.' });

    const currentSheets = item.petSheets ? safeJsonParse(item.petSheets, {}) : {};
    delete currentSheets[petTypeId];

    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        petSheets: Object.keys(currentSheets).length > 0 ? JSON.stringify(currentSheets) : null
      }
    });

    res.json({ message: 'Đã xóa sprite sheet cho loài thú này.', item: formatItem(updated) });
  } catch (err: any) {
    res.status(500).json({ error: 'Không thể xóa sprite sheet.' });
  }
});

router.get('/shop/pets', requireAdmin, async (_req, res: Response) => {
  try {
    const list = await prisma.petType.findMany({ orderBy: [{ createdAt: 'desc' }] });
    res.json(list.map(SpriteForgeService.parsePetTypeMeta));
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
        ...(isShopEnabled ? { isPurchaseRequired: true, isActive: true } : {})
      }
    });
    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: isShopEnabled ? 'ENABLE_PET_SHOP_LISTING' : 'DISABLE_PET_SHOP_LISTING',
        targetEntity: 'PetType',
        targetId: petType.id,
        newValue: auditJson({ isShopEnabled, expPrice })
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
router.get('/users', requireAdmin, async (req, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize || '10'), 10) || 10));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const role = req.query.role === 'ADMIN' || req.query.role === 'USER' ? req.query.role : undefined;
    const status = ['ACTIVE', 'INACTIVE', 'LOCKED'].includes(String(req.query.status))
      ? String(req.query.status)
      : undefined;
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } }
        ]
      } : {})
    };
    const [total, users] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({
      where,
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
      skip: (page - 1) * pageSize,
      take: pageSize
    })]);
    const violations = users.length
      ? await prisma.workSession.groupBy({
        by: ['userId'],
        where: { userId: { in: users.map(user => user.id) }, violationsCount: { gt: 0 } },
        _sum: { violationsCount: true }
      })
      : [];
    const violationCounts = new Map(violations.map(row => [row.userId, row._sum.violationsCount || 0]));
    res.json({
      users: users.map(user => ({ ...user, violationCount: violationCounts.get(user.id) || 0 })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải danh sách người dùng.', details: error.message });
  }
});

router.get('/users/:id/violations', requireAdmin, async (req, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, fullName: true }
    });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    const sessions = await prisma.workSession.findMany({
      where: { userId: user.id, violationsCount: { gt: 0 } },
      select: { id: true, mode: true, startTime: true, durationMinutes: true, focusScore: true, violationsCount: true },
      orderBy: { startTime: 'desc' },
      take: 50
    });
    res.json({ user, sessions });
  } catch (error) {
    console.error('Could not load user violation history:', error);
    res.status(500).json({ error: 'Không thể tải lịch sử vi phạm.' });
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
          newValue: auditJson({ status })
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
          oldValue: auditJson({ role: target.role }),
          newValue: auditJson({ role })
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

/**
 * ===================================================================
 * ADMIN QUEST MANAGEMENT
 * ===================================================================
 */

/**
 * GET /api/admin/quests
 * Lấy toàn bộ danh sách nhiệm vụ (kèm thông tin vật phẩm thưởng và tiến độ)
 */
router.get('/quests', requireAdmin, async (_req, res: Response) => {
  try {
    const quests = await prisma.quest.findMany({
      include: {
        rewardItem: true,
        _count: {
          select: { userQuests: true }
        }
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(quests);
  } catch (error: any) {
    console.error('Admin get quests error:', error);
    res.status(500).json({ error: 'Không thể tải danh sách nhiệm vụ.', details: error.message });
  }
});

/**
 * POST /api/admin/quests
 * Tạo nhiệm vụ mới cho người dùng
 */
router.post('/quests', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const category = ['DAILY', 'WEEKLY', 'SPECIAL'].includes(req.body.category) ? req.body.category : 'DAILY';
    const actionType = ['FEED', 'DRINK', 'STROKE', 'POMODORO', 'CHAT', 'MUSIC'].includes(req.body.actionType)
      ? req.body.actionType
      : 'FEED';
    const targetCount = Math.max(1, parseInt(req.body.targetCount, 10) || 1);
    const rewardExp = Math.max(0, parseInt(req.body.rewardExp, 10) || 0);
    const rewardItemId = req.body.rewardItemId && typeof req.body.rewardItemId === 'string' && req.body.rewardItemId.trim() !== ''
      ? req.body.rewardItemId.trim()
      : null;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;

    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Tiêu đề nhiệm vụ không được để trống và tối đa 200 ký tự.' });
    }
    if (!description || description.length > 1000) {
      return res.status(400).json({ error: 'Mô tả nhiệm vụ không được để trống và tối đa 1000 ký tự.' });
    }

    // Verify reward item if specified
    if (rewardItemId) {
      const itemExists = await prisma.item.findUnique({ where: { id: rewardItemId } });
      if (!itemExists) {
        return res.status(400).json({ error: 'Vật phẩm phần thưởng không tồn tại.' });
      }
    }

    const quest = await prisma.quest.create({
      data: {
        title,
        description,
        category,
        actionType,
        targetCount,
        rewardExp,
        rewardItemId,
        isActive
      },
      include: {
        rewardItem: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'CREATE_QUEST',
        targetEntity: 'Quest',
        targetId: quest.id,
        newValue: auditJson(quest)
      }
    });

    res.status(201).json({ message: 'Tạo nhiệm vụ thành công!', quest });
  } catch (error: any) {
    console.error('Admin create quest error:', error);
    res.status(500).json({ error: 'Không thể tạo nhiệm vụ.', details: error.message });
  }
});

/**
 * PUT /api/admin/quests/:id
 * Chỉnh sửa nhiệm vụ
 */
router.put('/quests/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const questId = req.params.id;
    const existing = await prisma.quest.findUnique({ where: { id: questId } });
    if (!existing) {
      return res.status(404).json({ error: 'Nhiệm vụ không tồn tại.' });
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : existing.title;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : existing.description;
    const category = ['DAILY', 'WEEKLY', 'SPECIAL'].includes(req.body.category) ? req.body.category : existing.category;
    const actionType = ['FEED', 'DRINK', 'STROKE', 'POMODORO', 'CHAT', 'MUSIC'].includes(req.body.actionType)
      ? req.body.actionType
      : existing.actionType;
    const targetCount = req.body.targetCount !== undefined ? Math.max(1, parseInt(req.body.targetCount, 10) || 1) : existing.targetCount;
    const rewardExp = req.body.rewardExp !== undefined ? Math.max(0, parseInt(req.body.rewardExp, 10) || 0) : existing.rewardExp;
    const rewardItemId = req.body.rewardItemId !== undefined
      ? (req.body.rewardItemId && typeof req.body.rewardItemId === 'string' && req.body.rewardItemId.trim() !== '' ? req.body.rewardItemId.trim() : null)
      : existing.rewardItemId;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive;

    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Tiêu đề nhiệm vụ không được để trống và tối đa 200 ký tự.' });
    }
    if (!description || description.length > 1000) {
      return res.status(400).json({ error: 'Mô tả nhiệm vụ không được để trống và tối đa 1000 ký tự.' });
    }

    if (rewardItemId) {
      const itemExists = await prisma.item.findUnique({ where: { id: rewardItemId } });
      if (!itemExists) {
        return res.status(400).json({ error: 'Vật phẩm phần thưởng không tồn tại.' });
      }
    }

    const updated = await prisma.quest.update({
      where: { id: questId },
      data: {
        title,
        description,
        category,
        actionType,
        targetCount,
        rewardExp,
        rewardItemId,
        isActive
      },
      include: {
        rewardItem: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'UPDATE_QUEST',
        targetEntity: 'Quest',
        targetId: updated.id,
        oldValue: auditJson(existing),
        newValue: auditJson(updated)
      }
    });

    res.json({ message: 'Cập nhật nhiệm vụ thành công!', quest: updated });
  } catch (error: any) {
    console.error('Admin update quest error:', error);
    res.status(500).json({ error: 'Không thể cập nhật nhiệm vụ.', details: error.message });
  }
});

/**
 * PATCH /api/admin/quests/:id/toggle
 * Bật/tắt trạng thái hoạt động của nhiệm vụ
 */
router.patch('/quests/:id/toggle', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const questId = req.params.id;
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) {
      return res.status(404).json({ error: 'Nhiệm vụ không tồn tại.' });
    }

    const updated = await prisma.quest.update({
      where: { id: questId },
      data: { isActive: !quest.isActive },
      include: { rewardItem: true }
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'TOGGLE_QUEST_STATUS',
        targetEntity: 'Quest',
        targetId: quest.id,
        oldValue: auditJson({ isActive: quest.isActive }),
        newValue: auditJson({ isActive: updated.isActive })
      }
    });

    res.json({
      message: updated.isActive ? 'Đã kích hoạt nhiệm vụ.' : 'Đã tạm ngưng nhiệm vụ.',
      quest: updated
    });
  } catch (error: any) {
    console.error('Admin toggle quest error:', error);
    res.status(500).json({ error: 'Không thể thay đổi trạng thái nhiệm vụ.', details: error.message });
  }
});

/**
 * DELETE /api/admin/quests/:id
 * Xóa nhiệm vụ
 */
router.delete('/quests/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const questId = req.params.id;
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) {
      return res.status(404).json({ error: 'Nhiệm vụ không tồn tại.' });
    }

    // Delete associated userQuests first to ensure clean cascade
    await prisma.userQuest.deleteMany({
      where: { questId }
    });

    await prisma.quest.delete({
      where: { id: questId }
    });

    await prisma.auditLog.create({
      data: {
        adminId: auditAdminId(req),
        action: 'DELETE_QUEST',
        targetEntity: 'Quest',
        targetId: questId,
        oldValue: auditJson(quest)
      }
    });

    res.json({ message: 'Đã xóa nhiệm vụ thành công!' });
  } catch (error: any) {
    console.error('Admin delete quest error:', error);
    res.status(500).json({ error: 'Không thể xóa nhiệm vụ.', details: error.message });
  }
});

export default router;
