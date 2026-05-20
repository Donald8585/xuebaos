import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, School, Castle, Gamepad2, PenTool, ScanLine,
  ArrowLeft, ArrowRight, Wand2, Check, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseDocx, parsePptx } from '@/lib/fileParser';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const templates = [
  { id: 'childhoodHome', icon: Home, color: 'from-blue-500 to-cyan-500' },
  { id: 'schoolCampus', icon: School, color: 'from-indigo-500 to-blue-600' },
  { id: 'dreamMansion', icon: Castle, color: 'from-violet-500 to-purple-600' },
  { id: 'gameMap', icon: Gamepad2, color: 'from-rose-500 to-pink-600' },
  { id: 'custom', icon: PenTool, color: 'from-amber-500 to-orange-600' },
  { id: 'realHome', icon: ScanLine, color: 'from-emerald-500 to-teal-600' },
];

const TOTAL_STEPS = 4;

type InputMode = 'paste' | 'upload';

interface Locus {
  concept: string;
  description: string;
  mnemonic: string;
}

export default function PalaceBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [palaceName, setPalaceName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loci, setLoci] = useState<Locus[]>([]);
  const [lociProgress, setLociProgress] = useState({ total: 0, completed: 0 });
  const [failedChunks, setFailedChunks] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [costEstimate, setCostEstimate] = useState<{ tokens: number; cost: number; chunks: number } | null>(null);
  const [showCostGate, setShowCostGate] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const { getToken } = useAuth();

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
    setLoci([]);
    setLociProgress({ total: 0, completed: 0 });
    setFailedChunks(0);
    const API_BASE = import.meta.env.VITE_API_URL || '/api';

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // ── Cost estimate (background, non-blocking) ────────────────
      fetch(`${API_BASE}/loci-jobs/estimate-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content }),
      }).then(r => r.json()).then(data => {
        if (data.estimatedTokens) {
          setCostEstimate({ tokens: data.estimatedTokens, cost: data.estimatedCost, chunks: data.estimatedChunks });
          if (data.warning) {
            setShowCostGate(true);
            toast(data.warning, { icon: '💰', duration: 6000 });
          }
        }
      }).catch(() => {});

      // ── Submit job to chunked pipeline ──────────────────────────
      const resp = await fetch(`${API_BASE}/loci-jobs?topic=${encodeURIComponent(subject || 'Study Material')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content, fileName: uploadedFileName || 'pasted-text.txt' }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const code = err.code ? ` [${err.code}]` : "";
        throw new Error(err.detail || err.error || `HTTP ${resp.status}${code}`);
      }

      const { jobId, totalChunks } = await resp.json();
      setActiveJobId(jobId);
      setLociProgress({ total: totalChunks, completed: 0 });

      if (totalChunks === 0) throw new Error('No content to process');

      // ── SSE stream for progressive results ─────────────────────
      await streamResults(API_BASE, jobId, token, 0);

    } catch (err: any) {
      // Beacon: send failure telemetry
      const API_BASE2 = import.meta.env.VITE_API_URL || '/api';
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        try {
          await fetch(`${API_BASE2}/_beacon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              route: '/api/loci-jobs',
              fileSize: content?.length || 0,
              durationMs: 120000,
              effectiveType: (navigator as any)?.connection?.effectiveType || 'unknown',
              errorName: err.name, errorMsg: String(err.message || '').slice(0, 200),
              userAgent: navigator.userAgent.slice(0, 200),
              sentAt: new Date().toISOString(),
            }),
          });
        } catch { /* beacon best-effort */ }
      }

      if (err.name === 'AbortError') {
        toast.error('Request timed out — your document may be too large. Try shorter text or split into sections.');
      } else if (err.status === 504) {
        toast.error('AI generation timed out — processing in background. Check your palaces shortly.');
      } else {
        toast.error(`Generation failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /** SSE stream handler with reconnect support */
  const streamResults = async (API_BASE: string, jobId: string, token: string, lastSeq: number) => {
    const url = lastSeq > 0
      ? `${API_BASE}/loci-jobs/${jobId}/stream`
      : `${API_BASE}/loci-jobs/${jobId}/stream`;

    const streamResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(lastSeq > 0 ? { 'Last-Event-ID': String(lastSeq) } : {}),
      },
    });

    if (!streamResp.ok || !streamResp.body) {
      // Fall back to polling
      try {
        const result = await pollJob(API_BASE, jobId, token);
        finishGeneration(result, jobId);
      } catch (e: any) {
        toast.error(e.message || 'Generation failed');
        setIsGenerating(false);
      }
      return;
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastProcessedSeq = lastSeq;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'init' || event.type === 'progress') {
              setLociProgress({
                total: event.totalChunks || lociProgress.total,
                completed: event.completedChunks || 0,
              });
              if (event.allLoci?.length) {
                setLoci(event.allLoci.map((l: any) => ({
                  concept: l.name || l.concept || '',
                  description: l.vivid_description || l.anchor || l.description || '',
                  mnemonic: l.anchor || l.mnemonic || '',
                })));
              }
              lastProcessedSeq = event.completedChunks || lastProcessedSeq;

              // Check for failed chunks in job status
              if (event.failedChunks !== undefined) {
                setFailedChunks(event.failedChunks);
              }
            } else if (event.type === 'complete') {
              const finalResp = await fetch(`${API_BASE}/loci-jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (finalResp.ok) {
                const data = await finalResp.json();
                finishGeneration(data.loci || [], jobId);
              }
              return;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Generation failed');
            }
          } catch (e: any) {
            if (e.message?.includes('Generation failed')) throw e;
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('network')) {
        // Connection lost — auto-reconnect after 3s
        toast('Connection lost. Reconnecting...', { icon: '🔌' });
        await new Promise(r => setTimeout(r, 3000));
        streamResults(API_BASE, jobId, token, lastProcessedSeq);
        return;
      }
      throw e;
    }
  };

  /** Retry failed chunks for a job */
  const retryFailedChunks = async () => {
    if (!activeJobId) return;
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    try {
      const token = await getToken();
      if (!token) return;

      const resp = await fetch(`${API_BASE}/loci-jobs/${activeJobId}/retry-chunks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        toast.success(`Retrying ${data.retried} failed chunks...`);
        setFailedChunks(0);
        setLociProgress(prev => ({ ...prev, completed: prev.completed - data.retried }));
        streamResults(API_BASE, activeJobId, token, lociProgress.completed);
      }
    } catch (e: any) {
      toast.error('Retry failed: ' + (e.message || 'Unknown error'));
    }
  };

  /** Polling fallback when SSE isn't available */
  const pollJob = async (API_BASE: string, jobId: string, token: string): Promise<any[]> => {
    for (let i = 0; i < 180; i++) {  // 6 min timeout
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`${API_BASE}/loci-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pollResp.ok) continue;
      const job = await pollResp.json();
      setLociProgress({ total: job.totalChunks || 0, completed: job.completedChunks || 0 });
      if (job.status === 'completed') return job.loci || [];
      if (job.status === 'failed' || job.status === 'cost_capped') {
        throw new Error(job.error || 'Generation failed');
      }
    }
    throw new Error('Generation timed out — the job may still be processing. Check back later.');
  };

  const finishGeneration = (lociData: any[], jobId?: string) => {
    if (lociData.length === 0) {
      toast.error('No concepts extracted — try pasting more text');
      setIsGenerating(false);
      return;
    }
    const mapped: Locus[] = lociData.map((l: any) => ({
      concept: l.name || l.concept || '',
      description: l.vivid_description || l.anchor || l.description || '',
      mnemonic: l.anchor || l.mnemonic || '',
    }));
    setLoci(mapped);
    setStep(3);
    setIsGenerating(false);
    toast.success(`Generated ${mapped.length} memory loci from ${lociProgress.total || '?'} chunks!`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.post('/palaces', {
        name: palaceName,
        description: description || `A ${template} memory palace`,
        subject: subject || undefined,
        lociCount: loci.length,
        loci: loci.map((l) => ({
          concept: l.concept,
          description: l.description,
          mnemonic: l.mnemonic,
        })),
        tags: [template, subject].filter(Boolean),
      });
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
                    const handleClick = () => {
                      if (tpl.id === 'realHome') {
                        navigate('/palaces/3d');
                        return;
                      }
                      setTemplate(tpl.id);
                    };
                    return (
                      <button
                        key={tpl.id}
                        onClick={handleClick}
                        className={cn(
                          'flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-200',
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600',
                          tpl.id === 'realHome' && 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20'
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
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      inputMode === 'paste' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    📋 Paste Text
                  </button>
                  <button
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      inputMode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    📁 Upload File
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {inputMode === 'paste' ? (
                  <>
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
                  </>
                ) : (
                  <div className="space-y-3">
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject (e.g., Biology, History, Chemistry)..."
                    />
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center space-y-3">
                      <p className="text-3xl">📄</p>
                      <p className="text-sm text-slate-300">Drop .txt or .md files here</p>
                      <input
                        type="file"
                        accept=".txt,.md,.docx,.pptx"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          // File size limits
                          const MAX_SIZE = 20 * 1024 * 1024; // 20MB
                          const WARN_SIZE = 5 * 1024 * 1024;  // 5MB
                          if (file.size > MAX_SIZE) {
                            toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 20MB.`);
                            return;
                          }
                          if (file.size > WARN_SIZE) {
                            toast.success('Large file detected — will be processed in background.', { duration: 4000 });
                          }

                          setUploadedFileName(file.name);
                          try {
                            let text = '';
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            if (ext === 'docx') {
                              text = await parseDocx(file);
                            } else if (ext === 'pptx') {
                              text = await parsePptx(file);
                            } else {
                              text = await file.text();
                            }
                            setContent(text);
                            if (!subject) setSubject(file.name.replace(/\.[^.]+$/, ''));
                          } catch (err) {
                            toast.error(`Failed to parse ${file.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
                            setUploadedFileName('');
                          }
                        }}
                        className="block mx-auto text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                      />
                      {uploadedFileName && (
                        <p className="text-xs text-emerald-400">✅ {uploadedFileName} loaded ({content.length.toLocaleString()} chars)</p>
                      )}
                      <div className="flex items-center justify-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                          <span className="text-emerald-400">✓</span> .txt
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                          <span className="text-emerald-400">✓</span> .md
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                          <span className="text-emerald-400">✓</span> .docx
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                          <span className="text-emerald-400">✓</span> .pptx
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <Button onClick={handleGenerate} disabled={!canNext() || isGenerating} className="w-full sm:w-auto">
                  {isGenerating ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> {t('palace.builder.generating')}</>
                  ) : (
                    <><Wand2 size={16} className="mr-2" /> Generate Loci with AI</>
                  )}
                </Button>
                {isGenerating && lociProgress.total > 0 && (
                  <div className="mt-3 space-y-1">
                    <Progress value={(lociProgress.completed / lociProgress.total) * 100} className="h-2" />
                    <p className="text-xs text-slate-400 text-center">
                      Processing chunk {lociProgress.completed} of {lociProgress.total}
                      {loci.length > 0 && ` • ${loci.length} loci generated so far`}
                    </p>
                    {failedChunks > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          {failedChunks} chunk{failedChunks > 1 ? 's' : ''} failed
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.preventDefault(); retryFailedChunks(); }}
                          className="h-7 text-xs"
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
