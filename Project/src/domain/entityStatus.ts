const labels: Record<string, string> = { active: 'Активно', archive: 'Архив', archived: 'Архив', completed: 'Завершено', upcoming: 'Скоро', planned: 'Скоро', published: 'Опубликовано', open: 'Открыто', new: 'Новое', review: 'На рассмотрении', 'in-progress': 'В работе', in_progress: 'В работе', approved: 'Принято', resolved: 'Решено', rejected: 'Отклонено', closed: 'Закрыто', draft: 'Черновик', offline: 'Офлайн', online: 'Онлайн' };

export function statusLabel(status: string) {
  return labels[status] ?? status;
}

export const feedbackStatuses = ['open', 'in_progress', 'resolved', 'closed'].map(value => ({ value, label: statusLabel(value) }));
