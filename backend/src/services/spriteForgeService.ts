import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

const prisma = new PrismaClient();

export interface GenerateSpriteOptions {
  prompt: string;
  name: string;
  description?: string;
  naturalAspectRatio?: number;
}

export interface ImportedSpriteSheetOptions {
  imagePath: string;
  sheetUrl: string;
  name: string;
  allowMissingStateFallback?: boolean;
}

export class SpriteSheetValidationError extends Error {}

export interface FrameConfig {
  frameWidth: number;
  frameHeight: number;
  totalColumns: number;
  totalRows: number;
  totalFrames: number;
  framesPerState?: number;
  activeFramesCount?: number;
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
  sourceRowCount?: number | null;
  alignmentWarning?: string | null;
  backgroundRemoved?: boolean;
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
    let scriptPath = path.resolve(process.cwd(), 'scripts', 'generate_sprite_forge.py');
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(process.cwd(), 'backend', 'scripts', 'generate_sprite_forge.py');
    }
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(__dirname, '../../scripts/generate_sprite_forge.py');
    }
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
        },
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
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
    const sanitizedName = name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
    const outputDir = path.resolve(process.cwd(), 'public', 'sprites');

    // Use Google Gemini AI to analyze and enrich the prompt if GEMINI_API_KEY is available
    let enrichedPrompt = prompt;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        const aiPrompt = `You are a 2D pixel art character designer. Analyze this user prompt: "${prompt}". Identify the animal species (e.g. husky, penguin, cat, corgi, rabbit, sheep, panda, dragon, fox, hamster, duck, pig, pigeon), accessories, and color palette. Reply with a short English description like "husky, grey fur, blue eyes".`;
        const aiRes = await ai.models.generateContent({
          model: modelName,
          contents: aiPrompt
        });
        const replyText = aiRes.text?.trim() || '';
        if (replyText) {
          enrichedPrompt = `${prompt}, ${replyText}`;
        }
      } catch (err: any) {
        console.warn('Gemini prompt enrichment notice:', err?.message);
      }
    }

    const spec = {
      prompt: enrichedPrompt,
      name: sanitizedName,
      outputDir
    };

    const meta = await this.runPythonGenerator(spec, sanitizedName, outputDir);

    // Save as unpublished PetType in DB so Admin can preview & configure frame slices
    const frameConfigStr = typeof meta.frameConfig === 'string' ? meta.frameConfig : JSON.stringify(meta.frameConfig);
    const animationsStr = typeof meta.animations === 'string' ? meta.animations : JSON.stringify(meta.animations);

    const petType = await prisma.petType.upsert({
      where: { name: options.name },
      update: {
        description: options.description || options.prompt,
        spriteSheetUrl: meta.sheetUrl,
        previewUrl: meta.previewUrl,
        naturalAspectRatio: options.naturalAspectRatio || meta.naturalAspectRatio || 1.0,
        frameConfig: frameConfigStr,
        animations: animationsStr,
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
        frameConfig: frameConfigStr,
        animations: animationsStr
      }
    });

    return {
      petType: SpriteForgeService.parsePetTypeMeta(petType),
      generatedMeta: meta
    };
  }

  static async inspectSpriteSheet(options: ImportedSpriteSheetOptions) {
    const sanitizedName = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outputDir = path.resolve(process.cwd(), 'public', 'sprites');
    const meta = await this.runPythonGenerator({
      action: 'inspect_sprite_sheet',
      imagePath: options.imagePath,
      sheetUrl: options.sheetUrl,
      name: sanitizedName,
      outputDir,
      allowMissingStateFallback: options.allowMissingStateFallback || false
    }, sanitizedName, outputDir);

    if (typeof meta?.error === 'string') {
      throw new SpriteSheetValidationError(meta.error);
    }
    return meta;
  }

  static async importPetSpriteSheet(
    options: ImportedSpriteSheetOptions & { description?: string }
  ) {
    const generatedMeta = await this.inspectSpriteSheet({
      ...options,
      allowMissingStateFallback: true
    });
    const description = options.description?.trim() || 'Thú cưng nhập từ sprite sheet 17 trạng thái.';
    const frameConfigStr = typeof generatedMeta.frameConfig === 'string' ? generatedMeta.frameConfig : JSON.stringify(generatedMeta.frameConfig);
    const animationsStr = typeof generatedMeta.animations === 'string' ? generatedMeta.animations : JSON.stringify(generatedMeta.animations);

    const petType = await prisma.petType.upsert({
      where: { name: options.name },
      update: {
        description,
        spriteSheetUrl: generatedMeta.sheetUrl,
        previewUrl: generatedMeta.previewUrl,
        naturalAspectRatio: generatedMeta.naturalAspectRatio,
        frameConfig: frameConfigStr,
        animations: animationsStr,
        isActive: false
      },
      create: {
        name: options.name,
        description,
        unlockLevel: 1,
        isActive: false,
        spriteSheetUrl: generatedMeta.sheetUrl,
        previewUrl: generatedMeta.previewUrl,
        naturalAspectRatio: generatedMeta.naturalAspectRatio,
        frameConfig: frameConfigStr,
        animations: animationsStr
      }
    });

    return { petType: SpriteForgeService.parsePetTypeMeta(petType), generatedMeta };
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

    const existingFrameConfig = typeof existing.frameConfig === 'string'
      ? JSON.parse(existing.frameConfig)
      : (existing.frameConfig || {});
    const existingAnimations = typeof existing.animations === 'string'
      ? JSON.parse(existing.animations)
      : (existing.animations || {});

    const mergedFrameConfig = {
      ...existingFrameConfig,
      ...frameConfig
    };

    const mergedAnimations = {
      ...existingAnimations,
      ...animations
    };

    const updated = await prisma.petType.update({
      where: { id: typeId },
      data: {
        frameConfig: JSON.stringify(mergedFrameConfig),
        animations: JSON.stringify(mergedAnimations)
      }
    });

    return SpriteForgeService.parsePetTypeMeta(updated);
  }

  /**
   * Publishes or unpublishes a PetType for end users.
   */
  static async setPublished(typeId: string, isActive: boolean) {
    const updated = await prisma.petType.update({
      where: { id: typeId },
      data: { isActive }
    });
    return SpriteForgeService.parsePetTypeMeta(updated);
  }

  /**
   * Lists all PetTypes (filter by active status).
   */
  static async listPetTypes(includeUnpublished = false) {
    const list = await prisma.petType.findMany({
      where: includeUnpublished ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    return list.map(item => SpriteForgeService.parsePetTypeMeta(item));
  }

  /**
   * Cleans background of an arbitrary uploaded image using smart_bg_remover.py
   */
  static async removeImageBackground(imagePath: string, isSheet = false): Promise<string> {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'smart_bg_remover.py');
    const outputPath = imagePath.endsWith('.png') ? imagePath : imagePath.replace(/\.[^.]+$/, '.png');
    const cmd = `python "${scriptPath}" --input "${imagePath}" --output "${outputPath}" ${isSheet ? '--is-sheet' : ''}`;
    
    await new Promise<void>((resolve) => {
      exec(cmd, { env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } }, (error, _stdout, stderr) => {
        if (error) {
          console.warn('Smart background remover warning:', stderr || error.message);
          return resolve();
        }
        if (outputPath !== imagePath && fs.existsSync(outputPath) && fs.existsSync(imagePath)) {
          try { fs.unlinkSync(imagePath); } catch {}
        }
        resolve();
      });
    });

    return outputPath;
  }

  /**
   * Helper to parse JSON fields for PetType objects.
   */
  static parsePetTypeMeta(petType: any) {
    if (!petType) return petType;
    return {
      ...petType,
      frameConfig: typeof petType.frameConfig === 'string'
        ? JSON.parse(petType.frameConfig)
        : petType.frameConfig,
      animations: typeof petType.animations === 'string'
        ? JSON.parse(petType.animations)
        : petType.animations,
    };
  }
}
