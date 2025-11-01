import { useState, useEffect } from 'react';
import { Button } from '@/renderer/ui/button';
import { Card } from '@/renderer/ui/card';
import { Badge } from '@/renderer/ui/badge';
import { Progress } from '@/renderer/ui/progress';
import { Separator } from '@/renderer/ui/separator';
import { Alert } from '@/renderer/ui/alert';
import {
  Check,
  Zap,
  Crown,
  Sparkles,
  CreditCard,
  Calendar,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Loader2Icon,
} from 'lucide-react';
import {
  UserSubscription,
  PlanDetails,
  SubscriptionTier,
  SubscriptionStatus,
} from '@/shared/types/subscription';

export function SubscriptionPage() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanDetails | null>(null);
  const [allPlans, setAllPlans] = useState<PlanDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadPlans();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await window.subscriptionAPI.getCurrentSubscription();
      if (response.success && response.subscription) {
        setSubscription(response.subscription);
        if (response.plan_details) {
          setCurrentPlan(response.plan_details);
        }
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const response = await window.subscriptionAPI.getPlans();
      if (response.success && response.plans) {
        setAllPlans(response.plans);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const handleUpgrade = async (tier: SubscriptionTier) => {
    setUpgrading(true);
    try {
      const response = await window.subscriptionAPI.createCheckoutSession({
        tier,
        success_url: 'browzer://subscription/success',
        cancel_url: 'browzer://subscription/cancel',
      });

      if (response.success && response.checkout_url) {
        // Open Stripe checkout in external browser
        await window.subscriptionAPI.openExternal(response.checkout_url);
      } else {
        alert(`Failed to create checkout: ${response.error}`);
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start upgrade process');
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await window.subscriptionAPI.createPortalSession({
        return_url: 'browzer://subscription',
      });

      if (response.success && response.portal_url) {
        await window.subscriptionAPI.openExternal(response.portal_url);
      } else {
        alert(`Failed to open portal: ${response.error}`);
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
      alert('Failed to open subscription portal');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await window.subscriptionAPI.syncSubscription();
      if (response.success && response.subscription) {
        setSubscription(response.subscription);
        if (response.plan_details) {
          setCurrentPlan(response.plan_details);
        }
      }
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getCreditsPercentage = () => {
    if (!subscription) return 0;
    if (subscription.credits_limit === null) return 100; // Unlimited
    return (subscription.credits_remaining / subscription.credits_limit) * 100;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    const variants: Record<SubscriptionStatus, string> = {
      [SubscriptionStatus.ACTIVE]: 'bg-green-500',
      [SubscriptionStatus.TRIALING]: 'bg-blue-500',
      [SubscriptionStatus.PAST_DUE]: 'bg-yellow-500',
      [SubscriptionStatus.CANCELED]: 'bg-red-500',
      [SubscriptionStatus.UNPAID]: 'bg-red-500',
      [SubscriptionStatus.INCOMPLETE]: 'bg-gray-500',
      [SubscriptionStatus.INCOMPLETE_EXPIRED]: 'bg-gray-500',
      [SubscriptionStatus.PAUSED]: 'bg-gray-500',
    };

    return (
      <Badge className={variants[status]}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPlanIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.FREEMIUM:
        return <Sparkles className="w-6 h-6" />;
      case SubscriptionTier.PRO:
        return <Zap className="w-6 h-6" />;
      case SubscriptionTier.BUSINESS:
        return <Crown className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
       <Loader2Icon className='size-7 animate-spin' />
      </div>
    );
  }

  if (!subscription || !currentPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <p>Failed to load subscription. Please try again.</p>
        </Alert>
      </div>
    );
  }

  const availableUpgrades = allPlans.filter(
    (plan) =>
      plan.tier !== subscription.tier &&
      plan.tier !== SubscriptionTier.FREEMIUM
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Subscription</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your plan and billing
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>

        {/* Current Plan Card */}
        <Card className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                {getPlanIcon(subscription.tier)}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{currentPlan.name}</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  ${currentPlan.price_monthly}/month
                </p>
              </div>
            </div>
            {getStatusBadge(subscription.status)}
          </div>

          <Separator className="my-6" />

          {/* Credits Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Automation Credits
              </h3>
              <span className="text-2xl font-bold">
                {subscription.credits_limit === null
                  ? '∞'
                  : `${subscription.credits_remaining} / ${subscription.credits_limit}`}
              </span>
            </div>

            {subscription.credits_limit !== null && (
              <div>
                <Progress value={getCreditsPercentage()} className="h-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {subscription.credits_used} credits used this period
                </p>
              </div>
            )}

            {subscription.credits_limit === null && (
              <Alert className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                <Crown className="h-4 w-4 text-purple-600" />
                <p className="text-purple-900 dark:text-purple-100">
                  You have unlimited automation credits!
                </p>
              </Alert>
            )}
          </div>

          <Separator className="my-6" />

          {/* Billing Period */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Current Period</span>
              </div>
              <p className="font-medium">
                {formatDate(subscription.current_period_start)} -{' '}
                {formatDate(subscription.current_period_end)}
              </p>
            </div>

            {subscription.stripe_subscription_id && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm">Billing</span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  className="gap-2"
                >
                  Manage Billing
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {subscription.cancel_at_period_end && (
            <Alert className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-yellow-900 dark:text-yellow-100">
                Your subscription will be canceled at the end of the current period
                ({formatDate(subscription.current_period_end)})
              </p>
            </Alert>
          )}
        </Card>

        {/* Upgrade Options */}
        {availableUpgrades.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              {subscription.tier === SubscriptionTier.FREEMIUM
                ? 'Upgrade Your Plan'
                : 'Available Upgrades'}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {availableUpgrades.map((plan) => (
                <Card key={plan.tier} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                      {getPlanIcon(plan.tier)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        ${plan.price_monthly}/month
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automation Credits
                    </p>
                    <p className="text-xl font-bold">
                      {plan.credits_per_month === null
                        ? 'Unlimited'
                        : `${plan.credits_per_month}/month`}
                    </p>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {upgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Features List */}
        <Card className="p-8">
          <h3 className="text-xl font-bold mb-4">Your Plan Includes</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {currentPlan.features.map((feature, index) => (
              <div key={index} className="flex items-start">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
