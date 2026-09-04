"""
Graph-derived ML features.

These features augment the behavioral/device/IP features with
graph-structural information not captured by simple counting.

KEY DISTINCTION
────────────────
The features in device_ip.py count how many customers share a device/IP
by scanning prior transactions sequentially.  These graph features capture
STRUCTURAL properties: cluster membership, suspicious-neighbor fraction,
etc., which require the full graph to compute.

LEAKAGE PREVENTION
───────────────────
The graph is built from TRAINING data only.
At inference time, the graph is the training graph — new transactions
are scored against it without updating it.
This means a new customer with no graph history gets default (neutral) values.

FEATURE NAMES (added to ALL_FEATURE_COLUMNS in Milestone 7 bump)
─────────────────────────────────────────────────────────────────
  graph_customer_degree      — total edges for this customer in training graph
  graph_device_degree        — avg degree of devices this customer uses
  graph_ip_degree            — avg degree of IPs this customer uses
  graph_co_user_count        — distinct other customers sharing any device/IP
  graph_suspicious_neighbor  — fraction of co-users in suspicious clusters
  graph_in_cluster           — 1 if customer is in any cluster, else 0
  graph_cluster_size         — size of customer's cluster (0 if not in one)
  graph_cluster_fraud_rate   — cluster fraud rate (0 if not in cluster)
  graph_cluster_risk_score   — cluster risk score (0 if not in cluster)
  graph_shared_device_count  — devices shared by ≥ 2 customers that this
                               customer uses
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from zeno_ml.graph.builder import FraudGraph, NODE_CUSTOMER, NODE_DEVICE, NODE_IP, get_customer_neighbors
from zeno_ml.graph.community import ClusterDetectionResult

logger = logging.getLogger(__name__)

GRAPH_FEATURE_NAMES: list[str] = [
    "graph_customer_degree",
    "graph_device_degree",
    "graph_ip_degree",
    "graph_co_user_count",
    "graph_suspicious_neighbor_frac",
    "graph_in_cluster",
    "graph_cluster_size",
    "graph_cluster_fraud_rate",
    "graph_cluster_risk_score",
    "graph_shared_device_count",
]


def add_graph_features(
    df:              pd.DataFrame,
    fraud_graph:     FraudGraph,
    cluster_result:  ClusterDetectionResult,
) -> pd.DataFrame:
    """
    Add graph-derived features to a normalized transaction DataFrame.

    Parameters
    ----------
    df :
        Normalized DataFrame with customer_id column.
    fraud_graph :
        Trained FraudGraph (built from training data only).
    cluster_result :
        ClusterDetectionResult from community.detect_suspicious_clusters().

    Returns
    -------
    df with GRAPH_FEATURE_NAMES columns appended (in-place).
    """
    # Pre-compute customer → cluster mapping for fast lookup
    cust_to_cluster: dict[str, "ClusterInfo"] = {}  # noqa: F821
    suspicious_customers: set[str] = set()

    for cluster in cluster_result.clusters:
        for cid in cluster.customer_ids:
            cust_to_cluster[cid] = cluster
            if cluster.is_suspicious:
                suspicious_customers.add(cid)

    # Init columns
    for col in GRAPH_FEATURE_NAMES:
        df[col] = 0.0

    G = fraud_graph.graph

    for idx, row in df.iterrows():
        cust_id = str(row["customer_id"])
        neighbors = get_customer_neighbors(fraud_graph, cust_id)

        # Customer degree (total connections in graph)
        cust_degree = G.degree(cust_id) if cust_id in G else 0
        df.at[idx, "graph_customer_degree"] = float(cust_degree)

        # Avg degree of connected devices
        devs = neighbors["devices"]
        df.at[idx, "graph_device_degree"] = (
            float(np.mean([G.degree(d) for d in devs])) if devs else 0.0
        )

        # Avg degree of connected IPs
        ips = neighbors["ips"]
        df.at[idx, "graph_ip_degree"] = (
            float(np.mean([G.degree(ip) for ip in ips])) if ips else 0.0
        )

        # Co-user count (all customers sharing any device or IP)
        co_users = set(neighbors["co_users_device"]) | set(neighbors["co_users_ip"])
        df.at[idx, "graph_co_user_count"] = float(len(co_users))

        # Suspicious neighbor fraction
        if co_users:
            susp_count = sum(1 for c in co_users if c in suspicious_customers)
            df.at[idx, "graph_suspicious_neighbor_frac"] = susp_count / len(co_users)

        # Cluster features
        cluster = cust_to_cluster.get(cust_id)
        if cluster:
            df.at[idx, "graph_in_cluster"]          = 1.0
            df.at[idx, "graph_cluster_size"]         = float(cluster.n_customers)
            df.at[idx, "graph_cluster_fraud_rate"]   = float(cluster.fraud_rate)
            df.at[idx, "graph_cluster_risk_score"]   = float(cluster.cluster_risk_score)

        # Shared device count (devices with ≥2 customers from this customer's perspective)
        shared_devs = [
            d for d in devs
            if sum(1 for nb in G.neighbors(d) if nb in fraud_graph.customer_nodes) >= 2
        ]
        df.at[idx, "graph_shared_device_count"] = float(len(shared_devs))

    return df


def build_graph_feature_hook(
    fraud_graph:    FraudGraph,
    cluster_result: ClusterDetectionResult,
):
    """
    Create a graph feature hook compatible with pipeline.register_graph_feature_hook().

    Returns a function (df) -> df that adds graph features.
    This is called once at startup so the graph is captured in the closure.
    """
    def hook(df: pd.DataFrame) -> pd.DataFrame:
        return add_graph_features(df, fraud_graph, cluster_result)
    return hook
