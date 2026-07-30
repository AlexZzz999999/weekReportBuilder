"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ColumnType = "text" | "date" | "status" | "longtext";
type StatusTone = "pending" | "active" | "done" | "cancelled";

type StatusOption = {
  id: string;
  label: string;
  tone: StatusTone;
};

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

type PersistedReportData = {
  version: 2 | 3;
  reportTitle: string;
  weekStart: string;
  weekEnd: string;
  sections: ReportSection[];
  statusOptions?: Array<StatusOption | string>;
  updatedAt: string;
};

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options?: {
    mode?: "read" | "readwrite";
  }): Promise<PermissionState>;
  requestPermission(options?: {
    mode?: "read" | "readwrite";
  }): Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: FileSystemHandle;
  }) => Promise<DirectoryHandle>;
};

const LEGACY_STORAGE_KEY = "weekly-report-workshop-v1";
const DATA_FILE_NAME = "周报工坊数据.json";
const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { id: "analyzing", label: "待分析", tone: "pending" },
  { id: "developing", label: "开发中", tone: "active" },
  { id: "testing", label: "已转测", tone: "active" },
  { id: "online", label: "已全网", tone: "done" },
  { id: "cancelled", label: "已取消", tone: "cancelled" },
];
const LEGACY_STATUS_MAP: Record<string, string> = {
  未开始: "待分析",
  待确认: "待分析",
  进行中: "开发中",
  有风险: "开发中",
  已延期: "开发中",
  已完成: "已全网",
};
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

const cloneDefaultStatusOptions = () =>
  DEFAULT_STATUS_OPTIONS.map((option) => ({ ...option }));

function inferStatusTone(label: string): StatusTone {
  if (label === "已全网" || label === "已完成") return "done";
  if (label === "已取消") return "cancelled";
  if (
    label === "开发中" ||
    label === "已转测" ||
    label === "进行中" ||
    label === "有风险" ||
    label === "已延期"
  ) {
    return "active";
  }
  return "pending";
}

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

function isPersistedReportData(value: unknown): value is PersistedReportData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PersistedReportData>;
  return (
    typeof data.reportTitle === "string" &&
    typeof data.weekStart === "string" &&
    typeof data.weekEnd === "string" &&
    Array.isArray(data.sections)
  );
}

async function readReportData(handle: DirectoryHandle) {
  const fileHandle = await handle.getFileHandle(DATA_FILE_NAME, { create: true });
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  const parsed: unknown = JSON.parse(text);
  if (!isPersistedReportData(parsed)) {
    throw new Error("所选目录中的周报数据文件格式无法识别");
  }
  return parsed;
}

async function writeReportData(
  handle: DirectoryHandle,
  data: Omit<PersistedReportData, "version" | "updatedAt" | "statusOptions"> & {
    statusOptions: StatusOption[];
  },
) {
  const fileHandle = await handle.getFileHandle(DATA_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(
    JSON.stringify(
      {
        ...data,
        version: 3,
        updatedAt: new Date().toISOString(),
      } satisfies PersistedReportData,
      null,
      2,
    ),
  );
  await writable.close();
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
        status: "开发中",
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
        status: "已转测",
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
        status: "已全网",
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
        status: "开发中",
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
        status: "待分析",
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

function getStatusClass(status: string, options: StatusOption[]) {
  const tone = options.find((option) => option.label === status)?.tone;
  if (tone === "done") return "status-done";
  if (tone === "cancelled") return "status-risk";
  if (tone === "active") return "status-active";
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

  return `<div style="font-family:'Times New Roman','Microsoft YaHei','微软雅黑',serif;color:#22312f;line-height:1.5">
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
  const [isStatusManagerOpen, setIsStatusManagerOpen] = useState(false);
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(
    cloneDefaultStatusOptions,
  );
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusTone, setNewStatusTone] = useState<StatusTone>("pending");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [newSectionColor, setNewSectionColor] = useState("#3f9d82");
  const [toast, setToast] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryHandle | null>(
    null,
  );
  const [directoryName, setDirectoryName] = useState("");
  const [isDirectoryGateOpen, setIsDirectoryGateOpen] = useState(true);
  const [directoryStatus, setDirectoryStatus] = useState<
    "required" | "connecting" | "connected" | "unsupported" | "error"
  >("required");
  const [directoryError, setDirectoryError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSection =
    sections.find((section) => section.id === activeSectionId) || sections[0];

  const totalItems = sections.reduce((total, section) => total + section.rows.length, 0);
  const statusToneByLabel = new Map(
    statusOptions.map((option) => [option.label, option.tone]),
  );
  const completedItems = sections.reduce(
    (total, section) =>
      total +
      section.rows.filter((row) => statusToneByLabel.get(row.status) === "done")
        .length,
    0,
  );
  const cancelledItems = sections.reduce(
    (total, section) =>
      total +
      section.rows.filter((row) => statusToneByLabel.get(row.status) === "cancelled")
        .length,
    0,
  );
  const attentionItems = sections.reduce(
    (total, section) =>
      total +
      section.rows.filter((row) => statusToneByLabel.get(row.status) === "pending")
        .length,
    0,
  );
  const inProgressItems = sections.reduce(
    (total, section) =>
      total +
      section.rows.filter((row) => statusToneByLabel.get(row.status) === "active")
        .length,
    0,
  );
  const trackedItems = totalItems - cancelledItems;
  const completionRate = trackedItems
    ? Math.round((completedItems / trackedItems) * 100)
    : 0;

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const applyLoadedReport = (data: PersistedReportData) => {
    const hasStoredStatusOptions =
      Array.isArray(data.statusOptions) && data.statusOptions.length > 0;
    const nextStatusOptions = hasStoredStatusOptions
      ? data.statusOptions!.map((option, index) =>
          typeof option === "string"
            ? {
                id: `status-${index}-${makeId()}`,
                label: option,
                tone: inferStatusTone(option),
              }
            : {
                id: option.id || `status-${index}-${makeId()}`,
                label: option.label,
                tone: option.tone || inferStatusTone(option.label),
              },
        )
      : cloneDefaultStatusOptions();
    const nextSections = data.sections.map((section) => {
      const statusColumnIds = section.columns
        .filter((column) => column.type === "status")
        .map((column) => column.id);
      if (!statusColumnIds.length) return section;
      return {
        ...section,
        rows: section.rows.map((row) => {
          const nextRow = { ...row };
          statusColumnIds.forEach((columnId) => {
            const currentValue = nextRow[columnId];
            if (!hasStoredStatusOptions && LEGACY_STATUS_MAP[currentValue]) {
              nextRow[columnId] = LEGACY_STATUS_MAP[currentValue];
            }
          });
          return nextRow;
        }),
      };
    });

    nextSections.forEach((section) => {
      const statusColumnIds = section.columns
        .filter((column) => column.type === "status")
        .map((column) => column.id);
      section.rows.forEach((row) => {
        statusColumnIds.forEach((columnId) => {
          const label = row[columnId]?.trim();
          if (
            label &&
            !nextStatusOptions.some((option) => option.label === label)
          ) {
            nextStatusOptions.push({
              id: `status-${makeId()}`,
              label,
              tone: inferStatusTone(label),
            });
          }
        });
      });
    });

    setSections(nextSections);
    setStatusOptions(nextStatusOptions);
    setReportTitle(data.reportTitle);
    setWeekStart(data.weekStart);
    setWeekEnd(data.weekEnd);
    if (!nextSections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(nextSections[0]?.id || "");
    }
  };

  const currentReportData = () => ({
    sections,
    statusOptions,
    reportTitle,
    weekStart,
    weekEnd,
  });

  const connectDirectory = async (reuseSavedHandle: boolean) => {
    const wasConnected = directoryStatus === "connected";
    setDirectoryStatus("connecting");
    setDirectoryError("");

    try {
      let nextHandle = reuseSavedHandle ? directoryHandle : null;
      if (!nextHandle) {
        if (!window.isSecureContext) {
          setDirectoryStatus("unsupported");
          setDirectoryError("目录访问需要通过 HTTPS 或 localhost 打开此工具");
          return;
        }
        const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
        if (!picker) {
          setDirectoryStatus("unsupported");
          setDirectoryError("当前浏览器不支持目录访问，请使用 Chrome 或 Edge");
          return;
        }
        nextHandle = await picker({
          id: "weekly-report-workshop",
          mode: "readwrite",
          startIn: directoryHandle || undefined,
        });
      }

      if (!reuseSavedHandle && wasConnected && directoryHandle) {
        await writeReportData(directoryHandle, currentReportData());
      }

      let permission = await nextHandle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        permission = await nextHandle.requestPermission({ mode: "readwrite" });
      }
      if (permission !== "granted") {
        throw new Error("未获得该目录的读写权限");
      }

      let data = await readReportData(nextHandle);
      if (!data) {
        let initialData = currentReportData();
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          try {
            const parsed: unknown = JSON.parse(legacy);
            if (isPersistedReportData(parsed)) {
              initialData = {
                sections: parsed.sections,
                statusOptions:
                  parsed.statusOptions?.map((option, index) =>
                    typeof option === "string"
                      ? {
                          id: `status-${index}-${makeId()}`,
                          label: option,
                          tone: inferStatusTone(option),
                        }
                      : option,
                  ) || cloneDefaultStatusOptions(),
                reportTitle: parsed.reportTitle,
                weekStart: parsed.weekStart,
                weekEnd: parsed.weekEnd,
              };
            }
          } catch {
            // Keep the current defaults if legacy browser data is damaged.
          }
        }
        await writeReportData(nextHandle, initialData);
        data = {
          ...initialData,
          version: 3,
          updatedAt: new Date().toISOString(),
        };
      }

      applyLoadedReport(data);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      setDirectoryHandle(nextHandle);
      setDirectoryName(nextHandle.name);
      setDirectoryStatus("connected");
      setSaveStatus("saved");
      setIsReady(true);
      setIsDirectoryGateOpen(false);
      showToast(`已连接数据目录“${nextHandle.name}”`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setDirectoryStatus(wasConnected ? "connected" : "required");
        if (wasConnected) setIsDirectoryGateOpen(false);
        return;
      }
      setDirectoryStatus("error");
      setDirectoryError(
        error instanceof Error ? error.message : "目录连接失败，请重新选择",
      );
      setIsDirectoryGateOpen(true);
    }
  };

  useEffect(() => {
    if (!isReady || directoryStatus !== "connected" || !directoryHandle) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      void writeReportData(directoryHandle, currentReportData())
        .then(() => setSaveStatus("saved"))
        .catch(() => {
          setSaveStatus("error");
          showToast("保存失败，请检查目录权限");
        });
    }, 650);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    sections,
    statusOptions,
    reportTitle,
    weekStart,
    weekEnd,
    isReady,
    directoryHandle,
    directoryStatus,
  ]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
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

  const replaceStatusValue = (previousLabel: string, nextLabel: string) => {
    setSections((current) =>
      current.map((section) => {
        const statusColumnIds = section.columns
          .filter((column) => column.type === "status")
          .map((column) => column.id);
        if (!statusColumnIds.length) return section;
        return {
          ...section,
          rows: section.rows.map((row) => {
            const nextRow = { ...row };
            statusColumnIds.forEach((columnId) => {
              if (nextRow[columnId] === previousLabel) {
                nextRow[columnId] = nextLabel;
              }
            });
            return nextRow;
          }),
        };
      }),
    );
  };

  const renameStatusOption = (statusId: string, label: string) => {
    const nextLabel = label.trim();
    const currentOption = statusOptions.find((option) => option.id === statusId);
    if (!currentOption || currentOption.label === nextLabel) return;
    if (!nextLabel) {
      showToast("状态名称不能为空");
      return;
    }
    if (
      statusOptions.some(
        (option) => option.id !== statusId && option.label === nextLabel,
      )
    ) {
      showToast("状态名称不能重复");
      return;
    }
    setStatusOptions((current) =>
      current.map((option) =>
        option.id === statusId ? { ...option, label: nextLabel } : option,
      ),
    );
    replaceStatusValue(currentOption.label, nextLabel);
  };

  const updateStatusTone = (statusId: string, tone: StatusTone) => {
    setStatusOptions((current) =>
      current.map((option) =>
        option.id === statusId ? { ...option, tone } : option,
      ),
    );
  };

  const moveStatusOption = (statusId: string, direction: -1 | 1) => {
    setStatusOptions((current) => {
      const index = current.findIndex((option) => option.id === statusId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const addStatusOption = () => {
    const label = newStatusName.trim();
    if (!label) {
      showToast("请先填写状态名称");
      return;
    }
    if (statusOptions.some((option) => option.label === label)) {
      showToast("状态名称不能重复");
      return;
    }
    setStatusOptions((current) => [
      ...current,
      { id: `status-${makeId()}`, label, tone: newStatusTone },
    ]);
    setNewStatusName("");
    setNewStatusTone("pending");
    showToast(`已添加状态“${label}”`);
  };

  const removeStatusOption = (statusId: string) => {
    if (statusOptions.length <= 1) {
      showToast("至少需要保留一个状态");
      return;
    }
    const index = statusOptions.findIndex((option) => option.id === statusId);
    if (index < 0) return;
    const target = statusOptions[index];
    const replacement = statusOptions[index + 1] || statusOptions[index - 1];
    setStatusOptions((current) =>
      current.filter((option) => option.id !== statusId),
    );
    replaceStatusValue(target.label, replacement.label);
    showToast(`已删除状态“${target.label}”`);
  };

  const addRow = () => {
    const row = activeSection.columns.reduce<ReportRow>(
      (item, column) => {
        item[column.id] =
          column.type === "status"
            ? statusOptions[0]?.label || "待分析"
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
              rows: section.rows.map((row) => ({
                ...row,
                [columnId]:
                  newColumnType === "status"
                    ? statusOptions[0]?.label || "待分析"
                    : "",
              })),
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
              rows:
                updates.type === "status"
                  ? section.rows.map((row) => ({
                      ...row,
                      [columnId]: statusOptions.some(
                        (option) => option.label === row[columnId],
                      )
                        ? row[columnId]
                        : statusOptions[0]?.label || "待分析",
                    }))
                  : section.rows,
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
    setStatusOptions(cloneDefaultStatusOptions());
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
          <span className="sidebar-note-icon">⌂</span>
          <div>
            <strong>{directoryName || "等待选择目录"}</strong>
            <p>数据写入电脑中的 {DATA_FILE_NAME}</p>
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
            <button
              className="directory-entry"
              onClick={() => setIsDirectoryGateOpen(true)}
              disabled={directoryStatus !== "connected"}
              title="查看或更换数据目录"
            >
              <span className="directory-entry-dot" aria-hidden="true" />
              <span>
                <small>数据目录</small>
                <strong>{directoryName || "未连接"}</strong>
              </span>
              <i>更换</i>
            </button>
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

        <section className="progress-overview" aria-label="本周进展概览">
          <div className="progress-overview-heading">
            <span className="progress-overview-label">
              <i aria-hidden="true" />
              本周进展
            </span>
            <h1>工作进展概览</h1>
            <p>
              {formatDate(weekStart)} — {formatDate(weekEnd)}
            </p>
          </div>

          <div className="progress-completion">
            <div className="progress-completion-copy">
              <span>整体完成率</span>
              <strong>{completionRate}%</strong>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-label="整体完成率"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionRate}
            >
              <i style={{ width: `${completionRate}%` }} />
            </div>
            <small>
              {completedItems} / {trackedItems} 项已全网
            </small>
          </div>

          <div className="progress-metrics">
            <div className="progress-metric">
              <span>全部事项</span>
              <strong>{String(totalItems).padStart(2, "0")}</strong>
            </div>
            <div className="progress-metric progress-metric-active">
              <span>进行中</span>
              <strong>{String(inProgressItems).padStart(2, "0")}</strong>
            </div>
            <div className="progress-metric progress-metric-risk">
              <span>需关注</span>
              <strong>{String(attentionItems).padStart(2, "0")}</strong>
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
              <button
                className="secondary-button"
                onClick={() => setIsStatusManagerOpen(true)}
                data-testid="manage-statuses"
              >
                状态枚举
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
                                statusOptions,
                              )}`}
                              value={
                                row[column.id] || statusOptions[0]?.label || ""
                              }
                              onChange={(event) =>
                                updateCell(
                                  activeSection.id,
                                  row.id,
                                  column.id,
                                  event.target.value,
                                )
                              }
                            >
                              {statusOptions.map((status) => (
                                <option key={status.id} value={status.label}>
                                  {status.label}
                                </option>
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
                <i className={`save-dot save-${saveStatus}`} />
                {saveStatus === "saving"
                  ? "正在写入数据文件…"
                  : saveStatus === "error"
                    ? "保存失败，请检查目录权限"
                    : `已保存至 ${directoryName}/${DATA_FILE_NAME}`}
              </span>
              <span>横向滚动可查看全部列</span>
            </div>
          </div>
        </section>
      </main>

      {isDirectoryGateOpen && (
        <div className="directory-gate-backdrop">
          <section
            className="directory-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="directory-gate-title"
          >
            <div className="directory-gate-mark" aria-hidden="true">
              <span>⌂</span>
            </div>
            <span className="eyebrow">LOCAL DATA DIRECTORY</span>
            <h2 id="directory-gate-title">
              {directoryStatus === "connected"
                ? "当前数据目录"
                : "使用前，请先选择数据目录"}
            </h2>
            <p className="directory-gate-lead">
              周报内容将直接保存在你选择的电脑目录中。未连接目录前，编辑功能不会开放。
            </p>

            <div className="directory-file-card">
              <span className="directory-file-icon" aria-hidden="true">
                JSON
              </span>
              <div>
                <strong>{DATA_FILE_NAME}</strong>
                <small>
                  {directoryName
                    ? `保存位置：${directoryName}`
                    : "选择后将自动创建此数据文件"}
                </small>
              </div>
              {directoryStatus === "connected" && <em>已连接</em>}
            </div>

            {directoryError && (
              <div className="directory-error" role="alert">
                <strong>暂时无法连接目录</strong>
                <span>{directoryError}</span>
              </div>
            )}

            <div className="directory-gate-actions">
              {directoryStatus === "connecting" ? (
                <button className="primary-button directory-primary" disabled>
                  正在连接并读取数据…
                </button>
              ) : directoryStatus === "unsupported" ? (
                <div className="directory-browser-tip">
                  请使用最新版 Chrome 或 Edge，并通过 HTTPS 或 localhost 访问。
                </div>
              ) : directoryStatus === "connected" ? (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => void connectDirectory(false)}
                  >
                    选择其他目录
                  </button>
                  <button
                    className="primary-button directory-primary"
                    onClick={() => setIsDirectoryGateOpen(false)}
                  >
                    继续编辑
                  </button>
                </>
              ) : directoryHandle ? (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => void connectDirectory(false)}
                  >
                    选择其他目录
                  </button>
                  <button
                    className="primary-button directory-primary"
                    onClick={() => void connectDirectory(true)}
                  >
                    继续使用“{directoryName}”
                  </button>
                </>
              ) : (
                <button
                  className="primary-button directory-primary"
                  onClick={() => void connectDirectory(false)}
                >
                  选择电脑目录
                  <span className="button-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              )}
            </div>

            <div className="directory-gate-footnote">
              <span>✓ 周报正文不再保存在浏览器中</span>
              <span>✓ 刷新页面后仍会要求确认目录</span>
            </div>
          </section>
        </div>
      )}

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

      {isStatusManagerOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsStatusManagerOpen(false);
          }}
        >
          <section
            className="column-modal status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">STATUS SETTINGS</span>
                <h2 id="status-modal-title">管理状态枚举</h2>
                <p>状态对全部表格生效，可重命名、调整顺序或增删。</p>
              </div>
              <button
                className="modal-close"
                aria-label="关闭"
                onClick={() => setIsStatusManagerOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="status-option-list">
              {statusOptions.map((option, index) => (
                <div className="status-option-item" key={option.id}>
                  <span className="drag-handle" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <input
                    aria-label="状态名称"
                    key={`${option.id}-${option.label}`}
                    defaultValue={option.label}
                    onBlur={(event) => {
                      renameStatusOption(option.id, event.target.value);
                      event.target.value =
                        statusOptions.find((item) => item.id === option.id)?.label ||
                        option.label;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <select
                    aria-label="状态分类"
                    value={option.tone}
                    onChange={(event) =>
                      updateStatusTone(
                        option.id,
                        event.target.value as StatusTone,
                      )
                    }
                  >
                    <option value="pending">待处理</option>
                    <option value="active">进行中</option>
                    <option value="done">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                  <div className="column-move-actions">
                    <button
                      aria-label="向前移动"
                      disabled={index === 0}
                      onClick={() => moveStatusOption(option.id, -1)}
                    >
                      ←
                    </button>
                    <button
                      aria-label="向后移动"
                      disabled={index === statusOptions.length - 1}
                      onClick={() => moveStatusOption(option.id, 1)}
                    >
                      →
                    </button>
                  </div>
                  <button
                    className="column-delete"
                    aria-label={`删除${option.label}状态`}
                    onClick={() => removeStatusOption(option.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="add-status-form">
              <div>
                <strong>添加状态</strong>
                <span>状态分类用于统计完成率和进展数量</span>
              </div>
              <input
                aria-label="新状态名称"
                placeholder="例如：待发布"
                value={newStatusName}
                onChange={(event) => setNewStatusName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addStatusOption();
                }}
              />
              <select
                aria-label="新状态分类"
                value={newStatusTone}
                onChange={(event) =>
                  setNewStatusTone(event.target.value as StatusTone)
                }
              >
                <option value="pending">待处理</option>
                <option value="active">进行中</option>
                <option value="done">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
              <button className="add-row-button" onClick={addStatusOption}>
                添加状态
              </button>
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
                  <span>已全网 {completedItems} 项</span>
                  <span>需关注 {attentionItems} 项</span>
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
