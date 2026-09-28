import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { sendSignInCode, verifySignInCode } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailLooksValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await sendSignInCode(email);
      setCodeSent(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      // On success the session changes and the app moves on by itself.
      await verifySignInCode(email, code);
    } catch {
      setError('That code didn’t work. Check it, or send a new one.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Title>Welcome to MyChurch</Title>
        <Body muted>Stay connected with your church family. Sign in with your email, no password needed.</Body>

        {!codeSent ? (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="send"
              onSubmitEditing={() => emailLooksValid && sendCode()}
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Send me a code" onPress={sendCode} loading={busy} disabled={!emailLooksValid} />
          </>
        ) : (
          <>
            <Body>We sent a code to {email.trim()}. Enter it below.</Body>
            <TextField
              label="Code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={8}
              placeholder="123456"
              autoFocus
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Sign in" onPress={verify} loading={busy} disabled={code.length < 6} />
            <Button title="Send a new code" variant="secondary" onPress={sendCode} disabled={busy} />
            <Button
              title="Use a different email"
              variant="secondary"
              onPress={() => {
                setCodeSent(false);
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
