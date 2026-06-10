import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignLogs, setCampaignLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Campaign Form Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [targetSegmentId, setTargetSegmentId] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AI Brainstorming states
  const [aiPrompt, setAiPrompt] = useState('');
  const [brainstorming, setBrainstorming] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);

  // AI Performance Review state
  const [campaignReview, setCampaignReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);

  const fetchData = async () => {
    try {
      const camps = await api.getCampaigns();
      const segs = await api.getSegments();
      setCampaigns(camps);
      setSegments(segs);
      setLoading(false);

      // Refresh details if a campaign is selected
      if (selectedCampaign) {
        const detail = await api.getCampaign(selectedCampaign.id);
        setSelectedCampaign(detail.campaign);
        setCampaignLogs(detail.logs);
      }
    } catch (err) {
      console.error('Failed to load campaigns data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll updates to campaign details and lists for real-time delivery visualizer
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedCampaign?.id]);

  const handleSelectCampaign = async (id) => {
    setCampaignReview(null);
    try {
      const res = await api.getCampaign(id);
      setSelectedCampaign(res.campaign);
      setCampaignLogs(res.logs);
    } catch (err) {
      console.error('Failed to fetch campaign details:', err);
    }
  };

  const handleAICampaignBrainstorm = async () => {
    if (!aiPrompt.trim() || !targetSegmentId) {
      alert('Please select a target segment and type a brainstorm prompt first.');
      return;
    }

    const selectedSeg = segments.find(s => s.id === parseInt(targetSegmentId));
    setBrainstorming(true);
    setAiDraft(null);

    try {
      const res = await api.draftCampaignAI({
        promptText: aiPrompt,
        segmentName: selectedSeg ? selectedSeg.name : 'Audience',
        customerCount: selectedSeg ? selectedSeg.customer_count : 0
      });
      setAiDraft(res);
    } catch (err) {
      console.error('AI Brainstorm failed:', err);
      alert('Error brainstorming campaign copy.');
    } finally {
      setBrainstorming(false);
    }
  };

  const handleApplyAIDraft = () => {
    if (!aiDraft) return;
    setChannel(aiDraft.recommendedChannel);
    setMessageTemplate(aiDraft.messageTemplate);
    // Add subject line placeholder if email
    if (aiDraft.recommendedChannel === 'email' && aiDraft.subjectLine) {
      setMessageTemplate(`Subject: ${aiDraft.subjectLine}\n\n${aiDraft.messageTemplate}`);
    }
  };

  const handleGetPerformanceReview = async () => {
    if (!selectedCampaign) return;
    setLoadingReview(true);
    setCampaignReview(null);
    try {
      const review = await api.getCampaignReview(selectedCampaign.id);
      setCampaignReview(review);
    } catch (err) {
      console.error('Error fetching campaign review:', err);
      alert('Failed to generate performance review.');
    } finally {
      setLoadingReview(false);
    }
  };

  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!campaignName || !targetSegmentId || !channel || !messageTemplate) return;

    setSubmitting(true);
    try {
      const res = await api.createCampaign({
        name: campaignName,
        segment_id: parseInt(targetSegmentId),
        channel,
        message_template: messageTemplate
      });

      // Clear states
      setIsDrawerOpen(false);
      setCampaignName('');
      setTargetSegmentId('');
      setChannel('whatsapp');
      setMessageTemplate('');
      setAiPrompt('');
      setAiDraft(null);

      // Load new campaign details
      handleSelectCampaign(res.campaignId);
    } catch (err) {
      console.error('Launch failed:', err);
      alert('Failed to launch campaign. Check segment count.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p>Deploy personalized campaigns and audit real-time conversions.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedCampaign && (
            <button className="btn" onClick={() => setSelectedCampaign(null)}>Back to Campaigns List</button>
          )}
          <button className="btn btn-primary" onClick={() => setIsDrawerOpen(true)}>+ Create Campaign</button>
        </div>
      </div>

      {!selectedCampaign ? (
        /* Campaigns Listing Tab */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Campaign Name</th>
                <th>Audience Segment</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Sent / Delivered</th>
                <th>Conversions</th>
                <th>Attributed ROI</th>
              </tr>
            </thead>
            <tbody>
              {loading && campaigns.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>Loading campaigns...</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No campaigns created yet. Click "+ Create Campaign" to launch your first sequence.</td></tr>
              ) : (
                campaigns.map((c) => {
                  const delRate = c.sent_count > 0 ? (c.delivered_count / c.sent_count) * 100 : 0;
                  const convRate = c.clicked_count > 0 ? (c.converted_count / c.clicked_count) * 100 : 0;
                  
                  return (
                    <tr key={c.id} onClick={() => handleSelectCampaign(c.id)} style={{ cursor: 'pointer' }}>
                      <td>#{c.id}</td>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.segment_name || 'Segment deleted'}</td>
                      <td><span className={`tag tag-${c.channel}`}>{c.channel}</span></td>
                      <td>
                        <span className={`tag ${c.status === 'completed' ? 'status-delivered' : 'status-sent'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div>{c.delivered_count} / {c.sent_count}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{delRate.toFixed(1)}% Delivery</div>
                      </td>
                      <td>
                        <div>{c.converted_count} orders</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.clicked_count} clicks</div>
                      </td>
                      <td><strong>${(c.revenue || 0).toFixed(2)}</strong></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Campaign Detail Analytics View */
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="card card-stat">
              <span className="label">Campaign Revenue</span>
              <span className="value" style={{ color: 'var(--color-converted)' }}>${(selectedCampaign.revenue || 0).toFixed(2)}</span>
              <span className="sub">{selectedCampaign.converted_count} attributed purchases</span>
            </div>
            <div className="card card-stat">
              <span className="label">Clicks / Open Ratio</span>
              <span className="value">{selectedCampaign.clicked_count} / {selectedCampaign.opened_count}</span>
              <span className="sub">
                CTR: {selectedCampaign.opened_count > 0 ? ((selectedCampaign.clicked_count / selectedCampaign.opened_count) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
            <div className="card card-stat">
              <span className="label">Delivery Success</span>
              <span className="value">{selectedCampaign.delivered_count} / {selectedCampaign.sent_count}</span>
              <span className="sub">
                Failed: {selectedCampaign.failed_count} messages
              </span>
            </div>
          </div>

          <div className="split-layout">
            <div className="split-left">
              <h2>Message Template</h2>
              <div className="action-box" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '24px', fontSize: '13px' }}>
                {selectedCampaign.message_template}
              </div>

              <h2>Delivery Transactions outbox ({campaignLogs.length})</h2>
              <div className="table-container">
                <table style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Shopper</th>
                      <th>Message Body</th>
                      <th>Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignLogs.map(log => (
                      <tr key={log.id}>
                        <td>{log.recipient}</td>
                        <td>{log.first_name} {log.last_name}</td>
                        <td style={{ maxWidth: '300px', fontSize: '12px' }}>{log.message_body}</td>
                        <td>
                          <span className={`tag status-${log.status}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Campaign Reviewer Column */}
            <div className="split-right">
              <h2>AI Performance Auditor</h2>
              <p style={{ marginBottom: '16px' }}>Evaluate conversions and generate recommendations using LLM analysis.</p>
              
              <button 
                className="btn btn-accent" 
                onClick={handleGetPerformanceReview}
                disabled={loadingReview || selectedCampaign.delivered_count === 0}
                style={{ width: '100%' }}
              >
                {loadingReview ? 'Analyzing Metrics...' : 'Analyze Campaign Performance'}
              </button>

              {campaignReview && (
                <div style={{ marginTop: '20px', animation: 'fadeIn 0.2s ease-out' }}>
                  <div className="card" style={{ border: '1px solid var(--border-dark)', backgroundColor: 'var(--bg-surface)' }}>
                    <h3 style={{ marginBottom: '12px', color: 'var(--text-main)' }}>Auditor Summary</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '16px', lineHeight: '1.4' }}>
                      {campaignReview.overallSummary}
                    </p>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-delivered)' }}>Campaign Strengths:</strong>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {campaignReview.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                      </ul>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-failed)' }}>Detected Weaknesses:</strong>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {campaignReview.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)}
                      </ul>
                    </div>

                    <div>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-color)' }}>AI Action Items:</strong>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {campaignReview.actionableSuggestions.map((s, idx) => <li key={idx} style={{ fontWeight: 500 }}>{s}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Launch Campaign Drawer */}
      {isDrawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className={`drawer ${isDrawerOpen ? 'open' : ''}`} style={{ width: '550px' }}>
            <div className="drawer-header">
              <h2>Launch Campaign</h2>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="drawer-body">
              <form onSubmit={handleLaunchCampaign}>
                <div className="form-group">
                  <label>Campaign Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={campaignName} 
                    onChange={(e) => setSegmentName(e.target.value)} // wait, setCampaignName is needed! Oh let me write it correctly
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="E.g., Coffee restock coupon"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Target Audience Segment</label>
                  <select 
                    className="form-control"
                    value={targetSegmentId}
                    onChange={(e) => setTargetSegmentId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Segment --</option>
                    {segments.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.customer_count} customers)</option>
                    ))}
                  </select>
                </div>

                {/* AI Brainstorm Widget */}
                {targetSegmentId && (
                  <div className="action-box" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>AI WRITER & RECOMMENDATION ENGINE</span>
                    </div>
                    <textarea 
                      className="form-control" 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="E.g. Write a restock coupon message offering 15% off coffee beans."
                      style={{ height: '60px', marginBottom: '8px', fontSize: '13px' }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-accent" 
                      onClick={handleAICampaignBrainstorm}
                      disabled={brainstorming || !aiPrompt.trim()}
                      style={{ width: '100%', height: '32px', fontSize: '13px' }}
                    >
                      {brainstorming ? 'Brainstorming Template...' : 'Brainstorm Template & Channel'}
                    </button>

                    {aiDraft && (
                      <div style={{ marginTop: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ fontSize: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                          <strong>Recommended Channel:</strong> <span className="tag">{aiDraft.recommendedChannel}</span>
                          <p style={{ fontStyle: 'italic', fontSize: '11px', margin: '4px 0 8px 0' }}>"{aiDraft.recommendationReason}"</p>
                        </div>
                        {aiDraft.subjectLine && (
                          <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                            <strong>Subject:</strong> {aiDraft.subjectLine}
                          </div>
                        )}
                        <pre style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface)', padding: '6px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                          {aiDraft.messageTemplate}
                        </pre>
                        <button 
                          type="button" 
                          className="btn" 
                          onClick={handleApplyAIDraft}
                          style={{ width: '100%', height: '30px', fontSize: '12px', marginTop: '6px' }}
                        >
                          Apply Draft & Channel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Channel</label>
                  <select 
                    className="form-control" 
                    value={channel} 
                    onChange={(e) => setChannel(e.target.value)}
                    required
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="rcs">RCS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Message template</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Available tags: <code>{"{{first_name}}"}</code>, <code>{"{{last_name}}"}</code>, <code>{"{{recent_purchase}}"}</code>
                  </p>
                  <textarea 
                    className="form-control" 
                    value={messageTemplate} 
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    placeholder="E.g. Hi {{first_name}}, check out our latest arrivals..."
                    style={{ height: '120px' }}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '12px' }}
                  disabled={submitting || !campaignName || !targetSegmentId || !messageTemplate}
                >
                  {submitting ? 'Launching...' : 'Launch Campaign'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
