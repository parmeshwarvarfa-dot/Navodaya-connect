import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  featured?: boolean;
  soldOut?: boolean;
}

interface CartItem extends Product {
  qty: number;
}

const PRODUCTS: Product[] = [
  { id: "p1", name: "JNV Official Hoodie", price: 1299, description: "Premium quality hoodie with JNV logo. Available in all sizes.", category: "Merchandise", image: "https://picsum.photos/seed/hoodie/400/400", featured: true },
  { id: "p2", name: "JNV T-Shirt", price: 499, description: "Comfortable cotton t-shirt with JNV emblem.", category: "Merchandise", image: "https://picsum.photos/seed/tshirt/400/400", featured: true },
  { id: "p3", name: "JNV Cap", price: 349, description: "Official JNV cap with embroidered logo.", category: "Merchandise", image: "https://picsum.photos/seed/cap2026/400/400", soldOut: true },
  { id: "p4", name: "NCERT Physics Class 12", price: 250, description: "Latest edition NCERT Physics textbook for Class 12.", category: "Books", image: "https://picsum.photos/seed/physics/400/400" },
  { id: "p5", name: "JEE Preparation Notes", price: 799, description: "Comprehensive notes for JEE Main & Advanced by top scorers.", category: "Notes", image: "https://picsum.photos/seed/notes2026/400/400" },
  { id: "p6", name: "Stationery Kit", price: 199, description: "Complete stationery set including pens, pencils, eraser, and more.", category: "Stationery", image: "https://picsum.photos/seed/stationary/400/400" },
  { id: "p7", name: "JNV Mug", price: 299, description: "Ceramic mug with JNV logo. Perfect for morning chai.", category: "Merchandise", image: "https://picsum.photos/seed/mug2026/400/400" },
  { id: "p8", name: "UPSC Notes Bundle", price: 999, description: "Complete UPSC preparation notes by JNV alumni IAS officers.", category: "Notes", image: "https://picsum.photos/seed/upsc2026/400/400" },
  { id: "p9", name: "NCERT Biology Class 12", price: 220, description: "Essential for NEET preparation. Latest edition.", category: "Books", image: "https://picsum.photos/seed/biology2026/400/400" },
  { id: "p10", name: "JNV Notebook Set", price: 149, description: "Set of 5 premium notebooks with JNV branding.", category: "Stationery", image: "https://picsum.photos/seed/notebook/400/400" },
  { id: "p11", name: "JNV Jacket", price: 1599, description: "Winter jacket with JNV logo embroidery.", category: "Merchandise", image: "https://picsum.photos/seed/jacket2026/400/400" },
  { id: "p12", name: "Math Formula Book", price: 179, description: "Quick reference formula book for JEE/NEET/UPSC.", category: "Books", image: "https://picsum.photos/seed/math2026/400/400" },
];

const FILTERS = [
  { label: "All", emoji: "🔥" },
  { label: "Merch", emoji: "👕" },
  { label: "Books", emoji: "📚" },
  { label: "Notes", emoji: "📝" },
  { label: "Stationery", emoji: "✏️" },
];

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const featured = PRODUCTS.filter((p) => p.featured);
  const filtered = activeFilter === "All" ? PRODUCTS : PRODUCTS.filter((p) => {
    if (activeFilter === "Merch") return p.category === "Merchandise";
    return p.category === activeFilter;
  });

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (product: Product) => {
    if (product.soldOut) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0);
      return updated;
    });
  };

  const clearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setCart([]) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>JNV Store</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color="#3D5AF1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cartBtn} onPress={() => setShowCart(true)}>
            <Ionicons name="cart-outline" size={22} color="#fff" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {featured.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
              {featured.map((p) => (
                <View key={p.id} style={styles.featuredCard}>
                  <Image source={{ uri: p.image }} style={styles.featuredImage} resizeMode="cover" />
                  <View style={styles.featuredOverlay}>
                    <View style={styles.featuredBadge}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Text style={styles.featuredBadgeText}>Featured</Text>
                    </View>
                    <Text style={styles.featuredName}>{p.name}</Text>
                    <Text style={styles.featuredPrice}>₹{p.price}</Text>
                  </View>
                  <TouchableOpacity style={styles.featuredAddBtn} onPress={() => addToCart(p)}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.label}
                style={[styles.filterChip, activeFilter === f.label && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.label)}
              >
                <Text style={styles.filterEmoji}>{f.emoji}</Text>
                <Text style={[styles.filterText, activeFilter === f.label && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.productHeader}>
          <Text style={styles.productCount}>{filtered.length} products</Text>
          <TouchableOpacity style={styles.categoryBtn}>
            <Ionicons name="filter-outline" size={14} color="#6B7280" />
            <Text style={styles.categoryText}>All Categories</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.id === p.id);
            return (
              <View key={p.id} style={styles.productCard}>
                <View style={styles.productImageWrap}>
                  <Image source={{ uri: p.image }} style={styles.productImage} resizeMode="cover" />
                  {p.soldOut && (
                    <View style={styles.soldOutOverlay}>
                      <Text style={styles.soldOutText}>Sold Out</Text>
                    </View>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{p.category}</Text>
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>₹{p.price}</Text>
                    {!p.soldOut && (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => addToCart(p)}
                      >
                        <Ionicons name="add" size={14} color="#fff" />
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showCart} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <View>
              <Text style={styles.cartTitle}>Your Cart</Text>
              <Text style={styles.cartItemCount}>{cartCount} item{cartCount !== 1 ? "s" : ""}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCart(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cartContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={56} color="#D1D5DB" />
                <Text style={styles.emptyCartText}>Your cart is empty</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <Image source={{ uri: item.image }} style={styles.cartItemImage} resizeMode="cover" />
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartItemCat}>{item.category}</Text>
                    <Text style={styles.cartItemPrice}>₹{item.price}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                      <Ionicons name="remove" size={16} color="#374151" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                      <Ionicons name="add" size={16} color="#374151" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {cart.length > 0 && (
            <View style={styles.cartFooter}>
              <View style={styles.cartTotals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>₹{cartTotal}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery</Text>
                  <Text style={[styles.totalValue, { color: "#10B981" }]}>FREE</Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 8 }]}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>₹{cartTotal}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={() => Alert.alert("Checkout", "Proceeding to payment gateway...\n(Demo mode)")}
              >
                <Text style={styles.checkoutText}>Proceed to Checkout</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearCart}>
                <Text style={styles.clearCartText}>Clear Cart</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  headerRight: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  cartBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#3D5AF1",
    alignItems: "center", justifyContent: "center",
  },
  cartBadge: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: "#EF4444",
    width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  section: { paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", paddingHorizontal: 16, marginBottom: 12 },
  featuredScroll: { paddingLeft: 16, paddingRight: 8, gap: 12 },
  featuredCard: {
    width: 180, height: 180, borderRadius: 14,
    overflow: "hidden", position: "relative",
    marginRight: 4,
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
  },
  featuredBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    marginBottom: 4,
  },
  featuredBadgeText: { color: "#F59E0B", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  featuredName: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  featuredPrice: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  featuredAddBtn: {
    position: "absolute", bottom: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#3D5AF1",
    alignItems: "center", justifyContent: "center",
  },
  filterSection: { paddingTop: 16 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 24, backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  filterChipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  filterEmoji: { fontSize: 14 },
  filterText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  filterTextActive: { color: "#fff" },
  productHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  productCount: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  categoryBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  categoryText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, gap: 12,
  },
  productCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  productImageWrap: { width: "100%", height: 150, position: "relative" },
  productImage: { width: "100%", height: "100%" },
  soldOutOverlay: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6,
  },
  soldOutText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  productInfo: { padding: 10 },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    marginBottom: 5,
  },
  categoryBadgeText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  productName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#111827", lineHeight: 18, marginBottom: 3 },
  productDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 16, marginBottom: 8 },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#3D5AF1",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cartModal: { flex: 1, backgroundColor: "#fff" },
  cartHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  cartTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827" },
  cartItemCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  cartContent: { padding: 16, flexGrow: 1 },
  emptyCart: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyCartText: { fontSize: 16, fontFamily: "Inter_500Medium", color: "#6B7280" },
  cartItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  cartItemImage: { width: 64, height: 64, borderRadius: 10 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  cartItemCat: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  cartItemPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#3D5AF1", marginTop: 4 },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  qtyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", minWidth: 18, textAlign: "center" },
  cartFooter: {
    padding: 20, borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  cartTotals: { marginBottom: 16, gap: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280" },
  totalValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  grandLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  grandValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  checkoutBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 28,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
  },
  checkoutText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  clearCartText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
