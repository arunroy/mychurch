import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { ThemeSettingsCard } from '@/components/theme-settings-card';
import { InviteCard } from '@/components/invite-card';
import { Avatar, IconSquare, ListSection, Row, Screen, Title } from '@/components/ui';
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

      <ListSection>
        <Row
          title={name}
          subtitle={t('more.roleAt', { role: t(`roles.${active.role}`), church: active.church.name })}
          left={<Avatar name={name} uri={publicUrl('avatars', profile.data?.avatar_path)} size={52} />}
          onPress={() => router.push('/profile')}
        />
      </ListSection>

      <ListSection inset={44}>
        <Row title={t('shortcuts.sos')} subtitle={t('more.sosHint')} left={<IconSquare icon="warning" color="red" />} onPress={() => router.push('/sos')} />
        {isLeader ? (
          <Row title={t('shortcuts.sosHistory')} left={<IconSquare icon="shield-checkmark" color="gray" />} onPress={() => router.push('/sos-history')} />
        ) : null}
      </ListSection>

      <ThemeSettingsCard />

      <InviteCard />

      <ListSection inset={44}>
        {memberships.length > 1 ? (
          <Row
            title={t('more.switchChurch')}
            subtitle={t('more.belongTo', { count: memberships.length })}
            left={<IconSquare icon="swap-horizontal" color="blue" />}
            onPress={() => router.push('/switch-church')}
          />
        ) : null}
        <Row title={t('more.joinAnother')} left={<IconSquare icon="enter-outline" color="green" />} onPress={() => router.push('/join')} />
        <Row title={t('more.registerChurch')} left={<IconSquare icon="add" color="indigo" />} onPress={() => router.push('/register')} />
        {isPlatformAdmin.data ? (
          <Row title={t('more.verifyChurches')} left={<IconSquare icon="checkmark-done" color="teal" />} onPress={() => router.push('/review-churches')} />
        ) : null}
      </ListSection>

      <ListSection inset={44}>
        <Row title={t('more.privacy')} left={<IconSquare icon="hand-left-outline" color="blue" />} onPress={() => router.push('/privacy')} />
        <Row title={t('more.terms')} left={<IconSquare icon="document-text-outline" color="gray" />} onPress={() => router.push('/terms')} />
        {SUPPORT_EMAIL ? (
          <Row
            title={t('more.contact')}
            subtitle={SUPPORT_EMAIL}
            left={<IconSquare icon="mail-outline" color="cyan" />}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        ) : null}
      </ListSection>

      <ListSection inset={44}>
        <Row
          title={t('more.deleteAccount')}
          subtitle={t('more.deleteAccountHint')}
          left={<IconSquare icon="trash-outline" color="red" />}
          onPress={() => router.push('/delete-account')}
        />
        <Row
          title={t('more.signOut')}
          left={<IconSquare icon="log-out-outline" color="gray" />}
          onPress={() => confirm(t('more.signOutTitle'), t('more.signOutMessage'), t('more.signOut'), signOut)}
        />
      </ListSection>
    </Screen>
  );
}
