package za.co.ionity.nomore;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.telephony.TelephonyManager;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Zero-permission device helpers.
 *
 * getCarrier() reads the SIM operator via TelephonyManager APIs that require
 * no runtime permission, and nothing is uploaded. openDialer() uses
 * ACTION_DIAL, which only pre-fills the dialer: the user must press call
 * themselves, so no CALL_PHONE permission exists in this app.
 * shareApp() hands this installed APK itself to the Android share sheet so
 * the app can spread phone-to-phone without any data connection.
 */
@CapacitorPlugin(name = "NoMoreDevice")
public class NoMoreDevicePlugin extends Plugin {

    @PluginMethod
    public void getCarrier(PluginCall call) {
        TelephonyManager telephony =
                (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        JSObject result = new JSObject();
        if (telephony == null) {
            result.put("available", false);
            call.resolve(result);
            return;
        }
        boolean simReady = telephony.getSimState() == TelephonyManager.SIM_STATE_READY;
        result.put("available", simReady);
        result.put("simOperator", telephony.getSimOperator());
        result.put("simOperatorName", telephony.getSimOperatorName());
        result.put("networkOperatorName", telephony.getNetworkOperatorName());
        call.resolve(result);
    }

    @PluginMethod
    public void openDialer(PluginCall call) {
        String code = call.getString("code", "");
        if (code == null || code.isEmpty()) {
            call.reject("A dial code is required");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(code)));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Could not open the dialer", exception);
        }
    }

    @PluginMethod
    public void shareApp(PluginCall call) {
        try {
            Context context = getContext();
            File source = new File(context.getApplicationInfo().sourceDir);
            File shareDir = new File(context.getCacheDir(), "share");
            if (!shareDir.exists() && !shareDir.mkdirs()) {
                call.reject("Could not prepare the share folder");
                return;
            }
            File shared = new File(shareDir, "Ionity-NoMore.apk");
            try (InputStream in = new FileInputStream(source);
                    OutputStream out = new FileOutputStream(shared)) {
                byte[] buffer = new byte[65536];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
            }
            Uri uri = FileProvider.getUriForFile(
                    context, context.getPackageName() + ".fileprovider", shared);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/vnd.android.package-archive");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, "Ionity NoMore");
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share Ionity NoMore");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);
            JSObject result = new JSObject();
            result.put("shared", true);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Could not share the app", exception);
        }
    }
}
