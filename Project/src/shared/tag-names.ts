export const MAX_NEW_TAG_LENGTH = 80;

/** Keep the spelling chosen by the member, including abbreviations such as 3D. */
export function normalizeTagName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

/** Search and duplicate detection use the same rules on the client and server. */
export function tagNameKey(value: string): string {
  return normalizeTagName(value).toLocaleLowerCase('ru').replace(/ё/gu, 'е');
}

/** This rule applies only to newly created tags, not the existing catalog. */
export function newTagNameError(value: string): string | undefined {
  const name = normalizeTagName(value);
  if (!name) return 'Введите название тега.';
  if ([...name].length > MAX_NEW_TAG_LENGTH) return `В теге должно быть не более ${MAX_NEW_TAG_LENGTH} символов.`;
  if (!/^(?:[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:-[\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*|[cс](?:\+\+|#))$/iu.test(name)) {
    return 'Тег должен состоять из одного слова: буквы, цифры или дефис внутри слова. Также можно C++ и C#.';
  }
  return undefined;
}
