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
 * Get Curated Royalty-Free Lofi Tracks
 */
router.get('/lofi', (_req, res: Response) => {
  res.json(LOFI_LIBRARY);
});

/**
 * Search YouTube first, with Spotify or curated tracks as fallback.
 */
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) {
    return res.status(503).json({ error: 'Tìm kiếm YouTube chưa được cấu hình. Vui lòng thêm YOUTUBE_API_KEY ở máy chủ.' });
  }

  try {
    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: youtubeKey,
        part: 'snippet',
        type: 'video',
        videoEmbeddable: true,
        maxResults: 15,
        q: q.slice(0, 100) || 'lofi music for focus'
      },
      timeout: 7000
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
    return res.json(tracks);
  } catch (error) {
    console.warn('YouTube search failed; using the configured music fallback:', error);
  }

  const token = process.env.SPOTIFY_TOKEN;

  if (token) {
    try {
      const { data } = await axios.get('https://api.spotify.com/v1/search', {
        params: { q: q || 'lofi beats', type: 'track', limit: 15 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });

      const spotifyTracks = data.tracks.items.map((t: any) => ({
        id: `spotify_${t.id}`,
        title: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        category: 'Spotify',
        duration: `${Math.floor(t.duration_ms / 60000)}:${Math.floor((t.duration_ms % 60000) / 1000).toString().padStart(2, '0')}`,
        streamUrl: t.preview_url || '',
        coverUrl: t.album.images?.[0]?.url || '/backgrounds/cafe_cozy.png'
      }));

      return res.json(spotifyTracks);
    } catch (err) {
      console.warn('Spotify search failed, falling back to Lofi library:', err);
    }
  }

  // Filter local lofi library
  const filtered = q
    ? LOFI_LIBRARY.filter(t => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
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
        selectedMusicTrack: typeof updated.selectedMusicTrack === 'string' ? JSON.parse(updated.selectedMusicTrack) : updated.selectedMusicTrack
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

export default router;
