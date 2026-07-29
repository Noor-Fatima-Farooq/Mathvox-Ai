import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard, {
  AuthButton,
  AuthInput,
  AuthLink,
  AuthPasswordInput,
} from "../components/AuthCard";
import { signupUser } from "../services/api";

function validatePasswordClient(password) {
  const errors = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Za-z]/.test(password)) errors.push("one letter");
  if (!/\d/.test(password)) errors.push("one number");
  return errors;
}

export default function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");
    setMessage("");
    const user = username.trim().toLowerCase();
    if (!user || !email.trim()) {
      setError("Enter username and email.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(user)) {
      setError("Username: 3–30 characters, letters, numbers, underscore only.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const pwErrors = validatePasswordClient(password);
    if (pwErrors.length) {
      setError(`Password needs ${pwErrors.join(", ")}.`);
      return;
    }

    setLoading(true);
    try {
      const data = await signupUser({
        username: user,
        name: displayName.trim() || undefined,
        email: email.trim(),
        password,
        confirmPassword,
      });
      setMessage(
        data.email_sent
          ? "Account created! Check your email for the confirmation link, then log in."
          : "Account created! Check your email for the confirmation link, then log in."
      );
      setTimeout(() => navigate("/login"), 6000);
    } catch (err) {
      setError(err.message || "Signup failed");
    }
    setLoading(false);
  };

  return (
    <AuthCard
      title="Create your account"
      footer={
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account? <AuthLink to="/login">Log in</AuthLink>
        </p>
      }
    >
      <AuthInput
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
        disabled={loading}
        placeholder="e.g. noorfatimaanna"
        autoComplete="username"
      />
      <AuthInput
        label="Display name (optional)"
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        disabled={loading}
        placeholder="Same as username if left blank"
        autoComplete="name"
      />
      <AuthInput
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        autoComplete="email"
      />
      <AuthPasswordInput
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />
      <AuthPasswordInput
        label="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
          {message}
        </p>
      )}

      <AuthButton onClick={handleSignup} loading={loading}>
        Sign up
      </AuthButton>
    </AuthCard>
  );
}
