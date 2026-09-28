import { Body, Card, Screen, Title } from '@/components/ui';

// Shown to developers who start the app before adding the Supabase settings.
export default function SetupNeededScreen() {
  return (
    <Screen>
      <Title>Almost there</Title>
      <Body>The app isn&apos;t connected to a Supabase project yet.</Body>
      <Card>
        <Body>1. Copy .env.example to .env</Body>
        <Body>2. Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY</Body>
        <Body>3. Restart with npx expo start</Body>
      </Card>
      <Body muted>The README has the full steps.</Body>
    </Screen>
  );
}
