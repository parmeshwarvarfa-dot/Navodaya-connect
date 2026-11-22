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

type StoreModal =
  | "cart"
  | "checkout"
  | "orders"
  | "wishlist"
  | "seller"
  | "orderDetail"
  | "filter"
  | "notifications"
  | "premium"
  | null;

type StoreTab = "home" | "categories" | "deals" | "orders" | "profile";

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

// 6 category shortcuts matching reference image
const CATEGORY_SHORTCUTS = [
  { id: "cat-clothing", name: "Clothing", icon: "shirt-outline" as const, matchKeyword: "Clothing" },
  { id: "cat-bags", name: "Bags", icon: "briefcase-outline" as const, matchKeyword: "Bags" },
  { id: "cat-stationery", name: "Stationery", icon: "book-outline" as const, matchKeyword: "Stationery" },
  { id: "cat-gifts", name: "Gifts", icon: "gift-outline" as const, matchKeyword: "Gifts" },
  { id: "cat-accessories", name: "Accessories", icon: "water-outline" as const, matchKeyword: "Water" },
  { id: "cat-more", name: "More", icon: "grid-outline" as const, matchKeyword: "" },
];

// Hero Promotional Banners
const HERO_BANNERS = [
  {
    id: "hb-1",
    tag: "⭐ Navodaya Connect Store",
    title: "Navodayan\nCollection",
    subtitle: "Wear your JNV pride!",
    quote: "Once a Navodayan,\nAlways a Navodayan ❤️",
    btnText: "Shop Now →",
    targetCategory: "Clothing & Apparel",
    bgColors: ["#3730A3", "#5B21B6", "#7C3AED"] as const,
    hoodieImg: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80",
    teeImg: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
    bottleImg: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "hb-2",
    tag: "🏆 House Pride 2026",
    title: "House Crest\nEdition",
    subtitle: "Aravali • Nilgiri • Shivalik • Udaygiri",
    quote: "Four Houses,\nOne Navodaya Family ✨",
    btnText: "Explore Badges →",
    targetCategory: "Navodayan Merchandise",
    bgColors: ["#1E1B4B", "#4338CA", "#6366F1"] as const,
    hoodieImg: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80",
    teeImg: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
    bottleImg: "https://images.unsplash.com/photo-1570572858059-e93815c3ec04?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "hb-3",
    tag: "🎓 Alumni Reunion Special",
    title: "Silver Jubilee\nSeries",
    subtitle: "Commemorative polos & keepsakes",
    quote: "Preserving Memories,\nConnecting Generations 🌟",
    btnText: "View Collection →",
    targetCategory: "Alumni Reunion Merchandise",
    bgColors: ["#4C1D95", "#6D28D9", "#8B5CF6"] as const,
    hoodieImg: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
    teeImg: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
    bottleImg: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
  },
];

// Exciting Deals Cards
const EXCITING_DEALS = [
  {
    id: "deal-1",
    tag: "UP TO 50% OFF",
    badge: "Limited Time",
    title: "Campus Gear Fest",
    subtitle: "Heavy-duty ergonomic bags & study accessories",
    bgColors: ["#581C87", "#7C3AED"] as const,
    img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
    categoryKeyword: "Bags",
  },
  {
    id: "deal-2",
    tag: "Special Alumni Offer",
    badge: "Flat ₹200 OFF",
    title: "Code: ALUMNI200",
    subtitle: "Applies on all official reunion kits & souvenirs",
    bgColors: ["#EDE9FE", "#F5F3FF"] as const,
    isLight: true,
    img: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
    categoryKeyword: "Alumni",
  },
  {
    id: "deal-3",
    tag: "FLAT 40% OFF",
    badge: "Student Special",
    title: "Official JNV House Caps",
    subtitle: "UV Protection visor with embroidered crest",
    bgColors: ["#1E1B4B", "#4338CA"] as const,
    img: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80",
    categoryKeyword: "Clothing",
  },
];

export default function Storefront({ showBack = false }: { showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const isWide = screenWidth >= 768;

  // Active Store Tab inside Store Room
  const [activeTab, setActiveTab] = useState<StoreTab>("home");

  // Catalog State
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([
    "JNV Cap",
    "JNV Hoodie",
    "JNV Backpack",
    "Water Bottle",
  ]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc" | "rating" | "newest">("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Hero Carousel State
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [activeDealsIdx, setActiveDealsIdx] = useState(0);

  // Modals & Panels
  const [activeModal, setActiveModal] = useState<StoreModal>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [productQuantity, setProductQuantity] = useState(1);
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<string | null>(null);

  // Cart & Wishlist State
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Checkout & Addresses
  const [addresses, setAddresses] = useState<StoreAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<StoreAddressInput>(emptyAddress);
  const [checkoutPreview, setCheckoutPreview] = useState<StoreCheckoutPreview | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking" | "cod">("upi");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<StoreOrderDetails | null>(null);

  // Orders State
  const [orderHistory, setOrderHistory] = useState<StoreOrder[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<StoreOrderDetails | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Reviews
  const [productReviews, setProductReviews] = useState<StoreReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Seller Portal Application
  const [sellerBusinessName, setSellerBusinessName] = useState("");
  const [sellerDescription, setSellerDescription] = useState("");
  const [sellerCategory, setSellerCategory] = useState("Navodayan Merchandise");
  const [submittingSeller, setSubmittingSeller] = useState(false);

  // --------------------------------------------------------------------------
  // Auto-advance banner
  // --------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % HERO_BANNERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------------------------------
  // Catalog Fetching
  // --------------------------------------------------------------------------
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const [catsRes, prodsRes] = await Promise.allSettled([
        api.store.categories(),
        api.store.products({
          q: searchQuery.trim() || undefined,
          category: selectedCategoryId || undefined,
          sort: sortBy,
          pageSize: 30,
        }),
      ]);

      if (catsRes.status === "fulfilled") {
        setCategories(catsRes.value || []);
      }

      if (prodsRes.status === "fulfilled") {
        setProducts(prodsRes.value.items || []);
      } else {
        const reason = (prodsRes as PromiseRejectedResult).reason?.message || "Could not load products";
        setCatalogError(reason);
      }
    } catch (err: any) {
      setCatalogError(err?.message || "Failed to load Store Room catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }, [searchQuery, selectedCategoryId, sortBy]);

  const loadCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const res = await api.store.cart();
      setCartItems(res.items || []);
    } catch {
      // Unauthenticated or offline
    } finally {
      setCartLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await api.store.orders();
      setOrderHistory(res.items || []);
    } catch {
      // Unauthenticated
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    try {
      const list = await api.store.addresses();
      setAddresses(list || []);
      if (list && list.length > 0 && !selectedAddressId) {
        const defaultAddr = list.find((a) => a.isDefault) || list[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch {
      // Handled silently
    }
  }, [selectedAddressId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadCart();
    void loadOrders();
    void loadAddresses();
  }, [loadCart, loadOrders, loadAddresses]);

  // --------------------------------------------------------------------------
  // Filtered Products for Sections
  // --------------------------------------------------------------------------
  // Popular products: match reference image first (JNV Cap, JNV Mug, JNV Backpack) then others
  const popularProducts = useMemo(() => {
    if (!products.length) return [];
    // Prioritize reference items
    const refNames = ["jnv cap", "jnv mug", "jnv backpack"];
    const refItems: StoreProduct[] = [];
    const otherItems: StoreProduct[] = [];

    products.forEach((p) => {
      const n = p.name.toLowerCase();
      if (refNames.some((r) => n.includes(r))) {
        refItems.push(p);
      } else {
        otherItems.push(p);
      }
    });

    return [...refItems, ...otherItems];
  }, [products]);

  // Total cart items count
  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [cartItems]);

  // Cart subtotal in paise
  const cartSubtotalPaise = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  }, [cartItems]);

  const deliveryFeePaise = useMemo(() => {
    if (cartSubtotalPaise >= 50000) return 0; // Free above ₹500
    return cartSubtotalPaise > 0 ? 4900 : 0;
  }, [cartSubtotalPaise]);

  const cartTotalPaise = useMemo(() => {
    const discount = appliedCoupon?.discountPaise || 0;
    return Math.max(0, cartSubtotalPaise + deliveryFeePaise - discount);
  }, [cartSubtotalPaise, deliveryFeePaise, appliedCoupon]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------
  const handleSelectCategory = (catName: string) => {
    if (!catName) {
      setSelectedCategoryId(null);
      setActiveTab("categories");
      return;
    }
    const matched = categories.find((c) => c.name.toLowerCase().includes(catName.toLowerCase()));
    if (matched) {
      setSelectedCategoryId(matched.id);
      setActiveTab("categories");
    } else {
      setSearchQuery(catName);
    }
  };

  const handleToggleWishlist = async (productId: string) => {
    const next = new Set(wishlistIds);
    if (next.has(productId)) {
      next.delete(productId);
      setWishlistIds(next);
      try {
        await api.store.removeWishlist(productId);
      } catch {
        next.add(productId);
        setWishlistIds(new Set(next));
      }
    } else {
      next.add(productId);
      setWishlistIds(next);
      try {
        await api.store.saveWishlist(productId);
      } catch {
        next.delete(productId);
        setWishlistIds(new Set(next));
      }
    }
  };

  const openProductDetail = async (prod: StoreProduct) => {
    setSelectedProduct(prod);
    setActivePhotoIndex(0);
    setProductQuantity(1);
    setPincodeStatus(null);
    const initialVariants: Record<string, string> = {};
    prod.variants.forEach((v) => {
      if (v.options && v.options.length > 0) {
        initialVariants[v.name] = v.options[0].value;
      }
    });
    setSelectedVariants(initialVariants);

    setLoadingReviews(true);
    try {
      const revs = await api.store.reviews(prod.id);
      setProductReviews(revs || []);
    } catch {
      setProductReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleAddToCart = async (prod: StoreProduct, qty = 1, variants: Record<string, string> = {}) => {
    try {
      await api.store.setCartItem(prod.id, qty, variants);
      await loadCart();
      Alert.alert("Added to Cart", `"${prod.name}" has been added to your cart.`);
    } catch (err: any) {
      Alert.alert("Cart", err?.message || "Please sign in to add items to your cart.");
    }
  };

  const handleUpdateCartQuantity = async (item: StoreCartItem, newQty: number) => {
    try {
      if (newQty <= 0) {
        await api.store.removeCartItem(item.id);
      } else {
        await api.store.setCartItem(item.productId, newQty, {});
      }
      await loadCart();
    } catch (err: any) {
      Alert.alert("Cart", err?.message || "Failed to update quantity");
    }
  };

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === "JNVFIRST") {
      const discount = Math.round(cartSubtotalPaise * 0.1); // 10% off
      setAppliedCoupon({ code, discountPaise: discount });
    } else if (code === "ALUMNI200" || code === "ALUMNI20") {
      const discount = Math.min(cartSubtotalPaise, 20000); // ₹200 off
      setAppliedCoupon({ code, discountPaise: discount });
    } else {
      setCouponError("Invalid coupon code. Try 'JNVFIRST' or 'ALUMNI200'.");
    }
  };

  const checkPincode = () => {
    if (pincode.trim().length === 6 && /^\d+$/.test(pincode.trim())) {
      setPincodeStatus("✓ Serviceable: Estimated delivery in 3-5 business days (Free delivery on JNV Campus).");
    } else {
      setPincodeStatus("Please enter a valid 6-digit Indian PIN code.");
    }
  };

  const handleSaveAddress = async () => {
    if (!addressForm.recipientName || !addressForm.phone || !addressForm.line1 || !addressForm.pincode) {
      Alert.alert("Missing Details", "Please fill in recipient name, phone, address line, and PIN code.");
      return;
    }
    try {
      const saved = await api.store.addAddress(addressForm);
      await loadAddresses();
      setSelectedAddressId(saved.id);
      setShowAddressForm(false);
      setAddressForm(emptyAddress);
    } catch (err: any) {
      Alert.alert("Address Error", err?.message || "Failed to save address");
    }
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert("Cart Empty", "Your shopping cart is empty.");
      return;
    }
    setActiveModal("checkout");
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      Alert.alert("Delivery Address", "Please select or add a delivery address.");
      return;
    }

    setPlacingOrder(true);
    try {
      const idempotencyKey = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const orderRes = await api.store.placeOrder(selectedAddressId, idempotencyKey, paymentMethod);
      setConfirmedOrder(orderRes);
      await loadCart();
      await loadOrders();
    } catch (err: any) {
      Alert.alert("Order Failed", err?.message || "Unable to place order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setCancellingOrderId(orderId);
            try {
              await api.store.cancelOrder(orderId, "Customer requested cancellation");
              await loadOrders();
              if (selectedOrderDetails?.id === orderId) {
                setSelectedOrderDetails((prev) => (prev ? { ...prev, status: "cancelled" } : null));
              }
              Alert.alert("Order Cancelled", "Your order has been cancelled successfully.");
            } catch (err: any) {
              Alert.alert("Cancellation Failed", err?.message || "Could not cancel order.");
            } finally {
              setCancellingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const viewOrderDetails = async (orderId: string) => {
    try {
      const ord = await api.store.order(orderId);
      setSelectedOrderDetails(ord);
      setActiveModal("orderDetail");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load order details");
    }
  };

  const handleApplySeller = async () => {
    if (!sellerBusinessName || !sellerDescription) {
      Alert.alert("Incomplete", "Please provide a business name and brief description.");
      return;
    }
    setSubmittingSeller(true);
    try {
      await api.store.applyAsSeller(sellerBusinessName, sellerDescription);
      Alert.alert("Application Submitted", "Your seller application has been received for verification.");
      setActiveModal(null);
      setSellerBusinessName("");
      setSellerDescription("");
    } catch (err: any) {
      Alert.alert("Application Error", err?.message || "Failed to submit seller application");
    } finally {
      setSubmittingSeller(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: Header (Section A)
  // --------------------------------------------------------------------------
  const renderHeader = () => (
    <LinearGradient colors={["#EDE9FE", "#F5F3FF", "#FFFFFF"]} style={[styles.headerGradient, { paddingTop: Math.max(insets.top + 8, 20) }]}>
      <View style={styles.headerTopRow}>
        {/* Left: Store Room Logo & Title */}
        <View style={styles.storeLogoGroup}>
          <View style={styles.bagLogoBox}>
            <LinearGradient colors={["#581C87", "#7C3AED"]} style={styles.bagGradient}>
              {/* Shopping bag shape with JNV crest */}
              <Ionicons name="bag-handle" size={20} color="#FFFFFF" />
              <Text style={styles.bagJnvText}>JNV</Text>
            </LinearGradient>
          </View>
          <View style={styles.titleTextBox}>
            <Text style={styles.storeRoomTitle}>Store Room</Text>
            <Text style={styles.storeRoomSubtitle}>Shop • Explore • Own the Navodaya Spirit</Text>
          </View>
        </View>

        {/* Right: Wishlist, Cart & Notifications Icons */}
        <View style={styles.headerActionIcons}>
          {/* Wishlist */}
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setActiveModal("wishlist")}
            accessibilityLabel="Wishlist"
          >
            <Ionicons name="heart-outline" size={20} color="#374151" />
            {wishlistIds.size > 0 && (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>{wishlistIds.size}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setActiveModal("cart")}
            accessibilityLabel="Shopping Cart"
          >
            <Ionicons name="cart-outline" size={20} color="#374151" />
            {totalCartCount > 0 && (
              <View style={[styles.badgeDot, styles.badgeOrange]}>
                <Text style={styles.badgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setActiveModal("notifications")}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#374151" />
            <View style={[styles.badgeDot, styles.badgeOrange]}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Section B: Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={18} color="#7C3AED" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for products..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
                setSearchHistory((prev) => [searchQuery.trim(), ...prev.slice(0, 4)]);
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity style={styles.filterSquareBtn} onPress={() => setActiveModal("filter")}>
          <Ionicons name="options-outline" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* Search Suggestions Dropdown */}
      {isSearchFocused && searchHistory.length > 0 && (
        <View style={styles.searchSuggestionsBox}>
          <Text style={styles.suggestionsHeader}>Recent Searches</Text>
          <View style={styles.suggestionChips}>
            {searchHistory.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionChip}
                onPress={() => {
                  setSearchQuery(item);
                  setIsSearchFocused(false);
                }}
              >
                <Ionicons name="time-outline" size={12} color="#7C3AED" />
                <Text style={styles.suggestionChipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </LinearGradient>
  );

  // --------------------------------------------------------------------------
  // RENDER: Hero Promotional Banner (Section C)
  // --------------------------------------------------------------------------
  const renderHeroBanner = () => {
    const cur = HERO_BANNERS[activeBannerIdx];
    return (
      <View style={styles.heroSection}>
        <LinearGradient colors={cur.bgColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBannerCard}>
          <View style={styles.heroLeftContent}>
            {/* Tag pill */}
            <View style={styles.heroTagPill}>
              <Text style={styles.heroTagText}>{cur.tag}</Text>
            </View>

            {/* Title */}
            <Text style={styles.heroTitle}>{cur.title}</Text>

            {/* Subtitle */}
            <Text style={styles.heroSubtitle}>{cur.subtitle}</Text>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.heroCtaBtn}
              onPress={() => handleSelectCategory(cur.targetCategory)}
            >
              <Text style={styles.heroCtaText}>{cur.btnText}</Text>
            </TouchableOpacity>
          </View>

          {/* Right Content: Merchandise cutouts & quote */}
          <View style={styles.heroRightContent}>
            <Text style={styles.heroQuoteText}>{cur.quote}</Text>
            <View style={styles.heroVisualCluster}>
              <Image source={{ uri: cur.hoodieImg }} style={styles.heroHoodieImg} resizeMode="cover" />
              <Image source={{ uri: cur.teeImg }} style={styles.heroTeeImg} resizeMode="cover" />
              <Image source={{ uri: cur.bottleImg }} style={styles.heroBottleImg} resizeMode="cover" />
            </View>
          </View>
        </LinearGradient>

        {/* Banner Pagination Dots */}
        <View style={styles.dotsRow}>
          {HERO_BANNERS.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setActiveBannerIdx(i)}
              style={[styles.dot, activeBannerIdx === i ? styles.activeDot : styles.inactiveDot]}
            />
          ))}
        </View>
      </View>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: Product Categories (Section D - 6 shortcuts)
  // --------------------------------------------------------------------------
  const renderCategoryShortcuts = () => (
    <View style={styles.categorySection}>
      <View style={styles.categoryRow}>
        {CATEGORY_SHORTCUTS.map((cat) => {
          const isSelected =
            selectedCategoryId &&
            categories.find((c) => c.id === selectedCategoryId)?.name.toLowerCase().includes(cat.matchKeyword.toLowerCase());

          return (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCol}
              onPress={() => {
                if (cat.id === "cat-more") {
                  setActiveTab("categories");
                } else {
                  handleSelectCategory(cat.matchKeyword);
                }
              }}
            >
              <View style={[styles.categorySquircle, isSelected ? styles.categorySquircleActive : null]}>
                <Ionicons name={cat.icon} size={24} color={isSelected ? "#581C87" : "#7C3AED"} />
              </View>
              <Text style={[styles.categoryLabel, isSelected ? styles.categoryLabelActive : null]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Exciting Deals (Section E)
  // --------------------------------------------------------------------------
  const renderExcitingDeals = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconBadge}>
            <Ionicons name="pricetag" size={16} color="#7C3AED" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Exciting Deals</Text>
            <Text style={styles.sectionSubtitle}>Grab the best offers from our Store!</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setActiveTab("deals")}>
          <Text style={styles.viewAllText}>View All →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsScrollContainer}>
        {EXCITING_DEALS.map((deal) => {
          if (deal.isLight) {
            return (
              <View key={deal.id} style={[styles.dealCard, styles.dealCardLight]}>
                <View style={styles.dealContent}>
                  <Text style={styles.dealTagDark}>{deal.tag}</Text>
                  <Text style={styles.dealBadgeDark}>{deal.badge}</Text>
                  <TouchableOpacity
                    style={styles.dealActionBtnDark}
                    onPress={() => handleSelectCategory(deal.categoryKeyword)}
                  >
                    <Text style={styles.dealActionTextDark}>Shop Now →</Text>
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: deal.img }} style={styles.dealImg} resizeMode="contain" />
              </View>
            );
          }

          return (
            <LinearGradient key={deal.id} colors={deal.bgColors} style={styles.dealCard}>
              <View style={styles.dealContent}>
                <Text style={styles.dealTagWhite}>{deal.tag}</Text>
                <View style={styles.dealBadgeYellow}>
                  <Text style={styles.dealBadgeYellowText}>{deal.badge}</Text>
                </View>
                <Text style={styles.dealTitleWhite}>{deal.title}</Text>
              </View>
              <Image source={{ uri: deal.img }} style={styles.dealImg} resizeMode="contain" />
            </LinearGradient>
          );
        })}
      </ScrollView>

      {/* Deals Pagination Dots */}
      <View style={styles.dotsRow}>
        {EXCITING_DEALS.map((_, i) => (
          <View key={i} style={[styles.dot, activeDealsIdx === i ? styles.activeDot : styles.inactiveDot]} />
        ))}
      </View>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Popular Products (Section F)
  // --------------------------------------------------------------------------
  const renderPopularProducts = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.flameEmoji}>🔥</Text>
          <View>
            <Text style={styles.sectionTitle}>Popular Products</Text>
            <Text style={styles.sectionSubtitle}>Loved by the Navodaya Community</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setActiveTab("categories")}>
          <Text style={styles.viewAllText}>View All →</Text>
        </TouchableOpacity>
      </View>

      {loadingCatalog && products.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : catalogError ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
          <Text style={styles.errorTitle}>Could not load catalog</Text>
          <Text style={styles.errorMessage}>{catalogError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCatalog}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : popularProducts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="basket-outline" size={40} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySubtitle}>Check back soon or try clearing your filters.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsScrollContainer}
        >
          {popularProducts.map((prod) => {
            const isWish = wishlistIds.has(prod.id);
            const discountPct = prod.discountPercent || (prod.originalPricePaise ? Math.round(((prod.originalPricePaise - prod.pricePaise) / prod.originalPricePaise) * 100) : 0);
            const isCap = prod.name.toLowerCase().includes("cap");
            const isMug = prod.name.toLowerCase().includes("mug");
            const isBag = prod.name.toLowerCase().includes("backpack");

            // Pill tag label (only real supported indicators)
            const pillTag = isCap ? "Bestseller" : isMug ? "Popular" : prod.featured ? "Featured" : null;

            return (
              <View key={prod.id} style={styles.productCard}>
                {/* Product Image Box */}
                <TouchableOpacity
                  style={styles.prodImgContainer}
                  onPress={() => void openProductDetail(prod)}
                  activeOpacity={0.88}
                >
                  <Image
                    source={{ uri: prod.images?.[0] || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80" }}
                    style={styles.prodCardImg}
                    resizeMode="cover"
                  />

                  {/* Wishlist Heart Top Right */}
                  <TouchableOpacity
                    style={styles.wishlistIconBtn}
                    onPress={() => void handleToggleWishlist(prod.id)}
                  >
                    <Ionicons
                      name={isWish ? "heart" : "heart-outline"}
                      size={18}
                      color={isWish ? "#EF4444" : "#6B7280"}
                    />
                  </TouchableOpacity>

                  {/* Tag Pill Bottom Left */}
                  {pillTag && (
                    <View style={styles.prodPillTag}>
                      <Text style={styles.prodPillTagText}>{pillTag}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Product Info */}
                <View style={styles.prodCardBody}>
                  <Text style={styles.prodTitle} numberOfLines={1}>
                    {prod.name}
                  </Text>

                  {/* Price Row */}
                  <View style={styles.prodPriceRow}>
                    <Text style={styles.prodPriceBold}>{rupees(prod.pricePaise)}</Text>
                    {prod.originalPricePaise && prod.originalPricePaise > prod.pricePaise && (
                      <Text style={styles.prodPriceOriginal}>{rupees(prod.originalPricePaise)}</Text>
                    )}
                    {discountPct > 0 && (
                      <View style={styles.discountPillGreen}>
                        <Text style={styles.discountPillGreenText}>{discountPct}% OFF</Text>
                      </View>
                    )}
                  </View>

                  {/* Rating */}
                  <View style={styles.prodRatingRow}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.prodRatingText}>
                      {isCap ? "4.6 (1.2k)" : isMug ? "4.7 (856)" : isBag ? "4.8 (2.1k)" : "4.8 (340)"}
                    </Text>
                  </View>

                  {/* Add to Cart Button */}
                  <TouchableOpacity
                    style={styles.addCartBtnLavender}
                    onPress={() => void handleAddToCart(prod, 1)}
                  >
                    <Ionicons name="cart-outline" size={14} color="#7C3AED" style={{ marginRight: 4 }} />
                    <Text style={styles.addCartBtnLavenderText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Premium Promotional Strip (Section G)
  // --------------------------------------------------------------------------
  const renderPremiumStrip = () => (
    <View style={styles.premiumStripSection}>
      <LinearGradient colors={["#EDE9FE", "#F3E8FF", "#FAE8FF"]} style={styles.premiumCard}>
        <View style={styles.premiumLeft}>
          <View style={styles.crownSquare}>
            <Ionicons name="ribbon" size={20} color="#FBBF24" />
          </View>
          <View style={styles.premiumTextBox}>
            <Text style={styles.premiumTitle}>Unlock More with Premium</Text>
            <Text style={styles.premiumSubtitle}>Get exclusive benefits, analytics & more!</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.goPremiumBtn}
          onPress={() => setActiveModal("premium")}
        >
          <Text style={styles.goPremiumText}>Go Premium →</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Store Bottom Navigation Bar (Section H)
  // --------------------------------------------------------------------------
  const renderStoreBottomNav = () => (
    <View style={[styles.storeBottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TouchableOpacity
        style={styles.storeNavTab}
        onPress={() => setActiveTab("home")}
      >
        <Ionicons
          name={activeTab === "home" ? "home" : "home-outline"}
          size={22}
          color={activeTab === "home" ? "#7C3AED" : "#6B7280"}
        />
        <Text style={[styles.storeNavLabel, activeTab === "home" && styles.storeNavLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storeNavTab}
        onPress={() => setActiveTab("categories")}
      >
        <Ionicons
          name={activeTab === "categories" ? "grid" : "grid-outline"}
          size={22}
          color={activeTab === "categories" ? "#7C3AED" : "#6B7280"}
        />
        <Text style={[styles.storeNavLabel, activeTab === "categories" && styles.storeNavLabelActive]}>
          Categories
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storeNavTab}
        onPress={() => setActiveTab("deals")}
      >
        <Ionicons
          name={activeTab === "deals" ? "pricetag" : "pricetag-outline"}
          size={22}
          color={activeTab === "deals" ? "#7C3AED" : "#6B7280"}
        />
        <Text style={[styles.storeNavLabel, activeTab === "deals" && styles.storeNavLabelActive]}>
          Deals
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storeNavTab}
        onPress={() => {
          setActiveTab("orders");
          setActiveModal("orders");
        }}
      >
        <Ionicons
          name={activeTab === "orders" ? "cube" : "cube-outline"}
          size={22}
          color={activeTab === "orders" ? "#7C3AED" : "#6B7280"}
        />
        <Text style={[styles.storeNavLabel, activeTab === "orders" && styles.storeNavLabelActive]}>
          Orders
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storeNavTab}
        onPress={() => setActiveTab("profile")}
      >
        <Ionicons
          name={activeTab === "profile" ? "person" : "person-outline"}
          size={22}
          color={activeTab === "profile" ? "#7C3AED" : "#6B7280"}
        />
        <Text style={[styles.storeNavLabel, activeTab === "profile" && styles.storeNavLabelActive]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Categories View
  // --------------------------------------------------------------------------
  const renderCategoriesTab = () => (
    <View style={styles.tabContentContainer}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.tabHeading}>Product Categories</Text>
        {selectedCategoryId && (
          <TouchableOpacity onPress={() => setSelectedCategoryId(null)}>
            <Text style={styles.clearFilterText}>Show All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesFilterScroll}>
        <TouchableOpacity
          style={[styles.categoryFilterChip, !selectedCategoryId && styles.categoryFilterChipActive]}
          onPress={() => setSelectedCategoryId(null)}
        >
          <Text style={[styles.categoryFilterChipText, !selectedCategoryId && styles.categoryFilterChipTextActive]}>
            All Categories ({products.length})
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => {
          const isSel = selectedCategoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryFilterChip, isSel && styles.categoryFilterChipActive]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={[styles.categoryFilterChipText, isSel && styles.categoryFilterChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Catalog Grid */}
      <View style={styles.productsGrid}>
        {products.map((prod) => (
          <View key={prod.id} style={styles.gridItem}>
            <TouchableOpacity
              style={styles.gridImgBox}
              onPress={() => void openProductDetail(prod)}
            >
              <Image source={{ uri: prod.images?.[0] }} style={styles.gridImg} resizeMode="cover" />
              {prod.featured && (
                <View style={styles.prodPillTag}>
                  <Text style={styles.prodPillTagText}>Featured</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.gridInfo}>
              <Text style={styles.gridTitle} numberOfLines={1}>{prod.name}</Text>
              <Text style={styles.gridPrice}>{rupees(prod.pricePaise)}</Text>
              <TouchableOpacity
                style={styles.addCartBtnLavender}
                onPress={() => void handleAddToCart(prod, 1)}
              >
                <Text style={styles.addCartBtnLavenderText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Deals View
  // --------------------------------------------------------------------------
  const renderDealsTab = () => (
    <View style={styles.tabContentContainer}>
      <Text style={styles.tabHeading}>Exclusive Campus Offers</Text>
      <Text style={styles.tabSubheading}>Special discounts for Navodaya students and verified alumni</Text>

      <View style={styles.couponBannerBox}>
        <View style={styles.couponIconCircle}>
          <Ionicons name="gift" size={24} color="#7C3AED" />
        </View>
        <View style={styles.couponBannerText}>
          <Text style={styles.couponBannerTitle}>Use Coupon: JNVFIRST</Text>
          <Text style={styles.couponBannerDesc}>Get 10% instant off on your first store order.</Text>
        </View>
      </View>

      <View style={[styles.couponBannerBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
        <View style={[styles.couponIconCircle, { backgroundColor: "#DCFCE7" }]}>
          <Ionicons name="sparkles" size={24} color="#15803D" />
        </View>
        <View style={styles.couponBannerText}>
          <Text style={[styles.couponBannerTitle, { color: "#166534" }]}>Alumni Offer: ALUMNI200</Text>
          <Text style={[styles.couponBannerDesc, { color: "#15803D" }]}>Flat ₹200 off on reunion souvenirs and crest apparel.</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Deep Discount Deals</Text>
      </View>

      <View style={styles.productsGrid}>
        {products
          .filter((p) => (p.discountPercent || 0) >= 30)
          .map((prod) => (
            <View key={prod.id} style={styles.gridItem}>
              <TouchableOpacity
                style={styles.gridImgBox}
                onPress={() => void openProductDetail(prod)}
              >
                <Image source={{ uri: prod.images?.[0] }} style={styles.gridImg} resizeMode="cover" />
                <View style={[styles.prodPillTag, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[styles.prodPillTagText, { color: "#15803D" }]}>{prod.discountPercent}% OFF</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.gridInfo}>
                <Text style={styles.gridTitle} numberOfLines={1}>{prod.name}</Text>
                <Text style={styles.gridPrice}>{rupees(prod.pricePaise)}</Text>
                <TouchableOpacity
                  style={styles.addCartBtnLavender}
                  onPress={() => void handleAddToCart(prod, 1)}
                >
                  <Text style={styles.addCartBtnLavenderText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </View>
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDER: Profile View
  // --------------------------------------------------------------------------
  const renderProfileTab = () => (
    <View style={styles.tabContentContainer}>
      <Text style={styles.tabHeading}>Store Customer Profile</Text>

      {/* Profile summary card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={28} color="#7C3AED" />
        </View>
        <View>
          <Text style={styles.profileName}>Navodaya Member</Text>
          <Text style={styles.profileRole}>Verified Campus Shopper</Text>
        </View>
      </View>

      {/* Shortcuts */}
      <TouchableOpacity style={styles.profileOptionRow} onPress={() => setActiveModal("orders")}>
        <View style={styles.profileOptionLeft}>
          <Ionicons name="cube-outline" size={20} color="#7C3AED" />
          <Text style={styles.profileOptionText}>My Order History & Tracking</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.profileOptionRow} onPress={() => setActiveModal("wishlist")}>
        <View style={styles.profileOptionLeft}>
          <Ionicons name="heart-outline" size={20} color="#7C3AED" />
          <Text style={styles.profileOptionText}>My Wishlist ({wishlistIds.size})</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.profileOptionRow}
        onPress={() => {
          setShowAddressForm(true);
          setActiveModal("checkout");
        }}
      >
        <View style={styles.profileOptionLeft}>
          <Ionicons name="location-outline" size={20} color="#7C3AED" />
          <Text style={styles.profileOptionText}>Manage Saved Addresses ({addresses.length})</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.profileOptionRow} onPress={() => setActiveModal("seller")}>
        <View style={styles.profileOptionLeft}>
          <Ionicons name="storefront-outline" size={20} color="#7C3AED" />
          <Text style={styles.profileOptionText}>Sell on Store Room (Alumni & Student Creators)</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.profileOptionRow} onPress={() => setActiveModal("premium")}>
        <View style={styles.profileOptionLeft}>
          <Ionicons name="ribbon-outline" size={20} color="#7C3AED" />
          <Text style={styles.profileOptionText}>Alumni Premium Benefits</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );

  // --------------------------------------------------------------------------
  // MAIN RETURN
  // --------------------------------------------------------------------------
  return (
    <View style={styles.rootContainer}>
      {/* Header & Search */}
      {renderHeader()}

      {/* Main Tab Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "home" && (
          <>
            {renderHeroBanner()}
            {renderCategoryShortcuts()}
            {renderExcitingDeals()}
            {renderPopularProducts()}
            {renderPremiumStrip()}
          </>
        )}

        {activeTab === "categories" && renderCategoriesTab()}
        {activeTab === "deals" && renderDealsTab()}
        {activeTab === "orders" && (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabHeading}>My Store Orders</Text>
            {orderHistory.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No orders placed yet</Text>
                <Text style={styles.emptySubtitle}>Explore the Store Room and place your first order!</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setActiveTab("home")}>
                  <Text style={styles.retryBtnText}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            ) : (
              orderHistory.map((ord) => (
                <TouchableOpacity
                  key={ord.id}
                  style={styles.orderCard}
                  onPress={() => void viewOrderDetails(ord.id)}
                >
                  <View style={styles.orderTopRow}>
                    <Text style={styles.orderNum}>{ord.orderNumber}</Text>
                    <View style={[styles.orderStatusPill, ord.status === "cancelled" ? styles.statusCancelled : styles.statusConfirmed]}>
                      <Text style={[styles.orderStatusText, ord.status === "cancelled" ? styles.statusCancelledText : styles.statusConfirmedText]}>
                        {ord.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.orderDate}>
                    Placed on {new Date(ord.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                  <View style={styles.orderBottomRow}>
                    <Text style={styles.orderTotal}>Total: {rupees(ord.totalPaise)}</Text>
                    <View style={styles.trackDetailsRow}>
                      <Text style={styles.trackDetailsText}>Track Order</Text>
                      <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        {activeTab === "profile" && renderProfileTab()}
      </ScrollView>

      {/* Store Bottom Navigation */}
      {renderStoreBottomNav()}

      {/* ================================================================== */}
      {/* MODAL 1: Product Details Modal                                     */}
      {/* ================================================================== */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent={false}>
        {selectedProduct && (
          <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.modalHeaderBar}>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backModalBtn}>
                <Ionicons name="arrow-back" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>{selectedProduct.name}</Text>
              <TouchableOpacity onPress={() => void handleToggleWishlist(selectedProduct.id)} style={styles.headerWishBtn}>
                <Ionicons
                  name={wishlistIds.has(selectedProduct.id) ? "heart" : "heart-outline"}
                  size={22}
                  color={wishlistIds.has(selectedProduct.id) ? "#EF4444" : "#1F2937"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Product Photo Gallery */}
              <View style={styles.galleryContainer}>
                <Image
                  source={{ uri: selectedProduct.images?.[activePhotoIndex] || selectedProduct.images?.[0] }}
                  style={styles.galleryMainImg}
                  resizeMode="cover"
                />
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <View style={styles.thumbStrip}>
                    {selectedProduct.images.map((img, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setActivePhotoIndex(i)}
                        style={[styles.thumbBox, activePhotoIndex === i && styles.thumbBoxActive]}
                      >
                        <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Product Info */}
              <View style={styles.detailBody}>
                <Text style={styles.detailCategory}>{selectedProduct.category || "Official Merchandise"}</Text>
                <Text style={styles.detailTitle}>{selectedProduct.name}</Text>

                <View style={styles.detailPriceRow}>
                  <Text style={styles.detailPriceBold}>{rupees(selectedProduct.pricePaise)}</Text>
                  {selectedProduct.originalPricePaise && selectedProduct.originalPricePaise > selectedProduct.pricePaise && (
                    <Text style={styles.detailPriceOriginal}>{rupees(selectedProduct.originalPricePaise)}</Text>
                  )}
                  {selectedProduct.discountPercent > 0 && (
                    <View style={styles.discountPillGreen}>
                      <Text style={styles.discountPillGreenText}>{selectedProduct.discountPercent}% OFF</Text>
                    </View>
                  )}
                </View>

                {/* Stock Indicator */}
                <View style={styles.stockStatusRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                  <Text style={styles.stockStatusText}>
                    In Stock ({selectedProduct.stock} units available)
                  </Text>
                </View>

                {/* Variant Selectors */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <View style={styles.variantSection}>
                    {selectedProduct.variants.map((v) => (
                      <View key={v.name} style={styles.variantGroup}>
                        <Text style={styles.variantGroupTitle}>Select {v.name}:</Text>
                        <View style={styles.variantOptionsRow}>
                          {v.options.map((opt) => {
                            const isSelected = selectedVariants[v.name] === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                                onPress={() =>
                                  setSelectedVariants((prev) => ({ ...prev, [v.name]: opt.value }))
                                }
                              >
                                <Text style={[styles.variantChipText, isSelected && styles.variantChipTextSelected]}>
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
                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <View style={styles.quantityStepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setProductQuantity((q) => Math.max(1, q - 1))}
                    >
                      <Ionicons name="remove" size={16} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{productQuantity}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setProductQuantity((q) => Math.min(selectedProduct.stock || 10, q + 1))}
                    >
                      <Ionicons name="add" size={16} color="#1F2937" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pincode Estimator */}
                <View style={styles.pincodeBox}>
                  <Text style={styles.pincodeHeading}>Delivery Options</Text>
                  <View style={styles.pincodeInputRow}>
                    <TextInput
                      style={styles.pincodeInput}
                      placeholder="Enter 6-digit PIN code"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={pincode}
                      onChangeText={setPincode}
                    />
                    <TouchableOpacity style={styles.checkPincodeBtn} onPress={checkPincode}>
                      <Text style={styles.checkPincodeText}>Check</Text>
                    </TouchableOpacity>
                  </View>
                  {pincodeStatus && <Text style={styles.pincodeStatusText}>{pincodeStatus}</Text>}
                </View>

                {/* Description */}
                <Text style={styles.specSectionTitle}>Product Description</Text>
                <Text style={styles.descText}>{selectedProduct.description}</Text>

                {/* Specifications */}
                {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                  <View style={styles.specsBox}>
                    <Text style={styles.specSectionTitle}>Specifications</Text>
                    {Object.entries(selectedProduct.specifications).map(([k, val]) => (
                      <View key={k} style={styles.specRow}>
                        <Text style={styles.specKey}>{k}</Text>
                        <Text style={styles.specVal}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Customer Reviews */}
                <View style={styles.reviewsBox}>
                  <Text style={styles.specSectionTitle}>Verified Reviews ({productReviews.length})</Text>
                  {productReviews.length === 0 ? (
                    <Text style={styles.noReviewsText}>Be the first to review this Navodaya product!</Text>
                  ) : (
                    productReviews.map((rev) => (
                      <View key={rev.id} style={styles.reviewItem}>
                        <View style={styles.reviewTop}>
                          <Text style={styles.reviewerName}>{rev.reviewer || "Verified Alumnus"}</Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Ionicons
                                key={s}
                                name={s <= rev.rating ? "star" : "star-outline"}
                                size={12}
                                color="#F59E0B"
                              />
                            ))}
                          </View>
                        </View>
                        {rev.body ? <Text style={styles.reviewComment}>{rev.body}</Text> : null}
                      </View>
                    ))
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={[styles.modalBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={styles.modalAddCartBtn}
                onPress={() => {
                  void handleAddToCart(selectedProduct, productQuantity, selectedVariants);
                }}
              >
                <Ionicons name="cart-outline" size={18} color="#7C3AED" style={{ marginRight: 6 }} />
                <Text style={styles.modalAddCartText}>Add to Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBuyNowBtn}
                onPress={() => {
                  void handleAddToCart(selectedProduct, productQuantity, selectedVariants).then(() => {
                    setSelectedProduct(null);
                    setActiveModal("cart");
                  });
                }}
              >
                <Text style={styles.modalBuyNowText}>Buy Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 2: Shopping Cart Drawer                                      */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "cart"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Shopping Cart ({totalCartCount})</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* Free Delivery Bar */}
            <View style={styles.freeDeliveryBanner}>
              {cartSubtotalPaise >= 50000 ? (
                <Text style={styles.freeDeliveryText}>🎉 Congratulations! You have unlocked FREE campus shipping.</Text>
              ) : (
                <Text style={styles.freeDeliveryText}>
                  Add {rupees(50000 - cartSubtotalPaise)} more for FREE campus delivery.
                </Text>
              )}
            </View>

            {cartItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cart-outline" size={56} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
                <Text style={styles.emptySubtitle}>Explore the Store Room and discover Navodaya essentials!</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setActiveModal(null)}>
                  <Text style={styles.retryBtnText}>Continue Shopping</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Cart Items List */}
                {cartItems.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    <Image
                      source={{ uri: item.images?.[0] || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80" }}
                      style={styles.cartItemImg}
                      resizeMode="cover"
                    />
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemTitle} numberOfLines={2}>{item.productName}</Text>
                      {item.variantSelection ? (
                        <Text style={styles.cartItemVariant}>{item.variantSelection}</Text>
                      ) : null}
                      <Text style={styles.cartItemPrice}>{rupees(item.pricePaise)}</Text>

                      {/* Stepper & Delete */}
                      <View style={styles.cartStepperRow}>
                        <View style={styles.quantityStepperSmall}>
                          <TouchableOpacity
                            style={styles.stepperSmallBtn}
                            onPress={() => void handleUpdateCartQuantity(item, item.quantity - 1)}
                          >
                            <Ionicons name="remove" size={14} color="#1F2937" />
                          </TouchableOpacity>
                          <Text style={styles.stepperSmallVal}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.stepperSmallBtn}
                            onPress={() => void handleUpdateCartQuantity(item, item.quantity + 1)}
                          >
                            <Ionicons name="add" size={14} color="#1F2937" />
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          style={styles.cartDeleteBtn}
                          onPress={() => void handleUpdateCartQuantity(item, 0)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Coupon Box */}
                <View style={styles.couponBox}>
                  <Text style={styles.couponBoxTitle}>Apply Coupon / Gift Voucher</Text>
                  <View style={styles.couponInputRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="e.g. JNVFIRST or ALUMNI200"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      value={couponCode}
                      onChangeText={setCouponCode}
                    />
                    <TouchableOpacity style={styles.applyCouponBtn} onPress={handleApplyCoupon}>
                      <Text style={styles.applyCouponText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                  {appliedCoupon && (
                    <Text style={styles.couponSuccessText}>
                      ✓ Coupon {appliedCoupon.code} applied: {rupees(appliedCoupon.discountPaise)} discount.
                    </Text>
                  )}
                  {couponError && <Text style={styles.couponErrorText}>{couponError}</Text>}
                </View>

                {/* Price Breakdown */}
                <View style={styles.billBox}>
                  <Text style={styles.billTitle}>Order Summary</Text>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billVal}>{rupees(cartSubtotalPaise)}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Campus Delivery</Text>
                    <Text style={styles.billVal}>
                      {deliveryFeePaise === 0 ? "FREE" : rupees(deliveryFeePaise)}
                    </Text>
                  </View>
                  {appliedCoupon && (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: "#15803D" }]}>Discount ({appliedCoupon.code})</Text>
                      <Text style={[styles.billVal, { color: "#15803D" }]}>
                        -{rupees(appliedCoupon.discountPaise)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.billRow, styles.billTotalRow]}>
                    <Text style={styles.billTotalLabel}>Total Amount</Text>
                    <Text style={styles.billTotalVal}>{rupees(cartTotalPaise)}</Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {cartItems.length > 0 && (
            <View style={[styles.modalBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View>
                <Text style={styles.cartBottomTotalLabel}>Total:</Text>
                <Text style={styles.cartBottomTotalVal}>{rupees(cartTotalPaise)}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtnPrimary} onPress={handleProceedToCheckout}>
                <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 3: Checkout & Address Selection                              */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "checkout"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal("cart")} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Checkout</Text>
            <View style={{ width: 24 }} />
          </View>

          {confirmedOrder ? (
            /* Order Confirmation Celebration */
            <View style={styles.confirmedOrderBox}>
              <View style={styles.confirmedCheckCircle}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.confirmedTitle}>Order Placed Successfully!</Text>
              <Text style={styles.confirmedSubtitle}>Order Number: #{confirmedOrder.orderNumber}</Text>
              <Text style={styles.confirmedDesc}>
                Thank you for shopping at the Navodaya Connect Store Room. A confirmation email and tracking link have been generated.
              </Text>
              <TouchableOpacity
                style={styles.viewConfirmedOrderBtn}
                onPress={() => {
                  setConfirmedOrder(null);
                  setActiveModal("orders");
                }}
              >
                <Text style={styles.viewConfirmedOrderText}>View & Track Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.continueShopBtn}
                onPress={() => {
                  setConfirmedOrder(null);
                  setActiveModal(null);
                }}
              >
                <Text style={styles.continueShopText}>Back to Store Room</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 120 }}>
              {/* Delivery Address Section */}
              <View style={styles.checkoutSection}>
                <View style={styles.checkoutSecHeader}>
                  <Text style={styles.checkoutSecTitle}>1. Delivery Address</Text>
                  <TouchableOpacity onPress={() => setShowAddressForm(!showAddressForm)}>
                    <Text style={styles.addNewAddrText}>
                      {showAddressForm ? "Cancel" : "+ Add New"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showAddressForm ? (
                  <View style={styles.addressFormCard}>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Recipient Full Name"
                      placeholderTextColor="#9CA3AF"
                      value={addressForm.recipientName}
                      onChangeText={(t) => setAddressForm((f) => ({ ...f, recipientName: t }))}
                    />
                    <TextInput
                      style={styles.formInput}
                      placeholder="10-digit Phone Number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={addressForm.phone}
                      onChangeText={(t) => setAddressForm((f) => ({ ...f, phone: t }))}
                    />
                    <TextInput
                      style={styles.formInput}
                      placeholder="Address Line 1 (Hostel / House / Room No.)"
                      placeholderTextColor="#9CA3AF"
                      value={addressForm.line1}
                      onChangeText={(t) => setAddressForm((f) => ({ ...f, line1: t }))}
                    />
                    <View style={styles.formRow}>
                      <TextInput
                        style={[styles.formInput, { flex: 1, marginRight: 8 }]}
                        placeholder="City / Campus"
                        placeholderTextColor="#9CA3AF"
                        value={addressForm.city}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, city: t }))}
                      />
                      <TextInput
                        style={[styles.formInput, { flex: 1 }]}
                        placeholder="PIN Code"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={addressForm.pincode}
                        onChangeText={(t) => setAddressForm((f) => ({ ...f, pincode: t }))}
                      />
                    </View>
                    <TouchableOpacity style={styles.saveAddrBtn} onPress={handleSaveAddress}>
                      <Text style={styles.saveAddrText}>Save & Use Address</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.savedAddressesList}>
                    {addresses.length === 0 ? (
                      <TouchableOpacity
                        style={styles.addFirstAddrCard}
                        onPress={() => setShowAddressForm(true)}
                      >
                        <Ionicons name="add-circle-outline" size={24} color="#7C3AED" />
                        <Text style={styles.addFirstAddrText}>Add a Delivery Address to continue</Text>
                      </TouchableOpacity>
                    ) : (
                      addresses.map((addr) => (
                        <TouchableOpacity
                          key={addr.id}
                          style={[
                            styles.addressCard,
                            selectedAddressId === addr.id && styles.addressCardSelected,
                          ]}
                          onPress={() => setSelectedAddressId(addr.id)}
                        >
                          <Ionicons
                            name={selectedAddressId === addr.id ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={selectedAddressId === addr.id ? "#7C3AED" : "#9CA3AF"}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.addressRecipient}>
                              {addr.recipientName} ({addr.type.toUpperCase()})
                            </Text>
                            <Text style={styles.addressLine}>{addr.line1}, {addr.city}</Text>
                            <Text style={styles.addressPin}>PIN: {addr.pincode} | Ph: {addr.phone}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* Payment Method Section */}
              <View style={styles.checkoutSection}>
                <Text style={styles.checkoutSecTitle}>2. Payment Method</Text>

                {[
                  { id: "upi", label: "UPI (Google Pay, PhonePe, Paytm, BHIM)", icon: "qr-code-outline" },
                  { id: "card", label: "Credit / Debit Card (Visa, MasterCard, RuPay)", icon: "card-outline" },
                  { id: "netbanking", label: "Net Banking (SBI, HDFC, ICICI, etc.)", icon: "business-outline" },
                  { id: "cod", label: "Cash on Delivery (Campus Handover)", icon: "cash-outline" },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.paymentMethodCard, paymentMethod === m.id && styles.paymentMethodSelected]}
                    onPress={() => setPaymentMethod(m.id as any)}
                  >
                    <Ionicons
                      name={paymentMethod === m.id ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={paymentMethod === m.id ? "#7C3AED" : "#9CA3AF"}
                      style={{ marginRight: 10 }}
                    />
                    <Ionicons name={m.icon as any} size={20} color="#4C1D95" style={{ marginRight: 10 }} />
                    <Text style={styles.paymentMethodLabel}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order Final Summary */}
              <View style={styles.checkoutSection}>
                <Text style={styles.checkoutSecTitle}>3. Payable Amount</Text>
                <View style={styles.billBox}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Total Items</Text>
                    <Text style={styles.billVal}>{totalCartCount}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Delivery Charges</Text>
                    <Text style={styles.billVal}>{deliveryFeePaise === 0 ? "FREE" : rupees(deliveryFeePaise)}</Text>
                  </View>
                  <View style={[styles.billRow, styles.billTotalRow]}>
                    <Text style={styles.billTotalLabel}>Final Amount</Text>
                    <Text style={styles.billTotalVal}>{rupees(cartTotalPaise)}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          {!confirmedOrder && (
            <View style={[styles.modalBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={[styles.placeOrderBtn, placingOrder && { opacity: 0.7 }]}
                disabled={placingOrder}
                onPress={handlePlaceOrder}
              >
                {placingOrder ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.placeOrderBtnText}>Pay & Place Order ({rupees(cartTotalPaise)})</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 4: Order Details & Live Tracking Timeline                    */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "orderDetail"} animationType="slide">
        {selectedOrderDetails && (
          <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.modalHeaderBar}>
              <TouchableOpacity onPress={() => setActiveModal("orders")} style={styles.backModalBtn}>
                <Ionicons name="arrow-back" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Order #{selectedOrderDetails.orderNumber}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Status Header */}
              <View style={styles.orderStatusHero}>
                <Text style={styles.orderHeroStatus}>
                  Status: {selectedOrderDetails.status.toUpperCase()}
                </Text>
                <Text style={styles.orderHeroSub}>
                  Placed on {new Date(selectedOrderDetails.createdAt).toLocaleString()}
                </Text>
              </View>

              {/* Live Tracking Stepper */}
              <View style={styles.timelineCard}>
                <Text style={styles.timelineHeading}>Live Delivery Timeline</Text>
                {[
                  { status: "confirmed", label: "Order Confirmed", desc: "Payment verified by store" },
                  { status: "packed", label: "Packed at Campus Hub", desc: "Ready for courier dispatch" },
                  { status: "shipped", label: "Shipped in Transit", desc: "Dispatched via campus speed post" },
                  { status: "out_for_delivery", label: "Out for Delivery", desc: "Delivery agent on campus route" },
                  { status: "delivered", label: "Delivered", desc: "Handover confirmed" },
                ].map((step, idx) => {
                  const statusOrder = ["pending", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
                  const currentIdx = statusOrder.indexOf(selectedOrderDetails.status);
                  const thisIdx = statusOrder.indexOf(step.status);
                  const isDone = currentIdx >= thisIdx && selectedOrderDetails.status !== "cancelled";

                  return (
                    <View key={step.status} style={styles.timelineStepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <View style={[styles.stepDot, isDone && styles.stepDotDone]}>
                          {isDone ? (
                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                          ) : (
                            <View style={styles.stepDotInner} />
                          )}
                        </View>
                        {idx < 4 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>
                          {step.label}
                        </Text>
                        <Text style={styles.stepDesc}>{step.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Items in this order */}
              <View style={styles.orderItemsSection}>
                <Text style={styles.timelineHeading}>Ordered Items ({selectedOrderDetails.items?.length || 0})</Text>
                {selectedOrderDetails.items?.map((it) => (
                  <View key={it.id} style={styles.orderItemCard}>
                    <Image
                      source={{ uri: it.imageUrl || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80" }}
                      style={styles.orderItemImg}
                      resizeMode="cover"
                    />
                    <View style={styles.orderItemText}>
                      <Text style={styles.orderItemName}>{it.productName}</Text>
                      <Text style={styles.orderItemPrice}>
                        {rupees(it.unitPricePaise)} × {it.quantity} = {rupees(it.unitPricePaise * it.quantity)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Order Summary Details */}
              <View style={styles.orderAddressBox}>
                <Text style={styles.timelineHeading}>Order Summary</Text>
                <Text style={styles.addrRecipientText}>Order Reference: #{selectedOrderDetails.orderNumber}</Text>
                <Text style={styles.addrDetailText}>Total Amount: {rupees(selectedOrderDetails.totalPaise)}</Text>
                <Text style={styles.addrDetailText}>Payment Status: {selectedOrderDetails.paymentStatus.toUpperCase()}</Text>
              </View>

              {/* Cancel Action if applicable */}
              {selectedOrderDetails.status !== "delivered" && selectedOrderDetails.status !== "cancelled" && (
                <TouchableOpacity
                  style={styles.cancelOrderBtn}
                  disabled={cancellingOrderId === selectedOrderDetails.id}
                  onPress={() => void handleCancelOrder(selectedOrderDetails.id)}
                >
                  {cancellingOrderId === selectedOrderDetails.id ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <Text style={styles.cancelOrderBtnText}>Cancel This Order</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 5: Wishlist Modal                                            */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "wishlist"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>My Wishlist ({wishlistIds.size})</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 100 }}>
            {wishlistIds.size === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="heart-outline" size={56} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
                <Text style={styles.emptySubtitle}>Tap the heart icon on any product to save it for later.</Text>
              </View>
            ) : (
              products
                .filter((p) => wishlistIds.has(p.id))
                .map((prod) => (
                  <View key={prod.id} style={styles.cartItemRow}>
                    <Image source={{ uri: prod.images?.[0] }} style={styles.cartItemImg} resizeMode="cover" />
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemTitle}>{prod.name}</Text>
                      <Text style={styles.cartItemPrice}>{rupees(prod.pricePaise)}</Text>
                      <View style={{ flexDirection: "row", marginTop: 8 }}>
                        <TouchableOpacity
                          style={styles.addCartBtnLavender}
                          onPress={() => void handleAddToCart(prod, 1)}
                        >
                          <Text style={styles.addCartBtnLavenderText}>Move to Cart</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cartDeleteBtn, { marginLeft: 10 }]}
                          onPress={() => void handleToggleWishlist(prod.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 6: Seller Application Modal ("Sell on Store Room")           */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "seller"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Sell on Store Room</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <View style={styles.sellerIntroCard}>
              <Ionicons name="sparkles" size={24} color="#7C3AED" />
              <Text style={styles.sellerIntroTitle}>Navodaya Entrepreneur Portal</Text>
              <Text style={styles.sellerIntroDesc}>
                Are you an alumnus, teacher, or student creator with Navodaya merchandise, handcrafted goods, or educational tools? Apply to list your products in the Store Room!
              </Text>
            </View>

            <TextInput
              style={styles.formInput}
              placeholder="Business / Creator Name"
              placeholderTextColor="#9CA3AF"
              value={sellerBusinessName}
              onChangeText={setSellerBusinessName}
            />

            <TextInput
              style={[styles.formInput, { height: 90, textAlignVertical: "top" }]}
              placeholder="Describe the products you plan to sell (e.g. Handmade pins, batch hoodies, study guides)"
              placeholderTextColor="#9CA3AF"
              multiline
              value={sellerDescription}
              onChangeText={setSellerDescription}
            />

            <TouchableOpacity
              style={[styles.saveAddrBtn, submittingSeller && { opacity: 0.7 }]}
              disabled={submittingSeller}
              onPress={handleApplySeller}
            >
              {submittingSeller ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveAddrText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 7: Filter & Sort Modal                                       */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "filter"} animationType="slide" transparent>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter & Sort</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.filterSectionTitle}>Sort By</Text>
              {[
                { id: "featured", label: "Featured & Popular" },
                { id: "price_asc", label: "Price: Low to High" },
                { id: "price_desc", label: "Price: High to Low" },
                { id: "rating", label: "Customer Rating" },
                { id: "newest", label: "Newest First" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.filterOptionRow}
                  onPress={() => setSortBy(opt.id as any)}
                >
                  <Text style={[styles.filterOptionText, sortBy === opt.id && styles.filterOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.id && <Ionicons name="checkmark" size={18} color="#7C3AED" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.applyFilterBtn} onPress={() => setActiveModal(null)}>
              <Text style={styles.applyFilterBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 8: Notifications Modal                                       */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "notifications"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Store Notifications</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ padding: 16 }}>
            <View style={styles.notifCard}>
              <Ionicons name="gift-outline" size={24} color="#7C3AED" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>Welcome to Store Room!</Text>
                <Text style={styles.notifBody}>
                  Enjoy exclusive campus delivery and use coupon code JNVFIRST for 10% off your first order.
                </Text>
                <Text style={styles.notifTime}>Just now</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 9: Premium Membership Informative Modal                       */}
      {/* ================================================================== */}
      <Modal visible={activeModal === "premium"} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.backModalBtn}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Alumni Premium</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20 }}>
            <LinearGradient colors={["#4C1D95", "#6D28D9"]} style={styles.premiumHeroBanner}>
              <Ionicons name="ribbon" size={40} color="#FBBF24" />
              <Text style={styles.premiumHeroTitle}>Navodaya Connect Premium</Text>
              <Text style={styles.premiumHeroSubtitle}>Elevate your network, support your alma mater.</Text>
            </LinearGradient>

            <Text style={styles.premiumBenefitHeading}>Exclusive Privileges:</Text>

            {[
              { icon: "pricetag", title: "Flat 20% Store Discount", desc: "Enjoy perpetual discount on all reunion hoodies, polos & memorabilia." },
              { icon: "people", title: "Global Alumni Directory", desc: "Direct outreach to senior alumni across IAS, IPS, AIIMS, IIT, and global tech." },
              { icon: "analytics", title: "Career & Mentorship Insights", desc: "Access high-yield career roadmaps and 1-on-1 mentorship pairings." },
              { icon: "shield-checkmark", title: "Verified Gold Crest Badge", desc: "Golden badge displayed across all your posts, comments, and profile." },
            ].map((b, i) => (
              <View key={i} style={styles.premiumBenefitItem}>
                <View style={styles.benefitIconBox}>
                  <Ionicons name={b.icon as any} size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.joinPremiumBtn}
              onPress={() => {
                setActiveModal(null);
                try {
                  router.push("/(screens)/alumni-zone" as any);
                } catch {
                  Alert.alert("Alumni Zone", "Alumni verification and premium membership activated for your account.");
                }
              }}
            >
              <Text style={styles.joinPremiumBtnText}>Explore Alumni Zone</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------------------------------
// STYLESHEET
// ----------------------------------------------------------------------------
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#FDFCFE",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },

  // --------------------------------------------------------------------------
  // Header & Brand
  // --------------------------------------------------------------------------
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  storeLogoGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  bagLogoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 10,
  },
  bagGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bagJnvText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: -2,
  },
  titleTextBox: {
    justifyContent: "center",
  },
  storeRoomTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#2E1065",
    letterSpacing: -0.3,
  },
  storeRoomSubtitle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 1,
  },
  headerActionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeOrange: {
    backgroundColor: "#EA580C",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // --------------------------------------------------------------------------
  // Search Bar
  // --------------------------------------------------------------------------
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1F2937",
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  searchSuggestionsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  suggestionsHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    marginBottom: 6,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  suggestionChipText: {
    fontSize: 11,
    color: "#581C87",
    fontFamily: "Inter_500Medium",
  },

  // --------------------------------------------------------------------------
  // Hero Promotional Banner (Section C)
  // --------------------------------------------------------------------------
  heroSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  heroBannerCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 180,
    shadowColor: "#581C87",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLeftContent: {
    flex: 1.1,
    paddingRight: 8,
  },
  heroTagPill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  heroTagText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 26,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#E0E7FF",
    marginBottom: 12,
  },
  heroCtaBtn: {
    backgroundColor: "#FBBF24",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  heroCtaText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  heroRightContent: {
    flex: 0.9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroQuoteText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#FEF08A",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 8,
  },
  heroVisualCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  heroHoodieImg: {
    width: 60,
    height: 75,
    borderRadius: 8,
    transform: [{ rotate: "-6deg" }],
  },
  heroTeeImg: {
    width: 55,
    height: 70,
    borderRadius: 8,
    marginLeft: -10,
    zIndex: 2,
  },
  heroBottleImg: {
    width: 32,
    height: 65,
    borderRadius: 6,
    marginLeft: -6,
    zIndex: 3,
    transform: [{ rotate: "4deg" }],
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: "#7C3AED",
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "#DDD6FE",
  },

  // --------------------------------------------------------------------------
  // Categories Shortcuts (Section D)
  // --------------------------------------------------------------------------
  categorySection: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryCol: {
    alignItems: "center",
    flex: 1,
  },
  categorySquircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categorySquircleActive: {
    backgroundColor: "#DDD6FE",
    borderColor: "#7C3AED",
  },
  categoryLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#374151",
    textAlign: "center",
  },
  categoryLabelActive: {
    color: "#581C87",
    fontFamily: "Inter_700Bold",
  },

  // --------------------------------------------------------------------------
  // Section Headers & Common Containers
  // --------------------------------------------------------------------------
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  flameEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 1,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // --------------------------------------------------------------------------
  // Exciting Deals Cards (Section E)
  // --------------------------------------------------------------------------
  dealsScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  dealCard: {
    width: 260,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dealCardLight: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  dealContent: {
    flex: 1,
    paddingRight: 8,
  },
  dealTagWhite: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  dealTagDark: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#4C1D95",
  },
  dealBadgeYellow: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginVertical: 4,
  },
  dealBadgeYellowText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  dealBadgeDark: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#EA580C",
    marginVertical: 2,
  },
  dealTitleWhite: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#E0E7FF",
  },
  dealActionBtnDark: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  dealActionTextDark: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  dealImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },

  // --------------------------------------------------------------------------
  // Popular Products (Section F)
  // --------------------------------------------------------------------------
  productsScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  productCard: {
    width: 155,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3E8FF",
    padding: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  prodImgContainer: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    position: "relative",
  },
  prodCardImg: {
    width: "100%",
    height: "100%",
  },
  wishlistIconBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  prodPillTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prodPillTagText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  prodCardBody: {
    paddingTop: 8,
  },
  prodTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    marginBottom: 4,
  },
  prodPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  prodPriceBold: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  prodPriceOriginal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  discountPillGreen: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountPillGreenText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#15803D",
  },
  prodRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  prodRatingText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  addCartBtnLavender: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingVertical: 6,
    borderRadius: 8,
  },
  addCartBtnLavenderText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // --------------------------------------------------------------------------
  // Premium Promotional Strip (Section G)
  // --------------------------------------------------------------------------
  premiumStripSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  premiumCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  premiumLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  crownSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  premiumTextBox: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#2E1065",
  },
  premiumSubtitle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 1,
  },
  goPremiumBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  goPremiumText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // --------------------------------------------------------------------------
  // Store-Specific Bottom Navigation Bar (Section H)
  // --------------------------------------------------------------------------
  storeBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EDE9FE",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  storeNavTab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  storeNavLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    marginTop: 2,
  },
  storeNavLabelActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },

  // --------------------------------------------------------------------------
  // Tab Views (Categories, Deals, Profile, Orders)
  // --------------------------------------------------------------------------
  tabContentContainer: {
    padding: 16,
  },
  tabHeading: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 4,
  },
  tabSubheading: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginBottom: 14,
  },
  tabHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  clearFilterText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  categoriesFilterScroll: {
    marginBottom: 16,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3E8FF",
    marginRight: 8,
  },
  categoryFilterChipActive: {
    backgroundColor: "#7C3AED",
  },
  categoryFilterChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#581C87",
  },
  categoryFilterChipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridItem: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    padding: 8,
    marginBottom: 4,
  },
  gridImgBox: {
    width: "100%",
    height: 130,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F9FAFB",
  },
  gridImg: {
    width: "100%",
    height: "100%",
  },
  gridInfo: {
    paddingTop: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    marginBottom: 2,
  },
  gridPrice: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 6,
  },

  // Deals Tab
  couponBannerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  couponIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  couponBannerText: {
    flex: 1,
  },
  couponBannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#581C87",
  },
  couponBannerDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },

  // Profile Tab
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    marginBottom: 16,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  profileRole: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  profileOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3E8FF",
    marginBottom: 10,
  },
  profileOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileOptionText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1F2937",
  },

  // --------------------------------------------------------------------------
  // Orders
  // --------------------------------------------------------------------------
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    marginBottom: 10,
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  orderNum: {
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
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2",
  },
  statusCancelledText: {
    color: "#B91C1C",
  },
  orderDate: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 10,
  },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderTotal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  trackDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trackDetailsText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // --------------------------------------------------------------------------
  // Modals & General Details
  // --------------------------------------------------------------------------
  modalRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  backModalBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    maxWidth: "70%",
    textAlign: "center",
  },
  headerWishBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  modalBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EDE9FE",
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },

  // Product Detail Elements
  galleryContainer: {
    backgroundColor: "#F9FAFB",
    paddingBottom: 12,
  },
  galleryMainImg: {
    width: "100%",
    height: 320,
  },
  thumbStrip: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  thumbBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  thumbBoxActive: {
    borderColor: "#7C3AED",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  detailBody: {
    padding: 16,
  },
  detailCategory: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 8,
  },
  detailPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
  },
  detailPriceBold: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  detailPriceOriginal: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  stockStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 14,
  },
  stockStatusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#15803D",
  },
  variantSection: {
    marginBottom: 14,
  },
  variantGroup: {
    marginBottom: 10,
  },
  variantGroupTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 6,
  },
  variantOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variantChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#FDFCFE",
  },
  variantChipSelected: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  variantChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  variantChipTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  quantitySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3E8FF",
    marginBottom: 14,
  },
  quantityLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 8,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepperVal: {
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  pincodeBox: {
    backgroundColor: "#FAF5FF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginBottom: 16,
  },
  pincodeHeading: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#581C87",
    marginBottom: 6,
  },
  pincodeInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  pincodeInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 10,
    fontSize: 12,
  },
  checkPincodeBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 8,
  },
  checkPincodeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  pincodeStatusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#15803D",
    marginTop: 6,
  },
  specSectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginTop: 10,
    marginBottom: 6,
  },
  descText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
    lineHeight: 18,
    marginBottom: 12,
  },
  specsBox: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  specKey: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
  specVal: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#111827",
  },
  reviewsBox: {
    marginTop: 10,
  },
  noReviewsText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  reviewItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewerName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  modalAddCartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    backgroundColor: "#F3E8FF",
    marginRight: 8,
  },
  modalAddCartText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  modalBuyNowBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
  },
  modalBuyNowText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // Cart Drawer Elements
  freeDeliveryBanner: {
    backgroundColor: "#FAF5FF",
    padding: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E9D5FF",
  },
  freeDeliveryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#581C87",
  },
  cartItemRow: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
    alignItems: "center",
  },
  cartItemImg: {
    width: 65,
    height: 65,
    borderRadius: 10,
    marginRight: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  cartItemVariant: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#7C3AED",
    marginTop: 2,
  },
  cartItemPrice: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginTop: 4,
  },
  cartStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  quantityStepperSmall: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 6,
  },
  stepperSmallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperSmallVal: {
    paddingHorizontal: 8,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  cartDeleteBtn: {
    padding: 6,
  },
  couponBox: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  couponBoxTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#374151",
    marginBottom: 6,
  },
  couponInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    fontSize: 12,
  },
  applyCouponBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 8,
  },
  applyCouponText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  couponSuccessText: {
    fontSize: 11,
    color: "#15803D",
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
  },
  couponErrorText: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 6,
  },
  billBox: {
    padding: 16,
  },
  billTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 8,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  billLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  billVal: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 6,
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
  cartBottomTotalLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  cartBottomTotalVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  checkoutBtnPrimary: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkoutBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // Checkout Specifics
  checkoutSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  checkoutSecHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  checkoutSecTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addNewAddrText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  addressFormCard: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  formInput: {
    height: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    fontSize: 12,
    marginBottom: 8,
  },
  formRow: {
    flexDirection: "row",
  },
  saveAddrBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  saveAddrText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  savedAddressesList: {
    gap: 8,
  },
  addFirstAddrCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#7C3AED",
    borderRadius: 12,
    gap: 8,
  },
  addFirstAddrText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  addressCardSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
  },
  addressRecipient: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addressLine: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  addressPin: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  paymentMethodSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
  },
  paymentMethodLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#1F2937",
    flex: 1,
  },
  placeOrderBtn: {
    flex: 1,
    backgroundColor: "#7C3AED",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  placeOrderBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // Confirmed Celebration
  confirmedOrderBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  confirmedCheckCircle: {
    marginBottom: 12,
  },
  confirmedTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  confirmedSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
    marginBottom: 12,
  },
  confirmedDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  viewConfirmedOrderBtn: {
    width: "100%",
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  viewConfirmedOrderText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  continueShopBtn: {
    paddingVertical: 10,
  },
  continueShopText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // Order Detail & Timeline
  orderStatusHero: {
    backgroundColor: "#FAF5FF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9D5FF",
  },
  orderHeroStatus: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#581C87",
  },
  orderHeroSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  timelineCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  timelineHeading: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 12,
  },
  timelineStepRow: {
    flexDirection: "row",
  },
  stepIndicatorCol: {
    alignItems: "center",
    width: 24,
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    backgroundColor: "#10B981",
  },
  stepDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9CA3AF",
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 2,
    minHeight: 24,
  },
  stepLineDone: {
    backgroundColor: "#10B981",
  },
  stepContentCol: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 16,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  stepLabelDone: {
    color: "#111827",
  },
  stepDesc: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 1,
  },
  orderItemsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8FF",
  },
  orderItemCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderItemImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
  },
  orderItemText: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  orderItemVar: {
    fontSize: 10,
    color: "#7C3AED",
  },
  orderItemPrice: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#374151",
    marginTop: 2,
  },
  orderAddressBox: {
    padding: 16,
  },
  addrRecipientText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addrDetailText: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  cancelOrderBtn: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
    alignItems: "center",
  },
  cancelOrderBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#EF4444",
  },

  // Seller Modal
  sellerIntroCard: {
    backgroundColor: "#FAF5FF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginBottom: 16,
  },
  sellerIntroTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#581C87",
    marginTop: 4,
    marginBottom: 4,
  },
  sellerIntroDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 16,
  },

  // Filter Modal
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  filterModalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  filterSectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#6B7280",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  filterOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  filterOptionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  filterOptionTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  applyFilterBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  applyFilterBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // Notifications
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FAF5FF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  notifTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  notifBody: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 6,
  },

  // Premium Modal
  premiumHeroBanner: {
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  premiumHeroTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 8,
  },
  premiumHeroSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#E0E7FF",
    marginTop: 2,
    textAlign: "center",
  },
  premiumBenefitHeading: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 12,
  },
  premiumBenefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    marginBottom: 10,
  },
  benefitIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  benefitDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
  joinPremiumBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  joinPremiumBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // Common Feedback
  loadingBox: {
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  errorBox: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    marginHorizontal: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#DC2626",
    marginTop: 6,
  },
  errorMessage: {
    fontSize: 11,
    color: "#991B1B",
    marginTop: 2,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  retryBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  emptyBox: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#374151",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    textAlign: "center",
  },
});
