"""
Backwards-compatible entry point for CreativeOS.
This file is kept for compatibility with existing installations.
The main code is now in the 'cos' package.
"""

from cos.cli import main

if __name__ == "__main__":
    main()