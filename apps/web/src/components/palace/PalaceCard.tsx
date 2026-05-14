import { useNavigate } from 'react-router-dom';
import { Building2, Clock, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate } from '@/lib/utils';
import type { Palace } from '@/hooks/useApi';

interface PalaceCardProps {
  palace: Palace;
}

export function PalaceCard({ palace }: PalaceCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 group"
      onClick={() => navigate(`/palaces/${palace.id}/walk`)}
    >
      <div className="aspect-video bg-gradient-to-br from-indigo-900/40 to-violet-900/40 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
        <Building2 size={48} className="text-indigo-400/40 group-hover:scale-110 transition-transform" />
        {palace.is_published && (
          <Badge variant="success" className="absolute top-3 right-3">Published</Badge>
        )}
        <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><MapPin size={12} /> {palace.loci_count} loci</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm mb-1 truncate">{palace.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{palace.description || 'No description'}</p>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock size={12} />
          <span>
            {palace.last_studied_at
              ? formatRelativeDate(palace.last_studied_at)
              : 'Never studied'}
          </span>
        </div>
      </div>
    </Card>
  );
}
