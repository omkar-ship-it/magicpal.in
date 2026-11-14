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
        // The brand name comes from lib/brand.ts and nowhere else. It used
        // to fall back through MSG91_FROM_NAME, which meant an env var set
        // once at setup silently outranked the rename — the sender line
        // kept saying the old name long after every surface in the app had
        // moved. A name that can be overridden invisibly is a name that
        // will be wrong.
        from: { email: fromEmail, name: BRAND_NAME },
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
    // The MSG91 template's merge tag is spelled OTP_CODE, not the `otp` key
    // BrandSquare/LetterMail's templates use — each template's own editor
    // decides this, and a mismatch fails silently (200 OK, blank spot in the
    // email), so this has to match whatever that template actually has.
    //
    // The brand is sent under two names because the template's own tag
    // can't be read from here and an unused variable is simply ignored.
    // Note what this *can't* reach: any brand name typed as literal text
    // into the template's subject or body, which only the MSG91 dashboard
    // can change.
    variables: { OTP_CODE: code, company_name: BRAND_NAME, brand_name: BRAND_NAME },
    logLabel: "otp",
    devFallbackMessage: `login code for ${to} is ${code}`,
  });
}

/**
 * Every non-OTP email the product sends, through one template.
 *
 * Four kinds of message — somebody is waiting on you, here is who is
 * worth meeting, here is what you missed — would have been four MSG91
 * templates, each needing to be built by hand in a dashboard, each with
 * its own merge tags that fail silently when they drift. That is four
 * chances to ship an email with a blank where the headline should be.
 *
 * They are all the same shape anyway: a greeting, one sentence that is
 * the reason for the mail, a couple of supporting lines, one button, and
 * a way out. So there is one template and the caller decides what goes
 * in it.
 *
 * Variables are sent under several spellings for the same reason the OTP
 * sends the brand twice: a merge tag is whatever text somebody typed
 * into that template's editor, a mismatch returns 200 with a blank where
 * the value should be, and an unused variable is simply ignored.
 */
export async function sendNotifyEmail(opts: {
  to: string;
  firstName: string;
  /** The one sentence that is the reason this email exists. */
  headline: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
  /** Distinguishes the three jobs in the logs. */
  logLabel: string;
}): Promise<SendResult> {
  return sendMsg91TemplateEmail({
    to: opts.to,
    templateId: process.env.MSG91_NOTIFY_TEMPLATE_ID,
    variables: {
      name: opts.firstName,
      first_name: opts.firstName,
      headline: opts.headline,
      /**
       * The supporting lines twice: as slots, and pre-joined.
       *
       * MSG91 templates have no conditionals, so a template built around
       * three slots renders an empty row for every line a given person
       * does not have — and most people have one. `body_lines` is the
       * same content as one paragraph, which collapses to nothing when
       * there is nothing. The slots stay for a template that wants them.
       */
      line_1: opts.lines[0] ?? "",
      line_2: opts.lines[1] ?? "",
      line_3: opts.lines[2] ?? "",
      body_lines: opts.lines.join(" "),
      cta_label: opts.ctaLabel,
      cta_url: opts.ctaUrl,
      unsubscribe_url: opts.unsubscribeUrl,
      company_name: BRAND_NAME,
      brand_name: BRAND_NAME,
    },
    logLabel: opts.logLabel,
    devFallbackMessage:
      `to ${opts.to} — "${opts.headline}"` +
      (opts.lines.length ? ` | ${opts.lines.join(" | ")}` : "") +
      ` | ${opts.ctaLabel}: ${opts.ctaUrl} | unsubscribe: ${opts.unsubscribeUrl}`,
  });
}
