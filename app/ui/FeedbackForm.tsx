"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE, MIN_MESSAGE } from "../../core/feedback";

type Status = { s: "idle" } | { s: "sending" } | { s: "sent"; withEmail: boolean } | { s: "error"; msg: string };

const ERRORS: Record<string, string> = {
  message_too_short: "Please write a few more words.",
  message_too_long: `Please keep it under ${MAX_MESSAGE.toLocaleString("en-US")} characters.`,
  invalid_email: "That email address doesn't look right.",
  rate_limited: "Too many messages in a row — please wait a few minutes.",
};
const GENERICO = "Couldn't send right now. Please try again in a moment.";

/** Formulário de feedback: mensagem + e-mail opcional. O destino não aparece. */
export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // campo-isca: pessoa nunca vê
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const startedAt = useRef(0);

  // marcado no navegador, não no servidor: é o relógio de "quando abriu"
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ s: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          email,
          website,
          startedAt: startedAt.current,
          page: document.referrer ? new URL(document.referrer).pathname : null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setStatus({ s: "sent", withEmail: email.trim() !== "" });
        return;
      }
      setStatus({ s: "error", msg: ERRORS[body.error ?? ""] ?? GENERICO });
    } catch {
      setStatus({ s: "error", msg: GENERICO });
    }
  }

  if (status.s === "sent") {
    return (
      <div className="state-box feedback-sent" role="status">
        <h2>Thanks — message received.</h2>
        <p>
          {status.withEmail
            ? "Every message is read by a person. If it needs an answer, we'll reply to the email you left."
            : "Every message is read by a person. You didn't leave an email, so we can't reply — but it still counts."}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setMessage("");
            setStatus({ s: "idle" });
            startedAt.current = Date.now();
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="feedback-form" onSubmit={submit} noValidate>
      <label className="feedback-field">
        <span>Your message</span>
        <textarea
          required
          rows={7}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="An idea, a network you'd like to see, a position we missed, something that looks off…"
        />
      </label>

      <label className="feedback-field">
        <span>
          Your email <em>(optional — only if you want a reply)</em>
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      {/* campo-isca: fora da tela para pessoas, irresistível para robôs */}
      <label className="hp" aria-hidden="true">
        Website
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      <div className="feedback-actions">
        <button type="submit" className="btn" disabled={message.trim().length < MIN_MESSAGE || status.s === "sending"}>
          {status.s === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {status.s === "error" && (
        <p className="form-error" role="alert">
          {status.msg}
        </p>
      )}
    </form>
  );
}
