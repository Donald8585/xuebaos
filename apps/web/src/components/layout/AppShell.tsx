import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { TooltipProvider } from '@/components/ui/tooltip';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed, toggleSidebar, sidebarOpen } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-950">
        <Topbar />
        <Sidebar />
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={toggleSidebar}
          />
        )}
        <main
          className={cn(
            'pt-16 transition-all duration-300',
            isMobile ? 'pb-20 px-4' : sidebarCollapsed ? 'ml-[72px] px-6' : 'ml-[260px] px-6'
          )}
        >
          <div className="max-w-7xl mx-auto py-8">
            {children}
          </div>
        </main>
        {isMobile && <MobileNav />}
      </div>
    </TooltipProvider>
  );
}
