"""CLI: python -m scripts.validate [--root data]: build --check --offline."""
import sys

from scripts import build


def main(argv=None) -> int:
    return build.main(["--check", "--offline", *(argv or [])])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
