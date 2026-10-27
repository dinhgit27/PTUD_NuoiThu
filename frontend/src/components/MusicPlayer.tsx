import React, { useState, useEffect, useRef } from 'react';
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
  Sliders,
  Sparkles,
  ShieldCheck,
  Headphones,
  WifiOff,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { Howl } from 'howler';
import { api } from '../services/api';
import { LofiTrack, MusicRequest } from '../types';

interface MusicPlayerProps {
  onTrackSelect?: (track: LofiTrack) => void;
  compact?: boolean;
  fillPanel?: boolean;
  request?: MusicRequest;
  historyScope?: string;
  petName?: string;
}

const searchHistoryKey = (scope: string) => `officepet_music_search_history_${scope}`;
const listenHistoryKey = (scope: string) => `officepet_music_listen_history_${scope}`;
const favoritesKey = (scope: string) => `officepet_music_favorites_${scope}`;

function readSearchHistory(scope: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, 8)
      : ['Lofi hip hop chill', 'Nhạc thiền mưa rơi', 'Piano tập trung làm việc'];
  } catch (error) {
    return ['Lofi hip hop chill', 'Nhạc thiền mưa rơi', 'Piano tập trung làm việc'];
  }
}

function readListenHistory(scope: string): LofiTrack[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(listenHistoryKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (track): track is LofiTrack =>
              track && typeof track.id === 'string' && typeof track.title === 'string'
          )
          .slice(0, 10)
      : [];
  } catch (error) {
    return [];
  }
}

function readFavorites(scope: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(favoritesKey(scope)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
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
  petName = 'Mochi Neko'
}) => {
  const [tracks, setTracks] = useState<LofiTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<LofiTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchError, setSearchError] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory(historyScope));
  const [listenHistory, setListenHistory] = useState<LofiTrack[]>(() => readListenHistory(historyScope));
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites(historyScope));
  const [audioProgress, setAudioProgress] = useState({ current: '12:30', total: '34:15', percent: 36 });

  const soundRef = useRef<Howl | null>(null);
  const youtubeFrameRef = useRef<HTMLIFrameElement>(null);
  const lastHandledRequestId = useRef<number | undefined>(undefined);
  const hasLoadedInitial = useRef(false);

  useEffect(() => {
    setSearchHistory(readSearchHistory(historyScope));
    setListenHistory(readListenHistory(historyScope));
    setFavorites(readFavorites(historyScope));
  }, [historyScope]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, []);

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

    const query = request.query.trim();
    setSearchQuery(query);
    setSelectedCategory('All');

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
        console.error(err);
      }
    })();
  }, [request?.requestId, request?.query, request?.autoPlay]);

  // Initial load
  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;
    if (!request?.query) {
      void fetchTracks('', false);
    }
  }, []);

  const saveSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setSearchHistory(current => {
      const next = [normalized, ...current.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(searchHistoryKey(historyScope), JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save music search history:', error);
      }
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(searchHistoryKey(historyScope));
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleFavorite = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId];
      try {
        localStorage.setItem(favoritesKey(historyScope), JSON.stringify(next));
      } catch (err) {
        console.warn(err);
      }
      return next;
    });
  };

  const fetchTracks = async (q?: string, autoPlay = false) => {
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
      console.error(err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchTracks(searchQuery, false);
  };

  function playTrack(track: LofiTrack) {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
    }

    setCurrentTrack(track);
    setListenHistory(current => {
      const next = [track, ...current.filter(item => item.id !== track.id)].slice(0, 10);
      try {
        localStorage.setItem(listenHistoryKey(historyScope), JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save music listening history:', error);
      }
      return next;
    });

    if (track.youtubeId) {
      setIsPlaying(true);
      api.selectMusic(track).catch(console.warn);
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

    api.selectMusic(track).catch(console.warn);
    if (onTrackSelect) onTrackSelect(track);
  }

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

  const playNext = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    playTrack(tracks[nextIndex]);
  };

  const playPrev = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrack(tracks[prevIndex]);
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

  const youtubeEmbedUrl =
    isPlaying && currentTrack?.youtubeId
      ? `https://www.youtube.com/embed/${encodeURIComponent(currentTrack.youtubeId)}?autoplay=1&enablejsapi=1`
      : undefined;

  const categories = ['Tất cả', 'YouTube', 'Spotify', 'Focus', 'Relax', 'Deep Sleep'];

  const filteredTracks = tracks.filter(t => {
    if (selectedCategory === 'Tất cả' || selectedCategory === 'All') return true;
    if (selectedCategory === 'YouTube') return !!t.youtubeId;
    if (selectedCategory === 'Spotify') return !t.youtubeId;
    return t.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div
      className={`bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] shadow-xs text-slate-800 ${
        compact && fillPanel
          ? 'h-full w-full min-w-0 max-h-full overflow-y-auto p-4'
          : compact
          ? 'p-4 w-[460px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)] overflow-y-auto'
          : fillPanel
          ? 'h-full w-full min-w-0 overflow-y-auto p-6'
          : 'p-6 max-w-4xl mx-auto'
      }`}
    >
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 font-extrabold text-[10px] uppercase tracking-wider mb-1.5">
            <Radio size={12} className="text-amber-600 animate-pulse" />
            <span>OFFICEPET FOCUS ROOM • POMODORO SYNC ACTIVE</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#231e36] tracking-tight">
            Kênh Âm Nhạc Thư Giãn & Tập Trung
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Âm thanh tần số Alpha & Lofi Beats hỗ trợ tăng 40% hiệu suất tập trung công việc
          </p>
        </div>

        {/* Pet Listening Companion Pill */}
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-full shadow-xs self-start sm:self-auto shrink-0">
          <div className="relative w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center overflow-hidden">
            <span className="text-sm">🐾</span>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-bold text-slate-900 leading-tight">{petName}</div>
            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              Đang nghe cùng bạn
            </div>
          </div>
        </div>
      </div>

      {/* Main Navy / Indigo Player Card */}
      <div className="p-5 sm:p-6 bg-[#1e1b2e] text-white rounded-2xl border-2 border-slate-950 shadow-[4px_4px_0px_#0f172a] mb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs text-amber-400">
                <Music size={20} />
              </div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                Nhạc YouTube & Spotify cho giờ tập trung
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-md">
              Tìm kiếm bài hát yêu thích hoặc chọn danh sách đề xuất tần số sóng não
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-medium border border-white/15">
                <Sparkles size={11} className="text-amber-400" /> HQ Audio
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-medium border border-white/15">
                <Headphones size={11} className="text-emerald-400" /> Lofi 432Hz
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-medium border border-white/15">
                <Sliders size={11} className="text-cyan-400" /> Bộ lọc sóng não
              </span>
            </div>
          </div>

          {/* Volume Control Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-bold text-blue-100 mb-2">
              <span className="flex items-center gap-1.5">
                <button onClick={toggleMute} className="hover:text-amber-400 transition">
                  {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                Âm lượng phòng học:
              </span>
              <span className="font-mono text-amber-300 font-bold">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={e => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative mb-3">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm nhạc trên YouTube, Spotify, nghệ sĩ Lofi..."
            className="w-full pl-10 pr-24 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#231e36]/20 focus:border-[#231e36] transition shadow-xs"
          />
          <button
            type="submit"
            className="absolute right-2 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-xs rounded-lg transition active:scale-95 shadow-xs"
          >
            Tìm &rarr;
          </button>
        </div>
      </form>

      {/* Search History & Category Filter Chips */}
      <div className="space-y-2.5 mb-4">
        {searchHistory.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <Clock3 size={13} className="text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Lịch sử:</span>
              {searchHistory.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setSearchQuery(item);
                    void fetchTracks(item, false);
                  }}
                  className="px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-full text-[11px] font-medium whitespace-nowrap transition"
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
              Xoá lịch sử
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-100">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition ${
                selectedCategory === cat
                  ? 'bg-[#231e36] text-white border-[#231e36] shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Embedded YouTube Player (if playing YouTube track) */}
      {youtubeEmbedUrl && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-black">
          <iframe
            ref={youtubeFrameRef}
            key={currentTrack?.youtubeId}
            title={`YouTube: ${currentTrack?.title}`}
            src={youtubeEmbedUrl}
            className={`w-full ${compact ? 'h-36' : 'h-52 sm:h-64'}`}
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
                JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(volume * 100)] }),
                '*'
              );
              if (isPlaying) {
                player.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
              }
            }}
          />
        </div>
      )}

      {/* Track List */}
      <div className="space-y-2 mb-5">
        {searchError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {searchError}
          </div>
        )}

        {filteredTracks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Không tìm thấy bài hát nào trong danh mục này.
          </div>
        ) : (
          filteredTracks.map(t => {
            const isSelected = currentTrack?.id === t.id;
            const isFav = favorites.includes(t.id);
            const isYt = !!t.youtubeId;

            return (
              <div
                key={t.id}
                onClick={() => playTrack(t)}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                {/* Left: Wave / Note + Title & Channel */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected && isPlaying
                        ? 'bg-[#231e36] text-amber-400'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isSelected && isPlaying ? (
                      <span className="flex items-center gap-0.5">
                        <span className="w-1 h-3 bg-amber-400 animate-pulse rounded-full" />
                        <span className="w-1 h-4 bg-amber-400 animate-pulse rounded-full delay-75" />
                        <span className="w-1 h-2 bg-amber-400 animate-pulse rounded-full delay-150" />
                      </span>
                    ) : (
                      <Music size={16} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div
                      className={`text-xs truncate ${
                        isSelected ? 'font-bold text-[#231e36]' : 'font-semibold text-slate-800'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="truncate">{t.artist}</span>
                      <span>•</span>
                      <span>{t.duration === 'Live' ? '54K đang nghe' : '120K lượt nghe'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Badge & Heart */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] font-mono font-medium text-slate-500 hidden sm:inline">
                    {t.duration || 'Trực tiếp'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isYt
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isYt ? 'YouTube' : 'Spotify'}
                  </span>
                  <button
                    type="button"
                    onClick={e => toggleFavorite(t.id, e)}
                    className={`p-1.5 rounded-lg transition ${
                      isFav ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-slate-500'
                    }`}
                    title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                  >
                    <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Player Bar */}
      {currentTrack && (
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-[#231e36] to-slate-900 text-white rounded-2xl shadow-lg border border-slate-700/50 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Vinyl / Disc preview + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-full bg-slate-800 border-2 border-amber-400/80 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className={`w-full h-full object-cover ${isPlaying ? 'animate-spin' : ''}`}
                    style={{ animationDuration: '8s' }}
                  />
                ) : (
                  <div className={`text-amber-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                    💿
                  </div>
                )}
                <div className="absolute inset-0 m-auto w-3 h-3 bg-white rounded-full border border-slate-900" />
              </div>

              <div className="min-w-0">
                <div className="font-bold text-xs truncate text-white">{currentTrack.title}</div>
                <div className="text-[10px] text-blue-200/80 flex items-center gap-1.5 mt-0.5">
                  <span className="truncate">{currentTrack.artist}</span>
                  <span>•</span>
                  <span>Phát nền không quảng cáo</span>
                  <span className="px-1.5 py-0.2 bg-red-500/80 text-white font-bold text-[9px] rounded-sm">
                    {isPlaying ? 'ĐANG PHÁT' : 'TẠM DỪNG'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Controls & Time Progress */}
            <div className="flex items-center gap-3 justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={playPrev}
                  className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition active:scale-90"
                  title="Bài trước"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  {isPlaying ? (
                    <>
                      <Pause size={14} className="fill-current" />
                      <span>Tạm dừng</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} className="fill-current" />
                      <span>Tiếp tục</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition active:scale-90"
                  title="Bài kế tiếp"
                >
                  <SkipForward size={16} />
                </button>
              </div>

              <div className="text-[10px] font-mono text-blue-200/90 whitespace-nowrap pl-2 border-l border-white/20">
                {audioProgress.current} / {audioProgress.total}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 Academic & Productivity Feature Cards at Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-xs text-[#231e36] mb-1">
            <ShieldCheck size={16} className="text-amber-500" />
            <span>Chế độ Pomodoro Đồng Bộ</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tự động giảm âm lượng 50% khi hết giờ làm việc và chuyển bài nghỉ ngơi.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-xs text-[#231e36] mb-1">
            <Flame size={16} className="text-rose-500" />
            <span>Thú Cưng Hạnh Phúc +15%</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Khi phát nhạc Lofi liên tục trên 20 phút, chỉ số hạnh phúc của thú cưng tăng thêm.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-xs text-[#231e36] mb-1">
            <WifiOff size={16} className="text-blue-500" />
            <span>Nghe Không Cần Mạng</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Lưu trữ danh sách bài hát đệm cục bộ giúp ổn định phiên làm việc.
          </p>
        </div>
      </div>
    </div>
  );
};
