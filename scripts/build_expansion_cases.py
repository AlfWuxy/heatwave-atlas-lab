#!/usr/bin/env python3
"""离线校验并构建新增三十地，不触及原十地索引或原始资料。"""
import json
from fetch_extended_cases import EXPANSION_CONFIG, ROOT, now, save, sha, times_for
from build_extended_cases import build_case, build_index


def build_validation():
    config = EXPANSION_CONFIG
    catalog_bytes = (config.data/'catalog.json').read_bytes()
    catalog = json.loads(catalog_bytes)['cases']
    index = json.loads((ROOT/'public/data'/config.index_name).read_text())
    if len(catalog) != 30 or index['status'] != 'complete' or len(index['cases']) != 30:
        raise ValueError('三十例未完整，不能生成通过的总体验证报告')
    case_reports, failures, warnings = [], [], []
    total_hours, missing, raw_bytes, derived_bytes = 0, 0, 0, 0
    for case in catalog:
        manifest = json.loads((config.data/case['id']/'manifest.json').read_text())
        if manifest['status'] != 'complete' or len(manifest['requests']) != 3:
            raise ValueError('案例未完整')
        if manifest['catalogSha256'] != sha(catalog_bytes) or manifest['builtCatalogSha256'] != sha(catalog_bytes) or manifest['caseSpecification'] != case:
            raise ValueError('目录或案例溯源不一致')
        for entry in [*manifest['requests'], *manifest['artifacts']]:
            payload = (ROOT/entry['path']).read_bytes()
            if sha(payload) != entry['sha256'] or len(payload) != entry['bytes']:
                raise ValueError('原始/派生文件哈希或大小不一致')
        if json.loads((ROOT/'public/data'/f"regional-{case['id']}-manifest.json").read_text()) != manifest:
            raise ValueError('公开溯源清单与本地不一致')
        hours = manifest['validation']['frameCount']
        total_hours += hours
        raw_bytes += sum(entry['bytes'] for entry in manifest['requests'])
        derived_bytes += sum(entry['bytes'] for entry in manifest['artifacts'])
        for entry in manifest['requests']:
            missing += sum(v['missing'] for point in entry['validation']['ranges'] for v in point['variables'].values())
        for error in manifest['errors']:
            failures.append(dict(caseId=case['id'], recovered=manifest['status']=='complete', **error))
        for warning in manifest['qualityWarnings']:
            warnings.append(dict(caseId=case['id'], **warning))
        case_reports.append(dict(caseId=case['id'], hours=hours, gridPoints=25, rawResponses=3,
                                 qualityStatus=manifest['qualityStatus'], qualityWarnings=manifest['qualityWarnings'],
                                 rawSha256Verified=True, derivedSha256Verified=True, catalogAndSpecificationVerified=True))
    expected_hours = sum(len(times_for(c['start'], c['end'])) for c in catalog)
    if total_hours != expected_hours:
        raise ValueError('实际点位小时数与冻结目录不一致')
    report = dict(schemaVersion=1, status='complete', passed=missing==0, validatedAt=now(), catalogSha256=sha(catalog_bytes),
                  actualCases=len(case_reports), rawResponses=sum(c['rawResponses'] for c in case_reports),
                  singlePointHours=total_hours, singlePointVariableValues=total_hours*10,
                  regionalGridPoints=len(case_reports)*25, regionalGridHours=total_hours*25,
                  regionalVariableValues=total_hours*25*3, smokeGridHours=len(case_reports)*2*24,
                  missingValues=missing, flaggedCases=len({w['caseId'] for w in warnings}),
                  flaggedValues=sum(w['count'] for w in warnings), qualityWarnings=warnings,
                  allRawSha256Verified=True, allDerivedSha256Verified=True, allPublicManifestsMatch=True,
                  originalResponseBytes=raw_bytes, derivedArtifactBytes=derived_bytes,
                  failureRecords=len(failures), recoveredFailureRecords=sum(e['recovered'] for e in failures), failures=failures,
                  cases=case_reports,
                  interpretation='passed表示完整性及溯源检查通过；物理范围外小负含水量仍保留质量标记，不能解释为有效负水量。')
    save(config.data/'validation.json', report)
    save(ROOT/'public/data/expansion-validation.json', report)
    print('VALIDATED', len(case_reports), 'cases,', total_hours, 'point hours,', report['flaggedValues'], 'flagged values')
    return report


def main():
    catalog = json.loads((EXPANSION_CONFIG.data/'catalog.json').read_text())['cases']
    if len(catalog) != 30 or len({c['id'] for c in catalog}) != 30:
        raise ValueError('新增目录必须恰有30个不同案例')
    for case in catalog:
        build_case(case, EXPANSION_CONFIG)
    build_index(EXPANSION_CONFIG)
    build_validation()


if __name__ == '__main__':
    main()
