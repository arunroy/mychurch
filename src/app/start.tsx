import { router } from 'expo-router';
import { useEffect } from 'react';

import { Body, Button, Card, Heading, Screen, Title } from '@/components/ui';
import { signOut, useIsPlatformAdmin, useProfile } from '@/lib/auth';
import { getPendingInviteCode } from '@/lib/invite';

// Signed in but not part of any church yet.
export default function StartScreen() {
  const profile = useProfile();
  const isPlatformAdmin = useIsPlatformAdmin();
  const firstName = profile.data?.full_name.split(' ')[0];

  // Came from an invite link: go straight to joining.
  useEffect(() => {
    getPendingInviteCode().then((code) => code && router.push('/join'));
  }, []);

  return (
    <Screen>
      <Title>Hi {firstName}</Title>
      <Body muted>Let&apos;s find your church.</Body>

      <Card>
        <Heading>Join your church</Heading>
        <Body muted>Use the code or link your church shared, or search by name.</Body>
        <Button title="Join a church" onPress={() => router.push('/join')} />
      </Card>

      <Card>
        <Heading>Bring your church to MyChurch</Heading>
        <Body muted>For Pastors and church office staff. We check every church before it goes live.</Body>
        <Button title="Register a church" variant="secondary" onPress={() => router.push('/register')} />
      </Card>

      {isPlatformAdmin.data ? (
        <Button title="Verify churches" variant="secondary" onPress={() => router.push('/review-churches')} />
      ) : null}
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
