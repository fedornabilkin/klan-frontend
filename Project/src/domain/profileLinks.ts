export interface ProfileTextPart {
  text: string;
  href?: string;
}

// Restricted top-level domains avoid treating names such as Node.js or versions as URLs.
const domainLabel = '[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]{0,61}[\\p{L}\\p{N}])?';
const websiteDomain = `(?:${domainLabel}\\.)+(?:ru|рф|com|org|net|io|dev|pro|info)`;
const bareDomains = '(?:t\\.me|telegram\\.me|vk\\.com|vk\\.ru|vk\\.cc|vkvideo\\.ru|youtube\\.com|youtu\\.be|instagram\\.com|facebook\\.com|linkedin\\.com|github\\.com|gitlab\\.com|rutube\\.ru|dzen\\.ru|ok\\.ru|x\\.com|twitter\\.com|behance\\.net|habr\\.com|linktr\\.ee|taplink\\.cc|wa\\.me|wa\\.link|tenchat\\.ru|boosty\\.to|tiktok\\.com|twitch\\.tv)';
const email = '[A-Za-z0-9.!#$%&*+/?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,63}';
const contextualIdentifier = '(?<=(?:\\bVK|ВКонтакте|\\bInstagram|Инстаграм)\\s*[:—–-]\\s*)[A-Za-z0-9_][A-Za-z0-9_.]{0,31}';
const candidate = new RegExp(`https?:\\/\\/[^\\s<>"'\u0060«»]+|www\\.[^\\s<>"'\u0060«»]+|mailto:${email}|${email}|(?:${websiteDomain}|${bareDomains})(?:[/?#][^\\s<>"'\u0060«»]*)?|@[A-Za-z0-9_][A-Za-z0-9_.]{0,31}|${contextualIdentifier}`, 'giu');
const unsafeScheme = /\b(?:javascript|vbscript|data|file|blob|about|ftp|sftp):[^\r\n]*/giu;

function socialContext(prefix: string): string | undefined {
  return /(?:^|[^\p{L}\p{N}_])(telegram|телеграмм?|tg|vk|вконтакте|instagram|инстаграм)\s*[:—–-]?\s*$/iu.exec(prefix)?.[1]?.toLowerCase();
}

function socialHref(username: string, network: string): string | undefined {
  if (['instagram', 'инстаграм'].includes(network)) {
    if (/^[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?$/u.test(username) && !username.includes('..')) return `https://www.instagram.com/${username}/`;
  } else if (['vk', 'вконтакте'].includes(network)) {
    if (/^(?:id[1-9][0-9]*|[A-Za-z][A-Za-z0-9_.]{4,31})$/u.test(username)) return `https://vk.com/${username}`;
  } else if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/u.test(username)) return `https://t.me/${username}`;
}

function trimPunctuation(value: string): string {
  let result = value.replace(/[.,;:!?]+$/u, '');
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']] as const;
  let shortened = true;
  while (shortened) {
    shortened = false;
    for (const [open, close] of pairs) {
      if (result.endsWith(close) && result.split(close).length > result.split(open).length) {
        result = result.slice(0, -1).replace(/[.,;:!?]+$/u, '');
        shortened = true;
      }
    }
  }
  return result;
}

function safeHref(text: string): string | undefined {
  const isEmail = new RegExp(`^(?:mailto:)?${email}$`, 'iu').test(text);
  if (isEmail) return `mailto:${text.replace(/^mailto:/iu, '')}`;
  try {
    const url = new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

/** Keep plain text as text nodes: no HTML generation or interpretation. */
export function profileTextParts(text: string, options: { telegramUsername?: string } = {}): ProfileTextPart[] {
  const knownUsername = options.telegramUsername?.trim().replace(/^@/u, '').toLowerCase();
  const blocked = [...text.matchAll(unsafeScheme)].map(match => [match.index!, match.index! + match[0].length]);
  const result: ProfileTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(candidate)) {
    const start = match.index!;
    const linePrefix = text.slice(0, start).split(/\r?\n/u).pop() ?? '';
    const network = socialContext(linePrefix);
    // Do not activate substrings inside another URI, username or longer domain.
    if (start > 0 && /[\p{L}\p{N}_@/\\:=.-]/u.test(text[start - 1]!) && !network) continue;
    if (blocked.some(([from, to]) => start >= from! && start < to!)) continue;
    const label = trimPunctuation(match[0]);
    const end = start + label.length;
    if (end < text.length && /[\p{L}\p{N}_@/\\-]/u.test(text[end]!)) continue;
    if (text[end] === '.' && /[\p{L}\p{N}_-]/u.test(text[end + 1] ?? '')) continue;
    let href: string | undefined;
    if (network && /^@?[A-Za-z0-9_][A-Za-z0-9_.]*$/u.test(label)) {
      href = socialHref(label.replace(/^@/u, ''), network);
    } else if (label.startsWith('@')) {
      const username = label.slice(1);
      if (username.toLowerCase() === knownUsername) href = socialHref(username, 'telegram');
    } else href = safeHref(label);
    if (!href) continue;
    if (start > cursor) result.push({ text: text.slice(cursor, start) });
    result.push({ text: label, href });
    cursor = end;
  }
  if (cursor < text.length || !result.length) result.push({ text: text.slice(cursor) });
  return result;
}
