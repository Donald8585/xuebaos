import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Plus, BookOpen } from 'lucide-react';
import { useStories } from '@/hooks/useApi';
import { StoryCard } from '@/components/mnemonic/StoryCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function StoryList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stories, isLoading } = useStories();
  const [search, setSearch] = useState('');

  const filtered = stories?.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('story.list.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{stories?.length || 0} stories</p>
        </div>
        <Button onClick={() => navigate('/stories/generate')}>
          <Plus size={16} className="mr-2" />
          {t('nav.generateStory')}
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('story.list.search') || ''}
        icon={<Search size={16} />}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((story, i) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <StoryCard story={story} />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-sm mb-2">{t('story.list.empty')}</p>
          <p className="text-slate-500 text-xs mb-4">{t('story.list.emptyDesc')}</p>
          <Button onClick={() => navigate('/stories/generate')}>
            {t('story.list.generateFirst')}
          </Button>
        </Card>
      )}
    </motion.div>
  );
}
