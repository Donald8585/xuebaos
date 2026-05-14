import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import type { Symbol } from '@/hooks/useApi';

const EMOJI_MAP = ['🔋', '⚡', '🔥', '🧬', '💡', '🏭', '🧠', '🌱', '🔄', '⚙️'];

interface SymbolCardProps {
  symbol: Symbol;
}

export function SymbolCard({ symbol }: SymbolCardProps) {
  const emoji = EMOJI_MAP[Math.floor(Math.random() * EMOJI_MAP.length)];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="aspect-square p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-amber-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 group">
          {symbol.image_url ? (
            <img src={symbol.image_url} alt={symbol.concept} className="w-16 h-16 rounded-xl object-cover mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
              {emoji}
            </div>
          )}
          <p className="text-xs font-medium text-white truncate w-full">{symbol.concept}</p>
          <p className="text-[10px] text-slate-500 mt-1 truncate w-full">{symbol.metaphor}</p>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div>
          <p className="font-semibold text-sm">{symbol.concept}</p>
          <p className="text-xs text-slate-400 mt-1">{symbol.metaphor}</p>
          <p className="text-xs text-slate-500 mt-1">{symbol.explanation}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
