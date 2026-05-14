import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Zap } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface SubscribeButtonProps {
  tier: 'xueba' | 'xueshen';
  popular?: boolean;
}

export function SubscribeButton({ tier, popular }: SubscribeButtonProps) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier,
          successUrl: `${window.location.origin}/dashboard?checkout=success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=cancel`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast.error(t('pricing.paymentFailed'));
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? t('pricing.processingPayment')
    : tier === 'xueshen'
    ? t('pricing.subscribeAnnual')
    : t('pricing.subscribeMonthly');

  return (
    <Button
      variant={popular ? 'default' : 'outline'}
      className="w-full"
      onClick={handleSubscribe}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={16} className="mr-2 animate-spin" />
      ) : popular ? (
        <Zap size={16} className="mr-2" />
      ) : null}
      {buttonLabel}
    </Button>
  );
}
