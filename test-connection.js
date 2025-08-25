// Simple test script to verify server connectivity
// Run this in your mobile app console to test

const testServerConnection = async () => {
  const serverUrl = 'http://10.160.204.181:5000';
  
  try {
    console.log(`🔍 Testing connection to: ${serverUrl}`);
    
    // Test basic connectivity
    const response = await fetch(`${serverUrl}/`);
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Server connection successful:', data);
    } else {
      console.log('❌ Server responded with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('💡 Make sure:');
    console.log('   1. Server is running (npm start in server folder)');
    console.log('   2. IP address is correct');
    console.log('   3. Firewall allows port 5000');
    console.log('   4. Both devices are on same network');
  }
};

// Test database status
const testDatabaseStatus = async () => {
  const serverUrl = 'http://10.160.204.181:5000';
  
  try {
    console.log('🔍 Testing database status...');
    const response = await fetch(`${serverUrl}/db/status`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Database status:', data);
    } else {
      console.log('❌ Database status failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
};

// Export for use in console
if (typeof global !== 'undefined') {
  global.testServerConnection = testServerConnection;
  global.testDatabaseStatus = testDatabaseStatus;
}

export { testServerConnection, testDatabaseStatus };
