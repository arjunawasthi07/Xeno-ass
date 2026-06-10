import React, { useState } from 'react';
import { api } from '../utils/api';

export default function AICopilot({ onViewChange, onSelectCampaign }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: "Hello! I am your Xeno CRM Copilot. Describe the audience segment you'd like to reach, what message you want to draft, or the goal of your campaign (e.g., 'Draft a WhatsApp promotion for shoppers who spent over $100 and bought organic coffee beans'). I will recommend the channel, draft the personalized message, and prepare the segment for you!"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deployingAction, setDeployingAction] = useState(null);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue;
    setInputValue('');
    
    const userMsgObj = {
      id: Date.now(),
      sender: 'user',
      text: userMessage
    };

    setMessages(prev => [...prev, userMsgObj]);
    setLoading(true);

    try {
      // Format history for Gemini
      const chatHistory = messages.map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const response = await api.copilotChat(userMessage, chatHistory);
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'assistant',
        text: response.reply,
        action: response.action
      }]);
    } catch (err) {
      console.error('Copilot chat error:', err);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'assistant',
        text: "I encountered an error connecting to the CRM AI Engine. Please check that the server is running."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCopilotAction = async (action, msgId) => {
    setDeployingAction(msgId);
    try {
      // 1. Create the segment
      const segment = await api.createSegment({
        name: action.segmentName,
        description: `Generated conversationally via Xeno Copilot: "${action.segmentRules.purchasedItems || 'Audience query'}"`,
        rules: action.segmentRules
      });

      // 2. Launch the campaign
      const campaign = await api.createCampaign({
        name: `${action.segmentName} Campaign`,
        segment_id: segment.id,
        channel: action.channel,
        message_template: action.messageTemplate
      });

      alert(`Campaign "${action.segmentName} Campaign" launched successfully to ${campaign.sent_count} customers! Redirecting to campaign manager...`);
      
      // 3. Navigate to campaign analytics
      onSelectCampaign(campaign.campaignId);
      onViewChange('campaigns');

    } catch (err) {
      console.error('Failed to execute Copilot campaign:', err);
      alert('Error launching agentic campaign. Make sure there are customers matching the segment.');
    } finally {
      setDeployingAction(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Xeno AI Copilot</h1>
          <p>Talk with Xeno Copilot to brainstorm segments, write templates, and deploy campaigns conversationally.</p>
        </div>
      </div>

      <div className="copilot-container">
        <div className="copilot-messages">
          {messages.map((m) => (
            <div key={m.id} className={`copilot-message ${m.sender}`}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.7 }}>
                {m.sender === 'user' ? 'Marketer' : 'Xeno Copilot'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{m.text}</div>
              
              {/* Agentic Action Card */}
              {m.action && m.action.type === 'create_campaign' && (
                <div className="action-box" style={{ marginTop: '12px', color: 'var(--text-main)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>SUGGESTED CAMPAIGN DETAILS</span>
                    <span className={`tag tag-${m.action.channel}`}>{m.action.channel}</span>
                  </div>
                  <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                    <strong>Target Segment:</strong> {m.action.segmentName}
                  </div>
                  <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                    <strong>Filters:</strong> 
                    <code style={{ display: 'block', backgroundColor: 'var(--bg-surface)', padding: '4px', fontSize: '11px', overflowX: 'auto', border: '1px solid var(--border-color)', marginTop: '2px' }}>
                      {JSON.stringify(m.action.segmentRules)}
                    </code>
                  </div>
                  <div style={{ fontSize: '12px', marginBottom: '12px' }}>
                    <strong>Message Draft:</strong>
                    <div style={{ fontStyle: 'italic', backgroundColor: 'var(--bg-surface)', padding: '6px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', fontSize: '11px', marginTop: '2px' }}>
                      {m.action.messageTemplate}
                    </div>
                  </div>
                  <button 
                    className="btn btn-accent" 
                    onClick={() => handleExecuteCopilotAction(m.action, m.id)}
                    disabled={deployingAction !== null}
                    style={{ width: '100%' }}
                  >
                    {deployingAction === m.id ? 'Deploying Campaign...' : 'Deploy Suggested Campaign In One-Click'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="copilot-message assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Copilot is thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="copilot-input-area">
          <input 
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="E.g. Brainstorm a discount WhatsApp campaign for VIP coffee lovers" 
            disabled={loading}
          />
          <button type="submit" disabled={loading || !inputValue.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
