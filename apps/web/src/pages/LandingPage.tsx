import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardPaste, Wand2, Eye, ChevronDown } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureCards } from '@/components/landing/FeatureCards';
import { PricingSection } from '@/components/landing/PricingSection';
import { FounderSection } from '@/components/landing/FounderSection';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

// ─── Problem Section ────────────────────────────────────

function ProblemSection() {
  const { t } = useTranslation();
  return (
    <section className="py-24 px-4 bg-slate-900/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.problemTitle')}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {t('landing.problemDesc')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass p-8 space-y-6">
            {/* Ebbinghaus forgetting curve visual */}
            <div className="relative h-48">
              <svg viewBox="0 0 400 150" className="w-full h-full">
                <defs>
                  <linearGradient id="curveGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F43F5E" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
                <line x1="40" y1="130" x2="380" y2="130" stroke="#334155" strokeWidth="1" />
                <line x1="40" y1="130" x2="40" y2="10" stroke="#334155" strokeWidth="1" />
                <text x="10" y="135" fill="#64748B" fontSize="10">100%</text>
                <text x="10" y="75" fill="#64748B" fontSize="10">50%</text>
                <text x="10" y="25" fill="#64748B" fontSize="10">0%</text>
                <text x="40" y="145" fill="#64748B" fontSize="10">Immediate</text>
                <text x="200" y="145" fill="#64748B" fontSize="10">1 day</text>
                <text x="350" y="145" fill="#64748B" fontSize="10">1 week</text>
                <path
                  d="M 60 25 C 130 60, 200 120, 380 128"
                  fill="none"
                  stroke="url(#curveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M 60 25 C 180 30, 280 45, 380 55"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  strokeLinecap="round"
                />
                <text x="120" y="15" fill="#10B981" fontSize="10">With XueBaOS</text>
                <ellipse cx="60" cy="25" rx="4" ry="4" fill="#F43F5E" />
                <ellipse cx="200" cy="105" rx="4" ry="4" fill="#F59E0B" />
                <ellipse cx="380" cy="128" rx="4" ry="4" fill="#4F46E5" />
              </svg>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-rose-400">80%</p>
                <p className="text-xs text-slate-500 mt-1">Forgotten in 24h (without technique)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">22x</p>
                <p className="text-xs text-slate-500 mt-1">Better recall with stories</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">95%</p>
                <p className="text-xs text-slate-500 mt-1">Retention with memory palaces</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── How It Works Section ────────────────────────────────

const steps = [
  { icon: ClipboardPaste, step: 1 },
  { icon: Wand2, step: 2 },
  { icon: Eye, step: 3 },
];

function HowItWorksSection() {
  const { t } = useTranslation();
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.howItWorks.title')}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-indigo-500/30 via-indigo-500 to-indigo-500/30" />

          {steps.map(({ icon: Icon, step }, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              className="flex flex-col items-center text-center"
            >
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                <Icon size={28} className="text-white" />
              </div>
              <span className="text-xs font-bold text-indigo-400 mb-2">STEP {step}</span>
              <h3 className="text-xl font-semibold text-white mb-2">
                {t(`landing.howItWorks.step${step}.title`)}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                {t(`landing.howItWorks.step${step}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────

function TestimonialsSection() {
  const { t } = useTranslation();
  const testimonials = [
    { name: 'Emily C.', role: 'Medical Student', text: 'XueBaOS completely changed how I study for anatomy. The memory palaces are incredible — I can literally walk through the brachial plexus in my mind now.' },
    { name: 'Jason L.', role: 'Law Student', text: 'I was struggling with case names and precedents. After building a memory palace for contract law, my exam scores jumped from B- to A. No joke.' },
    { name: 'Sophia W.', role: 'DSE Candidate', text: 'Biology used to be my worst subject. Now I have a palace for each chapter and my mock exam scores went up 30 points. 真心推薦！' },
  ];

  return (
    <section id="testimonials" className="py-24 px-4 bg-slate-900/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.testimonials.title')}
          </h2>
          <p className="text-lg text-slate-400">{t('landing.testimonials.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="glass-hover p-6"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, s) => (
                  <svg key={s} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <p className="text-white font-semibold text-sm">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────

function FAQSection() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqItems = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
  ];

  return (
    <section id="faq" className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-white text-center mb-16"
        >
          {t('landing.faq.title')}
        </motion.h2>

        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-medium text-white pr-4">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`px-5 overflow-hidden transition-all duration-300 ${
                  openIndex === i ? 'pb-5 max-h-96' : 'max-h-0'
                }`}
              >
                <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ─────────────────────────────────────────

function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass p-12 md:p-16 glow"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('landing.cta.title')}
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            {t('landing.cta.subtitle')}
          </p>
          <SignedOut>
            <Button size="xl" onClick={() => navigate('/sign-up')} className="group">
              {t('landing.cta.button')}
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </SignedOut>
          <SignedIn>
            <Button size="xl" onClick={() => navigate('/dashboard')} className="group">
              {t('nav.dashboard')}
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </SignedIn>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Main Landing Page ───────────────────────────────────


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <FeatureCards />
      <HowItWorksSection />
      <FounderSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
