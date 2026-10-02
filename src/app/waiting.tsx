import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { ACCENT } from '@/constants/theme';
import { signOut, useIsPlatformAdmin, useUserId } from '@/lib/auth';
import { useChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

// The active church hasn't approved this person yet, or hasn't been verified itself.
export default function WaitingScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const { active, memberships, refresh } = useChurch();
  const isPlatformAdmin = useIsPlatformAdmin();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;
  const church = active.church;
  const isRegistrant = active.status === 'approved' && active.role === 'pastor';

  let heading = t('waiting.heading', { church: church.name });
  let detail = t('waiting.detail');
  if (church.status === 'pending') {
    heading = isRegistrant ? t('waiting.thanks') : t('waiting.beingSetUp', { church: church.name });
    detail = isRegistrant
      ? t('waiting.registrantDetail', { church: church.name, email: church.contact_email })
      : t('waiting.verifying');
  } else if (church.status === 'suspended') {
    heading = t('waiting.paused', { church: church.name });
    detail = t('waiting.pausedDetail');
  }

  async function checkAgain() {
    setChecking(true);
    await refresh().catch(() => {});
    setChecking(false);
  }

  function cancelRequest() {
    confirm(t('waiting.cancelTitle'), t('waiting.cancelMessage', { church: church.name }), t('waiting.cancelAction'), async () => {
      const { error: leaveError } = await supabase.rpc('remove_member', { p_church: church.id, p_user: userId! });
      if (leaveError) setError(friendlyError(leaveError));
      else await refresh();
    });
  }

  return (
    <Screen>
      <Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={ACCENT} size={72} />
      <Title>{heading}</Title>
      <Body muted>{detail}</Body>
      <Button title={t('waiting.checkAgain')} onPress={checkAgain} loading={checking} />

      <ErrorText>{error}</ErrorText>

      <Card>
        {memberships.length > 1 ? (
          <Button title={t('more.switchChurch')} variant="secondary" onPress={() => router.push('/switch-church')} />
        ) : null}
        <Button title={t('more.joinAnother')} variant="secondary" onPress={() => router.push('/join')} />
        {active.status === 'pending' ? (
          <Button title={t('waiting.cancelButton')} variant="danger" onPress={cancelRequest} />
        ) : null}
        {isPlatformAdmin.data ? (
          <Button title={t('more.verifyChurches')} variant="secondary" onPress={() => router.push('/review-churches')} />
        ) : null}
        <Button title={t('common.signOut')} variant="secondary" onPress={signOut} />
      </Card>
    </Screen>
  );
}
