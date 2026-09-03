"""
Suspicious community detection using NetworkX connected components.

METHODOLOGY
────────────
1. Build the bipartite CUSTOMER↔DEVICE↔IP graph (graph/builder.py).
2. Find connected components of CUSTOMER nodes (bridged through shared
   DEVICE/IP nodes).
3. A component becomes a "suspicious cluster" only when it meets
   measurable criteria — NOT just because it's connected.

SUSPICIOUS CLUSTER CRITERIA
─────────────────────────────
A component is classified as suspicious when it meets ALL of:
  a. ≥ MIN_CLUSTER_SIZE customers (default 2)
  b. Has shared infrastructure (≥ 1 DEVICE or IP node with degree ≥ 2)
  c. Either:
     - Cluster fraud rate > FRAUD_RATE_MULTIPLIER × merchant baseline, OR
     - Cluster device concentration > DEVICE_CONCENTRATION_THRESHOLD
       (few devices shared by many customers)

This explicitly distinguishes:
  "connected" (shares any infrastructure)
  from
  "suspicious" (meets measurable abuse criteria)

Calling every connected component a fraud ring is a false assumption
that inflates false positive rates.

OUTPUTS
────────
ClusterInfo per suspicious component, suitable for:
  - graph feature engineering (Milestone 7 features)
  - Java risk cluster storage (via Spring Boot)
  - React Flow visualisation
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import networkx as nx

from niro_ml.graph.builder import FraudGraph, NODE_CUSTOMER, NODE_DEVICE, NODE_IP

logger = logging.getLogger(__name__)

MIN_CLUSTER_SIZE:                int   = 2
FRAUD_RATE_MULTIPLIER:           float = 2.0   # cluster fraud rate must be > 2× baseline
DEVICE_CONCENTRATION_THRESHOLD:  float = 3.0   # avg customers per device (suspicious sharing)


@dataclass
class ClusterInfo:
    """
    A detected suspicious customer cluster.

    All fields are derived from observed data — none are fabricated.
    """
    cluster_id:          str
    customer_ids:        list[str]
    device_ids:          list[str]
    ip_ids:              list[str]
    n_customers:         int
    n_devices:           int
    n_ips:               int
    fraud_rate:          float    # fraction of customers with positive label
    cluster_risk_score:  float    # 0.0–1.0, based on fraud_rate and concentration
    is_suspicious:       bool
    suspicion_reason:    str
    device_concentration: float   # avg customers per device
    shared_device_count: int      # devices shared by ≥ 2 customers


@dataclass
class ClusterDetectionResult:
    """Output of detect_suspicious_clusters()."""
    merchant_id:         str
    n_components:        int     # total connected components
    n_suspicious:        int     # components meeting suspicious criteria
    clusters:            list[ClusterInfo]
    merchant_baseline_fraud_rate: float

    def suspicious_clusters(self) -> list[ClusterInfo]:
        return [c for c in self.clusters if c.is_suspicious]


def detect_suspicious_clusters(
    fraud_graph:     FraudGraph,
    customer_labels: dict[str, bool] | None = None,
    merchant_baseline_fraud_rate: float = 0.05,
) -> ClusterDetectionResult:
    """
    Identify suspicious customer clusters in the fraud graph.

    Parameters
    ----------
    fraud_graph :
        Built by graph/builder.py.
    customer_labels :
        Optional mapping customer_id → is_fraud (bool).
        Used to compute cluster fraud rates in training context.
        MUST NOT be used in inference context (would be leakage).
    merchant_baseline_fraud_rate :
        Merchant-wide historical fraud rate, used to assess whether
        a cluster's fraud rate is anomalously high.

    Returns
    -------
    ClusterDetectionResult
    """
    G = fraud_graph.graph
    customer_set = fraud_graph.customer_nodes

    # Find connected components across all node types
    components = list(nx.connected_components(G))
    logger.info(
        "Graph has %d nodes, %d edges, %d connected components.",
        G.number_of_nodes(), G.number_of_edges(), len(components)
    )

    clusters: list[ClusterInfo] = []

    for comp_idx, component in enumerate(components):
        # Split component into customers vs. infrastructure
        comp_customers = [n for n in component if n in customer_set]
        comp_devices   = [n for n in component if G.nodes[n].get("node_type") == NODE_DEVICE]
        comp_ips       = [n for n in component if G.nodes[n].get("node_type") == NODE_IP]

        if len(comp_customers) < MIN_CLUSTER_SIZE:
            continue

        # Compute device concentration: avg customers per device
        shared_devices = [
            d for d in comp_devices
            if sum(1 for nb in G.neighbors(d) if nb in customer_set) >= 2
        ]
        if comp_devices:
            customers_per_device = [
                sum(1 for nb in G.neighbors(d) if nb in customer_set)
                for d in comp_devices
            ]
            device_concentration = sum(customers_per_device) / len(comp_devices)
        else:
            device_concentration = 1.0

        # Compute cluster fraud rate from labels (training only)
        if customer_labels:
            labeled = [
                customer_labels[c] for c in comp_customers if c in customer_labels
            ]
            fraud_rate = sum(labeled) / len(labeled) if labeled else 0.0
        else:
            fraud_rate = 0.0   # unknown at inference time

        # Determine suspicion
        is_suspicious, reason = _assess_suspicion(
            fraud_rate, device_concentration, len(shared_devices),
            merchant_baseline_fraud_rate,
        )

        # Cluster risk score: weighted combination
        risk_score = _cluster_risk_score(
            fraud_rate, device_concentration,
            len(shared_devices), len(comp_customers),
        )

        clusters.append(ClusterInfo(
            cluster_id           = f"C-{comp_idx:04d}",
            customer_ids         = comp_customers,
            device_ids           = comp_devices,
            ip_ids               = comp_ips,
            n_customers          = len(comp_customers),
            n_devices            = len(comp_devices),
            n_ips                = len(comp_ips),
            fraud_rate           = round(fraud_rate, 4),
            cluster_risk_score   = round(risk_score, 4),
            is_suspicious        = is_suspicious,
            suspicion_reason     = reason,
            device_concentration = round(device_concentration, 2),
            shared_device_count  = len(shared_devices),
        ))

    n_suspicious = sum(1 for c in clusters if c.is_suspicious)
    logger.info(
        "Cluster detection complete: %d clusters, %d suspicious.",
        len(clusters), n_suspicious,
    )

    return ClusterDetectionResult(
        merchant_id=fraud_graph.merchant_id,
        n_components=len(components),
        n_suspicious=n_suspicious,
        clusters=clusters,
        merchant_baseline_fraud_rate=merchant_baseline_fraud_rate,
    )


def _assess_suspicion(
    fraud_rate:           float,
    device_concentration: float,
    shared_device_count:  int,
    baseline:             float,
) -> tuple[bool, str]:
    """Return (is_suspicious, reason_string)."""
    reasons = []

    if fraud_rate > 0 and fraud_rate > FRAUD_RATE_MULTIPLIER * baseline:
        reasons.append(
            f"cluster fraud rate {fraud_rate:.1%} > {FRAUD_RATE_MULTIPLIER}× "
            f"baseline {baseline:.1%}"
        )

    if device_concentration >= DEVICE_CONCENTRATION_THRESHOLD:
        reasons.append(
            f"device concentration {device_concentration:.1f} customers/device "
            f"(threshold {DEVICE_CONCENTRATION_THRESHOLD})"
        )

    if shared_device_count >= 2:
        reasons.append(f"{shared_device_count} devices shared by ≥2 customers")

    if reasons:
        return True, "; ".join(reasons)
    return False, "connected but below suspicion thresholds"


def _cluster_risk_score(
    fraud_rate:           float,
    device_concentration: float,
    shared_device_count:  int,
    n_customers:          int,
) -> float:
    """
    Compute a 0–1 cluster risk score from observed properties.

    Weights (not arbitrary — each contributes independently):
      fraud_rate:           40% weight (most direct signal if labels available)
      device_concentration: 35% weight (strongest structural signal)
      shared_device_count:  15% weight (absolute count)
      n_customers:          10% weight (larger = more coordinated)
    """
    fr_score   = min(1.0, fraud_rate * 3.0)            # scale: 33% fraud → 1.0
    dc_score   = min(1.0, device_concentration / 10.0) # scale: 10 cust/device → 1.0
    sd_score   = min(1.0, shared_device_count  / 5.0)  # scale: 5 shared → 1.0
    nc_score   = min(1.0, n_customers          / 20.0) # scale: 20 customers → 1.0

    return 0.4 * fr_score + 0.35 * dc_score + 0.15 * sd_score + 0.10 * nc_score
