package io.github.sakuraqqq.doc2md;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** 卡 059 / A15：debug-only 的「非 seekable」测试 provider（pipe），release 不声明。 */
public class PipeProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return "text/markdown";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        // 故障注入：release app 打开 ?fail=1 ⇒ openInputStream 抛异常 ⇒ read_failed（A6 第五类证据）。
        if ("1".equals(uri.getQueryParameter("fail"))) {
            throw new FileNotFoundException("injected failure (059/A6 read_failed)");
        }
        final byte[] data = buildData(uri);
        try {
            final ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
            Thread t = new Thread(() -> {
                try (ParcelFileDescriptor.AutoCloseOutputStream out =
                             new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                    int off = 0;
                    while (off < data.length) {
                        int n = Math.min(8192, data.length - off);
                        out.write(data, off, n);
                        off += n;
                    }
                } catch (IOException ignored) {
                }
            }, "pipe-provider");
            t.start();
            return pipe[0];
        } catch (IOException e) {
            throw new FileNotFoundException(e.toString());
        }
    }

    private static byte[] buildData(Uri uri) {
        String text = uri.getQueryParameter("text");
        if (text != null) {
            return text.getBytes(StandardCharsets.UTF_8);
        }
        int size = 0;
        try {
            String raw = uri.getQueryParameter("size");
            size = raw == null ? 0 : Integer.parseInt(raw);
        } catch (Exception ignored) {
        }
        byte[] head = "# PIPE-059\n".getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[head.length + Math.max(0, size)];
        System.arraycopy(head, 0, out, 0, head.length);
        for (int i = head.length; i < out.length; i++) {
            out[i] = 'P';
        }
        return out;
    }
}
