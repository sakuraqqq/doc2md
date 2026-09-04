// eslint.config.js — doc2md ESLint 9 扁平配置（防屎山 ③ 守门）
//
// 范围（白名单策略）：
//   - src/**/*.js   —— 主应用源码（t8 重构拆分后生效；index.html 内联 JS 不 lint）
//   - tools/**/*.mjs —— 开发/验证脚本
//   其余一律忽略：vendor/（第三方库）、langs/（语言包）、tests/（契约测试——由 node:test 自证，
//   测试脚本不受 lint 约束）、node_modules/、构建产物、.tmp/、browser-screenshots/。
//
// 规则：@eslint/js recommended + eslint-plugin-sonarjs（recommended）+ 复杂度守门：
//   - core complexity（圈复杂度）max 10
//   - sonarjs/cognitive-complexity（认知复杂度）threshold 15
//   冲突处理：eslint-config-prettier 置尾关闭与 Prettier 冲突的规则（配置冲突以 Prettier 输出为准）。
//
// 说明：eslint flat config 下插件版本为 eslint-plugin-sonarjs 4.2.0（configs.recommended 即 flat 格式）。
import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const COMMON = {
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  plugins: { sonarjs },
  rules: {
    ...js.configs.recommended.rules,
    ...sonarjs.configs.recommended.rules,
    // 复杂度守门（阈值：圈 ≤10、认知 ≤15）。
    // 设计：**warn**（不阻塞 lint 退出码）——超限函数清单与硬门禁由 `npm run metrics`
    // （tools/metrics.mjs，exit 1）承担；lint 负责静态错误（no-unused-vars 等）。
    // 历史超限清单见 docs/CODE-METRICS.md §3；重构（t8 后）应逐批清零。
    complexity: ['warn', { max: 10 }],
    'sonarjs/cognitive-complexity': ['warn', 15], // sonarjs 4.x schema：整数阈值
  },
};

export default [
  {
    ignores: [
      'node_modules/**',
      'vendor/**',
      'langs/**',
      'tests/**',
      '.tmp/**',
      'pastes/**',
      'browser-screenshots/**',
      'dist/**',
      'build/**',
      '*.log',
    ],
  },
  { files: ['src/**/*.js'], ...COMMON },
  { files: ['tools/**/*.mjs'], ...COMMON },
  prettier, // 关闭所有与 Prettier 冲突的规则（必须放最后）
];
