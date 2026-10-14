import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for OfficePet 2D Pixel...');

  // 1. Create Organization
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

  // 2. Create Backgrounds
  const bgSpring = await prisma.gardenBackground.upsert({
    where: { name: 'Khu Vườn Mùa Xuân' },
    update: { expPrice: 0 },
    create: {
      name: 'Khu Vườn Mùa Xuân',
      imageUrl: '/backgrounds/garden_spring.png',
      description: 'Đồng cỏ xanh tươi, hoa anh đào nở rộ và những đóa hoa pixel đa sắc.',
      expPrice: 0,
      isRecommended: true,
      isActive: true
    }
  });

  await prisma.gardenBackground.upsert({
    where: { name: 'Quán Cafe Pixel Ban Đêm' },
    update: { expPrice: 80 },
    create: {
      name: 'Quán Cafe Pixel Ban Đêm',
      imageUrl: '/backgrounds/cafe_cozy.png',
      description: 'Không gian ấm cúng với ánh đèn vàng, kệ sách và bầu trời đêm ngập sao.',
      expPrice: 80,
      isRecommended: true,
      isActive: true
    }
  });

  await prisma.gardenBackground.upsert({
    where: { name: 'Phòng Làm Việc Cây Xanh' },
    update: { expPrice: 100 },
    create: {
      name: 'Phòng Làm Việc Cây Xanh',
      imageUrl: '/backgrounds/office_zen.png',
      description: 'Góc làm việc hiện đại tràn ngập ánh sáng tự nhiên và cây cảnh lọc không khí.',
      expPrice: 100,
      isRecommended: false,
      isActive: true
    }
  });

  await prisma.gardenBackground.upsert({
    where: { name: 'Bãi Biển Hoàng Hôn Pixel' },
    update: { expPrice: 120 },
    create: {
      name: 'Bãi Biển Hoàng Hôn Pixel',
      imageUrl: '/backgrounds/beach_sunset.png',
      description: 'Khung cảnh hoàng hôn rực rỡ bên bờ biển với những hàng dừa đung đưa theo gió.',
      expPrice: 120,
      isRecommended: false,
      isActive: true
    }
  });

  // 3. Create Department
  const dept = await prisma.department.upsert({
    where: { inviteCode: 'TECH01' },
    update: {},
    create: {
      orgId: org.id,
      name: 'Phòng Kỹ Thuật & Phần Mềm',
      inviteCode: 'TECH01',
      workHours: '08:30 - 17:30',
      gardenLevel: 2,
      gardenExp: 450,
      backgroundId: bgSpring.id
    }
  });

  // 4. Create 3 Published PetTypes
  const readMeta = (prefix: string) => {
    const metaPath = path.resolve(process.cwd(), 'public', 'sprites', `${prefix}_default_meta.json`);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
    return null;
  };

  const catMeta = readMeta('cat');
  const corgiMeta = readMeta('corgi');
  const rabbitMeta = readMeta('rabbit');

  const catType = await prisma.petType.upsert({
    where: { name: 'Mèo Pixel Shiro' },
    update: {},
    create: {
      name: 'Mèo Pixel Shiro',
      description: 'Bé mèo mướp màu cam lanh lợi, thích ngủ gật và gõ phím cùng chủ nhân.',
      unlockLevel: 1,
      isActive: true,
      spriteSheetUrl: catMeta?.sheetUrl || '/sprites/cat_default_spritesheet.png',
      previewUrl: catMeta?.previewUrl || '/sprites/cat_default_preview.png',
      naturalAspectRatio: 1.0,
      frameConfig: catMeta?.frameConfig || {},
      animations: catMeta?.animations || {}
    }
  });

  const corgiType = await prisma.petType.upsert({
    where: { name: 'Corgi Pixel Bento' },
    update: {},
    create: {
      name: 'Corgi Pixel Bento',
      description: 'Chú cún Corgi chân ngắn vui nhộn, luôn lắc lư theo điệu nhạc Lofi.',
      unlockLevel: 1,
      isActive: true,
      spriteSheetUrl: corgiMeta?.sheetUrl || '/sprites/corgi_default_spritesheet.png',
      previewUrl: corgiMeta?.previewUrl || '/sprites/corgi_default_preview.png',
      naturalAspectRatio: 1.0,
      frameConfig: corgiMeta?.frameConfig || {},
      animations: corgiMeta?.animations || {}
    }
  });

  const rabbitType = await prisma.petType.upsert({
    where: { name: 'Thỏ Pixel Mochi' },
    update: {},
    create: {
      name: 'Thỏ Pixel Mochi',
      description: 'Bé thỏ trắng tai dài dịu dàng, luôn chăm chú nhắc bạn uống nước đúng giờ.',
      unlockLevel: 1,
      isActive: true,
      spriteSheetUrl: rabbitMeta?.sheetUrl || '/sprites/rabbit_default_spritesheet.png',
      previewUrl: rabbitMeta?.previewUrl || '/sprites/rabbit_default_preview.png',
      naturalAspectRatio: 1.0,
      frameConfig: rabbitMeta?.frameConfig || {},
      animations: rabbitMeta?.animations || {}
    }
  });

  // 5. Create Admin in the same account table used by normal users.
  const adminHash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@techcorp.com' },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: 'admin@techcorp.com',
      passwordHash: adminHash,
      fullName: 'OfficePet Admin',
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  // 6. Create Primary User & Pet
  const userPasswordHash = await bcrypt.hash('User@123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'hung@techcorp.com' },
    update: {},
    create: {
      email: 'hung@techcorp.com',
      passwordHash: userPasswordHash,
      fullName: 'Phi Hùng',
      role: 'USER',
      status: 'ACTIVE',
      orgId: org.id,
      deptId: dept.id
    }
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      favMusicGenre: 'Lo-fi Hip Hop',
      petPersona: 'Vui vẻ',
      soundEnabled: true,
      aiLearningEnabled: true,
      hydrationInterval: 45,
      postureInterval: 90
    }
  });

  await prisma.userPet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      typeId: catType.id,
      name: 'Mochi Neko',
      level: 2,
      exp: 120,
      hunger: 85,
      happiness: 100,
      health: 100,
      currentState: 'IDLE',
      currentMode: 'RELAXED',
      scaleSize: 'MEDIUM',
      positionX: 82.0,
      positionY: 75.0,
      dailyInteractionsLeft: 3
    }
  });

  // 7. Create Colleague Users in the same Department
  const col1 = await prisma.user.upsert({
    where: { email: 'minh@techcorp.com' },
    update: {},
    create: {
      email: 'minh@techcorp.com',
      passwordHash: userPasswordHash,
      fullName: 'Trần Minh Anh',
      role: 'USER',
      orgId: org.id,
      deptId: dept.id
    }
  });

  await prisma.userPet.upsert({
    where: { userId: col1.id },
    update: {},
    create: {
      userId: col1.id,
      typeId: corgiType.id,
      name: 'Bento Boy',
      level: 3,
      exp: 340,
      hunger: 70,
      happiness: 90,
      health: 100,
      currentState: 'TYPING',
      currentMode: 'STRICT',
      scaleSize: 'MEDIUM',
      positionX: 30.0,
      positionY: 72.0
    }
  });

  const col2 = await prisma.user.upsert({
    where: { email: 'ha@techcorp.com' },
    update: {},
    create: {
      email: 'ha@techcorp.com',
      passwordHash: userPasswordHash,
      fullName: 'Lê Thu Hà',
      role: 'USER',
      orgId: org.id,
      deptId: dept.id
    }
  });

  await prisma.userPet.upsert({
    where: { userId: col2.id },
    update: {},
    create: {
      userId: col2.id,
      typeId: rabbitType.id,
      name: 'Thỏ Bông',
      level: 1,
      exp: 80,
      hunger: 95,
      happiness: 100,
      health: 100,
      currentState: 'DANCING',
      currentMode: 'RELAXED',
      scaleSize: 'SMALL',
      positionX: 55.0,
      positionY: 70.0
    }
  });

  // 8. Seed Game Items
  await prisma.item.upsert({
    where: { id: 'item_fish_01' },
    update: {
      description: 'Thức ăn hồi phục 40 điểm no bụng và 10 điểm sức khỏe cho thú cưng.',
      imageUrl: '/sprites/shop_fish.svg'
    },
    create: {
      id: 'item_fish_01',
      name: 'Cá Hồi Pixel Thượng Hạng',
      description: 'Thức ăn hồi phục 40 điểm no bụng và 10 điểm sức khỏe cho thú cưng.',
      itemType: 'FOOD',
      imageUrl: '/sprites/shop_fish.svg',
      rarity: 'COMMON',
      expPrice: 50
    }
  });

  await prisma.item.upsert({
    where: { id: 'item_hat_01' },
    update: { imageUrl: '/sprites/shop_hat.svg' },
    create: {
      id: 'item_hat_01',
      name: 'Mũ Rơm Pixel Nghỉ Dưỡng',
      description: 'Phụ kiện mũ nón xinh xắn cho thú cưng khi đi dạo vườn.',
      itemType: 'HAT',
      imageUrl: '/sprites/shop_hat.svg',
      rarity: 'RARE',
      expPrice: 150
    }
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
