export function paginationItems(page: number, total: number): (number | 'ellipsis-left' | 'ellipsis-right')[] {
  if (total <= 7) return Array.from({ length: Math.max(0, total) }, (_, index) => index + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) { pages.add(2); pages.add(3); pages.add(4); }
  if (page >= total - 2) { pages.add(total - 1); pages.add(total - 2); pages.add(total - 3); }
  const sorted = [...pages].filter(v => v > 0 && v <= total).sort((a, b) => a - b);
  const result: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1]! > 1) result.push(value > page ? 'ellipsis-right' : 'ellipsis-left');
    result.push(value);
  });
  return result;
}
