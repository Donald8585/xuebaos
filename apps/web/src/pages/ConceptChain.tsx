import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Sparkles, Loader2, Save, ChevronRight, ArrowRight,
  AlertTriangle, Lightbulb, BookOpen, Brain, Trash2, Building2,
  ExternalLink, Plus, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

interface ChainNode {
  id: string;
  type: 'problem' | 'mechanism' | 'example' | 'examTrap' | 'linkedConcept';
  label: string;
  content: string;
}

interface ConceptChain {
  id: string;
  topic: string;
  nodes: ChainNode[];
  createdAt: string;
  linkedPalaces?: { id: string; name: string }[];
}

// ─── Node Config ─────────────────────────────────────────

const NODE_CONFIG: Record<ChainNode['type'], { icon: typeof Brain; color: string; label: string }> = {
  problem: { icon: AlertTriangle, color: '#EF4444', label: 'Problem' },
  mechanism: { icon: Brain, color: '#3B82F6', label: 'Mechanism' },
  example: { icon: Lightbulb, color: '#F59E0B', label: 'Examples' },
  examTrap: { icon: AlertTriangle, color: '#EC4899', label: 'Exam Traps' },
  linkedConcept: { icon: Link2, color: '#8B5CF6', label: 'Linked Concepts' },
};

// ─── Mock Generation ─────────────────────────────────────

function generateMockChain(topic: string): ConceptChain {
  const nodes: ChainNode[] = [
    {
      id: '1',
      type: 'problem',
      label: 'Problem',
      content: `Cells need a constant supply of energy to perform functions like active transport, protein synthesis, and cell division. Without efficient energy conversion, life processes would halt. The challenge: how does the cell convert chemical energy from food into a usable form?`,
    },
    {
      id: '2',
      type: 'mechanism',
      label: 'Mechanism',
      content: `Mitochondria use oxidative phosphorylation: 1) Glycolysis in cytoplasm breaks glucose into pyruvate (net 2 ATP). 2) Pyruvate enters mitochondria → Krebs Cycle in matrix → produces NADH & FADH₂. 3) ETC on inner membrane passes electrons → proton gradient. 4) ATP synthase uses gradient → ~34 ATP. Total: ~36-38 ATP per glucose.`,
    },
    {
      id: '3',
      type: 'example',
      label: 'Examples',
      content: `• Muscle cells: Packed with mitochondria for sustained contraction\n• Brown fat cells: Use uncoupling protein (UCP1) to generate heat instead of ATP\n• Red blood cells: No mitochondria — rely on anaerobic glycolysis only\n• Cancer cells: Warburg effect — prefer glycolysis even with O₂ present`,
    },
    {
      id: '4',
      type: 'examTrap',
      label: 'Exam Traps',
      content: `⚠️ TRAP 1: "Mitochondria produce ATP" — technically they produce the proton gradient; ATP synthase makes the ATP.\n⚠️ TRAP 2: Glycolysis produces 4 ATP gross but 2 ATP net (2 used in investment phase).\n⚠️ TRAP 3: NADH from glycolysis cannot directly enter mitochondria; uses glycerol-3-phosphate shuttle or malate-aspartate shuttle.\n⚠️ TRAP 4: Plants have mitochondria too — they do cellular respiration at night!`,
    },
    {
      id: '5',
      type: 'linkedConcept',
      label: 'Linked Concepts',
      content: `• Chemiosmosis in chloroplasts (photosynthesis — analogous gradient mechanism)\n• Aerobic vs anaerobic respiration (lactate/ethanol fermentation)\n• Enzyme kinetics (hexokinase, PFK-1 regulation)\n• Metabolic pathways integration (β-oxidation of fatty acids → acetyl-CoA)`,
    },
  ];

  return {
    id: Date.now().toString(),
    topic,
    nodes,
    createdAt: new Date().toISOString(),
    linkedPalaces: [
      { id: 'p1', name: 'Cell Biology Palace' },
      { id: 'p2', name: 'Metabolism Overview' },
    ],
  };
}

// ─── Chain Node Card ─────────────────────────────────────

function ChainNodeCard({
  node,
  index,
  total,
}: {
  node: ChainNode;
  index: number;
  total: number;
}) {
  const config = NODE_CONFIG[node.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.15 }}
      className="relative"
    >
      {/* Connector line */}
      {index < total - 1 && (
        <div className="absolute left-[25px] top-full h-8 w-0.5 bg-gradient-to-b from-indigo-500 to-transparent" />
      )}

      <div className="flex gap-3">
        {/* Node indicator */}
        <div
          className="w-[50px] h-[50px] shrink-0 rounded-xl flex items-center justify-center shadow-lg"
          style={{ backgroundColor: config.color + '20', border: `2px solid ${config.color}40` }}
        >
          <Icon size={20} style={{ color: config.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="default"
              style={{ backgroundColor: config.color + '20', color: config.color, borderColor: config.color + '30' }}
            >
              {config.label}
            </Badge>
            {node.type === 'linkedConcept' && (
              <Badge variant="secondary" className="text-[10px]">
                <Building2 size={10} className="mr-1" /> Palace Links
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-line">{node.content}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ConceptChain ───────────────────────────────────

export default function ConceptChain() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChain, setCurrentChain] = useState<ConceptChain | null>(null);
  const [savedChains, setSavedChains] = useState<ConceptChain[]>([]);

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error('Enter a topic first!');
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      const chain = generateMockChain(topic);
      setCurrentChain(chain);
      setIsGenerating(false);
      toast.success('Concept chain generated!');
    }, 2500);
  };

  const handleSave = () => {
    if (!currentChain) return;
    setSavedChains([currentChain, ...savedChains]);
    toast.success('Chain saved for review!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('conceptChain.title')}</h1>
        <p className="text-sm text-slate-400 mt-1">Visualize how concepts connect and flow</p>
      </div>

      {/* Input Area */}
      <Card>
        <CardHeader>
          <CardTitle>{t('conceptChain.pasteTopic')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('conceptChain.topicPlaceholder') || ''}
              className="flex-1"
            />
            <Button onClick={handleGenerate} disabled={isGenerating} className="shrink-0">
              {isGenerating ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {t('conceptChain.generating')}</>
              ) : (
                <><Sparkles size={16} className="mr-2" /> {t('conceptChain.generateChain')}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visual Flow */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 animate-pulse flex items-center justify-center">
                <Sparkles size={32} className="text-indigo-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-500 animate-ping" />
            </div>
            <p className="text-slate-400 text-sm">{t('conceptChain.generating')}</p>
          </motion.div>
        )}

        {currentChain && !isGenerating && (
          <motion.div
            key="chain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Chain Title */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  {currentChain.topic}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSave}>
                  <Save size={14} className="mr-1" /> {t('conceptChain.saveChain')}
                </Button>
              </div>
            </div>

            {/* Flow visualization header */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border border-indigo-500/20">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300">Problem</span>
                <ArrowRight size={12} />
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">Mechanism</span>
                <ArrowRight size={12} />
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">Examples</span>
                <ArrowRight size={12} />
                <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">Exam Traps</span>
                <ArrowRight size={12} />
                <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">Linked</span>
              </div>
            </div>

            {/* Nodes */}
            <div className="space-y-4">
              {currentChain.nodes.map((node, idx) => (
                <ChainNodeCard
                  key={node.id}
                  node={node}
                  index={idx}
                  total={currentChain.nodes.length}
                />
              ))}
            </div>

            {/* Linked Palaces */}
            {currentChain.linkedPalaces && currentChain.linkedPalaces.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 size={14} className="text-indigo-400" />
                    {t('conceptChain.connectedPalace')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {currentChain.linkedPalaces.map((palace) => (
                      <div
                        key={palace.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-colors"
                      >
                        <Building2 size={14} className="text-indigo-400" />
                        <span className="text-sm text-indigo-300">{palace.name}</span>
                        <ExternalLink size={12} className="text-indigo-500" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Chains */}
      {savedChains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen size={14} className="text-indigo-400" />
              {t('conceptChain.savedChains')} ({savedChains.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedChains.map((chain) => (
                <div
                  key={chain.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setCurrentChain(chain)}
                >
                  <Brain size={16} className="text-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{chain.topic}</p>
                    <p className="text-xs text-slate-500">
                      {chain.nodes.length} nodes · {new Date(chain.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!currentChain && !isGenerating && savedChains.length === 0 && (
        <div className="text-center py-16">
          <Link2 size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">{t('conceptChain.noChains')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('conceptChain.noChainsDesc')}</p>
        </div>
      )}
    </motion.div>
  );
}
