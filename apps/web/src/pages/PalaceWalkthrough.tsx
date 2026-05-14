import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Maximize, Minimize,
  Eye, EyeOff, Check, X, Flag, Loader2,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LocusView } from '@/components/palace/LocusView';
import { useStudyStore } from '@/stores/studyStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Locus {
  concept: string;
  description: string;
  mnemonic: string;
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

  useEffect(() => {
    const fetchPalace = async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`/api/palaces/${id}`, {
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
          <Badge variant={quizMode ? 'warning' : 'secondary'}>{quizMode ? '🧠 Quiz' : '📖 Study'}</Badge>
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
        </motion.div>
      </AnimatePresence>

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
      {quizMode && (
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleForgot} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
            <X size={16} className="mr-2" />Forgot
          </Button>
          <Button onClick={handleRemembered}>
            <Check size={16} className="mr-2" />Remembered
          </Button>
        </div>
      )}
    </div>
  );
}
