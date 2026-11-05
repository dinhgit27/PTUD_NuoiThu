import { AnimationState, UserPet } from './types';

type OverlayAction =
  | 'feed'
  | 'stroke'
  | 'drink'
  | 'levelUp'
  | 'openTimer'
  | 'hideOverlay'
  | 'showDashboard'
  | 'startRoaming'
  | 'stopRoaming'
  | 'stopMusic'
  | 'resumeBgm'
  | 'resumeMusic'
  | 'nextTrack'
  | 'prevTrack'
  | 'changeRoom'
  | 'navigateTab'
  | 'openModal'
  | 'changeScale'
  | 'petAction';
type WidgetPanel = 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null;

export interface AlarmData {
  completedMins: number;
  noteText?: string;
  clockTimeTriggered?: string;
  pet?: UserPet | null;
}

export type AlarmActionType = 'BREAK_5' | 'SNOOZE_5' | 'SHOW_DASHBOARD' | 'DISMISS';

interface OfficePetBridge {
  updatePet(pet: UserPet | null, speechBubble: string | null): void;
  setOverlayVisible(visible: boolean): void;
  popOutToDesktop(panel?: WidgetPanel): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  dragMove(dx: number, dy: number): void;
  resetPosition(): void;
  setWidgetPanel(panel: WidgetPanel): void;
  onPanelLayout(callback: (petSide: 'left' | 'right') => void): () => void;
  onOpenPanel(callback: (panel: WidgetPanel) => void): () => void;
  performPetAction(action: OverlayAction, payload?: any): void;
  showDashboard(): void;
  overlayReady(): void;
  onPetUpdate(callback: (state: { pet: UserPet | null; speechBubble: string | null }) => void): () => void;
  onPetAction(callback: (action: OverlayAction, payload?: any) => void): () => void;
  onOverlayVisibility(callback: (visible: boolean) => void): () => void;
  walkTo(targetX: number): void;
  stopWalking(): void;
  raiseAlarmNotification(alarmData: AlarmData): void;
  stopAlarmNotification(): void;
  onAlarmTriggered(callback: (alarmData: AlarmData) => void): () => void;
  onAlarmStopped(callback: () => void): () => void;
  onAlarmPopupData(callback: (alarmData: AlarmData) => void): () => void;
  performAlarmAction(action: AlarmActionType, payload?: any): void;
  dismissAlarmWindow(): void;
  onAlarmAction(callback: (action: AlarmActionType, payload?: any) => void): () => void;
  onWalkState(callback: (state: { isWalking: boolean; direction?: number }) => void): () => void;
}

declare global {
  interface Window {
    officePet?: OfficePetBridge;
  }
}

export {};
