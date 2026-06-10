import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Shoppers from './components/Shoppers';
import Campaigns from './components/Campaigns';
import AICopilot from './components/AICopilot';
import XenoLogo from './assets/XenoLogo.jpeg';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'shoppers':
        return <Shoppers />;
      case 'campaigns':
        return (
          <Campaigns 
            selectedCampaignId={selectedCampaignId} 
            onSelectCampaign={setSelectedCampaignId} 
          />
        );
      case 'copilot':
        return (
          <AICopilot 
            onViewChange={setCurrentView} 
            onSelectCampaign={setSelectedCampaignId} 
          />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="brand">
          <img src={XenoLogo} alt="Xeno Logo" style={{ height: '26px', width: 'auto', borderRadius: '4px' }} />
          <span>Xeno CRM</span>
        </div>
        
        <ul className="nav-links">
          <li className="nav-item">
            <button 
              className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-button ${currentView === 'shoppers' ? 'active' : ''}`}
              onClick={() => setCurrentView('shoppers')}
            >
              Shoppers
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-button ${currentView === 'campaigns' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('campaigns');
                setSelectedCampaignId(null); // Clear selected details on tab click
              }}
            >
              Campaigns
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-button ${currentView === 'copilot' ? 'active' : ''}`}
              onClick={() => setCurrentView('copilot')}
            >
              AI Copilot
            </button>
          </li>
        </ul>

        <div className="nav-footer">
          <div>OS: macOS</div>
          <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>AI-Native Mini CRM v1.0</div>
        </div>
      </nav>

      {/* Main Panel Viewport */}
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}
