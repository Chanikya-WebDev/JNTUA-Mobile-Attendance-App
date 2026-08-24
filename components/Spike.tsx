import React from "react";
import { View } from "react-native";
import { COLORS } from "../constants/theme";

export function Spike({ size = 13, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      {[0, 45, 90, 135].map((a) => (
        <View
          key={a}
          style={{
            position: "absolute",
            left: size / 2 - 1.5,
            top: 0,
            width: 3,
            height: size,
            borderRadius: 2,
            backgroundColor: color,
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
    </View>
  );
}