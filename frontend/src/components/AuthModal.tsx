import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [petName, setPetName] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const resetChallenge = () => {
    setShowOtpInput(false);
    setOtp('');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({ email, password, fullName, petName });
        localStorage.setItem('officepet_token', res.data.token);
        onSuccess(res.data.user, res.data.token);
        onClose();
      } else {
        const res = await api.login({ email, password, ...(otp ? { otp } : {}) });
        if (res.data.requires2FA) {
          setShowOtpInput(true);
          setErrorMsg('');
          return;
        }
        localStorage.setItem('officepet_token', res.data.token);
        onSuccess(res.data.user, res.data.token);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Không thể đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (mode: 'login' | 'register') => {
    setIsRegister(mode === 'register');
    resetChallenge();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-md w-full p-6 animate-in zoom-in-95"
      >
        <div className="text-center mb-5">
          <div className="text-2xl mb-1" aria-hidden="true">🐾</div>
          <h2 id="auth-title" className="font-pixel text-sm text-charcoal">
            {isRegister ? 'Tạo tài khoản OfficePet' : 'Đăng nhập OfficePet'}
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-2">
            {isRegister
              ? 'Đăng ký trước; phòng chung là tùy chọn, có thể tạo hoặc tham gia sau.'
              : 'Đăng nhập bằng tài khoản công ty của bạn.'}
          </p>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-4 p-2.5 bg-red-50 border border-red-400 rounded-lg text-xs text-red-700 flex items-center gap-1.5 font-sans">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 font-sans text-xs">
          {isRegister && (
            <>
              <div>
                <label htmlFor="auth-full-name" className="block font-bold text-gray-700 mb-1">Họ và tên</label>
                <input
                  id="auth-full-name"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                  className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
              <div>
                <label htmlFor="auth-pet-name" className="block font-bold text-gray-700 mb-1">Tên thú cưng đầu tiên <span className="font-normal text-gray-400">(không bắt buộc)</span></label>
                <input
                  id="auth-pet-name"
                  type="text"
                  value={petName}
                  onChange={e => setPetName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block font-bold text-gray-700 mb-1">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block font-bold text-gray-700 mb-1">Mật khẩu</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
              className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
            />
            {isRegister && <p className="text-[10px] text-gray-500 mt-1">Mật khẩu cần có ít nhất 8 ký tự.</p>}
          </div>

          {showOtpInput && (
            <div>
              <label htmlFor="auth-otp" className="block font-bold text-charcoal mb-1">Mã 2FA từ ứng dụng xác thực</label>
              <input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                placeholder="000000"
                required
                className="w-full px-3 py-2 border-2 border-charcoal rounded-lg text-center font-mono font-bold text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
              <p className="text-[10px] text-gray-500 mt-1">Nhập mã 6 chữ số đang hiển thị trong ứng dụng 2FA.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (showOtpInput && otp.length !== 6)}
            className="w-full py-2.5 font-pixel text-xs bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95 mt-4"
          >
            {isLoading
              ? 'Đang xử lý...'
              : showOtpInput
              ? 'Xác thực và đăng nhập'
              : isRegister
              ? 'Tạo tài khoản'
              : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between gap-3 text-[11px] font-sans">
          <button
            type="button"
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
            className="text-sage-600 hover:underline font-bold text-left"
          >
            {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </div>
      </section>
    </div>
  );
};
