import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Maximize, Minimize,
  Eye, EyeOff, Check, X, Flag, Loader2, Save,
  Play, Square, Timer, Footprints,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LocusView } from '@/components/palace/LocusView';
import { useStudyStore } from '@/stores/studyStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Locus {
  concept: string;
  description: string;
  mnemonic: string;
}

interface SpatialEntry {
  locusIndex: number;
  x: number;
  y: number;
  z?: number;
  roomId?: string;
  rotation?: number;
}

interface Palace {
  id: string;
  name: string;
  title: string;
  description: string;
  loci: Locus[];
  lociCount: number;
  loci_count: number;
  subject: string;
  isPublic: boolean;
  spatialMap?: SpatialEntry[];
}

export default function PalaceWalkthrough() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const {
    currentLocusIndex, nextLocus, prevLocus, setTotalLoci,
    toggleQuizMode, quizMode, recordAnswer, resetSession,
    sessionCardsReviewed, sessionCardsCorrect,
  } = useStudyStore();

  const [palace, setPalace] = useState<Palace | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'spatial'>('list');
  const [spatialMap, setSpatialMap] = useState<SpatialEntry[]>([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchPalace = async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${API_BASE}/palaces/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // Parse loci if stored as JSON string
        const rawLoci = data.loci || [];
        const loci: Locus[] = typeof rawLoci === 'string'
          ? JSON.parse(rawLoci)
          : rawLoci;
        setPalace({ ...data, loci });
        setTotalLoci(loci.length);
        // Load existing spatial map or initialize grid layout
        const existingMap = data.spatialMap || [];
        setSpatialMap(existingMap.length > 0 ? existingMap : loci.map((_: any, i: number) => ({
          locusIndex: i,
          x: 10 + (i % 4) * 95,
          y: 10 + Math.floor(i / 4) * 95,
        })));
      } catch (err) {
        toast.error('Failed to load palace');
        navigate('/palaces');
      } finally {
        setLoading(false);
      }
    };
    fetchPalace();
    return () => resetSession();
  }, [id]);

  const loci = palace?.loci || [];
  const currentLocus = loci[currentLocusIndex];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextLocus();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevLocus();
    if (e.key === 'q') toggleQuizMode();
    if (e.key === 'f') setIsFullscreen((f) => !f);
  }, [nextLocus, prevLocus, toggleQuizMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleRemembered = () => {
    recordAnswer(true);
    if (currentLocusIndex < loci.length - 1) nextLocus();
    else setShowResults(true);
  };
  const handleForgot = () => {
    recordAnswer(false);
    if (currentLocusIndex < loci.length - 1) nextLocus();
    else setShowResults(true);
  };

  // ── Spatial map autosave (debounced 800ms) ────────────────
  const saveLayout = useCallback(async (layout: SpatialEntry[]) => {
    if (!id || !getToken) return;
    try {
      setIsSavingLayout(true);
      const token = await getToken();
      await fetch(`${API_BASE}/palaces/${id}/spatial-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ layout }),
      });
    } catch (err) {
      console.error('[spatial-map.save]', err);
    } finally {
      setIsSavingLayout(false);
    }
  }, [id, getToken]);

  const updateLocusPosition = useCallback((locusIndex: number, x: number, y: number) => {
    setSpatialMap(prev => {
      const next = prev.map(e => e.locusIndex === locusIndex ? { ...e, x, y } : e);
      // Debounced autosave
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveLayout(next), 800);
      return next;
    });
  }, [saveLayout]);

  // ── M1.3: Walk Mode — recording walkthrough ────────────────
  const [walkMode, setWalkMode] = useState(false);
  const [walkId, setWalkId] = useState<string | null>(null);
  const [walkTimer, setWalkTimer] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [walkEvents, setWalkEvents] = useState<Array<{ locusIndex: number; action: string; ts: number }>>([]);
  const [walkScore, setWalkScore] = useState<number | null>(null);
  const walkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkStartRef = useRef<number>(0);

  const startWalk = useCallback(async () => {
    if (!id || !getToken) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/walkthroughs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ palaceId: id }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setWalkId(data.id);
      setIsWalking(true);
      setWalkEvents([]);
      setWalkScore(null);
      walkStartRef.current = Date.now();
      walkTimerRef.current = setInterval(() => setWalkTimer(Date.now() - walkStartRef.current), 100);
    } catch (err) { toast.error('Failed to start walkthrough'); }
  }, [id, getToken]);

  const recordWalkEvent = useCallback(async (locusIndex: number, action: string) => {
    if (!walkId || !getToken) return;
    const ts = Date.now() - walkStartRef.current;
    const event = { locusIndex, action, ts };
    setWalkEvents(prev => [...prev, event]);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/walkthroughs/${walkId}/event`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(event),
      });
    } catch (err) { console.error('[walk.event]', err); }
  }, [walkId, getToken]);

  const finishWalk = useCallback(async () => {
    if (!walkId || !getToken) return;
    if (walkTimerRef.current) clearInterval(walkTimerRef.current);
    setIsWalking(false);
    const durationMs = Date.now() - walkStartRef.current;
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/walkthroughs/${walkId}/finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ durationMs, transcript: walkEvents }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setWalkScore(data.recallScore);
      toast.success(`Walk complete! Score: ${data.recallScore}%`);
    } catch (err) { toast.error('Failed to finish walkthrough'); }
  }, [walkId, getToken, walkEvents]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (walkTimerRef.current) clearInterval(walkTimerRef.current); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!palace || loci.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-slate-400 mb-4">No loci found in this palace.</p>
        <Button onClick={() => navigate('/palaces/build')}>Build a Palace</Button>
      </div>
    );
  }

  if (showResults) {
    const accuracy = sessionCardsReviewed > 0
      ? Math.round((sessionCardsCorrect / sessionCardsReviewed) * 100) : 0;
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md">
          <div className="text-6xl mb-6">{accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}</div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('palace.walkthrough.results')}</h2>
          <p className="text-4xl font-extrabold gradient-text mb-2">{accuracy}%</p>
          <p className="text-slate-400 text-sm mb-8">{sessionCardsCorrect} / {sessionCardsReviewed} correct</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/palaces')}>{t('common.back')}</Button>
            <Button onClick={() => { setShowResults(false); resetSession(); }}>Retry</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', isFullscreen && 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-auto')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/palaces')}>
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{palace.name || palace.title}</h1>
            <p className="text-xs text-slate-500">{t('palace.walkthrough.navigateHint')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={walkMode ? 'accent' : quizMode ? 'warning' : 'secondary'}>
            {walkMode ? '🚶 Walk' : quizMode ? '🧠 Quiz' : '📖 Study'}
          </Badge>
          {!walkMode && !isWalking && (
            <Button variant="ghost" size="sm" onClick={() => { setWalkMode(true); startWalk(); }}>
              <Footprints size={14} className="mr-1" /> Walk
            </Button>
          )}
          {isWalking && (
            <div className="flex items-center gap-2 text-xs">
              <Timer size={14} className="text-emerald-400" />
              <span className="text-emerald-400 font-mono">{(walkTimer / 1000).toFixed(1)}s</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Locus {currentLocusIndex + 1} of {loci.length}</span>
          <span>{Math.round(((currentLocusIndex + 1) / loci.length) * 100)}%</span>
        </div>
        <Progress value={((currentLocusIndex + 1) / loci.length) * 100} />
        {/* View Mode Toggle */}
        <div className="flex justify-end">
          <div className="flex rounded-lg bg-slate-800 p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded text-xs ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>📋 List</button>
            <button onClick={() => setViewMode('spatial')} className={`px-3 py-1 rounded text-xs ${viewMode === 'spatial' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>🗺️ Spatial Map (Beta)</button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentLocusIndex + (quizMode ? '-quiz' : '-study')}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="space-y-6"
        >
          <Card className="overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-indigo-900/50 to-violet-900/50 flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">{['🏠','🏫','🏰','🎮','🏗️'][currentLocusIndex % 5]}</div>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl">
                    {currentLocusIndex + 1}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <LocusView locus={currentLocus} quizMode={quizMode} />

          {/* Feature 3 Stub: Symbolic Object */}
          {!quizMode && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔮</span>
                  <div className="flex-1">
                    <p className="text-sm text-amber-300 font-medium">AI Symbolic Object</p>
                    <p className="text-xs text-slate-400 mt-0.5">AI-generated visual icons for each locus — coming next week</p>
                  </div>
                  <Badge variant="warning" className="shrink-0">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* M1.1: Real Spatial Map — drag-to-arrange with autosave */}
      {viewMode === 'spatial' && (
        <Card className="mt-4 bg-slate-800/30 border-slate-700/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-slate-300">🗺️ Spatial Memory Palace</p>
              <div className="flex items-center gap-2">
                {isSavingLayout && <span className="text-xs text-slate-500">Saving...</span>}
                <Badge variant="secondary">Drag to arrange</Badge>
              </div>
            </div>
            <div
              className="aspect-[4/3] rounded-xl bg-slate-900/50 border border-slate-700/30 relative overflow-hidden"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const dragging = spatialMap.find(entry => {
                  const ex = (entry.x / 400) * rect.width;
                  const ey = (entry.y / 300) * rect.height;
                  return Math.abs(e.clientX - rect.left - ex) < 30 && Math.abs(e.clientY - rect.top - ey) < 30;
                });
                if (!dragging) return;
                const onMove = (me: MouseEvent) => {
                  const nx = ((me.clientX - rect.left) / rect.width) * 400;
                  const ny = ((me.clientY - rect.top) / rect.height) * 300;
                  updateLocusPosition(dragging.locusIndex, Math.max(0, Math.min(380, nx)), Math.max(0, Math.min(280, ny)));
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              {/* Grid */}
              <svg viewBox="0 0 400 300" className="w-full h-full">
                {Array.from({ length: 10 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 30} x2={400} y2={i * 30} stroke="#1F2937" strokeWidth="1" />
                ))}
                {Array.from({ length: 14 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={300} stroke="#1F2937" strokeWidth="1" />
                ))}
                {/* Loci pins */}
                {spatialMap.map((entry) => {
                  const locus = loci[entry.locusIndex];
                  if (!locus) return null;
                  return (
                    <g key={entry.locusIndex}>
                      <circle cx={entry.x} cy={entry.y} r={14} fill={entry.locusIndex === currentLocusIndex ? '#4F46E5' : '#6366F1'} opacity="0.9" stroke="#fff" strokeWidth="1.5" className="cursor-pointer" />
                      <text x={entry.x} y={entry.y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{entry.locusIndex + 1}</text>
                      <text x={entry.x} y={entry.y + 24} textAnchor="middle" fill="#94A3B8" fontSize="7">{locus.concept?.slice(0, 14)}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 right-2 text-[10px] text-slate-600">
                Click &amp; drag loci to arrange • Autosaves
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={prevLocus} disabled={currentLocusIndex === 0}>
          <ArrowLeft size={16} className="mr-2" />Previous
        </Button>
        <Button variant="ghost" onClick={toggleQuizMode}>
          {quizMode ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
          {quizMode ? 'Study Mode' : 'Quiz Mode'}
        </Button>
        {currentLocusIndex < loci.length - 1 ? (
          <Button onClick={nextLocus}>Next <ArrowRight size={16} className="ml-2" /></Button>
        ) : (
          <Button variant="accent" onClick={() => setShowResults(true)}>
            <Flag size={16} className="mr-2" />Finish
          </Button>
        )}
      </div>
      {quizMode && !walkMode && (
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleForgot} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
            <X size={16} className="mr-2" />Forgot
          </Button>
          <Button onClick={handleRemembered}>
            <Check size={16} className="mr-2" />Remembered
          </Button>
        </div>
      )}

      {/* M1.3: Walk mode controls */}
      {isWalking && (
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => recordWalkEvent(currentLocusIndex, 'forgot')} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
            <X size={16} className="mr-2" />Forgot
          </Button>
          <Button variant="outline" onClick={() => recordWalkEvent(currentLocusIndex, 'visited')}>
            <Eye size={16} className="mr-2" />Visited
          </Button>
          <Button onClick={() => { recordWalkEvent(currentLocusIndex, 'recalled'); if (currentLocusIndex < loci.length - 1) nextLocus(); else finishWalk(); }}>
            <Check size={16} className="mr-2" />Recalled
          </Button>
        </div>
      )}

      {walkScore !== null && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-lg font-bold text-emerald-400">Walk Score: {walkScore}%</p>
          <p className="text-xs text-slate-400 mt-1">{walkEvents.filter(e => e.action === 'recalled').length} recalled / {walkEvents.length} events</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setWalkMode(false); setWalkScore(null); }}>Back to Study</Button>
        </motion.div>
      )}
    </div>
  );
}
