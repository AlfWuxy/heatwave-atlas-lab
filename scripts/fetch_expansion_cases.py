#!/usr/bin/env python3
"""按冻结三十地目录串行取数；共享原十地管线，不改写原数据目录。"""
import sys
from fetch_extended_cases import EXPANSION_CONFIG, ROOT, main

if __name__ == '__main__':
    try:
        main(EXPANSION_CONFIG)
        # 分案例命令可能仍是部分目录；全齐才生成整体通过报告。
        import json
        index = json.loads((ROOT/'public/data'/EXPANSION_CONFIG.index_name).read_text())
        if index['status'] == 'complete':
            from build_expansion_cases import build_validation
            build_validation()
    except Exception as error:
        print('STOP:', error, file=sys.stderr, flush=True)
        sys.exit(1)
