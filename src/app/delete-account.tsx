import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Heading, Screen, TextField } from '@/components/ui';
import { deleteMyAccount } from '@/lib/account';
import { friendlyError } from '@/lib/supabase';

// Permanently deletes the account. Reachable from More and from the profile, also for people who have no church yet.
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim().toUpperCase() === 'DELETE';

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      // On success the session ends and the app returns to the sign-in screen by itself.
      await deleteMyAccount();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{t('deleteAccount.title')}</Heading>
        <Body>{t('deleteAccount.permanent')}</Body>
      </Card>

      <Card>
        <Heading>{t('deleteAccount.whatDeleted')}</Heading>
        <Body>{t('deleteAccount.d1')}</Body>
        <Body>{t('deleteAccount.d2')}</Body>
        <Body>{t('deleteAccount.d3')}</Body>
        <Body>{t('deleteAccount.d4')}</Body>
        <Body>{t('deleteAccount.d5')}</Body>
        <Body>{t('deleteAccount.d6')}</Body>
      </Card>

      <Card>
        <Heading>{t('deleteAccount.whatStays')}</Heading>
        <Body>{t('deleteAccount.s1')}</Body>
        <Body>{t('deleteAccount.s2')}</Body>
      </Card>

      <Card>
        <TextField
          label={t('deleteAccount.typeDelete')}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
        />
        <ErrorText>{error}</ErrorText>
        <Button title={t('deleteAccount.button')} variant="danger" onPress={onDelete} loading={busy} disabled={!confirmed} />
      </Card>
      <Gap />
    </Screen>
  );
}
