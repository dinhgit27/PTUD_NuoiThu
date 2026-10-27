export type AnimationState =
  // 11 Core Standard States
  | 'IDLE'
  | 'WALKING'
  | 'SLEEPING'
  | 'HUNGRY'
  | 'EATING'
  | 'DRINKING'
  | 'TYPING'
  | 'PETTING'
  | 'HAPPY'
  | 'SAD'
  | 'DANCING'
  | 'WAVING'
  // Legacy states (backward compatible)
  | 'WAKING_UP'
  | 'YAWNING'
  | 'EXERCISING'
  | 'THANKING'
  | 'CELEBRATING'
  | 'EVOLVING';

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

export interface AnimationConfig {
  row: number;
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface PetType {
  id: string;
  name: string;
  description?: string;
  unlockLevel: number;
  isActive: boolean;
  isShopEnabled: boolean;
  isPurchaseRequired: boolean;
  expPrice: number;
  spriteSheetUrl: string;
  previewUrl?: string;
  naturalAspectRatio: number;
  frameConfig: FrameConfig;
  animations: Record<string, AnimationConfig>;
}

export interface UserPet {
  id: string;
  userId: string;
  typeId: string;
  name: string;
  level: number;
  exp: number;
  hunger: number;
  happiness: number;
  health: number;
  currentState: AnimationState;
  currentMode: 'STRICT' | 'RELAXED';
  dailyInteractionsLeft: number;
  positionX?: number;
  positionY?: number;
  scaleSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  isHidden: boolean;
  petType?: PetType;
  userItems?: UserItem[];
  nextLevelExp?: number;
  expProgress?: number;
}

export interface PetSheetConfig {
  spriteSheetUrl: string;
  frameConfig: FrameConfig;
  animations: Record<string, AnimationConfig>;
}

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  itemType: string;
  imageUrl: string;
  rarity: string;
  expPrice: number;
  isAvailable?: boolean;
  equipSlot?: 'AUTO' | 'HEAD' | 'BODY' | 'HAND' | 'FEET' | 'AURA';
  effect?: 'NONE' | 'BOUNCE' | 'FLOAT' | 'SPARKLE' | 'GLOW' | 'HEARTS' | 'EXP_BOOST';
  effectValue?: number;
  spriteSheetUrl?: string | null;
  frameConfig?: FrameConfig | null;
  animations?: Record<string, AnimationConfig> | null;
  petTypeId?: string | null;
  compatiblePetIds?: string[] | null;
  petSheets?: Record<string, PetSheetConfig> | null;
}

export interface UserItem {
  id: string;
  itemId: string;
  petId?: string | null;
  quantity: number;
  isEquipped: boolean;
  item: ShopItem;
}

export interface UserPreference {
  id: string;
  userId: string;
  favMusicGenre?: string;
  selectedMusicTrack?: any;
  petPersona: string;
  quietMode: boolean;
  dndStartTime?: string;
  dndEndTime?: string;
  soundEnabled: boolean;
  aiLearningEnabled: boolean;
  hydrationInterval: number;
  postureInterval: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'USER';
  deptId?: string | null;
  department?: Department | null;
  organization?: { id: string; name: string; domain: string };
  userPet?: UserPet;
  preference?: UserPreference;
}

export interface Department {
  id: string;
  name: string;
  inviteCode?: string;
  gardenLevel?: number;
  gardenExp?: number;
  background?: GardenBackground;
}

export interface GardenBackground {
  id: string;
  name: string;
  imageUrl: string;
  animationFrames?: number;
  animationFps?: number;
  animationColumns?: number;
  animationRows?: number;
  thumbnailUrl?: string;
  description?: string;
  expPrice: number;
  isRecommended: boolean;
  isActive: boolean;
}

export interface SharedGardenData {
  departmentId: string;
  departmentName: string;
  gardenLevel: number;
  gardenExp: number;
  expNeededForNextLevel: number;
  expProgress: number;
  buffMultiplier: number;
  background: GardenBackground;
  pets: Array<{
    id: string;
    name: string;
    level: number;
    ownerId: string;
    ownerName: string;
    ownerAvatar?: string;
    currentState: AnimationState;
    currentMode: string;
    positionX?: number;
    positionY?: number;
    petType?: PetType;
    isCurrentUsersPet: boolean;
  }>;
}

export interface LofiTrack {
  id: string;
  youtubeId?: string;
  title: string;
  artist: string;
  category: string;
  duration: string;
  streamUrl: string;
  coverUrl?: string;
}

export interface MusicRequest {
  query: string;
  autoPlay: boolean;
  requestId: number;
}

export interface ChatMessage {
  id?: string;
  sender: 'user' | 'pet';
  text: string;
  timestamp: string;
  isComfortMode?: boolean;
  suggestion?: {
    type: string;
    title: string;
    description: string;
    durationMinutes: number;
  };
}

export type QuestCategory = 'DAILY' | 'WEEKLY' | 'SPECIAL';
export type QuestActionType = 'FEED' | 'DRINK' | 'STROKE' | 'POMODORO' | 'CHAT' | 'MUSIC' | 'GARDEN';

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  actionType: QuestActionType;
  targetCount: number;
  rewardExp: number;
  rewardCoins?: number;
  rewardItemId?: string | null;
  rewardItem?: ShopItem | null;
  isActive?: boolean;
  progress?: number;
  isCompleted?: boolean;
  isClaimed?: boolean;
  claimedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    userQuests: number;
  };
}

