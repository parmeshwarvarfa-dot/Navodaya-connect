import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type StoreCategory, type StoreSeller } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type SellerTab = "overview" | "products" | "orders" | "earnings";

const rupees = (paise: number) =>
  `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function SellerPortalScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seller, setSeller] = useState<StoreSeller | null>(null);
  const [tab, setTab] = useState<SellerTab>("overview");
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [products, setProducts] = useState<Array<Record<string, any>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, any>>>([]);
  const [earnings, setEarnings] = useState<{ ledger: any[]; payouts: any[]; returnsCount: number } | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  // Seller Application state
  const [sellerType, setSellerType] = useState<"individual" | "business">("individual");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankLast4, setBankLast4] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Product Modal state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("10");
  const [prodWeight, setProdWeight] = useState("250");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");

  // Fulfillment Modal state
  const [fulfillOrder, setFulfillOrder] = useState<Record<string, any> | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const cats = await api.store.categories();
      setCategories(cats);
      if (!prodCategoryId && cats[0]) setProdCategoryId(cats[0].id);

      const me = await api.seller.me().catch(() => null);
      setSeller(me);
      if (me?.status === "approved") {
        const [dash, prods, ords, earn] = await Promise.all([
          api.seller.dashboard(),
          api.seller.products(),
          api.seller.orders(),
          api.seller.earnings(),
        ]);
        setDashboard(dash);
        setProducts(prods.items);
        setOrders(ords.items);
        setEarnings(earn);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prodCategoryId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const submitApplication = async () => {
    if (!displayName.trim() || !agreed) {
      Alert.alert("Missing details", "Enter your seller name and accept the Seller Agreement.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.seller.apply({
        sellerType,
        displayName: displayName.trim(),
        legalName: legalName.trim() || undefined,
        description: description.trim(),
        contactPhone: contactPhone.trim() || undefined,
        bankAccountHolder: bankHolder.trim() || undefined,
        bankAccountLast4: bankLast4.trim() || undefined,
        bankIfsc: bankIfsc.trim() || undefined,
        agreementAccepted: true,
      });
      setSeller(created);
      Alert.alert("Application Submitted", "Your seller application is now pending Central Store Admin approval.");
    } catch (e) {
      Alert.alert("Application Failed", e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitProduct = async () => {
    const pricePaise = Math.round(Number(prodPrice) * 100);
    const stock = Number(prodStock);
    const weightGrams = Number(prodWeight) || 250;
    if (!prodName.trim() || !prodCategoryId || !Number.isFinite(pricePaise) || pricePaise < 100 || !Number.isInteger(stock) || stock < 0) {
      Alert.alert("Invalid product", "Enter a valid name, category, price (>= ₹1), and stock.");
      return;
    }
    setSubmitting(true);
    try {
      await api.seller.createProduct({
        name: prodName.trim(),
        description: prodDesc.trim(),
        categoryId: prodCategoryId,
        pricePaise,
        stock,
        weightGrams,
        images: prodImageUrl.trim().startsWith("https://") ? [prodImageUrl.trim()] : [],
      });
      setShowAddProduct(false);
      setProdName(""); setProdDesc(""); setProdPrice(""); setProdStock("10"); setProdImageUrl("");
      await loadAll();
      Alert.alert("Submitted for Review", "Your product has been sent to Central Store Admin for approval.");
    } catch (e) {
      Alert.alert("Submission Failed", e instanceof Error ? e.message : "Could not submit product.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStock = async (productId: string, delta: number, current: number) => {
    const next = Math.max(0, current + delta);
    try {
      await api.seller.updateInventory(productId, next, delta > 0 ? "Seller restock" : "Seller stock reduction");
      await loadAll();
    } catch (e) {
      Alert.alert("Stock Update Failed", e instanceof Error ? e.message : "Could not update stock.");
    }
  };

  const markDispatched = async () => {
    if (!fulfillOrder || !carrier.trim() || !trackingNo.trim()) {
      Alert.alert("Tracking Required", "Enter both courier name and tracking number.");
      return;
    }
    setSubmitting(true);
    try {
      await api.seller.fulfillOrder(fulfillOrder.id, {
        fulfillmentStatus: "dispatched",
        carrier: carrier.trim(),
        trackingNumber: trackingNo.trim(),
      });
      setFulfillOrder(null);
      setCarrier(""); setTrackingNo("");
      await loadAll();
    } catch (e) {
      Alert.alert("Fulfillment Failed", e instanceof Error ? e.message : "Could not update shipment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 8 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={21} color="#1E1B4B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Seller Portal</Text>
          <Text style={styles.headerSub}>{seller?.displayName || "Navodaya Connect Store Marketplace"}</Text>
        </View>
        {seller?.status === "approved" ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddProduct(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Product</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : !seller || seller.status !== "approved" ? (
        <ScrollView contentContainerStyle={styles.body}>
          {seller ? (
            <View style={styles.statusBanner}>
              <Ionicons name="time-outline" size={24} color="#6D28D9" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Seller Status: {seller.status.replace(/_/g, " ").toUpperCase()}</Text>
                <Text style={styles.statusDesc}>
                  {seller.status === "suspended"
                    ? "Your seller account is suspended. Contact Store Support."
                    : "Your application is under review by the Central Store Admin team. Approved sellers gain full access to product listings, inventory, orders, and weekly payouts."}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{seller ? "Update Seller Application" : "Become a Verified Seller"}</Text>
            <View style={styles.typeRow}>
              {(["individual", "business"] as const).map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, sellerType === t && styles.typeChipActive]} onPress={() => setSellerType(t)}>
                  <Text style={[styles.typeChipText, sellerType === t && styles.typeChipTextActive]}>
                    {t === "individual" ? "Individual / Alumni" : "Registered Business"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Store / Display Name *" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={legalName} onChangeText={setLegalName} placeholder="Legal / Business Name" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="Contact Phone" keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
            <TextInput style={[styles.input, { minHeight: 80 }]} value={description} onChangeText={setDescription} placeholder="Describe the products you plan to sell..." multiline placeholderTextColor="#94A3B8" />
            <Text style={styles.subHeading}>Payout Bank Details (for Weekly Settlements)</Text>
            <TextInput style={styles.input} value={bankHolder} onChangeText={setBankHolder} placeholder="Account Holder Name" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={bankLast4} onChangeText={setBankLast4} placeholder="Account Last 4 Digits" keyboardType="numeric" maxLength={4} placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={bankIfsc} onChangeText={setBankIfsc} placeholder="IFSC Code" autoCapitalize="characters" placeholderTextColor="#94A3B8" />

            <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed(!agreed)}>
              <Ionicons name={agreed ? "checkbox" : "square-outline"} size={20} color="#7C3AED" />
              <Text style={styles.agreeText}>I accept the Navodaya Connect Seller Agreement, category commission policy, and central return rules.</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => void submitApplication()} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Seller Application</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.tabBar}>
            {(["overview", "products", "orders", "earnings"] as SellerTab[]).map((t) => (
              <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadAll(); }} tintColor="#7C3AED" />}
          >
            {tab === "overview" && dashboard ? (
              <View style={styles.grid}>
                <View style={styles.metricCard}><Text style={styles.metricVal}>{dashboard.products.published}/{dashboard.products.total}</Text><Text style={styles.metricLbl}>Published Products</Text></View>
                <View style={styles.metricCard}><Text style={styles.metricVal}>{dashboard.orders.pendingFulfillment}</Text><Text style={styles.metricLbl}>Orders To Ship</Text></View>
                <View style={styles.metricCard}><Text style={styles.metricVal}>{rupees(dashboard.financials.grossSalesPaise)}</Text><Text style={styles.metricLbl}>Gross Sales</Text></View>
                <View style={styles.metricCard}><Text style={[styles.metricVal, { color: "#059669" }]}>{rupees(dashboard.financials.unpaidPayablePaise)}</Text><Text style={styles.metricLbl}>Next Weekly Payout</Text></View>
              </View>
            ) : null}

            {tab === "products" ? (
              products.length === 0 ? (
                <Text style={styles.emptyText}>No products yet. Tap + Product to submit your first listing.</Text>
              ) : (
                products.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>{p.name}</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{String(p.status).replace(/_/g, " ").toUpperCase()}</Text></View>
                    </View>
                    <Text style={styles.cardMeta}>{p.categoryName || "Category"} · {rupees(p.pricePaise)} · Stock: {p.stock}</Text>
                    {p.approvalFeedback ? <Text style={styles.feedbackText}>Admin note: {p.approvalFeedback}</Text> : null}
                    <View style={styles.stockRow}>
                      <TouchableOpacity style={styles.stockBtn} onPress={() => void updateStock(p.id, -1, p.stock)}><Text style={styles.stockBtnTxt}>-1 Stock</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.stockBtn} onPress={() => void updateStock(p.id, 5, p.stock)}><Text style={styles.stockBtnTxt}>+5 Stock</Text></TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            ) : null}

            {tab === "orders" ? (
              orders.length === 0 ? (
                <Text style={styles.emptyText}>No seller sub-orders yet.</Text>
              ) : (
                orders.map((o) => (
                  <View key={o.id} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>{o.orderNumber}</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{String(o.fulfillmentStatus).toUpperCase()}</Text></View>
                    </View>
                    <Text style={styles.cardMeta}>
                      Ship to: {o.shippingDestination?.recipientName} · {o.shippingDestination?.city}, {o.shippingDestination?.state} ({o.shippingDestination?.pincode})
                    </Text>
                    <Text style={styles.cardMeta}>Subtotal: {rupees(o.subtotalPaise)} · Payable: {rupees(o.sellerPayablePaise)}</Text>
                    {o.trackingNumber ? <Text style={styles.cardMeta}>Tracking: {o.carrier} · {o.trackingNumber}</Text> : null}
                    {["not_started", "processing", "packed"].includes(o.fulfillmentStatus) ? (
                      <TouchableOpacity style={styles.primaryBtn} onPress={() => setFulfillOrder(o)}>
                        <Text style={styles.primaryBtnText}>Mark Dispatched</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )
            ) : null}

            {tab === "earnings" && earnings ? (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>Weekly Payouts ({earnings.payouts.length})</Text>
                {earnings.payouts.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>{rupees(p.netPayablePaise)}</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{String(p.status).toUpperCase()}</Text></View>
                    </View>
                    <Text style={styles.cardMeta}>Gross: {rupees(p.grossPaise)} · Commission: {rupees(p.commissionPaise)} · Ref: {p.paymentReference || "Scheduled"}</Text>
                  </View>
                ))}
                <Text style={styles.sectionTitle}>Sub-Order Commission Ledger ({earnings.ledger.length})</Text>
                {earnings.ledger.map((l) => (
                  <View key={l.id} style={styles.card}>
                    <Text style={styles.cardMeta}>Gross: {rupees(l.subtotalPaise)} · Commission ({(l.commissionRateBps / 100).toFixed(1)}%): -{rupees(l.commissionPaise)} · Net: {rupees(l.sellerPayablePaise)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}

      <Modal visible={showAddProduct} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddProduct(false)}>
        <View style={[styles.container, { paddingTop: 16 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Submit New Product</Text>
            <TouchableOpacity onPress={() => setShowAddProduct(false)}><Ionicons name="close" size={22} color="#1E1B4B" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <TextInput style={styles.input} value={prodName} onChangeText={setProdName} placeholder="Product Name *" placeholderTextColor="#94A3B8" />
            <TextInput style={[styles.input, { minHeight: 80 }]} value={prodDesc} onChangeText={setProdDesc} placeholder="Product Description" multiline placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={prodPrice} onChangeText={setProdPrice} placeholder="Price in INR (e.g. 499) *" keyboardType="numeric" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={prodStock} onChangeText={setProdStock} placeholder="Initial Stock *" keyboardType="numeric" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={prodWeight} onChangeText={setProdWeight} placeholder="Weight in grams (e.g. 250)" keyboardType="numeric" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={prodImageUrl} onChangeText={setProdImageUrl} placeholder="HTTPS Image URL (optional)" placeholderTextColor="#94A3B8" />
            <Text style={styles.subHeading}>Category *</Text>
            <View style={styles.typeRow}>
              {categories.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.typeChip, prodCategoryId === c.id && styles.typeChipActive]} onPress={() => setProdCategoryId(c.id)}>
                  <Text style={[styles.typeChipText, prodCategoryId === c.id && styles.typeChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void submitProduct()} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit for Admin Approval</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!fulfillOrder} transparent animationType="fade" onRequestClose={() => setFulfillOrder(null)}>
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <Text style={styles.sectionTitle}>Dispatch Shipment</Text>
            <TextInput style={styles.input} value={carrier} onChangeText={setCarrier} placeholder="Courier / Carrier (e.g. Delhivery)" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={trackingNo} onChangeText={setTrackingNo} placeholder="Tracking Number" placeholderTextColor="#94A3B8" />
            <View style={styles.stockRow}>
              <TouchableOpacity style={styles.stockBtn} onPress={() => setFulfillOrder(null)}><Text style={styles.stockBtnTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={() => void markDispatched()}><Text style={styles.primaryBtnText}>Confirm Dispatch</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EDE9FE" },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  headerSub: { fontSize: 12, color: "#64748B", fontFamily: "Inter_400Regular" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7C3AED", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: "#EDE9FE" },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: "#F5F3FF" },
  tabBtnActive: { backgroundColor: "#7C3AED" },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6D28D9" },
  tabTextActive: { color: "#fff" },
  body: { padding: 16, gap: 12 },
  statusBanner: { flexDirection: "row", gap: 10, backgroundColor: "#EDE9FE", padding: 14, borderRadius: 14, alignItems: "flex-start" },
  statusTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#4C1D95" },
  statusDesc: { fontSize: 12, color: "#5B21B6", marginTop: 4, lineHeight: 18 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#EDE9FE", gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  subHeading: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#4C1D95", marginTop: 4 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" },
  typeChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  typeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6D28D9" },
  typeChipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#1E1B4B" },
  agreeRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 4 },
  agreeText: { flex: 1, fontSize: 12, color: "#475569", lineHeight: 18 },
  primaryBtn: { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#EDE9FE" },
  metricVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  metricLbl: { fontSize: 12, color: "#64748B", marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E1B4B", flex: 1 },
  cardMeta: { fontSize: 12, color: "#475569" },
  feedbackText: { fontSize: 12, color: "#B42318", backgroundColor: "#FEF2F2", padding: 8, borderRadius: 8 },
  badge: { backgroundColor: "#F5F3FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#6D28D9" },
  stockRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  stockBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" },
  stockBtnTxt: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#6D28D9" },
  emptyText: { textAlign: "center", color: "#64748B", paddingVertical: 32, fontSize: 13 },
  scrim: { flex: 1, backgroundColor: "rgba(15, 12, 35, 0.5)", justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 10 },
});
