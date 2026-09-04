package com.niro.modules.monitoring.application;

import com.niro.config.NiroProperties;
import com.niro.modules.monitoring.interfaces.dto.MonitoringHealthResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Proxies model monitoring health from the Python FastAPI ML service.
 *
 * When ML service is disabled or unreachable, returns an UNAVAILABLE response
 * rather than throwing — monitoring should never break the application.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringService {

    private final NiroProperties properties;

    public MonitoringHealthResponse getHealth() {
        boolean mlEnabled = properties.getMl().isEnabled();

        if (!mlEnabled) {
            return MonitoringHealthResponse.unavailable(false);
        }

        try {
            String url = properties.getMl().getServiceUrl() + "/ml/monitoring/health";
            @SuppressWarnings("unchecked")
            Map<String, Object> resp = RestClient.create()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(Map.class);

            if (resp == null) {
                return MonitoringHealthResponse.unavailable(true);
            }
            return MonitoringHealthResponse.fromMlResponse(resp, true);

        } catch (RestClientException ex) {
            log.debug("ML monitoring health check failed: {}", ex.getMessage());
            return MonitoringHealthResponse.unavailable(true);
        } catch (Exception ex) {
            log.warn("Unexpected error fetching ML monitoring health: {}", ex.getMessage());
            return MonitoringHealthResponse.unavailable(true);
        }
    }
}
