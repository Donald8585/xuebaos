import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'features', href: '#features' },
  { label: 'howItWorks', href: '#how-it-works' },
  { label: 'pricing', href: '#pricing' },
  { label: 'faq', href: '#faq' },
];

export function Navbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              學
            </div>
            <span className="text-lg font-bold gradient-text">XueBaOS</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleLinkClick(link.href)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {t(`landing.${link.label}.title`)}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <SignedOut>
              <Button variant="ghost" size="sm" onClick={() => navigate('/sign-in')}>
                {t('nav.signIn')}
              </Button>
              <Button size="sm" onClick={() => navigate('/sign-up')}>
                {t('nav.signUp')}
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="sm" onClick={() => navigate('/dashboard')}>
                {t('nav.dashboard')}
              </Button>
            </SignedIn>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-950 border-t border-slate-800"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className="block w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {t(`landing.${link.label}.title`)}
                </button>
              ))}
              <div className="pt-2 border-t border-slate-800">
                <SignedOut>
                  <Button variant="ghost" className="w-full" onClick={() => { setMobileOpen(false); navigate('/sign-in'); }}>
                    {t('nav.signIn')}
                  </Button>
                  <Button className="w-full mt-2" onClick={() => { setMobileOpen(false); navigate('/sign-up'); }}>
                    {t('nav.signUp')}
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button className="w-full" onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}>
                    {t('nav.dashboard')}
                  </Button>
                </SignedIn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
