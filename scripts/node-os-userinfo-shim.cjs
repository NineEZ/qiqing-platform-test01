/* eslint-disable @typescript-eslint/no-require-imports */
const os = require('node:os');

// Some managed Windows shells return ENOMEM from uv_os_get_passwd. Drizzle Kit
// only needs the profile metadata for local config discovery, so provide the
// same non-secret values from the process environment when that system call is unavailable.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || 'codex',
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
}
