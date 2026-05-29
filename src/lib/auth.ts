import { useGoogleLogin, googleLogout } from "@react-oauth/google";

export const GOOGLE_CLIENT_ID =
  (import.meta as any).env.VITE_GOOGLE_CLIENT_ID ||
  (import.meta as any).env.GOOGLE_CLIENT_ID ||
  "YOUR_CLIENT_ID_HERE";

export interface UserSession {
  accessToken: string;
  expiresAt: number;
}

export function saveSession(token: string, expiresIn?: number) {
  const session: UserSession = {
    accessToken: token,
    expiresAt: Date.now() + (expiresIn || 3599) * 1000 - 60000, // subtract 1 min for safety
  };
  sessionStorage.setItem("novelshelf_session", JSON.stringify(session));
}

export function getSession(): string | null {
  const stored = sessionStorage.getItem("novelshelf_session");
  if (!stored) return null;

  try {
    const session: UserSession = JSON.parse(stored);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session.accessToken;
  } catch (e) {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem("novelshelf_session");
  googleLogout();
  window.dispatchEvent(new Event("novelshelf_session_expired"));
}
