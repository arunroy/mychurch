// Looks a reference up in the World English Bible, a public-domain translation, through bible-api.com
// (free, no key). The Pastor can edit the text afterwards, and can always type it in by hand.

const TRANSLATION_ID = 'web';
export const TRANSLATION_NAME = 'World English Bible';

export type VerseLookup = { reference: string; text: string };

export async function lookUpVerse(reference: string): Promise<VerseLookup> {
  const query = reference.trim();
  if (!query) throw new Error('Type a reference first, like John 3:16.');

  let response: Response;
  try {
    response = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${TRANSLATION_ID}`);
  } catch {
    throw new Error('Check your internet connection, or type the verse in yourself.');
  }
  if (response.status === 404) throw new Error(`Couldn't find "${query}". Try a form like John 3:16 or Psalm 23:1-4.`);
  if (!response.ok) throw new Error('The Bible lookup is unavailable right now. You can type the verse in yourself.');

  const body: { reference?: string; text?: string } = await response.json();
  const text = body.text?.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Couldn't find "${query}". Try a form like John 3:16 or Psalm 23:1-4.`);
  return { reference: body.reference?.trim() || query, text };
}
