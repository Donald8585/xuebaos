import { useAuth as useClerkAuth, useUser, useSession } from '@clerk/clerk-react';

export function useAuth() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken, signOut } = useClerkAuth();
  const { user } = useUser();
  const { session } = useSession();

  return {
    isLoaded,
    isSignedIn,
    userId,
    sessionId,
    user,
    session,
    getToken,
    signOut,
    isAdmin: user?.publicMetadata?.role === 'admin',
    fullName: user?.fullName || user?.username || 'User',
    email: user?.primaryEmailAddress?.emailAddress,
    avatarUrl: user?.imageUrl,
  };
}
