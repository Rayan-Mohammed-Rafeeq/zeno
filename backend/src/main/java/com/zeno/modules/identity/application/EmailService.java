package com.zeno.modules.identity.application;

/**
 * Application-layer port for sending transactional emails.
 * The identity module depends on this abstraction, not on any specific provider.
 */
public interface EmailService {
    void sendVerificationEmail(String to, String name, String rawToken);
    void sendPasswordResetEmail(String to, String name, String rawToken);
}
