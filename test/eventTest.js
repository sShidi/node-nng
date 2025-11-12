const nng = require('../lib/index');

// Utility function to wait for a short time
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Event-based PUSH/PULL - Basic event receiving
async function testEventBasedPushPull() {
    console.log('\n=== Testing Event-Based PUSH/PULL - Basic ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5570');
        push.dial('tcp://127.0.0.1:5570');

        await delay(100);

        let receivedCount = 0;
        const receivedMessages = [];

        // Set up event-based receiving with callback
        pull.startRecv((err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            receivedCount++;
            const msg = data.toString();
            receivedMessages.push(msg);
            console.log(`Event received #${receivedCount}:`, msg);
        });

        // Send multiple messages
        await push.send('Event 1');
        await delay(50);
        await push.send('Event 2');
        await delay(50);
        await push.send('Event 3');

        // Wait for all events to be received
        await delay(200);

        if (receivedCount !== 3) {
            throw new Error(`Expected 3 events, received ${receivedCount}`);
        }

        if (!receivedMessages.includes('Event 1') ||
            !receivedMessages.includes('Event 2') ||
            !receivedMessages.includes('Event 3')) {
            throw new Error('Not all expected messages received');
        }

        // Stop receiving events
        pull.stopRecv();

        console.log('✓ Event-based PUSH/PULL basic test passed');
    } catch (err) {
        console.error('✗ Event-based PUSH/PULL basic test failed:', err.message);
        throw err;
    } finally {
        pull.close();
        push.close();
    }
}

// Test 2: Event-based PUSH/PULL - Multiple workers with event handlers
async function testEventBasedMultipleWorkers() {
    console.log('\n=== Testing Event-Based PUSH/PULL - Multiple Workers ===');

    const push = nng.push();
    const pull1 = nng.pull();
    const pull2 = nng.pull();

    try {
        push.listen('tcp://127.0.0.1:5571');

        console.log('Connecting pull1...');
        pull1.dial('tcp://127.0.0.1:5571');
        await delay(200);

        console.log('Connecting pull2...');
        pull2.dial('tcp://127.0.0.1:5571');
        await delay(200);

        const worker1Messages = [];
        const worker2Messages = [];
        let totalReceived = 0;

        // Worker 1 event handler
        console.log('Setting up worker1 handler...');
        pull1.startRecv((err, data) => {
            if (err) {
                console.error('Worker 1 error:', err.message);
                return;
            }
            const msg = data.toString();
            worker1Messages.push(msg);
            totalReceived++;
            console.log('Worker 1 received:', msg, `(total: ${totalReceived})`);
        });

        await delay(100);

        // Worker 2 event handler
        console.log('Setting up worker2 handler...');
        pull2.startRecv((err, data) => {
            if (err) {
                console.error('Worker 2 error:', err.message);
                return;
            }
            const msg = data.toString();
            worker2Messages.push(msg);
            totalReceived++;
            console.log('Worker 2 received:', msg, `(total: ${totalReceived})`);
        });

        await delay(100);

        // Send tasks
        const tasks = ['Task A', 'Task B', 'Task C', 'Task D', 'Task E', 'Task F'];
        console.log('Sending tasks...');
        for (const task of tasks) {
            await push.send(task);
            console.log('Sent:', task);
            await delay(100);
        }

        // Wait for all tasks to be distributed
        console.log('Waiting for tasks to be processed...');
        await delay(1000);

        console.log(`Total received: ${totalReceived}/${tasks.length}`);
        console.log(`Worker 1: ${worker1Messages.length}, Worker 2: ${worker2Messages.length}`);

        if (totalReceived !== tasks.length) {
            throw new Error(`Expected ${tasks.length} tasks received, got ${totalReceived}`);
        }

        console.log(`Worker 1 processed ${worker1Messages.length} tasks`);
        console.log(`Worker 2 processed ${worker2Messages.length} tasks`);

        // Verify load distribution (both workers should receive at least one task)
        if (worker1Messages.length === 0 || worker2Messages.length === 0) {
            console.warn('⚠ Warning: Load distribution may be uneven');
        }

        console.log('Stopping receivers...');
        pull1.stopRecv();
        await delay(100);
        pull2.stopRecv();
        await delay(100);

        console.log('✓ Event-based multiple workers test passed');
    } catch (err) {
        console.error('✗ Event-based multiple workers test failed:', err.message);
        console.error(err.stack);
        throw err;
    } finally {
        console.log('Closing sockets...');
        try {
            push.close();
            console.log('Push closed');
        } catch (e) {
            console.error('Error closing push:', e.message);
        }

        try {
            pull1.close();
            console.log('Pull1 closed');
        } catch (e) {
            console.error('Error closing pull1:', e.message);
        }

        try {
            pull2.close();
            console.log('Pull2 closed');
        } catch (e) {
            console.error('Error closing pull2:', e.message);
        }
    }
}

// Test 3: Event-based PUSH/PULL - High throughput event stream
async function testEventBasedHighThroughput() {
    console.log('\n=== Testing Event-Based PUSH/PULL - High Throughput ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5572');
        push.dial('tcp://127.0.0.1:5572');

        await delay(100);

        let receivedCount = 0;
        const startTime = Date.now();
        let endTime = null;

        pull.startRecv((err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            receivedCount++;
            if (receivedCount === 100) {
                endTime = Date.now();
            }
        });

        // Send 100 events rapidly
        const sendPromises = [];
        for (let i = 1; i <= 100; i++) {
            sendPromises.push(push.send(`Event ${i}`));
        }
        await Promise.all(sendPromises);

        // Wait for all events to be received
        await delay(1000);

        if (receivedCount !== 100) {
            throw new Error(`Expected 100 events, received ${receivedCount}`);
        }

        const duration = endTime - startTime;
        const throughput = (100 / duration * 1000).toFixed(2);
        console.log(`✓ Received 100 events in ${duration}ms (${throughput} events/sec)`);

        pull.stopRecv();

        console.log('✓ Event-based high throughput test passed');
    } catch (err) {
        console.error('✗ Event-based high throughput test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Test 4: Event-based PUSH/PULL - Binary event data
async function testEventBasedBinaryData() {
    console.log('\n=== Testing Event-Based PUSH/PULL - Binary Events ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5573');
        push.dial('tcp://127.0.0.1:5573');

        await delay(100);

        const expectedData = [
            Buffer.from([0x01, 0x02, 0x03, 0x04]),
            Buffer.from([0xFF, 0xFE, 0xFD, 0xFC]),
            Buffer.from([0xAA, 0xBB, 0xCC, 0xDD])
        ];
        const receivedData = [];

        pull.startRecv((err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            receivedData.push(data);
            console.log('Binary event received:', data.toString('hex'));
        });

        // Send binary events
        for (const buffer of expectedData) {
            await push.send(buffer);
            await delay(50);
        }

        await delay(200);

        if (receivedData.length !== expectedData.length) {
            throw new Error(`Expected ${expectedData.length} events, received ${receivedData.length}`);
        }

        // Verify binary data integrity
        for (let i = 0; i < expectedData.length; i++) {
            if (Buffer.compare(expectedData[i], receivedData[i]) !== 0) {
                throw new Error(`Binary data mismatch at index ${i}`);
            }
        }

        pull.stopRecv();

        console.log('✓ Event-based binary data test passed');
    } catch (err) {
        console.error('✗ Event-based binary data test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Test 5: Event-based PUSH/PULL - Stop and restart receiving
async function testEventBasedStopRestart() {
    console.log('\n=== Testing Event-Based PUSH/PULL - Stop/Restart ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5574');
        push.dial('tcp://127.0.0.1:5574');

        await delay(100);

        let receivedCount = 0;
        const receivedMessages = [];

        // Start receiving
        pull.startRecv((err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            receivedCount++;
            receivedMessages.push(data.toString());
            console.log(`Received: ${data.toString()}`);
        });

        // Send first batch
        await push.send('Message 1');
        await push.send('Message 2');
        await delay(200);

        console.log(`Received ${receivedCount} messages before stop`);
        const countBeforeStop = receivedCount;

        // Stop receiving
        pull.stopRecv();
        console.log('Stopped receiving');

        // Send messages while stopped (these should not be received yet)
        await push.send('Message 3 (should be queued)');
        await push.send('Message 4 (should be queued)');
        await delay(200);

        if (receivedCount !== countBeforeStop) {
            throw new Error('Received messages while stopped!');
        }
        console.log('✓ No messages received while stopped');

        // Restart receiving
        pull.startRecv((err, data) => {
            if (err) {
                console.error('Receive error:', err.message);
                return;
            }
            receivedCount++;
            receivedMessages.push(data.toString());
            console.log(`Received after restart: ${data.toString()}`);
        });
        console.log('Restarted receiving');

        // Wait for queued messages
        await delay(300);

        // Send more messages
        await push.send('Message 5');
        await delay(200);

        if (receivedCount !== 5) {
            throw new Error(`Expected 5 total messages, received ${receivedCount}`);
        }

        pull.stopRecv();

        console.log('✓ Event-based stop/restart test passed');
    } catch (err) {
        console.error('✗ Event-based stop/restart test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Test 6: Event-based PUSH/PULL - Event handler replacement
async function testEventBasedHandlerReplacement() {
    console.log('\n=== Testing Event-Based PUSH/PULL - Handler Replacement ===');

    const push = nng.push();
    const pull = nng.pull();

    try {
        pull.listen('tcp://127.0.0.1:5575');
        push.dial('tcp://127.0.0.1:5575');

        await delay(100);

        let handler1Count = 0;
        let handler2Count = 0;

        // First handler
        pull.startRecv((err, data) => {
            if (err) return;
            handler1Count++;
            console.log('Handler 1:', data.toString());
        });

        await push.send('For Handler 1');
        await delay(100);

        // Replace with second handler
        pull.startRecv((err, data) => {
            if (err) return;
            handler2Count++;
            console.log('Handler 2:', data.toString());
        });

        await push.send('For Handler 2');
        await delay(100);

        if (handler1Count !== 1) {
            throw new Error(`Handler 1 should receive 1 message, got ${handler1Count}`);
        }

        if (handler2Count !== 1) {
            throw new Error(`Handler 2 should receive 1 message, got ${handler2Count}`);
        }

        pull.stopRecv();

        console.log('✓ Event-based handler replacement test passed');
    } catch (err) {
        console.error('✗ Event-based handler replacement test failed:', err.message);
        throw err;
    } finally {
        push.close();
        pull.close();
    }
}

// Run all event-based tests
async function runEventTests() {
    console.log('Starting Event-Based PUSH/PULL Tests');
    console.log('=====================================');

    try {
        await testEventBasedPushPull();
        await testEventBasedMultipleWorkers();
        await testEventBasedHighThroughput();
        await testEventBasedBinaryData();
        await testEventBasedStopRestart();
        await testEventBasedHandlerReplacement();

        console.log('\n=====================================');
        console.log('All event-based tests completed successfully!');
    } catch (err) {
        console.error('\nEvent-based test suite failed:', err);
        process.exit(1);
    }
}

runEventTests();