# Proguard rules for JNTUA Attendance
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keep class com.chanikya501.jntuaattendance.model.** { *; }
-keep class com.chanikya501.jntuaattendance.webview.AttendanceBridge { *; }
-keepclassmembers class com.chanikya501.jntuaattendance.webview.AttendanceBridge {
    public *;
}

# Strip logging in release builds to reduce dex size and logging overhead
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
    public static int wtf(...);
}
