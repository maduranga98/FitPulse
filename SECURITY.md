# FitPulse Security Documentation

## Overview

This document outlines the security measures implemented in FitPulse to protect user data, ensure proper access control, and maintain system integrity.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Firestore Security Rules](#firestore-security-rules)
3. [Firebase Storage Rules](#firebase-storage-rules)
4. [Cloud Functions Security](#cloud-functions-security)
5. [Authentication & Authorization](#authentication--authorization)
6. [Rate Limiting](#rate-limiting)
7. [Data Validation](#data-validation)
8. [Best Practices](#best-practices)
9. [Security Checklist](#security-checklist)
10. [Known Limitations](#known-limitations)

---

## Security Architecture

FitPulse uses a multi-layered security approach:

1. **Frontend Route Protection**: Protected routes and role-based access
2. **Firestore Security Rules**: Database-level access control
3. **Storage Security Rules**: File upload/download restrictions
4. **Cloud Functions Validation**: Backend business logic security
5. **Multi-tenant Isolation**: Gym-based data segregation

---

## Firestore Security Rules

### Overview

Firestore security rules are defined in `firestore.rules` and enforce:

- **Data validation** for required fields and formats
- **Write protection** with validation rules
- **Read access** for application functionality
- **GymId consistency** checks to prevent data corruption
- **Enum validation** for status, role, and type fields

**IMPORTANT**: The current rules are compatible with the custom authentication system (localStorage). For production deployment with full security, implement Firebase Authentication and update rules to check `request.auth` for all operations.

### Role Hierarchy

```
super_admin
  └─ Full system access
  └─ Manage all gyms
  └─ Create/update/delete users

gym_admin
  └─ Manage single gym
  └─ Full CRUD on gym resources
  └─ Create gym_managers

gym_manager
  └─ Manage single gym
  └─ Limited CRUD on gym resources
  └─ Cannot manage other staff

member
  └─ View own data
  └─ Limited updates to profile
  └─ Access gym resources (read-only)
```

### Collection Access Summary

| Collection | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| **gyms** | Super Admin | Super Admin, Gym Staff (own gym) | Super Admin, Gym Admin (limited) | Super Admin |
| **users** | Super Admin, Gym Admin (managers only) | Self, Super Admin, Gym Staff (same gym) | Self (limited), Super Admin | Super Admin |
| **members** | Gym Staff | Self, Gym Staff (same gym), Super Admin | Self (limited), Gym Staff, Super Admin | Gym Staff, Super Admin |
| **exercises** | Gym Staff | Gym users (same gym), Super Admin | Gym Staff, Super Admin | Gym Staff, Super Admin |
| **commonExercises** | Super Admin | All authenticated | Super Admin | Super Admin |
| **payments** | Gym Staff | Self (members), Gym Staff (same gym), Super Admin | Gym Staff, Super Admin | Gym Staff, Super Admin |
| **attendance** | Gym Staff, Cloud Functions | Self (members), Gym Staff (same gym) | Gym Staff, Super Admin | Gym Staff, Super Admin |
| **complaints** | Members | Self (members), Gym Staff (same gym) | Self (limited), Gym Staff, Super Admin | Gym Staff, Super Admin |

### Key Security Features

1. **Multi-tenant Isolation**
   ```javascript
   // All reads/writes must match user's gymId
   belongsToUserGym(resource.data.gymId)
   ```

2. **Field-level Protection**
   ```javascript
   // Prevent modification of critical fields
   unchangedFields(['role', 'gymId', 'createdAt'])
   ```

3. **Data Validation**
   ```javascript
   // Email validation
   isValidEmail(request.resource.data.email)

   // Phone validation (10-15 digits)
   isValidPhone(request.resource.data.phone)
   ```

4. **Status Enforcement**
   ```javascript
   // Only allow valid status values
   request.resource.data.status in ['active', 'inactive', 'suspended']
   ```

### Deploying Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Test rules locally
firebase emulators:start --only firestore
```

---

## Firebase Storage Rules

### Overview

Storage security rules are defined in `storage.rules` and enforce:

- **Authentication requirement**
- **File type validation** (images: jpeg, png, gif, webp; videos: mp4, webm, mov)
- **File size limits** (images: 5MB, videos: 50MB)
- **Path-based access control** with gymId isolation

### Storage Structure

```
/exercises/{gymId}/{exerciseId}/{fileName}
/progress/{gymId}/{memberId}/{fileName}
/faces/{gymId}/{memberId}/{fileName}
/attendance/{gymId}/{date}/{fileName}
/gyms/{gymId}/{fileName}
/members/{gymId}/{memberId}/{fileName}
/equipment/{gymId}/{equipmentId}/{fileName}
/supplements/{gymId}/{supplementId}/{fileName}
```

### File Size Limits

- **Images**: 5 MB maximum
- **Videos**: 50 MB maximum

### Access Control by Path

| Path | Upload | Read | Update | Delete |
|------|--------|------|--------|--------|
| exercises | Gym Staff | Gym users | Gym Staff | Gym Staff |
| progress | Self, Gym Staff | Self, Gym Staff | Self, Gym Staff | Self, Gym Staff |
| faces | Gym Staff | Gym Staff | Gym Staff | Gym Staff |
| attendance | Gym users | Gym Staff | Gym Staff | Gym Staff |
| members | Self, Gym Staff | Gym users | Self, Gym Staff | Self, Gym Staff |

### Deploying Rules

```bash
# Deploy Storage rules
firebase deploy --only storage

# Test rules
firebase emulators:start --only storage
```

---

## Cloud Functions Security

### Overview

Cloud Functions in `functions/index.js` implement:

- **Gym status validation**
- **Member status validation**
- **Rate limiting**
- **Multi-tenant isolation checks**

### Security Functions

#### 1. Gym Status Validation

```javascript
async function validateGymStatus(gymId)
```

Ensures gym exists and is active before processing operations.

#### 2. Member Status Validation

```javascript
async function validateMemberStatus(memberId, gymId)
```

Validates:
- Member exists
- Member belongs to specified gym
- Member status is "active"

#### 3. Rate Limiting

```javascript
function checkRateLimit(key, maxOperations, timeWindowMs)
```

Prevents abuse by limiting operations per time window:
- Face recognition: 10 attempts/minute per device
- Face registration: 5 attempts/hour per member

### Function-Specific Security

#### recognizeFace

**Trigger**: Storage upload to `temp-captures/`

**Security measures**:
- Rate limiting by device ID
- Gym status validation
- Member status validation
- Automatic file cleanup

#### processFaceRegistration

**Trigger**: Member document update with facePhotos

**Security measures**:
- Gym status validation
- Rate limiting per member
- Error handling with status updates

#### processSingleFaceRegistration

**Trigger**: New member creation with facePhotoURL

**Security measures**:
- Gym status validation
- Error handling

### Deploying Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:recognizeFace

# View logs
firebase functions:log
```

---

## Authentication & Authorization

### Current Implementation

**Location**: `/src/hooks/useAuth.jsx`

FitPulse currently uses a custom authentication system:

1. **Super Admin**: Hardcoded credentials (environment variables)
2. **Gym Staff**: Username/password stored in Firestore `users` collection
3. **Members**: Username/password stored in Firestore `members` collection

### Session Management

- User data stored in `localStorage` (key: `gymUser`)
- Contains: id, username, name, email, role, gymId, membershipType, status

### Authorization Utilities

**Location**: `/src/utils/authUtils.js`

```javascript
// Role checking
hasRole(user, roles)
isAdmin(user)
isSuperAdmin(user)
isMember(user)
isStaff(user)

// Gym access
canAccessGym(user, targetGymId)
validateGymId(user)
```

### Route Protection

**Components**:
- `ProtectedRoute.jsx`: Requires authentication
- `RoleRoute.jsx`: Requires specific roles

---

## Rate Limiting

### Implemented Limits

| Operation | Limit | Time Window | Key |
|-----------|-------|-------------|-----|
| Face Recognition | 10 attempts | 1 minute | Device ID |
| Face Registration (Multi) | 5 attempts | 1 hour | Member ID |

### How It Works

Rate limits are enforced in Cloud Functions using in-memory storage:

```javascript
const operationCounts = new Map();

function checkRateLimit(key, maxOperations, timeWindowMs) {
  // Track operations per key
  // Reject if limit exceeded
}
```

**Note**: In-memory rate limiting resets when functions restart. For production, consider using Firestore or Redis.

---

## Data Validation

### Frontend Validation

**Location**: `/src/utils/validationUtils.js`

```javascript
// XSS Prevention
sanitizeInput(input)

// Format validation
isValidEmail(email)
isValidPhone(phone)
validateAge(birthDate)
validateBMIInputs(weight, height)
```

### Backend Validation

Firestore rules enforce:

- Required fields presence
- Email format (regex)
- Phone format (10-15 digits)
- Enum values (status, role, membership type)
- Positive numbers (amounts, prices)

---

## Best Practices

### 1. Environment Variables

Store sensitive data in environment variables:

```bash
# Frontend (.env)
VITE_SUPER_ADMIN_USERNAME=your_admin_username
VITE_SUPER_ADMIN_PASSWORD=your_secure_password
VITE_FIREBASE_API_KEY=your_api_key
# ... other Firebase config

# Cloud Functions (.env in functions/)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### 2. API Key Restrictions

Restrict Firebase API keys in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit browser API key
4. Add HTTP referrers (your domain)
5. Restrict to Firebase services only

### 3. Firebase Project Security

**Firestore**:
- Enable App Check (prevents unauthorized access)
- Set up backup rules
- Enable audit logging

**Storage**:
- Enable CORS only for your domain
- Set up lifecycle rules for temp files
- Enable versioning for critical files

**Authentication** (Future):
- Enable email verification
- Implement password strength requirements
- Add MFA for admin accounts

### 4. Regular Security Audits

```bash
# Check security rules coverage
firebase emulators:start --only firestore,storage
npm run test:security

# Audit dependencies
npm audit
npm audit fix

# Update dependencies
npm update
```

### 5. Monitoring & Alerts

Set up Firebase monitoring:

1. Enable Cloud Logging
2. Set up alerts for:
   - Failed authentication attempts
   - Unauthorized access attempts
   - Rate limit violations
   - Function errors

---

## Security Checklist

### Pre-Production

- [ ] Deploy Firestore security rules
- [ ] Deploy Storage security rules
- [ ] Set environment variables
- [ ] Restrict Firebase API keys
- [ ] Enable Firebase App Check
- [ ] Test all security rules
- [ ] Audit npm dependencies
- [ ] Remove hardcoded credentials
- [ ] Enable HTTPS only
- [ ] Set up CORS policies

### Post-Production

- [ ] Monitor Cloud Functions logs
- [ ] Review Firebase usage patterns
- [ ] Check for security violations
- [ ] Update dependencies monthly
- [ ] Review access logs weekly
- [ ] Backup Firestore data
- [ ] Test disaster recovery
- [ ] Audit user permissions quarterly

### Ongoing

- [ ] Rotate API keys annually
- [ ] Review security rules monthly
- [ ] Update security documentation
- [ ] Train staff on security practices
- [ ] Respond to security alerts within 24h
- [ ] Perform penetration testing annually

---

## Known Limitations

### 1. Password Storage (CRITICAL)

**Current**: Passwords stored as plain text in Firestore

**Risk**: Database breach would expose all passwords

**Recommendation**: Migrate to Firebase Authentication or implement bcrypt/argon2 hashing

**Migration steps**:
```javascript
// 1. Install bcrypt
npm install bcrypt

// 2. Hash passwords on registration/update
const hashedPassword = await bcrypt.hash(password, 10);

// 3. Verify on login
const isValid = await bcrypt.compare(password, user.hashedPassword);
```

### 2. Client-side Session Storage

**Current**: User data in localStorage (plain text)

**Risk**: XSS attacks can steal session data

**Recommendation**: Use httpOnly cookies or session tokens

### 3. In-memory Rate Limiting

**Current**: Rate limits reset on function restart

**Risk**: Limits can be bypassed by triggering function restarts

**Recommendation**: Use Firestore or Redis for persistent rate limiting

### 4. Face Recognition Threshold

**Current**: 60% confidence threshold for attendance

**Risk**: False positives possible

**Recommendation**:
- Increase threshold to 70-80%
- Implement liveness detection
- Add manual verification for low-confidence matches

### 5. No API Authentication

**Current**: Cloud Functions trust all Firestore triggers

**Risk**: If Firestore rules are misconfigured, unauthorized data could trigger functions

**Recommendation**: Add function-level authentication checks

---

## Emergency Response

### Suspected Security Breach

1. **Immediate**:
   - Disable affected Firebase services
   - Revoke compromised API keys
   - Change all passwords
   - Enable maintenance mode

2. **Investigation**:
   - Review Cloud Logging
   - Check Firestore audit logs
   - Identify affected users/data
   - Document timeline

3. **Recovery**:
   - Restore from backup if needed
   - Patch vulnerability
   - Deploy security fixes
   - Notify affected users

4. **Prevention**:
   - Update security rules
   - Add additional monitoring
   - Review and update this documentation

### Contact

For security issues, contact: [Your Security Team Email]

---

## Compliance Notes

### Data Privacy

- Member data includes PII (name, email, phone, photos)
- Face recognition data is biometric information
- Ensure compliance with GDPR, CCPA, or local privacy laws

### Data Retention

- Set retention policies for attendance records
- Implement right-to-deletion for member data
- Archive inactive gym data

### Audit Trail

- Enable Firestore audit logging
- Log all administrative actions
- Retain logs for minimum 90 days

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-01-12 | Initial security implementation | Claude AI |

---

## Additional Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase Best Practices](https://firebase.google.com/docs/rules/best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloud Functions Security](https://firebase.google.com/docs/functions/security)

---

**Last Updated**: 2026-01-12
**Next Review**: 2026-02-12
