const binding = require('../build/Release/nng_bindings.node');

// Protocol constants
const Protocol = binding.Protocol;

// Socket class wrapper
class Socket {
    constructor(protocol) {
        this._id = binding.socketOpen(protocol);
        this._closed = false;
    }

    get id() {
        return this._id;
    }

    listen(url) {
        if (this._closed) throw new Error('Socket is closed');
        binding.socketListen(this._id, url);
    }

    dial(url) {
        if (this._closed) throw new Error('Socket is closed');
        binding.socketDial(this._id, url);
    }

    async send(data) {
        if (this._closed) throw new Error('Socket is closed');
        
        let buffer;
        if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (typeof data === 'string') {
            buffer = Buffer.from(data, 'utf8');
        } else {
            throw new Error('Data must be a Buffer or string');
        }
        
        return binding.socketSend(this._id, buffer);
    }

    async recv() {
        if (this._closed) throw new Error('Socket is closed');
        return binding.socketRecv(this._id);
    }

    setOpt(name, value) {
        if (this._closed) throw new Error('Socket is closed');
        
        if (typeof value === 'string') {
            binding.socketSetoptString(this._id, name, value);
        } else if (typeof value === 'number') {
            if (name.endsWith(':ms') || name === 'recv-timeout' || name === 'send-timeout') {
                binding.socketSetoptMs(this._id, name, value);
            } else {
                binding.socketSetoptInt(this._id, name, value);
            }
        } else {
            throw new Error('Value must be a string or number');
        }
    }

    getOpt(name) {
        if (this._closed) throw new Error('Socket is closed');
        
        // Try to get as int first, fall back to string
        try {
            return binding.socketGetoptInt(this._id, name);
        } catch (e) {
            return binding.socketGetoptString(this._id, name);
        }
    }

    close() {
        if (!this._closed) {
            binding.socketClose(this._id);
            this._closed = true;
        }
    }
}

// Dialer class wrapper
class Dialer {
    constructor(socket, url) {
        if (!(socket instanceof Socket)) {
            throw new Error('First argument must be a Socket instance');
        }
        this._id = binding.dialerCreate(socket.id, url);
        this._closed = false;
    }

    start() {
        if (this._closed) throw new Error('Dialer is closed');
        binding.dialerStart(this._id);
    }

    close() {
        if (!this._closed) {
            binding.dialerClose(this._id);
            this._closed = true;
        }
    }
}

// Listener class wrapper
class Listener {
    constructor(socket, url) {
        if (!(socket instanceof Socket)) {
            throw new Error('First argument must be a Socket instance');
        }
        this._id = binding.listenerCreate(socket.id, url);
        this._closed = false;
    }

    start() {
        if (this._closed) throw new Error('Listener is closed');
        binding.listenerStart(this._id);
    }

    close() {
        if (!this._closed) {
            binding.listenerClose(this._id);
            this._closed = true;
        }
    }
}

// Factory functions
function bus() {
    return new Socket(Protocol.BUS);
}

function pair() {
    return new Socket(Protocol.PAIR);
}

function pull() {
    return new Socket(Protocol.PULL);
}

function push() {
    return new Socket(Protocol.PUSH);
}

function pub() {
    return new Socket(Protocol.PUB);
}

function sub() {
    return new Socket(Protocol.SUB);
}

function rep() {
    return new Socket(Protocol.REP);
}

function req() {
    return new Socket(Protocol.REQ);
}

// Export API
module.exports = {
    Protocol,
    Socket,
    Dialer,
    Listener,
    bus,
    pair,
    pull,
    push,
    pub,
    sub,
    rep,
    req
};