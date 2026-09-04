package com.zeno.modules.graph.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.graph.application.GraphService;
import com.zeno.modules.graph.interfaces.dto.ClusterResponse;
import com.zeno.modules.graph.interfaces.dto.GraphResponse;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.shared.api.ApiResponse;
import com.zeno.shared.api.PageMeta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/clusters")
@RequiredArgsConstructor
@Tag(name = "Clusters", description = "Relationship graph and suspicious cluster detection")
public class GraphController {

    private final GraphService graphService;
    private final MerchantService merchantService;

    @PostMapping("/detect")
    @Operation(summary = "Run cluster detection",
               description = "Builds an in-memory relationship graph from payment data and runs " +
                             "connected-components analysis to identify suspicious customer clusters. " +
                             "Run risk analysis first for best results.")
    public ResponseEntity<ApiResponse<List<ClusterResponse>>> detect() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        List<ClusterResponse> clusters = graphService.detectClusters(merchantId);
        return ResponseEntity.ok(ApiResponse.of(clusters,
                java.util.Map.of("clustersDetected", clusters.size())));
    }

    @GetMapping
    @Operation(summary = "List all detected clusters for the current merchant")
    public ResponseEntity<ApiResponse<List<ClusterResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Page<ClusterResponse> result = graphService.listClusters(merchantId,
                PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a cluster by ID with all members")
    public ResponseEntity<ApiResponse<ClusterResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(graphService.getCluster(merchantId, id)));
    }

    @GetMapping("/{id}/graph")
    @Operation(summary = "Get React Flow graph data for a cluster",
               description = "Returns nodes and edges suitable for rendering with React Flow.")
    public ResponseEntity<ApiResponse<GraphResponse>> getGraph(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(graphService.getClusterGraph(merchantId, id)));
    }
}
