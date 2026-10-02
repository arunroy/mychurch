import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReportButton } from '@/components/report-sheet';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField, ToggleRow, Segmented } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { Question, QuestionVisibility } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { useAnswer, useAsk, useQuestions, useRemoveQuestion, useSetVisibility, VISIBILITY_CHOICES } from '@/lib/qa';
import { friendlyError } from '@/lib/supabase';

// Members ask the Pastor a question. Only the Pastor sees it at first. The Pastor does not ask; they read, answer and control it. The Pastor answers it, and decides whether it stays
// private, is shared with the church leaders, or is shared with the whole church.
export default function QaScreen() {
  const { t } = useTranslation();
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
      {isPastor ? null : (
        <Card>
          <Heading>{t('qa.ask')}</Heading>
          <Body muted>{t('qa.askIntro')}</Body>
          <TextField
            label={t('notes.yourQuestion')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <ToggleRow
            title={t('notes.anonymous')}
            subtitle={t('qa.anonymousHint')}
            value={anonymous}
            onValueChange={setAnonymous}
          />
          <ErrorText>{error}</ErrorText>
          {asked ? <Body>{t('notes.thanks')}</Body> : null}
          <Button title={t('qa.askButton')} onPress={onAsk} loading={ask.isPending} disabled={!text.trim()} />
        </Card>
      )}

      <ErrorText>{questions.error ? friendlyError(questions.error) : null}</ErrorText>
      {questions.isPending ? <Loading /> : null}

      <Group title={t('qa.groupWaiting')} items={waiting} />
      <Group title={t('qa.groupPrivate')} items={privateAnswered} />
      <Group title={t('qa.groupMine')} items={mine} />
      <Group title={t('qa.sharedLeaders')} items={leaders} />
      <Group title={t('qa.sharedChurch')} items={church} />

      {!questions.isPending && all.length === 0 ? (
        <Body muted>{isPastor ? t('qa.emptyPastor') : t('qa.emptyMember')}</Body>
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

function QuestionCard({ question }: { question: Question }) {
  const { t } = useTranslation();
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
      setError(t('qa.answerFirst'));
      return;
    }
    run(() => setVisibility.mutateAsync({ questionId: question.id, visibility }));
  }

  const canRemove = isPastor || question.is_mine;

  return (
    <Card>
      <Body muted>{`${question.asker_name || t('qa.anonymousName')} · ${shortDate(question.asked_at)}`}</Body>
      <Body>{question.body}</Body>
      <Body muted>
        {question.visibility === 'church'
          ? t('qa.sharedChurch')
          : question.visibility === 'leaders'
            ? t('qa.sharedLeaders')
            : question.is_mine
              ? t('qa.privateYou')
              : t('qa.privateOnlyPastor')}
      </Body>
      <ErrorText>{error}</ErrorText>

      {question.answer && !editing ? (
        <>
          <Body muted>{t('qa.answerFrom', { name: question.answered_by_name || t('qa.thePastor') })}</Body>
          <Body>{question.answer}</Body>
        </>
      ) : null}
      {!question.answer && !isPastor ? <Body muted>{t('qa.waitingPastor')}</Body> : null}

      {isPastor && (!question.answer || editing) ? (
        <>
          <TextField
            label={t('qa.yourAnswer')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
            hint={t('qa.answerHint')}
          />
          <Button
            title={t('qa.saveAnswer')}
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
          <Body>{t('qa.whoCanSee')}</Body>
          <Segmented
            value={question.visibility}
            onChange={choose}
            options={VISIBILITY_CHOICES.map((choice) => ({ value: choice.value, label: t(`qa.vis${choice.value[0].toUpperCase()}${choice.value.slice(1)}`) }))}
          />
          {!question.answer ? <Body muted>{t('qa.needAnswer')}</Body> : null}
          {question.answer && !editing ? <Button title={t('qa.editAnswer')} variant="secondary" onPress={() => setEditing(true)} /> : null}
        </>
      ) : null}

      {!question.is_mine && !isPastor ? <ReportButton type="question" targetId={question.id} /> : null}

      {canRemove ? (
        <Button
          title={t('common.remove')}
          variant="danger"
          loading={remove.isPending}
          onPress={() =>
            confirm(t('qa.removeTitle'), t('qa.removeMessage'), t('common.remove'), () =>
              run(() => remove.mutateAsync(question.id)),
            )
          }
        />
      ) : null}
    </Card>
  );
}

