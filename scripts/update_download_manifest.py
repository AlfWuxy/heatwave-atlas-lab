"""只刷新公开数据文件的字节清单，不重算或改写已有气象资料。"""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import csv
import json

ROOT = Path(__file__).resolve().parents[1]


def update_manifest():
    folder = ROOT / 'public/data'
    files = []
    for path in sorted(folder.rglob('*')):
        if not path.is_file() or path.name in ('download-manifest.json', 'download-manifest.csv'):
            continue
        if path.is_symlink():
            raise ValueError('公开数据目录不能包含符号链接')
        relative = path.relative_to(folder).as_posix()
        files.append({'file': relative, 'url': '/data/' + relative, 'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes()).hexdigest()})
    manifest = {'schemaVersion': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'files': files}
    (folder / 'download-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (folder / 'download-manifest.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=['file', 'url', 'bytes', 'sha256'])
        writer.writeheader()
        writer.writerows(files)
    print(f'已刷新 {len(files)} 个公开数据文件的SHA-256清单')


if __name__ == '__main__':
    update_manifest()
