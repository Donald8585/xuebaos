import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map of lucide icon names → we lazy-load. For Dock we accept rendered elements.
export interface DockApp {
  appId: string;
  name: string;
  icon: React.ReactNode;
  isActive: boolean;
  isMinimized?: boolean;
  badge?: number;
}

interface DockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
}

export function Dock({ apps, onAppClick }: DockProps) {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-end gap-1 px-3 pt-2 pb-1"
      style={{
        backgroundColor: 'var(--xb-surface)',
        borderTop: '1px solid var(--xb-border)',
        borderRadius: 'var(--xb-radius) var(--xb-radius) 0 0',
        boxShadow: 'var(--xb-shadow)',
      }}
    >
      <AnimatePresence>
        {apps.map((app) => (
          <motion.button
            key={app.appId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            whileHover={{ y: -6, scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onAppClick(app.appId)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition-colors w-16',
              app.isActive
                ? 'bg-indigo-500/10'
                : 'hover:bg-slate-700/30'
            )}
            style={{ minWidth: 64 }}
          >
            {/* Icon */}
            <div className={cn(
              'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
              app.isActive ? 'text-indigo-400' : 'text-slate-400'
            )}>
              {app.icon}
            </div>

            {/* Label */}
            <span
              className="text-[10px] font-medium truncate w-full text-center"
              style={{ color: 'var(--xb-text-secondary)' }}
            >
              {app.name}
            </span>

            {/* Active indicator */}
            {app.isActive && (
              <motion.div
                layoutId="dock-indicator"
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"
              />
            )}

            {/* Badge */}
            {app.badge && app.badge > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{app.badge > 9 ? '9+' : app.badge}</span>
              </div>
            )}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
