import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const plans = ['free', 'xueba', 'xueshen'] as const;

export function PricingSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-24 px-4 bg-slate-900/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-lg text-slate-400">{t('landing.pricing.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const isPopular = plan === 'xueshen';
            const features = t(`landing.pricing.${plan}.features`, { returnObjects: true }) as string[];

            return (
              <motion.div
                key={plan}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  isPopular
                    ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-slate-800/50 glow'
                    : 'border-slate-700/50 bg-slate-800/40'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="accent" className="shadow-lg">
                      {t('landing.pricing.xueshen.badge')}
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">
                    {t(`landing.pricing.${plan}.name`)}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">
                      {t(`landing.pricing.${plan}.price`)}
                    </span>
                    <span className="text-slate-400 text-sm">
                      {t(`landing.pricing.${plan}.period`)}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {Array.isArray(features) &&
                    features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                        <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                </ul>

                <SignedOut>
                  <Button
                    variant={isPopular ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => navigate('/sign-up')}
                  >
                    {isPopular && <Zap size={16} className="mr-2" />}
                    {plan === 'free' ? t('landing.pricing.freeStart') : plan === 'xueba' ? t('pricing.subscribeMonthly') : t('pricing.subscribeAnnual')}
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button
                    variant={isPopular ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => navigate('/pricing')}
                  >
                    {isPopular && <Zap size={16} className="mr-2" />}
                    {plan === 'free' ? t('pricing.currentPlan') : t('pricing.upgrade')}
                  </Button>
                </SignedIn>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
