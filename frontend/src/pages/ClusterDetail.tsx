/**
 * ClusterDetail.tsx
 *
 * This route (/clusters/:id) now redirects to the Network Intelligence
 * workspace (/clusters) and highlights the target cluster.
 *
 * The full investigation experience lives in Clusters.tsx — a split-pane
 * workspace where the graph, evidence panel, and table work together.
 * A separate detail route creates a context-free dead-end; the workspace
 * keeps all the information in one place.
 *
 * If the cluster ID is present we navigate with state so Clusters.tsx can
 * pre-select the correct row and graph on mount.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to the workspace, passing the cluster ID as location state
    // so Clusters.tsx can select it on mount.
    navigate('/clusters', { replace: true, state: { selectClusterId: id } });
  }, [id, navigate]);

  return null;
}
