// Simple test suite to verify the /bfhl processing logic
const assert = require('assert');

// Mock request and response objects
const createMockRes = (resolve, reject) => ({
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    this.body = data;
    if (this.statusCode && this.statusCode >= 400) {
      reject(new Error(`Status Code ${this.statusCode}: ${JSON.stringify(data)}`));
    } else {
      resolve(data);
    }
  }
});

// Import endpoint handler logic (extracted for testing)
function processData(data) {
  const invalid_entries = [];
  const duplicate_edges = [];
  const seen_edges = new Set();
  const valid_edges = [];

  for (const entry of data) {
    if (typeof entry !== 'string') {
      invalid_entries.push(String(entry));
      continue;
    }

    const trimmed = entry.trim();
    const match = trimmed.match(/^([A-Z])->([A-Z])$/);
    if (!match) {
      invalid_entries.push(trimmed);
      continue;
    }

    const parent = match[1];
    const child = match[2];

    if (parent === child) {
      invalid_entries.push(trimmed);
      continue;
    }

    if (seen_edges.has(trimmed)) {
      if (!duplicate_edges.includes(trimmed)) {
        duplicate_edges.push(trimmed);
      }
    } else {
      seen_edges.add(trimmed);
      valid_edges.push({ parent, child, raw: trimmed });
    }
  }

  const child_to_parent = {};
  const active_edges = [];
  const all_nodes_set = new Set();

  for (const edge of valid_edges) {
    const { parent, child } = edge;
    if (child_to_parent[child] !== undefined) {
      continue;
    }
    child_to_parent[child] = parent;
    active_edges.push(edge);
    all_nodes_set.add(parent);
    all_nodes_set.add(child);
  }

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

  for (const edge of active_edges) {
    if (!visited.has(edge.parent)) {
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

  const directed_adj = {};
  for (const node of all_nodes_set) {
    directed_adj[node] = [];
  }
  for (const edge of active_edges) {
    directed_adj[edge.parent].push(edge.child);
  }

  const hierarchies = [];
  let total_trees = 0;
  let total_cycles = 0;
  let max_depth = -1;
  let largest_tree_root = "";

  for (const component of components) {
    const componentSet = new Set(component);
    let comp_edges_count = 0;
    for (const edge of active_edges) {
      if (componentSet.has(edge.parent)) {
        comp_edges_count++;
      }
    }

    const N = component.length;
    const M = comp_edges_count;

    const buildTreeObj = (node) => {
      const children = directed_adj[node] || [];
      const sortedChildren = [...children].sort();
      const tree = {};
      for (const child of sortedChildren) {
        tree[child] = buildTreeObj(child);
      }
      return tree;
    };

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

    if (M === N - 1) {
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

      if (depth > max_depth) {
        max_depth = depth;
        largest_tree_root = root;
      } else if (depth === max_depth) {
        if (root < largest_tree_root) {
          largest_tree_root = root;
        }
      }
    } else {
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

  return {
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees,
      total_cycles,
      largest_tree_root: total_trees > 0 ? largest_tree_root : ""
    }
  };
}

// RUN TESTS
try {
  console.log("Running Chitkara Challenge Test Suite...");

  // Test 1: Example from PDF
  const testInput1 = [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ];

  const result1 = processData(testInput1);

  // Validate invalid entries
  console.log("Validating Invalid Entries...");
  assert.deepStrictEqual(result1.invalid_entries, ["hello", "1->2", "A->"]);

  // Validate duplicate edges
  console.log("Validating Duplicate Edges...");
  assert.deepStrictEqual(result1.duplicate_edges, ["G->H"]);

  // Validate summary counts
  console.log("Validating Summary Counts...");
  assert.strictEqual(result1.summary.total_trees, 3);
  assert.strictEqual(result1.summary.total_cycles, 1);
  assert.strictEqual(result1.summary.largest_tree_root, "A");

  // Validate Tree A depth
  console.log("Validating Depth of tree A...");
  const treeA = result1.hierarchies.find(h => h.root === "A");
  assert.ok(treeA);
  assert.strictEqual(treeA.depth, 4);
  assert.deepStrictEqual(treeA.tree, {
    "A": {
      "B": { "D": {} },
      "C": { "E": { "F": {} } }
    }
  });

  // Validate Cycle X
  console.log("Validating Cycle X...");
  const cycleX = result1.hierarchies.find(h => h.root === "X");
  assert.ok(cycleX);
  assert.strictEqual(cycleX.has_cycle, true);
  assert.deepStrictEqual(cycleX.tree, {});
  assert.strictEqual(cycleX.depth, undefined);

  // Test 2: Diamond / Multi-parent Case
  console.log("Testing Diamond Case (Multi-parent resolution)...");
  const testInput2 = ["A->B", "C->B"]; // B has two parents: A (first) and C (second)
  const result2 = processData(testInput2);
  // B's parent should be A, and C->B should be discarded.
  // Component A: A->B (N=2, M=1). Component C: just node C?
  // Wait, if C->B is discarded, C has no edges. So C is not in any active edges!
  // Thus node C is not in all_nodes_set and does not form a component.
  // The only active edge is A->B.
  assert.strictEqual(result2.hierarchies.length, 1);
  assert.strictEqual(result2.hierarchies[0].root, "A");
  assert.deepStrictEqual(result2.hierarchies[0].tree, { "A": { "B": {} } });

  console.log("\nALL TESTS PASSED SUCCESSFULLY! ✅");
} catch (err) {
  console.error("\nTEST SUITE FAILED ❌");
  console.error(err);
  process.exit(1);
}
