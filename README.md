# Node-NNG

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
2. Build tools:
   - **Linux**: `build-essential`, `cmake`
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Visual Studio Build Tools

### Steps

1. Clone NNG v1.11 into `deps/nng`:
```bash
mkdir -p deps
cd deps
git clone --depth 1 --branch v1.11.0 https://github.com/nanomsg/nng.git
cd ..
```

2. Install and build:
```bash
npm install
```

## Usage

### Basic Example (REQ/REP)

```javascript
const nng = require('nng-node');

async function main() {
    // Create sockets
    const rep = nng.rep();
    const req = nng.req();
    
    // Setup connection
    rep.listen('tcp://127.0.0.1:5555');
    req.dial('tcp://127.0.0.1:5555');
    
    // Responder
    (async () => {
        const msg = await rep.recv();
        console.log('Received:', msg.toString());
        await rep.send('World');
    })();
    
    // Requester
    await req.send('Hello');
    const reply = await req.recv();
    console.log('Reply:', reply.toString());
    
    // Cleanup
    rep.close();
    req.close();
}

main();
```

### PUB/SUB Pattern

```javascript
const nng = require('nng-node');

// Publisher
const pub = nng.pub();
pub.listen('tcp://127.0.0.1:5556');

// Subscriber
const sub = nng.sub();
sub.dial('tcp://127.0.0.1:5556');
sub.setOpt('sub:subscribe', ''); // Subscribe to all topics

// Receive messages
(async () => {
    while (true) {
        const msg = await sub.recv();
        console.log('Received:', msg.toString());
    }
})();

// Publish messages
setInterval(() => {
    pub.send('Hello subscribers!');
}, 1000);
```

### PUSH/PULL Pattern (Pipeline)

```javascript
const nng = require('nng-node');

// Pusher (distributes work)
const push = nng.push();
push.listen('tcp://127.0.0.1:5557');

// Puller (receives work)
const pull = nng.pull();
pull.dial('tcp://127.0.0.1:5557');

// Worker
(async () => {
    while (true) {
        const work = await pull.recv();
        console.log('Processing:', work.toString());
    }
})();

// Distribute work
for (let i = 0; i < 10; i++) {
    push.send(`Task ${i}`);
}
```

### PAIR Pattern

```javascript
const nng = require('nng-node');

const pair1 = nng.pair();
const pair2 = nng.pair();

pair1.listen('tcp://127.0.0.1:5558');
pair2.dial('tcp://127.0.0.1:5558');

// Bidirectional communication
await pair1.send('Hello from pair1');
const msg = await pair2.recv();
console.log(msg.toString());

await pair2.send('Hello from pair2');
const reply = await pair1.recv();
console.log(reply.toString());
```

## API Reference

### Socket

#### Factory Functions
- `nng.bus()` - Create a BUS socket
- `nng.pair()` - Create a PAIR socket
- `nng.pull()` - Create a PULL socket
- `nng.push()` - Create a PUSH socket
- `nng.pub()` - Create a PUB socket
- `nng.sub()` - Create a SUB socket
- `nng.rep()` - Create a REP socket
- `nng.req()` - Create a REQ socket

#### Methods
- `socket.listen(url)` - Start listening on URL (e.g., `tcp://127.0.0.1:5555`, `ipc:///tmp/test`)
- `socket.dial(url)` - Connect to URL
- `await socket.send(data)` - Send data (Buffer or string)
- `await socket.recv()` - Receive data (returns Buffer)
- `socket.setOpt(name, value)` - Set socket option
- `socket.getOpt(name)` - Get socket option
- `socket.close()` - Close socket

#### Common Socket Options
- `recv-timeout` - Receive timeout in milliseconds
- `send-timeout` - Send timeout in milliseconds
- `sub:subscribe` - Subscribe to topic (SUB sockets only)
- `sub:unsubscribe` - Unsubscribe from topic (SUB sockets only)

### Dialer

```javascript
const dialer = new nng.Dialer(socket, 'tcp://127.0.0.1:5555');
dialer.start();
// ... later
dialer.close();
```

### Listener

```javascript
const listener = new nng.Listener(socket, 'tcp://127.0.0.1:5555');
listener.start();
// ... later
listener.close();
```

## Transport Protocols

- `tcp://` - TCP transport
- `ipc://` - Inter-process communication (Unix domain sockets)
- `inproc://` - In-process transport
- `ws://` - WebSocket transport
- `wss://` - WebSocket Secure transport

## Testing

```bash
npm test
```

## Building from Source

```bash
# Clean build
npm run clean
npm run build

# Rebuild
npm rebuild
```

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
