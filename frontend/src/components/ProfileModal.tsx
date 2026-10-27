import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon, Mail, Lock, KeyRound, Camera, Upload, Trash2,
  Check, AlertCircle, RefreshCw, Sparkles, Heart, Bell, Shield,
  Eye, EyeOff, Save, Link as LinkIcon, Palette, Award, Building,
  Calendar, X, Smile, Zap, Volume2, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { User, UserPet } from '../types';
import { api } from '../services/api';
import { PixelPetCanvas } from './PixelPetCanvas';

interface ProfileModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentUser: User;
  userPet?: UserPet | null;
  onUserUpdated: (updatedUser: User) => void;
  onNavigateTab?: (tab: string) => void;
  isModal?: boolean;
}

type TabKey = 'INFO' | 'PASSWORD' | 'PREFERENCES' | 'PET';

// 16 bộ avatar pixel art sinh động
const PRESET_AVATARS = [
  { id: 'cat', name: 'Mèo Mochi', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Mochi' },
  { id: 'dog', name: 'Cún Buddy', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Buddy' },
  { id: 'fox', name: 'Cáo Foxxy', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Foxxy' },
  { id: 'bunny', name: 'Thỏ Hồng', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Bunny' },
  { id: 'panda', name: 'Gấu Trúc', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Panda' },
  { id: 'penguin', name: 'Chim Cánh Cụt', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Penguin' },
  { id: 'dragon', name: 'Rồng Con', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Dragon' },
  { id: 'dev', name: 'Lập Trình Viên', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=DevBoy' },
  { id: 'neko', name: 'Cô Bé Neko', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=NekoGirl' },
  { id: 'knight', name: 'Hiệp Sĩ Quả Cảm', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Knight' },
  { id: 'wizard', name: 'Phù Thủy Tập Sự', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Wizard' },
  { id: 'astro', name: 'Phi Hành Gia', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Astro' },
  { id: 'ninja', name: 'Ninja Bóng Đêm', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ninja' },
  { id: 'bot', name: 'Robot Mini', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RoboPet' },
  { id: 'king', name: 'Hoàng Tử Pixel', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Prince' },
  { id: 'star', name: 'Ngôi Sao Sáng', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Sparkle' }
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen = true,
  onClose,
  currentUser,
  userPet,
  onUserUpdated,
  onNavigateTab,
  isModal = true
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('INFO');

  // Form states - Info
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Form states - Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states - Preferences
  const [petPersona, setPetPersona] = useState(currentUser.preference?.petPersona || 'Vui vẻ');
  const [soundEnabled, setSoundEnabled] = useState(currentUser.preference?.soundEnabled ?? true);
  const [quietMode, setQuietMode] = useState(currentUser.preference?.quietMode ?? false);
  const [favMusicGenre, setFavMusicGenre] = useState(currentUser.preference?.favMusicGenre || 'Lo-fi Hip Hop');
  const [hydrationInterval, setHydrationInterval] = useState(currentUser.preference?.hydrationInterval || 45);
  const [postureInterval, setPostureInterval] = useState(currentUser.preference?.postureInterval || 60);

  // Status & notifications
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setPetPersona(currentUser.preference?.petPersona || 'Vui vẻ');
      setSoundEnabled(currentUser.preference?.soundEnabled ?? true);
      setQuietMode(currentUser.preference?.quietMode ?? false);
      setFavMusicGenre(currentUser.preference?.favMusicGenre || 'Lo-fi Hip Hop');
      setHydrationInterval(currentUser.preference?.hydrationInterval || 45);
      setPostureInterval(currentUser.preference?.postureInterval || 60);
    }
  }, [currentUser]);

  if (isModal && !isOpen) return null;

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 4500);
  };

  // Upload file avatar
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('error', 'Kích thước file ảnh không được vượt quá 10MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setIsUploadingAvatar(true);
      const res = await api.uploadAvatar(formData);
      const newUrl = res.data.avatarUrl;
      setAvatarUrl(newUrl);
      if (res.data.user) {
        onUserUpdated(res.data.user);
      }
      showNotification('success', 'Đã tải lên và cập nhật ảnh đại diện thành công!');
    } catch (err: any) {
      showNotification('error', err.response?.data?.error || 'Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Select preset avatar
  const handleSelectPreset = (url: string) => {
    setAvatarUrl(url);
  };

  // Apply custom URL
  const handleApplyCustomUrl = () => {
    const trimmed = customAvatarInput.trim();
    if (!trimmed) {
      showNotification('error', 'Vui lòng nhập đường dẫn URL ảnh hợp lệ.');
      return;
    }
    setAvatarUrl(trimmed);
    setCustomAvatarInput('');
    showNotification('success', 'Đã chọn ảnh đại diện từ đường dẫn URL!');
  };

  // Remove avatar
  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  // Save Info
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showNotification('error', 'Họ và tên không được để trống.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.updateProfile({
        fullName: fullName.trim(),
        avatarUrl: avatarUrl ? avatarUrl.trim() : ''
      });

      if (res.data.user) {
        onUserUpdated(res.data.user);
      }
      showNotification('success', 'Đã cập nhật thông tin cá nhân và ảnh đại diện thành công!');
    } catch (err: any) {
      showNotification('error', err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật.');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      showNotification('error', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showNotification('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('error', 'Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    try {
      setSaving(true);
      await api.updateProfile({
        oldPassword,
        newPassword
      });

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotification('success', 'Đổi mật khẩu tài khoản thành công!');
    } catch (err: any) {
      showNotification('error', err.response?.data?.error || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setSaving(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.updateProfile({
        preference: {
          petPersona,
          soundEnabled,
          quietMode,
          favMusicGenre,
          hydrationInterval: Number(hydrationInterval),
          postureInterval: Number(postureInterval)
        }
      });

      if (res.data.user) {
        onUserUpdated(res.data.user);
      }
      showNotification('success', 'Đã lưu cài đặt sở thích cá nhân!');
    } catch (err: any) {
      showNotification('error', err.response?.data?.error || 'Lỗi khi lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formattedJoinDate = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Thành viên mới';

  const modalContent = (
    <div className={`bg-slate-900 border border-slate-700/80 rounded-2xl w-full flex flex-col shadow-2xl text-slate-100 overflow-hidden ${
      isModal ? 'max-w-2xl max-h-[92vh]' : 'max-w-3xl mx-auto'
    }`}>
      {/* Modal Top Header with Hero Gradient */}
      <div className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-6 pt-6 pb-5 border-b border-white/10">
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Main Interactive Avatar */}
            <div className="relative group">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-400 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover rounded-[14px]"
                      onError={(e) => {
                        // Fallback on broken image
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-2xl font-black text-amber-300 tracking-wider">
                      {getInitials(fullName)}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Camera Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-lg border-2 border-slate-900 transition cursor-pointer group-hover:scale-105"
                title="Tải ảnh mới từ máy tính"
              >
                {isUploadingAvatar ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            </div>

            {/* Profile Hero Info */}
            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate max-w-xs sm:max-w-md">
                  {fullName || 'Người dùng'}
                </h2>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}>
                  {currentUser.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                </span>
              </div>

              <div className="text-xs text-blue-200/80 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 mb-2">
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-blue-300" /> {currentUser.email}
                </span>
                {currentUser.department && (
                  <span className="flex items-center gap-1">
                    <Building size={12} className="text-amber-300" /> {currentUser.department.name}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                <Calendar size={11} /> Tham gia: {formattedJoinDate}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-700/80 bg-slate-900/90 px-4 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('INFO')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'INFO'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <UserIcon size={14} /> Thông tin & Avatar
          </button>

          <button
            onClick={() => setActiveTab('PASSWORD')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'PASSWORD'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <KeyRound size={14} /> Đổi mật khẩu
          </button>

          <button
            onClick={() => setActiveTab('PREFERENCES')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'PREFERENCES'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Palette size={14} /> Sở thích & Tiện ích
          </button>

          {userPet && (
            <button
              onClick={() => setActiveTab('PET')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'PET'
                  ? 'border-amber-400 text-amber-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Heart size={14} /> Thú cưng ({userPet.name})
            </button>
          )}
        </div>

        {/* Global Toast / Notification Bar */}
        {message && (
          <div className={`mx-4 mt-3 px-3.5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in slide-in-from-top-2 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: THÔNG TIN CÁ NHÂN & AVATAR                         */}
          {/* ======================================================== */}
          {activeTab === 'INFO' && (
            <form onSubmit={handleSaveInfo} className="space-y-6">
              
              {/* Profile fields */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-4">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon size={14} /> Thông tin định danh
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Họ và tên hiển thị <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nhập họ và tên của bạn"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                        required
                      />
                      <UserIcon size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={currentUser.email}
                        disabled
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                      />
                      <Mail size={15} className="absolute left-3 top-2.5 text-slate-500" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Email gắn với tài khoản đăng nhập của bạn.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Phòng ban / Đơn vị
                    </label>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building size={14} className="text-blue-400" />
                        {currentUser.department?.name || 'Chưa tham gia phòng ban'}
                      </span>
                      {currentUser.department && onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose?.();
                            onNavigateTab('GARDEN');
                          }}
                          className="text-xs text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                        >
                          Đến Vườn
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Vai trò hệ thống
                    </label>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>{currentUser.role === 'ADMIN' ? 'Quản trị viên (Admin Console)' : 'Nhân viên / Người dùng'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar Chooser Section */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera size={14} /> Tùy chỉnh Ảnh Đại Diện (Avatar)
                  </h3>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 size={13} /> Gỡ avatar về chữ cái
                    </button>
                  )}
                </div>

                {/* Option 1: File Upload */}
                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-700/50">
                  <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Upload size={20} />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs font-bold text-white">Tải ảnh đại diện từ thiết bị của bạn</div>
                    <div className="text-[11px] text-slate-400">Hỗ trợ định dạng PNG, JPG, JPEG, WEBP hoặc GIF (Tối đa 10MB)</div>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Đang tải lên...
                        </>
                      ) : (
                        <>
                          <Upload size={13} /> Chọn file ảnh
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Option 2: 16 Cute Presets */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>Bộ sưu tập Avatar Pixel ngộ nghĩnh:</span>
                    <span className="text-[11px] text-slate-400">Bấm để áp dụng nhanh</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                    {PRESET_AVATARS.map((preset) => {
                      const isSelected = avatarUrl === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.url)}
                          title={preset.name}
                          className={`relative p-1 rounded-xl transition cursor-pointer flex flex-col items-center group ${
                            isSelected
                              ? 'bg-amber-400/20 ring-2 ring-amber-400 scale-105'
                              : 'bg-slate-900 hover:bg-slate-700/80 border border-slate-700/60'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-10 h-10 rounded-lg object-contain"
                            loading="lazy"
                          />
                          <span className="text-[9px] text-slate-300 truncate w-full text-center mt-1 group-hover:text-amber-300">
                            {preset.name.split(' ')[0]}
                          </span>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 rounded-full p-0.5 shadow-xs">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Option 3: Custom image link */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Hoặc nhập liên kết ảnh (Image URL) trực tuyến:
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        value={customAvatarInput}
                        onChange={(e) => setCustomAvatarInput(e.target.value)}
                        placeholder="https://example.com/avatar.png"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                      />
                      <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-xl text-white transition cursor-pointer"
                    >
                      Dùng link
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Lưu thông tin cá nhân
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: ĐỔI MẬT KHẨU                                       */}
          {/* ======================================================== */}
          {activeTab === 'PASSWORD' && (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-4">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={14} /> Thay đổi mật khẩu đăng nhập
                </h3>

                {/* Old Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mật khẩu hiện tại <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu bạn đang dùng"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                      required
                    />
                    <KeyRound size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Mật khẩu mới <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                        required
                        minLength={6}
                      />
                      <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Xác nhận mật khẩu mới <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                        required
                      />
                      <Shield size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password strength tips */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Tiêu chuẩn mật khẩu an toàn:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400 pl-1">
                    <li>Có độ dài ít nhất từ 6 ký tự trở lên</li>
                    <li>Nên kết hợp chữ cái viết hoa, chữ thường và chữ số</li>
                    <li>Không sử dụng ngày sinh hoặc thông tin cá nhân dễ đoán</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Đang cập nhật...
                    </>
                  ) : (
                    <>
                      <KeyRound size={15} /> Cập nhật mật khẩu mới
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 3: SỞ THÍCH & CÀI ĐẶT                                  */}
          {/* ======================================================== */}
          {activeTab === 'PREFERENCES' && (
            <form onSubmit={handleSavePreferences} className="space-y-5">
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-4">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={14} /> Phong cách & Trợ lý ảo AI
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Tính cách của Bạn Đồng Hành AI / Thú Cưng:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'Vui vẻ', icon: '😄', desc: 'Năng động, tươi cười, tạo động lực' },
                      { id: 'Nghiêm túc', icon: '🧐', desc: 'Chuẩn mực, tập trung vào mục tiêu' },
                      { id: 'Dịu dàng', icon: '🥰', desc: 'Ấm áp, biết lắng nghe & vỗ về' },
                      { id: 'Ngắn gọn', icon: '⚡', desc: 'Súc tích, phản hồi nhanh gọn' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPetPersona(item.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          petPersona === item.id
                            ? 'bg-amber-400/20 border-amber-400 text-white ring-1 ring-amber-400'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <div className="text-lg mb-1">{item.icon}</div>
                        <div className="font-bold text-xs">{item.id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Dòng nhạc tập trung yêu thích
                    </label>
                    <select
                      value={favMusicGenre}
                      onChange={(e) => setFavMusicGenre(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Lo-fi Hip Hop">Lo-fi Hip Hop Chill</option>
                      <option value="Piano Classical">Piano Cổ Điển Thư Giãn</option>
                      <option value="Acoustic Coffee">Acoustic Quán Cà Phê</option>
                      <option value="Synthwave Retro">Synthwave / Cyberpunk</option>
                      <option value="Nature Sounds">Âm Thanh Tự Nhiên & Mưa Rơi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Nhắc uống nước định kỳ
                    </label>
                    <select
                      value={hydrationInterval}
                      onChange={(e) => setHydrationInterval(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value={30}>Mỗi 30 phút một lần</option>
                      <option value={45}>Mỗi 45 phút (Khuyên dùng)</option>
                      <option value={60}>Mỗi 60 phút</option>
                      <option value={90}>Mỗi 90 phút</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-slate-700/60 space-y-3">
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="text-amber-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Hiệu ứng âm thanh & Nhạc</div>
                        <div className="text-[10px] text-slate-400">Bật âm thanh khi click, tương tác và hoàn thành phiên Pomodoro</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-blue-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Chế độ tập trung yên tĩnh (Quiet Mode)</div>
                        <div className="text-[10px] text-slate-400">Ẩn bớt bong bóng lời thoại của thú cưng khi đang tập trung làm việc</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={quietMode}
                      onChange={(e) => setQuietMode(e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Lưu cài đặt sở thích
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 4: THÚ CƯNG ĐỒNG HÀNH                                  */}
          {/* ======================================================== */}
          {activeTab === 'PET' && userPet && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-blue-950/60 rounded-2xl p-5 border border-indigo-500/30 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-28 h-28 rounded-2xl bg-indigo-900/40 border border-indigo-400/30 flex items-center justify-center p-1 relative shadow-lg overflow-hidden shrink-0">
                  {userPet.petType ? (
                    <div className="transform scale-90">
                      <PixelPetCanvas
                        petType={userPet.petType}
                        currentState="IDLE"
                        scaleSize="SMALL"
                        showTooltip={false}
                        petName={userPet.name}
                        petLevel={userPet.level}
                      />
                    </div>
                  ) : (
                    <Heart size={36} className="text-amber-400 animate-pulse" />
                  )}
                  <span className="absolute bottom-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs z-10">
                    Lv.{userPet.level}
                  </span>
                </div>

                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h4 className="text-lg font-black text-white">{userPet.name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full font-semibold">
                      Loài: {userPet.petType?.name || 'Mèo Pixel'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-3">
                    {userPet.petType?.description || 'Người bạn nhỏ đồng hành cùng bạn mỗi ngày làm việc tràn đầy năng lượng.'}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Độ vui vẻ</div>
                      <div className="text-sm font-bold text-amber-300">{userPet.happiness}%</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Độ no</div>
                      <div className="text-sm font-bold text-emerald-300">{userPet.hunger}%</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Sức khỏe</div>
                      <div className="text-sm font-bold text-blue-300">{userPet.health}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {onNavigateTab && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        onNavigateTab('SHOP');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                    >
                      Ghé Cửa Hàng Trang Phục
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        onNavigateTab('PET');
                      }}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Chăm sóc Thú cưng ngay
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
        {modalContent}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center animate-in fade-in duration-200">
      {modalContent}
    </div>
  );
};
