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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-md w-full p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-charcoal text-base font-bold p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <div className="text-2xl mb-1" aria-hidden="true">🐾</div>
          <h2 id="auth-title" className="font-pixel text-sm text-charcoal">
            {isResetPassword
              ? 'Đặt lại mật khẩu'
              : isForgotPassword
              ? (forgotOtpSent ? 'Xác thực OTP & Đổi mật khẩu' : 'Quên mật khẩu')
              : isRegister
              ? 'Tạo tài khoản OfficePet'
              : 'Đăng nhập OfficePet'}
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-2">
            {isResetPassword
              ? 'Đặt mật khẩu mới cho tài khoản của bạn.'
              : isForgotPassword
              ? (forgotOtpSent
                  ? 'Nhập mã OTP 6 chữ số từ email và tạo mật khẩu mới.'
                  : 'Nhập email đăng ký để nhận mã OTP khôi phục mật khẩu.')
              : isRegister
              ? 'Nhập thông tin và xác thực mã OTP gửi về email để kích hoạt tài khoản.'
              : 'Đăng nhập vào không gian làm việc nuôi thú ảo.'}
          </p>
        </div>

        {statusMsg && (
          <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-2.5 text-xs text-green-800 flex items-start gap-1.5 font-sans">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="mb-4 p-2.5 bg-red-50 border border-red-400 rounded-lg text-xs text-red-700 flex items-start gap-1.5 font-sans">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 font-sans text-xs">
          {/* Registration fields: Name and optional Pet Name */}
          {isRegister && !isResetPassword && (
            <>
              <div>
                <label htmlFor="auth-full-name" className="block font-bold text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
              <div>
                <label htmlFor="auth-pet-name" className="block font-bold text-gray-700 mb-1">
                  Tên thú cưng đầu tiên <span className="font-normal text-gray-400">(không bắt buộc)</span>
                </label>
                <input
                  id="auth-pet-name"
                  type="text"
                  value={petName}
                  onChange={e => setPetName(e.target.value)}
                  maxLength={50}
                  placeholder="Ví dụ: Miu Miu, Cún Cưng..."
                  className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
            </>
          )}

          {/* Email input (used in Login, Register, Forgot Password) */}
          {!isResetPassword && (
            <div>
              <label htmlFor="auth-email" className="block font-bold text-gray-700 mb-1">
                Email {isRegister && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    placeholder="tenban@congty.com"
                    className="w-full pl-8 pr-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
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
                    className="px-3 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-bold rounded-lg border-2 border-charcoal shadow-pixel whitespace-nowrap text-[11px] transition-transform active:scale-95 shrink-0"
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
                <label htmlFor="auth-reg-otp" className="block font-bold text-gray-700">
                  Mã OTP xác thực Email <span className="text-red-500">*</span>
                </label>
                {regCooldown > 0 && (
                  <span className="text-[10px] text-sage-600 font-bold">Mã có hiệu lực 10 phút</span>
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
                className="w-full px-3 py-2 border-2 border-charcoal rounded-lg text-center font-mono font-bold text-base tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-sage-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400"
              />
              <p className="text-[10px] text-gray-500 mt-1">
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
                    <label htmlFor="auth-forgot-otp" className="block font-bold text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border-2 border-charcoal rounded-lg text-center font-mono font-bold text-base tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-sage-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Nhập mã OTP 6 chữ số đã được gửi tới email của bạn.</p>
                  </div>
                  <div>
                    <label htmlFor="auth-forgot-password" className="block font-bold text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Mật khẩu cần có từ 8 đến 128 ký tự.</p>
                  </div>
                </>
              ) : (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOtpSent(true)}
                    className="text-[11px] text-sage-600 hover:underline font-medium"
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
              <label htmlFor="auth-password" className="block font-bold text-gray-700 mb-1">
                {isResetPassword ? 'Mật khẩu mới' : 'Mật khẩu'}
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  className="w-full pl-8 pr-3 py-2 border-2 border-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
              {(isRegister || isResetPassword) && (
                <p className="text-[10px] text-gray-500 mt-1">Mật khẩu cần có từ 8 đến 128 ký tự.</p>
              )}
            </div>
          )}

          {/* 2FA input field for login */}
          {showOtpInput && !isForgotPassword && !isResetPassword && !isRegister && (
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
            className="w-full py-2.5 font-pixel text-xs bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95 mt-4"
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

        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between gap-3 text-[11px] font-sans">
          {isForgotPassword || isResetPassword ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-sage-600 hover:underline font-bold text-left"
            >
              Quay lại đăng nhập
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => switchMode(isRegister ? 'login' : 'register')}
                className="text-sage-600 hover:underline font-bold text-left"
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
                  className="text-sage-600 hover:underline font-bold text-right"
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
