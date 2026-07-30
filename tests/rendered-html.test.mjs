import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("contains the weekly report editor shell", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);
  assert.match(layout, /周报工坊｜高效周报编辑器/);
  assert.match(page, /周报工坊/);
  assert.match(page, /管道需求/);
  assert.match(page, /生成周报/);
  assert.doesNotMatch(page + layout, /codex-preview|react-loading-skeleton/i);
});

test("ships finished metadata and removes the starter preview", async () => {
  const [page, layout, styles, route, packageJson, gitignore] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/report-data/route.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.match(page, /showDirectoryPicker/);
  assert.doesNotMatch(page, /indexedDB|正在检查目录能力/);
  assert.match(page, /readProjectReportData/);
  assert.match(page, /writeProjectReportData/);
  assert.match(page, /activateProjectDirectory/);
  assert.match(page, /周报工坊数据\.json/);
  assert.doesNotMatch(page, /使用前，请先选择数据目录/);
  assert.match(page, /工作进展概览/);
  assert.match(page, /整体完成率/);
  assert.match(page, /待分析/);
  assert.match(page, /开发中/);
  assert.match(page, /已转测/);
  assert.match(page, /已全网/);
  assert.match(page, /已取消/);
  assert.match(page, /管理状态枚举/);
  assert.match(page, /const addStatusOption/);
  assert.match(page, /const removeStatusOption/);
  assert.match(page, /report-status-complete/);
  assert.match(page, /report-row-complete/);
  assert.match(page, /backgroundColor: "#e4f5ea"/);
  assert.match(page, /status === "已完成"/);
  assert.match(page, /background:#e4f5ea/);
  assert.doesNotMatch(page, /把进展讲清楚/);
  assert.doesNotMatch(page, /把时间留给工作/);
  assert.match(page, /自定义列/);
  assert.match(page, /管理周报表格/);
  assert.match(page, /const addSection/);
  assert.match(page, /const removeSection/);
  assert.match(page, /选择周报内容/);
  assert.match(page, /const selectedReportSections = sections\.filter/);
  assert.match(page, /selectedReportSections\.map\(\(section, index\)/);
  assert.match(page, /buildPlainText[\s\S]*selectedReportSections/);
  assert.match(page, /自动连续编号/);
  assert.match(styles, /\.report-selection-heading/);
  assert.match(styles, /\.report-selection-item\.is-selected/);
  assert.match(page, /ClipboardItem/);
  assert.match(layout, /openGraph/);
  assert.match(styles, /"Times New Roman", "Microsoft YaHei", "微软雅黑"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /WRANGLER_LOG_PATH/);
  assert.match(packageJson, /"dev": "next dev"/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"start": "next start"/);
  assert.match(route, /path\.join\(process\.cwd\(\), DATA_FILE_NAME\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(gitignore, /\/周报工坊数据\.json/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
