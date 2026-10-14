import { Router, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

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
        selectedMusicTrack: track,
        favMusicGenre: track.category || 'Lo-fi'
      }
    });

    res.json({
      message: `Đã chọn bài hát "${track.title}" làm nhạc nền thư giãn!`,
      preference: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi chọn nhạc nền.', details: error.message });
  }
});

export default router;
