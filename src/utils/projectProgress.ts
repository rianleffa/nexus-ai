export function calculateProjectProgress(
  tasks: readonly { project_id?: string | null; company_id: string; status: string }[],
  companyId: string,
): Map<string, number> {
  const counts = new Map<string, { completed: number; total: number }>();
  for (const task of tasks) {
    if (!task.project_id || task.company_id !== companyId) continue;
    const count = counts.get(task.project_id) ?? { completed: 0, total: 0 };
    count.total += 1;
    if (task.status === 'concluido') count.completed += 1;
    counts.set(task.project_id, count);
  }
  return new Map([...counts].map(([id, count]) => [id, Math.round(count.completed * 100 / count.total)]));
}
