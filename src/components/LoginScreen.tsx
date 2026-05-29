import React from "react";
import { BookOpen, AlertCircle } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { saveSession, GOOGLE_CLIENT_ID } from "../lib/auth";
import { customAlert } from "../lib/dialogs";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (user: any) => void;
}) {
  const [loggingIn, setLoggingIn] = React.useState(false);
  const isMissingClientId = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_CLIENT_ID_HERE";
  const isInIframe = window !== window.top;

  const handleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      saveSession(tokenResponse.access_token, tokenResponse.expires_in);
      onLogin({ id: "user", email: "" }); // Minimal mock user to pass the check
      setLoggingIn(false);
    },
    onError: () => {
      console.error("Login Failed");
      customAlert("Failed to login with Google.");
      setLoggingIn(false);
    },
    scope: "https://www.googleapis.com/auth/drive.file",
    onNonOAuthError: () => {
      setLoggingIn(false);
    },
  });

  // Automatically rest setLoggingIn if stuck after 20 seconds (e.g. popup lost)
  React.useEffect(() => {
    if (loggingIn) {
      const timer = setTimeout(() => {
        setLoggingIn(false);
      }, 20000);
      return () => clearTimeout(timer);
    }
  }, [loggingIn]);


  return (
    <div className="flex-1 flex h-full items-center justify-center bg-[var(--bg-color)] px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl mb-8">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-display font-semibold mb-3">NovelShelf</h1>
        <p className="text-[var(--text-secondary)] mb-10 text-lg">
          Your calm, personal digital library. Powered by your Google Drive.
        </p>

        {isMissingClientId ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-left mb-6">
            <h3 className="text-red-500 font-bold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Setup Required
            </h3>
            <p className="text-[var(--text-secondary)] text-sm mb-4 leading-relaxed">
              You need to provide your Google OAuth Client ID to connect to Google Drive.
            </p>
            <ol className="list-decimal pl-5 text-[var(--text-secondary)] text-sm space-y-2 mb-4">
              <li>Create an OAuth Web Client in Google Cloud Console.</li>
              <li>Add this URL to Authorized JavaScript origins: <br /> <strong className="text-[var(--text-color)] block mt-1 p-1.5 bg-black/5 dark:bg-white/5 rounded border border-[var(--border-color)] break-all">{window.location.origin}</strong></li>
              <li>If in <strong>AI Studio</strong>, click Settings (gear icon) &gt; <strong>Secrets</strong> &gt; Add <code>VITE_GOOGLE_CLIENT_ID</code>.</li>
              <li>If local, add it to your <code>.env</code> file.</li>
            </ol>
          </div>
        ) : (
          <>
            {isInIframe && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-left mb-6">
                <h3 className="text-yellow-600 dark:text-yellow-500 font-bold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Preview Mode Warning
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  Google Login may get stuck inside this embedded preview depending on your browser tracking settings.
                  <br /><br />
                  If the login window doesn't open properly or hangs, please <strong>open this app in a new tab</strong> (using the arrow icon in the top right).
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setLoggingIn(true);
                handleLogin();
              }}
              disabled={loggingIn || isMissingClientId}
              className="w-full flex items-center justify-center gap-3 bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-color)] py-4 px-6 rounded-2xl font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-70 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {loggingIn ? (
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>Connect Google Drive</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
