import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card, Row, Screen, useAccentText } from '@/components/ui';
import { usePermissions } from '@/lib/church';

const STUDIES = [
  { title: 'christ', icon: 'star', path: '/bible-study/christ' },
  { title: 'doctrines', icon: 'library', path: '/bible-study/doctrines' },
  { title: 'paul', icon: 'mail', path: '/bible-study/paul' },
  { title: 'books', icon: 'albums', path: '/bible-study/books' },
  { title: 'promises', icon: 'heart', path: '/bible-study/promises' },
  { title: 'quiz', icon: 'help-circle', path: '/bible-study/quiz' },
] as const;

// Menu of the Bible study references.
export default function BibleStudyScreen() {
  const { t } = useTranslation();
  const accent = useAccentText();
  const { isLeader } = usePermissions();
  return (
    <Screen edges={['bottom']}>
      <Card>
        {STUDIES.map((s) => (
          <Row
            key={s.path}
            title={t(`study.${s.title}`)}
            subtitle={t(`study.${s.title}Hint`)}
            left={<Ionicons name={s.icon} size={28} color={accent} />}
            onPress={() => router.push(s.path)}
          />
        ))}
        {isLeader ? (
          <Row
            title={t('study.manageQuiz')}
            subtitle={t('study.manageQuizHint')}
            left={<Ionicons name="create" size={28} color={accent} />}
            onPress={() => router.push('/bible-study/quiz-questions')}
          />
        ) : null}
      </Card>
    </Screen>
  );
}
