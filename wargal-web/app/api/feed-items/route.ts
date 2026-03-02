import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const page = url.searchParams.get("page") ?? "1";
  const pageSize = url.searchParams.get("pageSize") ?? "20";
  const sourceId = url.searchParams.get("sourceId") ?? "";
  const kind = url.searchParams.get("kind") ?? "";
  const q = url.searchParams.get("q") ?? "";
  const diverse = url.searchParams.get("diverse") ?? "";

  const base = process.env.API_BASE_URL;
  if (!base) {
    return NextResponse.json({ message: "API_BASE_URL missing" }, { status: 500 });
  }

  const target = new URL(`${base}/feed-items`);
  target.searchParams.set("page", page);

  // ✅ backend caps to 50 anyway, but we keep it sane here
  const ps = Math.max(1, Math.min(50, Number(pageSize) || 20));
  target.searchParams.set("pageSize", String(ps));

  if (sourceId) target.searchParams.set("sourceId", sourceId);
  if (kind) target.searchParams.set("kind", kind);
  if (q) target.searchParams.set("q", q);
  if (diverse) target.searchParams.set("diverse", diverse);

  const res = await fetch(target.toString(), { cache: "no-store" });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}