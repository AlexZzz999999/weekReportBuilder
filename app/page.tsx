"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ColumnType = "text" | "date" | "status" | "longtext";

type ReportColumn = {
  id: string;
  label: string;
  type: ColumnType;
};

type ReportRow = {
  id: string;
  [key: string]: string;
};

type ReportSection = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  tint: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

const STORAGE_KEY = "weekly-report-workshop-v1";
const STATUS_OPTIONS = ["未开始", "进行中", "已完成", "有风险", "已延期", "待确认"];
const SECTION_COLOR_PRESETS = [
  "#e96d62",
  "#4e78d1",
  "#e6a23c",
  "#8567b9",
  "#3f9d82",
  "#c56c9a",
  "#60758a",
  "#b77942",
];

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function createTint(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#f3f5f4";
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  );
  const tinted = channels.map((channel) =>
    Math.round(channel * 0.12 + 255 * 0.88)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${tinted.join("")}`;
}

const cloneInitialSections = (): ReportSection[] => [
  {
    id: "risks",
    title: "风险点",
    shortTitle: "风险",
    description: "记录本周需重点关注、协调或升级的风险",
    color: "#e96d62",
    tint: "#fff2ef",
    columns: [
      { id: "level", label: "风险等级", type: "text" },
      { id: "summary", label: "风险描述", type: "longtext" },
      { id: "impact", label: "影响范围", type: "text" },
      { id: "owner", label: "责任人", type: "text" },
      { id: "action", label: "应对措施", type: "longtext" },
      { id: "deadline", label: "计划解决日期", type: "date" },
      { id: "status", label: "状态", type: "status" },
    ],
    rows: [
      {
        id: "risk-demo-1",
        level: "中",
        summary: "测试环境资源排期存在冲突",
        impact: "管道需求上线时间",
        owner: "李明",
        action: "已协调临时资源，周四完成确认",
        deadline: "2026-07-31",
        status: "进行中",
      },
    ],
  },
  {
    id: "pipeline",
    title: "管道需求完成情况",
    shortTitle: "管道需求",
    description: "跟踪管道类需求从提出、转测到全网上线的进度",
    color: "#4e78d1",
    tint: "#eef4ff",
    columns: [
      { id: "no", label: "编号", type: "text" },
      { id: "repoType", label: "仓库类别", type: "text" },
      { id: "appName", label: "应用名", type: "text" },
      { id: "sourceService", label: "需求来源服务", type: "text" },
      { id: "requirementNo", label: "需求编号", type: "text" },
      { id: "summary", label: "需求简述", type: "longtext" },
      { id: "createdAt", label: "提出日期", type: "date" },
      { id: "testAt", label: "转测日期", type: "date" },
      { id: "onlineAt", label: "全网日期", type: "date" },
      { id: "developer", label: "开发责任人", type: "text" },
      { id: "status", label: "状态", type: "status" },
    ],
    rows: [
      {
        id: "pipeline-demo-1",
        no: "01",
        repoType: "主干仓",
        appName: "订单中心",
        sourceService: "交易服务",
        requirementNo: "REQ-260728",
        summary: "新增灰度发布前置校验能力",
        createdAt: "2026-07-21",
        testAt: "2026-07-29",
        onlineAt: "2026-08-04",
        developer: "王强",
        status: "进行中",
      },
      {
        id: "pipeline-demo-2",
        no: "02",
        repoType: "组件仓",
        appName: "会员平台",
        sourceService: "用户服务",
        requirementNo: "REQ-260719",
        summary: "升级流水线制品扫描规则",
        createdAt: "2026-07-19",
        testAt: "2026-07-25",
        onlineAt: "2026-07-29",
        developer: "周颖",
        status: "已完成",
      },
    ],
  },
  {
    id: "operations",
    title: "运营需求完成情况",
    shortTitle: "运营需求",
    description: "汇总运营类需求的当前进展与计划完成时间",
    color: "#e6a23c",
    tint: "#fff7e8",
    columns: [
      { id: "no", label: "编号", type: "text" },
      { id: "business", label: "业务线", type: "text" },
      { id: "requirementNo", label: "需求编号", type: "text" },
      { id: "summary", label: "需求简述", type: "longtext" },
      { id: "createdAt", label: "提出日期", type: "date" },
      { id: "planAt", label: "计划完成", type: "date" },
      { id: "owner", label: "负责人", type: "text" },
      { id: "progress", label: "当前进展", type: "longtext" },
      { id: "status", label: "状态", type: "status" },
    ],
    rows: [
      {
        id: "operations-demo-1",
        no: "01",
        business: "会员运营",
        requirementNo: "OPS-260724",
        summary: "暑期活动人群包数据支持",
        createdAt: "2026-07-24",
        planAt: "2026-08-01",
        owner: "陈晨",
        progress: "数据口径已确认，开发完成 80%",
        status: "进行中",
      },
    ],
  },
  {
    id: "todos",
    title: "待办公共事项",
    shortTitle: "公共事项",
    description: "记录跨团队协作、会议决议和其他公共待办",
    color: "#8567b9",
    tint: "#f5f0ff",
    columns: [
      { id: "no", label: "编号", type: "text" },
      { id: "item", label: "待办事项", type: "longtext" },
      { id: "leader", label: "牵头人", type: "text" },
      { id: "partners", label: "协同人", type: "text" },
      { id: "createdAt", label: "提出日期", type: "date" },
      { id: "planAt", label: "计划完成", type: "date" },
      { id: "priority", label: "优先级", type: "text" },
      { id: "status", label: "状态", type: "status" },
      { id: "note", label: "备注", type: "longtext" },
    ],
    rows: [
      {
        id: "todos-demo-1",
        no: "01",
        item: "完成三季度系统容量评估",
        leader: "赵峰",
        partners: "架构组、运维组",
        createdAt: "2026-07-22",
        planAt: "2026-08-07",
        priority: "高",
        status: "未开始",
        note: "下周例会同步初版结论",
      },
    ],
  },
];

function getWeekRange() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const toInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  return { start: toInput(monday), end: toInput(friday) };
}

function formatDate(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

function getStatusClass(status: string) {
  if (status === "已完成") return "status-done";
  if (status === "有风险" || status === "已延期") return "status-risk";
  if (status === "进行中") return "status-active";
  return "status-neutral";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildReportHtml(
  title: string,
  weekStart: string,
  weekEnd: string,
  sections: ReportSection[],
) {
  const sectionHtml = sections
    .map(
      (section) => `
      <section style="margin:0 0 24px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;margin:0 0 10px">
          <span style="display:inline-block;width:8px;height:22px;border-radius:4px;background:${section.color}"></span>
          <h2 style="margin:0;font-size:18px;color:#193d3d">${escapeHtml(section.title)}</h2>
          <span style="color:#7a8582;font-size:13px">${section.rows.length} 项</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>${section.columns
            .map(
              (column) =>
                `<th style="padding:9px 8px;text-align:left;background:${section.tint};border:1px solid #dfe5e2;color:#43514f;white-space:nowrap">${escapeHtml(column.label)}</th>`,
            )
            .join("")}</tr></thead>
          <tbody>${
            section.rows.length
              ? section.rows
                  .map(
                    (row) =>
                      `<tr>${section.columns
                        .map(
                          (column) =>
                            `<td style="padding:9px 8px;border:1px solid #dfe5e2;color:#273634;vertical-align:top">${escapeHtml(
                              column.type === "date"
                                ? formatDate(row[column.id] || "")
                                : row[column.id] || "—",
                            )}</td>`,
                        )
                        .join("")}</tr>`,
                  )
                  .join("")
              : `<tr><td colspan="${section.columns.length}" style="padding:14px;border:1px solid #dfe5e2;color:#8b9693">本周暂无事项</td></tr>`
          }</tbody>
        </table>
      </section>`,
    )
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#22312f;line-height:1.5">
    <div style="border-bottom:3px solid #193d3d;padding:0 0 18px;margin:0 0 24px">
      <div style="font-size:12px;letter-spacing:2px;color:#6d7b78;margin-bottom:6px">WEEKLY REPORT</div>
      <h1 style="margin:0 0 6px;font-size:28px;color:#193d3d">${escapeHtml(title)}</h1>
      <div style="font-size:13px;color:#6d7b78">${formatDate(weekStart)} — ${formatDate(weekEnd)}</div>
    </div>
    ${sectionHtml}
  </div>`;
}

function buildPlainText(
  title: string,
  weekStart: string,
  weekEnd: string,
  sections: ReportSection[],
) {
  const content = sections
    .map((section, sectionIndex) => {
      const rows = section.rows.length
        ? section.rows
            .map(
              (row, rowIndex) =>
                `${rowIndex + 1}. ${section.columns
                  .map((column) => `${column.label}：${row[column.id] || "—"}`)
                  .join("｜")}`,
            )
            .join("\n")
        : "本周暂无事项";
      return `${sectionIndex + 1}、${section.title}\n${rows}`;
    })
    .join("\n\n");
  return `${title}\n${formatDate(weekStart)} — ${formatDate(weekEnd)}\n\n${content}`;
}

export default function Home() {
  const initialWeek = useMemo(() => getWeekRange(), []);
  const [sections, setSections] = useState<ReportSection[]>(cloneInitialSections);
  const [activeSectionId, setActiveSectionId] = useState("pipeline");
  const [reportTitle, setReportTitle] = useState("研发交付中心 · 工作周报");
  const [weekStart, setWeekStart] = useState(initialWeek.start);
  const [weekEnd, setWeekEnd] = useState(initialWeek.end);
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [newSectionColor, setNewSectionColor] = useState("#3f9d82");
  const [toast, setToast] = useState("");
  const [isReady, setIsReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSection =
    sections.find((section) => section.id === activeSectionId) || sections[0];

  const totalItems = sections.reduce((total, section) => total + section.rows.length, 0);
  const completedItems = sections.reduce(
    (total, section) =>
      total + section.rows.filter((row) => row.status === "已完成").length,
    0,
  );
  const riskItems = sections.reduce(
    (total, section) =>
      total +
      section.rows.filter(
        (row) => row.status === "有风险" || row.status === "已延期",
      ).length,
    0,
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.reportTitle) setReportTitle(parsed.reportTitle);
        if (parsed.weekStart) setWeekStart(parsed.weekStart);
        if (parsed.weekEnd) setWeekEnd(parsed.weekEnd);
      }
    } catch {
      // Invalid local data should never block the editor.
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sections, reportTitle, weekStart, weekEnd }),
    );
  }, [sections, reportTitle, weekStart, weekEnd, isReady]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const updateCell = (
    sectionId: string,
    rowId: string,
    columnId: string,
    value: string,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: section.rows.map((row) =>
                row.id === rowId ? { ...row, [columnId]: value } : row,
              ),
            }
          : section,
      ),
    );
  };

  const addRow = () => {
    const row = activeSection.columns.reduce<ReportRow>(
      (item, column) => {
        item[column.id] =
          column.type === "status"
            ? "未开始"
            : column.id === "no"
              ? String(activeSection.rows.length + 1).padStart(2, "0")
              : "";
        return item;
      },
      { id: makeId() },
    );
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? { ...section, rows: [...section.rows, row] }
          : section,
      ),
    );
    showToast(`已添加一条${activeSection.shortTitle}`);
  };

  const deleteRow = (rowId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? { ...section, rows: section.rows.filter((row) => row.id !== rowId) }
          : section,
      ),
    );
    showToast("已删除该条记录");
  };

  const addColumn = () => {
    const label = newColumnName.trim();
    if (!label) {
      showToast("请先填写列名称");
      return;
    }
    const columnId = `custom-${makeId()}`;
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? {
              ...section,
              columns: [
                ...section.columns,
                { id: columnId, label, type: newColumnType },
              ],
              rows: section.rows.map((row) => ({ ...row, [columnId]: "" })),
            }
          : section,
      ),
    );
    setNewColumnName("");
    setNewColumnType("text");
    showToast(`已添加“${label}”列`);
  };

  const updateColumn = (
    columnId: string,
    updates: Partial<Pick<ReportColumn, "label" | "type">>,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? {
              ...section,
              columns: section.columns.map((column) =>
                column.id === columnId ? { ...column, ...updates } : column,
              ),
            }
          : section,
      ),
    );
  };

  const removeColumn = (columnId: string) => {
    if (activeSection.columns.length <= 1) {
      showToast("至少需要保留一列");
      return;
    }
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? {
              ...section,
              columns: section.columns.filter((column) => column.id !== columnId),
            }
          : section,
      ),
    );
  };

  const moveColumn = (columnId: string, direction: -1 | 1) => {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== activeSection.id) return section;
        const index = section.columns.findIndex((column) => column.id === columnId);
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= section.columns.length) return section;
        const columns = [...section.columns];
        [columns[index], columns[nextIndex]] = [columns[nextIndex], columns[index]];
        return { ...section, columns };
      }),
    );
  };

  const updateSection = (
    sectionId: string,
    updates: Partial<
      Pick<ReportSection, "title" | "shortTitle" | "description" | "color" | "tint">
    >,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section,
      ),
    );
  };

  const updateSectionColor = (sectionId: string, color: string) => {
    updateSection(sectionId, { color, tint: createTint(color) });
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const addSection = () => {
    const title = newSectionName.trim();
    if (!title) {
      showToast("请先填写表格名称");
      return;
    }
    const id = `section-${makeId()}`;
    const section: ReportSection = {
      id,
      title,
      shortTitle: title,
      description:
        newSectionDescription.trim() || `记录本周${title}相关事项与工作进展`,
      color: newSectionColor,
      tint: createTint(newSectionColor),
      columns: [
        { id: "no", label: "编号", type: "text" },
        { id: "summary", label: "事项简述", type: "longtext" },
        { id: "owner", label: "负责人", type: "text" },
        { id: "planAt", label: "计划完成", type: "date" },
        { id: "status", label: "状态", type: "status" },
      ],
      rows: [],
    };
    setSections((current) => [...current, section]);
    setActiveSectionId(id);
    setNewSectionName("");
    setNewSectionDescription("");
    setNewSectionColor("#3f9d82");
    showToast(`已新增“${title}”表格`);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      showToast("至少需要保留一张表格");
      return;
    }
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    const detail = target.rows.length
      ? `其中 ${target.rows.length} 条数据也会一并删除。`
      : "";
    if (!window.confirm(`确定删除“${target.title}”吗？${detail}`)) return;
    const remaining = sections.filter((section) => section.id !== sectionId);
    setSections(remaining);
    if (activeSectionId === sectionId) setActiveSectionId(remaining[0].id);
    showToast(`已删除“${target.title}”`);
  };

  const restoreExamples = () => {
    if (!window.confirm("恢复示例数据会覆盖当前编辑内容，确定继续吗？")) return;
    setSections(cloneInitialSections());
    setReportTitle("研发交付中心 · 工作周报");
    setWeekStart(initialWeek.start);
    setWeekEnd(initialWeek.end);
    setActiveSectionId("pipeline");
    showToast("已恢复示例数据");
  };

  const copyReport = async () => {
    const html = buildReportHtml(reportTitle, weekStart, weekEnd, sections);
    const text = buildPlainText(reportTitle, weekStart, weekEnd, sections);
    try {
      if ("ClipboardItem" in window && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      showToast("周报已复制，可直接粘贴到邮件或群聊");
    } catch {
      showToast("复制未成功，请在预览中手动选择内容");
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            周
          </div>
          <div>
            <strong>周报工坊</strong>
            <span>Weekly Report Studio</span>
          </div>
        </div>

        <div className="sidebar-label-row">
          <div className="sidebar-label">本周内容</div>
          <button
            className="manage-sections-button"
            onClick={() => setIsSectionManagerOpen(true)}
            aria-label="管理周报表格"
          >
            管理
          </button>
        </div>
        <nav className="section-nav" aria-label="周报分类">
          {sections.map((section, index) => (
            <button
              key={section.id}
              className={`section-nav-item ${
                activeSectionId === section.id ? "is-active" : ""
              }`}
              onClick={() => setActiveSectionId(section.id)}
              style={
                {
                  "--section-color": section.color,
                  "--section-tint": section.tint,
                } as React.CSSProperties
              }
            >
              <span className="section-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="section-nav-copy">
                <strong>{section.shortTitle}</strong>
                <small>{section.rows.length} 条记录</small>
              </span>
              <span className="section-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="sidebar-note-icon">✓</span>
          <div>
            <strong>实时自动保存</strong>
            <p>修改内容会保存在当前浏览器中</p>
          </div>
        </div>

        <button className="text-button restore-button" onClick={restoreExamples}>
          恢复示例数据
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">WEEKLY REPORT · 周报编辑器</span>
            <input
              className="report-title-input"
              aria-label="周报标题"
              value={reportTitle}
              onChange={(event) => setReportTitle(event.target.value)}
            />
          </div>
          <div className="topbar-actions">
            <div className="week-range" aria-label="周报日期范围">
              <label>
                <span>开始</span>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(event) => setWeekStart(event.target.value)}
                />
              </label>
              <span className="range-line">—</span>
              <label>
                <span>结束</span>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={(event) => setWeekEnd(event.target.value)}
                />
              </label>
            </div>
            <button
              className="primary-button"
              onClick={() => setIsPreviewOpen(true)}
              data-testid="generate-report"
            >
              <span>生成周报</span>
              <span className="button-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
        </header>

        <section className="overview" aria-label="本周概览">
          <div className="overview-intro">
            <span className="overview-kicker">本周工作台</span>
            <h1>把进展讲清楚，<br />把时间留给工作。</h1>
            <p>选择左侧分类直接维护内容，完成后即可生成正式周报。</p>
          </div>
          <div className="overview-stats">
            <div className="stat-card">
              <span>全部事项</span>
              <strong>{String(totalItems).padStart(2, "0")}</strong>
              <small>本周已记录</small>
            </div>
            <div className="stat-card">
              <span>已完成</span>
              <strong>{String(completedItems).padStart(2, "0")}</strong>
              <small>完成率 {totalItems ? Math.round((completedItems / totalItems) * 100) : 0}%</small>
            </div>
            <div className="stat-card stat-card-risk">
              <span>需关注</span>
              <strong>{String(riskItems).padStart(2, "0")}</strong>
              <small>{riskItems ? "建议优先同步" : "当前进展平稳"}</small>
            </div>
          </div>
        </section>

        <section
          className="editor-card"
          style={
            {
              "--section-color": activeSection.color,
              "--section-tint": activeSection.tint,
            } as React.CSSProperties
          }
        >
          <div className="editor-heading">
            <div className="editor-title-group">
              <span className="section-number">
                {String(
                  sections.findIndex((section) => section.id === activeSection.id) + 1,
                ).padStart(2, "0")}
              </span>
              <div>
                <div className="title-line">
                  <h2>{activeSection.title}</h2>
                  <span className="count-badge">{activeSection.rows.length} 项</span>
                </div>
                <p>{activeSection.description}</p>
              </div>
            </div>
            <div className="editor-actions">
              <button
                className="secondary-button"
                onClick={() => setIsSectionManagerOpen(true)}
                data-testid="manage-sections"
              >
                管理表格
              </button>
              <button
                className="secondary-button"
                onClick={() => setIsColumnManagerOpen(true)}
                data-testid="manage-columns"
              >
                <span aria-hidden="true">＋</span> 自定义列
              </button>
              <button className="add-row-button" onClick={addRow} data-testid="add-row">
                <span aria-hidden="true">＋</span> 新增一条
              </button>
            </div>
          </div>

          <div className="table-shell">
            <div className="table-scroll">
              <table
                className="editor-table"
                style={{ minWidth: Math.max(920, activeSection.columns.length * 148) }}
              >
                <thead>
                  <tr>
                    {activeSection.columns.map((column) => (
                      <th key={column.id}>{column.label}</th>
                    ))}
                    <th className="action-column">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSection.rows.map((row) => (
                    <tr key={row.id}>
                      {activeSection.columns.map((column) => (
                        <td key={column.id}>
                          {column.type === "status" ? (
                            <select
                              aria-label={`${column.label}`}
                              className={`cell-input status-select ${getStatusClass(
                                row[column.id] || "",
                              )}`}
                              value={row[column.id] || "未开始"}
                              onChange={(event) =>
                                updateCell(
                                  activeSection.id,
                                  row.id,
                                  column.id,
                                  event.target.value,
                                )
                              }
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                          ) : column.type === "longtext" ? (
                            <textarea
                              aria-label={`${column.label}`}
                              className="cell-input cell-textarea"
                              rows={2}
                              value={row[column.id] || ""}
                              placeholder="点击填写"
                              onChange={(event) =>
                                updateCell(
                                  activeSection.id,
                                  row.id,
                                  column.id,
                                  event.target.value,
                                )
                              }
                            />
                          ) : (
                            <input
                              aria-label={`${column.label}`}
                              className="cell-input"
                              type={column.type === "date" ? "date" : "text"}
                              value={row[column.id] || ""}
                              placeholder="点击填写"
                              onChange={(event) =>
                                updateCell(
                                  activeSection.id,
                                  row.id,
                                  column.id,
                                  event.target.value,
                                )
                              }
                            />
                          )}
                        </td>
                      ))}
                      <td className="action-column">
                        <button
                          className="row-delete"
                          aria-label="删除此行"
                          title="删除此行"
                          onClick={() => deleteRow(row.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeSection.rows.length === 0 && (
                <div className="empty-state">
                  <span>+</span>
                  <strong>本分类还没有记录</strong>
                  <p>点击“新增一条”，开始填写本周进展。</p>
                  <button className="add-row-button" onClick={addRow}>
                    新增第一条
                  </button>
                </div>
              )}
            </div>
            <div className="table-footer">
              <span>
                <i className="save-dot" /> 已自动保存
              </span>
              <span>横向滚动可查看全部列</span>
            </div>
          </div>
        </section>
      </main>

      {isSectionManagerOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsSectionManagerOpen(false);
          }}
        >
          <section
            className="column-modal section-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="section-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">REPORT STRUCTURE</span>
                <h2 id="section-modal-title">管理周报表格</h2>
                <p>新增、重命名、排序或删除周报中的整张表格。</p>
              </div>
              <button
                className="modal-close"
                aria-label="关闭"
                onClick={() => setIsSectionManagerOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="section-manager-list">
              {sections.map((section, index) => (
                <div className="section-manager-item" key={section.id}>
                  <div className="section-manager-top">
                    <span
                      className="section-manager-index"
                      style={{ background: section.color }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="section-name-fields">
                      <label>
                        <span>表格名称</span>
                        <input
                          value={section.title}
                          onChange={(event) =>
                            updateSection(section.id, { title: event.target.value })
                          }
                          onBlur={(event) => {
                            if (!event.target.value.trim()) {
                              updateSection(section.id, { title: "未命名表格" });
                            }
                          }}
                        />
                      </label>
                      <label>
                        <span>侧栏简称</span>
                        <input
                          value={section.shortTitle}
                          onChange={(event) =>
                            updateSection(section.id, {
                              shortTitle: event.target.value,
                            })
                          }
                          onBlur={(event) => {
                            if (!event.target.value.trim()) {
                              updateSection(section.id, {
                                shortTitle: section.title || "未命名",
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="section-order-actions">
                      <button
                        aria-label={`向前移动${section.title}`}
                        disabled={index === 0}
                        onClick={() => moveSection(section.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`向后移动${section.title}`}
                        disabled={index === sections.length - 1}
                        onClick={() => moveSection(section.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        className="section-delete"
                        aria-label={`删除${section.title}`}
                        onClick={() => removeSection(section.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <label className="section-description-field">
                    <span>表格说明</span>
                    <input
                      value={section.description}
                      placeholder="说明这张表用于记录什么"
                      onChange={(event) =>
                        updateSection(section.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="section-color-field">
                    <span>标题颜色</span>
                    <div className="color-options">
                      {SECTION_COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          className={section.color === color ? "is-selected" : ""}
                          style={{ background: color }}
                          aria-label={`选择颜色${color}`}
                          aria-pressed={section.color === color}
                          onClick={() => updateSectionColor(section.id, color)}
                        />
                      ))}
                      <label className="custom-color">
                        <input
                          type="color"
                          value={section.color}
                          onChange={(event) =>
                            updateSectionColor(section.id, event.target.value)
                          }
                        />
                        <span>自定义</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="new-section-form">
              <div className="new-section-heading">
                <div>
                  <strong>新增一张表格</strong>
                  <span>默认包含编号、事项、负责人、完成日期和状态</span>
                </div>
                <div className="color-options">
                  {SECTION_COLOR_PRESETS.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      className={newSectionColor === color ? "is-selected" : ""}
                      style={{ background: color }}
                      aria-label={`选择新表格颜色${color}`}
                      aria-pressed={newSectionColor === color}
                      onClick={() => setNewSectionColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="new-section-fields">
                <input
                  aria-label="新表格名称"
                  placeholder="表格名称，例如：质量专项"
                  value={newSectionName}
                  onChange={(event) => setNewSectionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSection();
                  }}
                />
                <input
                  aria-label="新表格说明"
                  placeholder="用途说明（可选）"
                  value={newSectionDescription}
                  onChange={(event) => setNewSectionDescription(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSection();
                  }}
                />
                <button className="add-row-button" onClick={addSection}>
                  ＋ 新增表格
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isColumnManagerOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsColumnManagerOpen(false);
          }}
        >
          <section
            className="column-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="column-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">TABLE SETTINGS</span>
                <h2 id="column-modal-title">管理“{activeSection.shortTitle}”的列</h2>
                <p>可重命名、调整顺序或增加专属字段。</p>
              </div>
              <button
                className="modal-close"
                aria-label="关闭"
                onClick={() => setIsColumnManagerOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="column-list">
              {activeSection.columns.map((column, index) => (
                <div className="column-item" key={column.id}>
                  <span className="drag-handle" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <input
                    aria-label="列名称"
                    value={column.label}
                    onChange={(event) =>
                      updateColumn(column.id, { label: event.target.value })
                    }
                  />
                  <select
                    aria-label="列类型"
                    value={column.type}
                    onChange={(event) =>
                      updateColumn(column.id, {
                        type: event.target.value as ColumnType,
                      })
                    }
                  >
                    <option value="text">短文本</option>
                    <option value="longtext">长文本</option>
                    <option value="date">日期</option>
                    <option value="status">状态</option>
                  </select>
                  <div className="column-move-actions">
                    <button
                      aria-label="向前移动"
                      disabled={index === 0}
                      onClick={() => moveColumn(column.id, -1)}
                    >
                      ←
                    </button>
                    <button
                      aria-label="向后移动"
                      disabled={index === activeSection.columns.length - 1}
                      onClick={() => moveColumn(column.id, 1)}
                    >
                      →
                    </button>
                  </div>
                  <button
                    className="column-delete"
                    aria-label={`删除${column.label}列`}
                    onClick={() => removeColumn(column.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="add-column-form">
              <div>
                <strong>添加新列</strong>
                <span>新列会添加到当前表格末尾</span>
              </div>
              <input
                aria-label="新列名称"
                placeholder="例如：所属项目"
                value={newColumnName}
                onChange={(event) => setNewColumnName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addColumn();
                }}
              />
              <select
                aria-label="新列类型"
                value={newColumnType}
                onChange={(event) => setNewColumnType(event.target.value as ColumnType)}
              >
                <option value="text">短文本</option>
                <option value="longtext">长文本</option>
                <option value="date">日期</option>
                <option value="status">状态</option>
              </select>
              <button className="add-row-button" onClick={addColumn}>
                添加列
              </button>
            </div>
          </section>
        </div>
      )}

      {isPreviewOpen && (
        <div className="preview-overlay">
          <div className="preview-toolbar">
            <div>
              <span className="eyebrow">REPORT PREVIEW</span>
              <strong>周报已生成</strong>
              <small>检查无误后复制或打印发送</small>
            </div>
            <div className="preview-actions">
              <button className="secondary-button" onClick={copyReport}>
                复制周报
              </button>
              <button className="secondary-button" onClick={() => window.print()}>
                打印 / 导出 PDF
              </button>
              <button
                className="modal-close"
                aria-label="关闭预览"
                onClick={() => setIsPreviewOpen(false)}
              >
                ×
              </button>
            </div>
          </div>
          <div className="preview-scroll">
            <article className="report-paper" data-testid="report-preview">
              <header className="report-header">
                <div className="report-kicker">WEEKLY REPORT</div>
                <h1>{reportTitle}</h1>
                <p>
                  {formatDate(weekStart)} — {formatDate(weekEnd)}
                </p>
                <div className="report-summary">
                  <span>本周共 {totalItems} 项</span>
                  <span>已完成 {completedItems} 项</span>
                  <span>需关注 {riskItems} 项</span>
                </div>
              </header>
              {sections.map((section, index) => (
                <section
                  className="report-section"
                  key={section.id}
                  style={
                    {
                      "--section-color": section.color,
                      "--section-tint": section.tint,
                    } as React.CSSProperties
                  }
                >
                  <div className="report-section-heading">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h2>{section.title}</h2>
                    <small>{section.rows.length} 项</small>
                  </div>
                  <div className="report-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {section.columns.map((column) => (
                            <th key={column.id}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.length ? (
                          section.rows.map((row) => (
                            <tr key={row.id}>
                              {section.columns.map((column) => (
                                <td key={column.id}>
                                  {column.type === "date"
                                    ? formatDate(row[column.id] || "")
                                    : row[column.id] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={section.columns.length}>本周暂无事项</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              <footer className="report-footer">
                <span>周报工坊 · 自动生成</span>
                <span>{new Date().toLocaleDateString("zh-CN")}</span>
              </footer>
            </article>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
