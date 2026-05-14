import { UserButton as ClerkUserButton } from '@clerk/clerk-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function UserButton() {
  const { user, fullName, avatarUrl } = useAuth();

  return (
    <ClerkUserButton
      appearance={{
        elements: {
          userButtonBox: 'w-9 h-9',
          userButtonTrigger: 'focus:ring-0 focus:ring-offset-0',
          userButtonPopoverCard: 'bg-slate-900 border border-slate-700 shadow-xl rounded-xl',
          userButtonPopoverActionButton:
            'text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg',
          userButtonPopoverActionButtonText: 'text-sm',
          userButtonPopoverFooter: 'hidden',
        },
      }}
    />
  );
}
