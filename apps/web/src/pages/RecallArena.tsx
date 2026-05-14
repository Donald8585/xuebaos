import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Lightbulb, Mic, MicOff, Send, Loader2, History, RotateCcw,
  CheckCircle2, XCircle, TrendingUp, AlertTriangle, ArrowRight,
  Clock, Star, Eye, EyeOff, Play, Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

interface RecallSession {
  id: string;
  topic: string;
  mode: 'free' | 'cued' | 'feynman';
  date: string;
  score: number;
  accuracy: number;
  depth: number;
  completeness: number;
  weakConcepts: string[];
}

interface CuedItem {
  hint: string;
  answer: string;
  userAnswer: string;
  isRevealed: boolean;
  userResponded: boolean;
  isCorrect?: boolean;
}

// ─── Mock Data ──────────────────────────────────────────

const MOCK_HISTORY: RecallSession[] = [
  {
    id: '1',
    topic: 'Cell Biology - Mitochondria',
    mode: 'free',
    date: new Date(Date.now() - 86400000).toISOString(),
    score: 78,
    accuracy: 82,
    depth: 75,
    completeness: 70,
    weakConcepts: ['Electron Transport Chain', 'Chemiosmosis', 'ATP Synthase structure'],
  },
  {
    id: '2',
    topic: 'Physics - Newton\'s Laws',
    mode: 'cued',
    date: new Date(Date.now() - 172800000).toISOString(),
    score: 85,
    accuracy: 90,
    depth: 80,
    completeness: 82,
    weakConcepts: ['Third Law applications', 'Friction models'],
  },
];

const MOCK_CUED_QUESTIONS: CuedItem[] = [
  {
    hint: 'The enzyme that catalyzes the first step of glycolysis, converting glucose to...',
    answer: 'Glucose-6-phosphate, catalyzed by hexokinase',
    userAnswer: '',
    isRevealed: false,
    userResponded: false,
  },
  {
    hint: 'In the Krebs cycle, citrate is isomerized to this molecule before oxidative decarboxylation...',
    answer: 'Isocitrate, catalyzed by aconitase',
    userAnswer: '',
    isRevealed: false,
    userResponded: false,
  },
  {
    hint: 'The final electron acceptor in the electron transport chain is...',
    answer: 'Oxygen (O₂), which is reduced to water',
    userAnswer: '',
    isRevealed: false,
    userResponded: false,
  },
];

// ─── Score Ring ──────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={40} fill="none" stroke="#1E293B" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={40}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="text-3xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Main RecallArena ────────────────────────────────────

export default function RecallArena() {
  const { t } = useTranslation();

  // Free Recall state
  const [freeTopic, setFreeTopic] = useState('');
  const [freeContent, setFreeContent] = useState('');
  const [freeTimer, setFreeTimer] = useState(0);
  const [isFreeTiming, setIsFreeTiming] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [freeResult, setFreeResult] = useState<RecallSession | null>(null);

  // Cued Recall state
  const [cuedTopic, setCuedTopic] = useState('');
  const [cuedItems, setCuedItems] = useState<CuedItem[]>([]);
  const [isGeneratingCues, setIsGeneratingCues] = useState(false);

  // Feynman state
  const [feynmanTopic, setFeynmanTopic] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [feynmanTranscript, setFeynmanTranscript] = useState('');

  // History
  const [history, setHistory] = useState<RecallSession[]>(MOCK_HISTORY);

  // Free recall timer
  useEffect(() => {
    if (!isFreeTiming) return;
    const interval = setInterval(() => setFreeTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isFreeTiming]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleFreeSubmit = () => {
    if (!freeContent.trim()) {
      toast.error('Write something first!');
      return;
    }
    setIsGrading(true);
    setIsFreeTiming(false);
    // Simulate AI grading
    setTimeout(() => {
      const result: RecallSession = {
        id: Date.now().toString(),
        topic: freeTopic || 'Untitled',
        mode: 'free',
        date: new Date().toISOString(),
        score: Math.floor(Math.random() * 30) + 65,
        accuracy: Math.floor(Math.random() * 20) + 70,
        depth: Math.floor(Math.random() * 25) + 60,
        completeness: Math.floor(Math.random() * 20) + 65,
        weakConcepts: [
          'Concept A - missing detail',
          'Concept B - partially incorrect',
          'Concept C - not mentioned',
        ],
      };
      setFreeResult(result);
      setHistory([result, ...history]);
      setIsGrading(false);
      toast.success('Recall graded!');
    }, 2500);
  };

  const handleGenerateCues = () => {
    if (!cuedTopic.trim()) {
      toast.error('Enter a topic first!');
      return;
    }
    setIsGeneratingCues(true);
    setTimeout(() => {
      setCuedItems(MOCK_CUED_QUESTIONS);
      setIsGeneratingCues(false);
    }, 2000);
  };

  const handleCuedAnswer = (idx: number, userAnswer: string) => {
    const items = [...cuedItems];
    items[idx] = { ...items[idx], userAnswer, userResponded: true, isRevealed: true };
    setCuedItems(items);
  };

  const handleCuedCorrect = (idx: number) => {
    const items = [...cuedItems];
    items[idx] = { ...items[idx], isCorrect: true };
    setCuedItems(items);
  };

  const handleCuedIncorrect = (idx: number) => {
    const items = [...cuedItems];
    items[idx] = { ...items[idx], isCorrect: false };
    setCuedItems(items);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      setTimeout(() => {
        setFeynmanTranscript(
          "So, mitochondria are the powerhouses of the cell. They take in glucose and oxygen and convert them into ATP through a process called oxidative phosphorylation. The electron transport chain creates a proton gradient across the inner mitochondrial membrane, and ATP synthase uses this gradient to produce ATP. The Krebs cycle happens in the matrix and produces NADH and FADH₂ that feed into the ETC..."
        );
        setIsTranscribing(false);
        toast.success('Transcription complete!');
      }, 3000);
    } else {
      setIsRecording(true);
      toast('Recording started...');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('recall.title')}</h1>
        <p className="text-sm text-slate-400 mt-1">Test your knowledge with active recall</p>
      </div>

      <Tabs defaultValue="free" className="w-full">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="free" className="flex-1">
            <Brain size={14} className="mr-1" /> {t('recall.freeRecall')}
          </TabsTrigger>
          <TabsTrigger value="cued" className="flex-1">
            <Lightbulb size={14} className="mr-1" /> {t('recall.cuedRecall')}
          </TabsTrigger>
          <TabsTrigger value="feynman" className="flex-1">
            <Mic size={14} className="mr-1" /> {t('recall.feynman')}
          </TabsTrigger>
        </TabsList>

        {/* ─── Free Recall ──────────────────────────────── */}
        <TabsContent value="free">
          {freeResult ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('recall.score')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <ScoreRing score={freeResult.score} size={140} />
                  <div className="grid grid-cols-3 gap-4 w-full mt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{freeResult.accuracy}%</p>
                      <p className="text-xs text-slate-400">{t('recall.accuracy')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{freeResult.depth}%</p>
                      <p className="text-xs text-slate-400">{t('recall.depth')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{freeResult.completeness}%</p>
                      <p className="text-xs text-slate-400">{t('recall.completeness')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" />
                    {t('recall.weakConcepts')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {freeResult.weakConcepts.map((concept, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30">
                      <XCircle size={14} className="text-rose-400 shrink-0" />
                      <p className="text-sm text-slate-300 flex-1">{concept}</p>
                      <Button size="sm" variant="outline">{t('recall.fixIt')}</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => { setFreeResult(null); setFreeContent(''); setFreeTimer(0); }}>
                <RotateCcw size={14} className="mr-1" /> Try Again
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <Input
                    value={freeTopic}
                    onChange={(e) => setFreeTopic(e.target.value)}
                    placeholder={t('recall.topicPlaceholder') || ''}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      <span className="text-sm font-mono text-slate-300">{formatTime(freeTimer)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isFreeTiming) setIsFreeTiming(false);
                          else { setIsFreeTiming(true); setFreeTimer(0); }
                        }}
                      >
                        {isFreeTiming ? <Pause size={14} className="mr-1" /> : <Play size={14} className="mr-1" />}
                        {isFreeTiming ? 'Stop' : 'Start Timer'}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={freeContent}
                    onChange={(e) => setFreeContent(e.target.value)}
                    placeholder={t('recall.writeEverything') || ''}
                    className="min-h-[250px] text-base"
                  />
                  <Button
                    onClick={handleFreeSubmit}
                    disabled={isGrading || !freeContent.trim()}
                    className="w-full"
                  >
                    {isGrading ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> {t('recall.grading')}</>
                    ) : (
                      <><Send size={16} className="mr-2" /> {t('recall.submitRecall')}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
              <p className="text-xs text-slate-500 text-center">{t('recall.freeRecallDesc')}</p>
            </div>
          )}
        </TabsContent>

        {/* ─── Cued Recall ──────────────────────────────── */}
        <TabsContent value="cued">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-3">
                  <Input
                    value={cuedTopic}
                    onChange={(e) => setCuedTopic(e.target.value)}
                    placeholder={t('recall.topicPlaceholder') || ''}
                    className="flex-1"
                  />
                  <Button onClick={handleGenerateCues} disabled={isGeneratingCues}>
                    {isGeneratingCues ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Lightbulb size={16} className="mr-2" /> Generate</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {cuedItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className={cn(
                  item.userResponded && (item.isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30')
                )}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} className="text-amber-400" />
                      <p className="text-sm text-slate-300">
                        <span className="text-amber-400 font-medium">{t('recall.cueHint')}:</span> {item.hint}
                      </p>
                    </div>
                    <Input
                      value={item.userAnswer}
                      onChange={(e) => handleCuedAnswer(idx, e.target.value)}
                      placeholder={t('recall.yourAnswer') || ''}
                      disabled={item.userResponded}
                    />
                    {item.isRevealed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 rounded-xl bg-slate-700/30"
                      >
                        <p className="text-xs text-slate-400 mb-1">{t('recall.correctAnswer')}:</p>
                        <p className="text-sm text-emerald-300">{item.answer}</p>
                      </motion.div>
                    )}
                    {item.userResponded && item.isCorrect === undefined && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCuedCorrect(idx)} className="text-emerald-400">
                          <CheckCircle2 size={14} className="mr-1" /> {t('recall.iKnewIt')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCuedIncorrect(idx)} className="text-rose-400">
                          <XCircle size={14} className="mr-1" /> {t('recall.iDidntKnow')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* ─── Feynman Teach-Back ───────────────────────── */}
        <TabsContent value="feynman">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Input
                  value={feynmanTopic}
                  onChange={(e) => setFeynmanTopic(e.target.value)}
                  placeholder={t('recall.topicPlaceholder') || ''}
                />
                <div className="flex flex-col items-center gap-4 py-8">
                  <button
                    onClick={handleToggleRecording}
                    className={cn(
                      'w-24 h-24 rounded-full flex items-center justify-center transition-all',
                      isRecording
                        ? 'bg-rose-600 animate-pulse shadow-lg shadow-rose-500/30'
                        : isTranscribing
                        ? 'bg-amber-600'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30'
                    )}
                  >
                    {isRecording ? (
                      <MicOff size={36} className="text-white" />
                    ) : isTranscribing ? (
                      <Loader2 size={36} className="text-white animate-spin" />
                    ) : (
                      <Mic size={36} className="text-white" />
                    )}
                  </button>
                  <p className="text-sm text-slate-400">
                    {isRecording
                      ? t('recall.recording')
                      : isTranscribing
                      ? t('recall.transcribing')
                      : t('recall.startRecording')}
                  </p>
                </div>

                {feynmanTranscript && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-slate-700/30"
                  >
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{feynmanTranscript}</p>
                    <Button className="mt-3 w-full">
                      <Send size={14} className="mr-1" /> {t('recall.submitRecall')}
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>
            <p className="text-xs text-slate-500 text-center">{t('recall.feynmanDesc')}</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={16} className="text-indigo-400" />
            {t('recall.history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">{t('recall.noHistory')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className={cn(
                    'w-3 h-3 rounded-full shrink-0',
                    session.score >= 80 ? 'bg-emerald-400' : session.score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{session.topic}</p>
                    <p className="text-xs text-slate-500">
                      {session.mode === 'free' ? t('recall.freeRecall') : session.mode === 'cued' ? t('recall.cuedRecall') : t('recall.feynman')}
                      {' · '}{new Date(session.date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={session.score >= 80 ? 'success' : session.score >= 60 ? 'warning' : 'destructive'}>
                    {session.score}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
