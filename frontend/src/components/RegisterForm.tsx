import { useState, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/authConfig";
import { FiEye, FiEyeOff } from "react-icons/fi";
import PasswordHints from "./PasswordHints";

const USERNAME_REGEX = /^[a-zA-ZäöüÄÖÜß0-9._-]+$/;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  org_name?: string;
  org_slug?: string;
}

const validateForm = ({
  username = "",
  email = "",
  password = "",
  org_name = "",
  org_slug = "",
}: {
  username: string;
  email: string;
  password: string;
  org_name: string;
  org_slug: string;
}): FormErrors => {
  const errors: FormErrors = {};
  const u = username.trim();
  const p = password.trim();

  if (!u) errors.username = "Username is required";
  else if (/\s/.test(u)) errors.username = "Spaces are not allowed";
  else if (!USERNAME_REGEX.test(u)) errors.username = "Only letters, numbers, ., _ and -";
  else if (u.length < 3 || u.length > 20) errors.username = "Must be 3-20 characters";

  if (!email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email";

  if (!p) errors.password = "Password is required";
  else if (p.length < 8) errors.password = "At least 8 characters";

  if (!org_name.trim()) errors.org_name = "Organization name is required";
  else if (org_name.trim().length > 200) errors.org_name = "Too long (max 200 characters)";

  const slug = org_slug.trim();
  if (!slug) errors.org_slug = "Slug is required";
  else if (!SLUG_REGEX.test(slug)) errors.org_slug = "Lowercase letters, numbers, and hyphens";
  else if (slug.length < 2 || slug.length > 50) errors.org_slug = "Must be 2-50 characters";

  return errors;
};

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  const values = { username, email, password, org_name: orgName, org_slug: orgSlug };
  const validationErrors = useMemo(() => validateForm(values), [username, email, password, orgName, orgSlug]);
  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const showFieldError = (field: keyof FormErrors) =>
    touched[field] && validationErrors[field];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, org_name: true, org_slug: true });
    setServerError("");

    if (hasErrors) {
      usernameRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          org_name: orgName.trim(),
          org_slug: orgSlug.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const firstError =
          Object.values(body).find((v) => Array.isArray(v) && v.length > 0) as string[] | undefined;
        const message = firstError?.[0] || body.error || body.detail || "Registration failed.";
        setServerError(message);
        return;
      }

      const data = await res.json();
      await register(data.tokens);
      navigate("/");
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: keyof FormErrors) =>
    `w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none focus:ring-offset-2 bg-surface-base ${
      showFieldError(field)
        ? "border-status-danger-border focus:ring-status-danger/40"
        : "border-border-subtle text-accent-secondary focus:ring-accent-primary/40"
    }`;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-surface-base shadow-soft border border-border-subtle">
        <div className="flex justify-center mb-6">
          <img src="/konfequem.svg" alt="Konfequem" width="160" height="160" />
        </div>

        {serverError && (
          <div role="alert" className="flex items-start gap-3 mb-4 rounded-xl border px-4 py-3 text-sm bg-status-danger-soft border-status-danger-border text-status-danger-text">
            <div>
              <p className="font-semibold leading-tight">Registration failed</p>
              <p className="text-sm leading-relaxed">{serverError}</p>
            </div>
            <button type="button" onClick={() => setServerError("")} className="ml-auto text-current/70 hover:text-current" aria-label="Dismiss">×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting}>
          <div>
            <label htmlFor="org_name" className="block text-sm font-medium text-accent-secondary mb-1">Organization name</label>
            <input id="org_name" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} onBlur={() => handleBlur("org_name")} placeholder="Acme Corp" className={fieldClass("org_name")} />
            {showFieldError("org_name") && <p className="text-status-danger-text text-sm mt-1">{validationErrors.org_name}</p>}
          </div>

          <div>
            <label htmlFor="org_slug" className="block text-sm font-medium text-accent-secondary mb-1">Organization slug</label>
            <input id="org_slug" type="text" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value.toLowerCase())} onBlur={() => handleBlur("org_slug")} placeholder="acme-corp" className={fieldClass("org_slug")} />
            {showFieldError("org_slug") && <p className="text-status-danger-text text-sm mt-1">{validationErrors.org_slug}</p>}
          </div>

          <hr className="border-border-subtle" />

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-accent-secondary mb-1">Username</label>
            <input id="username" ref={usernameRef} type="text" value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => handleBlur("username")} placeholder="Your username" autoComplete="username" className={fieldClass("username")} />
            {showFieldError("username") && <p className="text-status-danger-text text-sm mt-1">{validationErrors.username}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-accent-secondary mb-1">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => handleBlur("email")} placeholder="you@example.com" autoComplete="email" className={fieldClass("email")} />
            {showFieldError("email") && <p className="text-status-danger-text text-sm mt-1">{validationErrors.email}</p>}
          </div>

          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-accent-secondary mb-1">Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => handleBlur("password")} placeholder="••••••••" autoComplete="new-password" className={`${fieldClass("password")} pr-12`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-accent-secondary/60 hover:text-accent-secondary" aria-label={showPassword ? "Hide" : "Show"}>
                {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
            {showFieldError("password") && <p className="text-status-danger-text text-sm mt-1">{validationErrors.password}</p>}
            <PasswordHints password={password} username={username} />
          </div>

          <button
            type="submit"
            disabled={hasErrors || submitting}
            className={`w-full font-medium py-3 rounded-xl shadow-soft transition transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${
              !hasErrors && !submitting ? "bg-accent-primary text-white hover:bg-accent-primary/90" : "bg-border-subtle text-white/70 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Creating...
              </span>
            ) : "Create Organization"}
          </button>
        </form>

        <p className="text-center text-sm text-accent-secondary/60 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-accent-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
