package com.zeno.modules.identity.infrastructure;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.identity.application.EmailService;
import com.zeno.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResendEmailService implements EmailService {

    private final ZenoProperties properties;

    private RestClient buildClient() {
        return RestClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getResend().getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public void sendVerificationEmail(String to, String name, String rawToken) {
        String verifyUrl = properties.getFrontendUrl() + "/verify-email?token=" + rawToken;
        String html = """
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2>Verify your Zeno account</h2>
                  <p>Hi %s,</p>
                  <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
                  <a href="%s"
                     style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                            text-decoration:none;border-radius:6px;font-weight:600">
                    Verify Email
                  </a>
                  <p style="margin-top:24px;color:#6b7280;font-size:13px">
                    If you didn't create a Zeno account, you can safely ignore this email.
                  </p>
                </div>
                """.formatted(name, verifyUrl);

        send(to, "Verify your Zeno account", html);
    }

    @Override
    public void sendPasswordResetEmail(String to, String name, String rawToken) {
        String resetUrl = properties.getFrontendUrl() + "/reset-password?token=" + rawToken;
        String html = """
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2>Reset your Zeno password</h2>
                  <p>Hi %s,</p>
                  <p>Click the button below to reset your password. This link expires in 1 hour.</p>
                  <a href="%s"
                     style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                            text-decoration:none;border-radius:6px;font-weight:600">
                    Reset Password
                  </a>
                  <p style="margin-top:24px;color:#6b7280;font-size:13px">
                    If you didn't request a password reset, you can safely ignore this email.
                    Your password will not be changed.
                  </p>
                </div>
                """.formatted(name, resetUrl);

        send(to, "Reset your Zeno password", html);
    }

    private void send(String to, String subject, String html) {
        Map<String, Object> payload = Map.of(
                "from", properties.getResend().getFromAddress(),
                "to", List.of(to),
                "subject", subject,
                "html", html
        );

        try {
            buildClient()
                    .post()
                    .uri("/emails")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Email sent via Resend to {}: {}", to, subject);
        } catch (RestClientResponseException ex) {
            log.error("Resend API error sending to {}: {} {}", to, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new ExternalServiceException("Resend", "Failed to send email: " + ex.getStatusCode());
        } catch (Exception ex) {
            log.error("Unexpected error sending email to {}: {}", to, ex.getMessage());
            throw new ExternalServiceException("Resend", "Failed to send email: " + ex.getMessage(), ex);
        }
    }
}
