import { LegalPage } from '@/components/legal-page';
import { PRIVACY } from '@/lib/legal';

// Reachable before signing in, from the sign-in screen, and from More afterwards.
export default function PrivacyScreen() {
  return <LegalPage document={PRIVACY} />;
}
