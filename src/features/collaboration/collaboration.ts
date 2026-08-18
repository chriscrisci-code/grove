export type CollaboratorRole = "owner" | "editor" | "viewer";

export function normalizeInviteEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isInviteEmail(value: string) {
  const email = normalizeInviteEmail(value);
  return (
    email.length >= 3 &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

export function collaboratorRoleLabel(role: CollaboratorRole) {
  if (role === "viewer") return "Reviewer";
  if (role === "editor") return "Editor";
  return "Owner";
}

export function applyQuotedSuggestion(
  html: string,
  quotedText: string | null | undefined,
  suggestionText: string,
) {
  const quoted = quotedText?.trim() ?? "";
  const suggestion = suggestionText.trim();
  if (!quoted || !suggestion) return null;
  const index = html.indexOf(quoted);
  if (index < 0) return null;
  return `${html.slice(0, index)}${escapeHtml(suggestion)}${html.slice(index + quoted.length)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
