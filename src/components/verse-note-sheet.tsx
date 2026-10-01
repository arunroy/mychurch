import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, ErrorText, Heading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDeleteNote, useSaveNote } from '@/lib/bible-notes';
import type { BibleNote } from '@/lib/database.types';
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
  const theme = useTheme();
  const { scheme } = useThemePreference();
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
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Heading>{reference}</Heading>
            <Text style={[styles.verse, { color: theme.textSecondary }]}>{verseText}</Text>
            <TextField
              label="Your note"
              hint="Only you can see your notes."
              value={body}
              onChangeText={setBody}
              multiline
              autoFocus
              maxLength={2000}
              placeholder="What is God saying to you in this verse?"
              style={{ minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }}
            />
            <ErrorText>{error}</ErrorText>
            <Button title={existing ? 'Save changes' : 'Save note'} onPress={onSave} loading={save.isPending} disabled={!body.trim() || body.trim() === existing?.body} />
            {existing ? <Button title="Delete note" variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
              <Body muted>Cancel</Body>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  content: { padding: Spacing.four, gap: Spacing.three },
  verse: { fontSize: 16, lineHeight: 23, fontStyle: 'italic' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
