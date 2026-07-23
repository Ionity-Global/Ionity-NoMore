package za.co.ionity.nomore;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.ParcelUuid;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Collections;
import java.util.UUID;

/**
 * Anonymous Bluetooth closeness beacon for a connected safety circle.
 *
 * Both phones advertise and scan for a service UUID derived from the shared
 * circle id. The advertisement carries no device name, no address payload,
 * and no message content — only "a member of my circle is in radio range".
 * RSSI readings are forwarded to the web layer, which presents approximate
 * bands, never false precision.
 */
@CapacitorPlugin(
        name = "NoMoreNearby",
        permissions = {
                @Permission(
                        alias = "nearby",
                        strings = {
                                Manifest.permission.BLUETOOTH_SCAN,
                                Manifest.permission.BLUETOOTH_ADVERTISE,
                                Manifest.permission.BLUETOOTH_CONNECT
                        }
                ),
                @Permission(
                        alias = "nearbyLegacy",
                        strings = {Manifest.permission.ACCESS_FINE_LOCATION}
                )
        }
)
public class NoMoreNearbyPlugin extends Plugin {

    private BluetoothLeScanner scanner;
    private BluetoothLeAdvertiser advertiser;
    private ScanCallback scanCallback;
    private AdvertiseCallback advertiseCallback;

    private String permissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "nearby" : "nearbyLegacy";
    }

    @PluginMethod
    public void start(PluginCall call) {
        String serviceUuid = call.getString("serviceUuid");
        if (serviceUuid == null || serviceUuid.isEmpty()) {
            call.reject("serviceUuid is required");
            return;
        }
        if (getPermissionState(permissionAlias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(permissionAlias(), call, "nearbyPermissionCallback");
            return;
        }
        startNearby(call);
    }

    @PermissionCallback
    private void nearbyPermissionCallback(PluginCall call) {
        if (getPermissionState(permissionAlias()) == PermissionState.GRANTED) {
            startNearby(call);
        } else {
            call.reject("Nearby permission was not granted");
        }
    }

    private void startNearby(PluginCall call) {
        stopInternal();

        BluetoothManager manager =
                (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth is turned off");
            return;
        }

        UUID uuid;
        try {
            uuid = UUID.fromString(call.getString("serviceUuid"));
        } catch (IllegalArgumentException exception) {
            call.reject("serviceUuid is not a valid UUID");
            return;
        }
        ParcelUuid parcelUuid = new ParcelUuid(uuid);

        advertiser = adapter.getBluetoothLeAdvertiser();
        scanner = adapter.getBluetoothLeScanner();
        if (advertiser == null || scanner == null) {
            call.reject("This phone does not support Bluetooth LE beacons");
            return;
        }

        try {
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                    .setConnectable(false)
                    .build();
            AdvertiseData data = new AdvertiseData.Builder()
                    .addServiceUuid(parcelUuid)
                    .setIncludeDeviceName(false)
                    .setIncludeTxPowerLevel(true)
                    .build();
            advertiseCallback = new AdvertiseCallback() {
                @Override
                public void onStartFailure(int errorCode) {
                    JSObject failure = new JSObject();
                    failure.put("error", errorCode);
                    notifyListeners("scanFailed", failure);
                }
            };
            advertiser.startAdvertising(settings, data, advertiseCallback);

            ScanFilter filter = new ScanFilter.Builder().setServiceUuid(parcelUuid).build();
            ScanSettings scanSettings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build();
            scanCallback = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    JSObject reading = new JSObject();
                    reading.put("rssi", result.getRssi());
                    int txPower = Integer.MIN_VALUE;
                    if (result.getScanRecord() != null) {
                        txPower = result.getScanRecord().getTxPowerLevel();
                    }
                    reading.put("txPower", txPower);
                    notifyListeners("reading", reading);
                }

                @Override
                public void onScanFailed(int errorCode) {
                    JSObject failure = new JSObject();
                    failure.put("error", errorCode);
                    notifyListeners("scanFailed", failure);
                }
            };
            scanner.startScan(Collections.singletonList(filter), scanSettings, scanCallback);
            call.resolve();
        } catch (SecurityException exception) {
            stopInternal();
            call.reject("Nearby permission was revoked", exception);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
    }

    private void stopInternal() {
        try {
            if (scanner != null && scanCallback != null) {
                scanner.stopScan(scanCallback);
            }
            if (advertiser != null && advertiseCallback != null) {
                advertiser.stopAdvertising(advertiseCallback);
            }
        } catch (SecurityException ignored) {
            // Bluetooth was disabled mid-session; nothing left to stop.
        }
        scanner = null;
        scanCallback = null;
        advertiser = null;
        advertiseCallback = null;
    }
}
