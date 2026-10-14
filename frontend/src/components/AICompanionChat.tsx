import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Heart, Activity, X } from 'lucide-react';
import { api } from '../services/api';
import { AnimationState, ChatMessage, UserPet } from '../types';

interface AICompanionChatProps {
  pet: UserPet;
  onPetStateChange?: (state: AnimationState) => void;
  compact?: boolean;
  onClose?: () => void;
  fillPanel?: boolean;
  onMusicRequest?: (query: string, autoPlay: boolean) => void;
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
  onMusicRequest
}) => {
  const storageKey = `officepet_chat_${pet.id}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
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
      text: `Chào bạn! Mình là ${pet.name}. Hôm nay công việc của bạn thế nào? Cần mình vỗ về hay tiếp thêm năng lượng không nè? ✨`,
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

    const userMsg: ChatMessage = {
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
      if (data.musicAction) {
        onMusicRequest?.(data.musicAction.query, data.musicAction.autoPlay);
      }

      const petMsg: ChatMessage = {
        sender: 'pet',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isComfortMode: data.isComfortMode,
        suggestion: data.relaxationSuggestion
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
          text: 'Bé cưng đang lắng nghe bạn nè, có vẻ kết nối mạng hơi chập chờn một chút xíu. Bạn nghỉ ngơi uống nước trước nhé! 🍵',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Hôm nay deadline nhiều mệt quá',
    'Gợi ý bài tập giãn cơ giúp mình',
    'Kể một câu chuyện vui ngắn đi',
    'Nhắc mình cách thở 4-7-8 hạ stress'
  ];

  return (
    <div className={`bg-white border-2 border-charcoal rounded-xl shadow-pixel flex min-h-0 min-w-0 flex-col ${compact ? 'h-[370px] w-[340px] max-w-[calc(100vw-12px)]' : fillPanel ? 'h-full w-full' : 'h-[520px] w-[520px] max-w-[calc(100vw-32px)] mx-auto'} overflow-hidden`}>
      {/* Header */}
      <div className={`bg-sage-400 ${compact ? 'p-2' : 'p-3.5'} border-b-2 border-charcoal flex items-center justify-between text-white`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Bot size={compact ? 15 : 18} />
          </div>
          <div>
            <div className="font-pixel text-xs text-white drop-shadow">
              Trợ Lý AI {pet.name}
            </div>
            {!compact && <div className="text-[11px] text-sage-100 font-sans">
              Luôn ghi nhớ & thấu cảm tâm trạng của bạn
            </div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] bg-sage-500/60 px-2 py-1 rounded-full border border-white/30">
            <Sparkles size={12} className="text-yellow-300" />
            <span>Gemini AI</span>
          </div>
          {compact && onClose && (
            <button type="button" onClick={onClose} className="rounded p-1 text-white hover:bg-white/20" aria-label="Đóng khung chat">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Message History */}
      <div className={`flex-1 ${compact ? 'p-2' : 'p-4'} overflow-y-auto space-y-3 bg-cream-100 text-xs font-sans`}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-xl border-2 border-charcoal shadow-pixel-sm ${
                m.sender === 'user'
                  ? 'bg-terracotta-400 text-white rounded-br-none'
                  : m.isComfortMode
                  ? 'bg-pink-100 text-charcoal rounded-bl-none border-pink-500'
                  : 'bg-white text-charcoal rounded-bl-none'
              }`}
            >
              {m.isComfortMode && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-pink-600 mb-1">
                  <Heart size={11} /> Chế độ Vỗ Về
                </div>
              )}
              <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>

              {/* Relaxation Suggestion Card */}
              {m.suggestion && (
                <div className="mt-2.5 p-2.5 bg-white/80 border border-charcoal rounded-lg text-charcoal">
                  <div className="font-bold flex items-center gap-1 text-sage-600 mb-0.5">
                    <Activity size={13} /> {m.suggestion.title} ({m.suggestion.durationMinutes} phút)
                  </div>
                  <div className="text-[11px] text-gray-600">{m.suggestion.description}</div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 italic">
            <span className="animate-spin">⏳</span> {pet.name} đang suy nghĩ lời động viên...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {!compact && <div className="p-2 bg-cream-200 border-t border-charcoal/20 flex gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 bg-white hover:bg-sage-50 border border-charcoal/40 rounded-full text-charcoal transition-colors"
          >
            {p}
          </button>
        ))}
      </div>}

      {/* Input Field */}
      <div className="p-3 bg-white border-t-2 border-charcoal flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
          placeholder={`Tâm sự cùng ${pet.name}...`}
          className="flex-1 px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none focus:border-sage-500 bg-cream-50 font-sans"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputText.trim()}
          className="px-3.5 py-2 bg-sage-400 hover:bg-sage-500 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-95"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
