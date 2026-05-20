import { motion } from 'framer-motion';
import { Building2, ArrowRight, AlertTriangle, Clock, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PalaceWidgetProps {
  palaceCount: number;
  anchorCount: number;
  dueToday: number;
  mostReviewedPalace?: {
    name: string;
    lociCount: number;
  };
  onLaunch: () => void;
  loading?: boolean;
}

export function PalaceWidget({
  palaceCount,
  anchorCount,
  dueToday,
  mostReviewedPalace,
  onLaunch,
  loading = false,
}: PalaceWidgetProps) {
  const urgency = dueToday < 5 ? 'low' : dueToday < 15 ? 'medium' : 'high';

  const statusConfig = {
    low: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: 'Caught up!',
    },
    medium: {
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: 'Some due',
    },
    high: {
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      label: 'Urgent!',
    },
  };

  const config = statusConfig[urgency];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="cursor-pointer"
    >
      <Card
        className={cn(
          'border transition-all duration-300',
          config.border,
          'bg-gradient-to-br from-slate-900 to-slate-800'
        )}
      >
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
                <Building2 size={16} className={config.color} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Memory Palace</h3>
                <p className="text-[10px] text-slate-500">Video-backed loci</p>
              </div>
            </div>
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', config.bg, config.color)}>
              {config.label}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{loading ? '...' : palaceCount}</p>
              <p className="text-[10px] text-slate-500">Palaces</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{loading ? '...' : anchorCount}</p>
              <p className="text-[10px] text-slate-500">Anchors</p>
            </div>
            <div className="text-center">
              <p className={cn('text-xl font-bold', dueToday > 0 ? 'text-rose-400' : 'text-emerald-400')}>
                {loading ? '...' : dueToday}
              </p>
              <p className="text-[10px] text-slate-500">Due Today</p>
            </div>
          </div>

          {/* Most reviewed palace preview */}
          {mostReviewedPalace && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
              <Building2 size={14} className="text-indigo-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white truncate">{mostReviewedPalace.name}</p>
                <p className="text-[10px] text-slate-500">{mostReviewedPalace.lociCount} loci</p>
              </div>
            </div>
          )}

          {/* Launch button */}
          <Button
            variant={urgency === 'high' ? 'default' : 'outline'}
            size="sm"
            className="w-full"
            onClick={(e) => { e.stopPropagation(); onLaunch(); }}
          >
            {urgency === 'high' ? (
              <><AlertTriangle size={14} className="mr-1" /> Review Due ({dueToday})</>
            ) : (
              <><Play size={14} className="mr-1" /> Open Memory Palace</>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
