"""Unit tests for security functions."""

import pytest
from cos.security import sanitize_path_input, validate_git_url


class TestSanitizePathInput:
    """Tests for sanitize_path_input function."""
    
    def test_valid_name_unchanged(self):
        """Valid names should pass through unchanged."""
        assert sanitize_path_input("My Project") == "My Project"
        assert sanitize_path_input("project-name") == "project-name"
        assert sanitize_path_input("project_name") == "project_name"
    
    def test_rejects_forward_slash(self):
        """Forward slashes should be rejected."""
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input("test/path/name")
    
    def test_rejects_backslash(self):
        """Backslashes should be rejected."""
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input("test\\path\\name")
    
    def test_rejects_parent_directory_reference(self):
        """Parent directory references should be rejected."""
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input("../../../etc/passwd")
    
    def test_rejects_reserved_name_con(self):
        """CON is a reserved name and should be rejected."""
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("CON")
    
    def test_rejects_reserved_name_prn(self):
        """PRN is a reserved name and should be rejected."""
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("PRN")
    
    def test_rejects_reserved_name_aux(self):
        """AUX is a reserved name and should be rejected."""
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("AUX")
    
    def test_rejects_reserved_name_nul(self):
        """NUL is a reserved name and should be rejected."""
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("NUL")
    
    def test_rejects_reserved_name_com1(self):
        """COM1 is a reserved name and should be rejected."""
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("COM1")
    
    def test_empty_input_rejected(self):
        """Empty input should be rejected."""
        with pytest.raises(ValueError, match="Empty|empty"):
            sanitize_path_input("")
    
    def test_only_invalid_chars_rejected(self):
        """Input with only invalid characters should be rejected."""
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input("///")
    
    def test_max_length_truncates(self):
        """Long input should be truncated to max_length."""
        long_name = "a" * 200
        result = sanitize_path_input(long_name, max_length=100)
        assert len(result) == 100
    
    def test_rejects_special_chars(self):
        """Special characters should be rejected."""
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input('test<>:"|?*name')
    
    def test_collapses_spaces(self):
        """Multiple spaces should collapse to one."""
        result = sanitize_path_input("test   name")
        assert result == "test name"
    
    def test_strips_whitespace(self):
        """Leading and trailing whitespace should be stripped."""
        result = sanitize_path_input("  test name  ")
        assert result == "test name"


class TestValidateGitUrl:
    """Tests for validate_git_url function."""
    
    def test_https_url_valid(self):
        """HTTPS URLs should be valid."""
        url = "https://github.com/user/repo.git"
        assert validate_git_url(url) == url
    
    def test_http_url_valid(self):
        """HTTP URLs should be valid."""
        url = "http://github.com/user/repo.git"
        assert validate_git_url(url) == url
    
    def test_ssh_url_valid(self):
        """SSH URLs should be valid."""
        url = "git@github.com:user/repo.git"
        assert validate_git_url(url) == url
    
    def test_git_protocol_valid(self):
        """git:// URLs should be valid."""
        url = "git://github.com/user/repo.git"
        assert validate_git_url(url) == url
    
    def test_rejects_flag_injection(self):
        """URLs starting with dash should be rejected."""
        with pytest.raises(ValueError, match="injection|cannot start with '-'"):
            validate_git_url("--upload-pack=malicious")
    
    def test_rejects_flag_injection_single_dash(self):
        """URLs starting with single dash should be rejected."""
        with pytest.raises(ValueError, match="injection|cannot start with '-'"):
            validate_git_url("-flag")
    
    def test_rejects_file_protocol(self):
        """file:// URLs should be rejected."""
        with pytest.raises(ValueError, match="not allowed"):
            validate_git_url("file:///etc/passwd")
    
    def test_shortform_expands_to_github(self):
        """Short form user/repo should expand to GitHub HTTPS."""
        result = validate_git_url("user/repo")
        assert result == "https://github.com/user/repo"
    
    def test_empty_url_rejected(self):
        """Empty URL should be rejected."""
        with pytest.raises(ValueError, match="empty|cannot be empty"):
            validate_git_url("")
    
    def test_invalid_ssh_url_rejected(self):
        """Invalid SSH URLs should be rejected."""
        with pytest.raises(ValueError, match="Invalid SSH|format"):
            validate_git_url("git@github.com")
    
    def test_unrecognized_format_rejected(self):
        """Unrecognized URL formats should be rejected."""
        with pytest.raises(ValueError, match="Unrecognized"):
            validate_git_url("not-a-valid-url")
