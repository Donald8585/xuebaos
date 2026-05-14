import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubscribeButton } from '@/components/auth/SubscribeButton';

const plans = [
  {
    id: 'free',
    tier: null,
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '1 memory palace',
      '5 mnemonic stories',
      '10 questions/month',
      'Basic analytics',
    ],
    popular: false,
  },
  {
    id: 'xueba',
    tier: 'xueba' as const,
    name: '學霸 Xueba',
    price: 'HK$79',
    period: '/month',
    features: [
      'Unlimited memory palaces',
      'Unlimited stories',
      'Unlimited symbols',
      'AI-optimized timetable',
      '100 questions/month',
      'FSRS analytics',
      'AI study coach chat',
    ],
    popular: false,
  },
  {
    id: 'xueshen',
    tier: 'xueshen' as const,
    name: '學神 Xueshen',
    price: 'HK$159',
    period: '/month',
    features: [
      'Everything in Xueba',
      'Unlimited questions',
      'Priority AI processing',
      'Image generation (Replicate)',
      'Audio narration (ElevenLabs)',
      'Export study reports',
      'Custom palace templates',
      'Early access to new features',
    ],
    popular: true,
    badge: 'Most Popular',
  },
];

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft size={16} className="mr-2" />
          {t('common.back')}
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-slate-400">{t('pricing.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.popular
                  ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-slate-800/50 glow'
                  : 'border-slate-700/50 bg-slate-800/40'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="accent" className="shadow-lg">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                    <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.tier ? (
                <SubscribeButton tier={plan.tier} popular={plan.popular} />
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {t('pricing.currentPlan')}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
