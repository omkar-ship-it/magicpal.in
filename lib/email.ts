import { BRAND_NAME } from "./brand";

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * MSG91 v5 template email when configured, a console log otherwise. The
 * fallback isn't a stub to replace later — it's what keeps the whole sign-in
 * flow genuinely testable with zero credentials, locally or in a fresh
 * deploy nobody has wired up yet. `npm run test:flows` reads the code
 * straight out of this log.
 *
 * NOTE: MSG91 merge-tag names are exactly whatever text was typed into that
 * template's editor, and a mismatch is silent — MSG91 returns 2xx and the
 * email still arrives with a blank where the value should be. Read the live
 * template before changing the keys below.
 */
async function sendMsg91TemplateEmail(opts: {
  to: string;
  templateId: string | undefined;
  variables: Record<string, string>;
  logLabel: string;
  devFallbackMessage: string;
}): Promise<SendResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const domain = process.env.MSG91_EMAIL_DOMAIN;
  const fromEmail = process.env.MSG91_FROM_EMAIL;

  if (!authKey || !opts.templateId || !domain || !fromEmail) {
    // Logged either way: on a real deployment this is the operator's own
    // log and it's the only way to sign in and create the first board
    // before the credentials land.
    console.log(`[${opts.logLabel}] ${opts.devFallbackMessage}`);

    // But never tell a *user* their code is on its way when no email was
    // sent. Locally that silence is the documented workflow; on a live
    // deployment it is a black hole — the person waits for an email that
    // cannot arrive, and the UI said it was coming. Fail loudly instead.
    if (process.env.VERCEL_ENV === "production") {
      return { ok: false, error: "Email isn't set up on this deployment yet — nobody can receive a code." };
    }
    return { ok: true };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: [{ to: [{ email: opts.to }], variables: opts.variables }],
        from: { email: fromEmail, name: process.env.MSG91_FROM_NAME || BRAND_NAME },
        domain,
        template_id: opts.templateId,
      }),
    });

    const parsed = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[${opts.logLabel}] MSG91 send failed`, res.status, parsed);
      return { ok: false, error: "Couldn't send the email — try again?" };
    }
    console.log(`[${opts.logLabel}] queued to ${opts.to} via ${opts.templateId} — id ${parsed?.data?.unique_id ?? "?"}`);
    return { ok: true };
  } catch (err) {
    console.error(`[${opts.logLabel}] MSG91 send threw`, err);
    return { ok: false, error: "Couldn't send the email — try again?" };
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<SendResult> {
  return sendMsg91TemplateEmail({
    to,
    templateId: process.env.MSG91_EMAIL_TEMPLATE_ID,
    // The `magicpal` MSG91 template's merge tag is spelled OTP_CODE, not the
    // `otp` key BrandSquare/LetterMail's templates use — each template's own
    // editor decides this, and a mismatch fails silently (200 OK, blank spot
    // in the email), so this has to match whatever that template actually has.
    variables: { OTP_CODE: code, company_name: BRAND_NAME },
    logLabel: "otp",
    devFallbackMessage: `login code for ${to} is ${code}`,
  });
}
