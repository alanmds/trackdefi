"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_KINDS, KIND_LABELS, MAX_MESSAGE, type FeedbackKind } from "../../core/feedback";
import { FEEDBACK_EMAIL } from "../site";

type Status =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; withEmail: boolean }
  | { s: "error"; msg: string };

const ERRORS: Record<string, string> = {
  message_too_short: "Please write a few more words.",
  message_too_long: `Please keep it under ${MAX_MESSAGE.toLocaleString("en-US")} characters.`,
  invalid_email: "That email address doesn't look right.",
  invalid_wallet: "That wallet address doesn't look right.",
  rate_limited: "Too many messages in a row — please wait a few minutes.",
};

/**
 * Formulário de sugestões. Chega pré-preenchido quando vem do atalho
 * "Something missing?" da página da carteira (`?type=missing&wallet=0x…`).
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [website, setWebsite] = useState(""); // campo-isca: pessoa nunca vê
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const [copied, setCopied] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    // marcado no navegador, não no servidor: é o relógio de "quando abriu"
    startedAt.current = Date.now();
    const q = new URLSearchParams(window.location.search);
    const t = q.get("type");
    if (t && (FEEDBACK_KINDS as readonly string[]).includes(t)) setKind(t as FeedbackKind);
    const w = q.get("wallet");
    if (w) setWallet(w);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ s: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          email,
          wallet,
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
      setStatus({
        s: "error",
        msg: ERRORS[body.error ?? ""] ?? `Couldn't send right now. You can email us at ${FEEDBACK_EMAIL} instead.`,
      });
    } catch {
      setStatus({ s: "error", msg: `Couldn't send right now. You can email us at ${FEEDBACK_EMAIL} instead.` });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de área de transferência: o endereço está visível na tela */
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

  const podeEnviar = message.trim().length >= 5 && status.s !== "sending";

  return (
    <>
      <form className="feedback-form" onSubmit={submit} noValidate>
        <fieldset className="feedback-kinds">
          <legend>What is it about?</legend>
          {FEEDBACK_KINDS.map((k) => (
            <label key={k} className={`chip chip-radio${kind === k ? " is-on" : ""}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              {KIND_LABELS[k]}
            </label>
          ))}
        </fieldset>

        <label className="feedback-field">
          <span>Your message</span>
          <textarea
            required
            rows={6}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              kind === "missing"
                ? "Which position is missing? The exchange and network help a lot — e.g. “my WETH/USDC on Aerodrome, Base”."
                : "An idea, a network you'd like to see, something that looks off…"
            }
          />
        </label>

        {(kind === "missing" || wallet !== "") && (
          <label className="feedback-field">
            <span>Wallet address</span>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x… — lets us see exactly what's missing"
            />
          </label>
        )}

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
          <button type="submit" className="btn" disabled={!podeEnviar}>
            {status.s === "sending" ? "Sending…" : "Send"}
          </button>
        </div>
        {status.s === "error" && (
          <p className="form-error" role="alert">
            {status.msg}
          </p>
        )}
      </form>

      <p className="feedback-alt">
        Prefer email? Write to <strong>{FEEDBACK_EMAIL}</strong>{" "}
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </p>
    </>
  );
}
