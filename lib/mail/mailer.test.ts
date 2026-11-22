import { describe, expect, it, vi } from "vitest";
import { ConfigError } from "@/lib/api/errors";
import { consoleMailer, getMailer, resendMailer } from "./mailer";

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

describe("resendMailer", () => {
  it("posts the message with the key as a bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await resendMailer("re_key", "Tao <no-reply@tao.test>", fetchImpl).send({
      to: "u@example.com",
      subject: "s",
      text: "t",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Tao <no-reply@tao.test>",
      to: ["u@example.com"],
      subject: "s",
      text: "t",
    });
  });

  it("throws when Resend rejects the message", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad from", { status: 422 }));
    await expect(
      resendMailer("k", "f", fetchImpl).send({ to: "u@x.com", subject: "s", text: "t" }),
    ).rejects.toThrow(/422/);
  });
});
