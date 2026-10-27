import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export class PetSyncService {
  private static getMasterPetsPath(): string {
    return path.resolve(__dirname, '../data/masterPets.json');
  }

  /**
   * Reads masterPets.json and automatically synchronizes all pet definitions into the database.
   * Runs automatically on server startup and during database seeding.
   */
  static async syncAllPets(prisma: PrismaClient) {
    try {
      const masterPetsPath = this.getMasterPetsPath();
      if (!fs.existsSync(masterPetsPath)) {
        return;
      }

      const raw = fs.readFileSync(masterPetsPath, 'utf-8');
      const masterPets = JSON.parse(raw);
      if (!Array.isArray(masterPets) || masterPets.length === 0) {
        return;
      }

      let insertedCount = 0;
      let updatedCount = 0;

      for (const pet of masterPets) {
        if (!pet.name) continue;

        const frameConfigStr = typeof pet.frameConfig === 'string'
          ? pet.frameConfig
          : JSON.stringify(pet.frameConfig || {});
        const animationsStr = typeof pet.animations === 'string'
          ? pet.animations
          : JSON.stringify(pet.animations || {});

        const existing = await prisma.petType.findUnique({
          where: { name: pet.name }
        });

        if (!existing) {
          await prisma.petType.create({
            data: {
              name: pet.name,
              description: pet.description || pet.name,
              unlockLevel: pet.unlockLevel || 1,
              isActive: pet.isActive ?? true,
              isShopEnabled: pet.isShopEnabled ?? false,
              isPurchaseRequired: pet.isPurchaseRequired ?? false,
              expPrice: pet.expPrice || 0,
              spriteSheetUrl: pet.spriteSheetUrl,
              previewUrl: pet.previewUrl,
              naturalAspectRatio: pet.naturalAspectRatio || 1.0,
              frameConfig: frameConfigStr,
              animations: animationsStr
            }
          });
          insertedCount++;
        } else {
          // If the pet exists, ensure it is active and has correct sprite URLs
          const shouldUpdate =
            !existing.isActive ||
            existing.spriteSheetUrl !== pet.spriteSheetUrl ||
            existing.previewUrl !== pet.previewUrl;

          if (shouldUpdate) {
            await prisma.petType.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                spriteSheetUrl: pet.spriteSheetUrl,
                previewUrl: pet.previewUrl,
                naturalAspectRatio: pet.naturalAspectRatio || 1.0,
                frameConfig: frameConfigStr,
                animations: animationsStr
              }
            });
            updatedCount++;
          }
        }
      }

      if (insertedCount > 0 || updatedCount > 0) {
        console.log(`🐾 [PetSyncService] Đã đồng bộ thú cưng vào database: +${insertedCount} tạo mới, ${updatedCount} cập nhật.`);
      }
    } catch (err: any) {
      console.warn('⚠️ [PetSyncService] Lỗi khi đồng bộ thú cưng:', err.message);
    }
  }

  /**
   * Saves a newly created or imported pet type to masterPets.json so it is persisted to git for all teammates.
   */
  static saveToMasterPets(petType: any) {
    try {
      const masterPetsPath = this.getMasterPetsPath();
      let masterPets: any[] = [];
      if (fs.existsSync(masterPetsPath)) {
        try {
          masterPets = JSON.parse(fs.readFileSync(masterPetsPath, 'utf-8'));
        } catch {
          masterPets = [];
        }
      }

      const frameConfig = typeof petType.frameConfig === 'string'
        ? JSON.parse(petType.frameConfig)
        : petType.frameConfig;
      const animations = typeof petType.animations === 'string'
        ? JSON.parse(petType.animations)
        : petType.animations;

      const newEntry = {
        name: petType.name,
        description: petType.description || petType.name,
        unlockLevel: petType.unlockLevel || 1,
        isActive: petType.isActive ?? true,
        isShopEnabled: petType.isShopEnabled ?? false,
        isPurchaseRequired: petType.isPurchaseRequired ?? false,
        expPrice: petType.expPrice || 0,
        spriteSheetUrl: petType.spriteSheetUrl,
        previewUrl: petType.previewUrl,
        naturalAspectRatio: petType.naturalAspectRatio || 1.0,
        frameConfig,
        animations
      };

      const existingIndex = masterPets.findIndex(p => p.name === petType.name);
      if (existingIndex >= 0) {
        masterPets[existingIndex] = { ...masterPets[existingIndex], ...newEntry };
      } else {
        masterPets.push(newEntry);
      }

      fs.mkdirSync(path.dirname(masterPetsPath), { recursive: true });
      fs.writeFileSync(masterPetsPath, JSON.stringify(masterPets, null, 2), 'utf-8');
      console.log(`💾 [PetSyncService] Đã lưu thông tin thú cưng "${petType.name}" vào masterPets.json`);
    } catch (err: any) {
      console.warn('⚠️ [PetSyncService] Không thể lưu vào masterPets.json:', err.message);
    }
  }
}
