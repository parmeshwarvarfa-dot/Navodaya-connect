import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type StoreAddress, type StoreAddressInput, type StoreCartItem, type StoreCategory, type StoreCheckoutPreview, type StoreConfig, type StoreProduct, type StoreReview } from "@/lib/api";

type StoreModal = "cart" | "checkout" | "orders" | null;
const availableStock = (product: StoreProduct) => product.variants?.length ? Math.min(...product.variants.map((variant) => Math.max(0, ...variant.options.map((option) => option.stock)))) : product.stock;
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const emptyAddress: StoreAddressInput = { recipientName: "", phone: "", type: "home", line1: "", line2: "", city: "", district: "", state: "", pincode: "", instructions: "", isDefault: true };

export default function Storefront({ showBack = false }: { showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [cart, setCart] = useState<StoreCartItem[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [addresses, setAddresses] = useState<StoreAddress[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [modal, setModal] = useState<StoreModal>(null);
  const [detail, setDetail] = useState<StoreProduct | null>(null);
  const [detailReviews, setDetailReviews] = useState<StoreReview[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [orderHistory, setOrderHistory] = useState<import("@/lib/api").StoreOrder[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [preview, setPreview] = useState<StoreCheckoutPreview | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<StoreAddressInput>(emptyAddress);

  const loadCatalog = useCallback(async (nextPage = 1) => {
    setLoading(true); setCatalogError("");
    try {
      const result = await api.store.products({ q: query.trim() || undefined, category: activeCategory || undefined, sort, page: nextPage, pageSize: 20 });
      setProducts((current) => nextPage === 1 ? result.items : [...current, ...result.items]);
      setPage(result.page); setTotalProducts(result.total); setHasMore(result.hasMore);
    } catch (e) {
      const status = typeof e === "object" && e && "status" in e ? (e as { status?: number }).status : undefined;
      const message = status === 401
        ? "The product API rejected the public catalog request. Restart the current API server build, then refresh."
        : e instanceof Error ? e.message : "The Store catalog could not be loaded.";
      setCatalogError(message); setProducts([]); setTotalProducts(0); setHasMore(false);
    }
    finally { setLoading(false); }
  }, [activeCategory, query, sort]);

  useEffect(() => { void api.store.categories().then(setCategories).catch(() => setCategories([])); void api.store.config().then(setConfig).catch(() => setConfig(null)); }, []);
  useEffect(() => { const timer = setTimeout(() => { void loadCatalog(1); }, 220); return () => clearTimeout(timer); }, [loadCatalog]);

  const loadCart = useCallback(async () => {
    try { setCart((await api.store.cart()).items); }
    catch { setCart([]); }
  }, []);
  const loadWishlist = useCallback(async () => {
    try { setWishlist(new Set((await api.store.wishlist()).items.map((item) => item.id))); }
    catch { setWishlist(new Set()); }
  }, []);
  useEffect(() => { void loadCart(); void loadWishlist(); }, [loadCart, loadWishlist]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.pricePaise, 0);
  const featured = useMemo(() => products.filter((item) => item.featured).slice(0, 8), [products]);

  const showRequestError = (e: unknown) => {
    const message = e instanceof Error ? e.message : "The request could not be completed.";
    setError(message);
    const status = typeof e === "object" && e && "status" in e ? (e as { status?: number }).status : undefined;
    if (status === 401) Alert.alert("Sign in required", "Sign in to save your cart, wishlist and delivery addresses.", [{ text: "Cancel", style: "cancel" }, { text: "Sign in", onPress: () => router.push("/(auth)/sign-in" as any) }]);
  };

  const setQuantity = async (item: StoreCartItem, quantity: number) => {
    if (quantity <= 0) { try { await api.store.removeCartItem(item.id); await loadCart(); } catch (e) { showRequestError(e); } return; }
    try { setBusy(true); await api.store.setCartItem(item.productId, quantity, JSON.parse(item.variantSelection || "{}")); await loadCart(); }
    catch (e) { showRequestError(e); }
    finally { setBusy(false); }
  };
  const addToCart = async (product: StoreProduct, selection: Record<string, string> = {}) => {
    if (product.variants?.some((variant) => !selection[variant.name])) { setError("Select an available option for each product variant."); return; }
    const variantSelection = JSON.stringify(Object.fromEntries(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b))));
    try { setBusy(true); const existing = cart.find((item) => item.productId === product.id && (item.variantSelection || "{}") === variantSelection); await api.store.setCartItem(product.id, (existing?.quantity ?? 0) + 1, selection); await loadCart(); setDetail(null); setModal("cart"); }
    catch (e) { showRequestError(e); }
    finally { setBusy(false); }
  };
  const toggleWishlist = async (productId: string) => {
    try {
      const saved = wishlist.has(productId);
      if (saved) await api.store.removeWishlist(productId); else await api.store.saveWishlist(productId);
      setWishlist((current) => { const next = new Set(current); saved ? next.delete(productId) : next.add(productId); return next; });
    } catch (e) { showRequestError(e); }
  };
  const openProduct = async (product: StoreProduct) => {
    try { const [full, reviews] = await Promise.all([api.store.product(product.id), api.store.reviews(product.id)]); setDetail(full); setSelectedVariants({}); setDetailReviews(reviews); }
    catch (e) { showRequestError(e); }
  };
  const openCheckout = async () => {
    setError(""); setShowAddressForm(false); setPreview(null);
    try {
      const rows = await api.store.addresses(); setAddresses(rows); setSelectedAddress(rows.find((row) => row.isDefault)?.id ?? rows[0]?.id ?? ""); setModal("checkout");
    } catch (e) { showRequestError(e); }
  };
  const previewCheckout = async () => {
    if (!selectedAddress) { setError("Add and select a delivery address first."); return; }
    try { setBusy(true); setError(""); setPreview(await api.store.previewCheckout(selectedAddress)); }
    catch (e) { showRequestError(e); }
    finally { setBusy(false); }
  };
  const saveAddress = async () => {
    try {
      setBusy(true); setError(""); const saved = await api.store.addAddress(addressForm); setAddresses((current) => [saved, ...current]); setSelectedAddress(saved.id); setShowAddressForm(false); setAddressForm(emptyAddress); setPreview(null);
    } catch (e) { showRequestError(e); }
    finally { setBusy(false); }
  };
  const showOrders = async () => {
    try { setOrderHistory((await api.store.orders()).items); setModal("orders"); } catch (e) { showRequestError(e); }
  };

  const addressField = (key: keyof StoreAddressInput, placeholder: string, keyboardType: "default" | "phone-pad" | "number-pad" = "default") => <TextInput key={key} style={styles.input} placeholder={placeholder} value={String(addressForm[key] ?? "")} keyboardType={keyboardType} onChangeText={(value) => setAddressForm((current) => ({ ...current, [key]: value }))} />;
  const productCard = (product: StoreProduct) => <View key={product.id} style={styles.productCard}>
    <TouchableOpacity style={styles.productPhoto} onPress={() => void openProduct(product)} accessibilityLabel={`View ${product.name}`}>
      {product.images?.[0] ? <Image source={{ uri: product.images[0] }} style={styles.photo} resizeMode="cover" /> : <View style={styles.photoPlaceholder}><Ionicons name="cube-outline" size={38} color="#a3abc0" /></View>}
      <TouchableOpacity style={styles.wishButton} onPress={() => void toggleWishlist(product.id)} accessibilityLabel={wishlist.has(product.id) ? "Remove from wishlist" : "Add to wishlist"}><Ionicons name={wishlist.has(product.id) ? "heart" : "heart-outline"} size={20} color={wishlist.has(product.id) ? "#e0526e" : "#4057e8"} /></TouchableOpacity>
    </TouchableOpacity>
    <TouchableOpacity style={styles.productInfo} onPress={() => void openProduct(product)}>
      <Text style={styles.category}>{product.category ?? "Store"}</Text><Text style={styles.name} numberOfLines={2}>{product.name}</Text><Text style={styles.description} numberOfLines={2}>{product.description}</Text>
      <View style={styles.priceLine}><View style={styles.priceValues}><Text style={styles.price}>{rupees(product.pricePaise)}</Text>{product.originalPricePaise && product.originalPricePaise > product.pricePaise ? <Text style={styles.originalPrice}>{rupees(product.originalPricePaise)}</Text> : null}</View>{product.discountPercent > 0 ? <Text style={styles.discountBadge}>{product.discountPercent}% off</Text> : null}</View>
      <Text style={styles.stock}>{availableStock(product) > 0 ? availableStock(product) + " available" : "Out of stock"}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.addButton, availableStock(product) < 1 && styles.addButtonDisabled]} disabled={busy || availableStock(product) < 1} onPress={() => product.variants?.length ? void openProduct(product) : void addToCart(product)}><Ionicons name={availableStock(product) < 1 ? "close-circle-outline" : product.variants?.length ? "options-outline" : "bag-add-outline"} size={17} color="#fff"/><Text style={styles.addButtonText}>{availableStock(product) < 1 ? "Out of stock" : product.variants?.length ? "Choose options" : "Add to cart"}</Text></TouchableOpacity>
  </View>;

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: showBack ? Math.max(insets.top, 8) + 8 : 12 }]}>
      {showBack && <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color="#1b2845" /></TouchableOpacity>}
      <View pointerEvents="none" style={styles.headerTitle}><Text style={styles.title}>JNV Store</Text></View>
      <TouchableOpacity style={styles.headerButton} onPress={() => void showOrders()}><Ionicons name="receipt-outline" size={20} color="#4057e8" /></TouchableOpacity>
      <TouchableOpacity style={styles.cartButton} onPress={() => { void loadCart(); setModal("cart"); }}><Ionicons name="cart-outline" size={21} color="#fff" />{cartCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>}</TouchableOpacity>
    </View>
    <ScrollView style={styles.catalogScroll} contentContainerStyle={styles.catalogContent} keyboardShouldPersistTaps="handled">
      <View style={styles.search}><Ionicons name="search-outline" size={20} color="#687591"/><TextInput value={query} onChangeText={setQuery} placeholder="Search products, brands and more" placeholderTextColor="#8994aa" style={styles.searchInput}/>{query ? <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={19} color="#8994aa"/></TouchableOpacity> : null}</View>
      {catalogError ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#b42318"/><Text style={styles.error}>{catalogError.includes("Not Found") ? "Store catalog could not be reached. Check the API server and refresh." : catalogError}</Text><TouchableOpacity onPress={() => void loadCatalog(1)}><Text style={styles.errorRetry}>Retry</Text></TouchableOpacity></View> : null}
      {error ? <TouchableOpacity onPress={() => setError("")} style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#b42318"/><Text style={styles.error}>{error}</Text><Text style={styles.errorRetry}>Dismiss</Text></TouchableOpacity> : null}
      {featured.length > 0 && !query && !activeCategory && <View style={styles.featuredSection}><Text style={styles.sectionHeading}>Featured</Text><ScrollView horizontal style={styles.featuredScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featured}>{featured.map((item) => <TouchableOpacity key={item.id} onPress={() => void openProduct(item)} style={styles.featuredCard}>{item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.featuredPhoto} resizeMode="cover"/> : <View style={styles.featuredFallback}><Ionicons name="cube-outline" size={34} color="#dbe5ff"/></View>}<View style={styles.featuredShade}/><View style={styles.featuredInfo}><Text style={styles.featuredLabel}>★ Featured</Text><Text style={styles.featuredName} numberOfLines={2}>{item.name}</Text><Text style={styles.featuredPrice}>{rupees(item.pricePaise)}</Text></View><View style={styles.featuredAdd}><Ionicons name="add" size={24} color="#fff"/></View></TouchableOpacity>)}</ScrollView></View>}
      <View style={styles.categorySection}><Text style={styles.sectionHeading}>Categories</Text><ScrollView horizontal style={styles.chipScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><TouchableOpacity onPress={() => setActiveCategory("")} style={[styles.chip, !activeCategory && styles.chipActive]}><Text style={[styles.chipText, !activeCategory && styles.chipTextActive]}>🔥  All</Text></TouchableOpacity>{categories.map((item) => <TouchableOpacity key={item.id} onPress={() => setActiveCategory(activeCategory === item.name ? "" : item.name)} style={[styles.chip, activeCategory === item.name && styles.chipActive]}><Text style={[styles.chipText, activeCategory === item.name && styles.chipTextActive]}>{item.name}</Text></TouchableOpacity>)}</ScrollView></View>
      <View style={styles.sortRow}><View><Text style={styles.sectionTitle}>Shop products</Text><Text style={styles.productCount}>{totalProducts} {totalProducts === 1 ? "product" : "products"}</Text></View><View style={styles.sortChips}>{[["newest", "New"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]].map(([value, label]) => <TouchableOpacity key={value} style={[styles.sortChip, sort === value && styles.sortChipActive]} onPress={() => setSort(value)}><Text style={[styles.sortText, sort === value && styles.sortTextActive]}>{label}</Text></TouchableOpacity>)}</View></View>
      {loading && products.length === 0 ? <View style={styles.center}><ActivityIndicator color="#4057e8"/><Text style={styles.muted}>Loading products…</Text></View> : products.length ? <View style={styles.grid}>{products.map(productCard)}{hasMore && <TouchableOpacity style={styles.moreButton} disabled={loading} onPress={() => void loadCatalog(page + 1)}><Text style={styles.moreText}>{loading ? "Loading…" : "Load more products"}</Text></TouchableOpacity>}</View> : <View style={styles.empty}><Ionicons name={catalogError ? "cloud-offline-outline" : "storefront-outline"} size={42} color="#9ba6bb"/><Text style={styles.emptyTitle}>{catalogError ? "Store temporarily unavailable" : query || activeCategory ? "No matching products" : "No products available yet"}</Text><Text style={styles.muted}>{catalogError ? "The product service did not return a catalog. Try again after the API is available." : "Published JNV Store products will appear here."}</Text><TouchableOpacity onPress={() => void loadCatalog(1)} style={styles.retry}><Text style={styles.retryText}>Refresh catalog</Text></TouchableOpacity></View>}
    </ScrollView>

    <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}><View style={styles.modal}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>Product details</Text><TouchableOpacity onPress={() => setDetail(null)} style={styles.close}><Ionicons name="close" size={22} color="#26334f"/></TouchableOpacity></View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }}>{detail?.images?.length ? <ScrollView horizontal pagingEnabled>{detail.images.map((image, index) => <Image key={index} source={{ uri: image }} style={styles.detailImage} resizeMode="cover" />)}</ScrollView> : <View style={[styles.detailImage, styles.photoPlaceholder]}><Ionicons name="cube-outline" size={48} color="#a3abc0"/></View>}
        <Text style={styles.category}>{detail?.category ?? "Store"}</Text><Text style={styles.detailName}>{detail?.name}</Text><Text style={styles.price}>{detail ? rupees(detail.pricePaise) : ""}</Text><Text style={styles.descriptionFull}>{detail?.description}</Text>{detail?.sku ? <Text style={styles.muted}>SKU: {detail.sku}</Text> : null}{detail?.brand ? <Text style={styles.muted}>Brand: {detail.brand}</Text> : null}
        {!!detail?.variants?.length && detail.variants.map((variant) => <View key={variant.name} style={styles.variant}><Text style={styles.sectionTitle}>{variant.name}{selectedVariants[variant.name] ? `: ${selectedVariants[variant.name]}` : " · Choose one"}</Text><View style={styles.variantOptions}>{variant.options.map((option) => <TouchableOpacity key={option.value} disabled={option.stock < 1} onPress={() => setSelectedVariants((current) => ({ ...current, [variant.name]: option.value }))} style={[styles.variantOption, selectedVariants[variant.name] === option.value && styles.variantOptionSelected, option.stock < 1 && styles.variantOptionDisabled]}><Text style={[styles.variantOptionText, selectedVariants[variant.name] === option.value && styles.variantOptionTextSelected]}>{option.value}{option.stock < 1 ? " · out" : ""}</Text></TouchableOpacity>)}</View></View>)}
        <View style={styles.reviewSection}><Text style={styles.sectionTitle}>Reviews</Text>{detailReviews.length ? detailReviews.map((review) => <View key={review.id} style={styles.review}><Text style={styles.reviewTitle}>★ {review.rating}/5 · {review.reviewer ?? "Navodayan"}</Text><Text style={styles.muted}>{review.body || "No written review"}</Text></View>) : <Text style={styles.muted}>No verified-purchase reviews yet.</Text>}</View>
        <TouchableOpacity style={[styles.primary, detail && availableStock(detail) < 1 && styles.addButtonDisabled]} disabled={busy || !detail || availableStock(detail) < 1} onPress={() => detail && void addToCart(detail, selectedVariants)}><Text style={styles.primaryText}>{detail && availableStock(detail) > 0 ? "Add to cart" : "Out of stock"}</Text></TouchableOpacity>
      </ScrollView>
    </View></Modal>

    <Modal visible={modal === "cart"} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(null)}><View style={styles.modal}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Your cart</Text><Text style={styles.muted}>{cartCount} item{cartCount === 1 ? "" : "s"}</Text></View><TouchableOpacity onPress={() => setModal(null)} style={styles.close}><Ionicons name="close" size={22} color="#26334f"/></TouchableOpacity></View><ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>{cart.map((item) => <View key={item.id} style={styles.cartRow}><View style={styles.productIcon}><Ionicons name="cube-outline" size={21} color="#4057e8"/></View><View style={{ flex: 1 }}><Text style={styles.name}>{item.productName}</Text><Text style={styles.muted}>{Object.values(JSON.parse(item.variantSelection || "{}"))?.join(" · ") || "Standard"}</Text><Text style={styles.muted}>{rupees(item.pricePaise)} · {item.stock} available</Text><View style={styles.quantity}><TouchableOpacity onPress={() => void setQuantity(item, item.quantity - 1)}><Ionicons name="remove-circle-outline" size={23} color="#4057e8"/></TouchableOpacity><Text>{item.quantity}</Text><TouchableOpacity onPress={() => void setQuantity(item, item.quantity + 1)}><Ionicons name="add-circle-outline" size={23} color="#4057e8"/></TouchableOpacity><TouchableOpacity onPress={() => void setQuantity(item, 0)}><Ionicons name="trash-outline" size={18} color="#8b5361"/></TouchableOpacity></View></View></View>)}</ScrollView>{cart.length > 0 && <View style={styles.cartFooter}><View style={styles.priceRow}><Text style={styles.sectionTitle}>Subtotal</Text><Text style={styles.price}>{rupees(subtotal)}</Text></View><Text style={styles.muted}>Shipping and final charges are calculated after address validation.</Text><TouchableOpacity style={styles.primary} onPress={() => void openCheckout()}><Text style={styles.primaryText}>Continue to checkout</Text></TouchableOpacity></View>}</View></Modal>

    <Modal visible={modal === "checkout"} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(null)}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Delivery and checkout</Text><TouchableOpacity onPress={() => setModal(null)} style={styles.close}><Ionicons name="close" size={22} color="#26334f"/></TouchableOpacity></View><ScrollView contentContainerStyle={{ padding: 18, gap: 10 }}><Text style={styles.sectionTitle}>Delivery address</Text>{addresses.map((address) => <TouchableOpacity key={address.id} onPress={() => { setSelectedAddress(address.id); setPreview(null); }} style={[styles.addressRow, selectedAddress === address.id && styles.addressSelected]}><Ionicons name={selectedAddress === address.id ? "radio-button-on" : "radio-button-off"} size={19} color="#4057e8"/><View><Text style={styles.name}>{address.recipientName} · {address.type}</Text><Text style={styles.muted}>{address.line1}, {address.city}, {address.state} {address.pincode}</Text></View></TouchableOpacity>)}<TouchableOpacity style={styles.secondary} onPress={() => setShowAddressForm(!showAddressForm)}><Ionicons name="add" size={18} color="#4057e8"/><Text style={styles.secondaryText}>{showAddressForm ? "Cancel" : "Add delivery address"}</Text></TouchableOpacity>{showAddressForm && <View style={styles.form}>{addressField("recipientName", "Recipient name")}<TextInput style={styles.input} placeholder="Address type: home / hostel / school / other" value={addressForm.type} onChangeText={(value) => setAddressForm((current) => ({ ...current, type: value as StoreAddressInput["type"] }))}/>{addressField("phone", "Contact number", "phone-pad")}{addressField("line1", "House / building / street")}{addressField("line2", "Landmark or address line 2")}{addressField("city", "City")}{addressField("district", "District")}{addressField("state", "State")}{addressField("pincode", "6-digit PIN code", "number-pad")}<TouchableOpacity style={styles.primary} disabled={busy} onPress={() => void saveAddress()}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save address"}</Text></TouchableOpacity></View>}
        {!!addresses.length && <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => void previewCheckout()}><Text style={styles.primaryText}>{busy ? "Checking…" : "Review order"}</Text></TouchableOpacity>}
        {preview && <View style={styles.notice}><Text style={styles.noticeTitle}>{preview.canPlaceOrder ? "Ready for checkout" : "Checkout is not available yet"}</Text><Text style={styles.muted}>{preview.message ?? "Your cart and address were validated."}</Text><View style={styles.priceRow}><Text style={styles.name}>Subtotal</Text><Text style={styles.name}>{rupees(preview.subtotalPaise)}</Text></View><Text style={styles.muted}>Shipping and taxes cannot be quoted until delivery and tax providers are configured.</Text></View>}
      </ScrollView></View></Modal>

    <Modal visible={modal === "orders"} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(null)}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Orders</Text><TouchableOpacity onPress={() => setModal(null)} style={styles.close}><Ionicons name="close" size={22} color="#26334f"/></TouchableOpacity></View>{orderHistory.length ? <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>{orderHistory.map((order) => <View key={order.id} style={styles.cartRow}><Ionicons name="receipt-outline" size={23} color="#4057e8"/><View style={{ flex: 1 }}><Text style={styles.name}>{order.orderNumber}</Text><Text style={styles.muted}>{order.status} · payment {order.paymentStatus}</Text><Text style={styles.price}>{rupees(order.totalPaise)}</Text></View></View>)}</ScrollView> : <View style={styles.empty}><Ionicons name="receipt-outline" size={40} color="#9ba6bb"/><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Orders will appear here after a secure order is created.</Text></View>}</View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6fb" }, catalogScroll: { flex: 1 }, catalogContent: { paddingBottom: 34 }, header: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 17, paddingBottom: 8, backgroundColor: "#fff", position: "relative" }, headerTitle: { position: "absolute", left: 0, right: 0, top: 0, bottom: 8, alignItems: "center", justifyContent: "center" }, back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, eyebrow: { color: "#7c879e", fontSize: 9, letterSpacing: 1.4, fontFamily: "Inter_700Bold" }, title: { color: "#17223b", fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 }, headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#f0f3ff", alignItems: "center", justifyContent: "center" }, cartButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#4057e8", alignItems: "center", justifyContent: "center" }, badge: { position: "absolute", right: -2, top: -2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#e0526e", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" }, search: { marginHorizontal: 16, marginTop: 16, marginBottom: 14, height: 54, borderRadius: 14, paddingHorizontal: 13, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#e5eaf2" }, searchInput: { flex: 1, color: "#26334f", fontSize: 13 }, sortRow: { paddingHorizontal: 17, paddingTop: 5, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, productCount: { color: "#8390a7", fontSize: 11, marginTop: 3 }, sortChips: { flexDirection: "row", gap: 6 }, sectionHeading: { color: "#18243c", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 10 }, featuredSection: { marginTop: 2 }, categorySection: { marginTop: 4 }, sectionTitle: { color: "#26334f", fontSize: 15, fontFamily: "Inter_700Bold" }, sortChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: "#fff" }, sortChipActive: { backgroundColor: "#4057e8" }, sortText: { fontSize: 10, color: "#687591" }, sortTextActive: { color: "#fff" }, chipScroller: { flexGrow: 0, flexShrink: 0, height: 50 }, chips: { paddingHorizontal: 16, height: 50, alignItems: "center", gap: 9 }, chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5eaf2" }, chipActive: { backgroundColor: "#4057e8", borderColor: "#4057e8" }, chipText: { color: "#56637d", fontSize: 11 }, chipTextActive: { color: "#fff" }, featuredScroller: { flexGrow: 0, flexShrink: 0, height: 218 }, featured: { paddingHorizontal: 16, paddingVertical: 4, gap: 12 }, featuredCard: { width: 258, height: 202, borderRadius: 22, overflow: "hidden", justifyContent: "flex-end", backgroundColor: "#293e7c" }, featuredPhoto: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" }, featuredFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#293e7c" }, featuredShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(14,22,42,0.22)" }, featuredInfo: { paddingHorizontal: 14, paddingBottom: 15, maxWidth: "78%" }, featuredAdd: { position: "absolute", right: 12, bottom: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: "#4057e8", alignItems: "center", justifyContent: "center" }, featuredLabel: { color: "#ffbf36", fontSize: 11, fontFamily: "Inter_700Bold", marginBottom: 7 }, featuredName: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" }, featuredPrice: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 4 }, grid: { paddingHorizontal: 13, paddingBottom: 35, flexDirection: "row", flexWrap: "wrap", gap: 10 }, productCard: { width: "48%", backgroundColor: "#fff", borderRadius: 15, overflow: "hidden", borderWidth: 1, borderColor: "#e8edf5", paddingBottom: 9 }, productPhoto: { height: 182, position: "relative", backgroundColor: "#edf0f7" }, photo: { width: "100%", height: "100%" }, photoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#eef1f8" }, wishButton: { position: "absolute", right: 8, top: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, productInfo: { padding: 10 }, category: { color: "#4057e8", fontSize: 10, fontFamily: "Inter_600SemiBold" }, name: { color: "#26334f", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 }, description: { color: "#77839b", fontSize: 10, lineHeight: 14, marginTop: 4 }, priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }, priceLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 9 }, priceValues: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, price: { color: "#26334f", fontSize: 15, fontFamily: "Inter_700Bold" }, originalPrice: { color: "#98a1b1", fontSize: 10, textDecorationLine: "line-through" }, discountBadge: { color: "#188258", backgroundColor: "#e9f7f0", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, fontSize: 9, fontFamily: "Inter_600SemiBold" }, stock: { color: "#8692a7", fontSize: 9, marginTop: 4 }, addButton: { marginHorizontal: 9, height: 34, borderRadius: 11, backgroundColor: "#4057e8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, addButtonDisabled: { backgroundColor: "#9ca6bb" }, addButtonText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" }, errorBox: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: "#fff0f0", flexDirection: "row", alignItems: "center", gap: 8 }, errorRetry: { color: "#4057e8", fontSize: 11, fontFamily: "Inter_700Bold" }, error: { flex: 1, color: "#b42318", fontSize: 12, lineHeight: 17 }, center: { minHeight: 210, alignItems: "center", justifyContent: "center", gap: 10 }, empty: { minHeight: 250, alignItems: "center", justifyContent: "center", padding: 30, gap: 10 }, emptyTitle: { color: "#26334f", fontSize: 16, fontFamily: "Inter_700Bold" }, muted: { color: "#78849b", fontSize: 12, lineHeight: 18 }, retry: { padding: 10 }, retryText: { color: "#4057e8", fontFamily: "Inter_600SemiBold" }, moreButton: { width: "100%", alignItems: "center", padding: 12 }, moreText: { color: "#4057e8", fontSize: 12 }, modal: { flex: 1, backgroundColor: "#fff" }, modalHeader: { minHeight: 62, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: "#edf0f5", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: "#26334f", fontSize: 19, fontFamily: "Inter_700Bold" }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#f1f3f8", alignItems: "center", justifyContent: "center" }, detailImage: { width: 300, height: 240, borderRadius: 17, marginRight: 9 }, detailName: { color: "#1b2845", fontSize: 22, fontFamily: "Inter_700Bold", marginVertical: 7 }, descriptionFull: { color: "#687591", fontSize: 14, lineHeight: 21, marginTop: 12 }, variant: { marginTop: 18, padding: 13, borderRadius: 13, backgroundColor: "#f8f7ff", gap: 5 }, variantOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, variantOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#dce2ef", backgroundColor: "#fff" }, variantOptionSelected: { borderColor: "#4057e8", backgroundColor: "#edf0ff" }, variantOptionDisabled: { opacity: 0.45 }, variantOptionText: { color: "#56637d", fontSize: 12 }, variantOptionTextSelected: { color: "#4057e8", fontFamily: "Inter_700Bold" }, reviewSection: { marginTop: 21, gap: 9 }, review: { padding: 12, borderRadius: 12, backgroundColor: "#f6f7fa", gap: 5 }, reviewTitle: { color: "#394762", fontSize: 12, fontFamily: "Inter_600SemiBold" }, primary: { minHeight: 47, borderRadius: 13, backgroundColor: "#4057e8", alignItems: "center", justifyContent: "center", marginTop: 14 }, primaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }, cartRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#f8f9fc" }, productIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#edf0ff", alignItems: "center", justifyContent: "center" }, quantity: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 8 }, cartFooter: { padding: 18, borderTopWidth: 1, borderColor: "#e8edf5" }, addressRow: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: "#e5eaf2", flexDirection: "row", gap: 10, alignItems: "center" }, addressSelected: { borderColor: "#4057e8", backgroundColor: "#f7f8ff" }, secondary: { height: 43, borderRadius: 12, backgroundColor: "#f0f3ff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, secondaryText: { color: "#4057e8", fontSize: 12, fontFamily: "Inter_600SemiBold" }, form: { gap: 7, paddingVertical: 6 }, input: { minHeight: 43, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: "#e1e6ef", color: "#26334f" }, notice: { padding: 14, borderRadius: 13, backgroundColor: "#fff6e5", gap: 9, marginTop: 9 }, noticeTitle: { color: "#8c5c0e", fontSize: 14, fontFamily: "Inter_700Bold" },
});
