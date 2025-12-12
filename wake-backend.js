// Simple script to wake up the backend
async function wakeUpBackend() {
    console.log('🔄 Waking up backend...');
    
    try {
        const response = await fetch('https://mama-africa1.vercel.app/api/health');
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend is awake!', data);
            return true;
        } else {
            console.log('⚠️ Backend responded with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Failed to wake backend:', error.message);
        return false;
    }
}

// Wake up backend and retry every 10 seconds for 2 minutes
async function keepTrying() {
    let attempts = 0;
    const maxAttempts = 12; // 2 minutes
    
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts}/${maxAttempts}`);
        
        const success = await wakeUpBackend();
        if (success) {
            console.log('🎉 Backend is ready!');
            break;
        }
        
        if (attempts < maxAttempts) {
            console.log('⏳ Waiting 10 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

// Run the wake-up process
keepTrying();
