import { parseQuestLine } from "@/lib/quest-display";

type Props = {
  text: string;
  className?: string;
  /** Use inside table cells / inline contexts (renders span, not p). */
  inline?: boolean;
};

/**
 * Renders main quest text: title (Providence) + body (Geist Regular via instruction-copy).
 */
export function QuestText({ text, className = "", inline = false }: Props) {
  const parts = parseQuestLine(text);
  const content = !parts ? (
    <span className="instruction-copy block">{text}</span>
  ) : (
    <>
      <span className="quest-intro block leading-snug">{parts.title}</span>
      <span className="instruction-copy block leading-snug">{parts.body}</span>
    </>
  );

  if (inline) {
    return (
      <span
        className={`quest-line flex flex-col gap-1 text-left ${className}`.trim()}
      >
        {content}
      </span>
    );
  }

  return (
    <p className={`quest-line flex flex-col gap-1 ${className}`.trim()}>{content}</p>
  );
}
