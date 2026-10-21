package io.github.sakuraqqq.doc2md;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 卡 059 / Z9-16：debug-only 的「可延迟 / 可短写 / pipe」夹具 provider。
 * URI: content://io.github.sakuraqqq.doc2md.racefixture/open?name=race-a.md&size=65543&delayMs=1500&shortWrite=0
 * 内容规则（脚本用同一规则算哈希）："RACE-<X>\n" + '<X>' * (size - headerLen)。
 */
public class RaceFixtureProvider extends ContentProvider {
    private static final String HEAD = "RACE-";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String name = nameOf(uri);
        int size = sizeOf(uri);
        MatrixCursor c = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
        c.addRow(new Object[] { name, (long) size });
        return c;
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
        final String name = nameOf(uri);
        final int size = sizeOf(uri);
        final int delayMs = intParam(uri, "delayMs", 0);
        final boolean shortWrite = intParam(uri, "shortWrite", 0) == 1;
        final byte[] data = build(name, size);
        raceLog("RACE_PROVIDER open name=" + name + " delayMs=" + delayMs + " mode=pipe");
        try {
            final ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
            Thread t = new Thread(() -> {
                try (ParcelFileDescriptor.AutoCloseOutputStream out =
                             new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                    if (delayMs > 0) {
                        try {
                            Thread.sleep(delayMs);
                        } catch (InterruptedException ignored) {
                        }
                    }
                    int len = shortWrite ? data.length / 2 : data.length;
                    out.write(data, 0, len);
                    out.flush();
                    raceLog("RACE_PROVIDER done name=" + name + " wrote=" + len + " shortWrite=" + shortWrite);
                } catch (IOException ignored) {
                }
            }, "race-fixture");
            t.start();
            return pipe[0];
        } catch (IOException e) {
            throw new FileNotFoundException(e.toString());
        }
    }

    private static String nameOf(Uri uri) {
        String n = uri.getQueryParameter("name");
        return n == null || n.isEmpty() ? "race-a.md" : n;
    }

    private static int sizeOf(Uri uri) {
        return intParam(uri, "size", 65543);
    }

    private static int intParam(Uri uri, String key, int def) {
        try {
            String s = uri.getQueryParameter(key);
            return s == null ? def : Integer.parseInt(s);
        } catch (Exception e) {
            return def;
        }
    }

    private static byte[] build(String name, int size) {
        char letter = 'A';
        int idx = name.lastIndexOf('-');
        if (idx >= 0 && idx + 1 < name.length()) {
            char c = Character.toUpperCase(name.charAt(idx + 1));
            if (c >= 'A' && c <= 'Z') {
                letter = c;
            }
        }
        byte[] head = (HEAD + letter + "\n").getBytes(StandardCharsets.UTF_8);
        int total = Math.max(head.length, size);
        byte[] out = new byte[total];
        System.arraycopy(head, 0, out, 0, head.length);
        for (int i = head.length; i < total; i++) {
            out[i] = (byte) letter;
        }
        return out;
    }

    private void raceLog(String line) {
        try {
            File dir = getContext().getExternalFilesDir("race");
            if (dir == null) {
                return;
            }
            if (!dir.exists() && !dir.mkdirs()) {
                return;
            }
            try (FileOutputStream os = new FileOutputStream(new File(dir, "native.log"), true)) {
                os.write((System.currentTimeMillis() + " " + line + "\n").getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {
        }
    }
}
