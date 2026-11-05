import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopOverlay } from './DesktopOverlay';
import { AnimationState, MusicRequest, UserPet } from '../types';
import { api } from '../services/api';
import { PET_RESPONSES } from '../utils/petResponses';
import { formatCleanSongTitle } from '../utils/songFormatter';

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
  const [musicRequest, setMusicRequest] = useState<MusicRequest | undefined>();
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animationKeys = useMemo(
    () => Object.keys(overlay.pet?.petType?.animations || {}).join(','),
    [overlay.pet?.petType?.animations]
  );

  const handlePanelVisibilityChange = useCallback((panel: 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null) => {
    window.officePet?.setWidgetPanel(panel);
  }, []);

  const showQuickFeedback = useCallback((state: AnimationState, bubbleText: string, durationMs = 4200) => {
    setIdleAnimation(state);
    setOverlay(current => ({ ...current, speechBubble: bubbleText }));
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      setOverlay(current => ({ ...current, speechBubble: null }));
    }, durationMs);
    if (state !== 'TYPING' && state !== 'DANCING' && state !== 'SLEEPING') {
      animTimerRef.current = setTimeout(() => {
        setIdleAnimation(null);
        setOverlay(current => ({
          ...current,
          pet: current.pet ? { ...current.pet, currentState: 'IDLE' } : null
        }));
        void api.setPetState('IDLE').catch(() => {});
      }, durationMs);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('desktop-pet-window');
    document.body.classList.add('desktop-pet-window');

    const bridge = window.officePet;
    if (!bridge) return;

    const unsubscribe = bridge.onPetUpdate(next => {
      setOverlay(prev => ({
        pet: next.pet,
        speechBubble: next.speechBubble ?? prev.speechBubble
      }));
      if (next.pet && next.pet.currentState !== 'IDLE') {
        setIdleAnimation(null);
      }
    });
    const unsubscribePanelLayout = bridge.onPanelLayout(setPetSide);
    bridge.overlayReady();

    // Fallback: if dashboardWindow hasn't synced pet yet, fetch directly from API
    const fallbackTimer = setTimeout(() => {
      setOverlay(current => {
        if (!current.pet && localStorage.getItem('officepet_token')) {
          api
            .getPet()
            .then(res => {
              if (res.data) {
                setOverlay(prev => ({ ...prev, pet: res.data }));
                bridge.updatePet(res.data, null);
              }
            })
            .catch(() => {});
        }
        return current;
      });
    }, 600);

    return () => {
      clearTimeout(fallbackTimer);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      unsubscribe();
      unsubscribePanelLayout();
      document.documentElement.classList.remove('desktop-pet-window');
      document.body.classList.remove('desktop-pet-window');
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
      // Direction 1: Relaxed resting period (30s - 60s) so pet peacefully rests in IDLE
      timer = setTimeout(() => {
        if (disposed) return;
        if (
          overlay.pet?.currentState !== 'IDLE' ||
          idleAnimation === 'TYPING' ||
          idleAnimation === 'DANCING' ||
          idleAnimation === 'SLEEPING'
        ) {
          scheduleAnimation();
          return;
        }
        const available = autonomousStates.filter(state => pet.petType?.animations?.[state]?.frames?.length);
        if (available.length) {
          const next = available[Math.floor(Math.random() * available.length)];
          const animConfig = pet.petType?.animations?.[next];
          const frameCount = animConfig?.frames?.length || 4;
          const fps = animConfig?.fps || 6;

          // Align animation duration with full loop cycles to prevent jarring mid-action snapping.
          // Give sustained actions proper natural durations:
          const singleCycleMs = Math.max(300, (frameCount / fps) * 1000);
          const targetBaseDuration =
            next === 'TYPING' ? 12000 :
            next === 'DRINKING' || next === 'EATING' ? 6000 :
            next === 'EXERCISING' ? 8000 : 3500;
          const targetCycles = Math.max(2, Math.round(targetBaseDuration / singleCycleMs));
          const totalDurationMs = targetCycles * singleCycleMs;

          setIdleAnimation(next);
          clearAnimation = setTimeout(() => {
            if (!disposed) setIdleAnimation(null);
          }, totalDurationMs);
        }
        scheduleAnimation();
      }, 30000 + Math.random() * 30000);
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

  const perform = (action: 'feed' | 'stroke' | 'drink' | 'levelUp' | 'openTimer' | 'hideOverlay' | 'stopMusic' | 'resumeBgm') => {
    window.officePet?.performPetAction(action);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent select-none flex flex-col justify-end">
      <DesktopOverlay
        pet={pet}
        isDesktopWindow={true}
        onFeed={() => {
          showQuickFeedback('EATING', PET_RESPONSES.feed.bubble, 4500);
          perform('feed');
        }}
        onStroke={() => {
          showQuickFeedback('PETTING', PET_RESPONSES.stroke.bubble, 4000);
          perform('stroke');
        }}
        onDrink={() => {
          showQuickFeedback('DRINKING', PET_RESPONSES.drink.bubble, 4000);
          perform('drink');
        }}
        onLevelUp={() => {
          showQuickFeedback('EVOLVING', '✨ Đang kiểm tra bể kinh nghiệm để thăng cấp...', 4500);
          perform('levelUp');
        }}
        onCloseOverlay={() => perform('hideOverlay')}
        onStopMusic={() => perform('stopMusic')}
        onResumeBgm={() => perform('resumeBgm')}
        externalMusicRequest={musicRequest}
        onOpenQuests={() => {
          window.officePet?.performPetAction('navigateTab', 'QUESTS');
          window.officePet?.showDashboard();
        }}
        onPetStateChange={state => {
          setIdleAnimation(state === 'IDLE' ? null : state);
          void api.setPetState(state).catch(error => console.warn('Could not update the pet animation:', error));
          if (state !== 'TYPING' && state !== 'DANCING' && state !== 'SLEEPING' && state !== 'IDLE') {
            window.setTimeout(() => {
              setIdleAnimation(null);
              setOverlay(current => ({
                ...current,
                pet: current.pet ? { ...current.pet, currentState: 'IDLE' } : null
              }));
              void api.setPetState('IDLE').catch(() => {});
            }, 3500);
          }
        }}
        onModeChange={mode => {
          setOverlay(current =>
            current.pet
              ? { ...current, pet: { ...current.pet, currentMode: mode } }
              : current
          );
          void api.setPetMode(mode).catch(error => console.warn('Could not update the Pomodoro mode:', error));
        }}
        onSessionFinish={() => {
          showQuickFeedback('CELEBRATING', '🎉 Hoàn thành phiên tập trung xuất sắc!', 5000);
          void api
            .getPet()
            .then(response => {
              setOverlay(current => ({ ...current, pet: response.data }));
              window.officePet?.updatePet(response.data, '🎉 Hoàn thành phiên tập trung xuất sắc!');
            })
            .catch(error => console.warn('Could not refresh the pet after a Pomodoro session:', error));
        }}
        onTrackSelect={track => {
          const clean = formatCleanSongTitle(track.title);
          showQuickFeedback('DANCING', `🎵 Đang phát: ${clean}`, 4000);
        }}
        onPetInteraction={(state, message) => {
          if (state === 'SLEEPING') {
            setOverlay(current => ({
              ...current,
              pet: current.pet ? { ...current.pet, currentState: state } : null,
              speechBubble: message
            }));
            setIdleAnimation(state);
            void api.setPetState(state).catch(error => console.warn('Could not update the pet interaction:', error));
          } else {
            showQuickFeedback(state, message, 4200);
            void api.setPetState(state).catch(error => console.warn('Could not update the pet interaction:', error));
          }
        }}
        onPanelVisibilityChange={handlePanelVisibilityChange}
        petSide={petSide}
        speechBubble={overlay.speechBubble}
      />
    </div>
  );
};
