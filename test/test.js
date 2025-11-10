const nng = require('../lib/index');

// Test 1: REQ/REP pattern
async function testReqRep() {
    console.log('\n=== Testing REQ/REP Pattern ===');
    
    const rep = nng.rep();
    const req = nng.req();
    
    try {
        rep.listen('tcp://127.0.0.1:5555');
        req.dial('tcp://127.0.0.1:5555');
        
        // Give time for connection
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start receiver
        const receivePromise = rep.recv();
        
        // Send message
        await req.send('Hello from REQ');
        
        // Receive message
        const msg = await receivePromise;
        console.log('REP received:', msg.toString());
        
        // Send reply
        await rep.send('Hello from REP');
        
        // Receive reply
        const reply = await req.recv();
        console.log('REQ received reply:', reply.toString());
        
        console.log('✓ REQ/REP test passed');
    } catch (err) {
        console.error('✗ REQ/REP test failed:', err.message);
    } finally {
        rep.close();
        req.close();
    }
}

// Test 2: PUB/SUB pattern
async function testPubSub() {
    console.log('\n=== Testing PUB/SUB Pattern ===');
    
    const pub = nng.pub();
    const sub = nng.sub();
    
    try {
        pub.listen('tcp://127.0.0.1:5556');
        sub.dial('tcp://127.0.0.1:5556');
        
        // Subscribe to all topics
        sub.setOpt('sub:subscribe', '');
        
        // Give time for subscription
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Start receiver
        const receivePromise = sub.recv();
        
        // Publish message
        await pub.send('Hello subscribers!');
        
        // Receive message
        const msg = await receivePromise;
        console.log('SUB received:', msg.toString());
        
        console.log('✓ PUB/SUB test passed');
    } catch (err) {
        console.error('✗ PUB/SUB test failed:', err.message);
    } finally {
        pub.close();
        sub.close();
    }
}

// Test 3: PUSH/PULL pattern
async function testPushPull() {
    console.log('\n=== Testing PUSH/PULL Pattern ===');
    
    const push = nng.push();
    const pull = nng.pull();
    
    try {
        pull.listen('tcp://127.0.0.1:5557');
        push.dial('tcp://127.0.0.1:5557');
        
        // Give time for connection
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start receiver
        const receivePromise = pull.recv();
        
        // Push message
        await push.send('Work item #1');
        
        // Pull message
        const msg = await receivePromise;
        console.log('PULL received:', msg.toString());
        
        console.log('✓ PUSH/PULL test passed');
    } catch (err) {
        console.error('✗ PUSH/PULL test failed:', err.message);
    } finally {
        push.close();
        pull.close();
    }
}

// Test 4: PAIR pattern
async function testPair() {
    console.log('\n=== Testing PAIR Pattern ===');
    
    const pair1 = nng.pair();
    const pair2 = nng.pair();
    
    try {
        pair1.listen('tcp://127.0.0.1:5558');
        pair2.dial('tcp://127.0.0.1:5558');
        
        // Give time for connection
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start receiver
        const receivePromise = pair1.recv();
        
        // Send from pair2
        await pair2.send('Hello from pair2');
        
        // Receive on pair1
        const msg = await receivePromise;
        console.log('Pair1 received:', msg.toString());
        
        // Send reply
        await pair1.send('Hello from pair1');
        
        // Receive reply
        const reply = await pair2.recv();
        console.log('Pair2 received:', reply.toString());
        
        console.log('✓ PAIR test passed');
    } catch (err) {
        console.error('✗ PAIR test failed:', err.message);
    } finally {
        pair1.close();
        pair2.close();
    }
}

// Test 5: Binary data
async function testBinaryData() {
    console.log('\n=== Testing Binary Data ===');
    
    const rep = nng.rep();
    const req = nng.req();
    
    try {
        rep.listen('tcp://127.0.0.1:5559');
        req.dial('tcp://127.0.0.1:5559');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create binary data
        const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0xFF, 0xFE]);
        
        const receivePromise = rep.recv();
        await req.send(binaryData);
        
        const received = await receivePromise;
        
        if (Buffer.compare(binaryData, received) === 0) {
            console.log('✓ Binary data transmitted correctly');
        } else {
            console.error('✗ Binary data mismatch');
        }
        
        await rep.send(Buffer.from('OK'));
        await req.recv();
        
    } catch (err) {
        console.error('✗ Binary data test failed:', err.message);
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
        await testReqRep();
        await testPubSub();
        await testPushPull();
        await testPair();
        await testBinaryData();
        
        console.log('\n===================================');
        console.log('All tests completed!');
    } catch (err) {
        console.error('\nTest suite failed:', err);
        process.exit(1);
    }
}

runTests();