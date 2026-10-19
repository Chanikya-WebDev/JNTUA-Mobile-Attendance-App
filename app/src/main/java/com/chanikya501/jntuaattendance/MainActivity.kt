package com.chanikya501.jntuaattendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.chanikya501.jntuaattendance.ui.AttendanceApp
import com.chanikya501.jntuaattendance.ui.theme.JNTUAAttendanceTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            JNTUAAttendanceTheme {
                AttendanceApp()
            }
        }
    }
}
