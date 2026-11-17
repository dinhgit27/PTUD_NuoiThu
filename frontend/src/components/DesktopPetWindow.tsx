import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopOverlay } from './DesktopOverlay';
import { AnimationState, MusicRequest, UserPet } from '../types';
import { api } from '../services/api';
import { PET_RESPONSES } from '../utils/petResponses';
import { formatCleanSongTitle } from '../utils/songFormatter';
import { setActiveAddressing } from '../utils/petAddressing';

interface OverlayState {
  pet: UserPet | null;
  speechBubble: string | null;
}

// Gentle, non-distracting idle expressions (avoid popping up desks/dancing randomly)
const gentleIdleStates: AnimationState[] = ['WAVING', 'HAPPY'];

export const DesktopPetWindow: React.FC = () => {
  const [overlay, setOverlay] = useState<OverlayState>({ pet: null, speechBubble: null });
  const [idleAnimation, setIdleAnimation] = useState<AnimationState | null>(null);
  const [petSide, setPetSide] = useState<'left' | 'right'>('right');
  const [musicRequest, setMusicRequest] = useState<MusicRequest | undefined>();
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleAnimationRef = useRef<AnimationState | null>(null);
  idleAnimationRef.current = idleAnimation;

  const animationKeys = useMemo(
    () => Object.keys(overlay.pet?.petType?.animations || {}).join(','),
    [overlay.pet?.petType?.animations]
  );

  const handlePanelVisibilityChange = useCallback((panel: 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null) => {
    window.officePet?.setWidgetPanel(panel);
  }, []);

  const showQuickFeedback = useCallback((state: AnimationState, bubbleText: string, durationMs = 7000) => {
    // 1. Immediately halt any roaming movement so animation displays cleanly
    window.officePet?.performPetAction('stopRoaming');
    window.officePet?.performPetAction('petAction', state);

    setIdleAnimation(state);
    setOverlay(current => ({
      ...current,
      pet: current.pet ? { ...current.pet, currentState: state } : null,
      speechBubble: bubbleText
    }));

    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);

    bubbleTimerRef.current = setTimeout(() => {
      setOverlay(current => ({ ...current, speechBubble: null }));
    }, Math.min(durationMs, 5000));

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
      if (next.addressing) {
        setActiveAddressing(next.addressing, false);
      }
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      setIdleAnimation(null);
      setOverlay(prev => ({
        pet: next.pet,
        speechBubble: next.speechBubble ?? prev.speechBubble
      }));
    });
    const fetchPetIfAuthenticated = () => {
      if (!localStorage.getItem('officepet_token')) return;
      api
        .getPet()
        .then(res => {
          if (res.data) {
            setOverlay(prev => (prev.pet ? prev : { ...prev, pet: res.data }));
            bridge.updatePet(res.data, null);
          }
        })
        .catch(() => {});
    };

    const unsubscribePanelLayout = bridge.onPanelLayout(setPetSide);
    const unsubscribeVisibility = bridge.onOverlayVisibility(visible => {
      if (visible) {
        fetchPetIfAuthenticated();
      }
    });
    bridge.overlayReady();

    // Immediate fetch if pet data isn't received from dashboardWindow yet
    fetchPetIfAuthenticated();

    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      unsubscribe();
      unsubscribePanelLayout();
      unsubscribeVisibility();
      document.documentElement.classList.remove('desktop-pet-window');
      document.body.classList.remove('desktop-pet-window');
    };
  }, []);

  useEffect(() => {
    const pet = overlay.pet;
    if (!pet || pet.currentState !== 'IDLE') {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let clearAnimation: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const scheduleGentleExpression = () => {
      timer = setTimeout(() => {
        if (disposed) return;
        if (!idleAnimationRef.current) {
          const available = gentleIdleStates.filter(state => pet.petType?.animations?.[state]?.frames?.length);
          if (available.length) {
            const next = available[Math.floor(Math.random() * available.length)];
            setIdleAnimation(next);
            clearAnimation = setTimeout(() => {
              if (!disposed) setIdleAnimation(null);
            }, 3000);
          }
        }
        scheduleGentleExpression();
      }, 25000 + Math.random() * 20000);
    };
    scheduleGentleExpression();

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (clearAnimation) clearTimeout(clearAnimation);
    };
  }, [overlay.pet?.id, overlay.pet?.currentState, animationKeys]);

  const handlePetStateChange = useCallback((state: AnimationState) => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setIdleAnimation(state === 'IDLE' ? null : state);
    setOverlay(current => ({
      ...current,
      pet: current.pet ? { ...current.pet, currentState: state } : null
    }));
    window.officePet?.performPetAction('petAction', state);
    void api.setPetState(state).catch(error => console.warn('Could not update the pet animation:', error));
    if (state !== 'TYPING' && state !== 'DANCING' && state !== 'SLEEPING' && state !== 'IDLE') {
      animTimerRef.current = setTimeout(() => {
        setIdleAnimation(null);
        setOverlay(current => ({
          ...current,
          pet: current.pet ? { ...current.pet, currentState: 'IDLE' } : null
        }));
        void api.setPetState('IDLE').catch(() => {});
      }, 5000);
    }
  }, []);

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
          showQuickFeedback('EATING', PET_RESPONSES.feed.bubble, 3500);
          perform('feed');
        }}
        onStroke={() => {
          showQuickFeedback('PETTING', PET_RESPONSES.stroke.bubble, 4000);
          perform('stroke');
        }}
        onDrink={() => {
          showQuickFeedback('DRINKING', PET_RESPONSES.drink.bubble, 3500);
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
        onPetStateChange={handlePetStateChange}
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
          window.officePet?.performPetAction('stopRoaming');
          window.officePet?.performPetAction('petAction', state);

          if (state === 'SLEEPING' || state === 'TYPING' || state === 'DANCING') {
            if (animTimerRef.current) clearTimeout(animTimerRef.current);
            if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
            setOverlay(current => ({
              ...current,
              pet: current.pet ? { ...current.pet, currentState: state } : null,
              speechBubble: message
            }));
            setIdleAnimation(state);
            bubbleTimerRef.current = setTimeout(() => {
              setOverlay(current => ({ ...current, speechBubble: null }));
            }, 5000);
            void api.setPetState(state).catch(error => console.warn('Could not update the pet interaction:', error));
          } else if (state === 'IDLE') {
            if (animTimerRef.current) clearTimeout(animTimerRef.current);
            setIdleAnimation(null);
            setOverlay(current => ({
              ...current,
              pet: current.pet ? { ...current.pet, currentState: 'IDLE' } : null,
              speechBubble: message
            }));
            void api.setPetState('IDLE').catch(() => {});
          } else {
            const duration = state === 'EXERCISING' ? 10000 : 7000;
            showQuickFeedback(state, message, duration);
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
