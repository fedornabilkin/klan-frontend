import type { Resource } from '@shared/contracts';

export const resourceMeta: Record<Resource, { title: string; singular: string; description: string; icon: string; action: string }> = {
  users: { title: 'Участники', singular: 'Участник', description: 'Свои люди. Общие интересы. Новые маршруты.', icon: 'users', action: 'Найти своих' },
  events: { title: 'Мероприятия', singular: 'Мероприятие', description: 'Встречаемся, учимся и выходим за привычные границы.', icon: 'compass', action: 'Все мероприятия' },
  teams: { title: 'Команды', singular: 'Команда', description: 'В одиночку — быстрее. Вместе — дальше.', icon: 'shield', action: 'Все команды' },
  challenges: { title: 'Челленджи', singular: 'Челлендж', description: 'Маленькие действия. Большие перемены.', icon: 'bolt', action: 'Все челленджи' },
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
