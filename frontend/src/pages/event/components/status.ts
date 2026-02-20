export function eventStatusRu(s: string) {
  const map: Record<string, string> = {
    DRAFT: "Черновик",
    PUBLISHED: "Опубликовано",
    STARTED: "Идёт",
    FINISHED: "Завершено",
    CANCELLED: "Отменено",
  };
  return map[s] ?? s;
}
