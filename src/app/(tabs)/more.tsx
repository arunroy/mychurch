import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Linking, View } from 'react-native';

import { ThemeSettingsCard } from '@/components/theme-settings-card';
import { InviteCard } from '@/components/invite-card';
import { Avatar, Card, Row, Screen, Title } from '@/components/ui';
import { signOut, useIsPlatformAdmin, useProfile } from '@/lib/auth';
import { useActiveChurch, useChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { publicUrl } from '@/lib/supabase';

// Your profile, theme settings and account. Church features (members, prayer, polls and so on) live on Home.
export default function MoreScreen() {
  const { t } = useTranslation();
  const profile = useProfile();
  const active = useActiveChurch();
  const { memberships } = useChurch();
  const isPlatformAdmin = useIsPlatformAdmin();
  const { isLeader } = usePermissions();
  const name = profile.data?.full_name ?? '';

  return (
    <Screen edges={['top']}>
      <Title>{t('more.title')}</Title>

      <Card>
        <Row
          title={name}
          subtitle={t('more.roleAt', { role: t(`roles.${active.role}`), church: active.church.name })}
          left={<Avatar name={name} uri={publicUrl('avatars', profile.data?.avatar_path)} />}
          onPress={() => router.push('/profile')}
        />
      </Card>

      <Card>
        <Row
          title={t('shortcuts.sos')}
          subtitle={t('more.sosHint')}
          left={
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={22} color="#FFFFFF" />
            </View>
          }
          onPress={() => router.push('/sos')}
        />
        {isLeader ? <Row title={t('shortcuts.sosHistory')} onPress={() => router.push('/sos-history')} /> : null}
      </Card>

      <ThemeSettingsCard />

      <InviteCard />

      <Card>
        {memberships.length > 1 ? (
          <Row title={t('more.switchChurch')} subtitle={t('more.belongTo', { count: memberships.length })} onPress={() => router.push('/switch-church')} />
        ) : null}
        <Row title={t('more.joinAnother')} onPress={() => router.push('/join')} />
        <Row title={t('more.registerChurch')} onPress={() => router.push('/register')} />
        {isPlatformAdmin.data ? <Row title={t('more.verifyChurches')} onPress={() => router.push('/review-churches')} /> : null}
      </Card>

      <Card>
        <Row title={t('more.privacy')} onPress={() => router.push('/privacy')} />
        <Row title={t('more.terms')} onPress={() => router.push('/terms')} />
        {SUPPORT_EMAIL ? <Row title={t('more.contact')} subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} /> : null}
      </Card>

      <Card>
        <Row title={t('more.deleteAccount')} subtitle={t('more.deleteAccountHint')} onPress={() => router.push('/delete-account')} />
        <Row title={t('more.signOut')} onPress={() => confirm(t('more.signOutTitle'), t('more.signOutMessage'), t('more.signOut'), signOut)} />
      </Card>
    </Screen>
  );
}
