module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle health check
  if (req.method === 'GET') {
    const hasCredentials = !!process.env.GOOGLE_CREDENTIALS;
    
    res.json({ 
      status: 'ok', 
      gcpClient: hasCredentials,
      hasCredentials: hasCredentials,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    });
    return;
  }

  // Handle other methods
  res.status(405).json({ error: 'Method not allowed' });
}; 