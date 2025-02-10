// Constants
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const PII_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  phone: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  zipCode: /\b\d{5}(?:-\d{4})?\b/
};

// Global DOM Elements
let userInput;
let sendBtn;
let readPageBtn;
let clearHistoryBtn;
let chatHistory;

// Check if storage is available and properly initialized
async function checkStorageAvailability(retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      // First check if Chrome API exists
      if (typeof chrome === 'undefined') {
        throw new Error('Chrome API not available');
      }

      // Check if storage API exists
      if (!chrome.storage || !chrome.storage.local) {
        console.warn(`Storage API not found on attempt ${i + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Try a test operation
      const testResult = await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set({ 'test_key': 'test_value' }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              chrome.storage.local.get('test_key', (result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else if (result.test_key === 'test_value') {
                  resolve(true);
                } else {
                  reject(new Error('Storage test failed: value mismatch'));
                }
              });
            }
          });
        } catch (e) {
          reject(e);
        }
      });

      if (testResult) {
        console.log('Storage check successful on attempt', i + 1);
        return true;
      }
    } catch (error) {
      console.warn(`Storage check failed attempt ${i + 1}:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Initialize Extension
async function initializeExtension() {
  console.log('Starting extension initialization...');
  
  try {
    // Add a small delay before checking storage
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for storage to be available with increased retries and delay
    const storageAvailable = await checkStorageAvailability(5, 1000);
    if (!storageAvailable) {
      throw new Error('Storage API not available after multiple attempts. Please try: 1) Reload the extension, 2) Clear browser cache, 3) Restart browser');
    }

    // Initialize DOM elements
    userInput = document.getElementById('user-input');
    sendBtn = document.getElementById('send-message');
    readPageBtn = document.getElementById('read-page');
    clearHistoryBtn = document.getElementById('clear-history');
    chatHistory = document.getElementById('chat-history');

    if (!chatHistory) {
      throw new Error('Required DOM elements not found');
    }

    // Load chat history with retry mechanism
    let retries = 3;
    let history = [];
    while (retries > 0) {
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get(['chat_history'], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
        history = result.chat_history || [];
        break;
      } catch (error) {
        console.warn(`Failed to load chat history, attempt ${4 - retries}:`, error);
        retries--;
        if (retries === 0) {
          throw new Error('Failed to load chat history after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Clear existing messages
    chatHistory.innerHTML = '';
    
    if (history.length > 0) {
      history.forEach(item => {
        appendMessage(item.message, item.type, false);
      });
    } else {
      appendMessage('Hello! I\'m your Tax Assistant AI. How can I help you with your tax questions today?', 'ai', false);
    }

    // Add event listeners
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }
    
    if (readPageBtn) {
      readPageBtn.addEventListener('click', handleReadPage);
    }
    
    if (userInput) {
      userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
      });
    }
    
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearChatHistory);
    }

    // Initialize settings button
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      settingsButton.addEventListener('click', async () => {
        console.log('Settings button clicked');
        try {
          // First try using chrome.runtime.openOptionsPage
          if (chrome.runtime.openOptionsPage) {
            await new Promise((resolve, reject) => {
              try {
                chrome.runtime.openOptionsPage(() => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve();
                  }
                });
              } catch (e) {
                reject(e);
              }
            });
          } else {
            // Fallback to manual URL opening
            const settingsUrl = chrome.runtime.getURL('settings.html');
            console.log('Opening settings URL:', settingsUrl);
            const windowOptions = {
              url: settingsUrl,
              type: 'popup',
              width: 600,
              height: 400,
              focused: true
            };
            
            await new Promise((resolve, reject) => {
              try {
                chrome.windows.create(windowOptions, (window) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(window);
                  }
                });
              } catch (e) {
                reject(e);
              }
            });
          }
        } catch (error) {
          console.error('Error opening settings:', error);
          // Final fallback - try direct window.open
          const settingsUrl = chrome.runtime.getURL('settings.html');
          const settingsWindow = window.open(settingsUrl, '_blank');
          if (!settingsWindow) {
            appendMessage('Failed to open settings. Please check if pop-ups are blocked.', 'error');
          }
        }
      });
    } else {
      console.error('Settings button not found in the DOM');
      appendMessage('Settings button not found. Please reload the extension.', 'error');
    }

    console.log('Extension initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Extension initialization failed:', error);
    const errorMessage = `Extension initialization failed: ${error.message}`;
    if (chatHistory) {
      appendMessage(errorMessage, 'error');
    } else {
      alert(errorMessage);
    }
    throw error;
  }
}

// Modified initialization sequence with increased retries and delays
document.addEventListener('DOMContentLoaded', () => {
  // Hide content immediately and show loading animation
  const container = document.querySelector('.container');
  if (container) {
    container.style.visibility = 'hidden';
    container.style.opacity = '0';
  }
  showLoadingAnimation();

  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 2000;

  function attemptInitialization() {
    console.log(`Attempting initialization (attempt ${retryCount + 1}/${maxRetries})`);
    initializeExtension()
      .then(() => {
        // Only show content after successful initialization
        hideLoadingAnimation();
        if (container) {
          container.style.visibility = 'visible';
          container.style.transition = 'opacity 0.3s ease-in';
          container.style.opacity = '1';
        }
      })
      .catch(error => {
        console.error(`Initialization attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms...`);
          setTimeout(attemptInitialization, retryDelay);
        } else {
          console.error('All initialization attempts failed');
          hideLoadingAnimation();
          if (container) {
            container.style.visibility = 'visible';
            container.style.opacity = '1';
          }
          alert('Failed to initialize extension. Please try:\n1. Reload the extension\n2. Clear browser cache\n3. Restart browser');
        }
      });
  }

  // Start initialization immediately
  attemptInitialization();
});

// Clear chat history function
async function clearChatHistory() {
  try {
    // Send clear request to background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, (response) => {
        resolve(response || { success: false, error: 'No response from background script' });
      });
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to clear storage');
    }
    
    // Clear the chat history div
    if (!chatHistory) {
      chatHistory = document.getElementById('chat-history');
    }
    
    if (chatHistory) {
      // Clear message queue
      messageQueue.length = 0;
      isProcessingQueue = false;
      
      // Remove all messages
      chatHistory.innerHTML = '';
      // Add welcome message back
      appendMessage('Chat history cleared. How can I help you?', 'ai', false);
      
      // Verify storage is cleared
      const verifyCleared = await loadChatHistory();
      if (verifyCleared.length > 0) {
        throw new Error('Failed to verify storage clearance');
      }
    } else {
      throw new Error('Chat history element not found');
    }
  } catch (error) {
    console.error('Error clearing chat history:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    // Get chat history element again if it's not available
    const chatHistoryElement = chatHistory || document.getElementById('chat-history');
    if (chatHistoryElement) {
      appendMessage(`Error clearing chat history: ${errorMessage}. Please try again.`, 'error');
    }
  }
}

// Message Handling
async function handleSendMessage() {
  const input = document.getElementById('user-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  appendMessage(message, 'user');

  // Check for PII
  if (containsPII(message)) {
    appendMessage('I noticed potential personal information in your message. For your privacy and security, please avoid sharing sensitive data like SSNs, phone numbers, or exact income figures.', 'ai');
    return;
  }

  try {
    updateStatus('Processing your message...');
    
    // Check if chrome.storage is available
    if (!chrome?.storage?.local) {
      throw new Error('Storage API not available. Please check extension permissions.');
    }
    
    // Get API key from storage with error handling
    let apiKey;
    try {
      const result = await chrome.storage.local.get('openai_api_key');
      apiKey = result.openai_api_key;
    } catch (storageError) {
      console.error('Storage error:', storageError);
      throw new Error('Failed to access storage. Please reload the extension.');
    }
    
    if (!apiKey) {
      appendMessage('Please set your OpenAI API key in the extension settings. Click the ⚙️ Settings button above to open settings.', 'error');
      return;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful tax assistant AI. Your task is to:
1. Analyze user questions about taxes and tax-related topics
2. Provide clear, accurate information about tax concepts
3. Guide users through tax-related processes step by step
4. Explain complex tax terms in simple language
5. Help identify relevant tax forms and requirements`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    // Remove the processing message
    removePendingMessages();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your settings.');
      }
      throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from AI service');
    }

    appendMessage(data.choices[0].message.content, 'ai');
  } catch (error) {
    console.error('Error processing message:', error);
    updateStatus(null);
    appendMessage(`Error: ${error.message}`, 'error');
  }
}

// Remove pending message indicators
function removePendingMessages() {
  updateStatus(null);
}

// UI Helpers
function appendMessage(message, type, saveToHistory = true) {
  const chatHistory = document.getElementById('chat-history');
  
  // If this is a system message, update or remove existing system messages
  if (type === 'system') {
    const systemMessages = document.querySelectorAll('.message.system-message');
    systemMessages.forEach(msg => msg.remove());
  }
  
  // Check for duplicate welcome message
  if (type === 'ai' && message.includes('Hello! I\'m your Tax Assistant AI')) {
    const messages = chatHistory.getElementsByClassName('ai-message');
    for (const msg of messages) {
      if (msg.textContent.includes('Hello! I\'m your Tax Assistant AI')) {
        return; // Skip duplicate welcome message
      }
    }
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}-message`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Format the message based on type
  if (type === 'user') {
    contentDiv.textContent = `You: ${message}`;
  } else if (type === 'error') {
    contentDiv.textContent = message;
  } else if (type === 'system') {
    contentDiv.textContent = message;
  } else {
    // Handle AI messages with proper formatting
    const prefix = 'AI: ';
    const formattedMessage = message
      .split('\n')
      .map((line, index) => {
        // Skip empty lines
        if (!line.trim()) return '';
        
        // Handle numbered lists
        if (/^\d+\.\s/.test(line)) {
          return `<div class="list-item">${line}</div>`;
        }
        
        // Handle bullet points
        if (/^[-•]\s/.test(line)) {
          return `<div class="list-item">${line}</div>`;
        }
        
        // Regular paragraph
        return `<div class="paragraph">${index === 0 ? prefix + line : line}</div>`;
      })
      .filter(line => line) // Remove empty lines
      .join('');

    contentDiv.innerHTML = formattedMessage;
  }
  
  messageDiv.appendChild(contentDiv);
  
  const timestamp = new Date();
  const timeDiv = document.createElement('div');
  timeDiv.className = 'timestamp';
  timeDiv.textContent = timestamp.toLocaleTimeString();
  messageDiv.appendChild(timeDiv);
  
  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  // Only save non-system messages to history if saveToHistory is true
  if (saveToHistory && type !== 'system') {
    saveChatHistory(message, type);
  }
}

// PII Detection
function containsPII(text) {
  return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
}

// Chat history management
async function saveChatHistory(message, type) {
  const key = 'chat_history';
  const MAX_HISTORY_LENGTH = 100;
  const BATCH_SIZE = 10;
  
  try {
    if (!chrome?.storage?.local) {
      throw new Error('Chrome storage is not available');
    }

    // Get existing history
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    let history = result[key] || [];
    
    // Add new message
    const newMessage = {
      message,
      type,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random().toString(36).substr(2, 9) // Unique ID for message
    };
    
    history.push(newMessage);
    
    // Trim history if it exceeds maximum length
    if (history.length > MAX_HISTORY_LENGTH) {
      history = history.slice(-MAX_HISTORY_LENGTH);
    }
    
    // Save history with verification
    const saveWithVerification = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: history }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
          
          // Verify the save was successful
          const verification = await new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result[key]);
              }
            });
          });
          
          // Check if the last message was saved correctly
          if (verification?.length > 0 && verification[verification.length - 1].id === newMessage.id) {
            return true;
          }
          throw new Error('Verification failed');
        } catch (error) {
          console.warn(`Save attempt ${i + 1} failed:`, error);
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      return false;
    };
    
    await saveWithVerification();
    
  } catch (error) {
    console.error('Error saving chat history:', error);
    // Queue failed message for retry
    queueFailedMessage(message, type);
  }
}

// Queue system for failed messages
const messageQueue = [];
let isProcessingQueue = false;

function queueFailedMessage(message, type) {
  messageQueue.push({ message, type, timestamp: new Date().toISOString() });
  if (!isProcessingQueue) {
    processMessageQueue();
  }
}

async function processMessageQueue() {
  if (messageQueue.length === 0 || isProcessingQueue) {
    return;
  }
  
  isProcessingQueue = true;
  
  while (messageQueue.length > 0) {
    const { message, type } = messageQueue[0];
    
    try {
      await saveChatHistory(message, type);
      messageQueue.shift(); // Remove successfully saved message
    } catch (error) {
      console.error('Failed to process queued message:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
    }
  }
  
  isProcessingQueue = false;
}

async function loadChatHistory() {
  const key = 'chat_history';
  const retries = 3;
  
  for (let i = 0; i < retries; i++) {
    try {
      if (!chrome?.storage?.local) {
        throw new Error('Chrome storage is not available');
      }
      
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
      
      const history = result[key] || [];
      
      // Validate history format
      if (!Array.isArray(history)) {
        throw new Error('Invalid history format');
      }
      
      // Sort by timestamp if available
      history.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return new Date(a.timestamp) - new Date(b.timestamp);
        }
        return 0;
      });
      
      return history;
    } catch (error) {
      console.warn(`Load attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        console.error('Failed to load chat history after all retries');
        return [];
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return [];
}

// Page Reading
async function handleReadPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found. Please make sure you have a webpage open.');
    }

    // Show loading animation for reading page
    const loadingHtml = `
      <div class="message ai-message loading-message">
        <div class="loading-content">
          <div class="loading-spinner-small"></div>
          <span>Capturing full page content...</span>
        </div>
      </div>
    `;
    chatHistory.insertAdjacentHTML('beforeend', loadingHtml);
    const loadingMessage = chatHistory.lastElementChild;
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    try {
      // Inject content script if not already injected
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Request full page screenshot from content script
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Content script error: ${chrome.runtime.lastError.message}`));
            return;
          }
          if (!response) {
            reject(new Error('No response from content script. Please refresh the page and try again.'));
            return;
          }
          resolve(response);
        });
      });
      
      if (!response?.dataUrl) {
        throw new Error('Failed to capture page content: No image data received');
      }

      // Remove loading message
      loadingMessage.remove();

      // Create screenshot preview
      const screenshotDiv = document.createElement('div');
      screenshotDiv.className = 'screenshot-preview';
      
      const img = document.createElement('img');
      img.src = response.dataUrl;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = '4px';
      img.style.marginTop = '8px';
      
      screenshotDiv.appendChild(img);
      
      // Create confirmation buttons
      const confirmationDiv = document.createElement('div');
      confirmationDiv.className = 'confirmation-buttons';
      
      // Create a wrapper for the screenshot and buttons
      const wrapper = document.createElement('div');
      wrapper.className = 'message ai-message';
      wrapper.style.marginBottom = '16px';
      
      // Add confirmation message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message-content';
      messageDiv.textContent = 'AI: I\'ve captured the entire page. Would you like me to analyze it?';
      wrapper.appendChild(messageDiv);
      
      // Add screenshot
      wrapper.appendChild(screenshotDiv);
      
      // Add buttons
      const confirmButton = document.createElement('button');
      confirmButton.textContent = 'Analyze Screenshot';
      confirmButton.className = 'confirm-btn';
      
      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancel';
      cancelButton.className = 'cancel-btn';
      
      confirmationDiv.appendChild(confirmButton);
      confirmationDiv.appendChild(cancelButton);
      wrapper.appendChild(confirmationDiv);
      
      // Add the wrapper to chat history
      chatHistory.appendChild(wrapper);
      chatHistory.scrollTop = chatHistory.scrollHeight;
      
      // Set up button handlers
      confirmButton.onclick = async () => {
        // Remove the screenshot and buttons but keep the message
        screenshotDiv.remove();
        confirmationDiv.remove();
        
        // Show analyzing animation
        const analyzingHtml = `
          <div class="message ai-message loading-message">
            <div class="loading-content">
              <div class="loading-spinner-small"></div>
              <span>Analyzing the page content...</span>
            </div>
          </div>
        `;
        chatHistory.insertAdjacentHTML('beforeend', analyzingHtml);
        const analyzingMessage = chatHistory.lastElementChild;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        try {
          // Get API key and model from storage
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['openai_api_key', 'openai_model'], resolve);
          });
          
          if (!result.openai_api_key) {
            throw new Error('Please set your OpenAI API key in the settings first');
          }

          // Use the screenshot data URL from the earlier capture
          const screenshotDataUrl = response.dataUrl;
          if (!screenshotDataUrl) {
            throw new Error('Screenshot data not available');
          }

          const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${result.openai_api_key}`
            },
            body: JSON.stringify({
              model: result.openai_model || 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: `You are a helpful tax assistant AI. Analyze the screenshot of this webpage and:
1. Identify any tax-related information, forms, or questions
2. Provide a clear, step-by-step summary of what the page is asking users to do
3. Explain any tax concepts in simple terms
4. Highlight important deadlines or requirements`
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: "text",
                      text: "Please analyze this tax-related webpage screenshot and provide guidance."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: screenshotDataUrl,
                        detail: "high"
                      }
                    }
                  ]
                }
              ],
              max_tokens: 500,
              temperature: 0.7
            })
          });

          // Remove analyzing message
          analyzingMessage.remove();

          if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(errorData.error?.message || `API Error: ${apiResponse.status}`);
          }

          const data = await apiResponse.json();
          if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from AI service');
          }

          appendMessage(data.choices[0].message.content, 'ai');
        } catch (error) {
          console.error('Screenshot analysis error:', error);
          analyzingMessage.remove();
          appendMessage(`Error analyzing screenshot: ${error.message}`, 'error');
        }
      };
      
      cancelButton.onclick = () => {
        wrapper.remove();
        appendMessage('Analysis cancelled.', 'ai');
      };
      
    } catch (screenshotError) {
      console.error('Screenshot failed:', screenshotError);
      loadingMessage.remove();
      
      // Show detailed error message
      const errorDetails = document.createElement('div');
      errorDetails.className = 'error-details';
      errorDetails.textContent = `Error details: ${screenshotError.message}`;
      
      const errorMessage = document.createElement('div');
      errorMessage.className = 'message error-message';
      errorMessage.innerHTML = `
        Failed to capture page content. This might be because:
        <ul>
          <li>The page is not fully loaded</li>
          <li>The extension needs permission for this site</li>
          <li>The page has special security restrictions</li>
        </ul>
        <div class="error-details">${screenshotError.message}</div>
        <div class="help-text">Try refreshing the page or checking extension permissions.</div>
      `;
      
      chatHistory.appendChild(errorMessage);
      chatHistory.scrollTop = chatHistory.scrollHeight;
      
      // Fall back to extracting content
      try {
        await extractContent(tab);
      } catch (extractError) {
        console.error('Content extraction failed:', extractError);
        appendMessage(`Failed to extract content: ${extractError.message}. Please refresh the page and try again.`, 'error');
      }
    }
  } catch (error) {
    console.error('Page reading error:', error);
    const errorMessage = error.message.includes('Extension context invalidated')
      ? 'Extension needs to be reloaded. Please refresh the page and try again.'
      : `Failed to read page: ${error.message}. Please try refreshing the page or checking extension permissions.`;
    
    appendMessage(errorMessage, 'error');
  }
}

// Extract content from the page
async function extractContent(tab) {
  try {
    // Execute content script to extract page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Helper function to extract text content
        function extractText(element) {
          return Array.from(element.childNodes)
            .map(node => {
              if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent.trim();
              }
              if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE'].includes(node.tagName)) {
                return extractText(node);
              }
              return '';
            })
            .filter(text => text)
            .join(' ');
        }

        // Get page content
        const content = extractText(document.body);
        return {
          title: document.title,
          url: window.location.href,
          content: content
        };
      }
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract content from the page');
    }

    const pageContent = results[0].result;
    
    // Send to background script for analysis
    const response = await chrome.runtime.sendMessage({
      action: 'scanPage',
      content: {
        type: 'text',
        title: pageContent.title,
        url: pageContent.url,
        text: pageContent.content
      }
    });

    if (response?.status === 'pending') {
      updateStatus('Still processing previous scan...');
    } else if (response?.status === 'started') {
      updateStatus('Starting analysis...');
    } else {
      throw new Error('Failed to get response from background script');
    }
  } catch (error) {
    throw new Error('Failed to extract content: ' + error.message);
  }
}

// Compress image to reduce size for API and ensure proper format
async function compressImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions (max 2048px, shortest side 768px)
      let width = img.width;
      let height = img.height;
      
      // First scale to fit within 2048x2048
      if (width > 2048 || height > 2048) {
        const scale = Math.min(2048 / width, 2048 / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      // Then ensure shortest side is 768px
      const shortestSide = Math.min(width, height);
      if (shortestSide > 768) {
        const scale = 768 / shortestSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressedDataUrl);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Add styles for confirmation buttons and messages
const style = document.createElement('style');
style.textContent = `
  .confirmation-buttons {
    display: flex;
    gap: 8px;
    margin: 8px 0;
    justify-content: center;
    padding: 8px;
  }

  .confirm-btn, .cancel-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    color: white;
    font-weight: 500;
    min-width: 120px;
  }

  .confirm-btn {
    background-color: #007bff;
  }

  .confirm-btn:hover {
    background-color: #0056b3;
  }

  .cancel-btn {
    background-color: #6c757d;
  }

  .cancel-btn:hover {
    background-color: #5a6268;
  }

  .screenshot-preview {
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    padding: 8px;
    margin: 8px 0;
    text-align: center;
  }

  .screenshot-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin-top: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .error-message {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    padding: 16px;
    margin: 8px 0;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.5;
  }

  .error-message ul {
    margin: 8px 0;
    padding-left: 24px;
  }

  .error-message li {
    margin: 4px 0;
  }

  .error-details {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 8px;
    margin-top: 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    word-break: break-word;
  }

  .help-text {
    margin-top: 8px;
    color: #666;
    font-style: italic;
    font-size: 12px;
  }

  .system-message {
    background-color: #e2e3e5;
    color: #383d41;
    border: 1px solid #d6d8db;
    padding: 10px;
    margin: 5px 0;
    border-radius: 4px;
    font-style: italic;
  }

  .message {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.4;
  }

  .user-message {
    background-color: #e9ecef;
    margin-left: 20%;
  }

  .ai-message {
    background-color: #007bff;
    color: white;
    margin-right: 20%;
  }

  .message-content {
    margin-bottom: 4px;
  }

  .message-content .paragraph {
    margin-bottom: 8px;
  }

  .message-content .paragraph:last-child {
    margin-bottom: 0;
  }

  .message-content .list-item {
    margin-bottom: 4px;
    padding-left: 8px;
  }

  .message-content .list-item:last-child {
    margin-bottom: 0;
  }

  .timestamp {
    font-size: 11px;
    color: #6c757d;
    opacity: 0.8;
  }

  .ai-message .timestamp {
    color: rgba(255, 255, 255, 0.8);
  }

  .loading-message {
    padding: 12px !important;
  }

  .loading-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .loading-spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-content span {
    color: white;
    font-size: 14px;
  }
`;
document.head.appendChild(style);

// Update this function for handling system status messages
function updateStatus(message) {
  const statusId = 'status-message';
  let statusDiv = document.getElementById(statusId);
  
  if (!message) {
    // If no message provided, remove the status
    if (statusDiv) {
      statusDiv.remove();
    }
    return;
  }
  
  if (!statusDiv) {
    // Create new status message if it doesn't exist
    statusDiv = document.createElement('div');
    statusDiv.id = statusId;
    statusDiv.className = 'loading-message';
    
    // Create loading dots
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'loading-dots';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dotsDiv.appendChild(dot);
    }
    
    statusDiv.appendChild(dotsDiv);
    chatHistory.appendChild(statusDiv);
  }
  
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Loading animation functions
function showLoadingAnimation() {
  const loadingHtml = `
    <div id="loading-overlay" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner-circle"></div>
        <div class="spinner-text">Loading Tax Assistant...</div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loadingHtml);
}

function hideLoadingAnimation() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => {
      loadingOverlay.remove();
    }, 500); // Match this with the CSS animation duration
  }
}

// Update loading animation styles
const loadingStyles = `
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.5s ease-out;
  }

  .loading-overlay.fade-out {
    opacity: 0;
  }

  .loading-spinner {
    text-align: center;
  }

  .spinner-circle {
    width: 40px;
    height: 40px;
    margin: 0 auto 16px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-text {
    color: #495057;
    font-size: 14px;
    font-weight: 500;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .container {
    visibility: hidden;
  }
`;

// Add the loading styles to the existing style element
style.textContent += loadingStyles; 