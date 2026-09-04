package com.niro.modules.monitoring.interfaces;

import com.niro.modules.monitoring.application.MonitoringService;
import com.niro.modules.monitoring.interfaces.dto.MonitoringHealthResponse;
import com.niro.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/monitoring")
@RequiredArgsConstructor
@Tag(name = "Monitoring", description = "Model health and drift monitoring")
public class MonitoringController {

    private final MonitoringService monitoringService;

    @GetMapping("/health")
    @Operation(
        summary = "Get model monitoring health",
        description = "Returns prediction drift, data quality, and model status from the ML service. " +
                      "Always returns HTTP 200 — check overall_status field for health state. " +
                      "Returns UNAVAILABLE when ML service is disabled or unreachable."
    )
    public ResponseEntity<ApiResponse<MonitoringHealthResponse>> health() {
        return ResponseEntity.ok(ApiResponse.of(monitoringService.getHealth()));
    }
}
