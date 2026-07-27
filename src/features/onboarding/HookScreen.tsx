/** S02 — Onboarding: Hook. route: /onboarding/hook. Features: F9. */
import { useRouter, type Href } from 'expo-router';
import { Sprout } from 'lucide-react-native';
import { View } from 'react-native';

import { useUpdateSettings } from '@/queries';
import { now } from '@/lib/date';

import { S02_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { finishOnboardingProgress, useOnboardingResumeRedirect } from './useOnboardingResume';

export function HookScreen() {
  const router = useRouter();
  const updateSettings = useUpdateSettings();
  const { resuming } = useOnboardingResumeRedirect('/onboarding/hook');

  async function handleSkip() {
    // F9 edge case: a failed persist here is a silent retry-on-next-launch, never a blocking
    // error — the user still advances (S02's own spec, "States > Error").
    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    router.replace('/today' as Href);
  }

  function handleNext() {
    router.push('/onboarding/concept' as Href);
  }

  if (resuming) return <View accessibilityLabel="Loading" />;

  return (
    <OnboardingShell step={1} icon={Sprout} headline={S02_COPY.headline} body={S02_COPY.body} onNext={handleNext} onSkip={handleSkip} />
  );
}
