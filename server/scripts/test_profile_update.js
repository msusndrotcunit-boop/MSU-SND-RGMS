const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const CREDENTIALS = {
  username: 'cadet@2026',
  password: 'cadet@2026',
};

async function loginCadet() {
  console.log('[Test] Logging in as default cadet...');
  const res = await axios.post(`${BASE_URL}/api/auth/login`, CREDENTIALS);
  if (!res.data?.token) throw new Error('Login failed: token missing');
  return { token: res.data.token, cadetId: res.data.cadetId };
}

async function getProfile(token) {
  const res = await axios.get(`${BASE_URL}/api/cadet/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function updateProfile(token) {
  // Use JSON body; server's multer middleware allows non-multipart requests and
  // Express.json has already parsed req.body upstream
  const payload = {
    // Credentials sync
    username: 'cadet@2026',
    email: 'cadet2026@default.com',
    // Names
    firstName: 'Default',
    middleName: '',
    lastName: 'Cadet',
    suffixName: '',
    // Contact & address
    contactNumber: '09000000000',
    address: 'MSU-SND ROTC Unit',
    // Academic
    course: 'BSIT',
    yearLevel: '2',
    schoolYear: '2025-2026',
    // Unit
    battalion: '1st',
    company: 'A',
    platoon: '1',
    // Cadet course & term
    cadetCourse: 'MS1',
    semester: '1st',
    // Completion flag must be string 'true' per backend logic
    is_profile_completed: 'true',
  };

  console.log('[Test] Sending profile completion update...');
  const res = await axios.put(`${BASE_URL}/api/cadet/profile`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.data;
}

async function main() {
  try {
    const { token } = await loginCadet();
    const before = await getProfile(token);
    console.log('[Test] Profile BEFORE:', {
      first_name: before.first_name,
      last_name: before.last_name,
      is_profile_completed: before.is_profile_completed,
      status: before.status,
    });

    const updateResp = await updateProfile(token);
    console.log('[Test] Update response:', updateResp);

    const after = await getProfile(token);
    console.log('[Test] Profile AFTER:', {
      first_name: after.first_name,
      last_name: after.last_name,
      is_profile_completed: after.is_profile_completed,
      status: after.status,
      profile_pic: after.profile_pic,
      email: after.email,
      username: after.username,
    });

    const completed =
      after.is_profile_completed === true ||
      after.is_profile_completed === 1 ||
      after.is_profile_completed === '1';
    if (completed && after.status === 'Verified') {
      console.log('✅ Profile completion verified successfully.');
    } else {
      console.log('⚠️ Profile completion did not reflect as expected.');
    }
  } catch (err) {
    if (err.response) {
      console.error('❌ Test failed with server error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Test failed:', err.message);
    }
    process.exitCode = 1;
  }
}

main();
