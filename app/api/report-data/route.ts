import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_FILE_NAME = "周报工坊数据.json";
const dataFilePath = () => path.join(process.cwd(), DATA_FILE_NAME);

function isReportData(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.reportTitle === "string" &&
    typeof data.weekStart === "string" &&
    typeof data.weekEnd === "string" &&
    Array.isArray(data.sections)
  );
}

function storageMetadata() {
  return {
    directoryName: path.basename(process.cwd()),
    fileName: DATA_FILE_NAME,
  };
}

export async function GET() {
  try {
    const content = await readFile(dataFilePath(), "utf8");
    const data: unknown = JSON.parse(content);
    if (!isReportData(data)) {
      return NextResponse.json(
        { error: "项目目录中的周报数据文件格式无法识别" },
        { status: 422 },
      );
    }
    return NextResponse.json({ data, ...storageMetadata() });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ data: null, ...storageMetadata() });
    }
    return NextResponse.json(
      { error: "无法读取项目目录中的周报数据文件" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data: unknown = await request.json();
    if (!isReportData(data)) {
      return NextResponse.json(
        { error: "周报数据格式无法识别" },
        { status: 400 },
      );
    }
    const nextData = {
      ...(data as Record<string, unknown>),
      version: 3,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(dataFilePath(), JSON.stringify(nextData, null, 2), "utf8");
    return NextResponse.json({ ok: true, ...storageMetadata() });
  } catch {
    return NextResponse.json(
      { error: "无法写入项目目录中的周报数据文件" },
      { status: 500 },
    );
  }
}
