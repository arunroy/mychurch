import { router, usePathname } from 'expo-router';

import { useShakeDetector, useShakePreference } from '@/lib/shake';

/** Shaking the phone while the app is open takes the person straight to SOS, with the cancel countdown already running. */
export function ShakeToSos() {
  const [enabled] = useShakePreference();
  const pathname = usePathname();
  // The SOS screens handle themselves; a shake there must not stack another one on top.
  const onSos = pathname === '/sos' || pathname === '/sos-alert';

  useShakeDetector(enabled && !onSos, () => router.push({ pathname: '/sos', params: { start: '1' } }));
  return null;
}
