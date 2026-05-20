import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, HelpCircle, Sparkles, Target } from 'lucide-react';
import { Window } from '@/components/os/Window';
import { Dock, type DockApp } from '@/components/os/Dock';
import { eventBus } from '@/lib/eventBus';
import { getApp } from '@/lib/appRegistry';
import { cn } from '@/lib/utils';

// Lazy-load app content — for now, placeholder
function MemoryPalaceApp() {
  return (
    <div className="p-6 h-full" style={{ backgroundColor: 'var(--xb-bg)' }}>
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Building2 size={48} style={{ color: 'var(--xb-accent)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--xb-fg)' }}>Memory Palace</h2>
        <p style={{ color: 'var(--xb-text-secondary)' }}>
          Build palaces from your study materials or upload lecture videos.
        </p>
        <p className="text-xs" style={{ color: 'var(--xb-text-secondary)' }}>
          Launch from <code style={{ fontFamily: 'var(--xb-mono)', backgroundColor: 'var(--xb-surface)', padding: '2px 6px', borderRadius: 4 }}>/palaces</code> for full experience
        </p>
      </div>
    </div>
  );
}

function QBankApp() {
  return (
    <div className="p-6 h-full" style={{ backgroundColor: 'var(--xb-bg)' }}>
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <HelpCircle size={48} style={{ color: 'var(--xb-accent)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--xb-fg)' }}>Question Bank</h2>
        <p style={{ color: 'var(--xb-text-secondary)' }}>FSRS-powered active recall questions.</p>
      </div>
    </div>
  );
}

interface WindowState {
  windowId: string;
  appId: string;
  title: string;
  icon: React.ReactNode;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

const iconMap: Record<string, React.ReactNode> = {
  'memory-palace': <Building2 size={16} />,
  'qbank': <HelpCircle size={16} />,
  'recall-arena': <Target size={16} />,
  'symbol-forge': <Sparkles size={16} />,
};

let nextZIndex = 1;

export default function Desktop() {
  const navigate = useNavigate();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark');

  // Apply theme class to root
  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  // ── Open a window ─────────────────────────────────────────
  const openWindow = useCallback((appId: string) => {
    const manifest = getApp(appId);
    if (!manifest) return;

    // If already open, un-minimize and focus
    const existing = windows.find(w => w.appId === appId);
    if (existing) {
      setWindows(prev => prev.map(w =>
        w.appId === appId ? { ...w, isMinimized: false, zIndex: ++nextZIndex } : w
      ));
      eventBus.emit('os:window-focused', { appId, windowId: existing.windowId });
      return;
    }

    const winSize = manifest.defaultWindow || { width: 800, height: 560 };
    const offset = windows.length * 24;
    const newWindow: WindowState = {
      windowId: `win-${appId}-${Date.now()}`,
      appId,
      title: manifest.name,
      icon: iconMap[appId] || null,
      zIndex: ++nextZIndex,
      isMinimized: false,
      isMaximized: false,
      position: { x: 80 + offset, y: 60 + offset },
      size: { width: winSize.width, height: winSize.height },
    };

    setWindows(prev => [...prev, newWindow]);
    eventBus.emit('os:window-opened', { appId, windowId: newWindow.windowId });
  }, [windows]);

  // ── Close window ──────────────────────────────────────────
  const closeWindow = useCallback((windowId: string) => {
    setWindows(prev => {
      const win = prev.find(w => w.windowId === windowId);
      if (win) {
        eventBus.emit('os:window-closed', { appId: win.appId, windowId });
      }
      return prev.filter(w => w.windowId !== windowId);
    });
  }, []);

  // ── Minimize / Maximize ───────────────────────────────────
  const minimizeWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.windowId === windowId ? { ...w, isMinimized: true } : w
    ));
  }, []);

  const toggleMaximize = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.windowId === windowId ? { ...w, isMaximized: !w.isMaximized } : w
    ));
  }, []);

  const focusWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.windowId === windowId ? { ...w, zIndex: ++nextZIndex } : w
    ));
  }, []);

  // ── Dock click → toggle minimize/restore ─────────────────
  const handleDockClick = useCallback((appId: string) => {
    const existing = windows.find(w => w.appId === appId);
    if (existing && !existing.isMinimized) {
      minimizeWindow(existing.windowId);
    } else {
      openWindow(appId);
    }
  }, [windows, openWindow, minimizeWindow]);

  // ── Render app content ────────────────────────────────────
  const renderAppContent = (appId: string) => {
    switch (appId) {
      case 'memory-palace': return <MemoryPalaceApp />;
      case 'qbank': return <QBankApp />;
      case 'recall-arena': return (
        <div className="p-6 h-full flex items-center justify-center" style={{ backgroundColor: 'var(--xb-bg)' }}>
          <p style={{ color: 'var(--xb-text-secondary)' }}>Recall Arena — launch from sidebar</p>
        </div>
      );
      case 'symbol-forge': return (
        <div className="p-6 h-full flex items-center justify-center" style={{ backgroundColor: 'var(--xb-bg)' }}>
          <p style={{ color: 'var(--xb-text-secondary)' }}>Symbol Forge — launch from sidebar</p>
        </div>
      );
      default: return (
        <div className="p-6 h-full flex items-center justify-center" style={{ backgroundColor: 'var(--xb-bg)' }}>
          <p style={{ color: 'var(--xb-text-secondary)' }}>App: {appId}</p>
        </div>
      );
    }
  };

  // ── Build dock apps ───────────────────────────────────────
  const dockApps: DockApp[] = [
    { appId: 'memory-palace', name: 'Palaces', icon: <Building2 size={20} />, isActive: windows.some(w => w.appId === 'memory-palace'), isMinimized: windows.some(w => w.appId === 'memory-palace' && w.isMinimized) },
    { appId: 'qbank', name: 'QBank', icon: <HelpCircle size={20} />, isActive: windows.some(w => w.appId === 'qbank'), isMinimized: windows.some(w => w.appId === 'qbank' && w.isMinimized) },
    { appId: 'recall-arena', name: 'Recall', icon: <Target size={20} />, isActive: windows.some(w => w.appId === 'recall-arena'), isMinimized: windows.some(w => w.appId === 'recall-arena' && w.isMinimized) },
    { appId: 'symbol-forge', name: 'Symbols', icon: <Sparkles size={20} />, isActive: windows.some(w => w.appId === 'symbol-forge'), isMinimized: windows.some(w => w.appId === 'symbol-forge' && w.isMinimized) },
  ];

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundColor: 'var(--xb-bg)',
        fontFamily: 'var(--xb-font)',
      }}
    >
      {/* Desktop background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--xb-accent) 0%, transparent 50%)',
          opacity: 0.03,
        }}
      />

      {/* Windows */}
      {windows.map(win => (
        <Window
          key={win.windowId}
          title={win.title}
          icon={win.icon}
          appId={win.appId}
          windowId={win.windowId}
          defaultPosition={win.position}
          defaultSize={win.size}
          zIndex={win.zIndex}
          isMaximized={win.isMaximized}
          isMinimized={win.isMinimized}
          onClose={() => closeWindow(win.windowId)}
          onMinimize={() => minimizeWindow(win.windowId)}
          onMaximize={() => toggleMaximize(win.windowId)}
          onFocus={() => focusWindow(win.windowId)}
        >
          {renderAppContent(win.appId)}
        </Window>
      ))}

      {/* Right-click context menu (stub) */}
      {/* TODO: proper desktop context menu with "New Window", "Change Theme", etc. */}

      {/* Dock */}
      <Dock apps={dockApps} onAppClick={handleDockClick} />

      {/* Top bar with theme toggle + nav */}
      <div
        className="fixed top-0 right-0 z-40 flex items-center gap-2 px-3 py-1.5"
        style={{
          backgroundColor: 'var(--xb-surface)',
          borderBottom: '1px solid var(--xb-border)',
          borderLeft: '1px solid var(--xb-border)',
          borderRadius: '0 0 0 var(--xb-radius)',
          boxShadow: 'var(--xb-shadow)',
        }}
      >
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'sepia' : 'dark')}
          className="text-xs px-2 py-1 rounded"
          style={{ color: 'var(--xb-text-secondary)', backgroundColor: 'var(--xb-bg)', border: '1px solid var(--xb-border)' }}
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '📜'}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs px-2 py-1 rounded"
          style={{ color: 'var(--xb-text-secondary)', backgroundColor: 'var(--xb-bg)', border: '1px solid var(--xb-border)' }}
        >
          ← Dashboard
        </button>
      </div>
    </div>
  );
}
