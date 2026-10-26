// Qoder Sites 静态托管适配脚本（out/ → out-qoder/ 派生副本，不改动 out/）。
// 平台的三个既定行为：
//   1. 不解析目录索引：/leaderboard 只有 /leaderboard/index.html 能直接命中
//   2. 未知路径回落到首页 HTML
//   3. 打包上限 450 MiB / 单文件 50 MiB，且拒收路径含 `$` 的目录；
//      Next 静态导出的 RSC 数据（*.txt，约 279 MiB）在纯静态托管上无意义
// 处理：剔除 RSC 数据与 $ 路径 → 站内链接改写为 /xxx/index.html → 每页注入
// 重定向脚本（直接输入 /leaderboard/ 时由首页脚本纠正地址）。
// 用法：node scripts/prepare-qoder-deploy.mjs [srcDir] [destDir]，默认 out out-qoder

import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const src = process.argv[2] ?? 'out'
const dist = process.argv[3] ?? 'out-qoder'

const SNIPPET = `<script>(function(){var p=location.pathname;if(p==="/"||/\\.[a-z0-9]+$/i.test(p)||p.endsWith("/index.html"))return;var s=p+location.search+location.hash;if(!s.endsWith("/"))s+="/";s+="index.html";location.replace(s)})()</script>`

await rm(dist, { recursive: true, force: true })
await cp(src, dist, { recursive: true })

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

// 剔除：RSC 数据（*.txt）、含 $ 的文件与目录（平台打包器拒收）
let pruned = 0
for await (const file of walk(dist)) {
  const rel = relative(dist, file).replace(/\\/g, '/')
  if (rel.endsWith('.txt') || rel.includes('$')) {
    await rm(file, { force: true })
    pruned++
  }
}
// $ 目录可能只剩空壳（文件已删），自底向上把含 $ 的目录也清掉
async function pruneEmptyDollarDirs(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const p = join(dir, entry.name)
    if (entry.name.includes('$')) {
      await rm(p, { recursive: true, force: true })
      pruned++
      continue
    }
    await pruneEmptyDollarDirs(p)
  }
}
await pruneEmptyDollarDirs(dist)

const routes = new Set()
const htmlFiles = []
for await (const file of walk(dist)) {
  if (file.endsWith('.html')) {
    htmlFiles.push(file)
    const rel = relative(dist, file).replace(/\\/g, '/')
    if (rel.endsWith('/index.html')) routes.add('/' + rel.slice(0, -'/index.html'.length))
  }
}

let filesTouched = 0
for (const file of htmlFiles) {
  let html = await readFile(file, 'utf8')
  const before = html
  for (const route of routes) {
    if (route === '/') continue
    html = html.replace(new RegExp(`(href="${route})/?"(?!index)`, 'g'), `$1/index.html"`)
  }
  if (!html.includes(SNIPPET)) html = html.replace('<head>', `<head>${SNIPPET}`)
  if (html !== before) {
    await writeFile(file, html)
    filesTouched++
  }
}

console.log(
  `[prepare-qoder-deploy] routes=${routes.size} html=${htmlFiles.length} pruned=${pruned} touched=${filesTouched} → ${dist}`,
)
