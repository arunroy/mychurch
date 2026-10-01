import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
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
        <Heading>Write to the Pastor</Heading>
        <Body muted>
          Your name is not saved with this message. The Pastor, the elders and everyone else in the app can read it but not see who
          wrote it. You can send up to 3 a day.
        </Body>
      </Card>

      <ErrorText>{error}</ErrorText>

      {sent ? (
        <Card>
          <Heading>Sent</Heading>
          {sentCode ? (
            <>
              <Body>Your reply code is:</Body>
              <Text selectable style={[styles.code, { color: theme.text }]}>
                {sentCode}
              </Text>
              <Body muted>
                It is saved on this phone, so you can check for the Pastor&apos;s answer below. Keep it safe: it is the only way to
                see a reply, and it cannot be recovered.
              </Body>
              <Button
                title={copied ? 'Copied' : 'Copy the code'}
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(sentCode);
                  setCopied(true);
                }}
              />
            </>
          ) : (
            <Body muted>The Pastor will read it. Since you did not ask for a reply, there will not be one.</Body>
          )}
        </Card>
      ) : null}

      <Card>
        <TextField
          label="Your message"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <ToggleRow
          title="I would like a reply"
          subtitle="You get a code to check back with. Without one, the Pastor cannot answer you."
          value={wantReply}
          onValueChange={setWantReply}
        />
        <Button title="Send anonymously" onPress={onSend} loading={send.isPending} disabled={!body.trim()} />
      </Card>

      <Card>
        <Heading>Check for a reply</Heading>
        {saved.data && saved.data.length > 0 ? (
          saved.data.map((item) => <SavedReply key={item.code} item={item} />)
        ) : (
          <Body muted>Codes from messages you send from this phone appear here.</Body>
        )}
        <TextField
          label="Or type a code"
          value={typedCode}
          onChangeText={setTypedCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
        <Button title="Check" variant="secondary" onPress={onCheckTyped} loading={checking} disabled={typedCode.trim().length < 8} />
        {typedResult ? <ReplyResult result={typedResult} /> : null}
      </Card>
      <Gap />
    </Screen>
  );
}

function ReplyResult({ result }: { result: AnonymousReplyCheck }) {
  if (!result.found) return <Body muted>No message matches that code.</Body>;
  if (!result.reply) return <Body muted>No reply yet. Check back later.</Body>;
  return (
    <View style={styles.reply}>
      <Body muted>{`The Pastor replied${result.replied_on ? ` on ${shortDate(result.replied_on)}` : ''}:`}</Body>
      <Body>{result.reply}</Body>
    </View>
  );
}

function SavedReply({ item }: { item: SavedCode }) {
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
      <Button title="Check for a reply" variant="secondary" onPress={check} loading={checking} />
      {result ? <ReplyResult result={result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  reply: { gap: Spacing.one },
  saved: { gap: Spacing.two },
});
