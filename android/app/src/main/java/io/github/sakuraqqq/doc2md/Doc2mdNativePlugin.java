package io.github.sakuraqqq.doc2md;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CoderResult;
import java.security.MessageDigest;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.List;

// doc2md 原生插件骨架（卡 008 / A7）—— 目的是证明「逐环节替换原生」（Strangler Fig）这条路能走通一次，
// 而不是"跑通了一次"。它是**直接写进原生工程**的插件：Capacitor 的 native runtime 会把已加载插件导出到
// window.Capacitor.Plugins，所以 Web 侧一行都不用打包、index.html 一字不动（卡 008 的 A8 越界闸）。
//
// 三个方法 = 三级证据：
//   echo()     存活探针：桥 + 注册都对才通（排障第一步；它不通，后面都不用查）
//   pickFile() 对应 A2「选文件走安卓原生选择器（SAF）」—— 若 WebView 自带的 <input type=file> 不够用，
//              这个环节就用它替换
//   saveText() 对应 A4「保存到用户可见位置」—— 写到 MediaStore 的 Downloads，文件管理器里能直接看到
//   beginBinary() / appendBinary() / endBinary()（卡 055）—— A4 的**二进制**出口：分块写 zip 等字节产物，
//              过桥瞬时内存为常数级（整块 base64 会随载荷线性放大，见下方会话状态处的说明）
//
// 卡 008 的 A4 实测为红：页面上的 <a download> 在 Capacitor WebView 里**静默无反应**，源码级根因是
// com/getcapacitor/** 里根本没有 DownloadListener / onDownloadStart（整个桥都不接手下载）。
// 而本插件的 saveText() 走原生 MediaStore 就能落盘 —— 这就是"同一个环节、换原生实现"的证明。
//
// load() 里的 SELFTEST 是**阶段 0 的临时验证钩子**（阶段 1 必须拆掉）：因为真机侧的 WebView DevTools
// 通道（chrome://inspect / adb forward）在本机环境走不通，所以让插件在加载时自证一次"原生写 Downloads"，
// 结果打进 logcat（tag=Doc2mdNative，行首 SELFTEST_OK / SELFTEST_FAIL / SELFTEST_SKIP）。
// 用 SharedPreferences 做**一次性**标记，避免每次启动都往用户 Downloads 里丢文件。
//
// 注：本文件**故意只用 // 行注释**（不用 /* */ 块注释）——zh-CN Windows 上 javac 的默认编码可能不是
// UTF-8，块注释里的中文若被错位解码可能把 */ 吃掉导致编译失败；行注释没有这个风险。
// 所有**字符串字面量一律 ASCII**（面向开发者/控制台），进一步保证任何编码意外都不会产出乱码。
@CapacitorPlugin(name = "Doc2mdNative")
public class Doc2mdNativePlugin extends Plugin {

    private static final String TAG = "Doc2mdNative";
    private static final String PREFS = "doc2md";
    private static final String PREF_SELFTEST_DONE = "native_selftest_done";
    // 卡 044：保存落点 = Download/WenZhuanMD/（新建子目录，不再平铺在 Download 根）。
    // 两个 API 分支（29+ MediaStore / 24-28 公开目录）【共用】这一个目录名常量 —— 不许各写一份字面量。
    private static final String DOWNLOAD_SUBDIR = "WenZhuanMD";

    // ── 卡 055（P1=A · zip 原生接线）：二进制分块写入的会话状态 ──────────────────────────
    // 为什么分块而不是整块 base64：卡 055 的 B2 在真机上**测不出载荷项**（1.06 MB 载荷的增量被浮层
    // 重绘的 ±10 MB 噪声吞掉）⇒ 按卡面预登记规则 R3 取保守侧 —— 把"过桥"的瞬时内存做成**常数级**，
    // 而不是随 zip 字节线性放大（整块 base64 在契约上限 20 MB 时要在同一进程里同时在场约 5 份副本）。
    // 会话只活在一次 begin…end 之间；插件是单 Activity 实例，不需要跨实例共享。
    private OutputStream binOut;
    private Uri binUri;
    private File binFile;
    private String binName;
    private long binBytes;

    // 阶段 0 临时验证钩子（阶段 1 拆）：插件加载即自测一次"写 Downloads"，把结果打进 logcat。
    @Override
    public void load() {
        runSelftestOnce();
        // 卡 059 退回（F6）：冷启动的 launch intent 在这里**只发起一次后台读取**；紧接着 BridgeActivity.load()
        // 会把它再交给 handleOnNewIntent（8.5.2 L51）—— startOpenRead 按「action+uri」去重，保证只读一次。
        try {
            Activity act = getActivity();
            startOpenRead(act == null ? null : act.getIntent());
        } catch (Throwable t) {
            Log.w(TAG, "PENDING_LAUNCH_FAIL " + t);
        }
    }

    // 阶段 0 的临时验证钩子（卡 008）：只跑一次，结果打进 logcat。
    private void runSelftestOnce() {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (sp.getBoolean(PREF_SELFTEST_DONE, false)) {
                Log.i(TAG, "SELFTEST_SKIP already done");
                return;
            }
            JSObject r = writeTextToDownloads("doc2md-native-selftest.md", "# native selftest\n", "text/markdown");
            sp.edit().putBoolean(PREF_SELFTEST_DONE, true).apply();
            Log.i(TAG, "SELFTEST_OK " + r.toString());
        } catch (Throwable t) {
            Log.e(TAG, "SELFTEST_FAIL " + t);
        }
    }

    // 存活探针：返回 SDK 级别与包名，用来一眼确认"插件真的被注册进桥了"。
    @PluginMethod
    public void echo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("msg", call.getString("msg", ""));
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        ret.put("pkg", getContext().getPackageName());
        ret.put("plugin", "Doc2mdNative");
        ret.put("impl", "stage0-skeleton");
        call.resolve(ret);
    }

    // A2 环节：用 SAF（ACTION_OPEN_DOCUMENT）选文件，返回 content:// URI + 显示名 + 字节数。
    @PluginMethod
    public void pickFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "pickFileResult");
    }

    @ActivityCallback
    private void pickFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Intent data = result.getData();
        Uri uri = (data == null) ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.reject("cancelled or no file selected");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ContentResolver cr = getContext().getContentResolver();
        Cursor cursor = null;
        try {
            cursor = cr.query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIdx >= 0 && !cursor.isNull(nameIdx)) {
                    ret.put("name", cursor.getString(nameIdx));
                }
                if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
                    ret.put("size", cursor.getLong(sizeIdx));
                }
            }
        } catch (Exception e) {
            ret.put("metaError", String.valueOf(e.getMessage()));
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        ret.put("note", "SAF content:// URI (read grant is valid for this session)");
        call.resolve(ret);
    }

    // ── 卡 059（B018 / A7.6-A7）：用本 App 打开 .md ─────────────────────────────────
    // 冷启动：BridgeActivity.load() 建完 bridge 立刻把 launch intent 交给 onNewIntent
    //（@capacitor/android 8.5.2 BridgeActivity.java L51）⇒ 本插件在 load() 与 handleOnNewIntent 都**只暂存**，
    // JS 启动后 consumePendingOpen() 取一次；热启动再发一条 notifyListeners 让已订阅的 JS 立刻来取。
    // ⛔ 不引 @capacitor/app：现有插件就能收（Bridge.java L1314 → Plugin.handleOnNewIntent）。
    // 上限 = 50 MB，与 AGENTS.md §2 的单文件护栏同口径（A7 的 4 MB 是**渲染**口径，不是读取口径）。
    private static final long MAX_OPEN_BYTES = 50L * 1024 * 1024;
    // 卡 059 第三轮（C1）：bridge 只送预览 —— 裁到 JS 的 4 Mi 字符硬限；只读 16 MB 字节即可解出足够字符。
    private static final int MAX_PREVIEW_CHARS = 4 * 1024 * 1024;
    private static final int PREVIEW_READ_BYTES = 16 * 1024 * 1024;
    // A7c：暂定 1 MiB（UTF-8 字节），超限提示改用「下载原文」。
    private static final int COPY_MAX_BYTES = 1024 * 1024;
    // F6/F19：pending 与 reading 共用锁；openSeq = 单调 generation，只有最新请求能写结果。
    private final Object openLock = new Object();
    private JSObject pendingOpen;
    private boolean openReading;
    private String openRequestKey;
    private int openSeq;
    private Uri pendingUri;
    private String pendingName;
    private String pendingMime;
    private long pendingSize;
    private boolean pendingSizeKnown;
    private boolean pendingTruncated;
    private String pendingPreviewText;

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        startOpenRead(intent);
    }

    /** F6：同一个 intent 可能被 load() 与 onNewIntent 各交付一次 ⇒ 按「action+uri」去重，只读一次。 */
    private void startOpenRead(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) {
            return;
        }
        final String key = intent.getData().toString();
        final int seq;
        synchronized (openLock) {
            if (key.equals(openRequestKey) && (openReading || pendingOpen != null)) {
                return;
            }
            openRequestKey = key;
            openReading = true;
            openSeq += 1;
            seq = openSeq;
            pendingOpen = null;
            clearActionStateLocked();
            raceLog("OPEN_REQUEST seq=" + seq + " name=" + shortUri(intent.getData()));
        }
        // 读取放到后台线程（冷启动不卡主线程）；只有最新 generation 能写结果（F19：后完成者不得覆盖新请求）。
        // JS 侧 consumePendingOpen 在 reading=true 时退避重试（≤10 s：40 × 250 ms）。
        new Thread(() -> {
            JSObject data = null;
            try {
                data = readOpenIntent(intent, seq);
            } catch (Throwable t) {
                Log.w(TAG, "OPEN_INTENT_FAIL " + t);
            }
            boolean latest;
            boolean okPayload = data != null && data.has("text") && !data.has("error");
            synchronized (openLock) {
                latest = seq == openSeq;
                if (latest) {
                    raceLog("OPEN_COMMIT seq=" + seq + " name=" + shortUri(intent.getData())
                            + " ok=" + okPayload);
                    pendingOpen = data;
                    if (okPayload) {
                        // G8：动作状态与 pendingOpen 在同一把锁里、且仅最新 generation 提交（避免界面 B、下载 A）。
                        pendingUri = Uri.parse(data.optString("uri", ""));
                        pendingName = data.optString("name", null);
                        pendingMime = data.optString("mime", null);
                        pendingSize = data.optLong("size", -1);
                        pendingSizeKnown = data.optBoolean("sizeKnown", false);
                        pendingTruncated = data.optBoolean("truncated", false);
                        pendingPreviewText = data.optString("text", null);
                    } else {
                        clearActionStateLocked();
                    }
                    openReading = false;
                } else {
                    raceLog("OPEN_DROP seq=" + seq + " reason=stale name=" + shortUri(intent.getData()));
                }
            }
            if (latest && data != null) {
                final JSObject ping = new JSObject();
                ping.put("pending", true);
                try {
                    getActivity().runOnUiThread(() -> notifyListeners("doc2mdOpen", ping, false));
                } catch (Throwable ignored) {
                }
            }
        }, "doc2md-open").start();
    }

    private boolean isDebuggable() {
        try {
            return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    /** 卡 059 / Z9-16：debug 变体把竞态证据写到外部 files/race/native.log（ROM 会丢 app 日志）。 */
    private void raceLog(String line) {
        if (!isDebuggable()) {
            return;
        }
        try {
            File dir = getContext().getExternalFilesDir("race");
            if (dir == null) {
                return;
            }
            if (!dir.exists() && !dir.mkdirs()) {
                return;
            }
            File f = new File(dir, "native.log");
            try (FileOutputStream os = new FileOutputStream(f, true)) {
                os.write((System.currentTimeMillis() + " " + line + "\n").getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {
        }
    }

    private static String shortUri(Uri uri) {
        if (uri == null) {
            return "";
        }
        String last = uri.getLastPathSegment();
        String q = uri.getQueryParameter("name");
        return q != null ? q : (last == null ? "?" : last);
    }

    /** 动作状态只在 openLock 内改；错误/新请求都要清（G8）。 */
    private void clearActionStateLocked() {
        pendingUri = null;
        pendingName = null;
        pendingMime = null;
        pendingSize = -1;
        pendingSizeKnown = false;
        pendingTruncated = false;
        pendingPreviewText = null;
    }

    // JS 启动/热启动后主动取一次；取走即清（避免下次启动重复打开旧文件）。
    @PluginMethod
    public void consumePendingOpen(PluginCall call) {
        JSObject out;
        boolean reading;
        synchronized (openLock) {
            out = pendingOpen;
            pendingOpen = null;
            reading = openReading;
        }
        if (out == null) {
            JSObject none = new JSObject();
            none.put("pending", false);
            none.put("reading", reading);
            call.resolve(none);
            return;
        }
        call.resolve(out);
    }

    private JSObject readOpenIntent(Intent intent, int seq) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return null;
        }
        Uri uri = intent.getData();
        if (uri == null) {
            return null;
        }
        JSObject ret = new JSObject();
        ret.put("pending", true);
        ret.put("seq", seq);
        ret.put("uri", uri.toString());
        ContentResolver cr = getContext().getContentResolver();
        String name = null;
        long size = -1;
        Cursor cursor = null;
        try {
            cursor = cr.query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIdx >= 0 && !cursor.isNull(nameIdx)) {
                    name = cursor.getString(nameIdx);
                }
                if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
                    size = cursor.getLong(sizeIdx);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "OPEN_QUERY_FAIL " + e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        if (name == null || name.isEmpty()) {
            name = uri.getLastPathSegment();
        }
        if (name == null || name.isEmpty()) {
            name = "opened.md";
        }
        ret.put("name", name);
        String mime = null;
        try {
            mime = cr.getType(uri);
        } catch (Exception e) {
            Log.w(TAG, "OPEN_MIME_FAIL " + e);
        }
        ret.put("mime", mime == null ? "" : mime);
        if (size > MAX_OPEN_BYTES) {
            ret.put("size", size);
            ret.put("error", "too_large");
            return ret;
        }
        byte[] bytes;
        try {
            bytes = readPrefix(cr, uri, PREVIEW_READ_BYTES);
        } catch (SecurityException e) {
            ret.put("error", "no_access");
            return ret;
        } catch (Exception e) {
            Log.w(TAG, "OPEN_READ_FAIL " + e);
            ret.put("error", "read_failed");
            return ret;
        }
        if (bytes == null) {
            ret.put("error", "read_failed");
            return ret;
        }
        if (bytes.length == 0) {
            ret.put("size", 0);
            ret.put("error", "empty");
            return ret;
        }
        boolean moreBytes = size < 0 ? bytes.length >= PREVIEW_READ_BYTES : size > bytes.length;
        String text;
        try {
            text = decodeUtf8(bytes, !moreBytes);
        } catch (CharacterCodingException e) {
            ret.put("error", "binary");
            return ret;
        }
        if (text.indexOf((char) 0) >= 0) {
            ret.put("error", "binary");
            return ret;
        }
        int chars = text.length();
        boolean truncated = moreBytes || chars > MAX_PREVIEW_CHARS;
        String preview = text;
        if (chars > MAX_PREVIEW_CHARS) {
            preview = text.substring(0, MAX_PREVIEW_CHARS);
            if (preview.length() > 0) {
                char last = preview.charAt(preview.length() - 1);
                if (last >= 0xD800 && last <= 0xDBFF) {
                    preview = preview.substring(0, preview.length() - 1);
                }
            }
        }
        long sizeOut = size > 0 ? size : bytes.length;
        ret.put("size", sizeOut);
        ret.put("sizeKnown", size > 0);
        ret.put("truncated", truncated);
        ret.put("chars", chars);
        ret.put("previewChars", preview.length());
        ret.put("text", preview);
        int bytesSent = preview.getBytes(StandardCharsets.UTF_8).length;
        Log.i(TAG, "OPEN_PREVIEW thread=" + Thread.currentThread().getName()
                + " bytes_read=" + bytes.length + " chars=" + chars
                + " bytes_sent=" + bytesSent + " chars_sent=" + preview.length()
                + " truncated=" + truncated);
        return ret;
    }

    /** A7b：原文下载 —— 按 URI 流式写 Downloads，全文不过 bridge；成功态校验字节数（G9）。 */
    @PluginMethod
    public void savePendingOriginal(PluginCall call) {
        final Uri uri;
        final String name;
        final String mime;
        final long expected;
        final boolean sizeKnown;
        synchronized (openLock) {
            uri = pendingUri;
            name = pendingName;
            mime = pendingMime;
            expected = pendingSize;
            sizeKnown = pendingSizeKnown;
        }
        if (uri == null) {
            call.reject("no pending file");
            return;
        }
        new Thread(() -> {
            try {
                String[] actual = new String[1];
                long bytes = copyUriToDownloads(uri, name == null ? "opened.md" : name, mime,
                        sizeKnown ? expected : -1, actual);
                JSObject r = new JSObject();
                r.put("bytes", bytes);
                r.put("expected", sizeKnown ? expected : -1);
                r.put("filename", actual[0] != null ? actual[0] : name);
                raceLog("SAVE_ORIGINAL name=" + shortUri(uri) + " filename=" + actual[0]
                        + " bytes=" + bytes + " expected=" + (sizeKnown ? expected : -1) + " pendingCleared=1");
                call.resolve(r);
            } catch (Exception e) {
                Log.w(TAG, "SAVE_ORIGINAL_FAIL " + e);
                raceLog("SAVE_ORIGINAL_FAIL name=" + shortUri(uri) + " reason=" + e.getMessage());
                call.reject("save original failed: " + e);
            }
        }, "doc2md-save").start();
    }

    /** 卡 059 / Z9-16：debug-only —— JS 把查看器实际状态写进 race 日志（R1 的确定性 oracle）。 */
    @PluginMethod
    public void raceViewerState(PluginCall call) {
        if (!isDebuggable()) {
            call.resolve();
            return;
        }
        String name = call.getString("name", "");
        String mode = call.getString("mode", "");
        boolean truncated = Boolean.TRUE.equals(call.getBoolean("truncated", false));
        raceLog("VIEWER_STATE name=" + name + " mode=" + mode + " truncated=" + truncated);
        call.resolve();
    }

    /** A7c：原文复制 —— 原生剪贴板；>1 MiB 或已截断拒绝；写后 getPrimaryClip 回读自检（A7c 粘贴回读）。 */
    @PluginMethod
    public void copyPendingOriginal(PluginCall call) {
        String text;
        boolean truncated;
        Uri actionUri;
        synchronized (openLock) {
            text = pendingPreviewText;
            truncated = pendingTruncated;
            actionUri = pendingUri;
        }
        JSObject r = new JSObject();
        if (text == null) {
            r.put("copied", false);
            r.put("reason", "no_pending");
            call.resolve(r);
            return;
        }
        if (truncated) {
            r.put("copied", false);
            r.put("reason", "too_large");
            call.resolve(r);
            return;
        }
        int bytes = text.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > COPY_MAX_BYTES) {
            r.put("copied", false);
            r.put("reason", "too_large");
            r.put("bytes", bytes);
            call.resolve(r);
            return;
        }
        try {
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("doc2md", text));
            boolean verified = false;
            try {
                ClipData clip = cm.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence pasted = clip.getItemAt(0).getText();
                    verified = pasted != null && text.contentEquals(pasted);
                }
            } catch (Exception ignored) {
            }
            r.put("copied", true);
            r.put("verified", verified);
            r.put("chars", text.length());
            raceLog("COPY_ORIGINAL name=" + shortUri(actionUri) + " chars=" + text.length() + " verified=" + verified);
            raceLog("CLIP_SHA=" + sha256Hex(text));
            call.resolve(r);
        } catch (Exception e) {
            r.put("copied", false);
            r.put("reason", "failed");
            call.resolve(r);
        }
    }

    private long copyUriToDownloads(Uri src, String name, String mime, long expected, String[] actualName)
            throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        InputStream in = cr.openInputStream(src);
        if (in == null) {
            throw new Exception("openInputStream returned null");
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOAD_SUBDIR);
                values.put(MediaStore.Downloads.MIME_TYPE,
                        mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri target = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (target == null) {
                    throw new Exception("MediaStore insert returned null");
                }
                try {
                    OutputStream out = cr.openOutputStream(target);
                    if (out == null) {
                        throw new Exception("openOutputStream returned null");
                    }
                    long bytes = 0;
                    try {
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            out.write(buf, 0, n);
                            bytes += n;
                        }
                    } finally {
                        try {
                            out.close();
                        } catch (Exception ignored) {
                        }
                    }
                    if (expected >= 0 && bytes != expected) {
                        throw new Exception("size mismatch: written=" + bytes + " expected=" + expected);
                    }
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.Downloads.IS_PENDING, 0);
                    if (cr.update(target, done, null, null) <= 0) {
                        throw new Exception("update IS_PENDING failed");
                    }
                    String real = queryDisplayName(cr, target);
                    actualName[0] = real == null ? "" : real;
                    return bytes;
                } catch (Exception e) {
                    // G9：失败必须回滚，不能留半截/待发布行。
                    try {
                        cr.delete(target, null, null);
                    } catch (Exception ignored) {
                    }
                    throw e;
                }
            }
            File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), DOWNLOAD_SUBDIR);
            if (!dir.exists() && !dir.mkdirs()) {
                throw new Exception("mkdirs failed");
            }
            File f = new File(dir, name);
            long bytes = 0;
            try {
                OutputStream out = new FileOutputStream(f);
                try {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        bytes += n;
                    }
                } finally {
                    try {
                        out.close();
                    } catch (Exception ignored) {
                    }
                }
                if (expected >= 0 && bytes != expected) {
                    throw new Exception("size mismatch: written=" + bytes + " expected=" + expected);
                }
            } catch (Exception e) {
                if (f.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
                throw e;
            }
            actualName[0] = name;
            return bytes;
        } finally {
            try {
                in.close();
            } catch (Exception ignored) {
            }
        }
    }

    // MediaStore 插入后的**真实**显示名（重名会被改成 "x.zip (1)"）；
    // F7：查不到返回 null（⛔ 退回请求名冒充真实名）—— 调用方据此**不写历史记录**。
    private String queryDisplayName(ContentResolver cr, Uri uri) {
        Cursor c = null;
        try {
            c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && !n.isEmpty()) {
                    return n;
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) {
                c.close();
            }
        }
        return null;
    }

    private static String sha256Hex(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception e) {
            return "ERR";
        }
    }

    private byte[] readPrefix(ContentResolver cr, Uri uri, int limit) throws Exception {
        InputStream in = cr.openInputStream(uri);
        if (in == null) {
            throw new Exception("openInputStream returned null");
        }
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16 * 1024];
            int n;
            while (out.size() < limit) {
                int want = Math.min(buf.length, limit - out.size());
                n = in.read(buf, 0, want);
                if (n == -1) {
                    break;
                }
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        } finally {
            try {
                in.close();
            } catch (Exception ignored) {
            }
        }
    }

    private String decodeUtf8(byte[] bytes, boolean endOfInput) throws CharacterCodingException {
        CharsetDecoder dec = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        ByteBuffer in = ByteBuffer.wrap(bytes);
        CharBuffer out = CharBuffer.allocate(Math.max(16, bytes.length + 16));
        while (true) {
            CoderResult r = dec.decode(in, out, endOfInput);
            if (r.isOverflow()) {
                CharBuffer bigger = CharBuffer.allocate(out.capacity() * 2);
                out.flip();
                bigger.put(out);
                out = bigger;
                continue;
            }
            if (r.isError()) {
                r.throwException();
            }
            break;
        }
        if (endOfInput) {
            CoderResult r = dec.flush(out);
            if (r.isError()) {
                r.throwException();
            }
        }
        out.flip();
        return out.toString();
    }

    // A4 环节：把文本写到**用户可见**的 Downloads。
    @PluginMethod
    public void saveText(PluginCall call) {
        String filename = call.getString("filename", "doc2md-output.txt");
        String text = call.getString("text", "");
        String mime = call.getString("mime", "text/plain");
        try {
            call.resolve(writeTextToDownloads(filename, text, mime));
        } catch (Exception e) {
            call.reject("saveText failed: " + e);
        }
    }

    // 卡 055（P1=A · zip 原生接线）第 1 步：在 Download/WenZhuanMD/ 里先建一行。
    // API 29+ 走 MediaStore 且 IS_PENDING=1（提交前用户在文件管理器里**看不到半成品**）；
    // API 24-28 退化为公开目录直写（与 writeTextToDownloads 同口径，失败如实抛错）。
    @PluginMethod
    public void beginBinary(PluginCall call) {
        String filename = call.getString("filename", "doc2md-output.zip");
        String mime = call.getString("mime", "application/octet-stream");
        abortBinaryQuietly();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(
                        MediaStore.Downloads.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOAD_SUBDIR);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                ContentResolver cr = getContext().getContentResolver();
                Uri target = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (target == null) {
                    throw new Exception("MediaStore insert returned null");
                }
                OutputStream os = cr.openOutputStream(target);
                if (os == null) {
                    cr.delete(target, null, null);
                    throw new Exception("openOutputStream returned null");
                }
                binUri = target;
                binOut = os;
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), DOWNLOAD_SUBDIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    Log.w(TAG, "SUBDIR_MKDIR_FAIL " + dir);
                }
                binFile = new File(dir, filename);
                binOut = new FileOutputStream(binFile);
            }
            binName = filename;
            binBytes = 0;
            JSObject ret = new JSObject();
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            abortBinaryQuietly();
            call.reject("beginBinary failed: " + e);
        }
    }

    // 第 2 步：写一块（base64 → 字节）。块大小由 Web 侧定（现为 512 KB ⇒ base64 约 0.68 MB），
    // 因此过桥的瞬时内存与 zip 总大小**无关**。
    @PluginMethod
    public void appendBinary(PluginCall call) {
        if (binOut == null) {
            call.reject("appendBinary failed: no open session");
            return;
        }
        try {
            byte[] chunk = Base64.decode(call.getString("data", ""), Base64.NO_WRAP);
            binOut.write(chunk);
            binBytes += chunk.length;
            JSObject ret = new JSObject();
            ret.put("bytes", binBytes);
            call.resolve(ret);
        } catch (Exception e) {
            abortBinaryQuietly();
            call.reject("appendBinary failed: " + e);
        }
    }

    // 第 3 步：收尾。commit=true ⇒ 提交（IS_PENDING=0）并回报**插入后的真实 DISPLAY_NAME**
    //（MediaStore 重名会改名成 "x.zip (1)" —— 卡 055 的 B3 要求回话用真实名，⛔ 不用请求名）；
    // commit=false ⇒ 关流 + 删掉半截行（失败/取消都不留垃圾）。
    @PluginMethod
    public void endBinary(PluginCall call) {
        if (binOut == null) {
            call.reject("endBinary failed: no open session");
            return;
        }
        boolean commit = Boolean.TRUE.equals(call.getBoolean("commit", Boolean.TRUE));
        try {
            binOut.flush();
        } catch (Exception e) {
            Log.w(TAG, "BINARY_FLUSH_WARN " + e);
        }
        try {
            binOut.close();
        } catch (Exception e) {
            Log.w(TAG, "BINARY_CLOSE_WARN " + e);
        }
        binOut = null;
        if (!commit) {
            discardPending();
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        try {
            if (binUri != null) {
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                if (getContext().getContentResolver().update(binUri, done, null, null) <= 0) {
                    // F7：提交失败不能留下「待发布」行 ⇒ 清理并抛错。
                    try {
                        getContext().getContentResolver().delete(binUri, null, null);
                    } catch (Exception ignored) {
                    }
                    binUri = null;
                    binBytes = 0;
                    throw new Exception("update IS_PENDING failed");
                }
            }
            String real = (binUri != null) ? queryDisplayName(binUri) : null;
            if (real == null) real = "";
            JSObject ret = new JSObject();
            ret.put("filename", real);
            ret.put("bytes", binBytes);
            if (binUri != null) {
                ret.put("uri", binUri.toString());
                ret.put("location", "Downloads/" + DOWNLOAD_SUBDIR + " (MediaStore, user-visible)");
            } else {
                ret.put("path", binFile == null ? "" : binFile.getAbsolutePath());
                ret.put("location", "Downloads/" + DOWNLOAD_SUBDIR + " (legacy public dir)");
            }
            binUri = null;
            binFile = null;
            binName = null;
            binBytes = 0;
            call.resolve(ret);
        } catch (Exception e) {
            discardPending();
            call.reject("endBinary failed: " + e);
        }
    }

    // ===== 卡 060 / 2-5：转换历史库（app 私有 JSON · 原子写 · 逐条核验 · 打开/分享） =====
    // 数据面口径（2026-10-22 拍板）：filesDir/doc2md-history.json；schema v1 由 Web 侧（src/history-store.js）
    // 定义，原生只做四件事：读整份 JSON / 原子写整份 JSON / 逐条核验 uri / 报告 API 支持位。
    // 原子写 = tmp + fsync + rename；rename 失败时【旧文件保持原样】并返回 ok=false（⛔ 先删旧文件）。
    private boolean historyFailOnce = false;

    private File historyFile() {
        return new File(getContext().getFilesDir(), "doc2md-history.json");
    }

    private void writeHistoryAtomic(String json) throws Exception {
        File target = historyFile();
        File tmp = new File(target.getParentFile(), target.getName() + ".tmp");
        FileOutputStream fos = new FileOutputStream(tmp);
        try {
            fos.write(json.getBytes(StandardCharsets.UTF_8));
            fos.flush();
            fos.getFD().sync();
        } finally {
            fos.close();
        }
        if (!tmp.renameTo(target)) {
            throw new Exception("rename failed");
        }
    }

    @PluginMethod
    public void historySupport(PluginCall call) {
        int sdk = Build.VERSION.SDK_INT;
        JSObject ret = new JSObject();
        ret.put("supported", sdk >= Build.VERSION_CODES.Q);
        ret.put("sdkInt", sdk);
        ret.put("reason", sdk >= Build.VERSION_CODES.Q ? "" : "sdk<29");
        call.resolve(ret);
    }

    @PluginMethod
    public void historyLoad(PluginCall call) {
        File f = historyFile();
        JSObject ret = new JSObject();
        if (!f.exists()) {
            ret.put("ok", true);
            ret.put("json", "");
            call.resolve(ret);
            return;
        }
        try {
            byte[] data = new byte[(int) f.length()];
            FileInputStream in = new FileInputStream(f);
            try {
                int off = 0;
                while (off < data.length) {
                    int n = in.read(data, off, data.length - off);
                    if (n < 0) {
                        break;
                    }
                    off += n;
                }
            } finally {
                in.close();
            }
            ret.put("ok", true);
            ret.put("json", new String(data, StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void historySave(PluginCall call) {
        String json = call.getString("json", "");
        JSObject ret = new JSObject();
        if (historyFailOnce) {
            historyFailOnce = false;
            ret.put("ok", false);
            ret.put("error", "injected-write-failure");
            call.resolve(ret);
            return;
        }
        try {
            writeHistoryAtomic(json);
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    // debug-only：注入一次写失败（race-060 的 A1 负例）；release 为空操作。
    @PluginMethod
    public void historyFailNextWrite(PluginCall call) {
        if (isDebuggable()) {
            historyFailOnce = true;
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    // debug-only：seed N 条记录（race-060 的 200/201 矩阵用；⛔ 不碰任何下载文件）。
    @PluginMethod
    public void historySeed(PluginCall call) {
        JSObject ret = new JSObject();
        if (!isDebuggable()) {
            ret.put("ok", false);
            ret.put("error", "release");
            call.resolve(ret);
            return;
        }
        int count = call.getInt("count", 0);
        String uri = call.getString("uri", "");
        String kind = "zip".equals(call.getString("kind", "md")) ? "zip" : "md";
        long base = System.currentTimeMillis() - count * 1000L;
        StringBuilder sb = new StringBuilder();
        sb.append("{\"schemaVersion\":1,\"keepHistory\":true,\"records\":[");
        for (int i = 0; i < count; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"id\":\"seed-").append(i).append("\",\"name\":\"seed-").append(i)
                    .append(".md\",\"uri\":\"").append(uri).append("\",\"bytes\":").append(10 + i)
                    .append(",\"mime\":\"text/markdown\",\"kind\":\"").append(kind)
                    .append("\",\"createdAt\":").append(base + i).append('}');
        }
        sb.append("]}");
        try {
            writeHistoryAtomic(sb.toString());
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void historyCheck(PluginCall call) {
        // 逐条核验 uri 是否仍可打开：能打开 = 存在；FileNotFound = 不存在；
        // 其它异常（SecurityException / 超时类）≠ 不存在 ⇒ 返回 error 让 UI 显示「无法确认」。
        JSArray uris = call.getArray("uris");
        JSArray results = new JSArray();
        if (uris != null) {
            for (int i = 0; i < uris.length(); i++) {
                String s = uris.optString(i, "");
                JSObject item = new JSObject();
                item.put("uri", s);
                if (s.isEmpty()) {
                    item.put("exists", false);
                    results.put(item);
                    continue;
                }
                try {
                    android.content.res.AssetFileDescriptor afd =
                            getContext().getContentResolver().openAssetFileDescriptor(Uri.parse(s), "r");
                    if (afd != null) {
                        afd.close();
                    }
                    item.put("exists", true);
                } catch (java.io.FileNotFoundException e) {
                    item.put("exists", false);
                } catch (Exception e) {
                    item.put("error", String.valueOf(e.getClass().getSimpleName()));
                }
                results.put(item);
            }
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("results", results);
        call.resolve(ret);
    }

    // 卡 060 / A6：历史行点开 = 内置查看器；内容经 ContentResolver 读（⛔ 走 <a download> / 外域）。
    @PluginMethod
    public void readContentUri(PluginCall call) {
        String s = call.getString("uri", "");
        int maxChars = call.getInt("maxChars", 4 * 1024 * 1024);
        JSObject ret = new JSObject();
        try {
            Uri uri = Uri.parse(s);
            ContentResolver cr = getContext().getContentResolver();
            byte[] data = readPrefix(cr, uri, maxChars * 4 + 1);
            boolean truncated = data.length > maxChars * 4;
            byte[] use = truncated ? java.util.Arrays.copyOf(data, maxChars * 4) : data;
            String text = decodeUtf8(use, !truncated);
            if (text.length() > maxChars) {
                text = text.substring(0, maxChars);
                truncated = true;
            }
            ret.put("ok", true);
            ret.put("text", text);
            ret.put("bytes", use.length);
            ret.put("truncated", truncated);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openContentUri(PluginCall call) {
        String s = call.getString("uri", "");
        String mime = call.getString("mime", "*/*");
        JSObject ret = new JSObject();
        try {
            Uri uri = Uri.parse(s);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mime);
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            view.setClipData(ClipData.newRawUri("", uri));
            if (view.resolveActivity(getContext().getPackageManager()) == null) {
                ret.put("ok", false);
                ret.put("error", "no_app");
                call.resolve(ret);
                return;
            }
            startExternal(view);
            ret.put("ok", true);
            call.resolve(ret);
        } catch (android.content.ActivityNotFoundException e) {
            ret.put("ok", false);
            ret.put("error", "no_app");
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    private boolean forceShareNoApp = false;

    @PluginMethod
    public void shareContentUri(PluginCall call) {
        String s = call.getString("uri", "");
        String mime = call.getString("mime", "*/*");
        String name = call.getString("name", "");
        JSObject ret = new JSObject();
        try {
            Uri uri = Uri.parse(s);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            send.setClipData(ClipData.newRawUri(name, uri));
            // F4：先查有没有 SEND handler —— 没有就明说 no_app（⛔ 让 chooser 闪一下、异常分支不可达）。
            List<ResolveInfo> handlers = getContext().getPackageManager()
                    .queryIntentActivities(send, PackageManager.MATCH_DEFAULT_ONLY);
            if (forceShareNoApp || handlers == null || handlers.isEmpty()) {
                ret.put("ok", false);
                ret.put("error", "no_app");
                call.resolve(ret);
                return;
            }
            Intent chooser = Intent.createChooser(send, name.isEmpty() ? "Share" : name);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (isDebuggable()) {
                raceLog("SHARE uri=" + uri + " mime=" + mime
                        + " sendFlags=0x" + Integer.toHexString(send.getFlags())
                        + " chooserFlags=0x" + Integer.toHexString(chooser.getFlags())
                        + " clip=" + (send.getClipData() != null));
            }
            startExternal(chooser);
            ret.put("ok", true);
            call.resolve(ret);
        } catch (android.content.ActivityNotFoundException e) {
            ret.put("ok", false);
            ret.put("error", "no_app");
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    // F4 测试缝（仅 debug 包）：强制「没有分享应用」分支 —— 用于真机验证 no_app 的可见错误。
    @PluginMethod
    public void shareForceNoApp(PluginCall call) {
        if (!isDebuggable()) {
            call.reject("debug-only");
            return;
        }
        forceShareNoApp = call.getBoolean("on", false) == Boolean.TRUE;
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    private void startExternal(Intent intent) {
        Activity act = getActivity();
        if (act != null) {
            act.startActivity(intent);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
    }

    // 丢弃未提交的二进制会话：关流 + 删行/删文件。
    // ⚠️ IS_PENDING=1 的行**不删会留在库里**（用户看不见，但占空间且永远 pending）⇒ 必须清。
    private void abortBinaryQuietly() {
        if (binOut != null) {
            try {
                binOut.close();
            } catch (Exception e) {
                Log.w(TAG, "BINARY_CLOSE_WARN " + e);
            }
            binOut = null;
        }
        discardPending();
    }

    private void discardPending() {
        if (binUri != null) {
            try {
                getContext().getContentResolver().delete(binUri, null, null);
            } catch (Exception e) {
                Log.w(TAG, "BINARY_DELETE_WARN " + e);
            }
            binUri = null;
        }
        if (binFile != null) {
            if (binFile.exists() && !binFile.delete()) {
                Log.w(TAG, "BINARY_DELETE_FILE_FAIL " + binFile);
            }
            binFile = null;
        }
        binBytes = 0;
    }

    // MediaStore 插入后的**真实**显示名；F7：查不到返回 null（⛔ 退回请求名）。
    private String queryDisplayName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                    uri, new String[] {MediaStore.Downloads.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null) {
                    return name;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "DISPLAY_NAME_QUERY_FAIL " + e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return null;
    }

    // 页面被销毁时别把半截行留在库里（挂起行用户看不见，会一直 pending）。
    @Override
    public void handleOnDestroy() {
        abortBinaryQuietly();
        super.handleOnDestroy();
    }

    // 共享实现（saveText 与 load() 自测都走这里）。
    // API 29+（本项目真机是 Android 16）走 MediaStore.Downloads，无需任何存储权限；
    // API 24-28 退化为公共 Downloads 目录直写（那里需要 WRITE_EXTERNAL_STORAGE，本骨架不申请，
    // 失败时如实抛错 —— 阶段 0 的目标是"把环节替换出来"，权限策略留给阶段 1 拍板）。
    private JSObject writeTextToDownloads(String filename, String text, String mime) throws Exception {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        JSObject ret = new JSObject();
        ret.put("bytes", bytes.length);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            // 卡 044（A1/A2）：落点 = Download/WenZhuanMD/ —— 用【两分支共用常量】拼，不写字面量。
            // RELATIVE_PATH 是 API 29+ 的字段，而本分支正是 >= Q，故安全。
            values.put(
                    MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOAD_SUBDIR);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            ContentResolver cr = getContext().getContentResolver();
            Uri target = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (target == null) {
                throw new Exception("MediaStore insert returned null");
            }
            OutputStream os = null;
            try {
                os = cr.openOutputStream(target);
                if (os == null) {
                    throw new Exception("openOutputStream returned null");
                }
                os.write(bytes);
                os.flush();
            } finally {
                if (os != null) {
                    os.close();
                }
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.Downloads.IS_PENDING, 0);
            if (cr.update(target, done, null, null) <= 0) {
                // F7：提交失败 ⇒ 删掉待发布行并报错（⛔ 留半截行 + 假装成功）。
                try {
                    cr.delete(target, null, null);
                } catch (Exception ignored) {
                }
                throw new Exception("update IS_PENDING failed");
            }
            ret.put("uri", target.toString());
            // 卡 060 / A3：回报 MediaStore **插入后的真实 DISPLAY_NAME**（重名 = "x (1).md"），
            // ⛔ 不再用请求名冒充 —— 卡 011 登记的真机坑是「两次都显示 x.md，指向一个不存在的文件」。
            // F7：查不到 ⇒ 空名（调用方不写历史），⛔ 回退请求名。
            String realName = queryDisplayName(target);
            ret.put("filename", realName == null ? "" : realName);
            ret.put("location", "Downloads/" + DOWNLOAD_SUBDIR + " (MediaStore, user-visible)");
        } else {
            // 卡 044（A3）：API 24-28 走公开 Downloads 下的【子目录】—— 与 29+ 分支共用同一个常量。
            // 子目录可能不存在 ⇒ 先建；建不出来也不吞（后面的 FileOutputStream 会以真实异常暴露给 Web 侧）。
            File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), DOWNLOAD_SUBDIR);
            if (!dir.exists() && !dir.mkdirs()) {
                Log.w(TAG, "SUBDIR_MKDIR_FAIL " + dir);
            }
            File out = new File(dir, filename);
            FileOutputStream fos = null;
            try {
                fos = new FileOutputStream(out);
                fos.write(bytes);
                fos.flush();
            } finally {
                if (fos != null) {
                    fos.close();
                }
            }
            ret.put("path", out.getAbsolutePath());
            ret.put("filename", filename);
            ret.put("location", "Downloads/" + DOWNLOAD_SUBDIR + " (legacy public dir)");
        }
        return ret;
    }
}
