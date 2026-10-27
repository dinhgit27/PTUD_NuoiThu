import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Heart, Activity, X, Wind, Timer, Music, Play, History, Volume2, Settings, Smile, Headphones, Code2, GraduationCap, Radio } from 'lucide-react';
import { api } from '../services/api';
import { AnimationState, ChatMessage, UserPet } from '../types';

export interface ChatAction {
  type: 'START_POMODORO' | 'PLAY_MEDIA' | 'START_BREATHING';
  duration?: number;
  category?: 'lofi_focus' | 'nature_relax' | 'funny_video';
  platform?: 'spotify' | 'youtube';
  query?: string;
}

interface AICompanionChatProps {
  pet: UserPet;
  onPetStateChange?: (state: AnimationState) => void;
  compact?: boolean;
  onClose?: () => void;
  fillPanel?: boolean;
  onMusicRequest?: (query: string, autoPlay: boolean) => void;
  onStartBreathing?: (durationMinutes: number) => void;
  onStartPomodoro?: (durationMinutes: number) => void;
}

const animationStates: AnimationState[] = [
  'IDLE', 'WALKING', 'TYPING', 'SLEEPING', 'HAPPY', 'SAD',
  'HUNGRY', 'EATING', 'DRINKING', 'PETTING', 'DANCING', 'WAVING'
];

export const AICompanionChat: React.FC<AICompanionChatProps> = ({
  pet,
  onPetStateChange,
  compact = false,
  onClose,
  fillPanel = false,
  onMusicRequest,
  onStartBreathing,
  onStartPomodoro
}) => {
  const storageKey = `officepet_chat_${pet.id}`;
  const [messages, setMessages] = useState<(ChatMessage & { action?: ChatAction })[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const history = saved ? JSON.parse(saved) : null;
      if (Array.isArray(history) && history.every(message =>
        message && (message.sender === 'user' || message.sender === 'pet')
        && typeof message.text === 'string' && typeof message.timestamp === 'string'
      )) return history;
    } catch (error) {
      console.warn('Could not restore the pet chat history:', error);
    }
    return [{
      sender: 'pet',
      text: `Chào bạn! Mình là ${pet.name}. Hôm nay công việc của bạn thế nào? Cần mình vỗ về hay tiếp thêm năng lượng không nè? ✨🐾`,
      timestamp: '07:56 AM'
    }];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-100)));
    } catch (error) {
      console.warn('Could not save the pet chat history:', error);
    }
  }, [messages, storageKey]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage & { action?: ChatAction } = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const res = await api.chatWithAI(text);
      const data = res.data;

      // Handle function calling actions
      if (data.action) {
        if (data.action.type === 'START_BREATHING') {
          onStartBreathing?.(data.action.duration || 2);
        } else if (data.action.type === 'PLAY_MEDIA') {
          const query = data.action.query ||
            data.musicAction?.query ||
            (data.action.category === 'nature_relax'
              ? 'nature sounds relax'
              : data.action.category === 'funny_video'
              ? 'funny pets compilation'
              : 'lofi hip hop');
          onMusicRequest?.(query, true);
        } else if (data.action.type === 'START_POMODORO') {
          onStartPomodoro?.(data.action.duration || 25);
        }
      } else if (data.musicAction) {
        onMusicRequest?.(data.musicAction.query, data.musicAction.autoPlay);
      }

      const petMsg: ChatMessage & { action?: ChatAction } = {
        sender: 'pet',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isComfortMode: data.isComfortMode,
        suggestion: data.relaxationSuggestion,
        action: data.action
      };

      setMessages(prev => [...prev, petMsg]);

      if (animationStates.includes(data.petStateChange) && onPetStateChange) {
        onPetStateChange(data.petStateChange);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'pet',
          text: 'Bé cưng đang lắng nghe bạn nè, có vẻ kết nối mạng hơi chập chờn một chút xíu. Bạn nghỉ ngơi uống nước trước nhé! 🍵🐾',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Mình mệt mỏi và căng thẳng quá',
    'Hướng dẫn mình hít thở sâu xả stress',
    'Mở nhạc Lofi tập trung'
  ];

  // If in small overlay mode, render a sleek compact floating chat card
  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex min-h-0 min-w-0 flex-col h-[400px] w-[360px] max-w-[calc(100vw-16px)] overflow-hidden font-sans text-slate-800">
        <div className="bg-[#1b365d] p-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Bot size={16} />
            </div>
            <div>
              <div className="font-bold text-xs text-white">Trợ Lý Thú Cưng {pet.name}</div>
              <div className="text-[10px] text-blue-200">Gemini 3.5 Flash Connected</div>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded p-1 text-white/80 hover:text-white" aria-label="Đóng khung chat">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50 text-xs">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl ${m.sender === 'user' ? 'bg-[#1b365d] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 px-1 font-mono">{m.timestamp}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-2.5 bg-white border-t border-slate-200 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Hỏi trợ lý AI..."
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Full Screen View: Matches Image 5 (Trung Tâm Điều Hành AI)
  return (
    <div className="max-w-7xl mx-auto space-y-5 font-sans text-slate-800">
      {/* Top Header Card */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b365d] shrink-0">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Trung Tâm Điều Hành AI
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                ROOM #2D-04
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Điều phối nhạc Lofi, chu trình Pomodoro & trợ lý sức khỏe tinh thần công sở 2D Pixel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => alert('📜 Nhật ký lệnh: Đã thực thi 14 lệnh AI Companion gần nhất.')}
            className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <History size={14} />
            <span>Nhật ký lệnh</span>
          </button>
          <button
            type="button"
            onClick={() => alert('🎵 Đã đồng bộ âm thanh & phát Lofi Playlist.')}
            className="rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Volume2 size={14} />
            <span>Đồng bộ Âm Thanh</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Layout (Matches Image 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Pixel Studio & Schedule (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* OfficePet Studio Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="ml-2 font-bold text-xs text-slate-800">OfficePet Studio</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">
                FPS: 60
              </span>
            </div>

            {/* Studio Canvas Box */}
            <div className="relative rounded-2xl bg-gradient-to-b from-[#eef4ff] to-[#f8faff] border border-blue-100 p-4 min-h-[220px] flex flex-col justify-between items-center text-center shadow-inner">
              <div className="w-full flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-bold">{pet.name} • Lv.{pet.level}</span>
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 font-semibold text-[10px]">
                  <Headphones size={11} /> Đang nghe Lofi
                </span>
              </div>

              <div className="my-auto py-2 flex flex-col items-center">
                <div className="mb-2 bg-white border border-blue-100 shadow-xs text-slate-800 text-[11px] font-medium px-3 py-1 rounded-full">
                  🐾 Meow! Đang lắng nghe...
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#1b365d] text-amber-300 flex items-center justify-center text-2xl shadow-md border-2 border-white">
                  🐾
                </div>
              </div>

              <div className="w-full flex items-center justify-between pt-2 border-t border-blue-100/60 text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span>😊</span>
                  <span>🏔️</span>
                  <span>☀️</span>
                </div>
                <span>OFFICE_SYS : : SYNCED</span>
              </div>
            </div>

            {/* Meters */}
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span className="text-amber-500">⚡</span> Năng Lượng Tập Trung
                  </span>
                  <span className="font-bold text-slate-900 font-mono">85%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: '85%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span className="text-rose-500">💖</span> Mức Độ Xả Stress
                  </span>
                  <span className="font-bold text-slate-900 font-mono">92%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div className="bg-[#881337] h-full rounded-full transition-all" style={{ width: '92%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Công Việc & Lịch Trình Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Timer size={15} className="text-blue-700" />
                <span>Công Việc & Lịch Trình</span>
              </h3>
              <Timer size={14} className="text-slate-400" />
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Code2 size={14} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Nhiệm Vụ Kỹ Thuật Số</div>
                    <div className="text-[11px] text-slate-500">Phiên Pomodoro: 3/4 hoàn thành</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  25 min
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Music size={14} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Playlist Lofi Chill Focus</div>
                    <div className="text-[11px] text-slate-500">Lofi Không Lời • Thư Thái</div>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Companion Chat Window (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between min-h-[580px]">
          {/* Chat Window Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1b365d] text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                <Bot size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Trợ Lý Thú Cưng {pet.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tập trung Pomodoro & Thư giãn xả stress cùng Gemini Function Calling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] shadow-xs">
                <Sparkles size={13} className="fill-slate-950" />
                <span>GEMINI 3.5 FLASH</span>
              </span>
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                title="Cài đặt mô hình AI"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* Chat Message History Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50 text-xs min-h-[350px]">
            {/* Date divider */}
            <div className="flex justify-center">
              <span className="px-3 py-1 bg-slate-100 text-slate-500 font-semibold text-[10px] rounded-full">
                Hôm nay, 25 Tháng 10
              </span>
            </div>

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-start gap-2.5 max-w-[85%]">
                  {m.sender === 'pet' && (
                    <div className="w-8 h-8 rounded-xl bg-[#1b365d] text-amber-300 flex items-center justify-center shrink-0 text-sm mt-0.5 shadow-xs">
                      🐾
                    </div>
                  )}

                  <div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        m.sender === 'user'
                          ? 'bg-blue-100/80 text-slate-900 font-medium rounded-tr-none border border-blue-200/60'
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80'
                      }`}
                    >
                      {/* Optional Music card inside bot bubble */}
                      {m.action?.type === 'PLAY_MEDIA' && (
                        <div className="mb-2.5 p-2.5 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                          <Music size={14} className="text-blue-700 shrink-0" />
                          <span><strong>Đang phát:</strong> {m.action.query || 'Cô Đơn Anh Cũng Vui - Lofi Ver'}</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap">{m.text}</div>

                      {/* Interactive Action Card if triggered */}
                      {m.action && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <Timer size={14} className="text-blue-700" />
                              Pomodoro Sprint Tập Trung
                            </span>
                            <span className="text-[10px] font-bold text-amber-600">+150 EXP Thú Cưng</span>
                          </div>
                          <div className="flex gap-2 pt-1">
                            {m.action.type === 'START_POMODORO' && (
                              <button
                                type="button"
                                onClick={() => onStartPomodoro?.(m.action?.duration || 25)}
                                className="px-3.5 py-1.5 bg-[#1b365d] hover:bg-[#162b49] text-white font-bold text-xs rounded-lg shadow-xs transition"
                              >
                                Bật Pomodoro 25p ngay
                              </button>
                            )}
                            {m.action.type === 'START_BREATHING' && (
                              <button
                                type="button"
                                onClick={() => onStartBreathing?.(m.action?.duration || 2)}
                                className="px-3.5 py-1.5 bg-[#1b365d] hover:bg-[#162b49] text-white font-bold text-xs rounded-lg shadow-xs transition"
                              >
                                Bắt đầu bài tập thở
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => alert('Đã hoãn lại')}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition"
                            >
                              Để sau
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono block">
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 bg-white border border-slate-200 px-3.5 py-2 rounded-xl w-fit text-xs animate-pulse shadow-xs">
                <Bot size={14} className="text-blue-600 animate-spin" />
                <span>{pet.name} đang suy nghĩ câu trả lời...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Row */}
          <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase whitespace-nowrap">
              GỢI Ý NHANH:
            </span>
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="text-[11px] bg-white border border-slate-200/80 hover:bg-slate-100 rounded-full px-3 py-1 whitespace-nowrap text-slate-700 font-medium transition shadow-xs disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Input Field & Footer */}
          <div className="p-4 bg-white border-t border-slate-200/80 space-y-2">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={`Trò chuyện cùng ${pet.name} (nhờ vỗ về, thở sâu, mở nhạc, pomodoro)...`}
                  disabled={isLoading}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Biểu tượng cảm xúc"
                >
                  <Smile size={16} />
                </button>
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <span>Gửi</span>
                <Send size={13} />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Gemini Multimodal Live Connected • OfficePet AI Network
              </span>
              <span>Shift + Enter xuống dòng</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
