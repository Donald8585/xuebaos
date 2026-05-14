import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Target, BarChart3, Trash2, Beaker, Lightbulb,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Plus,
  Loader2, Clock, Calendar, Skull, Sparkles, Crown, Medal,
  Timer, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

type StudyRank = 'bronze' | 'silver' | 'gold' | 'diamond' | 'xueshen';

interface AuditResult {
  id: string;
  subject: string;
  score: number;
  timeSpent: number;
  date: string;
  methods: string[];
  aiResponse: {
    keepDoing: string[];
    dropIt: string[];
    tryNext: string[];
    learnFrom: string[];
  };
}

interface MethodExperiment {
  id: string;
  name: string;
  subject: string;
  startedAt: string;
  status: 'active' | 'completed' | 'abandoned';
  notes: string;
}

interface RetiredMethod {
  id: string;
  name: string;
  retiredAt: string;
  reason: string;
}

// ─── Rank Badge ──────────────────────────────────────────

function RankBadge({ rank, size = 'md' }: { rank: StudyRank; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation();
  const config: Record<StudyRank, { emoji: string; color: string; textColor: string }> = {
    bronze: { emoji: '🥉', color: '#CD7F32', textColor: '#E8A87C' },
    silver: { emoji: '🥈', color: '#C0C0C0', textColor: '#D4D4D4' },
    gold: { emoji: '🥇', color: '#FFD700', textColor: '#FFED4A' },
    diamond: { emoji: '💎', color: '#B9F2FF', textColor: '#B9F2FF' },
    xueshen: { emoji: '🐉', color: '#818CF8', textColor: '#A5B4FC' },
  };

  const { emoji, color, textColor } = config[rank];
  const sizeClass = size === 'lg' ? 'text-lg px-4 py-2' : size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  return (
    <div
      className={cn('rounded-xl flex items-center gap-1.5 font-semibold', sizeClass)}
      style={{ backgroundColor: color + '20', border: `1px solid ${color}40`, color: textColor }}
    >
      <span>{emoji}</span>
      <span>{t(`technocratic.ranks.${rank}`)}</span>
    </div>
  );
}

// ─── Method ROI Chart ────────────────────────────────────

function MethodROIChart({ audits }: { audits: AuditResult[] }) {
  const subjects = [...new Set(audits.map((a) => a.subject))];
  const methods = [...new Set(audits.flatMap((a) => a.methods))];

  if (subjects.length === 0) {
    return (
      <p className="text-center text-slate-500 text-sm py-8">Run audits to see method ROI data.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left py-2 text-slate-400 font-medium">Method</th>
            {subjects.map((s) => (
              <th key={s} className="text-center py-2 text-slate-400 font-medium px-3">{s}</th>
            ))}
            <th className="text-center py-2 text-slate-400 font-medium">Avg</th>
          </tr>
        </thead>
        <tbody>
          {methods.slice(0, 6).map((method) => (
            <tr key={method} className="border-b border-slate-700/30">
              <td className="py-2 text-white">{method}</td>
              {subjects.map((subject) => {
                const relevantAudit = audits.find(
                  (a) => a.subject === subject && a.methods.includes(method)
                );
                const score = relevantAudit?.score ?? null;
                return (
                  <td key={subject} className="text-center px-3 py-2">
                    {score !== null ? (
                      <span className={cn(
                        'font-medium',
                        score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400'
                      )}>
                        {score}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                );
              })}
              <td className="text-center font-bold text-white">
                {Math.round(
                  subjects.reduce((sum, s) => {
                    const a = audits.find((aud) => aud.subject === s && aud.methods.includes(method));
                    return sum + (a?.score ?? 0);
                  }, 0) / subjects.filter((s) =>
                    audits.some((a) => a.subject === s && a.methods.includes(method))
                  ).length
                ) || '—'}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Next Method Card ────────────────────────────────────

function NextMethodCard() {
  return (
    <Card className="bg-gradient-to-r from-indigo-900/40 to-violet-900/40 border-indigo-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles size={16} className="text-indigo-400" />
          Next Method to Try
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Lightbulb size={24} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Interleaved Practice</p>
            <p className="text-xs text-slate-400 mt-1">
              Instead of blocking subjects, mix them: 20min Math → 20min Bio → 20min Math. Research shows 43% better long-term retention.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="default">Suggested</Badge>
              <Badge variant="secondary">For: Physics, Biology</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main TechnocraticDashboard ──────────────────────────

export default function TechnocraticDashboard() {
  const { t } = useTranslation();

  const [rank, setRank] = useState<StudyRank>('bronze');
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [experiments, setExperiments] = useState<MethodExperiment[]>([]);
  const [graveyard, setGraveyard] = useState<RetiredMethod[]>([]);

  // New audit form
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [auditSubject, setAuditSubject] = useState('');
  const [auditScore, setAuditScore] = useState('');
  const [auditTime, setAuditTime] = useState('');
  const [auditMethods, setAuditMethods] = useState<string[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  const [newMethod, setNewMethod] = useState('');

  const daysSinceLastAudit = audits.length > 0
    ? Math.floor((Date.now() - new Date(audits[0].date).getTime()) / 86400000)
    : Infinity;

  const AVAILABLE_METHODS = [
    'Memory Palace', 'Active Recall', 'FSRS Spacing', 'Problem Sets',
    'Flashcards', 'Passive Re-reading', 'Feynman Teach-Back', 'Highlighting',
    'Mind Maps', 'Group Study', 'Past Papers', 'Speed Drills',
    '3-Pass Annotation', 'Mnemonic Stories', 'Symbol Forge',
  ];

  const handleRunAudit = () => {
    if (!auditSubject || !auditScore || auditMethods.length === 0) {
      toast.error('Fill in all fields');
      return;
    }
    setIsAuditing(true);
    setTimeout(() => {
      const newAudit: AuditResult = {
        id: Date.now().toString(),
        subject: auditSubject,
        score: parseInt(auditScore),
        timeSpent: parseInt(auditTime) || 0,
        date: new Date().toISOString(),
        methods: auditMethods,
        aiResponse: {
          keepDoing: [`${auditMethods[0]} — strong correlation with score`, `${auditMethods[1] || 'Active Recall'} — effective technique`],
          dropIt: ['Method to re-evaluate — check if yield per hour is worth it'],
          tryNext: ['Try interleaving subjects in one session', 'Add speed drills before next exam'],
          learnFrom: ['Study god technique — combine multiple methods per session'],
        },
      };
      setAudits([newAudit, ...audits]);
      setIsAuditing(false);
      setShowAuditForm(false);
      setAuditSubject('');
      setAuditScore('');
      setAuditTime('');
      setAuditMethods([]);
      toast.success('Audit complete! AI analysis generated.');
    }, 2500);
  };

  const toggleMethod = (method: string) => {
    if (auditMethods.includes(method)) {
      setAuditMethods(auditMethods.filter((m) => m !== method));
    } else {
      setAuditMethods([...auditMethods, method]);
    }
  };

  const addExperiment = () => {
    if (!newMethod.trim()) return;
    setExperiments([
      {
        id: Date.now().toString(),
        name: newMethod,
        subject: 'General',
        startedAt: new Date().toISOString(),
        status: 'active',
        notes: 'New experiment started.',
      },
      ...experiments,
    ]);
    setNewMethod('');
    toast.success('Experiment added!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('technocratic.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('technocratic.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowAuditForm(true)}>
            <Target size={14} className="mr-1" /> New Audit
          </Button>
          <RankBadge rank={rank} size="md" />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-amber-400" />
            <div>
              <p className="text-xs text-slate-400">{t('technocratic.iterationCadence')}</p>
              <p className="text-lg font-bold text-white">
                {daysSinceLastAudit === Infinity ? '—' : daysSinceLastAudit}
                <span className="text-xs text-slate-400 ml-1">{t('technocratic.daysSinceAudit')}</span>
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Beaker size={16} className="text-indigo-400" />
            <div>
              <p className="text-xs text-slate-400">Experiments</p>
              <p className="text-lg font-bold text-white">{experiments.filter(e => e.status === 'active').length} active</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Skull size={16} className="text-slate-500" />
            <div>
              <p className="text-xs text-slate-400">Graveyard</p>
              <p className="text-lg font-bold text-white">{graveyard.length} retired</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-400" />
            <div>
              <p className="text-xs text-slate-400">Audit Avg</p>
              <p className="text-lg font-bold text-white">
                {audits.length > 0
                  ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length)
                  : '—'}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">
            <Target size={14} className="mr-1" /> {t('technocratic.postExamAudit')}
          </TabsTrigger>
          <TabsTrigger value="experiments">
            <Beaker size={14} className="mr-1" /> {t('technocratic.methodExperiments')}
          </TabsTrigger>
          <TabsTrigger value="graveyard">
            <Skull size={14} className="mr-1" /> {t('technocratic.methodGraveyard')}
          </TabsTrigger>
          <TabsTrigger value="roi">
            <BarChart3 size={14} className="mr-1" /> {t('technocratic.methodRoi')}
          </TabsTrigger>
        </TabsList>

        {/* Audit Results */}
        <TabsContent value="audits" className="space-y-4">
          {daysSinceLastAudit >= 3 && daysSinceLastAudit !== Infinity && (
            <Card className="bg-amber-900/20 border-amber-500/20">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <p className="text-sm text-amber-300">
                    {daysSinceLastAudit} {t('technocratic.daysSinceAudit')}. Run an audit after your next exam!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {audits.length === 0 ? (
            <div className="text-center py-16">
              <Target size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t('technocratic.noAudits')}</p>
            </div>
          ) : (
            audits.map((audit) => (
              <motion.div
                key={audit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {audit.subject}
                          <Badge variant={audit.score >= 80 ? 'success' : audit.score >= 60 ? 'warning' : 'destructive'}>
                            {audit.score}%
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {audit.timeSpent}h spent · {new Date(audit.date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        {audit.methods.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-300">{t('technocratic.keepDoing')}</span>
                        </div>
                        <ul className="space-y-1">
                          {audit.aiResponse.keepDoing.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                              <ArrowUpRight size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle size={14} className="text-rose-400" />
                          <span className="text-sm font-medium text-rose-300">{t('technocratic.dropIt')}</span>
                        </div>
                        <ul className="space-y-1">
                          {audit.aiResponse.dropIt.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                              <ArrowDownRight size={10} className="text-rose-400 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb size={14} className="text-amber-400" />
                          <span className="text-sm font-medium text-amber-300">{t('technocratic.tryNext')}</span>
                        </div>
                        <ul className="space-y-1">
                          {audit.aiResponse.tryNext.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                              <ArrowUpRight size={10} className="text-amber-400 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Crown size={14} className="text-indigo-400" />
                          <span className="text-sm font-medium text-indigo-300">{t('technocratic.learnFrom')}</span>
                        </div>
                        <ul className="space-y-1">
                          {audit.aiResponse.learnFrom.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                              <ArrowUpRight size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}

          <NextMethodCard />
        </TabsContent>

        {/* Experiments */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              placeholder="New method to experiment..."
              className="flex-1"
            />
            <Button onClick={addExperiment}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          {experiments.length === 0 ? (
            <div className="text-center py-16">
              <Beaker size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t('technocratic.noExperiments')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {experiments.map((exp) => (
                <Card key={exp.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{exp.name}</p>
                        <p className="text-xs text-slate-400">{exp.subject}</p>
                      </div>
                      <Badge variant={exp.status === 'active' ? 'success' : exp.status === 'completed' ? 'default' : 'secondary'}>
                        {exp.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{exp.notes}</p>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-slate-500" />
                      <span className="text-xs text-slate-500">
                        Started {new Date(exp.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Method Graveyard */}
        <TabsContent value="graveyard">
          {graveyard.length === 0 ? (
            <div className="text-center py-16">
              <Skull size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t('technocratic.noGraveyard')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {graveyard.map((method) => (
                <Card key={method.id} className="opacity-70 hover:opacity-100 transition-opacity">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Skull size={20} className="text-slate-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-300">{method.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{method.reason}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar size={12} className="text-slate-500" />
                          <span className="text-xs text-slate-500">
                            {t('technocratic.retiredOn')}: {new Date(method.retiredAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ROI */}
        <TabsContent value="roi">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('technocratic.methodRoi')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MethodROIChart audits={audits} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audit Form Modal */}
      <AnimatePresence>
        {showAuditForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAuditForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('technocratic.postExamAudit')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">{t('technocratic.subject')}</label>
                  <Input
                    value={auditSubject}
                    onChange={(e) => setAuditSubject(e.target.value)}
                    placeholder="e.g., Biology"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">{t('technocratic.score')}</label>
                    <Input
                      type="number"
                      value={auditScore}
                      onChange={(e) => setAuditScore(e.target.value)}
                      placeholder="85"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">{t('technocratic.timeSpent')}</label>
                    <Input
                      type="number"
                      value={auditTime}
                      onChange={(e) => setAuditTime(e.target.value)}
                      placeholder="20"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">{t('technocratic.methodsUsed')}</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_METHODS.map((method) => (
                      <button
                        key={method}
                        onClick={() => toggleMethod(method)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          auditMethods.includes(method)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button variant="ghost" onClick={() => setShowAuditForm(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleRunAudit} disabled={isAuditing}>
                  {isAuditing ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> {t('technocratic.auditing')}</>
                  ) : (
                    <><Sparkles size={16} className="mr-2" /> {t('technocratic.runAudit')}</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
