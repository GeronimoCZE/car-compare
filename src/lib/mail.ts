import nodemailer from "nodemailer";
import { SITE_NAME } from "./site";

/** Sends mail via SMTP_URL when configured; otherwise logs the message (development). */
export async function sendMail(to: string, subject: string, text: string) {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`[mail] (SMTP_URL not set) to=${to} subject=${subject}\n${text}`);
    return;
  }
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from: process.env.MAIL_FROM ?? `${SITE_NAME} <no-reply@example.cz>`, to, subject, text });
}
