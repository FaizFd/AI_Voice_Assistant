const express = require('express');
const cors = require('cors');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Initialize GCP Text-to-Speech client
let ttsClient;
try {
  ttsClient = new TextToSpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-credentials.json'
  });
} catch (error) {
  console.error('Failed to initialize GCP client:', error.message);
}

// TTS endpoint
app.post('/api/tts', async (req, res) => {
  const gcpStartTime = Date.now();
  console.log('⏱️ Starting GCP TTS processing...');
  
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
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 