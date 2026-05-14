import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Plus, Building2 } from 'lucide-react';
import { usePalaces } from '@/hooks/useApi';
import { PalaceCard } from '@/components/palace/PalaceCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function PalaceList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: palaces, isLoading } = usePalaces();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const filtered = palaces?.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'lastStudied': return (b.last_studied_at ? new Date(b.last_studied_at).getTime() : 0) - (a.last_studied_at ? new Date(a.last_studied_at).getTime() : 0);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('palace.list.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {palaces?.length || 0} {t('palace.list.loci')}
          </p>
        </div>
        <Button onClick={() => navigate('/palaces/build')}>
          <Plus size={16} className="mr-2" />
          {t('nav.buildPalace')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('palace.list.search') || ''}
            icon={<Search size={16} />}
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SlidersHorizontal size={14} className="mr-2" />
            <SelectValue placeholder={t('palace.list.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t('palace.list.newest')}</SelectItem>
            <SelectItem value="oldest">{t('palace.list.oldest')}</SelectItem>
            <SelectItem value="lastStudied">{t('palace.list.lastStudied')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((palace, i) => (
            <motion.div
              key={palace.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <PalaceCard palace={palace} />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-sm mb-2">{t('palace.list.empty')}</p>
          <p className="text-slate-500 text-xs mb-4">{t('palace.list.emptyDesc')}</p>
          <Button onClick={() => navigate('/palaces/build')}>
            {t('palace.list.buildFirst')}
          </Button>
        </Card>
      )}
    </motion.div>
  );
}
