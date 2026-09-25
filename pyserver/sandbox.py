"""
Real isolation for submitted code, via bubblewrap.

The resource limits in server.py stop a program wasting the machine; they do nothing to stop it
reading your SSH keys or rewriting your shell profile, because a plain subprocess runs as you with
all of your permissions. That is fine for a single developer poking at their own project and not
fine the moment the page is shared with anyone else.

bwrap (the sandbox Flatpak uses) fixes it with a mount namespace: the submission gets a read-only
copy of the interpreter and the standard library, a private writable scratch directory, no network,
and no view of your home at all. Writes it makes to paths outside that scratch land in an ephemeral
root and disappear when the process exits.

`--unshare-all` needs unprivileged user namespaces, which every mainstream modern kernel enables.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile

BWRAP = shutil.which("bwrap")


def availability() -> tuple[bool, str]:
    """
    Whether a sandbox can actually be built here, and why not when it cannot.

    Probes with `wrap()` itself rather than a hand-written command, so what is tested is exactly
    what will run. An earlier version used a simpler invocation that omitted the /lib64 symlink;
    it reported the sandbox broken because the dynamic loader was missing from a configuration the
    real code never uses.
    """
    if BWRAP is None:
        return False, "bubblewrap is not installed (pacman -S bubblewrap, apt install bubblewrap)"

    try:
        with tempfile.TemporaryDirectory(prefix="qlprobe-") as probe_dir:
            probe = subprocess.run(
                wrap([sys.executable, "-c", "import sys; sys.exit(0)"], probe_dir),
                capture_output=True,
                timeout=30,
            )
    except Exception as exc:  # noqa: BLE001
        return False, f"bubblewrap could not start: {exc}"

    if probe.returncode != 0:
        detail = probe.stderr.decode("utf-8", "replace").strip().splitlines()
        return False, f"bubblewrap cannot create a namespace here: {detail[-1] if detail else 'unknown error'}"

    return True, "ok"


def wrap(command: list[str], workdir: str) -> list[str]:
    """
    Put `command` inside a sandbox, with `workdir` as its only writable, persistent directory.

    The interpreter is bound read-only from wherever it actually lives, so this works with pyenv,
    a virtualenv, or a system Python without being told which. Both `sys.prefix` and
    `sys.base_prefix` are needed: a virtualenv keeps its standard library in the base installation.
    """
    if BWRAP is None:
        raise RuntimeError("bubblewrap is not available")

    prefixes = {sys.prefix, sys.base_prefix, os.path.realpath(sys.base_prefix)}

    args = [
        BWRAP,
        # A read-only system, with the usual merged-/usr symlinks so interpreters find their loader.
        "--ro-bind", "/usr", "/usr",
        "--symlink", "usr/lib", "/lib",
        "--symlink", "usr/lib64", "/lib64",
        "--symlink", "usr/bin", "/bin",
        "--symlink", "usr/sbin", "/sbin",
        "--ro-bind-try", "/etc/ld.so.cache", "/etc/ld.so.cache",
        "--ro-bind-try", "/etc/localtime", "/etc/localtime",
    ]

    for prefix in sorted(prefixes):
        args += ["--ro-bind-try", prefix, prefix]

    args += [
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        # The one place writes survive the run.
        "--bind", workdir, "/work",
        "--chdir", "/work",
        # No network, no PID/IPC/UTS/cgroup/user namespace sharing.
        "--unshare-all",
        # The sandbox dies with the service rather than outliving a killed request.
        "--die-with-parent",
        # Its own session, so it cannot push characters into the parent's terminal.
        "--new-session",
        "--setenv", "HOME", "/work",
        "--setenv", "PATH", "/usr/bin",
        "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
        "--unsetenv", "PYTHONPATH",
    ]

    return args + command
