const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

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
  } else {
    console.log('❌ No GOOGLE_CREDENTIALS environment variable found');
  }
} catch (error) {
  console.error('❌ Failed to initialize GCP client:', error.message);
}

module.exports = async (req, res) => {
  console.log('🎤 TTS function called');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling preflight request');
    res.status(200).end();
    return;
  }

  // Handle TTS requests
  if (req.method === 'POST') {
    console.log('🎤 TTS request received');
    const gcpStartTime = Date.now();
    
    try {
      const { text, voice = 'en-US-Standard-A', language = 'en-US' } = req.body;
      console.log('📝 Request data:', { text, voice, language });

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

      console.log('📤 Sending request to GCP:', request);

      // Perform the text-to-speech request
      const [response] = await ttsClient.synthesizeSpeech(request);
      
      const gcpEndTime = Date.now();
      console.log(`✅ GCP TTS completed in ${gcpEndTime - gcpStartTime}ms`);
      console.log(`📊 Audio size: ${response.audioContent.length} bytes`);
      
      // Set headers for audio response (Vercel serverless function way)
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Length', response.audioContent.length);

      console.log('📤 Sending audio response');
      // Send the audio content
      res.send(response.audioContent);

    } catch (error) {
      const gcpEndTime = Date.now();
      console.log(`❌ GCP TTS failed after ${gcpEndTime - gcpStartTime}ms`);
      console.error('TTS Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'Text-to-speech failed',
        details: error.message,
        code: error.code
      });
    }
    return;
  }

  // Handle other requests
  console.log('❌ Method not allowed:', req.method);
  res.status(405).json({ error: 'Method not allowed' });
}; 