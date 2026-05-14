import { useTranslation } from 'react-i18next';
import { Battery, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SaturationMeterProps {
  level: number;
}

export function SaturationMeter({ level }: SaturationMeterProps) {
  const { t } = useTranslation();

  const getVariant = () => {
    if (level < 30) return 'default' as const;
    if (level < 70) return 'default' as const;
    return 'warning' as const;
  };

  const getIcon = () => {
    if (level < 30) return <Battery className="text-emerald-400" size={18} />;
    if (level < 70) return <BatteryMedium className="text-amber-400" size={18} />;
    return <BatteryFull className="text-rose-400" size={18} />;
  };

  const getLabel = () => {
    if (level < 30) return t('timetable.low');
    if (level < 70) return t('timetable.medium');
    return t('timetable.high');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {getIcon()}
          {t('timetable.saturation')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-2">
          <Progress value={level} className="flex-1" variant={getVariant()} />
          <span className="text-sm font-semibold text-white">{level}%</span>
        </div>
        <p className="text-xs text-slate-500">{t('timetable.saturationDesc')}</p>
      </CardContent>
    </Card>
  );
}
