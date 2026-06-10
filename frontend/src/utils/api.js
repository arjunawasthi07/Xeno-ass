const CRM_BASE_URL = 'http://localhost:3000/api';
const SIM_BASE_URL = 'http://localhost:3001/api';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // CRM Endpoints
  getCustomers: (page = 1, limit = 50) => 
    request(`${CRM_BASE_URL}/customers?page=${page}&limit=${limit}`),
    
  getSegments: () => 
    request(`${CRM_BASE_URL}/segments`),
    
  createSegment: (segmentData) => 
    request(`${CRM_BASE_URL}/segments`, {
      method: 'POST',
      body: JSON.stringify(segmentData)
    }),
    
  analyzeSegmentPrompt: (promptText) => 
    request(`${CRM_BASE_URL}/segments/analyze-prompt`, {
      method: 'POST',
      body: JSON.stringify({ promptText })
    }),
    
  previewSegment: (rules) => 
    request(`${CRM_BASE_URL}/segments/preview`, {
      method: 'POST',
      body: JSON.stringify({ rules })
    }),
    
  getCampaigns: () => 
    request(`${CRM_BASE_URL}/campaigns`),
    
  getCampaign: (id) => 
    request(`${CRM_BASE_URL}/campaigns/${id}`),
    
  createCampaign: (campaignData) => 
    request(`${CRM_BASE_URL}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(campaignData)
    }),
    
  getCampaignReview: (id) => 
    request(`${CRM_BASE_URL}/campaigns/${id}/review`),
    
  getRecentCommunications: () =>
    request(`${CRM_BASE_URL}/communications/recent`),
    
  draftCampaignAI: (draftData) => 
    request(`${CRM_BASE_URL}/ai/draft-campaign`, {
      method: 'POST',
      body: JSON.stringify(draftData)
    }),
    
  copilotChat: (message, history) =>
    request(`${CRM_BASE_URL}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history })
    }),

  // Simulator Endpoints
  getSimulatorStatus: () => 
    request(`${SIM_BASE_URL}/simulator/status`),
    
  updateSimulatorConfig: (config) => 
    request(`${SIM_BASE_URL}/simulator/config`, {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    
  resetSimulator: () => 
    request(`${SIM_BASE_URL}/simulator/reset`, { method: 'POST' })
};
