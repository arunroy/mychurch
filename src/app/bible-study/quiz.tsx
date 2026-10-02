import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Heading, Loading, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch } from '@/lib/church';
import type { QuizLevel, QuizQuestion } from '@/lib/database.types';
import { useQuizQuestions } from '@/lib/quiz';
import type { RoundQuestion } from '@/lib/quiz-generated';
import { buildRound, LEVELS } from '@/lib/quiz-round';

const RIGHT = '#2E7D32';
const WRONG = '#B3261E';

// A ten-question round. Nothing is saved: no scores, no names, no leaderboard.
export default function QuizScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const saved = useQuizQuestions(church_id);
  const [round, setRound] = useState<RoundQuestion[] | null>(null);
  const [level, setLevel] = useState<QuizLevel | null>(null);

  if (saved.isPending) return <Loading />;

  // If the church's questions can't load, the round still plays with generated ones.
  const churchQuestions: QuizQuestion[] = saved.data ?? [];

  if (!round || !level) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('quiz.intro')}</Body>
        <Card>
          {LEVELS.map((l) => (
            <Row
              key={l.level}
              title={t(`quiz.level${l.level[0].toUpperCase()}${l.level.slice(1)}`)}
              subtitle={t(`quiz.blurb${l.level[0].toUpperCase()}${l.level.slice(1)}`)}
              onPress={() => {
                setLevel(l.level);
                setRound(buildRound(l.level, churchQuestions));
              }}
            />
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Round
      // A new round is a new component, so nothing carries over from the last one.
      key={round.map((q) => q.question).join('|')}
      questions={round}
      onAgain={() => setRound(buildRound(level, churchQuestions))}
      onChangeLevel={() => {
        setRound(null);
        setLevel(null);
      }}
    />
  );
}

function Round({
  questions,
  onAgain,
  onChangeLevel,
}: {
  questions: RoundQuestion[];
  onAgain: () => void;
  onChangeLevel: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (index >= questions.length) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Heading>{t('quiz.score', { score, total: questions.length })}</Heading>
          <Body>{score === questions.length ? t('quiz.perfect') : score >= questions.length / 2 ? t('quiz.great') : t('quiz.good')}</Body>
        </Card>
        <Button title={t('quiz.again')} onPress={onAgain} />
        <Button title={t('quiz.changeLevel')} variant="secondary" onPress={onChangeLevel} />
      </Screen>
    );
  }

  const q = questions[index];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === q.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('quiz.questionOf', { n: index + 1, total: questions.length })}</Body>
      <Card>
        <Heading>{q.question}</Heading>
      </Card>

      <View style={styles.options}>
        {q.options.map((option, i) => {
          const isRight = answered && i === q.correctIndex;
          const isWrong = answered && i === picked && i !== q.correctIndex;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ disabled: answered, selected: i === picked }}
              onPress={() => choose(i)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isRight ? RIGHT : isWrong ? WRONG : theme.backgroundSelected,
                  opacity: pressed && !answered ? 0.7 : 1,
                },
              ]}>
              <Text style={[styles.optionText, { color: theme.text }]}>{option}</Text>
              {isRight ? <Text style={[styles.mark, { color: RIGHT }]}>{t('quiz.correct')}</Text> : null}
              {isWrong ? <Text style={[styles.mark, { color: WRONG }]}>{t('quiz.notQuite')}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <>
          {q.explanation || q.reference ? (
            <Card>
              {q.explanation ? <Body>{q.explanation}</Body> : null}
              {q.reference ? <Body muted>{q.reference}</Body> : null}
            </Card>
          ) : null}
          <Button title={index + 1 === questions.length ? t('quiz.seeScore') : t('quiz.next')} onPress={next} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: Spacing.two },
  option: { minHeight: 56, borderRadius: 14, borderWidth: 2, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, justifyContent: 'center', gap: 2 },
  optionText: { fontSize: 18, fontWeight: 500 },
  mark: { fontSize: 14, fontWeight: 700 },
});
