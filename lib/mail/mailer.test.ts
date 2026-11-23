import { describe, expect, it, vi } from "vitest";
import { ConfigError } from "@/lib/api/errors";
import { consoleMailer, getMailer, parseRetryAfter, resendMailer } from "./mailer";

describe("getMailer", () => {
  it("falls back to the console outside production", () => {
    expect(getMailer({ NODE_ENV: "development" })).toBe(consoleMailer);
  });

  it("refuses to run without a provider in production", () => {
    expect(() => getMailer({ NODE_ENV: "production" })).toThrow(ConfigError);
  });

  it("needs MAIL_FROM alongside RESEND_API_KEY", () => {
    expect(() => getMailer({ RESEND_API_KEY: "re_x" })).toThrow(ConfigError);
  });

  it("picks Resend when configured, even in production", () => {
    const m = getMailer({ NODE_ENV: "production", RESEND_API_KEY: "re_x", MAIL_FROM: "a@b.c" });
    expect(m).not.toBe(consoleMailer);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(parseRetryAfter("Sun, 22 Nov 2026 12:00:03 GMT", now)).toBe(3000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});

describe("resendMailer", () => {
  const message = { to: "u@example.com", subject: "s", text: "t", idempotencyKey: "otp-code/abc" };
  const ok = (id = "email_123") =>
    new Response(JSON.stringify({ id }), { status: 200, headers: { "content-type": "application/json" } });
  const fail = (status: number, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ name: "err", message: `status ${status}`, statusCode: status }), {
      status,
      headers,
    });

  function setup(responses: Array<Response | Error>) {
    const fetchImpl = vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    });
    const sleeps: number[] = [];
    const lines: string[] = [];
    const mailer = resendMailer("re_key", "Tao <login@tao.test>", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      log: (l) => lines.push(l),
    });
    return { mailer, fetchImpl, sleeps, lines };
  }

  const callInit = (fetchImpl: ReturnType<typeof vi.fn>, i: number) =>
    (fetchImpl.mock.calls[i] as unknown as [string, RequestInit])[1];

  it("posts with the key as a bearer token and the idempotency key, and logs the email id", async () => {
    const { mailer, fetchImpl, lines } = setup([ok("email_abc")]);
    expect(await mailer.send(message)).toEqual({ id: "email_abc" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_key");
    expect(headers["Idempotency-Key"]).toBe("otp-code/abc");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Tao <login@tao.test>",
      to: ["u@example.com"],
      subject: "s",
      text: "t",
    });
    expect(lines).toEqual(["[mail:resend] sent id=email_abc idempotency_key=otp-code/abc attempt=1"]);
    // Neither the recipient, the body nor the key is ever logged.
    expect(lines.join()).not.toMatch(/u@example\.com|re_key/);
  });

  it("makes up an idempotency key when none is given", async () => {
    const { mailer, fetchImpl } = setup([ok()]);
    await mailer.send({ to: "u@example.com", subject: "s", text: "t" });
    const key = (callInit(fetchImpl, 0).headers as Record<string, string>)["Idempotency-Key"];
    expect(key).toMatch(/^mail\/[0-9a-f-]{36}$/);
  });

  it("retries network errors and 5xx with backoff, reusing the same idempotency key", async () => {
    const { mailer, fetchImpl, sleeps } = setup([new TypeError("fetch failed"), fail(503), ok()]);
    expect(await mailer.send(message)).toEqual({ id: "email_123" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([500, 1000]);
    const keys = [0, 1, 2].map(
      (i) => (callInit(fetchImpl, i).headers as Record<string, string>)["Idempotency-Key"],
    );
    expect(new Set(keys)).toEqual(new Set(["otp-code/abc"]));
  });

  it("honours Retry-After on a 429", async () => {
    const { mailer, sleeps } = setup([fail(429, { "retry-after": "2" }), ok()]);
    await mailer.send(message);
    expect(sleeps).toEqual([2000]);
  });

  it("gives up rather than retry early when Retry-After is beyond the cap", async () => {
    const { mailer, fetchImpl, sleeps } = setup([fail(429, { "retry-after": "60" }), ok()]);
    await expect(mailer.send(message)).rejects.toThrow(/429/);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleeps).toEqual([]);
  });

  it("stops after the last attempt", async () => {
    const { mailer, fetchImpl } = setup([fail(500), fail(502), fail(503), ok()]);
    await expect(mailer.send(message)).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 409, 422])("does not retry a %i", async (status) => {
    const { mailer, fetchImpl, sleeps } = setup([fail(status), ok()]);
    await expect(mailer.send(message)).rejects.toThrow(new RegExp(String(status)));
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleeps).toEqual([]);
  });

  it("treats a 2xx without an id as a failure, and does not retry it", async () => {
    const { mailer, fetchImpl } = setup([new Response("{}", { status: 200 }), ok()]);
    await expect(mailer.send(message)).rejects.toThrow(/without an email id/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
