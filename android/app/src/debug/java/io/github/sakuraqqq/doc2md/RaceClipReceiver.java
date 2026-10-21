package io.github.sakuraqqq.doc2md;

import android.content.BroadcastReceiver;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** 卡 059 / Z9-16：debug-only —— 读剪贴板并落 sha 到 files/race/clip.txt（shell 用 am broadcast 触发）。 */
public class RaceClipReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            CharSequence text = null;
            if (cm != null && cm.getPrimaryClip() != null && cm.getPrimaryClip().getItemCount() > 0) {
                text = cm.getPrimaryClip().getItemAt(0).getText();
            }
            String s = text == null ? "" : text.toString();
            String sha = sha256(s);
            File dir = context.getExternalFilesDir("race");
            if (dir == null) {
                return;
            }
            if (!dir.exists() && !dir.mkdirs()) {
                return;
            }
            String body = "CLIP_LEN=" + s.length() + "\nCLIP_SHA=" + sha + "\n";
            try (FileOutputStream os = new FileOutputStream(new File(dir, "clip.txt"))) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {
        }
    }

    private static String sha256(String text) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] d = md.digest(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
