import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Loader2, Filter, Timer, Zap, AlertCircle, Bookmark,
  Brain, ChevronDown, ChevronUp, BarChart3, ListChecks, X,
  Target, Layers, Lightbulb, ArrowRight, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { QuestionCard } from '@/components/qbank/QuestionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Question } from '@/hooks/useApi';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

type DifficultyMode = 'standard' | 'deep-wide' | 'novelty';
type Curriculum = 'DSE' | 'IB' | 'A-Level' | 'SAT' | 'AP' | 'Gaokao';
type SubjectPreset = 'math' | 'chemistry' | 'physics' | 'chinese' | 'english' | 'biology' | null;

interface MistakeEntry {
  question: Question;
  userAnswer: string;
  timestamp: string;
}

// ─── Constants ───────────────────────────────────────────

const CURRICULUMS: { value: Curriculum; label: string }[] = [
  { value: 'DSE', label: 'DSE (Hong Kong)' },
  { value: 'IB', label: 'IB' },
  { value: 'A-Level', label: 'A-Level' },
  { value: 'SAT', label: 'SAT' },
  { value: 'AP', label: 'AP' },
  { value: 'Gaokao', label: '高考 Gaokao' },
];

const SUBJECT_PRESETS: Record<string, { label: string; description: string; topics: string }> = {
  math: { label: 'Mathematics', description: 'Deep-wide novel-approach problems', topics: 'Algebra, Calculus, Statistics, Geometry, Trigonometry' },
  chemistry: { label: 'Chemistry', description: 'Topic-by-topic drills', topics: 'Organic Chem, Inorganic Chem, Physical Chem, Analytical Chem' },
  physics: { label: 'Physics', description: 'Past-paper exercises per topic', topics: 'Mechanics, E&M, Waves, Thermodynamics, Modern Physics' },
  chinese: { label: 'Chinese', description: '文言文 + modern passages', topics: '文言文, Modern Prose, Poetry, Composition' },
  english: { label: 'English', description: 'Grammar + vocab in context', topics: 'Grammar, Vocabulary, Reading, Writing, Listening' },
  biology: { label: 'Biology', description: '3-pass annotation + recall drills', topics: 'Cell Biology, Genetics, Ecology, Physiology, Evolution' },
};

const MOCK_QUESTIONS: Question[] = [
  {
    id: '1', topic: 'Cell Biology', difficulty: 'easy',
    question_text: 'What is the primary function of mitochondria in a cell?',
    answer_text: 'Mitochondria are the powerhouses of the cell, responsible for producing ATP through cellular respiration.',
    explanation: 'Mitochondria convert glucose and oxygen into ATP (adenosine triphosphate), the energy currency of the cell, through the process of oxidative phosphorylation.',
    tags: ['biology', 'cells'], attempts: 0, correct_count: 0,
  },
  {
    id: '2', topic: 'Cell Biology', difficulty: 'medium',
    question_text: 'Compare and contrast the functions of smooth ER and rough ER.',
    answer_text: 'Rough ER has ribosomes and synthesizes proteins for secretion. Smooth ER lacks ribosomes and synthesizes lipids, metabolizes carbohydrates, and detoxifies drugs.',
    explanation: 'The presence of ribosomes on rough ER gives it a "rough" appearance and enables protein synthesis. Smooth ER is involved in lipid synthesis and detoxification.',
    tags: ['biology', 'cells'], attempts: 0, correct_count: 0,
  },
  {
    id: '3', topic: 'Cell Biology', difficulty: 'hard',
    question_text: 'Explain how the endomembrane system works together to synthesize and transport a protein from its gene to secretion outside the cell.',
    answer_text: 'DNA in nucleus → mRNA transcription → mRNA exits nucleus → ribosomes on rough ER translate → protein enters ER lumen → transport vesicle to Golgi → Golgi modifies and packages → secretory vesicle → exocytosis at plasma membrane.',
    explanation: 'This coordinated pathway involves the nucleus, rough ER, transport vesicles, Golgi apparatus, and plasma membrane working sequentially.',
    tags: ['biology', 'cells'], attempts: 0, correct_count: 0,
  },
  {
    id: '4', topic: 'Cell Biology', difficulty: 'easy',
    question_text: 'What structure controls the passage of substances into and out of the cell?',
    answer_text: 'The cell membrane (plasma membrane), composed of a phospholipid bilayer with embedded proteins.',
    explanation: 'The phospholipid bilayer is selectively permeable. Small nonpolar molecules pass freely, while larger or charged molecules require protein channels or carriers.',
    tags: ['biology', 'cells'], attempts: 0, correct_count: 0,
  },
  {
    id: '5', topic: 'Genetics', difficulty: 'medium',
    question_text: 'In a dihybrid cross between two heterozygous pea plants (RrYy × RrYy), what is the expected phenotypic ratio?',
    answer_text: '9:3:3:1 (9 round yellow : 3 round green : 3 wrinkled yellow : 1 wrinkled green)',
    explanation: 'This is Mendel\'s classic dihybrid cross. Each trait follows independent assortment, resulting in 16 possible combinations with the 9:3:3:1 phenotypic ratio.',
    tags: ['biology', 'genetics'], attempts: 0, correct_count: 0,
  },
];

// ─── Coverage Radar Chart (simple SVG) ───────────────────

function CoverageRadar({ topics }: { topics: string[] }) {
  const values = topics.map((_, i) => 40 + Math.random() * 60);
  const cx = 100, cy = 100, r = 70;
  const angles = topics.map((_, i) => (i * 2 * Math.PI) / topics.length - Math.PI / 2);
  const points = angles.map((a, i) => ({
    x: cx + r * (values[i] / 100) * Math.cos(a),
    y: cy + r * (values[i] / 100) * Math.sin(a),
  }));
  const gridPoints = angles.map((a) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
    lx: cx + r * 1.1 * Math.cos(a),
    ly: cy + r * 1.1 * Math.sin(a),
  }));

  const dataPointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const gridStr = gridPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={gridPoints.map((p) => `${cx + (p.x - cx) * scale},${cy + (p.y - cy) * scale}`).join(' ')}
          fill="none"
          stroke="#1E293B"
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {gridPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1E293B" strokeWidth="1" />
      ))}
      {/* Data */}
      <polygon points={dataPointsStr} fill="rgba(79, 70, 229, 0.2)" stroke="#4F46E5" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#818CF8" />
      ))}
      {/* Labels */}
      {gridPoints.map((p, i) => (
        <text
          key={i}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#94A3B8"
          fontSize="8"
        >
          {topics[i].slice(0, 6)}
        </text>
      ))}
    </svg>
  );
}

// ─── Speed Drill Timer ───────────────────────────────────

function SpeedDrillTimer({
  current,
  total,
  timeLeft,
  isRunning,
}: {
  current: number;
  total: number;
  timeLeft: number;
  isRunning: boolean;
}) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 30;

  return (
    <div className="flex items-center gap-4 p-2 rounded-xl bg-slate-800/60">
      <Badge variant="warning" className="text-xs">
        <Zap size={12} className="mr-1" /> Speed Drill
      </Badge>
      <span className="text-sm text-slate-400">
        {current}/{total}
      </span>
      <span className={cn(
        'text-lg font-mono font-bold',
        isUrgent ? 'text-rose-400 animate-pulse' : 'text-indigo-400'
      )}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// ─── Main QBankPage ──────────────────────────────────────

export default function QBankPage() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);

  // New feature states
  const [curriculum, setCurriculum] = useState<Curriculum>('DSE');
  const [mode, setMode] = useState<DifficultyMode>('standard');
  const [selectedPreset, setSelectedPreset] = useState<SubjectPreset>(null);

  // Speed drill
  const [isSpeedDrill, setIsSpeedDrill] = useState(false);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillTimeLeft, setDrillTimeLeft] = useState(60); // 60s per question
  const [isDrillRunning, setIsDrillRunning] = useState(false);
  const [drillResults, setDrillResults] = useState<{ correct: boolean }[]>([]);
  const [drillComplete, setDrillComplete] = useState(false);

  // Mistake log
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState('browse');

  // Speed drill timer
  useEffect(() => {
    if (!isDrillRunning || !isSpeedDrill) return;
    if (drillTimeLeft <= 0) {
      // Time's up, move to next
      setDrillResults([...drillResults, { correct: false }]);
      if (drillIndex + 1 < questions.length) {
        setDrillIndex(drillIndex + 1);
        setDrillTimeLeft(60);
      } else {
        setIsDrillRunning(false);
        setDrillComplete(true);
      }
      return;
    }
    const interval = setInterval(() => setDrillTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [isDrillRunning, drillTimeLeft, isSpeedDrill, drillIndex]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newQ: Question = {
        id: Date.now().toString(),
        topic: topic || selectedPreset || 'General',
        difficulty: mode === 'deep-wide' ? 'hard' : mode === 'novelty' ? 'medium' : (difficulty as Question['difficulty']) || 'medium',
        question_text: 'What is the role of lysosomes in cellular digestion?',
        answer_text: 'Lysosomes contain hydrolytic enzymes that break down waste materials, cellular debris, and foreign particles through autophagy and phagocytosis.',
        explanation: 'Lysosomes maintain an acidic pH (~5) optimal for their enzymes. They fuse with endosomes, phagosomes, or autophagosomes to digest contents.',
        tags: ['biology', 'cells'],
        attempts: 0,
        correct_count: 0,
      };

      const newQuestions = [...questions, newQ];
      setQuestions(newQuestions);
      setIsGenerating(false);
      toast.success('Questions generated!');
    }, 2000);
  };

  const handlePresetSelect = (preset: SubjectPreset) => {
    setSelectedPreset(preset);
    if (preset) {
      const presetData = SUBJECT_PRESETS[preset];
      setTopic(presetData.description);
    }
  };

  const startSpeedDrill = () => {
    setIsSpeedDrill(true);
    setDrillIndex(0);
    setDrillTimeLeft(60);
    setIsDrillRunning(true);
    setDrillResults([]);
    setDrillComplete(false);
    toast.success('Speed drill started!');
  };

  const handleDrillCorrect = () => {
    const entry: MistakeEntry = {
      question: questions[drillIndex],
      userAnswer: 'Correct',
      timestamp: new Date().toISOString(),
    };
    setDrillResults([...drillResults, { correct: true }]);
    nextDrillQuestion();
  };

  const handleDrillIncorrect = () => {
    const entry: MistakeEntry = {
      question: questions[drillIndex],
      userAnswer: 'Skipped/Incorrect',
      timestamp: new Date().toISOString(),
    };
    setMistakes([entry, ...mistakes]);
    setDrillResults([...drillResults, { correct: false }]);
    nextDrillQuestion();
  };

  const nextDrillQuestion = () => {
    if (drillIndex + 1 < questions.length) {
      setDrillIndex(drillIndex + 1);
      setDrillTimeLeft(60);
    } else {
      setIsDrillRunning(false);
      setDrillComplete(true);
    }
  };

  const filtered = questions.filter((q) => {
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    if (topic && !q.topic.toLowerCase().includes(topic.toLowerCase())) return false;
    return true;
  });

  const drillTopics = questions.map((q) => q.topic).filter((t, i, a) => a.indexOf(t) === i);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('qbank.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {selectedPreset ? SUBJECT_PRESETS[selectedPreset].description : 'Active recall practice'}
          </p>
        </div>
        {!isSpeedDrill && (
          <Button size="sm" variant="outline" onClick={startSpeedDrill} disabled={questions.length === 0}>
            <Zap size={14} className="mr-1" /> {t('qbank.speedDrill')}
          </Button>
        )}
      </div>

      {/* Speed Drill Mode */}
      <AnimatePresence>
        {isSpeedDrill && !drillComplete && questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <SpeedDrillTimer
              current={drillIndex + 1}
              total={questions.length}
              timeLeft={drillTimeLeft}
              isRunning={isDrillRunning}
            />
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={questions[drillIndex].difficulty === 'hard' ? 'destructive' : questions[drillIndex].difficulty === 'medium' ? 'warning' : 'success'}>
                    {questions[drillIndex].difficulty}
                  </Badge>
                  <Badge variant="secondary">{questions[drillIndex].topic}</Badge>
                </div>
                <p className="text-white font-medium">{questions[drillIndex].question_text}</p>
                <p className="text-sm text-emerald-300 bg-slate-700/30 p-3 rounded-xl">
                  {questions[drillIndex].answer_text}
                </p>
                {questions[drillIndex].explanation && (
                  <p className="text-xs text-slate-400 italic">{questions[drillIndex].explanation}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleDrillIncorrect}>
                    <X size={14} className="mr-1" /> {t('qbank.iDidntKnow')}
                  </Button>
                  <Button onClick={handleDrillCorrect}>
                    <Target size={14} className="mr-1" /> {t('qbank.iGotIt')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Button variant="ghost" size="sm" onClick={() => { setIsSpeedDrill(false); setIsDrillRunning(false); }}>
              Exit Drill
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drill Complete */}
      {isSpeedDrill && drillComplete && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <Card>
            <CardContent className="py-8 space-y-4">
              <Zap size={48} className="mx-auto text-amber-400" />
              <h2 className="text-2xl font-bold text-white">{t('qbank.drillComplete')}</h2>
              <p className="text-lg text-white">
                {t('qbank.drillScore', {
                  correct: drillResults.filter((r) => r.correct).length,
                  total: drillResults.length,
                })}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => { setIsSpeedDrill(false); setDrillComplete(false); }}>
                  Back to Browse
                </Button>
                <Button onClick={() => {
                  setDrillIndex(0);
                  setDrillTimeLeft(60);
                  setIsDrillRunning(true);
                  setDrillResults([]);
                  setDrillComplete(false);
                }}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!isSpeedDrill && (
        <>
          {/* Subject Presets */}
          <Tabs defaultValue="browse" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-0">
              <TabsTrigger value="browse"><ListChecks size={14} className="mr-1" /> Browse</TabsTrigger>
              <TabsTrigger value="generate"><Wand2 size={14} className="mr-1" /> Generate</TabsTrigger>
              <TabsTrigger value="mistakes"><AlertCircle size={14} className="mr-1" /> {t('qbank.mistakeLog')}</TabsTrigger>
              <TabsTrigger value="coverage"><BarChart3 size={14} className="mr-1" /> {t('qbank.coverage')}</TabsTrigger>
            </TabsList>

            {/* Browse Tab */}
            <TabsContent value="browse">
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.entries(SUBJECT_PRESETS) as [string, typeof SUBJECT_PRESETS['math']][]).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => {
                          handlePresetSelect(key as SubjectPreset);
                          setActiveTab('generate');
                        }}
                        className={cn(
                          'p-3 rounded-xl text-left border transition-all',
                          selectedPreset === key
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                            : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:border-slate-600/50'
                        )}
                      >
                        <p className="text-xs font-medium">{t(`qbank.preset${key.charAt(0).toUpperCase() + key.slice(1)}` as any)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{preset.topics}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Generate Tab */}
            <TabsContent value="generate">
              <Card>
                <CardHeader>
                  <CardTitle>{t('qbank.generate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={t('qbank.topic') || ''}
                        className="flex-1"
                      />
                      <Select value={curriculum} onValueChange={(v) => setCurriculum(v as Curriculum)}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                          <SelectValue placeholder={t('qbank.curriculumPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRICULUMS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Difficulty Tabs */}
                      <div className="flex gap-1">
                        {(['standard', 'deep-wide', 'novelty'] as DifficultyMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                              'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                              mode === m
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            )}
                          >
                            {m === 'standard' && <><ListChecks size={12} className="inline mr-1" />{t('qbank.modeStandard')}</>}
                            {m === 'deep-wide' && <><ArrowRight size={12} className="inline mr-1" />{t('qbank.modeDeepWide')}</>}
                            {m === 'novelty' && <><Lightbulb size={12} className="inline mr-1" />{t('qbank.modeNovelty')}</>}
                          </button>
                        ))}
                      </div>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="w-[120px] text-xs">
                          <Filter size={12} className="mr-1" />
                          <SelectValue placeholder={t('qbank.difficulty')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('qbank.allDifficulties')}</SelectItem>
                          <SelectItem value="easy">{t('qbank.easy')}</SelectItem>
                          <SelectItem value="medium">{t('qbank.medium')}</SelectItem>
                          <SelectItem value="hard">{t('qbank.hard')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleGenerate} disabled={isGenerating} className="ml-auto">
                        {isGenerating ? (
                          <><Loader2 size={16} className="mr-2 animate-spin" /> {t('qbank.generating')}</>
                        ) : (
                          <><Wand2 size={16} className="mr-2" /> {t('qbank.generate')}</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Mistake Log Tab */}
            <TabsContent value="mistakes">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-400" />
                    {t('qbank.mistakeLog')} ({mistakes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mistakes.length === 0 ? (
                    <div className="text-center py-8">
                      <Bookmark size={32} className="mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-400 text-sm">{t('qbank.noMistakes')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mistakes.map((entry, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                          <p className="text-sm text-white truncate mb-2">{entry.question.question_text}</p>
                          <p className="text-xs text-rose-400 mb-2">Your answer: {entry.userAnswer}</p>
                          <p className="text-xs text-emerald-400 mb-3">Correct: {entry.question.answer_text}</p>
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" className="text-xs">
                              <Brain size={12} className="mr-1" /> {t('qbank.toFsrs')}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs">
                              <Target size={12} className="mr-1" /> {t('qbank.toPalace')}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs">
                              <Layers size={12} className="mr-1" /> {t('qbank.toSymbol')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Coverage Tab */}
            <TabsContent value="coverage">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-400" />
                    {t('qbank.coverage')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CoverageRadar topics={drillTopics}/>
                  <div className="space-y-2 mt-4">
                    {drillTopics.map((t, i) => (
                      <div key={t} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-24 truncate">{t}</span>
                        <Progress value={40 + Math.random() * 60} className="flex-1" />
                        <span className="text-xs text-white w-8 text-right">{Math.floor(40 + Math.random() * 60)}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Questions Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((question) => (
                <QuestionCard key={question.id} question={question} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-slate-400 text-sm">{t('qbank.empty')}</p>
              <p className="text-slate-500 text-xs mt-1">{t('qbank.emptyDesc')}</p>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
