import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  Sparkles,
  Bell,
  Monitor,
  Save,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MessageCircleHeart,
  Clock,
  Brain,
  Music,
  Camera,
  Smile
} from 'lucide-react';
import { api } from '../services/api';
import { User, UserPet } from '../types';
import {
  DEFAULT_PET_CALL_NAME,
  DEFAULT_PET_SELF_NAME,
  PetAddressingConfig,
  capitalizeStart,
  extractAddressingFromUser,
  sanitizeAddressingTerm,
  sanitizeOptionalTtsTerm,
  setActiveAddressing
} from '../utils/petAddressing';
import { playTtsSpeech } from '../utils/tts';
import { burstScanEmotion, getLastMoodResult } from '../services/emotionService';

interface SettingsViewProps {
  currentUser: User;
  userPet: UserPet | null;
  onUserUpdated: (updatedUser: User) => void;
}

const CALL_NAME_SUGGESTIONS = ['bạn', 'đại ca', 'Sếp', 'Anh', 'Chị', 'Cậu chủ', 'Boss'];
const SELF_NAME_SUGGESTIONS = ['em', 'mình', 'tớ'];

const PERSONA_OPTIONS = [
  { id: 'Vui vẻ', label: 'Vui vẻ & Năng lượng', desc: 'Nhiệt tình, hay pha trò nhẹ nhàng' },
  { id: 'Dịu dàng', label: 'Dịu dàng & Ấm áp', desc: 'Quan tâm, vỗ về khi làm việc căng thẳng' },
  { id: 'Nghiêm túc', label: 'Chuyên nghiệp & Tận tâm', desc: 'Tập trung hỗ trợ công việc hiệu quả' },
  { id: 'Ngắn gọn', label: 'Súc tích & Nhanh gọn', desc: 'Trả lời thẳng trọng tâm, ít rườm rà' }
];

const MUSIC_GENRES = [
  'Lo-fi Hip Hop',
  'Piano Acoustic',
  'Rain & Ambient',
  'Synthwave Focus',
  'Jazz Cafe'
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  userPet,
  onUserUpdated
}) => {
  const initialAddr = extractAddressingFromUser(currentUser);

  // 1. Xưng hô & Cá tính
  const [callName, setCallName] = useState(initialAddr.callName);
  const [ttsCallName, setTtsCallName] = useState(initialAddr.ttsCallName);
  const [selfName, setSelfName] = useState(initialAddr.selfName);
  const [petPersona, setPetPersona] = useState(currentUser.preference?.petPersona || 'Vui vẻ');

  // 2. Âm thanh & Giọng nói
  const [soundEnabled, setSoundEnabled] = useState(currentUser.preference?.soundEnabled ?? true);
  const [voiceVolume, setVoiceVolume] = useState(initialAddr.voiceVolume);
  const [favMusicGenre, setFavMusicGenre] = useState(
    currentUser.preference?.favMusicGenre || 'Lo-fi Hip Hop'
  );

  // 3. Nhắc nhở sức khỏe & Tập trung
  const [hydrationInterval, setHydrationInterval] = useState(
    currentUser.preference?.hydrationInterval || 45
  );
  const [postureInterval, setPostureInterval] = useState(
    currentUser.preference?.postureInterval || 60
  );
  const [quietMode, setQuietMode] = useState(currentUser.preference?.quietMode ?? false);
  const [dndStartTime, setDndStartTime] = useState(currentUser.preference?.dndStartTime || '');
  const [dndEndTime, setDndEndTime] = useState(currentUser.preference?.dndEndTime || '');

  // 4. Desktop & Trí nhớ AI
  const [desktopShowBubble, setDesktopShowBubble] = useState(initialAddr.desktopShowBubble);
  const [desktopAutoRoam, setDesktopAutoRoam] = useState(initialAddr.desktopAutoRoam);
  const [aiLearningEnabled, setAiLearningEnabled] = useState(
    currentUser.preference?.aiLearningEnabled ?? true
  );

  // 5. Camera Cảm Xúc AI
  const [aiEmotionScanEnabled, setAiEmotionScanEnabled] = useState(initialAddr.aiEmotionScanEnabled);
  const [emotionScanInterval, setEmotionScanInterval] = useState(initialAddr.emotionScanInterval || 30);
  const [testingEmotionScan, setTestingEmotionScan] = useState(false);
  const [lastTestedEmotion, setLastTestedEmotion] = useState<{
    emotion: string;
    labelVi: string;
    emoji: string;
    confidence: number;
  } | null>(() => {
    const saved = getLastMoodResult();
    return saved ? { emotion: saved.emotion, labelVi: saved.labelVi, emoji: saved.emoji, confidence: saved.confidence } : null;
  });

  const [saving, setSaving] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const addr = extractAddressingFromUser(currentUser);
    setCallName(addr.callName);
    setTtsCallName(addr.ttsCallName);
    setSelfName(addr.selfName);
    setVoiceVolume(addr.voiceVolume);
    setDesktopShowBubble(addr.desktopShowBubble);
    setDesktopAutoRoam(addr.desktopAutoRoam);

    setPetPersona(currentUser.preference?.petPersona || 'Vui vẻ');
    setSoundEnabled(currentUser.preference?.soundEnabled ?? true);
    setFavMusicGenre(currentUser.preference?.favMusicGenre || 'Lo-fi Hip Hop');
    setHydrationInterval(currentUser.preference?.hydrationInterval || 45);
    setPostureInterval(currentUser.preference?.postureInterval || 60);
    setQuietMode(currentUser.preference?.quietMode ?? false);
    setDndStartTime(currentUser.preference?.dndStartTime || '');
    setDndEndTime(currentUser.preference?.dndEndTime || '');
    setAiLearningEnabled(currentUser.preference?.aiLearningEnabled ?? true);
    setAiEmotionScanEnabled(addr.aiEmotionScanEnabled);
    setEmotionScanInterval(addr.emotionScanInterval || 30);
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const previewCall = sanitizeAddressingTerm(callName, DEFAULT_PET_CALL_NAME, 30);
  const previewTts = sanitizeOptionalTtsTerm(ttsCallName, 40);
  const previewSelf = sanitizeAddressingTerm(selfName, DEFAULT_PET_SELF_NAME, 20);

  const buildDraftAddressing = (): PetAddressingConfig => ({
    callName: previewCall,
    ttsCallName: previewTts,
    selfName: previewSelf,
    voiceVolume,
    desktopShowBubble,
    desktopAutoRoam,
    soundEnabled,
    quietMode,
    dndStartTime,
    dndEndTime,
    aiEmotionScanEnabled,
    emotionScanInterval: Number(emotionScanInterval) || 30
  });

  const handleTestVoice = async () => {
    const draft = buildDraftAddressing();
    const sampleSentence = `Dạ ${draft.callName} ơi, ${draft.selfName} đang sẵn sàng đồng hành cùng ${draft.callName} đây ạ!`;
    try {
      setTestingVoice(true);
      await playTtsSpeech(sampleSentence, undefined, {
        configOverride: draft,
        skipDedupe: true,
        forcePlay: true
      });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleTestEmotionScan = async () => {
    try {
      setTestingEmotionScan(true);
      const res = await burstScanEmotion({ maxWaitMs: 3500, sampleFrames: 3 });
      if (res) {
        setLastTestedEmotion({
          emotion: res.emotion,
          labelVi: res.labelVi,
          emoji: res.emoji,
          confidence: res.confidence
        });
        showToast('success', `Đã quét: ${res.emoji} ${res.labelVi} (${res.confidence}%) — Camera đã tắt hoàn toàn!`);
      } else {
        showToast('error', 'Không nhận diện được khuôn mặt hoặc webcam đang bận.');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi khi kích hoạt webcam: ' + (err?.message || 'Không có quyền'));
    } finally {
      setTestingEmotionScan(false);
    }
  };

  const handleResetAddressing = () => {
    setCallName(DEFAULT_PET_CALL_NAME);
    setTtsCallName('');
    setSelfName(DEFAULT_PET_SELF_NAME);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAddr = buildDraftAddressing();

    try {
      setSaving(true);
      const res = await api.updateProfile({
        preference: {
          petPersona,
          soundEnabled,
          quietMode,
          dndStartTime: dndStartTime || null,
          dndEndTime: dndEndTime || null,
          favMusicGenre,
          hydrationInterval: Number(hydrationInterval),
          postureInterval: Number(postureInterval),
          aiLearningEnabled,
          petAddressing: normalizedAddr
        }
      });

      const applied = setActiveAddressing(normalizedAddr);
      window.officePet?.updatePet(
        res.data?.user?.userPet || userPet,
        null,
        applied
      );

      if (res.data?.user) {
        onUserUpdated(res.data.user);
      }
      showToast(
        'success',
        `Đã lưu cài đặt! Từ giờ bé thú sẽ gọi bạn là "${applied.callName}" và tự xưng "${applied.selfName}".`
      );
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Không thể lưu cài đặt lúc này.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-6">
      {/* Header */}
      <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-black mb-1.5">
            <Sparkles size={12} /> Cá nhân hóa toàn diện
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Cài Đặt Xưng Hô, Giọng Nói & Trải Nghiệm
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Thiết lập riêng cho tài khoản <span className="font-bold text-slate-800">{currentUser.fullName}</span> — tự động đồng bộ giữa Web Dashboard, AI Chat, Giọng nói TTS và Cửa sổ nổi Desktop.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTestVoice}
          disabled={testingVoice}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-slate-900 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shadow-[2px_2px_0px_#0f172a] active:translate-y-[1px] transition disabled:opacity-60"
        >
          <Play size={14} className="fill-current" />
          <span>{testingVoice ? 'Đang phát thử...' : 'Nghe thử giọng thú'}</span>
        </button>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 font-bold text-xs shadow-[2px_2px_0px_#0f172a] ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
              : 'bg-rose-50 border-rose-600 text-rose-900'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-5">
        {/* GROUP 1: XƯNG HÔ & CÁ TÍNH */}
        <section className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-300 border-2 border-slate-900 flex items-center justify-center">
                <MessageCircleHeart size={16} className="text-slate-900" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">1. Xưng Hô & Cá Tính Thú Cưng</h3>
                <p className="text-[11px] text-slate-500">
                  Tự nhập cách gọi bạn yêu thích — cả AI Chat và giọng nói sẽ áp dụng ngay.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetAddressing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-600 transition"
            >
              <RotateCcw size={12} />
              Mặc định
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cách thú gọi bạn */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">
                Cách thú gọi bạn <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={30}
                value={callName}
                onChange={e => setCallName(e.target.value)}
                placeholder="VD: bạn, anh Hùng, chị Linh, sếp, Boss..."
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-900 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {CALL_NAME_SUGGESTIONS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCallName(chip)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      callName.trim().toLowerCase() === chip.toLowerCase()
                        ? 'bg-amber-400 border-slate-900 text-slate-950 shadow-[1px_1px_0px_#0f172a]'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-amber-50'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Mẹo: Nếu là tiếng Việt, hãy gõ <strong>đủ dấu</strong> (VD: <em>anh Hùng</em>, <em>sếp</em>) để giọng đọc tiếng Việt phát âm chuẩn nhất.
              </p>
            </div>

            {/* Cách đọc TTS (Phiên âm tùy chọn) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">
                Cách đọc giọng nói TTS <span className="font-medium text-slate-400">(Tùy chọn nếu dùng tên tiếng Anh/viết tắt)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={40}
                  value={ttsCallName}
                  onChange={e => setTtsCallName(e.target.value)}
                  placeholder={`Mặc định đọc theo "${previewCall}" — VD: Bót, A-lếch...`}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-emerald-300"
                />
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={testingVoice}
                  title="Nghe thử cách TTS đọc"
                  className="px-3 rounded-xl border-2 border-slate-900 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black text-xs flex items-center gap-1 shrink-0"
                >
                  <Volume2 size={15} />
                  <span>Thử</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Ví dụ: Bạn đặt tên hiển thị là <strong>Boss</strong> hoặc <strong>JK</strong>, có thể nhập ô này là <strong>Bót</strong> hoặc <strong>Jây Cây</strong> — khung chat vẫn hiện <strong>{previewCall}</strong> nhưng giọng đọc sẽ phát âm đúng theo cách bạn ghi!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            {/* Cách thú tự xưng */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">Cách thú tự xưng</label>
              <input
                type="text"
                maxLength={20}
                value={selfName}
                onChange={e => setSelfName(e.target.value)}
                placeholder="VD: em, mình, tớ..."
                className="w-full px-3.5 py-2 rounded-xl border-2 border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <div className="flex flex-wrap gap-1.5">
                {SELF_NAME_SUGGESTIONS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelfName(chip)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      selfName.trim().toLowerCase() === chip.toLowerCase()
                        ? 'bg-amber-400 border-slate-900 text-slate-950'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-amber-50'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Xem trước câu chào */}
            <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/70 p-3.5 flex flex-col justify-center">
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-800 mb-1">
                Xem trước câu thoại của {userPet?.name || 'Thú cưng'}
              </div>
              <p className="text-sm font-bold text-slate-900">
                “Dạ {previewCall} ơi, {previewSelf} đã sẵn sàng đồng hành cùng {previewCall} rồi ạ! {capitalizeStart(previewCall)} cần {previewSelf} giúp gì cứ nói nhé!”
              </p>
              {previewTts && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  🔊 Giọng đọc TTS sẽ phát âm là: “{previewTts}”
                </p>
              )}
            </div>
          </div>

          {/* Tính cách AI */}
          <div className="pt-2">
            <label className="block text-xs font-black text-slate-800 mb-2">Tính cách phản hồi của AI</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {PERSONA_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPetPersona(opt.id)}
                  className={`text-left p-3 rounded-xl border-2 transition ${
                    petPersona === opt.id
                      ? 'bg-amber-100 border-slate-900 shadow-[2px_2px_0px_#0f172a]'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="text-xs font-black text-slate-900">{opt.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* GROUP 2: GIỌNG NÓI & ÂM THANH */}
        <section className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-300 border-2 border-slate-900 flex items-center justify-center">
              <Volume2 size={16} className="text-slate-900" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">2. Giọng Nói & Âm Thanh</h3>
              <p className="text-[11px] text-slate-500">Điều chỉnh âm lượng giọng đọc TTS, hiệu ứng và thể loại nhạc mặc định.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div>
                <div className="text-xs font-black text-slate-900">Bật âm thanh & giọng nói</div>
                <div className="text-[11px] text-slate-500">Phát giọng TTS và âm báo hiệu</div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={e => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>

            <div className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-black text-slate-900">
                <span>Âm lượng giọng đọc TTS</span>
                <span className="text-sky-700">{Math.round(voiceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={Math.round(voiceVolume * 100)}
                onChange={e => setVoiceVolume(Number(e.target.value) / 100)}
                className="w-full accent-slate-900 cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <Music size={13} />
                <span>Thể loại nhạc yêu thích</span>
              </label>
              <select
                value={favMusicGenre}
                onChange={e => setFavMusicGenre(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
              >
                {MUSIC_GENRES.map(genre => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* GROUP 3: NHẮC NHỞ SỨC KHỎE & KHÔNG LÀM PHIỀN */}
        <section className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-300 border-2 border-slate-900 flex items-center justify-center">
              <Bell size={16} className="text-slate-900" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">3. Nhắc Nhở Sức Khỏe & Không Làm Phiền</h3>
              <p className="text-[11px] text-slate-500">Tùy chỉnh tần suất nhắc uống nước, vận động và khung giờ yên tĩnh.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-1.5">
              <label className="block text-xs font-black text-slate-900">Nhắc uống nước (phút)</label>
              <input
                type="number"
                min={10}
                max={240}
                step={5}
                value={hydrationInterval}
                onChange={e => setHydrationInterval(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900"
              />
            </div>

            <div className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-1.5">
              <label className="block text-xs font-black text-slate-900">Nhắc vận động (phút)</label>
              <input
                type="number"
                min={15}
                max={240}
                step={5}
                value={postureInterval}
                onChange={e => setPostureInterval(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900"
              />
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div>
                <div className="text-xs font-black text-slate-900">Chế độ yên tĩnh (DND)</div>
                <div className="text-[11px] text-slate-500">Tắt thông báo làm phiền</div>
              </div>
              <input
                type="checkbox"
                checked={quietMode}
                onChange={e => setQuietMode(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>

            <div className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <Clock size={13} />
                <span>Khung giờ yên tĩnh</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={dndStartTime}
                  onChange={e => setDndStartTime(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold"
                />
                <span className="text-xs font-bold text-slate-400">–</span>
                <input
                  type="time"
                  value={dndEndTime}
                  onChange={e => setDndEndTime(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold"
                />
              </div>
            </div>
          </div>
        </section>

        {/* GROUP 4: CỬA SỔ DESKTOP & TRÍ NHỚ AI */}
        <section className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-300 border-2 border-slate-900 flex items-center justify-center">
              <Monitor size={16} className="text-slate-900" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">4. Cửa Sổ Nổi Desktop & Trí Nhớ AI</h3>
              <p className="text-[11px] text-slate-500">Quản lý hiển thị thú nổi trên màn hình và khả năng ghi nhớ của AI.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div>
                <div className="text-xs font-black text-slate-900">Hiện bong bóng thoại nổi</div>
                <div className="text-[11px] text-slate-500">Hiển thị lời thoại trên nhân vật</div>
              </div>
              <input
                type="checkbox"
                checked={desktopShowBubble}
                onChange={e => setDesktopShowBubble(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div>
                <div className="text-xs font-black text-slate-900">Cho thú tự đi dạo Desktop</div>
                <div className="text-[11px] text-slate-500">Cho phép bé di chuyển tự nhiên</div>
              </div>
              <input
                type="checkbox"
                checked={desktopAutoRoam}
                onChange={e => setDesktopAutoRoam(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div className="flex items-start gap-2">
                <Brain size={15} className="text-violet-700 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-black text-slate-900">AI học thói quen cá nhân</div>
                  <div className="text-[11px] text-slate-500">Ghi nhớ sở thích qua trò chuyện</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={aiLearningEnabled}
                onChange={e => setAiLearningEnabled(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* GROUP 5: CAMERA CẢM XÚC AI (THẤU CẢM TÂM TRẠNG) */}
        <section className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-300 border-2 border-slate-900 flex items-center justify-center">
                <Camera size={16} className="text-slate-900" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>5. Camera Cảm Xúc AI (Thấu Cảm Tâm Trạng)</span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">Mới • RAF-DB ONNX</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tự động chớp camera 1.5 giây định kỳ để nhận diện tâm trạng (Vui, Căng thẳng, Buồn bã, Tập trung) rồi tắt hẳn camera ngay.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestEmotionScan}
              disabled={testingEmotionScan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-900 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-[2px_2px_0px_#0f172a] active:translate-y-[1px] transition disabled:opacity-60"
            >
              <Camera size={13} className={testingEmotionScan ? 'animate-spin' : ''} />
              <span>{testingEmotionScan ? 'Đang mở cam quét 1.5s...' : 'Thử quét cảm xúc ngay'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <label className="md:col-span-4 flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/70 cursor-pointer">
              <div>
                <div className="text-xs font-black text-slate-900">Bật Quét Cảm Xúc Định Kỳ</div>
                <div className="text-[11px] text-slate-500">Thú tự quan tâm & an ủi khi mệt</div>
              </div>
              <input
                type="checkbox"
                checked={aiEmotionScanEnabled}
                onChange={e => setAiEmotionScanEnabled(e.target.checked)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
            </label>

            <div className="md:col-span-8 p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Chu kỳ quét nhanh (Bật 1.5s rồi tắt cam)</span>
                </label>
                <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {emotionScanInterval < 60 ? `${emotionScanInterval} giây` : `${Math.round(emotionScanInterval / 60)} phút`}
                </span>
              </div>

              {/* Fast cycle options as requested by user */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { sec: 15, label: '15s (Siêu nhanh)' },
                  { sec: 30, label: '30s (Nhanh)' },
                  { sec: 60, label: '1 phút' },
                  { sec: 120, label: '2 phút' },
                  { sec: 300, label: '5 phút (Tiết kiệm)' }
                ].map(opt => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => setEmotionScanInterval(opt.sec)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition ${
                      emotionScanInterval === opt.sec
                        ? 'bg-teal-500 text-white border-slate-900 shadow-[1px_1px_0px_#000] font-black'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {lastTestedEmotion && (
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between text-xs font-bold text-teal-900">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lastTestedEmotion.emoji}</span>
                <span>Tâm trạng gần nhất: <span className="font-black text-teal-800">{lastTestedEmotion.labelVi}</span> (Độ tin cậy: {lastTestedEmotion.confidence}%)</span>
              </div>
              <span className="text-[10px] text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">Webcam đã tắt an toàn ✓</span>
            </div>
          )}
        </section>

        {/* Save Bar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-[3px_3px_0px_#0f172a] active:translate-y-[1px] transition disabled:opacity-60"
          >
            <Save size={16} />
            <span>{saving ? 'Đang lưu cài đặt...' : 'Lưu Tất Cả Cài Đặt'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
