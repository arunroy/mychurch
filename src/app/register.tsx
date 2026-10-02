import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ColorPicker } from '@/components/color-picker';
import { Body, Button, ErrorText, Screen, TextField } from '@/components/ui';
import { DEFAULT_ACCENT } from '@/constants/theme';
import { useChurch } from '@/lib/church';
import { goToChurch } from '@/lib/navigation';
import { friendlyError, supabase } from '@/lib/supabase';

export default function RegisterChurchScreen() {
  const { t } = useTranslation();
  const { refresh, setActiveChurch } = useChurch();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState(DEFAULT_ACCENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && city.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim());

  async function register() {
    setBusy(true);
    setError(null);
    const { data: churchId, error: registerError } = await supabase.rpc('register_church', {
      p_name: name.trim(),
      p_city: city.trim(),
      p_contact_email: email.trim(),
      p_accent_color: color,
    });
    if (registerError || !churchId) {
      setError(friendlyError(registerError));
      setBusy(false);
      return;
    }
    await setActiveChurch(churchId);
    goToChurch(await refresh(), churchId);
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('register.intro')}</Body>
      <TextField label={t('register.name')} value={name} onChangeText={setName} placeholder={t('join.searchPlaceholder')} maxLength={120} />
      <TextField label={t('register.city')} value={city} onChangeText={setCity} placeholder={t('register.cityPlaceholder')} maxLength={120} />
      <TextField
        label={t('register.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="office@gracechapel.org"
        hint={t('register.emailHint')}
      />
      <Body>{t('register.colour')}</Body>
      <ColorPicker value={color} onChange={setColor} />
      <ErrorText>{error}</ErrorText>
      <Button title={t('register.submit')} onPress={register} loading={busy} disabled={!valid} />
      <Body muted>{t('register.after')}</Body>
    </Screen>
  );
}
