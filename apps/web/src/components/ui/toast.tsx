import { Toaster as HotToaster } from 'react-hot-toast';

// Re-export react-hot-toast for convenience
export { toast } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1E293B',
          color: '#F8FAFC',
          border: '1px solid #334155',
          borderRadius: '0.75rem',
          fontSize: '14px',
        },
        success: {
          iconTheme: { primary: '#10B981', secondary: '#0F172A' },
        },
        error: {
          iconTheme: { primary: '#F43F5E', secondary: '#0F172A' },
        },
      }}
    />
  );
}
