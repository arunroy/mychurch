import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Gap, Heading, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkReply, useSavedCodes, useSendAnonymous, type SavedCode } from '@/lib/anonymous';
import { useActiveChurch } from '@/lib/church';
import type { AnonymousReplyCheck } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { friendlyError } from '@/lib/supabase';

// Write to the Pastor without your name attached. If you want an answer you get a code to check back with.
export default function AnonymousScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const theme = useTheme();
  const send = useSendAnonymous(church_id);
  const saved = useSavedCodes();
  const [body, setBody] = useState('');
  const [wantReply, setWantReply] = useState(false);
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typedCode, setTypedCode] = useState('');
  const [typedResult, setTypedResult] = useState<AnonymousReplyCheck | null>(null);
  const [checking, setChecking] = useState(false);

  async function onSend() {
    setError(null);
    setSent(false);
    setSentCode(null);
    setCopied(false);
    try {
      const code = await send.mutateAsync({ body: body.trim(), wantReply });
      setSentCode(code);
      setSent(true);
      setBody('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function onCheckTyped() {
    setError(null);
    setChecking(true);
    try {
      setTypedResult(await checkReply(typedCode));
    } catch (e) {
      setError(friendlyError(e));
    }
    setChecking(false);
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{t('anonymous.writeTitle')}</Heading>
        <Body muted>{t('anonymous.intro')}</Body>
      </Card>

      <ErrorText>{error}</ErrorText>

      {sent ? (
        <Card>
          <Heading>{t('anonymous.sent')}</Heading>
          {sentCode ? (
            <>
              <Body>{t('anonymous.replyCode')}</Body>
              <Text selectable style={[styles.code, { color: theme.text }]}>
                {sentCode}
              </Text>
              <Body muted>{t('anonymous.codeNote')}</Body>
              <Button
                title={copied ? t('invite.copied') : t('anonymous.copyCode')}
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(sentCode);
                  setCopied(true);
                }}
              />
            </>
          ) : (
            <Body muted>{t('anonymous.noReplyAsked')}</Body>
          )}
        </Card>
      ) : null}

      <Card>
        <TextField
          label={t('anonymous.yourMessage')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <ToggleRow
          title={t('anonymous.wantReply')}
          subtitle={t('anonymous.wantReplyHint')}
          value={wantReply}
          onValueChange={setWantReply}
        />
        <Button title={t('anonymous.sendAnon')} onPress={onSend} loading={send.isPending} disabled={!body.trim()} />
      </Card>

      <Card>
        <Heading>{t('anonymous.checkTitle')}</Heading>
        {saved.data && saved.data.length > 0 ? (
          saved.data.map((item) => <SavedReply key={item.code} item={item} />)
        ) : (
          <Body muted>{t('anonymous.noCodes')}</Body>
        )}
        <TextField
          label={t('anonymous.typeCode')}
          value={typedCode}
          onChangeText={setTypedCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
        <Button title={t('anonymous.check')} variant="secondary" onPress={onCheckTyped} loading={checking} disabled={typedCode.trim().length < 8} />
        {typedResult ? <ReplyResult result={typedResult} /> : null}
      </Card>
      <Gap />
    </Screen>
  );
}

function ReplyResult({ result }: { result: AnonymousReplyCheck }) {
  const { t } = useTranslation();
  if (!result.found) return <Body muted>{t('anonymous.noMatch')}</Body>;
  if (!result.reply) return <Body muted>{t('anonymous.noReplyYet')}</Body>;
  return (
    <View style={styles.reply}>
      <Body muted>{result.replied_on ? t('anonymous.repliedOn', { date: shortDate(result.replied_on) }) : t('anonymous.replied')}</Body>
      <Body>{result.reply}</Body>
    </View>
  );
}

function SavedReply({ item }: { item: SavedCode }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<AnonymousReplyCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    setChecking(true);
    try {
      setResult(await checkReply(item.code));
    } catch (e) {
      setError(friendlyError(e));
    }
    setChecking(false);
  }

  return (
    <View style={styles.saved}>
      <Body muted>{`${shortDate(`${item.sentOn}T12:00:00`)} · ${item.preview}`}</Body>
      <ErrorText>{error}</ErrorText>
      <Button title={t('anonymous.checkTitle')} variant="secondary" onPress={check} loading={checking} />
      {result ? <ReplyResult result={result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  reply: { gap: Spacing.one },
  saved: { gap: Spacing.two },
});
