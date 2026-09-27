"""将同一公开白名单导出到空目录，已有文件必须显式允许刷新。"""
import argparse
from pathlib import Path
import shutil
from prepare_release import ROOT, prepare_release, public_files

parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
parser.add_argument("--refresh", action="store_true")
args = parser.parse_args()
target = args.destination.resolve()
if target == ROOT or ROOT.is_relative_to(target):
    raise SystemExit("目标不可覆盖工作目录或其父目录。")
if target.exists() and any(target.iterdir()) and not args.refresh:
    raise SystemExit("目标非空；审阅目录后可用 --refresh 更新白名单文件。")
prepare_release()
for source in public_files():
    destination = target / source.relative_to(ROOT)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise SystemExit(f"目标含符号链接：{destination}")
    shutil.copyfile(source, destination)
(target / "README.md").write_text((ROOT / "PUBLIC_README.md").read_text(), encoding="utf-8")
print(f"公开仓库已导出：{target}")
