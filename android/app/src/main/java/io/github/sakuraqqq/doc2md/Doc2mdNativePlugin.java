package io.github.sakuraqqq.doc2md;

import android.app.Activity;
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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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
                getContext().getContentResolver().update(binUri, done, null, null);
            }
            String real = (binUri != null) ? queryDisplayName(binUri, binName) : binName;
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

    // MediaStore 插入后的**真实**显示名（重名会被改成 "x.zip (1)"）—— 查不到就退回请求名。
    private String queryDisplayName(Uri uri, String fallback) {
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
        return fallback;
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
            cr.update(target, done, null, null);
            ret.put("uri", target.toString());
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
            ret.put("location", "Downloads/" + DOWNLOAD_SUBDIR + " (legacy public dir)");
        }
        ret.put("filename", filename);
        return ret;
    }
}
