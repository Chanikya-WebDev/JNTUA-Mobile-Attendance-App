package com.chanikya501.jntuaattendance.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = OnDark,
    background = CanvasBg,
    onBackground = Ink,
    surface = SurfaceCard,
    onSurface = Ink,
    error = ErrorRed,
    onError = OnDark
)

@Composable
fun JNTUAAttendanceTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = AppTypography,
        content = content
    )
}
