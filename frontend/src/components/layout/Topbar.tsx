import { Search, Bell, UserCircle, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Simple mapping for search placeholder based on route
  const getSearchPlaceholder = () => {
    switch (location.pathname) {
      case '/users': return 'Tìm kiếm người dùng...';
      case '/reservoirs': return 'Tìm kiếm ranh giới...';
      case '/tasks': return 'Search tasks...';
      case '/upload-test': return 'Test upload ảnh...';
      default: return 'Tìm kiếm tài nguyên...';
    }
  };

  const handleLogout = () => {
    api.clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/15">
      <div className="flex items-center justify-between px-8 ml-64 h-full font-sans text-sm font-semibold tracking-normal">
        <div className="flex items-center gap-8">
          <span className="text-lg font-black text-primary tracking-tighter">HydroPulse Boundary OS</span>
          <nav className="hidden lg:flex items-center gap-6">
            <a href="#" className="text-primary-container border-b-2 border-primary-container py-5">Network Status</a>
            <a href="#" className="text-slate-600 hover:text-primary-container transition-opacity">Map Layers</a>
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="relative group hidden md:block">
            <span className="absolute inset-y-0 left-3 flex items-center text-on-surface-variant">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text" 
              placeholder={getSearchPlaceholder()}
              className="bg-surface-container-highest border-none rounded-lg pl-10 pr-4 py-1.5 w-64 text-xs focus:ring-2 focus:ring-surface-tint/20 outline-none transition-all"
            />
          </div>
          
          <button
            onClick={() => navigate('/tasks')}
            className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-sm"
          >
            Create Task
          </button>
          
          <div className="flex items-center gap-4 text-on-surface-variant">
            <button className="hover:text-primary transition-colors p-1" title="Thông báo">
              <Bell className="w-5 h-5" />
            </button>
            <button className="hover:text-primary transition-colors p-1" title="Tài khoản">
              <UserCircle className="w-6 h-6" />
            </button>
            <button onClick={handleLogout} className="hover:text-error transition-colors p-1" title="Đăng xuất">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
