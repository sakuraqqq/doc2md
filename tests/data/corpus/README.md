# tests/data/corpus — 外部测试语料

与 `tests/data/` 下的合成样例（`sample.*`，manifest 字节锁）**分离**：
外部语料自带上游来源、固定提交、许可证副本与 SHA256 记录，不进 `gen-samples.mjs`。

## blns.txt — Big List of Naughty Strings

- **上游**：https://github.com/minimaxir/big-list-of-naughty-strings
- **固定提交**：`db33ec7`（master）
- **获取日期**：2026-09-05（GitHub Contents API 抓取，字节级核验）
- **许可**：MIT，Copyright (c) 2015-2020 Max Woolf——副本见同目录 `blns.LICENSE`
- **大小 / SHA256**：30,079 B / `e87d3889599277616e183d4cf806bdf5b8cc408636c9bbba2b0701a211d98f7e`
- **引入动机**：上游 README 名梗「useful for whenever your QA engineer walks into a bar」——即「测试工程师走进酒吧」的正式版本语料。
- **内容**：SQL 注入（`1;DROP TABLE users`）、XSS（`<script>alert(0)</script>`）、零宽/不可见 Unicode（U+200B 等）、Zalgo 文本、模板注入（Jinja2/Twig）、数字边界（`NaN`/`null`/`Infinity`）等用户输入破坏性字符串。
- **使用**：`tests/contract_v1.test.mjs` 契约组 N——静态完整性（大小/SHA/关键脏字符串）+ 浏览器 TXT 全量转换冒烟（实测：走 builtin 直通路径，约 24ms，脏字符串原样保留）。
- **升级口径**：升级语料 = 改口径——须同步 ① 本文件（提交号/大小/SHA）② 契约组 N1/N2 断言 ③ `docs/licenses.md`。

## 为什么不自己写

「测试工程师进酒吧」是段子，不是可维护的测试资产；BLNS 是同一精神下的工程化语料，
47k+ star、MIT、社区持续维护，直接固定提交复用即可（本目录即落地）。