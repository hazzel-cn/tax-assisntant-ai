// Content Script for Tax Assistant AI

// Constants for sensitive data patterns
const SENSITIVE_PATTERNS = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/ // Credit card
];

// Initialize content script
function initialize() {
  console.log('Tax Assistant AI: Content script initialized');
}

// Extract page content while avoiding sensitive information
function extractContent() {
  // Create a clone of the body to manipulate
  const bodyClone = document.body.cloneNode(true);

  // Remove script and style elements
  bodyClone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());

  // Remove hidden elements
  const removeHiddenElements = (element) => {
    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
  };

  const walker = document.createTreeWalker(
    bodyClone,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        return removeHiddenElements(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToRemove = [];
  while (walker.nextNode()) {
    if (removeHiddenElements(walker.currentNode)) {
      nodesToRemove.push(walker.currentNode);
    }
  }
  nodesToRemove.forEach(node => node.remove());

  // Mark sensitive input fields
  bodyClone.querySelectorAll('input[type="password"], input[name*="ssn"], input[name*="social"], input[name*="phone"], input[name*="email"]')
    .forEach(input => {
      input.value = '[REDACTED]';
    });

  // Get the page structure
  const pageStructure = {
    title: document.title,
    url: window.location.href,
    content: {
      headings: Array.from(bodyClone.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent.trim()
        }))
        .filter(h => h.text && !containsSensitiveData(h.text)),
      
      forms: Array.from(bodyClone.querySelectorAll('form'))
        .map(form => ({
          id: form.id,
          elements: Array.from(form.elements)
            .map(el => ({
              type: el.type || el.tagName.toLowerCase(),
              name: el.name,
              label: getElementLabel(el),
              value: el.value && !isSensitiveField(el) ? el.value : '[REDACTED]'
            }))
            .filter(el => el.label || el.name)
        })),

      paragraphs: Array.from(bodyClone.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text && !containsSensitiveData(text)),

      lists: Array.from(bodyClone.querySelectorAll('ul, ol'))
        .map(list => ({
          type: list.tagName.toLowerCase(),
          items: Array.from(list.querySelectorAll('li'))
            .map(li => li.textContent.trim())
            .filter(text => text && !containsSensitiveData(text))
        }))
        .filter(list => list.items.length > 0)
    }
  };

  return pageStructure;
}

// Helper function to get an element's label text
function getElementLabel(element) {
  let label = '';
  
  // Check for explicit label
  if (element.id) {
    const labelElement = document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) {
      label = labelElement.textContent.trim();
    }
  }
  
  // Check for wrapped label
  if (!label) {
    const parentLabel = element.closest('label');
    if (parentLabel) {
      label = parentLabel.textContent.trim();
    }
  }

  // Check for aria-label
  if (!label) {
    label = element.getAttribute('aria-label') || '';
  }

  return label;
}

// Check if a field is likely to contain sensitive information
function isSensitiveField(element) {
  const sensitiveAttributes = ['password', 'ssn', 'social', 'phone', 'email', 'account', 'routing', 'credit'];
  const name = (element.name || '').toLowerCase();
  const type = (element.type || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  
  return sensitiveAttributes.some(attr => 
    name.includes(attr) || type.includes(attr) || id.includes(attr)
  );
}

// Check for sensitive data patterns
function containsSensitiveData(text) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const content = extractContent();
    sendResponse({ content });
  }
  return true; // Keep the message channel open for async response
});

// Initialize the content script
initialize(); 