import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiEye, FiEyeOff } from "react-icons/fi"; // Eye icon

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({ username: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Eye toggle

  const usernameRef = useRef();
  const passwordRef = useRef();

  // --- Validation function ---
  const validateField = (field, value) => {
    let error = "";
    const trimmed = value.trim();

    if (field === "username") {
      if (!trimmed) error = "Username is required";
      else if (/\s/.test(value)) error = "Spaces are not allowed";
      else if (!/^[a-zA-Z0-9._-]+$/.test(value))
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

  // --- Live validation only if field is touched ---
  useEffect(() => {
    if (touched.username)
      setErrors((prev) => ({ ...prev, username: validateField("username", username) }));
  }, [username, touched.username]);

  useEffect(() => {
    if (touched.password)
      setErrors((prev) => ({ ...prev, password: validateField("password", password) }));
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-white shadow-xl border border-gray-200">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_Konfequem.png" alt="Konfequem Logo" className="h-16 w-auto" />
        </div>

        {/* General error */}
        {errors.general && (
          <p className="text-red-500 text-center mb-4 font-medium">{errors.general}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleBlur("username")}
              placeholder="Your username"
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none ${
                touched.username && errors.username
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
            />
            {touched.username && errors.username && (
              <p className="text-red-500 text-sm mt-1 transition-opacity duration-300">
                {errors.username}
              </p>
            )}
          </div>

          {/* Password input with eye */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur("password")}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border transition focus:ring-2 focus:outline-none ${
                touched.password && errors.password
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
            />
            {/* Eye icon */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-10 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
            {touched.password && errors.password && (
              <p className="text-red-500 text-sm mt-1 transition-opacity duration-300">
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className={`w-full text-white font-medium py-3 rounded-xl shadow-md transition transform hover:scale-[1.02] ${
              isFormValid && !submitting
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {/* Registration prompt */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don’t have an account?{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
