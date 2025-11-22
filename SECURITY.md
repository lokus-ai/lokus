# Security Policy

## Supported Versions

We release security updates for the following versions of Lokus:

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :x:                |
| < 1.1   | :x:                |

We recommend always using the latest version to ensure you have the most recent security patches.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in Lokus, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use one of these methods:

1. **GitHub Security Advisories** (Preferred):
   - Go to https://github.com/lokus-ai/lokus/security/advisories
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Private Email**:
   - Send to: security@lokusmd.com
   - Use PGP encryption if possible (key available on request)
   - Include "SECURITY" in the subject line

### What to Include

Please provide as much information as possible:

- **Description**: Clear description of the vulnerability
- **Impact**: What could an attacker do? What data is at risk?
- **Reproduction Steps**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are vulnerable?
- **Proof of Concept**: Code or screenshots demonstrating the issue
- **Suggested Fix**: If you have ideas on how to fix it
- **Your Contact Info**: So we can follow up with questions

### Example Report Format

```
Title: [Brief description of vulnerability]

Description:
[Detailed explanation of what the vulnerability is]

Impact:
- Data that could be exposed
- Actions an attacker could take
- Severity assessment

Steps to Reproduce:
1. [First step]
2. [Second step]
3. [Result]

Affected Versions:
- Tested on version X.X.X
- Likely affects versions X.X.X to X.X.X

Proof of Concept:
[Code, screenshots, or detailed explanation]

Suggested Fix:
[If you have recommendations]
```

## Response Timeline

We aim to respond to security reports according to this timeline:

- **Initial Response**: Within 48 hours
- **Severity Assessment**: Within 7 days
- **Fix Development**: Based on severity (see below)
- **Public Disclosure**: After fix is released

### Severity Levels

| Severity | Response Time | Fix Timeline |
|----------|--------------|--------------|
| Critical | Immediate | 1-3 days |
| High | 24 hours | 1-2 weeks |
| Medium | 48 hours | 2-4 weeks |
| Low | 1 week | Next release |

### Severity Criteria

**Critical**: Immediate threat to user data or system security
- Remote code execution
- Arbitrary file system access beyond user's directory
- Data exfiltration vulnerabilities
- Authentication bypass

**High**: Significant security issue with limited scope
- Cross-site scripting (XSS) in rendered content
- SQL injection (if we add database features)
- Unauthorized access to local files
- Privilege escalation

**Medium**: Security issue with mitigating factors
- Information disclosure of non-sensitive data
- Denial of service (local only)
- Weaknesses in OAuth implementation

**Low**: Minor security concerns
- Security best practice violations
- Hardening opportunities
- Low-risk information disclosure

## Security Measures in Lokus

### Current Security Features

1. **Local-Only Data Storage**
   - No cloud transmission of user data
   - No telemetry or analytics
   - Reduces attack surface significantly

2. **Content Security Policy (CSP)**
   - Strict CSP headers prevent XSS attacks
   - Inline scripts controlled and validated
   - External resources limited to trusted domains

3. **Sandboxed Execution**
   - Tauri's sandboxing isolates the app
   - WebView runs with limited privileges
   - File system access restricted to user-selected directories

4. **Code Signing** (macOS, planned for Windows)
   - Signed releases verify authenticity
   - Prevents tampering with distributed binaries
   - Notarization ensures malware-free distribution

5. **Auto-Update Security**
   - Updates downloaded over HTTPS only
   - Cryptographically signed with private key
   - Signature verification before installation

6. **OAuth Security**
   - Industry-standard OAuth 2.0 protocols
   - Tokens stored securely in OS credential manager
   - No plaintext credential storage
   - PKCE (Proof Key for Code Exchange) enabled

### Security Best Practices for Users

1. **Keep Lokus Updated**
   - Enable auto-updates in settings
   - Check for updates regularly if disabled
   - Review release notes for security fixes

2. **System Security**
   - Use full-disk encryption on your device
   - Keep your OS and security software updated
   - Use strong device passwords/biometrics

3. **Backup Security**
   - Encrypt backups of your notes
   - Use secure cloud storage with encryption
   - Don't store sensitive data in plaintext

4. **OAuth Authentication**
   - Use strong passwords for OAuth accounts
   - Enable 2FA on Google/GitHub accounts
   - Review connected apps regularly
   - Revoke access if you stop using OAuth

5. **Plugin Security** (Future Feature)
   - Only install plugins from trusted sources
   - Review plugin permissions before installation
   - Keep plugins updated

## Known Security Considerations

### Markdown Rendering

- We use TipTap for Markdown rendering
- XSS risks are mitigated by CSP and sanitization
- User-generated HTML is sanitized before rendering
- External images are loaded (user should trust sources)

### File System Access

- Lokus requires broad file system access for notes
- Users choose which directories to use
- No automatic file scanning or indexing
- File permissions follow OS-level security

### JavaScript Execution

- Some features require `unsafe-eval` in CSP
- This is necessary for TipTap and ProseMirror
- Execution is sandboxed within WebView
- No arbitrary user-provided JavaScript execution

### OAuth Tokens

- Tokens stored in OS credential manager (Keychain, Credential Vault)
- Not accessible to other applications
- Encrypted at rest by OS
- Cleared on logout

## Security Updates

### Update Process

When we release a security update:

1. **Fix Development**: Develop and test the fix privately
2. **Security Advisory**: Create a GitHub Security Advisory
3. **Release**: Publish patched version with security notes
4. **Notification**: Announce via release notes and social media
5. **Disclosure**: Full disclosure after users have time to update

### Changelog

We document all security fixes in our changelog with format:

```
## [Version] - Date

### Security
- Fixed [vulnerability description] (Severity: High)
- Patched [issue] that could allow [attack]
```

## Bug Bounty Program

Currently, Lokus does not have a formal bug bounty program. However:

- We deeply appreciate security researchers' efforts
- We will credit you in the changelog (if you wish)
- We may feature you in our contributors list
- We'll send you Lokus swag if available

If the project grows, we may establish a formal bug bounty program.

## Security Audits

### Completed Audits

- None yet (project is young)

### Planned Audits

- Security audit planned for v2.0 release
- Open to community security reviews at any time
- Will publish results publicly

## Responsible Disclosure

We follow responsible disclosure principles:

### Our Commitments

- We will respond to reports promptly
- We will keep you informed of our progress
- We will credit you for the discovery (if desired)
- We will not take legal action against good-faith researchers

### Your Responsibilities

- Give us reasonable time to fix issues before public disclosure
- Don't exploit vulnerabilities beyond proof of concept
- Don't access or modify user data without permission
- Follow responsible disclosure guidelines

## Security Contact

For security-related inquiries:

- **Security Reports**: security@lokusmd.com or GitHub Security Advisories
- **General Security Questions**: Open a discussion on GitHub
- **Critical Issues**: security@lokusmd.com (Response within 48 hours)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Tauri Security Documentation](https://tauri.app/v1/references/architecture/security/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

## Acknowledgments

We thank the following security researchers for responsible disclosure:

- *No vulnerabilities reported yet*

---

**Security is a shared responsibility. Thank you for helping keep Lokus secure!**
