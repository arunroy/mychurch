import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { signOut, useUserId } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';

// First sign-in: ask for the name church members will see.
export default function WelcomeScreen() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', userId);
    if (saveError) {
      setError(friendlyError(saveError));
      setBusy(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  }

  return (
    <Screen>
      <Title>What&apos;s your name?</Title>
      <Body muted>This is how your Pastor and church family will see you.</Body>
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        placeholder="Mary Johnson"
        maxLength={100}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => name.trim().length >= 2 && save()}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Continue" onPress={save} loading={busy} disabled={name.trim().length < 2} />
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
