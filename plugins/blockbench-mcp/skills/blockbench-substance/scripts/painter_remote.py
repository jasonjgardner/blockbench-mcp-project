#!/usr/bin/env python3
"""painter_remote.py — run JavaScript or Python inside Substance 3D Painter.

    python painter_remote.py --ping
    python painter_remote.py --js "alg.version.painter"
    python painter_remote.py --python-file painter_bedrock_export.py --result \\
        --set MESH=C:/work/model.obj --set OUT=C:/work/painter_out --set NAME=model

Painter must be started with ``--enable-remote-scripting``; it then listens on
``localhost:60041`` and accepts ``POST /run.json`` with ``{"js": base64}`` or
``{"python": base64}``. JavaScript returns its last expression's value. Python
returns ``null`` and ``print`` output is not relayed, so a Python script that
needs to report back writes JSON to the ``PAINTER_RESULT`` placeholder path;
``--result`` substitutes a temp path and prints the file's contents. Scripting
errors come back as ``{"error": {"description": ...}}`` for both languages.

``--set KEY=VALUE`` replaces ``{{KEY}}`` tokens in the source, so script files
can take parameters. ``--wait N`` polls until Painter answers (startup takes a
while; calls made while it loads fail). Exit code 0 on success, 1 on a
scripting error or unreplaced ``{{KEY}}`` token, 2 when Painter is unreachable.
Standard library only.
"""

from __future__ import annotations

import argparse
import base64
import http.client
import json
import re
import sys
import tempfile
import time
from functools import reduce
from pathlib import Path

PLACEHOLDER = "PAINTER_RESULT"
TOKEN = re.compile(r"\{\{([A-Z_][A-Z0-9_]*)\}\}")


def post(host: str, port: int, kind: str, source: str, timeout: float) -> tuple[int, str]:
    body = json.dumps({kind: base64.b64encode(source.encode("utf-8")).decode("ascii")})
    conn = http.client.HTTPConnection(host, port, timeout=timeout)
    try:
        conn.request("POST", "/run.json", body, {"Content-type": "application/json"})
        resp = conn.getresponse()
        return resp.status, resp.read().decode("utf-8", errors="replace")
    finally:
        conn.close()


def wait_ready(host: str, port: int, seconds: float) -> bool:
    deadline = time.monotonic() + seconds
    while True:
        try:
            status, _ = post(host, port, "js", "alg.version.painter", 10)
            if status == 200:
                return True
        except OSError:
            pass
        if time.monotonic() >= deadline:
            return False
        time.sleep(3)


def decode(text: str) -> object:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--ping", action="store_true", help="print Painter's version")
    src.add_argument("--js", help="JavaScript expression/code")
    src.add_argument("--js-file", type=Path)
    src.add_argument("--python", help="Python code")
    src.add_argument("--python-file", type=Path)
    parser.add_argument("--result", action="store_true",
                        help=f"replace {PLACEHOLDER} in the Python source with a temp JSON path and print its contents")
    parser.add_argument("--set", action="append", default=[], metavar="KEY=VALUE", help="replace {{KEY}} in the source")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=60041)
    parser.add_argument("--wait", type=float, default=0, help="seconds to wait for Painter to come up")
    parser.add_argument("--timeout", type=float, default=3600)
    args = parser.parse_args()

    if args.wait and not wait_ready(args.host, args.port, args.wait):
        print(json.dumps({"ok": False, "error": f"Painter not reachable on {args.host}:{args.port}"}))
        sys.exit(2)

    kind = "python" if (args.python or args.python_file) else "js"
    source = (
        "alg.version.painter" if args.ping
        else args.js or args.python
        or (args.js_file or args.python_file).read_text(encoding="utf-8")
    )
    result_path = Path(tempfile.gettempdir()) / f"painter_result_{int(time.time() * 1000)}.json"
    source = source.replace(PLACEHOLDER, result_path.as_posix()) if args.result else source
    source = reduce(lambda text, kv: text.replace("{{" + kv[0] + "}}", kv[1]),
                    (item.split("=", 1) for item in args.set), source)
    unreplaced = sorted(set(TOKEN.findall(source)))
    if unreplaced:
        print(json.dumps({"ok": False, "error": f"missing --set for {unreplaced}"}))
        sys.exit(1)

    try:
        status, text = post(args.host, args.port, kind, source, args.timeout)
    except OSError as err:
        print(json.dumps({"ok": False, "error": f"cannot reach Painter: {err}. Start it with --enable-remote-scripting"}))
        sys.exit(2)

    payload = decode(text)
    failed = status != 200 or (isinstance(payload, dict) and "error" in payload)
    report = {"ok": not failed, "status": status, "response": payload}
    if args.result and result_path.is_file():
        report["result"] = decode(result_path.read_text(encoding="utf-8"))
        result_path.unlink()
    print(json.dumps(report, indent=2))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
