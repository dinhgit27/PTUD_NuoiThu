import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Clock3 } from 'lucide-react';
import { Howl } from 'howler';
import { api } from '../services/api';
import { LofiTrack, MusicRequest } from '../types';

interface MusicPlayerProps {
  onTrackSelect?: (track: LofiTrack) => void;
  compact?: boolean;
  fillPanel?: boolean;
  request?: MusicRequest;
  historyScope?: string;
}

const searchHistoryKey = (scope: string) => `officepet_music_search_history_${scope}`;
const listenHistoryKey = (scope: string) => `officepet_music_listen_history_${scope}`;

function readSearchHistory(scope: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryKey(scope)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, 10) : [];
  } catch (error) {
    console.warn('Could not restore music search history:', error);
    return [];
  }
}

function readListenHistory(scope: string): LofiTrack[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(listenHistoryKey(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((track): track is LofiTrack => track && typeof track.id === 'string' && typeof track.title === 'string').slice(0, 10)
      : [];
  } catch (error) {
    console.warn('Could not restore music listening history:', error);
    return [];
  }
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ onTrackSelect, compact = false, fillPanel = false, request, historyScope = 'default' }) => {
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

  const soundRef = useRef<Howl | null>(null);
  const youtubeFrameRef = useRef<HTMLIFrameElement>(null);
  const lastHandledRequestId = useRef<number | undefined>(undefined);
  const hasLoadedInitial = useRef(false);

  useEffect(() => {
    setSearchHistory(readSearchHistory(historyScope));
    setListenHistory(readListenHistory(historyScope));
  }, [historyScope]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, []);

  // Handle explicit music requests from chat / AI Companion
  useEffect(() => {
    if (!request?.query) return;
    if (lastHandledRequestId.current === request.requestId) return;
    lastHandledRequestId.current = request.requestId;

    const query = request.query.trim();
    setSearchQuery(query);
    setSelectedCategory('All');

    // Immediately fetch the exact song and autoplay the first matching result
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

  // Initial load when player opens without a pending request
  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;
    if (!request?.query) {
      void fetchTracks('', false);
    }
  }, []);

  // Debounced search when user types manually in the search input
  useEffect(() => {
    if (request?.query && searchQuery.trim() === request.query.trim()) return;
    if (!hasLoadedInitial.current) return;

    const timer = setTimeout(() => {
      void fetchTracks(searchQuery, false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setSearchHistory(current => {
      const next = [normalized, ...current.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 10);
      try {
        localStorage.setItem(searchHistoryKey(historyScope), JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save music search history:', error);
      }
      return next;
    });
  };

  const fetchTracks = async (q?: string, autoPlay = false) => {
    if (q?.trim()) saveSearch(q);
    try {
      const res = await api.searchMusic(q);
      const results = Array.isArray(res.data) ? res.data as LofiTrack[] : [];
      setTracks(results);
      setSearchError('');
      if (autoPlay && results[0]) playTrack(results[0]);
    } catch (err: any) {
      setSearchError(err?.response?.data?.error || 'Không thể tải kết quả tìm kiếm nhạc.');
      console.error(err);
    }
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

    // Save selection in backend
    api.selectMusic(track).catch(console.warn);
    if (onTrackSelect) onTrackSelect(track);
  }

  const togglePlay = () => {
    if (!currentTrack) return;

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

  const youtubeEmbedUrl = currentTrack?.youtubeId
    ? `https://www.youtube.com/embed/${encodeURIComponent(currentTrack.youtubeId)}?autoplay=1&enablejsapi=1`
    : undefined;

  const categories = ['All', 'YouTube', 'Spotify', 'Focus', 'Relax', 'Deep Sleep'];

  const filteredTracks = tracks.filter(t => {
    if (selectedCategory !== 'All' && t.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className={`bg-white border-2 border-charcoal rounded-xl shadow-pixel ${compact && fillPanel ? 'h-full w-full min-w-0 max-h-full overflow-y-auto p-3' : compact ? 'p-3 w-[420px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)] overflow-y-auto' : fillPanel ? 'h-full w-full min-w-0 overflow-y-auto p-4' : 'p-5 max-w-lg mx-auto'}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-charcoal">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sage-100 rounded-lg text-sage-600">
            <Music size={20} />
          </div>
          <div>
            <h3 className="font-pixel text-xs text-charcoal">Nhạc YouTube cho giờ tập trung</h3>
            {!compact && <p className="text-[11px] text-gray-500 font-sans">Tìm và phát video trực tiếp từ YouTube</p>}
          </div>
        </div>
      </div>

      {/* Currently Playing Bar */}
      {currentTrack && (
        <div className="p-3.5 bg-cream-100 border-2 border-charcoal rounded-xl mb-4 flex items-center justify-between shadow-pixel-sm">
          <div className="flex items-center gap-3 truncate">
            {currentTrack.coverUrl && (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-12 h-12 object-cover rounded-lg border border-charcoal"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            <div className="truncate">
              <div className="font-bold text-xs text-charcoal truncate">{currentTrack.title}</div>
              <div className="text-[11px] text-gray-500">{currentTrack.artist} • {currentTrack.category}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-3 bg-terracotta-400 hover:bg-terracotta-500 text-white rounded-full border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-90"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
        </div>
      )}

      {youtubeEmbedUrl && (
        <iframe
          ref={youtubeFrameRef}
          key={currentTrack?.youtubeId}
          title={`YouTube: ${currentTrack?.title}`}
          src={youtubeEmbedUrl}
          className={`w-full ${compact ? 'h-28' : 'aspect-video'} rounded-lg border-2 border-charcoal mb-4`}
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
      )}

      {/* Volume Slider */}
      <div className="flex items-center gap-2 mb-4 px-1 text-xs text-gray-600">
        <button onClick={toggleMute} className="hover:text-charcoal">
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={e => handleVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-sage-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
        />
        <span className="w-8 text-right font-mono text-[10px]">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
      </div>

      {/* Category Filter Chips */}
      <input
        type="search"
        value={searchQuery}
        onChange={event => setSearchQuery(event.target.value)}
        placeholder="Tìm nhạc trên YouTube..."
        aria-label="Tìm nhạc trên YouTube"
        className="w-full px-3 py-2 mb-3 text-xs border-2 border-charcoal rounded-lg"
      />
      {(searchHistory.length > 0 || listenHistory.length > 0) && (
        <details className="mb-3 rounded-lg border border-charcoal/25 bg-cream-50 px-2.5 py-2 text-xs">
          <summary className="flex cursor-pointer items-center gap-1.5 font-bold text-charcoal">
            <Clock3 size={13} /> Lịch sử tìm kiếm và nghe
          </summary>
          {searchHistory.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-bold text-gray-500">Tìm gần đây</div>
              <div className="flex flex-wrap gap-1.5">
                {searchHistory.map(query => (
                  <button key={query} type="button" onClick={() => setSearchQuery(query)} className="max-w-full truncate rounded-full border border-charcoal/30 bg-white px-2 py-1 text-[10px] hover:bg-sage-50">
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}
          {listenHistory.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-bold text-gray-500">Nghe gần đây</div>
              <div className="max-h-24 space-y-1 overflow-y-auto">
                {listenHistory.map(track => (
                  <button key={track.id} type="button" onClick={() => playTrack(track)} className="block w-full truncate rounded border border-charcoal/20 bg-white px-2 py-1 text-left hover:bg-sage-50">
                    ▶ {track.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </details>
      )}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 text-[11px] font-pixel rounded-md border border-charcoal transition-colors ${
              selectedCategory === cat ? 'bg-sage-400 text-white shadow-pixel-sm' : 'bg-white hover:bg-gray-100 text-charcoal'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Track List */}
      <div className={`${compact ? 'max-h-32' : 'max-h-56'} overflow-y-auto space-y-1.5 pr-1 font-sans text-xs`}>
        {searchError && <p role="alert" className="p-2 text-red-700">{searchError}</p>}
        {filteredTracks.map(t => {
          const isSelected = currentTrack?.id === t.id;
          return (
            <div
              key={t.id}
              onClick={() => playTrack(t)}
              className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-sage-50 border-sage-500 font-bold'
                  : 'bg-white border-gray-200 hover:bg-cream-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-gray-400 text-[10px] w-4">{isSelected && isPlaying ? '▶' : '•'}</span>
                <div className="truncate">
                  <div className="text-charcoal truncate">{t.title}</div>
                  <div className="text-[10px] text-gray-400 font-normal">{t.artist}</div>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{t.duration}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
