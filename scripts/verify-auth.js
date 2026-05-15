import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/auth';
const TEST_WALLET = `SP3${Date.now()}XXX`; // Random wallet
const TEST_USERNAME = `user${Date.now()}`;

async function testAuth() {
    console.log('🧪 Testing Authentication Flow...\n');

    // 1. Test Registration
    console.log('1. Testing Registration...');
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: TEST_WALLET,
                username: TEST_USERNAME
            })
        });
        const data = await res.json();

        if (res.status === 201 && data.success) {
            console.log('✅ Registration Successful:', data.data.id);
        } else {
            console.error('❌ Registration Failed:', data);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Registration Error:', err);
        process.exit(1);
    }

    // 2. Test Login
    console.log('\n2. Testing Login...');
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: TEST_WALLET
            })
        });
        const data = await res.json();

        if (res.status === 200 && data.success) {
            console.log('✅ Login Successful:', data.data.id);
            if (data.data.wallet_address === TEST_WALLET) {
                console.log('✅ Wallet Address Matched');
            } else {
                console.error('❌ Wallet Address Mismatch');
            }
        } else {
            console.error('❌ Login Failed:', data);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Login Error:', err);
        process.exit(1);
    }

    // 3. Test Duplicate Registration (Should Fail)
    console.log('\n3. Testing Duplicate Registration...');
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: TEST_WALLET,
                username: "different_username" // Even with diff username, wallet exists
            })
        });
        const data = await res.json();

        if (res.status === 409 && !data.success) {
            console.log('✅ Duplicate Registration Correctly Rejected');
        } else {
            console.error('❌ Duplicate Registration SHOULD have failed but got:', res.status, data);
        }
    } catch (err) {
        console.error('❌ Duplicate Registration Error:', err);
    }

    console.log('\n🎉 All Tests Completed!');
}

testAuth();
