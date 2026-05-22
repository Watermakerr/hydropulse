import { Waves, HardHat, Flag, BadgeCheck, Download, Filter, MoreVertical, Maximize } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api, DashboardSummary, SystemLog, Reservoir, Task, ReservoirOverview } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

type ReservoirBackendStatus = 'active' | 'inactive' | 'under_review';

const statusLabelMap: Record<ReservoirBackendStatus, string> = {
  active: 'Hoạt động',
  inactive: 'Tạm ngưng',
  under_review: 'Đang rà soát'
};

const statusColorMap: Record<ReservoirBackendStatus, string> = {
  active: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  inactive: 'bg-secondary-container text-on-secondary-container',
  under_review: 'bg-error-container text-on-error-container'
};

const barColorMap: Record<ReservoirBackendStatus, string> = {
  active: 'bg-tertiary',
  inactive: 'bg-secondary',
  under_review: 'bg-error'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [hoaBinhOverview, setHoaBinhOverview] = useState<ReservoirOverview | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReservoirBackendStatus>('all');
  const [urgentTasksCount, setUrgentTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, logsData, reservoirsData, allTasks] = await Promise.all([
          api.getDashboardSummary(),
          api.getSystemLogs(),
          api.getReservoirs(),
          api.getTasks()
        ]);
        setSummary(summaryData);
        setLogs(logsData.slice(0, 3)); // Only show top 3 logs
        setReservoirs(reservoirsData.slice(0, 4)); // Only show top 4 reservoirs

        const hoaBinh = reservoirsData.find((r) => normalizeText(r.name).includes('hoa binh'));
        if (hoaBinh) {
          const overview = await api.getReservoirOverview(hoaBinh.id);
          setHoaBinhOverview(overview);
        } else {
          setHoaBinhOverview(null);
        }
        
        const urgentCount = allTasks.filter(t => t.priority === 'urgent' && (t.status === 'pending' || t.status === 'in_progress')).length;
        setUrgentTasksCount(urgentCount);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredReservoirs = reservoirs.filter((reservoir) => {
    const matchSearch =
      reservoir.name.toLowerCase().includes(search.toLowerCase()) || reservoir.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || reservoir.backend_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportCsv = () => {
    const rows = filteredReservoirs.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.backend_status,
      area_ha: r.area_ha || 0,
      water_level: r.water_level,
      last_updated: r.last_updated
    }));

    const header = 'id,name,status,area_ha,water_level,last_updated';
    const lines = rows.map((r) => `${r.id},"${r.name}",${r.status},${r.area_ha},${r.water_level},${r.last_updated}`);
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-reservoirs-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const overviewScan = hoaBinhOverview?.latest_scan || null;
  const currentAreaM2 = hoaBinhOverview?.current_boundary?.area_m2 || overviewScan?.water_surface_area || null;
  const changePercent = overviewScan?.change_percentage ?? null;
  const compareLabel = overviewScan?.compare_mode === 'seasonal'
    ? 'So với baseline mùa'
    : overviewScan?.compare_mode === 'previous'
      ? 'So với lần trước'
      : 'Chưa có baseline';

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight mb-2">Bảng điều khiển tổng quan</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tertiary pulse-dot"></div>
            <p className="text-on-surface-variant text-sm font-medium">Hệ thống đang hoạt động theo thời gian thực: {summary ? new Date(summary.generated_at).toLocaleTimeString() : '...'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-surface-variant transition-colors">
            <Download className="w-4 h-4" /> Xuất báo cáo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6">
        {/* Major Metric 1 */}
        <div className="lg:col-span-3 bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] border-none">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <Waves className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-bold text-tertiary bg-tertiary-fixed/30 px-2 py-1 rounded-full">+2.4%</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Tổng số hồ chứa</p>
          <h3 className="text-4xl font-black text-primary mt-1 tracking-tighter">{summary?.active_reservoirs || 0}</h3>
          <p className="text-[10px] text-on-surface-variant mt-2 font-medium">8 thực thể mới trong tháng này</p>
        </div>

        {/* Major Metric 2 */}
        <div className="lg:col-span-3 bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] border-none">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <HardHat className="w-5 h-5 text-primary" />
            </div>
            {urgentTasksCount > 0 && (
              <span className="text-[10px] font-bold text-error bg-error-container px-2 py-1 rounded-full">Khẩn cấp: {urgentTasksCount}</span>
            )}
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Nhiệm vụ đang thực hiện</p>
          <h3 className="text-4xl font-black text-primary mt-1 tracking-tighter">{summary?.tasks_in_progress || 0}</h3>
          <p className="text-[10px] text-on-surface-variant mt-2 font-medium">Trung bình hoàn thành 4.5h</p>
        </div>

        {/* Major Metric 3 */}
        <div className="lg:col-span-3 bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] border-none">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <Flag className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-bold text-on-secondary-fixed-variant bg-secondary-fixed px-2 py-1 rounded-full">76% Đạt</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Cột mốc cần kiểm tra</p>
          <h3 className="text-4xl font-black text-primary mt-1 tracking-tighter">{summary?.tasks_pending || 0}</h3>
          <p className="text-[10px] text-on-surface-variant mt-2 font-medium">Hạn chót vào Thứ Sáu tới</p>
        </div>

        {/* Major Metric 4 */}
        <div className="lg:col-span-3 bg-primary text-on-primary p-6 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] border-none relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg">
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Nhân viên trực tuyến</p>
            <h3 className="text-4xl font-black mt-1 tracking-tighter">{summary?.active_workers || 0}</h3>
            <p className="text-[10px] text-white/40 mt-2 font-medium">Toàn bộ trạm đang kết nối</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary-container rounded-full opacity-50 blur-2xl"></div>
        </div>
      </div>

      {hoaBinhOverview && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_24px_24px_rgba(0,51,88,0.03)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-primary">Tổng quan hồ Hòa Bình</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">Cập nhật theo lần quét vệ tinh gần nhất</p>
            </div>
            <button
              onClick={() => navigate('/reservoirs')}
              className="text-xs font-bold text-primary hover:text-primary/80"
            >
              Xem chi tiết
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Diện tích hiện tại</p>
              <p className="text-2xl font-black text-primary mt-2">
                {currentAreaM2 ? `${(currentAreaM2 / 10000).toFixed(2)} ha` : 'N/A'}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1">{compareLabel}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Biến động</p>
              <p className={`text-2xl font-black mt-2 ${changePercent !== null && changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {changePercent !== null ? `${changePercent.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1">{overviewScan?.season || '—'}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Tình trạng mốc</p>
              <p className="text-2xl font-black text-primary mt-2">{hoaBinhOverview.markers_warning}/{hoaBinhOverview.markers_total}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Mốc cần kiểm tra</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Nhiệm vụ</p>
              <p className="text-2xl font-black text-primary mt-2">
                {hoaBinhOverview.tasks_in_progress}/{hoaBinhOverview.tasks_total}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1">Đang xử lý</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Cảnh báo</p>
              <p className="text-2xl font-black text-primary mt-2">{overviewScan?.alert_level || 'N/A'}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">
                {overviewScan?.capture_date ? new Date(overviewScan.capture_date).toLocaleDateString('vi-VN') : 'Chưa quét'}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Reservoir Status Overview Table */}
        <section className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] overflow-hidden h-full">
            <div className="p-6 flex justify-between items-center border-none">
              <h4 className="text-lg font-bold text-primary">Tình trạng hồ chứa</h4>
              <div className="flex gap-2 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm hồ..."
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | ReservoirBackendStatus)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="all">Tất cả</option>
                  <option value="active">Hoạt động</option>
                  <option value="under_review">Đang rà soát</option>
                  <option value="inactive">Tạm ngưng</option>
                </select>
                <button className="p-1 hover:bg-surface-container text-on-surface-variant rounded"><Filter className="w-5 h-5" /></button>
                <button className="p-1 hover:bg-surface-container text-on-surface-variant rounded"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                    <th className="px-6 py-4">Mã số hồ</th>
                    <th className="px-6 py-4">Vị trí</th>
                    <th className="px-6 py-4">Mực nước (m)</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Cập nhật</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium divide-y divide-surface-variant/10">
                  {filteredReservoirs.map(reservoir => {
                    const backendStatus = reservoir.backend_status;

                    // Mock percentage calculation
                    const percentage = Math.min(100, Math.max(0, (reservoir.water_level / (reservoir.water_level + 20)) * 100));

                    return (
                      <tr
                        key={reservoir.id}
                        className="hover:bg-surface-container-low transition-colors cursor-pointer"
                        onClick={() => navigate(`/reservoirs?reservoirId=${reservoir.id}`)}
                      >
                        <td className="px-6 py-5 font-bold text-primary">{reservoir.id}</td>
                        <td className="px-6 py-5 text-on-surface">{reservoir.name}, {reservoir.region}</td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span>{reservoir.water_level}</span>
                            <div className="w-12 h-1 bg-surface-variant rounded-full overflow-hidden">
                              <div className={`${barColorMap[backendStatus]} h-full`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`${statusColorMap[backendStatus]} px-2 py-1 rounded text-[10px] font-bold uppercase`}>
                            {statusLabelMap[backendStatus]}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant text-xs">{new Date(reservoir.last_updated).toLocaleTimeString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredReservoirs.length && (
                <div className="text-center py-6 text-sm text-on-surface-variant">Không có hồ phù hợp bộ lọc.</div>
              )}
            </div>
          </div>
        </section>

        {/* Sidebar Contextual Content */}
        <section className="lg:col-span-4 space-y-8">
          {/* Map Preview */}
          <div className="bg-surface-container-lowest p-1 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] relative overflow-hidden h-64 border-none">
            <div className="absolute inset-0 z-0">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQQ07m9E6wqRYwR83b5dG6XjtK_i9jIAnsPt084NcRKGPjG0-dclFmBCzP0rA4JihxOcPSeqCUv-hnBMo1oFzH8yeXvRJhQAtQ9MABvXS_pqGGRpwm-98WtIx6zd37LJRa9fS68lE0EKLPgfjgCmaCWHVhoM44BpQqI6ELeguGbMeglFGJGQFeezSjzY3N_WL9P7QG3_8TSbE7aFfyTBrmM9hYkozxeTbfpURiTx5sfQC3sbtQrkvjQVXZZ917oySB0fX06KqXIm4" 
                alt="Map Preview" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
            <div className="absolute bottom-4 left-4 z-20">
              <h5 className="text-white font-bold">Bản đồ ranh giới số</h5>
              <p className="text-white/70 text-xs">Vùng quản lý Miền Bắc & Trung</p>
            </div>
            <button className="absolute top-4 right-4 z-20 bg-white/20 backdrop-blur-md p-2 rounded-lg text-white hover:bg-white/40 transition-colors">
              <Maximize className="w-5 h-5" />
            </button>
            {/* Pulse indicators on map */}
            <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-tertiary rounded-full pulse-dot z-20"></div>
            <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-error rounded-full pulse-dot z-20"></div>
          </div>

          {/* Recent Activity Logs */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(0,51,88,0.03)] border-none">
            <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-6">Hoạt động gần đây</h4>
            <div className="space-y-6">
              {logs.map(log => (
                <div key={log.id} className="flex gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${log.level === 'error' ? 'bg-error' : log.level === 'warning' ? 'bg-tertiary' : 'bg-primary'}`}></div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">{log.message}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{log.source}</p>
                    <span className="text-[10px] text-on-surface-variant font-medium mt-1 inline-block">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/logs" className="w-full mt-6 py-2 text-xs font-bold text-primary hover:bg-surface-container-low transition-colors rounded-lg flex items-center justify-center">
              Xem tất cả lịch sử
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
