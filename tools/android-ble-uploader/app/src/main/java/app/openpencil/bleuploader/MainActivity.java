package app.openpencil.bleuploader;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Collections;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final int BLE_PERMISSION_REQUEST = 101;
    private static final int FILE_CHOOSER_REQUEST = 102;
    private static final UUID SERVICE_UUID = UUID.fromString("a110207d-8f4d-559b-8e4a-4791892b127d");
    private static final UUID TRANSFER_UUID = UUID.fromString("a210207d-8f4d-559b-8e4a-4791892b127d");
    private static final UUID STATUS_UUID = UUID.fromString("a310207d-8f4d-559b-8e4a-4791892b127d");
    private static final UUID CLIENT_CONFIG_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final int DEFAULT_PAYLOAD_CHUNK_BYTES = 16;
    private static final int MAX_PAYLOAD_CHUNK_BYTES = 240;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic transferCharacteristic;
    private BluetoothGattCharacteristic statusCharacteristic;
    private boolean pendingConnect;
    private boolean scanning;
    private boolean connected;
    private File payloadFile;
    private FileOutputStream payloadOutput;
    private int payloadExpectedBytes;
    private int payloadWrittenBytes;
    private RandomAccessFile uploadInput;
    private int uploadOffset;
    private int uploadTotal;
    private int lastProgressBytes;
    private int payloadChunkBytes = DEFAULT_PAYLOAD_CHUNK_BYTES;
    private boolean uploading;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BluetoothManager manager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = manager == null ? null : manager.getAdapter();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            }
        });
        webView.addJavascriptInterface(new NativeBridge(), "OpenPencilNative");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int index = 0; index < count; index++) {
                    result[index] = data.getClipData().getItemAt(index).getUri();
                }
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != BLE_PERMISSION_REQUEST) return;
        boolean granted = true;
        for (int result : results) granted &= result == PackageManager.PERMISSION_GRANTED;
        if (granted && pendingConnect) startBleScan();
        else emitError("需要附近设备权限才能扫描 OpenPencil BLE");
        pendingConnect = false;
    }

    private boolean hasBlePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
                    && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestBlePermissions() {
        pendingConnect = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissions(
                    new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT},
                    BLE_PERMISSION_REQUEST);
        } else {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, BLE_PERMISSION_REQUEST);
        }
    }

    @SuppressLint("MissingPermission")
    private void startBleScan() {
        if (bluetoothAdapter == null) {
            emitError("这台手机不支持蓝牙");
            return;
        }
        if (!bluetoothAdapter.isEnabled()) {
            emitError("请先打开手机蓝牙");
            return;
        }
        if (connected) {
            emitEvent("connected", "已连接 OpenPencil BLE", -1, -1);
            return;
        }
        scanner = bluetoothAdapter.getBluetoothLeScanner();
        if (scanner == null) {
            emitError("无法启动 BLE 扫描，请重新打开蓝牙");
            return;
        }
        stopScan();
        scanning = true;
        emitEvent("status", "正在按 Service UUID 扫描设备…", -1, -1);
        ScanFilter filter = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE_UUID)).build();
        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        scanner.startScan(Collections.singletonList(filter), settings, scanCallback);
        mainHandler.postDelayed(() -> {
            if (!connected && scanning) {
                stopScan();
                emitError("没有发现 OpenPencil BLE，请确认设备未连接电脑");
            }
        }, 12000);
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (scanner != null && scanning) scanner.stopScan(scanCallback);
        scanning = false;
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            stopScan();
            emitEvent("status", "发现设备，正在连接…", -1, -1);
            gatt = result.getDevice().connectGatt(
                    MainActivity.this,
                    false,
                    gattCallback,
                    BluetoothDevice.TRANSPORT_LE);
        }

        @Override
        public void onScanFailed(int errorCode) {
            scanning = false;
            emitError("BLE 扫描失败：" + errorCode);
        }
    };

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onConnectionStateChange(BluetoothGatt nextGatt, int status, int newState) {
            if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                gatt = nextGatt;
                connected = true;
                payloadChunkBytes = DEFAULT_PAYLOAD_CHUNK_BYTES;
                nextGatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    nextGatt.setPreferredPhy(
                            BluetoothDevice.PHY_LE_2M_MASK,
                            BluetoothDevice.PHY_LE_2M_MASK,
                            BluetoothDevice.PHY_OPTION_NO_PREFERRED);
                }
                emitEvent("status", "已连接，正在发现传输服务…", -1, -1);
                nextGatt.discoverServices();
                return;
            }
            connected = false;
            payloadChunkBytes = DEFAULT_PAYLOAD_CHUNK_BYTES;
            transferCharacteristic = null;
            statusCharacteristic = null;
            stopUpload("BLE 已断开");
            emitEvent("disconnected", "BLE 已断开", -1, -1);
            nextGatt.close();
            if (gatt == nextGatt) gatt = null;
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onServicesDiscovered(BluetoothGatt nextGatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emitError("无法读取 OpenPencil BLE 服务");
                return;
            }
            BluetoothGattService service = nextGatt.getService(SERVICE_UUID);
            if (service == null) {
                emitError("设备缺少 OpenPencil 传输服务");
                return;
            }
            transferCharacteristic = service.getCharacteristic(TRANSFER_UUID);
            statusCharacteristic = service.getCharacteristic(STATUS_UUID);
            if (transferCharacteristic == null || statusCharacteristic == null) {
                emitError("设备固件不支持手机传输");
                return;
            }
            if (!nextGatt.requestMtu(517)) configureReady(nextGatt);
        }

        @Override
        public void onMtuChanged(BluetoothGatt nextGatt, int mtu, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                payloadChunkBytes = Math.max(
                        DEFAULT_PAYLOAD_CHUNK_BYTES,
                        Math.min(MAX_PAYLOAD_CHUNK_BYTES, mtu - 7));
            }
            configureReady(nextGatt);
        }
    };

    @SuppressWarnings("deprecation")
    @SuppressLint("MissingPermission")
    private void configureReady(BluetoothGatt nextGatt) {
        if (statusCharacteristic != null) {
            nextGatt.setCharacteristicNotification(statusCharacteristic, true);
            BluetoothGattDescriptor descriptor = statusCharacteristic.getDescriptor(CLIENT_CONFIG_UUID);
            if (descriptor != null) {
                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                nextGatt.writeDescriptor(descriptor);
            }
        }
        emitEvent("connected", "OpenPencil BLE 已连接", -1, -1);
    }

    @SuppressLint("MissingPermission")
    private void disconnectBle() {
        stopScan();
        if (gatt != null) gatt.disconnect();
    }

    private void beginPayload(int totalBytes) throws IOException {
        closePayloadOutput();
        if (totalBytes <= 24 || totalBytes > 0x1cf0000) {
            throw new IOException("内容大小必须在 24 字节至 28.94 MiB 之间");
        }
        payloadFile = new File(getCacheDir(), "openpencil-content.bin");
        payloadOutput = new FileOutputStream(payloadFile, false);
        payloadExpectedBytes = totalBytes;
        payloadWrittenBytes = 0;
    }

    private void appendPayload(String encoded) throws IOException {
        if (payloadOutput == null) throw new IOException("尚未开始准备内容");
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        if (payloadWrittenBytes + bytes.length > payloadExpectedBytes) {
            throw new IOException("内容数据超过声明长度");
        }
        payloadOutput.write(bytes);
        payloadWrittenBytes += bytes.length;
    }

    private void finishPayload() throws IOException {
        closePayloadOutput();
        if (payloadWrittenBytes != payloadExpectedBytes) {
            throw new IOException("内容写入不完整：" + payloadWrittenBytes + " / " + payloadExpectedBytes);
        }
        emitEvent("prepared", "内容已准备，可以上传", payloadWrittenBytes, payloadExpectedBytes);
    }

    private void closePayloadOutput() throws IOException {
        if (payloadOutput == null) return;
        payloadOutput.flush();
        payloadOutput.close();
        payloadOutput = null;
    }

    private void startUpload() {
        if (!connected || gatt == null || transferCharacteristic == null) {
            emitError("请先连接 OpenPencil BLE");
            return;
        }
        if (payloadFile == null || !payloadFile.isFile() || payloadWrittenBytes != payloadExpectedBytes) {
            emitError("请先选择并处理图片");
            return;
        }
        stopUpload(null);
        try {
            uploadInput = new RandomAccessFile(payloadFile, "r");
            uploadOffset = 0;
            uploadTotal = payloadExpectedBytes;
            lastProgressBytes = 0;
            uploading = true;
            transferCharacteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            emitEvent("status", "开始通过 BLE 上传…", 0, uploadTotal);
            mainHandler.post(uploadRunnable);
        } catch (IOException error) {
            emitError(error.getMessage());
        }
    }

    private final Runnable uploadRunnable = new Runnable() {
        @SuppressWarnings("deprecation")
        @SuppressLint("MissingPermission")
        @Override
        public void run() {
            if (!uploading || uploadInput == null || gatt == null || transferCharacteristic == null) return;
            if (!connected) {
                stopUpload("上传过程中 BLE 已断开");
                return;
            }
            if (uploadOffset >= uploadTotal) {
                stopUpload(null);
                emitEvent("complete", "内容已发送，设备正在校验并重启", uploadTotal, uploadTotal);
                return;
            }
            try {
                int length = Math.min(payloadChunkBytes, uploadTotal - uploadOffset);
                byte[] content = new byte[length];
                uploadInput.seek(uploadOffset);
                uploadInput.readFully(content);
                byte[] packet = new byte[length + 4];
                ByteBuffer.wrap(packet).order(ByteOrder.LITTLE_ENDIAN).putInt(uploadOffset).put(content);
                transferCharacteristic.setValue(packet);
                boolean accepted = gatt.writeCharacteristic(transferCharacteristic);
                if (!accepted) {
                    mainHandler.postDelayed(this, 12);
                    return;
                }
                uploadOffset += length;
                if (uploadOffset == uploadTotal || uploadOffset >= lastProgressBytes + 65536) {
                    lastProgressBytes = uploadOffset;
                    emitEvent("progress", "正在上传", uploadOffset, uploadTotal);
                }
                mainHandler.postDelayed(this, 5);
            } catch (IOException error) {
                stopUpload(error.getMessage());
            }
        }
    };

    private void stopUpload(String errorMessage) {
        uploading = false;
        mainHandler.removeCallbacks(uploadRunnable);
        if (uploadInput != null) {
            try {
                uploadInput.close();
            } catch (IOException ignored) {
            }
            uploadInput = null;
        }
        if (errorMessage != null) emitError(errorMessage);
    }

    private void emitError(String message) {
        emitEvent("error", message == null ? "未知错误" : message, -1, -1);
    }

    private void emitEvent(String type, String message, int written, int total) {
        JSONObject object = new JSONObject();
        try {
            object.put("type", type);
            object.put("message", message);
            if (written >= 0) object.put("written", written);
            if (total >= 0) object.put("total", total);
        } catch (JSONException ignored) {
        }
        String script = "window.OpenPencilApp&&window.OpenPencilApp.nativeEvent(" + object + ")";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void connect() {
            runOnUiThread(() -> {
                if (hasBlePermissions()) startBleScan();
                else requestBlePermissions();
            });
        }

        @JavascriptInterface
        public void disconnect() {
            runOnUiThread(MainActivity.this::disconnectBle);
        }

        @JavascriptInterface
        public void openAppSettings() {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }

        @JavascriptInterface
        public String beginPayload(int totalBytes) {
            try {
                MainActivity.this.beginPayload(totalBytes);
                return "";
            } catch (IOException error) {
                return error.getMessage();
            }
        }

        @JavascriptInterface
        public String appendPayloadChunk(String encoded) {
            try {
                appendPayload(encoded);
                return "";
            } catch (IOException error) {
                return error.getMessage();
            }
        }

        @JavascriptInterface
        public String finishPayload() {
            try {
                MainActivity.this.finishPayload();
                return "";
            } catch (IOException error) {
                return error.getMessage();
            }
        }

        @JavascriptInterface
        public void upload() {
            runOnUiThread(MainActivity.this::startUpload);
        }
    }

    @Override
    protected void onDestroy() {
        stopUpload(null);
        try {
            closePayloadOutput();
        } catch (IOException ignored) {
        }
        disconnectBle();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
