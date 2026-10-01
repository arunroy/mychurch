import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Card, Row, Screen, useAccentText } from '@/components/ui';

const STUDIES = [
  { title: 'Jesus quick reference', subtitle: 'Who he is, what he did, what he promised', icon: 'star', path: '/bible-study/christ' },
  { title: 'New Testament doctrines', subtitle: 'The main Christian beliefs and where they are taught', icon: 'library', path: '/bible-study/doctrines' },
  { title: "Paul's letters", subtitle: 'The thirteen letters: audience, date, theme, key verse', icon: 'mail', path: '/bible-study/paul' },
  { title: 'Books of the Bible', subtitle: 'All 66 books in a few lines each', icon: 'albums', path: '/bible-study/books' },
  { title: 'Promises and help for life', subtitle: 'Where to turn when afraid, grieving, tempted or weary', icon: 'heart', path: '/bible-study/promises' },
] as const;

// Menu of the Bible study references.
export default function BibleStudyScreen() {
  const accent = useAccentText();
  return (
    <Screen edges={['bottom']}>
      <Card>
        {STUDIES.map((s) => (
          <Row
            key={s.path}
            title={s.title}
            subtitle={s.subtitle}
            left={<Ionicons name={s.icon} size={28} color={accent} />}
            onPress={() => router.push(s.path)}
          />
        ))}
      </Card>
    </Screen>
  );
}
