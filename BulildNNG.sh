#!/bin/bash
set -e

echo "Building NNG library..."

# Build NNG
cd deps/nng
rm -rf build
mkdir -p build
cd build

echo "Running cmake..."
cmake -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_POSITION_INDEPENDENT_CODE=ON\
      -DBUILD_SHARED_LIBS=OFF \
      -DNNG_TESTS=OFF \
      -DNNG_TOOLS=OFF \
      -DNNG_ENABLE_TLS=OFF \
      -DNNG_ENABLE_HTTP=ON \
      ..

echo "Compiling NNG..."
make -j4

# Copy library to build directory
cd ../../..
mkdir -p build/Release
cp deps/nng/build/libnng.a build/Release/

echo "NNG library built successfully!"
echo ""
echo "Now building Node.js bindings..."

# Build Node bindings
node-gyp configure
node-gyp build

echo ""
echo "Build complete!"