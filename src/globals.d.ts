// 最小化 Node 全局声明，避免为 demo 引入完整 @types/node。
// 生产环境请安装 @types/node 并删除本文件。
declare const process: {
  argv: string[];
  exit(code?: number): void;
};
