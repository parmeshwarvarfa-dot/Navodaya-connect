import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  api,
  type StoreAddress,
  type StoreAddressInput,
  type StoreCartItem,
  type StoreCategory,
  type StoreCheckoutPreview,
  type StoreConfig,
  type StoreOrder,
  type StoreOrderDetails,
  type StoreProduct,
  type StoreReview,
  type StoreSeller,
} from "@/lib/api";

type StoreModal = "cart" | "checkout" | "orders" | "wishlist" | "seller" | "orderDetail" | "filter" | null;

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const emptyAddress: StoreAddressInput = {
  recipientName: "",
  phone: "",
  type: "home",
  line1: "",
  line2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  instructions: "",
  isDefault: true,
};

const PROMO_BANNERS = [
  {
    id: "b1",
    tag: "WINTER FESTIVAL",
    title: "Navodaya Crest Winter Hoodies",
    subtitle: "Heavyweight 360 GSM fleece. Exclusive colors.",
    discount: "UP TO 35% OFF",
    bgColors: ["#2E1065", "#4C1D95", "#6D28D9"] as const,
    icon: "shirt-outline" as const,
    categoryName: "Clothing & Apparel",
  },
  {
    id: "b2",
    tag: "HOUSE PRIDE",
    title: "Official House Badges & Collector Sets",
    subtitle: "Aravali • Nilgiri • Shivalik • Udaygiri enamel pins.",
    discount: "STARTING AT ₹299",
    bgColors: ["#1E1B4B", "#312E81", "#4338CA"] as const,
    icon: "shield-checkmark-outline" as const,
    categoryName: "Navodayan Merchandise",
  },
  {
    id: "b3",
    tag: "CAMPUS READY",
    title: "Rugged Ergonomic Backpacks & Sippers",
    subtitle: "Engineered for JNV campus life & competitive study.",
    discount: "FREE DELIVERY > ₹500",
    bgColors: ["#0F172A", "#1E293B", "#334155"] as const,
    icon: "backpack-outline" as const,
    categoryName: "Bags & Backpacks",
  },
  {
    id: "b4",
    tag: "ALUMNI SPECIAL",
    title: "Silver Jubilee Reunion Polos & Gifts",
    subtitle: "Connect with your roots. Made in India with pride.",
    discount: "LIMITED BATCH",
    bgColors: ["#3B0764", "#581C87", "#7E22CE"] as const,
    icon: "trophy-outline" as const,
    categoryName: "Alumni Reunion Merchandise",
  },
];

export default function Storefront({ showBack = false }: { showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const isWide = screenWidth >= 768;

  // Catalog State
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Search & Filter State
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeSort, setActiveSort] = useState("newest");
  const [priceFilter, setPriceFilter] = useState<"all" | "under500" | "500to1000" | "above1000">("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  // E-Commerce Functional State
  const [cart, setCart] = useState<StoreCartItem[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [wishlistProducts, setWishlistProducts] = useState<StoreProduct[]>([]);
  const [addresses, setAddresses] = useState<StoreAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressForm, setAddressForm] = useState<StoreAddressInput>(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking" | "cod">("upi");
  const [checkoutPreview, setCheckoutPreview] = useState<StoreCheckoutPreview | null>(null);
  const [placedOrder, setPlacedOrder] = useState<StoreOrderDetails | null>(null);
  const [orderHistory, setOrderHistory] = useState<StoreOrder[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<StoreOrderDetails | null>(null);
  const [sellerStatus, setSellerStatus] = useState<StoreSeller | null>(null);
  const [sellerFormName, setSellerFormName] = useState("");
  const [sellerFormDesc, setSellerFormDesc] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");

  // Product Detail Modal State
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [detailReviews, setDetailReviews] = useState<StoreReview[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [detailQty, setDetailQty] = useState(1);
  const [detailImageIdx, setDetailImageIdx] = useState(0);
  const [pincodeCheck, setPincodeCheck] = useState("");
  const [pincodeResult, setPincodeResult] = useState<string | null>(null);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");

  // Active Top Modal
  const [modal, setModal] = useState<StoreModal>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // 1. Load Categories and Service Config
  useEffect(() => {
    void api.store.categories().then(setCategories).catch(() => setCategories([]));
    void api.store.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  // 2. Banner auto-rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % PROMO_BANNERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // 3. Load Catalog Products
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError("");
    try {
      let minPricePaise: number | undefined;
      let maxPricePaise: number | undefined;
      if (priceFilter === "under500") maxPricePaise = 50000;
      else if (priceFilter === "500to1000") { minPricePaise = 50000; maxPricePaise = 100000; }
      else if (priceFilter === "above1000") minPricePaise = 100000;

      const result = await api.store.products({
        q: query.trim() || undefined,
        category: activeCategory || undefined,
        sort: activeSort,
        minPricePaise,
        maxPricePaise,
        page: 1,
        pageSize: 50,
      });

      let items = result.items || [];
      if (inStockOnly) {
        items = items.filter((p) => p.stock > 0);
      }
      setProducts(items);
    } catch (e: any) {
      setCatalogError(e?.message || "The Store catalog could not be loaded.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, query, activeSort, priceFilter, inStockOnly]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadCatalog(); }, 200);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

  // 4. Cart & Wishlist Synchronization
  const loadCart = useCallback(async () => {
    try {
      const data = await api.store.cart();
      setCart(data.items || []);
    } catch {
      setCart([]);
    }
  }, []);

  const loadWishlist = useCallback(async () => {
    try {
      const data = await api.store.wishlist();
      const items = data.items || [];
      setWishlistProducts(items);
      setWishlist(new Set(items.map((i) => i.id)));
    } catch {
      setWishlist(new Set());
      setWishlistProducts([]);
    }
  }, []);

  useEffect(() => {
    void loadCart();
    void loadWishlist();
  }, [loadCart, loadWishlist]);

  const cartTotalQty = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotalPaise = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.pricePaise, 0), [cart]);

  // Add / Update Cart Item
  const handleAddToCart = async (product: StoreProduct, selection: Record<string, string> = {}, qty = 1) => {
    const variants = product.variants || [];
    if (variants.length > 0 && variants.some((v) => !selection[v.name])) {
      Alert.alert("Select Options", "Please select all available options (such as size/color) before adding to cart.");
      return;
    }
    setBusy(true);
    try {
      const variantSelectionStr = JSON.stringify(Object.fromEntries(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b))));
      const existing = cart.find(
        (c) => c.productId === product.id && (c.variantSelection || "{}") === variantSelectionStr
      );
      const newQty = (existing?.quantity ?? 0) + qty;
      await api.store.setCartItem(product.id, newQty, selection);
      await loadCart();
      showToast(`Added ${product.name} to cart`);
    } catch (err: any) {
      Alert.alert("Notice", err?.message || "Could not add item to cart.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCartQty = async (item: StoreCartItem, newQty: number) => {
    if (newQty <= 0) {
      try {
        await api.store.removeCartItem(item.id);
        await loadCart();
        showToast("Item removed from cart");
      } catch {
        // ignore
      }
      return;
    }
    try {
      const sel = JSON.parse(item.variantSelection || "{}");
      await api.store.setCartItem(item.productId, newQty, sel);
      await loadCart();
    } catch (err: any) {
      Alert.alert("Notice", err?.message || "Could not update quantity.");
    }
  };

  // Wishlist Toggle
  const handleToggleWishlist = async (product: StoreProduct) => {
    const isSaved = wishlist.has(product.id);
    try {
      if (isSaved) {
        await api.store.removeWishlist(product.id);
        setWishlist((prev) => { const n = new Set(prev); n.delete(product.id); return n; });
        setWishlistProducts((prev) => prev.filter((p) => p.id !== product.id));
        showToast("Removed from Wishlist");
      } else {
        await api.store.saveWishlist(product.id);
        setWishlist((prev) => new Set(prev).add(product.id));
        setWishlistProducts((prev) => [product, ...prev]);
        showToast("Saved to Wishlist");
      }
    } catch (err: any) {
      if (err?.status === 401) {
        Alert.alert("Sign In Required", "Please sign in to save items to your personal wishlist.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/(auth)/sign-in" as any) },
        ]);
      }
    }
  };

  // Open Product Detail Modal
  const openProductDetail = async (product: StoreProduct) => {
    setDetailProduct(product);
    setDetailQty(1);
    setDetailImageIdx(0);
    setSelectedVariants({});
    setPincodeResult(null);

    // Set default variants if available
    if (product.variants && product.variants.length > 0) {
      const initialVar: Record<string, string> = {};
      product.variants.forEach((v) => {
        if (v.options && v.options[0]) initialVar[v.name] = v.options[0].value;
      });
      setSelectedVariants(initialVar);
    }

    try {
      const reviews = await api.store.reviews(product.id);
      setDetailReviews(reviews || []);
    } catch {
      setDetailReviews([]);
    }
  };

  // Pincode Check
  const checkServiceability = () => {
    if (!/^\d{6}$/.test(pincodeCheck.trim())) {
      setPincodeResult("Enter a valid 6-digit Indian PIN code.");
      return;
    }
    const pin = pincodeCheck.trim();
    if (["11", "12", "20", "22", "30", "40", "41", "50", "56", "60", "70", "80"].some(p => pin.startsWith(p))) {
      setPincodeResult("✅ Delivery Available! Estimated delivery in 3-5 business days. Campus drop supported.");
    } else {
      setPincodeResult("✅ Standard Postal & Courier Delivery Available (5-7 business days).");
    }
  };

  // Checkout Flow
  const startCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Add some products to your cart first.");
      return;
    }
    setBusy(true);
    try {
      const addrList = await api.store.addresses();
      setAddresses(addrList || []);
      const defaultAddr = addrList.find((a) => a.isDefault) || addrList[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        const prev = await api.store.previewCheckout(defaultAddr.id);
        setCheckoutPreview(prev);
      } else {
        setShowAddressForm(true);
      }
      setModal("checkout");
    } catch (err: any) {
      if (err?.status === 401) {
        Alert.alert("Sign In to Checkout", "Sign in to select your delivery address and complete checkout.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/(auth)/sign-in" as any) },
        ]);
      } else {
        Alert.alert("Checkout Error", err?.message || "Could not initialize checkout.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSelectAddress = async (addrId: string) => {
    setSelectedAddressId(addrId);
    try {
      const prev = await api.store.previewCheckout(addrId);
      setCheckoutPreview(prev);
    } catch {
      // ignore
    }
  };

  const handleSaveAddress = async () => {
    setBusy(true);
    try {
      const saved = await api.store.addAddress(addressForm);
      setAddresses((prev) => [saved, ...prev]);
      setSelectedAddressId(saved.id);
      setShowAddressForm(false);
      setAddressForm(emptyAddress);
      const prev = await api.store.previewCheckout(saved.id);
      setCheckoutPreview(prev);
      showToast("Delivery address saved");
    } catch (err: any) {
      Alert.alert("Address Error", err?.message || "Could not save address. Check all fields.");
    } finally {
      setBusy(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      Alert.alert("Address Required", "Please select or add a delivery address.");
      return;
    }
    setBusy(true);
    try {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const order = await api.store.placeOrder(selectedAddressId, idempotencyKey, paymentMethod);
      setPlacedOrder(order);
      await loadCart();
      showToast("Order placed successfully!");
    } catch (err: any) {
      Alert.alert("Order Processing Failed", err?.message || "Could not place your order. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  // Order History Flow
  const openOrderHistory = async () => {
    setBusy(true);
    try {
      const res = await api.store.orders();
      setOrderHistory(res.items || []);
      setModal("orders");
    } catch (err: any) {
      if (err?.status === 401) {
        Alert.alert("Sign In Required", "Please sign in to view your orders.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/(auth)/sign-in" as any) },
        ]);
      } else {
        Alert.alert("Notice", "Could not load order history.");
      }
    } finally {
      setBusy(false);
    }
  };

  const viewOrderDetails = async (orderId: string) => {
    setBusy(true);
    try {
      const details = await api.store.order(orderId);
      setSelectedOrderDetails(details);
      setModal("orderDetail");
    } catch (err: any) {
      Alert.alert("Notice", err?.message || "Could not load order details.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert("Cancel Order?", "Are you sure you want to cancel this order?", [
      { text: "Keep Order", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await api.store.cancelOrder(orderId, "Customer requested cancellation");
            showToast("Order has been cancelled");
            if (selectedOrderDetails?.id === orderId) {
              const updated = await api.store.order(orderId);
              setSelectedOrderDetails(updated);
            }
            const res = await api.store.orders();
            setOrderHistory(res.items || []);
          } catch (err: any) {
            Alert.alert("Notice", err?.message || "Could not cancel order.");
          }
        },
      },
    ]);
  };

  // Apply Coupon
  const handleApplyCoupon = () => {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (code === "JNVFIRST") {
      setAppliedDiscount(Math.floor(cartSubtotalPaise * 0.1));
      showToast("Coupon JNVFIRST applied! 10% off");
    } else if (code === "ALUMNI20") {
      setAppliedDiscount(Math.floor(cartSubtotalPaise * 0.2));
      showToast("Coupon ALUMNI20 applied! 20% off");
    } else {
      setCouponError("Invalid coupon code. Try JNVFIRST or ALUMNI20.");
    }
  };

  // Seller Flow
  const openSellerZone = async () => {
    try {
      const me = await api.store.sellerApplication();
      setSellerStatus(me);
    } catch {
      setSellerStatus(null);
    }
    setModal("seller");
  };

  const handleApplySeller = async () => {
    if (!sellerFormName.trim()) {
      Alert.alert("Store Name Required", "Enter your store or business display name.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.store.applyAsSeller(sellerFormName.trim(), sellerFormDesc.trim());
      setSellerStatus(res);
      showToast("Seller application submitted for review!");
    } catch (err: any) {
      Alert.alert("Application Error", err?.message || "Could not submit application.");
    } finally {
      setBusy(false);
    }
  };

  // Submit Review Flow
  const handleSubmitReview = async () => {
    if (!detailProduct) return;
    if (!reviewBody.trim()) {
      Alert.alert("Review Required", "Please write a few words about your experience with this product.");
      return;
    }
    setBusy(true);
    try {
      await api.store.submitReview(detailProduct.id, reviewRating, reviewBody.trim());
      showToast("Review submitted successfully!");
      setShowReviewModal(false);
      setReviewBody("");
      const revs = await api.store.reviews(detailProduct.id);
      setDetailReviews(revs || []);
    } catch (err: any) {
      Alert.alert("Review Notice", err?.message || "Reviews are enabled after ordering this product.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER & SEARCH BAR */}
      <LinearGradient colors={["#2E1065", "#4C1D95", "#6D28D9"]} style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <View style={styles.headerTopRow}>
          {showBack && (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.brandContainer}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="cart" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.brandTitle}>JNV Store</Text>
              <Text style={styles.brandSubtitle}>OFFICIAL NAVODAYA MARKETPLACE</Text>
            </View>
          </View>

          {/* Action shortcuts */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={openOrderHistory} style={styles.headerIconBtn} accessibilityLabel="My orders">
              <Ionicons name="cube-outline" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModal("wishlist")} style={styles.headerIconBtn} accessibilityLabel="Wishlist">
              <Ionicons name="heart-outline" size={20} color="#fff" />
              {wishlist.size > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{wishlist.size}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModal("cart")} style={styles.cartIconBtn} accessibilityLabel="Shopping cart">
              <Ionicons name="cart" size={20} color="#fff" />
              {cartTotalQty > 0 && (
                <View style={[styles.badgeWrap, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.badgeText}>{cartTotalQty}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar Input */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color="#7C3AED" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hoodies, bags, pins, diaries, bottles..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setModal("filter")} style={styles.filterBtn} accessibilityLabel="Filter options">
            <Ionicons name="options-outline" size={18} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* PROMOTIONAL HERO BANNER CAROUSEL */}
        <View style={styles.bannerContainer}>
          {(() => {
            const b = PROMO_BANNERS[activeBannerIdx];
            return (
              <LinearGradient colors={b.bgColors} style={styles.bannerCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>{b.tag}</Text>
                </View>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
                <View style={styles.bannerBottomRow}>
                  <View style={styles.bannerDiscountPill}>
                    <Text style={styles.bannerDiscountText}>{b.discount}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.bannerActionBtn}
                    onPress={() => {
                      const matchedCat = categories.find((c) => c.name.toLowerCase().includes(b.categoryName.toLowerCase()));
                      if (matchedCat) setActiveCategory(matchedCat.name);
                    }}
                  >
                    <Text style={styles.bannerActionText}>Shop Collection</Text>
                    <Ionicons name="arrow-forward" size={14} color="#2E1065" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            );
          })()}

          {/* Dots Indicator */}
          <View style={styles.bannerDotsRow}>
            {PROMO_BANNERS.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setActiveBannerIdx(idx)}
                style={[styles.bannerDot, idx === activeBannerIdx && styles.bannerDotActive]}
              />
            ))}
          </View>
        </View>

        {/* TRUST & SERVICE BADGES STRIP */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={16} color="#7C3AED" />
            <Text style={styles.trustText}>100% Verified Gear</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="navigate-circle" size={16} color="#7C3AED" />
            <Text style={styles.trustText}>Campus Delivery</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="sync-circle" size={16} color="#7C3AED" />
            <Text style={styles.trustText}>7-Day Returns</Text>
          </View>
        </View>

        {/* 3. CATEGORIES SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          {activeCategory ? (
            <TouchableOpacity onPress={() => setActiveCategory("")}>
              <Text style={styles.sectionActionText}>Show All</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, !activeCategory && styles.categoryChipActive]}
            onPress={() => setActiveCategory("")}
          >
            <Ionicons name="apps" size={14} color={!activeCategory ? "#fff" : "#4C1D95"} />
            <Text style={[styles.categoryChipText, !activeCategory && styles.categoryChipTextActive]}>All Items</Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setActiveCategory(isActive ? "" : cat.name)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 4. SELLER BANNER SHORTCUT */}
        <TouchableOpacity style={styles.sellerAdBanner} onPress={openSellerZone}>
          <View style={styles.sellerAdIconWrap}>
            <Ionicons name="business" size={20} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerAdTitle}>Are you a Navodayan Entrepreneur?</Text>
            <Text style={styles.sellerAdSubtitle}>Sell your merchandise & approved academic products on JNV Store.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
        </TouchableOpacity>

        {/* 5. FILTER & SORT TOOLBAR */}
        <View style={styles.toolbarRow}>
          <Text style={styles.productCountText}>
            {loading ? "Searching..." : `${products.length} Products available`}
          </Text>

          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={[styles.sortPill, activeSort === "price_asc" && styles.sortPillActive]}
              onPress={() => setActiveSort((prev) => (prev === "price_asc" ? "price_desc" : "price_asc"))}
            >
              <Ionicons
                name={activeSort === "price_asc" ? "trending-up" : "trending-down"}
                size={14}
                color={activeSort.startsWith("price") ? "#7C3AED" : "#6B7280"}
              />
              <Text style={[styles.sortPillText, activeSort.startsWith("price") && styles.sortPillTextActive]}>
                Price {activeSort === "price_asc" ? "↑" : "↓"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewModeBtn}
              onPress={() => setViewMode((prev) => (prev === "grid" ? "list" : "grid"))}
              accessibilityLabel="Toggle view mode"
            >
              <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={16} color="#4B5563" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. PRODUCT CATALOG LISTING */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Fetching authentic JNV merchandise...</Text>
          </View>
        ) : catalogError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={32} color="#DC2626" />
            <Text style={styles.errorTitle}>Could not load Store catalog</Text>
            <Text style={styles.errorMsg}>{catalogError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void loadCatalog()}>
              <Text style={styles.retryBtnText}>Retry Catalog</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="basket-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyMsg}>
              {query || activeCategory || priceFilter !== "all"
                ? "Try clearing your search terms or filters to see available items."
                : "No products have been published yet."}
            </Text>
            {(query || activeCategory || priceFilter !== "all" || inStockOnly) && (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => {
                  setQuery("");
                  setActiveCategory("");
                  setPriceFilter("all");
                  setInStockOnly(false);
                }}
              >
                <Text style={styles.clearFiltersBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={viewMode === "grid" ? styles.productGrid : styles.productList}>
            {products.map((product) => {
              const isWish = wishlist.has(product.id);
              const hasDiscount = (product.discountPercent ?? 0) > 0;
              const imageUrl = product.images && product.images[0] ? product.images[0] : null;

              if (viewMode === "list") {
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.listCard}
                    activeOpacity={0.88}
                    onPress={() => void openProductDetail(product)}
                  >
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.listImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.listImage, styles.imagePlaceholder]}>
                        <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.listInfo}>
                      <View style={styles.listHeaderRow}>
                        <Text style={styles.productBrand}>{product.brand || "Navodaya Official"}</Text>
                        <TouchableOpacity onPress={() => void handleToggleWishlist(product)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name={isWish ? "heart" : "heart-outline"} size={18} color={isWish ? "#EF4444" : "#9CA3AF"} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.productTitle} numberOfLines={2}>{product.name}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceCurrent}>{rupees(product.pricePaise)}</Text>
                        {product.originalPricePaise && product.originalPricePaise > product.pricePaise ? (
                          <Text style={styles.priceOriginal}>{rupees(product.originalPricePaise)}</Text>
                        ) : null}
                        {hasDiscount && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>{product.discountPercent}% OFF</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.listFooter}>
                        <Text style={[styles.stockText, product.stock <= 5 && styles.stockTextLow]}>
                          {product.stock > 0 ? (product.stock <= 5 ? `Only ${product.stock} left!` : "In Stock") : "Out of stock"}
                        </Text>
                        <TouchableOpacity
                          style={[styles.quickAddBtn, product.stock === 0 && styles.btnDisabled]}
                          disabled={product.stock === 0}
                          onPress={() => void handleAddToCart(product)}
                        >
                          <Ionicons name="cart-outline" size={14} color="#fff" />
                          <Text style={styles.quickAddBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.gridCard, { width: (screenWidth - 36) / 2 }]}
                  activeOpacity={0.88}
                  onPress={() => void openProductDetail(product)}
                >
                  <View style={styles.cardImageContainer}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.gridImage, styles.imagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                      </View>
                    )}
                    {hasDiscount && (
                      <View style={styles.gridDiscountTag}>
                        <Text style={styles.gridDiscountTagText}>{product.discountPercent}% OFF</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.gridWishlistBtn}
                      onPress={() => void handleToggleWishlist(product)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Save to wishlist"
                    >
                      <Ionicons name={isWish ? "heart" : "heart-outline"} size={17} color={isWish ? "#EF4444" : "#4B5563"} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.gridInfo}>
                    <Text style={styles.productBrand} numberOfLines={1}>{product.brand || "Navodaya"}</Text>
                    <Text style={styles.productTitle} numberOfLines={2}>{product.name}</Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceCurrent}>{rupees(product.pricePaise)}</Text>
                      {product.originalPricePaise && product.originalPricePaise > product.pricePaise ? (
                        <Text style={styles.priceOriginal}>{rupees(product.originalPricePaise)}</Text>
                      ) : null}
                    </View>

                    <View style={styles.gridBottomRow}>
                      <Text style={[styles.stockText, product.stock <= 5 && styles.stockTextLow]}>
                        {product.stock > 0 ? (product.stock <= 5 ? `Only ${product.stock} left` : "In Stock") : "Out of stock"}
                      </Text>
                      <TouchableOpacity
                        style={[styles.gridAddBtn, product.stock === 0 && styles.btnDisabled]}
                        disabled={product.stock === 0}
                        onPress={() => void handleAddToCart(product)}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 7. TOAST MESSAGE PILL */}
      {toastMsg ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* 8. PRODUCT DETAIL MODAL */}
      <Modal visible={!!detailProduct} animationType="slide" onRequestClose={() => setDetailProduct(null)}>
        {detailProduct && (
          <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetailProduct(null)} style={styles.modalBackBtn}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>Product Details</Text>
              <TouchableOpacity onPress={() => void handleToggleWishlist(detailProduct)} style={styles.modalBackBtn}>
                <Ionicons name={wishlist.has(detailProduct.id) ? "heart" : "heart-outline"} size={22} color={wishlist.has(detailProduct.id) ? "#EF4444" : "#4B5563"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {/* Product Image Gallery */}
              <View style={styles.detailGallery}>
                <Image
                  source={{ uri: detailProduct.images[detailImageIdx] || "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80" }}
                  style={styles.detailMainImage}
                  resizeMode="contain"
                />
                {detailProduct.images.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailThumbnailRow}>
                    {detailProduct.images.map((img, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setDetailImageIdx(i)}
                        style={[styles.detailThumbnail, i === detailImageIdx && styles.detailThumbnailActive]}
                      >
                        <Image source={{ uri: img }} style={styles.thumbnailImg} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.detailContent}>
                <View style={styles.detailBrandBadge}>
                  <Text style={styles.detailBrandText}>{detailProduct.brand || "Navodaya Connect Official"}</Text>
                </View>
                <Text style={styles.detailTitle}>{detailProduct.name}</Text>

                {/* Rating summary */}
                <View style={styles.detailRatingRow}>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name="star" size={14} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.ratingCountText}>
                    4.8 ({detailReviews.length > 0 ? `${detailReviews.length} reviews` : "Verified Campus Quality"})
                  </Text>
                </View>

                {/* Price block */}
                <View style={styles.detailPriceBlock}>
                  <Text style={styles.detailCurrentPrice}>{rupees(detailProduct.pricePaise)}</Text>
                  {detailProduct.originalPricePaise && detailProduct.originalPricePaise > detailProduct.pricePaise ? (
                    <>
                      <Text style={styles.detailOriginalPrice}>{rupees(detailProduct.originalPricePaise)}</Text>
                      <View style={styles.detailSavingsBadge}>
                        <Text style={styles.detailSavingsText}>Save {detailProduct.discountPercent}%</Text>
                      </View>
                    </>
                  ) : null}
                </View>
                <Text style={styles.taxInclusiveText}>Inclusive of all applicable taxes</Text>

                {/* Variant Selection */}
                {detailProduct.variants && detailProduct.variants.length > 0 && (
                  <View style={styles.variantsBlock}>
                    {detailProduct.variants.map((v) => (
                      <View key={v.name} style={styles.variantGroup}>
                        <Text style={styles.variantGroupTitle}>Select {v.name}:</Text>
                        <View style={styles.variantOptionsRow}>
                          {v.options.map((opt) => {
                            const isSelected = selectedVariants[v.name] === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                onPress={() => setSelectedVariants((prev) => ({ ...prev, [v.name]: opt.value }))}
                                style={[
                                  styles.variantOptionChip,
                                  isSelected && styles.variantOptionChipActive,
                                  opt.stock === 0 && styles.variantOptionDisabled,
                                ]}
                                disabled={opt.stock === 0}
                              >
                                <Text style={[styles.variantOptionText, isSelected && styles.variantOptionTextActive]}>
                                  {opt.value}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Quantity Stepper */}
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>Quantity:</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      onPress={() => setDetailQty((q) => Math.max(1, q - 1))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="remove" size={16} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{detailQty}</Text>
                    <TouchableOpacity
                      onPress={() => setDetailQty((q) => Math.min(detailProduct.stock || 99, q + 1))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="add" size={16} color="#1F2937" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stockNote}>
                    {detailProduct.stock > 0 ? `(${detailProduct.stock} available)` : "(Out of stock)"}
                  </Text>
                </View>

                {/* Pincode checker */}
                <View style={styles.pincodeBox}>
                  <Text style={styles.pincodeTitle}>Check Delivery to your Campus or Home:</Text>
                  <View style={styles.pincodeInputRow}>
                    <TextInput
                      style={styles.pincodeInput}
                      placeholder="Enter 6-digit Pincode"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={pincodeCheck}
                      onChangeText={setPincodeCheck}
                    />
                    <TouchableOpacity style={styles.pincodeBtn} onPress={checkServiceability}>
                      <Text style={styles.pincodeBtnText}>Check</Text>
                    </TouchableOpacity>
                  </View>
                  {pincodeResult ? (
                    <Text style={[styles.pincodeResultText, pincodeResult.startsWith("✅") ? styles.pincodeOk : styles.pincodeErr]}>
                      {pincodeResult}
                    </Text>
                  ) : null}
                </View>

                {/* Description */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>Description</Text>
                  <Text style={styles.infoSectionBody}>{detailProduct.description}</Text>
                </View>

                {/* Specifications Grid */}
                {detailProduct.specifications && Object.keys(detailProduct.specifications).length > 0 && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoSectionTitle}>Specifications</Text>
                    <View style={styles.specsTable}>
                      {Object.entries(detailProduct.specifications).map(([key, val]) => (
                        <View key={key} style={styles.specsRow}>
                          <Text style={styles.specsKey}>{key}</Text>
                          <Text style={styles.specsVal}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Reviews */}
                <View style={styles.infoSection}>
                  <View style={styles.reviewsHeaderRow}>
                    <Text style={styles.infoSectionTitle}>Customer Reviews ({detailReviews.length})</Text>
                    <TouchableOpacity onPress={() => setShowReviewModal(true)}>
                      <Text style={styles.writeReviewBtnText}>+ Write Review</Text>
                    </TouchableOpacity>
                  </View>

                  {detailReviews.length === 0 ? (
                    <Text style={styles.emptyReviewsText}>No written reviews yet. Be the first verified buyer to leave a review!</Text>
                  ) : (
                    detailReviews.map((rev) => (
                      <View key={rev.id} style={styles.reviewItem}>
                        <View style={styles.reviewTopRow}>
                          <Text style={styles.reviewerName}>{rev.reviewer || "Navodayan Buyer"}</Text>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Ionicons key={s} name="star" size={12} color={s <= rev.rating ? "#F59E0B" : "#D1D5DB"} />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.reviewBody}>{rev.body}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Fixed Action Bar */}
            <View style={[styles.detailBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={styles.detailCartBtn}
                onPress={() => {
                  void handleAddToCart(detailProduct, selectedVariants, detailQty);
                }}
              >
                <Ionicons name="cart-outline" size={18} color="#7C3AED" />
                <Text style={styles.detailCartBtnText}>Add to Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailBuyNowBtn}
                onPress={async () => {
                  await handleAddToCart(detailProduct, selectedVariants, detailQty);
                  setDetailProduct(null);
                  void startCheckout();
                }}
              >
                <Text style={styles.detailBuyNowBtnText}>Buy Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* 9. CART DRAWER / MODAL */}
      <Modal visible={modal === "cart"} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Shopping Cart ({cartTotalQty})</Text>
            <View style={{ width: 40 }} />
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCartWrap}>
              <Ionicons name="cart-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyCartTitle}>Your cart is currently empty</Text>
              <Text style={styles.emptyCartSubtitle}>Explore our authentic JNV merchandise, apparel, and campus essentials!</Text>
              <TouchableOpacity style={styles.continueShopBtn} onPress={() => setModal(null)}>
                <Text style={styles.continueShopBtnText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.cartList} showsVerticalScrollIndicator={false}>
                {/* Free Delivery Bar */}
                <View style={styles.freeShippingNotice}>
                  <Ionicons name="gift-outline" size={16} color="#7C3AED" />
                  <Text style={styles.freeShippingText}>
                    {cartSubtotalPaise >= 50000
                      ? "🎉 You unlocked FREE Campus & Home Delivery!"
                      : `Add ${rupees(50000 - cartSubtotalPaise)} more for FREE Delivery!`}
                  </Text>
                </View>

                {/* Cart Items */}
                {cart.map((item) => {
                  let variantsLabel = "";
                  try {
                    const sel = JSON.parse(item.variantSelection || "{}");
                    variantsLabel = Object.entries(sel).map(([k, v]) => `${k}: ${v}`).join(" | ");
                  } catch {
                    // ignore
                  }
                  const img = item.images && item.images[0] ? item.images[0] : null;

                  return (
                    <View key={item.id} style={styles.cartCard}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.cartItemImg} />
                      ) : (
                        <View style={[styles.cartItemImg, styles.imagePlaceholder]}>
                          <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                        </View>
                      )}
                      <View style={styles.cartItemBody}>
                        <Text style={styles.cartItemName} numberOfLines={2}>{item.productName}</Text>
                        {variantsLabel ? (
                          <Text style={styles.cartItemVariant}>{variantsLabel}</Text>
                        ) : null}
                        <Text style={styles.cartItemPrice}>{rupees(item.pricePaise)}</Text>

                        <View style={styles.cartControlsRow}>
                          <View style={styles.cartStepper}>
                            <TouchableOpacity onPress={() => void handleUpdateCartQty(item, item.quantity - 1)} style={styles.cartStepperBtn}>
                              <Ionicons name="remove" size={14} color="#1F2937" />
                            </TouchableOpacity>
                            <Text style={styles.cartStepperVal}>{item.quantity}</Text>
                            <TouchableOpacity onPress={() => void handleUpdateCartQty(item, item.quantity + 1)} style={styles.cartStepperBtn}>
                              <Ionicons name="add" size={14} color="#1F2937" />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity onPress={() => void handleUpdateCartQty(item, 0)} style={styles.removeCartBtn}>
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                            <Text style={styles.removeCartText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Coupon Code Section */}
                <View style={styles.couponCard}>
                  <Text style={styles.couponTitle}>Apply Promo Code</Text>
                  <View style={styles.couponInputRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Try JNVFIRST or ALUMNI20"
                      placeholderTextColor="#9CA3AF"
                      value={couponCode}
                      onChangeText={setCouponCode}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity style={styles.couponApplyBtn} onPress={handleApplyCoupon}>
                      <Text style={styles.couponApplyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                  {couponError ? <Text style={styles.couponErrorText}>{couponError}</Text> : null}
                  {appliedDiscount > 0 ? (
                    <Text style={styles.couponSuccessText}>Coupon applied: -{rupees(appliedDiscount)}</Text>
                  ) : null}
                </View>

                {/* Bill Summary */}
                <View style={styles.billCard}>
                  <Text style={styles.billTitle}>Price Summary</Text>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Items Subtotal</Text>
                    <Text style={styles.billVal}>{rupees(cartSubtotalPaise)}</Text>
                  </View>
                  {appliedDiscount > 0 && (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: "#10B981" }]}>Coupon Discount</Text>
                      <Text style={[styles.billVal, { color: "#10B981" }]}>-{rupees(appliedDiscount)}</Text>
                    </View>
                  )}
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Delivery Charges</Text>
                    <Text style={styles.billVal}>
                      {cartSubtotalPaise >= 50000 ? "FREE" : "₹49"}
                    </Text>
                  </View>
                  <View style={styles.billDivider} />
                  <View style={styles.billRow}>
                    <Text style={styles.billTotalLabel}>Total Payable</Text>
                    <Text style={styles.billTotalVal}>
                      {rupees(Math.max(0, cartSubtotalPaise - appliedDiscount + (cartSubtotalPaise >= 50000 ? 0 : 4900)))}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Checkout Fixed Button */}
              <View style={[styles.cartBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bottomBarLabel}>Total Amount:</Text>
                  <Text style={styles.bottomBarTotal}>
                    {rupees(Math.max(0, cartSubtotalPaise - appliedDiscount + (cartSubtotalPaise >= 50000 ? 0 : 4900)))}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => {
                    setModal(null);
                    void startCheckout();
                  }}
                >
                  <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* 10. CHECKOUT MODAL */}
      <Modal visible={modal === "checkout"} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Secure Checkout</Text>
            <View style={{ width: 40 }} />
          </View>

          {placedOrder ? (
            <View style={styles.orderSuccessCard}>
              <Ionicons name="checkmark-circle" size={72} color="#10B981" />
              <Text style={styles.orderSuccessTitle}>Order Confirmed!</Text>
              <Text style={styles.orderNumberText}>Order ID: {placedOrder.orderNumber}</Text>
              <Text style={styles.orderSuccessMsg}>
                Thank you for supporting the Navodaya Connect community. We have initiated dispatch to your delivery address.
              </Text>
              <View style={styles.successActions}>
                <TouchableOpacity
                  style={styles.viewOrderBtn}
                  onPress={() => {
                    setPlacedOrder(null);
                    setModal(null);
                    void viewOrderDetails(placedOrder.id);
                  }}
                >
                  <Text style={styles.viewOrderBtnText}>Track Your Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backToStoreBtn}
                  onPress={() => {
                    setPlacedOrder(null);
                    setModal(null);
                  }}
                >
                  <Text style={styles.backToStoreBtnText}>Continue Shopping</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.checkoutScroll} showsVerticalScrollIndicator={false}>
                {/* Delivery Address Section */}
                <View style={styles.checkoutSection}>
                  <View style={styles.checkoutSectionHeader}>
                    <Text style={styles.checkoutSectionTitle}>1. Delivery Address</Text>
                    <TouchableOpacity onPress={() => setShowAddressForm(!showAddressForm)}>
                      <Text style={styles.addAddressToggleText}>{showAddressForm ? "Select Saved" : "+ Add New"}</Text>
                    </TouchableOpacity>
                  </View>

                  {showAddressForm ? (
                    <View style={styles.addressForm}>
                      <TextInput
                        style={styles.inputField}
                        placeholder="Full Name (Recipient)"
                        value={addressForm.recipientName}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, recipientName: t }))}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="10-Digit Mobile Phone"
                        keyboardType="phone-pad"
                        value={addressForm.phone}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, phone: t }))}
                      />
                      <View style={styles.addrTypeRow}>
                        {(["home", "hostel", "school", "other"] as const).map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.addrTypeChip, addressForm.type === type && styles.addrTypeChipActive]}
                            onPress={() => setAddressForm((f) => ({ ...f, type }))}
                          >
                            <Text style={[styles.addrTypeText, addressForm.type === type && styles.addrTypeTextActive]}>
                              {type.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={styles.inputField}
                        placeholder="House/Room No., Building/Hostel Name"
                        value={addressForm.line1}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, line1: t }))}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Street, Landmark, Campus Area"
                        value={addressForm.line2}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, line2: t }))}
                      />
                      <View style={styles.twoColRow}>
                        <TextInput
                          style={[styles.inputField, { flex: 1, marginRight: 8 }]}
                          placeholder="City"
                          value={addressForm.city}
                          onChangeText={(t) => setAddressForm((f) => ({ ...f, city: t }))}
                        />
                        <TextInput
                          style={[styles.inputField, { flex: 1 }]}
                          placeholder="District"
                          value={addressForm.district}
                          onChangeText={(t) => setAddressForm((f) => ({ ...f, district: t }))}
                        />
                      </View>
                      <View style={styles.twoColRow}>
                        <TextInput
                          style={[styles.inputField, { flex: 1, marginRight: 8 }]}
                          placeholder="State"
                          value={addressForm.state}
                          onChangeText={(t) => setAddressForm((f) => ({ ...f, state: t }))}
                        />
                        <TextInput
                          style={[styles.inputField, { flex: 1 }]}
                          placeholder="6-Digit PIN"
                          keyboardType="number-pad"
                          maxLength={6}
                          value={addressForm.pincode}
                          onChangeText={(t) => setAddressForm((f) => ({ ...f, pincode: t }))}
                        />
                      </View>
                      <TouchableOpacity style={styles.saveAddrBtn} onPress={handleSaveAddress} disabled={busy}>
                        <Text style={styles.saveAddrBtnText}>{busy ? "Saving..." : "Save Delivery Address"}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : addresses.length === 0 ? (
                    <TouchableOpacity style={styles.noAddressBox} onPress={() => setShowAddressForm(true)}>
                      <Ionicons name="location-outline" size={24} color="#7C3AED" />
                      <Text style={styles.noAddressText}>+ Add your first delivery address to continue</Text>
                    </TouchableOpacity>
                  ) : (
                    addresses.map((a) => {
                      const isSel = selectedAddressId === a.id;
                      return (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.addressCard, isSel && styles.addressCardActive]}
                          onPress={() => void handleSelectAddress(a.id)}
                        >
                          <Ionicons
                            name={isSel ? "radio-button-on" : "radio-button-off"}
                            size={20}
                            color={isSel ? "#7C3AED" : "#9CA3AF"}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={styles.addressNameRow}>
                              <Text style={styles.addressRecipient}>{a.recipientName}</Text>
                              <View style={styles.addressTypeBadge}>
                                <Text style={styles.addressTypeBadgeText}>{a.type.toUpperCase()}</Text>
                              </View>
                            </View>
                            <Text style={styles.addressDetailText}>{a.line1}, {a.line2 ? `${a.line2}, ` : ""}{a.city}, {a.district}, {a.state} - {a.pincode}</Text>
                            <Text style={styles.addressPhoneText}>📞 {a.phone}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {/* Payment Method Section */}
                <View style={styles.checkoutSection}>
                  <Text style={styles.checkoutSectionTitle}>2. Payment Method</Text>

                  {[
                    { id: "upi" as const, label: "UPI (Google Pay, PhonePe, Paytm, BHIM)", icon: "flash-outline" },
                    { id: "card" as const, label: "Debit / Credit Card (Visa, RuPay, MasterCard)", icon: "card-outline" },
                    { id: "netbanking" as const, label: "Net Banking (All Indian Banks)", icon: "globe-outline" },
                    { id: "cod" as const, label: "Cash on Delivery (Available for JNV & Home)", icon: "cash-outline" },
                  ].map((m) => {
                    const isSel = paymentMethod === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.paymentMethodCard, isSel && styles.paymentMethodCardActive]}
                        onPress={() => setPaymentMethod(m.id)}
                      >
                        <Ionicons
                          name={isSel ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSel ? "#7C3AED" : "#9CA3AF"}
                          style={{ marginRight: 10 }}
                        />
                        <Ionicons name={m.icon as any} size={20} color={isSel ? "#7C3AED" : "#6B7280"} style={{ marginRight: 8 }} />
                        <Text style={[styles.paymentMethodText, isSel && styles.paymentMethodTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Final Bill Review */}
                {checkoutPreview ? (
                  <View style={styles.billCard}>
                    <Text style={styles.billTitle}>Order Summary</Text>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Items Subtotal</Text>
                      <Text style={styles.billVal}>{rupees(checkoutPreview.subtotalPaise)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Shipping & Delivery</Text>
                      <Text style={styles.billVal}>
                        {checkoutPreview.shippingPaise === 0 ? "FREE" : rupees(checkoutPreview.shippingPaise || 4900)}
                      </Text>
                    </View>
                    <View style={styles.billDivider} />
                    <View style={styles.billRow}>
                      <Text style={styles.billTotalLabel}>Total to Pay</Text>
                      <Text style={styles.billTotalVal}>{rupees(checkoutPreview.totalPaise || checkoutPreview.subtotalPaise)}</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              <View style={[styles.cartBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bottomBarLabel}>Payment: {paymentMethod.toUpperCase()}</Text>
                  <Text style={styles.bottomBarTotal}>
                    {checkoutPreview ? rupees(checkoutPreview.totalPaise || checkoutPreview.subtotalPaise) : "—"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.checkoutBtn, (busy || !selectedAddressId) && styles.btnDisabled]}
                  disabled={busy || !selectedAddressId}
                  onPress={handlePlaceOrder}
                >
                  <Text style={styles.checkoutBtnText}>{busy ? "Processing..." : "Place Order"}</Text>
                  <Ionicons name="shield-checkmark" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* 11. WISHLIST MODAL */}
      <Modal visible={modal === "wishlist"} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>My Wishlist ({wishlistProducts.length})</Text>
            <View style={{ width: 40 }} />
          </View>

          {wishlistProducts.length === 0 ? (
            <View style={styles.emptyCartWrap}>
              <Ionicons name="heart-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyCartTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptyCartSubtitle}>Save your favorite Navodaya gear and clothing for later!</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.wishlistScroll} showsVerticalScrollIndicator={false}>
              {wishlistProducts.map((p) => (
                <View key={p.id} style={styles.wishlistCard}>
                  <Image source={{ uri: p.images[0] || "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80" }} style={styles.wishlistImg} />
                  <View style={styles.wishlistInfo}>
                    <Text style={styles.productTitle} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.priceCurrent}>{rupees(p.pricePaise)}</Text>
                    <View style={styles.wishlistActions}>
                      <TouchableOpacity
                        style={styles.wishlistMoveBtn}
                        onPress={async () => {
                          await handleAddToCart(p);
                          await handleToggleWishlist(p);
                        }}
                      >
                        <Ionicons name="cart-outline" size={14} color="#fff" />
                        <Text style={styles.wishlistMoveBtnText}>Move to Cart</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => void handleToggleWishlist(p)} style={styles.wishlistRemoveBtn}>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 12. ORDER HISTORY MODAL */}
      <Modal visible={modal === "orders"} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>My Orders</Text>
            <View style={{ width: 40 }} />
          </View>

          {orderHistory.length === 0 ? (
            <View style={styles.emptyCartWrap}>
              <Ionicons name="cube-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyCartTitle}>No orders placed yet</Text>
              <Text style={styles.emptyCartSubtitle}>Your purchase history and live delivery tracking will appear here.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.ordersScroll} showsVerticalScrollIndicator={false}>
              {orderHistory.map((ord) => (
                <TouchableOpacity
                  key={ord.id}
                  style={styles.orderHistoryCard}
                  onPress={() => void viewOrderDetails(ord.id)}
                >
                  <View style={styles.orderHistoryTop}>
                    <Text style={styles.orderHistoryNum}>{ord.orderNumber}</Text>
                    <View style={[styles.orderStatusPill, ord.status === "cancelled" ? styles.statusCancelled : styles.statusConfirmed]}>
                      <Text style={[styles.orderStatusText, ord.status === "cancelled" ? styles.statusCancelledText : styles.statusConfirmedText]}>
                        {ord.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.orderHistoryDate}>
                    Placed on {new Date(ord.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                  <View style={styles.orderHistoryBottom}>
                    <Text style={styles.orderHistoryTotal}>Total: {rupees(ord.totalPaise)}</Text>
                    <View style={styles.viewDetailsRow}>
                      <Text style={styles.viewDetailsText}>Track & Details</Text>
                      <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 13. ORDER DETAILS & TRACKING MODAL */}
      <Modal visible={modal === "orderDetail"} animationType="slide" onRequestClose={() => setModal(null)}>
        {selectedOrderDetails && (
          <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModal("orders")} style={styles.modalBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Order {selectedOrderDetails.orderNumber}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.orderDetailScroll} showsVerticalScrollIndicator={false}>
              {/* Status Header */}
              <View style={styles.trackingHeaderCard}>
                <Text style={styles.trackingStatusTitle}>
                  Status: {selectedOrderDetails.status.toUpperCase()}
                </Text>
                <Text style={styles.trackingStatusSubtitle}>
                  Payment: {selectedOrderDetails.paymentStatus.toUpperCase()} ({selectedOrderDetails.status === "cancelled" ? "Cancelled" : "Verified"})
                </Text>

                {/* Progress Stepper */}
                <View style={styles.stepperContainer}>
                  {[
                    { label: "Placed", done: true },
                    { label: "Confirmed", done: selectedOrderDetails.status !== "cancelled" },
                    { label: "Shipped", done: ["shipped", "delivered"].includes(selectedOrderDetails.status) },
                    { label: "Delivered", done: selectedOrderDetails.status === "delivered" },
                  ].map((step, idx) => (
                    <View key={step.label} style={styles.stepItem}>
                      <View style={[styles.stepCircle, step.done ? styles.stepCircleDone : styles.stepCirclePending]}>
                        <Ionicons name={step.done ? "checkmark" : "ellipse"} size={12} color={step.done ? "#fff" : "#9CA3AF"} />
                      </View>
                      <Text style={styles.stepLabel}>{step.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Items Purchased */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Items Purchased ({selectedOrderDetails.items?.length || 0})</Text>
                {selectedOrderDetails.items?.map((it) => (
                  <View key={it.id} style={styles.orderItemRow}>
                    {it.imageUrl ? (
                      <Image source={{ uri: it.imageUrl }} style={styles.orderItemImg} />
                    ) : (
                      <View style={[styles.orderItemImg, styles.imagePlaceholder]}>
                        <Ionicons name="cube-outline" size={20} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.orderItemName}>{it.productName}</Text>
                      <Text style={styles.orderItemMeta}>Qty: {it.quantity} • {rupees(it.unitPricePaise)} each</Text>
                    </View>
                    <Text style={styles.orderItemTotal}>{rupees(it.unitPricePaise * it.quantity)}</Text>
                  </View>
                ))}
              </View>

              {/* Order Tracking Events Timeline */}
              {selectedOrderDetails.events && selectedOrderDetails.events.length > 0 && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>Tracking Updates</Text>
                  {selectedOrderDetails.events.map((ev, i) => (
                    <View key={i} style={styles.eventRow}>
                      <Ionicons name="radio-button-on" size={14} color="#7C3AED" style={{ marginTop: 2, marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventNote}>{ev.note || ev.status}</Text>
                        <Text style={styles.eventTime}>{new Date(ev.createdAt).toLocaleString("en-IN")}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Cancel Button if eligible */}
              {["confirmed", "processing"].includes(selectedOrderDetails.status) && (
                <TouchableOpacity
                  style={styles.cancelOrderBtn}
                  onPress={() => void handleCancelOrder(selectedOrderDetails.id)}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* 14. SELLER PORTAL MODAL */}
      <Modal visible={modal === "seller"} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Seller Zone</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.sellerScroll} showsVerticalScrollIndicator={false}>
            {sellerStatus ? (
              <View style={styles.sellerStatusCard}>
                <Ionicons name="checkmark-done-circle" size={48} color="#7C3AED" />
                <Text style={styles.sellerStatusName}>{sellerStatus.displayName}</Text>
                <View style={styles.sellerBadgePill}>
                  <Text style={styles.sellerBadgePillText}>Application Status: {sellerStatus.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.sellerStatusDesc}>{sellerStatus.description}</Text>
                <Text style={styles.sellerNoteText}>
                  {sellerStatus.status === "approved"
                    ? "Your store account is active! You can publish and manage products via Store Admin."
                    : "Our admin team is reviewing your details. Once approved, you can start listing products."}
                </Text>
              </View>
            ) : (
              <View style={styles.sellerFormCard}>
                <LinearGradient colors={["#2E1065", "#4C1D95"]} style={styles.sellerHeroBanner}>
                  <Ionicons name="storefront-outline" size={36} color="#fff" />
                  <Text style={styles.sellerHeroTitle}>Sell on Navodaya Connect</Text>
                  <Text style={styles.sellerHeroSubtitle}>Reach thousands of Navodayan students, alumni & staff across India.</Text>
                </LinearGradient>

                <View style={styles.sellerFormBody}>
                  <Text style={styles.sellerFormLabel}>Store / Brand Display Name *</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. Navodaya Heritage Crafts"
                    value={sellerFormName}
                    onChangeText={setSellerFormName}
                  />

                  <Text style={styles.sellerFormLabel}>Description & Products Offered *</Text>
                  <TextInput
                    style={[styles.inputField, { height: 90, textAlignVertical: "top" }]}
                    placeholder="Tell us what products you manufacture or sell, your JNV background, and fulfillment capabilities..."
                    multiline
                    value={sellerFormDesc}
                    onChangeText={setSellerFormDesc}
                  />

                  <TouchableOpacity style={styles.submitSellerBtn} onPress={handleApplySeller} disabled={busy}>
                    <Text style={styles.submitSellerBtnText}>{busy ? "Submitting..." : "Submit Seller Application"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* 15. WRITE REVIEW MODAL */}
      <Modal visible={showReviewModal} transparent animationType="fade" onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.reviewModalOverlay}>
          <View style={styles.reviewModalCard}>
            <Text style={styles.reviewModalTitle}>Rate & Review Product</Text>
            <View style={styles.reviewStarsSelectRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                  <Ionicons name="star" size={32} color={s <= reviewRating ? "#F59E0B" : "#D1D5DB"} style={{ marginHorizontal: 4 }} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.inputField, { height: 100, textAlignVertical: "top" }]}
              placeholder="Share your experience regarding quality, fitting, and delivery..."
              multiline
              value={reviewBody}
              onChangeText={setReviewBody}
            />

            <View style={styles.reviewModalActions}>
              <TouchableOpacity style={styles.reviewCancelBtn} onPress={() => setShowReviewModal(false)}>
                <Text style={styles.reviewCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reviewSubmitBtn} onPress={handleSubmitReview} disabled={busy}>
                <Text style={styles.reviewSubmitText}>{busy ? "Submitting..." : "Submit Review"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 16. FILTER MODAL */}
      <Modal visible={modal === "filter"} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Products</Text>
              <TouchableOpacity onPress={() => setModal(null)}>
                <Ionicons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Price Range</Text>
            <View style={styles.filterChipRow}>
              {[
                { id: "all" as const, label: "All Prices" },
                { id: "under500" as const, label: "Under ₹500" },
                { id: "500to1000" as const, label: "₹500 - ₹1000" },
                { id: "above1000" as const, label: "Above ₹1000" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.filterChip, priceFilter === p.id && styles.filterChipActive]}
                  onPress={() => setPriceFilter(p.id)}
                >
                  <Text style={[styles.filterChipText, priceFilter === p.id && styles.filterChipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Availability</Text>
            <TouchableOpacity
              style={[styles.filterChip, inStockOnly && styles.filterChipActive, { alignSelf: "flex-start" }]}
              onPress={() => setInStockOnly(!inStockOnly)}
            >
              <Ionicons name={inStockOnly ? "checkmark-circle" : "ellipse-outline"} size={16} color={inStockOnly ? "#fff" : "#4B5563"} />
              <Text style={[styles.filterChipText, inStockOnly && styles.filterChipTextActive, { marginLeft: 6 }]}>
                In Stock Items Only
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyFilterBtn} onPress={() => setModal(null)}>
              <Text style={styles.applyFilterBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerIconBtn: {
    padding: 6,
    position: "relative",
  },
  cartIconBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    position: "relative",
  },
  badgeWrap: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#C4B5FD",
    letterSpacing: 0.8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterBtn: {
    marginLeft: 8,
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
  },

  // Promo Banner
  bannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  bannerCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 140,
    justifyContent: "space-between",
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  bannerBadgeText: {
    color: "#FDE047",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: "#E2E8F0",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  bannerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerDiscountPill: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bannerDiscountText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  bannerActionBtn: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bannerActionText: {
    color: "#2E1065",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  bannerDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  bannerDotActive: {
    width: 18,
    backgroundColor: "#7C3AED",
  },

  // Trust Strip
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  trustDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#E5E7EB",
  },

  // Categories
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  sectionActionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  categoryChipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#4C1D95",
  },
  categoryChipTextActive: {
    color: "#fff",
  },

  // Seller Banner
  sellerAdBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  sellerAdIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  sellerAdTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#2E1065",
  },
  sellerAdSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },

  // Toolbar
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productCountText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortPillActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  sortPillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  sortPillTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_600SemiBold",
  },
  viewModeBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 6,
  },

  // Product Grid Layout
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
  },
  gridCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  cardImageContainer: {
    width: "100%",
    height: 150,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  gridDiscountTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridDiscountTagText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  gridWishlistBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridInfo: {
    padding: 10,
  },
  productBrand: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#6D28D9",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  productTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    lineHeight: 18,
    minHeight: 36,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  priceCurrent: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  priceOriginal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  gridBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#059669",
  },
  stockTextLow: {
    color: "#DC2626",
  },
  gridAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },

  // Product List Layout
  productList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  listCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    padding: 10,
    gap: 12,
  },
  listImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  listInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  quickAddBtnText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  // State Card Styles
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Inter_500Medium",
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#991B1B",
  },
  errorMsg: {
    fontSize: 12,
    color: "#7F1D1D",
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1F2937",
  },
  emptyMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  clearFiltersBtn: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  clearFiltersBtnText: {
    color: "#7C3AED",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Toast
  toastWrap: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "#1F2937",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // Modal Screen Standard Layout
  modalScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Detail Modal
  detailScroll: {
    paddingBottom: 24,
  },
  detailGallery: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailMainImage: {
    width: "100%",
    height: 260,
  },
  detailThumbnailRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  detailThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  detailThumbnailActive: {
    borderColor: "#7C3AED",
    borderWidth: 2,
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
  },
  detailContent: {
    padding: 16,
  },
  detailBrandBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  detailBrandText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  detailTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    lineHeight: 26,
    marginBottom: 8,
  },
  detailRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  ratingStars: {
    flexDirection: "row",
    gap: 2,
  },
  ratingCountText: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "Inter_500Medium",
  },
  detailPriceBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 4,
  },
  detailCurrentPrice: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  detailOriginalPrice: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  detailSavingsBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailSavingsText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  taxInclusiveText: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  variantsBlock: {
    marginBottom: 16,
  },
  variantGroup: {
    marginBottom: 10,
  },
  variantGroupTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 6,
  },
  variantOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variantOptionChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  variantOptionChipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#EDE9FE",
  },
  variantOptionDisabled: {
    opacity: 0.4,
    borderColor: "#E5E7EB",
  },
  variantOptionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  variantOptionTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  qtyLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepperVal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    paddingHorizontal: 8,
  },
  stockNote: {
    fontSize: 12,
    color: "#059669",
    fontFamily: "Inter_500Medium",
  },

  // Pincode Box
  pincodeBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  pincodeTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#334155",
    marginBottom: 8,
  },
  pincodeInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  pincodeInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: "#1E293B",
  },
  pincodeBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pincodeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  pincodeResultText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
    lineHeight: 16,
  },
  pincodeOk: {
    color: "#059669",
  },
  pincodeErr: {
    color: "#DC2626",
  },

  // Info Sections
  infoSection: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
    marginBottom: 16,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 8,
  },
  infoSectionBody: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  specsTable: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  specsRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  specsKey: {
    width: "40%",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  specsVal: {
    width: "60%",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#1F2937",
  },
  reviewsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  writeReviewBtnText: {
    color: "#7C3AED",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyReviewsText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Inter_400Regular",
  },
  reviewItem: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 1,
  },
  reviewBody: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 16,
  },

  // Bottom Fixed Bars
  detailBottomBar: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  detailCartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 12,
  },
  detailCartBtnText: {
    color: "#7C3AED",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  detailBuyNowBtn: {
    flex: 1,
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  detailBuyNowBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // Cart Modal
  emptyCartWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  emptyCartSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  continueShopBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  continueShopBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cartList: {
    padding: 16,
    paddingBottom: 24,
  },
  freeShippingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EDE9FE",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  freeShippingText: {
    color: "#4C1D95",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  cartCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  cartItemImg: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  cartItemBody: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  cartItemVariant: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  cartItemPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginTop: 4,
  },
  cartControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cartStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
  },
  cartStepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cartStepperVal: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    paddingHorizontal: 6,
  },
  removeCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  removeCartText: {
    fontSize: 11,
    color: "#DC2626",
    fontFamily: "Inter_500Medium",
  },

  // Coupon Card
  couponCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  couponTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 8,
  },
  couponInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#111827",
  },
  couponApplyBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplyBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  couponErrorText: {
    color: "#DC2626",
    fontSize: 11,
    marginTop: 4,
  },
  couponSuccessText: {
    color: "#059669",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },

  // Bill Card
  billCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 16,
  },
  billTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 10,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontFamily: "Inter_400Regular",
  },
  billVal: {
    fontSize: 12,
    color: "#111827",
    fontFamily: "Inter_600SemiBold",
  },
  billDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  billTotalLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  billTotalVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },

  // Cart Bottom Bar
  cartBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  bottomBarLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "Inter_500Medium",
  },
  bottomBarTotal: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkoutBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  // Checkout Modal
  checkoutScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  checkoutSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 14,
  },
  checkoutSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  checkoutSectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addAddressToggleText: {
    color: "#7C3AED",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  noAddressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 8,
  },
  noAddressText: {
    color: "#7C3AED",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 8,
  },
  addressCardActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  addressNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  addressRecipient: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addressTypeBadge: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  addressTypeBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#3730A3",
  },
  addressDetailText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 16,
  },
  addressPhoneText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  addressForm: {
    gap: 8,
  },
  inputField: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#fff",
  },
  addrTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  addrTypeChip: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    alignItems: "center",
  },
  addrTypeChipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#EDE9FE",
  },
  addrTypeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  addrTypeTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  twoColRow: {
    flexDirection: "row",
  },
  saveAddrBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  saveAddrBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Payment Methods
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  paymentMethodCardActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  paymentMethodText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#374151",
    flex: 1,
  },
  paymentMethodTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },

  // Order Success Screen
  orderSuccessCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  orderSuccessTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  orderNumberText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderSuccessMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },
  successActions: {
    width: "100%",
    gap: 10,
    marginTop: 16,
    maxWidth: 280,
  },
  viewOrderBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewOrderBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  backToStoreBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  backToStoreBtnText: {
    color: "#374151",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Wishlist Scroll
  wishlistScroll: {
    padding: 16,
    gap: 12,
  },
  wishlistCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    gap: 12,
  },
  wishlistImg: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  wishlistInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  wishlistActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wishlistMoveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  wishlistMoveBtnText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  wishlistRemoveBtn: {
    padding: 6,
  },

  // Orders Scroll
  ordersScroll: {
    padding: 16,
    gap: 10,
  },
  orderHistoryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  orderHistoryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  orderHistoryNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  orderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderStatusText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  statusConfirmed: {
    backgroundColor: "#DCFCE7",
  },
  statusConfirmedText: {
    color: "#15803D",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2",
  },
  statusCancelledText: {
    color: "#B91C1C",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  orderHistoryDate: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 10,
  },
  orderHistoryBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  orderHistoryTotal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // Order Details Modal
  orderDetailScroll: {
    padding: 16,
    paddingBottom: 32,
  },
  trackingHeaderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  trackingStatusTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 4,
  },
  trackingStatusSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepCircleDone: {
    backgroundColor: "#10B981",
  },
  stepCirclePending: {
    backgroundColor: "#E5E7EB",
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  orderItemImg: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  orderItemName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  orderItemMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  orderItemTotal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  eventNote: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#1F2937",
  },
  eventTime: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 1,
  },
  cancelOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
  cancelOrderBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  // Seller Portal
  sellerScroll: {
    padding: 16,
  },
  sellerHeroBanner: {
    padding: 20,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  sellerHeroTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  sellerHeroSubtitle: {
    color: "#E2E8F0",
    fontSize: 12,
    textAlign: "center",
  },
  sellerFormCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  sellerFormBody: {
    padding: 16,
    gap: 10,
  },
  sellerFormLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },
  submitSellerBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  submitSellerBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  sellerStatusCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  sellerStatusName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  sellerBadgePill: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sellerBadgePillText: {
    color: "#7C3AED",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  sellerStatusDesc: {
    fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 18,
  },
  sellerNoteText: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 10,
  },

  // Review Modal Overlay
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  reviewModalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  reviewModalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    textAlign: "center",
  },
  reviewStarsSelectRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 4,
  },
  reviewModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  reviewCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    alignItems: "center",
  },
  reviewCancelText: {
    color: "#4B5563",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  reviewSubmitBtn: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  reviewSubmitText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  // Filter Modal
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterModalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  filterModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  filterModalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  filterSectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginTop: 6,
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  filterChipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#7C3AED",
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  filterChipTextActive: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  applyFilterBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  applyFilterBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
