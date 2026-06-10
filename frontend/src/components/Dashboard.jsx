import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalCampaigns: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalConverted: 0,
    totalRevenue: 0.0
  });

  const [simStatus, setSimStatus] = useState({
    config: { simulateRateLimits: false, simulateServerErrors: false, simulationSpeed: 1.0 },
    outbox: [],
    callbacks: { pending: 0, failed: 0, total: 0 }
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Poll stats, simulator configuration, and logs
  const fetchData = async () => {
    try {
      // 1. Fetch campaigns to compute totals
      const campaigns = await api.getCampaigns();
      const customers = await api.getCustomers(1, 1);
      
      let totalSent = 0;
      let totalDelivered = 0;
      let totalFailed = 0;
      let totalOpened = 0;
      let totalClicked = 0;
      let totalConverted = 0;
      let totalRevenue = 0;

      campaigns.forEach(c => {
        totalSent += c.sent_count || 0;
        totalDelivered += c.delivered_count || 0;
        totalFailed += c.failed_count || 0;
        totalOpened += c.opened_count || 0;
        totalClicked += c.clicked_count || 0;
        totalConverted += c.converted_count || 0;
        totalRevenue += c.revenue || 0.0;
      });

      setStats({
        totalCustomers: customers.total || 0,
        totalCampaigns: campaigns.length,
        totalSent,
        totalDelivered,
        totalFailed,
        totalOpened,
        totalClicked,
        totalConverted,
        totalRevenue
      });

      // 2. Fetch Simulator status
      const sim = await api.getSimulatorStatus();
      setSimStatus(sim);

      // 3. Fetch recent communications logs
      const recentLogs = await api.getRecentCommunications();
      setLogs(recentLogs);

      setLoading(false);
    } catch (error) {
      console.error('Error polling dashboard stats:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500); // Poll every 1.5 seconds for instant real-time feel
    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = async (key, value) => {
    try {
      const updatedConfig = { ...simStatus.config, [key]: value };
      const res = await api.updateSimulatorConfig(updatedConfig);
      if (res.success) {
        setSimStatus(prev => ({ ...prev, config: res.config }));
      }
    } catch (err) {
      console.error('Failed to update simulator config:', err);
    }
  };

  const handleResetSimulator = async () => {
    if (confirm('Are you sure you want to clear the Simulator queues? This will clear all pending callbacks and simulations.')) {
      try {
        await api.resetSimulator();
        fetchData();
      } catch (err) {
        console.error('Failed to reset simulator:', err);
      }
    }
  };

  // Funnel Rate Calculations
  const deliveryRate = stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0;
  const readRate = stats.totalDelivered > 0 ? (stats.totalOpened / stats.totalDelivered) * 100 : 0;
  const clickRate = stats.totalOpened > 0 ? (stats.totalClicked / stats.totalOpened) * 100 : 0;
  const conversionRate = stats.totalClicked > 0 ? (stats.totalConverted / stats.totalClicked) * 100 : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time campaign delivery, attribution, and simulator controls.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-danger" onClick={handleResetSimulator}>Reset Simulator</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid-3">
        <div className="card card-stat">
          <span className="label">Total Attributed Revenue</span>
          <span className="value">${stats.totalRevenue.toFixed(2)}</span>
          <span className="sub">From {stats.totalConverted} shopper conversions</span>
        </div>
        <div className="card card-stat">
          <span className="label">Total Campaign Sent</span>
          <span className="value">{stats.totalSent}</span>
          <span className="sub">Across {stats.totalCampaigns} active campaigns</span>
        </div>
        <span className="card card-stat">
          <span className="label">Active Shoppers Base</span>
          <span className="value">{stats.totalCustomers}</span>
          <span className="sub">Imported purchase history records</span>
        </span>
      </div>

      {/* Funnel Conversions */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          Campaign Delivery & Engagement Funnel
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px', textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{deliveryRate.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Delivery Rate</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.totalDelivered} of {stats.totalSent}</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{readRate.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Read/Open Rate</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.totalOpened} read</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{clickRate.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Click-Through (CTR)</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.totalClicked} clicks</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-converted)' }}>{conversionRate.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Conversion Rate</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.totalConverted} orders placed</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Simulator Panel */}
        <div className="card">
          <h2>Simulator Configurations</h2>
          <p style={{ marginBottom: '16px' }}>Simulate real-world channel anomalies to audit retries and system design.</p>
          
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Simulation Processing Speed</span>
              <span style={{ fontWeight: 'bold' }}>{simStatus.config.simulationSpeed}x</span>
            </label>
            <input 
              type="range" 
              min="0.5" 
              max="5.0" 
              step="0.5" 
              value={simStatus.config.simulationSpeed}
              onChange={(e) => handleConfigChange('simulationSpeed', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--text-main)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>0.5x (Slow)</span>
              <span>1.0x (Normal)</span>
              <span>5.0x (Fast)</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={simStatus.config.simulateServerErrors} 
                onChange={(e) => handleConfigChange('simulateServerErrors', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--text-main)' }}
              />
              <div>
                <strong>Inject CRM Server Errors (HTTP 500)</strong>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Forces CRM callback API to fail, driving simulator callback queue retries.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={simStatus.config.simulateRateLimits} 
                onChange={(e) => handleConfigChange('simulateRateLimits', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--text-main)' }}
              />
              <div>
                <strong>Inject CRM Rate Limits (HTTP 429)</strong>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Forces CRM callback API to throttling state, driving simulator exponential backoffs.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="card">
          <h2>Simulator Queue Monitors</h2>
          <p style={{ marginBottom: '16px' }}>Asynchronous payload tracking in simulator engine database.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span>Queued/Sending In Simulator Outbox</span>
              <span style={{ fontWeight: 600 }}>
                {simStatus.outbox.find(o => o.status === 'queued')?.count || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span>Pending callbacks queue (in-flight)</span>
              <span style={{ fontWeight: 600, color: simStatus.callbacks.pending > 0 ? 'var(--accent-color)' : 'inherit' }}>
                {simStatus.callbacks.pending}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span>Dead-letter callbacks (failed after 5 retries)</span>
              <span style={{ fontWeight: 600, color: simStatus.callbacks.failed > 0 ? 'var(--color-failed)' : 'inherit' }}>
                {simStatus.callbacks.failed}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span>Total Simulator Transactions Logged</span>
              <span style={{ fontWeight: 600 }}>{simStatus.callbacks.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity Stream Terminal */}
      <div className="logger-panel" style={{ marginTop: '16px' }}>
        <h3>
          <span>Real-time Communication Activity Stream</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="dot"></span>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8' }}>LIVE ATTACHED</span>
          </span>
        </h3>
        {logs.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '32px' }}>
            No delivery callbacks or messages sent yet. Launch a campaign to see the simulation loop run!
          </div>
        ) : (
          logs.map((log) => {
            const time = new Date(log.updated_at).toLocaleTimeString();
            return (
              <div key={log.id} className="log-item">
                <span className="log-time">[{time}]</span>
                <span className={`log-body ${log.status}`}>
                  {log.campaign_name || 'Campaign'} &gt; {(log.channel || '').toUpperCase()} {(log.status || '').toUpperCase()} for {log.first_name} {log.last_name} ({log.recipient})
                  {log.status === 'converted' && ` (Attributed Purchase: $${(log.message_body || '').match(/TREAT(\d+)/) ? ((log.message_body || '').match(/TREAT(\d+)/)[1] === '15' ? '18.99' : '49.99') : '24.99'})`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
