import { ApiError } from "@/lib/api-error";
import { NextResponse } from "next/server";

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof Error && /not enough quests/i.test(error.message)) {
    return jsonError(error.message, 409);
  }
  console.error(error);
  return jsonError("Something went wrong. Please try again.", 500);
}
