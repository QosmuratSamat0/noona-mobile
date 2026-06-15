import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/Text";
import { TextInput, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import { api, getValidToken, setTokens } from "../utils/api";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

const googleIcon = {
  uri: "https://developers.google.com/identity/images/g-logo.png",
};

const getAuthErrorMessage = (error: any, fallback: string) => {
  const serverMessage = error.response?.data?.error || error.message;

  if (!serverMessage) {
    return fallback;
  }

  if (serverMessage === "unauthorized") {
    return "Incorrect email or password.";
  }

  return serverMessage;
};

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
  });

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const token = await getValidToken();
        if (token && !cancelled) {
          router.replace("/");
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (!id_token) {
        Alert.alert("Google Login Failed", "Google did not return an ID token.");
        return;
      }
      handleGoogleLoginBackend(id_token);
    } else if (response?.type === "error") {
      Alert.alert(
        "Google Login Failed",
        response.error?.message || response.params?.error_description || response.params?.error || "Google authorization failed"
      );
    }
  }, [response]);

  const handleGoogleLoginBackend = async (idToken: string) => {
    setLoading(true);
    try {
      console.info("[auth] Google login attempt");
      const res = await api.post("/auth/google", { id_token: idToken });
      if (res.data?.access_token) {
        await setTokens(res.data.access_token, res.data.refresh_token || "");
        console.info("[auth] Google login succeeded");
        router.replace("/");
      } else {
        console.warn("[auth] Google login response did not include access token");
        Alert.alert("Google Login Failed", "Server did not return an access token.");
      }
    } catch (error: any) {
      const message = getAuthErrorMessage(error, "Google login failed. Please try again.");
      console.error("[auth] Google login failed", {
        status: error.response?.status,
        message,
      });
      Alert.alert("Google Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = () => {
    if (!googleClientId) {
      Alert.alert(
        "Google Login Not Configured",
        "Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in mobile/.env, then restart Expo."
      );
      return;
    }

    if (!request) {
      Alert.alert("Google Login Not Ready", "Please try again in a moment.");
      return;
    }

    promptAsync();
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      console.warn("[auth] Form submit rejected: missing required fields", {
        mode: isLogin ? "login" : "register",
        email,
        hasName: Boolean(name),
        hasPassword: Boolean(password),
      });
      Alert.alert("Error", isLogin ? "Please enter your email and password." : "Please fill in name, email and password.");
      return;
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        console.info("[auth] Login attempt", { email });
        const response = await api.post("/auth/login", { email, password });
        if (response.data?.access_token) {
          await setTokens(response.data.access_token, response.data.refresh_token || "");
          console.info("[auth] Login succeeded", { email });
          router.replace("/");
        } else {
          console.warn("[auth] Login response did not include access token", { email });
          Alert.alert("Login Failed", "Server did not return an access token.");
        }
      } else {
        console.info("[auth] Registration attempt", { email, name });
        const registerResponse = await api.post("/auth/register", { name, email, password });
        console.info("[auth] Registration succeeded", {
          email,
          message: registerResponse.data?.message,
        });
        // Auto login after register
        console.info("[auth] Auto login after registration attempt", { email });
        const response = await api.post("/auth/login", { email, password });
        if (response.data?.access_token) {
          await setTokens(response.data.access_token, response.data.refresh_token || "");
          console.info("[auth] Auto login after registration succeeded", { email });
          router.replace("/");
        } else {
          console.warn("[auth] Auto login response did not include access token", { email });
          Alert.alert("Registration Complete", "Account created, but login did not return an access token. Please sign in.");
        }
      }
    } catch (error: any) {
      const title = isLogin ? "Login Failed" : "Registration Failed";
      const fallback = isLogin ? "Login failed. Please check your email and password." : "Registration failed. Please try again.";
      const message = getAuthErrorMessage(error, fallback);
      console.error(`[auth] ${isLogin ? "Login" : "Registration"} failed`, {
        email,
        status: error.response?.status,
        message,
      });
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.page}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#614df2" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.phone}>
        <View style={styles.topContent}>
          <LinearGradient colors={["#745cff", "#614df2"]} style={styles.logo}>
            <Text style={styles.logoText}>N</Text>
          </LinearGradient>

          <Text style={styles.title}>Noona</Text>
          <Text style={styles.subtitle}>AI English Speaking Coach</Text>

          <View style={styles.authBlock}>
            <View style={{ gap: 12, width: '100%' }}>
              {!isLogin && (
                <TextInput 
                  style={styles.input} 
                  placeholder="Name" 
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              )}
              <TextInput 
                style={styles.input} 
                placeholder="Email" 
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput 
                style={styles.input} 
                placeholder="Password" 
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Pressable 
                onPress={handleAuth} 
                disabled={loading}
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, { backgroundColor: '#614df2' }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.googleText, { color: '#fff' }]}>
                    {isLogin ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </Pressable>

              <Pressable 
                onPress={handleGooglePress} 
                disabled={loading}
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, { marginTop: 12 }]}
              >
                <Image source={googleIcon} style={styles.googleIcon} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable>
            </View>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy{"\n"}Policy.
            </Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.links}>
            <Pressable onPress={() => setIsLogin(true)}>
              <Text style={[styles.linkText, isLogin && styles.activeLink]}>Sign in</Text>
            </Pressable>
            <Pressable onPress={() => setIsLogin(false)}>
              <Text style={[styles.linkText, !isLogin && styles.activeLink]}>Create account</Text>
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
    backgroundColor: Platform.OS === "web" ? "#eef3f8" : "#ffffff",
    paddingHorizontal: Platform.OS === "web" ? 28 : 0,
    paddingVertical: Platform.OS === "web" ? 24 : 0,
  },
  phone: {
    width: "100%",
    flex: 1,
    maxWidth: Platform.OS === "web" ? 390 : "100%",
    borderRadius: Platform.OS === "web" ? 36 : 0,
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#cbd7e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 64 : 80,
    paddingBottom: Platform.OS === "web" ? 30 : 40,
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
  input: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e8f2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#020817",
  },
  activeLink: {
    color: "#614df2",
    fontWeight: "800",
  },
});
