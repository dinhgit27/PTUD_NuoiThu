import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { ShieldCheck, Users } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

type ManagedUser = Pick<User, 'id' | 'email' | 'fullName' | 'role'> & {
  status: string;
  createdAt: string;
};

function getError(error: unknown) {
  return error instanceof AxiosError
    ? error.response?.data?.error || 'Không thể hoàn thành thao tác.'
    : 'Không thể hoàn thành thao tác.';
}

export const AdminAccessManagement: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    try {
      const response = await api.getAdminUsers();
      setUsers(response.data);
    } catch (loadError) {
      setError(getError(loadError));
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const updateRole = async (user: ManagedUser, role: 'ADMIN' | 'USER') => {
    if (user.role === role) return;
    const action = role === 'ADMIN' ? 'cấp quyền Admin' : 'hạ quyền xuống User';
    if (!window.confirm(`Bạn chắc chắn muốn ${action} cho ${user.fullName}?`)) return;
    setBusyUser(user.id);
    setError('');
    setMessage('');
    try {
      const response = await api.updateUserRole(user.id, role);
      setMessage(response.data.message);
      await loadUsers();
    } catch (updateError) {
      setError(getError(updateError));
    } finally {
      setBusyUser(null);
    }
  };

  const updateStatus = async (user: ManagedUser) => {
    const status = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    setBusyUser(user.id);
    setError('');
    setMessage('');
    try {
      const response = await api.toggleUserStatus(user.id, status);
      setMessage(response.data.message);
      await loadUsers();
    } catch (updateError) {
      setError(getError(updateError));
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border-2 border-charcoal bg-white p-5 shadow-pixel">
      <header className="flex items-center gap-2">
        <ShieldCheck size={19} className="text-indigo-600" />
        <div>
          <h3 className="font-pixel text-sm">Quản lý quyền và tài khoản</h3>
          <p className="mt-1 text-xs text-gray-600">Hệ thống chỉ có hai quyền: Admin và User. Chỉ Admin được vào bảng quản trị và quản lý cửa hàng.</p>
        </div>
      </header>
      {(error || message) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border-2 p-3 text-sm ${error ? 'border-red-500 bg-red-50 text-red-700' : 'border-sage-500 bg-sage-50 text-sage-800'}`}>{error || message}</div>}
      <div className="space-y-2">
        {users.map(user => (
          <article key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-charcoal p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-100"><Users size={17} /></div>
            <div className="min-w-40 flex-1">
              <strong className="text-xs">{user.fullName}</strong>
              <p className="text-[10px] text-gray-500">{user.email}</p>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] font-bold ${user.status === 'ACTIVE' ? 'bg-sage-100 text-sage-800' : 'bg-red-100 text-red-700'}`}>{user.status}</span>
            <select
              aria-label={`Quyền của ${user.fullName}`}
              disabled={busyUser === user.id}
              value={user.role}
              onChange={event => void updateRole(user, event.target.value as 'ADMIN' | 'USER')}
              className="rounded border-2 border-charcoal bg-white px-2 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button disabled={busyUser === user.id} onClick={() => void updateStatus(user)} className="rounded border-2 border-charcoal bg-cream-100 px-3 py-1.5 text-[10px] font-bold disabled:opacity-50">
              {user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};
