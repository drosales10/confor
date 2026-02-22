import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? "-";
  return NextResponse.json({ ip });
}
