import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeaturesCard } from '@/components/features-card';
import { YoutubeChannelCard } from '@/components/youtube-channel-card';
import { Avatar, Button, Card, ErrorText, Heading, Screen, TextField, ToggleRow, Body } from '@/components/ui';
import { ACCENT } from '@/constants/theme';
import type { Church } from '@/lib/database.types';
import { useActiveChurch, useChurch } from '@/lib/church';
import { pickAndUploadImage } from '@/lib/images';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

type Editable = Partial<
  Pick<Church, 'name' | 'city' | 'contact_email' | 'logo_path' | 'banner_path' | 'requires_approval' | 'directory_enabled'>
>;

// Pastor and church admins only (the database enforces this too).
export default function ChurchSettingsScreen() {
  const { t } = useTranslation();
  const { church } = useActiveChurch();
  const { refresh } = useChurch();
  const [name, setName] = useState(church.name);
  const [city, setCity] = useState(church.city);
  const [email, setEmail] = useState(church.contact_email);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(changes: Editable, what: string) {
    setBusy(what);
    setError(null);
    const { error: saveError } = await supabase.from('churches').update(changes).eq('id', church.id);
    if (saveError) setError(friendlyError(saveError));
    else await refresh();
    setBusy(null);
  }

  async function changeLogo() {
    setBusy('logo');
    setError(null);
    try {
      const path = await pickAndUploadImage('church-logos', church.id);
      if (path) await save({ logo_path: path }, 'logo');
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(null);
  }

  async function changeBanner() {
    setBusy('banner');
    setError(null);
    try {
      // Uploaded as it is, so Home can show the whole photo at its own shape. Kept in the church's folder, beside the logo.
      const path = await pickAndUploadImage('church-logos', `${church.id}/banner`, null);
      if (path) await save({ banner_path: path }, 'banner');
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(null);
  }

  const detailsChanged = name.trim() !== church.name || city.trim() !== church.city || email.trim() !== church.contact_email;

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{t('settings.logo')}</Heading>
        <Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={ACCENT} size={72} />
        <Button title={t('settings.changeLogo')} variant="secondary" onPress={changeLogo} loading={busy === 'logo'} />
      </Card>

      <Card>
        <Heading>{t('settings.banner')}</Heading>
        {church.banner_path ? (
          <Image source={{ uri: publicUrl('church-logos', church.banner_path) ?? undefined }} style={{ width: '100%', aspectRatio: 2000 / 881, borderRadius: 10 }} contentFit="contain" />
        ) : null}
        <Body muted>{t('settings.bannerHint')}</Body>
        <Button title={church.banner_path ? t('settings.changeBanner') : t('settings.addBanner')} variant="secondary" onPress={changeBanner} loading={busy === 'banner'} />
        {church.banner_path ? (
          <Button title={t('settings.removeBanner')} variant="danger" onPress={() => save({ banner_path: null }, 'banner')} disabled={busy === 'banner'} />
        ) : null}
      </Card>

      <Card>
        <Heading>{t('settings.details')}</Heading>
        <TextField label={t('register.name')} value={name} onChangeText={setName} maxLength={120} />
        <TextField label={t('register.city')} value={city} onChangeText={setCity} maxLength={120} />
        <TextField
          label={t('settings.contactEmail')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button
          title={t('settings.saveDetails')}
          onPress={() => save({ name: name.trim(), city: city.trim(), contact_email: email.trim() }, 'details')}
          loading={busy === 'details'}
          disabled={!detailsChanged || name.trim().length < 2}
        />
      </Card>

      <FeaturesCard />

      <YoutubeChannelCard />

      <Card>
        <Heading>{t('settings.joining')}</Heading>
        <ToggleRow
          title={t('settings.approveTitle')}
          subtitle={
            church.requires_approval ? t('settings.approveOn') : t('settings.approveOff')
          }
          value={church.requires_approval}
          onValueChange={(value) => save({ requires_approval: value }, 'approval')}
          disabled={busy === 'approval'}
        />
        <ToggleRow
          title={t('settings.directoryTitle')}
          subtitle={t('settings.directoryHint')}
          value={church.directory_enabled}
          onValueChange={(value) => save({ directory_enabled: value }, 'directory')}
          disabled={busy === 'directory'}
        />
      </Card>
    </Screen>
  );
}
