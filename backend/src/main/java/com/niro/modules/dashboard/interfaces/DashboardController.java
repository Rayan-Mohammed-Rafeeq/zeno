package com.niro.modules.dashboard.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.dashboard.application.DashboardService;
import com.niro.modules.dashboard.interfaces.dto.DashboardResponse;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Aggregate platform metrics for the Niro frontend")
public class DashboardController {

    private final DashboardService dashboardService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "Get aggregate dashboard metrics",
               description = "Returns transaction counts, risk distribution, top signals, " +
                             "recent clusters, open investigations, and latest evaluation metrics. " +
                             "All data is synthetic.")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(dashboardService.getDashboard(merchantId)));
    }
}
