# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of CreativeOS seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **Email**: Send details to [john@jstarstudios.com](mailto:john@jstarstudios.com)
   
2. **GitHub Security Advisory** (Preferred):
   - Go to the [Security Advisories](https://github.com/JStaRFilms/CreativeOSFolder/security/advisories) page
   - Click "Report a vulnerability"
   - Fill in the details

### What to Include

Please include the following information:

- **Type of vulnerability** (e.g., path traversal, command injection, etc.)
- **Full path of affected file(s)** 
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact assessment** - what could an attacker achieve?
- **Suggested fix** (if you have one)

### Response Timeline

| Time | Action |
|------|--------|
| Within 48 hours | Acknowledge receipt of your report |
| Within 7 days | Initial assessment and severity rating |
| Within 30 days | Fix developed and tested |
| Within 45 days | Fix released |

We will keep you informed of our progress throughout the process.

### Disclosure Policy

- We follow **Coordinated Vulnerability Disclosure (CVD)**
- We ask that you do not disclose the vulnerability publicly until a fix is released
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Features

CreativeOS implements the following security measures:

### Input Validation

All user inputs are validated and sanitized:

- **Project names**: Stripped of path separators, validated against reserved names
- **Git URLs**: Validated against injection patterns, restricted to safe protocols
- **File paths**: Validated to prevent path traversal attacks

```python
# Example: Project name sanitization
safe_name = sanitize_path_input(user_input)
# "../../../etc/passwd" -> raises ValueError
# "CON" -> raises ValueError (reserved name)
# "My Project" -> "My Project" (unchanged)
```

### Command Execution

- **No shell=True**: All subprocess calls use argument lists
- **URL validation**: Git URLs are validated before use
- **PowerShell sanitization**: Commands are escaped before execution

```python
# Safe command execution
subprocess.run(["git", "clone", validated_url], cwd=safe_path)
```

### File Permissions

- Configuration files are created with restricted permissions (0600 on Unix)
- Sensitive files are protected from unauthorized access

### Path Security

- All paths are resolved relative to configured base paths
- Path traversal attempts are blocked
- Symlink attacks are mitigated

## Known Security Considerations

### File System Access

CreativeOS requires read/write access to:
- Projects directory
- Vault directory (Obsidian)
- Archive directory
- Shuttle directory (removable drives)

**Recommendation**: Run CreativeOS with the minimum necessary permissions.

### External Commands

CreativeOS executes the following external commands:
- `git` - for cloning repositories
- `ffmpeg` - for media processing
- `magick` (ImageMagick) - for thumbnail generation

**Recommendation**: Ensure these tools are from trusted sources and in your PATH.

### Network Access

The `cos clone` command can clone repositories from:
- GitHub (https://github.com/...)
- GitLab (https://gitlab.com/...)
- Bitbucket (https://bitbucket.org/...)
- Any git-compatible URL

**Recommendation**: Only clone from trusted sources.

## Security Best Practices for Users

1. **Keep CreativeOS updated** to the latest version
2. **Review configuration** before running commands
3. **Only clone from trusted repositories**
4. **Don't run as administrator/root** unless necessary
5. **Back up your data** regularly
6. **Review project names** before creating projects

## Security Best Practices for Contributors

1. **Always sanitize user input** before using in paths or commands
2. **Never use shell=True** with subprocess
3. **Validate all URLs** before using with git
4. **Use parameterized commands** instead of string concatenation
5. **Add tests** for security-related code
6. **Review code** for potential vulnerabilities before submitting PRs

## Security Update History

| Date | Version | Issue | Severity |
|------|---------|-------|----------|
| 2026-02-25 | Unreleased | Path traversal in project names | High |
| 2026-02-25 | Unreleased | Git URL injection | High |
| 2026-02-25 | Unreleased | PowerShell command injection | Medium |

## Contact

For security concerns, contact:
- **Security Email**: [john@jstarstudios.com](mailto:john@jstarstudios.com)
- **GitHub Security**: [Security Advisories](https://github.com/JStaRFilms/CreativeOSFolder/security/advisories)

---

*Last updated: 2026-02-25*
