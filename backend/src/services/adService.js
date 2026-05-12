const ldap = require('ldapjs');
const iconv = require('iconv-lite');
const tls = require('tls');
const fs = require('fs');

// Groups that are never allowed to reset via self-service
const PRIVILEGED_GROUPS = [
  'Domain Admins',
  'Enterprise Admins',
  'Administrators',
  'Schema Admins',
  'Account Operators',
  'Server Operators',
  'Backup Operators',
  'Print Operators',
  'Group Policy Creator Owners',
];

function createClient() {
  const opts = {
    url: process.env.AD_URL,
    timeout: 10000,
    connectTimeout: 10000,
  };

  if (process.env.AD_URL.startsWith('ldaps')) {
    const tlsOpts = {
      rejectUnauthorized: process.env.AD_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
    if (process.env.AD_CA_CERT_PATH && fs.existsSync(process.env.AD_CA_CERT_PATH)) {
      tlsOpts.ca = [fs.readFileSync(process.env.AD_CA_CERT_PATH)];
    }
    opts.tlsOptions = tlsOpts;
  }

  return ldap.createClient(opts);
}

function bindAsync(client, dn, password) {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function searchAsync(client, base, opts) {
  return new Promise((resolve, reject) => {
    const entries = [];
    client.search(base, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => entries.push(entry.object));
      res.on('error', reject);
      res.on('end', () => resolve(entries));
    });
  });
}

function modifyAsync(client, dn, changes) {
  return new Promise((resolve, reject) => {
    client.modify(dn, changes, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function destroyClient(client) {
  try { client.destroy(); } catch { /* ignore */ }
}

function encodePassword(password) {
  return iconv.encode(`"${password}"`, 'utf16-le');
}

function isInAllowedOU(userDN) {
  const allowedOUs = (process.env.AD_ALLOWED_OUS || '').split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowedOUs.length === 0) return false;
  const dnLower = userDN.toLowerCase();
  return allowedOUs.some(ou => dnLower.includes(ou.toLowerCase()));
}

async function findUserByIdentifier(identifier) {
  const client = createClient();
  try {
    await bindAsync(client, process.env.AD_BIND_DN, process.env.AD_BIND_PASSWORD);

    const sanitized = identifier.replace(/[*()\\\x00]/g, '');
    const filter = `(|(sAMAccountName=${sanitized})(userPrincipalName=${sanitized})(mail=${sanitized})(employeeID=${sanitized}))`;

    const attrs = [
      'sAMAccountName', 'userPrincipalName', 'mail', 'displayName',
      'distinguishedName', 'memberOf', 'lockoutTime', 'userAccountControl',
      'employeeID', 'mobile', 'telephoneNumber', 'pwdLastSet',
    ];

    const entries = await searchAsync(client, process.env.AD_BASE_DN, {
      filter,
      scope: 'sub',
      attributes: attrs,
    });

    if (!entries || entries.length === 0) return null;

    const user = entries[0];
    const dn = user.dn || user.distinguishedName;

    // Check OU restriction
    if (!isInAllowedOU(dn)) return null;

    // Check privileged groups
    const memberOf = Array.isArray(user.memberOf)
      ? user.memberOf
      : user.memberOf ? [user.memberOf] : [];

    const isPrivileged = memberOf.some(group =>
      PRIVILEGED_GROUPS.some(pg => group.toLowerCase().includes(pg.toLowerCase()))
    );
    if (isPrivileged) return null;

    // Check disabled account
    const uac = parseInt(user.userAccountControl || '0', 10);
    if (uac & 2) return null; // ACCOUNTDISABLE

    return {
      username: user.sAMAccountName,
      upn: user.userPrincipalName,
      mail: user.mail,
      displayName: user.displayName,
      dn,
      lockoutTime: user.lockoutTime,
      employeeID: user.employeeID,
      mobile: user.mobile || user.telephoneNumber,
    };
  } finally {
    destroyClient(client);
  }
}

async function resetPassword(username, newPassword) {
  const client = createClient();
  try {
    await bindAsync(client, process.env.AD_BIND_DN, process.env.AD_BIND_PASSWORD);

    // Re-fetch user to get fresh DN
    const entries = await searchAsync(client, process.env.AD_BASE_DN, {
      filter: `(sAMAccountName=${username.replace(/[*()\\\x00]/g, '')})`,
      scope: 'sub',
      attributes: ['distinguishedName', 'lockoutTime', 'memberOf', 'userAccountControl'],
    });

    if (!entries || entries.length === 0) throw new Error('User not found during reset');

    const user = entries[0];
    const dn = user.dn || user.distinguishedName;

    if (!isInAllowedOU(dn)) throw new Error('User not in allowed OU');

    const memberOf = Array.isArray(user.memberOf) ? user.memberOf : user.memberOf ? [user.memberOf] : [];
    const isPrivileged = memberOf.some(g => PRIVILEGED_GROUPS.some(pg => g.toLowerCase().includes(pg.toLowerCase())));
    if (isPrivileged) throw new Error('Privileged account — reset not allowed');

    const changes = [
      new ldap.Change({
        operation: 'replace',
        modification: new ldap.Attribute({
          type: 'unicodePwd',
          values: [encodePassword(newPassword)],
        }),
      }),
    ];

    await modifyAsync(client, dn, changes);

    // Unlock account if locked
    const lockoutTime = parseInt(user.lockoutTime || '0', 10);
    if (lockoutTime !== 0) {
      await modifyAsync(client, dn, [
        new ldap.Change({
          operation: 'replace',
          modification: new ldap.Attribute({
            type: 'lockoutTime',
            values: ['0'],
          }),
        }),
      ]);
    }
  } finally {
    destroyClient(client);
  }
}

module.exports = { findUserByIdentifier, resetPassword };
