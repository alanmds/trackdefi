"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE, MIN_MESSAGE } from "../../core/feedback";
import { useI18n } from "../i18n/provider";
import { basicTags, fill, rich } from "../i18n/rich";
import { fmtInt } from "./format";

type Status = { s: "idle" } | { s: "sending" } | { s: "sent"; withEmail: boolean } | { s: "error"; msg: string };

/** Formulário de feedback: mensagem + e-mail opcional. O destino não aparece. */
export default function FeedbackForm() {
  const { locale, ui } = useI18n();
  const t = ui.feedback;
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
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
      if (res.ok && body.ok) {
        setStatus({ s: "sent", withEmail: email.trim() !== "" });
        return;
      }
      // `detail` só vem fora da produção (link de teste): mostra o motivo técnico
      const known = t.errors[body.error ?? ""];
      const msg = known ? fill(known, { max: fmtInt(MAX_MESSAGE, locale) }) : t.generic;
      setStatus({ s: "error", msg: body.detail ? `${msg} [${body.error}: ${body.detail}]` : msg });
    } catch {
      setStatus({ s: "error", msg: t.generic });
    }
  }

  if (status.s === "sent") {
    return (
      <div className="state-box feedback-sent" role="status">
        <h2>{t.sentTitle}</h2>
        <p>
          {status.withEmail ? t.sentWithEmail : t.sentNoEmail}
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
          {t.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <form className="feedback-form" onSubmit={submit} noValidate>
      <label className="feedback-field">
        <span>{t.messageLabel}</span>
        <textarea
          required
          rows={7}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.messagePlaceholder}
        />
      </label>

      <label className="feedback-field">
        <span>
          {rich(t.emailLabel, basicTags)}
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
        />
      </label>

      {/* campo-isca: fora da tela para pessoas, irresistível para robôs */}
      <label className="hp" aria-hidden="true">
        {t.honeypot}
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      <div className="feedback-actions">
        <button type="submit" className="btn" disabled={message.trim().length < MIN_MESSAGE || status.s === "sending"}>
          {status.s === "sending" ? t.sending : t.send}
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
