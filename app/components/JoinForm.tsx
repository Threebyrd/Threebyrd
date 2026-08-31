"use client";

import { useState, type FormEvent } from "react";

const endpoint = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ?? "";

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function JoinForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const configured = endpoint !== "";
  const locked = !configured || status === "submitting" || status === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!email && !phone) {
      setStatus("error");
      setStatusMessage("Enter your email, phone number, or both to join.");
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
      className="joinForm"
      data-provider={configured ? "google-apps-script" : "pending"}
      data-action={endpoint}
      onSubmit={handleSubmit}
    >
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={locked}
        />
      </div>
      <div>
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="(555) 555-5555"
          autoComplete="tel"
          pattern="[+0-9\s().-]{7,20}"
          title="Enter a phone number (7-20 digits, spaces, and symbols)."
          disabled={locked}
        />
      </div>
      <button type="submit" disabled={locked}>
        {!configured
          ? "List opening soon"
          : status === "submitting"
            ? "Sending…"
            : status === "success"
              ? "You are on the list"
              : "Get launch updates"}
      </button>
      <p className={status === "error" ? "joinFormError" : undefined} role="status" aria-live="polite">
        {statusMessage ||
          (configured
            ? "We will only use your contact info to share launch updates."
            : "The sign-up connection will be added before online ordering opens.")}
      </p>
    </form>
  );
}
