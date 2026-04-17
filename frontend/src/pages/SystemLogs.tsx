import { useState, useEffect } from 'react';
import { ChevronRight, Activity, AlertTriangle, Info, XCircle, Search, Filter, Download, Sparkles, X } from 'lucide-react';
import { api, SystemLog } from '../services/api';
import { geminiService } from '../services/geminiService';

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.getSystemLogs();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch logs", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const handleAnalyzeLogs = async () => {
    setIsAnalyzing(true);
    setIsModalOpen(true);
    try {
      const analysis = await geminiService.analyzeLogs(logs);
      setAiAnalysis(analysis);
    } catch (error) {
      setAiAnalysis("Đã xảy ra lỗi khi phân tích nhật ký.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <Info className="w-4 h-4 text-primary" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-tertiary" />;
      case 'error': return <XCircle className="w-4 h-4 text-error" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'info': return 'bg-primary-fixed text-on-primary-fixed-variant';
      case 'warning': return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
      case 'error': return 'bg-error-container text-error';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
            <span>Hệ thống</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-bold">Nhật ký Hệ thống</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Nhật ký Hệ thống</h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">Theo dõi các sự kiện, cảnh báo và lỗi hệ thống theo thời gian thực để đảm bảo hoạt động ổn định của HydroPulse.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleAnalyzeLogs}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Sparkles className="w-4 h-4" />
            Phân tích bằng AI
          </button>
          <button className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm hover:bg-surface-container-high transition-colors">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-low/50">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhật ký..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant border border-slate-200 hover:bg-slate-50'}`}
            >
              Tất cả
            </button>
            <button 
              onClick={() => setFilter('info')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${filter === 'info' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-white text-on-surface-variant border border-slate-200 hover:bg-slate-50'}`}
            >
              <Info className="w-3 h-3" /> Info
            </button>
            <button 
              onClick={() => setFilter('warning')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${filter === 'warning' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-white text-on-surface-variant border border-slate-200 hover:bg-slate-50'}`}
            >
              <AlertTriangle className="w-3 h-3" /> Warning
            </button>
            <button 
              onClick={() => setFilter('error')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${filter === 'error' ? 'bg-error-container text-error' : 'bg-white text-on-surface-variant border border-slate-200 hover:bg-slate-50'}`}
            >
              <XCircle className="w-3 h-3" /> Error
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button className="p-2 text-on-surface-variant hover:text-primary transition-colors bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-48">Thời gian</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-32">Mức độ</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-48">Nguồn</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Thông điệp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-mono text-sm">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getLevelStyle(log.level)}`}>
                      {getLevelIcon(log.level)}
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant font-medium text-xs">
                    {log.source}
                  </td>
                  <td className="px-6 py-4 text-on-surface">
                    {log.message}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-sans">
                    <Activity className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p>Không tìm thấy nhật ký nào phù hợp với bộ lọc.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Analysis Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-primary text-on-primary">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-bold">Phân tích Hệ thống bằng AI</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="text-on-surface-variant font-medium animate-pulse">AI đang phân tích nhật ký hệ thống...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-on-surface">
                  {aiAnalysis ? (
                    <div className="whitespace-pre-wrap">{aiAnalysis}</div>
                  ) : (
                    <p className="text-slate-500 italic">Không có dữ liệu phân tích.</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-surface-container-low flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
