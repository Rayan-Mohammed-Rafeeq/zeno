package com.niro.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "niro")
public class NiroProperties {

    private String frontendUrl = "http://localhost:5173";

    private Jwt jwt = new Jwt();
    private Resend resend = new Resend();
    private Ai ai = new Ai();
    private Risk risk = new Risk();
    private Evaluation evaluation = new Evaluation();

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
        private String fromAddress = "noreply@niro.app";
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
}
