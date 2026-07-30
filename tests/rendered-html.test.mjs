import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the weekly report editor shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>周报工坊｜高效周报编辑器<\/title>/i);
  assert.match(html, /周报工坊/);
  assert.match(html, /管道需求/);
  assert.match(html, /生成周报/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships finished metadata and removes the starter preview", async () => {
  const [page, layout, styles, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /showDirectoryPicker/);
  assert.doesNotMatch(page, /indexedDB|正在检查目录能力/);
  assert.match(page, /周报工坊数据\.json/);
  assert.match(page, /使用前，请先选择数据目录/);
  assert.match(page, /工作进展概览/);
  assert.match(page, /整体完成率/);
  assert.doesNotMatch(page, /把进展讲清楚/);
  assert.doesNotMatch(page, /把时间留给工作/);
  assert.match(page, /自定义列/);
  assert.match(page, /管理周报表格/);
  assert.match(page, /const addSection/);
  assert.match(page, /const removeSection/);
  assert.match(page, /ClipboardItem/);
  assert.match(layout, /openGraph/);
  assert.match(styles, /"Times New Roman", "Microsoft YaHei", "微软雅黑"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /WRANGLER_LOG_PATH/);
  assert.match(packageJson, /"dev": "next dev"/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
