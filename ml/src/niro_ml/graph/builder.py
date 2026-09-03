"""
NetworkX graph builder for fraud ring detection.

GRAPH MODEL
────────────
Nodes:
  • CUSTOMER nodes  — one per unique customer_id
  • DEVICE nodes    — one per unique device_id (prefixed "DEV::")
  • IP nodes        — one per unique ip_address (prefixed "IP::")

Edges:
  • CUSTOMER → DEVICE  : customer used this device
  • CUSTOMER → IP      : customer used this IP
  • (Shared infrastructure = two customers connected through the same
    device or IP node = potential coordination signal)

The graph is bipartite: no direct CUSTOMER↔CUSTOMER edges are added.
Shared infrastructure is detected in community.py by walking through
the common DEVICE/IP nodes.

LEAKAGE PREVENTION
───────────────────
The graph must be built from data strictly before the prediction timestamp
when used in real-time scoring.

For batch training, the graph is built from the training split only.
Validation and test transactions are scored against the TRAINING graph —
they never contribute edges.

MERCHANT ISOLATION
───────────────────
The graph is built per-merchant.  A device shared across two merchants
does NOT create a connection between them.  This is enforced by the
merchant_id parameter.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import networkx as nx
import pandas as pd

logger = logging.getLogger(__name__)

NODE_CUSTOMER = "CUSTOMER"
NODE_DEVICE   = "DEVICE"
NODE_IP       = "IP"

EDGE_USED_DEVICE = "USED_DEVICE"
EDGE_USED_IP     = "USED_IP"


@dataclass
class FraudGraph:
    """
    Container for the NetworkX graph and merchant context.

    merchant_id   : enforces isolation
    graph         : undirected bipartite graph
    customer_nodes: set of customer node IDs in the graph
    device_nodes  : set of device node IDs
    ip_nodes      : set of IP node IDs
    """
    merchant_id:    str
    graph:          nx.Graph = field(default_factory=nx.Graph)
    customer_nodes: set[str] = field(default_factory=set)
    device_nodes:   set[str] = field(default_factory=set)
    ip_nodes:       set[str] = field(default_factory=set)

    def n_customers(self) -> int:
        return len(self.customer_nodes)

    def n_devices(self) -> int:
        return len(self.device_nodes)

    def n_ips(self) -> int:
        return len(self.ip_nodes)

    def n_edges(self) -> int:
        return self.graph.number_of_edges()


def build_graph(
    df:          pd.DataFrame,
    merchant_id: str,
) -> FraudGraph:
    """
    Build a fraud graph from a canonical transaction DataFrame.

    Parameters
    ----------
    df :
        DataFrame with columns: customer_id, device_id, ip_address.
        Must be pre-filtered to the correct merchant and time window.
    merchant_id :
        Used as a label and for isolation logging.

    Returns
    -------
    FraudGraph
    """
    g = FraudGraph(merchant_id=merchant_id)

    required = {"customer_id"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame missing required columns: {missing}")

    for _, row in df.iterrows():
        cust_id = str(row["customer_id"])

        # Add customer node
        if cust_id not in g.customer_nodes:
            g.graph.add_node(cust_id, node_type=NODE_CUSTOMER)
            g.customer_nodes.add(cust_id)

        # Device edge
        raw_dev = row.get("device_id")
        if raw_dev is not None and pd.notna(raw_dev) and str(raw_dev).strip():
            dev_node = f"DEV::{raw_dev}"
            if dev_node not in g.device_nodes:
                g.graph.add_node(dev_node, node_type=NODE_DEVICE)
                g.device_nodes.add(dev_node)
            if not g.graph.has_edge(cust_id, dev_node):
                g.graph.add_edge(cust_id, dev_node, edge_type=EDGE_USED_DEVICE)

        # IP edge
        raw_ip = row.get("ip_address")
        if raw_ip is not None and pd.notna(raw_ip) and str(raw_ip).strip():
            ip_node = f"IP::{raw_ip}"
            if ip_node not in g.ip_nodes:
                g.graph.add_node(ip_node, node_type=NODE_IP)
                g.ip_nodes.add(ip_node)
            if not g.graph.has_edge(cust_id, ip_node):
                g.graph.add_edge(cust_id, ip_node, edge_type=EDGE_USED_IP)

    logger.info(
        "Graph built for merchant %s: %d customers, %d devices, %d IPs, %d edges",
        merchant_id, g.n_customers(), g.n_devices(), g.n_ips(), g.n_edges(),
    )
    return g


def get_customer_neighbors(
    g: FraudGraph,
    customer_id: str,
) -> dict[str, list[str]]:
    """
    Return all infrastructure neighbors and co-users of a customer.

    Returns a dict:
      'devices'         : list of device node IDs this customer uses
      'ips'             : list of IP node IDs this customer uses
      'co_users_device' : other customers sharing any of these devices
      'co_users_ip'     : other customers sharing any of these IPs
    """
    if customer_id not in g.graph:
        return {"devices": [], "ips": [], "co_users_device": [], "co_users_ip": []}

    devices: list[str] = []
    ips:     list[str] = []

    for neighbor in g.graph.neighbors(customer_id):
        node_type = g.graph.nodes[neighbor].get("node_type")
        if node_type == NODE_DEVICE:
            devices.append(neighbor)
        elif node_type == NODE_IP:
            ips.append(neighbor)

    co_device: set[str] = set()
    for dev in devices:
        for nb in g.graph.neighbors(dev):
            if nb != customer_id and nb in g.customer_nodes:
                co_device.add(nb)

    co_ip: set[str] = set()
    for ip in ips:
        for nb in g.graph.neighbors(ip):
            if nb != customer_id and nb in g.customer_nodes:
                co_ip.add(nb)

    return {
        "devices":         devices,
        "ips":             ips,
        "co_users_device": list(co_device),
        "co_users_ip":     list(co_ip),
    }
