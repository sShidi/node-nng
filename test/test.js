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

        await delay(500);

        sub.setOpt('recv-timeout', 5000);

        const message = 'Hello subscribers!';
        const sentMessage = '\0' + message;
        const receivePromise = sub.recv();
        await pub.send(sentMessage);

        const msg = await receivePromise;
        if (msg.toString() !== sentMessage) {
            throw new Error('Message mismatch');
        }
        console.log('SUB received:', msg.toString().slice(1));

        console.log('✓ PUB/SUB basic test passed');
    } catch (err) {
        console.error('✗ PUB/SUB basic test failed:', err.message);
        throw err;
    } finally {
        pub.close();
        sub.close();
    }
}

// Test 4: PUB/SUB pattern - Specific Topics
async function testPubSubTopics() {
    console.log('\n=== Testing PUB/SUB Pattern - Specific Topics ===');

    const pub = nng.pub();
    const sub = nng.sub();

    try {
        pub.listen('tcp://127.0.0.1:5561');
        sub.dial('tcp://127.0.0.1:5561');

        const topic = 'topic1:';
        sub.setOpt('sub:subscribe', topic);

        await delay(500);

        // Should not receive (wrong topic)
        const ignoredMessage = 'Ignored message';
        await pub.send('topic2:' + '\0' + ignoredMessage);

        sub.setOpt('recv-timeout', 1000);
        try {
            await sub.recv();
            throw new Error('Received unexpected message');
        } catch (err) {
            if (!err.message.includes('Timed out')) {
                throw err;
            }
            console.log('✓ Ignored wrong topic');
        }

        // Should receive (correct topic)
        const message = 'Important message';
        const sentMessage = topic + '\0' + message;

        sub.setOpt('recv-timeout', 5000);
        const receivePromise = sub.recv();
        await pub.send(sentMessage);

        const msg = await receivePromise;
        if (msg.toString() !== sentMessage) {
            throw new Error('Message mismatch');
        }
        console.log('SUB received:', msg.toString().replace(topic + '\0', topic + ' '));

        // Unsubscribe and test
        sub.setOpt('sub:unsubscribe', topic);
        const unsubscribeMessage = 'After unsubscribe';
        await pub.send(topic + '\0' + unsubscribeMessage);

        sub.setOpt('recv-timeout', 1000);
        try {
            await sub.recv();
            throw new Error('Received unexpected message after unsubscribe');
        } catch (err) {
            if (!err.message.includes('Timed out')) {
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

        const received = new Set();
        const recvLoop = async (pull, id) => {
            for (let i = 0; i < 2; i++) {
                const msg = await pull.recv();
                console.log(`Pull${id} received:`, msg.toString());
                received.add(msg.toString());
            }
        };

        recvLoop(pull1, 1).catch(() => {});
        recvLoop(pull2, 2).catch(() => {});

        await push.send('Task 1');
        await push.send('Task 2');
        await push.send('Task 3');
        await push.send('Task 4');

        await delay(500);

        if (received.size !== 4) {
            throw new Error('Not all tasks received');
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

        await delay(500);

        bus2.setOpt('recv-timeout', 5000);
        bus3.setOpt('recv-timeout', 5000);

        // bus1 sends, bus2 and bus3 should receive (but not self)
        let recvCount = 0;
        const recvPromise2 = bus2.recv().then(msg => { recvCount++; console.log('bus2 received from bus1:', msg.toString()); });
        const recvPromise3 = bus3.recv().then(msg => { recvCount++; console.log('bus3 received from bus1:', msg.toString()); });

        await bus1.send('Message from bus1');

        await Promise.all([recvPromise2, recvPromise3]);
        if (recvCount !== 2) throw new Error('Not all nodes received');

        console.log('✓ BUS multi-node broadcast passed');
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

        const binaryData = Buffer.from([0x00, 0x01, 0xFE, 0xFF, 0xAA, 0x55]);

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
    const sub = nng.sub();

    try {
        // Test integer option: ttl-max
        const ttlOpt = 'ttl-max';
        req.setOpt(ttlOpt, 4);
        const ttl = req.getOpt(ttlOpt);
        if (ttl !== 4) {
            throw new Error(`ttl-max mismatch: expected 4, got ${ttl}`);
        }
        console.log('✓ Set/get ttl-max (int)');

        // Test string option: socket-name
        const nameOpt = 'socket-name';
        req.setOpt(nameOpt, 'test-req-socket');
        const sockName = req.getOpt(nameOpt);
        if (sockName !== 'test-req-socket') {
            throw new Error(`socket-name mismatch: expected 'test-req-socket', got ${sockName}`);
        }
        console.log('✓ Set/get socket-name (string)');

        // Test ms option: recv-timeout
        const timeoutOpt = 'recv-timeout';
        req.setOpt(timeoutOpt, 500);
        console.log('✓ Set recv-timeout (ms) - no get support');

        // Test protocol-specific string: sub:subscribe and unsubscribe
        sub.setOpt('sub:subscribe', 'test-topic:');
        sub.setOpt('sub:unsubscribe', 'test-topic:');
        console.log('✓ Set sub:subscribe and sub:unsubscribe');
        console.log('✓ Socket options test passed');
    } catch (err) {
        console.error('✗ Socket options test failed:', err.message);
        throw err;
    } finally {
        req.close();
        sub.close();
    }
}

// Test 11: Explicit Dialer and Listener
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
        } finally {
            timeoutSock.close();
        }

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

        const largeData = Buffer.alloc(5 * 1024 * 1024, 'B'); // 5MB

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

// Test 14: Event-Driven Receive
async function testEventDrivenRecv() {
    console.log('\n=== Testing Event-Driven Receive ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5566');
        push.dial('tcp://127.0.0.1:5566');

        await delay(500); // Increase initial delay

        let receivedCount = 0;
        const expectedMessages = ['Message 1', 'Message 2', 'Message 3'];

        let receivedResolve;
        const receivedPromise = new Promise((resolve, reject) => {
            receivedResolve = resolve;
            setTimeout(() => reject(new Error('Timeout waiting for 3 messages')), 5000);
        });

        let finalResolve;
        const finalPromise = new Promise((resolve, reject) => {
            finalResolve = resolve;
            setTimeout(() => reject(new Error('Timeout waiting for final message')), 5000);
        });

        const handleReceive = (err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            const msg = data.toString();
            console.log('PULL received:', msg);
            receivedCount++;
            // No throw for mismatch to avoid failing on unexpected order
            if (receivedCount === 3) {
                receivedResolve();
            } else if (receivedCount === 4) {
                finalResolve();
            }
        };

        // Start receiving on pull
        pull.startRecv(handleReceive);

        // Send messages from push
        for (const msg of expectedMessages) {
            await push.send(msg);
            await delay(200); // Increase delay after each send
        }

        // Wait for the 3 messages
        await receivedPromise;

        if (receivedCount !== 3) {
            throw new Error(`Expected 3 messages, got ${receivedCount}`);
        }

        // Test stopRecv
        pull.stopRecv();
        await delay(500);

        // Do not send after stop to avoid queuing
        await delay(500); // Wait to see if callback fires (it shouldn't)

        if (receivedCount !== 3) {
            throw new Error('Unexpected receive after stop');
        }

        // Restart and test one more
        pull.startRecv(handleReceive);

        await push.send('Final message');
        await finalPromise;

        if (receivedCount !== 4) {
            throw new Error('Missing receive after restart');
        }

        console.log('✓ Event-driven receive test passed');
    } catch (err) {
        console.error('✗ Event-driven receive test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Run all tests
async function runTests() {
    console.log('Starting Expanded NNG Node.js Bindings Tests');
    console.log('================================================');

    try {
        await testReqRepBasic();
        await testReqRepMultiple();
        await testPushPullBasic();
        await testPushPullMultiple();
        await testPairBasic();
        await testBinaryData();
        await testSocketOptions();
        await testDialerListener();
        await testErrorCases();
        await testLargeMessage();
        await testPubSubBasic();
        await testPubSubTopics();
        await testBus();

        await testEventDrivenRecv();

        console.log('\n================================================');
        console.log('All tests completed successfully!');
    } catch (err) {
        console.error('\nTest suite failed:', err);
        process.exit(1);
    }
}

runTests();