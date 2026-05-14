import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Plus, Sparkles } from 'lucide-react';
import { useSymbols } from '@/hooks/useApi';
import { SymbolCard } from '@/components/symbol/SymbolCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SymbolDictionary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: symbols, isLoading } = useSymbols();
  const [search, setSearch] = useState('');

  const filtered = symbols?.filter((s) =>
    s.concept.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('symbol.dictionary.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{symbols?.length || 0} symbols</p>
        </div>
        <Button onClick={() => navigate('/symbols/forge')}>
          <Plus size={16} className="mr-2" />
          {t('nav.forgeSymbol')}
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('symbol.dictionary.search') || ''}
        icon={<Search size={16} />}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((symbol, i) => (
            <motion.div
              key={symbol.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <SymbolCard symbol={symbol} />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Sparkles size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-sm mb-2">{t('symbol.dictionary.empty')}</p>
          <p className="text-slate-500 text-xs mb-4">{t('symbol.dictionary.emptyDesc')}</p>
          <Button onClick={() => navigate('/symbols/forge')}>
            {t('symbol.dictionary.forgeFirst')}
          </Button>
        </Card>
      )}
    </motion.div>
  );
}
