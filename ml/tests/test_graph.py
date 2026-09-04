"""
Tests for graph intelligence modules:
  graph/builder.py  — FraudGraph construction, merchant isolation
  graph/community.py — suspicious cluster detection, criteria validation
  graph/features.py  — graph-derived ML features, column presence

Key invariants tested:
  1. A customer with no device/IP has no graph edges
  2. Two customers sharing a device appear as connected
  3. Merchant isolation: devices shared across merchants do NOT bridge them
  4. Cluster detection uses measurable criteria, not just connectivity
  5. All GRAPH_FEATURE_NAMES columns present after add_graph_features()
  6. Default (neutral) values for customers not in the graph
  7. Suspicious cluster requires ≥ 2 customers + shared infrastructure
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


# ── Helpers ────────────────────────────────────────────────────────────────

def _tx_df(rows: list[dict]) -> pd.DataFrame:
    """Build a minimal canonical DataFrame for graph tests."""
    defaults = {
        "transaction_id":   None,
        "merchant_id":      "m1",
        "customer_id":      None,
        "device_id":        None,
        "ip_address":       None,
        "timestamp":        pd.Timestamp("2024-01-01", tz="UTC"),
        "amount":           100.0,
        "currency":         "USD",
        "payment_method":   "CARD",
        "merchant_category": "UNKNOWN",
        "data_source":      "SYNTHETIC",
    }
    return pd.DataFrame([{**defaults, **r} for r in rows])


# ═══════════════════════════════════════════════════════════════════════════
# FraudGraph builder
# ═══════════════════════════════════════════════════════════════════════════

class TestFraudGraphBuilder:

    def test_empty_df_builds_empty_graph(self):
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([])
        g  = build_graph(df, merchant_id="m1")
        assert g.n_customers() == 0
        assert g.n_edges()     == 0

    def test_single_customer_no_device_no_ip(self):
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([{"customer_id": "C1", "transaction_id": "T1"}])
        g  = build_graph(df, merchant_id="m1")
        assert g.n_customers() == 1
        assert g.n_devices()   == 0
        assert g.n_ips()       == 0
        assert g.n_edges()     == 0

    def test_customer_with_device_creates_edge(self):
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([{"customer_id": "C1", "transaction_id": "T1", "device_id": "DEV-001"}])
        g  = build_graph(df, merchant_id="m1")
        assert g.n_customers() == 1
        assert g.n_devices()   == 1
        assert g.n_edges()     == 1

    def test_customer_with_ip_creates_edge(self):
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([{"customer_id": "C1", "transaction_id": "T1", "ip_address": "1.2.3.4"}])
        g  = build_graph(df, merchant_id="m1")
        assert g.n_customers() == 1
        assert g.n_ips()       == 1
        assert g.n_edges()     == 1

    def test_two_customers_same_device_connected(self):
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([
            {"customer_id": "C1", "transaction_id": "T1", "device_id": "DEV-SHARED"},
            {"customer_id": "C2", "transaction_id": "T2", "device_id": "DEV-SHARED"},
        ])
        g = build_graph(df, merchant_id="m1")
        assert g.n_customers() == 2
        assert g.n_devices()   == 1
        # Both customers connected to the same device → 2 edges
        assert g.n_edges()     == 2

    def test_two_customers_different_devices_not_bridged(self):
        from zeno_ml.graph.builder import build_graph, get_customer_neighbors
        df = _tx_df([
            {"customer_id": "C1", "transaction_id": "T1", "device_id": "DEV-001"},
            {"customer_id": "C2", "transaction_id": "T2", "device_id": "DEV-002"},
        ])
        g = build_graph(df, merchant_id="m1")
        nb1 = get_customer_neighbors(g, "C1")
        nb2 = get_customer_neighbors(g, "C2")
        assert nb1["co_users_device"] == [], "C1 should have no device co-users"
        assert nb2["co_users_device"] == [], "C2 should have no device co-users"

    def test_merchant_isolation(self):
        """
        Same device used across two merchants must NOT create a connection.
        Each graph is built per-merchant.
        """
        from zeno_ml.graph.builder import build_graph, get_customer_neighbors
        df_m1 = _tx_df([{
            "customer_id": "C_M1", "transaction_id": "T_M1",
            "device_id": "DEV-SHARED-CROSS", "merchant_id": "merchant-1",
        }])
        df_m2 = _tx_df([{
            "customer_id": "C_M2", "transaction_id": "T_M2",
            "device_id": "DEV-SHARED-CROSS", "merchant_id": "merchant-2",
        }])
        g1 = build_graph(df_m1, merchant_id="merchant-1")
        g2 = build_graph(df_m2, merchant_id="merchant-2")
        # Each graph has only its own customer
        assert g1.n_customers() == 1
        assert g2.n_customers() == 1
        nb1 = get_customer_neighbors(g1, "C_M1")
        # No co-users from merchant-2
        assert "C_M2" not in nb1["co_users_device"]

    def test_duplicate_transactions_no_duplicate_edges(self):
        """Same customer-device pair appearing twice must produce only one edge."""
        from zeno_ml.graph.builder import build_graph
        df = _tx_df([
            {"customer_id": "C1", "transaction_id": "T1", "device_id": "DEV-001"},
            {"customer_id": "C1", "transaction_id": "T2", "device_id": "DEV-001"},
        ])
        g = build_graph(df, merchant_id="m1")
        assert g.n_edges() == 1, "Duplicate customer-device pairs should produce one edge"

    def test_get_customer_neighbors_absent_customer(self):
        """customer not in graph returns empty lists — no KeyError."""
        from zeno_ml.graph.builder import build_graph, get_customer_neighbors
        df = _tx_df([{"customer_id": "C1", "transaction_id": "T1"}])
        g  = build_graph(df, merchant_id="m1")
        nb = get_customer_neighbors(g, "NONEXISTENT")
        assert nb["devices"]         == []
        assert nb["ips"]             == []
        assert nb["co_users_device"] == []
        assert nb["co_users_ip"]     == []


# ═══════════════════════════════════════════════════════════════════════════
# Community detection
# ═══════════════════════════════════════════════════════════════════════════

class TestCommunityDetection:

    def _build_cluster_graph(self, n_customers: int, shared_device: bool) -> "FraudGraph":
        from zeno_ml.graph.builder import build_graph
        rows = []
        for i in range(n_customers):
            dev = "DEV-SHARED" if shared_device else f"DEV-{i:03d}"
            rows.append({
                "customer_id":    f"C{i:03d}",
                "transaction_id": f"T{i:03d}",
                "device_id":      dev,
            })
        return build_graph(_tx_df(rows), merchant_id="m1")

    def test_isolated_customers_no_clusters(self):
        """Customers with unique devices produce no multi-customer clusters."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=5, shared_device=False)
        result = detect_suspicious_clusters(g, merchant_baseline_fraud_rate=0.05)
        assert result.n_suspicious == 0, (
            "Isolated customers should not form suspicious clusters."
        )

    def test_shared_device_creates_cluster(self):
        """5 customers sharing one device should form a cluster."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=5, shared_device=True)
        labels = {f"C{i:03d}": True for i in range(5)}   # all fraud for testing
        result = detect_suspicious_clusters(
            g,
            customer_labels=labels,
            merchant_baseline_fraud_rate=0.05,
        )
        assert len(result.clusters) >= 1
        cluster = result.clusters[0]
        assert cluster.n_customers == 5

    def test_cluster_not_suspicious_below_thresholds(self):
        """
        Two customers sharing a device with NO fraud labels and low device
        concentration should NOT be marked suspicious.
        """
        from zeno_ml.graph.community import detect_suspicious_clusters, MIN_CLUSTER_SIZE
        g = self._build_cluster_graph(n_customers=2, shared_device=True)
        labels = {f"C{i:03d}": False for i in range(2)}
        result = detect_suspicious_clusters(
            g, customer_labels=labels,
            merchant_baseline_fraud_rate=0.05,
        )
        # device_concentration = 2 (both share 1 device) < DEVICE_CONCENTRATION_THRESHOLD (3)
        # fraud_rate = 0 < 2 × 0.05 = 0.10
        # → should NOT be suspicious
        assert all(not c.is_suspicious for c in result.clusters), (
            "Low device concentration + zero fraud rate should not trigger suspicious."
        )

    def test_high_fraud_rate_cluster_is_suspicious(self):
        """Cluster with fraud_rate > 2× baseline should be suspicious."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=4, shared_device=True)
        labels = {f"C{i:03d}": True for i in range(4)}  # all fraud
        result = detect_suspicious_clusters(
            g, customer_labels=labels,
            merchant_baseline_fraud_rate=0.05,  # threshold = 0.10
        )
        suspicious = [c for c in result.clusters if c.is_suspicious]
        assert len(suspicious) >= 1, (
            "100% fraud rate cluster should be detected as suspicious."
        )

    def test_cluster_risk_score_in_unit_interval(self):
        """cluster_risk_score must be in [0,1]."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=6, shared_device=True)
        labels = {f"C{i:03d}": i % 2 == 0 for i in range(6)}
        result = detect_suspicious_clusters(
            g, customer_labels=labels,
            merchant_baseline_fraud_rate=0.05,
        )
        for cluster in result.clusters:
            assert 0.0 <= cluster.cluster_risk_score <= 1.0, (
                f"cluster_risk_score={cluster.cluster_risk_score} out of [0,1]"
            )

    def test_cluster_with_no_labels_fraud_rate_zero(self):
        """When customer_labels is None, cluster fraud_rate must be 0.0."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=4, shared_device=True)
        result = detect_suspicious_clusters(g, customer_labels=None,
                                            merchant_baseline_fraud_rate=0.05)
        for c in result.clusters:
            assert c.fraud_rate == 0.0, (
                "Without labels, cluster fraud_rate must be 0.0 (not fabricated)."
            )

    def test_single_customer_component_excluded(self):
        """Components with only 1 customer must not appear in clusters list."""
        from zeno_ml.graph.community import detect_suspicious_clusters, MIN_CLUSTER_SIZE
        g = self._build_cluster_graph(n_customers=1, shared_device=True)
        result = detect_suspicious_clusters(g, merchant_baseline_fraud_rate=0.05)
        assert len(result.clusters) == 0, (
            f"Single-customer components must be excluded (MIN_CLUSTER_SIZE={MIN_CLUSTER_SIZE})."
        )

    def test_suspicion_reason_populated(self):
        """is_suspicious=True clusters must have a non-empty suspicion_reason."""
        from zeno_ml.graph.community import detect_suspicious_clusters
        g = self._build_cluster_graph(n_customers=5, shared_device=True)
        labels = {f"C{i:03d}": True for i in range(5)}
        result = detect_suspicious_clusters(
            g, customer_labels=labels, merchant_baseline_fraud_rate=0.05
        )
        for c in result.clusters:
            if c.is_suspicious:
                assert len(c.suspicion_reason) > 0, (
                    "Suspicious clusters must have a populated suspicion_reason."
                )


# ═══════════════════════════════════════════════════════════════════════════
# Graph features
# ═══════════════════════════════════════════════════════════════════════════

class TestGraphFeatures:

    @pytest.fixture
    def graph_and_clusters(self):
        """Build a small graph with 4 customers sharing 1 device."""
        from zeno_ml.graph.builder import build_graph
        from zeno_ml.graph.community import detect_suspicious_clusters
        rows = [
            {"customer_id": "C1", "transaction_id": "T1", "device_id": "DEV-S"},
            {"customer_id": "C2", "transaction_id": "T2", "device_id": "DEV-S"},
            {"customer_id": "C3", "transaction_id": "T3", "device_id": "DEV-S"},
            {"customer_id": "C4", "transaction_id": "T4", "device_id": "DEV-SOLO"},
        ]
        df   = _tx_df(rows)
        g    = build_graph(df, merchant_id="m1")
        lbs  = {"C1": True, "C2": True, "C3": False, "C4": False}
        cr   = detect_suspicious_clusters(g, customer_labels=lbs,
                                          merchant_baseline_fraud_rate=0.05)
        return g, cr, df

    def test_all_graph_feature_columns_present(self, graph_and_clusters):
        from zeno_ml.graph.features import add_graph_features, GRAPH_FEATURE_NAMES
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        for col in GRAPH_FEATURE_NAMES:
            assert col in df_feat.columns, f"Missing graph feature column: {col}"

    def test_cluster_members_have_nonzero_cluster_size(self, graph_and_clusters):
        from zeno_ml.graph.features import add_graph_features
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        # C1, C2, C3 share DEV-S → should be in a cluster
        cluster_members = df_feat[df_feat["customer_id"].isin(["C1", "C2", "C3"])]
        assert (cluster_members["graph_cluster_size"] > 0).all(), (
            "Customers in a multi-member cluster should have graph_cluster_size > 0."
        )

    def test_solo_customer_has_zero_cluster_size(self, graph_and_clusters):
        from zeno_ml.graph.features import add_graph_features
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        c4_row = df_feat[df_feat["customer_id"] == "C4"].iloc[0]
        assert c4_row["graph_cluster_size"] == 0.0, (
            "C4 (solo device) should have graph_cluster_size=0."
        )

    def test_in_cluster_indicator_correct(self, graph_and_clusters):
        from zeno_ml.graph.features import add_graph_features
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        for cid in ["C1", "C2", "C3"]:
            row = df_feat[df_feat["customer_id"] == cid].iloc[0]
            assert row["graph_in_cluster"] == 1.0, (
                f"{cid} should have graph_in_cluster=1."
            )

    def test_co_user_count_correct_for_shared_device(self, graph_and_clusters):
        from zeno_ml.graph.features import add_graph_features
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        # C1 shares DEV-S with C2 and C3 → co_user_count should be 2
        c1_row = df_feat[df_feat["customer_id"] == "C1"].iloc[0]
        assert c1_row["graph_co_user_count"] == 2.0, (
            f"C1 shares DEV-S with 2 others, expected co_user_count=2, "
            f"got {c1_row['graph_co_user_count']}"
        )

    def test_absent_customer_gets_zero_graph_features(self):
        """Customer not in the training graph gets default 0 values."""
        from zeno_ml.graph.builder import build_graph
        from zeno_ml.graph.community import detect_suspicious_clusters
        from zeno_ml.graph.features import add_graph_features, GRAPH_FEATURE_NAMES

        # Graph built from training data
        train_df = _tx_df([{"customer_id": "TRAIN_C", "transaction_id": "T_TR",
                             "device_id": "DEV-TR"}])
        g  = build_graph(train_df, merchant_id="m1")
        cr = detect_suspicious_clusters(g, merchant_baseline_fraud_rate=0.05)

        # New customer at inference time — not in training graph
        new_df = _tx_df([{"customer_id": "NEW_C", "transaction_id": "T_NEW",
                           "device_id": "DEV-NEW"}])
        df_feat = add_graph_features(new_df.copy(), g, cr)
        row = df_feat.iloc[0]
        assert row["graph_in_cluster"]    == 0.0
        assert row["graph_cluster_size"]  == 0.0
        assert row["graph_co_user_count"] == 0.0

    def test_graph_features_are_numeric(self, graph_and_clusters):
        """All graph feature columns must be numeric (float)."""
        from zeno_ml.graph.features import add_graph_features, GRAPH_FEATURE_NAMES
        g, cr, df = graph_and_clusters
        df_feat = add_graph_features(df.copy(), g, cr)
        for col in GRAPH_FEATURE_NAMES:
            assert pd.api.types.is_numeric_dtype(df_feat[col]), (
                f"Graph feature column '{col}' is not numeric."
            )

    def test_graph_feature_hook_callable(self, graph_and_clusters):
        """build_graph_feature_hook() must return a callable."""
        from zeno_ml.graph.features import build_graph_feature_hook
        g, cr, _ = graph_and_clusters
        hook = build_graph_feature_hook(g, cr)
        assert callable(hook)

    def test_graph_feature_hook_adds_columns(self, graph_and_clusters):
        """Hook returned by build_graph_feature_hook() must add graph columns."""
        from zeno_ml.graph.features import build_graph_feature_hook, GRAPH_FEATURE_NAMES
        g, cr, df = graph_and_clusters
        hook     = build_graph_feature_hook(g, cr)
        df_after = hook(df.copy())
        for col in GRAPH_FEATURE_NAMES:
            assert col in df_after.columns


# ═══════════════════════════════════════════════════════════════════════════
# Graph feature names registered in base.py
# ═══════════════════════════════════════════════════════════════════════════

class TestGraphFeatureBase:

    def test_graph_features_list_not_empty(self):
        from zeno_ml.features.base import GRAPH_FEATURES
        assert len(GRAPH_FEATURES) > 0

    def test_all_feature_columns_with_graph_superset(self):
        from zeno_ml.features.base import ALL_FEATURE_COLUMNS, ALL_FEATURE_COLUMNS_WITH_GRAPH, GRAPH_FEATURES
        for col in ALL_FEATURE_COLUMNS:
            assert col in ALL_FEATURE_COLUMNS_WITH_GRAPH
        for col in GRAPH_FEATURES:
            assert col in ALL_FEATURE_COLUMNS_WITH_GRAPH

    def test_no_duplicate_feature_names(self):
        from zeno_ml.features.base import ALL_FEATURE_COLUMNS_WITH_GRAPH
        assert len(ALL_FEATURE_COLUMNS_WITH_GRAPH) == len(set(ALL_FEATURE_COLUMNS_WITH_GRAPH)), (
            "ALL_FEATURE_COLUMNS_WITH_GRAPH contains duplicate column names."
        )
