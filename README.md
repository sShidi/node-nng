# μ Mu

Node.js bindings for [nanomsg-NG (NNG)](https://github.com/nanomsg/nng) v1.11 using Node-API.

## Features

- ✅ Node-API based (ABI-stable across Node.js versions)
- ✅ Async/await support for send/recv operations
- ✅ All major messaging patterns (REQ/REP, PUB/SUB, PUSH/PULL, PAIR, BUS)
- ✅ Binary and text data support
- ✅ Socket options
- ✅ Dialer and Listener support
- ✅ Cross-platform (Linux, macOS, Windows)

## Installation

### Prerequisites

1. Node.js >= 16.0.0
2. CMake >= 3.13
3. Build tools:
    - **Linux**: `build-essential`, `cmake`, `git`
    - **macOS**: Xcode Command Line Tools, `cmake` (via Homebrew: `brew install cmake`)
    - **Windows**: Visual Studio Build Tools, CMake

4. Clone NNG v1.11 into `deps/nng`:
```bash
mkdir -p deps
cd deps
git clone --depth 1 --branch v1.11.0 https://github.com/nanomsg/nng.git
cd ..
```

### Steps

1. Install dependencies:
```bash
npm install --save-dev node-gyp
```

2. Build NNG and the bindings:
```bash
chmod +x BulildNNG.sh
bash BulildNNG.sh
```

**Note**: The build process will:
- First build NNG using CMake
- Then compile the Node.js bindings linking against NNG

## Architecture

The bindings use Node-API (N-API) for maximum compatibility across Node.js versions. The project structure:

- `src/` - Native C code using Node-API
    - `nng_bindings.c` - Main module and core functions
    - `socket.c` - Socket-related functions
    - `dialer.c` - Dialer functions
    - `listener.c` - Listener functions
- `lib/` - JavaScript wrapper API
- `deps/nng/` - NNG library source (v1.11)

## Performance Considerations

- Send/recv operations are fully async and won't block the Node.js event loop
- Use Buffer objects for best performance with binary data
- For high-throughput scenarios, consider batching messages
- Close sockets explicitly when done to free resources

## Known Limitations

- Browser storage APIs (localStorage/sessionStorage) not applicable
- Some advanced NNG features not yet exposed
- Context API not yet implemented

## Contributing

Contributions welcome! Please ensure:
1. Code follows existing style
2. Tests pass (`npm test`)
3. New features include tests

## License

MIT

## Resources

- [NNG Documentation](https://nanomsg.github.io/nng/)
- [NNG GitHub](https://github.com/nanomsg/nng)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)