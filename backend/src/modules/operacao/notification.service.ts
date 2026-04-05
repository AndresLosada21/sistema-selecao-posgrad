import nodemailer from "nodemailer";

import { env } from "../../config/env.js";

type NotificationInput = {
  to: string;
  subject: string;
  text: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export async function sendOperationalNotification(input: NotificationInput) {
  const from = env.SMTP_FROM ?? "no-reply@ppgee.ufam.local";
  const info = await getTransporter().sendMail({ from, to: input.to, subject: input.subject, text: input.text });

  return {
    accepted: input.to,
    preview: env.NODE_ENV === "production" ? undefined : JSON.stringify(info.message ?? info.envelope ?? info, null, 2),
  };
}

export async function sendOperationalNotificationSafely(input: NotificationInput) {
  try {
    return await sendOperationalNotification(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao enviar notificacao.";
    console.warn(`[notification] ${message}`);
    return {
      accepted: input.to,
      preview: undefined,
      failed: true as const,
      error: message,
    };
  }
}
