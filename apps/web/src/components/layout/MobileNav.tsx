import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Sparkles,
  Calendar,
  HelpCircle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { icon: LayoutDashboard, label: 'dashboard', path: '/dashboard' },
  { icon: Building2, label: 'palaces', path: '/palaces' },
  { icon: BookOpen, label: 'stories', path: '/stories' },
  { icon: Sparkles, label: 'symbols', path: '/symbols' },
  { icon: Calendar, label: 'timetable', path: '/timetable' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 md:hidden">
      <div className="h-full flex items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0',
                isActive ? 'text-indigo-400' : 'text-slate-500'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium truncate max-w-full">
                {t(`nav.${item.label}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
