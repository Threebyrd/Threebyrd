"use client";

import { withBasePath } from "../site-paths";
import { useState, type FormEvent } from "react";

const endpoint = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ?? "";

type FormStatus = "idle" | "submitting" | "success" | "error";

type JoinFormProps = {
  idPrefix: string;
  compact?: boolean;
};

export default function JoinForm({ idPrefix, compact = false }: JoinFormProps) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const configured = endpoint !== "";
  const locked = !configured || status === "submitting" || status === "success";
  const emailId = `${idPrefix}-email`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const phone = "";

    if (!email) {
      setStatus("error");
      setStatusMessage("Enter your email to join.");
      return;
    }

    setStatus("submitting");
    setStatusMessage("");

    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: new URLSearchParams({ email, phone }),
      });
      setStatus("success");
      setStatusMessage("You are on the list. Launch details are on the way.");
      form.reset();
    } catch {
      setStatus("error");
      setStatusMessage("Something went wrong. Please try again in a few minutes.");
    }
  }

  return (
    <form
      id={`${idPrefix}-form`}
      className={`joinForm${compact ? " joinFormCompact" : ""}`}
      data-provider={configured ? "google-apps-script" : "pending"}
      data-action={endpoint}
      onSubmit={handleSubmit}
    >
      <div>
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          disabled={locked}
        />
      </div>
      <button type="submit" disabled={locked}>
        {!configured
          ? "List menu updates"
          : status === "submitting"
            ? "Sending…"
            : status === "success"
              ? "You are on the list"
              : "Get launch updates"}
      </button>
      <p
        className={status === "error" ? "joinFormError" : undefined}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage ||
          (configured
            ? "We will only use your contact info to share launch updates."
            : "The sign-up connection will be added before menu updates begin.")}
      </p>
      <p><a href={withBasePath("/privacy")}>Privacy Policy</a> · <a href={withBasePath("/terms")}>Terms &amp; Conditions</a>. This form signs you up for email updates only.</p>
    </form>
  );
}
