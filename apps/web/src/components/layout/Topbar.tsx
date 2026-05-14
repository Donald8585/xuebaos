import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Bell, Menu } from 'lucide-react';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { UserButton } from '@/components/auth/UserButton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppStore } from '@/stores/appStore';
import { getInitials } from '@/lib/utils';

export function Topbar() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { toggleSidebar } = useAppStore();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              學
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">
              XueBaOS
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <SignedIn>
            <div className="hidden md:flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 text-slate-400">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm text-white w-40 placeholder:text-slate-500"
              />
            </div>

            <button className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <UserButton />
          </SignedIn>

          <SignedOut>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/sign-in')}
              >
                {t('nav.signIn')}
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/sign-up')}
                className="hidden sm:inline-flex"
              >
                {t('nav.signUp')}
              </Button>
            </div>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
