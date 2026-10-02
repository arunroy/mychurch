import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { isLeader } = usePermissions();
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('quiz.onlyLeaders')}</Body>
      </Screen>
    );
  }
  return <Manager />;
}

function Manager() {
  const { t } = useTranslation();
  const levelLabel = (level: QuizLevel) => t(`quiz.level${level[0].toUpperCase()}${level.slice(1)}`);
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
    confirm(t('qa.removeTitle'), t('quiz.removeMessage', { question: item.question }), t('common.remove'), async () => {
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
    q.week_of
      ? t('quiz.describeWeek', { level: levelLabel(q.level), day: formatDay(q.week_of) })
      : t('quiz.describeAny', { level: levelLabel(q.level) });

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error ?? (all.error ? friendlyError(all.error) : null)}</ErrorText>

      <Card>
        <Heading>{t('quiz.newQuestion')}</Heading>
        <Body>{t('quiz.level')}</Body>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l.level} label={levelLabel(l.level)} selected={l.level === level} onPress={() => setLevel(l.level)} />
          ))}
        </View>
        <TextField
          label={t('pollNew.question')}
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={200}
          placeholder={t('quiz.questionPlaceholder')}
          style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
        />
        {options.map((option, i) => (
          <View key={i} style={styles.option}>
            <TextField
              label={t('quiz.choiceLetter', { letter: LETTERS[i] })}
              value={option}
              onChangeText={(text) => setOption(i, text)}
              maxLength={100}
              hint={i === correct ? t('quiz.isRight') : undefined}
            />
            <View style={styles.chips}>
              <Chip label={i === correct ? t('quiz.rightAnswer') : t('quiz.makeRight')} selected={i === correct} onPress={() => setCorrect(i)} />
              {options.length > 2 ? <Chip label={t('quiz.removeChoice')} onPress={() => removeOption(i)} /> : null}
            </View>
          </View>
        ))}
        {options.length < 4 ? <Button title={t('quiz.addChoice')} variant="secondary" onPress={() => setOptions((list) => [...list, ''])} /> : null}
        <TextField label={t('quiz.whereRead')} value={reference} onChangeText={setReference} maxLength={60} placeholder="Genesis 6:14" />
        <TextField
          label={t('quiz.explanation')}
          value={explanation}
          onChangeText={setExplanation}
          multiline
          maxLength={300}
          style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <ToggleRow
          title={t('quiz.planWeek')}
          subtitle={t('quiz.planWeekHint')}
          value={planned}
          onValueChange={setPlanned}
        />
        {planned ? (
          <DateField
            label={t('quiz.weekOf')}
            value={week}
            onChange={setWeek}
            hint={isValidDateKey(week) ? t('quiz.startsMonday', { day: formatDay(mondayKey(parseDateKey(week))) }) : t('quiz.chooseDayInWeek')}
          />
        ) : null}
        <Button title={t('quiz.addQuestion')} onPress={onAdd} loading={add.isPending} disabled={!valid} />
      </Card>

      {all.isPending ? <Loading /> : null}

      {ahead.length ? (
        <Card>
          <Heading>{t('quiz.planned')}</Heading>
          {ahead.map((q) => (
            <Row key={q.id} title={q.question} subtitle={describe(q)} right={<Button title={t('common.remove')} variant="danger" onPress={() => onRemove(q)} />} />
          ))}
        </Card>
      ) : null}

      <Card>
        <Heading>{t('quiz.nowRunning')}</Heading>
        {all.data && running.length === 0 ? <Body muted>{t('quiz.noneYet')}</Body> : null}
        {running.map((q) => (
          <Row key={q.id} title={q.question} subtitle={describe(q)} right={<Button title={t('common.remove')} variant="danger" onPress={() => onRemove(q)} />} />
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
