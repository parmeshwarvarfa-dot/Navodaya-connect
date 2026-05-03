import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

interface CartItem extends Product {
  qty: number;
}

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "JNV Alumni T-Shirt", price: 499, description: "Premium cotton, official design", category: "Apparel" },
  { id: "p2", name: "Navodaya Mug", price: 299, description: "Ceramic mug with JNV logo", category: "Accessories" },
  { id: "p3", name: "Study Planner 2026", price: 199, description: "Academic planner for students", category: "Stationery" },
  { id: "p4", name: "JNV Cap", price: 349, description: "Stylish embroidered cap", category: "Apparel" },
  { id: "p5", name: "Motivational Poster Set", price: 149, description: "Set of 6 inspirational posters", category: "Stationery" },
  { id: "p6", name: "Alumni Directory 2025", price: 599, description: "Comprehensive alumni contact book", category: "Books" },
];

export default function StoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const addToCart = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const exists = prev.find((c) => c.id === product.id);
      if (exists) return prev.map((c) => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.id === id);
      if (item && item.qty > 1) return prev.map((c) => c.id === id ? { ...c, qty: c.qty - 1 } : c);
      return prev.filter((c) => c.id !== id);
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);
    await new Promise((r) => setTimeout(r, 800));
    setCart([]);
    setShowCart(false);
    setPlacingOrder(false);
    Alert.alert("Order Placed!", "Your order has been placed successfully. We'll contact you for delivery details.");
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
          <Text style={styles.headerTitle}>Store</Text>
          <TouchableOpacity style={styles.cartBtn} onPress={() => setShowCart(true)}>
            <Ionicons name="bag" size={22} color="#fff" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={MOCK_PRODUCTS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={[styles.grid, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const inCart = cart.find((c) => c.id === item.id);
          return (
            <PremiumCard style={styles.productCard} noPadding>
              <View style={[styles.productImg, { backgroundColor: colors.accent }]}>
                <Ionicons name="bag" size={32} color={colors.primary} />
              </View>
              <View style={styles.productBody}>
                <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.catText, { color: colors.mutedForeground }]}>{item.category}</Text>
                </View>
                <Text style={[styles.productName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.productDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
                <Text style={[styles.productPrice, { color: colors.primary }]}>₹{item.price}</Text>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: inCart ? colors.secondary : colors.primary, borderRadius: colors.radius - 6 }]}
                  onPress={() => addToCart(item)}
                >
                  <Ionicons name={inCart ? "checkmark" : "add"} size={16} color={inCart ? colors.primary : "#fff"} />
                  <Text style={[styles.addBtnText, { color: inCart ? colors.primary : "#fff" }]}>
                    {inCart ? `In Cart (${inCart.qty})` : "Add to Cart"}
                  </Text>
                </TouchableOpacity>
              </View>
            </PremiumCard>
          );
        }}
      />

      <Modal visible={showCart} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>My Cart ({cartCount})</Text>
            <TouchableOpacity onPress={() => setShowCart(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="bag-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyCartText, { color: colors.mutedForeground }]}>Cart is empty</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={[styles.cartItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.cartItemInfo}>
                    <Text style={[styles.cartItemName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.cartItemPrice, { color: colors.primary }]}>₹{item.price} × {item.qty}</Text>
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} style={[styles.qtyBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                      <Ionicons name="remove" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.qty}</Text>
                    <TouchableOpacity onPress={() => addToCart(item)} style={[styles.qtyBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            {cart.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[styles.totalAmount, { color: colors.primary }]}>₹{cartTotal}</Text>
              </View>
            )}
          </ScrollView>
          {cart.length > 0 && (
            <View style={[styles.checkoutBar, { padding: 20, borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <PremiumButton title={`Place Order • ₹${cartTotal}`} onPress={placeOrder} loading={placingOrder} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  cartBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#F59E0B", borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  grid: { padding: 10 },
  productCard: { flex: 1, margin: 6, overflow: "hidden" },
  productImg: { height: 100, alignItems: "center", justifyContent: "center" },
  productBody: { padding: 12 },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 6 },
  catText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  productName: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4, lineHeight: 18 },
  productDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginBottom: 6 },
  productPrice: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, gap: 4 },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20, flex: 1 },
  emptyCart: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyCartText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  cartItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 4 },
  cartItemPrice: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", minWidth: 20, textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16 },
  totalLabel: { fontSize: 18, fontFamily: "Inter_700Bold" },
  totalAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  checkoutBar: {},
});
