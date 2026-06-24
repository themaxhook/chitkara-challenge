const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main /bfhl post endpoint
app.post('/bfhl', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: "Invalid input format. 'data' must be an array of node strings."
      });
    }

    const invalid_entries = [];
    const duplicate_edges = [];
    const seen_edges = new Set();
    const valid_edges = [];

    // 1. Validation and deduplication
    for (const entry of data) {
      if (typeof entry !== 'string') {
        invalid_entries.push(String(entry));
        continue;
      }

      const trimmed = entry.trim();
      
      // Regex check: single uppercase letter -> single uppercase letter
      const match = trimmed.match(/^([A-Z])->([A-Z])$/);
      if (!match) {
        invalid_entries.push(trimmed);
        continue;
      }

      const parent = match[1];
      const child = match[2];

      // Self-loop is treated as invalid
      if (parent === child) {
        invalid_entries.push(trimmed);
        continue;
      }

      // Check for duplicates
      if (seen_edges.has(trimmed)) {
        if (!duplicate_edges.includes(trimmed)) {
          duplicate_edges.push(trimmed);
        }
      } else {
        seen_edges.add(trimmed);
        valid_edges.push({ parent, child, raw: trimmed });
      }
    }

    // 2. Diamond / Multi-parent case resolution
    // "the first-encountered parent edge wins; subsequent parent edges for that child are silently discarded"
    const child_to_parent = {};
    const active_edges = [];
    const all_nodes_set = new Set();

    for (const edge of valid_edges) {
      const { parent, child } = edge;
      if (child_to_parent[child] !== undefined) {
        // Discard subsequent parent edges for this child
        continue;
      }
      child_to_parent[child] = parent;
      active_edges.push(edge);
      all_nodes_set.add(parent);
      all_nodes_set.add(child);
    }

    // 3. Find weakly connected components (groups)
    // Build undirected adjacency list for components grouping
    const undirected_adj = {};
    for (const node of all_nodes_set) {
      undirected_adj[node] = [];
    }
    for (const edge of active_edges) {
      undirected_adj[edge.parent].push(edge.child);
      undirected_adj[edge.child].push(edge.parent);
    }

    const visited = new Set();
    const components = [];

    // Traverse active edges in their original order to maintain component order
    for (const edge of active_edges) {
      if (!visited.has(edge.parent)) {
        // Find all nodes in this component via BFS
        const component_nodes = [];
        const queue = [edge.parent];
        visited.add(edge.parent);

        while (queue.length > 0) {
          const curr = queue.shift();
          component_nodes.push(curr);

          for (const neighbor of undirected_adj[curr]) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        components.push(component_nodes);
      }
    }

    // 4. Build directed adjacency list for tree construction
    const directed_adj = {};
    for (const node of all_nodes_set) {
      directed_adj[node] = [];
    }
    for (const edge of active_edges) {
      directed_adj[edge.parent].push(edge.child);
    }

    // Process components to build hierarchies
    const hierarchies = [];
    let total_trees = 0;
    let total_cycles = 0;
    let max_depth = -1;
    let largest_tree_root = "";

    for (const component of components) {
      const componentSet = new Set(component);
      
      // Count edges in this component
      let comp_edges_count = 0;
      for (const edge of active_edges) {
        if (componentSet.has(edge.parent)) {
          comp_edges_count++;
        }
      }

      const N = component.length;
      const M = comp_edges_count;

      // Helper function to recursively build tree representation
      const buildTreeObj = (node) => {
        const children = directed_adj[node] || [];
        // Sort children lexicographically
        const sortedChildren = [...children].sort();
        const tree = {};
        for (const child of sortedChildren) {
          tree[child] = buildTreeObj(child);
        }
        return tree;
      };

      // Helper to calculate depth
      const calculateDepth = (node) => {
        const children = directed_adj[node] || [];
        if (children.length === 0) {
          return 1;
        }
        let max_child_depth = 0;
        for (const child of children) {
          max_child_depth = Math.max(max_child_depth, calculateDepth(child));
        }
        return 1 + max_child_depth;
      };

      // Check if it's a tree (M = N - 1) or cycle (M = N)
      if (M === N - 1) {
        // Find root (node with in-degree 0 in this component)
        let root = "";
        for (const node of component) {
          if (child_to_parent[node] === undefined) {
            root = node;
            break;
          }
        }

        const depth = calculateDepth(root);
        const treeObj = {};
        treeObj[root] = buildTreeObj(root);

        hierarchies.push({
          root,
          tree: treeObj,
          depth
        });

        total_trees++;

        // Track largest tree
        if (depth > max_depth) {
          max_depth = depth;
          largest_tree_root = root;
        } else if (depth === max_depth) {
          // Tiebreaker: lexicographically smaller root
          if (root < largest_tree_root) {
            largest_tree_root = root;
          }
        }
      } else {
        // Cyclic group (M = N)
        // Root is the lexicographically smallest node in the component
        const sortedComponent = [...component].sort();
        const root = sortedComponent[0];

        hierarchies.push({
          root,
          tree: {},
          has_cycle: true
        });

        total_cycles++;
      }
    }

    // Response structure matching user challenge specification
    const responsePayload = {
      user_id: "antigravity_24062026",
      email_id: "antigravity.assistant@gmail.com",
      college_roll_number: "ANTIGRAVITY001",
      hierarchies,
      invalid_entries,
      duplicate_edges,
      summary: {
        total_trees,
        total_cycles,
        largest_tree_root: total_trees > 0 ? largest_tree_root : ""
      }
    };

    res.json(responsePayload);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while processing node hierarchy."
    });
  }
});

// Basic GET route for server status/health check
app.get('/health', (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
