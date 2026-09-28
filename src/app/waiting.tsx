import { router } from 'expo-router';
import { useState } from 'react';

import { Avatar, Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { signOut, useIsPlatformAdmin, useUserId } from '@/lib/auth';
import { useChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

// The active church hasn't approved this person yet, or hasn't been verified itself.
export default function WaitingScreen() {
  const userId = useUserId();
  const { active, memberships, refresh } = useChurch();
  const isPlatformAdmin = useIsPlatformAdmin();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;
  const church = active.church;
  const isRegistrant = active.status === 'approved' && active.role === 'pastor';

  let heading = `Waiting for ${church.name} to approve you`;
  let detail = 'A Pastor or elder will approve your request soon. You’ll be let in as soon as they do.';
  if (church.status === 'pending') {
    heading = isRegistrant ? 'Thanks for registering your church' : `${church.name} is being set up`;
    detail = isRegistrant
      ? `We’re confirming ${church.name} is a real church and may contact you at ${church.contact_email}. Once it’s verified, this screen lets you in and you can invite your members.`
      : 'This church is still being verified. You’ll be able to join once it is.';
  } else if (church.status === 'suspended') {
    heading = `${church.name} is paused`;
    detail = 'This church isn’t available on MyChurch right now. Contact your church office for details.';
  }

  async function checkAgain() {
    setChecking(true);
    await refresh().catch(() => {});
    setChecking(false);
  }

  function cancelRequest() {
    confirm('Cancel your request?', `You can ask to join ${church.name} again later.`, 'Cancel request', async () => {
      const { error: leaveError } = await supabase.rpc('remove_member', { p_church: church.id, p_user: userId! });
      if (leaveError) setError(friendlyError(leaveError));
      else await refresh();
    });
  }

  return (
    <Screen>
      <Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={church.accent_color} size={72} />
      <Title>{heading}</Title>
      <Body muted>{detail}</Body>
      <Button title="Check again" onPress={checkAgain} loading={checking} />

      <ErrorText>{error}</ErrorText>

      <Card>
        {memberships.length > 1 ? (
          <Button title="Switch church" variant="secondary" onPress={() => router.push('/switch-church')} />
        ) : null}
        <Button title="Join another church" variant="secondary" onPress={() => router.push('/join')} />
        {active.status === 'pending' ? (
          <Button title="Cancel my request" variant="danger" onPress={cancelRequest} />
        ) : null}
        {isPlatformAdmin.data ? (
          <Button title="Verify churches" variant="secondary" onPress={() => router.push('/review-churches')} />
        ) : null}
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </Card>
    </Screen>
  );
}
