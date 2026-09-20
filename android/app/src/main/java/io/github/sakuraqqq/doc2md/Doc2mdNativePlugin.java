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
            ret.put("location", "Downloads (MediaStore, user-visible)");
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
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
            ret.put("location", "Downloads (legacy public dir)");
        }
        ret.put("filename", filename);
        return ret;
    }
}
