import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  School,
  Castle,
  Gamepad2,
  PenTool,
  ArrowLeft,
  ArrowRight,
  Wand2,
  Image,
  GripVertical,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const templates = [
  { id: 'childhoodHome', icon: Home, color: 'from-blue-500 to-cyan-500' },
  { id: 'schoolCampus', icon: School, color: 'from-indigo-500 to-blue-600' },
  { id: 'dreamMansion', icon: Castle, color: 'from-violet-500 to-purple-600' },
  { id: 'gameMap', icon: Gamepad2, color: 'from-rose-500 to-pink-600' },
  { id: 'custom', icon: PenTool, color: 'from-amber-500 to-orange-600' },
];

const TOTAL_STEPS = 6;

export default function PalaceBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [palaceName, setPalaceName] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loci, setLoci] = useState<Array<{ id: string; concept: string; description: string; mnemonic: string }>>([]);

  const canNext = () => {
    switch (step) {
      case 1: return !!template;
      case 2: return content.trim().length > 20;
      case 3: return loci.length > 0 || true;
      case 4: return true;
      case 5: return true;
      case 6: return palaceName.trim().length > 0;
      default: return false;
    }
  };

  const simulateGeneration = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setLoci([
        { id: '1', concept: 'Cell Membrane Structure', description: 'Front door of the house — the gatekeeper that controls entry', mnemonic: 'Imagine a bouncer at a club checking IDs. Only certain molecules get through the phospholipid bilayer.' },
        { id: '2', concept: 'Mitochondria Function', description: 'Kitchen — the powerhouse that generates energy', mnemonic: 'The stove and oven are constantly cooking up ATP meals from glucose ingredients.' },
        { id: '3', concept: 'Nucleus Role', description: 'Study room — the command center with DNA blueprints', mnemonic: 'A massive library with every book containing the instructions for every protein in the body.' },
        { id: '4', concept: 'Endoplasmic Reticulum', description: 'Hallway + assembly line — protein transport network', mnemonic: 'A conveyor belt running through the house, moving packages from room to room.' },
        { id: '5', concept: 'Golgi Apparatus', description: 'Mail room — packages and ships proteins', mnemonic: 'The Amazon warehouse of the cell, labeling and shipping molecular packages to their destinations.' },
        { id: '6', concept: 'Lysosomes', description: 'Trash room — waste disposal and recycling', mnemonic: 'The janitor closet with enzymes that break down old furniture and unwanted materials.' },
        { id: '7', concept: 'Ribosomes', description: 'Workshop bench — protein synthesis stations', mnemonic: 'Tiny 3D printers scattered everywhere, reading mRNA instructions and printing proteins.' },
        { id: '8', concept: 'Chloroplasts', description: 'Greenhouse room — photosynthesis factory', mnemonic: 'A sunroom filled with solar panels converting sunlight into sugar, painted entirely green.' },
      ]);
      setIsGenerating(false);
      setStep(3);
    }, 3000);
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
        <Badge>
          {step} / {TOTAL_STEPS}
        </Badge>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
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
                        <div className={cn(
                          'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
                          tpl.color
                        )}>
                          <Icon size={22} className="text-white" />
                        </div>
                        <span className="text-sm text-white font-medium">
                          {t(`palace.builder.templates.${tpl.id}`)}
                        </span>
                        <span className="text-xs text-slate-500 text-center">
                          {t(`palace.builder.templates.${tpl.id}Desc`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Paste Content */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step2')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step2Desc')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('palace.builder.pastePlaceholder') || ''}
                  className="min-h-[250px]"
                />
                <Button
                  onClick={simulateGeneration}
                  disabled={!canNext() || isGenerating}
                  className="w-full sm:w-auto"
                >
                  {isGenerating ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> {t('palace.builder.generating')}</>
                  ) : (
                    <><Wand2 size={16} className="mr-2" /> {t('palace.builder.step3')}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: AI Extraction (loci list) */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step3')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step3Desc')}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="success" className="mb-3">{loci.length} {t('palace.builder.lociCount')}</Badge>
                  {loci.map((locus, i) => (
                    <div key={locus.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
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
              </CardContent>
            </Card>
          )}

          {/* Step 4: Image Generation */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step4')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step4Desc')}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {loci.map((locus, i) => (
                    <div key={locus.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 text-center">
                      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-2">
                        <Image size={24} className="text-slate-600" />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{locus.concept}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Arrange Loci */}
          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step5')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step5Desc')}</p>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-xl bg-slate-800 border border-slate-700/30 p-4 relative overflow-hidden">
                  {/* Grid background */}
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }} />
                  {/* Placeholder loci */}
                  {loci.slice(0, 6).map((locus, i) => (
                    <div
                      key={locus.id}
                      className="absolute cursor-move px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-xs text-white flex items-center gap-1"
                      style={{
                        left: `${15 + (i % 3) * 30}%`,
                        top: `${20 + Math.floor(i / 3) * 40}%`,
                      }}
                    >
                      <GripVertical size={12} className="text-slate-500" />
                      {locus.concept.slice(0, 15)}...
                    </div>
                  ))}
                  <p className="absolute bottom-4 left-4 text-xs text-slate-600">
                    Drag loci to position them in your palace
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Review & Save */}
          {step === 6 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('palace.builder.step6')}</CardTitle>
                <p className="text-sm text-slate-400">{t('palace.builder.step6Desc')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={palaceName}
                  onChange={(e) => setPalaceName(e.target.value)}
                  placeholder={t('palace.builder.palaceName') || ''}
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('palace.builder.palaceDescription') || ''}
                  className="min-h-[80px]"
                />
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
                  <p className="text-sm text-slate-400">
                    Template: <span className="text-white">{template}</span>
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Loci: <span className="text-white">{loci.length}</span>
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    navigate('/palaces');
                  }}
                  disabled={!canNext()}
                >
                  <Check size={16} className="mr-2" />
                  {t('palace.builder.savePalace')}
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1}
        >
          <ArrowLeft size={16} className="mr-2" />
          {t('common.back')}
        </Button>
        {step < TOTAL_STEPS && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canNext() || isGenerating}
          >
            {t('common.next')}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
