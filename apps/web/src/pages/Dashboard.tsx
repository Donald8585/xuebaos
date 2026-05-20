import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  BookOpen,
  Sparkles,
  Play,
  Flame,
  Target,
  Plus,
  Clock,
  TrendingUp,
  Crown,
  Beaker,
  CalendarClock,
  Lightbulb,
  BarChart3,
  AlertTriangle,
  Brain,
  Medal,
  Monitor,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePalaces, useStories, useStudyStats, useTimetable } from '@/hooks/useApi';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { formatDuration, formatRelativeDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PalaceWidget } from '@/components/os/PalaceWidget';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Rank Badge ──────────────────────────────────────────

type StudyRank = 'bronze' | 'silver' | 'gold' | 'diamond' | 'xueshen';

function RankDisplay({ rank }: { rank: StudyRank }) {
  const { t } = useTranslation();
  const config: Record<StudyRank, { emoji: string; color: string; textColor: string }> = {
    bronze: { emoji: '🥉', color: '#CD7F32', textColor: '#E8A87C' },
    silver: { emoji: '🥈', color: '#C0C0C0', textColor: '#D4D4D4' },
    gold: { emoji: '🥇', color: '#FFD700', textColor: '#FFED4A' },
    diamond: { emoji: '💎', color: '#B9F2FF', textColor: '#B9F2FF' },
    xueshen: { emoji: '🐉', color: '#818CF8', textColor: '#A5B4FC' },
  };
  const { emoji, color, textColor } = config[rank];

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
      style={{ backgroundColor: color + '20', border: `1px solid ${color}40`, color: textColor }}
    >
      <span>{emoji}</span>
      <span>{t(`dashboard.ranks.${rank}`)}</span>
    </div>
  );
}

// ─── Daily Principles ────────────────────────────────────

const DAILY_PRINCIPLES = [
  { quote: '"Sleep is not a break from studying. Sleep IS studying."', principle: 'Protect your sleep window' },
  { quote: '"Active recall is hard. That\'s the point."', principle: 'Difficulty = learning' },
  { quote: '"Be technocratic in studying. Revise what works, ditch what doesn\'t."', principle: 'System over feelings' },
  { quote: '"Copy study god methods. Mingle with study gods."', principle: 'Learn from the best' },
  { quote: '"Grades are a lagging indicator. Your process is the leading indicator."', principle: 'Process over outcome' },
  { quote: '"Every 5* student has a folder of failed tests."', principle: 'Failure is data' },
  { quote: '"The master has failed more times than the beginner has even tried."', principle: 'Embrace failure' },
];

// ─── Forgetting Curve Mini Chart ─────────────────────────

function ForgettingCurveMini() {
  const data = [
    { time: '0h', retention: 100 },
    { time: '1h', retention: 90 },
    { time: '1d', retention: 65 },
    { time: '2d', retention: 45 },
    { time: '7d', retention: 25 },
    { time: '30d', retention: 15 },
  ];

  const reviewData = [
    { time: '0h', retention: 100 },
    { time: '1d', retention: 95 },
    { time: '3d', retention: 88 },
    { time: '7d', retention: 80 },
    { time: '30d', retention: 72 },
    { time: '90d', retention: 65 },
  ];

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={[0, 100]} />
          <Line
            type="monotone"
            data={data}
            dataKey="retention"
            stroke="#EF4444"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Without Review"
          />
          <Line
            type="monotone"
            data={reviewData}
            dataKey="retention"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            name="With FSRS Review"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation();
  const { fullName } = useAuth();
  const { data: palaces, isLoading: palacesLoading } = usePalaces();
  const { data: stories, isLoading: storiesLoading } = useStories();
  const { data: stats, isLoading: statsLoading } = useStudyStats();
  const { data: timetable } = useTimetable();
  const navigate = useNavigate();

  const todayEntries: any[] = Array.isArray(timetable) ? timetable : (timetable as any)?.data || [];
  const todayTimetable = todayEntries.filter(
    (e: any) => e.day_of_week === new Date().getDay()
  );

  // Deterministic daily principle
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyPrinciple = DAILY_PRINCIPLES[dayOfYear % DAILY_PRINCIPLES.length];

  // Rank calculated from actual streak
  const rank: StudyRank = stats ? (
    stats.streak_days >= 30 ? 'xueshen' :
    stats.streak_days >= 21 ? 'diamond' :
    stats.streak_days >= 14 ? 'gold' :
    stats.streak_days >= 7 ? 'silver' : 'bronze'
  ) : 'bronze';

  // Audit days from real stats — only show if audits exist
  const daysSinceAudit = stats?.last_audit_at
    ? Math.floor((Date.now() - new Date(stats.last_audit_at).getTime()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t('dashboard.welcome')}, {fullName} 🐉
            </h1>
            <RankDisplay rank={rank} />
          </div>
          <p className="text-slate-400 mt-1">
            {statsLoading ? (
              <Skeleton className="h-4 w-48 inline-block" />
            ) : (
              <>
                <Flame size={16} className="inline text-amber-400 mr-1" />
                <span className="text-amber-400 font-semibold">{stats?.streak_days || 0}</span>{' '}
                {t('dashboard.streak')} 🔥
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => navigate('/codex')}>
            <Lightbulb size={16} className="mr-1" /> {t('dashboard.dailyPrinciple')}
          </Button>
          <Button size="sm" onClick={() => navigate('/palaces/build')}>
            <Plus size={16} className="mr-1" />
            {t('dashboard.buildPalace')}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('analytics.sessions'), value: stats?.total_sessions || 0, icon: Play, color: 'text-indigo-400' },
          { label: t('analytics.totalHours'), value: stats ? formatDuration(stats.total_duration_seconds) : '0m', icon: Clock, color: 'text-violet-400' },
          { label: t('analytics.cardsReviewed'), value: stats?.total_cards_reviewed || 0, icon: Target, color: 'text-emerald-400' },
          { label: t('analytics.avgAccuracy'), value: `${Math.round((stats?.average_accuracy || 0) * 100)}%`, icon: TrendingUp, color: 'text-amber-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Audit Reminder Banner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className={daysSinceAudit !== null && daysSinceAudit >= 3
              ? 'bg-amber-900/20 border-amber-500/20'
              : 'bg-indigo-900/20 border-indigo-500/20'
            }>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {daysSinceAudit !== null && daysSinceAudit >= 3 ? (
                      <AlertTriangle size={18} className="text-amber-400" />
                    ) : (
                      <Target size={18} className="text-indigo-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{
                        color: daysSinceAudit !== null && daysSinceAudit >= 3 ? '#fcd34d' : '#a5b4fc'
                      }}>
                        {daysSinceAudit !== null && daysSinceAudit >= 3
                          ? `${daysSinceAudit} ${t('dashboard.auditReminder')}`
                          : t('dashboard.runFirstAudit')
                        }
                      </p>
                      <p className="text-xs text-slate-400">{t('dashboard.auditReminderCTA')}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => navigate('/technocratic')}>
                    <Target size={14} className="mr-1" /> Audit Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Method Experiment Card */}
          <Card className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Beaker size={16} className="text-indigo-400" />
                {t('dashboard.todayMethod')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Beaker size={20} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Interleaved Practice</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Mix Biology + Chemistry in one session. 45min each, rotate. Research shows 43% better retention.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Principle */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-400" />
                {t('dashboard.dailyPrinciple')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Sparkles size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 italic">🐉 {dailyPrinciple.quote}</p>
                  <Badge variant="warning" className="mt-2">{dailyPrinciple.principle}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.quickActions')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('dashboard.buildPalace'), icon: Building2, path: '/palaces/build', color: 'from-indigo-500 to-blue-500' },
                { label: t('dashboard.createStory'), icon: BookOpen, path: '/stories/generate', color: 'from-violet-500 to-purple-500' },
                { label: t('dashboard.forgeSymbol'), icon: Sparkles, path: '/symbols/forge', color: 'from-amber-500 to-yellow-500' },
                { label: t('dashboard.startSession'), icon: Play, path: '/palaces', color: 'from-emerald-500 to-teal-500' },
              ].map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${action.color} bg-opacity-10 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 group`}
                >
                  <action.icon size={24} className="text-white group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-slate-300 text-center">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.weeklyActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.weekly_activity && stats.weekly_activity.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.weekly_activity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748B"
                        fontSize={12}
                        tickFormatter={(d: string) => {
                          const date = new Date(d);
                          return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                        }}
                      />
                      <YAxis stroke="#64748B" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: '#1E293B',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          color: '#F8FAFC',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke="#818CF8"
                        strokeWidth={2}
                        dot={{ fill: '#4F46E5', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">No activity data yet. Start studying!</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Palaces */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{t('dashboard.recentPalaces')}</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/palaces')}>
                {t('common.back')}
              </Button>
            </div>
            {palacesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : palaces && palaces.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {palaces.slice(0, 4).map((palace) => (
                  <motion.div
                    key={palace.id}
                    whileHover={{ scale: 1.02 }}
                    className="glass-hover p-4 cursor-pointer"
                    onClick={() => navigate(`/palaces/${palace.id}/walk`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Building2 size={20} className="text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{palace.title}</p>
                        <p className="text-xs text-slate-500">
                          {palace.loci_count} {t('palace.list.loci')}
                          {palace.last_studied_at && (
                            <> · {formatRelativeDate(palace.last_studied_at)}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Building2 size={32} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm mb-4">{t('dashboard.noPalaces')}</p>
                <Button size="sm" onClick={() => navigate('/palaces/build')}>
                  {t('palace.list.buildFirst')}
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Today's Target */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={18} className="text-rose-400" />
                {t('dashboard.todayTarget')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {statsLoading ? '...' : (stats?.total_cards_reviewed || 0)}
              </p>
              <p className="text-sm text-slate-400">{t('dashboard.cardsDue')}</p>
            </CardContent>
          </Card>

          {/* Saturation Level */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.upcomingTimetable')}</CardTitle>
            </CardHeader>
            <CardContent>
              {todayTimetable && todayTimetable.length > 0 ? (
                <div className="space-y-2">
                  {todayTimetable.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/30"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{entry.subject}</p>
                        <p className="text-xs text-slate-500">
                          {entry.start_time} - {entry.end_time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">{t('dashboard.noTimetable')}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3"
                onClick={() => navigate('/timetable')}
              >
                {t('nav.timetable')}
              </Button>
            </CardContent>
          </Card>

          {/* Forgetting Curve */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain size={16} className="text-indigo-400" />
                {t('dashboard.forgettingCurve')}
              </CardTitle>
              <CardDescription>FSRS-spaced reviews preserve memory</CardDescription>
            </CardHeader>
            <CardContent>
              <ForgettingCurveMini />
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-rose-400" style={{ borderStyle: 'dashed' }} />
                  <span className="text-rose-400">No Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-400" />
                  <span className="text-emerald-400">With FSRS</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Palace Widget */}
          <PalaceWidget
            palaceCount={palaces?.length || 0}
            anchorCount={stats?.total_cards_reviewed || 0}
            dueToday={stats?.cards_due_today || 0}
            mostReviewedPalace={palaces?.[0] ? {
              name: palaces[0].title,
              lociCount: palaces[0].loci_count || palaces[0].lociCount || 0,
            } : undefined}
            loading={palacesLoading || statsLoading}
            onLaunch={() => navigate('/desktop')}
          />

          {/* Saturation Level */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.saturation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress
                  value={stats?.saturation_level || 0}
                  className="flex-1"
                  variant={stats?.saturation_level && stats.saturation_level > 70 ? 'warning' : 'default'}
                />
                <span className="text-sm font-semibold text-white min-w-[3ch] text-right">
                  {stats?.saturation_level || 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Method Audit History Link */}
          <Card
            className="cursor-pointer hover:border-indigo-500/30 transition-all"
            onClick={() => navigate('/technocratic')}
          >
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <BarChart3 size={20} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t('dashboard.methodAuditHistory')}</p>
                  <p className="text-xs text-slate-400">
                    {daysSinceAudit !== null ? `${daysSinceAudit} ${t('dashboard.auditReminder')} · ` : ''}View all audits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Stories */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentStories')}</CardTitle>
            </CardHeader>
            <CardContent>
              {storiesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : stories && stories.length > 0 ? (
                <div className="space-y-2">
                  {stories.slice(0, 3).map((story) => (
                    <div
                      key={story.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/stories/${story.id}`)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <BookOpen size={14} className="text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{story.title}</p>
                        <p className="text-xs text-slate-500">{formatRelativeDate(story.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mb-3">{t('dashboard.noStories')}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3"
                onClick={() => navigate('/stories/generate')}
              >
                {t('story.list.generateFirst')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
