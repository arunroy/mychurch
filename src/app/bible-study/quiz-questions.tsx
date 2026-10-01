import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Row, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { dateKey, formatDay, isValidDateKey, parseDateKey } from '@/lib/dates';
import type { QuizLevel, QuizQuestion } from '@/lib/database.types';
import { useAddQuizQuestion, useQuizQuestions, useRemoveQuizQuestion } from '@/lib/quiz';
import { LEVELS, mondayKey } from '@/lib/quiz-round';
import { friendlyError } from '@/lib/supabase';

const LETTERS = ['A', 'B', 'C', 'D'];

// Leaders (Pastor, elders, admins) write the church's own questions, and can plan them for a week.
export default function QuizQuestionsScreen() {
  const { isLeader } = usePermissions();
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor, elders and church admins can write quiz questions.</Body>
      </Screen>
    );
  }
  return <Manager />;
}

function levelLabel(level: QuizLevel) {
  return LEVELS.find((l) => l.level === level)?.label ?? level;
}

function Manager() {
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const all = useQuizQuestions(church_id);
  const add = useAddQuizQuestion(church_id, userId);
  const remove = useRemoveQuizQuestion(church_id);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correct, setCorrect] = useState(0);
  const [level, setLevel] = useState<QuizLevel>('kids');
  const [reference, setReference] = useState('');
  const [explanation, setExplanation] = useState('');
  const [planned, setPlanned] = useState(false);
  const [week, setWeek] = useState(dateKey());
  const [error, setError] = useState<string | null>(null);

  const filled = options.map((o) => o.trim());
  const valid = question.trim().length > 0 && filled.every(Boolean) && correct < options.length && (!planned || isValidDateKey(week));
  const weekOf = planned ? mondayKey(parseDateKey(week)) : null;

  function setOption(i: number, text: string) {
    setOptions((list) => list.map((o, j) => (j === i ? text : o)));
  }

  function removeOption(i: number) {
    setOptions((list) => list.filter((_, j) => j !== i));
    setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c));
  }

  async function onAdd() {
    setError(null);
    try {
      await add.mutateAsync({
        question: question.trim(),
        options: filled,
        correctIndex: correct,
        explanation: explanation.trim(),
        reference: reference.trim(),
        level,
        weekOf,
      });
      setQuestion('');
      setOptions(['', '']);
      setCorrect(0);
      setReference('');
      setExplanation('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove(item: QuizQuestion) {
    confirm('Remove this question?', `"${item.question}" will be taken out of the quiz.`, 'Remove', async () => {
      try {
        await remove.mutateAsync(item.id);
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  const thisWeek = mondayKey();
  const list = all.data ?? [];
  const ahead = list.filter((q) => q.week_of && q.week_of > thisWeek).sort((a, b) => (a.week_of! < b.week_of! ? -1 : 1));
  const running = list.filter((q) => !q.week_of || q.week_of <= thisWeek);

  const describe = (q: QuizQuestion) =>
    `${levelLabel(q.level)} · ${q.week_of ? `week of ${formatDay(q.week_of)}` : 'any week'}`;

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error ?? (all.error ? friendlyError(all.error) : null)}</ErrorText>

      <Card>
        <Heading>New question</Heading>
        <Body>Level</Body>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l.level} label={l.label} selected={l.level === level} onPress={() => setLevel(l.level)} />
          ))}
        </View>
        <TextField
          label="Question"
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={200}
          placeholder="Who built the ark?"
          style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
        />
        {options.map((option, i) => (
          <View key={i} style={styles.option}>
            <TextField
              label={`Choice ${LETTERS[i]}`}
              value={option}
              onChangeText={(text) => setOption(i, text)}
              maxLength={100}
              hint={i === correct ? 'This is the right answer.' : undefined}
            />
            <View style={styles.chips}>
              <Chip label={i === correct ? 'Right answer' : 'Make this the right answer'} selected={i === correct} onPress={() => setCorrect(i)} />
              {options.length > 2 ? <Chip label="Remove choice" onPress={() => removeOption(i)} /> : null}
            </View>
          </View>
        ))}
        {options.length < 4 ? <Button title="Add another choice" variant="secondary" onPress={() => setOptions((list) => [...list, ''])} /> : null}
        <TextField label="Where to read it (optional)" value={reference} onChangeText={setReference} maxLength={60} placeholder="Genesis 6:14" />
        <TextField
          label="Short explanation (optional)"
          value={explanation}
          onChangeText={setExplanation}
          multiline
          maxLength={300}
          style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <ToggleRow
          title="Plan it for a week"
          subtitle="It is saved now, but kids only see it from that week. Questions for the current week are asked first."
          value={planned}
          onValueChange={setPlanned}
        />
        {planned ? (
          <DateField
            label="Week of"
            value={week}
            onChange={setWeek}
            hint={isValidDateKey(week) ? `Starts Monday ${formatDay(mondayKey(parseDateKey(week)))}` : 'Choose a day in that week.'}
          />
        ) : null}
        <Button title="Add question" onPress={onAdd} loading={add.isPending} disabled={!valid} />
      </Card>

      {all.isPending ? <Loading /> : null}

      {ahead.length ? (
        <Card>
          <Heading>Planned for coming weeks</Heading>
          {ahead.map((q) => (
            <Row key={q.id} title={q.question} subtitle={describe(q)} right={<Button title="Remove" variant="danger" onPress={() => onRemove(q)} />} />
          ))}
        </Card>
      ) : null}

      <Card>
        <Heading>In the quiz now</Heading>
        {all.data && running.length === 0 ? <Body muted>Nothing yet. Rounds use questions the app makes up until you add some.</Body> : null}
        {running.map((q) => (
          <Row key={q.id} title={q.question} subtitle={describe(q)} right={<Button title="Remove" variant="danger" onPress={() => onRemove(q)} />} />
        ))}
      </Card>
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { gap: Spacing.two },
});
