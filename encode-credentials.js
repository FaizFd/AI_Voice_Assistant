const fs = require('fs');

// Read the GCP credentials file
try {
  const credentials = fs.readFileSync('./gcp-credentials.json', 'utf8');
  
  // Encode to base64
  const base64Credentials = Buffer.from(credentials).toString('base64');
  
  console.log('🔐 Base64-encoded GCP credentials:');
  console.log('=====================================');
  console.log(base64Credentials);
  console.log('=====================================');
  console.log('\n📋 Copy the above text and paste it in Vercel as GOOGLE_CREDENTIALS');
  console.log('\n💡 Or use this command:');
  console.log(`vercel env add GOOGLE_CREDENTIALS production`);
  console.log('Then paste the base64 string when prompted.');
  
} catch (error) {
  console.error('❌ Error reading gcp-credentials.json:', error.message);
  console.log('📝 Make sure gcp-credentials.json exists in the project root');
} 