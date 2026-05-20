import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { setClerkTokenGetter } from './lib/api';
import './i18n';
import './styles/globals.css';
import './styles/os-theme.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function ClerkTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setClerkTokenGetter(() => getToken({ template: undefined }));
  }, [getToken]);
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#4F46E5',
          colorBackground: '#0F172A',
          colorText: '#F8FAFC',
          colorTextSecondary: '#94A3B8',
          colorInputBackground: '#1E293B',
          colorInputText: '#F8FAFC',
          colorDanger: '#F43F5E',
          borderRadius: '0.75rem',
        },
        elements: {
          card: 'bg-slate-900 border border-slate-700 shadow-2xl',
          headerTitle: 'text-white',
          headerSubtitle: 'text-slate-400',
          socialButtonsBlockButton: 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
          dividerLine: 'bg-slate-700',
          dividerText: 'text-slate-500',
          formFieldLabel: 'text-slate-300',
          formFieldInput: 'bg-slate-800 border-slate-600 text-white focus:border-indigo-500',
          formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500',
          footerActionLink: 'text-indigo-400 hover:text-indigo-300',
          identityPreviewText: 'text-white',
          identityPreviewEditButton: 'text-indigo-400',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ClerkTokenBridge>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1E293B',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  borderRadius: '0.75rem',
                },
                success: { iconTheme: { primary: '#10B981', secondary: '#0F172A' } },
                error: { iconTheme: { primary: '#F43F5E', secondary: '#0F172A' } },
              }}
            />
          </ClerkTokenBridge>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);
