import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Heart, Activity, X, Wind, Timer, Music, Play } from 'lucide-react';
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
  'IDLE', 'WALKING', 'TYPING', 'SLEEPING', 'WAKING_UP', 'HAPPY', 'SAD', 'YAWNING',
  'HUNGRY', 'EATING', 'PETTING', 'DANCING', 'DRINKING', 'EXERCISING', 'WAVING',
  'THANKING', 'CELEBRATING', 'EVOLVING'
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
    'Mở bài nhạc lofi giúp mình tập trung',
    'Bắt đầu phiên Pomodoro 25 phút'
  ];

  return (
    <div className={`bg-white border-2 border-charcoal rounded-xl shadow-pixel flex min-h-0 min-w-0 flex-col ${compact ? 'h-[370px] w-[340px] max-w-[calc(100vw-12px)]' : fillPanel ? 'h-full w-full' : 'h-[540px] w-[540px] max-w-[calc(100vw-32px)] mx-auto'} overflow-hidden font-sans`}>
      {/* Header */}
      <div className={`bg-sage-400 ${compact ? 'p-2' : 'p-3.5'} border-b-2 border-charcoal flex items-center justify-between text-white`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Bot size={compact ? 15 : 18} />
          </div>
          <div>
            <div className="font-pixel text-xs text-white drop-shadow">
              Trợ Lý Thú Cưng {pet.name}
            </div>
            {!compact && (
              <div className="text-[11px] text-sage-100">
                Tập trung Pomodoro & Thư giãn xả stress cùng Gemini Function Calling
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] bg-sage-500/60 px-2 py-1 rounded-full border border-white/30">
            <Sparkles size={12} className="text-yellow-300" />
            <span className="font-mono">Gemini 3.5 Flash</span>
          </div>
          {compact && onClose && (
            <button type="button" onClick={onClose} className="rounded p-1 text-white hover:bg-white/20" aria-label="Đóng khung chat">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Message History */}
      <div className={`flex-1 ${compact ? 'p-2' : 'p-4'} overflow-y-auto space-y-3 bg-cream-100 text-xs`}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-xl border-2 border-charcoal shadow-pixel-sm ${
                m.sender === 'user'
                  ? 'bg-sage-400 text-white rounded-br-none'
                  : 'bg-white text-charcoal rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

              {/* Action Buttons inside message if triggered by Gemini Function Calling */}
              {m.action && (
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                  {m.action.type === 'START_BREATHING' && (
                    <button
                      type="button"
                      onClick={() => onStartBreathing?.(m.action?.duration || 2)}
                      className="px-2.5 py-1 bg-sage-100 hover:bg-sage-200 text-sage-800 text-[11px] font-bold rounded-lg border border-sage-400 flex items-center gap-1 transition-transform active:scale-95"
                    >
                      <Wind size={13} className="text-sage-600" /> Mở bài tập thở ({m.action.duration || 2} phút)
                    </button>
                  )}
                  {m.action.type === 'PLAY_MEDIA' && (
                    <button
                      type="button"
                      onClick={() => {
                        const query = m.action?.query ||
                          (m.action?.category === 'nature_relax' ? 'nature sounds relax' : 'lofi hip hop');
                        onMusicRequest?.(query, true);
                      }}
                      className="px-2.5 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-[11px] font-bold rounded-lg border border-yellow-400 flex items-center gap-1 transition-transform active:scale-95"
                    >
                      <Music size={13} className="text-yellow-600" /> Phát: {m.action.query || m.action.category}
                    </button>
                  )}
                  {m.action.type === 'START_POMODORO' && (
                    <button
                      type="button"
                      onClick={() => onStartPomodoro?.(m.action?.duration || 25)}
                      className="px-2.5 py-1 bg-terracotta-100 hover:bg-terracotta-200 text-terracotta-800 text-[11px] font-bold rounded-lg border border-terracotta-400 flex items-center gap-1 transition-transform active:scale-95"
                    >
                      <Timer size={13} className="text-terracotta-600" /> Bật Pomodoro ({m.action.duration || 25}p)
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1 font-mono">{m.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 bg-white border border-charcoal px-3 py-1.5 rounded-lg w-fit text-xs animate-pulse">
            <Bot size={14} className="text-sage-500 animate-spin" />
            <span>{pet.name} đang suy nghĩ câu trả lời...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-3 py-2 bg-cream-200 border-t border-gray-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">Gợi ý nhanh:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="text-[11px] bg-white border border-charcoal hover:bg-sage-100 rounded-full px-2.5 py-1 whitespace-nowrap text-gray-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="p-3 bg-white border-t-2 border-charcoal">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={`Trò chuyện cùng ${pet.name} (nhờ vỗ về, thở sâu, mở nhạc, pomodoro)...`}
            disabled={isLoading}
            className="flex-1 px-3 py-2 border-2 border-charcoal rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
            aria-label="Gửi tin nhắn"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
