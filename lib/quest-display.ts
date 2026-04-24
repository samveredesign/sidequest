/**
 * Main quest lines use "Title: body" — title is Providence, body is Geist in the UI.
 */
export function parseQuestLine(text: string): { title: string; body: string } | null {
  const i = text.indexOf(":");
  if (i === -1) return null;
  const title = text.slice(0, i).trim();
  const body = text.slice(i + 1).trim();
  if (!title || !body) return null;
  return { title, body };
}
