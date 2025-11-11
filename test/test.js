const nng = require('../lib/index');

// Utility function to wait for a short time
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: REQ/REP pattern - Basic
async function testReqRepBasic() {
    console.log('\n=== Testing REQ/REP Pattern - Basic ===');

    const rep = nng.rep();
    const req = nng.req();

    try {
        rep.listen('tcp://127.0.0.1:5555');
        req.dial('tcp://127.0.0.1:5555');

        await delay(100);

        const receivePromise = rep.recv();
        await req.send('Hello from REQ');

        const msg = await receivePromise;
        if (msg.toString() !== 'Hello from REQ') {
            throw new Error('Message mismatch');
        }
        console.log('REP received:', msg.toString());

        await rep.send('Hello from REP');

        const reply = await req.recv();
        if (reply.toString() !== 'Hello from REP') {
            throw new Error('Reply mismatch');
        }
        console.log('REQ received reply:', reply.toString());

        console.log('✓ REQ/REP basic test passed');
    } catch (err) {
        console.error('✗ REQ/REP basic test failed:', err.message);
        throw err;
    } finally {
        rep.close();
        req.close();
    }
}

// Test 2: REQ/REP pattern - Multiple requests
async function testReqRepMultiple() {
    console.log('\n=== Testing REQ/REP Pattern - Multiple Requests ===');

    const rep = nng.rep();
    const req = nng.req();

    try {
        rep.listen('tcp://127.0.0.1:5560');
        req.dial('tcp://127.0.0.1:5560');

        await delay(100);

        // Responder loop
        (async () => {
            for (let i = 0; i < 3; i++) {
                const msg = await rep.recv();
                console.log(`REP received ${i+1}:`, msg.toString());
                await rep.send(`Reply ${i+1}`);
            }
        })();

        // Send multiple requests
        for (let i = 0; i < 3; i++) {
            await req.send(`Request ${i+1}`);
            const reply = await req.recv();
            console.log(`REQ received reply ${i+1}:`, reply.toString());
            if (reply.toString() !== `Reply ${i+1}`) {
                throw new Error(`Reply mismatch for request ${i+1}`);
            }
        }

        console.log('✓ REQ/REP multiple requests test passed');
    } catch (err) {
        console.error('✗ REQ/REP multiple requests test failed:', err.message);
        throw err;
    } finally {
        rep.close();
        req.close();
    }
}

// Test 3: PUB/SUB pattern - Basic with all topics
async function testPubSubBasic() {
    console.log('\n=== Testing PUB/SUB Pattern - Basic (All Topics) ===');

    const pub = nng.pub();
    const sub = nng.sub();

    try {
        pub.listen('tcp://127.0.0.1:5556');
        sub.dial('tcp://127.0.0.1:5556');

        sub.setOpt('sub:subscribe', '');

        await delay(200);

        const receivePromise = sub.recv();
        await pub.send('Hello subscribers!');

        const msg = await receivePromise;
        if (msg.toString() !== 'Hello subscribers!') {
            throw new Error('Message mismatch');
        }
        console.log('SUB received:', msg.toString());

        console.log('✓ PUB/SUB basic test passed');
    } catch (err) {
        console.error('✗ PUB/SUB basic test failed:', err.message);
        throw err;
    } finally {
        pub.close();
        sub.close();
    }
}

// Test 4: PUB/SUB pattern - Topic subscription
async function testPubSubTopics() {
    console.log('\n=== Testing PUB/SUB Pattern - Specific Topics ===');

    const pub = nng.pub();
    const sub = nng.sub();

    try {
        pub.listen('tcp://127.0.0.1:5561');
        sub.dial('tcp://127.0.0.1:5561');

        sub.setOpt('sub:subscribe', 'topic1:');

        await delay(200);

        // Should not receive (wrong topic)
        await pub.send('topic2: Ignored message');
        try {
            await Promise.race([
                sub.recv(),
                delay(500).then(() => { throw new Error('Timeout expected'); })
            ]);
            throw new Error('Received unexpected message');
        } catch (err) {
            if (err.message !== 'Timeout expected') {
                throw err;
            }
            console.log('✓ Ignored wrong topic');
        }

        // Should receive (correct topic)
        const receivePromise = sub.recv();
        await pub.send('topic1: Important message');

        const msg = await receivePromise;
        if (msg.toString() !== 'topic1: Important message') {
            throw new Error('Message mismatch');
        }
        console.log('SUB received:', msg.toString());

        // Unsubscribe and test
        sub.setOpt('sub:unsubscribe', 'topic1:');
        await pub.send('topic1: After unsubscribe');
        try {
            await Promise.race([
                sub.recv(),
                delay(500).then(() => { throw new Error('Timeout expected'); })
            ]);
            throw new Error('Received unexpected message after unsubscribe');
        } catch (err) {
            if (err.message !== 'Timeout expected') {
                throw err;
            }
            console.log('✓ Ignored after unsubscribe');
        }

        console.log('✓ PUB/SUB topics test passed');
    } catch (err) {
        console.error('✗ PUB/SUB topics test failed:', err.message);
        throw err;
    } finally {
        pub.close();
        sub.close();
    }
}

// Test 5: PUSH/PULL pattern - Basic
async function testPushPullBasic() {
    console.log('\n=== Testing PUSH/PULL Pattern - Basic ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5557');
        push.dial('tcp://127.0.0.1:5557');

        await delay(100);

        const receivePromise = pull.recv();
        await push.send('Work item #1');

        const msg = await receivePromise;
        if (msg.toString() !== 'Work item #1') {
            throw new Error('Message mismatch');
        }
        console.log('PULL received:', msg.toString());

        console.log('✓ PUSH/PULL basic test passed');
    } catch (err) {
        console.error('✗ PUSH/PULL basic test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Test 6: PUSH/PULL pattern - Multiple workers
async function testPushPullMultiple() {
    console.log('\n=== Testing PUSH/PULL Pattern - Multiple Workers ===');

    const push = nng.push();
    const pull1 = nng.pull();
    const pull2 = nng.pull();

    try {
        push.listen('tcp://127.0.0.1:5562');
        pull1.dial('tcp://127.0.0.1:5562');
        pull2.dial('tcp://127.0.0.1:5562');

        await delay(100);

        const received = [];
        const recvLoop = async (pull, id) => {
            const msg = await pull.recv();
            console.log(`Pull${id} received:`, msg.toString());
            received.push(msg.toString());
        };

        recvLoop(pull1, 1);
        recvLoop(pull2, 2);

        await push.send('Task 1');
        await push.send('Task 2');

        await delay(500); // Wait for reception

        if (received.length !== 2 || !received.includes('Task 1') || !received.includes('Task 2')) {
            throw new Error('Missing tasks');
        }

        console.log('✓ PUSH/PULL multiple workers test passed');
    } catch (err) {
        console.error('✗ PUSH/PULL multiple workers test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull1.close();
        pull2.close();
    }
}

// Test 7: PAIR pattern - Basic
async function testPairBasic() {
    console.log('\n=== Testing PAIR Pattern - Basic ===');

    const pair1 = nng.pair();
    const pair2 = nng.pair();

    try {
        pair1.listen('tcp://127.0.0.1:5558');
        pair2.dial('tcp://127.0.0.1:5558');

        await delay(100);

        const receivePromise = pair1.recv();
        await pair2.send('Hello from pair2');

        const msg = await receivePromise;
        if (msg.toString() !== 'Hello from pair2') {
            throw new Error('Message mismatch');
        }
        console.log('Pair1 received:', msg.toString());

        await pair1.send('Hello from pair1');

        const reply = await pair2.recv();
        if (reply.toString() !== 'Hello from pair1') {
            throw new Error('Reply mismatch');
        }
        console.log('Pair2 received:', reply.toString());

        console.log('✓ PAIR basic test passed');
    } catch (err) {
        console.error('✗ PAIR basic test failed:', err.message);
        throw err;
    } finally {
        pair1.close();
        pair2.close();
    }
}

// Test 8: BUS pattern
async function testBus() {
    console.log('\n=== Testing BUS Pattern ===');

    const bus1 = nng.bus();
    const bus2 = nng.bus();
    const bus3 = nng.bus();

    try {
        bus1.listen('tcp://127.0.0.1:5563');
        bus2.dial('tcp://127.0.0.1:5563');
        bus3.dial('tcp://127.0.0.1:5563');

        await delay(200);

        // bus1 sends, bus2 and bus3 should receive
        const recv2 = bus2.recv();
        const recv3 = bus3.recv();

        await bus1.send('Message from bus1');

        if ((await recv2).toString() !== 'Message from bus1') {
            throw new Error('bus2 mismatch');
        }
        if ((await recv3).toString() !== 'Message from bus1') {
            throw new Error('bus3 mismatch');
        }
        console.log('✓ bus2 and bus3 received from bus1');

        // bus2 sends, bus1 and bus3 should receive
        const recv1 = bus1.recv();
        const recv3_2 = bus3.recv();

        await bus2.send('Message from bus2');

        if ((await recv1).toString() !== 'Message from bus2') {
            throw new Error('bus1 mismatch');
        }
        if ((await recv3_2).toString() !== 'Message from bus2') {
            throw new Error('bus3 mismatch');
        }
        console.log('✓ bus1 and bus3 received from bus2');

        console.log('✓ BUS test passed');
    } catch (err) {
        console.error('✗ BUS test failed:', err.message);
        throw err;
    } finally {
        bus1.close();
        bus2.close();
        bus3.close();
    }
}

// Test 9: Binary data
async function testBinaryData() {
    console.log('\n=== Testing Binary Data ===');

    const rep = nng.rep();
    const req = nng.req();

    try {
        rep.listen('tcp://127.0.0.1:5559');
        req.dial('tcp://127.0.0.1:5559');

        await delay(100);

        const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0xFF, 0xFE]);

        const receivePromise = rep.recv();
        await req.send(binaryData);

        const received = await receivePromise;

        if (Buffer.compare(binaryData, received) !== 0) {
            throw new Error('Binary data mismatch');
        }
        console.log('✓ Binary data received correctly');

        await rep.send(Buffer.from('OK'));
        await req.recv();

        console.log('✓ Binary data test passed');
    } catch (err) {
        console.error('✗ Binary data test failed:', err.message);
        throw err;
    } finally {
        rep.close();
        req.close();
    }
}

// Test 10: Socket options
async function testSocketOptions() {
    console.log('\n=== Testing Socket Options ===');

    const req = nng.req();

    try {
        // Set and get int option (e.g., recv-buffer)
        req.setOpt('recv-buffer', 2);
        const recvBuffer = req.getOpt('recv-buffer');
        if (recvBuffer !== 2) {
            throw new Error(`recv-buffer mismatch: ${recvBuffer}`);
        }
        console.log('✓ Set/get recv-buffer');

        // Set and get ms option (e.g., recv-timeout)
        req.setOpt('recv-timeout', 1000);
        const recvTimeout = req.getOpt('recv-timeout');
        if (recvTimeout !== 1000) {
            throw new Error(`recv-timeout mismatch: ${recvTimeout}`);
        }
        console.log('✓ Set/get recv-timeout');

        // Set string option (e.g., req:resend-time as ms, but test another if applicable)
        // For SUB, but since req, test raw mode or something, but skip if not applicable
        // Test SUB subscribe as string
        const sub = nng.sub();
        sub.setOpt('sub:subscribe', 'test:');
        // No get for subscribe, but assume success if no error

        console.log('✓ Socket options test passed');
    } catch (err) {
        console.error('✗ Socket options test failed:', err.message);
        throw err;
    } finally {
        req.close();
    }
}

// Test 11: Dialer and Listener explicit
async function testDialerListener() {
    console.log('\n=== Testing Explicit Dialer and Listener ===');

    const rep = nng.rep();
    const req = nng.req();

    try {
        const listener = new nng.Listener(rep, 'tcp://127.0.0.1:5564');
        listener.start();

        const dialer = new nng.Dialer(req, 'tcp://127.0.0.1:5564');
        dialer.start();

        await delay(100);

        const receivePromise = rep.recv();
        await req.send('Hello via dialer');

        const msg = await receivePromise;
        if (msg.toString() !== 'Hello via dialer') {
            throw new Error('Message mismatch');
        }

        await rep.send('Reply via listener');
        const reply = await req.recv();
        if (reply.toString() !== 'Reply via listener') {
            throw new Error('Reply mismatch');
        }

        dialer.close();
        listener.close();

        console.log('✓ Dialer/Listener test passed');
    } catch (err) {
        console.error('✗ Dialer/Listener test failed:', err.message);
        throw err;
    } finally {
        rep.close();
        req.close();
    }
}

// Test 12: Error cases
async function testErrorCases() {
    console.log('\n=== Testing Error Cases ===');

    const sock = nng.req();

    try {
        // Operation on closed socket
        sock.close();
        try {
            await sock.send('Test');
            throw new Error('Send on closed socket should fail');
        } catch (err) {
            if (err.message !== 'Socket is closed') {
                throw err;
            }
            console.log('✓ Send on closed socket failed as expected');
        }

        // Invalid URL
        const invalidSock = nng.rep();
        try {
            invalidSock.listen('invalid://url');
            throw new Error('Invalid URL should fail');
        } catch (err) {
            console.log('✓ Invalid URL failed as expected:', err.message);
        }
        invalidSock.close();

        // Timeout test
        const timeoutSock = nng.pull();
        timeoutSock.setOpt('recv-timeout', 200);
        try {
            await timeoutSock.recv();
            throw new Error('Recv should timeout');
        } catch (err) {
            if (!err.message.includes('Timed out')) {
                throw err;
            }
            console.log('✓ Recv timeout as expected');
        }
        timeoutSock.close();

        console.log('✓ Error cases test passed');
    } catch (err) {
        console.error('✗ Error cases test failed:', err.message);
        throw err;
    }
}

// Test 13: Large message
async function testLargeMessage() {
    console.log('\n=== Testing Large Message ===');

    const rep = nng.rep();
    const req = nng.req();

    try {
        rep.listen('tcp://127.0.0.1:5565');
        req.dial('tcp://127.0.0.1:5565');

        await delay(100);

        const largeData = Buffer.alloc(1024 * 1024, 'A'); // 1MB

        const receivePromise = rep.recv();
        await req.send(largeData);

        const received = await receivePromise;

        if (Buffer.compare(largeData, received) !== 0) {
            throw new Error('Large data mismatch');
        }
        console.log('✓ Large data received correctly');

        await rep.send('OK');
        await req.recv();

        console.log('✓ Large message test passed');
    } catch (err) {
        console.error('✗ Large message test failed:', err.message);
        throw err;
    } finally {
        rep.close();
        req.close();
    }
}

// Run all tests
async function runTests() {
    console.log('Starting NNG Node.js Bindings Tests');
    console.log('===================================');

    try {
        await testReqRepBasic();
        await testReqRepMultiple();
        await testPubSubBasic();
        await testPubSubTopics();
        await testPushPullBasic();
        await testPushPullMultiple();
        await testPairBasic();
        await testBus();
        await testBinaryData();
        await testSocketOptions();
        await testDialerListener();
        await testErrorCases();
        await testLargeMessage();

        console.log('\n===================================');
        console.log('All tests completed successfully!');
    } catch (err) {
        console.error('\nTest suite failed:', err);
        process.exit(1);
    }
}

runTests();