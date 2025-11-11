#!/bin/bash
set -e

echo "Setting up nng-node bindings..."

# Check if deps/nng exists
if [ ! -d "deps/nng" ]; then
    echo "Cloning NNG v1.11.0..."
    mkdir -p deps
    cd deps
    git clone --depth 1 --branch v1.11.0 https://github.com/nanomsg/nng.git
    cd ..
else
    echo "NNG already exists in deps/nng"
fi

# Check for cmake
if ! command -v cmake &> /dev/null; then
    echo "ERROR: cmake is not installed"
    echo "Please install cmake:"
    echo "  - Linux: sudo apt-get install cmake"
    echo "  - macOS: brew install cmake"
    echo "  - Windows: Download from https://cmake.org/download/"
    exit 1
fi

echo "Installing npm dependencies..."
npm install

echo "Building NNG and bindings..."
npm run build

echo ""
echo "Setup complete! Run 'npm test' to verify the installation."