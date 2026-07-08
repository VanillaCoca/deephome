// 排序指标（纯函数）。NDCG 奖励「把相关的排在前面」，支持分级相关度。
export function dcg(grades: number[]): number {
  return grades.reduce((s, g, i) => s + (Math.pow(2, g) - 1) / Math.log2(i + 2), 0);
}
export function ndcgAtK(rankedGrades: number[], allGrades: number[], k: number): number {
  const idcg = dcg([...allGrades].sort((a, b) => b - a).slice(0, k));
  if (idcg === 0) return 1; // 没有任何相关项 → 无可失分，视为满分
  return dcg(rankedGrades.slice(0, k)) / idcg;
}
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
