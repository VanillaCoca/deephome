// 评测金标集：每条 = 一个 query + 该 query 下各房源的人工分级相关度(0..3)。
// 这既是评测的 ground truth，也是产品「期望行为」的可执行规格(spec)。
export interface GoldCase {
  id: string;
  query: string;
  note?: string;
  grades: Record<string, number>; // mlsNumber -> 0(不相关) 1(勉强) 2(不错) 3(理想)
}

export const GOLD: GoldCase[] = [
  {
    id: "light",
    query: "想要大窗户 采光好 的公寓",
    note: "采光由 朝向+楼层+开窗比例 决定；朝南高层=理想，朝北低层=差",
    grades: { C001: 3, C010: 3, C003: 2, C013: 2, C007: 1, C006: 1, C011: 1, C002: 0, C009: 0, C012: 0 },
  },
  {
    id: "view",
    query: "高层 景观好 yorkville",
    note: "景观看楼层；朝向次要(朝北高层也可以)",
    grades: { C012: 3, C003: 2 },
  },
  {
    id: "quiet_commute",
    query: "安静 近地铁 的一房",
    note: "近地铁 + 远离主干道/夜生活",
    grades: { C004: 3, C009: 2, C013: 2, C006: 1, C011: 1, C002: 0 },
  },
  {
    id: "family",
    query: "适合小孩的家庭 独立屋 leslieville",
    note: "多房 + 近学校/公园",
    grades: { C005: 3, C014: 1 },
  },
  {
    id: "pet_value",
    query: "养狗 高性价比 公寓",
    note: "允许养宠 + 低单价；不允许宠物=0",
    grades: { C011: 3, C006: 2, C009: 1, C007: 0 },
  },
];
