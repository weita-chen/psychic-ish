const PROFILE_KEY = "psychicish.profile.v1";

export type Session = {
  token: string;
  playerId: string;
  roomCode: string;
};

export type ProfileDraft = {
  nickname: string;
  characterId: string;
};

function sessionKey(code: string): string {
  return `psychicish.session.v1.${code}`;
}

export function loadSession(roomCode: string): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(roomCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.playerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(sessionKey(session.roomCode), JSON.stringify(session));
}

export function clearSession(roomCode: string): void {
  localStorage.removeItem(sessionKey(roomCode));
}

export function loadProfile(): ProfileDraft {
  if (typeof window === "undefined") {
    return { nickname: "", characterId: "few_screws_loose" };
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { nickname: "", characterId: "few_screws_loose" };
    const parsed = JSON.parse(raw) as ProfileDraft;
    return {
      nickname: parsed.nickname ?? "",
      characterId: parsed.characterId || "few_screws_loose",
    };
  } catch {
    return { nickname: "", characterId: "few_screws_loose" };
  }
}

export function saveProfile(draft: ProfileDraft): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(draft));
}
