const express = require('express');
const cors = require('cors');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from build directory
app.use(express.static(path.join(__dirname, 'build')));

// Initialize GCP Text-to-Speech client
let ttsClient;
try {
  // Check if we have environment variable credentials
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials;
    try {
      // Try to parse as JSON first
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      console.log('✅ Parsed GOOGLE_CREDENTIALS as JSON');
    } catch (e) {
      // If JSON parsing fails, try base64 decoding
      try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
        console.log('✅ Parsed GOOGLE_CREDENTIALS as base64-decoded JSON');
      } catch (e2) {
        console.error('❌ Failed to parse GOOGLE_CREDENTIALS:', e2.message);
        throw new Error('Invalid GOOGLE_CREDENTIALS format. Use JSON or base64-encoded JSON.');
      }
    }
    ttsClient = new TextToSpeechClient({ credentials });
    console.log('✅ GCP client initialized with environment credentials');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use credentials file path (for local development)
    ttsClient = new TextToSpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    console.log('✅ GCP client initialized with credentials file');
  } else {
    // Try local file as fallback
    ttsClient = new TextToSpeechClient({
      keyFilename: './gcp-credentials.json'
    });
    console.log('✅ GCP client initialized with local file');
  }
} catch (error) {
  console.error('❌ Failed to initialize GCP client:', error.message);
  console.log('📝 Make sure to set GOOGLE_CREDENTIALS environment variable or have gcp-credentials.json in the project root');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ 
    status: 'ok', 
    gcpClient: !!ttsClient,
    hasCredentials: !!(process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// TTS endpoint
app.post('/api/tts', async (req, res) => {
  console.log('🎤 TTS request received');
  const gcpStartTime = Date.now();
  
  try {
    const { text, voice = 'en-US-Standard-A', language = 'en-US' } = req.body;

    if (!text) {
      console.log('❌ No text provided');
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!ttsClient) {
      console.log('❌ GCP client not initialized');
      return res.status(500).json({ error: 'TTS service not available' });
    }

    console.log(`🔊 Synthesizing speech with voice: ${voice}`);

    // Configure the request
    const request = {
      input: { text },
      voice: { languageCode: language, name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    };

    // Perform the text-to-speech request
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    const gcpEndTime = Date.now();
    console.log(`✅ GCP TTS completed in ${gcpEndTime - gcpStartTime}ms`);
    
    // Set headers for audio response
    res.set({
      'Content-Type': 'audio/mp3',
      'Content-Length': response.audioContent.length,
    });

    // Send the audio content
    res.send(response.audioContent);

  } catch (error) {
    const gcpEndTime = Date.now();
    console.log(`❌ GCP TTS failed after ${gcpEndTime - gcpStartTime}ms`);
    console.error('TTS Error:', error.message);
    res.status(500).json({ 
      error: 'Text-to-speech failed',
      details: error.message 
    });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  console.log(`📄 Serving React app for: ${req.path}`);
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📡 TTS endpoint: http://localhost:${PORT}/api/tts`);
}); 