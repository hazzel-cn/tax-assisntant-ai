// Settings page functionality
function initializeExtension() {
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const togglePasswordBtn = document.querySelector('.toggle-password');
  const testKeyBtn = document.getElementById('test-key');
  const saveBtn = document.getElementById('save-settings');
  const statusMessage = document.getElementById('status-message');

  // Load saved settings
  chrome.storage.local.get(['openai_api_key', 'openai_model'], (result) => {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
    if (result.openai_model) {
      modelSelect.value = result.openai_model;
    }
  });

  // Toggle password visibility
  togglePasswordBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    
    // Update eye icon
    const svg = togglePasswordBtn.querySelector('svg');
    if (type === 'text') {
      svg.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    } else {
      svg.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    }
  });

  // Test API key
  testKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter an API key first', 'error');
      return;
    }

    testKeyBtn.disabled = true;
    showStatus('Testing API key...', 'info');

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        showStatus('API key is valid!', 'success');
      } else {
        const error = await response.json();
        throw new Error(error.error?.message || 'Invalid API key');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      testKeyBtn.disabled = false;
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    saveBtn.disabled = true;
    showStatus('Saving settings...', 'info');

    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set(
          { 
            openai_api_key: apiKey,
            openai_model: model
          }, 
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });

      showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      showStatus(`Error saving settings: ${error.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.add('show');

    if (type === 'success') {
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, 3000);
    }
  }
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 