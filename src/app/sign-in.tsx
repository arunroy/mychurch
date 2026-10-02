import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { AppLanguagePicker } from '@/components/language-pickers';
import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { sendSignInCode, verifySignInCode } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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
      setError(t('signIn.badCode'));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppLanguagePicker showHeading={false} />
        <Title>{t('signIn.welcome')}</Title>
        <Body muted>{t('signIn.intro')}</Body>

        {!codeSent ? (
          <>
            <TextField
              label={t('common.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={t('signIn.emailPlaceholder')}
              returnKeyType="send"
              onSubmitEditing={() => emailLooksValid && sendCode()}
            />
            <ErrorText>{error}</ErrorText>
            <Button title={t('signIn.sendCode')} onPress={sendCode} loading={busy} disabled={!emailLooksValid} />
          </>
        ) : (
          <>
            <Body>{t('signIn.sentTo', { email: email.trim() })}</Body>
            <TextField
              label={t('signIn.code')}
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
            <Button title={t('signIn.signIn')} onPress={verify} loading={busy} disabled={code.length < 6} />
            <Button title={t('signIn.sendNewCode')} variant="secondary" onPress={sendCode} disabled={busy} />
            <Button
              title={t('signIn.differentEmail')}
              variant="secondary"
              onPress={() => {
                setCodeSent(false);
                setCode('');
                setError(null);
              }}
            />
          </>
        )}

        <Text style={[styles.legal, { color: theme.textSecondary }]}>
          {t('signIn.agree')}
          <Text style={[styles.link, { color: theme.text }]} accessibilityRole="link" onPress={() => router.push('/terms')}>
            {t('signIn.terms')}
          </Text>
          {t('signIn.and')}
          <Text style={[styles.link, { color: theme.text }]} accessibilityRole="link" onPress={() => router.push('/privacy')}>
            {t('signIn.privacy')}
          </Text>
          .
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  legal: { fontSize: 14, lineHeight: 20 },
  link: { textDecorationLine: 'underline', fontWeight: 600 },
});
