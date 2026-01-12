# FitPulse Security Rules Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying security rules and configurations to make FitPulse production-ready.

## Prerequisites

Before deploying, ensure you have:

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Authenticated with Firebase (`firebase login`)
- [ ] Correct Firebase project selected (`firebase use gymnex-65440`)
- [ ] All environment variables configured
- [ ] Backup of current Firestore data (if any)

## Pre-Deployment Checklist

### 1. Review Security Rules

```bash
# Review Firestore rules
cat firestore.rules

# Review Storage rules
cat storage.rules

# Review Firebase configuration
cat firebase.json
```

### 2. Test Rules Locally (Optional)

```bash
# Start Firebase emulators
firebase emulators:start

# Test your application against local emulators
# Update .env to point to localhost:8080 for Firestore
# Update .env to point to localhost:9199 for Storage
```

### 3. Backup Current Rules

```bash
# Download current Firestore rules
firebase firestore:rules > firestore.rules.backup

# Download current Storage rules
firebase storage:rules > storage.rules.backup
```

## Deployment Steps

### Step 1: Deploy Firestore Security Rules

```bash
# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Expected output:
# ✔ Deploy complete!
# Firestore Rules: Published
```

**Verification**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Firestore Database > Rules
3. Verify the rules are updated with timestamp

### Step 2: Deploy Storage Security Rules

```bash
# Deploy only Storage rules
firebase deploy --only storage

# Expected output:
# ✔ Deploy complete!
# Storage Rules: Published
```

**Verification**:
1. Go to Firebase Console
2. Navigate to Storage > Rules
3. Verify the rules are updated

### Step 3: Deploy Cloud Functions

```bash
# Install function dependencies
cd functions
npm install
cd ..

# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions:
# firebase deploy --only functions:recognizeFace
# firebase deploy --only functions:processFaceRegistration
# firebase deploy --only functions:processSingleFaceRegistration

# Expected output:
# ✔ functions[recognizeFace(us-central1)]: Successful update operation.
# ✔ functions[processFaceRegistration(us-central1)]: Successful update operation.
# ✔ functions[processSingleFaceRegistration(us-central1)]: Successful update operation.
```

**Verification**:
1. Go to Firebase Console > Functions
2. Verify all functions are deployed and healthy
3. Check function logs for any errors

### Step 4: Deploy Hosting with Security Headers

```bash
# Build the application
npm run build

# Deploy hosting
firebase deploy --only hosting

# Expected output:
# ✔ Deploy complete!
# Hosting URL: https://gymnex-65440.web.app
```

**Verification**:
1. Visit your hosting URL
2. Open browser DevTools > Network
3. Check response headers include:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Content-Security-Policy: (full policy)
   - Strict-Transport-Security: (HSTS)

### Step 5: Complete Deployment (All Services)

```bash
# Deploy everything at once
firebase deploy

# This deploys:
# - Firestore rules
# - Storage rules
# - Cloud Functions
# - Hosting
```

## Post-Deployment Verification

### 1. Test Authentication

```bash
# Test super admin login
# Navigate to: https://your-app.web.app/login
# Username: [SUPER_ADMIN_USERNAME from env]
# Password: [SUPER_ADMIN_PASSWORD from env]
```

### 2. Test Firestore Rules

Try these operations in the application:

- [ ] Super admin can create a new gym
- [ ] Gym admin can create a member in their gym
- [ ] Gym admin CANNOT access another gym's data
- [ ] Member can view their own profile
- [ ] Member CANNOT update their membership status
- [ ] Unauthenticated access is denied

### 3. Test Storage Rules

Try these operations:

- [ ] Gym admin can upload exercise images
- [ ] Member can upload their progress photos
- [ ] Member CANNOT access another member's photos
- [ ] File size limits are enforced (try uploading 10MB image - should fail)
- [ ] Invalid file types are rejected (try uploading .exe - should fail)

### 4. Test Cloud Functions

- [ ] Upload a face photo for attendance - should trigger `recognizeFace`
- [ ] Register a new member with face photos - should trigger `processFaceRegistration`
- [ ] Check function logs for errors: `firebase functions:log`

### 5. Monitor Logs

```bash
# View real-time logs
firebase functions:log --follow

# Check for errors
firebase functions:log --only recognizeFace
```

## Security Headers Verification

Use online tools to verify security headers:

1. **SecurityHeaders.com**
   ```
   https://securityheaders.com/?q=https://your-app.web.app
   ```
   Target grade: A or A+

2. **Mozilla Observatory**
   ```
   https://observatory.mozilla.org/analyze/your-app.web.app
   ```
   Target score: 90+

3. **SSL Labs**
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=your-app.web.app
   ```
   Target grade: A+

## Rollback Procedure

If issues arise, rollback to previous rules:

```bash
# Rollback Firestore rules
firebase firestore:rules firestore.rules.backup
firebase deploy --only firestore:rules

# Rollback Storage rules
firebase storage:rules storage.rules.backup
firebase deploy --only storage

# Rollback to previous function version
firebase functions:log  # Find previous version
# Use Firebase Console to rollback to specific version
```

## Troubleshooting

### Issue: Rules deployment fails

**Solution**:
```bash
# Validate rules syntax
firebase firestore:rules --validate firestore.rules
firebase storage:rules --validate storage.rules

# Check for syntax errors
# Fix and redeploy
```

### Issue: Functions timeout or fail

**Solution**:
```bash
# Check function logs
firebase functions:log --only recognizeFace

# Common issues:
# - Missing environment variables
# - Insufficient permissions
# - Rate limiting exceeded
# - Network connectivity

# Increase function timeout in functions/index.js:
export const myFunction = functions
  .runWith({ timeoutSeconds: 540 })
  .firestore.document('...')
```

### Issue: "Permission denied" errors after deployment

**Solution**:
1. Check if user is authenticated
2. Verify user has correct role in Firestore
3. Confirm gymId matches between user and resource
4. Review Firestore logs in Console for specific rule violations

### Issue: Storage uploads fail

**Solution**:
1. Check file size (max 5MB for images, 50MB for videos)
2. Verify file type is allowed
3. Confirm user has correct permissions
4. Check Storage CORS configuration

## Monitoring & Alerts

### Set up Firebase Monitoring

1. Go to Firebase Console > Project Settings
2. Enable Google Analytics
3. Set up performance monitoring
4. Configure Cloud Logging

### Set up Alerts

Create alerts for:

1. **Function Failures**
   ```
   Alert if: functions/error_count > 10 in 5 minutes
   ```

2. **High Latency**
   ```
   Alert if: functions/execution_time > 10s (99th percentile)
   ```

3. **Rule Violations**
   ```
   Monitor Firestore logs for "PERMISSION_DENIED"
   ```

4. **Quota Exceeded**
   ```
   Alert if: firestore/read_ops approaching quota
   ```

## Environment-Specific Deployment

### Development

```bash
# Use development Firebase project
firebase use development

# Deploy with development config
firebase deploy
```

### Staging

```bash
# Use staging Firebase project
firebase use staging

# Deploy for testing
firebase deploy
```

### Production

```bash
# Use production Firebase project
firebase use gymnex-65440  # or production alias

# Deploy with caution
firebase deploy
```

## Security Best Practices Post-Deployment

### 1. Rotate Credentials

```bash
# Rotate super admin password
# Update VITE_SUPER_ADMIN_PASSWORD in environment variables
# Redeploy hosting

# Rotate Firebase service account keys
# Generate new key in GCP Console
# Update GOOGLE_APPLICATION_CREDENTIALS
```

### 2. Enable Firebase App Check

```bash
# Install App Check
npm install firebase@10.x

# Configure in src/config/firebase.js:
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  isTokenAutoRefreshEnabled: true
});
```

### 3. Set up Regular Backups

```bash
# Automate Firestore exports
gcloud firestore export gs://your-bucket/backups

# Set up daily backup cron job or Cloud Scheduler
```

### 4. Enable Audit Logging

In Google Cloud Console:
1. Go to IAM & Admin > Audit Logs
2. Enable audit logs for:
   - Firestore
   - Cloud Storage
   - Cloud Functions
3. Set log retention to 90+ days

### 5. Restrict API Keys

In Google Cloud Console:
1. Go to APIs & Services > Credentials
2. Find browser API key
3. Add application restrictions:
   - HTTP referrers: `https://your-app.web.app/*`
4. Add API restrictions:
   - Cloud Firestore API
   - Cloud Storage API
   - Cloud Functions API
   - Identity Toolkit API

## Compliance Checklist

- [ ] GDPR compliance (if applicable)
  - [ ] Privacy policy updated
  - [ ] Cookie consent implemented
  - [ ] Data retention policies configured
  - [ ] Right to deletion implemented

- [ ] CCPA compliance (if applicable)
  - [ ] "Do Not Sell" option implemented
  - [ ] Data disclosure processes documented

- [ ] HIPAA compliance (if applicable)
  - [ ] Business Associate Agreement (BAA) with Firebase
  - [ ] PHI data encrypted at rest and in transit
  - [ ] Audit logs enabled and monitored

## Maintenance Schedule

### Daily
- [ ] Review Cloud Functions error logs
- [ ] Monitor Firebase usage and quotas
- [ ] Check for security alerts

### Weekly
- [ ] Review Firestore audit logs
- [ ] Check for failed authentication attempts
- [ ] Update dependencies if needed
- [ ] Review performance metrics

### Monthly
- [ ] Security rules review
- [ ] Update npm dependencies
- [ ] Run security audit: `npm audit`
- [ ] Review and rotate access logs

### Quarterly
- [ ] Full security assessment
- [ ] Penetration testing
- [ ] Review and update security documentation
- [ ] Review user permissions and roles

### Annually
- [ ] Rotate API keys and credentials
- [ ] Update SSL/TLS certificates (if self-managed)
- [ ] Compliance audit
- [ ] Disaster recovery drill

## Support & Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Security Rules Reference**: https://firebase.google.com/docs/rules
- **Firebase Status**: https://status.firebase.google.com/
- **Firebase Support**: https://firebase.google.com/support

## Emergency Contacts

- **Security Team**: [Your team email]
- **DevOps On-Call**: [On-call phone/email]
- **Firebase Support**: https://firebase.google.com/support/contact

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-12
**Next Review**: 2026-02-12
