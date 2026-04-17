import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, PlusCircle, X } from 'lucide-react';
import { api, Reservoir, Task, User } from '../services/api';

type TaskForm = {
  title: string;
  description: string;
  reservoirId: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
};

const initialForm: TaskForm = {
  title: '',
  description: '',
  reservoirId: '',
  assignedTo: '',
  priority: 'medium',
  dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
};

export default function TaskManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(initialForm);

  const loadData = async () => {
    const [taskRows, reservoirRows, userRows] = await Promise.all([
      api.getTasks(),
      api.getReservoirs(),
      api.getUsers()
    ]);

    const workerRows = userRows.filter((u) => u.role === 'worker' && u.is_active);
    setTasks(taskRows);
    setReservoirs(reservoirRows);
    setWorkers(workerRows);

    setForm((prev) => ({
      ...prev,
      reservoirId: prev.reservoirId || reservoirRows[0]?.id || '',
      assignedTo: prev.assignedTo || workerRows[0]?.id || ''
    }));
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Khong the tai du lieu task');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === 'pending'), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t) => t.status === 'in_progress'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks]);

  const createTask = async () => {
    if (!form.title || !form.reservoirId) {
      setError('Can nhap ten task va chon ho chua');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createTask({
        reservoirId: form.reservoirId,
        assignedTo: form.assignedTo || undefined,
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate
      });
      await loadData();
      setIsModalOpen(false);
      setForm({
        ...initialForm,
        reservoirId: reservoirs[0]?.id || '',
        assignedTo: workers[0]?.id || ''
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tao task that bai');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (taskId: string, status: Task['status']) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTaskStatus(taskId, status);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cap nhat trang thai that bai');
    } finally {
      setSaving(false);
    }
  };

  const assignWorker = async (taskId: string, assignedTo: string) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTask(taskId, { assignedTo });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phan cong worker that bai');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderTaskCard = (task: Task) => (
    <div key={task.id} className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border-l-4 border-primary/30 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3 gap-2">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter bg-secondary-fixed px-2 py-1 rounded">
          {task.reservoir_name || 'N/A'}
        </span>
        <select
          value={task.status}
          onChange={(e) => updateStatus(task.id, e.target.value as Task['status'])}
          className="text-[10px] border border-slate-200 rounded px-2 py-1 font-bold"
          disabled={saving}
        >
          <option value="pending">pending</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>
      <h4 className="font-bold text-primary mb-1">{task.title}</h4>
      <p className="text-xs text-on-surface-variant mb-4 line-clamp-2">{task.description}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString()}
          </span>
          <span className="uppercase">{task.priority}</span>
        </div>
        <select
          value={task.assigned_to || ''}
          onChange={(e) => assignWorker(task.id, e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-2 py-1"
          disabled={saving}
        >
          <option value="">Chua phan cong</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {error && <div className="bg-error-container text-error px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Phân công & Theo dõi Nhiệm vụ</h2>
          <p className="text-on-surface-variant mt-2 font-medium">Admin tạo task, phân công worker và theo dõi trạng thái theo thời gian thực.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Chưa bắt đầu</h3>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black rounded-full">{pendingTasks.length}</span>
          </div>
          <div className="space-y-4">{pendingTasks.map(renderTaskCard)}</div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Đang thực hiện</h3>
            <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-black rounded-full">{inProgressTasks.length}</span>
          </div>
          <div className="space-y-4">{inProgressTasks.map(renderTaskCard)}</div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-tertiary">Hoàn thành</h3>
            <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black rounded-full">{completedTasks.length}</span>
          </div>
          <div className="space-y-4 opacity-85">{completedTasks.map(renderTaskCard)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8">
        <div className="md:col-span-3 bg-surface-container-high rounded-2xl p-8 flex items-center justify-between gap-8">
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-primary mb-2">Tiến độ nhiệm vụ</h3>
            <p className="text-sm text-on-surface-variant">Bạn có thể đổi trạng thái trực tiếp trên từng thẻ task, dữ liệu sẽ đồng bộ về dashboard.</p>
          </div>
          <div className="flex items-center gap-12">
            <div className="text-center">
              <p className="text-2xl font-black text-primary">{tasks.length}</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tổng task</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-tertiary">{workers.length}</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Worker</p>
            </div>
          </div>
        </div>

        <div
          className="bg-primary rounded-2xl p-6 flex flex-col justify-between items-start text-on-primary shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Khởi tạo nhanh<br />Nhiệm vụ mới</p>
            <p className="text-[10px] opacity-60 mt-1">Phân công worker trực tiếp</p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primary">Tạo nhiệm vụ mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Tên nhiệm vụ</label>
                <input
                  type="text"
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                  placeholder="Ví dụ: Kiểm tra mốc giới A-01"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Hồ chứa</label>
                  <select
                    className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                    value={form.reservoirId}
                    onChange={(e) => setForm({ ...form, reservoirId: e.target.value })}
                  >
                    {reservoirs.map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Nhân viên</label>
                  <select
                    className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  >
                    {workers.map((w) => (
                      <option value={w.id} key={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Độ ưu tiên</label>
                  <select
                    className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as TaskForm['priority'] })}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Hạn xử lý</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase text-on-surface-variant mb-1.5 tracking-wider">Mô tả chi tiết</label>
                <textarea
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-surface-tint p-3 text-sm outline-none"
                  placeholder="Nhập các yêu cầu cụ thể cho nhân viên hiện trường..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                ></textarea>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 py-3 rounded-lg text-sm font-bold text-secondary hover:bg-slate-200 transition-colors">
                  Hủy bỏ
                </button>
                <button
                  onClick={createTask}
                  disabled={saving}
                  className="flex-1 bg-primary py-3 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Xác nhận tạo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-6 right-6 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg">
          Đang đồng bộ...
        </div>
      )}

      {!tasks.length && (
        <div className="text-center text-on-surface-variant py-6">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-2 opacity-60" />
          Chưa có nhiệm vụ nào. Hãy tạo nhiệm vụ đầu tiên.
        </div>
      )}
    </div>
  );
}
