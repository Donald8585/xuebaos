import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Sparkles,
  Calendar,
  HelpCircle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageCircle,
  BookMarked,
  Link2,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'dashboard', path: '/dashboard' },
  { icon: Building2, label: 'palaces', path: '/palaces' },
  { icon: BookOpen, label: 'stories', path: '/stories' },
  { icon: Sparkles, label: 'symbols', path: '/symbols' },
  { icon: Calendar, label: 'timetable', path: '/timetable' },
  { icon: HelpCircle, label: 'qbank', path: '/qbank' },
  { icon: BarChart3, label: 'analytics', path: '/analytics' },
  { icon: MessageCircle, label: 'chat', path: '/chat' },
  { icon: BookMarked, label: 'codex', path: '/codex' },
  { icon: Link2, label: 'abbreviations', path: '/abbreviations' },
  { icon: Settings, label: 'settings', path: '/settings' },
];

const bottomItems = [
  { icon: Monitor, label: 'desktop', path: '/desktop' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) return null;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      className={cn(
        'fixed left-0 top-0 z-30 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col pt-16'
      )}
    >
      <div className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const label = t(`nav.${item.label}`);

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 mx-auto',
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-400 shadow-lg shadow-indigo-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Icon size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{label}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-pill"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop mode link */}
      <div className="px-3 py-2">
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const label = t(`nav.${item.label}`);
          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 mx-auto',
                      isActive
                        ? 'bg-emerald-600/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Icon size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-emerald-600/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{label}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-pill-desktop"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-800">
        {sidebarCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSidebarCollapsed(false)}
                className="w-12 h-12 mx-auto rounded-xl"
              >
                <ChevronRight size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setSidebarCollapsed(true)}
            className="w-full justify-start gap-3 rounded-xl"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Collapse</span>
          </Button>
        )}
      </div>
    </motion.aside>
  );
}


