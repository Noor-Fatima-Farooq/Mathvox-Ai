import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import AuthCard, { AuthButton, AuthPasswordInput } from "../components/AuthCard";
import { resetPassword } from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!token) {
      setError("Invalid reset link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await resetPassword(token, password, confirmPassword);
      setMessage(data.message || "Password updated.");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message || "Reset failed");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <AuthCard title="Invalid link" subtitle="Request a new reset from login.">
        <Link to="/forgot-password" className="text-indigo-500 text-center block">
          Forgot password
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="New password" subtitle="Min 8 characters, with a letter and a number">
      <AuthPasswordInput
        label="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      <AuthPasswordInput
        label="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
      />

      {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
      {message && (
        <p className="text-sm text-green-600 dark:text-green-400 mb-3 text-center">
          {message}
        </p>
      )}

      <AuthButton onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving…" : "Save password"}
      </AuthButton>
    </AuthCard>
  );
}
