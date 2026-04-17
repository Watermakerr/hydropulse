import { useState, useEffect } from 'react';
import { ChevronRight, UserPlus, Users, ShieldCheck, ShieldAlert, Filter, Edit2, KeyRound, Trash2, ChevronLeft } from 'lucide-react';
import { api, User } from '../services/api';

export default function UserDirectory() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'worker'>('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'worker' as 'admin' | 'worker'
  });
  const [editForm, setEditForm] = useState({
    fullName: '',
    role: 'worker' as 'admin' | 'worker',
    isActive: true
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.getUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const reloadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data);
  };

  const handleCreateUser = async () => {
    if (!form.fullName || !form.email || !form.password) {
      setError('Vui lòng nhập đủ thông tin.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email)) {
      setError('Email không hợp lệ.');
      return;
    }

    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await api.createUser(form);
      await reloadUsers();
      setOpenModal(false);
      setForm({ fullName: '', email: '', password: '', role: 'worker' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo người dùng thất bại');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (user: User) => {
    setError(null);
    setSelectedUser(user);
    setEditForm({
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active
    });
    setEditModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) {
      return;
    }

    if (!editForm.fullName.trim()) {
      setError('Họ tên không được để trống.');
      return;
    }

    setSavingUser(true);
    setError(null);
    try {
      await api.updateUser(selectedUser.id, {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        isActive: editForm.isActive
      });
      await reloadUsers();
      setEditModalOpen(false);
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cập nhật người dùng thất bại');
    } finally {
      setSavingUser(false);
    }
  };

  const openPasswordModal = (user: User) => {
    setError(null);
    setSelectedUser(user);
    setNewPassword('');
    setPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) {
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSavingPassword(true);
    setError(null);
    try {
      await api.resetUserPassword(selectedUser.id, newPassword);
      setPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setSavingPassword(false);
    }
  };

  const openDeleteModal = (user: User) => {
    setError(null);
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }

    setDeletingUser(true);
    setError(null);
    try {
      await api.deleteUser(selectedUser.id);
      await reloadUsers();
      setDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa người dùng thất bại');
    } finally {
      setDeletingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeUsers = users.filter(u => u.status === 'active').length;
  const inactiveUsers = users.filter(u => u.status === 'inactive').length;
  const displayedUsers = users.filter((user) => roleFilter === 'all' || user.role === roleFilter);

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
            <span>Hệ thống</span>
            <ChevronRight className="w-3 h-3" />
            <span>Cấu hình</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-bold">Quản lý Người dùng</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Quản lý Người dùng</h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">Quản trị viên có thể giám sát các đặc quyền truy cập hệ thống, theo dõi hoạt động đăng nhập và quản lý vai trò của nhân viên trong mạng lưới HydroPulse.</p>
        </div>
        <button onClick={() => { setError(null); setOpenModal(true); }} className="bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-lg flex items-center gap-3 font-bold text-sm shadow-xl shadow-primary/10 hover:scale-[1.02] transition-transform">
          <UserPlus className="w-5 h-5" />
          Thêm người dùng mới
        </button>
      </div>

      {error && <div className="bg-error-container text-error px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}

      {/* Bento Layout for Stats & Main Table */}
      <div className="grid grid-cols-12 gap-6">
        {/* Quick Stats Chips */}
        <div className="col-span-12 flex flex-wrap gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Tổng số</div>
              <div className="text-xl font-black text-on-surface">{users.length}</div>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Hoạt động</div>
              <div className="text-xl font-black text-on-surface">{activeUsers}</div>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Bị khóa</div>
              <div className="text-xl font-black text-on-surface">{inactiveUsers}</div>
            </div>
          </div>
        </div>

        {/* Main Data Table Container */}
        <div className="col-span-12 bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-surface-container-low/50">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-on-surface">Danh sách nhân sự</span>
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                    roleFilter === 'all' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                    roleFilter === 'admin' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Quản trị viên
                </button>
                <button
                  onClick={() => setRoleFilter('worker')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                    roleFilter === 'worker' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Nhân viên
                </button>
              </div>
            </div>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Họ tên</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Vai trò</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Lần đăng nhập cuối</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-sm font-bold text-slate-500">
                          {user.name.charAt(0)}
                        </div>
                        <div className={`flex flex-col ${user.status === 'inactive' ? 'opacity-60' : ''}`}>
                          <span className="text-sm font-bold text-on-surface">{user.name}</span>
                          <span className="text-xs text-on-surface-variant">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        user.role === 'admin' 
                          ? 'bg-primary-fixed text-on-primary-fixed-variant' 
                          : 'bg-secondary-fixed text-on-secondary-fixed-variant'
                      } ${user.status === 'inactive' ? 'opacity-60' : ''}`}>
                        {user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên hiện trường (Worker)'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.status === 'active' ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(0,56,45,0.3)] relative">
                              <div className="absolute inset-0 rounded-full bg-tertiary animate-ping opacity-20"></div>
                            </div>
                            <span className="text-xs font-medium text-on-surface">Đang hoạt động</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-outline"></div>
                            <span className="text-xs font-medium text-on-surface-variant">Ngừng hoạt động</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-on-surface-variant">{new Date(user.last_login).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                          title="Chỉnh sửa"
                          onClick={() => openEditModal(user)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                          title="Đổi mật khẩu"
                          onClick={() => openPasswordModal(user)}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          title="Xóa"
                          onClick={() => openDeleteModal(user)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!displayedUsers.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                      Không có người dùng phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Hiển thị {displayedUsers.length} trên {users.length} người dùng</span>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-on-surface-variant hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-on-surface-variant hover:bg-slate-50 text-xs font-bold">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-on-surface-variant hover:bg-slate-50 text-xs font-bold">3</button>
              <span className="text-on-surface-variant px-1">...</span>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-on-surface-variant hover:bg-slate-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer / Credits */}
      <footer className="mt-20 py-8 border-t border-slate-200/30 flex flex-col md:flex-row items-center justify-between text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-bold">
        <div>© 2024 HydroPulse Boundary OS - Phiên bản 2.4.0</div>
        <div className="flex gap-8 mt-4 md:mt-0">
          <a href="#" className="hover:text-primary">Bảo mật</a>
          <a href="#" className="hover:text-primary">Điều khoản</a>
          <a href="#" className="hover:text-primary">Trình quản lý hệ thống</a>
        </div>
      </footer>

      {openModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Thêm người dùng mới</h3>
              <button onClick={() => setOpenModal(false)} className="text-sm font-bold text-on-surface-variant">Đóng</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Họ tên</label>
                <input className="w-full p-3 rounded-lg border border-slate-200" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Email</label>
                <input className="w-full p-3 rounded-lg border border-slate-200" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <p className="text-[11px] text-on-surface-variant mt-1">Định dạng ví dụ: name@domain.com</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Mật khẩu</label>
                <input type="password" className="w-full p-3 rounded-lg border border-slate-200" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-[11px] text-on-surface-variant mt-1">Tối thiểu 6 ký tự.</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Vai trò</label>
                <select className="w-full p-3 rounded-lg border border-slate-200" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'worker' })}>
                  <option value="worker">Worker</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleCreateUser} disabled={creating} className="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">
                {creating ? 'Đang tạo...' : 'Tạo người dùng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Chỉnh sửa người dùng</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-sm font-bold text-on-surface-variant">Đóng</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Họ tên</label>
                <input className="w-full p-3 rounded-lg border border-slate-200" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Vai trò</label>
                <select className="w-full p-3 rounded-lg border border-slate-200" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'worker' })}>
                  <option value="worker">Worker</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Trạng thái</label>
                <select className="w-full p-3 rounded-lg border border-slate-200" value={editForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </div>
              <button onClick={handleUpdateUser} disabled={savingUser} className="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">
                {savingUser ? 'Đang cập nhật...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Đặt lại mật khẩu</h3>
              <button onClick={() => setPasswordModalOpen(false)} className="text-sm font-bold text-on-surface-variant">Đóng</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-on-surface-variant">Người dùng: {selectedUser.full_name} ({selectedUser.email})</p>
              <div>
                <label className="block text-xs font-bold mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  className="w-full p-3 rounded-lg border border-slate-200"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-[11px] text-on-surface-variant mt-1">Tối thiểu 6 ký tự.</p>
              </div>
              <button onClick={handleResetPassword} disabled={savingPassword} className="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">
                {savingPassword ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Xác nhận xóa người dùng</h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-sm font-bold text-on-surface-variant">Đóng</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant">
                Bạn có chắc muốn xóa người dùng {selectedUser.full_name}? Tài khoản sẽ bị vô hiệu hóa khỏi hệ thống.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-2 rounded-lg bg-slate-100 text-sm font-bold">Hủy</button>
                <button onClick={handleDeleteUser} disabled={deletingUser} className="flex-1 py-2 rounded-lg bg-error text-white text-sm font-bold disabled:opacity-50">
                  {deletingUser ? 'Đang xóa...' : 'Xóa người dùng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
