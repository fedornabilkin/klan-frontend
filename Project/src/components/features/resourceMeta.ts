import type { Resource } from '@shared/contracts';

export const resourceMeta: Record<Resource, { title: string; singular: string; description: string; icon: string; action: string }> = {
  users: { title: 'Найди своего', singular: 'Участник', description: 'Ищи по имени, позывному или интересам.', icon: 'users', action: 'Найти своих' },
  events: { title: 'Где встречаемся?', singular: 'Мероприятие', description: 'Выбери встречу, посмотри, кто идёт, и отметь, что возьмёшь с собой.', icon: 'compass', action: 'Все встречи' },
  teams: { title: 'Команды Клана', singular: 'Команда', description: 'Посмотри, кто в составе и как команда проходит челленджи.', icon: 'shield', action: 'Все команды' },
  challenges: { title: 'Челленджи Клана', singular: 'Челлендж', description: 'Запиши результат за сегодня и посмотри, сколько уже сделала твоя команда.', icon: 'bolt', action: 'Все челленджи' },
  news: { title: 'Новости', singular: 'Новость', description: 'Чем живёт сообщество прямо сейчас.', icon: 'newspaper', action: 'Все новости' },
  feedback: { title: 'Обратная связь', singular: 'Предложение', description: 'Хорошие идеи начинаются с разговора.', icon: 'comment', action: 'Все предложения' },
  books: { title: 'Книги', singular: 'Книга', description: 'Знания, которые стоит взять с собой.', icon: 'book', action: 'Все книги' },
  rules: { title: 'Правила сообщества', singular: 'Правило', description: 'Наши договорённости. Уважение. Ответственность.', icon: 'scroll', action: 'Все правила' },
};

export const statusLabels: Record<string, string> = { active: 'Активно', archived: 'В архиве', upcoming: 'Скоро', completed: 'Завершено', published: 'Опубликовано', draft: 'Черновик', new: 'Новое', reviewing: 'На рассмотрении', planned: 'Запланировано', accepted: 'Принято', rejected: 'Отклонено', closed: 'Закрыто', open: 'Открыто', in_progress: 'В работе' };
export const categoryLabels: Record<string, string> = { offline: 'Оффлайн', online: 'Онлайн', general: 'Общее', recommendation: 'Рекомендации', recommendations: 'Рекомендации', community: 'Сообщество', training: 'Тренировки', fitness: 'Спорт', sport: 'Спорт', count: 'Количество', distance: 'Дистанция', attendance: 'Регулярность', suggestion: 'Предложение', hiking: 'Походы', survival: 'Выживание', development: 'Развитие', nonfiction: 'Нон-фикшн', fiction: 'Художественная' };
export function dateLabel(value?: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', options);
}
