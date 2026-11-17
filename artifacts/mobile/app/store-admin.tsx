import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, type StoreAdminCategory, type StoreAdminDashboard, type StoreAdminMember, type StoreAdminProduct, type StoreAdminRole, type StoreAdminStaff, type StoreSeller } from "@/lib/api";
import { clearStoreAdminToken, getStoreAdminToken, setStoreAdminToken } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

type Section = "Overview" | "Products" | "Categories" | "Sellers" | "Inventory" | "Staff & permissions" | "Audit logs";
const ADMIN_ROLES: StoreAdminRole[] = ["store_manager", "product_manager", "order_manager", "inventory_manager", "seller_manager", "finance_manager", "customer_support"];

export default function StoreAdminScreen() {
  const [staff, setStaff] = useState<StoreAdminStaff | null>(null);
  const [dashboard, setDashboard] = useState<StoreAdminDashboard | null>(null);
  const [products, setProducts] = useState<StoreAdminProduct[]>([]);
  const [categories, setCategories] = useState<StoreAdminCategory[]>([]);
  const [sellerApplications, setSellerApplications] = useState<StoreSeller[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, any>>>([]);
  const [section, setSection] = useState<Section>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImageUrls, setProductImageUrls] = useState("");
  const [productVariantsJson, setProductVariantsJson] = useState("[]");
  const [productSku, setProductSku] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productOriginalPrice, setProductOriginalPrice] = useState("");
  const [productStock, setProductStock] = useState("0");
  const [productCategoryId, setProductCategoryId] = useState<string | null>(null);
  const [productFeatured, setProductFeatured] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [stockEditId, setStockEditId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState("");
  const [adminStaff, setAdminStaff] = useState<StoreAdminMember[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<StoreAdminRole>("product_manager");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingStaffRole, setEditingStaffRole] = useState<StoreAdminRole>("product_manager");
  const { width: viewportWidth } = useWindowDimensions();
  const wideLayout = viewportWidth >= 960;

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await api.storeAdmin.me();
      setStaff(me.staff);
      if (!me.staff.permissions.includes("products.view")) {
        setDashboard(null); setProducts([]); setCategories([]);
        setError("Your assigned role is valid, but its order and support workspace is not configured yet.");
        return;
      }
      const [metrics, productPage, categoryList] = await Promise.all([
        api.storeAdmin.dashboard(), api.storeAdmin.products({ pageSize: 50 }), api.storeAdmin.categories(),
      ]);
      setDashboard(metrics);
      setProducts(productPage.items);
      setCategories(categoryList);
      if (me.staff.permissions.includes("sellers.approve")) setSellerApplications((await api.storeAdmin.sellers()).items);
      if (me.staff.permissions.includes("staff.manage")) setAdminStaff((await api.storeAdmin.staff()).items);
    } catch (e) {
      const status = typeof e === "object" && e && "status" in e ? (e as { status?: number }).status : undefined;
      if (status === 401 || status === 403) { await clearStoreAdminToken(); setStaff(null); }
      setError(status === 403 ? "Access denied. This account is not authorized for Store administration." : e instanceof Error ? e.message : "Could not load the admin dashboard.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (await getStoreAdminToken()) await loadAdminData();
      else if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadAdminData]);

  const has = (permission: string) => Boolean(staff?.permissions.includes(permission));
  const canLogin = useMemo(() => loginEmail.trim().length > 4 && loginPassword.length > 0, [loginEmail, loginPassword]);

  const signIn = async () => {
    if (!canLogin || busy) return;
    setBusy(true); setError("");
    try {
      const response = await api.storeAdmin.login(loginEmail.trim(), loginPassword);
      await setStoreAdminToken(response.token);
      setLoginPassword("");
      await loadAdminData();
    } catch (e) {
      const currentUser = firebaseAuth?.currentUser;
      if (currentUser && currentUser.email?.toLowerCase() === loginEmail.trim().toLowerCase()) {
        try {
          const response = await api.storeAdmin.loginWithFirebase(await currentUser.getIdToken());
          await setStoreAdminToken(response.token); setLoginPassword(""); await loadAdminData();
        } catch (firebaseError) { setError(firebaseError instanceof Error ? firebaseError.message : "Administrator sign-in failed."); }
      } else setError(e instanceof Error ? e.message : "Administrator sign-in failed.");
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    try { await api.storeAdmin.logout(); } catch { /* Local token revocation still clears this device. */ }
    await clearStoreAdminToken();
    setStaff(null); setDashboard(null); setProducts([]); setCategories([]); setAuditLogs([]);
    router.replace("/" as any);
  };

  const refreshProducts = async () => {
    const [page, metrics] = await Promise.all([api.storeAdmin.products({ pageSize: 50 }), api.storeAdmin.dashboard()]);
    setProducts(page.items); setDashboard(metrics);
  };

  const saveProduct = async () => {
    const priceRupees = Number(productPrice);
    const stock = Number(productStock);
    if (!productName.trim() || !Number.isFinite(priceRupees) || priceRupees < 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Add a product name, a valid price and a whole-number stock quantity."); return;
    }
    let variants: NonNullable<StoreAdminProduct["variants"]> = [];
    try { variants = JSON.parse(productVariantsJson); if (!Array.isArray(variants)) throw new Error(); }
    catch { setError('Variants must be valid JSON, for example: [{"name":"Size","options":[{"value":"M","stock":4}]}].'); return; }
    const originalPricePaise = productOriginalPrice.trim() ? Math.round(Number(productOriginalPrice) * 100) : null;
    if (originalPricePaise !== null && (!Number.isSafeInteger(originalPricePaise) || originalPricePaise < 0)) { setError("Enter a valid original price."); return; }
    const images = productImageUrls.split(/[\n,]/).map((url) => url.trim()).filter(Boolean);
    if (images.some((url) => !url.startsWith("https://"))) { setError("Product image URLs must use HTTPS."); return; }
    setBusy(true); setError("");
    try {
      const payload = { name: productName.trim(), description: productDescription.trim(), pricePaise: Math.round(priceRupees * 100), originalPricePaise, sku: productSku.trim() || null, brand: productBrand.trim() || null, variants, images, stock, categoryId: productCategoryId, featured: productFeatured };
      if (editingProductId) await api.storeAdmin.updateProduct(editingProductId, payload);
      else await api.storeAdmin.createProduct({ ...payload, status: "draft" });
      setProductName(""); setProductPrice(""); setProductDescription(""); setProductImageUrls(""); setProductVariantsJson("[]"); setProductSku(""); setProductBrand(""); setProductOriginalPrice(""); setProductStock("0"); setProductCategoryId(null); setProductFeatured(false); setEditingProductId(null); setShowProductForm(false);
      await refreshProducts();
    } catch (e) { setError(e instanceof Error ? e.message : "Product could not be saved."); }
    finally { setBusy(false); }
  };

  const createCategory = async () => {
    if (!categoryName.trim()) return;
    setBusy(true); setError("");
    try {
      await api.storeAdmin.createCategory({ name: categoryName.trim(), imageUrl: categoryImageUrl.trim() || undefined });
      setCategoryName(""); setCategoryImageUrl(""); setCategories(await api.storeAdmin.categories());
    } catch (e) { setError(e instanceof Error ? e.message : "Category could not be saved."); }
    finally { setBusy(false); }
  };

  const updateCategory = async (category: StoreAdminCategory, updates: { name?: string; visible?: boolean }) => {
    setBusy(true); setError("");
    try { await api.storeAdmin.updateCategory(category.id, updates); setCategories(await api.storeAdmin.categories()); setEditingCategoryId(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Category could not be updated."); }
    finally { setBusy(false); }
  };

  const reviewSeller = async (seller: StoreSeller, status: "approved" | "rejected" | "suspended") => {
    setBusy(true); setError("");
    try { const updated = await api.storeAdmin.updateSeller(seller.id, status); setSellerApplications((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (e) { setError(e instanceof Error ? e.message : "Seller status could not be updated."); }
    finally { setBusy(false); }
  };

  const assignStaff = async () => {
    if (!staffEmail.trim() || !staffPassword) { setError("Enter the staff account email and confirm with your current password."); return; }
    setBusy(true); setError("");
    try {
      await api.storeAdmin.assignStaff(staffEmail.trim(), staffRole, staffPassword);
      setStaffEmail(""); setStaffPassword(""); setAdminStaff((await api.storeAdmin.staff()).items);
    } catch (e) { setError(e instanceof Error ? e.message : "Staff role could not be assigned."); }
    finally { setBusy(false); }
  };

  const toggleStaffActive = async (member: StoreAdminMember) => {
    if (!staffPassword) { setError("Enter your current password in the staff form to confirm this access change."); return; }
    setBusy(true); setError("");
    try {
      await api.storeAdmin.updateStaff(member.userId, { active: !member.active, currentPassword: staffPassword });
      setStaffPassword(""); setAdminStaff((await api.storeAdmin.staff()).items);
    } catch (e) { setError(e instanceof Error ? e.message : "Staff access could not be changed."); }
    finally { setBusy(false); }
  };

  const updateStaffRole = async (member: StoreAdminMember) => {
    if (!staffPassword) { setError("Confirm the role change with your current password."); return; }
    setBusy(true); setError("");
    try { await api.storeAdmin.updateStaff(member.userId, { role: editingStaffRole, currentPassword: staffPassword }); setStaffPassword(""); setEditingStaffId(null); setAdminStaff((await api.storeAdmin.staff()).items); }
    catch (e) { setError(e instanceof Error ? e.message : "Staff role could not be changed."); }
    finally { setBusy(false); }
  };

  const selectSection = async (next: Section) => {
    setSection(next);
    if (next === "Audit logs" && has("audit_logs.view")) {
      try { setAuditLogs((await api.storeAdmin.auditLogs(50)).items); }
      catch (e) { setError(e instanceof Error ? e.message : "Audit logs could not be loaded."); }
    }
    if (next === "Staff & permissions" && has("staff.manage")) {
      try { setAdminStaff((await api.storeAdmin.staff()).items); }
      catch (e) { setError(e instanceof Error ? e.message : "Staff list could not be loaded."); }
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#4057e8" /><Text style={styles.muted}>Checking administrator access…</Text></View>;

  if (!staff) return (
    <View style={styles.loginPage}>
      <View style={styles.loginCard}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color="#26334f" /></TouchableOpacity>
        <View style={styles.brand}><Ionicons name="shield-checkmark" size={28} color="#4057e8" /><Text style={styles.brandText}>JNV STORE ADMIN</Text></View>
        <Text style={styles.title}>Administrator sign in</Text>
        <Text style={styles.muted}>Use an account explicitly provisioned by your store administrator.</Text>
        <Text style={styles.label}>Work email</Text>
        <TextInput style={styles.input} value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@organization.org" />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={loginPassword} onChangeText={setLoginPassword} secureTextEntry autoComplete="current-password" placeholder="Password" onSubmitEditing={signIn} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={[styles.primary, (!canLogin || busy) && styles.disabled]} disabled={!canLogin || busy} onPress={signIn}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in securely</Text>}
        </TouchableOpacity>
        <Text style={styles.securityNote}>Access is granted only to active staff accounts. All admin requests are checked by the server.</Text>
      </View>
    </View>
  );

   const sections: Section[] = ["Overview", ...(has("products.view") ? ["Products" as const] : []), ...(has("products.view") ? ["Categories" as const] : []), ...(has("sellers.approve") ? ["Sellers" as const] : []), ...(has("inventory.manage") ? ["Inventory" as const] : []), ...(has("staff.manage") ? ["Staff & permissions" as const] : []), ...(has("audit_logs.view") ? ["Audit logs" as const] : [])];
  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <View><Text style={styles.kicker}>NAVODAYA CONNECT</Text><Text style={styles.topTitle}>JNV Store Admin</Text></View>
        <TouchableOpacity onPress={signOut} style={styles.logout}><Ionicons name="log-out-outline" size={19} color="#4057e8" /><Text style={styles.logoutText}>Sign out</Text></TouchableOpacity>
      </View>
      <View style={styles.profileBar}><View style={styles.avatar}><Ionicons name="shield-checkmark" size={18} color="#4057e8" /></View><View style={{ flex: 1 }}><Text style={styles.staffName}>{staff.name}</Text><Text style={styles.staffRole}>{staff.role.replaceAll("_", " ")} · {staff.email}</Text></View><TouchableOpacity onPress={loadAdminData} accessibilityLabel="Refresh dashboard"><Ionicons name="refresh" size={20} color="#6b7892" /></TouchableOpacity></View>
      <View style={wideLayout ? styles.workspace : styles.mobileWorkspace}>
      {wideLayout ? <View style={styles.sidebar}>{sections.map((item) => <TouchableOpacity key={item} onPress={() => void selectSection(item)} style={[styles.sidebarItem, section === item && styles.sidebarItemActive]}><Text style={[styles.sidebarText, section === item && styles.sidebarTextActive]}>{item}</Text></TouchableOpacity>)}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>{sections.map((item) => <TouchableOpacity key={item} onPress={() => void selectSection(item)} style={[styles.navItem, section === item && styles.navItemActive]}><Text style={[styles.navText, section === item && styles.navTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>}
      <ScrollView style={wideLayout ? styles.mainScroll : undefined} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <TouchableOpacity style={styles.errorBox} onPress={() => setError("")}><Text style={styles.error}>{error}</Text><Text style={styles.muted}>Tap to dismiss</Text></TouchableOpacity> : null}
        {section === "Overview" && <>
          <Text style={styles.pageTitle}>Dashboard overview</Text><Text style={styles.muted}>Live counts from the Store database.</Text>
          {dashboard ? <View style={styles.metrics}>{[["All products", dashboard.products.total, "cube-outline"], ["Published", dashboard.products.published, "eye-outline"], ["Low stock", dashboard.products.lowStock, "warning-outline"], ["Out of stock", dashboard.products.outOfStock, "remove-circle-outline"], ...(has("sellers.approve") ? [["Seller applications", dashboard.sellers.pending, "storefront-outline"]] : [])].map(([label, value, icon]) => <View key={String(label)} style={styles.metric}><Ionicons name={icon as any} size={20} color="#4057e8" /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View> : <View style={styles.panel}><Text style={styles.panelTitle}>No active workspace for this role</Text><Text style={styles.body}>This staff role can sign in, but its assigned order or support module has not been implemented in the Store admin yet. Ask a Super Admin to assign an active module.</Text></View>}
          <View style={styles.panel}><Text style={styles.panelTitle}>Store operations</Text><Text style={styles.body}>Product and category management are connected to the database. Orders, payments, refunds, sellers and delivery are unavailable because those Store services have not been configured.</Text><View style={styles.integration}><Text style={styles.integrationName}>Payments gateway</Text><Text style={styles.notConfigured}>Not configured</Text></View><View style={styles.integration}><Text style={styles.integrationName}>Delivery provider</Text><Text style={styles.notConfigured}>Not configured</Text></View></View>
          {has("products.view") && <TouchableOpacity style={styles.quickAction} onPress={() => setSection("Products")}><Ionicons name="cube-outline" size={20} color="#4057e8" /><Text style={styles.quickText}>Open product management</Text><Ionicons name="chevron-forward" size={18} color="#7b879e" /></TouchableOpacity>}
        </>}
        {section === "Products" && <>
          <View style={styles.titleRow}><View><Text style={styles.pageTitle}>Products</Text><Text style={styles.muted}>{products.length} shown · database records</Text></View>{has("products.create") && <TouchableOpacity style={styles.smallPrimary} onPress={() => { if (showProductForm) { setShowProductForm(false); setEditingProductId(null); } else { setEditingProductId(null); setProductName(""); setProductPrice(""); setProductDescription(""); setProductImageUrls(""); setProductVariantsJson("[]"); setProductSku(""); setProductBrand(""); setProductOriginalPrice(""); setProductStock("0"); setProductCategoryId(null); setProductFeatured(false); setShowProductForm(true); } }}><Ionicons name={showProductForm ? "close" : "add"} size={18} color="#fff" /><Text style={styles.smallPrimaryText}>{showProductForm ? "Close" : "Add product"}</Text></TouchableOpacity>}</View>
          {showProductForm && <View style={styles.panel}><Text style={styles.panelTitle}>{editingProductId ? "Edit product" : "New product"}</Text><Text style={styles.hint}>{editingProductId ? "Save product details to the database." : "New products are saved as drafts. Image upload needs a configured media service."}</Text><TextInput style={styles.input} placeholder="Product name" value={productName} onChangeText={setProductName} maxLength={160} /><TextInput style={styles.input} placeholder="Price (₹)" value={productPrice} onChangeText={setProductPrice} keyboardType="decimal-pad" /><TextInput style={styles.input} placeholder="Original price (₹, optional)" value={productOriginalPrice} onChangeText={setProductOriginalPrice} keyboardType="decimal-pad" /><TextInput style={styles.input} placeholder="SKU (optional)" value={productSku} onChangeText={setProductSku} maxLength={80} /><TextInput style={styles.input} placeholder="Brand (optional)" value={productBrand} onChangeText={setProductBrand} maxLength={100} /><TextInput style={styles.input} placeholder="Stock quantity" value={productStock} onChangeText={setProductStock} keyboardType="number-pad" /><TextInput style={[styles.input, styles.multiline]} placeholder="Description" value={productDescription} onChangeText={setProductDescription} multiline maxLength={10000} /><TextInput style={[styles.input, styles.multiline]} placeholder="Image URLs (HTTPS; one per line, up to 8)" value={productImageUrls} onChangeText={setProductImageUrls} multiline autoCapitalize="none" /><TextInput style={[styles.input, styles.multiline]} placeholder="Variants JSON (optional)" value={productVariantsJson} onChangeText={setProductVariantsJson} multiline autoCapitalize="none" /><Text style={styles.label}>Category</Text><View style={styles.roleChoices}><TouchableOpacity onPress={() => setProductCategoryId(null)} style={[styles.roleChoice, productCategoryId === null && styles.roleChoiceActive]}><Text style={[styles.roleChoiceText, productCategoryId === null && styles.roleChoiceTextActive]}>None</Text></TouchableOpacity>{categories.map((category: StoreAdminCategory) => <TouchableOpacity key={category.id} onPress={() => setProductCategoryId(category.id)} style={[styles.roleChoice, productCategoryId === category.id && styles.roleChoiceActive]}><Text style={[styles.roleChoiceText, productCategoryId === category.id && styles.roleChoiceTextActive]}>{category.name}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.featureToggle} onPress={() => setProductFeatured(!productFeatured)}><Ionicons name={productFeatured ? "checkbox" : "square-outline"} size={20} color="#4057e8" /><Text style={styles.productMeta}>Feature this product</Text></TouchableOpacity><TouchableOpacity style={styles.primary} disabled={busy} onPress={saveProduct}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editingProductId ? "Save changes" : "Save draft"}</Text>}</TouchableOpacity></View>}
          {products.map((product: StoreAdminProduct) => <View key={product.id} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="cube-outline" size={20} color="#4057e8" /></View><View style={{ flex: 1 }}><Text style={styles.productName} numberOfLines={1}>{product.name}</Text><Text style={styles.productMeta}>₹{(product.pricePaise / 100).toFixed(2)} · stock {product.stock} · {product.status.replaceAll("_", " ")}</Text></View>{has("products.edit") && <TouchableOpacity style={styles.stockButton} onPress={() => { setEditingProductId(product.id); setProductName(product.name); setProductPrice((product.pricePaise / 100).toFixed(2)); setProductDescription(product.description ?? ""); setProductImageUrls((product.images ?? []).join("\n")); setProductVariantsJson(JSON.stringify(product.variants ?? [], null, 2)); setProductSku(product.sku ?? ""); setProductBrand(product.brand ?? ""); setProductOriginalPrice(product.originalPricePaise ? String(product.originalPricePaise / 100) : ""); setProductStock(String(product.stock)); setProductCategoryId(product.categoryId ?? null); setProductFeatured(Boolean(product.featured)); setShowProductForm(true); }}><Text style={styles.stockButtonText}>Edit</Text></TouchableOpacity>}{(has("products.approve") || has("products.submit")) && !["published", "archived", "pending_approval"].includes(product.status) && <TouchableOpacity style={styles.publishBtn} onPress={async () => { try { await api.storeAdmin.updateProduct(product.id, { status: has("products.approve") ? "published" : "pending_approval" }); await refreshProducts(); } catch (e) { setError(e instanceof Error ? e.message : "Product status could not be updated."); } }}><Text style={styles.publishText}>{has("products.approve") ? "Publish" : "Submit"}</Text></TouchableOpacity>}{has("products.delete") && product.status !== "archived" && <TouchableOpacity onPress={() => { const archive = async () => { try { await api.storeAdmin.archiveProduct(product.id); await refreshProducts(); } catch (e) { setError(e instanceof Error ? e.message : "Could not archive product."); } }; if (Platform.OS === "web") { if (window.confirm(`Archive ${product.name}?`)) void archive(); } else Alert.alert("Archive product?", product.name, [{ text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: () => void archive() }]); }}><Ionicons name="archive-outline" size={20} color="#8a93a3" /></TouchableOpacity>}</View>)}
          {!products.length && <View style={styles.empty}><Ionicons name="cube-outline" size={30} color="#9aa5b6" /><Text style={styles.muted}>No products have been added.</Text></View>}
        </>}
        {section === "Categories" && <>
          <Text style={styles.pageTitle}>Categories</Text><Text style={styles.muted}>Manage product categories in the Store database.</Text>
          {has("categories.manage") && <View style={styles.panel}><TextInput style={styles.input} placeholder="New category name" value={categoryName} onChangeText={setCategoryName} maxLength={80} /><TextInput style={styles.input} placeholder="Optional HTTPS category image URL" value={categoryImageUrl} onChangeText={setCategoryImageUrl} autoCapitalize="none" keyboardType="url" /><TouchableOpacity style={styles.smallPrimary} onPress={() => void createCategory()}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.smallPrimaryText}>Create category</Text></TouchableOpacity></View>}
          {categories.map((category: StoreAdminCategory) => <View key={category.id} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="albums-outline" size={20} color="#4057e8" /></View><View style={{ flex: 1 }}>{editingCategoryId === category.id ? <View><TextInput style={styles.input} value={editingCategoryName} onChangeText={setEditingCategoryName} maxLength={80} placeholder="Category name" /><View style={styles.rowActions}><TouchableOpacity disabled={busy || !editingCategoryName.trim()} style={styles.smallPrimary} onPress={() => void updateCategory(category, { name: editingCategoryName.trim() })}><Text style={styles.smallPrimaryText}>Save</Text></TouchableOpacity><TouchableOpacity style={styles.stockButton} onPress={() => setEditingCategoryId(null)}><Text style={styles.stockButtonText}>Cancel</Text></TouchableOpacity></View></View> : <><Text style={styles.productName}>{category.name}</Text><Text style={styles.productMeta}>{category.visible ? "Visible" : "Hidden"}{category.imageUrl ? " · image set" : ""}</Text></>}</View>{has("categories.manage") && <View style={styles.rowActions}><TouchableOpacity style={styles.stockButton} onPress={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}><Text style={styles.stockButtonText}>Edit</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={styles.stockButton} onPress={() => void updateCategory(category, { visible: !category.visible })}><Text style={styles.stockButtonText}>{category.visible ? "Hide" : "Show"}</Text></TouchableOpacity></View>}</View>)}
          {!categories.length && <View style={styles.empty}><Text style={styles.muted}>No categories yet.</Text></View>}
        </>}
        {section === "Sellers" && <>
          <Text style={styles.pageTitle}>Seller applications</Text><Text style={styles.muted}>Review applications and update seller access. Every decision is checked and audited by the API.</Text>
          {sellerApplications.map((seller) => <View key={seller.id} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="storefront-outline" size={20} color="#4057e8" /></View><View style={{ flex: 1 }}><Text style={styles.productName}>{seller.displayName}</Text><Text style={styles.productMeta}>{seller.status} · {seller.description || "No description"}</Text>{seller.status === "pending" && <View style={styles.rowActions}><TouchableOpacity disabled={busy} style={styles.smallPrimary} onPress={() => void reviewSeller(seller, "approved")}><Text style={styles.smallPrimaryText}>Approve</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={styles.smallDanger} onPress={() => void reviewSeller(seller, "rejected")}><Text style={styles.dangerText}>Reject</Text></TouchableOpacity></View>}{seller.status === "approved" && <TouchableOpacity disabled={busy} style={styles.smallDanger} onPress={() => void reviewSeller(seller, "suspended")}><Text style={styles.dangerText}>Suspend seller</Text></TouchableOpacity>}</View></View>)}
          {!sellerApplications.length && <View style={styles.empty}><Text style={styles.muted}>No seller applications have been submitted.</Text></View>}
        </>}
        {section === "Inventory" && <>
          <Text style={styles.pageTitle}>Inventory</Text><Text style={styles.muted}>Current stock for products in the catalog.</Text>
          {products.map((product: StoreAdminProduct) => <View key={product.id} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="layers-outline" size={20} color={product.stock < 10 ? "#d98312" : "#4057e8"} /></View><View style={{ flex: 1 }}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>On hand: {product.stock} · {product.status.replaceAll("_", " ")}</Text>{stockEditId === product.id && <View style={styles.stockEdit}><TextInput style={[styles.input, styles.stockInput]} value={stockDraft} onChangeText={setStockDraft} keyboardType="number-pad" placeholder="Quantity" /><TouchableOpacity style={styles.stockButton} onPress={() => void setStock(product, stockDraft)}><Text style={styles.stockButtonText}>Save</Text></TouchableOpacity><TouchableOpacity onPress={() => setStockEditId(null)}><Ionicons name="close-circle-outline" size={21} color="#8691a4" /></TouchableOpacity></View>}</View>{has("inventory.manage") && stockEditId !== product.id && <TouchableOpacity style={styles.stockButton} onPress={() => { setStockEditId(product.id); setStockDraft(String(product.stock)); }}><Text style={styles.stockButtonText}>Adjust</Text></TouchableOpacity>}</View>)}
        </>}
        {section === "Staff & permissions" && <>
          <Text style={styles.pageTitle}>Staff & permissions</Text><Text style={styles.muted}>Assign existing accounts one of the least-privilege Store roles. Changes require your password and revoke the target account’s current sessions.</Text>
          <View style={styles.panel}><Text style={styles.panelTitle}>Assign a staff role</Text><TextInput style={styles.input} placeholder="Existing account email" value={staffEmail} onChangeText={setStaffEmail} autoCapitalize="none" keyboardType="email-address" /><Text style={styles.label}>Role</Text><View style={styles.roleChoices}>{ADMIN_ROLES.map((role) => <TouchableOpacity key={role} onPress={() => setStaffRole(role)} style={[styles.roleChoice, staffRole === role && styles.roleChoiceActive]}><Text style={[styles.roleChoiceText, staffRole === role && styles.roleChoiceTextActive]}>{role.replaceAll("_", " ")}</Text></TouchableOpacity>)}</View><TextInput style={[styles.input, { marginTop: 12 }]} placeholder="Confirm with your current password" value={staffPassword} onChangeText={setStaffPassword} secureTextEntry autoComplete="current-password" /><TouchableOpacity style={styles.primary} disabled={busy} onPress={assignStaff}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Assign role</Text>}</TouchableOpacity></View>
          {adminStaff.map((member: StoreAdminMember) => <View key={member.userId} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="person-outline" size={20} color="#4057e8" /></View><View style={{ flex: 1 }}><Text style={styles.productName}>{member.name}</Text>{editingStaffId === member.userId ? <><View style={styles.roleChoices}>{ADMIN_ROLES.map((role) => <TouchableOpacity key={role} onPress={() => setEditingStaffRole(role)} style={[styles.roleChoice, editingStaffRole === role && styles.roleChoiceActive]}><Text style={[styles.roleChoiceText, editingStaffRole === role && styles.roleChoiceTextActive]}>{role.replaceAll("_", " ")}</Text></TouchableOpacity>)}</View><View style={styles.rowActions}><TouchableOpacity disabled={busy} style={styles.smallPrimary} onPress={() => void updateStaffRole(member)}><Text style={styles.smallPrimaryText}>Save role</Text></TouchableOpacity><TouchableOpacity style={styles.stockButton} onPress={() => setEditingStaffId(null)}><Text style={styles.stockButtonText}>Cancel</Text></TouchableOpacity></View></> : <Text style={styles.productMeta}>{member.email} · {member.role.replaceAll("_", " ")}</Text>}</View><TouchableOpacity style={styles.stockButton} onPress={() => { setEditingStaffId(member.userId); setEditingStaffRole(member.role); }}><Text style={styles.stockButtonText}>Role</Text></TouchableOpacity><TouchableOpacity style={[styles.statusPill, !member.active && styles.statusDisabled]} onPress={() => void toggleStaffActive(member)}><Text style={styles.statusText}>{member.active ? "Disable" : "Enable"}</Text></TouchableOpacity></View>)}
        </>}
        {section === "Audit logs" && <><Text style={styles.pageTitle}>Audit logs</Text><Text style={styles.muted}>Recent administrator activity.</Text>{auditLogs.map((entry: Record<string, any>) => <View key={entry.id} style={styles.productRow}><View style={styles.productIcon}><Ionicons name="document-text-outline" size={20} color="#4057e8" /></View><View style={{ flex: 1 }}><Text style={styles.productName}>{String(entry.action).replaceAll(".", " · ")}</Text><Text style={styles.productMeta}>{entry.actorRole ?? "System"} · {new Date(entry.createdAt).toLocaleString()}</Text></View><Text style={styles.auditOutcome}>{entry.outcome}</Text></View>)}</>}
      </ScrollView>
      </View>
    </View>
  );

  async function setStock(product: StoreAdminProduct, entered?: string) {
    if (entered === undefined || !/^\d{1,7}$/.test(entered) || Number(entered) > 1_000_000) { setError("Stock must be a whole number between 0 and 1,000,000."); return; }
    try { await api.storeAdmin.updateProduct(product.id, { stock: Number(entered) }); setStockEditId(null); await refreshProducts(); }
    catch (e) { setError(e instanceof Error ? e.message : "Stock could not be updated."); }
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#f4f6fb" },
  page: { flex: 1, backgroundColor: "#f4f6fb" }, workspace: { flex: 1, flexDirection: "row" }, mobileWorkspace: { flex: 1 }, sidebar: { width: 250, backgroundColor: "#fff", borderRightWidth: 1, borderColor: "#e9edf4", padding: 14, gap: 6 }, sidebarItem: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12, borderRadius: 11 }, sidebarItemActive: { backgroundColor: "#edf0ff" }, sidebarText: { color: "#58647b", fontSize: 12, fontFamily: "Inter_600SemiBold" }, sidebarTextActive: { color: "#4057e8" }, mainScroll: { flex: 1 }, loginPage: { flex: 1, backgroundColor: "#eef1f8", justifyContent: "center", padding: 20 },
  loginCard: { width: "100%", maxWidth: 460, alignSelf: "center", backgroundColor: "#fff", padding: 24, borderRadius: 24, borderWidth: 1, borderColor: "#e5e9f2", ...(Platform.OS === "web" ? { boxShadow: "0 16px 40px rgba(30,45,80,0.1)" as any } : {}) },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f5fa", alignItems: "center", justifyContent: "center", marginBottom: 20 }, brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 }, brandText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#4057e8", letterSpacing: 1.4 },
  title: { fontSize: 25, fontFamily: "Inter_700Bold", color: "#17223b", marginBottom: 8 }, titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, pageTitle: { fontSize: 23, fontFamily: "Inter_700Bold", color: "#17223b", marginBottom: 6 }, muted: { color: "#75819a", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 }, label: { marginTop: 18, marginBottom: 7, fontSize: 13, color: "#38445d", fontFamily: "Inter_600SemiBold" }, input: { borderWidth: 1, borderColor: "#e1e6f0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#17223b", backgroundColor: "#fff", fontSize: 14, marginBottom: 10 }, multiline: { minHeight: 80, textAlignVertical: "top" },
  primary: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: "#4057e8", borderRadius: 14, marginTop: 14, paddingHorizontal: 18 }, primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }, disabled: { opacity: 0.55 }, error: { color: "#b42318", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 12 }, securityNote: { color: "#8a94a6", fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  topbar: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderColor: "#e9edf4", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, kicker: { fontSize: 10, letterSpacing: 1.5, color: "#75819a", fontFamily: "Inter_700Bold" }, topTitle: { fontSize: 19, color: "#17223b", fontFamily: "Inter_700Bold", marginTop: 3 }, logout: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0f3ff", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 }, logoutText: { color: "#4057e8", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  profileBar: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingBottom: 14 }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#edf0ff", alignItems: "center", justifyContent: "center" }, staffName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#26334f" }, staffRole: { color: "#78849b", fontSize: 11, textTransform: "capitalize", marginTop: 2 }, nav: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 8 }, navItem: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e7f0" }, navItemActive: { backgroundColor: "#4057e8", borderColor: "#4057e8" }, navText: { color: "#58647b", fontSize: 12, fontFamily: "Inter_600SemiBold" }, navTextActive: { color: "#fff" }, content: { padding: 18, paddingBottom: 48, gap: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 7 }, metric: { width: "48%", flexGrow: 1, minHeight: 112, padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e9edf4" }, metricValue: { color: "#17223b", fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 9 }, metricLabel: { color: "#78849b", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 }, panel: { backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#e9edf4", padding: 16, marginTop: 3 }, panelTitle: { color: "#26334f", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 }, body: { color: "#6c7890", fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular" }, integration: { paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderColor: "#edf0f5", flexDirection: "row", justifyContent: "space-between" }, integrationName: { color: "#45516a", fontFamily: "Inter_500Medium", fontSize: 12 }, notConfigured: { color: "#b07818", fontSize: 11, fontFamily: "Inter_600SemiBold" }, quickAction: { backgroundColor: "#fff", padding: 15, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10 }, quickText: { flex: 1, color: "#4057e8", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  smallPrimary: { backgroundColor: "#4057e8", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 3 }, rowActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 9 }, smallDanger: { backgroundColor: "#fff1f0", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, alignSelf: "flex-start", marginTop: 8 }, dangerText: { color: "#b42318", fontSize: 11, fontFamily: "Inter_600SemiBold" }, smallPrimaryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }, hint: { color: "#8a94a6", fontSize: 11, lineHeight: 17, marginBottom: 12 }, featureToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }, productRow: { backgroundColor: "#fff", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#e9edf4", flexDirection: "row", alignItems: "center", gap: 10 }, productIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#edf0ff", alignItems: "center", justifyContent: "center" }, productName: { color: "#26334f", fontSize: 13, fontFamily: "Inter_600SemiBold" }, productMeta: { color: "#818ca0", fontSize: 11, marginTop: 4 }, publishBtn: { backgroundColor: "#eaf8f0", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, publishText: { color: "#198754", fontSize: 11, fontFamily: "Inter_600SemiBold" }, stockButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f0f3ff" }, stockButtonText: { color: "#4057e8", fontSize: 11, fontFamily: "Inter_600SemiBold" }, stockEdit: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 }, stockInput: { width: 90, marginBottom: 0, paddingVertical: 7 }, statusPill: { backgroundColor: "#eaf8f0", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, statusDisabled: { backgroundColor: "#fff1f0" }, statusText: { color: "#4057e8", fontSize: 10, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" }, roleChoices: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, roleChoice: { backgroundColor: "#f4f6fb", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }, roleChoiceActive: { backgroundColor: "#4057e8" }, roleChoiceText: { fontSize: 10, color: "#58647b", textTransform: "capitalize" }, roleChoiceTextActive: { color: "#fff" }, inlineForm: { flexDirection: "row", gap: 8, alignItems: "center" }, empty: { alignItems: "center", padding: 30, gap: 10 }, errorBox: { backgroundColor: "#fff1f0", padding: 12, borderRadius: 12 }, auditOutcome: { color: "#69758a", fontSize: 11, textTransform: "uppercase" },
});
