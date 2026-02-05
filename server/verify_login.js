const axios = require('axios');

const LOGIN_URL = 'http://localhost:5000/api/auth/login';
const CREDENTIALS = {
    username: 'msu-sndrotc_admin',
    password: 'admingrading@2026'
};

async function testLogin() {
    console.log(`Attempting login with:`);
    console.log(`Username: ${CREDENTIALS.username}`);
    console.log(`Password: ${CREDENTIALS.password}`);

    try {
        const response = await axios.post(LOGIN_URL, CREDENTIALS);
        console.log('\n✅ Login SUCCESS!');
        console.log('Status:', response.status);
        console.log('Token received:', !!response.data.token);
        console.log('Role:', response.data.role);
    } catch (error) {
        console.log('\n❌ Login FAILED');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testLogin();
