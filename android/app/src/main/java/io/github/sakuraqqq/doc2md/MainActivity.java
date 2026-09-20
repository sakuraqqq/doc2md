package io.github.sakuraqqq.doc2md;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 卡 008 / A7：把直接写在原生工程里的插件注册进桥 —— 注册后 runtime 会把它导出为
    // window.Capacitor.Plugins.Doc2mdNative，Web 侧无需打包任何东西（index.html 一字不动）。
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(Doc2mdNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
