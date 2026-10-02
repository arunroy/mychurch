// Finding a church's YouTube channel from the link its Pastor pasted, and reading the channel's latest videos.
//
// No API key is needed: a channel's public feed (videos.xml) lists its most recent videos, and a channel
// page names its own channel id. The feed holds the latest 15 uploads, which is what the app shows.
// No imports and no Deno-only calls, so it can also be tested under Node.

export type ChannelLink =
  | { kind: 'id'; id: string }
  /** A page that has to be fetched to learn its channel id: a @handle, /c/name or /user/name link. */
  | { kind: 'page'; url: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  // Skips the cookie consent page YouTube shows to some regions.
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};

export function isChannelId(value: string) {
  return CHANNEL_ID.test(value);
}

/**
 * Understands the ways people paste a channel: youtube.com/channel/UC..., /@handle, /c/name, /user/name,
 * a bare @handle, or a channel id. Anything else, including a link to one video, is not a channel.
 */
export function parseChannelLink(input: string): ChannelLink | null {
  const text = input.trim();
  if (!text) return null;
  if (isChannelId(text)) return { kind: 'id', id: text };
  if (/^@[\w.-]{3,}$/.test(text)) return { kind: 'page', url: `https://www.youtube.com/${text}` };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host !== 'youtube.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'channel' && parts[1] && isChannelId(parts[1])) return { kind: 'id', id: parts[1] };
  if (parts[0]?.startsWith('@') && parts[0].length >= 4) return { kind: 'page', url: `https://www.youtube.com/${parts[0]}` };
  if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) return { kind: 'page', url: `https://www.youtube.com/${parts[0]}/${parts[1]}` };
  return null;
}

/** Reads the channel's own id out of its page. Returns null if the page is not a channel. */
export function channelIdFromPage(html: string): string | null {
  const patterns = [
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/,
    /itemprop="(?:identifier|channelId)" content="(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function resolveChannelId(link: ChannelLink): Promise<string | null> {
  if (link.kind === 'id') return link.id;
  const response = await fetch(link.url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!response.ok) return null;
  return channelIdFromPage(await response.text());
}

export type Video = {
  id: string;
  title: string;
  /** ISO time the video was published. */
  published_at: string;
  thumbnail: string;
  description: string;
};

export type ChannelFeed = { channel_title: string; videos: Video[] };

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

/** Turns a channel feed into videos, newest first. */
export function parseFeed(xml: string): ChannelFeed {
  // The first <title> before any entry is the channel's.
  const head = xml.split('<entry>')[0];
  const channel_title = decode(tag(head, 'title') ?? '').trim();

  const videos: Video[] = [];
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = tag(entry, 'yt:videoId');
    const title = tag(entry, 'title');
    const published = tag(entry, 'published');
    if (!id || !title || !published || Number.isNaN(Date.parse(published))) continue;
    videos.push({
      id,
      title: decode(title).trim(),
      published_at: new Date(published).toISOString(),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      description: decode(tag(entry, 'media:description') ?? '').trim().slice(0, 300),
    });
  }
  videos.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  return { channel_title, videos };
}

export async function fetchChannelFeed(channelId: string): Promise<ChannelFeed | null> {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!response.ok) return null;
  return parseFeed(await response.text());
}
