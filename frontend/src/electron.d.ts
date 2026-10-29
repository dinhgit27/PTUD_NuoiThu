import { AnimationState, UserPet } from './types';

type OverlayAction = 'feed' | 'stroke' | 'drink' | 'levelUp' | 'openTimer' | 'hideOverlay';
type WidgetPanel = 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null;

interface OfficePetBridge {
  updatePet(pet: UserPet | null, speechBubble: string | null): void;
  setOverlayVisible(visible: boolean): void;
  setWidgetPanel(panel: WidgetPanel): void;
  onPanelLayout(callback: (petSide: 'left' | 'right') => void): () => void;
  performPetAction(action: OverlayAction): void;
  showDashboard(): void;
  overlayReady(): void;
  onPetUpdate(callback: (state: { pet: UserPet | null; speechBubble: string | null }) => void): () => void;
  onPetAction(callback: (action: OverlayAction) => void): () => void;
  onOverlayVisibility(callback: (visible: boolean) => void): () => void;
  walkTo(targetX: number): void;
  stopWalking(): void;
  onWalkState(callback: (state: { isWalking: boolean; direction?: number }) => void): () => void;
}

declare global {
  interface Window {
    officePet?: OfficePetBridge;
  }
}

export {};
