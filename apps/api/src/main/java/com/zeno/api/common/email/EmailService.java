package com.zeno.api.common.email;

import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Sends transactional emails via the Resend HTTP API.
 * Resend docs: https://resend.com/docs/api-reference/emails/send-email
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_SEND_URL = "https://api.resend.com/emails";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${resend.api-key}")
    private String apiKey;

    @Value("${resend.from-email}")
    private String fromEmail;

    private final OkHttpClient httpClient = new OkHttpClient();

    /**
     * Sends a password reset email with an HTML body.
     *
     * @param toEmail   recipient address
     * @param resetLink the full reset URL the user should click
     */
    public void sendPasswordResetEmail(String toEmail, String resetLink) {
        String html = buildPasswordResetHtml(resetLink);
        sendEmail(toEmail, "Reset your Zeno password", html);
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private void sendEmail(String to, String subject, String html) {
        String body = """
                {
                  "from": "%s",
                  "to": ["%s"],
                  "subject": "%s",
                  "html": "%s"
                }
                """.formatted(
                escapeJson(fromEmail),
                escapeJson(to),
                escapeJson(subject),
                escapeJson(html)
        );

        Request request = new Request.Builder()
                .url(RESEND_SEND_URL)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(body, JSON))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (response.isSuccessful()) {
                log.info("Password reset email sent to {}", to);
            } else {
                String responseBody = response.body() != null ? response.body().string() : "(empty)";
                log.error("Resend API error {}: {}", response.code(), responseBody);
                // We deliberately do NOT throw here — a failed email should not expose
                // whether the address exists (security: enumeration prevention).
            }
        } catch (IOException e) {
            log.error("Failed to call Resend API: {}", e.getMessage(), e);
        }
    }

    private String buildPasswordResetHtml(String resetLink) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
                  <table width="100%%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
                    <tr><td align="center">
                      <table width="560" cellpadding="0" cellspacing="0"
                             style="background:#ffffff;border-radius:8px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                        <tr><td>
                          <h2 style="color:#1a1a1a;margin-top:0;">Reset your password</h2>
                          <p style="color:#555;line-height:1.6;">
                            We received a request to reset the password for your Zeno account.
                            Click the button below to choose a new password.
                          </p>
                          <p style="text-align:center;margin:32px 0;">
                            <a href="%s"
                               style="background:#2563eb;color:#ffffff;text-decoration:none;
                                      padding:14px 28px;border-radius:6px;font-weight:bold;
                                      display:inline-block;">
                              Reset Password
                            </a>
                          </p>
                          <p style="color:#888;font-size:13px;line-height:1.6;">
                            This link expires in 30 minutes. If you didn't request a password reset,
                            you can safely ignore this email — your password won't change.
                          </p>
                          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                          <p style="color:#aaa;font-size:12px;text-align:center;">
                            Zeno · Prescription Refill Resolution Platform
                          </p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(resetLink);
    }

    /** Minimal JSON-string escaping to prevent injection in the request body. */
    private String escapeJson(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
