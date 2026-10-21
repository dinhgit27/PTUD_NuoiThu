import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { AlertTriangle, ChevronLeft, ChevronRight, Search, ShieldCheck, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

type ManagedUser = Pick<User, 'id' | 'email' | 'fullName' | 'role'> & {
  status: string;
  createdAt: string;
  violationCount: number;
};

type ViolationSession = {
  id: string;
  mode: string;
  startTime: string;
  durationMinutes: number;
  focusScore: number;
  violationsCount: number;
};

function getError(error: unknown) {
  return error instanceof AxiosError
    ? error.response?.data?.error || 'Không thể hoàn thành thao tác.'
    : 'Không thể hoàn thành thao tác.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

export const AdminAccessManagement: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [violations, setViolations] = useState<ViolationSession[]>([]);
  const [loadingViolations, setLoadingViolations] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getAdminUsers({
        page,
        pageSize: 10,
        search,
        role: role || undefined,
        status: status || undefined
      });
      setUsers(response.data.users);
      setPageCount(Math.max(1, response.data.pagination.totalPages));
      setTotal(response.data.pagination.total);
    } catch (loadError) {
      setError(getError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [page, search, role, status]);

  const updateRole = async (user: ManagedUser, nextRole: 'ADMIN' | 'USER') => {
    if (user.role === nextRole) return;
    const action = nextRole === 'ADMIN' ? 'cấp quyền Admin' : 'hạ quyền xuống User';
    if (!window.confirm(`Bạn chắc chắn muốn ${action} cho ${user.fullName}?`)) return;
    setBusyUser(user.id);
    setError('');
    setMessage('');
    try {
      const response = await api.updateUserRole(user.id, nextRole);
      setMessage(response.data.message);
      await loadUsers();
    } catch (updateError) {
      setError(getError(updateError));
    } finally {
      setBusyUser(null);
    }
  };

  const updateStatus = async (user: ManagedUser, nextStatus: string) => {
    if (user.status === nextStatus) return;
    if (nextStatus !== 'ACTIVE' && !window.confirm(`Bạn có chắc muốn ${nextStatus === 'LOCKED' ? 'khóa' : 'vô hiệu hóa'} tài khoản ${user.fullName}?`)) return;
    setBusyUser(user.id);
    setError('');
    setMessage('');
    try {
      const response = await api.toggleUserStatus(user.id, nextStatus);
      setMessage(response.data.message);
      await loadUsers();
    } catch (updateError) {
      setError(getError(updateError));
    } finally {
      setBusyUser(null);
    }
  };

  const showViolations = async (user: ManagedUser) => {
    setSelectedUser(user);
    setViolations([]);
    setLoadingViolations(true);
    try {
      const response = await api.getUserViolations(user.id);
      setViolations(response.data.sessions);
    } catch (loadError) {
      setError(getError(loadError));
      setSelectedUser(null);
    } finally {
      setLoadingViolations(false);
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-pixel text-lg text-charcoal">Quản lý người dùng</h2>
          <p className="mt-1 text-sm text-gray-600">Tìm tài khoản, quản lý quyền và trạng thái truy cập, xem lịch sử vi phạm.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600">
          <Users size={15} className="mr-1 inline" /> {total} tài khoản
        </div>
      </header>

      {(error || message) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${error ? 'border-red-300 bg-red-50 text-red-700' : 'border-green-300 bg-green-50 text-green-800'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_170px_170px]">
        <label className="relative block">
          <span className="sr-only">Tìm theo tên hoặc email</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder="Tìm tên hoặc email..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          />
        </label>
        <label className="text-xs font-bold text-gray-600">
          Quyền
          <select value={role} onChange={event => { setRole(event.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-charcoal">
            <option value="">Tất cả quyền</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600">
          Trạng thái
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-charcoal">
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
            <option value="INACTIVE">Không hoạt động</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Tài khoản</th>
                <th className="px-4 py-3 font-bold">Ngày tạo</th>
                <th className="px-4 py-3 font-bold">Quyền</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Vi phạm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Đang tải danh sách...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Không tìm thấy tài khoản phù hợp.</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <div className="font-bold text-charcoal">{user.fullName}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Quyền của ${user.fullName}`}
                      disabled={busyUser === user.id}
                      value={user.role}
                      onChange={event => void updateRole(user, event.target.value as 'ADMIN' | 'USER')}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold disabled:opacity-50"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Trạng thái tài khoản ${user.fullName}`}
                      disabled={busyUser === user.id}
                      value={user.status}
                      onChange={event => void updateStatus(user, event.target.value)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-bold disabled:opacity-50 ${user.status === 'ACTIVE' ? 'border-green-200 bg-green-50 text-green-800' : user.status === 'LOCKED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="LOCKED">Đã khóa</option>
                      <option value="INACTIVE">Vô hiệu hóa</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void showViolations(user)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-50"
                    >
                      <AlertTriangle size={14} /> {user.violationCount}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
          <span className="text-xs text-gray-500">Trang {page} / {pageCount} · {total} tài khoản</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">
              <ChevronLeft size={14} /> Trước
            </button>
            <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(value => value + 1)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </footer>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setSelectedUser(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="violation-title" className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl" onClick={event => event.stopPropagation()}>
            <header className="flex items-start justify-between border-b border-gray-100 p-5">
              <div>
                <h3 id="violation-title" className="font-bold text-charcoal">Lịch sử vi phạm</h3>
                <p className="mt-1 text-xs text-gray-500">{selectedUser.fullName} · {selectedUser.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedUser(null)} aria-label="Đóng lịch sử vi phạm" className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </header>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {loadingViolations ? <p className="py-8 text-center text-sm text-gray-500">Đang tải lịch sử...</p> : violations.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Tài khoản này chưa có phiên ghi nhận vi phạm.</p>
              ) : (
                <div className="space-y-2">
                  {violations.map(session => (
                    <article key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-xs">
                      <div>
                        <div className="font-bold text-charcoal">{formatDate(session.startTime)} · {session.mode}</div>
                        <div className="mt-1 text-gray-500">Phiên {session.durationMinutes} phút · Điểm tập trung {session.focusScore}</div>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-800">{session.violationsCount} vi phạm</span>
                    </article>
                  ))}
                  <p className="pt-2 text-[11px] text-gray-500">Hiển thị tối đa 50 phiên gần nhất có vi phạm.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
