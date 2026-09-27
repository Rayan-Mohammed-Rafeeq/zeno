package com.zeno.api.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for the Zeno AI service.
 *
 * Architecture principle: AI is an intelligence/recommendation layer only.
 * This client sends context assembled by Spring Boot and receives a structured
 * recommendation. All state mutations remain in Spring Boot.
 *
 * Failure handling: Every error path returns Optional.empty() so Spring Boot
 * workflow can continue without AI. AI MUST NEVER become a single point of failure.
 *
 * Uses OkHttp3 (already on the classpath via EmailService) for consistency.
 */
@Component
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");
    private static final String ANALYZE_PATH = "/api/ai/refill-resolution/analyze";

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;
    private final boolean enabled;
    private final int maxRetries;

    public AiServiceClient(
            ObjectMapper objectMapper,
            @Value("${zeno.ai.service.url:http://localhost:8001}") String baseUrl,
            @Value("${zeno.ai.service.api-key:}") String apiKey,
            @Value("${zeno.ai.service.enabled:true}") boolean enabled,
            @Value("${zeno.ai.service.timeout-ms:15000}") long timeoutMs,
            @Value("${zeno.ai.service.max-retries:1}") int maxRetries
    ) {
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.apiKey = apiKey;
        this.enabled = enabled;
        this.maxRetries = Math.max(0, Math.min(maxRetries, 3)); // Cap at 3 retries

        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build();
    }

    /**
     * Send a refill analysis request to the Zeno AI service and return the recommendation.
     *
     * Returns Optional.empty() on any error (timeout, unavailable, malformed response, etc.)
     * so the Spring Boot workflow continues without AI assistance.
     *
     * @param request The assembled refill context
     * @param correlationId Request correlation ID for tracing
     * @return Optional containing the AI recommendation, or empty if unavailable
     */
    public Optional<AiRecommendationResponse> analyze(
            AiRecommendationRequest request,
            String correlationId
    ) {
        if (!enabled) {
            log.debug("AI service is disabled — skipping analysis [correlationId={}]", correlationId);
            return Optional.empty();
        }

        String url = baseUrl + ANALYZE_PATH;
        String requestBody;
        try {
            requestBody = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            log.error("Failed to serialize AI request [correlationId={}, error={}]",
                    correlationId, e.getMessage());
            return Optional.empty();
        }

        int attempt = 0;
        while (attempt <= maxRetries) {
            attempt++;
            Optional<AiRecommendationResponse> result = attemptRequest(
                    url, requestBody, request, correlationId, attempt
            );
            if (result.isPresent()) {
                return result;
            }
            if (attempt <= maxRetries) {
                log.warn("AI service request attempt {} failed, retrying [correlationId={}]",
                        attempt, correlationId);
            }
        }

        log.warn("AI service unavailable after {} attempt(s) — continuing without AI [correlationId={}]",
                attempt, correlationId);
        return Optional.empty();
    }

    /**
     * Return whether the AI service integration is enabled in configuration.
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Check whether the AI service health endpoint is reachable.
     */
    public boolean isHealthy() {
        if (!enabled) return false;
        Request request = new Request.Builder()
                .url(baseUrl + "/health")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            return response.isSuccessful();
        } catch (IOException e) {
            return false;
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private Optional<AiRecommendationResponse> attemptRequest(
            String url, String body, AiRecommendationRequest requestContext,
            String correlationId, int attempt
    ) {
        Request.Builder requestBuilder = new Request.Builder()
                .url(url)
                .header("Content-Type", "application/json")
                .header("X-Request-ID", correlationId)
                .post(RequestBody.create(body, JSON_TYPE));

        if (apiKey != null && !apiKey.isBlank()) {
            requestBuilder.header("Authorization", "Bearer " + apiKey);
        }

        Request httpRequest = requestBuilder.build();

        try (Response response = httpClient.newCall(httpRequest).execute()) {
            if (!response.isSuccessful()) {
                log.warn("AI service returned HTTP {} [correlationId={}, attempt={}, url={}]",
                        response.code(), correlationId, attempt, url);
                // Don't retry 4xx (bad request / auth) — only retry 5xx/503
                if (response.code() >= 400 && response.code() < 500) {
                    return Optional.empty();
                }
                return Optional.empty();
            }

            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                log.warn("AI service returned empty response body [correlationId={}]", correlationId);
                return Optional.empty();
            }

            String responseJson = responseBody.string();
            if (responseJson == null || responseJson.isBlank()) {
                log.warn("AI service returned blank response [correlationId={}]", correlationId);
                return Optional.empty();
            }

            AiRecommendationResponse recommendation =
                    objectMapper.readValue(responseJson, AiRecommendationResponse.class);

            // Validate that essential fields are present
            if (!isValidResponse(recommendation, requestContext)) {
                log.error("AI service returned invalid recommendation structure [correlationId={}]",
                        correlationId);
                return Optional.empty();
            }

            log.info("AI recommendation received [correlationId={}, refillId={}, action={}, safety={}]",
                    correlationId,
                    recommendation.getRefillId(),
                    recommendation.getRecommendedAction(),
                    recommendation.getSafetyClass());

            return Optional.of(recommendation);

        } catch (IOException e) {
            log.warn("AI service request failed [correlationId={}, attempt={}, error={}]",
                    correlationId, attempt, e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            log.error("Unexpected error calling AI service [correlationId={}, error={}]",
                    correlationId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Verify the response has the minimum required fields to be usable. */
    private boolean isValidResponse(AiRecommendationResponse rec, AiRecommendationRequest request) {
        return rec != null
                && request.getRefillId().equals(rec.getRefillId())
                && request.getCaseId().equals(rec.getCaseId())
                && rec.getBlocker() != null
                && rec.getRecommendedAction() != null
                && rec.getAssignedRole() != null
                && rec.getRequiresHumanApproval() != null
                && rec.getSafetyClass() != null
                && rec.getConfidence() != null
                && rec.getConfidence() >= 0.0 && rec.getConfidence() <= 1.0
                && (request.getRefillRequest().getBlockerType() == null
                    || request.getRefillRequest().getBlockerType().equals(rec.getBlocker()))
                && (!Set.of("HIGH_RISK_HUMAN_REVIEW", "MEDIUM_RISK_CONFIRMATION")
                    .contains(rec.getSafetyClass()) || Boolean.TRUE.equals(rec.getRequiresHumanApproval()))
                && (!"REQUEST_PROVIDER_REVIEW".equals(rec.getRecommendedAction())
                    || "PROVIDER".equals(rec.getAssignedRole()));
    }
}
