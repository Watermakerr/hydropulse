import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Waves, ClipboardCheck, Users, Terminal, UploadCloud, ShieldAlert, Settings, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Hồ chứa', path: '/reservoirs', icon: Waves },
    { name: 'Nhiệm vụ', path: '/tasks', icon: ClipboardCheck },
    { name: 'Người dùng', path: '/users', icon: Users },
    { name: 'Nhật ký hệ thống', path: '/logs', icon: Terminal },
    { name: 'Test Upload', path: '/upload-test', icon: UploadCloud },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col border-r-0 bg-slate-100 shadow-[24px_0_24px_rgba(0,51,88,0.03)] z-50">
      <div className="flex flex-col h-full py-8 px-4 font-sans antialiased tracking-tight text-sm font-medium">
        <div className="mb-10 px-2">
          <h1 className="text-xl font-bold tracking-tighter text-primary">HydroPulse Admin</h1>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant opacity-70 mt-1">Quản lý ranh giới</p>
        </div>
        
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300",
                  isActive 
                    ? "text-primary font-bold bg-white shadow-sm translate-x-1" 
                    : "text-slate-500 hover:text-primary-container hover:bg-slate-200/50"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <button className="w-full py-2.5 px-4 bg-primary text-on-primary rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Khẩn cấp
          </button>
          
          <div className="pt-4 border-t border-slate-200 space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-primary-container transition-colors duration-200">
              <Settings className="w-5 h-5" />
              <span>Cài đặt</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-primary-container transition-colors duration-200">
              <HelpCircle className="w-5 h-5" />
              <span>Hỗ trợ</span>
            </a>
          </div>
          
          <div className="flex items-center gap-3 px-2 pt-4">
            <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAf7h8KPZ6dQZ3NE4Vm0EkkCe0O8fmaNNalRSZGxnbEfu9Ax60Z7I2kcLiucchUyF_wB26QkqWOJe30IQ-EpaG1BwtDlVVLFisUCQs-ADY_D880hR_-1TQWg17oaPj-9JdS-uQ0NiJ338cLxuSRI0k0jCnnrwqd_s2A1dx0vXZNdS8MW1GUTTO_4DhipzZmskAPOqWgg0zWofNNr_uX6wvlbGIDPcHdJ31f9OOYOyvRltc9itQ_3NQsWSh_ntdPbCxV3KCgMQd3OZ0" 
                alt="Admin User" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-primary">Quản trị viên</span>
              <span className="text-[10px] text-slate-500">Người giám sát</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
