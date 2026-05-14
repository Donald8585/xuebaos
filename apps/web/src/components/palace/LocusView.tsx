import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Eye, EyeOff } from 'lucide-react';

interface LocusData {
  id?: string;
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
}

interface LocusViewProps {
  locus: LocusData;
  quizMode: boolean;
}

export function LocusView({ locus, quizMode }: LocusViewProps) {
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
            <p className="text-slate-300 text-sm leading-relaxed">{locus.description}</p>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-400">💡 MNEMONIC</span>
              </div>
              <p className="text-sm text-slate-300 italic">{locus.mnemonic}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
