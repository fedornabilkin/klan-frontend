import { describe, expect, it } from 'vitest';
import { profileTextParts } from './profileLinks';

const links = (text: string) => profileTextParts(text).filter(part => part.href);

describe('profile links in plain text', () => {
  it('makes websites, social profiles and email clickable without altering the text', () => {
    const text = 'Мой сайт https://example.com/about?q=1&lang=ru\nКанал t.me/my_channel, портфолио www.example.org. Пишите me@example.org';
    expect(profileTextParts(text).map(part => part.text).join('')).toBe(text);
    expect(links(text).map(part => part.href)).toEqual(['https://example.com/about?q=1&lang=ru', 'https://t.me/my_channel', 'https://www.example.org/', 'mailto:me@example.org']);
  });
  it('keeps closing punctuation outside links and preserves balanced URL parentheses', () => {
    expect(links('Сайт (https://example.org/path_(one)). Ещё «vk.com/person»!')).toEqual([
      { text: 'https://example.org/path_(one)', href: 'https://example.org/path_(one)' },
      { text: 'vk.com/person', href: 'https://vk.com/person' },
    ]);
  });
  it('recognizes website domains, subdomains, Cyrillic URLs and social profile paths', () => {
    const text = 'divan.ru, lab.cycleless.ru, https://прикар.рф/. vkvideo.ru/@begalihiking и example.org?ref=profile.';
    expect(profileTextParts(text).map(part => part.text).join('')).toBe(text);
    expect(links(text).map(part => part.text)).toEqual(['divan.ru', 'lab.cycleless.ru', 'https://прикар.рф/', 'vkvideo.ru/@begalihiking', 'example.org?ref=profile']);
    expect(links(text).map(part => part.href)).toEqual(['https://divan.ru/', 'https://lab.cycleless.ru/', new URL('https://прикар.рф/').href, 'https://vkvideo.ru/@begalihiking', 'https://example.org/?ref=profile']);
  });
  it('leaves ordinary mentions, versions and technology names unchanged', () => {
    expect(links('Node.js, Python 3.10, версия 1.2.3, @someone, 2.5 км')).toEqual([]);
  });
  it('links only the known profile Telegram username or an explicit Telegram context', () => {
    const text = '@Known_Person и @unknown_person';
    const parts = profileTextParts(text, { telegramUsername: '@known_person' });
    expect(parts.filter(part => part.href)).toEqual([{ text: '@Known_Person', href: 'https://t.me/Known_Person' }]);
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(links('Мой Telegram: @my_channel. Другой аккаунт: @unknown_person')).toEqual([{ text: '@my_channel', href: 'https://t.me/my_channel' }]);
    expect(links('Телеграм — @my_channel')).toEqual([{ text: '@my_channel', href: 'https://t.me/my_channel' }]);
    expect(links('Аккаунт: @my_channel')).toEqual([]);
  });
  it('uses an explicit VK or Instagram context without guessing other mentions', () => {
    const text = 'VK: id6562290\nВКонтакте — my_handle\nInstagram: @my.handle\nИнстаграм:another_user\n@unknown_person';
    const parts = profileTextParts(text);
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(parts.filter(part => part.href)).toEqual([
      { text: 'id6562290', href: 'https://vk.com/id6562290' },
      { text: 'my_handle', href: 'https://vk.com/my_handle' },
      { text: '@my.handle', href: 'https://www.instagram.com/my.handle/' },
      { text: 'another_user', href: 'https://www.instagram.com/another_user/' },
    ]);
    expect(profileTextParts('Instagram: @known_person', { telegramUsername: 'known_person' }).filter(part => part.href)).toEqual([{ text: '@known_person', href: 'https://www.instagram.com/known_person/' }]);
    expect(links('VK: https://vk.com/id6562290')).toEqual([{ text: 'https://vk.com/id6562290', href: 'https://vk.com/id6562290' }]);
    expect(links('gurovandrey.gurov@yandex')).toEqual([]);
    expect(links('Instagram: gurovandrey.gurov@yandex')).toEqual([]);
  });
  it('does not activate URLs embedded in dangerous or unsupported schemes', () => {
    for (const text of [
      'javascript:alert("https://example.org")', 'JaVaScRiPt: window.open("https://example.org")',
      'data:text/html,<a href="https://example.org">link</a>', 'vbscript:https://example.org',
      'file:///https://example.org', 'ftp://example.org/https://example.net', 'unknown:https://example.org',
    ]) expect(links(text), text).toEqual([]);
    expect(links('javascript:alert(1)\nhttps://example.org')).toEqual([{ text: 'https://example.org', href: 'https://example.org/' }]);
  });
  it('rejects deceptive credentials and avoids matching portions of other domains', () => {
    expect(links('https://trusted.example@evil.example/')).toEqual([]);
    expect(links('evilt.me/person vk.com.evil.example/person person@vk.com')).toEqual([{ text: 'person@vk.com', href: 'mailto:person@vk.com' }]);
  });
  it('keeps markup literal and allows only safe href schemes', () => {
    const text = '<img src=x onerror=alert(1)> https://example.org/<script>alert(1)</script>';
    const parts = profileTextParts(text);
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(parts.filter(part => part.href).every(part => /^(https?:\/\/|mailto:)/u.test(part.href!))).toBe(true);
    expect(links('mailto:hello@example.org')).toEqual([{ text: 'mailto:hello@example.org', href: 'mailto:hello@example.org' }]);
  });
});
