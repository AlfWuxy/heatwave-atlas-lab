"""按白名单生成公开源码包；不打包私人研究规划与部署记录。"""
from pathlib import Path
import zipfile
from update_download_manifest import update_manifest

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def public_files():
    files = set()
    for folder in ("src", "tests", "scripts", "data", "public/data", "public/images", ".github/workflows"):
        for path in ROOT.joinpath(folder).rglob("*"):
            if path.is_file() and "__pycache__" not in path.parts and path.name != ".DS_Store":
                if path.is_symlink():
                    raise ValueError(f"公开包不能包含符号链接：{path.relative_to(ROOT)}")
                files.add(path)
    for name in (
        ".gitignore", ".gitattributes", "LICENSE", "THIRD_PARTY_NOTICES.md", "PUBLIC_README.md",
        "package.json", "package-lock.json", "tsconfig.json", "index.html", "wrangler.jsonc",
        "public/favicon.svg", "public/_headers", "public/third-party-notices.txt",
        "public/data-methods.md", "docs/网站数据口径.md",
        "public/thermal-methods.md", "docs/粒子热场方法.md",
        "public/regional-methods.md", "docs/区域风温回放方法.md", "public/map-style.json",
        "public/europe-methods.md", "docs/欧洲2019机制数据方法.md",
        "public/extended-methods.md", "docs/十地历史热浪数据方法.md",
    ):
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"缺少可公开的必要文件：{name}")
        files.add(path)
    return sorted(files)


def prepare_release():
    update_manifest()
    for public_name, source_name in (
        ("data-methods.md", "网站数据口径.md"),
        ("thermal-methods.md", "粒子热场方法.md"),
        ("regional-methods.md", "区域风温回放方法.md"),
        ("europe-methods.md", "欧洲2019机制数据方法.md"),
        ("extended-methods.md", "十地历史热浪数据方法.md"),
    ):
        PUBLIC.joinpath(public_name).write_text(ROOT.joinpath("docs", source_name).read_text(), encoding="utf-8")
    target = PUBLIC / "downloads/heat-atlas-source.zip"
    target.parent.mkdir(exist_ok=True)
    files = public_files()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, str(path.relative_to(ROOT)))
        archive.writestr("README.md", ROOT.joinpath("PUBLIC_README.md").read_text())
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
    print(f"公开源码包：{len(files)+1} 个文件，{target.stat().st_size:,} 字节")


if __name__ == "__main__":
    prepare_release()
