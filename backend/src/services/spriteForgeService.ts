import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface GenerateSpriteOptions {
  prompt: string;
  name: string;
  description?: string;
  naturalAspectRatio?: number;
}

export interface GenerateFromImageOptions {
  imagePath: string;
  name: string;
  description?: string;
  naturalAspectRatio?: number;
}

export interface FrameConfig {
  frameWidth: number;
  frameHeight: number;
  totalColumns: number;
  totalRows: number;
  totalFrames: number;
  framesPerState: number;
  renderScale: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    defaultWidth: number;
    defaultHeight: number;
  };
  naturalAspectRatio: number;
  palette?: string;
}

export interface AnimationStateConfig {
  row: number;
  frames: number[];
  fps: number;
  loop: boolean;
}

export type AnimationsMap = Record<string, AnimationStateConfig>;

export class SpriteForgeService {
  /**
   * Helper to execute python generator safely with spec JSON and UTF-8 encoding
   */
  private static async runPythonGenerator(spec: any, sanitizedName: string, outputDir: string): Promise<any> {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'generate_sprite_forge.py');
    const specPath = path.join(outputDir, `_spec_${sanitizedName}_${Date.now()}.json`);
    
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');

    const cmd = `python "${scriptPath}" --spec "${specPath}"`;

    const resultOutput = await new Promise<string>((resolve, reject) => {
      exec(cmd, {
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8'
        }
      }, (error, stdout, stderr) => {
        // Clean up spec file
        try {
          if (fs.existsSync(specPath)) fs.unlinkSync(specPath);
        } catch {}

        if (error) {
          console.error('Sprite Forge exec error:', stderr);
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout.trim());
      });
    });

    let meta: any = null;
    try {
      meta = JSON.parse(resultOutput);
    } catch {
      const metaPath = path.join(outputDir, `${sanitizedName}_meta.json`);
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } else {
        throw new Error('Failed to parse Sprite Forge output');
      }
    }

    return meta;
  }

  /**
   * Generates a new 2D Pixel Art pet with all 17 animation states via Agent Sprite Forge from a text prompt.
   */
  static async generatePetSprite(options: GenerateSpriteOptions): Promise<any> {
    const { prompt, name } = options;
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const outputDir = path.resolve(process.cwd(), 'public', 'sprites');

    const spec = {
      prompt,
      name: sanitizedName,
      outputDir
    };

    const meta = await this.runPythonGenerator(spec, sanitizedName, outputDir);

    // Save as unpublished PetType in DB so Admin can preview & configure frame slices
    const petType = await prisma.petType.upsert({
      where: { name: options.name },
      update: {
        description: options.description || options.prompt,
        spriteSheetUrl: meta.sheetUrl,
        previewUrl: meta.previewUrl,
        naturalAspectRatio: options.naturalAspectRatio || meta.naturalAspectRatio || 1.0,
        frameConfig: meta.frameConfig,
        animations: meta.animations,
        isActive: false // Stays unpublished until admin publishes it!
      },
      create: {
        name: options.name,
        description: options.description || options.prompt,
        unlockLevel: 1,
        isActive: false, // Unpublished by default
        spriteSheetUrl: meta.sheetUrl,
        previewUrl: meta.previewUrl,
        naturalAspectRatio: options.naturalAspectRatio || meta.naturalAspectRatio || 1.0,
        frameConfig: meta.frameConfig,
        animations: meta.animations
      }
    });

    return {
      petType,
      generatedMeta: meta
    };
  }

  /**
   * Generates a new 2D Pixel Art pet with all 17 animation states from an uploaded reference image.
   */
  static async generatePetFromImage(options: GenerateFromImageOptions): Promise<any> {
    const { imagePath, name, description } = options;
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const outputDir = path.resolve(process.cwd(), 'public', 'sprites');

    const spec = {
      imagePath,
      name: sanitizedName,
      outputDir,
      prompt: description || `Sinh từ hình ảnh: ${path.basename(imagePath)}`
    };

    const meta = await this.runPythonGenerator(spec, sanitizedName, outputDir);

    const petType = await prisma.petType.upsert({
      where: { name: options.name },
      update: {
        description: options.description || `Thú cưng pixel sinh từ ảnh ${name}`,
        spriteSheetUrl: meta.sheetUrl,
        previewUrl: meta.previewUrl,
        naturalAspectRatio: options.naturalAspectRatio || meta.naturalAspectRatio || 1.0,
        frameConfig: meta.frameConfig,
        animations: meta.animations,
        isActive: false
      },
      create: {
        name: options.name,
        description: options.description || `Thú cưng pixel sinh từ ảnh ${name}`,
        unlockLevel: 1,
        isActive: false,
        spriteSheetUrl: meta.sheetUrl,
        previewUrl: meta.previewUrl,
        naturalAspectRatio: options.naturalAspectRatio || meta.naturalAspectRatio || 1.0,
        frameConfig: meta.frameConfig,
        animations: meta.animations
      }
    });

    return {
      petType,
      generatedMeta: meta
    };
  }

  /**
   * Updates frame slicing configuration and FPS for animation states.
   */
  static async updateFrameConfig(
    typeId: string,
    frameConfig: Partial<FrameConfig>,
    animations: Partial<AnimationsMap>
  ) {
    const existing = await prisma.petType.findUnique({ where: { id: typeId } });
    if (!existing) {
      throw new Error('PetType not found');
    }

    const mergedFrameConfig = {
      ...(existing.frameConfig as any),
      ...frameConfig
    };

    const mergedAnimations = {
      ...(existing.animations as any),
      ...animations
    };

    return prisma.petType.update({
      where: { id: typeId },
      data: {
        frameConfig: mergedFrameConfig,
        animations: mergedAnimations
      }
    });
  }

  /**
   * Publishes or unpublishes a PetType for end users.
   */
  static async setPublished(typeId: string, isActive: boolean) {
    return prisma.petType.update({
      where: { id: typeId },
      data: { isActive }
    });
  }

  /**
   * Lists all PetTypes (filter by active status).
   */
  static async listPetTypes(includeUnpublished = false) {
    return prisma.petType.findMany({
      where: includeUnpublished ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}
