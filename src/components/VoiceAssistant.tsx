import React, { useState, useRef, useEffect } from 'react';
import faqSystemPrompt from '../faqContext';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

const VoiceAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'gcp' | 'browser' | 'error'>('idle');
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef<string>(''); // store full recognized transcript
  const lastSpeechTimeRef = useRef<number>(0);
  const isManualStopRef = useRef<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; thinking?: boolean };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stop any currently playing audio
  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    // Also stop browser speech synthesis if it's running
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    setTtsStatus('idle');
  };

  // Clear all timeouts
  const clearAllTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  const startRecording = () => {
    // Stop any currently playing audio when starting to record
    stopCurrentAudio();
    
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      process.env.REACT_APP_AZURE_SPEECH_KEY!,
      process.env.REACT_APP_AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = 'en-US';

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    // Reset state
    fullTranscriptRef.current = '';
    lastSpeechTimeRef.current = Date.now();
    isManualStopRef.current = false;
    setIsRecording(true);

    // Handle interim results
    recognizer.recognizing = (_s, e) => {
      if (e.result.text.trim()) {
        lastSpeechTimeRef.current = Date.now();
        // Reset silence timeout when speech is detected
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        // Set new silence timeout (2 seconds of silence to auto-stop)
        silenceTimeoutRef.current = setTimeout(() => {
          if (!isManualStopRef.current) {
            console.log('🤐 Auto-stopping due to silence...');
            stopRecording();
          }
        }, 2000);
      }
    };

    // Handle final results
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const newText = e.result.text.trim();
        if (newText) {
          fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + newText;
          lastSpeechTimeRef.current = Date.now();
        }
      }
    };

    // Handle session end
    recognizer.sessionStopped = (_s, e) => {
      console.log('Session stopped:', e);
    };

    // Handle errors
    recognizer.canceled = (_s, e) => {
      console.log('Recognition canceled:', e);
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        console.error('Recognition error:', e.errorDetails);
      }
    };

    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log('🎤 Continuous recognition started');
        // Set a maximum recording time (30 seconds) as backup
        timeoutRef.current = setTimeout(() => {
          if (!isManualStopRef.current) {
            console.log('⏰ Auto-stopping due to max time...');
            stopRecording();
          }
        }, 30000);
      },
      (error) => {
        console.error('Failed to start recognition:', error);
        setIsRecording(false);
      }
    );
  };

  const stopRecording = () => {
    isManualStopRef.current = true;
    clearAllTimeouts();
    
    const sttStartTime = performance.now();
    console.log('⏱️ Starting STT processing...');
    
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(() => {
        recognizerRef.current?.close();
        recognizerRef.current = null;
        setIsRecording(false);

        const finalTranscript = fullTranscriptRef.current.trim();
        const sttEndTime = performance.now();
        console.log(`✅ STT completed in ${(sttEndTime - sttStartTime).toFixed(2)}ms`);

        if (finalTranscript) {
          // Add user message
          const userMessage: ChatMessage = { id: generateId(), role: 'user', content: finalTranscript };
          // Add assistant thinking placeholder
          const thinkingId = generateId();
          const thinkingMessage: ChatMessage = { id: thinkingId, role: 'assistant', content: '🧠 Thinking...', thinking: true };
          setMessages(prev => [...prev, userMessage, thinkingMessage]);

          setIsThinking(true);

          // Build history for API (omit thinking placeholders)
          const historyForApi = [...messages, userMessage]
            .filter(m => !m.thinking)
            .map(m => ({ role: m.role, content: m.content }));

          fetchDeepSeekResponse(finalTranscript, thinkingId, historyForApi);
        }
      });
    }
  };

  const fetchDeepSeekResponse = async (
    text: string,
    placeholderId: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => {
    const aiStartTime = performance.now();
    console.log('⏱️ Starting AI processing...');
    
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
            ...history,
        ],
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I had trouble answering that.';
      const aiEndTime = performance.now();
      console.log(`✅ AI processing completed in ${(aiEndTime - aiStartTime).toFixed(2)}ms`);
      
      setIsThinking(false);

      // Replace the thinking placeholder with the real assistant response
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: reply, thinking: false } : m));

      speakWithGCP(reply);
    } catch (err) {
      const aiEndTime = performance.now();
      console.log(`❌ AI processing failed after ${(aiEndTime - aiStartTime).toFixed(2)}ms`);
      setIsThinking(false);
      const fallback = 'Sorry, something went wrong.';
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: fallback, thinking: false } : m));
    }
  };

  const speakWithGCP = async (text: string) => {
    const ttsStartTime = performance.now();
    console.log('⏱️ Starting TTS processing...');
    setTtsStatus('idle');
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'en-US-Standard-B',
          language: 'en-US'
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
      }

      const ttsEndTime = performance.now();
      console.log(`✅ TTS processing completed in ${(ttsEndTime - ttsStartTime).toFixed(2)}ms`);
      setTtsStatus('gcp');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        setTtsStatus('idle');
      };
      
      audio.play().catch(() => {
        setTtsStatus('error');
      });

    } catch (error) {
      const ttsEndTime = performance.now();
      console.log(`❌ TTS processing failed after ${(ttsEndTime - ttsStartTime).toFixed(2)}ms`);
      setTtsStatus('browser');
      
      // Fallback to browser's built-in speech synthesis
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang === 'en-US') || null;
        
        utterance.onend = () => {
          setTtsStatus('idle');
        };
        
        speechSynthesis.speak(utterance);
      } else {
        setTtsStatus('error');
      }
    }
  };

  const getTtsStatusText = () => {
    switch (ttsStatus) {
      case 'gcp': return '🔊 GCP TTS';
      case 'browser': return '🔊 Browser TTS';
      case 'error': return '❌ TTS Error';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="chat-container">
        <div className="messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message-row ${msg.role === 'user' ? 'right' : 'left'}`}>
              <div className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="controls">
        <div className="chat-input-container">
          <button 
            className={`mic-button ${isRecording ? 'stop' : 'start'}`} 
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'Stop recording (or wait for auto-stop)' : 'Start recording (interrupts AI speech)'}
          >
            {isRecording ? '🔴' : '🎤'}
          </button>
        </div>
        {isRecording && (
          <div className="status-text">
            Listening... (auto-stops after 2s silence)
          </div>
        )}
        {isThinking && (
          <div className="status-text">
            🧠 Thinking...
          </div>
        )}
        {ttsStatus !== 'idle' && (
          <div className="status-text">
            {getTtsStatusText()}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
