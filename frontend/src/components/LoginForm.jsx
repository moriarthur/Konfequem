import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiEye, FiEyeOff } from "react-icons/fi";

const USERNAME_REGEX = /^[a-zA-ZäöüÄÖÜß0-9._-]+$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000;

const validateForm = ({ username = "", password = "" }) => {
  const nextErrors = {};
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername) nextErrors.username = "Username is required";
  else if (/\s/.test(username)) nextErrors.username = "Spaces are not allowed";
  else if (!USERNAME_REGEX.test(username))
    nextErrors.username = "Only letters, numbers, ., _ and - are allowed";
  else if (trimmedUsername.length < 3 || trimmedUsername.length > 20)
    nextErrors.username = "Username must be 3-20 characters long";

  if (!trimmedPassword) nextErrors.password = "Password is required";
  else if (/\s/.test(password)) nextErrors.password = "Spaces are not allowed";
  else if (trimmedPassword.length < 6 || trimmedPassword.length > 50)
    nextErrors.password = "Password must be 6-50 characters long";

  return nextErrors;
};

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [toast, setToast] = useState(""); // <-- toast state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const usernameRef = useRef();
  const passwordRef = useRef();

  const validationErrors = useMemo(
    () => validateForm({ username, password }),
    [username, password]
  );

  const isFormValid =
    username &&
    password &&
    !validationErrors.username &&
    !validationErrors.password;

  const isLockedOut = Boolean(lockoutUntil && lockoutUntil > Date.now());

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePasswordBlur = () => {
    handleBlur("password");
    setCapsLockOn(false);
  };

  const handlePasswordKeyEvent = (event) => {
    if (typeof event.getModifierState === "function") {
      setCapsLockOn(event.getModifierState("CapsLock"));
    }
  };

  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const msLeft = lockoutUntil - Date.now();
      if (msLeft <= 0) {
        setLockoutUntil(null);
        setLockoutRemaining(0);
        setFailedAttempts(0);
        return true;
      }
      setLockoutRemaining(Math.ceil(msLeft / 1000));
      return false;
    };

    updateRemaining();
    const interval = setInterval(() => {
      if (updateRemaining()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });
    setGeneralError(null);

    if (isLockedOut) {
      setGeneralError({
        tone: "warning",
        title: "Too many attempts",
        message: `Please wait ${lockoutRemaining || Math.ceil(
          (lockoutUntil - Date.now()) / 1000
        )}s before trying again.`,
      });
      return;
    }

    if (validationErrors.username) {
      usernameRef.current?.focus();
      return;
    }

    if (validationErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      await login(username, password);
      navigate("/");
      setFailedAttempts(0);
      setLockoutUntil(null);
      setLockoutRemaining(0);
    } catch (err) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(until);
          setLockoutRemaining(Math.ceil(LOCKOUT_DURATION_MS / 1000));
          setGeneralError({
            tone: "warning",
            title: "Too many attempts",
            message: "Please wait a moment before trying again.",
          });
        } else {
          setTouched({ username: true, password: true });
          setGeneralError({
            tone: "danger",
            title: "Authentication failed",
            message: err.message || "Wrong username or password.",
          });
          usernameRef.current?.focus();
        }
      } else if (status === "network") {
        setGeneralError({
          tone: "warning",
          title: "Network issue",
          message: err.message || "Please check your connection and try again.",
        });
      } else {
        setGeneralError({
          tone: "danger",
          title: "Unexpected error",
          message: err?.message || "Something went wrong. Try again later.",
        });
      }
    } finally {
      setPassword("");
      setSubmitting(false);
    }
  };

  // --- Simple toast timeout ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSignUpClick = (e) => {
    e.preventDefault();
    setToast("This feature will be available soon. 🙂");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-surface-muted p-4">
      {/* Toast message */}
      {toast && (
        <div
          key={toast}
          className="fixed top-6 left-1/2 -translate-x-1/2 bg-status-info-soft text-status-info-text border border-status-info-border px-6 py-3 rounded-2xl shadow-soft text-sm font-medium backdrop-blur-sm z-50 opacity-0 animate-fadeInOut"
        >
          {toast}
        </div>
      )}

      <div className="w-full max-w-sm p-8 rounded-2xl bg-surface-base shadow-soft border border-border-subtle">
        <div className="flex justify-center mb-6">
          <img src="konfequem.svg" alt="Konfequem Logo" className="h-16 w-auto" />
        </div>

        {generalError && (
          <div
            role="alert"
            aria-live="assertive"
            className={`flex items-start gap-3 mb-4 rounded-xl border px-4 py-3 text-sm ${
              generalError.tone === "warning"
                ? "bg-status-warning-soft border-status-warning-border text-status-warning-text"
                : "bg-status-danger-soft border-status-danger-border text-status-danger-text"
            }`}
          >
            <div>
              <p className="font-semibold leading-tight">{generalError.title}</p>
              <p className="text-sm leading-relaxed">{generalError.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setGeneralError(null)}
              className="ml-auto text-current/70 hover:text-current"
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting}>
          <div>
            <label className="block text-sm font-medium text-accent-secondary mb-1">
              Username
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleBlur("username")}
              placeholder="Your username"
              autoComplete="username"
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none focus:ring-offset-2 bg-surface-base ${touched.username && validationErrors.username
                  ? "border-status-danger-border focus:ring-status-danger/40"
                  : "border-border-subtle text-accent-secondary focus:ring-accent-primary/40"
                }`}
              aria-invalid={Boolean(touched.username && validationErrors.username)}
              aria-describedby={
                touched.username && validationErrors.username ? "username-error" : undefined
              }
            />
            {touched.username && validationErrors.username && (
              <p
                id="username-error"
                className="text-status-danger-text text-sm mt-1"
                aria-live="polite"
              >
                {validationErrors.username}
              </p>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-accent-secondary mb-1">
              Password
            </label>
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              onKeyUp={handlePasswordKeyEvent}
              onKeyDown={handlePasswordKeyEvent}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none focus:ring-offset-2 bg-surface-base ${touched.password && validationErrors.password
                  ? "border-status-danger-border focus:ring-status-danger/40"
                  : "border-border-subtle text-accent-secondary focus:ring-accent-primary/40"
                }`}
              aria-invalid={Boolean(touched.password && validationErrors.password)}
              aria-describedby={
                touched.password && validationErrors.password ? "password-error" : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-10 text-accent-secondary/60 hover:text-accent-secondary"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
            {touched.password && validationErrors.password && (
              <p
                id="password-error"
                className="text-status-danger-text text-sm mt-1"
                aria-live="polite"
              >
                {validationErrors.password}
              </p>
            )}
            {capsLockOn && (
              <p className="mt-2 text-xs text-status-warning-text font-medium" aria-live="polite">
                <span aria-hidden="true">⇪</span> Caps Lock is on
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid || submitting || isLockedOut}
            className={`w-full font-medium py-3 rounded-xl shadow-soft transition transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${isFormValid && !submitting
                ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                : "bg-border-subtle text-white/70 cursor-not-allowed"
              }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Signing In...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          {isLockedOut && (
            <p className="mt-2 text-xs text-status-warning-text" aria-live="polite">
              Too many attempts. Please wait {lockoutRemaining}s to try again.
            </p>
          )}
        </form>

        <p className="text-center text-sm text-accent-secondary/60 mt-6">
          Don’t have an account?{" "}
          <a href="#" onClick={handleSignUpClick} className="text-accent-primary hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
