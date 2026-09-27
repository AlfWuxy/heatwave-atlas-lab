"""逐文件核对已部署静态站的字节与本地构建，不提交或改写线上数据。"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
import json
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument("--base-url", required=True)
parser.add_argument("--dist", type=Path, default=Path("dist"))
args = parser.parse_args()
base = args.base_url.rstrip("/")
url = urlparse(base)
if url.scheme != "https" and not (url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}):
    raise SystemExit("线上检查必须使用 HTTPS；仅本地预览可使用 HTTP。")
files = sorted(p for p in args.dist.rglob("*") if p.is_file() and p.name not in {"_headers", "_redirects"})
if not files or not (args.dist / "index.html").is_file():
    raise SystemExit("没有找到构建产物，请先运行 npm run build。")


def check(path):
    relative = path.relative_to(args.dist).as_posix()
    address = base + "/" + ("" if relative == "index.html" else quote(relative))
    request = Request(address, headers={"User-Agent": "HeatAtlas-release-check/1.0", "Accept-Encoding": "identity"})
    try:
        with urlopen(request, timeout=45) as response:
            body = response.read()
            if response.status != 200 or sha256(body).digest() != sha256(path.read_bytes()).digest():
                raise ValueError("HTTP状态或SHA-256不匹配")
            if relative == "index.html":
                if not response.headers.get("Content-Security-Policy"):
                    raise ValueError("首页缺少预期的Content-Security-Policy")
                if response.headers.get("X-Content-Type-Options") != "nosniff":
                    raise ValueError("首页缺少nosniff头")
        return {"path": relative, "ok": True, "bytes": len(body)}
    except Exception as error:
        return {"path": relative, "ok": False, "error": str(error)}


with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(check, files))
failed = [entry for entry in results if not entry["ok"]]
print(json.dumps({"baseUrl": base, "checked": len(results), "passed": len(results)-len(failed), "failed": failed}, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
