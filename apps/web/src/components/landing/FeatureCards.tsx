import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, BookOpen, Sparkles, Calendar, HelpCircle, BarChart3 } from 'lucide-react';

const featureIcons = {
  palace: Building2,
  stories: BookOpen,
  symbols: Sparkles,
  timetable: Calendar,
  qbank: HelpCircle,
  analytics: BarChart3,
} as const;

type FeatureKey = keyof typeof featureIcons;

const features: FeatureKey[] = ['palace', 'stories', 'symbols', 'timetable', 'qbank', 'analytics'];

export function FeatureCards() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.solutionTitle')}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {t('landing.solutionDesc')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = featureIcons[feature];
            return (
              <motion.div
                key={feature}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-hover p-6 group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                  <Icon size={24} className="text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t(`landing.features.${feature}.title`)}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t(`landing.features.${feature}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
