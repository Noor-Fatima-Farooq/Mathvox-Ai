import { useEffect, useRef } from "react";

export default function GoogleSignIn({ clientId, onSuccess, disabled }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!clientId || !containerRef.current || disabled) return;

    const init = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) onSuccess(response.credential);
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: Math.min(380, containerRef.current.offsetWidth || 380),
        text: "continue_with",
        shape: "pill",
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.id = "google-gsi-script";
    script.onload = init;
    document.body.appendChild(script);
  }, [clientId, onSuccess, disabled]);

  if (!clientId) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`flex justify-center w-full min-h-[44px] mb-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    />
  );
}
