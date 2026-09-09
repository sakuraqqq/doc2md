/* cjk.js —— 中文文本后处理（零依赖 / 无 DOM：可单独在 Node 里跑，便于真实样例核验）
 *
 * 2026-09-09（来源：真实样例——PPT 导出的「图片型 PDF」，无文字层 → 走 OCR）：
 *   tesseract 中文 OCR 会在相邻汉字之间插入词分空格（「湖南 新 晃 侗 族 自治 县」），
 *   文字层路径（pdfjs）没有这个问题——所以本模块**只作用于 OCR 文本**，不动文字层排版空格。
 *
 * 合并规则（仅行内；换行是排版信息，不跨行合并）：
 *   R1 CJK ↔ CJK          删除其间空白
 *   R2 CJK ↔ 中文标点（含 ASCII 括号）删除其间空白（「（ 二 ）」→「（二）」）
 *   R3 CJK ↔ ASCII 数字   删除其间空白（「提高 24 元」→「提高24元」）
 *   CJK ↔ 拉丁字母        保留（中英混排/英文单词不被打散：「AI 技术」不变）
 *   数字 ↔ 数字           保留（「8 10」不会被并成「810」）
 */
export const CJK_CLASS = '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af';
// 注意：类内 `[` `]` `{` `}` 必须转义，否则字符类会被提前闭合（2026-09-09 实测踩过：
// 未转义时第一条分支恒不匹配 → 合并静默失效，只有「数字+空格+CJK」生效）。
export const CJK_PUNCT_CLASS = '，。、；：！？（）《》「」『』【】〈〉·—…～\\(\\)\\[\\]\\{\\}%+';
const SPACE = '[ \\t\\u3000]+';
// 用 lookahead（不消费右侧字符）保证连续交替的空格一次全并（「人 工 智能」→「人工智能」）
const CJK_OCR_SPACE_RE = new RegExp(
  `([${CJK_CLASS}])${SPACE}(?=[${CJK_CLASS}${CJK_PUNCT_CLASS}0-9])|` +
    `([${CJK_PUNCT_CLASS}])${SPACE}(?=[${CJK_CLASS}${CJK_PUNCT_CLASS}])|` +
    `([0-9])${SPACE}(?=[${CJK_CLASS}])`,
  'g'
);

/** OCR 文本后处理：合并中文 OCR 的词分空格（纯函数；输入输出均为字符串） */
export function collapseCjkSpaces(text) {
  return String(text == null ? '' : text).replace(CJK_OCR_SPACE_RE, '$1$2$3');
}
