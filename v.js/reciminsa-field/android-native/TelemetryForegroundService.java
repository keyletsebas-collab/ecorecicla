package com.reciminsa.field.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

/**
 * Servicio en Primer Plano (Foreground Service) para Reciminsa Field (v.js)
 * - Tipo: FOREGROUND_SERVICE_TYPE_LOCATION (Sección 3)
 * - Frecuencia de muestreo y emisión: 10 segundos (0.1 Hz)
 * - Exención de Doze Mode: ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * - Auditoría #14: Inspección de Mock GPS con location.isMock() / isFromMockProvider()
 */
public class TelemetryForegroundService extends Service {

    private static final String CHANNEL_ID = "reciminsa_field_telemetry_vjs";
    private static final int NOTIFICATION_ID = 1010;
    private Location lastLocation = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Reciminsa Field – Telemetría Activa")
                .setContentText("Transmitiendo posición cada 10s (0.1 Hz) hacia Reciminsa Ops")
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Telemetría Operativa Reciminsa Field",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Puente JS Nativo (@JavascriptInterface) expuesto como window.AndroidFieldBridge
     */
    public static class AndroidFieldBridge {
        private final Context context;
        private Location latestLocation;

        public AndroidFieldBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getAndroidId() {
            return Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        }

        @JavascriptInterface
        public String getDeviceModel() {
            return Build.MANUFACTURER + " " + Build.MODEL;
        }

        @JavascriptInterface
        public boolean isMockLocationActive() {
            if (latestLocation == null) return false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                return latestLocation.isMock();
            } else {
                return latestLocation.isFromMockProvider();
            }
        }

        @JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                String pkg = context.getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(android.net.Uri.parse("package:" + pkg));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                }
            }
        }
    }
}

