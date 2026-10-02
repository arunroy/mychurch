import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, Heading, Screen, Title } from '@/components/ui';
import { signOut, useIsPlatformAdmin, useProfile } from '@/lib/auth';
import { getPendingInviteCode } from '@/lib/invite';

// Signed in but not part of any church yet.
export default function StartScreen() {
  const { t } = useTranslation();
  const profile = useProfile();
  const isPlatformAdmin = useIsPlatformAdmin();
  const firstName = profile.data?.full_name.split(' ')[0];

  // Came from an invite link: go straight to joining.
  useEffect(() => {
    getPendingInviteCode().then((code) => code && router.push('/join'));
  }, []);

  return (
    <Screen>
      <Title>{t('start.hi', { name: firstName })}</Title>
      <Body muted>{t('start.findChurch')}</Body>

      <Card>
        <Heading>{t('start.joinTitle')}</Heading>
        <Body muted>{t('start.joinHint')}</Body>
        <Button title={t('start.joinButton')} onPress={() => router.push('/join')} />
      </Card>

      <Card>
        <Heading>{t('start.bringTitle')}</Heading>
        <Body muted>{t('start.bringHint')}</Body>
        <Button title={t('start.registerButton')} variant="secondary" onPress={() => router.push('/register')} />
      </Card>

      {isPlatformAdmin.data ? (
        <Button title={t('more.verifyChurches')} variant="secondary" onPress={() => router.push('/review-churches')} />
      ) : null}
      <Button title={t('common.signOut')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
