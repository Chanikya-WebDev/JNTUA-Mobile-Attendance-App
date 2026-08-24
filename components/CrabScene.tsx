import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { COLORS } from "../constants/theme";

export function CrabScene() {
  const walkX = useRef(new Animated.Value(-170)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(1)).current;
  const sparkOp = useRef(new Animated.Value(0)).current;
  const sparkT = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  // 4 Legs with matching base coordinates
  const leg1 = useRef(new Animated.Value(0)).current;
  const leg2 = useRef(new Animated.Value(0)).current;
  const leg3 = useRef(new Animated.Value(0)).current;
  const leg4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = (v: Animated.Value, to: number, d: number, easing?: any) =>
      Animated.timing(v, {
        toValue: to,
        duration: d,
        easing: easing || Easing.linear,
        useNativeDriver: true,
      });

    // 1. Walk-In Horizontal Translation
    t(walkX, 0, 1000, Easing.out(Easing.quad)).start();

    // 2. Continuous Leg Stepping Loop (Runs non-stop)
    const continuousLegMotion = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          t(leg1, -3, 160),
          t(leg3, -3, 160),
          t(leg2, 0, 160),
          t(leg4, 0, 160),
        ]),
        Animated.parallel([
          t(leg1, 0, 160),
          t(leg3, 0, 160),
          t(leg2, -3, 160),
          t(leg4, -3, 160),
        ]),
      ])
    );

    // 3. Jump, Swing, and Hit Loop
    const jumpAndHit = Animated.loop(
      Animated.sequence([
        Animated.delay(900), // Idle wait between jumps

        // Jump Up + Wind Up Hammer (Airborne Phase)
        Animated.parallel([
          t(hopY, -32, 420, Easing.out(Easing.quad)),
          t(swing, -52, 420, Easing.out(Easing.quad)),
        ]),

        // Fall Down + Downward Strike
        Animated.parallel([
          t(hopY, 0, 180, Easing.in(Easing.quad)),
          t(swing, 72, 180, Easing.in(Easing.quad)),
        ]),

        // Impact Phase (Landing & Contact)
        Animated.parallel([
          t(squish, 0.4, 70, Easing.out(Easing.quad)),
          t(sparkOp, 1, 30),
          t(sparkT, 1, 280, Easing.out(Easing.quad)),
        ]),

        // Recovery & De-spark
        Animated.parallel([
          t(squish, 1, 180, Easing.out(Easing.quad)),
          t(sparkOp, 0, 180),
        ]),
        t(sparkT, 0, 0),

        // Neutral Hammer Return
        t(swing, 0, 380, Easing.inOut(Easing.quad)),
      ])
    );

    // Eye Blink
    const blinkCycle = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        t(blink, 0.1, 80),
        t(blink, 1, 80),
      ])
    );

    continuousLegMotion.start();
    jumpAndHit.start();
    blinkCycle.start();

    return () => {
      continuousLegMotion.stop();
      jumpAndHit.stop();
      blinkCycle.stop();
    };
  }, [walkX, hopY, swing, squish, sparkOp, sparkT, blink, leg1, leg2, leg3, leg4]);

  const rot = swing.interpolate({
    inputRange: [-60, 90],
    outputRange: ["-60deg", "90deg"],
  });
  const ringScale = sparkT.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] });
  const ringOp = sparkT.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  const sparks = [
    { dx: 18, dy: -18, c: COLORS.primary },
    { dx: 2, dy: -26, c: COLORS.amber },
    { dx: -14, dy: -18, c: COLORS.primary },
  ];

  return (
    <View style={{ width: 250, height: 150 }}>
      {/* Horizontal Position */}
      <Animated.View style={{ position: "absolute", width: 250, height: 150, transform: [{ translateX: walkX }] }}>
        {/* Ground Shadow */}
        <View style={{ position: "absolute", left: 58, top: 140, width: 80, height: 6, backgroundColor: COLORS.ink }} />

        {/* Jump / Height Offset */}
        <Animated.View style={{ position: "absolute", width: 250, height: 150, transform: [{ translateY: hopY }] }}>
          {/* Main Crab Body */}
          <View style={{ position: "absolute", left: 36, top: 92, width: 14, height: 16, backgroundColor: COLORS.crab }} />
          <View style={{ position: "absolute", left: 50, top: 68, width: 88, height: 56, backgroundColor: COLORS.crab }} />
          <View style={{ position: "absolute", left: 138, top: 90, width: 12, height: 16, backgroundColor: COLORS.crab }} />

          {/* Eyes */}
          <Animated.View style={{ position: "absolute", left: 66, top: 82, width: 8, height: 16, backgroundColor: COLORS.ink, transform: [{ scaleY: blink }] }} />
          <Animated.View style={{ position: "absolute", left: 114, top: 82, width: 8, height: 16, backgroundColor: COLORS.ink, transform: [{ scaleY: blink }] }} />

          {/* Equal-sized, continuously animated legs */}
          <Animated.View style={{ position: "absolute", left: 60, top: 124, width: 10, height: 16, backgroundColor: COLORS.crab, transform: [{ translateY: leg1 }] }} />
          <Animated.View style={{ position: "absolute", left: 78, top: 124, width: 10, height: 16, backgroundColor: COLORS.crab, transform: [{ translateY: leg2 }] }} />
          <Animated.View style={{ position: "absolute", left: 110, top: 124, width: 10, height: 16, backgroundColor: COLORS.crab, transform: [{ translateY: leg3 }] }} />
          <Animated.View style={{ position: "absolute", left: 128, top: 124, width: 10, height: 16, backgroundColor: COLORS.crab, transform: [{ translateY: leg4 }] }} />

          {/* Hammer Assembly */}
          <View style={{ position: "absolute", left: 128, top: 46, width: 30, height: 74 }}>
            <Animated.View
              style={{
                width: 30,
                height: 74,
                transform: [
                  { translateY: 37 },
                  { rotate: rot },
                  { translateY: -37 },
                ],
              }}
            >
              <View style={{ position: "absolute", left: 0, top: 0, width: 30, height: 18, backgroundColor: COLORS.head }} />
              <View style={{ position: "absolute", left: 12, top: 18, width: 6, height: 54, backgroundColor: COLORS.handle }} />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Target Block */}
      <Animated.View style={{ position: "absolute", left: 200, top: 112, width: 28, height: 34, transform: [{ scaleY: squish }] }}>
        <View style={{ position: "absolute", left: 7, top: 0, width: 14, height: 8, backgroundColor: COLORS.dTop }} />
        <View style={{ position: "absolute", left: 0, top: 8, width: 28, height: 16, backgroundColor: COLORS.dMid }} />
      </Animated.View>
      <View style={{ position: "absolute", left: 191, top: 136, width: 46, height: 10, backgroundColor: COLORS.dBase }} />

      {/* Impact FX */}
      <Animated.View
        style={{
          position: "absolute",
          left: 199,
          top: 100,
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 2,
          borderColor: COLORS.primary,
          opacity: ringOp,
          transform: [{ scale: ringScale }],
        }}
      />
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: 211,
            top: 105,
            width: 6,
            height: 6,
            backgroundColor: s.c,
            opacity: sparkOp,
            transform: [
              { translateX: sparkT.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              { translateY: sparkT.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}