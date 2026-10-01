import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { Question, QuestionVisibility } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { useAnswer, useAsk, useQuestions, useRemoveQuestion, useSetVisibility, VISIBILITY_CHOICES } from '@/lib/qa';
import { friendlyError } from '@/lib/supabase';

// Ask the Pastor a question. Only the Pastor sees it at first. The Pastor answers it, and decides whether it stays
// private, is shared with the church leaders, or is shared with the whole church.
export default function QaScreen() {
  const { church_id } = useActiveChurch();
  const { isPastor, isLeader } = usePermissions();
  const questions = useQuestions(church_id);
  const ask = useAsk(church_id);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const all = questions.data ?? [];
  const church = all.filter((q) => q.visibility === 'church');
  // The Pastor sees everything: unanswered first, then answered ones by who they are shared with.
  const waiting = isPastor ? all.filter((q) => !q.answer) : [];
  const privateAnswered = isPastor ? all.filter((q) => q.answer && q.visibility === 'pastor') : [];
  const leaders = all.filter((q) => q.visibility === 'leaders' && (isLeader || isPastor) && (!isPastor || q.answer));
  // Everyone else only gets their own questions back from the database.
  const mine = isPastor ? [] : all.filter((q) => q.visibility !== 'church' && !(isLeader && q.visibility === 'leaders'));

  async function onAsk() {
    setError(null);
    setAsked(false);
    try {
      await ask.mutateAsync({ body: text.trim(), anonymous });
      setText('');
      setAsked(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>Ask a question</Heading>
        <Body muted>
          Your question goes to the Pastor first. The Pastor may answer it, and can choose to share it and its answer with the church
          leaders or the whole church.
        </Body>
        <TextField
          label="Your question"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <ToggleRow
          title="Don’t show my name"
          subtitle="Nothing is kept that says who asked, so you can’t take it back, and you will only see the answer if the Pastor shares it with the church. Limited to 5 a day."
          value={anonymous}
          onValueChange={setAnonymous}
        />
        <ErrorText>{error}</ErrorText>
        {asked ? <Body>Thank you. Your question has gone to the Pastor.</Body> : null}
        <Button title="Ask" onPress={onAsk} loading={ask.isPending} disabled={!text.trim()} />
      </Card>

      <ErrorText>{questions.error ? friendlyError(questions.error) : null}</ErrorText>
      {questions.isPending ? <Loading /> : null}

      <Group title="Waiting for your answer" items={waiting} />
      <Group title="Answered, only you can see" items={privateAnswered} />
      <Group title="Your questions" items={mine} />
      <Group title="Shared with the church leaders" items={leaders} />
      <Group title="Shared with the whole church" items={church} />

      {!questions.isPending && all.length === 0 ? (
        <Body muted>{isPastor ? 'No questions yet.' : 'Nothing has been shared yet. Ask a question above.'}</Body>
      ) : null}
      <Gap />
    </Screen>
  );
}

function Group({ title, items }: { title: string; items: Question[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Heading>{title}</Heading>
      {items.map((question) => (
        <QuestionCard key={question.id} question={question} />
      ))}
    </>
  );
}

function visibilityText(visibility: QuestionVisibility, isMine: boolean) {
  if (visibility === 'church') return 'Shared with the whole church';
  if (visibility === 'leaders') return 'Shared with the church leaders';
  return `Private · only the Pastor${isMine ? ' and you' : ''} can see this`;
}

function QuestionCard({ question }: { question: Question }) {
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const answer = useAnswer(church_id);
  const setVisibility = useSetVisibility(church_id);
  const remove = useRemoveQuestion(church_id);
  const [text, setText] = useState(question.answer ?? '');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function choose(visibility: QuestionVisibility) {
    if (visibility === question.visibility) return;
    if (visibility === 'church' && !question.answer) {
      setError('Answer the question first, then you can share it with the whole church.');
      return;
    }
    run(() => setVisibility.mutateAsync({ questionId: question.id, visibility }));
  }

  const canRemove = isPastor || question.is_mine;

  return (
    <Card>
      <Body muted>{`${question.asker_name || 'Anonymous'} · ${shortDate(question.asked_at)}`}</Body>
      <Body>{question.body}</Body>
      <Body muted>{visibilityText(question.visibility, question.is_mine)}</Body>
      <ErrorText>{error}</ErrorText>

      {question.answer && !editing ? (
        <>
          <Body muted>{`Answer from ${question.answered_by_name || 'the Pastor'}`}</Body>
          <Body>{question.answer}</Body>
        </>
      ) : null}
      {!question.answer && !isPastor ? <Body muted>Waiting for the Pastor to answer.</Body> : null}

      {isPastor && (!question.answer || editing) ? (
        <>
          <TextField
            label="Your answer"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
            hint="You choose below who can read this."
          />
          <Button
            title="Save answer"
            loading={answer.isPending}
            disabled={!text.trim()}
            onPress={() =>
              run(async () => {
                await answer.mutateAsync({ questionId: question.id, answer: text.trim() });
                setEditing(false);
              })
            }
          />
        </>
      ) : null}

      {isPastor ? (
        <>
          <Body>Who can see this?</Body>
          <View style={styles.chips}>
            {VISIBILITY_CHOICES.map((choice) => (
              <Chip key={choice.value} label={choice.label} selected={question.visibility === choice.value} onPress={() => choose(choice.value)} />
            ))}
          </View>
          {!question.answer ? <Body muted>Sharing with the whole church needs an answer first.</Body> : null}
          {question.answer && !editing ? <Button title="Edit the answer" variant="secondary" onPress={() => setEditing(true)} /> : null}
        </>
      ) : null}

      {canRemove ? (
        <Button
          title="Remove"
          variant="danger"
          loading={remove.isPending}
          onPress={() =>
            confirm('Remove this question?', 'It disappears for everyone, along with its answer.', 'Remove', () =>
              run(() => remove.mutateAsync(question.id)),
            )
          }
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
