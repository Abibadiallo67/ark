db = db.getSiblingDB('sso_auth');

db.createUser({
  user: 'sso_user',
  pwd: 'sso_password',
  roles: [
    {
      role: 'readWrite',
      db: 'sso_auth'
    }
  ]
});

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ affiliateCode: 1 }, { unique: true, sparse: true });
db.users.createIndex({ userType: 1 });
db.users.createIndex({ country: 1 });

console.log('MongoDB initialized for SSO system');
