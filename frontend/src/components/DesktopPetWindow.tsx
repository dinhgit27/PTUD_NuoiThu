import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DesktopOverlay } from './DesktopOverlay';
import { AnimationState, UserPet } from '../types';
import { api } from '../services/api';

interface OverlayState {
  pet: UserPet | null;
  speechBubble: string | null;
}

const autonomousStates: AnimationState[] = [
  'HAPPY', 'DANCING', 'WAVING', 'TYPING', 'DRINKING'
];

export const DesktopPetWindow: React.FC = () => {
  const [overlay, setOverlay] = useState<OverlayState>({ pet: null, speechBubble: null });
  const [idleAnimation, setIdleAnimation] = useState<AnimationState | null>(null);
  const [petSide, setPetSide] = useState<'left' | 'right'>('right');
  const animationKeys = useMemo(
    () => Object.keys(overlay.pet?.petType?.animations || {}).join(','),
    [overlay.pet?.petType?.animations]
  );
  const handlePanelVisibilityChange = useCallback((panel: 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null) => {
    window.officePet?.setWidgetPanel(panel);
  }, []);

  useEffect(() => {
    const bridge = window.officePet;
    if (!bridge) return;
    const unsubscribe = bridge.onPetUpdate(next => {
      setOverlay(next);
      setIdleAnimation(null);
    });
    const unsubscribePanelLayout = bridge.onPanelLayout(setPetSide);
    bridge.overlayReady();
    return () => {
      unsubscribe();
      unsubscribePanelLayout();
    };
  }, []);

  useEffect(() => {
    const pet = overlay.pet;
    if (!pet || pet.currentState !== 'IDLE') {
      setIdleAnimation(null);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let clearAnimation: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const scheduleAnimation = () => {
      timer = setTimeout(() => {
        if (disposed) return;
        const available = autonomousStates.filter(state => pet.petType?.animations?.[state]?.frames?.length);
        if (available.length) {
          const next = available[Math.floor(Math.random() * available.length)];
          setIdleAnimation(next);
          clearAnimation = setTimeout(() => setIdleAnimation(null), 2500 + Math.random() * 2000);
        }
        scheduleAnimation();
      }, 5000 + Math.random() * 5000);
    };
    scheduleAnimation();

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (clearAnimation) clearTimeout(clearAnimation);
    };
  }, [overlay.pet?.id, overlay.pet?.currentState, animationKeys]);

  if (!overlay.pet) return <div className="h-screen w-screen bg-transparent" />;

  const pet = idleAnimation
    ? { ...overlay.pet, currentState: idleAnimation }
    : overlay.pet;
  const perform = (action: 'feed' | 'stroke' | 'drink' | 'levelUp' | 'openTimer' | 'hideOverlay') => {
    window.officePet?.performPetAction(action);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent select-none flex flex-col items-center justify-end pb-2">
      <DesktopOverlay
        pet={pet}
        isDesktopWindow={true}
        onFeed={() => perform('feed')}
        onStroke={() => perform('stroke')}
        onDrink={() => perform('drink')}
        onLevelUp={() => perform('levelUp')}
        onCloseOverlay={() => perform('hideOverlay')}
        onPetStateChange={state => {
          setIdleAnimation(state);
          void api.setPetState(state).catch(error => console.warn('Could not update the pet animation:', error));
          window.setTimeout(() => setIdleAnimation(null), 3500);
        }}
        onModeChange={mode => {
          setOverlay(current => current.pet
            ? { ...current, pet: { ...current.pet, currentMode: mode } }
            : current);
          void api.setPetMode(mode).catch(error => console.warn('Could not update the Pomodoro mode:', error));
        }}
        onSessionFinish={() => {
          void api.getPet().then(response => {
            setOverlay(current => ({ ...current, pet: response.data }));
          }).catch(error => console.warn('Could not refresh the pet after a Pomodoro session:', error));
        }}
        onTrackSelect={track => {
          setOverlay(current => ({ ...current, speechBubble: `Đang phát: ${track.title} 🎵` }));
          window.setTimeout(() => setOverlay(current => ({ ...current, speechBubble: null })), 3000);
        }}
        onPetInteraction={(state, message) => {
          setIdleAnimation(state);
          setOverlay(current => ({ ...current, speechBubble: message }));
          void api.setPetState(state).catch(error => console.warn('Could not update the pet interaction:', error));
          window.setTimeout(() => {
            setIdleAnimation(null);
            setOverlay(current => ({ ...current, speechBubble: null }));
          }, 3500);
        }}
        onPanelVisibilityChange={handlePanelVisibilityChange}
        petSide={petSide}
        speechBubble={overlay.speechBubble}
      />
    </div>
  );
};
