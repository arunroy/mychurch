import { useTranslation } from 'react-i18next';

import { Body, Card, Heading } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { useActiveAnnouncements } from '@/lib/announcements';

/** The notices leaders have posted, at the top of everyone's Home screen. */
export function AnnouncementCards() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const announcements = useActiveAnnouncements(church_id);

  if (!announcements.data?.length) return null;
  return (
    <>
      {announcements.data.map((item) => (
        <Card key={item.id}>
          <Body muted>{t('announce.label')}</Body>
          <Heading>{item.title}</Heading>
          {item.body ? <Body>{item.body}</Body> : null}
        </Card>
      ))}
    </>
  );
}
