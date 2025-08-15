# Vercel Deployment with GCP TTS

## Prerequisites
1. GCP project with Text-to-Speech API enabled
2. Service account with Text-to-Speech permissions
3. Vercel account

## Setup Steps

### 1. Get GCP Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "IAM & Admin" > "Service Accounts"
3. Create or select your service account
4. Create a new key (JSON format)
5. Download the JSON file

### 2. Set Environment Variables in Vercel
1. Go to your Vercel project dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add the following variable:
   - **Name**: `GOOGLE_CREDENTIALS`
   - **Value**: Copy the entire content of your downloaded JSON file
   - **Environment**: Production (and Preview if needed)

### 3. Deploy to Vercel
```bash
# Build the app
npm run build

# Deploy to Vercel
vercel --prod
```

### 4. Verify Deployment
1. Check your Vercel deployment URL
2. Test the health endpoint: `https://your-app.vercel.app/api/health`
3. Should return: `{"status":"ok","gcpClient":true,"hasCredentials":true}`

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CREDENTIALS` | Full JSON content of GCP service account key | Yes |
| `REACT_APP_AZURE_SPEECH_KEY` | Azure Speech Service key | Yes |
| `REACT_APP_AZURE_SPEECH_REGION` | Azure Speech Service region | Yes |
| `REACT_APP_OPENROUTER_API_KEY` | OpenRouter API key | Yes |

## Troubleshooting

### GCP Client Not Initialized
- Check if `GOOGLE_CREDENTIALS` environment variable is set
- Verify the JSON content is valid
- Ensure the service account has Text-to-Speech permissions

### API Errors
- Check Vercel function logs
- Verify all environment variables are set
- Test the health endpoint

### Local vs Production
- Local: Uses `gcp-credentials.json` file
- Production: Uses `GOOGLE_CREDENTIALS` environment variable

## Security Notes
- Never commit `gcp-credentials.json` to version control
- Use environment variables for all sensitive data
- Regularly rotate your GCP service account keys 