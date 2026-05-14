import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronDown, ChevronRight, CheckCircle2, Circle, Crown,
  Target, Zap, Brain, Shield, Heart, Lightbulb, Swords, Timer, Moon,
  Sparkles, Quote, Star, BookMarked, Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  content: string;
  founderQuote?: string;
  read: boolean;
}

interface Section {
  id: string;
  title: string;
  icon: typeof BookOpen;
  lessons: Lesson[];
}

// ─── Mock Codex Data ─────────────────────────────────────

const CODEX_SECTIONS: Section[] = [
  {
    id: 'mindset',
    title: 'Section A: Mindset',
    icon: Heart,
    lessons: [
      {
        id: 'a1',
        title: 'Principle 1: Growth Before Grades',
        content: "Your goal isn't the grade — it's mastery. When you focus on truly understanding, grades follow naturally. Every 學霸 was once a beginner who refused to quit. The growth mindset says: 'I can't do this YET.' The fixed mindset says: 'I can't do this.' The difference is one word — and it changes everything. 🐉",
        founderQuote: '"I didn\'t get 5* because I was smart. I got it because I was willing to fail more times than others were willing to try."',
        read: false,
      },
      {
        id: 'a2',
        title: 'Principle 2: Process Over Outcome',
        content: "Study gods obsess over their process — their study schedule, their recall methods, their sleep quality. Amateurs obsess over scores. The paradox: when you perfect your process, the scores take care of themselves. Track hours studied, not grades received.",
        founderQuote: '"Be technocratic in studying. Revise what works, ditch what doesn\'t work."',
        read: false,
      },
      {
        id: 'a3',
        title: 'Principle 3: The 學霸 Mentality',
        content: "學霸 (xueba) literally means 'study tyrant.' It's not about talent. It's about relentless optimization. Learn from every test. Copy study god methods. Mingle with study gods to absorb their mentality. Your study system should improve after every single exam.",
        read: false,
      },
      {
        id: 'a4',
        title: 'Principle 4: Embrace the Suck',
        content: "Active recall is hard. Spaced repetition is tedious. Memory palaces take effort to build. But this difficulty IS the learning. If studying feels easy, you're probably doing it wrong. The 學霸 leans into discomfort because they know that's where growth lives.",
        read: false,
      },
      {
        id: 'a5',
        title: 'Principle 5: Sleep Is a Weapon',
        content: "Sleep consolidates memory. During deep sleep, your hippocampus replays the day's learning 20x faster. Pull an all-nighter? You just sabotaged your memory consolidation. 學霸 protect their sleep like a dragon guards treasure. 7-9 hours, same time every night.",
        read: false,
      },
    ],
  },
  {
    id: 'tactics',
    title: 'Section B: 7 Tactics of Study Gods',
    icon: Swords,
    lessons: [
      {
        id: 'b1',
        title: 'Tactic 1: Active Recall Over Re-reading',
        content: "Re-reading is the #1 study illusion. It FEELS productive but yields minimal retention. Instead: close the book and write everything you remember. Grade yourself. Repeat. Active recall is 2-3x more effective than any passive method. This is non-negotiable.",
        read: false,
      },
      {
        id: 'b2',
        title: 'Tactic 2: Spaced Repetition (FSRS)',
        content: "Don't review everything every day. Use Free Spaced Repetition Scheduler (FSRS) to optimize review timing. Review just before you'd forget. Each review strengthens the memory and extends the interval. XueBaOS analytics track your personal forgetting curve.",
        read: false,
      },
      {
        id: 'b3',
        title: 'Tactic 3: Interleaving',
        content: "Don't study one subject for 3 hours straight. Mix them: 45min Math → 45min Biology → 45min Math. Interleaving feels harder but produces 43% better long-term retention. Your brain has to work harder to retrieve — and that difficulty IS the learning.",
        read: false,
      },
      {
        id: 'b4',
        title: 'Tactic 4: Dual Coding',
        content: 'Combine words AND visuals. Draw diagrams for concepts. Create mind maps. The Symbol Forge turns abstract ideas into visual symbols. Verbal + visual encoding creates two retrieval paths to the same memory — doubling your chance of recall.',
        read: false,
      },
      {
        id: 'b5',
        title: 'Tactic 5: Elaboration',
        content: "Don't just memorize facts — explain WHY. Connect new knowledge to what you already know. Ask: 'How does this relate to...?' 'Why does this work?' The Concept Chain tool visualizes these connections. Deeper processing = stronger memory.",
        read: false,
      },
      {
        id: 'b6',
        title: 'Tactic 6: Concrete Examples',
        content: 'Abstract concepts stick when anchored to concrete examples. For every theory, find 3 real-world applications. The Story Generator turns abstract facts into vivid narratives your brain naturally remembers. Stories are 22x more memorable than isolated facts.',
        read: false,
      },
      {
        id: 'b7',
        title: 'Tactic 7: The Protégé Effect',
        content: "Teach what you're learning. Explain it out loud as if to a 5-year-old (Feynman Technique). Record yourself with the Recall Arena's Feynman mode. If you can't explain it simply, you don't truly understand it. Teaching reveals gaps in your knowledge.",
        read: false,
      },
    ],
  },
  {
    id: 'threepass',
    title: 'Section C: 3-Pass Annotation Method',
    icon: Zap,
    lessons: [
      {
        id: 'c1',
        title: 'Pass 1: Scan & Highlight (5-10 min)',
        content: 'First pass is rapid scanning. Use the highlighter (red) to mark key terms, definitions, and formulas. Don\'t read deeply — you\'re building a map. Speed matters here. The Annotation Tool enforces this with Pass 1 highlighting mode.',
        founderQuote: '"Pass 1 is about breadth, not depth. You\'re a scout, not a scholar. Find the landmarks."',
        read: false,
      },
      {
        id: 'c2',
        title: 'Pass 2: Structure & Connect (15-20 min)',
        content: 'Second pass uses shapes: rectangles for main ideas, arrows for cause-effect, triangles for hierarchies, dotted lines for loose connections. You\'re building the skeleton. See how concepts relate to each other, not just what they are.',
        read: false,
      },
      {
        id: 'c3',
        title: 'Pass 3: Symbolize & Encode (10-15 min)',
        content: 'Third pass stamps memory symbols onto key points. Each symbol is a mnemonic hook. The Symbol Forge creates custom symbols for your concepts. This pass locks information into your memory palace — creating spatial + visual memory cues.',
        read: false,
      },
    ],
  },
  {
    id: 'timetableOS',
    title: 'Section D: The Timetable OS',
    icon: Timer,
    lessons: [
      {
        id: 'd1',
        title: 'The Saturation Principle',
        content: "Your study load should follow a curve: start at 25%, build to 40%→55%→70%→80%, then taper before exams. Never go 100% — that's burnout territory. The saturation curve visualization tracks where you are on this journey.",
        read: false,
      },
      {
        id: 'd2',
        title: 'Brain Region Rotation',
        content: "Rotate between brain regions: Language (pink), Science (green), Language-ish (amber), Math-ish (blue). Each region uses different neural circuits. Rotation prevents fatigue. Never schedule two math-ish subjects back to back.",
        read: false,
      },
      {
        id: 'd3',
        title: 'Sacred Sleep Window',
        content: "Your sleep window (e.g., 1am-10am) is SACRED. No study blocks. No exceptions. Sleep protection is not optional — it's the foundation of memory consolidation. The timetable grays out sleep hours and blocks any scheduling attempts.",
        read: false,
      },
      {
        id: 'd4',
        title: 'Buffer Days',
        content: 'Every 6th day is a buffer/rest day. Light review only. Your brain consolidates during rest. Buffer days prevent burnout and actually improve total output. Marathon runners don\'t sprint every day — neither should you.',
        read: false,
      },
      {
        id: 'd5',
        title: 'Speed Thinking Drills',
        content: 'During peak focus windows, insert 10-15 minute speed drills. Rapid-fire questions. Short time limits create urgency, which boosts adrenaline and encoding. The QBank speed drill mode is designed for this.',
        read: false,
      },
      {
        id: 'd6',
        title: 'Self-Tuning Algorithm',
        content: 'The system watches your completion rate. If you\'re hitting <65%, it scales down the load. If >85%, it scales up. Self-tuning prevents the two failure modes: quitting from overwhelm, and plateauing from underload.',
        read: false,
      },
    ],
  },
  {
    id: 'exam',
    title: 'Section E: Exam Protocol',
    icon: Shield,
    lessons: [
      {
        id: 'e1',
        title: 'T-7 Days: The Taper',
        content: "One week before the exam, reduce study load to 50%. Shift from learning new material to reviewing mastered content. This is NOT the time to learn new topics. Trust your preparation. Focus on confidence-building review.",
        read: false,
      },
      {
        id: 'e2',
        title: 'T-3 Days: Full Mock Under Exam Conditions',
        content: 'Simulate exam conditions exactly: same time of day, same duration, no phone, timed sections. This builds procedural memory — your brain learns the rhythm of the exam. Grade yourself brutally. Identify last weak spots.',
        read: false,
      },
      {
        id: 'e3',
        title: 'T-1 Day: Light Review + Visualization',
        content: "Walk through your memory palace. Skim your 3-pass annotations. Visualize yourself calmly answering questions. No new problems. Sleep early. Pack everything you need the night before. Reduce decision fatigue on exam day.",
        read: false,
      },
      {
        id: 'e4',
        title: 'Exam Morning Protocol',
        content: "Wake up at your normal time. Light breakfast (protein + complex carbs). Brief walk for blood flow. 5-minute meditation or breathing exercise. Arrive 30 min early. Do NOT discuss content with others — it triggers anxiety and second-guessing.",
        founderQuote: '"Exam day is EXECUTION day. All preparation is done. Trust your system."',
        read: false,
      },
      {
        id: 'e5',
        title: 'During the Exam: The 3-Sweep Method',
        content: "Sweep 1: Answer everything you know immediately (builds momentum). Sweep 2: Tackle medium-difficulty questions (main scoring zone). Sweep 3: Attempt hard questions (bonus points). Never get stuck — skip and return. Time management > perfection on one question.",
        read: false,
      },
    ],
  },
  {
    id: 'failure',
    title: 'Section F: Failure Recovery Protocol',
    icon: Heart,
    lessons: [
      {
        id: 'f1',
        title: 'The 24-Hour Rule',
        content: "After a bad result, give yourself exactly 24 hours to feel the emotions. Be angry. Be sad. Then MOVE ON. Wallowing beyond 24 hours is self-sabotage. 學霸 feel the pain, then transform it into fuel for improvement.",
        founderQuote: '"Every 5* student has a folder of failed tests. The difference is what they did after."',
        read: false,
      },
      {
        id: 'f2',
        title: 'The Method Audit (Mandatory After Every Failure)',
        content: "After every exam — especially bad ones — run the Technocratic Audit. What methods did you use? What was the ROI? The audit identifies exactly what to keep, drop, try, and learn from. Never fail the same way twice.",
        read: false,
      },
      {
        id: 'f3',
        title: 'Micro-Wins Recovery',
        content: 'After a confidence hit, stack small wins: 10min of easy questions you KNOW you can answer. One completed study session. One memory palace walkthrough. Each micro-win rebuilds self-efficacy. The streak tracker visualizes your comeback.',
        read: false,
      },
    ],
  },
  {
    id: 'palace',
    title: 'Section G: Memory Palace Masterclass',
    icon: Brain,
    lessons: [
      {
        id: 'g1',
        title: 'Choosing Your Palace',
        content: 'Pick spaces you know intimately. Childhood home, school campus, favorite game map. The more vivid your spatial memory, the stronger the palace. Walk through it mentally right now — can you see every room? If yes, it\'s a good palace.',
        read: false,
      },
      {
        id: 'g2',
        title: 'Loci Placement Rules',
        content: 'Each locus stores ONE concept. Place them along a natural walking path. Make them bizarre, vivid, emotional. A giant mitochondria crushing a classroom is more memorable than a diagram. Exaggeration = retention.',
        read: false,
      },
      {
        id: 'g3',
        title: 'The Symbol Connection',
        content: "Every locus pairs with a visual symbol from the Symbol Forge. The symbol is the retrieval cue. When you walk through your palace and see the symbol, the concept floods back. Symbol + Location = Unbreakable Memory.",
        read: false,
      },
      {
        id: 'g4',
        title: 'Walkthrough Protocol',
        content: "Walk daily for the first week, then follow FSRS intervals. Each walkthrough: close your eyes, mentally navigate, recall each locus. Mark what you remembered and forgot. Focus extra walks on weak loci. The Palace Walkthrough tool tracks everything.",
        read: false,
      },
      {
        id: 'g5',
        title: 'Palace Stacking',
        content: 'One palace per subject. Don\'t mix biology and physics in the same palace — interference kills recall. Build separate palaces for each major topic. The Palace List shows all your palaces at a glance.',
        read: false,
      },
    ],
  },
];

const DAILY_MINDSETS = [
  { quote: '"The master has failed more times than the beginner has even tried."', principle: 'Embrace failure as data' },
  { quote: '"Your study system should be better today than it was yesterday."', principle: 'Continuous improvement' },
  { quote: '"Sleep is not a break from studying. Sleep IS studying."', principle: 'Protect your sleep window' },
  { quote: '"Active recall is hard. That\'s the point."', principle: 'Difficulty = learning' },
  { quote: '"Copy study god methods. Mingle with study gods."', principle: 'Learn from the best' },
  { quote: '"Be technocratic in studying. Revise what works, ditch what doesn\'t."', principle: 'System over feelings' },
  { quote: '"Grades are a lagging indicator. Your process is the leading indicator."', principle: 'Process over outcome' },
];

// ─── Main XuebaCodex ─────────────────────────────────────

export default function XuebaCodex() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<Section[]>(CODEX_SECTIONS);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [dailyMindset] = useState(DAILY_MINDSETS[Math.floor(Math.random() * DAILY_MINDSETS.length)]);

  const totalLessons = sections.reduce((sum, s) => sum + s.lessons.length, 0);
  const readLessons = sections.reduce(
    (sum, s) => sum + s.lessons.filter((l) => l.read).length,
    0
  );
  const progress = Math.round((readLessons / totalLessons) * 100);

  const toggleRead = (sectionId: string, lessonId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lessons: s.lessons.map((l) =>
            l.id === lessonId ? { ...l, read: !l.read } : l
          ),
        };
      })
    );
    toast.success(readLessons + 1 >= totalLessons ? '🎉 All lessons complete!' : 'Marked as read!');
  };

  const toggleExpand = (lessonId: string) => {
    setExpandedLesson(expandedLesson === lessonId ? null : lessonId);
  };

  const sectionIcons: Record<string, typeof BookOpen> = {
    mindset: Heart,
    tactics: Swords,
    threepass: Zap,
    timetableOS: Timer,
    exam: Shield,
    failure: Heart,
    palace: Brain,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookMarked size={24} className="text-indigo-400" />
          {t('codex.title')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{t('codex.subtitle')}</p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">{t('codex.progress')}</span>
            <span className="text-sm font-bold text-white">
              {readLessons}/{totalLessons} {t('codex.lessons')} ({progress}% {t('codex.completed')})
            </span>
          </div>
          <Progress value={progress} variant={progress === 100 ? 'success' : 'default'} />
        </CardContent>
      </Card>

      {/* Daily Mindset */}
      <Card className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border-indigo-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Quote size={20} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-indigo-400 font-medium mb-1">{t('codex.dailyMindset')}</p>
              <p className="text-sm text-white italic">🐉 {dailyMindset.quote}</p>
              <p className="text-xs text-indigo-300 mt-1">{dailyMindset.principle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Tabs */}
      <Tabs defaultValue="mindset">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {sections.map((section) => {
            const SectionIcon = sectionIcons[section.id] || BookOpen;
            const sectionRead = section.lessons.filter((l) => l.read).length;
            const sectionTotal = section.lessons.length;
            return (
              <TabsTrigger key={section.id} value={section.id} className="text-xs">
                <SectionIcon size={12} className="mr-1" />
                {t(`codex.section${section.id.charAt(0).toUpperCase()}`).slice(0, 12)}
                {sectionRead === sectionTotal && sectionTotal > 0 && (
                  <CheckCircle2 size={10} className="ml-1 text-emerald-400" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {sections.map((section) => {
          const SectionIcon = sectionIcons[section.id] || BookOpen;
          return (
            <TabsContent key={section.id} value={section.id}>
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <SectionIcon size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {section.lessons.filter((l) => l.read).length}/{section.lessons.length}
                  </Badge>
                </div>

                {section.lessons.map((lesson, idx) => {
                  const isExpanded = expandedLesson === lesson.id;
                  return (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={cn(
                        'transition-all',
                        lesson.read && 'border-emerald-500/20 bg-emerald-500/5'
                      )}>
                        <button
                          className="w-full text-left p-4 flex items-start gap-3"
                          onClick={() => toggleExpand(lesson.id)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRead(section.id, lesson.id);
                            }}
                            className="shrink-0 mt-0.5"
                          >
                            {lesson.read ? (
                              <CheckCircle2 size={18} className="text-emerald-400" />
                            ) : (
                              <Circle size={18} className="text-slate-600" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-sm font-medium transition-colors',
                              lesson.read ? 'text-emerald-300' : 'text-white'
                            )}>
                              {lesson.title}
                            </p>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                                    {lesson.content}
                                  </p>
                                  {lesson.founderQuote && (
                                    <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                      <div className="flex items-start gap-2">
                                        <Crown size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                                        <div>
                                          <p className="text-xs text-indigo-400 font-medium mb-1">
                                            🐉 {t('codex.founderQuote')}
                                          </p>
                                          <p className="text-sm text-indigo-200 italic">
                                            {lesson.founderQuote}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className={cn(
                            'transition-transform shrink-0',
                            isExpanded && 'rotate-90'
                          )}>
                            <ChevronRight size={16} className="text-slate-500" />
                          </div>
                        </button>
                        {!isExpanded && (
                          <div className="px-4 pb-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRead(section.id, lesson.id);
                              }}
                            >
                              {lesson.read ? (
                                <><Circle size={12} className="mr-1" /> Unmark</>
                              ) : (
                                <><CheckCircle2 size={12} className="mr-1" /> {t('codex.markRead')}</>
                              )}
                            </Button>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Completion celebration */}
      {progress === 100 && (
        <Card className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-500/20">
          <CardContent className="py-6 text-center">
            <Trophy size={48} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-lg font-bold text-white mb-1">🏆 {t('codex.allRead')}</p>
            <p className="text-sm text-slate-400">
              You've absorbed the complete 學霸 operating manual. Now go execute. 🐉
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
