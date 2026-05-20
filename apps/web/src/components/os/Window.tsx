import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, GripHorizontal } from 'lucide-react';
import { eventBus } from '@/lib/eventBus';
import { cn } from '@/lib/utils';

export interface WindowProps {
  title: string;
  icon?: ReactNode;
  appId: string;
  windowId: string;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  children: ReactNode;
  zIndex?: number;
  isMaximized?: boolean;
  isMinimized?: boolean;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const TITLEBAR_HEIGHT = 36;

export function Window({
  title,
  icon,
  appId,
  windowId,
  defaultPosition = { x: 60, y: 60 },
  defaultSize = { width: 800, height: 560 },
  minSize = { width: MIN_WIDTH, height: MIN_HEIGHT },
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  children,
  zIndex = 1,
  isMaximized = false,
  isMinimized = false,
}: WindowProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });

  // ── Drag ─────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).closest('[data-window]')?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    onFocus?.();
    eventBus.emit('os:window-focused', { appId, windowId });
  }, [appId, windowId, isMaximized, onFocus]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.current.x),
        y: Math.max(0, e.clientY - dragOffset.current.y),
      });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  // ── Resize ───────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = {
      x: e.clientX, y: e.clientY,
      w: size.width, h: size.height,
      px: position.x, py: position.y,
    };
    setResizing(direction);
  }, [size, position, isMaximized]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const { w, h, px, py } = resizeStart.current;

      let newX = px, newY = py, newW = w, newH = h;

      if (resizing.includes('e')) {
        newW = Math.max(minSize.width, w + dx);
      }
      if (resizing.includes('s')) {
        newH = Math.max(minSize.height, h + dy);
      }
      if (resizing.includes('w')) {
        newW = Math.max(minSize.width, w - dx);
        if (newW > minSize.width || dx < 0) newX = px + dx;
      }
      if (resizing.includes('n')) {
        newH = Math.max(minSize.height, h - dy);
        if (newH > minSize.height || dy < 0) newY = py + dy;
      }

      setSize({ width: newW, height: newH });
      setPosition({ x: newX, y: newY });
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing, minSize]);

  // ── Window click for z-ordering ─────────────────────────
  const handleWindowClick = useCallback(() => {
    onFocus?.();
    eventBus.emit('os:window-focused', { appId, windowId });
  }, [appId, windowId, onFocus]);

  const windowStyle: CSSProperties = isMaximized
    ? { left: 0, top: 0, width: '100vw', height: 'calc(100vh - 48px)', zIndex }
    : { left: position.x, top: position.y, width: size.width, height: size.height, zIndex };

  return (
    <AnimatePresence>
      {!isMinimized && (
        <motion.div
          data-window
          data-window-id={windowId}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className={cn(
            'absolute flex flex-col overflow-hidden',
            'border rounded-xl shadow-2xl',
            isMaximized ? 'rounded-none' : ''
          )}
          style={{
            ...windowStyle,
            backgroundColor: 'var(--xb-bg)',
            borderColor: 'var(--xb-border)',
            color: 'var(--xb-fg)',
            fontFamily: 'var(--xb-font)',
            boxShadow: 'var(--xb-shadow)',
          }}
          onClick={handleWindowClick}
        >
          {/* Titlebar */}
          <div
            className="flex items-center gap-2 shrink-0 cursor-default select-none"
            style={{
              height: TITLEBAR_HEIGHT,
              backgroundColor: 'var(--xb-surface)',
              borderBottom: '1px solid var(--xb-border)',
              padding: '0 12px',
            }}
            onMouseDown={handleDragStart}
          >
            {/* Traffic-light controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                className="w-3 h-3 rounded-full transition-colors"
                style={{ backgroundColor: '#F43F5E' }}
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                title="Close"
              />
              <button
                className="w-3 h-3 rounded-full transition-colors"
                style={{ backgroundColor: '#F59E0B' }}
                onClick={(e) => { e.stopPropagation(); onMinimize?.(); }}
                title="Minimize"
              />
              <button
                className="w-3 h-3 rounded-full transition-colors"
                style={{ backgroundColor: '#10B981' }}
                onClick={(e) => { e.stopPropagation(); onMaximize?.(); }}
                title={isMaximized ? 'Restore' : 'Maximize'}
              />
            </div>

            {/* Title */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              {icon && <span className="shrink-0">{icon}</span>}
              <span
                className="text-xs font-medium truncate"
                style={{ color: 'var(--xb-text-secondary)' }}
              >
                {title}
              </span>
            </div>

            {/* Right spacer to balance traffic lights */}
            <div className="w-[52px] shrink-0" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
            {children}
          </div>

          {/* Resize handles (hidden when maximized) */}
          {!isMaximized && (
            <>
              {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((dir) => (
                <div
                  key={dir}
                  className="absolute"
                  style={{
                    ...resizeHandleStyle(dir),
                    cursor: `${dir}-resize`,
                  }}
                  onMouseDown={(e) => handleResizeStart(e, dir)}
                />
              ))}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function resizeHandleStyle(dir: string): CSSProperties {
  const SIZE = 6;
  const OFFSET = -3;
  const base: CSSProperties = {
    position: 'absolute',
    zIndex: 10,
  };

  if (dir === 'nw') return { ...base, top: OFFSET, left: OFFSET, width: SIZE * 2, height: SIZE * 2 };
  if (dir === 'ne') return { ...base, top: OFFSET, right: OFFSET, width: SIZE * 2, height: SIZE * 2 };
  if (dir === 'sw') return { ...base, bottom: OFFSET, left: OFFSET, width: SIZE * 2, height: SIZE * 2 };
  if (dir === 'se') return { ...base, bottom: OFFSET, right: OFFSET, width: SIZE * 2, height: SIZE * 2 };
  if (dir === 'n') return { ...base, top: OFFSET, left: SIZE, right: SIZE, height: SIZE };
  if (dir === 's') return { ...base, bottom: OFFSET, left: SIZE, right: SIZE, height: SIZE };
  if (dir === 'e') return { ...base, right: OFFSET, top: SIZE, bottom: SIZE, width: SIZE };
  if (dir === 'w') return { ...base, left: OFFSET, top: SIZE, bottom: SIZE, width: SIZE };
  return base;
}
