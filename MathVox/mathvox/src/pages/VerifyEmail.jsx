import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { verifyEmail } from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid confirmation link.");
      return;
    }
    verifyEmail(token)
      .then((data) => {
        setStatus("ok");
        setMessage(data.message || "Email confirmed!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Verification failed.");
      });
  }, [token]);

  return (
    <AuthCard title="Email confirmation" subtitle="">
      {status === "loading" && (
        <p className="text-center text-gray-500">Confirming your email…</p>
      )}
      {status === "ok" && (
        <>
          <p className="text-center text-green-600 dark:text-green-400 mb-4">
            {message}
          </p>
          <Link
            to="/login"
            className="block text-center bg-indigo-500 text-white py-3 rounded-xl font-semibold"
          >
            Log in
          </Link>
        </>
      )}
      {status === "error" && (
        <p className="text-center text-red-500">{message}</p>
      )}
    </AuthCard>
  );
}
