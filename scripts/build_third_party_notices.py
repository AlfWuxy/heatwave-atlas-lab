"""从锁定生产依赖的实际许可文件生成公开声明，不用模板补写第三方权利。"""

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/third-party-notices.txt"
LICENSE_NAME = re.compile(r"^(?:licen[cs]e|copying)(?:[._-].*)?$", re.IGNORECASE)
NOTICE_NAME = re.compile(r"^(?:notice|copyright)(?:[._-].*)?$", re.IGNORECASE)


def read_license_sources(package_path, package_name):
    """原样读取包自带的许可；已核实的 README 例外单独列出。"""
    sources = []
    has_license = False
    for path in sorted(package_path.iterdir(), key=lambda item: item.name):
        if path.is_file() and (LICENSE_NAME.fullmatch(path.name) or NOTICE_NAME.fullmatch(path.name)):
            text = path.read_text(encoding="utf-8")
            if not text.strip():
                raise ValueError(f"许可文件为空：{path.relative_to(ROOT)}")
            sources.append((path, "全文", text))
            has_license = has_license or bool(LICENSE_NAME.fullmatch(path.name))

    # 该锁定包没有 LICENSE 文件，但 README 带有作者署名和完整 MIT 条款。
    if not has_license and package_name == "murmurhash-js":
        path = package_path / "README.md"
        text = path.read_text(encoding="utf-8")
        marker = "## License (MIT)"
        if marker not in text:
            raise ValueError(f"找不到已核实的许可段落：{path.relative_to(ROOT)}")
        section = text[text.index(marker):]
        next_heading = re.search(r"\n#{1,2} ", section[len(marker):])
        if next_heading:
            section = section[:len(marker) + next_heading.start()]
        for required in ("Copyright (c) 2011 Gary Court", "Permission is hereby granted", 'THE SOFTWARE IS PROVIDED "AS IS"'):
            if required not in section:
                raise ValueError(f"README 许可段落不完整：{path.relative_to(ROOT)}")
        sources.append((path, "## License (MIT) 段落；包内无独立 LICENSE 文件", section))
        has_license = True

    if not has_license:
        raise ValueError(f"缺少可核实的许可原文：{package_path.relative_to(ROOT)}；请核对上游，不能仅凭 npm 许可标签补写")
    return sources


def build_notices():
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    if not isinstance(lock.get("packages"), dict):
        raise ValueError("package-lock.json 缺少 packages 清单")
    # 与 npm 锁文件一致地纳入生产依赖；共享于开发/生产的包也须保留。
    packages = sorted((path, value) for path, value in lock["packages"].items() if path and not value.get("dev"))
    if not packages:
        raise ValueError("锁文件没有可核实的生产依赖")
    sections = [
        "HEAT ATLAS — THIRD-PARTY SOFTWARE NOTICES\n",
        "本文件保留 package-lock.json 全部生产依赖的实际许可证；第三方软件不适用本站的 MIT 许可。\n"
        "数据、地图、论文和 AI 示意图的分项说明见 THIRD_PARTY_NOTICES.md。\n"
        "此清单包括间接依赖和可能被构建工具移除的包；不表示所有包都在浏览器执行。\n"
        "生成命令：python3 scripts/build_third_party_notices.py\n",
        f"生产依赖包数：{len(packages)}\n",
    ]
    for relative, metadata in packages:
        package_path = ROOT / relative
        if not relative.startswith("node_modules/") or package_path.is_symlink() or not package_path.resolve().is_relative_to(ROOT / "node_modules"):
            raise ValueError(f"不接受外部包路径或软链接：{relative}")
        package_json = package_path / "package.json"
        if not package_json.is_file():
            raise ValueError(f"缺少已安装包：{relative}；请先运行 npm ci")
        installed = json.loads(package_json.read_text(encoding="utf-8"))
        name = installed.get("name")
        if not name or installed.get("version") != metadata.get("version"):
            raise ValueError(f"安装版本与锁文件不一致：{relative}；请先运行 npm ci")
        license_id = metadata.get("license")
        if not isinstance(license_id, str) or not license_id.strip():
            raise ValueError(f"锁文件缺少许可标识：{relative}")
        sources = read_license_sources(package_path, name)
        sections.append("=" * 78 + "\n")
        sections.append(
            f"Package: {name}@{installed['version']}\n"
            f"Lockfile license metadata: {license_id}\n"
            f"Installed path: {relative}\n"
            f"Published package: {metadata.get('resolved', '未记录；见包内元数据')}\n"
        )
        for path, scope, text in sources:
            # 哈希对应许可来源的完整文件；README 输出范围在 scope 中明确标注。
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            sections.append(
                f"Source: {path.relative_to(ROOT).as_posix()}\n"
                f"Included portion: {scope}\n"
                f"Source file SHA-256: {digest}\n\n"
                + text + ("" if text.endswith("\n") else "\n")
            )
    return "\n".join(sections), len(packages)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只验证现有公开声明与锁定依赖一致，不写文件")
    args = parser.parse_args()
    try:
        content, count = build_notices()
        if args.check:
            if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != content:
                raise ValueError("公开许可声明缺失或过期；请运行 python3 scripts/build_third_party_notices.py")
            print(f"第三方许可声明校验通过：{count} 个生产依赖")
        else:
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT.write_text(content, encoding="utf-8")
            print(f"第三方许可声明已生成：{count} 个生产依赖，{OUTPUT.relative_to(ROOT)}")
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"许可声明生成失败：{error}\n")


if __name__ == "__main__":
    main()
