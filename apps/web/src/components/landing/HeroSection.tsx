import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Animated grid */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      <div className="relative max-w-5xl mx-auto text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-sm text-indigo-300 font-medium">AI-Powered Memory Platform</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6">
            <span className="text-white">{t('landing.heroTitle')} </span>
            <span className="gradient-text-gold">{t('landing.heroHighlight')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <Button
                size="xl"
                onClick={() => navigate('/sign-up')}
                className="w-full sm:w-auto group"
              >
                {t('landing.heroCTA')}
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                size="xl"
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto group"
              >
                {t('nav.dashboard')}
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </SignedIn>
            <Button
              variant="outline"
              size="xl"
              onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto"
            >
              <Play size={18} className="mr-2" />
              {t('landing.heroSecondary')}
            </Button>
          </div>
        </motion.div>

        {/* Floating dragon logo */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-2xl shadow-indigo-500/30 animate-float">
            <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none">
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#F59E0B"/>
                  <stop offset="100%" stopColor="#EF4444"/>
                </linearGradient>
              </defs>
              <path d="M34 12l-2 4h4l-2-4zm-2 4l-1 2c2 1 4 1 6 0l-1-2h-4z" fill="url(#dg)"/>
              <circle cx="33" cy="13" r="1.5" fill="#F59E0B"/>
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
