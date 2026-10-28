import { randomBytes } from "node:crypto";

export function generatePlayerToken(): string {
  return randomBytes(32).toString("base64url");
}
