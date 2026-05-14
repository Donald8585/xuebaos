import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  Check,
  X,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LocusView } from '@/components/palace/LocusView';
import { useStudyStore } from '@/stores/studyStore';
import { cn } from '@/lib/utils';

// Mock loci data
const MOCK_LOCI = [
  { id: '1', concept: 'Cell Membrane Structure', description: 'Front door — the gatekeeper controlling molecular entry', mnemonic: 'Club bouncer checking IDs at the phospholipid bilayer', image_url: '' },
  { id: '2', concept: 'Mitochondria Function', description: 'Kitchen — cellular respiration hub', mnemonic: 'Stove cooking ATP meals from glucose ingredients', image_url: '' },
  { id: '3', concept: 'Nucleus Role', description: 'Study room — DNA command center', mnemonic: 'Massive library with protein blueprints for the entire body', image_url: '' },
  { id: '4', concept: 'Endoplasmic Reticulum', description: 'Hallway assembly line for protein transport', mnemonic: 'Conveyor belt system running through the house', image_url: '' },
  { id: '5', concept: 'Golgi Apparatus', description: 'Mail room packaging & shipping proteins', mnemonic: 'Amazon warehouse labeling and dispatching molecular packages', image_url: '' },
  { id: '6', concept: 'Lysosomes', description: 'Trash room for waste disposal', mnemonic: 'Janitor closet breaking down old furniture with enzyme cleaners', image_url: '' },
  { id: '7', concept: 'Ribosomes', description: 'Workshop benches for protein synthesis', mnemonic: 'Tiny 3D printers reading mRNA and printing proteins everywhere', image_url: '' },
  { id: '8', concept: 'Chloroplasts', description: 'Greenhouse for photosynthesis', mnemonic: 'Sunroom with solar panels converting sunlight to sugar, painted green', image_url: '' },
];

export default function PalaceWalkthrough() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    currentLocusIndex,
    totalLoci,
    quizMode,
    sessionCardsReviewed,
    sessionCardsCorrect,
    nextLocus,
    prevLocus,
    setTotalLoci,
    toggleQuizMode,
    recordAnswer,
    resetSession,
  } = useStudyStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [userRecall, setUserRecall] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);

  const loci = MOCK_LOCI;
  const currentLocus = loci[currentLocusIndex];

  useEffect(() => {
    setTotalLoci(loci.length);
    return () => { resetSession(); };
  }, []);

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
    setIsRevealed(false);
    if (currentLocusIndex < loci.length - 1) {
      nextLocus();
    } else {
      setShowResults(true);
    }
  };

  const handleForgot = () => {
    recordAnswer(false);
    setIsRevealed(false);
    if (currentLocusIndex < loci.length - 1) {
      nextLocus();
    } else {
      setShowResults(true);
    }
  };

  if (showResults) {
    const accuracy = sessionCardsReviewed > 0
      ? Math.round((sessionCardsCorrect / sessionCardsReviewed) * 100)
      : 0;

    return (
      <div className={`flex items-center justify-center ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'min-h-[80vh]'}`}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-6">
            {accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('palace.walkthrough.results')}</h2>
          <p className="text-4xl font-extrabold gradient-text mb-2">{accuracy}%</p>
          <p className="text-slate-400 text-sm mb-8">
            {sessionCardsCorrect} / {sessionCardsReviewed} {t('palace.walkthrough.accuracy')}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/palaces')}>
              {t('common.back')}
            </Button>
            <Button onClick={() => { setShowResults(false); resetSession(); }}>
              Retry
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      'space-y-6',
      isFullscreen && 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-auto'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/palaces')}>
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{t('palace.walkthrough.title')}</h1>
            <p className="text-xs text-slate-500">{t('palace.walkthrough.navigateHint')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={quizMode ? 'warning' : 'secondary'}>
            {quizMode ? '🧠 Quiz' : '📖 Study'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{t('palace.walkthrough.locus')} {currentLocusIndex + 1} {t('palace.walkthrough.of')} {loci.length}</span>
          <span>{Math.round(((currentLocusIndex + 1) / loci.length) * 100)}%</span>
        </div>
        <Progress value={((currentLocusIndex + 1) / loci.length) * 100} />
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLocusIndex + (quizMode ? '-quiz' : '-study')}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="space-y-6"
        >
          {/* Image */}
          <Card className="overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-indigo-900/50 to-violet-900/50 flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    {['🏠', '🏫', '🏰', '🎮', '🏗️'][currentLocusIndex % 5]}
                  </div>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl">
                    {currentLocusIndex + 1}
                  </div>
                </div>
              </div>
              <div className="absolute top-3 left-3">
                <Badge>{t('palace.walkthrough.locus')} {currentLocusIndex + 1}</Badge>
              </div>
            </div>
          </Card>

          {/* Concept & Mnemonic */}
          <LocusView
            locus={currentLocus}
            quizMode={quizMode}
          />

          {/* Quiz Controls */}
          {quizMode && (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={handleForgot}
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                <X size={16} className="mr-2" />
                {t('palace.walkthrough.iForgot')}
              </Button>
              <Button onClick={handleRemembered}>
                <Check size={16} className="mr-2" />
                {t('palace.walkthrough.iRemembered')}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {!quizMode && (
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={prevLocus}
            disabled={currentLocusIndex === 0}
          >
            <ArrowLeft size={16} className="mr-2" />Previous
          </Button>

          <Button
            variant="ghost"
            onClick={toggleQuizMode}
          >
            {quizMode ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
            {quizMode ? 'Study Mode' : t('palace.walkthrough.recallMode')}
          </Button>

          {currentLocusIndex < loci.length - 1 ? (
            <Button onClick={nextLocus}>
              Next <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : (
            <Button variant="accent" onClick={() => setShowResults(true)}>
              <Flag size={16} className="mr-2" />
              {t('palace.walkthrough.complete')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
