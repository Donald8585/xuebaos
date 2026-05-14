import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Clock, Moon, Plus, Trash2, Loader2, ChevronLeft, ChevronRight,
  Zap, Brain, BookOpen, FlaskConical, Sun, Sunset, Sparkles, Calendar,
  Settings2, X, Gauge, TrendingUp, AlertCircle, Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

type BrainRegion = 'language' | 'science' | 'languageish' | 'mathish';
type FocusSlot = 'morning' | 'afternoon' | 'evening' | 'late_night';
type Phase = 1 | 2 | 3 | 4 | 5 | 6;

interface Constraint {
  id: string;
  label: string;
  day: number;
  start: string;
  end: string;
}

interface SubjectRating {
  name: string;
  weakness: number; // 1-5, 1=very weak
  brainRegion: BrainRegion;
}

interface StudyBlock {
  id: string;
  subject: string;
  day: number;
  start: string;
  end: string;
  color: string;
  brainRegion: BrainRegion;
  isSpeedDrill: boolean;
  isBufferDay: boolean;
}

interface OnboardingData {
  examDate: string;
  weeklyHours: number;
  peakWeekday: FocusSlot;
  peakWeekend: FocusSlot;
  subjects: SubjectRating[];
  sleepStart: string;
  sleepEnd: string;
  constraints: Constraint[];
}

// ─── Constants ───────────────────────────────────────────

const COLORS = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 16 }, (_, i) => `${i + 7}:00`);
const BRAIN_REGION_COLORS: Record<BrainRegion, string> = {
  language: '#EC4899',
  science: '#10B981',
  languageish: '#F59E0B',
  mathish: '#3B82F6',
};
const BRAIN_REGION_LABELS: Record<BrainRegion, string> = {
  language: 'Language',
  science: 'Science',
  languageish: 'Language-ish',
  mathish: 'Math-ish',
};
const PHASE_LABELS: Record<Phase, string> = {
  1: 'Foundation',
  2: 'Build-Up',
  3: 'Intensification',
  4: 'Peak Load',
  5: 'Tapering',
  6: 'Pre-Exam',
};
const PHASE_SATURATION: Record<Phase, { min: number; max: number }> = {
  1: { min: 25, max: 35 },
  2: { min: 35, max: 50 },
  3: { min: 50, max: 65 },
  4: { min: 65, max: 80 },
  5: { min: 50, max: 65 },
  6: { min: 30, max: 45 },
};
const FOCUS_SLOTS: FocusSlot[] = ['morning', 'afternoon', 'evening', 'late_night'];
const FOCUS_ICONS: Record<FocusSlot, typeof Sun> = {
  morning: Sun,
  afternoon: Sun,
  evening: Sunset,
  late_night: Moon,
};

// ─── Helpers ─────────────────────────────────────────────

function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h - 7) * 60 + m;
}
function durationToSpan(start: string, end: string): number {
  return timeToRow(end) - timeToRow(start);
}
function isSleepTime(time: string, sleepStart: string, sleepEnd: string): boolean {
  const [th] = time.split(':').map(Number);
  const [sh] = sleepStart.split(':').map(Number);
  const [eh] = sleepEnd.split(':').map(Number);
  if (sh > eh) return th >= sh || th < eh;
  return th >= sh && th < eh;
}

// ─── SaturationMeter Component ───────────────────────────

function SaturationMeter({ level, phase }: { level: number; phase?: Phase }) {
  const { t } = useTranslation();
  const getColor = () => {
    if (level < 35) return 'emerald';
    if (level < 55) return 'amber';
    if (level < 75) return 'orange';
    return 'rose';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge size={14} className="text-indigo-400" />
          {t('timetable.saturation')}
          {phase && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {t('timetable.phase')} {phase}: {t(`timetable.phaseLabels.${phase}`)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                getColor() === 'emerald' && 'bg-gradient-to-r from-emerald-500 to-teal-500',
                getColor() === 'amber' && 'bg-gradient-to-r from-amber-500 to-yellow-500',
                getColor() === 'orange' && 'bg-gradient-to-r from-orange-500 to-red-400',
                getColor() === 'rose' && 'bg-gradient-to-r from-rose-500 to-red-500',
              )}
              initial={{ width: 0 }}
              animate={{ width: `${level}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <span className="text-sm font-bold text-white min-w-[3ch] text-right">{level}%</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>25%</span>
          <span className="text-amber-400">40%</span>
          <span>55%</span>
          <span className="text-orange-400">70%</span>
          <span className="text-rose-400">80%</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">{t('timetable.saturationDesc')}</p>
      </CardContent>
    </Card>
  );
}

// ─── Phase Curve Visualization ───────────────────────────

function PhaseCurve({ phase, saturation }: { phase: Phase; saturation: number }) {
  const phases: Phase[] = [1, 2, 3, 4, 5, 6];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-400" />
          Saturation Curve
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-24 flex items-end gap-1">
          {phases.map((p) => {
            const range = PHASE_SATURATION[p];
            const mid = (range.min + range.max) / 2;
            const isActive = p === phase;
            const isPast = p < phase;
            return (
              <div key={p} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-full rounded-t transition-all duration-500',
                    isActive ? 'bg-gradient-to-t from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30' :
                    isPast ? 'bg-indigo-900/60' : 'bg-slate-700/40'
                  )}
                  style={{ height: `${mid}%` }}
                />
                <span className={cn(
                  'text-[9px]',
                  isActive ? 'text-indigo-300 font-semibold' : 'text-slate-500'
                )}>
                  P{p}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3 text-center">
          Current: Phase {phase} — {saturation}% saturation
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Onboarding Wizard ───────────────────────────────────

function OnboardingWizard({
  onComplete,
}: {
  onComplete: (data: OnboardingData) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    examDate: '',
    weeklyHours: 20,
    peakWeekday: 'evening',
    peakWeekend: 'morning',
    subjects: [
      { name: '', weakness: 3, brainRegion: 'science' },
    ],
    sleepStart: '01:00',
    sleepEnd: '10:00',
    constraints: [],
  });

  const maxSteps = 6;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">{t('timetable.onboardingTitle')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('timetable.onboardingDesc')}</p>
          <div className="flex gap-1 mt-4">
            {Array.from({ length: maxSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= step ? 'bg-indigo-500' : 'bg-slate-700'
                )}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Exam Date */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="block">
                <span className="text-sm font-medium text-slate-300">{t('timetable.examDate')}</span>
                <Input
                  type="date"
                  value={data.examDate}
                  onChange={(e) => setData({ ...data, examDate: e.target.value })}
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">{t('timetable.weeklyHours')}</span>
                <div className="flex items-center gap-3 mt-1">
                  <Slider
                    value={[data.weeklyHours]}
                    onValueChange={([v]) => setData({ ...data, weeklyHours: v })}
                    min={5}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-white font-bold min-w-[3ch]">{data.weeklyHours}h</span>
                </div>
              </label>
            </motion.div>
          )}

          {/* Step 1: Peak Focus Windows */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">
                  {t('timetable.peakFocus')} — {t('timetable.peakFocusWeekday')}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {FOCUS_SLOTS.map((slot) => {
                    const Icon = FOCUS_ICONS[slot];
                    return (
                      <button
                        key={slot}
                        onClick={() => setData({ ...data, peakWeekday: slot })}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                          data.peakWeekday === slot
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        )}
                      >
                        <Icon size={18} />
                        <span className="text-[11px]">{t(`timetable.${slot}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">
                  {t('timetable.peakFocus')} — {t('timetable.peakFocusWeekend')}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {FOCUS_SLOTS.map((slot) => {
                    const Icon = FOCUS_ICONS[slot];
                    return (
                      <button
                        key={slot}
                        onClick={() => setData({ ...data, peakWeekend: slot })}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                          data.peakWeekend === slot
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        )}
                      >
                        <Icon size={18} />
                        <span className="text-[11px]">{t(`timetable.${slot}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Subject Weakness Ratings */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-slate-300">{t('timetable.subjectsWeakness')}</p>
              <p className="text-xs text-slate-500">{t('timetable.weaknessHelp')}</p>
              {data.subjects.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                  <Input
                    value={sub.name}
                    onChange={(e) => {
                      const s = [...data.subjects];
                      s[idx] = { ...s[idx], name: e.target.value };
                      setData({ ...data, subjects: s });
                    }}
                    placeholder={t('timetable.subject') || ''}
                    className="flex-1"
                  />
                  <Select
                    value={sub.brainRegion}
                    onValueChange={(v: BrainRegion) => {
                      const s = [...data.subjects];
                      s[idx] = { ...s[idx], brainRegion: v };
                      setData({ ...data, subjects: s });
                    }}
                  >
                    <SelectTrigger className="w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BRAIN_REGION_LABELS) as BrainRegion[]).map((br) => (
                        <SelectItem key={br} value={br}>{t(`timetable.brainRegions.${br}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          const s = [...data.subjects];
                          s[idx] = { ...s[idx], weakness: n };
                          setData({ ...data, subjects: s });
                        }}
                        className={cn(
                          'w-7 h-7 rounded-lg text-xs font-medium transition-all',
                          n <= sub.weakness
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-500 hover:bg-slate-600'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {data.subjects.length > 1 && (
                    <button
                      onClick={() => {
                        setData({ ...data, subjects: data.subjects.filter((_, i) => i !== idx) });
                      }}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setData({
                    ...data,
                    subjects: [...data.subjects, { name: '', weakness: 3, brainRegion: 'science' }],
                  })
                }
              >
                <Plus size={14} className="mr-1" /> Add Subject
              </Button>
            </motion.div>
          )}

          {/* Step 3: Sleep Window */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Moon size={18} className="text-indigo-400" />
                <span className="text-sm font-medium text-slate-300">{t('timetable.sleepWindow')}</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">{t('timetable.sleepDesc')}</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-slate-400">{t('timetable.sleepStart')}</span>
                  <Input
                    type="time"
                    value={data.sleepStart}
                    onChange={(e) => setData({ ...data, sleepStart: e.target.value })}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">{t('timetable.sleepEnd')}</span>
                  <Input
                    type="time"
                    value={data.sleepEnd}
                    onChange={(e) => setData({ ...data, sleepEnd: e.target.value })}
                    className="mt-1"
                  />
                </label>
              </div>
            </motion.div>
          )}

          {/* Step 4: Recurring Constraints */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-slate-300">{t('timetable.recurringConstraints')}</p>
              {data.constraints.map((c, idx) => (
                <div key={c.id} className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-800/50 items-center">
                  <Input
                    value={c.label}
                    onChange={(e) => {
                      const cs = [...data.constraints];
                      cs[idx] = { ...cs[idx], label: e.target.value };
                      setData({ ...data, constraints: cs });
                    }}
                    placeholder={t('timetable.constraintLabel') || ''}
                    className="w-[100px] text-xs"
                  />
                  <div className="flex gap-0.5">
                    {DAY_NAMES_SHORT.map((day, di) => (
                      <button
                        key={day}
                        onClick={() => {
                          const cs = [...data.constraints];
                          cs[idx] = { ...cs[idx], day: di };
                          setData({ ...data, constraints: cs });
                        }}
                        className={cn(
                          'px-1.5 py-1 text-[10px] rounded',
                          c.day === di ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                        )}
                      >
                        {day.slice(0, 1)}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="time"
                    value={c.start}
                    onChange={(e) => {
                      const cs = [...data.constraints];
                      cs[idx] = { ...cs[idx], start: e.target.value };
                      setData({ ...data, constraints: cs });
                    }}
                    className="w-[100px] text-xs"
                  />
                  <Input
                    type="time"
                    value={c.end}
                    onChange={(e) => {
                      const cs = [...data.constraints];
                      cs[idx] = { ...cs[idx], end: e.target.value };
                      setData({ ...data, constraints: cs });
                    }}
                    className="w-[100px] text-xs"
                  />
                  <button
                    onClick={() => setData({
                      ...data,
                      constraints: data.constraints.filter((_, i) => i !== idx),
                    })}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setData({
                    ...data,
                    constraints: [
                      ...data.constraints,
                      { id: Date.now().toString(), label: 'School', day: 0, start: '08:00', end: '15:00' },
                    ],
                  })
                }
              >
                <Plus size={14} className="mr-1" /> {t('timetable.addConstraint')}
              </Button>
            </motion.div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <p className="text-sm text-slate-300">Review your settings:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Exam Date</span>
                  <span className="text-white">{data.examDate || 'Not set'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Weekly Hours</span>
                  <span className="text-white">{data.weeklyHours}h</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Peak Focus</span>
                  <span className="text-white">
                    WD: {data.peakWeekday}, WE: {data.peakWeekend}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Sleep</span>
                  <span className="text-white">{data.sleepStart} — {data.sleepEnd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Subjects</span>
                  <span className="text-white">{data.subjects.filter(s => s.name).map(s => s.name).join(', ') || 'None'}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ChevronLeft size={16} className="mr-1" /> Back
          </Button>
          <Button
            onClick={() => {
              if (step < maxSteps - 1) {
                setStep(step + 1);
              } else {
                onComplete(data);
                toast.success('Timetable generated!');
              }
            }}
          >
            {step < maxSteps - 1 ? (
              <>Next <ChevronRight size={16} className="ml-1" /></>
            ) : (
              <><Sparkles size={16} className="mr-1" /> {t('timetable.finishSetup')}</>
            )}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Enhanced Timetable Grid ─────────────────────────────

function EnhancedTimetableGrid({
  blocks,
  onRemove,
  sleepStart,
  sleepEnd,
  constraints,
}: {
  blocks: StudyBlock[];
  onRemove: (id: string) => void;
  sleepStart: string;
  sleepEnd: string;
  constraints: Constraint[];
}) {
  const hourHeight = 60;
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate sleep overlay hours
  const [sh] = sleepStart.split(':').map(Number);
  const [eh] = sleepEnd.split(':').map(Number);
  const sleepHours: number[] = [];
  if (sh < eh) {
    for (let h = sh; h < eh; h++) sleepHours.push(h);
  } else {
    for (let h = sh; h < 24; h++) sleepHours.push(h);
    for (let h = 0; h < eh; h++) sleepHours.push(h);
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-8 border-b border-slate-700/50 sticky top-0 bg-slate-800/80 backdrop-blur z-10">
        <div className="p-2 text-xs text-slate-500 text-center border-r border-slate-700/50">
          Time
        </div>
        {DAY_NAMES_SHORT.map((day) => (
          <div
            key={day}
            className="p-2 text-xs font-semibold text-slate-400 text-center border-r border-slate-700/50 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Mobile scroll container */}
      <div className="overflow-x-auto" ref={gridRef}>
        <div className="min-w-[600px] md:min-w-full">
          <div className="grid grid-cols-8" style={{ minHeight: `${HOURS.length * hourHeight}px` }}>
            {/* Time labels (sticky on mobile) */}
            <div className="border-r border-slate-700/50 sticky left-0 bg-slate-800/60 z-[5]">
              {HOURS.map((hour) => {
                const [h] = hour.split(':').map(Number);
                const isSleep = sleepHours.includes(h);
                return (
                  <div
                    key={hour}
                    className={cn(
                      'text-[10px] px-2 py-1 border-b border-slate-700/20',
                      isSleep ? 'bg-slate-900/60 text-slate-600' : 'text-slate-600'
                    )}
                    style={{ height: hourHeight }}
                  >
                    {hour}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAY_NAMES_SHORT.map((_, dayIndex) => {
              const dayBlocks = blocks.filter((b) => b.day === dayIndex);
              const dayConstraints = constraints.filter((c) => c.day === dayIndex);

              return (
                <div
                  key={dayIndex}
                  className="relative border-r border-slate-700/50 last:border-r-0"
                >
                  {/* Hour grid lines with sleep overlay */}
                  {HOURS.map((hour, i) => {
                    const [h] = hour.split(':').map(Number);
                    const isSleep = sleepHours.includes(h);
                    return (
                      <div
                        key={i}
                        className={cn(
                          'border-b border-slate-700/20',
                          isSleep && 'bg-slate-900/70 backdrop-blur-[2px]'
                        )}
                        style={{ height: hourHeight }}
                      >
                        {isSleep && (
                          <div className="flex items-center justify-center h-full">
                            <Moon size={12} className="text-slate-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Constraint overlays */}
                  {dayConstraints.map((c) => {
                    const top = timeToRow(c.start);
                    const height = durationToSpan(c.start, c.end);
                    return (
                      <div
                        key={c.id}
                        className="absolute left-0 right-0 bg-slate-700/40 border border-dashed border-slate-600/50 rounded px-2 flex items-center justify-center pointer-events-none z-[2]"
                        style={{ top, height: Math.max(height, 24) }}
                      >
                        <span className="text-[9px] text-slate-500 truncate">{c.label}</span>
                      </div>
                    );
                  })}

                  {/* Study blocks */}
                  {dayBlocks.map((block) => {
                    const top = timeToRow(block.start);
                    const height = durationToSpan(block.start, block.end);
                    const isSpeed = block.isSpeedDrill;
                    const isBuffer = block.isBufferDay;

                    return (
                      <div
                        key={block.id}
                        className={cn(
                          'absolute left-1 right-1 rounded-lg px-2 py-1 text-xs group overflow-hidden z-[3] transition-all cursor-pointer hover:scale-[1.02] hover:z-[4]',
                          isBuffer && 'border-dashed opacity-70'
                        )}
                        style={{
                          top,
                          height: Math.max(height, 30),
                          backgroundColor: isBuffer ? 'transparent' : `${block.color}30`,
                          border: isBuffer
                            ? `2px dashed ${block.color}50`
                            : `1px solid ${block.color}40`,
                        }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} className="text-white/70" />
                        </button>
                        <p className="text-white font-medium text-[10px] truncate">
                          {block.subject}
                        </p>
                        <p className="text-white/60 text-[9px]">
                          {block.start} - {block.end}
                        </p>
                        {/* Brain region badge */}
                        <div className="absolute bottom-1 left-1 flex gap-1">
                          <span
                            className="text-[8px] px-1 rounded"
                            style={{
                              backgroundColor: BRAIN_REGION_COLORS[block.brainRegion] + '30',
                              color: BRAIN_REGION_COLORS[block.brainRegion],
                            }}
                          >
                            {block.brainRegion.slice(0, 3)}
                          </span>
                          {isSpeed && (
                            <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-400">
                              <Zap size={8} className="inline mr-0.5" />Drill
                            </span>
                          )}
                          {isBuffer && (
                            <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-400">
                              <Coffee size={8} className="inline mr-0.5" />Rest
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Self-Tuning Indicator ───────────────────────────────

function SelfTuningIndicator({ completionRate }: { completionRate: number }) {
  const { t } = useTranslation();
  const action = completionRate < 50
    ? 'scaling down 15%'
    : completionRate < 70
    ? 'scaling down 10%'
    : completionRate < 85
    ? 'maintaining current load'
    : 'scaling up 5%';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 size={14} className="text-indigo-400" />
          {t('timetable.selfTuning')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <p className="text-xs text-slate-300">
            {t('timetable.completionRate', { rate: completionRate, action })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main TimetablePage ──────────────────────────────────

export default function TimetablePage() {
  const { t } = useTranslation();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);
  const [saturation, setSaturation] = useState(25);
  const [currentPhase, setCurrentPhase] = useState<Phase>(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [completionRate] = useState(65);
  const [newSubject, setNewSubject] = useState('');
  const [newStart, setNewStart] = useState('14:00');
  const [newEnd, setNewEnd] = useState('16:00');
  const [newDay, setNewDay] = useState(0);
  const [newBrainRegion, setNewBrainRegion] = useState<BrainRegion>('science');
  const [newIsSpeedDrill, setNewIsSpeedDrill] = useState(false);

  const sleepStart = onboardingData?.sleepStart || '01:00';
  const sleepEnd = onboardingData?.sleepEnd || '10:00';
  const constraints = onboardingData?.constraints || [];

  const handleOnboardingComplete = (data: OnboardingData) => {
    setOnboardingData(data);
    setShowOnboarding(false);

    // Generate blocks based on onboarding data
    const generated: StudyBlock[] = [];
    const colors = [...COLORS];
    data.subjects.filter(s => s.name).forEach((sub, idx) => {
      const weekDays = [0, 1, 2, 3, 4];
      const weekendDays = [5, 6];
      const color = colors[idx % colors.length];
      const sessionLength = sub.weakness <= 2 ? 120 : sub.weakness <= 3 ? 90 : 60;

      // Weekday sessions
      const peakSlot = data.peakWeekday;
      const peakStartMap: Record<FocusSlot, string> = {
        morning: '08:00', afternoon: '14:00', evening: '18:00', late_night: '21:00',
      };

      weekDays.forEach((day) => {
        const startH = parseInt(peakStartMap[peakSlot].split(':')[0]);
        if (!isSleepTime(peakStartMap[peakSlot], data.sleepStart, data.sleepEnd)) {
          generated.push({
            id: `${sub.name}-w${day}`,
            subject: sub.name,
            day,
            start: peakStartMap[peakSlot],
            end: `${String(startH + Math.floor(sessionLength / 60)).padStart(2, '0')}:${String((sessionLength % 60)).padStart(2, '0')}`,
            color,
            brainRegion: sub.brainRegion,
            isSpeedDrill: sub.weakness >= 4,
            isBufferDay: false,
          });
        }
      });

      // Weekend sessions
      const weekendPeakMap: Record<FocusSlot, string> = {
        morning: '09:00', afternoon: '14:00', evening: '17:00', late_night: '20:00',
      };
      weekendDays.forEach((day) => {
        generated.push({
          id: `${sub.name}-we${day}`,
          subject: sub.name,
          day,
          start: weekendPeakMap[data.peakWeekend],
          end: `${String(parseInt(weekendPeakMap[data.peakWeekend].split(':')[0]) + Math.floor(sessionLength / 60)).padStart(2, '0')}:${String((sessionLength % 60)).padStart(2, '0')}`,
          color,
          brainRegion: sub.brainRegion,
          isSpeedDrill: false,
          isBufferDay: false,
        });
      });
    });

    // Add buffer day (rest day) — day 5 (Saturday) or 6 (Sunday) as a rest day
    const bufferDay = 5;
    [0, 1, 2, 3].forEach((idx) => {
      const sub = data.subjects[idx % data.subjects.length];
      if (sub && sub.name) {
        generated.push({
          id: `buffer-${idx}`,
          subject: sub.name,
          day: bufferDay,
          start: `${10 + idx * 2}:00`,
          end: `${10 + idx * 2 + 1}:00`,
          color: COLORS[idx % COLORS.length],
          brainRegion: sub.brainRegion,
          isSpeedDrill: false,
          isBufferDay: true,
        });
      }
    });

    setBlocks(generated);
    setSaturation(25);
    setCurrentPhase(1);
  };

  const addBlock = () => {
    if (!newSubject.trim()) return;
    const startH = parseInt(newStart.split(':')[0]);
    if (isSleepTime(newStart, sleepStart, sleepEnd)) {
      toast.error('Cannot add blocks during sleep hours');
      return;
    }
    setBlocks([
      ...blocks,
      {
        id: Date.now().toString(),
        subject: newSubject,
        day: newDay,
        start: newStart,
        end: newEnd,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        brainRegion: newBrainRegion,
        isSpeedDrill: newIsSpeedDrill,
        isBufferDay: false,
      },
    ]);
    setNewSubject('');
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleOptimize = () => {
    setIsOptimizing(true);
    const phases: Phase[] = [1, 2, 3, 4, 5, 6];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= phases.length) {
        clearInterval(interval);
        setIsOptimizing(false);
        toast.success('AI optimization complete!');
        return;
      }
      const phase = phases[idx];
      const range = PHASE_SATURATION[phase];
      setCurrentPhase(phase);
      setSaturation(Math.floor(range.min + (range.max - range.min) * (idx / (phases.length - 1))));
      idx++;
    }, 800);
  };

  if (showOnboarding) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('timetable.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Phase {currentPhase}: {t(`timetable.phaseLabels.${currentPhase}`)} · {saturation}% Saturation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowOnboarding(true)}>
            <Settings2 size={14} className="mr-1" /> Reconfigure
          </Button>
          <Button onClick={handleOptimize} disabled={isOptimizing}>
            {isOptimizing ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> {t('timetable.optimizing')}</>
            ) : (
              <><Wand2 size={16} className="mr-2" /> {t('timetable.aiOptimize')}</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <SaturationMeter level={saturation} phase={currentPhase} />
          <PhaseCurve phase={currentPhase} saturation={saturation} />
          <SelfTuningIndicator completionRate={completionRate} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('timetable.addBlock')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder={t('timetable.subject') || ''}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">{t('timetable.brainRegion')}</p>
                <Select value={newBrainRegion} onValueChange={(v: BrainRegion) => setNewBrainRegion(v)}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BRAIN_REGION_LABELS) as BrainRegion[]).map((br) => (
                      <SelectItem key={br} value={br}>{t(`timetable.brainRegions.${br}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                {DAY_NAMES_SHORT.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => setNewDay(i)}
                    className={cn(
                      'flex-1 py-1 text-xs rounded-lg transition-colors',
                      newDay === i
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    {day.slice(0, 1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newIsSpeedDrill} onCheckedChange={setNewIsSpeedDrill} id="speed-drill" />
                <label htmlFor="speed-drill" className="text-xs text-slate-400 flex items-center gap-1">
                  <Zap size={12} className="text-amber-400" />
                  {t('timetable.speedDrill')}
                </label>
              </div>
              <Button onClick={addBlock} className="w-full" size="sm">
                <Plus size={14} className="mr-1" /> Add Block
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Moon size={14} className="text-indigo-400" />
                {t('timetable.sleepProtection')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                Sleep: {sleepStart} – {sleepEnd} (gray overlay)
              </p>
              <p className="text-xs text-slate-500 mt-1">{t('timetable.sleepProtectionDesc')}</p>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Brain Regions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(Object.entries(BRAIN_REGION_COLORS) as [BrainRegion, string][]).map(([region, color]) => (
                <div key={region} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-300">{t(`timetable.brainRegions.${region}`)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main grid */}
        <div className="lg:col-span-3">
          <EnhancedTimetableGrid
            blocks={blocks}
            onRemove={removeBlock}
            sleepStart={sleepStart}
            sleepEnd={sleepEnd}
            constraints={constraints}
          />
          {blocks.length === 0 && (
            <p className="text-center text-slate-500 text-sm mt-4">{t('timetable.empty')}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
