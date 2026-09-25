package io.github.husarp.lexling;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * The game takes the whole screen: the status bar and the navigation bar stay hidden and slide back in
 * on a swipe from the edge, then hide themselves again. A word game is read top to bottom and typed
 * into with the keyboard covering half the display, so those two strips are worth roughly two more
 * guess boxes.
 *
 * Drawing into the display cutout is deliberate. Without it the system simply blacks that strip out;
 * with it the page owns the full screen and keeps its own content clear of the camera, because the
 * cutout is reported to the page as env(safe-area-inset-top) and app/css/app.css pads the top bar and
 * the main column by exactly that much.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layout = getWindow().getAttributes();
            layout.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(layout);
        }
        hideSystemBars();
    }

    /** Android shows the bars again after some interactions (the keyboard, a swipe): hide them once more. */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat bars =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }
}
