# Tax Assistant Chrome Extension

A powerful Chrome extension that helps users understand tax-related information and documents using AI. The extension provides real-time assistance for tax-related queries and can analyze tax documents directly from your browser.

## Features

- 💬 Interactive AI chat interface for tax-related questions
- 📷 Screenshot analysis of tax documents and forms
- 🔒 Privacy-focused with PII (Personal Identifiable Information) detection
- ⚙️ Customizable settings with OpenAI model selection
- 📝 Chat history management
- 🔐 Secure API key management

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Setup

1. Click the extension icon in your Chrome toolbar
2. Click the ⚙️ Settings button
3. Enter your OpenAI API key
4. Select your preferred model (gpt-4o recommended)
5. Save your settings

## Usage

1. Click the extension icon while browsing any tax-related website
2. Ask questions about taxes or click "Read Page" to analyze the current webpage
3. The AI will provide clear, accurate information about tax concepts and guide you through tax-related processes

## Privacy & Security

- No personal data is stored on external servers
- PII detection prevents sharing sensitive information
- API keys are stored securely in Chrome's local storage
- All communication with OpenAI is done via encrypted HTTPS

## Requirements

- Google Chrome browser (version 88 or higher)
- OpenAI API key
- Active internet connection

## Development

### Project Structure
```
tax-assistant/
├── manifest.json
├── popup.html
├── popup.js
├── settings.html
├── settings.js
└── styles/
    └── main.css
```

### Local Development
1. Clone the repository
2. Make your changes
3. Load the extension in Chrome using Developer mode
4. Test your changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This extension is for informational purposes only and should not be considered as professional tax advice. Always consult with a qualified tax professional for specific tax situations. 