import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Plus, Trash2, Copy, Check, Zap, Lightbulb, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

interface Abbreviation {
  id: string;
  short: string;
  full: string;
  concept: string;
}

const STARTER_SET: Abbreviation[] = [
  { id: '1', short: 'AR', full: 'Active Recall', concept: 'Testing yourself instead of re-reading. 2-3x more effective.' },
  { id: '2', short: 'SR', full: 'Spaced Repetition', concept: 'Review just before forgetting. FSRS optimizes intervals.' },
  { id: '3', short: 'MP', full: 'Memory Palace', concept: 'Spatial memory technique using familiar locations as loci.' },
  { id: '4', short: 'FT', full: 'Feynman Technique', concept: 'Explain it simply. If you can\'t, you don\'t understand it.' },
  { id: '5', short: '3PA', full: '3-Pass Annotation', concept: 'Skim → Deep Read → Synthesize. Progressive depth.' },
  { id: '6', short: 'IL', full: 'Interleaving', concept: 'Mix subjects. 43% better retention than blocking.' },
  { id: '7', short: 'CC', full: 'Concept Chains', concept: 'Link concepts causally. A→B→C triggers automatic recall.' },
  { id: '8', short: 'DC', full: 'Dual Coding', concept: 'Words + visuals. Two retrieval paths = stronger memory.' },
];

export default function AbbreviationTool() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Abbreviation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('xuebaos-abbreviations') || 'null') || STARTER_SET;
    } catch {
      return STARTER_SET;
    }
  });
  const [short, setShort] = useState('');
  const [full, setFull] = useState('');
  const [concept, setConcept] = useState('');

  const save = (newItems: Abbreviation[]) => {
    setItems(newItems);
    localStorage.setItem('xuebaos-abbreviations', JSON.stringify(newItems));
  };

  const add = () => {
    if (!short.trim() || !full.trim()) return;
    save([...items, { id: Date.now().toString(), short: short.trim().toUpperCase(), full: full.trim(), concept: concept.trim() }]);
    setShort(''); setFull(''); setConcept('');
    toast.success('Abbreviation added');
  };

  const remove = (id: string) => save(items.filter((i) => i.id !== id));

  const copyChain = () => {
    const chain = items.map((i) => i.short).join(' → ');
    navigator.clipboard.writeText(chain);
    toast.success('Chain copied!');
  };

  const chain = items.map((i) => i.short).join(' → ');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Link2 size={24} className="text-indigo-400" />
          Concept Abbreviations
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Build abbreviation chains for faster recall and clearer thinking
        </p>
      </div>

      {/* Chain View */}
      <Card className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border-indigo-500/20">
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-medium">RECALL CHAIN</p>
            <Button variant="ghost" size="sm" onClick={copyChain} className="text-xs">
              <Copy size={12} className="mr-1" /> Copy
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {items.map((item, i) => (
              <span key={item.id} className="flex items-center gap-1">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-sm font-bold">
                  {item.short}
                </span>
                {i < items.length - 1 && (
                  <span className="text-slate-600 text-xs">→</span>
                )}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add New */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus size={16} className="text-indigo-400" /> Add Abbreviation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={short}
              onChange={(e) => setShort(e.target.value)}
              placeholder="Short (e.g. AR)"
              className="sm:w-32 font-mono"
              maxLength={8}
            />
            <Input
              value={full}
              onChange={(e) => setFull(e.target.value)}
              placeholder="Full name (e.g. Active Recall)"
              className="flex-1"
            />
            <Button onClick={add} disabled={!short.trim() || !full.trim()} className="shrink-0">
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </div>
          <Input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Description / concept (optional)"
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        <p className="text-sm text-slate-400">{items.length} abbreviations</p>
        <AnimatePresence>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <Card className="hover:border-slate-600/50 transition-colors">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="font-mono font-bold text-indigo-400">{item.short}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white">{item.full}</p>
                      <Badge variant="secondary" className="text-[10px]">{i + 1}</Badge>
                    </div>
                    {item.concept && (
                      <p className="text-xs text-slate-400">{item.concept}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(item.id)} className="shrink-0 text-slate-600 hover:text-rose-400">
                    <Trash2 size={14} />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Usage Hint */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Lightbulb size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300 font-medium">How to use abbreviation chains</p>
              <p className="text-xs text-slate-400 mt-1">
                Memorize the chain: <code className="text-indigo-400">AR → SR → MP → FT</code>. Each abbreviation unlocks the full concept. Chain them causally to trigger automatic sequential recall during exams. Review the chain in 30 seconds before bed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
