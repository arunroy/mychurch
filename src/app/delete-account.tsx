import { useState } from 'react';

import { Body, Button, Card, ErrorText, Gap, Heading, Screen, TextField } from '@/components/ui';
import { deleteMyAccount } from '@/lib/account';
import { friendlyError } from '@/lib/supabase';

// Permanently deletes the account. Reachable from More and from the profile, also for people who have no church yet.
export default function DeleteAccountScreen() {
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
        <Heading>Delete my account</Heading>
        <Body>This is permanent. It cannot be undone.</Body>
      </Card>

      <Card>
        <Heading>What is deleted</Heading>
        <Body>• Your profile, photo and email sign-in</Body>
        <Body>• Your membership of every church you belong to</Body>
        <Body>• Your private messages and messages to the elders. The other person loses those conversations too.</Body>
        <Body>• Your church chat messages, prayer requests and the prayers you added, your polls and votes, and your RSVPs</Body>
        <Body>• The articles and outside sermon links you submitted</Body>
        <Body>• Your notification settings and the reply codes saved on this phone</Body>
      </Card>

      <Card>
        <Heading>What stays</Heading>
        <Body>• Events and daily verses you added for the church, and answers you gave as a leader, without your name</Body>
        <Body>• Anonymous messages and questions. Nothing links them to you.</Body>
      </Card>

      <Card>
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Delete my account for good" variant="danger" onPress={onDelete} loading={busy} disabled={!confirmed} />
      </Card>
      <Gap />
    </Screen>
  );
}
