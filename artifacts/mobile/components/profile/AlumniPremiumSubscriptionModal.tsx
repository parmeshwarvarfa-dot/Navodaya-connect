import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type AlumniMembershipPlan } from "@/lib/api";

interface AlumniPremiumSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}

export default function AlumniPremiumSubscriptionModal({
  visible,
  onClose,
  onSubscribed,
}: AlumniPremiumSubscriptionModalProps) {
  const [plans, setPlans] = useState<AlumniMembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    api.alumniMembership
      .plans()
      .then((res) => {
        if (!active) return;
        setPlans(res.plans);
        if (res.plans.length > 0) {
          // Default select annual or first plan
          const defaultPlan = res.plans.find((p) => p.billingCycle === "yearly") || res.plans[0];
          setSelectedPlanId(defaultPlan.id);
        }
      })
      .catch((err) => {
        console.warn("[SubscriptionModal] Plans load error:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const handleSubscribe = async () => {
    if (!selectedPlanId) {
      Alert.alert("Plan Required", "Please select a membership plan.");
      return;
    }

    setSubscribing(true);
    try {
      const res = await api.alumniMembership.subscribe(selectedPlanId, paymentMethod);
      Alert.alert(
        "Welcome to Navodaya Premium!",
        res.message || "Your Alumni Premium membership has been activated.",
        [
          {
            text: "Awesome!",
            onPress: () => {
              onSubscribed();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Failed to activate membership";
      Alert.alert("Subscription", message);
    } finally {
      setSubscribing(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <LinearGradient
            colors={["#581C87", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheetHeader}
          >
            <View style={styles.headerTitleRow}>
              <View style={styles.crownWrap}>
                <Text style={{ fontSize: 24 }}>👑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerHeading}>Navodaya Alumni Premium</Text>
                <Text style={styles.headerSubtitle}>
                  Unlock your exclusive alumni prestige, insights & offers
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={{ marginTop: 12, color: "#6B7280" }}>
                  Loading membership plans...
                </Text>
              </View>
            ) : (
              <>
                {/* Plan Selection Cards */}
                <Text style={styles.sectionLabel}>Select Your Plan</Text>
                <View style={styles.plansContainer}>
                  {plans.map((p) => {
                    const isSelected = p.id === selectedPlanId;
                    const isYearly = p.billingCycle === "yearly";
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.planCard,
                          isSelected && styles.planCardSelected,
                        ]}
                        onPress={() => setSelectedPlanId(p.id)}
                        activeOpacity={0.8}
                      >
                        {isYearly && (
                          <View style={styles.bestValueRibbon}>
                            <Text style={styles.bestValueText}>BEST VALUE • SAVE 16%</Text>
                          </View>
                        )}
                        <View style={styles.planCardTop}>
                          <View>
                            <Text style={styles.planName}>{p.name}</Text>
                            <Text style={styles.planBilling}>
                              {isYearly ? "12 Months Access" : "1 Month Access"}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.planPrice}>
                              ₹{(p.pricePaise / 100).toLocaleString("en-IN")}
                            </Text>
                            {p.originalPricePaise && (
                              <Text style={styles.planOriginalPrice}>
                                ₹{(p.originalPricePaise / 100).toLocaleString("en-IN")}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.planFeatures}>
                          {p.features?.slice(0, 3).map((feat, idx) => (
                            <View key={idx} style={styles.featureBullet}>
                              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                              <Text style={styles.featureBulletText}>{feat}</Text>
                            </View>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Benefits Showcase */}
                <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                  What's Included in Premium
                </Text>
                <View style={styles.benefitsGrid}>
                  {[
                    { icon: "sparkles", text: "✦ Golden Navodaya Premium profile badge" },
                    { icon: "id-card-outline", text: "Exclusive diagonal identity card layout" },
                    { icon: "stats-chart", text: "Real-time profile reach & visitor analytics" },
                    { icon: "images-outline", text: "Featured memories & pinned spotlight posts" },
                    { icon: "pricetag-outline", text: "Store Room special alumni offers & discounts" },
                    { icon: "shield-checkmark", text: "Cryptographic Verified Alumni Digital ID" },
                  ].map((b, idx) => (
                    <View key={idx} style={styles.benefitRow}>
                      <Ionicons name={b.icon as any} size={16} color="#7C3AED" style={{ marginRight: 8 }} />
                      <Text style={styles.benefitText}>{b.text}</Text>
                    </View>
                  ))}
                </View>

                {/* Payment Method Selector */}
                <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                  Payment Method
                </Text>
                <View style={styles.methodsRow}>
                  {[
                    { id: "upi", label: "UPI / QR", icon: "flash-outline" },
                    { id: "card", label: "Cards", icon: "card-outline" },
                    { id: "netbanking", label: "NetBanking", icon: "business-outline" },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.methodChip,
                        paymentMethod === m.id && styles.methodChipSelected,
                      ]}
                      onPress={() => setPaymentMethod(m.id as any)}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={paymentMethod === m.id ? "#7C3AED" : "#6B7280"}
                      />
                      <Text
                        style={[
                          styles.methodChipText,
                          paymentMethod === m.id && styles.methodChipTextSelected,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Policy Notice */}
                <View style={styles.policyNotice}>
                  <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.policyText}>
                    Manual renewal model. No hidden auto-deductions. Exclusively for JNV alumni.
                  </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={[styles.subscribeBtn, subscribing && { opacity: 0.7 }]}
                  onPress={handleSubscribe}
                  disabled={subscribing}
                  activeOpacity={0.8}
                >
                  {subscribing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.subscribeBtnText}>
                      Upgrade Now • ₹
                      {selectedPlan ? (selectedPlan.pricePaise / 100).toLocaleString("en-IN") : "—"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "90%",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  crownWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#E9D5FF",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1B4B",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    backgroundColor: "#FAFAFA",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  planCardSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  bestValueRibbon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  bestValueText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  planCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  planBilling: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "600",
    color: "#7C3AED",
  },
  planOriginalPrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  planFeatures: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 10,
  },
  featureBullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureBulletText: {
    fontSize: 12,
    color: "#374151",
  },
  benefitsGrid: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  methodsRow: {
    flexDirection: "row",
    gap: 10,
  },
  methodChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    gap: 6,
    backgroundColor: "#FAFAFA",
  },
  methodChipSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  methodChipTextSelected: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  policyNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 10,
    marginTop: 16,
    gap: 8,
  },
  policyText: {
    fontSize: 11,
    color: "#6B7280",
    flex: 1,
    lineHeight: 16,
  },
  subscribeBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  subscribeBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
