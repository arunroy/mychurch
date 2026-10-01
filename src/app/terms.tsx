import { LegalPage } from '@/components/legal-page';
import { TERMS } from '@/lib/legal';

// Reachable before signing in, from the sign-in screen, and from More afterwards.
export default function TermsScreen() {
  return <LegalPage document={TERMS} />;
}
