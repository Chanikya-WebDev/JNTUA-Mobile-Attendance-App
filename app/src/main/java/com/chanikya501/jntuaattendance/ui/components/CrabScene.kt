package com.chanikya501.jntuaattendance.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.chanikya501.jntuaattendance.ui.theme.Amber
import com.chanikya501.jntuaattendance.ui.theme.CrabColor
import com.chanikya501.jntuaattendance.ui.theme.DBaseColor
import com.chanikya501.jntuaattendance.ui.theme.DMidColor
import com.chanikya501.jntuaattendance.ui.theme.DTopColor
import com.chanikya501.jntuaattendance.ui.theme.HandleColor
import com.chanikya501.jntuaattendance.ui.theme.HeadColor
import com.chanikya501.jntuaattendance.ui.theme.Ink
import com.chanikya501.jntuaattendance.ui.theme.Primary
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@Composable
fun CrabScene(modifier: Modifier = Modifier) {
    val walkX = remember { Animatable(-170f) }
    val hopY = remember { Animatable(0f) }
    val swing = remember { Animatable(0f) }
    val squish = remember { Animatable(1f) }
    val sparkOp = remember { Animatable(0f) }
    val sparkT = remember { Animatable(0f) }
    val blink = remember { Animatable(1f) }

    val transition = rememberInfiniteTransition(label = "crab")
    val legPhase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 320, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "legs"
    )

    LaunchedEffect(Unit) {
        // 1. Walk-in animation
        launch {
            walkX.animateTo(
                targetValue = 0f,
                animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing)
            )
        }

        // 3. Eye blink loop
        launch {
            while (isActive) {
                delay(3000)
                blink.animateTo(0.1f, tween(80))
                blink.animateTo(1f, tween(80))
            }
        }

        // 4. Jump, swing, strike & impact loop
        launch {
            while (isActive) {
                delay(900)

                // Airborne phase (hop up + wind up hammer)
                launch {
                    hopY.animateTo(-32f, tween(420, easing = FastOutSlowInEasing))
                }
                launch {
                    swing.animateTo(-52f, tween(420, easing = FastOutSlowInEasing))
                }
                delay(420)

                // Downward strike
                launch {
                    hopY.animateTo(0f, tween(180, easing = FastOutSlowInEasing))
                }
                launch {
                    swing.animateTo(72f, tween(180, easing = FastOutSlowInEasing))
                }
                delay(180)

                // Contact & Impact
                launch {
                    squish.animateTo(0.4f, tween(70, easing = FastOutSlowInEasing))
                }
                launch {
                    sparkOp.animateTo(1f, tween(30))
                }
                launch {
                    sparkT.animateTo(1f, tween(280, easing = FastOutSlowInEasing))
                }
                delay(70)

                // Recovery
                launch {
                    squish.animateTo(1f, tween(180, easing = FastOutSlowInEasing))
                }
                launch {
                    sparkOp.animateTo(0f, tween(180))
                }
                delay(180)
                sparkT.snapTo(0f)

                // Neutral return
                swing.animateTo(0f, tween(380, easing = FastOutSlowInEasing))
            }
        }
    }

    val leg1Offset = -3f * legPhase
    val leg2Offset = -3f * (1f - legPhase)

    Box(modifier = modifier.size(width = 250.dp, height = 150.dp)) {
        // Walking group
        Box(
            modifier = Modifier
                .size(250.dp, 150.dp)
                .offset(x = walkX.value.dp)
        ) {
            // Ground shadow
            Box(
                modifier = Modifier
                    .offset(x = 58.dp, y = 140.dp)
                    .size(width = 80.dp, height = 6.dp)
                    .background(Ink)
            )

            // Hopping crab group
            Box(
                modifier = Modifier
                    .size(250.dp, 150.dp)
                    .offset(y = hopY.value.dp)
            ) {
                // Claws & Body
                Box(
                    modifier = Modifier
                        .offset(x = 36.dp, y = 92.dp)
                        .size(width = 14.dp, height = 16.dp)
                        .background(CrabColor)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 50.dp, y = 68.dp)
                        .size(width = 88.dp, height = 56.dp)
                        .background(CrabColor)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 138.dp, y = 90.dp)
                        .size(width = 12.dp, height = 16.dp)
                        .background(CrabColor)
                )

                // Eyes with blink scaleY
                Box(
                    modifier = Modifier
                        .offset(x = 66.dp, y = 82.dp)
                        .size(width = 8.dp, height = 16.dp)
                        .graphicsLayer(scaleY = blink.value)
                        .background(Ink)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 114.dp, y = 82.dp)
                        .size(width = 8.dp, height = 16.dp)
                        .graphicsLayer(scaleY = blink.value)
                        .background(Ink)
                )

                // 4 Animated Legs
                Box(
                    modifier = Modifier
                        .offset(x = 60.dp, y = (124 + leg1Offset).dp)
                        .size(width = 10.dp, height = 16.dp)
                        .background(CrabColor)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 78.dp, y = (124 + leg2Offset).dp)
                        .size(width = 10.dp, height = 16.dp)
                        .background(CrabColor)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 110.dp, y = (124 + leg1Offset).dp)
                        .size(width = 10.dp, height = 16.dp)
                        .background(CrabColor)
                )
                Box(
                    modifier = Modifier
                        .offset(x = 128.dp, y = (124 + leg2Offset).dp)
                        .size(width = 10.dp, height = 16.dp)
                        .background(CrabColor)
                )

                // Hammer Assembly
                Box(
                    modifier = Modifier
                        .offset(x = 128.dp, y = 46.dp)
                        .size(width = 30.dp, height = 74.dp)
                        .graphicsLayer(
                            rotationZ = swing.value,
                            transformOrigin = TransformOrigin(0.5f, 0.5f)
                        )
                ) {
                    // Hammer Head
                    Box(
                        modifier = Modifier
                            .offset(x = 0.dp, y = 0.dp)
                            .size(width = 30.dp, height = 18.dp)
                            .background(HeadColor)
                    )
                    // Hammer Handle
                    Box(
                        modifier = Modifier
                            .offset(x = 12.dp, y = 18.dp)
                            .size(width = 6.dp, height = 54.dp)
                            .background(HandleColor)
                    )
                }
            }
        }

        // Anvil / Target Block
        Box(
            modifier = Modifier
                .offset(x = 200.dp, y = 112.dp)
                .size(width = 28.dp, height = 34.dp)
                .graphicsLayer(
                    scaleY = squish.value,
                    transformOrigin = TransformOrigin(0.5f, 1.0f)
                )
        ) {
            Box(
                modifier = Modifier
                    .offset(x = 7.dp, y = 0.dp)
                    .size(width = 14.dp, height = 8.dp)
                    .background(DTopColor)
            )
            Box(
                modifier = Modifier
                    .offset(x = 0.dp, y = 8.dp)
                    .size(width = 28.dp, height = 16.dp)
                    .background(DMidColor)
            )
        }
        // Anvil Base
        Box(
            modifier = Modifier
                .offset(x = 191.dp, y = 136.dp)
                .size(width = 46.dp, height = 10.dp)
                .background(DBaseColor)
        )

        // Impact Ring FX
        val ringScale = 0.3f + 1.3f * sparkT.value
        val ringAlpha = if (sparkT.value < 0.15f) sparkT.value / 0.15f else (1f - sparkT.value)
        Box(
            modifier = Modifier
                .offset(x = 199.dp, y = 100.dp)
                .size(30.dp)
                .graphicsLayer(scaleX = ringScale, scaleY = ringScale)
                .alpha(ringAlpha.coerceIn(0f, 1f))
                .border(width = 2.dp, color = Primary, shape = CircleShape)
        )

        // Sparks FX
        val spark1X = 211f + (18f * sparkT.value)
        val spark1Y = 105f + (-18f * sparkT.value)
        Box(
            modifier = Modifier
                .offset(x = spark1X.dp, y = spark1Y.dp)
                .size(6.dp)
                .alpha(sparkOp.value)
                .background(Primary)
        )

        val spark2X = 211f + (2f * sparkT.value)
        val spark2Y = 105f + (-26f * sparkT.value)
        Box(
            modifier = Modifier
                .offset(x = spark2X.dp, y = spark2Y.dp)
                .size(6.dp)
                .alpha(sparkOp.value)
                .background(Amber)
        )

        val spark3X = 211f + (-14f * sparkT.value)
        val spark3Y = 105f + (-18f * sparkT.value)
        Box(
            modifier = Modifier
                .offset(x = spark3X.dp, y = spark3Y.dp)
                .size(6.dp)
                .alpha(sparkOp.value)
                .background(Primary)
        )
    }
}
