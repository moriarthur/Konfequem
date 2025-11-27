import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({ username: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [toast, setToast] = useState(""); // <-- toast state

  const usernameRef = useRef();
  const passwordRef = useRef();

  const validateField = (field, value) => {
    let error = "";
    const trimmed = value.trim();

    if (field === "username") {
      if (!trimmed) error = "Username is required";
      else if (/\s/.test(value)) error = "Spaces are not allowed";
      else if (!/^[a-zA-ZäöüÄÖÜß0-9._-]+$/.test(value))
        error = "Only letters, numbers, ., _ and - are allowed";
      else if (trimmed.length < 3 || trimmed.length > 20)
        error = "Username must be 3-20 characters long";
    }

    if (field === "password") {
      if (!trimmed) error = "Password is required";
      else if (/\s/.test(value)) error = "Spaces are not allowed";
      else if (trimmed.length < 6 || trimmed.length > 50)
        error = "Password must be 6-50 characters long";
    }

    return error;
  };

  useEffect(() => {
    if (touched.username)
      setErrors((prev) => ({
        ...prev,
        username: validateField("username", username),
      }));
  }, [username, touched.username]);

  useEffect(() => {
    if (touched.password)
      setErrors((prev) => ({
        ...prev,
        password: validateField("password", password),
      }));
  }, [password, touched.password]);

  const isFormValid =
    !validateField("username", username) &&
    !validateField("password", password) &&
    username &&
    password;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, field === "username" ? username : password),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });

    const usernameError = validateField("username", username);
    const passwordError = validateField("password", password);
    setErrors({ username: usernameError, password: passwordError });

    if (usernameError) usernameRef.current.focus();
    else if (passwordError) passwordRef.current.focus();
    else {
      try {
        setSubmitting(true);
        await login(username, password);
        navigate("/");
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          general: err.message || "Something went wrong",
        }));
      } finally {
        setSubmitting(false);
      }
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

        {errors.general && (
          <p className="text-status-danger-text text-center mb-4 font-medium">{errors.general}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none focus:ring-offset-2 bg-surface-base ${touched.username && errors.username
                  ? "border-status-danger-border focus:ring-status-danger/40"
                  : "border-border-subtle text-accent-secondary focus:ring-accent-primary/40"
                }`}
            />
            {touched.username && errors.username && (
              <p className="text-status-danger-text text-sm mt-1">{errors.username}</p>
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
              onBlur={() => handleBlur("password")}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none focus:ring-offset-2 bg-surface-base ${touched.password && errors.password
                  ? "border-status-danger-border focus:ring-status-danger/40"
                  : "border-border-subtle text-accent-secondary focus:ring-accent-primary/40"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-10 text-accent-secondary/60 hover:text-accent-secondary"
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
            {touched.password && errors.password && (
              <p className="text-status-danger-text text-sm mt-1">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className={`w-full font-medium py-3 rounded-xl shadow-soft transition transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${isFormValid && !submitting
                ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                : "bg-border-subtle text-white/70 cursor-not-allowed"
              }`}
          >
            {submitting ? "Signing In..." : "Sign In"}
          </button>
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
