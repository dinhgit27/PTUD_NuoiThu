import React, { useState } from 'react';
import { Check, Copy, LogIn, LogOut, Users } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface DepartmentWorkspaceProps {
  user: User;
  onMembershipChange: () => Promise<void>;
}

export const DepartmentWorkspace: React.FC<DepartmentWorkspaceProps> = ({
  user,
  onMembershipChange
}) => {
  const [departmentName, setDepartmentName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const submitMembershipChange = async (request: () => Promise<unknown>, successMessage: string) => {
    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      await request();
      await onMembershipChange();
      setNotice(successMessage);
      setDepartmentName('');
      setInviteCode('');
    } catch (reason: any) {
      setError(reason?.response?.data?.error || 'Không thể cập nhật phòng ban. Vui lòng thử lại.');
    } finally {
      setIsBusy(false);
    }
  };

  const copyInviteCode = async () => {
    const code = user.department?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Không thể sao chép mã. Hãy chọn và sao chép mã thủ công.');
    }
  };

  return (
    <section className="max-w-2xl mx-auto bg-white border-2 border-charcoal rounded-2xl shadow-pixel p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-sage-100 border-2 border-charcoal rounded-xl text-sage-600">
          <Users size={22} />
        </div>
        <div>
          <h2 className="font-pixel text-sm text-charcoal">Phòng chung của bạn</h2>
          <p className="text-xs text-gray-500 mt-1">Phòng chung là tùy chọn; bạn có thể tạo hoặc tham gia sau.</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 p-2.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 p-2.5 bg-green-50 border border-green-300 rounded-lg text-xs text-green-800">{notice}</p>}

      {user.department ? (
        <div className="rounded-xl border-2 border-sage-400 bg-sage-50 p-4">
          <div className="font-pixel text-xs text-charcoal">{user.department.name}</div>
          <p className="text-xs text-gray-600 mt-2">Gửi mã này cho bạn bè để họ tham gia phòng chung.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border-2 border-charcoal bg-white px-3 py-2 font-mono text-sm font-bold tracking-widest">
              {user.department.inviteCode || 'Mã mời chưa khả dụng'}
            </code>
            {user.department.inviteCode && (
              <button
                type="button"
                onClick={copyInviteCode}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-charcoal bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Đã sao chép' : 'Sao chép mã'}
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void submitMembershipChange(
              () => api.leaveDepartment(),
              'Bạn đã rời phòng chung. Thú cưng và tài khoản vẫn được giữ nguyên.'
            )}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-charcoal bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut size={14} /> Rời phòng ban
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <form
            className="rounded-xl border-2 border-charcoal bg-cream-100 p-4"
            onSubmit={event => {
              event.preventDefault();
              void submitMembershipChange(
                () => api.createDepartment(departmentName),
                'Đã tạo phòng chung. Hãy chia sẻ mã mời với bạn bè.'
              );
            }}
          >
            <h3 className="font-pixel text-[11px] text-charcoal">Tạo phòng chung</h3>
            <p className="mt-2 text-[11px] text-gray-600">Tạo không gian chung mới và nhận mã mời riêng.</p>
            <label htmlFor="department-name" className="mt-3 block text-[11px] font-bold">Tên phòng chung</label>
            <input
              id="department-name"
              value={departmentName}
              onChange={event => setDepartmentName(event.target.value)}
              maxLength={80}
              required
              className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 text-xs"
              placeholder="Ví dụ: Nhóm Thiết kế"
            />
            <button
              type="submit"
              disabled={isBusy || !departmentName.trim()}
              className="mt-3 w-full rounded-lg border-2 border-charcoal bg-sage-400 px-3 py-2 text-xs font-pixel text-white disabled:opacity-50"
            >
              {isBusy ? 'Đang xử lý...' : 'Tạo phòng chung'}
            </button>
          </form>

          <form
            className="rounded-xl border-2 border-charcoal bg-white p-4"
            onSubmit={event => {
              event.preventDefault();
              void submitMembershipChange(
                () => api.joinDepartment(inviteCode),
                'Đã tham gia phòng chung thành công.'
              );
            }}
          >
            <h3 className="font-pixel text-[11px] text-charcoal">Tham gia phòng chung</h3>
            <p className="mt-2 text-[11px] text-gray-600">Nhập mã mời phòng chung mà bạn bè đã chia sẻ với bạn.</p>
            <label htmlFor="department-invite" className="mt-3 block text-[11px] font-bold">Mã mời</label>
            <input
              id="department-invite"
              value={inviteCode}
              onChange={event => setInviteCode(event.target.value.toUpperCase())}
              maxLength={16}
              autoComplete="off"
              required
              className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 font-mono text-xs uppercase tracking-widest"
              placeholder="Nhập mã"
            />
            <button
              type="submit"
              disabled={isBusy || !inviteCode.trim()}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-charcoal bg-terracotta-400 px-3 py-2 text-xs font-pixel text-white disabled:opacity-50"
            >
              <LogIn size={14} /> Tham gia phòng chung
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
