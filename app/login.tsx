import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/Text";

const googleIcon = {
  uri: "https://developers.google.com/identity/images/g-logo.png",
};

export default function LoginScreen() {
  const enterApp = () => router.replace("/");

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.phone}>
        <View style={styles.topContent}>
          <LinearGradient colors={["#745cff", "#614df2"]} style={styles.logo}>
            <Text style={styles.logoText}>ML</Text>
          </LinearGradient>

          <Text style={styles.title}>Mini-Loora</Text>
          <Text style={styles.subtitle}>AI English Speaking Coach</Text>

          <View style={styles.authBlock}>
            <Pressable onPress={enterApp} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
              <Image source={googleIcon} style={styles.googleIcon} resizeMode="contain" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            <Pressable onPress={enterApp} style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}>
              <Text style={styles.guestText}>Continue as guest</Text>
            </Pressable>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy{"\n"}Policy.
            </Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.links}>
            <Pressable onPress={enterApp}>
              <Text style={styles.linkText}>Sign in</Text>
            </Pressable>
            <Pressable onPress={enterApp}>
              <Text style={styles.linkText}>Create account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef3f8",
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  phone: {
    width: "100%",
    maxWidth: 390,
    minHeight: Platform.OS === "web" ? 790 : "92%",
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#cbd7e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 30,
    justifyContent: "space-between",
  },
  topContent: {
    alignItems: "center",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#614df2",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  title: {
    marginTop: 24,
    color: "#071329",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    color: "#60708a",
    fontSize: 14,
    textAlign: "center",
  },
  authBlock: {
    width: "100%",
    marginTop: 52,
    gap: 14,
  },
  googleButton: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e8f2",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#22304a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  googleText: {
    color: "#020817",
    fontSize: 14,
    fontWeight: "800",
  },
  guestButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: "#faf8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  guestText: {
    color: "#020817",
    fontSize: 14,
    fontWeight: "800",
  },
  terms: {
    marginTop: 10,
    color: "#53647d",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },
  bottom: {
    gap: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e9f2",
  },
  dividerText: {
    color: "#6b7b91",
    fontSize: 11,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
  },
  linkText: {
    color: "#020817",
    fontSize: 12,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
