package com.zeno.modules.decision.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.decision.application.DecisionService;
import com.zeno.modules.decision.interfaces.dto.DecisionResponse;
import com.zeno.modules.decision.interfaces.dto.RecommendRequest;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.shared.api.ApiResponse;
import com.zeno.shared.api.PageMeta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decisions")
@RequiredArgsConstructor
@Tag(name = "Decisions", description = "Bounded defensive decision recommendations")
public class DecisionController {

    private final DecisionService decisionService;
    private final MerchantService merchantService;

    @PostMapping("/recommend")
    @Operation(summary = "Get a defensive decision recommendation",
               description = "Returns a bounded defensive recommendation based on risk level. " +
                             "Recommendations are advisory only — no real actions are taken.")
    public ResponseEntity<ApiResponse<DecisionResponse>> recommend(
            @Valid @RequestBody RecommendRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(decisionService.recommend(merchantId, request)));
    }

    @GetMapping
    @Operation(summary = "List decision recommendations for the current merchant")
    public ResponseEntity<ApiResponse<List<DecisionResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Page<DecisionResponse> result = decisionService.list(merchantId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }
}
