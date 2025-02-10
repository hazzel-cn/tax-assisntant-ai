// Initialize storage when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated. Reason:', details.reason);
  await initializeStorage();
});

// Also initialize storage when extension starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up');
  await initializeStorage();
});

// Centralized storage initialization function
async function initializeStorage() {
  console.log('Initializing storage...');
  
  // Wait for Chrome APIs to be fully loaded
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Verify Chrome API is available
    if (typeof chrome === 'undefined') {
      throw new Error('Chrome API not available');
    }

    // Verify storage API is available
    if (!chrome.storage || !chrome.storage.local) {
      throw new Error('Storage API not available');
    }

    // Set storage access level if available
    if (chrome.storage.session) {
      try {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
        console.log('Storage access level set successfully');
      } catch (error) {
        console.warn('Failed to set storage access level:', error);
        // Continue anyway as this is not critical
      }
    }

    // Initialize storage with default values
    await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, async (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to read storage: ${chrome.runtime.lastError.message}`));
          return;
        }

        // Set default values only if they don't exist
        const updates = {};
        if (!result.chat_history) updates.chat_history = [];
        if (!result.openai_api_key) updates.openai_api_key = '';
        if (!result.lastPendingResponse) updates.lastPendingResponse = null;

        if (Object.keys(updates).length > 0) {
          try {
            await chrome.storage.local.set(updates);
            console.log('Storage initialized with defaults');
          } catch (error) {
            reject(new Error(`Failed to set storage defaults: ${error.message}`));
            return;
          }
        }
        resolve();
      });
    });

    console.log('Storage initialization completed successfully');
  } catch (error) {
    console.error('Storage initialization failed:', error);
    // Notify any open extension pages about the error
    try {
      chrome.runtime.sendMessage({
        action: 'storageInitError',
        error: error.message
      });
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearHistory') {
    handleClearHistory(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'checkStorage') {
    checkStorageAvailability(sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Handle clear history request
async function handleClearHistory(sendResponse) {
  try {
    if (!chrome?.storage?.local) {
      throw new Error('Storage API not available');
    }

    await new Promise((resolve, reject) => {
      chrome.storage.local.remove(['chat_history', 'lastPendingResponse'], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ chat_history: [] }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check storage availability
async function checkStorageAvailability(sendResponse) {
  try {
    if (!chrome?.storage?.local) {
      throw new Error('Storage API not available');
    }

    // Test storage with a simple operation
    await new Promise((resolve, reject) => {
      chrome.storage.local.get('test', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

    sendResponse({ available: true });
  } catch (error) {
    console.error('Storage availability check failed:', error);
    sendResponse({ available: false, error: error.message });
  }
} 