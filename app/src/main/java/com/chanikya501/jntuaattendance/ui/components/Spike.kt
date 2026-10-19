package com.chanikya501.jntuaattendance.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.chanikya501.jntuaattendance.ui.theme.Primary

@Composable
fun Spike(
    modifier: Modifier = Modifier,
    size: Dp = 13.dp,
    color: Color = Primary
) {
    Canvas(modifier = modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val barWidth = 3.dp.toPx()
        val corner = 2.dp.toPx()

        for (angle in 0 until 180 step 45) {
            rotate(degrees = angle.toFloat(), pivot = Offset(w / 2f, h / 2f)) {
                drawRoundRect(
                    color = color,
                    topLeft = Offset((w - barWidth) / 2f, 0f),
                    size = Size(barWidth, h),
                    cornerRadius = CornerRadius(corner, corner)
                )
            }
        }
    }
}
