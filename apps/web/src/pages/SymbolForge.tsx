import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MOCK_PROPOSALS = [
  {
    metaphor: 'Power Plant Generator',
    explanation: 'Mitochondria converts fuel (glucose) into usable energy (ATP), just like a power plant converts coal or gas into electricity that powers a city.',
  },
  {
    metaphor: 'Battery Charging Station',
    explanation: 'Think of mitochondria as millions of tiny battery chargers inside each cell, constantly recharging ADP into ATP batteries that power every cellular process.',
  },
  {
    metaphor: 'Kitchen Oven',
    explanation: 'Just as an oven transforms raw ingredients through controlled chemical reactions into edible food, mitochondria transform glucose through cellular respiration into ATP energy.',
  },
];

export default function SymbolForge() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [concept, setConcept] = useState('');
  const [isForging, setIsForging] = useState(false);
  const [proposals, setProposals] = useState<typeof MOCK_PROPOSALS | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleForge = () => {
    setIsForging(true);
    setTimeout(() => {
      setProposals(MOCK_PROPOSALS);
      setIsForging(false);
    }, 2500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/symbols')}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-white">{t('symbol.forge.title')}</h1>
      </div>

      {!proposals ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('symbol.forge.enterConcept')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={t('symbol.forge.conceptPlaceholder') || ''}
            />
            <Button
              onClick={handleForge}
              disabled={concept.trim().length < 5 || isForging}
              className="w-full sm:w-auto"
            >
              {isForging ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {t('symbol.forge.forging')}</>
              ) : (
                <><Sparkles size={16} className="mr-2" /> {t('symbol.forge.forge')}</>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('symbol.forge.proposals')}</CardTitle>
              <p className="text-sm text-slate-400">{t('symbol.forge.selectOne')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {proposals.map((proposal, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                      'text-left p-5 rounded-2xl border transition-all duration-200',
                      selectedIndex === i
                        ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                        : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-lg">
                        {['🔋', '⚡', '🔥'][i]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white text-sm">{proposal.metaphor}</h3>
                          {selectedIndex === i && (
                            <Badge variant="accent">Selected</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {proposal.explanation}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {selectedIndex !== null && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => navigate('/symbols')}>
                    <Save size={16} className="mr-2" />
                    {t('symbol.forge.saveToDictionary')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
