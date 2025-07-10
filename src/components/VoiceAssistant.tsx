import React, { useState, useRef } from 'react';
import faqSystemPrompt from '../faqContext';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

const VoiceAssistant: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef<string>(''); // store full recognized transcript

  const startRecording = () => {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      process.env.REACT_APP_AZURE_SPEECH_KEY!,
      process.env.REACT_APP_AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = 'en-US';

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    setTranscript('');
    setAiResponse('');
    fullTranscriptRef.current = '';
    setIsRecording(true);

    recognizer.recognizing = (_s, e) => {
      console.log('Interim:', e.result.text);
    };

    recognizer.recognized = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        fullTranscriptRef.current += ' ' + e.result.text;
      }
    };

    recognizer.startContinuousRecognitionAsync();

    timeoutRef.current = setTimeout(() => stopRecording(), 30000); // stop after 30s
  };

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(() => {
        recognizerRef.current?.close();
        recognizerRef.current = null;
        setIsRecording(false);

        const finalTranscript = fullTranscriptRef.current.trim();
        setTranscript(finalTranscript);

        if (finalTranscript) {
          setIsThinking(true);
          fetchDeepSeekResponse(finalTranscript);
        }
      });
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const fetchDeepSeekResponse = async (text: string) => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
        model: 'deepseek/deepseek-r1-distill-llama-70b:free',
        messages: [
            {
            role: 'system',
            content: faqSystemPrompt,
            },
            {
            role: 'user',
            content: text,
            },
        ],
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I had trouble answering that.';
      setAiResponse(reply);
      setIsThinking(false);
      speakWithAzure(reply);
    } catch (err) {
      console.error('DeepSeek API error:', err);
      setIsThinking(false);
      setAiResponse('Sorry, something went wrong.');
    }
  };

  const speakWithAzure = (text: string) => {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      process.env.REACT_APP_AZURE_SPEECH_KEY!,
      process.env.REACT_APP_AZURE_SPEECH_REGION!
    );
    speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.speakTextAsync(
      text,
      result => {
        synthesizer.close();
        if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.error('Speech synthesis failed:', result.errorDetails);
        }
      },
      error => {
        console.error('Speech synthesis error:', error);
        synthesizer.close();
      }
    );
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>🎤 AI Voice Assistant</h2>

      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Speaking' : 'Start Speaking'}
      </button>

      <div style={{ marginTop: '20px' }}>
        <p><strong>🗣️ You said:</strong> {transcript || '—'}</p>
        <p>
          <strong>🤖 AI says:</strong>{' '}
          {isThinking ? '🧠 Thinking...' : aiResponse || '—'}
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
