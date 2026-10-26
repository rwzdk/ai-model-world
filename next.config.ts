import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  /*
   * 静态生成默认会开出与 CPU 数相同的 worker（本机 14 个），817 页时内存吃紧。
   * 压到 2 个 worker：慢一点但稳定。
   */
  experimental: {
    cpus: 2,
  },
  /*
   * 开发服务器运行时执行 `next build` 会覆写同一个 .next 目录，导致 dev 立刻 404。
   * 让构建可以指到另一个目录：NEXT_DIST_DIR=.next-build npm run build
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: { unoptimized: true },
  trailingSlash: true,

  /*
   * 作为 B 站 Toy 发布时，页面跑在 https://www.bilibili.com/toy/<slug>/ 这个子路径下。
   * 设了 basePath，Next 会把 next/link 的跳转和 _next/ 下的产物统一加上前缀；
   * 手写在内联样式里的资源由 src/lib/asset.ts 读同一个值补齐。
   *
   *   NEXT_BASE_PATH=/toy/ai-model-world NEXT_DIST_DIR=.next-toy npm run build
   *
   * 不设时行为与以前完全一致，普通部署不受影响。
   */
  ...(process.env.NEXT_BASE_PATH
    ? { basePath: process.env.NEXT_BASE_PATH, env: { NEXT_PUBLIC_BASE_PATH: process.env.NEXT_BASE_PATH } }
    : {}),
};

export default nextConfig;
