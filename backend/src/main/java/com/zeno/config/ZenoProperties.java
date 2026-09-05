package com.zeno.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "zeno")
public class ZenoProperties {

    private String frontendUrl = "http://localhost:5173";

    private Jwt jwt = new Jwt();
    private Resend resend = new Resend();
    private Ai ai = new Ai();
    private Risk risk = new Risk();
    private Evaluation evaluation = new Evaluation();
    private Ml ml = new Ml();
    private Razorpay razorpay = new Razorpay();

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenExpiryMinutes = 60;
    }

    @Getter
    @Setter
    public static class Resend {
        private String apiKey;
        private String fromAddress = "noreply@zeno.app";
    }

    @Getter
    @Setter
    public static class Ai {
        private String apiKey;
        private String apiUrl = "https://api.openai.com/v1/chat/completions";
        private String model = "gpt-4o-mini";
        private boolean enabled = false;
    }

    @Getter
    @Setter
    public static class Risk {
        private Thresholds thresholds = new Thresholds();

        @Getter
        @Setter
        public static class Thresholds {
            private int refundRateAnomalyScore = 25;
            private int transactionVelocityScore = 20;
            private int sharedDeviceScore = 25;
            private int sharedIpScore = 15;
            private int amountSimilarityScore = 10;
            private int newAccountScore = 5;
            private int coordinatedBehaviorScore = 30;
            private int mediumRiskThreshold = 40;
            private int highRiskThreshold = 70;
            private int criticalRiskThreshold = 90;
        }
    }

    @Getter
    @Setter
    public static class Evaluation {
        private FalsePositiveCost falsePositiveCost = new FalsePositiveCost();

        @Getter
        @Setter
        public static class FalsePositiveCost {
            /** Assumed cost per false positive requiring manual review (USD). Prototype assumption — not real merchant loss. */
            private double manualReviewCost = 15.0;
            /** Assumed opportunity cost per held legitimate transaction (USD). Prototype assumption — not real merchant loss. */
            private double heldTransactionOpportunityCost = 25.0;
        }
    }

    /**
     * Configuration for the Python FastAPI ML inference service.
     * The service is opt-in: when ml.enabled=false the risk engine uses
     * only rule-based signal detectors (existing behaviour is preserved).
     */
    @Getter
    @Setter
    public static class Ml {
        /** Whether to call the ML service for risk scoring. Default: false (rule-based only). */
        private boolean enabled = false;

        /** Base URL of the Python FastAPI ML service. */
        private String serviceUrl = "http://localhost:8001";

        /** HTTP timeout for ML service calls in seconds. */
        private int timeoutSeconds = 5;

        /** Number of retry attempts on connection failure before falling back to rule-based scoring. */
        private int maxRetries = 1;
    }

    /**
     * Configuration for Razorpay webhook integration.
     *
     * Test Mode only — never claim IEEE-CIS model metrics represent Razorpay production performance.
     * All incoming events are clearly labeled as TEST_MODE in the UI.
     */
    @Getter
    @Setter
    public static class Razorpay {
        /**
         * Webhook secret configured in Razorpay Dashboard → Settings → Webhooks.
         * Used for HMAC-SHA256 signature verification of incoming webhook events.
         * Set via env var RAZORPAY_WEBHOOK_SECRET.
         */
        private String webhookSecret = "";

        /**
         * Razorpay API Key ID (rzp_test_xxx / rzp_live_xxx).
         * Safe to include in error messages but must not be sent to the frontend via API responses.
         * Frontend uses its own VITE_RAZORPAY_KEY_ID env var.
         * Set via env var RAZORPAY_KEY_ID.
         */
        private String keyId = "";

        /**
         * Razorpay API Key Secret.
         * MUST NEVER be exposed to the frontend or logged.
         * Used only for: order creation (Basic Auth) and payment signature verification (HMAC-SHA256).
         * Set via env var RAZORPAY_KEY_SECRET.
         */
        private String keySecret = "";

        /**
         * Whether webhook processing is enabled.
         * Set false to disable all webhook handling without removing config.
         */
        private boolean enabled = false;
    }
}
