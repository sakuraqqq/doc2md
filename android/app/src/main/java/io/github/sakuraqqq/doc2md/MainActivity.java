package io.github.sakuraqqq.doc2md;

import android.content.res.Configuration;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 卡 008 / A7：把直接写在原生工程里的插件注册进桥 —— 注册后 runtime 会把它导出为
    // window.Capacitor.Plugins.Doc2mdNative，Web 侧无需打包任何东西（index.html 一字不动）。
    //
    // 卡 057：
    //  A4 SplashScreen.installSplashScreen(this) **必须在 super.onCreate() 之前**（官方要求）；
    //     之后由 postSplashScreenTheme 把主题切到 @style/AppTheme。
    //  A5 EdgeToEdge.enable(this) 在 setContentView（由 super.onCreate 完成）**之前**调用，
    //     系统栏透明 + insets 分发给 WebView；Web 侧值由 SystemBars(insetsHandling=css) 注入。
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 卡 057 / A3 的取证点：系统切深浅色时 Activity **不得重建** ⇒ logcat 里 onCreate 只应出现一次。
        Log.i("Doc2mdShell", "onCreate savedInstanceState=" + (savedInstanceState == null ? "null" : "non-null"));
        SplashScreen.installSplashScreen(this);
        EdgeToEdge.enable(this);
        registerPlugin(Doc2mdNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // 卡 057 / A3 取证：manifest 声明了 configChanges=...|uiMode ⇒ 系统切深浅色时这里应被调用、Activity 不重建。
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean night = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        Log.i("Doc2mdShell", "onConfigurationChanged night=" + night);
    }
}
