import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Eye, EyeOff, ImageIcon, X, Maximize2, Loader2 } from 'lucide-react';

interface LocusData {
  id?: string;
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
  imageStatus?: 'pending' | 'generating' | 'done' | 'failed';
}

interface LocusViewProps {
  locus: LocusData;
  quizMode: boolean;
}

export function LocusView({ locus, quizMode }: LocusViewProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const imageUrl = locus.image_url;
  const imageStatus = locus.imageStatus || (imageUrl ? 'done' : undefined);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {quizMode ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <EyeOff size={18} className="text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Recall Mode</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30 text-center">
              <p className="text-slate-400 text-sm mb-2">What do you remember about this locus?</p>
              <p className="text-2xl font-bold text-white">{locus.concept}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Lightbulb size={16} className="text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{locus.concept}</h3>
            </div>

            {/* ── Image (Phase 3) ─────────────────────────────────── */}
            {imageStatus === 'generating' && (
              <div className="relative w-full aspect-[4/3] rounded-xl bg-slate-800/50 border border-slate-700/30 flex items-center justify-center overflow-hidden">
                <Skeleton className="absolute inset-0" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <Loader2 size={24} className="text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-400">Generating image...</span>
                </div>
              </div>
            )}
            {imageStatus === 'done' && imageUrl && (
              <div className="relative group">
                <div
                  className="relative w-full aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-slate-700/30 hover:border-indigo-500/50 transition-colors"
                  onClick={() => setShowFullscreen(true)}
                >
                  <img
                    src={imageUrl}
                    alt={`Memory palace image for: ${locus.concept}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Maximize2
                      size={20}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </div>
            )}
            {imageStatus === 'failed' && (
              <div className="w-full aspect-[4/3] rounded-xl bg-slate-800/30 border border-slate-700/20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 text-slate-500">
                  <ImageIcon size={20} />
                  <span className="text-xs">Image unavailable</span>
                </div>
              </div>
            )}
            {!imageStatus && (
              <div className="w-full aspect-[4/3] rounded-xl bg-slate-800/10 border border-slate-700/10 flex items-center justify-center opacity-50">
                <ImageIcon size={16} className="text-slate-600" />
              </div>
            )}

            <p className="text-slate-300 text-sm leading-relaxed">{locus.description}</p>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-400">💡 MNEMONIC</span>
              </div>
              <p className="text-sm text-slate-300 italic">{locus.mnemonic}</p>
            </div>
          </>
        )}

        {/* ── Fullscreen Modal ─────────────────────────────────── */}
        {showFullscreen && imageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
            onClick={() => setShowFullscreen(false)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setShowFullscreen(false)}
            >
              <X size={24} className="text-white" />
            </button>
            <img
              src={imageUrl}
              alt={`Full size: ${locus.concept}`}
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
