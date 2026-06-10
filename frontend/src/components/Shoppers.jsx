import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Shoppers() {
  const [customers, setCustomers] = useState([]);
  const [segments, setSegments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Drawer & Segment builder states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');
  const [nlPrompt, setNlPrompt] = useState('');
  const [analyzingPrompt, setAnalyzingPrompt] = useState(false);
  
  // Segment Rules Preview states
  const [generatedRules, setGeneratedRules] = useState(null);
  const [previewCustomers, setPreviewCustomers] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'segments'

  const fetchCustomers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.getCustomers(p, 50);
      setCustomers(res.customers);
      setTotal(res.total);
      setPage(res.page);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const fetchSegments = async () => {
    try {
      const res = await api.getSegments();
      setSegments(res);
    } catch (err) {
      console.error('Failed to fetch segments:', err);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
    fetchSegments();
  }, []);

  const handleAnalyzePrompt = async () => {
    if (!nlPrompt.trim()) return;
    setAnalyzingPrompt(true);
    try {
      const res = await api.analyzeSegmentPrompt(nlPrompt);
      setGeneratedRules(res.rules);
      setMatchCount(res.match_count);
      setPreviewCustomers(res.preview);
    } catch (err) {
      console.error('Failed to analyze prompt:', err);
      alert('Failed to analyze the prompt. Make sure the backend is running.');
    } finally {
      setAnalyzingPrompt(false);
    }
  };

  const handleSaveSegment = async (e) => {
    e.preventDefault();
    if (!segmentName || !generatedRules) return;

    try {
      await api.createSegment({
        name: segmentName,
        description: segmentDescription || nlPrompt,
        rules: generatedRules
      });
      
      // Reset & refresh
      setIsDrawerOpen(false);
      setSegmentName('');
      setSegmentDescription('');
      setNlPrompt('');
      setGeneratedRules(null);
      setPreviewCustomers([]);
      setMatchCount(0);
      
      fetchSegments();
      setActiveTab('segments');
    } catch (err) {
      console.error('Failed to save segment:', err);
      alert('Error saving segment.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Shoppers & Segments</h1>
          <p>Explore your shopper base and slice target audiences.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setIsDrawerOpen(true)}>
            + Create Segment (AI)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button 
          className={`nav-button ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
          style={{ width: 'auto', borderRight: 'none', borderLeft: 'none' }}
        >
          Customers ({total})
        </button>
        <button 
          className={`nav-button ${activeTab === 'segments' ? 'active' : ''}`}
          onClick={() => setActiveTab('segments')}
          style={{ width: 'auto', borderRight: 'none', borderLeft: 'none' }}
        >
          Saved Audiences ({segments.length})
        </button>
      </div>

      {activeTab === 'customers' ? (
        /* Customers Tab */
        <div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Contact Info</th>
                  <th>Order Count</th>
                  <th>Total Spent</th>
                  <th>Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Loading shoppers...</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No customers found.</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td>#{c.id}</td>
                      <td><strong>{c.first_name} {c.last_name}</strong></td>
                      <td>
                        <div style={{ fontSize: '13px' }}>{c.email}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.phone}</div>
                      </td>
                      <td>{c.order_count || 0}</td>
                      <td><strong>${(c.total_spend || 0).toFixed(2)}</strong></td>
                      <td>{c.last_purchase ? new Date(c.last_purchase).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination */}
          <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn" 
              disabled={page <= 1 || loading} 
              onClick={() => fetchCustomers(page - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {page}</span>
            <button 
              className="btn" 
              disabled={customers.length < 50 || loading} 
              onClick={() => fetchCustomers(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        /* Segments Tab */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Target Size</th>
                <th>Filters / Rules</th>
              </tr>
            </thead>
            <tbody>
              {segments.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No segments created yet. Click "+ Create Segment" to build one using AI.</td></tr>
              ) : (
                segments.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td><strong>{s.name}</strong></td>
                    <td style={{ maxWidth: '250px' }}>{s.description}</td>
                    <td>
                      <span className="tag" style={{ border: '1px solid var(--text-main)', color: 'var(--text-main)' }}>
                        {s.customer_count} customers
                      </span>
                    </td>
                    <td>
                      <pre style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface)', padding: '6px', border: '1px solid var(--border-color)', overflow: 'auto', maxWidth: '350px' }}>
                        {JSON.stringify(s.rules, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Segment Builder Drawer */}
      {isDrawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>
            <div className="drawer-header">
              <h2>Build Audience Segment</h2>
              <button 
                onClick={() => setIsDrawerOpen(false)} 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <div className="drawer-body">
              <div className="form-group">
                <label>Define Audience in Plain Text</label>
                <textarea 
                  className="form-control" 
                  value={nlPrompt} 
                  onChange={(e) => setNlPrompt(e.target.value)}
                  placeholder="E.g., Shoppers who spent over $150 and haven't ordered in the last 45 days, excluding coffee grinders."
                  style={{ height: '80px', marginBottom: '8px' }}
                />
                <button 
                  className="btn btn-accent" 
                  onClick={handleAnalyzePrompt} 
                  disabled={analyzingPrompt || !nlPrompt.trim()}
                  style={{ width: '100%' }}
                >
                  {analyzingPrompt ? 'Analyzing Segment with AI...' : 'Analyze with AI Engine'}
                </button>
              </div>

              {generatedRules && (
                <form onSubmit={handleSaveSegment} style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  <div className="action-box" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>AI PARSED FILTERS:</span>
                      <strong style={{ color: 'var(--accent-color)' }}>{matchCount} Matches</strong>
                    </div>
                    <pre style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface)', padding: '8px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
                      {JSON.stringify(generatedRules, null, 2)}
                    </pre>
                  </div>

                  {previewCustomers.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Preview:</label>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '8px', fontSize: '12px', backgroundColor: 'var(--bg-surface)' }}>
                        {previewCustomers.map(pc => (
                          <div key={pc.id} style={{ padding: '2px 0', borderBottom: '1px solid #eee' }}>
                            #{pc.id} - {pc.first_name} {pc.last_name} (${(pc.total_spend || 0).toFixed(2)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Segment Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={segmentName} 
                      onChange={(e) => setSegmentName(e.target.value)}
                      placeholder="E.g., High-Value Churn Risk"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Description (Optional)</label>
                    <textarea 
                      className="form-control" 
                      value={segmentDescription} 
                      onChange={(e) => setSegmentDescription(e.target.value)}
                      placeholder="Provide segment context..."
                      style={{ height: '60px' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '8px' }}
                    disabled={!segmentName.trim()}
                  >
                    Save Segment to Database
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
