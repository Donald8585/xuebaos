import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Highlighter, Square, Triangle, Minus, ArrowRight, Pen, Eraser,
  Upload, Timer, TimerOff, Save, FolderOpen, Trash2, ChevronRight,
  Sparkles, Loader2, Palette, RotateCcw, ChevronDown, Image, FileText,
  Circle, Spline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

type Tool = 'highlight' | 'rect' | 'triangle' | 'line' | 'dotted' | 'arrow' | 'doubleLine' | 'pen' | 'eraser';
type PassNum = 1 | 2 | 3;
type DrawMode = 'pen' | 'highlight';

interface SavedAnnotation {
  id: string;
  name: string;
  date: string;
  imageData: string;
}

interface CanvasStroke {
  tool: Tool;
  color: string;
  brushSize: number;
  points: { x: number; y: number }[];
  text?: string;
}

// ─── Tool constants ──────────────────────────────────────

const PASS1_TOOLS: Tool[] = ['highlight'];
const PASS2_TOOLS: Tool[] = ['rect', 'triangle', 'line', 'dotted', 'arrow', 'doubleLine'];
const PASS3_TOOLS: Tool[] = ['pen', 'eraser'];

const TOOL_ICONS: Record<Tool, typeof Highlighter> = {
  highlight: Highlighter,
  rect: Square,
  triangle: Triangle,
  line: Minus,
  dotted: Minus,
  arrow: ArrowRight,
  doubleLine: Minus,
  pen: Pen,
  eraser: Eraser,
};

const TOOL_LABELS: Record<Tool, string> = {
  highlight: 'Highlighter',
  rect: 'Rectangle',
  triangle: 'Triangle',
  line: 'Line',
  dotted: 'Dotted Line',
  arrow: 'Arrow',
  doubleLine: 'Double Line',
  pen: 'Pen',
  eraser: 'Eraser',
};

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF', '#F97316'];

// ─── Timer Component ─────────────────────────────────────

function SpeedTimer({
  isRunning,
  timeLeft,
  onStart,
  onStop,
}: {
  isRunning: boolean;
  timeLeft: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 300; // 5 min

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
      {isRunning ? (
        <div className={cn(
          'text-2xl font-mono font-bold',
          isUrgent ? 'text-rose-400 animate-pulse' : 'text-indigo-400'
        )}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      ) : (
        <div className="text-2xl font-mono font-bold text-slate-500">
          25:00
        </div>
      )}
      <div className="flex gap-1 ml-auto">
        {!isRunning ? (
          <Button size="sm" onClick={onStart}>
            <Timer size={14} className="mr-1" /> {t('annotation.startTimer')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onStop}>
            <TimerOff size={14} className="mr-1" /> Stop
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Pass Indicator ──────────────────────────────────────

function PassIndicator({ currentPass }: { currentPass: PassNum }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      {([1, 2, 3] as PassNum[]).map((pass) => (
        <div key={pass} className="flex items-center gap-1.5">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            pass === currentPass
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50'
              : pass < currentPass
              ? 'bg-emerald-600/50 text-emerald-300'
              : 'bg-slate-700 text-slate-500'
          )}>
            {pass < currentPass ? '✓' : pass}
          </div>
          <span className={cn(
            'text-xs hidden sm:inline',
            pass === currentPass ? 'text-indigo-300 font-medium' : 'text-slate-500'
          )}>
            {t(`annotation.pass${pass}`)}
          </span>
          {pass < 3 && <ChevronRight size={12} className="text-slate-600" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main AnnotationTool ─────────────────────────────────

export default function AnnotationTool() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPass, setCurrentPass] = useState<PassNum>(1);
  const [selectedTool, setSelectedTool] = useState<Tool>('highlight');
  const [selectedColor, setSelectedColor] = useState('#EF4444');
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [savedAnnotations, setSavedAnnotations] = useState<SavedAnnotation[]>([]);
  const [annotationName, setAnnotationName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'upload' | null>(null);
  const [textContent, setTextContent] = useState('');
  const [hasContent, setHasContent] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMode, setMobileMode] = useState<DrawMode>('pen');

  const availableTools = currentPass === 1 ? PASS1_TOOLS : currentPass === 2 ? PASS2_TOOLS : PASS3_TOOLS;

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Timer logic
  useEffect(() => {
    if (!isTimerRunning) return;
    if (timeLeft <= 0) {
      setIsTimerRunning(false);
      toast.success("Time's up! Great work on the speed annotation.");
      return;
    }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(500, rect.width * 0.75);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [hasContent, textContent]);

  // Render text content on canvas
  useEffect(() => {
    if (!textContent || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '16px Inter, Noto Sans TC, sans-serif';
    const lines = textContent.split('\n');
    let y = 40;
    for (const line of lines) {
      const words = line.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > canvas.width - 80) {
          ctx.fillText(currentLine, 40, y);
          currentLine = word + ' ';
          y += 24;
          if (y > canvas.height - 40) break;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        ctx.fillText(currentLine, 40, y);
        y += 24;
      }
      if (y > canvas.height - 40) break;
    }
  }, [textContent]);

  // Drawing handlers
  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = selectedTool === 'eraser' ? '#1E293B' : selectedColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (selectedTool === 'highlight') {
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = brushSize * 4;
    }
    if (selectedTool === 'dotted') {
      ctx.setLineDash([8, 6]);
    }
    if (selectedTool === 'doubleLine') {
      ctx.lineWidth = brushSize * 3;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (selectedTool === 'rect' || selectedTool === 'triangle') {
      // Will finalize on mouseup
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    if (selectedTool === 'highlight') {
      ctx.globalAlpha = 1;
    }
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    if (textContent) {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '16px Inter, Noto Sans TC, sans-serif';
      const lines = textContent.split('\n');
      let y = 40;
      for (const line of lines) {
        ctx.fillText(line, 40, y);
        y += 24;
        if (y > canvasRef.current!.height - 40) break;
      }
    }
    toast.success('Canvas cleared');
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !annotationName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    const imageData = canvas.toDataURL();
    const newAnnotation: SavedAnnotation = {
      id: Date.now().toString(),
      name: annotationName,
      date: new Date().toISOString(),
      imageData,
    };
    setSavedAnnotations([...savedAnnotations, newAnnotation]);
    setAnnotationName('');
    setShowSaveDialog(false);
    toast.success('Annotation saved!');
  };

  const handleLoad = (annotation: SavedAnnotation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = annotation.imageData;
    setShowLoadDialog(false);
    toast.success('Annotation loaded!');
  };

  const handleExtractToPalace = () => {
    setIsExtracting(true);
    setTimeout(() => {
      setIsExtracting(false);
      toast.success('Concept network extracted to Palace Builder!');
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const container = containerRef.current;
        if (!container) return;
        const maxW = container.getBoundingClientRect().width;
        const ratio = Math.min(maxW / img.width, 500 / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasContent(true);
        toast.success('File loaded!');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Content setup screen
  if (!hasContent) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto py-8">
        <h1 className="text-2xl font-bold text-white mb-2">{t('annotation.title')}</h1>
        <p className="text-slate-400 text-sm mb-8">Upload a document or paste text to begin annotating.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-all group"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload size={40} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
            <h3 className="text-white font-semibold mb-1">{t('annotation.uploadFile')}</h3>
            <p className="text-slate-500 text-sm">PDF or Image</p>
            <Input
              id="file-upload"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </Card>
          <Card
            className="p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-all group"
            onClick={() => setHasContent(true)}
          >
            <FileText size={40} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
            <h3 className="text-white font-semibold mb-1">{t('annotation.pasteText')}</h3>
            <p className="text-slate-500 text-sm">Paste your notes</p>
          </Card>
        </div>
        <div className="mt-4">
          <Textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste your study material here..."
            className="min-h-[200px]"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('annotation.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('annotation.passIndicator', { current: currentPass })}
          </p>
        </div>
        <PassIndicator currentPass={currentPass} />
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pass selector */}
          <div className="flex items-center gap-1 mr-4">
            {([1, 2, 3] as PassNum[]).map((pass) => (
              <Button
                key={pass}
                size="sm"
                variant={pass === currentPass ? 'default' : 'ghost'}
                onClick={() => {
                  setCurrentPass(pass);
                  setSelectedTool(pass === 1 ? 'highlight' : pass === 2 ? 'rect' : 'pen');
                }}
                className="text-xs"
              >
                Pass {pass}
              </Button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Tools */}
          {availableTools.map((tool) => {
            const Icon = TOOL_ICONS[tool];
            return (
              <Button
                key={tool}
                size="sm"
                variant={selectedTool === tool ? 'default' : 'ghost'}
                onClick={() => setSelectedTool(tool)}
                className="text-xs"
                title={t(`annotation.tool${tool.charAt(0).toUpperCase() + tool.slice(1)}` as any)}
              >
                <Icon size={14} className="mr-1" />
                <span className="hidden sm:inline">{t(`annotation.tool${tool.charAt(0).toUpperCase() + tool.slice(1)}` as any)}</span>
              </Button>
            );
          })}

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Color picker */}
          <div className="flex items-center gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  'w-6 h-6 rounded-full transition-all',
                  selectedColor === color && 'ring-2 ring-white ring-offset-1 ring-offset-slate-800 scale-110'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Brush size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Size</span>
            {[2, 4, 6, 8, 12].map((size) => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  brushSize === size ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                )}
              >
                <div className="rounded-full bg-current" style={{ width: size / 2, height: size / 2 }} />
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <Button size="sm" variant="ghost" onClick={clearCanvas}>
              <RotateCcw size={14} className="mr-1" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowSaveDialog(true)}>
              <Save size={14} className="mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowLoadDialog(true)}>
              <FolderOpen size={14} className="mr-1" /> Load
            </Button>
            <Button size="sm" onClick={handleExtractToPalace} disabled={isExtracting}>
              {isExtracting ? (
                <><Loader2 size={14} className="mr-1 animate-spin" /> {t('annotation.extracting')}</>
              ) : (
                <><Sparkles size={14} className="mr-1" /> {t('annotation.extractToPalace')}</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Canvas area */}
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-slate-700/50 cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {isMobile && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-slate-900/90 rounded-xl p-2 border border-slate-700/50">
            <Button
              size="sm"
              variant={mobileMode === 'pen' ? 'default' : 'ghost'}
              onClick={() => setMobileMode('pen')}
            >
              <Pen size={14} /> Pen
            </Button>
            <Button
              size="sm"
              variant={mobileMode === 'highlight' ? 'default' : 'ghost'}
              onClick={() => setMobileMode('highlight')}
            >
              <Highlighter size={14} /> Highlighter
            </Button>
          </div>
        )}
      </div>

      {/* Speed Mode */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">{t('annotation.speedMode')}</p>
              <p className="text-xs text-slate-400">{t('annotation.speedModeDesc')}</p>
            </div>
            <SpeedTimer
              isRunning={isTimerRunning}
              timeLeft={timeLeft}
              onStart={() => setIsTimerRunning(true)}
              onStop={() => setIsTimerRunning(false)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Description cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Pass 1</Badge>
            <span className="text-xs text-slate-400">{t('annotation.pass1')}</span>
          </div>
          <p className="text-xs text-slate-500">{t('annotation.pass1Desc')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="warning">Pass 2</Badge>
            <span className="text-xs text-slate-400">{t('annotation.pass2')}</span>
          </div>
          <p className="text-xs text-slate-500">{t('annotation.pass2Desc')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="success">Pass 3</Badge>
            <span className="text-xs text-slate-400">{t('annotation.pass3')}</span>
          </div>
          <p className="text-xs text-slate-500">{t('annotation.pass3Desc')}</p>
        </Card>
      </div>

      {/* Save Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('annotation.saveAnnotation')}</h3>
              <Input
                value={annotationName}
                onChange={(e) => setAnnotationName(e.target.value)}
                placeholder={t('annotation.annotationName') || ''}
                className="mb-4"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSave}>{t('common.save')}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load Dialog */}
      <AnimatePresence>
        {showLoadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLoadDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('annotation.loadAnnotation')}</h3>
              {savedAnnotations.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">{t('annotation.noAnnotations')}</p>
              ) : (
                <div className="space-y-2">
                  {savedAnnotations.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleLoad(a)}
                      className="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-sm text-white">{a.name}</p>
                      <p className="text-xs text-slate-500">{new Date(a.date).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="ghost" onClick={() => setShowLoadDialog(false)}>
                  {t('common.close')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
