import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Smile,
  Mic,
  Volume2,
  VolumeX,
  RefreshCw,
  Flame,
  Clock,
  Music,
  Wind,
  Heart,
  Utensils,
  MessageSquare,
  CheckCircle2,
  Compass,
  Brain,
  Plus,
  Trash2,
  BookOpen,
  Lightbulb,
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { UserPet, AnimationState } from '../types';
import { api } from '../services/api';
import { PixelPetCanvas } from './PixelPetCanvas';
import { playTtsSpeech, stopTtsSpeech } from '../utils/tts';

interface AICompanionChatProps {
  pet: UserPet;
  onPetStateChange?: (state: AnimationState) => void;
  onMusicRequest?: (query: string, autoPlay: boolean) => void;
  onStartBreathing?: (durationMinutes: number) => void;
  onStartPomodoro?: (durationMinutes: number) => void;
  onNavigateTab?: (tab: 'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'QUESTS') => void;
  onMembershipChange?: () => Promise<void> | void;
  compact?: boolean;
  onClose?: () => void;
}

interface ChatAction {
  type:
    | 'START_POMODORO'
    | 'PLAY_MEDIA'
    | 'STOP_MUSIC'
    | 'START_BREATHING'
    | 'NAVIGATE_TAB'
    | 'JOIN_HOT_ROOM'
    | 'OPEN_MODAL'
    | 'CHANGE_ROOM'
    | 'PET_ACTION';
  duration?: number;
  category?: 'lofi_focus' | 'nature_relax' | 'funny_video';
  platform?: 'spotify' | 'youtube';
  query?: string;
  tab?: 'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'QUESTS';
  roomTopic?: string;
  roomName?: string;
  likesCount?: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'pet';
  text: string;
  timestamp: string;
  reasoning?: string;
  modelUsed?: string;
  learnedFact?: string;
  isComfortMode?: boolean;
  action?: ChatAction;
  relaxationSuggestion?: {
    type: string;
    title: string;
    description: string;
    durationMinutes: number;
  };
}

interface AITrainingItem {
  id: string;
  category: 'QA_PAIR' | 'MEMORY_FACT' | 'KNOWLEDGE_DOC';
  triggerInput: string;
  idealResponse: string;
  createdAt: number;
}

interface AIBrainState {
  config: {
    customPersona: string;
    intelligenceMode: 'DEEP_REASONING' | 'BALANCED' | 'CREATIVE';
    autoLearnMemory: boolean;
    hasCustomKey: boolean;
    customGeminiKey?: string;
  };
  items: AITrainingItem[];
  stats: {
    iqScore: number;
    qaCount: number;
    memoryCount: number;
    knowledgeCount: number;
  };
}

const MOOD_LEVELS = [
  { score: 1, emoji: '😫', label: 'Kiệt sức' },
  { score: 2, emoji: '😕', label: 'Hơi mệt' },
  { score: 3, emoji: '🙂', label: 'Bình ổn' },
  { score: 4, emoji: '😄', label: 'Hào hứng' },
  { score: 5, emoji: '🔥', label: 'Bùng nổ' }
];

const QUICK_PROMPTS = [
  {
    icon: <Flame size={13} className="text-rose-500" />,
    label: 'Phòng Làm Việc HOT',
    prompt: 'Any hãy vào phòng chủ đề làm việc đang hot nhất giúp mình nhé!'
  },
  {
    icon: <Brain size={13} className="text-violet-600" />,
    label: 'Giải thích thuật toán',
    prompt: 'Giải thích dễ hiểu thuật toán Quy hoạch động (Dynamic Programming) kèm ví dụ code ngắn gọn nhé!'
  },
  {
    icon: <Clock size={13} className="text-amber-500" />,
    label: 'Bật Pomodoro 25p',
    prompt: 'Bật đồng hồ tập trung Pomodoro 25 phút giúp mình nhé!'
  },
  {
    icon: <Music size={13} className="text-indigo-500" />,
    label: 'Mở nhạc Lofi Chill',
    prompt: 'Mở nhạc lofi chill học bài thư giãn cho mình nghe với!'
  },
  {
    icon: <Wind size={13} className="text-emerald-500" />,
    label: 'Hít thở giảm stress',
    prompt: 'Mình hơi căng thẳng, cho mình tập hít thở sâu thư giãn 2 phút nhé!'
  }
];

const TRAINING_PACKS: Array<{
  id: string;
  title: string;
  badge: string;
  description: string;
  personaAddon: string;
  items: Array<{ category: 'QA_PAIR' | 'KNOWLEDGE_DOC'; triggerInput: string; idealResponse: string }>;
}> = [
  {
    id: 'fullstack_dev',
    title: 'Chuyên Gia Lập Trình & Debug',
    badge: '💻 Code & Tech',
    description: 'Huấn luyện AI phân tích thuật toán, tìm bug React/Node.js/SQL và viết code sạch chuẩn Clean Code.',
    personaAddon:
      'Khi giải quyết vấn đề lập trình, luôn phân tích nguyên nhân gốc rễ (Root Cause), đưa đoạn code tối ưu kèm giải thích độ phức tạp thuật toán Big-O.',
    items: [
      {
        category: 'KNOWLEDGE_DOC',
        triggerInput: 'Quy chuẩn viết code & sửa lỗi (Debug)',
        idealResponse:
          'Luôn kiểm tra kiểu dữ liệu TypeScript, xử lý bất đồng bộ try/catch rõ ràng, tối ưu truy vấn cơ sở dữ liệu và giải thích từng bước sửa lỗi cho chủ nhân.'
      },
      {
        category: 'QA_PAIR',
        triggerInput: 'Làm sao để tối ưu hiệu năng React?',
        idealResponse:
          'Để tối ưu React hiệu quả, chủ nhân nên: 1) Tách nhỏ state để tránh re-render thừa; 2) Dùng React.memo / useMemo / useCallback cho phép tính nặng; 3) Ảo hóa danh sách dài (Virtualization); 4) Code-splitting bằng React.lazy.'
      }
    ]
  },
  {
    id: 'english_academic',
    title: 'Gia Sư Tiếng Anh & Học Thuật',
    badge: '📚 IELTS & Khoa Học',
    description: 'Dạy AI sửa ngữ pháp tiếng Anh, nâng cấp từ vựng Band 8.0+ và giải thích Toán/Khoa học bằng phương pháp Feynman.',
    personaAddon:
      'Khi chủ nhân hỏi tiếng Anh hoặc kiến thức học thuật, hãy giải thích cặn kẽ bằng phương pháp Feynman (đơn giản hóa khái niệm phức tạp) và cho ví dụ thực tế.',
    items: [
      {
        category: 'KNOWLEDGE_DOC',
        triggerInput: 'Phương pháp dạy Tiếng Anh & Học thuật',
        idealResponse:
          'Khi chủ nhân nhờ dịch hoặc viết tiếng Anh, hãy cung cấp bản tự nhiên (Natural), bản học thuật (Academic IELTS 8.0+) và giải thích các cấu trúc ngữ pháp ăn điểm.'
      },
      {
        category: 'QA_PAIR',
        triggerInput: 'Cách học từ vựng nhớ lâu nhất là gì?',
        idealResponse:
          'Phương pháp hiệu quả nhất là Spaced Repetition (Lặp lại ngắt quãng: ôn sau 1 ngày, 3 ngày, 7 ngày, 21 ngày) kết hợp đặt câu trực tiếp với ngữ cảnh công việc của chủ nhân ạ!'
      }
    ]
  },
  {
    id: 'deep_work_coach',
    title: 'Cố Vấn Năng Suất & Tâm Lý',
    badge: '🚀 Deep Work',
    description: 'Huấn luyện AI lập kế hoạch theo ma trận Eisenhower, quản trị năng lượng và cân bằng cảm xúc.',
    personaAddon:
      'Luôn giúp chủ nhân sắp xếp thứ tự ưu tiên công việc thông minh theo nguyên lý 80/20 (Pareto) và ma trận Eisenhower.',
    items: [
      {
        category: 'KNOWLEDGE_DOC',
        triggerInput: 'Chiến lược quản lý thời gian Deep Work',
        idealResponse:
          'Ưu tiên giải quyết việc khó nhất (Eat That Frog) vào 2 khung giờ vàng buổi sáng bằng 2 phiên Pomodoro 25 phút liên tiếp, tắt thông báo gây xao nhãng.'
      },
      {
        category: 'QA_PAIR',
        triggerInput: 'Mình có quá nhiều việc không biết bắt đầu từ đâu',
        idealResponse:
          'Chủ nhân bình tĩnh hít một hơi sâu nhé! Hãy liệt kê 3 đầu việc quan trọng nhất hôm nay cho em. Chúng mình sẽ chọn đúng 1 việc tạo ra 80% kết quả và bật Pomodoro 25 phút xử lý gọn việc đó trước tiên ạ! 💪'
      }
    ]
  }
];

const EMOJI_LIST = ['🐾', '✨', '🔥', '💖', '🎵', '☕', '💪', '🎉', '🌿', '😸', '🥰', '🧠'];

export const AICompanionChat: React.FC<AICompanionChatProps> = ({
  pet,
  onPetStateChange,
  onMusicRequest,
  onStartBreathing,
  onStartPomodoro,
  onNavigateTab,
  onMembershipChange,
  compact = false,
  onClose
}) => {
  const getInitialGreeting = (): ChatMessage => ({
    id: 'welcome',
    sender: 'pet',
    text: `Chào chủ nhân! 🐾 Em là ${pet.name} (Cấp ${pet.level}) đây ạ! Bộ não AI của em đã được nâng cấp với khả năng **Suy luận sâu (Deep Reasoning)** và **Bộ nhớ dài hạn**. Chủ nhân có thể hỏi em bất kỳ kiến thức nào (Lập trình, Toán học, Ngoại ngữ, Lập kế hoạch...), bảo em *"vào phòng chủ đề làm việc"*, hoặc bấm nút **"Huấn Luyện AI"** để dạy thêm kiến thức riêng cho em nhé! 🧠✨`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'AI Brain v2 • Deep Reasoning'
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getInitialGreeting()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number>(4);
  const [moodFeedback, setMoodFeedback] = useState<string | null>(null);
  const [moodBusy, setMoodBusy] = useState(false);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});

  // AI Brain & Training Studio States
  const [brainState, setBrainState] = useState<AIBrainState>({
    config: {
      customPersona: '',
      intelligenceMode: 'DEEP_REASONING',
      autoLearnMemory: true,
      hasCustomKey: false,
      customGeminiKey: ''
    },
    items: [],
    stats: {
      iqScore: 135,
      qaCount: 1,
      memoryCount: 1,
      knowledgeCount: 1
    }
  });
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [trainingTab, setTrainingTab] = useState<'TEACH' | 'MEMORY' | 'CONFIG'>('TEACH');
  const [trainCategory, setTrainCategory] = useState<'QA_PAIR' | 'KNOWLEDGE_DOC' | 'MEMORY_FACT'>('QA_PAIR');
  const [trainTrigger, setTrainTrigger] = useState('');
  const [trainResponse, setTrainResponse] = useState('');
  const [trainBusy, setTrainBusy] = useState(false);
  const [trainToast, setTrainToast] = useState<string | null>(null);

  // Config draft states
  const [personaDraft, setPersonaDraft] = useState('');
  const [modeDraft, setModeDraft] = useState<'DEEP_REASONING' | 'BALANCED' | 'CREATIVE'>('DEEP_REASONING');
  const [autoLearnDraft, setAutoLearnDraft] = useState(true);
  const [customKeyDraft, setCustomKeyDraft] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const loadAIBrain = async () => {
    try {
      const res = await api.getAIBrain();
      if (res.data) {
        setBrainState(res.data);
        setPersonaDraft(res.data.config?.customPersona || '');
        setModeDraft(res.data.config?.intelligenceMode || 'DEEP_REASONING');
        setAutoLearnDraft(Boolean(res.data.config?.autoLearnMemory ?? true));
      }
    } catch {
      // Ignore error on initial load
    }
  };

  useEffect(() => {
    void loadAIBrain();
    api
      .getChatHistory()
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setMessages([getInitialGreeting(), ...res.data.slice(-24)]);
        }
      })
      .catch(() => {});
  }, [pet.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleMoodSelect = async (score: number) => {
    setSelectedMood(score);
    setMoodBusy(true);
    try {
      const res = await api.checkMood(score);
      if (res.data?.aiRecommendation) {
        setMoodFeedback(res.data.aiRecommendation);
      }
    } catch {
      setMoodFeedback('Cảm ơn chủ nhân đã chia sẻ cảm xúc hôm nay cùng em nhé! 💖');
    } finally {
      setMoodBusy(false);
    }
  };

  const executeChatAction = async (action?: ChatAction, musicAction?: { query: string; autoPlay: boolean }) => {
    if (!action && !musicAction) return;

    if (action?.type === 'JOIN_HOT_ROOM') {
      await onMembershipChange?.();
      onNavigateTab?.('GARDEN');
      return;
    }

    if (action?.type === 'NAVIGATE_TAB' && action.tab) {
      onNavigateTab?.(action.tab);
      return;
    }

    if (action?.type === 'START_BREATHING' && onStartBreathing) {
      onStartBreathing(action.duration || 2);
      return;
    }

    if (action?.type === 'START_POMODORO' && onStartPomodoro) {
      onStartPomodoro(action.duration || 25);
      return;
    }

    if (musicAction && onMusicRequest) {
      onMusicRequest(musicAction.query || 'nhạc lofi chill học bài', musicAction.autoPlay ?? true);
    } else if (action?.type === 'PLAY_MEDIA' && onMusicRequest) {
      onMusicRequest(action.query || 'nhạc lofi chill học bài', true);
    }
  };

  const sendMessageText = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowEmojiPicker(false);
    setIsLoading(true);

    try {
      const res = await api.chatWithAI(trimmed);
      const data = res.data;

      const petMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'pet',
        text: data.reply,
        reasoning: data.reasoning,
        modelUsed: data.modelUsed,
        learnedFact: data.learnedFact,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isComfortMode: data.isComfortMode,
        action: data.action,
        relaxationSuggestion: data.relaxationSuggestion
      };

      setMessages(prev => [...prev, petMsg]);

      if (data.learnedFact) {
        void loadAIBrain();
      }

      if (data.petStateChange) {
        onPetStateChange?.(data.petStateChange as AnimationState);
      }

      if (ttsEnabled && data.reply) {
        // Read a concise summary if reply is long markdown
        const cleanSpeech = data.reply
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[*#_`~>-]/g, '')
          .slice(0, 260);
        playTtsSpeech(cleanSpeech);
      }

      if (data.action || data.musicAction) {
        await executeChatAction(data.action, data.musicAction);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'pet',
          text: `${pet.name} luôn ở ngay đây lắng nghe chủ nhân! Chủ nhân cần giải đáp kiến thức, mở nhạc Lofi hay vào phòng làm việc HOT thì cứ bảo em nhé! 🐾✨`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageText(input);
  };

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainTrigger.trim() || !trainResponse.trim() || trainBusy) return;
    setTrainBusy(true);
    setTrainToast(null);
    try {
      const res = await api.trainAIBrain({
        category: trainCategory,
        triggerInput: trainTrigger.trim(),
        idealResponse: trainResponse.trim()
      });
      if (res.data) {
        setBrainState({
          config: res.data.config || brainState.config,
          items: res.data.items || [],
          stats: res.data.stats || brainState.stats
        });
        setTrainTrigger('');
        setTrainResponse('');
        setTrainToast(res.data.message || 'Đã huấn luyện AI thành công (+15 EXP)! 🧠✨');
      }
    } catch (err: any) {
      setTrainToast(err?.response?.data?.error || 'Không thể lưu dữ liệu huấn luyện.');
    } finally {
      setTrainBusy(false);
    }
  };

  const handleInstallTrainingPack = async (pack: (typeof TRAINING_PACKS)[number]) => {
    if (trainBusy) return;
    setTrainBusy(true);
    setTrainToast(null);
    try {
      for (const item of pack.items) {
        await api.trainAIBrain(item);
      }
      const nextPersona = personaDraft.includes(pack.personaAddon)
        ? personaDraft
        : `${personaDraft ? personaDraft + '\n' : ''}${pack.personaAddon}`;
      const res = await api.updateAIBrainConfig({
        customPersona: nextPersona,
        intelligenceMode: 'DEEP_REASONING'
      });
      if (res.data) {
        setBrainState(res.data);
        setPersonaDraft(res.data.config.customPersona);
        setModeDraft(res.data.config.intelligenceMode);
      }
      setTrainToast(`Đã nạp gói huấn luyện "${pack.title}" vào não bộ AI (+30 EXP)! 🚀🧠`);
    } catch {
      setTrainToast('Có lỗi khi nạp gói huấn luyện.');
    } finally {
      setTrainBusy(false);
    }
  };

  const handleDeleteTrainingItem = async (id: string) => {
    try {
      const res = await api.deleteAITrainingItem(id);
      if (res.data) {
        setBrainState({
          config: res.data.config || brainState.config,
          items: res.data.items || [],
          stats: res.data.stats || brainState.stats
        });
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveBrainConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trainBusy) return;
    setTrainBusy(true);
    setTrainToast(null);
    try {
      const res = await api.updateAIBrainConfig({
        customPersona: personaDraft,
        intelligenceMode: modeDraft,
        autoLearnMemory: autoLearnDraft,
        ...(customKeyDraft.trim() ? { customGeminiKey: customKeyDraft.trim() } : {})
      });
      if (res.data) {
        setBrainState(res.data);
        setCustomKeyDraft('');
        setTrainToast('Đã lưu cấu hình Tư duy & Não bộ AI thành công! 🧠✨');
      }
    } catch {
      setTrainToast('Không thể lưu cấu hình AI.');
    } finally {
      setTrainBusy(false);
    }
  };

  const toggleVoiceDictation = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setInput('Any hãy vào phòng chủ đề làm việc');
      return;
    }

    if (isListeningVoice && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListeningVoice(true);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          void sendMessageText(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleClearChat = async () => {
    stopTtsSpeech();
    try {
      await api.clearChatHistory();
    } catch {}
    setMessages([getInitialGreeting()]);
  };

  const renderActionCard = (m: ChatMessage) => {
    if (!m.action) return null;

    if (m.action.type === 'JOIN_HOT_ROOM') {
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shrink-0">
              <Flame size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 truncate">
                {m.action.roomName || 'Phòng Chủ Đề Đang HOT'}
              </div>
              <div className="text-[11px] text-amber-800 font-bold">
                🔥 {m.action.likesCount ?? 0} lượt Like • Đã tự động tham gia phòng
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('GARDEN')}
            className="px-3 py-1.5 rounded-lg bg-[#231e36] hover:bg-slate-800 text-amber-300 font-black text-[11px] border-2 border-slate-900 shrink-0 transition"
          >
            Mở Khu Vườn
          </button>
        </div>
      );
    }

    if (m.action.type === 'START_POMODORO') {
      const mins = m.action.duration || 25;
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">Phiên Tập Trung Pomodoro ({mins} phút)</div>
              <div className="text-[11px] text-emerald-800 font-bold">Hoàn thành nhận +{mins * 2} EXP</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartPomodoro?.(mins)}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] border-2 border-slate-900 shrink-0 transition"
          >
            Bắt đầu ngay
          </button>
        </div>
      );
    }

    if (m.action.type === 'START_BREATHING') {
      const mins = m.action.duration || 2;
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-sky-50 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-300 border-2 border-slate-900 flex items-center justify-center text-slate-950 shrink-0">
              <Wind size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">Hít Thở Sâu 4-7-8 ({mins} phút)</div>
              <div className="text-[11px] text-sky-800 font-bold">Giảm căng thẳng & phục hồi năng lượng</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartBreathing?.(mins)}
            className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-[11px] border-2 border-slate-900 shrink-0 transition"
          >
            Tập thở ngay
          </button>
        </div>
      );
    }

    if (m.action.type === 'PLAY_MEDIA') {
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-indigo-50 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-400 border-2 border-slate-900 flex items-center justify-center text-white shrink-0">
              <Music size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 truncate">
                {m.action.query && !m.action.query.startsWith('__')
                  ? `Phát nhạc: ${m.action.query}`
                  : 'Đài Phát Nhạc Lofi Chill'}
              </div>
              <div className="text-[11px] text-indigo-800 font-bold">Âm nhạc giúp tăng sự tập trung</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onMusicRequest?.(m.action?.query || 'nhạc lofi chill học bài', true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] border-2 border-slate-900 shrink-0 transition"
          >
            Phát ngay
          </button>
        </div>
      );
    }

    return null;
  };

  // Format markdown-like content (code blocks & bold text) cleanly
  const renderFormattedMessage = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0]?.trim() || '';
        const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
        const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
        return (
          <pre
            key={idx}
            className="my-2 p-3 rounded-xl bg-[#181528] text-emerald-300 border-2 border-slate-900 font-mono text-[11.5px] overflow-x-auto leading-relaxed"
          >
            {hasLang && (
              <div className="text-[9px] font-black uppercase tracking-wider text-amber-300 mb-1 border-b border-slate-700 pb-1">
                {firstLine}
              </div>
            )}
            <code>{codeContent}</code>
          </pre>
        );
      }

      // Render bold **...** segments
      const boldSegments = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx} className="whitespace-pre-line">
          {boldSegments.map((seg, sIdx) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
              return (
                <strong key={sIdx} className="font-black">
                  {seg.slice(2, -2)}
                </strong>
              );
            }
            return seg;
          })}
        </span>
      );
    });
  };

  const todayFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const qaAndKnowledgeItems = brainState.items.filter(
    i => i.category === 'QA_PAIR' || i.category === 'KNOWLEDGE_DOC'
  );
  const memoryItems = brainState.items.filter(i => i.category === 'MEMORY_FACT');

  if (compact) {
    return (
      <div className="bg-[#fffdfa] flex min-h-0 min-w-0 flex-col h-full w-full overflow-hidden font-sans text-slate-800 select-text">
        <div className="bg-[#f7f2e7] px-3 py-1.5 text-slate-800 flex items-center justify-between border-b border-slate-200 shrink-0 select-none">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700">
            <Brain size={13} className="text-indigo-600" />
            <span>Trí tuệ AI • IQ {brainState.stats.iqScore}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (!next) stopTtsSpeech();
            }}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 transition ${
              ttsEnabled
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-slate-200 text-slate-600 border-slate-300'
            }`}
          >
            {ttsEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
            <span>{ttsEnabled ? 'Đọc giọng nói: BẬT' : 'Đọc giọng nói: TẮT'}</span>
          </button>
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#f7f2e7]/60 text-xs min-h-0">
          {messages.map(m => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[90%] p-2.5 rounded-2xl border ${
                  m.sender === 'user'
                    ? 'bg-[#231e36] text-white border-slate-900 rounded-tr-none'
                    : 'bg-white border-slate-300 text-slate-800 rounded-tl-none shadow-xs'
                }`}
              >
                <div className="leading-relaxed">{renderFormattedMessage(m.text)}</div>
                {renderActionCard(m)}
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">{m.timestamp}</span>
            </div>
          ))}
          {isLoading && (
            <div className="text-[11px] text-slate-500 italic px-1 animate-pulse">
              🧠 {pet.name} đang suy nghĩ câu trả lời...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompt Bar */}
        <div className="px-2.5 py-1.5 bg-[#f7f2e7] border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
          {[
            { label: '💡 Mẹo tập trung', text: 'Gợi ý giúp mình cách tập trung làm việc hiệu quả!' },
            { label: '🎵 Mở nhạc Lofi', text: 'Mở giúp mình một bản nhạc Lofi thư giãn để code nhé!' },
            { label: '⏱️ Hẹn giờ 25p', text: 'Bắt đầu phiên Pomodoro 25 phút giúp mình!' },
            { label: '😄 Kể chuyện vui', text: 'Kể cho mình nghe một câu chuyện vui xả stress đi!' }
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => void sendMessageText(chip.text)}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-amber-50 border border-slate-300 text-[10px] font-bold text-slate-700 whitespace-nowrap shrink-0 transition"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-2 bg-white border-t-2 border-slate-900 flex gap-1.5 shrink-0">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Hỏi ${pet.name} bất cứ điều gì...`}
            className="flex-1 min-w-0 px-3 py-1.5 border-2 border-slate-300 focus:border-slate-900 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none font-bold rounded-xl text-xs shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* ================= LEFT COLUMN (4 COLS): LIVE PIXEL PET, AI BRAIN IQ & MOOD CHECK-IN ================= */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Card 1: Live Pet Avatar & AI Intelligence Stats */}
        <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a] overflow-hidden">
          <div className="bg-[#181528] px-4 py-3 border-b-2 border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-slate-950" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                Trợ Lý Trí Tuệ Nhân Tạo
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] border border-slate-950 flex items-center gap-1">
              <Brain size={11} />
              IQ {brainState.stats.iqScore}
            </span>
          </div>

          <div className="p-4">
            {/* Live PixelPetCanvas Preview */}
            <div className="relative h-44 rounded-xl bg-gradient-to-b from-[#231e36] via-[#2d2647] to-[#181528] border-2 border-slate-900 flex flex-col items-center justify-center overflow-hidden shadow-inner">
              <div className="scale-90">
                <PixelPetCanvas
                  petType={pet.petType}
                  currentState={pet.currentState}
                  scaleSize="MEDIUM"
                  equippedItems={pet.userItems}
                  disableWander
                />
              </div>
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-amber-400/40 text-[10px] font-black text-amber-300 flex items-center gap-1.5">
                <Sparkles size={11} className="text-amber-400" />
                <span>
                  {brainState.config.intelligenceMode === 'DEEP_REASONING'
                    ? 'Suy Luận Sâu (Deep LLM)'
                    : brainState.config.intelligenceMode === 'CREATIVE'
                    ? 'Sáng Tạo (Creative LLM)'
                    : 'Cân Bằng (Smart LLM)'}
                </span>
              </div>
              <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                Cấp {pet.level} • {pet.exp} EXP
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900">{pet.name}</h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  {pet.petType?.name || 'Mochi Neko'} • Đã học {brainState.items.length} tri thức & ký ức
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.('PET')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-800 font-bold text-[11px] border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] transition"
              >
                Về Phòng Pet
              </button>
            </div>

            {/* AI Brain Summary & Train Button */}
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-violet-950 via-[#231e36] to-indigo-950 text-white border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain size={14} className="text-amber-400" />
                  Não Bộ & Huấn Luyện AI
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-300">
                  {brainState.stats.qaCount + brainState.stats.knowledgeCount} bài dạy • {brainState.stats.memoryCount} ký ức
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-2.5">
                Dạy thêm kiến thức chuyên môn, tình huống Hỏi-Đáp hoặc quy tắc tư duy để {pet.name} ngày càng thông minh hơn (+15 EXP/lần dạy).
              </p>
              <button
                type="button"
                onClick={() => setIsTrainingModalOpen(true)}
                className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition flex items-center justify-center gap-1.5"
              >
                <Zap size={14} />
                <span>Huấn Luyện Trí Tuệ AI (Train AI)</span>
              </button>
            </div>

            {/* Real Pet Status Bars */}
            <div className="mt-3 space-y-2 pt-3 border-t border-slate-200 text-xs">
              <div>
                <div className="flex justify-between font-bold text-[11px] mb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Heart size={12} className="text-rose-500" /> Độ hạnh phúc
                  </span>
                  <span className="font-mono font-black text-rose-600">{pet.happiness}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-300">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, pet.happiness))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-[11px] mb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Utensils size={12} className="text-amber-600" /> Độ no bụng
                  </span>
                  <span className="font-mono font-black text-amber-600">{pet.hunger}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-300">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, pet.hunger))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Interactive Mood Check-in */}
        <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_#0f172a]">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎭 Tâm Trạng Của Bạn Hôm Nay</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400">Chạm để chấm</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {MOOD_LEVELS.map(m => {
              const active = selectedMood === m.score;
              return (
                <button
                  key={m.score}
                  type="button"
                  disabled={moodBusy}
                  onClick={() => void handleMoodSelect(m.score)}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center transition ${
                    active
                      ? 'bg-amber-400 border-slate-900 text-slate-950 font-black shadow-[0_2px_0_#0f172a] -translate-y-0.5'
                      : 'bg-white hover:bg-amber-50 border-slate-200 text-slate-600 font-bold'
                  }`}
                >
                  <span className="text-lg leading-none">{m.emoji}</span>
                  <span className="text-[9.5px] mt-1 truncate max-w-full">{m.label}</span>
                </button>
              );
            })}
          </div>

          {moodFeedback && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-medium leading-relaxed flex items-start gap-2">
              <CheckCircle2 size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>{moodFeedback}</span>
            </div>
          )}
        </div>

        {/* Card 3: Long-Term Memory Preview */}
        <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_#0f172a]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb size={14} className="text-amber-500" />
              <span>Ký Ức AI Nhớ Về Bạn</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setTrainingTab('MEMORY');
                setIsTrainingModalOpen(true);
              }}
              className="text-[10px] font-black text-violet-700 hover:underline"
            >
              + Thêm ký ức
            </button>
          </div>
          {memoryItems.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Hãy nói với AI những câu như <em>"Hãy nhớ mình đang làm đồ án React"</em> để AI tự động ghi nhớ!
            </p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {memoryItems.slice(0, 4).map(mem => (
                <div
                  key={mem.id}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-black text-slate-900">{mem.triggerInput}: </span>
                    <span className="line-clamp-1">{mem.idealResponse}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT COLUMN (8 COLS): MAIN CHAT CONSOLE ================= */}
      <div className="lg:col-span-8 bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a] flex flex-col h-[700px] overflow-hidden">
        {/* Top Chat Header */}
        <div className="px-5 py-3.5 bg-[#181528] text-white border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-slate-950 flex items-center justify-center text-slate-950 font-black shadow-[2px_2px_0px_#000]">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white">Trò Chuyện Sâu Cùng {pet.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                  Deep LLM Online
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Giải đáp kiến thức, viết code, dịch thuật, tâm sự & điều khiển phòng HOT bằng tiếng Việt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsTrainingModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-black border-2 border-slate-950 bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition flex items-center gap-1.5"
              title="Mở phòng huấn luyện & dạy thêm kiến thức cho AI"
            >
              <Brain size={13} />
              <span>Huấn Luyện AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next) stopTtsSpeech();
              }}
              title={ttsEnabled ? 'Đang bật đọc giọng nói tiếng Việt' : 'Đang tắt đọc giọng nói'}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black border-2 border-slate-950 flex items-center gap-1.5 transition ${
                ttsEnabled ? 'bg-[#231e36] text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span className="hidden sm:inline">{ttsEnabled ? 'Giọng đọc: Bật' : 'Giọng đọc: Tắt'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleClearChat()}
              title="Làm mới cuộc trò chuyện"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-2 border-slate-950 transition"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Quick 1-Click Action Prompts Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
            <Compass size={12} /> Gợi ý:
          </span>
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => void sendMessageText(item.prompt)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-slate-800 font-bold text-[11px] border border-slate-300 hover:border-slate-900 shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition shrink-0 cursor-pointer"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#faf8f5]">
          <div className="text-center">
            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-full text-[10px] font-bold shadow-2xs">
              Hôm nay • {todayFormatted}
            </span>
          </div>

          {messages.map(m => {
            const isUser = m.sender === 'user';
            const isReasoningExpanded = Boolean(expandedReasoningIds[m.id]);
            return (
              <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-end gap-2.5 max-w-[90%] sm:max-w-[82%]">
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#231e36] border-2 border-slate-900 flex items-center justify-center text-amber-300 font-black text-xs shrink-0 shadow-[2px_2px_0px_#0f172a]">
                      {pet.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Optional Reasoning Chain-of-Thought Badge */}
                    {!isUser && m.reasoning && (
                      <div className="mb-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReasoningIds(prev => ({ ...prev, [m.id]: !prev[m.id] }))
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-900 border border-violet-300 text-[10.5px] font-black transition"
                        >
                          <Brain size={12} className="text-violet-700" />
                          <span>💭 Xem luồng suy luận tư duy của AI</span>
                          {isReasoningExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isReasoningExpanded && (
                          <div className="mt-1.5 p-2.5 rounded-xl bg-violet-50/90 border border-violet-200 text-[11px] text-violet-900 font-mono leading-relaxed">
                            {m.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`px-4 py-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] ${
                        isUser
                          ? 'bg-[#231e36] text-white rounded-br-xs font-medium'
                          : m.isComfortMode
                          ? 'bg-amber-50 text-slate-900 rounded-bl-xs font-medium'
                          : 'bg-white text-slate-800 rounded-bl-xs font-medium'
                      }`}
                    >
                      <div>{renderFormattedMessage(m.text)}</div>
                    </div>

                    {/* Auto-Learned Memory Badge */}
                    {!isUser && m.learnedFact && (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-600 shrink-0" />
                        <span>Đã tự động ghi nhớ vào Bộ nhớ dài hạn: {m.learnedFact}</span>
                      </div>
                    )}

                    {/* Dynamic Action Card */}
                    {!isUser && renderActionCard(m)}

                    {/* Relaxation Suggestion Card */}
                    {!isUser && m.relaxationSuggestion && !m.action && (
                      <div className="mt-2 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-700/40 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-emerald-950">
                            🌿 {m.relaxationSuggestion.title}
                          </div>
                          <div className="text-[11px] text-emerald-800 mt-0.5">
                            {m.relaxationSuggestion.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onStartBreathing?.(m.relaxationSuggestion?.durationMinutes || 2)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 transition"
                        >
                          Thực hiện ({m.relaxationSuggestion.durationMinutes}p)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <span className={`text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5 ${isUser ? 'mr-1' : 'ml-11'}`}>
                  <span>{isUser ? `Bạn • ${m.timestamp}` : `${pet.name} • ${m.timestamp}`}</span>
                  {!isUser && m.modelUsed && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600 text-[9px] font-bold">
                      {m.modelUsed}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#231e36] border-2 border-slate-900 flex items-center justify-center text-amber-300 font-black text-xs">
                {pet.name.charAt(0).toUpperCase()}
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-white border-2 border-slate-900 text-xs text-slate-600 font-bold flex items-center gap-2 shadow-[2px_2px_0px_#0f172a]">
                <Brain size={14} className="text-violet-600 animate-pulse" />
                <span>{pet.name} đang suy luận & tổng hợp câu trả lời...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="p-3.5 bg-white border-t-2 border-slate-900 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-4 z-20 p-2 bg-white border-2 border-slate-900 rounded-xl shadow-[3px_3px_0px_#0f172a] flex flex-wrap gap-1.5 max-w-xs">
              {EMOJI_LIST.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setInput(prev => prev + em);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-amber-100 flex items-center justify-center text-base transition"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="p-2.5 text-slate-600 hover:text-slate-950 hover:bg-amber-50 rounded-xl border-2 border-slate-900 transition shrink-0"
              title="Chèn biểu tượng cảm xúc"
            >
              <Smile size={18} />
            </button>

            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Hỏi bất kỳ kiến thức nào hoặc bảo "${pet.name} hãy vào phòng chủ đề làm việc"...`}
              disabled={isLoading}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white transition"
            />

            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`p-2.5 rounded-xl border-2 border-slate-900 transition shrink-0 ${
                isListeningVoice
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-amber-100 text-slate-700'
              }`}
              title="Nói bằng giọng nói tiếng Việt"
            >
              <Mic size={18} />
            </button>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Gửi</span>
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* ================= AI TRAINING STUDIO MODAL (PHÒNG HUẤN LUYỆN TRÍ TUỆ AI) ================= */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-3 border-slate-950 rounded-2xl shadow-[6px_6px_0px_#000] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#181528] text-white border-b-2 border-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 border-2 border-slate-950 flex items-center justify-center text-slate-950 font-black shadow-[2px_2px_0px_#000]">
                  <Brain size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base text-white">
                      Phòng Huấn Luyện Trí Tuệ AI ({pet.name})
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-black text-[10px]">
                      IQ {brainState.stats.iqScore}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Nạp kiến thức chuyên môn, tình huống Hỏi-Đáp & quản lý Bộ nhớ dài hạn cho trợ lý AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTrainingModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-950"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="px-5 py-2.5 bg-slate-100 border-b-2 border-slate-900 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTrainingTab('TEACH')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${
                  trainingTab === 'TEACH'
                    ? 'bg-amber-400 border-slate-900 text-slate-950 shadow-[0_2px_0_#0f172a]'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BookOpen size={14} />
                <span>Dạy Hỏi-Đáp & Kiến Thức ({qaAndKnowledgeItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTrainingTab('MEMORY')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${
                  trainingTab === 'MEMORY'
                    ? 'bg-amber-400 border-slate-900 text-slate-950 shadow-[0_2px_0_#0f172a]'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Lightbulb size={14} />
                <span>Bộ Nhớ Dài Hạn ({memoryItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTrainingTab('CONFIG')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${
                  trainingTab === 'CONFIG'
                    ? 'bg-amber-400 border-slate-900 text-slate-950 shadow-[0_2px_0_#0f172a]'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings size={14} />
                <span>Cấu Hình Tư Duy & Mô Hình</span>
              </button>
            </div>

            {trainToast && (
              <div className="mx-5 mt-3 px-3.5 py-2 rounded-xl bg-emerald-50 border-2 border-emerald-600 text-emerald-950 text-xs font-bold flex items-center justify-between">
                <span>{trainToast}</span>
                <button type="button" onClick={() => setTrainToast(null)} className="text-emerald-700 font-black">
                  ✕
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {trainingTab === 'TEACH' && (
                <>
                  {/* 1-Click Starter Packs */}
                  <div>
                    <div className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" />
                      <span>Nạp Nhanh Gói Kiến Thức Chuyên Gia (1 Chạm = +30 EXP)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {TRAINING_PACKS.map(pack => (
                        <div
                          key={pack.id}
                          className="p-3 rounded-xl bg-white border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex flex-col justify-between"
                        >
                          <div>
                            <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-900 font-black text-[10px]">
                              {pack.badge}
                            </span>
                            <h4 className="font-black text-xs text-slate-900 mt-1.5">{pack.title}</h4>
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">{pack.description}</p>
                          </div>
                          <button
                            type="button"
                            disabled={trainBusy}
                            onClick={() => void handleInstallTrainingPack(pack)}
                            className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-[#231e36] hover:bg-slate-800 text-amber-300 font-black text-[11px] border border-slate-950 transition"
                          >
                            + Nạp Gói Này Vào Não AI
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Teach Form */}
                  <form
                    onSubmit={handleTrainSubmit}
                    className="p-4 rounded-xl bg-amber-50/70 border-2 border-slate-900 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={14} />
                        <span>Tự Dạy Tình Huống Mới Cho AI (+15 EXP)</span>
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTrainCategory('QA_PAIR')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                            trainCategory === 'QA_PAIR'
                              ? 'bg-slate-900 text-amber-300 border-slate-900'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          Cặp Hỏi - Đáp mẫu
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrainCategory('KNOWLEDGE_DOC')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                            trainCategory === 'KNOWLEDGE_DOC'
                              ? 'bg-slate-900 text-amber-300 border-slate-900'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          Tài liệu Kiến thức
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        {trainCategory === 'QA_PAIR'
                          ? 'Khi chủ nhân hỏi hoặc nói câu này:'
                          : 'Chủ đề / Tên kiến thức:'}
                      </label>
                      <input
                        type="text"
                        required
                        value={trainTrigger}
                        onChange={e => setTrainTrigger(e.target.value)}
                        placeholder={
                          trainCategory === 'QA_PAIR'
                            ? 'VD: Đồ án của mình gồm những phần nào?'
                            : 'VD: Kiến trúc dự án OfficePet của tôi'
                        }
                        className="w-full px-3 py-2 rounded-lg bg-white border-2 border-slate-900 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        {trainCategory === 'QA_PAIR'
                          ? 'Cách AI suy luận & trả lời chuẩn xác:'
                          : 'Nội dung kiến thức / Quy tắc chi tiết để AI học:'}
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={trainResponse}
                        onChange={e => setTrainResponse(e.target.value)}
                        placeholder="Nhập nội dung kiến thức hoặc câu trả lời mẫu bạn muốn AI ghi nhớ..."
                        className="w-full px-3 py-2 rounded-lg bg-white border-2 border-slate-900 text-xs font-medium"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={trainBusy || !trainTrigger.trim() || !trainResponse.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] transition"
                      >
                        {trainBusy ? 'Đang nạp vào não AI...' : '🧠 Dạy Cho AI Ngay (+15 EXP)'}
                      </button>
                    </div>
                  </form>

                  {/* List of Trained Q&A and Knowledge */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Danh sách Kiến thức & Tình huống AI đã học ({qaAndKnowledgeItems.length})
                    </div>
                    {qaAndKnowledgeItems.map(item => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-900 transition flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                item.category === 'QA_PAIR'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-indigo-100 text-indigo-900'
                              }`}
                            >
                              {item.category === 'QA_PAIR' ? 'Hỏi - Đáp' : 'Kiến Thức'}
                            </span>
                            <span className="font-black text-xs text-slate-900">{item.triggerInput}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{item.idealResponse}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setIsTrainingModalOpen(false);
                              void sendMessageText(item.triggerInput);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-800 font-bold text-[10px] border border-slate-300"
                          >
                            Thử hỏi
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTrainingItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {trainingTab === 'MEMORY' && (
                <div className="space-y-4">
                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      if (!trainTrigger.trim() || !trainResponse.trim() || trainBusy) return;
                      setTrainBusy(true);
                      try {
                        const res = await api.trainAIBrain({
                          category: 'MEMORY_FACT',
                          triggerInput: trainTrigger.trim(),
                          idealResponse: trainResponse.trim()
                        });
                        if (res.data) {
                          setBrainState({
                            config: res.data.config || brainState.config,
                            items: res.data.items || [],
                            stats: res.data.stats || brainState.stats
                          });
                          setTrainTrigger('');
                          setTrainResponse('');
                          setTrainToast('Đã lưu thông tin vào Bộ nhớ dài hạn của AI (+15 EXP)! 💡');
                        }
                      } finally {
                        setTrainBusy(false);
                      }
                    }}
                    className="p-4 rounded-xl bg-emerald-50/70 border-2 border-slate-900 space-y-3"
                  >
                    <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      + Thêm Ký Ức Dài Hạn Về Bạn (Sở thích, Mục tiêu, Dự án đang làm...)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        required
                        value={trainTrigger}
                        onChange={e => setTrainTrigger(e.target.value)}
                        placeholder="Nhãn (VD: Mục tiêu năm nay)"
                        className="px-3 py-2 rounded-lg bg-white border-2 border-slate-900 text-xs font-medium"
                      />
                      <input
                        type="text"
                        required
                        value={trainResponse}
                        onChange={e => setTrainResponse(e.target.value)}
                        placeholder="Nội dung (VD: Đạt học bổng loại Giỏi & hoàn thành đồ án)"
                        className="sm:col-span-2 px-3 py-2 rounded-lg bg-white border-2 border-slate-900 text-xs font-medium"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={trainBusy || !trainTrigger.trim() || !trainResponse.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a]"
                      >
                        Lưu Vào Bộ Nhớ AI (+15 EXP)
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Các thông tin AI đang ghi nhớ về bạn ({memoryItems.length})
                    </div>
                    {memoryItems.map(item => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="text-xs">
                          <strong className="font-black text-slate-900">{item.triggerInput}: </strong>
                          <span className="text-slate-700">{item.idealResponse}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTrainingItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trainingTab === 'CONFIG' && (
                <form onSubmit={handleSaveBrainConfig} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                      1. Chế độ Trí tuệ & Suy luận (Intelligence Mode)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          id: 'DEEP_REASONING',
                          title: '🧠 Suy Luận Sâu (Deep LLM)',
                          desc: 'Phân tích logic, giải toán, viết code & giải thích chuyên sâu.'
                        },
                        {
                          id: 'BALANCED',
                          title: '⚖️ Cân Bằng & Nhanh Nhạy',
                          desc: 'Phản hồi súc tích, thông minh và tự nhiên hàng ngày.'
                        },
                        {
                          id: 'CREATIVE',
                          title: '🎨 Sáng Tạo & Ý Tưởng',
                          desc: 'Brainstorm ý tưởng mới, viết lách & truyền cảm hứng.'
                        }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModeDraft(m.id as any)}
                          className={`p-3 rounded-xl border-2 text-left transition ${
                            modeDraft === m.id
                              ? 'bg-amber-400 border-slate-900 text-slate-950 shadow-[2px_2px_0px_#0f172a]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-black text-xs">{m.title}</div>
                          <div className="text-[11px] mt-1 opacity-85">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1">
                      2. Chỉ dẫn Tư duy & Vai trò chuyên môn (System Prompt)
                    </label>
                    <textarea
                      rows={4}
                      value={personaDraft}
                      onChange={e => setPersonaDraft(e.target.value)}
                      placeholder="VD: Bạn là chuyên gia lập trình Fullstack kiêm cố vấn học tập của chủ nhân..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-slate-900 text-xs font-medium leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border-2 border-slate-200">
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        Tự động học & ghi nhớ thông tin từ hội thoại (Auto-Memory)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Khi bạn nói sở thích, tên, dự án hay mục tiêu, AI tự động trích xuất vào Bộ nhớ dài hạn.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoLearnDraft}
                      onChange={e => setAutoLearnDraft(e.target.checked)}
                      className="w-5 h-5 accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1">
                      3. Khóa Gemini API Cá Nhân (Tùy chọn — Mặc định đã có Cloud Deep LLM miễn phí)
                    </label>
                    <input
                      type="password"
                      value={customKeyDraft}
                      onChange={e => setCustomKeyDraft(e.target.value)}
                      placeholder={
                        brainState.config.hasCustomKey
                          ? '•••••••• (Đã lưu khóa Gemini riêng — Nhập mới nếu muốn đổi)'
                          : 'Dán AIzaSy... từ Google AI Studio nếu muốn dùng thêm Gemini Pro'
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={trainBusy}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_3px_0_#0f172a]"
                    >
                      Lưu Cấu Hình Não Bộ AI
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
