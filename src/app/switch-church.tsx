import { router } from 'expo-router';

import { Avatar, Body, Button, Card, Row, Screen } from '@/components/ui';
import { ROLE_LABELS, isReady, useChurch } from '@/lib/church';
import { goToChurch } from '@/lib/navigation';
import { publicUrl } from '@/lib/supabase';

export default function SwitchChurchScreen() {
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
            subtitle={isReady(m) ? ROLE_LABELS[m.role] : m.church.status === 'active' ? 'Waiting for approval' : 'Being verified'}
            left={<Avatar name={m.church.name} uri={publicUrl('church-logos', m.church.logo_path)} color={m.church.accent_color} />}
            right={m.church_id === active?.church_id ? <Body>✓</Body> : undefined}
            onPress={() => choose(m.church_id)}
          />
        ))}
      </Card>
      <Button title="Join another church" variant="secondary" onPress={() => router.push('/join')} />
    </Screen>
  );
}
