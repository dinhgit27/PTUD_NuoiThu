import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Clock3,
  Search,
  Heart,
  SkipBack,
  SkipForward,
  Radio,
  Sparkles,
  Headphones,
  Maximize2,
  Minimize2,
  Tv,
  History,
  ListMusic,
  Trash2,
  ExternalLink,
  X
} from 'lucide-react';
import { Howl } from 'howler';
import { api } from '../services/api';
import { LofiTrack, MusicRequest, UserPet, AnimationState } from '../types';
import { PixelPetCanvas } from './PixelPetCanvas';

export interface WatchedTrackItem extends LofiTrack {
  watchedAt?: string;
}

interface MusicPlayerProps {
  onTrackSelect?: (track: LofiTrack) => void;
  compact?: boolean;
  fillPanel?: boolean;
  request?: MusicRequest;
  historyScope?: string;
  petName?: string;
  pet?: UserPet | null;
  isMinimizedToPet?: boolean;
  onExpandToMusicTab?: () => void;
  onPlayingStateChange?: (isPlayingYoutube: boolean) => void;
}

const searchHistoryKey = (scope: string) => `officepet_music_search_history_${scope}`;
const listenHistoryKey = (scope: string) => `officepet_music_listen_history_${scope}`;
const favoriteTracksKey = (scope: string) => `officepet_music_fav_tracks_${scope}`;

function readSearchHistory(scope: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, 10)
      : ['Lofi hip hop chill', 'Nhạc Baroque tập trung', 'Sơn Tùng M-TP'];
  } catch {
    return ['Lofi hip hop chill', 'Nhạc Baroque tập trung', 'Sơn Tùng M-TP'];
  }
}

function readListenHistory(scope: string): WatchedTrackItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(listenHistoryKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (track): track is WatchedTrackItem =>
              track && typeof track.id === 'string' && typeof track.title === 'string'
          )
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

function readFavoriteTracks(scope: string): LofiTrack[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(favoriteTracksKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (track): track is LofiTrack =>
            track && typeof track.id === 'string' && typeof track.title === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  onTrackSelect,
  compact = false,
  fillPanel = false,
  request,
  historyScope = 'default',
  petName = 'Mochi Neko',
  pet,
  isMinimizedToPet = false,
  onExpandToMusicTab,
  onPlayingStateChange
}) => {
  const [tracks, setTracks] = useState<LofiTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<LofiTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [activeLibraryTab, setActiveLibraryTab] = useState<'TRACKS' | 'FAVORITES' | 'HISTORY'>('TRACKS');
  const [searchError, setSearchError] = useState('');

  // Per-account persisted states
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory(historyScope));
  const [listenHistory, setListenHistory] = useState<WatchedTrackItem[]>(() => readListenHistory(historyScope));
  const [favoriteTracks, setFavoriteTracks] = useState<LofiTrack[]>(() => readFavoriteTracks(historyScope));

  // Theater / Cinema width mode & Pet companion watching posture
  const [isCinemaWide, setIsCinemaWide] = useState(false);
  const [petWatchPose, setPetWatchPose] = useState<AnimationState>('IDLE');
  const [floatingPetPos, setFloatingPetPos] = useState<{ x: number; y: number }>({ x: 24, y: 16 });
  const [isDraggingMiniTv, setIsDraggingMiniTv] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const soundRef = useRef<Howl | null>(null);
  const youtubeFrameRef = useRef<HTMLIFrameElement>(null);
  const lastHandledRequestId = useRef<number | undefined>(undefined);
  const hasLoadedInitial = useRef(false);

  // Notify parent when YouTube video is actively playing (so floating TV + Pet knows when to appear)
  useEffect(() => {
    onPlayingStateChange?.(Boolean(isPlaying && currentTrack?.youtubeId));
  }, [isPlaying, currentTrack?.youtubeId, onPlayingStateChange]);

  // Sync per-account library from localStorage AND Backend DB when historyScope (userId) changes
  useEffect(() => {
    setSearchHistory(readSearchHistory(historyScope));
    setListenHistory(readListenHistory(historyScope));
    setFavoriteTracks(readFavoriteTracks(historyScope));

    if (historyScope && historyScope !== 'default' && historyScope !== 'guest') {
      api
        .getMusicLibrary()
        .then(res => {
          if (res.data) {
            if (Array.isArray(res.data.watchHistory) && res.data.watchHistory.length > 0) {
              setListenHistory(res.data.watchHistory);
              localStorage.setItem(listenHistoryKey(historyScope), JSON.stringify(res.data.watchHistory));
            }
            if (Array.isArray(res.data.favoriteTracks) && res.data.favoriteTracks.length > 0) {
              setFavoriteTracks(res.data.favoriteTracks);
              localStorage.setItem(favoriteTracksKey(historyScope), JSON.stringify(res.data.favoriteTracks));
            }
            if (Array.isArray(res.data.searchHistory) && res.data.searchHistory.length > 0) {
              setSearchHistory(res.data.searchHistory);
              localStorage.setItem(searchHistoryKey(historyScope), JSON.stringify(res.data.searchHistory));
            }
          }
        })
        .catch(() => {});
    }
  }, [historyScope]);

  const syncLibraryToBackend = useCallback(
    (nextHistory?: WatchedTrackItem[], nextFavs?: LofiTrack[], nextSearches?: string[]) => {
      if (!historyScope || historyScope === 'default' || historyScope === 'guest') return;
      api
        .saveMusicLibrary({
          watchHistory: nextHistory ?? listenHistory,
          favoriteTracks: nextFavs ?? favoriteTracks,
          searchHistory: nextSearches ?? searchHistory
        })
        .catch(() => {});
    },
    [favoriteTracks, historyScope, listenHistory, searchHistory]
  );

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, []);

  // Dragging support for Floating Mini-TV + Pet widget
  useEffect(() => {
    if (!isDraggingMiniTv) return;
    const handleMove = (e: MouseEvent) => {
      const nextX = Math.max(12, Math.min(window.innerWidth - 360, e.clientX - dragOffsetRef.current.dx));
      const nextY = Math.max(12, Math.min(window.innerHeight - 360, window.innerHeight - e.clientY - dragOffsetRef.current.dy));
      setFloatingPetPos({ x: nextX, y: nextY });
    };
    const handleUp = () => setIsDraggingMiniTv(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingMiniTv]);

  const saveSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized || normalized.startsWith('__')) return;
    setSearchHistory(current => {
      const next = [normalized, ...current.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 10);
      try {
        localStorage.setItem(searchHistoryKey(historyScope), JSON.stringify(next));
      } catch {
        // Ignore
      }
      syncLibraryToBackend(undefined, undefined, next);
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(searchHistoryKey(historyScope));
    } catch {
      // Ignore
    }
    syncLibraryToBackend(undefined, undefined, []);
  };

  const clearWatchHistory = () => {
    setListenHistory([]);
    try {
      localStorage.removeItem(listenHistoryKey(historyScope));
    } catch {
      // Ignore
    }
    syncLibraryToBackend([], undefined, undefined);
  };

  const removeHistoryItem = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setListenHistory(prev => {
      const next = prev.filter(item => item.id !== trackId);
      try {
        localStorage.setItem(listenHistoryKey(historyScope), JSON.stringify(next));
      } catch {
        // Ignore
      }
      syncLibraryToBackend(next, undefined, undefined);
      return next;
    });
  };

  const isTrackFavorite = (trackId: string) => favoriteTracks.some(t => t.id === trackId);

  const toggleFavoriteTrack = (track: LofiTrack, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteTracks(prev => {
      const exists = prev.some(item => item.id === track.id);
      const next = exists ? prev.filter(item => item.id !== track.id) : [track, ...prev];
      try {
        localStorage.setItem(favoriteTracksKey(historyScope), JSON.stringify(next));
      } catch {
        // Ignore
      }
      syncLibraryToBackend(undefined, next, undefined);
      return next;
    });
  };

  function playTrack(track: LofiTrack) {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
      soundRef.current = null;
    }

    const watchedEntry: WatchedTrackItem = {
      ...track,
      watchedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setCurrentTrack(track);
    setListenHistory(current => {
      const next = [watchedEntry, ...current.filter(item => item.id !== track.id)].slice(0, 30);
      try {
        localStorage.setItem(listenHistoryKey(historyScope), JSON.stringify(next));
      } catch {
        // Ignore
      }
      syncLibraryToBackend(next, undefined, undefined);
      return next;
    });

    if (track.youtubeId) {
      setIsPlaying(true);
      api.selectMusic(track).catch(() => {});
      onTrackSelect?.(track);
      return;
    }

    const sound = new Howl({
      src: [track.streamUrl],
      html5: true,
      volume: isMuted ? 0 : volume,
      onend: () => {
        setIsPlaying(false);
      }
    });

    soundRef.current = sound;
    sound.play();
    setIsPlaying(true);

    api.selectMusic(track).catch(() => {});
    onTrackSelect?.(track);
  }

  const playNext = useCallback(() => {
    const activePool =
      activeLibraryTab === 'FAVORITES' && favoriteTracks.length > 0
        ? favoriteTracks
        : activeLibraryTab === 'HISTORY' && listenHistory.length > 0
        ? listenHistory
        : tracks;

    if (activePool.length === 0) {
      void fetchTracks('nhạc lofi chill học bài', true);
      return;
    }
    const currentIndex = activePool.findIndex(t => t.id === currentTrack?.id);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % activePool.length : 0;
    playTrack(activePool[nextIndex]);
  }, [activeLibraryTab, currentTrack?.id, favoriteTracks, listenHistory, tracks]);

  const playPrev = useCallback(() => {
    const activePool =
      activeLibraryTab === 'FAVORITES' && favoriteTracks.length > 0
        ? favoriteTracks
        : activeLibraryTab === 'HISTORY' && listenHistory.length > 0
        ? listenHistory
        : tracks;

    if (activePool.length === 0) return;
    const currentIndex = activePool.findIndex(t => t.id === currentTrack?.id);
    const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + activePool.length) % activePool.length : 0;
    playTrack(activePool[prevIndex]);
  }, [activeLibraryTab, currentTrack?.id, favoriteTracks, listenHistory, tracks]);

  // Handle explicit music requests from chat / AI Companion / Voice Assistant
  useEffect(() => {
    if (!request?.query) return;
    if (lastHandledRequestId.current === request.requestId) return;
    lastHandledRequestId.current = request.requestId;

    if (request.query === '__STOP_MUSIC__') {
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.unload();
        soundRef.current = null;
      }
      if (youtubeFrameRef.current) {
        youtubeFrameRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      }
      setIsPlaying(false);
      setCurrentTrack(null);
      return;
    }

    if (request.query === '__NEXT_TRACK__') {
      playNext();
      return;
    }

    if (request.query === '__PREV_TRACK__') {
      playPrev();
      return;
    }

    if (request.query === '__ADD_TO_FAVORITES__') {
      const targetTrack = currentTrack || listenHistory[0] || tracks[0];
      if (targetTrack) {
        setFavoriteTracks(prev => {
          const exists = prev.some(item => item.id === targetTrack.id);
          const next = exists ? prev : [targetTrack, ...prev];
          try {
            localStorage.setItem(favoriteTracksKey(historyScope), JSON.stringify(next));
          } catch {
            // Ignore
          }
          syncLibraryToBackend(undefined, next, undefined);
          return next;
        });
        setActiveLibraryTab('FAVORITES');
      }
      return;
    }

    if (request.query === '__PLAY_FAVORITES__') {
      setActiveLibraryTab('FAVORITES');
      setSearchError('');
      const currentFavs = favoriteTracks.length > 0 ? favoriteTracks : readFavoriteTracks(historyScope);
      if (currentFavs.length > 0) {
        if (favoriteTracks.length === 0) {
          setFavoriteTracks(currentFavs);
        }
        playTrack(currentFavs[0]);
        return;
      }

      // If user's Favorite Playlist is currently empty, seed from recent watch history or default tracks so it plays immediately
      const fallbackPool = listenHistory.length > 0 ? listenHistory.slice(0, 3) : tracks.slice(0, 3);
      if (fallbackPool.length > 0) {
        setFavoriteTracks(fallbackPool);
        try {
          localStorage.setItem(favoriteTracksKey(historyScope), JSON.stringify(fallbackPool));
        } catch {
          // Ignore
        }
        syncLibraryToBackend(undefined, fallbackPool, undefined);
        playTrack(fallbackPool[0]);
      } else {
        void (async () => {
          try {
            const res = await api.searchMusic('nhạc lofi chill học bài');
            const results = Array.isArray(res.data) ? (res.data as LofiTrack[]) : [];
            setTracks(results);
            const seeded = results.slice(0, 3);
            if (seeded.length > 0) {
              setFavoriteTracks(seeded);
              try {
                localStorage.setItem(favoriteTracksKey(historyScope), JSON.stringify(seeded));
              } catch {
                // Ignore
              }
              syncLibraryToBackend(undefined, seeded, undefined);
              playTrack(seeded[0]);
            }
          } catch {
            // Ignore
          }
        })();
      }
      return;
    }

    if (request.query === '__PLAY_HISTORY__') {
      setActiveLibraryTab('HISTORY');
      setSearchError('');
      const currentHist = listenHistory.length > 0 ? listenHistory : readListenHistory(historyScope);
      if (currentHist.length > 0) {
        playTrack(currentHist[0]);
      } else if (tracks.length > 0) {
        playTrack(tracks[0]);
      }
      return;
    }

    const query = request.query.trim();
    setSearchQuery(query);
    setSelectedCategory('Tất cả');
    setActiveLibraryTab('TRACKS');

    void (async () => {
      saveSearch(query);
      try {
        const res = await api.searchMusic(query);
        const results = Array.isArray(res.data) ? (res.data as LofiTrack[]) : [];
        setTracks(results);
        setSearchError('');
        if (results.length > 0 && request.autoPlay !== false) {
          playTrack(results[0]);
        }
      } catch (err: any) {
        setSearchError(err?.response?.data?.error || 'Không thể tải kết quả tìm kiếm nhạc.');
      }
    })();
  }, [request?.requestId, request?.query, request?.autoPlay, playNext, playPrev]);

  // Initial load
  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;
    if (!request?.query) {
      void fetchTracks('', false);
    }
  }, []);

  async function fetchTracks(q?: string, autoPlay = false) {
    if (q?.trim()) saveSearch(q);
    try {
      const res = await api.searchMusic(q);
      const results = Array.isArray(res.data) ? (res.data as LofiTrack[]) : [];
      setTracks(results);
      setSearchError('');
      if (autoPlay && results[0]) {
        playTrack(results[0]);
      }
    } catch (err: any) {
      setSearchError(err?.response?.data?.error || 'Không thể tải kết quả tìm kiếm nhạc.');
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveLibraryTab('TRACKS');
    void fetchTracks(searchQuery, true);
  };

  const togglePlay = () => {
    if (!currentTrack) {
      if (tracks.length > 0) playTrack(tracks[0]);
      return;
    }

    if (currentTrack.youtubeId) {
      youtubeFrameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: isPlaying ? 'pauseVideo' : 'playVideo', args: [] }),
        '*'
      );
      setIsPlaying(!isPlaying);
      return;
    }

    if (!soundRef.current) {
      playTrack(currentTrack);
      return;
    }

    if (isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      soundRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (soundRef.current) {
      soundRef.current.volume(newVol);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (soundRef.current) soundRef.current.volume(volume);
    } else {
      setIsMuted(true);
      if (soundRef.current) soundRef.current.volume(0);
    }
  };

  useEffect(() => {
    if (!currentTrack?.youtubeId) return;
    youtubeFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: 'command',
        func: isMuted ? 'mute' : 'unMute',
        args: []
      }),
      '*'
    );
    youtubeFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(volume * 100)] }),
      '*'
    );
  }, [currentTrack?.youtubeId, isMuted, volume]);

  // Open Always-On-Top Picture-in-Picture window with YouTube TV above Pet's head when user leaves browser tab
  const openFloatingDesktopCinemaPiP = async () => {
    const docPiP = (window as unknown as { documentPictureInPicture?: any }).documentPictureInPicture;
    if (!docPiP) {
      alert('Trình duyệt của bạn hãy mở bằng Chrome hoặc Edge để bật cửa sổ TV + Pet nổi trên mọi màn hình nhé!');
      return;
    }
    try {
      const pipWindow = await docPiP.requestWindow({
        width: 390,
        height: 470
      });

      Array.from(document.styleSheets).forEach(sheet => {
        try {
          if (sheet.href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            const style = document.createElement('style');
            Array.from(sheet.cssRules).forEach(rule => {
              style.appendChild(document.createTextNode(rule.cssText));
            });
            pipWindow.document.head.appendChild(style);
          }
        } catch {
          // Ignore cross-origin sheet errors
        }
      });

      // Pause main window iframe while PiP window plays so audio doesn't double
      youtubeFrameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );

      const pipDiv = pipWindow.document.createElement('div');
      pipDiv.style.cssText =
        'width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: #181528; padding: 10px; box-sizing: border-box; overflow: hidden;';
      pipWindow.document.body.appendChild(pipDiv);
      pipWindow.document.body.style.margin = '0';

      const root = createRoot(pipDiv);
      root.render(
        <div className="w-full h-full flex flex-col items-center justify-between text-white select-none font-sans">
          <div className="w-full bg-[#231e36] border-2 border-slate-950 rounded-xl overflow-hidden shadow-lg">
            <div className="px-3 py-1.5 bg-[#181528] border-b border-slate-800 flex items-center justify-between text-[11px] font-black text-amber-300">
              <span className="truncate">🍿 {petName} đang ngồi xem cùng bạn</span>
            </div>
            {currentTrack?.youtubeId ? (
              <iframe
                title="YouTube PiP"
                src={`https://www.youtube.com/embed/${encodeURIComponent(currentTrack.youtubeId)}?autoplay=1`}
                className="w-full h-[210px] bg-black border-0"
                allow="autoplay; encrypted-media"
              />
            ) : (
              <div className="p-4 text-center text-xs text-slate-300">
                Hãy chọn 1 video YouTube để xem cùng {petName}
              </div>
            )}
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-200 truncate">
              {currentTrack?.title || 'Rạp phim thú cưng'}
            </div>
          </div>

          {pet && (
            <div className="flex flex-col items-center pb-1">
              <PixelPetCanvas
                petType={pet.petType}
                currentState={petWatchPose}
                scaleSize="MEDIUM"
                speechBubble="🎬 Xem phim cùng chủ nhân vui quá!"
                petName={pet.name}
                petLevel={pet.level}
                hunger={pet.hunger}
                happiness={pet.happiness}
                equippedItems={pet.userItems}
                showTooltip={false}
              />
            </div>
          )}
        </div>
      );

      pipWindow.addEventListener('pagehide', () => {
        root.unmount();
        if (isPlaying) {
          youtubeFrameRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        }
      });
    } catch {
      // Ignore PiP cancellation
    }
  };

  const youtubeEmbedUrl =
    currentTrack?.youtubeId
      ? `https://www.youtube.com/embed/${encodeURIComponent(currentTrack.youtubeId)}?autoplay=1&enablejsapi=1&rel=0`
      : undefined;

  const categories = ['Tất cả', 'YouTube', 'Spotify', 'Focus', 'Relax', 'Deep Sleep'];

  const filteredTracks = tracks.filter(t => {
    if (selectedCategory === 'Tất cả' || selectedCategory === 'All') return true;
    if (selectedCategory === 'YouTube') return !!t.youtubeId;
    if (selectedCategory === 'Spotify') return !t.youtubeId;
    return t.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const displayedList: WatchedTrackItem[] =
    activeLibraryTab === 'FAVORITES'
      ? favoriteTracks
      : activeLibraryTab === 'HISTORY'
      ? listenHistory
      : filteredTracks;

  // Should we show the Floating Mini-TV above the Pet's head?
  // Yes! Whenever the user leaves the Music tab (`isMinimizedToPet === true`) AND a track is playing/selected!
  const showFloatingTvAbovePet = isMinimizedToPet && Boolean(currentTrack && isPlaying);

  return (
    <>
      {/* ========================================================================= */}
      {/* FLOATING MINI-TV ABOVE PET'S HEAD (When user leaves the Music tab)        */}
      {/* Keeps the exact same YouTube iframe alive so video never reloads!         */}
      {/* ========================================================================= */}
      {showFloatingTvAbovePet && currentTrack && (
        <div
          style={{ left: `${floatingPetPos.x}px`, bottom: `${floatingPetPos.y}px` }}
          className="fixed z-[75] w-[340px] sm:w-[380px] select-none flex flex-col items-center animate-in fade-in"
        >
          {/* 1. TV SCREEN RIGHT ABOVE PET'S HEAD */}
          <div className="w-full bg-[#181528] text-white border-3 border-slate-950 rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden">
            {/* Drag Handle & Mini-TV Header */}
            <div
              onMouseDown={e => {
                setIsDraggingMiniTv(true);
                dragOffsetRef.current = {
                  dx: e.clientX - floatingPetPos.x,
                  dy: window.innerHeight - e.clientY - floatingPetPos.y
                };
              }}
              className="bg-[#231e36] px-3 py-2 border-b-2 border-slate-950 flex items-center justify-between cursor-move"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Tv size={13} className="text-amber-400 shrink-0" />
                <span className="text-[11px] font-black text-amber-300 truncate">
                  🍿 {petName} đang xem cùng bạn
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={openFloatingDesktopCinemaPiP}
                  title="Bật cửa sổ TV + Pet nổi đè lên mọi trang web & ứng dụng khác"
                  className="px-1.5 py-0.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-black text-[10px] border border-slate-950 flex items-center gap-0.5"
                >
                  <ExternalLink size={10} /> Nổi ngoài Web
                </button>
                <button
                  type="button"
                  onClick={playNext}
                  title="Đổi bài khác"
                  className="px-1.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] border border-slate-950"
                >
                  ⏭ Đổi bài
                </button>
                {onExpandToMusicTab && (
                  <button
                    type="button"
                    onClick={onExpandToMusicTab}
                    title="Mở rộng về trang Nhạc & Rạp Phim"
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTrack(null);
                  }}
                  title="Tắt màn hình TV"
                  className="p-1 rounded hover:bg-rose-600 text-slate-300 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Screen Slot for Persistent YouTube Iframe or Audio Track Info */}
            {youtubeEmbedUrl ? (
              <div className="h-[205px] w-full bg-black" />
            ) : (
              <div className="p-3 bg-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                  🎵
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentTrack.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-lg"
                >
                  {isPlaying ? 'Tạm dừng' : 'Phát'}
                </button>
              </div>
            )}

            {/* Mini-TV Footer Status Bar */}
            <div className="bg-[#181528] px-3 py-1.5 flex items-center justify-between text-[10px] border-t border-slate-800">
              <span className="truncate font-bold text-slate-300 max-w-[200px]">{currentTrack.title}</span>
              <div className="flex items-center gap-1">
                {(['IDLE', 'SLEEPING', 'DANCING'] as const).map(pose => (
                  <button
                    key={pose}
                    type="button"
                    onClick={() => setPetWatchPose(pose)}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      petWatchPose === pose ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {pose === 'IDLE' ? 'Đứng xem' : pose === 'SLEEPING' ? 'Ngồi chill' : 'Nhảy'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Speech Pointer Arrow pointing down to Pet's head */}
          <div className="w-4 h-4 bg-[#181528] border-r-3 border-b-3 border-slate-950 rotate-45 -mt-2 z-10" />

          {/* 2. PET STANDING / SITTING RIGHT BELOW THE YOUTUBE TV WATCHING WITH USER */}
          {pet && (
            <div className="mt-1 flex flex-col items-center">
              <PixelPetCanvas
                petType={pet.petType}
                currentState={petWatchPose}
                scaleSize="MEDIUM"
                speechBubble={null}
                petName={pet.name}
                petLevel={pet.level}
                hunger={pet.hunger}
                happiness={pet.happiness}
                equippedItems={pet.userItems}
                showTooltip={false}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN MUSIC PLAYER & PERSISTENT YOUTUBE IFRAME                             */}
      {/* We keep the DOM tree structure identical when minimized so the YouTube    */}
      {/* iframe NEVER unmounts or restarts when switching tabs!                    */}
      {/* ========================================================================= */}
      <div className={isMinimizedToPet ? 'w-0 h-0 overflow-visible' : 'mx-auto w-full max-w-7xl text-slate-800'}>
        <div
          className={
            isMinimizedToPet
              ? 'w-0 h-0 overflow-visible'
              : `bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a] ${
                  compact && fillPanel
                    ? 'h-full w-full min-w-0 max-h-full overflow-y-auto p-4'
                    : compact
                    ? 'p-4 w-[460px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)] overflow-y-auto'
                    : 'p-5 sm:p-7 w-full'
                }`
          }
        >
          {/* Top Header Banner */}
          <div
            className={
              isMinimizedToPet
                ? 'hidden'
                : 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b-2 border-slate-900/10'
            }
          >
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-black text-[10px] uppercase tracking-wider mb-1.5">
                <Radio size={12} className="text-amber-600 animate-pulse" />
                <span>RẠP PHIM & KÊNH ÂM NHẠC THÚ CƯNG • ĐỒNG BỘ TÀI KHOẢN</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#231e36] tracking-tight">
                Không Gian Âm Nhạc, Xem Phim & Playlist Cá Nhân
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Màn hình rộng chuẩn rạp phim • Tự động lưu Lịch sử xem & Playlist yêu thích riêng cho từng tài khoản • Khi sang tab khác, màn hình YouTube sẽ nổi ngay trên đầu {petName}!
              </p>
            </div>

            {/* Right Controls: Cinema Width Toggle + Pet Listening Companion Pill */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openFloatingDesktopCinemaPiP}
                title="Mở cửa sổ TV + Pet nổi trên màn hình ngay cả khi bạn chuyển sang tab web khác"
                className="px-3.5 py-2 rounded-xl border-2 border-slate-900 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs flex items-center gap-1.5 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition"
              >
                <ExternalLink size={14} />
                <span>Nổi TV + Pet ngoài Web</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCinemaWide(prev => !prev)}
                className={`px-3.5 py-2 rounded-xl border-2 border-slate-900 font-black text-xs flex items-center gap-1.5 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition ${
                  isCinemaWide ? 'bg-amber-400 text-slate-950' : 'bg-white hover:bg-amber-50 text-slate-800'
                }`}
              >
                {isCinemaWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isCinemaWide ? 'Thu gọn khung chuẩn' : 'Mở rộng toàn khung Rạp Phim'}</span>
              </button>

              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#f7f2e7] border-2 border-slate-900 rounded-xl shadow-[2px_2px_0_#0f172a]">
                <div className="relative w-8 h-8 rounded-lg bg-amber-300 border border-slate-900 flex items-center justify-center">
                  <span className="text-base">🍿</span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
                </div>
                <div className="text-left pr-1">
                  <div className="text-xs font-black text-slate-900 leading-tight">{petName}</div>
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    {isPlaying ? 'Đang ngồi xem cùng bạn' : 'Sẵn sàng nghe nhạc & xem phim'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* MAIN 2-COLUMN WIDE WORKSPACE (Cinema Screen Left + Library Right)   */}
          {/* =================================================================== */}
          <div className={isMinimizedToPet ? 'w-0 h-0 overflow-visible' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
            {/* ================= LEFT / TOP COLUMN: WIDE CINEMA VIDEO STAGE ================= */}
            <div className={isMinimizedToPet ? 'w-0 h-0 overflow-visible' : `${isCinemaWide ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4`}>
              {/* Wide Cinema Screen Card */}
              <div
                className={
                  isMinimizedToPet
                    ? 'w-0 h-0 overflow-visible'
                    : 'bg-[#181528] text-white rounded-2xl border-3 border-slate-950 shadow-[5px_5px_0px_#0f172a] overflow-hidden'
                }
              >
                {/* Top Bar of Cinema Stage */}
                <div
                  className={
                    isMinimizedToPet
                      ? 'hidden'
                      : 'bg-[#231e36] px-4 py-3 border-b-2 border-slate-950 flex flex-wrap items-center justify-between gap-2'
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-amber-400 text-slate-950 font-black">
                      <Tv size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-black text-white truncate">
                        {currentTrack ? currentTrack.title : 'Chọn bài hát hoặc nói "HEY ANY, mở cho tôi bài..."'}
                      </div>
                      <div className="text-[11px] text-amber-300/90 font-medium truncate">
                        {currentTrack
                          ? `${currentTrack.artist} • Chuyển sang tab khác TV sẽ tự nổi trên đầu ${petName}`
                          : 'Hỗ trợ khẩu lệnh: "HEY ANY, đổi bài khác", "tắt nhạc", "bài trước"'}
                      </div>
                    </div>
                  </div>

                  {/* Volume Slider in Header */}
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                    <button type="button" onClick={toggleMute} className="hover:text-amber-400 transition">
                      {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                    />
                    <span className="text-[11px] font-mono text-amber-300 font-bold w-9 text-right">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>
                </div>

                {/* PERSISTENT YOUTUBE VIDEO STAGE (Docks into Floating TV above Pet when minimized!) */}
                <div
                  className={
                    isMinimizedToPet
                      ? showFloatingTvAbovePet && youtubeEmbedUrl
                        ? 'fixed z-[76] bg-black border-x-3 border-slate-950 overflow-hidden shadow-lg'
                        : 'fixed -left-[9999px] top-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none'
                      : `relative w-full bg-black flex items-center justify-center ${
                          isCinemaWide
                            ? 'h-[420px] sm:h-[540px] lg:h-[620px]'
                            : 'h-[300px] sm:h-[380px] lg:h-[430px]'
                        }`
                  }
                  style={
                    isMinimizedToPet && showFloatingTvAbovePet && youtubeEmbedUrl
                      ? {
                          left: `${floatingPetPos.x}px`,
                          bottom: `${floatingPetPos.y + (pet ? 182 : 34)}px`,
                          width: window.innerWidth < 640 ? '340px' : '380px',
                          height: '205px'
                        }
                      : undefined
                  }
                >
                  {youtubeEmbedUrl ? (
                    <iframe
                      ref={youtubeFrameRef}
                      key={currentTrack?.youtubeId}
                      title={`YouTube: ${currentTrack?.title}`}
                      src={youtubeEmbedUrl}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      onLoad={() => {
                        const player = youtubeFrameRef.current?.contentWindow;
                        if (!player) return;
                        player.postMessage(
                          JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
                          '*'
                        );
                        player.postMessage(
                          JSON.stringify({
                            event: 'command',
                            func: 'setVolume',
                            args: [Math.round(volume * 100)]
                          }),
                          '*'
                        );
                        if (isPlaying) {
                          player.postMessage(
                            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                            '*'
                          );
                        }
                      }}
                    />
                  ) : !isMinimizedToPet ? (
                    <div className="text-center p-6 space-y-3 max-w-md">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300">
                        <Music size={30} />
                      </div>
                      <h3 className="text-base font-black text-white">
                        {currentTrack ? `Đang phát âm thanh: ${currentTrack.title}` : 'Màn Hình Rạp Phim & Nhạc YouTube'}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Hãy bấm chọn một video bên danh sách hoặc gọi <strong>"HEY ANY, mở cho tôi bài..."</strong> để phát video lên màn hình lớn cùng {petName}!
                      </p>
                      {tracks.length > 0 && !currentTrack && (
                        <button
                          type="button"
                          onClick={() => playTrack(tracks[0])}
                          className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-950 shadow-[0_2px_0_#000]"
                        >
                          ▶️ Phát ngay video đầu tiên
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Companion Pet Sitting & Watching Bar + Player Controls */}
                <div
                  className={
                    isMinimizedToPet
                      ? 'hidden'
                      : 'bg-[#231e36] p-4 border-t-2 border-slate-950 flex flex-wrap items-center justify-between gap-4'
                  }
                >
                    {/* Left: Transport Controls (Prev / Play-Pause / Next "Đổi bài khác" / Favorite) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={playPrev}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-1 transition"
                        title="Bài trước"
                      >
                        <SkipBack size={14} /> Bài trước
                      </button>

                      <button
                        type="button"
                        onClick={togglePlay}
                        className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] active:shadow-none font-black text-xs rounded-xl flex items-center gap-1.5 transition"
                      >
                        {isPlaying ? (
                          <>
                            <Pause size={15} className="fill-current" />
                            <span>Tạm dừng</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} className="fill-current" />
                            <span>Phát ngay</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={playNext}
                        className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition"
                        title="Đổi bài khác (Hoặc nói: HEY ANY, đổi bài khác)"
                      >
                        <SkipForward size={14} /> Đổi bài khác
                      </button>

                      {currentTrack && (
                        <button
                          type="button"
                          onClick={e => toggleFavoriteTrack(currentTrack, e)}
                          className={`px-3 py-2 rounded-xl border-2 border-slate-950 font-black text-xs flex items-center gap-1.5 transition ${
                            isTrackFavorite(currentTrack.id)
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <Heart size={14} fill={isTrackFavorite(currentTrack.id) ? 'currentColor' : 'none'} />
                          <span>
                            {isTrackFavorite(currentTrack.id) ? 'Đã lưu Playlist Yêu Thích' : 'Thêm vào Yêu Thích'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Right: Pet Watching Pose Selector */}
                    <div className="flex items-center gap-2 bg-[#181528] px-3 py-1.5 rounded-xl border border-slate-800">
                      <span className="text-[11px] font-bold text-amber-300">🍿 Tư thế {petName}:</span>
                      {(['IDLE', 'SLEEPING', 'DANCING'] as const).map(pose => (
                        <button
                          key={pose}
                          type="button"
                          onClick={() => setPetWatchPose(pose)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                            petWatchPose === pose
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {pose === 'IDLE' ? 'Đứng xem' : pose === 'SLEEPING' ? 'Ngồi chill' : 'Nhảy theo nhạc'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ================= RIGHT COLUMN: SEARCH, FAVORITE PLAYLIST & WATCH HISTORY ================= */}
              <div className={isMinimizedToPet ? 'hidden' : `${isCinemaWide ? 'lg:col-span-12' : 'lg:col-span-5'} space-y-4`}>
                {/* Search Input Bar */}
                <form onSubmit={handleSearchSubmit} className="relative">
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3.5 text-slate-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Tìm bài hát, phim, MV trên YouTube, Lofi..."
                      className="w-full pl-10 pr-24 py-3 text-xs font-bold bg-white border-2 border-slate-900 rounded-xl focus:outline-hidden shadow-[2px_2px_0_#0f172a]"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none font-black text-xs rounded-lg transition"
                    >
                      Tìm & Phát
                    </button>
                  </div>
                </form>

                {/* Recent Search Keywords */}
                {searchHistory.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      <Clock3 size={13} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">Tìm gần đây:</span>
                      {searchHistory.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setSearchQuery(item);
                            setActiveLibraryTab('TRACKS');
                            void fetchTracks(item, true);
                          }}
                          className="px-2.5 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 border border-slate-300 rounded-full text-[11px] font-bold whitespace-nowrap transition"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={clearSearchHistory}
                      className="text-[11px] text-slate-400 hover:text-red-500 underline whitespace-nowrap ml-2"
                    >
                      Xoá
                    </button>
                  </div>
                )}

                {/* 3 MAIN LIBRARY TABS: DANH SÁCH KHÁM PHÁ | PLAYLIST YÊU THÍCH | LỊCH SỬ XEM */}
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl border-2 border-slate-900">
                  <button
                    type="button"
                    onClick={() => setActiveLibraryTab('TRACKS')}
                    className={`py-2 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      activeLibraryTab === 'TRACKS'
                        ? 'bg-amber-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ListMusic size={14} />
                    <span>Khám phá ({filteredTracks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLibraryTab('FAVORITES')}
                    className={`py-2 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      activeLibraryTab === 'FAVORITES'
                        ? 'bg-rose-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Heart size={14} />
                    <span>Yêu thích ({favoriteTracks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLibraryTab('HISTORY')}
                    className={`py-2 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      activeLibraryTab === 'HISTORY'
                        ? 'bg-indigo-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <History size={14} />
                    <span>Lịch sử ({listenHistory.length})</span>
                  </button>
                </div>

                {/* Sub-Header / Action Bar for Active Library Tab */}
                {activeLibraryTab === 'TRACKS' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition whitespace-nowrap ${
                          selectedCategory === cat
                            ? 'bg-[#231e36] text-amber-300 border-slate-900 font-black'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {activeLibraryTab === 'FAVORITES' && (
                  <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-200 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-black text-rose-950">❤️ Playlist Yêu Thích của tài khoản</div>
                      <div className="text-[11px] text-rose-700">
                        Lưu trữ riêng theo tài khoản của bạn ({favoriteTracks.length} bài hát/video)
                      </div>
                    </div>
                    {favoriteTracks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => playTrack(favoriteTracks[0])}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-lg border-2 border-slate-900 shadow-[0_2px_0_#0f172a] shrink-0"
                      >
                        ▶️ Phát Playlist
                      </button>
                    )}
                  </div>
                )}

                {activeLibraryTab === 'HISTORY' && (
                  <div className="p-3 rounded-xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-black text-indigo-950">🕒 Lịch Sử Đã Xem của tài khoản</div>
                      <div className="text-[11px] text-indigo-700">
                        Tự động ghi nhớ các video/bài hát bạn đã mở ({listenHistory.length} mục)
                      </div>
                    </div>
                    {listenHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={clearWatchHistory}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 font-bold text-[11px] rounded-lg border border-rose-200 flex items-center gap-1 shrink-0"
                      >
                        <Trash2 size={12} /> Xoá lịch sử
                      </button>
                    )}
                  </div>
                )}

                {/* Track / Video List */}
                <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
                  {searchError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                      {searchError}
                    </div>
                  )}

                  {displayedList.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                      {activeLibraryTab === 'FAVORITES'
                        ? 'Playlist Yêu Thích của bạn đang trống. Hãy nhấn biểu tượng ❤️ ở bất kỳ bài hát/video nào để thêm vào Playlist nhé!'
                        : activeLibraryTab === 'HISTORY'
                        ? 'Chưa có lịch sử xem cho tài khoản này. Hãy bấm phát một bài hát hoặc video bất kỳ nhé!'
                        : 'Không tìm thấy bài hát nào trong danh mục này.'}
                    </div>
                  ) : (
                    displayedList.map(t => {
                      const isSelected = currentTrack?.id === t.id;
                      const isFav = isTrackFavorite(t.id);
                      const isYt = !!t.youtubeId;

                      return (
                        <div
                          key={`${activeLibraryTab}_${t.id}`}
                          onClick={() => playTrack(t)}
                          className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-50 border-slate-900 shadow-[2px_2px_0_#0f172a]'
                              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          {/* Left: Thumbnail / Wave + Title & Channel */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                              {t.coverUrl ? (
                                <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover" />
                              ) : (
                                <Music size={16} className="text-amber-400" />
                              )}
                              {isSelected && isPlaying && (
                                <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center gap-0.5">
                                  <span className="w-1 h-3 bg-amber-400 animate-pulse rounded-full" />
                                  <span className="w-1 h-4 bg-amber-400 animate-pulse rounded-full delay-75" />
                                  <span className="w-1 h-2 bg-amber-400 animate-pulse rounded-full delay-150" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div
                                className={`text-xs truncate ${
                                  isSelected ? 'font-black text-slate-950' : 'font-bold text-slate-800'
                                }`}
                              >
                                {t.title}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="truncate max-w-[130px]">{t.artist}</span>
                                {t.watchedAt && activeLibraryTab === 'HISTORY' && (
                                  <>
                                    <span>•</span>
                                    <span className="text-indigo-600 font-bold">Đã xem lúc {t.watchedAt}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Badge, Heart & Optional Delete from History */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black hidden sm:inline ${
                                isYt
                                  ? 'bg-red-50 text-red-600 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isYt ? 'YouTube' : 'Lofi'}
                            </span>
                            <button
                              type="button"
                              onClick={e => toggleFavoriteTrack(t, e)}
                              className={`p-1.5 rounded-lg transition ${
                                isFav ? 'text-rose-500 hover:text-rose-600' : 'text-slate-300 hover:text-rose-400'
                              }`}
                              title={isFav ? 'Bỏ khỏi Playlist Yêu Thích' : 'Thêm vào Playlist Yêu Thích'}
                            >
                              <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
                            </button>
                            {activeLibraryTab === 'HISTORY' && (
                              <button
                                type="button"
                                onClick={e => removeHistoryItem(t.id, e)}
                                className="p-1 rounded text-slate-300 hover:text-rose-600"
                                title="Xoá mục này khỏi lịch sử xem"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>
    </>
  );
};
