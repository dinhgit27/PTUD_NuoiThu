import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { AlertCircle, CheckCircle2, Mail, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken') || '');
  const [isResetPassword, setIsResetPassword] = useState(() => Boolean(new URLSearchParams(window.location.search).get('resetToken')));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [petName, setPetName] = useState('');

  // 2FA login state
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');

  // Register OTP state
  const [registerOtp, setRegisterOtp] = useState('');
  const [regCooldown, setRegCooldown] = useState(0);
  const [isSendingRegOtp, setIsSendingRegOtp] = useState(false);

  // Forgot password OTP state
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Timers for cooldowns
  useEffect(() => {
    if (regCooldown <= 0) return;
    const timer = setInterval(() => setRegCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [regCooldown]);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setInterval(() => setForgotCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [forgotCooldown]);

  if (!isOpen) return null;

  const resetChallenge = () => {
    setShowOtpInput(false);
    setOtp('');
    setRegisterOtp('');
    setForgotOtp('');
    setForgotOtpSent(false);
    setErrorMsg('');
    setStatusMsg('');
  };

  const switchMode = (mode: 'login' | 'register') => {
    setIsRegister(mode === 'register');
    setIsForgotPassword(false);
    setIsResetPassword(false);
    setResetToken('');
    resetChallenge();
    if (new URLSearchParams(window.location.search).has('resetToken')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    }
  };

  // Request OTP for Registration
  const handleSendRegisterOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ trước khi gửi mã OTP.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setIsSendingRegOtp(true);
    try {
      const res = await api.requestRegisterOtp(trimmedEmail);
      setStatusMsg(res.data.message || 'Mã OTP 6 số đã được gửi đến email của bạn! Vui lòng kiểm tra hộp thư.');
      setRegCooldown(60);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Không thể gửi mã OTP. Vui lòng thử lại sau.');
    } finally {
      setIsSendingRegOtp(false);
    }
  };

  // Request OTP for Forgot Password
  const handleSendForgotOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setIsSendingForgotOtp(true);
    try {
      const res = await api.requestPasswordReset(trimmedEmail);
      setStatusMsg(res.data.message || 'Mã OTP đã được gửi đến email của bạn! Hãy nhập mã OTP và mật khẩu mới bên dưới.');
      setForgotCooldown(60);
      setForgotOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Không thể gửi mã OTP khôi phục. Vui lòng thử lại.');
    } finally {
      setIsSendingForgotOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        if (!forgotOtpSent && !forgotOtp) {
          // If user hasn't sent OTP yet, send it
          await handleSendForgotOtp();
          return;
        }

        if (forgotOtp.length !== 6) {
          setErrorMsg('Vui lòng nhập đầy đủ mã OTP 6 chữ số từ email.');
          return;
        }
        if (!password || password.length < 8) {
          setErrorMsg('Mật khẩu mới cần có ít nhất 8 ký tự.');
          return;
        }

        const response = await api.resetPasswordWithOtp({
          email: email.trim().toLowerCase(),
          otp: forgotOtp,
          password
        });
        setStatusMsg(response.data.message || 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.');
        setPassword('');
        setForgotOtp('');
        setForgotOtpSent(false);
        setIsForgotPassword(false);
      } else if (isResetPassword) {
        const response = await api.resetPassword(resetToken, password);
        setStatusMsg(response.data.message);
        setPassword('');
        setResetToken('');
        setIsResetPassword(false);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
      } else if (isRegister) {
        if (!registerOtp || registerOtp.length !== 6) {
          setErrorMsg('Vui lòng nhấn "Gửi mã OTP" và nhập mã xác thực 6 chữ số từ email.');
          return;
        }
        const res = await api.register({
          email: email.trim().toLowerCase(),
          password,
          fullName,
          petName,
          otp: registerOtp
        });
        localStorage.setItem('officepet_token', res.data.token);
        onSuccess(res.data.user, res.data.token);
        onClose();
      } else {
        const res = await api.login({
          email: email.trim().toLowerCase(),
          password,
          ...(otp ? { otp } : {})
        });
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
      setErrorMsg(err?.response?.data?.error || err.message || 'Thao tác không thành công. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative bg-white border border-slate-200/90 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-[#1b365d]/10 text-[#1b365d] rounded-2xl flex items-center justify-center text-2xl shadow-xs" aria-hidden="true">
            🐾
          </div>
          <h2 id="auth-title" className="text-xl font-bold tracking-tight text-[#1b365d]">
            {isResetPassword
              ? 'Đặt lại mật khẩu'
              : isForgotPassword
              ? (forgotOtpSent ? 'Xác thực OTP & Đổi mật khẩu' : 'Quên mật khẩu')
              : isRegister
              ? 'Tạo tài khoản OfficePet'
              : 'Đăng nhập OfficePet'}
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-1.5 leading-relaxed">
            {isResetPassword
              ? 'Đặt mật khẩu mới cho tài khoản của bạn.'
              : isForgotPassword
              ? (forgotOtpSent
                  ? 'Nhập mã OTP 6 chữ số từ email và tạo mật khẩu mới.'
                  : 'Nhập email đăng ký để nhận mã OTP khôi phục mật khẩu.')
              : isRegister
              ? 'Nhập thông tin và xác thực mã OTP gửi về email để kích hoạt tài khoản.'
              : 'Đăng nhập vào không gian làm việc nuôi thú ảo công sở.'}
          </p>
        </div>

        {statusMsg && (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 flex items-start gap-2 font-sans">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 font-sans">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 font-sans text-xs">
          {/* Registration fields: Name and optional Pet Name */}
          {isRegister && !isResetPassword && (
            <>
              <div>
                <label htmlFor="auth-full-name" className="block font-semibold text-slate-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  id="auth-full-name"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 transition"
                />
              </div>
              <div>
                <label htmlFor="auth-pet-name" className="block font-semibold text-slate-700 mb-1">
                  Tên thú cưng đầu tiên <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </label>
                <input
                  id="auth-pet-name"
                  type="text"
                  value={petName}
                  onChange={e => setPetName(e.target.value)}
                  maxLength={50}
                  placeholder="Ví dụ: Miu Miu, Cún Cưng..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 transition"
                />
              </div>
            </>
          )}

          {/* Email input (used in Login, Register, Forgot Password) */}
          {!isResetPassword && (
            <div>
              <label htmlFor="auth-email" className="block font-semibold text-slate-700 mb-1">
                Email {isRegister && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    placeholder="tenban@congty.com"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 transition"
                  />
                </div>
                {(isRegister || isForgotPassword) && (
                  <button
                    type="button"
                    onClick={isRegister ? handleSendRegisterOtp : handleSendForgotOtp}
                    disabled={
                      (isRegister ? isSendingRegOtp || regCooldown > 0 : isSendingForgotOtp || forgotCooldown > 0) ||
                      !email
                    }
                    className="px-3.5 py-2.5 bg-[#1b365d] hover:bg-[#162b49] disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-xs transition active:scale-95 shrink-0"
                    title="Gửi mã OTP 6 số về hòm thư email"
                  >
                    {isRegister
                      ? isSendingRegOtp
                        ? 'Đang gửi...'
                        : regCooldown > 0
                        ? `Gửi lại (${regCooldown}s)`
                        : 'Gửi mã OTP'
                      : isSendingForgotOtp
                      ? 'Đang gửi...'
                      : forgotCooldown > 0
                      ? `Gửi lại (${forgotCooldown}s)`
                      : 'Gửi mã OTP'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Register OTP Field */}
          {isRegister && !isResetPassword && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="auth-reg-otp" className="block font-semibold text-slate-700">
                  Mã OTP xác thực Email <span className="text-red-500">*</span>
                </label>
                {regCooldown > 0 && (
                  <span className="text-[10px] text-blue-700 font-bold">Mã có hiệu lực 10 phút</span>
                )}
              </div>
              <input
                id="auth-reg-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={registerOtp}
                onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                placeholder="000000"
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono font-bold text-base tracking-[0.4em] focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-slate-50/50 text-slate-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Bấm nút <strong>"Gửi mã OTP"</strong> ở trên, sau đó kiểm tra email để lấy mã 6 chữ số.
              </p>
            </div>
          )}

          {/* Forgot Password OTP & New Password fields */}
          {isForgotPassword && (
            <>
              {forgotOtpSent ? (
                <>
                  <div>
                    <label htmlFor="auth-forgot-otp" className="block font-semibold text-slate-700 mb-1">
                      Mã OTP từ email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="auth-forgot-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoComplete="one-time-code"
                      placeholder="000000"
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono font-bold text-base tracking-[0.4em] focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-slate-50/50 text-slate-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Nhập mã OTP 6 chữ số đã được gửi tới email của bạn.</p>
                  </div>
                  <div>
                    <label htmlFor="auth-forgot-password" className="block font-semibold text-slate-700 mb-1">
                      Mật khẩu mới <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="auth-forgot-password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 transition"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Mật khẩu cần có từ 8 đến 128 ký tự.</p>
                  </div>
                </>
              ) : (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOtpSent(true)}
                    className="text-xs text-[#1b365d] hover:underline font-semibold"
                  >
                    Đã có mã OTP trong email? Bấm vào đây để nhập ngay
                  </button>
                </div>
              )}
            </>
          )}

          {/* Standard Password field (used in Login and Register) */}
          {!isForgotPassword && (
            <div>
              <label htmlFor="auth-password" className="block font-semibold text-slate-700 mb-1">
                {isResetPassword ? 'Mật khẩu mới' : 'Mật khẩu'}
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isRegister || isResetPassword ? 'new-password' : 'current-password'}
                  minLength={isRegister || isResetPassword ? 8 : undefined}
                  maxLength={isResetPassword ? 128 : undefined}
                  required
                  placeholder={isRegister || isResetPassword ? 'Tối thiểu 8 ký tự' : '••••••••'}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 transition"
                />
              </div>
              {(isRegister || isResetPassword) && (
                <p className="text-[11px] text-slate-500 mt-1">Mật khẩu cần có từ 8 đến 128 ký tự.</p>
              )}
            </div>
          )}

          {/* 2FA input field for login */}
          {showOtpInput && !isForgotPassword && !isResetPassword && !isRegister && (
            <div>
              <label htmlFor="auth-otp" className="block font-semibold text-slate-800 mb-1">Mã 2FA từ ứng dụng xác thực</label>
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
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono font-bold text-lg tracking-[0.4em] focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-slate-50/50 text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">Nhập mã 6 chữ số đang hiển thị trong ứng dụng 2FA.</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isLoading ||
              (showOtpInput && otp.length !== 6) ||
              (isResetPassword && !resetToken) ||
              (isRegister && registerOtp.length !== 6) ||
              (isForgotPassword && forgotOtpSent && (forgotOtp.length !== 6 || password.length < 8))
            }
            className="w-full py-3 text-xs bg-amber-400 hover:bg-amber-500 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-xs transition transform active:scale-98 mt-4 uppercase tracking-wider"
          >
            {isLoading
              ? 'Đang xử lý...'
              : showOtpInput
              ? 'Xác thực 2FA và đăng nhập'
              : isResetPassword
              ? 'Lưu mật khẩu mới'
              : isForgotPassword
              ? forgotOtpSent
                ? 'Xác nhận đổi mật khẩu'
                : 'Gửi mã OTP khôi phục'
              : isRegister
              ? 'Xác thực OTP & Tạo tài khoản'
              : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs font-sans">
          {isForgotPassword || isResetPassword ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-[#1b365d] hover:text-[#162b49] hover:underline font-semibold text-left transition"
            >
              Quay lại đăng nhập
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => switchMode(isRegister ? 'login' : 'register')}
                className="text-[#1b365d] hover:text-[#162b49] hover:underline font-semibold text-left transition"
              >
                {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
              </button>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    resetChallenge();
                  }}
                  className="text-slate-500 hover:text-[#1b365d] hover:underline font-medium text-right transition"
                >
                  Quên mật khẩu?
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
