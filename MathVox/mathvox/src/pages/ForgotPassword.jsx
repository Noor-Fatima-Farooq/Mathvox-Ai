import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard, { AuthButton, AuthInput } from "../components/AuthCard";
import { forgotPassword } from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      setMessage(data.message || "Check your email for a reset link.");
    } catch (err) {
      setError(err.message || "Request failed");
    }
    setLoading(false);
  };

  return (
    <AuthCard
      title="Reset password"
      subtitle="We will email you a link to set a new password"
    >
      <AuthInput
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
      {message && (
        <p className="text-sm text-green-600 dark:text-green-400 mb-3 text-center">
          {message}
        </p>
      )}

      <AuthButton onClick={handleSubmit} disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </AuthButton>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/login" className="text-indigo-500">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
