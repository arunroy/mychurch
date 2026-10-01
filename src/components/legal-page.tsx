import { Body, Card, Heading, Screen, Title } from '@/components/ui';
import { LEGAL_UPDATED, SUPPORT_EMAIL, type LegalDocument } from '@/lib/legal';

/** A privacy policy or terms page: heading, intro, then each section. */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <Screen edges={['bottom']}>
      <Title>{document.title}</Title>
      <Body muted>{`Last updated ${LEGAL_UPDATED}`}</Body>
      <Body>{document.intro}</Body>
      {document.sections.map((section) => (
        <Card key={section.heading}>
          <Heading>{section.heading}</Heading>
          {section.body.map((paragraph, index) => (
            <Body key={index}>{paragraph}</Body>
          ))}
        </Card>
      ))}
      {SUPPORT_EMAIL ? (
        <Card>
          <Heading>Contact us</Heading>
          <Body>{`Questions, reports or requests about your information: ${SUPPORT_EMAIL}`}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}
