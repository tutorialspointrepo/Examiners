#!/bin/bash

# AI Assistant Hybrid Setup - Installation Script
# Run this from your project root directory

echo "🚀 AI Assistant Hybrid Setup"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from your project root."
    exit 1
fi

echo "📦 Step 1: Installing frontend dependencies..."
npm install react-markdown remark-math rehype-katex katex dompurify
npm install --save-dev @types/dompurify

echo ""
echo "📦 Step 2: Installing Firebase Functions dependencies..."
cd functions
npm install dotenv openai
cd ..

echo ""
echo "📝 Step 3: Creating .env file in functions directory..."
if [ -f "functions/.env" ]; then
    echo "⚠️  functions/.env already exists. Skipping..."
else
    read -p "Enter your OpenAI API Key: " api_key
    echo "OPENAI_API_KEY=$api_key" > functions/.env
    echo "✅ Created functions/.env"
fi

echo ""
echo "🔒 Step 4: Adding .env to .gitignore..."
if grep -q "^\.env$" functions/.gitignore 2>/dev/null; then
    echo "⚠️  .env already in functions/.gitignore. Skipping..."
else
    echo ".env" >> functions/.gitignore
    echo "✅ Added .env to functions/.gitignore"
fi

echo ""
echo "✅ Installation Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy AIAssistant_Hybrid.tsx to src/AIAssistant.tsx"
echo "2. Add ai-assistant-styles.css content to your global CSS"
echo "3. Copy index.ts to functions/src/index.ts"
echo "4. Run: firebase deploy --only functions"
echo ""
echo "📖 See README.md for detailed instructions"
echo ""
