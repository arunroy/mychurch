import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, ErrorText, Heading, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDeleteNote, useSaveNote } from '@/lib/bible-notes';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { BibleNote } from '@/lib/database.types';
import { useAsk } from '@/lib/qa';
import { friendlyError } from '@/lib/supabase';
import { useThemePreference } from '@/lib/theme-preference';

/** A bottom sheet for the person's own note on one verse. Only they can ever read it. */
export function VerseNoteSheet({
  reference,
  verseText,
  book,
  chapter,
  verse,
  existing,
  onClose,
}: {
  /** Like "John 3:16". */
  reference: string;
  verseText: string;
  book: string;
  chapter: number;
  verse: number;
  existing: BibleNote | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { scheme } = useThemePreference();
  const { isPastor } = usePermissions();
  const save = useSaveNote();
  const remove = useDeleteNote();
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({ book, chapter, verse, body: body.trim(), existing });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    setError(null);
    try {
      await remove.mutateAsync(existing.id);
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#171A1F' : '#FFFFFF' }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Heading>{reference}</Heading>
            <Text style={[styles.verse, { color: theme.textSecondary }]}>{verseText}</Text>
            <TextField
              label={t('notes.yourNote')}
              hint={t('notes.onlyYou')}
              value={body}
              onChangeText={setBody}
              multiline
              autoFocus
              maxLength={2000}
              placeholder={t('notes.placeholder')}
              style={{ minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }}
            />
            <ErrorText>{error}</ErrorText>
            <Button title={existing ? t('notes.saveChanges') : t('notes.saveNote')} onPress={onSave} loading={save.isPending} disabled={!body.trim() || body.trim() === existing?.body} />
            {existing ? <Button title={t('notes.deleteNote')} variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
            {isPastor ? null : <AskPastor reference={reference} />}
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
              <Body muted>{t('common.cancel')}</Body>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Sends a question about this verse to the Pastor through the church's Questions and answers, so it is
 * answered and shared the same way as any other question. The person's private note is never sent: only
 * the question they type here, headed with the verse reference.
 */
function AskPastor({ reference }: { reference: string }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const ask = useAsk(church_id);
  const [question, setQuestion] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // The Questions screen holds up to 500 characters in all, and the heading takes some of them.
  const heading = t('notes.aboutHeading', { reference });

  async function onSend() {
    setError(null);
    setSent(false);
    try {
      await ask.mutateAsync({ body: heading + question.trim(), anonymous });
      setQuestion('');
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <View style={styles.ask}>
      <Heading>{t('notes.askTitle')}</Heading>
      <Body muted>{t('notes.askIntro')}</Body>
      <TextField
        label={t('notes.yourQuestion')}
        value={question}
        onChangeText={(text) => {
          setQuestion(text);
          setSent(false);
        }}
        multiline
        maxLength={500 - heading.length}
        style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <ToggleRow
        title={t('notes.anonymous')}
        subtitle={t('notes.anonymousHint')}
        value={anonymous}
        onValueChange={setAnonymous}
      />
      <ErrorText>{error}</ErrorText>
      {sent ? <Body>{t('notes.thanks')}</Body> : null}
      <Button title={t('notes.send')} variant="secondary" onPress={onSend} loading={ask.isPending} disabled={!question.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { gap: Spacing.three, marginTop: Spacing.three },
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  content: { padding: Spacing.four, gap: Spacing.three },
  verse: { fontSize: 16, lineHeight: 23, fontStyle: 'italic' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
