import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";

interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  jnvState: string;
  jnvName: string;
  enrollYear: string;
  passoutYear: string;
  approvals: string[];
  status: "pending" | "verified";
  createdAt: any;
}

export default function AlumniVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [myRequest, setMyRequest] = useState<VerificationRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, "verificationRequests"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VerificationRequest));
      setRequests(all.filter((r) => r.userId !== profile?.uid));
      const mine = all.find((r) => r.userId === profile?.uid);
      setMyRequest(mine || null);
    } catch {}
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmitRequest = async () => {
    if (myRequest) {
      Alert.alert("Already Submitted", "Your verification request is pending.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "verificationRequests"), {
        userId: profile?.uid,
        userName: profile?.fullName,
        jnvState: profile?.jnvState,
        jnvName: profile?.jnvName,
        enrollYear: profile?.enrollYear,
        passoutYear: profile?.passoutYear,
        approvals: [],
        status: "pending",
        createdAt: serverTimestamp(),
      });
      fetchRequests();
    } catch {
      Alert.alert("Error", "Failed to submit request");
    }
    setSubmitting(false);
  };

  const handleApprove = async (request: VerificationRequest) => {
    if (profile?.verificationStatus !== "verified") {
      Alert.alert("Not Allowed", "Only verified alumni can approve others.");
      return;
    }
    if (request.approvals?.includes(profile?.uid || "")) {
      Alert.alert("Already Approved", "You have already approved this request.");
      return;
    }
    try {
      const newApprovals = [...(request.approvals || []), profile?.uid];
      await updateDoc(doc(db, "verificationRequests", request.id), {
        approvals: arrayUnion(profile?.uid),
        status: newApprovals.length >= 2 ? "verified" : "pending",
      });
      if (newApprovals.length >= 2) {
        await updateDoc(doc(db, "users", request.userId), {
          verificationStatus: "verified",
        });
      }
      fetchRequests();
      Alert.alert("Success", "Approved successfully!");
    } catch {
      Alert.alert("Error", "Failed to approve");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alumni Verification</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <PremiumCard style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIconBg,
                {
                  backgroundColor:
                    profile?.verificationStatus === "verified"
                      ? "#D1FAE5"
                      : profile?.verificationStatus === "pending"
                      ? "#FEF3C7"
                      : "#F1F5F9",
                },
              ]}
            >
              <Ionicons
                name={
                  profile?.verificationStatus === "verified"
                    ? "checkmark-circle"
                    : profile?.verificationStatus === "pending"
                    ? "time"
                    : "shield-outline"
                }
                size={28}
                color={
                  profile?.verificationStatus === "verified"
                    ? "#059669"
                    : profile?.verificationStatus === "pending"
                    ? "#D97706"
                    : "#64748B"
                }
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                Verification Status
              </Text>
              <Text
                style={[
                  styles.statusValue,
                  {
                    color:
                      profile?.verificationStatus === "verified"
                        ? "#059669"
                        : profile?.verificationStatus === "pending"
                        ? "#D97706"
                        : "#64748B",
                  },
                ]}
              >
                {profile?.verificationStatus === "verified"
                  ? "Verified Alumni"
                  : profile?.verificationStatus === "pending"
                  ? "Verification Pending"
                  : "Not Verified"}
              </Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                {profile?.verificationStatus === "verified"
                  ? "You can verify other alumni"
                  : profile?.verificationStatus === "pending"
                  ? myRequest
                    ? `${myRequest.approvals?.length || 0}/2 approvals received`
                    : "Awaiting review"
                  : "Submit a request to get verified"}
              </Text>
            </View>
          </View>
          {profile?.verificationStatus === "unverified" && (
            <PremiumButton
              title="Request Verification"
              onPress={handleSubmitRequest}
              loading={submitting}
              style={{ marginTop: 12 }}
            />
          )}
        </PremiumCard>

        {profile?.verificationStatus === "verified" && requests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Pending Approvals ({requests.length})
            </Text>
            {requests.map((req) => (
              <PremiumCard key={req.id} style={styles.reqCard}>
                <Text style={[styles.reqName, { color: colors.foreground }]}>{req.userName}</Text>
                <Text style={[styles.reqJNV, { color: colors.mutedForeground }]}>
                  {req.jnvName}, {req.jnvState}
                </Text>
                <Text style={[styles.reqBatch, { color: colors.mutedForeground }]}>
                  Batch {req.enrollYear} - {req.passoutYear}
                </Text>
                <View style={styles.reqFooter}>
                  <Text style={[styles.approvalCount, { color: colors.mutedForeground }]}>
                    {req.approvals?.length || 0}/2 approvals
                  </Text>
                  <PremiumButton
                    title={req.approvals?.includes(profile?.uid || "") ? "Approved" : "Approve"}
                    onPress={() => handleApprove(req)}
                    variant={req.approvals?.includes(profile?.uid || "") ? "secondary" : "primary"}
                    fullWidth={false}
                    disabled={req.approvals?.includes(profile?.uid || "")}
                    style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                  />
                </View>
              </PremiumCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  content: { padding: 16 },
  statusCard: { marginBottom: 20 },
  statusRow: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 4 },
  statusIconBg: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 3 },
  statusValue: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: {},
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 12 },
  reqCard: { marginBottom: 10 },
  reqName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  reqJNV: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  reqBatch: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  reqFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  approvalCount: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
