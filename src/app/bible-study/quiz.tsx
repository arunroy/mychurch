import { useState } from 'react';
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
        <Body muted>Ten questions, no timer. Pick a level to start.</Body>
        <Card>
          {LEVELS.map((l) => (
            <Row
              key={l.level}
              title={l.label}
              subtitle={l.blurb}
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
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (index >= questions.length) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Heading>{`You got ${score} out of ${questions.length}`}</Heading>
          <Body>{score === questions.length ? 'Perfect! Well done.' : score >= questions.length / 2 ? 'Great job! Keep learning.' : 'Good try! Every round teaches something new.'}</Body>
        </Card>
        <Button title="Play again" onPress={onAgain} />
        <Button title="Change level" variant="secondary" onPress={onChangeLevel} />
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
      <Body muted>{`Question ${index + 1} of ${questions.length}`}</Body>
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
              {isRight ? <Text style={[styles.mark, { color: RIGHT }]}>Correct</Text> : null}
              {isWrong ? <Text style={[styles.mark, { color: WRONG }]}>Not quite</Text> : null}
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
          <Button title={index + 1 === questions.length ? 'See my score' : 'Next question'} onPress={next} />
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
