import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, School, Castle, Gamepad2, PenTool,
  ArrowLeft, ArrowRight, Wand2, Check, Loader2,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const templates = [
  { id: 'childhoodHome', icon: Home, color: 'from-blue-500 to-cyan-500' },
  { id: 'schoolCampus', icon: School, color: 'from-indigo-500 to-blue-600' },
  { id: 'dreamMansion', icon: Castle, color: 'from-violet-500 to-purple-600' },
  { id: 'gameMap', icon: Gamepad2, color: 'from-rose-500 to-pink-600' },
  { id: 'custom', icon: PenTool, color: 'from-amber-500 to-orange-600' },
];

const TOTAL_STEPS = 4;

interface Locus {
  concept: string;
  description: string;
  mnemonic: string;
}

export default function PalaceBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [palaceName, setPalaceName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loci, setLoci] = useState<Locus[]>([]);

  const canNext = () => {
    switch (step) {
      case 1: return !!template;
      case 2: return content.trim().length > 20 && !isGenerating;
      case 3: return loci.length > 0 && palaceName.trim().length > 0;
      default: return false;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const token = await getToken();
      const concepts = content
        .split(/[\n,.]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3)
        .slice(0, 50);

      const resp = await fetch('/api/ai/generate-palace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: subject || 'Study Material',
          concepts,
          count: Math.min(concepts.length, 30),
        }),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = await resp.json();
      const generatedLoci: Locus[] = (data.loci || []).map((l: any) => ({
        concept: l.concept || l.concept || '',
        description: l.description || l.locusName || '',
        mnemonic: l.association || '',
      }));

      if (generatedLoci.length === 0) throw new Error('No concepts extracted');

      setLoci(generatedLoci);
      setStep(3);
      toast.success(`Generated ${generatedLoci.length} memory loci!`);
    } catch (err) {
      toast.error(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await getToken();
      const resp = await fetch('/api/palaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: palaceName,
          description: description || `A ${template} memory palace`,
          subject: subject || undefined,
          lociCount: loci.length,
          tags: [template, subject].filter(Boolean),
        }),
      });

      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);

      toast.success('Palace saved!');
      navigate('/palaces');
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Try again'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/palaces')}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{t('palace.builder.title')}</h1>
          <Progress value={(step / TOTAL_STEPS) * 100} className="mt-2" />
        </div>
        <Badge>{step} / {TOTAL_STEPS}</Badge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          {/* Step 1: Template */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step1')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step1Desc')}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {templates.map((tpl) => {
                    const Icon = tpl.icon;
                    const isSelected = template === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => setTemplate(tpl.id)}
                        className={cn(
                          'flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-200',
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                        )}
                      >
                        <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center', tpl.color)}>
                          <Icon size={22} className="text-white" />
                        </div>
                        <span className="text-sm text-white font-medium">{t(`palace.builder.templates.${tpl.id}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Paste Content + AI Generate */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step2')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step2Desc')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (e.g., Biology, History, Chemistry)..."
                />
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your notes, textbook excerpts, or lecture content here..."
                  className="min-h-[250px]"
                />
                <Button onClick={handleGenerate} disabled={!canNext() || isGenerating} className="w-full sm:w-auto">
                  {isGenerating ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> {t('palace.builder.generating')}</>
                  ) : (
                    <><Wand2 size={16} className="mr-2" /> Generate Loci with AI</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review & Name */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Review Generated Loci</CardTitle>
                <p className="text-sm text-slate-400">AI extracted {loci.length} concepts from your content</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {loci.map((locus, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-400">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{locus.concept}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{locus.description}</p>
                        <p className="text-xs text-slate-500 mt-1 italic">💡 {locus.mnemonic}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Input
                  value={palaceName}
                  onChange={(e) => setPalaceName(e.target.value)}
                  placeholder="Name your memory palace..."
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description (optional)..."
                  className="min-h-[60px]"
                />
                <Button onClick={handleSave} disabled={!canNext() || isSaving} className="w-full sm:w-auto">
                  {isSaving ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Check size={16} className="mr-2" /> Save Palace</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}>
          <ArrowLeft size={16} className="mr-2" /> {t('common.back')}
        </Button>
        {step === 1 && (
          <Button onClick={() => setStep(2)} disabled={!canNext()}>
            {t('common.next')} <ArrowRight size={16} className="ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
