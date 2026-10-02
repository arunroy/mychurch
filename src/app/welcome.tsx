import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { signOut, useUserId } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';

// First sign-in: ask for the name church members will see.
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', userId)
      .select('id');
    if (saveError || !data?.length) {
      // No row updated means the account has no profile (it was created before the database was set up).
      setError(saveError ? friendlyError(saveError) : t('welcome.noProfile'));
      setBusy(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  }

  return (
    <Screen>
      <Title>{t('welcome.title')}</Title>
      <Body muted>{t('welcome.intro')}</Body>
      <TextField
        label={t('profile.yourName')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        placeholder={t('welcome.placeholder')}
        maxLength={100}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => name.trim().length >= 2 && save()}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={t('common.continue')} onPress={save} loading={busy} disabled={name.trim().length < 2} />
      <Button title={t('common.signOut')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
