import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, TrendingUp, Target, Clock, Flame, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const recallData = [
  { day: 'Day 1', recall: 95, target: 90 },
  { day: 'Day 3', recall: 85, target: 85 },
  { day: 'Day 7', recall: 78, target: 80 },
  { day: 'Day 14', recall: 70, target: 75 },
  { day: 'Day 30', recall: 65, target: 70 },
  { day: 'Day 60', recall: 62, target: 65 },
];

const heatmapData = [
  { day: 'Mon', hours: 2.5 }, { day: 'Tue', hours: 1.8 },
  { day: 'Wed', hours: 3.2 }, { day: 'Thu', hours: 2.0 },
  { day: 'Fri', hours: 1.5 }, { day: 'Sat', hours: 4.0 },
  { day: 'Sun', hours: 3.5 },
];

const topicMastery = [
  { topic: 'Cell Biology', mastery: 85 },
  { topic: 'Genetics', mastery: 72 },
  { topic: 'Evolution', mastery: 65 },
  { topic: 'Ecology', mastery: 58 },
  { topic: 'Physiology', mastery: 78 },
  { topic: 'Biochemistry', mastery: 45 },
];

// GitHub-style streak calendar
function StreakCalendar() {
  const weeks = 20;
  const daysPerWeek = 7;
  const data = Array.from({ length: weeks * daysPerWeek }, () =>
    Math.floor(Math.random() * 5)
  );

  const colorMap = [
    'bg-slate-800',
    'bg-emerald-900',
    'bg-emerald-700',
    'bg-emerald-500',
    'bg-emerald-300',
  ];

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="flex flex-col gap-1">
          {Array.from({ length: daysPerWeek }, (_, d) => {
            const value = data[w * daysPerWeek + d] || 0;
            return (
              <div
                key={d}
                className={`w-3 h-3 rounded-sm ${colorMap[value]}`}
                title={`${value} sessions`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('thisWeek');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('analytics.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {(['thisWeek', 'thisMonth', 'allTime'] as const).map((p) => (
            <Badge
              key={p}
              variant={period === p ? 'default' : 'secondary'}
              className="cursor-pointer"
              onClick={() => setPeriod(p)}
            >
              {t(`analytics.${p}`)}
            </Badge>
          ))}
          <Button variant="outline" size="sm">
            <Download size={14} className="mr-1" /> {t('analytics.exportReport')}
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('analytics.sessions'), value: 47, icon: Zap, color: 'text-indigo-400' },
          { label: t('analytics.totalHours'), value: '32.5h', icon: Clock, color: 'text-violet-400' },
          { label: t('analytics.cardsReviewed'), value: 1280, icon: Target, color: 'text-emerald-400' },
          { label: t('analytics.avgAccuracy'), value: '78%', icon: TrendingUp, color: 'text-amber-400' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon size={20} className={stat.color} />
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Flame size={24} className="mx-auto text-amber-400 mb-2" />
          <p className="text-3xl font-bold text-white">12</p>
          <p className="text-xs text-slate-400">{t('analytics.currentStreak')}</p>
        </Card>
        <Card className="p-4 text-center">
          <Flame size={24} className="mx-auto text-rose-400 mb-2" />
          <p className="text-3xl font-bold text-white">28</p>
          <p className="text-xs text-slate-400">{t('analytics.longestStreak')}</p>
        </Card>
        <Card className="p-4 text-center">
          <Target size={24} className="mx-auto text-indigo-400 mb-2" />
          <p className="text-3xl font-bold text-white">85%</p>
          <p className="text-xs text-slate-400">{t('analytics.avgAccuracy')}</p>
        </Card>
      </div>

      {/* FSRS Recall Curve */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.recallCurve')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recallData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '0.75rem', color: '#F8FAFC' }} />
                <Line type="monotone" dataKey="recall" stroke="#818CF8" strokeWidth={2} dot={{ fill: '#4F46E5', r: 4 }} name="Your Recall" />
                <Line type="monotone" dataKey="target" stroke="#10B981" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Target" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Study Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.studyHeatmap')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="day" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '0.75rem', color: '#F8FAFC' }} />
                  <Bar dataKey="hours" fill="#818CF8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Topic Mastery Radar */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.topicMastery')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={topicMastery}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="topic" stroke="#64748B" fontSize={10} />
                  <PolarRadiusAxis stroke="#64748B" fontSize={10} domain={[0, 100]} />
                  <Radar dataKey="mastery" stroke="#818CF8" fill="#818CF8" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streak Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.streakCalendar')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StreakCalendar />
        </CardContent>
      </Card>
    </motion.div>
  );
}
