import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar, Body, Button, Card, Row, Screen } from '@/components/ui';
import { ACCENT } from '@/constants/theme';
import { isReady, useChurch } from '@/lib/church';
import { goToChurch } from '@/lib/navigation';
import { publicUrl } from '@/lib/supabase';

export default function SwitchChurchScreen() {
  const { t } = useTranslation();
  const { memberships, active, setActiveChurch } = useChurch();

  async function choose(churchId: string) {
    await setActiveChurch(churchId);
    goToChurch(memberships, churchId);
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        {memberships.map((m) => (
          <Row
            key={m.church_id}
            title={m.church.name}
            subtitle={isReady(m) ? t(`roles.${m.role}`) : m.church.status === 'active' ? t('switchChurch.waiting') : t('switchChurch.beingVerified')}
            left={<Avatar name={m.church.name} uri={publicUrl('church-logos', m.church.logo_path)} color={ACCENT} />}
            right={m.church_id === active?.church_id ? <Body>✓</Body> : undefined}
            onPress={() => choose(m.church_id)}
          />
        ))}
      </Card>
      <Button title={t('more.joinAnother')} variant="secondary" onPress={() => router.push('/join')} />
    </Screen>
  );
}
