import { Router, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { QuestService } from '../services/questService';

const router = Router();
const prisma = new PrismaClient();

// Curated Royalty-Free Pixel Lofi Tracks with reliable direct audio streams
const LOFI_LIBRARY = [
  {
    id: 'lofi_01',
    title: 'Warm Coffee & Rainy Windows',
    artist: 'OfficePet Lofi Lab',
    category: 'Relax',
    duration: '2:45',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    coverUrl: '/backgrounds/cafe_cozy.png'
  },
  {
    id: 'lofi_02',
    title: 'Midnight Coding & Gentle Rain',
    artist: 'Pixel Beats Studio',
    category: 'Focus',
    duration: '3:12',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    coverUrl: '/backgrounds/garden_spring.png'
  },
  {
    id: 'lofi_03',
    title: 'Sunset Garden Breeze',
    artist: 'Chilled Cat Records',
    category: 'Relax',
    duration: '2:30',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-chill-medium-version-159456.mp3',
    coverUrl: '/backgrounds/beach_sunset.png'
  },
  {
    id: 'lofi_04',
    title: 'Deep Focus Pomodoro',
    artist: 'Zen Workspace Beats',
    category: 'Focus',
    duration: '3:05',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_951fefce69.mp3?filename=chill-abstract-intention-12099.mp3',
    coverUrl: '/backgrounds/office_zen.png'
  },
  {
    id: 'lofi_05',
    title: 'Nap Time With Bunny',
    artist: 'Slumber Lofi',
    category: 'Deep Sleep',
    duration: '2:50',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f77cd1.mp3?filename=soft-rain-ambient-111154.mp3',
    coverUrl: '/backgrounds/cafe_cozy.png'
  }
];

/**
 * Helper: Direct YouTube search fallback (works even if Google Cloud YouTube Data API v3 is not enabled on the key)
 */
async function searchYouTubeDirect(query: string): Promise<any[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const html = await response.text();
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const sectionContents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const videoItems: any[] = [];
    for (const section of sectionContents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        if (item.videoRenderer && typeof item.videoRenderer.videoId === 'string') {
          const v = item.videoRenderer;
          const videoId = v.videoId;
          const title = v.title?.runs?.[0]?.text || 'YouTube Lofi Track';
          const artist = v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube Channel';
          const duration = v.lengthText?.simpleText || 'YouTube';
          const thumbs = v.thumbnail?.thumbnails || [];
          const coverUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          videoItems.push({
            id: `youtube_${videoId}`,
            youtubeId: videoId,
            title,
            artist,
            category: 'YouTube',
            duration,
            streamUrl: '',
            coverUrl
          });
          if (videoItems.length >= 12) break;
        }
      }
      if (videoItems.length >= 12) break;
    }
    return videoItems;
  } catch (err) {
    console.warn('Direct YouTube search error:', err);
    return [];
  }
}

/**
 * Get Curated Royalty-Free Lofi Tracks
 */
router.get('/lofi', (_req, res: Response) => {
  res.json(LOFI_LIBRARY);
});

/**
 * Search YouTube first, with direct YouTube parser and curated tracks as fallback.
 */
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const searchQuery = q.slice(0, 100) || 'nhạc lofi chill học bài tập trung';
  const youtubeKey = process.env.YOUTUBE_API_KEY || 'AIzaSyDSS2KKpjlQWC6e1RT45nqwfZuJm3MMo5s';

  // 1. Try Official YouTube Data API v3 first
  if (youtubeKey) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: youtubeKey,
          part: 'snippet',
          type: 'video',
          videoEmbeddable: true,
          maxResults: 12,
          q: searchQuery
        },
        timeout: 5000
      });
      const tracks = (data.items || [])
        .filter((item: any) => typeof item.id?.videoId === 'string')
        .map((item: any) => ({
          id: `youtube_${item.id.videoId}`,
          youtubeId: item.id.videoId,
          title: item.snippet?.title || 'YouTube video',
          artist: item.snippet?.channelTitle || 'YouTube',
          category: 'YouTube',
          duration: 'YouTube',
          streamUrl: '',
          coverUrl: item.snippet?.thumbnails?.medium?.url || '/backgrounds/cafe_cozy.png'
        }));
      if (tracks.length > 0) {
        return res.json(q ? tracks : [...tracks, ...LOFI_LIBRARY]);
      }
    } catch {
      // Fallback to direct YouTube search below
    }
  }

  // 2. Fallback: Direct YouTube Search (works without Google Cloud YouTube API enabled)
  const directTracks = await searchYouTubeDirect(searchQuery);
  if (directTracks.length > 0) {
    return res.json(q ? directTracks : [...directTracks, ...LOFI_LIBRARY]);
  }

  // 3. Final Fallback: Local curated Lofi library
  const lowerQ = q.toLowerCase();
  const filtered = lowerQ
    ? LOFI_LIBRARY.filter(t => t.title.toLowerCase().includes(lowerQ) || t.category.toLowerCase().includes(lowerQ))
    : LOFI_LIBRARY;

  res.json(filtered);
});

/**
 * User selects background music track
 */
router.post('/select', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { track } = req.body;

    if (!track) {
      return res.status(400).json({ error: 'Vui lòng cung cấp bài nhạc muốn chọn.' });
    }

    const updated = await prisma.userPreference.update({
      where: { userId },
      data: {
        selectedMusicTrack: typeof track === 'string' ? track : JSON.stringify(track),
        favMusicGenre: track.category || 'Lo-fi'
      }
    });

    // Track quest progress
    void QuestService.recordActionProgress(userId, 'MUSIC', 1);

    res.json({
      message: `Đã chọn bài hát "${track.title}" làm nhạc nền thư giãn!`,
      preference: {
        ...updated,
        selectedMusicTrack:
          typeof updated.selectedMusicTrack === 'string'
            ? JSON.parse(updated.selectedMusicTrack)
            : updated.selectedMusicTrack
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi chọn nhạc nền.', details: error.message });
  }
});

/**
 * Get User Music Library Preferences (Favorites & History)
 */
router.get('/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { settings: true, selectedMusicTrack: true }
    });

    let musicSettings: { favorites?: string[]; listenHistory?: any[] } = {};
    if (pref?.settings) {
      try {
        const parsed = JSON.parse(pref.settings);
        if (parsed?.music) {
          musicSettings = parsed.music;
        }
      } catch {}
    }

    res.json({
      favorites: musicSettings.favorites || [],
      listenHistory: musicSettings.listenHistory || [],
      selectedTrack: pref?.selectedMusicTrack ? JSON.parse(pref.selectedMusicTrack) : null
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải sở thích âm nhạc.', details: error.message });
  }
});

/**
 * Get Per-Account Music Library (Watch History, Favorite Playlist, Search History)
 */
router.get('/library', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    let parsedSettings: any = {};
    if (pref?.settings) {
      try {
        parsedSettings = JSON.parse(pref.settings);
      } catch {
        parsedSettings = {};
      }
    }
    res.json({
      watchHistory: Array.isArray(parsedSettings.musicWatchHistory) ? parsedSettings.musicWatchHistory : [],
      favoriteTracks: Array.isArray(parsedSettings.musicFavoriteTracks) ? parsedSettings.musicFavoriteTracks : [],
      searchHistory: Array.isArray(parsedSettings.musicSearchHistory) ? parsedSettings.musicSearchHistory : []
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tải thư viện nhạc cá nhân.', details: error.message });
  }
});

/**
 * Save User Music Library Preferences (Favorites & History)
 */
router.post('/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { favorites, listenHistory } = req.body;

    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { settings: true }
    });

    let existingSettings: Record<string, any> = {};
    if (pref?.settings) {
      try {
        existingSettings = JSON.parse(pref.settings);
      } catch {}
    }

    existingSettings.music = {
      favorites: Array.isArray(favorites) ? favorites : existingSettings.music?.favorites || [],
      listenHistory: Array.isArray(listenHistory) ? listenHistory.slice(0, 30) : existingSettings.music?.listenHistory || []
    };

    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        settings: JSON.stringify(existingSettings)
      },
      create: {
        userId,
        settings: JSON.stringify(existingSettings)
      }
    });

    res.json({ success: true, music: existingSettings.music });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi lưu sở thích âm nhạc.', details: error.message });
  }
});

/**
 * Save Per-Account Music Library (Watch History, Favorite Playlist, Search History)
 */
router.post('/library', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { watchHistory, favoriteTracks, searchHistory } = req.body;

    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    let currentSettings: any = {};
    if (pref?.settings) {
      try {
        currentSettings = JSON.parse(pref.settings);
      } catch {
        currentSettings = {};
      }
    }

    const nextSettings = {
      ...currentSettings,
      ...(Array.isArray(watchHistory) ? { musicWatchHistory: watchHistory.slice(0, 30) } : {}),
      ...(Array.isArray(favoriteTracks) ? { musicFavoriteTracks: favoriteTracks.slice(0, 50) } : {}),
      ...(Array.isArray(searchHistory) ? { musicSearchHistory: searchHistory.slice(0, 12) } : {})
    };

    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        settings: JSON.stringify(nextSettings)
      },
      create: {
        userId,
        settings: JSON.stringify(nextSettings)
      }
    });

    res.json({ message: 'Đã đồng bộ thư viện nhạc của tài khoản!' });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi lưu thư viện nhạc cá nhân.', details: error.message });
  }
});

export default router;
