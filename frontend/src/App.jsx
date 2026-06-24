import React, { useState } from 'react';

// Recursive Tree Node Component
function TreeNode({ nodeName, nodeData }) {
  const childKeys = Object.keys(nodeData || {});
  return (
    <div className="tree-node">
      <span className="tree-node-label">
        <span style={{ color: 'var(--accent-cyan)', marginRight: '2px' }}>•</span>
        {nodeName}
      </span>
      {childKeys.length > 0 && (
        <div style={{ marginTop: '0.25rem' }}>
          {childKeys.map(child => (
            <TreeNode key={child} nodeName={child} nodeData={nodeData[child]} />
          ))}
        </div>
      )}
    </div>
  );
}

// Tree Viewer Component
function TreeViewer({ treeData }) {
  const rootKeys = Object.keys(treeData || {});
  if (rootKeys.length === 0) {
    return <span className="tree-leaf-empty">{}</span>;
  }
  return (
    <div className="tree-container">
      {rootKeys.map(rootKey => (
        <TreeNode key={rootKey} nodeName={rootKey} nodeData={treeData[rootKey]} />
      ))}
    </div>
  );
}

export default function App() {
  const defaultInput = `[
  "A->B", "A->C", "B->D", "C->E", "E->F",
  "X->Y", "Y->Z", "Z->X",
  "P->Q", "Q->R",
  "G->H", "G->H", "G->I",
  "hello", "1->2", "A->"
]`;

  const [inputData, setInputData] = useState(defaultInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);

  // Hardcoded API URL using Vite environment variable with local fallback
  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/$/, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);

    let parsedData = [];
    const trimmedInput = inputData.trim();

    try {
      if (trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
        parsedData = JSON.parse(trimmedInput);
      } else {
        // Fallback parsing: comma or newline separated values
        parsedData = trimmedInput
          .split(/[\n,]+/)
          .map(s => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
    } catch (err) {
      setError('Failed to parse input. Ensure it is a valid JSON array of node relation strings.');
      setLoading(false);
      return;
    }

    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      setError('Input must be a non-empty array of node relation strings.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/bfhl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: parsedData }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(`API Connection Error: ${err.message}. Make sure the backend server is running and CORS is enabled.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Chitkara Hierarchy Visualizer</h1>
        <p>Analyze, deduplicate, and visualize node hierarchies with instant cycle detection and tree building.</p>
      </header>

      <div className="dashboard-grid">
        {/* Left Column: Form Input */}
        <div className="panel">
          <h2 className="panel-title">
            <span>⚙️</span> Input Configuration
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Node Relations List</label>
              <textarea
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                className="textarea-input"
                placeholder='["A->B", "B->C"]'
                style={{ minHeight: '260px' }}
                required
              />
              <div className="input-info">
                <span>Supports JSON Array or CSV formats</span>
                <span>{"X->Y (A-Z)"}</span>
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span>🚀</span> Run Analysis
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Insights & Results */}
        <div className="panel">
          <h2 className="panel-title">
            <span>📊</span> Analysis Insights
          </h2>

          {error && (
            <div className="error-banner">
              <span>⚠️</span> {error}
            </div>
          )}

          {!response && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">📥</div>
              <h3>Awaiting Analysis</h3>
              <p>Provide relation inputs on the left and click "Run Analysis" to view results.</p>
            </div>
          )}

          {response && (
            <div>
              {/* Summary Metrics */}
              <div className="summary-grid">
                <div className="summary-card highlight">
                  <div className="summary-value">{response.summary?.total_trees || 0}</div>
                  <div className="summary-label">Valid Trees</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value" style={{ color: response.summary?.total_cycles > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
                    {response.summary?.total_cycles || 0}
                  </div>
                  <div className="summary-label">Cycles</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value" style={{ fontSize: '1.4rem', lineHeight: '1.8rem', height: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {response.summary?.largest_tree_root || 'N/A'}
                  </div>
                  <div className="summary-label">Largest Root</div>
                </div>
              </div>

              {/* Duplicate Tags */}
              <div className="badge-section">
                <div className="badge-section-title">Duplicate Edges (Deduplicated)</div>
                <div className="badges-container">
                  {response.duplicate_edges?.length > 0 ? (
                    response.duplicate_edges.map((edge, idx) => (
                      <span key={idx} className="badge duplicate">{edge}</span>
                    ))
                  ) : (
                    <span className="badge empty">None detected</span>
                  )}
                </div>
              </div>

              {/* Invalid Tags */}
              <div className="badge-section" style={{ marginBottom: '2.5rem' }}>
                <div className="badge-section-title">Invalid Entries (Discarded)</div>
                <div className="badges-container">
                  {response.invalid_entries?.length > 0 ? (
                    response.invalid_entries.map((entry, idx) => (
                      <span key={idx} className="badge invalid">{entry}</span>
                    ))
                  ) : (
                    <span className="badge empty">None detected</span>
                  )}
                </div>
              </div>

              {/* Hierarchies list */}
              <h3 className="panel-title" style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
                📂 Structural Hierarchies ({response.hierarchies?.length || 0})
              </h3>

              <div className="hierarchy-list">
                {response.hierarchies?.length > 0 ? (
                  response.hierarchies.map((item, idx) => (
                    <div key={idx} className="hierarchy-item">
                      <div className="hierarchy-item-header">
                        <div className="root-badge">
                          <span className="root-label">Root Node:</span>
                          <span className="root-node-val">{item.root}</span>
                        </div>
                        <div className="item-meta">
                          {item.has_cycle ? (
                            <span className="meta-pill cycle">🚨 Cycle Group</span>
                          ) : (
                            <span className="meta-pill depth">Depth: {item.depth}</span>
                          )}
                        </div>
                      </div>
                      
                      {item.has_cycle ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                          A cyclic relationship was detected. Tree representation empty.
                        </div>
                      ) : (
                        <TreeViewer treeData={item.tree} />
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                    No hierarchies built from the input edges.
                  </div>
                )}
              </div>

              {/* Credentials Footer */}
              <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid var(--bg-surface-border)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>User ID: <strong>{response.user_id}</strong></span>
                <span>Email: <strong>{response.email_id}</strong></span>
                <span>Roll No: <strong>{response.college_roll_number}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
