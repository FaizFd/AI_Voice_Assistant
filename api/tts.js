const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// Initialize GCP Text-to-Speech client
let ttsClient;
try {
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
      try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
      } catch (e2) {
        throw new Error('Invalid GOOGLE_CREDENTIALS format. Use JSON or base64-encoded JSON.');
      }
    }
    ttsClient = new TextToSpeechClient({ credentials });
  }
} catch (error) {
  console.error('Failed to initialize GCP client:', error.message);
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle TTS requests
  if (req.method === 'POST') {
    const gcpStartTime = Date.now();
    
    try {
      const { text, voice = 'en-US-Standard-A', language = 'en-US' } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      if (!ttsClient) {
        return res.status(500).json({ error: 'TTS service not available' });
      }

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
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Length', response.audioContent.length);

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
    return;
  }

  // Handle other requests
  res.status(405).json({ error: 'Method not allowed' });
}; 